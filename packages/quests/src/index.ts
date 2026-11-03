import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { NpcPersonaSchema, QuestSchema, type NpcPersona, type Quest } from '@es/shared';

const CONTENT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'content');

function loadDir<T>(dir: string, parseOne: (raw: unknown, file: string) => T): T[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
    .sort()
    .map((f) => parseOne(parse(readFileSync(join(dir, f), 'utf8')), f));
}

let npcCache: NpcPersona[] | undefined;
let questCache: Quest[] | undefined;

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

export function getNpc(id: string): NpcPersona | undefined {
  return loadNpcs().find((n) => n.id === id);
}

export function getQuest(id: string): Quest | undefined {
  return loadQuests().find((q) => q.id === id);
}

export function questsForNpc(npcId: string): Quest[] {
  return loadQuests().filter((q) => q.npc === npcId);
}
