import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react"
import { EXPLORE_BASE, EXPLORE_PLACES, explorePlace } from "@/content/explore"
import { exploreEvent } from "@/content/exploreEvents"
import { ResourceIcon } from "@/components/ResourceIcon"
import { RESOURCE_TYPES } from "@/content/resources"
import { leavingAttr, prefersReducedMotion } from "@/lib/motion"
import { exploreBackdrop } from "@/map/exploreBackdrop"
import {
  carryLimit,
  dangerOf,
  describeFinds,
  farness,
  findStars,
  tripFood,
  tripHours,
  tripReach,
  usualFinds,
  type Trip,
  type TripReport,
} from "@/sim/explore"
import { EXPLORE_RULES } from "@/content/explore"

/*
 * The explore map, opened from Explore in the base map's Actions dropdown: the land
 * around the base with places to visit. Click a place, pick who goes and send
 * them; they are away for a while and come back with what they found. Things
 * can happen to them on the way (content/exploreEvents.ts), listed under the trip.
 * The places and the ground are placeholders (see content/explore.ts).
 *
 * Each place shows how far it is, how good its finds are (stars: the further, the better) and
 * how dangerous the trip is. The rare things a far trip can turn up are never named here, on
 * purpose (see EXPLORE_RULES): players find out when the group comes back. Picking a group shows
 * the food it packs from the base and how much it can carry back.
 *
 * The map is shown as a hologram (the fx-holo classes in index.css): it projects in when the
 * map opens, and the sheet of light tilts to face the mouse pointer wherever it is on screen.
 */

/** How far the hologram tilts, in degrees, when the pointer is at the edge of the map or beyond. */
const TILT_DEGREES = 9
/** How quickly the tilt catches up with the pointer, each frame (0 to 1; higher is snappier). */
const TILT_FOLLOW = 0.1

/**
 * Turns the hologram to face the pointer: `stage` (not tilted) is measured, and `map` gets the tilt
 * and the glare's spot as CSS variables (--tilt-x, --tilt-y, --glare-x, --glare-y). Eased every frame
 * so it glides. Off for players who have asked for less motion.
 */
function useTiltTowardPointer(stage: RefObject<HTMLElement | null>, map: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const stageEl = stage.current
    const mapEl = map.current
    if (!stageEl || !mapEl || prefersReducedMotion()) return
    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
    // Where the tilt is heading, and where it is now. x/y are degrees; glare is % across the map.
    const target = { x: 0, y: 0, glareX: 50, glareY: 50 }
    const now = { ...target }
    const onMove = (e: PointerEvent) => {
      const box = stageEl.getBoundingClientRect()
      // -1 to 1 from the middle of the map to its edge (and held at 1 beyond it).
      const across = clamp((e.clientX - (box.left + box.width / 2)) / (box.width / 2), -1, 1)
      const down = clamp((e.clientY - (box.top + box.height / 2)) / (box.height / 2), -1, 1)
      // Facing the pointer: the side nearest it leans away, like a screen turning to look at it.
      target.x = -down * TILT_DEGREES
      target.y = across * TILT_DEGREES
      target.glareX = clamp(((e.clientX - box.left) / box.width) * 100, 0, 100)
      target.glareY = clamp(((e.clientY - box.top) / box.height) * 100, 0, 100)
    }
    // The pointer left the window: settle back flat.
    const onLeave = () => Object.assign(target, { x: 0, y: 0, glareX: 50, glareY: 50 })
    let frame = 0
    const tick = () => {
      for (const key of ["x", "y", "glareX", "glareY"] as const) now[key] += (target[key] - now[key]) * TILT_FOLLOW
      mapEl.style.setProperty("--tilt-x", `${now.x.toFixed(2)}deg`)
      mapEl.style.setProperty("--tilt-y", `${now.y.toFixed(2)}deg`)
      mapEl.style.setProperty("--glare-x", `${now.glareX.toFixed(1)}%`)
      mapEl.style.setProperty("--glare-y", `${now.glareY.toFixed(1)}%`)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    window.addEventListener("pointermove", onMove)
    document.documentElement.addEventListener("pointerleave", onLeave)
    window.addEventListener("blur", onLeave)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("pointermove", onMove)
      document.documentElement.removeEventListener("pointerleave", onLeave)
      window.removeEventListener("blur", onLeave)
    }
  }, [stage, map])
}

/** One astronaut as the explore map needs them. `status` says why they can't be sent, if they can't. */
export interface ExploreCrew {
  id: string
  name: string
  color: string
  /** "unfit": can't go right now (injured, at the radiation limit, asleep...); `note` says why. */
  status: "ready" | "away" | "evacuated" | "unfit"
  note?: string
}

const heading = "holo-text text-[11px] font-semibold uppercase tracking-[0.25em] text-cyan-300/80"
const button =
  "border px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] transition focus-visible:outline-2 focus-visible:outline-cyan-300"

/** The events a trip met, one per line: the name, and for a trip still out what happened as well. */
function EventList({ ids, withText = false }: { ids: string[]; withText?: boolean }) {
  if (ids.length === 0) return null
  return (
    <ul className="mt-1 space-y-1 border-l-2 border-amber-300/60 pl-2">
      {ids.map((id, i) => {
        const event = exploreEvent(id)
        return (
          event && (
            <li key={i}>
              <span className="font-semibold text-amber-200">{event.name}</span>
              {withText && <span className="text-white/60">: {event.text}</span>}
            </li>
          )
        )
      })}
    </ul>
  )
}

/** How far a place is, in words. */
const distanceWord = (far: number) => (far < 1 / 3 ? "Near" : far < 2 / 3 ? "Medium" : "Far")
const dangerLook = { Low: "text-cyan-200", Medium: "text-amber-200", High: "text-orange-300" } as const

/** Rounds a trip's length for showing: "about 9 hours". */
const aboutHours = (hours: number) => `about ${Math.max(1, Math.round(hours))} ${Math.round(hours) <= 1 ? "hour" : "hours"}`

export function ExploreMap({
  crew,
  trips,
  tripLog,
  onSend,
  onClose,
  era,
  foodInStore,
  leaving = false,
}: {
  crew: ExploreCrew[]
  /** The groups out exploring right now. */
  trips: Trip[]
  /** What the last few trips brought back, newest first. */
  tripLog: TripReport[]
  onSend: (placeId: string, crewIds: string[]) => void
  onClose: () => void
  /** The era the expedition is in: later eras make far places' finds better. */
  era: number
  /** How much food the base has, for packing (see tripFood). */
  foodInStore: number
  /** The map has been closed and is playing its closing animation (see lib/motion.ts). */
  leaving?: boolean
}) {
  const backdrop = useMemo(() => exploreBackdrop(), [])
  const stageRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  useTiltTowardPointer(stageRef, mapRef)
  const [placeId, setPlaceId] = useState<string | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const place = placeId ? explorePlace(placeId) : undefined
  // Someone picked a moment ago may have left since (or been evacuated).
  const going = picked.filter((id) => crew.some((member) => member.id === id && member.status === "ready"))
  const nameOf = (id: string) => crew.find((member) => member.id === id)?.name ?? id
  const names = (ids: string[]) => ids.map(nameOf).join(", ")

  return (
    <div
      className="fx-backdrop absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      {...leavingAttr(leaving)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="explore-title"
        className="fx-holo max-h-full w-full max-w-5xl overflow-y-auto border p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
        {...leavingAttr(leaving)}
      >
        <span aria-hidden className="fx-holo-corners" />
        <div className="flex items-center justify-between gap-4">
          <h2 id="explore-title" className="fx-holo-title text-lg font-semibold uppercase tracking-[0.25em]">
            Explore
          </h2>
          <button type="button" onClick={onClose} className={`${button} border-cyan-300/25 hover:border-cyan-300/80 hover:bg-cyan-400/15`}>
            Close
          </button>
        </div>

        <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,1fr)_17rem]">
          {/* The map, as a hologram that tilts to face the pointer: the base in the middle, places around
              it, and groups on their way. */}
          <div ref={stageRef} className="fx-holo-stage">
          <div ref={mapRef} className="fx-holo-map relative aspect-[16/10] w-full overflow-hidden border">
            <div aria-hidden className="fx-holo-ground" style={{ backgroundImage: `url(${backdrop})` }} />
            <svg aria-hidden className="absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {EXPLORE_PLACES.map((spot) => {
                const busy = trips.some((trip) => trip.placeId === spot.id)
                const shown = busy || spot.id === placeId
                return (
                  shown && (
                    <line
                      key={spot.id}
                      x1={EXPLORE_BASE.x}
                      y1={EXPLORE_BASE.y}
                      x2={spot.x}
                      y2={spot.y}
                      strokeWidth={2}
                      strokeDasharray="6 5"
                      vectorEffect="non-scaling-stroke"
                      className={busy ? "stroke-amber-300" : "stroke-cyan-200/80"}
                    />
                  )
                )
              })}
            </svg>

            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
              style={{ left: `${EXPLORE_BASE.x}%`, top: `${EXPLORE_BASE.y}%` }}
            >
              <span className="mx-auto block size-4 border-2 border-black/70 bg-orange-400 shadow-[0_0_12px_rgb(251_146_60/0.9)]" />
              <span className="mt-1 block border border-orange-300/50 bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-100">
                Base
              </span>
            </div>

            {EXPLORE_PLACES.map((spot, i) => {
              const selected = spot.id === placeId
              return (
                <button
                  key={spot.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setPlaceId(spot.id)}
                  className="fx-holo-pin group absolute -translate-x-1/2 -translate-y-1/2 text-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
                  style={{ left: `${spot.x}%`, top: `${spot.y}%`, "--i": i } as CSSProperties}
                >
                  <span
                    className={`mx-auto block size-3.5 rotate-45 border-2 border-black/70 transition ${selected ? "bg-amber-300 shadow-[0_0_12px_rgb(252_211_77/0.9)]" : "bg-cyan-200 shadow-[0_0_10px_rgb(103_232_249/0.8)] group-hover:bg-white"}`}
                  />
                  <span
                    className={`mt-1.5 block border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] transition ${selected ? "border-amber-300/70 bg-black/80 text-amber-100" : "border-cyan-300/30 bg-black/70 text-cyan-50 group-hover:border-cyan-200/80"}`}
                  >
                    {spot.name}
                  </span>
                </button>
              )
            })}

            {/* Each group out exploring: a dot per astronaut, part of the way along the line. */}
            {trips.map((trip) => {
              const spot = explorePlace(trip.placeId)
              if (!spot) return null
              const reach = tripReach(trip)
              return (
                <div
                  key={trip.id}
                  className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 gap-0.5 transition-[left,top] duration-1000 ease-linear"
                  style={{
                    left: `${EXPLORE_BASE.x + (spot.x - EXPLORE_BASE.x) * reach}%`,
                    top: `${EXPLORE_BASE.y + (spot.y - EXPLORE_BASE.y) * reach}%`,
                  }}
                >
                  {trip.crew.map((id) => (
                    <span
                      key={id}
                      className="size-3 rounded-full border-2 border-black/70"
                      style={{ background: crew.find((member) => member.id === id)?.color }}
                    />
                  ))}
                </div>
              )
            })}

            {/* Scanlines and the glare of the light, over everything (they don't catch clicks). */}
            <div aria-hidden className="fx-holo-scan" />
            <div aria-hidden className="fx-holo-glare" />
          </div>
          </div>

          <div className="flex flex-col gap-5 text-sm">
            {place ? (
              <section aria-live="polite">
                <h3 className="fx-holo-title text-sm font-semibold uppercase tracking-[0.2em]">{place.name}</h3>
                <p className="mt-2 text-white/70">{place.text}</p>
                <p className="mt-2 text-xs text-white/55">
                  The trip there and back takes {aboutHours(tripHours(place))}. Might bring back:{" "}
                  {place.finds.map((find, i) => {
                    const type = RESOURCE_TYPES.find((t) => t.id === find.resource)
                    if (!type) return null
                    return (
                      <span key={find.resource} className="inline-flex items-center gap-1 align-middle">
                        {i > 0 && ", "}
                        <ResourceIcon id={type.id} color={type.color} className="size-3.5" />
                        {type.name.toLowerCase()}
                      </span>
                    )
                  })}
                  . Each astronaut can carry {EXPLORE_RULES.carryPerAstronaut} back, so a bigger group brings more, but it
                  packs more food.
                </p>

                {/* How far, how good the finds are, how dangerous. Never which rare finds. */}
                {(() => {
                  const stars = findStars(place, era)
                  const danger = dangerOf(place)
                  return (
                    // Side by side, like the group's numbers below, so the panel stays short.
                    <div
                      title="The further the trip, the better the finds, and the more likely someone gets hurt."
                      className="mt-3 border border-cyan-300/15 bg-cyan-300/5 px-2 py-1.5 text-xs"
                    >
                      <dl className="grid grid-cols-3 gap-1 text-center">
                        <div className="flex flex-col">
                          <dt className="text-[10px] uppercase tracking-[0.1em] text-white/50">Distance</dt>
                          <dd className="font-semibold">{distanceWord(farness(place))}</dd>
                        </div>
                        <div className="flex flex-col">
                          <dt className="text-[10px] uppercase tracking-[0.1em] text-white/50">Finds</dt>
                          <dd aria-label={`${stars} out of 4 stars`}>
                            <span aria-hidden className="tracking-[0.1em] text-amber-300 [text-shadow:0_0_6px_rgb(252_211_77/0.6)]">
                              {"★".repeat(stars)}
                              <span className="text-white/25">{"★".repeat(4 - stars)}</span>
                            </span>
                          </dd>
                        </div>
                        <div className="flex flex-col">
                          <dt className="text-[10px] uppercase tracking-[0.1em] text-white/50">Danger</dt>
                          <dd className={`font-semibold ${dangerLook[danger]}`}>{danger}</dd>
                        </div>
                      </dl>
                      <p className="mt-1 text-[11px] text-white/50">Further: better finds, but more danger.</p>
                    </div>
                  )
                })()}

                <p className={`${heading} mt-4`}>Who goes?</p>
                <ul className="mt-2 grid gap-1.5">
                  {crew.map((member) => {
                    const chosen = going.includes(member.id)
                    return (
                      <li key={member.id}>
                        <button
                          type="button"
                          aria-pressed={chosen}
                          disabled={member.status !== "ready"}
                          onClick={() =>
                            setPicked(chosen ? going.filter((id) => id !== member.id) : [...going, member.id])
                          }
                          className={`flex w-full items-center gap-2 border px-3 py-1.5 text-left text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-cyan-300 disabled:pointer-events-none disabled:opacity-40 ${chosen ? "border-amber-300/80 bg-amber-400/20 text-amber-50" : "border-cyan-300/25 bg-cyan-300/5 hover:border-cyan-300/80 hover:bg-cyan-400/15"}`}
                        >
                          <span className="size-2.5 shrink-0 rounded-full" style={{ background: member.color }} />
                          {member.name}
                          <span className="ml-auto text-[10px] uppercase tracking-[0.15em] text-white/50">
                            {member.status === "away"
                              ? "Exploring"
                              : member.status === "evacuated"
                                ? "Evacuated"
                                : member.status === "unfit"
                                  ? member.note
                                  : ""}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
                {/* The group: what it can do and what it costs, and what one more astronaut would add,
                    so the point of sending more people is plain to see. */}
                {(() => {
                  const n = going.length
                  const more = n + 1
                  const canAddMore = crew.some((member) => member.status === "ready" && !going.includes(member.id))
                  const food = tripFood(place, n)
                  const short = n > 0 && food > foodInStore
                  // One column each, side by side: a short label, the group's number, and under it what one
                  // more astronaut adds. `about` is the full wording, for hovering and screen readers.
                  const stats: { label: string; about: string; now: string; plus: number; cost?: boolean }[] = [
                    { label: "Carry", about: `Can carry back up to ${carryLimit(n)}`, now: `${carryLimit(n)}`, plus: carryLimit(more) - carryLimit(n) },
                    { label: "Brings", about: `Usually brings about ${usualFinds(place, n)}`, now: `~${usualFinds(place, n)}`, plus: usualFinds(place, more) - usualFinds(place, n) },
                    // Every astronaut gets their own try at something rare, but only away from the base.
                    ...(farness(place) > 0 ? [{ label: "Rare tries", about: `${n} tries at a rare find`, now: `${n}`, plus: 1 }] : []),
                    { label: "Food", about: `Packs ${food} food from the base`, now: `${food}`, plus: tripFood(place, more) - food, cost: true },
                  ]
                  return (
                    <div className="mt-2 border border-cyan-300/15 bg-cyan-300/5 px-2 py-1.5 text-xs">
                      <p className="flex items-baseline justify-between gap-2">
                        <span className={heading}>{n === 0 ? "Nobody picked yet" : `Group of ${n}`}</span>
                        {canAddMore && <span className="text-[10px] text-white/45">+ one more</span>}
                      </p>
                      <dl className="mt-1 grid gap-1 text-center" style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
                        {stats.map((stat) => (
                          <div key={stat.label} title={stat.about} className="flex flex-col">
                            <dt className="text-[10px] uppercase tracking-[0.1em] text-white/50">{stat.label}</dt>
                            <dd
                              aria-label={stat.about}
                              className={`text-sm font-semibold tabular-nums ${stat.cost && short ? "text-orange-300" : "text-white/90"}`}
                            >
                              {stat.now}
                            </dd>
                            <dd
                              aria-hidden
                              className={`h-4 text-[11px] tabular-nums ${stat.cost ? "text-amber-200/80" : "holo-text text-cyan-200"}`}
                            >
                              {canAddMore && stat.plus > 0 ? `+${stat.plus}` : ""}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      <p className="mt-1 text-[11px] text-white/50">
                        {short ? (
                          <span className="text-orange-300">Not enough food at the base ({Math.floor(foodInStore)}).</span>
                        ) : (
                          `${Math.floor(foodInStore)} food at the base. More people carry more, but eat more.`
                        )}
                      </p>
                    </div>
                  )
                })()}
                <button
                  type="button"
                  disabled={going.length === 0 || tripFood(place, going.length) > foodInStore}
                  onClick={() => {
                    onSend(place.id, going)
                    setPicked([])
                  }}
                  className={`${button} mt-3 w-full border-cyan-300/80 bg-cyan-400/15 hover:bg-cyan-400/30 disabled:pointer-events-none disabled:border-cyan-300/25 disabled:bg-transparent disabled:text-white/35`}
                >
                  Send
                </button>
              </section>
            ) : (
              <p className="text-white/70">
                Pick a place on the map, then choose who to send. They will be away for a while and come back with what
                they find.
              </p>
            )}

            {trips.length > 0 && (
              <section>
                <h3 className={heading}>Out exploring</h3>
                <ul className="mt-2 space-y-1.5 text-xs text-white/70">
                  {trips.map((trip) => (
                    <li key={trip.id}>
                      <span className="text-white/90">{names(trip.crew)}</span>: {explorePlace(trip.placeId)?.name},{" "}
                      {trip.waitHours > 0 ? "held up, then back in" : "back in"}{" "}
                      {aboutHours(trip.hoursLeft + trip.waitHours)}.
                      <EventList ids={trip.events} withText />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {tripLog.length > 0 && (
              <section>
                <h3 className={heading}>Brought back</h3>
                <ul className="mt-2 space-y-1.5 text-xs text-white/70">
                  {tripLog.map((report) => (
                    <li key={report.id}>
                      <span className="text-white/90">{explorePlace(report.placeId)?.name}</span>:{" "}
                      {describeFinds(report.finds)} ({names(report.crew)}).
                      <EventList ids={report.events} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
