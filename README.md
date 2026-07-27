# U2short's Games

Personal site for hosting browser games, built as plain HTML/CSS/JS (no build step, no server needed).

## Structure

```
index.html          Homepage (hero + game grid)
css/style.css        Theme (black + neon green)
js/games-data.js      <-- Edit this to add/remove games
js/main.js            Renders the game grid from games-data.js
games/                Put each game's folder in here
assets/               Site images/icons
```

## Adding a new game

1. Copy your finished game's files into a new folder under `games/`, e.g. `games/space-runner/` with its `index.html` inside.
2. Open `js/games-data.js` and add an entry to the `GAMES` array:

```js
{
  title: "Space Runner",
  description: "Dodge asteroids and rack up your best score.",
  path: "games/space-runner/index.html",
  thumbnail: "games/space-runner/thumb.png", // optional, leave "" if you don't have one
  tag: "NEW",                                 // optional, leave "" for none
  comingSoon: false
}
```

3. Save, then push to GitHub (see below) — the site updates automatically within a minute or two.

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
