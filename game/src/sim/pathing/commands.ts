import { inBounds, tileOf, type Tile } from "./grid"
import { issueOrder } from "./orders"
import { pawnsAt, stationAt, type Order, type World } from "./world"

/** What a click did, so the UI can respond (highlight, show a message, play a sound). */
export type ClickResult =
  | { kind: "selected"; pawnIds: string[] }
  | { kind: "deselected" }
  /**
   * The selected crew were given an order. `started` are on their way, `queued` will do it after
   * their current orders (shift-click), `deferred` will do it once an urgent need is sorted.
   * `failed` couldn't be sent, each with a reason ready to show the player.
   */
  | {
      kind: "ordered"
      order: Order
      started: string[]
      queued: string[]
      deferred: string[]
      failed: { pawnId: string; reason: string }[]
    }
  /** None of the selected crew could be sent there. */
  | { kind: "failed"; reason: string; failed: { pawnId: string; reason: string }[] }
  /** Clicked empty ground with nobody selected. */
  | { kind: "nothing" }

export interface ClickOptions {
  /** Shift held: add to or remove from the selection, and queue orders instead of replacing them. */
  shift?: boolean
}

/** Replace the selection. Ids not on the map are ignored. */
export function selectPawns(world: World, pawnIds: string[]) {
  world.selectedPawnIds = [...new Set(pawnIds)].filter((id) => world.movers[id])
}

/**
 * Selects every pawn standing inside the box between two corner tiles (e.g. from a mouse drag).
 * With `shift`, they're added to the current selection instead of replacing it.
 */
export function selectInBox(world: World, corner1: Tile, corner2: Tile, options: ClickOptions = {}): ClickResult {
  const [x0, x1] = [Math.min(corner1.x, corner2.x), Math.max(corner1.x, corner2.x)]
  const [y0, y1] = [Math.min(corner1.y, corner2.y), Math.max(corner1.y, corner2.y)]
  const inside = Object.values(world.movers)
    .filter((m) => {
      const t = tileOf(m.pos)
      return t.x >= x0 && t.x <= x1 && t.y >= y0 && t.y <= y1
    })
    .map((m) => m.pawnId)
  selectPawns(world, options.shift ? [...world.selectedPawnIds, ...inside] : inside)
  return world.selectedPawnIds.length > 0 ? { kind: "selected", pawnIds: world.selectedPawnIds } : { kind: "deselected" }
}

/**
 * Handles a left click on a map tile, RimWorld style:
 * - on an astronaut who isn't selected → select just them (with shift → add them to the selection);
 * - on an astronaut who is already selected → deselect them (anyone else selected stays selected);
 * - with crew selected, on a station → send them all to work there (they spread round it);
 * - with crew selected, anywhere else → send them there (they spread over nearby free tiles);
 *   with shift → queue the order after what they're already doing.
 * The tile comes from the renderer turning the mouse position into tile coordinates.
 */
export function handleClick(world: World, tile: Tile, options: ClickOptions = {}): ClickResult {
  const here = pawnsAt(world, tile).map((m) => m.pawnId)
  if (here.length > 0) {
    const selectedHere = here.filter((id) => world.selectedPawnIds.includes(id))
    if (selectedHere.length > 0) {
      // Clicking a selected astronaut lets go of them (all of them, if several stand on this tile).
      selectPawns(world, world.selectedPawnIds.filter((id) => !selectedHere.includes(id)))
    } else {
      // Not selected yet: pick them, on their own or (with shift) along with the rest.
      selectPawns(world, options.shift ? [...world.selectedPawnIds, here[0]] : [here[0]])
    }
    return world.selectedPawnIds.length > 0 ? { kind: "selected", pawnIds: world.selectedPawnIds } : { kind: "deselected" }
  }

  if (world.selectedPawnIds.length === 0) return { kind: "nothing" }
  if (!inBounds(world.grid, tile.x, tile.y)) {
    const failed = world.selectedPawnIds.map((pawnId) => ({ pawnId, reason: "That's off the map." }))
    return { kind: "failed", reason: "That's off the map.", failed }
  }
  const station = stationAt(world, tile)
  const order: Order = station ? { kind: "work", stationId: station.id } : { kind: "move", target: tile }
  return orderGroup(world, world.selectedPawnIds, order, options.shift ?? false)
}

/**
 * Gives the same order to several pawns. The nearest goes first, so it gets the exact tile (or
 * best spot at a station) and the rest spread out round it.
 */
export function orderGroup(world: World, pawnIds: string[], order: Order, queue = false): ClickResult {
  const target =
    order.kind === "move" ? order.target : (world.stations.find((s) => s.id === order.stationId)?.footprint[0] ?? null)
  const distance = (id: string) => {
    const p = world.movers[id]?.pos
    return p && target ? Math.hypot(p.x - target.x, p.y - target.y) : 0
  }
  const result: Extract<ClickResult, { kind: "ordered" }> = { kind: "ordered", order, started: [], queued: [], deferred: [], failed: [] }
  for (const pawnId of [...pawnIds].sort((a, b) => distance(a) - distance(b))) {
    const r = issueOrder(world, pawnId, order, { queue })
    if (!r.ok) result.failed.push({ pawnId, reason: r.reason })
    else if (r.status === "started") result.started.push(pawnId)
    else if (r.status === "queued") result.queued.push(pawnId)
    else result.deferred.push(pawnId)
  }
  if (result.failed.length === pawnIds.length) return { kind: "failed", reason: result.failed[0]?.reason ?? "", failed: result.failed }
  return result
}

/** Right click / Escape: let go of the selected crew without giving an order. */
export function clearSelection(world: World): ClickResult {
  selectPawns(world, [])
  return { kind: "deselected" }
}
