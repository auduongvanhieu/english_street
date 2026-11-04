import { useEffect, useState } from 'react';
import type { LangCode } from '@es/shared';
import { translateText } from '../net/api';
import { useLang } from './index';

const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

/** Translate a short English word/line into `to`, cached in memory and on the server. */
export function meaningOf(en: string, to: LangCode): Promise<string> {
  if (to === 'en') return Promise.resolve('');
  const key = `${to}:${en.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit !== undefined) return Promise.resolve(hit);
  let p = inflight.get(key);
  if (!p) {
    p = translateText(en, to)
      .then((r) => {
        cache.set(key, r.text);
        return r.text;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return p;
}

/**
 * Meaning of an English word in the learner's language. `known` holds pre-made translations (content files);
 * anything missing is translated on demand. Returns '' for English learners and null while loading.
 */
export function useMeaning(en: string | undefined, known?: Partial<Record<string, string>>): string | null {
  const lang = useLang((s) => s.lang);
  const pre = en ? known?.[lang] : undefined;
  const [got, setGot] = useState<string | null>(null);
  useEffect(() => {
    setGot(null);
    if (!en || pre || lang === 'en') return;
    let alive = true;
    meaningOf(en, lang)
      .then((v) => alive && setGot(v))
      .catch(() => alive && setGot(''));
    return () => {
      alive = false;
    };
  }, [en, lang, pre]);
  if (!en) return null;
  if (lang === 'en') return '';
  return pre ?? got;
}
