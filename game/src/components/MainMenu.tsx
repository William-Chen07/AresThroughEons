import { useEffect, useRef, useState } from "react"
import { Lock, Volume2, VolumeX } from "lucide-react"
import { MarsGlobe, type MarsGlobeHandle } from "@/components/MarsGlobe"
import { CodexDialog, CreditsDialog, HowToPlayDialog, SettingsDialog } from "@/components/MenuDialogs"
import { SaveSelect } from "@/components/SaveSelect"
import { MARS_FACTS } from "@/content/marsFacts"
import { useSettings } from "@/lib/settings"
import { playSfx, startMusic, stopMusic, unlockAudio } from "@/lib/sound"
import { useProgress } from "@/sim/progress"
import { useSaves } from "@/sim/saves"

type MenuAction = "start" | "howto" | "codex" | "settings" | "credits"
type Panel = "howto" | "codex" | "settings" | "credits" | null

/** Locked items need at least one saved expedition (sim/saves.ts) before they open. */
const MENU_ITEMS: { id: MenuAction; label: string; needsSave?: boolean }[] = [
  { id: "start", label: "Begin Expedition" },
  { id: "howto", label: "How to Play" },
  { id: "codex", label: "Mars Codex", needsSave: true },
  { id: "settings", label: "Settings" },
  { id: "credits", label: "Credits" },
]

const LOCKED_HINT = "Play your first mission to unlock"
// About how tall an open fun-fact card is (the Explore button before it opens is shorter).
const FACT_CARD_HEIGHT_PX = 260

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
        className="group flex w-full items-center gap-3 border border-white/15 bg-neutral-950/60 px-4 py-3 text-left backdrop-blur-sm transition hover:border-orange-400/70 hover:bg-orange-500/15 focus-visible:outline-2 focus-visible:outline-orange-400"
      >
        <span className="size-3 shrink-0 rounded-full border-2 border-white bg-teal-400 shadow-[0_0_12px_rgba(45,212,191,0.8)]" />
        <span>
          <span className="block text-sm font-semibold uppercase tracking-[0.25em]">Explore Mars</span>
          <span className="block text-sm text-white/60">Tap a glowing dot on Mars for a fun fact</span>
        </span>
      </button>
    )
  }

  // See-through so Mars shows behind the card; the text shadow keeps the words readable over it.
  return (
    <section
      aria-live="polite"
      aria-label={`Fun fact: ${fact.title}`}
      className="w-full border border-white/15 bg-neutral-950/50 p-5 backdrop-blur-[2px] [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]"
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
  const [panel, setPanel] = useState<Panel>(null)
  const [showSaves, setShowSaves] = useState(false)
  const globeRef = useRef<MarsGlobeHandle>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const factRef = useRef<HTMLDivElement>(null)
  const [siteId, setSiteId] = useState<string | null>(null)
  const [hiddenFromEarth, setHiddenFromEarth] = useState(false)

  const hasSave = useSaves((s) => s.slots.some((slot) => slot !== null))
  const codexIds = useProgress((s) => s.codexIds)
  const muted = useSettings((s) => s.muted)
  const setSettings = useSettings((s) => s.setSettings)

  // Browsers block audio until the first click or key press, so start the music then.
  useEffect(() => {
    const unlock = () => {
      unlockAudio()
      startMusic()
      window.removeEventListener("pointerdown", unlock)
      window.removeEventListener("keydown", unlock)
    }
    window.addEventListener("pointerdown", unlock)
    window.addEventListener("keydown", unlock)
    return () => {
      window.removeEventListener("pointerdown", unlock)
      window.removeEventListener("keydown", unlock)
      stopMusic(0.3)
    }
  }, [])

  // Where a moon picked for a fun fact must not end up: under the title, the menu or the fact
  // card. The card may still be the small Explore button, so allow for the full card's height.
  const keepClear = () => {
    const rects = [titleRef.current, navRef.current].flatMap((el) => (el ? [el.getBoundingClientRect()] : []))
    const card = factRef.current?.getBoundingClientRect()
    if (card) {
      const h = Math.max(card.height, FACT_CARD_HEIGHT_PX)
      rects.push(new DOMRect(card.left, card.bottom - h, card.width, h))
    }
    return rects
  }

  // Picking a place (tapped pin, Explore, or the arrows) turns Mars to bring it to the front.
  const focusSite = (id: string) => {
    setSiteId(id)
    setHiddenFromEarth(!(globeRef.current?.focusSite(id) ?? true))
  }
  const selectSite = (id: string | null) => {
    if (id) return focusSite(id)
    setSiteId(null)
    setHiddenFromEarth(false)
  }

  const handleSelect = (action: MenuAction, locked: boolean) => {
    if (locked) {
      playSfx("locked")
      return
    }
    if (action === "start") {
      // The game starts once a save is picked or created in the save menu.
      playSfx("open")
      setShowSaves(true)
      return
    }
    playSfx("open")
    setPanel(action)
  }
  const closePanel = () => setPanel(null)
  const startGame = () => {
    stopMusic(0.8)
    onStart()
  }

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#020104] text-white">
      <MarsGlobe
        ref={globeRef}
        className="absolute inset-0"
        selectedSiteId={siteId}
        onSelectSite={selectSite}
        keepClear={keepClear}
      />

      {/* Click-through so taps reach the pins on Mars; the controls opt back in. */}
      <div className="pointer-events-none relative z-10 flex h-full flex-col justify-center px-6 pb-8 sm:px-16 max-[900px]:justify-start max-[900px]:pt-[8vh]">
        <p className="text-xs font-medium uppercase tracking-[0.4em] text-orange-300/80">
          NASA Space Apps 2026
        </p>
        <h1 ref={titleRef} className="mt-3 text-5xl font-bold uppercase leading-none tracking-wider sm:text-7xl">
          Ares
          <span className="block text-2xl font-light tracking-[0.5em] text-orange-200/90 sm:text-3xl">
            Through Eons
          </span>
        </h1>

        <nav ref={navRef} aria-label="Main menu" className="pointer-events-auto mt-10 flex w-full max-w-xs flex-col gap-2">
          {MENU_ITEMS.map((item) => {
            const locked = Boolean(item.needsSave) && !hasSave
            return (
              <button
                key={item.id}
                type="button"
                aria-disabled={locked || undefined}
                aria-label={locked ? `${item.label} (locked). ${LOCKED_HINT}.` : undefined}
                onPointerEnter={(e) => e.pointerType === "mouse" && !locked && playSfx("hover")}
                onClick={() => handleSelect(item.id, locked)}
                className={`group relative flex items-center justify-between gap-3 border px-6 py-2.5 text-left text-sm font-semibold uppercase tracking-[0.25em] backdrop-blur-sm transition focus-visible:outline-2 focus-visible:outline-orange-400 ${
                  locked
                    ? "cursor-not-allowed border-white/10 bg-white/[0.02] text-white/35"
                    : "border-white/15 bg-white/5 hover:border-orange-400/70 hover:bg-orange-500/15"
                }`}
              >
                {!locked && (
                  <span className="absolute inset-y-0 left-0 w-0.5 bg-orange-400 opacity-0 transition group-hover:opacity-100" />
                )}
                <span>
                  {item.label}
                  {locked && (
                    <span className="mt-0.5 block text-xs font-normal normal-case tracking-normal text-white/45">
                      {LOCKED_HINT}
                    </span>
                  )}
                </span>
                {locked && <Lock className="size-4 shrink-0" aria-hidden />}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Top right: quick mute */}
      <button
        type="button"
        aria-label={muted ? "Turn sound on" : "Turn sound off"}
        onClick={() => setSettings({ muted: !muted })}
        className="absolute top-4 right-4 z-20 flex size-11 items-center justify-center border border-white/15 bg-neutral-950/60 backdrop-blur-sm transition hover:border-orange-400/70 focus-visible:outline-2 focus-visible:outline-orange-400"
      >
        {muted ? <VolumeX className="size-5" aria-hidden /> : <Volume2 className="size-5" aria-hidden />}
      </button>

      {/* Bottom right: fun facts about the place picked on Mars */}
      <div ref={factRef} className="absolute right-6 bottom-12 z-20 w-96 max-w-[calc(100%-3rem)] max-[900px]:right-4 max-[900px]:left-4 max-[900px]:w-auto max-[900px]:max-w-none">
        <FactCard
          siteId={siteId}
          hiddenFromEarth={hiddenFromEarth}
          onSelect={selectSite}
          onStep={focusSite}
        />
      </div>

      <p className="absolute right-6 bottom-4 left-6 z-10 text-[11px] text-white/40 sm:left-16">
        Mars as seen from Earth, time-lapse from now · Viking MDIM 2.1 via NASA Mars Trek · MGS MOLA via USGS Astrogeology · NASA/JPL NAIF
      </p>

      {showSaves && <SaveSelect onStart={startGame} onClose={() => setShowSaves(false)} />}

      <HowToPlayDialog open={panel === "howto"} onClose={closePanel} />
      <CodexDialog open={panel === "codex"} onClose={closePanel} codexIds={codexIds} />
      <SettingsDialog open={panel === "settings"} onClose={closePanel} />
      <CreditsDialog open={panel === "credits"} onClose={closePanel} />
    </main>
  )
}
