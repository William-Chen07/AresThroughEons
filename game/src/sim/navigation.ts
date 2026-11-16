import type { ModuleTypeId } from "@/content/modules"
import type { VoxelTerrain } from "@/map/voxelTerrain"
import { LANDER, MODULE, TUBE, cellsJoined, moduleDoorways, moduleRect, occupancy, type Base } from "@/sim/base"
import {
  BLOCKED,
  createStation,
  createWorld,
  replan,
  type Mover,
  type Station,
  type UrgentNeed,
  type World,
} from "@/sim/pathing"

/*
 * Connects the base map (sim/base.ts + the terrain) to crew movement (sim/pathing): it builds the
 * walkable map the crew moves on from what's built where.
 *
 *   map cell                     →  pathing tile
 *   open ground                  →  outside (the Martian surface), with its real height for slopes
 *   module or tube               →  inside, flat floor (tubes are the hallways between modules)
 *   the lander                   →  blocked
 *
 * Crew go in and out of a module only through its four doorways, one in the middle of each side
 * (see moduleDoorways in sim/base.ts): out onto open ground, or into a tube laid in front of one.
 * Tubes have no doors of their own: they're the hallways between modules, and modules standing
 * wall to wall are walked between too. Routes between joined modules stay inside
 * (see PATHING_TUNING.doorCrossingCost). Airlocks aren't needed to get in: an Airlock keeps the
 * modules joined to it pressurized (see pressurizedCells), so crew there don't use up oxygen.
 *
 * Every module is also a walk-in station, so clicking one sends the selected crew inside to work.
 * Pressurized modules provide "oxygen", so a crewmate running low heads for one.
 * Call syncNavigation whenever the base changes; crew keep their places and orders, and anyone
 * whose route was cut finds another or stops.
 */

/** The parts of the terrain movement needs (the full VoxelTerrain also fits). */
export type NavigationTerrain = Pick<VoxelTerrain, "size" | "metersPerCell" | "metres">

/**
 * Urgent needs each kind of module takes care of (see sim/pathing/needs.ts).
 * TODO(team): decide these, e.g. habitat → rest, greenhouse → food and water.
 */
export const MODULE_PROVIDES: Partial<Record<ModuleTypeId, Exclude<UrgentNeed, "shelter">[]>> = {}

/** Station ids for modules, so they can be told apart from any other stations. */
export const moduleStationId = (moduleId: string) => `module:${moduleId}`

/**
 * Cells (index row * size + col) of every module and tube joined to an Airlock, through tubes or
 * modules standing wall to wall (see cellsJoined in sim/base.ts), the Airlock itself included.
 */
export function pressurizedCells(size: number, base: Base, built = occupancy(size, base)): Set<number> {
  const pressurized = new Set<number>()
  const queue: number[] = []
  for (const module of base.modules) {
    if (module.type !== "airlock") continue
    const rect = moduleRect(module)
    for (let row = Math.max(0, rect.row); row < Math.min(size, rect.row + rect.height); row++) {
      for (let col = Math.max(0, rect.col); col < Math.min(size, rect.col + rect.width); col++) {
        const i = row * size + col
        if (!pressurized.has(i)) {
          pressurized.add(i)
          queue.push(i)
        }
      }
    }
  }
  while (queue.length > 0) {
    const i = queue.pop()!
    const col = i % size
    const row = Math.floor(i / size)
    const next = [col > 0 ? i - 1 : -1, col < size - 1 ? i + 1 : -1, row > 0 ? i - size : -1, row < size - 1 ? i + size : -1]
    for (const n of next) {
      if (n < 0 || pressurized.has(n) || !cellsJoined(size, base, built, i, n)) continue
      pressurized.add(n)
      queue.push(n)
    }
  }
  return pressurized
}

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
  grid.airlocksRequired = false

  const built = occupancy(size, base)
  for (let i = 0; i < size * size; i++) {
    const what = built[i]
    grid.zone[i] = what === MODULE || what === TUBE ? "inside" : "outside"
    grid.cost[i] = what === LANDER ? BLOCKED : 1
    grid.elevation[i] = terrain.metres[i]
  }
  const pressurized = pressurizedCells(size, base, built)

  // A doorway leads outside only if the cell in front of it is open ground (not another module,
  // a tube, or off the edge of the map). One with a tube in front leads into the tube instead.
  const doors: number[] = []
  const onMap = (cell: { col: number; row: number }) => cell.col >= 0 && cell.row >= 0 && cell.col < size && cell.row < size
  for (const module of base.modules) {
    for (const { inside, outside } of moduleDoorways(moduleRect(module))) {
      if (!onMap(inside) || !onMap(outside)) continue
      if (built[inside.row * size + inside.col] !== MODULE || grid.zone[outside.row * size + outside.col] !== "outside") continue
      doors.push(inside.row * size + inside.col, outside.row * size + outside.col)
    }
  }
  grid.doors = doors

  // A tube beside a module but not at one of its doorways (only in bases built before doorways)
  // has a wall between them.
  const walls: number[] = []
  for (let i = 0; i < size * size; i++) {
    if (built[i] !== TUBE) continue
    const col = i % size
    for (const n of [col < size - 1 ? i + 1 : -1, i + size < size * size ? i + size : -1, col > 0 ? i - 1 : -1, i - size]) {
      if (n < 0 || built[n] !== MODULE || cellsJoined(size, base, built, i, n)) continue
      walls.push(i, n)
    }
  }
  grid.walls = walls

  // One walk-in station per module. Keep the Station object for modules that are still there,
  // so any work done on them isn't lost; stations that aren't modules are left alone.
  const existing = new Map(world.stations.map((s) => [s.id, s]))
  const moduleStations: Station[] = base.modules.map((module) => {
    const id = moduleStationId(module.id)
    const rect = moduleRect(module)
    const provides = [...(MODULE_PROVIDES[module.type] ?? [])]
    if (pressurized.has(rect.row * size + rect.col) && !provides.includes("oxygen")) provides.push("oxygen")
    const kept = existing.get(id)
    if (kept) {
      kept.provides = provides
      return kept
    }
    return createStation(grid, {
      id,
      kind: module.type,
      x: rect.col,
      y: rect.row,
      width: rect.width,
      height: rect.height,
      walkIn: true,
      provides,
    })
  })
  world.stations = [...world.stations.filter((s) => !s.id.startsWith("module:")), ...moduleStations]

  for (const mover of Object.values(world.movers)) {
    settleMover(world, mover)
    replan(world, mover.pawnId) // the best way may go round (or through) what changed
    mover.unmetNeed = null // what couldn't be found before may be there now: try again
  }
}

/**
 * Puts a crewmate right after the base changed under it. Something built where a crewmate stands
 * outside nudges them out of the way onto open ground (they didn't come in by a door, and a tube
 * on its own has none). Knocking down what they're in leaves them outside. Nobody may be left in
 * the lander.
 */
function settleMover(world: World, mover: Mover) {
  const { grid } = world
  const tile = { x: Math.round(mover.pos.x), y: Math.round(mover.pos.y) }
  const index = tile.y * grid.width + tile.x
  const zone = grid.zone[index]
  const blocked = grid.cost[index] === BLOCKED
  // Halfway through a door the rounded tile can be the inside one already: that's not built-on.
  const builtOn = zone === "inside" && mover.exposure === "outside" && !isDoorCell(grid, index)
  if (blocked || builtOn) {
    const free = nearestOpenTile(world, tile)
    if (!free) return
    mover.pos = { ...free }
    mover.path = []
    mover.exposure = "outside"
    mover.cyclingTo = null
    // Head on with its order from here, or stand still if it can't.
    if (!mover.order || !replan(world, mover.pawnId)) {
      Object.assign(mover, { destination: null, status: "idle", order: null, path: [] })
    }
    return
  }
  if (zone !== "airlock") {
    mover.exposure = zone
    mover.cyclingTo = null
  }
}

const isDoorCell = (grid: World["grid"], index: number) => {
  for (let i = 0; i < grid.doors.length; i += 2) if (grid.doors[i] === index) return true
  return false
}

/** The closest open-ground tile that isn't blocked, searching outwards in square rings. */
function nearestOpenTile(world: World, from: { x: number; y: number }) {
  const { grid } = world
  for (let r = 1; r < Math.max(grid.width, grid.height); r++) {
    let best: { x: number; y: number } | null = null
    let bestDistance = Infinity
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
        const x = from.x + dx
        const y = from.y + dy
        if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) continue
        if (grid.cost[y * grid.width + x] === BLOCKED || grid.zone[y * grid.width + x] !== "outside") continue
        const distance = dx * dx + dy * dy
        if (distance < bestDistance) {
          best = { x, y }
          bestDistance = distance
        }
      }
    }
    if (best) return best
  }
  return null
}
