import { useState } from "react"
import { MainMenu } from "@/components/menu/MainMenu"

type Screen = "menu" | "game"

function App() {
  const [screen, setScreen] = useState<Screen>("menu")

  if (screen === "menu") {
    // TODO(game): onStart receives "new" or "continue"; use it to start fresh or load the saved era.
    return <MainMenu onStart={() => setScreen("game")} />
  }

  // Placeholder until the game scene exists.
  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-6 bg-background text-foreground">
      <p className="font-heading text-2xl">Game coming soon</p>
      <button
        type="button"
        onClick={() => setScreen("menu")}
        className="rounded-3xl border-2 border-white/15 px-6 py-3 font-heading text-lg font-semibold hover:border-primary"
      >
        Back to menu
      </button>
    </main>
  )
}

export default App
