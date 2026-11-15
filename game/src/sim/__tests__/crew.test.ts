import { describe, expect, it } from "vitest"
import {
  advanceMission,
  createMission,
  hasStatus,
  NASA_DATA,
  ROLE_IDS,
  stepMission,
  TRAITS,
  type Mission,
  type Pawn,
  type RoleId,
} from "@/sim"

const byRole = (m: Mission, role: RoleId): Pawn => m.crew.find((p) => p.role === role)!

/** A mission where nobody gets tired or hurt by traits, so role behavior is easy to check. */
function cleanMission(seed = 1, roles?: RoleId[]): Mission {
  const m = createMission(seed, roles)
  for (const p of m.crew) p.traits = []
  return m
}

/** Expert scout so resource finds are near-certain within a few hours. */
function scoutMission(seed: number): Mission {
  const m = cleanMission(seed)
  byRole(m, "scout").skill = 10
  return m
}

describe("spawning", () => {
  it("creates one pawn per role, each with 2 non-conflicting traits", () => {
    const m = createMission(42)
    expect(m.crew.map((p) => p.role).sort()).toEqual([...ROLE_IDS].sort())
    for (const p of m.crew) {
      expect(p.traits).toHaveLength(2)
      const [a, b] = p.traits
      expect(a).not.toBe(b)
      expect(TRAITS[a].conflictsWith ?? []).not.toContain(b)
    }
  })

  it("is deterministic for the same seed", () => {
    expect(createMission(7)).toEqual(createMission(7))
    expect(createMission(7).crew.map((p) => p.name)).not.toEqual(createMission(8).crew.map((p) => p.name))
  })
})

describe("engineer", () => {
  it("builds the first queued module and reports completion", () => {
    let m = cleanMission()
    m.colony.constructionQueue.push({ id: "greenhouse", name: "Greenhouse", workRequired: 5, workDone: 0 })
    m = advanceMission(m, 10)
    expect(m.colony.completed.buildings).toContain("greenhouse")
    expect(m.colony.constructionQueue).toHaveLength(0)
    expect(m.log.some((e) => e.text.includes("finished building the Greenhouse"))).toBe(true)
  })

  it("idles with a reason when there is nothing to build", () => {
    const m = stepMission(cleanMission())
    expect(byRole(m, "engineer").activity).toBe("idle")
    expect(byRole(m, "engineer").task).toMatch(/nothing to build/)
  })
})

describe("researcher", () => {
  it("researches the first queued project", () => {
    let m = cleanMission()
    m.colony.researchQueue.push({ id: "rover", name: "Rover", workRequired: 4, workDone: 0 })
    m = advanceMission(m, 8)
    expect(m.colony.completed.research).toEqual(["rover"])
  })

  it("only the researcher contributes research", () => {
    let m = cleanMission(1, ["engineer", "scout", "medic"])
    m.colony.researchQueue.push({ id: "rover", name: "Rover", workRequired: 4, workDone: 0 })
    m = advanceMission(m, 8)
    expect(m.colony.researchQueue[0].workDone).toBe(0)
  })
})

describe("scout", () => {
  it("goes outside, finds resources, and takes more radiation than crew inside", () => {
    let m = scoutMission(3)
    m = advanceMission(m, 12)
    const scout = byRole(m, "scout")
    const engineer = byRole(m, "engineer")
    expect(scout.activity).toBe("eva")
    const r = m.colony.resources
    expect(r.metal + r.stone + r.ice).toBeGreaterThan(0)
    expect(scout.missionDoseMsv).toBeGreaterThan(engineer.missionDoseMsv * 1.5)
  })

  it("accumulates dose at the real Curiosity RAD surface rate while outside", () => {
    let m = scoutMission(3)
    m = advanceMission(m, 10)
    const expected = (NASA_DATA.surfaceDoseMsvPerDay / 24) * 10
    expect(byRole(m, "scout").missionDoseMsv).toBeCloseTo(expected, 5)
  })

  it("only looks for the ordered resource", () => {
    let m = scoutMission(5)
    byRole(m, "scout").orders.scoutTarget = "ice"
    m = advanceMission(m, 14)
    expect(m.colony.resources.ice).toBeGreaterThan(0)
    expect(m.colony.resources.metal + m.colony.resources.stone).toBe(0)
  })

  it("is grounded once the mission radiation budget is used up", () => {
    let m = cleanMission()
    byRole(m, "scout").missionDoseMsv = m.colony.evaDoseBudgetMsv
    m = advanceMission(m, 2)
    const scout = byRole(m, "scout")
    expect(hasStatus(scout, "grounded")).toBe(true)
    expect(scout.activity).toBe("idle")
    expect(scout.task).toMatch(/Radiation Limit/)
  })

  it("waits out dust storms when told to, and goes out anyway when not", () => {
    let m = cleanMission()
    m.colony.weather.dustStorm = true
    expect(byRole(stepMission(m), "scout").task).toMatch(/dust storm/)

    byRole(m, "scout").orders.holdDuringStorms = false
    expect(byRole(stepMission(m), "scout").activity).toBe("eva")
  })

  it("a solar particle event makes going outside far more dangerous than staying in", () => {
    let calm = cleanMission()
    let spe = cleanMission()
    spe.colony.weather.solarParticleEvent = true
    calm = advanceMission(calm, 3)
    spe = advanceMission(spe, 3)
    expect(byRole(spe, "scout").missionDoseMsv).toBeGreaterThan(byRole(calm, "scout").missionDoseMsv * 10)
  })
})

describe("medic", () => {
  it("treats an injured crewmate much faster than natural healing", () => {
    let m = cleanMission()
    const engineer = byRole(m, "engineer")
    engineer.statuses.push({ id: "injured", sinceHour: 0, treatmentProgress: 0 })
    m = advanceMission(m, 12)
    expect(hasStatus(byRole(m, "engineer"), "injured")).toBe(false)
    expect(m.log.some((e) => e.text.includes("treated") && e.text.includes(engineer.name))).toBe(true)
  })

  it("treats injuries before stress", () => {
    let m = cleanMission()
    byRole(m, "engineer").statuses.push({ id: "stressed", sinceHour: 0, treatmentProgress: 0 })
    byRole(m, "scout").statuses.push({ id: "injured", sinceHour: 0, treatmentProgress: 0 })
    m = stepMission(m)
    expect(byRole(m, "medic").task).toMatch(/Injured/)
  })

  it("counseling a stressed pawn raises their morale", () => {
    let m = cleanMission()
    const eng = byRole(m, "engineer")
    eng.needs.morale = 20
    eng.statuses.push({ id: "stressed", sinceHour: 0, treatmentProgress: 0 })
    m = advanceMission(m, 6)
    expect(hasStatus(byRole(m, "engineer"), "stressed")).toBe(false)
    expect(byRole(m, "engineer").needs.morale).toBeGreaterThan(40)
  })

  it("cannot fix need-based problems like low oxygen", () => {
    let m = cleanMission()
    m.colony.supplies.oxygenKg = 0
    m = advanceMission(m, 20)
    expect(hasStatus(byRole(m, "engineer"), "hypoxic")).toBe(true)
    expect(byRole(m, "medic").task).not.toMatch(/Low Oxygen/)
  })
})

describe("needs, supplies, and evacuation", () => {
  it("each pawn uses about one day of real oxygen per day", () => {
    let m = cleanMission(1, ["engineer"])
    const start = m.colony.supplies.oxygenKg
    m = advanceMission(m, 48)
    const usedPerDay = (start - m.colony.supplies.oxygenKg) / 2
    expect(usedPerDay).toBeCloseTo(NASA_DATA.oxygenKgPerDay, 1)
  })

  it("pawns go to sleep when tired and wake up rested", () => {
    let m = cleanMission()
    byRole(m, "engineer").needs.rest = 10
    m = stepMission(m)
    expect(byRole(m, "engineer").activity).toBe("sleeping")
    m = advanceMission(m, 6) // 8 h sleep restores rest to full
    expect(byRole(m, "engineer").activity).toBe("sleeping")
    m = stepMission(m)
    expect(byRole(m, "engineer").activity).not.toBe("sleeping")
    expect(byRole(m, "engineer").needs.rest).toBeGreaterThan(90)
  })

  it("running out of oxygen leads to evacuation, not death", () => {
    let m = cleanMission()
    m.colony.supplies.oxygenKg = 0
    m = advanceMission(m, 48)
    for (const p of m.crew) {
      expect(p.evacuated).not.toBeNull()
      expect(p.evacuated!.reason).toBe("Low Oxygen")
    }
    // Evacuated pawns stop doing anything.
    const after = stepMission(m)
    expect(after.crew.map((p) => p.missionDoseMsv)).toEqual(m.crew.map((p) => p.missionDoseMsv))
  })

  it("off-duty pawns don't work", () => {
    let m = cleanMission()
    m.colony.constructionQueue.push({ id: "x", name: "X", workRequired: 100, workDone: 0 })
    byRole(m, "engineer").orders.enabled = false
    m = advanceMission(m, 4)
    expect(m.colony.constructionQueue[0].workDone).toBe(0)
    expect(byRole(m, "engineer").task).toBe("Off duty")
  })

  it("working raises skill over time", () => {
    let m = cleanMission()
    m.colony.constructionQueue.push({ id: "x", name: "X", workRequired: 1000, workDone: 0 })
    m = advanceMission(m, 40)
    expect(byRole(m, "engineer").skill).toBeGreaterThan(2)
  })

  it("does not mutate the previous mission state", () => {
    const m = cleanMission()
    const snapshot = structuredClone(m)
    stepMission(m)
    expect(m).toEqual(snapshot)
  })
})
