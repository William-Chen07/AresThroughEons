import type { PathingEvent, UrgentNeed } from "./events"
import { BLOCKED, getZone, sameTile, tileOf, type Tile } from "./grid"
import { assignOrder, finishOrder, routing } from "./orders"
import { findPath } from "./pathfinding"
import { isJobDone } from "./stations"
import type { Mover, World } from "./world"

/**
 * Which indoor tiles a pawn may shelter on (e.g. not a room someone else already has to
 * themselves). Default: any indoor tile.
 */
export type ShelterRule = (pawnId: string, tile: Tile) => boolean
const anyShelter: ShelterRule = () => true

/**
 * Safe from a solar flare: inside (an airlock cycled to the inside counts), not about to cycle
 * out, not planning to walk outside, and somewhere it may shelter (where it's heading, if moving).
 */
function isSheltered(world: World, mover: Mover, canShelterAt: ShelterRule = anyShelter) {
  return (
    mover.exposure === "inside" &&
    mover.cyclingTo !== "outside" &&
    !mover.path.some((t) => getZone(world.grid, t.x, t.y) === "outside") &&
    canShelterAt(mover.pawnId, mover.destination ?? tileOf(mover.pos))
  )
}

/** Route to the nearest indoor floor tile the pawn may shelter on. */
function findShelter(world: World, mover: Mover, field: number[], canShelterAt: ShelterRule): Tile[] | null {
  const { grid } = world
  const goals: Tile[] = []
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (grid.zone[y * grid.width + x] !== "inside" || field[y * grid.width + x] === BLOCKED) continue
      if (canShelterAt(mover.pawnId, { x, y })) goals.push({ x, y })
    }
  }
  const { costAt, rules } = routing(world, field, mover)
  return findPath(costAt, grid.width, grid.height, tileOf(mover.pos), goals, rules)
}

/** Nearest station that takes care of the need, if one can be reached. */
function findNeedStation(world: World, mover: Mover, need: Exclude<UrgentNeed, "shelter">, field: number[]) {
  const candidates = world.stations.filter((s) => s.provides.includes(need) && !isJobDone(s))
  const goals = candidates.flatMap((s) => s.accessTiles)
  if (goals.length === 0) return null
  const { costAt, rules } = routing(world, field, mover)
  const path = findPath(costAt, world.grid.width, world.grid.height, tileOf(mover.pos), goals, rules)
  if (!path) return null
  const end = path.length > 0 ? path[path.length - 1] : tileOf(mover.pos)
  return candidates.find((s) => s.accessTiles.some((t) => sameTile(t, end))) ?? null
}

/** Puts the pawn to work on the need. Returns the station id (null for shelter), or a reason it can't. */
function startFixing(world: World, mover: Mover, need: UrgentNeed, field: number[], canShelterAt: ShelterRule) {
  if (need === "shelter") {
    const path = findShelter(world, mover, field, canShelterAt)
    if (!path) return { ok: false as const, reason: "There's nowhere inside to shelter." }
    const target = path.length > 0 ? path[path.length - 1] : tileOf(mover.pos)
    const result = assignOrder(world, mover, { kind: "move", target })
    return result.ok ? { ok: true as const, stationId: null } : result
  }
  const station = findNeedStation(world, mover, need, field)
  if (!station) return { ok: false as const, reason: `Nothing to take care of ${need} can be reached.` }
  const result = assignOrder(world, mover, { kind: "work", stationId: station.id })
  return result.ok ? { ok: true as const, stationId: station.id } : result
}

/**
 * Called each step with the pawn's most urgent need right now (from the crew rules), or null.
 *
 * - A new urgent need sets the player's order aside and sends the pawn to fix it: the nearest
 *   station that provides it, or the nearest indoor tile for "shelter".
 * - The pawn stays there while the need is still reported.
 * - When it's no longer reported, the set-aside order is picked back up.
 * - A pawn already safely inside doesn't need to move for "shelter".
 */
export function handleUrgentNeed(
  world: World,
  mover: Mover,
  need: UrgentNeed | null,
  field: number[],
  events: PathingEvent[],
  canShelterAt: ShelterRule = anyShelter,
) {
  const current = mover.interrupt

  if (need === null) {
    mover.unmetNeed = null
    if (!current) return
    mover.interrupt = null
    let resumed = false
    if (current.resume) {
      const result = assignOrder(world, mover, current.resume)
      resumed = result.ok
      if (!result.ok) {
        events.push({ type: "cancelled", pawnId: mover.pawnId, reason: result.reason })
        finishOrder(world, mover, events) // on to whatever is queued next
      }
    } else {
      finishOrder(world, mover, events) // queued orders, or settle on the tile it's on
    }
    events.push({ type: "needMet", pawnId: mover.pawnId, need: current.need, resumed })
    return
  }

  // Already on it: heading to or using the right station, or sheltering safely.
  if (current?.need === need) {
    if (need !== "shelter") {
      if (mover.order !== null) return
    } else if (isSheltered(world, mover, canShelterAt) || (mover.order !== null && mover.exposure !== "inside")) {
      // Sheltering, or still on the way in. Once inside, shelter it may no longer use (someone else
      // took that room) means looking again.
      return
    }
  }
  // Indoors and staying indoors: a flare needs no change of plan.
  if (need === "shelter" && !current && isSheltered(world, mover, canShelterAt)) return
  // Reported once already; wait for the need to change before trying again.
  if (mover.unmetNeed === need) return

  const resume = current ? current.resume : mover.order
  const result = startFixing(world, mover, need, field, canShelterAt)
  if (!result.ok) {
    mover.unmetNeed = need
    events.push({ type: "needUnmet", pawnId: mover.pawnId, need, reason: result.reason })
    return
  }
  mover.interrupt = { need, resume }
  mover.unmetNeed = null
  events.push({ type: "needInterrupt", pawnId: mover.pawnId, need, stationId: result.stationId })
}
