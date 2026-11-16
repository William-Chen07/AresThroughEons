/**
 * Every nebula sonification in the background music has a card for the Sonification Station and
 * the Mars Codex, with its picture and credits. Run from the game/ folder:
 *
 *   node --experimental-strip-types --import ./tests/pathing/register.mjs --test tests/content/nebulae.test.ts
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { NEBULAE, nebula, nebulaCodexId } from "@/content/nebulae"

test("every nebula track the music plays has a card with a picture and credits", () => {
  const sound = readFileSync("src/lib/sound.ts", "utf8")
  const trackIds = [...sound.matchAll(/\{ id: "([^"]+)", kind: "nebula"/g)].map((m) => m[1])
  assert.ok(trackIds.length > 0, "found the nebula tracks in lib/sound.ts")
  for (const id of trackIds) {
    const card = nebula(id)
    assert.ok(card, `${id} has a card in content/nebulae.ts`)
    assert.ok(existsSync(`public/${card.image}`), `public/${card.image} is there`)
    assert.ok(card.imageCredit.length > 0 && card.source.url.includes("nasa.gov") && card.sonification.url.includes("nasa.gov"))
  }
  assert.equal(NEBULAE.length, new Set(NEBULAE.map((n) => n.id)).size, "ids are unique")
  assert.equal(nebulaCodexId("bubble"), "nebula:bubble")
})
