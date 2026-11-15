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
import { healthOf, liveThrough, needEvacuating, type CrewHealth, type CrewMember } from "@/sim/lifeSupport"
import { withResearch } from "@/sim/research"
import { advanceWeather, calmHours, startWeather, type Weather } from "@/sim/weather"

export const SAVE_SLOT_COUNT = 3
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
   * when its goals are met) the next one begins on the same map: the base stays where it is and
   * wears down, and a new crew comes down in a newer lander (see `nextEra`).
   */
  era: number
  /** The base: its modules, and every cell with a piece of tube on it (see sim/base.ts). */
  modules: Base["modules"]
  tubes: Cell[]
  /** Every lander that has come down, oldest first; the last is this era's (see sim/base.ts). */
  landers: LanderSpot[]
  /** Ids of the research projects this expedition has finished (see content/research.ts). */
  researched: string[]
  /** How much of each resource the base has (see content/resources.ts). */
  resources: Resources
  /**
   * The expedition's clock: game-hours played since the crew stepped out of the
   * lander. It only runs while the base map is open. A Mars day (sol) is about 24.66 of them.
   */
  hours: number
  /** Each astronaut's health, by astronaut id (see sim/lifeSupport.ts). */
  health: CrewHealth
  /** Ids of the astronauts who were evacuated to Earth when their health ran out. They don't come back. */
  evacuated: string[]
  /** The weather event going on right now, or null in calm weather (see sim/weather.ts). */
  weather: Weather
  /** The time on the clock (`hours`) when the next weather event starts. */
  nextWeatherAt: number
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
  /** Researches a project, if everything it needs is already researched. */
  research: (index: number, projectId: string) => void
  /** Sets the amounts of the resources given; the others stay as they are. Amounts can't go below zero. */
  setResources: (index: number, amounts: Partial<Resources>) => void
  /**
   * Moves the expedition's clock on by `hours` game-hours: the weather moves on, and the crew
   * use up what they needed in that time and lose health if it wasn't there, or if they were
   * outside in a storm (see sim/lifeSupport.ts and sim/weather.ts).
   */
  passTime: (index: number, hours: number, crew: readonly CrewMember[]) => void
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
          resources: startingResources(),
          hours: 0,
          health: {},
          evacuated: [],
          weather: null,
          nextWeatherAt: calmHours(Math.random()),
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
      research: (index, projectId) => {
        const slot = get().slots[index]
        if (!slot) return
        const researched = withResearch(slot.researched, projectId)
        if (researched.length !== slot.researched.length) {
          set({ slots: withSlot(get().slots, index, { ...slot, researched }) })
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
      passTime: (index, hours, crew) => {
        const slot = get().slots[index]
        if (!slot) return
        const clock = slot.hours + hours
        const sky = advanceWeather(slot.weather, slot.nextWeatherAt, clock, hours, Math.random())
        const storm =
          slot.weather && sky.stormHours > 0
            ? { hours: sky.stormHours, healthLostPerHour: weatherEvent(slot.weather.id).healthLostPerHourOutside }
            : null
        const after = liveThrough(slot.resources, slot.health, crew, hours, storm)
        const evacuated = [...slot.evacuated, ...needEvacuating(after.health, crew)]
        // Trips move on: things happen on the way, and a group that got home hands over what it found.
        const trips = advanceTrips(slot.trips, hours, Math.random)
        const health = { ...after.health }
        for (const { crew: hurt, amount } of trips.healthLost) {
          // Never below 1: nobody is evacuated from out in the field.
          for (const id of hurt) health[id] = Math.max(1, healthOf(health, id) - amount)
        }
        let resources = after.resources
        const reports: TripReport[] = []
        for (const trip of trips.back) {
          const place = explorePlace(trip.placeId)
          const finds = place ? rollFinds(place, trip.crew.length, Math.random, trip.events) : {}
          resources = addFinds(resources, finds)
          reports.unshift({ id: trip.id, placeId: trip.placeId, crew: trip.crew, finds, events: trip.events })
        }
        const next: SaveSlot = {
          ...slot,
          hours: clock,
          weather: sky.weather,
          nextWeatherAt: sky.nextAt,
          health,
          resources,
          evacuated,
          trips: trips.out,
          tripLog: [...reports, ...slot.tripLog].slice(0, TRIP_LOG_LENGTH),
          tripNews: trips.news[trips.news.length - 1] ?? slot.tripNews,
        }
        set({ slots: withSlot(get().slots, index, next) })
      },
      sendExploring: (index, placeId, crewIds) => {
        const slot = get().slots[index]
        const place = explorePlace(placeId)
        if (!slot || !place || crewIds.length === 0) return
        const away = slot.trips.flatMap((trip) => trip.crew)
        if (crewIds.some((id) => slot.evacuated.includes(id) || away.includes(id))) return
        const trip = startTrip(crypto.randomUUID(), place, [...crewIds], Math.random)
        set({ slots: withSlot(get().slots, index, { ...slot, trips: [...slot.trips, trip] }) })
      },
      setWeather: (index, id) => {
        const slot = get().slots[index]
        if (!slot) return
        const next = id
          ? { ...slot, weather: startWeather(id) }
          : { ...slot, weather: null, nextWeatherAt: slot.hours + calmHours(Math.random()) }
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
          modules: [],
          tubes: [],
          landers: [firstLander(MAP_SIZE)],
          resources: startingResources(),
          hours: 0,
          health: {},
          evacuated: [],
          weather: null,
          nextWeatherAt: calmHours(Math.random()),
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
        const base: Base = { modules: slot.modules, tubes: slot.tubes, landers: slot.landers }
        const landers = [...landersOf(base, MAP_SIZE), nextLanderSpot(MAP_SIZE, base, era)]
        const supplies = startingResources()
        const resources = { ...slot.resources }
        for (const id of Object.keys(supplies) as (keyof Resources)[]) resources[id] = Math.max(resources[id], supplies[id])
        const next: SaveSlot = {
          ...slot,
          era,
          landers,
          landed: false,
          resources,
          health: {},
          evacuated: [],
          weather: null,
          nextWeatherAt: slot.hours + calmHours(Math.random()),
          trips: [],
          tripNews: null,
        }
        set({ slots: withSlot(get().slots, index, next) })
        // The menu shows the furthest era any expedition has reached (see sim/progress.ts).
        const progress = progressStore.getState()
        progress.setProgress({ hasSave: true, era: Math.max(progress.era, era) })
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
      version: 15,
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
                modules: (slot.modules ?? []).map((module) => ({ ...module, era: module.era ?? 1 })),
                tubes: slot.tubes ?? [],
                researched: slot.researched ?? [],
                resources: upgradeResources(slot.resources),
                hours: slot.hours ?? 0,
                health: slot.health ?? {},
                evacuated: slot.evacuated ?? [],
                // A trip from before events existed carries on with none.
                trips: (slot.trips ?? []).map((trip) => ({
                  ...trip,
                  eventPoints: trip.eventPoints ?? [],
                  events: trip.events ?? [],
                  waitHours: trip.waitHours ?? 0,
                })),
                tripLog: (slot.tripLog ?? []).map((report) => ({ ...report, events: report.events ?? [] })),
                tripNews: slot.tripNews ?? null,
                weather: slot.weather ?? null,
                nextWeatherAt: slot.nextWeatherAt ?? (slot.hours ?? 0) + calmHours(Math.random()),
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
