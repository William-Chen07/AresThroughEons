import { useState } from "react"
import { researchProject, researchTree, type ResearchProject } from "@/content/research"
import { researchState, type ResearchState } from "@/sim/research"

/*
 * The research tree, opened from the Research button on the base map. Projects
 * sit in columns (tiers) with lines from what each one needs. Click a project
 * to pick it, then the Research button researches it, if everything it needs
 * is done. The screen shows only the tree and that button: no heading, no descriptions (each project's fact and NASA source
 * are still in content/research.ts for when they are wanted again).
 * Research is free and instant for now. The look copies MenuDialogs.
 */

// The tree is drawn on a fixed grid so the lines can be worked out without measuring the page.
const NODE_W = 184
const NODE_H = 52
const COL_GAP = 56
const ROW_GAP = 14
/** How big the tree for these projects is drawn, in CSS pixels. */
function treeSize(projects: ResearchProject[]) {
  const rows = Math.max(...projects.map((project) => project.row)) + 1
  const tiers = Math.max(...projects.map((project) => project.tier)) + 1
  return { width: tiers * NODE_W + (tiers - 1) * COL_GAP, height: rows * NODE_H + (rows - 1) * ROW_GAP }
}

const left = (project: ResearchProject) => project.tier * (NODE_W + COL_GAP)
const top = (project: ResearchProject) => project.row * (NODE_H + ROW_GAP)

/**
 * A straight line from the right side of `from` to the left side of `to`. Straight on purpose:
 * lines with corners share their upright part, and then it looks as if everything joins everything.
 */
function linePath(from: ResearchProject, to: ResearchProject) {
  return `M ${left(from) + NODE_W} ${top(from) + NODE_H / 2} L ${left(to)} ${top(to) + NODE_H / 2}`
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
  onResearch,
  onClose,
}: {
  /** The era the expedition is in: the panel shows that era's tree. */
  era: number
  /** Ids of the projects this expedition has finished. */
  researched: string[]
  onResearch: (projectId: string) => void
  onClose: () => void
}) {
  /** The project the Research button would research, once one has been clicked. */
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = selectedId ? researchProject(selectedId) : undefined
  const projects = researchTree(era)
  const { width: TREE_W, height: TREE_H } = treeSize(projects)
  const LINES = treeLines(projects)
  const canResearch = selected !== undefined && researchState(selected, researched) === "available"

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Research"
        className="max-h-full max-w-full overflow-y-auto border border-white/15 bg-neutral-950/90 p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-x-auto p-1">
          <div className="relative" style={{ width: TREE_W, height: TREE_H }}>
            <svg aria-hidden className="absolute inset-0" width={TREE_W} height={TREE_H} fill="none">
              {LINES.map(({ from, to }) => (
                <path
                  key={`${from.id}-${to.id}`}
                  d={linePath(from, to)}
                  strokeWidth={2}
                  className={researched.includes(from.id) ? "stroke-orange-400/80" : "stroke-white/20"}
                />
              ))}
            </svg>
            {projects.map((project) => {
              const state = researchState(project, researched)
              return (
                <button
                  key={project.id}
                  type="button"
                  aria-pressed={project.id === selectedId}
                  aria-label={`${project.name}, ${stateLabel[state]}`}
                  onClick={() => setSelectedId(project.id)}
                  className={`absolute flex items-center border px-3 text-left text-xs font-semibold leading-tight transition focus-visible:outline-2 focus-visible:outline-orange-400 ${nodeLook[state]} ${project.id === selectedId ? "outline-2 outline-offset-2 outline-white/70" : ""}`}
                  style={{ left: left(project), top: top(project), width: NODE_W, height: NODE_H }}
                >
                  {project.name}
                </button>
              )
            })}
          </div>
        </div>
        <button
          type="button"
          disabled={!canResearch}
          onClick={() => selected && onResearch(selected.id)}
          className="mt-6 border border-orange-400/70 bg-orange-500/15 px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] transition hover:bg-orange-500/30 focus-visible:outline-2 focus-visible:outline-orange-400 disabled:pointer-events-none disabled:border-white/15 disabled:bg-transparent disabled:text-white/35"
        >
          Research
        </button>
      </div>
    </div>
  )
}
