/**
 * Where Phobos and Deimos are around Mars at a given moment.
 *
 * Source: NASA/JPL Horizons (satellite ephemeris mar099), osculating orbital elements of each
 * moon relative to the centre of Mars in the ICRF frame, sampled every 5 days for 2024–2050
 * and baked into src/assets/mars_moons_horizons_2024_2050.json (see its "_source" field).
 *
 * Between samples the node, inclination and argument of latitude are interpolated linearly
 * (the argument of latitude is stored unwrapped, so it already counts the whole orbits). The
 * orbits are nearly circular (e ≈ 0.015 and 0.0002), so the moon's direction from Mars is good
 * to within about 2°; the distance is taken as the mean semi-major axis.
 */
import type { Vec3 } from "@/lib/marsEphemeris"

export type MoonId = "phobos" | "deimos"

export interface MoonTable {
  startJd: number // TDB
  stepDays: number
  phobos: MoonOrbit
  deimos: MoonOrbit
}

interface MoonOrbit {
  /** Mean semi-major axis, km. */
  aKm: number
  /** [node Ω (deg), inclination i (deg), argument of latitude u (deg, unwrapped)] per sample. */
  rows: [number, number, number][]
}

export interface MoonState {
  /** Unit vector from the centre of Mars to the moon (ICRF). */
  direction: Vec3
  /** Unit normal of the orbit plane (ICRF), the direction the moon's orbit turns about. */
  orbitNormal: Vec3
  distanceKm: number
}

const DEG = Math.PI / 180

/** Moon position at a TDB Julian date. Dates outside the table are clamped to its ends. */
export function moonState(table: MoonTable, id: MoonId, jd: number): MoonState {
  const { rows, aKm } = table[id]
  const x = Math.min(Math.max((jd - table.startJd) / table.stepDays, 0), rows.length - 1.000001)
  const i = Math.floor(x)
  const t = x - i
  const [om0, in0, u0] = rows[i]
  const [om1, in1, u1] = rows[i + 1]
  const om = (om0 + (om1 - om0) * t) * DEG
  const inc = (in0 + (in1 - in0) * t) * DEG
  const u = (u0 + (u1 - u0) * t) * DEG

  const cO = Math.cos(om)
  const sO = Math.sin(om)
  const ci = Math.cos(inc)
  const si = Math.sin(inc)
  const cu = Math.cos(u)
  const su = Math.sin(u)
  return {
    direction: [cO * cu - sO * su * ci, sO * cu + cO * su * ci, su * si],
    orbitNormal: [sO * si, -cO * si, ci],
    distanceKm: aKm,
  }
}
