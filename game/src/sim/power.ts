import { HOURS_PER_DAY } from "@/sim/calendar"
import { MODULE_TYPES, type BuildCost, type ModuleTypeId } from "@/content/modules"
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
 * figures). What a module uses is the power number on its Build bar card (MODULE_POWER_PER_HOUR).
 * - A first base (Habitat, Med Bay, Research Lab) uses 35 an hour. One Solar Panel makes 60 an hour
 *   by day, so the base stores 25 an hour for 16 hours (400) and uses 280 of it through the 8-hour
 *   night. One panel runs a first base with room for a Lounge; anything more needs another.
 * - A Wind Turbine makes half a panel's power but never stops: 720 a day against a panel's 960.
 *   It is what gets a base through the night without a big store.
 * - A Uranium Power Plant makes as much as three panels in full sun, all day and in any weather:
 *   4320 a day, enough for one of every module (130 an hour, 3120 a day) on its own.
 */

/** Power one Solar Panel makes in one game-hour of daylight, in the resource bar's units: 960 a day. */
export const SOLAR_POWER_PER_HOUR = 60

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

/** Power one Wind Turbine makes in one game-hour, day or night: less than a Solar Panel, but steady. 720 a day. */
export const WIND_POWER_PER_HOUR = 30

/** Power one Uranium Power Plant makes in one game-hour, day or night, in any weather: 4320 a day. */
export const URANIUM_POWER_PER_HOUR = 180

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
 * It is the number beside the power symbol on the module's Build bar card (`cost.power` in
 * content/modules.ts), so what the card shows is what the module uses. The modules that make
 * power show none and use none, and neither do tubes.
 */
export const MODULE_POWER_PER_HOUR = Object.fromEntries(
  MODULE_TYPES.map((type) => [type.id, (type.cost as BuildCost).power ?? 0]),
) as Record<ModuleTypeId, number>

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
