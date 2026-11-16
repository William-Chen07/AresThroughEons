import { weatherEvent, type WeatherId } from "@/content/weather"
import { nextRealStorm, type Calendar } from "@/sim/calendar"

/*
 * When weather events happen, as pure logic. A save keeps the event going on
 * right now, if any, and the time on the expedition's clock when the next one
 * starts (see sim/saves.ts). What an event does to the crew is in sim/lifeSupport.ts.
 */

/** The event going on right now and how many game-hours of it are left, or null in calm weather. */
export type Weather = { id: WeatherId; hoursLeft: number } | null

/** Game-hours of calm between events: one to three Mars days (about 3 to 8 minutes of play). */
export const CALM_HOURS = { min: 24, max: 72 }
/**
 * While the in-game calendar has real NASA events (see sim/calendar.ts), storms come from real
 * solar eruptions reaching Mars. A random one only fills in after this long without any storm:
 * four to seven days (about 11 to 19 minutes of play), since real ones can be weeks apart.
 */
export const QUIET_FILL_HOURS = { min: 96, max: 168 }

/** How long the calm before the next event lasts. `random` is a number from 0 up to 1, as from Math.random(). */
export function calmHours(random: number) {
  return CALM_HOURS.min + random * (CALM_HOURS.max - CALM_HOURS.min)
}

/** With real events on the calendar: how long without a storm before a random one fills in. */
export function quietFillHours(random: number) {
  return QUIET_FILL_HOURS.min + random * (QUIET_FILL_HOURS.max - QUIET_FILL_HOURS.min)
}

export function startWeather(id: WeatherId): Weather {
  return { id, hoursLeft: weatherEvent(id).hours }
}

/**
 * The weather after `hours` game-hours, on a clock that now reads `clock`. An event that is going
 * on runs down and ends; in calm weather `next` starts when the clock reaches `nextAt`. `stormHours`
 * is how many of those hours an event was going on, for working out what it did to the crew.
 */
export function advanceWeather(
  weather: Weather,
  nextAt: number,
  clock: number,
  hours: number,
  random: number,
  next: WeatherId = "radiation-storm",
): { weather: Weather; nextAt: number; stormHours: number } {
  if (weather) {
    const stormHours = Math.min(hours, weather.hoursLeft)
    const hoursLeft = weather.hoursLeft - hours
    if (hoursLeft > 0) return { weather: { ...weather, hoursLeft }, nextAt, stormHours }
    return { weather: null, nextAt: clock + calmHours(random), stormHours }
  }
  if (clock >= nextAt) return { weather: startWeather(next), nextAt, stormHours: 0 }
  return { weather: null, nextAt, stormHours: 0 }
}

/**
 * The next storm on an expedition with a calendar (see sim/calendar.ts), looking from `clock`:
 * which one and when it starts on the expedition's clock. It's the next solar eruption on the
 * calendar reaching Mars ("solar-storm"), unless the random one due at `nextAt` comes first.
 * Doesn't look at the weather going on now: see stormWarning for that.
 */
export function upcomingStorm(calendar: Calendar, nextAt: number, clock: number): { id: WeatherId; at: number } {
  const real = nextRealStorm(calendar, clock)
  return real !== null && real <= nextAt ? { id: "solar-storm", at: real } : { id: "radiation-storm", at: nextAt }
}

/**
 * The warning to show before a storm: which storm is coming and how many game-hours until it
 * starts, once that's within its `warnHours` (content/weather.ts). Null in calm weather with no
 * storm close, and while a storm is going on.
 */
export function stormWarning(
  weather: Weather,
  nextAt: number,
  calendar: Calendar,
  clock: number,
): { id: WeatherId; hoursLeft: number } | null {
  if (weather) return null
  const next = upcomingStorm(calendar, nextAt, clock)
  const hoursLeft = next.at - clock
  return hoursLeft > 0 && hoursLeft <= weatherEvent(next.id).warnHours ? { id: next.id, hoursLeft } : null
}

/**
 * The weather after `hours` game-hours on an expedition with a calendar (see sim/calendar.ts),
 * on a clock that read `clock - hours` before. The next storm is the next solar eruption on the
 * calendar reaching Mars ("solar-storm"), unless it's been quiet for so long that the random one at
 * `nextAt` comes first (see upcomingStorm); the quiet timer restarts whenever a storm ends. If
 * loading the real events failed, random storms come every CALM_HOURS instead, as well as any
 * eruptions already on the calendar.
 */
export function advanceSky(
  weather: Weather,
  nextAt: number,
  calendar: Calendar,
  clock: number,
  hours: number,
  random: () => number,
): { weather: Weather; nextAt: number; stormHours: number } {
  const next = upcomingStorm(calendar, nextAt, clock - hours)
  const sky = advanceWeather(weather, next.at, clock, hours, random(), next.id)
  const ended = weather !== null && sky.weather === null
  if (!ended) return { ...sky, nextAt }
  // advanceWeather has already set the calm after the storm, CALM_HOURS, for when loading failed.
  return calendar.failed ? sky : { ...sky, nextAt: clock + quietFillHours(random()) }
}
