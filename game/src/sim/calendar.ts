/*
 * The in-game calendar, as pure logic. Each era of an expedition is dropped
 * into a random stretch of real history, somewhere between the start of NASA's
 * DONKI space weather records and a couple of months ago. The player only ever
 * sees "Day 1, Day 2…"; the real date stays hidden until the era ends.
 *
 * Real solar events from DONKI (see data/spaceEvents.ts) are turned into game
 * events on the same calendar, one game day for one real day:
 *   - a solar eruption (CME) that NASA's models predicted would reach Mars
 *     starts a storm at its predicted arrival time (see sim/saves.ts);
 *   - every other eruption, particle storms and big flares are news.
 *
 * Times are kept as hours from the era's Day 1, never as real dates, so a save
 * never shows the player the year.
 */

/** Game-hours in one calendar day: a real Earth day, so events land on their true days. */
export const HOURS_PER_DAY = 24
/** The first day of NASA's DONKI records of solar eruptions. */
export const FIRST_RECORD_DAY = "2010-01-01"
/**
 * Real days fetched at a time. NASA's DONKI answers at most 60 days per request. The windows are
 * lined up from FIRST_RECORD_DAY, so every player whose era falls in the same window asks for the
 * same thing and the answer can be cached.
 */
export const WINDOW_DAYS = 60
/** Fetch the next window once less than this many hours of loaded calendar are left. */
export const LOOKAHEAD_HOURS = 10 * HOURS_PER_DAY
/** Eruptions reaching Mars closer together than this count as one storm. */
const STORM_MERGE_HOURS = 12
/** Particle readings closer together than this are one particle storm (several instruments see the same one). */
const PARTICLE_STORM_GAP_HOURS = 48

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

export type SpaceEventKind =
  /** A solar eruption reaching Mars: starts a storm. */
  | "marsStorm"
  /** A solar eruption leaving the Sun. */
  | "eruption"
  /** Fast particles from the Sun, measured by spacecraft. */
  | "particleStorm"
  /** A big solar flare (M or X class). */
  | "flare"

export interface SpaceEvent {
  kind: SpaceEventKind
  /** Hours from the start of the era's Day 1. */
  hour: number
  /** An eruption's speed, in km/s, if NASA measured it. */
  speed?: number
  /** For an eruption: true if NASA's models predicted it would reach Mars. */
  towardMars?: boolean
  /** A flare's class, e.g. "X1.4". */
  flareClass?: string
  /**
   * True for an event started from the Build panel to try it out. It works like a real one, but
   * it isn't in NASA's records, so it's left out when the era's real history is shown.
   */
  test?: boolean
}

export interface Calendar {
  /** The real date of the era's Day 1, "YYYY-MM-DD" (UTC). Hidden from the player until the era ends. */
  start: string
  /** The expedition's clock (a save's `hours`) at the start of Day 1. */
  startHours: number
  /** Real events loaded so far, oldest first. */
  events: SpaceEvent[]
  /** How many hours from Day 1 have been loaded (0 until the first window arrives). */
  loadedHours: number
  /** True if the last try to load the next window failed. Storms then come at random instead. */
  failed: boolean
  /** Where the loaded events came from, for checking: the game's own server or NASA directly. */
  source: "server" | "nasa" | null
}

/** Raw rows from NASA's DONKI, trimmed to what the calendar uses (see data/spaceEvents.ts). */
export interface DonkiWindow {
  /** Solar eruptions (CMEs). */
  eruptions: { startTime: string; speed: number | null; marsArrivals: string[] }[]
  /** Particle readings (SEPs). */
  particles: { eventTime: string }[]
  /** Flares, if NASA's flare feed answered. */
  flares: { peakTime: string; classType: string }[]
}

const dayMs = (day: string) => Date.parse(`${day}T00:00:00Z`)
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/**
 * A random real date for an era to start on: from FIRST_RECORD_DAY up to a full window before
 * `now`, so there's always real data to come. `random` is a number from 0 up to 1.
 */
export function randomStartDay(random: number, now: number): string {
  const first = dayMs(FIRST_RECORD_DAY)
  const last = Math.floor(now / DAY_MS) * DAY_MS - (WINDOW_DAYS + 1) * DAY_MS
  const days = Math.max(0, Math.floor((last - first) / DAY_MS))
  return isoDay(first + Math.floor(random * (days + 1)) * DAY_MS)
}

/** A new era's calendar, with Day 1 starting now on the expedition's clock. */
export function newCalendar(random: number, now: number, startHours: number): Calendar {
  return { start: randomStartDay(random, now), startHours, events: [], loadedHours: 0, failed: false, source: null }
}

/** The day shown to the player: 1 on the era's first day. */
export function dayOf(calendar: Calendar, clock: number) {
  return Math.floor(Math.max(0, clock - calendar.startHours) / HOURS_PER_DAY) + 1
}

/** The real date of a moment on the expedition's clock, "YYYY-MM-DD", for the reveal when the era ends. */
export function realDateAt(calendar: Calendar, clock: number) {
  return isoDay(dayMs(calendar.start) + Math.max(0, clock - calendar.startHours) * HOUR_MS)
}

/** True once the loaded calendar runs out within LOOKAHEAD_HOURS of `clock`. */
export function needsMoreDays(calendar: Calendar, clock: number) {
  return calendar.loadedHours - (clock - calendar.startHours) < LOOKAHEAD_HOURS
}

/**
 * The next window of real days to load: from the end of what's loaded (or the era's start) to the
 * end of the WINDOW_DAYS window it falls in. `from` and `to` are "YYYY-MM-DD", both included.
 */
export function nextWindow(calendar: Calendar): { from: string; to: string; endHours: number } {
  const first = dayMs(FIRST_RECORD_DAY)
  const startMs = dayMs(calendar.start)
  const fromMs = startMs + calendar.loadedHours * HOUR_MS
  const windowIndex = Math.floor((fromMs - first) / (WINDOW_DAYS * DAY_MS))
  const endMs = first + (windowIndex + 1) * WINDOW_DAYS * DAY_MS
  return { from: isoDay(fromMs), to: isoDay(endMs - DAY_MS), endHours: (endMs - startMs) / HOUR_MS }
}

/** Hours from the calendar's Day 1 to a DONKI time like "2012-01-23T04:49Z". */
function hoursFrom(calendar: Calendar, time: string) {
  const ms = Date.parse(time.endsWith("Z") ? time : `${time}Z`)
  return (ms - dayMs(calendar.start)) / HOUR_MS
}

/**
 * Turns a window of DONKI rows into calendar events: one "marsStorm" per predicted arrival at Mars
 * (arrivals close together are one storm), an "eruption" per CME, one "particleStorm" per cluster
 * of particle readings, and a "flare" per M- or X-class flare. Events before Day 1 are dropped.
 */
export function toSpaceEvents(calendar: Calendar, window: DonkiWindow): SpaceEvent[] {
  const events: SpaceEvent[] = []

  const arrivals = window.eruptions
    .flatMap((eruption) => eruption.marsArrivals.map((time) => hoursFrom(calendar, time)))
    .filter((hour) => Number.isFinite(hour))
    .sort((a, b) => a - b)
  for (const hour of arrivals) {
    const last = events[events.length - 1]
    if (last && hour - last.hour < STORM_MERGE_HOURS) continue
    events.push({ kind: "marsStorm", hour })
  }

  for (const eruption of window.eruptions) {
    const hour = hoursFrom(calendar, eruption.startTime)
    if (!Number.isFinite(hour)) continue
    events.push({
      kind: "eruption",
      hour,
      ...(eruption.speed ? { speed: Math.round(eruption.speed) } : {}),
      towardMars: eruption.marsArrivals.length > 0,
    })
  }

  let lastParticle = -Infinity
  for (const hour of window.particles.map((p) => hoursFrom(calendar, p.eventTime)).sort((a, b) => a - b)) {
    if (!Number.isFinite(hour)) continue
    if (hour - lastParticle >= PARTICLE_STORM_GAP_HOURS) events.push({ kind: "particleStorm", hour })
    lastParticle = hour
  }

  for (const flare of window.flares) {
    if (!/^[MX]/.test(flare.classType)) continue
    const hour = hoursFrom(calendar, flare.peakTime)
    if (Number.isFinite(hour)) events.push({ kind: "flare", hour, flareClass: flare.classType })
  }

  return events.filter((event) => event.hour >= 0).sort((a, b) => a.hour - b.hour)
}

/**
 * The calendar with a newly loaded window added, up to `endHours` from Day 1. Storm arrivals that
 * are already in the past on the expedition's clock (a window that arrived late) are kept as news
 * but can't start a storm any more (see nextRealStorm).
 */
export function addWindow(calendar: Calendar, events: SpaceEvent[], endHours: number, source: Calendar["source"]): Calendar {
  const seen = new Set(calendar.events.map((e) => `${e.kind}:${e.hour}`))
  const added = events.filter((e) => !seen.has(`${e.kind}:${e.hour}`))
  return {
    ...calendar,
    events: [...calendar.events, ...added].sort((a, b) => a.hour - b.hour),
    loadedHours: Math.max(calendar.loadedHours, endHours),
    failed: false,
    source,
  }
}

/** The expedition's clock time of the next real storm after `clock`, or null if none is loaded. */
export function nextRealStorm(calendar: Calendar, clock: number): number | null {
  for (const event of calendar.events) {
    const at = calendar.startHours + event.hour
    if (event.kind === "marsStorm" && at > clock) return at
  }
  return null
}

/** Only the events from NASA's records: leaves out the ones started from the Build panel. */
export const realEvents = (events: readonly SpaceEvent[]) => events.filter((event) => !event.test)

/**
 * Game-hours a test solar eruption aimed at Mars takes to arrive (see testSpaceEvents). Real ones
 * take days; this one is short enough to try out, and lands inside the storm warning's time.
 */
export const TEST_ERUPTION_TRAVEL_HOURS = 12

/** What the Build panel can start: each kind of space event (an eruption either way). */
export type TestSpaceEvent = "eruptionToMars" | "eruptionAway" | "particleStorm" | "flare"

/**
 * Test events for the Build panel, starting at `clock` on the expedition's clock. An eruption
 * aimed at Mars also brings its storm, TEST_ERUPTION_TRAVEL_HOURS later; the numbers are typical
 * of real ones (see describeSpaceEvent for how they read).
 */
export function testSpaceEvents(kind: TestSpaceEvent, calendar: Calendar, clock: number): SpaceEvent[] {
  const hour = Math.max(0, clock - calendar.startHours)
  switch (kind) {
    case "eruptionToMars":
      return [
        { kind: "eruption", hour, speed: 1200, towardMars: true, test: true },
        { kind: "marsStorm", hour: hour + TEST_ERUPTION_TRAVEL_HOURS, test: true },
      ]
    case "eruptionAway":
      return [{ kind: "eruption", hour, speed: 600, towardMars: false, test: true }]
    case "particleStorm":
      return [{ kind: "particleStorm", hour, test: true }]
    case "flare":
      return [{ kind: "flare", hour, flareClass: "X1.0", test: true }]
  }
}

/** Real events that happened in this era up to `clock`, oldest first. */
export function eventsSoFar(calendar: Calendar, clock: number): SpaceEvent[] {
  return calendar.events.filter((event) => calendar.startHours + event.hour <= clock)
}

/** The most recent event, within `withinHours` of `clock`, or null. For the news line on the map. */
export function latestNews(calendar: Calendar, clock: number, withinHours = 2 * HOURS_PER_DAY): SpaceEvent | null {
  const past = eventsSoFar(calendar, clock)
  const last = past[past.length - 1]
  return last && clock - (calendar.startHours + last.hour) <= withinHours ? last : null
}

/** A one-line description of an event for the player, with no date in it. */
export function describeSpaceEvent(event: SpaceEvent): string {
  switch (event.kind) {
    case "marsStorm":
      return "A solar eruption reached Mars."
    case "eruption":
      return `The Sun flung out a solar eruption${event.speed ? ` at ${event.speed.toLocaleString("en-US")} km/s` : ""}.${
        event.towardMars ? " NASA's models say it's heading for Mars!" : " It's heading away from Mars."
      }`
    case "particleStorm":
      return "Spacecraft measured a burst of fast particles from the Sun."
    case "flare":
      return `A ${event.flareClass ?? "big"}-class solar flare flashed on the Sun.`
  }
}
