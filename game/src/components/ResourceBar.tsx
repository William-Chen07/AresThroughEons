import { RESOURCE_TYPES, type Resources } from "@/content/resources"

/*
 * The base's resources in one row along the top of the base map, left of the
 * Back to menu button. It only shows the amounts kept in the save; nothing
 * makes or uses resources yet. The look copies the other map panels.
 */
export function ResourceBar({ resources }: { resources: Resources }) {
  return (
    <ul
      aria-label="Resources"
      className="pointer-events-auto flex flex-wrap items-center justify-end gap-x-4 gap-y-1 border border-white/15 bg-neutral-950/80 px-4 py-2 backdrop-blur-sm"
    >
      {RESOURCE_TYPES.map((type) => (
        <li key={type.id} title={type.about} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2.5 shrink-0 border border-black/60"
            style={{ backgroundColor: `#${type.color.toString(16).padStart(6, "0")}` }}
          />
          <span className="text-xs font-semibold uppercase tracking-[0.15em] text-white/50">{type.name}</span>
          <span className="text-xs font-semibold tabular-nums">{Math.round(resources[type.id])}</span>
        </li>
      ))}
    </ul>
  )
}
