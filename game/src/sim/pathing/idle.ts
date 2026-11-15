import type { PathingEvent } from "./events"
import { BLOCKED, getZone, inBounds, tileIndex, tileOf, type Tile } from "./grid"
import { routing, setRoute } from "./orders"
import { findPath } from "./pathfinding"
import { random, randomBetween } from "./random"
import { PATHING_TUNING } from "./tuning"
import type { Mover, World } from "./world"

const T = PATHING_TUNING

const newPause = (world: World) => ({
  kind: "pause" as const,
  hoursLeft: randomBetween(world, T.pauseHours.min, T.pauseHours.max),
})

/** Stand still on the centre of the tile the pawn is on. */
function halt(world: World, mover: Mover) {
  setRoute(world, mover, [tileOf(mover.pos)])
  mover.destination = null
}

const isFree = (m: Mover) => m.order === null && m.interrupt === null && m.waitHours === 0

/** Idle, not busy with a chat, not on cooldown: could start a chat. */
const canChat = (m: Mover) =>
  isFree(m) && m.chatCooldownHours <= 0 && (m.idle === null || m.idle.kind === "pause" || m.idle.kind === "wander")

/** A route that stays on this side of the habitat wall (no airlocks), or null. */
function localRoute(world: World, mover: Mover, goals: Tile[], field: number[], maxLength: number): Tile[] | null {
  const { costAt, canStep } = routing(world, field, mover)
  const path = findPath(costAt, world.grid.width, world.grid.height, tileOf(mover.pos), goals, { canStep })
  if (!path || path.length > maxLength) return null
  return path.some((t) => getZone(world.grid, t.x, t.y) === "airlock") ? null : path
}

/** Starts a stroll to a random reachable spot near the anchor. Returns false if none was found. */
function startWander(world: World, mover: Mover, field: number[]): boolean {
  const anchor = mover.anchor ?? tileOf(mover.pos)
  const zone = getZone(world.grid, tileOf(mover.pos).x, tileOf(mover.pos).y)
  const r = T.wanderRadius
  for (let attempt = 0; attempt < 8; attempt++) {
    const target = {
      x: anchor.x + Math.round(randomBetween(world, -r, r)),
      y: anchor.y + Math.round(randomBetween(world, -r, r)),
    }
    if (!inBounds(world.grid, target.x, target.y)) continue
    if (field[tileIndex(world.grid, target.x, target.y)] === BLOCKED) continue
    if (getZone(world.grid, target.x, target.y) !== zone) continue
    const path = localRoute(world, mover, [target], field, r * 3)
    if (!path || path.length === 0) continue
    setRoute(world, mover, path)
    mover.destination = null
    mover.idle = { kind: "wander" }
    return true
  }
  return false
}

/** The nearest crewmate this pawn could chat with right now, if any. */
function findChatPartner(world: World, mover: Mover): Mover | null {
  let best: Mover | null = null
  let bestDistance: number = T.chatRange
  for (const other of Object.values(world.movers)) {
    if (other === mover || !canChat(other) || other.exposure !== mover.exposure) continue
    const distance = Math.hypot(other.pos.x - mover.pos.x, other.pos.y - mover.pos.y)
    if (distance <= bestDistance) {
      best = other
      bestDistance = distance
    }
  }
  return best
}

/** Walks over to a partner, who stops and waits. Returns false if they can't be reached. */
function startApproach(world: World, mover: Mover, partner: Mover, field: number[]): boolean {
  const p = tileOf(partner.pos)
  const beside: Tile[] = []
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) if (dx !== 0 || dy !== 0) beside.push({ x: p.x + dx, y: p.y + dy })
  }
  const path = localRoute(world, mover, beside, field, T.chatRange * 3)
  if (!path) return false
  setRoute(world, mover, path)
  mover.destination = null
  mover.idle = { kind: "approach", partnerId: partner.pawnId }
  halt(world, partner)
  partner.idle = { kind: "waitForChat", partnerId: mover.pawnId, hoursLeft: T.chatWaitHours }
  return true
}

/** Both crewmates go back to idling; a chat that had begun is reported as ended. */
function breakUp(world: World, a: Mover, b: Mover | undefined, events: PathingEvent[], interrupted: boolean) {
  const chatHoursLeft = a.idle?.kind === "chat" ? a.idle.hoursLeft : null
  const chatting = chatHoursLeft !== null
  if (chatting && b && b.idle?.kind === "chat" && b.idle.partnerId === a.pawnId) {
    events.push({
      type: "chatEnded",
      pawnIds: [a.pawnId, b.pawnId],
      hours: T.chatHours - Math.max(chatHoursLeft, 0),
      interrupted,
    })
  }
  for (const m of [a, b]) {
    if (!m) continue
    if (chatting) m.chatCooldownHours = T.chatCooldownHours
    if (isFree(m)) {
      m.idle = newPause(world)
      halt(world, m)
    } else {
      m.idle = null
    }
  }
}

const partnerOf = (world: World, mover: Mover) =>
  mover.idle && "partnerId" in mover.idle ? world.movers[mover.idle.partnerId] : undefined

/**
 * A pawn got an order or an urgent need: drop whatever it was doing on its own. A crewmate it
 * was chatting with (or about to) is freed too.
 */
export function endIdle(world: World, mover: Mover, events: PathingEvent[]) {
  if (!mover.idle) return
  const partner = partnerOf(world, mover)
  if (partner) breakUp(world, mover, partner, events, true)
  mover.idle = null
  mover.anchor = null
}

/** One step of idle behaviour for a pawn with no order and no urgent need. */
export function updateIdle(world: World, mover: Mover, hours: number, field: number[], events: PathingEvent[]) {
  mover.chatCooldownHours = Math.max(0, mover.chatCooldownHours - hours)
  if (!mover.idle) {
    mover.anchor = tileOf(mover.pos)
    mover.idle = newPause(world)
  }
  const idle = mover.idle
  const partner = partnerOf(world, mover)
  const walking = mover.path.length > 0

  switch (idle.kind) {
    case "pause": {
      idle.hoursLeft -= hours
      if (idle.hoursLeft > 0 || walking) return
      if (mover.chatCooldownHours <= 0 && random(world) < T.chatChance) {
        const candidate = findChatPartner(world, mover)
        if (candidate && startApproach(world, mover, candidate, field)) return
      }
      if (!startWander(world, mover, field)) mover.idle = newPause(world)
      return
    }
    case "wander":
      if (!walking) mover.idle = newPause(world)
      return
    case "approach": {
      if (!partner || partner.idle?.kind !== "waitForChat" || partner.idle.partnerId !== mover.pawnId) {
        breakUp(world, mover, partner, events, false)
        return
      }
      if (walking) return
      const close = Math.max(Math.abs(partner.pos.x - mover.pos.x), Math.abs(partner.pos.y - mover.pos.y)) <= 1.01
      if (!close) {
        breakUp(world, mover, partner, events, false)
        return
      }
      mover.idle = { kind: "chat", partnerId: partner.pawnId, hoursLeft: T.chatHours }
      partner.idle = { kind: "chat", partnerId: mover.pawnId, hoursLeft: T.chatHours }
      events.push({ type: "chatStarted", pawnIds: [mover.pawnId, partner.pawnId] })
      return
    }
    case "waitForChat":
      idle.hoursLeft -= hours
      if (!partner || partner.idle?.kind !== "approach" || idle.hoursLeft <= 0) breakUp(world, mover, partner, events, false)
      return
    case "chat":
      if (!partner || partner.idle?.kind !== "chat" || partner.idle.partnerId !== mover.pawnId) {
        mover.idle = newPause(world)
        mover.chatCooldownHours = T.chatCooldownHours
        return
      }
      idle.hoursLeft -= hours
      if (idle.hoursLeft <= 0) breakUp(world, mover, partner, events, false)
      return
  }
}
