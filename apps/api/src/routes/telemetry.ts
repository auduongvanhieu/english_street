import { AREA_IDS } from '@es/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { BETA_PASS_TTL_S, signToken } from '@es/shared/token';
import { env } from '../env';
import { playerIdFrom } from '../auth';
import { allowTelemetry } from '../npc/ratelimit';
import type { AttemptRepo } from '../npc/attempts';

/** Client-side event names we accept (anything else is dropped). */
/** Area activities report `<area>_<what>`, e.g. school_spelling_done. */
const AREA_ACTIVITY_EVENT = new RegExp(`^(${AREA_IDS.join('|')})_[a-z_]{2,30}$`);
const CLIENT_EVENTS = new Set(['page_load', 'join', 'perf', 'voice_chat_on', 'stt_used', 'tts_off', 'client_error', 'placement_skipped', 'settings_change', 'word_tap', 'translate_chat', 'talk_start', 'talk_end', 'shout', 'voice_shout', 'critter_tap', 'zone_create', 'zone_join', 'zone_full', 'translate_line', 'ipa_line', 'avatar_save', 'critter_hug', 'lang_change', 'area_enter', 'area_panel_open', 'word_card_open', 'quiz_done', 'farm_action', 'restaurant_order', 'shopping_done', 'shopping_start', 'bus_ride', 'restaurant_sit', 'seat_sit', 'swim', 'garden_visit', 'translation_report', 'exit_game', 'area_leave', 'npc_open', 'notice_seen', 'chat_send', 'friend_request', 'ferry_board', 'boat_board', 'fishing_catch', 'restaurant_pay', 'hotel_room_service', 'football_goal', 'critter_hug', 'beach_arrive', 'beach_swim', 'beach_red_swim', 'beach_hunt_start', 'beach_hunt_done', 'beach_castle', 'beach_icecream', 'hill_arrive', 'hill_hike_start', 'hill_hike_done', 'hill_pack', 'hill_animals', 'riverside_arrive', 'riverside_list', 'riverside_market_done', 'riverside_lost_start', 'riverside_lost_done', 'oldtown_arrive', 'oldtown_clock_start', 'oldtown_clock_done', 'oldtown_museum_done']);

const EventsSchema = z.object({
  playerId: z.string().min(8).max(64).optional(),
  events: z
    .array(z.object({ name: z.string().max(40), props: z.record(z.string(), z.union([z.string().max(200), z.number(), z.boolean()])).default({}) }))
    .max(20),
});
const FeedbackSchema = z.object({
  playerId: z.string().min(8).max(64).optional(),
  name: z.string().max(40).default('Guest'),
  text: z.string().min(3).max(2000),
  page: z.string().max(80).default(''),
  meta: z.record(z.string(), z.union([z.string().max(200), z.number(), z.boolean()])).default({}),
});

import { useBetaCode } from '../admin/opsRoutes';

export function telemetryRoutes(repo: AttemptRepo) {
  return async function routes(app: FastifyInstance) {
    /** Public runtime config for the client. */
    app.get('/config', async () => ({ betaGate: env.BETA_CODES.length > 0, provider: process.env.npm_package_version ?? '0.1.0', turnstileSiteKey: env.TURNSTILE_SECRET ? env.TURNSTILE_SITE_KEY : '' }));

    /** Closed beta: exchange an invite code for a long-lived pass (sent as `x-beta-pass`). */
    app.post('/beta/verify', async (req, reply) => {
      if (!(await allowTelemetry(req.ip))) return reply.code(429).send({ error: 'rate_limited' });
      const body = z.object({ code: z.string().min(1).max(64) }).safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request' });
      const code = body.data.code.trim();
      const known = env.BETA_CODES.some((c) => c.toLowerCase() === code.toLowerCase()) || (repo.name === 'postgres' && (await useBetaCode(code)));
      if (!known) return reply.code(403).send({ error: 'invalid_invite_code' });
      await repo.logEvent({ name: 'beta_claim', props: { code } });
      return { pass: signToken(env.AUTH_SECRET, 'beta', BETA_PASS_TTL_S, { code }) };
    });

    /** Batched client analytics. */
    app.post('/events', async (req, reply) => {
      if (!(await allowTelemetry(req.ip))) return reply.code(429).send({ error: 'rate_limited' });
      const body = EventsSchema.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request' });
      const pid = playerIdFrom(req, body.data.playerId);
      for (const e of body.data.events) if (CLIENT_EVENTS.has(e.name) || AREA_ACTIVITY_EVENT.test(e.name)) await repo.logEvent({ name: e.name, playerId: pid, props: e.props });
      return reply.code(204).send();
    });

    /** Beta feedback form. */
    app.post('/feedback', async (req, reply) => {
      if (!(await allowTelemetry(req.ip))) return reply.code(429).send({ error: 'rate_limited' });
      const body = FeedbackSchema.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request', issues: body.error.issues });
      const pid = playerIdFrom(req, body.data.playerId);
      await repo.createFeedback({ ...body.data, playerId: pid });
      await repo.logEvent({ name: 'feedback', playerId: pid, props: { page: body.data.page } });
      return reply.code(201).send({ ok: true });
    });
  };
}
