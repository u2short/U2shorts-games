// Game flow state (start screen vs. actual gameplay), the start screen
// itself, mobile detection, and on-screen touch controls. Touch input here
// funnels into the SAME systems keyboard/mouse already use --
// keys["ArrowLeft"], startSlash(), castMagic(), castMagicBullet() -- so
// nothing downstream needs to know whether an action came from a key, a
// click, or a touch.

let gameState = "start"; // "start" | "playing"

const isMobile = (
  /Android|iPhone|iPad|iPod|Mobile|webOS/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 0 && Math.min(window.innerWidth, window.innerHeight) < 900)
);
let touchControlsEnabled = isMobile;
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

function startGame() {
  if (gameState !== "start") return;
  gameState = "playing";
  getAudioContext(); // unlock audio on this same user gesture
  sfxUiClick();
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

  ctx.font = "20px sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(
    touchControlsEnabled
      ? "Touch controls appear once you start"
      : "Move: WASD/Arrows   Jump: Space   Dash: Shift   Attack: Click / E / Right-Click",
    canvas.width / 2,
    canvas.height * 0.82
  );
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

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#1e1b3a");
  gradient.addColorStop(1, "#0f0f1a");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // A handful of slow-twinkling stars -- fixed positions (seeded by index),
  // so they don't visibly "jump" frame to frame.
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 40; i++) {
    const x = (i * 137) % canvas.width;
    const y = (i * 71) % (canvas.height * 0.6);
    const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(frameCount * 0.02 + i));
    ctx.globalAlpha = twinkle * 0.5;
    ctx.fillRect(x, y, 2, 2);
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
  touchControlsEnabled = true;
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
