import { randomUUID } from 'node:crypto';
import { CEFR_LEVELS, toLang, type AttemptSummary, type CefrLevel, type NpcTurnResponse, type PairLine, type PairQuest, type PairSessionState } from '@es/shared';
import { getNpc, getPairQuest } from '@es/quests';
import type { NpcLlm } from './llm';
import type { AttemptRepo } from './attempts';
import type { KeyedStore } from './store';
import { NpcError } from './service';

export interface PairSession extends PairSessionState {
  attemptIds: Record<string, string>;
  corrections: Record<string, PairLine['corrections']>;
  startedAt: number;
}

/** Two-player role-play judged by an NPC. Sessions live in the shared store (Redis in production). */
export class PairService {
  constructor(
    private llm: NpcLlm,
    private attempts: AttemptRepo,
    private store: KeyedStore<PairSession>,
  ) {}

  async start(questId: string, players: [{ playerId: string; name: string }, { playerId: string; name: string }]): Promise<PairSessionState> {
    const quest = getPairQuest(questId);
    if (!quest) throw new NpcError(404, 'pair_quest_not_found');
    const npc = getNpc(quest.npc);
    if (!npc) throw new NpcError(404, 'npc_not_found');
    if (players[0].playerId === players[1].playerId) throw new NpcError(400, 'same_player');
    for (const p of players) await this.attempts.ensureUser(p.playerId, p.name);

    const [r0, r1] = quest.roles;
    const s: PairSession = {
      sessionId: randomUUID(),
      questId: quest.id,
      npcId: npc.id,
      players: [
        { ...players[0], role: r0.id },
        { ...players[1], role: r1.id },
      ],
      roles: quest.roles,
      goalsDone: { [r0.id]: [], [r1.id]: [] },
      turns: { [players[0].playerId]: 0, [players[1].playerId]: 0 },
      maxTurns: quest.max_turns,
      messages: [],
      finished: false,
      attemptIds: {},
      corrections: { [players[0].playerId]: [], [players[1].playerId]: [] },
      startedAt: Date.now(),
    };
    for (const p of s.players) {
      const id = randomUUID();
      s.attemptIds[p.playerId] = id;
      await this.attempts.create({
        id,
        userId: p.playerId,
        questId: quest.id,
        npcId: npc.id,
        status: 'active',
        score: null,
        turns: 0,
        goalsDone: [],
        transcript: [],
        corrections: [],
      });
    }
    await this.put(s);
    for (const p of s.players) await this.attempts.logEvent({ name: 'pair_start', playerId: p.playerId, props: { questId: quest.id, role: p.role } });
    return this.state(s);
  }

  async chat(sessionId: string, playerId: string, text: string): Promise<{ turn: NpcTurnResponse; state: PairSessionState; summaries: Record<string, AttemptSummary> | null }> {
    const s = await this.get(sessionId);
    const me = s.players.find((p) => p.playerId === playerId);
    if (!me) throw new NpcError(404, 'session_not_found');
    if (s.finished) throw new NpcError(409, 'session_finished');
    if ((s.turns[playerId] ?? 0) >= s.maxTurns) throw new NpcError(409, 'no_turns_left');
    const quest = getPairQuest(s.questId)!;
    const npc = getNpc(s.npcId)!;
    const user = await this.attempts.ensureUser(playerId, me.name);
    const level = (CEFR_LEVELS as readonly string[]).includes(user.cefrLevel) ? (user.cefrLevel as CefrLevel) : 'A1';
    const clean = text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim();

    const turn = await this.llm.judge({
      npc,
      quest,
      level,
      speakerName: me.name,
      speakerRole: me.role,
      goalsDone: s.goalsDone,
      turnsLeft: s.maxTurns - (s.turns[playerId] ?? 0),
      transcript: s.messages,
      text: clean,
      lang: toLang(user.nativeLang, 'vi'),
    });

    s.turns[playerId] = (s.turns[playerId] ?? 0) + 1;
    const done = s.goalsDone[me.role] ?? [];
    s.goalsDone[me.role] = [...done, ...turn.goals_completed.filter((g) => !done.includes(g))];
    s.corrections[playerId] = [...(s.corrections[playerId] ?? []), ...turn.corrections];
    s.messages.push({
      playerId,
      name: me.name,
      role: me.role,
      content: clean,
      corrections: turn.corrections,
      goalsCompleted: turn.goals_completed,
      judge: turn.reply || null,
    });

    const allDone = quest.roles.every((r) => r.goals.every((g) => (s.goalsDone[r.id] ?? []).includes(g.id)));
    const outOfTurns = s.players.every((p) => (s.turns[p.playerId] ?? 0) >= s.maxTurns);
    let summaries: Record<string, AttemptSummary> | null = null;
    if (allDone || outOfTurns) summaries = await this.finish(s, quest);
    await this.attempts.update(s.attemptIds[playerId]!, {
      turns: s.turns[playerId],
      goalsDone: s.goalsDone[me.role],
      transcript: s.messages,
      corrections: s.corrections[playerId],
    });
    await this.put(s);
    return { turn, state: this.state(s), summaries };
  }

  async end(sessionId: string, playerId: string): Promise<Record<string, AttemptSummary> | null> {
    const s = await this.get(sessionId);
    if (!s.players.some((p) => p.playerId === playerId)) throw new NpcError(404, 'session_not_found');
    if (s.finished) return null;
    const quest = getPairQuest(s.questId)!;
    s.finished = true;
    const out: Record<string, AttemptSummary> = {};
    for (const p of s.players) {
      out[p.playerId] = this.summarize(s, quest, p.playerId, 'abandoned');
      await this.attempts.update(s.attemptIds[p.playerId]!, { status: 'abandoned', finishedAt: new Date() });
    }
    await this.put(s);
    return out;
  }

  private async finish(s: PairSession, quest: PairQuest) {
    s.finished = true;
    const out: Record<string, AttemptSummary> = {};
    for (const p of s.players) {
      const role = quest.roles.find((r) => r.id === p.role)!;
      const completed = role.goals.every((g) => (s.goalsDone[p.role] ?? []).includes(g.id));
      const sum = this.summarize(s, quest, p.playerId, completed ? 'completed' : 'failed');
      out[p.playerId] = sum;
      await this.attempts.update(s.attemptIds[p.playerId]!, { status: sum.status, score: sum.score, finishedAt: new Date() });
      await this.attempts.reward(p.playerId, sum.reward.xp, sum.reward.coins, 'pair');
      await this.attempts.logEvent({ name: 'pair_end', playerId: p.playerId, props: { questId: quest.id, status: sum.status, score: sum.score } });
    }
    return out;
  }

  private summarize(s: PairSession, quest: PairQuest, playerId: string, status: AttemptSummary['status']): AttemptSummary {
    const p = s.players.find((x) => x.playerId === playerId)!;
    const role = quest.roles.find((r) => r.id === p.role)!;
    const done = s.goalsDone[p.role] ?? [];
    const total = role.goals.length;
    const ratio = done.length / Math.max(1, total);
    const corrections = s.corrections[playerId] ?? [];
    const penalty = Math.min(30, corrections.length * 4);
    const score = Math.max(0, Math.min(100, Math.round(100 * ratio - penalty)));
    const full = status === 'completed';
    return {
      status,
      score,
      goalsDone: done,
      goalsTotal: total,
      turns: s.turns[playerId] ?? 0,
      corrections,
      vocab: [],
      reward: {
        xp: full ? quest.reward.xp : Math.round((quest.reward.xp * ratio) / 2),
        coins: full ? quest.reward.coins : Math.round((quest.reward.coins * ratio) / 2),
      },
    };
  }

  private async get(id: string): Promise<PairSession> {
    const s = await this.store.get(id);
    if (!s) throw new NpcError(404, 'session_not_found');
    return s;
  }
  private put(s: PairSession) {
    return this.store.set(s.sessionId, s);
  }
  private state(s: PairSession): PairSessionState {
    const { attemptIds: _a, corrections: _c, startedAt: _t, ...rest } = s;
    return rest;
  }
}
