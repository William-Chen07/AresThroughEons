import { TUNING } from "./constants"
import { addStatus, canGoOnEva, clamp, isActive, removeStatus, traitMultiplier } from "./pawn"
import type { Rng } from "./rng"
import { STATUSES } from "./statuses"
import type { Activity, LogEntry, Mission, Pawn, ResourceId, RoleId } from "./types"

export interface WorkContext {
  pawn: Pawn
  mission: Mission
  rng: Rng
  hours: number
  /** Work points per hour (see workSpeed). */
  speed: number
  log: (kind: LogEntry["kind"], text: string) => void
}

export interface WorkResult {
  activity: Extract<Activity, "working" | "eva" | "idle">
  task: string
}

/**
 * Role = the task a crewmate is assigned to right now. Anyone can do any role;
 * crewmates whose occupation trained them for it work faster (see workSpeed).
 */
export interface RoleDef {
  id: RoleId
  /** Also the name of the skill for this role, e.g. "Building". */
  name: string
  /** Kid-facing, one sentence. */
  description: string
  work: (ctx: WorkContext) => WorkResult
}

const idle = (task: string): WorkResult => ({ activity: "idle", task })

const RESOURCES: ResourceId[] = ["metal", "stone", "ice"]

function workOnQueue(
  ctx: WorkContext,
  queue: Mission["colony"]["constructionQueue"],
  done: string[],
  verb: string,
  finishedText: (name: string) => string,
  nothingText: string,
): WorkResult {
  const job = queue[0]
  if (!job) return idle(nothingText)
  job.workDone += ctx.speed * ctx.hours
  if (job.workDone >= job.workRequired) {
    queue.shift()
    done.push(job.id)
    ctx.log("good", finishedText(job.name))
  }
  return { activity: "working", task: `${verb} ${job.name}` }
}

export const ROLES: Record<RoleId, RoleDef> = {
  building: {
    id: "building",
    name: "Building",
    description: "Builds the base's modules from the build queue.",
    work: (ctx) =>
      workOnQueue(
        ctx,
        ctx.mission.colony.constructionQueue,
        ctx.mission.colony.completed.buildings,
        "Building",
        (name) => `${ctx.pawn.name} finished building the ${name}!`,
        "Waiting: nothing to build",
      ),
  },

  researching: {
    id: "researching",
    name: "Researching",
    description: "Studies Mars to unlock new blueprints and technology.",
    work: (ctx) =>
      workOnQueue(
        ctx,
        ctx.mission.colony.researchQueue,
        ctx.mission.colony.completed.research,
        "Researching",
        (name) => `${ctx.pawn.name} finished researching ${name}!`,
        "Waiting: nothing to research",
      ),
  },

  scouting: {
    id: "scouting",
    name: "Scouting",
    description: "Explores outside the base to find metal, stone, and ice.",
    work: (ctx) => {
      const { pawn, mission, rng, hours, speed, log } = ctx
      const { weather, resources } = mission.colony

      if (!canGoOnEva(pawn)) {
        const blocker = pawn.statuses.find((s) => STATUSES[s.id].blocksEva)!
        return idle(`Must stay inside: ${STATUSES[blocker.id].label}`)
      }
      if (weather.dustStorm && pawn.orders.holdDuringStorms) {
        return idle("Waiting out the dust storm")
      }

      const target = pawn.orders.scoutTarget
      const stormFactor = weather.dustStorm ? TUNING.stormFindPenalty : 1
      const findChance = clamp(TUNING.scoutFindChancePerHour * speed * stormFactor * hours, 0, 0.95)
      if (rng.next() < findChance) {
        const resource = target === "any" ? rng.pick(RESOURCES) : target
        const kg = Math.round(rng.int(TUNING.scoutFindKg.min, TUNING.scoutFindKg.max) * Math.max(speed, 0.5))
        resources[resource] += kg
        log("good", `${pawn.name} found ${kg} kg of ${resource}!`)
      }

      const baseInjury = weather.dustStorm ? TUNING.stormInjuryChancePerHour : TUNING.injuryChancePerHour
      const injuryChance = baseInjury * traitMultiplier(pawn, (m) => m.injuryChance) * hours
      if (rng.next() < injuryChance && addStatus(pawn, "injured", mission.hour)) {
        log(
          "warning",
          weather.dustStorm
            ? `${pawn.name} was hurt in the dust storm and headed back inside.`
            : `${pawn.name} slipped on the rocks and got hurt.`,
        )
      }

      return { activity: "eva", task: target === "any" ? "Exploring outside" : `Looking for ${target}` }
    },
  },

  healing: {
    id: "healing",
    name: "Healing",
    description: "Treats the crew's injuries and stress.",
    work: (ctx) => treatNextPatient(ctx.pawn, ctx.mission.crew, ctx.speed, ctx.hours, ctx.log),
  },
}

/**
 * The healer puts `hours` of work into the most urgent treatable problem among `crew`
 * (the healer counts too). Shared by the sandbox mission and the real game (sim/crewLife.ts).
 */
export function treatNextPatient(
  healer: Pawn,
  crew: Pawn[],
  speed: number,
  hours: number,
  log: (kind: LogEntry["kind"], text: string) => void,
): WorkResult {
  const patients = crew
    .filter(isActive)
    .flatMap((p) =>
      p.statuses
        .filter((s) => STATUSES[s.id].treatable)
        .map((status) => ({ patient: p, status, def: STATUSES[status.id] })),
    )
    .sort(
      (a, b) =>
        (b.def.treatmentPriority ?? 0) - (a.def.treatmentPriority ?? 0) || a.patient.health - b.patient.health,
    )

  const next = patients[0]
  if (!next) return idle("Waiting: everyone is healthy")

  const { patient, status, def } = next
  const selfPenalty = patient === healer ? 0.5 : 1 // treating yourself is harder
  status.treatmentProgress += speed * selfPenalty * hours

  if (status.treatmentProgress >= (def.treatmentHours ?? 1)) {
    removeStatus(patient, status.id)
    if (status.id === "stressed") {
      patient.needs.morale = clamp(patient.needs.morale + TUNING.counselingMoraleBoost, 0, 100)
    }
    const who = patient === healer ? "themself" : patient.name
    log("good", `${healer.name} treated ${who} (${def.label}).`)
  }

  const who = patient === healer ? "self" : patient.name
  return { activity: "working", task: `Treating ${who}: ${def.label}` }
}

export const ROLE_IDS = Object.keys(ROLES) as RoleId[]
