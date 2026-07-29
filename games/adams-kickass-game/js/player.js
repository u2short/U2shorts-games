// Everything about the player character lives here: how it moves, how gravity
// affects it, and how it draws itself.

const player = {
  x: 100,
  y: 100,
  width: 48,  // 1.5x the original 32
  height: 72, // 1.5x the original 48
  velocityX: 0,
  velocityY: 0,
  onGround: false,
  facing: 1, // 1 = right, -1 = left

  coyoteTimer: 0,
  jumpBufferTimer: 0,

  isDashing: false,
  dashTimer: 0,
  dashCooldownTimer: 0,
  dashDir: 1,

  groundIsOneWay: false, // true when standing on a one-way platform, not the solid ground
  dropThroughTimer: 0,

  hearts: 4,
  maxHearts: 4,
  mp: 0,
  maxMp: 100,
  invulnerableTimer: 0,
};

// Tuning numbers. These are the "feel" of the game -- tweak them and everything
// about how the character moves changes.
const MOVE_SPEED = 3; // 25% slower than the original 4
const GRAVITY = 0.6;
const JUMP_FORCE = -16; // increased so the player can reach the raised platforms

// Coyote time: how many frames after walking off a ledge you can still jump.
// Named after Wile E. Coyote running off a cliff before he falls -- without
// this, movement feels unfair because real players almost never press jump
// on the exact frame they're still touching the ground.
const COYOTE_TIME = 8;

// Jump buffering: how many frames a jump press is "remembered" before landing.
// Without this, pressing jump slightly before you land is ignored, which
// feels unresponsive even though the player did everything right.
const JUMP_BUFFER = 8;

const DASH_SPEED = 13;
const DASH_DURATION = 8; // frames the dash lasts
const DASH_COOLDOWN = 35; // frames before you can dash again
const DASH_END_IFRAMES = 60; // 1 extra second of invulnerability after the dash finishes

// Invulnerability after taking a hit, so standing in a damaging hitbox for
// multiple frames doesn't drain every heart at once. The player also flashes
// for this whole window as a visual cue that they can't be hurt right now.
const HIT_INVULNERABILITY = 300; // 5 seconds
const HIT_FLASH_INTERVAL = 6; // frames per on/off blink while invulnerable

const JUMP_KEYS = ["Space", "ArrowUp", "KeyW"];
const DASH_KEYS = ["ShiftLeft", "ShiftRight", "KeyC"];
const DOWN_KEYS = ["ArrowDown", "KeyS"];

// How long dropping through a one-way platform ignores its collision for --
// long enough to clear its thickness under gravity.
const DROP_THROUGH_DURATION = 20;

function updatePlayer() {
  // --- Timers: tick these down every frame regardless of what else happens ---
  if (player.invulnerableTimer > 0) player.invulnerableTimer--;
  player.dropThroughTimer = Math.max(0, player.dropThroughTimer - 1);

  // Holding down while standing on a one-way platform starts dropping
  // through it. Checked against last frame's ground state, before this
  // frame's collision pass overwrites it.
  if (player.onGround && player.groundIsOneWay && player.dropThroughTimer === 0 && isAnyPressed(DOWN_KEYS)) {
    player.dropThroughTimer = DROP_THROUGH_DURATION;
    sfxDropThrough();
  }

  if (player.onGround) {
    player.coyoteTimer = COYOTE_TIME;
  } else {
    player.coyoteTimer = Math.max(0, player.coyoteTimer - 1);
  }

  if (isAnyJustPressed(JUMP_KEYS)) {
    player.jumpBufferTimer = JUMP_BUFFER;
  } else {
    player.jumpBufferTimer = Math.max(0, player.jumpBufferTimer - 1);
  }

  player.dashCooldownTimer = Math.max(0, player.dashCooldownTimer - 1);

  // --- Start a dash ---
  if (!player.isDashing && player.dashCooldownTimer === 0 && isAnyJustPressed(DASH_KEYS)) {
    player.isDashing = true;
    player.dashTimer = DASH_DURATION;
    player.dashCooldownTimer = DASH_COOLDOWN;
    player.dashDir = player.facing;
    sfxDash();
  }

  if (player.isDashing) {
    // --- While dashing: fixed straight-line speed, gravity suspended ---
    player.velocityX = DASH_SPEED * player.dashDir;
    player.velocityY = 0;

    player.dashTimer--;
    if (player.dashTimer <= 0) {
      player.isDashing = false;
      // The dash itself is already fully invincible (see damagePlayer);
      // this adds a lingering window of invulnerability right after it ends.
      player.invulnerableTimer = Math.max(player.invulnerableTimer, DASH_END_IFRAMES);
    }
  } else {
    // --- Horizontal movement ---
    // Standing in a slime puddle (left behind by Attack 4's blobs) slows
    // movement while you're in it.
    let moveSpeed = MOVE_SPEED;
    for (const puddle of slimePuddles) {
      if (isColliding(player, puddle)) {
        moveSpeed = MOVE_SPEED * SLIME_PUDDLE_SPEED_MULTIPLIER;
        break;
      }
    }

    if (keys["ArrowLeft"] || keys["KeyA"]) {
      player.velocityX = -moveSpeed;
      player.facing = -1;
    } else if (keys["ArrowRight"] || keys["KeyD"]) {
      player.velocityX = moveSpeed;
      player.facing = 1;
    } else {
      player.velocityX = 0;
    }

    // --- Jumping ---
    // Uses the buffer/coyote timers instead of checking onGround directly,
    // so both "jumped slightly early" and "jumped slightly late" still work.
    if (player.jumpBufferTimer > 0 && player.coyoteTimer > 0) {
      player.velocityY = JUMP_FORCE;
      player.jumpBufferTimer = 0;
      player.coyoteTimer = 0;
      player.onGround = false;
      sfxJump();
      spawnParticles(player.x + player.width / 2, player.y + player.height, 6, {
        speedMin: 0.5, speedMax: 2.5, angleStart: Math.PI * 1.1, angleEnd: Math.PI * 1.9,
        life: 18, size: 4, color: "#9ca3af", gravity: 0.15,
      });
    }

    // --- Gravity ---
    player.velocityY += GRAVITY;
  }

  // Feet position before this frame's movement -- one-way platforms use this
  // to tell "falling onto it from above" apart from "rising into it from
  // below," which the generic AABB overlap check alone can't distinguish.
  const prevBottom = player.y + player.height;
  const wasOnGround = player.onGround;
  const fallSpeed = player.velocityY;

  // --- Apply movement ---
  player.x += player.velocityX;
  player.y += player.velocityY;

  // --- Collide with platforms ---
  player.onGround = false;
  player.groundIsOneWay = false;
  for (const platform of platforms) {
    if (platform.oneWay) {
      // Actively dropping through -- ignore this platform entirely.
      if (player.dropThroughTimer > 0) continue;
      // Only solid when falling onto it from above; passes through freely
      // when jumping up into it or already below it.
      if (player.velocityY < 0 || prevBottom > platform.y + 0.01) continue;
      if (!isColliding(player, platform)) continue;
      resolveCollision(player, platform);
      player.groundIsOneWay = true;
    } else if (isColliding(player, platform)) {
      resolveCollision(player, platform);
    }
  }

  // Landing dust/thud -- only for a real fall, not just stepping off a 1px ledge.
  if (!wasOnGround && player.onGround && fallSpeed > 6) {
    sfxLand();
    spawnParticles(player.x + player.width / 2, player.y + player.height, 8, {
      speedMin: 0.5, speedMax: 3, angleStart: Math.PI * 1.1, angleEnd: Math.PI * 1.9,
      life: 16, size: 5, color: "#9ca3af", gravity: 0.1,
    });
  }

  // A light trail while dashing, so the burst of speed reads clearly.
  if (player.isDashing && frameCount % 2 === 0) {
    spawnParticles(player.x + player.width / 2, player.y + player.height / 2, 2, {
      speedMin: 0, speedMax: 0.5, life: 14, size: player.height * 0.4, color: "#7dd3fc",
    });
  }

  // --- Keep player inside the canvas horizontally ---
  if (player.x < 0) player.x = 0;
  if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;

  // --- Fall off the bottom = respawn at start ---
  if (player.y > canvas.height + 100) {
    player.x = 100;
    player.y = 100;
    player.velocityX = 0;
    player.velocityY = 0;
  }
}

function drawPlayer() {
  // Soft contact shadow at the feet, always -- reads fine in the air too.
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.ellipse(player.x + player.width / 2, player.y + player.height + 2, player.width * 0.45, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Blink on/off for the whole invulnerability window after taking a hit.
  if (player.invulnerableTimer > 0 && Math.floor(player.invulnerableTimer / HIT_FLASH_INTERVAL) % 2 === 0) {
    return;
  }

  const baseColor = player.isDashing ? "#7dd3fc" : "#4ade80";
  const shadeColor = player.isDashing ? "#38bdf8" : "#22c55e";
  const gradient = ctx.createLinearGradient(player.x, player.y, player.x, player.y + player.height);
  gradient.addColorStop(0, baseColor);
  gradient.addColorStop(1, shadeColor);

  // Same gumdrop silhouette as the boss (see setup.js) -- no wobble/drips,
  // just the clean shape, so the player reads as a small, tidy version of
  // the same "species" rather than a generic rounded rectangle.
  buildGumdropPath(player.x, player.y, player.width, player.height, 0, 0);
  ctx.fillStyle = gradient;
  ctx.fill();

  // A small glossy highlight, same trick as the boss, for a bit of shine.
  ctx.save();
  buildGumdropPath(player.x, player.y, player.width, player.height, 0, 0);
  ctx.clip();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(player.x + player.width * 0.36, player.y + player.height * 0.3, player.width * 0.16, player.height * 0.22, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Simple eyes, offset toward whichever way the player is facing.
  const eyeY = player.y + player.height * 0.36;
  const eyeOffsetX = player.facing === 1 ? player.width * 0.62 : player.width * 0.38;
  const eyeSpacing = player.width * 0.16;
  const eyeRadius = player.width * 0.09;

  for (const dir of [-1, 1]) {
    const ex = player.x + eyeOffsetX + dir * eyeSpacing;
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(ex, eyeY, eyeRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(ex + player.facing * eyeRadius * 0.3, eyeY - eyeRadius * 0.3, eyeRadius * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  drawPlayerSword();

  // Green pulsing outline: you've been standing too close to the boss long
  // enough that a slime rain is about to start. Marking the player (not the
  // boss) since it's your positioning that triggered it.
  if (typeof boss !== "undefined" && boss.proximityState === "warning") {
    const pulse = 0.5 + Math.sin(frameCount * 0.3) * 0.5;
    ctx.save();
    ctx.globalAlpha = 0.5 + pulse * 0.5;
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 4;
    ctx.shadowColor = "#22c55e";
    ctx.shadowBlur = 15;
    buildGumdropPath(player.x - 6, player.y - 6, player.width + 12, player.height + 12, 0, 0);
    ctx.stroke();
    ctx.restore();
  }
}

// A actual sword shape, held near the front hand -- resting at a neutral
// forward-down angle when idle, swinging through an up-back-to-forward arc
// in sync with combat.js's slash timer while attacking. Mirrored (rather
// than re-derived per facing) so the swing arc only has to be written once.
function drawPlayerSword() {
  const pivotX = player.x + (player.facing === 1 ? player.width * 0.82 : player.width * 0.18);
  const pivotY = player.y + player.height * 0.42;

  let angle;
  if (slashTimer > 0) {
    const progress = 1 - slashTimer / SLASH_DURATION; // 0 -> 1 across the swing
    angle = 1.3 - progress * 1.9; // lowered back -> forward-up
  } else {
    angle = -0.3; // resting, held slightly forward-up
  }

  ctx.save();
  ctx.translate(pivotX, pivotY);
  if (player.facing === -1) ctx.scale(-1, 1);
  ctx.rotate(angle);

  const bladeLength = player.height * 0.85;
  const bladeWidth = 6;

  // Grip
  ctx.fillStyle = "#78350f";
  ctx.fillRect(-14, -4, 14, 8);

  // Crossguard
  ctx.fillStyle = "#eab308";
  ctx.fillRect(-3, -11, 6, 22);

  // Blade -- tapered to a point, with a bright gradient and a thin fuller line.
  const bladeGradient = ctx.createLinearGradient(0, 0, bladeLength, 0);
  bladeGradient.addColorStop(0, "#cbd5e1");
  bladeGradient.addColorStop(1, "#f8fafc");
  ctx.beginPath();
  ctx.moveTo(0, -bladeWidth / 2);
  ctx.lineTo(bladeLength * 0.82, -bladeWidth / 2);
  ctx.lineTo(bladeLength, 0);
  ctx.lineTo(bladeLength * 0.82, bladeWidth / 2);
  ctx.lineTo(0, bladeWidth / 2);
  ctx.closePath();
  ctx.fillStyle = bladeGradient;
  ctx.shadowColor = "#f1f5f9";
  ctx.shadowBlur = 5;
  ctx.fill();

  ctx.strokeStyle = "rgba(71, 85, 105, 0.5)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(3, 0);
  ctx.lineTo(bladeLength - 6, 0);
  ctx.stroke();

  ctx.restore();
}

// Reduces the player's hearts by one (ignored while invulnerable, or while
// dashing -- the dash doubles as a brief i-frame window).
function damagePlayer(amount = 1) {
  if (player.invulnerableTimer > 0 || player.isDashing) return;
  player.hearts = Math.max(0, player.hearts - amount);
  player.invulnerableTimer = HIT_INVULNERABILITY;

  triggerScreenShake(8, 12);
  spawnParticles(player.x + player.width / 2, player.y + player.height / 2, 10, {
    speedMin: 1.5, speedMax: 5, life: 20, size: 5, color: "#ef4444",
  });

  if (player.hearts === 0) {
    sfxGameOver();
  } else {
    sfxPlayerHurt();
  }
}
