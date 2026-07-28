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

function sfxPlayerHurt() {
  playTone({ freq: 340, freqEnd: 70, duration: 0.32, type: "sawtooth", volume: 0.28, distortion: 18 });
  playNoise({ duration: 0.14, volume: 0.16, filterFreq: 1500 });
  playSubThump({ freq: 110, freqEnd: 40, duration: 0.22, volume: 0.16 });
}

function sfxEnemyHit() {
  playTone({ freq: 1500, freqEnd: 550, duration: 0.06, type: "square", volume: 0.16, distortion: 10 });
  playNoise({ duration: 0.04, volume: 0.12, filterFreq: 4200, filterType: "highpass" });
}

function sfxBossTelegraph() {
  playTone({ freq: 85, freqEnd: 135, duration: 0.55, type: "sawtooth", volume: 0.22, distortion: 14, reverb: true });
  playSubThump({ freq: 55, freqEnd: 45, duration: 0.5, volume: 0.18 });
}

function sfxBossFireBullets() {
  playNoise({ duration: 0.3, volume: 0.3, filterFreq: 1800, distortion: 6 });
  playSubThump({ freq: 110, freqEnd: 55, duration: 0.16, volume: 0.18 });
}

function sfxBossLimb() {
  playNoise({ duration: 0.22, volume: 0.28, filterFreq: 1000, filterType: "bandpass", distortion: 8 });
  playTone({ freq: 200, freqEnd: 420, duration: 0.18, type: "sawtooth", volume: 0.16, distortion: 14 });
  playSubThump({ freq: 100, freqEnd: 50, duration: 0.14, volume: 0.14 });
}

function sfxBossSlamImpact() {
  playSubThump({ freq: 110, freqEnd: 28, duration: 0.55, volume: 0.45 });
  playNoise({ duration: 0.45, volume: 0.36, filterFreq: 320, reverb: true });
  playTone({ freq: 65, freqEnd: 24, duration: 0.55, type: "sawtooth", volume: 0.3, distortion: 28, reverb: true });
}

function sfxExplosion() {
  playSubThump({ freq: 140, freqEnd: 18, duration: 0.9, volume: 0.5 });
  playNoise({ duration: 0.85, volume: 0.42, filterFreq: 600, reverb: true });
  playTone({ freq: 160, freqEnd: 28, duration: 0.9, type: "sawtooth", volume: 0.32, distortion: 32, reverb: true });
  playNoise({ duration: 0.15, volume: 0.3, filterFreq: 6000, filterType: "highpass", delay: 0.02 });
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
