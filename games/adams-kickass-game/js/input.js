// Tracks which keys are currently held down.
// Other files check `keys["ArrowLeft"]` etc. to decide what to do each frame.
const keys = {};

// A snapshot of `keys` from the previous frame. Comparing the two lets us
// detect the single frame a key was first pressed, separate from it being
// held down. Needed for things like dash (one burst per press, not per frame)
// and jump buffering (remember "jump was pressed" even before landing).
const prevKeys = {};

window.addEventListener("keydown", (e) => {
  keys[e.code] = true;
});

window.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});

// True only on the exact frame any of the given key codes went from up to down.
function isAnyJustPressed(codes) {
  return codes.some((code) => keys[code] && !prevKeys[code]);
}

function isAnyPressed(codes) {
  return codes.some((code) => keys[code]);
}

// Call once per frame, after all game logic has read this frame's input.
function updateInputSnapshot() {
  for (const code in keys) {
    prevKeys[code] = keys[code];
  }
}
