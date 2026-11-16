import { createStore } from "zustand/vanilla"
import { useStore } from "zustand"
import { persist } from "zustand/middleware"

/** Player preferences, kept in this browser only. Volumes are 0..1. */
export interface Settings {
  muted: boolean
  musicVolume: number
  sfxVolume: number
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
      setSettings: (patch) => set(patch),
    }),
    {
      name: "ares-settings",
      // Only the volumes are kept. (A browser may still have an old `mapCreditsDismissed` from when the
      // map credits button could be removed for good; nothing reads it now, so the button is back.)
      partialize: ({ muted, musicVolume, sfxVolume }) => ({ muted, musicVolume, sfxVolume }),
    },
  ),
)

export function useSettings<T>(selector: (state: Settings & SettingsActions) => T): T {
  return useStore(settingsStore, selector)
}
