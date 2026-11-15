import { researchProject, type ResearchProject } from "@/content/research"

/*
 * The rules of the research tree, as pure logic: what is done, what can be
 * researched next and what is still locked. A save keeps the ids of the
 * projects it has researched (see sim/saves.ts). Research is free and instant
 * for now; costs and research time come later.
 */

export type ResearchState = "done" | "available" | "locked"

/** The projects this one still needs before it can be researched. */
export function missingRequirements(project: ResearchProject, researched: readonly string[]): ResearchProject[] {
  return project.requires
    .filter((id) => !researched.includes(id))
    .map(researchProject)
    .filter((needed) => needed !== undefined)
}

export function researchState(project: ResearchProject, researched: readonly string[]): ResearchState {
  if (researched.includes(project.id)) return "done"
  return missingRequirements(project, researched).length === 0 ? "available" : "locked"
}

/** The researched list with this project added, or the same list if it can't be researched yet. */
export function withResearch(researched: readonly string[], id: string): string[] {
  const project = researchProject(id)
  if (!project || researchState(project, researched) !== "available") return [...researched]
  return [...researched, id]
}
