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

  await page.goto("http://127.0.0.1:8000/play.html?build=0.4.0", {
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

  const diagnostics = await page.evaluate(() => window.WildrangeDiagnostics());
  if (!diagnostics.environmentReady) throw new Error("Forest HDR environment did not finish loading");
  if (diagnostics.pbrMaterialCount < 15) throw new Error("PBR materials were not created (" + diagnostics.pbrMaterialCount + ")");
  if (diagnostics.readyTextureCount < 12) throw new Error("Too few textures finished loading (" + diagnostics.readyTextureCount + ")");
  if (!diagnostics.canvasWidth || !diagnostics.canvasHeight || !diagnostics.webglEnabled) {
    throw new Error("3D WebGL renderer is unavailable");
  }
  if (failures.length) throw new Error(failures.join("\\n"));

  console.log(JSON.stringify({ titleVisible, diagnostics, failures }, null, 2));

} finally {
  await browser.close();
}
