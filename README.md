# Balloon Pop

HTML5 canvas balloon-popping game built for CrazyGames.

## Files

- [index.html](index.html) — markup for the canvas, HUD, and menu/pause/game-over/shop screens.
- [game.js](game.js) — game logic only (balloons, scoring, screens, shop). Talks to the SDK exclusively through `window.CrazySDK`.
- [cg-integration.js](cg-integration.js) — reusable CrazyGames SDK wrapper, no gameplay knowledge. See below.
- [style.css](style.css) — layout and theming.

## How the game works

```
START
  ↓
Create balloons every 700ms
  ↓
Balloon moves upward
  ↓
Player clicks balloon
  ↓
Score +1
  ↓
Is score > high score?
  ├── YES → save new high score
  └── NO
  ↓
60 seconds?
  ├── NO → continue
  └── YES → GAME OVER
```

- Balloons spawn every 700ms (`SPAWN_INTERVAL` in [game.js](game.js)) and float upward with a slight sway.
- Popping a balloon (click/tap) always adds `+1` to the score.
- The high score is checked and persisted (`localStorage`) immediately on every pop.
- The run ends automatically once 60 seconds (`RUN_DURATION`) have elapsed, regardless of score.

## Other systems

- **Coins**: each pop also earns coins (3 for a golden balloon, 1 otherwise), spendable in the Shop.
- **Shop**: `Remove Ads` and `Golden Balloons` (golden balloons are worth more coins) are one-time purchases, persisted in `localStorage`.
- **Ads**: a mid-game ad break plays after each run via the CrazyGames SDK (or a simulated fallback), unless `Remove Ads` is owned.

## CrazyGames SDK integration (reusable across games)

[cg-integration.js](cg-integration.js) is a drop-in, gameplay-agnostic wrapper around `CrazyGames.SDK`. To use it in a new game:

1. Copy `cg-integration.js` into the project.
2. Load it after the CDN SDK script and before your game code:
   ```html
   <script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>
   <script src="cg-integration.js"></script>
   <script src="game.js"></script>
   ```
3. Call `window.CrazySDK` from your game logic instead of touching `CrazyGames.SDK` directly:
   - `CrazySDK.loadingStart()` / `loadingStop()` — call once when your game/menu is ready.
   - `CrazySDK.gameplayStart()` / `gameplayStop()` — call when a run starts/ends/pauses/resumes.
   - `CrazySDK.hasAdApi()` — check before requesting an ad, so you can show your own fallback ad UI when it's `false`.
   - `CrazySDK.requestAd(type)` — returns a Promise that always resolves once the ad finishes, is skipped, or fails.

**Why it's built this way:** when the domain isn't registered with CrazyGames (e.g. testing locally via `file://`), the SDK reports `environment: "disabled"` and throws (e.g. `sdkDisabled`, `sdkNotInitialized`) just from **accessing** a namespace like `CG.game.gameplayStart`, not only from calling it. Every SDK access inside `cg-integration.js` goes through a `safe()` helper that wraps both the property lookup and the call in a single try/catch, so this optional integration can never throw into your game code or break a render loop. If you extend the wrapper with a new SDK call, wrap it the same way.

## Persistence keys (`localStorage`)

- `balloonPop_highscore`
- `balloonPop_coins`
- `balloonPop_owned`
