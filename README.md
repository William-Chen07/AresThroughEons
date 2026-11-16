# Ares Through Eons

**Explore Mars. Build your base. Discover the science behind space exploration.**

An interactive, browser-based educational game that introduces young explorers to Mars through real NASA data, planetary exploration, and strategic decision-making.

Built for the **2026 NASA Space Apps Challenge**.

## The Mission

What would it take to build a home on Mars?

Mars is a fascinating planet, but living there presents challenges. Explorers must consider limited resources, unfamiliar terrain, and space weather while learning how scientists plan missions beyond Earth.

Our game turns these challenges into an interactive learning experience where players explore the Martian surface, develop a base, manage resources, and discover the science behind their decisions.

Rather than simply reading about Mars, players get to experiment, make choices, and see what happens.

## Audience & Accessibility

Designed primarily for **children ages 7–12**, our game makes planetary science approachable through visual exploration and hands-on learning.

We focused on creating an experience that is:

- **Easy to access:** Playable directly in a web browser.
- **Beginner-friendly:** Simple interactions and approachable scientific explanations.
- **Visually engaging:** Pixel-art environments and an interactive Mars globe.
- **Educational:** Real NASA observations and research incorporated into gameplay.
- **Exploratory:** Opportunities to experiment with different strategies and learn from outcomes.

The experience can also support older students, families, and classroom discussions about space exploration.

## Gameplay & Exploration

### Explore the Red Planet

Explore an interactive Mars globe and discover locations such as Olympus Mons, Valles Marineris, Jezero Crater, and Gale Crater.

The globe uses real planetary imagery and terrain information from NASA, allowing players to encounter actual Martian geography.

### Build Your Martian Base

Develop a settlement using resources inspired by real challenges in planetary exploration.

Players can encounter systems involving:

- Water and Martian soil (regolith)
- Resource extraction and processing
- Power and fuel generation
- Research and technology improvements
- Radiation protection
- Exploration using rovers

### Make Meaningful Decisions

Building a base requires balancing resources and planning ahead.

Every decision introduces opportunities to explore trade-offs between immediate needs and longer-term progress.

### Experience Space Weather

Space weather events introduce another dimension to Mars exploration.

The game incorporates NASA's DONKI space weather database, which provides information about real solar eruptions, flares, and particle storms.

These events connect gameplay with the environmental challenges that future Mars missions may face.

## Learning Through Real NASA Data

One of our main goals was to connect an engaging game with credible scientific information.

Rather than creating an entirely fictional Mars environment, we used NASA imagery, elevation maps, planetary information, and scientific research as the foundation for our world.

| NASA data                 | How we use it                                         |
| ------------------------- | ----------------------------------------------------- |
| Viking MDIM 2.1           | Mars globe imagery and base map colors                |
| Mars Odyssey THEMIS       | Detailed Martian surface imagery                      |
| Mars Global Surveyor MOLA | Terrain elevation and planetary shape                 |
| Mars Global Surveyor TES  | Mineral information informing gameplay                |
| JPL Horizons              | Positions and orbits of Phobos and Deimos             |
| NASA/JPL NAIF SPICE       | Planetary positions and Mars orientation              |
| NASA DONKI                | Solar eruptions, flares, and particle storms          |
| NASA ISRU research        | Water extraction, regolith, and resource-use concepts |

**Scientific accuracy and gameplay**

Some visual and gameplay elements are simplified to make the experience easier to understand.

- Mars terrain is based on real imagery and elevation, but pixel-art colors are simplified and block heights exaggerated.
- Phobos and Deimos appear larger and closer to Mars than their actual scale.
- Background stars are decorative rather than scientifically positioned.
- Mineral information is approximated from NASA maps; individual resource deposits are determined by game rules.
- Space weather events come from NASA data, while their effects within the game are part of the simulation.

These distinctions help players understand what comes from scientific observations and what has been adapted for gameplay.

## Design & User Experience

We wanted the game to feel approachable to younger players without sacrificing the excitement of space exploration.

Our design combines an interactive 3D Mars globe with pixel-art base-building environments.

The experience emphasizes visual learning, recognizable interactions, and opportunities for discovery.

Players can move between exploring Mars, developing their settlement, and learning about the science behind different technologies.

## Technology Stack

| Category | Technologies |
|---|---|
| Frontend | React |
| 2D Game Rendering | PixiJS, pixi-viewport |
| 3D Mars Globe | three.js |
| Asset Creation & Design | Blender |
| Styling | Tailwind CSS, shadcn/ui |
| UI Components | Base UI |
| State Management | Zustand |
| Icons | Lucide |
| Typography | Figtree |
| Planetary Data | NASA Mars Trek, JPL Horizons, NAIF |
| Space Weather | NASA DONKI API |

## NASA Data Sources & Credits

We are grateful for the publicly available scientific data and research that made this project possible.

### Planetary imagery and terrain

- [NASA Mars Trek](https://trek.nasa.gov/mars/) — Viking imagery, THEMIS mosaics, MOLA elevation, and TES mineral maps.
- [NASA Solar System Treks API](https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars) — Imagery and elevation map tiles.
- [USGS Astrogeology](https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m) — Mars elevation data.

### Planetary motion and moons

- [NASA/JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) — Orbital information for Phobos and Deimos.
- [NASA Planetary Data System](https://sbnarchive.psi.edu/pds3/non_mission/EAR_A_5_DDR_SHAPE_MODELS_V2_1/) — Moon shape models.
- [NASA Phobos Trek](https://trek.nasa.gov/phobos/) — Phobos imagery.
- [NASA/JPL NAIF](https://naif.jpl.nasa.gov/naif/data_generic.html) — Planetary positions and orientation data.

### Space weather and scientific research

- [NASA DONKI](https://kauai.ccmc.gsfc.nasa.gov/DONKI/) — Space weather events.
- [NASA Open APIs](https://api.nasa.gov/) — Space weather API access.
- [NASA In-Situ Resource Utilization](https://www.nasa.gov/overview-in-situ-resource-utilization/) — Research on using local planetary resources.
- [NASA Mars Science](https://science.nasa.gov/mars/facts/) — Planetary facts and educational information.
- [NASA Artemis I Radiation Research](https://www.nasa.gov/general/artemis-i-space-radiation-research-to-help-moon-mars-explorers/) — Space radiation research.

Additional educational references cover Mars rovers, space-based research, resource processing, and technology development.

### Audio and visual assets

- **Music:** “space” by leberch, via Pixabay.
- **Button sounds:** Edited excerpts from a NASA space-image sonification.
- **Landing sound:** NASA's “Discovery STS-131: Sound of Launch,” trimmed and reversed for gameplay.
- **Font:** Figtree, SIL Open Font License 1.1.
- **Icons:** Lucide, ISC License.

See [NASA Historical Sounds](https://www.nasa.gov/historical-sounds/) and [NASA Media Usage Guidelines](https://www.nasa.gov/multimedia/guidelines/index.html) for additional information.

## Our Goal

We believe learning about space should be accessible, interactive, and exciting.

By combining real NASA science with exploration and strategic gameplay, our project encourages younger audiences to ask questions, experiment with solutions, and discover what makes planetary exploration possible.

**The next generation of space explorers starts with curiosity.**

---

Created for the **NASA Space Apps Challenge 2026**.
