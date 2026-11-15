/*
 * A Vercel serverless function: GET /api/space-weather
 *
 * It asks NASA's DONKI service (through api.nasa.gov) for the last week of
 * space weather alerts and hands the game a short summary of each.
 *
 * It runs on Vercel's servers, not in the player's browser, because the NASA
 * API key must stay secret. The key is read from the project's environment
 * variables on Vercel (Project → Settings → Environment Variables), under the
 * name NASA_API_KEY. Without one it falls back to NASA's public DEMO_KEY,
 * which works but is limited to a few dozen requests an hour.
 *
 * On a developer's machine the Vite dev server forwards /api calls to the
 * deployed site (see vite.config.ts), so edits to this file only show up
 * locally after they are deployed.
 */

interface DonkiNotification {
  messageType: string
  messageIssueTime: string
  messageURL: string
  messageBody: string
}

const DAY_MS = 24 * 60 * 60 * 1000
const DAYS_BACK = 7
const SUMMARY_MAX = 260

const ymd = (date: Date) => date.toISOString().slice(0, 10)

/** The first paragraph after the "## Summary:" heading of an alert, on one line. */
function summaryOf(body: string) {
  const text = (body.split("## Summary:")[1] ?? "").trim().split(/\n\s*\n/)[0] ?? ""
  const oneLine = text.replace(/\s+/g, " ").trim()
  return oneLine.length > SUMMARY_MAX ? `${oneLine.slice(0, SUMMARY_MAX - 1)}…` : oneLine
}

export async function GET(): Promise<Response> {
  const projectKey = process.env.NASA_API_KEY ?? process.env.NASA_KEY ?? process.env.VITE_NASA_API_KEY
  const now = new Date()
  const query = new URLSearchParams({
    startDate: ymd(new Date(now.getTime() - DAYS_BACK * DAY_MS)),
    endDate: ymd(now),
    type: "all",
    api_key: projectKey ?? "DEMO_KEY",
  })

  try {
    const answer = await fetch(`https://api.nasa.gov/DONKI/notifications?${query}`)
    if (!answer.ok) throw new Error(`NASA DONKI answered with status ${answer.status}`)
    const notifications = (await answer.json()) as DonkiNotification[]

    const alerts = notifications
      .map((item) => ({
        type: item.messageType,
        issued: item.messageIssueTime,
        url: item.messageURL,
        // The alert's "Message Type" line lists what the event is predicted to reach, e.g. "CME (STEREO A, Mars)".
        towardMars: /## Message Type:[^\n]*\bMars\b/.test(item.messageBody),
        summary: summaryOf(item.messageBody),
      }))
      .sort((a, b) => b.issued.localeCompare(a.issued))

    return Response.json(
      {
        fetchedAt: now.toISOString(),
        daysBack: DAYS_BACK,
        // Lets the team check the Vercel key is being picked up, without revealing it.
        usingProjectKey: projectKey !== undefined,
        alerts,
      },
      // Vercel's edge keeps the answer for 30 minutes, so many players cost one NASA request.
      { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=86400" } },
    )
  } catch (reason) {
    return Response.json({ error: reason instanceof Error ? reason.message : String(reason) }, { status: 502 })
  }
}
