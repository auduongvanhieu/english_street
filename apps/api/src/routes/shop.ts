import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { HOTEL_MAX_NIGHTS, HOTEL_NIGHT_PRICE, MINIBAR, MINIBAR_MAX, hotelRoomFor, type HotelBill, type HotelStay } from '@es/shared';
import type { AttemptRepo } from '../npc/attempts';
import { playerIdFrom } from '../auth';
import { limiter } from '../npc/ratelimit';

/**
 * Things in the areas that cost coins, kept in User.gameState:
 *  - hotel: check in (first stay free), minibar, the bill (sometimes with one wrong line to spot), check out.
 * Prices live in @es/shared (shop.ts); the server is the only one that charges.
 */
interface ShopState {
  hotel?: HotelStay & { bill?: { wrong: number } };
  hotelFreeUsed?: boolean;
}

export function shopRoutes(repo: AttemptRepo) {
  return async function routes(app: FastifyInstance) {
    const who = (req: { authPlayerId: string | null; query: unknown; body?: unknown }) =>
      playerIdFrom(req as never, (req.query as { playerId?: string })?.playerId ?? (req.body as { playerId?: string } | undefined)?.playerId);
    const load = async (id: string) => {
      const u = await repo.ensureUser(id, (await repo.getUser(id))?.name ?? 'Guest');
      const gs = (u.gameState ?? {}) as Record<string, unknown> & ShopState;
      return { u, gs };
    };
    const save = (id: string, gs: Record<string, unknown>) => repo.updateUser(id, { gameState: gs });

    app.get('/me/hotel', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      const { gs, u } = await load(id);
      return { stay: gs.hotel ? strip(gs.hotel) : null, room: hotelRoomFor(id), price: HOTEL_NIGHT_PRICE, free: !gs.hotelFreeUsed, coins: u.coins };
    });

    app.post('/me/hotel/checkin', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      if (!(await limiter.allow(`hotel:${id}`, 20))) return reply.code(429).send({ error: 'rate_limited' });
      const body = z.object({ nights: z.number().int().min(1).max(HOTEL_MAX_NIGHTS) }).safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request' });
      const { u, gs } = await load(id);
      if (gs.hotel) return { stay: strip(gs.hotel), coins: u.coins };
      const free = !gs.hotelFreeUsed;
      const cost = free ? 0 : body.data.nights * HOTEL_NIGHT_PRICE;
      if (u.coins < cost) return reply.code(402).send({ error: 'not_enough_coins' });
      const stay: HotelStay = { room: hotelRoomFor(id), nights: body.data.nights, since: Date.now(), minibar: [], nightPrice: free ? 0 : HOTEL_NIGHT_PRICE };
      await save(id, { ...gs, hotel: stay, hotelFreeUsed: true });
      if (cost) {
        await repo.updateUser(id, { coins: u.coins - cost });
        await repo.logEvent({ name: 'coins_spent', playerId: id, props: { source: 'hotel', coins: cost } });
      }
      await repo.logEvent({ name: 'hotel_checkin', playerId: id, props: { room: stay.room, nights: stay.nights, free } });
      return { stay, coins: u.coins - cost, free };
    });

    app.post('/me/hotel/minibar', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      const body = z.object({ item: z.string().max(20) }).safeParse(req.body);
      if (!body.success || !MINIBAR.some((m) => m.id === body.data.item)) return reply.code(400).send({ error: 'bad_request' });
      const { gs } = await load(id);
      if (!gs.hotel) return reply.code(409).send({ error: 'no_stay' });
      if (gs.hotel.minibar.length >= MINIBAR_MAX) return reply.code(409).send({ error: 'minibar_empty' });
      const hotel = { ...gs.hotel, minibar: [...gs.hotel.minibar, body.data.item], bill: undefined };
      await save(id, { ...gs, hotel });
      return { stay: strip(hotel) };
    });

    // The bill at the desk. Half the time one line is wrong (an item the guest never took, or a wrong quantity):
    // spotting it is the reading exercise. The answer is kept server-side until check-out.
    app.get('/me/hotel/bill', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      const { gs } = await load(id);
      if (!gs.hotel) return reply.code(409).send({ error: 'no_stay' });
      const real = billLines(gs.hotel);
      let wrong = gs.hotel.bill?.wrong;
      if (wrong === undefined) {
        wrong = Math.random() < 0.5 ? -1 : Math.floor(Math.random() * (real.length + 1));
        await save(id, { ...gs, hotel: { ...gs.hotel, bill: { wrong } } });
      }
      return { bill: shownBill(gs.hotel, real, wrong) };
    });

    app.post('/me/hotel/checkout', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      const body = z.object({ disputed: z.number().int().min(-1).max(20) }).safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request' });
      const { u, gs } = await load(id);
      if (!gs.hotel) return reply.code(409).send({ error: 'no_stay' });
      const real = billLines(gs.hotel);
      const wrong = gs.hotel.bill?.wrong ?? -1;
      const correct = body.data.disputed === wrong;
      // the guest pays the real minibar total (nights were paid at check-in); a correct check earns XP
      const due = real.filter((l) => !l.en.startsWith(NIGHT_LINE)).reduce((s, l) => s + l.qty * l.price, 0);
      const pay = Math.min(due, u.coins);
      const xp = correct ? 15 : 0;
      const rest: Record<string, unknown> = { ...gs };
      delete rest.hotel;
      await save(id, rest);
      if (pay) await repo.updateUser(id, { coins: u.coins - pay });
      if (xp) await repo.reward(id, xp, 0, 'hotel');
      await repo.logEvent({ name: 'hotel_checkout', playerId: id, props: { correct, paid: pay } });
      return { correct, wrong, paid: pay, xp, coins: u.coins - pay + 0 };
    });
  };
}

const NIGHT_LINE = 'Room (per night)';
function billLines(h: HotelStay) {
  const lines = [{ en: h.nightPrice === 0 ? `${NIGHT_LINE} - first stay free` : NIGHT_LINE, qty: h.nights, price: h.nightPrice ?? HOTEL_NIGHT_PRICE }];
  const counts = new Map<string, number>();
  for (const m of h.minibar) counts.set(m, (counts.get(m) ?? 0) + 1);
  for (const [mid, qty] of counts) {
    const m = MINIBAR.find((x) => x.id === mid)!;
    lines.push({ en: `Minibar: ${m.en}`, qty, price: m.price });
  }
  return lines;
}
/** The bill as shown: `wrong` = index of the line that is wrong (an extra item, or a changed quantity), -1 = all fine. */
function shownBill(h: HotelStay, real: { en: string; qty: number; price: number }[], wrong: number): HotelBill {
  const lines = real.map((l) => ({ ...l }));
  if (wrong >= 0) {
    if (wrong < lines.length && !lines[wrong]!.en.startsWith(NIGHT_LINE)) lines[wrong]!.qty += 1;
    else {
      const taken = new Set(h.minibar);
      const extra = MINIBAR.find((m) => !taken.has(m.id)) ?? MINIBAR[0]!;
      lines.splice(Math.min(wrong, lines.length), 0, { en: `Minibar: ${extra.en}`, qty: 1, price: extra.price });
    }
  }
  return { room: h.room, lines, total: lines.reduce((s, l) => s + l.qty * l.price, 0) };
}
const strip = (h: HotelStay & { bill?: unknown }): HotelStay => ({ room: h.room, nights: h.nights, since: h.since, minibar: h.minibar, nightPrice: h.nightPrice });
