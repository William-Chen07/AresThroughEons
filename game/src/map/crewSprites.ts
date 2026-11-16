import { Assets, Texture } from "pixi.js"
import { OCCUPATIONS } from "@/sim/occupations"
import type { OccupationId } from "@/sim/types"

/*
 * The astronaut pictures. Each crewmate has one for outdoors (a white suit and helmet) and one
 * for indoors (a jumpsuit), named after the colour of their suit: the files are made by
 * assets/blender/modules/era1_pawn.py.
 *
 * The game knows a crewmate by their suit colour (see sim/occupations.ts), so that colour picks
 * the picture. Until the pictures have loaded, or for a colour with no picture, the crew are
 * drawn as plain shapes (see map/crewView.ts).
 */

/** Which astronaut each occupation is. The medic's light grey would not show on a white suit, so theirs is black. */
const SPRITE_OF: Record<OccupationId, string> = {
  engineer: "orange",
  scout: "green",
  researcher: "blue",
  medic: "black",
}

/** In every picture the feet are this many pixels above the bottom edge, in the middle from side to side. */
export const FEET_FROM_BOTTOM = 6
/** How tall the figure itself is, feet to the top of the helmet, in map pixels. */
export const FIGURE_TALL = 16

/** A suit colour as the number the map is given, e.g. "#f97316" as 0xf97316. */
const colorNumber = (hex: string) => Number.parseInt(hex.slice(1), 16)

/** Sprite name by suit colour. */
const nameOfColor = new Map<number, string>(
  (Object.keys(SPRITE_OF) as OccupationId[]).map((id) => [colorNumber(OCCUPATIONS[id].color), SPRITE_OF[id]]),
)

const textures = new Map<string, Texture>()
let loading: Promise<void> | null = null

async function load(key: string) {
  try {
    const texture = await Assets.load<Texture>(`${import.meta.env.BASE_URL}sprites/era1/${key}_flat.png`)
    // Pixel art: no smoothing when the camera zooms in.
    texture.source.scaleMode = "nearest"
    textures.set(key, texture)
  } catch {
    // No picture for this one: that crewmate keeps the plain shapes.
  }
}

/** Loads every astronaut picture. Safe to call more than once: the work is done once. */
export function loadCrewSprites(): Promise<void> {
  loading ??= Promise.all(
    [...new Set(nameOfColor.values())].flatMap((name) => [load(`pawn_${name}`), load(`pawn_indoor_${name}`)]),
  ).then(() => {})
  return loading
}

/** The picture of the crewmate with this suit colour, indoors or out, or undefined if there is none (yet). */
export function crewSprite(suitColor: number, indoors: boolean): Texture | undefined {
  const name = nameOfColor.get(suitColor)
  return name ? textures.get(`${indoors ? "pawn_indoor" : "pawn"}_${name}`) : undefined
}
