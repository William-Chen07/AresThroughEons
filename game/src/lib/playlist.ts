/**
 * Picks what the background music plays next. Kept free of audio and asset imports so it can be
 * tested on its own (see sound.ts for the player that uses it).
 *
 * Each pick first chooses one of the three kinds at random (a nebula sonification, a quiet gap,
 * or a music track) and then an entry of that kind. What just played is never picked again
 * straight away, and neither is the last file heard before a quiet gap, so the same file never
 * plays twice in a row and a quiet gap is always followed by sound.
 */

export type TrackKind = "nebula" | "silence" | "music"

export interface Track {
  /** Unique name, used to avoid repeats. */
  id: string
  kind: TrackKind
  /** The audio file, for nebula and music entries. */
  url?: string
  /** The file's average loudness (RMS, in dB below full scale), measured once, for level matching. */
  loudnessDb?: number
}

/** Every file is turned down to this average loudness, so no track jumps out over the others. */
export const TARGET_LOUDNESS_DB = -24

/** How much to turn a track down (0 to 1) so it plays at `TARGET_LOUDNESS_DB`. Never turns one up. */
export function levelFor(track: Track) {
  if (track.loudnessDb === undefined) return 1
  return Math.min(1, 10 ** ((TARGET_LOUDNESS_DB - track.loudnessDb) / 20))
}

export const SILENCE: Track = { id: "silence", kind: "silence" }

/** How long a quiet gap lasts, in seconds. */
export const SILENCE_SECONDS = { min: 20, max: 45 } as const

export function silenceSeconds(random: () => number = Math.random) {
  return SILENCE_SECONDS.min + random() * (SILENCE_SECONDS.max - SILENCE_SECONDS.min)
}

const pickFrom = <T>(items: readonly T[], random: () => number) =>
  items[Math.min(Math.floor(random() * items.length), items.length - 1)]

/**
 * The next entry to play: a random kind, then a random entry of that kind, never one in `recent`
 * (what just played, and the last file heard if that was a quiet gap). Kinds with nothing left to
 * choose from (for example silence right after silence) sit that turn out.
 */
export function pickNext(
  tracks: readonly Track[],
  recent: readonly (Track | null)[],
  random: () => number = Math.random,
): Track {
  if (tracks.length === 0) throw new Error("pickNext needs at least one track")
  const skip = new Set(recent.map((track) => track?.id))
  const choices = tracks.filter((track) => !skip.has(track.id))
  if (choices.length === 0) return tracks[0]
  const kinds = [...new Set(choices.map((track) => track.kind))]
  const kind = pickFrom(kinds, random)
  return pickFrom(
    choices.filter((track) => track.kind === kind),
    random,
  )
}
