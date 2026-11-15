import { settingsStore } from "@/lib/settings"
// Imported straight from the repo's root Audio/ folder: the build copies just these two
// files into the bundle, and vite.config.ts lets the dev server read that folder.
import musicUrl from "../../../Audio/leberch-space-626368.mp3"
import sfxSourceUrl from "../../../Audio/13999_BUBBLE_MP4.mp3"

/**
 * Menu music and UI sounds, built only from the team's files in the root Audio/ folder.
 *
 * Browsers block audio until the player interacts, so nothing plays before
 * `unlockAudio()` runs from a click or key press.
 */

const MUSIC_URL = musicUrl
const MUSIC_LEVEL = 0.6 // music sits under the UI sounds even at full volume

// UI sounds are short slices of a NASA nebula sonification. `at` is roughly
// where to cut (seconds); the loudest moment within `searchSeconds` of it is
// used so a slice never lands on silence. Tune these by ear.
const SFX_URL = sfxSourceUrl
const SFX = {
  hover: { at: 20, length: 0.09, rate: 1.6, gain: 0.25 },
  click: { at: 45, length: 0.16, rate: 1.2, gain: 0.55 },
  locked: { at: 45, length: 0.22, rate: 0.6, gain: 0.5 },
  open: { at: 75, length: 0.4, rate: 1, gain: 0.4 },
} as const
const SEARCH_SECONDS = 4

export type SfxName = keyof typeof SFX

let music: HTMLAudioElement | null = null
let musicFade = 0
let context: AudioContext | null = null
let slices: Partial<Record<SfxName, AudioBuffer>> = {}

function musicTarget() {
  const { muted, musicVolume } = settingsStore.getState()
  return muted ? 0 : musicVolume * MUSIC_LEVEL
}

function fadeMusicTo(target: number, seconds: number, then?: () => void) {
  if (!music) return
  cancelAnimationFrame(musicFade)
  const el = music
  const from = el.volume
  const start = performance.now()
  const step = () => {
    const k = Math.min((performance.now() - start) / (seconds * 1000), 1)
    el.volume = from + (target - from) * k
    if (k < 1) musicFade = requestAnimationFrame(step)
    else then?.()
  }
  step()
}

/** Copy the loudest `length`-second window near `at` into its own small buffer. */
function cutSlice(ctx: AudioContext, source: AudioBuffer, at: number, length: number) {
  const rate = source.sampleRate
  const size = Math.floor(length * rate)
  const data = source.getChannelData(0)
  const from = Math.max(0, Math.floor((at - SEARCH_SECONDS) * rate))
  const to = Math.min(data.length - size, Math.floor((at + SEARCH_SECONDS) * rate))
  let best = Math.max(0, Math.min(from, data.length - size))
  let bestEnergy = -1
  const hop = Math.floor(rate * 0.01)
  for (let start = from; start <= to; start += hop) {
    let energy = 0
    for (let i = start; i < start + size; i += 32) energy += data[i] * data[i]
    if (energy > bestEnergy) {
      bestEnergy = energy
      best = start
    }
  }
  const slice = ctx.createBuffer(source.numberOfChannels, size, rate)
  for (let c = 0; c < source.numberOfChannels; c++) {
    slice.copyToChannel(source.getChannelData(c).subarray(best, best + size), c)
  }
  return slice
}

async function loadSlices(ctx: AudioContext) {
  const bytes = await (await fetch(SFX_URL)).arrayBuffer()
  const full = await ctx.decodeAudioData(bytes)
  // Keep only the tiny slices; the full two-minute recording can be freed.
  slices = Object.fromEntries(
    Object.entries(SFX).map(([name, s]) => [name, cutSlice(ctx, full, s.at, s.length)]),
  )
}

/** Call from a user gesture. Safe to call repeatedly. */
export function unlockAudio() {
  if (!context) {
    context = new AudioContext()
    loadSlices(context).catch((error) => {
      console.warn("[sound] could not load UI sounds", error)
    })
  }
  if (context.state === "suspended") void context.resume()
}

export function startMusic() {
  if (!music) {
    music = new Audio(MUSIC_URL)
    music.loop = true
    music.volume = 0
  }
  if (music.paused) {
    music.play().catch(() => {
      /* still blocked; the next gesture retries */
    })
  }
  fadeMusicTo(musicTarget(), 2)
}

export function stopMusic(fadeSeconds = 0.8) {
  fadeMusicTo(0, fadeSeconds, () => music?.pause())
}

export function playSfx(name: SfxName) {
  const { muted, sfxVolume } = settingsStore.getState()
  const buffer = slices[name]
  if (!context || !buffer || muted || sfxVolume === 0) return
  const s = SFX[name]
  const source = context.createBufferSource()
  source.buffer = buffer
  source.playbackRate.value = s.rate
  // 5 ms attack, then an exponential tail so every slice sounds like a soft blip.
  const gain = context.createGain()
  const now = context.currentTime
  const duration = s.length / s.rate
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(s.gain * sfxVolume, now + 0.005)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
  source.connect(gain).connect(context.destination)
  source.start(now)
  source.stop(now + duration)
}

// Follow volume and mute changes live.
settingsStore.subscribe(() => {
  if (music && !music.paused) fadeMusicTo(musicTarget(), 0.3)
})
