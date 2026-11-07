import { get, useSession } from '../api';
import { ChartCard, DailyColumns, StatTile } from '../charts';
import { ago, fmtNum, useL } from '../i18n';
import { Badge, Card, Loaded, Page, useLoad } from '../ui';

interface OverviewDto {
  active: { d1: number; d7: number; d30: number };
  users: { total: number; registered: number; guests: number; newToday: number };
  online: { players: number; guests: number; rooms: { id: string; zone: string; clients: number }[] } | null;
  spend: { spentUsd: number; budgetUsd: number; turnsToday: number };
  errors: { props: Record<string, unknown>; createdAt: string }[];
  reportsNew: number;
}

export function Overview() {
  const L = useL();
  const me = useSession((s) => s.me);
  const s = useLoad(() => get<OverviewDto>('/admin/stats/overview'));
  const content = useLoad(() => get<{ kinds: { kind: string; count: number; modified: number }[]; translation: { running: boolean; pending: number; error: string; finishedAt: string | null } }>('/admin/content'));
  return (
    <Page title={L('Tổng quan', 'Overview')}>
      <Loaded s={s}>
        {(d) => (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatTile label={L('Người chơi hôm nay', 'Players today')} value={fmtNum(d.active.d1)} sub={`${L('7 ngày', '7 days')}: ${fmtNum(d.active.d7)} · ${L('30 ngày', '30 days')}: ${fmtNum(d.active.d30)}`} />
              <StatTile label={L('Đang online', 'Online now')} value={d.online ? fmtNum(d.online.players) : '—'} sub={d.online ? `${fmtNum(d.online.guests)} ${L('khách', 'guests')} · ${d.online.rooms.length} zone` : L('Không kết nối được game server', 'Game server unreachable')} />
              <StatTile label={L('Tài khoản', 'Accounts')} value={fmtNum(d.users.registered)} sub={`${fmtNum(d.users.guests)} ${L('khách', 'guests')} · +${fmtNum(d.users.newToday)} ${L('mới hôm nay', 'new today')}`} />
              <StatTile
                label={L('Chi phí Claude hôm nay', 'Claude spend today')}
                value={`$${d.spend.spentUsd.toFixed(2)}`}
                sub={`${L('ngân sách', 'budget')} $${d.spend.budgetUsd} · ${fmtNum(d.spend.turnsToday)} ${L('lượt NPC', 'NPC turns')}`}
              />
            </div>
            <Trends />
            <div className="grid gap-4 md:grid-cols-2">
              <Card title={L('Cần chú ý', 'Needs attention')}>
                <ul className="flex flex-col gap-2 text-sm">
                  {me?.role === 'admin' ? (
                    <li>
                      🚩 <a className="text-blue-700 underline" href="#/reports">{L('Báo cáo vi phạm mới', 'New reports')}</a>: <b>{d.reportsNew}</b>
                    </li>
                  ) : null}
                  <li>
                    💸 {L('Ngân sách Claude đã dùng', 'Claude budget used')}: <b>{Math.round((d.spend.spentUsd / Math.max(0.01, d.spend.budgetUsd)) * 100)}%</b>
                  </li>
                  {content.data ? (
                    <li>
                      🌐 {L('Bản dịch đang chờ', 'Translations waiting')}: <b>{fmtNum(content.data.translation.pending)}</b> {content.data.translation.running ? <Badge tone="blue">{L('đang dịch', 'translating')}</Badge> : null}
                      {content.data.translation.error ? <Badge tone="red">{content.data.translation.error}</Badge> : null}
                    </li>
                  ) : null}
                </ul>
              </Card>
              <Card title={L('Lỗi phía người chơi (24 giờ)', 'Client errors (24 h)')}>
                {d.errors.length ? (
                  <ul className="flex flex-col gap-1 text-xs">
                    {d.errors.map((e, i) => (
                      <li key={i} className="truncate" title={JSON.stringify(e.props)}>
                        <span className="text-gray-500">{ago(e.createdAt)}</span> · {String(e.props.message ?? e.props.msg ?? JSON.stringify(e.props)).slice(0, 140)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">{L('Không có lỗi 🎉', 'No errors 🎉')}</p>
                )}
              </Card>
            </div>
            {content.data ? (
              <Card title={L('Nội dung', 'Content')}>
                <div className="flex flex-wrap gap-2 text-sm">
                  {content.data.kinds.map((k) => (
                    <Badge key={k.kind} tone={k.modified ? 'amber' : 'gray'}>
                      {k.kind}: {k.count}
                      {k.modified ? ` · ${k.modified} ${L('đã sửa', 'edited')}` : ''}
                    </Badge>
                  ))}
                </div>
              </Card>
            ) : null}
          </>
        )}
      </Loaded>
    </Page>
  );
}

type Row = readonly [day: string, metric: string, key: string, value: number];
/** The last 14 days at a glance: players, new players, coins earned and spent (one measure per chart). */
function Trends() {
  const L = useL();
  const s = useLoad(() => get<{ days: string[]; rows: Row[] }>('/admin/stats/daily?days=14'));
  if (!s.data) return null;
  const d = s.data;
  const per = (metric: string, key?: string) => {
    const m = new Map<string, number>();
    for (const [day, mt, k, v] of d.rows) if (mt === metric && (key === undefined || k === key)) m.set(day, (m.get(day) ?? 0) + v);
    return d.days.map((x) => m.get(x) ?? 0);
  };
  const short = d.days.map((x) => x.slice(5));
  const charts: { title: string; values: number[] }[] = [
    { title: L('Người chơi mỗi ngày', 'Players per day'), values: per('dau', '') },
    { title: L('Người chơi mới', 'New players'), values: per('new_users', '') },
    { title: L('Xu người chơi kiếm được', 'Coins earned'), values: per('coins_earned') },
    { title: L('Xu người chơi đã tiêu', 'Coins spent'), values: per('coins_spent') },
  ];
  return (
    <div className="grid gap-x-4 md:grid-cols-2">
      {charts.map((c) => (
        <ChartCard key={c.title} title={`${c.title} · ${L('14 ngày', '14 days')}`} table={{ head: [L('Ngày', 'Day'), c.title], rows: d.days.map((x, i) => [x, c.values[i]!]) }}>
          <DailyColumns days={short} values={c.values} height={130} />
        </ChartCard>
      ))}
    </div>
  );
}
