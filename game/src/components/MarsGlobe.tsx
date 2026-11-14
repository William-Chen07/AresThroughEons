import { useEffect, useRef } from "react"
import * as THREE from "three"
import marsTextureUrl from "@/assets/mars.jpg"

/**
 * Full-viewport rotating 3D Mars globe, rendered with three.js.
 *
 * Texture: Viking MDIM 2.1 colour mosaic, stitched from NASA Mars Trek
 * (trek.nasa.gov) WMTS tiles. Credit: NASA/JPL/USGS.
 */
export function MarsGlobe({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x020104)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1000)
    camera.position.set(0, 0, 6)

    // Group holds the planet + atmosphere so they move together.
    const planet = new THREE.Group()
    planet.rotation.z = THREE.MathUtils.degToRad(25.2) // Mars axial tilt
    scene.add(planet)

    // --- Mars ---
    const texture = new THREE.TextureLoader().load(marsTextureUrl)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy()

    const marsGeometry = new THREE.SphereGeometry(1.5, 128, 64)
    const marsMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 1,
      metalness: 0,
    })
    const mars = new THREE.Mesh(marsGeometry, marsMaterial)
    mars.rotation.y = THREE.MathUtils.degToRad(-60) // start facing Valles Marineris
    planet.add(mars)

    // --- Thin dusty atmosphere (fresnel rim glow) ---
    const atmosphereGeometry = new THREE.SphereGeometry(1.62, 64, 32)
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
    planet.add(new THREE.Mesh(atmosphereGeometry, atmosphereMaterial))

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

    // --- Layout: push the globe to the right on wide screens so the menu has room ---
    const resize = () => {
      const { clientWidth: w, clientHeight: h } = container
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      const wide = w / h > 1.1
      planet.position.x = wide ? Math.min(1.6, (w / h - 1) * 1.4) : 0
      planet.position.y = wide ? 0 : -0.9
      const scale = wide ? 1 : 0.85
      planet.scale.setScalar(scale)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(container)

    // --- Animation loop ---
    const clock = new THREE.Clock()
    let frame = 0
    const tick = () => {
      const dt = clock.getDelta()
      if (!reduceMotion) {
        mars.rotation.y += dt * 0.05
        stars.rotation.y += dt * 0.003
      }
      renderer.render(scene, camera)
      frame = requestAnimationFrame(tick)
    }
    tick()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      texture.dispose()
      marsGeometry.dispose()
      marsMaterial.dispose()
      atmosphereGeometry.dispose()
      atmosphereMaterial.dispose()
      starGeometry.dispose()
      starMaterial.dispose()
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
