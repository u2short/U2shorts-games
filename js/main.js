document.getElementById("year").textContent = new Date().getFullYear();

function renderGames() {
  const grid = document.getElementById("games-grid");
  grid.innerHTML = "";

  GAMES.forEach((game) => {
    const isPlayable = !game.comingSoon && game.path && game.slug;
    const el = document.createElement(isPlayable ? "a" : "div");

    el.className = "game-card" + (isPlayable ? "" : " disabled");
    if (isPlayable) el.href = `games/play.html?slug=${encodeURIComponent(game.slug)}`;

    const thumbContent = game.thumbnail
      ? `<img src="${game.thumbnail}" alt="${game.title} thumbnail">`
      : `<span>${isPlayable ? "PLAY" : "// IN DEV"}</span>`;

    const tag = game.tag
      ? `<span class="game-card-tag${game.comingSoon ? " coming-soon" : ""}">${game.tag}</span>`
      : "";

    el.innerHTML = `
      <div class="game-card-thumb">${thumbContent}</div>
      <div class="game-card-body">
        <div class="game-card-title">${game.title}</div>
        <div class="game-card-desc">${game.description}</div>
        ${tag}
      </div>
    `;

    grid.appendChild(el);
  });
}

renderGames();
