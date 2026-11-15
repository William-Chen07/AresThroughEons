import { weatherEvent, type WeatherId } from "@/content/weather"

/*
 * When weather events happen, as pure logic. A save keeps the event going on
 * right now, if any, and the time on the expedition's clock when the next one
 * starts (see sim/saves.ts). What an event does to the crew is in sim/lifeSupport.ts.
 */

/** The event going on right now and how many game-hours of it are left, or null in calm weather. */
export type Weather = { id: WeatherId; hoursLeft: number } | null

/** Game-hours of calm between events: one to three Mars days (about 3 to 8 minutes of play). */
export const CALM_HOURS = { min: 24, max: 72 }

/** How long the calm before the next event lasts. `random` is a number from 0 up to 1, as from Math.random(). */
export function calmHours(random: number) {
  return CALM_HOURS.min + random * (CALM_HOURS.max - CALM_HOURS.min)
}

export function startWeather(id: WeatherId): Weather {
  return { id, hoursLeft: weatherEvent(id).hours }
}

/**
 * The weather after `hours` game-hours, on a clock that now reads `clock`. An event that is going
 * on runs down and ends; in calm weather one starts when the clock reaches `nextAt`. `stormHours`
 * is how many of those hours an event was going on, for working out what it did to the crew.
 */
export function advanceWeather(
  weather: Weather,
  nextAt: number,
  clock: number,
  hours: number,
  random: number,
): { weather: Weather; nextAt: number; stormHours: number } {
  if (weather) {
    const stormHours = Math.min(hours, weather.hoursLeft)
    const hoursLeft = weather.hoursLeft - hours
    if (hoursLeft > 0) return { weather: { ...weather, hoursLeft }, nextAt, stormHours }
    return { weather: null, nextAt: clock + calmHours(random), stormHours }
  }
  if (clock >= nextAt) return { weather: startWeather("radiation-storm"), nextAt, stormHours: 0 }
  return { weather: null, nextAt, stormHours: 0 }
}
