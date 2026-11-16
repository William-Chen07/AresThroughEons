/**
 * Tests for mineral deposits (src/sim/deposits.ts). Run from the game/ folder:
 *
 *   node --experimental-strip-types --import ./tests/pathing/register.mjs --test tests/resources/deposits.test.ts
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  CLEAR_RADIUS,
  CLUMP,
  clumpCells,
  depositAt,
  MIDDLE_RING,
  MINERALS,
  MINERAL_RULES,
  OUTER_RING_MIN,
  generateDeposits,
  mine,
  reachableFrom,
  seedFrom,
  type DepositTerrain,
} from "@/sim/deposits"

const SIZE = 160
const CENTER = { col: 80, row: 80 }
const lander = (i: number) => Math.abs((i % SIZE) - CENTER.col) <= 1 && Math.abs(Math.floor(i / SIZE) - CENTER.row) <= 1

/** A made-up map: gentle hills, patchy colour, and optionally a ring of cliffs and a cliff-walled pit. */
function terrain(seed: number, cliffs = false): DepositTerrain {
  const metres = new Float32Array(SIZE * SIZE)
  const colors = new Uint8Array(SIZE * SIZE * 3)
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const i = row * SIZE + col
      metres[i] = 40 * Math.sin((col + seed) / 9) + 30 * Math.cos((row - seed) / 7)
      // A pit far out whose walls are cliffs: nothing in it can be reached.
      if (cliffs && Math.hypot(col - 140, row - 140) < 8) metres[i] -= 2000
      const shade = 90 + ((col * 7 + row * 13 + seed * 31) % 120)
      colors[i * 3] = shade
      colors[i * 3 + 1] = shade * 0.6
      colors[i * 3 + 2] = shade * 0.4
    }
  }
  return { size: SIZE, metersPerCell: 163, metres, colors }
}

const distance = (d: { col: number; row: number }) => Math.hypot(d.col - CENTER.col, d.row - CENTER.row)

test("each mineral stays in its ring, and nothing is near the landing site", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const deposits = generateDeposits(terrain(seed), CENTER, seed, undefined, lander)
    for (const d of deposits) {
      const r = distance(d)
      assert.ok(r >= CLEAR_RADIUS, `${d.id} at ${r.toFixed(1)} is too close`)
      if (d.mineral === "aluminum" || d.mineral === "copper") assert.ok(r <= MIDDLE_RING.max, `${d.id} at ${r.toFixed(1)}`)
      if (d.mineral === "titanium" || d.mineral === "gold") assert.ok(r >= OUTER_RING_MIN, `${d.id} at ${r.toFixed(1)}`)
    }
  }
})

test("every map gets every mineral, the normal number of each, spread apart", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const deposits = generateDeposits(terrain(seed), CENTER, seed, undefined, lander)
    for (const mineral of MINERALS) {
      assert.equal(deposits.filter((d) => d.mineral === mineral).length, MINERAL_RULES[mineral].count, `${mineral}, seed ${seed}`)
    }
    for (const a of deposits) {
      for (const b of deposits) if (a !== b) assert.ok(Math.hypot(a.col - b.col, a.row - b.row) >= 6)
    }
  }
  // A completely flat, single-colour map still gets them all.
  const flat: DepositTerrain = {
    size: SIZE,
    metersPerCell: 163,
    metres: new Float32Array(SIZE * SIZE),
    colors: new Uint8Array(SIZE * SIZE * 3).fill(150),
  }
  const deposits = generateDeposits(flat, CENTER, 7, undefined, lander)
  for (const mineral of MINERALS) assert.ok(deposits.some((d) => d.mineral === mineral), mineral)
})

test("the same site always gets the same deposits; another site gets others", () => {
  const map = terrain(3)
  const seed = seedFrom("12.5,-45.25")
  assert.deepEqual(generateDeposits(map, CENTER, seed, undefined, lander), generateDeposits(map, CENTER, seed, undefined, lander))
  assert.notDeepEqual(generateDeposits(map, CENTER, seed, undefined, lander), generateDeposits(map, CENTER, seedFrom("-3,100"), undefined, lander))
})

test("every deposit can be walked to from the lander; none in a cliff-walled pit", () => {
  for (let seed = 1; seed <= 10; seed++) {
    const map = terrain(seed, true)
    const reached = reachableFrom(map, CENTER, lander)
    const deposits = generateDeposits(map, CENTER, seed, undefined, lander)
    for (const d of deposits) {
      const cells = clumpCells(d)
      const inside = new Set(cells.map((c) => c.row * SIZE + c.col))
      for (const c of cells) {
        assert.equal(reached[c.row * SIZE + c.col], 1, `${d.id}: a block of its clump isn't on walkable ground`)
        assert.ok(Math.hypot(c.col - 140, c.row - 140) >= 8, `${d.id} is in the pit`)
      }
      const standing = cells.flatMap((c) => [c.row * SIZE + c.col - 1, c.row * SIZE + c.col + 1, (c.row - 1) * SIZE + c.col, (c.row + 1) * SIZE + c.col])
      assert.ok(standing.some((n) => !inside.has(n) && reached[n] === 1), `${d.id} has nowhere to stand`)
    }
  }
})

test("a richer site gets more and bigger deposits of that mineral", () => {
  const map = terrain(5)
  const normal = generateDeposits(map, CENTER, 9, undefined, lander)
  const rich = generateDeposits(map, CENTER, 9, { aluminum: 1.5, copper: 1, titanium: 0.5, gold: 1, sulfur: 1 }, lander)
  const count = (list: typeof normal, mineral: string) => list.filter((d) => d.mineral === mineral).length
  assert.ok(count(rich, "aluminum") > count(normal, "aluminum"))
  assert.ok(count(rich, "titanium") < count(normal, "titanium"))
  assert.ok(count(rich, "titanium") >= 1, "never none")
})

test("mining takes what the crew dig, never more than is left, and removes mined-out deposits", () => {
  const deposits = [
    { id: "gold-1", mineral: "gold" as const, col: 1, row: 1, amount: 1, start: 10 },
    { id: "aluminum-1", mineral: "aluminum" as const, col: 9, row: 9, amount: 50, start: 50 },
  ]
  // Two astronauts on the nearly empty gold, one on the aluminum, for 2 hours.
  const result = mine(
    deposits,
    [
      { depositId: "gold-1", speed: 1 },
      { depositId: "gold-1", speed: 1 },
      { depositId: "aluminum-1", speed: 1.5 },
    ],
    2,
  )
  assert.equal(result.mined.gold, 1, "only what was left")
  assert.equal(result.mined.aluminum, MINERAL_RULES.aluminum.perHour * 1.5 * 2)
  assert.deepEqual(result.deposits.map((d) => d.id), ["aluminum-1"], "the gold is mined out")
  assert.equal(result.deposits[0].amount, 50 - result.mined.aluminum!)
  // The input isn't changed.
  assert.equal(deposits[0].amount, 1)
})

test("TES map colours read back as values: purple low, orange high, red highest", async () => {
  const { valueOfColor } = await import("@/data/mineralMaps")
  // Colours read from Mars Trek's TES plagioclase map.
  const arabia = valueOfColor(80, 0, 209) // Arabia Terra: dusty, almost no plagioclase
  const syrtis = valueOfColor(250, 152, 2) // Syrtis Major: the most plagioclase on Mars
  const cyan = valueOfColor(44, 231, 255) // in between (thermal inertia at Syrtis)
  assert.ok(arabia < 0.05, `${arabia}`)
  assert.ok(syrtis > 0.8, `${syrtis}`)
  assert.ok(cyan > arabia && cyan < syrtis, `${cyan}`)
  assert.equal(valueOfColor(255, 0, 10), 1, "red past 360° is the top")
  assert.equal(valueOfColor(120, 120, 120), 0, "grey isn't on the scale")
})

test("each deposit is a 3×3 clump: found from any of its blocks, never overlapping another or the lander", () => {
  assert.equal(CLUMP, 3)
  for (let seed = 1; seed <= 10; seed++) {
    const deposits = generateDeposits(terrain(seed), CENTER, seed, undefined, lander)
    const taken = new Set<string>()
    for (const d of deposits) {
      const cells = clumpCells(d)
      assert.equal(cells.length, 9)
      for (const c of cells) {
        const key = `${c.col},${c.row}`
        assert.ok(!taken.has(key), `${d.id} overlaps another clump`)
        taken.add(key)
        assert.ok(!lander(c.row * SIZE + c.col), "on the lander")
        assert.equal(depositAt(deposits, c)?.id, d.id, "every block finds its deposit")
      }
    }
  }
  const one = [{ id: "gold-1", mineral: "gold" as const, col: 50, row: 50, amount: 5, start: 5 }]
  assert.equal(depositAt(one, { col: 51, row: 49 })?.id, "gold-1")
  assert.equal(depositAt(one, { col: 52, row: 50 }), undefined, "just outside the clump")
})
