import { useState } from 'react';
import { api, get } from '../api';
import { fmtDate, useL } from '../i18n';
import { AsyncBtn, Badge, Btn, Card, Loaded, Modal, Page, Select, Text, confirmDialog, toast, useLoad } from '../ui';

interface AuditRow {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  target: string;
  before: unknown;
  after: unknown;
  ip: string;
  createdAt: string;
}

/** Line diff of two JSON values (pretty-printed): - removed, + added. */
function diffLines(a: unknown, b: unknown): { t: ' ' | '-' | '+'; s: string }[] {
  const x = JSON.stringify(a ?? null, null, 2).split('\n');
  const y = JSON.stringify(b ?? null, null, 2).split('\n');
  // LCS table (documents are small enough)
  const n = x.length;
  const m = y.length;
  if (n * m > 4_000_000) return [...x.map((s) => ({ t: '-' as const, s })), ...y.map((s) => ({ t: '+' as const, s }))];
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i]![j] = x[i] === y[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
  const out: { t: ' ' | '-' | '+'; s: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) out.push({ t: ' ', s: x[i++]! }), j++;
    else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) out.push({ t: '-', s: x[i++]! });
    else out.push({ t: '+', s: y[j++]! });
  }
  while (i < n) out.push({ t: '-', s: x[i++]! });
  while (j < m) out.push({ t: '+', s: y[j++]! });
  return out;
}

export function AuditPage() {
  const L = useL();
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const [target, setTarget] = useState('');
  const [view, setView] = useState<AuditRow | null>(null);
  const q = new URLSearchParams({ ...(actor ? { actor } : {}), ...(action ? { action } : {}), ...(target ? { target } : {}) });
  const s = useLoad(() => get<AuditRow[]>(`/admin/audit?${q}`), [q.toString()]);
  return (
    <Page title={`🧾 ${L('Nhật ký quản trị', 'Admin audit log')}`}>
      <Card>
        <div className="grid gap-2 md:grid-cols-3">
          <Text value={actor} onChange={setActor} placeholder={L('Người thực hiện', 'Who')} aria-label={L('Người thực hiện', 'Who')} />
          <Select
            aria-label={L('Loại', 'Kind')}
            value={action}
            onChange={setAction}
            options={[
              { value: '', label: L('Mọi thao tác', 'All actions') },
              { value: 'content', label: L('Nội dung', 'Content') },
              { value: 'user', label: L('Người chơi', 'Players') },
              { value: 'setting', label: L('Cài đặt', 'Settings') },
              { value: 'announcement', label: L('Thông báo', 'Announcements') },
              { value: 'beta', label: 'Beta' },
              { value: 'report', label: L('Báo cáo', 'Reports') },
              { value: 'login', label: L('Đăng nhập', 'Sign-ins') },
            ]}
          />
          <Text value={target} onChange={setTarget} placeholder={L('Đối tượng (vd quest/cafe-order-01)', 'Target (e.g. quest/cafe-order-01)')} aria-label={L('Đối tượng', 'Target')} />
        </div>
      </Card>
      <Card>
        <Loaded s={s}>
          {(rows) => (
            <ul className="text-sm">
              {rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2 border-b border-gray-100 py-2">
                  <span className="w-32 text-xs text-gray-500">{fmtDate(r.createdAt)}</span>
                  <b>{r.actorName}</b>
                  <Badge tone={r.action.includes('delete') || r.action.includes('ban') ? 'red' : r.action.startsWith('content') ? 'blue' : r.action === 'login_failed' ? 'amber' : 'gray'}>{r.action}</Badge>
                  <span className="font-mono text-xs">{r.target}</span>
                  {r.before !== null || r.after !== null ? (
                    <Btn small className="ml-auto" onClick={() => setView(r)}>
                      {L('Xem thay đổi', 'View change')}
                    </Btn>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Loaded>
      </Card>
      {view ? (
        <Modal title={`${view.action} · ${view.target}`} onClose={() => setView(null)} wide>
          <pre className="max-h-[60vh] overflow-auto rounded bg-gray-50 p-2 text-xs">
            {diffLines(view.before, view.after).map((l, i) => (
              <div key={i} className={l.t === '-' ? 'bg-red-50 text-red-800' : l.t === '+' ? 'bg-emerald-50 text-emerald-800' : 'text-gray-600'}>
                {l.t} {l.s}
              </div>
            ))}
          </pre>
          {view.action.startsWith('content.') && view.before ? (
            <div className="mt-3 flex justify-end">
              <AsyncBtn
                onRun={async () => {
                  const [kind, ...rest] = view.target.split('/');
                  if (!(await confirmDialog(L('Đưa nội dung này về như trước thay đổi?', 'Put this content back as it was before the change?')))) return;
                  await api('PUT', `/admin/content/${kind}/${encodeURIComponent(rest.join('/'))}`, { data: view.before });
                  toast(L('Đã hoàn tác', 'Undone'));
                  setView(null);
                  s.reload();
                }}
              >
                ↶ {L('Hoàn tác thay đổi này', 'Undo this change')}
              </AsyncBtn>
            </div>
          ) : null}
        </Modal>
      ) : null}
    </Page>
  );
}
