import type { UrgentNeed } from "./events"
import { inBounds, type Grid, type Tile } from "./grid"

/** A job with a fixed amount of work (e.g. building a module). */
export interface StationJob {
  workRequired: number
  workDone: number
}

/**
 * Something on the map a pawn can be sent to work at: an ice drill, a greenhouse, a
 * construction site. Usually its footprint can't be walked through and the pawn stands on one
 * of the access tiles next to it while working. A walk-in station (e.g. a base module) is the
 * other way round: the pawn goes inside and works anywhere within its footprint.
 */
export interface Station {
  id: string
  /** What it is, e.g. "iceDrill" or "greenhouse". The game rules decide what working it does. */
  kind: string
  footprint: Tile[]
  accessTiles: Tile[]
  /** null = an ongoing task with no end (e.g. operating a drill): the pawn works until told otherwise. */
  job: StationJob | null
  /** Urgent needs a pawn can take care of here, e.g. ["rest"] for a bed or ["oxygen"] for an O2 tank. */
  provides: Exclude<UrgentNeed, "shelter">[]
  /** Pawns go inside to use it: its footprint stays walkable and is where they work. */
  walkIn: boolean
}

export interface StationOptions {
  id: string
  kind: string
  /** Top-left tile of the footprint. */
  x: number
  y: number
  width?: number
  height?: number
  /** Work needed to finish the job; leave out for an ongoing task. */
  workRequired?: number
  /** Urgent needs this station takes care of (beds, food and water storage, oxygen tanks). */
  provides?: Exclude<UrgentNeed, "shelter">[]
  /** Pawns go inside it to work (a building) instead of standing next to it (a machine). */
  walkIn?: boolean
}

/**
 * A rectangular station. Its access tiles are the tiles touching each side of the
 * footprint (not the diagonal corners), so a pawn always works face to face with it.
 */
export function createStation(grid: Grid, options: StationOptions): Station {
  const { id, kind, x, y, width = 1, height = 1, workRequired, provides = [], walkIn = false } = options
  const footprint: Tile[] = []
  for (let dy = 0; dy < height; dy++) for (let dx = 0; dx < width; dx++) footprint.push({ x: x + dx, y: y + dy })

  const accessTiles: Tile[] = []
  for (let dx = 0; dx < width; dx++) accessTiles.push({ x: x + dx, y: y - 1 }, { x: x + dx, y: y + height })
  for (let dy = 0; dy < height; dy++) accessTiles.push({ x: x - 1, y: y + dy }, { x: x + width, y: y + dy })

  return {
    id,
    kind,
    footprint,
    accessTiles: (walkIn ? footprint : accessTiles).filter((t) => inBounds(grid, t.x, t.y)),
    job: workRequired === undefined ? null : { workRequired, workDone: 0 },
    provides,
    walkIn,
  }
}

export const isJobDone = (station: Station) => station.job !== null && station.job.workDone >= station.job.workRequired
