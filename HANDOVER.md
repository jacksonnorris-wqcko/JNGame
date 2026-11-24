# JNGame / Wildrange — Development Handover

**Updated:** 18 November 2026  
**Repository:** https://github.com/jacksonnorris-wqcko/JNGame  
**Working branch:** `main`  
**Current source build:** `0.11.4`  
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

## 0.8.24 start-screen parser fix

The title screen remained visible because a duplicate `const lanternLight` declaration made `public/game.js` fail at parse time. The browser therefore never registered the Start button click handler. One duplicate declaration was removed and the full game source passed a JavaScript parser check.

The index and play entry points now load 0.8.24. The Playwright smoke test additionally asserts that the start screen becomes hidden after clicking Start, rather than only checking whether a scene object exists.

## 0.9.0 authored surface and lighting pass

This pass addresses the remaining "primitive assembly" look by changing the material and rendering foundations:

- Replaced the 84 individual roof shingle boxes with two continuous roof shells using a custom generated cedar-shingle albedo texture and generated normal map.
- Smoothed cabin log cylinders from 10 to 24 radial segments, extended the side courses through the corners, and added separate end-grain faces. The expected cut-face count is 94.
- Added UVs to the triangular gable faces so they use the PBR timber siding maps.
- Replaced coarse ico-sphere tree crowns with smoother sphere geometry for broadleaf and pine forms; smoothed trunk profiles.
- Rebuilt perimeter fence uprights as tapered timber sections with octagonal stone footings and rounded rails that follow the terrain; original spacing and collision layout are preserved.
- Increased the compound shadow map to 1536 and registered the Pinecrest lodge and woodshed child meshes as shadow casters.
- Added browser and CI checks for roof material readiness, log end-grain count, shadow-map size and registered compound shadow casters.
- Bumped the browser asset version to 0.9.0.

The 0.9.0 pass is intended as the beginning of the asset/material quality phase. It does not yet replace the cabin with an external detailed architecture GLB; any external GLB candidate needs to be downloaded, inspected, licensed and tested for fit before integration. A successful Actions run and visual browser review are still required before calling this release verified.

## 0.10.1 authored 3D environment model pass

This is the first pass that integrates larger, authored GLB architecture and vegetation assets into the compound:

- Pinecrest Lodge loads the CC0 Innerscene log-cabin model from `public/assets/buildings/pinecrest-lodge.glb`. The model contains interlocking round logs, crossed corners, log gables, a shingled apex roof, barge boards, two windows and a glazed door. The imported mesh is fit to the existing lodge footprint. Existing interior furniture, Wildrange's interactive hinged door, signage, porch and compound access systems remain in place.
- Four hero trees are instantiated from two CC0 assets: two detailed-needle conifers and two individually modelled-leaf linden trees. Remaining distant forest geometry uses the existing procedural system.
- Each imported tree is material-batched during instantiation. The CC0 sources contain about 1,551 conifer geometry nodes and 625 linden geometry nodes; batching reduces those to a small set of render meshes per tree while preserving the materials and high-detail geometry. Diagnostics record both source mesh and final render mesh counts.
- The procedural cabin/forest remains as a fallback if any downloaded model is unavailable.
- `scripts/download_licensed_3d_assets.sh` downloads the three binary GLBs from Innerscene and validates the glTF 2.0 header and file size.
- Both CI jobs and the GitHub Pages workflow run the asset downloader before tests/deployment.
- Playwright now waits for the imported lodge and four hero trees, checks that the new model assets are usable, and captures `artifacts/wildrange-0.10.1-compound.png` for visual verification.
- The asset manifest and model provenance record the CC0 licenses and sources.

## 0.10.1 performance and verification follow-up

- Hero-tree mesh batching is now performed per instance and per material before applying world placement. The expected total source geometry count is greater than 4,000 across the four hero trees; the final render mesh count must remain between 8 and 40.
- The imported static lodge door leaf, glazing and its static hardware are explicitly hidden so the existing interactive Wildrange door remains the only visible leaf.
- Browser smoke test now reads the title-screen state through the page DOM, captures a preflight screenshot, clicks the real Start button and waits for the start overlay to close. It also uploads artifacts from failures so the title and in-game compound can be inspected.
- The old CC0 texture-import workflow now only imports/commits PBR textures and HDRI. It no longer attempts a second Pages deployment; pages.yml is the single publishing workflow.
- Browser asset cache-busters and title version are 0.10.1.

## 0.10.0 files and integration points

- `public/game.js`: `loadPinecrestLodgeModel()`, `loadPinecrestHeroVegetation()`, asset diagnostics and fallback handling.
- `scripts/download_licensed_3d_assets.sh`: reproducible build-time asset downloads and GLB validation.
- `public/assets/asset-manifest.json`: model provenance, license and expected paths.
- `public/assets/models/ATTRIBUTION.md`: source/CC0 record.
- `.github/workflows/ci.yml` and `.github/workflows/pages.yml`: download assets during validation and deployment.

The 0.10.0 source has been parser-checked. The actual GLB downloads and browser screenshot must still be verified by the GitHub Actions run before declaring the deployed scene visually approved.

## 0.10.2 QA correction and current status

The 0.10.1 headless browser run successfully loaded the title screen, started the game, and passed the high-fidelity material/shadow diagnostics. It reported 44 fence rails against an expected 48. Investigation found four gate rails were excluded by the diagnostics regular expression because their mesh names were `compound gate lower/upper rail`, without the word `fence`. The four rails existed in the scene; the names have been standardised to `compound gate fence lower/upper rail`. No fence geometry or collision layout was changed.

The 0.10.1 title preflight screenshot was successfully captured. The compound screenshot assertion was not reached because the fence diagnostic aborted the run. 0.10.2 reruns the browser test with the corrected naming, verifies all 48 fence rails and continues to the lodge and hero-tree asset readiness checks.

## 0.11.0 Pinecrest Lodge architectural redesign

The primary lodge asset is now Grab3D's Mountain Hut (CC0 1.0 Universal) rather than the stretched 3 x 3 m Innerscene cabin.

- Asset: `public/assets/buildings/pinecrest-mountain-hut.glb`
- Source: https://grab3d.com/models/buildings/mountain-hut/
- License: CC0 1.0 Universal.
- Model source dimensions: 13.76 × 12.15 × 7.07 m.
- Source geometry: 37,766 triangles, 2K PBR maps for base colour, roughness, metallic and normal.
- Architectural elements: rubble-stone ground floor, dark timber upper floor/gable, weighted shingle roof, stone chimney, shutters, windows and raised terrace.
- Runtime fit: one uniform scale is calculated from target X/Y/Z bounds, preserving the authored aspect ratio. Model is centred on the existing Pinecrest root, base aligned to ground.
- Fallback: the prior Innerscene log cabin remains loaded if the Mountain Hut GLB cannot be fetched or imported.
- Legacy procedural porch platform, individual deck boards, stairs, canopy, balusters, handrails, porch braces, rain gutters/downpipes and stove flue are hidden for the primary Mountain Hut so its own terrace and roof details are not doubled.
- The game continues to use the existing Wildrange interior, gameplay systems and interactive door.

The build script downloads the model from Grab3D's direct GLB endpoint and validates file size, glTF magic, version 2 and declared file length. CI checks the primary asset path and its CC0 provenance. Browser QA requires the Mountain Hut to load without fallback and verifies its final dimensions and uniform scaling before capturing the compound screenshot.

## 0.11.2 Mountain Hut entrance and interior alignment

This follow-up makes the existing player and lodge interaction systems follow the real imported model transforms instead of the previous hand-built cabin coordinates.

### Interior

- A dedicated `lodgeInteriorRoot` groups the custom floorboards, interior wall panels, battens, furniture and decor.
- When the Mountain Hut loads, `lodgeInteriorFloorHeight` and `lodgeDeckSurfaceHeight` are calculated from the authored source floor height multiplied by the model's uniform scale. The custom interior group and warm interior lights are shifted to that floor.
- Old interior wall panels and battens that conflict with the Mountain Hut's own wall/window system are hidden with the legacy shell.

### Entrance and movement

- `lodgeDoorWorldPosition` is derived from the imported `mountain-hut_door_l` pivot's absolute world position after the lodge root transform is applied.
- The LODGE DOOR interaction target is moved to within 0.85 m of the physical pivot.
- `lodgeDoorwayContains()` is shared by the closed-door collision and the open doorway walk-through.
- `walkSurfaceAt()` and `canStandAt()` now use the imported interior floor and terrace heights, with the approach steps interpolating up to the terrace. The old cabin's 1.335 m deck assumption is removed for the Mountain Hut.
- The test teleport into the lodge is placed at the calculated interior floor height.
- Because the static world is frozen before asynchronous GLBs finish loading, the interior group's descendant meshes are explicitly unfrozen and recomputed after the floor offset is applied. The browser test requires at least 20 adjusted interior meshes through `lodgeInteriorAdjustedMeshCount`.

### First view

- New-game spawn retains the existing position but sets its yaw toward the Pinecrest Lodge centre.
- Untouched saved games at the original spawn coordinates/yaw are migrated to the same heading. Other saved player positions and view directions are preserved.
- Browser QA checks the initial camera heading, the imported doorway when closed/open, the interaction target distance, interior floor, terrace, steps and entry path.

## 0.11.3 screenshot-driven removal of duplicate Pinecrest cabin geometry

The 24 November gameplay screenshot showed the imported Mountain Hut and the previous procedural lodge rendering simultaneously. The old cleanup patterns were incomplete: notably `Pinecrest continuous cedar shingle roof surface`, the old chimney, the entire old lodge sign portal, outpost flag and several entry/porch objects were not hidden.

### Cleanup

- `LEGACY_LODGE_SHELL_PATTERN` now includes the old continuous cedar roof panels, roof fascia/ridge/rafters, gable details, chimney blocks/cap/flue, log courses/end-grain, old window components, full lodge sign assembly, old gutters/downpipes and outpost flag/pole/stripe.
- `LEGACY_LODGE_PORCH_PATTERN` now includes old platform/deck, porch posts/caps/braces/rails, steps/nosings, entry stair handrails, door jamb/recess/lintel, porch lanterns and the simple cube-bodied entrance lanterns.
- `hideLegacyCabinExterior()` and `hideLegacyLodgePorch()` unfreeze affected meshes where necessary, set `isVisible=false` and disable them.
- The old porch/entry/compound light sources are disabled with their old housings for the Mountain Hut; they must not illuminate empty fixture positions.
- The outpost gate sign, outfitter signage, harvest signage, firewood shelter, trough, fence, compound board and independent lodge interior are retained.

### Replacement nameplate

`createMountainHutNameplate()` creates a smaller wall-mounted, brass-edged Pinecrest Lodge plaque. Its placement is computed from the imported door leaf's actual world-space bounds, then converted into the Mountain Hut's local coordinates. It is no longer carried by the previous cabin's tall sign portal.

### Diagnostics and QA

- `lodgeModelLegacyVisualStats` reports remaining visible legacy roof, sign, chimney, porch, flag and lantern meshes. Browser QA requires all counts to equal zero after the Mountain Hut loads.
- `lodgeModelHiddenLegacyMeshCount` and `lodgeModelHiddenLegacyPorchCount` record the number of old meshes disabled.
- QA checks the new mounted nameplate is ready and visibly renderable, and that no old raised sign posts remain enabled.
- The browser smoke screenshot is `artifacts/wildrange-0.11.3-compound.png`.

This pass is a corrective cleanup for the visibly mixed architecture in the supplied screenshot. It does not certify the remaining outfitter, woodshed, terrain or wildlife as final-quality assets; those need their own coherent art passes.

## 0.11.4 gate-centred first-person spawn

The supplied screenshot showed the hunter standing to the right of the south gate opening and looking diagonally across the nearest fence rails. Fresh games now spawn at `(-14, 19)` with yaw 0, centred on the gate passage and facing straight toward Pinecrest Lodge. The gate/fence geometry and collision layout are not moved.

- Untouched legacy saves at approximately `(0, 19)` are migrated if their yaw is either the original 0 or the previous Pinecrest-facing angle `atan2(-14, 24)`.
- The migration updates X to -14 and yaw to 0, retaining Z, inventory and progression.
- Existing saves where the player has moved are unchanged.
- `WildrangeQA.cameraPosition()` exposes spawn X/Z for browser verification.
- Playwright asserts X=-14, Z=19 and yaw=0.

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
