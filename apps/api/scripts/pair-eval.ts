/**
 * Runs a scripted two-player role-play through the pair-quest judge and checks
 * goal detection per role.   pnpm --filter @es/api eval:pair   (NPC_PROVIDER=claude for the real model)
 */
import { ClaudeNpcLlm, createNpcLlm } from '../src/npc/llm';
import { MemoryAttemptRepo } from '../src/npc/attempts';
import { PairService, type PairSession } from '../src/npc/pairService';
import { MemoryStore } from '../src/npc/store';

const A = { playerId: 'eval-customer-0001', name: 'Alice' };
const B = { playerId: 'eval-waiter-00001', name: 'Bob' };

interface Step {
  who: 'A' | 'B';
  text: string;
  expect?: string[];
}
const SCRIPT: Step[] = [
  { who: 'B', text: 'Good evening! Welcome to Le Petit Bistro. Here is the menu.', expect: ['greet'] },
  { who: 'A', text: 'Thank you. What do you recommend? I am vegetarian.', expect: ['ask_recommend', 'say_vegetarian'] },
  { who: 'B', text: "I'd recommend the mushroom pasta, it is vegetarian and very popular. Anything to drink?", expect: ['recommend'] },
  { who: 'A', text: "i want the mushroom pasta and a lemonade please", expect: ['order'] },
  // "take_order" = confirm the order and ask about a drink; the judge may credit it here or on the previous line.
  { who: 'B', text: 'Perfect, one mushroom pasta and a lemonade. Coming right up.' },
  { who: 'A', text: 'Could I have the bill, please?', expect: ['bill'] },
  { who: 'B', text: "Of course. Here's your bill: pasta 14 and lemonade 4, so the total is 18 dollars.", expect: ['bring_bill'] },
];

const llm = createNpcLlm();
const svc = new PairService(llm, new MemoryAttemptRepo(), new MemoryStore<PairSession>());
console.log(`provider: ${llm.name}\n`);

let state = await svc.start('bistro-dinner-01', [A, B]);
const problems: string[] = [];
for (const step of SCRIPT) {
  if (state.finished) break;
  const p = step.who === 'A' ? A : B;
  const r = await svc.chat(state.sessionId, p.playerId, step.text);
  const t = r.turn;
  console.log(`${step.who} (${state.players.find((x) => x.playerId === p.playerId)?.role}): ${step.text}`);
  console.log(`   goals: [${t.goals_completed.join(', ')}]${t.reply ? ` | aside: "${t.reply}"` : ''}${t.hint ? ` | hint: ${t.hint}` : ''}`);
  for (const c of t.corrections) console.log(`   fix: "${c.original}" -> "${c.corrected}" (${c.type}) ${c.explanation_vi}`);
  for (const g of step.expect ?? []) if (!t.goals_completed.includes(g)) problems.push(`${step.who}: expected goal ${g} for "${step.text}"`);
  state = r.state;
  if (r.summaries) console.log('\nsummaries:', JSON.stringify(Object.fromEntries(Object.entries(r.summaries).map(([k, v]) => [k, `${v.status}:${v.score}`]))));
}
for (const role of state.roles) for (const g of role.goals) if (!(state.goalsDone[role.id] ?? []).includes(g.id)) problems.push(`${role.id}: goal ${g.id} never credited`);
console.log('\nfinal goals:', JSON.stringify(state.goalsDone), 'finished:', state.finished);
if (problems.length) console.log('problems:\n - ' + problems.join('\n - '));
else console.log('all expected goals detected');
if (llm instanceof ClaudeNpcLlm) {
  const u = llm.usage;
  console.log(`usage: ${u.requests} requests · input ${u.input} · cache read ${u.cacheRead} · cache write ${u.cacheWrite} · output ${u.output}`);
}
process.exit(problems.length ? 1 : 0);
