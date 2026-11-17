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
  let keys = new Set();
  let touchKeys = new Set();
  let currentTarget = null;
  let currentAnimal = null;
  let windMeshes = [];
  let waterRipples = [];
  let skySun = null;

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

  function makePbrSurface(name, slug, tiling, tint, detailMaps) {
    const material = new BABYLON.PBRMaterial(name, scene);
    material.albedoColor = hex(tint || "#ffffff");
    material.metallic = 0;
    material.roughness = 1;
    material.environmentIntensity = 0.78;
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

  function createMaterials() {
    mat.grass = makePbrSurface("Pinecrest meadow grass", "grass", 68, "#dce8cf");
    mat.grassLight = mat.grass;
    mat.grassDark = mat.grass;
    mat.dirt = makePbrSurface("Forest-floor trail", "forest_floor", 26, "#d1c0a0");
    mat.dirtLight = makePbrSurface("Trail shoulder", "forest_floor", 18, "#e0d2b5");
    mat.water = makeMaterial("Stillwater lake water", "#6f9ba1", 0.16);
    mat.water.alpha = 0.94;
    mat.water.specularColor = new BABYLON.Color3(0.78, 0.86, 0.9);
    mat.water.specularPower = 128;
    mat.bark = makePbrSurface("Photographic tree bark", "bark", 2.4, "#d4c1a5");
    mat.pine1 = makePbrSurface("Pine needles dark", "leaf_set", 3, "#8aa77a", false);
    mat.pine2 = makePbrSurface("Pine needles mid", "leaf_set", 3, "#9ab68a", false);
    mat.pine3 = makePbrSurface("Pine needles sunlit", "leaf_set", 3, "#b1c397", false);
    mat.leaf1 = makePbrSurface("Broadleaf foliage dark", "leaf_set", 2.5, "#7b9870", false);
    mat.leaf2 = makePbrSurface("Broadleaf foliage mid", "leaf_set", 2.5, "#98ac7e", false);
    mat.leaf3 = makePbrSurface("Broadleaf foliage light", "leaf_set", 2.5, "#b7c895", false);
    mat.stone = makePbrSurface("Mossy fieldstone", "rock", 2.6, "#c9c7b2");
    mat.stoneDark = makePbrSurface("Shaded fieldstone", "rock", 2.1, "#8d9486");
    mat.wood = makePbrSurface("Weathered timber boards", "wood_planks", 3.4, "#e1c59f");
    mat.woodLight = makePbrSurface("Pinecrest exterior siding", "wood_siding", 3.2, "#e1d4ba");
    mat.roof = makePbrSurface("Weathered roof shingles", "wood_planks", 5, "#8f8067");
    mat.roofLight = makePbrSurface("Roof edge timber", "wood_planks", 2.5, "#bba27d");
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
    return Math.sin(x * 0.034) * 1.05 + Math.cos(z * 0.029) * 1.15 +
      Math.sin((x + z) * 0.018) * 1.35 + Math.cos((x - z) * 0.024) * 0.65;
  }

  function flatArea(x, z) {
    return Math.hypot(x, z - 31) < 22;
  }

  function makeTerrain() {
    const ground = BABYLON.MeshBuilder.CreateGround("Pinecrest terrain", {
      width: 280, height: 280, subdivisions: 100, updatable: true
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
      height, diameterTop: 0.18 * scale, diameterBottom: 0.56 * scale, tessellation: 12
    }, scene);
    trunk.parent = root;
    trunk.position.y = height * 0.48;
    trunk.material = mat.bark;
    trunk.isPickable = false;
    trunk.receiveShadows = true;
    if (lights.shadows) { try { lights.shadows.addShadowCaster(trunk); } catch (error) { /* optional */ } }

    if (broadleaf) {
      const clusters = [
        [-0.72, 4.4, -0.2, 1.55], [0.62, 4.75, 0.35, 1.72],
        [-0.38, 5.65, 0.48, 1.5], [0.18, 6.1, -0.4, 1.42],
        [0.9, 4.0, -0.42, 1.24], [-0.88, 3.75, 0.5, 1.15],
        [0.05, 4.75, 0.0, 1.68]
      ];
      clusters.forEach((entry, index) => {
        const crown = BABYLON.MeshBuilder.CreateIcoSphere("photographic broadleaf crown", {
          radius: entry[3] * scale, subdivisions: 2
        }, scene);
        crown.parent = root;
        crown.position.set(entry[0] * scale, entry[1] * scale, entry[2] * scale);
        crown.scaling.set(rand(0.82, 1.18), rand(0.78, 1.08), rand(0.86, 1.16));
        crown.rotation.set(rand(-0.12, 0.12), rand(0, Math.PI * 2), rand(-0.12, 0.12));
        crown.material = [mat.leaf1, mat.leaf2, mat.leaf3][index % 3];
        crown.isPickable = false;
        crown.receiveShadows = true;
        if (lights.shadows && index < 2) { try { lights.shadows.addShadowCaster(crown); } catch (error) { /* optional */ } }
        windMeshes.push({ mesh: crown, base: crown.rotation.z, phase: rand(0, 12) });
      });
    } else {
      const whorls = [
        { y: 2.65, r: 2.35, h: 1.9 }, { y: 3.72, r: 2.12, h: 1.82 },
        { y: 4.78, r: 1.82, h: 1.65 }, { y: 5.75, r: 1.5, h: 1.45 },
        { y: 6.58, r: 1.14, h: 1.28 }, { y: 7.34, r: 0.72, h: 1.0 }
      ];
      whorls.forEach((whorl, index) => {
        const crown = BABYLON.MeshBuilder.CreateIcoSphere("pine needle bough cluster", {
          radius: whorl.r * scale, subdivisions: 2
        }, scene);
        crown.parent = root;
        crown.position.set(rand(-0.15, 0.15) * scale, whorl.y * scale, rand(-0.15, 0.15) * scale);
        crown.scaling.set(1.03, whorl.h / whorl.r, 1.0);
        crown.rotation.y = rand(0, Math.PI * 2);
        crown.material = [mat.pine1, mat.pine2, mat.pine3, mat.pine2][index % 4];
        crown.isPickable = false;
        crown.receiveShadows = true;
        if (lights.shadows && index < 2) { try { lights.shadows.addShadowCaster(crown); } catch (error) { /* optional */ } }
        windMeshes.push({ mesh: crown, base: crown.rotation.z, phase: rand(0, 12) });
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
    rock.receiveShadows = true;
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
    box("lodge wall core", { width: 11.1, height: 5.0, depth: 8.1 }, new BABYLON.Vector3(0, 3.55, 0), mat.woodLight, root);

    for (let row = 0; row < 10; row++) {
      const y = 1.28 + row * 0.46;
      const front = BABYLON.MeshBuilder.CreateCylinder("front log course", {
        height: 11.7, diameterTop: 0.27, diameterBottom: 0.36, tessellation: 10
      }, scene);
      front.parent = root; front.rotation.z = Math.PI / 2; front.position.set(0, y, -4.08);
      front.material = mat.bark; front.isPickable = false; front.receiveShadows = true;
      const rear = BABYLON.MeshBuilder.CreateCylinder("rear log course", {
        height: 11.7, diameterTop: 0.27, diameterBottom: 0.36, tessellation: 10
      }, scene);
      rear.parent = root; rear.rotation.z = Math.PI / 2; rear.position.set(0, y, 4.08);
      rear.material = mat.bark; rear.isPickable = false; rear.receiveShadows = true;
      for (const side of [-1, 1]) {
        const wall = BABYLON.MeshBuilder.CreateCylinder("side log course", {
          height: 8.6, diameterTop: 0.27, diameterBottom: 0.36, tessellation: 10
        }, scene);
        wall.parent = root; wall.rotation.x = Math.PI / 2; wall.position.set(side * 5.55, y, 0);
        wall.material = mat.bark; wall.isPickable = false; wall.receiveShadows = true;
      }
    }

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
      const roofPanel = box("lodge pitched roof", { width: 12.9, height: 0.24, depth: 5.75 }, new BABYLON.Vector3(0, 6.38, side * 2.26), mat.roof, root);
      roofPanel.rotation.x = side * roofPitch;
      for (let row = 0; row < 6; row++) {
        const z = side * (0.55 + row * 0.78);
        const y = 7.22 - row * 0.31;
        for (let column = 0; column < 7; column++) {
          const x = -5.45 + column * 1.82 + (row % 2 ? 0.48 : 0);
          const shingle = box("individual roof shingle", { width: 1.74, height: 0.075, depth: 0.94 }, new BABYLON.Vector3(x, y, z), row % 2 ? mat.roof : mat.roofLight, root);
          shingle.rotation.x = side * roofPitch;
        }
      }
      const fascia = box("roof fascia", { width: 12.9, height: 0.36, depth: 0.28 }, new BABYLON.Vector3(0, 5.1, side * 4.95), mat.wood, root);
      fascia.rotation.x = side * roofPitch;
    }
    box("roof ridge cap", { width: 12.95, height: 0.28, depth: 0.38 }, new BABYLON.Vector3(0, 7.5, 0), mat.roofLight, root);
    for (let x = -5.1; x <= 5.1; x += 1.7) {
      for (const side of [-1, 1]) {
        const rafter = box("exposed roof rafter", { width: 0.22, height: 0.34, depth: 5.7 }, new BABYLON.Vector3(x, 6.25, side * 2.1), mat.wood, root);
        rafter.rotation.x = side * roofPitch;
      }
    }

    box("lodge porch platform", { width: 8.8, height: 0.34, depth: 2.4 }, new BABYLON.Vector3(0, 1.1, -5.35), mat.wood, root);
    for (let board = 0; board < 12; board++) {
      box("porch deck board", { width: 8.65, height: 0.07, depth: 0.18 }, new BABYLON.Vector3(0, 1.3, -6.34 + board * 0.18), mat.woodLight, root);
    }
    for (const x of [-4.0, 0, 4.0]) {
      box("porch support post", { width: 0.24, height: 3.0, depth: 0.24 }, new BABYLON.Vector3(x, 2.55, -6.25), mat.bark, root);
      box("porch post cap", { width: 0.4, height: 0.18, depth: 0.4 }, new BABYLON.Vector3(x, 4.08, -6.25), mat.woodLight, root);
    }
    box("porch canopy", { width: 9.1, height: 0.2, depth: 2.75 }, new BABYLON.Vector3(0, 4.05, -5.65), mat.roof, root);
    for (const x of [-4.0, 4.0]) {
      box("porch handrail", { width: 0.14, height: 0.14, depth: 1.9 }, new BABYLON.Vector3(x, 2.0, -5.45), mat.woodLight, root);
      for (let slat = 0; slat < 5; slat++) {
        box("porch baluster", { width: 0.09, height: 0.85, depth: 0.09 }, new BABYLON.Vector3(x, 1.62, -6.22 + slat * 0.38), mat.wood, root);
      }
    }

    box("lodge door recess", { width: 1.82, height: 3.25, depth: 0.12 }, new BABYLON.Vector3(0, 2.66, -4.2), mat.black, root);
    box("lodge door leaf", { width: 1.55, height: 3.0, depth: 0.14 }, new BABYLON.Vector3(0, 2.6, -4.32), mat.roofLight, root);
    for (let plank = 0; plank < 5; plank++) {
      box("door vertical plank", { width: 0.27, height: 2.82, depth: 0.04 }, new BABYLON.Vector3(-0.54 + plank * 0.27, 2.6, -4.42), mat.wood, root);
    }
    box("door cross brace", { width: 1.36, height: 0.14, depth: 0.06 }, new BABYLON.Vector3(0, 1.68, -4.46), mat.wood, root);
    for (const x of [-0.94, 0.94]) box("door jamb", { width: 0.18, height: 3.4, depth: 0.22 }, new BABYLON.Vector3(x, 2.65, -4.3), mat.woodLight, root);
    box("door lintel", { width: 2.1, height: 0.2, depth: 0.24 }, new BABYLON.Vector3(0, 4.35, -4.3), mat.woodLight, root);
    const handle = BABYLON.MeshBuilder.CreateSphere("door iron handle", { diameter: 0.12, segments: 10 }, scene);
    handle.parent = root; handle.position.set(0.52, 2.55, -4.5); handle.material = mat.gold; handle.isPickable = false;

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
        box("window shutter", { width: 0.42, height: 1.35, depth: 0.13 }, new BABYLON.Vector3(x + side * 1.05, 3.95, -4.27), mat.roofLight, root);
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
    const lanternLight = new BABYLON.PointLight("warm porch lantern light", new BABYLON.Vector3(-12.3, 3.6, 38.1), scene);
    lanternLight.diffuse = hex("#f1bd78"); lanternLight.intensity = 0.24; lanternLight.range = 10;
    box("outpost bench seat", { width: 2.0, height: 0.18, depth: 0.5 }, new BABYLON.Vector3(-3.4, 1.62, -5.7), mat.wood, root);
    for (const x of [-4.15, -2.65]) box("bench leg", { width: 0.16, height: 0.72, depth: 0.16 }, new BABYLON.Vector3(x, 1.22, -5.7), mat.bark, root);
    for (let log = 0; log < 5; log++) {
      const firewood = BABYLON.MeshBuilder.CreateCylinder("stacked firewood", { height: 1.2, diameter: 0.22, tessellation: 9 }, scene);
      firewood.parent = root; firewood.rotation.z = Math.PI / 2;
      firewood.position.set(4.1 + (log % 2) * 0.12, 0.75 + Math.floor(log / 2) * 0.23, -5.4 - (log % 2) * 0.3);
      firewood.material = mat.bark; firewood.isPickable = false;
    }

    obstacles.push({ x: -14, z: 43, radius: 6.4 });
    makeInteractable("OUTFITTERS", "Open the supply counter", -6.8, 27.5, "shop", "ammo");
    makeInteractable("CONTRACT BOARD", "View local hunting contracts", -5.1, 22.4, "contract", "board");
    makeInteractable("HARVEST STATION", "Sell hides and meat", -20.7, 40.5, "sell", "table");
    box("contract-board", { width: 2.0, height: 2.1, depth: 0.26 }, new BABYLON.Vector3(-5.1, 1.7, 22.4), mat.sign);
    const boardPost = BABYLON.MeshBuilder.CreateCylinder("board-post", { height: 2.5, diameter: 0.18, tessellation: 8 }, scene);
    boardPost.position.set(-5.1, 0.95, 22.4); boardPost.material = mat.bark;
    box("board-paper", { width: 1.35, height: 1.0, depth: 0.06 }, new BABYLON.Vector3(-5.1, 1.8, 22.22), mat.window);
    box("harvest-table", { width: 4, height: 1.1, depth: 1.7 }, new BABYLON.Vector3(-20.7, 0.75, 40.5), mat.wood);
    for (const [x, z] of [[-22.6, 39.7], [-18.7, 39.7], [-8.2, 28], [-5.4, 28]]) {
      const post = BABYLON.MeshBuilder.CreateCylinder("outpost-post", { height: 2.4, diameter: 0.16, tessellation: 8 }, scene);
      post.position.set(x, 1.2, z); post.material = mat.bark;
    }
    box("harvest table top", { width: 4.2, height: 0.18, depth: 1.9 }, new BABYLON.Vector3(-20.7, 1.34, 40.5), mat.woodLight);
    box("outfitter counter top", { width: 2.8, height: 0.16, depth: 1.2 }, new BABYLON.Vector3(-6.8, 1.49, 27.5), mat.wood);
  }

  function makeInteractable(name, description, x, z, action, target) {
    interactables.push({ name, description, x, z, action, target });
  }

  function scatterEnvironment() {
    let placed = 0, attempts = 0;
    while (placed < 188 && attempts < 1600) {
      attempts++;
      const x = rand(-125, 125);
      const z = rand(-124, 125);
      if (flatArea(x, z)) continue;
      if (Math.hypot(x, z - 31) < 21) continue;
      if (Math.hypot((x - 55) / 1.3, (z + 44) / 0.8) < 27) continue;
      const roadX = 0.003 * z * z - 0.12 * z - 1;
      if (Math.abs(x - roadX) < 7 && z > 25 && z < 108) continue;
      const scale = rand(0.75, 1.45);
      const broadleaf = Math.random() > 0.72;
      createTree(x, z, scale, broadleaf);
      placed++;
    }
    for (let i = 0; i < 50; i++) {
      const x = rand(-115, 115), z = rand(-115, 120);
      if (flatArea(x, z) || (Math.hypot((x - 55) / 1.3, (z + 44) / 0.8) < 24)) continue;
      createRock(x, z, rand(0.45, 1.25));
    }
    // Dense ground cover and undergrowth are built after trees and rocks are placed.
  }

  function setupLighting() {
    const hemi = new BABYLON.HemisphericLight("sky-fill", new BABYLON.Vector3(0, 1, 0), scene);
    hemi.intensity = 0.78;
    hemi.groundColor = hex("#465541");
    hemi.diffuse = hex("#e5e8d6");
    const sun = new BABYLON.DirectionalLight("morning-sun", new BABYLON.Vector3(-0.38, -1, 0.24), scene);
    sun.position = new BABYLON.Vector3(65, 105, -70);
    sun.intensity = 1.35;
    sun.diffuse = hex("#ffe1b2");
    sun.specular = hex("#fff0d3");
    lights.hemi = hemi;
    lights.sun = sun;
    try {
      const shadows = new BABYLON.ShadowGenerator(1024, sun);
      shadows.useBlurExponentialShadowMap = true;
      shadows.blurKernel = 18;
      shadows.bias = 0.00045;
      shadows.normalBias = 0.025;
      shadows.darkness = 0.26;
      lights.shadows = shadows;
    } catch (error) {
      console.warn("Shadow map unavailable; continuing without shadows.", error);
    }
  }

  function createWeapon() {
    weaponRoot = new BABYLON.TransformNode("Ranger 308 first person model", scene);
    weaponRoot.parent = camera;
    weaponRoot.position.set(0.31, -0.37, 0.78);
    weaponRoot.scaling.set(0.82, 0.82, 0.82);
    const body = BABYLON.MeshBuilder.CreateBox("rifle-body", { width: 0.17, height: 0.19, depth: 0.9 }, scene);
    body.parent = weaponRoot;
    body.position.set(-0.06, 0, 0.18);
    body.material = mat.metal;
    body.isPickable = false;
    const stock = BABYLON.MeshBuilder.CreateBox("rifle-stock", { width: 0.22, height: 0.18, depth: 0.46 }, scene);
    stock.parent = weaponRoot;
    stock.position.set(-0.1, -0.035, -0.42);
    stock.material = mat.rifleWood;
    stock.isPickable = false;
    const barrel = BABYLON.MeshBuilder.CreateCylinder("rifle-barrel", { height: 0.92, diameter: 0.055, tessellation: 10 }, scene);
    barrel.parent = weaponRoot;
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(-0.035, 0.045, 0.78);
    barrel.material = mat.metal;
    barrel.isPickable = false;
    const muzzle = BABYLON.MeshBuilder.CreateCylinder("muzzle", { height: 0.14, diameter: 0.068, tessellation: 16 }, scene);
    muzzle.parent = weaponRoot;
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(-0.035, 0.045, 1.26);
    muzzle.material = mat.black;
    muzzle.isPickable = false;
    const scope = BABYLON.MeshBuilder.CreateCylinder("rifle-scope", { height: 0.44, diameter: 0.09, tessellation: 16 }, scene);
    scope.parent = weaponRoot;
    scope.rotation.x = Math.PI / 2;
    scope.position.set(-0.06, 0.15, 0.18);
    scope.material = mat.black;
    scope.isPickable = false;
    const scopeGlass = BABYLON.MeshBuilder.CreateCylinder("scope-glass", { height: 0.025, diameter: 0.09, tessellation: 12 }, scene);
    scopeGlass.parent = weaponRoot;
    scopeGlass.rotation.x = Math.PI / 2;
    scopeGlass.position.set(-0.06, 0.15, 0.41);
    scopeGlass.material = mat.water;
    scopeGlass.isPickable = false;
    const grip = BABYLON.MeshBuilder.CreateBox("rifle-grip", { width: 0.12, height: 0.32, depth: 0.16 }, scene);
    grip.parent = weaponRoot;
    grip.position.set(-0.06, -0.2, 0.03);
    grip.rotation.x = -0.24;
    grip.material = mat.rifleWood;
    grip.isPickable = false;
    const sight = BABYLON.MeshBuilder.CreateBox("front-sight", { width: 0.035, height: 0.1, depth: 0.04 }, scene);
    sight.parent = weaponRoot;
    sight.position.set(-0.035, 0.115, 0.92);
    sight.material = mat.gold;
    sight.isPickable = false;
    const scopeBands = [-0.19, 0.19].map((offset) => {
      const band = BABYLON.MeshBuilder.CreateTorus("scope mounting ring", { diameter: 0.145, thickness: 0.014, tessellation: 16 }, scene);
      band.parent = weaponRoot;
      band.rotation.x = Math.PI / 2;
      band.position.set(-0.06, 0.15, 0.18 + offset);
      band.material = mat.metal;
      band.isPickable = false;
      return band;
    });
    const bolt = BABYLON.MeshBuilder.CreateCylinder("rifle bolt", { height: 0.18, diameter: 0.045, tessellation: 8 }, scene);
    bolt.parent = weaponRoot;
    bolt.rotation.z = Math.PI / 2;
    bolt.position.set(0.04, 0.045, -0.03);
    bolt.material = mat.metal;
    bolt.isPickable = false;
    const magazine = BABYLON.MeshBuilder.CreateBox("rifle magazine", { width: 0.12, height: 0.29, depth: 0.19 }, scene);
    magazine.parent = weaponRoot;
    magazine.position.set(-0.045, -0.2, 0.18);
    magazine.material = mat.black;
    magazine.isPickable = false;
    const muzzleFlash = BABYLON.MeshBuilder.CreateSphere("muzzle-flash", { diameter: 0.3, segments: 6 }, scene);
    muzzleFlash.parent = weaponRoot;
    muzzleFlash.position.set(-0.035, 0.045, 1.42);
    muzzleFlash.material = makeMaterial("muzzle-flash-material", "#f6c875", 0.15);
    muzzleFlash.material.emissiveColor = hex("#f69b35");
    muzzleFlash.isPickable = false;
    muzzleFlash.setEnabled(false);
    weaponMaterials.flash = muzzleFlash;
    weaponRoot.setEnabled(true);
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

  function createDeer(id, species, x, z) {
    const info = speciesInfo[species];
    const root = new BABYLON.TransformNode("wildlife-" + id, scene);
    root.metadata = { animalId: id };
    root.position.set(x, heightAt(x, z), z);
    const coat = species === "buck" ? mat.deerDark : mat.deer;
    const lightCoat = species === "buck" ? mat.deerLight : mat.fawn;
    const body = BABYLON.MeshBuilder.CreateSphere("deer-body", { diameter: 1, segments: 10 }, scene);
    body.scaling.set(0.62, 0.55, 1.12);
    body.position.y = 1.3;
    makeAnimalPart(root, body, coat, "body");
    const rump = BABYLON.MeshBuilder.CreateSphere("deer-rump", { diameter: 1, segments: 9 }, scene);
    rump.scaling.set(0.56, 0.55, 0.5);
    rump.position.set(0, 1.35, -0.65);
    makeAnimalPart(root, rump, lightCoat, "body");
    const neck = BABYLON.MeshBuilder.CreateSphere("deer-neck", { diameter: 1, segments: 9 }, scene);
    neck.scaling.set(0.3, 0.54, 0.38);
    neck.position.set(0, 1.58, 0.66);
    neck.rotation.x = -0.42;
    makeAnimalPart(root, neck, coat, "body");
    const chest = BABYLON.MeshBuilder.CreateSphere("deer-chest", { diameter: 1, segments: 8 }, scene);
    chest.scaling.set(0.34, 0.48, 0.3);
    chest.position.set(0, 1.12, 0.6);
    makeAnimalPart(root, chest, mat.white, "body");
    const head = BABYLON.MeshBuilder.CreateSphere("deer-head", { diameter: 1, segments: 10 }, scene);
    head.scaling.set(0.28, 0.29, 0.38);
    head.position.set(0, 1.94, 0.91);
    makeAnimalPart(root, head, lightCoat, "head");
    const muzzle = BABYLON.MeshBuilder.CreateSphere("deer-muzzle", { diameter: 1, segments: 8 }, scene);
    muzzle.scaling.set(0.19, 0.13, 0.22);
    muzzle.position.set(0, 1.82, 1.21);
    makeAnimalPart(root, muzzle, mat.white, "head");
    makeEye(root, -0.17, 1.99, 0.94, -1);
    makeEye(root, 0.17, 1.99, 0.94, 1);

    for (const side of [-1, 1]) {
      const ear = BABYLON.MeshBuilder.CreateSphere("deer-ear", { diameter: 1, segments: 7 }, scene);
      ear.scaling.set(0.09, 0.075, 0.22);
      ear.position.set(side * 0.25, 2.02, 0.78);
      ear.rotation.y = side * 0.45;
      makeAnimalPart(root, ear, mat.deerLight, "head");
    }

    const legs = [];
    for (const side of [-1, 1]) {
      for (const front of [true, false]) {
        const pivot = new BABYLON.TransformNode("deer-leg-pivot", scene);
        pivot.parent = root;
        pivot.position.set(side * 0.22, 0.94, front ? 0.48 : -0.58);
        const upper = BABYLON.MeshBuilder.CreateCylinder("deer-leg", {
          height: 0.68, diameterTop: 0.11, diameterBottom: 0.085, tessellation: 6
        }, scene);
        upper.position.y = -0.34;
        makeAnimalPart(pivot, upper, coat, "body");
        const hoof = BABYLON.MeshBuilder.CreateCylinder("deer-hoof", { height: 0.13, diameter: 0.13, tessellation: 6 }, scene);
        hoof.position.y = -0.7;
        makeAnimalPart(pivot, hoof, mat.hoof, "body");
        legs.push(pivot);
      }
    }
    const tail = BABYLON.MeshBuilder.CreateSphere("deer-tail", { diameter: 0.23, segments: 7 }, scene);
    tail.scaling.set(0.75, 0.8, 1.2);
    tail.position.set(0, 1.3, -1.18);
    makeAnimalPart(root, tail, mat.white, "body");

    if (species === "buck") {
      for (const side of [-1, 1]) {
        const antlerBase = new BABYLON.Vector3(side * 0.1, 2.16, 0.88);
        const branchA = new BABYLON.Vector3(side * 0.28, 2.48, 0.83);
        const branchB = new BABYLON.Vector3(side * 0.42, 2.72, 0.78);
        const branchC = new BABYLON.Vector3(side * 0.18, 2.69, 0.81);
        const branchD = new BABYLON.Vector3(side * 0.55, 2.5, 0.78);
        const antler = BABYLON.MeshBuilder.CreateTube("buck-antler", {
          path: [antlerBase, branchA, branchB], radius: 0.045, tessellation: 5
        }, scene);
        makeAnimalPart(root, antler, mat.antler, "head");
        const tine1 = BABYLON.MeshBuilder.CreateTube("antler-tine", {
          path: [branchA, branchC], radius: 0.035, tessellation: 5
        }, scene);
        makeAnimalPart(root, tine1, mat.antler, "head");
        const tine2 = BABYLON.MeshBuilder.CreateTube("antler-tine", {
          path: [branchA, branchD], radius: 0.035, tessellation: 5
        }, scene);
        makeAnimalPart(root, tine2, mat.antler, "head");
      }
    }

    const animal = {
      id, species, info, root, legs, health: info.health, maxHealth: info.health,
      state: "graze", target: null, speed: 0, dead: false, harvested: false,
      hitCount: 0, cleanKill: false, lastShotDistance: 0,
      alertUntil: 0, lastTrack: 0, lastAnim: rand(0, 6),
      spawn: { x, z }, respawnAt: 0, name: info.label
    };
    animals.push(animal);
    return animal;
  }

  function createBoar(id, x, z) {
    const info = speciesInfo.boar;
    const root = new BABYLON.TransformNode("wildlife-" + id, scene);
    root.metadata = { animalId: id };
    root.position.set(x, heightAt(x, z), z);
    const body = BABYLON.MeshBuilder.CreateSphere("boar-body", { diameter: 1, segments: 10 }, scene);
    body.scaling.set(0.73, 0.7, 1.05);
    body.position.y = 0.95;
    makeAnimalPart(root, body, mat.boar, "body");
    const head = BABYLON.MeshBuilder.CreateSphere("boar-head", { diameter: 1, segments: 9 }, scene);
    head.scaling.set(0.47, 0.43, 0.5);
    head.position.set(0, 1.1, 0.83);
    makeAnimalPart(root, head, mat.boarLight, "head");
    const snout = BABYLON.MeshBuilder.CreateSphere("boar-snout", { diameter: 1, segments: 8 }, scene);
    snout.scaling.set(0.28, 0.22, 0.24);
    snout.position.set(0, 0.98, 1.21);
    makeAnimalPart(root, snout, mat.boar, "head");
    makeEye(root, -0.27, 1.25, 0.94, -1);
    makeEye(root, 0.27, 1.25, 0.94, 1);
    for (const side of [-1, 1]) {
      const ear = BABYLON.MeshBuilder.CreateSphere("boar-ear", { diameter: 1, segments: 7 }, scene);
      ear.scaling.set(0.15, 0.22, 0.12);
      ear.position.set(side * 0.31, 1.48, 0.72);
      makeAnimalPart(root, ear, mat.boar, "head");
      const tusk = BABYLON.MeshBuilder.CreateCylinder("boar-tusk", { height: 0.27, diameterTop: 0.01, diameterBottom: 0.09, tessellation: 6 }, scene);
      tusk.position.set(side * 0.22, 0.84, 1.2);
      tusk.rotation.x = -0.2;
      makeAnimalPart(root, tusk, mat.boarTusks, "head");
    }
    const legs = [];
    for (const side of [-1, 1]) for (const front of [true, false]) {
      const pivot = new BABYLON.TransformNode("boar-leg-pivot", scene);
      pivot.parent = root;
      pivot.position.set(side * 0.34, 0.62, front ? 0.54 : -0.55);
      const leg = BABYLON.MeshBuilder.CreateCylinder("boar-leg", { height: 0.55, diameter: 0.18, tessellation: 6 }, scene);
      leg.position.y = -0.27;
      makeAnimalPart(pivot, leg, mat.boar, "body");
      legs.push(pivot);
    }
    const animal = {
      id, species: "boar", info, root, legs, health: info.health, maxHealth: info.health,
      state: "graze", target: null, speed: 0, dead: false, harvested: false,
      hitCount: 0, cleanKill: false, lastShotDistance: 0,
      alertUntil: 0, lastTrack: 0, lastAnim: rand(0, 6),
      spawn: { x, z }, respawnAt: 0, name: info.label, attackCooldown: 0
    };
    animals.push(animal);
    return animal;
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
    if (footprints.length > 280) {
      const old = footprints.shift();
      old.mesh.dispose();
    }
  }

  function updateTracking() {
    $("tracker-status").textContent = tracking ? "ACTIVE" : "OFF";
    $("tracker-status").classList.toggle("active", tracking);
    $("tracking-banner").classList.toggle("show", tracking);
    $("tracking-panel").classList.toggle("tracking-active", tracking);
    for (const track of footprints) track.mesh.setEnabled(tracking);
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
    return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(degrees / 45) % 8];
  }

  function createSkyDome() {
    try {
      const environment = new BABYLON.HDRCubeTexture(
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
      const skybox = scene.createDefaultSkybox(environment, true, 1200, 0.02, false);
      if (skybox) {
        skybox.infiniteDistance = true;
        skybox.isPickable = false;
        skybox.applyFog = false;
      }
      lights.environment = environment;
      lights.sky = skybox;
      lights.skyMaterial = skybox ? skybox.material : null;
      skySun = null;
    } catch (error) {
      console.warn("Forest HDR environment unavailable; using the scene fallback colour.", error);
      scene.clearColor = new BABYLON.Color4(0.54, 0.67, 0.72, 1);
    }
  }

  function setupPostProcessing() {
    try {
      if (!BABYLON.DefaultRenderingPipeline) return;
      const pipeline = new BABYLON.DefaultRenderingPipeline("Wildrange cinematic pipeline", true, scene, [camera]);
      pipeline.fxaaEnabled = true;
      pipeline.bloomEnabled = true;
      pipeline.bloomThreshold = 0.88;
      pipeline.bloomWeight = 0.14;
      pipeline.bloomKernel = 64;
      pipeline.imageProcessingEnabled = true;
      pipeline.imageProcessing.exposure = 1.06;
      pipeline.imageProcessing.contrast = 1.16;
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
    while (placed < 820 && attempts < 2900) {
      attempts++;
      const x = rand(-132, 132), z = rand(-132, 132);
      if (flatArea(x, z) || Math.hypot(x, z - 31) < 24) continue;
      if (Math.hypot((x - 55) / 1.3, (z + 44) / 0.8) < 25) continue;
      const roadX = 0.003 * z * z - 0.12 * z - 1;
      if (Math.abs(x - roadX) < 5.2 && z > 25 && z < 108) continue;
      if (obstacles.some((item) => Math.hypot(x - item.x, z - item.z) < item.radius + 1.6)) continue;
      const y = heightAt(x, z) + 0.06;
      const shade = rand(0.82, 1.13);
      for (let blade = 0; blade < 3; blade++) {
        const angle = rand(0, Math.PI * 2);
        const half = rand(0.025, 0.065);
        const height = rand(0.18, 0.5);
        const lean = rand(0.015, 0.12);
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
      if (flatArea(x, z) || Math.hypot(x, z - 31) < 24) continue;
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

  function createScene() {
    scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.67, 0.79, 0.82, 1);
    scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    scene.fogDensity = 0.0027;
    scene.fogColor = hex("#b5c5ae");
    scene.collisionsEnabled = false;
    createMaterials();
    setupLighting();
    createSkyDome();
    makeTerrain();
    buildTrail();
    createPinecrestLake();
    scatterEnvironment();
    createGroundCover();
    scatterUndergrowth();
    createCabin();
    createWildlife();

    const spawnX = Number.isFinite(state.x) ? state.x : 0;
    const spawnZ = Number.isFinite(state.z) ? state.z : 19;
    camera = new BABYLON.UniversalCamera("field camera", new BABYLON.Vector3(spawnX, heightAt(spawnX, spawnZ) + 1.72, spawnZ), scene);
    camera.rotation.y = Number(state.yaw) || 0;
    camera.minZ = 0.08;
    camera.maxZ = 240;
    camera.fov = 1.04;
    camera.inertia = 0.08;
    camera.angularSensibility = 2400;
    camera.speed = 0;
    camera.attachControl(canvas, true);
    try { camera.inputs.removeByType("FreeCameraKeyboardMoveInput"); } catch (error) { /* no keyboard-driven camera translation */ }
    createWeapon();
    setupPostProcessing();
    miniMapCtx = $("mini-map").getContext("2d");
    worldMapCtx = $("world-map").getContext("2d");
    drawWorldMap();
    updateHud();
    engine.runRenderLoop(() => {
      if (!scene) return;
      const dt = Math.min(engine.getDeltaTime() / 1000, 0.05);
      if (gameStarted && !paused) updateGame(dt);
      scene.render();
    });
  }

  function updateGame(dt) {
    const now = performance.now();
    updatePlayer(dt);
    updateAnimals(dt, now);
    updateInteraction();
    animateWeapon(dt);
    animateWorld(now);
    updateDayCycle(dt);
    if (now - hudTimer > 180) {
      const expiredTracks = footprints.filter((track) => now - track.createdAt > 75000);
      if (expiredTracks.length) {
        const expiredSet = new Set(expiredTracks);
        expiredTracks.forEach((track) => track.mesh.dispose());
        footprints = footprints.filter((track) => !expiredSet.has(track));
      }
      updateHud();
      updateTracking();
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

  function updatePlayer(dt) {
    const forwardInput = (keys.has("w") || keys.has("arrowup") || touchKeys.has("up") ? 1 : 0) -
      (keys.has("s") || keys.has("arrowdown") || touchKeys.has("down") ? 1 : 0);
    const rightInput = (keys.has("d") || keys.has("arrowright") || touchKeys.has("right") ? 1 : 0) -
      (keys.has("a") || keys.has("arrowleft") || touchKeys.has("left") ? 1 : 0);
    const moving = forwardInput !== 0 || rightInput !== 0;
    const sprinting = !crouched && (keys.has("shift") || touchKeys.has("sprint")) && state.stamina > 1 && moving;
    playerMoving = moving;
    playerSprinting = sprinting;
    const speed = crouched ? 2.8 : sprinting ? 10.5 : 6.2;
    let forward = camera.getDirection(BABYLON.Axis.Z);
    forward.y = 0;
    forward.normalize();
    const right = BABYLON.Vector3.Cross(BABYLON.Axis.Y, forward).normalize();
    let direction = forward.scale(forwardInput).add(right.scale(rightInput));
    if (direction.lengthSquared() > 1) direction.normalize();
    if (moving) {
      if (sprinting) state.stamina = Math.max(0, state.stamina - 27 * dt);
      else state.stamina = Math.min(100, state.stamina + 16 * dt);
    } else state.stamina = Math.min(100, state.stamina + 22 * dt);
    if (direction.lengthSquared() > 0.001) {
      const step = direction.scale(speed * dt);
      const nextX = camera.position.x + step.x;
      const nextZ = camera.position.z + step.z;
      if (canStandAt(nextX, nextZ)) {
        camera.position.x = nextX;
        camera.position.z = nextZ;
      }
    }
    camera.position.x = clamp(camera.position.x, -WORLD_LIMIT, WORLD_LIMIT);
    camera.position.z = clamp(camera.position.z, -WORLD_LIMIT, WORLD_LIMIT);
    const ground = heightAt(camera.position.x, camera.position.z);
    const eyeHeight = crouched ? 1.12 : 1.72;
    camera.position.y += (ground + eyeHeight - camera.position.y) * Math.min(1, dt * 8);
    if (weaponRoot) weaponRoot.position.y = (aiming ? -0.24 : -0.34) - (moving ? Math.abs(Math.sin(performance.now() * (sprinting ? 0.014 : 0.01))) * 0.012 : 0);
  }

  function canStandAt(x, z) {
    if (Math.hypot((x - 55) / 1.3, (z + 44) / 0.8) < 20.5) return false;
    for (const item of obstacles) {
      if (Math.hypot(x - item.x, z - item.z) < item.radius + 0.48) return false;
    }
    if (Math.abs(x + 14) < 6.5 && Math.abs(z - 43) < 5.1) return false;
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
    for (const animal of animals) {
      if (animal.harvested) {
        if (now >= animal.respawnAt) respawnAnimal(animal);
        continue;
      }
      if (animal.dead) continue;
      const p = { x: camera.position.x, z: camera.position.z };
      const a = { x: animal.root.position.x, z: animal.root.position.z };
      const playerDistance = distance2D(p, a);
      const baseSense = animal.species === "boar" ? 15 : animal.species === "buck" ? 23 : 20;
      const movementNoise = crouched ? 0.36 : playerSprinting ? 1.42 : playerMoving ? 1 : 0.68;
      const scentFactor = performance.now() < scentActiveUntil ? 0.62 : 1;
      const detectionRadius = baseSense * movementNoise * scentFactor;
      if (playerDistance < detectionRadius || (shotAt > 0 && Date.now() - shotAt < 9000 && playerDistance < 65)) {
        animal.state = "flee";
        animal.alertUntil = now + 8500;
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
          state.cash = Math.max(0, state.cash - 15);
          announce("You were knocked out and escorted back to Pinecrest Outpost. $15 lost.", 4200);
        }
      }
      if (animal.state === "flee") {
        if (playerDistance > 72 && now > animal.alertUntil) {
          animal.state = "graze";
          pickWanderTarget(animal);
        } else {
          let dx = a.x - p.x;
          let dz = a.z - p.z;
          const length = Math.max(0.001, Math.hypot(dx, dz));
          dx /= length; dz /= length;
          animal.target = {
            x: clamp(a.x + dx * 25 + rand(-5, 5), -WORLD_LIMIT + 5, WORLD_LIMIT - 5),
            z: clamp(a.z + dz * 25 + rand(-5, 5), -WORLD_LIMIT + 5, WORLD_LIMIT - 5)
          };
          moveAnimal(animal, dt, animal.species === "boar" ? 8.5 : 10.5);
        }
      } else if (animal.target) {
        const d = Math.hypot(animal.target.x - a.x, animal.target.z - a.z);
        if (d < 1.5) {
          animal.target = null;
          animal.state = "graze";
          animal.pauseUntil = now + rand(1500, 4200);
        } else if (now > (animal.pauseUntil || 0)) {
          moveAnimal(animal, dt, animal.species === "boar" ? 1.7 : 2.25);
        }
      } else if (now > (animal.pauseUntil || 0)) {
        pickWanderTarget(animal);
        animal.state = "walk";
      }
      animal.root.position.y = heightAt(animal.root.position.x, animal.root.position.z);
      if (now - animal.lastTrack > 3000 && animal.state !== "graze") {
        animal.lastTrack = now;
        addTrack(animal);
      }
      const gait = now * (animal.state === "flee" ? 0.018 : 0.009) + animal.lastAnim;
      animal.legs.forEach((leg, index) => { leg.rotation.x = Math.sin(gait + (index % 2) * Math.PI) * (animal.state === "graze" ? 0.03 : 0.32); });
      if (animal.state === "graze") {
        const bob = Math.sin(now * 0.0018 + animal.lastAnim) * 0.025;
        animal.root.position.y += bob;
      }
    }
  }

  function moveAnimal(animal, dt, speed) {
    if (!animal.target) return;
    const dx = animal.target.x - animal.root.position.x;
    const dz = animal.target.z - animal.root.position.z;
    const len = Math.max(0.001, Math.hypot(dx, dz));
    animal.root.position.x += dx / len * speed * dt;
    animal.root.position.z += dz / len * speed * dt;
    animal.root.rotation.y = Math.atan2(dx, dz);
    animal.speed = speed;
  }

  function respawnAnimal(animal) {
    animal.harvested = false;
    animal.dead = false;
    animal.health = animal.maxHealth;
    animal.root.position.set(animal.spawn.x, heightAt(animal.spawn.x, animal.spawn.z), animal.spawn.z);
    animal.root.rotation.set(0, rand(0, Math.PI * 2), 0);
    animal.root.setEnabled(true);
    animal.target = null;
    animal.state = "graze";
    animal.hitCount = 0;
    animal.cleanKill = false;
    animal.lastShotDistance = 0;
    animal.pauseUntil = performance.now() + rand(1000, 3000);
  }

  function animateWeapon(dt) {
    if (!weaponRoot) return;
    weaponKick = Math.max(0, weaponKick - dt * 1.8);
    weaponRoot.position.z = (aiming ? 0.78 : 0.72) - weaponKick * 0.22;
    weaponRoot.position.x = aiming ? 0.13 : 0.36;
    if (muzzleTimer > 0) {
      muzzleTimer -= dt;
      if (weaponMaterials.flash) weaponMaterials.flash.setEnabled(muzzleTimer > 0);
    }
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
        animal.state = "flee";
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
          animal.state = "flee";
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
      $("reload-indicator").classList.remove("show");
      sound(480, 0.08, "triangle", 0.025);
      toast("Reloaded. " + state.ammo + " rounds ready.", "success");
      updateHud();
    }
  }

  function toggleAim(value) {
    aiming = value === undefined ? !aiming : value;
    $("game-shell").classList.toggle("aiming", aiming);
    if (camera) camera.fov = aiming ? 0.62 : 1.04;
    text("weapon-mode", aiming ? "AIMING · STEADY BREATH" : "SEMI-AUTOMATIC · IRON SIGHTS");
  }

  function toggleTracking() {
    tracking = !tracking;
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
    lights.hemi.intensity = 0.22 + daylight * 0.66;
    lights.sun.intensity = 0.08 + daylight * 1.28;
    const nightFog = hex("#354450"), dayFog = hex("#b6c4b4");
    const fog = BABYLON.Color3.Lerp(nightFog, dayFog, daylight);
    scene.fogColor.copyFrom(fog);
    scene.clearColor = new BABYLON.Color4(fog.r, fog.g, fog.b, 1);
    if (lights.skyMaterial) {
      const skyLight = BABYLON.Color3.Lerp(hex("#687887"), hex("#ffffff"), daylight);
      lights.skyMaterial.emissiveColor.copyFrom(skyLight);
    }
    const angle = dayTime * Math.PI * 2;
    lights.sun.direction = new BABYLON.Vector3(-Math.cos(angle), -Math.max(0.16, Math.sin(angle)), 0.28).normalize();
    if (camera) lights.sun.position.copyFrom(camera.position.add(new BABYLON.Vector3(Math.cos(angle) * 100, 120, Math.sin(angle) * 100)));
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
      engine = new BABYLON.Engine(canvas, true, { stencil: true, preserveDrawingBuffer: false, adaptToDeviceRatio: true });
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
  }

  function handleKeyUp(event) { keys.delete(event.key.toLowerCase()); }

  canvas.addEventListener("click", () => {
    if (!gameStarted || paused) return;
    if (!pointerLocked) requestPointerLock();
    else shoot();
  });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
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
  window.addEventListener("blur", () => { keys.clear(); touchKeys.clear(); firing = false; });

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
      engine = new BABYLON.Engine(canvas, true, { stencil: true, preserveDrawingBuffer: false, adaptToDeviceRatio: true });
      createScene();
      window.addEventListener("resize", () => engine.resize());
    } catch (error) {
      console.error("Wildrange could not initialise its 3D scene:", error);
      $("center-message").textContent = "3D setup failed. Refresh the page and check that WebGL is enabled.";
      $("center-message").classList.add("show");
    }
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
    webglEnabled: Boolean(engine && engine.getCaps && engine.getCaps().maxTextureSize > 0)
  });
  window.WildrangeFreezeRender = () => {
    if (engine) engine.stopRenderLoop();
  };

  window.addEventListener("beforeunload", () => saveGame(false));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) saveGame(false);
  });
  window.setInterval(updateReload, 40);
  boot();
})();