document.getElementById("year").textContent = new Date().getFullYear();

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function renderNotFound(container) {
  document.title = "Game not found — U2short's Games";
  container.innerHTML = `
    <div class="play-missing">
      <h1>Game not found</h1>
      <p>That game doesn't exist (or hasn't been published yet).</p>
      <a href="../index.html#games" class="btn btn-primary">Back to all games</a>
    </div>
  `;
}

function renderGame(container, game) {
  document.title = `${game.title} — U2short's Games`;

  const controlsRows = (game.controls || [])
    .map(c => `<div class="control-row"><span class="control-key">${escapeHtml(c.key)}</span><span class="control-action">${escapeHtml(c.action)}</span></div>`)
    .join("");

  const changelogItems = (game.changelog || [])
    .map(entry => `
      <li class="changelog-entry">
        <span class="changelog-date">${escapeHtml(entry.date)}</span>
        <span class="changelog-note">${escapeHtml(entry.note)}</span>
      </li>
    `)
    .join("");

  container.innerHTML = `
    <div class="play-header">
      <h1>${escapeHtml(game.title)}</h1>
      <p class="play-desc">${escapeHtml(game.description)}</p>
    </div>

    <div class="play-layout">
      <div class="game-frame-wrap">
        <button class="fullscreen-btn" id="fullscreen-btn" title="Fullscreen">&#x26F6;</button>
        <iframe id="game-frame" src="${encodeURI("../" + game.path)}" allow="fullscreen" allowfullscreen></iframe>
      </div>

      <aside class="play-sidebar">
        ${game.objective ? `
          <section class="info-panel">
            <h2 class="info-title">Objective</h2>
            <p>${escapeHtml(game.objective)}</p>
          </section>
        ` : ""}

        ${controlsRows ? `
          <section class="info-panel">
            <h2 class="info-title">Controls</h2>
            <div class="controls-list">${controlsRows}</div>
          </section>
        ` : ""}

        ${changelogItems ? `
          <section class="info-panel">
            <h2 class="info-title">Changelog</h2>
            <ul class="changelog-list">${changelogItems}</ul>
          </section>
        ` : ""}
      </aside>
    </div>
  `;

  const fullscreenBtn = document.getElementById("fullscreen-btn");
  const wrap = container.querySelector(".game-frame-wrap");
  setupFullscreen(wrap, fullscreenBtn);
}

// --- Fullscreen, with a fallback for browsers that don't support the real
// API on arbitrary elements (notably iPhone Safari, which only supports it
// on <video>). Targets the wrapper div (not the iframe) since fullscreening
// an iframe element is flakier across browsers than a plain div.

function requestFsCompat(el) {
  const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
  if (!fn) return Promise.reject(new Error("Fullscreen API not supported"));
  try {
    const result = fn.call(el);
    return result instanceof Promise ? result : Promise.resolve();
  } catch (err) {
    return Promise.reject(err);
  }
}

function exitFsCompat() {
  const fn = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
  if (!fn) return Promise.resolve();
  try {
    const result = fn.call(document);
    return result instanceof Promise ? result : Promise.resolve();
  } catch {
    return Promise.resolve();
  }
}

function currentFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || null;
}

function setupFullscreen(wrap, btn) {
  const EXIT_ICON = "✕"; // ✕
  const ENTER_ICON = "⛶"; // ⛶

  function enterPseudo() {
    wrap.classList.add("pseudo-fullscreen");
    document.body.classList.add("fullscreen-lock");
    btn.textContent = EXIT_ICON;
    btn.title = "Exit fullscreen";
  }

  function exitPseudo() {
    wrap.classList.remove("pseudo-fullscreen");
    document.body.classList.remove("fullscreen-lock");
    btn.textContent = ENTER_ICON;
    btn.title = "Fullscreen";
  }

  btn.addEventListener("click", () => {
    if (currentFullscreenElement() === wrap) {
      exitFsCompat();
      return;
    }
    if (wrap.classList.contains("pseudo-fullscreen")) {
      exitPseudo();
      return;
    }
    // Try the real Fullscreen API first (hides browser chrome too); if the
    // browser doesn't support it or refuses, fall back to a CSS overlay that
    // just fills the viewport instead -- this is what makes it work on
    // iPhone Safari, which has no Fullscreen API for non-video elements.
    requestFsCompat(wrap).catch(() => enterPseudo());
  });

  ["fullscreenchange", "webkitfullscreenchange", "MSFullscreenChange"].forEach((evt) => {
    document.addEventListener(evt, () => {
      if (currentFullscreenElement() === wrap) {
        btn.textContent = EXIT_ICON;
        btn.title = "Exit fullscreen";
      } else if (!wrap.classList.contains("pseudo-fullscreen")) {
        btn.textContent = ENTER_ICON;
        btn.title = "Fullscreen";
      }
    });
  });
}

function init() {
  const container = document.getElementById("play-page");
  const slug = new URLSearchParams(location.search).get("slug");
  const game = typeof GAMES !== "undefined" ? GAMES.find(g => g.slug === slug) : null;

  if (!game) {
    renderNotFound(container);
    return;
  }

  renderGame(container, game);
}

init();
