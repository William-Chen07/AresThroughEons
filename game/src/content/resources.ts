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
 * Ice and regolith are the two raw materials dug out of Mars. Ice isn't kept
 * as a resource of its own: ice the crew dig up is melted straight into water
 * (see content/explore.ts). Both are taken straight from NASA's overview of in-situ resource utilization (ISRU, using
 * what is already there instead of bringing it from Earth), which names "water
 * deposits based in lunar, Mars, and asteroid soil (also called regolith)" as
 * the source of water and oxygen, and "regolith-based in-space manufacturing and
 * construction" (3D printing with regolith) as how to build:
 * https://www.nasa.gov/overview-in-situ-resource-utilization/
 * The same page names a third raw resource, the carbon dioxide in Mars's air,
 * which the game doesn't have as a resource (yet).
 *
 * The five minerals after morale are mined from deposits on the base map (see
 * sim/deposits.ts), so like regolith they're carried in the backpack. Uranium,
 * last, is carried there too, but it has no deposits on the base map: it is only
 * found on long expeditions (see content/explore.ts).
 * Where they're placed follows real NASA data only loosely, and the text says
 * so: no spacecraft has mapped copper, gold or sulfur deposits on Mars.
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
    start: 0,
    color: 0xe0b040,
    what: "Electricity that runs the base.",
    why: "Everything that keeps a crew alive needs it: heat, lights, and the machines that make air and water. NASA's Mars missions get theirs from solar panels or nuclear power.",
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
  {
    id: "aluminum",
    name: "Aluminum",
    start: 0,
    color: 0xb8c4cc,
    mined: true,
    what: "A light, strong metal, mined from deposits in the middle of the map.",
    why: "On Mars, aluminum is locked up in minerals like feldspar, which NASA's Mars Global Surveyor mapped from orbit. Light metal is just right for building on a planet where everything has to be carried or made.",
  },
  {
    id: "copper",
    name: "Copper",
    start: 0,
    color: 0xd9824a,
    mined: true,
    what: "A metal that carries electricity, mined from deposits in the middle of the map.",
    why: "Wires and motors need copper. On Earth it collects where hot water once flowed through rock, and Mars had volcanoes and hot springs. No copper deposit has been found on Mars yet, so in this game it hides near slopes and crater rims.",
  },
  {
    id: "titanium",
    name: "Titanium",
    start: 0,
    color: 0x9fb7d9,
    mined: true,
    what: "A very strong, light metal that doesn't rust, mined far from the landing site.",
    why: "Titanium is found in a dark mineral called ilmenite, inside volcanic rock like the dark basalt that covers much of Mars. Spacecraft and rovers use it because it is strong but light.",
  },
  {
    id: "gold",
    name: "Gold",
    start: 0,
    color: 0xf2c94c,
    mined: true,
    what: "A rare metal that never rusts, mined far from the landing site.",
    why: "Spacecraft use gold in electronics, and astronauts' helmet visors have a thin layer of gold to block harsh sunlight. No gold has been found on Mars, so in this game it's rare and far away.",
  },
  {
    id: "sulfur",
    name: "Sulfur",
    start: 0,
    color: 0xe8e05a,
    mined: true,
    what: "A yellow element found almost anywhere on the map.",
    why: "Martian soil is full of sulfur. In 2024 NASA's Curiosity rover cracked open a rock by driving over it and found pure yellow sulfur crystals inside, a first on Mars.",
  },
  {
    // Not on the base map: only found on long expeditions, from Era 3 on (see content/explore.ts).
    id: "uranium",
    name: "Uranium",
    start: 0,
    color: 0x86efac,
    mined: true,
    what: "A heavy metal that gives off a little radiation, found only on long expeditions far from the base.",
    why: "A tiny amount of uranium can make power for years. NASA's Kilopower test reactor, called KRUSTY, made electricity from a uranium core in 2018, to power bases on the Moon and Mars. No uranium deposit has been found on Mars, so in this game it's rare and far away.",
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
 * and regolith; what a save had of it becomes its regolith. Ice is no longer a
 * resource: what a save had of it is melted into its water.
 */
export function upgradeResources(old: Record<string, number> | undefined): Resources {
  const resources = startingResources()
  if (!old) return resources
  if (typeof old.materials === "number") resources.regolith = old.materials
  for (const type of RESOURCE_TYPES) {
    if (typeof old[type.id] === "number") resources[type.id] = old[type.id]
  }
  if (typeof old.ice === "number") resources.water += old.ice
  return resources
}
