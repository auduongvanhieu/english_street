import { loadNpcs, loadPairQuests, loadQuests } from './index';

const npcs = loadNpcs();
const quests = loadQuests();
const pairs = loadPairQuests();
const npcIds = new Set(npcs.map((n) => n.id));
const bad = [...quests, ...pairs].filter((q) => !npcIds.has(q.npc));
if (bad.length) {
  console.error('Quests referencing unknown NPC:', bad.map((q) => `${q.id} -> ${q.npc}`));
  process.exit(1);
}
console.log(`OK: ${npcs.length} NPCs, ${quests.length} quests, ${pairs.length} pair quests`);
