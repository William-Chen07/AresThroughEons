/*
 * The research tree. This is plain data on purpose: add a row to add a
 * project, or change what it needs, without touching the game code.
 *
 * `tier` is the column the project sits in (0 is the start of the tree) and
 * `row` its place in that column. `requires` lists the projects that must be
 * researched first; keep them in the tier just before, so the lines of the
 * tree stay short. Every `text` is a real fact from the NASA page in `source`.
 *
 * It is one connected tree that stays the same in every era: later projects build on earlier
 * ones through `requires`. What was researched stays researched when a new era starts.
 *
 * `era` is the era a project belongs to. It sets the project's colour in the tree (see
 * RESEARCH_ERAS), and a project stays locked until the expedition reaches its era.
 * `does` is what the project will do in the game once that is built; for most projects it
 * isn't in the game yet, so it isn't shown to players.
 * `hours` is how many game-hours one astronaut working in a Research Lab takes to finish it.
 * Each extra staffed lab adds another astronaut's work (see sim/research.ts).
 */
export interface ResearchProject {
  id: string
  name: string
  tier: number
  row: number
  requires: string[]
  /** The era the project belongs to, which sets its colour in the tree. */
  era: number
  /** Game-hours of one astronaut's work in a Research Lab to finish it. */
  hours: number
  /** What researching it is meant to do in the game (the design; most of it isn't built yet). */
  does?: string
  /** Kid-friendly, plain language. Explain any science word in the same sentence. */
  text: string
  source: { label: string; url: string }
}

export const RESEARCH_TIERS = ["First steps", "Building up", "Reaching further"]

/** The colour of each era's projects in the tree. */
export const RESEARCH_ERAS: { era: number; name: string; color: string }[] = [
  { era: 1, name: "Era 1", color: "#5eead4" },
  { era: 2, name: "Era 2", color: "#c4b5fd" },
  { era: 3, name: "Era 3", color: "#f9a8d4" },
  { era: 4, name: "Era 4", color: "#fcd34d" },
]

export const eraColor = (era: number) => RESEARCH_ERAS.find((e) => e.era === era)?.color ?? "#ffffff"

export const RESEARCH_PROJECTS: ResearchProject[] = [
  // ---- Era 1 ----
  {
    id: "observatory",
    name: "Observatory",
    tier: 0,
    row: 3,
    era: 1,
    hours: 6,
    requires: [],
    does: "An Observatory module: when a nebula sound plays, you can see the nebula.",
    text: "Space is silent, but NASA turns telescope pictures into sound. For the Southern Ring Nebula, a glowing cloud of gas around a star, the colours in the Webb telescope's pictures were turned into musical notes, so blind and low-vision listeners can explore it too.",
    source: { label: "NASA Webb: images set to sound", url: "https://science.nasa.gov/missions/webb/nasa-webbs-first-full-color-images-data-are-set-to-sound/" },
  },
  {
    id: "wind-turbines",
    name: "Wind Turbines",
    tier: 0,
    row: 0,
    era: 1,
    hours: 6,
    requires: [],
    does: "Wind turbines: less power than solar panels, but steady, day and night.",
    text: "NASA has tested wind power before. On October 29, 1975, it switched on an experimental wind turbine at Plum Brook Station in Ohio: a 100-foot (30-metre) tower with two blades, each 62.5 feet (19 metres) long.",
    source: { label: "NASA: wind turbines at Plum Brook", url: "https://www.nasa.gov/feature/glenn/2019/nasa-experimented-with-wind-turbines-at-plum-brook-in-the-1970s" },
  },
  {
    id: "lounge",
    name: "Lounge",
    tier: 0,
    row: 2,
    era: 1,
    hours: 6,
    requires: [],
    does: "A Lounge module: the crew spend time together there, which gives a small boost to morale.",
    text: "A good meal together can cheer up a crew. At Christmas 1968, the Apollo 8 astronauts found a surprise dinner of turkey and gravy in their food locker, and it greatly improved their morale and appetite.",
    source: { label: "NASA: Apollo 8 Christmas dinner", url: "https://www.nasa.gov/humans-in-space/apollo-8-christmas-dinner/" },
  },
  // ---- Era 2 ----
  {
    id: "potato-greenhouse",
    name: "Potato Greenhouse",
    tier: 1,
    row: 0,
    era: 2,
    hours: 10,
    requires: ["wind-turbines"],
    does: "A Potato Greenhouse: uses a lot more power, but makes food on its own.",
    text: "Potatoes can grow in space. In 1995, potato cuttings flew on the space shuttle Columbia and grew little potatoes, called tubers, shaped much like ones grown on Earth.",
    source: { label: "NASA Technical Reports: potatoes grown in spaceflight", url: "https://ntrs.nasa.gov/citations/20040120699" },
  },
  {
    id: "bigger-lounge",
    name: "Bigger Lounge",
    tier: 1,
    row: 2,
    era: 2,
    hours: 10,
    requires: ["lounge"],
    does: "A bigger Lounge, with room for more of the crew.",
    text: "Crews need room to live. The International Space Station is larger than a six-bedroom house, with six sleeping spots, two bathrooms, a gym and a bay window that looks all the way around.",
    source: { label: "NASA: space station overview", url: "https://www.nasa.gov/international-space-station/space-station-overview/" },
  },
  {
    id: "fuel-generator",
    name: "Fuel Generator",
    tier: 1,
    row: 1,
    era: 2,
    hours: 10,
    requires: ["wind-turbines"],
    does: "Makes fuel, using up resources such as sulfur.",
    text: "Rockets can burn methane, a fuel that could one day be made on Mars. NASA's Morpheus test lander ran on methane and liquid oxygen, and finished over 65 tests, including 15 flights, by 2014.",
    source: { label: "NASA Technical Reports: Morpheus lander", url: "https://ntrs.nasa.gov/citations/20160001041" },
  },
  {
    id: "rover",
    name: "Rover",
    tier: 2,
    row: 1,
    era: 2,
    hours: 14,
    requires: ["fuel-generator"],
    does: "A Rover module: makes a rover that can go with an expedition. It runs on fuel instead of food.",
    text: "Wheels let explorers go much further. Apollo 15 was the first mission to use the Lunar Roving Vehicle, a car for driving on the Moon, starting on July 31, 1971.",
    source: { label: "NASA: first use of the Lunar Roving Vehicle", url: "https://www.nasa.gov/image-article/this-week-nasa-history-first-use-of-lunar-roving-vehicle-july-31-1971/" },
  },
  // ---- Era 3 ----
  {
    id: "radiation-suits",
    name: "Radiation-Resistant Suits",
    tier: 1,
    row: 3,
    era: 3,
    hours: 16,
    requires: ["observatory"],
    does: "Suits that protect an astronaut from a radiation storm.",
    text: "NASA tests how to protect people from space radiation. For the Artemis I flight around the Moon, two pretend bodies named Helga and Zohar carried radiation detectors. Only Zohar wore a protective vest, called AstroRad, to find out how well it works.",
    source: { label: "NASA: Artemis I radiation research", url: "https://www.nasa.gov/general/artemis-i-space-radiation-research-to-help-moon-mars-explorers/" },
  },
  {
    id: "better-research",
    name: "Better Research",
    tier: 1,
    row: 4,
    era: 3,
    hours: 16,
    requires: ["observatory"],
    does: "An Advanced Research Lab, which researches 1.5× as fast. Needs copper and gold.",
    text: "Some science tools are made with gold. Each mirror piece of NASA's Webb telescope has a very thin coat of gold, only 100 nanometres thick, because gold helps it reflect infrared light, a kind of light our eyes can't see.",
    source: { label: "NASA: Webb's mirrors", url: "https://science.nasa.gov/mission/webb/webbs-mirrors/" },
  },
  // ---- Era 4 ----
  {
    id: "uranium-power",
    name: "Uranium Power Plant",
    tier: 2,
    row: 4,
    era: 4,
    hours: 24,
    requires: ["better-research"],
    does: "A Uranium Power Plant: uses uranium to make power, day or night, in any weather.",
    text: "A dust storm can hide the Sun for weeks. NASA's Kilopower project tested a small reactor in 2018 that makes electricity by splitting atoms, day or night, in any weather.",
    source: {
      label: "NASA Kilopower",
      url: "https://www.nasa.gov/directorates/stmd/tech-demo-missions-program/kilopower-hmqzw/",
    },
  },
]

export function researchProject(id: string): ResearchProject | undefined {
  return RESEARCH_PROJECTS.find((project) => project.id === id)
}
