import { EXPLORE_BASE, EXPLORE_RULES, EXPLORE_UNLOCK_ERA, explorePlace, type ExplorePlace } from "@/content/explore"
import { EVENT_CHANCE, EVENT_POINTS, EXPLORE_EVENTS, exploreEvent, type ExploreEvent } from "@/content/exploreEvents"
import { RESOURCE_TYPES, type ResourceId, type Resources } from "@/content/resources"

/*
 * The rules of exploring, as pure logic: how long a trip takes, how trips move
 * on as time passes, what happens to them on the way (content/exploreEvents.ts)
 * and what the astronauts bring back. A save keeps the trips
 * that are out and a short log of the ones that came back (see sim/saves.ts).
 *
 * While astronauts are away they are off the base map: they don't use the
 * base's oxygen and a storm at the base doesn't touch them. They pack food from
 * the base when they set off instead (tripFood).
 *
 * How far a place is matters (farness): the further it is, the better the chance
 * of rare finds and the more likely an event that hurts the crew. A bigger group
 * packs more food but can carry more back. The numbers are EXPLORE_RULES in
 * content/explore.ts.
 */

/** Game-hours to cross one unit of the explore map (it is 100 units wide), one way. */
export const HOURS_PER_MAP_UNIT = 0.2

/** A group of astronauts out exploring. */
export interface Trip {
  id: string
  placeId: string
  /** Ids of the astronauts on the trip. */
  crew: string[]
  /** Game-hours for the whole trip, there and back, and how many of them are left. */
  totalHours: number
  hoursLeft: number
  /**
   * How far through the trip (0 at the start, 1 at home again) each event still to come
   * happens, soonest first. Picked when the trip starts; which event it is gets picked then.
   */
  eventPoints: number[]
  /** Ids of the events that have happened on this trip so far, in order. */
  events: string[]
  /** Game-hours the group is still stopped for, after an event that held them up. */
  waitHours: number
}

/** What a trip that came back brought with it, and the ids of the events it met on the way. */
export interface TripReport {
  id: string
  placeId: string
  crew: string[]
  finds: Partial<Resources>
  events: string[]
}

/** An event that has just happened to a trip. */
export interface TripNews {
  /** Different for every event that happens, so the same event twice still counts as news. */
  id: string
  eventId: string
  placeId: string
  crew: string[]
}

/** How many trip reports a save keeps, newest first. */
export const TRIP_LOG_LENGTH = 5

/** Game-hours to go to a place and come back. */
export function tripHours(place: ExplorePlace) {
  return 2 * Math.hypot(place.x - EXPLORE_BASE.x, place.y - EXPLORE_BASE.y) * HOURS_PER_MAP_UNIT
}

/** How far a place is, from 0 (near the base) to 1 (far away); see EXPLORE_RULES. */
export function farness(place: ExplorePlace) {
  const distance = Math.hypot(place.x - EXPLORE_BASE.x, place.y - EXPLORE_BASE.y)
  const { nearDistance, farDistance } = EXPLORE_RULES
  return Math.min(1, Math.max(0, (distance - nearDistance) / (farDistance - nearDistance)))
}

/** The food a group packs from the base for a trip: more astronauts and longer trips need more. */
export function tripFood(place: ExplorePlace, crewCount: number) {
  return Math.ceil(crewCount * EXPLORE_RULES.foodPerAstronautHour * tripHours(place))
}

/** The most a group can carry back, all finds together (morale isn't carried). */
export function carryLimit(crewCount: number) {
  return crewCount * EXPLORE_RULES.carryPerAstronaut
}

/**
 * How good a place's finds are, for the explore map: 1 to 4 stars. Further is better, and once
 * finds join that weren't there when exploring opened (uranium, from Era 3), better again. Says
 * nothing about which finds.
 */
export function findStars(place: ExplorePlace, era: number) {
  const laterFinds = EXPLORE_RULES.rareFinds.some((find) => find.fromEra > EXPLORE_UNLOCK_ERA && era >= find.fromEra)
  return Math.min(4, 1 + Math.round(farness(place) * 2) + (laterFinds ? 1 : 0))
}

/** How likely the crew are to get hurt on the way to a place, in words. */
export function dangerOf(place: ExplorePlace): "Low" | "Medium" | "High" {
  const far = farness(place)
  return far < 1 / 3 ? "Low" : far < 2 / 3 ? "Medium" : "High"
}

/**
 * A trip setting off. Its event points are picked now: each has an EVENT_CHANCE of being used,
 * and falls somewhere in the middle of the trip (not right at the base, coming or going).
 * `random` gives numbers from 0 up to 1, as Math.random does.
 */
export function startTrip(id: string, place: ExplorePlace, crew: string[], random: () => number): Trip {
  const hours = tripHours(place)
  const eventPoints: number[] = []
  for (let i = 0; i < EVENT_POINTS; i++) {
    if (random() < EVENT_CHANCE) eventPoints.push(0.15 + random() * 0.7)
  }
  eventPoints.sort((a, b) => a - b)
  return { id, placeId: place.id, crew, totalHours: hours, hoursLeft: hours, eventPoints, events: [], waitHours: 0 }
}

/**
 * How likely an event is on a trip `far` (0 to 1) from the base: its weight, and for the events
 * that hurt, up to injuryWeightAtFar times that on the farthest trips.
 */
export function eventWeight(event: ExploreEvent, far = 0) {
  return event.effect.healthLost ? event.weight * (1 + (EXPLORE_RULES.injuryWeightAtFar - 1) * far) : event.weight
}

/** Picks an event at random, the heavier ones more often; `far` is the trip's farness. */
export function pickEvent(random: () => number, far = 0): ExploreEvent {
  const total = EXPLORE_EVENTS.reduce((sum, event) => sum + eventWeight(event, far), 0)
  let roll = random() * total
  for (const event of EXPLORE_EVENTS) {
    roll -= eventWeight(event, far)
    if (roll < 0) return event
  }
  return EXPLORE_EVENTS[EXPLORE_EVENTS.length - 1]
}

/**
 * How far along a trip is, from 0 (leaving the base) through 1 (at the place) and back to 0
 * (home again). Multiply the way from the base to the place by it to get where the group is.
 */
export function tripReach(trip: Trip) {
  const done = 1 - trip.hoursLeft / trip.totalHours
  return done < 0.5 ? done * 2 : (1 - done) * 2
}

/**
 * The trips after `hours` game-hours: the ones still out, the ones that got home in that time,
 * and the events that happened on the way (in `news`, with the health each one cost the group).
 * A group held up by an event waits before it moves on.
 */
export function advanceTrips(
  trips: readonly Trip[],
  hours: number,
  random: () => number,
): { out: Trip[]; back: Trip[]; news: TripNews[]; healthLost: { crew: string[]; amount: number }[] } {
  const out: Trip[] = []
  const back: Trip[] = []
  const news: TripNews[] = []
  const healthLost: { crew: string[]; amount: number }[] = []
  for (const before of trips) {
    const trip = { ...before, eventPoints: [...before.eventPoints], events: [...before.events] }
    let left = hours
    while (left > 0 && trip.hoursLeft > 0) {
      if (trip.waitHours > 0) {
        const waited = Math.min(left, trip.waitHours)
        trip.waitHours -= waited
        left -= waited
        continue
      }
      // Game-hours of travel until the next event point, if there is one.
      const point = trip.eventPoints[0]
      const untilEvent = point === undefined ? Infinity : Math.max(0, trip.hoursLeft - (1 - point) * trip.totalHours)
      if (untilEvent > left) {
        trip.hoursLeft -= left
        break
      }
      trip.hoursLeft -= untilEvent
      left -= untilEvent
      trip.eventPoints.shift()
      const place = explorePlace(trip.placeId)
      const event = pickEvent(random, place ? farness(place) : 0)
      trip.events.push(event.id)
      trip.waitHours += event.effect.waitHours ?? 0
      if (event.effect.healthLost) healthLost.push({ crew: trip.crew, amount: event.effect.healthLost })
      news.push({ id: `${trip.id}:${trip.events.length}`, eventId: event.id, placeId: trip.placeId, crew: trip.crew })
    }
    if (trip.hoursLeft > 0) out.push(trip)
    else back.push({ ...trip, hoursLeft: 0 })
  }
  return { out, back, news, healthLost }
}

/**
 * What a group brings back from a place: every astronaut carries a random amount of each thing
 * the place has, and may find something rare too (more likely the further the place is; which
 * rare things depends on the era, see EXPLORE_RULES). The events the trip met then change it:
 * some multiply the load, some add something extra. Last, it's cut down to what the group can
 * carry (carryLimit). `random` gives numbers from 0 up to 1, as Math.random does.
 */
export function rollFinds(
  place: ExplorePlace,
  crewCount: number,
  random: () => number,
  eventIds: readonly string[] = [],
  era = 1,
): Partial<Resources> {
  const effects = eventIds.flatMap((id) => exploreEvent(id)?.effect ?? [])
  const factor = effects.reduce((product, effect) => product * (effect.findsFactor ?? 1), 1)
  const amounts: Partial<Resources> = {}
  for (const { resource, min, max } of place.finds) {
    for (let i = 0; i < crewCount; i++) amounts[resource] = (amounts[resource] ?? 0) + min + random() * (max - min)
  }
  const far = farness(place)
  for (const { resource, fromEra, chanceAtFar, min, max } of EXPLORE_RULES.rareFinds) {
    if (era < fromEra) continue
    for (let i = 0; i < crewCount; i++) {
      if (random() < chanceAtFar * far) amounts[resource] = (amounts[resource] ?? 0) + min + random() * (max - min)
    }
  }
  const finds: Partial<Resources> = {}
  for (const id of Object.keys(amounts) as ResourceId[]) finds[id] = Math.round((amounts[id] ?? 0) * factor)
  for (const { bonus } of effects) {
    if (bonus) finds[bonus.resource] = (finds[bonus.resource] ?? 0) + Math.round(bonus.min + random() * (bonus.max - bonus.min))
  }
  return withinCarryLimit(finds, carryLimit(crewCount))
}

/**
 * Finds cut down, all in the same proportion, to what `limit` lets the group carry. Morale isn't
 * carried, so it doesn't count and is never cut.
 */
export function withinCarryLimit(finds: Partial<Resources>, limit: number): Partial<Resources> {
  const carried = (Object.keys(finds) as ResourceId[]).filter((id) => id !== "morale")
  const total = carried.reduce((sum, id) => sum + (finds[id] ?? 0), 0)
  if (total <= limit) return finds
  const share = limit / total
  const cut: Partial<Resources> = { ...finds }
  for (const id of carried) cut[id] = Math.floor((finds[id] ?? 0) * share)
  return cut
}

export function addFinds(resources: Resources, finds: Partial<Resources>): Resources {
  const next = { ...resources }
  for (const type of RESOURCE_TYPES) next[type.id] += finds[type.id] ?? 0
  return next
}

/** The finds in words, e.g. "32 ice and 12 regolith". */
export function describeFinds(finds: Partial<Resources>) {
  const parts = RESOURCE_TYPES.filter((type) => (finds[type.id] ?? 0) > 0).map(
    (type) => `${finds[type.id]} ${type.name.toLowerCase()}`,
  )
  if (parts.length === 0) return "nothing"
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`
}
