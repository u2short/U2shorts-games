// The main boss, phase 1. Four attacks so far, picked with equal chance
// each time the boss comes off cooldown:
//   Attack 1: yellow flash telegraph, then rapid-fire minigun-style: single
//             bullets aimed at the player (with a little spread per shot)
//             fired in quick succession for a few seconds, rather than one
//             big burst. Fired from a mouth that opens on whichever side of
//             the boss the player is currently on, chomping open with each
//             shot -- so both the origin point and the visual telegraph
//             track the player, not a fixed side.
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
//   Attack 4: cyan flash telegraph, then the boss rises and sticks to the
//             ceiling and lobs slow, giant slime blobs down at the player.
//             Any blob that reaches the ground or a platform splats into a
//             puddle that slows the player while they're standing in it.
//             The boss returns to the ground afterward (its x doesn't
//             change, only its y).
// More attacks can be added later; the random pick already scales to more
// choices.
//
// Death sequence (once hp hits 0): the boss looks up ("lookup"), a cartoon
// anvil drops out of the sky onto it ("anvil_fall"), it flattens in a burst
// of slime with the anvil resting on top ("crush"), the flattened pile
// slides down and fades out ("falloff"), then a dark silhouette of the next
// boss -- a giant troll -- fades into the background as a teaser
// ("reveal") before the fight officially ends. The troll is just a visual
// placeholder here; it isn't a functional boss.

const TELEGRAPH_DURATION = 120; // frames (~2s) the boss flashes before attacking
const FLASH_INTERVAL = 8; // frames between flash toggles during the telegraph
const ATTACK_COOLDOWN = 300; // frames of rest between attacks (5 seconds)

const BULLET_SPEED = 6;
const BULLET_DAMAGE = 1;
const BULLET_SIZE = 16;

// Attack 1: sustained rapid fire instead of one burst.
const ATTACK1_DURATION = 150; // frames (~2.5s) of continuous firing
const ATTACK1_FIRE_INTERVAL = 6; // frames between shots -- rapid, minigun-like
const ATTACK1_SPREAD_DEGREES = 12; // small per-shot inaccuracy, not a wide scatter cone
const ATTACK1_MOUTH_Y_RATIO = 0.55; // where the firing mouth sits, as a fraction of the boss's height
const ATTACK1_TILT_ANGLE = 0.18; // radians the whole body leans toward the player while lining up the shot

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
const BOSS_HOME_Y = 310; // ground y 860 - boss height 550
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

// Death sequence: a cartoon multi-beat gag instead of a plain explosion --
// the boss looks up, an anvil drops on it, it flattens in a burst of slime,
// then slides off, revealing a teaser silhouette of the next boss (whose
// giant cyan hands then slam down and crack the ground as an extra flourish).
const DEATH_LOOKUP_DURATION = 70; // frames (~1.2s) -- "uh oh" beat before the anvil appears
const DEATH_ANVIL_START_Y = -400; // starts well off the top of the screen
const DEATH_ANVIL_FALL_DURATION = 28; // frames -- fast, cartoon-style drop
const DEATH_ANVIL_WIDTH = 220;
const DEATH_ANVIL_HEIGHT = 130;
const DEATH_CRUSH_HOLD_DURATION = 55; // frames the flattened pose + slime burst holds
const DEATH_CRUSH_SPLATTER_COUNT = 50;
const DEATH_FALLOFF_DURATION = 70; // frames the flattened pile slides down and fades
const DEATH_FALLOFF_DISTANCE = 400; // px it slides down while fading
const DEATH_REVEAL_DURATION = 150; // frames (~2.5s) the troll silhouette fades in and holds
const DEATH_FLASH_INTERVAL = 4;
const DEATH_ARM_SLAM_DURATION = 55; // frames (~0.9s) its cyan arms slam down and crack the arena open
const DEATH_FALL_DURATION = 45; // frames (~0.75s) falling through the broken floor into the next plane
const DEATH_OGRE_DURATION = 150; // frames (~2.5s) the giant ogre head holds before cutting to the win screen

const TROLL_BODY_WIDTH = 900; // big and centered, not tucked off to one side
const TROLL_BODY_HEIGHT = 760;

const TROLL_ARM_WIDTH = 110;
const TROLL_ARM_LENGTH = 640; // a full arm, not just a hand
const TROLL_ARM_X = [260, 1340]; // where the arms punch through, bracketing the centered troll

const OGRE_EYE_COLOR = "#f97316";

const CONTACT_DAMAGE = 1; // damage from touching the boss's body directly

// Proximity punish: independent of the attack rotation above -- can trigger
// any time the player lingers right next to the boss, regardless of what
// else is going on.
const PROXIMITY_MARGIN = 60; // px around the hitbox that counts as "too close"
const PROXIMITY_TRIGGER_DURATION = 240; // frames (4s) of continuous closeness before it fires
const PROXIMITY_WARNING_DURATION = 90; // frames (~1.5s) green indicator before the rain starts
const SLIME_RAIN_DURATION = 150; // frames (~2.5s) -- not too long, not too short
const SLIME_RAIN_DROP_INTERVAL = 40; // frames between new drops spawning
const SLIME_RAIN_DAMAGE = 1;
const SLIME_RAIN_FALL_SPEED = 7;
const SLIME_RAIN_SIDE_REACH = 1000; // how far out to the sides drops can land
const SLIME_RAIN_SLOT_GAP = 24; // enforced empty space between adjacent drop slots
const SLIME_RAIN_PATTERNS = ["alternate", "fillOneSideFirst", "spacedRandom"];

// Attack 4: stick to the ceiling and lob giant blobs that puddle on impact.
const ATTACK4_CEILING_Y = 0; // boss's dome sits right at the top of the screen
const ATTACK4_RISE_DURATION = 25; // frames spent traveling to/from the ceiling
const ATTACK4_SHOOT_DURATION = 210; // frames (~3.5s) stuck to the ceiling, firing
const ATTACK4_BLOB_INTERVAL = 55; // frames between blob shots
const ATTACK4_BLOB_SIZE = 140; // "giant" -- 2x the original, much bigger than a regular bullet
const ATTACK4_BLOB_SPEED = 6;
const ATTACK4_BLOB_DAMAGE = 1;
const ATTACK4_SQUISH_AMOUNT = 0.45; // fraction of height it's flattened by while stuck to the ceiling
const SLIME_PUDDLE_DURATION = 600; // frames (10s)
const SLIME_PUDDLE_HEIGHT = 14; // flattened, unlike the round blob that made it
const SLIME_PUDDLE_SPEED_MULTIPLIER = 0.65; // "slows the player down by a little"

const boss = {
  x: BOSS_HOME_X, // flush against the right wall (canvas width 1600 - boss width 600)
  y: BOSS_HOME_Y, // flush against the ground
  width: 600,
  height: 550,
  hp: 500,
  maxHp: 500,

  // "cooldown" (waiting) | "telegraph" (flashing, about to attack) |
  // "attack1_active" (rapid-firing) | "attack2_active" (limb is out) |
  // "attack3_rise" / "attack3_warning" / "attack3_slam" / "attack3_hold"
  // (the leap-slam sequence -- ends back in "cooldown" at wherever it
  // landed, not back home) | "attack4_rise" / "attack4_shoot" /
  // "attack4_descend" (ceiling blob barrage) | "exploding" (dying -- see
  // deathPhase for which beat of the death sequence is playing) |
  // "dead" (gone -- triggers the win screen)
  state: "cooldown",
  stateTimer: ATTACK_COOLDOWN,
  flashOn: false,

  // Death sequence sub-state -- only meaningful while state === "exploding".
  // "lookup" -> "anvil_fall" -> "crush" -> "falloff" -> "reveal" ->
  // "armSlam" -> "fallThrough" -> "ogreReveal" -> done.
  deathPhase: "lookup",
  deathPhaseTimer: 0,
  anvilY: DEATH_ANVIL_START_Y,
  falloffOffset: 0, // how far the flattened pile has slid down during "falloff"

  attackChoice: 1, // 1, 2, 3, or 4 -- decided when a telegraph starts
  limbVariant: "top", // "top" or "under" the platforms -- decided when Attack 2 is chosen
  limbDirection: 1, // 1 = right, -1 = left -- locked in when Attack 2 actually starts extending
  attack3Zone: null, // the chosen ATTACK3_ZONES entry -- decided when Attack 3 is chosen

  // Proximity punish -- runs independently of attackChoice/state above.
  proximityTimer: 0, // frames the player has been continuously too close
  proximityState: "none", // "none" | "warning" | "raining"
  proximityStateTimer: 0,
  slimeRainPattern: "alternate", // picked fresh each time the rain starts -- see SLIME_RAIN_PATTERNS
  slimeRainSpawnIndex: 0,
  slimeRainSlotCounter: { left: 0, right: 0 },

  // Generic tween state used to animate the boss's position (Attack 3's
  // leap-slam and Attack 4's trip to/from the ceiling).
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
let attack1FireTimer = 0;
const slimeRainDrops = []; // falling boulder-sized slime chunks from the proximity punish
let slimeRainSpawnTimer = 0;
const attack4Blobs = []; // giant slow projectiles lobbed from the ceiling during Attack 4
const slimePuddles = []; // splatted on the ground/a platform where a blob landed
let attack4BlobSpawnTimer = 0;

// Two rectangles approximating the gumdrop silhouette instead of the full
// bounding box: a narrower "dome" up top, a near-full-width "body" below.
// Matches buildGumdropPath's proportions (see setup.js) closely enough for
// gameplay purposes without needing true polygon collision.
function getBossHitboxes() {
  const domeHeight = boss.height * 0.26;
  const domeWidth = boss.width * 0.42;
  const domeX = boss.x + (boss.width - domeWidth) / 2;

  return [
    { x: domeX, y: boss.y, width: domeWidth, height: domeHeight },
    { x: boss.x + boss.width * 0.04, y: boss.y + domeHeight, width: boss.width * 0.92, height: boss.height - domeHeight },
  ];
}

function isCollidingBoss(rect) {
  return getBossHitboxes().some((hitbox) => isColliding(rect, hitbox));
}

// Used by combat.js's slash/projectile hit checks -- special-cases the boss
// to use its two-rectangle hitbox; anything else falls back to plain AABB.
function isCollidingWithEnemy(rect, enemy) {
  if (enemy === boss) return isCollidingBoss(rect);
  return isColliding(rect, enemy);
}

// True if rect overlaps the boss's hitbox, inflated by PROXIMITY_MARGIN --
// used to mean "standing right next to it," not just literal contact.
function isNearBoss(rect, margin) {
  return getBossHitboxes().some((hitbox) =>
    isColliding(rect, {
      x: hitbox.x - margin,
      y: hitbox.y - margin,
      width: hitbox.width + margin * 2,
      height: hitbox.height + margin * 2,
    })
  );
}

// Independent of the attack rotation: if the player lingers too close for
// PROXIMITY_TRIGGER_DURATION, a green warning shows on the player, then
// huge slime chunks rain down on both sides of the boss for a while. Once
// triggered, it plays out fully even if the player then backs away.
function updateProximityPunish() {
  if (boss.proximityState === "none") {
    if (isNearBoss(player, PROXIMITY_MARGIN)) {
      boss.proximityTimer++;
      if (boss.proximityTimer >= PROXIMITY_TRIGGER_DURATION) {
        boss.proximityState = "warning";
        boss.proximityStateTimer = PROXIMITY_WARNING_DURATION;
        boss.proximityTimer = 0;
        sfxProximityWarning();
      }
    } else {
      boss.proximityTimer = 0;
    }
  } else if (boss.proximityState === "warning") {
    boss.proximityStateTimer--;
    if (boss.proximityStateTimer <= 0) {
      boss.proximityState = "raining";
      boss.proximityStateTimer = SLIME_RAIN_DURATION;
      slimeRainSpawnTimer = 0;
      // A fresh pattern each time -- see SLIME_RAIN_PATTERNS -- so
      // consecutive rains don't all look identical.
      boss.slimeRainPattern = SLIME_RAIN_PATTERNS[Math.floor(Math.random() * SLIME_RAIN_PATTERNS.length)];
      boss.slimeRainSpawnIndex = 0;
      boss.slimeRainSlotCounter = { left: 0, right: 0 };
    }
  } else if (boss.proximityState === "raining") {
    boss.proximityStateTimer--;
    slimeRainSpawnTimer--;
    if (slimeRainSpawnTimer <= 0) {
      const spawn = pickNextSlimeRainSpawn();
      if (spawn) spawnSlimeRainDrop(spawn.side, spawn.x);
      slimeRainSpawnTimer = SLIME_RAIN_DROP_INTERVAL;
    }
    if (boss.proximityStateTimer <= 0) {
      boss.proximityState = "none";
    }
  }

  updateSlimeRainDrops(); // always runs, so drops mid-fall finish even after the phase ends
}

// The set of non-overlapping x positions ("slots") a drop can land in on the
// given side, evenly spaced with SLIME_RAIN_SLOT_GAP between them so no two
// drops ever land on top of each other. Returns [] if there's no room at all
// (e.g. the boss is flush against a wall on that side).
function getSlimeRainSlots(side) {
  const dropWidth = boss.width * 0.5;
  let minX, maxX;
  if (side === -1) {
    minX = Math.max(0, boss.x - SLIME_RAIN_SIDE_REACH);
    maxX = boss.x - 20;
  } else {
    minX = boss.x + boss.width + 20;
    maxX = Math.min(canvas.width, boss.x + boss.width + SLIME_RAIN_SIDE_REACH);
  }

  const available = maxX - minX;
  if (available < dropWidth) return [];

  const slotStride = dropWidth + SLIME_RAIN_SLOT_GAP;
  const slotCount = Math.max(1, Math.floor((available - dropWidth) / slotStride) + 1);

  const slots = [];
  for (let i = 0; i < slotCount; i++) {
    slots.push(Math.min(minX + i * slotStride, canvas.width - dropWidth));
  }
  return slots;
}

// Decides where the next drop lands, following whichever pattern was picked
// for this rain. All three patterns route through getSlimeRainSlots so
// consecutive drops always land in different spots -- the patterns differ
// in the ORDER they visit those spots, not whether they overlap.
function pickNextSlimeRainSpawn() {
  const index = boss.slimeRainSpawnIndex++;
  let side, slotIndex;

  if (boss.slimeRainPattern === "fillOneSideFirst") {
    const leftSlots = getSlimeRainSlots(-1);
    if (index < leftSlots.length) {
      side = -1;
      slotIndex = index;
    } else {
      side = 1;
      slotIndex = index - leftSlots.length;
    }
  } else if (boss.slimeRainPattern === "alternate") {
    side = index % 2 === 0 ? -1 : 1;
    slotIndex = Math.floor(index / 2);
  } else {
    // spacedRandom -- random side each time, but still cycling through that
    // side's slots in order rather than picking a random x within them.
    side = Math.random() < 0.5 ? -1 : 1;
    const key = side === -1 ? "left" : "right";
    slotIndex = boss.slimeRainSlotCounter[key]++;
  }

  let slots = getSlimeRainSlots(side);
  if (slots.length === 0) {
    side = -side; // no room on that side (e.g. boss flush against a wall) -- try the other
    slots = getSlimeRainSlots(side);
    if (slots.length === 0) return null; // no room anywhere right now
  }

  return { side, x: slots[slotIndex % slots.length] };
}

function spawnSlimeRainDrop(side, x) {
  const dropWidth = boss.width * 0.5;
  const dropHeight = boss.height * 0.5;

  slimeRainDrops.push({
    x,
    y: -dropHeight - Math.random() * 150,
    width: dropWidth,
    height: dropHeight,
    velocityY: SLIME_RAIN_FALL_SPEED,
  });
  sfxSlimeDropFall();
}

function updateSlimeRainDrops() {
  for (let i = slimeRainDrops.length - 1; i >= 0; i--) {
    const drop = slimeRainDrops[i];
    drop.y += drop.velocityY;

    if (isColliding(player, drop)) {
      damagePlayer(SLIME_RAIN_DAMAGE);
      sfxSlimeRainImpact();
      slimeRainDrops.splice(i, 1);
      continue;
    }

    if (drop.y > canvas.height) {
      slimeRainDrops.splice(i, 1);
    }
  }
}

function updateEnemies() {
  // Debug: "=" instantly kills whichever boss is currently active, in any
  // phase of its fight -- e.g. it kills the slime, but does nothing once
  // the slime is already dead/exploding, and (once a later boss like the
  // troll is actually implemented) it'll target that fight instead, not
  // reach back and affect the slime.
  if (isAnyJustPressed(["Equal"]) && boss.hp > 0 && boss.state !== "exploding" && boss.state !== "dead") {
    boss.hp = 0;
  }

  // Runs before anything else: the moment HP hits 0, drop everything else
  // the boss was doing and kick off the death sequence's first beat.
  if (boss.state !== "exploding" && boss.state !== "dead" && boss.hp <= 0) {
    boss.state = "exploding";
    boss.deathPhase = "lookup";
    boss.deathPhaseTimer = DEATH_LOOKUP_DURATION;
    boss.flashOn = false;
    boss.anvilY = DEATH_ANVIL_START_Y;
    boss.falloffOffset = 0;
    bullets.length = 0; // fight's over, clear any bullets still in flight
    sfxBossLookUp();
    return;
  }

  if (boss.state === "exploding") {
    boss.deathPhaseTimer--;

    if (boss.deathPhase === "lookup") {
      // Just a beat of stillness (drawEnemies tilts the boss upward) before
      // the anvil shows up -- nothing to update here but the countdown.
      if (boss.deathPhaseTimer <= 0) {
        boss.deathPhase = "anvil_fall";
        boss.deathPhaseTimer = DEATH_ANVIL_FALL_DURATION;
        boss.anvilY = DEATH_ANVIL_START_Y;
        sfxAnvilWhistle();
      }
    } else if (boss.deathPhase === "anvil_fall") {
      const t = 1 - Math.max(0, boss.deathPhaseTimer) / DEATH_ANVIL_FALL_DURATION;
      const targetY = boss.y - DEATH_ANVIL_HEIGHT * 0.35; // sinks slightly into the boss on impact
      boss.anvilY = DEATH_ANVIL_START_Y + (targetY - DEATH_ANVIL_START_Y) * t;
      if (boss.deathPhaseTimer <= 0) {
        boss.deathPhase = "crush";
        boss.deathPhaseTimer = DEATH_CRUSH_HOLD_DURATION;
        boss.flashOn = true;
        spawnParticles(boss.x + boss.width / 2, boss.y, DEATH_CRUSH_SPLATTER_COUNT, {
          speedMin: 2, speedMax: 14,
          angleStart: Math.PI, angleEnd: Math.PI * 2, // burst upward and out to both sides
          life: 45, size: 8, color: "#a855f7", gravity: 0.35,
        });
        sfxAnvilCrush();
        triggerScreenShake(26, 45);
      }
    } else if (boss.deathPhase === "crush") {
      if (boss.deathPhaseTimer % DEATH_FLASH_INTERVAL === 0) boss.flashOn = !boss.flashOn;
      if (boss.deathPhaseTimer <= 0) {
        boss.deathPhase = "falloff";
        boss.deathPhaseTimer = DEATH_FALLOFF_DURATION;
        boss.flashOn = false;
      }
    } else if (boss.deathPhase === "falloff") {
      const t = 1 - Math.max(0, boss.deathPhaseTimer) / DEATH_FALLOFF_DURATION;
      boss.falloffOffset = DEATH_FALLOFF_DISTANCE * t * t; // accelerating slide, like sinking away
      if (boss.deathPhaseTimer <= 0) {
        boss.deathPhase = "reveal";
        boss.deathPhaseTimer = DEATH_REVEAL_DURATION;
      }
    } else if (boss.deathPhase === "reveal") {
      // The troll silhouette just fades in and holds -- nothing to update
      // here but the countdown.
      if (boss.deathPhaseTimer <= 0) {
        boss.deathPhase = "armSlam";
        boss.deathPhaseTimer = DEATH_ARM_SLAM_DURATION;
        sfxTrollHandSlam();
        triggerScreenShake(30, 35);
        for (const armX of TROLL_ARM_X) {
          spawnParticles(armX, 855, 24, {
            speedMin: 3, speedMax: 10,
            angleStart: -Math.PI * 0.9, angleEnd: -Math.PI * 0.1,
            life: 45, size: 7, color: "#6b7280", gravity: 0.3,
          });
        }
      }
    } else if (boss.deathPhase === "armSlam") {
      if (boss.deathPhaseTimer <= 0) {
        boss.deathPhase = "fallThrough";
        boss.deathPhaseTimer = DEATH_FALL_DURATION;
      }
    } else if (boss.deathPhase === "fallThrough") {
      if (boss.deathPhaseTimer <= 0) {
        boss.deathPhase = "ogreReveal";
        boss.deathPhaseTimer = DEATH_OGRE_DURATION;
      }
    } else if (boss.deathPhase === "ogreReveal") {
      if (boss.deathPhaseTimer <= 0) {
        boss.state = "dead";
        sfxWin();
        bgMusic.pause();
      }
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
  // attack state it's in. Uses the two-rectangle hitbox, not the full
  // bounding box, so standing in the empty space beside the dome doesn't
  // count as contact.
  if (isCollidingBoss(player)) {
    damagePlayer(CONTACT_DAMAGE);
  }

  updateProximityPunish();

  if (boss.state === "cooldown") {
    boss.stateTimer--;
    if (boss.stateTimer <= 0) {
      boss.state = "telegraph";
      boss.stateTimer = TELEGRAPH_DURATION;
      boss.flashOn = false;
      boss.attackChoice = Math.floor(Math.random() * 4) + 1; // 1, 2, 3, or 4
      if (boss.attackChoice === 2) {
        boss.limbVariant = Math.random() < 0.5 ? "top" : "under";
      } else if (boss.attackChoice === 3) {
        boss.attack3Zone = ATTACK3_ZONES[Math.floor(Math.random() * ATTACK3_ZONES.length)];
      }
      if (boss.attackChoice === 1) sfxSlimeTelegraph1();
      else if (boss.attackChoice === 2) sfxSlimeTelegraph2();
      else if (boss.attackChoice === 3) sfxSlimeTelegraph3();
      else sfxSlimeTelegraph4();
    }
  } else if (boss.state === "telegraph") {
    boss.stateTimer--;
    if (boss.stateTimer % FLASH_INTERVAL === 0) boss.flashOn = !boss.flashOn;
    if (boss.stateTimer <= 0) {
      if (boss.attackChoice === 1) {
        boss.state = "attack1_active";
        boss.stateTimer = ATTACK1_DURATION;
        attack1FireTimer = 0; // fires on the very first frame of the state
        sfxBossGrowl();
      } else if (boss.attackChoice === 2) {
        // Locked in now, at the moment it actually starts extending -- so
        // wherever the player ends up standing during the telegraph is what
        // gets targeted, same as Attack 1's aim.
        boss.limbDirection = getLimbTargetDirection();
        boss.state = "attack2_active";
        boss.stateTimer = LIMB_ATTACK_DURATION;
        sfxSlimeShloosh();
      } else if (boss.attackChoice === 3) {
        // 15 chunks of slime launched up off the ground as it jumps, with
        // gravity arcing them back down -- timed to the leap itself.
        spawnParticles(boss.x + boss.width / 2, boss.y + boss.height, 15, {
          speedMin: 6, speedMax: 14,
          angleStart: -Math.PI * 0.78, angleEnd: -Math.PI * 0.22,
          life: 55, size: 8, color: "#c026d3", gravity: 0.35,
        });

        // Rises straight up from wherever it currently is -- it may not be
        // home if a previous Attack 3 already relocated it.
        startBossTween(boss.x, ATTACK3_OFFSCREEN_Y, ATTACK3_RISE_DURATION);
        boss.state = "attack3_rise";
        sfxBossBounce();
      } else {
        // Attack 4: rise to the ceiling (x unchanged, only y moves).
        startBossTween(boss.x, ATTACK4_CEILING_Y, ATTACK4_RISE_DURATION);
        boss.state = "attack4_rise";
        sfxBossBounceThrow();
      }
    }
  } else if (boss.state === "attack1_active") {
    boss.stateTimer--;
    attack1FireTimer--;
    if (attack1FireTimer <= 0) {
      fireAttack1Bullet();
      attack1FireTimer = ATTACK1_FIRE_INTERVAL;
    }
    if (boss.stateTimer <= 0) {
      boss.state = "cooldown";
      boss.stateTimer = ATTACK_COOLDOWN;
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
      sfxBossWarningZone();
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
  } else if (boss.state === "attack4_rise") {
    if (updateBossTween()) {
      boss.state = "attack4_shoot";
      boss.stateTimer = ATTACK4_SHOOT_DURATION;
      attack4BlobSpawnTimer = ATTACK4_BLOB_INTERVAL; // first shot after one full interval, not instantly
      sfxBossCeilingStick();
    }
  } else if (boss.state === "attack4_shoot") {
    boss.stateTimer--;
    attack4BlobSpawnTimer--;
    if (attack4BlobSpawnTimer <= 0) {
      fireAttack4Blob();
      attack4BlobSpawnTimer = ATTACK4_BLOB_INTERVAL;
    }
    if (boss.stateTimer <= 0) {
      // Back to the ground, at whatever x it's currently at -- unchanged
      // throughout this whole attack.
      startBossTween(boss.x, BOSS_HOME_Y, ATTACK4_RISE_DURATION);
      boss.state = "attack4_descend";
    }
  } else if (boss.state === "attack4_descend") {
    if (updateBossTween()) {
      boss.state = "cooldown";
      boss.stateTimer = ATTACK_COOLDOWN;
    }
  }

  updateAttack4Blobs();
  updateSlimePuddles();
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

// Which side the player is currently on, relative to the boss's center --
// used live during the telegraph (so the warning socket tracks the player)
// and then locked into boss.limbDirection the instant the limb fires.
function getLimbTargetDirection() {
  const playerCenterX = player.x + player.width / 2;
  const bossCenterX = boss.x + boss.width / 2;
  return playerCenterX < bossCenterX ? -1 : 1;
}

// Which side Attack 1's mouth fires from -- always the side the player is
// currently standing on, recomputed live (both when a shot actually fires
// and every frame for the mouth telegraph/chomp), so the boss doesn't keep
// shooting from a side the player has since moved away from.
function getAttack1Direction() {
  const playerCenterX = player.x + player.width / 2;
  const bossCenterX = boss.x + boss.width / 2;
  return playerCenterX < bossCenterX ? -1 : 1;
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

  const originX = boss.limbDirection === 1 ? boss.x + boss.width : boss.x;
  const originY = getLimbOriginY();

  limbHazard = {
    x: boss.limbDirection === 1 ? originX : originX - currentLength,
    y: originY,
    width: currentLength,
    height: LIMB_HEIGHT,
  };

  if (currentLength > 0 && isColliding(player, limbHazard)) {
    damagePlayer(LIMB_DAMAGE);
  }
}

// Attack 4: fired from the boss's underside while it's stuck to the
// ceiling, aimed at wherever the player is right now (same one-shot aim as
// Attack 1's bullets), then travels in a straight line -- slow, so it's
// more "hard to ignore" than "hard to dodge."
function fireAttack4Blob() {
  const originX = boss.x + boss.width / 2;
  const originY = boss.y + boss.height;
  const angle = angleToPlayer(originX, originY);

  attack4Blobs.push({
    x: originX - ATTACK4_BLOB_SIZE / 2,
    y: originY - ATTACK4_BLOB_SIZE / 2,
    width: ATTACK4_BLOB_SIZE,
    height: ATTACK4_BLOB_SIZE,
    velocityX: Math.cos(angle) * ATTACK4_BLOB_SPEED,
    velocityY: Math.sin(angle) * ATTACK4_BLOB_SPEED,
  });
  sfxBossBlobShoot();
}

// Moves each blob; on hitting the player it just damages like any other
// projectile, but on hitting the ground or a platform it splats into a
// puddle at that spot instead of simply disappearing.
function updateAttack4Blobs() {
  for (let i = attack4Blobs.length - 1; i >= 0; i--) {
    const blob = attack4Blobs[i];
    blob.x += blob.velocityX;
    blob.y += blob.velocityY;

    if (isColliding(blob, player)) {
      damagePlayer(ATTACK4_BLOB_DAMAGE);
      attack4Blobs.splice(i, 1);
      continue;
    }

    // Passes straight through the floating one-way platforms -- only the
    // solid ground stops it and turns it into a puddle.
    let landedOn = null;
    for (const platform of platforms) {
      if (!platform.oneWay && isColliding(blob, platform)) {
        landedOn = platform;
        break;
      }
    }
    if (landedOn) {
      spawnSlimePuddle(blob.x + blob.width / 2, Math.min(blob.y + blob.height, landedOn.y));
      attack4Blobs.splice(i, 1);
      continue;
    }

    if (blob.x < -150 || blob.x > canvas.width + 150 || blob.y > canvas.height + 150) {
      attack4Blobs.splice(i, 1);
    }
  }
}

// bottomY is where the puddle's top edge sits -- the surface it splatted onto.
function spawnSlimePuddle(centerX, bottomY) {
  const width = ATTACK4_BLOB_SIZE * 1.4;
  slimePuddles.push({
    x: centerX - width / 2,
    y: bottomY - SLIME_PUDDLE_HEIGHT,
    width,
    height: SLIME_PUDDLE_HEIGHT,
    timer: SLIME_PUDDLE_DURATION,
    maxTimer: SLIME_PUDDLE_DURATION,
  });
  sfxSlimePuddleSplat();
}

function updateSlimePuddles() {
  for (let i = slimePuddles.length - 1; i >= 0; i--) {
    slimePuddles[i].timer--;
    if (slimePuddles[i].timer <= 0) slimePuddles.splice(i, 1);
  }
}

// Angle from the boss's firing point to wherever the player is standing right
// now. Aimed once, at the moment the attack fires -- not a homing bullet.
function angleToPlayer(originX, originY) {
  const playerCenterX = player.x + player.width / 2;
  const playerCenterY = player.y + player.height / 2;
  return Math.atan2(playerCenterY - originY, playerCenterX - originX);
}

// Attack 1: one bullet, aimed fresh at the player each time (so it tracks
// them across the burst) with a small spread for minigun-style inaccuracy,
// called on a rapid interval from the "attack1_active" state. Fires from a
// mouth centered in the middle of the boss's body.
function fireAttack1Bullet() {
  const originX = boss.x + boss.width / 2;
  const originY = boss.y + boss.height * ATTACK1_MOUTH_Y_RATIO;
  const aimAngle = angleToPlayer(originX, originY);
  const spreadRad = (ATTACK1_SPREAD_DEGREES * Math.PI) / 180;
  const angle = aimAngle + (Math.random() - 0.5) * spreadRad;
  spawnBullet(originX, originY, angle);
  sfxMinigunShot();
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

// The slime's own mouth, centered on its body (not tucked off to one side or
// carved into an edge) -- opens wide with real teeth and shoots straight
// from the middle. openAmount 0 = a barely-cracked slit (telegraph
// anticipation), 1 = fully open (right as a shot fires).
function drawSlimeMouthCenter(cx, cy, openAmount) {
  const width = 70 + 90 * openAmount;
  const height = 14 + 50 * openAmount;

  ctx.save();
  ctx.translate(cx, cy);

  // Dark maw interior.
  ctx.fillStyle = "#1a0630";
  ctx.beginPath();
  ctx.ellipse(0, 0, width * 0.5, height * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Glowing throat, brighter the wider it's open.
  ctx.save();
  ctx.globalAlpha = 0.45 + 0.35 * openAmount;
  ctx.fillStyle = "#c026d3";
  ctx.shadowColor = "#c026d3";
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.ellipse(0, 0, width * 0.3, height * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Jagged teeth ringing the opening.
  ctx.fillStyle = "#f5f3ff";
  const teethCount = 5;
  const rowWidth = width * 0.85;
  for (let i = 0; i < teethCount; i++) {
    const tx = -rowWidth / 2 + (i + 0.5) * (rowWidth / teethCount);
    const toothW = (rowWidth / teethCount) * 0.6;
    ctx.beginPath();
    ctx.moveTo(tx - toothW / 2, -height / 2);
    ctx.lineTo(tx + toothW / 2, -height / 2);
    ctx.lineTo(tx, -height / 2 + height * 0.32);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(tx - toothW / 2, height / 2);
    ctx.lineTo(tx + toothW / 2, height / 2);
    ctx.lineTo(tx, height / 2 - height * 0.32);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

// Draws a squat cartoon anvil, top-left anchored at (centerX - half its
// width, topY) -- flat slab top, narrow waist, flared base, plus a little
// horn sticking out one side so its silhouette actually reads as "anvil".
function drawAnvil(centerX, topY) {
  const w = DEATH_ANVIL_WIDTH;
  const h = DEATH_ANVIL_HEIGHT;
  const x = centerX - w / 2;

  ctx.save();
  ctx.shadowColor = "#000000";
  ctx.shadowBlur = 16;

  fillRoundedRect(x, topY, w, h * 0.28, 6, "#4b5563");

  ctx.fillStyle = "#374151";
  ctx.fillRect(x + w * 0.28, topY + h * 0.26, w * 0.44, h * 0.36);

  ctx.beginPath();
  ctx.moveTo(x + w * 0.28, topY + h * 0.6);
  ctx.lineTo(x + w * 0.72, topY + h * 0.6);
  ctx.lineTo(x + w, topY + h);
  ctx.lineTo(x, topY + h);
  ctx.closePath();
  ctx.fillStyle = "#374151";
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x + w, topY + h * 0.12);
  ctx.lineTo(x + w * 1.2, topY + h * 0.22);
  ctx.lineTo(x + w, topY + h * 0.32);
  ctx.closePath();
  ctx.fillStyle = "#4b5563";
  ctx.fill();

  ctx.restore();
}

// A dark, looming silhouette of the next boss -- just a teaser placeholder,
// not a functional enemy. Big and centered so it dominates the screen. Two
// glowing red eyes are the only detail, deliberately vague about the rest
// of its shape.
function drawTrollTeaser(alpha) {
  if (alpha <= 0) return;
  const centerX = canvas.width / 2;
  const groundY = 860;
  const bodyWidth = TROLL_BODY_WIDTH;
  const bodyHeight = TROLL_BODY_HEIGHT;

  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.fillStyle = "#0f0a1a";
  ctx.beginPath();
  ctx.moveTo(centerX - bodyWidth * 0.5, groundY);
  ctx.quadraticCurveTo(centerX - bodyWidth * 0.62, groundY - bodyHeight * 0.55, centerX - bodyWidth * 0.3, groundY - bodyHeight * 0.85);
  ctx.quadraticCurveTo(centerX - bodyWidth * 0.16, groundY - bodyHeight, centerX, groundY - bodyHeight * 0.98);
  ctx.quadraticCurveTo(centerX + bodyWidth * 0.16, groundY - bodyHeight, centerX + bodyWidth * 0.3, groundY - bodyHeight * 0.85);
  ctx.quadraticCurveTo(centerX + bodyWidth * 0.62, groundY - bodyHeight * 0.55, centerX + bodyWidth * 0.5, groundY);
  ctx.closePath();
  ctx.fill();

  // Big, steadily glowing red eyes -- the one detail this teaser gets, so it
  // needs to actually read from across the screen. A slow brightness pulse
  // keeps them alive without ever fully dimming (no blinking -- the point is
  // to be MORE visible, not less).
  const eyeY = groundY - bodyHeight * 0.78;
  const eyeGlowPulse = 30 + Math.sin(frameCount * 0.06) * 9;
  for (const dir of [-1, 1]) {
    ctx.save();
    ctx.shadowColor = "#ef4444";
    ctx.shadowBlur = eyeGlowPulse;
    ctx.fillStyle = "#f87171";
    ctx.beginPath();
    ctx.ellipse(centerX + dir * bodyWidth * 0.14, eyeY, 30, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = "#450a0a";
    ctx.beginPath();
    ctx.ellipse(centerX + dir * bodyWidth * 0.14, eyeY, 10, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

// One giant cyan arm punching down from off-screen, ending in a clawed hand
// that digs into the ground -- the troll physically breaking into the
// arena. centerX picks which arm, dropAmount 0 = still off-screen, 1 =
// fully slammed down.
function drawTrollArm(centerX, dropAmount) {
  if (dropAmount <= 0) return;
  const restTopY = 860 - TROLL_ARM_LENGTH + 60; // digs slightly into the ground
  const startTopY = -(TROLL_ARM_LENGTH + 150);
  // Eased-in fall -- slow at first, slamming hard at the end.
  const eased = dropAmount * dropAmount;
  const topY = startTopY + (restTopY - startTopY) * eased;

  ctx.save();
  ctx.shadowColor = "#22d3ee";
  ctx.shadowBlur = 30;

  const gradient = ctx.createLinearGradient(centerX, topY, centerX, topY + TROLL_ARM_LENGTH);
  gradient.addColorStop(0, "#a5f3fc");
  gradient.addColorStop(1, "#0e7490");

  // The limb itself -- long and only slightly tapered, not a stubby hand.
  fillRoundedRect(centerX - TROLL_ARM_WIDTH / 2, topY, TROLL_ARM_WIDTH, TROLL_ARM_LENGTH * 0.82, TROLL_ARM_WIDTH * 0.45, gradient);

  // A clawed hand at the tip.
  const handTopY = topY + TROLL_ARM_LENGTH * 0.78;
  const handWidth = TROLL_ARM_WIDTH * 1.5;
  const fingerCount = 3;
  const fingerWidth = handWidth * 0.22;
  for (let i = 0; i < fingerCount; i++) {
    const fx = centerX - handWidth / 2 + (i + 0.5) * (handWidth / fingerCount);
    fillRoundedRect(fx - fingerWidth / 2, handTopY, fingerWidth, TROLL_ARM_LENGTH * 0.22, fingerWidth * 0.4, gradient);
  }
  fillRoundedRect(centerX - handWidth / 2, handTopY - TROLL_ARM_WIDTH * 0.2, handWidth, TROLL_ARM_WIDTH * 0.9, 24, gradient);

  ctx.restore();
}

// Jagged cracks spreading across the arena floor from each arm's impact
// point -- purely visual (doesn't touch the real platform data), seeded
// deterministically off each crack's position/index so they don't flicker
// or shift from frame to frame.
function drawArenaCracks(progress) {
  if (progress <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, progress * 1.5);
  ctx.strokeStyle = "#facc15";
  ctx.lineWidth = 3;
  ctx.shadowColor = "#facc15";
  ctx.shadowBlur = 8;

  for (const originX of TROLL_ARM_X) {
    for (let i = 0; i < 5; i++) {
      const seed = originX * 13 + i * 37;
      const angle = -Math.PI / 2 + ((seed % 100) / 100 - 0.5) * Math.PI * 0.8;
      const length = (120 + (seed % 7) * 30) * Math.min(1, progress * 2);
      ctx.beginPath();
      ctx.moveTo(originX, 858);
      const segments = 4;
      for (let s = 1; s <= segments; s++) {
        const wobble = ((seed * s) % 40) - 20;
        const cx = originX + Math.cos(angle) * (length * s / segments) + wobble;
        const cy = 858 + Math.sin(angle) * (length * s / segments) * 0.4;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

// The eerie backdrop of the next plane we fall into -- fully covers whatever
// is beneath it (the arena, palace, player) once opaque.
function drawVoidPlane(alpha) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  const gradient = ctx.createRadialGradient(
    canvas.width / 2, canvas.height * 0.55, 80,
    canvas.width / 2, canvas.height * 0.55, canvas.width * 0.8
  );
  gradient.addColorStop(0, "#7f1d1d");
  gradient.addColorStop(0.5, "#2a0a0a");
  gradient.addColorStop(1, "#0a0505");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

// The final tease -- a giant ogre's head filling the screen, one huge eye
// staring back. Just a placeholder silhouette, not a functional boss.
// centerX is passed in so it can be anchored off to one side of the screen
// rather than always dead-center.
function drawOgreHead(alpha, centerX) {
  if (alpha <= 0) return;
  const centerY = canvas.height * 0.5;
  const headWidth = 1000;
  const headHeight = 820;

  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.fillStyle = "#1c1310";
  ctx.beginPath();
  ctx.moveTo(centerX - headWidth * 0.3, centerY - headHeight * 0.5);
  ctx.quadraticCurveTo(centerX - headWidth * 0.52, centerY - headHeight * 0.3, centerX - headWidth * 0.48, centerY + headHeight * 0.1);
  ctx.quadraticCurveTo(centerX - headWidth * 0.42, centerY + headHeight * 0.38, centerX - headWidth * 0.22, centerY + headHeight * 0.5);
  ctx.lineTo(centerX + headWidth * 0.22, centerY + headHeight * 0.5);
  ctx.quadraticCurveTo(centerX + headWidth * 0.42, centerY + headHeight * 0.38, centerX + headWidth * 0.48, centerY + headHeight * 0.1);
  ctx.quadraticCurveTo(centerX + headWidth * 0.52, centerY - headHeight * 0.3, centerX + headWidth * 0.3, centerY - headHeight * 0.5);
  ctx.quadraticCurveTo(centerX, centerY - headHeight * 0.62, centerX - headWidth * 0.3, centerY - headHeight * 0.5);
  ctx.closePath();
  ctx.fill();

  // Heavy brow ridge over the eye.
  ctx.fillStyle = "#100b09";
  ctx.beginPath();
  ctx.ellipse(centerX, centerY - headHeight * 0.08, headWidth * 0.3, headHeight * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();

  // One huge glowing eye, centered.
  const eyeRadiusX = headWidth * 0.11;
  const eyeRadiusY = headHeight * 0.08;
  const eyePulse = 40 + Math.sin(frameCount * 0.05) * 12;
  ctx.save();
  ctx.shadowColor = OGRE_EYE_COLOR;
  ctx.shadowBlur = eyePulse;
  ctx.fillStyle = OGRE_EYE_COLOR;
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, eyeRadiusX, eyeRadiusY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // The pupil shifts toward wherever the player actually is, so the eye
  // reads as watching them rather than staring blankly ahead.
  const lookAngle = Math.atan2(
    (player.y + player.height / 2) - centerY,
    (player.x + player.width / 2) - centerX
  );
  const pupilX = centerX + Math.cos(lookAngle) * eyeRadiusX * 0.45;
  const pupilY = centerY + Math.sin(lookAngle) * eyeRadiusY * 0.45;

  ctx.fillStyle = "#1c1310";
  ctx.beginPath();
  ctx.ellipse(pupilX, pupilY, headWidth * 0.045, headHeight * 0.045, 0, 0, Math.PI * 2);
  ctx.fill();

  // Lower jaw with two tusks.
  ctx.fillStyle = "#f8fafc";
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(centerX + dir * headWidth * 0.1, centerY + headHeight * 0.42);
    ctx.lineTo(centerX + dir * headWidth * 0.16, centerY + headHeight * 0.42);
    ctx.lineTo(centerX + dir * headWidth * 0.11, centerY + headHeight * 0.3);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

// Runs through the "lookup" -> "anvil_fall" -> "crush" -> "falloff" beats;
// "reveal" onward (the next boss's silhouette, its arms breaking the arena,
// falling through into the next plane, and the ogre head reveal) is handled
// separately since the slime itself is gone by then.
function drawDeathSequence() {
  if (boss.deathPhase === "reveal") {
    const progress = 1 - Math.max(0, boss.deathPhaseTimer) / DEATH_REVEAL_DURATION;
    drawTrollTeaser(Math.min(1, progress / 0.3));
    return;
  }

  if (boss.deathPhase === "armSlam") {
    drawTrollTeaser(1);
    const progress = 1 - Math.max(0, boss.deathPhaseTimer) / DEATH_ARM_SLAM_DURATION;
    drawArenaCracks(progress);
    for (const armX of TROLL_ARM_X) drawTrollArm(armX, progress);
    return;
  }

  if (boss.deathPhase === "fallThrough") {
    drawTrollTeaser(1);
    drawArenaCracks(1);
    for (const armX of TROLL_ARM_X) drawTrollArm(armX, 1);
    const progress = 1 - Math.max(0, boss.deathPhaseTimer) / DEATH_FALL_DURATION;
    drawVoidPlane(progress);
    return;
  }

  if (boss.deathPhase === "ogreReveal") {
    drawVoidPlane(1);
    const progress = 1 - Math.max(0, boss.deathPhaseTimer) / DEATH_OGRE_DURATION;
    drawOgreHead(Math.min(1, progress / 0.25), canvas.width * 0.72); // anchored on the right side of the screen
    return;
  }

  const centerX = boss.x + boss.width / 2;
  const groundY = boss.y + boss.height;

  let fadeAlpha = 1;
  let offsetY = 0;
  if (boss.deathPhase === "falloff") {
    offsetY = boss.falloffOffset;
    fadeAlpha = Math.max(0, 1 - boss.falloffOffset / DEATH_FALLOFF_DISTANCE);
  }

  ctx.save();
  ctx.globalAlpha = fadeAlpha;
  ctx.translate(0, offsetY);

  let bodyHeight = boss.height;
  let bodyColor = "#3b0764";
  let shadeColor = "#0c0a1a";
  let tiltAngle = 0;

  if (boss.deathPhase === "lookup") {
    tiltAngle = -0.12; // tips its "head" back, like it's looking up
  } else if (boss.deathPhase === "crush" || boss.deathPhase === "falloff") {
    bodyHeight = boss.height * 0.22; // squashed into a pancake by the anvil
    if (boss.deathPhase === "crush" && boss.flashOn) {
      bodyColor = "#ffffff";
      shadeColor = "#e9d5ff";
    }
  }

  const bodyY = groundY - bodyHeight;
  ctx.save();
  if (tiltAngle) {
    ctx.translate(centerX, groundY);
    ctx.rotate(tiltAngle);
    ctx.translate(-centerX, -groundY);
  }
  drawSlimeBody(boss.x, bodyY, boss.width, bodyHeight, bodyColor, shadeColor);
  const eyeY = bodyY + bodyHeight * (boss.deathPhase === "lookup" ? 0.4 : 0.45);
  const eyeScale = boss.deathPhase === "lookup" ? 1 : 0.75;
  drawSlimeEyes(centerX, eyeY, boss.width * 0.15, boss.width * 0.07 * eyeScale);
  ctx.restore();

  if (boss.deathPhase !== "lookup") {
    drawAnvil(centerX, boss.anvilY);
  }

  ctx.restore();
}

function drawEnemies() {
  if (boss.state === "dead") return; // boss is gone -- draw() switches to the win screen

  if (boss.state === "exploding") {
    drawDeathSequence();
    return;
  }

  let bodyColor = "#3b0764";
  let shadeColor = "#0c0a1a";
  if (boss.state === "telegraph" && boss.flashOn) {
    // Takes priority -- the attack warning must stay readable.
    if (boss.attackChoice === 2) { bodyColor = "#4ade80"; shadeColor = "#14532d"; }
    else if (boss.attackChoice === 3) { bodyColor = "#f87171"; shadeColor = "#7f1d1d"; }
    else if (boss.attackChoice === 4) { bodyColor = "#22d3ee"; shadeColor = "#0e7490"; }
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
  } else if (boss.state === "attack4_rise" || boss.state === "attack4_shoot" || boss.state === "attack4_descend") {
    // Squishes more the closer it gets to the ceiling -- fully flattened
    // once it's actually stuck there, back to normal at ground level.
    // Anchored to the TOP (not the bottom, like Attack 3's squish) since
    // it's pressing up against the ceiling, not the floor.
    const heightRange = BOSS_HOME_Y - ATTACK4_CEILING_Y;
    const proximityToCeiling = Math.max(0, Math.min(1, (BOSS_HOME_Y - boss.y) / heightRange));
    drawHeight = boss.height * (1 - ATTACK4_SQUISH_AMOUNT * proximityToCeiling);
    drawWidth = boss.width * (1 + ATTACK4_SQUISH_AMOUNT * proximityToCeiling * 0.3);
    drawY = boss.y;
    drawX = boss.x - (drawWidth - boss.width) / 2;
  } else if (boss.state === "cooldown") {
    // Slow gooey squash-and-stretch pulse instead of a rigid idle -- a slime
    // breathing, not a block.
    const pulse = Math.sin(frameCount * 0.05) * 0.025;
    drawHeight = boss.height * (1 + pulse);
    drawWidth = boss.width * (1 - pulse * 0.5);
    drawY = boss.y + (boss.height - drawHeight);
    drawX = boss.x + (boss.width - drawWidth) / 2;
  }

  // Attack 1 makes the whole body lean toward whichever side the player is
  // on -- the slime turning to face them -- rather than a mouth just
  // appearing wherever. Scoped to a save/restore so only the body+eyes+mouth
  // tilt; everything drawn after (sockets, warning zones, bullets) stays
  // in normal world space.
  const attack1Facing = boss.attackChoice === 1 && (boss.state === "telegraph" || boss.state === "attack1_active");
  const attack1Dir = attack1Facing ? getAttack1Direction() : 1;
  const tiltAngle = attack1Facing ? attack1Dir * ATTACK1_TILT_ANGLE : 0;
  const pivotX = drawX + drawWidth / 2;
  const pivotY = drawY + drawHeight;

  ctx.save();
  if (tiltAngle) {
    ctx.translate(pivotX, pivotY);
    ctx.rotate(tiltAngle);
    ctx.translate(-pivotX, -pivotY);
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

  // Attack 1's mouth -- centered on the body, shooting straight from the
  // middle. Barely cracked open during the telegraph, chomping fully open in
  // sync with each shot once firing starts.
  if (attack1Facing) {
    const mouthX = drawX + drawWidth / 2;
    const mouthY = drawY + drawHeight * ATTACK1_MOUTH_Y_RATIO;
    const openAmount = boss.state === "attack1_active"
      ? attack1FireTimer / ATTACK1_FIRE_INTERVAL
      : 0.15;
    drawSlimeMouthCenter(mouthX, mouthY, openAmount);
  }

  ctx.restore();

  // Socket marking where the limb emerges from -- visible during its
  // telegraph (so you can see it coming) and while the limb is out. Tinted
  // to match the goo instead of a flat mechanical grey. During the
  // telegraph it tracks the player live, the same side the limb will
  // actually fire toward once it locks in.
  if (boss.attackChoice === 2 && (boss.state === "telegraph" || boss.state === "attack2_active")) {
    const dir = boss.state === "attack2_active" ? boss.limbDirection : getLimbTargetDirection();
    const socketX = dir === 1 ? boss.x + boss.width : boss.x - LIMB_SOCKET_WIDTH;
    const socketGradient = ctx.createLinearGradient(socketX, 0, socketX + LIMB_SOCKET_WIDTH, 0);
    socketGradient.addColorStop(dir === 1 ? 1 : 0, "#4c1d95");
    socketGradient.addColorStop(dir === 1 ? 0 : 1, "#7e22ce");
    fillRoundedRect(socketX, getLimbOriginY(), LIMB_SOCKET_WIDTH, LIMB_HEIGHT, 10, socketGradient);
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

  drawSlimeRainDrops();
  drawSlimePuddles();
  drawAttack4Blobs();
}

// Huge falling slime chunks from the proximity punish -- same gumdrop shape
// and goo palette as the rest of the boss, just boulder-sized.
function drawSlimeRainDrops() {
  ctx.save();
  ctx.shadowColor = "#c026d3";
  ctx.shadowBlur = 16;
  for (const drop of slimeRainDrops) {
    const gradient = ctx.createLinearGradient(drop.x, drop.y, drop.x, drop.y + drop.height);
    gradient.addColorStop(0, "#e879f9");
    gradient.addColorStop(1, "#6b21a8");
    buildGumdropPath(drop.x, drop.y, drop.width, drop.height, 0, 0);
    ctx.fillStyle = gradient;
    ctx.fill();
  }
  ctx.restore();
}

// Attack 4's giant lobbed blobs -- same gumdrop shape, cyan-tinted to match
// this attack's telegraph color instead of the usual purple.
function drawAttack4Blobs() {
  ctx.save();
  ctx.shadowColor = "#22d3ee";
  ctx.shadowBlur = 16;
  for (const blob of attack4Blobs) {
    const gradient = ctx.createLinearGradient(blob.x, blob.y, blob.x, blob.y + blob.height);
    gradient.addColorStop(0, "#a5f3fc");
    gradient.addColorStop(1, "#0e7490");
    buildGumdropPath(blob.x, blob.y, blob.width, blob.height, 0, 0);
    ctx.fillStyle = gradient;
    ctx.fill();
  }
  ctx.restore();
}

// Flattened puddles left where a blob splatted -- fades out over its
// lifetime so its disappearance doesn't look like it just vanishes.
function drawSlimePuddles() {
  for (const puddle of slimePuddles) {
    const alpha = Math.max(0, Math.min(1, puddle.timer / puddle.maxTimer));
    ctx.save();
    ctx.globalAlpha = 0.55 * alpha;
    ctx.fillStyle = "#22d3ee";
    ctx.beginPath();
    ctx.ellipse(
      puddle.x + puddle.width / 2, puddle.y + puddle.height / 2,
      puddle.width / 2, puddle.height / 2, 0, 0, Math.PI * 2
    );
    ctx.fill();
    ctx.restore();
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
