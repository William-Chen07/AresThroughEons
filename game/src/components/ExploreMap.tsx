import { useMemo, useState } from "react"
import { EXPLORE_BASE, EXPLORE_PLACES, explorePlace } from "@/content/explore"
import { exploreEvent } from "@/content/exploreEvents"
import { ResourceIcon } from "@/components/ResourceIcon"
import { RESOURCE_TYPES } from "@/content/resources"
import { exploreBackdrop } from "@/map/exploreBackdrop"
import { describeFinds, tripHours, tripReach, type Trip, type TripReport } from "@/sim/explore"

/*
 * The explore map, opened from the Explore button on the base map: the land
 * around the base with places to visit. Click a place, pick who goes and send
 * them; they are away for a while and come back with what they found. Things
 * can happen to them on the way (content/exploreEvents.ts), listed under the trip.
 * The places and the ground are placeholders (see content/explore.ts).
 * The look copies MenuDialogs.
 */

/** One astronaut as the explore map needs them. `status` says why they can't be sent, if they can't. */
export interface ExploreCrew {
  id: string
  name: string
  color: string
  /** "unfit": can't go right now (injured, at the radiation limit, asleep...); `note` says why. */
  status: "ready" | "away" | "evacuated" | "unfit"
  note?: string
}

const heading = "text-[11px] font-semibold uppercase tracking-[0.25em] text-white/50"
const button =
  "border px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] transition focus-visible:outline-2 focus-visible:outline-orange-400"

/** The events a trip met, one per line: the name, and for a trip still out what happened as well. */
function EventList({ ids, withText = false }: { ids: string[]; withText?: boolean }) {
  if (ids.length === 0) return null
  return (
    <ul className="mt-1 space-y-1 border-l-2 border-orange-400/60 pl-2">
      {ids.map((id, i) => {
        const event = exploreEvent(id)
        return (
          event && (
            <li key={i}>
              <span className="font-semibold text-orange-200">{event.name}</span>
              {withText && <span className="text-white/60">: {event.text}</span>}
            </li>
          )
        )
      })}
    </ul>
  )
}

/** Rounds a trip's length for showing: "about 9 hours". */
const aboutHours = (hours: number) => `about ${Math.max(1, Math.round(hours))} ${Math.round(hours) <= 1 ? "hour" : "hours"}`

export function ExploreMap({
  crew,
  trips,
  tripLog,
  onSend,
  onClose,
}: {
  crew: ExploreCrew[]
  /** The groups out exploring right now. */
  trips: Trip[]
  /** What the last few trips brought back, newest first. */
  tripLog: TripReport[]
  onSend: (placeId: string, crewIds: string[]) => void
  onClose: () => void
}) {
  const backdrop = useMemo(() => exploreBackdrop(), [])
  const [placeId, setPlaceId] = useState<string | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const place = placeId ? explorePlace(placeId) : undefined
  // Someone picked a moment ago may have left since (or been evacuated).
  const going = picked.filter((id) => crew.some((member) => member.id === id && member.status === "ready"))
  const nameOf = (id: string) => crew.find((member) => member.id === id)?.name ?? id
  const names = (ids: string[]) => ids.map(nameOf).join(", ")

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="explore-title"
        className="max-h-full w-full max-w-5xl overflow-y-auto border border-white/15 bg-neutral-950/90 p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4">
          <h2 id="explore-title" className="text-lg font-semibold uppercase tracking-[0.25em]">
            Explore
          </h2>
          <button type="button" onClick={onClose} className={`${button} border-white/15 hover:border-orange-400/70`}>
            Close
          </button>
        </div>

        <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,1fr)_17rem]">
          {/* The map: the base in the middle, places around it, and groups on their way. */}
          <div
            className="relative aspect-[16/10] w-full overflow-hidden border border-white/15"
            style={{ backgroundImage: `url(${backdrop})`, backgroundSize: "100% 100%", imageRendering: "pixelated" }}
          >
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
                      className={busy ? "stroke-orange-300" : "stroke-white/70"}
                    />
                  )
                )
              })}
            </svg>

            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
              style={{ left: `${EXPLORE_BASE.x}%`, top: `${EXPLORE_BASE.y}%` }}
            >
              <span className="mx-auto block size-4 border-2 border-black/70 bg-orange-400" />
              <span className="mt-1 block bg-neutral-950/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em]">
                Base
              </span>
            </div>

            {EXPLORE_PLACES.map((spot) => {
              const selected = spot.id === placeId
              return (
                <button
                  key={spot.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setPlaceId(spot.id)}
                  className="group absolute -translate-x-1/2 -translate-y-1/2 text-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400"
                  style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
                >
                  <span
                    className={`mx-auto block size-3.5 rotate-45 border-2 border-black/70 transition ${selected ? "bg-orange-400" : "bg-white group-hover:bg-orange-200"}`}
                  />
                  <span
                    className={`mt-1.5 block border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] transition ${selected ? "border-orange-400/70 bg-neutral-950/90 text-orange-100" : "border-transparent bg-neutral-950/80 text-white/90 group-hover:border-white/40"}`}
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
          </div>

          <div className="flex flex-col gap-5 text-sm">
            {place ? (
              <section aria-live="polite">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-300">{place.name}</h3>
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
                  . Each astronaut carries a share, so a bigger group brings more.
                </p>

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
                          className={`flex w-full items-center gap-2 border px-3 py-1.5 text-left text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-orange-400 disabled:pointer-events-none disabled:opacity-40 ${chosen ? "border-orange-400/70 bg-orange-500/25 text-orange-100" : "border-white/15 bg-white/5 hover:border-orange-400/70"}`}
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
                <button
                  type="button"
                  disabled={going.length === 0}
                  onClick={() => {
                    onSend(place.id, going)
                    setPicked([])
                  }}
                  className={`${button} mt-3 w-full border-orange-400/70 bg-orange-500/15 hover:bg-orange-500/30 disabled:pointer-events-none disabled:border-white/15 disabled:bg-transparent disabled:text-white/35`}
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
