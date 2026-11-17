import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { WebSocket } from "ws";

const port = 3217;
const baseUrl = "http://127.0.0.1:" + port;
const server = spawn(process.execPath, ["server.js"], {
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"]
});
let serverOutput = "";
server.stdout.on("data", (chunk) => { serverOutput += chunk.toString(); });
server.stderr.on("data", (chunk) => { serverOutput += chunk.toString(); });

function waitPacket(socket, predicate, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("message", onMessage);
      reject(new Error("Timed out waiting for WebSocket packet. " + serverOutput));
    }, timeout);
    function onMessage(raw) {
      let packet;
      try { packet = JSON.parse(raw.toString()); } catch { return; }
      if (!predicate(packet)) return;
      clearTimeout(timer);
      socket.off("message", onMessage);
      resolve(packet);
    }
    socket.on("message", onMessage);
  });
}

async function join(name) {
  const socket = new WebSocket("ws://127.0.0.1:" + port);
  await new Promise((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
  const welcomePromise = waitPacket(socket, (packet) => packet.type === "welcome");
  socket.send(JSON.stringify({ type: "hello", name }));
  const welcome = await welcomePromise;
  return { socket, welcome };
}

const sockets = [];
try {
  let healthy = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(baseUrl + "/health");
      if (response.ok && (await response.json()).ok) { healthy = true; break; }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(healthy, true, "HTTP health check should respond");

  const first = await join("SmokeTester");
  sockets.push(first.socket);
  assert.equal(first.welcome.player.name, "SmokeTester");

  const firstState = await waitPacket(first.socket, (packet) => packet.type === "state");
  const second = await join("WorldTester");
  sockets.push(second.socket);
  assert.equal(second.welcome.player.name, "WorldTester");

  const sharedWorld = await waitPacket(first.socket, (packet) =>
    packet.type === "state" && packet.players.some((player) => player.id === second.welcome.player.id)
  );
  assert.equal(sharedWorld.players.some((player) => player.id === second.welcome.player.id), true,
    "The first player should see the second player in the shared world");

  const moved = waitPacket(first.socket, (packet) =>
    packet.type === "state" && packet.me.x > firstState.me.x + 5
  );
  first.socket.send(JSON.stringify({ type: "input", move: { x: 1, y: 0 } }));
  await moved;
  first.socket.send(JSON.stringify({ type: "input", move: { x: 0, y: 0 } }));

  const chat = waitPacket(first.socket, (packet) =>
    packet.type === "chat" && packet.message.text === "Hello from the smoke test"
  );
  second.socket.send(JSON.stringify({ type: "chat", text: "Hello from the smoke test" }));
  await chat;

  console.log("PASS: health endpoint, character join, shared player visibility, movement and world chat.");
} finally {
  for (const socket of sockets) {
    try { socket.close(); } catch {}
  }
  server.kill("SIGTERM");
  await new Promise((resolve) => {
    if (server.exitCode !== null) resolve();
    else server.once("exit", resolve);
    setTimeout(resolve, 2500);
  });
}
