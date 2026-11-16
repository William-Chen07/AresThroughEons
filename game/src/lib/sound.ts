import { settingsStore } from "@/lib/settings"
import { SILENCE, levelFor, pickNext, silenceSeconds, type Track } from "@/lib/playlist"
// Imported straight from the repo's root Audio/ folder: the build copies just these
// files into the bundle, and vite.config.ts lets the dev server read that folder.
// "Discovery STS-131: Sound of Launch" from NASA's historical sounds
// (https://www.nasa.gov/historical-sounds/), trimmed and reversed by the team to sound like a landing.
import landingUrl from "../../../Audio/Launch.wav"
// Background music: NASA sonifications of nebulae (space images turned into sound) ...
// The Bubble Nebula one is also cut into the UI sounds below.
import butterflyUrl from "../../../Audio/13998_Butterfly_MP4.mp3"
import bubbleUrl from "../../../Audio/13999_BUBBLE_MP4.mp3"
import pismisUrl from "../../../Audio/14246_PISMIS_VERT_MP4.mp3"
import rsPuppisUrl from "../../../Audio/14260_RS_WIDE_MP4.mp3"
import ngc2392Url from "../../../Audio/NGC 2392.mp3"
import ngc1569Url from "../../../Audio/NGC_1569_VIDEO.mp3"
// ... and two music tracks from Pixabay.
import spaceMusicUrl from "../../../Audio/leberch-space-626368.mp3"
import edmMusicUrl from "../../../Audio/jonasblakewood-edm-edm-music-350632.mp3"

/**
 * Background music and UI sounds, built only from the team's files in the root Audio/ folder.
 *
 * Browsers block audio until the player interacts, so nothing plays before
 * `unlockAudio()` and `startMusic()` run from a click or key press (see App.tsx).
 */

/**
 * Everything the background music picks from; see lib/playlist.ts for how. `loudnessDb` is each
 * file's measured average loudness, used to play them all at the same soft level. Measure a new
 * file the same way (RMS of the decoded audio, all channels) when adding it.
 */
const TRACKS: Track[] = [
  { id: "butterfly", kind: "nebula", url: butterflyUrl, loudnessDb: -15.7 },
  { id: "bubble", kind: "nebula", url: bubbleUrl, loudnessDb: -21 },
  { id: "pismis", kind: "nebula", url: pismisUrl, loudnessDb: -23.8 },
  { id: "rs-puppis", kind: "nebula", url: rsPuppisUrl, loudnessDb: -18.5 },
  { id: "ngc-2392", kind: "nebula", url: ngc2392Url, loudnessDb: -16.4 },
  { id: "ngc-1569", kind: "nebula", url: ngc1569Url, loudnessDb: -13.2 },
  { id: "space", kind: "music", url: spaceMusicUrl, loudnessDb: -16.4 },
  { id: "edm", kind: "music", url: edmMusicUrl, loudnessDb: -10.9 },
  SILENCE,
]
// Background music stays soft: with the default music volume it sits well under the landing
// engine and the button sounds, and it dips further while a lander comes down (see playLanding).
const MUSIC_LEVEL = 0.35
const DUCK_LEVEL = 0.2 // how far the music dips under the landing sound
const FADE_IN_SECONDS = 2
const FADE_OUT_SECONDS = 2

// UI sounds are short slices of a NASA nebula sonification. `at` is roughly
// where to cut (seconds); the loudest moment within `searchSeconds` of it is
// used so a slice never lands on silence. Tune these by ear.
const SFX_URL = bubbleUrl
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
let musicStarted = false
let current: Track | null = null
let lastHeard: Track | null = null // the last file played, remembered through quiet gaps
let silenceTimer: ReturnType<typeof setTimeout> | undefined
let fadingOut = false
let failures = 0 // files in a row that would not play, so a broken build can't spin forever
let ducks = 0 // sounds playing right now that the music should dip under
let context: AudioContext | null = null
let slices: Partial<Record<SfxName, AudioBuffer>> = {}

function musicTarget() {
  const { muted, musicVolume } = settingsStore.getState()
  if (muted || !current) return 0
  return musicVolume * MUSIC_LEVEL * levelFor(current) * (ducks > 0 ? DUCK_LEVEL : 1)
}

/** Dips the background music while an important sound plays; call the returned function when it ends. */
function duckMusic() {
  ducks++
  if (music && !music.paused && !fadingOut) fadeMusicTo(musicTarget(), 0.4)
  let done = false
  return () => {
    if (done) return
    done = true
    ducks--
    if (music && !music.paused && !fadingOut) fadeMusicTo(musicTarget(), 1.5)
  }
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
    // Decoded ahead of time so the landing sound starts with the descent.
    void loadLanding(context).catch(() => {})
  }
  if (context.state === "suspended") void context.resume()
}

function musicElement() {
  if (music) return music
  const el = new Audio()
  el.preload = "auto"
  el.addEventListener("ended", playNextTrack)
  el.addEventListener("error", skipBrokenTrack)
  el.addEventListener("playing", () => {
    failures = 0
  })
  // Fade out just before a track ends so it never stops dead.
  el.addEventListener("timeupdate", () => {
    if (!fadingOut && el.duration - el.currentTime < FADE_OUT_SECONDS) {
      fadingOut = true
      fadeMusicTo(0, FADE_OUT_SECONDS)
    }
  })
  music = el
  return el
}

function skipBrokenTrack() {
  console.warn("[sound] could not play", current?.url)
  if (++failures < TRACKS.length) playNextTrack()
}

function playTrack(track: Track) {
  current = track
  clearTimeout(silenceTimer)
  cancelAnimationFrame(musicFade)
  const el = musicElement()
  if (track.kind === "silence" || !track.url) {
    el.pause()
    silenceTimer = setTimeout(playNextTrack, silenceSeconds() * 1000)
    return
  }
  lastHeard = track
  fadingOut = false
  el.src = track.url
  el.volume = 0
  resumeTrack()
}

function resumeTrack() {
  const el = musicElement()
  el.play().then(
    () => fadeMusicTo(musicTarget(), FADE_IN_SECONDS),
    (error: unknown) => {
      // Blocked until the player interacts: the next click or key press calls startMusic again.
      if (error instanceof DOMException && error.name === "NotAllowedError") return
      // A newer track replaced this one before it started: nothing went wrong.
      if (error instanceof DOMException && error.name === "AbortError") return
      skipBrokenTrack()
    },
  )
}

function playNextTrack() {
  playTrack(pickNext(TRACKS, [current, lastHeard]))
}

/**
 * Starts the background music, which then keeps going on every screen: a random nebula
 * sonification, quiet gap or music track, one after another, never the same one twice in a row.
 * Call from a user gesture. Safe to call repeatedly; it also retries a start the browser blocked.
 */
export function startMusic() {
  if (!musicStarted) {
    musicStarted = true
    // Open with sound rather than a quiet gap, so the player can tell the music is on.
    playTrack(pickNext(TRACKS, [SILENCE]))
    return
  }
  if (current?.kind !== "silence" && music?.paused && !music.ended) resumeTrack()
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

// The lander's engine, played whole each time a lander comes down (see map/mapView.ts).
// The recording is quiet (its loudest moment is about 12 dB under full scale), so it is boosted
// to stand out over the music; even at full SFX volume it peaks around -4 dB, so it never clips.
const LANDING_GAIN = 2.5
let landingBuffer: Promise<AudioBuffer> | null = null

function loadLanding(ctx: AudioContext) {
  landingBuffer ??= fetch(landingUrl)
    .then((answer) => answer.arrayBuffer())
    .then((bytes) => ctx.decodeAudioData(bytes))
  landingBuffer.catch((error) => {
    console.warn("[sound] could not load the landing sound", error)
    landingBuffer = null
  })
  return landingBuffer
}

/**
 * Plays the landing engine sound once, at the SFX volume. Returns a function
 * that stops it early, for when the player leaves the map mid-landing.
 */
export function playLanding(): () => void {
  const ctx = context
  let source: AudioBufferSourceNode | null = null
  let stopped = false
  if (ctx) {
    void loadLanding(ctx).then((buffer) => {
      const { muted, sfxVolume } = settingsStore.getState()
      if (stopped || muted || sfxVolume === 0) return
      source = ctx.createBufferSource()
      source.buffer = buffer
      const gain = ctx.createGain()
      gain.gain.value = LANDING_GAIN * sfxVolume
      source.connect(gain).connect(ctx.destination)
      // The music dips for as long as the engine is heard, so the landing always comes through.
      const unduck = duckMusic()
      source.onended = unduck
      source.start()
    })
  }
  return () => {
    stopped = true
    source?.stop()
  }
}

// Follow volume and mute changes live.
settingsStore.subscribe(() => {
  if (music && !music.paused && !fadingOut) fadeMusicTo(musicTarget(), 0.3)
})
