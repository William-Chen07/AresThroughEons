import { TUNING } from "./constants"
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
 * Work points per hour for a pawn doing their role's job.
 * 1.0 is an average crew member at skill 5 with no problems.
 */
export function workSpeed(pawn: Pawn, role: RoleId = pawn.role): number {
  const skill = 0.6 + 0.08 * pawn.skill
  const traits =
    traitMultiplier(pawn, (m) => m.workSpeed) * traitMultiplier(pawn, (m) => m.roleBonus?.[role])
  const statuses = pawn.statuses.reduce((acc, s) => acc * STATUSES[s.id].workMultiplier, 1)
  const morale = pawn.needs.morale < 25 ? 0.75 : pawn.needs.morale > 75 ? 1.1 : 1
  return skill * traits * statuses * morale
}

/** Adds experience; returns true if the pawn levelled up. */
export function gainXp(pawn: Pawn, hours: number): boolean {
  if (pawn.skill >= TUNING.maxSkill) return false
  pawn.xp += hours * traitMultiplier(pawn, (m) => m.xpGain)
  let levelled = false
  while (pawn.skill < TUNING.maxSkill && pawn.xp >= pawn.skill * TUNING.xpPerSkillLevel) {
    pawn.xp -= pawn.skill * TUNING.xpPerSkillLevel
    pawn.skill += 1
    levelled = true
  }
  return levelled
}
