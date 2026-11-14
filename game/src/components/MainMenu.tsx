import { useState } from "react"
import { MarsGlobe } from "@/components/MarsGlobe"

type MenuAction = "start" | "credits"

const MENU_ITEMS: { id: MenuAction; label: string }[] = [
  { id: "start", label: "Begin Expedition" },
  { id: "credits", label: "Credits" },
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

      {/* Darken the left side so the menu text stays readable over the globe */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/80 via-black/30 to-transparent max-[900px]:bg-gradient-to-b" />

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

      <p className="absolute bottom-4 left-6 z-10 text-[11px] text-white/40 sm:left-16">
        Mars imagery: Viking MDIM 2.1 mosaic, NASA/JPL/USGS via NASA Mars Trek
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
            className="w-full max-w-md border border-white/15 bg-neutral-950/90 p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="credits-title" className="text-lg font-semibold uppercase tracking-[0.25em]">
              Credits
            </h2>
            <ul className="mt-4 space-y-2 text-sm text-white/70">
              <li>Built for the 2026 NASA Space Apps Challenge.</li>
              <li>
                Mars globe imagery: Viking MDIM 2.1 colour mosaic, NASA/JPL/USGS, served by{" "}
                <a
                  href="https://trek.nasa.gov/mars/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-orange-300 underline underline-offset-2"
                >
                  NASA Mars Trek
                </a>
                .
              </li>
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
