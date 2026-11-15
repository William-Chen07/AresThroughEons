import { useEffect, useImperativeHandle, useRef, type Ref } from "react"
import * as THREE from "three"
import { MARS_FACTS } from "@/content/marsFacts"
import {
  marsGeometry,
  parseEphemerisTable,
  type EphemerisTable,
  type RotationModel,
  type Vec3,
} from "@/lib/marsEphemeris"
import marsColorUrl from "@/assets/mars_color_4k.jpg"
import marsNormalUrl from "@/assets/mars_normal_4k.jpg"
import marsRadiusUrl from "@/assets/mars_radius_0p5deg.bin?url"
import ephemerisUrl from "@/assets/mars_earth_de442_2024_2050.bin?url"
import marsRotation from "@/assets/mars_rotation_konopliv_2026.json"

const ROTATION_MODEL: RotationModel = marsRotation

/**
 * Data-driven 3D Mars, shown as it appears from Earth at the current moment.
 *
 * Data (preprocessed offline into src/assets; the game needs no scripts or network access):
 *  - Surface colour: Viking MDIM 2.1 colour mosaic (Mars_Viking_MDIM21_ClrMosaic_global_232m)
 *    from NASA Mars Trek WMTS tiles (a Space Apps 2026 challenge resource), 4096×2048
 *    equirectangular, lon -180..180°E.
 *  - Shape: USGS Astrogeology "Mars MGS MOLA DEM 463m", CC0 (public domain): elevation above
 *    the areoid, added to the Mars ellipsoid from NAIF (3396.19 / 3376.20 km), resampled to a
 *    0.5° vertex grid. True scale — no vertical exaggeration.
 *  - Terrain shading: tangent-space normal map baked from the same shape at 16 px/deg.
 *  - Orientation / sunlight / viewpoint: NASA/JPL NAIF DE442 ephemeris + Konopliv 2026 Mars
 *    rotation model (see lib/marsEphemeris.ts). Includes light-time from Mars to Earth.
 *  - Stars: decorative only (random), not catalogue data.
 *  - Fun-fact pins: places from content/marsFacts.ts, pinned by latitude/longitude.
 *
 * Non-data choices: the clock runs TIME_SCALE× faster than real time so the rotation is
 * visible, and the camera sits along the Earth→Mars line with celestial north up (what a
 * telescope on Earth would show, without image inversion).
 *
 * Fun facts: tapping a pin selects it and pauses the clock so the pin stays put. Focusing a
 * place (focusSite) never spins Mars by hand — it fast-forwards the clock (less than one sol)
 * until that place faces Earth (just left of centre), so the globe always shows a real moment.
 */

/** Simulated seconds per real second. 720 → one Martian day (24h 37m) in about 2 minutes. */
const TIME_SCALE = 720
/** Viewpoint: camera placed along the real Mars→Earth direction. */
const CAMERA_DISTANCE = 100 // in units of UNIT_RADIUS_M
/** Vertical field of view of the decorative star background, degrees. */
const STAR_FIELD_FOV = 40
const STAR_COUNT = 1800
const RADIUS_OFFSET_M = 3_396_000 // stored radius = int16 + offset (see bake script)
const UNIT_RADIUS_M = 3_396_000
const NORMAL_SLOPE_SCALE = 4 // slopes were multiplied by this when baking the normal map
const GRID_ROWS = 361 // lat 90 → -90 in 0.5° steps
const GRID_COLS = 721 // lon -180 → 180°E in 0.5° steps
const PIN_SIZE = 0.07 // in units of the Mars radius
const PIN_SIZE_SELECTED = 0.1
const PIN_HIT_PX = 26 // tap tolerance around a pin, in CSS pixels
// A pin shows only while it faces Earth by at least this much (cosine of the angle from
// the disc centre). Without it, a pin just past the edge pokes its glow out into space.
const PIN_MIN_FACING = 0.12
// ...and only in daylight: the night side is black against black space, so a pin there
// would look like it floats in empty space.
const PIN_MIN_SUNLIGHT = -0.05
const TAP_SLOP_PX = 6 // pointer may move this far and still count as a tap
const SEEK_MS = 1600 // duration of the fast-forward to a focused place
// Stop a focused place this many degrees before it reaches the disc centre. Surface
// features cross the disc from left to right, so it rests on the left half — clear of the
// fun-fact card in the bottom-right corner. 30° stays in daylight at any Mars phase (≤ ~47°).
const FOCUS_LEAD_DEG = 30
const DAY_MS = 86_400_000

export interface MarsGlobeHandle {
  /**
   * Fast-forward the clock until a fun-fact place faces Earth.
   * Returns whether that place can actually be seen from Earth then (it may be tipped away).
   */
  focusSite: (id: string) => boolean
}

interface MarsGlobeProps {
  className?: string
  ref?: Ref<MarsGlobeHandle>
  /** The selected fun-fact place; while set, the clock is paused. */
  selectedSiteId?: string | null
  /** Called when a pin is tapped (id) or empty space is tapped (null). */
  onSelectSite?: (id: string | null) => void
}

/** Mars/ICRF frame (z = north) → three.js frame (y = up). A proper rotation. */
const toThree = (v: Vec3) => new THREE.Vector3(v[0], v[2], -v[1])

/** Unit vector for a lat/lon in the mesh's body coordinates (same mapping as buildMarsMesh). */
function bodyDirection(latDeg: number, lonDeg: number) {
  const lat = THREE.MathUtils.degToRad(latDeg)
  const lon = THREE.MathUtils.degToRad(lonDeg)
  return new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon))
}

/** Round glowing dot with a white rim, drawn once into a texture. */
function pinTexture(core: string, glow: string) {
  const size = 128
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = size
  const ctx = canvas.getContext("2d")!
  const c = size / 2
  const halo = ctx.createRadialGradient(c, c, 0, c, c, c)
  halo.addColorStop(0, glow)
  halo.addColorStop(1, "rgba(0,0,0,0)")
  ctx.fillStyle = halo
  ctx.fillRect(0, 0, size, size)
  ctx.beginPath()
  ctx.arc(c, c, size * 0.16, 0, Math.PI * 2)
  ctx.fillStyle = core
  ctx.fill()
  ctx.lineWidth = size * 0.05
  ctx.strokeStyle = "#ffffff"
  ctx.stroke()
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

function buildMarsMesh(radii: Int16Array) {
  const positions = new Float32Array(GRID_ROWS * GRID_COLS * 3)
  const normals = new Float32Array(GRID_ROWS * GRID_COLS * 3)
  const uvs = new Float32Array(GRID_ROWS * GRID_COLS * 2)
  const DEG = Math.PI / 180

  for (let i = 0; i < GRID_ROWS; i++) {
    const lat = (90 - i * 0.5) * DEG
    for (let j = 0; j < GRID_COLS; j++) {
      const lon = (-180 + j * 0.5) * DEG
      const k = i * GRID_COLS + j
      const r = (radii[k] + RADIUS_OFFSET_M) / UNIT_RADIUS_M
      // body frame (x → 0°E, y → 90°E, z → north) mapped to three.js
      const nx = Math.cos(lat) * Math.cos(lon)
      const ny = Math.sin(lat)
      const nz = -Math.cos(lat) * Math.sin(lon)
      positions.set([nx * r, ny * r, nz * r], k * 3)
      // Smooth sphere normal; all slope information comes from the MOLA normal map.
      normals.set([nx, ny, nz], k * 3)
      uvs.set([j / (GRID_COLS - 1), 1 - i / (GRID_ROWS - 1)], k * 2)
    }
  }

  const indices = new Uint32Array((GRID_ROWS - 1) * (GRID_COLS - 1) * 6)
  let n = 0
  for (let i = 0; i < GRID_ROWS - 1; i++) {
    for (let j = 0; j < GRID_COLS - 1; j++) {
      const tl = i * GRID_COLS + j
      const tr = tl + 1
      const bl = tl + GRID_COLS
      const br = bl + 1
      indices.set([tl, bl, br, tl, br, tr], n)
      n += 6
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3))
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2))
  geometry.setIndex(new THREE.BufferAttribute(indices, 1))
  return geometry
}

/** Decorative starfield: random directions and brightnesses (not real stars). */
function buildDecorativeStars(pixelRatio: number) {
  let seed = 1234567
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  const positions = new Float32Array(STAR_COUNT * 3)
  const colors = new Float32Array(STAR_COUNT * 3)
  const sizes = new Float32Array(STAR_COUNT)
  for (let s = 0; s < STAR_COUNT; s++) {
    const z = random() * 2 - 1
    const phi = random() * Math.PI * 2
    const r = Math.sqrt(1 - z * z)
    positions.set([r * Math.cos(phi) * 1000, z * 1000, r * Math.sin(phi) * 1000], s * 3)
    const brightness = 0.2 + 0.8 * Math.pow(random(), 6) // mostly faint, a few bright
    const warmth = random() * 0.25
    colors.set([brightness, brightness * (1 - warmth * 0.3), brightness * (1 - warmth)], s * 3)
    sizes[s] = (1.4 + brightness * 2.6) * pixelRatio
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3))
  geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1))
  const material = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute float size;
      attribute vec3 color;
      varying vec3 vColor;
      void main() {
        vColor = color;
        gl_PointSize = size;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.2, d);
        gl_FragColor = vec4(vColor * a, 1.0);
      }
    `,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  })
  return new THREE.Points(geometry, material)
}

export function MarsGlobe({ className, ref, selectedSiteId = null, onSelectSite }: MarsGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const focusRef = useRef<MarsGlobeHandle["focusSite"]>(() => false)
  const selectedRef = useRef(selectedSiteId)
  const onSelectRef = useRef(onSelectSite)

  // The scene is built once; props that change later reach it through refs.
  useEffect(() => {
    selectedRef.current = selectedSiteId
    onSelectRef.current = onSelectSite
  }, [selectedSiteId, onSelectSite])

  useImperativeHandle(ref, () => ({ focusSite: (id) => focusRef.current(id) }), [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let disposed = false
    const abort = new AbortController()
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    // Dev aid: ?marsTime=2026-11-14T12:00:00Z freezes the globe at that instant.
    const frozenTime = import.meta.env.DEV
      ? Date.parse(new URLSearchParams(window.location.search).get("marsTime") ?? "")
      : NaN
    const timeScale = !Number.isNaN(frozenTime) ? 0 : reduceMotion ? 1 : TIME_SCALE

    const pixelRatio = Math.min(window.devicePixelRatio, 2)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(pixelRatio)
    renderer.setClearColor(0x000000)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.autoClear = false
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(1.4, 1, 1, 3000)

    // Decorative stars get their own wide camera, turned with the main view.
    const starScene = new THREE.Scene()
    const starCamera = new THREE.PerspectiveCamera(STAR_FIELD_FOV, 1, 1, 3000)
    const stars = buildDecorativeStars(pixelRatio)
    starScene.add(stars)

    // Sunlight only — no ambient fill, so the night side is dark as it really is.
    // Intensity π makes a surface facing the Sun show the mosaic's own brightness.
    const sun = new THREE.DirectionalLight(0xffffff, Math.PI)
    scene.add(sun)

    // Show Mars only once shape, colour, terrain and ephemeris are all loaded, so it
    // never appears half-built or wrongly oriented.
    let pending = 4
    const markLoaded = () => {
      if (--pending === 0 && !disposed) mars.visible = true
    }
    const loader = new THREE.TextureLoader()
    const colorMap = loader.load(marsColorUrl, markLoaded)
    colorMap.colorSpace = THREE.SRGBColorSpace
    colorMap.anisotropy = renderer.capabilities.getMaxAnisotropy()
    const normalMap = loader.load(marsNormalUrl, markLoaded)
    normalMap.anisotropy = renderer.capabilities.getMaxAnisotropy()

    const material = new THREE.MeshLambertMaterial({
      map: colorMap,
      normalMap,
      normalScale: new THREE.Vector2(1 / NORMAL_SLOPE_SCALE, 1 / NORMAL_SLOPE_SCALE),
    })
    const mars = new THREE.Mesh(new THREE.BufferGeometry(), material)
    mars.visible = false
    scene.add(mars)

    // --- Fun-fact pins: children of Mars so they turn with it (and appear with it) ---
    const pinMaterial = new THREE.SpriteMaterial({
      map: pinTexture("#2dd4bf", "rgba(45,212,191,0.55)"),
      depthWrite: false,
    })
    const pinSelectedMaterial = new THREE.SpriteMaterial({
      map: pinTexture("#f97316", "rgba(249,115,22,0.6)"),
      depthWrite: false,
    })
    // Lifted a little above the surface so terrain never hides a pin that faces us.
    const pins = MARS_FACTS.map((fact) => {
      const pin = new THREE.Sprite(pinMaterial)
      pin.position.copy(bodyDirection(fact.location.lat, fact.location.lon).multiplyScalar(1.015))
      pin.userData.siteId = fact.id
      mars.add(pin)
      return pin
    })

    let ephemeris: EphemerisTable | null = null

    const loadBinary = (url: string, what: string, onLoad: (buffer: ArrayBuffer) => void) =>
      fetch(url, { signal: abort.signal })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return res.arrayBuffer()
        })
        .then((buffer) => {
          if (disposed) return
          onLoad(buffer)
          markLoaded()
        })
        .catch((err) => {
          if (!disposed) console.error(`Failed to load ${what}`, err)
        })

    loadBinary(marsRadiusUrl, "MOLA shape data", (buffer) => {
      mars.geometry.dispose()
      mars.geometry = buildMarsMesh(new Int16Array(buffer))
    })
    loadBinary(ephemerisUrl, "DE442 ephemeris table", (buffer) => {
      ephemeris = parseEphemerisTable(buffer)
    })

    // --- Place everything for a given moment ---
    const basis = new THREE.Matrix4()
    const update = (date: Date) => {
      if (!ephemeris) return
      const g = marsGeometry(date, ephemeris, ROTATION_MODEL)
      // Mesh is built in body coordinates; rotate it into the sky frame.
      basis.makeBasis(toThree(g.axes.x), toThree(g.axes.z), toThree(g.axes.y).negate())
      mars.quaternion.setFromRotationMatrix(basis)
      sun.position.copy(toThree(g.toSun)).multiplyScalar(10)
      camera.position.copy(toThree(g.toEarth)).multiplyScalar(CAMERA_DISTANCE)
      camera.up.copy(toThree([0, 0, 1])) // celestial north up
      camera.lookAt(0, 0, 0)
      starCamera.quaternion.copy(camera.quaternion)
    }

    // --- Layout: place the disc on the right on wide screens, lower-centre on narrow ones ---
    const resize = () => {
      const { clientWidth: w, clientHeight: h } = container
      if (!w || !h) return
      renderer.setSize(w, h, false)
      const wide = w / h > 1.1
      // Disc radius as a fraction of viewport height.
      const discRadius = wide ? Math.min(0.4, (0.4 * (w / h)) / 1.78) : Math.min(0.34, (0.42 * w) / h)
      camera.fov = 2 * Math.atan(0.5 / (discRadius * CAMERA_DISTANCE)) * (180 / Math.PI)
      camera.aspect = w / h
      const shiftX = wide ? Math.min(0.17 * w, w / 2 - discRadius * h - 0.04 * w) : 0
      const shiftY = wide ? 0 : 0.2 * h
      camera.setViewOffset(w, h, -shiftX, -shiftY, w, h)
      camera.updateProjectionMatrix()
      starCamera.aspect = w / h
      starCamera.setViewOffset(w, h, -shiftX, -shiftY, w, h)
      starCamera.updateProjectionMatrix()
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(container)

    // --- Picking pins: nearest pin on the Earth-facing side within PIN_HIT_PX ---
    const canvas = renderer.domElement
    const pinWorld = new THREE.Vector3()
    const toCamera = new THREE.Vector3()
    const toSun = new THREE.Vector3()
    const pinShows = (pin: THREE.Sprite) => {
      const normal = pin.getWorldPosition(pinWorld).normalize()
      return (
        normal.dot(toCamera.copy(camera.position).normalize()) > PIN_MIN_FACING &&
        normal.dot(toSun.copy(sun.position).normalize()) > PIN_MIN_SUNLIGHT
      )
    }
    const pickPin = (event: PointerEvent): string | null => {
      if (!mars.visible) return null
      const rect = canvas.getBoundingClientRect()
      let best: string | null = null
      let bestDist = PIN_HIT_PX
      for (const pin of pins) {
        if (!pin.visible) continue
        const ndc = pin.getWorldPosition(pinWorld).project(camera)
        const x = rect.left + ((ndc.x + 1) / 2) * rect.width
        const y = rect.top + ((1 - ndc.y) / 2) * rect.height
        const dist = Math.hypot(event.clientX - x, event.clientY - y)
        if (dist < bestDist) {
          bestDist = dist
          best = pin.userData.siteId as string
        }
      }
      return best
    }

    let pointerDown: { id: number; x: number; y: number } | null = null
    const onPointerDown = (event: PointerEvent) => {
      pointerDown = { id: event.pointerId, x: event.clientX, y: event.clientY }
    }
    const onPointerUp = (event: PointerEvent) => {
      const down = pointerDown
      pointerDown = null
      if (!down || down.id !== event.pointerId) return
      if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > TAP_SLOP_PX) return
      onSelectRef.current?.(pickPin(event))
    }
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "mouse") canvas.style.cursor = pickPin(event) ? "pointer" : ""
    }
    canvas.addEventListener("pointerdown", onPointerDown)
    canvas.addEventListener("pointerup", onPointerUp)
    canvas.addEventListener("pointermove", onPointerMove)

    // --- Animation: real ephemeris, sped-up clock starting now ---
    // The clock pauses while a fun fact is open, and can fast-forward to a focused place.
    let simTime = Number.isNaN(frozenTime) ? Date.now() : frozenTime
    let lastReal = performance.now()
    let seek: { from: number; to: number; start: number } | null = null

    focusRef.current = (id) => {
      const fact = MARS_FACTS.find((f) => f.id === id)
      if (!fact || !ephemeris) return false
      // The point facing Earth drifts west as Mars turns, so wait until it reaches the site.
      const now = marsGeometry(new Date(simTime), ephemeris, ROTATION_MODEL)
      const degreesToGo = (((now.subEarth.lon - fact.location.lon - FOCUS_LEAD_DEG) % 360) + 360) % 360
      const target = simTime + (degreesToGo / ROTATION_MODEL.pm[1]) * DAY_MS
      seek = reduceMotion ? null : { from: simTime, to: target, start: performance.now() }
      if (reduceMotion) simTime = target
      // Visible if the site faces Earth well enough at that moment (not tipped over the limb).
      const then = marsGeometry(new Date(target), ephemeris, ROTATION_MODEL)
      const e = then.toEarth
      const toEarthBody = new THREE.Vector3(
        e[0] * then.axes.x[0] + e[1] * then.axes.x[1] + e[2] * then.axes.x[2],
        e[0] * then.axes.y[0] + e[1] * then.axes.y[1] + e[2] * then.axes.y[2],
        e[0] * then.axes.z[0] + e[1] * then.axes.z[1] + e[2] * then.axes.z[2],
      )
      const lat = THREE.MathUtils.degToRad(fact.location.lat)
      const lon = THREE.MathUtils.degToRad(fact.location.lon)
      const site = new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat))
      return site.dot(toEarthBody) > 0.2
    }

    let frame = 0
    const tick = () => {
      const nowReal = performance.now()
      const dt = nowReal - lastReal
      lastReal = nowReal
      if (seek) {
        const k = Math.min((nowReal - seek.start) / SEEK_MS, 1)
        simTime = seek.from + (seek.to - seek.from) * easeInOutCubic(k)
        if (k === 1) seek = null
      } else if (!selectedRef.current) {
        simTime += dt * timeScale
      }
      update(new Date(simTime))

      const pulse = reduceMotion ? 1 : 1 + 0.12 * Math.sin(nowReal / 330)
      mars.updateMatrixWorld()
      for (const pin of pins) {
        pin.visible = pinShows(pin)
        const selected = pin.userData.siteId === selectedRef.current
        pin.material = selected ? pinSelectedMaterial : pinMaterial
        pin.scale.setScalar((selected ? PIN_SIZE_SELECTED : PIN_SIZE) * pulse)
      }

      renderer.clear()
      renderer.render(starScene, starCamera)
      renderer.render(scene, camera)
      frame = requestAnimationFrame(tick)
    }
    tick()

    return () => {
      disposed = true
      abort.abort()
      cancelAnimationFrame(frame)
      observer.disconnect()
      canvas.removeEventListener("pointerdown", onPointerDown)
      canvas.removeEventListener("pointerup", onPointerUp)
      canvas.removeEventListener("pointermove", onPointerMove)
      focusRef.current = () => false
      pinMaterial.map?.dispose()
      pinMaterial.dispose()
      pinSelectedMaterial.map?.dispose()
      pinSelectedMaterial.dispose()
      colorMap.dispose()
      normalMap.dispose()
      material.dispose()
      mars.geometry.dispose()
      stars.geometry.dispose()
      ;(stars.material as THREE.Material).dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`[&>canvas]:block [&>canvas]:size-full ${className ?? ""}`}
    />
  )
}
