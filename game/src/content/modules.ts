/*
 * The kinds of base module. This is plain data on purpose: add a row to add a
 * module, or change a size or colour, without touching the game code.
 *
 * `width` and `height` are in map cells. `code` is the short label drawn on
 * the module's roof. `color` is the roof colour. `description` is shown in the Build bar.
 * Some modules need a research project first (see MODULE_RESEARCH). Tubes are free.
 * `cost` is what building one takes. The amounts are placeholders: building doesn't use
 * resources yet. The one that is real is `power`: it is what the module uses each game-hour to
 * run (see MODULE_POWER_PER_HOUR in sim/power.ts), and the Build bar shows it as "per hour".
 */
import type { ResourceId } from "@/content/resources"

export type BuildCost = Partial<Record<ResourceId, number>>

export const MODULE_TYPES = [
  // Unlocked from the start (tubes are too, in the Build bar).
  { id: "habitat", name: "Habitat", code: "HAB", width: 3, height: 3, color: 0xd8d4cc,
    description: "Home for the crew: somewhere to sleep, eat and shelter from radiation storms.",
    cost: { regolith: 40, power: 10 } as BuildCost },
  { id: "solar", name: "Solar Panel", code: "SOL", width: 2, height: 2, color: 0x2c4f7c,
    description: "Turns sunlight into electricity for the base. Works anywhere: it doesn't need tubes.",
    cost: { regolith: 15 } as BuildCost },
  { id: "medbay", name: "Med Bay", code: "MED", width: 2, height: 2, color: 0xd96a6a,
    description: "A small clinic where sick or injured crew can be looked after.",
    cost: { regolith: 25, water: 10, power: 10 } as BuildCost },
  { id: "research", name: "Research Lab", code: "LAB", width: 3, height: 2, color: 0x4f9fd9,
    description: "Holds one astronaut. Research only moves on while someone is working inside.",
    cost: { regolith: 30, power: 15 } as BuildCost },
  // Unlocked by research (see MODULE_RESEARCH), in era order. Sizes match their art (assets/blender/modules).
  { id: "lounge", name: "Lounge", code: "LNG", width: 2, height: 2, color: 0xe8743b,
    description: "Somewhere for the crew to spend time together, which lifts their morale a little.",
    cost: { regolith: 25, power: 5 } as BuildCost },
  { id: "wind-turbine", name: "Wind Turbine", code: "WND", width: 1, height: 1, color: 0xe8e4da,
    description: "Less power than solar panels, but steady, day and night.",
    cost: { regolith: 10 } as BuildCost },
  // Its id stays "observatory" so saves and the research that unlocks it still match.
  { id: "observatory", name: "Sonification Station", code: "SON", width: 2, height: 2, color: 0xcfd6e0,
    description: "Turns pictures of space into sound. When the music plays a nebula, a ! appears on it: click it to see that nebula.",
    cost: { regolith: 25, power: 10 } as BuildCost },
  { id: "big-lounge", name: "Big Lounge", code: "BLG", width: 3, height: 2, color: 0xe8743b,
    description: "A bigger Lounge, with room for more of the crew.",
    cost: { regolith: 40, power: 10 } as BuildCost },
  { id: "rover-bay", name: "Rover Bay", code: "ROV", width: 3, height: 2, color: 0xd9a441,
    description: "A garage for a rover that can go with an expedition. It runs on fuel instead of food.",
    cost: { regolith: 40, power: 15 } as BuildCost },
  { id: "fuel-generator", name: "Fuel Generator", code: "FUEL", width: 2, height: 2, color: 0xc8463d,
    description: "Makes fuel, using up resources such as sulfur.",
    cost: { regolith: 30, power: 20 } as BuildCost },
  { id: "greenhouse", name: "Potato Greenhouse", code: "GRN", width: 3, height: 2, color: 0x62b56c,
    description: "Uses a lot more power, but grows potatoes for food on its own.",
    cost: { regolith: 30, water: 20, power: 10 } as BuildCost },
  { id: "research-pro", name: "Advanced Research Lab", code: "LB2", width: 3, height: 2, color: 0x4f9fd9,
    description: "A Research Lab that works 1.5× as fast. Like any lab, it holds one astronaut.",
    cost: { regolith: 40, power: 25 } as BuildCost },
  { id: "uranium-power", name: "Uranium Power Plant", code: "URN", width: 2, height: 2, color: 0xe0b040,
    description: "Uses uranium to make power, day or night, in any weather.",
    cost: { regolith: 50 } as BuildCost },
] as const

/**
 * Modules that can't be built until a research project is done (ids from content/research.ts).
 * A module not listed here can be built from the start.
 */
export const MODULE_RESEARCH: Partial<Record<ModuleTypeId, string>> = {
  lounge: "lounge",
  "wind-turbine": "wind-turbines",
  observatory: "observatory",
  "big-lounge": "bigger-lounge",
  "rover-bay": "rover",
  "fuel-generator": "fuel-generator",
  greenhouse: "potato-greenhouse",
  "research-pro": "better-research",
  "uranium-power": "uranium-power",
}

/**
 * Machines and equipment the crew can't go inside: they walk around them, and an astronaut sent to
 * one works beside it from outside. Every other module is a room the crew can walk into.
 */
export const CLOSED_MODULES: readonly ModuleTypeId[] = [
  "solar",
  "wind-turbine",
  "rover-bay",
  "fuel-generator",
  "greenhouse",
  "uranium-power",
]

/** True if the crew can walk inside this kind of module. */
export const canEnter = (id: ModuleTypeId) => !CLOSED_MODULES.includes(id)

/** The module a research project unlocks, if any. */
export const moduleUnlockedBy = (projectId: string): ModuleType | undefined =>
  MODULE_TYPES.find((type) => MODULE_RESEARCH[type.id] === projectId)

/** True if this module can be built yet: it needs no research, or the research it needs is done. */
export function moduleUnlocked(id: ModuleTypeId, researched: readonly string[]) {
  const needs = MODULE_RESEARCH[id]
  return !needs || researched.includes(needs)
}

export type ModuleType = (typeof MODULE_TYPES)[number]
export type ModuleTypeId = ModuleType["id"]

/*
 * Where each module's sprite stack is, under public/ (see map/spriteStack.ts). The files are
 * `<path>_stack.png` and `<path>_stack.json`, made by assets/blender/slicer.py, and `<path>_icon.png`,
 * the picture on its Build bar card. A module whose files aren't there yet is drawn as a plain
 * coloured box.
 */
export const MODULE_STACKS: Partial<Record<ModuleTypeId, string>> = {
  habitat: "sprites/era1/habitat",
  solar: "sprites/era1/solar",
  medbay: "sprites/era2/medbay",
  research: "sprites/era1/research",
  lounge: "sprites/era1/lounge",
  "wind-turbine": "sprites/era1/wind_turbine",
  observatory: "sprites/era1/observatory",
  "big-lounge": "sprites/era2/big_lounge",
  "rover-bay": "sprites/era2/rover_bay",
  "fuel-generator": "sprites/era2/fuel_generator",
  greenhouse: "sprites/era2/greenhouse",
  "research-pro": "sprites/era3/research_pro",
  // The reactor art made for era 3 (assets/blender/modules/era3_power.py).
  "uranium-power": "sprites/era3/power",
}

/** A module's Build bar picture (its icon from the sprite exports), or undefined if it has none. */
export const moduleIcon = (id: ModuleTypeId) => {
  const path = MODULE_STACKS[id]
  return path ? `${import.meta.env.BASE_URL}${path}_icon.png` : undefined
}

export function moduleType(id: ModuleTypeId): ModuleType {
  // Every id in a save comes from this list, so the lookup can't miss.
  return MODULE_TYPES.find((type) => type.id === id) ?? MODULE_TYPES[0]
}
