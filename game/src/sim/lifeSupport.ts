/*
 * How fast the crew use up the base's supplies, in the resource bar's units, and what the map
 * tells the crew rules about each astronaut. What that does to them (needs, health, radiation,
 * statuses, evacuation) is the crew system's job: see sim/crewLife.ts.
 */

/**
 * Oxygen one astronaut breathes in one game-hour, in the resource bar's units.
 * A game number to tune, not a real figure: with four astronauts the starting
 * 100 lasts about 250 game-hours (roughly 10 Mars days).
 * Water and food use the same rate for now (see SUPPLY_PER_ASTRONAUT_DAY in sim/crewLife.ts).
 */
export const OXYGEN_PER_ASTRONAUT_HOUR = 0.1
/**
 * How many times faster an astronaut uses oxygen when not in a pressurized module or tube (see
 * pressurizedCells in sim/navigation.ts), i.e. out on the surface on suit air. A game number to tune.
 */
export const UNPRESSURIZED_OXYGEN_FACTOR = 2

/** One astronaut at the base during a stretch of time, as the map sees them. */
export interface CrewMember {
  id: string
  /** Out on the surface (on EVA). */
  outside: boolean
  /** In a module or tube (see pressurizedCells in sim/navigation.ts). Leave out to count as pressurized. */
  pressurized?: boolean
  /** Working in a module: that module's station id. Leave out if not working. */
  workingAt?: string | null
  /** Chatting with this crewmate (by id). Leave out if not chatting. */
  chattingWith?: string | null
}
