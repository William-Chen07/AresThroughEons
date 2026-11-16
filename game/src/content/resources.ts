/*
 * The base's resources. This is plain data on purpose: add a row to add a
 * resource, or change a starting amount or colour, without touching the game code.
 *
 * `start` is how much a new expedition lands with. `mined` marks the raw
 * materials the crew dig out of Mars: those are carried in the backpack
 * (bottom right of the map), the rest are shown in the resource bar along the
 * top. `color` is the swatch shown beside the resource. `what` (what it is) and `why` (why it
 * matters on a NASA mission to Mars) are shown when the pointer rests on the
 * resource: kid-friendly, plain words, a science word explained where it is used.
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
  {
    id: "oxygen",
    mined: false,
    name: "Oxygen",
    start: 100,
    color: 0x7fd4ff,
    what: "The gas people need to breathe.",
    why: "The air on Mars is almost all carbon dioxide, so a crew has to bring oxygen or make it. NASA's MOXIE experiment made oxygen from Mars air for the first time.",
  },
  {
    id: "water",
    mined: false,
    name: "Water",
    start: 100,
    color: 0x4f9fd9,
    what: "Clean water for drinking, washing and growing plants.",
    why: "Water is heavy, so rockets can't carry enough for a whole mission. On the space station NASA recycles 98% of it, and a Mars crew would do the same.",
  },
  {
    id: "food",
    mined: false,
    name: "Food",
    start: 100,
    color: 0x62b56c,
    what: "Meals for the crew.",
    why: "Mars is months away from the nearest supply ship. NASA grows plants on the space station to learn how astronauts can farm fresh food far from Earth.",
  },
  {
    id: "power",
    mined: false,
    name: "Power",
    start: 100,
    color: 0xe0b040,
    what: "Electricity that runs the base.",
    why: "Everything that keeps a crew alive needs it: heat, lights, and the machines that make air and water. NASA's Mars missions get theirs from solar panels or nuclear power.",
  },
  {
    id: "ice",
    mined: true,
    name: "Ice",
    start: 100,
    color: 0xe6f2f8,
    what: "Frozen water dug out of the ground on Mars.",
    why: "NASA plans for crews to use what Mars already has. Ice can be melted into drinking water, and turned into oxygen and rocket fuel.",
  },
  {
    id: "regolith",
    mined: true,
    name: "Regolith",
    start: 100,
    color: 0xc8744a,
    what: "The loose soil and rock that covers Mars.",
    why: "Building supplies are too heavy to ship from Earth. NASA is testing 3D printers that build with regolith, so a base can be made from the ground it stands on.",
  },
  {
    id: "morale",
    mined: false,
    name: "Morale",
    start: 100,
    color: 0xd98ad9,
    what: "How the crew is feeling.",
    why: "A Mars crew lives in a small space, far from home, for a very long time. NASA studies this because a team that feels good works better and makes fewer mistakes.",
  },
] as const

export type ResourceType = (typeof RESOURCE_TYPES)[number]
/** The base's supplies, shown in the resource bar along the top. */
export const BASE_RESOURCES = RESOURCE_TYPES.filter((type) => !type.mined)
/** The raw materials dug out of Mars, carried in the backpack. */
export const MINED_RESOURCES = RESOURCE_TYPES.filter((type) => type.mined)
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
