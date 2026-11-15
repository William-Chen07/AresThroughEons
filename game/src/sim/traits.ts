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
  /** Traits that can never be rolled on the SAME crewmate. Checked both ways. */
  conflictsWith?: TraitId[]
  /**
   * Traits this one doesn't get along with on OTHER crewmates. When two such
   * crewmates are together (see areTogether), only the crewmate with THIS trait
   * gets "Not Getting Along", which lowers morale. One-way: the disliked crewmate
   * isn't affected unless their own traits dislike back.
   * Separate from conflictsWith: one crewmate CAN have two traits that dislike
   * each other, and never clashes with themself.
   */
  dislikes?: TraitId[]
}

export const TRAITS: Record<TraitId, TraitDef> = {
  hardWorker: {
    id: "hardWorker",
    name: "Hard Worker",
    description: "Works faster, but gets tired sooner.",
    modifiers: { workSpeed: 1.2, needDecay: { rest: 1.25 } },
    dislikes: ["clumsy", "tooSmart"], // has to redo work after clumsy mistakes
  },
  calm: {
    id: "calm",
    name: "Calm",
    description: "Stays cheerful even when things get tough.",
    modifiers: { moraleBase: 10 },
    conflictsWith: ["homesick"],
    dislikes: ["tooSmart"],
  },
  curious: {
    id: "curious",
    name: "Curious",
    description: "Loves discovering things: better at research and scouting.",
    modifiers: { roleBonus: { researching: 1.25, scouting: 1.15 } },
    dislikes: ["tooSmart"],
  },
  tough: {
    id: "tough",
    name: "Tough",
    description: "Hard to hurt and heals quickly.",
    modifiers: { injuryChance: 0.5, healthRegen: 1.5 },
    conflictsWith: ["clumsy"],
    dislikes: ["tooSmart"],
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
    dislikes: [
      "chatty", // keeps talking at bedtime
      "bigAppetite", // midnight snacking wakes them up
       ],
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
    dislikes: ["clumsy", "tooSmart"], // careful people get frustrated by clumsy mistakes
  },
  chatty: {
    id: "chatty",
    name: "Chatty",
    description: "Loves to talk, which keeps their spirits up.",
    modifiers: { moraleBase: 5 },
    conflictsWith: ["quiet"],
    dislikes: ["quiet"], // feels ignored by quiet crewmates
  },
  quiet: {
    id: "quiet",
    name: "Quiet",
    description: "Likes peace and quiet, and focuses well on research.",
    modifiers: { roleBonus: { researching: 1.15 } },
    conflictsWith: ["chatty"],
    dislikes: ["curious", "tooSmart"], // asks too many questions while they're trying to focus
  },
  quickLearner: {
    id: "quickLearner",
    name: "Quick Learner",
    description: "Gets better at their job faster.",
    modifiers: { xpGain: 1.5 },
    dislikes: ["tooSmart", "clumsy"],
  },
   weak: {
    id: "weak",
    name: "Weak",
    description: "Extremely sensitive to pain.",
    modifiers: { roleBonus: { building: 0.8 }, moraleBase: 10 },
    dislikes: [ "tough"],
    conflictsWith: ["tough"],
  },
  tooSmart: {
    id: "tooSmart",
    name: "Too Smart",
    description: "Extremely intelligent, not fun to be around.",
    modifiers: { injuryChance: 1.75, moraleBase: 10},

  },
  heavyBreather: {
    id: "heavyBreather",
    name: "Heavy Breather",
    description: "Their condition makes it hard to breathe.",
    modifiers: {  needDecay: { oxygen: 1.3 }},
  },
  techy: {
    id: "techy",
    name: "Techy",
    description: "They love working with machines and modules.",
    modifiers: {  roleBonus: { building: 1.2 }},
  },
  egotistical: {
    id: "egotistical",
    name: "Egotistical",
    description: "They think they are better than everybody else.",
    modifiers: { roleBonus: { researching: 1.12, scouting: 1.12, building: 1.12, healing: 1.12 }, xpGain: 1.12},
    dislikes: ["hardWorker", "calm", "curious", "tough", "clumsy", "bigAppetite", "lightSleeper", "homesick", "steadyHands", "quickLearner", "chatty", "quiet", "weak", "tooSmart", "linear", "hermit", "heavyBreather", "overAchiever", "techy"],
  },
  linear: {
    id: "linear",
    name: "Linear",
    description: "They will not stop doing something until its done",
    modifiers: {  roleBonus: { building: 1.2 }},
  },
  hermit: {
    id: "hermit",
    name: "Hermit",
    description: "They love staying inside at all times.",
    modifiers: {  roleBonus: { building: 1.2 }},
  },
  overAchiever: {
    id: "overAchiever",
    name: "Over Achiever",
    description: "They always try to do more than instructed",
    modifiers: {  roleBonus: { building: 1.2 }},
  }

}

export const TRAIT_IDS = Object.keys(TRAITS) as TraitId[]
