# JNGame — Wildrange

**Wildrange** is the new direction for JNGame: a stylised, first-person hunting adventure built to become playable solo before multiplayer is considered.

## Solo alpha foundation

- First-person 3D world rendered with Babylon.js.
- Pinecrest Valley: a small backcountry hunting region with forest, clearings, a trail, Stillwater Lake and a lodge outpost.
- WASD movement, mouse look, sprinting, crouching, aiming, rifle fire and reloading.
- Whitetail deer, bucks and wild boar with species-specific awareness and flee behaviour.
- Fieldcraft: crouching reduces movement noise and detection range; trail scent masks the hunter for 45 seconds.
- Tracking follows actual hoof-sign positions, displays sign freshness, and lets old tracks fade.
- Raycast shooting, shot distance and placement reports, plus a first-shot headshot clean-harvest bonus.
- Wildlife tracking sense with direction, range and visible hoof tracks.
- First Harvest contract, hunter XP/levels, funds and harvest inventory.
- Outfitter for ammunition, field kits and trail scent.
- Harvest station for selling hides and meat.
- Local save in the current browser using localStorage.
- No login, backend, multiplayer server or paid hosting required for this stage.

## Play in a browser

The browser build is published through GitHub Pages from the `public/` folder.

Expected address:

https://jacksonnorris-wqcko.github.io/JNGame/

If Pages has not been enabled for this repository yet:

1. Open **Settings → Pages**.
2. Set **Source** to **GitHub Actions**.
3. Open **Actions** and check the **Deploy Wildrange to GitHub Pages** workflow.
4. Once the deployment succeeds, open the URL above.

The first load needs an internet connection because the prototype loads Babylon.js and fonts from their public CDNs. Game progress is stored only in the browser/device where you play it. Clearing site data or switching browsers will not transfer the save.

## Controls

Current browser build: **0.9.0**. Game assets are stored under `public/assets/`.


| Action | Control |
| --- | --- |
| Move | W A S D |
| Jump | Space |
| Look | Mouse |
| Aim | Hold right mouse button |
| Fire | Left mouse click |
| Reload | R |
| Track recent hoof-signs | Q |
| Crouch / move quietly | C |
| Use trail scent (one vial, 45 seconds) | G |
| Interact / harvest / use stations | E |
| Sprint | Hold Shift |
| Use field kit | F |
| Field map | M |
| Pause | Escape |

Click the game view once to capture the mouse. Press Escape to release it and open the pause menu.


## Graphics overhaul — 0.3.0

The 0.3.0 visual pass upgrades Pinecrest Valley without external paid assets:

- Procedural ground, dirt-trail, water and bark textures generated in the browser.
- A panoramic sky dome with layered cloud wisps and a moving sun.
- More natural layered pine and broadleaf canopies, animated lightly in the wind.
- 1,050 vertex-coloured meadow grass tufts and 34 undergrowth clusters.
- Distant low-poly mountain ridges to give the reserve a stronger horizon.
- Animated lake ripples and improved water surface material.
- Directional lighting, softened shadows, FXAA, ACES tone mapping and subtle bloom.
- More detail on the Ranger .308 scope and receiver.

The graphics remain procedural and local: no paid texture packs, hosted art services or extra game server are required. The extra foliage and post-processing are intended for desktop Chrome; performance still needs confirmation on different hardware.


## Environment and foliage overhaul — 0.5.0

Asset validation: the CI workflow checks the locally hosted HDRI and required PBR maps before accepting the build.


The 0.5.0 pass separates HDR image-based lighting from the visible sky, adds a controlled dawn sky with layered clouds, builds two distant mountain ridge bands, increases terrain heightfield detail and meadow coverage, and replaces the black leaf-atlas pattern with generated pine-needle and broadleaf textures. The detailed outpost, PBR surfaces, animal systems and solo hunting loop remain in place.

The material and HDR downloads are imported by `.github/workflows/import-cc0-assets.yml` into `public/assets`. The textures are CC0 assets from ambientCG and the forest HDRI is from Poly Haven. The browser loads the files from the repository; no texture CDN, account, paid asset or runtime asset service is required.

## Rifle & wildlife overhaul — 0.6.0

The 0.6.0 update rebuilds the Ranger .308 first-person model with a shaped walnut stock, recoil pad, receiver, ejection port, bolt assembly, trigger guard, pistol grip, detachable magazine, fore-end, free-floating barrel, muzzle brake, mounted optic, objective/ocular bells and adjustment turrets. Holding right mouse raises a scoped sight picture; the camera zooms through the centre reticle and the mouse wheel switches between 2x, 4x, 6x and 8x magnification.

Deer and boars have upgraded body proportions, articulated two-section legs, visible joints and hooves, movable heads, ear and tail motion, deer antlers and boar tusks/bristles. Their walking, grazing and fleeing states now drive the limb/head/tail animation. This remains an in-engine procedural model pass, not imported motion-captured animal models.

## Living world and movement — 0.7.0

This update adds Space-to-jump with gravity, landing detection and a mobile jump button. Movement uses acceleration/deceleration and axis sliding. The renderer will also receive a fixed-step physics update and static-scene optimizations in this release.

## Performance and movement — 0.7.1

The game now uses fixed 60Hz simulation steps, a capped high-DPI render scale, static world transform freezing, lower shadow-map resolution and disabled bloom to reduce frame pacing spikes and GPU work. Performance remains dependent on the PC and browser.

## Living world and movement — 0.7.3

Adds Space-to-jump with gravity, landing detection and mobile jump control. Player motion now uses acceleration/deceleration and collision sliding; the game simulation runs at a fixed 60Hz while rendering once per browser frame. High-DPI render scale, static-world transform freezing, shadow resolution and bloom are adjusted to reduce unnecessary GPU work.

The current deer and boars remain procedural models, but the next wildlife pass will add distinct alert, flee and charge states, more stable turning, richer locomotion and more natural head/ear/tail motion.

## Living wildlife — 0.7.2

Deer now have an alert phase before fleeing, with stable escape directions and smoother turns. Boars have distinct warning and charge behaviour. A fixed-step gait clock drives leg movement, head turns, ear flicks, tail motion and subtle breathing. Hoof signs are created less often and only near the hunter to reduce scene churn. Wildlife remains procedural rather than imported skeletal assets.

## Browser verification — 0.7.3

The automated Chrome test now waits for a visible upward movement before checking jump state, then allows enough time for the player to land on slower software-rendered CI machines. It still verifies that the scope is visible, magnification changes from 4x to 6x, the 3D renderer and PBR assets load, and the gameplay/UI bindings are present.

## Cabin and compound finish — 0.8.21

The 0.8.21 visual pass closes the gaps between the Pinecrest lodge's front log courses with textured, opaque timber backing while preserving the doorway and front window panes. The logs are slightly thicker so the courses overlap rather than reading as open slats.

The Pinecrest Outpost nameboard now has two ground-bearing timber support posts, stone footings, post caps, iron straps, knee braces and a framed sign panel. The over-door Pinecrest Lodge plaque also has visible mounting cleats and a lower support. The porch posts now have matching timber knee braces.

The lighting pass lifts ambient fill and exposure slightly to reveal more timber and compound detail without enabling the more expensive bloom effect. The browser smoke test now checks that both gate support posts and both front wall backing panels exist.

## Pinecrest compound living-world pass — 0.8.22

The 0.8.22 pass expands the outpost beyond basic building geometry:

- The lodge gables now have exposed timber trusses, collar ties, king posts and louvered vents. The Pinecrest Lodge plaque now sits inside a timber portal with two uprights, a structural header, knee braces, stone shoes and iron straps.
- Metal gutters, forged brackets and downpipes finish the roof edges and give the cabin a believable rainwater system.
- The front windows have timber flower boxes, iron brackets and layered foliage.
- A new working firewood shelter adds stone footings, structural posts, slatted rear boards, a pitched roof, exposed rafters, individually stacked split logs with cut ends, a tool rack and warm lantern light.
- A timber water trough with a visible water surface sits beside the shelter.
- Low native fern groups and hand-set fieldstones soften the yard and edge the entrance pavers.
- Additional tests check the new compound detail counts and confirm the woodshed and trough do not become walk-through props while the service path remains clear.

The intent is to make Pinecrest read as an occupied ranger outpost with a coherent architectural style, not a collection of isolated props. The new meshes are created before the static-scene freeze and use existing local PBR materials.

## Startup regression fix — 0.8.23

The 0.8.22 compound-pass wiring accidentally left the original cabin/access/wildlife initialisation calls after the new compound-pass insertion. The scene therefore constructed the lodge and wildlife twice. The 0.8.23 fix restores a single ordered initialisation pass: create the cabin, build access paths, dress the compound, create wildlife, then merge static scenery. The browser smoke test now validates single-instance cabin, gate and woodshed support counts immediately after starting a new game.

## Startup parser fix — 0.8.24

The 0.8.23 compound visual pass had accidentally duplicated the porch lantern's `const lanternLight` declaration in `public/game.js`. This caused a parse-time SyntaxError, preventing the game script and Start button handler from executing. The duplicate declaration has been removed. The source was compiled with the JavaScript parser before committing 0.8.24, and the browser smoke test now explicitly waits for the title screen to hide after the Start button is clicked.

## Cabin and compound rendering foundation — 0.9.0

This is the first pass that replaces repeated primitive roof props with authored surface materials:

- The cabin roof is now two continuous roof shells using a hand-generated cedar-shingle albedo texture and tangent-space normal map. The former repeated box-shingle loop is removed.
- Cabin log courses use 24 radial segments, cross over at the corners and expose cut end-grain rings on the visible ends.
- Gable faces now carry UVs so the existing PBR timber siding maps render across the triangular surfaces.
- Broadleaf and pine canopy forms use smoother sphere meshes instead of coarse low-subdivision icospheres.
- The cabin and woodshed meshes are registered as actual directional-light shadow casters; the shadow map is enlarged to 1536 pixels.
- The browser test checks the authored roof material, two roof surfaces, 94 log end-grain faces and compound shadow casters.

This pass deliberately removes primitive roof clutter rather than adding another set of props. It is a material, silhouette and lighting foundation; imported high-detail architecture and vegetation assets remain a separate art-production step.

## Cost

The solo prototype can be developed and hosted as a public GitHub Pages project without a paid game server. Babylon.js is open source. Any future paid art/audio assets or optional hosted services would be a separate decision; nothing paid is required to test this solo alpha.

## Current limitations

This is a playable prototype foundation, not a finished hunting simulator. It currently uses procedural terrain and scenery, imported rigged wildlife and rifle models, a compact test region and relatively simple wildlife behaviour. It does not yet contain ballistic drop/wind, weapon variants, deep ecology, a broad mission campaign, cloud saves, accounts or multiplayer. Those will only be considered after the solo game loop is enjoyable and stable.

## Project structure

- `public/index.html` — game shell and HUD.
- `public/styles.css` — responsive visual interface.
- `public/game.js` — 3D scene, world simulation, wildlife, controls, progression and local saves.
- `public/favicon.svg` — project icon.
- `.github/workflows/pages.yml` — static GitHub Pages deployment.
- `.github/workflows/ci.yml` — basic browser-build validation.

**Development order:** make the solo hunting loop genuinely fun, polish the wildlife and weapon feel, expand the world and progression, then decide whether multiplayer is worth adding.

## First-run help

When you start a new hunt, you begin at Pinecrest Outpost beside the contract board. Press **E** to accept the First Harvest contract. Head into the valley, use **C** to crouch before approaching wildlife, and press **Q** to inspect recent hoof-signs. Buy trail scent at the outfitter and press **G** to use a vial when you need extra cover. Aim with the right mouse button and fire with the left mouse button. A first-shot headshot earns a clean-harvest bonus. Approach a downed animal and press **E** to harvest it, then return to the harvest station to sell your hides and meat. Press **M** for the field map and **Escape** to close it.
