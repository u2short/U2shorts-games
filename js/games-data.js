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
    title: "Adams kickass game",
    slug: "adams-kickass-game",
    description: "A Cuphead-like boss fight.",
    path: "games/adams-kickass-game/index.html",
    thumbnail: "",
    tag: "NEW/BETA",
    comingSoon: false,
    objective: "Defeat the boss by draining its HP to zero using melee slashes and magic attacks, while dodging its three attacks (a bullet spray, an extending limb strike, and a leap-slam) and managing your 4 hearts. Run out of hearts and it's Game Over; beat the boss and you win — either screen lets you hit Restart to fight again.",
    controls: [
      { key: "Arrow Keys / WASD", action: "Move" },
      { key: "Space / Up / W", action: "Jump" },
      { key: "Shift / C", action: "Dash (brief invincibility)" },
      { key: "S / Down (on a platform)", action: "Drop through it" },
      { key: "Left Click", action: "Slash attack" },
      { key: "Right Click", action: "Magic cube (costs 50 MP, big damage)" },
      { key: "E", action: "Magic bullet (costs 1 MP, small damage)" },
      { key: "Touch (mobile)", action: "On-screen buttons for movement, jump, dash, slash, bullet, cube, drop-through" }
    ],
    changelog: [
      { date: "2026-07-27", note: "Major polish pass: sound, visuals, mobile support, and a full boss/player redesign." },
      { date: "2026-07-27", note: "Added platforms in the boss arena; boss now stays where it lands after its leap attack." },
      { date: "2026-07-27", note: "Initial release." }
    ]
  }
];
