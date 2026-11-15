import { useEffect } from "react"
import {
  isTrainedFor,
  NASA_DATA,
  OCCUPATIONS,
  ROLE_IDS,
  ROLES,
  STATUSES,
  TRAITS,
  TUNING,
  type NeedId,
  type Pawn,
  type ResourceId,
  type RoleId,
} from "@/sim"
import { useMissionStore } from "@/stores/missionStore"

/**
 * Crew panel: one card per pawn with needs, statuses, and orders, plus
 * dev controls to drive the simulation. Temporary home until the Pixi scene exists.
 */

const NEED_LABELS: Record<NeedId, string> = {
  oxygen: "Oxygen",
  water: "Water",
  food: "Food",
  rest: "Rest",
  morale: "Morale",
}

function useGameLoop() {
  const paused = useMissionStore((s) => s.paused)
  const speed = useMissionStore((s) => s.speed)
  const tick = useMissionStore((s) => s.tick)
  useEffect(() => {
    if (paused) return
    const id = window.setInterval(tick, 1000 / speed)
    return () => window.clearInterval(id)
  }, [paused, speed, tick])
}

function Bar({ label, value }: { label: string; value: number }) {
  const color = value < 30 ? "bg-red-500" : value < 60 ? "bg-amber-400" : "bg-emerald-400"
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

function PawnCard({ pawn }: { pawn: Pawn }) {
  const setOrders = useMissionStore((s) => s.setOrders)
  const setRole = useMissionStore((s) => s.setRole)
  const occupation = OCCUPATIONS[pawn.occupation]
  const trained = isTrainedFor(pawn)
  const bonusPct = Math.round((TUNING.occupationMatchBonus - 1) * 100)
  const doseLimit = useMissionStore((s) => s.mission.colony.evaDoseBudgetMsv)

  return (
    <article
      className={`flex flex-col gap-2 border border-white/10 bg-white/5 p-3 ${pawn.evacuated ? "opacity-50" : ""}`}
    >
      <header className="flex items-center gap-2">
        <span className="size-3 rounded-full" style={{ background: pawn.color }} />
        <h3 className="font-semibold">{pawn.name}</h3>
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
            onChange={(e) => setRole(pawn.id, e.target.value as RoleId)}
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
      <p className="text-xs text-orange-200/90">{pawn.task}</p>

      <div className="flex flex-col gap-1">
        <Bar label="Health" value={pawn.health} />
        {(Object.keys(NEED_LABELS) as NeedId[]).map((n) => (
          <Bar key={n} label={NEED_LABELS[n]} value={pawn.needs[n]} />
        ))}
      </div>

      <p className="text-[11px] text-white/60" title="mSv (millisievert) measures how much radiation a body has absorbed.">
        Radiation: {pawn.missionDoseMsv.toFixed(2)} / {doseLimit} mSv this mission · career{" "}
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

      {!pawn.evacuated && (
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={pawn.orders.enabled}
              onChange={(e) => setOrders(pawn.id, { enabled: e.target.checked })}
            />
            On duty
          </label>
          {pawn.role === "scouting" && (
            <>
              <select
                className="bg-black/40 px-1"
                value={pawn.orders.scoutTarget}
                onChange={(e) => setOrders(pawn.id, { scoutTarget: e.target.value as ResourceId | "any" })}
              >
                <option value="any">Find anything</option>
                <option value="metal">Find metal</option>
                <option value="stone">Find stone</option>
                <option value="ice">Find ice</option>
              </select>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={pawn.orders.holdDuringStorms}
                  onChange={(e) => setOrders(pawn.id, { holdDuringStorms: e.target.checked })}
                />
                Stay in during storms
              </label>
            </>
          )}
        </div>
      )}
    </article>
  )
}

export function CrewPanel() {
  useGameLoop()
  const s = useMissionStore()
  const { mission } = s
  const { colony } = mission
  const sol = Math.floor(mission.hour / NASA_DATA.solHours) + 1

  return (
    <div className="flex flex-col gap-4 p-4 text-white">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="font-semibold uppercase tracking-widest">
          Sol {sol} <span className="font-normal text-white/50">(a Mars day, 24 h 39 min)</span>
        </span>
        <button className="border border-white/20 px-2 py-1" onClick={() => s.setPaused(!s.paused)}>
          {s.paused ? "Play" : "Pause"}
        </button>
        <button className="border border-white/20 px-2 py-1" onClick={s.tick}>
          +1 hour
        </button>
        <select className="bg-black/40 px-1" value={s.speed} onChange={(e) => s.setSpeed(Number(e.target.value))}>
          {[1, 2, 5, 20].map((v) => (
            <option key={v} value={v}>
              {v} h/sec
            </option>
          ))}
        </select>
        <button
          className="border border-white/20 px-2 py-1"
          onClick={() => s.queueConstruction({ id: `hab-${mission.hour}`, name: "Habitat Module", workRequired: 12 })}
        >
          Queue build
        </button>
        <button
          className="border border-white/20 px-2 py-1"
          onClick={() => s.queueResearch({ id: `res-${mission.hour}`, name: "Ice Melting", workRequired: 10 })}
        >
          Queue research
        </button>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={colony.weather.dustStorm}
            onChange={(e) => s.setWeather({ dustStorm: e.target.checked })}
          />
          Dust storm
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={colony.weather.solarParticleEvent}
            onChange={(e) => s.setWeather({ solarParticleEvent: e.target.checked })}
          />
          Solar storm
        </label>
        <button className="border border-white/20 px-2 py-1" onClick={() => s.reset()}>
          New crew
        </button>
      </div>

      <p className="text-xs text-white/70">
        Supplies: O₂ {colony.supplies.oxygenKg.toFixed(1)} kg · Water {colony.supplies.waterKg.toFixed(1)} kg · Food{" "}
        {colony.supplies.foodKg.toFixed(1)} kg — Found: metal {colony.resources.metal} · stone {colony.resources.stone} ·
        ice {colony.resources.ice} kg — Build queue {colony.constructionQueue.length} · Research queue{" "}
        {colony.researchQueue.length}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {mission.crew.map((p) => (
          <PawnCard key={p.id} pawn={p} />
        ))}
      </div>

      <ol className="max-h-48 overflow-y-auto border border-white/10 p-2 text-xs">
        {[...mission.log].reverse().map((e, i) => (
          <li
            key={mission.log.length - i}
            className={
              e.kind === "danger" ? "text-red-300" : e.kind === "warning" ? "text-amber-300" : e.kind === "good" ? "text-emerald-300" : "text-white/60"
            }
          >
            [Sol {Math.floor(e.hour / NASA_DATA.solHours) + 1}] {e.text}
          </li>
        ))}
      </ol>
    </div>
  )
}
