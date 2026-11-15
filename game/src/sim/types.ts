/** Permanent job a crewmate trained for. Set at spawn. */
export type OccupationId = "engineer" | "scout" | "researcher" | "medic"

/** The task a crewmate is currently assigned to. The player can change it any time. */
export type RoleId = "building" | "scouting" | "researching" | "healing"

export interface Skill {
  level: number
  /** Progress toward the next level. */
  xp: number
}

export type NeedId = "oxygen" | "water" | "food" | "rest" | "morale"

export type ResourceId = "metal" | "stone" | "ice"

export type TraitId =
  | "hardWorker"
  | "calm"
  | "curious"
  | "tough"
  | "clumsy"
  | "bigAppetite"
  | "lightSleeper"
  | "homesick"
  | "steadyHands"
  | "quickLearner"

export type StatusId =
  // Caused by needs. Fixed by supplies or sleep, not by a medic.
  | "hungry"
  | "starving"
  | "thirsty"
  | "dehydrated"
  | "hypoxic"
  | "tired"
  | "grounded"
  // Picked up during play. A medic treats these.
  | "injured"
  | "stressed"

export interface StatusEffect {
  id: StatusId
  sinceHour: number
  /** Hours of medic work put into treating this status. */
  treatmentProgress: number
}

export type Activity = "working" | "eva" | "sleeping" | "idle"

export interface PawnOrders {
  /** Turned off = pawn stays off duty (still eats and sleeps). */
  enabled: boolean
  /** When scouting: what to look for outside. */
  scoutTarget: ResourceId | "any"
  /** When scouting: stay inside while a dust storm is blowing. */
  holdDuringStorms: boolean
}

export interface Pawn {
  id: string
  name: string
  /** Permanent. What they trained for. */
  occupation: OccupationId
  /** Current task assignment. Matching the occupation gives a work bonus. */
  role: RoleId
  color: string
  traits: TraitId[]
  needs: Record<NeedId, number>
  health: number
  statuses: StatusEffect[]
  activity: Activity
  /** Plain-language line for the UI, e.g. "Building Greenhouse" or "Waiting: nothing to build". */
  task: string
  /** One skill per role, so a medic who builds levels up Building, not Healing. */
  skills: Record<RoleId, Skill>
  /** Radiation picked up this mission (mSv). Resets each era. */
  missionDoseMsv: number
  /** Radiation picked up over the whole career (mSv). Carries across eras. */
  careerDoseMsv: number
  orders: PawnOrders
  /** Set when the pawn was sent home. Replaces death. */
  evacuated: { hour: number; reason: string } | null
}

export interface Job {
  id: string
  name: string
  workRequired: number
  workDone: number
}

export interface Colony {
  supplies: { oxygenKg: number; waterKg: number; foodKg: number }
  resources: Record<ResourceId, number>
  constructionQueue: Job[]
  researchQueue: Job[]
  completed: { buildings: string[]; research: string[] }
  /** Fraction (0-1) of radiation the habitat blocks for crew inside. */
  habitatShielding: number
  /** Mission dose (mSv) at which a pawn is no longer allowed outside. */
  evaDoseBudgetMsv: number
  weather: { dustStorm: boolean; solarParticleEvent: boolean }
}

export type LogKind = "info" | "good" | "warning" | "danger"

export interface LogEntry {
  hour: number
  kind: LogKind
  text: string
  pawnId?: string
}

export interface Mission {
  /** Hours elapsed since landing. */
  hour: number
  crew: Pawn[]
  colony: Colony
  rngState: number
  log: LogEntry[]
}
