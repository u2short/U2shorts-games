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
//             not the zone itself. It stays put wherever it lands (its next
//             leap starts from there, not from its original spot), and its
//             wide body overlaps and hides whatever platform is underneath
//             until it leaps away again.
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
  // "attack3_slam" / "attack3_hold" (the leap-slam sequence -- ends by going
  // straight back to "cooldown" wherever it landed, no return trip) |
  // "exploding" (dying) | "dead" (gone -- triggers the win screen)
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
    }
    return;
  }

  if (boss.state === "dead") return;

  if (boss.hitFlashTimer > 0) boss.hitFlashTimer--;

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
    }
  } else if (boss.state === "telegraph") {
    boss.stateTimer--;
    if (boss.stateTimer % FLASH_INTERVAL === 0) boss.flashOn = !boss.flashOn;
    if (boss.stateTimer <= 0) {
      if (boss.attackChoice === 1) {
        fireAttack1();
        boss.state = "cooldown";
        boss.stateTimer = ATTACK_COOLDOWN;
      } else if (boss.attackChoice === 2) {
        boss.state = "attack2_active";
        boss.stateTimer = LIMB_ATTACK_DURATION;
      } else {
        // Rises straight up from wherever it currently is -- it no longer
        // snaps back to BOSS_HOME_X first, since it may already be standing
        // somewhere else from a previous leap.
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
      boss.state = "attack3_hold";
      boss.stateTimer = ATTACK3_HOLD_DURATION;
    }
  } else if (boss.state === "attack3_hold") {
    boss.stateTimer--;
    if (boss.stateTimer <= 0) {
      // Stays right where it landed instead of leaping back home -- its next
      // attack (of any kind) fires from this new spot.
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

function drawEnemies() {
  if (boss.state === "dead") return; // boss is gone -- draw() switches to the win screen

  if (boss.state === "exploding") {
    ctx.fillStyle = boss.flashOn ? "#ffffff" : "#f97316";
    ctx.fillRect(boss.x, boss.y, boss.width, boss.height);

    ctx.fillStyle = "#f97316";
    for (const particle of explosionParticles) {
      ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
    }
    return;
  }

  let bodyColor = "#7c3aed";
  if (boss.hitFlashTimer > 0) {
    bodyColor = "#ffffff";
  }
  if (boss.state === "telegraph" && boss.flashOn) {
    // Takes priority -- the attack warning must stay readable.
    if (boss.attackChoice === 2) bodyColor = "#22c55e";
    else if (boss.attackChoice === 3) bodyColor = "#ef4444";
    else bodyColor = "#facc15";
  }

  // Attack 3's telegraph also squishes the boss down, anchored to the
  // ground, as anticipation for the leap -- grows more squished the closer
  // it gets to jumping.
  let drawHeight = boss.height;
  let drawY = boss.y;
  if (boss.state === "telegraph" && boss.attackChoice === 3) {
    const progress = 1 - boss.stateTimer / TELEGRAPH_DURATION;
    drawHeight = boss.height * (1 - ATTACK3_SQUISH_AMOUNT * progress);
    drawY = boss.y + (boss.height - drawHeight);
  }

  ctx.fillStyle = bodyColor;
  ctx.fillRect(boss.x, drawY, boss.width, drawHeight);

  // Grey socket marking where the limb emerges from -- visible during its
  // telegraph (so you can see it coming) and while the limb is out.
  if (boss.attackChoice === 2 && (boss.state === "telegraph" || boss.state === "attack2_active")) {
    ctx.fillStyle = "#6b7280";
    ctx.fillRect(boss.x - LIMB_SOCKET_WIDTH, getLimbOriginY(), LIMB_SOCKET_WIDTH, LIMB_HEIGHT);
  }

  // Attack 3's landing-zone warning -- full screen height, half the width.
  // Semi-transparent on purpose: it's a warning, not an active hazard.
  if (boss.state === "attack3_warning" || boss.state === "attack3_slam") {
    ctx.fillStyle = "rgba(239, 68, 68, 0.35)";
    ctx.fillRect(boss.attack3Zone.x, 0, boss.attack3Zone.width, canvas.height);
  }

  ctx.fillStyle = "#ef4444";
  for (const bullet of bullets) {
    ctx.beginPath();
    ctx.arc(bullet.x + bullet.width / 2, bullet.y + bullet.height / 2, bullet.width / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  if (limbHazard && limbHazard.width > 0) {
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(limbHazard.x, limbHazard.y, limbHazard.width, limbHazard.height);
  }
}
