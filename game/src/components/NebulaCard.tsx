import { useEffect } from "react"
import { SOUND_CREDIT, type Nebula } from "@/content/nebulae"

/*
 * A nebula's card: its Hubble picture, what it is, a short NASA fact and the credits. Shown when
 * the player clicks a Sonification Station that has a "!" (see GameMap.tsx), and again in the
 * Mars Codex once found (see MenuDialogs.tsx). The look copies MenuDialogs.
 */

const linkClass = "text-orange-300 underline underline-offset-2"

/** The card itself. `compact` is the smaller version for the Codex list. */
export function NebulaCardBody({ nebula, compact = false }: { nebula: Nebula; compact?: boolean }) {
  const src = `${import.meta.env.BASE_URL}${nebula.image}`
  return (
    <article className={compact ? "flex gap-4" : ""}>
      <img
        src={src}
        alt={`Hubble picture of ${nebula.name}`}
        className={
          compact
            ? "size-24 shrink-0 border border-white/10 object-cover"
            : "max-h-[46vh] w-full border border-white/10 bg-black object-contain"
        }
      />
      <div className={compact ? "min-w-0" : "mt-4"}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/50">{nebula.kind}</p>
        <h3 className={`font-semibold uppercase tracking-[0.2em] text-orange-300 ${compact ? "text-sm" : "mt-1 text-lg"}`}>
          {nebula.name}
        </h3>
        <p className="mt-2 text-sm text-white/75">{nebula.text}</p>
        <p className="mt-2 text-[11px] text-white/45">
          Image: {nebula.imageCredit}.{" "}
          <a href={nebula.source.url} target="_blank" rel="noreferrer" className={linkClass}>
            Source
          </a>
          {" · "}
          {SOUND_CREDIT}.{" "}
          <a href={nebula.sonification.url} target="_blank" rel="noreferrer" className={linkClass}>
            Listen
          </a>
        </p>
      </div>
    </article>
  )
}

/**
 * The card as a pop-up over the base map. `isNew` says it has just been added to the Codex.
 * Esc, the Close button or a click outside closes it.
 */
export function NebulaDialog({ nebula, isNew, onClose }: { nebula: Nebula; isNew: boolean; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="nebula-card-title"
        className="max-h-full w-full max-w-xl overflow-y-auto border border-white/15 bg-neutral-950/95 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="nebula-card-title" className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
          Sonification Station · Now playing
        </h2>
        <p className="mt-1 text-sm text-white/70">
          The music you're hearing is this picture from space, turned into sound.
        </p>
        <div className="mt-4">
          <NebulaCardBody nebula={nebula} />
        </div>
        <p className={`mt-4 text-xs font-semibold uppercase tracking-[0.2em] ${isNew ? "text-amber-300" : "text-white/45"}`}>
          {isNew ? "New! Added to your Mars Codex." : "Already in your Mars Codex."}
        </p>
        <button
          type="button"
          autoFocus
          onClick={onClose}
          className="mt-4 border border-white/15 px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] transition hover:border-orange-400/70"
        >
          Close
        </button>
      </div>
    </div>
  )
}
