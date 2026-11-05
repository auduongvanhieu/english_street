import { useState } from 'react';
import { api, get } from '../api';
import { fmtDate, useL } from '../i18n';
import { AsyncBtn, Badge, Card, Loaded, Page, Select, Tabs, confirmDialog, toast, useLoad } from '../ui';

interface ReportRow {
  id: string;
  reporterId: string;
  targetPlayerId: string | null;
  targetName: string;
  reason: string;
  details: string;
  context: { name?: string; text?: string; from?: string }[];
  createdAt: string;
  status: string;
  handledBy: string | null;
  note: string;
}
interface FeedbackRow {
  id: string;
  playerId: string | null;
  name: string;
  text: string;
  page: string;
  meta: Record<string, unknown>;
  createdAt: string;
  status: string;
}

export function ReportsPage() {
  const L = useL();
  const [tab, setTab] = useState<'reports' | 'feedback'>('reports');
  const [status, setStatus] = useState('new');
  return (
    <Page
      title={L('Báo cáo & góp ý', 'Reports & feedback')}
      actions={
        <Select
          aria-label={L('Trạng thái', 'Status')} inline
          value={status}
          onChange={setStatus}
          options={[
            { value: 'new', label: L('Mới', 'New') },
            { value: 'done', label: L('Đã xử lý', 'Handled') },
            { value: 'ignored', label: L('Bỏ qua', 'Ignored') },
            { value: 'all', label: L('Tất cả', 'All') },
          ]}
        />
      }
    >
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'reports', label: `🚩 ${L('Báo cáo vi phạm', 'Player reports')}` },
          { id: 'feedback', label: `💬 ${L('Góp ý', 'Feedback')}` },
        ]}
      />
      {tab === 'reports' ? <Reports status={status} /> : <Feedback status={status} />}
    </Page>
  );
}

function Reports({ status }: { status: string }) {
  const L = useL();
  const s = useLoad(() => get<{ rows: ReportRow[]; users: Record<string, { id: string; name: string; bannedUntil: string | null; mutedUntil: string | null }>; counts: Record<string, number> }>(`/admin/reports?status=${status}`), [status]);
  const setStatus = async (id: string, st: string) => {
    await api('PATCH', `/admin/reports/${id}`, { status: st });
    s.reload();
  };
  return (
    <Loaded s={s}>
      {(d) => (
        <>
          <p className="mb-2 text-xs text-gray-600">
            {L('Mới', 'New')}: {d.counts.new ?? 0} · {L('Đã xử lý', 'Handled')}: {d.counts.done ?? 0} · {L('Bỏ qua', 'Ignored')}: {d.counts.ignored ?? 0}
          </p>
          {!d.rows.length ? <p className="p-4 text-center text-sm text-gray-500">{L('Không có báo cáo nào 🎉', 'No reports 🎉')}</p> : null}
          {d.rows.map((r) => {
            const target = r.targetPlayerId ? d.users[r.targetPlayerId] : null;
            const reporter = d.users[r.reporterId];
            return (
              <Card
                key={r.id}
                title={
                  <span>
                    🚩 <b>{r.targetName}</b> · {r.reason} <Badge tone={r.status === 'new' ? 'amber' : 'gray'}>{r.status}</Badge>
                  </span>
                }
                actions={<span className="text-xs text-gray-500">{fmtDate(r.createdAt)}</span>}
              >
                <p className="mb-2 text-sm">{r.details || <i className="text-gray-500">{L('(không có mô tả)', '(no details)')}</i>}</p>
                <p className="mb-2 text-xs text-gray-600">
                  {L('Người báo cáo', 'Reported by')}: {reporter ? <a className="text-blue-700 underline" href={`#/users/${encodeURIComponent(reporter.id)}`}>{reporter.name}</a> : r.reporterId}
                  {r.handledBy ? ` · ${L('xử lý bởi', 'handled by')} ${r.handledBy}` : ''}
                </p>
                {r.context?.length ? (
                  <div className="mb-2 max-h-48 overflow-auto rounded bg-gray-50 p-2 text-xs" dir="ltr">
                    {r.context.map((c, i) => (
                      <div key={i}>
                        <b>{c.name ?? c.from ?? '?'}:</b> {c.text ?? JSON.stringify(c)}
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {target ? (
                    <>
                      <AsyncBtn
                        small
                        kind="danger"
                        onRun={async () => {
                          if (!(await confirmDialog(L(`Khoá ${target.name} 1 ngày và đánh dấu đã xử lý?`, `Ban ${target.name} for 1 day and mark handled?`)))) return;
                          await api('POST', `/admin/users/${encodeURIComponent(target.id)}/ban`, { days: 1, reason: r.reason });
                          await setStatus(r.id, 'done');
                          toast(L('Đã khoá', 'Banned'));
                        }}
                      >
                        ⛔ {L('Khoá 1 ngày', 'Ban 1 day')}
                      </AsyncBtn>
                      <AsyncBtn
                        small
                        onRun={async () => {
                          await api('POST', `/admin/users/${encodeURIComponent(target.id)}/mute`, { minutes: 1440 });
                          await setStatus(r.id, 'done');
                          toast(L('Đã tắt chat 1 ngày', 'Muted for 1 day'));
                        }}
                      >
                        🔇 {L('Tắt chat 1 ngày', 'Mute 1 day')}
                      </AsyncBtn>
                      <a className="self-center text-xs text-blue-700 underline" href={`#/users/${encodeURIComponent(target.id)}`}>
                        {L('Xem người bị báo cáo', 'Open player')}
                      </a>
                    </>
                  ) : null}
                  {r.status !== 'done' ? (
                    <AsyncBtn small onRun={() => setStatus(r.id, 'done')}>
                      ✓ {L('Đã xử lý', 'Handled')}
                    </AsyncBtn>
                  ) : null}
                  {r.status === 'new' ? (
                    <AsyncBtn small kind="ghost" onRun={() => setStatus(r.id, 'ignored')}>
                      {L('Bỏ qua', 'Ignore')}
                    </AsyncBtn>
                  ) : (
                    <AsyncBtn small kind="ghost" onRun={() => setStatus(r.id, 'new')}>
                      {L('Mở lại', 'Reopen')}
                    </AsyncBtn>
                  )}
                </div>
              </Card>
            );
          })}
        </>
      )}
    </Loaded>
  );
}

function Feedback({ status }: { status: string }) {
  const L = useL();
  const st = status === 'ignored' ? 'all' : status;
  const s = useLoad(() => get<FeedbackRow[]>(`/admin/feedback?status=${st}`), [st]);
  return (
    <Loaded s={s}>
      {(rows) => (
        <>
          {!rows.length ? <p className="p-4 text-center text-sm text-gray-500">{L('Chưa có góp ý', 'No feedback')}</p> : null}
          {rows.map((f) => (
            <Card key={f.id} title={<span>💬 {f.name} <Badge tone={f.status === 'new' ? 'amber' : 'gray'}>{f.status}</Badge></span>} actions={<span className="text-xs text-gray-500">{fmtDate(f.createdAt)}</span>}>
              <p className="mb-2 text-sm whitespace-pre-line">{f.text}</p>
              <p className="mb-2 text-xs text-gray-500">
                {f.page} {Object.entries(f.meta ?? {}).map(([k, v]) => `· ${k}: ${String(v)}`).join(' ')}
              </p>
              <AsyncBtn
                small
                onRun={async () => {
                  await api('PATCH', `/admin/feedback/${f.id}`, { status: f.status === 'new' ? 'done' : 'new' });
                  s.reload();
                }}
              >
                {f.status === 'new' ? `✓ ${L('Đã đọc', 'Done')}` : L('Đánh dấu mới', 'Mark new')}
              </AsyncBtn>
            </Card>
          ))}
        </>
      )}
    </Loaded>
  );
}
