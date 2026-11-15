import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react"
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Compass,
  Lock,
  Play,
  Rocket,
  Settings,
  Volume2,
  VolumeX,
  X,
  type LucideIcon,
} from "lucide-react"
import { CrewHover } from "@/components/menu/CrewHover"
import { MarsGlobe, type MarsGlobeHandle } from "@/components/menu/MarsGlobe"
import { MissionPatch } from "@/components/menu/MissionPatch"
import { CodexDialog, CreditsDialog, HowToPlayDialog, SettingsDialog } from "@/components/menu/MenuDialogs"
import { GLOBE_SITES } from "@/content/codex"
import { cn } from "@/lib/utils"
import { useSettings } from "@/lib/settings"
import { playSfx, startMusic, stopMusic, unlockAudio, type SfxName } from "@/lib/sound"
import { useProgress } from "@/sim/progress"

export type StartMode = "new" | "continue"
type Panel = "howto" | "codex" | "settings" | "credits" | null

const LOCKED_HINT = "Play your first mission to unlock!"

/** Menu button with sounds; `locked` keeps it focusable but only wiggles. */
function MenuButton({
  locked,
  onPress,
  className,
  children,
  ...props
}: Omit<ComponentProps<"button">, "onClick"> & { locked?: boolean; onPress: () => void }) {
  const [wiggling, setWiggling] = useState(false)
  return (
    <button
      type="button"
      aria-disabled={locked || undefined}
      onPointerEnter={(e) => e.pointerType === "mouse" && !locked && playSfx("hover")}
      onClick={() => {
        if (locked) {
          playSfx("locked")
          setWiggling(true)
          return
        }
        playSfx("click")
        onPress()
      }}
      onAnimationEnd={() => setWiggling(false)}
      className={cn(
        "group relative flex items-center gap-3 rounded-3xl border-2 font-heading font-semibold transition",
        "focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary",
        locked
          ? "cursor-not-allowed border-white/10 bg-white/5 text-white/45"
          : "border-white/15 bg-card/70 backdrop-blur-sm hover:-translate-y-0.5 hover:border-primary hover:bg-card active:translate-y-0",
        wiggling && "animate-wiggle",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

function Tile({
  icon: Icon,
  label,
  locked,
  onPress,
}: {
  icon: LucideIcon
  label: string
  locked?: boolean
  onPress: () => void
}) {
  return (
    <MenuButton
      locked={locked}
      onPress={onPress}
      aria-label={locked ? `${label} (locked). ${LOCKED_HINT}` : label}
      className="h-24 flex-col justify-center gap-1.5 px-2 text-base"
    >
      <span className="relative">
        <Icon className="size-8 text-primary group-aria-disabled:text-white/40" aria-hidden />
        {locked && (
          <Lock className="absolute -right-2.5 -bottom-1 size-4 rounded-full bg-background p-0.5" aria-hidden />
        )}
      </span>
      <span className="leading-tight">{label}</span>
    </MenuButton>
  )
}

function RoundButton({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => {
        playSfx("click")
        onPress()
      }}
      className="flex size-12 items-center justify-center rounded-full border-2 border-white/15 bg-card/70 text-foreground backdrop-blur-sm transition hover:border-primary focus-visible:outline-4 focus-visible:outline-primary"
    >
      {children}
    </button>
  )
}

/** Fact card for the tapped globe pin, or an "explore" prompt when none is picked. */
function FactCard({
  siteId,
  onSelect,
}: {
  siteId: string | null
  onSelect: (id: string | null) => void
}) {
  const index = GLOBE_SITES.findIndex((s) => s.id === siteId)
  const site = GLOBE_SITES[index]
  const step = (delta: number) => {
    const next = GLOBE_SITES[(Math.max(index, 0) + delta + GLOBE_SITES.length) % GLOBE_SITES.length]
    onSelect(next.id)
  }

  if (!site) {
    return (
      <button
        type="button"
        onClick={() => {
          playSfx("click")
          onSelect(GLOBE_SITES[0].id)
        }}
        className="flex items-center gap-3 rounded-full border-2 border-white/15 bg-card/80 py-2 pr-5 pl-2 text-left font-heading text-base backdrop-blur-sm transition hover:border-primary focus-visible:outline-4 focus-visible:outline-primary"
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Compass className="size-5" aria-hidden />
        </span>
        <span>
          <span className="block font-semibold">Explore Mars</span>
          <span className="block text-sm text-muted-foreground">Spin the planet and tap a glowing dot!</span>
        </span>
      </button>
    )
  }

  return (
    <section
      aria-live="polite"
      aria-label={`Mars fact: ${site.title}`}
      className="w-full max-w-sm rounded-3xl border-2 border-primary/50 bg-card/90 p-5 backdrop-blur-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-heading text-2xl font-semibold text-mars">{site.title}</h2>
        <button
          type="button"
          aria-label="Close fact"
          onClick={() => onSelect(null)}
          className="-mt-1 -mr-1 flex size-10 items-center justify-center rounded-full hover:bg-muted focus-visible:outline-4 focus-visible:outline-primary"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <p className="mt-2 text-base leading-relaxed">{site.text}</p>
      <div className="mt-4 flex items-center justify-between gap-2">
        <a
          href={site.source.url}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-primary underline underline-offset-2"
        >
          Real fact from {site.source.label}
        </a>
        <div className="flex gap-2">
          <RoundButton label="Previous place" onPress={() => step(-1)}>
            <ChevronLeft className="size-5" aria-hidden />
          </RoundButton>
          <RoundButton label="Next place" onPress={() => step(1)}>
            <ChevronRight className="size-5" aria-hidden />
          </RoundButton>
        </div>
      </div>
    </section>
  )
}

export function MainMenu({ onStart }: { onStart: (mode: StartMode) => void }) {
  const globeRef = useRef<MarsGlobeHandle>(null)
  const columnRef = useRef<HTMLDivElement>(null)
  const [menuRight, setMenuRight] = useState(0)
  const [panel, setPanel] = useState<Panel>(null)
  const [siteId, setSiteId] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [playHot, setPlayHot] = useState(false)

  const hasSave = useProgress((s) => s.hasSave)
  const codexIds = useProgress((s) => s.codexIds)
  const muted = useSettings((s) => s.muted)
  const setSettings = useSettings((s) => s.setSettings)

  // Audio may only start after the first click or key press.
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

  // Tell the globe where the menu column ends so the crew stays out of its way.
  useEffect(() => {
    const column = columnRef.current
    if (!column) return
    const measure = () => setMenuRight(column.getBoundingClientRect().right)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(column)
    window.addEventListener("resize", measure)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [])

  const selectSite = (id: string | null) => {
    setSiteId(id)
    if (id) globeRef.current?.focusSite(id)
  }

  const openPanel = (next: Exclude<Panel, null>, sfx: SfxName = "open") => {
    playSfx(sfx)
    setPanel(next)
  }

  const launch = async (mode: StartMode) => {
    if (leaving) return
    setLeaving(true)
    setSiteId(null)
    stopMusic(1.4)
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    await Promise.all([
      globeRef.current?.zoomIn(),
      new Promise((resolve) => setTimeout(resolve, reduceMotion ? 600 : 1600)),
    ])
    onStart(mode)
  }

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#020104] text-foreground">
      <MarsGlobe
        ref={globeRef}
        className="absolute inset-0"
        selectedSiteId={siteId}
        onSelectSite={selectSite}
        menuRight={menuRight}
      />

      {/* Darken the left side so the menu stays readable over the globe */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 via-20% to-transparent to-40% transition-opacity duration-500 max-[900px]:bg-gradient-to-b max-[900px]:via-black/20",
          leaving && "opacity-0",
        )}
      />

      {/* The column is click-through so the globe behind it can still be dragged. */}
      <div
        className={cn(
          "pointer-events-none relative z-10 flex h-full flex-col justify-center px-4 pt-4 pb-14 sm:px-16 max-[900px]:justify-start max-[900px]:pt-6",
          "transition duration-500",
          leaving && "-translate-x-8 opacity-0",
        )}
      >
        <div
          ref={columnRef}
          className="pointer-events-auto flex w-full max-w-sm flex-col items-center max-[900px]:mx-auto max-[900px]:max-w-md"
        >
          <h1 className="sr-only">Ares Through Eons</h1>
          <MissionPatch className="size-44 animate-float sm:size-60 max-[900px]:size-36 [@media(max-height:700px)]:size-36" />

          {/* Top margin leaves room for the crew hovering above Play. */}
          <nav aria-label="Main menu" className="mt-[88px] flex w-full flex-col gap-3">
            <div
              className="relative"
              onPointerEnter={() => setPlayHot(true)}
              onPointerLeave={() => setPlayHot(false)}
              onFocus={() => setPlayHot(true)}
              onBlur={() => setPlayHot(false)}
            >
              {/* Rendered before the button so it sits behind it: the crew rises from behind Play. */}
              <CrewHover show={playHot || leaving} className="absolute inset-x-3 bottom-[calc(100%-12px)] h-24" />
              <MenuButton
                onPress={() => launch("new")}
                className="h-20 w-full justify-center border-primary bg-primary text-3xl text-primary-foreground shadow-[0_0_40px_rgba(45,212,191,0.35)] hover:bg-primary hover:brightness-110 max-[900px]:h-16 max-[900px]:text-2xl"
              >
                <Rocket className="size-8" aria-hidden />
                Play
              </MenuButton>
            </div>

            <MenuButton
              locked={!hasSave}
              onPress={() => launch("continue")}
              className="min-h-16 px-5 py-2 text-left text-xl"
            >
              {hasSave ? (
                <Play className="size-7 shrink-0 text-primary" aria-hidden />
              ) : (
                <Lock className="size-6 shrink-0" aria-hidden />
              )}
              <span>
                Continue
                {!hasSave && (
                  <span className="block font-sans text-sm font-normal text-white/60">{LOCKED_HINT}</span>
                )}
              </span>
            </MenuButton>

            <div className="grid grid-cols-3 gap-3">
              <Tile icon={CircleHelp} label="How to Play" onPress={() => openPanel("howto")} />
              <Tile icon={BookOpen} label="Mars Codex" locked={!hasSave} onPress={() => openPanel("codex")} />
              <Tile icon={Settings} label="Settings" onPress={() => openPanel("settings")} />
            </div>
            {!hasSave && (
              <p className="text-center text-sm text-white/60">
                <Lock className="mr-1 inline size-3.5 align-[-2px]" aria-hidden />
                Finish a mission to unlock Continue and the Mars Codex.
              </p>
            )}
          </nav>
        </div>
      </div>

      {/* Top-right: quick mute */}
      <div className={cn("absolute top-4 right-4 z-20 transition-opacity", leaving && "opacity-0")}>
        <RoundButton label={muted ? "Turn sound on" : "Turn sound off"} onPress={() => setSettings({ muted: !muted })}>
          {muted ? <VolumeX className="size-5" aria-hidden /> : <Volume2 className="size-5" aria-hidden />}
        </RoundButton>
      </div>

      {/* Bottom-right: globe facts */}
      <div
        className={cn(
          "pointer-events-none absolute right-4 bottom-16 z-20 flex justify-end transition-opacity *:pointer-events-auto sm:right-8 sm:bottom-20 max-[900px]:left-4 max-[900px]:justify-center",
          leaving && "opacity-0",
        )}
      >
        <FactCard siteId={siteId} onSelect={selectSite} />
      </div>

      {/* Footer: credits and data attribution */}
      <footer
        className={cn(
          "pointer-events-none absolute inset-x-4 bottom-4 z-20 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/60 sm:inset-x-16",
          leaving && "opacity-0",
        )}
      >
        <button
          type="button"
          onClick={() => openPanel("credits", "click")}
          className="pointer-events-auto rounded-full px-1 font-heading font-semibold text-white/80 underline underline-offset-4 hover:text-primary focus-visible:outline-4 focus-visible:outline-primary"
        >
          Credits
        </button>
        <span>Mars imagery: NASA/JPL/USGS via NASA Mars Trek</span>
      </footer>

      {/* Fades to black at the end of the zoom into Mars */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 z-30 bg-black opacity-0 transition-opacity duration-500",
          leaving && "opacity-100 delay-1000 motion-reduce:delay-0",
        )}
      />

      <HowToPlayDialog open={panel === "howto"} onOpenChange={(open) => !open && setPanel(null)} />
      <SettingsDialog open={panel === "settings"} onOpenChange={(open) => !open && setPanel(null)} />
      <CreditsDialog open={panel === "credits"} onOpenChange={(open) => !open && setPanel(null)} />
      <CodexDialog
        open={panel === "codex"}
        onOpenChange={(open) => !open && setPanel(null)}
        codexIds={codexIds}
      />
    </main>
  )
}
