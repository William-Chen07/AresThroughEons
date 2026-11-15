import { useState } from "react"
import { GameMap } from "@/components/GameMap"
import { MainMenu } from "@/components/MainMenu"
import { devSiteOverride } from "@/map/marsSite"
import { useSaves } from "@/sim/saves"

type Screen = "menu" | "game"

function App() {
  const [screen, setScreen] = useState<Screen>("menu")
  // The save the player picked in the menu (see sim/saves.ts).
  const save = useSaves((s) => (s.activeSlot === null ? null : s.slots[s.activeSlot]))
  const activeSlot = useSaves((s) => s.activeSlot)
  const markLanded = useSaves((s) => s.markLanded)
  const setBase = useSaves((s) => s.setBase)

  if (screen === "menu") {
    return <MainMenu onStart={() => setScreen("game")} />
  }

  // The base map for the save's landing site. Transitions into it come later.
  if (save) {
    return (
      <GameMap
        name={save.name}
        site={devSiteOverride() ?? save.site}
        landed={save.landed}
        onLanded={() => activeSlot !== null && markLanded(activeSlot)}
        modules={save.modules}
        tubes={save.tubes}
        onBaseChange={(base) => activeSlot !== null && setBase(activeSlot, base)}
        onExit={() => setScreen("menu")}
      />
    )
  }

  // Only reachable if the active save is deleted while the game is open.
  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-6 bg-[#020104] text-white">
      <p className="text-sm uppercase tracking-[0.3em] text-white/60">No expedition selected</p>
      <button
        type="button"
        onClick={() => setScreen("menu")}
        className="border border-white/15 px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] hover:border-orange-400/70"
      >
        Back to menu
      </button>
    </main>
  )
}

export default App
