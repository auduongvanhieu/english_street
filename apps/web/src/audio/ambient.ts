/**
 * Procedural ambient sound (no audio assets): occasional bird chirps only, no continuous noise bed
 * (the filtered-noise "wind" layer was removed because it sounded like static). Starts on the first
 * user gesture (autoplay policy) and follows the ambientVolume setting; 0 = fully silent.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let chirpTimer: number | null = null;

function ensure(): boolean {
  if (ctx) return true;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  return true;
}

/** Birds keep quiet at night and in the rain (scene/Sky.tsx). */
export const ambientBirds = { on: true };

function chirp() {
  if (!ctx || !master || !ambientBirds.on) return;
  const t = ctx.currentTime;
  const n = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const f0 = 2200 + Math.random() * 1500;
    const start = t + i * 0.16 + Math.random() * 0.05;
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, start);
    o.frequency.exponentialRampToValueAtTime(f0 * (1.3 + Math.random() * 0.4), start + 0.06);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.9, start + 0.12);
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(0.08, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, start + 0.14);
    o.connect(g).connect(master);
    o.start(start);
    o.stop(start + 0.16);
  }
}

function scheduleChirps() {
  chirpTimer = window.setTimeout(() => {
    chirp();
    scheduleChirps();
  }, 8000 + Math.random() * 14000);
}

/** Apply the volume setting (0..1). Needs a prior user gesture to actually produce sound. */
export function setAmbientVolume(v: number) {
  if (v <= 0) {
    if (ctx && master) master.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
    if (chirpTimer) window.clearTimeout(chirpTimer);
    chirpTimer = null;
    return;
  }
  if (!ensure()) return;
  void ctx!.resume();
  master!.gain.setTargetAtTime(v * 0.6, ctx!.currentTime, 0.5);
  if (!chirpTimer) scheduleChirps();
}

/** Soft "hop" for the local player's jump; follows the ambient volume slider (0 = silent). */
export function hopSound(volume = 0.5) {
  if (volume <= 0 || !ensure()) return;
  void ctx!.resume();
  const t = ctx!.currentTime;
  const o = ctx!.createOscillator();
  const g = ctx!.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(260, t);
  o.frequency.exponentialRampToValueAtTime(520, t + 0.09);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.12 * volume, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  o.connect(g).connect(ctx!.destination);
  o.start(t);
  o.stop(t + 0.13);
}

/** Bicycle bell: two bright pings. */
export function bellSound(volume = 0.5) {
  if (!ensure() || volume <= 0) return;
  void ctx!.resume();
  const t = ctx!.currentTime;
  for (const start of [t, t + 0.14]) {
    const o = ctx!.createOscillator();
    const g = ctx!.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(2300, start);
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(0.18 * volume, start + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
    o.connect(g).connect(ctx!.destination);
    o.start(start);
    o.stop(start + 0.26);
  }
}

/** Short critter voice: a meow (gliding tone), a woof (low burst) or a bicycle bell. */
export function critterSound(kind: 'meow' | 'woof' | 'bell' | 'quack' | 'squeak' | 'baa', volume = 0.5) {
  if (kind === 'bell') return bellSound(volume);
  if (!ensure() || volume <= 0) return;
  void ctx!.resume();
  const t = ctx!.currentTime;
  if (kind === 'baa') {
    // a little bleat: nasal tone with a fast wobble in loudness ("meh-eh-eh")
    const o = ctx!.createOscillator();
    const g = ctx!.createGain();
    const bp = ctx!.createBiquadFilter();
    const lfo = ctx!.createOscillator();
    const depth = ctx!.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(560, t);
    o.frequency.linearRampToValueAtTime(500, t + 0.45);
    bp.type = 'bandpass';
    bp.frequency.value = 1300;
    bp.Q.value = 2;
    lfo.frequency.value = 22;
    depth.gain.value = 0.12 * volume;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.22 * volume, t + 0.04);
    g.gain.setValueAtTime(0.22 * volume, t + 0.35);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    lfo.connect(depth).connect(g.gain);
    o.connect(bp).connect(g).connect(ctx!.destination);
    o.start(t);
    lfo.start(t);
    o.stop(t + 0.52);
    lfo.stop(t + 0.52);
    return;
  }
  if (kind === 'quack' || kind === 'squeak') {
    // quack: two nasal buzzes through a band-pass; squeak: a tiny high chirp
    const quack = kind === 'quack';
    for (let i = 0; i < (quack ? 2 : 1); i++) {
      const t0 = t + i * 0.22;
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      const bp = ctx!.createBiquadFilter();
      o.type = quack ? 'sawtooth' : 'sine';
      o.frequency.setValueAtTime(quack ? 330 : 1500, t0);
      o.frequency.exponentialRampToValueAtTime(quack ? 220 : 2300, t0 + (quack ? 0.15 : 0.08));
      bp.type = 'bandpass';
      bp.frequency.value = quack ? 1100 : 1800;
      bp.Q.value = quack ? 2.5 : 1;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime((quack ? 0.4 : 0.18) * volume, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + (quack ? 0.17 : 0.1));
      o.connect(bp).connect(g).connect(ctx!.destination);
      o.start(t0);
      o.stop(t0 + 0.2);
    }
    return;
  }
  const o = ctx!.createOscillator();
  const g = ctx!.createGain();
  if (kind === 'meow') {
    o.type = 'triangle';
    o.frequency.setValueAtTime(520, t);
    o.frequency.exponentialRampToValueAtTime(880, t + 0.18);
    o.frequency.exponentialRampToValueAtTime(600, t + 0.5);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.25 * volume, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    o.connect(g).connect(ctx!.destination);
    o.start(t);
    o.stop(t + 0.6);
  } else {
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(110, t + 0.12);
    const lp = ctx!.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.35 * volume, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(lp).connect(g).connect(ctx!.destination);
    o.start(t);
    o.stop(t + 0.2);
  }
}
