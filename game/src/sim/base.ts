import { moduleType, type ModuleTypeId } from "@/content/modules"
import type { Cell } from "@/map/voxelTerrain"

/*
 * The base: modules placed on the map grid, and the tubes laid between them.
 * Pure logic, no drawing (see map/baseView.ts for that).
 *
 * The player places both by hand. Nothing connects by itself. Two modules
 * are joined when a run of tube cells leads from one to the other, or when
 * they stand right against each other. The lander is only an obstacle: tubes
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
}

export interface Base {
  modules: PlacedModule[]
  /** Every cell that has a piece of tube on it. */
  tubes: Cell[]
}

export const EMPTY_BASE: Base = { modules: [], tubes: [] }

/** What stands on a cell. */
export const FREE = 0
export const LANDER = 1
export const MODULE = 2
export const TUBE = 3

export function landerFootprint(size: number): Rect {
  const middle = Math.floor(size / 2)
  const half = Math.floor(LANDER_CELLS / 2)
  return { col: middle - half, row: middle - half, width: LANDER_CELLS, height: LANDER_CELLS }
}

export function moduleRect(module: PlacedModule): Rect {
  const { width, height } = moduleType(module.type)
  return { col: module.col, row: module.row, width, height }
}

/**
 * A module's door: the middle cell of its south (front) wall, the eastern one of the two middle
 * cells when it's an even number of cells wide, and the ground cell just outside it. Crew go in
 * and out of a module only here (see sim/navigation.ts); the hatch is drawn there (map/baseView.ts).
 */
export function moduleDoor(module: PlacedModule): { inside: Cell; outside: Cell } {
  const rect = moduleRect(module)
  const col = rect.col + Math.floor(rect.width / 2)
  const row = rect.row + rect.height - 1
  return { inside: { col, row }, outside: { col, row: row + 1 } }
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
  mark(landerFootprint(size), LANDER)
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

/** Whether tube can be laid on all of `cells`. `added` leaves out the ones that already have tube. */
export function checkTubes(size: number, grid: Uint8Array, cells: Cell[]): TubeCheck {
  const added: Cell[] = []
  for (const cell of cells) {
    if (cell.col < 0 || cell.row < 0 || cell.col >= size || cell.row >= size) {
      return { ok: false, reason: "That is off the edge of the map." }
    }
    const what = grid[cell.row * size + cell.col]
    if (what === LANDER) return { ok: false, reason: "Tubes can't connect to the lander or run through it." }
    if (what === MODULE) return { ok: false, reason: "A tube stops at a module's wall. It can't run through one." }
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
 * The modules sorted into groups that are joined to each other, by tubes or
 * by standing wall to wall. One group means the whole base is connected.
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
        if (seen[next] || (grid[next] !== MODULE && grid[next] !== TUBE)) continue
        seen[next] = 1
        queue.push(next)
      }
    }
    groups.push([...ids])
  }
  return groups
}
