import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "characters.json");
const PORT = Number(process.env.PORT || 3000);
const WORLD = { width: 2600, height: 1800 };
const TICK_MS = 50;
const SAVE_MS = 15000;

const NPCS = [
  { id: "rowan", name: "Elder Rowan", title: "Village guide", x: 1300, y: 805, kind: "elder" },
  { id: "mira", name: "Mira", title: "Potion keeper", x: 1390, y: 915, kind: "merchant" }
];

const mobSeeds = [
  { id: "moss-1", name: "Moss Slime", x: 860, y: 700 },
  { id: "moss-2", name: "Moss Slime", x: 930, y: 900 },
  { id: "moss-3", name: "Moss Slime", x: 760, y: 1040 },
  { id: "moss-4", name: "Moss Slime", x: 1690, y: 1020 },
  { id: "moss-5", name: "Moss Slime", x: 1810, y: 1140 },
  { id: "moss-6", name: "Moss Slime", x: 2020, y: 890 },
  { id: "moss-7", name: "Moss Slime", x: 610, y: 1250 }
];

const characters = new Map();
const activePlayers = new Map();
const mobs = new Map();
let lastSave = 0;

function safeName(value) {
  const cleaned = String(value || "Wanderer").trim().replace(/[^a-zA-Z0-9 _-]/g, "").slice(0, 16);
  return cleaned.length >= 3 ? cleaned : "Wanderer";
}
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function loadCharacters() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    for (const [id, character] of Object.entries(raw)) {
      if (character && typeof character === "object") characters.set(id, character);
    }
    console.log("Loaded " + characters.size + " saved characters.");
  } catch (error) {
    if (error.code !== "ENOENT") console.warn("Character save could not be loaded:", error.message);
  }
}

function storedPlayer(player) {
  return {
    id: player.id, name: player.name, x: Math.round(player.x), y: Math.round(player.y),
    level: player.level, xp: player.xp, gold: player.gold, hp: player.hp, maxHp: player.maxHp,
    inventory: player.inventory, quest: player.quest
  };
}

function saveCharacters() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    for (const player of activePlayers.values()) characters.set(player.id, storedPlayer(player));
    const temporary = DATA_FILE + ".tmp";
    fs.writeFileSync(temporary, JSON.stringify(Object.fromEntries(characters), null, 2), "utf8");
    fs.renameSync(temporary, DATA_FILE);
    lastSave = Date.now();
  } catch (error) { console.error("Could not save characters:", error.message); }
}

function createPlayer(id, requestedName, socket) {
  const saved = characters.get(id);
  const player = {
    id,
    name: safeName(saved?.name || requestedName),
    x: clamp(Number(saved?.x) || 1300, 50, WORLD.width - 50),
    y: clamp(Number(saved?.y) || 960, 50, WORLD.height - 50),
    direction: "down",
    level: Math.max(1, Number(saved?.level) || 1),
    xp: Math.max(0, Number(saved?.xp) || 0),
    gold: Math.max(0, Number(saved?.gold) || 0),
    hp: Math.max(1, Number(saved?.hp) || 100),
    maxHp: Math.max(100, Number(saved?.maxHp) || 100),
    inventory: { healthPotion: Math.max(0, Number(saved?.inventory?.healthPotion) || 1) },
    quest: {
      accepted: Boolean(saved?.quest?.accepted),
      kills: Math.max(0, Number(saved?.quest?.kills) || 0),
      claimed: Boolean(saved?.quest?.claimed)
    },
    move: { x: 0, y: 0 }, target: null, attackReadyAt: 0, potionReadyAt: 0,
    lastChatAt: 0, respawnAt: 0, emoteUntil: 0, socket
  };
  player.hp = Math.min(player.hp, player.maxHp);
  activePlayers.set(id, player);
  characters.set(id, storedPlayer(player));
  return player;
}

function xpToNext(player) { return 100 + (player.level - 1) * 65; }
function publicPlayer(player) {
  return {
    id: player.id, name: player.name, x: Math.round(player.x), y: Math.round(player.y),
    direction: player.direction, level: player.level, hp: player.hp, maxHp: player.maxHp, emoteUntil: player.emoteUntil
  };
}
function send(socket, payload) {
  if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}
function notify(player, message, tone = "normal") {
  send(player.socket, { type: "notice", message, tone });
}
function broadcastChat(message) {
  const packet = JSON.stringify({ type: "chat", message });
  for (const player of activePlayers.values()) {
    if (player.socket.readyState === WebSocket.OPEN) player.socket.send(packet);
  }
}

function isInPond(x, y) {
  const dx = (x - 1960) / 175;
  const dy = (y - 480) / 112;
  return dx * dx + dy * dy < 1;
}

function movePlayer(player, dt) {
  if (player.respawnAt > Date.now()) return;
  let dx = player.move.x;
  let dy = player.move.y;
  if (player.target) {
    const tx = player.target.x - player.x;
    const ty = player.target.y - player.y;
    const length = Math.hypot(tx, ty);
    if (length < 12) player.target = null;
    else { dx = tx / length; dy = ty / length; }
  }
  const length = Math.hypot(dx, dy);
  if (length < 0.01) return;
  dx /= length;
  dy /= length;
  if (Math.abs(dx) > Math.abs(dy)) player.direction = dx > 0 ? "right" : "left";
  else player.direction = dy > 0 ? "down" : "up";
  const speed = 220 * dt;
  const nextX = clamp(player.x + dx * speed, 28, WORLD.width - 28);
  const nextY = clamp(player.y + dy * speed, 28, WORLD.height - 28);
  if (!isInPond(nextX, nextY)) {
    player.x = nextX;
    player.y = nextY;
  } else {
    player.target = null;
    player.move = { x: 0, y: 0 };
  }
}

function awardXp(player, amount) {
  player.xp += amount;
  while (player.xp >= xpToNext(player)) {
    player.xp -= xpToNext(player);
    player.level += 1;
    player.maxHp += 12;
    player.hp = player.maxHp;
    notify(player, "Level up! You are now level " + player.level + ".", "success");
  }
}

function attack(player) {
  const now = Date.now();
  if (player.respawnAt > now || now < player.attackReadyAt) return;
  player.attackReadyAt = now + 650;
  let target = null;
  let nearest = Infinity;
  for (const mob of mobs.values()) {
    if (mob.hp <= 0) continue;
    const d = distance(player, mob);
    if (d < 92 && d < nearest) { nearest = d; target = mob; }
  }
  if (!target) {
    notify(player, "Move closer to a creature to attack.", "muted");
    return;
  }
  target.hp = Math.max(0, target.hp - 26);
  target.lastHitAt = now;
  if (target.hp === 0) {
    target.respawnAt = now + 12000;
    player.gold += 4 + Math.floor(Math.random() * 5);
    awardXp(player, 22);
    if (player.quest.accepted && !player.quest.claimed) player.quest.kills = Math.min(5, player.quest.kills + 1);
    if (Math.random() < 0.22) {
      player.inventory.healthPotion += 1;
      notify(player, "The slime dropped a health potion.", "success");
    } else notify(player, "Moss Slime defeated. You found some gold.", "success");
  }
}

function interact(player) {
  const npc = NPCS.find((person) => distance(player, person) < 100);
  if (!npc) {
    notify(player, "There is nobody close enough to talk to.", "muted");
    return;
  }
  if (npc.id === "rowan") {
    if (!player.quest.accepted) {
      player.quest.accepted = true;
      player.quest.kills = 0;
      player.quest.claimed = false;
      notify(player, "Elder Rowan: The meadow slimes are troubling our travellers. Defeat 5 Moss Slimes and return to me. Your reward is 140 XP and 60 gold.", "quest");
    } else if (player.quest.kills >= 5 && !player.quest.claimed) {
      player.quest.claimed = true;
      player.gold += 60;
      player.inventory.healthPotion += 2;
      awardXp(player, 140);
      notify(player, "Elder Rowan: You have done the village a great service. Take this reward, adventurer!", "success");
    } else if (player.quest.claimed) {
      notify(player, "Elder Rowan: The meadow is peaceful again. Keep your eyes open out there.", "quest");
    } else {
      notify(player, "Elder Rowan: " + player.quest.kills + " / 5 Moss Slimes defeated. The meadow lies beyond the western gate.", "quest");
    }
  } else if (npc.id === "mira") {
    if (player.gold >= 12) {
      player.gold -= 12;
      player.inventory.healthPotion += 1;
      notify(player, "Mira: One fresh health potion. That will be 12 gold.", "success");
    } else notify(player, "Mira: Health potions are 12 gold each. Come back when you have enough.", "quest");
  }
}

function usePotion(player) {
  const now = Date.now();
  if (now < player.potionReadyAt || player.respawnAt > now) return;
  if (player.inventory.healthPotion < 1) {
    notify(player, "You do not have a health potion.", "muted");
    return;
  }
  if (player.hp >= player.maxHp) {
    notify(player, "Your health is already full.", "muted");
    return;
  }
  player.potionReadyAt = now + 900;
  player.inventory.healthPotion -= 1;
  player.hp = Math.min(player.maxHp, player.hp + 50);
  notify(player, "You drink a health potion and feel refreshed.", "success");
}

function handleMessage(player, raw) {
  let data;
  try { data = JSON.parse(raw.toString()); } catch { return; }
  if (!data || typeof data !== "object") return;
  if (data.type === "input") {
    const x = Number(data.move?.x) || 0;
    const y = Number(data.move?.y) || 0;
    player.move = { x: clamp(x, -1, 1), y: clamp(y, -1, 1) };
    if (Math.hypot(player.move.x, player.move.y) > 0.05) player.target = null;
    else if (data.target && Number.isFinite(data.target.x) && Number.isFinite(data.target.y)) {
      player.target = { x: clamp(data.target.x, 0, WORLD.width), y: clamp(data.target.y, 0, WORLD.height) };
    }
  } else if (data.type === "action") {
    if (data.action === "attack") attack(player);
    if (data.action === "interact") interact(player);
    if (data.action === "potion") usePotion(player);
    if (data.action === "wave") player.emoteUntil = Date.now() + 1600;
  } else if (data.type === "chat") {
    const now = Date.now();
    if (now - player.lastChatAt < 850) return;
    const text = String(data.text || "").replace(/[<>]/g, "").trim().slice(0, 140);
    if (!text) return;
    player.lastChatAt = now;
    broadcastChat({ name: player.name, level: player.level, text, time: now });
  }
}

function updateMobs(dt, now) {
  for (const mob of mobs.values()) {
    if (mob.hp <= 0) {
      if (now >= mob.respawnAt) {
        mob.hp = mob.maxHp;
        mob.x = mob.spawnX;
        mob.y = mob.spawnY;
        mob.targetId = null;
      }
      continue;
    }
    let target = null;
    let nearest = 245;
    for (const player of activePlayers.values()) {
      if (player.respawnAt > now) continue;
      const d = distance(mob, player);
      if (d < nearest) { nearest = d; target = player; }
    }
    if (target && nearest < 220) {
      const dx = target.x - mob.x;
      const dy = target.y - mob.y;
      const length = Math.max(1, Math.hypot(dx, dy));
      if (nearest > 34) {
        mob.x += (dx / length) * 92 * dt;
        mob.y += (dy / length) * 92 * dt;
      } else if (now - (mob.lastAttackAt || 0) > 1250) {
        mob.lastAttackAt = now;
        target.hp = Math.max(0, target.hp - 7);
        if (target.hp === 0) {
          target.respawnAt = now + 4000;
          target.x = 1300;
          target.y = 960;
          target.gold = Math.max(0, target.gold - Math.floor(target.gold * 0.05));
          target.hp = target.maxHp;
          notify(target, "You were knocked out and returned to Moonhaven.", "danger");
        }
      }
    } else {
      const phase = now / 1200 + mob.phase;
      mob.x = mob.spawnX + Math.cos(phase) * 20;
      mob.y = mob.spawnY + Math.sin(phase * 0.8) * 15;
    }
  }
}

function stateFor(player) {
  return {
    type: "state",
    world: WORLD,
    me: {
      ...publicPlayer(player), xp: player.xp, xpToNext: xpToNext(player), gold: player.gold,
      inventory: player.inventory, quest: player.quest, respawnAt: player.respawnAt
    },
    players: Array.from(activePlayers.values()).filter((other) => other.id !== player.id).map(publicPlayer),
    mobs: Array.from(mobs.values()).map((mob) => ({
      id: mob.id, name: mob.name, x: Math.round(mob.x), y: Math.round(mob.y), hp: mob.hp, maxHp: mob.maxHp
    })),
    npcs: NPCS,
    online: activePlayers.size,
    serverTime: Date.now()
  };
}

function initialiseMobs() {
  for (const seed of mobSeeds) {
    mobs.set(seed.id, {
      ...seed, spawnX: seed.x, spawnY: seed.y, hp: 52, maxHp: 52,
      respawnAt: 0, lastAttackAt: 0, phase: Math.random() * Math.PI * 2
    });
  }
}

loadCharacters();
initialiseMobs();

const server = http.createServer((request, response) => {
  const url = new URL(request.url || "/", "http://localhost");
  if (url.pathname === "/health") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: true, game: "Mythvale Online", online: activePlayers.size }));
    return;
  }
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); }
  catch { response.writeHead(400); response.end("Bad request"); return; }
  if (pathname === "/") pathname = "/index.html";
  const filePath = path.resolve(PUBLIC_DIR, "." + pathname);
  if (!filePath.startsWith(PUBLIC_DIR + path.sep) && filePath !== path.join(PUBLIC_DIR, "index.html")) {
    response.writeHead(403); response.end("Forbidden"); return;
  }
  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    const extension = path.extname(filePath).toLowerCase();
    const types = {
      ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
      ".svg": "image/svg+xml"
    };
    response.writeHead(200, { "content-type": types[extension] || "application/octet-stream", "cache-control": "no-cache" });
    response.end(content);
  });
});

const websocketServer = new WebSocketServer({ server, maxPayload: 8192 });
websocketServer.on("connection", (socket) => {
  let player = null;
  socket.on("message", (raw) => {
    if (!player) {
      let hello;
      try { hello = JSON.parse(raw.toString()); }
      catch { socket.close(1008, "Invalid hello"); return; }
      if (hello?.type !== "hello") { socket.close(1008, "Send hello first"); return; }
      const id = /^[a-zA-Z0-9-]{8,64}$/.test(String(hello.id || "")) ? hello.id : randomUUID();
      player = createPlayer(id, hello.name, socket);
      send(socket, { type: "welcome", player: { id: player.id, name: player.name, level: player.level }, world: WORLD });
      broadcastChat({ name: "WORLD", level: 0, text: player.name + " has entered Mythvale.", time: Date.now(), system: true });
      return;
    }
    handleMessage(player, raw);
  });
  socket.on("close", () => {
    if (!player) return;
    characters.set(player.id, storedPlayer(player));
    activePlayers.delete(player.id);
    broadcastChat({ name: "WORLD", level: 0, text: player.name + " has left Mythvale.", time: Date.now(), system: true });
  });
  socket.on("error", (error) => console.warn("WebSocket error:", error.message));
});

let lastTick = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = Math.min(0.1, (now - lastTick) / 1000);
  lastTick = now;
  for (const player of activePlayers.values()) movePlayer(player, dt);
  updateMobs(dt, now);
  if (now - lastSave >= SAVE_MS) saveCharacters();
}, TICK_MS);

setInterval(() => {
  for (const player of activePlayers.values()) send(player.socket, stateFor(player));
}, 100);

server.listen(PORT, () => {
  console.log("Mythvale Online running on port " + PORT);
  console.log("Open http://localhost:" + PORT + " to play.");
});

function shutdown() {
  saveCharacters();
  for (const player of activePlayers.values()) player.socket.close(1001, "Server shutting down");
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);