import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { BOOK_XP_PER_CHAPTER, CLUB_COINS, CLUB_GOAL, CLUB_NOTE_MAX, CLUB_QUESTIONS, clubBookId, clubWeek, clubWeekStart, hasProfanity, type BookClub, type BookClubNote, type MyBooks } from '@es/shared';
import { bookCards, getBook } from '@es/quests';
import type { AttemptRepo } from '../npc/attempts';
import { playerIdFrom } from '../auth';
import { limiter } from '../npc/ratelimit';

/**
 * Library / bookshop: the shelf (book cards), a book's text, buying a copy for your shelf at home, and the chapter
 * quizzes (XP once per chapter, the answers are checked here). State in User.gameState.books.
 */
/** My book club progress this week (User.gameState.club). */
interface MyClub {
  week: number;
  chapters: number[];
  claimed: boolean;
}

export function bookRoutes(repo: AttemptRepo) {
  /** This week's members and notes, read once from the event log, then kept up to date in memory. */
  let club: { week: number; members: Map<string, string>; notes: BookClubNote[] } | null = null;
  const clubState = async (week: number) => {
    if (club?.week === week) return club;
    const members = new Map<string, string>();
    const notes: BookClubNote[] = [];
    for (const e of await repo.listEventsSince(new Date(clubWeekStart(week)))) {
      if (e.props?.week !== week || !e.playerId) continue;
      if (e.name === 'book_club') members.set(e.playerId, String(e.props.who ?? 'Guest'));
      if (e.name === 'book_club_note') notes.push({ name: String(e.props.who ?? 'Guest'), text: String(e.props.text ?? ''), at: e.createdAt.getTime() });
    }
    club = { week, members, notes };
    return club;
  };
  const clubBook = (week: number) => {
    const cards = bookCards();
    // A1 - B1 books (most players), one a week
    const id = clubBookId(cards.filter((c) => c.level !== 'B2').map((c) => c.id), week);
    return cards.find((c) => c.id === id)!;
  };

  return async function routes(app: FastifyInstance) {
    const who = (req: { authPlayerId: string | null; query: unknown; body?: unknown }) =>
      playerIdFrom(req as never, (req.query as { playerId?: string })?.playerId ?? (req.body as { playerId?: string } | undefined)?.playerId);
    const load = async (id: string) => {
      const u = await repo.ensureUser(id, (await repo.getUser(id))?.name ?? 'Guest');
      const gs = (u.gameState ?? {}) as Record<string, unknown> & { books?: MyBooks };
      return { u, gs, books: { owned: gs.books?.owned ?? [], done: gs.books?.done ?? {} } as MyBooks };
    };

    app.get('/books', async () => ({ books: bookCards() }));
    app.get<{ Params: { id: string } }>('/books/:id', async (req, reply) => {
      const b = getBook(req.params.id);
      if (!b) return reply.code(404).send({ error: 'not_found' });
      // the answers stay on the server
      return { book: { ...b, chapters: b.chapters.map((c) => ({ ...c, questions: c.questions.map(({ q, options }) => ({ q, options })) })) } };
    });

    /** The weekly book club: the book of the week, my progress, who joined, notes about the book. */
    app.get('/books/club', async (req) => {
      const id = who(req);
      const week = clubWeek(Date.now());
      const st = await clubState(week);
      let mine: MyClub = { week, chapters: [], claimed: false };
      if (id) {
        const { gs } = await load(id);
        const c = gs.club as MyClub | undefined;
        if (c?.week === week) mine = c;
      }
      const out: BookClub = {
        week,
        endsIn: clubWeekStart(week + 1) - Date.now(),
        book: clubBook(week),
        mine: mine.chapters,
        claimed: mine.claimed,
        members: [...st.members.values()].reverse().slice(0, 30),
        notes: [...st.notes].reverse().slice(0, 30),
        question: CLUB_QUESTIONS[week % CLUB_QUESTIONS.length]!,
      };
      return out;
    });

    app.post('/me/books/club/note', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      if (!(await limiter.allow(`clubnote:${id}`, 3))) return reply.code(429).send({ error: 'rate_limited' });
      const body = z.object({ text: z.string().trim().min(3).max(CLUB_NOTE_MAX) }).safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request' });
      if (hasProfanity(body.data.text)) return reply.code(400).send({ error: 'profanity' });
      const week = clubWeek(Date.now());
      const st = await clubState(week);
      // members only: pass a chapter quiz of the book of the week first
      if (!st.members.has(id)) return reply.code(403).send({ error: 'not_member' });
      const { u } = await load(id);
      const note: BookClubNote = { name: u.name, text: body.data.text, at: Date.now() };
      st.notes.push(note);
      if (st.notes.length > 200) st.notes.splice(0, st.notes.length - 200);
      await repo.logEvent({ name: 'book_club_note', playerId: id, props: { week, who: u.name, text: note.text } });
      return { ok: true, note };
    });

    app.get('/me/books', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      return (await load(id)).books;
    });

    app.post('/me/books/buy', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      if (!(await limiter.allow(`books:${id}`, 20))) return reply.code(429).send({ error: 'rate_limited' });
      const body = z.object({ book: z.string().max(40) }).safeParse(req.body);
      const book = body.success ? getBook(body.data.book) : null;
      if (!book) return reply.code(400).send({ error: 'bad_request' });
      const { u, gs, books } = await load(id);
      if (books.owned.includes(book.id)) return { ...books, coins: u.coins };
      if (u.coins < book.price) return reply.code(402).send({ error: 'not_enough_coins' });
      const paid = book.price ? await repo.spend(id, book.price, 'book') : { balance: u.coins, paid: 0 };
      if (!paid) return reply.code(402).send({ error: 'not_enough_coins' });
      const next: MyBooks = { ...books, owned: [...books.owned, book.id] };
      await repo.updateUser(id, { gameState: { ...gs, books: next } });
      await repo.logEvent({ name: 'book_bought', playerId: id, props: { book: book.id } });
      return { ...next, coins: paid.balance };
    });

    app.post('/me/books/quiz', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      if (!(await limiter.allow(`bookquiz:${id}`, 30))) return reply.code(429).send({ error: 'rate_limited' });
      const body = z.object({ book: z.string().max(40), chapter: z.number().int().min(0).max(5), answers: z.array(z.number().int().min(0).max(2)).length(3) }).safeParse(req.body);
      const book = body.success ? getBook(body.data.book) : null;
      const ch = book && body.success ? book.chapters[body.data.chapter] : undefined;
      if (!book || !ch || !body.success) return reply.code(400).send({ error: 'bad_request' });
      const right = ch.questions.map((q, i) => q.answer === body.data.answers[i]);
      const correct = right.filter(Boolean).length;
      const { gs, books } = await load(id);
      const already = (books.done[book.id] ?? []).includes(body.data.chapter);
      const passed = correct >= 2;
      let xp = 0;
      let state = gs;
      if (passed && !already) {
        xp = BOOK_XP_PER_CHAPTER + (correct === 3 ? 2 : 0);
        const next: MyBooks = { ...books, done: { ...books.done, [book.id]: [...(books.done[book.id] ?? []), body.data.chapter] } };
        state = { ...gs, books: next };
        await repo.updateUser(id, { gameState: state });
        await repo.reward(id, xp, 0, 'book');
      }
      // the book of the week: book club progress (re-reading a chapter counts too), the bonus at CLUB_GOAL chapters
      let clubCoins = 0;
      const week = clubWeek(Date.now());
      if (passed && book.id === clubBook(week).id) {
        const prev = state.club as MyClub | undefined;
        const c: MyClub = prev?.week === week ? prev : { week, chapters: [], claimed: false };
        if (!c.chapters.includes(body.data.chapter)) {
          const next: MyClub = { ...c, chapters: [...c.chapters, body.data.chapter].sort() };
          if (!next.claimed && next.chapters.length >= Math.min(CLUB_GOAL, book.chapters.length)) {
            next.claimed = true;
            clubCoins = CLUB_COINS;
          }
          await repo.updateUser(id, { gameState: { ...state, club: next } });
          if (clubCoins) await repo.reward(id, 0, clubCoins, 'book_club');
          const st = await clubState(week);
          const name = (await repo.getUser(id))?.name ?? 'Guest';
          if (!st.members.has(id)) {
            st.members.set(id, name);
            await repo.logEvent({ name: 'book_club', playerId: id, props: { week, who: name, book: book.id } });
          }
        }
      }
      await repo.logEvent({ name: 'book_quiz', playerId: id, props: { book: book.id, chapter: body.data.chapter, correct } });
      return { right, correct, passed, xp, clubCoins, answers: ch.questions.map((q) => q.answer) };
    });
  };
}
