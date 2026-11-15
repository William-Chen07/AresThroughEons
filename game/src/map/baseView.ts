import { Container, Graphics, Text } from "pixi.js"
import { moduleType } from "@/content/modules"
import { CELL_PX, cellTopLeft, footprintTopLeft, type Cell, type VoxelTerrain } from "@/map/voxelTerrain"
import { MODULE, TUBE, moduleRect, type Base, type PlacedModule, type Rect } from "@/sim/base"

/*
 * Draws the base on the map: tubes first, then the modules on top of them,
 * plus the "ghost" that shows what a click would build. What may be built
 * where is decided in sim/base.ts.
 */

const OUTLINE = 0x2a1c1e
const TUBE_COLOR = 0xcfc9c0
const TUBE_SHINE = 0xf4f0e8
/** How tall a module's south wall is drawn, in map pixels. */
const WALL_PX = 8
const GHOST_OK = 0x5ad17a
const GHOST_BLOCKED = 0xe2574c

/** What a click would build: a module's footprint, a run of tube cells, or both empty for nothing. */
export interface Ghost {
  rect: Rect | null
  tubes: Cell[]
  ok: boolean
}

export interface BaseView {
  /** The built base. Goes above the terrain. */
  view: Container
  /** The ghost. Goes above everything else on the map. */
  ghost: Container
  /** `grid` is the base's occupancy (see sim/base.ts). */
  draw: (base: Base, grid: Uint8Array) => void
  showGhost: (ghost: Ghost | null) => void
}

/** A colour made lighter (factor above 1) or darker (below 1). */
function tone(color: number, factor: number) {
  const channel = (shift: number) => Math.min(255, Math.round(((color >> shift) & 0xff) * factor))
  return (channel(16) << 16) | (channel(8) << 8) | channel(0)
}

export function createBaseView(terrain: VoxelTerrain): BaseView {
  const { size } = terrain

  /** The middle of a cell's top face, in map pixels. */
  const cellCenter = (cell: Cell) => {
    const corner = cellTopLeft(terrain, cell)
    return { x: corner.x + CELL_PX / 2, y: corner.y + CELL_PX / 2 }
  }
  const footprintCorner = (rect: Rect) => footprintTopLeft(terrain, rect.col, rect.row, rect.width, rect.height)

  const tubes = new Graphics()
  const modulesLayer = new Container()
  const view = new Container()
  view.addChild(tubes, modulesLayer)

  const ghostShape = new Graphics()
  const ghost = new Container()
  ghost.addChild(ghostShape)
  ghost.visible = false

  /**
   * Traces the tube network as line segments: a short one on every tube cell,
   * so even a lone piece shows, and one to each neighbouring tube or module
   * cell. Nothing is drawn toward the lander: tubes don't connect to it.
   */
  const traceTubes = (shape: Graphics, cells: Cell[], grid: Uint8Array) => {
    for (const cell of cells) {
      const here = cellCenter(cell)
      shape.moveTo(here.x - 0.5, here.y).lineTo(here.x + 0.5, here.y)
      for (const [dc, dr] of [
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1],
      ]) {
        const next = { col: cell.col + dc, row: cell.row + dr }
        if (next.col < 0 || next.row < 0 || next.col >= size || next.row >= size) continue
        const what = grid[next.row * size + next.col]
        // Each tube-to-tube link is drawn once, from its west or north end.
        const link = what === MODULE || (what === TUBE && (dc === 1 || dr === 1))
        if (!link) continue
        const there = cellCenter(next)
        shape.moveTo(here.x, here.y).lineTo(there.x, there.y)
      }
    }
  }

  const drawModule = (module: PlacedModule) => {
    const type = moduleType(module.type)
    const rect = moduleRect(module)
    const width = rect.width * CELL_PX
    const height = rect.height * CELL_PX

    // Seen from above and tipped, like the terrain: the roof is drawn shifted
    // up by the wall's height, and the south wall shows below it.
    const shape = new Graphics()
      .rect(3, height - 3, width - 4, 4)
      .fill({ color: 0x1a0c08, alpha: 0.35 })
      .rect(1, 1 - WALL_PX, width - 2, height - 2 + WALL_PX)
      .fill(OUTLINE)
      .rect(3, height - 3 - WALL_PX, width - 6, WALL_PX)
      .fill(tone(type.color, 0.6))
      .rect(3, 3 - WALL_PX, width - 6, height - 6)
      .fill(type.color)
      .rect(3, 3 - WALL_PX, width - 6, 2)
      .fill(tone(type.color, 1.25))
      .rect(3, height - 5 - WALL_PX, width - 6, 2)
      .fill(tone(type.color, 0.82))
      // A hatch in the middle of the south wall.
      .rect(width / 2 - 3, height - 1 - WALL_PX, 6, WALL_PX - 3)
      .fill(OUTLINE)

    const label = new Text({
      text: type.code,
      style: { fontFamily: "monospace", fontSize: 9, fontWeight: "700", fill: OUTLINE, letterSpacing: 1 },
      // Drawn at four times the size and scaled down, so it stays sharp when the camera zooms in.
      resolution: 4,
    })
    label.anchor.set(0.5)
    label.position.set(width / 2, (height - 6) / 2 + 3 - WALL_PX)

    const piece = new Container()
    piece.addChild(shape, label)
    piece.position.copyFrom(footprintCorner(rect))
    return piece
  }

  const draw: BaseView["draw"] = (base, grid) => {
    tubes.clear()
    if (base.tubes.length > 0) {
      // Drawn three times, widest first: a dark edge, the tube, then a thin shine along it.
      for (const [width, color] of [
        [10, OUTLINE],
        [6, TUBE_COLOR],
        [2, TUBE_SHINE],
      ]) {
        traceTubes(tubes, base.tubes, grid)
        tubes.stroke({ width, color, cap: "square", join: "miter" })
      }
    }

    modulesLayer.removeChildren().forEach((piece) => piece.destroy({ children: true }))
    // North to south, so a module in front overlaps the one behind it.
    const ordered = [...base.modules].sort((a, b) => a.row - b.row || a.col - b.col)
    for (const module of ordered) modulesLayer.addChild(drawModule(module))
  }

  const showGhost: BaseView["showGhost"] = (next) => {
    ghost.visible = next !== null
    if (!next) return
    const color = next.ok ? GHOST_OK : GHOST_BLOCKED
    ghostShape.clear()
    for (const cell of next.tubes) {
      // Cells off the map's edge can't be drawn at a height; the red footprint or run still shows the rest.
      if (cell.col < 0 || cell.row < 0 || cell.col >= size || cell.row >= size) continue
      const corner = cellTopLeft(terrain, cell)
      ghostShape
        .rect(corner.x + 3, corner.y + 3, CELL_PX - 6, CELL_PX - 6)
        .fill({ color, alpha: 0.75 })
    }
    if (next.rect) {
      const corner = footprintCorner(next.rect)
      ghostShape
        .rect(corner.x, corner.y, next.rect.width * CELL_PX, next.rect.height * CELL_PX)
        .fill({ color, alpha: 0.35 })
        .stroke({ width: 2, color, alignment: 1 })
    }
  }

  return { view, ghost, draw, showGhost }
}
