import { HOURS_PER_DAY, type Calendar } from "@/sim/calendar"

/*
 * Day and night on the base map, as pure logic. Every calendar day (see sim/calendar.ts) starts
 * at sunrise: it is light for DAYLIGHT_HOURS, then night until the next day starts. The crew only
 * want to sleep at night (see decideActivity in sim/step.ts), and the map goes dark (see
 * components/GameMap.tsx). These are game numbers to tune: a real Mars day is about as long as
 * an Earth day, half light and half dark.
 */

/** Hours of daylight at the start of each day. The rest of the day is night. */
export const DAYLIGHT_HOURS = 16
/** How long the light takes to fade at dusk and to come back before sunrise, in game-hours. */
export const TWILIGHT_HOURS = 1.5

/** Hours since sunrise at this moment on the expedition's clock, from 0 up to HOURS_PER_DAY. */
export const hourOfDay = (calendar: Pick<Calendar, "startHours">, clock: number) =>
  Math.max(0, clock - calendar.startHours) % HOURS_PER_DAY

/** Night has fallen: the crew can go to bed. */
export const isNight = (hour: number) => hour >= DAYLIGHT_HOURS

/**
 * How dark it is, from 0 (full daylight) to 1 (the middle of the night). It fades in over the
 * last TWILIGHT_HOURS of daylight, so it is fully dark as night starts, and fades out over the
 * last TWILIGHT_HOURS of the night, so the new day starts light.
 */
export function darkness(hour: number): number {
  const dusk = (hour - (DAYLIGHT_HOURS - TWILIGHT_HOURS)) / TWILIGHT_HOURS
  const dawn = (HOURS_PER_DAY - hour) / TWILIGHT_HOURS
  return Math.min(1, Math.max(0, Math.min(dusk, dawn)))
}
