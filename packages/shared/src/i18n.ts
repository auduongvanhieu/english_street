import { z } from 'zod';

/**
 * Languages a learner can pick as "my language". It drives every translation (word meanings, NPC subtitles,
 * explanations, hints, the "translate" button) and, when a catalog exists, the interface text.
 * English itself is never translated: 'en' means "no translation, explain in simple English".
 */
export const LANGS = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'pt-BR', name: 'Brazilian Portuguese', native: 'Português (Brasil)' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'it', name: 'Italian', native: 'Italiano' },
  { code: 'ru', name: 'Russian', native: 'Русский' },
  { code: 'tr', name: 'Turkish', native: 'Türkçe' },
  { code: 'ar', name: 'Arabic', native: 'العربية', rtl: true },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'th', name: 'Thai', native: 'ไทย' },
  { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia' },
  { code: 'zh-CN', name: 'Simplified Chinese', native: '简体中文' },
  { code: 'zh-TW', name: 'Traditional Chinese', native: '繁體中文' },
  { code: 'ja', name: 'Japanese', native: '日本語' },
  { code: 'ko', name: 'Korean', native: '한국어' },
] as const satisfies readonly { code: string; name: string; native: string; rtl?: boolean }[];

export type LangCode = (typeof LANGS)[number]['code'];
export const LANG_CODES = LANGS.map((l) => l.code) as unknown as [LangCode, ...LangCode[]];
export const LangSchema = z.enum(LANG_CODES);

export function isLang(v: unknown): v is LangCode {
  return typeof v === 'string' && (LANG_CODES as readonly string[]).includes(v);
}

/** Lenient parse for request bodies: unknown/missing → fallback. */
export function toLang(v: unknown, fallback: LangCode = 'en'): LangCode {
  return isLang(v) ? v : fallback;
}

export function langInfo(code: LangCode) {
  return LANGS.find((l) => l.code === code) ?? LANGS[0];
}

/** English name used inside LLM prompts ("Translate to Japanese"). */
export function langName(code: LangCode): string {
  return langInfo(code).name;
}

export function isRtl(code: LangCode): boolean {
  return 'rtl' in langInfo(code);
}

/** Best match for browser languages (navigator.languages), e.g. 'pt-PT' → 'pt-BR', 'zh-HK' → 'zh-TW'. */
export function guessLang(prefs: readonly string[]): LangCode {
  for (const raw of prefs) {
    const p = raw.toLowerCase();
    const exact = LANG_CODES.find((c) => c.toLowerCase() === p);
    if (exact) return exact;
    if (p.startsWith('zh')) return /tw|hk|mo|hant/.test(p) ? 'zh-TW' : 'zh-CN';
    if (p.startsWith('pt')) return 'pt-BR';
    const base = p.split('-')[0];
    const hit = LANG_CODES.find((c) => c.toLowerCase() === base);
    if (hit) return hit;
  }
  return 'en';
}
