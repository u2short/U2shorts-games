# U2short's Games

Personal site for hosting browser games, built as plain HTML/CSS/JS (no build step, no server needed).

## Structure

```
index.html           Homepage (hero + game grid)
css/style.css         Theme (black + neon green)
js/games-data.js       <-- Edit this to add/remove games
js/main.js             Renders the homepage grid from games-data.js
js/play.js             Renders each game's own info page
games/play.html         Shared template: embeds the game + How to Play + Changelog
games/<slug>/            Put each game's folder in here
assets/                 Site images/icons
```

Every game gets its own page at `games/play.html?slug=<slug>`, which embeds
the game in an iframe next to a "How to Play" panel (objective + controls)
and a changelog. The homepage card links straight to that page.

## Adding a new game

1. Copy your finished game's files into a new folder under `games/`, e.g. `games/space-runner/` with its `index.html` inside.
2. Open `js/games-data.js` and add an entry to the `GAMES` array:

```js
{
  title: "Space Runner",
  slug: "space-runner",
  description: "Dodge asteroids and rack up your best score.",
  path: "games/space-runner/index.html",
  thumbnail: "games/space-runner/thumb.png", // optional, leave "" if you don't have one
  tag: "NEW",                                 // optional, leave "" for none
  comingSoon: false,
  objective: "Dodge incoming asteroids and survive as long as possible.",
  controls: [
    { key: "Arrow Keys / WASD", action: "Move" },
    { key: "Space", action: "Boost" }
  ],
  changelog: [
    { date: "2026-07-27", note: "Initial release." }
    // add a new entry (newest first) every time you update this game
  ]
}
```

3. Save, then push to GitHub (see below) — the site updates automatically within a minute or two.

There's also a personal Claude Code skill, `publish-game` (installed at
`~/.claude/skills/publish-game/`), that automates all of this — including
writing the objective/controls by reading your game's code and appending a
changelog entry — from inside whatever game project you're working on. Just
ask Claude to "publish this game" from that project.

## Local preview

No install needed — just double-click `index.html` to open it in a browser. If a game needs to load files via `fetch` (some do, for assets/levels), it's more reliable to run a local server instead:

```bash
python -m http.server 8000
```

then visit `http://localhost:8000`.

## Deploying (GitHub Pages, free)

See the deployment steps the assistant walked through, or:

1. Create a free GitHub account and a new repository.
2. Push this folder to it.
3. In the repo's Settings → Pages, set the source to the `main` branch, root folder.
4. GitHub gives you a URL like `https://<username>.github.io/<repo>/`.
