# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Ares Through Eons is a team entry for the NASA Space Apps Challenge 2026, "Junior Astronaut Mission Trainer." It's a browser game for kids aged 7–12: a 2D Mars colony sim with roguelike eras, made in PixiJS with sprite stacking for a fake 3D look. The original design doc is the team's Google Doc "Nasa Game"; the decisions below are the agreed version.

The app lives in `game/`. What exists so far:
- the main menu (`src/components/menu/`)
- a placeholder "game" screen, switched by `useState<"menu" | "game">` in `App.tsx`
- two small persisted stores the menu uses:
  - `src/sim/progress.ts`: what the player has unlocked
  - `src/lib/settings.ts`: sound preferences

Everything under **Planned architecture** is not built yet.

## Commands

Run these from `game/`:

```bash
npm install
npm run dev       # Vite dev server
npm run build     # tsc -b && vite build — type errors fail the build (and the Vercel deploy)
npm run lint      # ESLint (typescript-eslint + react-hooks + react-refresh)
npm run preview   # serve the production build
```

No test runner is configured.

**Previewing saved progress in dev:** `progress.ts` reads URL parameters, for example `/?crew=3&tech=rover,habitat&era=2&codex=jezero` to fake a save, and `/?reset` to go back to a brand-new player.

The root `package.json` only exists so the shadcn CLI is available to the shadcn MCP server (see Tooling). Game dependencies belong in `game/package.json`. Don't install them at the root.

## Stack notes that aren't obvious from the files

- **Two renderers.** The main menu uses **three.js**: `components/menu/MarsGlobe.tsx` draws a 3D globe with an atmosphere shader and a starfield. The game itself is planned in **Pixi v8**, using `@pixi/react` 8, `pixi-viewport` 7 (camera pan/zoom) and `@pixi/sound` 6.
- **The menu globe:** `MarsGlobe` builds its three.js scene once, in a mount effect.
  - Props that change later (the selected site, `menuRight`) reach the running scene through refs. Never add them to the mount effect's dependencies; that would recreate the WebGL context.
  - Mars is centred and scaled to fit the free space right of the menu column. `MainMenu` measures the column and passes its right edge as `menuRight`.
  - The parent controls it through a ref handle: `focusSite(id)` and `zoomIn()`.
  - Pins are placed from codex lat/lon via `latLonToLocal`, which assumes the texture's left edge is longitude −180.
- **Crew on the Play button:** `CrewHover.tsx` is a second, small, transparent three.js canvas placed *behind* the Play button.
  - It draws the unlocked crew (`progress.crewCount`, up to 6) and tech in a row.
  - While Play is hovered or focused (and during the launch zoom), they pop up one by one from behind the button and hover with shadows. Otherwise they sink out of sight; a clipping plane at the button's top edge hides whatever is below it.
  - **Rise and sink:** each item is a damped spring (`SPRING_STIFFNESS`, `RISE_DAMPING`, `SINK_DAMPING`). Momentum heading the old way is dropped when the target flips, and hiding waits `HIDE_DELAY` (0.2s) after the pointer leaves.
  - Don't swap the springs for an eased curve with overshoot: run in reverse, it makes the crew leap up before sinking.
  - The bob and wave phases are advanced by speed × dt each frame. Don't compute `sin(time × speed)` with a changing speed; that made the crew jitter on quick hovers.
  - It rebuilds when progress changes.
  - The placeholder models are in `menuModels.ts`. Only tech ids listed in `MENU_TECH` get a model, each with a width for row spacing.
- **Globe texture:** `assets/mars.jpg` is a 4096×2048 equirectangular image stitched from Mars Trek tiles.
- **Unused file:** `lib/marsEphemeris.ts` gives the real Mars orientation and Sun/Earth directions for a date, using JPL Keplerian elements and the IAU 2009 rotation model. Nothing uses it yet.
- **React dedupe:** `vite.config.ts` sets `resolve.dedupe: ["react", "react-dom"]`. Without it, Windows drive-letter casing can bundle React twice and crash hooks. Keep it.
- **Tailwind v4** via `@tailwindcss/vite`. There is no `tailwind.config`; the theme tokens, plus the `animate-float` and `animate-wiggle` animations, are in `src/index.css`.
- **Dark theme everywhere:** `<html class="dark">` is set in `index.html`, so the `.dark` tokens are the real palette. `primary` is teal (actions), `mars` is orange (branding, used as `text-mars` / `bg-mars`), and the radius is 1rem. `--font-heading` is Fredoka (rounded) and body text stays Figtree.
- **shadcn** uses the `base-maia` style, built on **Base UI** (`@base-ui/react`), not Radix. `cn` is re-exported from the `cn` package in `src/lib/utils.ts`, not clsx/tailwind-merge. Add components with `npx shadcn add <name>` from `game/`; they land in `@/components/ui`. ESLint's `react-refresh/only-export-components` rule is off for that folder, because generated files export helpers.
- `@/*` → `game/src/*` (set in both `vite.config.ts` and `tsconfig.app.json`).
- TS has `erasableSyntaxOnly`, so `enum`, `namespace` and constructor parameter properties are not allowed. Use union types or `as const` objects. `verbatimModuleSyntax` requires `import type` for type-only imports. `noUnusedLocals` and `noUnusedParameters` are on.
- State is managed with **Zustand** 5.

## Tooling

- **Project skills** in `.claude/skills/`: `pixijs` (Pixi v8 reference) and `pixijs-3d` (`@pixi/3d`). Load `pixijs` before writing Pixi code. `@pixi/3d` is not installed; the 3D menu uses three.js. `.agents/skills/` holds the same skills for other agents, and `skills-lock.json` pins their versions.
- **shadcn MCP server**, set up in `.mcp.json`: use it to search for and add shadcn/Base UI components.

## Planned architecture

- **`src/sim/`** is pure TypeScript with no React or Pixi.
  - `types.ts` is the shared contract every lane imports.
  - There's one Zustand vanilla store (`createStore`), persisted to localStorage so era progress survives reloads. There are no accounts.
  - A fixed-step `tick(dt)` runs from Pixi's ticker, in this order: pawn AI → resources → events → research → era-end check.
- **Reading and writing state:** Pixi reads the store imperatively each frame (`getState()`). The React HUD reads it through hooks. Player input only writes to the store, for example by assigning a task to the selected astronaut, and the AI carries the task out.
- **`src/content/`** holds plain data tables (modules, research, eras, sites, codex) so non-coders can tune balance.
- **`src/data/`:** `getSpaceWeather()` is the only entry point for space-weather events. It currently returns curated **real** DONKI events from embedded JSON, flagged `source: "historical"`. A live API is on hold. If it's added later, it goes behind this function (e.g. a Vercel function at `game/api/`).
- **`src/ai/`** (pawn pathfinding and task execution) is owned by one teammate. Its entry point is `updatePawns(state, dt)`.
- **Two Pixi views:**
  - a planet overview on Mars Trek tiles, where the player picks a landing site (Jezero, Arcadia Planitia, Gale)
  - a local base view
- **Controls:** direct control (click an astronaut, then a task). Time runs in real time with pause and 1×/2×/3× speed, and auto-pauses on events.

## Main menu

- **Look:** keep the three.js globe, but make the UI bigger and kid-friendly. Rounded font (Fredoka/Baloo style). Dark space, Mars orange, and a bright teal accent.
- **Title:** a NASA-style mission-patch logo badge.
- **Buttons:** Play, Continue, How to Play, Mars Codex, Settings, Credits. With no save, Continue and Codex are greyed out with a lock and "Play your first mission to unlock!"
- **Globe:** drag to spin, with tappable fact pins.
- **Crew:** 3D astronauts pop up from behind the Play button when it's hovered or focused, and hover in a row on top of it. A new player sees 1 astronaut; crew and tech unlocked in the game join the row, so the menu reads the saved progress.
- **Play:** the camera zooms into Mars and hands off to the Pixi planet overview.
- **Audio:** music and button sounds come from the team's audio files, with a mute toggle and volume settings.
- **Codex:** the globe pins and the Codex share one table in `src/content/codex.ts`. Each entry is a real NASA fact with its source. The Codex dialog lists the ids in `progress.codexIds`.

## Game design constraints (from the challenge rules)

- The player manages only **Oxygen, Water, Food**. Metal, stone and ice are simple counters. Water is the hub: ice → water → drinking, greenhouse (food) or electrolysis (oxygen).
- Every choice must cost something; no option is free. Radiation (solar flares) is a per-astronaut dose plus forced sheltering, not a fourth colony bar.
- Real NASA data must be **attributed in-game**, and stored data must never be presented as live. The menu footer and Credits already credit the Mars imagery; keep that pattern.
- Use plain language. Explain unavoidable terms (sol, radiation dose) where they appear.
- An era ends on goal-met or any bar hitting zero, which triggers evacuation (there's no death). Tech and codex carry over, and materials only as far as the limited cargo allows. Cheap modules decay into ruins; expensive ones become damaged but repairable.

## External assets

- **Mars Trek tiles** (CORS-enabled, so they can be loaded at runtime): `https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/{z}/{row}/{col}.jpg`. Tiles are 256px and equirectangular. Zoom level `z` has `2^z` rows × `2^(z+1)` columns. Credit: NASA/JPL/USGS Mars Trek.
- **Audio:** NASA nebula sonifications and two Pixabay tracks are in `game/public/audio/`, served at `/audio/...`.
  - `src/lib/sound.ts` plays the menu music (`leberch-space`) and makes the UI blips by cutting short slices from one sonification. The cut points are in its `SFX` table and are tuned by ear.
  - Browsers block audio until the player interacts, so nothing plays before `unlockAudio()` runs from a click or key press.
  - `public/audio/Cresdits.txt` (sic) is still empty, and the exact audio credit lines in `MenuDialogs.tsx` need confirming.
- `.gitignore` excludes `*.blend1`. Blender is the planned source for the sprite-stack slices and the menu's 3D crew and tech models.

## Hosting

Vercel, with the project **Root Directory set to `game`**. There's no `vercel.json`; it was removed deliberately.
