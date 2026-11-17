# JNGame — Mythvale Online

**Mythvale Online** is the first playable foundation for JNGame: a browser-based, top-down fantasy MMO prototype with a shared server world.

## What is in the first build

- Real-time multiplayer movement and a shared world state over WebSockets.
- Persistent character names, positions, levels, XP, gold, health and quest progress.
- A camera-following 2D world with Moonhaven village, roads, buildings, a pond and surrounding meadows.
- Player chat, nearby-player visibility and a live online count.
- NPC interactions, a five-slime starter quest and a potion merchant.
- Basic combat, creature AI, respawns, XP, level-ups, gold drops and health potions.
- Inventory, character overview, local map and world map.
- Keyboard movement and click-to-move controls.

## Run locally

Requires Node.js 20 or later.

    npm install
    npm run dev

Open http://localhost:3000 in a browser. Open a second browser window (or another device on the same network) to test multiplayer.

For a production-style local run:

    npm start

The server exposes a health check at /health.


## Browser testing with GitHub Pages

The browser client is published from the `public/` folder by the GitHub Pages workflow. After enabling Pages once (see below), every push to `main` republishes the site.

Expected browser address:

https://jacksonnorris-wqcko.github.io/JNGame/

GitHub Pages hosts static HTML, CSS and JavaScript only. It cannot run the Node.js WebSocket game server, so the multiplayer world must also be deployed as a separate web service.

### Enable the browser website

1. Open this repository's **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Open the **Actions** tab and check the **Deploy Mythvale to GitHub Pages** workflow.
4. Once it succeeds, visit the browser address above.

### Connect the live MMO server

1. In Render, create a new **Web Service** from this repository. The included `render.yaml` configures Node, `npm install`, `npm start`, and the `/health` check.
2. Wait for Render to provide the service's public `onrender.com` address.
3. Open the GitHub Pages game website. On the title screen, enter that Render address in **World server address**, then enter the world.
4. The address is remembered in that browser. Alternatively, append `?server=https://YOUR-SERVICE.onrender.com` to the Pages URL to prefill it.

Render's free web services can spin down after inactivity, so the first connection after a quiet period may take a little while. The prototype currently stores characters in a local JSON file; on a free service that data is not guaranteed to survive service replacement/redeploy. A durable database is a later milestone. Do not add a paid disk or plan without checking its price first.

## Deploy

This is a Node.js application with a persistent WebSocket connection. It needs a host that supports long-running Node processes and WebSockets (for example, Render or Railway). It is not a static-only GitHub Pages app.

A Render Blueprint is included as render.yaml. Connect this repository to Render and deploy the Blueprint. The character file is written to data/characters.json; attach a persistent disk mounted at /opt/render/project/src/data before using the deployment as a long-term world. Without persistent disk storage, saved characters may be lost when the host replaces the service instance.

## Controls

| Action | Control |
| --- | --- |
| Move | W A S D / arrow keys |
| Click-to-move | Click a destination on the ground |
| Attack | Space |
| Talk / interact | E |
| Use health potion | 1 |
| Inventory | I |
| Wave | G / Wave button |

On touch devices, use the action buttons and tap the world to move.

## Current scope and next milestones

This is an **early MMO foundation**, not a finished large-scale MMO. The current server is authoritative for movement, creature damage, XP, loot and quest rewards, but it is a single-process prototype with a lightweight JSON character store and no account authentication, database, anti-cheat, party/guild systems, trading, dungeons or world sharding yet.

Suggested next milestones:

1. Accounts, secure character ownership and a real database (PostgreSQL).
2. Server-side world persistence, instance/shard management and reconnect recovery.
3. Combat depth: classes, abilities, equipment, loot tables and enemy variety.
4. Social systems: parties, friends, guilds, whispers and trading.
5. Content: more regions, quest chains, bosses, dungeons, crafting and gathering.
6. Automated tests, monitoring, rate limits and production security hardening.

## Project structure

- server.js — HTTP server, WebSocket protocol, authoritative world simulation and character persistence.
- public/index.html — game interface.
- public/styles.css — responsive HUD and visual theme.
- public/game.js — canvas rendering, input, interface and client networking.
- data/characters.json — generated character save file (not committed).

Built for JNGame. Alpha 0.1.0.


## Test in your browser with GitHub Codespaces

No local Node.js installation is required.

1. Open the repository on GitHub: https://github.com/jacksonnorris-wqcko/JNGame
2. Select the green **Code** button, then open the **Codespaces** tab.
3. Select **Create codespace on main**.
4. The Codespace installs the project dependencies and starts the game server.
5. When port **3000** is detected, Codespaces opens the Mythvale game in a browser tab. If it does not open automatically, select the **Ports** panel, then open the forwarded port 3000.

The forwarded port is private to your Codespace by default. Use the same browser to open another tab/window if you want to check the game again; to test multiplayer with two separate characters, use a second browser profile or a separate player ID.

Codespaces has usage quotas and may require billing depending on your account and usage.
