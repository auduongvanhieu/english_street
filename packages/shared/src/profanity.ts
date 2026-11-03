/**
 * Tiny profanity masker for player-to-player text. Deliberately small and
 * conservative: it is a courtesy filter, not a moderation system (reports exist for that).
 */
const WORDS = [
  'fuck', 'fucking', 'fucker', 'shit', 'bitch', 'asshole', 'bastard', 'dick', 'cunt', 'motherfucker',
  'đụ', 'địt', 'đéo', 'lồn', 'cặc', 'đĩ', 'đmm', 'vcl', 'clgt',
];
const RE = new RegExp(`\\b(${WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'giu');

export function maskProfanity(text: string): string {
  return text.replace(RE, (m) => m[0] + '*'.repeat(Math.max(1, m.length - 1)));
}

export function hasProfanity(text: string): boolean {
  RE.lastIndex = 0;
  return RE.test(text);
}
