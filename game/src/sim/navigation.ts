import type { ModuleTypeId } from "@/content/modules"
import type { VoxelTerrain } from "@/map/voxelTerrain"
import { LANDER, MODULE, TUBE, moduleRect, occupancy, type Base } from "@/sim/base"
import {
  BLOCKED,
  createStation,
  createWorld,
  type Station,
  type UrgentNeed,
  type World,
  type Zone,
} from "@/sim/pathing"

/*
 * Connects the base map (sim/base.ts + the terrain) to crew movement (sim/pathing): it builds the
 * walkable map the crew moves on from what's built where.
 *
 *   map cell                     →  pathing tile
 *   open ground                  →  outside (the Martian surface), with its real height for slopes
 *   module or tube               →  inside, flat floor
 *   Airlock module               →  airlock: the only way between inside and outside
 *   the lander                   →  blocked
 *
 * Every module is also a walk-in station, so clicking one sends the selected crew inside to work.
 * Call syncNavigation whenever the base changes; crew keep their places and orders, and anyone
 * whose route was cut finds another or stops.
 */

/** The parts of the terrain movement needs (the full VoxelTerrain also fits). */
export type NavigationTerrain = Pick<VoxelTerrain, "size" | "metersPerCell" | "metres">

/**
 * Urgent needs each kind of module takes care of (see sim/pathing/needs.ts).
 * TODO(team): decide these, e.g. habitat → rest, storage → food and water.
 */
export const MODULE_PROVIDES: Partial<Record<ModuleTypeId, Exclude<UrgentNeed, "shelter">[]>> = {}

/** Station ids for modules, so they can be told apart from any other stations. */
export const moduleStationId = (moduleId: string) => `module:${moduleId}`

/** A fresh movement world for a map and base. `seed` drives idle wandering (see pathing/random.ts). */
export function buildNavigation(terrain: NavigationTerrain, base: Base, seed = 1): World {
  const world = createWorld(terrain.size, terrain.size, seed)
  syncNavigation(world, terrain, base)
  return world
}

/** Updates a movement world after the base changed (a module or tube built or removed). */
export function syncNavigation(world: World, terrain: NavigationTerrain, base: Base) {
  const { size } = terrain
  const { grid } = world
  if (grid.width !== size || grid.height !== size) throw new Error("The movement world is for a different map size.")
  grid.metersPerTile = terrain.metersPerCell

  const built = occupancy(size, base)
  const airlockCells = new Set<number>()
  for (const module of base.modules) {
    if (module.type !== "airlock") continue
    const rect = moduleRect(module)
    for (let row = rect.row; row < rect.row + rect.height; row++) {
      for (let col = rect.col; col < rect.col + rect.width; col++) airlockCells.add(row * size + col)
    }
  }

  for (let i = 0; i < size * size; i++) {
    const what = built[i]
    let zone: Zone = "outside"
    if (what === MODULE || what === TUBE) zone = airlockCells.has(i) ? "airlock" : "inside"
    grid.zone[i] = zone
    grid.cost[i] = what === LANDER ? BLOCKED : 1
    grid.elevation[i] = terrain.metres[i]
  }

  // One walk-in station per module. Keep the Station object for modules that are still there,
  // so any work done on them isn't lost; stations that aren't modules are left alone.
  const existing = new Map(world.stations.map((s) => [s.id, s]))
  const moduleStations: Station[] = base.modules.map((module) => {
    const id = moduleStationId(module.id)
    const kept = existing.get(id)
    if (kept) return kept
    const rect = moduleRect(module)
    return createStation(grid, {
      id,
      kind: module.type,
      x: rect.col,
      y: rect.row,
      width: rect.width,
      height: rect.height,
      walkIn: true,
      provides: MODULE_PROVIDES[module.type] ?? [],
    })
  })
  world.stations = [...world.stations.filter((s) => !s.id.startsWith("module:")), ...moduleStations]
}
