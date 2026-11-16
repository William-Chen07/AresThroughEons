import { HOURS_PER_DAY } from "@/sim/calendar"
import type { ModuleTypeId } from "@/content/modules"
import { isDecayed, type PlacedModule } from "@/sim/base"
import { DAYLIGHT_HOURS } from "@/sim/dayNight"

/*
 * Making power, as pure logic. Solar Panels turn sunlight into the Power resource: each one makes
 * SOLAR_POWER_PER_HOUR in every game-hour of daylight and nothing at night (see sim/dayNight.ts).
 * Wind Turbines and Uranium Power Plants make theirs around the clock. Every other module uses
 * power for each game-hour it stands (see MODULE_POWER_PER_HOUR).
 * Saves add it up as game time passes (see passTime in sim/saves.ts).
 */

/*
 * The numbers are all whole and balanced against each other (game numbers to tune, not real
 * figures):
 * - A first base (Habitat, Med Bay, Research Lab) uses 4 an hour. One Solar Panel makes 8 an hour
 *   by day, so the base stores 4 an hour for 16 hours (64) and uses 32 of it through the 8-hour
 *   night. One panel runs a first base with room for a Lounge; anything more needs another.
 * - A Wind Turbine makes half a panel's power but never stops: 96 a day against a panel's 128.
 *   It is what gets a base through the night without a big store.
 * - A Uranium Power Plant makes as much as three panels in full sun, all day and in any weather:
 *   576 a day, enough for one of every module (20 an hour, 480 a day) on its own.
 */

/** Power one Solar Panel makes in one game-hour of daylight, in the resource bar's units: 128 a day. */
export const SOLAR_POWER_PER_HOUR = 8

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

/** Power one Wind Turbine makes in one game-hour, day or night: less than a Solar Panel, but steady. 96 a day. */
export const WIND_POWER_PER_HOUR = 4

/** Power one Uranium Power Plant makes in one game-hour, day or night, in any weather: 576 a day. */
export const URANIUM_POWER_PER_HOUR = 24

/**
 * Power the base makes over `hours` game-hours starting at `hourOfDay`: Solar Panels by day,
 * Wind Turbines and Uranium Power Plants all the time. Modules from an earlier era have decayed
 * and make nothing. `powered` is the share (0 to 1) of the time the base's electrics were working
 * (see poweredShare in sim/weather.ts): a storm that knocks the power out stops the panels and
 * turbines, but not a Uranium Power Plant, which works in any weather.
 */
export function powerMade(
  modules: readonly PlacedModule[],
  era: number,
  hourOfDay: number,
  hours: number,
  powered = 1,
): number {
  const count = (type: PlacedModule["type"]) => modules.filter((m) => m.type === type && !isDecayed(m, era)).length
  const time = Math.max(0, hours)
  const solar = count("solar") * SOLAR_POWER_PER_HOUR * daylightHours(hourOfDay, time) * powered
  const wind = count("wind-turbine") * WIND_POWER_PER_HOUR * time * powered
  const uranium = count("uranium-power") * URANIUM_POWER_PER_HOUR * time
  return solar + wind + uranium
}

/**
 * Power each kind of module uses in one game-hour, day and night, in the resource bar's units.
 * The modules that make power use none, and neither do tubes. Bigger and busier modules use more.
 */
export const MODULE_POWER_PER_HOUR: Record<ModuleTypeId, number> = {
  habitat: 1,
  solar: 0,
  medbay: 1,
  research: 2,
  lounge: 1,
  "wind-turbine": 0,
  observatory: 1,
  "big-lounge": 2,
  "rover-bay": 2,
  "fuel-generator": 3,
  // "Uses a lot more power" (content/modules.ts).
  greenhouse: 4,
  // Works 1.5 times as fast as a Research Lab, for 1.5 times the power.
  "research-pro": 3,
  "uranium-power": 0,
}

/**
 * Power the base's modules use over `hours` game-hours. Modules from an earlier era have decayed
 * and use nothing. `powered` is the share (0 to 1) of the time the base's electrics were working
 * (see poweredShare in sim/weather.ts): in a storm that knocks the power out nothing is running,
 * so nothing is used.
 */
export function powerUsed(modules: readonly PlacedModule[], era: number, hours: number, powered = 1): number {
  const perHour = modules.reduce((sum, m) => sum + (isDecayed(m, era) ? 0 : (MODULE_POWER_PER_HOUR[m.type] ?? 0)), 0)
  return perHour * Math.max(0, hours) * powered
}
