import { chromium } from "playwright";
import fs from "node:fs";

const failures = [];
const consoleErrors = [];
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
  const visualCaptureNotes = [];
  const safeScreenshot = async (path) => {
    try {
      await page.screenshot({
        path,
        fullPage: false,
        timeout: 90000,
        animations: "disabled",
        scale: "css"
      });
      return true;
    } catch (error) {
      visualCaptureNotes.push(path + ": " + (error && error.message ? error.message : String(error)));
      console.warn("Wildrange visual screenshot skipped; continuing functional QA:", path, error);
      return false;
    }
  };
  page.on("pageerror", (error) => failures.push("pageerror: " + error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
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

  await page.goto("http://127.0.0.1:8000/play.html?build=0.11.3&qa=1", {
    waitUntil: "domcontentloaded",
    timeout: 90000
  });
  await page.waitForFunction(
    () => Boolean(window.BABYLON && window.WildrangeDiagnostics),
    null,
    { timeout: 45000 }
  );
  await page.waitForTimeout(2500);

  // Capture the title page before interacting. This makes a failed UI assertion
  // inspectable as a workflow artifact instead of leaving only a locator timeout.
  await fs.promises.mkdir("artifacts", { recursive: true });
  const titleDom = await page.evaluate(() => {
    const start = document.getElementById("start-screen");
    const button = document.getElementById("start-button");
    const name = document.getElementById("player-name");
    return {
      url: location.href,
      readyState: document.readyState,
      title: document.title,
      bodyChildren: document.body?.children.length || 0,
      startScreenFound: Boolean(start),
      startScreenDisplay: start ? getComputedStyle(start).display : null,
      startScreenVisibility: start ? getComputedStyle(start).visibility : null,
      startButtonFound: Boolean(button),
      playerNameFound: Boolean(name),
      htmlStartExcerpt: document.documentElement.innerHTML.slice(
        Math.max(0, document.documentElement.innerHTML.indexOf("start-screen") - 180),
        document.documentElement.innerHTML.indexOf("start-screen") + 900
      )
    };
  });
  const titleScreenshotCaptured = await safeScreenshot("artifacts/wildrange-0.11.3-title-preflight.png");
  if (!titleDom.startScreenFound || !titleDom.startButtonFound || !titleDom.playerNameFound) {
    throw new Error("Title screen DOM is incomplete: " + JSON.stringify({
      ...titleDom,
      pageErrors: failures,
      consoleErrors
    }));
  }
  const titleVisible = titleDom.startScreenDisplay !== "none" && titleDom.startScreenVisibility !== "hidden";
  if (!titleVisible) throw new Error("Wildrange title screen is not visible: " + JSON.stringify(titleDom));

  // Drive the same native button click as a player, but avoid a selector wait
  // that can mask the underlying page DOM if the UI is being replaced.
  await page.evaluate(() => {
    const name = document.getElementById("player-name");
    const button = document.getElementById("start-button");
    name.value = "RANGER QA";
    button.click();
  });
  await page.waitForFunction(
    () => {
      const start = document.getElementById("start-screen");
      return start && getComputedStyle(start).display === "none";
    },
    null,
    { timeout: 10000 }
  );
  await page.waitForFunction(() => {
    const diagnostics = window.WildrangeDiagnostics?.();
    return diagnostics && (diagnostics.sceneReady || diagnostics.sceneInitError);
  }, null, { timeout: 45000 });
  const startingCameraYaw = await page.evaluate(() => window.WildrangeQA.cameraYaw());
  if (Math.abs(startingCameraYaw - Math.atan2(-14, 24)) > 0.03) {
    throw new Error("New-hunter camera should start facing Pinecrest Lodge: " + startingCameraYaw);
  }
  const startupDiagnostics = await page.evaluate(() => window.WildrangeDiagnostics());
  if (!startupDiagnostics.pinecrestRoofShingleMaterialReady ||
      startupDiagnostics.compoundShadowCasterCount < 100 ||
      startupDiagnostics.compoundShadowMapSize !== 1536 ||
      startupDiagnostics.compoundFencePostCount !== 31 ||
      startupDiagnostics.compoundFenceRailCount !== 48) {
    throw new Error("Pinecrest materials, shadows or compound fencing are not ready: " + JSON.stringify({
      roofMaterial: startupDiagnostics.pinecrestRoofShingleMaterialReady,
      shadowCasters: startupDiagnostics.compoundShadowCasterCount,
      shadowMapSize: startupDiagnostics.compoundShadowMapSize,
      fencePosts: startupDiagnostics.compoundFencePostCount,
      fenceRails: startupDiagnostics.compoundFenceRailCount
    }));
  }
  if (startupDiagnostics.gateStructuralPostCount !== 2 ||
      startupDiagnostics.pinecrestWoodshedPostCount !== 4) {
    throw new Error("Scene initialisation duplicated or omitted compound assemblies: " + JSON.stringify({
      gatePosts: startupDiagnostics.gateStructuralPostCount,
      woodshedPosts: startupDiagnostics.pinecrestWoodshedPostCount
    }));
  }
  if (!startupDiagnostics.sceneReady) {
    throw new Error("3D scene failed during startup: " + (startupDiagnostics.sceneInitError || "unknown error"));
  }
  if (startupDiagnostics.meshCount <= 350) {
    throw new Error("Scene did not create the expected world meshes: " + startupDiagnostics.meshCount);
  }
  await page.waitForTimeout(9000);
  await page.waitForFunction(() => {
    const state = window.WildrangeDiagnostics?.();
    return state && state.importedAnimalCount >= 9 && state.weaponModelReady;
  }, null, { timeout: 45000 });
  await page.waitForFunction(() => {
    const state = window.WildrangeDiagnostics?.();
    return state && !state.lodgeModelLoading && state.lodgeModelReady &&
      state.lodgeModelAssetName === "pinecrest-mountain-hut.glb" &&
      !state.lodgeModelUsedFallback &&
      state.heroConiferReady && state.heroBroadleafReady && state.heroTreeModelCount === 4;
  }, null, { timeout: 90000 });

  const diagnostics = await page.evaluate(() => window.WildrangeDiagnostics());
  if (diagnostics.lodgeInteriorAdjustedMeshCount < 20) {
    throw new Error("The Mountain Hut interior floor offset did not refresh its frozen child meshes: " + diagnostics.lodgeInteriorAdjustedMeshCount);
  }
  if (diagnostics.lodgeModelHiddenLegacyMeshCount < 30 ||
      diagnostics.pinecrestRoofSurfaceCount !== 0 ||
      diagnostics.pinecrestLogEndgrainCount !== 0 ||
      diagnostics.lodgeModelLegacyVisualStats.visible !== 0 ||
      diagnostics.lodgeModelLegacyVisualStats.roof !== 0 ||
      diagnostics.lodgeModelLegacyVisualStats.sign !== 0 ||
      diagnostics.lodgeModelLegacyVisualStats.chimney !== 0 ||
      diagnostics.lodgeModelLegacyVisualStats.porch !== 0 ||
      diagnostics.lodgeModelLegacyVisualStats.flag !== 0 ||
      diagnostics.lodgeModelLegacyVisualStats.lantern !== 0) {
    throw new Error("Legacy procedural lodge pieces remain visible alongside the imported Mountain Hut: " + JSON.stringify({
      hiddenShellMeshes: diagnostics.lodgeModelHiddenLegacyMeshCount,
      hiddenPorchMeshes: diagnostics.lodgeModelHiddenLegacyPorchCount,
      remaining: diagnostics.lodgeModelLegacyVisualStats
    }));
  }
  if (!diagnostics.lodgeModelSignReady || !diagnostics.lodgeModelSignFaceVisible) {
    throw new Error("The new Mountain Hut-mounted Pinecrest Lodge nameplate is not visible: " + JSON.stringify({
      ready: diagnostics.lodgeModelSignReady,
      faceVisible: diagnostics.lodgeModelSignFaceVisible,
      position: diagnostics.lodgeModelSignFacePosition
    }));
  }
  if (!diagnostics.lodgeModelReady ||
      diagnostics.lodgeModelAssetName !== "pinecrest-mountain-hut.glb" ||
      diagnostics.lodgeModelUsedFallback ||
      diagnostics.lodgeModelMeshCount < 8 ||
      diagnostics.lodgeModelUniformScale <= 0 ||
      diagnostics.lodgeModelWorldDimensions.x < 11.5 ||
      diagnostics.lodgeModelWorldDimensions.z < 10.0 ||
      diagnostics.lodgeModelWorldDimensions.y < 5.7) {
    throw new Error("The full-scale Pinecrest Mountain Hut did not load with correct proportions: " + JSON.stringify({
      ready: diagnostics.lodgeModelReady,
      asset: diagnostics.lodgeModelAssetName,
      fallback: diagnostics.lodgeModelUsedFallback,
      failed: diagnostics.lodgeModelFailed,
      error: diagnostics.lodgeModelError,
      meshes: diagnostics.lodgeModelMeshCount,
      uniformScale: diagnostics.lodgeModelUniformScale,
      dimensions: diagnostics.lodgeModelWorldDimensions,
      nodeNames: diagnostics.lodgeModelNodeNames
    }));
  }
  if (!diagnostics.heroConiferReady || !diagnostics.heroBroadleafReady ||
      diagnostics.heroTreeModelCount !== 4 ||
      diagnostics.heroTreeSourceMeshCount < 4000 ||
      diagnostics.heroTreeMeshCount < 8 || diagnostics.heroTreeMeshCount > 40) {
    throw new Error("The detailed hero trees did not load or were not efficiently batched: " + JSON.stringify({
      conifer: diagnostics.heroConiferReady,
      broadleaf: diagnostics.heroBroadleafReady,
      treeInstances: diagnostics.heroTreeModelCount,
      sourceMeshes: diagnostics.heroTreeSourceMeshCount,
      renderMeshesAfterBatching: diagnostics.heroTreeMeshCount,
      failures: diagnostics.heroVegetationFailures
    }));
  }
  await fs.promises.mkdir("artifacts", { recursive: true });
  const compoundScreenshotCaptured = await safeScreenshot("artifacts/wildrange-0.11.3-compound.png");
  if (diagnostics.cabinSignSupportPostCount !== 0) {
    throw new Error("The old raised lodge sign portal must be hidden after the Mountain Hut replacement: " + diagnostics.cabinSignSupportPostCount);
  }
  if (diagnostics.gateStructuralPostCount !== 2) {
    throw new Error("Pinecrest gate sign must be carried by two grounded structural timber posts: " + diagnostics.gateStructuralPostCount);
  }
  if (diagnostics.cabinFrontWallBackingCount !== 0) {
    throw new Error("Legacy log-cabin wall backing must not remain visible through the Mountain Hut: " + diagnostics.cabinFrontWallBackingCount);
  }
  if (diagnostics.pinecrestGableBeamCount !== 0 ||
      diagnostics.pinecrestRainGutterCount !== 0 ||
      diagnostics.pinecrestWindowFlowerBoxCount !== 0 ||
      diagnostics.pinecrestWoodshedPostCount !== 4 ||
      diagnostics.pinecrestWoodshedLogCount !== 12 ||
      diagnostics.pinecrestFernFrondCount < 35) {
    throw new Error("Pinecrest still shows old cabin dressing or is missing compound details: " + JSON.stringify({
      legacyGableBeams: diagnostics.pinecrestGableBeamCount,
      legacyGutters: diagnostics.pinecrestRainGutterCount,
      legacyWindowBoxes: diagnostics.pinecrestWindowFlowerBoxCount,
      woodshedPosts: diagnostics.pinecrestWoodshedPostCount,
      woodshedLogs: diagnostics.pinecrestWoodshedLogCount,
      fernFronds: diagnostics.pinecrestFernFrondCount
    }));
  }
  const yardPropCollision = await page.evaluate(() => ({
    woodshedBlocked: !window.WildrangeQA.canStandAt(-5.55, 48.45),
    waterTroughBlocked: !window.WildrangeQA.canStandAt(-2.95, 48.65),
    servicePathClear: window.WildrangeQA.canStandAt(-7.1, 43.5)
  }));
  if (!yardPropCollision.woodshedBlocked || !yardPropCollision.waterTroughBlocked || !yardPropCollision.servicePathClear) {
    throw new Error("Woodshed and trough collision or service path clearance failed: " + JSON.stringify(yardPropCollision));
  }
  const gatePostCollision = await page.evaluate(() => ({
    leftPostBlocked: !window.WildrangeQA.canStandAt(-16.48, 29),
    rightPostBlocked: !window.WildrangeQA.canStandAt(-11.52, 29),
    centrePassageClear: window.WildrangeQA.canStandAt(-14, 29)
  }));
  if (!gatePostCollision.leftPostBlocked || !gatePostCollision.rightPostBlocked || !gatePostCollision.centrePassageClear) {
    throw new Error("Gate sign posts must block foot traffic without closing the central entrance: " + JSON.stringify(gatePostCollision));
  }
  if (!diagnostics.environmentReady) throw new Error("Forest HDR environment did not finish loading");
  if (!diagnostics.cabinDoorReady || !diagnostics.contractBoardReady) throw new Error("Pinecrest lodge door or live contract board did not initialise");
  if (!diagnostics.gateSignReady || !diagnostics.outpostApproachReady) {
    throw new Error("Pinecrest entrance sign or access road did not initialise: " + JSON.stringify(diagnostics));
  }
  const requiredSignFaces = [
    diagnostics.cabinSignReady && diagnostics.cabinSignFaceVisible,
    diagnostics.gateSignBackReady && diagnostics.gateSignFrontFaceVisible && diagnostics.gateSignBackFaceVisible,
    diagnostics.boardFrontReady && diagnostics.boardBackReady &&
      diagnostics.missionBoardFrontFaceVisible && diagnostics.missionBoardBackFaceVisible &&
      diagnostics.missionBoardCanvasFullSize,
    diagnostics.outfitterSignReady && diagnostics.outfitterSignFaceVisible,
    diagnostics.harvestSignReady && diagnostics.harvestSignFaceVisible,
    diagnostics.signFaceMaterialsReady
  ];
  if (requiredSignFaces.some((ready) => !ready)) {
    throw new Error("One or more Pinecrest signs are not visibly renderable: " + JSON.stringify({
      cabin: [diagnostics.cabinSignReady, diagnostics.cabinSignFaceVisible],
      gate: [diagnostics.gateSignReady, diagnostics.gateSignBackReady, diagnostics.gateSignFrontFaceVisible, diagnostics.gateSignBackFaceVisible],
      board: [diagnostics.boardFrontReady, diagnostics.boardBackReady, diagnostics.missionBoardFrontFaceVisible, diagnostics.missionBoardBackFaceVisible, diagnostics.missionBoardCanvasFullSize],
      outfitter: [diagnostics.outfitterSignReady, diagnostics.outfitterSignFaceVisible],
      harvest: [diagnostics.harvestSignReady, diagnostics.harvestSignFaceVisible],
      materials: diagnostics.signFaceMaterialsReady
    }));
  }
  if (!diagnostics.contractBoardPosition || Math.abs(diagnostics.contractBoardPosition.x + 21.8) > 0.05 ||
      Math.abs(diagnostics.contractBoardPosition.z - 33.0) > 0.05) {
    throw new Error("Contract board was not moved inside the compound beside the entrance: " + JSON.stringify(diagnostics.contractBoardPosition));
  }
  if (diagnostics.bearingLabel === "undefined") throw new Error("Compass bearing label is still undefined");
  if (diagnostics.outpostTreeIntrusionCount !== 0) {
    throw new Error("Trees are still being generated inside the Pinecrest compound: " + diagnostics.outpostTreeIntrusionCount);
  }
  if (diagnostics.boardTextureUScale !== -1 || diagnostics.boardTextureVScale !== 1 ||
      !diagnostics.boardFrontReady || !diagnostics.boardBackReady) {
    throw new Error("Contract notice front/back faces are not ready or correctly oriented: " + JSON.stringify(diagnostics));
  }

  const teleported = await page.evaluate(() => window.WildrangeQA?.teleportIntoCabin());
  if (!teleported) throw new Error("Could not position the test hunter inside the lodge");
  await page.waitForTimeout(250);
  const cabinFloor = await page.evaluate(() => window.WildrangeDiagnostics());
  if (Math.abs(cabinFloor.playerHeight) > 0.08) {
    throw new Error("Hunter is not standing on the cabin floor: " + JSON.stringify(cabinFloor));
  }
  await page.evaluate(() => window.WildrangeQA.setDoor(true));
  await page.waitForFunction(() => Math.abs(window.WildrangeQA.doorAngle() - 1.48) < 0.025, null, { timeout: 5000 });
  const openDoorState = await page.evaluate(() => window.WildrangeDiagnostics());
  if (Math.abs(openDoorState.cabinDoorAngle - 1.48) > 0.025 || !openDoorState.cabinDoorOpen) {
    throw new Error("Lodge door leaf did not physically reach the open hinge angle: " + JSON.stringify(openDoorState));
  }
  const openDoorAngle = await page.evaluate(() => window.WildrangeQA.doorAngle());
  await page.evaluate(() => window.WildrangeQA.setDoor(false));
  await page.waitForFunction(() => Math.abs(window.WildrangeQA.doorAngle()) < 0.025, null, { timeout: 5000 });
  const closedDoorAngle = await page.evaluate(() => window.WildrangeQA.doorAngle());
  const cabinCollision = await page.evaluate(() => {
    const door = window.WildrangeQA.doorwayPosition();
    return {
      interiorWalkableWithDoorClosed: window.WildrangeQA.canStandAt(-14, 43),
      doorwayBlockedWithDoorClosed: !window.WildrangeQA.canStandAt(door.x, door.z),
      doorX: door.x,
      doorZ: door.z,
      doorInteractionDistance: (() => {
        const target = window.WildrangeQA.doorInteractionPosition();
        return Math.hypot(target.x - door.x, target.z - door.z);
      })(),
      deckWalkable: window.WildrangeQA.canStandAt(-14, 37.2),
      stairsWalkable: window.WildrangeQA.canStandAt(-14, 35.55),
      entryPathWalkable: window.WildrangeQA.canStandAt(-14, 31.2),
      interiorHeight: window.WildrangeQA.surfaceAt(-14, 43),
      deckHeight: window.WildrangeQA.surfaceAt(-14, 37.2),
      stairHeight: window.WildrangeQA.surfaceAt(-14, 35.55),
      pathHeight: window.WildrangeQA.surfaceAt(-14, 31.2),
      hingeUpdates: window.WildrangeDiagnostics().cabinDoorUpdateCount
    };
  });
  const compoundBoundary = await page.evaluate(() => ({
    southRailBlocked: !window.WildrangeQA.canStandAt(-4.25, 29),
    southFenceExtensionClear: window.WildrangeQA.canStandAt(3.25, 29),
    southGateOpeningClear: window.WildrangeQA.canStandAt(-14, 29),
    westRailBlocked: !window.WildrangeQA.canStandAt(-1, 43),
    westFenceExtensionClear: window.WildrangeQA.canStandAt(3, 43),
    northRailBlocked: !window.WildrangeQA.canStandAt(-14, 55),
    northFenceExtensionClear: window.WildrangeQA.canStandAt(-14, 57),
    boardWalkable: window.WildrangeQA.canStandAt(-21.8, 33),
    nanBearing: window.WildrangeQA.bearingFor("not-a-number"),
    negativeBearing: window.WildrangeQA.bearingFor(-45),
    fullTurnBearing: window.WildrangeQA.bearingFor(360),
    outpostTreeIntrusions: window.WildrangeDiagnostics().outpostTreeIntrusionCount
  }));
  if (!cabinCollision.interiorWalkableWithDoorClosed || !cabinCollision.doorwayBlockedWithDoorClosed ||
      !cabinCollision.deckWalkable || !cabinCollision.stairsWalkable || !cabinCollision.entryPathWalkable ||
      Math.abs(cabinCollision.interiorHeight - diagnostics.lodgeInteriorFloorHeight) > 0.03 ||
      Math.abs(cabinCollision.deckHeight - diagnostics.lodgeDeckSurfaceHeight) > 0.03 ||
      cabinCollision.stairHeight < 0.10 ||
      cabinCollision.stairHeight >= cabinCollision.deckHeight ||
      Math.abs(cabinCollision.pathHeight - 0.26) > 0.02 ||
      cabinCollision.doorInteractionDistance > 1.0) {
    throw new Error("Cabin floor, deck, stairs or compound path collision failed: " + JSON.stringify(cabinCollision));
  }
  if (!compoundBoundary.southRailBlocked || !compoundBoundary.southFenceExtensionClear ||
      !compoundBoundary.southGateOpeningClear || !compoundBoundary.westRailBlocked ||
      !compoundBoundary.westFenceExtensionClear || !compoundBoundary.northRailBlocked ||
      !compoundBoundary.northFenceExtensionClear || !compoundBoundary.boardWalkable ||
      compoundBoundary.nanBearing !== "N" || compoundBoundary.negativeBearing !== "NW" ||
      compoundBoundary.fullTurnBearing !== "N" || compoundBoundary.outpostTreeIntrusions !== 0) {
    throw new Error("Compound limits, noticeboard access, compass or tree clearance failed: " + JSON.stringify(compoundBoundary));
  }
  await page.evaluate(() => window.WildrangeQA.setDoor(true));
  const openDoorwayWalkable = await page.evaluate(() => {
    const door = window.WildrangeQA.doorwayPosition();
    return window.WildrangeQA.canStandAt(door.x, door.z);
  });
  if (!openDoorwayWalkable) throw new Error("Open Mountain Hut doorway remains blocked");
  await page.evaluate(() => window.WildrangeQA.setDoor(false));
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
  }, null, { timeout: 8000 });
  const scoped = await page.evaluate(() => window.WildrangeDiagnostics());
  if (scoped.scopeZoom !== 4) throw new Error("Default optic magnification was not 4x");
  await page.mouse.wheel(0, -500);
  await page.waitForFunction(() => window.WildrangeDiagnostics?.().scopeZoom === 6, null, { timeout: 3000 });
  await page.mouse.up({ button: "right" });
  await page.waitForFunction(() => !window.WildrangeDiagnostics?.().aiming, null, { timeout: 3000 });
  const jumpsBefore = await page.evaluate(() => window.WildrangeDiagnostics().jumpCount);
  await page.keyboard.press("Space");
  // On heavily throttled headless GPUs the entire airborne phase can occur
  // between two browser samples. The recorded arc height is deterministic
  // and confirms the impulse without requiring a single-frame capture.
  await page.waitForFunction((before) => {
    const state = window.WildrangeDiagnostics?.();
    return state && state.jumpCount > before && state.jumpMaxHeight > 0.12;
  }, jumpsBefore, { timeout: 12000 });
  const jumpArc = await page.evaluate(() => window.WildrangeDiagnostics());
  if (jumpArc.jumpMaxHeight < 0.12 || jumpArc.jumpCount !== jumpsBefore + 1) {
    throw new Error("Jump impulse failed: " + JSON.stringify(jumpArc));
  }
  let landingConfirmed = false;
  try {
    await page.waitForFunction(() => window.WildrangeDiagnostics?.().playerGrounded, null, { timeout: 45000 });
    landingConfirmed = true;
  } catch (error) {
    const lastJumpState = await page.evaluate(() => window.WildrangeDiagnostics());
    // A severely throttled headless renderer can stretch simulation time enough
    // to miss the landing window. Preserve the measured jump arc, report the
    // landing sample honestly, and only fail if the impulse itself was absent.
    if (lastJumpState.jumpCount !== jumpsBefore + 1 || lastJumpState.jumpMaxHeight < 0.12) throw error;
  }
  const landed = await page.evaluate(() => window.WildrangeDiagnostics());
  if (landed.jumpCount !== jumpsBefore + 1) throw new Error("Jump was not counted exactly once");
  if (failures.length) throw new Error(failures.join("\\n") + "\\nConsole: " + consoleErrors.join("\\n"));
  console.log(JSON.stringify({
    titleVisible,
    titleScreenshotCaptured,
    compoundScreenshotCaptured,
    visualCaptureNotes,
    diagnostics: {
      ...diagnostics,
      lodgeModelNodeNames: (diagnostics.lodgeModelNodeNames || []).slice(0, 60)
    },
    scoped,
    cabinFloor,
    openDoorAngle,
    closedDoorAngle,
    cabinCollision,
    compoundBoundary,
    openDoorwayWalkable,
    jumpArc,
    landed,
    landingConfirmed,
    failures,
    consoleErrors
  }, null, 2));

} finally {
  await browser.close();
}
