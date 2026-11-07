import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { HELPS_PER_DAY, NOTES_KEPT, NOTES_PER_DAY, maskProfanity, MyFarmActionSchema, MyFarmStateSchema, STEAL_MIN_LEVEL, applyMyFarm, canSteal, dogAwake, dogLevel, dogSpeed, emptyMyFarm, normalizeMyFarm, farmLog, levelForXp, pieceValue, stealFine, stealFrom, type FarmView, type MyFarmState } from '@es/shared';
import { isInternalKey, signToken } from '@es/shared/token';
import { randomUUID } from 'node:crypto';
import { env } from '../env';
import type { AttemptRepo } from '../npc/attempts';
import { playerIdFrom } from '../auth';
import { limiter } from '../npc/ratelimit';
import { friendRepo, pair } from '../friends';
import { today } from '../journey/engine';

/**
 * "My farm" (@es/shared myfarm.ts): the player's own farm in User.gameState.myfarm. Buying takes coins, selling
 * gives coins (daily cap), all checked here. Friends (or everybody, as the owner chooses) can look at a farm.
 */
export function myFarmRoutes(repo: AttemptRepo) {
  return async function routes(app: FastifyInstance) {
    const who = (req: { authPlayerId: string | null; query: unknown; body?: unknown }) =>
      playerIdFrom(req as never, (req.query as { playerId?: string })?.playerId ?? (req.body as { playerId?: string } | undefined)?.playerId);
    const farmOf = (gs: Record<string, unknown>): MyFarmState => {
      const r = MyFarmStateSchema.safeParse(gs.myfarm);
      // brought up to the current rules (levels, the order board…)
      return normalizeMyFarm(r.success && r.data.plots.length ? r.data : emptyMyFarm());
    };

    const saveFarm = (id: string, gs: Record<string, unknown>, farm: MyFarmState) => repo.updateUser(id, { gameState: { ...gs, myfarm: farm } });
    /** A chase the game server never reported (the thief left): the piece goes back, no fine. */
    const expirePending = async (id: string, gs: Record<string, unknown>, farm: MyFarmState) => {
      const p = farm.pending;
      if (!p || Date.now() - p.at < 3 * 60_000) return farm;
      await settle(id, p.id, 'gone');
      const u = await repo.getUser(id);
      return farmOf((u?.gameState ?? gs) as Record<string, unknown>);
    };
    /** The end of a steal: escaped (the thief keeps it), caught (back to the owner + a fine), gone (back, no fine). */
    async function settle(thiefId: string, chaseId: string, result: 'escaped' | 'caught' | 'gone') {
      const thief = await repo.getUser(thiefId);
      if (!thief) return null;
      const tgs = (thief.gameState ?? {}) as Record<string, unknown>;
      const tf = farmOf(tgs);
      const p = tf.pending;
      if (!p || p.id !== chaseId) return null;
      tf.pending = null;
      const owner = await repo.getUser(p.owner);
      const ogs = (owner?.gameState ?? {}) as Record<string, unknown>;
      const of = farmOf(ogs);
      const value = pieceValue(p.crop);
      let fine = 0;
      if (result === 'escaped') {
        tf.barn[p.crop] = (tf.barn[p.crop] ?? 0) + 1;
        farmLog(tf, `You took ${p.crop === 'strawberry' ? 'a strawberry' : `a ${p.crop}`} from ${owner?.name ?? 'a farm'} and got away!`);
        if (owner) farmLog(of, `${thief.name} took a ${p.crop} from your farm and got away.`);
      } else {
        if (owner) of.barn[p.crop] = (of.barn[p.crop] ?? 0) + 1;
        if (result === 'caught') {
          fine = Math.min(stealFine(value), Math.max(0, thief.coins));
          farmLog(tf, `${of.dog?.name ?? 'The dog'} caught you on ${owner?.name ?? 'a'}'s farm! You paid ${fine} coins.`);
          if (owner) farmLog(of, `${of.dog?.name ?? 'Your dog'} caught ${thief.name} stealing a ${p.crop}! ${thief.name} paid you ${fine} coins.`);
        }
      }
      await saveFarm(thiefId, tgs, tf);
      if (owner) await saveFarm(owner.id, ogs, of);
      if (fine && owner) {
        await repo.updateUser(thiefId, { coins: thief.coins - fine });
        await repo.reward(owner.id, 0, fine, 'farm_fine');
        await repo.logEvent({ name: 'coins_spent', playerId: thiefId, props: { source: 'farm_fine', coins: fine } });
      }
      await repo.logEvent({ name: 'myfarm_chase', playerId: thiefId, props: { result, fine, owner: p.owner } });
      return { result, fine, crop: p.crop };
    }

    app.get('/me/myfarm', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      const u = await repo.ensureUser(id, (await repo.getUser(id))?.name ?? 'Guest');
      const gs = (u.gameState ?? {}) as Record<string, unknown>;
      const farm = await expirePending(id, gs, farmOf(gs));
      return { farm, coins: u.coins, now: Date.now(), day: today() };
    });

    /**
     * Take one piece from a friend's ripe plot. No dog awake: you just get it. A dog awake: the chase is on - the
     * answer carries a signed ticket for the game server, which runs the dog and reports the end (/internal/farm-chase).
     */
    app.post<{ Params: { id: string } }>('/farms/:id/steal', async (req, reply) => {
      const me = who(req);
      if (!me) return reply.code(401).send({ error: 'unauthorized' });
      if (!(await limiter.allow(`steal:${me}`, 20))) return reply.code(429).send({ error: 'rate_limited' });
      const body = z.object({ plot: z.number().int().min(0).max(40) }).safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request' });
      const owner = await repo.getUser(req.params.id);
      const thief = await repo.getUser(me);
      if (!owner || !thief || owner.id === thief.id) return reply.code(404).send({ error: 'not_found' });
      // accounts only (no guests), level 3 and up, friends only
      if (!owner.email || !thief.email) return reply.code(403).send({ error: 'steal_guest' });
      if (levelForXp(owner.xp) < STEAL_MIN_LEVEL || levelForXp(thief.xp) < STEAL_MIN_LEVEL) return reply.code(403).send({ error: 'steal_level' });
      const [a, b] = pair(me, owner.id);
      if ((await friendRepo().get(a, b))?.status !== 'accepted') return reply.code(403).send({ error: 'friends_only' });
      const day = today();
      const ogs = (owner.gameState ?? {}) as Record<string, unknown>;
      const tgs = (thief.gameState ?? {}) as Record<string, unknown>;
      const tf = await expirePending(me, tgs, farmOf(tgs));
      if (tf.pending) return reply.code(409).send({ error: 'steal_busy' });
      if (!canSteal(tf, day)) return reply.code(409).send({ error: 'steal_limit' });
      const of = farmOf(ogs);
      if (of.visits === 'closed') return reply.code(403).send({ error: 'closed' });
      const r = stealFrom(of, body.data.plot, Date.now(), day);
      if ('error' in r) return reply.code(409).send({ error: `steal_${r.error}` });
      tf.stole = [day, (tf.stole[0] === day ? tf.stole[1] : 0) + 1];
      const awake = dogAwake(r.farm, day);
      if (!awake) {
        tf.barn[r.crop] = (tf.barn[r.crop] ?? 0) + 1;
        farmLog(r.farm, `Somebody took a ${r.crop} from your farm. A dog could stop them!`);
        await saveFarm(owner.id, ogs, r.farm);
        await saveFarm(me, tgs, tf);
        await repo.logEvent({ name: 'myfarm_steal', playerId: me, props: { owner: owner.id, dog: false } });
        return { got: r.crop };
      }
      const id = randomUUID();
      tf.pending = { id, owner: owner.id, crop: r.crop, at: Date.now() };
      farmLog(r.farm, `${owner.name === thief.name ? 'Somebody' : thief.name} tried to take a ${r.crop}! ${r.farm.dog!.name} ran after them.`);
      await saveFarm(owner.id, ogs, r.farm);
      await saveFarm(me, tgs, tf);
      const level = dogLevel(r.farm.dog!.train);
      const ticket = signToken(env.AUTH_SECRET, 'chase', 180, { id, thief: me, owner: owner.id, speed: dogSpeed(level) });
      await repo.logEvent({ name: 'myfarm_steal', playerId: me, props: { owner: owner.id, dog: true, level } });
      return { chase: ticket, crop: r.crop, dog: { name: r.farm.dog!.name, level, speed: dogSpeed(level) } };
    });

    /** The game server: how a chase ended. */
    app.post('/internal/farm-chase', async (req, reply) => {
      if (!isInternalKey(env.AUTH_SECRET, req.headers['x-internal-key'])) return reply.code(403).send({ error: 'forbidden' });
      const body = z.object({ id: z.string().max(64), thief: z.string().max(64), result: z.enum(['escaped', 'caught']) }).safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request' });
      const r = await settle(body.data.thief, body.data.id, body.data.result);
      return r ?? { result: 'unknown' };
    });

    app.post('/me/myfarm', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      if (!(await limiter.allow(`myfarm:${id}`, 60))) return reply.code(429).send({ error: 'rate_limited' });
      const body = MyFarmActionSchema.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request' });
      const u = await repo.ensureUser(id, (await repo.getUser(id))?.name ?? 'Guest');
      const gs = (u.gameState ?? {}) as Record<string, unknown>;
      const r = applyMyFarm(farmOf(gs), body.data, Date.now(), u.coins, today());
      if (r.error) return { ...r, coins: u.coins, now: Date.now() };
      await repo.updateUser(id, { gameState: { ...gs, myfarm: r.farm } });
      if (r.coins < 0) {
        await repo.updateUser(id, { coins: u.coins + r.coins });
        await repo.logEvent({ name: 'coins_spent', playerId: id, props: { source: 'myfarm', coins: -r.coins, item: body.data.action === 'buy' ? body.data.item : '' } });
      }
      if (r.coins > 0 || r.xp) await repo.reward(id, r.xp, Math.max(0, r.coins), 'myfarm');
      // "water all" / "harvest all" count like one watering / harvest (journey steps)
      const ev = body.data.action === 'harvestAll' ? 'harvest' : body.data.action === 'waterAll' ? 'water' : body.data.action;
      await repo.logEvent({ name: `myfarm_${ev}`, playerId: id, props: { coins: r.coins, ...(body.data.action === 'buy' ? { item: body.data.item } : {}) } });
      if (r.levelUp) await repo.logEvent({ name: 'myfarm_level', playerId: id, props: { level: r.levelUp } });
      return { farm: r.farm, said: r.said, xp: r.xp, delta: r.coins, coins: u.coins + r.coins, now: Date.now(), levelUp: r.levelUp };
    });

    /** May `me` come in? (the owner's choice: friends, everybody, nobody) */
    const mayVisit = async (me: string | null, ownerId: string, farm: MyFarmState): Promise<'ok' | 'closed' | 'friends_only'> => {
      if (me === ownerId) return 'ok';
      if (farm.visits === 'closed') return 'closed';
      if (farm.visits === 'friends') {
        const [a, b] = pair(me ?? '', ownerId);
        const row = me ? await friendRepo().get(a, b) : null;
        if (row?.status !== 'accepted') return 'friends_only';
      }
      return 'ok';
    };
    const count = (p: [string, number], day: string) => (p[0] === day ? p[1] : 0);

    /** A visitor waters a seeded plot for the owner (both get a line on their board, the visitor a little XP). */
    app.post<{ Params: { id: string } }>('/farms/:id/help', async (req, reply) => {
      const me = who(req);
      if (!me) return reply.code(401).send({ error: 'unauthorized' });
      if (!(await limiter.allow(`farmhelp:${me}`, 30))) return reply.code(429).send({ error: 'rate_limited' });
      const body = z.object({ plot: z.number().int().min(0).max(40) }).safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request' });
      const owner = await repo.getUser(req.params.id);
      const helper = await repo.ensureUser(me, (await repo.getUser(me))?.name ?? 'Guest');
      if (!owner || owner.id === me) return reply.code(404).send({ error: 'not_found' });
      const ogs = (owner.gameState ?? {}) as Record<string, unknown>;
      const of = farmOf(ogs);
      const ok = await mayVisit(me, owner.id, of);
      if (ok !== 'ok') return reply.code(403).send({ error: ok });
      const day = today();
      const hgs = (helper.gameState ?? {}) as Record<string, unknown>;
      const hf = farmOf(hgs);
      if (count(hf.helped, day) >= HELPS_PER_DAY) return reply.code(409).send({ error: 'help_limit' });
      const p = of.plots[body.data.plot];
      if (!p?.crop || p.wateredAt) return reply.code(409).send({ error: 'help_nothing' });
      p.wateredAt = Date.now();
      farmLog(of, `${helper.name} watered your ${p.crop === 'corn' ? 'corn' : `${p.crop}s`}. How kind!`);
      hf.helped = [day, count(hf.helped, day) + 1];
      await saveFarm(owner.id, ogs, of);
      await saveFarm(me, hgs, hf);
      await repo.reward(me, 3, 0, 'farm_help');
      await repo.logEvent({ name: 'myfarm_help', playerId: me, props: { owner: owner.id } });
      return { plot: p, said: `I watered ${owner.name}'s ${p.crop === 'corn' ? 'corn' : `${p.crop}s`}.` };
    });

    /** A visitor leaves a note on the farm's notice board. */
    app.post<{ Params: { id: string } }>('/farms/:id/note', async (req, reply) => {
      const me = who(req);
      if (!me) return reply.code(401).send({ error: 'unauthorized' });
      if (!(await limiter.allow(`farmnote:${me}`, 10))) return reply.code(429).send({ error: 'rate_limited' });
      const body = z.object({ text: z.string().min(2).max(80) }).safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request' });
      const owner = await repo.getUser(req.params.id);
      const writer = await repo.ensureUser(me, (await repo.getUser(me))?.name ?? 'Guest');
      if (!owner || owner.id === me) return reply.code(404).send({ error: 'not_found' });
      const ogs = (owner.gameState ?? {}) as Record<string, unknown>;
      const of = farmOf(ogs);
      const ok = await mayVisit(me, owner.id, of);
      if (ok !== 'ok') return reply.code(403).send({ error: ok });
      const day = today();
      const wgs = (writer.gameState ?? {}) as Record<string, unknown>;
      const wf = farmOf(wgs);
      if (count(wf.noted, day) >= NOTES_PER_DAY) return reply.code(409).send({ error: 'note_limit' });
      of.notes = [...of.notes, { t: Date.now(), name: writer.name.slice(0, 20), text: maskProfanity(body.data.text.trim()) }].slice(-NOTES_KEPT);
      wf.noted = [day, count(wf.noted, day) + 1];
      await saveFarm(owner.id, ogs, of);
      await saveFarm(me, wgs, wf);
      await repo.logEvent({ name: 'myfarm_note', playerId: me, props: { owner: owner.id } });
      return { notes: of.notes };
    });

    /** Somebody's farm, for a visitor: friends only, everyone, or closed (the owner chooses). */
    app.get<{ Params: { id: string } }>('/farms/:id', async (req, reply) => {
      const me = who(req);
      const owner = await repo.getUser(req.params.id);
      if (!owner) return reply.code(404).send({ error: 'not_found' });
      const farm = farmOf((owner.gameState ?? {}) as Record<string, unknown>);
      if (me !== owner.id) {
        if (farm.visits === 'closed') return reply.code(403).send({ error: 'closed' });
        if (farm.visits === 'friends') {
          const [a, b] = pair(me ?? '', owner.id);
          const row = me ? await friendRepo().get(a, b) : null;
          if (row?.status !== 'accepted') return reply.code(403).send({ error: 'friends_only' });
        }
      }
      // journey: "visit a friend's farm"
      if (me && me !== owner.id) await repo.logEvent({ name: 'myfarm_visit', playerId: me, props: { owner: owner.id } });
      const view: FarmView = { owner: owner.id, name: owner.name, fields: farm.fields, plots: farm.plots, animals: farm.animals, visits: farm.visits, notes: farm.notes, decor: farm.decor, dog: farm.dog ? { name: farm.dog.name, level: dogLevel(farm.dog.train), awake: dogAwake(farm, today()) } : null };
      return { farm: view, now: Date.now() };
    });
  };
}
