import { useEffect, useRef } from "react"
import * as THREE from "three"
import {
  ASTRONAUT_WIDTH,
  CREW_COLORS,
  createAstronaut,
  createTech,
  disposeObject,
  type Astronaut,
} from "@/components/menu/menuModels"
import { cn } from "@/lib/utils"
import { useProgress } from "@/sim/progress"

const MAX_CREW = CREW_COLORS.length
const GAP = 0.05 // space between neighbours
const TECH_GAP = 0.14 // extra space between the crew and their tech
const MIN_VIEW_WIDTH = 1.4 // keeps a lone astronaut from looking huge
const MIN_VIEW_HEIGHT = 0.46 // a hovering astronaut at the top of its bounce, plus its shadow
const HOVER_HEIGHT = 0.06 // resting height above the button
const HIDDEN_Y = -0.34 // fully below the button's top edge, so clipped away
const STAGGER = 0.05 // seconds each item waits after its left neighbour
// Spring that moves each item: stiffness, and damping ratio when rising / sinking.
// A ratio near 1 means it glides to its spot with almost no bounce.
const SPRING_STIFFNESS = 90
const RISE_DAMPING = 0.8
const SINK_DAMPING = 1
const HIDE_DELAY = 0.2 // seconds off the button before the crew sinks, so quick flicks don't make them dip
const CAMERA_LIFT = 0.75 // camera sits above the row, looking slightly down

/**
 * The player's crew (and unlocked tech), hidden behind the Play button until
 * `show` is true, then popping up to hover in a row on top of it. Drawn in a
 * small transparent three.js canvas that the parent places *behind* the button;
 * anything below the button's top edge is clipped, so items rise from behind
 * it. More crew and tech join the row as `progress` grows.
 */
export function CrewHover({ show, className }: { show: boolean; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const showRef = useRef(show)
  const crewCount = useProgress((s) => s.crewCount)
  const techKey = useProgress((s) => s.unlockedTech.join(","))

  useEffect(() => {
    showRef.current = show
  }, [show])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    // Cut everything below the floor (the button's top edge) so hidden items vanish.
    renderer.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)]
    renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.add(new THREE.AmbientLight(0xffffff, 1.1))
    const key = new THREE.DirectionalLight(0xfff4e8, 2.2)
    key.position.set(-2, 3, 4)
    scene.add(key)
    const camera = new THREE.OrthographicCamera()

    // --- Build the row: astronauts first, then tech ---
    const row = new THREE.Group()
    scene.add(row)
    const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, depthWrite: false })
    // `y`/`v` are each item's spring position and velocity (before the idle bob).
    const items: {
      group: THREE.Object3D
      shadow: THREE.Mesh
      phase: number
      astronaut?: Astronaut
      y: number
      v: number
    }[] = []
    let cursor = 0
    const addItem = (group: THREE.Object3D, width: number, astronaut?: Astronaut) => {
      group.position.x = cursor + width / 2
      cursor += width + GAP
      const shadow = new THREE.Mesh(new THREE.CircleGeometry(width * 0.42, 20), shadowMaterial.clone())
      shadow.rotation.x = -Math.PI / 2
      shadow.position.set(group.position.x, 0.001, 0)
      row.add(group, shadow)
      items.push({ group, shadow, phase: items.length * 0.9, astronaut, y: HIDDEN_Y, v: 0 })
    }

    const crew = THREE.MathUtils.clamp(crewCount, 1, MAX_CREW)
    for (let i = 0; i < crew; i++) {
      const astronaut = createAstronaut(CREW_COLORS[i])
      astronaut.wavingArm.rotation.z = i === 0 ? 2.4 : 0.2 // only the first one waves
      addItem(astronaut.group, ASTRONAUT_WIDTH, astronaut)
    }
    const tech = techKey.split(",").map(createTech).filter((t) => t !== null)
    if (tech.length) cursor += TECH_GAP
    for (const { group, width } of tech) {
      group.rotation.y = -0.4 // three-quarter view reads better than side-on
      addItem(group, width)
    }
    const rowWidth = cursor - GAP
    row.position.x = -rowWidth / 2

    // --- Fit the row into the canvas, never cropping heads ---
    const resize = () => {
      const { clientWidth: w, clientHeight: h } = container
      if (!w || !h) return
      renderer.setSize(w, h, false)
      const viewWidth = Math.max(MIN_VIEW_WIDTH, rowWidth + 0.2, MIN_VIEW_HEIGHT * (w / h))
      const viewHeight = viewWidth / (w / h)
      camera.left = -viewWidth / 2
      camera.right = viewWidth / 2
      camera.top = viewHeight / 2
      camera.bottom = -viewHeight / 2
      camera.near = 0.1
      camera.far = 20
      // Aim so the floor (the button's top edge) sits near the canvas bottom.
      const targetY = viewHeight / 2 - 0.05
      camera.position.set(0, targetY + CAMERA_LIFT, 4)
      camera.lookAt(0, targetY, 0)
      camera.updateProjectionMatrix()
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(container)

    // --- Animation: rise from behind the button, then a gentle low-gravity hover ---
    // Each item is a damped spring pulled towards "up" or "hidden". Position and
    // velocity carry over when the target flips, so quick hover on/off just turns
    // them around smoothly instead of replaying a canned curve.
    const clock = new THREE.Clock()
    let showing = false
    let flippedAt = 0
    let lastWanted = -Infinity
    // The bob phase advances by speed × dt each frame; sin(time × speed) would
    // jump whenever the speed changed.
    let bobPhase = 0
    let wavePhase = 0
    let wasEmpty = false
    let frame = 0
    const tick = () => {
      frame = requestAnimationFrame(tick)
      const dt = Math.min(clock.getDelta(), 0.1)
      const t = clock.elapsedTime
      if (showRef.current) lastWanted = t
      const next = showRef.current || t - lastWanted < HIDE_DELAY
      if (next !== showing) {
        showing = next
        flippedAt = t
        // Drop momentum heading the old way so nobody coasts up after you leave
        // (or keeps sinking after you come back).
        for (const item of items) item.v = showing ? Math.max(item.v, 0) : Math.min(item.v, 0)
      }
      bobPhase += dt * 2
      wavePhase += dt * 7

      let anyVisible = false
      items.forEach((item, i) => {
        const { group, shadow, phase, astronaut } = item
        // Left-to-right stagger when rising; everyone sinks together.
        const up = showing && t - flippedAt >= i * STAGGER
        const target = up ? HOVER_HEIGHT : HIDDEN_Y
        if (reduceMotion) {
          item.y = target
          item.v = 0
        } else {
          const damping = 2 * (up ? RISE_DAMPING : SINK_DAMPING) * Math.sqrt(SPRING_STIFFNESS)
          // Small fixed substeps keep the spring stable on slow frames.
          const steps = Math.ceil(dt / (1 / 240))
          const h = dt / steps
          for (let k = 0; k < steps; k++) {
            item.v += (SPRING_STIFFNESS * (target - item.y) - damping * item.v) * h
            item.y += item.v * h
          }
        }
        // 0 when hidden, 1 when fully up; fades the bob and shadow in and out.
        const visible = THREE.MathUtils.clamp((item.y - HIDDEN_Y) / (HOVER_HEIGHT - HIDDEN_Y), 0, 1)
        const bob = reduceMotion ? 0 : Math.sin(bobPhase + phase) * 0.022 * visible
        const y = item.y + bob
        group.position.y = y
        group.visible = visible > 0.001
        anyVisible ||= group.visible
        if (astronaut && !reduceMotion) group.rotation.y = Math.sin(t * 0.7 + phase) * 0.3
        // Shadow fades in with the item, and shrinks and fades as it rises.
        const height = Math.max(y, 0)
        shadow.scale.setScalar(Math.max(0.01, 1 - height * 2.5))
        ;(shadow.material as THREE.MeshBasicMaterial).opacity = visible * Math.max(0, 0.4 - height * 2.5)
        if (i === 0 && astronaut && !reduceMotion) {
          astronaut.wavingArm.rotation.z = 2.4 + Math.sin(wavePhase) * 0.35
        }
      })

      // Nothing to draw while everyone is hidden; clear once, then idle.
      if (!anyVisible && wasEmpty) return
      wasEmpty = !anyVisible
      renderer.render(scene, camera)
    }
    tick()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      disposeObject(row)
      shadowMaterial.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [crewCount, techKey])

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={cn("pointer-events-none [&>canvas]:block [&>canvas]:size-full", className)}
    />
  )
}
