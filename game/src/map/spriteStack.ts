import { Assets, Container, Rectangle, Sprite, Texture } from "pixi.js"
import { MODULE_STACKS, type ModuleTypeId } from "@/content/modules"

/*
 * Sprite stacks: a module's art is a pile of thin horizontal slices, each drawn one map pixel
 * above the one below, so the pile reads as a solid shape seen from above and tipped, the way
 * the terrain is. The slices come from assets/blender/slicer.py as one strip image (bottom
 * slice on the left) and a small JSON file saying how the strip is cut.
 *
 * A module with no stack files yet keeps its placeholder drawing (see map/baseView.ts).
 */

export interface SpriteStack {
  /** One texture per slice, bottom first. */
  frames: Texture[]
  /** Size of one slice, in map pixels. */
  width: number
  height: number
}

const stacks = new Map<ModuleTypeId, SpriteStack>()
let loading: Promise<void> | null = null

async function loadStack(path: string): Promise<SpriteStack | null> {
  try {
    const url = import.meta.env.BASE_URL + path
    const response = await fetch(`${url}_stack.json`)
    if (!response.ok) return null
    const { w, h, layers } = (await response.json()) as { w: number; h: number; layers: number }
    const strip = await Assets.load<Texture>(`${url}_stack.png`)
    // Pixel art: no smoothing when the camera zooms in.
    strip.source.scaleMode = "nearest"
    const frames = Array.from(
      { length: layers },
      (_, i) => new Texture({ source: strip.source, frame: new Rectangle(i * w, 0, w, h) }),
    )
    return { frames, width: w, height: h }
  } catch {
    // No files for this module yet (or a broken one): it keeps its placeholder.
    return null
  }
}

/** Loads every stack listed in MODULE_STACKS. Safe to call more than once: the work is done once. */
export function loadModuleStacks(): Promise<void> {
  loading ??= Promise.all(
    (Object.entries(MODULE_STACKS) as [ModuleTypeId, string][]).map(async ([id, path]) => {
      const stack = await loadStack(path)
      if (stack) stacks.set(id, stack)
    }),
  ).then(() => {})
  return loading
}

/** The eras that have their own lander art (assets/blender/eraN.blend). Later eras come down in the last one. */
export const LANDER_ERAS = 4
const landers = new Map<number, Promise<SpriteStack | null>>()

/** The lander an era comes down in, as a sprite stack, or null if its files can't be loaded. */
export function loadLanderStack(era: number): Promise<SpriteStack | null> {
  const which = Math.min(Math.max(1, era), LANDER_ERAS)
  let stack = landers.get(which)
  if (!stack) {
    stack = loadStack(`sprites/era${which}/lander`)
    landers.set(which, stack)
  }
  return stack
}

/** A module type's stack, or undefined if it has none (or it hasn't loaded yet). */
export const moduleStack = (id: ModuleTypeId) => stacks.get(id)

/**
 * The stack as something to put on the map. Its (0, 0) is the top-left corner of the footprint;
 * the slices rise above it. `tint` colours every slice (white leaves the art as it is).
 */
export function createStackSprite(stack: SpriteStack, tint = 0xffffff): Container {
  const pile = new Container()
  stack.frames.forEach((frame, i) => {
    const slice = new Sprite(frame)
    slice.y = -i
    slice.tint = tint
    pile.addChild(slice)
  })
  return pile
}
