import { NASA_DATA, TUNING } from "./constants"
import {
  addStatus,
  clamp,
  gainXp,
  hasStatus,
  isActive,
  removeStatus,
  traitMultiplier,
  traitSum,
  workSpeed,
} from "./pawn"
import { createRng } from "./rng"
import { ROLES } from "./roles"
import { STATUSES } from "./statuses"
import type { LogEntry, Mission, Pawn, StatusId } from "./types"

const MAX_LOG = 100

type Log = (kind: LogEntry["kind"], text: string, pawnId?: string) => void

/**
 * Advance the mission by `hours` (keep it at 1 or less; use advanceMission for longer spans).
 * Pure: returns a new Mission and leaves `prev` untouched.
 */
export function stepMission(prev: Mission, hours = 1): Mission {
  const mission = structuredClone(prev)
  const rng = createRng(mission.rngState)
  const log: Log = (kind, text, pawnId) => mission.log.push({ hour: mission.hour, kind, text, pawnId })

  const crew = mission.crew.filter(isActive)

  // 1. Decide: sleep or work. 2. Do role work. 3. Update bodies.
  for (const pawn of crew) decideActivity(pawn)
  for (const pawn of crew) {
    if (pawn.activity === "sleeping") continue
    if (!pawn.orders.enabled) {
      pawn.activity = "idle"
      pawn.task = "Off duty"
      continue
    }
    const result = ROLES[pawn.role].work({
      pawn,
      mission,
      rng,
      hours,
      speed: workSpeed(pawn),
      log: (kind, text) => log(kind, text, pawn.id),
    })
    pawn.activity = result.activity
    pawn.task = result.task
    if (result.activity !== "idle" && gainXp(pawn, hours)) {
      log("good", `${pawn.name} got better at ${ROLES[pawn.role].skillName} (skill ${pawn.skill}).`, pawn.id)
    }
  }
  for (const pawn of crew) updateBody(pawn, mission, hours, log)

  mission.hour += hours
  mission.rngState = rng.state
  if (mission.log.length > MAX_LOG) mission.log = mission.log.slice(-MAX_LOG)
  return mission
}

export function advanceMission(mission: Mission, hours: number): Mission {
  let m = mission
  for (let h = 0; h < hours; h++) m = stepMission(m, 1)
  return m
}

function decideActivity(pawn: Pawn) {
  const rest = pawn.needs.rest
  if (pawn.activity === "sleeping" ? rest < TUNING.wakeAtRest : rest < TUNING.sleepAtRest) {
    pawn.activity = "sleeping"
    pawn.task = "Sleeping"
  } else {
    pawn.activity = "working"
  }
}

const SUPPLY_KEY = { oxygen: "oxygenKg", water: "waterKg", food: "foodKg" } as const
const KG_PER_DAY = {
  oxygen: NASA_DATA.oxygenKgPerDay,
  water: NASA_DATA.waterKgPerDay,
  food: NASA_DATA.foodKgPerDay,
} as const

function updateBody(pawn: Pawn, mission: Mission, hours: number, log: Log) {
  const { colony } = mission
  const onEva = pawn.activity === "eva"
  const needs = pawn.needs

  // --- Rest
  if (pawn.activity === "sleeping") {
    needs.rest += TUNING.restRecoveryPerHour * traitMultiplier(pawn, (m) => m.restRecovery) * hours
  } else {
    needs.rest -= TUNING.restDecayPerHour * traitMultiplier(pawn, (m) => m.needDecay?.rest) * hours
  }
  needs.rest = clamp(needs.rest, 0, 100)

  // --- Oxygen, water, food: drain, then refill from colony supplies at real per-day rates.
  for (const need of ["oxygen", "water", "food"] as const) {
    const evaFactor = need === "oxygen" && onEva ? TUNING.evaOxygenMultiplier : 1
    const decay = TUNING.consumableDecayPerHour * traitMultiplier(pawn, (m) => m.needDecay?.[need]) * evaFactor
    needs[need] = clamp(needs[need] - decay * hours, 0, 100)

    if (needs[need] < TUNING.refillBelow[need]) {
      const key = SUPPLY_KEY[need]
      const kgWanted = ((100 - needs[need]) / 100) * KG_PER_DAY[need]
      const kg = Math.min(kgWanted, colony.supplies[key])
      colony.supplies[key] -= kg
      needs[need] = clamp(needs[need] + (kg / KG_PER_DAY[need]) * 100, 0, 100)
    }
  }

  // --- Radiation. Outside gets the full surface dose; the habitat blocks some of it.
  let dose = (NASA_DATA.surfaceDoseMsvPerDay / 24) * hours
  if (!onEva) dose *= 1 - colony.habitatShielding
  if (colony.weather.solarParticleEvent) dose *= TUNING.solarParticleEventMultiplier
  pawn.missionDoseMsv += dose
  pawn.careerDoseMsv += dose

  // --- Statuses caused by needs
  const derived: [StatusId, boolean][] = [
    ["hungry", needs.food > 0 && needs.food < 30],
    ["starving", needs.food <= 0],
    ["thirsty", needs.water > 0 && needs.water < 30],
    ["dehydrated", needs.water <= 0],
    ["hypoxic", needs.oxygen < 30],
    ["tired", needs.rest < 30],
    ["grounded", pawn.missionDoseMsv >= colony.evaDoseBudgetMsv],
  ]
  for (const [id, active] of derived) {
    if (active) {
      if (addStatus(pawn, id, mission.hour) && STATUSES[id].severity === "serious") {
        log("danger", `${pawn.name}: ${STATUSES[id].label}. ${STATUSES[id].fix}`, pawn.id)
      }
    } else {
      removeStatus(pawn, id)
    }
  }

  // Injuries heal on their own eventually (a medic is much faster).
  const injury = pawn.statuses.find((s) => s.id === "injured")
  if (injury && mission.hour - injury.sinceHour >= TUNING.injuryNaturalHealHours) {
    removeStatus(pawn, "injured")
    log("info", `${pawn.name}'s injury healed on its own.`, pawn.id)
  }

  // --- Morale drifts toward a target set by traits and current problems.
  const target =
    TUNING.moraleBaseline +
    traitSum(pawn, (m) => m.moraleBase) -
    pawn.statuses.reduce((acc, s) => acc + STATUSES[s.id].moralePenalty, 0) -
    (colony.weather.dustStorm ? TUNING.stormMoralePenalty : 0)
  const maxChange = TUNING.moraleChangePerHour * hours
  needs.morale = clamp(needs.morale + clamp(target - needs.morale, -maxChange, maxChange), 0, 100)

  if (needs.morale < TUNING.stressedBelowMorale && addStatus(pawn, "stressed", mission.hour)) {
    log("warning", `${pawn.name} is feeling stressed.`, pawn.id)
  } else if (needs.morale >= TUNING.stressRecoversAtMorale && hasStatus(pawn, "stressed")) {
    removeStatus(pawn, "stressed")
  }

  // --- Health
  const damage = pawn.statuses.reduce((acc, s) => acc + STATUSES[s.id].healthDamagePerHour, 0)
  if (damage > 0) pawn.health -= damage * hours
  else pawn.health += TUNING.healthRegenPerHour * traitMultiplier(pawn, (m) => m.healthRegen) * hours
  pawn.health = clamp(pawn.health, 0, 100)

  // --- Evacuation replaces death: the pawn is sent home and leaves the active crew.
  if (pawn.health <= 0) {
    const worst = pawn.statuses
      .filter((s) => STATUSES[s.id].healthDamagePerHour > 0)
      .sort((a, b) => STATUSES[b.id].healthDamagePerHour - STATUSES[a.id].healthDamagePerHour)[0]
    const reason = worst ? STATUSES[worst.id].label : "Poor health"
    pawn.evacuated = { hour: mission.hour, reason }
    pawn.activity = "idle"
    pawn.task = `Evacuated (${reason})`
    log("danger", `${pawn.name} had to be evacuated back to Earth (${reason}).`, pawn.id)
  }
}
