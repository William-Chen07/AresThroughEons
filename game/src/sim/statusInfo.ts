import type { StatusDef } from "./statuses"

/*
 * A status in plain words, for the status cards (components/CrewChips.tsx): what it does to the
 * crewmate while they have it. Worked out from the status's numbers in sim/statuses.ts, so a
 * change there shows up here by itself.
 */

/** What a status does, one short line each, e.g. "Works 10% slower". Empty if it does nothing. */
export function statusEffects(status: StatusDef): string[] {
  const lines: string[] = []
  if (status.moralePenalty > 0) lines.push(`Mood drops by ${status.moralePenalty}`)
  if (status.healthDamagePerHour > 0) {
    const per = status.healthDamagePerHour
    lines.push(`Loses ${Number.isInteger(per) ? per : per.toFixed(1)} health every hour`)
  }
  if (status.workMultiplier !== 1) {
    const pct = Math.round(Math.abs(1 - status.workMultiplier) * 100)
    lines.push(status.workMultiplier === 0 ? "Can't work" : `Works ${pct}% ${status.workMultiplier < 1 ? "slower" : "faster"}`)
  }
  if (status.blocksEva) lines.push("Must stay inside")
  if (status.treatable) lines.push("A crewmate on Healing can treat it")
  return lines
}
