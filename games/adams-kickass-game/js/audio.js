// All sound effects are synthesized with the Web Audio API -- no audio files
// to fetch. Browsers block audio until a user gesture, so the AudioContext
// is created lazily and resumed the first time it's needed (the Play button
// click covers this).
//
// Every sound is built from layered primitives (playTone/playNoise/
// playSubThump) so impactful moments get real weight: a low sub-bass thump
// for physical "hit" feel, mild distortion for grit instead of a clean
// synth-demo tone, and a shared reverb send for the big moments (boss
// telegraph/slam/death, win) so they feel like they're happening in a space,
// not a phone speaker.

let audioCtx = null;
let audioMuted = false;
let reverbSend = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

// Background music -- an actual audio file, not synthesized, and independent
// of audioMuted (that flag only covers the procedural sfx above). Started on
// the same Play-button click that unlocks the AudioContext, since browsers
// block audio playback before a user gesture. Plays at a fixed volume --
// sound effects no longer duck it.
const bgMusic = new Audio("assets/theme.mp3");
bgMusic.volume = 0.4;

function startBgMusic() {
  bgMusic.play().catch(() => {}); // blocked (no gesture yet) -- harmless, nothing else depends on it
}

// Not using the native `loop` attribute -- the FIRST playthrough should run
// start to finish, but every loop after that restarts from the halfway
// point instead of the very beginning. Keeps looping until the boss is
// actually dead (the "YOU WIN" screen), at which point it just stops.
//
// The track doesn't fade out -- the music plays at a steady level right up
// until it just stops, leaving several seconds of a near-silent decaying
// drum/reverb tail before the file's actual end. Waiting that tail out (or
// seeking across it) is what reads as "a pause." So the whole file is
// decoded once up front to find exactly where the real music stops, and the
// loop cuts there -- skipping the dead-air tail instead of playing through it.
let loopCutTime = null; // seconds; null until analysis finishes

fetch("assets/theme.mp3")
  .then((r) => r.arrayBuffer())
  .then((buf) => getAudioContext().decodeAudioData(buf))
  .then((audioBuffer) => { loopCutTime = detectLoopCutTime(audioBuffer); })
  .catch(() => {}); // analysis failing just means the fallback margin below is used instead

// Scans the tail of the track and finds the last moment it's still "loud"
// (part of the actual music) before it drops into the decaying silence at
// the very end, then cuts a beat after that -- letting the last hit start
// to ring out naturally, but well before it trails all the way to silence.
function detectLoopCutTime(audioBuffer) {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);
  const windowSize = Math.floor(sampleRate * 0.05); // 50ms windows
  const scanStartSample = Math.floor(Math.max(0, audioBuffer.duration - 15) * sampleRate);

  const windows = [];
  for (let start = scanStartSample; start < channelData.length; start += windowSize) {
    const end = Math.min(start + windowSize, channelData.length);
    let sumSquares = 0;
    for (let i = start; i < end; i++) sumSquares += channelData[i] * channelData[i];
    windows.push({ time: start / sampleRate, rms: Math.sqrt(sumSquares / (end - start)) });
  }
  if (windows.length === 0) return null;

  let peakRms = 0;
  for (const w of windows) if (w.rms > peakRms) peakRms = w.rms;
  const loudThreshold = peakRms * 0.25;

  // Walk backward from the very end to find the last window that's still
  // loud -- everything after that is just decay/silence tailing off.
  let lastLoudIndex = -1;
  for (let i = windows.length - 1; i >= 0; i--) {
    if (windows[i].rms >= loudThreshold) {
      lastLoudIndex = i;
      break;
    }
  }
  if (lastLoudIndex === -1) return null;

  return windows[lastLoudIndex].time + windowSize / sampleRate + 0.15;
}

const LOOP_REWIND_MARGIN = 0.3; // fallback lead time if analysis hasn't finished yet

function loopBackToHalfway() {
  bgMusic.pause();
  bgMusic.currentTime = bgMusic.duration / 2;
  bgMusic.play().catch(() => {});
}

bgMusic.addEventListener("timeupdate", () => {
  if (typeof boss !== "undefined" && boss.state === "dead") return;
  if (!bgMusic.duration) return;
  const cutAt = loopCutTime !== null ? loopCutTime : bgMusic.duration - LOOP_REWIND_MARGIN;
  if (bgMusic.currentTime >= cutAt) loopBackToHalfway();
});

bgMusic.addEventListener("ended", () => {
  if (typeof boss !== "undefined" && boss.state === "dead") return;
  loopBackToHalfway();
});

// A shared short-delay feedback loop standing in for reverb -- cheap, and
// enough to give big sounds a sense of space without a convolution IR file.
function getReverbSend() {
  if (!reverbSend) {
    const ac = getAudioContext();
    const delay = ac.createDelay(1);
    delay.delayTime.value = 0.16;
    const feedback = ac.createGain();
    feedback.gain.value = 0.32;
    const wet = ac.createGain();
    wet.gain.value = 0.6;
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(ac.destination);
    reverbSend = delay;
  }
  return reverbSend;
}

// Classic soft-clip waveshaper curve -- adds grit/edge to a tone.
function distortionCurve(amount) {
  const samples = 256;
  const curve = new Float32Array(samples);
  const k = amount;
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

function connectDry(node, ctx, volume, start, duration, reverb) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(volume, 0.001), start + Math.min(0.012, duration * 0.25));
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  node.connect(gain).connect(ctx.destination);
  if (reverb) {
    const send = ctx.createGain();
    send.gain.value = 0.35;
    gain.connect(send);
    send.connect(getReverbSend());
  }
}

// A single tone with a punchy envelope (fast attack, exponential decay).
// distortion (0 = clean) adds grit; reverb sends a copy to the shared space.
function playTone({ freq = 440, freqEnd = null, duration = 0.12, type = "sine", volume = 0.2, delay = 0, distortion = 0, reverb = false }) {
  if (audioMuted) return;
  const ac = getAudioContext();
  const start = ac.currentTime + delay;

  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (freqEnd !== null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), start + duration);
  }

  let output = osc;
  if (distortion > 0) {
    const shaper = ac.createWaveShaper();
    shaper.curve = distortionCurve(distortion);
    shaper.oversample = "2x";
    osc.connect(shaper);
    output = shaper;
  }

  connectDry(output, ac, volume, start, duration, reverb);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

// A low, quick-dropping sine "thump" -- the physical weight under a hit.
function playSubThump({ freq = 90, freqEnd = 35, duration = 0.2, volume = 0.25, delay = 0 }) {
  if (audioMuted) return;
  const ac = getAudioContext();
  const start = ac.currentTime + delay;

  const osc = ac.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, start);
  osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), start + duration);

  connectDry(osc, ac, volume, start, duration, false);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

// A short burst of filtered white noise -- whooshes, cracks, impacts.
function playNoise({ duration = 0.15, volume = 0.25, filterFreq = 1200, filterType = "lowpass", delay = 0, distortion = 0, reverb = false }) {
  if (audioMuted) return;
  const ac = getAudioContext();
  const start = ac.currentTime + delay;

  const bufferSize = Math.max(1, Math.floor(ac.sampleRate * duration));
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const noise = ac.createBufferSource();
  noise.buffer = buffer;

  const filter = ac.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = filterFreq;
  noise.connect(filter);

  let output = filter;
  if (distortion > 0) {
    const shaper = ac.createWaveShaper();
    shaper.curve = distortionCurve(distortion);
    filter.connect(shaper);
    output = shaper;
  }

  const gain = ac.createGain();
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  output.connect(gain).connect(ac.destination);
  if (reverb) {
    const send = ac.createGain();
    send.gain.value = 0.35;
    gain.connect(send);
    send.connect(getReverbSend());
  }

  noise.start(start);
}

// --- Named sound effects ---------------------------------------------------

function sfxJump() {
  playTone({ freq: 340, freqEnd: 680, duration: 0.1, type: "square", volume: 0.18 });
  playSubThump({ freq: 160, freqEnd: 300, duration: 0.06, volume: 0.08 });
}

function sfxLand() {
  playSubThump({ freq: 90, freqEnd: 40, duration: 0.12, volume: 0.2 });
  playNoise({ duration: 0.07, volume: 0.16, filterFreq: 250 });
}

function sfxDash() {
  playNoise({ duration: 0.16, volume: 0.24, filterFreq: 2400, filterType: "bandpass" });
  playTone({ freq: 600, freqEnd: 1100, duration: 0.14, type: "sawtooth", volume: 0.14, distortion: 10 });
  playSubThump({ freq: 130, freqEnd: 60, duration: 0.1, volume: 0.12 });
}

function sfxDropThrough() {
  playNoise({ duration: 0.1, volume: 0.12, filterFreq: 500 });
}

function sfxSlash() {
  // A sharp transient "crack" first, then the body of the swing -- reads as
  // a real weapon connecting, not a soft blip.
  playNoise({ duration: 0.04, volume: 0.32, filterFreq: 5500, filterType: "highpass" });
  playNoise({ duration: 0.09, volume: 0.2, filterFreq: 2800, filterType: "highpass", delay: 0.015 });
  playTone({ freq: 950, freqEnd: 140, duration: 0.11, type: "sawtooth", volume: 0.2, distortion: 16 });
  playSubThump({ freq: 140, freqEnd: 60, duration: 0.08, volume: 0.1 });
}

function sfxMagicBullet() {
  playTone({ freq: 1100, freqEnd: 1700, duration: 0.06, type: "square", volume: 0.16, distortion: 6 });
  playTone({ freq: 550, freqEnd: 850, duration: 0.05, type: "sine", volume: 0.07 });
}

function sfxMagicCube() {
  playTone({ freq: 100, freqEnd: 45, duration: 0.42, type: "sawtooth", volume: 0.28, distortion: 22, reverb: true });
  playNoise({ duration: 0.3, volume: 0.2, filterFreq: 900, delay: 0.04 });
  playSubThump({ freq: 75, freqEnd: 30, duration: 0.4, volume: 0.24 });
}

// A dull, muted "denied" thunk for trying to cast either magic without
// enough MP -- distinct from the real casts so it reads as a fail, not a fizzle.
function sfxMagicDenied() {
  playTone({ freq: 180, freqEnd: 120, duration: 0.1, type: "square", volume: 0.12 });
  playNoise({ duration: 0.06, volume: 0.08, filterFreq: 300 });
}

function sfxPlayerHurt() {
  playTone({ freq: 340, freqEnd: 70, duration: 0.32, type: "sawtooth", volume: 0.28, distortion: 18 });
  playNoise({ duration: 0.14, volume: 0.16, filterFreq: 1500 });
  playSubThump({ freq: 110, freqEnd: 40, duration: 0.22, volume: 0.16 });
}

function sfxEnemyHit() {
  playTone({ freq: 1500, freqEnd: 550, duration: 0.06, type: "square", volume: 0.16, distortion: 10 });
  playNoise({ duration: 0.04, volume: 0.12, filterFreq: 4200, filterType: "highpass" });
}

function sfxProximityWarning() {
  playTone({ freq: 500, freqEnd: 750, duration: 0.28, type: "sine", volume: 0.15 });
  playTone({ freq: 750, freqEnd: 950, duration: 0.2, type: "sine", volume: 0.1, delay: 0.16 });
}

function sfxSlimeDropFall() {
  playNoise({ duration: 0.14, volume: 0.14, filterFreq: 700, filterType: "bandpass" });
}

// A boulder-sized slime rain drop actually landing on the player -- heavier
// than the normal hurt sound, layered alongside it for extra weight.
function sfxSlimeRainImpact() {
  playSubThump({ freq: 100, freqEnd: 25, duration: 0.35, volume: 0.3 });
  playNoise({ duration: 0.3, volume: 0.28, filterFreq: 500, filterType: "lowpass" });
}

function sfxBossCeilingStick() {
  playNoise({ duration: 0.15, volume: 0.16, filterFreq: 800 });
  playSubThump({ freq: 80, freqEnd: 40, duration: 0.15, volume: 0.12 });
}

function sfxBossBlobShoot() {
  playTone({ freq: 180, freqEnd: 90, duration: 0.3, type: "sawtooth", volume: 0.16, distortion: 10 });
  playNoise({ duration: 0.2, volume: 0.14, filterFreq: 600 });
}

function sfxSlimePuddleSplat() {
  playNoise({ duration: 0.18, volume: 0.18, filterFreq: 500, filterType: "bandpass" });
  playTone({ freq: 200, freqEnd: 100, duration: 0.15, type: "sine", volume: 0.1 });
}

// Short and quiet on purpose -- fires every ATTACK1_FIRE_INTERVAL frames,
// so it needs to not become grating over a ~2.5s burst.
function sfxMinigunShot() {
  playTone({ freq: 700, freqEnd: 400, duration: 0.04, type: "square", volume: 0.07, distortion: 6 });
}

// Four distinct wet, gooey "something's coming" cues -- one per attack,
// played the instant it's chosen (alongside the visual flash-color
// telegraph) so the sound alone hints at which attack is about to happen.

// Attack 1: slime bubbling up, working itself into a rapid-fire frenzy.
function sfxSlimeTelegraph1() {
  playNoise({ duration: 0.4, volume: 0.22, filterFreq: 500, filterType: "lowpass" });
  playTone({ freq: 180, freqEnd: 260, duration: 0.3, type: "sine", volume: 0.14 });
  playTone({ freq: 140, freqEnd: 220, duration: 0.3, type: "sine", volume: 0.1, delay: 0.15 });
}

// Attack 2: thick goo stretching taut, gathering itself before the limb shoots out.
function sfxSlimeTelegraph2() {
  playNoise({ duration: 0.5, volume: 0.2, filterFreq: 350, filterType: "lowpass" });
  playTone({ freq: 90, freqEnd: 160, duration: 0.45, type: "sine", volume: 0.16 });
}

// Attack 3: a heavy wet gulp, sucking itself in before it leaps.
function sfxSlimeTelegraph3() {
  playNoise({ duration: 0.3, volume: 0.22, filterFreq: 300, filterType: "lowpass" });
  playTone({ freq: 220, freqEnd: 90, duration: 0.35, type: "sine", volume: 0.18 });
  playSubThump({ freq: 70, freqEnd: 40, duration: 0.3, volume: 0.14 });
}

// Attack 4: a rising wet suction, like it's about to climb to the ceiling.
function sfxSlimeTelegraph4() {
  playNoise({ duration: 0.4, volume: 0.2, filterFreq: 700, filterType: "bandpass" });
  playTone({ freq: 130, freqEnd: 320, duration: 0.4, type: "sine", volume: 0.15 });
}

// Attack 1's windup -- an angry guttural growl right before it starts firing.
function sfxBossGrowl() {
  playTone({ freq: 70, freqEnd: 55, duration: 0.5, type: "sawtooth", volume: 0.28, distortion: 26 });
  playTone({ freq: 95, freqEnd: 60, duration: 0.45, type: "square", volume: 0.16, distortion: 20, delay: 0.05 });
  playNoise({ duration: 0.5, volume: 0.22, filterFreq: 400, filterType: "bandpass", distortion: 10 });
  playSubThump({ freq: 65, freqEnd: 30, duration: 0.5, volume: 0.2 });
}

// Attack 2's windup -- a wet, sloppy squelch as the limb gathers itself
// before shooting out.
function sfxSlimeShloosh() {
  playNoise({ duration: 0.32, volume: 0.3, filterFreq: 900, filterType: "lowpass" });
  playTone({ freq: 300, freqEnd: 120, duration: 0.28, type: "sine", volume: 0.14 });
  playNoise({ duration: 0.18, volume: 0.18, filterFreq: 2200, filterType: "bandpass", delay: 0.08 });
}

// Attack 3's launch -- a springy "boing" as it jumps.
function sfxBossBounce() {
  playTone({ freq: 150, freqEnd: 380, duration: 0.12, type: "sine", volume: 0.22 });
  playTone({ freq: 380, freqEnd: 100, duration: 0.22, type: "sine", volume: 0.18, delay: 0.1 });
  playSubThump({ freq: 90, freqEnd: 40, duration: 0.15, volume: 0.14 });
}

// Attack 4's launch -- the same bounce as it jumps, then a wet slinging
// whoosh right after, like it's already flinging slime on the way up.
function sfxBossBounceThrow() {
  playTone({ freq: 150, freqEnd: 380, duration: 0.12, type: "sine", volume: 0.2 });
  playTone({ freq: 380, freqEnd: 110, duration: 0.2, type: "sine", volume: 0.16, delay: 0.1 });
  playNoise({ duration: 0.25, volume: 0.24, filterFreq: 1400, filterType: "bandpass", delay: 0.28 });
  playTone({ freq: 220, freqEnd: 90, duration: 0.22, type: "sawtooth", volume: 0.16, distortion: 8, delay: 0.3 });
}

// Attack 3's landing zone appearing -- a double alarm blip warning the
// player where the slam is about to land.
function sfxBossWarningZone() {
  playTone({ freq: 440, freqEnd: 440, duration: 0.12, type: "square", volume: 0.18 });
  playTone({ freq: 440, freqEnd: 440, duration: 0.12, type: "square", volume: 0.18, delay: 0.18 });
  playNoise({ duration: 0.3, volume: 0.12, filterFreq: 2000, filterType: "highpass" });
}

function sfxBossSlamImpact() {
  playSubThump({ freq: 110, freqEnd: 28, duration: 0.55, volume: 0.45 });
  playNoise({ duration: 0.45, volume: 0.36, filterFreq: 320, reverb: true });
  playTone({ freq: 65, freqEnd: 24, duration: 0.55, type: "sawtooth", volume: 0.3, distortion: 28, reverb: true });
}

// Death sequence: a startled little "uh oh" upward whoop before the anvil
// shows up.
function sfxBossLookUp() {
  playTone({ freq: 220, freqEnd: 340, duration: 0.3, type: "triangle", volume: 0.2, distortion: 6 });
  playTone({ freq: 140, freqEnd: 210, duration: 0.3, type: "sine", volume: 0.14, delay: 0.04 });
}

// A falling-object whistle while the anvil drops from off-screen.
function sfxAnvilWhistle() {
  playTone({ freq: 1400, freqEnd: 500, duration: 0.36, type: "sine", volume: 0.16 });
  playNoise({ duration: 0.36, volume: 0.08, filterFreq: 2500, filterType: "highpass" });
}

// The big flattening impact -- same weight as the old explosion sting, plus
// a wet splat layer for the slime burst.
function sfxAnvilCrush() {
  playSubThump({ freq: 140, freqEnd: 18, duration: 0.9, volume: 0.5 });
  playNoise({ duration: 0.85, volume: 0.42, filterFreq: 600, reverb: true });
  playTone({ freq: 160, freqEnd: 28, duration: 0.9, type: "sawtooth", volume: 0.32, distortion: 32, reverb: true });
  playNoise({ duration: 0.15, volume: 0.3, filterFreq: 6000, filterType: "highpass", delay: 0.02 });
  playNoise({ duration: 0.3, volume: 0.3, filterFreq: 900, filterType: "lowpass", delay: 0.03 });
}

// A huge double-impact thud for the troll's teaser hand slam -- heavier and
// longer than the anvil crush, since these are meant to feel much bigger.
function sfxTrollHandSlam() {
  playSubThump({ freq: 90, freqEnd: 14, duration: 1.1, volume: 0.55 });
  playNoise({ duration: 1.0, volume: 0.45, filterFreq: 250, reverb: true });
  playTone({ freq: 60, freqEnd: 18, duration: 1.1, type: "sawtooth", volume: 0.3, distortion: 30, reverb: true });
  playNoise({ duration: 0.5, volume: 0.25, filterFreq: 1400, filterType: "bandpass", delay: 0.05 });
}

function sfxWin() {
  const notes = [523, 659, 784, 1046, 1318];
  notes.forEach((freq, i) => {
    playTone({ freq, duration: 0.32, type: "triangle", volume: 0.2, delay: i * 0.1, reverb: true });
    playTone({ freq: freq / 2, duration: 0.32, type: "sine", volume: 0.1, delay: i * 0.1 });
  });
}

function sfxGameOver() {
  const notes = [420, 340, 260, 170];
  notes.forEach((freq, i) => {
    playTone({ freq, duration: 0.4, type: "sawtooth", volume: 0.2, delay: i * 0.16, distortion: 12 });
  });
  playSubThump({ freq: 90, freqEnd: 25, duration: 0.8, volume: 0.22, delay: 0.55 });
}

function sfxUiClick() {
  playTone({ freq: 500, freqEnd: 750, duration: 0.05, type: "square", volume: 0.12 });
}
