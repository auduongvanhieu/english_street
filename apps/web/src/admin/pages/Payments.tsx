import { useState } from 'react';
import { isTestOrderCode, payAmountText, type PayMethod } from '@es/shared';
import { api, get } from '../api';
import { fmtDate, useL } from '../i18n';
import { AsyncBtn, Badge, Card, Field, Loaded, Modal, Num, Page, Tabs, Text, Table, confirmDialog, toast, useLoad } from '../ui';
import { Limits } from './Settings';

interface Order {
  id: string;
  code: string;
  userId: string;
  pack: string;
  gems: number;
  method: PayMethod;
  amount: number;
  status: string;
  paidAmount: number;
  note: string;
  createdAt: string;
  paidAt: string | null;
  user: { id: string; name: string; email: string | null } | null;
}
interface Tx {
  id: string;
  source: 'sepay' | 'trc20' | 'bep20';
  txRef: string;
  amount: number;
  content: string;
  orderCode: string | null;
  note: string;
  createdAt: string;
}
interface Data {
  orders: Order[];
  unmatched: Tx[];
  byDay: Record<string, { vnd: number; usdt: number; gems: number; n: number }>;
  gemUse: { reason: string; source: string; gems: number; n: number }[];
  gemsHeld: number;
  bonusTurnsHeld: number;
  /** testers' paid orders (ESTEST…), not in byDay */
  test: { vnd: number; usdt: number; gems: number; n: number };
  testers: { key: string; user: { id: string; name: string; email: string | null } | null }[];
  config: { mode: 'off' | 'test' | 'on'; methods: PayMethod[]; sepayKey: boolean; chain: { trc20: { at: number; ok: boolean; error: string }; bep20: { at: number; ok: boolean; error: string; block: number } } };
}

const txMethod = (s: Tx['source']): PayMethod => (s === 'sepay' ? 'vnd' : s === 'trc20' ? 'usdt_trc20' : 'usdt_bep20');
const STATUS_TONE: Record<string, 'green' | 'amber' | 'gray' | 'red'> = { paid: 'green', pending: 'amber', expired: 'gray', cancelled: 'gray', refunded: 'red' };

/** Top-ups: money in, orders, transfers that matched nothing (fix by hand), refunds, settings. */
export function PaymentsPage() {
  const L = useL();
  const [tab, setTab] = useState<'overview' | 'orders' | 'review' | 'settings'>('overview');
  const s = useLoad(() => get<Data>('/admin/payments?days=60'));
  const n = s.data?.unmatched.length ?? 0;
  return (
    <Page title={`💎 ${L('Kim cương & nạp tiền', 'Gems & top-ups')}`}>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: L('Tổng quan', 'Overview') },
          { id: 'orders', label: L('Đơn nạp', 'Orders') },
          { id: 'review', label: <>{L('Cần xử lý', 'To review')} {n ? <Badge tone="red">{n}</Badge> : null}</> },
          { id: 'settings', label: L('Cài đặt', 'Settings') },
        ]}
      />
      {tab === 'settings' ? (
        <>
          <Card>
            <p className="text-sm text-slate-600">
              {L(
                'SePay: Webhooks → Thêm webhook → URL "https://<tên miền>/api/pay/webhook/sepay", kiểu chứng thực "API Key", rồi đặt SEPAY_API_KEY trong .env của server (cần khởi động lại API). Ví USDT: chỉ nhập địa chỉ, không bao giờ nhập khoá riêng.',
                'SePay: Webhooks → add → URL "https://<domain>/api/pay/webhook/sepay", auth "API Key", then set SEPAY_API_KEY in the server .env (restart the API). USDT wallets: addresses only, never a private key.',
              )}
            </p>
          </Card>
          <Loaded s={s}>{(d) => <Testers d={d} reload={s.reload} />}</Loaded>
          <Limits keys={['payMode', 'payVnd', 'payUsdt', 'payFirstBonus', 'payOrderMinutes', 'payBank', 'payBankAccount', 'payBankName', 'payTrc20Address', 'payBep20Address', 'payBep20Confirmations', 'payPacks', 'gemRate', 'gemTurnPack', 'npcPaidDailyBudgetUsd', 'gemGiftStreak', 'gemGiftChapter', 'gemPrices']} />
        </>
      ) : (
        <Loaded s={s}>
          {(d) => (tab === 'overview' ? <Overview d={d} /> : tab === 'orders' ? <Orders d={d} reload={s.reload} /> : <Review d={d} reload={s.reload} />)}
        </Loaded>
      )}
    </Page>
  );
}

function Overview({ d }: { d: Data }) {
  const L = useL();
  const days = Object.entries(d.byDay).sort((a, b) => b[0].localeCompare(a[0]));
  const sum = days.reduce((s, [, v]) => ({ vnd: s.vnd + v.vnd, usdt: s.usdt + v.usdt, n: s.n + v.n, gems: s.gems + v.gems }), { vnd: 0, usdt: 0, n: 0, gems: 0 });
  const c = d.config;
  const ago = (ms: number) => (ms ? `${Math.round((Date.now() - ms) / 1000)}s` : '—');
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-4">
        <Card title={L('Chế độ', 'Mode')}>
          <Badge tone={c.mode === 'on' ? 'green' : c.mode === 'test' ? 'amber' : 'gray'}>{c.mode}</Badge>
          <p className="mt-1 text-xs text-slate-500">{c.methods.join(', ') || L('chưa cài cách trả nào', 'no way to pay set up')}</p>
        </Card>
        <Card title={L('Tiền về (60 ngày)', 'Money in (60 days)')}>
          <p className="text-lg font-bold">{payAmountText('vnd', sum.vnd)}</p>
          <p className="text-sm">{payAmountText('usdt_trc20', sum.usdt)}</p>
          {d.test.n ? (
            <p className="mt-1 text-xs text-slate-500">
              {L('Không tính', 'Not counted')} {d.test.n} {L('đơn thử', 'test orders')}: {[d.test.vnd ? payAmountText('vnd', d.test.vnd) : '', d.test.usdt ? payAmountText('usdt_trc20', d.test.usdt) : ''].filter(Boolean).join(' · ')}
            </p>
          ) : null}
        </Card>
        <Card title={L('Đơn đã trả', 'Paid orders')}>
          <p className="text-lg font-bold">{sum.n}</p>
          <p className="text-xs text-slate-500">{sum.gems.toLocaleString('vi-VN')} {L('💎 đã bán', 'gems sold')}</p>
        </Card>
        <Card title={L('Kết nối', 'Connections')}>
          <p className="text-xs">SePay key: {c.sepayKey ? <Badge tone="green">OK</Badge> : <Badge tone="red">{L('chưa đặt', 'not set')}</Badge>}</p>
          <p className="text-xs">
            TRC20: {c.chain.trc20.ok ? 'OK' : <span className="text-red-600">{c.chain.trc20.error}</span>} · {ago(c.chain.trc20.at)}
          </p>
          <p className="text-xs">
            BEP20: {c.chain.bep20.ok ? 'OK' : <span className="text-red-600">{c.chain.bep20.error}</span>} · {ago(c.chain.bep20.at)}
          </p>
        </Card>
      </div>
      <Card title={L('Theo ngày (giờ Việt Nam)', 'By day (Vietnam time)')} className="mt-3">
        <Table
          rows={days}
          rowKey={([day]) => day}
          cols={[
            { key: 'day', label: L('Ngày', 'Day'), render: ([day]) => day },
            { key: 'n', label: L('Đơn', 'Orders'), render: ([, v]) => v.n },
            { key: 'vnd', label: 'VNĐ', render: ([, v]) => payAmountText('vnd', v.vnd) },
            { key: 'usdt', label: 'USDT', render: ([, v]) => payAmountText('usdt_trc20', v.usdt) },
            { key: 'gems', label: '💎', render: ([, v]) => v.gems.toLocaleString('vi-VN') },
          ]}
        />
      </Card>
      <Card title={L('💎 Kim cương đi đâu (60 ngày)', '💎 Where gems went (60 days)')} className="mt-3">
        <p className="mb-2 text-xs text-slate-500">
          {L('Người chơi đang giữ', 'Players hold')} <b>{d.gemsHeld.toLocaleString('vi-VN')} 💎</b> · {L('lượt NPC đã mua chưa dùng', 'bought NPC turns not used yet')}: <b>{d.bonusTurnsHeld.toLocaleString('vi-VN')}</b>
        </p>
        <Table
          rows={d.gemUse}
          rowKey={(r) => `${r.reason}:${r.source}`}
          cols={[
            { key: 'reason', label: L('Loại', 'Kind'), render: (r) => GEM_REASON[r.reason]?.(L) ?? r.reason },
            { key: 'source', label: L('Vào việc', 'For'), render: (r) => r.source || '—' },
            { key: 'n', label: L('Lần', 'Times'), render: (r) => r.n },
            { key: 'gems', label: '💎', render: (r) => <span className={r.gems < 0 ? 'text-red-600' : 'text-emerald-700'}>{r.gems > 0 ? '+' : ''}{r.gems.toLocaleString('vi-VN')}</span> },
          ]}
        />
      </Card>
    </>
  );
}

const GEM_REASON: Record<string, (L: (vi: string, en: string) => string) => string> = {
  purchase: (L) => L('Nạp tiền', 'Top-up'),
  reward: (L) => L('Quà tặng', 'Gift'),
  spend: (L) => L('Mua đồ / lượt NPC', 'Items / NPC turns'),
  exchange: (L) => L('Đổi sang xu', 'Into coins'),
  refund: (L) => L('Hoàn đơn', 'Refund'),
  admin: (L) => L('Admin sửa', 'Admin change'),
};

function Orders({ d, reload }: { d: Data; reload: () => void }) {
  const L = useL();
  const [q, setQ] = useState('');
  const rows = d.orders.filter((o) => !q || `${o.code} ${o.user?.name ?? ''} ${o.user?.email ?? ''} ${o.userId}`.toLowerCase().includes(q.toLowerCase()));
  const refund = async (o: Order) => {
    if (!(await confirmDialog(L(`Hoàn đơn ${o.code}? Game sẽ lấy lại ${o.gems} 💎 (hoặc số còn lại). Tiền phải tự chuyển trả cho người chơi.`, `Refund ${o.code}? The game takes back ${o.gems} gems (or what is left). Send the money back yourself.`), { danger: true }))) return;
    const r = await api<{ taken: number }>('POST', `/admin/payments/orders/${o.code}/refund`, { note: '' });
    toast(L(`Đã lấy lại ${r.taken} 💎`, `Took back ${r.taken} gems`));
    reload();
  };
  return (
    <Card>
      <div className="mb-3 max-w-xs">
        <Text value={q} onChange={setQ} placeholder={L('Tìm mã đơn, tên, email…', 'Search code, name, e-mail…')} />
      </div>
      <Table
        rows={rows}
        rowKey={(o) => o.id}
        cols={[
          { key: 'code', label: L('Mã', 'Code'), render: (o) => (
            <span className="font-mono">
              {o.code} {isTestOrderCode(o.code) ? <Badge tone="amber">{L('thử', 'test')}</Badge> : null}
            </span>
          ) },
          { key: 'user', label: L('Người chơi', 'Player'), render: (o) => <a href={`#/users/${o.userId}`} className="text-indigo-600 hover:underline">{o.user?.name ?? o.userId}</a> },
          { key: 'amount', label: L('Số tiền', 'Amount'), render: (o) => payAmountText(o.method, o.amount) },
          { key: 'gems', label: '💎', render: (o) => o.gems.toLocaleString('vi-VN') },
          { key: 'status', label: L('Trạng thái', 'Status'), render: (o) => <Badge tone={STATUS_TONE[o.status] ?? 'gray'}>{o.status}</Badge> },
          { key: 'at', label: L('Lúc', 'When'), wide: true, render: (o) => fmtDate(o.paidAt ?? o.createdAt) },
          { key: 'note', label: L('Ghi chú', 'Note'), wide: true, render: (o) => <span className="text-xs text-slate-500">{o.note}</span> },
          {
            key: 'act',
            label: '',
            render: (o) =>
              o.status === 'paid' ? (
                <AsyncBtn small kind="ghost" onRun={() => refund(o)}>
                  {L('Hoàn', 'Refund')}
                </AsyncBtn>
              ) : null,
          },
        ]}
      />
    </Card>
  );
}

function Review({ d, reload }: { d: Data; reload: () => void }) {
  const L = useL();
  const [fix, setFix] = useState<Tx | null>(null);
  const why: Record<string, string> = {
    no_order: L('không tìm thấy mã đơn', 'no order code found'),
    underpaid: L('chuyển thiếu', 'paid too little'),
    already_paid: L('đơn đã trả rồi (chuyển 2 lần?)', 'order already paid (sent twice?)'),
    wrong_method: L('sai cách trả', 'wrong way to pay'),
  };
  const ignore = async (t: Tx) => {
    if (!(await confirmDialog(L('Bỏ qua giao dịch này (không cộng 💎)?', 'Ignore this transfer (no gems)?')))) return;
    await api('POST', `/admin/payments/tx/${t.id}/ignore`, { note: '' });
    reload();
  };
  return (
    <Card>
      <p className="mb-3 text-sm text-slate-600">{L('Tiền đã về nhưng không khớp đơn nào. Gán cho đơn đúng (cộng 💎 theo gói) hoặc cộng 💎 trực tiếp cho người chơi, hay bỏ qua nếu không phải tiền nạp.', 'Money that arrived but matched no order. Pay the right order with it, give gems to a player directly, or ignore it if it is not a top-up.')}</p>
      <Table
        rows={d.unmatched}
        rowKey={(t) => t.id}
        empty={L('Không có gì cần xử lý 🎉', 'Nothing to review 🎉')}
        cols={[
          { key: 'at', label: L('Lúc', 'When'), render: (t) => fmtDate(t.createdAt) },
          { key: 'src', label: L('Nguồn', 'Source'), render: (t) => t.source },
          { key: 'amount', label: L('Số tiền', 'Amount'), render: (t) => payAmountText(txMethod(t.source), t.amount) },
          { key: 'content', label: L('Nội dung / người gửi', 'Content / sender'), render: (t) => <span className="break-all text-xs">{t.content}</span> },
          { key: 'why', label: L('Lý do', 'Why'), render: (t) => <span className="text-xs">{why[t.note] ?? t.note} {t.orderCode ? <span className="font-mono">({t.orderCode})</span> : null}</span> },
          {
            key: 'act',
            label: '',
            render: (t) => (
              <div className="flex gap-1">
                <AsyncBtn small kind="primary" onRun={async () => setFix(t)}>
                  {L('Xử lý', 'Fix')}
                </AsyncBtn>
                <AsyncBtn small kind="ghost" onRun={() => ignore(t)}>
                  {L('Bỏ qua', 'Ignore')}
                </AsyncBtn>
              </div>
            ),
          },
        ]}
      />
      {fix ? <Assign t={fix} onClose={() => setFix(null)} onDone={() => (setFix(null), reload())} /> : null}
    </Card>
  );
}

function Assign({ t, onClose, onDone }: { t: Tx; onClose: () => void; onDone: () => void }) {
  const L = useL();
  const [code, setCode] = useState(t.orderCode ?? '');
  const [userId, setUserId] = useState('');
  const [gems, setGems] = useState<number | undefined>(undefined);
  const run = async (body: object) => {
    const r = await api<{ gems: number }>('POST', `/admin/payments/tx/${t.id}/assign`, body);
    toast(L(`Đã cộng ${r.gems} 💎`, `Credited ${r.gems} gems`));
    onDone();
  };
  return (
    <Modal title={`${L('Xử lý giao dịch', 'Fix transfer')} · ${payAmountText(txMethod(t.source), t.amount)}`} onClose={onClose}>
      <p className="mb-3 break-all text-xs text-slate-500">{t.content}</p>
      <Field label={L('Gán cho đơn (cộng 💎 theo gói của đơn)', 'Pay an order (gems of its pack)')}>
        <div className="flex gap-1">
          <Text value={code} onChange={(v) => setCode(v.toUpperCase())} placeholder="ES…" />
          <AsyncBtn kind="primary" disabled={!/^ES(TEST)?[A-Z0-9]{6}$/.test(code)} onRun={() => run({ code })}>
            {L('Gán', 'Assign')}
          </AsyncBtn>
        </div>
      </Field>
      <Field label={L('Hoặc cộng 💎 trực tiếp cho người chơi (id)', 'Or give gems to a player (id)')}>
        <div className="flex gap-1">
          <Text value={userId} onChange={setUserId} placeholder="user id" />
          <Num value={gems} onChange={setGems} placeholder="💎" />
          <AsyncBtn kind="primary" disabled={!userId || !gems} onRun={() => run({ userId, gems })}>
            {L('Cộng', 'Give')}
          </AsyncBtn>
        </div>
      </Field>
    </Modal>
  );
}

/** Testers: may top up while the mode is "testers only"; their orders get an ESTEST… code and are not revenue. */
function Testers({ d, reload }: { d: Data; reload: () => void }) {
  const L = useL();
  const [add, setAdd] = useState('');
  const keys = d.testers.map((t) => t.key);
  const next = add.trim().toLowerCase();
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next) || /^[a-z0-9_-]{3,80}$/.test(next);
  const save = async (list: string[]) => {
    await api('PUT', '/admin/settings/payTesters', { value: list });
    toast(L('Đã lưu', 'Saved'));
    reload();
  };
  return (
    <Card title={L('Người thử nghiệm nạp tiền', 'Top-up testers')} className="mb-3">
      <p className="mb-3 text-sm text-slate-600">
        {L(
          'Những người này nạp được khi chế độ là "Chỉ người thử". Đơn của họ có mã bắt đầu bằng ESTEST, vẫn được cộng 💎 như thường nhưng không tính vào doanh thu (kể cả khi đã mở cho mọi người).',
          'These players can top up while the mode is "Testers only". Their orders get a code starting with ESTEST: gems are credited as usual, but the money is not counted as revenue (also once top-ups are open to everyone).',
        )}
      </p>
      <div className="mb-3 flex max-w-md gap-1">
        <Text value={add} onChange={setAdd} placeholder={L('email hoặc id người chơi', 'e-mail or player id')} />
        <AsyncBtn kind="primary" disabled={!ok || keys.includes(next)} onRun={async () => (await save([...keys, next]), setAdd(''))}>
          {L('Thêm', 'Add')}
        </AsyncBtn>
      </div>
      <Table
        rows={d.testers}
        rowKey={(t) => t.key}
        empty={L('Chưa có ai', 'Nobody yet')}
        cols={[
          { key: 'key', label: L('Email / id', 'E-mail / id'), render: (t) => <span className="font-mono text-xs">{t.key}</span> },
          {
            key: 'user',
            label: L('Tài khoản', 'Account'),
            render: (t) => (t.user ? <a href={`#/users/${t.user.id}`} className="text-indigo-600 hover:underline">{t.user.name}</a> : <span className="text-xs text-slate-400">{L('chưa có tài khoản', 'no account yet')}</span>),
          },
          {
            key: 'act',
            label: '',
            render: (t) => (
              <AsyncBtn small kind="ghost" onRun={async () => (await confirmDialog(L(`Bỏ ${t.key} khỏi danh sách thử?`, `Remove ${t.key} from the testers?`))) && save(keys.filter((k) => k !== t.key))}>
                {L('Bỏ', 'Remove')}
              </AsyncBtn>
            ),
          },
        ]}
      />
    </Card>
  );
}
