import type { ResourceId } from "@/content/resources"

/*
 * The explore map: places around the base that astronauts can be sent to, and
 * what they might bring back. This is plain data on purpose: add a row to add a
 * place, or change what it gives, without touching the game code.
 *
 * These places are PLACEHOLDERS made up to get the explore map working. They
 * are not real spots near the landing site and their numbers are not real
 * figures; the team will replace them.
 *
 * `x` and `y` say where the place is on the explore map, from 0 to 100 across
 * and down. The base is in the middle, at 50, 50, and the further away a place
 * is, the longer the trip. `finds` lists what ONE astronaut brings back: a
 * random amount from `min` to `max` of each resource. Ice the crew dig up is
 * listed as water: it's melted into the base's water, not kept as ice.
 */
export interface ExplorePlace {
  id: string
  name: string
  x: number
  y: number
  /** Kid-friendly, plain language. Explain any science word in the same sentence. */
  text: string
  finds: { resource: ResourceId; min: number; max: number }[]
}

/** Where the base is on the explore map. */
export const EXPLORE_BASE = { x: 50, y: 50 }

/**
 * Exploring opens up in this era, the one where the Rover can be researched (see "rover" in
 * content/research.ts). Before it, Explore shows in the Actions dropdown but is locked.
 */
export const EXPLORE_UNLOCK_ERA = 2

/** Whether the crew can go exploring in this era. */
export const exploreUnlocked = (era: number) => era >= EXPLORE_UNLOCK_ERA

/**
 * How expeditions work, in numbers (sim/explore.ts uses them). PLACEHOLDERS for the team to tune.
 *
 * - Bigger groups: each astronaut packs food from the base for the trip (more people and longer
 *   trips cost more), and each can carry `carryPerAstronaut` back, so a bigger group brings more.
 * - Further places: a trip's "farness" goes from 0 (at `nearDistance` or closer) to 1 (at
 *   `farDistance` or beyond, in map units from the base). The further it is, the better the
 *   chance of each rare find below, and the more likely an event that hurts the crew.
 *
 * The rare finds are a secret on purpose: the explore map never names them. It only shows that
 * the further a place is, the better its finds (and better still from Era 3). Players see what
 * they found once the group is back.
 */
export const EXPLORE_RULES = {
  /** Food each astronaut packs, per game-hour of the trip (there and back). */
  foodPerAstronautHour: 0.5,
  /** How much one astronaut can carry back, all finds together (morale isn't carried). */
  carryPerAstronaut: 40,
  /** Map units from the base where "near" ends and "far" begins (see farness, above). */
  nearDistance: 20,
  farDistance: 45,
  /**
   * Rare finds: from `fromEra` on, each astronaut on the trip has a `chanceAtFar` chance (at a
   * farness of 1, less when nearer) of finding `min` to `max` of it.
   */
  rareFinds: [
    { resource: "titanium", fromEra: 1, chanceAtFar: 0.5, min: 2, max: 6 },
    { resource: "gold", fromEra: 1, chanceAtFar: 0.25, min: 1, max: 3 },
    // Sulfur turns up from the first exploring era, but less often than titanium.
    { resource: "sulfur", fromEra: 2, chanceAtFar: 0.2, min: 3, max: 8 },
    { resource: "uranium", fromEra: 3, chanceAtFar: 0.3, min: 1, max: 3 },
  ] satisfies { resource: ResourceId; fromEra: number; chanceAtFar: number; min: number; max: number }[],
  /** How many times as likely the events that hurt (content/exploreEvents.ts) are on the farthest trips. */
  injuryWeightAtFar: 4,
}

export const EXPLORE_PLACES: ExplorePlace[] = [
  {
    id: "ice-cliff",
    name: "Ice Cliff",
    x: 24,
    y: 20,
    text: "A steep cliff where a thick layer of ice shows under the red soil. The crew dig it out and melt it into water.",
    finds: [{ resource: "water", min: 15, max: 35 }],
  },
  {
    id: "lava-tube",
    name: "Lava Tube",
    x: 71,
    y: 27,
    text: "A long cave left behind by flowing lava. Its roof would block radiation, the invisible energy that can hurt your body.",
    finds: [
      { resource: "regolith", min: 10, max: 25 },
      { resource: "morale", min: 3, max: 8 },
    ],
  },
  {
    id: "dry-riverbed",
    name: "Dry Riverbed",
    x: 36,
    y: 71,
    text: "A winding channel that water cut into the ground a very long time ago. A little ice is still buried here, and melts into water.",
    finds: [
      { resource: "water", min: 5, max: 15 },
      { resource: "regolith", min: 5, max: 15 },
    ],
  },
  {
    id: "crater-rim",
    name: "Crater Rim",
    x: 83,
    y: 66,
    text: "The raised edge of a crater, a bowl blasted out by a rock from space. Loose rock is piled all around it.",
    finds: [{ resource: "regolith", min: 20, max: 40 }],
  },
  {
    id: "supply-drop",
    name: "Supply Drop",
    x: 61,
    y: 84,
    text: "A cargo pod sent ahead of the crew. It landed a long way off target.",
    finds: [
      { resource: "food", min: 8, max: 20 },
      { resource: "water", min: 8, max: 20 },
      { resource: "oxygen", min: 5, max: 15 },
    ],
  },
  {
    id: "dune-field",
    name: "Dune Field",
    x: 13,
    y: 55,
    text: "Rows of dark sand dunes, slowly pushed along by the wind.",
    finds: [
      { resource: "regolith", min: 5, max: 15 },
      { resource: "power", min: 30, max: 60 },
    ],
  },
]

export function explorePlace(id: string): ExplorePlace | undefined {
  return EXPLORE_PLACES.find((place) => place.id === id)
}
