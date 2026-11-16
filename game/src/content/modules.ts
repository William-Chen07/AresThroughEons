/*
 * The kinds of base module. This is plain data on purpose: add a row to add a
 * module, or change a size or colour, without touching the game code.
 *
 * `width` and `height` are in map cells. `code` is the short label drawn on
 * the module's roof. `color` is the roof colour. `description` is shown in the Build bar.
 * Some modules need a research project first (see MODULE_RESEARCH). Tubes are free.
 * `cost` is what building one takes. The amounts are placeholders: building doesn't use
 * resources yet.
 */
import type { ResourceId } from "@/content/resources"

export type BuildCost = Partial<Record<ResourceId, number>>

export const MODULE_TYPES = [
  { id: "habitat", name: "Habitat", code: "HAB", width: 3, height: 3, color: 0xd8d4cc,
    description: "Home for the crew: somewhere to sleep, eat and shelter from radiation storms.",
    cost: { regolith: 40, power: 10 } as BuildCost },
  { id: "research", name: "Research Lab", code: "LAB", width: 3, height: 2, color: 0x4f9fd9,
    description: "Holds one astronaut. Research only moves on while someone is working inside.",
    cost: { regolith: 30, power: 15 } as BuildCost },
  { id: "medbay", name: "Med Bay", code: "MED", width: 2, height: 2, color: 0xd96a6a,
    description: "A small clinic where sick or injured crew can be looked after.",
    cost: { regolith: 25, water: 10, power: 10 } as BuildCost },
  { id: "greenhouse", name: "Greenhouse", code: "GRN", width: 3, height: 2, color: 0x62b56c,
    description: "Grows plants under lights, for fresh food far from Earth.",
    cost: { regolith: 30, water: 20, power: 10 } as BuildCost },
  { id: "power", name: "Power Plant", code: "PWR", width: 2, height: 2, color: 0xe0b040,
    description: "Makes the electricity the rest of the base runs on.",
    cost: { regolith: 20 } as BuildCost },
] as const

/**
 * Modules that can't be built until a research project is done (ids from content/research.ts).
 * A module not listed here can be built from the start.
 */
export const MODULE_RESEARCH: Partial<Record<ModuleTypeId, string>> = {
  greenhouse: "potato-greenhouse",
}

/** True if this module can be built yet: it needs no research, or the research it needs is done. */
export function moduleUnlocked(id: ModuleTypeId, researched: readonly string[]) {
  const needs = MODULE_RESEARCH[id]
  return !needs || researched.includes(needs)
}

export type ModuleType = (typeof MODULE_TYPES)[number]
export type ModuleTypeId = ModuleType["id"]

/*
 * Where each module's sprite stack is, under public/ (see map/spriteStack.ts). The files are
 * `<path>_stack.png` and `<path>_stack.json`, made by assets/blender/slicer.py. A module whose
 * files aren't there yet is drawn as a plain coloured box.
 */
export const MODULE_STACKS: Partial<Record<ModuleTypeId, string>> = {
  habitat: "sprites/era1/habitat",
  research: "sprites/era1/research",
  storage: "sprites/era1/storage",
  airlock: "sprites/era1/airlock",
  greenhouse: "sprites/era2/greenhouse",
  medbay: "sprites/era2/medbay",
  power: "sprites/era3/power",
}

export function moduleType(id: ModuleTypeId): ModuleType {
  // Every id in a save comes from this list, so the lookup can't miss.
  return MODULE_TYPES.find((type) => type.id === id) ?? MODULE_TYPES[0]
}
