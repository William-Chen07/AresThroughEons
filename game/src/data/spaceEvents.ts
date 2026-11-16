import type { DonkiWindow } from "@/sim/calendar"

/*
 * Real solar events from NASA's DONKI service (Space Weather Database Of
 * Notifications, Knowledge, Information), for the in-game calendar (see
 * sim/calendar.ts). One window of up to 60 days at a time.
 *
 * The game asks its own /api/space-events first (see game/api/space-events.ts),
 * which holds the NASA key on the server and caches each window. If that isn't
 * there (on a developer's machine before it's deployed, the dev server forwards
 * /api to the live site), it asks NASA directly with the public DEMO_KEY, which
 * only allows a few requests an hour. If both fail the caller falls back to
 * random storms.
 */

/** A DONKI CME row, as much of it as the game reads. */
export interface DonkiCme {
  startTime: string
  cmeAnalyses?: {
    isMostAccurate?: boolean
    speed?: number | null
    enlilList?: { impactList?: { location?: string; arrivalTime?: string }[] | null }[] | null
  }[] | null
}

/** A DONKI SEP row. */
export interface DonkiSep {
  eventTime: string
}

/** A DONKI FLR row. */
export interface DonkiFlr {
  peakTime?: string | null
  classType?: string | null
}

/**
 * Trims DONKI's rows to what the calendar uses. An eruption's speed and Mars arrival times come
 * from NASA's most accurate analysis of it; the arrivals are where NASA's WSA-ENLIL model
 * predicted the eruption would hit Mars.
 */
export function trimDonki(cmes: DonkiCme[], seps: DonkiSep[], flares: DonkiFlr[]): DonkiWindow {
  return {
    eruptions: cmes.map((cme) => {
      const analysis = (cme.cmeAnalyses ?? []).find((a) => a.isMostAccurate) ?? (cme.cmeAnalyses ?? [])[0]
      const arrivals = new Set<string>()
      for (const run of analysis?.enlilList ?? []) {
        for (const impact of run.impactList ?? []) {
          if (impact.arrivalTime && /\bMars\b/.test(impact.location ?? "")) arrivals.add(impact.arrivalTime)
        }
      }
      return { startTime: cme.startTime, speed: analysis?.speed ?? null, marsArrivals: [...arrivals] }
    }),
    particles: seps.map((sep) => ({ eventTime: sep.eventTime })),
    flares: flares.flatMap((flare) =>
      flare.peakTime && flare.classType ? [{ peakTime: flare.peakTime, classType: flare.classType }] : [],
    ),
  }
}

/** Whether a parsed answer looks like a DonkiWindow. */
function isWindow(value: unknown): value is DonkiWindow {
  const window = value as DonkiWindow
  return Array.isArray(window?.eruptions) && Array.isArray(window?.particles) && Array.isArray(window?.flares)
}

async function fromServer(from: string, to: string, signal?: AbortSignal): Promise<DonkiWindow> {
  const answer = await fetch(`/api/space-events?${new URLSearchParams({ from, to })}`, { signal })
  if (!answer.ok) throw new Error(`The game's space events service answered with status ${answer.status}`)
  const window: unknown = await answer.json()
  if (!isWindow(window)) throw new Error("The game's space events service sent something unexpected.")
  return window
}

async function fromNasa(from: string, to: string, signal?: AbortSignal): Promise<DonkiWindow> {
  const ask = async <T>(type: string): Promise<T[]> => {
    const query = new URLSearchParams({ startDate: from, endDate: to, api_key: "DEMO_KEY" })
    const answer = await fetch(`https://api.nasa.gov/DONKI/${type}?${query}`, { signal })
    if (!answer.ok) throw new Error(`NASA DONKI ${type} answered with status ${answer.status}`)
    const rows: unknown = await answer.json()
    // DONKI answers an empty window with nothing at all rather than [].
    return Array.isArray(rows) ? (rows as T[]) : []
  }
  // Flares are news only, and the demo key allows few requests, so they're left out here.
  const [cmes, seps] = await Promise.all([ask<DonkiCme>("CME"), ask<DonkiSep>("SEP")])
  return trimDonki(cmes, seps, [])
}

/** One window of real solar events, and which source answered. Throws if neither did. */
export async function getSpaceEvents(
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<{ window: DonkiWindow; source: "server" | "nasa" }> {
  try {
    return { window: await fromServer(from, to, signal), source: "server" }
  } catch (reason) {
    if (signal?.aborted) throw reason
    return { window: await fromNasa(from, to, signal), source: "nasa" }
  }
}
