// Canvas + drawing context, plus a running frame counter used by other files
// for simple animations (twinkle, pulse, breathing). Loaded first since
// almost everything else needs these.
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let frameCount = 0;

// Maps a real click/touch position (in page/CSS pixels) to canvas-internal
// coordinates. Needed because the canvas is 1600x900 internally but gets
// scaled up/down on screen via CSS -- every button hit-test (restart, start,
// mobile controls) goes through this.
function toCanvasCoordinates(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

function isPointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

// Simple rounded-rect path, drawn manually rather than relying on
// ctx.roundRect for broader browser compatibility.
function roundedRectPath(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function fillRoundedRect(x, y, width, height, radius, fillStyle) {
  roundedRectPath(x, y, width, height, radius);
  ctx.fillStyle = fillStyle;
  ctx.fill();
}

// A gumdrop-shaped silhouette: domed top, bulging shoulders, tapering sides
// down to a rounded base -- used for both the player and the boss so they
// read as the same "species" of character. Shared here since bullets reuse
// it too (as tiny droplets).
//   wobbleAmount - 0 for a perfectly still shape (player, small projectiles),
//                  1 for a gooey per-frame perturbation (the boss)
//   dripCount    - 0 for a clean rounded base, >0 adds bobbing drips (boss only)
function buildGumdropPath(x, y, width, height, wobbleAmount = 0, dripCount = 0) {
  const t = frameCount * 0.035;
  const wob = wobbleAmount ? width * 0.015 * wobbleAmount : 0;
  const cx = x + width / 2;

  const topY = y + (wob ? Math.sin(t) * wob * 0.4 : 0);
  const domeCtrlY = y - height * 0.06;
  const topLeftX = x + width * 0.3 + (wob ? Math.sin(t * 1.1) * wob : 0);
  const topRightX = x + width * 0.7 + (wob ? Math.sin(t * 1.1 + 1) * wob : 0);

  const shoulderY = y + height * 0.26;
  const leftShoulderX = x + width * 0.02 + (wob ? Math.sin(t * 1.3 + 2) * wob : 0);
  const rightShoulderX = x + width * 0.98 + (wob ? Math.sin(t * 1.3 + 3) * wob : 0);

  const bottomY = y + height * 0.97;
  const bottomLeftX = x + width * 0.12;
  const bottomRightX = x + width * 0.88;

  ctx.beginPath();
  ctx.moveTo(topLeftX, topY);
  ctx.quadraticCurveTo(cx, domeCtrlY, topRightX, topY);
  ctx.quadraticCurveTo(rightShoulderX + width * 0.05, shoulderY - height * 0.08, rightShoulderX, shoulderY);
  ctx.quadraticCurveTo(rightShoulderX - width * 0.03, (shoulderY + bottomY) / 2, bottomRightX, bottomY);

  if (dripCount > 0) {
    for (let i = 0; i < dripCount; i++) {
      const segX = bottomRightX - ((bottomRightX - bottomLeftX) / dripCount) * i;
      const nextX = bottomRightX - ((bottomRightX - bottomLeftX) / dripCount) * (i + 1);
      const dripPhase = Math.sin(t * 1.6 + i * 1.7);
      const dripDepth = height * 0.015 + Math.max(0, dripPhase) * height * 0.045;
      ctx.quadraticCurveTo((segX + nextX) / 2, bottomY + dripDepth, nextX, bottomY);
    }
  } else {
    ctx.quadraticCurveTo(cx, bottomY + height * 0.02, bottomLeftX, bottomY);
  }

  ctx.quadraticCurveTo(leftShoulderX - width * 0.03, (shoulderY + bottomY) / 2, leftShoulderX, shoulderY);
  ctx.quadraticCurveTo(leftShoulderX - width * 0.05, shoulderY - height * 0.08, topLeftX, topY);
  ctx.closePath();
}
