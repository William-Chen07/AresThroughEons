import type { MarsSite } from "@/map/marsSite"
import { METERS_PER_CELL, TEXELS_PER_CELL, loadSiteRegion, type SiteRegion } from "@/map/marsTrek"

/*
 * Turns the NASA data for a site into a grid of voxel columns: one column per
 * map cell, with its height taken from the elevation and its top face showing
 * a small patch of the real imagery, redrawn as pixel art. The grid is what the base builder will
 * place things on.
 *
 * It is drawn top-down with a little depth: a taller column is shifted up the
 * screen and shows its south face, so the ground reads as stacked blocks
 * while the cells stay in a plain square grid.
 */

/** Cells per side. With cells about 163 m across, the map covers about 26 km. */
export const MAP_SIZE = 160
/** Columns are 0 to MAX_LEVEL blocks tall. */
export const MAX_LEVEL = 16
/** Screen size of an imagery texel, a cell's top face, and the lift per block of height, in map pixels. */
const TEXEL_PX = 8
export const CELL_PX = TEXEL_PX * TEXELS_PER_CELL
export const LEVEL_PX = 10
/** How many cells away a tall column can cast its shadow. */
const SHADOW_REACH = 2
/** Room above the north edge for the tallest columns there. */
const TOP_MARGIN_PX = MAX_LEVEL * LEVEL_PX

/**
 * The least real height one block may stand for. The elevation data is only
 * precise to about 115 m, so smaller steps would be drawing its rounding
 * noise as hills. A site with little relief gets few levels and stays flat;
 * one with a lot (a canyon wall, a volcano flank) is squeezed into MAX_LEVEL.
 */
const MIN_METERS_PER_LEVEL = 115

export interface VoxelTerrain {
  site: MarsSite
  /** Cells per side. Cell (col, row) is at index row * size + col; row 0 is the north edge. */
  size: number
  metersPerCell: number
  /** Real metres of height per block for this site. */
  metersPerLevel: number
  /** Column height in blocks, 0 to MAX_LEVEL. */
  levels: Uint8Array
  /** Real elevation in metres above the Mars datum (from MOLA, about 115 m precise). */
  metres: Float32Array
  /** Average colour of each cell's top: red, green, blue. */
  colors: Uint8Array
  /** The imagery on the cell tops: red, green, blue per texel, size × TEXELS_PER_CELL texels a side. */
  texture: Uint8Array
}

export interface Cell {
  col: number
  row: number
}

/*
 * The pixel-art pass. Raw orbital imagery is soft and murky, so the map is
 * redrawn from it in a small fixed set of Mars colours:
 *   1. sharpen the detail imagery a little,
 *   2. stretch the site's brightness range to use every tone,
 *   3. snap each texel to one of the TONES below, dithering between
 *      neighbouring tones in a fixed 4 × 4 pattern so slopes fade smoothly,
 *   4. lean the result toward the real colour of the place.
 * The pattern of light and dark is the real ground; the colours are a palette.
 */

/**
 * Dark to light. Each step also shifts hue (cooler shadows, warmer highlights), as pixel-art ramps do.
 * The dark end stops at a mid brown on purpose: the infrared imagery shows cold, shadowed slopes as
 * nearly black, and with darker tones here whole valleys turned into black holes.
 */
const TONES = [
  [104, 60, 56],
  [124, 72, 60],
  [144, 86, 64],
  [163, 101, 71],
  [182, 118, 82],
  [201, 138, 98],
  [219, 160, 118],
  [236, 188, 144],
]
/** Ordered-dither thresholds (Bayer 4 × 4), from 0 to 1. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => (n + 0.5) / 16)
/** Below 1 brightens the mid-tones; 1 leaves them alone. */
const BRIGHTEN = 0.75
/** 0 is hard bands between tones, 1 is dithering everywhere. */
const DITHER = 0.7
/** How much the detail imagery is sharpened before it's reduced to tones. */
const SHARPEN = 0.8
/** Don't stretch flat, featureless ground so hard that the imagery's noise becomes the picture. */
const MAX_GAIN = 4
/**
 * How far the palette leans toward the place's real colour, and the most a
 * channel may move. Enough that dark lava plains and pale dust look different.
 */
const SITE_COLOR_SHARE = 0.3
const SITE_COLOR_LIMIT = 0.3
/** The tint (red, green, blue for a brightness of 1) the TONES are painted in. */
const PALETTE_TINT = [1.24, 0.94, 0.72]

const brightness = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b

/** Each value plus a share of its difference from the average of the 3 × 3 around it. */
function sharpen(grey: Uint8Array, side: number): Float32Array {
  const out = new Float32Array(grey.length)
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      let sum = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          sum += grey[Math.max(0, Math.min(side - 1, y + dy)) * side + Math.max(0, Math.min(side - 1, x + dx))]
        }
      }
      const value = grey[y * side + x]
      out[y * side + x] = value + SHARPEN * (value - sum / 9)
    }
  }
  return out
}

/**
 * The darkest and lightest values worth showing. It skips the darkest and
 * lightest 2% so a single shadow or frost patch doesn't set the scale.
 */
function brightnessRange(values: Float32Array) {
  const sorted = Float32Array.from(values).sort()
  const dark = sorted[Math.floor(sorted.length * 0.02)]
  const light = sorted[Math.floor(sorted.length * 0.98)]
  // A range narrower than this is noise, not terrain: widen it around its middle.
  const span = Math.max(light - dark, 255 / MAX_GAIN)
  return { dark: (dark + light) / 2 - span / 2, span }
}

/** Redraws the site's imagery as pixel art (see above). Returns red, green, blue per texel. */
function pixelArt(region: SiteRegion): Uint8Array {
  const side = region.size * TEXELS_PER_CELL
  const count = side * side
  const softBrightness = new Uint8Array(count)
  for (let i = 0; i < count; i++) {
    softBrightness[i] = Math.max(1, brightness(region.colors[i * 4], region.colors[i * 4 + 1], region.colors[i * 4 + 2]))
  }
  // Where the detail layer has no data (or didn't load), fall back to the soft colour imagery.
  const detail = region.detail
  const grey = sharpen(detail ? detail.map((value, i) => value || softBrightness[i]) : softBrightness, side)
  const range = brightnessRange(grey)

  const texture = new Uint8Array(count * 3)
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const i = y * side + x
      // The power below 1 pushes the middle of the range toward the lighter tones, so the map isn't murky.
      const position = Math.max(0, Math.min(1, (grey[i] - range.dark) / range.span)) ** BRIGHTEN * (TONES.length - 1)
      const threshold = 0.5 + (BAYER[(y % 4) * 4 + (x % 4)] - 0.5) * DITHER
      const tone = TONES[Math.min(TONES.length - 1, Math.floor(position) + (position % 1 > threshold ? 1 : 0))]
      for (let c = 0; c < 3; c++) {
        // How this place's colour differs from the palette's, in coarse steps so the palette stays small.
        const siteTint = region.colors[i * 4 + c] / softBrightness[i] / PALETTE_TINT[c]
        const lean = Math.max(-SITE_COLOR_LIMIT, Math.min(SITE_COLOR_LIMIT, (siteTint - 1) * SITE_COLOR_SHARE))
        texture[i * 3 + c] = Math.max(0, Math.min(255, tone[c] * (1 + Math.round(lean / 0.1) * 0.1)))
      }
    }
  }
  return texture
}

export function buildTerrain(site: MarsSite, region: SiteRegion): VoxelTerrain {
  const { size, metres } = region
  let low = Infinity
  let high = -Infinity
  for (const m of metres) {
    if (m < low) low = m
    if (m > high) high = m
  }
  const metersPerLevel = Math.max((high - low) / MAX_LEVEL, MIN_METERS_PER_LEVEL)
  const levels = Uint8Array.from(metres, (m) => Math.min(MAX_LEVEL, Math.round((m - low) / metersPerLevel)))

  const texture = pixelArt(region)
  const texels = size * TEXELS_PER_CELL
  const colors = new Uint8Array(size * size * 3)
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0
        for (let ty = 0; ty < TEXELS_PER_CELL; ty++) {
          for (let tx = 0; tx < TEXELS_PER_CELL; tx++) {
            sum += texture[((row * TEXELS_PER_CELL + ty) * texels + col * TEXELS_PER_CELL + tx) * 3 + c]
          }
        }
        colors[(row * size + col) * 3 + c] = sum / TEXELS_PER_CELL ** 2
      }
    }
  }
  return { site, size, metersPerCell: METERS_PER_CELL, metersPerLevel, levels, metres, colors, texture }
}

export async function loadTerrain(site: MarsSite): Promise<VoxelTerrain> {
  return buildTerrain(site, await loadSiteRegion(site, MAP_SIZE))
}

/** Size of the drawn map in map pixels. */
export function terrainPixelSize(terrain: VoxelTerrain) {
  return { width: terrain.size * CELL_PX, height: terrain.size * CELL_PX + TOP_MARGIN_PX }
}

function levelAt(terrain: VoxelTerrain, col: number, row: number) {
  return terrain.levels[row * terrain.size + col]
}

/** Where a cell's top face is drawn, in map pixels (its top-left corner; the face is CELL_PX square). */
export function cellTopLeft(terrain: VoxelTerrain, { col, row }: Cell) {
  return { x: col * CELL_PX, y: TOP_MARGIN_PX + row * CELL_PX - levelAt(terrain, col, row) * LEVEL_PX }
}

/** The cell drawn at a point of the map, or null outside it. Taller columns in front hide the ones behind. */
export function pickCell(terrain: VoxelTerrain, x: number, y: number): Cell | null {
  const col = Math.floor(x / CELL_PX)
  if (col < 0 || col >= terrain.size) return null
  const flatRow = Math.floor((y - TOP_MARGIN_PX) / CELL_PX)
  // A raised column is drawn above its flat position, so the hit can be up to
  // MAX_LEVEL blocks' worth of rows further south. Check from the front.
  const southmost = Math.min(terrain.size - 1, flatRow + Math.ceil(TOP_MARGIN_PX / CELL_PX))
  for (let row = southmost; row >= Math.max(0, flatRow); row--) {
    const level = levelAt(terrain, col, row)
    const south = row + 1 < terrain.size ? levelAt(terrain, col, row + 1) : 0
    const top = TOP_MARGIN_PX + row * CELL_PX - level * LEVEL_PX
    // The column's own top face, plus its south face where it stands above its neighbour.
    const bottom = TOP_MARGIN_PX + (row + 1) * CELL_PX - Math.min(level, south) * LEVEL_PX
    if (y >= top && y < bottom) return { col, row }
  }
  return null
}

/**
 * Draws the whole terrain once into a canvas. The map never changes, so this
 * is the game's background image. It writes pixels straight into a buffer,
 * because the map has about a hundred thousand texels and a canvas call for
 * each would be slow.
 */
export function renderTerrain(terrain: VoxelTerrain): HTMLCanvasElement {
  const { size } = terrain
  const texels = size * TEXELS_PER_CELL
  const { width, height } = terrainPixelSize(terrain)
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("This browser can't create a 2D canvas")
  const image = ctx.createImageData(width, height)
  const bytes = image.data

  /** Fills a rectangle with a colour times a brightness factor. */
  const fill = (x: number, y: number, w: number, h: number, r: number, g: number, b: number, factor: number) => {
    const red = Math.min(255, r * factor)
    const green = Math.min(255, g * factor)
    const blue = Math.min(255, b * factor)
    for (let py = Math.max(0, y); py < Math.min(height, y + h); py++) {
      for (let i = (py * width + x) * 4; i < (py * width + x + w) * 4; i += 4) {
        bytes[i] = red
        bytes[i + 1] = green
        bytes[i + 2] = blue
        bytes[i + 3] = 255
      }
    }
  }
  /** Brightens or darkens what is already drawn in a rectangle. */
  const tone = (x: number, y: number, w: number, h: number, factor: number) => {
    for (let py = Math.max(0, y); py < Math.min(height, y + h); py++) {
      for (let i = (py * width + x) * 4; i < (py * width + x + w) * 4; i += 4) {
        bytes[i] = Math.min(255, bytes[i] * factor)
        bytes[i + 1] = Math.min(255, bytes[i + 1] * factor)
        bytes[i + 2] = Math.min(255, bytes[i + 2] * factor)
      }
    }
  }

  // North to south, so nearer columns are painted over the ones behind them.
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const index = row * size + col
      const level = terrain.levels[index]
      const x = col * CELL_PX
      const y = TOP_MARGIN_PX + row * CELL_PX - level * LEVEL_PX

      // Top face: the imagery. Higher ground is lighter, and a taller column
      // to the west or north (where the light comes from) casts a shadow on it.
      const west = col > 0 ? terrain.levels[index - 1] : level
      const north = row > 0 ? terrain.levels[index - size] : level
      const east = col + 1 < size ? terrain.levels[index + 1] : level
      // A shadow reaches further the taller the column casting it: one more cell per block of height.
      let westShadow = 0
      let northShadow = 0
      for (let reach = 1; reach <= SHADOW_REACH; reach++) {
        if (col - reach >= 0) westShadow = Math.max(westShadow, terrain.levels[index - reach] - level - (reach - 1))
        if (row - reach >= 0) northShadow = Math.max(northShadow, terrain.levels[index - reach * size] - level - (reach - 1))
      }
      const shadow = Math.min(3, westShadow) * 0.05 + Math.min(3, northShadow) * 0.03
      // Each level up is a little lighter, so height reads even where there's no step nearby.
      // The lowest ground is drawn at nearly full brightness: darkening it made whole maps murky.
      const light = Math.min(1.3, 0.96 + 0.035 * level) - shadow
      for (let ty = 0; ty < TEXELS_PER_CELL; ty++) {
        for (let tx = 0; tx < TEXELS_PER_CELL; tx++) {
          const t = ((row * TEXELS_PER_CELL + ty) * texels + col * TEXELS_PER_CELL + tx) * 3
          fill(
            x + tx * TEXEL_PX,
            y + ty * TEXEL_PX,
            TEXEL_PX,
            TEXEL_PX,
            terrain.texture[t],
            terrain.texture[t + 1],
            terrain.texture[t + 2],
            light,
          )
        }
      }
      // A darker line on two edges separates the blocks.
      tone(x + CELL_PX - 1, y, 1, CELL_PX, 0.9)
      tone(x, y + CELL_PX - 1, CELL_PX, 1, 0.9)
      // Edges of a step: lit where the ground drops away toward the light,
      // dark where it drops away from it. This is what shows steps running north-south.
      if (west < level) tone(x, y, 2, CELL_PX, 1.22)
      if (north < level) tone(x, y, CELL_PX, 2, 1.22)
      if (east < level) tone(x + CELL_PX - 3, y, 3, CELL_PX, 0.76)

      // South face, where this column stands above the one in front of it
      // (or above the map's edge). One band per block of height.
      const south = row + 1 < size ? terrain.levels[index + size] : 0
      const r = terrain.colors[index * 3]
      const g = terrain.colors[index * 3 + 1]
      const b = terrain.colors[index * 3 + 2]
      for (let block = level; block > south; block--) {
        const faceY = TOP_MARGIN_PX + (row + 1) * CELL_PX - block * LEVEL_PX
        fill(x, faceY, CELL_PX, LEVEL_PX - 1, r, g, b, 0.66)
        fill(x, faceY + LEVEL_PX - 1, CELL_PX, 1, r, g, b, 0.54)
      }
    }
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}
