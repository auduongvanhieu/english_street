/** Identity: a logged-in user id when a token is present, otherwise a stable anonymous guest id. */
export function getGuestId(): string {
  let id = localStorage.getItem('es:pid');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('es:pid', id);
  }
  return id;
}
export function getToken(): string | null {
  return localStorage.getItem('es:token');
}
export function setSession(token: string | null, userId: string | null) {
  if (token && userId) {
    localStorage.setItem('es:token', token);
    localStorage.setItem('es:uid', userId);
  } else {
    localStorage.removeItem('es:token');
    localStorage.removeItem('es:uid');
  }
}
export function getPlayerId(): string {
  return (getToken() && localStorage.getItem('es:uid')) || getGuestId();
}
export function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  const t = getToken();
  if (t) h.authorization = `Bearer ${t}`;
  const b = localStorage.getItem('es:beta');
  if (b) h['x-beta-pass'] = b;
  const hp = getHumanPass();
  if (hp) h['x-human-pass'] = hp;
  return h;
}

/** Guest human pass (POST /auth/guest after a captcha); null when missing or expired. */
export function getHumanPass(): string | null {
  const p = localStorage.getItem('es:human');
  if (!p) return null;
  try {
    const { exp } = JSON.parse(atob(p.split('.')[0]!.replace(/-/g, '+').replace(/_/g, '/'))) as {
      exp: number;
    };
    if (exp * 1000 > Date.now() + 60_000) return p;
  } catch {
    /* malformed */
  }
  localStorage.removeItem('es:human');
  return null;
}
export function setHumanPass(pass: string | null) {
  if (pass) localStorage.setItem('es:human', pass);
  else localStorage.removeItem('es:human');
}

/** Closed-beta invite pass (from POST /beta/verify). */
export function getBetaPass(): string | null {
  return localStorage.getItem('es:beta');
}
export function setBetaPass(pass: string | null) {
  if (pass) localStorage.setItem('es:beta', pass);
  else localStorage.removeItem('es:beta');
}
