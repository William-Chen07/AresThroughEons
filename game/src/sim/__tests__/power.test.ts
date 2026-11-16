import { describe, expect, it } from "vitest"
import { startingResources } from "@/content/resources"
import { WEATHER_EVENTS } from "@/content/weather"
import { liveCrewThrough, newCrew } from "@/sim/crewLife"
import type { CrewMember } from "@/sim/lifeSupport"
import { poweredShare } from "@/sim/weather"

describe("storms knock the power out", () => {
  it("every storm turns the power off and doubles water use", () => {
    for (const event of WEATHER_EVENTS) {
      expect(event.powerOut).toBe(true)
      expect(event.waterUseMultiplier).toBe(2)
    }
  })

  it("labs only work for the share of time the base had power", () => {
    expect(poweredShare(10, 0, true)).toBe(1)
    expect(poweredShare(10, 4, true)).toBeCloseTo(0.6)
    expect(poweredShare(10, 10, true)).toBe(0)
    // A storm longer than the step can't go below no power at all.
    expect(poweredShare(2, 5, true)).toBe(0)
    // Events that don't cut the power, and empty steps, leave the labs alone.
    expect(poweredShare(10, 10, false)).toBe(1)
    expect(poweredShare(0, 0, true)).toBe(1)
  })
})

describe("storms make the crew thirsty faster", () => {
  /**
   * How far the crew's water need drops over `hours` inside, in a storm that lasts the whole time.
   * The base has no water, so nobody refills and the drop is the drain alone. (Refills only start
   * below a threshold, so the base's water use isn't a clean ratio over a short time.)
   */
  function thirstGained(waterUseMultiplier: number | undefined, hours = 6, step = 0.5) {
    let crew = newCrew(1, () => 0.42).slice(0, 4)
    for (const p of crew) p.traits = []
    const atBase: CrewMember[] = crew.map((p) => ({ id: p.id, outside: false, pressurized: true }))
    const before = crew.reduce((sum, p) => sum + p.needs.water, 0)
    let resources = { ...startingResources(), water: 0 }
    for (let t = 0; t < hours; t += step) {
      const storm = { hours: step, healthLostPerHourOutside: 0, name: "Test storm", waterUseMultiplier }
      const r = liveCrewThrough({ crew, resources, atBase, away: [], storm, hours: step, clock: t, random: () => 0.99 })
      crew = r.crew
      resources = r.resources
    }
    return before - crew.reduce((sum, p) => sum + p.needs.water, 0)
  }

  it("drains water twice as fast in a storm that doubles it", () => {
    const normal = thirstGained(undefined)
    expect(normal).toBeGreaterThan(0)
    expect(thirstGained(2)).toBeCloseTo(normal * 2)
  })

  it("a multiplier of 1 changes nothing", () => {
    expect(thirstGained(1)).toBeCloseTo(thirstGained(undefined))
  })
})
