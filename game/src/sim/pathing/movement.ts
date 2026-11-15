import type { PathingEvent, UrgentNeed } from "./events"
import { BLOCKED, canCrossZones, getZone, sameTile, slopeFactor, tileOf, type Tile } from "./grid"
import { endIdle, updateIdle } from "./idle"
import { handleUrgentNeed } from "./needs"
import { trafficAt } from "./crowd"
import { finishOrder, plan, setRoute } from "./orders"
import { isJobDone, type Station } from "./stations"
import { PATHING_TUNING, scaleFor } from "./tuning"
import { costField, costLookup, findStation, type Mover, type World } from "./world"

export interface StepOptions {
  /** Work points per game-hour a pawn puts into a station. Default 1. Hook up the crew rules here. */
  workRate?: (pawnId: string, station: Station) => number
  /**
   * Tiles per game-hour on flat normal ground before the suit slowdown. Default: walking speed
   * from PATHING_TUNING for this map's tile size (scaleFor(grid).walkTilesPerHour).
   * Hook up injuries, storms, etc. here.
   */
  walkSpeed?: (pawnId: string) => number
  /**
   * The pawn's most urgent need right now, or null. The crew rules decide what counts as urgent
   * (e.g. oxygen nearly out, starving, a solar flare → "shelter"). Default: never urgent.
   */
  urgentNeed?: (pawnId: string) => UrgentNeed | null
}

/**
 * Advances every pawn by `dtHours` of game time: dealing with urgent needs, idling (strolling
 * and chatting) when it has nothing to do, walking along its route (waiting in airlocks on the
 * way), re-planning if the route got blocked, and working at its station once it arrives.
 * Mutates the world and returns what happened.
 */
export function stepPathing(world: World, dtHours: number, options: StepOptions = {}): PathingEvent[] {
  const events: PathingEvent[] = []
  const field = costField(world)
  const walkCost = costLookup(world, field)
  const defaultSpeed = scaleFor(world.grid).walkTilesPerHour
  const walkSpeed = options.walkSpeed ?? (() => defaultSpeed)
  const workRate = options.workRate ?? (() => 1)
  const urgentNeed = options.urgentNeed ?? (() => null)
  const finishedStations = new Set<string>()

  for (const mover of Object.values(world.movers)) {
    handleUrgentNeed(world, mover, urgentNeed(mover.pawnId), field, events)
    if (mover.order || mover.interrupt) endIdle(world, mover, events)
    else updateIdle(world, mover, dtHours, field, events)

    const order = mover.order
    const station = order?.kind === "work" ? findStation(world, order.stationId) : undefined
    if (order?.kind === "work" && !station) {
      events.push({ type: "cancelled", pawnId: mover.pawnId, reason: "That's not there any more." })
      finishOrder(world, mover, events)
      continue
    }

    if (mover.status === "working" && station) {
      if (station.job) {
        station.job.workDone += workRate(mover.pawnId, station) * dtHours
        if (isJobDone(station)) finishedStations.add(station.id)
      }
      continue
    }

    const strolling = mover.idle?.kind === "wander" || mover.idle?.kind === "approach"
    const speed = walkSpeed(mover.pawnId) * (strolling ? PATHING_TUNING.strollSpeedMultiplier : 1)
    walk(world, mover, dtHours, walkCost, speed, field, events)

    if (mover.path.length > 0 || mover.waitHours > 0 || mover.status !== "moving" || !mover.order) continue
    events.push({ type: "arrived", pawnId: mover.pawnId, tile: tileOf(mover.pos) })
    if (mover.order.kind === "move") {
      finishOrder(world, mover, events)
    } else {
      mover.status = "working"
      events.push({ type: "workStarted", pawnId: mover.pawnId, stationId: mover.order.stationId })
    }
  }

  // A finished job sends everyone who worked on it back to idle.
  for (const stationId of finishedStations) {
    for (const mover of Object.values(world.movers)) {
      if (mover.order?.kind === "work" && mover.order.stationId === stationId && mover.status === "working") {
        events.push({ type: "workDone", pawnId: mover.pawnId, stationId })
        finishOrder(world, mover, events)
      }
    }
  }
  return events
}

/**
 * Spends `hours` of one pawn's time: waiting out an airlock, then walking waypoint to waypoint.
 * A tile's cost slows the pawn while it walks into that tile; a spacesuit slows it outside.
 */
function walk(
  world: World,
  mover: Mover,
  hours: number,
  walkCost: (x: number, y: number) => number,
  baseSpeed: number,
  field: number[],
  events: PathingEvent[],
) {
  let remaining = hours
  while (remaining > 0) {
    if (mover.waitHours > 0) {
      const waited = Math.min(mover.waitHours, remaining)
      mover.waitHours -= waited
      remaining -= waited
      if (mover.waitHours <= 0 && mover.cyclingTo) {
        mover.exposure = mover.cyclingTo
        mover.cyclingTo = null
        events.push({ type: "exposureChanged", pawnId: mover.pawnId, exposure: mover.exposure })
      }
      continue
    }
    if (mover.path.length === 0) return

    const next = mover.path[0]
    // The step may have become impossible since the route was planned (something built on it,
    // a module now standing where there was open ground, a changed map): plan again.
    const stepFrom = tileOf(mover.pos)
    const stepAllowed =
      sameTile(next, stepFrom) ||
      (walkCost(next.x, next.y) !== BLOCKED &&
        canCrossZones(getZone(world.grid, stepFrom.x, stepFrom.y), getZone(world.grid, next.x, next.y)) &&
        slopeFactor(world.grid, stepFrom.x, stepFrom.y, next.x, next.y) !== null)
    if (!stepAllowed) {
      if (!mover.order) {
        // Idle stroll ran into something new: just stop; idle behaviour picks something else.
        setRoute(world, mover, [tileOf(mover.pos)])
        mover.destination = null
        return
      }
      if (plan(world, mover, field)) continue
      events.push({ type: "blocked", pawnId: mover.pawnId, reason: "The way is blocked." })
      finishOrder(world, mover, events)
      return
    }

    // Standing in an airlock and heading for the side it isn't cycled to: cycle first.
    const here = tileOf(mover.pos)
    const nextZone = getZone(world.grid, next.x, next.y)
    const atCentre = mover.pos.x === here.x && mover.pos.y === here.y
    if (atCentre && getZone(world.grid, here.x, here.y) === "airlock" && nextZone !== "airlock" && nextZone !== mover.exposure) {
      mover.waitHours = PATHING_TUNING.airlockCycleHours
      mover.cyclingTo = nextZone
      events.push({ type: "airlockCycling", pawnId: mover.pawnId, tile: here, to: nextZone })
      continue
    }

    // Someone in the way? Wait for them to move, ask an idler to step aside, or go round.
    if (atCentre && !sameTile(next, here)) {
      const traffic = trafficAt(world, mover, next, field)
      if (traffic !== "go") {
        if (!mover.order) {
          // An idle stroll just stops; idle behaviour picks something else next time.
          setRoute(world, mover, [here])
          mover.destination = null
          return
        }
        if (traffic === "wait") {
          mover.yieldHours += remaining
          return
        }
        mover.avoidedTile = next
        if (plan(world, mover, field)) continue
      }
      mover.yieldHours = 0
    }

    const speed = baseSpeed * (mover.exposure === "outside" ? PATHING_TUNING.suitSpeedMultiplier : 1)
    const dx = next.x - mover.pos.x
    const dy = next.y - mover.pos.y
    // Route steps are one tile at a time, so the step began at the tile one step back from `next`.
    const from = { x: next.x - Math.sign(Math.round(dx * 1e6)), y: next.y - Math.sign(Math.round(dy * 1e6)) }
    const slope = slopeFactor(world.grid, from.x, from.y, next.x, next.y) ?? 1
    const hoursToNext = (Math.hypot(dx, dy) * Math.max(walkCost(next.x, next.y), 1) * slope) / speed
    if (remaining < hoursToNext) {
      const fraction = remaining / hoursToNext
      mover.pos = { x: mover.pos.x + dx * fraction, y: mover.pos.y + dy * fraction }
      return
    }
    mover.pos = { x: next.x, y: next.y }
    mover.path.shift()
    remaining -= hoursToNext
    reachedTile(world, mover, next, events)
  }
}

/**
 * Zone bookkeeping when a pawn reaches the centre of a tile. Normally exposure only changes
 * when an airlock finishes cycling; this catches anything else (e.g. a map edited under it).
 */
function reachedTile(world: World, mover: Mover, tile: Tile, events: PathingEvent[]) {
  const zone = getZone(world.grid, tile.x, tile.y)
  if (zone !== "airlock" && zone !== mover.exposure) {
    mover.exposure = zone
    events.push({ type: "exposureChanged", pawnId: mover.pawnId, exposure: zone })
  }
}
