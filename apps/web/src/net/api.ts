import type { AreaContentDto, AreaId, FarmAction, FarmActionResult, FarmState, LangCode } from '@es/shared';
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
  captcha_failed: tk('The security code was wrong or expired. Try the new one.'),
  not_enough_coins: tk('Not enough coins yet.'),
  not_owned: tk('Buy that item first.'),
  bad_color: tk('That colour is not available.'),
  beta_pass_required: tk('English Street is in closed beta. Please enter an invite code.'),
  invalid_invite_code: tk('That invite code is not valid.'),
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
const get = <T>(path: string) => request<T>('GET', path);

const q = () => `?playerId=${encodeURIComponent(getPlayerId())}`;

export const fetchNpcs = () => get<NpcInfo[]>('/npcs');
export const startQuest = (questId: string, playerName: string) => post<SessionState>(`/quests/${questId}/start`, { playerId: getPlayerId(), playerName });
export const startFreeTalk = (npcId: string, playerName: string) => post<SessionState>(`/npc/${npcId}/talk`, { playerId: getPlayerId(), playerName });
export const sendTurn = (sessionId: string, text: string, source: 'text' | 'voice' = 'text', subtitles = false) => post<SessionChatResponse>(`/sessions/${sessionId}/chat`, { playerId: getPlayerId(), text, source, subtitles, lang: learnerLang() });
export const endSession = (sessionId: string) => post<{ summary: AttemptSummary | null }>(`/sessions/${sessionId}/end`, { playerId: getPlayerId() });

export interface CaptchaAnswer {
  captchaId: string;
  captchaAnswer: string;
}
export const fetchCaptcha = () => get<{ id: string; svg: string }>('/auth/captcha');
export const register = (email: string, password: string, name: string, guestId: string, c: CaptchaAnswer) => post<AuthResponse>('/auth/register', { email, password, name, guestId, ...c });
export const login = (email: string, password: string, c: CaptchaAnswer) => post<AuthResponse>('/auth/login', { email, password, ...c });
export const fetchMe = () => get<Profile & { quota: { turnsLeftToday: number } }>(`/me${q()}`);
export const fetchPlacement = () => get<Omit<PlacementQuestion, 'answer'>[]>('/placement');
export const submitPlacement = (answers: number[]) => post<{ correct: number; total: number; level: string }>(`/me/placement${q()}`, { answers });
export const fetchVocab = () => get<VocabEntryDto[]>(`/me/vocab${q()}`);
export const reviewVocab = (id: string, grade: ReviewGrade) => post<VocabEntryDto>(`/me/vocab/review${q()}`, { id, grade });
export const saveAvatar = (look: AvatarLook) => post<Avatar>(`/me/avatar${q()}`, look);
export const buyItem = (item: string) => post<{ avatar: Avatar; coins: number }>(`/me/shop/buy${q()}`, { item });

export interface ClientConfig {
  betaGate: boolean;
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
export const sendAreaQuiz = (area: AreaId, correct: number, total: number) =>
  post<{ xp: number; coins: number; capped: boolean; passed?: boolean; badge?: string | null }>(`/me/area-quiz${q()}`, { playerId: getPlayerId(), area, correct, total });
export const fetchFarm = () => get<{ farm: FarmState; now: number }>(`/me/farm${q()}`);
export const farmAction = (a: FarmAction) => post<FarmActionResult & { now: number }>(`/me/farm${q()}`, { ...a, playerId: getPlayerId() });
