import { z } from 'zod';

/**
 * Graded readers for the library / bookshop (packages/quests/content/books/*.yaml). A book has 2-3 chapters; a
 * chapter has 2-4 short pages (an emoji picture + 30-90 words) and 3 comprehension questions.
 */
export const BOOK_LEVELS = ['A1', 'A2', 'B1', 'B2'] as const;
export const BookQuestionSchema = z.object({
  q: z.string().min(5).max(160),
  options: z.array(z.string().min(1).max(80)).length(3),
  answer: z.number().int().min(0).max(2),
});
export const BookPageSchema = z.object({
  /** an emoji "illustration" for the page (1-4 emoji) */
  pic: z.string().min(1).max(24),
  text: z.string().min(40).max(700),
});
export const BookChapterSchema = z.object({
  title: z.string().min(2).max(60),
  pages: z.array(BookPageSchema).min(2).max(4),
  questions: z.array(BookQuestionSchema).length(3),
});
export const BookSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{3,40}$/),
  title: z.string().min(2).max(60),
  author: z.string().min(2).max(60).default('English Street'),
  level: z.enum(BOOK_LEVELS),
  /** coins to buy a copy for your shelf at home (reading in the library is free) */
  price: z.number().int().min(0).max(30),
  cover: z.object({ emoji: z.string().min(1).max(8), color: z.string().regex(/^#[0-9a-f]{6}$/i) }),
  summary: z.string().min(10).max(200),
  tags: z.array(z.string().max(20)).max(5).default([]),
  chapters: z.array(BookChapterSchema).min(2).max(3),
});
export type Book = z.infer<typeof BookSchema>;
export type BookChapter = z.infer<typeof BookChapterSchema>;
/** A book in the shelf list (no text). */
export type BookCard = Pick<Book, 'id' | 'title' | 'author' | 'level' | 'price' | 'cover' | 'summary' | 'tags'> & { chapters: number; words: number };
export const BOOK_XP_PER_CHAPTER = 6;
/** My books: owned copies and chapters whose quiz I passed (book id -> chapter indexes). */
export interface MyBooks {
  owned: string[];
  done: Record<string, number[]>;
}

/* ------------------------------------------------------------------------------------- the weekly book club */
/** Book club weeks start on Monday 00:00 UTC; week 0 = the week of 1 Jan 1970 (a Thursday, hence the +3 days). */
export const clubWeek = (ms: number) => Math.floor((ms / 86_400_000 + 3) / 7);
/** Start of a club week (ms). */
export const clubWeekStart = (week: number) => (week * 7 - 3) * 86_400_000;
/** The book of the week: the books in id order, one a week, round and round. */
export const clubBookId = (ids: readonly string[], week: number) => [...ids].sort()[week % ids.length] ?? '';
/** Chapter quizzes to pass this week for the book club bonus, and the bonus. */
export const CLUB_GOAL = 2;
export const CLUB_COINS = 15;
export const CLUB_NOTE_MAX = 140;
export interface BookClubNote {
  name: string;
  text: string;
  at: number;
}
export interface BookClub {
  week: number;
  /** ms until the next book */
  endsIn: number;
  book: BookCard;
  /** chapters of the club book I passed this week */
  mine: number[];
  claimed: boolean;
  /** members this week (passed at least one chapter), newest first */
  members: string[];
  notes: BookClubNote[];
  /** a question to talk about this week */
  question: string;
}
/** Talking points, one a week. */
export const CLUB_QUESTIONS = [
  'Who is your favourite character? Why?',
  'What was the best part of the story?',
  'How would you change the ending?',
  'Would you like to be in this story? Why or why not?',
  'What did you learn from this book?',
  'Which new word from the book do you like best?',
  'What would you say to the main character?',
];
