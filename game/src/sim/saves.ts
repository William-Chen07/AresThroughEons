import { createStore } from "zustand/vanilla"
import { useStore } from "zustand"
import { persist } from "zustand/middleware"
import { randomSite, type MarsSite } from "@/map/marsSite"
import { firstLander, landersOf, nextLanderSpot, type Base, type LanderSpot } from "@/sim/base"
import { MAP_SIZE, type Cell } from "@/map/voxelTerrain"
import { progressStore } from "@/sim/progress"
import { startingResources, upgradeResources, type Resources } from "@/content/resources"
import { explorePlace } from "@/content/explore"
import { weatherEvent, type WeatherId } from "@/content/weather"
import {
  TRIP_LOG_LENGTH,
  addFinds,
  advanceTrips,
  rollFinds,
  startTrip,
  type Trip,
  type TripNews,
  type TripReport,
} from "@/sim/explore"
import type { CrewMember } from "@/sim/lifeSupport"
import { CREW_LOG_LENGTH, cannotExplore, cheerUp, hurtOnTrip, liveCrewThrough, newCrew } from "@/sim/crewLife"
import { assignCrewRole } from "@/sim/step"
import type { LogEntry, Pawn, RoleId } from "@/sim/types"
import { NO_RESEARCH, addResearchWork, startResearch, type ResearchProgress } from "@/sim/research"
import { advanceSky, calmHours, quietFillHours, startWeather, type Weather } from "@/sim/weather"
import { addWindow, newCalendar, type Calendar, type SpaceEvent } from "@/sim/calendar"
import { depositIdOf, mine, type Deposit } from "@/sim/deposits"
import { workSpeed } from "@/sim/pawn"

export const SAVE_SLOT_COUNT = 3

/**
 * Where an astronaut was on the base map, so they are back there when the map opens again: the
 * tile they were on, and the Research Lab (its movement station id, see sim/labs.ts) they were
 * working in or walking to, if any.
 */
export interface CrewSpot {
  id: string
  x: number
  y: number
  lab: string | null
}
export const SAVE_NAME_MAX = 16

/**
 * Save slots, kept in this browser only (localStorage). The menu calls a save
 * an "expedition". The slot the player picked from the menu is the active one.
 */
export interface SaveSlot {
  name: string
  /** Both times are milliseconds since 1970, as from Date.now(). */
  createdAt: number
  lastPlayedAt: number
  /**
   * Where on Mars this expedition's base map is. Picked at random when the
   * save is created, for now; later the player will choose where to land.
   */
  site: MarsSite
  /**
   * False until the lander has touched down. The landing is shown only the
   * first time the expedition's map opens; after that the lander is just there.
   */
  landed: boolean
  /**
   * Which era the expedition is in, from 1. When an era ends (everyone was evacuated, or later
   * when its goals are met) the next one begins on the same map: the modules stay where they are
   * and wear down, the tubes are gone, and a new crew comes down in a newer lander (see `nextEra`).
   */
  era: number
  /** The base: its modules, and every cell with a piece of tube on it (see sim/base.ts). */
  modules: Base["modules"]
  tubes: Cell[]
  /** Every lander that has come down, oldest first; the last is this era's (see sim/base.ts). */
  landers: LanderSpot[]
  /** Ids of the research projects this expedition has finished (see content/research.ts). */
  researched: string[]
  /** The project being researched and the work done so far on each (see sim/research.ts). */
  researchProgress: ResearchProgress
  /** How much of each resource the base has (see content/resources.ts). */
  resources: Resources
  /**
   * The expedition's clock: game-hours played since the crew stepped out of the
   * lander. It only runs while the base map is open. A Mars day (sol) is about 24.66 of them.
   */
  hours: number
  /**
   * This era's crew: who they are (occupation, traits), what they're assigned to (role), and
   * everything about them (needs, health, statuses, radiation, skills). See sim/crewLife.ts.
   */
  crew: Pawn[]
  /** What has happened to the crew lately, oldest first (at most CREW_LOG_LENGTH lines). */
  crewLog: LogEntry[]
  /** Ids of the astronauts who were evacuated to Earth when their health ran out. They don't come back. */
  evacuated: string[]
  /**
   * Where each astronaut at the base was when the clock last moved. Empty until the crew steps out
   * of the lander, and again for a new era's crew; anyone not listed steps out beside the lander.
   */
  crewSpots: CrewSpot[]
  /** The weather event going on right now, or null in calm weather (see sim/weather.ts). */
  weather: Weather
  /**
   * The time on the clock (`hours`) when the next random weather event starts. While the calendar
   * has real events, storms come from those, and this is when a random one fills in a long quiet
   * stretch (see sim/weather.ts).
   */
  nextWeatherAt: number
  /**
   * This era's calendar: the hidden real date it started on, and the real NASA events loaded for
   * it so far (see sim/calendar.ts). Each era gets a new one, starting again at Day 1.
   */
  calendar: Calendar
  /**
   * The mineral deposits on this map and how much is left in each (see sim/deposits.ts), or
   * null until the map has been loaded once and they've been generated from its terrain.
   * They stay through every era; a mined-out deposit is gone.
   */
  deposits: Deposit[] | null
  /** The groups of astronauts out exploring right now (see sim/explore.ts). */
  trips: Trip[]
  /** What the last few trips brought back, newest first. */
  tripLog: TripReport[]
  /** The last event that happened to a group out exploring, or null if none has yet. */
  tripNews: TripNews | null
  // TODO(game): the rest of the saved game state for this slot goes here.
}

interface Saves {
  /** Always SAVE_SLOT_COUNT long; null is an empty slot. */
  slots: (SaveSlot | null)[]
  /** Index of the slot the player is playing, or null if none was picked yet. */
  activeSlot: number | null
}

interface SavesActions {
  /** Starts a brand-new save in the slot and makes it the active one. */
  createSave: (index: number, name: string) => void
  /** Makes an existing save the active one. */
  loadSave: (index: number) => void
  deleteSave: (index: number) => void
  /** Records that the save's lander has touched down, so the landing isn't shown again. */
  markLanded: (index: number) => void
  setBase: (index: number, base: Base) => void
  /**
   * Makes a project the one being researched, if everything it needs is already researched.
   * It moves on only while astronauts work in Research Labs (see passTime).
   */
  startResearch: (index: number, projectId: string) => void
  /** Sets the amounts of the resources given; the others stay as they are. Amounts can't go below zero. */
  setResources: (index: number, amounts: Partial<Resources>) => void
  /**
   * Moves the expedition's clock on by `hours` game-hours: the weather moves on, and the crew
   * use up what they needed in that time and lose health if it wasn't there, or if they were
   * outside in a storm (see sim/lifeSupport.ts and sim/weather.ts). `labHours` is the lab work
   * done in that time (game-hours × staffed Research Labs), which moves the research on.
   * `crewSpots`, when given, is where the crew at the base are now.
   */
  passTime: (index: number, hours: number, crew: readonly CrewMember[], labHours?: number, crewSpots?: CrewSpot[]) => void
  /** Gives a crewmate a new role (their current task). Their occupation never changes. */
  setCrewRole: (index: number, pawnId: string, role: RoleId) => void
  /** Starts a weather event right now, or with null ends the one going on. For the Build panel. */
  setWeather: (index: number, id: WeatherId | null) => void
  /**
   * Starts the expedition over at the same landing site, as if it were being opened for the
   * first time: not landed yet (so the landing plays again), no base, nothing researched, the
   * starting resources, the clock at zero, the whole crew at full health and calm weather.
   * Only the name and the landing site stay. For the Build panel.
   */
  resetMap: (index: number) => void
  /**
   * Ends this era and starts the next one on the same map. Everything built stays where it is
   * (and is drawn worn down from now on), research is kept, and a new crew comes down in a new
   * lander beside the old one: the landing plays again, everyone is at full health, nobody is
   * evacuated or out exploring, and the weather is calm. The new lander brings supplies, so each
   * resource goes back up to at least its starting amount.
   */
  nextEra: (index: number) => void
  /**
   * Sends these astronauts to a place on the explore map. Nothing happens if the place doesn't
   * exist or any of them is evacuated or already away.
   */
  sendExploring: (index: number, placeId: string, crewIds: readonly string[]) => void
  /**
   * Adds a newly loaded window of real NASA events to the calendar, up to `endHours` from Day 1.
   * `start` is the calendar's start date the window was loaded for; if the era has moved on since,
   * nothing changes.
   */
  addSpaceEvents: (index: number, start: string, events: SpaceEvent[], endHours: number, source: Calendar["source"]) => void
  /** Records that loading the calendar's next window failed: storms come at random until one loads. */
  markCalendarFailed: (index: number, start: string) => void
  /** Stores the deposits generated for the map. Does nothing if the save already has them. */
  setDeposits: (index: number, deposits: Deposit[]) => void
}

/** Used when the player leaves the name empty. */
export function defaultSaveName(index: number) {
  return `Expedition ${index + 1}`
}

const EMPTY_SLOTS: (SaveSlot | null)[] = Array.from({ length: SAVE_SLOT_COUNT }, () => null)

function withSlot(slots: (SaveSlot | null)[], index: number, slot: SaveSlot | null) {
  return slots.map((old, i) => (i === index ? slot : old))
}

export const savesStore = createStore<Saves & SavesActions>()(
  persist(
    (set, get) => ({
      slots: EMPTY_SLOTS,
      activeSlot: null,
      createSave: (index, name) => {
        const now = Date.now()
        const slot: SaveSlot = {
          name: name.trim().slice(0, SAVE_NAME_MAX) || defaultSaveName(index),
          createdAt: now,
          lastPlayedAt: now,
          site: randomSite(),
          landed: false,
          era: 1,
          modules: [],
          tubes: [],
          landers: [firstLander(MAP_SIZE)],
          researched: [],
          researchProgress: NO_RESEARCH,
          resources: startingResources(),
          hours: 0,
          crew: newCrew(1),
          crewLog: [],
          evacuated: [],
          crewSpots: [],
          weather: null,
          nextWeatherAt: quietFillHours(Math.random()),
          calendar: newCalendar(Math.random(), now, 0),
          deposits: null,
          trips: [],
          tripLog: [],
          tripNews: null,
        }
        set({ slots: withSlot(get().slots, index, slot), activeSlot: index })
      },
      loadSave: (index) => {
        const slot = get().slots[index]
        if (!slot) return
        set({
          slots: withSlot(get().slots, index, { ...slot, lastPlayedAt: Date.now() }),
          activeSlot: index,
        })
      },
      deleteSave: (index) => {
        const { slots, activeSlot } = get()
        set({
          slots: withSlot(slots, index, null),
          activeSlot: activeSlot === index ? null : activeSlot,
        })
      },
      setBase: (index, base) => {
        const slot = get().slots[index]
        if (!slot) return
        // A module without an era was just built, so it belongs to this one.
        const modules = base.modules.map((module) => (module.era ? module : { ...module, era: slot.era }))
        set({ slots: withSlot(get().slots, index, { ...slot, modules, tubes: base.tubes }) })
      },
      startResearch: (index, projectId) => {
        const slot = get().slots[index]
        if (!slot) return
        const researchProgress = startResearch(slot.researchProgress, slot.researched, slot.era, projectId)
        if (researchProgress !== slot.researchProgress) {
          set({ slots: withSlot(get().slots, index, { ...slot, researchProgress }) })
        }
      },
      setResources: (index, amounts) => {
        const slot = get().slots[index]
        if (!slot) return
        const resources = { ...slot.resources }
        for (const [id, amount] of Object.entries(amounts)) {
          resources[id as keyof Resources] = Math.max(0, amount)
        }
        set({ slots: withSlot(get().slots, index, { ...slot, resources }) })
      },
      passTime: (index, hours, atBase, labHours = 0, crewSpots) => {
        const slot = get().slots[index]
        if (!slot) return
        const clock = slot.hours + hours
        // Storms come from real solar eruptions on the calendar, or at random (see sim/weather.ts).
        const sky = advanceSky(slot.weather, slot.nextWeatherAt, slot.calendar, clock, hours, Math.random)
        const event = slot.weather ? weatherEvent(slot.weather.id) : null
        const storm =
          event && sky.stormHours > 0
            ? { hours: sky.stormHours, healthLostPerHourOutside: event.healthLostPerHourOutside, name: event.name }
            : null
        // The crew live through the time (sim/crewLife.ts): needs, radiation, health, evacuation.
        const lived = liveCrewThrough({
          crew: slot.crew,
          resources: slot.resources,
          hours,
          clock: slot.hours,
          atBase,
          away: slot.trips.flatMap((trip) => trip.crew),
          storm,
        })
        let crew = lived.crew
        const crewLog = [...slot.crewLog, ...lived.log]
        const evacuated = [...slot.evacuated, ...lived.evacuated.filter((id) => !slot.evacuated.includes(id))]
        // Trips move on: things happen on the way, and a group that got home hands over what it found.
        const trips = advanceTrips(slot.trips, hours, Math.random)
        for (const { crew: hurt, amount } of trips.healthLost) {
          const result = hurtOnTrip(crew, hurt, amount, clock)
          crew = result.crew
          crewLog.push(...result.log)
        }
        let resources = lived.resources
        // Anyone working at a deposit mines it (see sim/deposits.ts), at their own work speed. The
        // crew rules can have them asleep on the spot (see sim/crewLife.ts): then nothing is dug.
        const miners = atBase.flatMap((member) => {
          const depositId = member.workingAt ? depositIdOf(member.workingAt) : null
          const pawn = crew.find((p) => p.id === member.id)
          return depositId && pawn?.activity === "working" ? [{ depositId, speed: workSpeed(pawn) }] : []
        })
        let deposits = slot.deposits
        if (deposits && miners.length > 0) {
          const dug = mine(deposits, miners, hours)
          deposits = dug.deposits
          resources = { ...resources }
          for (const [mineral, amount] of Object.entries(dug.mined)) resources[mineral as keyof Resources] += amount
        }
        const reports: TripReport[] = []
        for (const trip of trips.back) {
          const place = explorePlace(trip.placeId)
          const finds = place ? rollFinds(place, trip.crew.length, Math.random, trip.events) : {}
          // Morale found on a trip cheers up the crew, which is what the morale bar shows.
          if (finds.morale) crew = cheerUp(crew, finds.morale)
          resources = addFinds(resources, { ...finds, morale: 0 })
          reports.unshift({ id: trip.id, placeId: trip.placeId, crew: trip.crew, finds, events: trip.events })
        }
        const research = addResearchWork(slot.researchProgress, slot.researched, labHours)
        const next: SaveSlot = {
          ...slot,
          hours: clock,
          researched: research.researched,
          researchProgress: research.progress,
          crewSpots: crewSpots ?? slot.crewSpots,
          weather: sky.weather,
          nextWeatherAt: sky.nextAt,
          crew,
          crewLog: crewLog.slice(-CREW_LOG_LENGTH),
          resources,
          deposits,
          evacuated,
          trips: trips.out,
          tripLog: [...reports, ...slot.tripLog].slice(0, TRIP_LOG_LENGTH),
          tripNews: trips.news[trips.news.length - 1] ?? slot.tripNews,
        }
        set({ slots: withSlot(get().slots, index, next) })
      },
      setCrewRole: (index, pawnId, role) => {
        const slot = get().slots[index]
        if (!slot) return
        const result = assignCrewRole(slot.crew, pawnId, role, slot.hours)
        if (!result) return
        const crewLog = [...slot.crewLog, result.entry].slice(-CREW_LOG_LENGTH)
        set({ slots: withSlot(get().slots, index, { ...slot, crew: result.crew, crewLog }) })
      },
      sendExploring: (index, placeId, crewIds) => {
        const slot = get().slots[index]
        const place = explorePlace(placeId)
        if (!slot || !place || crewIds.length === 0) return
        const away = slot.trips.flatMap((trip) => trip.crew)
        if (crewIds.some((id) => slot.evacuated.includes(id) || away.includes(id))) return
        // Injured, at the radiation limit, short of oxygen or asleep: not going anywhere.
        if (crewIds.some((id) => cannotExplore(slot.crew.find((p) => p.id === id)))) return
        const trip = startTrip(crypto.randomUUID(), place, [...crewIds], Math.random)
        set({ slots: withSlot(get().slots, index, { ...slot, trips: [...slot.trips, trip] }) })
      },
      setWeather: (index, id) => {
        const slot = get().slots[index]
        if (!slot) return
        const calm = slot.calendar.failed ? calmHours(Math.random()) : quietFillHours(Math.random())
        const next = id ? { ...slot, weather: startWeather(id) } : { ...slot, weather: null, nextWeatherAt: slot.hours + calm }
        set({ slots: withSlot(get().slots, index, next) })
      },
      resetMap: (index) => {
        const slot = get().slots[index]
        if (!slot) return
        const fresh: SaveSlot = {
          ...slot,
          landed: false,
          era: 1,
          researched: [],
          researchProgress: NO_RESEARCH,
          modules: [],
          tubes: [],
          landers: [firstLander(MAP_SIZE)],
          resources: startingResources(),
          hours: 0,
          crew: newCrew(1),
          crewLog: [],
          evacuated: [],
          crewSpots: [],
          weather: null,
          nextWeatherAt: quietFillHours(Math.random()),
          // A fresh start lands in a new random year, at Day 1 again.
          calendar: newCalendar(Math.random(), Date.now(), 0),
          // Generated again from the map when it opens (the same site gives the same deposits).
          deposits: null,
          trips: [],
          tripLog: [],
          tripNews: null,
        }
        set({ slots: withSlot(get().slots, index, fresh) })
      },
      nextEra: (index) => {
        const slot = get().slots[index]
        if (!slot) return
        const era = slot.era + 1
        // The tubes are gone in the new era, so the new lander may come down where they were.
        const base: Base = { modules: slot.modules, tubes: [], landers: slot.landers }
        const landers = [...landersOf(base, MAP_SIZE), nextLanderSpot(MAP_SIZE, base, era)]
        const supplies = startingResources()
        const resources = { ...slot.resources }
        for (const id of Object.keys(supplies) as (keyof Resources)[]) resources[id] = Math.max(resources[id], supplies[id])
        const next: SaveSlot = {
          ...slot,
          era,
          landers,
          // The old modules stay, worn down, but their tubes don't last the years in between: the
          // new crew lays tubes again.
          tubes: [],
          landed: false,
          resources,
          crew: newCrew(era),
          crewLog: [],
          evacuated: [],
          crewSpots: [],
          weather: null,
          nextWeatherAt: slot.hours + quietFillHours(Math.random()),
          // The new crew lands in a new random year, at Day 1 again.
          calendar: newCalendar(Math.random(), Date.now(), slot.hours),
          trips: [],
          tripNews: null,
        }
        set({ slots: withSlot(get().slots, index, next) })
        // The menu shows the furthest era any expedition has reached (see sim/progress.ts).
        const progress = progressStore.getState()
        progress.setProgress({ hasSave: true, era: Math.max(progress.era, era) })
      },
      addSpaceEvents: (index, start, events, endHours, source) => {
        const slot = get().slots[index]
        if (!slot || slot.calendar.start !== start) return
        const calendar = addWindow(slot.calendar, events, endHours, source)
        set({ slots: withSlot(get().slots, index, { ...slot, calendar }) })
      },
      markCalendarFailed: (index, start) => {
        const slot = get().slots[index]
        if (!slot || slot.calendar.start !== start || slot.calendar.failed) return
        set({ slots: withSlot(get().slots, index, { ...slot, calendar: { ...slot.calendar, failed: true } }) })
      },
      setDeposits: (index, deposits) => {
        const slot = get().slots[index]
        if (!slot || slot.deposits) return
        set({ slots: withSlot(get().slots, index, { ...slot, deposits }) })
      },
      markLanded: (index) => {
        const slot = get().slots[index]
        if (slot && !slot.landed) set({ slots: withSlot(get().slots, index, { ...slot, landed: true }) })
      },
    }),
    {
      name: "ares-saves",
      partialize: ({ slots, activeSlot }) => ({ slots, activeSlot }),
      // Version 1 added `site`, version 2 `landed`, version 3 `modules`,
      // version 4 `tubes`, version 5 `researched`, version 6 `resources`,
      // version 7 the power and materials resources, version 8 morale and the
      // split of materials into ice and regolith, version 9 `hours`, version 10
      // `health`, version 11 `weather` and `nextWeatherAt`, version 12
      // `evacuated`, version 13 `trips` and `tripLog` and version 14 events on
      // trips (`tripNews`, and each trip's own event fields), version 15 `era`
      // and `landers` (and the era on each module). Older saves get a random site, count as not landed yet (so
      // they see the landing once) and start with no modules or tubes, nothing
      // researched, the starting amount of any resource they don't have yet,
      // the clock at zero, everyone at full health, nobody evacuated or out
      // exploring and calm weather, with the first event a while off. (An astronaut already at
      // zero health in an older save is evacuated the next time the clock moves.)
      // A save from before eras is in era 1, with its one lander in the middle and everything built in era 1.
      // Version 16 replaced the placeholder astronauts and their `health` with the crew system
      // (`crew`, `crewLog`): an older save gets a fresh crew, so nobody is evacuated or out exploring.
      // Version 17 added the `calendar`: an older save's current era gets one now, starting at
      // Day 1 from the clock as it stands.
      // Version 18 removed the Storage module: any already built is taken off the map.
      // Version 19 added `researchProgress` (research takes time now; an older save has nothing
      // being researched) and `crewSpots` (an older save's crew steps out beside the lander once more).
      version: 20,
      // Version 20 added `deposits`: an older save gets them the next time its map opens.
      migrate: (stored) => {
        const old = stored as Saves
        return {
          ...old,
          slots: old.slots.map(
            (slot) =>
              slot && {
                ...slot,
                site: slot.site ?? randomSite(),
                landed: slot.landed ?? false,
                era: slot.era ?? 1,
                landers: slot.landers?.length ? slot.landers : [firstLander(MAP_SIZE)],
                modules: (slot.modules ?? [])
                  // Storage is no longer a kind of module (version 18).
                  .filter((module) => (module.type as string) !== "storage")
                  .map((module) => ({ ...module, era: module.era ?? 1 })),
                tubes: slot.tubes ?? [],
                researched: slot.researched ?? [],
                researchProgress: slot.researchProgress ?? NO_RESEARCH,
                resources: upgradeResources(slot.resources),
                hours: slot.hours ?? 0,
                crew: slot.crew ?? newCrew(slot.era ?? 1),
                crewLog: slot.crewLog ?? [],
                evacuated: slot.crew ? (slot.evacuated ?? []) : [],
                // Spots from before the crew system belong to the placeholder astronauts, who are gone.
                crewSpots: slot.crew ? (slot.crewSpots ?? []) : [],
                // A trip from before events existed carries on with none. Trips from before the crew
                // system were made by the placeholder astronauts, who are gone.
                trips: (slot.crew ? (slot.trips ?? []) : []).map((trip) => ({
                  ...trip,
                  eventPoints: trip.eventPoints ?? [],
                  events: trip.events ?? [],
                  waitHours: trip.waitHours ?? 0,
                })),
                tripLog: (slot.tripLog ?? []).map((report) => ({ ...report, events: report.events ?? [] })),
                tripNews: slot.tripNews ?? null,
                weather: slot.weather ?? null,
                nextWeatherAt: slot.nextWeatherAt ?? (slot.hours ?? 0) + calmHours(Math.random()),
                calendar: slot.calendar ?? newCalendar(Math.random(), Date.now(), slot.hours ?? 0),
                deposits: slot.deposits ?? null,
              },
          ),
        }
      },
    },
  ),
)

export function useSaves<T>(selector: (state: Saves & SavesActions) => T): T {
  return useStore(savesStore, selector)
}
