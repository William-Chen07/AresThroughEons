/**
 * Seeded random numbers (mulberry32). The state lives in the Mission so a
 * playthrough can be replayed from its seed and tests stay deterministic.
 */
export interface Rng {
  /** Float in [0, 1). */
  next(): number
  /** Integer in [min, max], inclusive. */
  int(min: number, max: number): number
  pick<T>(items: readonly T[]): T
  readonly state: number
}

export function createRng(seed: number): Rng {
  let state = seed | 0
  const next = () => {
    state = (state + 0x6d2b79f5) | 0
    let r = Math.imul(state ^ (state >>> 15), 1 | state)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items) => items[Math.floor(next() * items.length)],
    get state() {
      return state
    },
  }
}
