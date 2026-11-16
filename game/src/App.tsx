import { useState } from "react"
import { CrewPanel } from "@/components/CrewPanel"
import { GameMap } from "@/components/GameMap"
import { MainMenu } from "@/components/MainMenu"
import { devSiteOverride } from "@/map/marsSite"
import { useSpaceCalendar } from "@/data/useSpaceCalendar"
import { HOURS_PER_DAY, dayOf, describeSpaceEvent, eventsSoFar, latestNews, realDateAt, type Calendar } from "@/sim/calendar"
import { useSaves } from "@/sim/saves"

type Screen = "menu" | "game"

/** A real date as the player reads it, e.g. "7 March 2012". */
const readableDate = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })

/**
 * What an era really was, for the reveal when it ends: its real dates, and the real events that
 * mattered to Mars, each with the day it happened. Eruptions that headed elsewhere are only counted.
 */
function eraHistoryOf(calendar: Calendar, clock: number) {
  const past = eventsSoFar(calendar, clock)
  const quiet = past.filter((event) => event.kind === "eruption" && !event.towardMars)
  return {
    from: readableDate(calendar.start),
    to: readableDate(realDateAt(calendar, clock)),
    events: past
      .filter((event) => !quiet.includes(event))
      .map((event) => `Day ${dayOf(calendar, calendar.startHours + event.hour)}: ${describeSpaceEvent(event)}`),
    quietEruptions: quiet.length,
  }
}

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
  const setDeposits = useSaves((s) => s.setDeposits)
  const setCrewRole = useSaves((s) => s.setCrewRole)
  // Real NASA events for the calendar are fetched while the expedition is being played.
  useSpaceCalendar(activeSlot, screen === "game")

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
          day={dayOf(save.calendar, save.hours)}
          dayProgress={(Math.max(0, save.hours - save.calendar.startHours) % HOURS_PER_DAY) / HOURS_PER_DAY}
          spaceNews={(() => {
            const news = latestNews(save.calendar, save.hours)
            return news ? describeSpaceEvent(news) : null
          })()}
          eraHistory={eraHistoryOf(save.calendar, save.hours)}
          onNextEra={() => {
            if (activeSlot === null) return
            nextEra(activeSlot)
            setMapResets((count) => count + 1)
          }}
          onTimePassed={(hours, crew) => activeSlot !== null && passTime(activeSlot, hours, crew)}
          deposits={save.deposits}
          onDepositsGenerated={(deposits) => activeSlot !== null && setDeposits(activeSlot, deposits)}
          onResearch={(projectId) => activeSlot !== null && research(activeSlot, projectId)}
          onExit={() => setScreen("menu")}
        />

        {/* The crew system's details for this save (sim/crewLife.ts). Sits above the map credits button. */}
        <button
          type="button"
          onClick={() => setShowCrew((v) => !v)}
          className="fixed bottom-20 right-4 z-40 sm:bottom-24 sm:right-6 border border-white/15 bg-black/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white backdrop-blur-sm transition hover:border-orange-400/70 hover:bg-orange-950/85 hover:text-orange-100 focus-visible:outline-2 focus-visible:outline-orange-400"
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
        className="border border-white/15 px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] transition hover:border-orange-400/70 hover:bg-orange-500/15"
      >
        Back to menu
      </button>
    </main>
  )
}

export default App
