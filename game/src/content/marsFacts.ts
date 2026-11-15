/**
 * Fun facts about places on Mars, shown as tappable pins on the main menu globe.
 * Every fact should come from a NASA source and say which one.
 *
 * Coordinates are planetocentric degrees: latitude north-positive, longitude
 * east-positive in -180..180 (the same convention as the globe's shape data).
 */
export interface MarsFact {
  id: string
  title: string
  /** Kid-friendly, plain language. Explain any science word in the same sentence. */
  text: string
  source: { label: string; url: string }
  location: { lat: number; lon: number }
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
]
