import { useEffect, useState, type FormEvent } from "react"
import { SAVE_NAME_MAX, defaultSaveName, useSaves, type SaveSlot } from "@/sim/saves"

/*
 * The save menu that "Begin Expedition" opens: three slots to continue, start
 * or delete. It copies the look of MainMenu on purpose: the panel is the
 * Credits dialog and the slots are the menu buttons.
 */

const focusClass = "focus-visible:outline-2 focus-visible:outline-orange-400"
const labelClass = "text-sm font-semibold uppercase tracking-[0.25em]"
const noteClass = "mt-1 block text-[11px] text-white/40"
const slotButtonClass = `group relative min-w-0 border border-white/15 bg-white/5 px-6 py-3 text-left backdrop-blur-sm transition hover:border-orange-400/70 hover:bg-orange-500/15 ${focusClass}`
const smallButtonClass = `border border-white/15 px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] transition hover:border-orange-400/70 ${focusClass}`
const dangerButtonClass = `border border-red-400/40 px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-red-300 transition hover:border-red-400 hover:bg-red-500/15 ${focusClass}`

/** The orange bar that appears on the left edge of a hovered menu button. */
function HoverBar() {
  return <span className="absolute inset-y-0 left-0 w-0.5 bg-orange-400 opacity-0 transition group-hover:opacity-100" />
}

function playedNote(slot: SaveSlot) {
  const date = new Date(slot.lastPlayedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
  return `Last played ${date}`
}

function NewSaveForm({ index, onCreate, onCancel }: { index: number; onCreate: (name: string) => void; onCancel: () => void }) {
  const [name, setName] = useState("")
  const inputId = `save-name-${index}`
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onCreate(name)
  }
  // The slot doesn't change: a text box just sits over the "New expedition" label.
  // Its negative margins cancel its padding, so the letters stay exactly where the label's were.
  return (
    <form
      onSubmit={submit}
      className="block w-full border border-dashed border-white/15 bg-white/5 px-6 py-3 backdrop-blur-sm"
      onBlur={(e) => {
        // Leaving the box without typing anything puts the slot back as it was.
        if (!name.trim() && !e.currentTarget.contains(e.relatedTarget)) onCancel()
      }}
    >
      <input
        id={inputId}
        aria-label="Expedition name"
        autoFocus
        autoComplete="off"
        spellCheck={false}
        maxLength={SAVE_NAME_MAX}
        placeholder={defaultSaveName(index)}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Escape") return
          // Escape backs out of naming; it shouldn't also close the whole menu.
          e.stopPropagation()
          onCancel()
        }}
        className={`${labelClass} -mx-2 -my-1 block w-[calc(100%+1rem)] border border-orange-400/70 bg-black/50 px-[calc(0.5rem-1px)] py-[calc(0.25rem-1px)] caret-orange-400 outline-none placeholder:text-white/30`}
      />
      <span className={noteClass}>Empty slot</span>
    </form>
  )
}

function DeleteConfirm({ slot, onDelete, onCancel }: { slot: SaveSlot; onDelete: () => void; onCancel: () => void }) {
  return (
    <div role="group" aria-label={`Delete ${slot.name}?`} className="border border-red-400/40 bg-red-500/10 px-6 py-4">
      <p className={`${labelClass} truncate`}>Delete {slot.name}?</p>
      <p className={noteClass}>This expedition will be gone for good.</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" autoFocus onClick={onCancel} className={smallButtonClass}>
          Keep
        </button>
        <button type="button" onClick={onDelete} className={dangerButtonClass}>
          Delete
        </button>
      </div>
    </div>
  )
}

export function SaveSelect({ onStart, onClose }: { onStart: () => void; onClose: () => void }) {
  const slots = useSaves((s) => s.slots)
  const createSave = useSaves((s) => s.createSave)
  const loadSave = useSaves((s) => s.loadSave)
  const deleteSave = useSaves((s) => s.deleteSave)
  // Only one slot at a time shows its name form or its delete question.
  const [asking, setAsking] = useState<{ index: number; about: "name" | "delete" } | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="saves-title"
        className="max-h-full w-full max-w-lg overflow-y-auto border border-white/15 bg-neutral-950/90 p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="saves-title" className="text-lg font-semibold uppercase tracking-[0.25em]">
          Expeditions
        </h2>
        <p className="mt-4 text-sm text-white/70">Continue an expedition, or begin a new one.</p>

        <ul className="mt-5 flex flex-col gap-3">
          {slots.map((slot, index) => {
            const about = asking?.index === index ? asking.about : null
            if (!slot) {
              return (
                <li key={index}>
                  {about === "name" ? (
                    <NewSaveForm
                      index={index}
                      onCancel={() => setAsking(null)}
                      onCreate={(name) => {
                        createSave(index, name)
                        onStart()
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      autoFocus={index === 0}
                      onClick={() => setAsking({ index, about: "name" })}
                      className={`${slotButtonClass} w-full border-dashed`}
                    >
                      <HoverBar />
                      <span className={`${labelClass} block`}>New expedition</span>
                      <span className={noteClass}>Empty slot</span>
                    </button>
                  )}
                </li>
              )
            }
            return (
              <li key={index}>
                {about === "delete" ? (
                  <DeleteConfirm
                    slot={slot}
                    onCancel={() => setAsking(null)}
                    onDelete={() => {
                      deleteSave(index)
                      setAsking(null)
                    }}
                  />
                ) : (
                  <div className="flex gap-3">
                    <button
                      type="button"
                      autoFocus={index === 0}
                      aria-label={`Continue ${slot.name}. ${playedNote(slot)}`}
                      onClick={() => {
                        loadSave(index)
                        onStart()
                      }}
                      className={`${slotButtonClass} flex-1`}
                    >
                      <HoverBar />
                      <span className={`${labelClass} block truncate`}>{slot.name}</span>
                      <span className={noteClass}>{playedNote(slot)}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${slot.name}`}
                      onClick={() => setAsking({ index, about: "delete" })}
                      className={`${smallButtonClass} px-4 text-white/60 hover:border-red-400/70 hover:text-red-300`}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>

        <button type="button" onClick={onClose} className={`${smallButtonClass} mt-6`}>
          Close
        </button>
      </div>
    </div>
  )
}
