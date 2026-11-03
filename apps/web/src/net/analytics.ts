import { API_URL } from './api';
import { authHeaders, getPlayerId } from './player';

type Props = Record<string, string | number | boolean>;
const queue: { name: string; props: Props }[] = [];
let timer: number | null = null;

/** Queue a product event; batches are posted every few seconds (or on page hide via sendBeacon). */
export function track(name: string, props: Props = {}) {
  queue.push({ name, props });
  if (queue.length >= 20) flush();
  else if (timer === null) timer = window.setTimeout(flush, 4000);
}

export function flush(beacon = false) {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  if (!queue.length) return;
  const body = JSON.stringify({ playerId: getPlayerId(), events: queue.splice(0, 20) });
  if (beacon && navigator.sendBeacon) {
    navigator.sendBeacon(`${API_URL}/events`, new Blob([body], { type: 'application/json' }));
    return;
  }
  fetch(`${API_URL}/events`, { method: 'POST', headers: { 'content-type': 'application/json', ...authHeaders() }, body, keepalive: true }).catch(() => undefined);
}

export function initAnalytics() {
  const touch = matchMedia('(pointer: coarse)').matches;
  track('page_load', { touch, w: innerWidth, h: innerHeight, lang: navigator.language, ua: navigator.userAgent.slice(0, 120) });
  addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush(true));
  addEventListener('pagehide', () => flush(true));
  addEventListener('error', (e) => track('client_error', { msg: String(e.message).slice(0, 160) }));
}
