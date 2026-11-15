import { useEffect, useState } from "react"
import { alertName, getSpaceWeather, type SpaceWeather } from "@/data/spaceWeather"

/*
 * A small readout of this week's real space weather alerts, live from NASA's
 * DONKI service. On Mars, solar eruptions matter: there is no magnetic field
 * or thick air to stop their radiation.
 */

type State = { status: "loading" } | { status: "ready"; weather: SpaceWeather } | { status: "error" }

const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })

export function SpaceWeatherPanel() {
  const [state, setState] = useState<State>({ status: "loading" })

  useEffect(() => {
    const abort = new AbortController()
    getSpaceWeather(abort.signal).then(
      (weather) => setState({ status: "ready", weather }),
      () => {
        if (!abort.signal.aborted) setState({ status: "error" })
      },
    )
    return () => abort.abort()
  }, [])

  const alerts = state.status === "ready" ? state.weather.alerts : []
  // An event on its way to Mars is the headline; otherwise the newest alert is.
  const headline = alerts.find((alert) => alert.towardMars) ?? alerts[0]

  return (
    <section
      aria-label="Space weather"
      className="pointer-events-auto w-64 border border-white/15 bg-neutral-950/80 px-4 py-3 text-right backdrop-blur-sm"
    >
      <h2 className="text-xs font-medium uppercase tracking-[0.3em] text-orange-300/80">Space weather</h2>
      {state.status === "loading" && <p className="mt-1 text-[11px] text-white/50">Checking with NASA…</p>}
      {state.status === "error" && (
        <p className="mt-1 text-[11px] text-white/50">No signal from NASA’s space weather service right now.</p>
      )}
      {state.status === "ready" && (
        <>
          <p className="mt-1 text-sm">
            {alerts.length === 0
              ? "All quiet"
              : `${alerts.length} ${alerts.length === 1 ? "alert" : "alerts"} in the last ${state.weather.daysBack} days`}
          </p>
          {headline && (
            <p className="mt-1 text-[11px] text-white/70">
              {headline.towardMars ? (
                <span className="text-orange-200">{alertName(headline.type)} heading for Mars</span>
              ) : (
                <>Latest: {alertName(headline.type)}</>
              )}
              , {shortDate(headline.issued)}.{" "}
              <a
                href={headline.url}
                target="_blank"
                rel="noreferrer"
                className="text-orange-300 underline underline-offset-2"
              >
                Read the alert
              </a>
            </p>
          )}
          <p className="mt-1 text-[11px] text-white/40">Live from NASA DONKI.</p>
        </>
      )}
    </section>
  )
}
