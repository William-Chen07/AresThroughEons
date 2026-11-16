import type { MarsSite } from "@/map/marsSite"
import { NORMAL_RICHNESS, type Richness } from "@/sim/deposits"

/*
 * How rich a landing site is in each mineral, from NASA's global mineral maps:
 * the Thermal Emission Spectrometer (TES) on Mars Global Surveyor, as served by
 * Mars Trek (Bandfield 2002, JGR 107, E6). The maps are coarse (one sample is
 * about 20 km across, about the size of the whole base map), so each gives one
 * value for the site, which scales how many deposits it gets and how big they
 * are (see sim/deposits.ts):
 *
 *   - aluminum from plagioclase feldspar abundance (an aluminum-rich mineral);
 *   - titanium from high-calcium pyroxene, a stand-in for dark basalt, where
 *     titanium-bearing ilmenite is found;
 *   - copper and gold from thermal inertia, a stand-in for exposed bedrock
 *     rather than dust (a game rule: no copper or gold has been mapped on Mars);
 *   - sulfur stays normal: no global map of it is served.
 *
 * Mars Trek serves these maps only as coloured pictures, not numbers. All three
 * use the same scale, purple for low through blue, green and yellow to red for
 * high (checked against Syrtis Major and Arabia Terra, which NASA's own layer
 * notes call high and low), so the colour's hue is read back as a rough value.
 */

const TILE_PX = 256
/** The finest zoom Mars Trek serves these layers at: 2 rows × 4 columns of tiles for the whole planet. */
const ZOOM = 1
/** Give up on a map after this long, so a slow server never holds up the base map. */
const TIMEOUT_MS = 8000

const LAYERS = {
  plagioclase: "TES_Plagioclase",
  pyroxene: "TES_Clinopyroxene",
  inertia: "TES_Thermal_Inertia",
} as const

const tileUrl = (id: string, row: number, col: number) =>
  `https://trek.nasa.gov/tiles/Mars/EQ/${id}/1.0.0/default/default028mm/${ZOOM}/${row}/${col}.png`

/** A colour on the maps' purple-to-red scale as a value from 0 (purple, low) to 1 (red, high). */
export function valueOfColor(red: number, green: number, blue: number): number {
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  if (max === min) return 0
  let hue =
    max === red ? ((green - blue) / (max - min)) % 6 : max === green ? (blue - red) / (max - min) + 2 : (red - green) / (max - min) + 4
  hue = (hue * 60 + 360) % 360
  // Red just past 0° shows up near 360°: still the top of the scale.
  if (hue > 300) hue = 0
  const PURPLE = 265
  return Math.min(1, Math.max(0, (PURPLE - hue) / PURPLE))
}

/** One map's value at the site, or null if it has no data there or didn't load in time. */
async function valueAt(layerId: string, site: MarsSite, signal: AbortSignal): Promise<number | null> {
  const rows = 2 ** ZOOM
  const x = ((site.lon + 180) / 360) * rows * 2 * TILE_PX
  const y = ((90 - site.lat) / 180) * rows * TILE_PX
  const row = Math.min(rows - 1, Math.floor(y / TILE_PX))
  const col = Math.min(rows * 2 - 1, Math.floor(x / TILE_PX))
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`${layerId} didn't load`))
    signal.addEventListener("abort", () => reject(new Error("timed out")))
    img.src = tileUrl(layerId, row, col)
  })
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = TILE_PX
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) return null
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(image, 0, 0)
  // The nearest pixel, read as it is: blending would mix colours into hues that aren't on the scale.
  const px = Math.min(TILE_PX - 1, Math.floor(x - col * TILE_PX))
  const py = Math.min(TILE_PX - 1, Math.floor(y - row * TILE_PX))
  const [red, green, blue, alpha] = ctx.getImageData(px, py, 1, 1).data
  return alpha < 250 ? null : valueOfColor(red, green, blue)
}

/** A 0–1 value as richness: 0.5 for the lowest, 1.5 for the highest, normal (1) when unknown. */
const richnessOf = (value: number | null) => (value === null ? 1 : 0.5 + value)

/**
 * How rich the site is in each mineral, from the TES maps, and whether any of them answered.
 * Never throws: anything that fails or is slow counts as normal richness.
 */
export async function loadRichness(site: MarsSite): Promise<{ richness: Richness; fromNasa: boolean }> {
  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS)
  const read = (id: string) => valueAt(id, site, abort.signal).catch(() => null)
  try {
    const [plagioclase, pyroxene, inertia] = await Promise.all([
      read(LAYERS.plagioclase),
      read(LAYERS.pyroxene),
      read(LAYERS.inertia),
    ])
    return {
      richness: {
        ...NORMAL_RICHNESS,
        aluminum: richnessOf(plagioclase),
        titanium: richnessOf(pyroxene),
        copper: richnessOf(inertia),
        gold: richnessOf(inertia),
      },
      fromNasa: plagioclase !== null || pyroxene !== null || inertia !== null,
    }
  } finally {
    clearTimeout(timer)
  }
}
