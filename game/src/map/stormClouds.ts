/*
 * The picture of the radiation storm's clouds: a small square of blocky green
 * cloud, drawn in code, that repeats with no visible seam. StormOverlay.tsx
 * scales it up with hard pixel edges, so the clouds are pixel art like the map.
 */

/** A steady pseudo-random number from 0 up to 1 for a grid point. */
function hash(x: number, y: number, seed: number) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const smooth = (t: number) => t * t * (3 - 2 * t)

/** Smooth noise from 0 to 1 that wraps round every `period` units, so the picture tiles. */
export function wrappedNoise(x: number, y: number, period: number, seed: number) {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const tx = smooth(x - x0)
  const ty = smooth(y - y0)
  const at = (dx: number, dy: number) => hash((x0 + dx) % period, (y0 + dy) % period, seed)
  const top = at(0, 0) + (at(1, 0) - at(0, 0)) * tx
  const bottom = at(0, 1) + (at(1, 1) - at(0, 1)) * tx
  return top + (bottom - top) * ty
}

/**
 * Cloud bands from thin edge to thick middle: how cloudy a spot must be (0 to 1) to
 * get the band, and the band's colour. Anything less cloudy than the first is clear sky.
 */
const BANDS = [
  { from: 0.57, color: [70, 200, 70, 0.2] },
  { from: 0.62, color: [95, 230, 80, 0.32] },
  { from: 0.67, color: [140, 250, 100, 0.42] },
  { from: 0.73, color: [200, 255, 150, 0.5] },
] as const

/** Draws the cloud tile, `size` pixels square, and returns it as an image URL. */
export function stormCloudTile(size = 96, seed = 7): string {
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = size
  const context = canvas.getContext("2d")
  if (!context) return ""
  const image = context.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Big shapes plus two layers of finer detail.
      let cloudiness = 0
      let weight = 0
      for (const [period, amount] of [
        [3, 1],
        [6, 0.5],
        [12, 0.25],
      ]) {
        cloudiness += wrappedNoise((x / size) * period, (y / size) * period, period, seed + period) * amount
        weight += amount
      }
      cloudiness /= weight
      const band = BANDS.findLast((b) => cloudiness >= b.from)
      if (!band) continue
      const i = (y * size + x) * 4
      image.data[i] = band.color[0]
      image.data[i + 1] = band.color[1]
      image.data[i + 2] = band.color[2]
      image.data[i + 3] = Math.round(band.color[3] * 255)
    }
  }
  context.putImageData(image, 0, 0)
  return canvas.toDataURL()
}
