import type { FastifyInstance } from 'fastify';
import { CEFR_LEVELS, PRACTICE_KINDS, toLang, type CefrLevel, type PracticeKind } from '@es/shared';
import { playerIdFrom } from '../auth';
import { buildPractice } from '../practice';
import { today } from '../journey/engine';

/**
 * Listening / shadowing lessons for the daily tasks.
 *   GET /practice/:kind?playerId=&lang=&level=&round=  -> PracticeSet
 * Finishing one is a client event (listening_done / shadowing_done) that the journey counts.
 */
export async function practiceRoutes(app: FastifyInstance) {
  app.get<{ Params: { kind: string }; Querystring: { playerId?: string; lang?: string; level?: string; round?: string } }>('/practice/:kind', async (req, reply) => {
    const kind = req.params.kind as PracticeKind;
    if (!PRACTICE_KINDS.includes(kind)) return reply.code(404).send({ error: 'not_found' });
    const pid = playerIdFrom(req, req.query.playerId) ?? 'guest';
    const level = (CEFR_LEVELS as readonly string[]).includes(req.query.level ?? '') ? (req.query.level as CefrLevel) : 'A1';
    const round = Math.max(0, Math.min(999, Number.parseInt(req.query.round ?? '0', 10) || 0));
    return buildPractice(kind, { playerId: pid, day: today(), round, level, lang: toLang(req.query.lang, 'en') });
  });
}
