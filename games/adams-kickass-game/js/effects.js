// Generic particle system (dash trails, dust, sparks) and screen shake.
// Both are visual-only -- nothing here affects collision or game logic.

const particles = [];

// Spawns `count` particles at (x, y). All options are optional:
//   speedMin/speedMax - how fast they fly outward
//   angleStart/angleEnd - direction range in radians (default: full circle)
//   life - frames until gone
//   size - base radius in pixels
//   color - fill style
//   gravity - added to vy every frame (0 = floats, positive = falls)
//   fade - if true, shrinks and fades over its lifetime (default true)
function spawnParticles(x, y, count, opts = {}) {
  const {
    speedMin = 1, speedMax = 4,
    angleStart = 0, angleEnd = Math.PI * 2,
    life = 25, size = 4, color = "#ffffff", gravity = 0,
  } = opts;

  for (let i = 0; i < count; i++) {
    const angle = angleStart + Math.random() * (angleEnd - angleStart);
    const speed = speedMin + Math.random() * (speedMax - speedMin);
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life, maxLife: life,
      size: size * (0.7 + Math.random() * 0.6),
      color, gravity,
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.gravity;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  for (const p of particles) {
    const t = p.life / p.maxLife;
    ctx.globalAlpha = Math.max(0, t);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.5, p.size * t), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// --- Screen shake ---------------------------------------------------------

let shakeTimer = 0;
let shakeDuration = 1;
let shakeMagnitude = 0;

function triggerScreenShake(magnitude, duration) {
  // A new shake always wins, even if a smaller one is already fading out --
  // impactful moments (boss death) shouldn't get muted by a smaller one
  // that happened to be running (a bullet hit) a frame earlier.
  shakeMagnitude = magnitude;
  shakeDuration = duration;
  shakeTimer = duration;
}

function updateScreenShake() {
  if (shakeTimer > 0) shakeTimer--;
}

function getScreenShakeOffset() {
  if (shakeTimer <= 0) return { x: 0, y: 0 };
  const amount = shakeMagnitude * (shakeTimer / shakeDuration);
  return {
    x: (Math.random() * 2 - 1) * amount,
    y: (Math.random() * 2 - 1) * amount,
  };
}
