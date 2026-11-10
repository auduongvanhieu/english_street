import { nativeCall, nativeHas, onNative } from '../native/bridge';

/** Set from the "Sound" setting (App.tsx). Muted speech keeps its timing, so read-along and talk flows go on. */
let muted = false;
export function setSpeechMuted(m: boolean) {
  muted = m;
  if (m) stopSpeaking();
}

/** Text-to-speech via the browser SpeechSynthesis API, or the Flutter shell's native engine inside the app. */

export function ttsSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return nativeHas('tts') || ('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window);
}

let nativeSeq = 0;
function speakNative(text: string, opts: SpeakOptions): () => void {
  const id = ++nativeSeq;
  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    off();
    opts.onEnd?.();
  };
  const off = onNative((e) => {
    if (e.type === 'tts.start' && e.id === id) opts.onStart?.();
    else if (e.type === 'tts.end' && e.id === id) end();
  });
  void nativeCall('tts.speak', { id, text, lang: opts.lang ?? 'en-US', rate: opts.rate ?? 0.95 });
  const guard = window.setTimeout(end, 2000 + text.length * 90);
  return () => {
    window.clearTimeout(guard);
    void nativeCall('tts.stop');
    end();
  };
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
  if (!text.trim()) {
    opts.onEnd?.();
    return () => undefined;
  }
  if (muted) {
    let done = false;
    const end = () => {
      if (done) return;
      done = true;
      opts.onEnd?.();
    };
    opts.onStart?.();
    const timer = window.setTimeout(end, 400 + (text.length * 60) / (opts.rate ?? 0.95));
    return () => {
      window.clearTimeout(timer);
      end();
    };
  }
  if (nativeHas('tts')) return speakNative(text, opts);
  if (!ttsSupported()) {
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
  if (nativeHas('tts')) void nativeCall('tts.stop');
  else if (ttsSupported()) window.speechSynthesis.cancel();
}
