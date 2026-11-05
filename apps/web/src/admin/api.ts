import { create } from 'zustand';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export interface Me {
  id: string;
  name: string;
  role: 'editor' | 'admin';
}
const LS = 'es:admin';

interface Session {
  token: string | null;
  me: Me | null;
  exp: number;
  set: (token: string, me: Me, expiresIn: number) => void;
  logout: () => void;
}
const saved = (() => {
  try {
    const s = JSON.parse(sessionStorage.getItem(LS) ?? 'null') as { token: string; me: Me; exp: number } | null;
    return s && s.exp > Date.now() ? s : null;
  } catch {
    return null;
  }
})();

/** Admin session: kept in sessionStorage (closing the tab signs out), 12 h at most. */
export const useSession = create<Session>((set) => ({
  token: saved?.token ?? null,
  me: saved?.me ?? null,
  exp: saved?.exp ?? 0,
  set(token, me, expiresIn) {
    const exp = Date.now() + expiresIn * 1000;
    sessionStorage.setItem(LS, JSON.stringify({ token, me, exp }));
    set({ token, me, exp });
  },
  logout() {
    sessionStorage.removeItem(LS);
    set({ token: null, me: null, exp: 0 });
  },
}));

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public body: Record<string, unknown>,
  ) {
    super(code);
  }
  /** Readable message incl. validation issues. */
  get detail(): string {
    const issues = (this.body.issues as { path: string; message: string }[] | undefined) ?? [];
    const d = typeof this.body.detail === 'string' ? this.body.detail : '';
    return [d, ...issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message))].filter(Boolean).join('\n') || this.code;
  }
}

export async function api<T>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const { token, logout } = useSession.getState();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!res.ok) {
    const b = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>;
    if (res.status === 403 && b.error === 'forbidden' && token) logout(); // expired / revoked
    throw new ApiError(res.status, String(b.error ?? res.status), b);
  }
  return json as T;
}
export const get = <T>(p: string) => api<T>('GET', p);
