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
  /** How wide one tile is in real metres. Walking speed and distances are worked out from this. */
  metersPerTile: number
  /** Ground height of each tile in metres, row by row. Slopes outside slow walking down (see slopeFactor). */
  elevation: number[]
  /**
   * How inside and outside connect. True: only through airlock tiles (see Zone). False: only
   * through the doors listed in `doors`.
   */
  airlocksRequired: boolean
  /**
   * Doorways, used when airlocksRequired is false: pairs of tile indices, flattened as
   * [inside, outside, inside, outside, ...], each a step straight through a wall. Replace the
   * whole array to change them (lookups are cached per array).
   */
  doors: number[]
}

/** Default tile size for maps that don't say: a few steps across, like a room-scale base. */
export const DEFAULT_METERS_PER_TILE = 2

export function createGrid(width: number, height: number, cost = 1, metersPerTile = DEFAULT_METERS_PER_TILE): Grid {
  const size = width * height
  return {
    width,
    height,
    cost: Array.from({ length: size }, () => cost),
    zone: Array.from({ length: size }, (): Zone => "outside"),
    metersPerTile,
    elevation: Array.from({ length: size }, () => 0),
    airlocksRequired: true,
    doors: [],
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

/** A step straight between inside and outside, not through an airlock. */
export const isWallCrossing = (grid: Grid, fx: number, fy: number, tx: number, ty: number) =>
  !canCrossZones(getZone(grid, fx, fy), getZone(grid, tx, ty))

/** Each doors array as a set of steps (both ways), built the first time it's needed. */
const doorSteps = new WeakMap<number[], Set<number>>()

/** True if the step between two tiles goes through one of the grid's doors (either way). */
export function isDoorway(grid: Grid, fx: number, fy: number, tx: number, ty: number) {
  if (!inBounds(grid, fx, fy) || !inBounds(grid, tx, ty)) return false
  const tiles = grid.width * grid.height
  let steps = doorSteps.get(grid.doors)
  if (!steps) {
    steps = new Set()
    for (let i = 0; i + 1 < grid.doors.length; i += 2) {
      steps.add(grid.doors[i] * tiles + grid.doors[i + 1])
      steps.add(grid.doors[i + 1] * tiles + grid.doors[i])
    }
    doorSteps.set(grid.doors, steps)
  }
  return steps.has(tileIndex(grid, fx, fy) * tiles + tileIndex(grid, tx, ty))
}

/**
 * Whether a pawn may take this step as far as zones go (see Grid.airlocksRequired). Without
 * airlocks, inside and outside connect only through doors, and a diagonal step must stay in one
 * zone so it never clips the corner of a building.
 */
export function canStepBetween(grid: Grid, fx: number, fy: number, tx: number, ty: number) {
  if (grid.airlocksRequired) return !isWallCrossing(grid, fx, fy, tx, ty)
  const zone = getZone(grid, fx, fy)
  if (getZone(grid, tx, ty) !== zone) return isDoorway(grid, fx, fy, tx, ty)
  if (fx === tx || fy === ty) return true
  return getZone(grid, tx, fy) === zone && getZone(grid, fx, ty) === zone
}

/** The steepest ground a suited astronaut will walk up or down. Steeper counts as a cliff. Game-feel. */
export const MAX_WALKABLE_SLOPE_DEG = 25

/**
 * How much longer a step between two neighbouring tiles takes because of the slope, from
 * Tobler's hiking function (W. Tobler, 1993): speed ∝ exp(−3.5 · |slope + 0.05|), an Earth
 * walking model used here as a stand-in. Steps only ever get slower (never below 1), so routes
 * stay simple to plan. Returns null for a cliff. Only ground outside has slopes: inside modules,
 * tubes and airlocks the floor is flat.
 */
export function slopeFactor(grid: Grid, fx: number, fy: number, tx: number, ty: number): number | null {
  if (getZone(grid, fx, fy) !== "outside" || getZone(grid, tx, ty) !== "outside") return 1
  if (!inBounds(grid, fx, fy) || !inBounds(grid, tx, ty)) return 1
  const rise = grid.elevation[tileIndex(grid, tx, ty)] - grid.elevation[tileIndex(grid, fx, fy)]
  if (rise === 0) return 1
  const run = Math.hypot(tx - fx, ty - fy) * grid.metersPerTile
  const slope = rise / run
  if (Math.atan(Math.abs(slope)) > (MAX_WALKABLE_SLOPE_DEG * Math.PI) / 180) return null
  const relativeSpeed = Math.exp(-3.5 * (Math.abs(slope + 0.05) - 0.05))
  return Math.max(1, 1 / relativeSpeed)
}

export const sameTile = (a: Tile, b: Tile) => a.x === b.x && a.y === b.y

/** The tile a (possibly between-tiles) position is standing on. */
export const tileOf = (pos: { x: number; y: number }): Tile => ({ x: Math.round(pos.x), y: Math.round(pos.y) })
