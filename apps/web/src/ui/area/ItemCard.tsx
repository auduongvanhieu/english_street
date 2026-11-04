import { useEffect, useRef, useState } from 'react';
import type { AreaItemDto } from '@es/shared';
import { useArea } from '../../store/area';
import { useShopping } from '../../store/shopping';
import { addVocab } from '../../net/api';
import { startStt, sttSupported, type SttHandle } from '../../voice/stt';
import { learnerLang, useLang, useT } from '../../i18n';
import { track } from '../../net/analytics';
import { Line, ListenButtons, say } from './common';

const saved = new Set<string>();

/** Loose match of what the learner said against the target word ("a lion" / "lions" / "Lion!" all count). */
export function saidIt(heard: string, target: string, plural?: string) {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z' ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const h = ` ${norm(heard)} `;
  return [target, plural].filter(Boolean).some((w) => h.includes(` ${norm(w!)} `));
}

/** Pronunciation check with the speech recogniser: say the word, get ✓ or what we heard. */
function SayIt({ item }: { item: AreaItemDto }) {
  const t = useT();
  const [state, setState] = useState<'idle' | 'listening' | 'ok' | 'miss' | 'error'>('idle');
  const [heard, setHeard] = useState('');
  const h = useRef<SttHandle | null>(null);
  useEffect(() => () => h.current?.abort(), []);
  if (!sttSupported()) return null;
  function start() {
    setHeard('');
    setState('listening');
    let last = '';
    h.current = startStt({
      lang: 'en-US',
      onInterim: (x) => setHeard(x),
      onFinal: (x) => {
        last = x;
        setHeard(x);
        if (saidIt(x, item.en, item.plural)) {
          setState('ok');
          h.current?.stop();
        }
      },
      onError: () => setState('error'),
      onEnd: () => {
        setState((s) => (s === 'listening' ? (saidIt(last, item.en, item.plural) ? 'ok' : 'miss') : s));
        track('say_it', { item: item.id });
      },
    });
    if (!h.current) setState('error');
    else setTimeout(() => h.current?.stop(), 4000);
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
      <button type="button" onClick={start} disabled={state === 'listening'} className={`min-h-9 rounded-full px-3 font-medium text-white ${state === 'listening' ? 'animate-pulse bg-red-500' : 'bg-purple-600'}`}>
        🎤 {state === 'listening' ? t('Listening…') : t('Say it')}
      </button>
      {state === 'ok' ? <span className="font-semibold text-green-700">✓ {t('Great pronunciation!')}</span> : null}
      {state === 'miss' ? (
        <span className="text-amber-700">
          {t('We heard:')} <i dir="ltr">“{heard || '…'}”</i> · {t('Try again!')}
        </span>
      ) : null}
      {state === 'error' ? <span className="text-gray-500">{t('Microphone not available')}</span> : null}
    </div>
  );
}

/** "⚑ Wrong translation?" → one telemetry event (area, item, language) for the content team to review. */
function ReportTranslation({ area, item }: { area: string; item: string }) {
  const t = useT();
  const [sent, setSent] = useState(false);
  useEffect(() => setSent(false), [item]);
  return (
    <div className="mt-1.5 text-end">
      <button
        type="button"
        disabled={sent}
        onClick={() => {
          track('translation_report', { area, item, lang: learnerLang() });
          setSent(true);
        }}
        className="text-[11px] text-gray-400 underline-offset-2 hover:underline disabled:no-underline"
      >
        {sent ? t('Thanks! We will check it.') : `⚑ ${t('Wrong translation?')}`}
      </button>
    </div>
  );
}

/** Full card for one area item: picture, word, IPA, listen, meaning, sentences, fact, say it, save. */
export function ItemCard() {
  const t = useT();
  const card = useArea((s) => s.card);
  const content = useArea((s) => (card ? s.content[card.area] : undefined));
  const close = useArea((s) => s.openCard);
  const noTr = useLang((s) => s.lang === 'en');
  const shopping = useShopping((s) => s.list.length > 0);
  const [state, setState] = useState<'idle' | 'saved'>('idle');
  const item = content?.items.find((i) => i.id === card?.item);
  useEffect(() => {
    if (!item) return;
    setState(saved.has(item.id) ? 'saved' : 'idle');
    say(item.en);
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!card) return null;
  const save = () => {
    if (!item) return;
    saved.add(item.id);
    setState('saved');
    void addVocab(item.en, item.tr.meaning || item.en, item.sentences[0]?.en ?? '', learnerLang()).catch(() => {
      saved.delete(item.id);
      setState('idle');
    });
  };
  return (
    <div data-ui className="absolute bottom-[calc(max(1rem,env(safe-area-inset-bottom))+4.5rem)] left-1/2 z-30 max-h-[70dvh] w-[94vw] max-w-md -translate-x-1/2 overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:bottom-6">
      {!item ? (
        <div className="py-6 text-center text-sm text-gray-500">{t('Loading…')}</div>
      ) : (
        <>
          <div className="flex items-start gap-3">
            <div className="text-5xl leading-none">{item.icon}</div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-2" dir="ltr">
                <b className="text-2xl">{item.en}</b>
                {item.plural && item.plural !== item.en ? <span className="text-sm text-gray-500">({item.plural})</span> : null}
                <span className="text-xs text-gray-400">{item.pos}</span>
              </div>
              {item.ipa ? (
                <div className="font-mono text-sm text-gray-600" dir="ltr">
                  /{item.ipa}/
                </div>
              ) : null}
              {!noTr && item.tr.meaning ? <div className="text-base font-medium text-blue-800">{item.tr.meaning}</div> : null}
              {item.price !== undefined ? (
                <div className="text-sm text-emerald-700" dir="ltr">
                  ${item.price.toFixed(2)}
                  {item.unit ? ` · ${item.unit} ${item.plural ?? item.en}` : ''}
                </div>
              ) : null}
            </div>
            <button type="button" onClick={() => close(null)} className="min-h-9 min-w-9 text-gray-500" aria-label={t('Close')}>
              ✕
            </button>
          </div>
          <div className="mt-2">
            <ListenButtons text={item.en} />
          </div>
          {item.note ? (
            <div className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-900">
              <span dir="ltr">💡 {item.note}</span>
              {!noTr && item.tr.note ? <div className="text-amber-800/80">{item.tr.note}</div> : null}
            </div>
          ) : null}
          <div className="mt-2 divide-y">
            {item.sentences.map((s, i) => (
              <Line key={i} en={s.en} tr={item.tr.sentences[i] ?? ''} level={s.level} />
            ))}
          </div>
          {item.fact ? (
            <div className="mt-2 rounded-lg bg-sky-50 px-2 py-1.5 text-xs text-sky-900">
              <b>{t('Fun fact')}:</b> <span dir="ltr">{item.fact}</span>
              {!noTr && item.tr.fact ? <div className="text-sky-800/80">{item.tr.fact}</div> : null}
            </div>
          ) : null}
          <SayIt item={item} />
          {!noTr ? <ReportTranslation area={card.area} item={item.id} /> : null}
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={state === 'saved'} onClick={save} className="min-h-10 flex-1 rounded-lg border text-sm font-medium disabled:opacity-60">
              {state === 'saved' ? t('✓ Saved') : t('📓 Save')}
            </button>
            {shopping && card.area === 'supermarket' ? (
              <button type="button" onClick={() => close(null)} className="min-h-10 flex-1 rounded-lg bg-teal-600 text-sm font-medium text-white">
                🛒 {t('Back to shopping')}
              </button>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
