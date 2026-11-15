/*
 * The research tree. This is plain data on purpose: add a row to add a
 * project, or change what it needs, without touching the game code.
 *
 * `tier` is the column the project sits in (0 is the start of the tree) and
 * `row` its place in that column. `requires` lists the projects that must be
 * researched first; keep them in the tier just before, so the lines of the
 * tree stay short. Every `text` is a real fact from the NASA page in `source`.
 *
 * Each era has its own tree (`era`, missing = era 1). The research panel shows the tree of the
 * era the expedition is in, or the last era that has one. What was researched in an earlier era
 * stays researched.
 */
export interface ResearchProject {
  id: string
  name: string
  tier: number
  row: number
  requires: string[]
  /** The era whose tree this project is in. Missing = era 1. */
  era?: number
  /** Kid-friendly, plain language. Explain any science word in the same sentence. */
  text: string
  source: { label: string; url: string }
}

export const RESEARCH_TIERS = ["First steps", "Living on Mars", "Staying for good"]

export const RESEARCH_PROJECTS: ResearchProject[] = [
  {
    id: "solar-power",
    name: "Solar Panels",
    tier: 0,
    row: 0,
    requires: [],
    text: "Solar panels turn sunlight into electricity. NASA's Opportunity rover ran on them for almost 15 years on Mars, even though dust storms sometimes blocked the Sun.",
    source: { label: "NASA Opportunity rover", url: "https://science.nasa.gov/mission/mer-opportunity/" },
  },
  {
    id: "ice-mining",
    name: "Ice Mining",
    tier: 0,
    row: 1,
    requires: [],
    text: "There is frozen water hiding under the soil of Mars. In 2008 NASA's Phoenix lander dug a small trench with its robot arm and found water ice just below the surface.",
    source: { label: "NASA Phoenix lander", url: "https://science.nasa.gov/mission/mars-phoenix/" },
  },
  {
    id: "soil-building",
    name: "Building with Mars Soil",
    tier: 0,
    row: 2,
    requires: [],
    text: "Carrying bricks from Earth would cost far too much. In NASA's 3D-Printed Habitat Challenge, teams built shelters with giant 3D printers, the way a crew could one day print a home on Mars.",
    source: {
      label: "NASA 3D-Printed Habitat Challenge",
      url: "https://www.nasa.gov/prizes-challenges-and-crowdsourcing/centennial-challenges/3d-printed-habitat-challenge/",
    },
  },
  {
    id: "oxygen-maker",
    name: "Oxygen Maker",
    tier: 1,
    row: 0,
    requires: ["solar-power"],
    text: "The air on Mars is mostly carbon dioxide, which people can't breathe. A machine called MOXIE on NASA's Perseverance rover pulled oxygen out of that air 16 times.",
    source: {
      label: "NASA MOXIE",
      url: "https://www.nasa.gov/missions/mars-2020-perseverance/perseverance-rover/nasas-oxygen-generating-experiment-moxie-completes-mars-mission/",
    },
  },
  {
    id: "space-farming",
    name: "Space Farming",
    tier: 1,
    row: 1,
    requires: ["solar-power", "ice-mining"],
    text: "Plants need water and light. On the International Space Station, astronauts grow lettuce and other plants under LED lights in a small garden called Veggie.",
    source: {
      label: "NASA: Growing Plants in Space",
      url: "https://www.nasa.gov/exploration-research-and-technology/growing-plants-in-space/",
    },
  },
  {
    id: "radiation-shielding",
    name: "Radiation Shielding",
    tier: 1,
    row: 2,
    requires: ["soil-building"],
    text: "Radiation is invisible energy from the Sun and deep space that can hurt your body. NASA's Curiosity rover measures it on Mars, so we know how thick a base's walls need to be.",
    source: { label: "NASA Curiosity rover", url: "https://science.nasa.gov/mission/msl-curiosity/" },
  },
  {
    id: "rocket-fuel",
    name: "Rocket Fuel from Mars",
    tier: 2,
    row: 0,
    requires: ["oxygen-maker"],
    text: "A rocket needs oxygen to burn its fuel. Making it on Mars, instead of hauling it from Earth, is called in-situ resource utilization: using what is already there.",
    source: {
      label: "NASA In-Situ Resource Utilization",
      url: "https://www.nasa.gov/overview-in-situ-resource-utilization/",
    },
  },
  {
    id: "life-support-loop",
    name: "Recycling Loop",
    tier: 2,
    row: 1,
    requires: ["oxygen-maker", "space-farming"],
    text: "Nothing can be wasted far from home. The International Space Station recycles 98% of its water, even sweat and the moisture in the crew's breath, back into clean drinking water.",
    source: {
      label: "NASA: water recovery on the space station",
      url: "https://www.nasa.gov/missions/station/iss-research/nasa-achieves-water-recovery-milestone-on-international-space-station/",
    },
  },
  {
    id: "fission-power",
    name: "Fission Power",
    tier: 2,
    row: 2,
    requires: ["radiation-shielding"],
    text: "A dust storm can hide the Sun for weeks. NASA's Kilopower project tested a small reactor in 2018 that makes electricity by splitting atoms, day or night, in any weather.",
    source: {
      label: "NASA Kilopower",
      url: "https://www.nasa.gov/directorates/stmd/tech-demo-missions-program/kilopower-hmqzw/",
    },
  },
  // ---- Era 2 (PLACEHOLDER: a small first tree; more projects to come) ----
  {
    id: "mars-helicopter",
    name: "Mars Helicopter",
    era: 2,
    tier: 0,
    row: 0,
    requires: [],
    text: "Flying on Mars is hard because the air is so thin. On April 19, 2021, NASA's Ingenuity helicopter made the first powered, controlled flight on another planet, and it went on to fly 72 times.",
    source: {
      label: "NASA Ingenuity Mars Helicopter",
      url: "https://science.nasa.gov/mission/mars-2020-perseverance/ingenuity-mars-helicopter/",
    },
  },
  {
    id: "laser-messages",
    name: "Laser Messages",
    era: 2,
    tier: 0,
    row: 1,
    requires: [],
    text: "Radio is slow for sending big pictures across space. In 2023 NASA's Deep Space Optical Communications test sent data with a laser from about 16 million kilometres away.",
    source: {
      label: "NASA Deep Space Optical Communications",
      url: "https://www.nasa.gov/mission/deep-space-optical-communications-dsoc/",
    },
  },
  {
    id: "long-stays",
    name: "Long Stays",
    era: 2,
    tier: 1,
    row: 1,
    requires: ["laser-messages"],
    text: "Living in space for a long time changes the body. Astronaut Scott Kelly lived on the space station for nearly a year while his twin brother Mark stayed on Earth, so doctors could compare them.",
    source: { label: "NASA Twins Study", url: "https://www.nasa.gov/humans-in-space/twins-study/" },
  },
]

/** The era of a project's tree. */
export const projectEra = (project: ResearchProject) => project.era ?? 1

/** The projects in the tree for this era: its own, or the last era's that has a tree. */
export function researchTree(era: number): ResearchProject[] {
  const eras = RESEARCH_PROJECTS.map(projectEra).filter((e) => e <= era)
  const shown = eras.length > 0 ? Math.max(...eras) : 1
  return RESEARCH_PROJECTS.filter((project) => projectEra(project) === shown)
}

export function researchProject(id: string): ResearchProject | undefined {
  return RESEARCH_PROJECTS.find((project) => project.id === id)
}
