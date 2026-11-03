import { useEffect, useMemo, useState } from 'react';
import { addVocab, fetchIpa, translateText } from '../net/api';
import { track } from '../net/analytics';
import { useVoice } from '../store/voice';
import { useSettings } from '../store/settings';

const ipaCache = new Map<string, string | null>();
const viCache = new Map<string, string>();
const WORD_RE = /\p{L}[\p{L}'’-]*/gu;
const viInflight = new Map<string, Promise<string>>();

async function ipaForWords(words: string[]): Promise<void> {
  const missing = [...new Set(words.map((w) => w.toLowerCase()))].filter((w) => !ipaCache.has(w));
  if (missing.length === 0) return;
  for (const w of missing) ipaCache.set(w, null); // mark in flight; unknown words stay null
  try {
    const got = await fetchIpa(missing);
    for (const [w, ipa] of Object.entries(got)) ipaCache.set(w, ipa);
  } catch {
    for (const w of missing) ipaCache.delete(w);
  }
}

/**
 * An NPC line with tappable words, an optional IPA line and an optional Vietnamese subtitle.
 * `vi` comes from the structured turn (reply_vi) or the cached /translate endpoint.
 */
export function Subtitled({ text, vi, showVi, lang, npcId }: { text: string; vi?: string; showVi: boolean; lang: string; npcId: string }) {
  const ipaOn = useSettings((s) => s.ipa);
  const [, bump] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const words = useMemo(() => text.match(WORD_RE) ?? [], [text]);

  useEffect(() => {
    if (!ipaOn || words.length === 0) return;
    void ipaForWords(words).then(() => bump((n) => n + 1));
  }, [ipaOn, words]);

  const ipaLine = ipaOn ? words.map((w) => ipaCache.get(w.toLowerCase()) ?? '…').join(' ') : null;
  const parts = useMemo(() => {
    const out: { t: string; word: boolean }[] = [];
    let last = 0;
    for (const m of text.matchAll(WORD_RE)) {
      if (m.index! > last) out.push({ t: text.slice(last, m.index), word: false });
      out.push({ t: m[0], word: true });
      last = m.index! + m[0].length;
    }
    if (last < text.length) out.push({ t: text.slice(last), word: false });
    return out;
  }, [text]);

  return (
    <span className="block">
      <span>
        {parts.map((p, i) =>
          p.word ? (
            <button
              key={i}
              type="button"
              onClick={() => {
                setPicked(p.t);
                track('word_tap', { word: p.t.toLowerCase(), npcId });
              }}
              className={`rounded px-0.5 text-left hover:bg-yellow-100 ${picked === p.t ? 'bg-yellow-200' : ''}`}
            >
              {p.t}
            </button>
          ) : (
            <span key={i}>{p.t}</span>
          ),
        )}
      </span>
      {ipaLine && <span className="mt-0.5 block font-mono text-xs text-gray-500">{ipaLine}</span>}
      {showVi && <span className="mt-0.5 block text-xs text-blue-800/80">{vi ?? '…'}</span>}
      {picked && <WordCard word={picked} lang={lang} onClose={() => setPicked(null)} />}
    </span>
  );
}

/** Popup for one tapped word: IPA, meaning, listen, save to notebook. */
export function WordCard({ word, lang, onClose }: { word: string; lang: string; onClose: () => void }) {
  const key = word.toLowerCase();
  const [ipa, setIpa] = useState<string | null>(ipaCache.get(key) ?? null);
  const [vi, setVi] = useState<string | null>(viCache.get(key) ?? null);
  const [saved, setSaved] = useState(false);
  const speakAs = useVoice((s) => s.speakAs);
  useEffect(() => {
    let alive = true;
    if (!ipaCache.get(key)) void ipaForWords([key]).then(() => alive && setIpa(ipaCache.get(key) ?? null));
    if (!viCache.has(key)) {
      const p = viInflight.get(key) ?? translateText(key).then((r) => r.vi);
      viInflight.set(key, p);
      p.then((v) => {
        viCache.set(key, v);
        if (alive) setVi(v);
      })
        .catch(() => alive && setVi('(no translation)'))
        .finally(() => viInflight.delete(key));
    }
    return () => {
      alive = false;
    };
  }, [key]);
  return (
    <span className="mt-1 flex flex-wrap items-center gap-2 rounded-lg border border-yellow-300 bg-yellow-50 px-2 py-1.5 text-xs text-gray-900">
      <b className="text-sm">{word}</b>
      {ipa && <span className="font-mono text-gray-600">/{ipa}/</span>}
      <span className="text-blue-900">{vi ?? '…'}</span>
      <button type="button" onClick={() => speakAs('word', word, lang)} className="min-h-7 rounded bg-white px-2" aria-label={`Listen to ${word}`}>
        🔊
      </button>
      <button
        type="button"
        disabled={saved || !vi}
        onClick={() => {
          setSaved(true);
          void addVocab(word, vi ?? '', '').catch(() => setSaved(false));
        }}
        className="min-h-7 rounded bg-white px-2 disabled:opacity-60"
      >
        {saved ? '✓ Saved' : '📓 Save'}
      </button>
      <button type="button" onClick={onClose} className="min-h-7 px-1 text-gray-500" aria-label="Close word card">
        ✕
      </button>
    </span>
  );
}
