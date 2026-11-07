import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { TAXI_PRICE, FURNITURE_MAX, PlacedSchema, ROOM_MAX_ITEMS, furniture, type RoomState, BOAT_HIRE, HOTEL_MAX_NIGHTS, HOTEL_NIGHT_PRICE, SUITE_NIGHT_PRICE, PREMIUM_PRICES, type PremiumItem, MINIBAR, MINIBAR_MAX, hotelRoomFor, type HotelBill, type HotelStay } from '@es/shared';
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
  /** river boat hire: valid until (ms); first hire free */
  boatUntil?: number;
  boatFreeUsed?: boolean;
  /** "My room": furniture owned (count per id) and placed */
  room?: RoomState;
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

    // A taxi ride: pay and go straight there (the game moves you)
    app.post('/me/taxi', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      if (!(await limiter.allow(`taxi:${id}`, 20))) return reply.code(429).send({ error: 'rate_limited' });
      const { u } = await load(id);
      if (u.coins < TAXI_PRICE) return reply.code(402).send({ error: 'not_enough_coins' });
      await repo.updateUser(id, { coins: u.coins - TAXI_PRICE });
      await repo.logEvent({ name: 'coins_spent', playerId: id, props: { source: 'taxi', coins: TAXI_PRICE } });
      await repo.logEvent({ name: 'taxi_ride', playerId: id, props: {} });
      return { coins: u.coins - TAXI_PRICE };
    });

    // River boat hire at the north pier: a hire lasts BOAT_HIRE.minutes; the first one is free.
    app.get('/me/boat', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      const { gs } = await load(id);
      return { until: gs.boatUntil && gs.boatUntil > Date.now() ? gs.boatUntil : 0, price: BOAT_HIRE.coins, minutes: BOAT_HIRE.minutes, free: !gs.boatFreeUsed };
    });

    app.post('/me/boat/hire', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      if (!(await limiter.allow(`boat:${id}`, 20))) return reply.code(429).send({ error: 'rate_limited' });
      const { u, gs } = await load(id);
      const now = Date.now();
      if (gs.boatUntil && gs.boatUntil > now) return { until: gs.boatUntil, coins: u.coins, free: false };
      const free = !gs.boatFreeUsed;
      const cost = free ? 0 : BOAT_HIRE.coins;
      if (u.coins < cost) return reply.code(402).send({ error: 'not_enough_coins' });
      const until = now + BOAT_HIRE.minutes * 60_000;
      await save(id, { ...gs, boatUntil: until, boatFreeUsed: true });
      if (cost) {
        await repo.updateUser(id, { coins: u.coins - cost });
        await repo.logEvent({ name: 'coins_spent', playerId: id, props: { source: 'boat', coins: cost } });
      }
      await repo.logEvent({ name: 'boat_hire', playerId: id, props: { free } });
      return { until, coins: u.coins - cost, free };
    });

    // ---- My room: buy furniture, save where it stands, let friends look ----
    const roomOf = (gs: ShopState): RoomState => ({ owned: gs.room?.owned ?? {}, items: gs.room?.items ?? [] });
    app.get('/me/room', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      const { gs, u } = await load(id);
      return { ...roomOf(gs), coins: u.coins };
    });
    app.post('/me/room/buy', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      if (!(await limiter.allow(`room:${id}`, 30))) return reply.code(429).send({ error: 'rate_limited' });
      const body = z.object({ item: z.string().max(20) }).safeParse(req.body);
      const f = body.success ? furniture(body.data.item) : undefined;
      if (!f) return reply.code(400).send({ error: 'bad_request' });
      const { u, gs } = await load(id);
      const room = roomOf(gs);
      if ((room.owned[f.id] ?? 0) >= FURNITURE_MAX) return reply.code(409).send({ error: 'too_many' });
      if (u.coins < f.price) return reply.code(402).send({ error: 'not_enough_coins' });
      room.owned = { ...room.owned, [f.id]: (room.owned[f.id] ?? 0) + 1 };
      await save(id, { ...gs, room });
      await repo.updateUser(id, { coins: u.coins - f.price });
      await repo.logEvent({ name: 'coins_spent', playerId: id, props: { source: 'furniture', coins: f.price } });
      await repo.logEvent({ name: 'home_buy', playerId: id, props: { item: f.id } });
      return { ...room, coins: u.coins - f.price };
    });
    app.post('/me/room/save', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      if (!(await limiter.allow(`roomsave:${id}`, 60))) return reply.code(429).send({ error: 'rate_limited' });
      const body = z.object({ items: z.array(PlacedSchema).max(ROOM_MAX_ITEMS) }).safeParse(req.body);
      if (!body.success || body.data.items.some((p) => !furniture(p.id))) return reply.code(400).send({ error: 'bad_request' });
      const { gs } = await load(id);
      const room = roomOf(gs);
      const used: Record<string, number> = {};
      for (const p of body.data.items) used[p.id] = (used[p.id] ?? 0) + 1;
      if (Object.entries(used).some(([k, n]) => n > (room.owned[k] ?? 0))) return reply.code(409).send({ error: 'not_owned' });
      const placedBefore = room.items.length;
      room.items = body.data.items;
      await save(id, { ...gs, room });
      if (room.items.length > placedBefore) await repo.logEvent({ name: 'home_place', playerId: id, props: { count: room.items.length } });
      return room;
    });
    /** A friend's room (anyone can look: it is only furniture). */
    app.get<{ Params: { id: string } }>('/rooms/:id', async (req, reply) => {
      const u = await repo.getUser(req.params.id);
      if (!u) return reply.code(404).send({ error: 'not_found' });
      return { name: u.name, items: roomOf((u.gameState ?? {}) as ShopState).items };
    });

    // premium tickets: pay the coins, the game gives the seat (cinema VIP row, first class on the train)
    app.post('/me/premium', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      if (!(await limiter.allow(`premium:${id}`, 20))) return reply.code(429).send({ error: 'rate_limited' });
      const body = z.object({ item: z.enum(Object.keys(PREMIUM_PRICES) as [PremiumItem, ...PremiumItem[]]) }).safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request' });
      const price = PREMIUM_PRICES[body.data.item];
      const { u } = await load(id);
      if (u.coins < price) return reply.code(402).send({ error: 'not_enough_coins' });
      await repo.updateUser(id, { coins: u.coins - price });
      await repo.logEvent({ name: 'coins_spent', playerId: id, props: { source: body.data.item, coins: price } });
      return { coins: u.coins - price };
    });

    app.get('/me/hotel', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      const { gs, u } = await load(id);
      return { stay: gs.hotel ? strip(gs.hotel) : null, room: hotelRoomFor(id), price: HOTEL_NIGHT_PRICE, suitePrice: SUITE_NIGHT_PRICE, free: !gs.hotelFreeUsed, coins: u.coins };
    });

    app.post('/me/hotel/checkin', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      if (!(await limiter.allow(`hotel:${id}`, 20))) return reply.code(429).send({ error: 'rate_limited' });
      const body = z.object({ nights: z.number().int().min(1).max(HOTEL_MAX_NIGHTS), suite: z.boolean().optional() }).safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request' });
      const { u, gs } = await load(id);
      if (gs.hotel) return { stay: strip(gs.hotel), coins: u.coins };
      const suite = !!body.data.suite;
      // the free first stay is a standard room; a suite is always paid
      const free = !suite && !gs.hotelFreeUsed;
      const night = suite ? SUITE_NIGHT_PRICE : free ? 0 : HOTEL_NIGHT_PRICE;
      const cost = body.data.nights * night;
      if (u.coins < cost) return reply.code(402).send({ error: 'not_enough_coins' });
      const stay: HotelStay = { room: hotelRoomFor(id), nights: body.data.nights, since: Date.now(), minibar: [], nightPrice: night, ...(suite ? { suite: true } : {}) };
      await save(id, { ...gs, hotel: stay, hotelFreeUsed: gs.hotelFreeUsed || free });
      if (cost) {
        await repo.updateUser(id, { coins: u.coins - cost });
        await repo.logEvent({ name: 'coins_spent', playerId: id, props: { source: 'hotel', coins: cost } });
      }
      await repo.logEvent({ name: 'hotel_checkin', playerId: id, props: { room: stay.room, nights: stay.nights, free, suite } });
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
      const due = real.filter((l) => !l.en.startsWith(NIGHT_LINE) && !l.en.startsWith(SUITE_LINE)).reduce((s, l) => s + l.qty * l.price, 0);
      const pay = Math.min(due, u.coins);
      const xp = correct ? 15 : 0;
      const rest: Record<string, unknown> = { ...gs };
      delete rest.hotel;
      await save(id, rest);
      if (pay) {
        await repo.updateUser(id, { coins: u.coins - pay });
        await repo.logEvent({ name: 'coins_spent', playerId: id, props: { source: 'hotel_minibar', coins: pay } });
      }
      if (xp) await repo.reward(id, xp, 0, 'hotel');
      await repo.logEvent({ name: 'hotel_checkout', playerId: id, props: { correct, paid: pay } });
      return { correct, wrong, paid: pay, xp, coins: u.coins - pay + 0 };
    });
  };
}

const NIGHT_LINE = 'Room (per night)';
const SUITE_LINE = 'Suite (per night)';
function billLines(h: HotelStay) {
  const lines = [{ en: h.suite ? SUITE_LINE : h.nightPrice === 0 ? `${NIGHT_LINE} - first stay free` : NIGHT_LINE, qty: h.nights, price: h.nightPrice ?? HOTEL_NIGHT_PRICE }];
  const counts = new Map<string, number>();
  for (const m of h.minibar) counts.set(m, (counts.get(m) ?? 0) + 1);
  for (const [mid, qty] of counts) {
    const m = MINIBAR.find((x) => x.id === mid)!;
    lines.push({ en: `Minibar: ${m.en}${h.suite ? ' (included)' : ''}`, qty, price: h.suite ? 0 : m.price });
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
