/**
 * Tests for astronauts' tasks (src/sim/tasks.ts): sending an astronaut to mine from their task
 * list, on the real base map. Run from the game/ folder:
 *
 *   node --experimental-strip-types --import ./tests/pathing/register.mjs --test tests/pathing/tasks.test.ts
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { CLUMP, depositStationId, mine, type Deposit } from "@/sim/deposits"
import { buildNavigation, type NavigationTerrain } from "@/sim/navigation"
import { addPawn, stepPathing, type World } from "@/sim/pathing"
import { miningChoices, sendToMine, syncDepositStations } from "@/sim/tasks"

const SIZE = 48
const flat = (): NavigationTerrain => ({ size: SIZE, metersPerCell: 163, metres: new Float32Array(SIZE * SIZE) })
const deposit = (id: string, mineral: Deposit["mineral"], col: number, row: number, amount = 20): Deposit => ({
  id,
  mineral,
  col,
  row,
  amount,
  start: amount,
})

/** Two aluminum deposits (one near, one far), a copper one and a sulfur one. The lander is in the middle, at 24, 24. */
const DEPOSITS = [
  deposit("al-near", "aluminum", 8, 8),
  deposit("al-far", "aluminum", 40, 40),
  deposit("cu", "copper", 8, 40),
  deposit("s", "sulfur", 40, 8),
]

function world(deposits: Deposit[] = DEPOSITS, terrain = flat()): World {
  const w = buildNavigation(terrain, { modules: [], tubes: [] })
  syncDepositStations(w, deposits)
  addPawn(w, "a", { x: 14, y: 14 })
  return w
}

function runUntilWorking(w: World, pawnId = "a") {
  for (let i = 0; i < 40000; i++) {
    stepPathing(w, 0.01)
    if (w.movers[pawnId].status === "working") return
  }
  throw new Error("never started working")
}

test("every deposit with something left is a station on the crew's map; mined-out ones are taken off", () => {
  const w = world()
  const ids = () => w.stations.map((s) => s.id).filter((id) => id.startsWith("deposit:")).sort()
  assert.deepEqual(ids(), DEPOSITS.map((d) => depositStationId(d.id)).sort())
  const station = w.stations.find((s) => s.id === depositStationId("al-near"))!
  assert.equal(station.footprint.length, CLUMP * CLUMP, "the whole clump")

  const gone = syncDepositStations(w, DEPOSITS.map((d) => (d.id === "cu" ? { ...d, amount: 0 } : d)))
  assert.deepEqual(gone.map((s) => s.id), [depositStationId("cu")])
  assert.ok(!ids().includes(depositStationId("cu")))
  assert.equal(w.stations.find((s) => s.id === depositStationId("al-near")), station, "the others are kept as they were")
})

test("the task list offers the nearest deposit of each mineral, nearest first", () => {
  const w = world()
  const choices = miningChoices(w, DEPOSITS, "a")
  assert.deepEqual(choices.map((c) => c.depositId), ["al-near", "cu", "s"], "the far aluminum is left out")
  assert.ok(choices[0].distance < choices[1].distance)
  assert.deepEqual(miningChoices(w, DEPOSITS, "nobody"), [])
})

test("mining from the task list: they walk over, start mining, and the deposit goes down as the mineral goes up", () => {
  const w = world()
  const sent = sendToMine(w, DEPOSITS, "a", null)
  assert.ok(sent.kind === "ordered" && sent.started.includes("a"))
  assert.deepEqual(w.movers.a.order, { kind: "work", stationId: depositStationId("al-near") })
  runUntilWorking(w)

  // While they work there, an hour of mining (see passTime in sim/saves.ts) takes from that deposit.
  const dug = mine(DEPOSITS, [{ depositId: "al-near", speed: 1 }], 1)
  const after = dug.deposits.find((d) => d.id === "al-near")!
  assert.ok(after.amount < 20)
  assert.equal(dug.mined.aluminum, 20 - after.amount)
})

test("one mineral can be picked, and a shift-click adds the job to the end of the task list", () => {
  const w = world()
  assert.ok(sendToMine(w, DEPOSITS, "a", "copper").kind === "ordered")
  assert.deepEqual(w.movers.a.order, { kind: "work", stationId: depositStationId("cu") })
  const queued = sendToMine(w, DEPOSITS, "a", "sulfur", true)
  assert.ok(queued.kind === "ordered" && queued.queued.includes("a"))
  assert.deepEqual(w.movers.a.order, { kind: "work", stationId: depositStationId("cu") }, "still on the copper")
  assert.deepEqual(w.movers.a.queue, [{ kind: "work", stationId: depositStationId("s") }])
})

test("a deposit nobody can get to is skipped for the next nearest one", () => {
  // Walls of cliff round the near aluminum deposit: far too steep to walk up.
  const terrain = flat()
  const metres = terrain.metres as Float32Array
  for (let row = 2; row <= 14; row++) {
    for (let col = 2; col <= 14; col++) {
      if (row === 2 || row === 14 || col === 2 || col === 14) metres[row * SIZE + col] = 5000
    }
  }
  const w = buildNavigation(terrain, { modules: [], tubes: [] })
  syncDepositStations(w, DEPOSITS)
  addPawn(w, "a", { x: 18, y: 18 })
  const sent = sendToMine(w, DEPOSITS, "a", "aluminum")
  assert.ok(sent.kind === "ordered" && sent.started.includes("a"))
  assert.deepEqual(w.movers.a.order, { kind: "work", stationId: depositStationId("al-far") })
})

test("with nothing left to mine, it says so", () => {
  const w = world([])
  const sent = sendToMine(w, [], "a", null)
  assert.equal(sent.kind, "failed")
  assert.equal(sent.kind === "failed" && sent.reason, "There's no deposit left to mine.")
  assert.equal(w.movers.a.order, null)
})
