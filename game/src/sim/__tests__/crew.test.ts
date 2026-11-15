import { describe, expect, it } from "vitest"
import {
  advanceMission,
  assignRole,
  createMission,
  dislikesEachOther,
  hasStatus,
  isTrainedFor,
  NASA_DATA,
  OCCUPATION_IDS,
  OCCUPATIONS,
  ROLE_IDS,
  stepMission,
  TRAITS,
  TUNING,
  workSpeed,
  type Mission,
  type OccupationId,
  type Pawn,
} from "@/sim"

/** Find the crewmate with this (permanent) occupation. */
const byOcc = (m: Mission, occupation: OccupationId): Pawn => m.crew.find((p) => p.occupation === occupation)!

/** A mission with no traits, so occupation and role behavior is easy to check. */
function cleanMission(seed = 1, occupations?: OccupationId[]): Mission {
  const m = createMission(seed, occupations)
  for (const p of m.crew) p.traits = []
  return m
}

/** Expert scout so resource finds are near-certain within a few hours. */
function scoutMission(seed: number): Mission {
  const m = cleanMission(seed)
  byOcc(m, "scout").skills.scouting.level = 10
  return m
}

describe("spawning", () => {
  it("creates one pawn per occupation, each with 2 non-conflicting traits", () => {
    const m = createMission(42)
    expect(m.crew.map((p) => p.occupation).sort()).toEqual([...OCCUPATION_IDS].sort())
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

describe("building", () => {
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
    expect(byOcc(m, "engineer").activity).toBe("idle")
    expect(byOcc(m, "engineer").task).toMatch(/nothing to build/)
  })
})

describe("researching", () => {
  it("researches the first queued project", () => {
    let m = cleanMission()
    m.colony.researchQueue.push({ id: "rover", name: "Rover", workRequired: 4, workDone: 0 })
    m = advanceMission(m, 8)
    expect(m.colony.completed.research).toEqual(["rover"])
  })

  it("nobody researches unless someone is assigned to it", () => {
    let m = cleanMission(1, ["engineer", "scout", "medic"])
    m.colony.researchQueue.push({ id: "rover", name: "Rover", workRequired: 4, workDone: 0 })
    m = advanceMission(m, 8)
    expect(m.colony.researchQueue[0].workDone).toBe(0)
  })
})

describe("scouting", () => {
  it("goes outside, finds resources, and takes more radiation than crew inside", () => {
    let m = scoutMission(3)
    expect(byOcc(stepMission(m), "scout").activity).toBe("eva")
    m = advanceMission(m, 12)
    const scout = byOcc(m, "scout")
    const engineer = byOcc(m, "engineer")
    const r = m.colony.resources
    expect(r.metal + r.stone + r.ice).toBeGreaterThan(0)
    expect(scout.missionDoseMsv).toBeGreaterThan(engineer.missionDoseMsv * 1.5)
  })

  it("accumulates dose at the real Curiosity RAD surface rate while outside", () => {
    // One hour outside, then compare: deterministic regardless of random injuries later.
    const m = stepMission(scoutMission(3))
    const expected = NASA_DATA.surfaceDoseMsvPerDay / 24
    expect(byOcc(m, "scout").activity).toBe("eva")
    expect(byOcc(m, "scout").missionDoseMsv).toBeCloseTo(expected, 8)
  })

  it("only looks for the ordered resource", () => {
    let m = scoutMission(5)
    byOcc(m, "scout").orders.scoutTarget = "ice"
    m = advanceMission(m, 14)
    expect(m.colony.resources.ice).toBeGreaterThan(0)
    expect(m.colony.resources.metal + m.colony.resources.stone).toBe(0)
  })

  it("is grounded once the mission radiation budget is used up", () => {
    let m = cleanMission()
    byOcc(m, "scout").missionDoseMsv = m.colony.evaDoseBudgetMsv
    m = advanceMission(m, 2)
    const scout = byOcc(m, "scout")
    expect(hasStatus(scout, "grounded")).toBe(true)
    expect(scout.activity).toBe("idle")
    expect(scout.task).toMatch(/Radiation Limit/)
  })

  it("waits out dust storms when told to, and goes out anyway when not", () => {
    const m = cleanMission()
    m.colony.weather.dustStorm = true
    expect(byOcc(stepMission(m), "scout").task).toMatch(/dust storm/)

    byOcc(m, "scout").orders.holdDuringStorms = false
    expect(byOcc(stepMission(m), "scout").activity).toBe("eva")
  })

  it("a solar particle event makes going outside far more dangerous than staying in", () => {
    let calm = cleanMission()
    let spe = cleanMission()
    spe.colony.weather.solarParticleEvent = true
    calm = advanceMission(calm, 3)
    spe = advanceMission(spe, 3)
    expect(byOcc(spe, "scout").missionDoseMsv).toBeGreaterThan(byOcc(calm, "scout").missionDoseMsv * 10)
  })
})

describe("healing", () => {
  it("treats an injured crewmate much faster than natural healing", () => {
    let m = cleanMission()
    const engineer = byOcc(m, "engineer")
    engineer.statuses.push({ id: "injured", sinceHour: 0, treatmentProgress: 0 })
    m = advanceMission(m, 12)
    expect(hasStatus(byOcc(m, "engineer"), "injured")).toBe(false)
    expect(m.log.some((e) => e.text.includes("treated") && e.text.includes(engineer.name))).toBe(true)
  })

  it("treats injuries before stress", () => {
    let m = cleanMission()
    byOcc(m, "engineer").statuses.push({ id: "stressed", sinceHour: 0, treatmentProgress: 0 })
    byOcc(m, "scout").statuses.push({ id: "injured", sinceHour: 0, treatmentProgress: 0 })
    m = stepMission(m)
    expect(byOcc(m, "medic").task).toMatch(/Injured/)
  })

  it("counseling a stressed pawn raises their morale", () => {
    let m = cleanMission()
    const eng = byOcc(m, "engineer")
    eng.needs.morale = 20
    eng.statuses.push({ id: "stressed", sinceHour: 0, treatmentProgress: 0 })
    m = advanceMission(m, 6)
    expect(hasStatus(byOcc(m, "engineer"), "stressed")).toBe(false)
    expect(byOcc(m, "engineer").needs.morale).toBeGreaterThan(40)
  })

  it("cannot fix need-based problems like low oxygen", () => {
    let m = cleanMission()
    m.colony.supplies.oxygenKg = 0
    m = advanceMission(m, 20)
    expect(hasStatus(byOcc(m, "engineer"), "hypoxic")).toBe(true)
    expect(byOcc(m, "medic").task).not.toMatch(/Low Oxygen/)
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
    byOcc(m, "engineer").needs.rest = 10
    m = stepMission(m)
    expect(byOcc(m, "engineer").activity).toBe("sleeping")
    m = advanceMission(m, 6) // 8 h sleep restores rest to full
    expect(byOcc(m, "engineer").activity).toBe("sleeping")
    m = stepMission(m)
    expect(byOcc(m, "engineer").activity).not.toBe("sleeping")
    expect(byOcc(m, "engineer").needs.rest).toBeGreaterThan(90)
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
    byOcc(m, "engineer").orders.enabled = false
    m = advanceMission(m, 4)
    expect(m.colony.constructionQueue[0].workDone).toBe(0)
    expect(byOcc(m, "engineer").task).toBe("Off duty")
  })

  it("working raises skill over time", () => {
    let m = cleanMission()
    m.colony.constructionQueue.push({ id: "x", name: "X", workRequired: 1000, workDone: 0 })
    m = advanceMission(m, 60)
    expect(byOcc(m, "engineer").skills.building.level).toBeGreaterThan(TUNING.startingSkill.trained)
  })

  it("does not mutate the previous mission state", () => {
    const m = cleanMission()
    const snapshot = structuredClone(m)
    stepMission(m)
    expect(m).toEqual(snapshot)
  })
})

describe("occupations and roles", () => {
  it("everyone starts on the role their occupation trained them for, with a higher skill there", () => {
    const m = createMission(11)
    for (const p of m.crew) {
      expect(p.role).toBe(OCCUPATIONS[p.occupation].role)
      expect(isTrainedFor(p)).toBe(true)
      for (const r of ROLE_IDS) {
        const expected = r === p.role ? TUNING.startingSkill.trained : TUNING.startingSkill.untrained
        expect(p.skills[r].level).toBe(expected)
      }
    }
  })

  it("assigning a new role changes the task but never the occupation", () => {
    let m = cleanMission()
    const medic = byOcc(m, "medic")
    m = assignRole(m, medic.id, "scouting")
    const after = byOcc(m, "medic")
    expect(after.occupation).toBe("medic")
    expect(after.role).toBe("scouting")
    expect(after.color).toBe(OCCUPATIONS.medic.color)
    expect(isTrainedFor(after)).toBe(false)
    expect(m.log.at(-1)!.text).toMatch(/is now Scouting/)
  })

  it("any occupation can do any role: a medic sent scouting goes outside", () => {
    let m = cleanMission()
    m = assignRole(m, byOcc(m, "medic").id, "scouting")
    m = stepMission(m)
    expect(byOcc(m, "medic").activity).toBe("eva")
  })

  it("a matching occupation gives exactly the match bonus at equal skill", () => {
    const m = cleanMission()
    const engineer = byOcc(m, "engineer")
    const medic = byOcc(m, "medic")
    medic.skills.building.level = engineer.skills.building.level
    medic.needs.morale = engineer.needs.morale
    medic.role = "building"
    expect(workSpeed(engineer) / workSpeed(medic)).toBeCloseTo(TUNING.occupationMatchBonus, 8)
  })

  it("a trained engineer builds faster than an untrained crewmate", () => {
    const build = (occupation: OccupationId) => {
      let m = cleanMission(1, [occupation])
      m = assignRole(m, m.crew[0].id, "building")
      m.colony.constructionQueue.push({ id: "x", name: "X", workRequired: 1000, workDone: 0 })
      return advanceMission(m, 6).colony.constructionQueue[0].workDone
    }
    expect(build("engineer")).toBeGreaterThan(build("researcher"))
  })

  it("experience goes to the skill of the role being done, not the occupation's", () => {
    let m = cleanMission()
    const medic = byOcc(m, "medic")
    m = assignRole(m, medic.id, "building")
    m.colony.constructionQueue.push({ id: "x", name: "X", workRequired: 1000, workDone: 0 })
    m = advanceMission(m, 12)
    const after = byOcc(m, "medic")
    expect(after.skills.building.level).toBeGreaterThan(TUNING.startingSkill.untrained)
    expect(after.skills.healing.level).toBe(TUNING.startingSkill.trained)
    expect(after.skills.healing.xp).toBe(0)
  })

  it("trait bonuses follow the role, not the occupation", () => {
    const m = cleanMission()
    const scout = byOcc(m, "scout")
    const base = workSpeed(scout, "researching")
    scout.traits = ["curious"]
    expect(workSpeed(scout, "researching") / base).toBeCloseTo(TRAITS.curious.modifiers.roleBonus!.researching!, 8)
  })

  it("ignores role changes for evacuated crew", () => {
    const m = cleanMission()
    byOcc(m, "medic").evacuated = { hour: 0, reason: "test" }
    expect(assignRole(m, byOcc(m, "medic").id, "building")).toBe(m)
  })
})

describe("traits that dislike each other", () => {
  /** Engineer is Chatty, researcher is Quiet: they clash. */
  function clashMission(): Mission {
    const m = cleanMission()
    byOcc(m, "engineer").traits = ["chatty"]
    byOcc(m, "researcher").traits = ["quiet"]
    return m
  }
  const work = (m: Mission) => {
    m.colony.constructionQueue.push({ id: "x", name: "X", workRequired: 1000, workDone: 0 })
    m.colony.researchQueue.push({ id: "y", name: "Y", workRequired: 1000, workDone: 0 })
    return m
  }

  it("a dislike works in both directions", () => {
    const m = clashMission()
    expect(dislikesEachOther(byOcc(m, "engineer"), byOcc(m, "researcher"))).toBe(true)
    expect(dislikesEachOther(byOcc(m, "researcher"), byOcc(m, "engineer"))).toBe(true)
    expect(dislikesEachOther(byOcc(m, "engineer"), byOcc(m, "medic"))).toBe(false)
  })

  it("working the same role together causes friction for both and lowers morale", () => {
    let m = work(clashMission())
    m = assignRole(m, byOcc(m, "researcher").id, "building")
    m = advanceMission(m, 6)
    for (const occ of ["engineer", "researcher"] as const) {
      expect(hasStatus(byOcc(m, occ), "friction")).toBe(true)
    }
    expect(hasStatus(byOcc(m, "medic"), "friction")).toBe(false)
    expect(m.log.filter((e) => e.text.includes("getting on each other's nerves"))).toHaveLength(1)

    let calm = work(cleanMission())
    calm = assignRole(calm, byOcc(calm, "researcher").id, "building")
    calm = advanceMission(calm, 6)
    expect(byOcc(m, "engineer").needs.morale).toBeLessThan(byOcc(calm, "engineer").needs.morale)
  })

  it("hanging out idle together also causes friction (socializing)", () => {
    const m = stepMission(clashMission()) // nothing queued: both idle in the base
    expect(hasStatus(byOcc(m, "engineer"), "friction")).toBe(true)
  })

  it("no friction when they work on different tasks, and it clears once separated", () => {
    let m = work(clashMission())
    m = stepMission(m)
    expect(hasStatus(byOcc(m, "engineer"), "friction")).toBe(false)

    m = assignRole(m, byOcc(m, "researcher").id, "building")
    m = stepMission(m)
    expect(hasStatus(byOcc(m, "engineer"), "friction")).toBe(true)
    m = assignRole(m, byOcc(m, "researcher").id, "researching")
    m = stepMission(m)
    expect(hasStatus(byOcc(m, "engineer"), "friction")).toBe(false)
    expect(hasStatus(byOcc(m, "researcher"), "friction")).toBe(false)
  })

  it("sleeping crewmates aren't together", () => {
    const m = clashMission()
    byOcc(m, "engineer").needs.rest = 5
    const after = stepMission(m)
    expect(byOcc(after, "engineer").activity).toBe("sleeping")
    expect(hasStatus(byOcc(after, "researcher"), "friction")).toBe(false)
  })

  it("never rolls a crewmate who dislikes their own traits", () => {
    for (let seed = 0; seed < 200; seed++) {
      for (const p of createMission(seed).crew) expect(dislikesEachOther(p, p)).toBe(false)
    }
  })
})
