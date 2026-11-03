import { create } from 'zustand';
import { track } from '../net/analytics';
import { speak, stopSpeaking, ttsSupported } from '../voice/tts';
import { sttSupported } from '../voice/stt';

interface VoiceStore {
  ttsSupported: boolean;
  sttSupported: boolean;
  muted: boolean;
  setMuted: (m: boolean) => void;
  /** NPC currently being voiced (drives the talk animation). */
  speakingNpc: string | null;
  listening: boolean;
  setListening: (l: boolean) => void;
  /** Speak a line as an NPC; no-op when muted. */
  speakAs: (npcId: string, text: string, lang: string) => void;
  stop: () => void;
}

let cancelCurrent: (() => void) | null = null;

export const useVoice = create<VoiceStore>((set, get) => ({
  ttsSupported: ttsSupported(),
  sttSupported: sttSupported(),
  muted: localStorage.getItem('es:muted') === '1',
  setMuted: (muted) => {
    localStorage.setItem('es:muted', muted ? '1' : '0');
    if (muted) track('tts_off');
    if (muted) get().stop();
    set({ muted });
  },
  speakingNpc: null,
  listening: false,
  setListening: (listening) => set({ listening }),
  speakAs: (npcId, text, lang) => {
    if (get().muted || !get().ttsSupported) return;
    cancelCurrent?.();
    cancelCurrent = speak(text, {
      lang,
      onStart: () => set({ speakingNpc: npcId }),
      onEnd: () => set((s) => (s.speakingNpc === npcId ? { speakingNpc: null } : {})),
    });
  },
  stop: () => {
    cancelCurrent?.();
    cancelCurrent = null;
    stopSpeaking();
    set({ speakingNpc: null });
  },
}));
