/**
 * Tests for the pawn pathing system (src/sim/pathing). Uses Node's built-in test runner, so it
 * needs nothing installed. Run from the game/ folder:
 *
 *   node --experimental-strip-types --import ./tests/pathing/register.mjs --test tests/pathing/pathing.test.ts
 *
 * register.mjs lets Node follow the repo's extensionless imports. Once vitest is in the project,
 * swap the two node:test / node:assert imports for vitest's and drop the loader.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  BLOCKED, addPawn, addStation, createStation, createWorld, findPath, handleClick, issueOrder,
  removeStation, setCost, stepPathing, costField, WALK_TILES_PER_HOUR, buildHabitat, getZone, setZone,
  PATHING_TUNING, cancelOrder, selectInBox, orderGroup, tileOf, scaleFor,
  type World, type Tile, type PathingEvent, type UrgentNeed,
} from "../../src/sim/pathing/index.ts"

const wall = (w: World, tiles: Tile[]) => tiles.forEach((t) => setCost(w.grid, t, BLOCKED))
const lookup = (w: World) => { const f = costField(w); return (x: number, y: number) => (x < 0 || y < 0 || x >= w.grid.width || y >= w.grid.height ? 0 : f[y * w.grid.width + x]) }
/** Run steps until a predicate holds or a limit is hit; returns all events. */
function runUntil(w: World, done: (events: ReturnType<typeof stepPathing>) => boolean, dt = 0.001, max = 5000) {
  const all = []
  for (let i = 0; i < max; i++) { const ev = stepPathing(w, dt); all.push(...ev); if (done(ev)) return all }
  throw new Error("did not finish")
}

test("goes around a wall", () => {
  const w = createWorld(10, 10)
  wall(w, [3, 4, 5, 6, 7].map((y) => ({ x: 5, y }))) // vertical wall x=5, y 3..7
  const path = findPath(lookup(w), 10, 10, { x: 2, y: 5 }, [{ x: 8, y: 5 }])!
  assert.ok(path, "path exists")
  assert.ok(path.every((t) => !(t.x === 5 && t.y >= 3 && t.y <= 7)), "never steps on the wall")
  assert.deepEqual(path.at(-1), { x: 8, y: 5 })
})

test("never cuts a diagonal past a wall corner", () => {
  const w = createWorld(3, 3)
  wall(w, [{ x: 1, y: 0 }]) // block the tile beside the diagonal (0,0)->(1,1)
  const path = findPath(lookup(w), 3, 3, { x: 0, y: 0 }, [{ x: 1, y: 1 }])!
  assert.deepEqual(path, [{ x: 0, y: 1 }, { x: 1, y: 1 }], "goes around instead of slipping through the corner")
})

test("sealed room has no path", () => {
  const w = createWorld(7, 7)
  wall(w, [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }, { x: 2, y: 3 }, { x: 4, y: 3 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }])
  assert.equal(findPath(lookup(w), 7, 7, { x: 0, y: 0 }, [{ x: 3, y: 3 }]), null)
})

test("multi-goal picks the nearest reachable goal", () => {
  const w = createWorld(10, 1)
  const path = findPath(lookup(w), 10, 1, { x: 0, y: 0 }, [{ x: 9, y: 0 }, { x: 3, y: 0 }])!
  assert.deepEqual(path.at(-1), { x: 3, y: 0 })
})

test("expensive terrain is avoided when a cheaper detour exists", () => {
  const w = createWorld(5, 3)
  for (let x = 1; x <= 3; x++) setCost(w.grid, { x, y: 1 }, 10) // a sand strip on the straight line
  const path = findPath(lookup(w), 5, 3, { x: 0, y: 1 }, [{ x: 4, y: 1 }])!
  assert.ok(path.every((t) => t.y !== 1 || t.x === 4), "detours off the sand")
})

test("click astronaut, click station: walks there, works, finishes", () => {
  const w = createWorld(12, 12)
  addPawn(w, "ana", { x: 1, y: 1 })
  addStation(w, createStation(w.grid, { id: "drill", kind: "iceDrill", x: 8, y: 8, width: 2, height: 2, workRequired: 3 }))
  assert.deepEqual(handleClick(w, { x: 1, y: 1 }), { kind: "selected", pawnIds: ["ana"] })
  const click = handleClick(w, { x: 9, y: 9 }) // click inside the station's footprint
  assert.equal(click.kind, "ordered")
  assert.equal(w.movers.ana.status, "moving")
  const events = runUntil(w, (ev) => ev.some((e) => e.type === "workDone"), 0.0005, 100000)
  const types = events.map((e) => e.type)
  assert.deepEqual(types, ["arrived", "workStarted", "workDone"])
  const stoodOn = events[0].type === "arrived" ? events[0].tile : null
  assert.ok(w.stations[0].accessTiles.some((t) => t.x === stoodOn!.x && t.y === stoodOn!.y), "worked from an access tile")
  assert.equal(w.movers.ana.status, "idle")
  assert.ok(w.stations[0].job!.workDone >= 3)
})

test("move order: walk to a tile, at the expected speed (indoors, no suit)", () => {
  const w = createWorld(20, 1)
  for (let x = 0; x < 20; x++) setZone(w.grid, { x, y: 0 }, "inside")
  addPawn(w, "ben", { x: 0, y: 0 })
  assert.ok(issueOrder(w, "ben", { kind: "move", target: { x: 10, y: 0 } }).ok)
  stepPathing(w, 5 / WALK_TILES_PER_HOUR) // exactly 5 tiles of walking time
  assert.ok(Math.abs(w.movers.ben.pos.x - 5) < 1e-9, `half way, got ${w.movers.ben.pos.x}`)
  const ev = stepPathing(w, 5 / WALK_TILES_PER_HOUR + 1e-9)
  assert.deepEqual(ev, [{ type: "arrived", pawnId: "ben", tile: { x: 10, y: 0 } }])
})

test("crew spread out over a station's free access tiles", () => {
  const w = createWorld(10, 10)
  addPawn(w, "a", { x: 0, y: 5 }); addPawn(w, "b", { x: 0, y: 5 })
  addStation(w, createStation(w.grid, { id: "gh", kind: "greenhouse", x: 5, y: 5 }))
  const ra = issueOrder(w, "a", { kind: "work", stationId: "gh" })
  const rb = issueOrder(w, "b", { kind: "work", stationId: "gh" })
  assert.ok(ra.ok && rb.ok)
  assert.notDeepEqual(ra.destination, rb.destination, "two pawns pick different spots")
})

test("route blocked mid-walk: re-plans around it", () => {
  const w = createWorld(10, 5)
  addPawn(w, "c", { x: 0, y: 2 })
  assert.ok(issueOrder(w, "c", { kind: "move", target: { x: 9, y: 2 } }).ok)
  stepPathing(w, 2 / WALK_TILES_PER_HOUR)
  addStation(w, createStation(w.grid, { id: "new", kind: "module", x: 5, y: 1, height: 3 })) // wall across the middle
  const events = runUntil(w, (ev) => ev.length > 0)
  assert.deepEqual(events.map((e) => e.type), ["arrived"])
  assert.deepEqual(w.movers.c.pos, { x: 9, y: 2 })
})

test("all routes blocked: 'blocked' event and the order is dropped", () => {
  const w = createWorld(10, 3)
  addPawn(w, "d", { x: 0, y: 1 })
  assert.ok(issueOrder(w, "d", { kind: "move", target: { x: 9, y: 1 } }).ok)
  stepPathing(w, 1 / WALK_TILES_PER_HOUR)
  addStation(w, createStation(w.grid, { id: "dam", kind: "module", x: 5, y: 0, height: 3 })) // seals the corridor
  const events = runUntil(w, (ev) => ev.length > 0)
  assert.equal(events[0].type, "blocked")
  assert.equal(w.movers.d.status, "idle")
  assert.equal(w.movers.d.order, null)
})

test("station removed while working: 'cancelled' event", () => {
  const w = createWorld(6, 6)
  addPawn(w, "e", { x: 2, y: 1 })
  addStation(w, createStation(w.grid, { id: "s", kind: "iceDrill", x: 2, y: 2 }))
  assert.ok(issueOrder(w, "e", { kind: "work", stationId: "s" }).ok)
  stepPathing(w, 0.01) // already beside it: arrives and starts
  assert.equal(w.movers.e.status, "working")
  removeStation(w, "s")
  assert.deepEqual(stepPathing(w, 0.01).map((e) => e.type), ["cancelled"])
})

test("unreachable or invalid orders fail with a reason and keep the old order", () => {
  const w = createWorld(6, 6)
  addPawn(w, "f", { x: 0, y: 0 })
  setCost(w.grid, { x: 5, y: 5 }, BLOCKED)
  assert.ok(issueOrder(w, "f", { kind: "move", target: { x: 3, y: 0 } }).ok)
  const r = issueOrder(w, "f", { kind: "move", target: { x: 5, y: 5 } })
  assert.equal(r.ok, false)
  assert.deepEqual(w.movers.f.order, { kind: "move", target: { x: 3, y: 0 } }, "kept the old order")
  assert.equal(handleClick(w, { x: 2, y: 2 }).kind, "nothing", "nobody selected")
})

test("world survives a JSON round trip and keeps working", () => {
  const w = createWorld(10, 10)
  setCost(w.grid, { x: 4, y: 4 }, BLOCKED)
  addPawn(w, "g", { x: 0, y: 0 })
  addStation(w, createStation(w.grid, { id: "x", kind: "lab", x: 7, y: 7, workRequired: 1 }))
  issueOrder(w, "g", { kind: "work", stationId: "x" })
  stepPathing(w, 0.001)
  const copy: World = JSON.parse(JSON.stringify(w))
  assert.equal(copy.grid.cost[4 * 10 + 4], BLOCKED)
  const events = runUntil(copy, (ev) => ev.some((e) => e.type === "workDone"), 0.001, 100000)
  assert.ok(events.some((e) => e.type === "workDone"))
})

test("A* is fast on a 64x64 map", () => {
  const w = createWorld(64, 64)
  for (let y = 0; y < 60; y++) setCost(w.grid, { x: 32, y }, BLOCKED) // long wall forces a detour
  const costAt = lookup(w)
  const t0 = performance.now()
  for (let i = 0; i < 20; i++) assert.ok(findPath(costAt, 64, 64, { x: 0, y: 0 }, [{ x: 63, y: 0 }]))
  const ms = (performance.now() - t0) / 20
  console.log(`    64x64 detour path: ${ms.toFixed(2)} ms average`)
  assert.ok(ms < 10, `took ${ms} ms`)
})

// --- Inside, outside and airlocks ---

/** A 5×5 habitat (walls at x/y 0 and 4, floor 1..3) with one airlock in the east wall at (4, 2). */
function habitatWorld() {
  const w = createWorld(12, 7)
  buildHabitat(w.grid, { x: 0, y: 0, width: 5, height: 5, airlocks: [{ x: 4, y: 2 }] })
  return w
}
const types = (events: PathingEvent[]) => events.map((e) => (e.type === "exposureChanged" ? `${e.type}:${e.exposure}` : e.type))

test("going outside passes the airlock, cycles, and starts EVA", () => {
  const w = habitatWorld()
  addPawn(w, "h", { x: 2, y: 2 })
  assert.equal(w.movers.h.exposure, "inside")
  assert.ok(issueOrder(w, "h", { kind: "move", target: { x: 8, y: 2 } }).ok)
  assert.ok(w.movers.h.path.some((t) => getZone(w.grid, t.x, t.y) === "airlock"), "route uses the airlock")
  const events = runUntil(w, (ev) => ev.some((e) => e.type === "arrived"))
  assert.deepEqual(types(events), ["airlockCycling", "exposureChanged:outside", "arrived"])
  assert.equal(w.movers.h.exposure, "outside")

  // ...and back in again.
  assert.ok(issueOrder(w, "h", { kind: "move", target: { x: 1, y: 1 } }).ok)
  const back = runUntil(w, (ev) => ev.some((e) => e.type === "arrived"))
  assert.deepEqual(types(back), ["airlockCycling", "exposureChanged:inside", "arrived"])
})

test("airlock cycle adds its time, and the suit slows walking outside", () => {
  // (2,2) → (3,2) inside → (4,2) airlock → cycle → (5,2) (6,2) (7,2) outside in a suit.
  const S = WALK_TILES_PER_HOUR
  const expected = 2 / S + PATHING_TUNING.airlockCycleHours + 3 / (S * PATHING_TUNING.suitSpeedMultiplier)
  const w = habitatWorld()
  addPawn(w, "i", { x: 2, y: 2 })
  assert.ok(issueOrder(w, "i", { kind: "move", target: { x: 7, y: 2 } }).ok)
  const early = stepPathing(w, expected - 1e-6)
  assert.ok(!early.some((e) => e.type === "arrived"), "not there before the expected time")
  const late = stepPathing(w, 2e-6)
  assert.ok(late.some((e) => e.type === "arrived"), "there right after the expected time")
})

test("inside and outside never connect without an airlock", () => {
  const w = createWorld(6, 1)
  for (let x = 0; x < 3; x++) setZone(w.grid, { x, y: 0 }, "inside") // inside touches outside, no wall
  addPawn(w, "j", { x: 0, y: 0 })
  const r = issueOrder(w, "j", { kind: "move", target: { x: 5, y: 0 } })
  assert.equal(r.ok, false, "can't step straight from inside to outside")
  setZone(w.grid, { x: 3, y: 0 }, "airlock")
  assert.ok(issueOrder(w, "j", { kind: "move", target: { x: 5, y: 0 } }).ok, "fine once there's an airlock between")
})

test("a habitat with no airlock is sealed", () => {
  const w = createWorld(10, 7)
  buildHabitat(w.grid, { x: 0, y: 0, width: 5, height: 5, airlocks: [] })
  addPawn(w, "k", { x: 2, y: 2 })
  assert.equal(issueOrder(w, "k", { kind: "move", target: { x: 8, y: 2 } }).ok, false)
})

test("walks around inside rather than going out and back in", () => {
  // A long habitat with an inner wall at x = 12, open only at the top (y = 1), and an airlock
  // on each side of that wall at the bottom. Going out and back in is only 5 tiles of walking,
  // the indoor route about 7 — but two airlock cycles cost far more than that.
  const w = createWorld(24, 10)
  buildHabitat(w.grid, { x: 0, y: 0, width: 24, height: 6, airlocks: [{ x: 10, y: 5 }, { x: 13, y: 5 }] })
  for (let y = 2; y <= 4; y++) setCost(w.grid, { x: 12, y }, BLOCKED)
  addPawn(w, "l", { x: 10, y: 4 })
  assert.ok(issueOrder(w, "l", { kind: "move", target: { x: 13, y: 4 } }).ok)
  assert.ok(w.movers.l.path.every((t) => getZone(w.grid, t.x, t.y) !== "airlock"), "stays inside")
})

test("stopping in an airlock and walking out later still cycles it", () => {
  const w = habitatWorld()
  addPawn(w, "m", { x: 2, y: 2 })
  assert.ok(issueOrder(w, "m", { kind: "move", target: { x: 4, y: 2 } }).ok) // stand in the airlock
  const first = runUntil(w, (ev) => ev.some((e) => e.type === "arrived"))
  assert.deepEqual(types(first), ["arrived"], "standing in it doesn't cycle")
  assert.equal(w.movers.m.exposure, "inside")
  assert.ok(issueOrder(w, "m", { kind: "move", target: { x: 7, y: 2 } }).ok)
  const out = runUntil(w, (ev) => ev.some((e) => e.type === "arrived"))
  assert.deepEqual(types(out), ["airlockCycling", "exposureChanged:outside", "arrived"])
})

test("buildHabitat rejects an airlock in a corner or away from the wall", () => {
  const w = createWorld(10, 10)
  assert.throws(() => buildHabitat(w.grid, { x: 0, y: 0, width: 5, height: 5, airlocks: [{ x: 4, y: 4 }] }))
  assert.throws(() => buildHabitat(w.grid, { x: 0, y: 0, width: 5, height: 5, airlocks: [{ x: 2, y: 2 }] }))
  assert.throws(() => buildHabitat(w.grid, { x: 0, y: 0, width: 5, height: 5, airlocks: [{ x: 4, y: 8 }] }))
})

// --- Urgent needs interrupting orders ---

/**
 * A base: habitat (x 0..9, y 0..6) with an airlock in the east wall at (9, 3), an oxygen tank
 * inside at (2, 2), and an ice drill outside at (15, 3). One pawn, "ox", starts inside.
 */
function baseWorld() {
  const w = createWorld(20, 8)
  buildHabitat(w.grid, { x: 0, y: 0, width: 10, height: 7, airlocks: [{ x: 9, y: 3 }] })
  addStation(w, createStation(w.grid, { id: "tank", kind: "oxygenTank", x: 2, y: 2, provides: ["oxygen"] }))
  addStation(w, createStation(w.grid, { id: "drill", kind: "iceDrill", x: 15, y: 3 }))
  addPawn(w, "ox", { x: 5, y: 3 })
  return w
}
/** Steps with a fixed urgent need until `done`, collecting events. */
function runNeeds(w: World, need: () => UrgentNeed | null, done: (ev: PathingEvent[]) => boolean, max = 20000) {
  const all: PathingEvent[] = []
  for (let i = 0; i < max; i++) {
    const ev = stepPathing(w, 0.001, { urgentNeed: () => need() })
    all.push(...ev)
    if (done(ev)) return all
  }
  throw new Error("did not finish")
}
const has = (type: PathingEvent["type"]) => (ev: PathingEvent[]) => ev.some((e) => e.type === type)
/** Steps a fixed number of times with a fixed urgent need. */
function runFor(w: World, need: UrgentNeed | null, steps: number) {
  for (let i = 0; i < steps; i++) stepPathing(w, 0.001, { urgentNeed: () => need })
}

test("low oxygen: drops the job outside, refills inside, then goes back to the job", () => {
  const w = baseWorld()
  assert.ok(issueOrder(w, "ox", { kind: "work", stationId: "drill" }).ok)
  runNeeds(w, () => null, has("workStarted")) // out at the drill
  assert.equal(w.movers.ox.exposure, "outside")

  let lowOxygen = true
  const toTank = runNeeds(w, () => (lowOxygen ? "oxygen" : null), has("workStarted"))
  assert.deepEqual(toTank[0], { type: "needInterrupt", pawnId: "ox", need: "oxygen", stationId: "tank" })
  assert.equal(w.movers.ox.exposure, "inside", "came back in through the airlock")
  assert.deepEqual(w.movers.ox.order, { kind: "work", stationId: "tank" })

  // Stays at the tank while the need is still reported...
  runFor(w, "oxygen", 50)
  assert.equal(w.movers.ox.status, "working")
  // ...and resumes the drill job once it isn't.
  lowOxygen = false
  const back = runNeeds(w, () => (lowOxygen ? "oxygen" : null), has("workStarted"))
  assert.deepEqual(back[0], { type: "needMet", pawnId: "ox", need: "oxygen", resumed: true })
  assert.deepEqual(w.movers.ox.order, { kind: "work", stationId: "drill" })
  assert.equal(w.movers.ox.interrupt, null)
})

test("solar flare: a pawn outside shelters indoors, then resumes", () => {
  const w = baseWorld()
  assert.ok(issueOrder(w, "ox", { kind: "work", stationId: "drill" }).ok)
  runNeeds(w, () => null, has("workStarted"))
  let flare = true
  const shelter = runNeeds(w, () => (flare ? "shelter" : null), (ev) => ev.some((e) => e.type === "arrived"))
  assert.deepEqual(shelter[0], { type: "needInterrupt", pawnId: "ox", need: "shelter", stationId: null })
  assert.equal(w.movers.ox.exposure, "inside")
  runFor(w, "shelter", 100) // stays put during the flare
  assert.equal(w.movers.ox.exposure, "inside")
  assert.equal(w.movers.ox.path.length, 0)
  flare = false
  const after = runNeeds(w, () => (flare ? "shelter" : null), has("workStarted"))
  assert.deepEqual(after[0], { type: "needMet", pawnId: "ox", need: "shelter", resumed: true })
})

test("solar flare: a pawn busy inside carries on; one about to go out is stopped", () => {
  const w = baseWorld()
  addPawn(w, "in", { x: 6, y: 5 })
  assert.ok(issueOrder(w, "in", { kind: "move", target: { x: 1, y: 5 } }).ok) // an indoor errand
  assert.ok(issueOrder(w, "ox", { kind: "work", stationId: "drill" }).ok) // heading outside
  const ev = stepPathing(w, 0.0005, { urgentNeed: () => "shelter" })
  assert.deepEqual(ev.filter((e) => e.type === "needInterrupt").map((e) => e.pawnId), ["ox"], "only the one going out")
  assert.deepEqual(w.movers.in.order, { kind: "move", target: { x: 1, y: 5 } })
  assert.ok(!w.movers.ox.path.some((t) => getZone(w.grid, t.x, t.y) === "outside"))
})

test("solar flare mid-airlock: the cycle out is called off", () => {
  const w = baseWorld()
  assert.ok(issueOrder(w, "ox", { kind: "move", target: { x: 13, y: 3 } }).ok)
  const events = runNeeds(w, () => null, has("airlockCycling"))
  assert.ok(events.length > 0)
  const flare = runNeeds(w, () => "shelter", (ev) => ev.some((e) => e.type === "arrived"))
  assert.ok(!flare.some((e) => e.type === "exposureChanged"), "never went outside")
  assert.equal(w.movers.ox.exposure, "inside")
  assert.equal(w.movers.ox.cyclingTo, null)
})

test("an order given during an interrupt waits until the need is met", () => {
  const w = baseWorld()
  let low = true
  runNeeds(w, () => (low ? "oxygen" : null), has("needInterrupt"))
  const r = issueOrder(w, "ox", { kind: "move", target: { x: 7, y: 5 } })
  assert.deepEqual(r, { ok: true, status: "deferred" })
  assert.deepEqual(w.movers.ox.order, { kind: "work", stationId: "tank" }, "still going for oxygen")
  runNeeds(w, () => (low ? "oxygen" : null), has("workStarted"))
  low = false
  const after = runNeeds(w, () => (low ? "oxygen" : null), has("arrived"))
  assert.deepEqual(after.at(-1), { type: "arrived", pawnId: "ox", tile: { x: 7, y: 5 } }, "then does the new order")
})

test("cancelling during an interrupt keeps fixing the need but drops the order to resume", () => {
  const w = baseWorld()
  assert.ok(issueOrder(w, "ox", { kind: "work", stationId: "drill" }).ok)
  let low = true
  runNeeds(w, () => (low ? "oxygen" : null), has("workStarted"))
  cancelOrder(w, "ox")
  assert.deepEqual(w.movers.ox.order, { kind: "work", stationId: "tank" })
  low = false
  const after = runNeeds(w, () => (low ? "oxygen" : null), has("needMet"))
  assert.deepEqual(after.at(-1), { type: "needMet", pawnId: "ox", need: "oxygen", resumed: false })
  assert.equal(w.movers.ox.order, null)
})

test("a need nothing can fix is reported once, and the order carries on", () => {
  const w = baseWorld()
  assert.ok(issueOrder(w, "ox", { kind: "move", target: { x: 3, y: 5 } }).ok)
  const events = runNeeds(w, () => "food", has("arrived"))
  const unmet = events.filter((e) => e.type === "needUnmet")
  assert.equal(unmet.length, 1)
  assert.equal(w.movers.ox.interrupt, null)
})

test("if the station it was heading to is removed, it finds another one", () => {
  const w = baseWorld()
  addStation(w, createStation(w.grid, { id: "tank2", kind: "oxygenTank", x: 7, y: 5, provides: ["oxygen"] }))
  runNeeds(w, () => "oxygen", has("needInterrupt"))
  const first = w.movers.ox.order
  assert.deepEqual(first, { kind: "work", stationId: "tank2" }, "goes for the nearer tank")
  removeStation(w, "tank2")
  const events = runNeeds(w, () => "oxygen", has("workStarted"))
  assert.ok(events.some((e) => e.type === "cancelled"))
  assert.deepEqual(w.movers.ox.order, { kind: "work", stationId: "tank" }, "switched to the other tank")
})

// --- Idle: wandering and chatting ---

/** Runs `hours` of game time in small steps, collecting events. */
function runHours(w: World, hours: number, need: UrgentNeed | null = null, dt = 0.01) {
  const all: PathingEvent[] = []
  for (let t = 0; t < hours; t += dt) all.push(...stepPathing(w, dt, { urgentNeed: () => need }))
  return all
}

test("an idle pawn strolls around where it stopped, and stays on its side of the wall", () => {
  const w = createWorld(30, 20)
  buildHabitat(w.grid, { x: 0, y: 0, width: 14, height: 12, airlocks: [{ x: 13, y: 6 }] })
  addPawn(w, "w", { x: 9, y: 6 })
  const seen = new Set<string>()
  for (let i = 0; i < 1000; i++) {
    stepPathing(w, 0.01)
    const p = w.movers.w.pos
    seen.add(`${Math.round(p.x)},${Math.round(p.y)}`)
    const r = scaleFor(w.grid).wanderRadius
    assert.ok(Math.abs(p.x - 9) <= r + 0.01 && Math.abs(p.y - 6) <= r + 0.01, "near its spot")
    assert.equal(getZone(w.grid, Math.round(p.x), Math.round(p.y)), "inside", "never wanders into the airlock or outside")
  }
  assert.ok(seen.size > 3, `moved around (visited ${seen.size} tiles)`)
  assert.equal(w.movers.w.exposure, "inside")
})

test("two idle crewmates nearby meet up, chat, then cool down", () => {
  const w = createWorld(20, 20, 7)
  addPawn(w, "a", { x: 5, y: 5 })
  addPawn(w, "b", { x: 9, y: 5 })
  const events = runHours(w, 3)
  const started = events.filter((e) => e.type === "chatStarted")
  const ended = events.filter((e) => e.type === "chatEnded")
  assert.ok(started.length >= 1, "they chatted")
  assert.equal(ended[0]?.type === "chatEnded" && ended[0].interrupted, false)
  assert.ok(ended[0]?.type === "chatEnded" && Math.abs(ended[0].hours - PATHING_TUNING.chatHours) < 0.02, "chat lasted chatHours")
  // Cooldown: no two chats closer together than chatHours + cooldown.
  const startTimes: number[] = []
  let t = 0
  const w2 = createWorld(20, 20, 7)
  addPawn(w2, "a", { x: 5, y: 5 })
  addPawn(w2, "b", { x: 9, y: 5 })
  for (; t < 8; t += 0.01) if (stepPathing(w2, 0.01).some((e) => e.type === "chatStarted")) startTimes.push(t)
  for (let i = 1; i < startTimes.length; i++) {
    assert.ok(startTimes[i] - startTimes[i - 1] >= PATHING_TUNING.chatHours + PATHING_TUNING.chatCooldownHours - 0.02)
  }
})

test("while chatting they stand next to each other", () => {
  const w = createWorld(20, 20, 7)
  addPawn(w, "a", { x: 5, y: 5 })
  addPawn(w, "b", { x: 9, y: 5 })
  for (let i = 0; i < 2000; i++) {
    const ev = stepPathing(w, 0.01)
    if (ev.some((e) => e.type === "chatStarted")) break
  }
  const { a, b } = w.movers
  assert.equal(a.idle?.kind, "chat")
  assert.equal(b.idle?.kind, "chat")
  assert.ok(Math.max(Math.abs(a.pos.x - b.pos.x), Math.abs(a.pos.y - b.pos.y)) <= 1.01, "side by side")
})

test("crewmates on opposite sides of the habitat wall don't chat", () => {
  const w = createWorld(30, 14, 3)
  buildHabitat(w.grid, { x: 0, y: 0, width: 10, height: 10, airlocks: [{ x: 9, y: 5 }] })
  addPawn(w, "in", { x: 7, y: 5 })
  addPawn(w, "out", { x: 12, y: 5 })
  const events = runHours(w, 6)
  assert.ok(!events.some((e) => e.type === "chatStarted"))
  assert.equal(w.movers.in.exposure, "inside")
  assert.equal(w.movers.out.exposure, "outside")
})

test("an order cuts a chat short and frees the other crewmate", () => {
  const w = createWorld(20, 20, 7)
  addPawn(w, "a", { x: 5, y: 5 })
  addPawn(w, "b", { x: 9, y: 5 })
  for (let i = 0; i < 2000; i++) if (stepPathing(w, 0.01).some((e) => e.type === "chatStarted")) break
  assert.ok(issueOrder(w, "a", { kind: "move", target: { x: 15, y: 15 } }).ok)
  const ev = stepPathing(w, 0.01)
  const end = ev.find((e) => e.type === "chatEnded")
  assert.ok(end && end.type === "chatEnded" && end.interrupted, "reported as cut short")
  assert.equal(w.movers.a.idle, null)
  assert.equal(w.movers.b.idle?.kind, "pause", "the other goes back to idling")
  const arrived = runHours(w, 1).find((e) => e.type === "arrived")
  assert.deepEqual(arrived, { type: "arrived", pawnId: "a", tile: { x: 15, y: 15 } })
})

test("an idle pawn outside heads in when a solar flare starts", () => {
  const w = baseWorld()
  assert.ok(issueOrder(w, "ox", { kind: "move", target: { x: 14, y: 5 } }).ok)
  runNeeds(w, () => null, has("arrived"))
  runHours(w, 0.5) // idling outside
  assert.equal(w.movers.ox.exposure, "outside")
  const events = runHours(w, 1, "shelter")
  assert.ok(events.some((e) => e.type === "needInterrupt"))
  assert.equal(w.movers.ox.exposure, "inside")
})

test("idle behaviour is repeatable for the same seed", () => {
  const make = () => {
    const w = createWorld(20, 20, 42)
    addPawn(w, "a", { x: 5, y: 5 })
    addPawn(w, "b", { x: 12, y: 9 })
    runHours(w, 4)
    return JSON.stringify(w.movers)
  }
  assert.equal(make(), make())
})

test("a world saved mid-chat loads and finishes the chat", () => {
  const w = createWorld(20, 20, 7)
  addPawn(w, "a", { x: 5, y: 5 })
  addPawn(w, "b", { x: 9, y: 5 })
  for (let i = 0; i < 2000; i++) if (stepPathing(w, 0.01).some((e) => e.type === "chatStarted")) break
  const copy: World = JSON.parse(JSON.stringify(w))
  const events = runHours(copy, 1)
  assert.ok(events.some((e) => e.type === "chatEnded"))
})

// --- Crowds: stepping around each other ---

const tileKey = (p: { x: number; y: number }) => `${Math.round(p.x)},${Math.round(p.y)}`
/** Steps until `pawnId` arrives, failing if two given pawns are ever on the same tile. */
function walkApart(w: World, pawnId: string, apart: [string, string], max = 20000, opts = {}) {
  for (let i = 0; i < max; i++) {
    const ev = stepPathing(w, 0.0005, opts)
    const [a, b] = apart.map((id) => w.movers[id])
    assert.notEqual(tileKey(a.pos), tileKey(b.pos), `${apart[0]} and ${apart[1]} shared a tile`)
    if (ev.some((e) => e.type === "arrived" && e.pawnId === pawnId)) return
  }
  throw new Error("did not arrive")
}
/** A pawn standing at a station working (an ongoing job, so it stays put). */
function workerAt(w: World, id: string, station: { x: number; y: number }, stand: Tile) {
  addStation(w, createStation(w.grid, { id: `${id}-job`, kind: "drill", ...station }))
  addPawn(w, id, stand)
  assert.ok(issueOrder(w, id, { kind: "work", stationId: `${id}-job` }).ok)
  stepPathing(w, 0.001)
  assert.equal(w.movers[id].status, "working")
}

test("walks round a crewmate standing in the way when there's room", () => {
  const w = createWorld(12, 5)
  workerAt(w, "s", { x: 6, y: 1 }, { x: 6, y: 2 })
  addPawn(w, "go", { x: 1, y: 2 })
  assert.ok(issueOrder(w, "go", { kind: "move", target: { x: 10, y: 2 } }).ok)
  assert.ok(!w.movers.go.path.some((t) => t.x === 6 && t.y === 2), "route avoids the worker's tile")
  walkApart(w, "go", ["go", "s"])
})

test("squeezes past a worker in a one-tile corridor instead of getting stuck", () => {
  const w = createWorld(12, 3)
  for (let x = 0; x < 12; x++) { setCost(w.grid, { x, y: 0 }, BLOCKED); setCost(w.grid, { x, y: 2 }, BLOCKED) }
  addStation(w, createStation(w.grid, { id: "job", kind: "panel", x: 6, y: 0 })) // on the wall line
  addPawn(w, "s", { x: 6, y: 1 })
  assert.ok(issueOrder(w, "s", { kind: "work", stationId: "job" }).ok)
  stepPathing(w, 0.001)
  addPawn(w, "go", { x: 1, y: 1 })
  assert.ok(issueOrder(w, "go", { kind: "move", target: { x: 10, y: 1 } }).ok)
  runUntil(w, (ev) => ev.some((e) => e.type === "arrived" && e.pawnId === "go"), 0.0005, 20000)
  assert.deepEqual(tileOf(w.movers.go.pos), { x: 10, y: 1 })
})

test("an idle crewmate in a doorway steps aside", () => {
  const w = createWorld(11, 5, 5)
  for (let y = 0; y < 5; y++) if (y !== 2) setCost(w.grid, { x: 5, y }, BLOCKED) // wall with a door at (5, 2)
  addPawn(w, "idler", { x: 5, y: 2 })
  addPawn(w, "go", { x: 1, y: 2 })
  assert.ok(issueOrder(w, "go", { kind: "move", target: { x: 9, y: 2 } }).ok)
  walkApart(w, "go", ["go", "idler"])
})

test("two crewmates meeting head-on in a corridor both get through", () => {
  const w = createWorld(12, 3)
  for (let x = 0; x < 12; x++) { setCost(w.grid, { x, y: 0 }, BLOCKED); setCost(w.grid, { x, y: 2 }, BLOCKED) }
  addPawn(w, "east", { x: 1, y: 1 })
  addPawn(w, "west", { x: 10, y: 1 })
  assert.ok(issueOrder(w, "east", { kind: "move", target: { x: 10, y: 1 } }).ok)
  assert.ok(issueOrder(w, "west", { kind: "move", target: { x: 1, y: 1 } }).ok)
  const arrived = new Set<string>()
  for (let i = 0; i < 20000 && arrived.size < 2; i++) {
    for (const e of stepPathing(w, 0.0005)) if (e.type === "arrived") arrived.add(e.pawnId)
  }
  assert.equal(arrived.size, 2)
})

test("waits behind a slower crewmate walking the same way", () => {
  const w = createWorld(30, 3)
  for (let x = 0; x < 30; x++) { setCost(w.grid, { x, y: 0 }, BLOCKED); setCost(w.grid, { x, y: 2 }, BLOCKED) }
  addPawn(w, "slow", { x: 3, y: 1 })
  addPawn(w, "fast", { x: 2, y: 1 })
  assert.ok(issueOrder(w, "slow", { kind: "move", target: { x: 28, y: 1 } }).ok)
  assert.ok(issueOrder(w, "fast", { kind: "move", target: { x: 27, y: 1 } }).ok)
  const speeds = { walkSpeed: (id: string) => (id === "slow" ? WALK_TILES_PER_HOUR / 4 : WALK_TILES_PER_HOUR) }
  let waited = false
  for (let i = 0; i < 20; i++) {
    stepPathing(w, 0.0002, speeds)
    if (w.movers.fast.yieldHours > 0) waited = true
    assert.ok(w.movers.fast.pos.x < w.movers.slow.pos.x, "stays behind")
  }
  assert.ok(waited, "had to wait")
})

test("two crewmates sent to the same tile end up side by side", () => {
  const w = createWorld(12, 12)
  addPawn(w, "a", { x: 1, y: 1 })
  addPawn(w, "b", { x: 1, y: 3 })
  assert.ok(issueOrder(w, "a", { kind: "move", target: { x: 8, y: 8 } }).ok)
  assert.ok(issueOrder(w, "b", { kind: "move", target: { x: 8, y: 8 } }).ok)
  runHours(w, 0.05)
  assert.notEqual(tileKey(w.movers.a.pos), tileKey(w.movers.b.pos))
  for (const m of [w.movers.a, w.movers.b]) assert.ok(Math.max(Math.abs(m.pos.x - 8), Math.abs(m.pos.y - 8)) <= 1.01)
})

// --- Selection, group orders and queues ---

test("box select picks the crew inside the box; shift adds more", () => {
  const w = createWorld(20, 20)
  addPawn(w, "a", { x: 2, y: 2 }); addPawn(w, "b", { x: 4, y: 3 }); addPawn(w, "c", { x: 15, y: 15 })
  assert.deepEqual(selectInBox(w, { x: 5, y: 5 }, { x: 1, y: 1 }), { kind: "selected", pawnIds: ["a", "b"] })
  assert.deepEqual(selectInBox(w, { x: 14, y: 14 }, { x: 16, y: 16 }, { shift: true }), { kind: "selected", pawnIds: ["a", "b", "c"] })
  assert.deepEqual(selectInBox(w, { x: 8, y: 8 }, { x: 9, y: 9 }), { kind: "deselected" })
})

test("shift-click adds a crewmate to the selection or takes them out", () => {
  const w = createWorld(10, 10)
  addPawn(w, "a", { x: 1, y: 1 }); addPawn(w, "b", { x: 3, y: 3 })
  handleClick(w, { x: 1, y: 1 })
  assert.deepEqual(handleClick(w, { x: 3, y: 3 }, { shift: true }), { kind: "selected", pawnIds: ["a", "b"] })
  assert.deepEqual(handleClick(w, { x: 1, y: 1 }, { shift: true }), { kind: "selected", pawnIds: ["b"] })
})

test("a group sent somewhere spreads over nearby free tiles", () => {
  const w = createWorld(20, 20)
  for (const [id, x] of [["a", 1], ["b", 2], ["c", 3]] as const) addPawn(w, id, { x, y: 1 })
  selectInBox(w, { x: 0, y: 0 }, { x: 5, y: 5 })
  const r = handleClick(w, { x: 12, y: 12 })
  assert.equal(r.kind, "ordered")
  assert.equal(r.kind === "ordered" && r.started.length, 3)
  runHours(w, 0.1)
  const tiles = new Set(Object.values(w.movers).map((m) => tileKey(m.pos)))
  assert.equal(tiles.size, 3, "all on different tiles")
  for (const m of Object.values(w.movers)) assert.ok(Math.hypot(m.pos.x - 12, m.pos.y - 12) <= PATHING_TUNING.groupSpreadRadius * 1.5)
})

test("a group sent to a station works from different sides", () => {
  const w = createWorld(20, 20)
  addStation(w, createStation(w.grid, { id: "gh", kind: "greenhouse", x: 10, y: 10, workRequired: 100 }))
  for (const [id, x] of [["a", 1], ["b", 2], ["c", 3]] as const) addPawn(w, id, { x, y: 1 })
  const r = orderGroup(w, ["a", "b", "c"], { kind: "work", stationId: "gh" })
  assert.equal(r.kind === "ordered" && r.started.length, 3)
  const spots = new Set(Object.values(w.movers).map((m) => tileKey(m.destination!)))
  assert.equal(spots.size, 3)
})

test("shift-click queues orders: go here, then work there", () => {
  const w = createWorld(20, 10)
  addStation(w, createStation(w.grid, { id: "lab", kind: "lab", x: 15, y: 5, workRequired: 0.01 }))
  addPawn(w, "q", { x: 1, y: 1 })
  handleClick(w, { x: 1, y: 1 })
  assert.equal(handleClick(w, { x: 8, y: 1 }).kind, "ordered")
  const queued = handleClick(w, { x: 15, y: 5 }, { shift: true })
  assert.ok(queued.kind === "ordered" && queued.queued.includes("q"))
  const events = runUntil(w, (ev) => ev.some((e) => e.type === "workDone"), 0.0005, 40000)
  assert.deepEqual(events.map((e) => e.type), ["arrived", "arrived", "workStarted", "workDone"])
  assert.equal(w.movers.q.queue.length, 0)
})

test("a normal order or a cancel clears the queue", () => {
  const w = createWorld(20, 10)
  addPawn(w, "q", { x: 1, y: 1 })
  assert.ok(issueOrder(w, "q", { kind: "move", target: { x: 10, y: 1 } }).ok)
  issueOrder(w, "q", { kind: "move", target: { x: 10, y: 5 } }, { queue: true })
  assert.equal(w.movers.q.queue.length, 1)
  issueOrder(w, "q", { kind: "move", target: { x: 2, y: 8 } })
  assert.equal(w.movers.q.queue.length, 0)
  issueOrder(w, "q", { kind: "move", target: { x: 10, y: 5 } }, { queue: true })
  cancelOrder(w, "q")
  assert.equal(w.movers.q.queue.length, 0)
  assert.equal(w.movers.q.order, null)
})

test("the queue carries on after an urgent need", () => {
  const w = baseWorld()
  assert.ok(issueOrder(w, "ox", { kind: "move", target: { x: 13, y: 5 } }).ok)
  issueOrder(w, "ox", { kind: "move", target: { x: 16, y: 6 } }, { queue: true })
  let low = false
  runNeeds(w, () => (low ? "oxygen" : null), has("exposureChanged")) // just stepped outside
  low = true
  runNeeds(w, () => (low ? "oxygen" : null), has("workStarted")) // at the tank
  low = false
  const rest = runNeeds(w, () => (low ? "oxygen" : null), (ev) => ev.some((e) => e.type === "arrived" && e.tile.x === 16))
  assert.deepEqual(rest.filter((e) => e.type === "arrived").map((e) => e.type === "arrived" && e.tile), [{ x: 13, y: 5 }, { x: 16, y: 6 }])
})

test("a queued order that can't be done is skipped with a reason", () => {
  const w = createWorld(20, 10)
  addStation(w, createStation(w.grid, { id: "gone", kind: "lab", x: 15, y: 5, workRequired: 1 }))
  addPawn(w, "q", { x: 1, y: 1 })
  assert.ok(issueOrder(w, "q", { kind: "move", target: { x: 5, y: 1 } }).ok)
  issueOrder(w, "q", { kind: "work", stationId: "gone" }, { queue: true })
  issueOrder(w, "q", { kind: "move", target: { x: 5, y: 8 } }, { queue: true })
  removeStation(w, "gone")
  const events = runUntil(w, (ev) => ev.some((e) => e.type === "arrived" && e.tile.y === 8), 0.0005, 40000)
  assert.ok(events.some((e) => e.type === "cancelled"))
})

test("clicking a selected astronaut again lets go of them; others stay selected", () => {
  const w = createWorld(10, 10)
  addPawn(w, "a", { x: 1, y: 1 }); addPawn(w, "b", { x: 3, y: 3 })
  assert.deepEqual(handleClick(w, { x: 1, y: 1 }), { kind: "selected", pawnIds: ["a"] })
  assert.deepEqual(handleClick(w, { x: 1, y: 1 }), { kind: "deselected" }, "second click deselects")
  handleClick(w, { x: 1, y: 1 })
  handleClick(w, { x: 3, y: 3 }, { shift: true })
  assert.deepEqual(handleClick(w, { x: 1, y: 1 }), { kind: "selected", pawnIds: ["b"] }, "only the clicked one is let go")
  assert.deepEqual(handleClick(w, { x: 1, y: 1 }), { kind: "selected", pawnIds: ["a"] }, "a plain click on an unselected one picks just them")
})
