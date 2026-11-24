import { chromium } from "playwright";
import fs from "node:fs";

const failures = [];
const browser = await chromium.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader"
  ]
});

try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1
  });
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("requestfailed", (request) => {
    if (request.url().includes("/assets/") || request.url().includes("babylon.js")) {
      failures.push("request failed: " + request.url() + " " + request.failure()?.errorText);
    }
  });

  await page.goto("http://127.0.0.1:8000/play.html?build=0.13.1&qa=1", {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });
  await page.waitForFunction(() => Boolean(window.WildrangeDiagnostics && window.BABYLON), null, {
    timeout: 45000
  });
  await page.evaluate(() => {
    const input = document.getElementById("player-name");
    const start = document.getElementById("start-button");
    if (!input || !start) throw new Error("Title screen controls missing");
    input.value = "RANGER VISUAL QA";
    start.click();
  });
  await page.waitForFunction(() => {
    const state = window.WildrangeDiagnostics?.();
    return state && state.sceneReady && state.lodgeModelReady &&
      !state.lodgeModelLoading && state.lodgeModelAssetName === "pinecrest-cedarwatch-cabin.glb" &&
      state.cedarwatchFacadeWallMeshCount >= 8 &&
      state.cedarwatchWindowGlassCount >= 4 &&
      state.cedarwatchRoofTileCount >= 100 &&
      state.cedarwatchHiddenAccessoryCount >= 14 &&
      state.cedarwatchTimberTrimCount >= 20 &&
      state.heroFernReady && state.heroFernCount === 4 &&
      state.heroBoulderCount === 3;
  }, null, { timeout: 120000 });

  // Keep the player at the established gate spawn, looking directly toward the lodge.
  await page.evaluate(() => {
    const state = window.WildrangeDiagnostics();
    const scene = window.BABYLON.EngineStore.LastCreatedScene;
    const player = scene && scene.activeCamera;
    if (!state || !player || !state.lodgeDoorwayOpen || !state.lodgeAuthoredInteriorReady) {
      throw new Error("Cedarwatch entry/interior was not ready for capture");
    }
    // Stable gate-spawn view toward the lodge; no debug camera or hidden angle.
    player.position.set(-14, state.spawnGroundHeight + 1.72, 19);
    player.rotation.set(0, 0, 0);
  });
  await page.waitForTimeout(1800);

  const diagnostics = await page.evaluate(() => window.WildrangeDiagnostics());
  if (failures.length) throw new Error("Browser errors: " + failures.join("; "));

  await fs.promises.mkdir("artifacts", { recursive: true });
  const client = await page.context().newCDPSession(page);
  const shot = await client.send("Page.captureScreenshot", {
    format: "jpeg",
    quality: 90,
    fromSurface: true,
    captureBeyondViewport: false,
    optimizeForSpeed: true
  });
  await fs.promises.writeFile(
    "artifacts/wildrange-0.13.1-pinecrest-visual.jpg",
    Buffer.from(shot.data, "base64")
  );
  await client.detach();

  console.log(JSON.stringify({
    screenshot: "artifacts/wildrange-0.13.1-pinecrest-visual.jpg",
    cedarwatch: diagnostics.lodgeModelAssetName,
    facadeWalls: diagnostics.cedarwatchFacadeWallMeshCount,
    warmWindows: diagnostics.cedarwatchWindowGlassCount,
    roofTiles: diagnostics.cedarwatchRoofTileCount,
    hiddenConeTreesAndBushes: diagnostics.cedarwatchHiddenAccessoryCount,
    timberTrim: diagnostics.cedarwatchTimberTrimCount,
    doorwayOpen: diagnostics.lodgeDoorwayOpen,
    navigationBoxes: diagnostics.lodgeNavigationBoxCount,
    ferns: diagnostics.heroFernCount,
    mossyBoulders: diagnostics.heroBoulderCount,
    fps: diagnostics.fps,
    frameMs: diagnostics.averageFrameMs
  }, null, 2));
} finally {
  await browser.close();
}
