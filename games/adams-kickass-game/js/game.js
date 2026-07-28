// The main game loop: clear the screen, update everything, draw everything,
// then ask the browser to do it all again next frame (about 60 times/second).

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

function update() {
  // Frozen once the player has died or the boss's death animation has
  // finished -- see draw(). Note boss.state can still be "exploding" here,
  // which is intentional: the death animation needs update() to keep running.
  if (player.hearts <= 0 || boss.state === "dead") return;

  updatePlayer();
  updateEnemies();
  updateCombat();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (player.hearts <= 0) {
    drawEndScreen("GAME OVER", "#ef4444");
    return;
  }

  if (boss.state === "dead") {
    drawEndScreen("YOU WIN", "#22c55e");
    return;
  }

  drawLevel();
  drawEnemies();
  drawPlayer();
  drawCombat();
}

function drawEndScreen(message, color) {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = color;
  ctx.font = "bold 72px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(message, canvas.width / 2, canvas.height / 2);

  const btn = getRestartButtonRect();
  ctx.fillStyle = "#334155";
  ctx.fillRect(btn.x, btn.y, btn.width, btn.height);
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 2;
  ctx.strokeRect(btn.x, btn.y, btn.width, btn.height);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px sans-serif";
  ctx.fillText("RESTART", btn.x + btn.width / 2, btn.y + btn.height / 2);
}

function isGameOver() {
  return player.hearts <= 0 || boss.state === "dead";
}

function getRestartButtonRect() {
  const width = 220;
  const height = 60;
  return {
    x: canvas.width / 2 - width / 2,
    y: canvas.height / 2 + 80,
    width,
    height,
  };
}

// Resets the player and boss back to their starting conditions so the fight
// can be replayed after a win or a loss.
function resetGame() {
  Object.assign(player, {
    x: 100, y: 100, velocityX: 0, velocityY: 0, onGround: false, facing: 1,
    coyoteTimer: 0, jumpBufferTimer: 0,
    isDashing: false, dashTimer: 0, dashCooldownTimer: 0, dashDir: 1,
    hearts: player.maxHearts, mp: 0, invulnerableTimer: 0,
  });

  Object.assign(boss, {
    x: BOSS_HOME_X,
    y: BOSS_HOME_Y,
    hp: boss.maxHp,
    state: "cooldown",
    stateTimer: ATTACK_COOLDOWN,
    flashOn: false,
    hitFlashTimer: 0,
    attack3Zone: null,
  });

  bullets.length = 0;
  limbHazard = null;
  explosionParticles.length = 0;
}

window.addEventListener("mousedown", (e) => {
  if (e.button !== 0 || !isGameOver()) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mouseX = (e.clientX - rect.left) * scaleX;
  const mouseY = (e.clientY - rect.top) * scaleY;

  const btn = getRestartButtonRect();
  if (mouseX >= btn.x && mouseX <= btn.x + btn.width && mouseY >= btn.y && mouseY <= btn.y + btn.height) {
    resetGame();
  }
});

function loop() {
  update();
  draw();
  // Must run after update() has read this frame's input, and before the
  // next frame's keydown/keyup events are checked.
  updateInputSnapshot();
  requestAnimationFrame(loop);
}

loop();
