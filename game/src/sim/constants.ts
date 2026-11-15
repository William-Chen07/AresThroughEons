/**
 * Numbers that drive the crew simulation.
 *
 * NASA_DATA holds real measured/standard values. These may be shown to players
 * (glossary, tooltips), so every one keeps its source. Values marked VERIFY
 * should be checked against the cited document before the glossary quotes them.
 *
 * TUNING holds game-feel numbers we invented. Never present these as NASA data.
 */

export const NASA_DATA = {
  /** Length of a Mars day (sol): 24 h 39 min 35 s. Source: NASA Mars Facts. */
  solHours: 24.66,

  /**
   * Radiation dose on the Martian surface, measured by Curiosity's RAD instrument:
   * 0.64 ± 0.12 mSv per day. Source: Hassler et al. 2014, Science 343.
   */
  surfaceDoseMsvPerDay: 0.64,

  /**
   * NASA career radiation limit for astronauts: 600 mSv.
   * Source: NASA-STD-3001 Vol. 1 Rev. B (2022).
   */
  careerDoseLimitMsv: 600,

  /** Oxygen used by one crew member per day, about 0.82 kg. Source: NASA Life Support BVAD. */
  oxygenKgPerDay: 0.82,

  /** Drinking water per crew member per day. Source: NASA Life Support BVAD. VERIFY */
  waterKgPerDay: 2.5,

  /** Food (incl. packaging) per crew member per day. Source: NASA Life Support BVAD. VERIFY */
  foodKgPerDay: 1.8,
} as const

export const DATA_SOURCES = [
  "Curiosity RAD surface radiation: Hassler et al. 2014, Science 343",
  "Astronaut career radiation limit: NASA-STD-3001 Vol. 1 Rev. B",
  "Crew oxygen, water, and food needs: NASA Life Support Baseline Values and Assumptions Document (BVAD)",
] as const

export const TUNING = {
  // --- Needs (0-100 bars). A consumable bar drains 100 points per Earth day,
  // so refilling 100 points costs exactly one day's worth of real supplies.
  consumableDecayPerHour: 100 / 24,
  refillBelow: { oxygen: 99, water: 70, food: 60 },
  restDecayPerHour: 100 / 16, // awake ~16 h before needing sleep
  restRecoveryPerHour: 100 / 8, // ~8 h of sleep to recover
  sleepAtRest: 20,
  wakeAtRest: 95,

  // --- Morale
  moraleBaseline: 65,
  moraleChangePerHour: 3,
  stormMoralePenalty: 5,
  stressedBelowMorale: 25,
  stressRecoversAtMorale: 45,
  counselingMoraleBoost: 30,

  // --- Health
  healthRegenPerHour: 0.5,

  // --- Radiation (game scaling around the real dose rate)
  /** EVA suit: extra oxygen used while working outside. */
  evaOxygenMultiplier: 1.5,
  /** Solar particle event: how much higher the dose rate gets. Real timing should come from DONKI later. */
  solarParticleEventMultiplier: 40,

  // --- Scouting
  scoutFindChancePerHour: 0.25,
  scoutFindKg: { min: 5, max: 15 },
  stormFindPenalty: 0.5,
  injuryChancePerHour: 0.005,
  stormInjuryChancePerHour: 0.05,
  injuryNaturalHealHours: 96,

  // --- Skills
  maxSkill: 10,
  /** Work hours needed to go from skill N to N+1 is N * this. */
  xpPerSkillLevel: 12,
} as const
