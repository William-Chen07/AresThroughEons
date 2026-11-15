import { BLOCKED, type Tile } from "./grid"

/** Walking cost of a tile (BLOCKED = can't enter). Off-map tiles must return BLOCKED. */
export type CostAt = (x: number, y: number) => number

const SQRT2 = Math.SQRT2
const MAX_HEURISTIC_GOALS = 16
const DIRECTIONS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const

/** Shortest possible 8-direction distance between two tiles, ignoring obstacles. */
function octile(ax: number, ay: number, bx: number, by: number) {
  const dx = Math.abs(ax - bx)
  const dy = Math.abs(ay - by)
  return Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy)
}

/** Min-heap of tile indices ordered by a score array. */
class Heap {
  private items: number[] = []
  private scores: Float64Array
  constructor(scores: Float64Array) {
    this.scores = scores
  }
  get size() {
    return this.items.length
  }
  push(item: number) {
    const items = this.items
    items.push(item)
    let i = items.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.scores[items[parent]] <= this.scores[item]) break
      items[i] = items[parent]
      i = parent
    }
    items[i] = item
  }
  pop(): number {
    const items = this.items
    const top = items[0]
    const last = items.pop()!
    if (items.length > 0) {
      let i = 0
      const n = items.length
      for (;;) {
        const left = 2 * i + 1
        if (left >= n) break
        const right = left + 1
        const child = right < n && this.scores[items[right]] < this.scores[items[left]] ? right : left
        if (this.scores[items[child]] >= this.scores[last]) break
        items[i] = items[child]
        i = child
      }
      items[i] = last
    }
    return top
  }
}

export interface FindPathOptions {
  /** Give up after looking at this many tiles (default: every tile once). */
  maxExpansions?: number
  /** Extra rule for a single step between neighbouring tiles, e.g. "no walking straight from inside to outside". */
  canStep?: (fromX: number, fromY: number, toX: number, toY: number) => boolean
}

/**
 * A* search on the tile grid, moving in 8 directions.
 *
 * - Diagonal steps never cut a corner: both tiles beside the diagonal must be walkable.
 * - A step costs its length (1 straight, √2 diagonal) times the cost of the tile entered.
 * - `goals` may list several tiles; the path ends at whichever is cheapest to reach.
 * - `options.canStep` can forbid particular steps (used to keep inside and outside apart).
 * - The start tile is allowed even if blocked (a pawn may stand where a building just went up).
 *
 * Returns the tiles to walk through after `start`, ending on a goal ([] if already on one),
 * or null if no goal can be reached.
 */
export function findPath(
  costAt: CostAt,
  width: number,
  height: number,
  start: Tile,
  goals: Tile[],
  options: FindPathOptions = {},
): Tile[] | null {
  const size = width * height
  const index = (x: number, y: number) => y * width + x
  const goalSet = new Set<number>()
  for (const g of goals) {
    if (g.x >= 0 && g.y >= 0 && g.x < width && g.y < height && costAt(g.x, g.y) !== BLOCKED) goalSet.add(index(g.x, g.y))
  }
  const startIndex = index(start.x, start.y)
  if (goalSet.has(startIndex)) return []
  if (goalSet.size === 0) return null

  // With many goals (e.g. "any indoor tile") checking the distance to each one would cost more
  // than it saves, so the search falls back to plain nearest-first (Dijkstra) — still exact.
  const goalTiles = [...goalSet].map((i) => ({ x: i % width, y: Math.floor(i / width) }))
  const heuristic =
    goalTiles.length > MAX_HEURISTIC_GOALS
      ? () => 0
      : (x: number, y: number) => {
          let best = Infinity
          for (const g of goalTiles) best = Math.min(best, octile(x, y, g.x, g.y))
          return best
        }

  const gScore = new Float64Array(size).fill(Infinity)
  const fScore = new Float64Array(size).fill(Infinity)
  const parent = new Int32Array(size).fill(-1)
  const closed = new Uint8Array(size)
  const open = new Heap(fScore)

  gScore[startIndex] = 0
  fScore[startIndex] = heuristic(start.x, start.y)
  open.push(startIndex)

  const maxExpansions = options.maxExpansions ?? size
  const canStep = options.canStep
  let expansions = 0

  while (open.size > 0) {
    const current = open.pop()
    if (closed[current]) continue // stale heap entry
    if (goalSet.has(current)) return tracePath(parent, current, startIndex, width)
    closed[current] = 1
    if (++expansions > maxExpansions) return null

    const cx = current % width
    const cy = Math.floor(current / width)
    for (const [dx, dy] of DIRECTIONS) {
      const nx = cx + dx
      const ny = cy + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const next = index(nx, ny)
      if (closed[next]) continue
      const tileCost = costAt(nx, ny)
      if (tileCost === BLOCKED) continue
      const diagonal = dx !== 0 && dy !== 0
      if (diagonal && (costAt(cx + dx, cy) === BLOCKED || costAt(cx, cy + dy) === BLOCKED)) continue
      if (canStep && !canStep(cx, cy, nx, ny)) continue

      const tentative = gScore[current] + (diagonal ? SQRT2 : 1) * tileCost
      if (tentative >= gScore[next]) continue
      gScore[next] = tentative
      parent[next] = current
      fScore[next] = tentative + heuristic(nx, ny)
      open.push(next) // duplicates are fine; the closed check skips stale ones
    }
  }
  return null
}

function tracePath(parent: Int32Array, end: number, start: number, width: number): Tile[] {
  const path: Tile[] = []
  for (let i = end; i !== start; i = parent[i]) path.push({ x: i % width, y: Math.floor(i / width) })
  return path.reverse()
}
