import { useEffect, useState } from "react"

/*
 * Opening and closing animations for panels and dialogs. The animations themselves are CSS, in
 * index.css (the classes starting "fx-"). A panel plays its opening animation when it appears; for
 * the closing one it has to stay on screen a moment after it is closed, which usePresence does.
 * Players who have asked their device for less motion get no animations at all.
 */

/** Whether the player has asked their device for less motion (then nothing animates or tilts). */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
}

/**
 * Keeps something on screen for `exitMs` after `open` turns false, so its closing animation can play.
 * `mounted`: render it. `leaving`: it's closing (put `data-leaving` on it, which starts the animation).
 */
export function usePresence(open: boolean, exitMs: number) {
  const [lingering, setLingering] = useState(false)
  const [wasOpen, setWasOpen] = useState(open)
  // Just closed: stay a moment longer. Opened again meanwhile: no longer closing.
  if (open !== wasOpen) {
    setWasOpen(open)
    setLingering(!open)
  }
  useEffect(() => {
    if (!lingering) return
    const timer = window.setTimeout(() => setLingering(false), prefersReducedMotion() ? 0 : exitMs)
    return () => window.clearTimeout(timer)
  }, [lingering, exitMs])
  return { mounted: open || lingering, leaving: !open && lingering }
}

/** `data-leaving` for an element that is closing (see usePresence), or nothing. */
export const leavingAttr = (leaving: boolean) => (leaving ? { "data-leaving": "" } : {})
