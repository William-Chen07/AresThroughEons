import { useEffect, useRef } from "react"
import { getSpaceEvents } from "@/data/spaceEvents"
import { needsMoreDays, nextWindow, toSpaceEvents } from "@/sim/calendar"
import { savesStore, useSaves } from "@/sim/saves"

/*
 * Keeps the active expedition's calendar stocked with real NASA events (see
 * sim/calendar.ts): when less than LOOKAHEAD_HOURS of loaded days are left, it
 * fetches the next window. Each window is tried once per session; if that fails
 * the save is marked so storms come at random, and the next session tries again.
 */
export function useSpaceCalendar(index: number | null, enabled: boolean) {
  const calendar = useSaves((s) => (index === null ? null : (s.slots[index]?.calendar ?? null)))
  const hours = useSaves((s) => (index === null ? 0 : (s.slots[index]?.hours ?? 0)))
  const wanted = calendar && needsMoreDays(calendar, hours) ? nextWindow(calendar) : null
  const key = calendar && wanted ? `${calendar.start}:${wanted.from}` : null
  /** Windows already asked for this session, so a failure isn't retried every frame. */
  const tried = useRef(new Set<string>())

  useEffect(() => {
    if (!enabled || index === null || key === null || tried.current.has(key)) return
    tried.current.add(key)
    const current = savesStore.getState().slots[index]?.calendar
    if (!current) return
    const window = nextWindow(current)
    // Not cancelled when the screen changes: the answer is still worth keeping, and the store
    // ignores it if the era has moved on since (see addSpaceEvents).
    getSpaceEvents(window.from, window.to).then(
      ({ window: rows, source }) => {
        savesStore.getState().addSpaceEvents(index, current.start, toSpaceEvents(current, rows), window.endHours, source)
      },
      () => savesStore.getState().markCalendarFailed(index, current.start),
    )
  }, [enabled, index, key])
}
