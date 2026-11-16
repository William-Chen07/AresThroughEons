import { describe, expect, it } from "vitest"
import { STATUSES, TRAITS, TRAIT_IDS, type TraitDef } from "@/sim"
import { statusEffects } from "@/sim/statusInfo"
import { traitDislikes, traitEffects } from "@/sim/traitInfo"

const made = (modifiers: TraitDef["modifiers"], dislikes?: TraitDef["dislikes"]): TraitDef => ({
  id: "calm",
  name: "Test",
  description: "",
  modifiers,
  dislikes,
})

describe("traits in plain words (trait cards)", () => {
  it("says what the numbers do, faster or slower", () => {
    expect(traitEffects(made({ workSpeed: 1.2, needDecay: { rest: 1.25 } }))).toEqual([
      "Works 20% faster",
      "Gets tired 25% faster",
    ])
    expect(traitEffects(made({ workSpeed: 0.8, injuryChance: 0.5, moraleBase: -5 }))).toEqual([
      "Works 20% slower",
      "Mood stays 5 points lower",
      "50% less likely to get hurt outside",
    ])
    expect(traitEffects(made({ roleBonus: { researching: 1.25 } }))).toEqual(["25% faster at Researching"])
  })

  it("the same bonus at every job is said once", () => {
    const all = made({ roleBonus: { building: 1.1, scouting: 1.1, researching: 1.1, healing: 1.1 } })
    expect(traitEffects(all)).toEqual(["10% faster at every job"])
  })

  it("a trait with no numbers yet has no effects", () => {
    expect(traitEffects(made({}))).toEqual([])
  })

  it("every real trait can be described without errors", () => {
    for (const id of TRAIT_IDS) {
      for (const line of traitEffects(TRAITS[id])) expect(line).not.toMatch(/undefined|NaN|\{p\}/)
    }
  })

  it("lists who they don't get along with, by name, or everyone for Egotistical", () => {
    expect(traitDislikes(made({}, ["clumsy", "tooSmart"]))).toEqual([TRAITS.clumsy.name, TRAITS.tooSmart.name])
    expect(traitDislikes(made({}))).toBeNull()
    expect(traitDislikes(TRAITS.egotistical)).toBe("everyone")
  })
})

describe("statuses in plain words (status cards)", () => {
  it("says what a status does while a crewmate has it", () => {
    expect(statusEffects(STATUSES.hungry)).toEqual(["Mood drops by 8", "Works 10% slower"])
    expect(statusEffects(STATUSES.injured)).toContain("A crewmate on Healing can treat it")
  })

  it("every real status can be described without errors, and has a fix", () => {
    for (const status of Object.values(STATUSES)) {
      for (const line of statusEffects(status)) expect(line).not.toMatch(/undefined|NaN/)
      expect(status.fix.length).toBeGreaterThan(0)
    }
  })
})
