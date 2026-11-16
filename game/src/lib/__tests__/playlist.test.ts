import { describe, expect, it } from "vitest"
import { SILENCE, SILENCE_SECONDS, TARGET_LOUDNESS_DB, levelFor, pickNext, silenceSeconds, type Track } from "@/lib/playlist"

const TRACKS: Track[] = [
  { id: "butterfly", kind: "nebula", url: "a.mp3" },
  { id: "bubble", kind: "nebula", url: "b.mp3" },
  { id: "pismis", kind: "nebula", url: "c.mp3" },
  { id: "space", kind: "music", url: "d.mp3" },
  { id: "edm", kind: "music", url: "e.mp3" },
  SILENCE,
]

/** Small seeded generator (mulberry32) so the runs are repeatable. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe("background music playlist", () => {
  it("never plays the same file, or two quiet gaps, back to back, even across a gap", () => {
    const random = seeded(7)
    let previous: Track | null = null
    let lastHeard: Track | null = null
    for (let i = 0; i < 5000; i++) {
      const next = pickNext(TRACKS, [previous, lastHeard], random)
      expect(next.id).not.toBe(previous?.id)
      if (next.kind !== "silence") {
        expect(next.id).not.toBe(lastHeard?.id)
        lastHeard = next
      }
      previous = next
    }
  })

  it("plays every kind and every file over time", () => {
    const random = seeded(42)
    const kinds = new Map<string, number>()
    const ids = new Set<string>()
    let previous: Track | null = null
    for (let i = 0; i < 3000; i++) {
      previous = pickNext(TRACKS, [previous], random)
      kinds.set(previous.kind, (kinds.get(previous.kind) ?? 0) + 1)
      ids.add(previous.id)
    }
    expect(ids.size).toBe(TRACKS.length)
    // A kind is picked first, so silence comes up about as often as nebulae or music, not 1 in 6.
    for (const kind of ["nebula", "silence", "music"]) {
      expect(kinds.get(kind)).toBeGreaterThan(600)
    }
  })

  it("leaves the kind out when its only entry just played", () => {
    // After silence, only nebula and music are possible; the lowest roll picks the first kind.
    expect(pickNext(TRACKS, [SILENCE], () => 0).kind).toBe("nebula")
    expect(pickNext(TRACKS, [SILENCE], () => 0.999).kind).toBe("music")
  })

  it("can start with sound rather than a quiet gap", () => {
    const random = seeded(3)
    for (let i = 0; i < 200; i++) expect(pickNext(TRACKS, [SILENCE], random).kind).not.toBe("silence")
  })

  it("keeps quiet gaps within their set length", () => {
    expect(silenceSeconds(() => 0)).toBe(SILENCE_SECONDS.min)
    expect(silenceSeconds(() => 0.9999)).toBeLessThan(SILENCE_SECONDS.max)
  })

  it("repeats the only file rather than failing", () => {
    expect(pickNext([TRACKS[0]], [TRACKS[0]]).id).toBe("butterfly")
  })

  it("turns loud files down to the same level and never turns quiet ones up", () => {
    const loud: Track = { id: "loud", kind: "music", url: "x.mp3", loudnessDb: TARGET_LOUDNESS_DB + 12 }
    const quiet: Track = { id: "quiet", kind: "nebula", url: "y.mp3", loudnessDb: TARGET_LOUDNESS_DB - 6 }
    expect(levelFor(loud)).toBeCloseTo(0.251, 3)
    expect(levelFor(quiet)).toBe(1)
    expect(levelFor(SILENCE)).toBe(1)
  })
})
