import type { AttemptSummary, AuthResponse, PlacementQuestion, Profile, ReviewGrade, SessionChatResponse, SessionState, VocabEntryDto } from '@es/shared';
import type { NpcInfo } from '../store/game';
import { authHeaders, getPlayerId } from './player';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

/** Friendly messages for API error codes. */
export const ERROR_TEXT: Record<string, string> = {
  rate_limited: 'Slow down a little — too many messages per minute.',
  daily_quota_exhausted: "You've used today's conversation limit. Come back tomorrow!",
  daily_budget_exhausted: 'The street is very busy today and the NPCs need a rest. Please try again tomorrow.',
  session_finished: 'This conversation has ended.',
  invalid_credentials: 'Wrong email or password.',
  email_taken: 'An account with this email already exists.',
  not_enough_coins: 'Not enough coins yet.',
  beta_pass_required: 'English Street is in closed beta. Please enter an invite code.',
  invalid_invite_code: 'That invite code is not valid.',
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
    throw new Error(ERROR_TEXT[code] ?? code);
  }
  return (await res.json()) as T;
}
export const post = <T>(path: string, body: unknown) => request<T>('POST', path, body);
const get = <T>(path: string) => request<T>('GET', path);

const q = () => `?playerId=${encodeURIComponent(getPlayerId())}`;

export const fetchNpcs = () => get<NpcInfo[]>('/npcs');
export const startQuest = (questId: string, playerName: string) => post<SessionState>(`/quests/${questId}/start`, { playerId: getPlayerId(), playerName });
export const startFreeTalk = (npcId: string, playerName: string) => post<SessionState>(`/npc/${npcId}/talk`, { playerId: getPlayerId(), playerName });
export const sendTurn = (sessionId: string, text: string, source: 'text' | 'voice' = 'text', subtitles = false) => post<SessionChatResponse>(`/sessions/${sessionId}/chat`, { playerId: getPlayerId(), text, source, subtitles });
export const endSession = (sessionId: string) => post<{ summary: AttemptSummary | null }>(`/sessions/${sessionId}/end`, { playerId: getPlayerId() });

export const register = (email: string, password: string, name: string, guestId: string) => post<AuthResponse>('/auth/register', { email, password, name, guestId });
export const login = (email: string, password: string) => post<AuthResponse>('/auth/login', { email, password });
export const fetchMe = () => get<Profile & { quota: { turnsLeftToday: number } }>(`/me${q()}`);
export const fetchPlacement = () => get<Omit<PlacementQuestion, 'answer'>[]>('/placement');
export const submitPlacement = (answers: number[]) => post<{ correct: number; total: number; level: string }>(`/me/placement${q()}`, { answers });
export const fetchVocab = () => get<VocabEntryDto[]>(`/me/vocab${q()}`);
export const reviewVocab = (id: string, grade: ReviewGrade) => post<VocabEntryDto>(`/me/vocab/review${q()}`, { id, grade });
export const setAvatarColor = (color: string) => post<{ color: string; owned: string[] }>(`/me/avatar${q()}`, { color });
export const buyItem = (item: string) => post<{ avatar: { color: string; owned: string[] }; coins: number }>(`/me/shop/buy${q()}`, { item });

export interface ClientConfig {
  betaGate: boolean;
}
export const fetchConfig = () => get<ClientConfig>('/config');
export const verifyBetaCode = (code: string) => post<{ pass: string }>('/beta/verify', { code });
export const sendFeedback = (text: string, name: string, page: string, meta: Record<string, string | number | boolean>) =>
  post<{ ok: true }>('/feedback', { playerId: getPlayerId(), name, text, page, meta });

// ---- learning helpers (phase 8)
export const fetchIpa = (words: string[]) => get<Record<string, string>>(`/dict/ipa?words=${encodeURIComponent(words.join(','))}`);
export const translateText = (text: string) => post<{ vi: string; cached: boolean }>('/translate', { text, playerId: getPlayerId() });
export const addVocab = (word: string, meaningVi: string, example = '') => post<{ ok: true }>(`/me/vocab${q()}`, { word, meaningVi, example });
