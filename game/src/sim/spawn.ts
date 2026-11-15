import { NASA_DATA } from "./constants"
import { createRng, type Rng } from "./rng"
import { ROLES, ROLE_IDS } from "./roles"
import { TRAITS, TRAIT_IDS } from "./traits"
import type { Colony, Mission, Pawn, RoleId, TraitId } from "./types"

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

export function createPawn(rng: Rng, role: RoleId, name: string, index: number): Pawn {
  return {
    id: `pawn-${index}`,
    name,
    role,
    color: ROLES[role].color,
    traits: rollTraits(rng),
    needs: { oxygen: 100, water: 100, food: 100, rest: 100, morale: 70 },
    health: 100,
    statuses: [],
    activity: "idle",
    task: "Just landed",
    skill: 2,
    xp: 0,
    missionDoseMsv: 0,
    careerDoseMsv: 0,
    orders: { enabled: true, scoutTarget: "any", holdDuringStorms: true },
    evacuated: null,
  }
}

/** Roles are fixed at spawn: one pawn per role by default. */
export function createCrew(rng: Rng, roles: RoleId[] = ROLE_IDS): Pawn[] {
  const names = [...NAMES]
  return roles.map((role, i) => {
    const name = names.splice(Math.floor(rng.next() * names.length), 1)[0]
    return createPawn(rng, role, name, i)
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

export function createMission(seed: number, roles: RoleId[] = ROLE_IDS): Mission {
  const rng = createRng(seed)
  const crew = createCrew(rng, roles)
  return {
    hour: 0,
    crew,
    colony: createColony(crew.length),
    rngState: rng.state,
    log: [{ hour: 0, kind: "info", text: `The crew has landed on Mars: ${crew.map((p) => p.name).join(", ")}.` }],
  }
}
