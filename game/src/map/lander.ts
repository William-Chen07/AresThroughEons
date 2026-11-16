import { CanvasSource, Container, Graphics, Sprite, Texture, type Ticker } from "pixi.js"
import { CELL_PX, cellTopLeft, type Cell, type VoxelTerrain } from "@/map/voxelTerrain"
import { LANDER_CELLS } from "@/sim/base"

/*
 * The expedition's landers: pixel-art sprites that cover 3 × 3 cells, and the
 * animation of this era's lander coming down when the map opens. The first era
 * has the classic gold-foil lander; later eras come down in a newer, more
 * advanced one. Landers from earlier eras stay on the map, worn down.
 */

const SIZE_PX = LANDER_CELLS * CELL_PX

/*
 * The sprite, one character per pixel. It is drawn the way the terrain is:
 * from above, tipped so the south side shows. Each art pixel is 2 map pixels,
 * so the 24 × 24 drawing covers the 3 × 3 cells exactly.
 */
const ART = [
  "...........kk...........",
  "...........ko...........",
  "...........kk...........",
  "........kkkkkkkk........",
  "......kkwwwwwwwwkk......",
  ".....kwwwwwwwwwwwwk.....",
  "....kwwwwnnnnnnwwwwk....",
  "....kwwwnbbbbbbnwwwk....",
  "....kwwwnbbccbbnwwwk....",
  "....kgwwwnnnnnnwwwgk....",
  "....kggwwwwwwwwwwggk....",
  "...kkooooooooooooookk...",
  "..kyyyyyyyyyyyyyyyyyyk..",
  "..kyyhyyyyhyyyyhyyyyhk..",
  "..kyyyyyyyyyyyyyyyyyyk..",
  "..kddyddyddyddyddyddyk..",
  ".lkkddddddddddddddddkkl.",
  ".l..kkddddkkkkddddkk..l.",
  "ll....kkkk.ee.kkkk....ll",
  "l..........ee..........l",
  "l.........keek.........l",
  "kk....................kk",
  "ppk..................kpp",
  "kkk..................kkk",
]
const ART_COLORS: Record<string, string> = {
  k: "#2a1c1e", // outline
  w: "#ece8e0", // capsule hull
  g: "#b0aaa4", // hull in shade
  n: "#1d3c54", // window frame
  b: "#4fc3d9", // window
  c: "#beeef6", // window glint
  o: "#f08a3c", // orange band
  y: "#deaa48", // gold foil
  h: "#fad680", // foil highlight
  d: "#6e5230", // foil in shade
  l: "#96908c", // legs
  p: "#d6d0c8", // footpads
  e: "#545050", // engine nozzle
}
/** The newer lander of later eras: a silver hull with solar wings, a cyan light band and a wider engine bell. */
const ADVANCED_ART = [
  "...........kk...........",
  "..........kcck..........",
  "...........kk...........",
  "........kkkkkkkk........",
  "......kksssssssskk......",
  ".....kssswwwwwwsssk.....",
  "....ksswwwwwwwwwwssk....",
  "kkkkksswnnnnnnnnwsskkkkk",
  "kPLPksswnqqqqqqnwsskPLPk",
  "kPLPkkswnqcqqcqnwskkPLPk",
  "kPLPksswnnnnnnnnwsskPLPk",
  "kkkkksssssssssssssskkkkk",
  "....kaaaaaaaaaaaaaak....",
  "....kggggggggggggggk....",
  "....kgggdggggggdgggk....",
  ".....kggggggggggggk.....",
  "..l...kkkkkkkkkkkk...l..",
  ".l.......keeeek.......l.",
  "l........keeeek........l",
  "l.........keek.........l",
  "l......................l",
  "kk....................kk",
  "ppk..................kpp",
  "kkk..................kkk",
]
const ADVANCED_COLORS: Record<string, string> = {
  k: "#1e2230", // outline
  s: "#c8d0da", // silver hull
  w: "#f2f5f8", // hull top
  n: "#1d2c44", // window frame
  q: "#58d8f0", // window
  c: "#d8fbff", // window glint, antenna light
  P: "#2a4f9a", // solar panel
  L: "#5f8fe0", // solar panel cell line
  a: "#3ee0d0", // light band
  g: "#8a94a2", // hull in shade
  d: "#f08a3c", // mission stripe
  l: "#9aa2ac", // legs
  p: "#dfe4ea", // footpads
  e: "#3c4048", // engine bell
}

/** Which lander design an era comes down in. */
export type LanderModel = "classic" | "advanced"
export const landerModelFor = (era: number): LanderModel => (era <= 1 ? "classic" : "advanced")

const ART_PX = SIZE_PX / ART.length
/** Where the engine nozzle ends and where the lander meets the ground, in the sprite's own map pixels. */
const NOZZLE = { x: SIZE_PX / 2, y: 21 * ART_PX }
const FEET_Y = SIZE_PX - ART_PX

/** How high above its landing spot the lander starts, in map pixels, and how long it takes to come down. */
const DROP_PX = 680
const START_DELAY_MS = 400
const DESCENT_MS = 3800
/** After touchdown: the legs give a little while the dust is still spreading. */
const SETTLE_MS = 320
/** The engine blast starts throwing up dust once the lander is this close to the ground, in map pixels. */
const BLAST_HEIGHT_PX = 300
/** Smoke keeps rising from under the lander for this long after touchdown. */
const SMOLDER_MS = 2200
/** The shock ring that races outward along the ground at touchdown. */
const RING_MS = 700
/** How far the camera is knocked at touchdown, in screen pixels, and how long the shaking lasts. */
const SHAKE_PX = 10
const SHAKE_MS = 550

const EXHAUST_COLORS = [0xfff0b0, 0xf8b84a, 0xf08a3c, 0xc9b8aa, 0xa89a90]
// Paler than the ground, so the cloud stands out against it.
const DUST_COLORS = [0xfff4e2, 0xf8e0c2, 0xf0c9a0, 0xdba076]
const SMOKE_COLORS = [0xf2e6d8, 0xd9c6b4, 0xb5a598]

const between = (low: number, high: number) => low + Math.random() * (high - low)
const pick = (colors: number[]) => colors[Math.floor(Math.random() * colors.length)]

/** One square of smoke or dust. Speeds are map pixels per second; sizes are map pixels. */
interface Puff {
  sprite: Sprite
  vx: number
  vy: number
  ageMs: number
  lifeMs: number
  size: number
  growth: number
  alpha: number
}

/** The colour dust and age push everything towards, on a worn lander. */
const DUST = [150, 104, 70]

function landerTexture(model: LanderModel, worn: boolean): Texture {
  const art = model === "classic" ? ART : ADVANCED_ART
  const colors = model === "classic" ? ART_COLORS : ADVANCED_COLORS
  const canvas = document.createElement("canvas")
  canvas.width = art[0].length
  canvas.height = art.length
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("This browser can't create a 2D canvas")
  art.forEach((line, y) => {
    for (let x = 0; x < line.length; x++) {
      const color = colors[line[x]]
      if (!color) continue
      ctx.fillStyle = color
      ctx.fillRect(x, y, 1, 1)
    }
  })
  if (worn) wearDown(ctx, canvas.width, canvas.height)
  // "nearest" keeps the pixels square and sharp when the sprite is scaled up.
  return new Texture({ source: new CanvasSource({ resource: canvas, scaleMode: "nearest" }) })
}

/**
 * Ages a lander's pixels: faded and dusty all over, with darker grime and rust in patches. The
 * pattern comes from a fixed seed, so a worn lander looks the same every time the map opens.
 */
function wearDown(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const image = ctx.getImageData(0, 0, width, height)
  const px = image.data
  let seed = 7
  const random = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue
    const grime = random()
    // Faded towards the dust colour, a bit darker, and some pixels much dirtier.
    const mix = grime < 0.18 ? 0.65 : 0.38
    const dark = grime < 0.06 ? 0.6 : 0.82
    for (let c = 0; c < 3; c++) px[i + c] = Math.round((px[i + c] * (1 - mix) + DUST[c] * mix) * dark)
  }
  ctx.putImageData(image, 0, 0)
}

export interface Lander {
  /** Add this to the map, above the terrain. */
  view: Container
  /** The middle of the lander once it has landed, in map pixels. */
  center: { x: number; y: number }
  /**
   * Brings the lander down. With `animate` false it is simply placed on the
   * ground. `shake` is called every frame with how far to knock the camera,
   * in screen pixels (0, 0 when it should be still). `onTouchdown` is called
   * once, the moment it is on the ground.
   */
  land: (
    ticker: Ticker,
    animate: boolean,
    shake: (dx: number, dy: number) => void,
    onTouchdown: () => void,
  ) => void
  /** Shows the lander already on the ground, with no landing. */
  place: () => void
}

/**
 * A lander standing (or about to come down) on `cell`, the middle of its 3 × 3 footprint. A worn
 * one is from an earlier era: it is only ever placed, never landed.
 */
export function createLander(terrain: VoxelTerrain, cell: Cell, model: LanderModel, worn = false): Lander {
  // The 3 × 3 footprint is centred on the landing cell and sits at that cell's height.
  // (The cells around it may be a block higher or lower; levelling the pad comes later.)
  const middle = cellTopLeft(terrain, cell)
  const origin = { x: middle.x - CELL_PX, y: middle.y - CELL_PX }

  const view = new Container()
  view.position.copyFrom(origin)

  const shadow = new Graphics().ellipse(0, 0, SIZE_PX * 0.44, SIZE_PX * 0.14).fill({ color: 0x1a0c08, alpha: 1 })
  shadow.position.set(SIZE_PX / 2, FEET_Y - 2)

  // Smoke and dust behind the craft, and a second layer in front of it so the cloud wraps around it.
  const smokeBehind = new Container()
  const smokeInFront = new Container()
  const ring = new Graphics().ellipse(0, 0, SIZE_PX * 0.5, SIZE_PX * 0.17).stroke({ width: 3, color: 0xf3d2b0 })
  ring.position.set(SIZE_PX / 2, FEET_Y - 2)
  ring.visible = false

  // The craft moves as one piece. Its origin is where the feet meet the ground,
  // so it scales and bounces about that point.
  const craft = new Container()
  craft.pivot.set(SIZE_PX / 2, FEET_Y)
  const flame = new Graphics()
    .rect(-7, 0, 14, 6)
    .fill({ color: 0xf08a3c, alpha: 0.55 })
    .rect(-5, 0, 10, 7)
    .fill(0xf08a3c)
    .rect(-3, 6, 6, 9)
    .fill(0xf8b84a)
    .rect(-1, 14, 2, 10)
    .fill(0xfff0b0)
  flame.position.copyFrom(NOZZLE)
  const body = new Sprite(landerTexture(model, worn))
  body.setSize(SIZE_PX, SIZE_PX)
  craft.addChild(flame, body)

  view.addChild(shadow, ring, smokeBehind, craft, smokeInFront)

  /** Places everything for a given height above the ground. `progress` runs 0 to 1 over the descent. */
  const pose = (height: number, progress: number, sway: number) => {
    craft.position.set(SIZE_PX / 2 + sway, FEET_Y - height)
    // Seen from above, something higher up is nearer the viewer, so a little bigger.
    craft.scale.set(1 + 0.35 * (height / DROP_PX))
    // The shadow starts wide and faint and tightens as the lander nears the ground.
    shadow.scale.set(1.7 - 0.7 * progress)
    shadow.alpha = 0.1 + 0.3 * progress
  }

  const rest = () => {
    pose(0, 1, 0)
    flame.visible = false
    ring.visible = false
  }

  const land: Lander["land"] = (ticker, animate, shake, onTouchdown) => {
    if (!animate) {
      rest()
      onTouchdown()
      return
    }

    craft.visible = false
    shadow.visible = false
    let elapsed = -START_DELAY_MS
    let touchedDown = false
    const puffs: Puff[] = []
    // Particles are made at a steady rate per second, whatever the frame rate: these carry the fractions over.
    let exhaustOwed = 0
    let blastOwed = 0
    let smolderOwed = 0
    const ground = { x: SIZE_PX / 2, y: FEET_Y - 2 }

    const puff = (
      layer: Container,
      x: number,
      y: number,
      vx: number,
      vy: number,
      lifeMs: number,
      size: number,
      growth: number,
      color: number,
      alpha: number,
    ) => {
      // A plain white square, tinted: cheap to draw by the hundred, and it suits the pixel look.
      const sprite = new Sprite(Texture.WHITE)
      sprite.anchor.set(0.5)
      sprite.tint = color
      sprite.position.set(x, y)
      layer.addChild(sprite)
      puffs.push({ sprite, vx, vy, ageMs: 0, lifeMs, size, growth, alpha })
    }

    const movePuffs = (deltaMs: number) => {
      const seconds = deltaMs / 1000
      for (let i = puffs.length - 1; i >= 0; i--) {
        const p = puffs[i]
        p.ageMs += deltaMs
        if (p.ageMs >= p.lifeMs) {
          p.sprite.destroy()
          puffs.splice(i, 1)
          continue
        }
        const life = p.ageMs / p.lifeMs
        // Air drag: each puff loses most of its speed in its first half second.
        const drag = 0.04 ** seconds
        p.vx *= drag
        p.vy *= drag
        p.sprite.x += p.vx * seconds
        p.sprite.y += p.vy * seconds
        // Whole, even sizes keep the squares on the pixel grid.
        const size = Math.round((p.size + p.growth * life) / 2) * 2
        p.sprite.setSize(size, size)
        p.sprite.alpha = p.alpha * (1 - life) ** 1.5
      }
    }

    const step = (time: Ticker) => {
      const deltaMs = time.deltaMS
      elapsed += deltaMs
      movePuffs(deltaMs)
      if (elapsed < 0) return
      craft.visible = true
      shadow.visible = true

      if (elapsed < DESCENT_MS) {
        const progress = elapsed / DESCENT_MS
        // Falls fast at first, then the engine brakes it to a gentle touchdown.
        const height = DROP_PX * (1 - progress) ** 2
        pose(height, progress, Math.sin(elapsed / 300) * 6 * (height / DROP_PX))
        // The flame flickers, and burns hardest just before touchdown.
        const thrust = 0.8 + 0.9 * progress
        flame.scale.set(
          0.9 + 0.3 * progress + 0.1 * Math.sin(elapsed / 23),
          thrust + 0.25 * Math.sin(elapsed / 37) + 0.12 * Math.sin(elapsed / 13),
        )

        // Exhaust: hot at the nozzle, cooling to grey smoke as it is left behind.
        const scale = craft.scale.x
        const nozzle = {
          x: craft.x + (NOZZLE.x - SIZE_PX / 2) * scale,
          y: craft.y + (NOZZLE.y - FEET_Y + 14) * scale,
        }
        exhaustOwed += (40 + 70 * progress) * (deltaMs / 1000)
        for (; exhaustOwed >= 1; exhaustOwed--) {
          puff(
            smokeBehind,
            nozzle.x + between(-4, 4),
            nozzle.y + between(0, 8),
            between(-45, 45),
            between(140, 300),
            between(450, 1100),
            between(4, 8),
            between(10, 22),
            pick(EXHAUST_COLORS),
            0.8,
          )
        }

        // Near the ground the blast hits the surface and throws dust out sideways, harder the closer it gets.
        if (height < BLAST_HEIGHT_PX) {
          const closeness = 1 - height / BLAST_HEIGHT_PX
          blastOwed += (30 + 220 * closeness) * (deltaMs / 1000)
          for (; blastOwed >= 1; blastOwed--) {
            const side = Math.random() < 0.5 ? -1 : 1
            puff(
              Math.random() < 0.35 ? smokeInFront : smokeBehind,
              ground.x + side * between(0, 10),
              ground.y + between(-3, 5),
              side * between(120, 260 + 320 * closeness),
              // Mostly up: the cloud billows as well as spreading.
              between(-190, 30),
              between(800, 1900),
              between(8, 12),
              between(22, 44),
              pick(DUST_COLORS),
              0.65 + 0.3 * closeness,
            )
          }
          // The ground rumbles under the engine in the last moments.
          const rumble = 2.5 * closeness
          shake(between(-rumble, rumble), between(-rumble, rumble))
        }
        return
      }

      const sinceTouchdown = elapsed - DESCENT_MS
      if (!touchedDown) {
        touchedDown = true
        onTouchdown()
        flame.visible = false
        ring.visible = true
        // The impact: a burst of dust in every direction along the ground.
        for (let i = 0; i < 150; i++) {
          const angle = between(0, Math.PI * 2)
          const speed = between(180, 620)
          puff(
            Math.sin(angle) > 0.2 ? smokeInFront : smokeBehind,
            ground.x + Math.cos(angle) * 12,
            ground.y + Math.sin(angle) * 4,
            Math.cos(angle) * speed,
            // Squashed top to bottom, because the ground is seen at a slant.
            Math.sin(angle) * speed * 0.38 - between(0, 150),
            between(1000, 2800),
            between(8, 14),
            between(26, 58),
            pick(DUST_COLORS),
            0.95,
          )
        }
      }

      // The legs compress a few pixels, then spring back.
      pose(0, 1, 0)
      craft.y += Math.sin(Math.min(1, sinceTouchdown / SETTLE_MS) * Math.PI) * 4

      const spread = Math.min(1, sinceTouchdown / RING_MS)
      ring.scale.set(0.4 + 3.4 * (1 - (1 - spread) ** 2))
      ring.alpha = 0.7 * (1 - spread)

      // The camera is knocked hard, then steadies.
      const jolt = SHAKE_PX * Math.max(0, 1 - sinceTouchdown / SHAKE_MS) ** 2
      shake(between(-jolt, jolt), between(-jolt, jolt))

      // Smoke keeps curling up from under the lander for a moment, thinning out.
      if (sinceTouchdown < SMOLDER_MS) {
        smolderOwed += 70 * (1 - sinceTouchdown / SMOLDER_MS) * (deltaMs / 1000)
        for (; smolderOwed >= 1; smolderOwed--) {
          puff(
            Math.random() < 0.5 ? smokeInFront : smokeBehind,
            ground.x + between(-22, 22),
            ground.y + between(-6, 4),
            between(-30, 30),
            between(-150, -50),
            between(1300, 2800),
            between(8, 12),
            between(18, 38),
            pick(SMOKE_COLORS),
            0.7,
          )
        }
      }

      if (sinceTouchdown >= Math.max(SETTLE_MS, RING_MS, SHAKE_MS, SMOLDER_MS) && puffs.length === 0) {
        ticker.remove(step)
        shake(0, 0)
        rest()
      }
    }
    ticker.add(step)
  }

  return { view, center: { x: origin.x + SIZE_PX / 2, y: origin.y + SIZE_PX / 2 }, land, place: rest }
}

/** The evacuation shuttle: how high it comes in from, in map pixels, and how long each part of the pickup takes. */
const SHUTTLE_DROP_PX = 460
const SHUTTLE_DOWN_MS = 1900
const SHUTTLE_WAIT_MS = 900
const SHUTTLE_UP_MS = 1900

/**
 * The evacuation shuttle: the same craft the crew landed in comes down on `at` (the spot on the
 * ground where the astronaut is standing, in map pixels), waits a moment while they climb in,
 * and flies off again. `onPickup` is called while it is on the ground, when the astronaut is on
 * board, and `onGone` once it has left. Add `view` to the map above the crew; it removes itself.
 * `cancel` stops it early (when the map is closed).
 */
export function flyEvacuationShuttle(
  at: { x: number; y: number },
  model: LanderModel,
  ticker: Ticker,
  onPickup: () => void,
  onGone: () => void,
): { view: Container; cancel: () => void } {
  const view = new Container()
  view.position.set(Math.round(at.x), Math.round(at.y))
  const shadow = new Graphics().ellipse(0, 0, SIZE_PX * 0.44, SIZE_PX * 0.14).fill({ color: 0x1a0c08, alpha: 1 })
  const smoke = new Container()
  // The craft's origin is where its feet meet the ground, as in createLander.
  const craft = new Container()
  craft.pivot.set(SIZE_PX / 2, FEET_Y)
  const flame = new Graphics()
    .rect(-5, 0, 10, 7)
    .fill(0xf08a3c)
    .rect(-3, 6, 6, 9)
    .fill(0xf8b84a)
    .rect(-1, 14, 2, 10)
    .fill(0xfff0b0)
  flame.position.copyFrom(NOZZLE)
  const body = new Sprite(landerTexture(model, false))
  body.setSize(SIZE_PX, SIZE_PX)
  craft.addChild(flame, body)
  view.addChild(shadow, smoke, craft)

  const puffs: Puff[] = []
  let owed = 0
  /** Exhaust from the nozzle while flying, and dust off the ground when it is close. */
  const blow = (deltaMs: number, height: number) => {
    owed += 60 * (deltaMs / 1000)
    for (; owed >= 1; owed--) {
      const nearGround = height < 120 && Math.random() < 0.6
      const side = Math.random() < 0.5 ? -1 : 1
      const sprite = new Sprite(Texture.WHITE)
      sprite.anchor.set(0.5)
      sprite.tint = nearGround ? pick(DUST_COLORS) : pick(EXHAUST_COLORS)
      sprite.position.set(nearGround ? side * between(0, 8) : between(-4, 4), nearGround ? between(-3, 4) : -height + between(-2, 6))
      smoke.addChild(sprite)
      puffs.push({
        sprite,
        vx: nearGround ? side * between(90, 260) : between(-40, 40),
        vy: nearGround ? between(-120, 20) : between(120, 260),
        ageMs: 0,
        lifeMs: between(500, 1300),
        size: between(4, 8),
        growth: between(10, 26),
        alpha: 0.75,
      })
    }
  }
  const movePuffs = (deltaMs: number) => {
    const seconds = deltaMs / 1000
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i]
      p.ageMs += deltaMs
      if (p.ageMs >= p.lifeMs) {
        p.sprite.destroy()
        puffs.splice(i, 1)
        continue
      }
      const life = p.ageMs / p.lifeMs
      const drag = 0.04 ** seconds
      p.vx *= drag
      p.vy *= drag
      p.sprite.x += p.vx * seconds
      p.sprite.y += p.vy * seconds
      const size = Math.round((p.size + p.growth * life) / 2) * 2
      p.sprite.setSize(size, size)
      p.sprite.alpha = p.alpha * (1 - life) ** 1.5
    }
  }
  /** Places the craft `height` map pixels above the ground. */
  const pose = (height: number) => {
    const high = height / SHUTTLE_DROP_PX
    craft.position.set(0, -height)
    craft.scale.set(1 + 0.35 * high)
    craft.alpha = Math.min(1, (1 - high) * 5)
    shadow.scale.set(1 + 0.7 * high)
    shadow.alpha = 0.4 * (1 - high)
  }

  let elapsed = 0
  let pickedUp = false
  let over = false
  const finish = () => {
    if (over) return
    over = true
    ticker.remove(step)
    if (!view.destroyed) view.destroy({ children: true })
  }
  function step(time: Ticker) {
    const deltaMs = time.deltaMS
    elapsed += deltaMs
    movePuffs(deltaMs)
    if (elapsed < SHUTTLE_DOWN_MS) {
      // Comes in fast, and the engine brakes it to a gentle touchdown.
      const height = SHUTTLE_DROP_PX * (1 - elapsed / SHUTTLE_DOWN_MS) ** 2
      pose(height)
      flame.visible = true
      flame.scale.set(1, 1.2 + 0.25 * Math.sin(elapsed / 37))
      blow(deltaMs, height)
      return
    }
    const waited = elapsed - SHUTTLE_DOWN_MS
    if (waited < SHUTTLE_WAIT_MS) {
      pose(0)
      flame.visible = false
      // Halfway through the wait the astronaut is on board.
      if (!pickedUp && waited >= SHUTTLE_WAIT_MS / 2) {
        pickedUp = true
        onPickup()
      }
      return
    }
    if (!pickedUp) {
      pickedUp = true
      onPickup()
    }
    const rising = (waited - SHUTTLE_WAIT_MS) / SHUTTLE_UP_MS
    if (rising < 1) {
      // Lifts off slowly, then climbs away faster and faster.
      const height = SHUTTLE_DROP_PX * rising ** 2
      pose(height)
      flame.visible = true
      flame.scale.set(1, 1.5 + 0.25 * Math.sin(elapsed / 37))
      blow(deltaMs, height)
      return
    }
    craft.visible = false
    shadow.visible = false
    if (puffs.length === 0) {
      finish()
      onGone()
    }
  }
  pose(SHUTTLE_DROP_PX)
  ticker.add(step)
  return { view, cancel: finish }
}
