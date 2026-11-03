/** Text-to-speech via the browser SpeechSynthesis API. */

export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

let voicesCache: SpeechSynthesisVoice[] = [];
function voices(): SpeechSynthesisVoice[] {
  if (!ttsSupported()) return [];
  const v = window.speechSynthesis.getVoices();
  if (v.length) voicesCache = v;
  return voicesCache;
}
if (ttsSupported()) {
  voices();
  window.speechSynthesis.onvoiceschanged = () => voices();
}

/** Prefer an exact locale match, then any English voice; favour "natural"/Google voices when present. */
export function pickVoice(lang: string): SpeechSynthesisVoice | null {
  const all = voices();
  if (!all.length) return null;
  const score = (v: SpeechSynthesisVoice) => {
    let s = 0;
    const vl = v.lang.replace('_', '-').toLowerCase();
    if (vl === lang.toLowerCase()) s += 10;
    else if (vl.startsWith('en')) s += 4;
    if (/natural|neural|google|premium|enhanced/i.test(v.name)) s += 2;
    if (v.localService) s += 0.5;
    return s;
  };
  return [...all].sort((a, b) => score(b) - score(a))[0] ?? null;
}

export interface SpeakOptions {
  lang?: string;
  rate?: number;
  onStart?: () => void;
  onEnd?: () => void;
}

/** Speak `text`; returns a cancel function. Any ongoing speech is cancelled first. */
export function speak(text: string, opts: SpeakOptions = {}): () => void {
  if (!ttsSupported() || !text.trim()) {
    opts.onEnd?.();
    return () => undefined;
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const lang = opts.lang ?? 'en-US';
  u.lang = lang;
  const v = pickVoice(lang);
  if (v) u.voice = v;
  u.rate = opts.rate ?? 0.95;
  u.pitch = 1;
  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    opts.onEnd?.();
  };
  u.onstart = () => opts.onStart?.();
  u.onend = end;
  u.onerror = end;
  try {
    synth.speak(u);
  } catch {
    // A broken/blocked synthesis engine must never take the game down.
    end();
    return () => undefined;
  }
  // Safari/Chrome sometimes never fire onend for cancelled utterances; guard with a timeout.
  const guard = window.setTimeout(end, 1000 + text.length * 90);
  return () => {
    window.clearTimeout(guard);
    synth.cancel();
    end();
  };
}

export function stopSpeaking() {
  if (ttsSupported()) window.speechSynthesis.cancel();
}
