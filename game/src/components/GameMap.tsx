import { useEffect, useMemo, useRef, useState } from "react"
import { DevConsole, type DevTool } from "@/components/DevConsole"
import { SpaceWeatherPanel } from "@/components/SpaceWeatherPanel"
import { moduleType, type ModuleTypeId } from "@/content/modules"
import { createMapView, type ClickKeys, type MapView } from "@/map/mapView"
import { formatSite, type MarsSite } from "@/map/marsSite"
import { loadTerrain, type Cell, type VoxelTerrain } from "@/map/voxelTerrain"
import {
  TUBE,
  checkModule,
  checkTubes,
  connectedGroups,
  landerFootprint,
  moduleAt,
  occupancy,
  placementOrigin,
  tubeRun,
  type Base,
} from "@/sim/base"
import { buildNavigation, syncNavigation } from "@/sim/navigation"
import {
  addPawn,
  clearSelection,
  getZone,
  handleClick,
  isWalkable,
  stepPathing,
  type ClickResult,
  type PathingEvent,
  type Tile,
  type World,
} from "@/sim/pathing"

/*
 * The base map screen: the ground around the expedition's landing site, built
 * from NASA imagery and elevation (see map/), with the lander and the base on
 * it. For now the base (modules, and the tubes between them) is built by hand
 * from the dev console (the ` key).
 * The crew are placeholders: three astronauts who appear beside the lander once
 * it's down. Click one, then click where to send them (sim/pathing moves them).
 * They aren't saved yet, so they start beside the lander each time the map opens.
 * The panels copy the look of MainMenu.
 */

/**
 * How fast crew time runs: game-hours per real second. 0.15 = 9 game-minutes a second, so a
 * suited walk crosses about one 162 m block a second and an airlock cycles in under a second.
 */
const GAME_HOURS_PER_SECOND = 0.15
/** Placeholder crew until the crew model (needs, roles, names) is hooked up. */
const PLACEHOLDER_CREW = [
  { id: "astronaut-1", name: "Astronaut 1", color: 0xf97316 },
  { id: "astronaut-2", name: "Astronaut 2", color: 0x22d3ee },
  { id: "astronaut-3", name: "Astronaut 3", color: 0xfacc15 },
] as const
const CREW_COLORS: Record<string, number> = Object.fromEntries(PLACEHOLDER_CREW.map((c) => [c.id, c.color]))
const crewName = (id: string) => PLACEHOLDER_CREW.find((c) => c.id === id)?.name ?? id
const listNames = (ids: string[]) => ids.map(crewName).join(", ")
const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`

/** Free open ground right round the lander, south side first, for the crew to step out onto. */
function spotsBesideLander(world: World, size: number): Tile[] {
  const { col, row, width, height } = landerFootprint(size)
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

/** A plain-words line about what a click on the map did with the crew. */
function describeClick(world: World, result: ClickResult): string {
  switch (result.kind) {
    case "selected":
      return `${listNames(result.pawnIds)} selected. Click where to send them, or a module to work in.`
    case "deselected":
      return "Nobody selected."
    case "nothing":
      return "Click an astronaut first."
    case "failed":
      return result.reason
    case "ordered": {
      const where = result.order.kind === "work" ? `to work in the ${placeName(world, result.order.stationId)}` : "there"
      const parts: string[] = []
      if (result.started.length) parts.push(`${listNames(result.started)}: on the way ${where}.`)
      if (result.queued.length) parts.push(`${listNames(result.queued)}: added to the queue.`)
      if (result.deferred.length) parts.push(`${listNames(result.deferred)}: will go after something urgent.`)
      for (const f of result.failed) parts.push(`${crewName(f.pawnId)}: ${f.reason}`)
      return parts.join(" ")
    }
  }
}

/** Crew events worth telling the player about, as plain words. */
function describeEvent(event: PathingEvent): string | null {
  switch (event.type) {
    case "blocked":
    case "cancelled":
      return `${crewName(event.pawnId)}: ${event.reason}`
    case "airlockCycling":
      return `${crewName(event.pawnId)} is cycling through the airlock.`
    case "exposureChanged":
      return event.exposure === "outside"
        ? `${crewName(event.pawnId)} stepped outside onto the surface.`
        : `${crewName(event.pawnId)} is back inside.`
    default:
      return null
  }
}

const kickerClass = "text-xs font-medium uppercase tracking-[0.4em] text-orange-300/80"
const panelClass = "border border-white/15 bg-neutral-950/80 px-5 py-3 backdrop-blur-sm"
const buttonClass =
  "pointer-events-auto border border-white/15 bg-neutral-950/80 px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] backdrop-blur-sm transition hover:border-orange-400/70 focus-visible:outline-2 focus-visible:outline-orange-400"

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
  onExit: () => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  // Decided once, when the screen opens. `landed` turns true partway through the
  // landing, and that mustn't rebuild the map underneath it.
  const [showLanding] = useState(!landed)
  const onLandedRef = useRef(onLanded)
  useEffect(() => {
    onLandedRef.current = onLanded
  })
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [hovered, setHovered] = useState<Cell | null>(null)
  const [view, setView] = useState<MapView | null>(null)
  const [consoleOpen, setConsoleOpen] = useState(false)
  const [tool, setTool] = useState<DevTool>(null)
  const [message, setMessage] = useState<string | null>(null)
  /** Where the run of tube being laid starts, once the first click of the tube tool has set it. */
  const [tubeStart, setTubeStart] = useState<Cell | null>(null)
  /** Where the crew are and what they're doing (sim/pathing). Built once the map has loaded. */
  const crewRef = useRef<{ terrain: VoxelTerrain; world: World } | null>(null)
  const [selectedCrew, setSelectedCrew] = useState<string[]>([])
  const [crewMessage, setCrewMessage] = useState<string | null>(null)

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

  const base = useMemo<Base>(() => ({ modules, tubes }), [modules, tubes])
  // What stands on each cell, worked out once per change to the base.
  const grid = useMemo(() => (terrain ? occupancy(terrain.size, base) : null), [terrain, base])
  const groupCount = useMemo(
    () => (terrain && grid ? connectedGroups(terrain.size, base, grid).length : 0),
    [terrain, base, grid],
  )

  const handleCellClick = (cell: Cell, keys: ClickKeys) => {
    if (!terrain || !grid) return
    // With no dev tool picked, clicks are for the crew: pick an astronaut, then where to send them.
    if (!tool) {
      const crew = crewRef.current?.world
      if (!crew) return
      setCrewMessage(describeClick(crew, handleClick(crew, { x: cell.col, y: cell.row }, { shift: keys.shift })))
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
      const check = checkTubes(size, grid, run)
      if (!check.ok) return setMessage(check.reason)
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

    const check = checkModule(size, grid, tool.type, placementOrigin(tool.type, cell), crypto.randomUUID())
    if (!check.ok) return setMessage(check.reason)
    onBaseChange({ modules: [...modules, check.module], tubes })
    setMessage(`Placed a ${moduleType(tool.type).name}. It isn't joined to anything until you lay a tube to it.`)
  }
  // The map calls this through a ref, so it always gets the latest tool and modules without being rebuilt.
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
        onCellClick: (cell, keys) => onCellClickRef.current(cell, keys),
        onLanded: showLanding ? () => onLandedRef.current() : null,
      },
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
  }, [terrain, key, showLanding])

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

  // Once the lander is down, the placeholder crew step out beside it.
  useEffect(() => {
    const crew = crewRef.current
    if (!landed || !terrain || !crew || crew.terrain !== terrain) return
    if (Object.keys(crew.world.movers).length > 0) return
    const spots = spotsBesideLander(crew.world, terrain.size)
    PLACEHOLDER_CREW.forEach((member, i) => {
      if (spots[i]) addPawn(crew.world, member.id, spots[i])
    })
  }, [landed, terrain, base])

  // Every frame: move the crew along, draw them, and pass on anything worth saying.
  useEffect(() => {
    if (!view) return
    return view.onFrame((deltaMs) => {
      const crew = crewRef.current?.world
      if (!crew) return
      // A long gap (the tab was hidden) shouldn't make everyone teleport.
      const events = stepPathing(crew, (Math.min(deltaMs, 100) / 1000) * GAME_HOURS_PER_SECOND)
      view.drawCrew(crew, CREW_COLORS)
      const said = events.map(describeEvent).filter((line) => line !== null)
      if (said.length > 0) setCrewMessage(said[said.length - 1])
    })
  }, [view])

  // While a tool that builds is picked in the dev console, the map shows what a click would build.
  useEffect(() => {
    if (!view || !terrain || !grid) return
    const { size } = terrain
    if (tool?.kind === "place") {
      const { id: type, width, height } = moduleType(tool.type)
      view.setPlacement({
        preview: (cell) => {
          const origin = placementOrigin(type, cell)
          return { rect: { ...origin, width, height }, tubes: [], ok: checkModule(size, grid, type, origin).ok }
        },
      })
    } else if (tool?.kind === "tube") {
      view.setPlacement({
        preview: (cell) => {
          const run = tubeStart ? tubeRun(tubeStart, cell) : [cell]
          return { rect: null, tubes: run, ok: checkTubes(size, grid, run).ok }
        },
      })
    } else {
      view.setPlacement(null)
    }
  }, [view, terrain, grid, tool, tubeStart])

  const pickTool = (next: DevTool) => {
    setTool(next)
    setTubeStart(null)
    setMessage(null)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Backquote") {
        setConsoleOpen((open) => !open)
        setTool(null)
        setTubeStart(null)
        setMessage(null)
      }
      // Esc first lets go of a run of tube that has been started, then of the tool itself, then of the selected crew.
      if (e.key === "Escape") {
        if (tubeStart) setTubeStart(null)
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
  }, [tubeStart, tool])

  const hoveredIndex = terrain && hovered ? hovered.row * terrain.size + hovered.col : null

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#020104] text-white">
      <div ref={hostRef} className="absolute inset-0 touch-none" />

      {/* Panels sit over the map but let drags and clicks through to it. */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col items-start gap-3">
            <div className={panelClass}>
              <p className={kickerClass}>{name}</p>
              <h1 className="mt-1 text-lg font-semibold tracking-wider">{formatSite(site)}</h1>
              <p className="mt-1 text-[11px] text-white/50">
                Landing site on Mars. Each block is about {terrain ? Math.round(terrain.metersPerCell) : 163} m wide.
              </p>
            </div>
            {consoleOpen && terrain && (
              <DevConsole
                tool={tool}
                onTool={pickTool}
                tubeStarted={tubeStart !== null}
                moduleCount={modules.length}
                tubeCells={tubes.length}
                groupCount={groupCount}
                message={message}
                onClear={() => {
                  onBaseChange({ modules: [], tubes: [] })
                  setTubeStart(null)
                  setMessage("Cleared the base.")
                }}
                onClose={() => {
                  setConsoleOpen(false)
                  pickTool(null)
                }}
              />
            )}
            {landed && terrain && !tool && (
              <div className={`${panelClass} max-w-xs`} aria-live="polite">
                <p className={kickerClass}>Crew</p>
                <ul className="mt-2 flex flex-col gap-1 text-sm">
                  {PLACEHOLDER_CREW.map((member) => (
                    <li
                      key={member.id}
                      className={`flex items-center gap-2 ${selectedCrew.includes(member.id) ? "text-white" : "text-white/55"}`}
                    >
                      <span className="size-2.5 rounded-full" style={{ background: hex(member.color) }} />
                      {member.name}
                      {selectedCrew.includes(member.id) && <span className="text-[11px] text-white/50">selected</span>}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-white/50">
                  Click an astronaut, then click where to go, or a module to work in. Shift-click to pick more or to
                  queue an order. Click a selected astronaut again (or press Esc) to let go.
                </p>
                {crewMessage && <p className="mt-2 text-xs text-orange-200">{crewMessage}</p>}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-3">
            <button type="button" onClick={onExit} className={buttonClass}>
              Back to menu
            </button>
            <SpaceWeatherPanel />
            {/* Shown on a developer's machine only. On the live site the ` key still opens the console. */}
            {import.meta.env.DEV && !consoleOpen && terrain && (
              <button type="button" onClick={() => setConsoleOpen(true)} className={buttonClass}>
                Dev console
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
              </>
            )}
          </p>
          <p className={`${panelClass} max-w-xl py-2 text-[11px] text-white/50`}>
            Drawn as pixel art from real Mars data, via NASA Mars Trek. Detail: Mars Odyssey THEMIS infrared mosaic,
            NASA/JPL-Caltech/Arizona State University/USGS. Colour: Viking MDIM 2.1, NASA Ames/USGS. Elevation: MGS MOLA,
            NASA GSFC/USGS. Colours are simplified and block heights exaggerated. Full credits are on the main menu.
          </p>
        </div>
      </div>

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
    </main>
  )
}
