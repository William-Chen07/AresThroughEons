import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { Footprints } from "lucide-react"
import { ResourceIcon } from "@/components/ResourceIcon"
import { RESOURCE_TYPES } from "@/content/resources"
import type { MineralId } from "@/sim/deposits"
import type { MiningChoice } from "@/sim/tasks"

/*
 * An astronaut's task list, opened by clicking them on the base map. The top shows what they're
 * doing now and what's lined up after it. Below are the tasks they can be given: moving somewhere
 * (pick Move, then click the spot), and mining the nearest deposit, or the nearest deposit of one
 * mineral. A click replaces what they're doing; a shift-click adds the task to the end of their
 * list. Esc, or a click anywhere else, closes it.
 */

const mineral = (id: MineralId) => RESOURCE_TYPES.find((type) => type.id === id)!

export function TaskMenu({
  name,
  color,
  position,
  now,
  next,
  mining,
  onMove,
  onMine,
  onStop,
  onClose,
}: {
  name: string
  /** The astronaut's suit colour. */
  color: string
  /** Where the right-click was, in pixels from the map's top left. The menu opens there and stays on screen. */
  position: { x: number; y: number }
  /** What they're doing now, in a few words. */
  now: string
  /** What they'll do after that, in order. */
  next: string[]
  /** The nearest deposit of each mineral, nearest first. */
  mining: MiningChoice[]
  /** Move: the next click on the map is where they go. */
  onMove: () => void
  /** Send them to mine: one mineral, or null for the nearest deposit. `queue` adds it to the end of their list. */
  onMine: (mineral: MineralId | null, queue: boolean) => void
  /** Stop them and clear their list. */
  onStop: () => void
  /** Closed with Esc, or by a click outside the menu. */
  onClose: (how: "outside" | "escape") => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState(position)

  // Open at the click, but moved in so the whole menu stays on screen.
  useLayoutEffect(() => {
    const menu = ref.current
    const parent = menu?.offsetParent as HTMLElement | null
    if (!menu || !parent) return
    const margin = 8
    setPlace({
      x: Math.max(margin, Math.min(position.x, parent.clientWidth - menu.offsetWidth - margin)),
      y: Math.max(margin, Math.min(position.y, parent.clientHeight - menu.offsetHeight - margin)),
    })
  }, [position, mining.length, next.length])

  // Esc or a click outside closes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose("escape")
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose("outside")
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("pointerdown", onDown, true)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("pointerdown", onDown, true)
    }
  }, [onClose])

  // Focus the first task, so the keyboard can be used straight away.
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus()
  }, [])

  const item =
    "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition outline-hidden hover:bg-cyan-400/25 hover:text-cyan-100 focus-visible:bg-cyan-400/25 focus-visible:text-cyan-100 disabled:pointer-events-none disabled:text-white/35"

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={`${name}'s tasks`}
      className="fx-menu holo-surface holo-frame pointer-events-auto absolute z-30 w-64 border border-cyan-300/25 py-1 text-white backdrop-blur-sm" data-open=""
      style={{ left: place.x, top: place.y }}
    >
      <div className="border-b border-cyan-300/15 px-3 pt-1.5 pb-2">
        <p className="holo-title flex items-center gap-2 text-xs font-semibold">
          <span className="size-2 rounded-full" style={{ background: color }} />
          {name}
        </p>
        <ol className="mt-1.5 flex flex-col gap-0.5 text-[11px] text-white/70" aria-label="Task list">
          <li>
            <span className="text-white/40">Now:</span> {now}
          </li>
          {next.map((task, i) => (
            <li key={i}>
              <span className="text-white/40">{i === 0 ? "Next:" : "Then:"}</span> {task}
            </li>
          ))}
        </ol>
      </div>

      <button type="button" role="menuitem" className={`${item} mt-1`} onClick={onMove}>
        <Footprints aria-hidden className="size-3.5 text-white/70" />
        <span className="flex-1">Move</span>
        <span className="text-[11px] text-white/45">then click where</span>
      </button>

      <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.25em] holo-text text-cyan-300/90">Mine</p>
      {mining.length === 0 ? (
        <button type="button" role="menuitem" disabled className={item}>
          No deposits left to mine
        </button>
      ) : (
        <>
          <button type="button" role="menuitem" className={item} onClick={(e) => onMine(null, e.shiftKey)}>
            <span className="flex-1">Nearest deposit</span>
            <span className="text-[11px] text-white/45">{mineral(mining[0].mineral).name}</span>
          </button>
          {mining.map((choice) => {
            const type = mineral(choice.mineral)
            return (
              <button
                key={choice.depositId}
                type="button"
                role="menuitem"
                className={item}
                onClick={(e) => onMine(choice.mineral, e.shiftKey)}
              >
                <ResourceIcon id={type.id} color={type.color} className="size-3.5" />
                <span className="flex-1">{type.name}</span>
                <span className="text-[11px] tabular-nums text-white/45">{Math.ceil(choice.amount)} left</span>
              </button>
            )
          })}
        </>
      )}

      <div className="my-1 h-px bg-cyan-300/25" />
      <button type="button" role="menuitem" className={item} onClick={onStop} disabled={now === "Nothing" && next.length === 0}>
        Stop and clear the list
      </button>
      <p className="px-3 pt-1 pb-1.5 text-[10px] leading-snug text-white/40">Shift-click a task to add it to the end of the list.</p>
    </div>
  )
}
