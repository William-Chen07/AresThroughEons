import { describe, expect, it } from "vitest"
import { startingResources, type Resources } from "@/content/resources"
import {
  SUPPLY_PER_ASTRONAUT_DAY,
  cannotExplore,
  crewMorale,
  hurtOnTrip,
  liveCrewThrough,
  newCrew,
  RESEARCHER_SPEED,
  researchRate,
  returningCrew,
  urgentNeedOf,
  type LiveCrewInput,
} from "@/sim/crewLife"
import type { CrewMember } from "@/sim/lifeSupport"
import { hasStatus, NASA_DATA, TUNING, type Pawn } from "@/sim"

/** A crew with no traits (so numbers are predictable), everyone inside a pressurized module. */
function setup(size = 4) {
  const crew = newCrew(1, () => 0.42).slice(0, size)
  for (const p of crew) p.traits = []
  const atBase: CrewMember[] = crew.map((p) => ({ id: p.id, outside: false, pressurized: true }))
  return { crew, atBase, resources: startingResources() }
}

/** Runs `hours` of game time in small steps, like the map does (about 0.15 h a second). */
function live(input: Omit<LiveCrewInput, "hours" | "clock">, hours: number, step = 0.5) {
  let crew = input.crew as Pawn[]
  let resources = input.resources
  const evacuated: string[] = []
  const log: string[] = []
  for (let t = 0; t < hours; t += step) {
    const r = liveCrewThrough({ ...input, crew, resources, hours: step, clock: t, random: input.random ?? (() => 0.99) })
    crew = r.crew
    resources = r.resources
    evacuated.push(...r.evacuated)
    log.push(...r.log.map((e) => e.text))
  }
  return { crew, resources, evacuated, log }
}

const byId = (crew: Pawn[], id: string) => crew.find((p) => p.id === id)!

describe("getting hurt", () => {
  it("an accident costs health at once and leaves them injured, outside or in", () => {
    const { crew, resources } = setup(2)
    const [out, inn] = crew
    const atBase: CrewMember[] = [
      { id: out.id, outside: true, pressurized: false },
      { id: inn.id, outside: false, pressurized: true },
    ]
    // random() = 0 makes every chance happen.
    const r = liveCrewThrough({ crew, resources, atBase, away: [], storm: null, hours: 0.5, clock: 0, random: () => 0 })
    for (const p of [out, inn]) {
      const after = byId(r.crew, p.id)
      expect(hasStatus(after, "injured")).toBe(true)
      expect(after.health).toBeLessThanOrEqual(p.health - TUNING.injuryHealthLoss + 1)
    }
    expect(r.log.some((e) => e.text.includes("slipped on the rocks"))).toBe(true)
    expect(r.log.some((e) => e.text.includes("tripped inside the base"))).toBe(true)
  })

  it("a clumsy crewmate slips more often, and the message says so", () => {
    const { crew, resources } = setup(1)
    const [p] = crew
    const atBase: CrewMember[] = [{ id: p.id, outside: true, pressurized: false }]
    // A roll just above the ordinary chance: only the clumsy one slips.
    const roll = TUNING.injuryChancePerHour * 0.5 * 1.2
    const plain = liveCrewThrough({ crew, resources, atBase, away: [], storm: null, hours: 0.5, clock: 0, random: () => roll })
    expect(hasStatus(byId(plain.crew, p.id), "injured")).toBe(false)
    const clumsy = [{ ...p, traits: ["clumsy" as const] }]
    const r = liveCrewThrough({ crew: clumsy, resources, atBase, away: [], storm: null, hours: 0.5, clock: 0, random: () => roll })
    expect(hasStatus(byId(r.crew, p.id), "injured")).toBe(true)
    expect(r.log.some((e) => e.text.startsWith("Being clumsy,"))).toBe(true)
  })

  it("nobody gets hurt in their sleep", () => {
    const { crew, resources, atBase } = setup(1)
    crew[0].needs.rest = 5
    const r = liveCrewThrough({ crew, resources, atBase, away: [], storm: null, hours: 0.5, clock: 0, random: () => 0 })
    expect(byId(r.crew, crew[0].id).activity).toBe("sleeping")
    expect(hasStatus(byId(r.crew, crew[0].id), "injured")).toBe(false)
  })
})
const used = (before: Resources, after: Resources, id: keyof Resources) => before[id] - after[id]

describe("crew in the real game (crewLife)", () => {
  it("each era's crew has one of each occupation and ids unique to the era", () => {
    const a = newCrew(1)
    const b = newCrew(2)
    expect(a.map((p) => p.occupation).sort()).toEqual(["engineer", "medic", "researcher", "scout"])
    expect(a.every((p) => p.id.startsWith("era1-"))).toBe(true)
    expect(b.every((p) => p.id.startsWith("era2-"))).toBe(true)
  })

  it("a new era brings the same crew back, healed, plus one new astronaut", () => {
    const old = newCrew(1, () => 0.42)
    const [hurt] = old
    hurt.health = 10
    hurt.needs.food = 0
    hurt.missionDoseMsv = 40
    hurt.careerDoseMsv = 55
    hurt.skills.building = { level: 4, xp: 12 }
    hurt.statuses = [{ id: "starving", sinceHour: 3, treatmentProgress: 0 }]
    hurt.evacuated = { hour: 30, reason: "starving" }

    const { crew, recruit } = returningCrew(old, 2, () => 0.42)
    expect(crew).toHaveLength(old.length + 1)
    expect(crew.slice(0, old.length).map((p) => [p.id, p.name, p.occupation, p.traits])).toEqual(
      old.map((p) => [p.id, p.name, p.occupation, p.traits]),
    )
    const back = byId(crew, hurt.id)
    expect(back.evacuated).toBeNull()
    expect(back.health).toBe(100)
    expect(back.needs.food).toBe(100)
    expect(back.statuses).toEqual([])
    expect(back.missionDoseMsv).toBe(0)
    expect(back.careerDoseMsv).toBe(55)
    expect(back.skills.building).toEqual({ level: 4, xp: 12 })
    // The old crew isn't changed.
    expect(hurt.health).toBe(10)

    expect(recruit.id).toBe("era2-0")
    expect(crew[crew.length - 1]).toBe(recruit)
    expect(old.map((p) => p.name)).not.toContain(recruit.name)
    expect(recruit.evacuated).toBeNull()
  })

  it("the crew grows by one each era, the recruit in an occupation the crew has fewest of", () => {
    let crew = newCrew(1)
    for (let era = 2; era <= 6; era++) {
      const before = crew
      const result = returningCrew(before, era)
      crew = result.crew
      expect(crew).toHaveLength(4 + era - 1)
      const counts = (occupation: string) => before.filter((p) => p.occupation === occupation).length
      const fewest = Math.min(...["engineer", "medic", "researcher", "scout"].map(counts))
      expect(counts(result.recruit.occupation)).toBe(fewest)
      expect(new Set(crew.map((p) => p.id)).size).toBe(crew.length)
      expect(new Set(crew.map((p) => p.name)).size).toBe(crew.length)
    }
  })

  it("draws oxygen, water and food from the resource bar at the game rate", () => {
    const { crew, atBase, resources } = setup(1)
    const after = live({ crew, atBase, resources, away: [], storm: null }, 48)
    for (const id of ["oxygen", "water", "food"] as const) {
      expect(used(resources, after.resources, id) / 2).toBeCloseTo(SUPPLY_PER_ASTRONAUT_DAY[id], 0)
    }
  })

  it("uses oxygen twice as fast outside a pressurized module", () => {
    const { crew, resources } = setup(1)
    const inside = live({ crew, atBase: [{ id: crew[0].id, outside: false, pressurized: true }], resources, away: [], storm: null }, 24)
    const unpressurized = live({ crew, atBase: [{ id: crew[0].id, outside: false, pressurized: false }], resources, away: [], storm: null }, 24)
    expect(used(resources, unpressurized.resources, "oxygen")).toBeGreaterThan(used(resources, inside.resources, "oxygen") * 1.8)
  })

  it("outside gets the real surface dose; inside the habitat blocks some of it", () => {
    const { crew, resources } = setup(2)
    const [a, b] = crew
    const r = live(
      { crew, resources, away: [], storm: null, atBase: [{ id: a.id, outside: true, pressurized: false }, { id: b.id, outside: false }] },
      10,
    )
    expect(byId(r.crew, a.id).missionDoseMsv).toBeCloseTo((NASA_DATA.surfaceDoseMsvPerDay / 24) * 10, 6)
    expect(byId(r.crew, b.id).missionDoseMsv).toBeCloseTo((NASA_DATA.surfaceDoseMsvPerDay / 24) * 10 * (1 - TUNING.habitatShielding), 6)
  })

  it("a radiation storm hurts and irradiates crew outside, and only adds dose inside", () => {
    const { crew, resources } = setup(2)
    const [out, inn] = crew
    const storm = { hours: 0.5, healthLostPerHourOutside: 10, name: "Radiation Storm" }
    const r = live(
      { crew, resources, away: [], storm, atBase: [{ id: out.id, outside: true, pressurized: false }, { id: inn.id, outside: false }] },
      3,
    )
    expect(byId(r.crew, out.id).health).toBeLessThan(75)
    expect(byId(r.crew, inn.id).health).toBe(100)
    expect(hasStatus(byId(r.crew, out.id), "grounded")).toBe(false) // 3 h isn't quite enough...
    const longer = live(
      { crew: r.crew, resources, away: [], storm, atBase: [{ id: out.id, outside: true, pressurized: false }] },
      2,
    )
    expect(hasStatus(byId(longer.crew, out.id), "grounded")).toBe(true) // ...5 h is
  })

  it("staying outside through a storm ends in evacuation, named after the storm", () => {
    const { crew, resources } = setup(1)
    const storm = { hours: 0.5, healthLostPerHourOutside: 10, name: "Radiation Storm" }
    const r = live({ crew, resources, away: [], storm, atBase: [{ id: crew[0].id, outside: true, pressurized: false }] }, 12)
    expect(r.evacuated).toEqual([crew[0].id])
    expect(byId(r.crew, crew[0].id).evacuated?.reason).toBe("Radiation Storm")
  })

  it("running out of oxygen leads to evacuation, not death", () => {
    const { crew, atBase } = setup(2)
    const resources = { ...startingResources(), oxygen: 0 }
    const r = live({ crew, atBase, resources, away: [], storm: null }, 48)
    expect(r.evacuated.sort()).toEqual(crew.map((p) => p.id).sort())
    for (const p of r.crew) expect(p.evacuated?.reason).toBe("Low Oxygen")
  })

  it("crew out exploring use their own supplies, dodge base storms, and practise Scouting", () => {
    const { crew, resources } = setup(1)
    const storm = { hours: 0.5, healthLostPerHourOutside: 10, name: "Radiation Storm" }
    const r = live({ crew, resources, away: [crew[0].id], atBase: [], storm }, 12)
    expect(r.resources.oxygen).toBe(resources.oxygen)
    expect(byId(r.crew, crew[0].id).health).toBe(100)
    expect(byId(r.crew, crew[0].id).missionDoseMsv).toBeCloseTo((NASA_DATA.surfaceDoseMsvPerDay / 24) * 12, 6)
    const practice = (p: Pawn) => p.skills.scouting.level * 1000 + p.skills.scouting.xp
    expect(practice(byId(r.crew, crew[0].id))).toBeGreaterThan(practice(crew[0]))
  })

  it("crew the game can't place (not on the map, not exploring) are left alone", () => {
    const { crew, resources } = setup(1)
    const r = live({ crew, resources, away: [], atBase: [], storm: null }, 10)
    expect(r.crew).toEqual(crew)
    for (const id of ["oxygen", "water", "food"] as const) expect(r.resources[id]).toBe(resources[id])
  })

  it("chatting with someone you dislike causes friction; dislike stays one-way", () => {
    const { crew, resources } = setup(2)
    const [chatty, quiet] = crew
    chatty.traits = ["chatty"]
    quiet.traits = ["quiet"]
    const atBase = [
      { id: chatty.id, outside: false, chattingWith: quiet.id },
      { id: quiet.id, outside: false, chattingWith: chatty.id },
    ]
    const r = live({ crew, resources, away: [], atBase, storm: null }, 1)
    expect(hasStatus(byId(r.crew, chatty.id), "friction")).toBe(true)
    expect(hasStatus(byId(r.crew, quiet.id), "friction")).toBe(false)
  })

  it("working in the same module counts as together; different modules don't", () => {
    const { crew, resources } = setup(2)
    const [a, b] = crew
    a.traits = ["chatty"]
    b.traits = ["quiet"]
    const same = live({ crew, resources, away: [], storm: null, atBase: [{ id: a.id, outside: false, workingAt: "module:lab" }, { id: b.id, outside: false, workingAt: "module:lab" }] }, 1)
    const apart = live({ crew, resources, away: [], storm: null, atBase: [{ id: a.id, outside: false, workingAt: "module:lab" }, { id: b.id, outside: false, workingAt: "module:hab" }] }, 1)
    expect(hasStatus(byId(same.crew, a.id), "friction")).toBe(true)
    expect(hasStatus(byId(apart.crew, a.id), "friction")).toBe(false)
  })

  it("the crewmate assigned to Healing treats injuries at the base", () => {
    const { crew, atBase, resources } = setup(4)
    const medic = crew.find((p) => p.occupation === "medic")!
    const patient = crew.find((p) => p.occupation === "engineer")!
    patient.statuses.push({ id: "injured", sinceHour: 0, treatmentProgress: 0 })
    const r = live({ crew, atBase, resources, away: [], storm: null }, 10)
    expect(hasStatus(byId(r.crew, patient.id), "injured")).toBe(false)
    expect(r.log.some((t) => t.includes(medic.name) && t.includes("treated"))).toBe(true)
  })

  it("the morale bar shows the crew's average morale", () => {
    const { crew, atBase, resources } = setup(2)
    crew[0].needs.morale = 40
    crew[1].needs.morale = 80
    const r = liveCrewThrough({ crew, atBase, resources, away: [], storm: null, hours: 0.01, clock: 0 })
    expect(r.resources.morale).toBe(crewMorale(r.crew))
    expect(r.resources.morale).toBeGreaterThan(55)
    expect(r.resources.morale).toBeLessThan(65)
  })

  it("trip accidents hurt (never below 1) and injure", () => {
    const { crew } = setup(1)
    crew[0].health = 5
    const r = hurtOnTrip(crew, [crew[0].id], 10, 3)
    expect(r.crew[0].health).toBe(1)
    expect(hasStatus(r.crew[0], "injured")).toBe(true)
  })
})

describe("crew rules steering the map (urgent needs)", () => {
  const none = () => false
  const all = () => true

  it("a storm, an injury, or the radiation limit sends a crewmate inside", () => {
    const [p] = newCrew(1)
    expect(urgentNeedOf(p, false, all)).toBeNull()
    expect(urgentNeedOf(p, true, all)).toBe("shelter")
    expect(urgentNeedOf({ ...p, statuses: [{ id: "injured", sinceHour: 0, treatmentProgress: 0 }] }, false, all)).toBe("shelter")
    expect(urgentNeedOf({ ...p, statuses: [{ id: "grounded", sinceHour: 0, treatmentProgress: 0 }] }, false, all)).toBe("shelter")
  })

  it("low oxygen sends them to a pressurized module if there is one, otherwise inside", () => {
    const [p] = newCrew(1)
    const hypoxic = { ...p, statuses: [{ id: "hypoxic" as const, sinceHour: 0, treatmentProgress: 0 }] }
    expect(urgentNeedOf(hypoxic, false, all)).toBe("oxygen")
    expect(urgentNeedOf(hypoxic, false, none)).toBe("shelter")
  })

  it("sleeping crew go to bed in a Habitat, or at least inside when there isn't one", () => {
    const [p] = newCrew(1)
    const asleep = { ...p, activity: "sleeping" as const }
    expect(urgentNeedOf(asleep, false, all)).toBe("rest")
    expect(urgentNeedOf(asleep, false, none)).toBe("shelter")
    // A bed is indoors, so it shelters them from a storm too.
    expect(urgentNeedOf(asleep, true, all)).toBe("rest")
  })

  it("a Researcher researches faster than anyone else, and nobody researches asleep", () => {
    const crew = newCrew(1)
    const researcher = crew.find((p) => p.occupation === "researcher")!
    const engineer = crew.find((p) => p.occupation === "engineer")!
    expect(researchRate(researcher)).toBe(RESEARCHER_SPEED)
    expect(researchRate(engineer)).toBe(1)
    expect(researchRate({ ...researcher, activity: "sleeping" })).toBe(0)
  })

  it("says why someone can't go exploring", () => {
    const [p] = newCrew(1)
    expect(cannotExplore(p)).toBeNull()
    expect(cannotExplore({ ...p, statuses: [{ id: "grounded", sinceHour: 0, treatmentProgress: 0 }] })).toBe("Must stay inside")
    expect(cannotExplore({ ...p, activity: "sleeping" })).toBe("Sleeping")
    expect(cannotExplore({ ...p, evacuated: { hour: 0, reason: "x" } })).toBe("Evacuated")
  })
})
