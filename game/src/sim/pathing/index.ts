/**
 * Pawn pathing: where crewmates are on the map, how they find their way, and how a
 * "click an astronaut, click a task" order turns into walking and working.
 *
 * Backend only — no rendering. A typical frame:
 *   handleClick(world, tileUnderMouse)          // on click
 *   const events = stepPathing(world, dtHours)  // every tick
 *   // draw each world.movers[id].pos; react to events (arrived, workDone, blocked...)
 *
 * Pawns are referred to by id only, so this works alongside the crew model (needs, roles,
 * work speed) without depending on it: pass `workRate` to stepPathing to use real work speeds.
 *
 * Inside vs outside: every tile is inside (habitat), outside (surface) or an airlock. Walking
 * only crosses between inside and outside through an airlock, which takes a short cycle.
 * `exposureChanged` events say when a pawn goes out on EVA or comes back in.
 *
 * Idle: with no order, a pawn strolls around where it stopped and may chat with an idle
 * crewmate nearby (`chatStarted` / `chatEnded` events; the crew rules apply morale or friction).
 *
 * Crowds: pawns go round crewmates who are standing, wait behind ones walking ahead, ask idle
 * ones to step aside, and squeeze past in a one-tile corridor rather than getting stuck.
 *
 * Selection and orders: click, shift-click or box-select crew; shift-clicking queues orders.
 *
 * Urgent needs: pass `urgentNeed` to stepPathing (from the crew rules). An urgent need sets the
 * player's order aside, sends the pawn to a station that `provides` it (or indoors for
 * "shelter"), and the order is resumed once the need stops being reported.
 */
export {
  BLOCKED,
  DEFAULT_METERS_PER_TILE,
  MAX_WALKABLE_SLOPE_DEG,
  canCrossZones,
  canStepBetween,
  isDoorway,
  isWalledOff,
  isWallCrossing,
  createGrid,
  getCost,
  getZone,
  inBounds,
  sameTile,
  setCost,
  setZone,
  slopeFactor,
  tileOf,
  type Grid,
  type Tile,
  type Zone,
} from "./grid"
export { buildHabitat, type HabitatOptions } from "./habitat"
export { findPath, type CostAt, type FindPathOptions } from "./pathfinding"
export { createStation, isJobDone, type Station, type StationJob, type StationOptions } from "./stations"
export {
  addPawn,
  addStation,
  costField,
  createWorld,
  findStation,
  isWalkable,
  pawnsAt,
  removePawn,
  removeStation,
  stationAt,
  type IdleActivity,
  type Mover,
  type MoverStatus,
  type Order,
  type World,
} from "./world"
export { PATHING_TUNING, WALK_TILES_PER_HOUR, scaleFor } from "./tuning"
export type { PathingEvent, UrgentNeed } from "./events"
export { cancelOrder, issueOrder, replan, type IssueOptions, type OrderResult } from "./orders"
export { stepPathing, type StepOptions } from "./movement"
export type { ShelterRule } from "./needs"
export {
  clearSelection,
  handleClick,
  orderGroup,
  selectInBox,
  selectPawns,
  type ClickOptions,
  type ClickResult,
} from "./commands"
