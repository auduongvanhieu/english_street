/**
 * Tiny profanity masker for player-to-player text. Deliberately small and
 * conservative: it is a courtesy filter, not a moderation system (reports exist for that).
 */
const WORDS: string[] = [
  'fuck', 'fucking', 'fucker', 'shit', 'bitch', 'asshole', 'bastard', 'dick', 'cunt', 'motherfucker',
  'đụ', 'địt', 'đéo', 'lồn', 'cặc', 'đĩ', 'đmm', 'vcl', 'clgt',
];
/** The built-in words (the admin site can add words and allow some of these again). */
export const BUILTIN_BAD_WORDS: readonly string[] = WORDS;
const build = (words: string[]) => new RegExp(`\\b(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'giu');
let RE = build(WORDS);

/** Live word list: built-in + `extra`, minus `allowed` (admin settings). */
export function setProfanityWords(extra: string[], allowed: string[]) {
  const allow = new Set(allowed.map((w) => w.toLowerCase()));
  const words = [...new Set([...WORDS, ...extra.map((w) => w.toLowerCase())])].filter((w) => w && !allow.has(w));
  RE = words.length ? build(words) : /(?!)/gu;
}

export function maskProfanity(text: string): string {
  return text.replace(RE, (m) => m[0] + '*'.repeat(Math.max(1, m.length - 1)));
}

export function hasProfanity(text: string): boolean {
  RE.lastIndex = 0;
  return RE.test(text);
}
