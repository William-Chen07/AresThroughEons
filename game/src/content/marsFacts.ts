import type { MoonId } from "@/lib/marsMoons"

/**
 * Fun facts about places on Mars and its two moons, shown as tappable pins on the main menu globe.
 * Every fact should come from a NASA source and say which one.
 *
 * Coordinates are planetocentric degrees: latitude north-positive, longitude
 * east-positive in -180..180 (the same convention as the globe's shape data).
 * A fact about a moon is pinned to the moon itself and moves with it.
 */
export interface MarsFact {
  id: string
  title: string
  /** Kid-friendly, plain language. Explain any science word in the same sentence. */
  text: string
  source: { label: string; url: string }
  location: { lat: number; lon: number } | { moon: MoonId }
}

export const MARS_FACTS: MarsFact[] = [
  {
    id: "olympus-mons",
    title: "Olympus Mons",
    text: "The biggest volcano in the whole solar system! It is more than twice as tall as Mount Everest and about as wide as the state of Arizona.",
    source: { label: "NASA Science", url: "https://science.nasa.gov/mars/facts/" },
    location: { lat: 18.65, lon: -133.8 },
  },
  {
    id: "valles-marineris",
    title: "Valles Marineris",
    text: "A giant canyon about 4,000 km (2,500 miles) long and up to 7 km (4 miles) deep. On Earth it would stretch almost all the way across the United States.",
    source: { label: "NASA Science", url: "https://science.nasa.gov/mars/facts/" },
    location: { lat: -13.9, lon: -59.2 },
  },
  {
    id: "jezero",
    title: "Jezero Crater",
    text: "NASA's Perseverance rover landed here on 18 February 2021. Long ago this crater held a lake, so the rover is searching its rocks for signs of ancient life.",
    source: {
      label: "NASA Mars 2020 Perseverance",
      url: "https://science.nasa.gov/mission/mars-2020-perseverance/",
    },
    location: { lat: 18.38, lon: 77.58 },
  },
  {
    id: "gale",
    title: "Gale Crater",
    text: "NASA's Curiosity rover has been exploring here since August 2012. It is climbing Mount Sharp, a mountain made of rock layers that record how Mars once had water.",
    source: { label: "NASA Curiosity", url: "https://science.nasa.gov/mission/msl-curiosity/" },
    location: { lat: -5.4, lon: 137.8 },
  },
  {
    id: "north-polar-cap",
    title: "North Polar Ice Cap",
    text: "Mars has ice caps of frozen water and dry ice (frozen carbon dioxide). Future astronauts could melt ice like this to get drinking water and even oxygen to breathe.",
    source: { label: "NASA Science", url: "https://science.nasa.gov/mars/facts/" },
    location: { lat: 86, lon: 0 },
  },
  {
    id: "phobos",
    title: "Phobos",
    text: "Mars' bigger moon is a lumpy rock only about 27 km (17 miles) long. It zooms around Mars three times a day, and it is slowly falling closer. In about 50 million years it will crash into Mars or break up into a ring!",
    source: { label: "NASA Science: Phobos", url: "https://science.nasa.gov/mars/moons/phobos/" },
    location: { moon: "phobos" },
  },
  {
    id: "deimos",
    title: "Deimos",
    text: "Mars' smaller moon is only about 15 km (9 miles) long and goes around Mars once every 30 hours. Both moons were found in 1877 and named after the sons of Ares, the Greek god of war. Deimos means dread and Phobos means fear.",
    source: { label: "NASA Science: Deimos", url: "https://science.nasa.gov/mars/moons/deimos/" },
    location: { moon: "deimos" },
  },
]
