import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { BOOK_XP_PER_CHAPTER, type MyBooks } from '@es/shared';
import { bookCards, getBook } from '@es/quests';
import type { AttemptRepo } from '../npc/attempts';
import { playerIdFrom } from '../auth';
import { limiter } from '../npc/ratelimit';

/**
 * Library / bookshop: the shelf (book cards), a book's text, buying a copy for your shelf at home, and the chapter
 * quizzes (XP once per chapter, the answers are checked here). State in User.gameState.books.
 */
export function bookRoutes(repo: AttemptRepo) {
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
      const next: MyBooks = { ...books, owned: [...books.owned, book.id] };
      await repo.updateUser(id, { gameState: { ...gs, books: next }, coins: u.coins - book.price });
      if (book.price) await repo.logEvent({ name: 'coins_spent', playerId: id, props: { source: 'book', coins: book.price } });
      await repo.logEvent({ name: 'book_bought', playerId: id, props: { book: book.id } });
      return { ...next, coins: u.coins - book.price };
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
      if (passed && !already) {
        xp = BOOK_XP_PER_CHAPTER + (correct === 3 ? 2 : 0);
        const next: MyBooks = { ...books, done: { ...books.done, [book.id]: [...(books.done[book.id] ?? []), body.data.chapter] } };
        await repo.updateUser(id, { gameState: { ...gs, books: next } });
        await repo.reward(id, xp, 0, 'book');
      }
      await repo.logEvent({ name: 'book_quiz', playerId: id, props: { book: book.id, chapter: body.data.chapter, correct } });
      return { right, correct, passed, xp, answers: ch.questions.map((q) => q.answer) };
    });
  };
}
