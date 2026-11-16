import { issueOrder, tileOf, type Mover, type OrderResult, type ShelterRule, type Station, type Tile, type World } from "@/sim/pathing"

/*
 * Research Labs and the crew in them, as pure logic over the movement world (sim/pathing).
 *
 * Every module is a walk-in station (see sim/navigation.ts); a Research Lab's station has kind
 * "research" (or "research-pro" for the Advanced Research Lab, see LAB_SPEED). Each lab holds one astronaut: the one sent to work there. A lab is *staffed* while
 * that astronaut is standing inside it. Someone just walking through, or wandering about, doesn't
 * count, and nor does the assigned astronaut while still on the way or after stepping out (for
 * oxygen, to explore, or because the player sent them somewhere else).
 *
 * In a storm (`storm: true`) the rule still holds: one astronaut per lab. Someone hiding from the
 * storm in a lab nobody was sent to counts as working in it, so research carries on, and nobody
 * else may shelter there (see shelterRule).
 */

/** The kinds of module that are Research Labs, and how fast each works compared with a plain one. */
export const LAB_SPEED: Record<string, number> = {
  research: 1,
  // The Advanced Research Lab, unlocked by the Better Research project.
  "research-pro": 1.5,
}

export const isLab = (station: Station) => station.kind in LAB_SPEED

/** How fast this lab works: 1 for a plain Research Lab, more for an advanced one. */
export const labSpeed = (world: World, stationId: string) =>
  LAB_SPEED[world.stations.find((s) => s.id === stationId)?.kind ?? ""] ?? 1

/** The Research Labs on the map. */
export const researchLabs = (world: World) => world.stations.filter(isLab)

/** The station the pawn has been sent to work at, including an order set aside for an urgent need. */
function assignedStationId(mover: Mover): string | null {
  if (mover.order?.kind === "work") return mover.order.stationId
  if (mover.interrupt?.resume?.kind === "work") return mover.interrupt.resume.stationId
  return null
}

/** The astronaut sent to work in this lab (on the way or already there), or null if nobody was. */
export function labWorker(world: World, stationId: string): string | null {
  const mover = Object.values(world.movers).find((m) => assignedStationId(m) === stationId)
  return mover?.pawnId ?? null
}

const inside = (station: Station, tile: Tile) => station.footprint.some((t) => t.x === tile.x && t.y === tile.y)

/**
 * The astronaut using this lab: the one sent to work there or, in a storm, the first one hiding
 * in it (standing in it, or heading there) who wasn't sent to work anywhere. Null if it's free.
 */
export function labUser(world: World, stationId: string, storm = false): string | null {
  const worker = labWorker(world, stationId)
  if (worker || !storm) return worker
  const lab = world.stations.find((s) => s.id === stationId)
  if (!lab) return null
  const hiding = Object.values(world.movers).find(
    (m) => assignedStationId(m) === null && inside(lab, m.destination ?? tileOf(m.pos)),
  )
  return hiding?.pawnId ?? null
}

/** In a storm: a pawn may shelter anywhere indoors except in a lab someone else is using. */
export function shelterRule(world: World): ShelterRule {
  return (pawnId, tile) => {
    const lab = researchLabs(world).find((s) => inside(s, tile))
    if (!lab) return true
    const user = labUser(world, lab.id, true)
    return user === null || user === pawnId
  }
}

/** The lab this astronaut has been sent to, or null. */
export function labOf(world: World, pawnId: string): string | null {
  const mover = world.movers[pawnId]
  const id = mover ? assignedStationId(mover) : null
  return id && researchLabs(world).some((lab) => lab.id === id) ? id : null
}

/** The labs with their astronaut inside right now, one entry per lab. In a storm, hiding there counts. */
export function staffedLabs(world: World, storm = false): { stationId: string; pawnId: string }[] {
  const staffed: { stationId: string; pawnId: string }[] = []
  for (const lab of researchLabs(world)) {
    const pawnId = labUser(world, lab.id, storm)
    const mover = pawnId ? world.movers[pawnId] : undefined
    if (mover && inside(lab, tileOf(mover.pos))) staffed.push({ stationId: lab.id, pawnId: mover.pawnId })
  }
  return staffed
}

/**
 * In a storm: an astronaut hiding in a lab with nothing else to get back to afterwards is made
 * that lab's worker, so they carry on researching when the storm is over. Anyone with an order of
 * their own goes back to it after the storm. Returns the astronauts it set to work.
 */
export function keepHidersResearching(world: World): string[] {
  const set: string[] = []
  for (const { stationId, pawnId } of staffedLabs(world, true)) {
    if (labWorker(world, stationId) === pawnId) continue
    const mover = world.movers[pawnId]
    const nothingToResume = mover.interrupt ? mover.interrupt.resume === null : mover.order === null
    if (nothingToResume && issueOrder(world, pawnId, { kind: "work", stationId }).ok) set.push(pawnId)
  }
  return set
}

/** How many labs have an astronaut using them, whether there yet or still on the way. */
export const claimedLabCount = (world: World, storm = false) =>
  researchLabs(world).filter((lab) => labUser(world, lab.id, storm) !== null).length

const distance = (world: World, pawnId: string, station: Station) => {
  const p = world.movers[pawnId].pos
  return Math.min(...station.footprint.map((t) => Math.hypot(t.x - p.x, t.y - p.y)))
}

/**
 * Which of the selected astronauts should go and work in this lab, since it holds only one.
 * The one already working there stays; otherwise the nearest one goes. If someone who isn't
 * selected is already working there, nobody can go.
 */
export function pickLabWorker(
  world: World,
  selected: readonly string[],
  stationId: string,
  storm = false,
): { ok: true; pawnId: string; left: string[] } | { ok: false; worker: string } {
  const station = world.stations.find((s) => s.id === stationId)
  const worker = labUser(world, stationId, storm)
  if (worker && !selected.includes(worker)) return { ok: false, worker }
  const onMap = selected.filter((id) => world.movers[id])
  const pawnId = worker ?? [...onMap].sort((a, b) => (station ? distance(world, a, station) - distance(world, b, station) : 0))[0]
  return { ok: true, pawnId, left: onMap.filter((id) => id !== pawnId) }
}

/**
 * Starting research with no lab staffed or claimed: sends the nearest free astronaut to the
 * nearest free lab. Astronauts with nothing to do go first; anyone already working in a lab
 * stays where they are.
 */
export function sendResearcher(
  world: World,
  storm = false,
):
  | { ok: true; pawnId: string; stationId: string; result: Extract<OrderResult, { ok: true }> }
  | { ok: false; reason: string } {
  const labs = researchLabs(world).filter((lab) => labUser(world, lab.id, storm) === null)
  if (researchLabs(world).length === 0) return { ok: false, reason: "Build a Research Lab first." }
  if (labs.length === 0) return { ok: false, reason: "Every Research Lab already has an astronaut." }
  const crew = Object.values(world.movers).filter((m) => labOf(world, m.pawnId) === null)
  if (crew.length === 0) return { ok: false, reason: "Nobody is at the base to work in the lab." }
  const pairs = crew.flatMap((mover) =>
    labs.map((lab) => ({ mover, lab, cost: distance(world, mover.pawnId, lab) + (mover.order ? 1000 : 0) })),
  )
  pairs.sort((a, b) => a.cost - b.cost)
  let reason = "Nobody can get to a Research Lab."
  for (const { mover, lab } of pairs) {
    const result = issueOrder(world, mover.pawnId, { kind: "work", stationId: lab.id })
    if (result.ok) return { ok: true, pawnId: mover.pawnId, stationId: lab.id, result }
    reason = result.reason
  }
  return { ok: false, reason }
}
