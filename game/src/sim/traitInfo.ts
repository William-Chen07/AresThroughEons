import { ROLE_IDS, ROLES } from "./roles"
import { TRAITS, TRAIT_IDS, type TraitDef } from "./traits"
import type { NeedId } from "./types"

/*
 * A trait in plain words, for the trait cards in the crew screen (components/CrewChips.tsx):
 * what its numbers (modifiers in sim/traits.ts) do, and who the crewmate doesn't get along with.
 * Worked out from the trait's data, so a change to a trait's numbers shows up here by itself.
 */

/** "20%" from a multiplier like 1.2 or 0.8. */
const percent = (factor: number) => `${Math.round(Math.abs(factor - 1) * 100)}%`

/** How a need draining faster or slower is said. */
const NEED_WORDS: Record<NeedId, { faster: string; slower: string }> = {
  oxygen: { faster: "Breathes {p} more oxygen", slower: "Breathes {p} less oxygen" },
  water: { faster: "Gets thirsty {p} faster", slower: "Gets thirsty {p} slower" },
  food: { faster: "Gets hungry {p} faster", slower: "Gets hungry {p} slower" },
  rest: { faster: "Gets tired {p} faster", slower: "Gets tired {p} slower" },
  morale: { faster: "Gets sad {p} faster", slower: "Gets sad {p} slower" },
}

/** What a trait's numbers do, one short line each, e.g. "Works 20% faster". Empty if it has none (yet). */
export function traitEffects(trait: TraitDef): string[] {
  const m = trait.modifiers
  const lines: string[] = []
  if (m.workSpeed && m.workSpeed !== 1) lines.push(`Works ${percent(m.workSpeed)} ${m.workSpeed > 1 ? "faster" : "slower"}`)
  if (m.roleBonus) {
    const bonuses = ROLE_IDS.filter((role) => m.roleBonus?.[role] && m.roleBonus[role] !== 1)
    const factors = bonuses.map((role) => m.roleBonus![role]!)
    // The same bonus at every job is said once.
    if (bonuses.length === ROLE_IDS.length && factors.every((f) => f === factors[0])) {
      lines.push(`${percent(factors[0])} ${factors[0] > 1 ? "faster" : "slower"} at every job`)
    } else {
      for (const role of bonuses) {
        const f = m.roleBonus[role]!
        lines.push(`${percent(f)} ${f > 1 ? "faster" : "slower"} at ${ROLES[role].name}`)
      }
    }
  }
  for (const need of Object.keys(m.needDecay ?? {}) as NeedId[]) {
    const f = m.needDecay![need]!
    if (f === 1) continue
    lines.push(NEED_WORDS[need][f > 1 ? "faster" : "slower"].replace("{p}", percent(f)))
  }
  if (m.restRecovery && m.restRecovery !== 1) {
    lines.push(`Sleep refills rest ${percent(m.restRecovery)} ${m.restRecovery > 1 ? "faster" : "slower"}`)
  }
  if (m.moraleBase) {
    lines.push(`Mood stays ${Math.abs(m.moraleBase)} points ${m.moraleBase > 0 ? "higher" : "lower"}`)
  }
  if (m.injuryChance && m.injuryChance !== 1) {
    lines.push(`${percent(m.injuryChance)} ${m.injuryChance > 1 ? "more" : "less"} likely to get hurt outside`)
  }
  if (m.healthRegen && m.healthRegen !== 1) {
    lines.push(`Heals ${percent(m.healthRegen)} ${m.healthRegen > 1 ? "faster" : "slower"}`)
  }
  if (m.xpGain && m.xpGain !== 1) lines.push(`Learns ${percent(m.xpGain)} ${m.xpGain > 1 ? "faster" : "slower"}`)
  return lines
}

/**
 * Who a crewmate with this trait doesn't get along with, as trait names, or "everyone" when it's
 * every other trait (Egotistical). Being with them lowers THIS crewmate's mood (one-way, see
 * dislikes in sim/traits.ts). Null if they get along with everybody.
 */
export function traitDislikes(trait: TraitDef): string[] | "everyone" | null {
  const dislikes = trait.dislikes ?? []
  if (dislikes.length === 0) return null
  const others = TRAIT_IDS.filter((id) => id !== trait.id)
  if (others.every((id) => dislikes.includes(id))) return "everyone"
  return dislikes.map((id) => TRAITS[id].name)
}
