// Game flow state (start screen vs. actual gameplay), the start screen
// itself, mobile detection, and on-screen touch controls. Touch input here
// funnels into the SAME systems keyboard/mouse already use --
// keys["ArrowLeft"], startSlash(), castMagic(), castMagicBullet() -- so
// nothing downstream needs to know whether an action came from a key, a
// click, or a touch.

let gameState = "start"; // "start" | "playing"

// User-agent only -- deliberately NOT combined with touch-capability/screen-size
// checks, since those also fire on touchscreen laptops/desktops and would show
// mobile controls to someone playing with a mouse and keyboard.
const isMobile = /Android|iPhone|iPad|iPod|Mobile|webOS/i.test(navigator.userAgent);
const touchControlsEnabled = isMobile; // fixed at load -- a stray touch shouldn't turn this on
if (isMobile) document.body.classList.add("mobile");

let pointerX = null;
let pointerY = null;

window.addEventListener("mousemove", (e) => {
  const p = toCanvasCoordinates(e.clientX, e.clientY);
  pointerX = p.x;
  pointerY = p.y;
});

// --- Start screen ----------------------------------------------------------

function getStartButtonRect() {
  const width = 280;
  const height = 76;
  return { x: canvas.width / 2 - width / 2, y: canvas.height * 0.64, width, height };
}

// A disabled preview button below Play -- not wired to anything yet, just a
// teaser for a feature that's coming later.
function getClassesButtonRect() {
  const playBtn = getStartButtonRect();
  const width = 280;
  const height = 56;
  return { x: canvas.width / 2 - width / 2, y: playBtn.y + playBtn.height + 16, width, height };
}

function startGame() {
  if (gameState !== "start") return;
  gameState = "playing";
  getAudioContext(); // unlock audio on this same user gesture
  sfxUiClick();
  startBgMusic();
}

function drawStartScreen() {
  drawBackground();

  // A looming, translucent silhouette of the boss for flavor.
  ctx.save();
  ctx.globalAlpha = 0.35;
  const silhouetteGradient = ctx.createLinearGradient(1000, 100, 1000, 800);
  silhouetteGradient.addColorStop(0, "#8b5cf6");
  silhouetteGradient.addColorStop(1, "#3b0764");
  fillRoundedRect(1020, 100, 480, 720, 40, silhouetteGradient);
  ctx.restore();

  ctx.textAlign = "center";
  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 88px sans-serif";
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 4;
  ctx.fillText("ADAM'S KICKASS GAME", canvas.width / 2, canvas.height * 0.27);
  ctx.restore();

  ctx.font = "28px sans-serif";
  ctx.fillStyle = "#cbd5e1";
  ctx.fillText("A Cuphead-style boss fight", canvas.width / 2, canvas.height * 0.35);

  const btn = getStartButtonRect();
  const hovered = pointerX !== null && isPointInRect(pointerX, pointerY, btn);
  drawButton(btn, "PLAY", hovered, "#22c55e", "#15803d");

  drawClassesButton();

  ctx.font = "20px sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(
    touchControlsEnabled
      ? "Touch controls appear once you start"
      : "Move: WASD/Arrows   Jump: Space   Dash: Shift   Attack: Click / E / Right-Click",
    canvas.width / 2,
    canvas.height * 0.9
  );
}

// A disabled preview button teasing a future feature -- greyed out (not
// hover-reactive like Play, since clicking it does nothing yet) with a
// pinned "NEXT UPDATE" ribbon across its corner.
function drawClassesButton() {
  const btn = getClassesButtonRect();

  ctx.save();
  ctx.globalAlpha = 0.7;
  drawButton(btn, "CLASSES", false, "#64748b", "#334155");
  ctx.restore();

  ctx.save();
  ctx.translate(btn.x + btn.width - 6, btn.y - 4);
  ctx.rotate(0.35);
  fillRoundedRect(-72, -15, 144, 28, 6, "#f59e0b");
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1.5;
  roundedRectPath(-72, -15, 144, 28, 6);
  ctx.stroke();
  ctx.fillStyle = "#1e1b3a";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("NEXT UPDATE", 0, 1);
  ctx.restore();
}

// Shared rounded, gradient, hover-aware button -- used by the start screen
// and the Game Over/You Win restart button.
function drawButton(rect, label, hovered, colorTop, colorBottom) {
  ctx.save();
  if (hovered) {
    ctx.shadowColor = colorTop;
    ctx.shadowBlur = 20;
  }
  const gradient = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
  gradient.addColorStop(0, hovered ? colorTop : colorBottom);
  gradient.addColorStop(1, colorBottom);
  fillRoundedRect(rect.x, rect.y, rect.width, rect.height, 14, gradient);
  ctx.restore();

  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 2;
  roundedRectPath(rect.x, rect.y, rect.width, rect.height, 14);
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 30px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, rect.x + rect.width / 2, rect.y + rect.height / 2 + 2);
}

// --- Background (shared by the start screen and gameplay) -----------------
// A "slime palace" throne room: gothic arches with a glow deep inside each
// one, thick drip-capped pillars, a tiled ballroom floor, and ambient goo
// motes drifting through the air instead of stars -- everything in the same
// purple/magenta palette as the boss itself, so the room reads as its home.

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#2a1454");
  gradient.addColorStop(0.6, "#1b0f38");
  gradient.addColorStop(1, "#0d0620");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawPalaceArches();
  drawPalacePillars();
  drawPalaceFloorPattern();
  drawAmbientOoze();
}

// Gothic alcoves along the back wall, each with a faint pulsing glow deep
// inside, like the room goes back further than it lets on.
function drawPalaceArches() {
  const archCount = 5;
  const archWidth = 190;
  const archHeight = 340;
  const archTop = 90;
  const spacing = (canvas.width - archCount * archWidth) / (archCount + 1);

  for (let i = 0; i < archCount; i++) {
    const x = spacing + i * (archWidth + spacing);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, archTop + archHeight);
    ctx.lineTo(x, archTop + archWidth / 2);
    ctx.arc(x + archWidth / 2, archTop + archWidth / 2, archWidth / 2, Math.PI, 0);
    ctx.lineTo(x + archWidth, archTop + archHeight);
    ctx.closePath();

    const archGradient = ctx.createLinearGradient(x, archTop, x, archTop + archHeight);
    archGradient.addColorStop(0, "#4c1d95");
    archGradient.addColorStop(1, "#1e0a3c");
    ctx.fillStyle = archGradient;
    ctx.fill();

    ctx.strokeStyle = "rgba(216, 180, 254, 0.35)";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.25 + Math.sin(frameCount * 0.02 + i) * 0.08;
    ctx.fillStyle = "#c084fc";
    ctx.shadowColor = "#c084fc";
    ctx.shadowBlur = 30;
    ctx.beginPath();
    ctx.ellipse(x + archWidth / 2, archTop + archHeight * 0.55, archWidth * 0.28, archHeight * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Thick stone-and-goo pillars reaching from just under the arches down to
// the floor, each dripping slime from a wider capital band near the top.
function drawPalacePillars() {
  const pillarCount = 6;
  const pillarWidth = 46;
  const spacing = canvas.width / pillarCount;

  for (let i = 0; i < pillarCount; i++) {
    const x = spacing * i + spacing / 2 - pillarWidth / 2;

    const gradient = ctx.createLinearGradient(x, 0, x + pillarWidth, 0);
    gradient.addColorStop(0, "#3b0764");
    gradient.addColorStop(0.5, "#5b21b6");
    gradient.addColorStop(1, "#2e1065");
    ctx.fillStyle = gradient;
    ctx.fillRect(x, 60, pillarWidth, canvas.height - 60);

    fillRoundedRect(x - 14, 60, pillarWidth + 28, 26, 6, "#7e22ce");

    ctx.fillStyle = "#7e22ce";
    for (let d = 0; d < 3; d++) {
      const dripX = x + 8 + d * (pillarWidth - 16) / 2;
      const dripLen = 14 + ((i * 3 + d * 5) % 10);
      ctx.beginPath();
      ctx.ellipse(dripX, 86 + dripLen, 5, dripLen * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// A tiled ballroom floor implied with alternating horizontal bands, sitting
// just above (and mostly hidden behind) the actual ground platform.
function drawPalaceFloorPattern() {
  const floorTop = 700;
  const floorBottom = 860;
  const bandCount = 6;
  for (let i = 0; i < bandCount; i++) {
    const y0 = floorTop + (i / bandCount) * (floorBottom - floorTop);
    const y1 = floorTop + ((i + 1) / bandCount) * (floorBottom - floorTop);
    ctx.fillStyle = i % 2 === 0 ? "rgba(91, 33, 182, 0.25)" : "rgba(46, 16, 101, 0.25)";
    ctx.fillRect(0, y0, canvas.width, y1 - y0);
  }
}

// Slow-drifting glowing motes instead of stars -- fixed seeded x per index,
// looping y via frameCount, so it reads as ambient goo spores in the air
// rather than a night sky (this is an interior).
function drawAmbientOoze() {
  ctx.fillStyle = "#c084fc";
  for (let i = 0; i < 26; i++) {
    const seedX = (i * 173) % canvas.width;
    const speed = 0.15 + (i % 5) * 0.05;
    const y = (i * 91 + frameCount * speed) % canvas.height;
    const twinkle = 0.3 + 0.5 * Math.abs(Math.sin(frameCount * 0.015 + i));
    ctx.globalAlpha = twinkle * 0.4;
    ctx.beginPath();
    ctx.arc(seedX, y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// --- Mobile touch controls --------------------------------------------------

function getTouchButtons() {
  const w = canvas.width;
  const h = canvas.height;
  return {
    left: { x: 50, y: h - 210, size: 120, label: "◀", key: "ArrowLeft" },
    right: { x: 190, y: h - 210, size: 120, label: "▶", key: "ArrowRight" },
    down: { x: 120, y: h - 340, size: 100, label: "▼", key: "ArrowDown" },
    dash: { x: w - 500, y: h - 190, size: 110, label: "DASH", key: "ShiftLeft" },
    jump: { x: w - 350, y: h - 200, size: 140, label: "JUMP", key: "Space" },
    slash: { x: w - 190, y: h - 340, size: 110, label: "SLASH", action: "slash" },
    bullet: { x: w - 350, y: h - 350, size: 95, label: "E", key: "KeyE" },
    cube: { x: w - 520, y: h - 330, size: 95, label: "CUBE", action: "cube" },
  };
}

const activeTouchButtons = new Map(); // touch identifier -> button name

function buttonRect(btn) {
  return { x: btn.x, y: btn.y, width: btn.size, height: btn.size };
}

function drawTouchControls() {
  if (!touchControlsEnabled || gameState !== "playing") return;

  const buttons = getTouchButtons();
  const pressed = new Set(activeTouchButtons.values());

  for (const name in buttons) {
    const btn = buttons[name];
    const isPressed = pressed.has(name);
    const cx = btn.x + btn.size / 2;
    const cy = btn.y + btn.size / 2;

    ctx.globalAlpha = isPressed ? 0.55 : 0.3;
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.arc(cx, cy, btn.size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#0f172a";
    ctx.font = btn.label.length > 2 ? "bold 22px sans-serif" : "bold 34px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(btn.label, cx, cy);
  }
}

function touchButtonAt(x, y) {
  const buttons = getTouchButtons();
  for (const name in buttons) {
    const btn = buttons[name];
    const dx = x - (btn.x + btn.size / 2);
    const dy = y - (btn.y + btn.size / 2);
    if (dx * dx + dy * dy <= (btn.size / 2) * (btn.size / 2)) return name;
  }
  return null;
}

function pressTouchButton(name) {
  const buttons = getTouchButtons();
  const btn = buttons[name];
  if (btn.key) keys[btn.key] = true;
  else if (btn.action === "slash") startSlash();
  else if (btn.action === "cube") castMagic();
}

function releaseTouchButton(name) {
  const buttons = getTouchButtons();
  const btn = buttons[name];
  if (btn.key) keys[btn.key] = false;
}

function handleTouchStart(e) {
  for (const touch of e.changedTouches) {
    const { x, y } = toCanvasCoordinates(touch.clientX, touch.clientY);

    if (gameState === "start") {
      if (isPointInRect(x, y, getStartButtonRect())) startGame();
      continue;
    }
    if (isGameOver()) {
      const btn = getRestartButtonRect();
      if (isPointInRect(x, y, btn)) resetGame();
      continue;
    }

    const name = touchButtonAt(x, y);
    if (name) {
      e.preventDefault();
      activeTouchButtons.set(touch.identifier, name);
      pressTouchButton(name);
    }
  }
}

function handleTouchEnd(e) {
  for (const touch of e.changedTouches) {
    const name = activeTouchButtons.get(touch.identifier);
    if (name) {
      releaseTouchButton(name);
      activeTouchButtons.delete(touch.identifier);
    }
  }
}

canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
canvas.addEventListener("touchend", handleTouchEnd, { passive: false });
canvas.addEventListener("touchcancel", handleTouchEnd, { passive: false });

window.addEventListener("mousedown", (e) => {
  if (e.button !== 0 || gameState !== "start") return;
  const { x, y } = toCanvasCoordinates(e.clientX, e.clientY);
  if (isPointInRect(x, y, getStartButtonRect())) startGame();
});
