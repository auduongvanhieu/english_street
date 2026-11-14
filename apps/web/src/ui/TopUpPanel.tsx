import { useEffect, useState } from 'react';
import { payAmountText, type PayMethod, type PayOrderView, type PayPack } from '@es/shared';
import { tk, useT } from '../i18n';
import { usePay } from '../store/pay';
import { useProfile } from '../store/profile';
import { useGame } from '../store/game';
import { Icon } from './icons';
import { Panel } from './ProfilePanels';

/**
 * 💎 Gems: the balance, then three tabs: buy gems (top-ups: pick a pack, a way to pay, the QR / address and a
 * live "waiting for the money"), change gems into coins, extra NPC turns.
 */
export function TopUpPanel() {
  const t = useT();
  const info = usePay((s) => s.info);
  const order = usePay((s) => s.order);
  const done = usePay((s) => s.done);
  const gems = useProfile((s) => s.profile?.gems ?? 0);
  const bonus = useProfile((s) => s.profile?.quota?.bonusTurns ?? 0);
  const [tab, setTab] = useState<'buy' | 'coins' | 'turns'>('buy');
  useEffect(() => {
    void usePay.getState().load();
    void usePay.getState().loadGems();
  }, []);
  const canBuy = !!info?.enabled;
  const cur = !canBuy && tab === 'buy' ? 'coins' : tab;
  const tabs: ['buy' | 'coins' | 'turns', string][] = [['coins', t('Gems → coins')], ['turns', t('NPC turns')]];
  if (canBuy) tabs.unshift(['buy', t('Buy gems')]);
  return (
    <Panel title={t('Gems')} icon="gem">
      {done ? (
        <Done o={done} />
      ) : order ? (
        <OrderView o={order} />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-900">
            <span className="flex items-center gap-1">
              {t('You have')} <Icon name="gem" size={16} className="text-sky-500" /> <b>{gems.toLocaleString('vi-VN')}</b> {t('gems')}
            </span>
            {bonus ? (
              <span className="flex items-center gap-1 text-xs">
                <Icon name="chat" size={14} /> {t('+{n} NPC turns', { n: bonus })}
              </span>
            ) : null}
          </div>
          <div className="flex gap-1 rounded-xl bg-gray-100 p-1 text-sm">
            {tabs.map(([id, label]) => (
              <button key={id} type="button" onClick={() => setTab(id)} className={`min-h-9 flex-1 rounded-lg px-2 font-medium ${cur === id ? 'bg-white text-slate-900 shadow' : 'text-gray-600'}`}>
                {label}
              </button>
            ))}
          </div>
          {cur === 'buy' ? <Packs /> : cur === 'coins' ? <ToCoins /> : <Turns />}
          <p className="text-xs text-gray-500">{t('Special 💎 items are in Create character (hair, clothes, name tags) and in My room (furniture). Lessons and quests are always free.')}</p>
        </div>
      )}
    </Panel>
  );
}

/** Gems → coins, one way. */
function ToCoins() {
  const t = useT();
  const gem = usePay((s) => s.gem);
  const gems = useProfile((s) => s.profile?.gems ?? 0);
  const [n, setN] = useState(10);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const rate = gem?.rate ?? 10;
  const go = async () => {
    setBusy(true);
    setMsg('');
    try {
      const got = await usePay.getState().exchange(n);
      setMsg(t('+{n} coins!', { n: got }));
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2 text-sm">
      <p className="text-gray-600">{t('1 gem = {n} coins. Coins cannot be changed back into gems.', { n: rate })}</p>
      <div className="flex items-center gap-2">
        {[10, 50, 100].map((v) => (
          <button key={v} type="button" onClick={() => setN(v)} className={`min-h-10 flex-1 rounded-xl border-2 font-semibold ${n === v ? 'border-sky-500 bg-sky-50' : 'border-gray-200'}`}>
            {v} 💎
          </button>
        ))}
      </div>
      <button type="button" disabled={busy || gems < n} onClick={() => void go()} className="flex min-h-12 w-full items-center justify-center gap-1 rounded-xl bg-amber-500 font-semibold text-white disabled:opacity-50">
        {n} 💎 → <Icon name="coin" size={16} /> {(n * rate).toLocaleString('vi-VN')}
      </button>
      {gems < n ? <p className="text-xs text-gray-500">{t('Not enough gems.')}</p> : null}
      {msg ? <p className="text-center font-semibold text-emerald-700">{msg}</p> : null}
    </div>
  );
}

/** Extra NPC conversation turns, used after today's free ones (they do not run out at midnight). */
function Turns() {
  const t = useT();
  const gem = usePay((s) => s.gem);
  const gems = useProfile((s) => s.profile?.gems ?? 0);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const pack = gem?.turnPack ?? { turns: 20, gems: 20 };
  const go = async () => {
    setBusy(true);
    setMsg('');
    try {
      const n = await usePay.getState().buyTurns();
      setMsg(t('+{n} NPC turns!', { n }));
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2 text-sm">
      <p className="text-gray-600">{t('Every day you get free turns to talk with the NPCs. When they are used up, bought turns let you keep talking. Bought turns do not expire.')}</p>
      <button type="button" disabled={busy || gems < pack.gems} onClick={() => void go()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-sky-600 font-semibold text-white disabled:opacity-50">
        <Icon name="chat" size={16} /> {t('{n} turns', { n: pack.turns })} · {pack.gems} 💎
      </button>
      {gems < pack.gems ? <p className="text-xs text-gray-500">{t('Not enough gems.')}</p> : null}
      {msg ? <p className="text-center font-semibold text-emerald-700">{msg}</p> : null}
    </div>
  );
}

/** "+" next to the gems: opens the gems panel. */
export function GemsButton({ dark }: { dark?: boolean }) {
  const t = useT();
  const open = useGame((s) => s.setUiPanel);
  return (
    <button type="button" onClick={() => open('topup')} aria-label={t('Gems')} title={t('Gems')} className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-bold leading-none ${dark ? 'bg-sky-300 text-slate-900 hover:bg-sky-200' : 'bg-sky-500 text-white hover:bg-sky-600'}`}>
      +
    </button>
  );
}

const METHOD_LABEL: Record<PayMethod, string> = { vnd: tk('Bank transfer (VND)'), usdt_trc20: 'USDT · TRC20 (Tron)', usdt_bep20: 'USDT · BEP20 (BNB Chain)' };

function Packs() {
  const t = useT();
  const info = usePay((s) => s.info)!;
  const busy = usePay((s) => s.busy);
  const error = usePay((s) => s.error);
  const [pack, setPack] = useState<PayPack | null>(null);
  if (info.needAccount)
    return (
      <div className="space-y-3 text-sm">
        <p className="rounded-xl bg-amber-50 p-3 text-amber-900">{t('Sign up for an account first, so the gems you buy are kept safe in it. Open Settings → Account, or sign out and choose "Sign up". Your guest progress moves to the new account.')}</p>
      </div>
    );
  const x = info.firstBonus ? 2 : 1;
  const vnd = info.methods.includes('vnd');
  const usdt = info.methods.some((m) => m !== 'vnd');
  return (
    <div className="space-y-3">
      {info.firstBonus ? <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">🎁 {t('First top-up: double gems!')}</p> : null}
      <div className="grid gap-2 sm:grid-cols-3">
        {info.packs.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPack(p)}
            className={`flex flex-col items-center rounded-xl border-2 p-3 ${pack?.id === p.id ? 'border-sky-500 bg-sky-50' : 'border-gray-200 bg-white hover:border-sky-300'}`}
          >
            <span className="flex items-center gap-1 text-xl font-bold text-sky-600">
              <Icon name="gem" size={20} /> {(p.gems * x).toLocaleString('vi-VN')}
            </span>
            {x > 1 ? <span className="text-xs text-gray-400 line-through">{p.gems.toLocaleString('vi-VN')}</span> : null}
            {vnd ? (
              <>
                <span className="mt-1 text-sm font-semibold text-slate-800">{p.vnd.toLocaleString('vi-VN')}đ</span>
                {usdt ? <span className="text-xs text-gray-500">≈ {p.usdt} USDT</span> : null}
              </>
            ) : (
              <span className="mt-1 text-sm font-semibold text-slate-800">{p.usdt} USDT</span>
            )}
          </button>
        ))}
      </div>
      {pack ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-700">{t('How do you want to pay?')}</p>
          {info.methods.map((m) => (
            <button key={m} type="button" disabled={busy} onClick={() => void usePay.getState().start(pack.id, m)} className="flex min-h-12 w-full items-center justify-between rounded-xl border px-4 text-left text-sm hover:bg-gray-50 disabled:opacity-50">
              <span className="font-medium">{m === 'vnd' ? `🏦 ${t(METHOD_LABEL[m])}` : `🪙 ${METHOD_LABEL[m]}`}</span>
              <span className="text-gray-600">{m === 'vnd' ? `${pack.vnd.toLocaleString('vi-VN')}đ` : `${pack.usdt} USDT`}</span>
            </button>
          ))}
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <History />
      <p className="text-xs text-gray-400">{t('Gems are only for this game and cannot be changed back into money. Need help? Send the order code with the Feedback button.')}</p>
    </div>
  );
}

function History() {
  const t = useT();
  const orders = usePay((s) => s.info?.orders ?? []);
  if (!orders.length) return null;
  const label: Record<string, string> = { pending: t('Waiting'), paid: t('Paid'), expired: t('Expired'), cancelled: t('Cancelled'), refunded: t('Refunded') };
  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold uppercase text-gray-500">{t('My top-ups')}</h3>
      <ul className="divide-y rounded-xl border text-sm">
        {orders.map((o) => (
          <li key={o.code}>
            <button type="button" disabled={o.status !== 'pending'} onClick={() => usePay.getState().open(o)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left disabled:cursor-default">
              <span className="font-mono text-xs text-gray-500">{o.code}</span>
              <span className="flex-1 text-gray-700">
                {o.gems.toLocaleString('vi-VN')} <Icon name="gem" size={13} className="inline text-sky-500" /> · {payAmountText(o.method, o.amount)}
              </span>
              <span className={o.status === 'paid' ? 'font-semibold text-emerald-700' : o.status === 'pending' ? 'font-semibold text-amber-600' : 'text-gray-400'}>{label[o.status]}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Copy({ label, value, mono = true, strong = false }: { label: string; value: string; mono?: boolean; strong?: boolean }) {
  const t = useT();
  const [ok, setOk] = useState(false);
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2">
      <div className="min-w-0">
        <div className="text-xs text-gray-500">{label}</div>
        <div className={`break-all text-sm ${mono ? 'font-mono' : ''} ${strong ? 'text-base font-bold text-slate-900' : 'text-slate-800'}`} dir="ltr">
          {value}
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(() => {
            setOk(true);
            window.setTimeout(() => setOk(false), 1500);
          });
        }}
        className="shrink-0 rounded-lg border bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700"
      >
        {ok ? `✓ ${t('Copied')}` : t('Copy')}
      </button>
    </div>
  );
}

function useLeft(until: string) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(iv);
  }, []);
  const s = Math.max(0, Math.round((new Date(until).getTime() - now) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function OrderView({ o }: { o: PayOrderView }) {
  const t = useT();
  const left = useLeft(o.expiresAt);
  const p = o.pay;
  const amount = payAmountText(o.method, o.amount);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => usePay.getState().back()} className="text-sm text-blue-700">
          ← {t('Back')}
        </button>
        <span className="font-mono text-xs text-gray-500">{o.code}</span>
      </div>
      <p className="flex items-center gap-1 text-lg font-bold text-sky-600">
        <Icon name="gem" size={20} /> {o.gems.toLocaleString('vi-VN')} {t('gems')}
      </p>
      {o.status === 'expired' ? (
        <p className="rounded-xl bg-gray-100 p-3 text-sm text-gray-700">{t('Time is up for this order. If you already sent the money, the gems still arrive when it does.')}</p>
      ) : null}
      {p?.kind === 'vnd' ? (
        <>
          <img src={p.qr} alt="VietQR" className="mx-auto w-60 max-w-full rounded-xl border bg-white" />
          <p className="text-center text-xs text-gray-500">{t('Scan with your banking app. The amount and the message are filled in for you.')}</p>
          <Copy label={t('Bank')} value={p.bank} mono={false} />
          <Copy label={t('Account number')} value={p.account} />
          <Copy label={t('Account name')} value={p.name} mono={false} />
          <Copy label={t('Amount')} value={String(o.amount)} strong />
          <Copy label={t('Transfer message (must be exact)')} value={p.content} strong />
        </>
      ) : p?.kind === 'usdt' ? (
        <>
          <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">⚠️ {t('Send USDT on the {network} network only. Money sent on another network or another coin is lost.', { network: p.network })}</p>
          <img src={p.qr} alt="QR" className="mx-auto w-52 max-w-full rounded-xl border bg-white" />
          <Copy label={t('Address ({network})', { network: p.network })} value={p.address} />
          <Copy label={t('Exact amount (USDT, the dot is the decimal point)')} value={amount.replace(' USDT', '')} strong />
          <p className="text-xs text-gray-600">{t('Send exactly this amount, decimals included: it tells us the money is yours. If your exchange takes a withdrawal fee, add it so that this exact amount arrives.')}</p>
        </>
      ) : null}
      {o.status === 'pending' ? (
        <div className="flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 animate-pulse rounded-full bg-amber-500" />
            {t('Waiting for the money…')}
          </span>
          <span className="font-mono">{left}</span>
        </div>
      ) : null}
      <button type="button" onClick={() => void usePay.getState().cancel()} className="w-full rounded-xl border py-2 text-sm text-gray-600">
        {t('Cancel this order')}
      </button>
    </div>
  );
}

function Done({ o }: { o: PayOrderView }) {
  const t = useT();
  return (
    <div className="space-y-4 py-6 text-center">
      <div className="text-5xl">🎉</div>
      <p className="text-lg font-bold text-emerald-700">{t('Top-up done!')}</p>
      <p className="flex items-center justify-center gap-1 text-2xl font-bold text-sky-600">
        +{o.gems.toLocaleString('vi-VN')} <Icon name="gem" size={24} />
      </p>
      <button type="button" onClick={() => usePay.getState().back()} className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white">
        {t('OK')}
      </button>
    </div>
  );
}
