import { useState } from 'react';
import { CROPS, LANGS, countryFlag, deviceModelName, type FarmState, type PlayerSettings } from '@es/shared';
import { api, get, useSession } from '../api';
import { go } from '../App';
import { ago, fmtDate, fmtNum, useL } from '../i18n';
import { AsyncBtn, Badge, Btn, Card, Field, Loaded, Modal, Num, Page, Select, Table, Text, confirmDialog, toast, useLoad } from '../ui';
import { UserBadges, type UserRow } from './Users';

interface Detail {
  user: UserRow & { avatarConfig: unknown; gameState: unknown };
  areas: { areas: Record<string, { learned: number; total: number; quiz: boolean }>; badges: string[] };
  farm: FarmState;
  attempts: { id: string; questId: string; npcId: string; status: string; score: number | null; turns: number; goalsDone: string[]; startedAt: string; finishedAt: string | null }[];
  vocabCount: number;
  vocab: { word: string; meaning: string; lang: string; intervalDays: number; nextReviewAt: string; createdAt: string }[];
  reportsBy: Report[];
  reportsAgainst: Report[];
  events: { name: string; props: Record<string, unknown>; createdAt: string }[];
  online: { sessionId: string; zone: string; x: number; z: number; ip: string; since: number }[];
}
interface Report {
  id: string;
  reporterId: string;
  targetName: string;
  reason: string;
  details: string;
  status: string;
  createdAt: string;
}
interface Transcript {
  transcript: { role: string; content: string }[];
  corrections: { original: string; corrected: string; explanation: string; type: string }[];
}

export function UserDetail({ id }: { id: string }) {
  const L = useL();
  const me = useSession((s) => s.me);
  const s = useLoad(() => get<Detail>(`/admin/users/${encodeURIComponent(id)}`), [id]);
  const [open, setOpen] = useState<string | null>(null);
  const [edit, setEdit] = useState(false);
  const post = (path: string, body: unknown = {}) => api('POST', `/admin/users/${encodeURIComponent(id)}${path}`, body);

  return (
    <Page
      title={
        <span>
          <a href="#/users" className="text-blue-700">
            {L('Người chơi', 'Players')}
          </a>{' '}
          / {s.data?.user.name ?? id}
        </span>
      }
      actions={s.data ? <Btn onClick={() => setEdit(true)}>✏️ {L('Sửa', 'Edit')}</Btn> : null}
    >
      <Loaded s={s}>
        {(d) => {
          const u = d.user;
          const banned = !!u.bannedUntil && new Date(u.bannedUntil).getTime() > Date.now();
          const muted = !!u.mutedUntil && new Date(u.mutedUntil).getTime() > Date.now();
          return (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card title={L('Hồ sơ', 'Profile')}>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                    <dt className="text-gray-500">ID</dt>
                    <dd className="font-mono text-xs break-all">{u.id}</dd>
                    <dt className="text-gray-500">Email</dt>
                    <dd>{u.email ?? <Badge>{L('khách', 'guest')}</Badge>}</dd>
                    <dt className="text-gray-500">{L('Trạng thái', 'Status')}</dt>
                    <dd>
                      <UserBadges u={u} /> {d.online.length ? <Badge tone="green">online · {d.online[0]!.zone}</Badge> : null}
                    </dd>
                    <dt className="text-gray-500">{L('Trình độ', 'Level')}</dt>
                    <dd>
                      {u.cefrLevel} {u.placementDoneAt ? '' : <span className="text-xs text-gray-500">({L('chưa làm test', 'no placement test')})</span>}
                    </dd>
                    <dt className="text-gray-500">XP · 🪙 · 🔥</dt>
                    <dd className="tabular-nums">
                      {fmtNum(u.xp)} · {fmtNum(u.coins)} · {u.streak}
                    </dd>
                    <dt className="text-gray-500">{L('Ngôn ngữ', 'Language')}</dt>
                    <dd>{u.nativeLang || '—'}</dd>
                    <dt className="text-gray-500">{L('Thiết bị', 'Device')}</dt>
                    <dd>
                      <DeviceDetails d={u.device} />
                    </dd>
                    <dt className="text-gray-500">IP</dt>
                    <dd className="font-mono text-xs">{u.lastIp || '—'}</dd>
                    <dt className="text-gray-500">{L('Tạo lúc', 'Created')}</dt>
                    <dd>{fmtDate(u.createdAt)}</dd>
                    <dt className="text-gray-500">{L('Hoạt động', 'Active')}</dt>
                    <dd>{ago(u.lastActiveAt)}</dd>
                    {banned ? (
                      <>
                        <dt className="text-gray-500">{L('Khoá đến', 'Banned until')}</dt>
                        <dd>
                          {u.bannedUntil!.startsWith('9999') ? L('vĩnh viễn', 'permanently') : fmtDate(u.bannedUntil)} — {u.banReason}
                        </dd>
                      </>
                    ) : null}
                    {muted ? (
                      <>
                        <dt className="text-gray-500">{L('Tắt chat đến', 'Muted until')}</dt>
                        <dd>{fmtDate(u.mutedUntil)}</dd>
                      </>
                    ) : null}
                  </dl>
                  {d.areas.badges.length ? <div className="mt-2 flex flex-wrap gap-1">{d.areas.badges.map((b) => <Badge key={b} tone="amber">🏅 {b}</Badge>)}</div> : null}
                </Card>
                <Card title={L('Tiến độ các khu', 'Area progress')}>
                  <ul className="flex flex-col gap-2 text-sm">
                    {Object.entries(d.areas.areas).map(([a, p]) => (
                      <li key={a}>
                        <div className="flex justify-between text-xs">
                          <span>{a}</span>
                          <span className="tabular-nums">
                            {p.learned}/{p.total} {p.quiz ? '✓ quiz' : ''}
                          </span>
                        </div>
                        <div className="h-2 rounded bg-gray-100">
                          <div className="h-2 rounded bg-[#2a78d6]" style={{ width: `${(p.learned / Math.max(1, p.total)) * 100}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
                <FarmCard d={d} onSaved={s.reload} id={id} />
              </div>

              <GameSettingsCard id={id} known={u.device?.settings} online={d.online.length > 0} onSaved={s.reload} />

              <Card title={L('Xử lý', 'Moderation')}>
                <div className="flex flex-wrap gap-2">
                  <ModerationButtons id={id} d={d} self={me?.id === u.id} reload={s.reload} post={post} />
                </div>
              </Card>

              <Card title={`${L('Nhiệm vụ đã chơi', 'Quest attempts')} (${d.attempts.length})`}>
                <Table
                  rows={d.attempts}
                  rowKey={(a) => a.id}
                  onRow={(a) => setOpen(a.id)}
                  cols={[
                    { key: 'q', label: L('Nhiệm vụ', 'Quest'), render: (a) => a.questId },
                    { key: 'n', label: 'NPC', render: (a) => a.npcId },
                    { key: 's', label: L('Kết quả', 'Result'), render: (a) => <Badge tone={a.status === 'completed' ? 'green' : a.status === 'active' ? 'blue' : 'gray'}>{a.status}</Badge> },
                    { key: 'score', label: L('Điểm', 'Score'), render: (a) => a.score ?? '—', className: 'text-right' },
                    { key: 't', label: L('Lượt', 'Turns'), render: (a) => a.turns, className: 'text-right', wide: true },
                    { key: 'd', label: L('Lúc', 'When'), render: (a) => fmtDate(a.startedAt) },
                  ]}
                />
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <Card title={`${L('Sổ tay từ vựng', 'Vocabulary notebook')} (${d.vocabCount})`}>
                  <div className="max-h-72 overflow-auto">
                    <Table
                      rows={d.vocab}
                      rowKey={(v) => v.word}
                      cols={[
                        { key: 'w', label: L('Từ', 'Word'), render: (v) => <b dir="ltr">{v.word}</b> },
                        { key: 'm', label: L('Nghĩa', 'Meaning'), render: (v) => v.meaning },
                        { key: 'i', label: L('Ôn sau (ngày)', 'Interval (d)'), render: (v) => v.intervalDays, className: 'text-right' },
                      ]}
                    />
                  </div>
                </Card>
                <Card title={L('Báo cáo', 'Reports')}>
                  <h3 className="mb-1 text-xs font-semibold text-gray-600">{L('Bị người khác báo cáo', 'Reported by others')}</h3>
                  <ReportList rows={d.reportsAgainst} />
                  <h3 className="mt-3 mb-1 text-xs font-semibold text-gray-600">{L('Đã báo cáo người khác', 'Reports sent')}</h3>
                  <ReportList rows={d.reportsBy} />
                </Card>
              </div>

              <Card title={L('Hoạt động gần đây', 'Recent activity')}>
                <ul className="max-h-72 overflow-auto text-xs">
                  {d.events.map((e, i) => (
                    <li key={i} className="border-b border-gray-100 py-1">
                      <span className="text-gray-500">{fmtDate(e.createdAt)}</span> · <b>{e.name}</b> <span className="text-gray-600">{JSON.stringify(e.props).slice(0, 160)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
              {open ? <AttemptModal uid={id} aid={open} onClose={() => setOpen(null)} /> : null}
              {edit ? <EditModal u={u} self={me?.id === u.id} onClose={() => setEdit(false)} onSaved={s.reload} /> : null}
            </>
          );
        }}
      </Loaded>
    </Page>
  );
}

/** Device of the last join: model, OS, browser / app, network, screen, GPU. */
function DeviceDetails({ d }: { d: UserRow['device'] }) {
  const L = useL();
  if (!d || !d.os) return <span className="text-gray-500">{L('chưa có (người chơi chưa vào lại từ khi bật tính năng này)', 'not known yet (no join since this was added)')}</span>;
  const net =
    d.network === 'wifi'
      ? 'Wi-Fi'
      : d.network === 'cellular'
        ? `${L('Dữ liệu di động', 'Mobile data')}${d.radio ? ` ${d.radio}` : ''}`
        : d.network === 'ethernet'
          ? L('Mạng dây', 'Cable')
          : d.network === 'offline'
            ? 'offline'
            : L('không rõ', 'unknown');
  return (
    <span className="block text-xs leading-5">
      <b>{deviceModelName(d) || (d.form === 'desktop' ? L('Máy tính', 'Computer') : d.form) || '—'}</b>
      {d.os === 'iOS' && !d.model && deviceModelName(d).startsWith('iPhone ') ? <span className="text-gray-500"> ({L('đoán theo màn hình', 'guessed from the screen')})</span> : null} · {d.os} {d.osVersion}
      <br />
      {d.kind === 'app' ? `App ${d.appVersion ?? ''}` : d.browser} · {net}
      {d.speed ? ` (${d.speed}${d.downlinkMbps ? `, ~${d.downlinkMbps} Mbps` : ''})` : d.downlinkMbps ? ` (~${d.downlinkMbps} Mbps)` : ''}
      <br />
      <span className="text-gray-500">
        {d.screen} {d.gpu ? `· ${d.gpu}` : ''}
      </span>
      <br />
      {d.country ? (
        <>
          {countryFlag(d.country)} {L('Quốc gia', 'Country')}: <b>{d.country}</b>
          {d.tz ? <span className="text-gray-500"> · {d.tz}</span> : null}
          <br />
        </>
      ) : null}
      {d.deviceId ? (
        <>
          {L('Mã thiết bị', 'Device id')}: <code className="text-[11px]">{d.deviceId}</code>
          <br />
        </>
      ) : null}
      {d.ua ? (
        <>
          <span className="break-all text-[11px] text-gray-500">User agent: {d.ua}</span>
          <br />
        </>
      ) : null}
      {d.gfx ? (
        <span>
          🎨 {L('Đồ hoạ', 'Graphics')}: <b>{d.gfx.quality === 'high' ? L('Cao ✨', 'High ✨') : L('Thấp ⚡', 'Low ⚡')}</b>
          {d.gfx.fps !== undefined ? (
            <>
              {' · '}
              <b className={d.gfx.fps >= 45 ? 'text-green-700' : d.gfx.fps >= 25 ? 'text-amber-700' : 'text-red-600'}>{d.gfx.fps} fps</b>
            </>
          ) : null}
          {d.gfx.dpr ? ` · ${d.gfx.dpr}x` : ''}
          {d.gfx.calls ? ` · ${d.gfx.calls} draw calls` : ''}
          {d.gfx.at ? <span className="text-gray-500"> · {new Date(d.gfx.at).toLocaleString()}</span> : null}
        </span>
      ) : (
        <span className="text-gray-500">🎨 {L('Đồ hoạ: chưa có', 'Graphics: not known yet')}</span>
      )}
    </span>
  );
}

function ReportList({ rows }: { rows: Report[] }) {
  const L = useL();
  if (!rows.length) return <p className="text-xs text-gray-500">{L('Không có', 'None')}</p>;
  return (
    <ul className="text-xs">
      {rows.map((r) => (
        <li key={r.id} className="border-b border-gray-100 py-1">
          {fmtDate(r.createdAt)} · <b>{r.reason}</b> {r.details} <Badge>{r.status}</Badge>
        </li>
      ))}
    </ul>
  );
}

function ModerationButtons({ id, d, self, reload, post }: { id: string; d: Detail; self: boolean; reload: () => void; post: (p: string, b?: unknown) => Promise<unknown> }) {
  const L = useL();
  const [ban, setBan] = useState(false);
  const [pw, setPw] = useState<string | null>(null);
  const u = d.user;
  const banned = !!u.bannedUntil && new Date(u.bannedUntil).getTime() > Date.now();
  const muted = !!u.mutedUntil && new Date(u.mutedUntil).getTime() > Date.now();
  const run = async (q: string, p: string, body?: unknown, ok?: string) => {
    if (!(await confirmDialog(q))) return;
    await post(p, body);
    toast(ok ?? L('Đã xong', 'Done'));
    reload();
  };
  return (
    <>
      {banned ? (
        <AsyncBtn onRun={() => run(L('Mở khoá tài khoản này?', 'Lift the ban?'), '/ban', { days: 0 })}>🔓 {L('Mở khoá', 'Unban')}</AsyncBtn>
      ) : (
        <Btn kind="danger" disabled={self} onClick={() => setBan(true)}>
          ⛔ {L('Khoá tài khoản', 'Ban')}
        </Btn>
      )}
      {muted ? (
        <AsyncBtn onRun={() => run(L('Cho chat lại?', 'Unmute?'), '/mute', { minutes: 0 })}>🔊 {L('Bỏ tắt chat', 'Unmute')}</AsyncBtn>
      ) : (
        <>
          <AsyncBtn onRun={() => run(L('Tắt chat 1 giờ?', 'Mute for 1 hour?'), '/mute', { minutes: 60 })}>🔇 {L('Tắt chat 1 giờ', 'Mute 1 h')}</AsyncBtn>
          <AsyncBtn onRun={() => run(L('Tắt chat 1 ngày?', 'Mute for 1 day?'), '/mute', { minutes: 1440 })}>🔇 {L('1 ngày', '1 day')}</AsyncBtn>
        </>
      )}
      <AsyncBtn disabled={!d.online.length} onRun={() => run(L('Đá người này ra khỏi phố?', 'Kick this player off the street?'), '/kick', { reason: 'Removed by a moderator.' })}>
        👢 {L('Đá ra khỏi game', 'Kick')}
      </AsyncBtn>
      <AsyncBtn disabled={!u.email} onRun={() => run(L('Đăng xuất người này khỏi mọi thiết bị?', 'Sign this player out everywhere?'), '/signout')}>🚪 {L('Đăng xuất mọi nơi', 'Sign out everywhere')}</AsyncBtn>
      <AsyncBtn
        disabled={!u.email}
        onRun={async () => {
          if (!(await confirmDialog(L('Tạo mật khẩu tạm thời? Mật khẩu cũ sẽ không dùng được nữa.', 'Create a temporary password? The old one stops working.')))) return;
          const r = (await post('/reset-password')) as { password: string };
          setPw(r.password);
        }}
      >
        🔑 {L('Mật khẩu tạm', 'Temporary password')}
      </AsyncBtn>
      <AsyncBtn
        onRun={async () => {
          if (!(await confirmDialog(L('Đặt lại Hành trình (chương, tem, việc hôm nay) của người này về đầu?', "Start this player's Journey (chapters, stamps, today's tasks) again?")))) return;
          await post('/journey/reset');
          toast(L('Đã đặt lại hành trình', 'Journey reset'));
        }}
      >
        ⭐ {L('Đặt lại hành trình', 'Reset journey')}
      </AsyncBtn>
      <AsyncBtn
        kind="danger"
        disabled={self}
        onRun={async () => {
          if (!(await confirmDialog(L('Xoá vĩnh viễn tài khoản và toàn bộ dữ liệu (nhiệm vụ, sổ tay, sự kiện)?', 'Delete the account and all its data (quests, notebook, events) for good?'), { danger: true, typeToConfirm: u.name }))) return;
          await api('DELETE', `/admin/users/${encodeURIComponent(id)}`, { confirm: u.name });
          toast(L('Đã xoá', 'Deleted'));
          go('users');
        }}
      >
        🗑 {L('Xoá tài khoản', 'Delete')}
      </AsyncBtn>
      {ban ? <BanModal onClose={() => setBan(false)} onBan={async (days, reason) => (await post('/ban', { days, reason }), toast(L('Đã khoá và đá ra khỏi game', 'Banned and kicked')), setBan(false), reload())} /> : null}
      {pw ? (
        <Modal title={L('Mật khẩu tạm thời', 'Temporary password')} onClose={() => setPw(null)}>
          <p className="mb-2 text-sm">{L('Gửi mật khẩu này cho người chơi (chỉ hiện một lần). Họ nên đổi ngay sau khi đăng nhập.', 'Pass this on to the player (shown once). They should change it after signing in.')}</p>
          <code className="block rounded bg-gray-100 p-3 text-center text-lg select-all">{pw}</code>
        </Modal>
      ) : null}
    </>
  );
}

function BanModal({ onClose, onBan }: { onClose: () => void; onBan: (days: number | null, reason: string) => Promise<void> }) {
  const L = useL();
  const [days, setDays] = useState('1');
  const [reason, setReason] = useState('');
  return (
    <Modal title={L('Khoá tài khoản', 'Ban account')} onClose={onClose}>
      <Field label={L('Thời gian', 'Duration')}>
        <Select
          value={days}
          onChange={setDays}
          options={[
            { value: '1', label: L('1 ngày', '1 day') },
            { value: '7', label: L('7 ngày', '7 days') },
            { value: '30', label: L('30 ngày', '30 days') },
            { value: 'forever', label: L('Vĩnh viễn', 'Permanently') },
          ]}
        />
      </Field>
      <Field label={L('Lý do (người chơi sẽ thấy)', 'Reason (shown to the player)')}>
        <Text value={reason} onChange={setReason} maxLength={300} />
      </Field>
      <div className="flex justify-end gap-2">
        <Btn onClick={onClose}>{L('Huỷ', 'Cancel')}</Btn>
        <AsyncBtn kind="danger" onRun={() => onBan(days === 'forever' ? null : Number(days), reason)}>
          ⛔ {L('Khoá', 'Ban')}
        </AsyncBtn>
      </div>
    </Modal>
  );
}

function EditModal({ u, self, onClose, onSaved }: { u: UserRow; self: boolean; onClose: () => void; onSaved: () => void }) {
  const L = useL();
  const [name, setName] = useState(u.name);
  const [level, setLevel] = useState(u.cefrLevel);
  const [role, setRole] = useState(u.role);
  const [coins, setCoins] = useState<number | undefined>(0);
  const [xp, setXp] = useState<number | undefined>(0);
  const [resetPlacement, setResetPlacement] = useState(false);
  return (
    <Modal title={L('Sửa người chơi', 'Edit player')} onClose={onClose}>
      <Field label={L('Tên hiển thị', 'Display name')} hint={L('Đổi khi tên vi phạm quy định.', 'Change it when the name breaks the rules.')}>
        <Text value={name} onChange={setName} maxLength={20} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={L('Trình độ', 'Level')}>
          <Select value={level} onChange={setLevel} options={['A1', 'A2', 'B1', 'B2', 'C1']} />
        </Field>
        <Field label={L('Vai trò', 'Role')} hint={self ? L('Không tự hạ quyền mình.', "You can't demote yourself.") : undefined}>
          <Select value={role} onChange={(v) => setRole(v)} options={['player', 'editor', 'admin'] as const} />
        </Field>
        <Field label={L('Cộng/trừ coins', 'Add/remove coins')} hint={`${L('hiện có', 'now')} ${u.coins}`}>
          <Num value={coins} onChange={setCoins} />
        </Field>
        <Field label={L('Cộng/trừ XP', 'Add/remove XP')} hint={`${L('hiện có', 'now')} ${u.xp}`}>
          <Num value={xp} onChange={setXp} />
        </Field>
      </div>
      <label className="mb-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={resetPlacement} onChange={(e) => setResetPlacement(e.target.checked)} /> {L('Cho làm lại bài test xếp lớp', 'Let them retake the placement test')}
      </label>
      <div className="flex justify-end gap-2">
        <Btn onClick={onClose}>{L('Huỷ', 'Cancel')}</Btn>
        <AsyncBtn
          kind="primary"
          okText={L('Đã lưu', 'Saved')}
          onRun={async () => {
            await api('PATCH', `/admin/users/${encodeURIComponent(u.id)}`, {
              ...(name !== u.name ? { name } : {}),
              ...(level !== u.cefrLevel ? { cefrLevel: level } : {}),
              ...(role !== u.role ? { role } : {}),
              ...(coins ? { coinsDelta: coins } : {}),
              ...(xp ? { xpDelta: xp } : {}),
              ...(resetPlacement ? { resetPlacement: true } : {}),
            });
            onSaved();
            onClose();
          }}
        >
          {L('Lưu', 'Save')}
        </AsyncBtn>
      </div>
    </Modal>
  );
}

function FarmCard({ d, id, onSaved }: { d: Detail; id: string; onSaved: () => void }) {
  const L = useL();
  const [basket, setBasket] = useState<Record<string, number | undefined>>(() => Object.fromEntries(CROPS.map((c) => [c, d.farm.basket[c] ?? 0])));
  return (
    <Card title={L('Nông trại của người chơi', 'Their farm')}>
      <div className="mb-2 text-xs text-gray-600">
        {L('Ruộng', 'Plots')}:{' '}
        {d.farm.plots.map((p, i) => (
          <Badge key={i} tone={p.crop ? 'green' : 'gray'}>
            {p.crop ?? L('trống', 'empty')}
            {p.crop && !p.wateredAt ? ` (${L('chưa tưới', 'not watered')})` : ''}
          </Badge>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {CROPS.map((c) => (
          <Field key={c} label={c} className="mb-1">
            <Num value={basket[c]} min={0} onChange={(v) => setBasket({ ...basket, [c]: v })} />
          </Field>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <AsyncBtn
          kind="primary"
          small
          okText={L('Đã lưu giỏ hàng', 'Basket saved')}
          onRun={async () => {
            await api('PATCH', `/admin/users/${encodeURIComponent(id)}`, { basket: Object.fromEntries(Object.entries(basket).map(([k, v]) => [k, v ?? 0])) });
            onSaved();
          }}
        >
          {L('Lưu số lượng', 'Save amounts')}
        </AsyncBtn>
        <AsyncBtn
          small
          kind="danger"
          onRun={async () => {
            if (!(await confirmDialog(L('Xoá hết cây đang trồng của người này?', 'Clear all their plots?')))) return;
            await api('PATCH', `/admin/users/${encodeURIComponent(id)}`, { resetPlots: true });
            toast(L('Đã dọn ruộng', 'Plots cleared'));
            onSaved();
          }}
        >
          {L('Dọn ruộng', 'Clear plots')}
        </AsyncBtn>
      </div>
    </Card>
  );
}

function AttemptModal({ uid, aid, onClose }: { uid: string; aid: string; onClose: () => void }) {
  const L = useL();
  const s = useLoad(() => get<Transcript & { questId: string; score: number | null; status: string }>(`/admin/users/${encodeURIComponent(uid)}/attempts/${aid}`), [aid]);
  return (
    <Modal title={L('Hội thoại', 'Conversation')} onClose={onClose} wide>
      <Loaded s={s}>
        {(a) => (
          <div className="max-h-[70vh] overflow-auto text-sm">
            <p className="mb-2 text-xs text-gray-500">
              {a.questId} · {a.status} · {L('điểm', 'score')} {a.score ?? '—'}
            </p>
            {(a.transcript ?? []).map((m, i) => (
              <div key={i} className={`mb-2 rounded-lg px-3 py-2 ${m.role === 'user' ? 'ml-10 bg-blue-50' : 'mr-10 bg-gray-50'}`} dir="ltr">
                <div className="text-xs text-gray-500">{m.role === 'user' ? L('Người chơi', 'Player') : 'NPC'}</div>
                {typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}
              </div>
            ))}
            {a.corrections?.length ? (
              <>
                <h4 className="mt-3 mb-1 font-semibold">{L('Lỗi đã sửa', 'Corrections')}</h4>
                <ul className="text-xs">
                  {a.corrections.map((c, i) => (
                    <li key={i} className="mb-1">
                      <s className="text-red-700">{c.original}</s> → <b className="text-emerald-800">{c.corrected}</b> <Badge>{c.type}</Badge> <span className="text-gray-600">{c.explanation}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        )}
      </Loaded>
    </Modal>
  );
}

/** The player's in-game settings: what their game last reported; saving pushes the change to their open game. */
function GameSettingsCard({ id, known, online, onSaved }: { id: string; known?: PlayerSettings; online: boolean; onSaved: () => void }) {
  const L = useL();
  const init: Required<PlayerSettings> = {
    quality: known?.quality ?? 'high',
    lang: known?.lang ?? 'vi',
    subtitles: known?.subtitles ?? 'off',
    ipa: known?.ipa ?? false,
    ttsRate: known?.ttsRate ?? 0.95,
    muted: known?.muted ?? false,
    ambientVolume: known?.ambientVolume ?? 0,
    micMode: known?.micMode ?? 'tap',
    skyTime: known?.skyTime ?? 'system',
    skyWeather: known?.skyWeather ?? 'system',
  };
  const [f, setF] = useState(init);
  const set = <K extends keyof PlayerSettings>(k: K, v: Required<PlayerSettings>[K]) => setF((o) => ({ ...o, [k]: v }));
  const onOff = [
    { value: 'on', label: L('Bật', 'On') },
    { value: 'off', label: L('Tắt', 'Off') },
  ] as const;
  const row = (label: string, el: React.ReactNode) => (
    <label className="grid grid-cols-[9rem_1fr] items-center gap-2 text-sm">
      <span className="text-gray-600">{label}</span>
      {el}
    </label>
  );
  return (
    <Card
      title={L('Cài đặt trong game', 'In-game settings')}
      actions={
        <span className="text-xs text-gray-500">
          {known ? L('Giá trị game báo về lần gần nhất', 'As last reported by their game') : L('Chưa có báo cáo từ game (đang hiện mặc định)', 'No report yet (showing defaults)')} ·{' '}
          {online ? <Badge tone="green">{L('online: áp dụng ngay', 'online: applies now')}</Badge> : <Badge>{L('offline: áp dụng khi vào lại', 'offline: applies on next join')}</Badge>}
        </span>
      }
    >
      <div className="grid gap-2 md:grid-cols-2">
        {row(L('Đồ hoạ', 'Graphics'), <Select value={f.quality} onChange={(v) => set('quality', v)} options={[{ value: 'high', label: L('Cao ✨', 'High ✨') }, { value: 'low', label: L('Thấp ⚡', 'Low ⚡') }]} />)}
        {row(L('Ngôn ngữ của tôi', 'My language'), <Select value={f.lang} onChange={(v) => set('lang', v)} options={LANGS.map((l) => ({ value: l.code, label: `${l.native} (${l.code})` }))} />)}
        {row(L('Phụ đề', 'Subtitles'), <Select value={f.subtitles} onChange={(v) => set('subtitles', v)} options={onOff} />)}
        {row('IPA', <Select value={f.ipa ? 'on' : 'off'} onChange={(v) => set('ipa', v === 'on')} options={onOff} />)}
        {row(L('Tắt giọng đọc', 'Voice muted'), <Select value={f.muted ? 'on' : 'off'} onChange={(v) => set('muted', v === 'on')} options={onOff} />)}
        {row(L('Tốc độ đọc', 'Speech rate'), <Select value={String(f.ttsRate)} onChange={(v) => set('ttsRate', Number(v))} options={['0.7', '0.8', '0.95', '1', '1.2'].map((v) => ({ value: v, label: `${v}x` }))} />)}
        {row(L('Tiếng chim', 'Bird sounds'), <Select value={String(f.ambientVolume)} onChange={(v) => set('ambientVolume', Number(v))} options={['0', '0.2', '0.4', '0.7', '1'].map((v) => ({ value: v, label: `${Math.round(Number(v) * 100)}%` }))} />)}
        {row('Mic', <Select value={f.micMode} onChange={(v) => set('micMode', v)} options={[{ value: 'tap', label: L('Chạm để nói', 'Tap to talk') }, { value: 'hold', label: L('Giữ để nói', 'Hold to talk') }]} />)}
        {row(L('Giờ trong game', 'Time of day'), <Select value={f.skyTime} onChange={(v) => set('skyTime', v)} options={['system', 'morning', 'noon', 'sunset', 'night'] as const} />)}
        {row(L('Thời tiết', 'Weather'), <Select value={f.skyWeather} onChange={(v) => set('skyWeather', v)} options={['system', 'clear', 'cloudy', 'rain', 'storm', 'fog'] as const} />)}
      </div>
      <div className="mt-3">
        <AsyncBtn
          kind="primary"
          onRun={async () => {
            const r = await api<{ applied: number; pending: boolean }>('POST', `/admin/users/${id}/settings`, f);
            toast(r.applied ? L(`Đã áp dụng ngay (${r.applied} phiên đang mở)`, `Applied now (${r.applied} open session)`) : L('Đã lưu — áp dụng khi người chơi vào lại', 'Saved — applies when they next join'));
            onSaved();
          }}
        >
          {L('Lưu và áp dụng', 'Save and apply')}
        </AsyncBtn>
      </div>
    </Card>
  );
}
