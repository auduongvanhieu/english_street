/**
 * Load test: N bots join the street room, walk around at INPUT_RATE_HZ and chat now and then.
 * Reports join time, state round-trip latency (own input echoed back in a patch) and server RSS/CPU.
 *
 *   pnpm --filter @es/game-server load:bots            # 50 bots, 30 s
 *   BOTS=100 SECONDS=60 WS_URL=wss://ws.example.com pnpm --filter @es/game-server load:bots
 *   BETA_PASS=<pass> when the server runs with BETA_CODES
 */
import { Client, getStateCallbacks } from '@colyseus/sdk';
import { INPUT_RATE_HZ, MSG, STREET_ROOM, WORLD_BOUNDS } from '@es/shared';

/** Probability per tick that a bot shouts (SHOUT_RATE=0.002 ≈ 10% of bots shouting per minute at 20 Hz). */
const SHOUT_RATE = Number(process.env.SHOUT_RATE ?? 0);
const BOTS = Number(process.env.BOTS ?? 50);
const SECONDS = Number(process.env.SECONDS ?? 30);
const WS_URL = process.env.WS_URL ?? 'ws://localhost:2567';
const HEALTH_URL = WS_URL.replace(/^ws/, 'http') + '/health';

interface PlayerLike {
  x: number;
  z: number;
}
const joinMs: number[] = [];
const rtt: number[] = [];
let patches = 0;
let chats = 0;
let errors = 0;

async function bot(i: number) {
  const client = new Client(WS_URL);
  const t0 = performance.now();
  const room = await client.joinOrCreate<{ players: Map<string, PlayerLike> }>(STREET_ROOM, { name: `Bot${i}`, avatar: '{}', playerId: `load-bot-${String(i).padStart(6, '0')}`, betaPass: process.env.BETA_PASS });
  joinMs.push(performance.now() - t0);
  let x = (Math.random() - 0.5) * 60;
  let z = Math.random() * 10 - 3;
  let pending: { x: number; at: number } | null = null;
  const $ = getStateCallbacks(room);
  $(room.state).players.onAdd((p, id) => {
    if (id !== room.sessionId) return;
    $(p).onChange(() => {
      patches += 1;
      if (pending && Math.abs(p.x - pending.x) < 1e-4) {
        rtt.push(performance.now() - pending.at);
        pending = null;
      }
    });
  });
  room.onMessage(MSG.CHAT, () => (chats += 1));
  room.onError(() => (errors += 1));
  let heading = Math.random() * Math.PI * 2;
  const tick = setInterval(() => {
    if (Math.random() < 0.05) heading += (Math.random() - 0.5) * 2;
    x = Math.min(WORLD_BOUNDS.maxX, Math.max(WORLD_BOUNDS.minX, x + Math.sin(heading) * 0.15));
    z = Math.min(WORLD_BOUNDS.maxZ, Math.max(WORLD_BOUNDS.minZ, z + Math.cos(heading) * 0.15));
    if (!pending) pending = { x, at: performance.now() };
    const hop = Math.random() < 0.03;
    room.send(MSG.INPUT, { x, y: hop ? 0.8 : 0, z, rot: heading, anim: hop ? 'jump' : 'walk', voice: false });
    if (Math.random() < 0.01) room.send(MSG.CHAT, `hello from bot ${i}`);
    if (Math.random() < SHOUT_RATE) room.send(MSG.SHOUT, `anyone want to practise? bot ${i}`);
  }, 1000 / INPUT_RATE_HZ);
  return () => {
    clearInterval(tick);
    room.leave();
  };
}

async function health() {
  try {
    return (await (await fetch(HEALTH_URL)).json()) as { rooms: number; clients: number; rssMb?: number; cpuPct?: number };
  } catch {
    return null;
  }
}

const pct = (xs: number[], p: number) => (xs.length ? Math.round([...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor((xs.length * p) / 100))]!) : null);

console.log(`spawning ${BOTS} bots against ${WS_URL} for ${SECONDS}s …`);
const before = await health();
const stops: (() => void)[] = [];
for (let i = 0; i < BOTS; i++) {
  try {
    stops.push(await bot(i));
  } catch (e) {
    errors += 1;
    console.error(`bot ${i} failed to join:`, (e as Error).message);
  }
  if (i % 10 === 9) await new Promise((r) => setTimeout(r, 200)); // stagger joins a little
}
const joined = stops.length;
await new Promise((r) => setTimeout(r, SECONDS * 1000));
const during = await health();
for (const s of stops) s();
await new Promise((r) => setTimeout(r, 1000));
const after = await health();

console.log(`\nbots joined: ${joined}/${BOTS}   errors: ${errors}`);
console.log(`join time  ms: p50 ${pct(joinMs, 50)} · p95 ${pct(joinMs, 95)} · max ${pct(joinMs, 100)}`);
console.log(`input→patch round-trip ms: p50 ${pct(rtt, 50)} · p95 ${pct(rtt, 95)} · max ${pct(rtt, 100)}  (${rtt.length} samples)`);
console.log(`state patches received: ${patches} (~${Math.round(patches / SECONDS / Math.max(1, joined))}/s per bot) · chat messages: ${chats}`);
console.log(`server: before ${JSON.stringify(before)}\n        during ${JSON.stringify(during)}\n        after  ${JSON.stringify(after)}`);
const ok = joined === BOTS && errors === 0 && (pct(rtt, 95) ?? 9999) < 250;
console.log(ok ? '\nOK' : '\nPROBLEMS (see above)');
process.exit(ok ? 0 : 1);
