// End-to-end check of the admin site API against a running API + game server with Postgres and Redis:
// roles, content edits (live, revert, history), moderation (mute, ban + kick, sign-out), settings, stats, audit.
//
//   API=http://localhost:4000 WS=ws://localhost:2567 REDIS_URL=redis://localhost:6379/1 node scripts/admin-e2e.mjs
//
// Captcha answers are read from Redis (the built-in image captcha); accounts are granted roles with admin:grant.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const reqApi = createRequire(join(ROOT, 'apps/api/package.json'));
const reqWeb = createRequire(join(ROOT, 'apps/web/package.json'));
const Redis = reqApi('ioredis').default ?? reqApi('ioredis');
const { Client } = await import(reqWeb.resolve('@colyseus/sdk'));

const API = process.env.API ?? 'http://localhost:4000';
const WS = process.env.WS ?? 'ws://localhost:2567';
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379/1');
const run = Date.now().toString(36);
let failed = 0;
const ok = (c, m) => {
  if (!c) failed += 1;
  console.log(c ? 'ok  ' : 'FAIL', m);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function captcha() {
  const r = await (await fetch(`${API}/auth/captcha`)).json();
  return { captchaId: r.id, captchaAnswer: await redis.get(`captcha:${r.id}`) };
}
async function call(method, path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
}
const register = async (email, password, name) => call('POST', '/auth/register', { email, password, name, ...(await captcha()) });
const adminLogin = async (email, password) => call('POST', '/admin/login', { email, password, ...(await captcha()) });
const grant = (email, role) => execSync(`pnpm --silent --filter @es/api admin:grant ${email} ${role}`, { cwd: ROOT, stdio: 'inherit' });

// ---------------------------------------------------------------- roles
const adminEmail = `admin-${run}@e2e.local`;
const editorEmail = `editor-${run}@e2e.local`;
ok((await register(adminEmail, 'adminpass1', 'E2E Admin')).status === 201, 'admin account registered');
ok((await register(editorEmail, 'editorpass1', 'E2E Editor')).status === 201, 'editor account registered');
ok((await adminLogin(editorEmail, 'editorpass1')).status === 401, 'player cannot sign in to admin');
grant(adminEmail, 'admin');
grant(editorEmail, 'editor');
const A = (await adminLogin(adminEmail, 'adminpass1')).json.token;
const E = (await adminLogin(editorEmail, 'editorpass1')).json.token;
ok(!!A && !!E, 'admin + editor signed in');
ok((await call('GET', '/admin/me', undefined, A)).json?.role === 'admin', 'role admin');
ok((await call('GET', '/admin/users', undefined, E)).status === 403, 'editor blocked from players');
ok((await call('GET', '/admin/content', undefined, E)).status === 200, 'editor sees content');
const game = await call('POST', '/auth/login', { email: adminEmail, password: 'adminpass1', ...(await captcha()) });
ok((await call('GET', '/admin/me', undefined, game.json.token)).status === 403, 'game token refused on admin');

// ---------------------------------------------------------------- content
const area = (await call('GET', '/admin/content/area/restaurant', undefined, E)).json;
const d = structuredClone(area.data);
const item = d.items.find((i) => i.price != null);
item.price = 77;
ok((await call('PUT', '/admin/content/area/restaurant', { data: d, baseVersion: area.override?.version }, E)).status === 200, 'area saved');
ok((await call('GET', '/areas/restaurant?lang=vi')).json.items.find((i) => i.id === item.id)?.price === 77, 'game sees the new price');
ok((await call('PUT', '/admin/content/area/restaurant', { data: d, baseVersion: 0 }, E)).status === 409, 'stale version refused');
const bad = await call('PUT', '/admin/content/quest/cafe-order-01', { data: { id: 'cafe-order-01', npc: 'nobody', level: 'A1', title: 'x', intro: 'y', goals: [{ id: 'a', desc: 'b' }] } }, E);
ok(bad.status === 400, 'unknown NPC refused');
ok((await call('POST', '/admin/content/area/restaurant/revert', {}, E)).status === 200, 'revert');
ok((await call('GET', '/areas/restaurant?lang=vi')).json.items.find((i) => i.id === item.id)?.price !== 77, 'price back to YAML');
ok((await call('GET', '/admin/content/area/restaurant/revisions', undefined, E)).json.length >= 2, 'history kept');
const qid = `e2e-${run}`;
ok((await call('PUT', `/admin/content/quest/${qid}`, { data: { id: qid, npc: 'barista', level: 'A1', title: 'E2E', intro: 'Order tea.', goals: [{ id: 'order', desc: 'Order a tea' }] } }, E)).status === 200, 'new quest');
ok((await call('GET', '/npcs')).json.find((n) => n.id === 'barista').quests.some((q) => q.id === qid), 'barista offers it');
ok((await call('DELETE', '/admin/content/npc/barista', undefined, E)).status === 409, 'NPC in use cannot be deleted');
ok((await call('DELETE', `/admin/content/quest/${qid}`, undefined, E)).status === 200, 'quest deleted');
const w0 = (await call('GET', '/admin/content/world/world', undefined, E)).json;
ok((await call('PUT', '/admin/content/world/world', { data: { ...(w0.data ?? {}), zooNames: { lion: ['Simba'] } } }, E)).status === 200, 'world saved');
ok((await call('GET', '/world')).json.zooNames.lion?.[0] === 'Simba', 'GET /world has the new name');
await call('POST', '/admin/content/world/world/revert', {}, E);

// ---------------------------------------------------------------- moderation
const pEmail = `player-${run}@e2e.local`;
const reg = await register(pEmail, 'playerpass1', 'E2E Player');
const { token, profile } = reg.json;
const client = new Client(WS);
const notices = [];
let left = null;
const room = await client.joinOrCreate('street', { name: 'E2E Player', avatar: '{}', zoneKind: 'main', token, playerId: profile.id });
for (const t of ['chat', 'time', 'zone']) room.onMessage(t, () => {});
room.onMessage('notice', (m) => notices.push(m));
room.onLeave((code) => (left = code));
await sleep(500);
ok((await call('GET', '/admin/online', undefined, A)).json.players?.some((p) => p.uid === profile.id), 'online list');
ok((await call('POST', `/admin/users/${profile.id}/mute`, { minutes: 5 }, A)).status === 200, 'mute');
room.send('chat', 'hello');
await sleep(600);
ok(notices.some((n) => n.code === 'muted'), 'muted player told so');
await call('POST', `/admin/users/${profile.id}/ban`, { days: 1, reason: 'e2e' }, A);
await sleep(800);
ok(left === 4106, `banned player kicked (${left})`);
let refused = '';
try {
  await client.joinOrCreate('street', { name: 'E2E Player', avatar: '{}', zoneKind: 'main', token, playerId: profile.id });
} catch (e) {
  refused = String(e.message);
}
ok(refused.includes('account_banned'), 'banned player cannot rejoin');
ok((await call('POST', '/auth/login', { email: pEmail, password: 'playerpass1', ...(await captcha()) })).json.error === 'account_banned', 'banned player cannot sign in');
await call('POST', `/admin/users/${profile.id}/ban`, { days: 0 }, A);
await call('POST', `/admin/users/${profile.id}/signout`, {}, A);
ok((await fetch(`${API}/me`, { headers: { authorization: `Bearer ${token}` } })).status === 401, 'signed out everywhere');

// ---------------------------------------------------------------- settings, stats, audit
ok((await call('PUT', '/admin/settings/npcDailyBudgetUsd', { value: -1 }, A)).status === 400, 'invalid setting refused');
ok((await call('PUT', '/admin/settings/maxGuestsPerIp', { value: 9 }, A)).status === 200, 'setting saved');
await call('PUT', '/admin/settings/maxGuestsPerIp', { value: null }, A);
ok((await call('GET', '/admin/stats/daily?days=7', undefined, E)).json.days?.length === 7, 'daily stats');
ok((await call('GET', '/admin/stats/overview', undefined, E)).status === 200, 'overview');
const audit = (await call('GET', '/admin/audit', undefined, A)).json;
ok(audit.some((a) => a.action === 'user.ban') && audit.some((a) => a.action.startsWith('content.')), 'audit log');
ok((await call('DELETE', `/admin/users/${profile.id}`, { confirm: 'E2E Player' }, A)).status === 200, 'account deleted');

await redis.quit();
console.log(failed ? `\n${failed} FAILED` : '\nall admin checks passed');
process.exit(failed ? 1 : 0);
