import { wrappedNoise } from "@/map/stormClouds"

/*
 * The ground of the explore map: a small picture of made-up Martian terrain in
 * a few flat tones, drawn in code and scaled up with hard pixel edges, so it is
 * pixel art like the base map. It is a placeholder, not real imagery.
 */

/** Ground tones from low and dark to high and pale, close to the base map's colours. */
const TONES = [
  [150, 92, 74],
  [172, 108, 86],
  [193, 126, 100],
  [210, 146, 118],
  [226, 170, 142],
]

/** Draws the ground, `width` by `height` pixels, and returns it as an image URL. */
export function exploreBackdrop(width = 96, height = 60, seed = 21): string {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")
  if (!context) return ""
  const image = context.createImageData(width, height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Big landforms plus two layers of finer detail. Both directions use the width, so shapes aren't stretched.
      const u = x / width
      const v = y / width
      const ground =
        (wrappedNoise(u * 4, v * 4, 4, seed) +
          wrappedNoise(u * 9, v * 9, 9, seed + 1) * 0.5 +
          wrappedNoise(u * 20, v * 20, 20, seed + 2) * 0.25) /
        1.75
      const tone = TONES[Math.max(0, Math.min(TONES.length - 1, Math.floor((ground - 0.28) / 0.09)))]
      const i = (y * width + x) * 4
      image.data[i] = tone[0]
      image.data[i + 1] = tone[1]
      image.data[i + 2] = tone[2]
      image.data[i + 3] = 255
    }
  }
  context.putImageData(image, 0, 0)
  return canvas.toDataURL()
}
