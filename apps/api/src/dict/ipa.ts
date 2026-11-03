import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * IPA pronunciations from CMUdict (US English). The dictionary is loaded once on first use
 * (~135k words, ~15 MB of memory) and converted from ARPAbet to IPA with primary/secondary stress marks.
 */
const ARPA: Record<string, string> = {
  AA: 'ɑ', AE: 'æ', AH: 'ʌ', AO: 'ɔ', AW: 'aʊ', AY: 'aɪ', B: 'b', CH: 'tʃ', D: 'd', DH: 'ð', EH: 'ɛ', ER: 'ɝ',
  EY: 'eɪ', F: 'f', G: 'ɡ', HH: 'h', IH: 'ɪ', IY: 'i', JH: 'dʒ', K: 'k', L: 'l', M: 'm', N: 'n', NG: 'ŋ', OW: 'oʊ',
  OY: 'ɔɪ', P: 'p', R: 'ɹ', S: 's', SH: 'ʃ', T: 't', TH: 'θ', UH: 'ʊ', UW: 'u', V: 'v', W: 'w', Y: 'j', Z: 'z', ZH: 'ʒ',
};
const VOWELS = new Set(['AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY', 'IH', 'IY', 'OW', 'OY', 'UH', 'UW']);

let dict: Map<string, string> | null = null;

function load(): Map<string, string> {
  if (dict) return dict;
  const here = path.dirname(fileURLToPath(import.meta.url));
  const file = path.resolve(here, '../../data/cmudict.dict.gz');
  const text = gunzipSync(readFileSync(file)).toString('utf8');
  dict = new Map();
  for (const line of text.split('\n')) {
    if (!line || line.startsWith(';;;')) continue;
    const sp = line.indexOf(' ');
    if (sp < 0) continue;
    let word = line.slice(0, sp);
    if (word.includes('(')) continue; // alternate pronunciations: keep the first only
    word = word.toLowerCase();
    const phones = line.slice(sp + 1).replace(/#.*$/, '').trim().split(/\s+/);
    dict.set(word, arpaToIpa(phones));
  }
  return dict;
}

/** ARPAbet phones (with 0/1/2 stress digits) → IPA string with ˈ / ˌ placed before the syllable onset. */
export function arpaToIpa(phones: string[]): string {
  // Split into syllables: each vowel is a nucleus; consonants before it belong to its onset (maximal onset,
  // simplified), consonants after the last vowel are the coda.
  const syll: { onset: string[]; nucleus: string; stress: number; coda: string[] }[] = [];
  let pending: string[] = [];
  for (const p of phones) {
    const base = p.replace(/[0-2]$/, '');
    const stress = /[0-2]$/.test(p) ? Number(p.slice(-1)) : 0;
    if (VOWELS.has(base)) {
      let ipa = ARPA[base] ?? base.toLowerCase();
      if (base === 'AH' && stress === 0) ipa = 'ə';
      if (base === 'ER' && stress === 0) ipa = 'ɚ';
      syll.push({ onset: pending, nucleus: ipa, stress, coda: [] });
      pending = [];
    } else {
      pending.push(ARPA[base] ?? base.toLowerCase());
    }
  }
  if (syll.length === 0) return pending.join('');
  // Leftover consonants after the final vowel form the coda; for inner syllables, share consonant clusters:
  // all but the last consonant go to the previous coda so stress marks land in a natural place.
  syll[syll.length - 1]!.coda = pending;
  for (let i = 1; i < syll.length; i++) {
    const s = syll[i]!;
    if (s.onset.length > 1) {
      syll[i - 1]!.coda = s.onset.slice(0, -1);
      s.onset = s.onset.slice(-1);
    }
  }
  // Stress marks are only meaningful with 2+ syllables (IPA convention: none on monosyllables).
  const mark = (st: number) => (syll.length < 2 ? '' : st === 1 ? 'ˈ' : st === 2 ? 'ˌ' : '');
  return syll.map((s) => mark(s.stress) + s.onset.join('') + s.nucleus + s.coda.join('')).join('');
}

const clean = (w: string) => w.toLowerCase().replace(/[^a-z'\-]/g, '');

/** IPA for one word (lowercased, punctuation stripped) or null when unknown. */
export function ipaFor(word: string): string | null {
  const w = clean(word);
  if (!w) return null;
  const d = load();
  return d.get(w) ?? (w.endsWith("'s") ? d.get(w.slice(0, -2)) ?? null : null);
}

/** Map of word → IPA for a list of words (unknown words omitted). */
export function ipaForWords(words: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const w of words.slice(0, 80)) {
    const ipa = ipaFor(w);
    if (ipa) out[clean(w)] = ipa;
  }
  return out;
}

export function dictSize(): number {
  return load().size;
}
