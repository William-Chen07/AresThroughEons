import { AlphaFilter, Container, Graphics, Text } from "pixi.js"
import { moduleType } from "@/content/modules"
import { CELL_PX, cellTopLeft, footprintTopLeft, type Cell, type VoxelTerrain } from "@/map/voxelTerrain"
import { TUBE, moduleAt, moduleRect, tubeOpenings, type Base, type PlacedModule, type Rect } from "@/sim/base"

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
/** How opaque the base is drawn while see-through (crew inside can be seen and clicked). */
const SEE_THROUGH_ALPHA = 0.4

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
  /** Fades the whole base so crew inside the modules show through. */
  setSeeThrough: (on: boolean) => void
  /** Fades just these modules (by id), e.g. ones with crew inside. */
  setOpenModules: (ids: string[]) => void
  /** Fades the tubes, e.g. while crew are inside the base and could be walking along them. */
  setTubesSeeThrough: (on: boolean) => void
  /**
   * The module cell drawn at a map point (roof or south wall), or null. A module is drawn taller
   * than its footprint, so this is what a click on it means, rather than the ground cell there.
   */
  moduleCellAt: (x: number, y: number) => Cell | null
}

/** A colour made lighter (factor above 1) or darker (below 1). */
function tone(color: number, factor: number) {
  const channel = (shift: number) => Math.min(255, Math.round(((color >> shift) & 0xff) * factor))
  return (channel(16) << 16) | (channel(8) << 8) | channel(0)
}

/** A colour faded towards Mars dust and darkened, for things left from an earlier era. */
function weathered(color: number) {
  const dust = [150, 104, 70]
  const channel = (shift: number, i: number) => Math.round((((color >> shift) & 0xff) * 0.55 + dust[i] * 0.45) * 0.8)
  return (channel(16, 0) << 16) | (channel(8, 1) << 8) | channel(0, 2)
}

/** A small number generator seeded from a module's id, so its dents and dust land in the same places every time. */
function seededRandom(id: string) {
  let seed = 1
  for (const ch of id) seed = (seed * 31 + ch.charCodeAt(0)) % 2147483647
  return () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
}

/** `era` is the era the expedition is in: modules built in an earlier one are drawn worn down. */
export function createBaseView(terrain: VoxelTerrain, era = 1): BaseView {
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
  // One filter for the whole base, so overlapping shapes fade together instead of showing through each other.
  const fade = new AlphaFilter({ alpha: SEE_THROUGH_ALPHA })
  /** Each module's footprint, front (south) first, for moduleCellAt. */
  let drawnRects: Rect[] = []
  /** Each drawn module's piece, by module id, for fading one at a time. */
  let pieces = new Map<string, Container>()
  let wholeBaseFaded = false
  let openModules = new Set<string>()
  let tubesFaded = false
  /** Fades the whole base, or else just the opened modules and the tubes. */
  const applyFade = () => {
    view.filters = wholeBaseFaded ? [fade] : []
    tubes.filters = !wholeBaseFaded && tubesFaded ? [fade] : []
    for (const [id, piece] of pieces) piece.filters = !wholeBaseFaded && openModules.has(id) ? [fade] : []
  }

  const ghostShape = new Graphics()
  const ghost = new Container()
  ghost.addChild(ghostShape)
  ghost.visible = false

  /**
   * Traces the tube network as line segments, for a stroke `width` wide with square ends: a short
   * one on every tube cell, so even a lone piece shows, one to each neighbouring tube cell, and
   * one up to the wall of each module the tube opens into (see tubeOpenings). It stops at the
   * wall, so no tube shows inside a module when it's see-through, and a tube that only runs past
   * a module doesn't reach into it. Nothing is drawn toward the lander: tubes don't connect to it.
   */
  const traceTubes = (shape: Graphics, base: Base, grid: Uint8Array, width: number) => {
    const half = width / 2
    for (const cell of base.tubes) {
      const here = cellCenter(cell)
      shape.moveTo(here.x - 0.5, here.y).lineTo(here.x + 0.5, here.y)
      // Each tube-to-tube link is drawn once, from its west or north end.
      for (const [dc, dr] of [
        [1, 0],
        [0, 1],
      ]) {
        const next = { col: cell.col + dc, row: cell.row + dr }
        if (next.col >= size || next.row >= size || grid[next.row * size + next.col] !== TUBE) continue
        const there = cellCenter(next)
        shape.moveTo(here.x, here.y).lineTo(there.x, there.y)
      }
      for (const opening of tubeOpenings(size, grid, cell.row * size + cell.col)) {
        const into = { col: opening % size, row: Math.floor(opening / size) }
        const module = moduleAt(base.modules, into)
        if (!module) continue
        // The module as drawn: its roof sits WALL_PX up from the footprint, its south wall below.
        const rect = moduleRect(module)
        const corner = footprintCorner(rect)
        const left = corner.x + 1
        const right = corner.x + rect.width * CELL_PX - 1
        const top = corner.y + 1 - WALL_PX
        const bottom = corner.y + rect.height * CELL_PX - 1
        // Where the line ends so that its square end just meets the wall.
        let end: { x: number; y: number }
        if (into.col > cell.col) end = { x: left - half, y: here.y }
        else if (into.col < cell.col) end = { x: right + half, y: here.y }
        else if (into.row > cell.row) end = { x: here.x, y: top - half }
        else end = { x: here.x, y: bottom + half }
        // Only draw it if the wall is further away than the tube's own end already reaches.
        const reach = (end.x - here.x) * (into.col - cell.col) + (end.y - here.y) * (into.row - cell.row)
        if (reach > 0) shape.moveTo(here.x, here.y).lineTo(end.x, end.y)
      }
    }
  }

  const drawModule = (module: PlacedModule) => {
    const type = moduleType(module.type)
    const worn = (module.era ?? 1) < era
    const color = worn ? weathered(type.color) : type.color
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
      .fill(tone(color, 0.6))
      .rect(3, 3 - WALL_PX, width - 6, height - 6)
      .fill(color)
      .rect(3, 3 - WALL_PX, width - 6, 2)
      .fill(tone(color, worn ? 1.1 : 1.25))
      .rect(3, height - 5 - WALL_PX, width - 6, 2)
      .fill(tone(color, 0.82))
      // The door: a hatch in the middle of the south wall, on the cell crew walk through (see moduleDoor).
      .rect((Math.floor(rect.width / 2) + 0.5) * CELL_PX - 3, height - 1 - WALL_PX, 6, WALL_PX - 3)
      .fill(OUTLINE)

    if (worn) {
      // Dust drifted onto the roof, dark scuffs and a crack or two.
      const random = seededRandom(module.id)
      const roofW = width - 6
      const roofH = height - 6
      for (let i = 0; i < Math.max(4, Math.round((roofW * roofH) / 60)); i++) {
        const size = random() < 0.3 ? 3 : 2
        shape
          .rect(3 + Math.floor(random() * (roofW - size)), 3 - WALL_PX + Math.floor(random() * (roofH - size)), size, size)
          .fill(random() < 0.6 ? tone(color, 1.18) : tone(color, 0.62))
      }
      for (let i = 0; i < 2; i++) {
        let x = 5 + Math.floor(random() * (roofW - 6))
        let y = 4 - WALL_PX + Math.floor(random() * (roofH / 2))
        for (let step = 0; step < 4; step++) {
          shape.rect(x, y, 1, 2).fill(tone(color, 0.45))
          x += random() < 0.5 ? -1 : 1
          y += 2
          if (y > height - 8 - WALL_PX) break
        }
      }
      // The south wall gets a rusty streak running down from the roof.
      shape.rect(4 + Math.floor(random() * (width - 10)), height - 3 - WALL_PX, 2, WALL_PX - 2).fill(0x7a4630)
    }

    const label = new Text({
      text: type.code,
      style: { fontFamily: "monospace", fontSize: 9, fontWeight: "700", fill: OUTLINE, letterSpacing: 1 },
      // Drawn at four times the size and scaled down, so it stays sharp when the camera zooms in.
      resolution: 4,
    })
    label.anchor.set(0.5)
    label.position.set(width / 2, (height - 6) / 2 + 3 - WALL_PX)

    const piece = new Container()
    if (worn) label.alpha = 0.6
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
        traceTubes(tubes, base, grid, width)
        tubes.stroke({ width, color, cap: "square", join: "miter" })
      }
    }

    modulesLayer.removeChildren().forEach((piece) => piece.destroy({ children: true }))
    // North to south, so a module in front overlaps the one behind it.
    const ordered = [...base.modules].sort((a, b) => a.row - b.row || a.col - b.col)
    pieces = new Map()
    for (const module of ordered) {
      const piece = drawModule(module)
      pieces.set(module.id, piece)
      modulesLayer.addChild(piece)
    }
    drawnRects = ordered.map(moduleRect).reverse()
    applyFade()
  }

  const setSeeThrough: BaseView["setSeeThrough"] = (on) => {
    wholeBaseFaded = on
    applyFade()
  }

  const setOpenModules: BaseView["setOpenModules"] = (ids) => {
    openModules = new Set(ids)
    applyFade()
  }

  const setTubesSeeThrough: BaseView["setTubesSeeThrough"] = (on) => {
    tubesFaded = on
    applyFade()
  }

  const moduleCellAt: BaseView["moduleCellAt"] = (x, y) => {
    for (const rect of drawnRects) {
      const corner = footprintCorner(rect)
      const width = rect.width * CELL_PX
      const height = rect.height * CELL_PX
      if (x < corner.x || x >= corner.x + width || y < corner.y - WALL_PX || y >= corner.y + height) continue
      // The roof is drawn WALL_PX up from the footprint; the south wall below it belongs to the last row.
      const col = rect.col + Math.floor((x - corner.x) / CELL_PX)
      const row = rect.row + Math.min(rect.height - 1, Math.floor((y - corner.y + WALL_PX) / CELL_PX))
      return { col, row }
    }
    return null
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

  return { view, ghost, draw, showGhost, setSeeThrough, setOpenModules, setTubesSeeThrough, moduleCellAt }
}
