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
  return h;
}

/** Closed-beta invite pass (from POST /beta/verify). */
export function getBetaPass(): string | null {
  return localStorage.getItem('es:beta');
}
export function setBetaPass(pass: string | null) {
  if (pass) localStorage.setItem('es:beta', pass);
  else localStorage.removeItem('es:beta');
}
