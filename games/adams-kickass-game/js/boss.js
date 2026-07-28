// The main boss, phase 1. Three attacks so far, picked with equal chance
// each time the boss comes off cooldown:
//   Attack 1: yellow flash telegraph, then a spray of bullets aimed at the
//             player (randomized angles within a tight cone around them).
//   Attack 2: green flash telegraph, then a limb shoots straight out from
//             the boss at a fixed height (Wally Warbles-style), holds out,
//             then retracts.
//   Attack 3: red flash + squish telegraph, then the boss leaps off the top
//             of the screen, a red warning zone (half the screen wide)
//             appears over the left/middle/right, and the boss slams down
//             inside that zone -- the landing impact is what deals damage,
//             not the zone itself. It stays there afterward rather than
//             returning home, so its next leap starts from wherever it
//             currently is.
// More attacks can be added later; the random pick already scales to more
// choices.

const TELEGRAPH_DURATION = 120; // frames (~2s) the boss flashes before attacking
const FLASH_INTERVAL = 8; // frames between flash toggles during the telegraph
const ATTACK_COOLDOWN = 300; // frames of rest between attacks (5 seconds)

const BULLET_SPEED = 6;
const BULLET_DAMAGE = 1;
const BULLET_SIZE = 16;

const SCATTER_BULLET_COUNT = 12;
const SCATTER_SPREAD_DEGREES = 90; // random angle range, centered on the player's direction

// Attack 2: a limb shoots out from the boss.
const LIMB_ATTACK_DURATION = 180; // frames (~3s) total: extend + hold + retract
const LIMB_EXTEND_DURATION = 15; // frames spent shooting out to full length
const LIMB_RETRACT_DURATION = 15; // frames spent pulling back in at the end
const LIMB_LENGTH = 900; // how far it reaches from the boss
const LIMB_HEIGHT = 100; // thick, so it's harder to dodge
const LIMB_DAMAGE = 1;
const LIMB_SOCKET_WIDTH = 30; // grey marker on the boss showing where the limb will emerge

// Attack 3: leap off-screen, telegraph a landing zone, slam down into it.
const BOSS_HOME_X = 1000;
const BOSS_HOME_Y = 60;
const ATTACK3_OFFSCREEN_Y = -900; // well above the top of the 900-tall canvas
const ATTACK3_RISE_DURATION = 20; // frames spent leaping up/down between home and off-screen
const ATTACK3_WARNING_DURATION = 90; // frames (~1.5s) the red zone is shown before the slam
const ATTACK3_SLAM_DURATION = 12; // frames spent dropping into the zone -- fast, for impact
const ATTACK3_HOLD_DURATION = 30; // frames the boss stays landed before leaping back home
const ATTACK3_DAMAGE = 1;
const ATTACK3_SQUISH_AMOUNT = 0.3; // fraction of height it compresses by, at the peak of the squish
// Each zone is half the screen wide; left/middle/right cover the full height.
const ATTACK3_ZONES = [
  { x: 0, width: 800 },
  { x: 400, width: 800 },
  { x: 800, width: 800 },
];

const EXPLOSION_DURATION = 150; // frames (~2.5s) the death animation plays for
const EXPLOSION_FLASH_INTERVAL = 4;
const EXPLOSION_PARTICLE_COUNT = 30;

const CONTACT_DAMAGE = 1; // damage from touching the boss's body directly

const boss = {
  x: BOSS_HOME_X, // flush against the right wall (canvas width 1600 - boss width 600)
  y: BOSS_HOME_Y, // flush against the ground (ground y 860 - boss height 800)
  width: 600,
  height: 800,
  hp: 300,
  maxHp: 300,

  // "cooldown" (waiting) | "telegraph" (flashing, about to attack) |
  // "attack2_active" (limb is out) | "attack3_rise" / "attack3_warning" /
  // "attack3_slam" / "attack3_hold" (the leap-slam sequence -- ends back in
  // "cooldown" at wherever it landed, not back home) | "exploding" (dying) |
  // "dead" (gone -- triggers the win screen)
  state: "cooldown",
  stateTimer: ATTACK_COOLDOWN,
  flashOn: false,

  attackChoice: 1, // 1, 2, or 3 -- decided when a telegraph starts
  limbVariant: "top", // "top" or "under" the platforms -- decided when Attack 2 is chosen
  attack3Zone: null, // the chosen ATTACK3_ZONES entry -- decided when Attack 3 is chosen

  // Generic tween state used to animate the boss's position during Attack 3.
  moveFromX: 0,
  moveFromY: 0,
  moveToX: 0,
  moveToY: 0,
  moveTimer: 0,
  moveDuration: 1,

  hitFlashTimer: 0, // combat.js sets this whenever the boss takes damage
};

// combat.js damages anything in this array -- kept as `enemies` so the
// attack code (slash/magic hit detection) doesn't need to change.
const enemies = [boss];

const bullets = [];
let limbHazard = null; // the extending rectangle while Attack 2 is active, else null
let explosionParticles = [];

function updateEnemies() {
  // Runs before anything else: the moment HP hits 0, drop everything else
  // the boss was doing and start the death animation.
  if (boss.state !== "exploding" && boss.state !== "dead" && boss.hp <= 0) {
    boss.state = "exploding";
    boss.stateTimer = EXPLOSION_DURATION;
    boss.flashOn = false;
    bullets.length = 0; // fight's over, clear any bullets still in flight

    explosionParticles = [];
    const centerX = boss.x + boss.width / 2;
    const centerY = boss.y + boss.height / 2;
    for (let i = 0; i < EXPLOSION_PARTICLE_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 7;
      explosionParticles.push({
        x: centerX,
        y: centerY,
        velocityX: Math.cos(angle) * speed,
        velocityY: Math.sin(angle) * speed,
        size: 6 + Math.random() * 10,
      });
    }

    sfxExplosion();
    triggerScreenShake(24, 40);
    return;
  }

  if (boss.state === "exploding") {
    boss.stateTimer--;
    if (boss.stateTimer % EXPLOSION_FLASH_INTERVAL === 0) boss.flashOn = !boss.flashOn;
    for (const particle of explosionParticles) {
      particle.x += particle.velocityX;
      particle.y += particle.velocityY;
    }
    if (boss.stateTimer <= 0) {
      boss.state = "dead";
      sfxWin();
    }
    return;
  }

  if (boss.state === "dead") return;

  if (boss.hitFlashTimer > 0) boss.hitFlashTimer--;

  // Ambient ooze -- an occasional drip off the bottom edge, purely for
  // atmosphere. Random interval so it doesn't look mechanically regular.
  if (Math.random() < 0.02) {
    spawnParticles(boss.x + Math.random() * boss.width, boss.y + boss.height - 10, 1, {
      speedMin: 0.2, speedMax: 0.6, life: 40, size: 5, color: "#7e22ce", gravity: 0.12,
    });
  }

  // Touching the boss's body directly always hurts, regardless of what
  // attack state it's in.
  if (isColliding(player, boss)) {
    damagePlayer(CONTACT_DAMAGE);
  }

  if (boss.state === "cooldown") {
    boss.stateTimer--;
    if (boss.stateTimer <= 0) {
      boss.state = "telegraph";
      boss.stateTimer = TELEGRAPH_DURATION;
      boss.flashOn = false;
      boss.attackChoice = Math.floor(Math.random() * 3) + 1; // 1, 2, or 3
      if (boss.attackChoice === 2) {
        boss.limbVariant = Math.random() < 0.5 ? "top" : "under";
      } else if (boss.attackChoice === 3) {
        boss.attack3Zone = ATTACK3_ZONES[Math.floor(Math.random() * ATTACK3_ZONES.length)];
      }
      sfxBossTelegraph();
    }
  } else if (boss.state === "telegraph") {
    boss.stateTimer--;
    if (boss.stateTimer % FLASH_INTERVAL === 0) boss.flashOn = !boss.flashOn;
    if (boss.stateTimer <= 0) {
      if (boss.attackChoice === 1) {
        fireAttack1();
        sfxBossFireBullets();
        boss.state = "cooldown";
        boss.stateTimer = ATTACK_COOLDOWN;
      } else if (boss.attackChoice === 2) {
        boss.state = "attack2_active";
        boss.stateTimer = LIMB_ATTACK_DURATION;
        sfxBossLimb();
      } else {
        // Rises straight up from wherever it currently is -- it may not be
        // home if a previous Attack 3 already relocated it.
        startBossTween(boss.x, ATTACK3_OFFSCREEN_Y, ATTACK3_RISE_DURATION);
        boss.state = "attack3_rise";
      }
    }
  } else if (boss.state === "attack2_active") {
    updateLimbAttack();
    if (boss.stateTimer <= 0) {
      boss.state = "cooldown";
      boss.stateTimer = ATTACK_COOLDOWN;
      limbHazard = null;
    }
  } else if (boss.state === "attack3_rise") {
    if (updateBossTween()) {
      boss.state = "attack3_warning";
      boss.stateTimer = ATTACK3_WARNING_DURATION;
    }
  } else if (boss.state === "attack3_warning") {
    boss.stateTimer--;
    if (boss.stateTimer <= 0) {
      const zoneCenterX = boss.attack3Zone.x + boss.attack3Zone.width / 2 - boss.width / 2;
      boss.x = zoneCenterX; // reposition while still off-screen and invisible
      startBossTween(zoneCenterX, BOSS_HOME_Y, ATTACK3_SLAM_DURATION);
      boss.state = "attack3_slam";
    }
  } else if (boss.state === "attack3_slam") {
    if (updateBossTween()) {
      // Landed -- this is the moment of impact. The warning zone itself
      // never damaged; only this instant does.
      const zone = boss.attack3Zone;
      if (player.x + player.width > zone.x && player.x < zone.x + zone.width) {
        damagePlayer(ATTACK3_DAMAGE);
      }
      sfxBossSlamImpact();
      triggerScreenShake(18, 20);
      spawnParticles(boss.x + boss.width / 2, boss.y + boss.height, 20, {
        speedMin: 3, speedMax: 9, angleStart: Math.PI * 1.05, angleEnd: Math.PI * 1.95,
        life: 24, size: 7, color: "#a78bfa", gravity: 0.2,
      });
      boss.state = "attack3_hold";
      boss.stateTimer = ATTACK3_HOLD_DURATION;
    }
  } else if (boss.state === "attack3_hold") {
    // Stays right where it landed -- no return trip home. The next attack
    // (of any kind) starts from this new position.
    boss.stateTimer--;
    if (boss.stateTimer <= 0) {
      boss.state = "cooldown";
      boss.stateTimer = ATTACK_COOLDOWN;
    }
  }

  updateBullets();
}

// Generic position tween used to animate the boss's leap during Attack 3.
function startBossTween(toX, toY, duration) {
  boss.moveFromX = boss.x;
  boss.moveFromY = boss.y;
  boss.moveToX = toX;
  boss.moveToY = toY;
  boss.moveTimer = duration;
  boss.moveDuration = duration;
}

// Advances the tween by one frame; returns true the frame it completes.
function updateBossTween() {
  boss.moveTimer--;
  if (boss.moveTimer <= 0) {
    boss.x = boss.moveToX;
    boss.y = boss.moveToY;
    return true;
  }
  const progress = 1 - boss.moveTimer / boss.moveDuration;
  boss.x = boss.moveFromX + (boss.moveToX - boss.moveFromX) * progress;
  boss.y = boss.moveFromY + (boss.moveToY - boss.moveFromY) * progress;
  return false;
}

// Where the limb emerges from, based on which variant was picked. Floating
// platforms all share the same y/height, so any of them (index 0 is the
// ground) works as the reference for "top of" / "under" them.
function getLimbOriginY() {
  const platformY = platforms[1].y;
  const platformHeight = platforms[1].height;
  return boss.limbVariant === "top" ? platformY - LIMB_HEIGHT : platformY + platformHeight;
}

// Attack 2: a limb shoots straight out from a fixed height on the boss,
// holds at full length, then retracts. Rebuilt fresh each frame from the
// current animation progress (extend -> hold -> retract) rather than
// tracked as a standalone moving object.
function updateLimbAttack() {
  boss.stateTimer--;
  const elapsed = LIMB_ATTACK_DURATION - boss.stateTimer;

  let currentLength;
  if (elapsed <= LIMB_EXTEND_DURATION) {
    currentLength = LIMB_LENGTH * (elapsed / LIMB_EXTEND_DURATION);
  } else if (elapsed <= LIMB_ATTACK_DURATION - LIMB_RETRACT_DURATION) {
    currentLength = LIMB_LENGTH;
  } else {
    const remaining = LIMB_ATTACK_DURATION - elapsed;
    currentLength = LIMB_LENGTH * (remaining / LIMB_RETRACT_DURATION);
  }
  currentLength = Math.max(0, currentLength);

  const originX = boss.x;
  const originY = getLimbOriginY();

  limbHazard = {
    x: originX - currentLength,
    y: originY,
    width: currentLength,
    height: LIMB_HEIGHT,
  };

  if (currentLength > 0 && isColliding(player, limbHazard)) {
    damagePlayer(LIMB_DAMAGE);
  }
}

function fireAttack1() {
  fireScatterPattern();
}

// Angle from the boss's firing point to wherever the player is standing right
// now. Aimed once, at the moment the attack fires -- not a homing bullet.
function angleToPlayer(originX, originY) {
  const playerCenterX = player.x + player.width / 2;
  const playerCenterY = player.y + player.height / 2;
  return Math.atan2(playerCenterY - originY, playerCenterX - originX);
}

function fireScatterPattern() {
  const originX = boss.x;
  const originY = boss.y + boss.height / 2;
  const aimAngle = angleToPlayer(originX, originY);
  const spreadRad = (SCATTER_SPREAD_DEGREES * Math.PI) / 180;

  for (let i = 0; i < SCATTER_BULLET_COUNT; i++) {
    // Random angle within the spread, centered on the player's direction.
    const angle = aimAngle + (Math.random() - 0.5) * spreadRad;
    spawnBullet(originX, originY, angle);
  }
}

function spawnBullet(x, y, angle) {
  bullets.push({
    x: x - BULLET_SIZE / 2,
    y: y - BULLET_SIZE / 2,
    width: BULLET_SIZE,
    height: BULLET_SIZE,
    velocityX: Math.cos(angle) * BULLET_SPEED,
    velocityY: Math.sin(angle) * BULLET_SPEED,
  });
}

function updateBullets() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    bullet.x += bullet.velocityX;
    bullet.y += bullet.velocityY;

    if (isColliding(bullet, player)) {
      damagePlayer(BULLET_DAMAGE);
      bullets.splice(i, 1);
      continue;
    }

    // Clean up once a bullet is well off-screen in any direction.
    if (bullet.x < -50 || bullet.x > canvas.width + 50 || bullet.y < -50 || bullet.y > canvas.height + 50) {
      bullets.splice(i, 1);
    }
  }
}

// Boss body: a gumdrop silhouette (shared with the player, see setup.js),
// gooey wobble and dripping base turned on since this one's a slime.
function drawSlimeBody(x, y, width, height, colorTop, colorBottom) {
  buildGumdropPath(x, y, width, height, 1, 6);
  const gradient = ctx.createLinearGradient(x, y, x, y + height);
  gradient.addColorStop(0, colorTop);
  gradient.addColorStop(1, colorBottom);
  ctx.fillStyle = gradient;
  ctx.fill();

  // Glossy highlight -- clipped to the blob so it reads as light on wet
  // goo, not a sticker floating on top.
  ctx.save();
  buildGumdropPath(x, y, width, height, 1, 6);
  ctx.clip();
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(x + width * 0.34, y + height * 0.28, width * 0.15, height * 0.3, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Pulsing glowing cracks through the body -- an inner threat, not just a
  // solid shape.
  ctx.globalAlpha = 0.35 + Math.sin(frameCount * 0.08) * 0.15;
  ctx.strokeStyle = "#c026d3";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + width * 0.32, y + height * 0.4);
  ctx.lineTo(x + width * 0.45, y + height * 0.6);
  ctx.lineTo(x + width * 0.37, y + height * 0.8);
  ctx.moveTo(x + width * 0.63, y + height * 0.35);
  ctx.lineTo(x + width * 0.58, y + height * 0.58);
  ctx.lineTo(x + width * 0.7, y + height * 0.76);
  ctx.stroke();
  ctx.restore();
}

// Angry, tilted slit eyes forming a "V" -- inner corners (toward the center)
// pulled down, which reads as hostile rather than the round, friendly eyes
// this used to have.
function drawSlimeEyes(centerX, eyeY, spacing, size) {
  for (const dir of [-1, 1]) {
    const ex = centerX + dir * spacing;

    ctx.save();
    ctx.translate(ex, eyeY);
    ctx.rotate(-dir * 0.3);
    ctx.shadowColor = "#f43f5e";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#fb7185";
    ctx.beginPath();
    ctx.ellipse(0, 0, size, size * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(ex, eyeY);
    ctx.rotate(-dir * 0.3);
    ctx.fillStyle = "#450a0a";
    ctx.beginPath();
    ctx.arc(dir * size * 0.3, 0, size * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawEnemies() {
  if (boss.state === "dead") return; // boss is gone -- draw() switches to the win screen

  if (boss.state === "exploding") {
    ctx.save();
    ctx.shadowColor = "#f97316";
    ctx.shadowBlur = 30;
    ctx.fillStyle = boss.flashOn ? "#ffffff" : "#f97316";
    ctx.fillRect(boss.x, boss.y, boss.width, boss.height);
    ctx.restore();

    ctx.fillStyle = "#f97316";
    for (const particle of explosionParticles) {
      ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
    }
    return;
  }

  let bodyColor = "#3b0764";
  let shadeColor = "#0c0a1a";
  if (boss.state === "telegraph" && boss.flashOn) {
    // Takes priority -- the attack warning must stay readable.
    if (boss.attackChoice === 2) { bodyColor = "#4ade80"; shadeColor = "#14532d"; }
    else if (boss.attackChoice === 3) { bodyColor = "#f87171"; shadeColor = "#7f1d1d"; }
    else { bodyColor = "#fde047"; shadeColor = "#854d0e"; }
  }

  // Attack 3's telegraph also squishes the boss down, anchored to the
  // ground, as anticipation for the leap -- grows more squished the closer
  // it gets to jumping.
  let drawX = boss.x;
  let drawY = boss.y;
  let drawWidth = boss.width;
  let drawHeight = boss.height;
  if (boss.state === "telegraph" && boss.attackChoice === 3) {
    const progress = 1 - boss.stateTimer / TELEGRAPH_DURATION;
    drawHeight = boss.height * (1 - ATTACK3_SQUISH_AMOUNT * progress);
    drawY = boss.y + (boss.height - drawHeight);
  } else if (boss.state === "cooldown") {
    // Slow gooey squash-and-stretch pulse instead of a rigid idle -- a slime
    // breathing, not a block.
    const pulse = Math.sin(frameCount * 0.05) * 0.025;
    drawHeight = boss.height * (1 + pulse);
    drawWidth = boss.width * (1 - pulse * 0.5);
    drawY = boss.y + (boss.height - drawHeight);
    drawX = boss.x + (boss.width - drawWidth) / 2;
  }

  drawSlimeBody(drawX, drawY, drawWidth, drawHeight, bodyColor, shadeColor);

  // Hit-flash washes a translucent white overlay across the body -- kept
  // separate from bodyColor so it never fights the telegraph color for
  // priority (telegraph must always stay readable).
  if (boss.hitFlashTimer > 0) {
    ctx.globalAlpha = boss.hitFlashTimer / HIT_FLASH_DURATION;
    ctx.fillStyle = "#ffffff";
    buildGumdropPath(drawX, drawY, drawWidth, drawHeight, 1, 6);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Angry slit eyes, tilted into a "V" -- sit in the wider "shoulder" band
  // of the gumdrop, not the narrow dome tip. The one bit of face this
  // ominous mass gets, and it should read as hostile, not friendly.
  const eyeY = drawY + drawHeight * 0.32;
  const eyeSpacing = drawWidth * 0.15;
  const eyeSize = drawWidth * 0.07;
  drawSlimeEyes(drawX + drawWidth / 2, eyeY, eyeSpacing, eyeSize);

  // Socket marking where the limb emerges from -- visible during its
  // telegraph (so you can see it coming) and while the limb is out. Tinted
  // to match the goo instead of a flat mechanical grey.
  if (boss.attackChoice === 2 && (boss.state === "telegraph" || boss.state === "attack2_active")) {
    const socketGradient = ctx.createLinearGradient(boss.x - LIMB_SOCKET_WIDTH, 0, boss.x, 0);
    socketGradient.addColorStop(0, "#4c1d95");
    socketGradient.addColorStop(1, "#7e22ce");
    fillRoundedRect(boss.x - LIMB_SOCKET_WIDTH, getLimbOriginY(), LIMB_SOCKET_WIDTH, LIMB_HEIGHT, 10, socketGradient);
  }

  // Attack 3's landing-zone warning -- full screen height, half the width.
  // Semi-transparent and slowly pulsing, toxic purple to match the slime
  // rather than a generic red danger overlay.
  if (boss.state === "attack3_warning" || boss.state === "attack3_slam") {
    const pulse = 0.28 + Math.sin(frameCount * 0.2) * 0.08;
    ctx.fillStyle = `rgba(192, 38, 211, ${pulse})`;
    ctx.fillRect(boss.attack3Zone.x, 0, boss.attack3Zone.width, canvas.height);
  }

  // Bullets: tiny gumdrop droplets, same species as the boss, glowing goo-purple.
  ctx.save();
  ctx.shadowColor = "#c026d3";
  ctx.shadowBlur = 12;
  for (const bullet of bullets) {
    const dropletGradient = ctx.createLinearGradient(bullet.x, bullet.y, bullet.x, bullet.y + bullet.height);
    dropletGradient.addColorStop(0, "#f0abfc");
    dropletGradient.addColorStop(1, "#86198f");
    buildGumdropPath(bullet.x, bullet.y, bullet.width, bullet.height, 0, 0);
    ctx.fillStyle = dropletGradient;
    ctx.fill();
  }
  ctx.restore();

  if (limbHazard && limbHazard.width > 0) {
    drawGooTendril(limbHazard.x, limbHazard.y, limbHazard.width, limbHazard.height);
  }
}

// A wavy-edged tendril of goo, same palette as the boss body, used for
// Attack 2's limb -- reads as an extension of the slime rather than a
// generic red bar.
function drawGooTendril(x, y, width, height) {
  const segments = 10;
  const waveAmp = height * 0.06;
  const t = frameCount * 0.15;

  ctx.beginPath();
  for (let i = 0; i <= segments; i++) {
    const px = x + (width / segments) * i;
    const wave = Math.sin(t + i * 0.8) * waveAmp;
    if (i === 0) ctx.moveTo(px, y + wave);
    else ctx.lineTo(px, y + wave);
  }
  ctx.quadraticCurveTo(x + width + height * 0.08, y + height / 2, x + width, y + height + Math.sin(t + segments * 0.8 + 1.5) * waveAmp);
  for (let i = segments; i >= 0; i--) {
    const px = x + (width / segments) * i;
    const wave = Math.sin(t + i * 0.8 + 1.5) * waveAmp;
    ctx.lineTo(px, y + height + wave);
  }
  ctx.closePath();

  const gradient = ctx.createLinearGradient(x, y, x, y + height);
  gradient.addColorStop(0, "#e879f9");
  gradient.addColorStop(0.5, "#a21caf");
  gradient.addColorStop(1, "#e879f9");

  ctx.save();
  ctx.shadowColor = "#c026d3";
  ctx.shadowBlur = 18;
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.restore();
}
