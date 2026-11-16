import { describe, expect, it } from "vitest"
import { RESOURCE_TYPES, startingResources, upgradeResources } from "@/content/resources"
import { EXPLORE_PLACES } from "@/content/explore"

describe("ice is melted into water", () => {
  it("is not a resource any more", () => {
    expect(RESOURCE_TYPES.map((type) => type.id)).not.toContain("ice")
    expect(startingResources()).not.toHaveProperty("ice")
  })

  it("adds an older save's ice to its water", () => {
    const upgraded = upgradeResources({ water: 40, ice: 25, regolith: 7 })
    expect(upgraded.water).toBe(65)
    expect(upgraded.regolith).toBe(7)
    expect(upgraded).not.toHaveProperty("ice")
  })

  it("leaves a save with no ice alone", () => {
    expect(upgradeResources({ water: 40 }).water).toBe(40)
  })

  it("has explore places that bring back water where they used to bring back ice", () => {
    const find = (id: string) => EXPLORE_PLACES.find((place) => place.id === id)?.finds.map((f) => f.resource)
    expect(find("ice-cliff")).toEqual(["water"])
    expect(find("dry-riverbed")).toContain("water")
  })
})
