import { researchProject, type ResearchProject } from "@/content/research"

/*
 * The rules of the research tree, as pure logic: what is done, what can be
 * researched next and what is still locked, and how research moves along.
 *
 * Research takes time. One project at a time is being researched (`ResearchProgress.active`),
 * and it moves on only while astronauts work in Research Labs: every game-hour one astronaut
 * spends working in a lab is one hour of the project's `hours` done (see content/research.ts).
 * Each lab holds one astronaut, so two staffed labs research twice as fast. Work done on a
 * project is kept if the player switches to another one and back.
 * A project from a later era (content/research.ts `era`) stays locked until the expedition
 * reaches that era, even once everything it needs is researched.
 * A save keeps the ids of the projects it has researched and this progress (see sim/saves.ts).
 */

export type ResearchState = "done" | "available" | "locked"

/** The project being researched, and the game-hours of work done so far on each project. */
export interface ResearchProgress {
  /** Id of the project being researched, or null when none is. */
  active: string | null
  /** Game-hours of lab work put into each project that isn't finished yet. */
  hoursDone: Record<string, number>
}

export const NO_RESEARCH: ResearchProgress = { active: null, hoursDone: {} }

/** The projects this one still needs before it can be researched. */
export function missingRequirements(project: ResearchProject, researched: readonly string[]): ResearchProject[] {
  return project.requires
    .filter((id) => !researched.includes(id))
    .map(researchProject)
    .filter((needed) => needed !== undefined)
}

/** True if the expedition (in `era`) hasn't reached the project's era yet. */
export const lockedByEra = (project: ResearchProject, era: number) => project.era > era

/** `era` is the era the expedition is in: projects from later eras are locked. */
export function researchState(project: ResearchProject, researched: readonly string[], era: number): ResearchState {
  if (researched.includes(project.id)) return "done"
  if (lockedByEra(project, era)) return "locked"
  return missingRequirements(project, researched).length === 0 ? "available" : "locked"
}

/** Makes this project the one being researched, if it can be. Otherwise nothing changes. */
export function startResearch(
  progress: ResearchProgress,
  researched: readonly string[],
  era: number,
  id: string,
): ResearchProgress {
  const project = researchProject(id)
  if (!project || researchState(project, researched, era) !== "available") return progress
  return { ...progress, active: id }
}

/** Game-hours of lab work still needed to finish a project. */
export function hoursLeft(progress: ResearchProgress, project: ResearchProject): number {
  return Math.max(0, project.hours - (progress.hoursDone[project.id] ?? 0))
}

/**
 * Puts `labHours` game-hours of lab work (game-hours × staffed labs) into the active project.
 * When it is done it joins the researched list and nothing is being researched any more.
 */
export function addResearchWork(
  progress: ResearchProgress,
  researched: readonly string[],
  labHours: number,
): { progress: ResearchProgress; researched: string[]; finished: string | null } {
  const project = progress.active ? researchProject(progress.active) : undefined
  if (!project || labHours <= 0) return { progress, researched: [...researched], finished: null }
  const done = (progress.hoursDone[project.id] ?? 0) + labHours
  if (done < project.hours) {
    return { progress: { ...progress, hoursDone: { ...progress.hoursDone, [project.id]: done } }, researched: [...researched], finished: null }
  }
  const hoursDone = { ...progress.hoursDone }
  delete hoursDone[project.id]
  const finishedList = researched.includes(project.id) ? [...researched] : [...researched, project.id]
  return { progress: { active: null, hoursDone }, researched: finishedList, finished: project.id }
}
