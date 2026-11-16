import type { ReactNode } from "react"
import {
  isTrainedFor,
  NASA_DATA,
  OCCUPATIONS,
  ROLE_IDS,
  ROLES,
  STATUSES,
  TRAITS,
  TUNING,
  type LogEntry,
  type NeedId,
  type Pawn,
  type RoleId,
} from "@/sim"

/**
 * Crew panel: one card per crewmate in the expedition's save, with needs, health, radiation,
 * traits, statuses and the job they are best at (Stat). Shown over the base map from the Crew button.
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
        <div className="h-1 flex-1 overflow-hidden rounded bg-white/10">
          <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-14 shrink-0 text-white/60">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded bg-white/10">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="w-7 text-right tabular-nums text-white/60">{Math.round(value)}</span>
    </div>
  )
}

/** The job an astronaut is best at: their highest skill, and the job they trained for when it's a tie. */
function bestRole(pawn: Pawn): RoleId {
  const trainedRole = OCCUPATIONS[pawn.occupation].role
  return ROLE_IDS.reduce((best, r) => (pawn.skills[r].level > pawn.skills[best].level ? r : best), trainedRole)
}

function PawnCard({ pawn }: { pawn: Pawn }) {
  const occupation = OCCUPATIONS[pawn.occupation]
  const best = bestRole(pawn)
  const trained = isTrainedFor(pawn, best)
  const bonusPct = Math.round((TUNING.occupationMatchBonus - 1) * 100)

  return (
    <article className={`flex flex-col gap-2 border border-white/10 bg-white/5 p-3 ${pawn.evacuated ? "opacity-50" : ""}`}>
      <header className="flex items-center gap-2">
        <span className="size-3 rounded-full" style={{ background: pawn.color }} />
        <h3 className="font-semibold">{pawn.name}</h3>
        <span className="text-xs text-white/60" title={occupation.description}>
          {occupation.name}
        </span>
      </header>

      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        {/* What this astronaut is best at. It only shows it: nothing here can be changed. */}
        <p className="flex items-center gap-1 text-white/60">
          Stat
          <span className="text-white">
            {ROLES[best].name} (skill {pawn.skills[best].level})
          </span>
        </p>
        {trained && (
          <span
            className="border border-emerald-400/50 px-1.5 text-emerald-200"
            title={`${occupation.name}s are trained for ${ROLES[best].name}, so they work ${bonusPct}% faster.`}
          >
            ★ Trained +{bonusPct}%
          </span>
        )}
      </div>
      <p className="text-xs text-orange-200/90">{pawn.evacuated ? `Evacuated (${pawn.evacuated.reason})` : pawn.task}</p>

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

      <div className="flex flex-wrap gap-1">
        {pawn.traits.map((t) => (
          <span key={t} title={TRAITS[t].description} className="border border-sky-400/30 px-1.5 text-[10px] text-sky-200">
            {TRAITS[t].name}
          </span>
        ))}
        {pawn.statuses.map((s) => (
          <span
            key={s.id}
            title={`${STATUSES[s.id].description} ${STATUSES[s.id].fix}`}
            className={`border px-1.5 text-[10px] ${STATUSES[s.id].severity === "serious" ? "border-red-400/50 text-red-200" : "border-amber-400/40 text-amber-200"}`}
          >
            {STATUSES[s.id].label}
          </span>
        ))}
      </div>
    </article>
  )
}

export function CrewPanel({
  crew,
  crewLog,
  clock,
}: {
  crew: Pawn[]
  crewLog: LogEntry[]
  /** The expedition's clock, in game-hours. */
  clock: number
}) {
  const sol = Math.floor(clock / NASA_DATA.solHours) + 1

  return (
    <div className="flex flex-col gap-4 p-4 text-white">
      <p className="text-xs font-semibold uppercase tracking-widest">
        Crew · Sol {sol} <span className="font-normal normal-case tracking-normal text-white/50">(a sol is a Mars day, 24 h 39 min)</span>
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {crew.map((p) => (
          <PawnCard key={p.id} pawn={p} />
        ))}
      </div>

      <ol className="max-h-48 overflow-y-auto border border-white/10 p-2 text-xs">
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
