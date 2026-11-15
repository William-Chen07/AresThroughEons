/*
 * The kinds of base module. This is plain data on purpose: add a row to add a
 * module, or change a size or colour, without touching the game code.
 *
 * `width` and `height` are in map cells. `code` is the short label drawn on
 * the module's roof. `color` is the roof colour.
 */
export const MODULE_TYPES = [
  { id: "habitat", name: "Habitat", code: "HAB", width: 3, height: 3, color: 0xd8d4cc },
  { id: "research", name: "Research Lab", code: "LAB", width: 3, height: 2, color: 0x4f9fd9 },
  { id: "medbay", name: "Med Bay", code: "MED", width: 2, height: 2, color: 0xd96a6a },
  { id: "greenhouse", name: "Greenhouse", code: "GRN", width: 3, height: 2, color: 0x62b56c },
  { id: "power", name: "Power Plant", code: "PWR", width: 2, height: 2, color: 0xe0b040 },
  { id: "storage", name: "Storage", code: "STO", width: 2, height: 2, color: 0x9a8f86 },
  // The only way between the base and the outside: crew walking out (or in) cycle through one.
  { id: "airlock", name: "Airlock", code: "AIR", width: 2, height: 1, color: 0x7fb3c8 },
] as const

export type ModuleType = (typeof MODULE_TYPES)[number]
export type ModuleTypeId = ModuleType["id"]

export function moduleType(id: ModuleTypeId): ModuleType {
  // Every id in a save comes from this list, so the lookup can't miss.
  return MODULE_TYPES.find((type) => type.id === id) ?? MODULE_TYPES[0]
}
