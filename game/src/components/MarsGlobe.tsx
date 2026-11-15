import { useEffect, useRef } from "react"
import * as THREE from "three"
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
 *
 * Non-data choices: the clock runs TIME_SCALE× faster than real time so the rotation is
 * visible, and the camera sits along the Earth→Mars line with celestial north up (what a
 * telescope on Earth would show, without image inversion).
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

/** Mars/ICRF frame (z = north) → three.js frame (y = up). A proper rotation. */
const toThree = (v: Vec3) => new THREE.Vector3(v[0], v[2], -v[1])

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

export function MarsGlobe({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)

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

    // --- Animation: real ephemeris, sped-up clock starting now ---
    const startReal = performance.now()
    const startDate = Number.isNaN(frozenTime) ? Date.now() : frozenTime
    let frame = 0
    const tick = () => {
      const elapsedMs = performance.now() - startReal
      update(new Date(startDate + elapsedMs * timeScale))
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
