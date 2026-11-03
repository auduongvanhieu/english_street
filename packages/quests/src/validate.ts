import { loadNpcs, loadQuests } from './index';

const npcs = loadNpcs();
const quests = loadQuests();
const npcIds = new Set(npcs.map((n) => n.id));
const bad = quests.filter((q) => !npcIds.has(q.npc));
if (bad.length) {
  console.error('Quests referencing unknown NPC:', bad.map((q) => `${q.id} -> ${q.npc}`));
  process.exit(1);
}
console.log(`OK: ${npcs.length} NPCs, ${quests.length} quests`);
