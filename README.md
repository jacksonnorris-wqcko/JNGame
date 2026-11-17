# JNGame — Wildrange

**Wildrange** is the new direction for JNGame: a stylised, first-person hunting adventure built to become playable solo before multiplayer is considered.

## Solo alpha foundation

- First-person 3D world rendered with Babylon.js.
- Pinecrest Valley: a small backcountry hunting region with forest, clearings, a trail, Stillwater Lake and a lodge outpost.
- WASD movement, mouse look, sprinting, aiming, rifle fire and reloading.
- Whitetail deer, bucks and wild boar with simple wildlife wandering and flee behaviour.
- Raycast shooting, animal hits, clean takedowns and harvest interactions.
- Wildlife tracking sense with nearby-animal direction/range and visible hoof tracks.
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

| Action | Control |
| --- | --- |
| Move | W A S D |
| Look | Mouse |
| Aim | Hold right mouse button |
| Fire | Left mouse click |
| Reload | R |
| Track nearby wildlife | Q |
| Interact / harvest / use stations | E |
| Sprint | Hold Shift |
| Use field kit | F |
| Field map | M |
| Pause | Escape |

Click the game view once to capture the mouse. Press Escape to release it and open the pause menu.

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

When you start a new hunt, you begin at Pinecrest Outpost beside the contract board. Press **E** to accept the First Harvest contract. Then walk out into the valley, press **Q** for tracking sense, aim with the right mouse button, fire with the left mouse button, and approach a downed animal to harvest it with **E**. Return to the harvest station to sell your hides and meat. Press **M** for the field map and **Escape** to close it.
