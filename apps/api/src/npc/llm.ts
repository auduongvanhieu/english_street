import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import {
  NpcTurnResponseSchema,
  type CefrLevel,
  type ChatMessage,
  type NpcPersona,
  type NpcTurnResponse,
  type Quest,
} from '@es/shared';
import { env, hasRealApiKey } from '../env';
import { personaBlock, questBlock, stateBlock } from './prompt';

export interface TurnInput {
  npc: NpcPersona;
  quest: Quest | null;
  level: CefrLevel;
  goalsDone: string[];
  turnsLeft: number;
  /** Prior exchanges (user/assistant alternating, user first). */
  history: ChatMessage[];
  text: string;
}

export interface NpcLlm {
  readonly name: string;
  turn(input: TurnInput): Promise<NpcTurnResponse>;
}

/** Said when the model refuses or returns unparseable output, so the game never stalls. */
export const SAFE_FALLBACK: NpcTurnResponse = {
  reply: "Sorry, I didn't quite catch that. Could you say it another way?",
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
  readonly name = `claude:${env.NPC_MODEL}`;
  /** Running token totals since process start (for cost reporting). */
  readonly usage: UsageTotals = { requests: 0, input: 0, cacheRead: 0, cacheWrite: 0, output: 0 };
  private client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  async turn(input: TurnInput): Promise<NpcTurnResponse> {
    const messages: Anthropic.MessageParam[] = [
      ...input.history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: input.text },
    ];
    const req: Anthropic.MessageCreateParamsNonStreaming = {
      model: env.NPC_MODEL,
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
          }),
        },
      ],
      messages,
      output_config: { format: zodOutputFormat(NpcTurnResponseSchema), effort: 'low' },
    };

    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await this.client.messages.parse(req);
      this.usage.requests += 1;
      this.usage.input += res.usage.input_tokens;
      this.usage.cacheRead += res.usage.cache_read_input_tokens ?? 0;
      this.usage.cacheWrite += res.usage.cache_creation_input_tokens ?? 0;
      this.usage.output += res.usage.output_tokens;
      if (res.stop_reason === 'refusal') return SAFE_FALLBACK;
      if (res.parsed_output) return sanitize(res.parsed_output, input);
    }
    return SAFE_FALLBACK;
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
        explanation_vi: '"I\'d like" lịch sự hơn "I want" khi gọi món hoặc mua hàng.',
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
      new_vocab: goals.includes('order_drink') ? [{ word: 'to go', meaning_vi: 'mang đi', example: 'A latte to go, please.' }] : [],
      hint: vi || silent ? 'Try: "Can I have a coffee, please?"' : null,
    };
  }
}

/** Keep only goal ids that exist and are not done yet; clamp list sizes. */
function sanitize(out: NpcTurnResponse, input: TurnInput): NpcTurnResponse {
  const valid = new Set((input.quest?.goals ?? []).map((g) => g.id));
  return {
    ...out,
    reply: out.reply.trim().slice(0, 600),
    goals_completed: [...new Set(out.goals_completed)].filter((g) => valid.has(g) && !input.goalsDone.includes(g)),
    corrections: out.corrections.slice(0, 2),
    new_vocab: out.new_vocab.slice(0, 2),
  };
}

export function createNpcLlm(): NpcLlm {
  const mode = env.NPC_PROVIDER === 'auto' ? (hasRealApiKey() ? 'claude' : 'mock') : env.NPC_PROVIDER;
  if (mode === 'claude') {
    if (!hasRealApiKey()) throw new Error('NPC_PROVIDER=claude but ANTHROPIC_API_KEY is missing');
    return new ClaudeNpcLlm();
  }
  return new MockNpcLlm();
}
