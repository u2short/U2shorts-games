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
    grantsMp: false, // spending MP to make MP would be circular
  });
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
    grantsMp: false, // the cheap E bullet doesn't feed back into MP, unlike slash/cube
  });
}

// Shared by all attack types: apply damage and, unless told not to, reward
// the player for the landed hit.
function damageEnemy(enemy, amount, grantsMp = true) {
  enemy.hp -= amount;
  enemy.hitFlashTimer = HIT_FLASH_DURATION;
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
        damageEnemy(enemy, SLASH_DAMAGE);
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
          damageEnemy(enemy, p.damage, p.grantsMp !== false);
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
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(slashHitbox.x, slashHitbox.y, slashHitbox.width, slashHitbox.height);
  }

  for (const p of projectiles) {
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.width, p.height);
  }

  drawHud();
}

function drawHud() {
  // Hearts, top-left.
  const heartSize = 28;
  const heartGap = 8;
  for (let i = 0; i < player.maxHearts; i++) {
    const x = 20 + i * (heartSize + heartGap);
    ctx.fillStyle = i < player.hearts ? "#ef4444" : "#3f2020";
    ctx.fillRect(x, 20, heartSize, heartSize);
  }

  // Magic bar, just below the hearts.
  const barWidth = 200;
  const barX = 20;
  const barY = 60;
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(barX, barY, barWidth, 16);
  ctx.fillStyle = "#3b82f6";
  ctx.fillRect(barX, barY, barWidth * (player.mp / player.maxMp), 16);
  ctx.strokeStyle = "#94a3b8";
  ctx.strokeRect(barX, barY, barWidth, 16);
}
