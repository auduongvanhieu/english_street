import type { AreaContentDto, AreaId, FarmAction, FarmActionResult, FarmState, FriendList, HotelBill, HotelStay, LangCode, MinigameId, Book, BookCard, BookClub, BookClubNote, MyBooks } from '@es/shared';
import { learnerLang, t, tk } from '../i18n';
import type { AttemptSummary, Avatar, AvatarLook, AuthResponse, PlacementQuestion, Profile, ReviewGrade, SessionChatResponse, SessionState, VocabEntryDto } from '@es/shared';
import type { NpcInfo } from '../store/game';
import { authHeaders, getPlayerId } from './player';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

/** Friendly messages for API error codes. */
export const ERROR_TEXT: Record<string, string> = {
  rate_limited: tk('Slow down a little — too many messages per minute.'),
  daily_quota_exhausted: tk("You've used today's conversation limit. Come back tomorrow!"),
  daily_budget_exhausted: tk('The street is very busy today and the NPCs need a rest. Please try again tomorrow.'),
  session_finished: tk('This conversation has ended.'),
  invalid_credentials: tk('Wrong email or password.'),
  email_taken: tk('An account with this email already exists.'),
  human_check_required: tk('Please do the security check again.'),
  account_banned: tk('Your account has been suspended by a moderator.'),
  too_many_guests: tk('Too many guests from your network right now. Sign in to play, or try again later.'),
  captcha_failed: tk('The security code was wrong or expired. Try the new one.'),
  not_enough_coins: tk('Not enough coins yet.'),
  not_owned: tk('Buy that item first.'),
  bad_color: tk('That colour is not available.'),
  beta_pass_required: tk('English Street is in closed beta. Please enter an invite code.'),
  invalid_invite_code: tk('That invite code is not valid.'),
  too_many_friends: tk('Your friend list is full.'),
  no_request: tk('That friend request is no longer there.'),
  no_stay: tk('You are not staying at the hotel.'),
  minibar_empty: tk('The minibar is empty.'),
  wrong_password: tk('Your current password is wrong.'),
  code_expired: tk('This code has expired. Ask for a new one.'),
  wrong_code: tk('Wrong code. Check the e-mail and try again.'),
  mail_off: tk('Sending e-mail is not set up yet. Please contact the admin.'),
  mail_failed: tk('We could not send the e-mail. Please try again later.'),
  bad_name: tk('Name must be at least 2 characters.'),
};

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...authHeaders() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    const code = err.error ?? `${res.status}`;
    throw new Error(ERROR_TEXT[code] ? t(ERROR_TEXT[code]) : code);
  }
  return (await res.json()) as T;
}
export const post = <T>(path: string, body: unknown) => request<T>('POST', path, body);
export const get = <T>(path: string) => request<T>('GET', path);

const q = () => `?playerId=${encodeURIComponent(getPlayerId())}`;

export const fetchNpcs = () => get<NpcInfo[]>('/npcs');
export type MinigameResult = { xp: number; coins: number; capped: boolean; record: boolean; best: number | null; left: number };
export const reportMinigame = (game: MinigameId, r: { result?: 'win' | 'draw' | 'lose'; score?: number }) => post<MinigameResult>('/me/minigame', { playerId: getPlayerId(), game, ...r });
export const fetchMinigameBoard = (game: MinigameId) => get<{ board: { name: string; score: number }[] }>(`/minigames/board?game=${game}`);
export const fetchBooks = () => get<{ books: BookCard[] }>('/books');
export const fetchBook = (id: string) => get<{ book: Book }>(`/books/${encodeURIComponent(id)}`);
export const fetchMyBooks = () => get<MyBooks>(`/me/books?playerId=${encodeURIComponent(getPlayerId())}`);
export const buyBook = (book: string) => post<MyBooks & { coins: number }>('/me/books/buy', { playerId: getPlayerId(), book });
export const fetchClub = () => get<BookClub>(`/books/club?playerId=${encodeURIComponent(getPlayerId())}`);
export const postClubNote = (text: string) => post<{ ok: boolean; note: BookClubNote }>('/me/books/club/note', { playerId: getPlayerId(), text });
export const bookQuiz = (book: string, chapter: number, answers: number[]) => post<{ right: boolean[]; correct: number; passed: boolean; xp: number; clubCoins?: number; answers: number[] }>('/me/books/quiz', { playerId: getPlayerId(), book, chapter, answers });
export const fetchBoat = () => get<{ until: number; price: number; minutes: number; free: boolean }>(`/me/boat?playerId=${encodeURIComponent(getPlayerId())}`);
export const hireBoat = () => post<{ until: number; coins: number; free: boolean }>('/me/boat/hire', { playerId: getPlayerId() });
export const fetchHotel = () => get<{ stay: HotelStay | null; room: number; price: number; free: boolean; coins: number }>(`/me/hotel?playerId=${encodeURIComponent(getPlayerId())}`);
export const hotelCheckin = (nights: number) => post<{ stay: HotelStay; coins: number; free?: boolean }>('/me/hotel/checkin', { playerId: getPlayerId(), nights });
export const hotelMinibar = (item: string) => post<{ stay: HotelStay }>('/me/hotel/minibar', { playerId: getPlayerId(), item });
export const hotelBill = () => get<{ bill: HotelBill }>(`/me/hotel/bill?playerId=${encodeURIComponent(getPlayerId())}`);
export const hotelCheckout = (disputed: number) => post<{ correct: boolean; wrong: number; paid: number; xp: number; coins: number }>('/me/hotel/checkout', { playerId: getPlayerId(), disputed });
export const fetchFriends = () => get<FriendList>(`/friends?playerId=${encodeURIComponent(getPlayerId())}`);
export const friendRequest = (to: string, toName: string, myName: string) => post<{ status: 'pending' | 'friends' }>('/friends/request', { playerId: getPlayerId(), to, toName, myName });
export const friendRespond = (from: string, accept: boolean, myName: string) => post<{ status: 'friends' | 'declined' }>('/friends/respond', { playerId: getPlayerId(), from, accept, myName });
export const friendRemove = (pid: string) => post<{ ok: boolean }>('/friends/remove', { playerId: getPlayerId(), pid });
export const startQuest = (questId: string, playerName: string) => post<SessionState>(`/quests/${questId}/start`, { playerId: getPlayerId(), playerName });
export const startFreeTalk = (npcId: string, playerName: string) => post<SessionState>(`/npc/${npcId}/talk`, { playerId: getPlayerId(), playerName });
export const sendTurn = (sessionId: string, text: string, source: 'text' | 'voice' = 'text', subtitles = false) => post<SessionChatResponse>(`/sessions/${sessionId}/chat`, { playerId: getPlayerId(), text, source, subtitles, lang: learnerLang() });
export const endSession = (sessionId: string) => post<{ summary: AttemptSummary | null }>(`/sessions/${sessionId}/end`, { playerId: getPlayerId() });

/** Human check sent with sign-in / sign-up: a Turnstile token, or the built-in image captcha answer. */
export type CaptchaAnswer = { turnstileToken: string } | { captchaId: string; captchaAnswer: string };
export const guestPass = (c: CaptchaAnswer) => post<{ pass: string }>('/auth/guest', c);
export const fetchCaptcha = () => get<{ id: string; svg: string }>('/auth/captcha');
export const register = (email: string, password: string, name: string, guestId: string, c: CaptchaAnswer) => post<AuthResponse>('/auth/register', { email, password, name, guestId, ...c });
export const login = (email: string, password: string, c: CaptchaAnswer) => post<AuthResponse>('/auth/login', { email, password, ...c });
export const forgotPassword = (email: string, c: CaptchaAnswer) => post<{ ok: boolean }>('/auth/forgot', { email, ...c });
export const resetPassword = (email: string, code: string, password: string) => post<AuthResponse>('/auth/reset', { email, code, password });
export const changePassword = (current: string, password: string) => post<{ token: string }>('/me/password', { current, password });
export const changeName = (name: string) => post<{ name: string }>(`/me/name?playerId=${encodeURIComponent(getPlayerId())}`, { playerId: getPlayerId(), name });
export const fetchMe = () => get<Profile & { quota: { turnsLeftToday: number } }>(`/me${q()}`);
export const fetchPlacement = () => get<Omit<PlacementQuestion, 'answer'>[]>('/placement');
export const submitPlacement = (answers: number[]) => post<{ correct: number; total: number; level: string }>(`/me/placement${q()}`, { answers });
export const fetchVocab = () => get<VocabEntryDto[]>(`/me/vocab${q()}`);
export const reviewVocab = (id: string, grade: ReviewGrade) => post<VocabEntryDto>(`/me/vocab/review${q()}`, { id, grade });
export const saveAvatar = (look: AvatarLook) => post<Avatar>(`/me/avatar${q()}`, look);
export const buyItem = (item: string) => post<{ avatar: Avatar; coins: number }>(`/me/shop/buy${q()}`, { item });

export interface ClientConfig {
  betaGate: boolean;
  /** Cloudflare Turnstile site key ('' = use the built-in image captcha). */
  turnstileSiteKey?: string;
}
export const fetchConfig = () => get<ClientConfig>('/config');
export const verifyBetaCode = (code: string) => post<{ pass: string }>('/beta/verify', { code });
export const sendFeedback = (text: string, name: string, page: string, meta: Record<string, string | number | boolean>) =>
  post<{ ok: true }>('/feedback', { playerId: getPlayerId(), name, text, page, meta });

// ---- learning helpers (phase 8)
export const fetchIpa = (words: string[]) => get<Record<string, string>>(`/dict/ipa?words=${encodeURIComponent(words.join(','))}`);
/** Translate English text into the learner's language (cached server-side per language). */
export const translateText = (text: string, to: LangCode = learnerLang()) => post<{ text: string; cached: boolean }>('/translate', { text, to, playerId: getPlayerId() });
export const saveLang = (lang: LangCode) => post<{ lang: string }>(`/me/lang${q()}`, { playerId: getPlayerId(), lang });
export const addVocab = (word: string, meaning: string, example = '', lang: LangCode = learnerLang()) => post<{ ok: true }>(`/me/vocab${q()}`, { playerId: getPlayerId(), word, meaning, example, lang });

// ---- themed areas
export const fetchArea = (id: AreaId, lang: string) => get<AreaContentDto>(`/areas/${id}?lang=${encodeURIComponent(lang)}`);
export const fetchAreaLearned = () => get<{ learned: Record<string, string[]> }>(`/me/areas${q()}`);
export const sendAreaLearned = (area: AreaId, items: string[]) => post<{ learned: number; badge: string | null }>(`/me/area-learned${q()}`, { playerId: getPlayerId(), area, items });
export const sendAreaQuiz = (area: AreaId, correct: number, total: number, wrong: string[] = []) =>
  post<{ xp: number; coins: number; capped: boolean; passed?: boolean; badge?: string | null }>(`/me/area-quiz${q()}`, { playerId: getPlayerId(), area, correct, total, wrong });
export const fetchFarm = () => get<{ farm: FarmState; now: number }>(`/me/farm${q()}`);
export const farmAction = (a: FarmAction) => post<FarmActionResult & { now: number }>(`/me/farm${q()}`, { ...a, playerId: getPlayerId() });
