// Player combat: left-click melee slash, right-click magic cube, damage
// dealing, and magic-point gain. Enemy health/HP bars live in enemy.js;
// player hearts/mp live on the player object in player.js.

const SLASH_DAMAGE = 2;
const SLASH_DURATION = 10; // frames the slash hitbox stays active
const SLASH_COOLDOWN = 20; // frames before another slash can start

const MAGIC_DAMAGE = 50;
const MAGIC_COST = 50;
const MAGIC_SPEED = 10;

const MAGIC_BULLET_DAMAGE = 1;
const MAGIC_BULLET_COST = 1;
const MAGIC_BULLET_SPEED = 14;
const MAGIC_BULLET_SIZE = 14;
const MAGIC_BULLET_KEYS = ["KeyE"];

const MP_PER_HIT = 2;
const MP_REGEN_AMOUNT = 0.5;
const MP_REGEN_INTERVAL = 120; // frames between passive ticks (~2s at 60fps)

const HIT_FLASH_DURATION = 6; // frames an enemy flashes white after taking damage

let slashTimer = 0;
let slashCooldownTimer = 0;
let slashHitbox = null;
let hitEnemiesThisSwing = new Set(); // stops one swing hitting the same enemy every frame it's active
let mpRegenTimer = 0;

const projectiles = [];

window.addEventListener("mousedown", (e) => {
  if (e.button === 0) startSlash();
  else if (e.button === 2) castMagic();
});

// Stop the browser's right-click context menu from popping up over the game.
window.addEventListener("contextmenu", (e) => e.preventDefault());

function startSlash() {
  if (slashCooldownTimer > 0) return;
  slashTimer = SLASH_DURATION;
  slashCooldownTimer = SLASH_COOLDOWN;
  hitEnemiesThisSwing = new Set();
  sfxSlash();
}

function castMagic() {
  if (player.mp < MAGIC_COST) return;
  player.mp -= MAGIC_COST;

  const width = player.width * 2;
  const height = player.height * 2;
  projectiles.push({
    x: player.facing === 1 ? player.x + player.width : player.x - width,
    y: player.y + player.height / 2 - height / 2,
    width,
    height,
    velocityX: MAGIC_SPEED * player.facing,
    hasHit: false,
    damage: MAGIC_DAMAGE,
    color: "#3b82f6",
    shape: "cube",
    grantsMp: false, // spending MP to make MP would be circular
  });
  sfxMagicCube();
}

function castMagicBullet() {
  if (player.mp < MAGIC_BULLET_COST) return;
  player.mp -= MAGIC_BULLET_COST;

  const width = MAGIC_BULLET_SIZE;
  const height = MAGIC_BULLET_SIZE;
  projectiles.push({
    x: player.facing === 1 ? player.x + player.width : player.x - width,
    y: player.y + player.height / 2 - height / 2,
    width,
    height,
    velocityX: MAGIC_BULLET_SPEED * player.facing,
    hasHit: false,
    damage: MAGIC_BULLET_DAMAGE,
    color: "#22d3ee",
    shape: "bullet",
    grantsMp: false, // the cheap E bullet doesn't feed back into MP, unlike slash/cube
  });
  sfxMagicBullet();
}

// Shared by all attack types: apply damage and, unless told not to, reward
// the player for the landed hit. hitX/hitY (optional) place the impact spark.
function damageEnemy(enemy, amount, grantsMp = true, hitX, hitY) {
  enemy.hp -= amount;
  enemy.hitFlashTimer = HIT_FLASH_DURATION;
  sfxEnemyHit();
  triggerScreenShake(3, 6);
  if (hitX !== undefined) {
    spawnParticles(hitX, hitY, 8, {
      speedMin: 1.5, speedMax: 4.5, life: 16, size: 4, color: "#fbbf24",
    });
  }
  if (grantsMp) {
    player.mp = Math.min(player.maxMp, player.mp + MP_PER_HIT);
  }
}

function updateCombat() {
  if (slashCooldownTimer > 0) slashCooldownTimer--;

  // Passive MP regen: a fixed amount every fixed number of frames, independent
  // of hitting anything.
  mpRegenTimer++;
  if (mpRegenTimer >= MP_REGEN_INTERVAL) {
    mpRegenTimer -= MP_REGEN_INTERVAL;
    player.mp = Math.min(player.maxMp, player.mp + MP_REGEN_AMOUNT);
  }

  if (isAnyJustPressed(MAGIC_BULLET_KEYS)) castMagicBullet();

  if (slashTimer > 0) {
    slashTimer--;
    // Hitbox is the same size as the player, placed flush against whichever
    // side the player is facing.
    slashHitbox = {
      x: player.facing === 1 ? player.x + player.width : player.x - player.width,
      y: player.y,
      width: player.width,
      height: player.height,
    };

    for (const enemy of enemies) {
      if (enemy.hp > 0 && !hitEnemiesThisSwing.has(enemy) && isColliding(slashHitbox, enemy)) {
        hitEnemiesThisSwing.add(enemy);
        damageEnemy(enemy, SLASH_DAMAGE, true, slashHitbox.x + slashHitbox.width / 2, slashHitbox.y + slashHitbox.height / 2);
      }
    }
  } else {
    slashHitbox = null;
  }

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.x += p.velocityX;

    if (!p.hasHit) {
      for (const enemy of enemies) {
        if (enemy.hp > 0 && isColliding(p, enemy)) {
          p.hasHit = true;
          damageEnemy(enemy, p.damage, p.grantsMp !== false, p.x + p.width / 2, p.y + p.height / 2);
          break;
        }
      }
    }

    if (p.hasHit || p.x + p.width < 0 || p.x > canvas.width) {
      projectiles.splice(i, 1);
    }
  }
}

function drawCombat() {
  if (slashHitbox) {
    // A few curved, fading swipe lines instead of a flat rectangle --
    // reads as a slash rather than a hitbox debug overlay.
    const progress = 1 - slashTimer / SLASH_DURATION; // 0 -> 1 across the swing
    const originX = player.facing === 1 ? slashHitbox.x : slashHitbox.x + slashHitbox.width;
    const originY = slashHitbox.y + slashHitbox.height / 2;
    const reach = slashHitbox.width;

    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - progress);
    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.shadowColor = "#f8fafc";
    ctx.shadowBlur = 8;
    for (let i = -1; i <= 1; i++) {
      const spread = i * slashHitbox.height * 0.28;
      ctx.beginPath();
      ctx.moveTo(originX, originY + spread * 0.4);
      ctx.quadraticCurveTo(
        originX + player.facing * reach * 0.5, originY + spread,
        originX + player.facing * reach * progress, originY + spread * (1 - progress)
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  for (const p of projectiles) {
    ctx.save();
    ctx.shadowColor = p.color;
    ctx.shadowBlur = p.shape === "cube" ? 25 : 12;
    ctx.fillStyle = p.color;
    if (p.shape === "cube") {
      // A gentle pulse so the big attack reads as "charged energy," not a static block.
      const pulse = 0.9 + Math.sin(frameCount * 0.3) * 0.1;
      const w = p.width * pulse;
      const h = p.height * pulse;
      fillRoundedRect(p.x + (p.width - w) / 2, p.y + (p.height - h) / 2, w, h, 12, p.color);
    } else {
      ctx.beginPath();
      ctx.arc(p.x + p.width / 2, p.y + p.height / 2, p.width / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawHud() {
  // Translucent panel behind the hearts/MP so they stay readable over any background.
  fillRoundedRect(10, 10, 240, 78, 12, "rgba(15, 23, 42, 0.55)");

  // Hearts, drawn as actual heart shapes.
  const heartSize = 26;
  const heartGap = 8;
  for (let i = 0; i < player.maxHearts; i++) {
    const cx = 20 + i * (heartSize + heartGap) + heartSize / 2;
    drawHeartShape(cx, 22, heartSize, i < player.hearts ? "#ef4444" : "#3f2020");
  }

  // Magic bar, just below the hearts.
  const barWidth = 200;
  const barX = 20;
  const barY = 58;
  const barHeight = 18;
  fillRoundedRect(barX, barY, barWidth, barHeight, 9, "#1e293b");

  const fillWidth = barWidth * (player.mp / player.maxMp);
  if (fillWidth > 1) {
    const mpGradient = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
    mpGradient.addColorStop(0, "#0ea5e9");
    mpGradient.addColorStop(1, "#38bdf8");
    ctx.save();
    if (player.mp >= MAGIC_COST) {
      ctx.shadowColor = "#38bdf8";
      ctx.shadowBlur = 10;
    }
    fillRoundedRect(barX, barY, fillWidth, barHeight, 9, mpGradient);
    ctx.restore();
  }

  ctx.strokeStyle = "rgba(148, 163, 184, 0.6)";
  ctx.lineWidth = 1.5;
  roundedRectPath(barX, barY, barWidth, barHeight, 9);
  ctx.stroke();
}

// Classic two-lobe heart shape, top-left corner at (cx - size/2, topY).
function drawHeartShape(cx, topY, size, color) {
  ctx.fillStyle = color;
  const top = topY + size * 0.3;
  ctx.beginPath();
  ctx.moveTo(cx, top);
  ctx.bezierCurveTo(cx, topY, cx - size / 2, topY, cx - size / 2, top);
  ctx.bezierCurveTo(cx - size / 2, topY + size * 0.66, cx, topY + size * 0.8, cx, topY + size);
  ctx.bezierCurveTo(cx, topY + size * 0.8, cx + size / 2, topY + size * 0.66, cx + size / 2, top);
  ctx.bezierCurveTo(cx + size / 2, topY, cx, topY, cx, top);
  ctx.closePath();
  ctx.fill();
}
