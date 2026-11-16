import { describe, expect, it } from "vitest"
import { EXPLORE_BASE, EXPLORE_RULES, type ExplorePlace } from "@/content/explore"
import { EXPLORE_EVENTS } from "@/content/exploreEvents"
import { createRng } from "@/sim/rng"
import {
  carryLimit,
  dangerOf,
  eventWeight,
  farness,
  findStars,
  pickEvent,
  rollFinds,
  tripFood,
  tripHours,
  withinCarryLimit,
} from "@/sim/explore"

/** A made-up place `distance` map units from the base, with a little water to find. */
const placeAt = (distance: number): ExplorePlace => ({
  id: `test-${distance}`,
  name: "Test",
  x: EXPLORE_BASE.x + distance,
  y: EXPLORE_BASE.y,
  text: "",
  finds: [{ resource: "water", min: 5, max: 10 }],
})
const near = placeAt(EXPLORE_RULES.nearDistance - 5)
const middle = placeAt((EXPLORE_RULES.nearDistance + EXPLORE_RULES.farDistance) / 2)
const far = placeAt(EXPLORE_RULES.farDistance + 5)

/** Adds up `resource` over many trips, to compare chances. */
function totalOver(trips: number, place: ExplorePlace, era: number, resource: "titanium" | "gold" | "uranium" | "sulfur") {
  const rng = createRng(7)
  let total = 0
  for (let i = 0; i < trips; i++) total += rollFinds(place, 2, rng.next, [], era)[resource] ?? 0
  return total
}

describe("exploring: group size", () => {
  it("more astronauts pack more food, and longer trips more again", () => {
    expect(tripFood(middle, 3)).toBeGreaterThan(tripFood(middle, 1))
    expect(tripFood(far, 2)).toBeGreaterThan(tripFood(near, 2))
    expect(tripFood(middle, 2)).toBe(Math.ceil(2 * EXPLORE_RULES.foodPerAstronautHour * tripHours(middle)))
  })

  it("more astronauts can carry more back", () => {
    expect(carryLimit(4)).toBe(4 * EXPLORE_RULES.carryPerAstronaut)
    expect(carryLimit(3)).toBeGreaterThan(carryLimit(1))
  })

  it("finds are cut down to what the group can carry, all alike, and morale isn't cut", () => {
    const cut = withinCarryLimit({ water: 60, regolith: 20, morale: 9 }, 40)
    expect((cut.water ?? 0) + (cut.regolith ?? 0)).toBeLessThanOrEqual(40)
    expect(cut.water).toBe(30)
    expect(cut.regolith).toBe(10)
    expect(cut.morale).toBe(9)
    expect(withinCarryLimit({ water: 10 }, 40)).toEqual({ water: 10 })
  })

  it("no trip ever brings back more than the group can carry", () => {
    const rng = createRng(3)
    const rich = { ...far, finds: [{ resource: "regolith" as const, min: 50, max: 80 }] }
    for (let i = 0; i < 200; i++) {
      const finds = rollFinds(rich, 2, rng.next, ["rich-find"], 3)
      const carried = Object.entries(finds).filter(([id]) => id !== "morale").reduce((sum, [, n]) => sum + (n ?? 0), 0)
      expect(carried).toBeLessThanOrEqual(carryLimit(2))
    }
  })
})

describe("exploring: distance", () => {
  it("farness goes from 0 near the base to 1 far away", () => {
    expect(farness(near)).toBe(0)
    expect(farness(middle)).toBeCloseTo(0.5)
    expect(farness(far)).toBe(1)
  })

  it("titanium and gold turn up more the further the trip, and never near the base", () => {
    expect(totalOver(400, near, 2, "titanium")).toBe(0)
    expect(totalOver(400, near, 2, "gold")).toBe(0)
    expect(totalOver(400, far, 2, "titanium")).toBeGreaterThan(totalOver(400, middle, 2, "titanium"))
    expect(totalOver(400, far, 2, "gold")).toBeGreaterThan(totalOver(400, middle, 2, "gold"))
  })

  it("uranium only turns up from Era 3, and more the further the trip", () => {
    expect(totalOver(400, far, 2, "uranium")).toBe(0)
    expect(totalOver(400, far, 3, "uranium")).toBeGreaterThan(totalOver(400, middle, 3, "uranium"))
    expect(totalOver(400, far, 4, "uranium")).toBeGreaterThan(0)
  })

  it("sulfur turns up from Era 2, more the further the trip, but less often than titanium", () => {
    expect(totalOver(400, far, 1, "sulfur")).toBe(0)
    expect(totalOver(400, near, 2, "sulfur")).toBe(0)
    expect(totalOver(400, far, 2, "sulfur")).toBeGreaterThan(totalOver(400, middle, 2, "sulfur"))
    const trips = (era: number, resource: "sulfur" | "titanium") => {
      const rng = createRng(5)
      let found = 0
      for (let i = 0; i < 1000; i++) if ((rollFinds(far, 1, rng.next, [], era)[resource] ?? 0) > 0) found++
      return found
    }
    expect(trips(2, "sulfur")).toBeLessThan(trips(2, "titanium"))
  })

  it("the events that hurt get more likely the further the trip", () => {
    const hurts = EXPLORE_EVENTS.find((event) => event.effect.healthLost)!
    const harmless = EXPLORE_EVENTS.find((event) => !event.effect.healthLost)!
    expect(eventWeight(hurts, 1)).toBe(hurts.weight * EXPLORE_RULES.injuryWeightAtFar)
    expect(eventWeight(hurts, 0)).toBe(hurts.weight)
    expect(eventWeight(harmless, 1)).toBe(harmless.weight)
    const injuries = (f: number) => {
      const rng = createRng(11)
      let n = 0
      for (let i = 0; i < 2000; i++) if (pickEvent(rng.next, f).effect.healthLost) n++
      return n
    }
    expect(injuries(1)).toBeGreaterThan(injuries(0) * 2)
  })

  it("the map shows better finds further away and from Era 3, and the danger, without naming finds", () => {
    expect(findStars(far, 2)).toBeGreaterThan(findStars(near, 2))
    expect(findStars(middle, 3)).toBeGreaterThan(findStars(middle, 2))
    expect(findStars(far, 3)).toBe(4)
    expect(dangerOf(near)).toBe("Low")
    expect(dangerOf(middle)).toBe("Medium")
    expect(dangerOf(far)).toBe("High")
  })
})
