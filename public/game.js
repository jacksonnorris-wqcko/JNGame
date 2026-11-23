(() => {
  "use strict";

  const canvas = document.getElementById("render-canvas");
  const $ = (id) => document.getElementById(id);
  const BABYLON = window.BABYLON;

  if (!BABYLON) {
    $("center-message").textContent = "The 3D engine could not load. Check your internet connection and refresh.";
    $("center-message").classList.add("show");
    return;
  }

  const SAVE_KEY = "wildrange-solo-save-v1";
  const WORLD_LIMIT = 132;
  const speciesInfo = {
    deer: { label: "Whitetail Deer", hide: 1, meat: 2, xp: 45, value: 65, health: 100 },
    buck: { label: "Pinecrest Buck", hide: 2, meat: 3, xp: 65, value: 95, health: 125 },
    boar: { label: "Wild Boar", hide: 1, meat: 4, xp: 55, value: 85, health: 150 }
  };

  const defaults = {
    name: "Ranger", cash: 180, xp: 0, level: 1, ammo: 8, reserve: 40,
    hides: 0, meat: 0, harvested: 0, deerHarvested: 0, cleanKills: 0, contractAccepted: false,
    contractProgress: 0, contractComplete: false, health: 100, stamina: 100,
    medkits: 1, scent: 0, x: 0, z: 19, yaw: 0, unlocked: ["Pinecrest Valley"]
  };

  let state = { ...defaults };
  let scene, engine, camera, weaponRoot, weaponMaterials = {};
  let animals = [];
  let animalAssetPromises = {};
  let importedAnimalCount = 0, importedDeerCount = 0, importedBoarCount = 0;
  let modelLoadFailures = [];
  let weaponModelReady = false, weaponModelFailed = false;
  let weaponAssetMeshCount = 0, weaponScopePartCount = 0;
  let weaponBoltNode = null, weaponBoltBase = null, weaponBoltCycleElapsed = -1, weaponModelRoot = null;
  let weaponAnimationGroups = [], weaponAnimationClipNames = [], weaponActiveAnimation = null;
  let weaponFallbackUsed = false, weaponHasIntegratedScope = false;
  let weaponBaseY = -0.34;
  let footprints = [];
  let obstacles = [];
  let interactables = [];
  let lights = {};
  let miniMapCtx, worldMapCtx;
  let pointerLocked = false;
  let gameStarted = false;
  let paused = false;
  let aiming = false;
  let firing = false;
  let tracking = false;
  let crouched = false;
  let scentActiveUntil = 0;
  let playerMoving = false;
  let playerSprinting = false;
  let reloading = false;
  let reloadStarted = 0;
  let reloadDuration = 1450;
  let lastShot = 0;
  let shotAt = 0;
  let weaponKick = 0;
  let muzzleTimer = 0;
  let messageTimer = 0;
  let autosaveTimer = 0;
  let hudTimer = 0;
  let mapTimer = 0;
  let dayTime = 0.28;
  let nearestInteraction = null;
  let audioContext = null;
  let playerVelocity = new BABYLON.Vector3(0, 0, 0);
  let cabinDoorPivot = null;
  let cabinDoorOpen = false;
  let cabinDoorUpdateCount = 0;
  let contractBoardTexture = null;
  let contractBoardBackTexture = null;
  let contractBoardMaterial = null;
  let contractBoardBackMaterial = null;
  let contractBoardFrontMesh = null;
  let contractBoardBackMesh = null;
  let boardPaperFrontMesh = null;
  let boardPaperBackMesh = null;
  let contractBoardMesh = null;
  let gateSignTexture = null;
  let gateSignBackTexture = null;
  let outfitterSignTexture = null;
  let outfitterSignMaterial = null;
  let outfitterSignFrontMesh = null;
  let gateSignFrontMaterial = null;
  let gateSignBackMaterial = null;
  let gateSignFrontMesh = null;
  let gateSignBackMesh = null;
  let cabinSignTexture = null;
  let cabinSignMaterial = null;
  let cabinSignFrontMesh = null;
  let harvestSignTexture = null;
  let harvestSignMaterial = null;
  let harvestSignFrontMesh = null;
  let cabinFireFlame = null;
  let lodgeModelReady = false, lodgeModelLoading = false, lodgeModelFailed = false;
  let lodgeModelMeshCount = 0, lodgeModelError = "";
  let lodgeModelContainer = null, lodgeModelRoot = null;
  let lodgeModelAssetName = "", lodgeModelUsedFallback = false;
  let lodgeModelUniformScale = 0;
  let lodgeModelWorldDimensions = { x: 0, y: 0, z: 0 };
  let lodgeModelNodeNames = [];
  let heroConiferReady = false, heroBroadleafReady = false;
  let heroTreeModelCount = 0, heroTreeMeshCount = 0, heroTreeSourceMeshCount = 0;
  let heroVegetationFailures = [];
  let sceneInitError = "";
  // Reused movement vectors keep the fixed 60 Hz player step allocation-free.
  const playerForward = new BABYLON.Vector3(0, 0, 1);
  const playerRight = new BABYLON.Vector3(1, 0, 0);
  const playerMoveDirection = new BABYLON.Vector3(0, 0, 0);
  let verticalVelocity = 0;
  let playerGrounded = true;
  let lastGroundedAt = 0;
  let jumpCount = 0;
  let jumpMaxHeight = 0;
  let simulationAccumulator = 0;
  let simulationClock = 0;
  let animalUpdateAccumulator = 0;
  let worldAnimationAt = 0;
  let smoothedFps = 60;
  let averageFrameMs = 16.67;
  let renderScaleLevel = 1;
  let renderScaleBase = 1;
  let renderScaleCheckAt = 0;
  let renderScaleSlowFrames = 0;
  let renderScaleFastFrames = 0;
  const fogNightColor = new BABYLON.Color3(0.208, 0.267, 0.314);
  const fogDayColor = new BABYLON.Color3(0.714, 0.769, 0.706);
  const skyNightColor = new BABYLON.Color3(0.643, 0.706, 0.741);
  const skyDayColor = new BABYLON.Color3(1, 1, 1);
  let frozenStaticMeshCount = 0;
  let mergedSceneryBatchCount = 0;
  let mergedScenerySourceMeshCount = 0;
  let interactionUpdateAt = 0;
  let dayCycleUpdateAt = 0;
  let keys = new Set();
  let touchKeys = new Set();
  let currentTarget = null;
  let currentAnimal = null;
  let windMeshes = [];
  let waterRipples = [];
  let skySun = null;
  let scopeZoomIndex = 1;
  const scopeMagnifications = [2, 4, 6, 8];
  const scopeFovs = [0.42, 0.245, 0.18, 0.135];

  const mat = {};
  const rand = (min, max) => min + Math.random() * (max - min);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const distance2D = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const hex = (value) => BABYLON.Color3.FromHexString(value);
  const text = (id, value) => { if ($(id)) $(id).textContent = String(value); };

  function loadSave() {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
      if (saved && typeof saved === "object") state = { ...defaults, ...saved };
    } catch (error) {
      console.warn("Could not read local save:", error);
    }
    text("hunter-name", state.name.toUpperCase());
    $("player-name").value = state.name || "Ranger";
    $("continue-button").style.display = localStorage.getItem(SAVE_KEY) ? "block" : "none";
    $("start-save-status").textContent = localStorage.getItem(SAVE_KEY)
      ? "PREVIOUS HUNT FOUND · SAVED ON THIS DEVICE"
      : "SOLO FIELD TEST · PROGRESS SAVED IN THIS BROWSER";
  }

  function saveGame(showNotice) {
    if (!gameStarted) return;
    if (camera) {
      state.x = camera.position.x;
      state.z = camera.position.z;
      state.yaw = camera.rotation.y;
    }
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      if (showNotice) toast("Hunt saved on this device.", "success");
    } catch (error) {
      console.warn("Could not save hunt:", error);
      if (showNotice) toast("Browser storage is unavailable. Progress may not persist.", "warning");
    }
  }

  function resetSave() {
    localStorage.removeItem(SAVE_KEY);
    state = { ...defaults };
    state.name = $("player-name").value.trim().slice(0, 16) || "Ranger";
    state.x = 0;
    state.z = 19;
    state.yaw = 0;
    state.contractAccepted = false;
    state.contractProgress = 0;
    state.contractComplete = false;
    state.cash = defaults.cash;
    state.xp = 0;
    state.level = 1;
    state.ammo = 8;
    state.reserve = 40;
    state.hides = 0;
    state.meat = 0;
    state.harvested = 0;
    state.deerHarvested = 0;
    state.health = 100;
    state.stamina = 100;
    state.medkits = 1;
    state.scent = 0;
    state.cleanKills = 0;
    crouched = false;
    scentActiveUntil = 0;
    $("game-shell").classList.remove("crouched");
    updateHud();
    saveGame(false);
    toast("Fresh field record created.", "success");
  }

  function toast(message, type) {
    const item = document.createElement("div");
    item.className = "toast " + (type || "");
    item.textContent = message;
    $("toast-stack").appendChild(item);
    window.setTimeout(() => item.remove(), 3000);
  }

  function announce(message, duration) {
    $("center-message").textContent = message;
    $("center-message").classList.add("show");
    clearTimeout(messageTimer);
    messageTimer = window.setTimeout(() => $("center-message").classList.remove("show"), duration || 2600);
  }

  function sound(frequency, duration, kind, volume) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioContext) audioContext = new AudioCtx();
      if (audioContext.state === "suspended") audioContext.resume();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = kind || "triangle";
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(28, frequency * 0.48), audioContext.currentTime + duration);
      gain.gain.setValueAtTime(volume || 0.045, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
    } catch (error) { /* audio is optional */ }
  }

  function makeMaterial(name, color, roughness) {
    const material = new BABYLON.StandardMaterial(name, scene);
    material.diffuseColor = hex(color);
    material.specularColor = new BABYLON.Color3(0.08, 0.08, 0.07);
    material.roughness = roughness === undefined ? 0.9 : roughness;
    return material;
  }

  // Sign faces use their canvas texture as both diffuse and emissive input.
  // This keeps lettering legible in shadow and removes one-sided/depth-fight
  // failure modes from the old paper planes.
  function makeReadableSignMaterial(name, texture, mirrorU) {
    texture.hasAlpha = false;
    texture.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE;
    texture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
    texture.anisotropicFilteringLevel = 8;
    const material = new BABYLON.StandardMaterial(name, scene);
    material.diffuseTexture = texture;
    material.emissiveTexture = texture;
    material.emissiveColor = BABYLON.Color3.White();
    material.diffuseColor = BABYLON.Color3.White();
    material.specularColor = BABYLON.Color3.Black();
    material.disableLighting = true;
    material.backFaceCulling = false;
    material.useAlphaFromDiffuseTexture = false;
    material.zOffset = -4;
    material.zOffsetUnits = -4;
    if (mirrorU) {
      texture.uScale = -1;
      texture.uOffset = 1;
    } else {
      texture.uScale = 1;
      texture.uOffset = 0;
    }
    texture.vScale = 1;
    texture.vOffset = 0;
    return material;
  }

  function makePbrSurface(name, slug, tiling, tint, detailMaps) {
    const material = new BABYLON.PBRMaterial(name, scene);
    material.albedoColor = hex(tint || "#ffffff");
    material.metallic = 0;
    material.roughness = 1;
    material.environmentIntensity = 0.46;
    material.directIntensity = 1.05;
    const prefix = "./assets/pbr/" + slug + "/" + slug + "_";
    const texture = (suffix) => {
      const map = new BABYLON.Texture(prefix + suffix + ".jpg", scene, false, false, BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
      map.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
      map.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
      map.uScale = tiling || 1;
      map.vScale = tiling || 1;
      map.anisotropicFilteringLevel = 8;
      return map;
    };
    material.albedoTexture = texture("albedo");
    if (detailMaps !== false) {
      material.bumpTexture = texture("normal");
      material.roughnessTexture = texture("roughness");
      // AmbientCG Wood001 has no AO map; avoid requesting a non-existent file.
      if (slug !== "wood_planks") {
        material.ambientTexture = texture("ao");
        material.useAmbientInGrayScale = true;
      }
    }
    return material;
  }

  function createFoliageTexture(name, baseColor, variant) {
    const size = 512;
    const texture = new BABYLON.DynamicTexture(name, { width: size, height: size }, scene, true);
    const ctx = texture.getContext();
    let seed = name.split("").reduce((value, char) => (value * 33 + char.charCodeAt(0)) >>> 0, 1927);
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 1250; i++) {
      const x = random() * size, y = random() * size, radius = 5 + random() * 28;
      const shade = random() > 0.53 ? "rgba(157,183,112,.25)" : "rgba(8,29,20,.22)";
      const glow = ctx.createRadialGradient(x, y, 1, x, y, radius);
      glow.addColorStop(0, shade);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.ellipse(x, y, radius, radius * (0.45 + random() * 0.35), random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    if (variant === "pine") {
      for (let i = 0; i < 28000; i++) {
        const x = random() * size, y = random() * size;
        ctx.strokeStyle = random() > 0.57 ? "rgba(170,194,129,.68)" : "rgba(7,31,21,.58)";
        ctx.globalAlpha = 0.16 + random() * 0.42;
        ctx.lineWidth = 0.45 + random() * 1.25;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (random() - 0.5) * 4, y + 2 + random() * 10);
        ctx.stroke();
      }
    } else {
      const greens = ["#355d38", "#426f40", "#557f47", "#6e914e", "#86a25b", "#294d32"];
      for (let i = 0; i < 7600; i++) {
        const x = random() * size, y = random() * size;
        const rx = 1.8 + random() * 4.2, ry = 3.4 + random() * 8.2;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(random() * Math.PI);
        ctx.fillStyle = greens[Math.floor(random() * greens.length)];
        ctx.globalAlpha = 0.48 + random() * 0.45;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(194,205,142,.32)";
        ctx.lineWidth = 0.55;
        ctx.beginPath();
        ctx.moveTo(0, -ry * 0.72);
        ctx.lineTo(0, ry * 0.72);
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    texture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    texture.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    texture.anisotropicFilteringLevel = 8;
    texture.update(false);
    return texture;
  }

  function makeFoliageMaterial(name, baseColor, variant) {
    const material = new BABYLON.PBRMaterial(name, scene);
    material.albedoTexture = createFoliageTexture(name + "-foliage", baseColor, variant);
    material.albedoColor = BABYLON.Color3.White();
    material.metallic = 0;
    material.roughness = 0.94;
    material.environmentIntensity = 0.38;
    material.directIntensity = 1.0;
    return material;
  }

  function createFurTexture(name, baseColor, highlightColor) {
    const size = 512;
    const texture = new BABYLON.DynamicTexture(name, { width: size, height: size }, scene, true);
    const ctx = texture.getContext();
    let seed = name.split("").reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 811);
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 900; i++) {
      const x = random() * size, y = random() * size, r = 3 + random() * 22;
      const g = ctx.createRadialGradient(x, y, 1, x, y, r);
      g.addColorStop(0, random() > 0.5 ? highlightColor : "rgba(34,25,18,.16)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * (0.3 + random() * 0.45), random() * Math.PI, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 42000; i++) {
      const x = random() * size, y = random() * size;
      ctx.strokeStyle = random() > 0.56 ? highlightColor : "rgba(24,20,16,.22)";
      ctx.globalAlpha = 0.08 + random() * 0.2;
      ctx.lineWidth = 0.45 + random() * 1.05;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (random() - 0.5) * 1.8, y + 2 + random() * 8);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    texture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    texture.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    texture.anisotropicFilteringLevel = 8;
    texture.update(false);
    return texture;
  }

  function makeFurMaterial(name, baseColor, highlightColor) {
    const material = new BABYLON.PBRMaterial(name, scene);
    material.albedoTexture = createFurTexture(name + "-coat-texture", baseColor, highlightColor);
    material.metallic = 0;
    material.roughness = 0.94;
    material.environmentIntensity = 0.48;
    material.directIntensity = 1.1;
    return material;
  }

  function createProceduralSurfaceTexture(name, kind) {
    const size = 512;
    const texture = new BABYLON.DynamicTexture(name, { width: size, height: size }, scene, true);
    const ctx = texture.getContext();
    let seed = kind === "grass" ? 7319 : kind === "dirt" ? 28411 : kind === "water" ? 9127 : 4417;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    if (kind === "grass") {
      ctx.fillStyle = "#718856";
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 760; i++) {
        const x = random() * size, y = random() * size, r = 5 + random() * 34;
        const shade = random() > 0.5 ? "rgba(39,75,43,.17)" : "rgba(174,190,116,.16)";
        const g = ctx.createRadialGradient(x, y, 1, x, y, r);
        g.addColorStop(0, shade); g.addColorStop(1, "rgba(100,130,72,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      for (let i = 0; i < 18000; i++) {
        const light = random() > 0.52;
        ctx.fillStyle = light ? "rgba(190,204,139,.12)" : "rgba(26,56,36,.13)";
        const x = random() * size, y = random() * size;
        ctx.fillRect(x, y, 1 + random() * 2, 1 + random() * 2);
      }
      for (let i = 0; i < 780; i++) {
        const x = random() * size, y = random() * size;
        ctx.strokeStyle = random() > 0.5 ? "rgba(190,202,134,.12)" : "rgba(34,71,39,.12)";
        ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + random() * 3, y - 3 - random() * 6); ctx.stroke();
      }
      texture.uScale = 10; texture.vScale = 10;
    } else if (kind === "dirt") {
      ctx.fillStyle = "#a58b66"; ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 900; i++) {
        const x = random() * size, y = random() * size, r = 3 + random() * 26;
        ctx.fillStyle = random() > 0.5 ? "rgba(72,53,36,.13)" : "rgba(225,198,145,.19)";
        ctx.beginPath(); ctx.ellipse(x, y, r, r * (0.28 + random() * 0.55), random() * 3, 0, Math.PI * 2); ctx.fill();
      }
      for (let i = 0; i < 14500; i++) {
        ctx.fillStyle = random() > 0.5 ? "rgba(54,42,30,.16)" : "rgba(239,216,170,.2)";
        ctx.fillRect(random() * size, random() * size, 1 + random() * 2, 1);
      }
      texture.uScale = 7; texture.vScale = 7;
    } else if (kind === "water") {
      const g = ctx.createLinearGradient(0, 0, size, size);
      g.addColorStop(0, "#477b86"); g.addColorStop(0.5, "#679ca2"); g.addColorStop(1, "#477d88");
      ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 1550; i++) {
        const x = random() * size, y = random() * size, len = 4 + random() * 42;
        ctx.strokeStyle = random() > 0.55 ? "rgba(211,236,222,.18)" : "rgba(25,67,79,.12)";
        ctx.lineWidth = 0.6 + random() * 1.4;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + len * 0.5, y - 2, x + len, y + random() * 2); ctx.stroke();
      }
      texture.uScale = 3; texture.vScale = 3;
    } else {
      ctx.fillStyle = "#73543b"; ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 230; i++) {
        const x = random() * size, w = 1 + random() * 5;
        ctx.fillStyle = random() > 0.5 ? "rgba(36,27,19,.2)" : "rgba(193,143,86,.17)";
        ctx.fillRect(x, 0, w, size);
      }
      for (let i = 0; i < 360; i++) {
        ctx.strokeStyle = "rgba(31,24,18,.14)"; ctx.lineWidth = 1;
        const x = random() * size, y = random() * size;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + random() * 18, y + random() * 70); ctx.stroke();
      }
      texture.uScale = 2; texture.vScale = 3;
    }
    texture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    texture.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    texture.anisotropicFilteringLevel = 8;
    texture.update(false);
    return texture;
  }

  function createWeatheredRoofMaterial() {
    const size = 1024;
    const albedo = new BABYLON.DynamicTexture("Pinecrest weathered cedar shingle albedo", { width: size, height: size }, scene, true);
    const ctx = albedo.getContext();
    let seed = 41027;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    ctx.fillStyle = "#29231b";
    ctx.fillRect(0, 0, size, size);

    const tileW = 132;
    const tileH = 116;
    for (let row = -1; row < 10; row++) {
      const y = row * 104;
      const offset = row % 2 ? -66 : 0;
      for (let column = -1; column < 10; column++) {
        const x = column * tileW + offset;
        const width = tileW + randRoof(random, -5, 5);
        const height = tileH + randRoof(random, -4, 5);
        const tone = Math.floor(48 + random() * 30);
        const red = tone + 15 + Math.floor(random() * 12);
        const green = tone + 5 + Math.floor(random() * 8);
        const blue = tone - 5 + Math.floor(random() * 7);
        const fill = ctx.createLinearGradient(x, y, x + width * 0.08, y + height);
        fill.addColorStop(0, "rgb(" + (red + 14) + "," + (green + 12) + "," + (blue + 9) + ")");
        fill.addColorStop(0.16, "rgb(" + red + "," + green + "," + blue + ")");
        fill.addColorStop(0.72, "rgb(" + (red - 7) + "," + (green - 5) + "," + (blue - 4) + ")");
        fill.addColorStop(1, "rgb(" + (red - 17) + "," + (green - 13) + "," + (blue - 10) + ")");
        ctx.beginPath();
        ctx.moveTo(x + 3, y);
        ctx.lineTo(x + width - 3, y);
        ctx.lineTo(x + width - 2, y + height - 17);
        ctx.quadraticCurveTo(x + width * 0.5, y + height + 3, x + 2, y + height - 17);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = "rgba(13,12,9,.78)";
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.strokeStyle = "rgba(210,176,125,.30)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + 5, y + 3);
        ctx.lineTo(x + width - 5, y + 3);
        ctx.stroke();

        // Fine grain follows the shingle length; small knots break the repeated pattern.
        for (let grain = 0; grain < 13; grain++) {
          const gx = x + 8 + random() * (width - 16);
          const gy = y + 8 + random() * (height - 20);
          const length = 10 + random() * 50;
          ctx.strokeStyle = random() > 0.5 ? "rgba(18,14,10,.20)" : "rgba(225,190,137,.12)";
          ctx.lineWidth = 0.7 + random() * 1.2;
          ctx.beginPath();
          ctx.moveTo(gx, gy);
          ctx.bezierCurveTo(gx + 2, gy + length * 0.28, gx - 2, gy + length * 0.65, gx + 1, gy + length);
          ctx.stroke();
        }
        if (random() > 0.72) {
          const kx = x + 16 + random() * (width - 32);
          const ky = y + 22 + random() * (height - 42);
          ctx.strokeStyle = "rgba(20,15,10,.30)";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.ellipse(kx, ky, 4 + random() * 5, 7 + random() * 12, random(), 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
    albedo.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE;
    albedo.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
    albedo.anisotropicFilteringLevel = 16;
    albedo.update(false);

    // Build a height field from staggered shingle plates, then convert its
    // gradients into a normal map. This gives the broad roof plane real relief.
    const heightCanvas = document.createElement("canvas");
    heightCanvas.width = size;
    heightCanvas.height = size;
    const heightCtx = heightCanvas.getContext("2d");
    heightCtx.fillStyle = "rgb(35,35,35)";
    heightCtx.fillRect(0, 0, size, size);
    for (let row = -1; row < 10; row++) {
      const y = row * 104;
      const offset = row % 2 ? -66 : 0;
      for (let column = -1; column < 10; column++) {
        const x = column * tileW + offset;
        const g = heightCtx.createLinearGradient(x, y, x, y + tileH);
        g.addColorStop(0, "rgb(170,170,170)");
        g.addColorStop(0.82, "rgb(145,145,145)");
        g.addColorStop(0.94, "rgb(105,105,105)");
        g.addColorStop(1, "rgb(58,58,58)");
        heightCtx.fillStyle = g;
        heightCtx.fillRect(x + 2, y + 2, tileW - 4, tileH - 3);
        heightCtx.fillStyle = "rgb(72,72,72)";
        heightCtx.fillRect(x + 2, y + tileH - 5, tileW - 4, 4);
      }
    }
    const heightData = heightCtx.getImageData(0, 0, size, size);
    const normalCanvas = document.createElement("canvas");
    normalCanvas.width = size;
    normalCanvas.height = size;
    const normalCtx = normalCanvas.getContext("2d");
    const normalData = normalCtx.createImageData(size, size);
    const source = heightData.data;
    const target = normalData.data;
    for (let y = 1; y < size - 1; y++) {
      for (let x = 1; x < size - 1; x++) {
        const index = (y * size + x) * 4;
        const left = source[index - 4], right = source[index + 4];
        const up = source[index - size * 4], down = source[index + size * 4];
        let nx = (left - right) * 0.035;
        let ny = (up - down) * 0.035;
        const length = Math.sqrt(nx * nx + ny * ny + 1);
        nx /= length; ny /= length;
        target[index] = Math.round((nx * 0.5 + 0.5) * 255);
        target[index + 1] = Math.round((ny * 0.5 + 0.5) * 255);
        target[index + 2] = Math.round((1 / length * 0.5 + 0.5) * 255);
        target[index + 3] = 255;
      }
    }
    normalCtx.putImageData(normalData, 0, 0);
    const normal = new BABYLON.DynamicTexture("Pinecrest cedar shingle normal map", normalCanvas, scene, false);
    normal.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE;
    normal.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
    normal.anisotropicFilteringLevel = 16;
    normal.update(false);

    const material = new BABYLON.PBRMaterial("Pinecrest hand-laid cedar shingle roof", scene);
    material.albedoTexture = albedo;
    material.bumpTexture = normal;
    material.albedoColor = BABYLON.Color3.White();
    material.metallic = 0;
    material.roughness = 0.91;
    material.environmentIntensity = 0.42;
    material.directIntensity = 1.0;
    material.backFaceCulling = true;
    return material;
  }

  function randRoof(random, min, max) {
    return min + random() * (max - min);
  }

  function createLogEndgrainMaterial() {
    const texture = new BABYLON.DynamicTexture("Pinecrest exposed log end grain", { width: 256, height: 256 }, scene, true);
    const ctx = texture.getContext();
    ctx.fillStyle = "#775336";
    ctx.fillRect(0, 0, 256, 256);
    const cx = 128, cy = 128;
    for (let ring = 0; ring < 25; ring++) {
      const radius = 7 + ring * 4.6 + Math.sin(ring * 1.7) * 2.2;
      ctx.beginPath();
      ctx.ellipse(cx + Math.sin(ring * 0.63) * 2, cy + Math.cos(ring * 0.42) * 2, radius, radius * (0.94 + Math.sin(ring) * 0.035), ring * 0.06, 0, Math.PI * 2);
      ctx.strokeStyle = ring % 3 === 0 ? "rgba(39,25,16,.72)" : "rgba(211,173,121,.46)";
      ctx.lineWidth = ring % 4 === 0 ? 2.1 : 1.1;
      ctx.stroke();
    }
    for (let crack = 0; crack < 8; crack++) {
      const angle = crack / 8 * Math.PI * 2 + 0.16;
      ctx.strokeStyle = "rgba(37,24,15,.58)";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * 30, cy + Math.sin(angle) * 30);
      ctx.lineTo(cx + Math.cos(angle + 0.02) * (87 + (crack % 3) * 7), cy + Math.sin(angle + 0.02) * (87 + (crack % 3) * 7));
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(122, 132, 13, 9, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(43,27,17,.35)";
    ctx.fill();
    texture.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE;
    texture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
    texture.anisotropicFilteringLevel = 8;
    texture.update(false);
    const material = new BABYLON.PBRMaterial("Pinecrest cut timber end-grain", scene);
    material.albedoTexture = texture;
    material.metallic = 0;
    material.roughness = 0.96;
    material.environmentIntensity = 0.28;
    return material;
  }

  function createMaterials() {
    mat.grass = makePbrSurface("Pinecrest meadow grass", "grass", 34, "#dce8cf");
    mat.grassLight = mat.grass;
    mat.grassDark = mat.grass;
    mat.dirt = makePbrSurface("Forest-floor trail", "forest_floor", 26, "#d1c0a0");
    mat.dirtLight = makePbrSurface("Trail shoulder", "forest_floor", 18, "#e0d2b5");
    mat.water = makeMaterial("Stillwater lake water", "#6f9ba1", 0.16);
    mat.water.alpha = 0.94;
    mat.water.specularColor = new BABYLON.Color3(0.78, 0.86, 0.9);
    mat.water.specularPower = 128;
    mat.bark = makePbrSurface("Photographic tree bark", "bark", 2.4, "#d4c1a5");
    mat.pine1 = makeFoliageMaterial("Pine needles dark", "#173c2b", "pine");
    mat.pine2 = makeFoliageMaterial("Pine needles mid", "#245238", "pine");
    mat.pine3 = makeFoliageMaterial("Pine needles sunlit", "#315f3d", "pine");
    mat.leaf1 = makeFoliageMaterial("Broadleaf foliage dark", "#254b2f", "broadleaf");
    mat.leaf2 = makeFoliageMaterial("Broadleaf foliage mid", "#35633a", "broadleaf");
    mat.leaf3 = makeFoliageMaterial("Broadleaf foliage light", "#4c7943", "broadleaf");
    mat.stone = makePbrSurface("Mossy fieldstone", "rock", 2.6, "#c9c7b2");
    mat.stoneDark = makePbrSurface("Shaded fieldstone", "rock", 2.1, "#8d9486");
    mat.mountain1 = makeMaterial("Distant forest mountain", "#526a5e", 0.98);
    mat.mountain2 = makeMaterial("Blue-grey far ridge", "#718078", 0.98);
    mat.wood = makePbrSurface("Weathered timber boards", "wood_planks", 3.4, "#e1c59f");
    mat.woodLight = makePbrSurface("Pinecrest exterior siding", "wood_siding", 3.2, "#e1d4ba");
    mat.roof = makePbrSurface("Weathered roof shingles", "wood_planks", 5, "#8f8067");
    mat.roofLight = makePbrSurface("Roof edge timber", "wood_planks", 2.5, "#bba27d");
    mat.roofShingle = createWeatheredRoofMaterial();
    mat.logEndgrain = createLogEndgrainMaterial();
    mat.rifleWood = makePbrSurface("Rifle walnut furniture", "wood_planks", 1.8, "#a37a50");
    mat.metal = new BABYLON.PBRMaterial("Blued rifle steel", scene);
    mat.metal.albedoColor = hex("#303a39");
    mat.metal.metallic = 0.86;
    mat.metal.roughness = 0.32;
    mat.black = new BABYLON.PBRMaterial("Blackened rifle metal", scene);
    mat.black.albedoColor = hex("#101918");
    mat.black.metallic = 0.82;
    mat.black.roughness = 0.4;
    mat.gold = new BABYLON.PBRMaterial("Brass hardware", scene);
    mat.gold.albedoColor = hex("#9c7b42");
    mat.gold.metallic = 0.78;
    mat.gold.roughness = 0.34;
    mat.window = makeMaterial("Warm cabin glass", "#d9b879", 0.25);
    mat.window.emissiveColor = hex("#8d5b2e");
    mat.window.specularColor = new BABYLON.Color3(0.7, 0.62, 0.42);
    mat.antler = makeMaterial("Antler ivory", "#c8b996", 0.75);
    mat.hoof = makeMaterial("Hoof keratin", "#28231e", 0.52);
    mat.track = makeMaterial("Fresh hoof sign", "#c7b58d");
    mat.bloodless = makeMaterial("Harvest marker", "#e3c68c");
    mat.fence = mat.wood;
    mat.sign = mat.wood;
    mat.boar = makeFurMaterial("Wild boar coarse coat", "#534638", "rgba(181,145,104,.34)");
    mat.boarLight = makeFurMaterial("Wild boar face", "#76634e", "rgba(207,177,139,.26)");
    mat.boarTusks = makeMaterial("Boar ivory", "#e4d9bd", 0.28);
    mat.deer = makeFurMaterial("Whitetail coat", "#98704b", "rgba(222,173,113,.3)");
    mat.deerLight = makeFurMaterial("Deer warm coat", "#b98758", "rgba(236,205,157,.34)");
    mat.deerDark = makeFurMaterial("Buck dark coat", "#6c4c34", "rgba(180,127,76,.32)");
    mat.fawn = makeFurMaterial("Doe and fawn coat", "#b88b5c", "rgba(241,211,164,.34)");
    mat.white = makeMaterial("Wildlife cream", "#e4d8c1");
    mat.eye = new BABYLON.PBRMaterial("Wildlife eyes", scene);
    mat.eye.albedoColor = hex("#171512");
    mat.eye.metallic = 0.02;
    mat.eye.roughness = 0.18;
    mat.grassBlade = makeMaterial("Meadow grass blades", "#ffffff");
    mat.grassBlade.useVertexColors = true;
    mat.grassBlade.backFaceCulling = false;
    mat.grassBlade.specularColor = new BABYLON.Color3(0.01, 0.018, 0.008);
    mat.shore = makePbrSurface("Lake gravel and shore", "rock", 4, "#b9af93");
    mat.waterRipple = makeMaterial("Lake water glints", "#c5e0db");
    mat.waterRipple.alpha = 0.16;
    mat.waterRipple.disableLighting = true;
    mat.flowerGold = makeMaterial("Meadow flowers gold", "#e6c77b");
    mat.flowerCream = makeMaterial("Meadow flowers cream", "#e7e4ca");
  }

  function heightAt(x, z) {
    if (flatArea(x, z)) return 0.1;
    return Math.sin(x * 0.031) * 1.8 + Math.cos(z * 0.027) * 1.7 +
      Math.sin((x + z) * 0.016) * 2.35 + Math.cos((x - z) * 0.022) * 1.1 +
      Math.sin(z * 0.011 + x * 0.008) * 1.65;
  }

  function flatArea(x, z) {
    return Math.hypot(x, z - 31) < 22;
  }

  // Keep tall trees and large undergrowth out of the Pinecrest lodge and its yard.
  // The wider clearance accounts for the tree crowns, not just their trunk positions.
  function isPinecrestCompoundClearance(x, z) {
    const localX = x + 14;
    const localZ = z - 43;
    return Math.abs(localX) < 31 && localZ > -29 && localZ < 29;
  }

  function makeTerrain() {
    const ground = BABYLON.MeshBuilder.CreateGround("Pinecrest terrain", {
      width: 280, height: 280, subdivisions: 150, updatable: true
    }, scene);
    const positions = ground.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    const indices = ground.getIndices();
    const normals = [];
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const z = positions[i + 2];
      positions[i + 1] = flatArea(x, z) ? 0.1 : heightAt(x, z);
    }
    BABYLON.VertexData.ComputeNormals(positions, indices, normals);
    ground.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
    ground.updateVerticesData(BABYLON.VertexBuffer.NormalKind, normals);
    ground.material = mat.grass;
    ground.isPickable = true;
    ground.receiveShadows = true;
    return ground;
  }

  function makePath(points, width, material, name) {
    const left = [], right = [];
    for (let i = 0; i < points.length; i++) {
      const previous = points[Math.max(0, i - 1)];
      const next = points[Math.min(points.length - 1, i + 1)];
      const dx = next.x - previous.x;
      const dz = next.z - previous.z;
      const length = Math.max(0.001, Math.hypot(dx, dz));
      const ox = -(dz / length) * width / 2;
      const oz = (dx / length) * width / 2;
      left.push(new BABYLON.Vector3(points[i].x + ox, heightAt(points[i].x + ox, points[i].z + oz) + 0.09, points[i].z + oz));
      right.push(new BABYLON.Vector3(points[i].x - ox, heightAt(points[i].x - ox, points[i].z - oz) + 0.09, points[i].z - oz));
    }
    const ribbon = BABYLON.MeshBuilder.CreateRibbon(name, { pathArray: [left, right], sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
    ribbon.material = material;
    ribbon.isPickable = false;
    return ribbon;
  }

  function bezierPoint(t, a, b, c, d) {
    const mt = 1 - t;
    return {
      x: mt * mt * mt * a.x + 3 * mt * mt * t * b.x + 3 * mt * t * t * c.x + t * t * t * d.x,
      z: mt * mt * mt * a.z + 3 * mt * mt * t * b.z + 3 * mt * t * t * c.z + t * t * t * d.z
    };
  }

  function buildTrail() {
    const p = [];
    const a = { x: 0, z: 32 }, b = { x: -6, z: 52 }, c = { x: 4, z: 71 }, d = { x: 9, z: 103 };
    for (let i = 0; i <= 30; i++) p.push(bezierPoint(i / 30, a, b, c, d));
    makePath(p, 4.8, mat.dirt, "Pinecrest trail");
    const p2 = [];
    const a2 = { x: 7, z: 75 }, b2 = { x: 24, z: 86 }, c2 = { x: 34, z: 101 }, d2 = { x: 56, z: 108 };
    for (let i = 0; i <= 18; i++) p2.push(bezierPoint(i / 18, a2, b2, c2, d2));
    makePath(p2, 3.2, mat.dirtLight, "East ridge track");
  }

  function createTree(x, z, scale, broadleaf) {
    const root = new BABYLON.TransformNode("forest-tree-root", scene);
    root.position.set(x, heightAt(x, z), z);
    root.rotation.y = rand(0, Math.PI * 2);
    const height = (broadleaf ? 6.8 : 8.4) * scale;
    const trunk = BABYLON.MeshBuilder.CreateCylinder("photographic-bark-trunk", {
      height, diameterTop: 0.18 * scale, diameterBottom: 0.56 * scale, tessellation: 24
    }, scene);
    trunk.parent = root;
    trunk.position.y = height * 0.48;
    trunk.material = mat.bark;
    trunk.isPickable = false;
    trunk.receiveShadows = false;

    if (broadleaf) {
      const clusters = [
        [-0.95, 3.85, -0.3, 1.48], [0.78, 4.05, 0.42, 1.62],
        [-0.34, 5.05, 0.58, 1.45], [0.25, 5.75, -0.46, 1.38],
        [1.02, 3.72, -0.52, 1.22], [-1.02, 4.65, 0.55, 1.25],
        [0.04, 4.25, 0.0, 1.72], [-0.28, 6.15, 0.05, 1.08],
        [0.78, 5.15, -0.1, 1.18]
      ];
      clusters.forEach((entry, index) => {
        const crown = BABYLON.MeshBuilder.CreateSphere("photographic broadleaf crown", {
          diameter: entry[3] * scale * 2, segments: 20
        }, scene);
        crown.parent = root;
        crown.position.set(entry[0] * scale, entry[1] * scale, entry[2] * scale);
        crown.scaling.set(rand(0.82, 1.18), rand(0.78, 1.08), rand(0.86, 1.16));
        crown.rotation.set(rand(-0.12, 0.12), rand(0, Math.PI * 2), rand(-0.12, 0.12));
        crown.material = [mat.leaf1, mat.leaf2, mat.leaf3][index % 3];
        crown.isPickable = false;
        crown.receiveShadows = false;
      });
    } else {
      const whorls = [
        { y: 2.55, r: 2.48, h: 2.05 }, { y: 3.48, r: 2.18, h: 2.0 },
        { y: 4.42, r: 1.92, h: 1.88 }, { y: 5.35, r: 1.62, h: 1.72 },
        { y: 6.22, r: 1.30, h: 1.55 }, { y: 7.02, r: 0.92, h: 1.35 }
      ];
      whorls.forEach((whorl, index) => {
        const crown = BABYLON.MeshBuilder.CreateSphere("pine needle bough cluster", {
          diameter: whorl.r * scale * 2, segments: 18
        }, scene);
        crown.parent = root;
        crown.position.set(rand(-0.15, 0.15) * scale, whorl.y * scale, rand(-0.15, 0.15) * scale);
        crown.scaling.set(rand(0.9, 1.14), (whorl.h / whorl.r) * rand(0.94, 1.1), rand(0.9, 1.12));
        crown.rotation.y = rand(0, Math.PI * 2);
        crown.material = [mat.pine1, mat.pine2, mat.pine3, mat.pine2][index % 4];
        crown.isPickable = false;
        crown.receiveShadows = false;
      });
      for (let branch = 0; branch < 7; branch++) {
        const angle = branch / 7 * Math.PI * 2 + rand(-0.15, 0.15);
        const y = rand(2.3, 4.7) * scale;
        const limb = BABYLON.MeshBuilder.CreateCylinder("pine branch", {
          height: rand(1.15, 1.75) * scale,
          diameterTop: 0.045 * scale,
          diameterBottom: 0.13 * scale,
          tessellation: 7
        }, scene);
        limb.parent = root;
        limb.rotation.z = Math.PI / 2 - 0.32;
        limb.rotation.y = angle;
        limb.position.set(Math.cos(angle) * 0.65 * scale, y, Math.sin(angle) * 0.65 * scale);
        limb.material = mat.bark;
        limb.isPickable = false;
      }
    }
    obstacles.push({ x, z, radius: broadleaf ? 1.35 * scale : 0.82 * scale });
    return root;
  }

  function createRock(x, z, scale) {
    const rock = BABYLON.MeshBuilder.CreateIcoSphere("weathered fieldstone", {
      radius: scale, subdivisions: 2
    }, scene);
    rock.position.set(x, heightAt(x, z) + scale * 0.36, z);
    rock.scaling.set(rand(0.95, 1.35), rand(0.62, 0.88), rand(0.82, 1.18));
    rock.rotation.set(rand(-0.22, 0.22), rand(0, Math.PI), rand(-0.2, 0.2));
    rock.material = Math.random() > 0.45 ? mat.stone : mat.stoneDark;
    rock.isPickable = false;
    rock.receiveShadows = false;
    obstacles.push({ x, z, radius: scale * 0.85 });
  }

  function createPinecrestLake() {
    const shore = BABYLON.MeshBuilder.CreateDisc("lake-shore", { radius: 22, tessellation: 48 }, scene);
    shore.rotation.x = Math.PI / 2;
    shore.position.set(55, heightAt(55, -44) + 0.05, -44);
    shore.scaling.set(1.3, 0.8, 1);
    shore.material = mat.shore;
    shore.isPickable = false;
    const water = BABYLON.MeshBuilder.CreateDisc("Stillwater Lake", { radius: 20.7, tessellation: 48 }, scene);
    water.rotation.x = Math.PI / 2;
    water.position.set(55, heightAt(55, -44) + 0.12, -44);
    water.scaling.set(1.3, 0.8, 1);
    water.material = mat.water;
    water.isPickable = false;
    water.receiveShadows = false;
    const waterGlow = makeMaterial("lake-glint", "#b7d4d0");
    waterGlow.alpha = 0.16;
    waterGlow.disableLighting = true;
    const shimmer = BABYLON.MeshBuilder.CreateDisc("lake shimmer", { radius: 8, tessellation: 48 }, scene);
    shimmer.rotation.x = Math.PI / 2;
    shimmer.position.set(49, heightAt(49, -43) + 0.15, -43);
    shimmer.scaling.set(1.3, 0.25, 1);
    shimmer.material = waterGlow;
    shimmer.isPickable = false;
    for (let i = 0; i < 5; i++) {
      const ring = BABYLON.MeshBuilder.CreateTorus("Stillwater ripple", {
        diameter: rand(3.2, 8.5), thickness: 0.035 + rand(0, 0.02), tessellation: 48
      }, scene);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(55 + rand(-13, 13), water.position.y + 0.08 + i * 0.003, -44 + rand(-7, 7));
      ring.scaling.set(1.35, 0.78, 1);
      ring.material = waterGlow;
      ring.isPickable = false;
      waterRipples.push({ mesh: ring, baseX: ring.scaling.x, baseY: ring.scaling.y, phase: rand(0, 10) });
    }
  }

  function box(name, size, position, material, parent) {
    const mesh = BABYLON.MeshBuilder.CreateBox(name, size, scene);
    mesh.position.copyFrom(position);
    mesh.material = material;
    mesh.parent = parent || null;
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    return mesh;
  }

  function createCabin() {
    const root = new BABYLON.TransformNode("Pinecrest timber lodge", scene);
    root.position.set(-14, 0, 43);

    box("lodge stone foundation", { width: 12.1, height: 0.72, depth: 9.1 }, new BABYLON.Vector3(0, 0.48, 0), mat.stoneDark, root);
    box("lodge timber floor", { width: 11.8, height: 0.22, depth: 8.8 }, new BABYLON.Vector3(0, 0.91, 0), mat.wood, root);
    for (let board = 0; board < 18; board++) {
      box("interior pine floorboard", { width: 11.55, height: 0.035, depth: 0.405 },
        new BABYLON.Vector3(0, 1.04, -3.65 + board * 0.43), board % 3 === 0 ? mat.woodLight : mat.wood, root);
    }
    for (const z of [-3.78, 3.78]) box("interior floor skirting", { width: 10.7, height: 0.18, depth: 0.12 }, new BABYLON.Vector3(0, 1.16, z), mat.woodLight, root);
    for (const x of [-5.22, 5.22]) box("interior side skirting", { width: 0.12, height: 0.18, depth: 7.55 }, new BABYLON.Vector3(x, 1.16, 0), mat.woodLight, root);
    // Build separate interior wall panels so the lodge has a real walkable room.
    box("lodge interior left wall", { width: 0.24, height: 4.9, depth: 8.0 }, new BABYLON.Vector3(-5.42, 3.55, 0), mat.woodLight, root);
    box("lodge interior right wall", { width: 0.24, height: 4.9, depth: 8.0 }, new BABYLON.Vector3(5.42, 3.55, 0), mat.woodLight, root);
    box("lodge interior rear wall", { width: 10.8, height: 4.9, depth: 0.24 }, new BABYLON.Vector3(0, 3.55, 3.94), mat.woodLight, root);
    box("lodge interior front lintel", { width: 11.0, height: 1.15, depth: 0.24 }, new BABYLON.Vector3(0, 5.35, -3.96), mat.woodLight, root);

    for (let row = 0; row < 10; row++) {
      const y = 1.28 + row * 0.46;
      const frontSegments = y < 4.05 ? [[-3.45, 4.8], [3.45, 4.8]] : [[0, 11.7]];
      for (const [frontX, frontLength] of frontSegments) {
        const front = BABYLON.MeshBuilder.CreateCylinder("front log course", {
          height: frontLength, diameterTop: 0.40, diameterBottom: 0.48, tessellation: 24
        }, scene);
        front.parent = root; front.rotation.z = Math.PI / 2; front.position.set(frontX, y, -4.08);
        front.material = mat.bark; front.isPickable = false; front.receiveShadows = true;
        for (const end of [-1, 1]) {
          const cutFace = BABYLON.MeshBuilder.CreateCylinder("Pinecrest front log cut end",
            { height: 0.026, diameterTop: 0.39, diameterBottom: 0.39, tessellation: 24 }, scene);
          cutFace.parent = root;
          cutFace.rotation.z = Math.PI / 2;
          cutFace.position.set(frontX + end * (frontLength / 2 + 0.012), y, -4.08);
          cutFace.material = mat.logEndgrain;
          cutFace.isPickable = false;
          cutFace.receiveShadows = true;
        }
      }
      const rear = BABYLON.MeshBuilder.CreateCylinder("rear log course", {
        height: 11.7, diameterTop: 0.40, diameterBottom: 0.48, tessellation: 24
      }, scene);
      rear.parent = root; rear.rotation.z = Math.PI / 2; rear.position.set(0, y, 4.08);
      rear.material = mat.bark; rear.isPickable = false; rear.receiveShadows = true;
      for (const end of [-1, 1]) {
        const cutFace = BABYLON.MeshBuilder.CreateCylinder("Pinecrest rear log cut end",
          { height: 0.026, diameterTop: 0.39, diameterBottom: 0.39, tessellation: 24 }, scene);
        cutFace.parent = root;
        cutFace.rotation.z = Math.PI / 2;
        cutFace.position.set(end * 5.87, y, 4.08);
        cutFace.material = mat.logEndgrain;
        cutFace.isPickable = false;
        cutFace.receiveShadows = true;
      }
      for (const side of [-1, 1]) {
        const wall = BABYLON.MeshBuilder.CreateCylinder("side log course", {
          height: 9.55, diameterTop: 0.40, diameterBottom: 0.48, tessellation: 24
        }, scene);
        wall.parent = root; wall.rotation.x = Math.PI / 2; wall.position.set(side * 5.55, y, 0);
        wall.material = mat.bark; wall.isPickable = false; wall.receiveShadows = true;
        for (const end of [-1, 1]) {
          const cutFace = BABYLON.MeshBuilder.CreateCylinder("Pinecrest side log cut end",
            { height: 0.026, diameterTop: 0.39, diameterBottom: 0.39, tessellation: 24 }, scene);
          cutFace.parent = root;
          cutFace.rotation.x = Math.PI / 2;
          cutFace.position.set(side * 5.55, y, end * 4.79);
          cutFace.material = mat.logEndgrain;
          cutFace.isPickable = false;
          cutFace.receiveShadows = true;
        }
      }
    }

    // Weather-sealed backing closes the gaps between the horizontal log courses.
    // The two panels stop at the door opening; the glowing window panes remain in front.
    const lodgeFrontInfill = makePbrSurface(
      "Pinecrest lodge opaque timber wall backing", "wood_siding", 2.4, "#a98257", false
    );
    for (const side of [-1, 1]) {
      const infill = box(
        "Pinecrest lodge front wall opaque backing",
        { width: 4.78, height: 2.88, depth: 0.14 },
        new BABYLON.Vector3(side * 3.45, 2.68, -3.76),
        lodgeFrontInfill, root
      );
      infill.isPickable = false;
      infill.receiveShadows = true;
    }

    // A lived-in ranger cabin: bunk, writing desk, stove, shelves and warm interior light.
    box("cabin woven rug", { width: 4.0, height: 0.035, depth: 3.0 }, new BABYLON.Vector3(0.5, 1.04, 1.0), mat.sign, root);
    box("ranger bunk frame", { width: 2.5, height: 0.42, depth: 3.4 }, new BABYLON.Vector3(-3.55, 1.28, 1.55), mat.wood, root);
    box("ranger bunk mattress", { width: 2.35, height: 0.3, depth: 3.15 }, new BABYLON.Vector3(-3.55, 1.62, 1.55), mat.roofLight, root);
    box("folded blanket", { width: 2.36, height: 0.13, depth: 1.25 }, new BABYLON.Vector3(-3.55, 1.84, 2.35), mat.sign, root);
    box("bunk pillow", { width: 1.0, height: 0.22, depth: 0.58 }, new BABYLON.Vector3(-3.55, 1.83, 0.35), mat.window, root);
    box("ranger bunk quilt", { width: 2.25, height: 0.09, depth: 2.18 }, new BABYLON.Vector3(-3.55, 1.82, 1.5), mat.sign, root);
    for (const x of [-4.65, -2.45]) for (const z of [0.0, 3.1]) {
      box("bunk timber leg", { width: 0.14, height: 0.86, depth: 0.14 }, new BABYLON.Vector3(x, 1.22, z), mat.bark, root);
    }
    box("bunk headboard", { width: 2.55, height: 1.12, depth: 0.16 }, new BABYLON.Vector3(-3.55, 1.72, 3.25), mat.woodLight, root);
    box("bedside field chest", { width: 1.0, height: 0.68, depth: 0.82 }, new BABYLON.Vector3(-1.85, 1.36, 2.95), mat.wood, root);
    box("bedside chest lid", { width: 1.08, height: 0.12, depth: 0.9 }, new BABYLON.Vector3(-1.85, 1.75, 2.95), mat.woodLight, root);
    const chestLatch = BABYLON.MeshBuilder.CreateSphere("bedside chest brass latch", { diameter: 0.11, segments: 8 }, scene);
    chestLatch.parent = root; chestLatch.position.set(-1.85, 1.52, 2.48); chestLatch.material = mat.gold; chestLatch.isPickable = false;
    box("writing desk", { width: 2.7, height: 0.16, depth: 1.05 }, new BABYLON.Vector3(2.75, 2.05, 2.65), mat.woodLight, root);
    for (const x of [1.65, 3.85]) for (const z of [2.3, 3.0]) box("desk leg", { width: 0.13, height: 1.95, depth: 0.13 }, new BABYLON.Vector3(x, 1.05, z), mat.bark, root);
    box("field journal", { width: 0.62, height: 0.1, depth: 0.46 }, new BABYLON.Vector3(2.35, 2.18, 2.55), mat.roof, root);
    box("oil lamp base", { width: 0.22, height: 0.12, depth: 0.22 }, new BABYLON.Vector3(3.35, 2.18, 2.55), mat.black, root);
    const cabinLamp = BABYLON.MeshBuilder.CreateSphere("cabin desk lamp", { diameter: 0.22, segments: 10 }, scene);
    cabinLamp.parent = root; cabinLamp.position.set(3.35, 2.38, 2.55); cabinLamp.material = mat.gold; cabinLamp.isPickable = false;
    const interiorLight = new BABYLON.PointLight("warm cabin interior", new BABYLON.Vector3(-14, 4.1, 44.5), scene);
    interiorLight.diffuse = hex("#ffd19a"); interiorLight.intensity = 0.88; interiorLight.range = 16;
    const rearWallLight = new BABYLON.PointLight("cabin rear wall lantern", new BABYLON.Vector3(-14, 4.2, 46.1), scene);
    rearWallLight.diffuse = hex("#f4bd7a"); rearWallLight.intensity = 0.32; rearWallLight.range = 11;
    box("cabin stove body", { width: 1.05, height: 1.55, depth: 0.95 }, new BABYLON.Vector3(3.75, 1.82, -2.65), mat.black, root);
    const stoveDoor = box("cabin stove iron door", { width: 0.58, height: 0.65, depth: 0.06 }, new BABYLON.Vector3(3.75, 1.7, -3.15), mat.stone, root);
    const stoveDoorMaterial = makeMaterial("Cabin stove firebox", "#5b2815", 0.8);
    stoveDoorMaterial.emissiveColor = hex("#5b2815"); stoveDoor.material = stoveDoorMaterial;
    const stoveWindow = box("stove ember viewing glass", { width: 0.4, height: 0.34, depth: 0.035 }, new BABYLON.Vector3(3.75, 1.74, -3.19), mat.gold, root);
    const stoveEmbers = makeMaterial("Stove ember glow", "#d45d25", 0.55);
    stoveEmbers.emissiveColor = hex("#c94a1b"); stoveWindow.material = stoveEmbers;
    for (const x of [3.38, 4.12]) for (const z of [-2.95, -2.35]) {
      box("iron stove foot", { width: 0.13, height: 0.38, depth: 0.13 }, new BABYLON.Vector3(x, 1.05, z), mat.black, root);
    }
    box("stove cooking plate", { width: 1.12, height: 0.13, depth: 1.02 }, new BABYLON.Vector3(3.75, 2.62, -2.65), mat.stone, root);
    const stoveHandle = BABYLON.MeshBuilder.CreateCylinder("stove door handle", { height: 0.28, diameter: 0.07, tessellation: 10 }, scene);
    stoveHandle.parent = root; stoveHandle.rotation.x = Math.PI / 2; stoveHandle.position.set(4.1, 1.7, -3.2); stoveHandle.material = mat.gold; stoveHandle.isPickable = false;
    const stovePipe = BABYLON.MeshBuilder.CreateCylinder("cabin stove flue", { height: 3.1, diameter: 0.18, tessellation: 12 }, scene);
    stovePipe.parent = root; stovePipe.position.set(3.75, 4.0, -2.65); stovePipe.material = mat.black; stovePipe.isPickable = false;
    box("wall shelf", { width: 3.0, height: 0.14, depth: 0.48 }, new BABYLON.Vector3(-1.5, 4.65, 3.72), mat.wood, root);
    for (let book = 0; book < 4; book++) box("field guide book", { width: 0.32, height: 0.62, depth: 0.34 }, new BABYLON.Vector3(-2.4 + book * 0.48, 5.02, 3.62), [mat.roof, mat.sign, mat.woodLight, mat.black][book], root);
    for (let batten = 0; batten < 20; batten++) {
      box("rear interior wall timber batten", { width: 0.11, height: 4.25, depth: 0.08 },
        new BABYLON.Vector3(-5.0 + batten * 0.52, 3.45, 3.76), batten % 4 === 0 ? mat.woodLight : mat.wood, root);
    }
    for (const x of [-5.25, 5.25]) {
      for (let batten = 0; batten < 12; batten++) {
        box("side interior wall timber batten", { width: 0.08, height: 4.25, depth: 0.11 },
          new BABYLON.Vector3(x, 3.45, -3.5 + batten * 0.64), mat.wood, root);
      }
    }
    box("cabin mounted hunting rifle rack", { width: 2.25, height: 0.12, depth: 0.22 }, new BABYLON.Vector3(0.5, 3.5, -3.72), mat.wood, root);
    for (const x of [-0.35, 0.5, 1.35]) box("rifle rack support", { width: 0.12, height: 0.45, depth: 0.14 }, new BABYLON.Vector3(x, 3.24, -3.7), mat.gold, root);
    box("cabin framed wildlife photograph", { width: 1.35, height: 1.05, depth: 0.1 }, new BABYLON.Vector3(3.85, 4.25, 3.72), mat.woodLight, root);
    box("cabin photograph print", { width: 1.12, height: 0.82, depth: 0.035 }, new BABYLON.Vector3(3.85, 4.25, 3.64), mat.sign, root);

    for (const x of [-5.5, 5.5]) for (const z of [-4.05, 4.05]) {
      const post = box("lodge corner timber", { width: 0.48, height: 5.55, depth: 0.48 }, new BABYLON.Vector3(x, 3.45, z), mat.wood, root);
      post.rotation.y = rand(-0.02, 0.02);
    }
    for (const y of [1.22, 5.7]) {
      box("lodge front cross beam", { width: 11.8, height: 0.28, depth: 0.34 }, new BABYLON.Vector3(0, y, -4.16), mat.wood, root);
      box("lodge rear cross beam", { width: 11.8, height: 0.28, depth: 0.34 }, new BABYLON.Vector3(0, y, 4.16), mat.wood, root);
    }

    for (const z of [-4.12, 4.12]) {
      const gable = new BABYLON.Mesh("lodge timber gable", scene);
      const vertexData = new BABYLON.VertexData();
      const direction = z < 0 ? -1 : 1;
      vertexData.positions = [-5.55, 5.75, z, 5.55, 5.75, z, 0, 7.5, z];
      vertexData.indices = direction < 0 ? [0, 1, 2] : [1, 0, 2];
      vertexData.uvs = [0, 0, 1, 0, 0.5, 1];
      const normals = [];
      BABYLON.VertexData.ComputeNormals(vertexData.positions, vertexData.indices, normals);
      vertexData.normals = normals;
      vertexData.applyToMesh(gable);
      gable.parent = root;
      gable.material = mat.woodLight;
      gable.isPickable = false;
      gable.receiveShadows = true;
    }

    const roofPitch = 0.43;
    for (const side of [-1, 1]) {
      const roofPanel = box("Pinecrest continuous cedar shingle roof surface",
        { width: 12.9, height: 0.24, depth: 5.75 },
        new BABYLON.Vector3(0, 6.38, side * 2.26), mat.roofShingle, root);
      roofPanel.rotation.x = side * roofPitch;
      const fascia = box("roof fascia", { width: 12.9, height: 0.36, depth: 0.28 }, new BABYLON.Vector3(0, 5.1, side * 4.95), mat.wood, root);
      fascia.rotation.x = side * roofPitch;
    }
    box("roof ridge cap", { width: 12.95, height: 0.28, depth: 0.38 }, new BABYLON.Vector3(0, 7.5, 0), mat.roofLight, root);
    // The gable ends receive a proper exposed timber truss rather than a flat triangle.
    for (const faceZ of [-4.78, 4.78]) {
      const frontFacing = faceZ < 0;
      const leftGableBeam = box("Pinecrest gable diagonal king timber",
        { width: 5.9, height: 0.24, depth: 0.22 },
        new BABYLON.Vector3(-2.78, 6.62, faceZ), mat.wood, root);
      leftGableBeam.rotation.z = 0.305;
      const rightGableBeam = box("Pinecrest gable diagonal king timber",
        { width: 5.9, height: 0.24, depth: 0.22 },
        new BABYLON.Vector3(2.78, 6.62, faceZ), mat.wood, root);
      rightGableBeam.rotation.z = -0.305;
      box("Pinecrest gable collar tie",
        { width: 7.35, height: 0.20, depth: 0.22 },
        new BABYLON.Vector3(0, 6.12, faceZ), mat.woodLight, root);
      box("Pinecrest gable king post",
        { width: 0.20, height: 1.15, depth: 0.22 },
        new BABYLON.Vector3(0, 6.72, faceZ), mat.wood, root);

      const vent = BABYLON.MeshBuilder.CreateCylinder("Pinecrest gable timber vent",
        { height: 0.10, diameter: 0.84, tessellation: 20 }, scene);
      vent.parent = root;
      vent.rotation.x = Math.PI / 2;
      vent.position.set(0, 6.83, faceZ + (frontFacing ? -0.13 : 0.13));
      vent.material = mat.black;
      vent.isPickable = false;
      const ventRim = BABYLON.MeshBuilder.CreateTorus("Pinecrest gable vent brass rim",
        { diameter: 0.92, thickness: 0.055, tessellation: 20 }, scene);
      ventRim.parent = root;
      ventRim.rotation.x = Math.PI / 2;
      ventRim.position.copyFrom(vent.position);
      ventRim.material = mat.gold;
      ventRim.isPickable = false;
      for (let louver = 0; louver < 3; louver++) {
        box("Pinecrest gable vent louver",
          { width: 0.50, height: 0.055, depth: 0.06 },
          new BABYLON.Vector3(0, 6.65 + louver * 0.17, faceZ + (frontFacing ? -0.20 : 0.20)),
          mat.woodLight, root);
      }
    }

    // Heavy-gauge eaves gutters and downpipes complete the roof edge and make the
    // rainwater system feel like a real working backcountry lodge.
    const gutterMaterial = mat.black;
    for (const z of [-5.10, 5.10]) {
      const segments = z < 0 ? [-4.20, 4.20] : [0];
      for (const centreX of segments) {
        const length = z < 0 ? 4.35 : 12.55;
        const gutter = BABYLON.MeshBuilder.CreateCylinder("Pinecrest lodge metal rain gutter",
          { height: length, diameter: 0.15, tessellation: 12 }, scene);
        gutter.parent = root;
        gutter.rotation.z = Math.PI / 2;
        gutter.position.set(centreX, 5.12, z);
        gutter.material = gutterMaterial;
        gutter.isPickable = false;
      }
      for (let bracketX = -5.4; bracketX <= 5.41; bracketX += 1.8) {
        if (z < 0 && Math.abs(bracketX) < 2.15) continue;
        const bracket = box("Pinecrest gutter forged bracket",
          { width: 0.08, height: 0.10, depth: 0.22 },
          new BABYLON.Vector3(bracketX, 5.08, z), mat.gold, root);
        bracket.isPickable = false;
      }
    }
    for (const x of [-5.72, 5.72]) for (const z of [-5.08, 5.08]) {
      const downpipe = BABYLON.MeshBuilder.CreateCylinder("Pinecrest lodge copper rain downpipe",
        { height: 4.55, diameter: 0.13, tessellation: 12 }, scene);
      downpipe.parent = root;
      downpipe.position.set(x, 2.82, z);
      downpipe.material = gutterMaterial;
      downpipe.isPickable = false;
      const shoe = BABYLON.MeshBuilder.CreateCylinder("Pinecrest downpipe outlet shoe",
        { height: 0.42, diameter: 0.15, tessellation: 12 }, scene);
      shoe.parent = root;
      shoe.rotation.x = Math.PI / 2;
      shoe.position.set(x, 0.72, z + (z < 0 ? -0.12 : 0.12));
      shoe.material = mat.gold;
      shoe.isPickable = false;
    }

    for (let x = -5.1; x <= 5.1; x += 1.7) {
      for (const side of [-1, 1]) {
        const rafter = box("exposed roof rafter", { width: 0.22, height: 0.34, depth: 5.7 }, new BABYLON.Vector3(x, 6.25, side * 2.1), mat.wood, root);
        rafter.rotation.x = side * roofPitch;
      }
    }

    box("lodge porch platform", { width: 8.8, height: 0.34, depth: 2.4 }, new BABYLON.Vector3(0, 1.1, -5.35), mat.wood, root);
    for (let board = 0; board < 12; board++) {
      box("porch deck board", { width: 8.65, height: 0.07, depth: 0.18 }, new BABYLON.Vector3(0, 1.3, -6.34 + board * 0.18), board % 3 === 0 ? mat.woodLight : mat.wood, root);
    }
    const stairTops = [0.4, 0.7, 1.0, 1.3];
    const stairZ = [-8.85, -8.15, -7.45, -6.75];
    for (let step = 0; step < stairTops.length; step++) {
      const top = stairTops[step];
      box("solid lodge entry stair " + (step + 1), { width: 3.85, height: 0.30, depth: 0.72 },
        new BABYLON.Vector3(0, top - 0.15, stairZ[step]), step % 2 ? mat.wood : mat.woodLight, root);
      box("stair front nosing " + (step + 1), { width: 3.82, height: 0.075, depth: 0.09 },
        new BABYLON.Vector3(0, top - 0.045, stairZ[step] - 0.315), mat.woodLight, root);
    }
    for (const x of [-2.08, 2.08]) {
      for (let post = 0; post < 4; post++) {
        box("entry stair handrail post", { width: 0.14, height: 0.9, depth: 0.14 },
          new BABYLON.Vector3(x, 0.55 + post * 0.29, -8.75 + post * 0.68), mat.bark, root);
      }
    }
    const stairRailL = box("entry stair left handrail", { width: 0.18, height: 0.18, depth: 2.85 },
      new BABYLON.Vector3(-2.08, 1.55, -7.73), mat.woodLight, root);
    stairRailL.rotation.x = -0.35;
    const stairRailR = box("entry stair right handrail", { width: 0.18, height: 0.18, depth: 2.85 },
      new BABYLON.Vector3(2.08, 1.55, -7.73), mat.woodLight, root);
    stairRailR.rotation.x = -0.35;
    for (const x of [-3.8, 0, 3.8]) {
      box("porch footing", { width: 0.48, height: 0.42, depth: 0.48 }, new BABYLON.Vector3(x, 0.2, -6.25), mat.stoneDark, root);
      box("porch bearer", { width: 0.22, height: 0.24, depth: 2.1 }, new BABYLON.Vector3(x, 0.76, -5.45), mat.bark, root);
    }
    // Perimeter fencing follows the actual terrain instead of floating at one
    // fixed elevation. Stone footings, capped posts and continuous rails make it
    // read as a constructed ranger compound rather than loose prop pieces.
    const localGroundY = (x, z) => heightAt(root.position.x + x, root.position.z + z) - root.position.y;
    const fencePost = (x, z, name) => {
      const groundY = localGroundY(x, z);
      const footing = BABYLON.MeshBuilder.CreateCylinder("compound fence stone footing",
        { height: 0.28, diameterTop: 0.44, diameterBottom: 0.52, tessellation: 8 }, scene);
      footing.parent = root;
      footing.position.set(x, groundY + 0.14, z);
      footing.rotation.y = Math.PI / 8;
      footing.material = mat.stoneDark;
      footing.isPickable = false;
      const post = BABYLON.MeshBuilder.CreateCylinder(name,
        { height: 1.92, diameterTop: 0.235, diameterBottom: 0.34, tessellation: 10 }, scene);
      post.parent = root;
      post.position.set(x, groundY + 0.96, z);
      post.rotation.y = rand(-0.025, 0.025);
      post.material = mat.bark;
      post.isPickable = false;
      post.receiveShadows = true;
      const cap = BABYLON.MeshBuilder.CreateCylinder("compound fence post cap",
        { height: 0.12, diameterTop: 0.28, diameterBottom: 0.36, tessellation: 10 }, scene);
      cap.parent = root;
      cap.position.set(x, groundY + 1.98, z);
      cap.material = mat.woodLight;
      cap.isPickable = false;
      // Dark steel connector bands hide rail joints and make the fence read as assembled hardware.
      for (const level of [0.68, 1.30]) {
        const bracket = BABYLON.MeshBuilder.CreateCylinder("compound fence steel rail bracket",
          { height: 0.14, diameterTop: 0.37, diameterBottom: 0.37, tessellation: 10 }, scene);
        bracket.parent = root;
        bracket.position.set(x, groundY + level, z);
        bracket.material = mat.black;
        bracket.isPickable = false;
        const bolt = BABYLON.MeshBuilder.CreateSphere("compound fence brass bolt", { diameter: 0.075, segments: 10 }, scene);
        bolt.parent = root;
        bolt.position.set(x, groundY + level, z - 0.205);
        bolt.material = mat.gold;
        bolt.isPickable = false;
      }
    };
    const sideFenceRail = (x, z0, z1, height, material, name) => {
      const y0 = localGroundY(x, z0), y1 = localGroundY(x, z1);
      const length = Math.hypot(z1 - z0, y1 - y0);
      const rail = BABYLON.MeshBuilder.CreateCylinder(name,
        { height: length, diameterTop: 0.16, diameterBottom: 0.21, tessellation: 12 }, scene);
      rail.parent = root;
      rail.position.set(x, (y0 + y1) / 2 + height, (z0 + z1) / 2);
      rail.rotation.x = Math.atan2(z1 - z0, y1 - y0);
      rail.material = material;
      rail.isPickable = false;
      rail.receiveShadows = true;
      return rail;
    };
    const crossFenceRail = (x0, x1, z, height, material, name) => {
      const y0 = localGroundY(x0, z), y1 = localGroundY(x1, z);
      const dx = x1 - x0, dy = y1 - y0;
      const length = Math.hypot(dx, dy);
      const rail = BABYLON.MeshBuilder.CreateCylinder(name,
        { height: length, diameterTop: 0.16, diameterBottom: 0.21, tessellation: 12 }, scene);
      rail.parent = root;
      rail.position.set((x0 + x1) / 2, (y0 + y1) / 2 + height, z);
      rail.rotation.z = Math.atan2(-dx, dy);
      rail.material = material;
      rail.isPickable = false;
      rail.receiveShadows = true;
      return rail;
    };
    for (const x of [-13, 13]) {
      for (let z = -12; z <= 9; z += 3) fencePost(x, z, "compound perimeter fence post");
      for (let z = -12; z < 9; z += 3) {
        sideFenceRail(x, z, z + 3, 0.68, mat.wood, "compound side fence lower rail");
        sideFenceRail(x, z, z + 3, 1.30, mat.woodLight, "compound side fence upper rail");
      }
    }
    for (let x = -13; x <= 13; x += 3.25) fencePost(x, 12, "compound north fence post");
    for (let x = -13; x < 13; x += 3.25) {
      crossFenceRail(x, x + 3.25, 12, 0.68, mat.wood, "compound north fence lower rail");
      crossFenceRail(x, x + 3.25, 12, 1.30, mat.woodLight, "compound north fence upper rail");
    }
    for (const x of [-13, -9.75, -6.5, 6.5, 9.75, 13]) fencePost(x, -14, "compound gate fence post");
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? -13 : 6.5;
      const x1 = side < 0 ? -6.5 : 13;
      crossFenceRail(x0, x1, -14, 0.68, mat.wood, "compound gate fence lower rail");
      crossFenceRail(x0, x1, -14, 1.30, mat.woodLight, "compound gate fence upper rail");
    }
    const gateGround = localGroundY(0, -14);
    box("Pinecrest entry gate lintel", { width: 6.7, height: 0.24, depth: 0.26 },
      new BABYLON.Vector3(0, gateGround + 3.15, -14), mat.woodLight, root);
    box("Pinecrest entry gate sign", { width: 4.1, height: 0.9, depth: 0.18 },
      new BABYLON.Vector3(0, gateGround + 2.55, -14), mat.sign, root);

    // Two ground-bearing posts support the sign lintel and carry the sign's load.
    // Stone plinths, post caps, iron straps and knee braces make the structure read as built.
    for (const side of [-1, 1]) {
      const postX = side * 2.48;
      const postGround = localGroundY(postX, -14);
      box("Pinecrest gate stone post footing",
        { width: 0.52, height: 0.26, depth: 0.52 },
        new BABYLON.Vector3(postX, postGround + 0.13, -14), mat.stoneDark, root);
      box("Pinecrest gate structural timber support post",
        { width: 0.34, height: 3.08, depth: 0.34 },
        new BABYLON.Vector3(postX, postGround + 1.67, -14), mat.bark, root);
      box("Pinecrest gate post head cap",
        { width: 0.48, height: 0.16, depth: 0.48 },
        new BABYLON.Vector3(postX, postGround + 3.18, -14), mat.woodLight, root);
      const kneeBrace = box("Pinecrest gate timber knee brace",
        { width: 0.92, height: 0.16, depth: 0.18 },
        new BABYLON.Vector3(side * 2.05, postGround + 2.86, -14), mat.woodLight, root);
      kneeBrace.rotation.z = -side * 0.56;
      box("Pinecrest gate iron post strap",
        { width: 0.44, height: 0.12, depth: 0.045 },
        new BABYLON.Vector3(postX, postGround + 2.98, -14.195), mat.black, root);
      for (const boltY of [postGround + 2.91, postGround + 3.05]) {
        const bolt = BABYLON.MeshBuilder.CreateCylinder("Pinecrest gate brass strap bolt",
          { height: 0.035, diameter: 0.075, tessellation: 10 }, scene);
        bolt.parent = root;
        bolt.rotation.x = Math.PI / 2;
        bolt.position.set(postX, boltY, -14.23);
        bolt.material = mat.gold;
        bolt.isPickable = false;
      }
      // Keep the gate passage open while preventing the player walking through either post.
      obstacles.push({ x: root.position.x + postX, z: root.position.z - 14, radius: 0.30 });
    }
    // A timber edge frame and corner fixings finish the sign board itself.
    for (const y of [gateGround + 2.12, gateGround + 2.98]) {
      box("Pinecrest gate sign frame rail",
        { width: 4.24, height: 0.10, depth: 0.12 },
        new BABYLON.Vector3(0, y, -14.205), mat.woodLight, root);
    }
    for (const x of [-2.07, 2.07]) {
      box("Pinecrest gate sign frame stile",
        { width: 0.10, height: 0.92, depth: 0.12 },
        new BABYLON.Vector3(x, gateGround + 2.55, -14.205), mat.woodLight, root);
    }

    for (const x of [-5.7, 5.7]) {
      const groundY = localGroundY(x, -11.5);
      const lampPole = BABYLON.MeshBuilder.CreateCylinder("compound entrance lantern post", { height: 3.4, diameter: 0.16, tessellation: 10 }, scene);
      lampPole.parent = root; lampPole.position.set(x, groundY + 1.7, -11.5); lampPole.material = mat.bark; lampPole.isPickable = false;
      box("compound lantern backplate", { width: 0.40, height: 0.50, depth: 0.32 },
        new BABYLON.Vector3(x, groundY + 3.38, -11.5), mat.black, root);
      const lampGlass = box("compound lantern glass", { width: 0.22, height: 0.31, depth: 0.22 },
        new BABYLON.Vector3(x, groundY + 3.38, -11.5), mat.window, root);
      lampGlass.material.emissiveColor = hex("#f2bd75");
      const gateLight = new BABYLON.PointLight("compound gate warm light",
        new BABYLON.Vector3(root.position.x + x, groundY + 3.2, root.position.z - 11.5), scene);
      gateLight.diffuse = hex("#f0bc79"); gateLight.intensity = 0.22; gateLight.range = 9;
    }
    // Gate nameplate faces are deliberately offset in front of the wood plaque.
    gateSignFrontMesh = BABYLON.MeshBuilder.CreatePlane("Pinecrest gate sign front",
      { width: 3.82, height: 0.68, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
    gateSignFrontMesh.parent = root;
    gateSignFrontMesh.position.set(0, gateGround + 2.55, -14.165);
    gateSignFrontMesh.rotation.y = Math.PI;
    gateSignFrontMesh.isPickable = false;
    gateSignBackMesh = BABYLON.MeshBuilder.CreatePlane("Pinecrest gate sign back",
      { width: 3.82, height: 0.68, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
    gateSignBackMesh.parent = root;
    gateSignBackMesh.position.set(0, gateGround + 2.55, -13.835);
    gateSignBackMesh.isPickable = false;
    const drawGateSign = (texture, mirror) => {
      const ctx = texture.getContext();
      ctx.clearRect(0, 0, 1024, 256);
      ctx.fillStyle = "#20342a"; ctx.fillRect(0, 0, 1024, 256);
      ctx.strokeStyle = "#c8ad70"; ctx.lineWidth = 12; ctx.strokeRect(18, 18, 988, 220);
      ctx.strokeStyle = "#7d704f"; ctx.lineWidth = 3; ctx.strokeRect(34, 34, 956, 188);
      ctx.textAlign = "center"; ctx.fillStyle = "#f1e3bd";
      ctx.font = "bold 78px Georgia"; ctx.fillText("PINECREST OUTPOST", 512, 112);
      ctx.font = "29px Georgia"; ctx.fillStyle = "#c9c0a7";
      ctx.fillText("RANGER STATION  ·  PINECREST VALLEY", 512, 177);
      texture.update(true);
      return makeReadableSignMaterial(mirror ? "Pinecrest gate sign front material" : "Pinecrest gate sign rear material", texture, mirror);
    };
    gateSignTexture = new BABYLON.DynamicTexture("Pinecrest gate nameplate front", { width: 1024, height: 256 }, scene, true);
    gateSignBackTexture = new BABYLON.DynamicTexture("Pinecrest gate nameplate rear", { width: 1024, height: 256 }, scene, true);
    gateSignFrontMaterial = drawGateSign(gateSignTexture, true);
    gateSignBackMaterial = drawGateSign(gateSignBackTexture, false);
    gateSignFrontMesh.material = gateSignFrontMaterial;
    gateSignBackMesh.material = gateSignBackMaterial;
    for (const x of [-1.92, 1.92]) for (const y of [gateGround + 2.27, gateGround + 2.83]) {
      const fixing = BABYLON.MeshBuilder.CreateCylinder("gate sign brass fixing", { height: 0.035, diameter: 0.095, tessellation: 12 }, scene);
      fixing.parent = root; fixing.rotation.x = Math.PI / 2; fixing.position.set(x, y, -14.19);
      fixing.material = mat.gold; fixing.isPickable = false;
    }
    for (const side of [-1, 1]) {
      const x = side * 4.15;
      box("porch support post", { width: 0.24, height: 3.0, depth: 0.24 }, new BABYLON.Vector3(x, 2.55, -6.25), mat.bark, root);
      box("porch post cap", { width: 0.4, height: 0.18, depth: 0.4 }, new BABYLON.Vector3(x, 4.08, -6.25), mat.woodLight, root);
      const porchBrace = box("Pinecrest porch timber knee brace",
        { width: 0.92, height: 0.16, depth: 0.18 },
        new BABYLON.Vector3(side * 3.78, 3.62, -6.25), mat.woodLight, root);
      porchBrace.rotation.z = -side * 0.58;
      for (const boltY of [3.42, 3.82]) {
        const bolt = BABYLON.MeshBuilder.CreateCylinder("Pinecrest porch brass brace bolt",
          { height: 0.035, diameter: 0.07, tessellation: 10 }, scene);
        bolt.parent = root;
        bolt.rotation.x = Math.PI / 2;
        bolt.position.set(x - side * 0.06, boltY, -6.39);
        bolt.material = mat.gold;
        bolt.isPickable = false;
      }
    }
    box("porch canopy", { width: 9.1, height: 0.2, depth: 2.75 }, new BABYLON.Vector3(0, 4.05, -5.65), mat.roof, root);
    for (const x of [-4.0, 4.0]) {
      box("porch handrail", { width: 0.14, height: 0.14, depth: 1.9 }, new BABYLON.Vector3(x, 2.0, -5.45), mat.woodLight, root);
      for (let slat = 0; slat < 5; slat++) {
        box("porch baluster", { width: 0.09, height: 0.85, depth: 0.09 }, new BABYLON.Vector3(x, 1.62, -6.22 + slat * 0.38), mat.wood, root);
      }
    }

    box("lodge door recess", { width: 2.0, height: 3.35, depth: 0.16 }, new BABYLON.Vector3(0, 2.68, -4.13), mat.black, root);
    for (const x of [-1.02, 1.02]) box("door jamb", { width: 0.22, height: 3.55, depth: 0.3 }, new BABYLON.Vector3(x, 2.72, -4.22), mat.woodLight, root);
    box("door lintel", { width: 2.25, height: 0.22, depth: 0.3 }, new BABYLON.Vector3(0, 4.48, -4.22), mat.woodLight, root);

    // Permanent lodge identity plaque above the entrance.
    box("Pinecrest lodge sign backing", { width: 3.55, height: 0.84, depth: 0.16 },
      new BABYLON.Vector3(0, 5.02, -4.42), mat.roof, root);
    cabinSignFrontMesh = BABYLON.MeshBuilder.CreatePlane("Pinecrest lodge sign face",
      { width: 3.28, height: 0.62, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
    cabinSignFrontMesh.parent = root;
    cabinSignFrontMesh.position.set(0, 5.02, -4.56);
    cabinSignFrontMesh.rotation.y = Math.PI;
    cabinSignFrontMesh.isPickable = false;
    cabinSignTexture = new BABYLON.DynamicTexture("Pinecrest Lodge nameplate", { width: 1024, height: 256 }, scene, true);
    const cabinSignCtx = cabinSignTexture.getContext();
    cabinSignCtx.fillStyle = "#20342a"; cabinSignCtx.fillRect(0, 0, 1024, 256);
    cabinSignCtx.strokeStyle = "#c5a66c"; cabinSignCtx.lineWidth = 12; cabinSignCtx.strokeRect(18, 18, 988, 220);
    cabinSignCtx.strokeStyle = "#7f714f"; cabinSignCtx.lineWidth = 3; cabinSignCtx.strokeRect(34, 34, 956, 188);
    cabinSignCtx.textAlign = "center"; cabinSignCtx.fillStyle = "#f4e7c7";
    cabinSignCtx.font = "bold 88px Georgia"; cabinSignCtx.fillText("PINECREST LODGE", 512, 119);
    cabinSignCtx.font = "30px Georgia"; cabinSignCtx.fillStyle = "#d4c49c";
    cabinSignCtx.fillText("RANGER CABIN  ·  PINECREST VALLEY", 512, 178);
    cabinSignTexture.update(true);
    cabinSignMaterial = makeReadableSignMaterial("Pinecrest lodge sign material", cabinSignTexture, true);
    cabinSignFrontMesh.material = cabinSignMaterial;

    // The lodge plaque is carried by a visible timber portal tied into the door
    // lintel and front cross-beam, rather than appearing pasted onto the facade.
    box("Pinecrest lodge sign structural header",
      { width: 4.18, height: 0.22, depth: 0.28 },
      new BABYLON.Vector3(0, 6.00, -4.54), mat.wood, root);
    for (const side of [-1, 1]) {
      const postX = side * 1.94;
      box("Pinecrest lodge sign structural timber post",
        { width: 0.24, height: 1.55, depth: 0.28 },
        new BABYLON.Vector3(postX, 5.18, -4.54), mat.bark, root);
      box("Pinecrest lodge sign post stone shoe",
        { width: 0.36, height: 0.18, depth: 0.36 },
        new BABYLON.Vector3(postX, 4.43, -4.54), mat.stoneDark, root);
      box("Pinecrest lodge sign post cap",
        { width: 0.36, height: 0.16, depth: 0.36 },
        new BABYLON.Vector3(postX, 5.98, -4.54), mat.woodLight, root);
      const knee = box("Pinecrest lodge sign portal knee brace",
        { width: 0.58, height: 0.14, depth: 0.18 },
        new BABYLON.Vector3(side * 1.68, 5.80, -4.57), mat.woodLight, root);
      knee.rotation.z = -side * 0.48;
      box("Pinecrest lodge sign iron post strap",
        { width: 0.30, height: 0.12, depth: 0.045 },
        new BABYLON.Vector3(postX, 5.10, -4.70), mat.black, root);
      for (const boltY of [5.05, 5.15]) {
        const bolt = BABYLON.MeshBuilder.CreateCylinder("Pinecrest lodge sign post brass bolt",
          { height: 0.035, diameter: 0.065, tessellation: 10 }, scene);
        bolt.parent = root;
        bolt.rotation.x = Math.PI / 2;
        bolt.position.set(postX, boltY, -4.73);
        bolt.material = mat.gold;
        bolt.isPickable = false;
      }
    }
    for (const side of [-1, 1]) {
      box("Pinecrest lodge sign mounting cleat",
        { width: 0.16, height: 0.96, depth: 0.24 },
        new BABYLON.Vector3(side * 1.78, 5.02, -4.39), mat.woodLight, root);
      box("Pinecrest lodge sign lower support",
        { width: 3.72, height: 0.12, depth: 0.28 },
        new BABYLON.Vector3(0, 4.57, -4.43), mat.wood, root);
      const bracket = box("Pinecrest lodge sign iron bracket",
        { width: 0.54, height: 0.10, depth: 0.10 },
        new BABYLON.Vector3(side * 1.42, 4.73, -4.51), mat.black, root);
      bracket.rotation.z = side * 0.30;
    }
    for (const x of [-1.62, 1.62]) for (const y of [4.77, 5.27]) {
      const fastener = BABYLON.MeshBuilder.CreateCylinder("lodge sign brass fixing", { height: 0.035, diameter: 0.09, tessellation: 12 }, scene);
      fastener.parent = root; fastener.rotation.x = Math.PI / 2; fastener.position.set(x, y, -4.605);
      fastener.material = mat.gold; fastener.isPickable = false;
    }

    cabinDoorPivot = new BABYLON.TransformNode("Lodge door hinge", scene);
    cabinDoorPivot.parent = root;
    cabinDoorPivot.rotationQuaternion = null;
    cabinDoorPivot.position.set(-0.88, 1.12, -4.12);
    const doorLeaf = box("hinged lodge door", { width: 1.76, height: 3.02, depth: 0.16 }, new BABYLON.Vector3(0.88, 1.5, 0), mat.roofLight, cabinDoorPivot);
    doorLeaf.receiveShadows = true;
    for (let plank = 0; plank < 6; plank++) {
      box("door vertical plank", { width: 0.25, height: 2.84, depth: 0.045 }, new BABYLON.Vector3(0.18 + plank * 0.28, 1.5, -0.105), mat.wood, cabinDoorPivot);
    }
    box("door cross brace", { width: 1.55, height: 0.15, depth: 0.06 }, new BABYLON.Vector3(0.88, 0.58, -0.14), mat.wood, cabinDoorPivot);
    box("door upper brace", { width: 1.55, height: 0.15, depth: 0.06 }, new BABYLON.Vector3(0.88, 2.4, -0.14), mat.wood, cabinDoorPivot);
    const handle = BABYLON.MeshBuilder.CreateSphere("door iron handle", { diameter: 0.13, segments: 12 }, scene);
    handle.parent = cabinDoorPivot; handle.position.set(1.48, 1.5, -0.2); handle.material = mat.gold; handle.isPickable = false;
    const latch = BABYLON.MeshBuilder.CreateTorus("door iron latch", { diameter: 0.18, thickness: 0.035, tessellation: 12 }, scene);
    latch.parent = cabinDoorPivot; latch.position.set(1.48, 1.5, -0.28); latch.rotation.x = Math.PI / 2; latch.material = mat.black; latch.isPickable = false;
    for (let plank = 0; plank < 6; plank++) {
      box("door interior vertical plank", { width: 0.25, height: 2.82, depth: 0.045 },
        new BABYLON.Vector3(0.18 + plank * 0.28, 1.5, 0.105), mat.woodLight, cabinDoorPivot);
    }
    for (const y of [0.58, 1.5, 2.42]) {
      box("blacksmith door hinge strap", { width: 0.42, height: 0.16, depth: 0.055 },
        new BABYLON.Vector3(0.12, y, -0.16), mat.black, cabinDoorPivot);
      box("blacksmith door hinge pin", { width: 0.12, height: 0.24, depth: 0.13 },
        new BABYLON.Vector3(0.06, y, -0.2), mat.gold, cabinDoorPivot);
    }
    const insideHandle = BABYLON.MeshBuilder.CreateSphere("interior door handle", { diameter: 0.13, segments: 12 }, scene);
    insideHandle.parent = cabinDoorPivot; insideHandle.position.set(1.48, 1.5, 0.2); insideHandle.material = mat.gold; insideHandle.isPickable = false;
    cabinDoorPivot.getChildMeshes().forEach((mesh) => { if (mesh.isWorldMatrixFrozen) mesh.unfreezeWorldMatrix(); });

    for (const x of [-3.45, 3.45]) {
      box("window recess", { width: 1.55, height: 1.55, depth: 0.15 }, new BABYLON.Vector3(x, 3.95, -4.21), mat.black, root);
      const glass = box("window glazed pane", { width: 1.18, height: 1.2, depth: 0.055 }, new BABYLON.Vector3(x, 3.95, -4.31), mat.window, root);
      glass.material.emissiveColor = hex("#c18a4c");
      for (const dx of [-0.68, 0.68]) box("window upright", { width: 0.16, height: 1.56, depth: 0.15 }, new BABYLON.Vector3(x + dx, 3.95, -4.38), mat.woodLight, root);
      for (const dy of [-0.68, 0.68]) box("window cross rail", { width: 1.5, height: 0.16, depth: 0.15 }, new BABYLON.Vector3(x, 3.95 + dy, -4.38), mat.woodLight, root);
      box("window mullion", { width: 0.08, height: 1.15, depth: 0.08 }, new BABYLON.Vector3(x, 3.95, -4.43), mat.wood, root);
      box("window transom", { width: 1.12, height: 0.08, depth: 0.08 }, new BABYLON.Vector3(x, 3.95, -4.43), mat.wood, root);
      box("window sill", { width: 1.8, height: 0.18, depth: 0.42 }, new BABYLON.Vector3(x, 3.12, -4.42), mat.wood, root);
      for (const side of [-1, 1]) {
        const shutterX = x + side * 1.05;
        box("window shutter backing", { width: 0.42, height: 1.35, depth: 0.13 },
          new BABYLON.Vector3(shutterX, 3.95, -4.27), mat.woodLight, root);
        for (let plank = 0; plank < 3; plank++) {
          box("window shutter vertical slat", { width: 0.105, height: 1.27, depth: 0.055 },
            new BABYLON.Vector3(shutterX - 0.14 + plank * 0.14, 3.95, -4.355), mat.wood, root);
        }
        for (const dy of [-0.49, 0.49]) {
          box("window shutter cross brace", { width: 0.36, height: 0.095, depth: 0.065 },
            new BABYLON.Vector3(shutterX, 3.95 + dy, -4.39), mat.woodLight, root);
          const strap = box("window shutter iron hinge strap", { width: 0.25, height: 0.07, depth: 0.04 },
            new BABYLON.Vector3(shutterX + side * 0.1, 3.95 + dy, -4.425), mat.black, root);
          strap.rotation.z = side * 0.08;
        }
        for (const dy of [-0.48, 0.48]) {
          const hingePin = BABYLON.MeshBuilder.CreateCylinder("window shutter brass hinge pin",
            { height: 0.055, diameter: 0.075, tessellation: 10 }, scene);
          hingePin.parent = root; hingePin.rotation.x = Math.PI / 2;
          hingePin.position.set(shutterX + side * 0.23, 3.95 + dy, -4.43);
          hingePin.material = mat.gold; hingePin.isPickable = false;
        }
      }
    }

    // Hand-built flower boxes bring a lived-in touch to the two front windows.
    for (const windowX of [-3.45, 3.45]) {
      box("Pinecrest window flower box body",
        { width: 1.78, height: 0.28, depth: 0.42 },
        new BABYLON.Vector3(windowX, 2.86, -4.62), mat.wood, root);
      box("Pinecrest window flower box front board",
        { width: 1.70, height: 0.13, depth: 0.07 },
        new BABYLON.Vector3(windowX, 2.86, -4.85), mat.woodLight, root);
      for (const side of [-1, 1]) {
        const bracket = box("Pinecrest window flower box iron bracket",
          { width: 0.09, height: 0.44, depth: 0.10 },
          new BABYLON.Vector3(windowX + side * 0.58, 2.63, -4.55), mat.black, root);
        bracket.rotation.z = side * -0.18;
      }
      for (let plant = 0; plant < 7; plant++) {
        const px = windowX - 0.72 + plant * 0.24;
        const height = 0.25 + (plant % 3) * 0.055;
        const leaf = BABYLON.MeshBuilder.CreateSphere("Pinecrest window box foliage",
          { diameter: 0.32, segments: 8 }, scene);
        leaf.parent = root;
        leaf.position.set(px, 3.05 + height * 0.35, -4.64 + Math.sin(plant * 1.2) * 0.06);
        leaf.scaling.set(0.62, 1.0 + height * 0.4, 0.48);
        leaf.material = plant % 2 ? mat.leaf2 : mat.leaf3;
        leaf.isPickable = false;
        if (plant === 1 || plant === 4 || plant === 6) {
          const bloom = BABYLON.MeshBuilder.CreateSphere("Pinecrest window box flower",
            { diameter: 0.13, segments: 8 }, scene);
          bloom.parent = root;
          bloom.position.set(px, 3.27 + height * 0.5, -4.68);
          bloom.material = plant === 4 ? mat.flowerCream : mat.flowerGold;
          bloom.isPickable = false;
        }
      }
    }

    for (let course = 0; course < 7; course++) {
      for (let stoneIndex = 0; stoneIndex < 3; stoneIndex++) {
        const stone = box("chimney stone", { width: 0.45 + rand(0, 0.12), height: 0.42, depth: 0.48 }, new BABYLON.Vector3(3.65 + (stoneIndex - 1) * 0.34, 6.2 + course * 0.44, 1.35), mat.stoneDark, root);
        stone.rotation.y = rand(-0.08, 0.08);
      }
    }
    box("chimney flue", { width: 0.52, height: 0.25, depth: 0.55 }, new BABYLON.Vector3(3.65, 9.25, 1.35), mat.black, root);
    box("chimney cap", { width: 1.2, height: 0.16, depth: 1.1 }, new BABYLON.Vector3(3.65, 9.45, 1.35), mat.stone, root);

    const lantern = BABYLON.MeshBuilder.CreateBox("porch lantern", { width: 0.28, height: 0.42, depth: 0.24 }, scene);
    lantern.parent = root; lantern.position.set(1.7, 3.65, -4.62); lantern.material = mat.gold; lantern.isPickable = false;
    const lanternGlass = box("lantern warm glass", { width: 0.18, height: 0.28, depth: 0.16 }, new BABYLON.Vector3(1.7, 3.65, -4.76), mat.window, root);
    lanternGlass.material.emissiveColor = hex("#e6a04c");
    const secondPorchLantern = BABYLON.MeshBuilder.CreateBox("Pinecrest porch companion lantern",
      { width: 0.28, height: 0.42, depth: 0.24 }, scene);
    secondPorchLantern.parent = root;
    secondPorchLantern.position.set(-1.7, 3.65, -4.62);
    secondPorchLantern.material = mat.gold;
    secondPorchLantern.isPickable = false;
    const secondLanternGlass = box("Pinecrest porch companion lantern glass",
      { width: 0.18, height: 0.28, depth: 0.16 },
      new BABYLON.Vector3(-1.7, 3.65, -4.76), mat.window, root);
    secondLanternGlass.material.emissiveColor = hex("#e6a04c");
    const secondPorchLight = new BABYLON.PointLight("Pinecrest porch companion warm light",
      new BABYLON.Vector3(-15.7, 3.6, 38.1), scene);
    secondPorchLight.diffuse = hex("#f1bd78");
    secondPorchLight.intensity = 0.20;
    secondPorchLight.range = 9;
    const lanternLight = new BABYLON.PointLight("warm porch lantern light", new BABYLON.Vector3(-12.3, 3.6, 38.1), scene);
    lanternLight.diffuse = hex("#f1bd78"); lanternLight.intensity = 0.24; lanternLight.range = 10;
    // Small trailhead details make the spawn feel like a working ranger outpost.
    const flagPole = BABYLON.MeshBuilder.CreateCylinder("outpost flag pole", { height: 7.2, diameter: 0.12, tessellation: 10 }, scene);
    flagPole.parent = root; flagPole.position.set(5.35, 4.45, -7.0); flagPole.material = mat.black; flagPole.isPickable = false;
    const flag = box("Pinecrest outpost flag", { width: 1.65, height: 0.92, depth: 0.055 }, new BABYLON.Vector3(4.55, 7.05, -7.0), mat.sign, root);
    flag.rotation.y = -0.08;
    const flagMark = box("outpost flag gold stripe", { width: 1.18, height: 0.09, depth: 0.025 }, new BABYLON.Vector3(4.55, 7.05, -7.04), mat.gold, root);
    // A shallow ash bed and individual stones sit directly on the level trailhead ground.
    const fireAsh = BABYLON.MeshBuilder.CreateCylinder("campfire ash bed", { height: 0.055, diameter: 1.75, tessellation: 24 }, scene);
    fireAsh.parent = root; fireAsh.position.set(-4.2, 0.1275, -9.1); fireAsh.material = mat.black; fireAsh.isPickable = false;
    for (let stone = 0; stone < 9; stone++) {
      const angle = stone / 9 * Math.PI * 2;
      const rock = BABYLON.MeshBuilder.CreateIcoSphere("fire ring fieldstone", { radius: 0.3, subdivisions: 1 }, scene);
      rock.parent = root; rock.position.set(-4.2 + Math.cos(angle) * 1.05, 0.31, -9.1 + Math.sin(angle) * 1.05);
      rock.scaling.set(1.1, 0.72, 0.9); rock.material = mat.stoneDark; rock.isPickable = false;
    }
    for (let log = 0; log < 3; log++) {
      const emberLog = BABYLON.MeshBuilder.CreateCylinder("campfire split log", { height: 1.5, diameter: 0.2, tessellation: 9 }, scene);
      emberLog.parent = root; emberLog.rotation.z = Math.PI / 2; emberLog.rotation.y = log * Math.PI / 3;
      emberLog.position.set(-4.2, 0.22 + log * 0.02, -9.1); emberLog.material = mat.bark; emberLog.isPickable = false;
    }
    cabinFireFlame = BABYLON.MeshBuilder.CreateCylinder("outpost campfire flame", { height: 0.62, diameterTop: 0.035, diameterBottom: 0.34, tessellation: 10 }, scene);
    cabinFireFlame.parent = root; cabinFireFlame.position.set(-4.2, 0.49, -9.1);
    const fireGlowMaterial = makeMaterial("Outpost flame material", "#e87928", 0.45);
    fireGlowMaterial.emissiveColor = hex("#f18a32"); fireGlowMaterial.disableLighting = true;
    cabinFireFlame.material = fireGlowMaterial; cabinFireFlame.isPickable = false;
    const fireCore = BABYLON.MeshBuilder.CreateCylinder("campfire yellow core", { height: 0.38, diameterTop: 0.015, diameterBottom: 0.18, tessellation: 9 }, scene);
    fireCore.parent = root; fireCore.position.set(-4.2, 0.39, -9.1);
    const fireCoreMaterial = makeMaterial("Campfire core material", "#ffc45e", 0.4);
    fireCoreMaterial.emissiveColor = hex("#ffc45e"); fireCoreMaterial.disableLighting = true;
    fireCore.material = fireCoreMaterial; fireCore.isPickable = false;
    const fireLight = new BABYLON.PointLight("outpost firelight", new BABYLON.Vector3(-18.2, 0.9, 33.9), scene);
    fireLight.diffuse = hex("#ff9a48"); fireLight.intensity = 0.48; fireLight.range = 11;
    const crate = (name, x, y, z, size) => box(name, size, new BABYLON.Vector3(x, y, z), mat.wood, root);
    crate("outpost supply crate", 5.9, 1.35, -1.4, { width: 1.25, height: 0.72, depth: 1.0 });
    crate("outpost stacked crate", 5.9, 2.08, -1.4, { width: 1.05, height: 0.68, depth: 0.88 });
    const supplyBarrel = BABYLON.MeshBuilder.CreateCylinder("outpost supply barrel", { height: 1.25, diameter: 0.78, tessellation: 12 }, scene);
    supplyBarrel.parent = root; supplyBarrel.position.set(6.35, 1.65, 1.15); supplyBarrel.material = mat.wood; supplyBarrel.isPickable = false;
    for (const y of [1.2, 2.1]) {
      const hoop = BABYLON.MeshBuilder.CreateTorus("barrel iron hoop", { diameter: 0.8, thickness: 0.045, tessellation: 12 }, scene);
      hoop.parent = root; hoop.position.set(6.35, y, 1.15); hoop.rotation.x = Math.PI / 2; hoop.material = mat.black; hoop.isPickable = false;
    }

    box("outpost bench seat", { width: 2.0, height: 0.18, depth: 0.5 }, new BABYLON.Vector3(-3.4, 1.62, -5.7), mat.wood, root);
    for (const x of [-4.15, -2.65]) box("bench leg", { width: 0.16, height: 0.72, depth: 0.16 }, new BABYLON.Vector3(x, 1.22, -5.7), mat.bark, root);
    for (let log = 0; log < 5; log++) {
      const firewood = BABYLON.MeshBuilder.CreateCylinder("stacked firewood", { height: 1.2, diameter: 0.22, tessellation: 9 }, scene);
      firewood.parent = root; firewood.rotation.z = Math.PI / 2;
      firewood.position.set(4.1 + (log % 2) * 0.12, 0.75 + Math.floor(log / 2) * 0.23, -5.4 - (log % 2) * 0.3);
      firewood.material = mat.bark; firewood.isPickable = false;
    }

    makeInteractable("LODGE DOOR", "Open or close the Pinecrest cabin door", -14, 38.7, "cabin", "door");
    makeInteractable("OUTFITTERS", "Open the supply counter", -4.5, 40.5, "shop", "ammo");
    // Put the contract board just inside the gate, facing the approach path.
    makeInteractable("CONTRACT BOARD", "View local hunting contracts", -21.8, 33.0, "contract", "board");
    makeInteractable("HARVEST STATION", "Sell hides and meat", -20.7, 40.5, "sell", "table");
    const boardGround = heightAt(-21.8, 33.0);
    contractBoardMesh = box("contract-board", { width: 2.15, height: 2.28, depth: 0.28 }, new BABYLON.Vector3(-21.8, boardGround + 1.72, 33.0), mat.sign);
    const boardPost = BABYLON.MeshBuilder.CreateCylinder("board-post", { height: 2.7, diameter: 0.2, tessellation: 10 }, scene);
    boardPost.position.set(-21.8, boardGround + 1.35, 33.0); boardPost.material = mat.bark;
    const boardCanopy = box("contract board rain cap", { width: 2.55, height: 0.16, depth: 0.66 },
      new BABYLON.Vector3(-21.8, boardGround + 3.0, 33.0), mat.roof, null);
    boardCanopy.rotation.x = -0.08;
    for (const x of [-22.65, -20.95]) {
      const brace = box("contract board support brace", { width: 0.12, height: 0.82, depth: 0.12 },
        new BABYLON.Vector3(x, boardGround + 0.82, 32.92), mat.bark, null);
      brace.rotation.z = x < -21.8 ? -0.22 : 0.22;
    }
    boardPaperFrontMesh = BABYLON.MeshBuilder.CreatePlane("board-paper-front",
      { width: 1.82, height: 1.48, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
    boardPaperFrontMesh.position.set(-21.8, boardGround + 1.82, 32.795);
    boardPaperFrontMesh.rotation.y = Math.PI;
    boardPaperFrontMesh.isPickable = false;
    boardPaperBackMesh = BABYLON.MeshBuilder.CreatePlane("board-paper-back",
      { width: 1.82, height: 1.48, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
    boardPaperBackMesh.position.set(-21.8, boardGround + 1.82, 33.205);
    boardPaperBackMesh.isPickable = false;
    contractBoardTexture = new BABYLON.DynamicTexture("Pinecrest contract notice front", { width: 1024, height: 768 }, scene, true);
    contractBoardBackTexture = new BABYLON.DynamicTexture("Pinecrest contract notice rear", { width: 1024, height: 768 }, scene, true);
    contractBoardMaterial = makeReadableSignMaterial("contract notice front ink", contractBoardTexture, true);
    contractBoardBackMaterial = makeReadableSignMaterial("contract notice rear ink", contractBoardBackTexture, false);
    boardPaperFrontMesh.material = contractBoardMaterial;
    boardPaperBackMesh.material = contractBoardBackMaterial;
    // Timber surround and brass fixings finish the noticeboard face.
    for (const x of [-0.99, 0.99]) {
      box("noticeboard vertical timber trim", { width: 0.12, height: 1.7, depth: 0.09 },
        new BABYLON.Vector3(-21.8 + x, boardGround + 1.82, 32.755), mat.woodLight);
    }
    for (const y of [boardGround + 1.01, boardGround + 2.63]) {
      box("noticeboard horizontal timber trim", { width: 2.08, height: 0.12, depth: 0.09 },
        new BABYLON.Vector3(-21.8, y, 32.755), mat.woodLight);
    }
    for (const x of [-0.92, 0.92]) for (const y of [boardGround + 1.12, boardGround + 2.52]) {
      const nail = BABYLON.MeshBuilder.CreateCylinder("noticeboard brass nail", { height: 0.025, diameter: 0.075, tessellation: 10 }, scene);
      nail.position.set(-21.8 + x, y, 32.70); nail.rotation.x = Math.PI / 2; nail.material = mat.gold; nail.isPickable = false;
    }
    updateContractBoard();
    // Compact four-legged hide/meat workbench, set onto the local ground level.
    const harvestGround = heightAt(-20.7, 40.5);
    box("harvest table top", { width: 3.35, height: 0.18, depth: 1.45 }, new BABYLON.Vector3(-20.7, harvestGround + 1.34, 40.5), mat.woodLight);
    for (const x of [-22.08, -19.32]) for (const z of [39.92, 41.08]) {
      box("harvest bench leg", { width: 0.16, height: 1.15, depth: 0.16 }, new BABYLON.Vector3(x, harvestGround + 0.675, z), mat.bark);
    }
    box("harvest bench lower stretcher", { width: 2.45, height: 0.12, depth: 0.12 }, new BABYLON.Vector3(-20.7, harvestGround + 0.48, 40.5), mat.wood);
    box("harvest bench side stretcher", { width: 0.12, height: 0.12, depth: 0.92 }, new BABYLON.Vector3(-22.08, harvestGround + 0.48, 40.5), mat.wood);

    // A working station has a labelled front, a weighing scale and proper trade fittings.
    box("harvest station fascia backing", { width: 2.95, height: 0.54, depth: 0.12 },
      new BABYLON.Vector3(-20.7, harvestGround + 1.0, 39.69), mat.black);
    harvestSignFrontMesh = BABYLON.MeshBuilder.CreatePlane("Harvest station sign face",
      { width: 2.72, height: 0.36, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
    harvestSignFrontMesh.position.set(-20.7, harvestGround + 1.0, 39.615);
    harvestSignFrontMesh.rotation.y = Math.PI;
    harvestSignFrontMesh.isPickable = false;
    harvestSignTexture = new BABYLON.DynamicTexture("Harvest station plaque lettering", { width: 1024, height: 256 }, scene, true);
    const harvestSignCtx = harvestSignTexture.getContext();
    harvestSignCtx.fillStyle = "#26362d"; harvestSignCtx.fillRect(0, 0, 1024, 256);
    harvestSignCtx.strokeStyle = "#c4a46a"; harvestSignCtx.lineWidth = 12; harvestSignCtx.strokeRect(18, 18, 988, 220);
    harvestSignCtx.textAlign = "center"; harvestSignCtx.fillStyle = "#f0e2c2";
    harvestSignCtx.font = "bold 76px Georgia"; harvestSignCtx.fillText("HARVEST STATION", 512, 112);
    harvestSignCtx.font = "28px Georgia"; harvestSignCtx.fillStyle = "#d2c29e";
    harvestSignCtx.fillText("HIDES  ·  MEAT  ·  FIELD PAYMENT", 512, 177);
    harvestSignTexture.update(true);
    harvestSignMaterial = makeReadableSignMaterial("Harvest station sign material", harvestSignTexture, true);
    harvestSignFrontMesh.material = harvestSignMaterial;
    const scaleBase = box("harvest weighing scale base", { width: 0.62, height: 0.11, depth: 0.52 },
      new BABYLON.Vector3(-19.85, harvestGround + 1.485, 40.32), mat.black);
    const scalePost = BABYLON.MeshBuilder.CreateCylinder("harvest scale stem", { height: 0.38, diameter: 0.08, tessellation: 12 }, scene);
    scalePost.position.set(-19.85, harvestGround + 1.72, 40.32); scalePost.material = mat.gold; scalePost.isPickable = false;
    const scaleDial = BABYLON.MeshBuilder.CreateCylinder("harvest scale dial", { height: 0.075, diameter: 0.46, tessellation: 24 }, scene);
    scaleDial.rotation.x = Math.PI / 2; scaleDial.position.set(-19.85, harvestGround + 1.88, 40.08);
    scaleDial.material = mat.window; scaleDial.isPickable = false;
    const scaleRim = BABYLON.MeshBuilder.CreateTorus("harvest scale brass rim", { diameter: 0.48, thickness: 0.035, tessellation: 24 }, scene);
    scaleRim.rotation.x = Math.PI / 2; scaleRim.position.copyFrom(scaleDial.position); scaleRim.material = mat.gold; scaleRim.isPickable = false;
    const scaleNeedle = box("harvest scale needle", { width: 0.025, height: 0.17, depth: 0.025 },
      new BABYLON.Vector3(-19.85, harvestGround + 1.89, 40.055), mat.black);
    scaleNeedle.rotation.z = -0.28;

    const entryApron = BABYLON.MeshBuilder.CreateCylinder("Pinecrest entry gravel apron",
      { height: 0.16, diameter: 6.3, tessellation: 40 }, scene);
    entryApron.position.set(-14, 0.18, 30.5);
    entryApron.scaling.set(1.28, 1, 0.76); entryApron.material = mat.shore; entryApron.isPickable = false;
    box("outfitter supply counter", { width: 2.8, height: 0.16, depth: 1.05 }, new BABYLON.Vector3(-4.5, 1.18, 40.5), mat.woodLight);
    for (const x of [-5.62, -3.38]) for (const z of [40.08, 40.92]) {
      box("outfitter counter leg", { width: 0.14, height: 1.12, depth: 0.14 }, new BABYLON.Vector3(x, 0.57, z), mat.bark);
    }
    const outfitterAwning = box("outfitter canvas awning", { width: 3.65, height: 0.18, depth: 2.0 },
      new BABYLON.Vector3(-4.5, 3.05, 40.5), mat.roof);
    const outfitterCanvasTexture = new BABYLON.DynamicTexture("Outfitter canvas weave", { width: 512, height: 512 }, scene, true);
    const clothCtx = outfitterCanvasTexture.getContext();
    clothCtx.fillStyle = "#31483a"; clothCtx.fillRect(0, 0, 512, 512);
    for (let stripe = 0; stripe < 8; stripe++) {
      clothCtx.fillStyle = stripe % 2 ? "#d9c89f" : "#31483a";
      clothCtx.fillRect(stripe * 64, 0, 32, 512);
    }
    clothCtx.strokeStyle = "rgba(244,232,199,.42)"; clothCtx.lineWidth = 2;
    for (let seam = 0; seam < 512; seam += 32) {
      clothCtx.beginPath(); clothCtx.moveTo(0, seam); clothCtx.lineTo(512, seam); clothCtx.stroke();
    }
    outfitterCanvasTexture.update(true);
    const outfitterCanvasMaterial = new BABYLON.PBRMaterial("Outfitter stitched canvas", scene);
    outfitterCanvasMaterial.albedoTexture = outfitterCanvasTexture;
    outfitterCanvasMaterial.albedoColor = BABYLON.Color3.White();
    outfitterCanvasMaterial.metallic = 0;
    outfitterCanvasMaterial.roughness = 0.96;
    outfitterAwning.material = outfitterCanvasMaterial;
    for (const x of [-6.12, -2.88]) {
      box("outfitter awning post", { width: 0.16, height: 2.9, depth: 0.16 }, new BABYLON.Vector3(x, 1.55, 39.7), mat.bark);
      box("outfitter awning steel bracket", { width: 0.09, height: 0.48, depth: 0.09 }, new BABYLON.Vector3(x, 2.72, 39.78), mat.black);
    }
    box("outfitter back shelf", { width: 2.45, height: 0.12, depth: 0.42 }, new BABYLON.Vector3(-4.5, 2.0, 41.0), mat.wood);
    // A proper fascia sign on the front edge of the stall.
    box("Outfitters fascia backing", { width: 3.48, height: 0.56, depth: 0.14 },
      new BABYLON.Vector3(-4.5, 2.63, 39.42), mat.wood);
    outfitterSignFrontMesh = BABYLON.MeshBuilder.CreatePlane("Outfitters fascia sign face",
      { width: 3.18, height: 0.36, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
    outfitterSignFrontMesh.position.set(-4.5, 2.63, 39.325);
    outfitterSignFrontMesh.rotation.y = Math.PI;
    outfitterSignFrontMesh.isPickable = false;
    outfitterSignTexture = new BABYLON.DynamicTexture("Outfitters fascia lettering", { width: 1024, height: 192 }, scene, true);
    const outfitterCtx = outfitterSignTexture.getContext();
    outfitterCtx.fillStyle = "#20342a"; outfitterCtx.fillRect(0, 0, 1024, 192);
    outfitterCtx.strokeStyle = "#c5a66c"; outfitterCtx.lineWidth = 10; outfitterCtx.strokeRect(15, 15, 994, 162);
    outfitterCtx.textAlign = "center"; outfitterCtx.fillStyle = "#f2e5c7";
    outfitterCtx.font = "bold 86px Georgia"; outfitterCtx.fillText("OUTFITTERS", 512, 121);
    outfitterSignTexture.update(true);
    outfitterSignMaterial = makeReadableSignMaterial("Outfitter fascia sign material", outfitterSignTexture, true);
    outfitterSignFrontMesh.material = outfitterSignMaterial;
    for (let crate = 0; crate < 3; crate++) {
      const x = -5.25 + crate * 0.75;
      box("outfitter supply crate", { width: 0.52, height: 0.48, depth: 0.48 }, new BABYLON.Vector3(x, 1.52, 40.55), mat.wood);
      for (const z of [40.295, 40.805]) {
        box("outfitter crate iron band", { width: 0.56, height: 0.055, depth: 0.045 }, new BABYLON.Vector3(x, 1.52, z), mat.black);
      }
      for (let slat = 0; slat < 3; slat++) {
        box("outfitter crate face slat", { width: 0.13, height: 0.39, depth: 0.035 },
          new BABYLON.Vector3(x - 0.17 + slat * 0.17, 1.52, 40.29), mat.woodLight);
      }
      const labelPlate = box("outfitter crate brass inventory plate", { width: 0.28, height: 0.12, depth: 0.035 },
        new BABYLON.Vector3(x, 1.53, 40.255), mat.gold);
      labelPlate.isPickable = false;
    }
    // Small, restrained trade goods break up the counter's empty surface.
    const fieldSatchel = BABYLON.MeshBuilder.CreateSphere("outfitter field satchel", { diameter: 0.42, segments: 12 }, scene);
    fieldSatchel.scaling.set(1.25, 0.72, 0.82); fieldSatchel.position.set(-3.9, 1.53, 40.35);
    fieldSatchel.material = makeMaterial("Waxed canvas field satchel", "#6a6548", 0.96); fieldSatchel.isPickable = false;
    box("outfitter satchel leather flap", { width: 0.42, height: 0.10, depth: 0.34 }, new BABYLON.Vector3(-3.9, 1.65, 40.23), mat.roofLight);
    for (let tin = 0; tin < 2; tin++) {
      const ammoTin = BABYLON.MeshBuilder.CreateCylinder("outfitter ammunition tin", { height: 0.32, diameter: 0.18, tessellation: 12 }, scene);
      ammoTin.position.set(-3.5 + tin * 0.22, 1.43, 40.8); ammoTin.material = mat.metal; ammoTin.isPickable = false;
      const tinLid = BABYLON.MeshBuilder.CreateCylinder("outfitter ammunition tin lid", { height: 0.045, diameter: 0.19, tessellation: 12 }, scene);
      tinLid.position.set(-3.5 + tin * 0.22, 1.62, 40.8); tinLid.material = mat.black; tinLid.isPickable = false;
    }
  }


  function getImportedHierarchyBounds(rootNodes) {
    const meshes = [];
    for (const root of rootNodes || []) {
      if (root instanceof BABYLON.AbstractMesh) meshes.push(root);
      meshes.push(...root.getChildMeshes(false));
    }
    let min = new BABYLON.Vector3(Infinity, Infinity, Infinity);
    let max = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);
    let count = 0;
    for (const mesh of meshes) {
      if (!mesh || mesh.isDisposed() || mesh.getTotalVertices() < 1) continue;
      mesh.computeWorldMatrix(true);
      const bounds = mesh.getBoundingInfo().boundingBox;
      min = BABYLON.Vector3.Minimize(min, bounds.minimumWorld);
      max = BABYLON.Vector3.Maximize(max, bounds.maximumWorld);
      count++;
    }
    return count ? { min, max, meshes, count } : null;
  }

  function hideLegacyCabinExterior(root) {
    const legacyShell = /^(lodge stone foundation|lodge timber floor|front log course|rear log course|side log course|Pinecrest (front|rear|side) log cut end|lodge corner timber|lodge front cross beam|lodge rear cross beam|lodge timber gable|lodge pitched roof|roof fascia|roof ridge cap|exposed roof rafter|Pinecrest gable (diagonal king timber|collar tie|king post|timber vent|vent brass rim|vent louver)|Pinecrest lodge front wall opaque backing|window recess|window glazed pane|window upright|window sill|window cross rail|window transom|window shutter backing|window shutter vertical slat|window shutter cross brace|window shutter iron hinge strap|window shutter brass hinge pin|Pinecrest window flower box body|Pinecrest window flower box front board|Pinecrest window flower box iron bracket|Pinecrest window box foliage|Pinecrest window box flower)$/i;
    let hidden = 0;
    for (const mesh of root.getChildMeshes(false)) {
      if (!mesh || mesh.isDisposed()) continue;
      if (legacyShell.test(mesh.name)) {
        mesh.setEnabled(false);
        hidden++;
      }
    }
    return hidden;
  }

  function hideLegacyLodgePorch(root) {
    const legacyPorch = /^(lodge porch platform|porch deck board|solid lodge entry stair \d+|stair front nosing \d+|porch support post|porch post cap|Pinecrest porch timber knee brace|Pinecrest porch brass brace bolt|porch canopy|porch handrail|porch baluster|cabin stove flue|roof fascia|roof ridge cap|exposed roof rafter|Pinecrest lodge metal rain gutter|Pinecrest lodge copper rain downpipe|Pinecrest downpipe outlet shoe)$/i;
    let hidden = 0;
    for (const mesh of root.getChildMeshes(false)) {
      if (!mesh || mesh.isDisposed()) continue;
      if (legacyPorch.test(mesh.name)) {
        mesh.setEnabled(false);
        hidden++;
      }
    }
    return hidden;
  }

  function loadPinecrestLodgeModel(lodgeRoot) {
    lodgeModelLoading = true;

    (async () => {
      let container = null;
      try {
        try {
          container = await BABYLON.SceneLoader.LoadAssetContainerAsync(
            "./assets/buildings/", "pinecrest-mountain-hut.glb", scene
          );
          lodgeModelAssetName = "pinecrest-mountain-hut.glb";
        } catch (primaryError) {
          // Keep the previous, fully-tested log cabin as a safe fallback if the
          // larger architectural asset is unavailable on a local or cached build.
          console.warn("Mountain Hut model unavailable; using the original log cabin:", primaryError);
          container = await BABYLON.SceneLoader.LoadAssetContainerAsync(
            "./assets/buildings/", "pinecrest-lodge.glb", scene
          );
          lodgeModelAssetName = "pinecrest-lodge.glb";
          lodgeModelUsedFallback = true;
        }

        lodgeModelContainer = container;
        const entries = container.instantiateModelsToScene(
          (name) => "PINECREST_AUTHORED_LODGE__" + name,
          true
        );
        const importedRoot = new BABYLON.TransformNode("Pinecrest authored mountain lodge", scene);
        entries.rootNodes.forEach((node) => { node.parent = importedRoot; });
        importedRoot.rotationQuaternion = null;

        // The authored architectural assets face +Z; rotate the arrival facade
        // toward the Pinecrest access path at -Z.
        importedRoot.rotation.y = Math.PI;
        importedRoot.computeWorldMatrix(true);
        const bounds = getImportedHierarchyBounds(entries.rootNodes);
        if (!bounds) throw new Error("The lodge GLB contained no renderable mesh geometry");
        const size = bounds.max.subtract(bounds.min);
        if (size.x <= 0 || size.y <= 0 || size.z <= 0) throw new Error("The lodge GLB has invalid dimensions");

        // Fit uniformly inside the existing compound footprint. The old 3 x 3 m
        // cabin was stretched by different X/Y/Z scales, which flattened its
        // architecture. The new hut keeps its authored proportions and is sized
        // to occupy the lodge foundation, yard and approach without distortion.
        const scale = lodgeModelUsedFallback
          ? Math.min(12.2 / size.x, 10.9 / size.z, 7.0 / size.y)
          : Math.min(12.65 / size.x, 10.95 / size.z, 6.95 / size.y);
        importedRoot.scaling.setAll(scale);
        const centre = bounds.min.add(bounds.max).scale(0.5);
        importedRoot.position.set(
          lodgeRoot.position.x - centre.x * scale,
          lodgeRoot.position.y - bounds.min.y * scale,
          lodgeRoot.position.z - centre.z * scale
        );
        importedRoot.computeWorldMatrix(true);

        const importedNodes = entries.rootNodes.flatMap((node) => [node, ...node.getDescendants(false)]);
        lodgeModelNodeNames = importedNodes.map((node) => String(node.name || "")).filter(Boolean).slice(0, 160);

        // Keep the existing Wildrange interactive door as the live gameplay door.
        // Static model leaves are disabled to prevent two overlapping door slabs.
        for (const node of importedNodes) {
          const nodeName = String(node.name || "").toLowerCase();
          if (/^(door|door_leaf|doorleaf|door_panel|doorpanel)(\.\d+)?$/.test(nodeName) ||
              /^door leaf\b/i.test(nodeName) ||
              /^(door leaf glazing|door leaf handles|door leaf hinges)$/i.test(nodeName)) {
            node.setEnabled(false);
          }
        }

        const hiddenLegacyMeshCount = hideLegacyCabinExterior(lodgeRoot);
        const hiddenLegacyPorchCount = lodgeModelUsedFallback ? 0 : hideLegacyLodgePorch(lodgeRoot);
        let meshCount = 0;
        for (const mesh of getImportedHierarchyBounds(entries.rootNodes).meshes) {
          mesh.isPickable = false;
          mesh.receiveShadows = true;
          mesh.metadata = { ...(mesh.metadata || {}), pinecrestAuthoredLodge: true };
          if (lights.shadows && !/glass|window/i.test(mesh.name)) {
            try { lights.shadows.addShadowCaster(mesh, false); } catch (error) { /* optional shadow detail */ }
          }
          meshCount++;
        }
        lodgeModelRoot = importedRoot;
        lodgeModelMeshCount = meshCount;
        lodgeModelUniformScale = scale;
        lodgeModelWorldDimensions = {
          x: Number((size.x * scale).toFixed(3)),
          y: Number((size.y * scale).toFixed(3)),
          z: Number((size.z * scale).toFixed(3))
        };
        lodgeModelReady = meshCount > 0;
        lodgeModelFailed = !lodgeModelReady;
        lodgeModelLoading = false;
        if (!lodgeModelReady) throw new Error("The imported lodge produced no renderable meshes");
        console.info("Pinecrest authored lodge loaded", {
          asset: lodgeModelAssetName,
          meshCount,
          hiddenLegacyMeshCount,
          hiddenLegacyPorchCount,
          uniformScale: scale,
          dimensions: lodgeModelWorldDimensions
        });
      } catch (error) {
        lodgeModelLoading = false;
        lodgeModelFailed = true;
        lodgeModelError = error && error.message ? error.message : String(error);
        modelLoadFailures.push("lodge: " + lodgeModelError);
        console.error("Pinecrest authored lodge unavailable; retaining procedural lodge fallback:", error);
      }
    })();
  }

  function instantiateHeroTree(container, label, x, z, targetHeight, instanceIndex) {
    const entries = container.instantiateModelsToScene(
      (name) => "PINECREST_HERO_" + label.toUpperCase() + "_" + instanceIndex + "__" + name,
      false
    );
    const wrapper = new BABYLON.TransformNode("Pinecrest high-detail " + label + " tree " + instanceIndex, scene);
    entries.rootNodes.forEach((node) => { node.parent = wrapper; });
    wrapper.rotationQuaternion = null;
    wrapper.position.set(0, 0, 0);
    wrapper.rotation.set(0, 0, 0);
    wrapper.scaling.setAll(1);
    wrapper.computeWorldMatrix(true);

    // These source trees are authored as hundreds/thousands of static twig and
    // needle objects. Batch each tree by material while all source transforms are
    // still in its local space; this retains the high-detail surfaces but reduces
    // thousands of draw calls to a handful of material batches per tree.
    const sourceBounds = getImportedHierarchyBounds([wrapper]);
    if (!sourceBounds) throw new Error(label + " tree asset contained no renderable geometry");
    const sourceMeshes = sourceBounds.meshes;
    heroTreeSourceMeshCount += sourceMeshes.length;
    const byMaterial = new Map();
    const unbatched = [];
    for (const mesh of sourceMeshes) {
      if (!mesh.material || mesh.getTotalVertices() < 1) {
        unbatched.push(mesh);
        continue;
      }
      const group = byMaterial.get(mesh.material) || [];
      group.push(mesh);
      byMaterial.set(mesh.material, group);
    }

    let materialBatch = 0;
    const compactMeshes = [...unbatched];
    for (const [material, meshes] of byMaterial.entries()) {
      if (meshes.length < 2) {
        compactMeshes.push(...meshes);
        continue;
      }
      meshes.forEach((mesh) => mesh.computeWorldMatrix(true));
      try {
        const merged = BABYLON.Mesh.MergeMeshes(meshes, true, true, undefined, false, false);
        if (merged) {
          merged.name = "Pinecrest " + label + " tree material batch " + (++materialBatch);
          merged.parent = wrapper;
          merged.material = material;
          merged.isPickable = false;
          compactMeshes.push(merged);
        } else {
          compactMeshes.push(...meshes);
        }
      } catch (error) {
        console.warn("Wildrange hero tree material batch skipped:", label, error);
        compactMeshes.push(...meshes);
      }
    }

    wrapper.rotation.y = rand(0, Math.PI * 2);
    wrapper.computeWorldMatrix(true);
    const bounds = getImportedHierarchyBounds([wrapper]);
    if (!bounds) throw new Error(label + " tree had no geometry after material batching");
    const size = bounds.max.subtract(bounds.min);
    const scale = targetHeight / Math.max(0.01, size.y);
    const centre = bounds.min.add(bounds.max).scale(0.5);
    const ground = heightAt(x, z);
    wrapper.scaling.setAll(scale);
    wrapper.position.set(
      x - centre.x * scale,
      ground - bounds.min.y * scale,
      z - centre.z * scale
    );
    wrapper.computeWorldMatrix(true);

    // Replace any low-detail procedural tree occupying this hero-tree footprint.
    for (const node of scene.transformNodes) {
      if (node === wrapper || node.name !== "forest-tree-root" || !node.isEnabled()) continue;
      if (Math.hypot(node.position.x - x, node.position.z - z) < 6.2) node.setEnabled(false);
    }

    for (const mesh of compactMeshes) {
      if (!mesh || mesh.isDisposed()) continue;
      mesh.isPickable = false;
      mesh.receiveShadows = true;
      mesh.metadata = { ...(mesh.metadata || {}), pinecrestHeroVegetation: label };
      if (lights.shadows && !mesh.material?.needAlphaBlending?.()) {
        try { lights.shadows.addShadowCaster(mesh, false); } catch (error) { /* leaf geometry may skip shadowing */ }
      }
      heroTreeMeshCount++;
    }
    obstacles.push({ x, z, radius: label === "conifer" ? 3.5 : 3.0 });
    heroTreeModelCount++;
  }

  function loadPinecrestHeroVegetation() {
    const coniferPlacements = [
      { x: -47, z: 43, height: 15.0 },
      { x: 19, z: 61, height: 14.0 }
    ];
    const broadleafPlacements = [
      { x: -46, z: 63, height: 9.0 },
      { x: 20, z: 43, height: 9.5 }
    ];

    BABYLON.SceneLoader.LoadAssetContainerAsync("./assets/vegetation/", "conifer-detailed.glb", scene)
      .then((container) => {
        coniferPlacements.forEach((point, index) =>
          instantiateHeroTree(container, "conifer", point.x, point.z, point.height, index + 1)
        );
        heroConiferReady = true;
      })
      .catch((error) => {
        const message = error && error.message ? error.message : String(error);
        heroVegetationFailures.push("conifer: " + message);
        modelLoadFailures.push("conifer: " + message);
        console.error("Pinecrest detailed conifers unavailable; retaining procedural forest:", error);
      });

    BABYLON.SceneLoader.LoadAssetContainerAsync("./assets/vegetation/", "linden-detailed.glb", scene)
      .then((container) => {
        broadleafPlacements.forEach((point, index) =>
          instantiateHeroTree(container, "broadleaf", point.x, point.z, point.height, index + 1)
        );
        heroBroadleafReady = true;
      })
      .catch((error) => {
        const message = error && error.message ? error.message : String(error);
        heroVegetationFailures.push("broadleaf: " + message);
        modelLoadFailures.push("broadleaf: " + message);
        console.error("Pinecrest detailed broadleaf trees unavailable; retaining procedural forest:", error);
      });
  }

  function buildPinecrestCompoundAccess() {
    // Join the outpost to the main forest trail with a gentle, graded approach.
    makePath([
      { x: -1.4, z: 31.8 },
      { x: -4.8, z: 31.5 },
      { x: -8.7, z: 30.4 },
      { x: -11.5, z: 29.55 },
      { x: -14.0, z: 29.0 }
    ], 4.15, mat.dirtLight, "Pinecrest outpost access road");

    // Short walking spurs connect the entrance to the noticeboard and outfitter.
    makePath([
      { x: -14.0, z: 29.0 },
      { x: -17.2, z: 30.2 },
      { x: -19.7, z: 32.0 },
      { x: -21.8, z: 33.0 }
    ], 1.85, mat.dirt, "Pinecrest noticeboard footpath");
    makePath([
      { x: -14.0, z: 29.0 },
      { x: -10.0, z: 31.2 },
      { x: -7.1, z: 35.0 },
      { x: -4.5, z: 40.0 }
    ], 2.1, mat.dirt, "Pinecrest outfitter footpath");

    // The front yard has a worn stone walk over the gravel apron, aligned with
    // the actual step treads. Each slab is individually bedded into the ground.
    const pavers = [
      { z: 30.35, width: 2.25, depth: 0.82 },
      { z: 31.55, width: 2.0, depth: 0.78 },
      { z: 32.72, width: 2.15, depth: 0.76 },
      { z: 33.72, width: 2.0, depth: 0.72 }
    ];
    pavers.forEach((paver, index) => {
      const stone = box("lodge approach stone slab " + (index + 1),
        { width: paver.width, height: 0.12, depth: paver.depth },
        new BABYLON.Vector3(-14 + (index % 2 ? 0.06 : -0.04), 0.19, paver.z),
        index % 2 ? mat.stoneDark : mat.shore);
      stone.rotation.y = (index % 2 ? -0.035 : 0.025);
    });

    // Low, matching timber planting beds soften the fence edges without
    // putting tall vegetation back against the lodge walls.
    const addPlanter = (x, z, label) => {
      const bedY = heightAt(x, z);
      box(label + " stone plinth", { width: 3.55, height: 0.14, depth: 1.12 },
        new BABYLON.Vector3(x, bedY + 0.07, z), mat.stoneDark);
      box(label + " soil bed", { width: 3.22, height: 0.20, depth: 0.82 },
        new BABYLON.Vector3(x, bedY + 0.31, z), mat.black);
      for (const side of [-1, 1]) {
        box(label + " timber long rim", { width: 3.62, height: 0.22, depth: 0.14 },
          new BABYLON.Vector3(x, bedY + 0.48, z + side * 0.48), mat.wood);
      }
      for (const side of [-1, 1]) {
        box(label + " timber end rim", { width: 0.14, height: 0.22, depth: 0.92 },
          new BABYLON.Vector3(x + side * 1.74, bedY + 0.48, z), mat.woodLight);
      }
      for (let flower = 0; flower < 7; flower++) {
        const fx = x - 1.28 + flower * 0.42;
        const fz = z + Math.sin(flower * 1.8) * 0.18;
        const stemHeight = 0.38 + (flower % 3) * 0.045;
        const stem = BABYLON.MeshBuilder.CreateCylinder(label + " flower stem", {
          height: stemHeight, diameter: 0.035, tessellation: 6
        }, scene);
        stem.position.set(fx, bedY + 0.49 + stemHeight / 2, fz); stem.material = mat.leaf2; stem.isPickable = false;
        const bloom = BABYLON.MeshBuilder.CreateSphere(label + " flower bloom", { diameter: 0.17, segments: 8 }, scene);
        bloom.position.set(fx, bedY + 0.49 + stemHeight + 0.035, fz);
        bloom.material = flower % 2 ? mat.flowerCream : mat.flowerGold;
        bloom.isPickable = false;
      }
    };
    addPlanter(-23.3, 42.2, "West compound garden");
    addPlanter(-4.7, 44.0, "East compound garden");

    // A small dry-stone edge marks the main yard without building another wall.
    for (let i = 0; i < 8; i++) {
      const z = 34 + i * 1.55;
      const x = -28.2 + Math.sin(i * 0.7) * 0.45;
      const stone = BABYLON.MeshBuilder.CreateIcoSphere("west yard boundary fieldstone", {
        radius: 0.38 + (i % 3) * 0.07, subdivisions: 1
      }, scene);
      stone.position.set(x, heightAt(x, z) + 0.22, z);
      stone.scaling.set(1.2, 0.68, 0.92);
      stone.material = mat.stoneDark; stone.isPickable = false;
    }
  }

  function buildPinecrestCompoundLife() {
    // A small working woodshed gives the right side of the yard a useful silhouette
    // and visually balances the cabin, outfitter and harvest station.
    const shedGround = heightAt(-5.55, 48.45);
    const shed = new BABYLON.TransformNode("Pinecrest firewood shelter", scene);
    shed.position.set(-5.55, shedGround, 48.45);
    const shedBox = (name, size, x, y, z, material) =>
      box(name, size, new BABYLON.Vector3(x, y, z), material, shed);
    shedBox("Pinecrest firewood shelter stone pad",
      { width: 4.15, height: 0.18, depth: 3.05 }, 0, 0.10, 0, mat.stoneDark);

    for (const x of [-1.62, 1.62]) for (const z of [-1.12, 1.12]) {
      shedBox("Pinecrest firewood shelter structural post",
        { width: 0.22, height: 2.35, depth: 0.22 }, x, 1.26, z, mat.bark);
      shedBox("Pinecrest firewood shelter stone post foot",
        { width: 0.36, height: 0.18, depth: 0.36 }, x, 0.27, z, mat.stone);
      shedBox("Pinecrest firewood shelter post cap",
        { width: 0.32, height: 0.12, depth: 0.32 }, x, 2.47, z, mat.woodLight);
    }
    shedBox("Pinecrest woodshed rear header",
      { width: 3.55, height: 0.18, depth: 0.20 }, 0, 2.34, 1.10, mat.woodLight);
    shedBox("Pinecrest woodshed front header",
      { width: 3.55, height: 0.18, depth: 0.20 }, 0, 2.12, -1.10, mat.woodLight);

    for (let board = 0; board < 8; board++) {
      shedBox("Pinecrest woodshed rear vertical board",
        { width: 0.38, height: 1.82, depth: 0.10 },
        -1.35 + board * 0.385, 1.20, 1.08, board % 3 ? mat.wood : mat.woodLight);
    }
    for (const side of [-1, 1]) {
      const brace = shedBox("Pinecrest woodshed diagonal side brace",
        { width: 1.05, height: 0.13, depth: 0.12 },
        side * 1.46, 1.72, 0.04, mat.woodLight);
      brace.rotation.y = side * 0.24;
      brace.rotation.z = -side * 0.58;
    }
    const leanToRoof = shedBox("Pinecrest woodshed pitched roof",
      { width: 4.25, height: 0.20, depth: 3.12 }, 0, 2.53, 0, mat.roof);
    leanToRoof.rotation.x = -0.16;
    shedBox("Pinecrest woodshed front roof fascia",
      { width: 4.30, height: 0.20, depth: 0.18 }, 0, 2.24, -1.47, mat.woodLight);
    shedBox("Pinecrest woodshed rear roof fascia",
      { width: 4.30, height: 0.20, depth: 0.18 }, 0, 2.72, 1.47, mat.woodLight);
    for (let rafter = 0; rafter < 5; rafter++) {
      const rafterBeam = shedBox("Pinecrest woodshed roof rafter",
        { width: 0.13, height: 0.17, depth: 2.95 },
        -1.72 + rafter * 0.86, 2.45, 0, mat.wood);
      rafterBeam.rotation.x = -0.16;
    }
    for (let seam = 0; seam < 7; seam++) {
      shedBox("Pinecrest woodshed roof standing seam",
        { width: 0.055, height: 0.035, depth: 2.86 },
        -1.9 + seam * 0.63, 2.66, 0, mat.woodLight);
    }

    // Split logs are individually stacked, with visible pale cut ends and dark bark.
    for (let row = 0; row < 3; row++) {
      for (let column = 0; column < 4; column++) {
        const x = -1.12 + column * 0.74 + (row % 2) * 0.10;
        const y = 0.50 + row * 0.25;
        const z = -0.12 + (column % 2) * 0.17;
        const log = BABYLON.MeshBuilder.CreateCylinder("Pinecrest woodshed split firewood",
          { height: 0.62, diameter: 0.19, tessellation: 10 }, scene);
        log.parent = shed;
        log.rotation.z = Math.PI / 2;
        log.position.set(x, y, z);
        log.material = mat.bark;
        log.isPickable = false;
        for (const end of [-1, 1]) {
          const cut = BABYLON.MeshBuilder.CreateCylinder("Pinecrest firewood pale end grain",
            { height: 0.025, diameter: 0.17, tessellation: 10 }, scene);
          cut.parent = shed;
          cut.rotation.z = Math.PI / 2;
          cut.position.set(x + end * 0.32, y, z);
          cut.material = mat.woodLight;
          cut.isPickable = false;
        }
      }
    }

    // A small rack of field tools is fixed to the shed's open side.
    for (let tool = 0; tool < 3; tool++) {
      const handle = shedBox("Pinecrest woodshed tool handle",
        { width: 0.09, height: 1.18, depth: 0.09 },
        -1.31 + tool * 0.34, 1.25, -1.25, mat.woodLight);
      handle.rotation.z = (tool - 1) * 0.07;
      const head = shedBox("Pinecrest woodshed tool steel head",
        { width: 0.42, height: 0.17, depth: 0.11 },
        -1.31 + tool * 0.34, 1.84, -1.25, mat.black);
      head.rotation.z = (tool - 1) * 0.07;
    }

    // A timber watering trough with a real water surface and iron straps.
    const troughX = 2.60;
    const troughZ = 0.20;
    shedBox("Pinecrest yard water trough body",
      { width: 1.55, height: 0.54, depth: 0.70 }, troughX, 0.55, troughZ, mat.wood);
    shedBox("Pinecrest yard water trough dark interior",
      { width: 1.37, height: 0.045, depth: 0.53 }, troughX, 0.83, troughZ, mat.black);
    const waterSurface = BABYLON.MeshBuilder.CreateGround("Pinecrest yard trough water",
      { width: 1.31, height: 0.47, subdivisions: 1 }, scene);
    waterSurface.parent = shed;
    waterSurface.position.set(troughX, 0.86, troughZ);
    waterSurface.material = mat.water;
    waterSurface.isPickable = false;
    for (const x of [troughX - 0.52, troughX + 0.52]) {
      shedBox("Pinecrest trough iron binding",
        { width: 0.075, height: 0.58, depth: 0.74 }, x, 0.56, troughZ, mat.black);
      shedBox("Pinecrest trough stone foot",
        { width: 0.24, height: 0.20, depth: 0.82 }, x, 0.21, troughZ, mat.stoneDark);
    }
    obstacles.push({ x: -5.55, z: 48.45, radius: 1.60 });
    obstacles.push({ x: -2.95, z: 48.65, radius: 0.72 });

    // Warm pools of light at the shelter and main yard add a sense of occupancy.
    const shedLamp = shedBox("Pinecrest woodshed lantern backplate",
      { width: 0.34, height: 0.46, depth: 0.12 }, 0, 2.00, -1.18, mat.black);
    const shedLampGlass = shedBox("Pinecrest woodshed lantern glass",
      { width: 0.20, height: 0.30, depth: 0.08 }, 0, 2.00, -1.27, mat.window);
    shedLampGlass.material.emissiveColor = hex("#e9a958");
    shedLamp.isPickable = false;
    const shedLight = new BABYLON.PointLight("Pinecrest woodshed warm light",
      new BABYLON.Vector3(-5.55, shedGround + 2.02, 47.15), scene);
    shedLight.diffuse = hex("#f0bd7b");
    shedLight.intensity = 0.18;
    shedLight.range = 7;

    // Low native fern groups and flowering edges soften the hard fence lines.
    const addFern = (x, z, scale, label) => {
      const groundY = heightAt(x, z);
      for (let frond = 0; frond < 7; frond++) {
        const angle = frond / 7 * Math.PI * 2;
        const leaf = BABYLON.MeshBuilder.CreateSphere(label + " fern frond",
          { diameter: 0.52, segments: 8 }, scene);
        leaf.position.set(
          x + Math.cos(angle) * 0.22 * scale,
          groundY + 0.28 * scale,
          z + Math.sin(angle) * 0.22 * scale
        );
        leaf.scaling.set(0.24 * scale, 0.84 * scale, 0.16 * scale);
        leaf.rotation.z = Math.cos(angle) * -0.30;
        leaf.rotation.x = Math.sin(angle) * 0.30;
        leaf.rotation.y = angle;
        leaf.material = frond % 3 === 0 ? mat.leaf3 : mat.leaf2;
        leaf.isPickable = false;
      }
      const centre = BABYLON.MeshBuilder.CreateSphere(label + " fern crown",
        { diameter: 0.30 * scale, segments: 8 }, scene);
      centre.position.set(x, groundY + 0.16 * scale, z);
      centre.scaling.y = 0.62;
      centre.material = mat.leaf1;
      centre.isPickable = false;
    };
    addFern(-25.0, 37.2, 1.00, "Pinecrest west entrance");
    addFern(-24.8, 49.6, 0.92, "Pinecrest west fence");
    addFern(-2.15, 36.3, 0.92, "Pinecrest east entrance");
    addFern(-2.40, 52.0, 1.02, "Pinecrest east fence");
    addFern(-8.2, 51.4, 0.86, "Pinecrest northern garden");

    // Hand-set fieldstones edge the main entry pavers so the path sits in the yard
    // rather than appearing as a ribbon laid on top of the grass.
    for (let index = 0; index < 7; index++) {
      const z = 29.9 + index * 0.72;
      for (const side of [-1, 1]) {
        const x = -14 + side * (1.45 + (index % 2) * 0.10);
        const stone = BABYLON.MeshBuilder.CreateIcoSphere("Pinecrest walkway edge fieldstone",
          { radius: 0.24 + (index % 3) * 0.045, subdivisions: 1 }, scene);
        stone.position.set(x, heightAt(x, z) + 0.14, z);
        stone.scaling.set(1.18, 0.70, 0.92);
        stone.material = index % 2 ? mat.stoneDark : mat.shore;
        stone.isPickable = false;
      }
    }

    // A small, worn service path connects the woodshed to the outfitter side of the lodge.
    makePath([
      { x: -5.7, z: 46.3 },
      { x: -7.0, z: 45.6 },
      { x: -7.2, z: 43.5 },
      { x: -5.8, z: 42.4 },
      { x: -4.5, z: 40.8 }
    ], 1.20, mat.dirt, "Pinecrest woodshed service path");
  }

  function makeInteractable(name, description, x, z, action, target) {
    interactables.push({ name, description, x, z, action, target });
  }

  function scatterEnvironment() {
    let placed = 0, attempts = 0;
    while (placed < 246 && attempts < 2500) {
      attempts++;
      const x = rand(-125, 125);
      const z = rand(-124, 125);
      if (flatArea(x, z)) continue;
      if (isPinecrestCompoundClearance(x, z)) continue;
      if (Math.hypot(x, z - 31) < 21) continue;
      if (Math.hypot((x - 55) / 1.3, (z + 44) / 0.8) < 27) continue;
      const roadX = 0.003 * z * z - 0.12 * z - 1;
      if (Math.abs(x - roadX) < 7 && z > 25 && z < 108) continue;
      const scale = rand(0.98, 1.78);
      const broadleaf = Math.random() > 0.83;
      createTree(x, z, scale, broadleaf);
      placed++;
    }
    let nearPlaced = 0, nearAttempts = 0;
    while (nearPlaced < 68 && nearAttempts < 850) {
      nearAttempts++;
      const angle = rand(0, Math.PI * 2);
      const radius = rand(30, 74);
      const x = Math.cos(angle) * radius;
      const z = 19 + Math.sin(angle) * radius;
      if (flatArea(x, z)) continue;
      if (isPinecrestCompoundClearance(x, z)) continue;
      if (Math.hypot((x - 55) / 1.3, (z + 44) / 0.8) < 29) continue;
      const roadX = 0.003 * z * z - 0.12 * z - 1;
      if (Math.abs(x - roadX) < 9 && z > 25 && z < 108) continue;
      if (obstacles.some((item) => Math.hypot(x - item.x, z - item.z) < item.radius + 2.5)) continue;
      createTree(x, z, rand(1.15, 1.85), Math.random() > 0.84);
      nearPlaced++;
    }
    for (let i = 0; i < 50; i++) {
      const x = rand(-115, 115), z = rand(-115, 120);
      if (flatArea(x, z) || isPinecrestCompoundClearance(x, z) ||
          (Math.hypot((x - 55) / 1.3, (z + 44) / 0.8) < 24)) continue;
      createRock(x, z, rand(0.45, 1.25));
    }
    // Dense ground cover and undergrowth are built after trees and rocks are placed.
  }

  function setupLighting() {
    const hemi = new BABYLON.HemisphericLight("sky-fill", new BABYLON.Vector3(0, 1, 0), scene);
    hemi.intensity = 0.62;
    hemi.groundColor = hex("#465541");
    hemi.diffuse = hex("#e5e8d6");
    const sun = new BABYLON.DirectionalLight("morning-sun", new BABYLON.Vector3(-0.38, -1, 0.24), scene);
    sun.position = new BABYLON.Vector3(65, 105, -70);
    sun.intensity = 1.0;
    sun.diffuse = hex("#ffe1b2");
    sun.specular = hex("#fff0d3");
    lights.hemi = hemi;
    lights.sun = sun;
    try {
      const shadows = new BABYLON.ShadowGenerator(1536, sun);
      shadows.useBlurExponentialShadowMap = true;
      shadows.blurKernel = 18;
      shadows.bias = 0.00018;
      shadows.normalBias = 0.018;
      shadows.darkness = 0.38;
      shadows.forceBackFacesOnly = true;
      lights.shadows = shadows;
    } catch (error) {
      console.warn("Shadow map unavailable; continuing without shadows.", error);
    }
  }

  function createWeapon() {
    weaponRoot = new BABYLON.TransformNode("Wildrange scoped marksman rifle", scene);
    weaponRoot.parent = camera;
    weaponRoot.position.set(0.34, -0.34, 0.76);
    weaponRoot.rotation.set(0, 0, 0);

    // Small visual effect only; both rifle silhouettes and optic hardware are imported GLB meshes.
    const flashMaterial = new BABYLON.StandardMaterial("Rifle muzzle flash material", scene);
    flashMaterial.diffuseColor = hex("#f6c875");
    flashMaterial.emissiveColor = hex("#f69b35");
    flashMaterial.alpha = 0.88;
    const flash = BABYLON.MeshBuilder.CreateSphere("Rifle muzzle flash", { diameter: 0.16, segments: 10 }, scene);
    flash.parent = weaponRoot;
    flash.position.set(0, 0.02, 0.69);
    flash.material = flashMaterial;
    flash.isPickable = false;
    flash.setEnabled(false);
    weaponMaterials.flash = flash;
    weaponRoot.setEnabled(true);

    const attachRifleContainer = (container, useLegacyFallback) => {
      const sourceGroups = container.animationGroups || [];
      const sourceNames = sourceGroups.map((group) => String(group.name).toLowerCase());
      const requiredClips = ["magazine-open", "magazine-close", "bolt-open", "bolt-close"];
      if (!useLegacyFallback) {
        const missing = requiredClips.filter((clip) => !sourceNames.some((name) => name.includes(clip)));
        if (missing.length) throw new Error("New rifle is missing native clips: " + missing.join(", "));
      }

      const entries = container.instantiateModelsToScene(
        (name) => (useLegacyFallback ? "RANGER308__" : "WILDRANGE_MARKSMAN__") + name,
        true
      );
      entries.rootNodes.forEach((node) => {
        node.parent = weaponRoot;
        node.rotationQuaternion = null;
        node.position.set(0, 0, 0);
        if (useLegacyFallback) {
          // Legacy Polyfork service rifle is authored along +X; turn it to face the camera's +Z.
          node.rotation.set(0, -Math.PI / 2, 0);
          node.scaling.scaleInPlace(1.62);
        } else {
          // The CC0 marksman asset is metre-scaled, Y-up and already faces +Z.
          node.rotation.set(0, 0, 0);
          node.scaling.set(1, 1, 1);
        }
      });

      weaponModelRoot = entries.rootNodes[0] || null;
      const nodes = entries.rootNodes.flatMap((root) => [root, ...root.getDescendants(false)]);
      weaponBoltNode = nodes.find((node) => String(node.name).toLowerCase().includes("bolt")) || null;
      weaponBoltBase = weaponBoltNode ? {
        position: weaponBoltNode.position.clone(),
        rotation: weaponBoltNode.rotation.clone()
      } : null;
      weaponScopePartCount = nodes.filter((node) => /scope|optic/i.test(String(node.name))).length;
      weaponHasIntegratedScope = !useLegacyFallback;
      weaponAnimationGroups = entries.animationGroups || [];
      weaponAnimationClipNames = weaponAnimationGroups.map((group) => String(group.name));
      weaponAnimationGroups.forEach((group) => group.stop());

      const meshes = entries.rootNodes.flatMap((root) => root.getChildMeshes(false));
      meshes.forEach((mesh) => {
        mesh.isPickable = false;
        mesh.receiveShadows = true;
        mesh.metadata = { ...(mesh.metadata || {}), weaponPart: true };
        if (lights.shadows) {
          try { lights.shadows.addShadowCaster(mesh); } catch (error) { /* optional */ }
        }
      });
      weaponAssetMeshCount = meshes.length;
      weaponModelReady = Boolean(weaponModelRoot && meshes.length);
      weaponFallbackUsed = Boolean(useLegacyFallback);
      if (!weaponModelReady) throw new Error("Imported rifle contained no renderable geometry");
      updateHud();
    };

    BABYLON.SceneLoader.LoadAssetContainerAsync("./assets/weapons/", "marksman-rifle.glb", scene)
      .then((container) => attachRifleContainer(container, false))
      .catch((primaryError) => {
        console.warn("Wildrange marksman rifle unavailable; loading the local legacy rifle fallback.", primaryError);
        return BABYLON.SceneLoader.LoadAssetContainerAsync("./assets/weapons/", "bolt-action-rifle.glb", scene)
          .then((container) => attachRifleContainer(container, true));
      })
      .catch((error) => {
        weaponModelFailed = true;
        modelLoadFailures.push("rifle: " + (error && error.message ? error.message : String(error)));
        console.error("Wildrange rifle model failed to load:", error);
      });
  }

  function getAnimalModelContainer(species) {
    const key = species === "boar" ? "boar" : "deer";
    if (!animalAssetPromises[key]) {
      const file = key === "boar" ? "pig-base.glb" : "deer-base.glb";
      animalAssetPromises[key] = BABYLON.SceneLoader.LoadAssetContainerAsync("./assets/animals/", file, scene);
    }
    return animalAssetPromises[key];
  }

  function setAnimalAnimation(animal, clipName) {
    if (!animal || !animal.modelReady || !animal.modelAnimations) return;
    if (animal.currentAnimation === clipName) return;
    const clip = animal.modelAnimations.find((group) => group.name.toLowerCase() === clipName.toLowerCase());
    if (!clip) return;
    animal.modelAnimations.forEach((group) => { if (group !== clip) group.stop(); });
    clip.start(true, 1);
    animal.currentAnimation = clipName;
  }

  function findAnimalNode(animal, suffix) {
    return animal.modelNodes.find((node) =>
      node.name === animal.id + "__" + suffix || node.name.endsWith("__" + suffix) || node.name === suffix
    ) || null;
  }

  function addAnimalHeadHitbox(animal) {
    const head = animal.rig && animal.rig.head;
    if (!head) return;
    const material = new BABYLON.StandardMaterial("Invisible wildlife head hitbox", scene);
    material.alpha = 0;
    material.disableLighting = true;
    material.backFaceCulling = false;
    const hitbox = BABYLON.MeshBuilder.CreateSphere("Wildlife headshot hitbox", { diameter: 0.28, segments: 12 }, scene);
    hitbox.parent = head;
    hitbox.position.set(0, 0.015, 0.025);
    hitbox.scaling.set(0.9, 1, 1.18);
    hitbox.material = material;
    hitbox.isPickable = true;
    hitbox.visibility = 0;
    hitbox.metadata = { animalId: animal.id, animalPart: "head", headshotProxy: true };
    animal.headHitbox = hitbox;
  }

  function addBuckAntlers(animal) {
    const head = animal.rig && animal.rig.head;
    if (!head || animal.species !== "buck") return;
    const material = mat.antler || mat.metal;
    for (const side of [-1, 1]) {
      const beam = BABYLON.MeshBuilder.CreateTube("Whitetail antler beam", {
        path: [
          new BABYLON.Vector3(side * 0.075, 0.12, -0.015),
          new BABYLON.Vector3(side * 0.10, 0.24, 0),
          new BABYLON.Vector3(side * 0.19, 0.34, -0.015),
          new BABYLON.Vector3(side * 0.30, 0.35, -0.02)
        ],
        radius: 0.025, tessellation: 8
      }, scene);
      makeAnimalPart(head, beam, material, "head");
      [
        [0.13, 0.29, 0.10, 0.43],
        [0.205, 0.345, 0.25, 0.49],
        [0.26, 0.35, 0.34, 0.44]
      ].forEach((t) => {
        const tine = BABYLON.MeshBuilder.CreateTube("Whitetail antler tine", {
          path: [
            new BABYLON.Vector3(side * t[0], t[1], -0.01),
            new BABYLON.Vector3(side * t[2], t[3], -0.015)
          ],
          radius: 0.014, tessellation: 7
        }, scene);
        makeAnimalPart(head, tine, material, "head");
      });
    }
  }

  function addBoarTusks(animal) {
    const head = animal.rig && animal.rig.head;
    if (!head || animal.species !== "boar") return;
    for (const side of [-1, 1]) {
      const tusk = BABYLON.MeshBuilder.CreateTube("Wild boar ivory tusk", {
        path: [
          new BABYLON.Vector3(side * 0.12, -0.12, 0.08),
          new BABYLON.Vector3(side * 0.16, -0.015, 0.12),
          new BABYLON.Vector3(side * 0.17, 0.095, 0.12),
          new BABYLON.Vector3(side * 0.14, 0.17, 0.10)
        ],
        radius: 0.025, tessellation: 9
      }, scene);
      makeAnimalPart(head, tusk, mat.boarTusks || mat.white, "head");
    }
  }

  function attachAnimalModel(animal) {
    getAnimalModelContainer(animal.species).then((container) => {
      if (animal.harvested || animal.modelReady) return;
      const entries = container.instantiateModelsToScene(
        (name) => animal.id + "__" + name,
        animal.species === "boar"
      );
      entries.rootNodes.forEach((node) => {
        node.parent = animal.root;
        node.scaling.scaleInPlace(animal.species === "boar" ? 0.98 : 0.78);
      });
      animal.modelEntries = entries;
      animal.modelAnimations = entries.animationGroups || [];
      animal.modelNodes = entries.rootNodes.flatMap((root) => [root, ...root.getDescendants(false)]);
      animal.modelRoot = entries.rootNodes[0] || null;
      animal.rig = {
        head: findAnimalNode(animal, "Head"),
        neck: findAnimalNode(animal, "Neck"),
        jaw: findAnimalNode(animal, "Jaw"),
        ears: [findAnimalNode(animal, "LeftEar"), findAnimalNode(animal, "RightEar")].filter(Boolean),
        tail: findAnimalNode(animal, "Tail"),
        tailTip: findAnimalNode(animal, "TailTip"),
        legs: [
          [findAnimalNode(animal, "LeftFrontUpLeg"), findAnimalNode(animal, "LeftFrontLeg")],
          [findAnimalNode(animal, "RightFrontUpLeg"), findAnimalNode(animal, "RightFrontLeg")],
          [findAnimalNode(animal, "LeftHindUpLeg"), findAnimalNode(animal, "LeftHindLeg")],
          [findAnimalNode(animal, "RightHindUpLeg"), findAnimalNode(animal, "RightHindLeg")]
        ].filter((pair) => pair[0] && pair[1])
      };
      if (!animal.modelRoot || !entries.skeletons || !entries.skeletons.length) {
        throw new Error(animal.species + " GLB did not instantiate a skinned character rig");
      }
      const meshes = entries.rootNodes.flatMap((root) => root.getChildMeshes(false));
      meshes.forEach((mesh) => {
        mesh.metadata = { ...(mesh.metadata || {}), animalId: animal.id, animalPart: "body" };
        mesh.isPickable = true;
        mesh.receiveShadows = true;
        if (lights.shadows) {
          try { lights.shadows.addShadowCaster(mesh); } catch (error) { /* optional */ }
        }
        if (animal.species === "boar" && mesh.material) {
          const material = mesh.material;
          if (material.albedoColor) material.albedoColor.copyFrom(hex("#563922"));
          if (material.diffuseColor) material.diffuseColor.copyFrom(hex("#563922"));
          if (material.roughness !== undefined) material.roughness = 0.94;
          if (material.metallic !== undefined) material.metallic = 0;
        }
      });
      animal.legs = [];
      animal.headPivot = null;
      animal.ears = [];
      animal.tailPivot = null;
      animal.body = null;
      animal.modelReady = true;
      animal.modelLoadFailed = false;
      addAnimalHeadHitbox(animal);
      addBuckAntlers(animal);
      addBoarTusks(animal);
      animal.root.setEnabled(true);
      if (animal.species === "boar") importedBoarCount++;
      else importedDeerCount++;
      importedAnimalCount++;
      setAnimalAnimation(animal, "Idle");
    }).catch((error) => {
      animal.modelLoadFailed = true;
      animal.root.setEnabled(false);
      const message = animal.species + " (" + animal.id + "): " + (error && error.message ? error.message : String(error));
      modelLoadFailures.push(message);
      console.error("Wildrange wildlife model failed to load:", message, error);
    });
  }

  function makeAnimalPart(parent, mesh, material, part) {
    mesh.parent = parent;
    mesh.material = material;
    mesh.isPickable = true;
    let animalRoot = parent;
    while (animalRoot && !(animalRoot.metadata && animalRoot.metadata.animalId)) animalRoot = animalRoot.parent;
    mesh.metadata = { animalId: animalRoot && animalRoot.metadata ? animalRoot.metadata.animalId : null, animalPart: part || "body" };
    if (lights.shadows) {
      try { lights.shadows.addShadowCaster(mesh); } catch (error) { /* optional */ }
    }
    return mesh;
  }

  function makeEye(parent, x, y, z, side) {
    const eye = BABYLON.MeshBuilder.CreateSphere("wildlife-eye", { diameter: 0.085, segments: 8 }, scene);
    eye.position.set(x + side * 0.16, y, z);
    makeAnimalPart(parent, eye, mat.eye, "head");
    return eye;
  }

  function createWildlifeLeg(root, x, z, material, options) {
    const config = options || {};
    const upperLength = config.upperLength || 0.48;
    const lowerLength = config.lowerLength || 0.45;
    const thickness = config.thickness || 1;
    const upperPivot = new BABYLON.TransformNode("wildlife upper leg joint", scene);
    upperPivot.parent = root;
    upperPivot.position.set(x, config.hipHeight || 1.02, z);
    const upper = BABYLON.MeshBuilder.CreateCylinder("muscular upper leg", {
      height: upperLength, diameterTop: 0.13 * thickness, diameterBottom: 0.18 * thickness, tessellation: 14
    }, scene);
    upper.position.y = -upperLength * 0.48;
    makeAnimalPart(upperPivot, upper, material, "body");
    const knee = BABYLON.MeshBuilder.CreateSphere("leg knee joint", { diameter: 0.15 * thickness, segments: 12 }, scene);
    knee.position.y = -upperLength * 0.92;
    makeAnimalPart(upperPivot, knee, material, "body");
    const lowerPivot = new BABYLON.TransformNode("wildlife lower leg joint", scene);
    lowerPivot.parent = upperPivot;
    lowerPivot.position.y = -upperLength * 0.92;
    const lower = BABYLON.MeshBuilder.CreateCylinder("slim lower cannon", {
      height: lowerLength, diameterTop: 0.09 * thickness, diameterBottom: 0.065 * thickness, tessellation: 12
    }, scene);
    lower.position.y = -lowerLength * 0.48;
    makeAnimalPart(lowerPivot, lower, material, "body");
    const ankle = BABYLON.MeshBuilder.CreateSphere("ankle joint", { diameter: 0.085 * thickness, segments: 10 }, scene);
    ankle.position.y = -lowerLength * 0.9;
    makeAnimalPart(lowerPivot, ankle, material, "body");
    const hoof = BABYLON.MeshBuilder.CreateBox("cloven hoof", { width: 0.13 * thickness, height: 0.105, depth: 0.18 * thickness }, scene);
    hoof.position.set(0, -lowerLength - 0.04, 0.025);
    makeAnimalPart(lowerPivot, hoof, mat.hoof, "body");
    return { upper: upperPivot, lower: lowerPivot, phase: config.phase || 0, front: Boolean(config.front) };
  }

  function createAnimalState(id, species, x, z) {
    const info = speciesInfo[species];
    const root = new BABYLON.TransformNode("wildlife-" + id, scene);
    root.metadata = { animalId: id };
    root.position.set(x, heightAt(x, z), z);
    root.rotation.y = rand(0, Math.PI * 2);
    root.setEnabled(false);
    const animal = {
      id, species, info, root,
      legs: [], headPivot: null, tailPivot: null, ears: [], body: null,
      health: info.health, maxHealth: info.health,
      state: "graze", target: null, speed: 0, dead: false, harvested: false,
      hitCount: 0, cleanKill: false, lastShotDistance: 0,
      alertUntil: 0, lastTrack: 0, lastAnim: rand(0, 6), gaitTime: rand(0, 6),
      spawn: { x, z }, respawnAt: 0, name: info.label,
      attackCooldown: 0, modelReady: false, modelLoadFailed: false,
      modelAnimations: [], modelNodes: [], rig: null, currentAnimation: null
    };
    animals.push(animal);
    attachAnimalModel(animal);
    return animal;
  }

  function createDeer(id, species, x, z) {
    return createAnimalState(id, species, x, z);
  }

  function createBoar(id, x, z) {
    return createAnimalState(id, "boar", x, z);
  }

  function createWildlife() {
    createDeer("doe-01", "deer", -19, 72);
    createDeer("doe-02", "deer", 19, 91);
    createDeer("doe-03", "deer", 40, 58);
    createDeer("doe-04", "deer", -43, 25);
    createDeer("doe-05", "deer", 65, 14);
    createDeer("buck-01", "buck", -56, 91);
    createDeer("buck-02", "buck", 81, 91);
    createBoar("boar-01", -75, 45);
    createBoar("boar-02", 76, -12);
  }

  function addTrack(animal) {
    const x = animal.root.position.x + rand(-0.22, 0.22);
    const z = animal.root.position.z - 0.7;
    for (const side of [-1, 1]) {
      const mark = BABYLON.MeshBuilder.CreateDisc("hoof-track", { radius: 0.11, tessellation: 5 }, scene);
      mark.rotation.x = Math.PI / 2;
      mark.position.set(x + side * 0.17, heightAt(x, z) + 0.035, z + rand(-0.1, 0.1));
      mark.scaling.x = 0.8;
      mark.material = mat.track;
      mark.material.alpha = 0.66;
      mark.isPickable = false;
      mark.setEnabled(tracking);
      footprints.push({
        mesh: mark, createdAt: performance.now(), animalId: animal.id,
        label: animal.info.label, x: mark.position.x, z: mark.position.z
      });
    }
    if (footprints.length > 190) {
      const old = footprints.shift();
      old.mesh.dispose();
    }
  }

  function updateTracking() {
    $("tracker-status").textContent = tracking ? "ACTIVE" : "OFF";
    $("tracker-status").classList.toggle("active", tracking);
    $("tracking-banner").classList.toggle("show", tracking);
    $("tracking-panel").classList.toggle("tracking-active", tracking);
    if (!tracking) {
      $("tracker-content").innerHTML = "Press <kbd>Q</kbd> to inspect recent hoof prints.";
      return;
    }
    const now = performance.now();
    const latestByAnimal = new Map();
    for (const track of footprints) {
      const previous = latestByAnimal.get(track.animalId);
      if (!previous || track.createdAt > previous.createdAt) latestByAnimal.set(track.animalId, track);
    }
    const player = { x: camera.position.x, z: camera.position.z };
    const near = Array.from(latestByAnimal.values())
      .map((track) => ({ track, distance: distance2D(player, { x: track.x, z: track.z }), age: Math.max(0, (now - track.createdAt) / 1000) }))
      .filter((item) => item.distance < 110 && item.age < 75)
      .sort((a, b) => a.distance - b.distance).slice(0, 3);
    if (!near.length) {
      $("tracker-content").textContent = "No recent tracks. Search the open meadows or forest edge.";
      return;
    }
    $("tracker-content").innerHTML = near.map((item) => {
      const dx = item.track.x - camera.position.x, dz = item.track.z - camera.position.z;
      const dir = (Math.round(Math.atan2(dx, dz) * 180 / Math.PI) + 360) % 360;
      const freshness = item.age < 12 ? "FRESH" : item.age < 32 ? "WARM" : "OLD";
      return '<div class="tracker-line"><span><strong>' + item.track.label + '</strong><small class="track-age">' + freshness + ' SIGN · ' + Math.round(item.age) + 's</small></span><span>' + Math.round(item.distance) + 'm · ' + bearingName(dir) + '</span></div>';
    }).join("");
  }

  function bearingName(degrees) {
    if (!Number.isFinite(degrees)) return "N";
    const normalized = ((degrees % 360) + 360) % 360;
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    return directions[Math.floor((normalized + 22.5) / 45) % 8] || "N";
  }

  function createSkyDome() {
    let environment = null;
    try {
      environment = new BABYLON.HDRCubeTexture(
        "./assets/nature_reserve_forest_1k.hdr",
        scene,
        128,
        false,
        true,
        false,
        true
      );
      environment.rotationY = Math.PI * 0.18;
      scene.environmentTexture = environment;
      lights.environment = environment;
    } catch (error) {
      console.warn("Forest HDR lighting unavailable; using direct sunlight only.", error);
    }

    const size = 2048;
    const skyTexture = new BABYLON.DynamicTexture("Pinecrest dawn sky", { width: size, height: 1024 }, scene, true);
    const ctx = skyTexture.getContext();
    const gradient = ctx.createLinearGradient(0, 0, 0, 1024);
    gradient.addColorStop(0, "#40596d");
    gradient.addColorStop(0.24, "#66879a");
    gradient.addColorStop(0.43, "#9cafb4");
    gradient.addColorStop(0.56, "#c6c4b3");
    gradient.addColorStop(0.67, "#e4caa5");
    gradient.addColorStop(0.77, "#87937a");
    gradient.addColorStop(1, "#33483b");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, 1024);
    let seed = 18473;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 175; i++) {
      const x = random() * size;
      const y = 245 + random() * 390;
      const width = 65 + random() * 205;
      const height = 10 + random() * 36;
      const cloud = ctx.createRadialGradient(x, y, 2, x, y, width);
      cloud.addColorStop(0, random() > 0.52 ? "rgba(231,232,219,.28)" : "rgba(58,78,86,.20)");
      cloud.addColorStop(0.42, "rgba(209,216,211,.14)");
      cloud.addColorStop(1, "rgba(209,216,211,0)");
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((random() - 0.5) * 0.08);
      ctx.fillStyle = cloud;
      ctx.beginPath();
      ctx.ellipse(0, 0, width, height, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    for (let i = 0; i < 42; i++) {
      const x = random() * size;
      const y = 360 + random() * 220;
      const length = 80 + random() * 240;
      ctx.strokeStyle = "rgba(235,230,207,.09)";
      ctx.lineWidth = 2 + random() * 7;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + length * 0.5, y - 12, x + length, y + 4);
      ctx.stroke();
    }
    const sunrise = ctx.createRadialGradient(510, 560, 3, 510, 560, 310);
    sunrise.addColorStop(0, "rgba(255,222,170,.44)");
    sunrise.addColorStop(0.26, "rgba(250,211,164,.20)");
    sunrise.addColorStop(1, "rgba(250,211,164,0)");
    ctx.fillStyle = sunrise;
    ctx.fillRect(170, 220, 690, 650);
    skyTexture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    skyTexture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
    skyTexture.anisotropicFilteringLevel = 4;
    skyTexture.update(false);

    const sky = BABYLON.MeshBuilder.CreateSphere("Pinecrest photographic atmosphere", {
      diameter: 1200, segments: 64
    }, scene);
    sky.infiniteDistance = true;
    sky.isPickable = false;
    sky.applyFog = false;
    sky.renderingGroupId = 0;
    const skyMaterial = new BABYLON.StandardMaterial("Pinecrest sky material", scene);
    skyMaterial.backFaceCulling = false;
    skyMaterial.disableLighting = true;
    skyMaterial.fogEnabled = false;
    skyMaterial.emissiveTexture = skyTexture;
    skyMaterial.emissiveColor = new BABYLON.Color3(0.92, 0.92, 0.92);
    skyMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
    skyMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
    sky.material = skyMaterial;
    lights.sky = sky;
    lights.skyMaterial = skyMaterial;
    skySun = null;
  }

  function createDistantRidgeBand(name, innerRadius, midRadius, outerRadius, baseHeight, amplitude, phase, material) {
    const segments = 240;
    const paths = [[], [], []];
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const profile = 0.47 + 0.20 * Math.sin(angle * 3 + phase) +
        0.15 * Math.sin(angle * 7 - phase * 0.7) +
        0.10 * Math.cos(angle * 13 + phase * 1.4) +
        0.06 * Math.sin(angle * 21 - phase);
      const height = baseHeight + amplitude * clamp(profile, 0.04, 0.96);
      const x = Math.cos(angle), z = Math.sin(angle);
      paths[0].push(new BABYLON.Vector3(x * innerRadius, 1.5 + height * 0.12, z * innerRadius));
      paths[1].push(new BABYLON.Vector3(x * midRadius, baseHeight * 0.55 + height * 0.42, z * midRadius));
      paths[2].push(new BABYLON.Vector3(x * outerRadius, height, z * outerRadius));
    }
    const ridge = BABYLON.MeshBuilder.CreateRibbon(name, {
      pathArray: paths, closePath: true, sideOrientation: BABYLON.Mesh.DOUBLESIDE
    }, scene);
    ridge.material = material;
    ridge.isPickable = false;
    ridge.receiveShadows = false;
    ridge.applyFog = true;
    return ridge;
  }

  function createDistantRidgeBands() {
    createDistantRidgeBand("Pinecrest near mountain wall", 158, 195, 246, 12, 38, 0.8, mat.mountain1);
    createDistantRidgeBand("Pinecrest far mountain wall", 238, 282, 350, 28, 52, 2.6, mat.mountain2);
  }

  function setupPostProcessing() {
    try {
      if (!BABYLON.DefaultRenderingPipeline) return;
      const pipeline = new BABYLON.DefaultRenderingPipeline("Wildrange cinematic pipeline", true, scene, [camera]);
      pipeline.fxaaEnabled = true;
      pipeline.bloomEnabled = false;
      pipeline.bloomThreshold = 1.22;
      pipeline.bloomWeight = 0.045;
      pipeline.bloomKernel = 48;
      pipeline.imageProcessingEnabled = true;
      pipeline.imageProcessing.exposure = 0.94;
      pipeline.imageProcessing.contrast = 1.10;
      pipeline.imageProcessing.toneMappingEnabled = true;
      pipeline.imageProcessing.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
      lights.pipeline = pipeline;
    } catch (error) {
      console.warn("Cinematic post-processing unavailable; using standard rendering.", error);
    }
  }

  // Distant ridges are supplied by the photographic forest HDR environment.

  function createGroundCover() {
    const positions = [], indices = [], colors = [];
    let placed = 0, attempts = 0;
    while (placed < 1480 && attempts < 5200) {
      attempts++;
      const x = rand(-132, 132), z = rand(-132, 132);
      if (flatArea(x, z) || isPinecrestCompoundClearance(x, z) || Math.hypot(x, z - 31) < 24) continue;
      if (Math.hypot((x - 55) / 1.3, (z + 44) / 0.8) < 25) continue;
      const roadX = 0.003 * z * z - 0.12 * z - 1;
      if (Math.abs(x - roadX) < 5.2 && z > 25 && z < 108) continue;
      if (obstacles.some((item) => Math.hypot(x - item.x, z - item.z) < item.radius + 1.6)) continue;
      const y = heightAt(x, z) + 0.06;
      const shade = rand(0.82, 1.13);
      for (let blade = 0; blade < 4; blade++) {
        const angle = rand(0, Math.PI * 2);
        const half = rand(0.03, 0.082);
        const height = rand(0.28, 0.72);
        const lean = rand(0.025, 0.16);
        const sideX = Math.cos(angle) * half, sideZ = Math.sin(angle) * half;
        const tipX = x + Math.cos(angle + 0.9) * lean;
        const tipZ = z + Math.sin(angle + 0.9) * lean;
        const base = positions.length / 3;
        positions.push(x - sideX, y, z - sideZ, x + sideX, y, z + sideZ, tipX, y + height, tipZ);
        const green = clamp(0.42 * shade + rand(-0.035, 0.035), 0.32, 0.58);
        for (let v = 0; v < 3; v++) colors.push(0.27 * shade, green, 0.13 * shade, 1);
        indices.push(base, base + 1, base + 2);
      }
      placed++;
    }
    const grass = new BABYLON.Mesh("Pinecrest meadow grass", scene);
    const vertexData = new BABYLON.VertexData();
    const normals = [];
    BABYLON.VertexData.ComputeNormals(positions, indices, normals);
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.colors = colors;
    vertexData.applyToMesh(grass, false);
    grass.material = mat.grassBlade;
    grass.isPickable = false;
    grass.receiveShadows = false;
    grass.hasVertexAlpha = false;
    lights.grassMesh = grass;
  }

  function createBush(x, z, scale) {
    const root = new BABYLON.TransformNode("wild shrub", scene);
    root.position.set(x, heightAt(x, z), z);
    const clumps = 3 + Math.floor(rand(0, 3));
    for (let i = 0; i < clumps; i++) {
      const size = rand(0.55, 1.05) * scale;
      const leaf = BABYLON.MeshBuilder.CreateIcoSphere("shrub foliage", { radius: size, subdivisions: 1 }, scene);
      leaf.parent = root;
      leaf.position.set(rand(-0.65, 0.65) * scale, size * 0.62, rand(-0.55, 0.55) * scale);
      leaf.scaling.y = rand(0.65, 1.05);
      leaf.material = [mat.leaf1, mat.leaf2, mat.leaf3][Math.floor(rand(0, 3))];
      leaf.isPickable = false;
    }
    obstacles.push({ x, z, radius: 0.65 * scale });
  }

  function scatterUndergrowth() {
    let placed = 0, attempts = 0;
    while (placed < 34 && attempts < 280) {
      attempts++;
      const x = rand(-120, 120), z = rand(-120, 120);
      if (flatArea(x, z) || isPinecrestCompoundClearance(x, z) || Math.hypot(x, z - 31) < 24) continue;
      if (Math.hypot((x - 55) / 1.3, (z + 44) / 0.8) < 26) continue;
      const roadX = 0.003 * z * z - 0.12 * z - 1;
      if (Math.abs(x - roadX) < 5.5 && z > 25 && z < 108) continue;
      if (obstacles.some((item) => Math.hypot(x - item.x, z - item.z) < item.radius + 3)) continue;
      createBush(x, z, rand(0.85, 1.35));
      placed++;
    }
  }

  function animateWorld(now) {
    for (const item of windMeshes) {
      item.mesh.rotation.z = item.base + Math.sin(now * 0.00042 + item.phase) * 0.014;
    }
    for (const item of waterRipples) {
      const pulse = 0.94 + Math.sin(now * 0.00065 + item.phase) * 0.08;
      item.mesh.scaling.x = item.baseX * pulse;
      item.mesh.scaling.y = item.baseY * (1.03 - (pulse - 0.94));
    }
    if (skySun && camera) {
      const angle = dayTime * Math.PI * 2;
      skySun.position.set(
        camera.position.x + Math.cos(angle) * 165,
        16 + Math.max(-0.08, Math.sin(angle)) * 104,
        camera.position.z + Math.sin(angle) * 165
      );
    }
  }

  function mergeStaticScenery() {
    // Hundreds of tree parts share a handful of materials. Merge those static
    // batches so the renderer submits a few large draws instead of thousands
    // of tiny ones. Only named scenery meshes are eligible; wildlife, weapons,
    // cabin interactions, terrain, tracks and animated effects are untouched.
    const batchRules = [
      { test: (name) => name === "photographic-bark-trunk" || name === "pine branch", label: "Forest bark batch" },
      { test: (name) => name === "photographic broadleaf crown", label: "Broadleaf canopy batch" },
      { test: (name) => name === "pine needle bough cluster", label: "Pine canopy batch" },
      { test: (name) => name === "weathered fieldstone", label: "Fieldstone batch" },
      { test: (name) => name === "shrub foliage", label: "Undergrowth batch" }
    ];
    let mergedBatches = 0;
    let mergedSourceMeshes = 0;
    for (const rule of batchRules) {
      const byMaterial = new Map();
      for (const mesh of scene.meshes) {
        if (!mesh || mesh.isDisposed() || !mesh.material || !rule.test(mesh.name)) continue;
        const materialMeshes = byMaterial.get(mesh.material) || [];
        materialMeshes.push(mesh);
        byMaterial.set(mesh.material, materialMeshes);
      }
      for (const meshes of byMaterial.values()) {
        if (meshes.length < 2) continue;
        meshes.forEach((mesh) => mesh.computeWorldMatrix(true));
        try {
          const merged = BABYLON.Mesh.MergeMeshes(meshes, true, true, undefined, false, false);
          if (!merged) continue;
          merged.name = rule.label + " " + mergedBatches;
          merged.material = meshes[0].material;
          merged.isPickable = false;
          merged.receiveShadows = false;
          merged.applyFog = true;
          mergedBatches++;
          mergedSourceMeshes += meshes.length;
        } catch (error) {
          console.warn("Wildrange scenery batch skipped:", rule.label, error);
        }
      }
    }
    windMeshes.length = 0;
    mergedSceneryBatchCount = mergedBatches;
    mergedScenerySourceMeshCount = mergedSourceMeshes;
  }

  function registerCompoundShadowCasters() {
    const shadowGenerator = lights.shadows;
    if (!shadowGenerator) return 0;
    const rootNames = ["Pinecrest timber lodge", "Pinecrest firewood shelter"];
    let registered = 0;
    for (const rootName of rootNames) {
      const root = scene.getTransformNodeByName(rootName);
      if (!root) continue;
      for (const mesh of root.getChildMeshes(false)) {
        if (!mesh || mesh.isDisposed() || !mesh.isVisible || !mesh.getTotalVertices()) continue;
        // The luminous window panes and transparent display faces should not
        // cast a solid silhouette into the cabin's own shadow map.
        if (/glass|sign face|nameplate|paper/i.test(mesh.name)) continue;
        try {
          shadowGenerator.addShadowCaster(mesh, false);
          registered++;
        } catch (error) {
          // Unsupported geometry is left out of the shadow pass without blocking startup.
        }
      }
    }
    lights.compoundShadowCasterCount = registered;
    return registered;
  }

  function freezeStaticWorld() {
    const dynamicRoots = new Set(animals.map((animal) => animal.root));
    if (cabinDoorPivot) dynamicRoots.add(cabinDoorPivot);
    if (weaponRoot) dynamicRoots.add(weaponRoot);
    const dynamicMeshes = new Set(waterRipples.map((item) => item.mesh));
    let frozen = 0;
    for (const mesh of scene.meshes) {
      if (!mesh || mesh.isDisposed() || dynamicMeshes.has(mesh)) continue;
      let node = mesh;
      let dynamic = false;
      while (node) {
        if (dynamicRoots.has(node)) { dynamic = true; break; }
        node = node.parent;
      }
      if (dynamic || mesh.isWorldMatrixFrozen) continue;
      try {
        mesh.freezeWorldMatrix();
        frozen++;
      } catch (error) {
        // Unsupported meshes keep their ordinary transforms.
      }
    }
    frozenStaticMeshCount = frozen;
    return frozen;
  }

  function createScene() {
    scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.67, 0.79, 0.82, 1);
    scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    scene.fogDensity = 0.0021;
    scene.fogColor = hex("#b5c5ae");
    scene.collisionsEnabled = false;
    createMaterials();
    setupLighting();
    createSkyDome();
    makeTerrain();
    createDistantRidgeBands();
    buildTrail();
    createPinecrestLake();
    scatterEnvironment();
    createGroundCover();
    scatterUndergrowth();
    createCabin();
    const pinecrestLodgeRoot = scene.getTransformNodeByName("Pinecrest timber lodge");
    if (pinecrestLodgeRoot) loadPinecrestLodgeModel(pinecrestLodgeRoot);
    buildPinecrestCompoundAccess();
    buildPinecrestCompoundLife();
    createWildlife();
    loadPinecrestHeroVegetation();
    mergeStaticScenery();

    const spawnX = Number.isFinite(state.x) ? state.x : 0;
    const spawnZ = Number.isFinite(state.z) ? state.z : 19;
    camera = new BABYLON.UniversalCamera("field camera", new BABYLON.Vector3(spawnX, heightAt(spawnX, spawnZ) + 1.72, spawnZ), scene);
    camera.rotation.y = Number(state.yaw) || 0;
    camera.minZ = 0.08;
    camera.maxZ = 430;
    camera.fov = 1.04;
    camera.inertia = 0.035;
    camera.angularSensibility = 2400;
    camera.speed = 0;
    camera.attachControl(canvas, true);
    text("bearing-value", bearingName(camera.rotation.y * 180 / Math.PI));
    try { camera.inputs.removeByType("FreeCameraKeyboardMoveInput"); } catch (error) { /* no keyboard-driven camera translation */ }
    createWeapon();
    setupPostProcessing();
    registerCompoundShadowCasters();
    freezeStaticWorld();
    simulationClock = performance.now();
    simulationAccumulator = 0;
    animalUpdateAccumulator = 0;
    worldAnimationAt = simulationClock;
    dayCycleUpdateAt = simulationClock;
    miniMapCtx = $("mini-map").getContext("2d");
    worldMapCtx = $("world-map").getContext("2d");
    drawWorldMap();
    updateHud();
    let previousFrameAt = performance.now();
    engine.runRenderLoop(() => {
      if (!scene) return;
      const frameAt = performance.now();
      const frameMs = Math.max(0.1, frameAt - previousFrameAt);
      previousFrameAt = frameAt;
      averageFrameMs += (frameMs - averageFrameMs) * 0.08;
      smoothedFps += (1000 / frameMs - smoothedFps) * 0.06;
      if (camera) camera.rotation.x = clamp(camera.rotation.x, -0.25, 0.34);
      // Adapt render resolution gradually instead of allowing sustained GPU stalls.
      if (frameAt - renderScaleCheckAt >= 2000) {
        renderScaleCheckAt = frameAt;
        if (averageFrameMs > 22 && renderScaleLevel < renderScaleBase + 0.65) {
          renderScaleSlowFrames++;
          renderScaleFastFrames = 0;
          if (renderScaleSlowFrames >= 1) {
            renderScaleLevel = Math.min(renderScaleBase + 0.65, Math.round((renderScaleLevel + 0.1) * 100) / 100);
            engine.setHardwareScalingLevel(renderScaleLevel);
            if (lights.pipeline) lights.pipeline.fxaaEnabled = renderScaleLevel <= renderScaleBase + 0.2;
            renderScaleSlowFrames = 0;
          }
        } else if (averageFrameMs < 15.5 && renderScaleLevel > renderScaleBase) {
          renderScaleFastFrames++;
          renderScaleSlowFrames = 0;
          if (renderScaleFastFrames >= 4) {
            renderScaleLevel = Math.max(renderScaleBase, Math.round((renderScaleLevel - 0.05) * 100) / 100);
            engine.setHardwareScalingLevel(renderScaleLevel);
            if (lights.pipeline) lights.pipeline.fxaaEnabled = renderScaleLevel <= renderScaleBase + 0.2;
            renderScaleFastFrames = 0;
          }
        } else {
          renderScaleSlowFrames = 0;
          renderScaleFastFrames = 0;
        }
      }
      const elapsed = Math.min(frameMs / 1000, 0.1);
      if (gameStarted && !paused) {
        simulationAccumulator += elapsed;
        const step = 1 / 60;
        let steps = 0;
        while (simulationAccumulator >= step && steps < 6) {
          simulationClock += step * 1000;
          updateGame(step, simulationClock);
          simulationAccumulator -= step;
          steps++;
        }
        if (steps === 6) simulationAccumulator = Math.min(simulationAccumulator, step);
      } else {
        simulationAccumulator = 0;
        simulationClock = frameAt;
      }
      // Door easing belongs to the render loop so it cannot stall with gameplay simulation.
      updateCabinDoor(elapsed);
      scene.render();
    });
  }

  function updateGame(dt, suppliedNow) {
    const now = suppliedNow || performance.now();
    updatePlayer(dt, now);
    // Wildlife decision/movement logic is intentionally capped at 30 Hz; the player
    // and camera remain on the full fixed 60 Hz simulation step.
    animalUpdateAccumulator += dt;
    let animalSteps = 0;
    while (animalUpdateAccumulator >= 1 / 30 && animalSteps < 2) {
      updateAnimals(1 / 30, now);
      animalUpdateAccumulator -= 1 / 30;
      animalSteps++;
    }
    if (animalSteps === 2 && animalUpdateAccumulator >= 1 / 30) animalUpdateAccumulator = 0;
    if (now - interactionUpdateAt >= 90) {
      updateInteraction();
      interactionUpdateAt = now;
    }
    animateWeapon(dt);
    if (now - worldAnimationAt >= 1000 / 30) {
      animateWorld(now);
      worldAnimationAt = now;
    }
    if (now - dayCycleUpdateAt >= 1000 / 30) {
      const dayCycleDt = Math.min(0.1, (now - dayCycleUpdateAt) / 1000);
      updateDayCycle(dayCycleDt);
      dayCycleUpdateAt = now;
    }
    if (now - hudTimer > 180) {
      const expiredTracks = footprints.filter((track) => now - track.createdAt > 75000);
      if (expiredTracks.length) {
        const expiredSet = new Set(expiredTracks);
        expiredTracks.forEach((track) => track.mesh.dispose());
        footprints = footprints.filter((track) => !expiredSet.has(track));
      }
      updateHud();
      if (tracking) updateTracking();
      drawMiniMap();
      hudTimer = now;
    }
    if (now - autosaveTimer > 12000) {
      saveGame(false);
      autosaveTimer = now;
    }
    if (now - mapTimer > 1000) {
      text("time-label", formatClock(dayTime));
      text("bearing-value", bearingName((camera.rotation.y * 180 / Math.PI + 360) % 360));
      mapTimer = now;
    }
  }

  function updatePlayer(dt, now) {
    const forwardInput = (keys.has("w") || keys.has("arrowup") || touchKeys.has("up") ? 1 : 0) -
      (keys.has("s") || keys.has("arrowdown") || touchKeys.has("down") ? 1 : 0);
    const rightInput = (keys.has("d") || keys.has("arrowright") || touchKeys.has("right") ? 1 : 0) -
      (keys.has("a") || keys.has("arrowleft") || touchKeys.has("left") ? 1 : 0);
    const moving = forwardInput !== 0 || rightInput !== 0;
    const sprinting = !crouched && (keys.has("shift") || touchKeys.has("sprint")) && state.stamina > 1 && moving;
    playerMoving = moving;
    playerSprinting = sprinting;

    const speed = crouched ? 2.8 : sprinting ? 10.5 : 6.2;
    camera.getDirectionToRef(BABYLON.Axis.Z, playerForward);
    playerForward.y = 0;
    playerForward.normalize();
    BABYLON.Vector3.CrossToRef(BABYLON.Axis.Y, playerForward, playerRight);
    playerRight.normalize();
    playerMoveDirection.copyFrom(playerForward).scaleInPlace(forwardInput);
    playerMoveDirection.x += playerRight.x * rightInput;
    playerMoveDirection.y += playerRight.y * rightInput;
    playerMoveDirection.z += playerRight.z * rightInput;
    if (playerMoveDirection.lengthSquared() > 1) playerMoveDirection.normalize();

    const desiredX = playerMoveDirection.x * speed;
    const desiredZ = playerMoveDirection.z * speed;
    const acceleration = playerGrounded ? (moving ? 20 : 27) : 8;
    const blend = Math.min(1, acceleration * dt);
    playerVelocity.x += (desiredX - playerVelocity.x) * blend;
    playerVelocity.z += (desiredZ - playerVelocity.z) * blend;

    if (moving) {
      if (sprinting) state.stamina = Math.max(0, state.stamina - 27 * dt);
      else state.stamina = Math.min(100, state.stamina + 16 * dt);
    } else state.stamina = Math.min(100, state.stamina + 22 * dt);

    const nextX = clamp(camera.position.x + playerVelocity.x * dt, -WORLD_LIMIT, WORLD_LIMIT);
    const nextZ = clamp(camera.position.z + playerVelocity.z * dt, -WORLD_LIMIT, WORLD_LIMIT);
    if (canStandAt(nextX, camera.position.z)) camera.position.x = nextX;
    else playerVelocity.x = 0;
    if (canStandAt(camera.position.x, nextZ)) camera.position.z = nextZ;
    else playerVelocity.z = 0;

    const groundSurfaceY = walkSurfaceAt(camera.position.x, camera.position.z);
    const groundY = groundSurfaceY + (crouched ? 1.12 : 1.72);
    if (playerGrounded) {
      lastGroundedAt = now;
      verticalVelocity = 0;
      camera.position.y += (groundY - camera.position.y) * Math.min(1, dt * 18);
      if (Math.abs(camera.position.y - groundY) < 0.012) camera.position.y = groundY;
    } else {
      verticalVelocity -= 19.6 * dt;
      camera.position.y += verticalVelocity * dt;
      jumpMaxHeight = Math.max(jumpMaxHeight, camera.position.y - groundY);
      if (camera.position.y <= groundY) {
        camera.position.y = groundY;
        verticalVelocity = 0;
        playerGrounded = true;
        sound(95, 0.045, "triangle", 0.008);
      }
    }

    if (weaponRoot) {
      const rate = sprinting ? 0.016 : 0.011;
      const bob = playerGrounded && moving ? Math.abs(Math.sin(now * rate)) * (sprinting ? 0.022 : 0.012) : 0;
      const jumpOffset = playerGrounded ? 0 : clamp((camera.position.y - groundY) * 0.025, 0, 0.075);
      weaponRoot.position.y = -0.43 - bob + jumpOffset;
    }
  }

  function jump() {
    if (!gameStarted || paused || aiming) return;
    const now = simulationClock || performance.now();
    if (!playerGrounded && now - lastGroundedAt > 120) return;
    verticalVelocity = 7.4;
    playerGrounded = false;
    lastGroundedAt = 0;
    jumpCount++;
    jumpMaxHeight = 0;
    sound(150, 0.055, "triangle", 0.012);
  }

  function walkSurfaceAt(x, z) {
    const localX = x + 14;
    const localZ = z - 43;
    if (Math.abs(localX) <= 5.2 && localZ > -4.0 && localZ < 4.5) return 1.02;
    if (Math.abs(localX) <= 4.1 && localZ >= -15.0 && localZ <= -9.2) return 0.26;
    if (Math.abs(localX) <= 3.65 && localZ >= -6.65 && localZ <= -4.0) return 1.335;
    if (Math.abs(localX) <= 1.95 && localZ >= -9.22 && localZ < -6.65) {
      if (localZ < -8.5) return 0.4;
      if (localZ < -7.8) return 0.7;
      if (localZ < -7.1) return 1.0;
      return 1.3;
    }
    return heightAt(x, z);
  }

  function canStandAt(x, z) {
    if (Math.hypot((x - 55) / 1.3, (z + 44) / 0.8) < 20.5) return false;
    for (const item of obstacles) {
      if (Math.hypot(x - item.x, z - item.z) < item.radius + 0.48) return false;
    }
    const localX = x + 14;
    const localZ = z - 43;
    // Compound rails are solid boundaries, with a deliberately open front gate.
    const onSideFence = Math.abs(Math.abs(localX) - 13) < 0.48 && localZ >= -12.25 && localZ <= 9.25;
    const onNorthFence = Math.abs(localZ - 12) < 0.48 && Math.abs(localX) <= 13.2;
    // Only collide with the two visible south fence rails. The old test had no
    // X bounds, creating an invisible wall that stretched across the whole map.
    const onSouthFence = Math.abs(localZ + 14) < 0.48 &&
      ((localX >= -13.25 && localX <= -6.25) || (localX >= 6.25 && localX <= 13.25));
    if (onSideFence || onNorthFence || onSouthFence) return false;
    const insideRoom = Math.abs(localX) < 5.2 && localZ > -4.0 && localZ < 4.5;
    const onDeck = Math.abs(localX) <= 3.65 && localZ >= -6.65 && localZ <= -4.0;
    const onStairs = Math.abs(localX) <= 1.7 && localZ >= -9.22 && localZ < -6.65;
    const onEntryPaver = Math.abs(localX) <= 2.15 && localZ >= -14.0 && localZ < -9.22;
    const inDoorway = Math.abs(localX) < 1.18 && localZ > -5.0 && localZ < -3.0;
    if (inDoorway && !cabinDoorOpen) return false;
    if (insideRoom || onDeck || onStairs || onEntryPaver) return true;
    const inCabinFootprint = Math.abs(localX) < 6.5 && Math.abs(localZ) < 5.1;
    if (inCabinFootprint) return false;
    return true;
  }

  function pickWanderTarget(animal) {
    const spread = animal.species === "boar" ? 26 : 36;
    animal.target = {
      x: clamp(animal.spawn.x + rand(-spread, spread), -WORLD_LIMIT + 6, WORLD_LIMIT - 6),
      z: clamp(animal.spawn.z + rand(-spread, spread), -WORLD_LIMIT + 6, WORLD_LIMIT - 6)
    };
  }

  function updateAnimals(dt, now) {
    const player = { x: camera.position.x, z: camera.position.z };
    for (const animal of animals) {
      if (animal.harvested) {
        if (now >= animal.respawnAt) respawnAnimal(animal);
        continue;
      }
      if (!animal.modelReady) continue;

      // Cull distant wildlife at the root so Babylon skips every mesh in its rig.
      // Keep threatened animals visible a little farther away for readable reactions.
      const dx = player.x - animal.root.position.x;
      const dz = player.z - animal.root.position.z;
      const playerDistance = Math.hypot(dx, dz);
      const threatened = animal.state === "flee" || animal.state === "charge";
      const visibleRange = threatened ? 175 : 145;
      const shouldRenderAnimal = playerDistance < visibleRange;
      if (animal.root.isEnabled() !== shouldRenderAnimal) animal.root.setEnabled(shouldRenderAnimal);
      if (animal.dead) continue;
      const updateInterval = playerDistance < 35 ? 1 / 30
        : playerDistance < 85 || (threatened && playerDistance < 115) ? 1 / 10 : 1 / 3;
      if (now < (animal.nextUpdateAt || 0)) continue;
      const previousAnimalUpdate = Number.isFinite(animal.lastSimAt) ? animal.lastSimAt : now - dt * 1000;
      const animalDt = Math.min(0.5, Math.max(dt, (now - previousAnimalUpdate) / 1000));
      animal.lastSimAt = now;
      animal.nextUpdateAt = now + updateInterval * 1000;
      const baseSense = animal.species === "boar" ? 18 : animal.species === "buck" ? 25 : 22;
      const movementNoise = crouched ? 0.34 : playerSprinting ? 1.55 : playerMoving ? 1.08 : 0.72;
      const scentFactor = now < scentActiveUntil ? 0.62 : 1;
      const detectionRadius = baseSense * movementNoise * scentFactor;
      const heardShot = shotAt > 0 && Date.now() - shotAt < 9000 && playerDistance < 72;

      if (animal.species === "boar") {
        if (heardShot || (playerDistance < 15 && (!crouched || playerDistance < 8))) {
          if (animal.state !== "charge") {
            animal.state = "charge";
            animal.target = null;
            animal.chargeRetargetAt = 0;
          }
        } else if (playerDistance < detectionRadius && animal.state !== "alert" && animal.state !== "charge") {
          animal.state = "alert";
          animal.alertUntil = now + rand(900, 1600);
          animal.target = null;
          animal.speed = 0;
        }
      } else if (heardShot) {
        if (animal.state !== "flee") {
          animal.state = "flee";
          animal.target = null;
          animal.fleeRetargetAt = 0;
          animal.alertUntil = now + 9000;
        }
      } else if (playerDistance < detectionRadius) {
        const startled = playerSprinting || playerMoving || playerDistance < detectionRadius * 0.56;
        if (startled && animal.state !== "flee") {
          animal.state = "flee";
          animal.target = null;
          animal.fleeRetargetAt = 0;
          animal.alertUntil = now + 8500;
        } else if (animal.state !== "flee" && animal.state !== "alert") {
          animal.state = "alert";
          animal.alertUntil = now + rand(1300, 2400);
          animal.target = null;
          animal.speed = 0;
        }
      }

      if (animal.species === "boar" && playerDistance < 7.5 && now > (animal.attackCooldown || 0)) {
        animal.attackCooldown = now + 2300;
        state.health = Math.max(0, state.health - 8);
        $("damage-flash").classList.remove("show");
        void $("damage-flash").offsetWidth;
        $("damage-flash").classList.add("show");
        sound(100, 0.16, "sawtooth", 0.035);
        toast("A wild boar charged you. Create some distance.", "warning");
        if (state.health <= 0) {
          state.health = 100;
          camera.position.x = 0;
          camera.position.z = 19;
          camera.position.y = heightAt(0, 19) + 1.72;
          playerVelocity.set(0, 0, 0);
          verticalVelocity = 0;
          playerGrounded = true;
          state.cash = Math.max(0, state.cash - 15);
          announce("You were knocked out and escorted back to Pinecrest Outpost. $15 lost.", 4200);
        }
      }

      const current = { x: animal.root.position.x, z: animal.root.position.z };
      if (animal.state === "alert") {
        const towardPlayer = Math.atan2(dx, dz);
        const turn = Math.atan2(Math.sin(towardPlayer - animal.root.rotation.y), Math.cos(towardPlayer - animal.root.rotation.y));
        animal.root.rotation.y += turn * Math.min(1, animalDt * 2.4);
        if (animal.species === "boar") {
          if (playerDistance < 10 || (now > animal.alertUntil && playerDistance < 18)) {
            animal.state = "charge";
            animal.target = null;
            animal.chargeRetargetAt = 0;
          } else if (now > animal.alertUntil) {
            animal.state = "graze";
            animal.pauseUntil = now + rand(1800, 3500);
          }
        } else if (now > animal.alertUntil) {
          if (playerDistance < detectionRadius * 1.15) {
            animal.state = "flee";
            animal.target = null;
            animal.fleeRetargetAt = 0;
            animal.alertUntil = now + 8500;
          } else {
            animal.state = "graze";
            animal.pauseUntil = now + rand(1200, 3200);
          }
        }
      }

      if (animal.state === "charge") {
        if (playerDistance > 56) {
          animal.state = "walk";
          animal.target = null;
          animal.speed = 0;
          animal.pauseUntil = now + rand(900, 1700);
        } else {
          if (now >= (animal.chargeRetargetAt || 0)) {
            animal.target = {
              x: clamp(player.x + rand(-1.8, 1.8), -WORLD_LIMIT + 5, WORLD_LIMIT - 5),
              z: clamp(player.z + rand(-1.8, 1.8), -WORLD_LIMIT + 5, WORLD_LIMIT - 5)
            };
            animal.chargeRetargetAt = now + 430;
          }
          if (animal.target) moveAnimal(animal, animalDt, 7.6);
        }
      } else if (animal.state === "flee") {
        if (playerDistance > 92 && now > animal.alertUntil) {
          animal.state = "walk";
          animal.target = null;
          animal.speed = 0;
          animal.pauseUntil = now + rand(1000, 2100);
        } else {
          if (now >= (animal.fleeRetargetAt || 0)) {
            const awayX = -dx / Math.max(0.001, playerDistance);
            const awayZ = -dz / Math.max(0.001, playerDistance);
            const angle = rand(-0.38, 0.38);
            const fleeX = awayX * Math.cos(angle) - awayZ * Math.sin(angle);
            const fleeZ = awayX * Math.sin(angle) + awayZ * Math.cos(angle);
            const runDistance = rand(28, 42);
            animal.target = {
              x: clamp(current.x + fleeX * runDistance, -WORLD_LIMIT + 5, WORLD_LIMIT - 5),
              z: clamp(current.z + fleeZ * runDistance, -WORLD_LIMIT + 5, WORLD_LIMIT - 5)
            };
            animal.fleeRetargetAt = now + rand(850, 1250);
          }
          if (animal.target) moveAnimal(animal, animalDt, animal.species === "boar" ? 8.8 : 10.8);
        }
      } else if (animal.target) {
        const distanceToTarget = Math.hypot(animal.target.x - current.x, animal.target.z - current.z);
        if (distanceToTarget < 1.6) {
          animal.target = null;
          animal.state = "graze";
          animal.speed = 0;
          animal.pauseUntil = now + rand(2200, 5600);
        } else if (now > (animal.pauseUntil || 0)) {
          moveAnimal(animal, animalDt, animal.species === "boar" ? 1.65 : 2.05);
        }
      } else if (now > (animal.pauseUntil || 0) && animal.state !== "alert") {
        pickWanderTarget(animal);
        animal.state = "walk";
      }

      const gaitRate = animal.state === "flee" ? 10.5 : animal.state === "charge" ? 9.2 : animal.state === "walk" ? 5.8 : 1.1;
      animal.gaitTime = (animal.gaitTime || animal.lastAnim || 0) + animalDt * gaitRate;
      const moving = animal.state === "walk" || animal.state === "flee" || animal.state === "charge";
      const stride = animal.state === "flee" ? 0.78 : animal.state === "charge" ? 0.72 : animal.species === "boar" ? 0.2 : 0.29;
      for (const leg of animal.legs) {
        const swing = Math.sin(animal.gaitTime + leg.phase);
        const recovery = Math.max(0, Math.sin(animal.gaitTime + leg.phase + 0.8));
        leg.upper.rotation.x = moving ? swing * stride : Math.sin(animal.gaitTime * 0.45 + leg.phase) * 0.015;
        leg.lower.rotation.x = moving ? recovery * (animal.state === "flee" ? 0.82 : animal.state === "charge" ? 0.68 : 0.3) : 0.012;
      }
      if (animal.headPivot) {
        const targetPitch = animal.state === "graze"
          ? (animal.species === "boar" ? 0.24 : 0.39) + Math.sin(animal.gaitTime * 0.38) * 0.055
          : animal.state === "alert" ? -0.14
            : animal.state === "charge" ? -0.22
              : moving ? -0.045 : Math.sin(animal.gaitTime * 0.3) * 0.05;
        animal.headPivot.rotation.x += (targetPitch - animal.headPivot.rotation.x) * Math.min(1, animalDt * 4.2);
        animal.headPivot.rotation.y = Math.sin(animal.gaitTime * 0.34) * (animal.state === "alert" ? 0.13 : 0.055);
      }
      if (animal.ears) {
        for (let index = 0; index < animal.ears.length; index++) {
          const ear = animal.ears[index];
          const baseZ = Number.isFinite(ear.metadata?.baseRotationZ) ? ear.metadata.baseRotationZ : 0;
          const flick = Math.sin(animal.gaitTime * (animal.state === "alert" ? 2.4 : 0.72) + index * 2.1) * (animal.state === "alert" ? 0.18 : 0.045);
          ear.rotation.z = baseZ + flick;
        }
      }
      if (animal.tailPivot) {
        const tailMotion = animal.species === "boar" ? 0.16 : 0.25;
        const tailRate = animal.state === "flee" || animal.state === "charge" ? 8 : 1.7;
        animal.tailPivot.rotation.x = Math.sin(animal.gaitTime * tailRate * 0.18 + animal.lastAnim) * tailMotion;
        animal.tailPivot.rotation.z = Math.sin(animal.gaitTime * 0.32 + animal.lastAnim) * 0.12;
      }
      if (animal.body && animal.baseBodyScaleY) {
        animal.body.scaling.y = animal.baseBodyScaleY * (1 + Math.sin(animal.gaitTime * 0.55) * 0.008);
      }
      const ground = heightAt(animal.root.position.x, animal.root.position.z);
      animal.root.position.y = ground + (moving
        ? Math.abs(Math.sin(animal.gaitTime * 2)) * (animal.state === "flee" ? 0.055 : 0.022)
        : animal.state === "graze" ? Math.sin(animal.gaitTime * 0.55) * 0.022 : 0);

      if (moving && now - animal.lastTrack > 5200 && playerDistance < 96) {
        animal.lastTrack = now;
        addTrack(animal);
      }
      const desiredClip = animal.state === "graze" || animal.state === "alert"
        ? "Idle" : animal.state === "walk" ? "Walk" : "Run";
      setAnimalAnimation(animal, desiredClip);
    }
  }

  function moveAnimal(animal, dt, speed) {
    if (!animal.target) return;
    const dx = animal.target.x - animal.root.position.x;
    const dz = animal.target.z - animal.root.position.z;
    const length = Math.max(0.001, Math.hypot(dx, dz));
    const desiredYaw = Math.atan2(dx, dz);
    const yawDelta = Math.atan2(Math.sin(desiredYaw - animal.root.rotation.y), Math.cos(desiredYaw - animal.root.rotation.y));
    animal.root.rotation.y += yawDelta * Math.min(1, dt * (animal.state === "flee" || animal.state === "charge" ? 5.5 : 2.8));
    const acceleration = animal.state === "flee" || animal.state === "charge" ? 7.5 : 3.2;
    animal.speed += (speed - animal.speed) * Math.min(1, dt * acceleration);
    animal.root.position.x += dx / length * animal.speed * dt;
    animal.root.position.z += dz / length * animal.speed * dt;
  }

  function respawnAnimal(animal) {
    animal.harvested = false;
    animal.dead = false;
    animal.health = animal.maxHealth;
    animal.root.position.set(animal.spawn.x, heightAt(animal.spawn.x, animal.spawn.z), animal.spawn.z);
    animal.root.rotation.set(0, rand(0, Math.PI * 2), 0);
    animal.root.setEnabled(Boolean(animal.modelReady));
    animal.target = null;
    animal.state = "graze";
    animal.hitCount = 0;
    animal.cleanKill = false;
    animal.lastShotDistance = 0;
    animal.speed = 0;
    animal.gaitTime = rand(0, 6);
    animal.legs.forEach((leg) => { leg.upper.rotation.set(0, 0, 0); leg.lower.rotation.set(0, 0, 0); });
    if (animal.headPivot) animal.headPivot.rotation.set(0, 0, 0);
    if (animal.tailPivot) animal.tailPivot.rotation.set(0, 0, 0);
    animal.pauseUntil = performance.now() + rand(1000, 3000);
    animal.currentAnimation = null;
    setAnimalAnimation(animal, "Idle");
  }

  function playWeaponAnimation(clipFragment, onEnd) {
    const key = String(clipFragment || "").toLowerCase();
    const group = weaponAnimationGroups.find((candidate) =>
      String(candidate.name).toLowerCase().includes(key)
    );
    if (!group) {
      if (typeof onEnd === "function") onEnd();
      return false;
    }
    weaponAnimationGroups.forEach((candidate) => {
      if (candidate !== group) candidate.stop();
    });
    group.stop();
    weaponActiveAnimation = group;
    if (group.onAnimationGroupEndObservable) {
      group.onAnimationGroupEndObservable.addOnce(() => {
        if (weaponActiveAnimation === group) weaponActiveAnimation = null;
        if (typeof onEnd === "function") onEnd();
      });
    }
    group.start(false, 1);
    return true;
  }

  function playWeaponAnimation(clipFragment, onEnd) {
    const key = String(clipFragment || "").toLowerCase();
    const group = weaponAnimationGroups.find((candidate) =>
      String(candidate.name).toLowerCase().includes(key)
    );
    if (!group) return false;
    weaponAnimationGroups.forEach((candidate) => {
      if (candidate !== group) candidate.stop();
    });
    group.stop();
    weaponActiveAnimation = group;
    if (group.onAnimationGroupEndObservable) {
      group.onAnimationGroupEndObservable.addOnce(() => {
        if (weaponActiveAnimation === group) weaponActiveAnimation = null;
        if (typeof onEnd === "function") onEnd();
      });
    }
    group.start(false, 1);
    return true;
  }

  function cycleRifleBolt() {
    if (weaponFallbackUsed) {
      if (weaponBoltNode && weaponBoltBase) weaponBoltCycleElapsed = 0;
    } else {
      playWeaponAnimation("bolt-open", () => playWeaponAnimation("bolt-close"));
    }
    sound(290, 0.055, "metal", 0.015);
  }

  function animateWeapon(dt) {
    if (!weaponRoot) return;
    weaponKick = Math.max(0, weaponKick - dt * 2.9);
    const targetZ = aiming ? 0.69 : 0.76;
    const targetX = 0.34;
    const reloadProgress = reloading
      ? clamp((performance.now() - reloadStarted) / reloadDuration, 0, 1) : 0;
    const reloadLift = reloading ? Math.sin(reloadProgress * Math.PI) : 0;
    const targetY = weaponBaseY - reloadLift * 0.026;
    weaponRoot.position.z += (targetZ - weaponRoot.position.z) * Math.min(1, dt * 12);
    weaponRoot.position.x += (targetX - weaponRoot.position.x) * Math.min(1, dt * 12);
    weaponRoot.position.y += (targetY - weaponRoot.position.y) * Math.min(1, dt * 12);
    weaponRoot.rotation.x += ((aiming ? -0.012 : 0) - weaponRoot.rotation.x) * Math.min(1, dt * 10);
    weaponRoot.rotation.z += ((reloading ? -reloadLift * 0.075 : 0) - weaponRoot.rotation.z) * Math.min(1, dt * 10);
    weaponRoot.position.z -= weaponKick * 0.14;

    if (weaponFallbackUsed && weaponBoltNode && weaponBoltBase && weaponBoltCycleElapsed >= 0) {
      weaponBoltCycleElapsed += dt;
      const phase = clamp(weaponBoltCycleElapsed / 0.42, 0, 1);
      const draw = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
      weaponBoltNode.position.z = weaponBoltBase.position.z - draw * 0.055;
      weaponBoltNode.rotation.y = weaponBoltBase.rotation.y + draw * 0.28;
      if (phase >= 1) {
        weaponBoltNode.position.copyFrom(weaponBoltBase.position);
        weaponBoltNode.rotation.copyFrom(weaponBoltBase.rotation);
        weaponBoltCycleElapsed = -1;
      }
    }

    if (muzzleTimer > 0) {
      muzzleTimer -= dt;
      if (weaponMaterials.flash) weaponMaterials.flash.setEnabled(muzzleTimer > 0 && !aiming);
    }
  }


  function updateContractBoard() {
    if (!contractBoardTexture || !contractBoardBackTexture) return;
    for (const texture of [contractBoardTexture, contractBoardBackTexture]) {
      const ctx = texture.getContext();
      const size = texture.getSize();
      const scaleX = size.width / 768;
      const scaleY = size.height / 576;
      ctx.clearRect(0, 0, size.width, size.height);
      ctx.save();
      ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
      ctx.fillStyle = "#e7d4a8"; ctx.fillRect(0, 0, 768, 576);
      ctx.fillStyle = "#382d1e"; ctx.fillRect(18, 18, 732, 540);
      ctx.fillStyle = "#f0e2bd"; ctx.fillRect(32, 32, 704, 512);
      ctx.strokeStyle = "#8b6d40"; ctx.lineWidth = 5; ctx.strokeRect(44, 44, 680, 488);
      ctx.fillStyle = "#352a1c"; ctx.textAlign = "center";
      ctx.font = "bold 40px Georgia"; ctx.fillText("PINECREST OUTPOST", 384, 104);
      ctx.font = "bold 29px Georgia"; ctx.fillText("HUNTERS' NOTICE BOARD", 384, 148);
      ctx.strokeStyle = "#a68a59"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(84, 174); ctx.lineTo(684, 174); ctx.stroke();
      ctx.textAlign = "left"; ctx.font = "bold 38px Georgia"; ctx.fillText("FIRST HARVEST", 92, 246);
      ctx.font = "27px Georgia"; ctx.fillText("Whitetail deer - 3 required", 92, 296);
      ctx.fillText("Return to the harvest station", 92, 340);
      ctx.fillText("to collect your field payment.", 92, 382);
      const status = state.contractComplete ? "CONTRACT COMPLETE" :
        state.contractAccepted ? "IN PROGRESS  " + state.contractProgress + " / 3" : "AVAILABLE - ACCEPT AT BOARD";
      ctx.font = "bold 30px Georgia"; ctx.fillText(status, 92, 450);
      ctx.font = "bold 28px Georgia"; ctx.fillText("REWARD  $250  +  180 XP", 92, 500);
      ctx.restore();
      texture.update(true);
    }
  }

  function setCabinDoor(open) {
    cabinDoorOpen = Boolean(open);
    // Apply the hinge transform immediately; the scene render loop refreshes its world matrix.
    if (cabinDoorPivot) {
      cabinDoorPivot.rotationQuaternion = null;
      cabinDoorPivot.rotation.y = cabinDoorOpen ? 1.48 : 0;
      cabinDoorPivot.computeWorldMatrix(true);
      cabinDoorPivot.getChildMeshes().forEach((mesh) => mesh.computeWorldMatrix(true));
    }
    sound(cabinDoorOpen ? 180 : 145, 0.18, "triangle", 0.025);
    announce(cabinDoorOpen ? "Pinecrest lodge door opened." : "Pinecrest lodge door closed.", 1500);
    updateInteraction();
  }

  function updateCabinDoor(dt) {
    if (!cabinDoorPivot) return;
    cabinDoorUpdateCount++;
    const target = cabinDoorOpen ? 1.48 : 0;
    const difference = target - cabinDoorPivot.rotation.y;
    const maxStep = Math.max(0, dt) * 3.2;
    cabinDoorPivot.rotation.y += Math.max(-maxStep, Math.min(maxStep, difference));
    if (Math.abs(target - cabinDoorPivot.rotation.y) < 0.001) cabinDoorPivot.rotation.y = target;
    cabinDoorPivot.computeWorldMatrix(true);
  }

  function updateInteraction() {
    const px = camera.position.x, pz = camera.position.z;
    let found = null, closest = 7.0;
    for (const animal of animals) {
      if (!animal.dead || animal.harvested) continue;
      const d = Math.hypot(px - animal.root.position.x, pz - animal.root.position.z);
      if (d < closest) {
        closest = d;
        found = { kind: "harvest", target: animal, name: animal.info.label, distance: d };
      }
    }
    if (!found) {
      for (const item of interactables) {
        const d = Math.hypot(px - item.x, pz - item.z);
        if (d < closest) {
          closest = d;
          found = { kind: item.action, target: item, name: item.name, distance: d };
        }
      }
    }
    nearestInteraction = found;
    if (found) {
      $("interaction-prompt").classList.add("visible");
      let label = "INTERACT";
      if (found.kind === "harvest") label = "HARVEST " + found.name.toUpperCase();
      if (found.kind === "shop") label = "OPEN OUTFITTERS";
      if (found.kind === "contract") label = state.contractAccepted ? "CHECK CONTRACT" : "ACCEPT HUNTING CONTRACT";
      if (found.kind === "sell") label = "SELL HARVEST";
      if (found.kind === "cabin") label = cabinDoorOpen ? "CLOSE LODGE DOOR" : "OPEN LODGE DOOR";
      text("interaction-text", label);
    } else $("interaction-prompt").classList.remove("visible");
  }

  function interact() {
    if (paused) return;
    if (!nearestInteraction) {
      toast("Nothing close enough to interact with.", "warning");
      return;
    }
    sound(520, 0.07, "sine", 0.02);
    if (nearestInteraction.kind === "harvest") {
      harvestAnimal(nearestInteraction.target);
    } else if (nearestInteraction.kind === "shop") {
      text("shop-cash", "$" + state.cash);
      $("supplies-screen").classList.add("open");
      paused = true;
      document.exitPointerLock?.();
    } else if (nearestInteraction.kind === "contract") {
      if (!state.contractAccepted) {
        state.contractAccepted = true;
        announce("Contract accepted: harvest three deer and return to the valley.", 3500);
        toast("New contract added to your field journal.", "success");
        saveGame(false);
      } else if (state.contractComplete) {
        announce("First Harvest complete. The valley has more to offer.", 3000);
      } else {
        announce("First Harvest: harvest " + state.contractProgress + " of 3 deer.", 2600);
      }
    } else if (nearestInteraction.kind === "sell") {
      sellHarvest();
    } else if (nearestInteraction.kind === "cabin") {
      setCabinDoor(!cabinDoorOpen);
    }
  }

  function harvestAnimal(animal) {
    if (!animal || !animal.dead || animal.harvested) return;
    animal.harvested = true;
    animal.respawnAt = performance.now() + 65000;
    animal.root.setEnabled(false);
    state.hides += animal.info.hide;
    state.meat += animal.info.meat;
    state.harvested += 1;
    state.xp += animal.info.xp;
    if (animal.species !== "boar") state.deerHarvested += 1;
    if (state.contractAccepted && !state.contractComplete && animal.species !== "boar") state.contractProgress = Math.min(3, state.contractProgress + 1);
    const cleanBonus = Boolean(animal.cleanKill);
    if (cleanBonus) {
      state.cleanKills = (state.cleanKills || 0) + 1;
      state.cash += 40;
      state.xp += 30;
    }
    levelCheck();
    const rows = [
      ["Hides collected", "+" + animal.info.hide],
      ["Meat collected", "+" + animal.info.meat],
      ["Shot placement", cleanBonus ? "CLEAN · FIRST-SHOT HEADSHOT" : (animal.hitCount > 1 ? "FOLLOW-UP SHOT" : "BODY SHOT")],
      ["Shot distance", Math.round(animal.lastShotDistance || 0) + "m"],
      ["Experience earned", "+" + animal.info.xp + " XP"]
    ];
    if (cleanBonus) rows.push(["Clean harvest bonus", "+$40 · +30 XP"]);
    $("harvest-rows").innerHTML = rows.map((row) => '<div class="harvest-row"><span>' + row[0] + '</span><strong>' + row[1] + '</strong></div>').join("");
    if (state.contractAccepted && state.contractProgress >= 3 && !state.contractComplete) {
      state.contractComplete = true;
      state.cash += 250;
      state.xp += 180;
      levelCheck();
      $("harvest-rows").innerHTML += '<div class="harvest-row"><span>First Harvest contract bonus</span><strong>+$250 · +180 XP</strong></div>';
      toast("Contract complete! $250 bonus added.", "success");
    }
    $("harvest-screen").classList.add("open");
    paused = true;
    document.exitPointerLock?.();
    updateHud();
    saveGame(false);
  }

  function sellHarvest() {
    if (state.hides + state.meat < 1) {
      toast("You have no harvest to sell yet. Bring back hides or meat.", "warning");
      return;
    }
    const total = state.hides * 42 + state.meat * 18;
    const hides = state.hides, meat = state.meat;
    state.cash += total;
    state.hides = 0;
    state.meat = 0;
    updateHud();
    saveGame(false);
    announce("Sold " + hides + " hides and " + meat + " meat for $" + total + ".", 3000);
  }

  function levelCheck() {
    while (state.xp >= xpRequired()) {
      state.xp -= xpRequired();
      state.level += 1;
      state.health = 100;
      state.stamina = 100;
      toast("Hunter rank increased. You reached level " + state.level + ".", "success");
      sound(780, 0.22, "sine", 0.06);
    }
  }

  function xpRequired() { return 150 + (state.level - 1) * 110; }

  function shoot() {
    if (!gameStarted || paused || reloading) return;
    const now = performance.now();
    if (now - lastShot < 470) return;
    if (state.ammo <= 0) {
      toast("Magazine empty. Press R to reload.", "warning");
      sound(120, 0.07, "square", 0.02);
      return;
    }
    lastShot = now;
    shotAt = Date.now();
    state.ammo -= 1;
    weaponKick = 1;
    cycleRifleBolt();
    muzzleTimer = 0.065;
    if (weaponMaterials.flash) weaponMaterials.flash.setEnabled(true);
    sound(aiming ? 82 : 74, 0.22, "sawtooth", 0.075);
    $("crosshair").classList.add("fired");
    window.setTimeout(() => $("crosshair").classList.remove("fired"), 80);

    const direction = camera.getDirection(BABYLON.Axis.Z).normalize();
    const ray = new BABYLON.Ray(camera.position, direction, 165);
    const pick = scene.pickWithRay(ray, (mesh) => mesh.metadata && mesh.metadata.animalId && !mesh.metadata.deadAnimal);
    if (pick && pick.hit && pick.pickedMesh) {
      const animal = animals.find((item) => item.id === pick.pickedMesh.metadata.animalId);
      if (animal && !animal.dead && !animal.harvested) {
        animal.hitCount = (animal.hitCount || 0) + 1;
        animal.lastShotDistance = distance2D({ x: camera.position.x, z: camera.position.z }, { x: animal.root.position.x, z: animal.root.position.z });
        const damage = aiming ? 120 : 92;
        animal.health = Math.max(0, animal.health - damage);
        animal.state = animal.species === "boar" ? "charge" : "flee";
        animal.target = null;
        animal.fleeRetargetAt = 0;
        animal.chargeRetargetAt = 0;
        animal.alertUntil = performance.now() + 10000;
        const hitPart = pick.pickedMesh.metadata.animalPart;
        const headshot = hitPart === "head";
        if (headshot) {
          animal.health = 0;
          animal.cleanKill = animal.hitCount === 1;
        }
        showHitMarker();
        if (animal.health <= 0) {
          animal.dead = true;
          animal.target = null;
          setAnimalAnimation(animal, "Idle");
          animal.root.rotation.z = Math.PI / 2;
          animal.root.position.y = heightAt(animal.root.position.x, animal.root.position.z) + 0.15;
          animal.root.getChildMeshes().forEach((mesh) => { mesh.metadata = { ...(mesh.metadata || {}), deadAnimal: true }; });
          toast(headshot ? "Clean headshot. Animal down." : "Animal down. Move closer to harvest.", "success");
          announce(animal.info.label + " down · Approach and press E to harvest.", 2600);
        } else {
          toast("Hit confirmed. The animal is wounded and moving.", "warning");
        }
      }
    } else {
      // A missed shot still disturbs wildlife and changes the hunt.
      for (const animal of animals) {
        const d = distance2D({ x: camera.position.x, z: camera.position.z }, { x: animal.root.position.x, z: animal.root.position.z });
        if (!animal.dead && d < 66) {
          animal.state = animal.species === "boar" ? "charge" : "flee";
          animal.target = null;
          animal.fleeRetargetAt = 0;
          animal.chargeRetargetAt = 0;
          animal.alertUntil = performance.now() + 11000;
        }
      }
    }
    updateHud();
  }

  function showHitMarker() {
    const mark = $("hit-marker");
    mark.classList.remove("show");
    void mark.offsetWidth;
    mark.classList.add("show");
  }

  function reload() {
    if (reloading || state.ammo >= 8 || state.reserve <= 0 || paused || !gameStarted) return;
    reloading = true;
    reloadStarted = performance.now();
    if (weaponFallbackUsed) cycleRifleBolt();
    else playWeaponAnimation("magazine-open");
    $("reload-indicator").classList.add("show");
    sound(300, 0.07, "triangle", 0.018);
  }

  function updateReload() {
    if (!reloading) return;
    const progress = clamp((performance.now() - reloadStarted) / reloadDuration, 0, 1);
    $("reload-fill").style.width = (progress * 100) + "%";
    if (progress >= 1) {
      const amount = Math.min(8 - state.ammo, state.reserve);
      state.ammo += amount;
      state.reserve -= amount;
      reloading = false;
      if (weaponFallbackUsed) cycleRifleBolt();
      else playWeaponAnimation("magazine-close");
      $("reload-indicator").classList.remove("show");
      sound(480, 0.08, "triangle", 0.025);
      toast("Reloaded. " + state.ammo + " rounds ready.", "success");
      updateHud();
    }
  }

  function toggleAim(value) {
    aiming = value === undefined ? !aiming : value;
    const shell = $("game-shell");
    shell.classList.toggle("aiming", aiming);
    const overlay = $("scope-overlay");
    if (overlay) overlay.setAttribute("aria-hidden", aiming ? "false" : "true");
    if (camera) camera.fov = aiming ? scopeFovs[scopeZoomIndex] : 1.04;
    if (weaponRoot) weaponRoot.setEnabled(!aiming);
    text("scope-zoom-label", scopeMagnifications[scopeZoomIndex] + "X");
    text("weapon-mode", aiming
      ? "RANGER OPTIC · " + scopeMagnifications[scopeZoomIndex] + "X"
      : "SEMI-AUTOMATIC · RIFLE SCOPE");
  }

  function adjustScopeZoom(event) {
    if (!aiming || paused) return;
    event.preventDefault();
    const direction = Math.sign(event.deltaY);
    if (!direction) return;
    scopeZoomIndex = clamp(scopeZoomIndex + (direction < 0 ? 1 : -1), 0, scopeMagnifications.length - 1);
    if (camera) camera.fov = scopeFovs[scopeZoomIndex];
    text("scope-zoom-label", scopeMagnifications[scopeZoomIndex] + "X");
    sound(410 + scopeZoomIndex * 35, 0.045, "sine", 0.012);
  }

  function toggleTracking() {
    tracking = !tracking;
    for (const track of footprints) track.mesh.setEnabled(tracking);
    updateTracking();
    if (tracking) {
      announce("Tracking sense active. Look for fresh hoof prints and wildlife.", 2400);
      sound(650, 0.11, "sine", 0.025);
    } else toast("Tracking sense disabled.", "");
  }

  function toggleCrouch() {
    crouched = !crouched;
    $("game-shell").classList.toggle("crouched", crouched);
    updateHud();
    toast(crouched ? "Low profile. Wildlife will tolerate a closer approach." : "Standing upright. Your movement is easier to hear.", crouched ? "success" : "");
    sound(crouched ? 240 : 360, 0.07, "triangle", 0.018);
  }

  function useScent() {
    const now = performance.now();
    if (now < scentActiveUntil) {
      toast("Trail scent is already masking your approach.", "warning");
      return;
    }
    if (state.scent < 1) {
      toast("No trail scent available. Buy a vial at Pinecrest Outfitters.", "warning");
      return;
    }
    state.scent -= 1;
    scentActiveUntil = now + 45000;
    updateHud();
    saveGame(false);
    toast("Trail scent applied. Wildlife detection is reduced for 45 seconds.", "success");
    sound(590, 0.12, "sine", 0.025);
  }

  function updateHud() {
    const rank = ["NOVICE", "SCOUT", "TRACKER", "RANGER", "STALKER", "WILDLANDER"][Math.min(5, Math.floor((state.level - 1) / 2))];
    text("hunter-name", state.name.toUpperCase());
    text("hunter-rank", rank + " · LEVEL " + state.level);
    text("cash-value", "$" + state.cash.toLocaleString("en-AU"));
    text("xp-text", state.xp + " / " + xpRequired() + " XP");
    $("xp-fill").style.width = (state.xp / xpRequired() * 100) + "%";
    text("ammo-current", state.ammo);
    text("ammo-reserve", state.reserve);
    text("shop-cash", "$" + state.cash);
    const scentSeconds = Math.max(0, Math.ceil((scentActiveUntil - performance.now()) / 1000));
    text("fieldcraft-value", (crouched ? "CROUCHED" : "STANDING") + " · " + (scentSeconds > 0 ? "SCENT " + scentSeconds + "s" : "VIALS " + state.scent));
    const crouchAction = $("crouch-action");
    if (crouchAction) crouchAction.classList.toggle("active", crouched);
    text("crouch-label", crouched ? "LOW PROFILE" : "CROUCH");
    const scentAction = $("scent-action");
    if (scentAction) scentAction.classList.toggle("active", scentSeconds > 0);
    text("scent-label", scentSeconds > 0 ? scentSeconds + "s LEFT" : "SCENT " + state.scent);
    text("contract-progress", state.contractProgress + " / 3");
    updateContractBoard();
    $("contract-fill").style.width = (state.contractProgress / 3 * 100) + "%";
    if (state.contractComplete) {
      text("contract-title", "First Harvest · Complete");
      text("contract-description", "Three deer harvested. Your first contract is complete. Sell your hides and meat at the harvest station.");
      text("contract-reward", "REWARD CLAIMED");
    } else if (state.contractAccepted) {
      text("contract-title", "First Harvest");
      text("contract-description", "Harvest 3 deer in Pinecrest Valley. Return to the outpost and sell your hides and meat.");
      text("contract-reward", "$250 + 180 XP");
    } else {
      text("contract-title", "Trailhead Briefing");
      text("contract-description", "Visit the contract board at Pinecrest Outpost to take your first hunting contract.");
      text("contract-reward", "AVAILABLE AT CAMP");
    }
    const hp = $("health-fill");
    if (hp) hp.style.width = state.health + "%";
    text("health-value", state.health + " / 100");
    const stamina = $("stamina-fill");
    if (stamina) stamina.style.width = state.stamina + "%";
    text("stamina-value", Math.round(state.stamina) + "%");
    const fieldTip = !state.contractAccepted
      ? "You're at Pinecrest Outpost. The contract board is nearby — press E to accept First Harvest."
      : state.contractComplete
        ? "First Harvest complete. Sell your hides and meat at the harvest station to build your funds."
        : (tracking
          ? "Tracking sense is active. Follow fresh hoof prints to locate wildlife."
          : "Look for deer beyond the outpost. Press Q to reveal nearby tracks.");
    const scentNoteSeconds = Math.max(0, Math.ceil((scentActiveUntil - performance.now()) / 1000));
    const fieldcraftTip = crouched ? " You're crouched and quieter." : "";
    const scentTip = scentNoteSeconds > 0 ? " Scent cover: " + scentNoteSeconds + "s." : "";
    text("field-note-text", state.hides + " hides · " + state.meat + " meat. " + fieldTip + fieldcraftTip + scentTip);
  }

  function updateDayCycle(dt) {
    dayTime = (dayTime + dt * 0.00036) % 1;
    const daylight = 0.18 + Math.max(0, Math.sin(dayTime * Math.PI * 2)) * 0.82;
    lights.hemi.intensity = 0.16 + daylight * 0.48;
    lights.sun.intensity = 0.06 + daylight * 0.9;
    const fogR = fogNightColor.r + (fogDayColor.r - fogNightColor.r) * daylight;
    const fogG = fogNightColor.g + (fogDayColor.g - fogNightColor.g) * daylight;
    const fogB = fogNightColor.b + (fogDayColor.b - fogNightColor.b) * daylight;
    scene.fogColor.r = fogR;
    scene.fogColor.g = fogG;
    scene.fogColor.b = fogB;
    scene.clearColor.r = fogR;
    scene.clearColor.g = fogG;
    scene.clearColor.b = fogB;
    if (lights.skyMaterial) {
      const sky = lights.skyMaterial.emissiveColor;
      sky.r = skyNightColor.r + (skyDayColor.r - skyNightColor.r) * daylight;
      sky.g = skyNightColor.g + (skyDayColor.g - skyNightColor.g) * daylight;
      sky.b = skyNightColor.b + (skyDayColor.b - skyNightColor.b) * daylight;
    }
    const angle = dayTime * Math.PI * 2;
    lights.sun.direction.copyFromFloats(-Math.cos(angle), -Math.max(0.16, Math.sin(angle)), 0.28).normalize();
    if (camera) {
      lights.sun.position.x = camera.position.x + Math.cos(angle) * 100;
      lights.sun.position.y = camera.position.y + 120;
      lights.sun.position.z = camera.position.z + Math.sin(angle) * 100;
    }
    if (skySun) skySun.setEnabled(daylight > 0.22);
  }

  function formatClock(t) {
    const total = Math.floor(t * 24 * 60);
    const hours24 = Math.floor(total / 60) % 24;
    const mins = total % 60;
    const suffix = hours24 >= 12 ? "PM" : "AM";
    const hours = (hours24 % 12) || 12;
    return String(hours).padStart(2, "0") + ":" + String(mins).padStart(2, "0") + " " + suffix;
  }

  function drawMiniMap() {
    const c = miniMapCtx;
    if (!c) return;
    const w = 240, h = 174;
    c.clearRect(0, 0, w, h);
    c.fillStyle = "#627b54";
    c.fillRect(0, 0, w, h);
    c.strokeStyle = "rgba(186,198,141,.18)";
    c.lineWidth = 1;
    for (let x = 0; x < w; x += 24) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    for (let y = 0; y < h; y += 24) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    const sx = (x) => (x + 140) / 280 * w;
    const sz = (z) => (140 - z) / 280 * h;
    c.strokeStyle = "#b3996b";
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(sx(0), sz(32)); c.quadraticCurveTo(sx(-6), sz(52), sx(0), sz(68)); c.quadraticCurveTo(sx(4), sz(84), sx(9), sz(103)); c.stroke();
    c.fillStyle = "#6c9ba0";
    c.beginPath(); c.ellipse(sx(55), sz(-44), 20, 13, -0.12, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#ad9167";
    c.fillRect(sx(-25), sz(49) - 4, 15, 9);
    c.fillStyle = "#e3d09a";
    c.beginPath(); c.arc(sx(-5), sz(22), 3, 0, Math.PI * 2); c.fill();
    for (const animal of animals) {
      if (animal.dead || animal.harvested) continue;
      c.fillStyle = animal.species === "boar" ? "#d18a6b" : "#e0bd82";
      c.beginPath(); c.arc(sx(animal.root.position.x), sz(animal.root.position.z), 2.8, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = "#f6df9e"; c.strokeStyle = "#fff6db"; c.lineWidth = 1.5;
    c.beginPath(); c.arc(sx(camera.position.x), sz(camera.position.z), 4.2, 0, Math.PI * 2); c.fill(); c.stroke();
    const dx = Math.sin(camera.rotation.y) * 10, dz = Math.cos(camera.rotation.y) * 10;
    c.strokeStyle = "#f5e7bf"; c.lineWidth = 2;
    c.beginPath(); c.moveTo(sx(camera.position.x), sz(camera.position.z)); c.lineTo(sx(camera.position.x + dx), sz(camera.position.z + dz)); c.stroke();
  }

  function drawWorldMap() {
    const c = worldMapCtx;
    if (!c) return;
    c.fillStyle = "#657e55";
    c.fillRect(0, 0, 720, 510);
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * 720, y = Math.random() * 510;
      c.fillStyle = Math.random() > 0.5 ? "rgba(162,188,121,.09)" : "rgba(29,67,43,.07)";
      c.fillRect(x, y, rand(10, 32), rand(10, 32));
    }
    c.fillStyle = "#6b9aa0";
    c.beginPath(); c.ellipse(520, 125, 120, 75, -0.12, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#789267";
    c.beginPath(); c.ellipse(82, 403, 65, 48, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "#b39a6e"; c.lineWidth = 17; c.lineCap = "round";
    c.beginPath(); c.moveTo(355, 455); c.bezierCurveTo(310, 350, 380, 280, 345, 208); c.bezierCurveTo(305, 135, 320, 90, 380, 45); c.stroke();
    c.beginPath(); c.moveTo(345, 208); c.bezierCurveTo(420, 250, 475, 278, 600, 300); c.stroke();
    c.fillStyle = "#8b976e"; c.beginPath(); c.ellipse(355, 455, 45, 30, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#d5bd88"; c.font = "700 17px Barlow Condensed"; c.textAlign = "center"; c.fillText("PINECREST OUTPOST", 355, 490);
    c.fillStyle = "#d4e3cf"; c.font = "600 12px DM Sans"; c.fillText("STILLWATER LAKE", 520, 35);
    c.fillText("NORTH RIDGE", 370, 90); c.fillText("WHISPERING MEADOWS", 165, 260);
    for (const animal of animals) {
      if (animal.dead || animal.harvested) continue;
      c.fillStyle = animal.species === "boar" ? "#d28a69" : "#e3c98c";
      const x = (animal.root.position.x + 140) / 280 * 720;
      const y = (140 - animal.root.position.z) / 280 * 510;
      c.beginPath(); c.arc(x, y, 4, 0, Math.PI * 2); c.fill();
    }
    const px = (camera.position.x + 140) / 280 * 720;
    const py = (140 - camera.position.z) / 280 * 510;
    c.fillStyle = "#f5e0a2"; c.strokeStyle = "#26372a"; c.lineWidth = 2;
    c.beginPath(); c.arc(px, py, 7, 0, Math.PI * 2); c.fill(); c.stroke();
  }

  function enterWorld(useSave) {
    const name = $("player-name").value.trim().replace(/[^a-zA-Z0-9 _-]/g, "").slice(0, 16);
    if (name.length < 2) {
      announce("Choose a hunter name with at least two characters.", 2400);
      return;
    }
    if (useSave) loadSave();
    else {
      state = { ...defaults, name, x: 0, z: 19, yaw: 0 };
      localStorage.removeItem(SAVE_KEY);
    }
    state.name = name;
    crouched = false;
    scentActiveUntil = 0;
    $("game-shell").classList.remove("crouched");
    if (!scene) {
      engine = new BABYLON.Engine(canvas, true, { stencil: false, preserveDrawingBuffer: false, adaptToDeviceRatio: false, powerPreference: "high-performance" });
      renderScaleBase = Math.max(1, (window.devicePixelRatio || 1) / 1.25);
      renderScaleLevel = renderScaleBase;
      engine.setHardwareScalingLevel(renderScaleLevel);
      createScene();
      window.addEventListener("resize", () => engine.resize());
    }
    if (camera) {
      const spawnX = Number.isFinite(state.x) ? state.x : 0;
      const spawnZ = Number.isFinite(state.z) ? state.z : 19;
      camera.position.set(spawnX, heightAt(spawnX, spawnZ) + 1.72, spawnZ);
      camera.rotation.y = Number(state.yaw) || 0;
      camera.rotation.x = 0;
    }
    gameStarted = true;
    paused = false;
    $("start-screen").style.display = "none";
    $("pause-screen").classList.remove("open");
    updateHud();
    saveGame(false);
    requestPointerLock();
    announce("Welcome to Pinecrest Valley. Visit the contract board to get started.", 3800);
  }

  function requestPointerLock() {
    if (canvas.requestPointerLock) {
      try { canvas.requestPointerLock(); } catch (error) { /* some browsers require a direct click */ }
    }
  }

  function pauseGame() {
    if (!gameStarted) return;
    paused = true;
    $("pause-screen").classList.add("open");
    document.exitPointerLock?.();
    saveGame(false);
  }

  function resumeGame() {
    paused = false;
    $("pause-screen").classList.remove("open");
    requestPointerLock();
  }

  function buy(item) {
    const costs = { ammo: 35, medkit: 45, scent: 25 };
    const cost = costs[item];
    if (!cost || state.cash < cost) {
      toast("Not enough funds for that supply.", "warning");
      return;
    }
    state.cash -= cost;
    if (item === "ammo") state.reserve += 20;
    if (item === "medkit") state.medkits += 1;
    if (item === "scent") state.scent += 1;
    updateHud();
    saveGame(false);
    toast("Supply purchased. Head back into the valley.", "success");
  }

  function useMedkit() {
    if (state.medkits < 1) { toast("No field kits left.", "warning"); return; }
    if (state.health >= 100) { toast("You're already in good shape.", "warning"); return; }
    state.medkits -= 1;
    state.health = 100;
    updateHud();
    saveGame(false);
    toast("Field kit used. Health restored.", "success");
  }

  function openMap() {
    const map = $("map-screen");
    map.hidden = false;
    map.classList.add("open");
    map.style.setProperty("display", "flex", "important");
    map.style.setProperty("visibility", "visible", "important");
    map.style.setProperty("pointer-events", "auto", "important");
    paused = true;
    drawWorldMap();
    document.exitPointerLock?.();
  }

  function closeMap(restoreLock) {
    const map = $("map-screen");
    map.classList.remove("open");
    map.hidden = true;
    map.style.setProperty("display", "none", "important");
    map.style.setProperty("visibility", "hidden", "important");
    map.style.setProperty("pointer-events", "none", "important");
    paused = false;
    keys.clear();
    if (restoreLock) requestPointerLock();
  }

  function handleKeyDown(event) {
    const key = event.key.toLowerCase();
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key) &&
        !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) event.preventDefault();
    if (event.repeat) return;
    if (key === "escape") {
      const openOverlay = ["map-screen", "supplies-screen", "harvest-screen"].find((id) => $(id).classList.contains("open"));
      if (openOverlay) {
        if (openOverlay === "map-screen") closeMap(false);
        else {
          $(openOverlay).classList.remove("open");
          paused = false;
          keys.clear();
        }
        return;
      }
      if (gameStarted && !paused) pauseGame();
      else if (paused) resumeGame();
      return;
    }
    if (["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright","shift"].includes(key)) keys.add(key);
    if (!gameStarted || paused) return;
    if (key === "r") reload();
    if (key === "e") interact();
    if (key === "q") toggleTracking();
    if (key === "c") toggleCrouch();
    if (key === "g") useScent();
    if (key === "f") useMedkit();
    if (key === "m") openMap();
    if (key === " " && gameStarted && !paused) jump();
  }

  function handleKeyUp(event) { keys.delete(event.key.toLowerCase()); }

  canvas.addEventListener("click", () => {
    if (!gameStarted || paused) return;
    if (!pointerLocked) requestPointerLock();
    else shoot();
  });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener("wheel", adjustScopeZoom, { passive: false });
  canvas.addEventListener("mousedown", (event) => {
    if (event.button === 2 && gameStarted && !paused) toggleAim(true);
  });
  window.addEventListener("mouseup", (event) => { if (event.button === 2) toggleAim(false); });

  document.addEventListener("pointerlockchange", () => {
    pointerLocked = document.pointerLockElement === canvas;
    $("bottom-tip").style.opacity = pointerLocked ? "0" : "1";
    if (!pointerLocked && gameStarted && !paused && !$("supplies-screen").classList.contains("open") && !$("harvest-screen").classList.contains("open")) {
      $("bottom-tip").textContent = "CLICK THE WORLD TO FOCUS · ESC TO PAUSE";
    } else {
      $("bottom-tip").textContent = "CLICK TO FOCUS · WASD MOVE · C CROUCH · G SCENT · RMB AIM · LMB FIRE";
    }
  });

  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("keyup", handleKeyUp);
  window.addEventListener("blur", () => {
    keys.clear(); touchKeys.clear(); firing = false;
    if (aiming) toggleAim(false);
  });

  $("start-button").addEventListener("click", () => enterWorld(false));
  $("continue-button").addEventListener("click", () => enterWorld(true));
  $("pause-button").addEventListener("click", pauseGame);
  $("map-close-button").addEventListener("click", () => closeMap(true));
  $("map-close-x").addEventListener("click", () => closeMap(true));
  $("resume-button").addEventListener("click", resumeGame);
  $("resume-x").addEventListener("click", resumeGame);
  $("save-button").addEventListener("click", () => saveGame(true));
  $("reset-button").addEventListener("click", () => {
    if (window.confirm("Reset all Wildrange solo progress in this browser? This cannot be undone.")) {
      resetSave();
      $("pause-screen").classList.remove("open");
      paused = false;
      saveGame(false);
    }
  });
  $("supplies-close-button").addEventListener("click", () => {
    $("supplies-screen").classList.remove("open");
    paused = false;
    keys.clear();
    requestPointerLock();
  });
  $("harvest-close").addEventListener("click", () => {
    $("harvest-screen").classList.remove("open");
    paused = false;
    requestPointerLock();
  });
  document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => {
    $(button.dataset.close).classList.remove("open");
    if (!$("pause-screen").classList.contains("open")) paused = false;
    requestPointerLock();
  }));
  document.querySelectorAll("[data-buy]").forEach((button) => button.addEventListener("click", () => buy(button.dataset.buy)));
  $("touch-aim").addEventListener("touchstart", (event) => { event.preventDefault(); toggleAim(true); }, { passive: false });
  $("touch-aim").addEventListener("touchend", () => toggleAim(false));
  $("touch-fire").addEventListener("touchstart", (event) => { event.preventDefault(); shoot(); }, { passive: false });
  $("touch-interact").addEventListener("click", interact);
  document.querySelectorAll("[data-move]").forEach((button) => {
    const direction = button.dataset.move;
    button.addEventListener("touchstart", (event) => { event.preventDefault(); touchKeys.add(direction); }, { passive: false });
    button.addEventListener("touchend", () => touchKeys.delete(direction));
    button.addEventListener("touchcancel", () => touchKeys.delete(direction));
  });
  $("map-button").addEventListener("click", () => {
    if (!gameStarted) return;
    openMap();
  });
  $("mini-map").addEventListener("click", () => {
    if (!gameStarted) return;
    openMap();
  });

  function boot() {
    // Always enter through the title screen. Never restore an open modal from a stale page session.
    ["pause-screen", "harvest-screen", "supplies-screen"].forEach((id) => $(id).classList.remove("open"));
    const map = $("map-screen");
    map.classList.remove("open");
    map.hidden = true;
    map.style.setProperty("display", "none", "important");
    map.style.setProperty("visibility", "hidden", "important");
    map.style.setProperty("pointer-events", "none", "important");
    $("start-screen").style.display = "flex";
    loadSave();
    if (localStorage.getItem(SAVE_KEY)) $("continue-button").style.display = "block";
    else $("continue-button").style.display = "none";
    // Prepare the valley behind the title screen. Everything runs locally; no server is contacted.
    try {
      engine = new BABYLON.Engine(canvas, true, { stencil: false, preserveDrawingBuffer: false, adaptToDeviceRatio: false, powerPreference: "high-performance" });
      renderScaleBase = Math.max(1, (window.devicePixelRatio || 1) / 1.25);
      renderScaleLevel = renderScaleBase;
      engine.setHardwareScalingLevel(renderScaleLevel);
      createScene();
      window.addEventListener("resize", () => engine.resize());
    } catch (error) {
      sceneInitError = error && (error.stack || error.message) ? String(error.stack || error.message) : String(error);
      console.error("Wildrange could not initialise its 3D scene:", error);
      $("center-message").textContent = "3D setup failed. Refresh the page and check that WebGL is enabled.";
      $("center-message").classList.add("show");
    }
  }

  function isReadableSignFace(mesh) {
    return Boolean(mesh && mesh.isVisible && mesh.isEnabled() && mesh.getTotalVertices() > 0 &&
      mesh.material && mesh.material.backFaceCulling === false && mesh.material.emissiveTexture);
  }

  window.WildrangeDiagnostics = () => ({
    engineReady: Boolean(engine && engine.getRenderingCanvas()),
    sceneReady: Boolean(scene && camera),
    environmentReady: Boolean(lights.environment && lights.environment.isReady && lights.environment.isReady()),
    meshCount: scene ? scene.meshes.length : 0,
    pbrMaterialCount: scene ? scene.materials.filter((material) => material.getClassName() === "PBRMaterial").length : 0,
    textureCount: scene ? scene.textures.length : 0,
    readyTextureCount: scene ? scene.textures.filter((texture) => texture.isReady()).length : 0,
    canvasWidth: canvas ? canvas.width : 0,
    canvasHeight: canvas ? canvas.height : 0,
    webglEnabled: Boolean(engine && engine.getCaps && engine.getCaps().maxTextureSize > 0),
    animalCount: animals.length,
    deerModelCount: importedDeerCount,
    boarModelCount: importedBoarCount,
    importedAnimalCount,
    animalModelFailureCount: modelLoadFailures.filter((value) => !value.startsWith("rifle:")).length,
    animalRigSkinCount: animals.filter((animal) => animal.modelEntries && animal.modelEntries.skeletons && animal.modelEntries.skeletons.length).length,
    animalLegRigCount: animals.reduce((sum, animal) => sum + (animal.rig ? animal.rig.legs.length : 0), 0),
    animalHeadRigCount: animals.filter((animal) => Boolean(animal.rig && animal.rig.head)).length,
    animalStates: animals.reduce((result, animal) => { result[animal.state] = (result[animal.state] || 0) + 1; return result; }, {}),
    animalMovingCount: animals.filter((animal) => animal.state === "walk" || animal.state === "flee" || animal.state === "charge").length,
    animalAnimatedEarCount: animals.reduce((sum, animal) => sum + (animal.rig ? animal.rig.ears.length : 0), 0),
    animalAnimationClipCount: animals.reduce((sum, animal) => sum + (animal.modelAnimations ? animal.modelAnimations.length : 0), 0),
    riflePartCount: weaponRoot ? weaponRoot.getChildMeshes().length : 0,
    weaponModelReady,
    weaponModelFailed,
    weaponAssetMeshCount,
    weaponBoltReady: Boolean(weaponBoltNode) || weaponAnimationClipNames.some((name) => name.toLowerCase().includes("bolt-open")),
    weaponScopePartCount,
    weaponAnimationClipCount: weaponAnimationClipNames.length,
    weaponAnimationClipNames: weaponAnimationClipNames.slice(),
    weaponHasIntegratedScope,
    weaponFallbackUsed,
    modelLoadFailures: modelLoadFailures.slice(),
    jumpCount,
    playerGrounded,
    playerHeight: camera ? camera.position.y - walkSurfaceAt(camera.position.x, camera.position.z) - (crouched ? 1.12 : 1.72) : 0,
    cabinDoorAngle: cabinDoorPivot ? Number(cabinDoorPivot.rotation.y.toFixed(3)) : null,
    cabinDoorUpdateCount,
    boardTextureUScale: contractBoardMaterial && contractBoardMaterial.diffuseTexture ? contractBoardMaterial.diffuseTexture.uScale : null,
    boardTextureVScale: contractBoardMaterial && contractBoardMaterial.diffuseTexture ? contractBoardMaterial.diffuseTexture.vScale : null,
    boardBackReady: Boolean(contractBoardBackTexture && contractBoardBackTexture.isReady()),
    boardFrontReady: Boolean(contractBoardTexture && contractBoardTexture.isReady()),
    sceneInitError,
    bearingLabel: camera ? bearingName(camera.rotation.y * 180 / Math.PI) : "N",
    outpostTreeIntrusionCount: scene ? scene.transformNodes.filter((node) =>
      node.name === "forest-tree-root" && isPinecrestCompoundClearance(node.position.x, node.position.z)
    ).length : 0,
    contractBoardPosition: contractBoardMesh ? {
      x: Number(contractBoardMesh.position.x.toFixed(2)),
      z: Number(contractBoardMesh.position.z.toFixed(2))
    } : null,
    gateSignReady: Boolean(gateSignTexture && gateSignTexture.isReady()),
    gateSignBackReady: Boolean(gateSignBackTexture && gateSignBackTexture.isReady()),
    cabinSignReady: Boolean(cabinSignTexture && cabinSignTexture.isReady()),
    cabinSignSupportPostCount: scene ? scene.meshes.filter((mesh) => mesh.name === "Pinecrest lodge sign structural timber post").length : 0,
    lodgeModelReady,
    lodgeModelLoading,
    lodgeModelFailed,
    lodgeModelMeshCount,
    lodgeModelError,
    lodgeModelAssetName,
    lodgeModelUsedFallback,
    lodgeModelUniformScale,
    lodgeModelWorldDimensions,
    lodgeModelNodeNames,
    heroConiferReady,
    heroBroadleafReady,
    heroTreeModelCount,
    heroTreeMeshCount,
    heroTreeSourceMeshCount,
    heroVegetationFailures: heroVegetationFailures.slice(),
    gateStructuralPostCount: scene ? scene.meshes.filter((mesh) => mesh.name === "Pinecrest gate structural timber support post").length : 0,
    cabinFrontWallBackingCount: scene ? scene.meshes.filter((mesh) => mesh.name === "Pinecrest lodge front wall opaque backing").length : 0,
    pinecrestGableBeamCount: scene ? scene.meshes.filter((mesh) => mesh.name === "Pinecrest gable diagonal king timber").length : 0,
    pinecrestRoofSurfaceCount: scene ? scene.meshes.filter((mesh) => mesh.name === "Pinecrest continuous cedar shingle roof surface").length : 0,
    pinecrestRoofShingleMaterialReady: Boolean(mat.roofShingle && mat.roofShingle.albedoTexture && mat.roofShingle.bumpTexture),
    pinecrestLogEndgrainCount: scene ? scene.meshes.filter((mesh) => /Pinecrest .* log cut end/.test(mesh.name)).length : 0,
    compoundShadowCasterCount: Number(lights.compoundShadowCasterCount) || 0,
    compoundShadowMapSize: lights.shadows && lights.shadows.getShadowMap() ? lights.shadows.getShadowMap().getSize().width : 0,
    compoundFencePostCount: scene ? scene.meshes.filter((mesh) => /compound (perimeter|north|gate) fence post/.test(mesh.name)).length : 0,
    compoundFenceRailCount: scene ? scene.meshes.filter((mesh) => /compound (side|north|gate) fence (lower|upper) rail/.test(mesh.name)).length : 0,
    pinecrestRainGutterCount: scene ? scene.meshes.filter((mesh) => mesh.name === "Pinecrest lodge metal rain gutter").length : 0,
    pinecrestWindowFlowerBoxCount: scene ? scene.meshes.filter((mesh) => mesh.name === "Pinecrest window flower box body").length : 0,
    pinecrestWoodshedPostCount: scene ? scene.meshes.filter((mesh) => mesh.name === "Pinecrest firewood shelter structural post").length : 0,
    pinecrestWoodshedLogCount: scene ? scene.meshes.filter((mesh) => mesh.name === "Pinecrest woodshed split firewood").length : 0,
    pinecrestFernFrondCount: scene ? scene.meshes.filter((mesh) => /Pinecrest .* fern frond/.test(mesh.name)).length : 0,
    outfitterSignReady: Boolean(outfitterSignTexture && outfitterSignTexture.isReady()),
    harvestSignReady: Boolean(harvestSignTexture && harvestSignTexture.isReady()),
    cabinSignFaceVisible: isReadableSignFace(cabinSignFrontMesh),
    gateSignFrontFaceVisible: isReadableSignFace(gateSignFrontMesh),
    gateSignBackFaceVisible: isReadableSignFace(gateSignBackMesh),
    missionBoardFrontFaceVisible: isReadableSignFace(boardPaperFrontMesh),
    missionBoardBackFaceVisible: isReadableSignFace(boardPaperBackMesh),
    outfitterSignFaceVisible: isReadableSignFace(outfitterSignFrontMesh),
    harvestSignFaceVisible: isReadableSignFace(harvestSignFrontMesh),
    missionBoardCanvasFullSize: Boolean(contractBoardTexture && contractBoardTexture.getSize().width === 1024 &&
      contractBoardTexture.getSize().height === 768 && contractBoardBackTexture &&
      contractBoardBackTexture.getSize().width === 1024 && contractBoardBackTexture.getSize().height === 768),
    signFaceMaterialsReady: Boolean(
      cabinSignMaterial && !cabinSignMaterial.backFaceCulling && cabinSignMaterial.emissiveTexture &&
      contractBoardMaterial && !contractBoardMaterial.backFaceCulling && contractBoardMaterial.emissiveTexture &&
      gateSignFrontMaterial && !gateSignFrontMaterial.backFaceCulling && gateSignFrontMaterial.emissiveTexture &&
      outfitterSignMaterial && !outfitterSignMaterial.backFaceCulling && outfitterSignMaterial.emissiveTexture &&
      harvestSignMaterial && !harvestSignMaterial.backFaceCulling && harvestSignMaterial.emissiveTexture
    ),
    outpostApproachReady: Boolean(scene && scene.getMeshByName("Pinecrest outpost access road")) ,
    jumpMaxHeight,
    fps: Math.round(smoothedFps),
    averageFrameMs: Number(averageFrameMs.toFixed(2)),
    renderScaleLevel: Number(renderScaleLevel.toFixed(2)),
    animalSimulationHz: 30,
    frozenStaticMeshCount,
    mergedSceneryBatchCount,
    mergedScenerySourceMeshCount,
    aiming,
    cabinDoorOpen,
    cabinDoorReady: Boolean(cabinDoorPivot),
    contractBoardReady: Boolean(contractBoardTexture && contractBoardBackTexture),
    scopeZoom: scopeMagnifications[scopeZoomIndex],
    scopeVisible: Boolean($("scope-overlay") && $("game-shell").classList.contains("aiming") && window.getComputedStyle($("scope-overlay")).display !== "none")
  });

  // Deterministic hooks are available only to the automated browser smoke test.
  if (new URLSearchParams(window.location.search).has("qa")) {
    window.WildrangeQA = {
      setDoor: (open) => setCabinDoor(Boolean(open)),
      doorAngle: () => cabinDoorPivot ? cabinDoorPivot.rotation.y : null,
      teleportIntoCabin: () => {
        if (!camera) return false;
        camera.position.set(-14, 2.74, 43);
        camera.rotation.set(0, 0, 0);
        playerVelocity.set(0, 0, 0);
        verticalVelocity = 0;
        playerGrounded = true;
        updateInteraction();
        return true;
      },
      canStandAt: (x, z) => canStandAt(Number(x), Number(z)),
      surfaceAt: (x, z) => walkSurfaceAt(Number(x), Number(z)),
      bearingFor: (degrees) => bearingName(Number(degrees))
    };
  }

  window.addEventListener("beforeunload", () => saveGame(false));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) saveGame(false);
  });
  window.setInterval(updateReload, 40);
  boot();
})();