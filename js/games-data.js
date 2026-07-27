/*
  Add a new game by adding one object to this array. That's it — the
  homepage builds its cards from this list automatically.

  Fields:
    title       - Name shown on the card
    description - One or two sentence blurb
    path        - Folder/file to open when "Play" is clicked (relative to site root)
    thumbnail   - Optional image path (e.g. "games/my-game/thumb.png"). Leave "" for a text placeholder.
    tag         - Optional short label, e.g. "NEW", "BETA". Leave "" for none.
    comingSoon  - true = card shows but isn't clickable yet (use while a game is still in progress)
*/

const GAMES = [
  {
    title: "Your Next Game",
    description: "Working on a new HTML/JS game in another chat — drop it into the games/ folder and add its entry here when it's ready.",
    path: "",
    thumbnail: "",
    tag: "COMING SOON",
    comingSoon: true
  }
];
