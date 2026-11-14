/**
 * Where Mars is, how it is oriented, and where the Sun shines on it, for a given date.
 *
 * Sources:
 *  - Planet positions: E. M. Standish, JPL, "Keplerian Elements for Approximate
 *    Positions of the Major Planets", Table 1 (valid 1800–2050 AD).
 *    https://ssd.jpl.nasa.gov/planets/approx_pos.html
 *  - Mars orientation: IAU WGCCRE 2009 rotation model (Archinal et al. 2011):
 *    north pole RA/Dec and prime meridian angle W (Airy-0 at 0° longitude).
 *
 * All vectors are unit vectors in the ICRF / J2000 equatorial frame.
 * Longitudes are planetocentric, east-positive, in degrees (-180..180].
 * Validated against JPL Horizons to well under 1° (see MarsGlobe notes).
 */

export type Vec3 = [number, number, number]

const DEG = Math.PI / 180
const OBLIQUITY_J2000 = 23.43928 * DEG // ecliptic → equatorial
const C_AU_PER_DAY = 173.1446327
const TT_MINUS_UTC_SECONDS = 69.184 // 37 leap seconds + 32.184 s (valid since 2017)

// [a (AU), e, I (deg), L (deg), long. perihelion (deg), long. asc. node (deg)]
// value at J2000 and rate per Julian century.
type Elements = { base: number[]; rate: number[] }
const EM_BARY: Elements = {
  base: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0],
  rate: [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0],
}
const MARS: Elements = {
  base: [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
  rate: [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s]
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const length = (a: Vec3) => Math.sqrt(dot(a, a))
const normalize = (a: Vec3): Vec3 => scale(a, 1 / length(a))

/** Heliocentric J2000 equatorial position (AU) from approximate Keplerian elements. */
function heliocentric({ base, rate }: Elements, T: number): Vec3 {
  const [a, e, I, L, varpi, Omega] = base.map((v, i) => v + rate[i] * T)
  const omega = (varpi - Omega) * DEG
  let M = ((L - varpi) % 360) * DEG
  if (M > Math.PI) M -= 2 * Math.PI
  if (M < -Math.PI) M += 2 * Math.PI

  let E = M + e * Math.sin(M)
  for (let i = 0; i < 10; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E))

  const xp = a * (Math.cos(E) - e)
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E)

  const cw = Math.cos(omega), sw = Math.sin(omega)
  const cO = Math.cos(Omega * DEG), sO = Math.sin(Omega * DEG)
  const cI = Math.cos(I * DEG), sI = Math.sin(I * DEG)
  const xe = (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp
  const ye = (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp
  const ze = sw * sI * xp + cw * sI * yp

  const ce = Math.cos(OBLIQUITY_J2000), se = Math.sin(OBLIQUITY_J2000)
  return [xe, ce * ye - se * ze, se * ye + ce * ze]
}

export interface MarsGeometry {
  /** Mars body axes in ICRF: x → 0°E on the equator, y → 90°E, z → north pole. */
  axes: { x: Vec3; y: Vec3; z: Vec3 }
  /** Direction from Mars to the Sun. */
  toSun: Vec3
  /** Direction from Mars to Earth. */
  toEarth: Vec3
  /** Point on Mars directly facing Earth / the Sun. */
  subEarth: { lat: number; lon: number }
  subSolar: { lat: number; lon: number }
  /** Position angle of Mars' north pole on Earth's sky, degrees east of celestial north. */
  northPoleAngle: number
  /** Sun–Mars–Earth angle, degrees. */
  phaseAngle: number
}

function toLatLon(v: Vec3, axes: MarsGeometry["axes"]) {
  const lat = Math.asin(dot(v, axes.z)) / DEG
  const lon = Math.atan2(dot(v, axes.y), dot(v, axes.x)) / DEG
  return { lat, lon }
}

export function marsGeometry(date: Date): MarsGeometry {
  const jdTT = 2440587.5 + date.getTime() / 86_400_000 + TT_MINUS_UTC_SECONDS / 86_400
  const T = (jdTT - 2451545.0) / 36525

  // Earth now; Mars where it was when the light we see left it.
  const earth = heliocentric(EM_BARY, T)
  let lightTime = 0
  let mars = heliocentric(MARS, T)
  for (let i = 0; i < 3; i++) {
    lightTime = length(sub(mars, earth)) / C_AU_PER_DAY
    mars = heliocentric(MARS, T - lightTime / 36525)
  }

  // IAU 2009 rotation model, evaluated at the light-emission time.
  const d = jdTT - lightTime - 2451545.0
  const Tm = d / 36525
  const ra0 = (317.68143 - 0.1061 * Tm) * DEG
  const dec0 = (52.8865 - 0.0609 * Tm) * DEG
  const W = ((176.63 + 350.89198226 * d) % 360) * DEG

  const z: Vec3 = [Math.cos(dec0) * Math.cos(ra0), Math.cos(dec0) * Math.sin(ra0), Math.sin(dec0)]
  const node: Vec3 = [-Math.sin(ra0), Math.cos(ra0), 0] // ascending node of Mars' equator on the ICRF equator
  const nodeCross = cross(z, node)
  const x = normalize([
    node[0] * Math.cos(W) + nodeCross[0] * Math.sin(W),
    node[1] * Math.cos(W) + nodeCross[1] * Math.sin(W),
    node[2] * Math.cos(W) + nodeCross[2] * Math.sin(W),
  ])
  const y = cross(z, x)
  const axes = { x, y, z }

  const toSun = normalize(scale(mars, -1))
  const toEarth = normalize(sub(earth, mars))

  // Pole position angle on the sky as seen from Earth.
  const s = scale(toEarth, -1) // line of sight Earth → Mars
  const north = normalize(sub([0, 0, 1], scale(s, s[2])))
  const east = normalize(cross([0, 0, 1], s))
  const poleOnSky = sub(z, scale(s, dot(z, s)))
  let northPoleAngle = Math.atan2(dot(poleOnSky, east), dot(poleOnSky, north)) / DEG
  if (northPoleAngle < 0) northPoleAngle += 360

  return {
    axes,
    toSun,
    toEarth,
    subEarth: toLatLon(toEarth, axes),
    subSolar: toLatLon(toSun, axes),
    northPoleAngle,
    phaseAngle: Math.acos(Math.min(1, Math.max(-1, dot(toSun, toEarth)))) / DEG,
  }
}
