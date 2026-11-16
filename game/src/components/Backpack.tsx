import { useState } from "react"
import { Backpack as BackpackIcon } from "lucide-react"
import { ResourceIcon } from "@/components/ResourceIcon"
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
  /** The material whose name is showing. */
  const [namedId, setNamedId] = useState<ResourceId | null>(null)
  const unname = (id: ResourceId) => setNamedId((current) => (current === id ? null : current))

  return (
    <div className="pointer-events-auto flex flex-col items-end gap-2">
      {open && (
        <ul
          id="backpack-contents"
          aria-label="Backpack"
          className="flex flex-col gap-1.5 border border-white/15 bg-neutral-950/80 px-3 py-2 text-white backdrop-blur-sm"
        >
          {MINED_RESOURCES.map((type) => (
            <li key={type.id} className="flex items-center gap-2 text-sm font-semibold tabular-nums">
              <span
                tabIndex={0}
                role="img"
                aria-label={type.name}
                onPointerEnter={() => setNamedId(type.id)}
                onPointerLeave={() => unname(type.id)}
                onFocus={() => setNamedId(type.id)}
                onBlur={() => unname(type.id)}
                className="relative flex cursor-help focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
              >
                <ResourceIcon id={type.id} color={type.color} className="size-5" />
                {/* The name hangs to the left of the picture, so it stays on screen. */}
                <span
                  role="tooltip"
                  className={`pointer-events-none absolute top-1/2 right-full z-20 mr-2 -translate-y-1/2 border border-white/15 bg-neutral-950/95 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] whitespace-nowrap text-orange-200 ${namedId === type.id ? "" : "hidden"}`}
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
        className={`flex size-11 items-center justify-center border backdrop-blur-sm transition focus-visible:outline-2 focus-visible:outline-orange-400 ${
          open
            ? "border-orange-400/70 bg-orange-950/85 text-orange-100"
            : "border-white/15 bg-neutral-950/80 text-white/80 hover:border-orange-400/70 hover:bg-orange-950/85 hover:text-orange-100"
        }`}
      >
        <BackpackIcon aria-hidden className="size-5" strokeWidth={2.25} />
      </button>
    </div>
  )
}
