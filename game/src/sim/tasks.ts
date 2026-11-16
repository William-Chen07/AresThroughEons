import { CLUMP, depositIdOf, depositStationId, type Deposit, type MineralId } from "@/sim/deposits"
import { createStation, orderGroup, type ClickResult, type Station, type World } from "@/sim/pathing"

/*
 * Tasks the player can give an astronaut from their task list (right-click them on the base map),
 * as pure logic. For now that's mining: going to a mineral deposit and digging it out. Mining
 * itself happens in sim/saves.ts (passTime), which takes from the deposit and adds to the
 * resource while the astronaut works there (see mine in sim/deposits.ts).
 */

/** One mining job on an astronaut's task list: the nearest deposit of a mineral that has some left. */
export interface MiningChoice {
  depositId: string
  mineral: MineralId
  /** How much is left in that deposit. */
  amount: number
  /** Straight-line distance from the astronaut, in map cells. */
  distance: number
}

/**
 * Puts a work station on the crew's map for every deposit with something left (the whole clump is
 * the station; crew stand anywhere round its edge to mine), and takes away the ones that ran out,
 * which stops anyone mining them. Stations for deposits that are still there are kept as they are.
 * Returns the stations taken away.
 */
export function syncDepositStations(world: World, deposits: readonly Deposit[]): Station[] {
  const left = new Map(deposits.filter((d) => d.amount > 0).map((d) => [depositStationId(d.id), d]))
  const gone = world.stations.filter((station) => depositIdOf(station.id) && !left.has(station.id))
  world.stations = world.stations.filter((station) => !gone.includes(station))
  const half = Math.floor(CLUMP / 2)
  for (const [id, deposit] of left) {
    if (world.stations.some((station) => station.id === id)) continue
    world.stations.push(
      createStation(world.grid, {
        id,
        kind: deposit.mineral,
        x: deposit.col - half,
        y: deposit.row - half,
        width: CLUMP,
        height: CLUMP,
      }),
    )
  }
  return gone
}

/** The deposits an astronaut could be sent to mine, nearest first. Only ones on the crew's map with something left. */
function minableDeposits(world: World, deposits: readonly Deposit[], pawnId: string): MiningChoice[] {
  const pos = world.movers[pawnId]?.pos
  if (!pos) return []
  const onMap = new Set(world.stations.map((station) => station.id))
  return deposits
    .filter((d) => d.amount > 0 && onMap.has(depositStationId(d.id)))
    .map((d) => ({ depositId: d.id, mineral: d.mineral, amount: d.amount, distance: Math.hypot(d.col - pos.x, d.row - pos.y) }))
    .sort((a, b) => a.distance - b.distance)
}

/** The mining jobs for an astronaut's task list: the nearest deposit of each mineral, nearest first. */
export function miningChoices(world: World, deposits: readonly Deposit[], pawnId: string): MiningChoice[] {
  const seen = new Set<MineralId>()
  return minableDeposits(world, deposits, pawnId).filter((choice) => {
    if (seen.has(choice.mineral)) return false
    seen.add(choice.mineral)
    return true
  })
}

/**
 * Sends an astronaut to mine: the nearest deposit of `mineral`, or of any mineral if it's null. A
 * deposit they can't get to is skipped for the next nearest. With `queue`, the job is added to the
 * end of their task list instead of replacing what they're doing. The result reads like a click's
 * (see orderGroup), with why it didn't work if no deposit could be reached.
 */
export function sendToMine(
  world: World,
  deposits: readonly Deposit[],
  pawnId: string,
  mineral: MineralId | null,
  queue = false,
): ClickResult {
  const choices = minableDeposits(world, deposits, pawnId).filter((c) => mineral === null || c.mineral === mineral)
  if (choices.length === 0) {
    const reason = "There's no deposit left to mine."
    return { kind: "failed", reason, failed: [{ pawnId, reason }] }
  }
  let last: ClickResult | null = null
  for (const choice of choices) {
    const result = orderGroup(world, [pawnId], { kind: "work", stationId: depositStationId(choice.depositId) }, queue)
    // On their way (or lined up): done. Otherwise this one can't be reached: try the next nearest.
    if (result.kind === "ordered" && result.started.length + result.queued.length + result.deferred.length > 0) return result
    last = result
  }
  return last!
}
