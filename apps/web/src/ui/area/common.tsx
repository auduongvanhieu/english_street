import { useState } from 'react';
import { speak } from '../../voice/tts';
import { useSettings } from '../../store/settings';
import { useT } from '../../i18n';
import { useLang } from '../../i18n';

/** Read English aloud on tap (ignores the "NPC voice" mute: the learner asked for it). */
export function say(text: string, accent: 'en-US' | 'en-GB' = 'en-US', slow = false) {
  speak(text, { lang: accent, rate: useSettings.getState().ttsRate * (slow ? 0.7 : 1) });
}

export function ListenButtons({ text, small }: { text: string; small?: boolean }) {
  const t = useT();
  const cls = `rounded-full border border-gray-300 bg-white ${small ? 'px-1.5 py-0 text-[11px]' : 'px-2 py-0.5 text-xs'} hover:bg-gray-50`;
  return (
    <span className="inline-flex shrink-0 gap-1" dir="ltr">
      <button type="button" className={cls} onClick={() => say(text, 'en-US')} title={t('Listen (American English)')} aria-label={t('Listen (American English)')}>
        🔊 US
      </button>
      <button type="button" className={cls} onClick={() => say(text, 'en-GB')} title={t('Listen (British English)')} aria-label={t('Listen (British English)')}>
        🔊 UK
      </button>
      <button type="button" className={cls} onClick={() => say(text, 'en-US', true)} title={t('Listen slowly')} aria-label={t('Listen slowly')}>
        🐢
      </button>
    </span>
  );
}

/** An English line with a "Translate" toggle (translation already in the content, '' = none). */
export function Line({ en, tr, level }: { en: string; tr: string; level?: string }) {
  const [open, setOpen] = useState(false);
  const t = useT();
  const noTr = useLang((s) => s.lang === 'en');
  return (
    <div className="py-1.5">
      <div className="flex items-start gap-2">
        {level ? <span className="mt-0.5 shrink-0 rounded bg-gray-100 px-1 text-[10px] font-semibold text-gray-500">{level}</span> : null}
        <span className="flex-1 text-sm" dir="ltr">
          {en}
        </span>
        <ListenButtons text={en} small />
      </div>
      {!noTr && tr ? (
        <button type="button" onClick={() => setOpen((o) => !o)} className="ms-7 mt-0.5 text-[11px] text-blue-700 hover:underline">
          {open ? tr : t('Translate')}
        </button>
      ) : null}
    </div>
  );
}
