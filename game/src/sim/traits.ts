import type { NeedId, RoleId, TraitId } from "./types"

export interface TraitModifiers {
  /** Multiplies all work speed. */
  workSpeed?: number
  /** Multiplies work speed only while assigned to this role. */
  roleBonus?: Partial<Record<RoleId, number>>
  /** Multiplies how fast a need drains. */
  needDecay?: Partial<Record<NeedId, number>>
  /** Multiplies how fast sleep refills rest. */
  restRecovery?: number
  /** Added to the morale the pawn drifts toward. */
  moraleBase?: number
  /** Multiplies the chance of getting hurt outside. */
  injuryChance?: number
  /** Multiplies natural health regeneration. */
  healthRegen?: number
  /** Multiplies skill experience gained. */
  xpGain?: number
}

export interface TraitDef {
  id: TraitId
  name: string
  /** Kid-facing, one sentence. */
  description: string
  modifiers: TraitModifiers
  conflictsWith?: TraitId[]
}

export const TRAITS: Record<TraitId, TraitDef> = {
  hardWorker: {
    id: "hardWorker",
    name: "Hard Worker",
    description: "Works faster, but gets tired sooner.",
    modifiers: { workSpeed: 1.2, needDecay: { rest: 1.25 } },
  },
  calm: {
    id: "calm",
    name: "Calm",
    description: "Stays cheerful even when things get tough.",
    modifiers: { moraleBase: 10 },
    conflictsWith: ["homesick"],
  },
  curious: {
    id: "curious",
    name: "Curious",
    description: "Loves discovering things: better at research and scouting.",
    modifiers: { roleBonus: { researching: 1.25, scouting: 1.15 } },
  },
  tough: {
    id: "tough",
    name: "Tough",
    description: "Hard to hurt and heals quickly.",
    modifiers: { injuryChance: 0.5, healthRegen: 1.5 },
    conflictsWith: ["clumsy"],
  },
  clumsy: {
    id: "clumsy",
    name: "Clumsy",
    description: "More likely to get hurt when working outside.",
    modifiers: { injuryChance: 1.75 },
    conflictsWith: ["tough", "steadyHands"],
  },
  bigAppetite: {
    id: "bigAppetite",
    name: "Big Appetite",
    description: "Gets hungry faster, so eats more of the food supply.",
    modifiers: { needDecay: { food: 1.3 } },
  },
  lightSleeper: {
    id: "lightSleeper",
    name: "Light Sleeper",
    description: "Needs more time in bed to feel rested.",
    modifiers: { restRecovery: 0.8 },
  },
  homesick: {
    id: "homesick",
    name: "Homesick",
    description: "Misses Earth, so morale is lower.",
    modifiers: { moraleBase: -12 },
    conflictsWith: ["calm"],
  },
  steadyHands: {
    id: "steadyHands",
    name: "Steady Hands",
    description: "Careful and precise: better at healing and building.",
    modifiers: { roleBonus: { healing: 1.25, building: 1.15 } },
    conflictsWith: ["clumsy"],
  },
  quickLearner: {
    id: "quickLearner",
    name: "Quick Learner",
    description: "Gets better at their job faster.",
    modifiers: { xpGain: 1.5 },
  },
}

export const TRAIT_IDS = Object.keys(TRAITS) as TraitId[]
