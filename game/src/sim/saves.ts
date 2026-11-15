import { createStore } from "zustand/vanilla"
import { useStore } from "zustand"
import { persist } from "zustand/middleware"

export const SAVE_SLOT_COUNT = 3
export const SAVE_NAME_MAX = 16

/**
 * Save slots, kept in this browser only (localStorage). The menu calls a save
 * an "expedition". The slot the player picked from the menu is the active one.
 */
export interface SaveSlot {
  name: string
  /** Both times are milliseconds since 1970, as from Date.now(). */
  createdAt: number
  lastPlayedAt: number
  // TODO(game): the saved game state for this slot goes here once the game has some.
}

interface Saves {
  /** Always SAVE_SLOT_COUNT long; null is an empty slot. */
  slots: (SaveSlot | null)[]
  /** Index of the slot the player is playing, or null if none was picked yet. */
  activeSlot: number | null
}

interface SavesActions {
  /** Starts a brand-new save in the slot and makes it the active one. */
  createSave: (index: number, name: string) => void
  /** Makes an existing save the active one. */
  loadSave: (index: number) => void
  deleteSave: (index: number) => void
}

/** Used when the player leaves the name empty. */
export function defaultSaveName(index: number) {
  return `Expedition ${index + 1}`
}

const EMPTY_SLOTS: (SaveSlot | null)[] = Array.from({ length: SAVE_SLOT_COUNT }, () => null)

function withSlot(slots: (SaveSlot | null)[], index: number, slot: SaveSlot | null) {
  return slots.map((old, i) => (i === index ? slot : old))
}

export const savesStore = createStore<Saves & SavesActions>()(
  persist(
    (set, get) => ({
      slots: EMPTY_SLOTS,
      activeSlot: null,
      createSave: (index, name) => {
        const now = Date.now()
        const slot: SaveSlot = {
          name: name.trim().slice(0, SAVE_NAME_MAX) || defaultSaveName(index),
          createdAt: now,
          lastPlayedAt: now,
        }
        set({ slots: withSlot(get().slots, index, slot), activeSlot: index })
      },
      loadSave: (index) => {
        const slot = get().slots[index]
        if (!slot) return
        set({
          slots: withSlot(get().slots, index, { ...slot, lastPlayedAt: Date.now() }),
          activeSlot: index,
        })
      },
      deleteSave: (index) => {
        const { slots, activeSlot } = get()
        set({
          slots: withSlot(slots, index, null),
          activeSlot: activeSlot === index ? null : activeSlot,
        })
      },
    }),
    {
      name: "ares-saves",
      partialize: ({ slots, activeSlot }) => ({ slots, activeSlot }),
    },
  ),
)

export function useSaves<T>(selector: (state: Saves & SavesActions) => T): T {
  return useStore(savesStore, selector)
}
