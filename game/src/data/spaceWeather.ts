/*
 * Live space weather from NASA's DONKI service (Space Weather Database Of
 * Notifications, Knowledge, Information). The game doesn't call NASA
 * directly: it asks its own /api/space-weather (see game/api/space-weather.ts),
 * which holds the API key on the server.
 */

export interface SpaceWeatherAlert {
  /** DONKI's short code for the kind of event, e.g. "FLR" or "CME". */
  type: string
  /** When NASA issued the alert (ISO date and time, UTC). */
  issued: string
  /** NASA's page for the alert. */
  url: string
  /** True if NASA predicts the event will reach Mars. */
  towardMars: boolean
  summary: string
}

export interface SpaceWeather {
  fetchedAt: string
  /** How many days back the alerts go. */
  daysBack: number
  usingProjectKey: boolean
  /** Newest first. */
  alerts: SpaceWeatherAlert[]
}

/** Plain names for DONKI's event codes. */
const ALERT_NAMES: Record<string, string> = {
  FLR: "Solar flare",
  CME: "Solar eruption",
  SEP: "Solar particle storm",
  GST: "Magnetic storm",
  IPS: "Shock wave in space",
  RBE: "Radiation belt alert",
  MPC: "Magnetic shield squeeze",
  HSS: "Fast solar wind",
  Report: "Weekly space weather report",
}

export function alertName(type: string) {
  return ALERT_NAMES[type] ?? "Space weather alert"
}

export async function getSpaceWeather(signal?: AbortSignal): Promise<SpaceWeather> {
  const answer = await fetch("/api/space-weather", { signal })
  if (!answer.ok) throw new Error(`Space weather service answered with status ${answer.status}`)
  return (await answer.json()) as SpaceWeather
}
