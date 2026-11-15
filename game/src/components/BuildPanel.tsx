import { MODULE_TYPES, type ModuleTypeId } from "@/content/modules"

/*
 * A panel for building the base by hand while the real building rules don't
 * exist yet: place modules, lay the tubes between them, and remove either.
 * Nothing connects by itself (see sim/base.ts). Shown as "Dev tools", opened
 * from the Dev tools button or the ` key on the base map. It can also start
 * and stop a radiation storm, for trying the weather out, and reset the map.
 */

export type BuildTool = { kind: "place"; type: ModuleTypeId } | { kind: "tube" } | { kind: "remove" } | null

const toolButton =
  "flex w-full items-center justify-between gap-3 border px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-[0.2em] transition focus-visible:outline-2 focus-visible:outline-orange-400"
const idle = "border-white/15 bg-white/5 hover:border-orange-400/70 hover:bg-orange-500/15"
const active = "border-orange-400/70 bg-orange-500/25 text-orange-100"

export function BuildPanel({
  tool,
  onTool,
  tubeStarted,
  moduleCount,
  tubeCells,
  groupCount,
  message,
  stormActive,
  onStorm,
  onResetMap,
  onNextEra,
  onClear,
  onClose,
}: {
  tool: BuildTool
  /** Picking the tool that is already active turns it off. */
  onTool: (tool: BuildTool) => void
  /** True once the tube tool's first click has picked where a run starts. */
  tubeStarted: boolean
  moduleCount: number
  /** How many cells of tube the base has. */
  tubeCells: number
  /** How many separate groups of joined modules there are. One means every module is connected. */
  groupCount: number
  /** What the last click did, or why it did nothing. */
  message: string | null
  /** True while a radiation storm is going on. */
  stormActive: boolean
  /** Starts a radiation storm, or ends the one going on. */
  onStorm: () => void
  /** Starts the expedition over at the same landing site, as if opened for the first time: the landing replays. */
  onResetMap: () => void
  /** Ends this era and starts the next on the same map (the base wears down and a new lander comes down). */
  onNextEra: () => void
  onClear: () => void
  onClose: () => void
}) {
  const hint =
    tool?.kind === "place"
      ? "Click the map to place it. Green means it fits."
      : tool?.kind === "tube"
        ? tubeStarted
          ? "Click where the run ends. Tubes run straight, along a row or a column."
          : "Click the block where a run of tube starts."
        : tool?.kind === "remove"
          ? "Click a module or a block of tube to remove it."
          : "Pick a module or a tool, then click the map."

  return (
    <section
      aria-label="Dev tools"
      className="pointer-events-auto w-64 border border-white/15 bg-neutral-950/85 p-4 backdrop-blur-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-300/90">Dev tools</h2>
        <button
          type="button"
          aria-label="Close dev tools"
          onClick={onClose}
          className="border border-white/15 px-2 py-0.5 text-xs transition hover:border-orange-400/70 focus-visible:outline-2 focus-visible:outline-orange-400"
        >
          ✕
        </button>
      </div>

      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/50">Place a module</p>
      <ul className="mt-2 grid gap-1.5">
        {MODULE_TYPES.map((type) => {
          const selected = tool?.kind === "place" && tool.type === type.id
          return (
            <li key={type.id}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onTool(selected ? null : { kind: "place", type: type.id })}
                className={`${toolButton} ${selected ? active : idle}`}
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="size-3 shrink-0 border border-black/60"
                    style={{ backgroundColor: `#${type.color.toString(16).padStart(6, "0")}` }}
                  />
                  {type.name}
                </span>
                <span className="font-normal tracking-normal text-white/45">
                  {type.width}×{type.height}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/50">Tubes</p>
      <button
        type="button"
        aria-pressed={tool?.kind === "tube"}
        onClick={() => onTool(tool?.kind === "tube" ? null : { kind: "tube" })}
        className={`${toolButton} mt-2 ${tool?.kind === "tube" ? active : idle}`}
      >
        Lay tubes
      </button>

      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <button
          type="button"
          aria-pressed={tool?.kind === "remove"}
          onClick={() => onTool(tool?.kind === "remove" ? null : { kind: "remove" })}
          className={`${toolButton} justify-center ${tool?.kind === "remove" ? active : idle}`}
        >
          Remove
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={moduleCount === 0 && tubeCells === 0}
          className={`${toolButton} justify-center border-white/15 bg-white/5 hover:border-red-400/70 hover:text-red-300 disabled:pointer-events-none disabled:opacity-40`}
        >
          Clear all
        </button>
      </div>

      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/50">Weather</p>
      <button
        type="button"
        aria-pressed={stormActive}
        onClick={onStorm}
        className={`${toolButton} mt-2 ${stormActive ? active : idle}`}
      >
        {stormActive ? "End radiation storm" : "Radiation storm"}
      </button>

      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/50">Expedition</p>
      <button
        type="button"
        onClick={onResetMap}
        className={`${toolButton} mt-2 border-white/15 bg-white/5 hover:border-red-400/70 hover:text-red-300`}
      >
        Reset map
      </button>
      <button
        type="button"
        onClick={onNextEra}
        className={`${toolButton} mt-2 border-white/15 bg-white/5 hover:border-orange-400/70`}
      >
        Next era
      </button>

      <p className="mt-3 text-[11px] text-white/60">{hint}</p>
      <p className="mt-1 min-h-8 text-[11px] text-orange-200/90" aria-live="polite">
        {message}
      </p>
      <p className="mt-1 border-t border-white/10 pt-2 text-[11px] text-white/45">
        {moduleCount} {moduleCount === 1 ? "module" : "modules"}, {tubeCells} {tubeCells === 1 ? "block" : "blocks"} of
        tube.{" "}
        {moduleCount > 1 &&
          (groupCount === 1 ? "Every module is joined. " : `${groupCount} separate groups: lay tubes to join them. `)}
        Esc drops the tool. The ` key hides this panel.
      </p>
    </section>
  )
}
