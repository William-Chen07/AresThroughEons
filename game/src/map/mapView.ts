import { Application, CanvasSource, Graphics, Sprite, Texture } from "pixi.js"
import { Viewport } from "pixi-viewport"
import {
  CELL_PX,
  cellTopLeft,
  pickCell,
  renderTerrain,
  terrainPixelSize,
  type Cell,
  type VoxelTerrain,
} from "@/map/voxelTerrain"

/*
 * The Pixi scene for the base map: the terrain as one background sprite inside
 * a camera (pixi-viewport) that drags, pinches and wheel-zooms, plus a
 * highlight on the cell under the pointer. Game objects will be added to
 * `viewport` on top of the terrain.
 */

export interface MapView {
  destroy: () => void
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
  onHover: (cell: Cell | null) => void,
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

  viewport.addChild(ground, highlight)
  app.stage.addChild(viewport)

  const fitZoomLimits = () => {
    // Zooming out stops when the whole map is in view.
    const fit = Math.min(app.screen.width / world.width, app.screen.height / world.height)
    viewport.clampZoom({ minScale: Math.min(fit, 1), maxScale: MAX_ZOOM })
  }
  fitZoomLimits()
  viewport.setZoom(START_ZOOM, true)
  viewport.moveCenter(world.width / 2, world.height / 2)

  app.renderer.on("resize", (width, height) => {
    viewport.resize(width, height, world.width, world.height)
    fitZoomLimits()
  })
  // `resizeTo` only follows window resizes; this also catches layout changes.
  const observer = new ResizeObserver(() => app.queueResize())
  observer.observe(host)

  let hovered: Cell | null = null
  const setHovered = (cell: Cell | null) => {
    if (cell?.col === hovered?.col && cell?.row === hovered?.row) return
    hovered = cell
    highlight.visible = cell !== null
    if (cell) highlight.position.copyFrom(cellTopLeft(terrain, cell))
    onHover(cell)
  }
  viewport.eventMode = "static"
  viewport.on("pointermove", (e) => {
    const point = viewport.toLocal(e.global)
    setHovered(pickCell(terrain, point.x, point.y))
  })
  const clearHover = () => setHovered(null)
  app.canvas.addEventListener("pointerleave", clearHover)

  return {
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
