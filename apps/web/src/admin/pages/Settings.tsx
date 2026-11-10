import { useState } from 'react';
import { api, get } from '../api';
import { fmtDate, useL } from '../i18n';
import { AsyncBtn, Badge, Card, Field, ListInput, Loaded, Num, Page, Select, Tabs, Text, Area, confirmDialog, toast, useLoad } from '../ui';

interface SettingRow {
  key: string;
  value: unknown;
  default: unknown;
  isDefault: boolean;
}
const DESC: Record<string, [string, string, 'number' | 'text' | 'list' | 'long' | 'bool' | 'json' | 'mode']> = {
  maxGuestsPerIp: ['Số khách chơi cùng lúc từ một IP', 'Guests playing at once from one IP', 'number'],
  guestPassesPerIpHour: ['Số vé khách mỗi IP mỗi giờ', 'Guest passes per IP per hour', 'number'],
  guestPassesPerIpDay: ['Số vé khách mỗi IP mỗi ngày', 'Guest passes per IP per day', 'number'],
  npcDailyBudgetUsd: ['Ngân sách Claude mỗi ngày (USD)', 'Daily Claude budget (USD)', 'number'],
  npcDailyTurnsPerPlayer: ['Số lượt nói với NPC mỗi người mỗi ngày', 'NPC turns per player per day', 'number'],
  npcRatePerMin: ['Số lượt NPC tối đa mỗi phút mỗi người', 'Max NPC turns per minute per player', 'number'],
  npcModel: ['Model cho NPC trình độ B1+ và chấm điểm', 'Model for B1+ NPCs and grading', 'text'],
  npcModelBasic: ['Model cho NPC A1–A2 và nói chuyện tự do', 'Model for A1–A2 NPCs and free talk', 'text'],
  translateModel: ['Model dịch nội dung (tự dịch khi sửa nội dung)', 'Model for content translation (auto-translate)', 'text'],
  adminTestTurnsPerDay: ['Lượt "thử NPC" mỗi admin mỗi ngày', '"Try the NPC" turns per admin per day', 'number'],
  maintenance: ['Chế độ bảo trì (để trống = đang mở)', 'Maintenance message (empty = open)', 'long'],
  extraBannedWords: ['Từ cấm thêm (bộ lọc chat)', 'Extra banned words (chat filter)', 'list'],
  allowedWords: ['Bỏ chặn từ có sẵn', 'Allow built-in words again', 'list'],
  payMode: ['Nạp xu: tắt / chỉ người thử / mở cho mọi người', 'Top-ups: off / testers only / everyone', 'mode'],
  payTesters: ['Người thử (id hoặc email)', 'Testers (id or e-mail)', 'list'],
  payVnd: ['Cho nạp bằng chuyển khoản VNĐ', 'Allow bank transfer (VND)', 'bool'],
  payUsdt: ['Cho nạp bằng USDT', 'Allow USDT', 'bool'],
  payPacks: ['Các gói xu (id, coins, vnd, usdt)', 'Coin packs (id, coins, vnd, usdt)', 'json'],
  payFirstBonus: ['Lần nạp đầu được gấp đôi xu', 'First top-up gives double coins', 'bool'],
  payOrderMinutes: ['Thời gian chờ mỗi đơn (phút)', 'Order wait time (minutes)', 'number'],
  payBank: ['Ngân hàng (mã VietQR, vd MB, VCB, 970422)', 'Bank (VietQR code, e.g. MB, VCB, 970422)', 'text'],
  payBankAccount: ['Số tài khoản', 'Account number', 'text'],
  payBankName: ['Tên chủ tài khoản (không dấu)', 'Account holder name', 'text'],
  payTrc20Address: ['Ví nhận USDT TRC20 (Tron, bắt đầu bằng T)', 'USDT TRC20 wallet (Tron, starts with T)', 'text'],
  payBep20Address: ['Ví nhận USDT BEP20 (BNB Chain, 0x…)', 'USDT BEP20 wallet (BNB Chain, 0x…)', 'text'],
  payBep20Confirmations: ['BEP20: số block chờ xác nhận', 'BEP20: blocks to wait', 'number'],
};

export function SettingsPage() {
  const L = useL();
  const [tab, setTab] = useState<'limits' | 'notices' | 'beta' | 'words'>('limits');
  return (
    <Page title={`⚙️ ${L('Cài đặt vận hành', 'Operations settings')}`}>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'limits', label: L('Giới hạn & model', 'Limits & models') },
          { id: 'notices', label: L('Thông báo & bảo trì', 'Notices & maintenance') },
          { id: 'beta', label: L('Mã mời beta', 'Beta invite codes') },
          { id: 'words', label: L('Bộ lọc chat', 'Chat filter') },
        ]}
      />
      {tab === 'limits' ? <Limits keys={['maxGuestsPerIp', 'guestPassesPerIpHour', 'guestPassesPerIpDay', 'npcDailyBudgetUsd', 'npcDailyTurnsPerPlayer', 'npcRatePerMin', 'npcModel', 'npcModelBasic', 'translateModel', 'adminTestTurnsPerDay']} /> : null}
      {tab === 'notices' ? (
        <>
          <Limits keys={['maintenance']} />
          <Announcements />
        </>
      ) : null}
      {tab === 'beta' ? <Beta /> : null}
      {tab === 'words' ? <Words /> : null}
    </Page>
  );
}

function useSettings() {
  return useLoad(() => get<{ settings: SettingRow[]; builtinBadWords: string[]; betaGate: boolean }>('/admin/settings'));
}

export function Limits({ keys }: { keys: string[] }) {
  const L = useL();
  const s = useSettings();
  return (
    <Card>
      <p className="mb-3 text-xs text-gray-600">{L('Áp dụng ngay, không cần khởi động lại. "Mặc định" là giá trị trong .env.', 'Applies at once, no restart. "Default" is the .env value.')}</p>
      <Loaded s={s}>
        {(d) => (
          <div className="grid gap-x-6 md:grid-cols-2">
            {d.settings
              .filter((x) => keys.includes(x.key))
              .map((x) => (
                <SettingField key={x.key} row={x} onSaved={s.reload} />
              ))}
          </div>
        )}
      </Loaded>
    </Card>
  );
}

function SettingField({ row, onSaved }: { row: SettingRow; onSaved: () => void }) {
  const L = useL();
  const [vi, en, type] = DESC[row.key] ?? [row.key, row.key, 'text'];
  const [v, setV] = useState<unknown>(row.value);
  const changed = JSON.stringify(v) !== JSON.stringify(row.value);
  const save = async (value: unknown) => {
    if (row.key === 'maintenance' && value && !(await confirmDialog(L('Bật bảo trì? Người chơi sẽ thấy thông báo thay vì con phố.', 'Turn maintenance on? Players will see the message instead of the street.')))) return;
    await api('PUT', `/admin/settings/${row.key}`, { value });
    toast(L('Đã lưu', 'Saved'));
    onSaved();
  };
  return (
    <Field
      label={
        <span>
          {L(vi, en)} {row.isDefault ? <Badge>{L('mặc định', 'default')}</Badge> : <Badge tone="amber">{L('đã đổi', 'changed')}</Badge>}
        </span>
      }
      hint={`${L('Mặc định', 'Default')}: ${Array.isArray(row.default) ? row.default.map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(', ') || '—' : String(row.default) || '—'}`}
    >
      <div className="flex gap-1">
        {type === 'number' ? (
          <Num value={v as number} onChange={setV} step="any" />
        ) : type === 'bool' ? (
          <Select value={v ? 'true' : 'false'} onChange={(x) => setV(x === 'true')} options={[{ value: 'true', label: L('Bật', 'On') }, { value: 'false', label: L('Tắt', 'Off') }]} />
        ) : type === 'mode' ? (
          <Select value={String(v)} onChange={setV} options={[{ value: 'off', label: L('Tắt', 'Off') }, { value: 'test', label: L('Chỉ người thử', 'Testers only') }, { value: 'on', label: L('Mở cho mọi người', 'Everyone') }]} />
        ) : type === 'json' ? (
          <JsonText value={v} onChange={setV} />
        ) : type === 'list' ? (
          <ListInput value={v as string[]} onChange={setV} />
        ) : type === 'long' ? (
          <Area rows={2} value={v as string} onChange={setV} />
        ) : row.key.startsWith('npcModel') || row.key === 'translateModel' ? (
          <Select value={String(v)} onChange={setV} options={[...new Set([String(v), 'claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-1'])]} />
        ) : (
          <Text value={String(v ?? '')} onChange={setV} />
        )}
        <AsyncBtn kind="primary" disabled={!changed} onRun={() => save(v)}>
          {L('Lưu', 'Save')}
        </AsyncBtn>
        {!row.isDefault ? (
          <AsyncBtn kind="ghost" onRun={() => save(null)} aria-label={L('Về mặc định', 'Reset')}>
            ↺
          </AsyncBtn>
        ) : null}
      </div>
    </Field>
  );
}

/** JSON in a text box; only valid JSON reaches the setting. */
function JsonText({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const [txt, setTxt] = useState(() => JSON.stringify(value, null, 1));
  const [bad, setBad] = useState(false);
  return (
    <div className="flex-1">
      <Area
        rows={6}
        value={txt}
        onChange={(t) => {
          setTxt(t);
          try {
            onChange(JSON.parse(t));
            setBad(false);
          } catch {
            setBad(true);
          }
        }}
      />
      {bad ? <p className="text-xs text-red-600">JSON?</p> : null}
    </div>
  );
}

function Announcements() {
  const L = useL();
  const s = useLoad(() => get<{ id: string; text: string; level: string; startsAt: string; endsAt: string; createdBy: string }[]>('/admin/announcements'));
  const [text, setText] = useState('');
  const [level, setLevel] = useState<'info' | 'warning'>('info');
  const [hours, setHours] = useState<number | undefined>(24);
  const now = Date.now();
  return (
    <Card title={L('Thông báo cho mọi người chơi', 'Announcements to every player')}>
      <div className="mb-4 grid gap-2 md:grid-cols-[1fr_8rem_8rem_auto]">
        <Text value={text} onChange={setText} maxLength={300} placeholder={L('Ví dụ: Server bảo trì lúc 22:00 tối nay', 'e.g. Maintenance tonight at 22:00')} aria-label={L('Nội dung', 'Text')} />
        <Select value={level} onChange={setLevel} options={[{ value: 'info', label: L('Thông tin', 'Info') }, { value: 'warning', label: L('Cảnh báo', 'Warning') }]} />
        <Num value={hours} onChange={setHours} min={0.1} step={1} aria-label={L('Hiện trong (giờ)', 'Show for (hours)')} placeholder={L('giờ', 'hours')} />
        <AsyncBtn
          kind="primary"
          disabled={text.trim().length < 2 || !hours}
          onRun={async () => {
            const r = await api<{ pushed: boolean }>('POST', '/admin/announcements', { text, level, endsAt: new Date(Date.now() + (hours ?? 24) * 3600e3).toISOString() });
            toast(r.pushed ? L('Đã gửi tới mọi người đang chơi', 'Sent to everyone playing') : L('Đã lưu', 'Saved'));
            setText('');
            s.reload();
          }}
        >
          📣 {L('Gửi', 'Send')}
        </AsyncBtn>
      </div>
      <Loaded s={s}>
        {(rows) => (
          <ul className="text-sm">
            {rows.map((a) => {
              const live = new Date(a.startsAt).getTime() <= now && new Date(a.endsAt).getTime() > now;
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-2 border-b border-gray-100 py-2">
                  {live ? <Badge tone="green">{L('đang hiện', 'live')}</Badge> : <Badge>{L('đã hết', 'ended')}</Badge>}
                  {a.level === 'warning' ? <Badge tone="amber">⚠</Badge> : null}
                  <span className="flex-1">{a.text}</span>
                  <span className="text-xs text-gray-500">
                    {fmtDate(a.startsAt)} → {fmtDate(a.endsAt)} · {a.createdBy}
                  </span>
                  {live ? (
                    <AsyncBtn small onRun={async () => (await api('DELETE', `/admin/announcements/${a.id}`), s.reload())}>
                      {L('Dừng', 'End')}
                    </AsyncBtn>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Loaded>
    </Card>
  );
}

function Beta() {
  const L = useL();
  const s = useLoad(() => get<{ gate: boolean; envCodes: number; codes: { code: string; label: string; uses: number; maxUses: number | null; revoked: boolean; createdAt: string }[] }>('/admin/beta'));
  const [label, setLabel] = useState('');
  const [maxUses, setMaxUses] = useState<number | undefined>();
  return (
    <Card title={L('Mã mời', 'Invite codes')}>
      <Loaded s={s}>
        {(d) => (
          <>
            <p className="mb-3 text-xs text-gray-600">
              {d.gate
                ? L(`Beta kín đang BẬT (${d.envCodes} mã trong .env). Mã tạo ở đây cũng dùng được.`, `Closed beta is ON (${d.envCodes} codes in .env). Codes made here work too.`)
                : L('Beta kín đang TẮT (BETA_CODES trong .env trống) — ai cũng vào được, mã mời chưa cần.', 'Closed beta is OFF (BETA_CODES in .env is empty) — everyone can play; codes are not needed.')}
            </p>
            <div className="mb-3 grid gap-2 md:grid-cols-[1fr_10rem_auto]">
              <Text value={label} onChange={setLabel} placeholder={L('Ghi chú (ví dụ: lớp 10A)', 'Label (e.g. class 10A)')} aria-label={L('Ghi chú', 'Label')} />
              <Num value={maxUses} onChange={setMaxUses} min={1} placeholder={L('Số lần dùng tối đa', 'Max uses')} aria-label={L('Số lần dùng tối đa', 'Max uses')} />
              <AsyncBtn kind="primary" onRun={async () => (await api('POST', '/admin/beta', { label, maxUses: maxUses ?? null }), setLabel(''), s.reload())}>
                + {L('Tạo mã', 'Create code')}
              </AsyncBtn>
            </div>
            <ul className="text-sm">
              {d.codes.map((c) => (
                <li key={c.code} className="flex flex-wrap items-center gap-2 border-b border-gray-100 py-2">
                  <code className="rounded bg-gray-100 px-2 py-0.5 font-mono select-all">{c.code}</code>
                  <span className="flex-1">{c.label}</span>
                  <span className="text-xs text-gray-600">
                    {c.uses}
                    {c.maxUses ? `/${c.maxUses}` : ''} {L('lượt', 'uses')}
                  </span>
                  {c.revoked ? <Badge tone="red">{L('đã thu hồi', 'revoked')}</Badge> : null}
                  <AsyncBtn small onRun={async () => (await api('PATCH', `/admin/beta/${c.code}`, { revoked: !c.revoked }), s.reload())}>
                    {c.revoked ? L('Mở lại', 'Restore') : L('Thu hồi', 'Revoke')}
                  </AsyncBtn>
                </li>
              ))}
            </ul>
          </>
        )}
      </Loaded>
    </Card>
  );
}

function Words() {
  const L = useL();
  const s = useSettings();
  return (
    <Loaded s={s}>
      {(d) => (
        <>
          <Card title={L('Từ có sẵn trong bộ lọc', 'Built-in filter words')}>
            <div className="flex flex-wrap gap-1">
              {d.builtinBadWords.map((w) => (
                <Badge key={w} tone={(d.settings.find((x) => x.key === 'allowedWords')?.value as string[]).includes(w) ? 'gray' : 'red'}>
                  {w}
                </Badge>
              ))}
            </div>
          </Card>
          <Card>
            <p className="mb-3 text-xs text-gray-600">{L('Từ bị chặn sẽ hiện thành dấu * trong chat, tên người chơi và tên zone.', 'Blocked words show as * in chat, player names and zone names.')}</p>
            <div className="grid gap-x-6 md:grid-cols-2">
              {d.settings
                .filter((x) => x.key === 'extraBannedWords' || x.key === 'allowedWords')
                .map((x) => (
                  <SettingField key={x.key} row={x} onSaved={s.reload} />
                ))}
            </div>
          </Card>
        </>
      )}
    </Loaded>
  );
}

