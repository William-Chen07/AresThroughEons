/**
 * Tests for research taking time in Research Labs (src/sim/labs.ts and src/sim/research.ts), on
 * the real base map. Run from the game/ folder:
 *
 *   node --experimental-strip-types --import ./tests/pathing/register.mjs --test tests/pathing/research.test.ts
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import type { Base, PlacedModule } from "@/sim/base"
import { RESEARCH_ERAS, RESEARCH_PROJECTS, researchProject } from "@/content/research"
import { claimedLabCount, keepHidersResearching, labWorker, pickLabWorker, sendResearcher, shelterRule, staffedLabs } from "@/sim/labs"
import { buildNavigation, moduleStationId, type NavigationTerrain } from "@/sim/navigation"
import { addPawn, issueOrder, stepPathing, type World } from "@/sim/pathing"
import { NO_RESEARCH, addResearchWork, researchState, startResearch } from "@/sim/research"

const SIZE = 24
const flat = (): NavigationTerrain => ({ size: SIZE, metersPerCell: 163, metres: new Float32Array(SIZE * SIZE) })
const mod = (id: string, type: PlacedModule["type"], col: number, row: number): PlacedModule => ({ id, type, col, row })

/** A habitat (cols 2-4, rows 2-4) with two Research Labs: one wall to wall below it, one off on its own. */
const labBase = (): Base => ({
  modules: [mod("hab", "habitat", 2, 2), mod("lab1", "research", 2, 5), mod("lab2", "research", 15, 15)],
  tubes: [],
})
const LAB1 = moduleStationId("lab1")
const LAB2 = moduleStationId("lab2")

/** Steps the world like the map screen does, adding up lab work (game-hours × staffed labs). */
function run(w: World, hours: number, dt = 0.01) {
  let labHours = 0
  for (let t = 0; t < hours; t += dt) {
    stepPathing(w, dt)
    labHours += dt * staffedLabs(w).length
  }
  return labHours
}

test("an astronaut sent to a lab staffs it only once inside, and leaving stops it", () => {
  const w = buildNavigation(flat(), labBase())
  addPawn(w, "a", { x: 10, y: 10 })
  assert.ok(issueOrder(w, "a", { kind: "work", stationId: LAB1 }).ok)
  assert.equal(claimedLabCount(w), 1, "claimed while on the way")
  assert.equal(staffedLabs(w).length, 0, "not staffed while on the way")
  run(w, 3)
  assert.deepEqual(staffedLabs(w), [{ stationId: LAB1, pawnId: "a" }])
  assert.ok(run(w, 1) > 0.95, "an hour inside is about an hour of lab work")

  assert.ok(issueOrder(w, "a", { kind: "move", target: { x: 10, y: 10 } }).ok)
  assert.equal(staffedLabs(w).length, 0, "sent elsewhere: research stops straight away")
  assert.equal(labWorker(w, LAB1), null)
})

test("someone just walking through a lab doesn't staff it", () => {
  const w = buildNavigation(flat(), labBase())
  addPawn(w, "a", { x: 3, y: 6 }) // standing in lab 1
  assert.equal(staffedLabs(w).length, 0)
})

test("two staffed labs research twice as fast as one", () => {
  const w = buildNavigation(flat(), labBase())
  addPawn(w, "a", { x: 3, y: 3 })
  addPawn(w, "b", { x: 14, y: 14 })
  assert.ok(issueOrder(w, "a", { kind: "work", stationId: LAB1 }).ok)
  assert.ok(issueOrder(w, "b", { kind: "work", stationId: LAB2 }).ok)
  run(w, 3)
  assert.equal(staffedLabs(w).length, 2)
  const labHours = run(w, 2)
  assert.ok(Math.abs(labHours - 4) < 0.05, String(labHours))
})

test("a lab holds one astronaut: the nearest selected one goes, and a taken lab refuses others", () => {
  const w = buildNavigation(flat(), labBase())
  addPawn(w, "near", { x: 5, y: 8 })
  addPawn(w, "far", { x: 20, y: 2 })
  const pick = pickLabWorker(w, ["far", "near"], LAB1)
  assert.ok(pick.ok)
  assert.equal(pick.pawnId, "near")
  assert.deepEqual(pick.left, ["far"])
  assert.ok(issueOrder(w, "near", { kind: "work", stationId: LAB1 }).ok)
  assert.deepEqual(pickLabWorker(w, ["far"], LAB1), { ok: false, worker: "near" })
})

test("starting research sends the nearest free astronaut to the nearest free lab", () => {
  const w = buildNavigation(flat(), labBase())
  addPawn(w, "a", { x: 3, y: 3 })
  addPawn(w, "b", { x: 20, y: 20 })
  const sent = sendResearcher(w)
  assert.ok(sent.ok)
  assert.equal(sent.pawnId, "a")
  assert.equal(sent.stationId, LAB1)
  const noLabs = buildNavigation(flat(), { modules: [mod("hab", "habitat", 2, 2)], tubes: [] })
  addPawn(noLabs, "a", { x: 3, y: 3 })
  assert.deepEqual(sendResearcher(noLabs), { ok: false, reason: "Build a Research Lab first." })
})

test("research takes its hours of lab work, then is researched", () => {
  const wind = researchProject("wind-turbines")!
  let progress = startResearch(NO_RESEARCH, [], 1, "wind-turbines")
  assert.equal(progress.active, "wind-turbines")
  assert.equal(startResearch(NO_RESEARCH, [], 2, "bigger-lounge"), NO_RESEARCH, "locked projects can't start")
  let step = addResearchWork(progress, [], wind.hours - 1)
  assert.equal(step.finished, null)
  assert.deepEqual(step.researched, [])
  progress = step.progress
  step = addResearchWork(progress, [], 1)
  assert.equal(step.finished, "wind-turbines")
  assert.deepEqual(step.researched, ["wind-turbines"])
  assert.equal(step.progress.active, null)
  // Work on a project is kept when the player switches to another and back.
  const half = addResearchWork(startResearch(NO_RESEARCH, [], 1, "lounge"), [], 2).progress
  const back = startResearch(startResearch(half, [], 1, "wind-turbines"), [], 1, "lounge")
  assert.equal(back.hoursDone["lounge"], 2)
})

test("an era-2 project stays locked in era 1, even with everything it needs researched", () => {
  const before = ["lounge"]
  const bigger = researchProject("bigger-lounge")!
  assert.equal(researchState(bigger, before, 1), "locked")
  assert.equal(startResearch(NO_RESEARCH, before, 1, "bigger-lounge"), NO_RESEARCH)
  assert.equal(researchState(bigger, before, 2), "available")
  assert.equal(startResearch(NO_RESEARCH, before, 2, "bigger-lounge").active, "bigger-lounge")
})

/** Steps through a storm like the map screen does: everyone shelters, never two to a lab. */
function storm(w: World, hours: number, dt = 0.01) {
  for (let t = 0; t < hours; t += dt) {
    stepPathing(w, dt, { urgentNeed: () => "shelter", canShelterAt: shelterRule(w) })
    keepHidersResearching(w)
  }
}
/** How many astronauts stand in each lab. */
const inLab = (w: World, col: number, row: number) =>
  Object.values(w.movers).filter((m) => {
    const x = Math.round(m.pos.x), y = Math.round(m.pos.y)
    return x >= col && x < col + 3 && y >= row && y < row + 2
  }).length

test("in a storm, two astronauts never shelter in the same lab, and hiding there counts as research", () => {
  // Just a lab on its own: the only shelter nearby. Two astronauts outside, right by it.
  const w = buildNavigation(flat(), { modules: [mod("lab1", "research", 15, 15), mod("hab", "habitat", 2, 2)], tubes: [] })
  addPawn(w, "a", { x: 16, y: 18 })
  addPawn(w, "b", { x: 17, y: 18 })
  storm(w, 6)
  assert.equal(inLab(w, 15, 15), 1, "only one in the lab")
  assert.equal(staffedLabs(w, true).length, 1, "the one hiding there is researching")
  assert.ok(Object.values(w.movers).every((m) => m.exposure === "inside"), "both found shelter")
})

test("in a storm, someone idling in a lab that already has a researcher moves out", () => {
  const w = buildNavigation(flat(), labBase())
  addPawn(w, "worker", { x: 3, y: 3 })
  assert.ok(issueOrder(w, "worker", { kind: "work", stationId: LAB1 }).ok)
  run(w, 2)
  addPawn(w, "idler", { x: 4, y: 6 }) // standing in lab 1 too
  assert.equal(inLab(w, 2, 5), 2)
  storm(w, 4)
  assert.equal(inLab(w, 2, 5), 1)
  assert.equal(labWorker(w, LAB1), "worker")
  assert.equal(w.movers.idler.exposure, "inside", "it sheltered somewhere else indoors")
})

test("an astronaut who hid in a lab with nothing else to do keeps researching after the storm", () => {
  const w = buildNavigation(flat(), { modules: [mod("lab1", "research", 15, 15)], tubes: [] })
  addPawn(w, "a", { x: 16, y: 18 })
  storm(w, 4)
  assert.equal(staffedLabs(w, true).length, 1)
  run(w, 1) // the storm is over
  assert.equal(staffedLabs(w).length, 1)
  assert.equal(labWorker(w, moduleStationId("lab1")), "a")
})

test("the research tree is one tree: needs sit one column back, no two projects share a spot", () => {
  const ids = new Set(RESEARCH_PROJECTS.map((p) => p.id))
  assert.equal(ids.size, RESEARCH_PROJECTS.length, "ids are unique")
  const spots = new Set(RESEARCH_PROJECTS.map((p) => `${p.tier},${p.row}`))
  assert.equal(spots.size, RESEARCH_PROJECTS.length, "no two projects in the same place")
  for (const project of RESEARCH_PROJECTS) {
    assert.ok(RESEARCH_ERAS.some((e) => e.era === project.era), `${project.id} has an era colour`)
    assert.equal(project.requires.length === 0, project.tier === 0, `${project.id}: only the first column needs nothing`)
    for (const id of project.requires) {
      const need = researchProject(id)
      assert.ok(need, `${project.id} needs ${id}, which exists`)
      assert.equal(need.tier, project.tier - 1, `${project.id} needs ${id} from the column just before`)
      assert.ok(need.era <= project.era, `${project.id} doesn't need a project from a later era`)
    }
  }
})
