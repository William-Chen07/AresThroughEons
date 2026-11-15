import type { Tile } from "./grid"

/**
 * Needs urgent enough to make a pawn drop the player's order. The crew rules decide when a need
 * is urgent (these match the crew model's need names); "shelter" means get indoors, e.g. during
 * a solar flare.
 */
export type UrgentNeed = "oxygen" | "water" | "food" | "rest" | "shelter"

/** What happened during a step, for the game rules and UI to react to. */
export type PathingEvent =
  | { type: "arrived"; pawnId: string; tile: Tile }
  | { type: "workStarted"; pawnId: string; stationId: string }
  | { type: "workDone"; pawnId: string; stationId: string }
  /** The pawn stopped in an airlock to cycle through it (takes airlockCycleHours). */
  | { type: "airlockCycling"; pawnId: string; tile: Tile; to: "inside" | "outside" }
  /** The pawn stepped out onto the surface (EVA starts) or back into the habitat (EVA ends). */
  | { type: "exposureChanged"; pawnId: string; exposure: "inside" | "outside" }
  /** An urgent need took over; the player's order is set aside. stationId is null when sheltering. */
  | { type: "needInterrupt"; pawnId: string; need: UrgentNeed; stationId: string | null }
  /** The need is taken care of. `resumed` says whether the set-aside order was picked back up. */
  | { type: "needMet"; pawnId: string; need: UrgentNeed; resumed: boolean }
  /** Nothing on the map can fix the need, or it can't be reached. Sent once until the need changes. */
  | { type: "needUnmet"; pawnId: string; need: UrgentNeed; reason: string }
  /** Two idle crewmates met up and started talking. The crew rules decide the effect (morale, friction). */
  | { type: "chatStarted"; pawnIds: [string, string] }
  /** The chat is over: it ran its course, or `interrupted` by an order or an urgent need. */
  | { type: "chatEnded"; pawnIds: [string, string]; hours: number; interrupted: boolean }
  /** The way got blocked and there's no other route; the order was dropped. */
  | { type: "blocked"; pawnId: string; reason: string }
  /** The order's target disappeared or became unreachable; the order was dropped. */
  | { type: "cancelled"; pawnId: string; reason: string }
