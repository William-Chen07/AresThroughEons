import { useState } from "react"
import { MarsGlobe } from "@/components/MarsGlobe"

type MenuAction = "start" | "credits"

const MENU_ITEMS: { id: MenuAction; label: string }[] = [
  { id: "start", label: "Begin Expedition" },
  { id: "credits", label: "Credits" },
]

/** Every external dataset behind the Mars globe (see MarsGlobe.tsx / lib/marsEphemeris.ts). */
const DATA_CREDITS: { use: string; what: string; links: { label: string; href: string }[] }[] = [
  {
    use: "Surface imagery",
    what: "Viking MDIM 2.1 colour mosaic (Mars_Viking_MDIM21_ClrMosaic_global_232m), via NASA Mars Trek.",
    links: [{ label: "NASA Mars Trek", href: "https://trek.nasa.gov/mars/" }],
  },
  {
    use: "Shape and terrain",
    what:
      "Mars MGS MOLA DEM 463m, NASA Goddard Space Flight Center / USGS Astrogeology, CC0 (public " +
      "domain), on the Mars ellipsoid from NASA/JPL NAIF.",
    links: [{ label: "USGS Astrogeology", href: "https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m" }],
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

export function MainMenu({ onStart }: { onStart: () => void }) {
  const [showCredits, setShowCredits] = useState(false)

  const handleSelect = (action: MenuAction) => {
    if (action === "start") onStart()
    if (action === "credits") setShowCredits(true)
  }

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#020104] text-white">
      <MarsGlobe className="absolute inset-0" />

      <div className="relative z-10 flex h-full flex-col justify-center px-6 sm:px-16 max-[900px]:justify-start max-[900px]:pt-[12vh]">
        <p className="text-xs font-medium uppercase tracking-[0.4em] text-orange-300/80">
          NASA Space Apps 2026
        </p>
        <h1 className="mt-3 text-5xl font-bold uppercase leading-none tracking-wider sm:text-7xl">
          Ares
          <span className="block text-2xl font-light tracking-[0.5em] text-orange-200/90 sm:text-3xl">
            Through Eons
          </span>
        </h1>

        <nav className="mt-12 flex w-full max-w-xs flex-col gap-3">
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
      </div>

      <p className="absolute right-6 bottom-4 left-6 z-10 text-[11px] text-white/40 sm:left-16">
        Mars as seen from Earth, time-lapse from now · Viking MDIM 2.1 via NASA Mars Trek · MGS MOLA via USGS Astrogeology · NASA/JPL NAIF
      </p>

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
              are decorative, not real star positions.
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
