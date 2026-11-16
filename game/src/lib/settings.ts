import { createStore } from "zustand/vanilla"
import { useStore } from "zustand"
import { persist } from "zustand/middleware"

/** Player preferences, kept in this browser only. Volumes are 0..1. */
export interface Settings {
  muted: boolean
  musicVolume: number
  sfxVolume: number
  /** The player put the map credits away with their x (they stay on the main menu's Credits). */
  mapCreditsDismissed: boolean
}

interface SettingsActions {
  setSettings: (patch: Partial<Settings>) => void
}

export const settingsStore = createStore<Settings & SettingsActions>()(
  persist(
    (set) => ({
      muted: false,
      musicVolume: 0.5,
      sfxVolume: 0.7,
      mapCreditsDismissed: false,
      setSettings: (patch) => set(patch),
    }),
    {
      name: "ares-settings",
      partialize: ({ muted, musicVolume, sfxVolume, mapCreditsDismissed }) => ({ muted, musicVolume, sfxVolume, mapCreditsDismissed }),
    },
  ),
)

export function useSettings<T>(selector: (state: Settings & SettingsActions) => T): T {
  return useStore(settingsStore, selector)
}
