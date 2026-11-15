import { moduleType, type ModuleTypeId } from "@/content/modules"
import type { Cell } from "@/map/voxelTerrain"

/*
 * The base: modules placed on the map grid, and the tubes laid between them.
 * Pure logic, no drawing (see map/baseView.ts for that).
 *
 * The player places both by hand. Nothing connects by itself. Two modules
 * are joined when a run of tube cells leads from one to the other, or when
 * they stand right against each other. Every module has four doorways, one in
 * the middle of each side, and a tube can only meet a module at one of them
 * (see moduleDoorways). The lander is only an obstacle: tubes
 * can't run through it and it never counts as joined to anything.
 */

/** The lander's footprint is this many cells a side, in the middle of the map. */
export const LANDER_CELLS = 3

export interface Rect {
  /** The north-west (top-left) cell. */
  col: number
  row: number
  width: number
  height: number
}

export interface PlacedModule {
  id: string
  type: ModuleTypeId
  /** The north-west (top-left) cell of its footprint. */
  col: number
  row: number
  /** The era it was built in (see sim/saves.ts). Modules from an earlier era than the save's are drawn worn down. Missing = era 1. */
  era?: number
}

/** A lander on the map: the cell under its middle, and the era it brought a crew in. */
export interface LanderSpot {
  col: number
  row: number
  era: number
}

export interface Base {
  modules: PlacedModule[]
  /** Every cell that has a piece of tube on it. */
  tubes: Cell[]
  /** Every lander that has come down, oldest first; the last is this era's. Missing = just the first one, in the middle. */
  landers?: LanderSpot[]
}

export const EMPTY_BASE: Base = { modules: [], tubes: [] }

/** What stands on a cell. */
export const FREE = 0
export const LANDER = 1
export const MODULE = 2
export const TUBE = 3

/** The first era's lander comes down in the middle of the map. */
export function firstLander(size: number): LanderSpot {
  const middle = Math.floor(size / 2)
  return { col: middle, row: middle, era: 1 }
}

/** Every lander on the map, oldest first (the last one is this era's). */
export function landersOf(base: Base, size: number): LanderSpot[] {
  return base.landers && base.landers.length > 0 ? base.landers : [firstLander(size)]
}

/** The cells a lander stands on: 3 × 3, centred on its spot. */
export function landerRect(spot: Cell): Rect {
  const half = Math.floor(LANDER_CELLS / 2)
  return { col: spot.col - half, row: spot.row - half, width: LANDER_CELLS, height: LANDER_CELLS }
}

/** Where this era's lander stands. */
export function landerFootprint(size: number, base?: Base): Rect {
  const landers = base ? landersOf(base, size) : [firstLander(size)]
  return landerRect(landers[landers.length - 1])
}

/**
 * Where the next era's lander can come down: the free spot nearest the middle of the map with
 * open ground (no module, tube or old lander) right round it, so the new crew can step out.
 */
export function nextLanderSpot(size: number, base: Base, era: number): LanderSpot {
  const grid = occupancy(size, base)
  const middle = Math.floor(size / 2)
  const margin = 2
  const clear = (col: number, row: number) => {
    const rect = landerRect({ col, row })
    for (let r = rect.row - margin; r < rect.row + rect.height + margin; r++) {
      for (let c = rect.col - margin; c < rect.col + rect.width + margin; c++) {
        if (r < 0 || c < 0 || r >= size || c >= size || grid[r * size + c] !== FREE) return false
      }
    }
    return true
  }
  // Rings outward from the middle, nearest first.
  for (let ring = 1; ring < size / 2; ring++) {
    const spots: Cell[] = []
    for (let d = -ring; d <= ring; d++) {
      spots.push({ col: middle + d, row: middle - ring }, { col: middle + d, row: middle + ring })
      spots.push({ col: middle - ring, row: middle + d }, { col: middle + ring, row: middle + d })
    }
    spots.sort((a, b) => Math.hypot(a.col - middle, a.row - middle) - Math.hypot(b.col - middle, b.row - middle))
    const spot = spots.find(({ col, row }) => clear(col, row))
    if (spot) return { ...spot, era }
  }
  return { col: middle, row: middle, era }
}

export function moduleRect(module: PlacedModule): Rect {
  const { width, height } = moduleType(module.type)
  return { col: module.col, row: module.row, width, height }
}

export type Side = "north" | "east" | "south" | "west"

/** A way in or out of a module: the cell inside its wall, and the cell just outside it. */
export interface Doorway {
  side: Side
  inside: Cell
  outside: Cell
}

/**
 * A module's four doorways, one in the middle of each side (the eastern or southern of the two
 * middle cells when a side is an even number of cells long). Crew go in and out of a module only
 * through these: onto open ground, or into a tube laid in front of one. Tubes can only meet a
 * module at a doorway (see checkTubes). The hatches are drawn there (map/baseView.ts).
 */
export function moduleDoorways(rect: Rect): Doorway[] {
  const midCol = rect.col + Math.floor(rect.width / 2)
  const midRow = rect.row + Math.floor(rect.height / 2)
  const east = rect.col + rect.width - 1
  const south = rect.row + rect.height - 1
  return [
    { side: "north", inside: { col: midCol, row: rect.row }, outside: { col: midCol, row: rect.row - 1 } },
    { side: "east", inside: { col: east, row: midRow }, outside: { col: east + 1, row: midRow } },
    { side: "south", inside: { col: midCol, row: south }, outside: { col: midCol, row: south + 1 } },
    { side: "west", inside: { col: rect.col, row: midRow }, outside: { col: rect.col - 1, row: midRow } },
  ]
}

const sameCell = (a: Cell, b: Cell) => a.col === b.col && a.row === b.row

/** Whether `cell` is right beside the module with footprint `rect` (sharing a wall, not a corner). */
function besideWall(rect: Rect, cell: Cell) {
  const alongRows = cell.row >= rect.row && cell.row < rect.row + rect.height
  const alongCols = cell.col >= rect.col && cell.col < rect.col + rect.width
  return (
    (alongRows && (cell.col === rect.col - 1 || cell.col === rect.col + rect.width)) ||
    (alongCols && (cell.row === rect.row - 1 || cell.row === rect.row + rect.height))
  )
}

/** Whether a tube on `cell` would touch the wall of the module at `rect` anywhere but in front of a doorway. */
function touchesWallOffDoorway(rect: Rect, cell: Cell) {
  return besideWall(rect, cell) && !moduleDoorways(rect).some((door) => sameCell(door.outside, cell))
}

const inRect = (rect: Rect, cell: Cell) =>
  cell.col >= rect.col && cell.col < rect.col + rect.width && cell.row >= rect.row && cell.row < rect.row + rect.height

/** The module standing on a cell, if any. */
export function moduleAt(modules: PlacedModule[], cell: Cell): PlacedModule | null {
  return modules.find((module) => inRect(moduleRect(module), cell)) ?? null
}

/** The footprint's north-west cell when a module of this type is centred on `cell`. */
export function placementOrigin(type: ModuleTypeId, cell: Cell): Cell {
  const { width, height } = moduleType(type)
  return { col: cell.col - Math.floor(width / 2), row: cell.row - Math.floor(height / 2) }
}

/** What stands on every cell of a map `size` cells a side (index row * size + col). */
export function occupancy(size: number, base: Base): Uint8Array {
  const grid = new Uint8Array(size * size)
  const mark = (rect: Rect, value: number) => {
    for (let row = Math.max(0, rect.row); row < Math.min(size, rect.row + rect.height); row++) {
      for (let col = Math.max(0, rect.col); col < Math.min(size, rect.col + rect.width); col++) {
        grid[row * size + col] = value
      }
    }
  }
  for (const tube of base.tubes) mark({ ...tube, width: 1, height: 1 }, TUBE)
  for (const module of base.modules) mark(moduleRect(module), MODULE)
  for (const lander of landersOf(base, size)) mark(landerRect(lander), LANDER)
  return grid
}

export type ModuleCheck = { ok: true; module: PlacedModule } | { ok: false; reason: string }

/**
 * Whether a new module of `type` can go with its north-west cell at `origin`. `grid` is the base's
 * occupancy. With `levels` (the terrain's block height per cell), the ground under the whole
 * module must be level: no building across the edge of a step.
 */
export function checkModule(
  size: number,
  grid: Uint8Array,
  type: ModuleTypeId,
  origin: Cell,
  id = "new",
  levels?: ArrayLike<number>,
): ModuleCheck {
  const { width, height } = moduleType(type)
  if (origin.col < 0 || origin.row < 0 || origin.col + width > size || origin.row + height > size) {
    return { ok: false, reason: "That is off the edge of the map." }
  }
  let onTube = false
  for (let row = origin.row; row < origin.row + height; row++) {
    for (let col = origin.col; col < origin.col + width; col++) {
      const what = grid[row * size + col]
      if (what === LANDER) return { ok: false, reason: "The lander is in the way." }
      if (what === MODULE) return { ok: false, reason: "Another module is already there." }
      if (what === TUBE) onTube = true
    }
  }
  if (onTube) return { ok: false, reason: "A tube runs through there. Remove it first." }
  // Any tube already beside it must line up with one of its doorways.
  const rect = { ...origin, width, height }
  for (let row = origin.row - 1; row <= origin.row + height; row++) {
    for (let col = origin.col - 1; col <= origin.col + width; col++) {
      if (col < 0 || row < 0 || col >= size || row >= size || grid[row * size + col] !== TUBE) continue
      if (touchesWallOffDoorway(rect, { col, row })) {
        return { ok: false, reason: "A tube would touch its wall away from a doorway. Tubes meet a module in the middle of a side." }
      }
    }
  }
  if (levels) {
    const level = levels[origin.row * size + origin.col]
    for (let row = origin.row; row < origin.row + height; row++) {
      for (let col = origin.col; col < origin.col + width; col++) {
        if (levels[row * size + col] !== level) {
          return { ok: false, reason: "The ground there isn't level. Modules need a flat spot." }
        }
      }
    }
  }
  return { ok: true, module: { id, type, col: origin.col, row: origin.row } }
}

/**
 * The cells of a straight run of tube from `start` toward `end`. Tubes run
 * along the grid, so it follows whichever of the two directions `end` is
 * further away in, and stays in `start`'s row or column.
 */
export function tubeRun(start: Cell, end: Cell): Cell[] {
  const acrossCols = Math.abs(end.col - start.col) >= Math.abs(end.row - start.row)
  const length = acrossCols ? Math.abs(end.col - start.col) : Math.abs(end.row - start.row)
  const step = acrossCols ? Math.sign(end.col - start.col) : Math.sign(end.row - start.row)
  return Array.from({ length: length + 1 }, (_, i) =>
    acrossCols ? { col: start.col + i * step, row: start.row } : { col: start.col, row: start.row + i * step },
  )
}

export type TubeCheck = { ok: true; added: Cell[] } | { ok: false; reason: string }

/**
 * Whether tube can be laid on all of `cells`. `added` leaves out the ones that already have tube.
 * A tube can only meet a module at one of its doorways, in the middle of each side (see
 * moduleDoorways): it can't run along a module's wall or touch it anywhere else.
 */
export function checkTubes(size: number, grid: Uint8Array, cells: Cell[], modules: PlacedModule[] = []): TubeCheck {
  const added: Cell[] = []
  for (const cell of cells) {
    if (cell.col < 0 || cell.row < 0 || cell.col >= size || cell.row >= size) {
      return { ok: false, reason: "That is off the edge of the map." }
    }
    const what = grid[cell.row * size + cell.col]
    if (what === LANDER) return { ok: false, reason: "Tubes can't connect to the lander or run through it." }
    if (what === MODULE) return { ok: false, reason: "A tube stops at a module's wall. It can't run through one." }
    if (modules.some((module) => touchesWallOffDoorway(moduleRect(module), cell))) {
      return { ok: false, reason: "Tubes can only meet a module at a doorway, in the middle of one of its sides." }
    }
    if (what === FREE) added.push(cell)
  }
  return { ok: true, added }
}

const STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

/**
 * The module cells a block of tube opens into (index row * size + col): the inside of each
 * doorway it stands in front of (see moduleDoorways). A tube anywhere else beside a module (only
 * possible in bases built before doorways) doesn't open into it.
 */
export function tubeOpenings(size: number, base: Base, grid: Uint8Array, cell: number): number[] {
  if (grid[cell] !== TUBE) return []
  const here = { col: cell % size, row: Math.floor(cell / size) }
  const openings: number[] = []
  for (const [dc, dr] of STEPS) {
    const next = { col: here.col + dc, row: here.row + dr }
    if (next.col < 0 || next.row < 0 || next.col >= size || next.row >= size) continue
    if (grid[next.row * size + next.col] !== MODULE) continue
    const module = moduleAt(base.modules, next)
    if (!module) continue
    const door = moduleDoorways(moduleRect(module)).find((d) => sameCell(d.outside, here) && sameCell(d.inside, next))
    if (door) openings.push(next.row * size + next.col)
  }
  return openings
}

/**
 * Whether two neighbouring cells (indices) are joined, so crew and air pass between them:
 * module to module (the same module, or two standing wall to wall), tube to tube, and a tube to
 * the module whose doorway it's in front of (see tubeOpenings).
 */
export function cellsJoined(size: number, base: Base, grid: Uint8Array, a: number, b: number): boolean {
  const first = grid[a]
  const second = grid[b]
  if ((first === MODULE && second === MODULE) || (first === TUBE && second === TUBE)) return true
  if (first === TUBE && second === MODULE) return tubeOpenings(size, base, grid, a).includes(b)
  if (first === MODULE && second === TUBE) return tubeOpenings(size, base, grid, b).includes(a)
  return false
}

/**
 * The modules sorted into groups that are joined to each other, by tubes or
 * by standing wall to wall (see cellsJoined). One group means the whole base is connected.
 * Each group is a list of module ids.
 */
export function connectedGroups(size: number, base: Base, grid: Uint8Array): string[][] {
  const seen = new Uint8Array(size * size)
  const groups: string[][] = []
  for (const first of base.modules) {
    const start = first.row * size + first.col
    if (seen[start]) continue
    // Flood outward over module and tube cells. The lander isn't one, so nothing joins through it.
    const ids = new Set<string>()
    const queue = [start]
    seen[start] = 1
    for (let head = 0; head < queue.length; head++) {
      const cell = queue[head]
      const col = cell % size
      const row = (cell - col) / size
      if (grid[cell] === MODULE) {
        const module = moduleAt(base.modules, { col, row })
        if (module) ids.add(module.id)
      }
      for (const [dc, dr] of STEPS) {
        const nextCol = col + dc
        const nextRow = row + dr
        if (nextCol < 0 || nextRow < 0 || nextCol >= size || nextRow >= size) continue
        const next = nextRow * size + nextCol
        if (seen[next] || !cellsJoined(size, base, grid, cell, next)) continue
        seen[next] = 1
        queue.push(next)
      }
    }
    groups.push([...ids])
  }
  return groups
}
