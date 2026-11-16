import { useId, useState, type ReactNode } from "react"
import { STATUSES, TRAITS, type StatusId, type TraitId } from "@/sim"
import { statusEffects } from "@/sim/statusInfo"
import { traitDislikes, traitEffects } from "@/sim/traitInfo"

/*
 * A crewmate's traits and statuses as small chips. Each opens a card saying what it is and what
 * it does, in plain words (sim/traitInfo.ts, sim/statusInfo.ts). Used on the crew screen and in
 * the crew list on the base map.
 *
 * A card opens when the pointer rests on its chip, when the chip has keyboard focus, or when it's
 * tapped (and closes on a tap elsewhere), so it works on a touch screen too, like the resource
 * bar's cards. It hangs under the chips' row: put the chips in an element with `position: relative`
 * (Tailwind `relative`). By default the card is as wide as that element, so it never runs off
 * screen; `cardClass` can place it differently.
 */

/** The look of a chip: closed, and open (showing its card). */
interface ChipLook {
  closed: string
  open: string
}

function InfoChip({
  label,
  look,
  cardClass = "inset-x-0",
  children,
}: {
  label: string
  look: ChipLook
  /** Where the card sits across, e.g. "left-0 w-64". It always hangs below the row. */
  cardClass?: string
  /** What the card says. */
  children: ReactNode
}) {
  const cardId = useId()
  // Open while pointed at, or while focused (a tap focuses it, so a tap keeps it open).
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const open = hovered || focused
  return (
    <>
      <span
        tabIndex={0}
        role="button"
        aria-expanded={open}
        aria-describedby={cardId}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => e.key === "Escape" && e.currentTarget.blur()}
        className={`cursor-help border px-1.5 text-[10px] whitespace-nowrap transition focus-visible:outline-2 focus-visible:outline-cyan-300 ${open ? look.open : look.closed}`}
      >
        {label}
      </span>
      <div
        id={cardId}
        role="tooltip"
        className={`holo-surface holo-frame pointer-events-none absolute top-full z-30 mt-1 border border-cyan-300/30 p-3 text-left text-[11px] leading-snug font-normal normal-case tracking-normal ${cardClass} ${open ? "" : "hidden"}`}
      >
        {children}
      </div>
    </>
  )
}

/** The effects list on a card, or a note when there are none. */
function Effects({ lines, none }: { lines: string[]; none: string }) {
  if (lines.length === 0) return <p className="mt-2 text-white/50">{none}</p>
  return (
    <ul className="mt-2 space-y-0.5">
      {lines.map((line) => (
        <li key={line} className="flex gap-1.5 text-cyan-100">
          <span aria-hidden className="text-cyan-300">
            ▸
          </span>
          {line}
        </li>
      ))}
    </ul>
  )
}

const TRAIT_LOOK: ChipLook = {
  closed: "border-sky-400/30 text-sky-200 hover:border-cyan-300/80",
  open: "border-cyan-300/80 bg-cyan-400/15 text-cyan-50",
}

/** A trait: its description, its effects, and who the crewmate doesn't get along with. */
export function TraitChip({ id, cardClass }: { id: TraitId; cardClass?: string }) {
  const trait = TRAITS[id]
  const dislikes = traitDislikes(trait)
  return (
    <InfoChip label={trait.name} look={TRAIT_LOOK} cardClass={cardClass}>
      <p className="holo-title text-xs font-semibold uppercase tracking-[0.2em]">{trait.name}</p>
      <p className="mt-1 text-white/85">{trait.description}</p>
      <Effects lines={traitEffects(trait)} none="No extra effects yet." />
      {dislikes && (
        <p className="mt-2 border-t border-cyan-300/15 pt-2 text-amber-100/90">
          Doesn't get along with{" "}
          {dislikes === "everyone" ? "anyone" : <span className="font-semibold">{dislikes.join(", ")}</span>}. Being with
          them makes this crewmate less happy.
        </p>
      )}
    </InfoChip>
  )
}

/** A status: what's happening, what it does, and how to fix it. Serious ones look red. */
export function StatusChip({ id, cardClass }: { id: StatusId; cardClass?: string }) {
  const status = STATUSES[id]
  const serious = status.severity === "serious"
  const look: ChipLook = serious
    ? { closed: "border-red-400/50 text-red-200 hover:border-red-300", open: "border-red-300 bg-red-500/20 text-red-50" }
    : { closed: "border-amber-400/40 text-amber-200 hover:border-amber-300", open: "border-amber-300 bg-amber-400/20 text-amber-50" }
  return (
    <InfoChip label={status.label} look={look} cardClass={cardClass}>
      <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${serious ? "text-red-200" : "text-amber-200"}`}>
        {status.label}
        {serious && <span className="ml-2 text-[10px] tracking-[0.15em] text-red-300/80">Serious</span>}
      </p>
      <p className="mt-1 text-white/85">{status.description}</p>
      <Effects lines={statusEffects(status)} none="No other effects." />
      <p className="mt-2 border-t border-cyan-300/15 pt-2 text-emerald-100/90">
        <span className="font-semibold">How to fix it: </span>
        {status.fix}
      </p>
    </InfoChip>
  )
}
