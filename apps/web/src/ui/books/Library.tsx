import { useEffect, useMemo, useRef, useState } from 'react';
import type { Book, BookCard } from '@es/shared';
import { Sheet, SheetHeader } from '../Sheet';
import { useBooks } from '../../store/books';
import { useProfile } from '../../store/profile';
import { useSettings } from '../../store/settings';
import { useVoice } from '../../store/voice';
import { speak, stopSpeaking } from '../../voice/tts';
import { addVocab, fetchIpa, translateText } from '../../net/api';
import { learnerLang, useT } from '../../i18n';

/**
 * The library (every book, read free) and my shelf at home (books I bought): covers by level, then a reader with
 * big text, an emoji picture, read-aloud that highlights each sentence, tap-a-word (meaning, IPA, save to the
 * notebook) and 3 questions at the end of each chapter.
 */
const LEVELS = ['A1', 'A2', 'B1', 'B2'] as const;

function Cover({ c, small }: { c: Pick<BookCard, 'cover' | 'title' | 'level'>; small?: boolean }) {
  return (
    <div className={`relative flex flex-col items-center justify-center rounded-lg text-white shadow ${small ? 'h-28 w-20' : 'h-40 w-28'}`} style={{ background: c.cover.color }}>
      <span className={small ? 'text-3xl' : 'text-5xl'}>{c.cover.emoji}</span>
      <span className="mt-1 line-clamp-2 px-1 text-center text-[11px] font-bold leading-tight drop-shadow" dir="ltr">
        {c.title}
      </span>
      <span className="absolute right-1 top-1 rounded bg-black/40 px-1 text-[10px] font-semibold">{c.level}</span>
    </div>
  );
}

function Shelf() {
  const t = useT();
  const open = useBooks((s) => s.open);
  const cards = useBooks((s) => s.cards);
  const mine = useBooks((s) => s.mine);
  const [level, setLevel] = useState<string>('all');
  const [pick, setPick] = useState<BookCard | null>(null);
  const coins = useProfile((s) => s.profile?.coins ?? 0);
  const error = useBooks((s) => s.error);
  const list = cards.filter((c) => (open === 'home' ? mine.owned.includes(c.id) : true) && (level === 'all' || c.level === level));
  if (pick) {
    const owned = mine.owned.includes(pick.id);
    const done = (mine.done[pick.id] ?? []).length;
    return (
      <div>
        <button type="button" onClick={() => setPick(null)} className="mb-2 min-h-9 text-sm text-blue-700">
          ← {t('Back to the shelf')}
        </button>
        <div className="flex gap-3">
          <Cover c={pick} />
          <div className="min-w-0 flex-1" dir="ltr">
            <h3 className="text-lg font-bold">{pick.title}</h3>
            <p className="text-xs text-gray-500">
              {pick.author} · {pick.level} · {pick.chapters} chapters · {pick.words} words
            </p>
            <p className="mt-2 text-sm">{pick.summary}</p>
            {done ? <p className="mt-1 text-xs text-green-700">✔ {t('{n} chapters finished', { n: done })}</p> : null}
          </div>
        </div>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => void useBooks.getState().read(pick.id)} className="min-h-11 flex-1 rounded-xl bg-blue-600 text-sm font-semibold text-white">
            📖 {t('Read')}
          </button>
          {owned ? (
            <span className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-green-50 text-sm text-green-800">🏠 {t('On your shelf at home')}</span>
          ) : (
            <button type="button" disabled={coins < pick.price} onClick={() => void useBooks.getState().buy(pick.id)} className="min-h-11 flex-1 rounded-xl border border-amber-300 bg-amber-50 text-sm font-semibold disabled:opacity-50">
              🪙 {pick.price} · {t('Buy for my shelf at home')}
            </button>
          )}
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {['all', ...LEVELS].map((l) => (
          <button key={l} type="button" onClick={() => setLevel(l)} className={`min-h-9 rounded-full px-3 text-sm ${level === l ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>
            {l === 'all' ? t('All') : l}
          </button>
        ))}
      </div>
      {open === 'home' && !list.length ? <p className="text-sm text-gray-500">{t('Your shelf is empty. Buy books in the library at the cinema.')}</p> : null}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {list.map((c) => (
          <button key={c.id} type="button" onClick={() => setPick(c)} className="flex flex-col items-center gap-1 text-left">
            <Cover c={c} small />
            <span className="text-[11px] text-gray-500">
              {mine.owned.includes(c.id) ? '🏠' : `🪙 ${c.price}`} {(mine.done[c.id] ?? []).length ? `· ✔${(mine.done[c.id] ?? []).length}/${c.chapters}` : ''}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Split a page into sentences (keeps closing quotes with their sentence). */
const sentences = (text: string) => text.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+["”’]?\s*|[^.!?]+$/g) ?? [text];

function WordTip({ word, sentence, onClose }: { word: string; sentence: string; onClose: () => void }) {
  const t = useT();
  const [meaning, setMeaning] = useState<string | null>(null);
  const [ipa, setIpa] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let live = true;
    speak(word, { lang: 'en-US', rate: useSettings.getState().ttsRate });
    translateText(word)
      .then((r) => live && setMeaning(r.text))
      .catch(() => live && setMeaning('—'));
    fetchIpa([word])
      .then((r) => live && setIpa(r[word.toLowerCase()] ?? r[word] ?? null))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [word]);
  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] mx-auto max-w-md rounded-t-2xl bg-white p-4 shadow-2xl ring-1 ring-black/10 sm:bottom-6 sm:rounded-2xl">
      <div className="flex items-center gap-2" dir="ltr">
        <span className="text-xl font-bold">{word}</span>
        {ipa ? <span className="text-sm text-gray-500">/{ipa}/</span> : null}
        <button type="button" onClick={() => speak(word, { lang: 'en-US' })} className="min-h-9 min-w-9 rounded-full hover:bg-gray-100" aria-label="🔊">
          🔊
        </button>
        <button type="button" onClick={onClose} className="ml-auto min-h-9 min-w-9 rounded-full hover:bg-gray-100" aria-label={t('Close')}>
          ✕
        </button>
      </div>
      <p className="mt-1 text-base">{meaning ?? '…'}</p>
      <button
        type="button"
        disabled={saved || !meaning || meaning === '—'}
        onClick={() => {
          void addVocab(word, meaning ?? '', sentence.trim(), learnerLang()).then(() => setSaved(true));
        }}
        className="mt-3 min-h-10 w-full rounded-xl bg-blue-600 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saved ? `✔ ${t('Saved to your notebook')}` : `📓 ${t('Save to my notebook')}`}
      </button>
    </div>
  );
}

function Page({ text, active, onWord }: { text: string; active: number; onWord: (w: string, sentence: string) => void }) {
  const ss = useMemo(() => sentences(text), [text]);
  return (
    <p className="text-xl leading-relaxed sm:text-2xl" dir="ltr">
      {ss.map((s, si) => (
        <span key={si} className={si === active ? 'rounded bg-yellow-200' : ''}>
          {s.split(/(\s+)/).map((tok, i) => {
            const w = tok.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, '');
            if (!w) return tok;
            return (
              <span key={i} role="button" tabIndex={0} onClick={() => onWord(w, s)} className="cursor-pointer rounded hover:bg-blue-100">
                {tok}
              </span>
            );
          })}
        </span>
      ))}
    </p>
  );
}

function Quiz({ book }: { book: Book }) {
  const t = useT();
  const chapter = useBooks((s) => s.chapter);
  const ch = book.chapters[chapter]!;
  const [picked, setPicked] = useState<number[]>([-1, -1, -1]);
  const [result, setResult] = useState<{ right: boolean[]; correct: number; passed: boolean; xp: number; answers: number[] } | null>(null);
  const last = chapter >= book.chapters.length - 1;
  return (
    <div dir="ltr">
      <h3 className="mb-2 text-lg font-bold">❓ {ch.title}</h3>
      {ch.questions.map((q, qi) => (
        <div key={qi} className="mb-3">
          <p className="mb-1 font-medium">
            {qi + 1}. {q.q}
          </p>
          <div className="flex flex-col gap-1">
            {q.options.map((o, oi) => {
              const chosen = picked[qi] === oi;
              const tone = result ? (result.answers[qi] === oi ? 'border-green-500 bg-green-50' : chosen ? 'border-red-400 bg-red-50' : '') : chosen ? 'border-blue-500 bg-blue-50' : '';
              return (
                <button key={oi} type="button" disabled={!!result} onClick={() => setPicked((p) => p.map((x, i) => (i === qi ? oi : x)))} className={`min-h-10 rounded-lg border px-3 text-left text-sm ${tone}`}>
                  {o}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {!result ? (
        <button
          type="button"
          disabled={picked.includes(-1)}
          onClick={async () => {
            const r = await useBooks.getState().answer(picked);
            if (r) setResult(r);
          }}
          className="min-h-11 w-full rounded-xl bg-blue-600 text-sm font-semibold text-white disabled:opacity-50"
        >
          {t('Check my answers')}
        </button>
      ) : (
        <div className="space-y-2">
          <p className={`text-center font-semibold ${result.passed ? 'text-green-700' : 'text-amber-700'}`}>
            {result.correct} / 3 {result.passed ? '🎉' : ''} {result.xp ? `· +${result.xp} XP` : ''}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => useBooks.getState().setPage(chapter, 0)} className="min-h-11 flex-1 rounded-xl border text-sm">
              {t('Read again')}
            </button>
            {last ? (
              <button type="button" onClick={() => useBooks.setState({ reading: null, quiz: false })} className="min-h-11 flex-1 rounded-xl bg-blue-600 text-sm font-semibold text-white">
                {t('The end · back to the shelf')}
              </button>
            ) : (
              <button type="button" onClick={() => useBooks.getState().setPage(chapter + 1, 0)} className="min-h-11 flex-1 rounded-xl bg-blue-600 text-sm font-semibold text-white">
                {t('Next chapter')} →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Reader({ book }: { book: Book }) {
  const t = useT();
  const chapter = useBooks((s) => s.chapter);
  const page = useBooks((s) => s.page);
  const quiz = useBooks((s) => s.quiz);
  const [active, setActive] = useState(-1);
  const [tip, setTip] = useState<{ w: string; s: string } | null>(null);
  const cancel = useRef<(() => void) | null>(null);
  const ch = book.chapters[chapter]!;
  const pg = ch.pages[page]!;
  const stop = () => {
    cancel.current?.();
    cancel.current = null;
    stopSpeaking();
    setActive(-1);
  };
  useEffect(() => stop, [chapter, page, quiz]); // eslint-disable-line react-hooks/exhaustive-deps
  const readAloud = () => {
    if (active >= 0) return stop();
    if (useVoice.getState().muted) useVoice.getState().setMuted(false);
    const ss = sentences(pg.text);
    const next = (i: number) => {
      if (i >= ss.length) return setActive(-1);
      setActive(i);
      cancel.current = speak(ss[i]!, { lang: 'en-US', rate: useSettings.getState().ttsRate * 0.95, onEnd: () => next(i + 1) });
    };
    next(0);
  };
  const go = (d: 1 | -1) => {
    const s = useBooks.getState();
    if (d > 0) {
      if (page + 1 < ch.pages.length) s.setPage(chapter, page + 1);
      else useBooks.setState({ quiz: true });
    } else if (page > 0) s.setPage(chapter, page - 1);
    else if (chapter > 0) s.setPage(chapter - 1, book.chapters[chapter - 1]!.pages.length - 1);
  };
  return (
    <div className="flex min-h-full flex-col">
      <div className="mb-2 flex items-center justify-between text-xs text-gray-500" dir="ltr">
        <button type="button" onClick={() => useBooks.setState({ reading: null, quiz: false })} className="min-h-9 text-sm text-blue-700">
          ← {t('Shelf')}
        </button>
        <span>
          {book.title} · {t('Chapter {n}', { n: chapter + 1 })}/{book.chapters.length} · {quiz ? '❓' : `${page + 1}/${ch.pages.length}`}
        </span>
      </div>
      {quiz ? (
        <Quiz book={book} />
      ) : (
        <>
          {page === 0 ? (
            <h3 className="mb-1 text-center text-lg font-bold" dir="ltr">
              {ch.title}
            </h3>
          ) : null}
          <div className="my-2 text-center text-6xl">{pg.pic}</div>
          <Page text={pg.text} active={active} onWord={(w, s) => setTip({ w, s })} />
          <div className="mt-auto flex items-center gap-2 pt-4">
            <button type="button" onClick={() => go(-1)} disabled={chapter === 0 && page === 0} className="min-h-11 min-w-11 rounded-xl border text-lg disabled:opacity-30" aria-label={t('Back')}>
              ←
            </button>
            <button type="button" onClick={readAloud} className={`min-h-11 flex-1 rounded-xl text-sm font-semibold ${active >= 0 ? 'bg-yellow-300' : 'bg-gray-100'}`}>
              {active >= 0 ? `⏹ ${t('Stop')}` : `🔊 ${t('Read aloud')}`}
            </button>
            <button type="button" onClick={() => go(1)} className="min-h-11 min-w-11 rounded-xl bg-blue-600 px-3 text-lg text-white" aria-label={t('Next')}>
              {page + 1 < ch.pages.length ? '→' : '❓'}
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-gray-400">{t('Tap a word to see what it means.')}</p>
        </>
      )}
      {tip ? <WordTip word={tip.w} sentence={tip.s} onClose={() => setTip(null)} /> : null}
    </div>
  );
}

export function Library() {
  const t = useT();
  const open = useBooks((s) => s.open);
  const reading = useBooks((s) => s.reading);
  if (!open) return null;
  const title = open === 'home' ? `🏠 ${t('My bookshelf')}` : `📚 ${t('Library')}`;
  const close = () => {
    stopSpeaking();
    useBooks.getState().close();
  };
  return (
    <Sheet onClose={close} label={title} wide>
      <SheetHeader>
        <h2 className="text-lg font-bold">{title}</h2>
        <button type="button" onClick={close} className="min-h-9 min-w-9 rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100" aria-label={t('Close')}>
          ✕
        </button>
      </SheetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">{reading ? <Reader book={reading} /> : <Shelf />}</div>
    </Sheet>
  );
}
