/** A point on Mars, in degrees. Latitude is positive north; longitude is positive east, from -180 to 180. */
export interface MarsSite {
  lat: number
  lon: number
}

/**
 * Sites stay between 60° south and 60° north. Nearer the poles the map
 * imagery is stretched too far sideways to make a good local map.
 */
const MAX_LAT = 60

const round3 = (value: number) => Math.round(value * 1000) / 1000

/** A random landing site, spread evenly over the surface (not bunched up toward the poles). */
export function randomSite(random: () => number = Math.random): MarsSite {
  const maxSin = Math.sin((MAX_LAT * Math.PI) / 180)
  const lat = (Math.asin((random() * 2 - 1) * maxSin) * 180) / Math.PI
  const lon = random() * 360 - 180
  return { lat: round3(lat), lon: round3(lon) }
}

/** "18.444° N, 77.451° E" */
export function formatSite({ lat, lon }: MarsSite) {
  const part = (value: number, positive: string, negative: string) =>
    `${Math.abs(value).toFixed(3)}° ${value >= 0 ? positive : negative}`
  return `${part(lat, "N", "S")}, ${part(lon, "E", "W")}`
}

/**
 * Dev-only: open a chosen place instead of the save's site, e.g.
 *   /?site=18.444,77.451   (Jezero crater)
 *   /?site=-4.59,137.44    (Gale crater)
 */
export function devSiteOverride(): MarsSite | null {
  if (!import.meta.env.DEV) return null
  const [lat, lon] = (new URLSearchParams(window.location.search).get("site") ?? "").split(",").map(Number)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  return { lat: Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)), lon: ((((lon + 180) % 360) + 360) % 360) - 180 }
}
