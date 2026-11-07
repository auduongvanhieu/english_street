import { useState } from 'react';
import { LANGS, countryFlag, deviceSummary, type DeviceInfo } from '@es/shared';
import { api, get, useSession } from '../api';
import { go } from '../App';
import { ago, fmtNum, useL } from '../i18n';
import { Badge, Btn, Card, Loaded, Page, Select, Table, Text, confirmDialog, toast, useLoad } from '../ui';

export interface UserRow {
  id: string;
  email: string | null;
  name: string;
  cefrLevel: string;
  xp: number;
  coins: number;
  streak: number;
  lastActiveAt: string;
  createdAt: string;
  nativeLang: string;
  role: 'player' | 'editor' | 'admin';
  bannedUntil: string | null;
  banReason: string;
  mutedUntil: string | null;
  placementDoneAt: string | null;
  reviewsDone: number;
  device?: Partial<DeviceInfo> | null;
  /** IP they last joined from ('' = not seen since IPs were recorded) */
  lastIp?: string;
}
export function UserBadges({ u }: { u: Pick<UserRow, 'email' | 'role' | 'bannedUntil' | 'mutedUntil'> }) {
  const L = useL();
  const now = Date.now();
  return (
    <span className="inline-flex flex-wrap gap-1">
      {!u.email ? <Badge>{L('khách', 'guest')}</Badge> : null}
      {u.role !== 'player' ? <Badge tone="violet">{u.role}</Badge> : null}
      {u.bannedUntil && new Date(u.bannedUntil).getTime() > now ? <Badge tone="red">{L('bị khoá', 'banned')}</Badge> : null}
      {u.mutedUntil && new Date(u.mutedUntil).getTime() > now ? <Badge tone="amber">{L('tắt chat', 'muted')}</Badge> : null}
    </span>
  );
}

export function UsersPage() {
  const L = useL();
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<'all' | 'registered' | 'guest' | 'banned' | 'muted' | 'staff'>('all');
  const [level, setLevel] = useState('');
  const [lang, setLang] = useState('');
  const [active, setActive] = useState('');
  const [sort, setSort] = useState<'recent' | 'created' | 'xp' | 'coins' | 'name'>('recent');
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ kind, sort, page: String(page), size: '50', ...(query ? { q: query } : {}), ...(level ? { level } : {}), ...(lang ? { lang } : {}), ...(active ? { active } : {}) });
  const meId = useSession((x) => x.me?.id);
  const s = useLoad(() => get<{ total: number; page: number; size: number; rows: UserRow[] }>(`/admin/users?${params}`), [params.toString()]);
  const reset = <T,>(f: (v: T) => void) => (v: T) => (f(v), setPage(1));
  return (
    <Page title={L('Người chơi', 'Players')}>
      <PasswordRequests />
      <Card>
        <form
          className="grid gap-2 md:grid-cols-[2fr_repeat(5,1fr)_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(q.trim());
            setPage(1);
          }}
        >
          <Text value={q} onChange={setQ} placeholder={L('Tên, email, id hoặc IP…', 'Name, e-mail, id or IP…')} aria-label={L('Tìm', 'Search')} />
          <Select
            aria-label={L('Loại', 'Kind')}
            value={kind}
            onChange={reset(setKind)}
            options={[
              { value: 'all', label: L('Tất cả', 'All') },
              { value: 'registered', label: L('Có tài khoản', 'Registered') },
              { value: 'guest', label: L('Khách', 'Guests') },
              { value: 'banned', label: L('Bị khoá', 'Banned') },
              { value: 'muted', label: L('Bị tắt chat', 'Muted') },
              { value: 'staff', label: L('Quản trị/biên tập', 'Staff') },
            ]}
          />
          <Select aria-label={L('Trình độ', 'Level')} value={level} onChange={reset(setLevel)} options={[{ value: '', label: L('Mọi trình độ', 'Any level') }, ...['A1', 'A2', 'B1', 'B2', 'C1'].map((x) => ({ value: x, label: x }))]} />
          <Select aria-label={L('Ngôn ngữ', 'Language')} value={lang} onChange={reset(setLang)} options={[{ value: '', label: L('Mọi ngôn ngữ', 'Any language') }, ...LANGS.map((l) => ({ value: l.code, label: l.native }))]} />
          <Select
            aria-label={L('Hoạt động', 'Active')}
            value={active}
            onChange={reset(setActive)}
            options={[
              { value: '', label: L('Bất kỳ lúc nào', 'Any time') },
              { value: '1', label: L('Hôm nay', 'Today') },
              { value: '7', label: L('7 ngày', '7 days') },
              { value: '30', label: L('30 ngày', '30 days') },
            ]}
          />
          <Select
            aria-label={L('Sắp xếp', 'Sort')}
            value={sort}
            onChange={reset(setSort)}
            options={[
              { value: 'recent', label: L('Mới hoạt động', 'Recently active') },
              { value: 'created', label: L('Mới tạo', 'Newest') },
              { value: 'xp', label: 'XP' },
              { value: 'coins', label: 'Coins' },
              { value: 'name', label: L('Tên', 'Name') },
            ]}
          />
          <Btn kind="primary" type="submit">
            {L('Tìm', 'Search')}
          </Btn>
        </form>
      </Card>
      <Card title={s.data ? `${fmtNum(s.data.total)} ${L('người chơi', 'players')}` : ''}>
        <Loaded s={s}>
          {(d) => (
            <>
              <Table
                rows={d.rows}
                rowKey={(u) => u.id}
                onRow={(u) => go(`users/${encodeURIComponent(u.id)}`)}
                cols={[
                  { key: 'name', label: L('Tên', 'Name'), render: (u) => <b>{u.name}</b> },
                  { key: 'email', label: 'Email', render: (u) => <span className="text-gray-600">{u.email ?? '—'}</span>, wide: true },
                  { key: 'flags', label: '', render: (u) => <UserBadges u={u} /> },
                  { key: 'level', label: L('Trình độ', 'Level'), render: (u) => u.cefrLevel },
                  { key: 'lang', label: L('Ngôn ngữ', 'Lang'), render: (u) => u.nativeLang || '—', wide: true },
                  { key: 'dev', label: L('Thiết bị', 'Device'), render: (u) => <span className="text-xs text-gray-600">{deviceSummary(u.device) || '—'}</span> },
                  { key: 'country', label: L('Nước', 'Country'), render: (u) => <span className="text-xs text-gray-600" title={u.device?.country ?? ''}>{u.device?.country ? `${countryFlag(u.device.country)} ${u.device.country}` : '—'}</span> },
                  { key: 'ip', label: 'IP', render: (u) => <span className="font-mono text-xs text-gray-600">{u.lastIp || '—'}</span>, wide: true },
                  { key: 'xp', label: 'XP', render: (u) => fmtNum(u.xp), className: 'text-right tabular-nums' },
                  { key: 'coins', label: '🪙', render: (u) => fmtNum(u.coins), className: 'text-right tabular-nums' },
                  { key: 'streak', label: '🔥', render: (u) => u.streak, className: 'text-right', wide: true },
                  { key: 'last', label: L('Hoạt động', 'Active'), render: (u) => ago(u.lastActiveAt) },
                  {
                    key: 'del',
                    label: '',
                    render: (u) =>
                      u.id === meId ? null : (
                        <button
                          type="button"
                          title={L('Xoá người chơi này', 'Delete this player')}
                          aria-label={L('Xoá người chơi này', 'Delete this player')}
                          className="rounded-lg px-2 py-1 text-red-600 hover:bg-red-50"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const ok = await confirmDialog(
                              L(`Xoá vĩnh viễn "${u.name}" và toàn bộ dữ liệu (nhiệm vụ, sổ tay, bạn bè, sự kiện)? Người đang chơi sẽ bị đá ra.`, `Delete "${u.name}" and all their data (quests, notebook, friends, events) for good? They are kicked if online.`),
                              { danger: true, typeToConfirm: u.name },
                            );
                            if (!ok) return;
                            try {
                              await api('DELETE', `/admin/users/${encodeURIComponent(u.id)}`, { confirm: u.name });
                              toast(L(`Đã xoá ${u.name}`, `Deleted ${u.name}`));
                              s.reload();
                            } catch (err) {
                              toast((err as Error).message);
                            }
                          }}
                        >
                          🗑
                        </button>
                      ),
                  },
                ]}
              />
              <div className="mt-3 flex items-center justify-end gap-2 text-sm">
                <Btn small disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  ←
                </Btn>
                <span>
                  {page} / {Math.max(1, Math.ceil(d.total / d.size))}
                </span>
                <Btn small disabled={page * d.size >= d.total} onClick={() => setPage(page + 1)}>
                  →
                </Btn>
              </div>
            </>
          )}
        </Loaded>
      </Card>
    </Page>
  );
}

interface PwRequest {
  id: string;
  name: string;
  email: string | null;
  at: string;
  contact: string;
  mailed: boolean;
  count: number;
}
/** "Forgot password" requests: give a temporary password (shown once, pass it on through their contact) or dismiss. */
function PasswordRequests() {
  const L = useL();
  const [n, setN] = useState(0);
  const s = useLoad(() => get<{ rows: PwRequest[] }>('/admin/users/password-requests'), [n]);
  const [temp, setTemp] = useState<Record<string, string>>({});
  const rows = s.data?.rows ?? [];
  if (!rows.length) return null;
  return (
    <Card title={`🔑 ${L('Yêu cầu quên mật khẩu', 'Forgot-password requests')} (${rows.length})`}>
      <ul className="divide-y text-sm">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
            <button type="button" className="font-semibold text-blue-700 underline" onClick={() => go(`users/${encodeURIComponent(r.id)}`)}>
              {r.name}
            </button>
            <span className="text-gray-600">{r.email}</span>
            {r.contact ? <Badge>📞 {r.contact}</Badge> : null}
            <span className="text-xs text-gray-500">
              {ago(r.at)}
              {r.count > 1 ? ` · ×${r.count}` : ''}
              {r.mailed ? ` · ${L('đã gửi email', 'e-mailed')}` : ''}
            </span>
            <span className="ml-auto flex items-center gap-2">
              {temp[r.id] ? (
                <span className="rounded bg-yellow-100 px-2 py-1 font-mono">
                  {L('Mật khẩu tạm', 'Temporary password')}: <b>{temp[r.id]}</b>
                </span>
              ) : (
                <Btn
                  kind="primary"
                  onClick={async () => {
                    if (!(await confirmDialog(L(`Tạo mật khẩu tạm cho ${r.name}? Mật khẩu cũ và các phiên đăng nhập sẽ hết hiệu lực.`, `Make a temporary password for ${r.name}? The old password and sessions stop working.`)))) return;
                    const x = await api<{ password: string }>('POST', `/admin/users/${encodeURIComponent(r.id)}/reset-password`);
                    setTemp((t) => ({ ...t, [r.id]: x.password }));
                    toast(L('Gửi mật khẩu này cho người chơi. Họ nên đổi lại trong Cài đặt.', 'Send this password to the player. They should change it in Settings.'));
                  }}
                >
                  {L('Cấp mật khẩu tạm', 'Temporary password')}
                </Btn>
              )}
              <Btn
                onClick={async () => {
                  await api('POST', `/admin/users/${encodeURIComponent(r.id)}/password-request/dismiss`);
                  setN((k) => k + 1);
                }}
              >
                {temp[r.id] ? L('Xong', 'Done') : L('Bỏ qua', 'Dismiss')}
              </Btn>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
