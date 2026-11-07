import { create } from 'zustand';
import type { Book, BookCard, BookClub, MyBooks } from '@es/shared';
import { bookQuiz, buyBook, fetchBook, fetchBooks, fetchClub, fetchMyBooks, postClubNote } from '../net/api';
import { sendProp } from '../net/client';
import { localPos } from '../scene/LocalPlayer';
import { useGame } from './game';
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
  answer: (answers: number[]) => Promise<{ right: boolean[]; correct: number; passed: boolean; xp: number; clubCoins?: number; answers: number[] } | null>;
  /** the weekly book club */
  club: BookClub | null;
  loadClub: () => Promise<void>;
  /** write a note about the book of the week (members); returns an error code or null */
  postNote: (text: string) => Promise<string | null>;
  /** reading along with someone nearby: their pages turn mine */
  along: { id: string; name: string } | null;
  readAlong: (playerId: string) => Promise<void>;
  stopAlong: () => void;
}

/** Someone in the library reading a book (prop "book:<id>:<chapter>:<page>"). */
export interface NearReader {
  id: string;
  name: string;
  book: string;
  chapter: number;
  page: number;
}
const BOOK_PROP = /^book:([a-z0-9-]+):(\d):(\d{1,2})$/;
export const parseBookProp = (prop: string) => {
  const m = BOOK_PROP.exec(prop);
  return m ? { book: m[1]!, chapter: Number(m[2]), page: Number(m[3]) } : null;
};
/** Other players within 5 m reading a book. */
export function nearReaders(): NearReader[] {
  const g = useGame.getState();
  const out: NearReader[] = [];
  for (const p of Object.values(g.players)) {
    if (p.id === g.sessionId) continue;
    const b = parseBookProp(p.prop);
    if (b && Math.hypot(p.x - localPos.x, p.z - localPos.z) < 5) out.push({ id: p.id, name: p.name, ...b });
  }
  return out;
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
    set({ open: null, reading: null, quiz: false, along: null });
  },
  async read(id) {
    try {
      const r = await fetchBook(id);
      // carry on where I stopped (kept on this device)
      const saved = JSON.parse(localStorage.getItem(`es:book:${id}`) ?? 'null') as { c: number; p: number } | null;
      set({ reading: r.book, chapter: saved?.c ?? 0, page: saved?.p ?? 0, quiz: false, error: null, along: null });
      track('book_open', { book: id });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },
  setPage(chapter, page) {
    const b = get().reading;
    if (!b) return;
    set({ chapter, page, quiz: false, along: null });
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
      if (r.xp || r.clubCoins) void useProfile.getState().refresh();
      if (r.passed && get().club?.book.id === b.id) void get().loadClub();
      return r;
    } catch (e) {
      set({ error: (e as Error).message });
      return null;
    }
  },
  club: null,
  async loadClub() {
    try {
      set({ club: await fetchClub() });
    } catch {
      /* offline */
    }
  },
  async postNote(text) {
    try {
      const r = await postClubNote(text);
      const c = get().club;
      if (c) set({ club: { ...c, notes: [r.note, ...c.notes] } });
      track('book_club_note');
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  },
  along: null,
  async readAlong(playerId) {
    const p = useGame.getState().players[playerId];
    const b = p && parseBookProp(p.prop);
    if (!p || !b) return;
    if (get().reading?.id !== b.book) await get().read(b.book);
    if (get().reading?.id !== b.book) return;
    set({ chapter: b.chapter, page: b.page, quiz: false, along: { id: p.id, name: p.name } });
    track('book_read_along', { book: b.book });
  },
  stopAlong: () => set({ along: null }),
}));

// what I'm reading in the library shows on my character (others nearby can read along)
let sentBook = '';
useBooks.subscribe((s) => {
  const prop = s.open === 'library' && s.reading && !s.quiz ? `book:${s.reading.id}:${s.chapter}:${s.page}` : '';
  if (prop === sentBook) return;
  if (prop || sentBook) sendProp(prop);
  sentBook = prop;
});
// reading along: follow the other reader's page (and their next book); stop when they stop
useGame.subscribe((g) => {
  const st = useBooks.getState();
  if (!st.along) return;
  const p = g.players[st.along.id];
  const b = p && parseBookProp(p.prop);
  if (!b) return useBooks.setState({ along: null });
  if (st.reading?.id !== b.book) {
    const along = st.along;
    void st.read(b.book).then(() => useBooks.setState({ along, chapter: b.chapter, page: b.page }));
    return;
  }
  if (b.chapter !== st.chapter || b.page !== st.page) useBooks.setState({ chapter: b.chapter, page: b.page, quiz: false });
});
