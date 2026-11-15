import { DEFAULT_METERS_PER_TILE, type Grid } from "./grid"

/**
 * Game-feel numbers for movement. Invented for play, not NASA data. Distances are in metres
 * where the map's scale matters, so they work on both a room-scale map and the big base map.
 */
export const PATHING_TUNING = {
  /** Tile size for maps that don't set their own (see Grid.metersPerTile). */
  metersPerTile: DEFAULT_METERS_PER_TILE,
  /** Walking speed on normal ground (cost 1), around the base. */
  walkKmPerHour: 3,
  /** Walking speed outside in a spacesuit, as a fraction of the normal speed. */
  suitSpeedMultiplier: 0.8,
  /** Time to cycle through an airlock (pressurize/depressurize and suit up or down): 6 game-minutes. */
  airlockCycleHours: 0.1,
  /**
   * Where airlocks aren't required: extra route cost, in tiles of walking, for going through a
   * module's door (suiting up or down). Keeps routes between joined modules in the tube hallways.
   */
  doorCrossingCost: 3,

  // --- Idle behaviour
  /** How far (in metres) an idle pawn strolls from the spot where it became idle. At least one tile. */
  wanderRadiusMeters: 8,
  /** Strolling pace, as a fraction of the normal walking speed. */
  strollSpeedMultiplier: 0.6,
  /** Pause between strolls, in game-hours (picked at random in this range). */
  pauseHours: { min: 0.15, max: 0.5 },
  /** Idle crewmates this close (in metres, straight line) may start a chat. At least next-door tiles. */
  chatRangeMeters: 12,
  /** Chance that a pawn finishing a pause goes to chat with a nearby idle crewmate. */
  chatChance: 0.5,
  /** How long a chat lasts, in game-hours. */
  chatHours: 0.5,
  /** Game-hours before a pawn starts another chat. */
  chatCooldownHours: 2,
  /** How long a pawn waits for a crewmate walking over to chat before giving up. */
  chatWaitHours: 0.5,

  // --- Crowds
  /**
   * Extra route cost for a tile where a crewmate is standing, in "tiles of walking". Routes go
   * round them when there's room, and squeeze past in a one-tile corridor.
   */
  standingCrewmateCost: 6,
  /** Longest a pawn waits behind a crewmate before squeezing past anyway (stops standoffs). */
  maxYieldHours: 0.02,
  /** How far from the clicked tile (in tiles) a group spreads out when sent somewhere together. */
  groupSpreadRadius: 3,
} as const

/** Tiles a pawn walks per game-hour on normal ground, on a map with the default tile size. */
export const WALK_TILES_PER_HOUR = (PATHING_TUNING.walkKmPerHour * 1000) / PATHING_TUNING.metersPerTile

/** The tuning numbers above, worked out in tiles for a particular map. */
export function scaleFor(grid: Grid) {
  const walkTilesPerHour = (PATHING_TUNING.walkKmPerHour * 1000) / grid.metersPerTile
  return {
    walkTilesPerHour,
    /**
     * Route cost of passing through an airlock, in "tiles of walking". It makes routes count the
     * cycling time, so a pawn won't go out and back in when walking around inside is quicker.
     */
    airlockRouteCost: PATHING_TUNING.airlockCycleHours * walkTilesPerHour,
    wanderRadius: Math.max(1, Math.round(PATHING_TUNING.wanderRadiusMeters / grid.metersPerTile)),
    chatRange: Math.max(1.5, PATHING_TUNING.chatRangeMeters / grid.metersPerTile),
  }
}
