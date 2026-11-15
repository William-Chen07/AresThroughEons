import { useState } from "react"
import { MainMenu } from "@/components/MainMenu"
import { CrewPanel } from "@/components/CrewPanel"

type Screen = "menu" | "game"

function App() {
  const [screen, setScreen] = useState<Screen>("menu")

  if (screen === "menu") {
    return <MainMenu onStart={() => setScreen("game")} />
  }

  // Crew panel stands in until the Pixi game scene exists.
  return (
    <main className="min-h-dvh bg-[#020104] text-white">
      <button
        type="button"
        onClick={() => setScreen("menu")}
        className="m-4 mb-0 border border-white/15 px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] hover:border-orange-400/70"
      >
        Back to menu
      </button>
      <CrewPanel />
    </main>
  )
}

export default App
