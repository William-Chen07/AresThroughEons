import { BLOCKED, canCrossZones, getZone, inBounds, sameTile, slopeFactor, tileIndex, tileOf, type Tile } from "./grid"
import { findPath } from "./pathfinding"
import { PATHING_TUNING } from "./tuning"
import type { Mover, World } from "./world"

/** Standing still: no route left, or waiting (e.g. in an airlock). */
export const isStanding = (m: Mover) => m.path.length === 0 || m.waitHours > 0

/** Idle with nothing important going on (pausing or strolling), so it can be asked to step aside. */
const canStepAside = (m: Mover) =>
  m.order === null && m.interrupt === null && m.waitHours === 0 && (m.idle === null || m.idle.kind === "pause" || m.idle.kind === "wander")

/** Indexes of tiles where someone other than `except` is standing. */
export function standingTiles(world: World, except?: Mover): Set<number> {
  const tiles = new Set<number>()
  for (const m of Object.values(world.movers)) {
    if (m === except || !isStanding(m)) continue
    const t = tileOf(m.pos)
    if (inBounds(world.grid, t.x, t.y)) tiles.add(tileIndex(world.grid, t.x, t.y))
  }
  return tiles
}

/** Someone else is standing on the tile, or is going to end up there. */
export function isTileTaken(world: World, tile: Tile, except: Mover) {
  return Object.values(world.movers).some(
    (m) =>
      m !== except &&
      ((m.destination !== null && sameTile(m.destination, tile)) || (isStanding(m) && sameTile(tileOf(m.pos), tile))),
  )
}

/** The other pawn on (or stepping into) a tile, if any. */
function occupantOf(world: World, tile: Tile, except: Mover): Mover | undefined {
  return Object.values(world.movers).find(
    (m) => m !== except && (sameTile(tileOf(m.pos), tile) || (m.path.length > 0 && sameTile(m.path[0], tile) && m.waitHours === 0)),
  )
}

/** How far (in tiles) an idle pawn will move to get out of someone's way. */
const STEP_ASIDE_RADIUS = 3

/**
 * Moves an idle pawn to the nearest free spot off the walker's route (e.g. out of a doorway,
 * possibly through it). Returns false if there's nowhere free to go.
 */
function stepAside(world: World, idler: Mover, walker: Mover, field: number[]): boolean {
  const { grid } = world
  const here = tileOf(idler.pos)
  const zone = getZone(grid, here.x, here.y)
  const keepClear = [tileOf(walker.pos), ...walker.path]
  const goals: Tile[] = []
  for (let dy = -STEP_ASIDE_RADIUS; dy <= STEP_ASIDE_RADIUS; dy++) {
    for (let dx = -STEP_ASIDE_RADIUS; dx <= STEP_ASIDE_RADIUS; dx++) {
      const t = { x: here.x + dx, y: here.y + dy }
      if ((dx === 0 && dy === 0) || !inBounds(grid, t.x, t.y) || field[tileIndex(grid, t.x, t.y)] === BLOCKED) continue
      if (getZone(grid, t.x, t.y) !== zone || keepClear.some((k) => sameTile(k, t)) || isTileTaken(world, t, idler)) continue
      goals.push(t)
    }
  }
  const costAt = (x: number, y: number) => (inBounds(grid, x, y) ? field[tileIndex(grid, x, y)] : BLOCKED)
  const canStep = (fx: number, fy: number, tx: number, ty: number) => canCrossZones(getZone(grid, fx, fy), getZone(grid, tx, ty))
  const stepFactor = (fx: number, fy: number, tx: number, ty: number) => slopeFactor(grid, fx, fy, tx, ty)
  const path = findPath(costAt, grid.width, grid.height, here, goals, { canStep, stepFactor })
  if (!path || path.length === 0 || path.length > STEP_ASIDE_RADIUS + 1) return false
  idler.path = path
  idler.destination = null // it isn't claiming the spot, just getting out of the way
  idler.idle = { kind: "pause", hoursLeft: PATHING_TUNING.pauseHours.min } // then carry on idling
  return true
}

/**
 * What a pawn at a tile centre should do before stepping into `next`:
 * - "go": the way is clear, or it's a head-on meeting / long wait, so squeeze past;
 * - "wait": someone is moving out of the way (or was just asked to step aside);
 * - "replan": someone is standing there; look for a way round.
 */
export function trafficAt(world: World, walker: Mover, next: Tile, field: number[]): "go" | "wait" | "replan" {
  const other = occupantOf(world, next, walker)
  if (!other) return "go"
  if (walker.yieldHours > PATHING_TUNING.maxYieldHours) return "go"

  if (!isStanding(other)) {
    // Coming straight at us: squeezing past is the only way out of a one-tile corridor.
    const headOn = other.path.length > 0 && sameTile(other.path[0], tileOf(walker.pos))
    return headOn ? "go" : "wait"
  }
  if (canStepAside(other) && stepAside(world, other, walker, field)) return "wait"
  if (walker.avoidedTile && sameTile(walker.avoidedTile, next)) return "go" // already looked for a way round
  return "replan"
}
