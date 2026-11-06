import { useState } from 'react';
import { LANGS, deviceSummary, type DeviceInfo } from '@es/shared';
import { get } from '../api';
import { go } from '../App';
import { ago, fmtNum, useL } from '../i18n';
import { Badge, Btn, Card, Loaded, Page, Select, Table, Text, useLoad } from '../ui';

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
  const s = useLoad(() => get<{ total: number; page: number; size: number; rows: UserRow[] }>(`/admin/users?${params}`), [params.toString()]);
  const reset = <T,>(f: (v: T) => void) => (v: T) => (f(v), setPage(1));
  return (
    <Page title={L('Người chơi', 'Players')}>
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
                  { key: 'ip', label: 'IP', render: (u) => <span className="font-mono text-xs text-gray-600">{u.lastIp || '—'}</span>, wide: true },
                  { key: 'xp', label: 'XP', render: (u) => fmtNum(u.xp), className: 'text-right tabular-nums' },
                  { key: 'coins', label: '🪙', render: (u) => fmtNum(u.coins), className: 'text-right tabular-nums' },
                  { key: 'streak', label: '🔥', render: (u) => u.streak, className: 'text-right', wide: true },
                  { key: 'last', label: L('Hoạt động', 'Active'), render: (u) => ago(u.lastActiveAt) },
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
