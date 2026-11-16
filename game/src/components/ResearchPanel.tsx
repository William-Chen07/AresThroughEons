import { useEffect, useRef, useState } from "react"
import { X } from "lucide-react"
import { RESEARCH_ERAS, RESEARCH_PROJECTS, eraColor, researchProject, type ResearchProject } from "@/content/research"
import { formatRealTime } from "@/sim/clock"
import { useGameSpeed } from "@/lib/gameSpeed"
import { hoursLeft, lockedByEra, researchState, type ResearchProgress, type ResearchState } from "@/sim/research"

/*
 * The research tree, opened from Research in the base map's Actions dropdown. Projects
 * sit in columns (tiers) with lines from what each one needs. Click a project
 * to pick it, then the Research button starts researching it, if everything it
 * needs is done. Each project's fact and NASA source are in content/research.ts
 * for when they are wanted on screen.
 *
 * Research takes time and needs astronauts working in Research Labs (see sim/research.ts and
 * sim/labs.ts); the project being researched shows how far along it is. The coloured stripe on
 * each project is its era (see RESEARCH_ERAS); projects from a later era stay locked until the
 * expedition gets there. Times are real time at one astronaut's pace: more staffed labs don't
 * shorten the time shown, they make it count down (and the bar fill) faster. The look copies MenuDialogs.
 *
 * It fills the whole screen and is the same single tree in every era. When the tree is wider
 * (or taller) than the screen it scrolls. The ✕ in the top-right corner or Esc closes it.
 */

// The tree is drawn on a grid so the lines can be worked out without measuring each project.
// Projects are a fixed size; the gaps between them stretch to spread the tree over the screen,
// down to a minimum, below which the tree scrolls instead.
const NODE_W = 248
const NODE_H = 84
const MIN_COL_GAP = 72
const MAX_COL_GAP = 280
const MIN_ROW_GAP = 24
const MAX_ROW_GAP = 220
/** Space around the tree inside the scrolling area, in CSS pixels (matches the p-10 below). */
const PAD = 40

interface Layout {
  colGap: number
  rowGap: number
  width: number
  height: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** How big the tree for these projects is drawn to fill a space of `avail` CSS pixels. */
function treeLayout(projects: ResearchProject[], avail: { width: number; height: number }): Layout {
  const rows = Math.max(...projects.map((project) => project.row)) + 1
  const tiers = Math.max(...projects.map((project) => project.tier)) + 1
  const colGap = tiers > 1 ? clamp((avail.width - 2 * PAD - tiers * NODE_W) / (tiers - 1), MIN_COL_GAP, MAX_COL_GAP) : 0
  const rowGap = rows > 1 ? clamp((avail.height - 2 * PAD - rows * NODE_H) / (rows - 1), MIN_ROW_GAP, MAX_ROW_GAP) : 0
  return { colGap, rowGap, width: tiers * NODE_W + (tiers - 1) * colGap, height: rows * NODE_H + (rows - 1) * rowGap }
}

const left = (project: ResearchProject, layout: Layout) => project.tier * (NODE_W + layout.colGap)
const top = (project: ResearchProject, layout: Layout) => project.row * (NODE_H + layout.rowGap)

/**
 * A straight line from the right side of `from` to the left side of `to`. Straight on purpose:
 * lines with corners share their upright part, and then it looks as if everything joins everything.
 */
function linePath(from: ResearchProject, to: ResearchProject, layout: Layout) {
  return `M ${left(from, layout) + NODE_W} ${top(from, layout) + NODE_H / 2} L ${left(to, layout)} ${top(to, layout) + NODE_H / 2}`
}

/** A line from each project to every project in the same tree that needs it. */
const treeLines = (projects: ResearchProject[]) =>
  projects.flatMap((to) =>
    to.requires.flatMap((id) => {
      const from = projects.find((project) => project.id === id)
      return from ? [{ from, to }] : []
    }),
  )

const nodeLook: Record<ResearchState, string> = {
  done: "border-orange-400/70 bg-orange-500/25 text-orange-100",
  available: "border-white/40 bg-white/5 text-white hover:border-orange-400/70 hover:bg-orange-500/15",
  locked: "border-white/10 bg-white/[0.02] text-white/35 hover:border-white/30",
}
/** Not shown, but read out by screen readers, since the colours alone say nothing to them. */
const stateLabel: Record<ResearchState, string> = {
  done: "researched",
  available: "ready to research",
  locked: "locked",
}

export function ResearchPanel({
  era,
  researched,
  progress,
  labCount,
  staffedLabs,
  claimedLabs,
  onStart,
  onClose,
}: {
  /** The era the expedition is in: projects from later eras are locked. */
  era: number
  /** Ids of the projects this expedition has finished. */
  researched: string[]
  /** The project being researched and the work done on each. */
  progress: ResearchProgress
  /** How many Research Labs the base has. Research can't start without one. */
  labCount: number
  /** How many labs have their astronaut inside right now. */
  staffedLabs: number
  /** How many labs have an astronaut sent to them, there or still on the way. */
  claimedLabs: number
  onStart: (projectId: string) => void
  onClose: () => void
}) {
  /** The project the Research button would start, once one has been clicked. */
  const [selectedId, setSelectedId] = useState<string | null>(progress.active)
  const selected = selectedId ? researchProject(selectedId) : undefined
  /** Countdowns show real time, which is shorter while the game is sped up. */
  const speed = useGameSpeed()
  const projects = RESEARCH_PROJECTS
  /** The size of the scrolling area, so the tree can spread out to fill it. */
  const areaRef = useRef<HTMLDivElement>(null)
  const [area, setArea] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setArea({ width: el.clientWidth, height: el.clientHeight }))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const layout = treeLayout(projects, area)
  const { width: TREE_W, height: TREE_H } = layout
  const LINES = treeLines(projects)
  const selectedState = selected ? researchState(selected, researched, era) : null
  const isActive = selected !== undefined && selected.id === progress.active
  const canStart = selectedState === "available" && !isActive && labCount > 0

  /** One line beside the Research button about the picked project: what it takes, or why it can't start. */
  let note = "Pick a project to research."
  if (selected && selectedState === "done") note = `${selected.name} is researched.`
  else if (selected && lockedByEra(selected, era)) note = `${selected.name} unlocks in Era ${selected.era}.`
  else if (selected && selectedState === "locked") note = `${selected.name} needs the projects joined to it on the left first.`
  else if (selected) {
    const remaining = hoursLeft(progress, selected)
    const time =
      remaining < selected.hours
        ? `${formatRealTime(remaining, speed)} left of ${formatRealTime(selected.hours, speed)}`
        : `takes ${formatRealTime(selected.hours, speed)}`
    if (labCount === 0) note = `${selected.name}: ${time}. Build a Research Lab first: research only happens in one.`
    else if (isActive && staffedLabs > 0) {
      note = `Researching ${selected.name}: ${time}. ${staffedLabs} ${staffedLabs === 1 ? "lab is" : "labs are"} working on it.`
    } else if (isActive && claimedLabs > 0) note = `Researching ${selected.name}: ${time}. An astronaut is walking to the Research Lab.`
    else if (isActive) note = `Researching ${selected.name}: ${time}. Nobody is in a Research Lab, so it has stopped.`
    else {
      note = `${selected.name}: ${time} with one astronaut in a Research Lab. A Researcher works 1.5× as fast, and each extra lab with an astronaut in it makes the time count down faster.`
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Research"
      className="absolute inset-0 z-30 flex flex-col bg-neutral-950/95 backdrop-blur-sm"
    >
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-6 py-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-orange-300/90">Research</h2>
          {/* What each era colour means. */}
          <ul aria-label="Eras" className="flex gap-4 text-[11px] uppercase tracking-[0.2em] text-white/60">
            {RESEARCH_ERAS.map((era) => (
              <li key={era.era} className="flex items-center gap-1.5">
                <span aria-hidden className="size-2.5" style={{ background: era.color }} />
                {era.name}
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          aria-label="Close research"
          onClick={onClose}
          className="flex size-10 items-center justify-center border border-white/15 transition hover:border-orange-400/70 hover:bg-orange-500/15 focus-visible:outline-2 focus-visible:outline-orange-400"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      {/* Scrolls sideways (and up and down) when the tree doesn't fit; centred when it does. */}
      <div ref={areaRef} className="min-h-0 flex-1 overflow-auto">
        <div className="flex min-h-full min-w-max items-center justify-center p-10">
          <div className="relative shrink-0" style={{ width: TREE_W, height: TREE_H }}>
            <svg aria-hidden className="absolute inset-0" width={TREE_W} height={TREE_H} fill="none">
              {LINES.map(({ from, to }) => (
                <path
                  key={`${from.id}-${to.id}`}
                  d={linePath(from, to, layout)}
                  strokeWidth={2.5}
                  className={researched.includes(from.id) ? "stroke-orange-400/80" : "stroke-white/20"}
                />
              ))}
            </svg>
            {projects.map((project) => {
              const state = researchState(project, researched, era)
              const active = project.id === progress.active
              const done = project.hours - hoursLeft(progress, project)
              return (
                <button
                  key={project.id}
                  type="button"
                  aria-pressed={project.id === selectedId}
                  aria-label={`${project.name}, era ${project.era}, ${active ? "being researched" : stateLabel[state]}`}
                  onClick={() => setSelectedId(project.id)}
                  className={`absolute flex flex-col justify-center gap-1 overflow-hidden border border-l-[6px] px-4 text-left text-base leading-tight transition focus-visible:outline-2 focus-visible:outline-orange-400 ${nodeLook[state]} ${project.id === selectedId ? "outline-2 outline-offset-2 outline-white/70" : ""}`}
                  style={{
                    left: left(project, layout),
                    top: top(project, layout),
                    width: NODE_W,
                    height: NODE_H,
                    borderLeftColor: eraColor(project.era),
                  }}
                >
                  <span className="font-semibold">{project.name}</span>
                  <span className="text-xs tracking-wide opacity-70">
                    {state === "done"
                      ? "Researched"
                      : lockedByEra(project, era)
                        ? `Unlocks in Era ${project.era}`
                        : active
                          ? `Researching · ${formatRealTime(project.hours - done, speed)} left`
                          : formatRealTime(project.hours, speed)}
                  </span>
                  {/* How far along: the one being researched, or one that was started and left for another. */}
                  {state !== "done" && done > 0 && (
                    <span aria-hidden className="absolute inset-x-0 bottom-0 h-1.5 bg-white/10">
                      <span
                        className={`block h-full ${active ? "bg-orange-400" : "bg-white/40"}`}
                        style={{ width: `${(done / project.hours) * 100}%` }}
                      />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-6 gap-y-3 border-t border-white/10 px-6 py-4">
        <p className="max-w-xl text-sm text-white/70" aria-live="polite">
          {note}
        </p>
        <button
          type="button"
          disabled={!canStart}
          onClick={() => selected && onStart(selected.id)}
          className="border border-orange-400/70 bg-orange-500/15 px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] transition hover:bg-orange-500/30 focus-visible:outline-2 focus-visible:outline-orange-400 disabled:pointer-events-none disabled:border-white/15 disabled:bg-transparent disabled:text-white/35"
        >
          {isActive ? "Researching" : progress.active && selectedState === "available" ? "Research this instead" : "Research"}
        </button>
      </div>
    </div>
  )
}
