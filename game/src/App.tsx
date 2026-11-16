import { useState } from "react"
import { CrewPanel } from "@/components/CrewPanel"
import { GameMap } from "@/components/GameMap"
import { MainMenu } from "@/components/MainMenu"
import { devSiteOverride } from "@/map/marsSite"
import { useSaves } from "@/sim/saves"

type Screen = "menu" | "game"

function App() {
  const [screen, setScreen] = useState<Screen>("menu")
  const [showCrew, setShowCrew] = useState(false)
  // Goes up when the map is reset from the Build panel or a new era starts. It is the map screen's
  // key, so the screen is thrown away and built again from the changed save, landing and all.
  const [mapResets, setMapResets] = useState(0)
  // The save the player picked in the menu (see sim/saves.ts).
  const save = useSaves((s) => (s.activeSlot === null ? null : s.slots[s.activeSlot]))
  const activeSlot = useSaves((s) => s.activeSlot)
  const markLanded = useSaves((s) => s.markLanded)
  const setBase = useSaves((s) => s.setBase)
  const research = useSaves((s) => s.research)
  const passTime = useSaves((s) => s.passTime)
  const setWeather = useSaves((s) => s.setWeather)
  const resetMap = useSaves((s) => s.resetMap)
  const sendExploring = useSaves((s) => s.sendExploring)
  const nextEra = useSaves((s) => s.nextEra)
  const setCrewRole = useSaves((s) => s.setCrewRole)

  if (screen === "menu") {
    return <MainMenu onStart={() => setScreen("game")} />
  }

  // The base map for the save's landing site. Transitions into it come later.
  if (save) {
    return (
      <>
        <GameMap
          key={mapResets}
          name={save.name}
          site={devSiteOverride() ?? save.site}
          landed={save.landed}
          onLanded={() => activeSlot !== null && markLanded(activeSlot)}
          modules={save.modules}
          tubes={save.tubes}
          onBaseChange={(base) => activeSlot !== null && setBase(activeSlot, base)}
          researched={save.researched}
          resources={save.resources}
          crew={save.crew}
          crewLog={save.crewLog}
          evacuated={save.evacuated}
          trips={save.trips}
          tripLog={save.tripLog}
          tripNews={save.tripNews}
          onSendExploring={(placeId, crewIds) => activeSlot !== null && sendExploring(activeSlot, placeId, crewIds)}
          weather={save.weather}
          onWeather={(id) => activeSlot !== null && setWeather(activeSlot, id)}
          onResetMap={() => {
            if (activeSlot === null) return
            resetMap(activeSlot)
            setMapResets((count) => count + 1)
          }}
          era={save.era}
          landers={save.landers}
          onNextEra={() => {
            if (activeSlot === null) return
            nextEra(activeSlot)
            setMapResets((count) => count + 1)
          }}
          onTimePassed={(hours, crew) => activeSlot !== null && passTime(activeSlot, hours, crew)}
          onResearch={(projectId) => activeSlot !== null && research(activeSlot, projectId)}
          onExit={() => setScreen("menu")}
        />

        {/* The crew system's details for this save (sim/crewLife.ts). Sits above the map credits button. */}
        <button
          type="button"
          onClick={() => setShowCrew((v) => !v)}
          className="fixed bottom-20 right-4 z-40 sm:bottom-24 sm:right-6 border border-white/15 bg-black/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white backdrop-blur-sm hover:border-orange-400/70"
        >
          {showCrew ? "Close crew" : "Crew"}
        </button>
        {showCrew && (
          <div className="fixed inset-0 z-30 overflow-y-auto bg-[#020104]/95 pb-16 text-white">
            <CrewPanel
              crew={save.crew}
              crewLog={save.crewLog}
              clock={save.hours}
              onRole={(pawnId, role) => activeSlot !== null && setCrewRole(activeSlot, pawnId, role)}
            />
          </div>
        )}
      </>
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
