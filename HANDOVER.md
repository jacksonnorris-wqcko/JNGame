# JNGame / Wildrange — Development Handover

**Updated:** 18 November 2026  
**Repository:** https://github.com/jacksonnorris-wqcko/JNGame  
**Working branch:** `main`  
**Current source build:** `0.8.23`  
**Game:** https://jacksonnorris-wqcko.github.io/JNGame/

## Product direction

Wildrange is a stylised first-person hunting adventure. The priority is a stable, enjoyable solo game loop before considering multiplayer. The current build is a browser-hosted alpha built with Babylon.js.

## Main project files

- `public/game.js` — Babylon.js scene, environment, cabin and compound geometry, wildlife, rifle, controls, hunting loop, progression and local saves.
- `public/index.html` and `public/play.html` — browser entry points. Both load the same versioned game and stylesheet assets.
- `public/styles.css` — HUD, title screen, menus and responsive interface.
- `public/assets/` — PBR textures, HDR environment and imported GLB wildlife and weapon assets.
- `scripts/browser_smoke_test.mjs` — Playwright browser smoke test.
- `.github/workflows/ci.yml` — syntax, asset, feature and browser validation.
- `.github/workflows/pages.yml` — GitHub Pages deployment.

Progress is currently stored in browser `localStorage`. There is no account system, cloud save service or multiplayer backend.

## 0.8.21 visual finish

The 0.8.21 pass responds to the Pinecrest Outpost screenshot:

- Increased the front, rear and side lodge log-course diameters so adjoining courses overlap instead of reading as open horizontal slats.
- Added two textured, opaque timber backing panels behind the front log courses. The panels stop either side of the doorway and sit behind the existing front window panes.
- Built the Pinecrest Outpost sign as a supported structure with two timber posts, stone footings, post caps, knee braces, iron straps, brass fixings and a framed signboard.
- Added movement blocking around the two sign posts while keeping the centre of the entrance clear.
- Added mounting cleats and a lower support to the Pinecrest Lodge plaque above the cabin door.
- Added knee braces and brass fixings to the porch support posts.
- Lifted ambient fill and tone-mapped exposure slightly to reveal more timber detail without enabling the more expensive bloom effect.
- Added diagnostics and Playwright checks for the two gate posts, two cabin backing panels and the clear gate passage.
- Bumped browser cache references to 0.8.21.
- Enabled GitHub Pages deployment on pushes to `main`, retaining manual dispatch as an option.

## 0.8.22 compound living-world pass

The 0.8.22 pass builds on the cabin and sign structural fixes:

- Exposed gable trusses, collar ties, king posts and louvered gable vents on both ends of the lodge.
- The Pinecrest Lodge plaque is carried by two timber uprights and a structural header, with knee braces, stone shoes, iron straps and brass fixings.
- Roof gutters with support brackets, four downpipes and outlet shoes.
- Two detailed front window flower boxes with iron brackets and layered planting.
- A dedicated firewood shelter on the east side of the yard with four structural posts, stone footings, rear slats, lean-to roof, rafters, stacked split logs and cut end grain.
- A side-mounted tool rack, lantern and warm point light at the shelter.
- A timber water trough with water surface and iron bindings.
- Five low fern clusters and stone edging along the approach pavers.
- A short service path between the woodshed and outfitter.
- New diagnostics and CI/Playwright assertions for the set dressing and collision clearance.

The compound pass is built in the buildPinecrestCompoundLife() helper and called after the established compound access paths but before wildlife creation and static-scene batching.

## Validation notes for 0.8.22

The latest source files and test assertions were checked after the updates, including the two Pinecrest Lodge sign uprights and the gate sign posts. This confirms that the expected geometry, diagnostics, cache-buster versions and regression checks are present in main. A completed GitHub Actions run and a visual browser review have not yet been confirmed; treat the release as source-committed until those checks are available.

## 0.8.23 startup regression fix

The compound pass introduced duplicated cabin, access-path and wildlife creation calls inside createScene(). This caused the lodge and its visual assemblies to be built twice. The duplicate calls have been removed. Scene startup now builds one cabin, one compound access layout, one living-world dressing pass, one wildlife population, then merges static scenery.

The Playwright smoke test now checks the single-instance support counts immediately after entering the world. The browser entry points load 0.8.23 assets.

## Validation status

The source, HTML cache references, smoke-test assertions, CI assertions and Pages workflow were checked in the repository after the changes. The available GitHub commit-status response did not return status records, so do not assume the latest CI or Pages deployment has completed successfully until the Actions run is checked.

## Next development priorities

1. Open the deployed 0.8.21 build and compare the cabin wall, gate sign and porch against the supplied screenshot.
2. Continue the wildlife art pass: verify deer and boar silhouettes, proportions, coat materials, head/ear/tail motion and animation transitions at normal gameplay distance.
3. Continue the first-person rifle pass: improve the visible silhouette, stock and receiver materials, optic proportions, bolt cycling, reload and recoil feel.
4. Revisit lighting, vegetation density and distant scenery only with frame-time checks so visual improvements do not reintroduce the earlier jitter.
5. Keep the browser smoke test and CI checks updated as visible geometry and interactions change.

## Release discipline

- Keep `index.html` and `play.html` game/style cache-buster versions matched.
- Update README and this handover when a meaningful build changes.
- Treat static source checks as necessary but not sufficient: verify the rendered game in a real browser before calling a visual issue fixed.
- Do not describe a build as deployed until the GitHub Pages workflow reports success and the live game is checked.
