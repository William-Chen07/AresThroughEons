/**
 * Where Mars is, how it is oriented, and where the Sun shines on it, for a given date.
 *
 * Sources (both from NASA/JPL's NAIF, whose rules state that kernels "may be downloaded
 * and used by anyone": https://naif.jpl.nasa.gov/naif/rules.html):
 *  - Planet positions: DE442 planetary ephemeris (generic_kernels/spk/planets/de442s.bsp,
 *    released 2025-02-06), pre-sampled every 2 days for 2024–2050 into
 *    src/assets/mars_earth_de442_2024_2050.bin.
 *  - Mars orientation: NAIF text PCK mars_konopliv_2026_v1.tpc (released 2026-10-03),
 *    copied into src/assets/mars_rotation_konopliv_2026.json and evaluated here exactly as
 *    SPICE evaluates a text PCK. Model: Konopliv et al. 2026, "Updated Mars Orientation and
 *    Gravity Field and Indication of Decadal Changes in Rotation Rate", The Planetary
 *    Science Journal (open access), doi:10.3847/PSJ/ae9ba7.
 *
 * All vectors are unit vectors in the ICRF / J2000 equatorial frame.
 * Longitudes are planetocentric, east-positive, in degrees (-180..180].
 */

export type Vec3 = [number, number, number]

/** Earth and Mars heliocentric positions (AU), sampled at a fixed step. */
export interface EphemerisTable {
  startJd: number // TDB
  stepDays: number
  count: number
  /** count × [earthX, earthY, earthZ, marsX, marsY, marsZ] */
  data: Float32Array
}

/** Parse the binary table written by the bake script (24-byte header + float32 rows). */
export function parseEphemerisTable(buffer: ArrayBuffer): EphemerisTable {
  const header = new DataView(buffer, 0, 24)
  const startJd = header.getFloat64(0, true)
  const stepDays = header.getFloat64(8, true)
  const count = header.getFloat64(16, true)
  return { startJd, stepDays, count, data: new Float32Array(buffer, 24, count * 6) }
}

const DEG = Math.PI / 180
const C_AU_PER_DAY = 173.1446327
const TT_MINUS_UTC_SECONDS = 69.184 // 37 leap seconds + 32.184 s (valid since 2017); TDB ≈ TT

/** Mars rotation model in NAIF text-PCK form (see mars_rotation_konopliv_2026.json). */
export interface RotationModel {
  /** Pole right ascension / declination: deg, deg/century, deg/century². */
  poleRa: number[]
  poleDec: number[]
  /** Prime meridian: deg, deg/day, deg/day². */
  pm: number[]
  /** Per-angle amplitudes (deg): RA and PM use sin, DEC uses cos. */
  nutRa: number[]
  nutDec: number[]
  nutPm: number[]
  /** Angles θᵢ = Σₖ cᵢₖ·Tᵏ (deg), phaseDegree + 1 coefficients per angle. */
  angles: number[]
  phaseDegree: number
  radiiKm: number[]
}

/** Pole RA/Dec and prime-meridian angle (all radians) at `d` days past J2000 TDB. */
function orientation(model: RotationModel, d: number) {
  const T = d / 36525
  const poly = (c: number[], x: number) => c.reduce((sum, ck, k) => sum + ck * x ** k, 0)
  let ra = poly(model.poleRa, T)
  let dec = poly(model.poleDec, T)
  let w = poly(model.pm, d)
  const stride = model.phaseDegree + 1
  for (let i = 0; i < model.nutRa.length; i++) {
    const theta = poly(model.angles.slice(i * stride, i * stride + stride), T) * DEG
    ra += model.nutRa[i] * Math.sin(theta)
    dec += model.nutDec[i] * Math.cos(theta)
    w += model.nutPm[i] * Math.sin(theta)
  }
  return { ra: ra * DEG, dec: dec * DEG, w: (w % 360) * DEG }
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

/**
 * Heliocentric position (AU) of Earth (body 0) or Mars (body 1) at a TDB Julian date,
 * by 4-point Lagrange interpolation. Dates outside the table are clamped to its ends.
 */
function position(table: EphemerisTable, jd: number, body: 0 | 1): Vec3 {
  const { startJd, stepDays, count, data } = table
  const x = Math.min(Math.max((jd - startJd) / stepDays, 1), count - 3)
  const i = Math.floor(x)
  const t = x - i
  // Lagrange weights for nodes at -1, 0, 1, 2
  const w = [
    (-t * (t - 1) * (t - 2)) / 6,
    ((t + 1) * (t - 1) * (t - 2)) / 2,
    (-(t + 1) * t * (t - 2)) / 2,
    ((t + 1) * t * (t - 1)) / 6,
  ]
  const out: Vec3 = [0, 0, 0]
  for (let k = 0; k < 4; k++) {
    const row = (i - 1 + k) * 6 + body * 3
    out[0] += w[k] * data[row]
    out[1] += w[k] * data[row + 1]
    out[2] += w[k] * data[row + 2]
  }
  return out
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
  /** TDB Julian date at which the light seen from Earth left Mars (date minus light-time). */
  emitJd: number
}

function toLatLon(v: Vec3, axes: MarsGeometry["axes"]) {
  const lat = Math.asin(dot(v, axes.z)) / DEG
  const lon = Math.atan2(dot(v, axes.y), dot(v, axes.x)) / DEG
  return { lat, lon }
}

export function marsGeometry(date: Date, table: EphemerisTable, rotation: RotationModel): MarsGeometry {
  const jd = 2440587.5 + date.getTime() / 86_400_000 + TT_MINUS_UTC_SECONDS / 86_400

  // Earth now; Mars where it was when the light we see left it.
  const earth = position(table, jd, 0)
  let lightTime = 0
  let mars = position(table, jd, 1)
  for (let i = 0; i < 3; i++) {
    lightTime = length(sub(mars, earth)) / C_AU_PER_DAY
    mars = position(table, jd - lightTime, 1)
  }

  // Rotation model evaluated at the light-emission time.
  const { ra: ra0, dec: dec0, w: W } = orientation(rotation, jd - lightTime - 2451545.0)

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
    emitJd: jd - lightTime,
  }
}
