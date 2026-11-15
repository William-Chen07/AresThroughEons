import type { MarsSite } from "@/map/marsSite"

/*
 * Reads real Mars data for the area around a site, as map tiles that a browser
 * is allowed to read pixels from (they all send Access-Control-Allow-Origin: *).
 * Three layers, all served by NASA's own Mars Trek (https://trek.nasa.gov/mars/):
 *
 *  - THEMIS: black-and-white daytime infrared imagery, the sharpest global
 *    layer on NASA's server. Used for the detail.
 *  - Viking: soft colour imagery, used only for the colour.
 *  - MOLA: elevation.
 *
 * (A sharper mosaic, MRO CTX, exists but is served by Esri, not NASA. The team
 * wants NASA sources only.)
 *
 * Every layer is on a plain latitude/longitude grid that starts at 90° N,
 * 180° W: zoom z has 2^z rows and 2^(z+1) columns of square tiles.
 */

interface TileLayer {
  /** For error messages. */
  name: string
  zoom: number
  tilePx: number
  url: (row: number, col: number) => string
}

const trekUrl = (id: string, zoom: number, ext: string) => (row: number, col: number) =>
  `https://trek.nasa.gov/tiles/Mars/EQ/${id}/1.0.0/default/default028mm/${zoom}/${row}/${col}.${ext}`

/**
 * Mars Odyssey THEMIS daytime infrared global mosaic (100 m, v2),
 * NASA/JPL-Caltech/Arizona State University. Infrared shows how warm the
 * ground is in daylight, which picks out slopes, craters and channels clearly.
 * Zoom 9, its sharpest, is about 81 m per pixel. That is one "texel" of the
 * map: each block shows TEXELS_PER_CELL of them a side.
 */
const DETAIL: TileLayer = {
  name: "THEMIS infrared mosaic",
  zoom: 9,
  tilePx: 256,
  url: trekUrl("THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018", 9, "png"),
}
/** Viking MDIM 2.1 colour mosaic, NASA/JPL/USGS. About 325 m per pixel at zoom 7, its sharpest. */
const COLOR: TileLayer = {
  name: "Viking colour mosaic",
  zoom: 7,
  tilePx: 256,
  url: trekUrl("Mars_Viking_MDIM21_ClrMosaic_global_232m", 7, "jpg"),
}
/** MGS MOLA elevation, NASA/GSFC/USGS, as 8-bit grey. About 1.3 km per pixel at zoom 5, its sharpest. */
const ELEVATION: TileLayer = {
  name: "MOLA elevation",
  zoom: 5,
  tilePx: 256,
  url: trekUrl("Mars_MGS_MOLA_DEM_mosaic_global_463m_8", 5, "png"),
}

/*
 * The elevation layer stores height as a grey value from 0 to 255, spread
 * evenly over the MOLA range. Checked against known heights (Olympus Mons
 * summit, Hellas, Jezero and Gale floors): each grey step is about 115 m. The
 * map blends between the samples, so its heights are smooth but only about
 * that precise.
 */
const ELEVATION_MIN_M = -8201
const ELEVATION_MAX_M = 21241

const MARS_MEAN_RADIUS_M = 3_389_500
const METERS_PER_DEGREE = (2 * Math.PI * MARS_MEAN_RADIUS_M) / 360

/** Imagery pixels ("texels") along each side of a map cell. */
export const TEXELS_PER_CELL = 2
/** A texel is one pixel of the detail layer, measured north to south: about 81 m. A cell is about 163 m. */
const METERS_PER_TEXEL = (180 * METERS_PER_DEGREE) / (2 ** DETAIL.zoom * DETAIL.tilePx)
export const METERS_PER_CELL = METERS_PER_TEXEL * TEXELS_PER_CELL

export interface SiteRegion {
  /** Cells per side. Row 0 is the north edge. */
  size: number
  /**
   * Sharp grey imagery, one value per texel (size × TEXELS_PER_CELL a side),
   * row by row. 0 means no data there. Null if the layer couldn't be loaded.
   */
  detail: Uint8Array | null
  /** Surface colour per texel: red, green, blue, alpha. Much softer than `detail`. */
  colors: Uint8ClampedArray
  /** Elevation at the centre of each cell, in metres above the Mars datum. */
  metres: Float32Array
}

interface Bounds {
  north: number
  south: number
  west: number
  east: number
}

/** Tiles of a layer joined into one canvas, and where the wanted bounds lie inside it (in its pixels). */
interface Stitched {
  ctx: CanvasRenderingContext2D
  left: number
  top: number
  width: number
  height: number
}

function loadTile(layer: TileLayer, row: number, col: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    // Without this the browser would refuse to let us read the pixels back.
    image.crossOrigin = "anonymous"
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`${layer.name}: a map tile failed to load (${layer.zoom}/${row}/${col})`))
    image.src = layer.url(row, col)
  })
}

function context2d(width: number, height: number) {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) throw new Error("This browser can't create a 2D canvas")
  return ctx
}

/** Loads the tiles covering `bounds` (plus two pixels around it) and joins them at full size. */
async function stitch(layer: TileLayer, bounds: Bounds): Promise<Stitched> {
  const rows = 2 ** layer.zoom
  const cols = rows * 2
  const size = layer.tilePx
  // The bounds in this layer's own pixel grid.
  const left = ((bounds.west + 180) / 360) * cols * size
  const right = ((bounds.east + 180) / 360) * cols * size
  const top = ((90 - bounds.north) / 180) * rows * size
  const bottom = ((90 - bounds.south) / 180) * rows * size

  const col0 = Math.floor((left - 2) / size)
  const col1 = Math.floor((right + 2) / size)
  const row0 = Math.max(0, Math.floor((top - 2) / size))
  const row1 = Math.min(rows - 1, Math.floor((bottom + 2) / size))

  const ctx = context2d((col1 - col0 + 1) * size, (row1 - row0 + 1) * size)
  const jobs: Promise<void>[] = []
  for (let row = row0; row <= row1; row++) {
    for (let col = col0; col <= col1; col++) {
      // Columns wrap around the planet at 180° longitude.
      const wrapped = ((col % cols) + cols) % cols
      jobs.push(
        loadTile(layer, row, wrapped).then((image) => {
          ctx.drawImage(image, (col - col0) * size, (row - row0) * size, size, size)
        }),
      )
    }
  }
  await Promise.all(jobs)
  return { ctx, left: left - col0 * size, top: top - row0 * size, width: right - left, height: bottom - top }
}

/**
 * The red channel of resampled pixels, with 0 wherever the layer has no data.
 * A pixel that is even slightly see-through counts as no data: at the edge of
 * a gap, resampling blends real pixels with empty ones and leaves a dark line.
 */
function greyOf(rgba: Uint8ClampedArray): Uint8Array {
  const grey = new Uint8Array(rgba.length / 4)
  for (let i = 0; i < grey.length; i++) grey[i] = rgba[i * 4 + 3] < 250 ? 0 : Math.max(1, rgba[i * 4])
  return grey
}

/** The bounds resampled to size × size pixels (red, green, blue, alpha). */
function resample(stitched: Stitched, size: number): Uint8ClampedArray {
  const out = context2d(size, size)
  out.imageSmoothingEnabled = true
  out.imageSmoothingQuality = "high"
  out.drawImage(stitched.ctx.canvas, stitched.left, stitched.top, stitched.width, stitched.height, 0, 0, size, size)
  return out.getImageData(0, 0, size, size).data
}

/**
 * A smooth blend of four evenly spaced values, read between the middle two
 * (a cubic B-spline). Unlike a curve that passes through every value, it never
 * swings above or below them, and it evens out single-step jumps. Both matter
 * here: the elevation's rounding would otherwise show up as rings and bumps.
 */
function curve(a: number, b: number, c: number, d: number, t: number) {
  const u = 1 - t
  return (u * u * u * a + (3 * t * t * t - 6 * t * t + 4) * b + (3 * u * u * u - 6 * u * u + 4) * c + t * t * t * d) / 6
}

/**
 * The red channel at size × size evenly spaced points, as a smooth surface
 * blended from the nearest 4 × 4 pixels, kept as fractions. Used for elevation,
 * where the whole map is only about a dozen pixels across: rounding would
 * leave big flat steps, and straight-line blending gives straight-edged ones.
 */
function sampleSmooth(stitched: Stitched, size: number): Float32Array {
  const { width, height, data } = stitched.ctx.getImageData(0, 0, stitched.ctx.canvas.width, stitched.ctx.canvas.height)
  const at = (x: number, y: number) =>
    data[(Math.max(0, Math.min(height - 1, y)) * width + Math.max(0, Math.min(width - 1, x))) * 4]
  const out = new Float32Array(size * size)
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      // Pixel centres are at half-pixel positions.
      const x = stitched.left + ((col + 0.5) / size) * stitched.width - 0.5
      const y = stitched.top + ((row + 0.5) / size) * stitched.height - 0.5
      const x0 = Math.floor(x)
      const y0 = Math.floor(y)
      const alongRow = (py: number) => curve(at(x0 - 1, py), at(x0, py), at(x0 + 1, py), at(x0 + 2, py), x - x0)
      out[row * size + col] = curve(alongRow(y0 - 1), alongRow(y0), alongRow(y0 + 1), alongRow(y0 + 2), y - y0)
    }
  }
  return out
}

/** Loads the imagery and elevation of the square of ground, `size` cells a side, centred on the site. */
export async function loadSiteRegion(site: MarsSite, size: number): Promise<SiteRegion> {
  // The tile grid squeezes ground east-west as you leave the equator, so the
  // square covers more degrees of longitude than latitude. Reading it this
  // way keeps every cell square on the ground.
  const halfLat = (size * METERS_PER_CELL) / 2 / METERS_PER_DEGREE
  const halfLon = halfLat / Math.cos((site.lat * Math.PI) / 180)
  const bounds: Bounds = {
    north: site.lat + halfLat,
    south: site.lat - halfLat,
    west: site.lon - halfLon,
    east: site.lon + halfLon,
  }
  const texels = size * TEXELS_PER_CELL

  const [detail, colors, grey] = await Promise.all([
    // If the detail layer can't be loaded, the map still works from the soft colour imagery.
    stitch(DETAIL, bounds).then(
      (stitched) => greyOf(resample(stitched, texels)),
      () => null,
    ),
    stitch(COLOR, bounds).then((stitched) => resample(stitched, texels)),
    stitch(ELEVATION, bounds).then((stitched) => sampleSmooth(stitched, size)),
  ])

  const metres = grey.map((value) => ELEVATION_MIN_M + (value / 255) * (ELEVATION_MAX_M - ELEVATION_MIN_M))
  return { size, detail, colors, metres }
}
