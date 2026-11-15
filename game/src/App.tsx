import { useState } from "react"
import { MainMenu } from "@/components/MainMenu"
import { useSaves } from "@/sim/saves"

type Screen = "menu" | "game"

function App() {
  const [screen, setScreen] = useState<Screen>("menu")
  // The save the player picked in the menu (see sim/saves.ts).
  const save = useSaves((s) => (s.activeSlot === null ? null : s.slots[s.activeSlot]))

  if (screen === "menu") {
    return <MainMenu onStart={() => setScreen("game")} />
  }

  // Placeholder until the game scene exists.
  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-6 bg-[#020104] text-white">
      <p className="text-sm uppercase tracking-[0.3em] text-white/60">Game coming soon</p>
      {save && <p className="text-xs uppercase tracking-[0.25em] text-white/40">Expedition: {save.name}</p>}
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
