// The main game loop: clear the screen, update everything, draw everything,
// then ask the browser to do it all again next frame (about 60 times/second).
// canvas/ctx come from setup.js; gameState/drawStartScreen/drawBackground/
// drawButton/drawTouchControls come from ui.js.

function update() {
  if (gameState !== "playing") return;

  // Frozen once the player has died or the boss's death animation has
  // finished -- see draw(). Note boss.state can still be "exploding" here,
  // which is intentional: the death animation needs update() to keep running.
  if (player.hearts <= 0 || boss.state === "dead") return;

  updatePlayer();
  updateEnemies();
  updateCombat();
  updateParticles();
  updateScreenShake();
}

function draw() {
  if (gameState === "start") {
    drawStartScreen();
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (player.hearts <= 0) {
    drawEndScreen("GAME OVER", "#ef4444", "#b91c1c");
    return;
  }

  if (boss.state === "dead") {
    drawEndScreen("YOU WIN", "#22c55e", "#15803d");
    return;
  }

  // Screen shake only offsets the world, not the HUD -- a jittering health
  // display would be harder to read, not more exciting.
  const shake = getScreenShakeOffset();
  ctx.save();
  ctx.translate(shake.x, shake.y);
  drawBackground();
  drawLevel();
  drawEnemies();
  drawPlayer();
  drawCombat();
  drawParticles();
  ctx.restore();

  drawHud();
  drawTouchControls();
}

function drawEndScreen(message, color, colorDim) {
  drawBackground();

  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";
  ctx.fillStyle = color;
  ctx.font = "bold 84px sans-serif";
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 30;
  ctx.fillText(message, canvas.width / 2, canvas.height / 2 - 40);
  ctx.restore();

  const btn = getRestartButtonRect();
  const hovered = pointerX !== null && isPointInRect(pointerX, pointerY, btn);
  drawButton(btn, "RESTART", hovered, color, colorDim);
}

function isGameOver() {
  return player.hearts <= 0 || boss.state === "dead";
}

function getRestartButtonRect() {
  const width = 240;
  const height = 66;
  return {
    x: canvas.width / 2 - width / 2,
    y: canvas.height / 2 + 60,
    width,
    height,
  };
}

// Resets the player and boss back to their starting conditions so the fight
// can be replayed after a win or a loss. Does NOT touch gameState -- restart
// goes straight back into play, it doesn't return to the start screen.
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
  particles.length = 0;
  sfxUiClick();
}

window.addEventListener("mousedown", (e) => {
  if (e.button !== 0 || !isGameOver()) return;
  const { x, y } = toCanvasCoordinates(e.clientX, e.clientY);
  if (isPointInRect(x, y, getRestartButtonRect())) resetGame();
});

function loop() {
  frameCount++;
  update();
  draw();
  // Must run after update() has read this frame's input, and before the
  // next frame's keydown/keyup events are checked.
  updateInputSnapshot();
  requestAnimationFrame(loop);
}

loop();
