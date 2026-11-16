import type { ResourceId } from "@/content/resources"
import { createRng } from "@/sim/rng"
import { MAX_WALKABLE_SLOPE_DEG } from "@/sim/pathing"

/*
 * Mineral deposits on the base map, as pure logic: where they go, and what
 * mining takes out of them. Generated once per landing site from the real
 * Mars data the map is built from (see map/marsTrek.ts), with a seed, so the
 * same site always gets the same deposits.
 *
 * Distance from the landing site decides which minerals can be where:
 *   - nothing within CLEAR_RADIUS of the lander;
 *   - aluminum and copper in the middle ring;
 *   - titanium and gold in the outer ring, out to the edge of the map;
 *   - sulfur anywhere outside the clear zone.
 * Within its ring, each mineral prefers the kind of ground it's found in:
 *   - titanium: dark ground, like basalt (titanium is in the dark mineral ilmenite);
 *   - aluminum: flat plains;
 *   - copper and gold: slopes and crater rims, where hot water once moved metals
 *     (a game rule: no copper or gold deposit has been found on Mars);
 *   - sulfur: bright, light-toned ground, like sulfate-rich deposits.
 * How rich a site is overall can come from NASA's global mineral maps (see
 * data/mineralMaps.ts): a `richness` above 1 means more and bigger deposits.
 *
 * Each deposit is a clump of CLUMP × CLUMP cells around its middle cell. The
 * whole clump is on ground the crew can walk to from the lander, under the same
 * slope rule they walk by (see sim/pathing/grid.ts), with room beside it to
 * stand and mine.
 */

export type MineralId = Extract<ResourceId, "aluminum" | "copper" | "titanium" | "gold" | "sulfur">

export interface Deposit {
  id: string
  mineral: MineralId
  /** The middle cell of its clump (see CLUMP). Crew mine it from a cell beside the clump. */
  col: number
  row: number
  /** How much is left to mine. */
  amount: number
  /** How much it started with. */
  start: number
}

/** The parts of the map's terrain generation needs (the map's VoxelTerrain fits). */
export interface DepositTerrain {
  /** Cells per side; cell (col, row) is at index row * size + col. */
  size: number
  metersPerCell: number
  /** Ground height of each cell in metres. */
  metres: ArrayLike<number>
  /** Average colour of each cell: red, green, blue. */
  colors: ArrayLike<number>
}

/** Cells around the landing site with no deposits at all (about 2.6 km). */
export const CLEAR_RADIUS = 16
/** The middle ring, in cells from the landing site: aluminum and copper. */
export const MIDDLE_RING = { min: CLEAR_RADIUS, max: 44 }
/** The outer ring starts here and runs to the edge of the map: titanium and gold. */
export const OUTER_RING_MIN = 52
/** A deposit is a clump this many cells a side, around its middle cell. */
export const CLUMP = 3
const HALF = Math.floor(CLUMP / 2)
/** A clump's middle stays this many cells in from the map's edge, so there's room to stand beside it. */
const EDGE_MARGIN = HALF + 2
/** No two deposits' middles closer than this, in cells: clumps always have a gap between them. */
const MIN_SPACING = CLUMP + 4

/** Every cell of a clump, given its middle cell (offsets row by row). */
export function clumpCells(middle: { col: number; row: number }): { col: number; row: number }[] {
  const cells: { col: number; row: number }[] = []
  for (let dr = -HALF; dr <= HALF; dr++) for (let dc = -HALF; dc <= HALF; dc++) cells.push({ col: middle.col + dc, row: middle.row + dr })
  return cells
}

type Zone = "middle" | "outer" | "anywhere"

interface MineralRule {
  zone: Zone
  /** How many deposits a site of normal richness gets. */
  count: number
  /** How much each holds, before richness. */
  amount: { min: number; max: number }
  /** How much one astronaut mines per game-hour at normal work speed. */
  perHour: number
  /** How well a cell suits it, from 0 to 1. */
  suits: (cell: CellFeatures) => number
}

interface CellFeatures {
  /** 0 = darkest ground on this map, 1 = brightest. */
  brightness: number
  /** The steepest slope to a neighbour, in degrees. */
  slope: number
}

/** The rules for each mineral. Game numbers to tune, not real figures. */
export const MINERAL_RULES: Record<MineralId, MineralRule> = {
  aluminum: {
    zone: "middle",
    count: 6,
    amount: { min: 30, max: 60 },
    perHour: 3,
    suits: ({ slope }) => 1 - Math.min(1, slope / 8),
  },
  copper: {
    zone: "middle",
    count: 5,
    amount: { min: 20, max: 45 },
    perHour: 2,
    suits: ({ slope }) => Math.min(1, slope / 15),
  },
  titanium: {
    zone: "outer",
    count: 5,
    amount: { min: 20, max: 40 },
    perHour: 1.5,
    suits: ({ brightness }) => 1 - brightness,
  },
  gold: {
    zone: "outer",
    count: 3,
    amount: { min: 8, max: 16 },
    perHour: 0.5,
    suits: ({ slope }) => Math.min(1, slope / 15),
  },
  sulfur: {
    zone: "anywhere",
    count: 7,
    amount: { min: 25, max: 50 },
    perHour: 3,
    suits: ({ brightness }) => brightness,
  },
}

/** Placed in this order, so the rarest get first pick of the best ground. */
const PLACING_ORDER: MineralId[] = ["gold", "titanium", "copper", "aluminum", "sulfur"]

export const MINERALS: MineralId[] = ["aluminum", "copper", "titanium", "gold", "sulfur"]

/** How rich a site is in each mineral, from 0.5 to 1.5; 1 is normal. */
export type Richness = Record<MineralId, number>
export const NORMAL_RICHNESS: Richness = { aluminum: 1, copper: 1, titanium: 1, gold: 1, sulfur: 1 }

/** A whole-number seed from any text, e.g. the landing site, so a site always gets the same deposits. */
export function seedFrom(text: string) {
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619)
  return hash >>> 0
}

const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const

/** Whether the step between two neighbouring cells is walkable (not a cliff), as the crew's pathing judges it. */
function walkable(terrain: DepositTerrain, a: number, b: number, diagonal: boolean) {
  const run = terrain.metersPerCell * (diagonal ? Math.SQRT2 : 1)
  return Math.atan(Math.abs(terrain.metres[a] - terrain.metres[b]) / run) <= (MAX_WALKABLE_SLOPE_DEG * Math.PI) / 180
}

/**
 * Every cell the crew could walk to from beside the landing site without climbing a cliff
 * (1 = reachable). The lander itself (`blocked`) can't be walked through.
 */
export function reachableFrom(terrain: DepositTerrain, center: { col: number; row: number }, blocked: (i: number) => boolean) {
  const { size } = terrain
  const reached = new Uint8Array(size * size)
  const queue: number[] = []
  for (let dr = -3; dr <= 3; dr++) {
    for (let dc = -3; dc <= 3; dc++) {
      const col = center.col + dc
      const row = center.row + dr
      const i = row * size + col
      if (col < 0 || row < 0 || col >= size || row >= size || blocked(i) || reached[i]) continue
      reached[i] = 1
      queue.push(i)
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head]
    const col = i % size
    const row = (i - col) / size
    for (const [dc, dr] of NEIGHBOURS) {
      const c = col + dc
      const r = row + dr
      const n = r * size + c
      if (c < 0 || r < 0 || c >= size || r >= size || reached[n] || blocked(n)) continue
      if (!walkable(terrain, i, n, dc !== 0 && dr !== 0)) continue
      reached[n] = 1
      queue.push(n)
    }
  }
  return reached
}

/** Brightness (0–1, relative to this map) and steepest slope (degrees) of every cell. */
function featuresOf(terrain: DepositTerrain): CellFeatures[] {
  const { size, colors, metres, metersPerCell } = terrain
  const light = new Float32Array(size * size)
  let lo = Infinity
  let hi = -Infinity
  for (let i = 0; i < size * size; i++) {
    light[i] = 0.299 * colors[i * 3] + 0.587 * colors[i * 3 + 1] + 0.114 * colors[i * 3 + 2]
    lo = Math.min(lo, light[i])
    hi = Math.max(hi, light[i])
  }
  const features: CellFeatures[] = []
  for (let i = 0; i < size * size; i++) {
    const col = i % size
    const row = (i - col) / size
    let slope = 0
    for (const [dc, dr] of NEIGHBOURS) {
      const c = col + dc
      const r = row + dr
      if (c < 0 || r < 0 || c >= size || r >= size) continue
      const run = metersPerCell * (dc !== 0 && dr !== 0 ? Math.SQRT2 : 1)
      slope = Math.max(slope, (Math.atan(Math.abs(metres[i] - metres[r * size + c]) / run) * 180) / Math.PI)
    }
    features.push({ brightness: hi > lo ? (light[i] - lo) / (hi - lo) : 0.5, slope })
  }
  return features
}

/** Whether a cell at `distance` cells from the landing site is in a zone. */
function inZone(zone: Zone, distance: number) {
  if (distance < CLEAR_RADIUS) return false
  if (zone === "middle") return distance <= MIDDLE_RING.max
  if (zone === "outer") return distance >= OUTER_RING_MIN
  return true
}

/**
 * The deposits for a map: each mineral's count (scaled by `richness`) placed in its zone, on the
 * ground that suits it best, reachable on foot and spread apart. `center` is the landing site;
 * `blocked` cells (the lander) are never used. The same inputs always give the same deposits.
 */
export function generateDeposits(
  terrain: DepositTerrain,
  center: { col: number; row: number },
  seed: number,
  richness: Richness = NORMAL_RICHNESS,
  blocked: (i: number) => boolean = () => false,
): Deposit[] {
  const { size } = terrain
  const rng = createRng(seed)
  const features = featuresOf(terrain)
  const reached = reachableFrom(terrain, center, blocked)
  const placed: Deposit[] = []

  /**
   * A clump can go around a middle cell if it's on the map with room around it, every cell of it
   * is ground the crew can walk to, and a cell just outside it (where a miner stands) is
   * reachable with no cliff between it and the clump.
   */
  const usable = (i: number) => {
    const col = i % size
    const row = (i - col) / size
    if (col < EDGE_MARGIN || row < EDGE_MARGIN || col >= size - EDGE_MARGIN || row >= size - EDGE_MARGIN) return false
    const cells = clumpCells({ col, row }).map((c) => c.row * size + c.col)
    if (cells.some((c) => blocked(c) || reached[c] !== 1)) return false
    const inside = new Set(cells)
    return cells.some((c) =>
      [c - 1, c + 1, c - size, c + size].some((n) => !inside.has(n) && reached[n] === 1 && walkable(terrain, c, n, false)),
    )
  }
  /** How well a whole clump suits a mineral: the average over its cells. */
  const clumpSuits = (rule: MineralRule, i: number) => {
    const cells = clumpCells({ col: i % size, row: Math.floor(i / size) })
    return cells.reduce((sum, c) => sum + rule.suits(features[c.row * size + c.col]), 0) / cells.length
  }
  const farEnough = (col: number, row: number) =>
    placed.every((d) => Math.hypot(d.col - col, d.row - row) >= MIN_SPACING)

  for (const mineral of PLACING_ORDER) {
    const rule = MINERAL_RULES[mineral]
    const rich = Math.min(1.5, Math.max(0.5, richness[mineral]))
    const count = Math.max(1, Math.round(rule.count * rich))
    // Candidates with a weight: always some chance, much more on ground that suits the mineral.
    const candidates: { i: number; weight: number }[] = []
    for (let i = 0; i < size * size; i++) {
      const col = i % size
      const row = (i - col) / size
      if (!inZone(rule.zone, Math.hypot(col - center.col, row - center.row)) || !usable(i)) continue
      const suit = clumpSuits(rule, i)
      candidates.push({ i, weight: 0.05 + suit * suit })
    }
    for (let n = 0; n < count && candidates.length > 0; n++) {
      // Weighted pick, skipping cells too close to a deposit already placed.
      let total = 0
      for (const c of candidates) total += c.weight
      let pick = -1
      for (let tries = 0; tries < 50 && pick < 0; tries++) {
        let roll = rng.next() * total
        for (let k = 0; k < candidates.length; k++) {
          roll -= candidates[k].weight
          if (roll > 0) continue
          const i = candidates[k].i
          if (farEnough(i % size, Math.floor(i / size))) pick = k
          break
        }
      }
      if (pick < 0) pick = candidates.findIndex((c) => farEnough(c.i % size, Math.floor(c.i / size)))
      if (pick < 0) break
      const { i } = candidates.splice(pick, 1)[0]
      const amount = Math.round((rule.amount.min + rng.next() * (rule.amount.max - rule.amount.min)) * rich)
      placed.push({ id: `${mineral}-${n + 1}`, mineral, col: i % size, row: Math.floor(i / size), amount, start: amount })
    }
  }
  return placed
}

/** The deposit whose clump covers a cell, if any (and not mined out). */
export function depositAt(deposits: readonly Deposit[], cell: { col: number; row: number }) {
  return deposits.find((d) => Math.abs(d.col - cell.col) <= HALF && Math.abs(d.row - cell.row) <= HALF && d.amount > 0)
}

/** Station ids for deposits on the crew's map (see sim/pathing/stations.ts). */
export const depositStationId = (depositId: string) => `deposit:${depositId}`
export const depositIdOf = (stationId: string) => (stationId.startsWith("deposit:") ? stationId.slice(8) : null)

/**
 * `hours` of mining: each miner takes MINERAL_RULES[mineral].perHour × `speed` per game-hour from
 * the deposit they're at. Nobody can take more than is left (two miners share what remains).
 * Returns the deposits left (mined-out ones removed) and how much of each mineral was mined.
 */
export function mine(
  deposits: readonly Deposit[],
  miners: readonly { depositId: string; speed: number }[],
  hours: number,
): { deposits: Deposit[]; mined: Partial<Record<MineralId, number>> } {
  const left = new Map(deposits.map((d) => [d.id, { ...d }]))
  const mined: Partial<Record<MineralId, number>> = {}
  for (const miner of miners) {
    const deposit = left.get(miner.depositId)
    if (!deposit || deposit.amount <= 0 || hours <= 0) continue
    const take = Math.min(deposit.amount, MINERAL_RULES[deposit.mineral].perHour * Math.max(0, miner.speed) * hours)
    deposit.amount -= take
    mined[deposit.mineral] = (mined[deposit.mineral] ?? 0) + take
  }
  return { deposits: [...left.values()].filter((d) => d.amount > 1e-6), mined }
}
