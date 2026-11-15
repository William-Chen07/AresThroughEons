import { BLOCKED, inBounds, setCost, setZone, type Grid, type Tile } from "./grid"

export interface HabitatOptions {
  /** Top-left corner of the outer wall. */
  x: number
  y: number
  /** Outer size, walls included (at least 3×3 for one tile of floor). */
  width: number
  height: number
  /** Wall tiles to turn into airlocks: on an edge of the wall, not a corner. */
  airlocks: Tile[]
}

/**
 * Lays out a rectangular habitat module: a wall all round, inside floor, and airlocks set into
 * the wall. The only way in or out is through an airlock. Throws if an airlock isn't on a
 * straight stretch of wall, since a corner airlock couldn't connect inside and outside.
 */
export function buildHabitat(grid: Grid, { x, y, width, height, airlocks }: HabitatOptions) {
  if (width < 3 || height < 3) throw new Error("A habitat needs at least 3×3 tiles (walls included).")
  const right = x + width - 1
  const bottom = y + height - 1
  const onEdge = (t: Tile) => t.x === x || t.x === right || t.y === y || t.y === bottom
  const isCorner = (t: Tile) => (t.x === x || t.x === right) && (t.y === y || t.y === bottom)

  for (let ty = y; ty <= bottom; ty++) {
    for (let tx = x; tx <= right; tx++) {
      const tile = { x: tx, y: ty }
      if (!inBounds(grid, tx, ty)) continue
      setCost(grid, tile, onEdge(tile) ? BLOCKED : 1)
      setZone(grid, tile, "inside") // walls count as part of the module
    }
  }

  for (const a of airlocks) {
    const withinModule = a.x >= x && a.x <= right && a.y >= y && a.y <= bottom
    if (!withinModule || !onEdge(a) || isCorner(a)) {
      throw new Error(`Airlock at (${a.x}, ${a.y}) must be on a straight part of the habitat wall.`)
    }
    setCost(grid, a, 1)
    setZone(grid, a, "airlock")
  }
}
