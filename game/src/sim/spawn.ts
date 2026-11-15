import { createRng, type Rng } from "./rng"
import { OCCUPATIONS, OCCUPATION_IDS } from "./occupations"
import { ROLE_IDS } from "./roles"
import { NASA_DATA, TUNING } from "./constants"
import { TRAITS, TRAIT_IDS } from "./traits"
import type { Colony, Mission, OccupationId, Pawn, RoleId, Skill, TraitId } from "./types"

const NAMES = [
  "Ada", "Ben", "Cleo", "Dev", "Esme", "Femi", "Gus", "Hana",
  "Ivan", "Juno", "Kai", "Lena", "Milo", "Nia", "Omar", "Pia",
  "Quinn", "Rosa", "Sami", "Tara", "Uri", "Vera", "Wes", "Yuki",
]

export function rollTraits(rng: Rng, count = 2): TraitId[] {
  const picked: TraitId[] = []
  let guard = 0
  while (picked.length < count && guard++ < 100) {
    const t = rng.pick(TRAIT_IDS)
    const clash = picked.some(
      (p) => p === t || TRAITS[p].conflictsWith?.includes(t) || TRAITS[t].conflictsWith?.includes(p),
    )
    if (!clash) picked.push(t)
  }
  return picked
}

export function createPawn(rng: Rng, occupation: OccupationId, name: string, index: number): Pawn {
  const trainedRole = OCCUPATIONS[occupation].role
  const skills = Object.fromEntries(
    ROLE_IDS.map((r) => [
      r,
      { level: r === trainedRole ? TUNING.startingSkill.trained : TUNING.startingSkill.untrained, xp: 0 },
    ]),
  ) as Record<RoleId, Skill>
  return {
    id: `pawn-${index}`,
    name,
    occupation,
    role: trainedRole, // everyone starts on the job they trained for
    color: OCCUPATIONS[occupation].color,
    traits: rollTraits(rng),
    needs: { oxygen: 100, water: 100, food: 100, rest: 100, morale: 70 },
    health: 100,
    statuses: [],
    activity: "idle",
    task: "Just landed",
    skills,
    missionDoseMsv: 0,
    careerDoseMsv: 0,
    orders: { enabled: true, scoutTarget: "any", holdDuringStorms: true },
    evacuated: null,
  }
}

/** Occupations are fixed at spawn: one pawn per occupation by default. */
export function createCrew(rng: Rng, occupations: OccupationId[] = OCCUPATION_IDS): Pawn[] {
  const names = [...NAMES]
  return occupations.map((occupation, i) => {
    const name = names.splice(Math.floor(rng.next() * names.length), 1)[0]
    return createPawn(rng, occupation, name, i)
  })
}

export function createColony(crewSize: number, daysOfSupplies = 10): Colony {
  const days = crewSize * daysOfSupplies
  return {
    supplies: {
      oxygenKg: NASA_DATA.oxygenKgPerDay * days,
      waterKg: NASA_DATA.waterKgPerDay * days,
      foodKg: NASA_DATA.foodKgPerDay * days,
    },
    resources: { metal: 0, stone: 0, ice: 0 },
    constructionQueue: [],
    researchQueue: [],
    completed: { buildings: [], research: [] },
    habitatShielding: 0.5, // game placeholder until shielding modules exist
    evaDoseBudgetMsv: 5, // game tuning: grounded after ~8 sols outside at the real surface rate
    weather: { dustStorm: false, solarParticleEvent: false },
  }
}

export function createMission(seed: number, occupations: OccupationId[] = OCCUPATION_IDS): Mission {
  const rng = createRng(seed)
  const crew = createCrew(rng, occupations)
  return {
    hour: 0,
    crew,
    colony: createColony(crew.length),
    rngState: rng.state,
    log: [{ hour: 0, kind: "info", text: `The crew has landed on Mars: ${crew.map((p) => p.name).join(", ")}.` }],
  }
}
