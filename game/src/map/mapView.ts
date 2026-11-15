import { Application, CanvasSource, Graphics, Sprite, Texture } from "pixi.js"
import { Viewport } from "pixi-viewport"
import { createBaseView, type Ghost } from "@/map/baseView"
import { createCrewView } from "@/map/crewView"
import { createLander } from "@/map/lander"
import {
  CELL_PX,
  cellTopLeft,
  pickCell,
  renderTerrain,
  terrainPixelSize,
  type Cell,
  type VoxelTerrain,
} from "@/map/voxelTerrain"
import type { Base } from "@/sim/base"
import type { World } from "@/sim/pathing"

/*
 * The Pixi scene for the base map: the terrain as one background sprite inside
 * a camera (pixi-viewport) that drags, pinches and wheel-zooms, the lander
 * coming down in the middle, the base (modules and tubes), the crew, and a
 * highlight on the cell under the pointer, or a ghost of what a click would build.
 */

/** While something is being placed: what a click on the pointed-at cell would build. */
export interface Placement {
  preview: (cell: Cell) => Ghost
}

export interface MapView {
  /** Redraws the base. `grid` is its occupancy (see sim/base.ts). */
  setBase: (base: Base, grid: Uint8Array) => void
  /** Starts or stops showing the placement ghost under the pointer. */
  setPlacement: (placement: Placement | null) => void
  /** Redraws the crew where they are now (see map/crewView.ts). */
  drawCrew: (world: World, colors: Record<string, number>) => void
  /** Fades the base so crew inside the modules can be seen (see map/baseView.ts). */
  setSeeThrough: (on: boolean) => void
  /** Fades just these modules (by id) so what's inside them shows. */
  setOpenModules: (ids: string[]) => void
  /** Calls `update` every frame with the real time since the last one, in ms. Returns a function that stops it. */
  onFrame: (update: (deltaMs: number) => void) => () => void
  destroy: () => void
}

/** Keys held during a click. */
export interface ClickKeys {
  shift: boolean
}

export interface MapEvents {
  onHover: (cell: Cell | null) => void
  /** A click or tap on a cell (not the end of a drag). */
  onCellClick: (cell: Cell, keys: ClickKeys) => void
  /** Null if the lander is already down. Otherwise the landing plays, and this is called at touchdown. */
  onLanded: (() => void) | null
}

const MAX_ZOOM = 4
/** Zoom when the map opens: close enough to see single blocks. */
const START_ZOOM = 1.5

/**
 * Creates the map inside `host` and resizes with it. `signal` cancels a view
 * that is no longer wanted before it builds anything (React mounts effects
 * twice in development). Resolves to null if it was cancelled.
 */
export async function createMapView(
  host: HTMLElement,
  terrain: VoxelTerrain,
  { onHover, onCellClick, onLanded }: MapEvents,
  signal: AbortSignal,
): Promise<MapView | null> {
  const app = new Application()
  await app.init({
    resizeTo: host,
    background: 0x020104,
    antialias: false,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
  })
  if (signal.aborted) {
    app.destroy({ removeView: true })
    return null
  }
  host.appendChild(app.canvas)

  // Sharp blocks when zoomed in, smooth (not shimmering) when zoomed out.
  const source = new CanvasSource({
    resource: renderTerrain(terrain),
    magFilter: "nearest",
    minFilter: "linear",
    mipmapFilter: "linear",
    autoGenerateMipmaps: true,
  })
  const ground = new Sprite(new Texture({ source }))
  const world = terrainPixelSize(terrain)

  const viewport = new Viewport({
    screenWidth: app.screen.width,
    screenHeight: app.screen.height,
    worldWidth: world.width,
    worldHeight: world.height,
    events: app.renderer.events,
    ticker: app.ticker,
    // Lets the wheel zoom the map without also scrolling the page.
    passiveWheel: false,
  })
  viewport.drag().pinch().wheel().decelerate()
  // Keep the map on screen, and centred when it's smaller than the screen.
  viewport.clamp({ direction: "all", underflow: "center" })

  const highlight = new Graphics().rect(0, 0, CELL_PX, CELL_PX).stroke({ width: 2, color: 0xffffff, alignment: 1 })
  highlight.visible = false

  const lander = createLander(terrain)
  const base = createBaseView(terrain)
  const crew = createCrewView(terrain)
  // Drawing order: terrain, crew inside the base, the base, the lander, crew outside, then the
  // placement ghost and hover highlight on top.
  viewport.addChild(ground, crew.insideView, base.view, lander.view, crew.view, base.ghost, highlight)
  app.stage.addChild(viewport)

  const fitZoomLimits = () => {
    // Zooming out stops when the whole map is in view.
    const fit = Math.min(app.screen.width / world.width, app.screen.height / world.height)
    viewport.clampZoom({ minScale: Math.min(fit, 1), maxScale: MAX_ZOOM })
  }
  fitZoomLimits()
  viewport.setZoom(START_ZOOM, true)
  viewport.moveCenter(lander.center.x, lander.center.y)
  // The landing plays only the first time an expedition's map opens. People who ask their system for less motion get the lander already down.
  // The camera shake moves the whole stage, so it doesn't fight the player's own panning.
  if (onLanded) {
    lander.land(
      app.ticker,
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      (dx, dy) => app.stage.position.set(dx, dy),
      onLanded,
    )
  } else {
    lander.place()
  }

  app.renderer.on("resize", (width, height) => {
    viewport.resize(width, height, world.width, world.height)
    fitZoomLimits()
  })
  // `resizeTo` only follows window resizes; this also catches layout changes.
  const observer = new ResizeObserver(() => app.queueResize())
  observer.observe(host)

  let hovered: Cell | null = null
  let placement: Placement | null = null
  /** Shows the hover highlight, or the placement ghost in its place while a module is being placed. */
  const showPointer = () => {
    highlight.visible = hovered !== null && placement === null
    if (hovered) highlight.position.copyFrom(cellTopLeft(terrain, hovered))
    base.showGhost(hovered && placement ? placement.preview(hovered) : null)
  }
  const setHovered = (cell: Cell | null) => {
    if (cell?.col === hovered?.col && cell?.row === hovered?.row) return
    hovered = cell
    showPointer()
    onHover(cell)
  }
  /**
   * The cell at a map point. Pointing at a crewmate means their cell. A module is drawn taller
   * than its footprint, so pointing at its roof or wall means the module. Neither applies while
   * placing something: then it's the ground there.
   */
  const cellAt = (x: number, y: number) =>
    (placement ? null : (crew.crewCellAt(x, y) ?? base.moduleCellAt(x, y))) ?? pickCell(terrain, x, y)
  viewport.eventMode = "static"
  viewport.on("pointermove", (e) => {
    const point = viewport.toLocal(e.global)
    setHovered(cellAt(point.x, point.y))
  })
  const clearHover = () => setHovered(null)
  app.canvas.addEventListener("pointerleave", clearHover)
  // The camera reports a click only when the pointer didn't drag the map.
  viewport.on("clicked", (e) => {
    const cell = cellAt(e.world.x, e.world.y)
    // Taps have no shift key; mouse and pen clicks do.
    if (cell) onCellClick(cell, { shift: "shiftKey" in e.event && Boolean(e.event.shiftKey) })
  })

  return {
    setBase: (next, grid) => {
      base.draw(next, grid)
      // The base under the pointer may have changed what fits there.
      showPointer()
    },
    setPlacement: (next) => {
      placement = next
      showPointer()
    },
    drawCrew: (world, colors) => crew.draw(world, colors),
    setSeeThrough: (on) => base.setSeeThrough(on),
    setOpenModules: (ids) => base.setOpenModules(ids),
    onFrame: (update) => {
      const tick = () => update(app.ticker.deltaMS)
      app.ticker.add(tick)
      return () => {
        app.ticker.remove(tick)
      }
    },
    destroy: () => {
      observer.disconnect()
      app.canvas.removeEventListener("pointerleave", clearHover)
      app.destroy(
        { removeView: true, releaseGlobalResources: true },
        { children: true, texture: true, textureSource: true },
      )
    },
  }
}
