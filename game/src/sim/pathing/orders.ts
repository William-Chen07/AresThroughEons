import { isTileTaken, standingTiles } from "./crowd"
import type { PathingEvent } from "./events"
import { findPath } from "./pathfinding"
import { BLOCKED, canCrossZones, getZone, inBounds, tileIndex, tileOf, type Tile } from "./grid"
import { isJobDone } from "./stations"
import { AIRLOCK_ROUTE_COST, PATHING_TUNING } from "./tuning"
import { costField, costLookup, findStation, type Mover, type Order, type World } from "./world"

/**
 * - started: the pawn is on its way.
 * - deferred: it's busy with an urgent need; it'll do this once that's sorted.
 * - queued: added after the orders it already has (shift-click).
 * - not ok: it can't be done; `reason` is ready to show the player.
 */
export type OrderResult =
  | { ok: true; status: "started"; destination: Tile }
  | { ok: true; status: "deferred" | "queued" }
  | { ok: false; reason: string }

export interface IssueOptions {
  /** Add to the end of the pawn's order queue instead of replacing what it's doing. */
  queue?: boolean
}

export function stopMover(mover: Mover) {
  mover.status = "idle"
  mover.order = null
  mover.path = []
  mover.destination = null
  mover.avoidedTile = null
  mover.yieldHours = 0
}

/**
 * Pathfinding inputs for the world as it is now: walkable costs plus the inside/outside rules.
 * Planning for a pawn (`forMover`) also makes tiles where crewmates stand cost a bit more.
 */
export function routing(world: World, field = costField(world), forMover?: Mover) {
  const { grid } = world
  const walkCost = costLookup(world, field)
  const standing = forMover ? standingTiles(world, forMover) : null
  return {
    // Route cost: walking cost, plus airlock cycling time, plus going round standing crewmates.
    costAt: (x: number, y: number) => {
      let cost = walkCost(x, y)
      if (cost === BLOCKED) return cost
      if (getZone(grid, x, y) === "airlock") cost += AIRLOCK_ROUTE_COST
      if (standing?.has(tileIndex(grid, x, y))) cost += PATHING_TUNING.standingCrewmateCost
      return cost
    },
    canStep: (fx: number, fy: number, tx: number, ty: number) =>
      canCrossZones(getZone(grid, fx, fy), getZone(grid, tx, ty)),
  }
}

/**
 * Free tiles round a target (same zone, walkable, nobody there or heading there), in rings:
 * the tiles touching it first, then the next ring out, and so on. Each ring is tried before the
 * next, so a pawn takes the closest free spot rather than whichever is quickest to walk to.
 */
function freeRingsAround(world: World, mover: Mover, target: Tile, field: number[]): Tile[][] {
  const zone = getZone(world.grid, target.x, target.y)
  const rings: Tile[][] = []
  for (let r = 1; r <= PATHING_TUNING.groupSpreadRadius; r++) {
    const ring: Tile[] = []
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
        const t = { x: target.x + dx, y: target.y + dy }
        if (!inBounds(world.grid, t.x, t.y) || field[tileIndex(world.grid, t.x, t.y)] === BLOCKED) continue
        if (getZone(world.grid, t.x, t.y) !== zone || isTileTaken(world, t, mover)) continue
        ring.push(t)
      }
    }
    if (ring.length > 0) rings.push(ring)
  }
  return rings
}

/**
 * Tiles a pawn may end up on for an order, best first.
 * - Move: the tile itself, or if a crewmate is there / heading there, the nearest free tiles round it.
 * - Work: access tiles that no other pawn is already heading to come first, so a crew spreads
 *   around a station.
 */
function goalsFor(world: World, mover: Mover, order: Order, field: number[]): { goals: Tile[][]; error?: string } {
  if (order.kind === "move") {
    if (!isTileTaken(world, order.target, mover)) return { goals: [[order.target]] }
    return { goals: [...freeRingsAround(world, mover, order.target, field), [order.target]] }
  }
  const station = findStation(world, order.stationId)
  if (!station) return { goals: [], error: "That's not there any more." }
  if (isJobDone(station)) return { goals: [], error: "That job is already finished." }
  const free = station.accessTiles.filter((t) => !isTileTaken(world, t, mover))
  return { goals: free.length > 0 ? [free, station.accessTiles] : [station.accessTiles] }
}

/** Gives the mover a route, and calls off an airlock cycle the new route turns back from. */
export function setRoute(world: World, mover: Mover, path: Tile[]) {
  mover.path = path
  mover.destination = path.length > 0 ? path[path.length - 1] : tileOf(mover.pos)
  if (mover.cyclingTo) {
    const first = path[0]
    if (!first || getZone(world.grid, first.x, first.y) !== mover.cyclingTo) {
      mover.cyclingTo = null
      mover.waitHours = 0
    }
  }
}

/** Plans a route for the mover's current order. Returns false if nothing is reachable. */
export function plan(world: World, mover: Mover, field = costField(world)): boolean {
  if (!mover.order) return false
  const { goals } = goalsFor(world, mover, mover.order, field)
  const { costAt, canStep } = routing(world, field, mover)
  const start = tileOf(mover.pos)
  for (const group of goals) {
    const path = findPath(costAt, world.grid.width, world.grid.height, start, group, { canStep })
    if (path) {
      setRoute(world, mover, path)
      return true
    }
  }
  return false
}

/** Why an order can't be carried out at all, or null if it might be. */
function orderProblem(world: World, mover: Mover, order: Order, field: number[]): string | null {
  const { error } = goalsFor(world, mover, order, field)
  if (error) return error
  if (order.kind === "move" && costLookup(world, field)(order.target.x, order.target.y) === BLOCKED) {
    return "Nobody can stand there."
  }
  return null
}

/**
 * Sets an order and plans it right away, ignoring urgent needs and the queue (used for the
 * needs' own orders and when resuming). On failure the mover is left exactly as it was.
 */
export function assignOrder(world: World, mover: Mover, order: Order): { ok: true; destination: Tile } | { ok: false; reason: string } {
  const field = costField(world)
  const problem = orderProblem(world, mover, order, field)
  if (problem) return { ok: false, reason: problem }
  const previous = { ...mover, path: mover.path.slice() }
  mover.order = order
  mover.avoidedTile = null
  mover.yieldHours = 0
  if (!plan(world, mover, field)) {
    Object.assign(mover, previous)
    return { ok: false, reason: "There's no way to get there." }
  }
  mover.status = "moving"
  return { ok: true, destination: mover.destination! }
}

/**
 * The current order is over (done, blocked or cancelled): start the next queued one that can
 * be done, or stand still on the current tile if there's nothing left.
 */
export function finishOrder(world: World, mover: Mover, events: PathingEvent[]) {
  stopMover(mover)
  while (mover.queue.length > 0) {
    const next = mover.queue.shift()!
    const result = assignOrder(world, mover, next)
    if (result.ok) return
    events.push({ type: "cancelled", pawnId: mover.pawnId, reason: result.reason })
  }
  const here = tileOf(mover.pos)
  if (mover.pos.x !== here.x || mover.pos.y !== here.y) setRoute(world, mover, [here])
  mover.destination = null
}

/**
 * The player tells a pawn what to do. Normally this replaces its order and clears its queue;
 * with `queue: true` it's added after what it already has. If an urgent need has taken over,
 * the order is checked and saved for when the need is met.
 * On failure the pawn keeps doing what it was doing and `reason` says why, in plain words.
 */
export function issueOrder(world: World, pawnId: string, order: Order, options: IssueOptions = {}): OrderResult {
  const mover = world.movers[pawnId]
  if (!mover) return { ok: false, reason: "That crewmate isn't on the map." }
  const field = costField(world)
  const problem = orderProblem(world, mover, order, field)
  if (problem) return { ok: false, reason: problem }

  if (mover.interrupt) {
    if (!options.queue) {
      mover.interrupt.resume = order
      mover.queue = []
    } else if (mover.interrupt.resume === null) {
      mover.interrupt.resume = order
    } else {
      mover.queue.push(order)
    }
    return { ok: true, status: "deferred" }
  }
  if (options.queue && mover.order) {
    mover.queue.push(order)
    return { ok: true, status: "queued" }
  }

  const result = assignOrder(world, mover, order)
  if (!result.ok) return result
  if (!options.queue) mover.queue = []
  return { ok: true, status: "started", destination: result.destination }
}

/**
 * The player stops a pawn: its order and queue are dropped and it settles on the tile it's on.
 * An urgent need it's dealing with carries on; only what it would have done afterwards is dropped.
 */
export function cancelOrder(world: World, pawnId: string) {
  const mover = world.movers[pawnId]
  if (!mover) return
  mover.queue = []
  if (mover.interrupt) {
    mover.interrupt.resume = null
    return
  }
  stopMover(mover)
  setRoute(world, mover, [tileOf(mover.pos)])
  mover.destination = null
}

