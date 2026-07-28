// The level layout: a list of solid rectangles the player can stand on.
// Later this is where we'll load different rooms/levels from.
// Everything fits on one screen -- no camera/scrolling, the canvas IS the level.

const platforms = [
  { x: 0, y: 860, width: 1600, height: 40 }, // ground, spans the whole screen
  // Floating platforms clustered on the left, all same (lower) height --
  // leaves the whole right side of the screen open for a stationary boss.
  // "oneWay" platforms can be jumped up through from below and dropped
  // through from above (see player.js) -- only the ground is fully solid.
  { x: 100, y: 730, width: 160, height: 20, oneWay: true },
  { x: 350, y: 730, width: 160, height: 20, oneWay: true },
  { x: 600, y: 730, width: 160, height: 20, oneWay: true },

  // Mirrored set in the boss's home area (x:1000-1600). Drawn before the
  // boss each frame, so its huge body naturally covers whichever of these
  // sit under it -- they're only visible once the boss leaps somewhere else
  // (see Attack 3 in boss.js, which no longer returns home after landing).
  { x: 1000, y: 730, width: 160, height: 20, oneWay: true },
  { x: 1220, y: 730, width: 160, height: 20, oneWay: true },
  { x: 1440, y: 730, width: 160, height: 20, oneWay: true },
];

function drawLevel() {
  ctx.fillStyle = "#6b6b8a";
  for (const platform of platforms) {
    ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
  }
}

// --- Simple AABB (axis-aligned bounding box) collision helpers ---
// These work for any two rectangles with x, y, width, height.

function isColliding(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

// When the player overlaps a platform, push them back out along whichever
// axis moved the least -- this is what lets you land on top of platforms
// instead of getting stuck when you touch their edge.
function resolveCollision(entity, platform) {
  const overlapLeft = entity.x + entity.width - platform.x;
  const overlapRight = platform.x + platform.width - entity.x;
  const overlapTop = entity.y + entity.height - platform.y;
  const overlapBottom = platform.y + platform.height - entity.y;

  const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

  if (minOverlap === overlapTop && entity.velocityY >= 0) {
    entity.y = platform.y - entity.height;
    entity.velocityY = 0;
    entity.onGround = true;
  } else if (minOverlap === overlapBottom && entity.velocityY < 0) {
    entity.y = platform.y + platform.height;
    entity.velocityY = 0;
  } else if (minOverlap === overlapLeft) {
    entity.x = platform.x - entity.width;
  } else if (minOverlap === overlapRight) {
    entity.x = platform.x + platform.width;
  }
}
