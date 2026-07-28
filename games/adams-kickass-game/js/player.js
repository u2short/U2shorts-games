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
  if (player.onGround && player.groundIsOneWay && isAnyPressed(DOWN_KEYS)) {
    player.dropThroughTimer = DROP_THROUGH_DURATION;
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
    if (keys["ArrowLeft"] || keys["KeyA"]) {
      player.velocityX = -MOVE_SPEED;
      player.facing = -1;
    } else if (keys["ArrowRight"] || keys["KeyD"]) {
      player.velocityX = MOVE_SPEED;
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
    }

    // --- Gravity ---
    player.velocityY += GRAVITY;
  }

  // Feet position before this frame's movement -- one-way platforms use this
  // to tell "falling onto it from above" apart from "rising into it from
  // below," which the generic AABB overlap check alone can't distinguish.
  const prevBottom = player.y + player.height;

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
  // Blink on/off for the whole invulnerability window after taking a hit.
  if (player.invulnerableTimer > 0 && Math.floor(player.invulnerableTimer / HIT_FLASH_INTERVAL) % 2 === 0) {
    return;
  }

  ctx.fillStyle = player.isDashing ? "#7dd3fc" : "#4ade80";
  ctx.fillRect(player.x, player.y, player.width, player.height);
}

// Reduces the player's hearts by one (ignored while invulnerable, or while
// dashing -- the dash doubles as a brief i-frame window).
function damagePlayer(amount = 1) {
  if (player.invulnerableTimer > 0 || player.isDashing) return;
  player.hearts = Math.max(0, player.hearts - amount);
  player.invulnerableTimer = HIT_INVULNERABILITY;
}
