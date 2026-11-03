import type { AttemptSummary, SessionChatResponse, SessionState } from '@es/shared';
import type { NpcInfo } from '../store/game';
import { getPlayerId } from './player';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `${path} ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function fetchNpcs(): Promise<NpcInfo[]> {
  const res = await fetch(`${API_URL}/npcs`);
  if (!res.ok) throw new Error(`GET /npcs ${res.status}`);
  return (await res.json()) as NpcInfo[];
}

export function startQuest(questId: string, playerName: string) {
  return post<SessionState>(`/quests/${questId}/start`, { playerId: getPlayerId(), playerName });
}

export function startFreeTalk(npcId: string, playerName: string) {
  return post<SessionState>(`/npc/${npcId}/talk`, { playerId: getPlayerId(), playerName });
}

export function sendTurn(sessionId: string, text: string, source: 'text' | 'voice' = 'text') {
  return post<SessionChatResponse>(`/sessions/${sessionId}/chat`, { playerId: getPlayerId(), text, source });
}

export function endSession(sessionId: string) {
  return post<{ summary: AttemptSummary | null }>(`/sessions/${sessionId}/end`, { playerId: getPlayerId() });
}
