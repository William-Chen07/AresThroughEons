import type { OccupationId, RoleId } from "./types"

/**
 * Occupation = what a crewmate trained for on Earth. Fixed at spawn, never changes.
 * Decides suit color, starting skills, and which role gets the "trained for this" bonus.
 */
export interface OccupationDef {
  id: OccupationId
  name: string
  /** Kid-facing, one sentence. */
  description: string
  /** Suit color. Same pawn template, different color per occupation. */
  color: string
  /** The role this occupation is trained for. Doing it gives TUNING.occupationMatchBonus. */
  role: RoleId
}

export const OCCUPATIONS: Record<OccupationId, OccupationDef> = {
  engineer: {
    id: "engineer",
    name: "Engineer",
    description: "Trained to build and fix the base's modules.",
    color: "#f97316",
    role: "building",
  },
  scout: {
    id: "scout",
    name: "Scout",
    description: "Trained to explore the Martian surface and find useful materials.",
    color: "#22c55e",
    role: "scouting",
  },
  researcher: {
    id: "researcher",
    name: "Researcher",
    description: "Trained to study Mars and invent new technology.",
    color: "#3b82f6",
    role: "researching",
  },
  medic: {
    id: "medic",
    name: "Medic",
    description: "Trained to keep the crew healthy.",
    color: "#e5e7eb",
    role: "healing",
  },
}

export const OCCUPATION_IDS = Object.keys(OCCUPATIONS) as OccupationId[]
