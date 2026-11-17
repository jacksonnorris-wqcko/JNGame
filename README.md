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

Visual asset build: **0.7.0**. Game assets are stored under `public/assets/`.


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

## Cost

The solo prototype can be developed and hosted as a public GitHub Pages project without a paid game server. Babylon.js is open source. Any future paid art/audio assets or optional hosted services would be a separate decision; nothing paid is required to test this solo alpha.

## Current limitations

This is a playable prototype foundation, not a finished hunting simulator. It currently uses procedural low-poly models, a compact test region and simple wildlife behaviour. It does not yet contain detailed animal animations, ballistic drop/wind, weapon variants, deep ecology, missions beyond the first contract, cloud saves, accounts or multiplayer. Those will only be considered after the solo game loop is enjoyable and stable.

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
