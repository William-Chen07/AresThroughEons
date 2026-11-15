/*
 * The base's resources. This is plain data on purpose: add a row to add a
 * resource, or change a starting amount or colour, without touching the game code.
 *
 * `start` is how much a new expedition lands with. `color` is the swatch shown
 * beside the name in the resource bar. `about` is a plain-words line shown when
 * the pointer rests on the resource.
 *
 * Ice and regolith are the two raw materials dug out of Mars. They are taken
 * straight from NASA's overview of in-situ resource utilization (ISRU, using
 * what is already there instead of bringing it from Earth), which names "water
 * deposits based in lunar, Mars, and asteroid soil (also called regolith)" as
 * the source of water and oxygen, and "regolith-based in-space manufacturing and
 * construction" (3D printing with regolith) as how to build:
 * https://www.nasa.gov/overview-in-situ-resource-utilization/
 * The same page names a third raw resource, the carbon dioxide in Mars's air,
 * which the game doesn't have as a resource (yet).
 */
export const RESOURCE_TYPES = [
  { id: "oxygen", name: "Oxygen", start: 100, color: 0x7fd4ff, about: "Air for the crew to breathe." },
  { id: "water", name: "Water", start: 100, color: 0x4f9fd9, about: "For drinking, washing and growing plants." },
  { id: "food", name: "Food", start: 100, color: 0x62b56c, about: "Meals for the crew." },
  { id: "power", name: "Power", start: 100, color: 0xe0b040, about: "Electricity that runs the base." },
  {
    id: "ice",
    name: "Ice",
    start: 100,
    color: 0xe6f2f8,
    about: "Frozen water dug out of the ground on Mars. It can be melted into water.",
  },
  {
    id: "regolith",
    name: "Regolith",
    start: 100,
    color: 0xc8744a,
    about: "The loose soil and rock that covers Mars. It is what the base is built from.",
  },
  { id: "morale", name: "Morale", start: 100, color: 0xd98ad9, about: "How the crew is feeling." },
] as const

export type ResourceType = (typeof RESOURCE_TYPES)[number]
export type ResourceId = ResourceType["id"]
/** How much of each resource a base has. */
export type Resources = Record<ResourceId, number>

/** What a new expedition lands with. */
export function startingResources(): Resources {
  return Object.fromEntries(RESOURCE_TYPES.map((type) => [type.id, type.start])) as Resources
}

/**
 * The resources of a save made by any earlier version of the game: amounts it
 * already has are kept, a resource it doesn't have yet gets its starting amount,
 * and ones the game no longer has are dropped. "Materials" was split into ice
 * and regolith; what a save had of it becomes its regolith.
 */
export function upgradeResources(old: Record<string, number> | undefined): Resources {
  const resources = startingResources()
  if (!old) return resources
  if (typeof old.materials === "number") resources.regolith = old.materials
  for (const type of RESOURCE_TYPES) {
    if (typeof old[type.id] === "number") resources[type.id] = old[type.id]
  }
  return resources
}
