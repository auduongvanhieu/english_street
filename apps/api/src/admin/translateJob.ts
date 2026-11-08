import Anthropic from '@anthropic-ai/sdk';
import { AREA_IDS, LANGS, areaTrKeys, type LangCode } from '@es/shared';
import { areaTranslations, baseAreaSource, getArea, getOverride } from '@es/quests';
import { env, hasRealApiKey } from '../env';
import { prisma } from '../plugins/prisma';
import { translate } from '../i18n/translate';
import { logLlmUsage, tokensOf } from '../npc/usageLog';
import { contentChanged } from './contentStore';

/**
 * Background translation of area content after an admin edit: every language gets the strings that are new or
 * whose English changed since they were last translated. Results go into the area-tr overrides (admin fixes to
 * a translation are kept unless the English changes again).
 */
const SOURCE_KEY = 'areaTrSource';
interface State {
  running: boolean;
  queued: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  /** languages done in the current / last run */
  done: number;
  total: number;
  /** strings translated in the last run */
  strings: number;
  pending: number;
  error: string;
}
const state: State = { running: false, queued: false, startedAt: null, finishedAt: null, done: 0, total: 0, strings: 0, pending: 0, error: '' };
let timer: NodeJS.Timeout | null = null;

export const translationStatus = () => ({ ...state, pending: pendingCount() });

async function previousSource(): Promise<Record<string, string>> {
  const row = await prisma.setting.findUnique({ where: { key: SOURCE_KEY } }).catch(() => null);
  return { ...baseAreaSource(), ...((row?.value as Record<string, string> | undefined) ?? {}) };
}
let lastPrev: Record<string, string> = {};
/** English source each key was last translated from. */
export const translationSource = previousSource;

function currentSource(): Record<string, string> {
  const src: Record<string, string> = {};
  for (const id of AREA_IDS) {
    const a = getArea(id);
    if (a) Object.assign(src, areaTrKeys(a));
  }
  return src;
}
function missingFor(lang: string, src: Record<string, string>, prev: Record<string, string>) {
  const cat = areaTranslations(lang);
  return Object.keys(src).filter((k) => !cat[k] || (prev[k] !== undefined && prev[k] !== src[k]));
}
/** Strings still waiting for a translation (over all languages), from the last known source. */
function pendingCount() {
  const src = currentSource();
  let n = 0;
  for (const l of LANGS) if (l.code !== 'en') n += missingFor(l.code, src, lastPrev).length;
  return n;
}

/** Run soon (edits come in bursts; wait 5 s for the next one). */
export function queueAreaTranslation(now = false) {
  if (state.running) {
    state.queued = true;
    return;
  }
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void run(), now ? 0 : 5000);
}

export async function initTranslationJob() {
  lastPrev = await previousSource();
}

async function run() {
  timer = null;
  if (!hasRealApiKey()) {
    state.error = 'no_api_key';
    return;
  }
  state.running = true;
  state.queued = false;
  state.error = '';
  state.startedAt = new Date().toISOString();
  state.done = state.strings = 0;
  const langs = LANGS.filter((l) => l.code !== 'en').map((l) => l.code as LangCode);
  state.total = langs.length;
  try {
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const src = currentSource();
    const prev = await previousSource();
    for (const lang of langs) {
      const keys = missingFor(lang, src, prev);
      if (keys.length) {
        const got = await translate(client, lang, keys, src, (model, u) => logLlmUsage('content_translate', lang, model, tokensOf(u)));
        const o = getOverride('area-tr', lang);
        const data = { ...((o && !o.deleted ? o.data : {}) as Record<string, string>), ...got };
        const row = await prisma.contentDoc.findUnique({ where: { kind_id: { kind: 'area-tr', id: lang } } });
        const version = (row?.version ?? 0) + 1;
        await prisma.contentDoc.upsert({
          where: { kind_id: { kind: 'area-tr', id: lang } },
          create: { kind: 'area-tr', id: lang, data, version, updatedBy: 'auto-translate' },
          update: { data, deleted: false, version, updatedBy: 'auto-translate' },
        });
        state.strings += Object.keys(got).length;
        await contentChanged();
      }
      state.done += 1;
    }
    await prisma.setting.upsert({ where: { key: SOURCE_KEY }, create: { key: SOURCE_KEY, value: src, updatedBy: 'auto-translate' }, update: { value: src } });
    lastPrev = { ...baseAreaSource(), ...src };
  } catch (e) {
    state.error = (e as Error).message.slice(0, 300);
  } finally {
    state.running = false;
    state.finishedAt = new Date().toISOString();
    if (state.queued) queueAreaTranslation();
  }
}
