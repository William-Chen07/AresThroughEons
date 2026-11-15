import { useEffect, useImperativeHandle, useRef, type Ref } from "react"
import * as THREE from "three"
import marsTextureUrl from "@/assets/mars.jpg"
import { GLOBE_SITES } from "@/content/codex"

/**
 * Full-viewport 3D Mars for the main menu, rendered with three.js.
 * Kids can drag to spin it and tap glowing pins for facts. It sits centred in
 * the space to the right of the menu column, sized to stay fully on screen.
 *
 * Texture: Viking MDIM 2.1 colour mosaic, stitched from NASA Mars Trek
 * (trek.nasa.gov) WMTS tiles. Credit: NASA/JPL/USGS.
 */

export interface MarsGlobeHandle {
  /** Spin Mars so a codex site faces the viewer. */
  focusSite: (id: string) => void
  /** Fly the camera into Mars. Resolves when the animation ends. */
  zoomIn: () => Promise<void>
}

interface MarsGlobeProps {
  className?: string
  ref?: Ref<MarsGlobeHandle>
  selectedSiteId: string | null
  onSelectSite: (id: string | null) => void
  /** Right edge (px from the container's left) of the menu column, kept clear of Mars. */
  menuRight: number
}

const PLANET_RADIUS = 1.5
const AXIAL_TILT = THREE.MathUtils.degToRad(25.2)
const MAX_DRAG_TILT = 0.6
const FOCUS_LIFT = 0.45 // rad; raises a focused site above the planet's centre
const IDLE_BEFORE_AUTOSPIN = 3 // seconds
const AUTOSPIN_SPEED = 0.05 // rad/s
const TAP_SLOP = 6 // px a pointer may move and still count as a tap
const ZOOM_SECONDS = 1.4
const CAMERA_DISTANCE = 6
const EDGE_MARGIN = 24 // px kept between Mars' glow and the menu / screen edge

/** Lat/lon (degrees) to a point on three.js SphereGeometry's UV layout. */
function latLonToLocal(lat: number, lon: number, radius: number) {
  const phi = ((lon + 180) / 360) * Math.PI * 2
  const theta = THREE.MathUtils.degToRad(90 - lat)
  return new THREE.Vector3(
    -radius * Math.cos(phi) * Math.sin(theta),
    radius * Math.cos(theta),
    radius * Math.sin(phi) * Math.sin(theta),
  )
}

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

/** Shortest signed angle from a to b. */
function angleDelta(a: number, b: number) {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a))
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

interface SceneApi {
  focusSite: (id: string) => void
  zoomIn: () => Promise<void>
  layout: () => void
}

export function MarsGlobe({
  className,
  ref,
  selectedSiteId,
  onSelectSite,
  menuRight,
}: MarsGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<SceneApi | null>(null)
  const selectedRef = useRef(selectedSiteId)
  const onSelectRef = useRef(onSelectSite)
  const menuRightRef = useRef(menuRight)

  useEffect(() => {
    selectedRef.current = selectedSiteId
    onSelectRef.current = onSelectSite
  }, [selectedSiteId, onSelectSite])

  useEffect(() => {
    menuRightRef.current = menuRight
    sceneRef.current?.layout()
  }, [menuRight])

  useImperativeHandle(
    ref,
    () => ({
      focusSite: (id) => sceneRef.current?.focusSite(id),
      zoomIn: () => sceneRef.current?.zoomIn() ?? Promise.resolve(),
    }),
    [],
  )

  // Build the scene once. Anything that changes later is read through refs.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x020104)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    const canvas = renderer.domElement
    canvas.style.touchAction = "none"
    canvas.style.cursor = "grab"
    container.appendChild(canvas)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1000)
    const cameraHome = new THREE.Vector3(0, 0, CAMERA_DISTANCE)
    camera.position.copy(cameraHome)

    // root (layout position) → dragTilt (player tilts it) → axial (Mars' tilt) → mars (spin)
    const root = new THREE.Group()
    const dragTilt = new THREE.Group()
    const axial = new THREE.Group()
    axial.rotation.z = AXIAL_TILT
    root.add(dragTilt)
    dragTilt.add(axial)
    scene.add(root)

    // --- Mars ---
    const texture = new THREE.TextureLoader().load(marsTextureUrl)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy()

    const marsGeometry = new THREE.SphereGeometry(PLANET_RADIUS, 128, 64)
    const marsMaterial = new THREE.MeshStandardMaterial({ map: texture, roughness: 1, metalness: 0 })
    const mars = new THREE.Mesh(marsGeometry, marsMaterial)
    mars.rotation.y = THREE.MathUtils.degToRad(-60) // start facing Valles Marineris
    axial.add(mars)

    // --- Thin dusty atmosphere (fresnel rim glow) ---
    const atmosphereGeometry = new THREE.SphereGeometry(PLANET_RADIUS * 1.08, 64, 32)
    const atmosphereMaterial = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vViewDir = normalize(-mvPosition.xyz);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          // Back faces: facing = 0 at the shell's outer silhouette, ~0.38 where it
          // meets the planet's edge. Brightest at the planet, fading outward.
          float facing = clamp(-dot(vNormal, vViewDir) / 0.38, 0.0, 1.0);
          float intensity = pow(facing, 2.5);
          gl_FragColor = vec4(1.0, 0.5, 0.3, 1.0) * intensity * 0.55;
        }
      `,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    })
    axial.add(new THREE.Mesh(atmosphereGeometry, atmosphereMaterial))

    // --- Fact pins (children of Mars so they spin with it) ---
    const pinMaterial = new THREE.SpriteMaterial({
      map: pinTexture("#2dd4bf", "rgba(45,212,191,0.55)"),
      depthWrite: false,
    })
    const pinSelectedMaterial = new THREE.SpriteMaterial({
      map: pinTexture("#f97316", "rgba(249,115,22,0.6)"),
      depthWrite: false,
    })
    const pins = GLOBE_SITES.map((site) => {
      const pin = new THREE.Sprite(pinMaterial)
      pin.position.copy(latLonToLocal(site.location.lat, site.location.lon, PLANET_RADIUS * 1.01))
      pin.userData.siteId = site.id
      mars.add(pin)
      return pin
    })

    // --- Lighting: low-angle sun for a dramatic terminator ---
    scene.add(new THREE.AmbientLight(0xffffff, 0.08))
    const sun = new THREE.DirectionalLight(0xfff4e8, 3.2)
    sun.position.set(-5, 2, 4)
    scene.add(sun)

    // --- Starfield ---
    const starCount = 2500
    const starPositions = new Float32Array(starCount * 3)
    for (let i = 0; i < starCount; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(200 + Math.random() * 200)
      starPositions.set([v.x, v.y, v.z], i * 3)
    }
    const starGeometry = new THREE.BufferGeometry()
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3))
    const starMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.9,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.8,
    })
    const stars = new THREE.Points(starGeometry, starMaterial)
    scene.add(stars)

    // --- Layout: centre Mars in the free space right of the menu, fully on screen ---
    const resize = () => {
      const { clientWidth: w, clientHeight: h } = container
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()

      if (w / h <= 1.1) {
        // Portrait: the menu sits on top and Mars fills the lower half as a backdrop.
        root.position.set(0, -0.9, 0)
        root.scale.setScalar(0.85)
        return
      }

      // Pixels per unit of (world offset / distance from camera).
      const k = h / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
      const glowR = PLANET_RADIUS * 1.08
      const menuEdge = menuRightRef.current
      const free = w - menuEdge
      const targetR = Math.max(80, Math.min(h * 0.44, free / 2 - EDGE_MARGIN))
      // On-screen radius ≈ k·R·s / D, so solve for the scale s that gives targetR.
      const scale = THREE.MathUtils.clamp((targetR * CAMERA_DISTANCE) / (k * glowR), 0.3, 1.15)
      root.scale.setScalar(scale)
      root.position.set(((menuEdge + free / 2 - w / 2) / k) * CAMERA_DISTANCE, 0, 0)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(container)

    // --- Interaction state ---
    let spinVelocity = 0
    let lastInteraction = -Infinity
    let focus: { rotY: number; tilt: number } | null = null
    let drag: { id: number; x: number; y: number; moved: number; lastT: number } | null = null
    let zoom: { start: number; from: THREE.Vector3; to: THREE.Vector3; done: () => void } | null = null
    const clock = new THREE.Clock()
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()

    const pick = (event: PointerEvent): string | null => {
      const rect = canvas.getBoundingClientRect()
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      )
      raycaster.setFromCamera(pointer, camera)
      const [first] = raycaster.intersectObjects([mars, ...pins], false)
      return (first?.object.userData.siteId as string | undefined) ?? null
    }

    const focusSite = (id: string) => {
      const site = GLOBE_SITES.find((s) => s.id === id)
      if (!site) return
      const p = latLonToLocal(site.location.lat, site.location.lon, 1)
      // Turn the site towards the camera, which sits off to one side of the planet.
      const toCamera = camera.position.clone().sub(root.position)
      const yaw = Math.atan2(toCamera.x, toCamera.z)
      const lat = THREE.MathUtils.degToRad(site.location.lat)
      focus = {
        rotY: -Math.atan2(p.x, p.z) + yaw,
        // Aim a bit above centre so the fact card (bottom right) doesn't cover the site.
        tilt: THREE.MathUtils.clamp(
          THREE.MathUtils.clamp(Math.atan(Math.cos(AXIAL_TILT) * Math.tan(lat)), -MAX_DRAG_TILT, MAX_DRAG_TILT) -
            FOCUS_LIFT,
          -0.9,
          MAX_DRAG_TILT,
        ),
      }
      spinVelocity = 0
      lastInteraction = clock.elapsedTime
    }

    const zoomIn = () =>
      new Promise<void>((resolve) => {
        if (reduceMotion) return resolve()
        const toCamera = cameraHome.clone().sub(root.position).normalize()
        zoom = {
          start: clock.elapsedTime,
          from: camera.position.clone(),
          to: root.position.clone().add(toCamera.multiplyScalar(PLANET_RADIUS * root.scale.x * 1.12)),
          done: resolve,
        }
      })

    const onPointerDown = (event: PointerEvent) => {
      if (zoom || drag) return
      canvas.setPointerCapture(event.pointerId)
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: 0, lastT: performance.now() }
      spinVelocity = 0
      lastInteraction = clock.elapsedTime
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!drag) {
        if (event.pointerType === "mouse" && !zoom) canvas.style.cursor = pick(event) ? "pointer" : "grab"
        return
      }
      if (event.pointerId !== drag.id) return
      const dx = event.clientX - drag.x
      const dy = event.clientY - drag.y
      drag.x = event.clientX
      drag.y = event.clientY
      drag.moved += Math.abs(dx) + Math.abs(dy)
      if (drag.moved < TAP_SLOP) return
      canvas.style.cursor = "grabbing"
      focus = null
      const now = performance.now()
      const dt = Math.max((now - drag.lastT) / 1000, 1 / 120)
      drag.lastT = now
      const turn = dx * 0.008
      mars.rotation.y += turn
      dragTilt.rotation.x = THREE.MathUtils.clamp(dragTilt.rotation.x + dy * 0.005, -MAX_DRAG_TILT, MAX_DRAG_TILT)
      spinVelocity = THREE.MathUtils.lerp(spinVelocity, turn / dt, 0.5)
      lastInteraction = clock.elapsedTime
    }

    const onPointerUp = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return
      const wasTap = drag.moved < TAP_SLOP
      drag = null
      canvas.style.cursor = "grab"
      lastInteraction = clock.elapsedTime
      if (!wasTap) return
      const siteId = pick(event)
      onSelectRef.current(siteId)
      if (siteId) focusSite(siteId)
    }

    const onPointerCancel = () => {
      drag = null
      canvas.style.cursor = "grab"
    }

    canvas.addEventListener("pointerdown", onPointerDown)
    canvas.addEventListener("pointermove", onPointerMove)
    canvas.addEventListener("pointerup", onPointerUp)
    canvas.addEventListener("pointercancel", onPointerCancel)

    // --- Animation loop ---
    let frame = 0
    const tick = () => {
      const dt = Math.min(clock.getDelta(), 0.1)
      const t = clock.elapsedTime
      const idle = t - lastInteraction > IDLE_BEFORE_AUTOSPIN

      if (zoom) {
        const k = Math.min((t - zoom.start) / ZOOM_SECONDS, 1)
        const e = easeInOutCubic(k)
        camera.position.lerpVectors(zoom.from, zoom.to, e)
        camera.lookAt(root.position.x * e, root.position.y * e, 0)
        if (k === 1) {
          zoom.done()
          zoom = null
        }
      } else if (!drag) {
        if (focus) {
          const step = 1 - Math.exp(-dt * 4)
          mars.rotation.y += angleDelta(mars.rotation.y, focus.rotY) * step
          dragTilt.rotation.x += (focus.tilt - dragTilt.rotation.x) * step
        } else {
          mars.rotation.y += spinVelocity * dt
          spinVelocity *= Math.exp(-dt * 2.5)
          if (idle && !selectedRef.current) {
            if (!reduceMotion) mars.rotation.y += AUTOSPIN_SPEED * dt
            dragTilt.rotation.x *= Math.exp(-dt * 0.8)
          }
        }
      }

      // Deselecting (from the fact card) releases the focus lock.
      if (!selectedRef.current && focus && idle) focus = null

      for (const pin of pins) {
        const selected = pin.userData.siteId === selectedRef.current
        pin.material = selected ? pinSelectedMaterial : pinMaterial
        const pulse = reduceMotion ? 1 : 1 + 0.12 * Math.sin(t * 3 + pin.id)
        pin.scale.setScalar((selected ? 0.2 : 0.16) * pulse)
      }

      if (!reduceMotion) {
        stars.rotation.y += dt * 0.003
      }

      renderer.render(scene, camera)
      frame = requestAnimationFrame(tick)
    }

    sceneRef.current = { focusSite, zoomIn, layout: resize }
    tick()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      canvas.removeEventListener("pointerdown", onPointerDown)
      canvas.removeEventListener("pointermove", onPointerMove)
      canvas.removeEventListener("pointerup", onPointerUp)
      canvas.removeEventListener("pointercancel", onPointerCancel)
      sceneRef.current = null
      texture.dispose()
      marsGeometry.dispose()
      marsMaterial.dispose()
      atmosphereGeometry.dispose()
      atmosphereMaterial.dispose()
      pinMaterial.map?.dispose()
      pinMaterial.dispose()
      pinSelectedMaterial.map?.dispose()
      pinSelectedMaterial.dispose()
      starGeometry.dispose()
      starMaterial.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
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
