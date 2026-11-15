import type { Resources } from "@/content/resources"

/*
 * What the crew uses up as game time passes, and what that and the weather do
 * to them, as pure logic. For now the only need is oxygen; water and food can
 * follow the same pattern.
 */

/**
 * Oxygen one astronaut breathes in one game-hour, in the resource bar's units.
 * A game number to tune, not a real figure: with three astronauts the starting
 * 100 lasts about 330 game-hours (roughly 13 Mars days, or 37 minutes of play).
 */
export const OXYGEN_PER_ASTRONAUT_HOUR = 0.1

export const FULL_HEALTH = 100
/**
 * Health an astronaut loses in each game-hour the base has no oxygen. A game number to tune:
 * at 10, full health is gone after 10 game-hours without oxygen (about a minute of play).
 */
export const HEALTH_LOST_PER_HOUR_WITHOUT_OXYGEN = 10

/** Each astronaut's health, 0 to FULL_HEALTH, by astronaut id. One who isn't listed is at full health. */
export type CrewHealth = Record<string, number>

export function healthOf(health: CrewHealth, astronautId: string) {
  return health[astronautId] ?? FULL_HEALTH
}

/**
 * The astronauts among `crew` whose health has run out. They are evacuated: flown back to
 * Earth to get well, and out of the expedition for good.
 */
export function needEvacuating(health: CrewHealth, crew: readonly CrewMember[]): string[] {
  return crew.filter(({ id }) => healthOf(health, id) <= 0).map(({ id }) => id)
}

/** One astronaut during a stretch of time: who they are and whether they were out on the surface. */
export interface CrewMember {
  id: string
  outside: boolean
}

/**
 * What `hours` game-hours do to a base with these astronauts in it: they breathe the oxygen
 * down, and for any part of that time the oxygen has run out, each of them loses health.
 * `storm` is the weather during that time, if there was any: for `hours` of it, anyone outside
 * loses `healthLostPerHour`. Oxygen and health both stop at zero (see needEvacuating for what
 * happens then). Nothing brings health back up yet.
 */
export function liveThrough(
  resources: Resources,
  health: CrewHealth,
  crew: readonly CrewMember[],
  hours: number,
  storm: { hours: number; healthLostPerHour: number } | null = null,
): { resources: Resources; health: CrewHealth } {
  const needed = OXYGEN_PER_ASTRONAUT_HOUR * crew.length * hours
  if (needed <= 0) return { resources, health }
  const breathed = Math.min(resources.oxygen, needed)
  // The share of the time there was nothing left to breathe.
  const hoursWithout = hours * (1 - breathed / needed)
  const nextHealth = { ...health }
  for (const { id, outside } of crew) {
    const lost =
      HEALTH_LOST_PER_HOUR_WITHOUT_OXYGEN * hoursWithout + (storm && outside ? storm.healthLostPerHour * storm.hours : 0)
    if (lost > 0) nextHealth[id] = Math.max(0, healthOf(health, id) - lost)
  }
  return { resources: { ...resources, oxygen: resources.oxygen - breathed }, health: nextHealth }
}
