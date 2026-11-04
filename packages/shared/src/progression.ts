import { z } from 'zod';
import { CEFR_LEVELS } from './constants';
import { AvatarSchema, type Avatar } from './avatar';

/** Level curve: level n needs 50·(n-1)² XP. */
export function levelForXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1;
}
export function xpForLevel(level: number): number {
  return 50 * (level - 1) * (level - 1);
}

export const BADGES = [
  { id: 'first-steps', name: 'First Steps', desc: 'Complete your first quest', icon: '🥾' },
  { id: 'regular', name: 'Regular', desc: 'Complete 5 quests', icon: '⭐' },
  { id: 'cafe-regular', name: 'Café Regular', desc: 'Complete 3 quests at the café', icon: '☕' },
  { id: 'well-travelled', name: 'Well Travelled', desc: 'Complete a quest with 4 different NPCs', icon: '🧭' },
  { id: 'streak-3', name: 'On a Roll', desc: 'Play 3 days in a row', icon: '🔥' },
  { id: 'team-player', name: 'Team Player', desc: 'Finish a pair quest', icon: '👥' },
  { id: 'bookworm', name: 'Bookworm', desc: 'Review 20 flashcards', icon: '📚' },
  // themed areas: open AREA_BADGE_WORDS word cards there and pass one of its quizzes (≥ 80 %)
  { id: 'zoo-explorer', name: 'Zoo Explorer', desc: 'Learn 15 words at the zoo and pass a zoo quiz', icon: '🦁' },
  { id: 'farm-hand', name: 'Farm Hand', desc: 'Learn 15 words at the farm and pass a farm quiz', icon: '🐄' },
  { id: 'foodie', name: 'Foodie', desc: 'Learn 15 words at the restaurant and pass a restaurant quiz', icon: '🍽️' },
  { id: 'smart-shopper', name: 'Smart Shopper', desc: 'Learn 15 words at the supermarket and pass a supermarket quiz', icon: '🛒' },
] as const;
export type BadgeId = (typeof BADGES)[number]['id'];
/** Word cards to open in an area for its badge (with a passed quiz). */
export const AREA_BADGE_WORDS = 15;
export const AREA_BADGE = { zoo: 'zoo-explorer', farm: 'farm-hand', restaurant: 'foodie', supermarket: 'smart-shopper' } as const;

/** @deprecated kept as an alias: the avatar is now a full character look (see avatar.ts). */
export const AvatarConfigV2Schema = AvatarSchema;
export type AvatarConfigV2 = Avatar;

// ---------------------------------------------------------------- auth
export const RegisterRequestSchema = z.object({
  email: z.string().email().max(120),
  password: z.string().min(6).max(100),
  name: z.string().min(2).max(20),
  /** Guest id whose progress should be moved to the new account. */
  guestId: z.string().max(64).optional(),
  /** Image captcha (GET /auth/captcha). */
  captchaId: z.string().max(64).optional(),
  captchaAnswer: z.string().max(16).optional(),
  /** Cloudflare Turnstile token (preferred when the site key is configured). */
  turnstileToken: z.string().max(4096).optional(),
});
export const LoginRequestSchema = z.object({ email: z.string().email(), password: z.string().min(1), captchaId: z.string().max(64).optional(), captchaAnswer: z.string().max(16).optional(), turnstileToken: z.string().max(4096).optional() });

export const ProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  cefrLevel: z.enum(CEFR_LEVELS),
  placementDone: z.boolean(),
  /** Learner's own language code ('' = not chosen yet). */
  nativeLang: z.string().default(''),
  xp: z.number().int(),
  level: z.number().int(),
  nextLevelXp: z.number().int(),
  coins: z.number().int(),
  streak: z.number().int(),
  avatar: AvatarSchema,
  stats: z.object({ questsCompleted: z.number().int(), reviewsDone: z.number().int() }),
  badges: z.array(z.string()),
  /** Progress per themed area: word cards opened (of total) and whether a quiz was passed. */
  areas: z.record(z.string(), z.object({ learned: z.number().int(), total: z.number().int(), quiz: z.boolean() })).default({}),
  daily: z.array(z.object({ questId: z.string(), title: z.string(), npcId: z.string(), level: z.string(), done: z.boolean(), bonusXp: z.number().int() })),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const AuthResponseSchema = z.object({ token: z.string(), profile: ProfileSchema });
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

// ---------------------------------------------------------------- placement test
export const PlacementQuestionSchema = z.object({
  id: z.string(),
  level: z.enum(CEFR_LEVELS),
  question: z.string(),
  options: z.array(z.string()).length(4),
  answer: z.number().int().min(0).max(3),
});
export type PlacementQuestion = z.infer<typeof PlacementQuestionSchema>;
export const PlacementSubmitSchema = z.object({ answers: z.array(z.number().int().min(-1).max(3)).length(10) });

export function placementLevel(correct: number): (typeof CEFR_LEVELS)[number] {
  if (correct <= 3) return 'A1';
  if (correct <= 5) return 'A2';
  if (correct <= 7) return 'B1';
  if (correct <= 9) return 'B2';
  return 'C1';
}

// ---------------------------------------------------------------- vocabulary / flashcards
export const VocabEntryDtoSchema = z.object({
  id: z.string(),
  word: z.string(),
  meaning: z.string(),
  /** Language of `meaning`. */
  lang: z.string().default('vi'),
  example: z.string(),
  ease: z.number(),
  intervalDays: z.number().int(),
  nextReviewAt: z.string(),
  due: z.boolean(),
});
export type VocabEntryDto = z.infer<typeof VocabEntryDtoSchema>;
export const ReviewGradeSchema = z.enum(['again', 'hard', 'good']);
export type ReviewGrade = z.infer<typeof ReviewGradeSchema>;

/** SM-2-lite scheduling. Returns the new ease/interval and next due time. */
export function scheduleReview(grade: ReviewGrade, ease: number, intervalDays: number, now = new Date()) {
  let e = ease;
  let days: number;
  let next: Date;
  if (grade === 'again') {
    e = Math.max(1.3, e - 0.2);
    days = 0;
    next = new Date(now.getTime() + 10 * 60 * 1000);
  } else if (grade === 'hard') {
    e = Math.max(1.3, e - 0.15);
    days = 1;
    next = new Date(now.getTime() + 86_400_000);
  } else {
    e = Math.min(3, e + 0.1);
    days = intervalDays <= 0 ? 1 : Math.max(2, Math.round(intervalDays * e));
    next = new Date(now.getTime() + days * 86_400_000);
  }
  return { ease: Number(e.toFixed(2)), intervalDays: days, nextReviewAt: next };
}

/** Pick N quest ids for a given day, stable for everyone (seeded by the date). */
export function dailyQuestIds(allIds: string[], date: Date, n = 3): string[] {
  const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
  let h = 2166136261;
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const ids = [...allIds];
  const out: string[] = [];
  while (out.length < Math.min(n, ids.length)) {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    out.push(ids.splice(h % ids.length, 1)[0]!);
  }
  return out;
}
