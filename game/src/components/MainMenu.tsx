import { useRef, useState } from "react"
import { MarsGlobe, type MarsGlobeHandle } from "@/components/MarsGlobe"
import { SaveSelect } from "@/components/SaveSelect"
import { MARS_FACTS } from "@/content/marsFacts"

type MenuAction = "start" | "credits"

const MENU_ITEMS: { id: MenuAction; label: string }[] = [
  { id: "start", label: "Begin Expedition" },
  { id: "credits", label: "Credits" },
]

/** Every external dataset behind the Mars globe (see MarsGlobe.tsx / lib/marsEphemeris.ts) and the base map (see map/marsTrek.ts). */
const DATA_CREDITS: { use: string; what: string; links: { label: string; href: string }[] }[] = [
  {
    use: "Surface imagery (globe) and base map colour",
    what:
      "Viking MDIM 2.1 colour mosaic (Mars_Viking_MDIM21_ClrMosaic_global_232m), NASA Ames / USGS Astrogeology " +
      "Science Center, public domain, via NASA Mars Trek.",
    links: [{ label: "NASA Mars Trek", href: "https://trek.nasa.gov/mars/" }],
  },
  {
    use: "Fun facts",
    what: "Places and facts from NASA's Mars pages and the Perseverance and Curiosity mission pages.",
    links: [
      { label: "NASA Science: Mars", href: "https://science.nasa.gov/mars/facts/" },
      { label: "Perseverance", href: "https://science.nasa.gov/mission/mars-2020-perseverance/" },
      { label: "Curiosity", href: "https://science.nasa.gov/mission/msl-curiosity/" },
    ],
  },
  {
    use: "Base map detail",
    what:
      "Mars Odyssey THEMIS daytime infrared global mosaic, 100 m, v2 " +
      "(THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018), NASA/JPL-Caltech/Arizona State University/USGS " +
      "Astrogeology, via NASA Mars Trek.",
    links: [{ label: "NASA Mars Trek", href: "https://trek.nasa.gov/mars/" }],
  },
  {
    use: "Map tiles",
    what:
      "The base map's imagery and elevation are loaded as map tiles from NASA Solar System Treks (Mars Trek), " +
      "run by NASA JPL and SSERVI.",
    links: [{ label: "Trek tile service", href: "https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars" }],
  },
  {
    use: "Shape and terrain (globe) and base map heights",
    what:
      "Mars MGS MOLA DEM 463m, NASA Goddard Space Flight Center / USGS Astrogeology, CC0 (public " +
      "domain), on the Mars ellipsoid from NASA/JPL NAIF. The base map reads it through NASA Mars Trek " +
      "(Mars_MGS_MOLA_DEM_mosaic_global_463m_8).",
    links: [
      { label: "USGS Astrogeology", href: "https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m" },
      { label: "NASA Mars Trek", href: "https://trek.nasa.gov/mars/" },
    ],
  },
  {
    use: "Planet positions",
    what: "DE442 planetary ephemeris (2025), NASA/JPL NAIF (SPICE).",
    links: [
      { label: "NAIF usage rules", href: "https://naif.jpl.nasa.gov/naif/rules.html" },
      { label: "Generic kernels", href: "https://naif.jpl.nasa.gov/naif/data_generic.html" },
    ],
  },
  {
    use: "Mars rotation and tilt",
    what:
      "Konopliv et al. 2026, “Updated Mars Orientation and Gravity Field and Indication of Decadal " +
      "Changes in Rotation Rate”, The Planetary Science Journal, as distributed by NASA/JPL NAIF. " +
      "Mars radii in the same file are the IAU Working Group (WGCCRE) values.",
    links: [
      {
        label: "mars_konopliv_2026_v1 (NAIF)",
        href: "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/mars_konopliv_2026_v1.tpc",
      },
    ],
  },
]

const smallButton =
  "border border-white/15 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition hover:border-orange-400/70 focus-visible:outline-2 focus-visible:outline-orange-400"

/**
 * Fun fact for the selected place on Mars, or an "Explore Mars" prompt when none is picked.
 * The arrows step through places; the globe fast-forwards until each one faces Earth.
 */
function FactCard({
  siteId,
  hiddenFromEarth,
  onSelect,
  onStep,
}: {
  siteId: string | null
  hiddenFromEarth: boolean
  onSelect: (id: string | null) => void
  onStep: (id: string) => void
}) {
  const index = MARS_FACTS.findIndex((f) => f.id === siteId)
  const fact = MARS_FACTS[index]
  const step = (delta: number) =>
    onStep(MARS_FACTS[(Math.max(index, 0) + delta + MARS_FACTS.length) % MARS_FACTS.length].id)

  if (!fact) {
    return (
      <button
        type="button"
        onClick={() => onStep(MARS_FACTS[0].id)}
        className="group flex w-full items-center gap-3 border border-white/15 bg-white/5 px-4 py-3 text-left backdrop-blur-sm transition hover:border-orange-400/70 hover:bg-orange-500/15 focus-visible:outline-2 focus-visible:outline-orange-400"
      >
        <span className="size-3 shrink-0 rounded-full border-2 border-white bg-teal-400 shadow-[0_0_12px_rgba(45,212,191,0.8)]" />
        <span>
          <span className="block text-sm font-semibold uppercase tracking-[0.25em]">Explore Mars</span>
          <span className="block text-sm text-white/60">Tap a glowing dot on Mars for a fun fact</span>
        </span>
      </button>
    )
  }

  return (
    <section
      aria-live="polite"
      aria-label={`Fun fact: ${fact.title}`}
      className="w-full border border-white/15 bg-neutral-950/80 p-5 backdrop-blur-md"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold uppercase tracking-[0.2em] text-orange-300">{fact.title}</h2>
        <button type="button" aria-label="Close fun fact" onClick={() => onSelect(null)} className={smallButton}>
          ✕
        </button>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-white/85">{fact.text}</p>
      {hiddenFromEarth && (
        <p className="mt-2 text-sm text-white/55">
          This place is tipped away from Earth right now, so we can&apos;t see it on the globe.
        </p>
      )}
      <div className="mt-4 flex items-center justify-between gap-3">
        <a
          href={fact.source.url}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-orange-300 underline underline-offset-2"
        >
          Source: {fact.source.label}
        </a>
        <div className="flex shrink-0 gap-2">
          <button type="button" aria-label="Previous place" onClick={() => step(-1)} className={smallButton}>
            ←
          </button>
          <button type="button" aria-label="Next place" onClick={() => step(1)} className={smallButton}>
            →
          </button>
        </div>
      </div>
    </section>
  )
}

export function MainMenu({ onStart }: { onStart: () => void }) {
  const [showCredits, setShowCredits] = useState(false)
  const [showSaves, setShowSaves] = useState(false)
  const globeRef = useRef<MarsGlobeHandle>(null)
  const [siteId, setSiteId] = useState<string | null>(null)
  const [hiddenFromEarth, setHiddenFromEarth] = useState(false)

  // A tapped pin is already in view; a stepped-to place needs the globe to turn to it.
  const selectSite = (id: string | null) => {
    setSiteId(id)
    setHiddenFromEarth(false)
  }
  const stepToSite = (id: string) => {
    setSiteId(id)
    setHiddenFromEarth(!(globeRef.current?.focusSite(id) ?? true))
  }

  const handleSelect = (action: MenuAction) => {
    // The game starts once a save is picked or created in the save menu.
    if (action === "start") setShowSaves(true)
    if (action === "credits") setShowCredits(true)
  }

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#020104] text-white">
      <MarsGlobe
        ref={globeRef}
        className="absolute inset-0"
        selectedSiteId={siteId}
        onSelectSite={selectSite}
      />

      {/* Click-through so taps reach the pins on Mars; the controls opt back in. */}
      <div className="pointer-events-none relative z-10 flex h-full flex-col justify-center px-6 sm:px-16 max-[900px]:justify-start max-[900px]:pt-[12vh]">
        <p className="text-xs font-medium uppercase tracking-[0.4em] text-orange-300/80">
          NASA Space Apps 2026
        </p>
        <h1 className="mt-3 text-5xl font-bold uppercase leading-none tracking-wider sm:text-7xl">
          Ares
          <span className="block text-2xl font-light tracking-[0.5em] text-orange-200/90 sm:text-3xl">
            Through Eons
          </span>
        </h1>

        <nav className="pointer-events-auto mt-12 flex w-full max-w-xs flex-col gap-3">
          {MENU_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              className="group relative border border-white/15 bg-white/5 px-6 py-3 text-left text-sm font-semibold uppercase tracking-[0.25em] backdrop-blur-sm transition hover:border-orange-400/70 hover:bg-orange-500/15 focus-visible:outline-2 focus-visible:outline-orange-400"
            >
              <span className="absolute inset-y-0 left-0 w-0.5 bg-orange-400 opacity-0 transition group-hover:opacity-100" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="pointer-events-auto mt-8 w-full max-w-sm max-[900px]:fixed max-[900px]:inset-x-4 max-[900px]:bottom-12 max-[900px]:mt-0 max-[900px]:max-w-none">
          <FactCard
            siteId={siteId}
            hiddenFromEarth={hiddenFromEarth}
            onSelect={selectSite}
            onStep={stepToSite}
          />
        </div>
      </div>

      <p className="absolute right-6 bottom-4 left-6 z-10 text-[11px] text-white/40 sm:left-16">
        Mars as seen from Earth, time-lapse from now · Viking MDIM 2.1 via NASA Mars Trek · MGS MOLA via USGS Astrogeology · NASA/JPL NAIF
      </p>

      {showSaves && <SaveSelect onStart={onStart} onClose={() => setShowSaves(false)} />}

      {showCredits && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setShowCredits(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="credits-title"
            className="max-h-full w-full max-w-lg overflow-y-auto border border-white/15 bg-neutral-950/90 p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="credits-title" className="text-lg font-semibold uppercase tracking-[0.25em]">
              Credits
            </h2>
            <p className="mt-4 text-sm text-white/70">
              Built for the 2026 NASA Space Apps Challenge. The Mars globe is shown as seen from
              Earth right now, then sped up 720× so you can watch it turn. The background stars
              are decorative, not real star positions. Each expedition’s base map is drawn as pixel art from
              real imagery and elevation of its landing site: the pattern of the ground is real, but the colours
              are simplified to a small palette and the block heights are exaggerated.
            </p>
            <h3 className="mt-5 text-xs font-semibold uppercase tracking-[0.25em] text-white/50">
              Data sources
            </h3>
            <ul className="mt-3 space-y-3 text-sm text-white/70">
              {DATA_CREDITS.map((credit) => (
                <li key={credit.use}>
                  <span className="text-white/90">{credit.use}:</span> {credit.what}
                  <span className="mt-0.5 flex flex-wrap gap-x-3">
                    {credit.links.map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-orange-300 underline underline-offset-2"
                      >
                        {link.label}
                      </a>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              autoFocus
              onClick={() => setShowCredits(false)}
              className="mt-6 border border-white/15 px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] transition hover:border-orange-400/70"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
