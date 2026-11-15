import { useEffect, useMemo, useRef, useState } from "react"
import { DevConsole, type DevTool } from "@/components/DevConsole"
import { SpaceWeatherPanel } from "@/components/SpaceWeatherPanel"
import { moduleType } from "@/content/modules"
import { createMapView, type MapView } from "@/map/mapView"
import { formatSite, type MarsSite } from "@/map/marsSite"
import { loadTerrain, type Cell, type VoxelTerrain } from "@/map/voxelTerrain"
import {
  TUBE,
  checkModule,
  checkTubes,
  connectedGroups,
  moduleAt,
  occupancy,
  placementOrigin,
  tubeRun,
  type Base,
} from "@/sim/base"

/*
 * The base map screen: the ground around the expedition's landing site, built
 * from NASA imagery and elevation (see map/), with the lander and the base on
 * it. For now the base (modules, and the tubes between them) is built by hand
 * from the dev console (the ` key).
 * The panels copy the look of MainMenu.
 */

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

  const handleCellClick = (cell: Cell) => {
    if (!terrain || !grid || !tool) return
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
        onCellClick: (cell) => onCellClickRef.current(cell),
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
      // Esc first lets go of a run of tube that has been started, then of the tool itself.
      if (e.key === "Escape") {
        if (tubeStart) setTubeStart(null)
        else setTool(null)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [tubeStart])

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
