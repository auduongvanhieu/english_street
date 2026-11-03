import type { NpcInfo } from '../store/game';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export async function fetchNpcs(): Promise<NpcInfo[]> {
  const res = await fetch(`${API_URL}/npcs`);
  if (!res.ok) throw new Error(`GET /npcs ${res.status}`);
  return (await res.json()) as NpcInfo[];
}
