import { TUNING } from "./constants"
import { OCCUPATIONS } from "./occupations"
import { STATUSES } from "./statuses"
import { TRAITS, type TraitModifiers } from "./traits"
import type { Pawn, RoleId, StatusId } from "./types"

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export const hasStatus = (pawn: Pawn, id: StatusId) => pawn.statuses.some((s) => s.id === id)

export function addStatus(pawn: Pawn, id: StatusId, hour: number): boolean {
  if (hasStatus(pawn, id)) return false
  pawn.statuses.push({ id, sinceHour: hour, treatmentProgress: 0 })
  return true
}

/**
 * The crewmate gets hurt: loses TUNING.injuryHealthLoss health at once (never below 1, so a slip
 * alone never sends anyone home) and is Injured until treated or healed. Returns false if they
 * were already injured, in which case nothing happens.
 */
export function injure(pawn: Pawn, hour: number, amount: number = TUNING.injuryHealthLoss): boolean {
  if (!addStatus(pawn, "injured", hour)) return false
  pawn.health = Math.max(1, pawn.health - amount)
  return true
}

export function removeStatus(pawn: Pawn, id: StatusId): boolean {
  const before = pawn.statuses.length
  pawn.statuses = pawn.statuses.filter((s) => s.id !== id)
  return pawn.statuses.length !== before
}

/** Product of a multiplier across all of the pawn's traits (1 if none set it). */
export function traitMultiplier(pawn: Pawn, pick: (m: TraitModifiers) => number | undefined) {
  return pawn.traits.reduce((acc, t) => acc * (pick(TRAITS[t].modifiers) ?? 1), 1)
}

export function traitSum(pawn: Pawn, pick: (m: TraitModifiers) => number | undefined) {
  return pawn.traits.reduce((acc, t) => acc + (pick(TRAITS[t].modifiers) ?? 0), 0)
}

export const canGoOnEva = (pawn: Pawn) => !pawn.statuses.some((s) => STATUSES[s.id].blocksEva)

export const isActive = (pawn: Pawn) => pawn.evacuated === null

/**
 * One-way: true if one of `a`'s traits dislikes one of `b`'s traits.
 * Only `a` is bothered. `b` doesn't care unless their own traits dislike `a`.
 */
export function dislikesCrewmate(a: Pawn, b: Pawn): boolean {
  return a.traits.some((t) => TRAITS[t].dislikes?.some((d) => b.traits.includes(d)))
}

/**
 * Are these two crewmates spending this hour together?
 * - Working together: both actively doing the same role.
 * - Socializing: both awake and idle in the base.
 * TODO: when a real socialization feature exists, use it for the second case.
 */
export function areTogether(a: Pawn, b: Pawn): boolean {
  if (a === b || !isActive(a) || !isActive(b)) return false
  const working = (p: Pawn) => p.activity === "working" || p.activity === "eva"
  if (working(a) && working(b)) return a.role === b.role
  return a.activity === "idle" && b.activity === "idle"
}

/** True when the role is the one the pawn's occupation trained them for. */
export const isTrainedFor = (pawn: Pawn, role: RoleId = pawn.role) => OCCUPATIONS[pawn.occupation].role === role

/**
 * Work points per hour for a pawn doing a role (defaults to their current one).
 * 1.0 is an average crew member at skill 5 with no problems and no occupation match.
 */
export function workSpeed(pawn: Pawn, role: RoleId = pawn.role): number {
  const skill = 0.6 + 0.08 * pawn.skills[role].level
  const trained = isTrainedFor(pawn, role) ? TUNING.occupationMatchBonus : 1
  const traits =
    traitMultiplier(pawn, (m) => m.workSpeed) * traitMultiplier(pawn, (m) => m.roleBonus?.[role])
  const statuses = pawn.statuses.reduce((acc, s) => acc * STATUSES[s.id].workMultiplier, 1)
  const morale = pawn.needs.morale < 25 ? 0.75 : pawn.needs.morale > 75 ? 1.1 : 1
  return skill * trained * traits * statuses * morale
}

/** Adds experience to one role's skill; returns true if it levelled up. */
export function gainXp(pawn: Pawn, role: RoleId, hours: number): boolean {
  const skill = pawn.skills[role]
  if (skill.level >= TUNING.maxSkill) return false
  skill.xp += hours * traitMultiplier(pawn, (m) => m.xpGain)
  let levelled = false
  while (skill.level < TUNING.maxSkill && skill.xp >= skill.level * TUNING.xpPerSkillLevel) {
    skill.xp -= skill.level * TUNING.xpPerSkillLevel
    skill.level += 1
    levelled = true
  }
  return levelled
}
