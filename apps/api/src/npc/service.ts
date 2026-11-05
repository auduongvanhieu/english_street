import { randomUUID } from 'node:crypto';
import { CEFR_LEVELS, toLang, type LangCode, type AttemptSummary, type CefrLevel, type NpcTurnResponse, type Quest, type SessionState } from '@es/shared';
import { getNpc, getQuest } from '@es/quests';
import { ENTER_MESSAGE } from './prompt';
import { env } from '../env';
import type { NpcLlm } from './llm';
import type { Session, SessionStore } from './store';
import type { AttemptRepo } from './attempts';

export class NpcError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const FREE_TALK_MAX_TURNS = 20;

/** Keep the opening exchange (enter + greeting) and the most recent messages, user-first. */
export function trimHistory<T extends { role: 'user' | 'assistant' }>(h: T[], max: number): T[] {
  if (h.length <= max) return h;
  const head = h.slice(0, 2);
  let tail = h.slice(-(max - 2));
  if (tail[0]?.role === 'assistant') tail = tail.slice(1);
  return [...head, ...tail];
}

export class NpcService {
  constructor(
    private llm: NpcLlm,
    private sessions: SessionStore,
    private attempts: AttemptRepo,
  ) {}

  /** Start a quest (questId) or a free chat (questId = null) with an NPC. */
  async start(npcId: string, questId: string | null, playerId: string, playerName: string): Promise<SessionState> {
    const npc = getNpc(npcId);
    if (!npc) throw new NpcError(404, 'npc_not_found');
    let quest: Quest | null = null;
    if (questId) {
      quest = getQuest(questId) ?? null;
      if (!quest) throw new NpcError(404, 'quest_not_found');
      if (quest.npc !== npcId) throw new NpcError(400, 'quest_belongs_to_other_npc');
    }
    await this.attempts.ensureUser(playerId, playerName);

    const s: Session = {
      id: randomUUID(),
      playerId,
      playerName,
      npcId,
      questId,
      attemptId: null,
      history: [
        { role: 'user', content: ENTER_MESSAGE },
        { role: 'assistant', content: npc.greeting },
      ],
      goalsDone: [],
      turns: 0,
      maxTurns: quest?.max_turns ?? FREE_TALK_MAX_TURNS,
      corrections: [],
      vocab: [],
      finished: false,
      startedAt: Date.now(),
    };
    if (quest) {
      s.attemptId = randomUUID();
      await this.attempts.create({
        id: s.attemptId,
        userId: playerId,
        questId: quest.id,
        npcId,
        status: 'active',
        score: null,
        turns: 0,
        goalsDone: [],
        transcript: [],
        corrections: [],
      });
    }
    await this.sessions.set(s.id, s);
    await this.attempts.logEvent({ name: quest ? 'quest_start' : 'free_talk_start', playerId, props: { npcId, questId: questId ?? '' } });
    return this.state(s, quest);
  }

  async chat(sessionId: string, playerId: string, text: string, source: 'text' | 'voice' = 'text', subtitles = false, langPref?: LangCode): Promise<{ turn: NpcTurnResponse; state: SessionState; summary: AttemptSummary | null }> {
    const s = await this.sessions.get(sessionId);
    if (!s || s.playerId !== playerId) throw new NpcError(404, 'session_not_found');
    if (s.finished) throw new NpcError(409, 'session_finished');
    const npc = getNpc(s.npcId);
    const quest = s.questId ? (getQuest(s.questId) ?? null) : null;
    if (!npc) throw new NpcError(404, 'npc_not_found');

    const user = await this.attempts.ensureUser(playerId, s.playerName);
    const level = (CEFR_LEVELS as readonly string[]).includes(user.cefrLevel) ? (user.cefrLevel as CefrLevel) : 'A1';
    const lang = langPref ?? toLang(user.nativeLang, 'vi');
    const clean = text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim();

    const turn = await this.llm.turn({
      npc,
      quest,
      level,
      goalsDone: s.goalsDone,
      turnsLeft: s.maxTurns - s.turns,
      history: trimHistory(s.history.map((m) => ({ role: m.role, content: m.content })), env.NPC_HISTORY_MAX),
      text: clean,
      subtitles,
      lang,
    });

    s.turns += 1;
    s.lang = lang;
    s.goalsDone = [...s.goalsDone, ...turn.goals_completed.filter((g) => !s.goalsDone.includes(g))];
    s.corrections.push(...turn.corrections);
    s.vocab.push(...turn.new_vocab.filter((v) => !s.vocab.some((x) => x.word.toLowerCase() === v.word.toLowerCase())));
    s.history.push({ role: 'user', content: clean, corrections: turn.corrections, goalsCompleted: turn.goals_completed });
    s.history.push({ role: 'assistant', content: turn.reply, ...(turn.reply_tr ? { content_tr: turn.reply_tr } : {}) });

    const allDone = !!quest && quest.goals.every((g) => s.goalsDone.includes(g.id));
    const outOfTurns = s.turns >= s.maxTurns;
    let summary: AttemptSummary | null = null;
    if (quest && (allDone || outOfTurns)) {
      summary = await this.finish(s, quest);
    } else if (!quest && outOfTurns) {
      s.finished = true;
    }
    if (s.attemptId) {
      await this.attempts.update(s.attemptId, {
        turns: s.turns,
        goalsDone: s.goalsDone,
        transcript: s.history,
        corrections: s.corrections,
      });
    }
    await this.sessions.set(s.id, s);
    await this.attempts.logEvent({
      name: 'npc_turn',
      playerId,
      props: { npcId: s.npcId, questId: s.questId ?? '', level, source, subtitles, lang, correction_types: turn.corrections.map((c) => c.type), goals: turn.goals_completed.length },
    });
    if (summary) await this.attempts.logEvent({ name: 'quest_end', playerId, props: { questId: s.questId ?? '', status: summary.status, score: summary.score, turns: s.turns } });
    return { turn, state: this.state(s, quest), summary };
  }

  /** Player gives up / closes the panel. */
  async end(sessionId: string, playerId: string): Promise<AttemptSummary | null> {
    const s = await this.sessions.get(sessionId);
    if (!s || s.playerId !== playerId) throw new NpcError(404, 'session_not_found');
    if (s.finished) return null;
    const quest = s.questId ? (getQuest(s.questId) ?? null) : null;
    s.finished = true;
    let summary: AttemptSummary | null = null;
    if (quest && s.attemptId) {
      summary = this.summarize(s, quest, 'abandoned');
      await this.attempts.update(s.attemptId, { status: 'abandoned', finishedAt: new Date(), turns: s.turns, goalsDone: s.goalsDone });
      await this.attempts.logEvent({ name: 'quest_end', playerId, props: { questId: quest.id, status: 'abandoned', score: summary.score, turns: s.turns } });
    }
    await this.sessions.set(s.id, s);
    return summary;
  }

  private async finish(s: Session, quest: Quest): Promise<AttemptSummary> {
    s.finished = true;
    const allDone = quest.goals.every((g) => s.goalsDone.includes(g.id));
    const summary = this.summarize(s, quest, allDone ? 'completed' : 'failed');
    if (s.attemptId) {
      await this.attempts.update(s.attemptId, {
        status: summary.status,
        score: summary.score,
        finishedAt: new Date(),
      });
    }
    const bonus = await this.attempts.dailyBonus(s.playerId, quest.id);
    summary.reward.xp += bonus;
    await this.attempts.reward(s.playerId, summary.reward.xp, summary.reward.coins, 'quest');
    await this.attempts.saveVocab(s.playerId, s.vocab, s.lang ?? 'vi');
    return summary;
  }

  private summarize(s: Session, quest: Quest, status: AttemptSummary['status']): AttemptSummary {
    const total = quest.goals.length;
    const ratio = s.goalsDone.length / Math.max(1, total);
    const penalty = Math.min(30, s.corrections.length * 4);
    const score = Math.max(0, Math.min(100, Math.round(100 * ratio - penalty)));
    const full = status === 'completed';
    return {
      status,
      score,
      goalsDone: s.goalsDone,
      goalsTotal: total,
      turns: s.turns,
      corrections: s.corrections,
      vocab: s.vocab,
      reward: {
        xp: full ? quest.reward.xp : Math.round((quest.reward.xp * ratio) / 2),
        coins: full ? quest.reward.coins : Math.round((quest.reward.coins * ratio) / 2),
      },
    };
  }

  private state(s: Session, quest: Quest | null): SessionState {
    return {
      sessionId: s.id,
      npcId: s.npcId,
      questId: s.questId,
      goals: quest?.goals ?? [],
      goalsDone: s.goalsDone,
      turns: s.turns,
      maxTurns: s.maxTurns,
      messages: s.history.slice(1), // hide the synthetic "[walks up]" line
      finished: s.finished,
    };
  }
}
