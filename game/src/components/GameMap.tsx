import { Menu } from "@base-ui/react/menu"
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { BuildPanel, type BuildTool } from "@/components/BuildPanel"
import { Bar } from "@/components/CrewPanel"
import { ResourceIcon } from "@/components/ResourceIcon"
import { ExploreMap } from "@/components/ExploreMap"
import { ResearchPanel } from "@/components/ResearchPanel"
import { ResourceBar } from "@/components/ResourceBar"
import { useSettings } from "@/lib/settings"
import { StormOverlay } from "@/components/StormOverlay"
import { explorePlace } from "@/content/explore"
import { exploreEvent } from "@/content/exploreEvents"
import { moduleType, type ModuleTypeId, moduleUnlockedBy } from "@/content/modules"
import { eraColor, researchProject } from "@/content/research"
import { RESOURCE_TYPES, type ResourceId, type Resources } from "@/content/resources"
import { loadRichness } from "@/data/mineralMaps"
import { weatherEvent, type WeatherId } from "@/content/weather"
import { createMapView, type ClickKeys, type MapView } from "@/map/mapView"
import { formatSite, type MarsSite } from "@/map/marsSite"
import { loadTerrain, type Cell, type VoxelTerrain } from "@/map/voxelTerrain"
import {
  FREE,
  TUBE,
  checkModule,
  checkTubes,
  connectedGroups,
  landerFootprint,
  isDecayed,
  moduleAt,
  occupancy,
  placementOrigin,
  tubeRun,
  type Base,
  type LanderSpot,
  type Rect,
} from "@/sim/base"
import { describeFinds, type Trip, type TripNews, type TripReport } from "@/sim/explore"
import { cannotExplore, researchRate, urgentNeedOf } from "@/sim/crewLife"
import type { CrewMember } from "@/sim/lifeSupport"
import { workSpeed } from "@/sim/pawn"
import type { LogEntry, Pawn } from "@/sim/types"
import { buildNavigation, pressurizedCells, syncNavigation } from "@/sim/navigation"
import { depositAt, depositIdOf, generateDeposits, seedFrom, type Deposit, type MineralId } from "@/sim/deposits"
import { miningChoices, sendToMine, syncDepositStations, type MiningChoice } from "@/sim/tasks"
import { TaskMenu } from "@/components/TaskMenu"
import {
  addPawn,
  cancelOrder,
  clearSelection,
  getZone,
  handleClick,
  isWalkable,
  issueOrder,
  orderGroup,
  stationAt,
  pawnsAt,
  removePawn,
  scaleFor,
  selectPawns,
  stepPathing,
  type ClickResult,
  type Mover,
  type Order,
  type PathingEvent,
  type Tile,
  type World,
} from "@/sim/pathing"
import { claimedLabCount, isLab, keepHidersResearching, labOf, labSpeed, pickLabWorker, sendResearcher, shelterRule, staffedLabs } from "@/sim/labs"
import type { CrewSpot } from "@/sim/saves"
import { GAME_HOURS_PER_SECOND, formatRealTime } from "@/sim/clock"
import { DAYLIGHT_HOURS, darkness, isNight } from "@/sim/dayNight"
import { GAME_SPEEDS, gameSpeedStore, useGameSpeed } from "@/lib/gameSpeed"
import { hoursLeft, type ResearchProgress } from "@/sim/research"
import { onNebulaChange, playSfx, playingNebula } from "@/lib/sound"
import { nebula as nebulaById, nebulaCodexId } from "@/content/nebulae"
import { NebulaDialog } from "@/components/NebulaCard"
import { progressStore } from "@/sim/progress"
import type { Weather } from "@/sim/weather"
import { HOURS_PER_DAY, TEST_ERUPTION_TRAVEL_HOURS, type TestSpaceEvent } from "@/sim/calendar"

/*
 * The base map screen: the ground around the expedition's landing site, built
 * from NASA imagery and elevation (see map/), with the lander and the base on
 * it. For now the base (modules, and the tubes between them) is built by hand
 * from the Build bar (Build in the Actions dropdown). The ` key opens the same bar as the dev
 * console, where every module can be built whatever has been researched.
 * Modules and tubes turn see-through so the crew inside can be seen and clicked: only the module
 * someone is in, and the piece of tube someone is walking along. A click on a module opens up
 * every module to look inside (another click closes them up again).
 * The crew (sim/crewLife.ts: occupations, traits, needs, radiation, statuses) appear beside the
 * lander once it's down. Click one, then click where to send them (sim/pathing moves them).
 * The crew rules can take over: in a storm, or when injured, short of oxygen or at the
 * radiation limit, a crewmate heads inside and stays there.
 * Where they stand isn't saved yet, so they start beside the lander each time the map opens.
 * An astronaut whose health runs out is evacuated: gone from the map for good.
 * Astronauts sent out from the explore map (Explore in the Actions dropdown) are off this map until they are back.
 * Crew out on the surface, outside the modules and tubes, breathe the base's oxygen faster
 * (see sim/navigation.ts and sim/lifeSupport.ts).
 * The panels copy the look of MainMenu.
 */

/** A crewmate's name from their id. */
type NameOf = (id: string) => string
/** Suit colours for the map, by crewmate id (the crew system keeps them as "#rrggbb"). */
const suitColors = (crew: readonly Pawn[]): Record<string, number> =>
  Object.fromEntries(crew.map((p) => [p.id, parseInt(p.color.slice(1), 16)]))

/** How strong the night's shade over the map gets, from 0 to 1. Kept low enough that the map can still be read. */
const NIGHT_SHADE = 0.6

/** How full each astronaut's own oxygen tank is (0-100), by id, for the bars above them on the map. */
const oxygenLevels = (crew: readonly Pawn[]): Record<string, number> =>
  Object.fromEntries(crew.map((p) => [p.id, p.needs.oxygen]))

/** Each astronaut's health (0-100), by id, for the bar that shows above them on the map once they're hurt. */
const healthLevels = (crew: readonly Pawn[]): Record<string, number> =>
  Object.fromEntries(crew.map((p) => [p.id, p.health]))

/** Free open ground right round the lander, south side first, for the crew to step out onto. */
function spotsBesideLander(world: World, footprint: Rect): Tile[] {
  const { col, row, width, height } = footprint
  const ring: Tile[] = []
  for (let x = col - 1; x <= col + width; x++) ring.push({ x, y: row + height })
  for (let y = row; y < row + height; y++) ring.push({ x: col - 1, y }, { x: col + width, y })
  for (let x = col - 1; x <= col + width; x++) ring.push({ x, y: row - 1 })
  return ring.filter((t) => isWalkable(world, t) && getZone(world.grid, t.x, t.y) === "outside")
}

/** Name of the place a work order sends crew to (a module). */
function placeName(world: World, stationId: string) {
  const station = world.stations.find((s) => s.id === stationId)
  return station ? moduleType(station.kind as ModuleTypeId).name : "there"
}

/** A mineral's name, e.g. "Gold". */
const mineralName = (mineral: string) => RESOURCE_TYPES.find((type) => type.id === mineral)?.name ?? mineral

/** Where a work order sends crew, as words: "to mine the Gold deposit" or "to work in the Habitat". */
function workPlace(world: World, stationId: string) {
  if (depositIdOf(stationId)) {
    const station = world.stations.find((s) => s.id === stationId)
    return `to mine the ${station ? mineralName(station.kind) : "mineral"} deposit`
  }
  return `to work in the ${placeName(world, stationId)}`
}

/** A task on an astronaut's task list, in a few words: "Mine Gold", "Work in the Habitat". */
function taskName(world: World, order: Order) {
  if (order.kind === "move") return "Walk to a spot"
  if (depositIdOf(order.stationId)) {
    const station = world.stations.find((s) => s.id === order.stationId)
    return `Mine ${station ? mineralName(station.kind) : "a deposit"}`
  }
  return `Work in the ${placeName(world, order.stationId)}`
}

/** An astronaut's task list: what they're doing now and what comes after it, for the task menu. */
function taskList(world: World, mover: Mover): { now: string; next: string[] } {
  const next = mover.queue.map((order) => taskName(world, order))
  // An urgent need (air, shelter from a storm…) comes first; the player's task waits for it.
  if (mover.interrupt) {
    const resume = mover.interrupt.resume
    return { now: `Seeing to an urgent need (${mover.interrupt.need})`, next: resume ? [taskName(world, resume), ...next] : next }
  }
  if (!mover.order) return { now: "Nothing", next }
  const task = taskName(world, mover.order)
  return { now: mover.status === "working" ? task : `${task} (on the way)`, next }
}

/** Every cell of a rectangle. */
const cellsOf = (rect: Rect): Cell[] =>
  Array.from({ length: rect.width * rect.height }, (_, i) => ({
    col: rect.col + (i % rect.width),
    row: rect.row + Math.floor(i / rect.width),
  }))

/** The footprint a module of this type would have, centred on `cell`. */
function moduleRectAt(type: ModuleTypeId, cell: Cell): Rect {
  const { width, height } = moduleType(type)
  return { ...placementOrigin(type, cell), width, height }
}

/** A plain-words line about what a click on the map did with the crew. */
function describeClick(world: World, result: ClickResult, nameOf: NameOf): string {
  const listNames = (ids: string[]) => ids.map(nameOf).join(", ")
  switch (result.kind) {
    case "selected":
      return `${listNames(result.pawnIds)} selected. Click where to send them, a module to work in, or a mineral deposit to mine. Click an astronaut for their task list.`
    case "deselected":
      return "Nobody selected."
    case "nothing":
      return "Click an astronaut first."
    case "failed":
      return result.reason
    case "ordered": {
      const where = result.order.kind === "work" ? workPlace(world, result.order.stationId) : "there"
      const parts: string[] = []
      if (result.started.length) parts.push(`${listNames(result.started)}: on the way ${where}.`)
      if (result.queued.length) parts.push(`${listNames(result.queued)}: added to the queue.`)
      if (result.deferred.length) parts.push(`${listNames(result.deferred)}: will go after something urgent.`)
      for (const f of result.failed) parts.push(`${nameOf(f.pawnId)}: ${f.reason}`)
      return parts.join(" ")
    }
  }
}

/** Crew events worth telling the player about, as plain words. `kindOf` is a station's kind (e.g. "research"). */
function describeEvent(event: PathingEvent, nameOf: NameOf, kindOf: (stationId: string) => string | undefined): string | null {
  switch (event.type) {
    case "blocked":
    case "cancelled":
    case "needUnmet":
      return `${nameOf(event.pawnId)}: ${event.reason}`
    case "workStarted":
      return kindOf(event.stationId) === "research" || kindOf(event.stationId) === "research-pro"
        ? `${nameOf(event.pawnId)} is doing research in the Research Lab.`
        : null
    case "needInterrupt":
      if (event.need === "rest") return `${nameOf(event.pawnId)} is sleepy and going to bed in the Habitat.`
      return event.need === "shelter" ? `${nameOf(event.pawnId)} is heading inside to shelter.` : null
    case "needMet":
      return event.need === "rest" ? `${nameOf(event.pawnId)} woke up, rested.` : null
    case "exposureChanged":
      return event.exposure === "outside"
        ? `${nameOf(event.pawnId)} stepped outside onto the surface.`
        : `${nameOf(event.pawnId)} is back inside.`
    default:
      return null
  }
}

/** A resource's colour from content/resources.ts, for the icons in the Crew list. */
const resourceColor = (id: ResourceId) => RESOURCE_TYPES.find((type) => type.id === id)?.color ?? 0xffffff

const kickerClass = "text-xs font-medium uppercase tracking-[0.4em] text-orange-300/80"
const panelClass = "border border-white/15 bg-neutral-950/80 px-5 py-3 backdrop-blur-sm"
const buttonClass =
  "pointer-events-auto border border-white/15 bg-neutral-950/80 px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] backdrop-blur-sm transition hover:border-orange-400/70 hover:bg-orange-950/85 hover:text-orange-100 focus-visible:outline-2 focus-visible:outline-orange-400"

type Loaded = { key: string; terrain: VoxelTerrain } | { key: string; error: string }

/** MOLA heights are only precise to about 115 m, so don't show more than that. */
function formatElevation(metres: number) {
  const rounded = Math.round(metres / 10) * 10
  return `about ${rounded < 0 ? "−" : ""}${Math.abs(rounded).toLocaleString("en-US")} m`
}

export function GameMap({
  name,
  site,
  landed,
  onLanded,
  modules,
  tubes,
  onBaseChange,
  researched,
  researchProgress,
  onStartResearch,
  resources,
  crew,
  crewLog,
  evacuated,
  crewSpots,
  trips,
  tripLog,
  tripNews,
  onSendExploring,
  weather,
  onWeather,
  stormWarning,
  onStormSoon,
  onSpaceEvent,
  onTripEvent,
  onResetMap,
  era,
  landers,
  day,
  dayProgress,
  spaceNews,
  eraHistory,
  onNextEra,
  onTimePassed,
  deposits,
  onDepositsGenerated,
  onResearchOpenChange,
  onExit,
}: {
  name: string
  site: MarsSite
  /** Whether this expedition's lander is already down. If not, the landing plays. */
  landed: boolean
  onLanded: () => void
  /** The base: its modules, and every cell with a piece of tube on it. */
  modules: Base["modules"]
  tubes: Base["tubes"]
  onBaseChange: (base: Base) => void
  /** Ids of the research projects this expedition has finished. */
  researched: string[]
  /** The project being researched and the work done on each (see sim/research.ts). */
  researchProgress: ResearchProgress
  /** Makes a project the one being researched. It moves on while astronauts work in Research Labs. */
  onStartResearch: (projectId: string) => void
  /** How much of each resource the base has. */
  resources: Resources
  /** This era's crew and everything about them (sim/crewLife.ts). */
  crew: Pawn[]
  /** What has happened to the crew lately, oldest first. */
  crewLog: LogEntry[]
  /** Ids of the astronauts who were evacuated to Earth when their health ran out. */
  evacuated: string[]
  /** Where the crew at the base were when the map was last open (see sim/saves.ts). */
  crewSpots: CrewSpot[]
  /** The groups of astronauts out exploring right now, and what the last few trips brought back (newest first). */
  trips: Trip[]
  tripLog: TripReport[]
  /** The last event that happened to a group out exploring, or null. */
  tripNews: TripNews | null
  onSendExploring: (placeId: string, crewIds: string[]) => void
  /** The weather event going on right now, or null in calm weather. */
  weather: Weather
  /** Starts a weather event now, or with null ends the one going on (from the Build panel). */
  onWeather: (id: WeatherId | null) => void
  /** The storm coming soon and the game-hours until it starts (see stormWarning in sim/weather.ts), or null. */
  stormWarning: { id: WeatherId; hoursLeft: number } | null
  /** For testing from the Build panel: brings a radiation storm close, so its warning shows. */
  onStormSoon: () => void
  /** For testing from the Build panel: puts a test space event on the calendar now. */
  onSpaceEvent: (kind: TestSpaceEvent) => void
  /** For testing from the Build panel: makes an explore event happen to the first group out exploring. */
  onTripEvent: (eventId: string) => void
  /**
   * Starts the expedition over at the same landing site, as if opened for the first time (from
   * the Build panel). This whole screen is then thrown away and built again, so the landing replays.
   */
  onResetMap: () => void
  /** Which era the expedition is in (see sim/saves.ts). Modules from an earlier era are drawn worn down. */
  era: number
  /** Every lander on the map, oldest first; the last is this era's. */
  landers: LanderSpot[]
  /** The calendar day the player sees: Day 1 on the era's first day (see sim/calendar.ts). */
  day: number
  /** How far through the current day the clock is, from 0 to 1. */
  dayProgress: number
  /** The latest real space event from NASA's records, as a line for the player, or null. */
  spaceNews: string | null
  /**
   * For when the era ends: the real dates it ran over (as the player would read them) and the
   * real events NASA recorded in that time, each as a line. Revealed only on the era's end.
   */
  eraHistory: { from: string; to: string; events: string[]; quietEruptions: number }
  /**
   * Ends this era and starts the next on the same map, with a new crew in a new lander (from the
   * game over screen or the Build panel). This screen is then built again, so the new landing plays.
   */
  onNextEra: () => void
  /**
   * Called about once a second while the crew is out of the lander, with the game-hours that
   * went by, the astronauts who lived through them (and whether each is outside right now), and
   * the lab work done in that time (game-hours × Research Labs with their astronaut inside), and
   * where the crew at the base are now, so they are back there next time the map opens.
   */
  onTimePassed: (hours: number, crew: CrewMember[], labHours: number, spots: CrewSpot[]) => void
  /** The map's mineral deposits, or null until they've been generated (see sim/deposits.ts). */
  deposits: Deposit[] | null
  /** Called once with the deposits generated for this map, to keep in the save. */
  onDepositsGenerated: (deposits: Deposit[]) => void
  /** Told when the research screen opens or closes, so App can put its Backpack and Crew buttons away behind it. */
  onResearchOpenChange: (open: boolean) => void
  onExit: () => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  // Decided once, when the screen opens. `landed` turns true partway through the
  // landing, and that mustn't rebuild the map underneath it.
  const [showLanding] = useState(!landed)
  // The era and its landers only change when a new era starts, and the screen is built again then.
  const [mapEra] = useState({ era, landers })
  /** Every astronaut has been evacuated: the era is over and the game stands still until the player moves on. */
  /** It is night at the base: the map is dark and the crew sleep (see sim/dayNight.ts). */
  const night = isNight(dayProgress * HOURS_PER_DAY)
  const gameOver = crew.length > 0 && crew.every((member) => member.evacuated || evacuated.includes(member.id))
  /** The crew as of the last render, for the frame loop and callbacks (which outlive a render). */
  const rosterRef = useRef(crew)
  /** How fast the clock runs (1×, 2× or 3×); the frame loop reads it from gameSpeedStore. */
  const gameSpeed = useGameSpeed()
  // Both read the ref when called, so they never go stale and never need to change.
  const nameOf: NameOf = useCallback((id) => rosterRef.current.find((p) => p.id === id)?.name ?? id, [])
  const listNames = useCallback((ids: string[]) => ids.map(nameOf).join(", "), [nameOf])
  const onLandedRef = useRef(onLanded)
  useEffect(() => {
    onLandedRef.current = onLanded
  })
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [hovered, setHovered] = useState<Cell | null>(null)
  const [view, setView] = useState<MapView | null>(null)
  const [buildOpen, setBuildOpen] = useState(false)
  /** The Build bar is open as the dev console (the ` key): everything in it is unlocked. */
  const [devConsole, setDevConsole] = useState(false)
  const [researchOpen, setResearchOpen] = useState(false)
  /** The nebula card showing over the map, and whether it was just added to the Codex. */
  const [nebulaCard, setNebulaCard] = useState<{ id: string; isNew: boolean } | null>(null)
  /** The nebula sonification playing in the background music right now, if any (see lib/sound.ts). */
  const nebulaPlaying = useSyncExternalStore(onNebulaChange, playingNebula)
  /** The playing nebula whose card has been looked at already: its "!" goes until the next one plays. */
  const [nebulaSeen, setNebulaSeen] = useState<string | null>(null)
  /** Evacuation shuttles in flight. The "era over" screen waits for the last one to leave. */
  const [shuttles, setShuttles] = useState(0)
  /** Ids of the astronauts a shuttle is on its way for, so nobody is sent two. */
  const shuttleForRef = useRef(new Set<string>())
  // App's Backpack and Crew buttons sit above everything, so tell it while research is open.
  useEffect(() => {
    onResearchOpenChange(researchOpen)
    return () => onResearchOpenChange(false)
  }, [researchOpen, onResearchOpenChange])
  const [exploreOpen, setExploreOpen] = useState(false)
  /** The map's data credits, bottom right. Folded away to start with. */
  const [creditsOpen, setCreditsOpen] = useState(false)
  /** Whether the credits have been opened yet: only then can they be put away with the x. */
  const [creditsSeen, setCreditsSeen] = useState(false)
  /** Put away with the x for good (a setting kept in this browser), so the button stops covering the map. */
  const creditsDismissed = useSettings((s) => s.mapCreditsDismissed)
  const setSettings = useSettings((s) => s.setSettings)
  const [tool, setTool] = useState<BuildTool>(null)
  const [message, setMessage] = useState<string | null>(null)
  /** Where the run of tube being laid starts, once the first click of the tube tool has set it. */
  const [tubeStart, setTubeStart] = useState<Cell | null>(null)
  /** Where the crew are and what they're doing (sim/pathing). Built once the map has loaded. */
  const crewRef = useRef<{ terrain: VoxelTerrain; world: World } | null>(null)
  const [selectedCrew, setSelectedCrew] = useState<string[]>([])
  const [crewMessage, setCrewMessage] = useState<string | null>(null)
  /**
   * The astronaut whose task list is open (right-click them), where on the screen it opens, and
   * what it shows, read when it opened.
   */
  const [taskMenu, setTaskMenu] = useState<{
    pawnId: string
    x: number
    y: number
    now: string
    next: string[]
    mining: MiningChoice[]
  } | null>(null)
  /** When the task list was last closed by a click outside it: that click only closes it. */
  const menuClosedAtRef = useRef(0)
  const closeTaskMenu = useCallback((how: "outside" | "escape") => {
    if (how === "outside") menuClosedAtRef.current = performance.now()
    setTaskMenu(null)
  }, [])
  /** The astronaut picked to Move from their task list: the next click on the map is where they go. */
  const [movingFor, setMovingFor] = useState<string | null>(null)
  /** Whether the Crew list on the left is unfolded. */
  const [crewOpen, setCrewOpen] = useState(true)
  /** True once the player has clicked a module to see inside the base: every module is see-through until the next click on one. */
  const [baseOpen, setBaseOpen] = useState(false)
  /**
   * Research Labs with their astronaut inside (`staffed`) and with one sent to them, there or on
   * the way (`claimed`). Mirrored from the frame loop only when they change.
   */
  const [labCrew, setLabCrew] = useState({ staffed: 0, claimed: 0 })
  /** Set when the last astronaut working in a lab leaves it while something is being researched. */
  const [researchStopped, setResearchStopped] = useState(false)
  /** Ids of the astronauts in a Research Lab doing research right now, for the Crew list. */
  const [researchers, setResearchers] = useState<string[]>([])

  // What's on screen belongs to this site and this try; anything else is still loading.
  const key = `${site.lat},${site.lon},${attempt}`
  const current = loaded?.key === key ? loaded : null
  const terrain = current && "terrain" in current ? current.terrain : null
  const error = current && "error" in current ? current.error : null

  useEffect(() => {
    let cancelled = false
    loadTerrain({ lat: site.lat, lon: site.lon }).then(
      (terrain) => {
        if (!cancelled) setLoaded({ key, terrain })
      },
      (reason: unknown) => {
        if (!cancelled) setLoaded({ key, error: reason instanceof Error ? reason.message : String(reason) })
      },
    )
    return () => {
      cancelled = true
    }
  }, [site.lat, site.lon, key])

  const base = useMemo<Base>(() => ({ modules, tubes, landers }), [modules, tubes, landers])
  // What stands on each cell, worked out once per change to the base.
  const grid = useMemo(() => (terrain ? occupancy(terrain.size, base) : null), [terrain, base])
  /** Cells of modules and tubes: crew there breathe at the normal rate (see pressurizedCells). */
  const pressurized = useMemo(() => (terrain && grid ? pressurizedCells(terrain.size, base, grid) : null), [terrain, base, grid])
  const pressurizedRef = useRef(pressurized)
  useEffect(() => {
    pressurizedRef.current = pressurized
  }, [pressurized])
  const groupCount = useMemo(
    () => (terrain && grid ? connectedGroups(terrain.size, base, grid).length : 0),
    [terrain, base, grid],
  )

  /** Whether any of these cells has a mineral deposit on it. Nothing can be built on one. */
  const onDeposit = useCallback(
    (cells: Cell[]) => cells.some((cell) => deposits !== null && depositAt(deposits, cell) !== undefined),
    [deposits],
  )

  /**
   * Sonification Stations that show a "!": every one still standing (not decayed from an earlier
   * era) while a nebula sonification is playing whose card hasn't been looked at yet.
   */
  const nebulaAlerts = useMemo(
    () =>
      nebulaPlaying && nebulaPlaying !== nebulaSeen && nebulaById(nebulaPlaying)
        ? modules.filter((module) => module.type === "observatory" && !isDecayed(module, era)).map((module) => module.id)
        : [],
    [modules, era, nebulaPlaying, nebulaSeen],
  )
  useEffect(() => {
    view?.setAlerts(nebulaAlerts)
  }, [view, nebulaAlerts])

  /** Shows the playing nebula's card, and adds it to the Mars Codex the first time. */
  const openNebulaCard = (id: string) => {
    const codexId = nebulaCodexId(id)
    const { codexIds, setProgress } = progressStore.getState()
    const isNew = !codexIds.includes(codexId)
    if (isNew) setProgress({ codexIds: [...codexIds, codexId] })
    setNebulaSeen(id)
    setNebulaCard({ id, isNew })
    playSfx("open")
  }

  const handleCellClick = (cell: Cell, keys: ClickKeys, screen: { x: number; y: number }) => {
    if (!terrain || !grid) return
    // With no dev tool picked, clicks are for the crew: pick an astronaut, then where to send them.
    if (!tool) {
      const crew = crewRef.current?.world
      if (!crew) return
      const here = { x: cell.col, y: cell.row }
      // A click that closed the task list does nothing else, unless it was on another astronaut.
      const closedMenu = performance.now() - menuClosedAtRef.current < 500
      menuClosedAtRef.current = 0
      // After Move in an astronaut's task list, this click is where they go (shift adds it to their list).
      if (movingFor) {
        setMovingFor(null)
        if (!crew.movers[movingFor]) return setCrewMessage(null)
        setCrewMessage(describeClick(crew, orderGroup(crew, [movingFor], { kind: "move", target: here }, keys.shift), nameOf))
        return
      }
      // Clicking an astronaut picks them and opens their task list. Shift-click picks several instead.
      const [astronaut] = pawnsAt(crew, here)
      if (astronaut && !keys.shift) {
        selectPawns(crew, [astronaut.pawnId])
        setSelectedCrew([astronaut.pawnId])
        const mining = deposits ? miningChoices(crew, deposits, astronaut.pawnId) : []
        setTaskMenu({ pawnId: astronaut.pawnId, ...screen, ...taskList(crew, astronaut), mining })
        setCrewMessage(`${nameOf(astronaut.pawnId)} selected. Pick a task, or click where to send them.`)
        return
      }
      if (closedMenu) return
      const tile = { x: cell.col, y: cell.row }
      // A Sonification Station with a "!": its card shows the nebula the music is playing.
      const station = moduleAt(modules, cell)
      if (station && nebulaAlerts.includes(station.id) && crew.selectedPawnIds.length === 0 && nebulaPlaying) {
        openNebulaCard(nebulaPlaying)
        return
      }
      // With nobody selected, clicking a module (not an astronaut in it) opens up every module to
      // see inside, or closes them all again.
      if (moduleAt(modules, cell) && crew.selectedPawnIds.length === 0 && pawnsAt(crew, tile).length === 0) {
        setBaseOpen(!baseOpen)
        setCrewMessage(
          baseOpen ? "Closed up the modules." : "You can see inside every module now. Click a module again to close them up.",
        )
        return
      }
      // A module left from an earlier era has decayed: nobody can go inside it (see sim/navigation.ts).
      const clicked = moduleAt(modules, cell)
      if (clicked && isDecayed(clicked, era) && crew.selectedPawnIds.length > 0) {
        setCrewMessage(`This ${moduleType(clicked.type).name} is from an earlier era and has fallen apart. Nobody can go inside.`)
        return
      }
      // A Research Lab holds one astronaut: send just one of the selected crew, and none if it's taken.
      const lab = crew.selectedPawnIds.length > 0 && pawnsAt(crew, tile).length === 0 ? stationAt(crew, tile) : undefined
      if (lab && isLab(lab)) {
        const pick = pickLabWorker(crew, crew.selectedPawnIds, lab.id, weather !== null)
        if (!pick.ok) {
          setCrewMessage(`Only one astronaut fits in a Research Lab, and ${nameOf(pick.worker)} is already in this one.`)
          return
        }
        const said = describeClick(crew, orderGroup(crew, [pick.pawnId], { kind: "work", stationId: lab.id }, keys.shift), nameOf)
        setCrewMessage(
          pick.left.length > 0 ? `${said} Only one astronaut fits in a Research Lab, so ${listNames(pick.left)} stayed put.` : said,
        )
        setSelectedCrew([...crew.selectedPawnIds])
        return
      }
      setCrewMessage(describeClick(crew, handleClick(crew, tile, { shift: keys.shift }), nameOf))
      setSelectedCrew([...crew.selectedPawnIds])
      return
    }
    const { size } = terrain

    if (tool.kind === "remove") {
      const target = moduleAt(modules, cell)
      if (target) {
        onBaseChange({ modules: modules.filter((module) => module.id !== target.id), tubes })
        return setMessage(`Removed the ${moduleType(target.type).name}.`)
      }
      if (grid[cell.row * size + cell.col] === TUBE) {
        onBaseChange({ modules, tubes: tubes.filter((tube) => tube.col !== cell.col || tube.row !== cell.row) })
        return setMessage("Removed a block of tube.")
      }
      return setMessage("There is nothing to remove there.")
    }

    if (tool.kind === "tube") {
      // The first click picks where the run starts; the second lays it and starts the next run from its end.
      const run = tubeStart ? tubeRun(tubeStart, cell) : [cell]
      const check = checkTubes(size, grid, run, modules)
      if (!check.ok) return setMessage(check.reason)
      if (onDeposit(run)) return setMessage("There's a mineral deposit in the way. Mine it out first, or go round it.")
      if (!tubeStart) {
        setTubeStart(cell)
        return setMessage("Now click where this run of tube should end.")
      }
      onBaseChange({ modules, tubes: [...tubes, ...check.added] })
      setTubeStart(run[run.length - 1])
      const blocks = check.added.length
      return setMessage(
        `Laid ${blocks} ${blocks === 1 ? "block" : "blocks"} of tube. Click again to carry on from here, or press Esc.`,
      )
    }

    const check = checkModule(size, grid, tool.type, placementOrigin(tool.type, cell), crypto.randomUUID(), terrain.levels)
    if (!check.ok) return setMessage(check.reason)
    if (onDeposit(cellsOf(moduleRectAt(tool.type, cell)))) {
      return setMessage("There's a mineral deposit there. Mine it out first, or build somewhere else.")
    }
    onBaseChange({ modules: [...modules, check.module], tubes })
    setMessage(`Placed a ${moduleType(tool.type).name}. It isn't joined to anything until you lay a tube to it.`)
  }
  /** Move, from an astronaut's task list: the next click on the map is where they go. */
  const moveFromMenu = (pawnId: string) => {
    setTaskMenu(null)
    setMovingFor(pawnId)
    setCrewMessage(`Click where ${nameOf(pawnId)} should go. Shift-click adds it to their task list. Esc cancels.`)
  }
  /** Sends the astronaut whose task list is open to mine (one mineral, or the nearest deposit). */
  const mineFromMenu = (pawnId: string, mineral: MineralId | null, queue: boolean) => {
    const crew = crewRef.current?.world
    setTaskMenu(null)
    if (!crew || !deposits) return
    setCrewMessage(describeClick(crew, sendToMine(crew, deposits, pawnId, mineral, queue), nameOf))
  }
  /** Stops the astronaut whose task list is open, and clears the list. */
  const stopFromMenu = (pawnId: string) => {
    const crew = crewRef.current?.world
    setTaskMenu(null)
    if (!crew) return
    cancelOrder(crew, pawnId)
    setCrewMessage(`${nameOf(pawnId)} stopped. Their task list is clear.`)
  }
  // The map calls these through refs, so they always get the latest tool and modules without being rebuilt.
  const onCellClickRef = useRef(handleCellClick)
  useEffect(() => {
    onCellClickRef.current = handleCellClick
  })

  useEffect(() => {
    const host = hostRef.current
    if (!host || !terrain) return
    const abort = new AbortController()
    const starting = createMapView(
      host,
      terrain,
      {
        onHover: setHovered,
        onCellClick: (cell, keys, screen) => onCellClickRef.current(cell, keys, screen),
        onLanded: showLanding ? () => onLandedRef.current() : null,
      },
      mapEra,
      abort.signal,
    )
    starting.then(
      (created) => {
        if (!abort.signal.aborted) setView(created)
      },
      (reason: unknown) => {
        setLoaded({ key, error: reason instanceof Error ? reason.message : String(reason) })
      },
    )
    return () => {
      abort.abort()
      setHovered(null)
      setView(null)
      // The view can only be torn down once it has finished starting up.
      starting.then((created) => created?.destroy()).catch(() => {})
    }
  }, [terrain, key, showLanding, mapEra])

  useEffect(() => {
    if (view && grid) view.setBase(base, grid)
  }, [view, base, grid])

  // The crew's walkable map follows the base: rebuilt for a new map, updated when something is built.
  useEffect(() => {
    if (!terrain) return
    const crew = crewRef.current
    if (crew && crew.terrain === terrain) syncNavigation(crew.world, terrain, base)
    else crewRef.current = { terrain, world: buildNavigation(terrain, base) }
  }, [terrain, base])

  // The first time a map opens, its mineral deposits are generated from its terrain and from
  // NASA's global mineral maps (see sim/deposits.ts and data/mineralMaps.ts). The same site always
  // gets the same deposits. If NASA's maps don't answer, the site counts as normally rich.
  const onDepositsGeneratedRef = useRef(onDepositsGenerated)
  useEffect(() => {
    onDepositsGeneratedRef.current = onDepositsGenerated
  })
  const generatingRef = useRef(false)
  useEffect(() => {
    if (!terrain || !grid || deposits !== null || generatingRef.current) return
    generatingRef.current = true
    const built = grid
    loadRichness(site).then(({ richness }) => {
      const center = { col: Math.floor(terrain.size / 2), row: Math.floor(terrain.size / 2) }
      // Never under the lander or anything already built.
      const found = generateDeposits(terrain, center, seedFrom(`${site.lat},${site.lon}`), richness, (i) => built[i] !== FREE)
      onDepositsGeneratedRef.current(found)
    })
  }, [terrain, grid, deposits, site])

  // Each deposit is a place on the crew's map to work at (mine), standing beside it. A deposit
  // that's mined out is taken off, which stops anyone mining it (see sim/tasks.ts).
  const minedOutRef = useRef<Set<string> | null>(null)
  useEffect(() => {
    const crew = crewRef.current
    if (!terrain || !crew || crew.terrain !== terrain || !deposits) return
    const gone = syncDepositStations(crew.world, deposits)
    const left = new Set(crew.world.stations.filter((station) => depositIdOf(station.id)).map((station) => station.id))
    // Only deposits that run out while the map is open are news (not ones gone before it opened).
    if (minedOutRef.current) {
      const last = gone.find((station) => minedOutRef.current?.has(station.id))
      if (last) setCrewMessage(`The ${mineralName(last.kind)} deposit is mined out.`)
    }
    minedOutRef.current = left
  }, [terrain, base, deposits])

  useEffect(() => {
    view?.setDeposits(deposits ?? [])
  }, [view, deposits])

  /** Ids of the astronauts out exploring: they are off this map until they are back. */
  const away = useMemo(() => trips.flatMap((trip) => trip.crew), [trips])
  // The astronaut whose task list is open. If they've left the map (out exploring, or evacuated), it closes.
  const taskMember = taskMenu ? crew.find((m) => m.id === taskMenu.pawnId && !m.evacuated && !away.includes(m.id)) : undefined

  /** Where the crew were when the map was last open: used once, as they are put back on the map. */
  const savedSpotsRef = useRef(crewSpots)

  // Once the lander is down, the crew step out beside it. Later on this keeps the map in
  // step with who is at the base: someone who left to explore is taken off, someone who is back
  // (or was never put on) steps out beside the lander. When the map opens again, the crew are put
  // back where they were (see crewSpots), and anyone who was working in a Research Lab carries on.
  useEffect(() => {
    const nav = crewRef.current
    if (!landed || !terrain || !nav || nav.terrain !== terrain) return
    const { world } = nav
    for (const id of away) if (world.movers[id]) removePawn(world, id)
    const missing = crew.filter(
      (member) =>
        !member.evacuated && !evacuated.includes(member.id) && !away.includes(member.id) && !world.movers[member.id],
    )
    if (missing.length === 0) return
    const besideLander = []
    for (const member of missing) {
      const saved = savedSpotsRef.current.find((spot) => spot.id === member.id)
      savedSpotsRef.current = savedSpotsRef.current.filter((spot) => spot.id !== member.id)
      const tile = saved ? { x: saved.x, y: saved.y } : null
      const free =
        tile && tile.x >= 0 && tile.y >= 0 && tile.x < terrain.size && tile.y < terrain.size && isWalkable(world, tile) && pawnsAt(world, tile).length === 0
      if (!saved || !tile || !free) {
        besideLander.push(member)
        continue
      }
      addPawn(world, member.id, tile)
      if (saved.lab && world.stations.some((station) => station.id === saved.lab)) {
        issueOrder(world, member.id, { kind: "work", stationId: saved.lab })
      }
    }
    if (besideLander.length === 0) return
    const spots = spotsBesideLander(world, landerFootprint(terrain.size, base)).filter((spot) => pawnsAt(world, spot).length === 0)
    besideLander.forEach((member, i) => {
      if (spots[i]) addPawn(world, member.id, spots[i])
    })
  }, [landed, terrain, base, evacuated, away, crew])

  // A group that has just got back: say what they brought. (Reports from before the map opened are old news.)
  const lastReportRef = useRef(tripLog[0]?.id)
  useEffect(() => {
    const report = tripLog[0]
    if (!report || report.id === lastReportRef.current) return
    lastReportRef.current = report.id
    queueMicrotask(() =>
      setCrewMessage(
        `${listNames(report.crew)} came back from the ${explorePlace(report.placeId)?.name ?? "trip"} with ${describeFinds(report.finds)}.`,
      ),
    )
  }, [tripLog, listNames])

  // Something has just happened to a group out exploring: pass it on.
  const lastNewsRef = useRef(tripNews?.id)
  useEffect(() => {
    if (!tripNews || tripNews.id === lastNewsRef.current) return
    lastNewsRef.current = tripNews.id
    const event = exploreEvent(tripNews.eventId)
    if (!event) return
    queueMicrotask(() => setCrewMessage(`${listNames(tripNews.crew)}, out exploring: ${event.text}`))
  }, [tripNews, listNames])

  // Something has just happened to the crew (sim/crewLife.ts): pass the newest on.
  const lastLogRef = useRef(crewLog.length)
  useEffect(() => {
    if (crewLog.length === lastLogRef.current) return
    lastLogRef.current = crewLog.length
    const newest = crewLog[crewLog.length - 1]
    if (newest && newest.kind !== "info") queueMicrotask(() => setCrewMessage(newest.text))
  }, [crewLog])

  // An astronaut who has just been evacuated stops where they are, and the shuttle (the craft the
  // crew landed in) comes down to pick them up: they leave the map when it does.
  useEffect(() => {
    const crew = crewRef.current?.world
    if (!crew) return
    const leaving = evacuated.filter((id) => crew.movers[id] && !shuttleForRef.current.has(id))
    if (leaving.length === 0) return
    for (const id of leaving) {
      const board = () => {
        const world = crewRef.current?.world
        if (!world?.movers[id]) return
        removePawn(world, id)
        setSelectedCrew([...world.selectedPawnIds])
        // Drawn here too, because once the era is over the frame loop no longer draws the crew.
        view?.drawCrew(world, suitColors(rosterRef.current), oxygenLevels(rosterRef.current), healthLevels(rosterRef.current))
      }
      if (!view) {
        board()
        continue
      }
      cancelOrder(crew, id)
      shuttleForRef.current.add(id)
      view.flyShuttleTo(crew.movers[id].pos, board, () => {
        shuttleForRef.current.delete(id)
        setShuttles(shuttleForRef.current.size)
      })
    }
    // Out of an effect's own run, as the other map callbacks do, so the panel updates after the map has.
    queueMicrotask(() => {
      setShuttles(shuttleForRef.current.size)
      setSelectedCrew([...crew.selectedPawnIds])
      const why = leaving.map((id) => rosterRef.current.find((p) => p.id === id)?.evacuated?.reason).find(Boolean)
      setCrewMessage(
        `${listNames(leaving)} ${leaving.length === 1 ? "was" : "were"} evacuated to Earth to get well${why ? ` (${why})` : ""}.`,
      )
    })
  }, [evacuated, listNames, view])

  const onTimePassedRef = useRef(onTimePassed)
  /** Set when the map is being reset: game time not handed to the save yet belongs to the old game and is dropped. */
  const resettingRef = useRef(false)
  // The frame loop reads the weather through a ref, so a storm starting doesn't restart the loop.
  const stormRef = useRef(weather !== null)
  const someoneAwayRef = useRef(trips.length > 0)
  const gameOverRef = useRef(gameOver)
  const modulesRef = useRef(modules)
  const researchingRef = useRef(researchProgress.active !== null)
  useEffect(() => {
    modulesRef.current = modules
    researchingRef.current = researchProgress.active !== null
    onTimePassedRef.current = onTimePassed
    stormRef.current = weather !== null
    someoneAwayRef.current = trips.length > 0
    gameOverRef.current = gameOver
    rosterRef.current = crew
  })

  // Every frame: move the crew along, draw them, and pass on anything worth saying.
  useEffect(() => {
    if (!view) return
    // Game time that has gone by but isn't in the save yet. The save is written to the browser's
    // storage on every change, so time is handed over about once a second, not on every frame.
    const unsaved = { hours: 0, ms: 0, labHours: 0 }
    /** Labs staffed and claimed as last told to React, so it only re-renders when they change. */
    let shownLabs = { staffed: 0, claimed: 0 }
    /** Who was last shown as researching, as sorted ids joined by commas. */
    let shownResearchers = ""
    /** What was last made see-through for the crew inside, so the map is only told when it changes. */
    let shownInside = ""
    /** Fades only the modules someone is in, and only the pieces of tube someone is walking along. */
    const showCrewInside = (crew: World) => {
      const occupied = new Set<string>()
      const inTubes: Cell[] = []
      for (const mover of Object.values(crew.movers)) {
        const x = Math.round(mover.pos.x)
        const y = Math.round(mover.pos.y)
        if (getZone(crew.grid, x, y) === "outside") continue
        const inModule = moduleAt(modulesRef.current, { col: x, row: y })
        if (inModule) occupied.add(inModule.id)
        else inTubes.push({ col: x, row: y })
      }
      const ids = [...occupied].sort()
      const next = `${inTubes.map((c) => `${c.col},${c.row}`).sort().join(";")}:${ids.join(",")}`
      if (next === shownInside) return
      shownInside = next
      view.setOpenModules(ids)
      view.setOpenTubes(inTubes)
    }
    const handOver = () => {
      const world = crewRef.current?.world
      const cells = pressurizedRef.current
      const crew: CrewMember[] = Object.values(world?.movers ?? {}).map((mover) => ({
        id: mover.pawnId,
        outside: mover.exposure === "outside",
        // In a module or tube (see pressurizedCells).
        pressurized: Boolean(
          world && cells?.has(Math.round(mover.pos.y) * world.grid.width + Math.round(mover.pos.x)),
        ),
        workingAt: mover.status === "working" && mover.order?.kind === "work" ? mover.order.stationId : null,
        chattingWith: mover.idle?.kind === "chat" ? mover.idle.partnerId : null,
      }))
      // Where everyone at the base stands, and the lab each was sent to, for next time the map opens.
      const spots: CrewSpot[] = Object.values(world?.movers ?? {}).map((mover) => ({
        id: mover.pawnId,
        x: Math.round(mover.pos.x),
        y: Math.round(mover.pos.y),
        lab: world ? labOf(world, mover.pawnId) : null,
      }))
      if (unsaved.hours > 0 && !resettingRef.current) onTimePassedRef.current(unsaved.hours, crew, unsaved.labHours, spots)
      unsaved.hours = unsaved.ms = unsaved.labHours = 0
    }
    const stop = view.onFrame((deltaMs) => {
      const crew = crewRef.current?.world
      if (!crew) return
      // Once the era is over everything stands still: no clock, no weather, nobody moves.
      if (gameOverRef.current) {
        view.drawCrew(crew, suitColors(rosterRef.current), oxygenLevels(rosterRef.current), healthLevels(rosterRef.current))
        return
      }
      // A long gap (the tab was hidden) shouldn't make everyone teleport. At 2× or 3× the clock
      // runs that many times faster, so everything (walking, needs, research, weather) speeds up.
      const speed = gameSpeedStore.getState().speed
      const dtHours = (Math.min(deltaMs, 100) / 1000) * GAME_HOURS_PER_SECOND * speed
      // The crew rules decide what's urgent (sim/crewLife.ts): in a storm everyone needs shelter,
      // and so does anyone injured, short of oxygen or at the radiation limit. A Research Lab still
      // holds one astronaut, so nobody shelters in a lab someone else is using.
      const storm = stormRef.current
      const pawnOf = (id: string) => rosterRef.current.find((p) => p.id === id)
      const canFix = (need: string) => crew.stations.some((station) => station.provides.includes(need as never))
      const pathingOptions: Parameters<typeof stepPathing>[2] = {
        urgentNeed: (id) => urgentNeedOf(pawnOf(id), storm, canFix),
        workRate: (id) => {
          const pawn = pawnOf(id)
          return pawn ? workSpeed(pawn) : 1
        },
        // Someone asleep doesn't move, except to get to a bed (or indoors) once they've dozed off.
        walkSpeed: (id) =>
          pawnOf(id)?.activity === "sleeping" && !crew.movers[id]?.interrupt ? 0 : scaleFor(crew.grid).walkTilesPerHour,
        canShelterAt: storm ? shelterRule(crew) : undefined,
      }
      // Sped up, the crew walk in steps no bigger than at 1×, so they still turn corners and stop
      // at doors exactly where they would have.
      const events: ReturnType<typeof stepPathing> = []
      for (let i = 0; i < speed; i++) events.push(...stepPathing(crew, dtHours / speed, pathingOptions))
      if (storm) keepHidersResearching(crew)
      // Each lab with its astronaut inside puts that astronaut's work into the research: a trained
      // Researcher does more than anyone else (see researchRate). In a storm, an astronaut hiding in
      // a lab nobody was sent to counts as working in it.
      const inLabs = staffedLabs(crew, storm)
      const staffed = inLabs.length
      const labWork = inLabs.reduce((sum, lab) => sum + researchRate(pawnOf(lab.pawnId)) * labSpeed(crew, lab.stationId), 0)
      const researcherIds = inLabs.map((lab) => lab.pawnId).sort().join(",")
      if (researcherIds !== shownResearchers) {
        shownResearchers = researcherIds
        setResearchers(researcherIds ? researcherIds.split(",") : [])
      }
      const claimed = claimedLabCount(crew, storm)
      if (staffed !== shownLabs.staffed || claimed !== shownLabs.claimed) {
        // The last astronaut working in a lab just left it: research stops, and the player is told.
        if (shownLabs.staffed > 0 && staffed === 0 && researchingRef.current) {
          setResearchStopped(true)
          playSfx("locked")
        }
        if (staffed > 0) setResearchStopped(false)
        shownLabs = { staffed, claimed }
        setLabCrew(shownLabs)
      }
      // The clock starts once the crew has stepped out of the lander, and runs while anyone is
      // at the base or out exploring.
      if (Object.keys(crew.movers).length > 0 || someoneAwayRef.current) {
        unsaved.hours += dtHours
        unsaved.labHours += dtHours * labWork
        unsaved.ms += deltaMs
        if (unsaved.ms >= 1000) handOver()
      }
      view.drawCrew(crew, suitColors(rosterRef.current), oxygenLevels(rosterRef.current), healthLevels(rosterRef.current))
      showCrewInside(crew)
      const kindOf = (stationId: string) => crew.stations.find((station) => station.id === stationId)?.kind
      const said = events.map((event) => describeEvent(event, nameOf, kindOf)).filter((line) => line !== null)
      if (said.length > 0) setCrewMessage(said[said.length - 1])
    })
    return () => {
      stop()
      handOver()
    }
  }, [view, nameOf])

  // After a click on a module the whole base turns see-through, until the next click on one.
  useEffect(() => {
    view?.setSeeThrough(baseOpen)
  }, [view, baseOpen])

  // While a tool that builds is picked in the Build panel, the map shows what a click would build.
  useEffect(() => {
    if (!view || !terrain || !grid) return
    const { size } = terrain
    if (tool?.kind === "place") {
      const { id: type, width, height } = moduleType(tool.type)
      view.setPlacement({
        preview: (cell) => {
          const origin = placementOrigin(type, cell)
          const rect = { ...origin, width, height }
          const ok = checkModule(size, grid, type, origin, "new", terrain.levels).ok && !onDeposit(cellsOf(rect))
          return { rect, tubes: [], ok }
        },
      })
    } else if (tool?.kind === "tube") {
      view.setPlacement({
        preview: (cell) => {
          const run = tubeStart ? tubeRun(tubeStart, cell) : [cell]
          return { rect: null, tubes: run, ok: checkTubes(size, grid, run, modules).ok && !onDeposit(run) }
        },
      })
    } else {
      view.setPlacement(null)
    }
  }, [view, terrain, grid, tool, tubeStart, modules, onDeposit])

  const pickTool = (next: BuildTool) => {
    setTool(next)
    setTubeStart(null)
    setMessage(null)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // While the research tree or the explore map is open it has the keyboard: Esc closes it and nothing else happens.
      if (researchOpen || exploreOpen) {
        if (e.key === "Escape") {
          setResearchOpen(false)
          setExploreOpen(false)
        }
        return
      }
      // 1, 2 and 3 set how fast time runs.
      const picked = GAME_SPEEDS.find((speed) => e.key === String(speed))
      if (picked && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        gameSpeedStore.getState().setSpeed(picked)
        return
      }
      // The ` key opens the dev console, or closes it. Over the Build bar, it turns that into the dev console.
      if (e.code === "Backquote") {
        const closing = buildOpen && devConsole
        setBuildOpen(!closing)
        setDevConsole(!closing)
        setTool(null)
        setTubeStart(null)
        setMessage(null)
      }
      // Esc first lets go of a run of tube that has been started, then of the tool itself, then of the selected crew.
      if (e.key === "Escape") {
        if (movingFor) {
          setMovingFor(null)
          setCrewMessage(null)
        } else if (tubeStart) setTubeStart(null)
        else if (tool) setTool(null)
        else if (crewRef.current) {
          clearSelection(crewRef.current.world)
          setSelectedCrew([])
          setCrewMessage(null)
        }
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [tubeStart, tool, researchOpen, exploreOpen, buildOpen, devConsole, movingFor])

  /** Closes the Build panel (or the dev console) and puts down whatever tool was in hand. */
  const closeBuild = () => {
    setBuildOpen(false)
    setDevConsole(false)
    pickTool(null)
  }

  /** A name in the Crew panel was clicked: select that astronaut, like clicking it on the map. */
  const selectFromPanel = (id: string, shift: boolean) => {
    const crew = crewRef.current?.world
    if (!crew?.movers[id]) return
    const already = crew.selectedPawnIds.includes(id)
    if (shift) selectPawns(crew, already ? crew.selectedPawnIds.filter((p) => p !== id) : [...crew.selectedPawnIds, id])
    else selectPawns(crew, already ? [] : [id])
    setSelectedCrew([...crew.selectedPawnIds])
    setCrewMessage(
      crew.selectedPawnIds.length > 0
        ? `${listNames(crew.selectedPawnIds)} selected. Click where to send them, a module to work in, or a mineral deposit to mine.`
        : "Nobody selected.",
    )
  }

  const labCount = modules.filter((module) => module.type === "research" || module.type === "research-pro").length

  /**
   * The Research button in the research tree: the project becomes the one being researched. If no
   * lab has an astronaut yet, the nearest free one walks into the nearest free lab to work on it.
   */
  const startResearch = (projectId: string) => {
    onStartResearch(projectId)
    setResearchStopped(false)
    const world = crewRef.current?.world
    const storm = weather !== null
    if (!world || claimedLabCount(world, storm) > 0) return
    const sent = sendResearcher(world, storm)
    if (!sent.ok) return setCrewMessage(`Research can't start yet. ${sent.reason}`)
    setLabCrew({ staffed: staffedLabs(world, storm).length, claimed: claimedLabCount(world, storm) })
    setCrewMessage(
      sent.result.status === "deferred"
        ? `${nameOf(sent.pawnId)} will go to the Research Lab once it's safe.`
        : `${nameOf(sent.pawnId)} is walking to the Research Lab to start the research.`,
    )
  }

  // A project has just been finished: say so.
  const researchedRef = useRef(researched)
  useEffect(() => {
    const before = researchedRef.current
    researchedRef.current = researched
    const finished = researched.find((id) => !before.includes(id))
    const project = finished ? researchProject(finished) : undefined
    const unlocks = finished ? moduleUnlockedBy(finished) : undefined
    const built = unlocks ? ` The ${unlocks.name} can now be built: find it in the Build bar.` : ""
    if (project) queueMicrotask(() => setCrewMessage(`Research finished: ${project.name}.${built}`))
  }, [researched])

  const activeProject = researchProgress.active ? researchProject(researchProgress.active) : undefined
  /**
   * Hours of lab work left on the active project. Shown as real time at one astronaut's pace, so
   * more staffed labs make it count down faster rather than jump.
   */
  const researchLeft = activeProject ? hoursLeft(researchProgress, activeProject) : 0

  const hoveredIndex = terrain && hovered ? hovered.row * terrain.size + hovered.col : null

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#020104] text-white">
      <div ref={hostRef} className="absolute inset-0 touch-none" />
      {/* Night: a blue shade over the map, under the storm and the panels. It lets clicks through, and
          fades slowly because the clock only reaches here about once a second. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[#2a3470] mix-blend-multiply transition-opacity duration-1000 ease-linear"
        style={{ opacity: darkness(dayProgress * HOURS_PER_DAY) * NIGHT_SHADE }}
      />
      {/* An astronaut's task list, opened by right-clicking them. */}
      {taskMenu && taskMember && (
        <TaskMenu
          name={taskMember.name}
          color={taskMember.color}
          position={{ x: taskMenu.x, y: taskMenu.y }}
          now={taskMenu.now}
          next={taskMenu.next}
          mining={taskMenu.mining}
          onMove={() => moveFromMenu(taskMenu.pawnId)}
          onMine={(mineral, queue) => mineFromMenu(taskMenu.pawnId, mineral, queue)}
          onStop={() => stopFromMenu(taskMenu.pawnId)}
          onClose={closeTaskMenu}
        />
      )}
      {/* The storm's glow and clouds over the map. */}
      {weather && terrain && <StormOverlay storm={weather.id} />}

      {/* Panels sit over the map but let drags and clicks through to it. */}
      {/* While the Build bar is open, what sits along the bottom moves up above it (see BuildPanel). */}
      <div
        className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-4 sm:p-6"
        style={buildOpen ? { paddingBottom: "calc(var(--build-bar, 0px) + 1rem)" } : undefined}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col items-start gap-3">
            {/* The calendar: only the day number, never the real date (see sim/calendar.ts). */}
            <section aria-label="Calendar" className={`${panelClass} w-72`}>
              <p className={kickerClass}>
                {name} · Era {era}
              </p>
              <div className="mt-1 flex items-center justify-between gap-3">
                <p className="text-2xl font-semibold uppercase tracking-[0.2em] tabular-nums">Day {day}</p>
                {/* How fast time runs. The 1, 2 and 3 keys pick these too. */}
                <div role="group" aria-label="Game speed" className="pointer-events-auto flex">
                  {GAME_SPEEDS.map((speed) => (
                    <button
                      key={speed}
                      type="button"
                      aria-pressed={gameSpeed === speed}
                      title={`${speed}× speed (key ${speed})`}
                      onClick={() => gameSpeedStore.getState().setSpeed(speed)}
                      className={`-ml-px border px-2 py-1 text-xs font-semibold tabular-nums transition first:ml-0 focus-visible:relative focus-visible:outline-2 focus-visible:outline-orange-400 ${
                        gameSpeed === speed
                          ? "relative border-orange-400/70 bg-orange-500/25 text-orange-100"
                          : "border-white/15 bg-white/5 text-white/60 hover:border-orange-400/70 hover:bg-orange-500/15 hover:text-orange-100"
                      }`}
                    >
                      {speed}×
                    </button>
                  ))}
                </div>
              </div>
              {/* How far through today the clock is. The blue end of the bar is the night. */}
              <div
                className="relative mt-2 h-1.5 w-full bg-white/10"
                title={night ? "Night: the crew sleep" : "Daytime"}
                aria-hidden
              >
                <div className="absolute inset-y-0 right-0 bg-indigo-400/30" style={{ width: `${(1 - DAYLIGHT_HOURS / HOURS_PER_DAY) * 100}%` }} />
                <div className={`relative h-full ${night ? "bg-indigo-300/90" : "bg-orange-400/80"}`} style={{ width: `${Math.round(dayProgress * 100)}%` }} />
              </div>
              <p className="sr-only" aria-live="polite">
                {night ? "Night" : "Daytime"}
              </p>
              {/* The latest real solar event on the calendar. */}
              {spaceNews && (
                <p className="mt-2 text-xs leading-snug text-orange-200" aria-live="polite">
                  <span className="text-white/50">Space news: </span>
                  {spaceNews}
                </p>
              )}
            </section>
            {landed && terrain && !tool && (
              <div className="pointer-events-auto w-48 border border-white/15 bg-neutral-950/80 px-2 py-1.5 backdrop-blur-sm" aria-live="polite">
                {/* The header folds the list away, so it doesn't always cover the map. */}
                <button
                  type="button"
                  aria-expanded={crewOpen}
                  aria-controls="crew-list"
                  onClick={() => setCrewOpen((open) => !open)}
                  className="-mx-1 flex w-[calc(100%+0.5rem)] items-center justify-between px-1 py-0.5 text-[10px] font-medium uppercase tracking-[0.35em] text-orange-300/80 transition hover:bg-orange-500/15 hover:text-orange-200 focus-visible:outline-2 focus-visible:outline-orange-400"
                >
                  Crew
                  <svg aria-hidden viewBox="0 0 10 6" className={`size-2.5 fill-current transition ${crewOpen ? "" : "-rotate-90"}`}>
                    <path d="M0 0h10L5 6z" />
                  </svg>
                </button>
                {crewOpen && (
                  <ul id="crew-list" className="mt-1 flex flex-col gap-1">
                    {crew.map((member) => {
                      const isEvacuated = evacuated.includes(member.id) || !!member.evacuated
                      const isAway = away.includes(member.id)
                      const gone = isEvacuated || isAway
                      const selected = selectedCrew.includes(member.id) && !isAway
                      // What they're up to, shown at the end of the row.
                      const doing = isEvacuated
                        ? { label: "Evacuated", className: "text-orange-300/80" }
                        : isAway
                          ? { label: "Exploring", className: "text-emerald-300/80" }
                          : member.activity === "sleeping"
                            ? { label: "Sleeping", className: "text-indigo-200/80" }
                            : researchers.includes(member.id)
                              ? { label: "Researching", className: "text-sky-300/90" }
                              : selected
                                ? { label: "Selected", className: "text-orange-200" }
                                : null
                      return (
                        <li key={member.id}>
                          {/* One row per astronaut. Clicking it selects them, like clicking them on the map. */}
                          <button
                            type="button"
                            aria-pressed={selected}
                            disabled={gone}
                            onClick={(e) => selectFromPanel(member.id, e.shiftKey)}
                            className={`pointer-events-auto flex w-full flex-col gap-1 border px-1.5 py-1 text-left transition focus-visible:outline-2 focus-visible:outline-orange-400 ${
                              selected
                                ? "border-orange-400/70 bg-orange-500/25"
                                : gone
                                  ? "border-white/5 bg-white/[0.02] text-white/35"
                                  : "border-white/10 bg-white/5 hover:border-orange-400/70 hover:bg-orange-500/15"
                            }`}
                          >
                            <span className="flex items-center gap-1.5 text-[11px] font-semibold">
                              <span className="size-2 shrink-0 rounded-full" style={{ background: member.color }} />
                              <span className="truncate">{member.name}</span>
                              {doing && (
                                <span className={`ml-auto text-[9px] uppercase tracking-[0.15em] ${doing.className}`}>{doing.label}</span>
                              )}
                            </span>
                            {!gone && (
                              <span className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                                <Bar label="Morale" value={member.needs.morale} icon={<ResourceIcon id="morale" color={resourceColor("morale")} className="size-3" />} />
                                <Bar label="Oxygen" value={member.needs.oxygen} icon={<ResourceIcon id="oxygen" color={resourceColor("oxygen")} className="size-3" />} />
                                <Bar label="Food" value={member.needs.food} icon={<ResourceIcon id="food" color={resourceColor("food")} className="size-3" />} />
                                <Bar label="Water" value={member.needs.water} icon={<ResourceIcon id="water" color={resourceColor("water")} className="size-3" />} />
                              </span>
                            )}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
                {crewMessage && <p className="mt-1 text-[10px] leading-snug text-orange-200">{crewMessage}</p>}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-3">
            {/* The resources run along the top. */}
            <ResourceBar resources={resources} />
            {/* Build, Research and Explore, folded into one dropdown. The ` key opens the dev console. */}
            {terrain && (
              <Menu.Root>
                <Menu.Trigger className={`${buttonClass} flex items-center gap-3 data-popup-open:border-orange-400/70 data-popup-open:bg-orange-950/85`}>
                  Actions
                  <svg aria-hidden viewBox="0 0 10 6" className="size-2.5 fill-current text-white/60">
                    <path d="M0 0h10L5 6z" />
                  </svg>
                </Menu.Trigger>
                <Menu.Portal>
                  <Menu.Positioner className="z-50 outline-hidden" side="bottom" align="end" sideOffset={4}>
                    <Menu.Popup className="min-w-[var(--anchor-width)] border border-white/15 bg-neutral-950/95 py-1 text-white outline-hidden backdrop-blur-sm">
                      {[
                        {
                          label: buildOpen && !devConsole ? "Close build" : "Build",
                          // From the dev console, Build goes back to the player's Build bar, with its locks.
                          onClick: () => {
                            closeBuild()
                            if (!buildOpen || devConsole) setBuildOpen(true)
                          },
                          show: true,
                        },
                        { label: "Research", onClick: () => setResearchOpen(true), show: true },
                        { label: "Explore", onClick: () => setExploreOpen(true), show: landed },
                      ]
                        .filter((item) => item.show)
                        .map((item) => (
                          <Menu.Item
                            key={item.label}
                            onClick={item.onClick}
                            className="flex cursor-default items-center px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] outline-hidden select-none hover:bg-orange-500/25 hover:text-orange-100 data-highlighted:bg-orange-500/25 data-highlighted:text-orange-100"
                          >
                            {item.label}
                          </Menu.Item>
                        ))}
                      <Menu.Separator className="my-1 h-px bg-white/15" />
                      <Menu.Item
                        onClick={onExit}
                        className="flex cursor-default items-center px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white/70 outline-hidden select-none hover:bg-orange-500/25 hover:text-orange-100 data-highlighted:bg-orange-500/25 data-highlighted:text-orange-100"
                      >
                        Exit to menu
                      </Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>
            )}
            {/* The research going on: how far along it is and how long is left, or why it has stopped. */}
            {terrain && activeProject && (
              <button
                type="button"
                onClick={() => setResearchOpen(true)}
                role={researchStopped ? "alert" : "status"}
                aria-label={`Research: ${activeProject.name}. Open the research tree.`}
                className={`pointer-events-auto w-64 border bg-neutral-950/85 px-4 py-3 text-left backdrop-blur-sm transition hover:border-orange-400/70 focus-visible:outline-2 focus-visible:outline-orange-400 ${
                  labCrew.staffed > 0 ? "border-white/15" : "border-orange-400/70"
                }`}
              >
                <span className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-orange-300/90">
                  Research
                  <span className="tracking-[0.15em] text-white/50">
                    {labCrew.staffed > 0
                      ? `${formatRealTime(researchLeft, gameSpeed)} left`
                      : labCrew.claimed > 0
                        ? "On the way"
                        : "Stopped"}
                  </span>
                </span>
                <span className="mt-1 flex items-center gap-2 text-sm">
                  <span aria-hidden className="size-2.5 shrink-0" style={{ background: eraColor(activeProject.era) }} />
                  {activeProject.name}
                </span>
                <span aria-hidden className="mt-2 block h-1.5 w-full bg-white/10">
                  <span
                    className={`block h-full ${labCrew.staffed > 0 ? "bg-orange-400" : "bg-white/30"}`}
                    style={{ width: `${(1 - researchLeft / activeProject.hours) * 100}%` }}
                  />
                </span>
                <span className="mt-2 block text-[11px] text-white/55">
                  {labCrew.staffed > 0 ? (
                    `${labCrew.staffed} ${labCrew.staffed === 1 ? "astronaut" : "astronauts"} working in Research Labs.`
                  ) : labCrew.claimed > 0 ? (
                    "An astronaut is walking to the Research Lab."
                  ) : (
                    <span className="text-orange-200">
                      {researchStopped ? "Research has stopped: the astronaut left the Research Lab. " : "Research is paused. "}
                      Send an astronaut into a Research Lab to carry on.
                    </span>
                  )}
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <p className={`${panelClass} text-sm ${terrain && hoveredIndex !== null ? "" : "invisible"}`} aria-live="off">
            {terrain && hoveredIndex !== null && (
              <>
                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-white/50">Elevation </span>
                {formatElevation(terrain.metres[hoveredIndex])}
                {(() => {
                  const deposit = hovered && deposits ? depositAt(deposits, hovered) : undefined
                  return deposit ? (
                    <span className="ml-3 text-orange-200">
                      {mineralName(deposit.mineral)} deposit · {Math.ceil(deposit.amount)} left
                    </span>
                  ) : null
                })()}
              </>
            )}
          </p>
          {/* The map's data credits: folded away until asked for, so they don't cover the map, and kept left of the
              Backpack and Crew buttons (see App.tsx). Once they have been read, the x puts them away for good. */}
          {!creditsDismissed && (
            <div className="pointer-events-auto flex max-w-xl flex-col items-end gap-2">
              {creditsOpen && (
                <p id="map-credits" className={`${panelClass} mr-28 py-2 text-[11px] text-white/50`}>
                  Drawn as pixel art from real Mars data, via NASA Mars Trek. Detail: Mars Odyssey THEMIS infrared
                  mosaic, NASA/JPL-Caltech/Arizona State University/USGS. Colour: Viking MDIM 2.1, NASA Ames/USGS.
                  Elevation: MGS MOLA, NASA GSFC/USGS. Mineral richness: MGS TES mineral maps (Bandfield 2002),
                  NASA/JPL/ASU. Colours are simplified and block heights exaggerated. Full credits are on the main menu.
                </p>
              )}
              <div className="flex items-stretch gap-1">
                <button
                  type="button"
                  aria-expanded={creditsOpen}
                  aria-controls="map-credits"
                  onClick={() => {
                    setCreditsOpen((open) => !open)
                    setCreditsSeen(true)
                  }}
                  className={buttonClass}
                >
                  {creditsOpen ? "Hide map credits" : "Map credits"}
                </button>
                {creditsSeen && (
                  <button
                    type="button"
                    aria-label="Remove map credits"
                    title="Remove map credits (they stay on the main menu)"
                    onClick={() => setSettings({ mapCreditsDismissed: true })}
                    className={buttonClass.replace("px-5", "px-3")}
                  >
                    <span aria-hidden>×</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* The Build bar, along the bottom of the screen. */}
      {buildOpen && terrain && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
          <BuildPanel
            dev={devConsole}
            tool={tool}
            researched={researched}
            onTool={pickTool}
            tubeStarted={tubeStart !== null}
            moduleCount={modules.length}
            tubeCells={tubes.length}
            groupCount={groupCount}
            message={message}
            weather={weather?.id ?? null}
            onWeather={(id) => {
              onWeather(id)
              setMessage(id ? `Started a ${weatherEvent(id).name.toLowerCase()}.` : "Ended the storm.")
            }}
            onStormSoon={() => {
              onStormSoon()
              setMessage(`A radiation storm is coming in ${weatherEvent("radiation-storm").warnHours} h: watch for the warning.`)
            }}
            onSpaceEvent={(kind) => {
              onSpaceEvent(kind)
              setMessage(
                kind === "eruptionToMars"
                  ? `Test eruption sent towards Mars: its storm hits in ${TEST_ERUPTION_TRAVEL_HOURS} h.`
                  : "Test space event added: see the Space news under the day.",
              )
            }}
            tripsOut={trips.length}
            onTripEvent={(id) => {
              onTripEvent(id)
              setMessage(`${exploreEvent(id)?.name ?? "The event"} will happen to the group out exploring.`)
            }}
            onResetMap={() => {
              resettingRef.current = true
              onResetMap()
            }}
            onNextEra={() => {
              resettingRef.current = true
              onNextEra()
            }}
            onClear={() => {
              onBaseChange({ modules: [], tubes: [] })
              setTubeStart(null)
              setMessage("Cleared the base.")
            }}
            onClose={closeBuild}
          />
        </div>
      )}

      {/* A storm coming soon: which one, how long until it hits, and to get the crew in. */}
      {!weather && stormWarning && terrain && (
        <div className="pointer-events-none absolute inset-x-0 top-20 z-10 flex justify-center px-4" role="alert">
          <div className="max-w-md border border-amber-300/70 bg-neutral-950/90 px-5 py-3 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200">
              {weatherEvent(stormWarning.id).name} coming
              <span className="ml-3 tracking-[0.15em] text-white/60">
                in {Math.ceil(stormWarning.hoursLeft)} h
                <span className="ml-1.5 normal-case tracking-normal">(about {formatRealTime(stormWarning.hoursLeft, gameSpeed)})</span>
              </span>
            </p>
            <p className="mt-1 text-sm text-white/90">{weatherEvent(stormWarning.id).soon}</p>
          </div>
        </div>
      )}

      {/* A weather event going on: what it is, what to do, and how long is left. */}
      {weather && terrain && (
        <div className="pointer-events-none absolute inset-x-0 top-20 z-10 flex justify-center px-4" role="alert">
          {/* A solar storm's banner is yellow and orange, like its glow on the map. */}
          <div
            className={`max-w-md border px-5 py-3 backdrop-blur-sm ${
              weather.id === "solar-storm"
                ? "border-yellow-400/80 bg-linear-to-br from-orange-950/95 to-neutral-950/90"
                : "border-orange-400/70 bg-neutral-950/90"
            }`}
          >
            <p className={`text-xs font-semibold uppercase tracking-[0.3em] ${weather.id === "solar-storm" ? "text-yellow-300" : "text-orange-300"}`}>
              {weatherEvent(weather.id).name}
              <span className="ml-3 tracking-[0.15em] text-white/50">{Math.ceil(weather.hoursLeft)} h left</span>
            </p>
            <p className="mt-1 text-sm text-white/90">{weatherEvent(weather.id).warning}</p>
            <p className="mt-2 text-[11px] leading-relaxed text-white/55">{weatherEvent(weather.id).text}</p>
          </div>
        </div>
      )}

      {exploreOpen && (
        <ExploreMap
          crew={crew.map((member) => {
            const unfit = cannotExplore(member)
            return {
              id: member.id,
              name: member.name,
              color: member.color,
              status: evacuated.includes(member.id) || member.evacuated
                ? "evacuated"
                : away.includes(member.id)
                  ? "away"
                  : unfit
                    ? "unfit"
                    : "ready",
              note: unfit ?? undefined,
            }
          })}
          trips={trips}
          tripLog={tripLog}
          onSend={(placeId, crewIds) => {
            onSendExploring(placeId, crewIds)
            const place = explorePlace(placeId)?.name ?? "somewhere new"
            setCrewMessage(`${listNames(crewIds)} set off to explore the ${place}.`)
          }}
          onClose={() => setExploreOpen(false)}
        />
      )}

      {nebulaCard && nebulaById(nebulaCard.id) && (
        <NebulaDialog nebula={nebulaById(nebulaCard.id)!} isNew={nebulaCard.isNew} onClose={() => setNebulaCard(null)} />
      )}

      {researchOpen && (
        <ResearchPanel
          era={era}
          researched={researched}
          progress={researchProgress}
          labCount={labCount}
          staffedLabs={labCrew.staffed}
          claimedLabs={labCrew.claimed}
          onStart={startResearch}
          onClose={() => setResearchOpen(false)}
        />
      )}

      {!terrain && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-4">
          <div
            role={error ? "alert" : "status"}
            className="pointer-events-auto w-full max-w-md border border-white/15 bg-neutral-950/90 p-8"
          >
            {error ? (
              <>
                <h2 className="text-lg font-semibold uppercase tracking-[0.25em]">No signal from Mars</h2>
                <p className="mt-4 text-sm text-white/70">
                  The map for this landing site is built from NASA’s Mars imagery, and it didn’t load. Check the
                  internet connection, then try again.
                </p>
                <p className="mt-2 text-[11px] text-white/40">{error}</p>
                <button
                  type="button"
                  autoFocus
                  onClick={() => setAttempt((n) => n + 1)}
                  className={`${buttonClass} mt-6 border-orange-400/70`}
                >
                  Try again
                </button>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold uppercase tracking-[0.25em]">Scanning landing site</h2>
                <p className="mt-4 text-sm text-white/70">Getting imagery and elevation for {formatSite(site)}.</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* PLACEHOLDER game over: shows once every astronaut has been evacuated. */}
      {gameOver && shuttles === 0 && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div role="alertdialog" aria-labelledby="game-over-title" className="max-w-md border border-white/15 bg-neutral-950/90 p-8 text-center">
            <h2 id="game-over-title" className="text-lg font-semibold uppercase tracking-[0.25em]">
              Era {era} over
            </h2>
            <p className="mt-4 text-sm text-white/70">
              Every astronaut on {name} was evacuated to Earth. Nobody is left to run the base. Once they are
              well, they can fly back with a new crewmate, land beside it and carry on.
            </p>
            {/* The calendar's secret: the real days this era was played on, and what NASA saw then. */}
            <div className="mt-5 border-t border-white/10 pt-4 text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-orange-300/80">The real dates</p>
              <p className="mt-2 text-sm text-white/80">
                {eraHistory.from === eraHistory.to
                  ? `Day 1 of this era was really ${eraHistory.from}.`
                  : `This era really ran from ${eraHistory.from} to ${eraHistory.to}.`}
                {eraHistory.events.length > 0 ? " In that time, NASA recorded:" : " NASA's records show a quiet Sun on those days."}
              </p>
              {eraHistory.events.length > 0 && (
                <ul className="mt-2 max-h-40 list-disc space-y-1 overflow-y-auto pl-5 text-xs text-white/65">
                  {eraHistory.events.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}
              {eraHistory.quietEruptions > 0 && (
                <p className="mt-2 text-xs text-white/50">
                  …and {eraHistory.quietEruptions} more solar {eraHistory.quietEruptions === 1 ? "eruption" : "eruptions"} that
                  headed away from Mars.
                </p>
              )}
            </div>
            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                autoFocus
                onClick={() => {
                  resettingRef.current = true
                  onNextEra()
                }}
                className={`${buttonClass} border-orange-400/70`}
              >
                Next era
              </button>
              <button type="button" onClick={onExit} className={buttonClass}>
                Back to menu
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
