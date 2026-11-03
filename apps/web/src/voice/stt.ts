import { nativeCall, nativeHas, onNative } from '../native/bridge';

/**
 * Speech-to-text via the browser Web Speech API (Chrome/Edge/Safari), or the Flutter shell's native
 * recogniser when the page runs inside the app (iOS WKWebView has no Web Speech API).
 * Minimal typings: lib.dom does not ship SpeechRecognition.
 */
interface SRAlternative {
  transcript: string;
  confidence: number;
}
interface SRResult {
  isFinal: boolean;
  length: number;
  [index: number]: SRAlternative;
}
interface SREvent {
  resultIndex: number;
  results: { length: number; [index: number]: SRResult };
}
interface SRErrorEvent {
  error: string;
  message?: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SRCtor = new () => SpeechRecognitionLike;

function ctor(): SRCtor | null {
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function sttSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return nativeHas('stt') || ctor() !== null;
}

export interface SttHandle {
  /** Stop listening; final results are still delivered. */
  stop(): void;
  /** Stop immediately and discard results. */
  abort(): void;
}

export interface SttOptions {
  lang?: string;
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (code: string) => void;
  onEnd: () => void;
}

export function startStt(opts: SttOptions): SttHandle | null {
  if (nativeHas('stt')) return startNativeStt(opts);
  const C = ctor();
  if (!C) return null;
  const rec = new C();
  rec.lang = opts.lang ?? 'en-US';
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  let finalText = '';
  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i]!;
      const t = r[0]?.transcript ?? '';
      if (r.isFinal) finalText += (finalText ? ' ' : '') + t.trim();
      else interim += t;
    }
    if (interim) opts.onInterim((finalText + ' ' + interim).trim());
    if (finalText) opts.onFinal(finalText);
  };
  rec.onerror = (e) => opts.onError(e.error);
  rec.onend = () => opts.onEnd();
  try {
    rec.start();
  } catch {
    opts.onError('start-failed');
    return null;
  }
  return { stop: () => rec.stop(), abort: () => rec.abort() };
}

function startNativeStt(opts: SttOptions): SttHandle {
  let done = false;
  const off = onNative((e) => {
    if (done) return;
    if (e.type === 'stt.interim') opts.onInterim(e.text);
    else if (e.type === 'stt.final') opts.onFinal(e.text);
    else if (e.type === 'stt.error') opts.onError(e.code);
    else if (e.type === 'stt.end') {
      done = true;
      off();
      opts.onEnd();
    }
  });
  void nativeCall('stt.start', { lang: opts.lang ?? 'en-US' }).then((ok) => {
    if (ok === false && !done) {
      done = true;
      off();
      opts.onError('not-allowed');
      opts.onEnd();
    }
  });
  return {
    stop: () => void nativeCall('stt.stop'),
    abort: () => {
      done = true;
      off();
      void nativeCall('stt.abort');
    },
  };
}
