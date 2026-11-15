import * as THREE from "three"

/**
 * Placeholder low-poly models for the crew row above the Play button, built from
 * primitives so they can be swapped for Blender (glTF) models later.
 * Units: one astronaut is about 0.25 tall and 0.14 wide.
 */

/** Same suit for every astronaut; only the accent colour changes. */
export const CREW_COLORS = ["#f97316", "#22d3ee", "#facc15", "#a78bfa", "#4ade80", "#f472b6"]

/** Tech ids from progress.unlockedTech that have a model on the menu. */
export const MENU_TECH = ["habitat", "greenhouse", "rover"] as const
type MenuTech = (typeof MENU_TECH)[number]

// Slight self-glow keeps the models readable on the dark side of the scene.
function mat(color: THREE.ColorRepresentation, options: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.18,
    roughness: 0.7,
    flatShading: true,
    ...options,
  })
}

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material)
  m.position.set(x, y, z)
  return m
}

export interface Astronaut {
  group: THREE.Group
  /** Pivot at the shoulder; rotate on z to wave. */
  wavingArm: THREE.Object3D
}

export function createAstronaut(accent: string): Astronaut {
  const group = new THREE.Group()
  const suit = mat("#f4f1ea")
  const trim = mat(accent)
  const visor = mat("#2dd4bf", { emissiveIntensity: 0.6, roughness: 0.2, metalness: 0.4 })

  // Legs
  for (const x of [-0.025, 0.025]) group.add(mesh(new THREE.CapsuleGeometry(0.018, 0.05, 3, 8), suit, x, 0.045, 0))
  // Body with a coloured chest band and backpack
  group.add(mesh(new THREE.CapsuleGeometry(0.045, 0.06, 4, 10), suit, 0, 0.13, 0))
  group.add(mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.022, 10), trim, 0, 0.13, 0))
  group.add(mesh(new THREE.BoxGeometry(0.07, 0.08, 0.035), trim, 0, 0.14, -0.045))
  // Helmet + visor
  group.add(mesh(new THREE.SphereGeometry(0.048, 12, 10), suit, 0, 0.215, 0))
  const visorMesh = mesh(new THREE.SphereGeometry(0.036, 12, 10), visor, 0, 0.218, 0.03)
  visorMesh.scale.set(1, 0.75, 0.8)
  group.add(visorMesh)

  // Arms: left hangs down, right waves from a shoulder pivot
  const armGeometry = new THREE.CapsuleGeometry(0.014, 0.055, 3, 8)
  const leftArm = mesh(armGeometry, suit, -0.058, 0.13, 0)
  leftArm.rotation.z = -0.2
  group.add(leftArm)
  const wavingArm = new THREE.Object3D()
  wavingArm.position.set(0.05, 0.165, 0)
  const rightArm = mesh(armGeometry, suit, 0, 0.035, 0)
  wavingArm.add(rightArm)
  wavingArm.rotation.z = 2.4
  group.add(wavingArm)

  return { group, wavingArm }
}

function createHabitat(): THREE.Group {
  const group = new THREE.Group()
  group.add(mesh(new THREE.SphereGeometry(0.16, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat("#f4f1ea"), 0, 0, 0))
  group.add(mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.025, 14), mat("#f97316"), 0, 0.012, 0))
  const door = mesh(new THREE.BoxGeometry(0.06, 0.08, 0.06), mat("#9ca3af"), 0, 0.04, 0.15)
  group.add(door)
  return group
}

function createGreenhouse(): THREE.Group {
  const group = new THREE.Group()
  const glass = new THREE.MeshStandardMaterial({
    color: "#99f6e4",
    emissive: "#2dd4bf",
    emissiveIntensity: 0.25,
    transparent: true,
    opacity: 0.45,
    roughness: 0.1,
  })
  group.add(mesh(new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), glass, 0, 0, 0))
  const plant = mat("#4ade80", { emissiveIntensity: 0.4 })
  for (const [x, z] of [[-0.04, 0], [0.04, 0.02], [0, -0.04]]) {
    group.add(mesh(new THREE.ConeGeometry(0.025, 0.07, 6), plant, x, 0.035, z))
  }
  return group
}

function createRover(): THREE.Group {
  const group = new THREE.Group()
  const body = mat("#f4f1ea")
  const wheel = mat("#374151")
  group.add(mesh(new THREE.BoxGeometry(0.16, 0.05, 0.1), body, 0, 0.07, 0))
  group.add(mesh(new THREE.BoxGeometry(0.15, 0.008, 0.11), mat("#1e3a8a", { metalness: 0.4 }), 0, 0.1, 0))
  const wheelGeometry = new THREE.CylinderGeometry(0.025, 0.025, 0.02, 10)
  for (const x of [-0.06, 0, 0.06]) {
    for (const z of [-0.06, 0.06]) {
      const w = mesh(wheelGeometry, wheel, x, 0.025, z)
      w.rotation.x = Math.PI / 2
      group.add(w)
    }
  }
  group.add(mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.09, 4), body, 0.05, 0.15, 0.03))
  group.add(mesh(new THREE.BoxGeometry(0.035, 0.02, 0.02), mat("#facc15"), 0.05, 0.2, 0.03))
  return group
}

const TECH_BUILDERS: Record<MenuTech, () => THREE.Group> = {
  habitat: createHabitat,
  greenhouse: createGreenhouse,
  rover: createRover,
}

/** Footprint width of each model, used to space the row. */
export const ASTRONAUT_WIDTH = 0.14
const TECH_WIDTH: Record<MenuTech, number> = { habitat: 0.34, greenhouse: 0.26, rover: 0.2 }

export function createTech(id: string): { group: THREE.Group; width: number } | null {
  if (!(MENU_TECH as readonly string[]).includes(id)) return null
  return { group: TECH_BUILDERS[id as MenuTech](), width: TECH_WIDTH[id as MenuTech] }
}

/** Free every geometry and material under an object. */
export function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose()
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.forEach((m) => m.dispose())
    }
  })
}
