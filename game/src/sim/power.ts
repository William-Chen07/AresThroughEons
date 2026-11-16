import { HOURS_PER_DAY } from "@/sim/calendar"
import { isDecayed, type PlacedModule } from "@/sim/base"
import { DAYLIGHT_HOURS } from "@/sim/dayNight"

/*
 * Making power, as pure logic. Solar Panels turn sunlight into the Power resource: each one makes
 * SOLAR_POWER_PER_HOUR in every game-hour of daylight and nothing at night (see sim/dayNight.ts).
 * Saves add it up as game time passes (see passTime in sim/saves.ts).
 */

/**
 * Power one Solar Panel makes in one game-hour of daylight, in the resource bar's units.
 * A game number to tune, not a real figure: one panel makes 8 in a 16-hour day.
 */
export const SOLAR_POWER_PER_HOUR = 0.5

/** How many of the `hours` game-hours starting at `hourOfDay` (hours since sunrise) are daylight. */
export function daylightHours(hourOfDay: number, hours: number): number {
  let light = 0
  let at = ((hourOfDay % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY
  let left = Math.max(0, hours)
  while (left > 0) {
    const untilNextDay = HOURS_PER_DAY - at
    const step = Math.min(left, untilNextDay)
    light += Math.max(0, Math.min(at + step, DAYLIGHT_HOURS) - at)
    left -= step
    at = 0
  }
  return light
}

/**
 * Power the base's Solar Panels make over `hours` game-hours starting at `hourOfDay`. Panels from
 * an earlier era have decayed and make nothing. `powered` is the share (0 to 1) of the time the
 * base's electrics were working (see poweredShare in sim/weather.ts): a storm that knocks the
 * power out stops the panels too.
 */
export function solarPower(
  modules: readonly PlacedModule[],
  era: number,
  hourOfDay: number,
  hours: number,
  powered = 1,
): number {
  const panels = modules.filter((m) => m.type === "solar" && !isDecayed(m, era)).length
  return panels * SOLAR_POWER_PER_HOUR * daylightHours(hourOfDay, hours) * powered
}
