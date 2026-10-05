// PANN STATION v3 — PPSSPP UI Replica
// Developer: PANN

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ═══ STATE ═══
const state = {
  currentScreen: "home",
  library: JSON.parse(localStorage.getItem("pann_lib") || "[]"),
  recent: JSON.parse(localStorage.getItem("pann_recent") || "[]"),
  activeCheats: JSON.parse(localStorage.getItem("pann_cheats") || "[]"),
  settings: JSON.parse(localStorage.getItem("pann_set") || "null") || {
    backend: "webgl2", resolution: "2", frameskip: "2", filter: "linear",
    aniso: "4", vsync: true, showfps: true,
    audio: "auto", volume: 80, audioen: true, audiolowlatency: false,
    touch: true, vibrate: false, gamepad: true, layout: "default", analog: 5,
    lang: "id", autosave: false, slot: "1", memstick: "64",
    net: false, adhoc: "off", upnp: false,
  },
  emuReady: false,
  currentGame: null,
  paused: false,
  fps: 0,
};

// ═══ SPLASH ═══
const splashSteps = [
  "Initializing core...",
  "Loading PPSSPP-WASM...",
  "Setup graphics backend...",
  "Setup audio engine...",
  "Loading settings...",
  "Ready!",
];
let splashIdx = 0;
const splashTimer = setInterval(() => {
  splashIdx++;
  const pct = Math.min(100, (splashIdx / splashSteps.length) * 100);
  $(".splash-bar-fill").style.width = pct + "%";
  $("#splash-text").textContent = splashSteps[splashIdx - 1] || "Ready!";
  if (splashIdx >= splashSteps.length) {
    clearInterval(splashTimer);
    setTimeout(() => {
      $("#splash").classList.add("hide");
      $("#app").classList.add("show");
      setTimeout(() => { $("#splash").style.display = "none"; }, 500);
    }, 400);
  }
}, 350);

// ═══ SCREEN NAV ═══
function goScreen(name) {
  $$(".screen").forEach(s => s.classList.remove("active"));
  const screen = $(`#screen-${name}`);
  if (screen) screen.classList.add("active");
  state.currentScreen = name;

  // Update title
  const titles = {
    home: "PANN STATION",
    games: "Games",
    recent: "Recent",
    emulator: state.currentGame?.name || "Emulator",
    settings: "Settings",
    cheats: "Cheats",
    homebrew: "Homebrew",
    about: "About",
  };
  $("#topbar-title").textContent = titles[name] || "PANN STATION";

  // Back button show/hide
  $("#btn-back").style.visibility = name === "home" ? "hidden" : "visible";

  // Stop FPS kalau keluar emulator
  if (name !== "emulator") stopFpsCounter();
}

$("#btn-back").onclick = () => {
  if (state.currentScreen === "emulator") {
    exitGame();
  } else {
    goScreen("home");
  }
};

// Home tiles
$$(".home-tile").forEach(tile => {
  tile.onclick = () => goScreen(tile.dataset.screen);
});

// ═══ FLASH ═══
function flash(msg) {
  const el = document.createElement("div");
  el.className = "flash";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

// ═══ GAME LIBRARY ═══
let romInput = null;
function ensureRomInput() {
  if (romInput) return romInput;
  romInput = document.createElement("input");
  romInput.type = "file";
  romInput.accept = ".iso,.cso,.pbp,.chd";
  romInput.style.display = "none";
  romInput.onchange = (e) => {
    if (e.target.files[0]) addGame(e.target.files[0]);
  };
  document.body.appendChild(romInput);
  return romInput;
}

$("#btn-upload-iso").onclick = () => ensureRomInput().click();
$("#btn-add-url").onclick = () => $("#modal-url").classList.add("active");
$("#modal-cancel").onclick = () => $("#modal-url").classList.remove("active");
$("#modal-save").onclick = () => {
  const name = $("#url-name").value.trim();
  const url = $("#url-link").value.trim();
  if (!name || !url) return alert("Nama dan URL harus diisi");
  state.library.push({ name, url, type: "url", size: 0, icon: "🌐", added: Date.now() });
  saveLibrary();
  renderGames();
  $("#modal-url").classList.remove("active");
  $("#url-name").value = "";
  $("#url-link").value = "";
  flash("✅ Game ditambah");
};

function addGame(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (!["iso", "cso", "pbp", "chd"].includes(ext)) {
    alert("❌ Format harus .iso, .cso, .pbp, atau .chd");
    return;
  }
  const url = URL.createObjectURL(file);
  const game = {
    name: file.name,
    url,
    type: ext,
    size: file.size,
    icon: "🎮",
    added: Date.now(),
  };
  state.library.push(game);
  saveLibrary();
  renderGames();
  flash("✅ Game di-upload");
  // Auto-load
  loadGame(game);
}

function saveLibrary() {
  try { localStorage.setItem("pann_lib", JSON.stringify(state.library)); } catch (e) {}
}
function saveRecent() {
  try { localStorage.setItem("pann_recent", JSON.stringify(state.recent)); } catch (e) {}
}

function renderGames() {
  const grid = $("#game-grid");
  if (!state.library.length) {
    grid.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🎮</div>
      <div class="empty-title">Belum ada game</div>
      <div class="empty-desc">Upload ISO/CSO atau tambah dari URL</div>
    </div>`;
    return;
  }
  grid.innerHTML = "";
  state.library.forEach((g, i) => {
    const div = document.createElement("div");
    div.className = "game-card";
    div.innerHTML = `
      <div class="game-cover">${g.icon || "🎮"}</div>
      <div class="game-info">
        <div class="game-name">${g.name}</div>
        <div class="game-meta">${g.type?.toUpperCase()} · ${formatSize(g.size)}</div>
      </div>
      <button class="game-remove" data-idx="${i}">✕</button>
    `;
    div.onclick = (e) => {
      if (e.target.classList.contains("game-remove")) return;
      loadGame(g);
    };
    div.querySelector(".game-remove").onclick = (e) => {
      e.stopPropagation();
      state.library.splice(i, 1);
      saveLibrary();
      renderGames();
      flash("🗑 Dihapus");
    };
    grid.appendChild(div);
  });
}

function renderRecent() {
  const grid = $("#recent-grid");
  if (!state.recent.length) {
    grid.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🕐</div>
      <div class="empty-title">Belum ada history</div>
      <div class="empty-desc">Main game dulu</div>
    </div>`;
    return;
  }
  grid.innerHTML = "";
  state.recent.slice(0, 12).forEach((g, i) => {
    const div = document.createElement("div");
    div.className = "game-card";
    div.innerHTML = `
      <div class="game-cover">${g.icon || "🎮"}</div>
      <div class="game-info">
        <div class="game-name">${g.name}</div>
        <div class="game-meta">${formatTimeAgo(g.lastPlayed)}</div>
      </div>
    `;
    div.onclick = () => {
      const full = state.library.find(x => x.name === g.name);
      if (full) loadGame(full);
      else flash("⚠ File asli perlu upload ulang");
    };
    grid.appendChild(div);
  });
}

function addToRecent(game) {
  state.recent = state.recent.filter(g => g.name !== game.name);
  state.recent.unshift({
    name: game.name,
    icon: game.icon,
    lastPlayed: Date.now(),
  });
  if (state.recent.length > 20) state.recent.pop();
  saveRecent();
}

// ═══ EMULATOR ═══
function loadGame(game) {
  state.currentGame = game;
  $("#emu-placeholder").classList.add("hide");
  $("#emu-title").textContent = game.name;
  goScreen("emulator");

  // Konfigurasi EmulatorJS
  window.EJS_player = "#emu-view";
  window.EJS_core = "psp";
  window.EJS_gameUrl = game.url;
  window.EJS_pathtodata = "https://cdn.emulatorjs.org/stable/data/";
  window.EJS_startOnLoaded = true;
  window.EJS_language = "id-ID";
  window.EJS_defaultOptions = {
    "shader": "disabled",
    "frameskip": state.settings.frameskip,
    "resolution": state.settings.resolution + "x",
    "audio": state.settings.audioen,
    "vsync": state.settings.vsync,
  };
  window.EJS_ready = () => {
    state.emuReady = true;
    $("#home-status").textContent = "Running";
    setTimeout(applyCheats, 800);
    startFpsCounter();
  };

  // Destroy instance lama
  if (window.EJS_emulator?.destroy) {
    try { window.EJS_emulator.destroy(); } catch (e) {}
  }
  $("#emu-view").innerHTML = "";

  // Load
  if (typeof EJS_loadEmulator === "function") EJS_loadEmulator();
  else if (typeof EJS?.loadEmulator === "function") EJS.loadEmulator();
  else {
    const s = document.createElement("script");
    s.src = "https://cdn.emulatorjs.org/stable/data/loader.js";
    s.onload = () => {
      if (typeof EJS_loadEmulator === "function") EJS_loadEmulator();
      else if (typeof EJS?.loadEmulator === "function") EJS.loadEmulator();
    };
    document.head.appendChild(s);
  }

  addToRecent(game);
  // Show touch controls
  if (state.settings.touch) $("#touch-controls").classList.add("active");

  // FPS overlay
  $("#fps-overlay").style.display = state.settings.showfps ? "block" : "none";
}

function exitGame() {
  if (state.emuReady && !confirm("Keluar dari game? Progress yang belum di-save akan hilang.")) return;
  try { window.EJS_emulator?.destroy?.(); } catch (e) {}
  $("#emu-view").innerHTML = "";
  $("#emu-placeholder").classList.remove("hide");
  state.emuReady = false;
  state.currentGame = null;
  $("#home-status").textContent = "Ready";
  stopFpsCounter();
  goScreen("home");
}

// ═══ FPS COUNTER ═══
let fpsInterval = null;
function startFpsCounter() {
  if (fpsInterval) clearInterval(fpsInterval);
  let frames = 0;
  let last = performance.now();
  fpsInterval = setInterval(() => {
    frames++;
    const now = performance.now();
    if (now - last >= 1000) {
      state.fps = frames;
      $("#fps-value").textContent = frames;
      frames = 0; last = now;
    }
  }, 50);
}
function stopFpsCounter() {
  if (fpsInterval) { clearInterval(fpsInterval); fpsInterval = null; }
}

// ═══ EMU TOOLBAR ═══
$("#emu-back").onclick = exitGame;
$("#emu-pause").onclick = () => {
  if (!state.emuReady) return;
  state.paused = !state.paused;
  if (state.paused) window.EJS_emulator?.pause?.();
  else window.EJS_emulator?.play?.();
  $("#pause-menu").classList.toggle("active", state.paused);
};
$("#emu-save").onclick = () => {
  try {
    window.EJS_emulator?.gameManager?.saveState?.(state.settings.slot);
    flash(`💾 Save ke slot ${state.settings.slot}`);
  } catch (e) { flash("⚠ Save gagal"); }
};
$("#emu-load").onclick = () => {
  try {
    window.EJS_emulator?.gameManager?.loadState?.(state.settings.slot);
    flash(`📂 Load dari slot ${state.settings.slot}`);
  } catch (e) { flash("⚠ Load gagal"); }
};
$("#emu-fullscreen").onclick = () => {
  const el = $("#screen-emulator");
  if (!document.fullscreenElement) el.requestFullscreen?.();
  else document.exitFullscreen?.();
};

// Pause menu
$("#pause-resume").onclick = () => {
  state.paused = false;
  window.EJS_emulator?.play?.();
  $("#pause-menu").classList.remove("active");
};
$("#pause-savestate").onclick = () => $("#emu-save").click();
$("#pause-loadstate").onclick = () => $("#emu-load").click();
$("#pause-cheats").onclick = () => {
  $("#pause-menu").classList.remove("active");
  window.EJS_emulator?.pause?.();
  goScreen("cheats");
};
$("#pause-settings").onclick = () => {
  $("#pause-menu").classList.remove("active");
  window.EJS_emulator?.pause?.();
  goScreen("settings");
};
$("#pause-exit").onclick = () => {
  $("#pause-menu").classList.remove("active");
  state.paused = false;
  exitGame();
};

// Show overlay on touch
$("#screen-emulator").addEventListener("touchstart", () => {
  $("#screen-emulator").classList.add("touched");
  clearTimeout(window._touchTimeout);
  window._touchTimeout = setTimeout(() => {
    $("#screen-emulator").classList.remove("touched");
  }, 3000);
});

// ═══ TOUCH CONTROLS ═══
const KEYMAP = {
  up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight",
  cross: "x", circle: "c", square: "s", triangle: "v",
  l: "q", r: "e", start: "Enter", select: "Shift",
};

function sendKey(key, down) {
  const code = KEYMAP[key] || key;
  const evt = new KeyboardEvent(down ? "keydown" : "keyup", {
    key: code, code, bubbles: true, cancelable: true,
  });
  const target = $("#emu-view");
  target?.dispatchEvent(evt);
  document.dispatchEvent(evt);
}

$$(".dpad-btn, .face-btn, .shoulder-btn, .system-btn").forEach(btn => {
  const key = btn.dataset.key;
  const press = (e) => {
    e.preventDefault();
    btn.style.background = "var(--accent)";
    btn.style.color = "#05070d";
    sendKey(key, true);
    if (state.settings.vibrate && navigator.vibrate) navigator.vibrate(12);
  };
  const release = (e) => {
    e.preventDefault();
    btn.style.background = "";
    btn.style.color = "";
    sendKey(key, false);
  };
  btn.addEventListener("touchstart", press, { passive: false });
  btn.addEventListener("touchend", release, { passive: false });
  btn.addEventListener("touchcancel", release, { passive: false });
  btn.addEventListener("mousedown", press);
  btn.addEventListener("mouseup", release);
  btn.addEventListener("mouseleave", release);
});

// Analog stick drag
const analogStick = $("#analog-stick");
const analogBase = analogStick?.parentElement;
let analogActive = false;

if (analogBase) {
  const handleMove = (clientX, clientY) => {
    const rect = analogBase.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx, dy = clientY - cy;
    const maxR = rect.width / 2 - 12;
    const r = Math.hypot(dx, dy);
    if (r > maxR) { dx = dx / r * maxR; dy = dy / r * maxR; }
    analogStick.style.transform = `translate(${dx}px, ${dy}px)`;
    // Kirim ke emulator kalau support
    const sens = state.settings.analog / 5;
    window.EJS_emulator?.gameManager?.setAnalog?.(dx * sens, dy * sens);
  };

  const start = (e) => {
    analogActive = true;
    const t = e.touches?.[0] || e;
    handleMove(t.clientX, t.clientY);
  };
  const move = (e) => {
    if (!analogActive) return;
    e.preventDefault();
    const t = e.touches?.[0] || e;
    handleMove(t.clientX, t.clientY);
  };
  const end = () => {
    analogActive = false;
    analogStick.style.transform = "";
    window.EJS_emulator?.gameManager?.setAnalog?.(0, 0);
  };

  analogBase.addEventListener("touchstart", start, { passive: false });
  analogBase.addEventListener("touchmove", move, { passive: false });
  analogBase.addEventListener("touchend", end);
  analogBase.addEventListener("mousedown", start);
  document.addEventListener("mousemove", move);
  document.addEventListener("mouseup", end);
}

// ═══ CHEATS ═══
const QUICK_CHEATS = [
  { id: "money", icon: "💰", name: "Infinite Money", desc: "Currency max" },
  { id: "hp", icon: "❤️", name: "God Mode HP", desc: "HP tidak berkurang" },
  { id: "mp", icon: "🔮", name: "Infinite MP", desc: "MP unlimited" },
  { id: "level", icon: "⭐", name: "Max Level", desc: "Level max" },
  { id: "exp", icon: "📈", name: "Max EXP", desc: "EXP cepat naik" },
  { id: "item", icon: "🎁", name: "Infinite Item", desc: "Item tidak habis" },
  { id: "speed", icon: "🏃", name: "Speed Hack", desc: "Gerak x3" },
  { id: "walk", icon: "🚪", name: "Walk Through Walls", desc: "Tembus dinding" },
];

function renderCheats() {
  const grid = $("#cheat-grid");
  grid.innerHTML = "";
  QUICK_CHEATS.forEach(c => {
    const isActive = state.activeCheats.find(x => x.name === c.name);
    const div = document.createElement("div");
    div.className = "cheat-item" + (isActive ? " active" : "");
    div.innerHTML = `
      <span class="cheat-icon">${c.icon}</span>
      <div class="cheat-name">${c.name}</div>
      <div class="cheat-desc">${c.desc}</div>
    `;
    div.onclick = () => toggleCheat(c);
    grid.appendChild(div);
  });
}

function toggleCheat(c) {
  const idx = state.activeCheats.findIndex(x => x.name === c.name);
  if (idx >= 0) {
    state.activeCheats.splice(idx, 1);
    flash("❌ " + c.name);
  } else {
    state.activeCheats.push({
      name: c.name, icon: c.icon,
      code: generateCheatCode(c.id),
    });
    flash("✅ " + c.name);
  }
  saveCheats();
  renderCheats();
  renderActiveCheats();
  applyCheats();
}

function generateCheatCode(id) {
  const t = {
    money: "_C0 Infinite Money\n_L 0x20243C38 0x000F423F",
    hp: "_C0 God Mode HP\n_L 0x20243D00 0x000003E7",
    mp: "_C0 Infinite MP\n_L 0x20243D10 0x000003E7",
    level: "_C0 Max Level\n_L 0x20243D20 0x00000063",
    exp: "_C0 Max EXP\n_L 0x20243D30 0x3B9AC9FF",
    item: "_C0 Infinite Item\n_L 0x20243D40 0x00000063",
    speed: "_C0 Speed Hack\n_L 0x20243D50 0x40000000",
    walk: "_C0 Walk Through Walls\n_L 0x20243D60 0x00000000",
  };
  return t[id] || "";
}

function applyCheats() {
  const emu = window.EJS_emulator;
  if (!emu?.gameManager) return;
  try {
    const cheats = state.activeCheats.map(c => ({
      name: c.name, code: c.code, type: "cheat",
    }));
    if (typeof emu.gameManager.setCheats === "function") {
      emu.gameManager.setCheats(cheats);
    } else if (typeof emu.gameManager.setCheat === "function") {
      cheats.forEach(c => emu.gameManager.setCheat(c.code));
    }
  } catch (e) {}
}

function saveCheats() {
  try { localStorage.setItem("pann_cheats", JSON.stringify(state.activeCheats)); } catch (e) {}
}

function renderActiveCheats() {
  const list = $("#cheat-active-list");
  if (!state.activeCheats.length) {
    list.innerHTML = `<div class="empty-state">Belum ada cheat aktif.</div>`;
    return;
  }
  list.innerHTML = "";
  state.activeCheats.forEach((c, i) => {
    const div = document.createElement("div");
    div.className = "active-cheat";
    div.innerHTML = `
      <div class="active-cheat-icon">${c.icon || "📝"}</div>
      <div class="active-cheat-info">
        <div class="active-cheat-name">${c.name}</div>
        <div class="active-cheat-code">${c.code?.split("\\n")[0] || ""}</div>
      </div>
      <button class="active-cheat-remove" data-idx="${i}">✕</button>
    `;
    div.querySelector(".active-cheat-remove").onclick = () => {
      state.activeCheats.splice(i, 1);
      saveCheats();
      renderCheats();
      renderActiveCheats();
      applyCheats();
    };
    list.appendChild(div);
  });
}

$("#btn-add-cheat").onclick = () => {
  const name = $("#cheat-name").value.trim();
  const code = $("#cheat-code").value.trim();
  if (!name || !code) return alert("❌ Isi nama dan kode");
  state.activeCheats.push({ name, icon: "📝", code });
  saveCheats();
  $("#cheat-name").value = "";
  $("#cheat-code").value = "";
  renderCheats();
  renderActiveCheats();
  applyCheats();
  flash("✅ Cheat ditambah");
};

$("#cheat-upload").onclick = () => $("#cheat-input").click();
$("#cheat-input").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  const cheats = parseCWCheat(text, file.name);
  if (!cheats.length) return alert("❌ Tidak ada cheat valid");
  cheats.forEach(c => state.activeCheats.push(c));
  saveCheats();
  renderCheats();
  renderActiveCheats();
  applyCheats();
  flash(`✅ ${cheats.length} cheat di-import`);
};

function parseCWCheat(text, filename) {
  const cheats = [];
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith("_C0")) {
      if (current) cheats.push(current);
      current = { name: t.substring(3).trim() || filename, icon: "📝", code: "" };
    } else if (t.startsWith("_L") && current) {
      current.code += (current.code ? "\n" : "") + t;
    }
  }
  if (current) cheats.push(current);
  return cheats.filter(c => c.code.length > 0);
}

// Cheat tabs
$$(".cheat-tab").forEach(tab => {
  tab.onclick = () => {
    $$(".cheat-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    $$(".cheat-panel").forEach(p => p.classList.remove("active"));
    $(`#cheat-${tab.dataset.cheatTab}`)?.classList.add("active");
  };
});

// ═══ SETTINGS ═══
$$(".set-tab").forEach(tab => {
  tab.onclick = () => {
    $$(".set-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    $$(".set-panel").forEach(p => p.classList.remove("active"));
    $(`#set-${tab.dataset.set}`)?.classList.add("active");
  };
});

// Volume slider
$("#set-volume").oninput = (e) => {
  $("#set-volume-val").textContent = e.target.value + "%";
};
$("#set-analog").oninput = (e) => {
  $("#set-analog-val").textContent = e.target.value;
};

// Save settings
$("#btn-save-settings").onclick = () => {
  state.settings = {
    backend: $("#set-backend").value,
    resolution: $("#set-res").value,
    frameskip: $("#set-frameskip").value,
    filter: $("#set-filter").value,
    aniso: $("#set-aniso").value,
    vsync: $("#set-vsync").checked,
    showfps: $("#set-showfps").checked,
    audio: $("#set-audiobackend").value,
    volume: +$("#set-volume").value,
    audioen: $("#set-audioen").checked,
    audiolowlatency: $("#set-audiolowlatency").checked,
    touch: $("#set-touch").checked,
    vibrate: $("#set-vibrate").checked,
    gamepad: $("#set-gamepad").checked,
    layout: $("#set-layout").value,
    analog: +$("#set-analog").value,
    lang: $("#set-lang").value,
    autosave: $("#set-autosave").checked,
    slot: $("#set-slot").value,
    memstick: $("#set-memstick").value,
    net: $("#set-net").checked,
    adhoc: $("#set-adhoc").value,
    upnp: $("#set-upnp").checked,
  };
  localStorage.setItem("pann_set", JSON.stringify(state.settings));
  flash("💾 Settings disimpan");
  // Apply touch toggle
  $("#touch-controls").classList.toggle("active", state.settings.touch);
  $("#fps-overlay").style.display = state.settings.showfps ? "block" : "none";
};

function loadSettingsToUI() {
  const s = state.settings;
  $("#set-backend").value = s.backend;
  $("#set-res").value = s.resolution;
  $("#set-frameskip").value = s.frameskip;
  $("#set-filter").value = s.filter;
  $("#set-aniso").value = s.aniso;
  $("#set-vsync").checked = s.vsync;
  $("#set-showfps").checked = s.showfps;
  $("#set-audiobackend").value = s.audio;
  $("#set-volume").value = s.volume;
  $("#set-volume-val").textContent = s.volume + "%";
  $("#set-audioen").checked = s.audioen;
  $("#set-audiolowlatency").checked = s.audiolowlatency;
  $("#set-touch").checked = s.touch;
  $("#set-vibrate").checked = s.vibrate;
  $("#set-gamepad").checked = s.gamepad;
  $("#set-layout").value = s.layout;
  $("#set-analog").value = s.analog;
  $("#set-analog-val").textContent = s.analog;
  $("#set-lang").value = s.lang;
  $("#set-autosave").checked = s.autosave;
  $("#set-slot").value = s.slot;
  $("#set-memstick").value = s.memstick;
  $("#set-net").checked = s.net;
  $("#set-adhoc").value = s.adhoc;
  $("#set-upnp").checked = s.upnp;
}

// ═══ HOMEBREW (contoh list game gratis legal) ═══
const HOMEBREW_GAMES = [
  { name: "Cave Story", icon: "🕹️", desc: "Platformer klasik", url: "" },
  { name: "Doom PSP", icon: "🔥", desc: "FPS klasik", url: "" },
  { name: "Quake PSP", icon: "⚔️", desc: "FPS klasik", url: "" },
  { name: "Wagic", icon: "🃏", desc: "Card game", url: "" },
  { name: "PSP Revolution", icon: "🎵", desc: "Rhythm game", url: "" },
  { name: "OpenTyrian", icon: "🚀", desc: "Shoot 'em up", url: "" },
];

function renderHomebrew() {
  const grid = $("#homebrew-grid");
  grid.innerHTML = "";
  HOMEBREW_GAMES.forEach(g => {
    const div = document.createElement("div");
    div.className = "game-card";
    div.innerHTML = `
      <div class="game-cover">${g.icon}</div>
      <div class="game-info">
        <div class="game-name">${g.name}</div>
        <div class="game-meta">${g.desc}</div>
      </div>
    `;
    div.onclick = () => {
      if (!g.url) {
        flash("⚠ Cari file homebrew dulu di internet");
        return;
      }
      loadGame({ name: g.name, url: g.url, icon: g.icon });
    };
    grid.appendChild(div);
  });
}

// ═══ HELPERS ═══
function formatSize(bytes) {
  if (!bytes) return "URL";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  while (bytes >= 1024 && i < u.length - 1) { bytes /= 1024; i++; }
  return bytes.toFixed(1) + " " + u[i];
}

function formatTimeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "Baru saja";
  if (s < 3600) return Math.floor(s / 60) + " menit lalu";
  if (s < 86400) return Math.floor(s / 3600) + " jam lalu";
  return Math.floor(s / 86400) + " hari lalu";
}

// ═══ INIT ═══
renderGames();
renderRecent();
renderCheats();
renderActiveCheats();
renderHomebrew();
loadSettingsToUI();
goScreen("home");
console.log("[PANN STATION v3] Ready");