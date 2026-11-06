import { create } from 'zustand';
import type { Book, BookCard, MyBooks } from '@es/shared';
import { bookQuiz, buyBook, fetchBook, fetchBooks, fetchMyBooks } from '../net/api';
import { track } from '../net/analytics';
import { useProfile } from './profile';

/**
 * Library / bookshop: the shelf (cards), the book being read (chapter, page), my copies and finished chapters.
 * `where`: 'library' = every book (read free), 'home' = my shelf at home (books I bought).
 */
interface BookStore {
  open: 'library' | 'home' | null;
  cards: BookCard[];
  mine: MyBooks;
  reading: Book | null;
  chapter: number;
  page: number;
  /** quiz at the end of the chapter */
  quiz: boolean;
  error: string | null;
  show: (where: 'library' | 'home') => Promise<void>;
  close: () => void;
  read: (id: string) => Promise<void>;
  setPage: (chapter: number, page: number) => void;
  buy: (id: string) => Promise<boolean>;
  answer: (answers: number[]) => Promise<{ right: boolean[]; correct: number; passed: boolean; xp: number; answers: number[] } | null>;
}

export const useBooks = create<BookStore>((set, get) => ({
  open: null,
  cards: [],
  mine: { owned: [], done: {} },
  reading: null,
  chapter: 0,
  page: 0,
  quiz: false,
  error: null,
  async show(where) {
    set({ open: where, error: null });
    void useProfile.getState().refresh(); // coins for the prices
    try {
      const [c, m] = await Promise.all([get().cards.length ? Promise.resolve({ books: get().cards }) : fetchBooks(), fetchMyBooks()]);
      set({ cards: c.books, mine: m });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },
  close() {
    set({ open: null, reading: null, quiz: false });
  },
  async read(id) {
    try {
      const r = await fetchBook(id);
      // carry on where I stopped (kept on this device)
      const saved = JSON.parse(localStorage.getItem(`es:book:${id}`) ?? 'null') as { c: number; p: number } | null;
      set({ reading: r.book, chapter: saved?.c ?? 0, page: saved?.p ?? 0, quiz: false, error: null });
      track('book_open', { book: id });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },
  setPage(chapter, page) {
    const b = get().reading;
    if (!b) return;
    set({ chapter, page, quiz: false });
    localStorage.setItem(`es:book:${b.id}`, JSON.stringify({ c: chapter, p: page }));
  },
  async buy(id) {
    try {
      const r = await buyBook(id);
      set({ mine: { owned: r.owned, done: r.done }, error: null });
      void useProfile.getState().refresh();
      track('book_buy', { book: id });
      return true;
    } catch (e) {
      set({ error: (e as Error).message });
      return false;
    }
  },
  async answer(answers) {
    const b = get().reading;
    if (!b) return null;
    try {
      const r = await bookQuiz(b.id, get().chapter, answers);
      if (r.passed) set((s) => ({ mine: { ...s.mine, done: { ...s.mine.done, [b.id]: [...new Set([...(s.mine.done[b.id] ?? []), get().chapter])] } } }));
      if (r.xp) void useProfile.getState().refresh();
      return r;
    } catch (e) {
      set({ error: (e as Error).message });
      return null;
    }
  },
}));
