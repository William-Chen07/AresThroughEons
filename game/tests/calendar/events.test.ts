/**
 * Tests for storm warnings (src/sim/weather.ts), test space events from the Build panel
 * (src/sim/calendar.ts) and forced explore events (src/sim/explore.ts). Run from the game/ folder:
 *
 *   node --experimental-strip-types --import ./tests/pathing/register.mjs --test tests/calendar/events.test.ts
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { WEATHER_EVENTS, weatherEvent } from "@/content/weather"
import { EXPLORE_EVENTS } from "@/content/exploreEvents"
import { explorePlace } from "@/content/explore"
import {
  TEST_ERUPTION_TRAVEL_HOURS,
  addWindow,
  eventsSoFar,
  latestNews,
  realEvents,
  testSpaceEvents,
  type Calendar,
  type SpaceEvent,
} from "@/sim/calendar"
import { advanceSky, startWeather, stormWarning, upcomingStorm } from "@/sim/weather"
import { advanceTrips, forceTripEvent, startTrip } from "@/sim/explore"

const calendarAt = (startHours: number, events: SpaceEvent[] = [], failed = false): Calendar => ({
  start: "2012-01-01",
  startHours,
  events,
  loadedHours: 60 * 24,
  failed,
  source: "nasa",
})

test("every storm warns ahead, and a solar eruption (predicted days ahead) earlier than fast particles", () => {
  for (const event of WEATHER_EVENTS) assert.ok(event.warnHours > 0 && event.soon.length > 0, event.id)
  assert.ok(weatherEvent("solar-storm").warnHours > weatherEvent("radiation-storm").warnHours)
})

test("the next storm is the calendar's eruption reaching Mars, unless the random one comes first", () => {
  const calendar = calendarAt(0, [{ kind: "marsStorm", hour: 50 }])
  assert.deepEqual(upcomingStorm(calendar, 100, 10), { id: "solar-storm", at: 50 })
  assert.deepEqual(upcomingStorm(calendar, 40, 10), { id: "radiation-storm", at: 40 })
  assert.deepEqual(upcomingStorm(calendar, 100, 60), { id: "radiation-storm", at: 100 }, "the eruption is past")
})

test("the warning shows only within the storm's warning time, and not during a storm", () => {
  const solar = weatherEvent("solar-storm").warnHours
  const calendar = calendarAt(0, [{ kind: "marsStorm", hour: 100 }])
  assert.equal(stormWarning(null, 1000, calendar, 100 - solar - 1), null, "too far off")
  assert.deepEqual(stormWarning(null, 1000, calendar, 100 - solar + 1), { id: "solar-storm", hoursLeft: solar - 1 })
  assert.equal(stormWarning(null, 1000, calendar, 100), null, "it has arrived")
  assert.equal(stormWarning(startWeather("radiation-storm"), 1000, calendar, 90), null, "a storm is already on")

  const radiation = weatherEvent("radiation-storm").warnHours
  const quiet = calendarAt(0)
  assert.deepEqual(stormWarning(null, 200, quiet, 200 - radiation / 2), { id: "radiation-storm", hoursLeft: radiation / 2 })
  assert.equal(stormWarning(null, 200, quiet, 200 - radiation - 1), null)
})

test("the warning and the storm agree: the warned storm is the one that starts", () => {
  const calendar = calendarAt(0, [{ kind: "marsStorm", hour: 30 }])
  const warned = stormWarning(null, 500, calendar, 25)!
  const sky = advanceSky(null, 500, calendar, 30.5, 5.5, () => 0.5)
  assert.equal(sky.weather?.id, warned.id)
})

test("an eruption on the calendar still brings its storm after loading the next window failed", () => {
  const failed = calendarAt(0, [{ kind: "marsStorm", hour: 30 }], true)
  assert.equal(advanceSky(null, 500, failed, 30.5, 1, () => 0.5).weather?.id, "solar-storm")
  // When it ends, the random storms come every CALM_HOURS, as they do once loading has failed.
  const ended = advanceSky(startWeather("solar-storm"), 500, failed, 40, 10, () => 0)
  assert.equal(ended.weather, null)
  assert.equal(ended.nextAt, 40 + 24)
})

test("a test eruption at Mars brings its storm with a warning, and stays out of NASA's history", () => {
  const start = calendarAt(1000)
  const events = testSpaceEvents("eruptionToMars", start, 1200)
  assert.ok(events.every((e) => e.test))
  const calendar = { ...start, events }
  const warning = stormWarning(null, 5000, calendar, 1200)
  assert.deepEqual(warning, { id: "solar-storm", hoursLeft: TEST_ERUPTION_TRAVEL_HOURS })
  assert.ok(TEST_ERUPTION_TRAVEL_HOURS <= weatherEvent("solar-storm").warnHours)
  assert.equal(latestNews(calendar, 1200)?.kind, "eruption", "it shows in the news")
  assert.deepEqual(realEvents(eventsSoFar(calendar, 2000)), [], "but not in the era's real history")
})

test("every other kind of test space event is news at the current time", () => {
  const calendar = calendarAt(100)
  for (const kind of ["eruptionAway", "particleStorm", "flare"] as const) {
    const [event, ...rest] = testSpaceEvents(kind, calendar, 150)
    assert.equal(rest.length, 0)
    assert.equal(event.hour, 50)
    assert.ok(event.test)
    assert.notEqual(event.kind, "marsStorm")
  }
})

test("a newly loaded window of real events keeps the test events already there", () => {
  const withTest = { ...calendarAt(0), events: testSpaceEvents("flare", calendarAt(0), 5) }
  const real: SpaceEvent[] = [{ kind: "particleStorm", hour: 3 }]
  const next = addWindow(withTest, real, 120 * 24, "nasa")
  assert.equal(next.events.length, 2)
  assert.deepEqual(realEvents(next.events), real)
})

test("each explore event can be made to happen straight away to a group out exploring", () => {
  const place = explorePlace("ice-cliff")!
  for (const event of EXPLORE_EVENTS) {
    const noEvents = () => 0.99 // no random event points
    let trip = startTrip("t", place, ["a", "b"], noEvents)
    trip = advanceTrips([trip], 1, noEvents).out[0]
    const forced = forceTripEvent(trip, event.id)
    const after = advanceTrips([forced], 0.01, noEvents)
    assert.deepEqual(after.news.map((n) => n.eventId), [event.id], event.id)
    const moved = [...after.out, ...after.back][0]
    assert.deepEqual(moved.events, [event.id])
    assert.equal(moved.forced, undefined, "nothing left over to force")
    if (event.effect.healthLost) assert.deepEqual(after.healthLost, [{ crew: ["a", "b"], amount: event.effect.healthLost }])
  }
})
