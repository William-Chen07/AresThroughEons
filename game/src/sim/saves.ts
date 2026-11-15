import { createStore } from "zustand/vanilla"
import { useStore } from "zustand"
import { persist } from "zustand/middleware"
import { randomSite, type MarsSite } from "@/map/marsSite"
import type { Base } from "@/sim/base"
import type { Cell } from "@/map/voxelTerrain"

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
  /**
   * Where on Mars this expedition's base map is. Picked at random when the
   * save is created, for now; later the player will choose where to land.
   */
  site: MarsSite
  /**
   * False until the lander has touched down. The landing is shown only the
   * first time the expedition's map opens; after that the lander is just there.
   */
  landed: boolean
  /** The base: its modules, and every cell with a piece of tube on it (see sim/base.ts). */
  modules: Base["modules"]
  tubes: Cell[]
  // TODO(game): the rest of the saved game state for this slot goes here.
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
  /** Records that the save's lander has touched down, so the landing isn't shown again. */
  markLanded: (index: number) => void
  setBase: (index: number, base: Base) => void
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
          site: randomSite(),
          landed: false,
          modules: [],
          tubes: [],
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
      setBase: (index, base) => {
        const slot = get().slots[index]
        if (slot) set({ slots: withSlot(get().slots, index, { ...slot, modules: base.modules, tubes: base.tubes }) })
      },
      markLanded: (index) => {
        const slot = get().slots[index]
        if (slot && !slot.landed) set({ slots: withSlot(get().slots, index, { ...slot, landed: true }) })
      },
    }),
    {
      name: "ares-saves",
      partialize: ({ slots, activeSlot }) => ({ slots, activeSlot }),
      // Version 1 added `site`, version 2 `landed`, version 3 `modules` and
      // version 4 `tubes`. Older saves get a random site, count as not landed
      // yet (so they see the landing once) and start with no modules or tubes.
      version: 4,
      migrate: (stored) => {
        const old = stored as Saves
        return {
          ...old,
          slots: old.slots.map(
            (slot) =>
              slot && {
                ...slot,
                site: slot.site ?? randomSite(),
                landed: slot.landed ?? false,
                modules: slot.modules ?? [],
                tubes: slot.tubes ?? [],
              },
          ),
        }
      },
    },
  ),
)

export function useSaves<T>(selector: (state: Saves & SavesActions) => T): T {
  return useStore(savesStore, selector)
}
