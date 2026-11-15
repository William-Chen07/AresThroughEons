import type { World } from "./world"

/**
 * Seeded random numbers for pathing choices (where to wander, whether to chat). The state lives
 * in the world, so the same save always plays out the same way and tests are repeatable.
 * Mulberry32: tiny, fast and good enough for gameplay.
 */
export function random(world: World): number {
  let t = (world.rngState = (world.rngState + 0x6d2b79f5) | 0)
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** A random number in [min, max). */
export const randomBetween = (world: World, min: number, max: number) => min + random(world) * (max - min)
