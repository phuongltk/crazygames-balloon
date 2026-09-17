// Reusable CrazyGames SDK wrapper.
//
// Drop this file (plus the crazygames-sdk-v3.js CDN script) into any game and
// use `window.CrazySDK` instead of touching `CrazyGames.SDK` directly. It is
// gameplay-agnostic: no knowledge of this game's screens, HUD, or state.
//
// Why this exists: the SDK can throw synchronously just from ACCESSING a
// namespace/method (e.g. "sdkDisabled" / "sdkNotInitialized" when the domain
// isn't registered with CrazyGames, such as local file:// testing) - not only
// from calling it. Every access here goes through `safe()`, which wraps both
// the property lookup and the call, so this optional integration can never
// throw into your game code or break a render loop.
(function (global) {
  "use strict";

  const CG =
    global.CrazyGames && global.CrazyGames.SDK ? global.CrazyGames.SDK : null;

  function safe(fn) {
    try {
      fn();
    } catch {
      // ignore — SDK integration is optional
    }
  }

  safe(() => {
    if (CG && CG.init) CG.init().catch(() => {});
  });

  function loadingStart() {
    safe(() => {
      if (CG && CG.game && CG.game.sdkGameLoadingStart)
        CG.game.sdkGameLoadingStart();
    });
  }

  function loadingStop() {
    safe(() => {
      if (CG && CG.game && CG.game.sdkGameLoadingStop)
        CG.game.sdkGameLoadingStop();
    });
  }

  function gameplayStart() {
    safe(() => {
      if (CG && CG.game && CG.game.gameplayStart) CG.game.gameplayStart();
    });
  }

  function gameplayStop() {
    safe(() => {
      if (CG && CG.game && CG.game.gameplayStop) CG.game.gameplayStop();
    });
  }

  function hasAdApi() {
    let has = false;
    safe(() => {
      has = !!(CG && CG.ad && CG.ad.requestAd);
    });
    return has;
  }

  // Always resolves (never rejects/throws) once the ad finishes, is
  // skipped, or fails — callers should check hasAdApi() first and show
  // their own fallback ad UI when it's false.
  function requestAd(type) {
    return new Promise((resolve) => {
      let started = false;
      safe(() => {
        if (CG && CG.ad && CG.ad.requestAd) {
          started = true;
          CG.ad
            .requestAd(type)
            .catch(() => {})
            .finally(() => resolve());
        }
      });
      if (!started) resolve();
    });
  }

  global.CrazySDK = {
    loadingStart,
    loadingStop,
    gameplayStart,
    gameplayStop,
    hasAdApi,
    requestAd,
  };
})(window);
