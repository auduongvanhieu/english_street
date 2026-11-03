/** Stable anonymous player id until real auth arrives (phase 5). */
export function getPlayerId(): string {
  let id = localStorage.getItem('es:pid');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('es:pid', id);
  }
  return id;
}
