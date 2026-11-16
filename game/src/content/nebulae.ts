/*
 * The nebulae (and one galaxy) the background music plays as NASA sonifications: space pictures
 * turned into sound (see lib/sound.ts). Each `id` matches a nebula track id there. While one is
 * playing, a Sonification Station on the base map shows a "!"; clicking it shows this card, and
 * the card is added to the Mars Codex (see components/NebulaCard.tsx).
 *
 * Every `text` uses only what NASA's pages in `source` and `sonification` say. The pictures are
 * the plain Hubble images from those pages (no logo or text), shrunk to 800 px, in
 * public/nebulae. NASA asks for the credit lines in `imageCredit` and `soundCredit`.
 */
export interface Nebula {
  /** Same as the music track's id (see TRACKS in lib/sound.ts). */
  id: string
  name: string
  /** What kind of object it is, shown above the name. */
  kind: string
  /** The picture, under public/. */
  image: string
  /** Kid-friendly, plain language. */
  text: string
  imageCredit: string
  /** The NASA page with the picture. */
  source: { label: string; url: string }
  /** The NASA page with the sonification. */
  sonification: { label: string; url: string }
}

/** Who made the sonifications (the same for all six), as NASA credits them. */
export const SOUND_CREDIT = "Sonification: SYSTEM Sounds (M. Russo, A. Santaguida), NASA's Goddard Space Flight Center"

export const NEBULAE: Nebula[] = [
  {
    id: "butterfly",
    name: "Butterfly Nebula",
    kind: "Planetary nebula · NGC 6302",
    image: "nebulae/butterfly.jpg",
    text: "The glowing wings of the Butterfly Nebula are gas thrown off by a dying star. Some of that gas is heated to more than 36,000 °F (about 20,000 °C). It lies between 2,500 and 3,800 light-years away, in the constellation Scorpius.",
    imageCredit: "NASA, ESA, Joel Kastner (RIT)",
    source: { label: "NASA: NGC 6302, the Butterfly Nebula", url: "https://science.nasa.gov/asset/hubble/ngc-6302-the-butterfly-nebula/" },
    sonification: { label: "NASA SVS: Sonification of the Butterfly Nebula", url: "https://svs.gsfc.nasa.gov/13998/" },
  },
  {
    id: "bubble",
    name: "Bubble Nebula",
    kind: "Emission nebula · NGC 7635",
    image: "nebulae/bubble.jpg",
    text: "A super-hot, massive star is blowing an enormous bubble into space. The bubble is roughly seven light-years across and 7,100 light-years from Earth, in the constellation Cassiopeia.",
    imageCredit: "NASA, ESA, and the Hubble Heritage Team (STScI/AURA)",
    source: { label: "NASA: Bubble Nebula (NGC 7635)", url: "https://science.nasa.gov/asset/hubble/bubble-nebula-ngc-7635/" },
    sonification: { label: "NASA SVS: Sonification of the Bubble Nebula", url: "https://svs.gsfc.nasa.gov/13999/" },
  },
  {
    id: "pismis",
    name: "Pismis 24",
    kind: "Star cluster in the nebula NGC 6357",
    image: "nebulae/pismis.jpg",
    text: "Pismis 24 is a cluster of bright young stars that lies within the nebula NGC 6357. It is about 8,000 light-years away, in the constellation Scorpius.",
    imageCredit: "NASA, ESA and Jesús Maíz Apellániz (Instituto de Astrofísica de Andalucía, Spain); Acknowledgment: Davide De Martin (ESA/Hubble)",
    source: { label: "NASA: Pismis 24 and NGC 6357", url: "https://science.nasa.gov/asset/hubble/pismis-24-and-ngc-6357/" },
    sonification: { label: "NASA SVS: Data Sonification: Pismis 24", url: "https://svs.gsfc.nasa.gov/14246/" },
  },
  {
    id: "rs-puppis",
    name: "RS Puppis",
    kind: "Star wrapped in a nebula of dust",
    image: "nebulae/rs-puppis.jpg",
    text: "RS Puppis is a glittering star 200 times larger than our Sun, wrapped in dust that reflects its light. About 6,500 light-years away, it brightens and dims over a six-week cycle.",
    imageCredit:
      "NASA, ESA, and the Hubble Heritage Team (STScI/AURA)-Hubble/Europe Collaboration; Acknowledgment: H. Bond (STScI and Pennsylvania State University)",
    source: { label: "NASA: Hubble image of variable star RS Puppis", url: "https://science.nasa.gov/image-detail/hubble-image-of-variable-star-rs-puppis/" },
    sonification: { label: "NASA SVS: Sonification of RS Puppis", url: "https://svs.gsfc.nasa.gov/14260/" },
  },
  {
    id: "ngc-2392",
    name: "NGC 2392",
    kind: "Planetary nebula",
    image: "nebulae/ngc-2392.jpg",
    text: "NGC 2392 is a planetary nebula: the glowing remains of a dying star like our Sun. It is about 5,000 light-years from Earth, in the constellation Gemini.",
    imageCredit: "NASA, Andrew Fruchter and the ERO Team (Sylvia Baggett, Richard Hook, Zoltan Levay)",
    source: { label: "NASA: NGC 2392", url: "https://science.nasa.gov/asset/hubble/ngc-2392/" },
    sonification: { label: "NASA SVS: Sonification of NGC 2392", url: "https://svs.gsfc.nasa.gov/13997/" },
  },
  {
    id: "ngc-1569",
    name: "NGC 1569",
    kind: "Starburst galaxy (not a nebula!)",
    image: "nebulae/ngc-1569.jpg",
    text: "NGC 1569 is a small galaxy about eleven million light-years away, in the constellation Camelopardalis (the Giraffe). It is a starburst galaxy: it makes new stars 100 times faster than our own galaxy, the Milky Way.",
    imageCredit: "ESA/Hubble & NASA, Aloisi, Ford; Acknowledgement: Judy Schmidt",
    source: { label: "NASA: NGC 1569", url: "https://science.nasa.gov/image-detail/bursting-at-the-seams-2/" },
    sonification: { label: "NASA SVS: Sonification of NGC 1569", url: "https://svs.gsfc.nasa.gov/14156/" },
  },
]

export const nebula = (id: string) => NEBULAE.find((entry) => entry.id === id)

/** How a nebula's card is kept in the Mars Codex (codexIds in sim/progress.ts). */
export const nebulaCodexId = (id: string) => `nebula:${id}`
