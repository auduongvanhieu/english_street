import Anthropic from '@anthropic-ai/sdk';
import { setting } from '../settings';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import {
  NpcTurnResponseSchema,
  langName,
  type CefrLevel,
  type ChatMessage,
  type LangCode,
  type NpcPersona,
  type NpcTurnResponse,
  type Quest,
} from '@es/shared';
import type { PairLine, PairQuest } from '@es/shared';
import { env, hasRealApiKey } from '../env';
import { judgePersonaBlock, judgeQuestBlock, judgeStateBlock, personaBlock, questBlock, stateBlock } from './prompt';
import { budget } from './budget';

/** A1–A2 quests and free chat go to the cheaper model; B1+ to the main one. */
export function modelFor(level: string | null): string {
  return !level || level === 'A1' || level === 'A2' ? setting('npcModelBasic') : setting('npcModel');
}

export interface TurnInput {
  npc: NpcPersona;
  quest: Quest | null;
  level: CefrLevel;
  goalsDone: string[];
  turnsLeft: number;
  /** Prior exchanges (user/assistant alternating, user first). */
  history: ChatMessage[];
  text: string;
  /** Include a translation of the reply (reply_tr) in the learner's language. */
  subtitles?: boolean;
  /** Learner's own language: explanations, meanings, hints, subtitles. */
  lang: LangCode;
}

export interface JudgeInput {
  npc: NpcPersona;
  quest: PairQuest;
  level: CefrLevel;
  speakerName: string;
  speakerRole: string;
  goalsDone: Record<string, string[]>;
  turnsLeft: number;
  transcript: PairLine[];
  text: string;
  /** The speaker's own language (explanations, meanings). */
  lang: LangCode;
}

export interface NpcLlm {
  readonly name: string;
  turn(input: TurnInput): Promise<NpcTurnResponse>;
  /** Pair quests: the NPC evaluates one learner's line as an observer. */
  judge(input: JudgeInput): Promise<NpcTurnResponse>;
  /** Short English → learner-language translation (subtitles for greetings, chat lines, single words). */
  translate(text: string, to: LangCode): Promise<string>;
}

/** Said when the model refuses or returns unparseable output, so the game never stalls. */
export const SAFE_FALLBACK: NpcTurnResponse = {
  reply: "Sorry, I didn't quite catch that. Could you say it another way?",
  reply_tr: null,
  emotion: 'confused',
  goals_completed: [],
  corrections: [],
  new_vocab: [],
  hint: null,
};

// ---------------------------------------------------------------- Claude
export interface UsageTotals {
  requests: number;
  input: number;
  cacheRead: number;
  cacheWrite: number;
  output: number;
}

export class ClaudeNpcLlm implements NpcLlm {
  readonly name = `claude:${setting('npcModel')}+${setting('npcModelBasic')}`;
  /** Running token totals since process start (for cost reporting). */
  readonly usage: UsageTotals = { requests: 0, input: 0, cacheRead: 0, cacheWrite: 0, output: 0 };
  private client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  async turn(input: TurnInput): Promise<NpcTurnResponse> {
    const messages: Anthropic.MessageParam[] = [
      ...input.history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: input.text },
    ];
    const req: Anthropic.MessageCreateParamsNonStreaming = {
      model: modelFor(input.quest?.level ?? null),
      max_tokens: 1024,
      system: [
        { type: 'text', text: personaBlock(input.npc), cache_control: { type: 'ephemeral' } },
        { type: 'text', text: questBlock(input.quest), cache_control: { type: 'ephemeral' } },
        {
          type: 'text',
          text: stateBlock({
            level: input.level,
            goalsDone: input.goalsDone,
            goalsTotal: input.quest?.goals.length ?? 0,
            turnsLeft: input.turnsLeft,
            subtitles: input.subtitles,
            lang: input.lang,
          }),
        },
      ],
      messages,
      output_config: { format: zodOutputFormat(NpcTurnResponseSchema), effort: 'low' },
    };

    const out = await this.call(req);
    return out ? sanitize(out, input) : SAFE_FALLBACK;
  }

  async judge(input: JudgeInput): Promise<NpcTurnResponse> {
    const lines = input.transcript.map((l) => `${l.role.toUpperCase()} (${l.name}): ${l.content}`).join('\n');
    const user = `Transcript so far:\n${lines || '(nothing yet)'}\n\nLatest line from ${input.speakerRole.toUpperCase()} (${input.speakerName}): ${input.text}`;
    const req: Anthropic.MessageCreateParamsNonStreaming = {
      model: modelFor(input.quest.level),
      max_tokens: 1024,
      system: [
        { type: 'text', text: judgePersonaBlock(input.npc), cache_control: { type: 'ephemeral' } },
        { type: 'text', text: judgeQuestBlock(input.quest), cache_control: { type: 'ephemeral' } },
        {
          type: 'text',
          text: judgeStateBlock({
            speakerName: input.speakerName,
            speakerRole: input.speakerRole,
            level: input.level,
            goalsDone: input.goalsDone,
            turnsLeft: input.turnsLeft,
            lang: input.lang,
          }),
        },
      ],
      messages: [{ role: 'user', content: user }],
      output_config: { format: zodOutputFormat(NpcTurnResponseSchema), effort: 'low' },
    };
    const out = await this.call(req);
    if (!out) return { ...SAFE_FALLBACK, reply: '' };
    const role = input.quest.roles.find((r) => r.id === input.speakerRole);
    const valid = new Set((role?.goals ?? []).map((g) => g.id));
    const done = input.goalsDone[input.speakerRole] ?? [];
    return {
      ...out,
      reply: out.reply.trim().slice(0, 200),
      goals_completed: [...new Set(out.goals_completed)].filter((g) => valid.has(g) && !done.includes(g)),
      corrections: out.corrections.filter((c) => normalize(c.corrected) !== normalize(c.original)).slice(0, 2),
      new_vocab: out.new_vocab.slice(0, 2),
    };
  }

  async translate(text: string, to: LangCode): Promise<string> {
    const res = await this.client.messages.create({
      model: setting('npcModelBasic'),
      max_tokens: 300,
      system: `Translate the user message from English to natural ${langName(to)} for a language learner. Reply with the translation only — no quotes, no notes. If the message is a single word, give its most common meaning(s) as a short gloss.`,
      messages: [{ role: 'user', content: text }],
    });
    this.usage.requests += 1;
    this.usage.input += res.usage.input_tokens;
    this.usage.output += res.usage.output_tokens;
    budget.recordUsage(setting('npcModelBasic'), { input: res.usage.input_tokens, output: res.usage.output_tokens, cacheRead: 0, cacheWrite: 0 });
    return res.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim();
  }

  /** One parse call with usage accounting; null on refusal or unparseable output (after one retry). */
  private async call(req: Anthropic.MessageCreateParamsNonStreaming): Promise<NpcTurnResponse | null> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await this.client.messages.parse(req);
      this.usage.requests += 1;
      this.usage.input += res.usage.input_tokens;
      this.usage.cacheRead += res.usage.cache_read_input_tokens ?? 0;
      this.usage.cacheWrite += res.usage.cache_creation_input_tokens ?? 0;
      this.usage.output += res.usage.output_tokens;
      budget.recordUsage(req.model, {
        input: res.usage.input_tokens,
        output: res.usage.output_tokens,
        cacheRead: res.usage.cache_read_input_tokens ?? 0,
        cacheWrite: res.usage.cache_creation_input_tokens ?? 0,
      });
      if (res.stop_reason === 'refusal') return null;
      if (res.parsed_output) return res.parsed_output;
    }
    return null;
  }
}

// ---------------------------------------------------------------- Mock (dev / tests)
const GOAL_KEYWORDS: Record<string, string[]> = {
  greet: ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'],
  order_drink: ['latte', 'coffee', 'americano', 'espresso', 'cappuccino', 'mocha', 'tea', 'chocolate'],
  order_food: ['croissant', 'muffin', 'bagel', 'something to eat', 'sandwich'],
  order_custom: ['oat', 'almond', 'skim'],
  ask_price: ['how much', 'price', 'cost'],
  ask_loyalty: ['loyalty', 'card', 'points', 'stamp'],
  pay: ['pay', 'here you go', 'card', 'cash', 'bye', 'goodbye', 'thank'],
  ask_milk: ['where is the milk', 'where can i find milk', 'find milk', 'where the milk', 'milk?'],
  ask_toothpaste: ['where is the toothpaste', 'find toothpaste', 'where the toothpaste', 'toothpaste?'],
  buy: ['buy', "i'll take", 'i will take', 'both', 'these', 'take them'],
  bag: ['bag'],
  explain: ['broken', "doesn't work", 'does not work', 'not working', 'problem', 'damaged'],
  receipt: ['receipt'],
  refund: ['refund', 'money back', 'exchange'],
  thank: ['thank', 'thanks', 'cheers'],
  ask_way: ['how do i get', 'where is', 'way to', 'get to', 'directions'],
  ask_time: ['how long', 'how far', 'minutes'],
  confirm: ['so i', 'so, i', 'turn left', 'turn right', 'straight', 'right?'],
  hours: ['open', 'hours', 'what time'],
  price: ['how much', 'ticket', 'price', 'cost'],
  bus: ['bus', 'which bus'],
  closed: ['closed', 'which day', 'monday'],
};
const VI_RE = /[ăâđêôơưàáảãạèéẻẽẹìíỉĩịòóỏõọùúủũụỳýỷỹỵ]/i;

export class MockNpcLlm implements NpcLlm {
  readonly name = 'mock';
  async translate(text: string, to: LangCode): Promise<string> {
    return `[${to}] ${text}`;
  }
  declare judge: (input: JudgeInput) => Promise<NpcTurnResponse>;
  async turn(input: TurnInput): Promise<NpcTurnResponse> {
    const t = input.text.toLowerCase();
    const goals = (input.quest?.goals ?? [])
      .filter((g) => !input.goalsDone.includes(g.id))
      .filter((g) => {
        const kws = GOAL_KEYWORDS[g.id] ?? input.quest?.target_vocab.map((v) => v.toLowerCase()) ?? [];
        return kws.some((k) => t.includes(k));
      })
      .map((g) => g.id);

    const corrections: NpcTurnResponse['corrections'] = [];
    if (/\bi want (a|an|the|two|some)\b/.test(t)) {
      corrections.push({
        original: input.text,
        corrected: input.text.replace(/\bi want\b/i, "I'd like"),
        explanation: '"I\'d like" lịch sự hơn "I want" khi gọi món hoặc mua hàng.',
        type: 'register',
      });
    }
    const vi = VI_RE.test(input.text);
    const silent = /^[\s.…?!-]*$/.test(input.text);
    const left = input.turnsLeft;
    const reply = silent
      ? 'Take your time! What would you like?'
      : vi
      ? "Sorry, English only here! Can you try again in English?"
      : left <= 1
        ? `Great, that's everything. Thanks for coming by, see you next time!`
        : goals.length
          ? `Sure thing! Anything else for you?`
          : `Alright. What else can I help you with?`;
    return {
      reply,
      emotion: vi || silent ? 'confused' : goals.length ? 'happy' : 'neutral',
      goals_completed: goals,
      corrections,
      new_vocab: goals.includes('order_drink') ? [{ word: 'to go', meaning: 'mang đi', example: 'A latte to go, please.' }] : [],
      hint: vi || silent ? 'Try: "Can I have a coffee, please?"' : null,
      reply_tr: input.subtitles ? `[${input.lang}] ${reply}` : null,
    };
  }
}

const PAIR_GOAL_KEYWORDS: Record<string, string[]> = {
  ask_recommend: ['recommend', 'suggest', 'what is good', "what's good"],
  say_vegetarian: ['vegetarian', 'no meat', "don't eat meat"],
  order: ["i'll have", 'i will have', 'can i have', 'i would like', "i'd like", 'and a', 'please'],
  bill: ['bill', 'check', 'pay'],
  greet: ['welcome', 'good evening', 'hello', 'hi', 'menu'],
  recommend: ['recommend', 'suggest', 'pasta', 'try the', 'is very good'],
  take_order: ['anything to drink', 'drink', 'so that is', "so that's", 'got it', 'coming up'],
  bring_bill: ['here is your bill', "here's your bill", 'total', 'comes to', 'that will be', "that'll be"],
};

MockNpcLlm.prototype.judge = async function (input: JudgeInput): Promise<NpcTurnResponse> {
  const t = input.text.toLowerCase();
  const role = input.quest.roles.find((r) => r.id === input.speakerRole);
  const done = input.goalsDone[input.speakerRole] ?? [];
  const goals = (role?.goals ?? [])
    .filter((g) => !done.includes(g.id))
    .filter((g) => (PAIR_GOAL_KEYWORDS[g.id] ?? []).some((k) => t.includes(k)))
    .map((g) => g.id);
  const vi = VI_RE.test(input.text);
  return {
    reply: vi ? 'English only, please!' : goals.length === 0 && input.turnsLeft <= 1 ? 'Last line — try to finish your goals.' : '',
    emotion: goals.length ? 'happy' : 'neutral',
    goals_completed: goals,
    corrections: /\bi want\b/.test(t)
      ? [{ original: input.text, corrected: input.text.replace(/\bi want\b/i, "I'd like"), explanation: '"I\'d like" lịch sự hơn "I want".', type: 'register' }]
      : [],
    new_vocab: [],
    hint: vi ? 'Try: "What do you recommend?"' : null,
    reply_tr: null,
  };
};

/** Keep only goal ids that exist and are not done yet; clamp list sizes. */
function sanitize(out: NpcTurnResponse, input: TurnInput): NpcTurnResponse {
  const valid = new Set((input.quest?.goals ?? []).map((g) => g.id));
  return {
    ...out,
    reply: out.reply.trim().slice(0, 600),
    goals_completed: [...new Set(out.goals_completed)].filter((g) => valid.has(g) && !input.goalsDone.includes(g)),
    // Drop "corrections" that change nothing (small models sometimes emit "this is already correct").
    corrections: out.corrections.filter((c) => normalize(c.corrected) !== normalize(c.original)).slice(0, 2),
    new_vocab: out.new_vocab.slice(0, 2),
  };
}

function normalize(s: string) {
  return s.toLowerCase().replace(/[^\p{L}\p{N}']+/gu, ' ').trim();
}

export function createNpcLlm(): NpcLlm {
  const mode = env.NPC_PROVIDER === 'auto' ? (hasRealApiKey() ? 'claude' : 'mock') : env.NPC_PROVIDER;
  if (mode === 'claude') {
    if (!hasRealApiKey()) throw new Error('NPC_PROVIDER=claude but ANTHROPIC_API_KEY is missing');
    return new ClaudeNpcLlm();
  }
  return new MockNpcLlm();
}
