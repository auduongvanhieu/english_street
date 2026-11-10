import type Redis from 'ioredis';
import { env } from '../env';
import { setting } from '../settings';
import { USDT_BEP20_CONTRACT, USDT_TRC20_CONTRACT, expireOld, receive, type Incoming } from './core';

/**
 * Watch the USDT wallets (addresses only) and pass every incoming transfer to receive():
 *  - TRC20: TronGrid's list of confirmed TRC20 transfers to the address (USDT contract only);
 *  - BEP20: Transfer logs of the USDT contract to the address, read from a BNB Chain RPC, `payBep20Confirmations` deep.
 * receive() stores each transfer once, so reading the same ones again is harmless.
 */

const EVERY_MS = 20_000;
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
/** BEP20 USDT has 18 decimals; orders are in micro-USDT (6) */
const BEP20_TO_MICRO = 10n ** 12n;
/** blocks read per RPC call / looked back on start (BNB Chain makes a block about every 0.75 s) */
const BSC_CHUNK = 500;
const BSC_LOOKBACK = 4000;

let timer: NodeJS.Timeout | null = null;
let redis: Redis | null = null;
let bscFrom = 0;
export const chainStatus = { trc20: { at: 0, ok: true, error: '' }, bep20: { at: 0, ok: true, error: '', block: 0 } };

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`${r.status} ${url.split('?')[0]}`);
  return (await r.json()) as T;
}

interface TronTransfer {
  transaction_id: string;
  token_info: { address: string; decimals: number };
  from: string;
  to: string;
  type: string;
  value: string;
  block_timestamp: number;
}

export async function scanTrc20(address: string): Promise<Incoming[]> {
  const since = Date.now() - 3 * 3600_000;
  const url = `https://api.trongrid.io/v1/accounts/${address}/transactions/trc20?only_to=true&only_confirmed=true&limit=100&contract_address=${USDT_TRC20_CONTRACT}&min_timestamp=${since}`;
  const headers: Record<string, string> = env.TRONGRID_API_KEY ? { 'TRON-PRO-API-KEY': env.TRONGRID_API_KEY } : {};
  const d = await getJson<{ data?: TronTransfer[]; success?: boolean }>(url, { headers });
  return (d.data ?? [])
    .filter((t) => t.type === 'Transfer' && t.to === address && t.token_info?.address === USDT_TRC20_CONTRACT && t.token_info.decimals === 6)
    .map((t) => ({ source: 'trc20' as const, txRef: t.transaction_id, amount: Number(t.value), content: t.from, raw: t }));
}

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const d = await getJson<{ result?: T; error?: { message: string } }>(env.BSC_RPC_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  if (d.error) throw new Error(d.error.message);
  return d.result as T;
}

interface Log {
  transactionHash: string;
  logIndex: string;
  blockNumber: string;
  data: string;
  topics: string[];
}

export async function scanBep20(address: string): Promise<Incoming[]> {
  const latest = Number(await rpc<string>('eth_blockNumber', []));
  const safe = latest - setting('payBep20Confirmations');
  if (!bscFrom) bscFrom = Number((await redis?.get('pay:bep20:from')) ?? 0) || safe - BSC_LOOKBACK;
  const out: Incoming[] = [];
  const to = `0x${address.toLowerCase().slice(2).padStart(64, '0')}`;
  while (bscFrom <= safe) {
    const end = Math.min(safe, bscFrom + BSC_CHUNK - 1);
    const logs = await rpc<Log[]>('eth_getLogs', [{ fromBlock: `0x${bscFrom.toString(16)}`, toBlock: `0x${end.toString(16)}`, address: USDT_BEP20_CONTRACT, topics: [TRANSFER_TOPIC, null, to] }]);
    for (const l of logs) {
      const micro = BigInt(l.data) / BEP20_TO_MICRO;
      if (micro <= 0n || micro > BigInt(Number.MAX_SAFE_INTEGER)) continue;
      out.push({ source: 'bep20', txRef: `${l.transactionHash}:${Number(l.logIndex)}`, amount: Number(micro), content: `0x${(l.topics[1] ?? '').slice(-40)}`, raw: l });
    }
    bscFrom = end + 1;
  }
  chainStatus.bep20.block = safe;
  await redis?.set('pay:bep20:from', String(bscFrom));
  return out;
}

async function tick() {
  if (setting('payMode') === 'off') return;
  await expireOld().catch(() => undefined);
  if (!setting('payUsdt')) return;
  const trc = setting('payTrc20Address');
  if (trc) {
    try {
      for (const inc of await scanTrc20(trc)) await receive(inc);
      Object.assign(chainStatus.trc20, { at: Date.now(), ok: true, error: '' });
    } catch (e) {
      Object.assign(chainStatus.trc20, { at: Date.now(), ok: false, error: String((e as Error).message).slice(0, 200) });
    }
  }
  const bep = setting('payBep20Address');
  if (bep) {
    try {
      for (const inc of await scanBep20(bep)) await receive(inc);
      Object.assign(chainStatus.bep20, { at: Date.now(), ok: true, error: '' });
    } catch (e) {
      Object.assign(chainStatus.bep20, { at: Date.now(), ok: false, error: String((e as Error).message).slice(0, 200) });
    }
  }
}

export function startChainWatch(r: Redis | null) {
  redis = r;
  if (timer) return;
  let running = false;
  timer = setInterval(() => {
    if (running) return;
    running = true;
    void tick().finally(() => (running = false));
  }, EVERY_MS);
  timer.unref();
}
