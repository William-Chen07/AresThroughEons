import { createStore } from "zustand/vanilla"
import { useStore } from "zustand"
import { persist } from "zustand/middleware"

/**
 * Long-term progress that survives between missions and page reloads.
 * The main menu reads this to decide what is unlocked and which crew and tech
 * to show around the lander. The game should write to it when an era ends.
 */
export interface Progress {
  /** True once the player has finished at least one mission. */
  hasSave: boolean
  /** Highest era reached (1-based). */
  era: number
  crewCount: number
  /** Tech ids, e.g. "rover". The menu only draws the ones it has models for. */
  unlockedTech: string[]
  /** Discovered codex entry ids (see content/codex.ts). */
  codexIds: string[]
}

interface ProgressActions {
  setProgress: (patch: Partial<Progress>) => void
  resetProgress: () => void
}

const INITIAL: Progress = {
  hasSave: false,
  era: 1,
  crewCount: 1,
  unlockedTech: [],
  codexIds: [],
}

export const progressStore = createStore<Progress & ProgressActions>()(
  persist(
    (set) => ({
      ...INITIAL,
      setProgress: (patch) => set(patch),
      resetProgress: () => set(INITIAL),
    }),
    {
      name: "ares-progress",
      partialize: ({ hasSave, era, crewCount, unlockedTech, codexIds }) => ({
        hasSave,
        era,
        crewCount,
        unlockedTech,
        codexIds,
      }),
    },
  ),
)

export function useProgress<T>(selector: (state: Progress & ProgressActions) => T): T {
  return useStore(progressStore, selector)
}

/**
 * Dev-only preview of later progress without playing, e.g.
 *   /?crew=3&tech=rover,habitat&era=2   (codex=jezero,olympus-mons is optional)
 *   /?reset                             (back to a brand-new player)
 */
if (import.meta.env.DEV) {
  const params = new URLSearchParams(window.location.search)
  const list = (key: string) => params.get(key)?.split(",").filter(Boolean)
  if (params.has("reset")) {
    progressStore.getState().resetProgress()
  } else if (params.has("crew") || params.has("tech") || params.has("era") || params.has("codex")) {
    const current = progressStore.getState()
    progressStore.getState().setProgress({
      hasSave: true,
      crewCount: Number(params.get("crew") ?? current.crewCount),
      era: Number(params.get("era") ?? current.era),
      unlockedTech: list("tech") ?? current.unlockedTech,
      codexIds: list("codex") ?? current.codexIds,
    })
  }
}
