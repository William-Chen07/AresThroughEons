/**
 * Tests for crew movement on the real base map (src/sim/navigation.ts): Brandon's base (modules,
 * tubes, the lander) and the terrain turned into a walkable map. Run from the game/ folder:
 *
 *   node --experimental-strip-types --import ./tests/pathing/register.mjs --test tests/pathing/navigation.test.ts
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { checkModule, checkTubes, connectedGroups, occupancy, tubeOpenings, type Base, type PlacedModule } from "@/sim/base"
import { buildNavigation, moduleStationId, pressurizedCells, syncNavigation, type NavigationTerrain } from "@/sim/navigation"
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

test("the base becomes a walkable map: modules and tubes inside, open ground, lander blocked", () => {
  const w = buildNavigation(flat(), smallBase())
  assert.equal(w.grid.metersPerTile, METERS_PER_CELL)
  assert.equal(w.grid.airlocksRequired, false)
  assert.equal(at(w, 3, 3), "inside", "habitat")
  assert.equal(at(w, 3, 6), "inside", "lab")
  assert.equal(at(w, 5, 3), "inside", "tube")
  assert.equal(at(w, 7, 3), "inside", "airlock module")
  assert.equal(at(w, 15, 15), "outside", "open ground")
  assert.equal(getCost(w.grid, 12, 12), BLOCKED, "the lander")
  assert.deepEqual(w.stations.map((s) => s.id).sort(), ["module:air", "module:hab", "module:lab"])
  assert.ok(w.stations.every((s) => s.walkIn))
})

for (const withAirlock of [true, false]) {
  test(`crew walk out of the habitat and back in, ${withAirlock ? "with" : "without"} an airlock`, () => {
    const w = buildNavigation(flat(), smallBase(withAirlock))
    addPawn(w, "a", { x: 3, y: 3 })
    assert.ok(issueOrder(w, "a", { kind: "move", target: { x: 16, y: 3 } }).ok)
    const events = runUntil(w, arrivedEvent)
    assert.ok(events.some((e) => e.type === "exposureChanged" && e.exposure === "outside"))
    assert.equal(w.movers.a.exposure, "outside")
    assert.ok(issueOrder(w, "a", { kind: "move", target: { x: 3, y: 3 } }).ok)
    runUntil(w, arrivedEvent)
    assert.equal(w.movers.a.exposure, "inside")
  })
}

test("modules joined to an airlock are pressurized and provide oxygen; others don't", () => {
  // The habitat and lab join the airlock through the tube; the storage stands on its own.
  const base: Base = { ...smallBase(), modules: [...smallBase().modules, mod("st", "storage", 14, 2)] }
  const cells = pressurizedCells(SIZE, base)
  for (const [col, row] of [[3, 3], [3, 6], [5, 3], [7, 3], [8, 3]]) assert.ok(cells.has(row * SIZE + col), `${col},${row}`)
  assert.ok(!cells.has(2 * SIZE + 14), "storage")
  assert.ok(!cells.has(10 * SIZE + 10), "open ground")
  const w = buildNavigation(flat(), base)
  const provides = (id: string) => w.stations.find((s) => s.id === moduleStationId(id))!.provides
  assert.deepEqual(provides("hab"), ["oxygen"])
  assert.deepEqual(provides("lab"), ["oxygen"])
  assert.deepEqual(provides("st"), [])
  syncNavigation(w, flat(), { ...base, modules: base.modules.filter((m) => m.id !== "air") })
  assert.deepEqual(provides("hab"), [], "no airlock any more")
})

test("low on oxygen, a crewmate heads for a pressurized module", () => {
  // Storage on its own at (14-15, 8-9) is closer, but only the airlock-joined modules are pressurized.
  const base: Base = { ...smallBase(), modules: [...smallBase().modules, mod("st", "storage", 14, 8)] }
  const w = buildNavigation(flat(), base)
  addPawn(w, "a", { x: 16, y: 10 })
  const all: PathingEvent[] = []
  for (let i = 0; i < 20000 && !all.some((e) => e.type === "workStarted"); i++) {
    all.push(...stepPathing(w, 0.01, { urgentNeed: () => "oxygen" }))
  }
  const interrupt = all.find((e) => e.type === "needInterrupt")
  assert.ok(interrupt && interrupt.type === "needInterrupt" && interrupt.need === "oxygen")
  assert.ok(["module:hab", "module:lab", "module:air"].includes(interrupt.stationId!), String(interrupt.stationId))
  assert.equal(w.movers.a.exposure, "inside")
})

test("with no airlock, low oxygen has nowhere to go and says so", () => {
  const w = buildNavigation(flat(), smallBase(false))
  addPawn(w, "a", { x: 16, y: 10 })
  const ev = stepPathing(w, 0.01, { urgentNeed: () => "oxygen" })
  assert.ok(ev.some((e) => e.type === "needUnmet" && e.need === "oxygen"))
  // Building an airlock gives them somewhere to go.
  syncNavigation(w, flat(), smallBase(true))
  const next = stepPathing(w, 0.01, { urgentNeed: () => "oxygen" })
  assert.ok(next.some((e) => e.type === "needInterrupt" && e.need === "oxygen"))
})

test("a module built on top of a crewmate nudges them out onto open ground", () => {
  const w = buildNavigation(flat(), { modules: [], tubes: [] })
  addPawn(w, "a", { x: 3, y: 3 })
  syncNavigation(w, flat(), { modules: [mod("hab", "habitat", 2, 2)], tubes: [] })
  const { x, y } = w.movers.a.pos
  assert.equal(at(w, x, y), "outside")
  assert.equal(w.movers.a.exposure, "outside")
  assert.ok(Math.abs(x - 3) <= 2 && Math.abs(y - 3) <= 2, "just beside the habitat")
  assert.ok(issueOrder(w, "a", { kind: "move", target: { x: 10, y: 3 } }).ok, "can still be sent places")
  // So is a tube laid on top of them (a tube has no door to get out by).
  addPawn(w, "b", { x: 10, y: 10 })
  syncNavigation(w, flat(), { modules: [mod("hab", "habitat", 2, 2)], tubes: [{ col: 10, row: 10 }] })
  assert.equal(at(w, w.movers.b.pos.x, w.movers.b.pos.y), "outside")
})

test("crew go in and out of a module only through its doorways, one in the middle of each side", () => {
  // Habitat at cols 2-4, rows 2-4. Doorways: north (3,2)↔(3,1), east (4,3)↔(5,3),
  // south (3,4)↔(3,5), west (2,3)↔(1,3).
  const doorways = [
    [{ x: 3, y: 1 }, { x: 3, y: 2 }],
    [{ x: 5, y: 3 }, { x: 4, y: 3 }],
    [{ x: 3, y: 5 }, { x: 3, y: 4 }],
    [{ x: 1, y: 3 }, { x: 2, y: 3 }],
  ]
  for (const [start, door] of [
    [{ x: 3, y: 0 }, doorways[0]],
    [{ x: 8, y: 3 }, doorways[1]],
    [{ x: 3, y: 8 }, doorways[2]],
    [{ x: 0, y: 3 }, doorways[3]],
  ] as const) {
    const w = buildNavigation(flat(), { modules: [mod("hab", "habitat", 2, 2)], tubes: [] })
    addPawn(w, "a", start)
    assert.ok(issueOrder(w, "a", { kind: "move", target: { x: 3, y: 3 } }).ok)
    const path = [start, ...w.movers.a.path]
    for (let i = 1; i < path.length; i++) {
      const [p, q] = [path[i - 1], path[i]]
      if (at(w, p.x, p.y) !== at(w, q.x, q.y)) assert.deepEqual([p, q], door, "in by the nearest doorway")
    }
    runUntil(w, arrivedEvent)
    assert.equal(w.movers.a.exposure, "inside")
  }
})

test("with a tube on one doorway, crew still get in and out by the others", () => {
  // A tube runs south from the habitat's south doorway (3,5) to (3,8), joined to nothing else.
  const tubes = [5, 6, 7, 8].map((row) => ({ col: 3, row }))
  const w = buildNavigation(flat(), { modules: [mod("hab", "habitat", 2, 2)], tubes })
  addPawn(w, "a", { x: 3, y: 3 })
  assert.ok(issueOrder(w, "a", { kind: "move", target: { x: 10, y: 3 } }).ok, "out by the east doorway")
  runUntil(w, arrivedEvent)
  assert.equal(w.movers.a.exposure, "outside")
  // The tube is part of the habitat, reached from inside.
  assert.ok(issueOrder(w, "a", { kind: "move", target: { x: 3, y: 8 } }).ok, "to the end of the tube")
  const path = w.movers.a.path
  const intoTube = path.findIndex((t) => t.x === 3 && t.y === 5)
  assert.deepEqual(path[intoTube - 1], { x: 3, y: 4 }, "into the tube from the habitat's south doorway")
})

test("tubes are hallways: walking between joined modules stays inside", () => {
  // Habitat (cols 2-4, rows 2-4), a tube along row 3 from its east doorway (5,3) to (9,3), the
  // storage's west doorway (storage at cols 10-11, rows 2-3).
  const tubes = [5, 6, 7, 8, 9].map((col) => ({ col, row: 3 }))
  const w = buildNavigation(flat(), { modules: [mod("hab", "habitat", 2, 2), mod("st", "storage", 10, 2)], tubes })
  addPawn(w, "a", { x: 3, y: 2 })
  assert.ok(issueOrder(w, "a", { kind: "work", stationId: moduleStationId("st") }).ok)
  assert.ok(w.movers.a.path.every((t) => at(w, t.x, t.y) === "inside"), "never steps outside")
  assert.ok(w.movers.a.path.some((t) => t.x === 7 && t.y === 3), "walks along the tube")
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

test("modules can only be placed on level ground, not across the edge of a step", () => {
  const levels = new Uint8Array(SIZE * SIZE)
  for (let row = 0; row < SIZE; row++) for (let col = 10; col < SIZE; col++) levels[row * SIZE + col] = 2 // a step up at col 10
  const empty = occupancy(SIZE, { modules: [], tubes: [] })
  assert.ok(checkModule(SIZE, empty, "habitat", { col: 2, row: 2 }, "a", levels).ok, "flat low ground")
  assert.ok(checkModule(SIZE, empty, "habitat", { col: 12, row: 2 }, "b", levels).ok, "flat high ground")
  const across = checkModule(SIZE, empty, "habitat", { col: 8, row: 2 }, "c", levels)
  assert.ok(!across.ok && /level/.test(across.reason), "across the step")
})

test("tubes can only meet a module at a doorway, in the middle of a side", () => {
  // Habitat at cols 2-4, rows 2-4: doorways in front at (3,1), (5,3), (3,5) and (1,3).
  const base: Base = { modules: [mod("hab", "habitat", 2, 2)], tubes: [] }
  const grid = occupancy(SIZE, base)
  const lay = (cells: { col: number; row: number }[]) => checkTubes(SIZE, grid, cells, base.modules)
  assert.ok(lay([{ col: 5, row: 3 }, { col: 6, row: 3 }, { col: 7, row: 3 }]).ok, "out from the east doorway")
  assert.ok(lay([{ col: 3, row: 1 }, { col: 3, row: 0 }]).ok, "out from the north doorway")
  const alongWall = lay([{ col: 5, row: 2 }, { col: 5, row: 3 }, { col: 5, row: 4 }])
  assert.ok(!alongWall.ok && /doorway/.test(alongWall.reason), "not along the east wall")
  assert.equal(lay([{ col: 4, row: 5 }]).ok, false, "not against the south wall beside the doorway")
  assert.ok(lay([{ col: 5, row: 5 }]).ok, "a corner doesn't touch a wall")

  // A module can't be put down with a tube against its wall off a doorway either. A storage at
  // cols 9-10, rows 3-4 has its west doorway at row 4, so a tube at (8,4) fits and (8,3) doesn't.
  const tubeAt = (row: number) => occupancy(SIZE, { modules: [], tubes: [{ col: 8, row }] })
  assert.ok(checkModule(SIZE, tubeAt(4), "storage", { col: 9, row: 3 }).ok, "tube at its west doorway")
  const offDoorway = checkModule(SIZE, tubeAt(3), "storage", { col: 9, row: 3 })
  assert.ok(!offDoorway.ok && /doorway/.test(offDoorway.reason), "tube against its wall off the doorway")
})

test("a tube in front of a doorway opens into that module", () => {
  // Storage at cols 9-10, rows 2-3: west doorway (9,3) with (8,3) in front.
  const base: Base = { modules: [mod("st", "storage", 9, 2)], tubes: [{ col: 8, row: 3 }, { col: 7, row: 3 }] }
  const grid = occupancy(SIZE, base)
  const i = (col: number, row: number) => row * SIZE + col
  assert.deepEqual(tubeOpenings(SIZE, base, grid, i(8, 3)), [i(9, 3)])
  assert.deepEqual(tubeOpenings(SIZE, base, grid, i(7, 3)), [], "further along the tube")
})

test("a single block of tube between two modules joins them both", () => {
  // Habitat at cols 2-4, storage at cols 6-7 (rows 2-3), one block of tube at (5,3) between them.
  const base: Base = { modules: [mod("hab", "habitat", 2, 2), mod("st", "storage", 6, 2)], tubes: [{ col: 5, row: 3 }] }
  const grid = occupancy(SIZE, base)
  assert.equal(connectedGroups(SIZE, base, grid).length, 1)
  const w = buildNavigation(flat(), base)
  addPawn(w, "a", { x: 3, y: 3 })
  assert.ok(issueOrder(w, "a", { kind: "move", target: { x: 7, y: 3 } }).ok)
  assert.ok(w.movers.a.path.every((t) => at(w, t.x, t.y) === "inside"), "walks through the tube, staying inside")
})
