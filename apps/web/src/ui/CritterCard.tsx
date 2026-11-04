import { useEffect, useState } from 'react';
import { CRITTERS } from '../world/critters';
import { CYCLISTS } from '../world/cyclists';
import { useGame } from '../store/game';
import { useSettings } from '../store/settings';
import { useVoice } from '../store/voice';
import { addVocab } from '../net/api';
import { track } from '../net/analytics';
import { critterSound } from '../audio/ambient';

const saved = new Set<string>();

/** Tap a cat, dog or passing cyclist: it reacts, says its line in English, and the key word goes to the notebook. */
export function CritterCard() {
  const id = useGame((s) => s.selectedCritter);
  const close = useGame((s) => s.setSelectedCritter);
  const vol = useSettings((s) => s.ambientVolume);
  const speak = useVoice((s) => s.speakAs);
  const c = CRITTERS.find((x) => x.id === id) ?? CYCLISTS.find((x) => x.id === id);
  const [state, setState] = useState<'idle' | 'saved'>('idle');
  useEffect(() => {
    if (!c) return;
    critterSound(c.sound, Math.max(0.3, vol));
    speak('critter', c.sentence, 'en-US');
    track('critter_tap', { id: c.id });
    setState(saved.has(c.id) ? 'saved' : 'idle');
    if (!saved.has(c.id)) {
      saved.add(c.id);
      addVocab(c.word.en, c.word.vi, c.sentence)
        .then(() => setState('saved'))
        .catch(() => saved.delete(c.id));
    }
    const t = setTimeout(() => close(null), 6000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c?.id]);
  if (!c) return null;
  return (
    <div data-ui className="absolute bottom-[calc(max(1.25rem,env(safe-area-inset-bottom))+5.5rem)] left-1/2 z-20 w-[92vw] max-w-xs -translate-x-1/2 rounded-xl bg-white/95 p-3 text-sm shadow-2xl sm:bottom-24">
      <div className="flex items-start justify-between gap-2">
        <div>
          <b>{c.kind === 'cat' ? '🐱' : c.kind === 'cyclist' ? '🚴' : '🐶'} {c.name}</b>
          <div className="mt-1">{c.sentence}</div>
          <div className="mt-1 text-xs text-blue-900">
            <b>{c.word.en}</b> — {c.word.vi} {state === 'saved' ? '· 📓 saved' : ''}
          </div>
        </div>
        <button type="button" onClick={() => close(null)} className="min-h-9 min-w-9 text-gray-500" aria-label="Close">
          ✕
        </button>
      </div>
    </div>
  );
}
