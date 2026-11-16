import { describe, expect, it } from "vitest"
import { startingResources } from "@/content/resources"
import { MODULE_TYPES } from "@/content/modules"
import { WEATHER_EVENTS } from "@/content/weather"
import { liveCrewThrough, newCrew } from "@/sim/crewLife"
import type { CrewMember } from "@/sim/lifeSupport"
import type { PlacedModule } from "@/sim/base"
import { DAYLIGHT_HOURS } from "@/sim/dayNight"
import { SOLAR_POWER_PER_HOUR, URANIUM_POWER_PER_HOUR, WIND_POWER_PER_HOUR, daylightHours, MODULE_POWER_PER_HOUR, powerMade, powerUsed } from "@/sim/power"
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
    expect(powerMade([panel("a"), panel("b"), habitat], 1, 0, 2)).toBeCloseTo(2 * SOLAR_POWER_PER_HOUR * 2)
    expect(powerMade([panel("a")], 1, DAYLIGHT_HOURS + 1, 2)).toBe(0)
    expect(powerMade([habitat], 1, 0, 2)).toBe(0)
  })

  it("panels from an earlier era, and panels in a power-out storm, make nothing", () => {
    expect(powerMade([panel("old", 1), panel("new", 2)], 2, 0, 2)).toBeCloseTo(SOLAR_POWER_PER_HOUR * 2)
    expect(powerMade([panel("a")], 1, 0, 2, 0)).toBe(0)
    expect(powerMade([panel("a")], 1, 0, 2, 0.5)).toBeCloseTo(SOLAR_POWER_PER_HOUR)
  })

  const wind = (id: string, era?: number): PlacedModule => ({ id, type: "wind-turbine", col: 0, row: 0, era })
  const plant = (id: string, era?: number): PlacedModule => ({ id, type: "uranium-power", col: 0, row: 0, era })

  it("wind turbines and uranium plants make power day and night", () => {
    expect(powerMade([wind("w")], 1, 0, 2)).toBeCloseTo(WIND_POWER_PER_HOUR * 2)
    expect(powerMade([wind("w")], 1, DAYLIGHT_HOURS + 1, 2)).toBeCloseTo(WIND_POWER_PER_HOUR * 2)
    expect(powerMade([plant("u")], 1, DAYLIGHT_HOURS + 1, 2)).toBeCloseTo(URANIUM_POWER_PER_HOUR * 2)
    expect(powerMade([panel("a"), wind("w"), plant("u")], 1, 0, 1)).toBeCloseTo(
      SOLAR_POWER_PER_HOUR + WIND_POWER_PER_HOUR + URANIUM_POWER_PER_HOUR,
    )
  })

  it("a turbine makes less than a panel, hour for hour and over a day; a uranium plant far more", () => {
    const day = (module: PlacedModule) => powerMade([module], 1, 0, 24)
    expect(WIND_POWER_PER_HOUR).toBeLessThan(SOLAR_POWER_PER_HOUR)
    expect(day(wind("w"))).toBe(720)
    expect(day(panel("a"))).toBe(960)
    expect(day(plant("u"))).toBe(4320)
  })

  it("a power-out storm stops turbines but not a uranium plant; decayed ones make nothing", () => {
    expect(powerMade([wind("w")], 1, 0, 2, 0)).toBe(0)
    expect(powerMade([plant("u")], 1, 0, 2, 0)).toBeCloseTo(URANIUM_POWER_PER_HOUR * 2)
    expect(powerMade([wind("w", 1), plant("u", 1)], 2, 0, 2)).toBe(0)
  })
})

describe("modules use power", () => {
  const made = (type: PlacedModule["type"], era?: number): PlacedModule => ({ id: type, type, col: 0, row: 0, era })

  it("every module that doesn't make power uses some each hour; the ones that make it use none", () => {
    const makers = ["solar", "wind-turbine", "uranium-power"]
    for (const type of MODULE_TYPES) {
      const perHour = MODULE_POWER_PER_HOUR[type.id]
      if (makers.includes(type.id)) expect(perHour).toBe(0)
      else expect(perHour).toBeGreaterThan(0)
      expect(powerUsed([made(type.id)], 1, 3)).toBeCloseTo(perHour * 3)
    }
  })

  it("adds up over the base, skipping decayed modules and time the power was out", () => {
    const base = [made("habitat"), made("research"), made("solar")]
    expect(powerUsed(base, 1, 10)).toBeCloseTo((MODULE_POWER_PER_HOUR.habitat + MODULE_POWER_PER_HOUR.research) * 10)
    expect(powerUsed([made("habitat", 1)], 2, 10)).toBe(0)
    expect(powerUsed(base, 1, 10, 0)).toBe(0)
  })

  it("each module uses the power number shown on its Build bar card", () => {
    for (const type of MODULE_TYPES) {
      expect(MODULE_POWER_PER_HOUR[type.id]).toBe((type.cost as { power?: number }).power ?? 0)
    }
    expect(MODULE_POWER_PER_HOUR.habitat).toBe(10)
  })

  it("every number is a whole number", () => {
    for (const n of [SOLAR_POWER_PER_HOUR, WIND_POWER_PER_HOUR, URANIUM_POWER_PER_HOUR, ...Object.values(MODULE_POWER_PER_HOUR)]) {
      expect(Number.isInteger(n)).toBe(true)
    }
  })

  it("one solar panel runs a first base: it stores more by day than the night uses", () => {
    const base = [made("solar"), made("habitat"), made("medbay"), made("research")]
    const day = powerMade(base, 1, 0, DAYLIGHT_HOURS) - powerUsed(base, 1, DAYLIGHT_HOURS)
    const night = powerUsed(base, 1, 24 - DAYLIGHT_HOURS) - powerMade(base, 1, DAYLIGHT_HOURS, 24 - DAYLIGHT_HOURS)
    expect(day).toBe(400)
    expect(night).toBe(280)
  })

  it("one uranium plant runs one of every module on its own", () => {
    const base = MODULE_TYPES.map((type) => made(type.id)).filter((m) => m.type !== "solar" && m.type !== "wind-turbine")
    expect(powerUsed(base, 1, 1)).toBe(130)
    expect(powerMade(base, 1, DAYLIGHT_HOURS, 1)).toBeGreaterThan(powerUsed(base, 1, 1))
  })
})
