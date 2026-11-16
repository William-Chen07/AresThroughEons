import { Container, Graphics } from "pixi.js"
import { RESOURCE_TYPES } from "@/content/resources"
import { CELL_PX, cellTopLeft, type Cell, type VoxelTerrain } from "@/map/voxelTerrain"
import { clumpCells, type Deposit } from "@/sim/deposits"

/*
 * Draws the mineral deposits on the map (see sim/deposits.ts): crystals in the
 * mineral's colour on every block of its clump, smaller as it's mined. Each
 * block's crystals sit a little differently (but the same every time), so a
 * clump looks like a natural patch rather than a grid. Drawn above the ground
 * and below the base and the crew.
 */

const OUTLINE = 0x1b1416

export interface DepositView {
  view: Container
  draw: (deposits: readonly Deposit[]) => void
  /**
   * The cell of the deposit drawn at a map point, or null. The crystals are drawn over
   * everything on the ground, so on a low cell behind a taller one they show over the taller
   * one: pointing at them still means the deposit.
   */
  depositCellAt: (x: number, y: number) => Cell | null
}

/** How far from a deposit's middle a pointer still counts as on it, in map pixels. */
const HIT_RADIUS = 9

const colorOf = (mineral: string) => RESOURCE_TYPES.find((type) => type.id === mineral)?.color ?? 0xffffff

/** A crystal: a tall diamond centred at (x, y), `h` high. */
function crystal(shape: Graphics, x: number, y: number, h: number, color: number) {
  const w = h * 0.45
  shape
    .poly([x, y - h / 2, x + w, y, x, y + h / 2, x - w, y])
    .fill(color)
    .stroke({ width: 1, color: OUTLINE })
  // A highlight down one face, so it reads as a gem rather than a flat shape.
  shape.moveTo(x, y - h / 2 + 1).lineTo(x - w / 2, y).stroke({ width: 1, color: 0xffffff, alpha: 0.6 })
}

export function createDepositView(terrain: VoxelTerrain): DepositView {
  const shape = new Graphics()
  const view = new Container()
  view.addChild(shape)

  /** Where each block of each deposit was last drawn (map pixels) and that block's cell. */
  let drawn: { x: number; y: number; cell: Cell }[] = []

  const draw = (deposits: readonly Deposit[]) => {
    shape.clear()
    drawn = []
    // Drawn north to south, so blocks in front overlap the ones behind.
    const blocks = deposits
      .flatMap((deposit) => clumpCells(deposit).map((cell) => ({ deposit, cell })))
      .sort((a, b) => a.cell.row - b.cell.row || a.cell.col - b.cell.col)
    for (const { deposit, cell } of blocks) {
      const corner = cellTopLeft(terrain, cell)
      const x = corner.x + CELL_PX / 2
      const y = corner.y + CELL_PX / 2
      drawn.push({ x, y, cell })
      const color = colorOf(deposit.mineral)
      // Shrinks as it's mined, but never so small it can't be seen.
      const left = 0.55 + 0.45 * Math.min(1, deposit.amount / Math.max(1, deposit.start))
      // A steady per-block wobble from its position, so each block differs but never flickers.
      const wobble = (n: number) => ((Math.sin((cell.col * 12.9898 + cell.row * 78.233 + n) * 43758.5453) % 1) + 1) % 1
      const middle = cell.col === deposit.col && cell.row === deposit.row
      const size = left * (middle ? 1 : 0.7 + 0.3 * wobble(1))
      const dx = middle ? 0 : (wobble(2) - 0.5) * 6
      const dy = middle ? 0 : (wobble(3) - 0.5) * 4
      shape.ellipse(x + dx, y + dy + 5, 6 * size, 2.2 * size).fill({ color: 0x000000, alpha: 0.3 })
      crystal(shape, x + dx - 3.5 * size, y + dy + 1, 8 * size, color)
      crystal(shape, x + dx + 3.5 * size, y + dy + 1.5, 7 * size, color)
      crystal(shape, x + dx, y + dy - 1, 11 * size, color)
    }
  }

  const depositCellAt: DepositView["depositCellAt"] = (x, y) => {
    let best: Cell | null = null
    let bestDistance = HIT_RADIUS * HIT_RADIUS
    for (const spot of drawn) {
      const d = (spot.x - x) ** 2 + (spot.y - y) ** 2
      if (d < bestDistance) {
        best = spot.cell
        bestDistance = d
      }
    }
    return best
  }

  return { view, draw, depositCellAt }
}
