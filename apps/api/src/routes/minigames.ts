import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { MINIGAMES, type MinigameId } from '@es/shared';
import type { AttemptRepo } from '../npc/attempts';
import { playerIdFrom } from '../auth';
import { limiter } from '../npc/ratelimit';

/**
 * Sports park minigames (football, hoops, race, "Coach says"): the client reports a result, the server turns it into
 * XP/coins with a daily cap per game (MINIGAMES in @es/shared), keeps the player's best in User.gameState and a
 * small in-memory board of today's best scores.
 */
interface MiniState {
  mini?: { day: string; plays: Partial<Record<MinigameId, number>>; best?: Partial<Record<MinigameId, number>> };
}
const lowerIsBetter = (g: MinigameId) => g === 'race';
type Entry = { id: string; name: string; score: number };
const board = new Map<string, Entry[]>(); // `${day}:${game}` -> sorted entries

function addToBoard(day: string, game: MinigameId, e: Entry) {
  const key = `${day}:${game}`;
  for (const k of board.keys()) if (!k.startsWith(day)) board.delete(k);
  const list = (board.get(key) ?? []).filter((x) => x.id !== e.id || (lowerIsBetter(game) ? x.score < e.score : x.score > e.score));
  if (!list.some((x) => x.id === e.id)) list.push(e);
  list.sort((a, b) => (lowerIsBetter(game) ? a.score - b.score : b.score - a.score));
  board.set(key, list.slice(0, 10));
}

const Body = z.object({
  game: z.enum(['football', 'hoops', 'race', 'coach', 'fishing', 'cooking', 'checkout', 'movie', 'train', 'class', 'clinic']),
  /** football: 'win' | 'draw' | 'lose' */
  result: z.enum(['win', 'draw', 'lose']).optional(),
  /** hoops: baskets (0-10); race: time in ms; coach: correct moves (0-8) */
  score: z.number().min(0).max(600_000).optional(),
});

export function minigameRoutes(repo: AttemptRepo) {
  return async function routes(app: FastifyInstance) {
    const who = (req: { authPlayerId: string | null; query: unknown; body?: unknown }) =>
      playerIdFrom(req as never, (req.query as { playerId?: string })?.playerId ?? (req.body as { playerId?: string } | undefined)?.playerId);

    app.get('/minigames/board', async (req) => {
      const game = (req.query as { game?: string }).game as MinigameId;
      if (!(game in MINIGAMES)) return { board: [] };
      const day = new Date().toISOString().slice(0, 10);
      return { board: (board.get(`${day}:${game}`) ?? []).map(({ name, score }) => ({ name, score })) };
    });

    app.post('/me/minigame', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      if (!(await limiter.allow(`mini:${id}`, 20))) return reply.code(429).send({ error: 'rate_limited' });
      const body = Body.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request' });
      const { game, result, score } = body.data;
      const u = await repo.ensureUser(id, (await repo.getUser(id))?.name ?? 'Guest');
      const gs = (u.gameState ?? {}) as Record<string, unknown> & MiniState;
      const day = new Date().toISOString().slice(0, 10);
      const mini = gs.mini?.day === day ? gs.mini : { day, plays: {}, best: gs.mini?.best ?? {} };
      const plays = mini.plays[game] ?? 0;
      const prevBest = mini.best?.[game];
      let xp = 0;
      let record = false;
      if (game === 'football') {
        const r = result ?? 'lose';
        xp = MINIGAMES.football[r];
      } else if (game === 'hoops') {
        const s = Math.min(10, Math.round(score ?? 0));
        xp = Math.min(MINIGAMES.hoops.max, s * MINIGAMES.hoops.perPoint);
        record = prevBest === undefined || s > prevBest;
      } else if (game === 'race') {
        // a 36 m sprint takes at least ~5 s at running speed: faster times are not real
        const ms = score ?? 0;
        if (ms < 5000) return reply.code(400).send({ error: 'bad_request' });
        record = prevBest === undefined || ms < prevBest;
        xp = record && prevBest !== undefined ? MINIGAMES.race.record : MINIGAMES.race.finish;
      } else if (game === 'cooking') {
        // score = steps done right first time (0-6)
        const s = Math.min(6, Math.max(0, Math.round(score ?? 0)));
        xp = Math.min(MINIGAMES.cooking.max, s * MINIGAMES.cooking.perPoint);
        record = prevBest === undefined || s > prevBest;
      } else if (game === 'checkout' || game === 'movie' || game === 'train' || game === 'class' || game === 'clinic') {
        const g = MINIGAMES[game];
        const s = Math.min(g.max / g.perPoint, Math.max(0, Math.round(score ?? 0)));
        xp = s * g.perPoint;
        record = prevBest === undefined || s > prevBest;
      } else if (game === 'fishing') {
        // score = how rare the catch was (1-5)
        const s = Math.min(5, Math.max(0, Math.round(score ?? 0)));
        xp = Math.min(MINIGAMES.fishing.max, s * MINIGAMES.fishing.perPoint);
      } else {
        const s = Math.min(8, Math.round(score ?? 0));
        xp = Math.min(MINIGAMES.coach.max, s * MINIGAMES.coach.perPoint);
        record = prevBest === undefined || s > prevBest;
      }
      const perDay = MINIGAMES[game].perDay;
      const capped = plays >= perDay;
      if (capped) xp = 0;
      const coins = xp ? Math.max(1, Math.round(xp / 4)) : 0;
      const s = game === 'football' || game === 'fishing' ? undefined : Math.round(score ?? 0);
      const best = { ...mini.best };
      if (s !== undefined && record) best[game] = s;
      await repo.updateUser(id, { gameState: { ...gs, mini: { day, plays: { ...mini.plays, [game]: plays + 1 }, best } } });
      if (xp || coins) await repo.reward(id, xp, coins, 'minigame');
      if (s !== undefined) addToBoard(day, game, { id, name: u.name, score: s });
      await repo.logEvent({ name: 'minigame_done', playerId: id, props: { game, result, score: s, xp } });
      return { xp, coins, capped, record: record && prevBest !== undefined, best: best[game] ?? null, left: Math.max(0, perDay - plays - 1) };
    });
  };
}
