import { useEffect, useRef, type ReactNode } from "react"
import { Eraser, FastForward, Lock, Radiation, RotateCcw, Trash2, X } from "lucide-react"
import { MODULE_RESEARCH, MODULE_TYPES, moduleUnlocked, type BuildCost, type ModuleType, type ModuleTypeId } from "@/content/modules"
import { researchProject } from "@/content/research"
import { RESOURCE_TYPES } from "@/content/resources"
import { ResourceIcon } from "@/components/ResourceIcon"

/*
 * The Build bar along the bottom of the base map, for building the base by hand while the real
 * building rules don't exist yet: place modules, lay the tubes between them, and remove either.
 * Nothing connects by itself (see sim/base.ts). Opened from Build in the Actions dropdown or the
 * ` key. Every module and tool is a card with a picture, what it costs and what it does; the row
 * scrolls sideways when it doesn't fit. It can also start and stop a radiation storm, for trying
 * the weather out, reset the map and move on to the next era.
 *
 * The costs come from content/modules.ts and are placeholders: building doesn't use resources yet.
 * Tubes are free. A module that needs research (MODULE_RESEARCH) sits in its own Locked group,
 * after the modules that can be built, and says which project unlocks it until that research is done.
 * While it is open the bar's height is kept in the CSS variable --build-bar on the page, so the
 * things along the bottom of the screen can sit above it.
 */

export type BuildTool = { kind: "place"; type: ModuleTypeId } | { kind: "tube" } | { kind: "remove" } | null

const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`
/** The colour a little darker, for a module's front wall. */
const darker = (color: number, by = 0.6) => {
  const channel = (shift: number) => Math.round(((color >> shift) & 0xff) * by)
  return hex((channel(16) << 16) | (channel(8) << 8) | channel(0))
}

/**
 * A module seen from above, the way the map draws it: its roof, its label, and its front wall with
 * the door. Every module is drawn at the same scale, so their sizes compare.
 */
function ModulePicture({ type }: { type: ModuleType }) {
  const cell = 14
  const w = type.width * cell
  const h = type.height * cell
  const wall = 5
  const scale = 1.25
  return (
    <svg aria-hidden viewBox={`-2 -2 ${w + 4} ${h + wall + 4}`} width={(w + 4) * scale} height={(h + wall + 4) * scale}>
      <rect x={0} y={0} width={w} height={h + wall} fill="#1a1412" />
      <rect x={1.5} y={1.5} width={w - 3} height={h - 1.5} fill={hex(type.color)} />
      <rect x={1.5} y={h} width={w - 3} height={wall - 1.5} fill={darker(type.color)} />
      {/* The door, in the middle of the front wall. */}
      <rect x={w / 2 - 2.5} y={h + 0.5} width={5} height={wall - 1} fill="#1a1412" />
      <text
        x={w / 2}
        y={h / 2 + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={8}
        fontWeight={700}
        letterSpacing={0.8}
        fill="#1a1412"
        fontFamily="inherit"
      >
        {type.code}
      </text>
    </svg>
  )
}

/** Two small modules joined by a run of tube. */
function TubePicture() {
  return (
    <svg aria-hidden viewBox="0 0 64 28" className="h-full max-w-full">
      <rect x={2} y={4} width={18} height={18} fill="#1a1412" />
      <rect x={3.5} y={5.5} width={15} height={13} fill="#d8d4cc" />
      <rect x={44} y={4} width={18} height={18} fill="#1a1412" />
      <rect x={45.5} y={5.5} width={15} height={13} fill="#d8d4cc" />
      <rect x={20} y={9} width={24} height={8} fill="#1a1412" />
      <rect x={20} y={10.5} width={24} height={5} fill="#9a958d" />
      <path d="M26 10.5v5M32 10.5v5M38 10.5v5" stroke="#6b665f" strokeWidth={1} />
    </svg>
  )
}

/** What a card costs, with each resource's icon, or that it costs nothing. */
function Cost({ cost }: { cost: BuildCost | null }) {
  const parts = cost ? RESOURCE_TYPES.filter((type) => (cost[type.id] ?? 0) > 0) : []
  if (parts.length === 0) return <p className="text-[11px] text-white/40">No cost</p>
  return (
    <p className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] tabular-nums text-white/80">
      {parts.map((type) => (
        <span key={type.id} className="flex items-center gap-1" title={type.name}>
          <ResourceIcon id={type.id} color={type.color} className="size-3.5" />
          {cost![type.id]}
          <span className="sr-only"> {type.name}</span>
        </span>
      ))}
    </p>
  )
}

/** One card in the bar. `pressed` is set for tools that stay picked; actions that happen at once leave it out. */
function Card({
  name,
  size,
  picture,
  cost,
  description,
  pressed,
  danger,
  disabled,
  locked,
  onClick,
}: {
  name: string
  size?: string
  picture: ReactNode
  cost: BuildCost | null
  description: string
  pressed?: boolean
  danger?: boolean
  disabled?: boolean
  /** Why it can't be used yet, e.g. the research it needs. Locks the card and is shown on it. */
  locked?: string
  onClick: () => void
}) {
  const look = pressed
    ? "border-amber-300/80 bg-amber-400/20 shadow-[0_0_14px_rgb(252_211_77/0.3)]"
    : danger
      ? "border-cyan-300/25 bg-cyan-300/5 hover:border-red-400/70 hover:bg-red-500/10"
      : "border-cyan-300/25 bg-cyan-300/5 hover:border-cyan-300/80 hover:bg-cyan-400/10"
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled || locked !== undefined}
      onClick={onClick}
      className={`flex w-44 shrink-0 flex-col gap-1.5 border p-2 text-left transition focus-visible:outline-2 focus-visible:outline-cyan-300 disabled:pointer-events-none ${locked ? "border-cyan-300/15 bg-cyan-300/[0.03]" : `disabled:opacity-40 ${look}`}`}
    >
      <span className="relative flex h-[4.5rem] items-center justify-center bg-black/35 p-1">
        <span className={`flex h-full items-center justify-center ${locked ? "opacity-30 grayscale" : ""}`}>{picture}</span>
        {locked && <Lock aria-hidden className="absolute top-1.5 right-1.5 size-4 text-white/70" />}
      </span>
      <span className="flex items-baseline justify-between gap-2">
        <span className={`text-xs font-semibold uppercase tracking-[0.15em] ${pressed ? "text-amber-50" : ""}`}>{name}</span>
        {size && <span className="text-[11px] text-white/45">{size}</span>}
      </span>
      {locked ? <p className="text-[11px] font-semibold text-amber-200/80">{locked}</p> : <Cost cost={cost} />}
      <span className={`text-[11px] leading-snug ${locked ? "text-white/40" : "text-white/60"}`}>{description}</span>
    </button>
  )
}

/** A labelled group of cards. */
function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex shrink-0 flex-col gap-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/45">{label}</p>
      <div className="flex gap-2">{children}</div>
    </div>
  )
}

const toolIcon = "size-9 text-white/80"

/** The line on a locked module's card: the research project that unlocks it. */
function lockedReason(id: ModuleTypeId, researched: readonly string[]) {
  if (moduleUnlocked(id, researched)) return undefined
  const project = researchProject(MODULE_RESEARCH[id]!)
  return `Research ${project?.name ?? "it"} first`
}

export function BuildPanel({
  tool,
  researched,
  onTool,
  tubeStarted,
  moduleCount,
  tubeCells,
  groupCount,
  message,
  stormActive,
  onStorm,
  onResetMap,
  onNextEra,
  onClear,
  onClose,
}: {
  tool: BuildTool
  /** Ids of the research projects done: modules that need one stay locked until it is. */
  researched: readonly string[]
  /** Picking the tool that is already active turns it off. */
  onTool: (tool: BuildTool) => void
  /** True once the tube tool's first click has picked where a run starts. */
  tubeStarted: boolean
  moduleCount: number
  /** How many cells of tube the base has. */
  tubeCells: number
  /** How many separate groups of joined modules there are. One means every module is connected. */
  groupCount: number
  /** What the last click did, or why it did nothing. */
  message: string | null
  /** True while a radiation storm is going on. */
  stormActive: boolean
  /** Starts a radiation storm, or ends the one going on. */
  onStorm: () => void
  /** Starts the expedition over at the same landing site, as if opened for the first time: the landing replays. */
  onResetMap: () => void
  /** Ends this era and starts the next on the same map (the base wears down and a new lander comes down). */
  onNextEra: () => void
  onClear: () => void
  onClose: () => void
}) {
  const hint =
    tool?.kind === "place"
      ? "Click the map to place it. Green means it fits."
      : tool?.kind === "tube"
        ? tubeStarted
          ? "Click where the run ends. Tubes run straight, along a row or a column."
          : "Click the block where a run of tube starts. Tubes meet a module at a doorway, the notch in the middle of each side."
        : tool?.kind === "remove"
          ? "Click a module or a block of tube to remove it."
          : "Pick a module or a tool, then click the map."

  // Keeps the bar's height in --build-bar, so what sits along the bottom of the screen moves up above it.
  const barRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const bar = barRef.current
    if (!bar) return
    const root = document.documentElement
    const observer = new ResizeObserver(() => root.style.setProperty("--build-bar", `${bar.offsetHeight}px`))
    observer.observe(bar)
    return () => {
      observer.disconnect()
      root.style.removeProperty("--build-bar")
    }
  }, [])

  const placing = tool?.kind === "place" ? tool.type : null
  // The modules that can be built now come first, then the ones still locked behind research.
  const unlocked = MODULE_TYPES.filter((type) => moduleUnlocked(type.id, researched))
  const locked = MODULE_TYPES.filter((type) => !moduleUnlocked(type.id, researched))

  return (
    <section
      ref={barRef}
      aria-label="Build"
      className="pointer-events-auto border-t border-cyan-300/25 holo-surface backdrop-blur-sm"
    >
      <div className="flex items-center gap-x-4 gap-y-1 px-4 pt-2 sm:px-6">
        <h2 className="holo-title text-xs font-semibold uppercase tracking-[0.3em]">Build</h2>
        <p className="min-w-0 flex-1 truncate text-[11px] text-white/60">
          {hint}
          {message && <span className="text-cyan-100/90"> {message}</span>}
        </p>
        <p className="hidden shrink-0 text-[11px] text-white/45 md:block">
          {moduleCount} {moduleCount === 1 ? "module" : "modules"}, {tubeCells} {tubeCells === 1 ? "block" : "blocks"} of
          tube
          {moduleCount > 1 && (groupCount === 1 ? ", all joined" : `, ${groupCount} separate groups`)}. Esc drops the tool.
        </p>
        <button
          type="button"
          aria-label="Close the Build bar"
          onClick={onClose}
          className="flex size-7 shrink-0 items-center justify-center border border-cyan-300/25 transition hover:border-cyan-300/80 hover:bg-cyan-400/15 focus-visible:outline-2 focus-visible:outline-cyan-300"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      {/* Read out when a click does something, since the line above is cut short on a narrow screen. */}
      <p className="sr-only" aria-live="polite">
        {message}
      </p>

      {/* Scrolls sideways when the cards don't fit. */}
      <div className="fx-build-tray flex gap-5 overflow-x-auto px-4 pt-1.5 pb-3 [scrollbar-color:rgb(255_255_255/0.25)_transparent] [scrollbar-width:thin] sm:px-6">
        <Group label="Modules">
          {unlocked.map((type) => (
            <Card
              key={type.id}
              name={type.name}
              size={`${type.width}×${type.height}`}
              picture={<ModulePicture type={type} />}
              cost={type.cost}
              description={type.description}
              pressed={placing === type.id}
              onClick={() => onTool(placing === type.id ? null : { kind: "place", type: type.id })}
            />
          ))}
        </Group>

        {/* Modules that need research first, after the ones that can be built. */}
        {locked.length > 0 && (
          <Group label="Locked: needs research">
            {locked.map((type) => (
              <Card
                key={type.id}
                name={type.name}
                size={`${type.width}×${type.height}`}
                picture={<ModulePicture type={type} />}
                cost={type.cost}
                description={type.description}
                locked={lockedReason(type.id, researched)}
                onClick={() => {}}
              />
            ))}
          </Group>
        )}

        <Group label="Tubes">
          <Card
            name="Lay tubes"
            picture={<TubePicture />}
            cost={null}
            description="Joins modules, so the crew can walk between them without going outside."
            pressed={tool?.kind === "tube"}
            onClick={() => onTool(tool?.kind === "tube" ? null : { kind: "tube" })}
          />
          <Card
            name="Remove"
            picture={<Trash2 className={toolIcon} aria-hidden />}
            cost={null}
            description="Takes away a module or a block of tube: click the one to remove."
            pressed={tool?.kind === "remove"}
            onClick={() => onTool(tool?.kind === "remove" ? null : { kind: "remove" })}
          />
          <Card
            name="Clear all"
            picture={<Eraser className={toolIcon} aria-hidden />}
            cost={null}
            description="Removes every module and every block of tube from the map at once."
            danger
            disabled={moduleCount === 0 && tubeCells === 0}
            onClick={onClear}
          />
        </Group>

        <Group label="Weather">
          <Card
            name={stormActive ? "End storm" : "Radiation storm"}
            picture={<Radiation className={`size-9 ${stormActive ? "text-orange-300" : "text-white/80"}`} aria-hidden />}
            cost={null}
            description={
              stormActive
                ? "Ends the radiation storm going on now, and the crew go back to what they were doing."
                : "Starts a radiation storm, to see the crew take shelter. Anyone left outside loses health."
            }
            pressed={stormActive}
            onClick={onStorm}
          />
        </Group>

        <Group label="Expedition">
          <Card
            name="Reset map"
            picture={<RotateCcw className={toolIcon} aria-hidden />}
            cost={null}
            description="Starts this expedition over at the same landing site, landing and all."
            danger
            onClick={onResetMap}
          />
          <Card
            name="Next era"
            picture={<FastForward className={toolIcon} aria-hidden />}
            cost={null}
            description="Ends this era. The modules stay, worn down, and a new crew lands beside them."
            onClick={onNextEra}
          />
        </Group>
      </div>
    </section>
  )
}
