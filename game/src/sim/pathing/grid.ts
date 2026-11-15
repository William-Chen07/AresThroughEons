/**
 * The walkable map the crew moves on.
 *
 * Tiles use screen-style coordinates: x grows to the right, y grows downward, (0, 0) is the
 * top-left tile. Everything is plain numbers and arrays so a world can be saved as JSON.
 */

/** One square on the map. */
export interface Tile {
  x: number
  y: number
}

/** Walking cost of a tile that can't be walked on (rock, walls, a building's footprint). */
export const BLOCKED = 0

/**
 * Where a tile is. Inside and outside never touch directly for walking: the only way between
 * them is through an airlock tile, which takes time to cycle (see movement.ts).
 */
export type Zone = "outside" | "inside" | "airlock"

/**
 * Terrain costs, one per tile, row by row. 1 is normal ground; 2 takes twice as long to cross
 * (e.g. loose sand); BLOCKED (0) can't be entered. 0 rather than Infinity because JSON turns
 * Infinity into null. Keep walkable costs at 1 or more: the route search assumes no tile is
 * cheaper than plain ground, and would miss the shortest route otherwise.
 */
export interface Grid {
  width: number
  height: number
  cost: number[]
  /** Zone of each tile, row by row. A new map is all outside (the Martian surface). */
  zone: Zone[]
}

export function createGrid(width: number, height: number, cost = 1): Grid {
  const size = width * height
  return {
    width,
    height,
    cost: Array.from({ length: size }, () => cost),
    zone: Array.from({ length: size }, (): Zone => "outside"),
  }
}

export const inBounds = (grid: Grid, x: number, y: number) => x >= 0 && y >= 0 && x < grid.width && y < grid.height

export const tileIndex = (grid: Grid, x: number, y: number) => y * grid.width + x

/** Terrain cost of a tile; tiles off the map count as BLOCKED. */
export const getCost = (grid: Grid, x: number, y: number) => (inBounds(grid, x, y) ? grid.cost[tileIndex(grid, x, y)] : BLOCKED)

export function setCost(grid: Grid, tile: Tile, cost: number) {
  if (inBounds(grid, tile.x, tile.y)) grid.cost[tileIndex(grid, tile.x, tile.y)] = Math.max(cost, BLOCKED)
}

/** Zone of a tile; tiles off the map count as outside. */
export const getZone = (grid: Grid, x: number, y: number): Zone =>
  inBounds(grid, x, y) ? grid.zone[tileIndex(grid, x, y)] : "outside"

export function setZone(grid: Grid, tile: Tile, zone: Zone) {
  if (inBounds(grid, tile.x, tile.y)) grid.zone[tileIndex(grid, tile.x, tile.y)] = zone
}

/** Walking straight from one zone into the other (inside ↔ outside) isn't allowed; airlocks connect them. */
export const canCrossZones = (from: Zone, to: Zone) =>
  !((from === "inside" && to === "outside") || (from === "outside" && to === "inside"))

export const sameTile = (a: Tile, b: Tile) => a.x === b.x && a.y === b.y

/** The tile a (possibly between-tiles) position is standing on. */
export const tileOf = (pos: { x: number; y: number }): Tile => ({ x: Math.round(pos.x), y: Math.round(pos.y) })
