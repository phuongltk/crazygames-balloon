(() => {
  "use strict";

  // ---------- CrazyGames SDK (optional, safe if absent) ----------
  const CG =
    window.CrazyGames && window.CrazyGames.SDK ? window.CrazyGames.SDK : null;

  // The SDK can throw synchronously just from accessing a namespace/method
  // (e.g. "sdkDisabled" when running outside the CrazyGames platform, such
  // as local file:// testing), so both the property access and the call
  // must happen inside the try — every SDK interaction goes through this.
  function cg(fn) {
    try {
      fn();
    } catch {
      // ignore — SDK integration is optional
    }
  }

  cg(() => {
    if (CG && CG.init) CG.init().catch(() => {});
  });

  // ---------- Persistence ----------
  const STORAGE = {
    highscore: "balloonPop_highscore",
    coins: "balloonPop_coins",
    owned: "balloonPop_owned",
  };

  const loadNum = (key, fallback = 0) => {
    const v = parseInt(localStorage.getItem(key), 10);
    return Number.isFinite(v) ? v : fallback;
  };
  const loadOwned = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE.owned)) || {};
    } catch {
      return {};
    }
  };

  let highscore = loadNum(STORAGE.highscore, 0);
  let coins = loadNum(STORAGE.coins, 0);
  let owned = loadOwned();

  const saveHighscore = () =>
    localStorage.setItem(STORAGE.highscore, String(highscore));
  const saveCoins = () => localStorage.setItem(STORAGE.coins, String(coins));
  const saveOwned = () =>
    localStorage.setItem(STORAGE.owned, JSON.stringify(owned));

  const hasRemoveAds = () => !!owned.removeAds;

  // ---------- Shop ----------
  const SHOP_ITEMS = [
    {
      id: "removeAds",
      name: "Remove Ads",
      desc: "No more ad breaks between games. One-time purchase.",
      cost: 500,
      oneTime: true,
    },
    {
      id: "goldenSkin",
      name: "Golden Balloons",
      desc: "Unlock a shiny gold balloon skin.",
      cost: 150,
      oneTime: true,
    },
  ];

  function renderShop() {
    shopCoinsEl.textContent = coins;
    menuCoinsEl.textContent = coins;
    shopListEl.innerHTML = "";
    for (const item of SHOP_ITEMS) {
      const isOwned = !!owned[item.id];
      const row = document.createElement("div");
      row.className = "shop-item";
      row.innerHTML = `
        <div class="shop-item-info">
          <div class="shop-item-name">${item.name}</div>
          <div class="shop-item-desc">${item.desc}</div>
        </div>
        <button class="shop-item-btn ${isOwned ? "owned" : ""}" ${isOwned ? "disabled" : ""}>
          ${isOwned ? "Owned" : item.cost + " 🪙"}
        </button>
      `;
      const btn = row.querySelector("button");
      if (!isOwned) {
        btn.disabled = coins < item.cost;
        btn.addEventListener("click", () => {
          if (coins < item.cost) return;
          coins -= item.cost;
          owned[item.id] = true;
          saveCoins();
          saveOwned();
          renderShop();
        });
      }
      shopListEl.appendChild(row);
    }
  }

  // ---------- DOM ----------
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const hudEl = document.getElementById("hud");
  const scoreValueEl = document.getElementById("scoreValue");
  const timeValueEl = document.getElementById("timeValue");
  const coinsValueEl = document.getElementById("coinsValue");
  const pauseBtn = document.getElementById("pauseBtn");

  const menuScreen = document.getElementById("menuScreen");
  const menuHighscoreEl = document.getElementById("menuHighscore");
  const menuCoinsEl = document.getElementById("menuCoins");
  const playBtn = document.getElementById("playBtn");
  const shopBtn = document.getElementById("shopBtn");

  const pauseScreen = document.getElementById("pauseScreen");
  const resumeBtn = document.getElementById("resumeBtn");
  const quitBtn = document.getElementById("quitBtn");

  const gameOverScreen = document.getElementById("gameOverScreen");
  const finalScoreEl = document.getElementById("finalScore");
  const finalHighscoreEl = document.getElementById("finalHighscore");
  const coinsEarnedLineEl = document.getElementById("coinsEarnedLine");
  const retryBtn = document.getElementById("retryBtn");
  const menuBtn = document.getElementById("menuBtn");

  const shopScreen = document.getElementById("shopScreen");
  const shopCoinsEl = document.getElementById("shopCoins");
  const shopListEl = document.getElementById("shopList");
  const closeShopBtn = document.getElementById("closeShopBtn");

  const adScreen = document.getElementById("adScreen");
  const adTimerEl = document.getElementById("adTimer");
  const adSkipBtn = document.getElementById("adSkipBtn");

  function showScreen(el) {
    for (const s of [
      menuScreen,
      pauseScreen,
      gameOverScreen,
      shopScreen,
      adScreen,
    ]) {
      s.classList.add("hidden");
    }
    if (el) el.classList.remove("hidden");
  }

  // ---------- Canvas sizing ----------
  let W = 0,
    H = 0,
    DPR = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  // ---------- Game state ----------
  const STATE = {
    MENU: "menu",
    PLAYING: "playing",
    PAUSED: "paused",
    GAMEOVER: "gameover",
    SHOP: "shop",
    AD: "ad",
  };
  let state = STATE.MENU;

  let score = 0;
  let coinsEarnedThisRun = 0;
  let balloons = [];
  let particles = [];
  let spawnTimer = 0;
  const SPAWN_INTERVAL = 0.7; // seconds, per game design
  const RUN_DURATION = 60; // seconds
  let elapsed = 0;
  let lastTime = 0;
  let rafId = null;

  const COLORS = [
    "#ff6b6b",
    "#ffd93d",
    "#6bcB77",
    "#4d96ff",
    "#c17dff",
    "#ff9f43",
  ];

  class Balloon {
    constructor() {
      this.r = 26 + Math.random() * 16;
      this.x = this.r + Math.random() * (W - this.r * 2);
      this.y = H + this.r + Math.random() * 60;
      this.vy = -(60 + Math.random() * 50);
      this.sway = Math.random() * Math.PI * 2;
      this.swaySpeed = 1 + Math.random() * 1.5;
      this.golden = owned.goldenSkin && Math.random() < 0.15;
      this.color = this.golden
        ? "#ffd700"
        : COLORS[Math.floor(Math.random() * COLORS.length)];
      this.popped = false;
      this.alive = true;
    }
    update(dt) {
      this.y += this.vy * dt;
      this.sway += this.swaySpeed * dt;
      this.x += Math.sin(this.sway) * 18 * dt;
      if (this.y + this.r < 0) this.alive = false;
    }
    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      const grad = ctx.createRadialGradient(
        -this.r * 0.35,
        -this.r * 0.35,
        this.r * 0.1,
        0,
        0,
        this.r,
      );
      grad.addColorStop(0, this.golden ? "#fff6c8" : "#ffffff");
      grad.addColorStop(1, this.color);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, 0, this.r * 0.85, this.r, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.15)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.beginPath();
      ctx.moveTo(0, this.r);
      ctx.lineTo(0, this.r + 14);
      ctx.stroke();
      ctx.restore();
    }
    hitTest(px, py) {
      const dx = px - this.x,
        dy = py - this.y;
      return dx * dx + dy * dy <= (this.r + 6) * (this.r + 6);
    }
  }

  class Particle {
    constructor(x, y, color) {
      this.x = x;
      this.y = y;
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 120;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.life = 0.5;
      this.age = 0;
      this.color = color;
    }
    update(dt) {
      this.age += dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vy += 220 * dt;
    }
    get alive() {
      return this.age < this.life;
    }
    draw() {
      const t = 1 - this.age / this.life;
      ctx.globalAlpha = Math.max(t, 0);
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function pop(balloon, px, py) {
    balloon.popped = true;
    balloon.alive = false;
    for (let i = 0; i < 10; i++)
      particles.push(new Particle(px, py, balloon.color));

    score += 1;
    if (score > highscore) {
      highscore = score;
      saveHighscore();
    }

    const coinGain = balloon.golden ? 3 : 1;
    coins += coinGain;
    coinsEarnedThisRun += coinGain;
    updateHud();
  }

  function updateHud() {
    scoreValueEl.textContent = score;
    timeValueEl.textContent = Math.max(Math.ceil(RUN_DURATION - elapsed), 0);
    coinsValueEl.textContent = coins;
  }

  function resetRun() {
    score = 0;
    coinsEarnedThisRun = 0;
    balloons = [];
    particles = [];
    spawnTimer = 0;
    elapsed = 0;
    updateHud();
  }

  function startGame() {
    resetRun();
    state = STATE.PLAYING;
    hudEl.classList.remove("hidden");
    showScreen(null);
    lastTime = performance.now();
    cg(() => {
      if (CG && CG.game && CG.game.gameplayStart) CG.game.gameplayStart();
    });
    if (!rafId) rafId = requestAnimationFrame(loop);
  }

  function endGame() {
    state = STATE.GAMEOVER;
    hudEl.classList.add("hidden");
    if (score > highscore) {
      highscore = score;
      saveHighscore();
    }
    saveCoins();
    cg(() => {
      if (CG && CG.game && CG.game.gameplayStop) CG.game.gameplayStop();
    });
    finalScoreEl.textContent = score;
    finalHighscoreEl.textContent = highscore;
    coinsEarnedLineEl.textContent = `+${coinsEarnedThisRun} 🪙 earned`;
    maybeShowAd(() => showScreen(gameOverScreen));
  }

  function maybeShowAd(onDone) {
    if (hasRemoveAds()) {
      onDone();
      return;
    }
    let usedSdkAd = false;
    try {
      if (CG && CG.ad && CG.ad.requestAd) {
        usedSdkAd = true;
        state = STATE.AD;
        showScreen(null);
        CG.ad
          .requestAd("midgame")
          .catch(() => {})
          .finally(() => {
            onDone();
          });
      }
    } catch {
      usedSdkAd = false;
    }
    if (usedSdkAd) return;
    // Fallback simulated ad break
    state = STATE.AD;
    showScreen(adScreen);
    adSkipBtn.classList.add("hidden");
    let t = 5;
    adTimerEl.textContent = t;
    const iv = setInterval(() => {
      t -= 1;
      if (t <= 0) {
        clearInterval(iv);
        adTimerEl.textContent = "0";
        adSkipBtn.classList.remove("hidden");
      } else {
        adTimerEl.textContent = t;
      }
    }, 1000);
    adSkipBtn.onclick = () => {
      clearInterval(iv);
      onDone();
    };
  }

  function pauseGame() {
    if (state !== STATE.PLAYING) return;
    state = STATE.PAUSED;
    showScreen(pauseScreen);
    cg(() => {
      if (CG && CG.game && CG.game.gameplayStop) CG.game.gameplayStop();
    });
  }

  function resumeGame() {
    if (state !== STATE.PAUSED) return;
    state = STATE.PLAYING;
    showScreen(null);
    lastTime = performance.now();
    cg(() => {
      if (CG && CG.game && CG.game.gameplayStart) CG.game.gameplayStart();
    });
  }

  function quitToMenu() {
    state = STATE.MENU;
    hudEl.classList.add("hidden");
    saveCoins();
    menuHighscoreEl.textContent = highscore;
    menuCoinsEl.textContent = coins;
    showScreen(menuScreen);
  }

  // ---------- Input ----------
  function pointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e) {
    if (state !== STATE.PLAYING) return;
    e.preventDefault();
    const { x, y } = pointerPos(e);
    for (let i = balloons.length - 1; i >= 0; i--) {
      const b = balloons[i];
      if (b.alive && b.hitTest(x, y)) {
        pop(b, x, y);
        break;
      }
    }
  }

  canvas.addEventListener("mousedown", handlePointerDown);
  canvas.addEventListener("touchstart", handlePointerDown, { passive: false });

  // ---------- Loop ----------
  function loop(now) {
    rafId = requestAnimationFrame(loop);
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    if (state !== STATE.PLAYING) return;

    elapsed += dt;
    spawnTimer += dt;
    if (spawnTimer >= SPAWN_INTERVAL) {
      spawnTimer -= SPAWN_INTERVAL;
      balloons.push(new Balloon());
    }

    for (const b of balloons) b.update(dt);
    balloons = balloons.filter((b) => b.alive);

    for (const p of particles) p.update(dt);
    particles = particles.filter((p) => p.alive);

    ctx.clearRect(0, 0, W, H);
    for (const b of balloons) b.draw();
    for (const p of particles) p.draw();

    timeValueEl.textContent = Math.max(Math.ceil(RUN_DURATION - elapsed), 0);
    if (elapsed >= RUN_DURATION) {
      endGame();
      return;
    }
  }

  // ---------- UI wiring ----------
  playBtn.addEventListener("click", startGame);
  shopBtn.addEventListener("click", () => {
    renderShop();
    showScreen(shopScreen);
  });
  closeShopBtn.addEventListener("click", () => showScreen(menuScreen));
  pauseBtn.addEventListener("click", pauseGame);
  resumeBtn.addEventListener("click", resumeGame);
  quitBtn.addEventListener("click", () => {
    showScreen(null);
    quitToMenu();
  });
  retryBtn.addEventListener("click", startGame);
  menuBtn.addEventListener("click", quitToMenu);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === STATE.PLAYING) pauseGame();
  });

  // ---------- Init ----------
  menuHighscoreEl.textContent = highscore;
  menuCoinsEl.textContent = coins;
  showScreen(menuScreen);
  cg(() => {
    if (CG && CG.game && CG.game.sdkGameLoadingStart)
      CG.game.sdkGameLoadingStart();
  });
  cg(() => {
    if (CG && CG.game && CG.game.sdkGameLoadingStop)
      CG.game.sdkGameLoadingStop();
  });
})();
