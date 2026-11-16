import { NASA_DATA, TUNING } from "./constants"
import {
  addStatus,
  areTogether,
  clamp,
  dislikesCrewmate,
  gainXp,
  hasStatus,
  isActive,
  isTrainedFor,
  removeStatus,
  traitMultiplier,
  traitSum,
  workSpeed,
} from "./pawn"
import { createRng } from "./rng"
import { ROLES } from "./roles"
import { STATUSES } from "./statuses"
import type { LogEntry, Mission, Pawn, RoleId, StatusId } from "./types"

const MAX_LOG = 100

export type Log = (kind: LogEntry["kind"], text: string, pawnId?: string) => void

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
    if (result.activity !== "idle" && gainXp(pawn, pawn.role, hours)) {
      const skill = pawn.skills[pawn.role].level
      log("good", `${pawn.name} got better at ${ROLES[pawn.role].name} (skill ${skill}).`, pawn.id)
    }
  }
  updateFriction(crew, areTogether, mission.hour, log)
  const { colony } = mission
  // The sandbox colony keeps supplies in real kilograms, used at NASA's per-day rates.
  const supplies = { oxygen: colony.supplies.oxygenKg, water: colony.supplies.waterKg, food: colony.supplies.foodKg }
  for (const pawn of crew) {
    const onEva = pawn.activity === "eva"
    const env: BodyEnv = {
      hour: mission.hour,
      supplies,
      supplyPerDay: KG_PER_DAY,
      oxygenFactor: onEva ? TUNING.evaOxygenMultiplier : 1,
      outside: onEva,
      suppliesCarried: false,
      shielding: colony.habitatShielding,
      doseBudgetMsv: colony.evaDoseBudgetMsv,
      solarStorm: colony.weather.solarParticleEvent,
      dustStorm: colony.weather.dustStorm,
      hazard: null,
    }
    updateBody(pawn, env, hours, log)
  }
  colony.supplies = { oxygenKg: supplies.oxygen, waterKg: supplies.water, foodKg: supplies.food }

  mission.hour += hours
  mission.rngState = rng.state
  if (mission.log.length > MAX_LOG) mission.log = mission.log.slice(-MAX_LOG)
  return mission
}

/**
 * Give a crewmate a new task. Their occupation never changes; only matching
 * roles get the occupation bonus. Pure: returns a new Mission.
 */
export function assignRole(prev: Mission, pawnId: string, role: RoleId): Mission {
  const result = assignCrewRole(prev.crew, pawnId, role, prev.hour)
  if (!result) return prev
  return { ...prev, crew: result.crew, log: [...prev.log, result.entry] }
}

/**
 * The crew with one crewmate's role changed, and a log line saying so; null if nothing changes
 * (unknown or evacuated crewmate, or the same role). Pure.
 */
export function assignCrewRole(
  crew: Pawn[],
  pawnId: string,
  role: RoleId,
  hour: number,
): { crew: Pawn[]; entry: LogEntry } | null {
  const pawn = crew.find((p) => p.id === pawnId)
  if (!pawn || pawn.evacuated || pawn.role === role) return null
  const next = structuredClone(crew)
  const target = next.find((p) => p.id === pawnId)!
  target.role = role
  target.task = `Switching to ${ROLES[role].name}`
  const note = isTrainedFor(target) ? " (trained for it!)" : ""
  return { crew: next, entry: { hour, kind: "info", text: `${target.name} is now ${ROLES[role].name}${note}.`, pawnId } }
}

export function advanceMission(mission: Mission, hours: number): Mission {
  let m = mission
  for (let h = 0; h < hours; h++) m = stepMission(m, 1)
  return m
}

/**
 * A crewmate who spent this hour with someone they dislike gets "Not Getting Along".
 * One-way: only the one doing the disliking is affected. `together` says who spent the hour
 * together (sandbox: areTogether; real game: chatting or working in the same module).
 */
export function updateFriction(crew: Pawn[], together: (a: Pawn, b: Pawn) => boolean, hour: number, log: Log) {
  for (const pawn of crew) {
    const annoyedBy = crew.find((other) => other !== pawn && together(pawn, other) && dislikesCrewmate(pawn, other))
    if (!annoyedBy) {
      removeStatus(pawn, "friction")
    } else if (addStatus(pawn, "friction", hour)) {
      // Log only when it starts, not every hour it continues.
      log("warning", `${pawn.name} is annoyed by ${annoyedBy.name}.`, pawn.id)
    }
  }
}

/**
 * Sleep when rest runs low, keep sleeping until rested; otherwise ready to work.
 * With `night` given (the base map's day and night, see sim/dayNight.ts) sleep only happens at
 * night: once it is dark everyone who isn't fully rested goes to bed, and they're up again when
 * they're rested or the sun rises, whichever comes first. Nobody falls asleep in the daytime.
 */
export function decideActivity(pawn: Pawn, night?: boolean) {
  const rest = pawn.needs.rest
  const sleepy =
    night === undefined
      ? pawn.activity === "sleeping"
        ? rest < TUNING.wakeAtRest
        : rest < TUNING.sleepAtRest
      : night && rest < TUNING.wakeAtRest
  if (sleepy) {
    pawn.activity = "sleeping"
    pawn.task = "Sleeping"
  } else {
    pawn.activity = "working"
  }
}

export type Consumable = "oxygen" | "water" | "food"

const KG_PER_DAY: Record<Consumable, number> = {
  oxygen: NASA_DATA.oxygenKgPerDay,
  water: NASA_DATA.waterKgPerDay,
  food: NASA_DATA.foodKgPerDay,
}

/** Everything around a crewmate that their body reacts to for one stretch of time. */
export interface BodyEnv {
  /** Time on the clock, for when statuses start. */
  hour: number
  /** Base supplies needs are refilled from, drawn down as they're used (mutated). Any unit. */
  supplies: Record<Consumable, number>
  /** Supply one astronaut uses in a day, in the same unit: refilling 100 points of a need costs this. */
  supplyPerDay: Record<Consumable, number>
  /** Multiplies how fast oxygen is used, e.g. on suit air outside. */
  oxygenFactor: number
  /** Multiplies how fast water is used, e.g. in a solar storm. Leave out for the normal rate. */
  waterFactor?: number
  /**
   * Oxygen is each astronaut's own suit tank, not a share of the base's supply: "refill" fills
   * the tank at once (they're in a building), "drain" uses it up with nothing to refill it
   * (they're outside). Leave out for oxygen to be drawn from `supplies`, like water and food.
   */
  suitAir?: "refill" | "drain"
  /** Out on the surface: the full radiation dose. Inside, the habitat blocks `shielding` of it. */
  outside: boolean
  /** Away from the base with their own supplies (e.g. exploring): oxygen, water, food don't drain. */
  suppliesCarried: boolean
  /** Fraction (0-1) of radiation the habitat blocks. */
  shielding: number
  /** Mission dose (mSv) at which a crewmate is no longer allowed outside. */
  doseBudgetMsv: number
  /** A solar particle event (the game's radiation storm) is going on. */
  solarStorm: boolean
  dustStorm: boolean
  /** Health lost per hour from something outside the body (the game's radiation storm, while outside). */
  hazard: { healthPerHour: number; label: string } | null
}

/** Needs, radiation, statuses, morale, health and evacuation for one crewmate over `hours`. */
export function updateBody(pawn: Pawn, env: BodyEnv, hours: number, log: Log) {
  const needs = pawn.needs

  // --- Rest
  if (pawn.activity === "sleeping") {
    needs.rest += TUNING.restRecoveryPerHour * traitMultiplier(pawn, (m) => m.restRecovery) * hours
  } else {
    needs.rest -= TUNING.restDecayPerHour * traitMultiplier(pawn, (m) => m.needDecay?.rest) * hours
  }
  needs.rest = clamp(needs.rest, 0, 100)

  // --- Oxygen, water, food: drain, then refill from the supplies.
  if (!env.suppliesCarried) {
    for (const need of ["oxygen", "water", "food"] as const) {
      if (need === "oxygen" && env.suitAir === "refill") {
        needs.oxygen = 100
        continue
      }
      const factor = need === "oxygen" ? env.oxygenFactor : need === "water" ? (env.waterFactor ?? 1) : 1
      const decay = TUNING.consumableDecayPerHour * traitMultiplier(pawn, (m) => m.needDecay?.[need]) * factor
      needs[need] = clamp(needs[need] - decay * hours, 0, 100)

      if (need === "oxygen" && env.suitAir === "drain") continue
      if (needs[need] < TUNING.refillBelow[need]) {
        const perDay = env.supplyPerDay[need]
        const wanted = ((100 - needs[need]) / 100) * perDay
        const taken = Math.min(wanted, Math.max(0, env.supplies[need]))
        env.supplies[need] -= taken
        needs[need] = clamp(needs[need] + (taken / perDay) * 100, 0, 100)
      }
    }
  }

  // --- Radiation. Outside gets the full surface dose; the habitat blocks some of it.
  let dose = (NASA_DATA.surfaceDoseMsvPerDay / 24) * hours
  if (!env.outside) dose *= 1 - env.shielding
  if (env.solarStorm) dose *= TUNING.solarParticleEventMultiplier
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
    ["grounded", pawn.missionDoseMsv >= env.doseBudgetMsv],
  ]
  for (const [id, active] of derived) {
    if (active) {
      if (addStatus(pawn, id, env.hour) && STATUSES[id].severity === "serious") {
        log("danger", `${pawn.name}: ${STATUSES[id].label}. ${STATUSES[id].fix}`, pawn.id)
      }
    } else {
      removeStatus(pawn, id)
    }
  }

  // Injuries heal on their own eventually (a medic is much faster).
  const injury = pawn.statuses.find((s) => s.id === "injured")
  if (injury && env.hour - injury.sinceHour >= TUNING.injuryNaturalHealHours) {
    removeStatus(pawn, "injured")
    log("info", `${pawn.name}'s injury healed on its own.`, pawn.id)
  }

  // --- Morale drifts toward a target set by traits and current problems.
  const target =
    TUNING.moraleBaseline +
    traitSum(pawn, (m) => m.moraleBase) -
    pawn.statuses.reduce((acc, s) => acc + STATUSES[s.id].moralePenalty, 0) -
    (env.dustStorm || env.solarStorm ? TUNING.stormMoralePenalty : 0)
  const maxChange = TUNING.moraleChangePerHour * hours
  needs.morale = clamp(needs.morale + clamp(target - needs.morale, -maxChange, maxChange), 0, 100)

  if (needs.morale < TUNING.stressedBelowMorale && addStatus(pawn, "stressed", env.hour)) {
    log("warning", `${pawn.name} is feeling stressed.`, pawn.id)
  } else if (needs.morale >= TUNING.stressRecoversAtMorale && hasStatus(pawn, "stressed")) {
    removeStatus(pawn, "stressed")
  }

  // --- Health
  const statusDamage = pawn.statuses.reduce((acc, s) => acc + STATUSES[s.id].healthDamagePerHour, 0)
  const damage = statusDamage + (env.hazard?.healthPerHour ?? 0)
  if (damage > 0) pawn.health -= damage * hours
  else pawn.health += TUNING.healthRegenPerHour * traitMultiplier(pawn, (m) => m.healthRegen) * hours
  pawn.health = clamp(pawn.health, 0, 100)

  // --- Evacuation replaces death: the pawn is sent home and leaves the active crew.
  if (pawn.health <= 0) {
    const worst = pawn.statuses
      .filter((s) => STATUSES[s.id].healthDamagePerHour > 0)
      .sort((a, b) => STATUSES[b.id].healthDamagePerHour - STATUSES[a.id].healthDamagePerHour)[0]
    const worstDamage = worst ? STATUSES[worst.id].healthDamagePerHour : 0
    const reason =
      env.hazard && env.hazard.healthPerHour >= worstDamage
        ? env.hazard.label
        : worst
          ? STATUSES[worst.id].label
          : "Poor health"
    pawn.evacuated = { hour: env.hour, reason }
    pawn.activity = "idle"
    pawn.task = `Evacuated (${reason})`
    log("danger", `${pawn.name} had to be evacuated back to Earth (${reason}).`, pawn.id)
  }
}
