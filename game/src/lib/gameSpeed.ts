import { createStore } from "zustand/vanilla"
import { useStore } from "zustand"

/** The speeds the player can pick for the base map's clock: 1× is normal. */
export const GAME_SPEEDS = [1, 2, 3] as const
export type GameSpeed = (typeof GAME_SPEEDS)[number]

interface GameSpeedState {
  speed: GameSpeed
  setSpeed: (speed: GameSpeed) => void
}

/**
 * How fast game time runs on the base map, as a multiple of normal. Not saved: every time the
 * game is opened it starts at 1×.
 */
export const gameSpeedStore = createStore<GameSpeedState>()((set) => ({
  speed: 1,
  setSpeed: (speed) => set({ speed }),
}))

export function useGameSpeed(): GameSpeed {
  return useStore(gameSpeedStore, (state) => state.speed)
}
