import type { CefrLevel } from './constants';
import type { AreaId } from './schemas/area';

/**
 * Daily listening and shadowing practice (journey daily tasks d-listen / d-shadow).
 * The sentences come from the area content (item example sentences and phrases), so they already have
 * translations in every language. The API picks a set per player, day and round: GET /practice/:kind.
 */
export const PRACTICE_KINDS = ['listen', 'shadow'] as const;
export type PracticeKind = (typeof PRACTICE_KINDS)[number];

export interface PracticeSentence {
  /** stable id: "<area>.<item>.s<i>" or "<area>.phrase.<i>" */
  id: string;
  en: string;
  /** translation in the learner's language ('' when missing or English) */
  tr: string;
  level: CefrLevel;
  area: AreaId;
  icon: string;
}

/** Listening: "which sentence did you hear?" or "which word is missing?" (4 options, `answer` = index). */
export type ListenQuestion =
  | { type: 'pick'; s: PracticeSentence; options: string[]; answer: number }
  | { type: 'gap'; s: PracticeSentence; /** word index in s.en split on spaces */ gap: number; options: string[]; answer: number };

export interface PracticeSet {
  kind: PracticeKind;
  day: string;
  round: number;
  level: CefrLevel;
  /** listen: the questions; shadow: [] */
  questions: ListenQuestion[];
  /** shadow: the sentences to repeat; listen: [] */
  sentences: PracticeSentence[];
}

export const LISTEN_COUNT = 6;
export const SHADOW_COUNT = 5;
/** a shadowed sentence passes from this score (0..1) */
export const SHADOW_PASS = 0.7;

/** Levels whose sentences suit a learner: their own and the one below (A1: only A1). */
export function practiceLevels(level: CefrLevel): CefrLevel[] {
  switch (level) {
    case 'A1':
      return ['A1'];
    case 'A2':
      return ['A1', 'A2'];
    case 'B1':
      return ['A2', 'B1'];
    case 'B2':
      return ['B1', 'B2'];
    default:
      return ['B1', 'B2', 'C1'];
  }
}

const NUM: Record<string, string> = { '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine', '10': 'ten', '11': 'eleven', '12': 'twelve' };
/** Words of a sentence for comparing: lower case, no punctuation, digits spelled out, "it's" = "it is"-tolerant. */
export function practiceWords(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .filter(Boolean)
    .map((w) => NUM[w] ?? w);
}
/** "it's" ≈ "it is", "don't" ≈ "do not": compare without the apostrophe part as a fallback */
const loose = (w: string) => w.replace(/'(s|re|m|ll|ve|d|t)$/, '').replace(/n$/, '');

/**
 * How well `heard` (speech recogniser text) matches `target`: longest common subsequence of words over the
 * target's word count. `words` marks each target word as said or missed (for colouring).
 */
export function shadowScore(target: string, heard: string): { score: number; words: { w: string; ok: boolean }[] } {
  const display = target.split(/\s+/).filter(Boolean);
  const t = display.map((w) => practiceWords(w).join(' '));
  const h = practiceWords(heard);
  const eq = (a: string, b: string) => a === b || (a.length > 2 && loose(a) === loose(b));
  // LCS table over target words (a display word may hold two words, e.g. "9:30" → "nine thirty": match its first)
  const tw = t.map((w) => w.split(' ')[0] ?? '');
  const n = tw.length;
  const m = h.length;
  const L: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i]![j] = !tw[i] ? L[i + 1]![j]! : eq(tw[i]!, h[j]!) ? 1 + L[i + 1]![j + 1]! : Math.max(L[i + 1]![j]!, L[i]![j + 1]!);
  const ok = new Array<boolean>(n).fill(false);
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (!tw[i]) (ok[i] = true), i++;
    else if (eq(tw[i]!, h[j]!)) (ok[i] = true), i++, j++;
    else if (L[i + 1]![j]! >= L[i]![j + 1]!) i++;
    else j++;
  }
  const counted = tw.filter(Boolean).length;
  const said = ok.filter((x, i) => x && tw[i]).length;
  return { score: counted ? said / counted : 0, words: display.map((w, i) => ({ w, ok: ok[i]! })) };
}
