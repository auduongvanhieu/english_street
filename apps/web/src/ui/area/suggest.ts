import { AREA_BADGE_WORDS, AREA_IDS, AREA_INFO, CEFR_LEVELS, type AreaId } from '@es/shared';

const rank = (l: string) => Math.max(0, CEFR_LEVELS.indexOf(l as (typeof CEFR_LEVELS)[number]));
/** "A1–B1" → [0, 2] */
function span(level: string): [number, number] {
  const [a, b] = level.split(/[–-]/);
  return [rank(a!.trim()), rank((b ?? a)!.trim())];
}

/** Stable per-day shuffle so the same three areas are not always suggested. */
function spin(id: string) {
  let h = 2166136261;
  for (const ch of new Date().toDateString() + id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

/**
 * Areas worth visiting next for a learner at `level`: the level must be inside the area's range (or one
 * step above it), areas with fewer learned words first, the newer/harder topics for higher levels.
 */
export function suggestAreas(level: string, learned: Record<string, string[]>): AreaId[] {
  const me = rank(level);
  return AREA_IDS.filter((id) => {
    const [lo, hi] = span(AREA_INFO[id].level);
    return me >= lo && me <= hi + 1 && (learned[id]?.length ?? 0) < AREA_BADGE_WORDS;
  }).sort((a, b) => {
    const la = learned[a]?.length ?? 0;
    const lb = learned[b]?.length ?? 0;
    if ((la === 0) !== (lb === 0)) return la === 0 ? 1 : -1; // started ones first: finish what you began
    return Math.abs(span(AREA_INFO[a].level)[0] - me) - Math.abs(span(AREA_INFO[b].level)[0] - me) || la - lb || spin(a) - spin(b);
  });
}
