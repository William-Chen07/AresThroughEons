import type { StatusId } from "./types"

export interface StatusDef {
  id: StatusId
  label: string
  /** Kid-facing explanation of what is happening. */
  description: string
  /** Kid-facing hint for how to fix it. */
  fix: string
  severity: "mild" | "serious"
  /** Can a medic treat this? Need-based statuses are fixed with supplies or sleep instead. */
  treatable: boolean
  /** Hours of medic work to cure (medic speed applies). */
  treatmentHours?: number
  /** Medics treat the highest priority first. */
  treatmentPriority?: number
  moralePenalty: number
  healthDamagePerHour: number
  /** Multiplies work speed while active. */
  workMultiplier: number
  /** Pawn can't go outside on EVA (extravehicular activity, a spacewalk on the surface). */
  blocksEva: boolean
}

export const STATUSES: Record<StatusId, StatusDef> = {
  hungry: {
    id: "hungry",
    label: "Hungry",
    description: "Their stomach is rumbling.",
    fix: "Keep food in the supplies.",
    severity: "mild",
    treatable: false,
    moralePenalty: 8,
    healthDamagePerHour: 0,
    workMultiplier: 0.9,
    blocksEva: false,
  },
  starving: {
    id: "starving",
    label: "Starving",
    description: "No food left. Their body is getting weaker.",
    fix: "Get more food!",
    severity: "serious",
    treatable: false,
    moralePenalty: 20,
    healthDamagePerHour: 1.5,
    workMultiplier: 0.6,
    blocksEva: false,
  },
  thirsty: {
    id: "thirsty",
    label: "Thirsty",
    description: "They need a drink soon.",
    fix: "Keep water in the supplies.",
    severity: "mild",
    treatable: false,
    moralePenalty: 8,
    healthDamagePerHour: 0,
    workMultiplier: 0.9,
    blocksEva: false,
  },
  dehydrated: {
    id: "dehydrated",
    label: "Dehydrated",
    description: "No water left. Bodies can't last long without it.",
    fix: "Send explorers to dig up ice: it melts into water.",
    severity: "serious",
    treatable: false,
    moralePenalty: 25,
    healthDamagePerHour: 3,
    workMultiplier: 0.5,
    blocksEva: false,
  },
  hypoxic: {
    id: "hypoxic",
    label: "Low Oxygen",
    description: "Not enough oxygen to breathe. Mars air is almost all carbon dioxide.",
    fix: "Refill the oxygen supply. A doctor can't make oxygen!",
    severity: "serious",
    treatable: false,
    moralePenalty: 30,
    healthDamagePerHour: 8,
    workMultiplier: 0.4,
    blocksEva: true,
  },
  tired: {
    id: "tired",
    label: "Tired",
    description: "Working slowly and needs sleep.",
    fix: "They'll go to bed on their own soon.",
    severity: "mild",
    treatable: false,
    moralePenalty: 8,
    healthDamagePerHour: 0,
    workMultiplier: 0.8,
    blocksEva: false,
  },
  grounded: {
    id: "grounded",
    label: "Radiation Limit",
    description:
      "They've soaked up this mission's safe amount of space radiation, so they must stay inside the shielded habitat.",
    fix: "Radiation can't be healed away. Better shielding and shorter trips outside prevent it.",
    severity: "serious",
    treatable: false,
    moralePenalty: 5,
    healthDamagePerHour: 0,
    workMultiplier: 1,
    blocksEva: true,
  },
  friction: {
    id: "friction",
    label: "Not Getting Along",
    description: "Is around a crewmate they don't like.",
    fix: "Give them different tasks so they spend less time together.",
    severity: "mild",
    treatable: false,
    moralePenalty: 8,
    healthDamagePerHour: 0,
    workMultiplier: 1,
    blocksEva: false,
  },
  injured: {
    id: "injured",
    label: "Injured",
    description: "Got hurt outside. Working slowly and can't go on EVA.",
    fix: "A medic can patch them up. Otherwise it heals slowly on its own.",
    severity: "serious",
    treatable: true,
    treatmentHours: 6,
    treatmentPriority: 2,
    moralePenalty: 15,
    healthDamagePerHour: 0,
    workMultiplier: 0.6,
    blocksEva: true,
  },
  stressed: {
    id: "stressed",
    label: "Stressed",
    description: "Feeling down and far from home. Working slowly.",
    fix: "A medic can talk it through with them, or fix what's making them unhappy.",
    severity: "mild",
    treatable: true,
    treatmentHours: 3,
    treatmentPriority: 1,
    moralePenalty: 0, // caused by low morale, so no extra penalty (avoids a death spiral)
    healthDamagePerHour: 0,
    workMultiplier: 0.75,
    blocksEva: false,
  },
}
