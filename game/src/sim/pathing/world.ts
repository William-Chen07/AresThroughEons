import { BLOCKED, createGrid, getCost, getZone, inBounds, sameTile, tileIndex, tileOf, type Grid, type Tile } from "./grid"
import type { UrgentNeed } from "./events"
import type { Station } from "./stations"

/**
 * What a pawn does on its own when it has no order: pause, stroll about its area, or chat with a
 * nearby idle crewmate (walking over to them, or waiting for them to arrive).
 */
export type IdleActivity =
  | { kind: "pause"; hoursLeft: number }
  | { kind: "wander" }
  | { kind: "approach"; partnerId: string }
  | { kind: "waitForChat"; partnerId: string; hoursLeft: number }
  | { kind: "chat"; partnerId: string; hoursLeft: number }

/** What a pawn has been told to do. */
export type Order =
  /** Walk to a tile and stop there. */
  | { kind: "move"; target: Tile }
  /** Walk to a station and work at it. */
  | { kind: "work"; stationId: string }

export type MoverStatus = "idle" | "moving" | "working"

/** Where one pawn is and what it's doing on the map. Keyed by the pawn's id. */
export interface Mover {
  pawnId: string
  /** Position in tile units. Whole numbers are tile centres; in between while walking. */
  pos: { x: number; y: number }
  status: MoverStatus
  order: Order | null
  /** Tiles still to walk through, next one first. */
  path: Tile[]
  /** The tile the pawn is heading for (the access tile it picked, for a work order). */
  destination: Tile | null
  /**
   * Inside the habitat or out on the surface (EVA). In an airlock it's whichever side the
   * airlock was last cycled to.
   */
  exposure: "inside" | "outside"
  /** Game-hours left standing still, e.g. while an airlock cycles. */
  waitHours: number
  /** While cycling an airlock: the side it's cycling to. Exposure switches when the wait ends. */
  cyclingTo: "inside" | "outside" | null
  /**
   * Set while an urgent need has taken over: which need, and the player's order to pick back up
   * once it's met (null if the pawn had nothing to do).
   */
  interrupt: { need: UrgentNeed; resume: Order | null } | null
  /** A need that couldn't be met, so "needUnmet" is only reported once. */
  unmetNeed: UrgentNeed | null
  /** What it's doing on its own while it has no order; null while it has one. */
  idle: IdleActivity | null
  /** Where it became idle: it wanders around here. */
  anchor: Tile | null
  /** Game-hours before it will start another chat. */
  chatCooldownHours: number
  /** Orders to carry out after the current one, in order (shift-click). */
  queue: Order[]
  /** Game-hours spent waiting for a crewmate ahead to move out of the way. */
  yieldHours: number
  /** A tile it already re-planned around because someone stood on it, so it doesn't re-plan forever. */
  avoidedTile: Tile | null
}

/** Everything the pathing system needs. Plain data, so it can be saved as JSON. */
export interface World {
  grid: Grid
  stations: Station[]
  movers: Record<string, Mover>
  /** The pawns the player has selected (click, shift-click or box select). */
  selectedPawnIds: string[]
  /** State of the seeded random numbers used for idle wandering and chats (see random.ts). */
  rngState: number
}

export function createWorld(width: number, height: number, seed = 1): World {
  return { grid: createGrid(width, height), stations: [], movers: {}, selectedPawnIds: [], rngState: seed }
}

export function addPawn(world: World, pawnId: string, tile: Tile): Mover {
  const mover: Mover = {
    pawnId,
    pos: { x: tile.x, y: tile.y },
    status: "idle",
    order: null,
    path: [],
    destination: null,
    exposure: getZone(world.grid, tile.x, tile.y) === "outside" ? "outside" : "inside",
    waitHours: 0,
    cyclingTo: null,
    interrupt: null,
    unmetNeed: null,
    idle: null,
    anchor: null,
    chatCooldownHours: 0,
    queue: [],
    yieldHours: 0,
    avoidedTile: null,
  }
  world.movers[pawnId] = mover
  return mover
}

/** E.g. when a pawn is evacuated. */
export function removePawn(world: World, pawnId: string) {
  delete world.movers[pawnId]
  world.selectedPawnIds = world.selectedPawnIds.filter((id) => id !== pawnId)
}

export function addStation(world: World, station: Station) {
  world.stations.push(station)
}

/** Pawns working at or heading to it stop and report "cancelled" on the next step. */
export function removeStation(world: World, stationId: string) {
  world.stations = world.stations.filter((s) => s.id !== stationId)
}

export const findStation = (world: World, stationId: string) => world.stations.find((s) => s.id === stationId)

/** The station covering a tile, if any. */
export const stationAt = (world: World, tile: Tile) =>
  world.stations.find((s) => s.footprint.some((f) => sameTile(f, tile)))

/** Pawns standing on a tile. */
export const pawnsAt = (world: World, tile: Tile) =>
  Object.values(world.movers).filter((m) => sameTile(tileOf(m.pos), tile))

/**
 * Walking cost of every tile right now: the terrain, with station footprints blocked.
 * Pawns don't block each other (like RimWorld, they can pass through one another).
 */
export function costField(world: World): number[] {
  const field = world.grid.cost.slice()
  for (const station of world.stations) {
    for (const t of station.footprint) {
      if (inBounds(world.grid, t.x, t.y)) field[tileIndex(world.grid, t.x, t.y)] = BLOCKED
    }
  }
  return field
}

/** A cost lookup over a cost field, for findPath. */
export function costLookup(world: World, field: number[]) {
  const { grid } = world
  return (x: number, y: number) => (inBounds(grid, x, y) ? field[tileIndex(grid, x, y)] : BLOCKED)
}

/** True if a pawn can stand on the tile right now. */
export const isWalkable = (world: World, tile: Tile) =>
  getCost(world.grid, tile.x, tile.y) !== BLOCKED && !stationAt(world, tile)
