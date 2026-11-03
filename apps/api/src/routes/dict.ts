import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { dictSize, ipaForWords } from '../dict/ipa';
import type { NpcLlm } from '../npc/llm';
import type { KeyedStore } from '../npc/store';
import type { AttemptRepo } from '../npc/attempts';
import { limiter } from '../npc/ratelimit';
import { budget } from '../npc/budget';
import { playerIdFrom } from '../auth';

const TranslateSchema = z.object({ text: z.string().min(1).max(300), playerId: z.string().min(8).max(64).optional() });
const PushTokenSchema = z.object({ playerId: z.string().min(8).max(64).optional(), token: z.string().min(10).max(512), platform: z.string().max(16).default('') });
const AddVocabSchema = z.object({ playerId: z.string().min(8).max(64).optional(), word: z.string().min(1).max(40), meaningVi: z.string().min(1).max(200), example: z.string().max(300).default('') });

/**
 * Learning helpers that are (almost) free: IPA from CMUdict (no LLM) and short translations by the
 * cheap model, cached by text hash so the same greeting / chat line is only ever translated once.
 */
export function dictRoutes(llm: NpcLlm, cache: KeyedStore<{ vi: string }>, repo: AttemptRepo) {
  return async function routes(app: FastifyInstance) {
    app.get<{ Querystring: { words?: string } }>('/dict/ipa', async (req) => {
      const words = (req.query.words ?? '')
        .split(',')
        .map((w) => w.trim())
        .filter(Boolean);
      return ipaForWords(words);
    });

    app.get('/dict/stats', async () => ({ words: dictSize() }));

    app.post('/translate', async (req, reply) => {
      const body = TranslateSchema.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request' });
      const text = body.data.text.trim();
      const key = createHash('sha1').update(text.toLowerCase()).digest('hex');
      const hit = await cache.get(key);
      if (hit) return { vi: hit.vi, cached: true };
      if (!(await limiter.allow(`tr:${req.ip}`, 30))) return reply.code(429).send({ error: 'rate_limited' });
      const pid = playerIdFrom(req, body.data.playerId) ?? '';
      if (pid) await budget.check(pid, req.ip);
      const vi = await llm.translate(text);
      await cache.set(key, { vi });
      return { vi, cached: false };
    });

    // Mobile app: register the device for reminders (streak, daily quest). Sending is done by a separate job.
    app.post('/me/push-token', async (req, reply) => {
      const body = PushTokenSchema.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request' });
      const pid = playerIdFrom(req, body.data.playerId);
      if (!pid) return reply.code(401).send({ error: 'unauthorized' });
      await repo.savePushToken(pid, body.data.token, body.data.platform);
      return reply.code(201).send({ ok: true });
    });

    app.post('/me/vocab', async (req, reply) => {
      const body = AddVocabSchema.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request' });
      const pid = playerIdFrom(req, body.data.playerId);
      if (!pid) return reply.code(401).send({ error: 'unauthorized' });
      await repo.ensureUser(pid, (await repo.getUser(pid))?.name ?? 'Guest');
      await repo.saveVocab(pid, [{ word: body.data.word, meaning_vi: body.data.meaningVi, example: body.data.example }]);
      return reply.code(201).send({ ok: true });
    });
  };
}
