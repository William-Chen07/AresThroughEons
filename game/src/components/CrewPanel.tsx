import type { CSSProperties, ReactNode } from "react"
import {
  isTrainedFor,
  NASA_DATA,
  OCCUPATIONS,
  ROLE_IDS,
  ROLES,
  TUNING,
  type LogEntry,
  type NeedId,
  type Pawn,
  type RoleId,
} from "@/sim"
import { StatusChip, TraitChip } from "@/components/CrewChips"

/**
 * Crew panel: one card per crewmate in the expedition's save, with needs, health, radiation,
 * traits, statuses and their role (current task). Shown over the base map from the Crew button.
 */

const NEED_LABELS: Record<NeedId, string> = {
  oxygen: "Oxygen",
  water: "Water",
  food: "Food",
  rest: "Rest",
  morale: "Morale",
}

/**
 * A 0–100 stat as a coloured bar: green, amber below 60, red below 30. Also used, in its small
 * form with an icon, by the map's Crew list.
 */
export function Bar({ label, value, icon }: { label: string; value: number; icon?: ReactNode }) {
  const color = value < 30 ? "bg-red-500" : value < 60 ? "bg-amber-400" : "bg-emerald-400"
  // The small form: an icon in place of the words and no number, with both still there for a
  // pointer (as a tooltip) and for screen readers.
  if (icon) {
    return (
      <div className="flex items-center gap-1" title={`${label} ${Math.round(value)}`}>
        {icon}
        <span className="sr-only">
          {label} {Math.round(value)}
        </span>
        <div className="h-1 flex-1 overflow-hidden rounded bg-cyan-300/15">
          <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-14 shrink-0 text-white/60">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded bg-cyan-300/15">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="w-7 text-right tabular-nums text-white/60">{Math.round(value)}</span>
    </div>
  )
}

function PawnCard({ pawn, onRole }: { pawn: Pawn; onRole: (role: RoleId) => void }) {
  const occupation = OCCUPATIONS[pawn.occupation]
  const trained = isTrainedFor(pawn)
  const bonusPct = Math.round((TUNING.occupationMatchBonus - 1) * 100)

  return (
    <article className={`holo-frame flex flex-col gap-2 border border-cyan-300/15 bg-cyan-300/5 p-3 ${pawn.evacuated ? "opacity-50" : ""}`}>
      <header className="flex items-center gap-2">
        <span className="size-3 rounded-full" style={{ background: pawn.color }} />
        <h3 className="holo-title font-semibold">{pawn.name}</h3>
        <span className="text-xs text-white/60" title={occupation.description}>
          {occupation.name}
        </span>
      </header>

      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <label className="flex items-center gap-1 text-white/60">
          Task
          <select
            className="bg-black/40 px-1 text-white"
            value={pawn.role}
            disabled={!!pawn.evacuated}
            onChange={(e) => onRole(e.target.value as RoleId)}
          >
            {ROLE_IDS.map((r) => (
              <option key={r} value={r}>
                {ROLES[r].name} (skill {pawn.skills[r].level}){isTrainedFor(pawn, r) ? " ★" : ""}
              </option>
            ))}
          </select>
        </label>
        {trained ? (
          <span
            className="border border-emerald-400/50 px-1.5 text-emerald-200"
            title={`${occupation.name}s are trained for ${ROLES[pawn.role].name}, so they work ${bonusPct}% faster.`}
          >
            ★ Trained +{bonusPct}%
          </span>
        ) : (
          <span className="text-white/40" title={`${occupation.name}s are trained for ${ROLES[occupation.role].name}.`}>
            Not trained for this
          </span>
        )}
      </div>
      <p className={`text-xs ${pawn.evacuated ? "text-orange-200/90" : "text-cyan-100/90"}`}>{pawn.evacuated ? `Evacuated (${pawn.evacuated.reason})` : pawn.task}</p>

      <div className="flex flex-col gap-1">
        <Bar label="Health" value={pawn.health} />
        {(Object.keys(NEED_LABELS) as NeedId[]).map((n) => (
          <Bar key={n} label={NEED_LABELS[n]} value={pawn.needs[n]} />
        ))}
      </div>

      <p className="text-[11px] text-white/60" title="mSv (millisievert) measures how much radiation a body has absorbed.">
        Radiation: {pawn.missionDoseMsv.toFixed(2)} / {TUNING.evaDoseBudgetMsv} mSv this era · career{" "}
        {pawn.careerDoseMsv.toFixed(1)} / {NASA_DATA.careerDoseLimitMsv} mSv
      </p>

      {/* `relative`: a trait's or status's card (CrewChips.tsx) hangs under this row, as wide as it. */}
      <div className="relative flex flex-wrap gap-1">
        {pawn.traits.map((t) => (
          <TraitChip key={t} id={t} />
        ))}
        {pawn.statuses.map((s) => (
          <StatusChip key={s.id} id={s.id} />
        ))}
      </div>
    </article>
  )
}

export function CrewPanel({
  crew,
  crewLog,
  clock,
  onRole,
}: {
  crew: Pawn[]
  crewLog: LogEntry[]
  /** The expedition's clock, in game-hours. */
  clock: number
  onRole: (pawnId: string, role: RoleId) => void
}) {
  const sol = Math.floor(clock / NASA_DATA.solHours) + 1

  return (
    <div className="flex flex-col gap-4 p-4 text-white">
      <p className="holo-title text-xs font-semibold uppercase tracking-widest">
        Crew · Sol {sol} <span className="font-normal normal-case tracking-normal text-white/50">(a sol is a Mars day, 24 h 39 min)</span>
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {crew.map((p, i) => (
          // Each card steps up after the one before it when the crew screen opens (index.css).
          <div key={p.id} className="fx-crew-card" style={{ "--i": i } as CSSProperties}>
            <PawnCard pawn={p} onRole={(role) => onRole(p.id, role)} />
          </div>
        ))}
      </div>

      <ol className="max-h-48 overflow-y-auto border border-cyan-300/15 p-2 text-xs">
        {crewLog.length === 0 && <li className="text-white/40">Nothing has happened to the crew yet.</li>}
        {[...crewLog].reverse().map((e, i) => (
          <li
            key={crewLog.length - i}
            className={
              e.kind === "danger"
                ? "text-red-300"
                : e.kind === "warning"
                  ? "text-amber-300"
                  : e.kind === "good"
                    ? "text-emerald-300"
                    : "text-white/60"
            }
          >
            [Sol {Math.floor(e.hour / NASA_DATA.solHours) + 1}] {e.text}
          </li>
        ))}
      </ol>
    </div>
  )
}
