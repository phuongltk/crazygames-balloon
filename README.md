# Balloon Pop

HTML5 canvas balloon-popping game built for CrazyGames.

## Files

- [index.html](index.html) — markup for the canvas, HUD, and menu/pause/game-over/shop screens.
- [game.js](game.js) — game logic and CrazyGames SDK integration.
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

## Persistence keys (`localStorage`)

- `balloonPop_highscore`
- `balloonPop_coins`
- `balloonPop_owned`
