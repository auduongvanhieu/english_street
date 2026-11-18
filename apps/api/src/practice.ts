import { areaTranslations, loadAreas, onContentChange } from '@es/quests';
import {
  LISTEN_COUNT,
  SHADOW_COUNT,
  practiceLevels,
  practiceWords,
  type CefrLevel,
  type ListenQuestion,
  type PracticeKind,
  type PracticeSentence,
  type PracticeSet,
} from '@es/shared';

/**
 * Listening and shadowing lessons (daily tasks d-listen / d-shadow) built from the area sentences.
 * Same player + day + round = same lesson (a seeded shuffle), so reopening it doesn't reroll it.
 */

const poolCache = new Map<string, PracticeSentence[]>();
onContentChange(() => poolCache.clear());

/** Every example sentence and phrase of every area, with its translation in `lang`. */
export function sentencePool(lang: string): PracticeSentence[] {
  const hit = poolCache.get(lang);
  if (hit) return hit;
  const tr = lang === 'en' ? {} : areaTranslations(lang);
  const out: PracticeSentence[] = [];
  const seen = new Set<string>();
  const add = (s: PracticeSentence) => {
    const k = s.en.trim().toLowerCase();
    // sentences need a few words, plain letters (no "$4.50", no "A: … B: …" dialogues)
    const n = practiceWords(s.en).length;
    if (seen.has(k) || n < 3 || n > 16 || /[$€£%:;()[\]/]|\d/.test(s.en)) return;
    seen.add(k);
    out.push(s);
  };
  for (const a of loadAreas().values()) {
    for (const it of a.items) {
      if (it.hidden) continue;
      it.sentences.forEach((s, i) => add({ id: `${a.id}.item.${it.id}.s${i}`, en: s.en.trim(), tr: tr[`${a.id}.item.${it.id}.s${i}`] ?? '', level: s.level, area: a.id, icon: it.icon }));
    }
    a.phrases.forEach((p, i) => add({ id: `${a.id}.phrase.${i}`, en: p.en.trim(), tr: tr[`${a.id}.phrase.${i}`] ?? '', level: p.level, area: a.id, icon: '💬' }));
  }
  poolCache.set(lang, out);
  return out;
}

/** small seeded PRNG (mulberry32) from a string */
export function rng(seed: string): () => number {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let x = h;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle<T>(xs: T[], r: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
/** the right answer at a random place among 3 others */
function options(answer: string, others: string[], r: () => number): { options: string[]; answer: number } {
  const opts = shuffle([answer, ...others.slice(0, 3)], r);
  return { options: opts, answer: opts.indexOf(answer) };
}

const STOP = new Set(['the', 'and', 'for', 'are', 'was', 'were', 'you', 'your', 'our', 'his', 'her', 'its', 'this', 'that', 'with', 'have', 'has', 'can', 'will', 'from', 'they', 'them', 'there', 'then', 'than', 'what', 'when', 'very', 'some', 'into', 'just', 'also', 'but', 'not', 'too', 'she', 'him', 'one', 'all', 'out', 'who', 'how', 'did', 'does', 'had', 'let', 'please']);
const clean = (w: string) => w.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, '');
/** the word to blank out: the longest content word (a noun / verb / adjective, most likely) */
function gapIndex(en: string): number {
  const ws = en.split(/\s+/);
  let best = -1;
  ws.forEach((w, i) => {
    const c = clean(w).toLowerCase();
    if (c.length < 3 || STOP.has(c) || c.includes("'") || !/^[a-z]+$/.test(c)) return;
    if (best < 0 || c.length > clean(ws[best]!).length) best = i;
  });
  return best;
}

export function buildPractice(kind: PracticeKind, opts: { playerId: string; day: string; round: number; level: CefrLevel; lang: string }): PracticeSet {
  const r = rng(`${opts.playerId}|${opts.day}|${kind}|${opts.round}`);
  const all = sentencePool(opts.lang);
  const levels = practiceLevels(opts.level);
  let pool = all.filter((s) => levels.includes(s.level));
  if (pool.length < 40) pool = all; // tiny content (tests): anything goes
  const base = { kind, day: opts.day, round: opts.round, level: opts.level };
  if (kind === 'shadow') {
    // short enough to repeat in one breath
    const short = pool.filter((s) => practiceWords(s.en).length <= (opts.level === 'A1' ? 8 : 12));
    return { ...base, questions: [], sentences: shuffle(short.length >= SHADOW_COUNT ? short : pool, r).slice(0, SHADOW_COUNT) };
  }
  const picked = shuffle(pool, r).slice(0, LISTEN_COUNT);
  const questions: ListenQuestion[] = picked.map((s, i) => {
    const gap = gapIndex(s.en);
    // every other question is a missing word (when the sentence has a good word to blank out)
    if (i % 2 === 1 && gap >= 0) {
      const word = clean(s.en.split(/\s+/)[gap]!).toLowerCase();
      const len = word.length;
      const words = new Set<string>();
      for (const o of shuffle(all, r)) {
        for (const w of o.en.split(/\s+/)) {
          const c = clean(w).toLowerCase();
          if (c !== word && /^[a-z]+$/.test(c) && !STOP.has(c) && Math.abs(c.length - len) <= 2) words.add(c);
        }
        if (words.size >= 3) break;
      }
      return { type: 'gap', s, gap, ...options(word, [...words], r) };
    }
    // "which did you hear?": other sentences of about the same length, same area first (harder to tell apart)
    const n = practiceWords(s.en).length;
    const near = (o: PracticeSentence) => o.id !== s.id && o.en !== s.en && Math.abs(practiceWords(o.en).length - n) <= 3;
    const others = [...shuffle(pool.filter((o) => o.area === s.area && near(o)), r), ...shuffle(pool.filter((o) => o.area !== s.area && near(o)), r)];
    return { type: 'pick', s, ...options(s.en, others.map((o) => o.en), r) };
  });
  return { ...base, questions, sentences: [] };
}
