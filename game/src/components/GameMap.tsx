import { useEffect, useRef, useState } from "react"
import { createMapView } from "@/map/mapView"
import { formatSite, type MarsSite } from "@/map/marsSite"
import { loadTerrain, type Cell, type VoxelTerrain } from "@/map/voxelTerrain"

/*
 * The base map screen: the ground around the expedition's landing site, built
 * from NASA imagery and elevation (see map/). The base builder goes on top of
 * this. The panels copy the look of MainMenu.
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

export function GameMap({ name, site, onExit }: { name: string; site: MarsSite; onExit: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [hovered, setHovered] = useState<Cell | null>(null)

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

  useEffect(() => {
    const host = hostRef.current
    if (!host || !terrain) return
    const abort = new AbortController()
    const view = createMapView(host, terrain, setHovered, abort.signal)
    view.catch((reason: unknown) => {
      setLoaded({ key, error: reason instanceof Error ? reason.message : String(reason) })
    })
    return () => {
      abort.abort()
      setHovered(null)
      // The view can only be torn down once it has finished starting up.
      view.then((created) => created?.destroy()).catch(() => {})
    }
  }, [terrain, key])

  const hoveredIndex = terrain && hovered ? hovered.row * terrain.size + hovered.col : null

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#020104] text-white">
      <div ref={hostRef} className="absolute inset-0 touch-none" />

      {/* Panels sit over the map but let drags and clicks through to it. */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className={panelClass}>
            <p className={kickerClass}>{name}</p>
            <h1 className="mt-1 text-lg font-semibold tracking-wider">{formatSite(site)}</h1>
            <p className="mt-1 text-[11px] text-white/50">
              Landing site on Mars. Each block is about {terrain ? Math.round(terrain.metersPerCell) : 163} m wide.
            </p>
          </div>
          <button type="button" onClick={onExit} className={buttonClass}>
            Back to menu
          </button>
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
