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
 * random amount from `min` to `max` of each resource.
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

export const EXPLORE_PLACES: ExplorePlace[] = [
  {
    id: "ice-cliff",
    name: "Ice Cliff",
    x: 24,
    y: 20,
    text: "A steep cliff where a thick layer of ice shows under the red soil.",
    finds: [{ resource: "ice", min: 15, max: 35 }],
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
    text: "A winding channel that water cut into the ground a very long time ago.",
    finds: [
      { resource: "ice", min: 5, max: 15 },
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
      { resource: "power", min: 5, max: 12 },
    ],
  },
]

export function explorePlace(id: string): ExplorePlace | undefined {
  return EXPLORE_PLACES.find((place) => place.id === id)
}
