import { useState } from 'react';
import { api, get } from '../api';
import { BarList, ChartCard, DailyColumns, StatTile } from '../charts';
import { fmtNum, useL } from '../i18n';
import { AsyncBtn, Badge, Card, Loaded, Page, Select, Table, useLoad } from '../ui';

/**
 * "Claude AI": what the Claude API cost, per day and what for (API /admin/llm-usage, table LlmUsage), and a check
 * that the API key still works. Amounts are estimates from the token counts and the price list.
 */
interface Sum {
  requests: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  usd: number;
}
interface UsageDto {
  days: number;
  total: Sum;
  allTime: { usd: number; requests: number; since: string | null };
  today: Sum & { budgetUsd: number; spentUtcUsd: number };
  byDay: (Sum & { day: string })[];
  byPurpose: (Sum & { purpose: string })[];
  byDetail: (Sum & { purpose: string; detail: string })[];
  byModel: (Sum & { model: string })[];
  config: { model: string; modelBasic: string; realKey: boolean };
}
interface CheckDto {
  ok: boolean;
  model?: string;
  ms?: number;
  error?: string;
  status?: number | null;
  message?: string;
}

const usd = (n: number) => `$${n < 1 ? n.toFixed(4) : n.toFixed(2)}`;
const PURPOSE: Record<string, [string, string]> = {
  npc_turn: ['Hội thoại với NPC', 'NPC conversations'],
  pair_judge: ['NPC chấm nhiệm vụ cặp đôi', 'Pair quest judge'],
  word_translate: ['Dịch khi người chơi chạm vào chữ', 'Tap-to-translate'],
  content_translate: ['Dịch nội dung (admin)', 'Content translation (admin)'],
  key_check: ['Kiểm tra key', 'Key check'],
};
const CHECK_ERR: Record<string, [string, string]> = {
  no_api_key: ['Server chưa có ANTHROPIC_API_KEY.', 'The server has no ANTHROPIC_API_KEY.'],
  no_credit: ['Hết tiền trong tài khoản Claude: nạp thêm ở console.anthropic.com → Billing.', 'Out of credit: top up at console.anthropic.com → Billing.'],
  bad_key: ['Key sai hoặc đã bị thu hồi.', 'The key is wrong or revoked.'],
  forbidden: ['Key không có quyền dùng model này.', 'The key may not use this model.'],
  rate_limited: ['Đang bị giới hạn tốc độ hoặc chạm hạn mức chi tiêu tháng.', 'Rate limited or monthly spend limit reached.'],
  overloaded: ['Claude đang quá tải, thử lại sau.', 'Claude is overloaded, try again later.'],
  error: ['Lỗi khác (xem chi tiết).', 'Other error (see details).'],
};

export function ClaudePage() {
  const L = useL();
  const [days, setDays] = useState('30');
  const s = useLoad(() => get<UsageDto>(`/admin/llm-usage?days=${days}`), [days]);
  const [check, setCheck] = useState<CheckDto | null>(null);
  const purpose = (p: string) => {
    const v = PURPOSE[p];
    return v ? L(v[0], v[1]) : p;
  };
  return (
    <Page
      title={L('Claude AI: chi phí', 'Claude AI: cost')}
      actions={
        <>
          <Select inline aria-label={L('Khoảng thời gian', 'Range')} value={days} onChange={setDays} options={[{ value: '7', label: L('7 ngày', '7 days') }, { value: '30', label: L('30 ngày', '30 days') }, { value: '90', label: L('90 ngày', '90 days') }]} />
          <AsyncBtn kind="primary" onRun={async () => {
            setCheck(await api<CheckDto>('POST', '/admin/llm-usage/check'));
            s.reload();
          }}>
            {L('Kiểm tra key Claude', 'Check the Claude key')}
          </AsyncBtn>
        </>
      }
    >
      {check ? (
        <div className={`mb-4 rounded-2xl p-4 text-sm ring-1 ${check.ok ? 'bg-emerald-50 text-emerald-900 ring-emerald-200' : 'bg-red-50 text-red-900 ring-red-200'}`}>
          {check.ok ? (
            <b>✅ {L('Key Claude dùng tốt', 'The Claude key works')} ({check.model}, {check.ms} ms)</b>
          ) : (
            <>
              <b>❌ {L(...(CHECK_ERR[check.error ?? 'error'] ?? CHECK_ERR.error!))}</b>
              {check.message ? <p className="mt-1 font-mono text-xs break-all opacity-80">{check.status ? `${check.status} · ` : ''}{check.message}</p> : null}
            </>
          )}
        </div>
      ) : null}
      <Loaded s={s}>
        {(d) => {
          const pct = Math.round((d.today.usd / Math.max(0.01, d.today.budgetUsd)) * 100);
          return (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatTile label={L('Hôm nay', 'Today')} value={usd(d.today.usd)} sub={L(`${pct}% ngân sách ngày (${usd(d.today.budgetUsd)})`, `${pct}% of the daily budget (${usd(d.today.budgetUsd)})`)} />
                <StatTile label={L(`${d.days} ngày qua`, `Last ${d.days} days`)} value={usd(d.total.usd)} sub={L(`${fmtNum(d.total.requests)} lần gọi`, `${fmtNum(d.total.requests)} calls`)} />
                <StatTile label={L('Từ trước tới nay', 'All time')} value={usd(d.allTime.usd)} sub={d.allTime.since ? L(`từ ${d.allTime.since}`, `since ${d.allTime.since}`) : L('chưa có dữ liệu', 'no data yet')} />
                <StatTile
                  label={L('Đang dùng', 'In use')}
                  value={<span className="text-base">{d.config.realKey ? <Badge tone="green">{L('có key', 'key set')}</Badge> : <Badge tone="red">{L('chưa có key', 'no key')}</Badge>}</span>}
                  sub={`${d.config.modelBasic} · ${d.config.model}`}
                />
              </div>
              <ChartCard
                title={L(`Chi phí mỗi ngày (USD) · ${d.days} ngày`, `Cost per day (USD) · ${d.days} days`)}
                note={L('Ước tính từ số token và bảng giá. Số tiền chính xác xem ở console.anthropic.com → Usage. Bắt đầu ghi từ 08/11/2026.', 'Estimated from tokens and the price list. Exact amounts: console.anthropic.com → Usage. Logged since 2026-11-08.')}
                table={{ head: [L('Ngày', 'Day'), 'USD', L('Lần gọi', 'Calls')], rows: d.byDay.map((x) => [x.day, x.usd, x.requests]) }}
              >
                <DailyColumns days={d.byDay.map((x) => x.day.slice(5))} values={d.byDay.map((x) => x.usd)} format={(n) => `$${n < 1 ? n.toFixed(3) : n.toFixed(2)}`} height={150} />
              </ChartCard>
              <div className="grid gap-4 md:grid-cols-2">
                <Card title={L('Tốn cho việc gì', 'What it was for')}>
                  <BarList rows={d.byPurpose.map((p) => ({ key: p.purpose, label: purpose(p.purpose), value: p.usd, sub: `${fmtNum(p.requests)} ${L('lần', 'calls')}` }))} format={usd} />
                </Card>
                <Card title={L('Theo model', 'By model')}>
                  <BarList rows={d.byModel.map((m) => ({ key: m.model, label: m.model, value: m.usd, sub: `${fmtNum(m.requests)} ${L('lần', 'calls')}` }))} format={usd} />
                </Card>
              </div>
              <Card title={L('Chi tiết: NPC / nhiệm vụ / ngôn ngữ (40 mục tốn nhất)', 'Details: NPC / quest / language (top 40)')}>
                <Table
                  rows={d.byDetail}
                  rowKey={(r) => `${r.purpose}|${r.detail}`}
                  empty={L('Chưa có lần gọi Claude nào trong khoảng này.', 'No Claude calls in this range yet.')}
                  cols={[
                    { key: 'p', label: L('Việc', 'For'), render: (r) => purpose(r.purpose) },
                    { key: 'd', label: L('Chi tiết', 'Detail'), render: (r) => <span className="font-mono text-xs">{r.detail || '—'}</span> },
                    { key: 'n', label: L('Lần gọi', 'Calls'), className: 'text-right', render: (r) => fmtNum(r.requests) },
                    { key: 'i', label: L('Token vào', 'Input'), className: 'text-right', wide: true, render: (r) => fmtNum(r.input + r.cacheRead + r.cacheWrite) },
                    { key: 'o', label: L('Token ra', 'Output'), className: 'text-right', wide: true, render: (r) => fmtNum(r.output) },
                    { key: 'u', label: 'USD', className: 'text-right', render: (r) => <b>{usd(r.usd)}</b> },
                  ]}
                />
              </Card>
            </div>
          );
        }}
      </Loaded>
    </Page>
  );
}
