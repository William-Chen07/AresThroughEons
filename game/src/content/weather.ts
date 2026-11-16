/*
 * Weather events that can hit the base. This is plain data on purpose: change a
 * number or the wording here without touching the game code.
 *
 * `hours` is how long the event lasts, in game-hours. `healthLostPerHourOutside`
 * is the health an astronaut loses in each game-hour spent outside while it lasts.
 * Both are game numbers to tune, not real figures. `text` is a real fact from the
 * NASA page in `source`.
 */
export const WEATHER_EVENTS = [
  {
    id: "radiation-storm",
    name: "Radiation Storm",
    hours: 6,
    healthLostPerHourOutside: 10,
    warning: "Get the crew inside! Anyone outside is losing health.",
    text: "The Sun sometimes blasts out a burst of fast particles. Radiation is invisible energy that can hurt your body, and Mars has only thin air to block it. In September 2017 a solar storm more than doubled the radiation NASA's Curiosity rover measured on the ground.",
    source: {
      label: "NASA/JPL: solar storm doubles radiation on the Martian surface",
      url: "https://www.jpl.nasa.gov/news/large-solar-storm-sparks-global-aurora-and-doubles-radiation-levels-on-the-martian-surface/",
    },
  },
  {
    // Started by the in-game calendar when a real solar eruption reaches Mars (see sim/calendar.ts).
    id: "solar-storm",
    name: "Solar Storm",
    hours: 6,
    healthLostPerHourOutside: 10,
    warning: "A real solar eruption is hitting Mars. Get the crew inside!",
    text: "A solar eruption (a coronal mass ejection) is a giant cloud of hot gas and magnetism thrown off by the Sun. NASA tracks every one and uses computer models to predict which planets it will hit. This storm is real: NASA's records show an eruption reaching Mars on this very day in history.",
    source: {
      label: "NASA's DONKI space weather database",
      url: "https://kauai.ccmc.gsfc.nasa.gov/DONKI/",
    },
  },
] as const

export type WeatherEvent = (typeof WEATHER_EVENTS)[number]
export type WeatherId = WeatherEvent["id"]

export function weatherEvent(id: WeatherId): WeatherEvent {
  // Every id in a save comes from this list, so the lookup can't miss.
  return WEATHER_EVENTS.find((event) => event.id === id) ?? WEATHER_EVENTS[0]
}
