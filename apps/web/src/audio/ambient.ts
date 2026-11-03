/**
 * Procedural ambient sound (no audio assets): a soft filtered-noise bed (wind / distant traffic) with
 * occasional bird chirps. Starts on the first user gesture (autoplay policy) and follows the
 * ambientVolume setting; 0 = fully silent so phones save battery.
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
  const seconds = 4;
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02; // brown-ish noise
    data[i] = last * 3.5;
  }
  const bed = ctx.createBufferSource();
  bed.buffer = buf;
  bed.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 420;
  const bedGain = ctx.createGain();
  bedGain.gain.value = 0.35;
  bed.connect(lp).connect(bedGain).connect(master);
  bed.start();
  return true;
}

function chirp() {
  if (!ctx || !master) return;
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
  }, 2500 + Math.random() * 6000);
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

/** Short critter voice: a meow (gliding tone) or a woof (low burst). */
export function critterSound(kind: 'meow' | 'woof', volume = 0.5) {
  if (!ensure() || volume <= 0) return;
  void ctx!.resume();
  const t = ctx!.currentTime;
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
