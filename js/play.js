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
        <iframe id="game-frame" src="${encodeURI(game.path)}" allow="fullscreen" allowfullscreen></iframe>
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
  const frame = document.getElementById("game-frame");
  fullscreenBtn.addEventListener("click", () => {
    if (frame.requestFullscreen) frame.requestFullscreen();
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
