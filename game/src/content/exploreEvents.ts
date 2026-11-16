import type { ResourceId } from "@/content/resources"

/*
 * Things that can happen to a group of astronauts on the way to a place on the
 * explore map, or on the way back. This is plain data on purpose: add a row to
 * add an event, or change what it does, without touching the game code.
 *
 * These events are PLACEHOLDERS made up to get the system working, and their
 * numbers are not real figures; the team will replace them.
 *
 * `weight` is how likely the event is next to the others: one with weight 2
 * comes up twice as often as one with weight 1. `effect` is what it does; an
 * event can have any mix of these:
 * - `waitHours`: the group is stopped for this many game-hours.
 * - `findsFactor`: what they bring back from the place is multiplied by this
 *   (1.5 is half as much again, 0.6 is a bit over half).
 * - `bonus`: something extra the whole group brings back, a random amount from `min` to `max`.
 * - `healthLost`: health each astronaut in the group loses, and they come back Injured. It never
 *   takes anyone below 1, so a trip can't evacuate someone who isn't at the base. Events like
 *   this get more likely the further the trip goes (injuryWeightAtFar in content/explore.ts).
 */
export interface ExploreEventEffect {
  waitHours?: number
  findsFactor?: number
  bonus?: { resource: ResourceId; min: number; max: number }
  healthLost?: number
}

export interface ExploreEvent {
  id: string
  name: string
  /** Kid-friendly, plain language. Explain any science word in the same sentence. */
  text: string
  weight: number
  effect: ExploreEventEffect
}

/** The chance that an event happens at each of a trip's event points. */
export const EVENT_CHANCE = 0.5
/** How many event points a trip has, so the most events one trip can meet. */
export const EVENT_POINTS = 2

export const EXPLORE_EVENTS: ExploreEvent[] = [
  {
    id: "stuck-in-sand",
    name: "Stuck in sand",
    text: "The rover's wheels sank into soft sand. It took hours of careful digging to get it out.",
    weight: 2,
    effect: { waitHours: 3 },
  },
  {
    id: "dust-devil",
    name: "Dust devil",
    text: "A dust devil, a spinning tower of dusty wind, blew right over the rover and swept its solar panels clean.",
    weight: 2,
    effect: { bonus: { resource: "power", min: 5, max: 12 } },
  },
  {
    id: "meteorite",
    name: "Meteorite",
    text: "The crew spotted a meteorite, a rock that fell from space, lying on the ground, and loaded it up.",
    weight: 1,
    effect: { bonus: { resource: "regolith", min: 8, max: 18 } },
  },
  {
    id: "rich-find",
    name: "Lucky find",
    text: "The crew found much more than they expected and filled every container they had.",
    weight: 2,
    effect: { findsFactor: 1.5 },
  },
  {
    id: "cracked-container",
    name: "Cracked container",
    text: "A storage container cracked open on the bumpy ride and some of the load was lost.",
    weight: 2,
    effect: { findsFactor: 0.6 },
  },
  {
    id: "sharp-rocks",
    name: "Sharp rocks",
    text: "The path crossed a field of sharp rocks. Climbing over them left everyone bruised and worn out.",
    weight: 1,
    effect: { healthLost: 10 },
  },
  {
    id: "bad-fall",
    name: "Bad fall",
    text: "The ground on a steep, crumbly slope gave way, and the whole crew slid and tumbled down it. Everyone got bumps and bruises.",
    weight: 1,
    effect: { healthLost: 15, waitHours: 1 },
  },
  {
    id: "blue-sunset",
    name: "Blue sunset",
    text: "The crew stopped to watch the Sun go down. On Mars the sky around the setting Sun glows blue.",
    weight: 1,
    effect: { waitHours: 1, bonus: { resource: "morale", min: 4, max: 8 } },
  },
]

export function exploreEvent(id: string): ExploreEvent | undefined {
  return EXPLORE_EVENTS.find((event) => event.id === id)
}
