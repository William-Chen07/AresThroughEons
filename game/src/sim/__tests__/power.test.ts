import { describe, expect, it } from "vitest"
import { startingResources } from "@/content/resources"
import { WEATHER_EVENTS } from "@/content/weather"
import { liveCrewThrough, newCrew } from "@/sim/crewLife"
import type { CrewMember } from "@/sim/lifeSupport"
import type { PlacedModule } from "@/sim/base"
import { DAYLIGHT_HOURS } from "@/sim/dayNight"
import { SOLAR_POWER_PER_HOUR, daylightHours, solarPower } from "@/sim/power"
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

describe("solar panels make power", () => {
  const panel = (id: string, era?: number): PlacedModule => ({ id, type: "solar", col: 0, row: 0, era })
  const habitat: PlacedModule = { id: "h", type: "habitat", col: 5, row: 5 }

  it("counts only the daylight part of a stretch of time", () => {
    expect(daylightHours(0, 4)).toBe(4)
    expect(daylightHours(DAYLIGHT_HOURS - 1, 3)).toBe(1)
    expect(daylightHours(DAYLIGHT_HOURS, 4)).toBe(0)
    // From an hour before the day ends into the next morning.
    expect(daylightHours(23, 3)).toBe(2)
    expect(daylightHours(0, 48)).toBe(DAYLIGHT_HOURS * 2)
  })

  it("each panel makes power by day and none at night", () => {
    expect(solarPower([panel("a"), panel("b"), habitat], 1, 0, 2)).toBeCloseTo(2 * SOLAR_POWER_PER_HOUR * 2)
    expect(solarPower([panel("a")], 1, DAYLIGHT_HOURS + 1, 2)).toBe(0)
    expect(solarPower([habitat], 1, 0, 2)).toBe(0)
  })

  it("panels from an earlier era, and panels in a power-out storm, make nothing", () => {
    expect(solarPower([panel("old", 1), panel("new", 2)], 2, 0, 2)).toBeCloseTo(SOLAR_POWER_PER_HOUR * 2)
    expect(solarPower([panel("a")], 1, 0, 2, 0)).toBe(0)
    expect(solarPower([panel("a")], 1, 0, 2, 0.5)).toBeCloseTo(SOLAR_POWER_PER_HOUR)
  })
})
