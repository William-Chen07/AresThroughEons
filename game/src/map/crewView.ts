import { Container, Graphics } from "pixi.js"
import { CELL_PX, cellTopLeft, type Cell, type VoxelTerrain } from "@/map/voxelTerrain"
import { getZone, type Mover, type World } from "@/sim/pathing"

/*
 * Draws the crew on the map. Placeholder art for now: a round suit in the crewmate's colour with
 * a white helmet and dark visor, until real sprites exist. Where everyone is and what they're
 * doing comes from sim/pathing; this only draws it.
 *
 * Crew inside a module or tube are drawn under the base (seen when it's see-through, see
 * map/baseView.ts); crew outside are drawn over it.
 */

const OUTLINE = 0x1b1416
const HELMET = 0xf4f1ea
const VISOR = 0x24323a
const SELECTED = 0xffffff
const ROUTE = 0xffffff

export interface CrewView {
  /** Crew inside modules and tubes. Goes under the base. */
  insideView: Container
  /** Crew out on the surface. Goes above the base and the lander. */
  view: Container
  /** Redraws everyone where they are now. `colors` maps pawn id to suit colour. */
  draw: (world: World, colors: Record<string, number>) => void
  /**
   * The cell of the crewmate drawn at a map point (as last drawn), or null. Clicking a figure
   * means that crewmate, even where a module's roof is drawn over the ground.
   */
  crewCellAt: (x: number, y: number) => Cell | null
}

/** How far from a figure's middle a click still counts as on it, in map pixels. */
const HIT_RADIUS = 8

export function createCrewView(terrain: VoxelTerrain): CrewView {
  const insideShapes = new Graphics()
  const insideView = new Container()
  insideView.addChild(insideShapes)
  const shapes = new Graphics()
  const view = new Container()
  view.addChild(shapes)

  const clampCell = (n: number) => Math.min(terrain.size - 1, Math.max(0, n))
  const topY = (col: number, row: number) => cellTopLeft(terrain, { col: clampCell(col), row: clampCell(row) }).y

  /**
   * Map pixel at the middle of a (possibly between-cells) position in cell units. The height
   * lift is blended between the four nearest cells, so walkers glide over slopes.
   */
  const centerOf = (x: number, y: number) => {
    const col = Math.floor(x)
    const row = Math.floor(y)
    const fx = x - col
    const fy = y - row
    const top =
      topY(col, row) * (1 - fx) * (1 - fy) +
      topY(col + 1, row) * fx * (1 - fy) +
      topY(col, row + 1) * (1 - fx) * fy +
      topY(col + 1, row + 1) * fx * fy
    return { x: x * CELL_PX + CELL_PX / 2, y: top + CELL_PX / 2 }
  }

  /** Where each crewmate was last drawn (map pixels) and the cell they're on, front-most last. */
  let drawn: { x: number; y: number; cell: Cell }[] = []

  const draw = (world: World, colors: Record<string, number>) => {
    insideShapes.clear()
    drawn = []
    shapes.clear()
    const selected = new Set(world.selectedPawnIds)
    // Southern crewmates are drawn last so they overlap the ones behind them.
    const movers = Object.values(world.movers).sort((a, b) => a.pos.y - b.pos.y)
    const layerOf = (mover: Mover) => {
      const zone = getZone(world.grid, Math.round(mover.pos.x), Math.round(mover.pos.y))
      return zone === "outside" ? shapes : insideShapes
    }

    // Routes of the selected crew, under the figures.
    for (const mover of movers) {
      if (!selected.has(mover.pawnId) || mover.path.length === 0) continue
      const layer = layerOf(mover)
      const start = centerOf(mover.pos.x, mover.pos.y)
      layer.moveTo(start.x, start.y)
      for (const tile of mover.path) {
        const point = centerOf(tile.x, tile.y)
        layer.lineTo(point.x, point.y)
      }
      layer.stroke({ width: 1.5, color: ROUTE, alpha: 0.45 })
    }

    for (const mover of movers) {
      const shapes = layerOf(mover)
      const { x, y } = centerOf(mover.pos.x, mover.pos.y)
      drawn.push({ x, y: y - 2, cell: { col: Math.round(mover.pos.x), row: Math.round(mover.pos.y) } })
      const suit = colors[mover.pawnId] ?? 0xf97316
      // Bob very slightly while walking, so moving crew read as alive.
      const lift = mover.path.length > 0 ? Math.abs(Math.sin((mover.pos.x + mover.pos.y) * Math.PI)) * 1.5 : 0
      if (selected.has(mover.pawnId)) {
        shapes.circle(x, y + 1, 8).stroke({ width: 2, color: SELECTED })
      }
      shapes.ellipse(x, y + 4, 4.5, 1.8).fill({ color: 0x000000, alpha: 0.35 }) // shadow
      shapes.circle(x, y - lift, 4.5).fill(suit).stroke({ width: 1, color: OUTLINE })
      shapes.circle(x, y - 4.5 - lift, 3).fill(HELMET).stroke({ width: 1, color: OUTLINE })
      shapes.rect(x - 1.5, y - 5.5 - lift, 3, 1.5).fill(VISOR)
    }
  }

  const crewCellAt: CrewView["crewCellAt"] = (x, y) => {
    let best: Cell | null = null
    let bestDistance = HIT_RADIUS * HIT_RADIUS
    // Front-most first wins a tie, like what's seen on top.
    for (let i = drawn.length - 1; i >= 0; i--) {
      const d = (drawn[i].x - x) ** 2 + (drawn[i].y - y) ** 2
      if (d < bestDistance) {
        best = drawn[i].cell
        bestDistance = d
      }
    }
    return best
  }

  return { insideView, view, draw, crewCellAt }
}
