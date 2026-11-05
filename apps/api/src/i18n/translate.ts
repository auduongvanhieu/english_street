/** Claude translation of UI strings and area learning content (used by scripts/i18n-translate.ts and the admin site). */
import type Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { langName, type LangCode } from '@es/shared';
import { env } from '../env';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

const Batch = z.object({ items: z.array(z.object({ id: z.number().int(), text: z.string() })) });

const UI_PROMPT = (lang: LangCode) => `You translate the user interface of "English Street", a friendly 3D multiplayer game where people learn English by walking down a street, talking to shop staff (NPCs), hugging pets, visiting a zoo, a farm, a restaurant and a supermarket. Translate each interface string from English into natural, concise ${langName(lang)} as used in mobile games and apps (informal "you" where the language has it).
Rules:
- Keep placeholders like {name} or {n} exactly as they are (do not translate their names).
- Keep emoji, symbols (✓ ✕ · … →), keyboard keys (WASD, Shift, E, F, M, Enter, Space) and the words "IPA", "XP", "NPC", "A1".."C1" unchanged.
- Keep the game name "English Street" and English words that are quoted on purpose (e.g. a button label quoted inside a hint is translated the same way as the label itself).
- Same length or shorter where possible: these are buttons and labels.
- Return every id exactly once.`;

const CONTENT_PROMPT = (lang: LangCode) => `You translate learning content of "English Street", a game where people learn English. Learners read the English and tap to see your ${langName(lang)} translation, so translate faithfully and naturally into ${langName(lang)}.
Rules:
- A single word or short name (an animal, a food, a product, a verb like "plant") → the usual ${langName(lang)} word for it, nothing else (no articles unless required, no explanations). For verbs give the infinitive/dictionary form.
- Sentences → a natural ${langName(lang)} sentence with the same meaning and level of politeness.
- Grammar notes about English (e.g. "Uncountable: a loaf of bread", "plant – planted – planted", "In British English, chips are called crisps") → explain them in ${langName(lang)} but keep the English words in them unchanged.
- Names of places (zoo, restaurant, supermarket names) may stay in English or be transliterated as is usual in ${langName(lang)}.
- Return every id exactly once.`;

/** Translate `keys` (UI: the key is the English; content: `src[key]` is the English). Placeholders must survive. */
export async function translate(client: Anthropic, lang: LangCode, keys: string[], src: Record<string, string> = {}): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (let i = 0; i < keys.length; i += 60) {
    const chunk = keys.slice(i, i + 60);
    const list = chunk.map((k, j) => ({ id: j, text: src[k] ?? k }));
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await client.messages.parse({
        model: env.NPC_MODEL,
        max_tokens: 16000,
        system: Object.keys(src).length ? CONTENT_PROMPT(lang) : UI_PROMPT(lang),
        messages: [{ role: 'user', content: JSON.stringify(list) }],
        output_config: { format: zodOutputFormat(Batch) },
      });
      const got = res.parsed_output?.items ?? [];
      let ok = true;
      for (const { id, text } of got) {
        const key = chunk[id];
        if (key === undefined) continue;
        if (placeholders(src[key] ?? key) !== placeholders(text)) {
          ok = false;
          continue;
        }
        out[key] = text;
      }
      if (ok && chunk.every((k) => k in out)) break;
      console.warn(`  ${lang}: retry batch ${i / 60} (missing/placeholder mismatch)`);
    }
  }
  return out;
}

