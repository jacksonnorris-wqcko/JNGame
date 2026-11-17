const canvas = document.getElementById("world");
const ctx = canvas.getContext("2d");
const minimap = document.getElementById("minimap");
const miniCtx = minimap.getContext("2d");
const bigMap = document.getElementById("big-map");
const bigMapCtx = bigMap.getContext("2d");
const $ = (id) => document.getElementById(id);

const socketState = { socket: null, connected: false, playerId: null, name: "Wanderer" };
let game = { me: null, players: [], mobs: [], npcs: [], world: { width: 2600, height: 1800 }, online: 0 };
let camera = { x: 0, y: 0 };
let lastMiniMap = 0;
let keys = new Set();
let clickTarget = null;
let pixelRatio = 1;
let chatCollapsed = false;
let menuOpen = false;

const savedId = localStorage.getItem("mythvale-player-id");
if (savedId) socketState.playerId = savedId;
const serverFromQuery = new URLSearchParams(location.search).get("server");
const savedServer = localStorage.getItem("mythvale-server-url") || "";
const configuredServer = String(window.MYTHVALE_SERVER_URL || "").trim();
$("server-input").value = serverFromQuery || savedServer || configuredServer;

function send(payload) {
  if (socketState.socket && socketState.socket.readyState === WebSocket.OPEN) {
    socketState.socket.send(JSON.stringify(payload));
  }
}

function startGame() {
  const inputName = $("name-input").value.trim();
  if (inputName.length < 3) {
    $("start-error").textContent = "Choose a name with at least 3 characters.";
    return;
  }
  socketState.name = inputName.slice(0, 16);
  const requestedServer = $("server-input").value.trim() || serverFromQuery || configuredServer;
  if (location.hostname.endsWith("github.io") && !requestedServer) {
    $("start-error").textContent = "The website is live, but its multiplayer server is not connected yet. Enter the server address above.";
    return;
  }
  if (requestedServer) {
    try {
      const parsed = new URL(requestedServer);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Use an http:// or https:// address.");
      localStorage.setItem("mythvale-server-url", parsed.origin);
      $("server-input").value = parsed.origin;
    } catch (error) {
      $("start-error").textContent = error.message || "Enter a valid server address.";
      return;
    }
  }
  $("start-error").textContent = "";
  $("start-button").disabled = true;
  $("start-button").textContent = "Connecting to Mythvale...";
  connect();
}

function connect() {
  if (socketState.socket) {
    try { socketState.socket.close(); } catch {}
  }
  const requestedServer = $("server-input").value.trim() || serverFromQuery || configuredServer || localStorage.getItem("mythvale-server-url") || "";
  const serverOrigin = requestedServer ? new URL(requestedServer).origin : location.origin;
  const socketOrigin = serverOrigin.replace(/^https:/i, "wss:").replace(/^http:/i, "ws:");
  const ws = new WebSocket(socketOrigin);
  socketState.socket = ws;
  let opened = false;
  ws.addEventListener("open", () => {
    opened = true;
    ws.send(JSON.stringify({ type: "hello", id: socketState.playerId, name: socketState.name }));
  });
  ws.addEventListener("message", (event) => {
    let packet;
    try { packet = JSON.parse(event.data); } catch { return; }
    if (packet.type === "welcome") {
      socketState.connected = true;
      socketState.playerId = packet.player.id;
      socketState.name = packet.player.name;
      localStorage.setItem("mythvale-player-id", packet.player.id);
      $("start-screen").style.display = "none";
      $("disconnect-overlay").classList.remove("open");
      $("connection-label").textContent = "WORLD CONNECTED";
      $("connection-label").style.color = "#9ac69f";
      $("character-name").textContent = packet.player.name;
      addChat({ name: "WORLD", text: "Connected. Welcome to Mythvale, " + packet.player.name + ".", system: true });
      showToast("Welcome to Moonhaven, adventurer.", "success");
      return;
    }
    if (packet.type === "state") {
      game = packet;
      updateInterface();
    }
    if (packet.type === "chat") addChat(packet.message);
    if (packet.type === "notice") showToast(packet.message, packet.tone || "normal");
  });
  ws.addEventListener("close", () => {
    socketState.connected = false;
    $("connection-label").textContent = "DISCONNECTED";
    $("connection-label").style.color = "#d98c7e";
    if (opened || $("start-screen").style.display === "none") $("disconnect-overlay").classList.add("open");
    $("start-button").disabled = false;
    $("start-button").innerHTML = 'Enter the world <span>→</span>';
  });
  ws.addEventListener("error", () => {
    $("start-error").textContent = "Could not reach the game server. Check the server is running and try again.";
    $("start-button").disabled = false;
    $("start-button").innerHTML = 'Enter the world <span>→</span>';
  });
}

function addChat(message) {
  const line = document.createElement("div");
  line.className = "chat-line" + (message.system ? " system-line" : "");
  if (!message.system) {
    const level = document.createElement("span");
    level.className = "chat-level";
    level.textContent = message.level ? "Lv." + message.level : "";
    const name = document.createElement("strong");
    name.textContent = message.name || "Unknown";
    line.append(level, name, document.createTextNode(": " + (message.text || "")));
  } else line.textContent = (message.name && message.name !== "WORLD" ? message.name + ": " : "") + (message.text || "");
  $("chat-messages").appendChild(line);
  while ($("chat-messages").children.length > 45) $("chat-messages").removeChild($("chat-messages").firstChild);
  $("chat-messages").scrollTop = $("chat-messages").scrollHeight;
}

function showToast(message, tone) {
  const toast = document.createElement("div");
  toast.className = "toast " + (tone || "normal");
  toast.textContent = message;
  $("toast-stack").appendChild(toast);
  setTimeout(() => toast.remove(), 3600);
}

function updateInterface() {
  const me = game.me;
  if (!me) return;
  $("character-name").textContent = me.name;
  $("character-level").textContent = "Level " + me.level + " · Wayfarer";
  $("hp-value").textContent = me.hp + " / " + me.maxHp;
  $("hp-fill").style.width = (100 * me.hp / me.maxHp) + "%";
  $("xp-value").textContent = me.xp + " / " + me.xpToNext;
  $("xp-fill").style.width = (100 * me.xp / me.xpToNext) + "%";
  $("gold-value").textContent = me.gold;
  $("potion-count").textContent = me.inventory.healthPotion;
  $("slot-potion-count").textContent = me.inventory.healthPotion;
  $("online-count").textContent = game.online + (game.online === 1 ? " adventurer" : " adventurers");
  $("map-coords").textContent = Math.round(me.x) + " · " + Math.round(me.y);
  updateQuest();
  updateNearby();
  updateInventory();
}

function updateQuest() {
  const quest = game.me.quest;
  const content = $("quest-content");
  if (!quest.accepted) {
    content.innerHTML = '<div class="quest-title">A Village in Need</div><p>Speak with Elder Rowan in Moonhaven to begin your first adventure.</p><div class="quest-hint">Find the golden marker near the village square.</div>';
  } else if (quest.claimed) {
    content.innerHTML = '<div class="quest-title">A Village in Need</div><p>The meadow is peaceful again. Elder Rowan has rewarded your efforts.</p><div class="quest-hint">Quest complete · A new chapter awaits.</div>';
  } else {
    const progress = Math.min(100, quest.kills / 5 * 100);
    content.innerHTML = '<div class="quest-title">A Village in Need</div><p>Defeat the Moss Slimes threatening travellers beyond Moonhaven.</p><div class="quest-progress"><span style="width:' + progress + '%"></span></div><div class="quest-progress-label"><span>Moss Slimes</span><strong>' + quest.kills + ' / 5</strong></div><div class="quest-hint">' + (quest.kills >= 5 ? "Return to Elder Rowan to claim your reward." : "Look for green creatures in the meadows.") + '</div>';
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function updateNearby() {
  const me = game.me;
  const people = (game.npcs || []).map((npc) => ({ ...npc, d: Math.hypot(npc.x - me.x, npc.y - me.y), kind: "npc" }));
  const creatures = (game.mobs || []).filter((mob) => mob.hp > 0).map((mob) => ({ ...mob, d: Math.hypot(mob.x - me.x, mob.y - me.y), kind: "mob" }));
  const others = (game.players || []).map((person) => ({ ...person, d: Math.hypot(person.x - me.x, person.y - me.y), kind: "player" }));
  const nearby = [...people, ...creatures, ...others].filter((item) => item.d < 280).sort((a, b) => a.d - b.d).slice(0, 4);
  $("nearby-content").innerHTML = nearby.length ? nearby.map((item) => {
    const name = escapeHtml(item.name);
    const label = item.kind === "npc" ? "NPC" : item.kind === "mob" ? "Creature" : "Adventurer";
    return '<div class="nearby-row"><strong>' + name + '</strong><span>' + label + ' · ' + Math.round(item.d) + 'm</span></div>';
  }).join("") : '<span class="muted">The meadow is quiet.</span>';
}

function updateInventory() {
  const me = game.me;
  $("inventory-grid").innerHTML =
    '<div class="inventory-item"><span class="item-icon">⚗</span><strong>Health potion</strong><span>× ' + me.inventory.healthPotion + '</span></div>' +
    '<div class="inventory-item"><span class="item-icon">◈</span><strong>Gold</strong><span>× ' + me.gold + '</span></div>' +
    '<div class="inventory-item"><span class="item-icon">✧</span><strong>Adventurer\'s charm</strong><span>Equipped</span></div>';
  $("inventory-gold").textContent = me.gold + " gold";
  $("profile-modal-name").textContent = me.name;
  $("profile-summary").innerHTML =
    '<div class="profile-stat"><strong>' + me.level + '</strong><span>LEVEL</span></div>' +
    '<div class="profile-stat"><strong>' + me.xp + '</strong><span>EXPERIENCE</span></div>' +
    '<div class="profile-stat"><strong>' + me.gold + '</strong><span>GOLD</span></div>';
}

function openModal(id) { $(id).classList.add("open"); }
function closeModal(id) { $(id).classList.remove("open"); }
function doAction(action) { send({ type: "action", action }); }
function sendChat(event) {
  event.preventDefault();
  const input = $("chat-input");
  const text = input.value.trim();
  if (!text) return;
  send({ type: "chat", text });
  input.value = "";
}

function resizeCanvas() {
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(canvas.clientWidth * pixelRatio);
  canvas.height = Math.round(canvas.clientHeight * pixelRatio);
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function hash2(x, y) {
  let n = (x * 374761393 + y * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function drawTree(x, y, scale) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.fillStyle = "rgba(15,26,19,.3)"; ctx.beginPath(); ctx.ellipse(3, 16, 22, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#624b35"; ctx.fillRect(-4, -1, 8, 24);
  ctx.fillStyle = "#254b36"; ctx.beginPath(); ctx.arc(-7, -7, 18, 0, Math.PI * 2); ctx.arc(8, -10, 19, 0, Math.PI * 2); ctx.arc(0, -22, 17, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#376444"; ctx.beginPath(); ctx.arc(-9, -12, 11, 0, Math.PI * 2); ctx.arc(6, -23, 12, 0, Math.PI * 2); ctx.arc(11, -5, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(168,190,119,.2)"; ctx.beginPath(); ctx.arc(-9, -17, 6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawWorld() {
  if (!game.me) return;
  const width = canvas.clientWidth, height = canvas.clientHeight, me = game.me;
  const desiredX = me.x - width / 2, desiredY = me.y - height / 2;
  camera.x += (desiredX - camera.x) * 0.12;
  camera.y += (desiredY - camera.y) * 0.12;
  camera.x = Math.max(0, Math.min(game.world.width - width, camera.x));
  camera.y = Math.max(0, Math.min(game.world.height - height, camera.y));
  ctx.clearRect(0, 0, width, height);
  ctx.save(); ctx.translate(-camera.x, -camera.y);
  ctx.fillStyle = "#55774a"; ctx.fillRect(0, 0, game.world.width, game.world.height);
  const tile = 72, startX = Math.floor(camera.x / tile) * tile, startY = Math.floor(camera.y / tile) * tile;
  for (let x = startX; x < camera.x + width + tile; x += tile) {
    for (let y = startY; y < camera.y + height + tile; y += tile) {
      const seed = hash2(x / tile, y / tile);
      ctx.fillStyle = seed > .5 ? "rgba(160,187,111,.055)" : "rgba(25,59,38,.055)";
      ctx.fillRect(x, y, tile, tile);
      if (seed > .82) {
        ctx.fillStyle = "rgba(207,211,136,.22)";
        ctx.beginPath(); ctx.arc(x + 16 + seed * 24, y + 18 + seed * 25, 1.5, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#927d5b"; ctx.lineWidth = 116;
  ctx.beginPath(); ctx.moveTo(180, 1040); ctx.bezierCurveTo(520, 1020, 660, 890, 980, 910); ctx.bezierCurveTo(1110, 920, 1190, 900, 1300, 900); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(1300, 900); ctx.bezierCurveTo(1480, 880, 1600, 700, 1770, 530); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(1300, 900); ctx.bezierCurveTo(1300, 1120, 1370, 1330, 1580, 1550); ctx.stroke();
  ctx.strokeStyle = "rgba(219,195,147,.28)"; ctx.lineWidth = 3; ctx.setLineDash([13, 18]);
  ctx.beginPath(); ctx.moveTo(180, 1040); ctx.bezierCurveTo(520, 1020, 660, 890, 980, 910); ctx.bezierCurveTo(1110, 920, 1190, 900, 1300, 900); ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#947c55"; ctx.beginPath(); ctx.ellipse(1960, 480, 190, 127, -.12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#446f70"; ctx.beginPath(); ctx.ellipse(1960, 480, 174, 111, -.12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(177,213,185,.19)"; ctx.beginPath(); ctx.ellipse(1918, 446, 78, 20, -.18, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(208,221,177,.23)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(1960, 480, 144, 83, -.12, 0, Math.PI * 2); ctx.stroke();

  for (let x = startX - 100; x < camera.x + width + 120; x += 105) {
    for (let y = startY - 100; y < camera.y + height + 120; y += 105) {
      const seed = hash2(Math.round(x / 105), Math.round(y / 105));
      if (seed > .78 && Math.hypot(x - 1300, y - 900) > 250 && !(Math.abs(y - 970) < 100 && x < 1250) && !(((x - 1960) / 240) ** 2 + ((y - 480) / 170) ** 2 < 1)) {
        drawTree(x + seed * 40, y + (1 - seed) * 35, .72 + seed * .48);
      } else if (seed < .09) {
        ctx.fillStyle = "rgba(195,190,151,.7)"; ctx.beginPath(); ctx.ellipse(x + 32, y + 38, 5, 3, seed * 3, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  ctx.fillStyle = "#a18c66"; ctx.beginPath(); ctx.arc(1300, 900, 208, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#80936a"; ctx.beginPath(); ctx.arc(1300, 900, 193, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(237,220,170,.4)"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(1300, 900, 178, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "#b8a17b"; ctx.beginPath(); ctx.arc(1300, 900, 55, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#668a78"; ctx.beginPath(); ctx.arc(1300, 900, 45, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#c9b889"; ctx.beginPath(); ctx.arc(1300, 900, 13, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#e8d6a4"; ctx.beginPath(); ctx.arc(1300, 900, 5, 0, Math.PI * 2); ctx.fill();

  drawBuilding(1110, 710, 136, 88, "#957651", "#5b4938");
  drawBuilding(1415, 1020, 124, 86, "#9c815d", "#574735");
  drawBuilding(1460, 720, 102, 78, "#8c7354", "#544536");
  for (const bed of [[1160, 1065], [1460, 950], [1080, 850]]) {
    ctx.fillStyle = "#3f6844"; ctx.fillRect(bed[0], bed[1], 43, 24);
    ctx.fillStyle = "#b7b577"; ctx.fillRect(bed[0] + 8, bed[1] + 7, 4, 4); ctx.fillRect(bed[0] + 23, bed[1] + 13, 4, 4);
  }

  const entities = [
    ...(game.mobs || []).filter((mob) => mob.hp > 0).map((item) => ({ ...item, kind: "mob" })),
    ...(game.npcs || []).map((item) => ({ ...item, kind: "npc" })),
    ...(game.players || []).map((item) => ({ ...item, kind: "player" })),
    { ...me, kind: "self" }
  ].sort((a, b) => a.y - b.y);
  for (const entity of entities) {
    if (entity.x < camera.x - 80 || entity.x > camera.x + width + 80 || entity.y < camera.y - 100 || entity.y > camera.y + height + 80) continue;
    if (entity.kind === "mob") drawSlime(entity);
    else if (entity.kind === "npc") drawNpc(entity);
    else drawPlayer(entity, entity.kind === "self");
  }
  ctx.restore();
}

function drawBuilding(x, y, w, h, roof, wall) {
  ctx.fillStyle = "rgba(20,30,20,.28)"; ctx.fillRect(x + 7, y + h - 2, w, 15);
  ctx.fillStyle = wall; ctx.fillRect(x, y + 24, w, h - 24);
  ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(x - 10, y + 27); ctx.lineTo(x + w / 2, y - 18); ctx.lineTo(x + w + 10, y + 27); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(228,203,149,.3)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 10, y + 27); ctx.lineTo(x + w / 2, y - 18); ctx.lineTo(x + w + 10, y + 27); ctx.stroke();
  ctx.fillStyle = "#302b22"; ctx.fillRect(x + w / 2 - 10, y + h - 37, 20, 37);
  ctx.fillStyle = "rgba(232,202,135,.65)"; ctx.fillRect(x + 15, y + 38, 13, 15); ctx.fillRect(x + w - 28, y + 38, 13, 15);
}

function drawNameplate(name, level, x, y, color) {
  ctx.font = "600 11px DM Sans, sans-serif";
  const width = ctx.measureText(name).width + 20;
  ctx.fillStyle = "rgba(14,22,19,.78)";
  ctx.beginPath(); ctx.roundRect(x - width / 2, y - 31, width, 19, 5); ctx.fill();
  ctx.fillStyle = color; ctx.textAlign = "center"; ctx.fillText(name, x, y - 18);
  if (level) {
    ctx.fillStyle = "rgba(229,211,161,.7)"; ctx.font = "8px DM Sans, sans-serif";
    ctx.fillText("LEVEL " + level, x, y - 36);
  }
}

function drawPlayer(person, isSelf) {
  const x = person.x, y = person.y;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = "rgba(15,24,18,.3)"; ctx.beginPath(); ctx.ellipse(0, 10, 15, 7, 0, 0, Math.PI * 2); ctx.fill();
  if (isSelf) {
    ctx.strokeStyle = "rgba(243,211,145,.7)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 9, 22, 12, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = isSelf ? "#b28a55" : "#5e8193";
  ctx.beginPath(); ctx.moveTo(-10, -3); ctx.lineTo(-8, 9); ctx.lineTo(0, 16); ctx.lineTo(8, 9); ctx.lineTo(10, -3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = isSelf ? "#d2b57a" : "#a8c3bc";
  ctx.beginPath(); ctx.roundRect(-8, -14, 16, 19, 5); ctx.fill();
  ctx.fillStyle = "#d9bd91"; ctx.beginPath(); ctx.arc(0, -16, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#503d2e"; ctx.beginPath(); ctx.arc(0, -20, 8, Math.PI, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#493b2d"; ctx.fillRect(-7, -5, 4, 9); ctx.fillRect(3, -5, 4, 9);
  ctx.restore();
  drawNameplate(person.name, person.level, x, y - 2, isSelf ? "#f2d49a" : "#c6dfd0");
  if (person.emoteUntil > Date.now()) {
    ctx.save();
    ctx.fillStyle = "rgba(19,29,25,.92)";
    ctx.strokeStyle = "rgba(226,202,150,.65)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x - 15, y - 62, 30, 19, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#f0d7a0"; ctx.font = "bold 9px DM Sans, sans-serif"; ctx.textAlign = "center"; ctx.fillText("HI!", x, y - 49);
    ctx.restore();
  }
}

function drawNpc(npc) {
  ctx.save(); ctx.translate(npc.x, npc.y);
  ctx.fillStyle = "rgba(15,24,18,.3)"; ctx.beginPath(); ctx.ellipse(0, 9, 15, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = npc.kind === "merchant" ? "#668f79" : "#9d8b69";
  ctx.beginPath(); ctx.moveTo(-11, -4); ctx.lineTo(-9, 11); ctx.lineTo(0, 14); ctx.lineTo(9, 11); ctx.lineTo(11, -4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#e2c49c"; ctx.beginPath(); ctx.arc(0, -15, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#d6d0b5"; ctx.beginPath(); ctx.arc(0, -20, 9, Math.PI, Math.PI * 2); ctx.fill();
  ctx.restore();
  drawNameplate(npc.name, "", npc.x, npc.y - 1, "#e8d49c");
  if (npc.id === "rowan" && game.me && (!game.me.quest.accepted || (game.me.quest.kills >= 5 && !game.me.quest.claimed))) {
    ctx.fillStyle = "#f2d28b"; ctx.font = "bold 21px DM Sans"; ctx.textAlign = "center"; ctx.fillText("!", npc.x, npc.y - 51);
  }
}

function drawSlime(mob) {
  ctx.save(); ctx.translate(mob.x, mob.y);
  const pulse = Math.sin(Date.now() / 230 + mob.x) * 1.5;
  ctx.fillStyle = "rgba(13,24,17,.3)"; ctx.beginPath(); ctx.ellipse(0, 9, 17, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#76a86e"; ctx.beginPath(); ctx.ellipse(0, -2, 16 + pulse, 13 - pulse * .3, 0, Math.PI, 0); ctx.lineTo(16 + pulse, 5); ctx.quadraticCurveTo(0, 17, -16 - pulse, 5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#a9ce83"; ctx.beginPath(); ctx.ellipse(-5, -8, 5, 3, -.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#263a2a"; ctx.beginPath(); ctx.arc(-5, 0, 1.6, 0, Math.PI * 2); ctx.arc(5, 0, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  drawNameplate(mob.name, "", mob.x, mob.y, "#d6e4b1");
  ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(mob.x - 15, mob.y - 22, 30, 3);
  ctx.fillStyle = "#d47f70"; ctx.fillRect(mob.x - 15, mob.y - 22, 30 * mob.hp / mob.maxHp, 3);
}

function drawMinimap() {
  if (!game.me) return;
  const w = minimap.width, h = minimap.height;
  miniCtx.clearRect(0, 0, w, h);
  miniCtx.fillStyle = "#55774a"; miniCtx.fillRect(0, 0, w, h);
  miniCtx.strokeStyle = "#927d5b"; miniCtx.lineWidth = 7;
  miniCtx.beginPath(); miniCtx.moveTo(8, 79); miniCtx.quadraticCurveTo(62, 73, 110, 66); miniCtx.stroke();
  miniCtx.beginPath(); miniCtx.moveTo(110, 66); miniCtx.lineTo(165, 32); miniCtx.stroke();
  miniCtx.fillStyle = "#446f70"; miniCtx.beginPath(); miniCtx.ellipse(166, 35, 16, 10, -.1, 0, Math.PI * 2); miniCtx.fill();
  miniCtx.fillStyle = "#80936a"; miniCtx.beginPath(); miniCtx.arc(110, 66, 17, 0, Math.PI * 2); miniCtx.fill();
  const scaleX = w / game.world.width, scaleY = h / game.world.height;
  for (const npc of game.npcs || []) { miniCtx.fillStyle = "#8cc6a8"; miniCtx.beginPath(); miniCtx.arc(npc.x * scaleX, npc.y * scaleY, 3, 0, Math.PI * 2); miniCtx.fill(); }
  for (const mob of game.mobs || []) if (mob.hp > 0) { miniCtx.fillStyle = "#d78270"; miniCtx.beginPath(); miniCtx.arc(mob.x * scaleX, mob.y * scaleY, 2.5, 0, Math.PI * 2); miniCtx.fill(); }
  for (const person of game.players || []) { miniCtx.fillStyle = "#a9d1d7"; miniCtx.beginPath(); miniCtx.arc(person.x * scaleX, person.y * scaleY, 2.5, 0, Math.PI * 2); miniCtx.fill(); }
  miniCtx.fillStyle = "#f2d18d"; miniCtx.strokeStyle = "#fff1cc"; miniCtx.lineWidth = 1.5;
  miniCtx.beginPath(); miniCtx.arc(game.me.x * scaleX, game.me.y * scaleY, 4, 0, Math.PI * 2); miniCtx.fill(); miniCtx.stroke();
}

function drawBigMap() {
  const w = bigMap.width, h = bigMap.height;
  bigMapCtx.fillStyle = "#55774a"; bigMapCtx.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 30) for (let y = 0; y < h; y += 30) {
    const seed = hash2(x, y); bigMapCtx.fillStyle = seed > .5 ? "rgba(160,187,111,.07)" : "rgba(25,59,38,.06)"; bigMapCtx.fillRect(x, y, 30, 30);
  }
  bigMapCtx.strokeStyle = "#927d5b"; bigMapCtx.lineWidth = 30; bigMapCtx.lineCap = "round";
  bigMapCtx.beginPath(); bigMapCtx.moveTo(40, 290); bigMapCtx.bezierCurveTo(175, 285, 210, 230, 380, 235); bigMapCtx.stroke();
  bigMapCtx.beginPath(); bigMapCtx.moveTo(380, 235); bigMapCtx.bezierCurveTo(450, 230, 485, 120, 530, 92); bigMapCtx.stroke();
  bigMapCtx.beginPath(); bigMapCtx.moveTo(380, 235); bigMapCtx.lineTo(455, 420); bigMapCtx.stroke();
  bigMapCtx.fillStyle = "#446f70"; bigMapCtx.beginPath(); bigMapCtx.ellipse(575, 125, 55, 35, -.1, 0, Math.PI * 2); bigMapCtx.fill();
  bigMapCtx.fillStyle = "#80936a"; bigMapCtx.beginPath(); bigMapCtx.arc(380, 235, 45, 0, Math.PI * 2); bigMapCtx.fill();
  bigMapCtx.fillStyle = "#ead19b"; bigMapCtx.font = "17px Marcellus"; bigMapCtx.textAlign = "center"; bigMapCtx.fillText("MOONHAVEN", 380, 304);
  bigMapCtx.fillStyle = "#c9d9ba"; bigMapCtx.font = "12px DM Sans"; bigMapCtx.fillText("Whispering Meadows", 160, 170); bigMapCtx.fillText("Stillwater Pond", 575, 78);
  const scaleX = w / game.world.width, scaleY = h / game.world.height;
  for (const npc of game.npcs || []) { bigMapCtx.fillStyle = "#8cc6a8"; bigMapCtx.beginPath(); bigMapCtx.arc(npc.x * scaleX, npc.y * scaleY, 5, 0, Math.PI * 2); bigMapCtx.fill(); }
  for (const mob of game.mobs || []) if (mob.hp > 0) { bigMapCtx.fillStyle = "#d78270"; bigMapCtx.beginPath(); bigMapCtx.arc(mob.x * scaleX, mob.y * scaleY, 4, 0, Math.PI * 2); bigMapCtx.fill(); }
  if (game.me) {
    bigMapCtx.fillStyle = "#f2d18d"; bigMapCtx.strokeStyle = "#fff1cc"; bigMapCtx.lineWidth = 2;
    bigMapCtx.beginPath(); bigMapCtx.arc(game.me.x * scaleX, game.me.y * scaleY, 7, 0, Math.PI * 2); bigMapCtx.fill(); bigMapCtx.stroke();
  }
}

function animationLoop(timestamp) {
  drawWorld();
  if (timestamp - lastMiniMap > 320) { drawMinimap(); lastMiniMap = timestamp; }
  requestAnimationFrame(animationLoop);
}

function sendMovement() {
  if (!socketState.connected) return;
  const horizontal = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
  const vertical = (keys.has("s") || keys.has("arrowdown") ? 1 : 0) - (keys.has("w") || keys.has("arrowup") ? 1 : 0);
  send({ type: "input", move: { x: horizontal, y: vertical }, target: horizontal || vertical ? null : clickTarget });
  if (clickTarget && game.me && Math.hypot(clickTarget.x - game.me.x, clickTarget.y - game.me.y) < 22) clickTarget = null;
}

function worldPointFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left + camera.x, y: event.clientY - rect.top + camera.y };
}

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (document.activeElement === $("chat-input") || document.activeElement === $("name-input")) return;
  if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
    if (document.activeElement === $("chat-input") || document.activeElement === $("name-input")) return;
    event.preventDefault(); keys.add(key);
  }
  if (event.repeat) return;
  if (key === " " || key === "spacebar") doAction("attack");
  if (key === "e") doAction("interact");
  if (key === "1") doAction("potion");
  if (key === "i") openModal("inventory-modal");
  if (key === "g") doAction("wave");
  if (key === "escape") document.querySelectorAll(".modal-backdrop.open").forEach((modal) => modal.classList.remove("open"));
});
document.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
window.addEventListener("blur", () => keys.clear());
canvas.addEventListener("pointerdown", (event) => {
  if (!game.me || event.button !== 0) return;
  clickTarget = worldPointFromEvent(event); keys.clear();
});

$("start-button").addEventListener("click", startGame);
$("name-input").addEventListener("keydown", (event) => { if (event.key === "Enter") startGame(); });
$("reconnect-button").addEventListener("click", connect);
$("attack-button").addEventListener("click", () => doAction("attack"));
$("interact-button").addEventListener("click", () => doAction("interact"));
$("potion-button").addEventListener("click", () => doAction("potion"));
$("emote-button").addEventListener("click", () => doAction("wave"));
$("inventory-button").addEventListener("click", () => openModal("inventory-modal"));
$("profile-button").addEventListener("click", () => openModal("profile-modal"));
$("map-button").addEventListener("click", () => { drawBigMap(); openModal("map-modal"); });
$("quest-track-button").addEventListener("click", () => {
  if (!game.me) return;
  if (!game.me.quest.accepted) showToast("Find Elder Rowan in the village square and press E.", "quest");
  else showToast(game.me.quest.claimed ? "Quest complete. Explore the world." : "Defeat Moss Slimes in the meadows and return to Elder Rowan.", "quest");
});
document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => closeModal(button.dataset.close)));
document.querySelectorAll(".modal-backdrop").forEach((modal) => modal.addEventListener("click", (event) => { if (event.target === modal) modal.classList.remove("open"); }));
$("chat-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = $("chat-input"), text = input.value.trim();
  if (!text) return;
  send({ type: "chat", text }); input.value = "";
});
$("chat-toggle").addEventListener("click", () => {
  chatCollapsed = !chatCollapsed;
  $("chat-messages").style.display = chatCollapsed ? "none" : "block";
  $("chat-form").style.display = chatCollapsed ? "none" : "flex";
  $("chat-toggle").textContent = chatCollapsed ? "⌃" : "⌄";
});
$("menu-button").addEventListener("click", () => {
  menuOpen = !menuOpen;
  const panel = document.querySelector(".top-actions");
  panel.style.display = menuOpen ? "flex" : "none";
  panel.style.position = menuOpen ? "absolute" : "";
  panel.style.top = menuOpen ? "60px" : "";
  panel.style.right = menuOpen ? "8px" : "";
  panel.style.padding = menuOpen ? "8px" : "";
  panel.style.background = menuOpen ? "rgba(16,26,24,.96)" : "";
  panel.style.border = menuOpen ? "1px solid rgba(219,203,153,.2)" : "";
  panel.style.borderRadius = menuOpen ? "8px" : "";
  panel.style.flexDirection = menuOpen ? "column" : "";
});
window.addEventListener("resize", resizeCanvas);
setInterval(() => { if (socketState.connected) sendMovement(); }, 80);
resizeCanvas();
requestAnimationFrame(animationLoop);