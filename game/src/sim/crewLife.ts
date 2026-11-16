import type { Resources } from "@/content/resources"
import { TUNING } from "./constants"
import { OCCUPATION_IDS } from "./occupations"
import { canGoOnEva, clamp, gainXp, hasStatus, injure, isActive, traitMultiplier, workSpeed } from "./pawn"
import type { UrgentNeed } from "./pathing"
import { OXYGEN_PER_ASTRONAUT_HOUR, SUIT_OXYGEN_FACTOR, type CrewMember } from "./lifeSupport"
import { createRng } from "./rng"
import { ROLES, treatNextPatient } from "./roles"
import { createCrew, createPawn, createRecruit } from "./spawn"
import { decideActivity, updateBody, updateFriction, type BodyEnv, type Consumable, type Log } from "./step"
import type { LogEntry, OccupationId, Pawn, RoleId } from "./types"

/*
 * The crew system running inside the real game. The base map (sim/pathing) owns where everyone
 * is and what they've been told to do; this owns everything about the astronauts themselves:
 * needs, radiation, statuses, morale, friction, skills, healing and evacuation.
 * Saves call liveCrewThrough as game time passes (see sim/saves.ts).
 */

/**
 * Supply one astronaut uses in a day, in the resource bar's units. Oxygen keeps the base map's
 * rate; water and food follow the same pattern. Game numbers to tune, not real figures (the real
 * NASA rates are in NASA_DATA and are used for the glossary).
 */
export const SUPPLY_PER_ASTRONAUT_DAY: Record<Consumable, number> = {
  oxygen: OXYGEN_PER_ASTRONAUT_HOUR * 24,
  water: OXYGEN_PER_ASTRONAUT_HOUR * 24,
  food: OXYGEN_PER_ASTRONAUT_HOUR * 24,
}

/** How many crew log lines a save keeps, oldest dropped first. */
export const CREW_LOG_LENGTH = 30

/** A brand-new crew for an era: one of each occupation, with ids unique to the era. */
export function newCrew(era: number, random: () => number = Math.random): Pawn[] {
  return createCrew(createRng(Math.floor(random() * 2 ** 31)), OCCUPATION_IDS, `era${era}-`)
}

/**
 * The crew that lands when era `era` begins: everyone from the era before comes back, healed on
 * Earth, and one new astronaut joins them, so the crew grows by one each era.
 *
 * A returning astronaut keeps who they are and what they learned: name, occupation, role, traits,
 * skills, standing orders and their career radiation. Everything about the last mission is
 * left behind: health and needs are full, statuses are gone, the mission's radiation starts
 * at zero and nobody is evacuated any more.
 *
 * The recruit is trained in whichever occupation the crew has fewest of (a random one of
 * those if several tie), with a name nobody on the crew has. Their id is `era{era}-0`, which no
 * one from an earlier era can have. Pure.
 */
export function returningCrew(previous: readonly Pawn[], era: number, random: () => number = Math.random): {
  crew: Pawn[]
  recruit: Pawn
} {
  const rng = createRng(Math.floor(random() * 2 ** 31))
  const veterans = previous.map((pawn): Pawn => {
    const fresh = createPawn(rng, pawn.occupation, pawn.name, pawn.id)
    return {
      ...fresh,
      role: pawn.role,
      color: pawn.color,
      traits: [...pawn.traits],
      skills: structuredClone(pawn.skills),
      careerDoseMsv: pawn.careerDoseMsv,
      orders: { ...pawn.orders },
      task: "Back on Mars",
    }
  })
  const count = (occupation: OccupationId) => veterans.filter((p) => p.occupation === occupation).length
  const fewest = Math.min(...OCCUPATION_IDS.map(count))
  const occupation = rng.pick(OCCUPATION_IDS.filter((o) => count(o) === fewest))
  const recruit = createRecruit(
    rng,
    occupation,
    `era${era}-0`,
    veterans.map((p) => p.name),
  )
  return { crew: [...veterans, recruit], recruit }
}

export interface LiveCrewInput {
  crew: readonly Pawn[]
  resources: Resources
  /** Game-hours that went by. */
  hours: number
  /** The expedition's clock at the start of those hours. */
  clock: number
  /** Astronauts on the base map, and what they were doing (from the map). */
  atBase: readonly CrewMember[]
  /** Ids of astronauts out exploring: off the map, on their own supplies, untouched by base weather. */
  away: readonly string[]
  /** A radiation storm at the base: how many of the hours it lasted, and the health it costs per hour outside. */
  storm: { hours: number; healthLostPerHourOutside: number; name: string } | null
  /** It is night at the base (see sim/dayNight.ts): the only time the crew sleep. Leave out for them to sleep whenever they're worn out. */
  night?: boolean
  random?: () => number
}

/**
 * What `hours` of game time do to the crew: needs drain and refill from the base's resources,
 * radiation adds up (much faster outside, and in a storm), statuses come and go, morale drifts,
 * crewmates who dislike who they're with get annoyed, the medic treats people, skills grow, and
 * anyone whose health runs out is evacuated. Pure: returns new crew and resources.
 */
export function liveCrewThrough(input: LiveCrewInput): {
  crew: Pawn[]
  resources: Resources
  log: LogEntry[]
  evacuated: string[]
} {
  const { hours, clock, storm } = input
  const random = input.random ?? Math.random
  const crew = structuredClone(input.crew) as Pawn[]
  const resources = { ...input.resources }
  const log: LogEntry[] = []
  const say: Log = (kind, text, pawnId) => log.push({ hour: clock, kind, text, pawnId })
  if (hours <= 0) return { crew, resources, log, evacuated: [] }

  const where = new Map(input.atBase.map((m) => [m.id, m]))
  const away = new Set(input.away)
  // Only crewmates the game knows the whereabouts of live through this time.
  const present = crew.filter((p) => isActive(p) && (where.has(p.id) || away.has(p.id)))

  // 1. What everyone is doing: asleep, or whatever the map says.
  for (const pawn of present) {
    decideActivity(pawn, input.night)
    if (pawn.activity === "sleeping") continue
    const spot = where.get(pawn.id)
    if (!spot) {
      pawn.activity = "eva"
      pawn.task = "Out exploring"
    } else if (spot.workingAt) {
      pawn.activity = "working"
      // Deposits are mined out on the surface (see sim/deposits.ts); everything else is a module.
      pawn.task = spot.workingAt.startsWith("deposit:") ? "Mining a deposit" : `${ROLES[pawn.role].name} in a module`
    } else if (spot.outside) {
      pawn.activity = "eva"
      pawn.task = "Outside on the surface"
    } else {
      pawn.activity = "idle"
      const friend = spot.chattingWith ? crew.find((p) => p.id === spot.chattingWith) : undefined
      pawn.task = friend ? `Chatting with ${friend.name}` : "Taking a break"
    }
  }

  // 2. The healer treats whoever needs it most, while awake and inside the base.
  const atBaseCrew = present.filter((p) => where.has(p.id))
  for (const pawn of atBaseCrew) {
    if (pawn.role !== "healing" || pawn.activity === "sleeping" || pawn.activity === "eva") continue
    const result = treatNextPatient(pawn, atBaseCrew, workSpeed(pawn, "healing"), hours, (kind, text) =>
      say(kind, text, pawn.id),
    )
    if (result.activity === "working") {
      pawn.activity = "working"
      pawn.task = result.task
    }
  }

  // 3. Skills grow with practice: the assigned role while working, Scouting while out exploring.
  for (const pawn of present) {
    const practised: RoleId | null =
      pawn.activity === "working" ? pawn.role : pawn.activity === "eva" && away.has(pawn.id) ? "scouting" : null
    if (practised && gainXp(pawn, practised, hours)) {
      const level = pawn.skills[practised].level
      say("good", `${pawn.name} got better at ${ROLES[practised].name} (skill ${level}).`, pawn.id)
    }
  }

  // 4. Friction: chatting together, or working in the same module.
  const together = (a: Pawn, b: Pawn) => {
    const sa = where.get(a.id)
    const sb = where.get(b.id)
    if (!sa || !sb || a.activity === "sleeping" || b.activity === "sleeping") return false
    return sa.chattingWith === b.id || sb.chattingWith === a.id || (!!sa.workingAt && sa.workingAt === sb.workingAt)
  }
  updateFriction(atBaseCrew, together, clock, say)

  // 5. Bodies: needs, radiation, statuses, morale, health, evacuation.
  const supplies = { oxygen: resources.oxygen, water: resources.water, food: resources.food }
  const stormShare = storm ? clamp(storm.hours / hours, 0, 1) : 0
  for (const pawn of present) {
    const spot = where.get(pawn.id)
    const isAway = !spot
    const outside = isAway || spot.outside
    const inStorm = !isAway && stormShare > 0
    // Accidents happen while awake at the base: often out on the rocks, less often inside. Traits
    // make them more or less likely (a Clumsy crewmate slips far more than a Tough one), and getting
    // hurt costs health at once.
    if (spot && pawn.activity !== "sleeping") {
      const where = spot.outside ? 1 : TUNING.indoorInjuryFactor
      const chance = TUNING.injuryChancePerHour * where * traitMultiplier(pawn, (m) => m.injuryChance) * hours
      if (random() < chance && injure(pawn, clock)) {
        const clumsy = pawn.traits.includes("clumsy") ? "Being clumsy, " : ""
        const how = spot.outside ? "slipped on the rocks" : "tripped inside the base"
        say(
          "warning",
          `${clumsy}${pawn.name} ${how} and got hurt (−${TUNING.injuryHealthLoss} health).`,
          pawn.id,
        )
      }
    }
    const env: BodyEnv = {
      hour: clock,
      supplies,
      supplyPerDay: SUPPLY_PER_ASTRONAUT_DAY,
      oxygenFactor: SUIT_OXYGEN_FACTOR,
      // Each astronaut has their own tank: it runs down outside and is filled up in any module or tube.
      suitAir: spot && spot.pressurized === false ? "drain" : "refill",
      outside,
      suppliesCarried: isAway,
      shielding: TUNING.habitatShielding,
      doseBudgetMsv: TUNING.evaDoseBudgetMsv,
      solarStorm: inStorm,
      dustStorm: false,
      hazard:
        inStorm && outside && storm
          ? { healthPerHour: storm.healthLostPerHourOutside * stormShare, label: storm.name }
          : null,
    }
    updateBody(pawn, env, hours, say)
  }
  resources.oxygen = supplies.oxygen
  resources.water = supplies.water
  resources.food = supplies.food
  const morale = crewMorale(crew)
  if (morale !== null) resources.morale = morale

  const evacuated = present.filter((p) => p.evacuated).map((p) => p.id)
  return { crew, resources, log, evacuated }
}

/** Average morale of the crew still on the expedition, or null if nobody is left. */
export function crewMorale(crew: readonly Pawn[]): number | null {
  const active = crew.filter(isActive)
  if (active.length === 0) return null
  return Math.round(active.reduce((sum, p) => sum + p.needs.morale, 0) / active.length)
}

/**
 * Something on an exploring trip hurt these crewmates: they lose health (never below 1, so
 * nobody is evacuated from out in the field) and are injured until treated or healed. Pure.
 */
export function hurtOnTrip(
  crew: readonly Pawn[],
  ids: readonly string[],
  amount: number,
  clock: number,
): { crew: Pawn[]; log: LogEntry[] } {
  const next = structuredClone(crew) as Pawn[]
  const log: LogEntry[] = []
  for (const pawn of next) {
    if (!ids.includes(pawn.id) || !isActive(pawn)) continue
    if (injure(pawn, clock, amount)) {
      log.push({ hour: clock, kind: "warning", text: `${pawn.name} got hurt while exploring (−${amount} health).`, pawnId: pawn.id })
    } else {
      pawn.health = Math.max(1, pawn.health - amount)
    }
  }
  return { crew: next, log }
}

/** Morale found on a trip (in the resource bar's units) cheers up the whole crew. Pure. */
export function cheerUp(crew: readonly Pawn[], amount: number): Pawn[] {
  const next = structuredClone(crew) as Pawn[]
  for (const pawn of next) if (isActive(pawn)) pawn.needs.morale = clamp(pawn.needs.morale + amount, 0, 100)
  return next
}

/** How much faster a Researcher (by occupation) moves research on than anyone else. */
export const RESEARCHER_SPEED = 1.5

/**
 * How much research one astronaut in a Research Lab does, compared with an ordinary crewmate:
 * a trained Researcher does RESEARCHER_SPEED as much, and nobody researches in their sleep.
 */
export function researchRate(pawn: Pawn | undefined): number {
  if (!pawn || pawn.activity === "sleeping") return pawn ? 0 : 1
  return pawn.occupation === "researcher" ? RESEARCHER_SPEED : 1
}

/** Why this crewmate can't go out exploring right now, or null if they can. */
export function cannotExplore(pawn: Pawn | undefined): string | null {
  if (!pawn) return "Unknown crewmate"
  if (pawn.evacuated) return "Evacuated"
  if (pawn.activity === "sleeping") return "Sleeping"
  return canGoOnEva(pawn) ? null : "Must stay inside"
}

/**
 * The most urgent thing a crewmate on the map needs to drop their orders for, or null.
 * `storm`: a radiation storm is on. `canFix(need)`: something on the map provides it.
 */
export function urgentNeedOf(
  pawn: Pawn | undefined,
  storm: boolean,
  canFix: (need: Exclude<UrgentNeed, "shelter">) => boolean,
): UrgentNeed | null {
  if (!pawn || pawn.evacuated) return null
  if (hasStatus(pawn, "hypoxic") && canFix("oxygen")) return "oxygen"
  // Asleep: off to bed in a Habitat and stay there, not moving, until they wake up. Beds are
  // indoors, so that's sheltered too.
  const asleep = pawn.activity === "sleeping"
  if (asleep && canFix("rest")) return "rest"
  // Storms, injuries, low oxygen and the radiation limit all mean: get (and stay) inside. So does
  // sleeping when there's no Habitat to sleep in.
  if (storm || !canGoOnEva(pawn) || asleep) return "shelter"
  return null
}
