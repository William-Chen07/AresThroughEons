import { useState, type CSSProperties } from "react"
import { Backpack as BackpackIcon } from "lucide-react"
import { ResourceIcon } from "@/components/ResourceIcon"
import { leavingAttr, usePresence } from "@/lib/motion"
import { MINED_RESOURCES, type ResourceId, type Resources } from "@/content/resources"

/*
 * The backpack, bottom right of the base map: the raw materials the crew have
 * dug out of Mars (regolith and minerals, see content/resources.ts), kept out of
 * the resource bar along the top. The button opens a small list above it, one
 * row per material: its picture, then how much there is. Resting the pointer
 * on a picture (or moving to it with the Tab key, or tapping it) shows the
 * material's name. Like the resource bar, the name is opened from code rather
 * than a CSS hover rule, so a tap works on a touch screen too.
 */
export function Backpack({ resources }: { resources: Resources }) {
  const [open, setOpen] = useState(false)
  // Stays a moment after closing, for its closing animation (index.css).
  const shown = usePresence(open, 180)
  /** The material whose name is showing. */
  const [namedId, setNamedId] = useState<ResourceId | null>(null)
  const unname = (id: ResourceId) => setNamedId((current) => (current === id ? null : current))

  return (
    <div className="pointer-events-auto flex flex-col items-end gap-2">
      {shown.mounted && (
        <ul
          id="backpack-contents"
          aria-label="Backpack"
          {...leavingAttr(shown.leaving)}
          className="fx-backpack holo-frame flex flex-col gap-1.5 border border-cyan-300/25 holo-surface px-3 py-2 text-white backdrop-blur-sm"
        >
          {MINED_RESOURCES.map((type, i) => (
            <li key={type.id} style={{ "--i": i } as CSSProperties} className="fx-backpack-item flex items-center gap-2 text-sm font-semibold tabular-nums">
              <span
                tabIndex={0}
                role="img"
                aria-label={type.name}
                onPointerEnter={() => setNamedId(type.id)}
                onPointerLeave={() => unname(type.id)}
                onFocus={() => setNamedId(type.id)}
                onBlur={() => unname(type.id)}
                className="relative flex cursor-help focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
              >
                <ResourceIcon id={type.id} color={type.color} className="size-5" />
                {/* The name hangs to the left of the picture, so it stays on screen. */}
                <span
                  role="tooltip"
                  className={`pointer-events-none absolute top-1/2 right-full z-20 mr-2 -translate-y-1/2 border border-cyan-300/25 holo-surface px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] whitespace-nowrap text-cyan-100 ${namedId === type.id ? "" : "hidden"}`}
                >
                  {type.name}
                </span>
              </span>
              <span aria-hidden className="text-white/40">
                –
              </span>
              <span>{Math.floor(resources[type.id])}</span>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        aria-label={open ? "Close backpack" : "Open backpack"}
        title="Backpack"
        aria-expanded={open}
        aria-controls="backpack-contents"
        onClick={() => setOpen((o) => !o)}
        className={`flex size-11 items-center justify-center border backdrop-blur-sm transition focus-visible:outline-2 focus-visible:outline-cyan-300 ${
          open
            ? "border-cyan-300/80 bg-cyan-950/85 text-cyan-50 shadow-[0_0_14px_rgb(103_232_249/0.35)]"
            : "border-cyan-300/25 holo-surface text-white/80 hover:border-cyan-300/80 hover:bg-cyan-950/85 hover:text-cyan-100"
        }`}
      >
        <BackpackIcon aria-hidden className={`size-5 ${open ? "fx-wiggle" : ""}`} strokeWidth={2.25} />
      </button>
    </div>
  )
}
