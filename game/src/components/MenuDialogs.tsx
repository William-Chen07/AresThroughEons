import { useEffect, type ReactNode } from "react"
import { MARS_FACTS } from "@/content/marsFacts"
import { useSettings } from "@/lib/settings"

const linkClass = "text-orange-300 underline underline-offset-2"
const sectionHeading = "mt-5 text-xs font-semibold uppercase tracking-[0.25em] text-white/50"

interface DialogProps {
  open: boolean
  onClose: () => void
}

/** Shared modal in the main menu's style. Closes on Escape, on the backdrop and on Close. */
function MenuModal({ open, onClose, title, children }: DialogProps & { title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null
  const titleId = `${title.toLowerCase().replace(/\s+/g, "-")}-title`
  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-full w-full max-w-lg overflow-y-auto border border-white/15 bg-neutral-950/90 p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-lg font-semibold uppercase tracking-[0.25em]">
          {title}
        </h2>
        {children}
        <button
          type="button"
          autoFocus
          onClick={onClose}
          className="mt-6 border border-white/15 px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] transition hover:border-orange-400/70"
        >
          Close
        </button>
      </div>
    </div>
  )
}

// --- How to Play ---

const STEPS = [
  { title: "Land", text: "Pick a landing spot on Mars and set down your lander." },
  {
    title: "Build",
    text: "Drill ice for water, grow food and make oxygen to breathe. All three need water, so every choice costs something!",
  },
  {
    title: "Stay safe",
    text: "Dust storms and solar flares can strike. A solar flare sends out radiation, invisible energy from the Sun that can hurt your body, so your crew must take cover.",
  },
  {
    title: "Come back stronger",
    text: "When a mission ends, your crew flies home with what fits in the ship. Next time, in a new era, you return with new tech.",
  },
]

export function HowToPlayDialog(props: DialogProps) {
  return (
    <MenuModal {...props} title="How to Play">
      <p className="mt-4 text-sm text-white/70">
        You lead a team of astronauts on Mars. Keep them safe, learn about Mars and get ready for the
        next mission!
      </p>
      <ol className="mt-4 space-y-3 text-sm text-white/70">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-3">
            <span className="w-5 shrink-0 font-semibold text-orange-300">{i + 1}.</span>
            <span>
              <span className="text-white/90">{step.title}:</span> {step.text}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-4 border-l-2 border-orange-400/70 pl-3 text-sm text-white/70">
        <span className="text-white/90">Did you know?</span> A day on Mars is called a <em>sol</em>. It
        is about 40 minutes longer than a day on Earth.
      </p>
    </MenuModal>
  )
}

// --- Mars Codex ---

export function CodexDialog({ codexIds, ...props }: DialogProps & { codexIds: string[] }) {
  const found = MARS_FACTS.filter((fact) => codexIds.includes(fact.id))
  return (
    <MenuModal {...props} title="Mars Codex">
      <p className="mt-4 text-sm text-white/70">
        Real NASA facts your crew has discovered: {found.length} of {MARS_FACTS.length}.
      </p>
      {found.length === 0 ? (
        <p className="mt-3 text-sm text-white/55">No facts yet. Explore Mars on your missions to fill your Codex!</p>
      ) : (
        <ul className="mt-3 space-y-4 text-sm text-white/70">
          {found.map((fact) => (
            <li key={fact.id}>
              <span className="block font-semibold uppercase tracking-[0.2em] text-orange-300">{fact.title}</span>
              {fact.text}
              <a href={fact.source.url} target="_blank" rel="noreferrer" className={`mt-0.5 block ${linkClass}`}>
                Source: {fact.source.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </MenuModal>
  )
}

// --- Settings ---

function VolumeRow({
  id,
  label,
  value,
  disabled,
  onChange,
}: {
  id: string
  label: string
  value: number
  disabled: boolean
  onChange: (value: number) => void
}) {
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="flex justify-between text-xs font-semibold uppercase tracking-[0.25em] text-white/80">
        {label}
        <span className="text-white/50">{Math.round(value * 100)}%</span>
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="w-full accent-orange-400 disabled:opacity-40"
      />
    </div>
  )
}

export function SettingsDialog(props: DialogProps) {
  const muted = useSettings((s) => s.muted)
  const musicVolume = useSettings((s) => s.musicVolume)
  const sfxVolume = useSettings((s) => s.sfxVolume)
  const setSettings = useSettings((s) => s.setSettings)

  return (
    <MenuModal {...props} title="Settings">
      <div className="mt-5 grid gap-6">
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs font-semibold uppercase tracking-[0.25em] text-white/80">Sound</span>
          <button
            type="button"
            role="switch"
            aria-checked={!muted}
            aria-label="Sound"
            onClick={() => setSettings({ muted: !muted })}
            className={`min-w-20 border px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] transition ${
              muted ? "border-white/15 text-white/50" : "border-orange-400/70 bg-orange-500/15 text-orange-200"
            }`}
          >
            {muted ? "Off" : "On"}
          </button>
        </div>
        <VolumeRow
          id="music-volume"
          label="Music volume"
          value={musicVolume}
          disabled={muted}
          onChange={(v) => setSettings({ musicVolume: v })}
        />
        <VolumeRow
          id="sfx-volume"
          label="Button sounds"
          value={sfxVolume}
          disabled={muted}
          onChange={(v) => setSettings({ sfxVolume: v })}
        />
      </div>
    </MenuModal>
  )
}

// --- Credits ---

type Credit = { use: string; what: string; links: { label: string; href: string }[] }

/** Every external dataset behind the Mars globe (see MarsGlobe.tsx / lib/marsEphemeris.ts) and the base map (see map/marsTrek.ts). */
const DATA_CREDITS: Credit[] = [
  {
    use: "Surface imagery (globe) and base map colour",
    what:
      "Viking MDIM 2.1 colour mosaic (Mars_Viking_MDIM21_ClrMosaic_global_232m), NASA Ames / USGS Astrogeology " +
      "Science Center, public domain, via NASA Mars Trek.",
    links: [{ label: "NASA Mars Trek", href: "https://trek.nasa.gov/mars/" }],
  },
  {
    use: "Base map detail",
    what:
      "Mars Odyssey THEMIS daytime infrared global mosaic, 100 m, v2 " +
      "(THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018), NASA/JPL-Caltech/Arizona State University/USGS " +
      "Astrogeology, via NASA Mars Trek.",
    links: [{ label: "NASA Mars Trek", href: "https://trek.nasa.gov/mars/" }],
  },
  {
    use: "Map tiles",
    what:
      "The base map's imagery and elevation are loaded as map tiles from NASA Solar System Treks (Mars Trek), " +
      "run by NASA JPL and SSERVI.",
    links: [{ label: "Trek tile service", href: "https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars" }],
  },
  {
    use: "Shape and terrain (globe) and base map heights",
    what:
      "Mars MGS MOLA DEM 463m, NASA Goddard Space Flight Center / USGS Astrogeology, CC0 (public " +
      "domain), on the Mars ellipsoid from NASA/JPL NAIF. The base map reads it through NASA Mars Trek " +
      "(Mars_MGS_MOLA_DEM_mosaic_global_463m_8).",
    links: [
      { label: "USGS Astrogeology", href: "https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m" },
      { label: "NASA Mars Trek", href: "https://trek.nasa.gov/mars/" },
    ],
  },
  {
    use: "Moon positions (globe)",
    what:
      "Orbits of Phobos and Deimos from the NASA/JPL Horizons system (satellite ephemeris mar099). On the " +
      "globe the moons are drawn bigger and closer to Mars than they really are, so they can be seen.",
    links: [{ label: "JPL Horizons", href: "https://ssd.jpl.nasa.gov/horizons/" }],
  },
  {
    use: "Moon shapes (globe)",
    what:
      "P. Thomas, Shape Models of Small Bodies V2.1 (EAR-A-5-DDR-SHAPE-MODELS-V2.1): Phobos and Deimos shape " +
      "models made from Viking Orbiter images, NASA Planetary Data System Small Bodies Node.",
    links: [
      {
        label: "PDS Small Bodies Node",
        href: "https://sbnarchive.psi.edu/pds3/non_mission/EAR_A_5_DDR_SHAPE_MODELS_V2_1/",
      },
    ],
  },
  {
    use: "Moon surfaces (globe)",
    what:
      "Phobos: Viking VIS global mosaic, 5 m per pixel (Phobos_Viking_Mosaic_40ppd_DLRcontrol), via NASA " +
      "Phobos Trek. Deimos: Viking Orbiter image mosaic (m2deimosm) from the same PDS data set as the shapes.",
    links: [
      { label: "NASA Phobos Trek", href: "https://trek.nasa.gov/phobos/" },
      {
        label: "PDS Small Bodies Node",
        href: "https://sbnarchive.psi.edu/pds3/non_mission/EAR_A_5_DDR_SHAPE_MODELS_V2_1/",
      },
    ],
  },
  {
    use: "Planet positions",
    what: "DE442 planetary ephemeris (2025), NASA/JPL NAIF (SPICE).",
    links: [
      { label: "NAIF usage rules", href: "https://naif.jpl.nasa.gov/naif/rules.html" },
      { label: "Generic kernels", href: "https://naif.jpl.nasa.gov/naif/data_generic.html" },
    ],
  },
  {
    use: "Mars rotation and tilt",
    what:
      "Konopliv et al. 2026, “Updated Mars Orientation and Gravity Field and Indication of Decadal " +
      "Changes in Rotation Rate”, The Planetary Science Journal, as distributed by NASA/JPL NAIF. " +
      "Mars radii in the same file are the IAU Working Group (WGCCRE) values.",
    links: [
      {
        label: "mars_konopliv_2026_v1 (NAIF)",
        href: "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/mars_konopliv_2026_v1.tpc",
      },
    ],
  },
  {
    use: "Base resources (ice and regolith)",
    what:
      "The two raw materials dug out of Mars in the game follow NASA’s overview of in-situ resource " +
      "utilization (ISRU): water deposits in the soil of Mars, and that soil itself (regolith) used " +
      "for manufacturing and construction.",
    links: [
      {
        label: "NASA: Overview of In-Situ Resource Utilization",
        href: "https://www.nasa.gov/overview-in-situ-resource-utilization/",
      },
    ],
  },
]

// TODO(team): confirm the exact credit lines for the two audio files.
const AUDIO_CREDITS: Credit[] = [
  { use: "Menu music", what: "“space” by leberch, from Pixabay (Audio/leberch-space-626368.mp3).", links: [] },
  {
    use: "Button sounds",
    what: "Short slices of a NASA sonification, which turns real space images into sound (Audio/13999_BUBBLE_MP4.mp3).",
    links: [],
  },
  {
    use: "Landing sound",
    what:
      "“Discovery STS-131: Sound of Launch”, NASA, from NASA's Historical Sounds collection. Trimmed and " +
      "reversed by our team so it sounds like a landing, and played each time a lander comes down (Audio/Launch.wav).",
    links: [
      { label: "NASA Historical Sounds", href: "https://www.nasa.gov/historical-sounds/" },
      { label: "NASA media usage guidelines", href: "https://www.nasa.gov/multimedia/guidelines/index.html" },
    ],
  },
]

function CreditList({ credits }: { credits: Credit[] }) {
  return (
    <ul className="mt-3 space-y-3 text-sm text-white/70">
      {credits.map((credit) => (
        <li key={credit.use}>
          <span className="text-white/90">{credit.use}:</span> {credit.what}
          {credit.links.length > 0 && (
            <span className="mt-0.5 flex flex-wrap gap-x-3">
              {credit.links.map((link) => (
                <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className={linkClass}>
                  {link.label}
                </a>
              ))}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

export function CreditsDialog(props: DialogProps) {
  return (
    <MenuModal {...props} title="Credits">
      <p className="mt-4 text-sm text-white/70">
        Built for the 2026 NASA Space Apps Challenge. The Mars globe is shown as seen from Earth right
        now, then sped up 720× so you can watch it turn. The background stars are decorative, not real
        star positions. Each expedition’s base map is drawn as pixel art from real imagery and elevation
        of its landing site: the pattern of the ground is real, but the colours are simplified to a small
        palette and the block heights are exaggerated.
      </p>
      <h3 className={sectionHeading}>Data sources</h3>
      <CreditList credits={DATA_CREDITS} />
      <h3 className={sectionHeading}>Fun facts</h3>
      {/* Built from the facts themselves, so every place on the globe is always credited. */}
      <ul className="mt-3 space-y-2 text-sm text-white/70">
        {MARS_FACTS.map((fact) => (
          <li key={fact.id}>
            <span className="text-white/90">{fact.title}:</span>{" "}
            <a href={fact.source.url} target="_blank" rel="noreferrer" className={linkClass}>
              {fact.source.label}
            </a>
          </li>
        ))}
      </ul>
      <h3 className={sectionHeading}>Music and sounds</h3>
      <CreditList credits={AUDIO_CREDITS} />
    </MenuModal>
  )
}
