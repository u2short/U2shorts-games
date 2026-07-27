/*
  Add a new game by adding one object to this array. That's it — the
  homepage builds its cards from this list automatically, and each game
  gets its own info page at games/play.html?slug=<slug>.

  Fields:
    title       - Name shown on the card and play page
    slug        - Short id used in the URL and as the folder name under games/
                  (kebab-case, e.g. "space-runner" -> games/space-runner/)
    description - One or two sentence blurb for the card
    path        - The game's entry file, opened inside the play page
                  (e.g. "games/space-runner/index.html")
    thumbnail   - Optional image path. Leave "" for a text placeholder.
    tag         - Optional short label, e.g. "NEW", "BETA". Leave "" for none.
    comingSoon  - true = card shows but isn't clickable yet (game still in progress)
    objective   - 1-2 sentences: what the player is trying to do
    controls    - Array of { key, action } pairs shown as a "How to Play" table
    changelog   - Array of { date, note }, newest entry FIRST. Add one entry
                  each time a game is published or updated.
*/

const GAMES = [
  {
    title: "Your Next Game",
    slug: "",
    description: "Working on a new HTML/JS game in another chat — drop it into the games/ folder and add its entry here when it's ready.",
    path: "",
    thumbnail: "",
    tag: "COMING SOON",
    comingSoon: true,
    objective: "",
    controls: [],
    changelog: []
  }
];
