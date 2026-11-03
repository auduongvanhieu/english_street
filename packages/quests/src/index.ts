import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { NpcPersonaSchema, PairQuestSchema, QuestSchema, type NpcPersona, type PairQuest, type Quest } from '@es/shared';

const CONTENT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'content');

function loadDir<T>(dir: string, parseOne: (raw: unknown, file: string) => T): T[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
    .sort()
    .map((f) => parseOne(parse(readFileSync(join(dir, f), 'utf8')), f));
}

let npcCache: NpcPersona[] | undefined;
let questCache: Quest[] | undefined;
let pairCache: PairQuest[] | undefined;

export function loadNpcs(): NpcPersona[] {
  npcCache ??= loadDir(join(CONTENT_DIR, 'npcs'), (raw, file) => {
    const r = NpcPersonaSchema.safeParse(raw);
    if (!r.success) throw new Error(`Invalid NPC ${file}: ${r.error.message}`);
    return r.data;
  });
  return npcCache;
}

export function loadQuests(): Quest[] {
  questCache ??= loadDir(join(CONTENT_DIR, 'quests'), (raw, file) => {
    const r = QuestSchema.safeParse(raw);
    if (!r.success) throw new Error(`Invalid quest ${file}: ${r.error.message}`);
    return r.data;
  });
  return questCache;
}

export function loadPairQuests(): PairQuest[] {
  pairCache ??= loadDir(join(CONTENT_DIR, 'pair-quests'), (raw, file) => {
    const r = PairQuestSchema.safeParse(raw);
    if (!r.success) throw new Error(`Invalid pair quest ${file}: ${r.error.message}`);
    return r.data;
  });
  return pairCache;
}

export const getNpc = (id: string) => loadNpcs().find((n) => n.id === id);
export const getQuest = (id: string) => loadQuests().find((q) => q.id === id);
export const getPairQuest = (id: string) => loadPairQuests().find((q) => q.id === id);
export const questsForNpc = (npcId: string) => loadQuests().filter((q) => q.npc === npcId);
export const pairQuestsForNpc = (npcId: string) => loadPairQuests().filter((q) => q.npc === npcId);

import { PlacementQuestionSchema, type PlacementQuestion } from '@es/shared';
let placementCache: PlacementQuestion[] | undefined;
export function loadPlacement(): PlacementQuestion[] {
  placementCache ??= (parse(readFileSync(join(CONTENT_DIR, 'placement.yaml'), 'utf8')) as unknown[]).map((raw, i) => {
    const r = PlacementQuestionSchema.safeParse(raw);
    if (!r.success) throw new Error(`Invalid placement question #${i + 1}: ${r.error.message}`);
    return r.data;
  });
  return placementCache;
}
