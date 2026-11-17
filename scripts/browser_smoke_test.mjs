import { chromium } from "playwright";

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
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  page.on("pageerror", (error) => failures.push("pageerror: " + error.message));
  page.on("requestfailed", (request) => {
    if (request.url().includes("/assets/") || request.url().includes("babylon.js")) {
      failures.push("request failed: " + request.url() + " (" + request.failure()?.errorText + ")");
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && response.url().includes("/assets/")) {
      failures.push("asset HTTP " + response.status() + ": " + response.url());
    }
  });

  await page.goto("http://127.0.0.1:8000/play.html?build=0.8.5", {
    waitUntil: "domcontentloaded",
    timeout: 90000
  });
  await page.waitForFunction(() => window.BABYLON && window.WildrangeDiagnostics, { timeout: 45000 });
  await page.waitForTimeout(9000);

  const titleVisible = await page.locator("#start-screen").evaluate((el) =>
    getComputedStyle(el).display !== "none"
  );
  if (!titleVisible) throw new Error("Wildrange title screen did not appear");

  await page.locator("#player-name").fill("RANGER QA");
  await page.locator("#start-button").click();
  await page.waitForFunction(() => {
    const diagnostics = window.WildrangeDiagnostics?.();
    return diagnostics && diagnostics.sceneReady && diagnostics.meshCount > 500;
  }, { timeout: 45000 });
  await page.waitForTimeout(9000);
  await page.waitForFunction(() => {
    const state = window.WildrangeDiagnostics?.();
    return state && state.importedAnimalCount >= 9 && state.weaponModelReady;
  }, { timeout: 45000 });

  const diagnostics = await page.evaluate(() => window.WildrangeDiagnostics());
  if (!diagnostics.environmentReady) throw new Error("Forest HDR environment did not finish loading");
  if (diagnostics.pbrMaterialCount < 15) throw new Error("PBR materials were not created (" + diagnostics.pbrMaterialCount + ")");
  if (diagnostics.readyTextureCount < 12) throw new Error("Too few textures finished loading (" + diagnostics.readyTextureCount + ")");
  if (!diagnostics.canvasWidth || !diagnostics.canvasHeight || !diagnostics.webglEnabled) {
    throw new Error("3D WebGL renderer is unavailable");
  }
  if (diagnostics.animalCount < 9 || diagnostics.importedAnimalCount < 9 ||
      diagnostics.animalRigSkinCount < 9 || diagnostics.animalLegRigCount < 36 ||
      diagnostics.animalHeadRigCount < 9 || diagnostics.animalAnimationClipCount < 27) {
    throw new Error("Imported wildlife rigs or animations are incomplete: " + JSON.stringify(diagnostics));
  }
  const weaponClips = (diagnostics.weaponAnimationClipNames || []).map((name) => name.toLowerCase());
  if (!diagnostics.weaponModelReady || diagnostics.weaponModelFailed ||
      diagnostics.weaponAssetMeshCount < 1 || !diagnostics.weaponBoltReady) {
    throw new Error("No usable rifle model loaded: " + JSON.stringify(diagnostics));
  }
  if (!diagnostics.weaponFallbackUsed &&
      (!diagnostics.weaponHasIntegratedScope || diagnostics.weaponAnimationClipCount < 4 ||
       !["magazine-open", "magazine-close", "bolt-open", "bolt-close"].every((clip) => weaponClips.some((name) => name.includes(clip))))) {
    throw new Error("Primary marksman rifle optic or native animation clips are incomplete: " + JSON.stringify(diagnostics));
  }
  if (diagnostics.modelLoadFailures?.length) {
    throw new Error("One or more GLB models failed to load: " + diagnostics.modelLoadFailures.join("; "));
  }

  await page.mouse.move(800, 450);
  await page.mouse.down({ button: "right" });
  await page.waitForFunction(() => {
    const state = window.WildrangeDiagnostics?.();
    return state && state.aiming && state.scopeVisible;
  }, { timeout: 8000 });
  const scoped = await page.evaluate(() => window.WildrangeDiagnostics());
  if (scoped.scopeZoom !== 4) throw new Error("Default optic magnification was not 4x");
  await page.mouse.wheel(0, -500);
  await page.waitForFunction(() => window.WildrangeDiagnostics?.().scopeZoom === 6, { timeout: 3000 });
  await page.mouse.up({ button: "right" });
  await page.waitForFunction(() => !window.WildrangeDiagnostics?.().aiming, { timeout: 3000 });
  const jumpsBefore = await page.evaluate(() => window.WildrangeDiagnostics().jumpCount);
  await page.keyboard.press("Space");
  await page.waitForFunction((before) => {
    const state = window.WildrangeDiagnostics?.();
    return state && state.jumpCount > before && !state.playerGrounded && state.playerHeight > 0.12;
  }, jumpsBefore, { timeout: 12000 });
  const airborne = await page.evaluate(() => window.WildrangeDiagnostics());
  if (airborne.playerGrounded || airborne.playerHeight < 0.12) throw new Error("Jump impulse failed: " + JSON.stringify(airborne));
  await page.waitForFunction(() => window.WildrangeDiagnostics?.().playerGrounded, { timeout: 15000 });
  const landed = await page.evaluate(() => window.WildrangeDiagnostics());
  if (landed.jumpCount !== jumpsBefore + 1) throw new Error("Jump was not counted exactly once");
  if (failures.length) throw new Error(failures.join("\\n"));
  console.log(JSON.stringify({ titleVisible, diagnostics, scoped, airborne, landed, failures }, null, 2));

} finally {
  await browser.close();
}
