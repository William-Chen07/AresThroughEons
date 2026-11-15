import { create } from "zustand"
import { createMission, stepMission, type Job, type Mission, type PawnOrders } from "@/sim"

interface MissionStore {
  mission: Mission
  paused: boolean
  /** Game hours simulated per real second. */
  speed: number
  tick: () => void
  setPaused: (paused: boolean) => void
  setSpeed: (speed: number) => void
  setOrders: (pawnId: string, orders: Partial<PawnOrders>) => void
  queueConstruction: (job: Omit<Job, "workDone">) => void
  queueResearch: (job: Omit<Job, "workDone">) => void
  setWeather: (weather: Partial<Mission["colony"]["weather"]>) => void
  reset: (seed?: number) => void
}

/** Apply a small change to a cloned mission (the sim treats Mission as immutable). */
const edit = (mission: Mission, fn: (m: Mission) => void): Mission => {
  const next = structuredClone(mission)
  fn(next)
  return next
}

export const useMissionStore = create<MissionStore>((set) => ({
  mission: createMission(Date.now()),
  paused: true,
  speed: 2,
  tick: () => set((s) => ({ mission: stepMission(s.mission) })),
  setPaused: (paused) => set({ paused }),
  setSpeed: (speed) => set({ speed }),
  setOrders: (pawnId, orders) =>
    set((s) => ({
      mission: edit(s.mission, (m) => {
        const pawn = m.crew.find((p) => p.id === pawnId)
        if (pawn) Object.assign(pawn.orders, orders)
      }),
    })),
  queueConstruction: (job) =>
    set((s) => ({ mission: edit(s.mission, (m) => void m.colony.constructionQueue.push({ ...job, workDone: 0 })) })),
  queueResearch: (job) =>
    set((s) => ({ mission: edit(s.mission, (m) => void m.colony.researchQueue.push({ ...job, workDone: 0 })) })),
  setWeather: (weather) =>
    set((s) => ({ mission: edit(s.mission, (m) => Object.assign(m.colony.weather, weather)) })),
  reset: (seed = Date.now()) => set({ mission: createMission(seed), paused: true }),
}))
