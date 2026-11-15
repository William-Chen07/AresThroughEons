/**
 * Tests for crew movement on the real base map (src/sim/navigation.ts): Brandon's base (modules,
 * tubes, the lander) and the terrain turned into a walkable map. Run from the game/ folder:
 *
 *   node --experimental-strip-types --import ./tests/pathing/register.mjs --test tests/pathing/navigation.test.ts
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import type { Base, PlacedModule } from "@/sim/base"
import { buildNavigation, moduleStationId, syncNavigation, type NavigationTerrain } from "@/sim/navigation"
import {
  addPawn, getZone, handleClick, issueOrder, scaleFor, stepPathing, PATHING_TUNING, getCost, BLOCKED,
  type PathingEvent, type World,
} from "@/sim/pathing"

const SIZE = 24
const METERS_PER_CELL = 163
const flat = (): NavigationTerrain => ({ size: SIZE, metersPerCell: METERS_PER_CELL, metres: new Float32Array(SIZE * SIZE) })
const mod = (id: string, type: PlacedModule["type"], col: number, row: number): PlacedModule => ({ id, type, col, row })

/**
 * Habitat (cols 2-4, rows 2-4), a Research Lab wall to wall below it (cols 2-4, rows 5-6),
 * a tube east of the habitat (5,3)-(6,3) and an Airlock at (7,3)-(8,3). The lander is in the middle.
 */
function smallBase(withAirlock = true): Base {
  const modules = [mod("hab", "habitat", 2, 2), mod("lab", "research", 2, 5)]
  if (withAirlock) modules.push(mod("air", "airlock", 7, 3))
  return { modules, tubes: [{ col: 5, row: 3 }, { col: 6, row: 3 }] }
}
const at = (w: World, col: number, row: number) => getZone(w.grid, col, row)

function runUntil(w: World, done: (ev: PathingEvent[]) => boolean, dt = 0.01, max = 20000) {
  const all: PathingEvent[] = []
  for (let i = 0; i < max; i++) {
    const ev = stepPathing(w, dt)
    all.push(...ev)
    if (done(ev)) return all
  }
  throw new Error("did not finish")
}
const arrivedEvent = (ev: PathingEvent[]) => ev.some((e) => e.type === "arrived")

test("the base becomes a walkable map: modules and tubes inside, airlocks, open ground, lander blocked", () => {
  const w = buildNavigation(flat(), smallBase())
  assert.equal(w.grid.metersPerTile, METERS_PER_CELL)
  assert.equal(at(w, 3, 3), "inside", "habitat")
  assert.equal(at(w, 3, 6), "inside", "lab")
  assert.equal(at(w, 5, 3), "inside", "tube")
  assert.equal(at(w, 7, 3), "airlock")
  assert.equal(at(w, 8, 3), "airlock")
  assert.equal(at(w, 15, 15), "outside", "open ground")
  assert.equal(getCost(w.grid, 12, 12), BLOCKED, "the lander")
  assert.deepEqual(w.stations.map((s) => s.id).sort(), ["module:air", "module:hab", "module:lab"])
  assert.ok(w.stations.every((s) => s.walkIn))
})

test("crew in the habitat walk out through the airlock", () => {
  const w = buildNavigation(flat(), smallBase())
  addPawn(w, "a", { x: 3, y: 3 })
  assert.ok(issueOrder(w, "a", { kind: "move", target: { x: 16, y: 3 } }).ok)
  const events = runUntil(w, arrivedEvent)
  assert.ok(events.some((e) => e.type === "airlockCycling" && e.to === "outside"))
  assert.equal(w.movers.a.exposure, "outside")
})

test("without an airlock nobody can get outside", () => {
  const w = buildNavigation(flat(), smallBase(false))
  addPawn(w, "a", { x: 3, y: 3 })
  const r = issueOrder(w, "a", { kind: "move", target: { x: 16, y: 3 } })
  assert.equal(r.ok, false)
})

test("modules joined wall to wall are walked between inside, no airlock needed", () => {
  const w = buildNavigation(flat(), smallBase(false))
  addPawn(w, "a", { x: 3, y: 2 })
  assert.ok(issueOrder(w, "a", { kind: "move", target: { x: 3, y: 6 } }).ok)
  assert.ok(w.movers.a.path.every((t) => at(w, t.x, t.y) === "inside"))
  runUntil(w, arrivedEvent)
  assert.equal(w.movers.a.exposure, "inside")
})

test("click a crewmate, then a module: they go in and work there", () => {
  const w = buildNavigation(flat(), smallBase())
  addPawn(w, "a", { x: 3, y: 3 })
  handleClick(w, { x: 3, y: 3 })
  const r = handleClick(w, { x: 4, y: 6 }) // a cell of the lab
  assert.ok(r.kind === "ordered" && r.order.kind === "work" && r.order.stationId === moduleStationId("lab"))
  runUntil(w, (ev) => ev.some((e) => e.type === "workStarted"))
  const { x, y } = w.movers.a.pos
  assert.ok(x >= 2 && x <= 4 && y >= 5 && y <= 6, "working inside the lab")
})

test("walking speed suits the map's 163 m cells", () => {
  const w = buildNavigation(flat(), { modules: [], tubes: [] })
  addPawn(w, "a", { x: 0, y: 0 }) // outside, in a suit
  assert.ok(issueOrder(w, "a", { kind: "move", target: { x: 10, y: 0 } }).ok)
  const hours = 10 / (scaleFor(w.grid).walkTilesPerHour * PATHING_TUNING.suitSpeedMultiplier) // ~0.68 h
  assert.ok(!stepPathing(w, hours - 0.001).some((e) => e.type === "arrived"))
  assert.ok(stepPathing(w, 0.002).some((e) => e.type === "arrived"))
})

test("cliffs can't be walked; the route goes round them", () => {
  const terrain = flat()
  // A 300 m high ridge along row 8, from col 0 to col 19 (steeper than 25°); it ends at col 20.
  for (let col = 0; col < 20; col++) terrain.metres[8 * SIZE + col] = 300
  const w = buildNavigation(terrain, { modules: [], tubes: [] })
  addPawn(w, "a", { x: 3, y: 4 })
  assert.ok(issueOrder(w, "a", { kind: "move", target: { x: 3, y: 18 } }).ok)
  assert.ok(w.movers.a.path.some((t) => t.x >= 20), "goes round the end of the ridge")
  assert.ok(!w.movers.a.path.some((t) => t.y === 8 && t.x < 20), "never climbs the ridge")
})

test("walking up a gentle slope takes longer than on the flat", () => {
  const time = (rise: number) => {
    const terrain = flat()
    for (let col = 0; col < SIZE; col++) for (let row = 0; row < 3; row++) terrain.metres[row * SIZE + col] = col * rise
    const w = buildNavigation(terrain, { modules: [], tubes: [] })
    addPawn(w, "a", { x: 0, y: 0 })
    assert.ok(issueOrder(w, "a", { kind: "move", target: { x: 8, y: 0 } }).ok)
    let hours = 0
    for (;;) {
      hours += 0.001
      if (stepPathing(w, 0.001).some((e) => e.type === "arrived")) return hours
    }
  }
  const flatTime = time(0)
  const uphill = time(30) // 30 m up per 163 m cell: a 10° slope
  assert.ok(uphill > flatTime * 1.5, `uphill ${uphill.toFixed(3)} h vs flat ${flatTime.toFixed(3)} h`)
})

test("building a module across a route outside makes the walker go round it", () => {
  const w = buildNavigation(flat(), { modules: [], tubes: [] })
  addPawn(w, "a", { x: 0, y: 6 })
  assert.ok(issueOrder(w, "a", { kind: "move", target: { x: 8, y: 6 } }).ok)
  stepPathing(w, 0.01)
  const base: Base = { modules: [mod("st", "storage", 4, 5)], tubes: [] } // storage on cells (4-5, 5-6)
  syncNavigation(w, flat(), base)
  const steps: { x: number; y: number }[] = []
  runUntil(w, (ev) => {
    steps.push({ ...w.movers.a.pos })
    return arrivedEvent(ev)
  })
  assert.ok(steps.every((p) => at(w, Math.round(p.x), Math.round(p.y)) === "outside"), "never walked into the module")
  assert.equal(w.movers.a.exposure, "outside")
})

test("rebuilding keeps unchanged modules' stations; removing a module stops work there", () => {
  const w = buildNavigation(flat(), smallBase())
  const lab = w.stations.find((s) => s.id === moduleStationId("lab"))
  addPawn(w, "a", { x: 3, y: 3 })
  assert.ok(issueOrder(w, "a", { kind: "work", stationId: moduleStationId("lab") }).ok)
  runUntil(w, (ev) => ev.some((e) => e.type === "workStarted"))
  const withTube: Base = { ...smallBase(), tubes: [...smallBase().tubes, { col: 1, row: 10 }] }
  syncNavigation(w, flat(), withTube)
  assert.equal(w.stations.find((s) => s.id === moduleStationId("lab")), lab, "same station object kept")
  assert.equal(w.movers.a.status, "working")
  const noLab: Base = { ...withTube, modules: withTube.modules.filter((m) => m.id !== "lab") }
  syncNavigation(w, flat(), noLab)
  const ev = stepPathing(w, 0.01)
  assert.ok(ev.some((e) => e.type === "cancelled"))
})
