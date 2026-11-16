/*
 * How game time relates to real time on the base map.
 */

/**
 * How fast crew time runs: game-hours per real second. 0.15 = 9 game-minutes a second, so a
 * suited walk crosses about one 162 m block a second.
 */
export const GAME_HOURS_PER_SECOND = 0.15

/** Real seconds that `hours` game-hours take on the base map, with the clock sped up `speed` times. */
export const realSeconds = (hours: number, speed = 1) => hours / (GAME_HOURS_PER_SECOND * speed)

/** Game-hours as the real time they take at `speed`× (see lib/gameSpeed.ts), e.g. "40 s" or "1:33". */
export function formatRealTime(hours: number, speed = 1): string {
  const seconds = Math.max(0, Math.ceil(realSeconds(hours, speed)))
  if (seconds < 60) return `${seconds} s`
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}
