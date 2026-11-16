/**
 * Tests for the in-game calendar (src/sim/calendar.ts) and how real NASA DONKI rows become game
 * events (src/data/spaceEvents.ts). Run from the game/ folder:
 *
 *   node --experimental-strip-types --import ./tests/pathing/register.mjs --test tests/calendar/calendar.test.ts
 *
 * The fixture is real DONKI data for 2012-01-01 to 2012-02-28, so no test touches the network.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { trimDonki, type DonkiCme, type DonkiSep } from "@/data/spaceEvents"
import {
  FIRST_RECORD_DAY,
  HOURS_PER_DAY,
  WINDOW_DAYS,
  addWindow,
  dayOf,
  describeSpaceEvent,
  eventsSoFar,
  latestNews,
  needsMoreDays,
  newCalendar,
  nextRealStorm,
  nextWindow,
  randomStartDay,
  realDateAt,
  toSpaceEvents,
  type Calendar,
} from "@/sim/calendar"
import { QUIET_FILL_HOURS, advanceSky, startWeather } from "@/sim/weather"

const fixture = JSON.parse(readFileSync(new URL("./donki-2012-01-01-to-02-28.json", import.meta.url), "utf8")) as {
  cme: DonkiCme[]
  sep: DonkiSep[]
}
const realWindow = trimDonki(fixture.cme, fixture.sep, [])

const calendarFrom = (start: string, startHours = 0): Calendar => ({
  start,
  startHours,
  events: [],
  loadedHours: 0,
  failed: false,
  source: null,
})

test("an era starts on a random real day between the first DONKI records and a window before today", () => {
  const now = Date.parse("2026-11-15T12:00:00Z")
  assert.equal(randomStartDay(0, now), FIRST_RECORD_DAY)
  const last = randomStartDay(0.999999, now)
  assert.ok(last <= "2026-09-15" && last >= "2026-09-10", last)
  for (const r of [0.1, 0.5, 0.9]) assert.match(randomStartDay(r, now), /^\d{4}-\d{2}-\d{2}$/)
  const calendar = newCalendar(0.5, now, 100)
  assert.equal(calendar.startHours, 100)
  assert.equal(calendar.loadedHours, 0)
})

test("the player sees Day 1, Day 2… one per 24 game-hours, counted from the era's start", () => {
  const calendar = calendarFrom("2012-01-01", 500)
  assert.equal(dayOf(calendar, 500), 1)
  assert.equal(dayOf(calendar, 523.9), 1)
  assert.equal(dayOf(calendar, 524), 2)
  assert.equal(dayOf(calendar, 500 + 10 * HOURS_PER_DAY + 3), 11)
  assert.equal(realDateAt(calendar, 500 + 22 * HOURS_PER_DAY), "2012-01-23")
})

test("windows line up on 60-day blocks from the first records, so they can be cached", () => {
  const calendar = calendarFrom("2012-01-01")
  const first = nextWindow(calendar)
  // 2010-01-01 + 12 × 60 days = 2011-12-22, so the block runs to 2012-02-19.
  assert.equal(first.from, "2012-01-01")
  assert.equal(first.to, "2012-02-19")
  assert.equal(first.endHours, 50 * HOURS_PER_DAY)
  const second = nextWindow({ ...calendar, loadedHours: first.endHours })
  assert.equal(second.from, "2012-02-20")
  assert.equal(second.endHours - first.endHours, WINDOW_DAYS * HOURS_PER_DAY)
  assert.equal(needsMoreDays({ ...calendar, loadedHours: first.endHours }, 0), false)
  assert.equal(needsMoreDays({ ...calendar, loadedHours: first.endHours }, first.endHours - 5 * HOURS_PER_DAY), true)
})

test("real DONKI data becomes storms, eruptions and particle storms", () => {
  const calendar = calendarFrom("2012-01-01")
  const events = toSpaceEvents(calendar, realWindow)
  const count = (kind: string) => events.filter((e) => e.kind === kind).length
  assert.equal(count("eruption"), 44, "every CME is news")
  // 7 SEP readings from several spacecraft: the storms of 23 and 27 January.
  assert.equal(count("particleStorm"), 2)
  assert.ok(count("marsStorm") >= 1 && count("marsStorm") <= 9, `${count("marsStorm")} storms`)
  assert.ok(events.every((e, i) => i === 0 || events[i - 1].hour <= e.hour), "oldest first")
  assert.ok(events.filter((e) => e.kind === "eruption").some((e) => e.towardMars), "some eruptions head for Mars")
  // Storm density, for tuning: real storms per game day in a busy stretch of 2012.
  const days = 59
  console.log(`  ${count("marsStorm")} Mars storms in ${days} days (one every ${(days / count("marsStorm")).toFixed(1)} days)`)
})

test("events before Day 1 are left out", () => {
  const events = toSpaceEvents(calendarFrom("2012-01-24"), realWindow)
  assert.ok(events.every((e) => e.hour >= 0))
  assert.equal(events.filter((e) => e.kind === "particleStorm").length, 1, "only the 27 January storm")
})

test("the next real storm comes from loaded data; storms already past can't start late", () => {
  const start = calendarFrom("2012-01-01", 1000)
  const window = nextWindow(start)
  const calendar = addWindow(start, toSpaceEvents(start, realWindow), window.endHours, "nasa")
  assert.equal(calendar.source, "nasa")
  const storms = calendar.events.filter((e) => e.kind === "marsStorm")
  const first = nextRealStorm(calendar, 1000)
  assert.equal(first, 1000 + storms[0].hour)
  // A window that arrives once the clock is past its first storm: that storm doesn't fire.
  const later = nextRealStorm(calendar, 1000 + storms[0].hour + 1)
  assert.ok(later === null || later > 1000 + storms[0].hour)
  // Loading the same window again doesn't double anything.
  const again = addWindow(calendar, toSpaceEvents(start, realWindow), window.endHours, "nasa")
  assert.equal(again.events.length, calendar.events.length)
})

test("news: what happened so far, and the latest within two days, never with a date", () => {
  const start = calendarFrom("2012-01-01")
  const calendar = addWindow(start, toSpaceEvents(start, realWindow), nextWindow(start).endHours, "server")
  const clock = 30 * HOURS_PER_DAY
  const past = eventsSoFar(calendar, clock)
  assert.ok(past.length > 0 && past.every((e) => e.hour <= clock))
  const news = latestNews(calendar, clock)
  if (news) assert.ok(clock - news.hour <= 2 * HOURS_PER_DAY)
  for (const event of calendar.events) {
    const line = describeSpaceEvent(event)
    assert.ok(!/20\d\d|January|February/.test(line), line)
  }
})

test("a real eruption reaching Mars starts a solar storm at its arrival; the quiet timer restarts after", () => {
  const start = calendarFrom("2012-01-01", 1000)
  const calendar = addWindow(start, toSpaceEvents(start, realWindow), nextWindow(start).endHours, "nasa")
  const storm = nextRealStorm(calendar, 1000)!
  const quietAt = storm + 500 // the random fill is far off
  const half = () => 0.5

  // Just before the arrival: calm. Passing it: a solar storm starts.
  let sky = advanceSky(null, quietAt, calendar, storm - 0.5, 0.5, half)
  assert.equal(sky.weather, null)
  sky = advanceSky(null, quietAt, calendar, storm + 0.1, 0.6, half)
  assert.equal(sky.weather?.id, "solar-storm")
  assert.equal(sky.nextAt, quietAt, "the quiet timer is left alone while a storm starts")

  // When it ends, the quiet timer restarts from then.
  const ended = advanceSky(sky.weather, sky.nextAt, calendar, storm + 10, 10, half)
  assert.equal(ended.weather, null)
  const fill = QUIET_FILL_HOURS.min + 0.5 * (QUIET_FILL_HOURS.max - QUIET_FILL_HOURS.min)
  assert.equal(ended.nextAt, storm + 10 + fill)
})

test("a long quiet stretch gets a random storm; without real events, storms are random as before", () => {
  // No real events loaded (a quiet window): the random fill time brings a radiation storm.
  const quiet = { ...calendarFrom("2019-06-01", 0), loadedHours: 50 * 24 }
  const sky = advanceSky(null, 100, quiet, 100.1, 0.2, () => 0.5)
  assert.equal(sky.weather?.id, "radiation-storm")

  // Loading failed: the old random timer, untouched by the calendar.
  const failed = { ...quiet, failed: true }
  assert.equal(advanceSky(null, 100, failed, 99, 1, () => 0.5).weather, null)
  assert.equal(advanceSky(null, 100, failed, 100.1, 1, () => 0.5).weather?.id, "radiation-storm")

  // A storm already going on just runs down; no second one starts on top of it.
  const going = advanceSky(startWeather("radiation-storm"), 100, quiet, 101, 1, () => 0.5)
  assert.equal(going.weather?.id, "radiation-storm")
})

test("a save written to localStorage keeps working: no Infinity or missing times", () => {
  const start = calendarFrom("2012-01-01")
  const calendar = addWindow(start, toSpaceEvents(start, realWindow), nextWindow(start).endHours, "server")
  const roundTrip = JSON.parse(JSON.stringify(calendar)) as Calendar
  assert.deepEqual(roundTrip, calendar)
  assert.ok(roundTrip.events.every((e) => Number.isFinite(e.hour)))
})
