/*
 * A Vercel serverless function: GET /api/space-events?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Real solar events for the in-game calendar (see src/sim/calendar.ts): it asks
 * NASA's DONKI service (through api.nasa.gov) for the solar eruptions (CME),
 * particle storms (SEP) and flares (FLR) between two dates, at most 60 days
 * apart (DONKI's own limit), and hands the game only what it uses. The answer
 * has the same shape as trimDonki in src/data/spaceEvents.ts; keep the two in step.
 *
 * Like /api/space-weather it runs on Vercel's servers so the NASA key stays
 * secret: NASA_API_KEY in the project's environment variables, or NASA's public
 * DEMO_KEY without one. History doesn't change, so a window that loaded fully
 * is cached at Vercel's edge for a long time and costs NASA one request per
 * event type, however many players ask for it.
 *
 * On a developer's machine the Vite dev server forwards /api calls to the
 * deployed site (see vite.config.ts), so this only answers there once deployed.
 * Until then the game asks NASA directly (see src/data/spaceEvents.ts).
 */

interface DonkiCme {
  startTime: string
  cmeAnalyses?: {
    isMostAccurate?: boolean
    speed?: number | null
    enlilList?: { impactList?: { location?: string; arrivalTime?: string }[] | null }[] | null
  }[] | null
}

interface DonkiSep {
  eventTime: string
}

interface DonkiFlr {
  peakTime?: string | null
  classType?: string | null
}

const MAX_DAYS = 60
const FIRST_DAY = "2010-01-01"
const DAY_MS = 24 * 60 * 60 * 1000
const isDay = (text: string | null): text is string => text !== null && /^\d{4}-\d{2}-\d{2}$/.test(text)

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams
  const from = params.get("from")
  const to = params.get("to")
  if (!isDay(from) || !isDay(to) || from < FIRST_DAY || to < from) {
    return Response.json({ error: "Give from and to as YYYY-MM-DD, from 2010-01-01 on." }, { status: 400 })
  }
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS + 1
  if (days > MAX_DAYS) return Response.json({ error: `At most ${MAX_DAYS} days at a time.` }, { status: 400 })

  const key = process.env.NASA_API_KEY ?? process.env.NASA_KEY ?? process.env.VITE_NASA_API_KEY ?? "DEMO_KEY"
  const ask = async <T>(type: string): Promise<T[]> => {
    const query = new URLSearchParams({ startDate: from, endDate: to, api_key: key })
    const answer = await fetch(`https://api.nasa.gov/DONKI/${type}?${query}`)
    if (!answer.ok) throw new Error(`NASA DONKI ${type} answered with status ${answer.status}`)
    const rows: unknown = await answer.json()
    // DONKI answers an empty window with nothing at all rather than [].
    return Array.isArray(rows) ? (rows as T[]) : []
  }

  const [cmes, seps, flares] = await Promise.allSettled([ask<DonkiCme>("CME"), ask<DonkiSep>("SEP"), ask<DonkiFlr>("FLR")])
  // Eruptions and particle storms are needed; flares are news only, and NASA's flare feed is
  // sometimes down, so the window still counts without them.
  if (cmes.status === "rejected" || seps.status === "rejected") {
    const reason = cmes.status === "rejected" ? cmes.reason : seps.status === "rejected" ? seps.reason : null
    return Response.json({ error: reason instanceof Error ? reason.message : String(reason) }, { status: 502 })
  }

  const window = {
    eruptions: cmes.value.map((cme) => {
      const analysis = (cme.cmeAnalyses ?? []).find((a) => a.isMostAccurate) ?? (cme.cmeAnalyses ?? [])[0]
      const arrivals = new Set<string>()
      for (const run of analysis?.enlilList ?? []) {
        for (const impact of run.impactList ?? []) {
          if (impact.arrivalTime && /\bMars\b/.test(impact.location ?? "")) arrivals.add(impact.arrivalTime)
        }
      }
      return { startTime: cme.startTime, speed: analysis?.speed ?? null, marsArrivals: [...arrivals] }
    }),
    particles: seps.value.map((sep) => ({ eventTime: sep.eventTime })),
    flares:
      flares.status === "fulfilled"
        ? flares.value.flatMap((flare) =>
            flare.peakTime && flare.classType ? [{ peakTime: flare.peakTime, classType: flare.classType }] : [],
          )
        : [],
  }

  // A window that's well in the past and loaded in full won't change: keep it for 30 days. One
  // missing its flares, or too recent for NASA's analyses to have settled, is kept for an hour.
  const settled = Date.parse(`${to}T00:00:00Z`) < Date.now() - 30 * DAY_MS && flares.status === "fulfilled"
  const cache = settled
    ? "public, s-maxage=2592000, stale-while-revalidate=2592000"
    : "public, s-maxage=3600, stale-while-revalidate=86400"
  return Response.json(window, { headers: { "Cache-Control": cache } })
}
