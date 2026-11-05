import { useMemo, useState } from 'react';
import { WORLD_BOUNDS } from '@es/shared';
import { api, get } from '../api';
import { BarList, ChartCard, DailyColumns, HeatMap, StatTile, type MapShape } from '../charts';
import { fmtNum, useL } from '../i18n';
import { AREAS } from '../../world/areas';
import { SHOPS, TILE } from '../../world/layout';
import { AsyncBtn, Btn, Card, Loaded, Page, Select, Tabs, useLoad } from '../ui';

type Row = readonly [day: string, metric: string, key: string, value: number];
interface Daily {
  days: string[];
  rows: Row[];
}

/** Sum of a metric per key over the range, biggest first. */
function byKey(rows: Row[], metric: string) {
  const m = new Map<string, number>();
  for (const [, mt, k, v] of rows) if (mt === metric) m.set(k, (m.get(k) ?? 0) + v);
  return [...m].sort((a, b) => b[1] - a[1]);
}
function perDay(d: Daily, metric: string, key = '') {
  const m = new Map<string, number>();
  for (const [day, mt, k, v] of d.rows) if (mt === metric && k === key) m.set(day, (m.get(day) ?? 0) + v);
  return d.days.map((x) => m.get(x) ?? 0);
}
const total = (rows: Row[], metric: string) => rows.reduce((s, [, m, , v]) => (m === metric ? s + v : s), 0);

function downloadCsv(name: string, head: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => (typeof v === 'number' ? String(v) : `"${v.replace(/"/g, '""')}"`);
  const blob = new Blob([[head, ...rows].map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

const AREA_LABEL: Record<string, [string, string]> = { zoo: ['🦁 Sở thú', '🦁 Zoo'], farm: ['🐄 Nông trại', '🐄 Farm'], restaurant: ['🍽️ Nhà hàng', '🍽️ Restaurant'], supermarket: ['🛒 Siêu thị', '🛒 Supermarket'], main: ['🏙️ Phố chính', '🏙️ Main street'] };

export function StatsPage() {
  const L = useL();
  const [days, setDays] = useState('30');
  const [tab, setTab] = useState<'places' | 'players' | 'learning' | 'economy'>('places');
  const s = useLoad(() => get<Daily>(`/admin/stats/daily?days=${days}`), [days]);
  const npcs = useLoad(() => get<{ id: string; name: string; role: string }[]>('/admin/npcs'));
  const npcName = (id: string) => {
    const n = npcs.data?.find((x) => x.id === id);
    return n ? `${n.name} (${n.role})` : id;
  };
  const areaName = (id: string) => (AREA_LABEL[id] ? L(...AREA_LABEL[id]) : id);
  return (
    <Page
      title={`📈 ${L('Thống kê', 'Stats')}`}
      actions={
        <>
          <Select
            aria-label={L('Khoảng thời gian', 'Range')} inline
            value={days}
            onChange={setDays}
            options={[
              { value: '7', label: L('7 ngày', '7 days') },
              { value: '30', label: L('30 ngày', '30 days') },
              { value: '90', label: L('90 ngày', '90 days') },
            ]}
          />
          <AsyncBtn okText={L('Đã tính lại', 'Recomputed')} onRun={async () => (await api('POST', '/admin/stats/rollup', { days: Number(days) }), s.reload())}>
            ↻ {L('Tính lại', 'Recompute')}
          </AsyncBtn>
          {s.data ? (
            <Btn onClick={() => downloadCsv(`english-street-stats-${days}d`, ['day', 'metric', 'key', 'value'], s.data!.rows.map((r) => [...r]))}>⬇ CSV</Btn>
          ) : null}
        </>
      }
    >
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'places', label: `📍 ${L('Nơi được ghé nhiều nhất', 'Most visited places')}` },
          { id: 'players', label: `👥 ${L('Người chơi', 'Players')}` },
          { id: 'learning', label: `🎓 ${L('Học tập', 'Learning')}` },
          { id: 'economy', label: `🪙 ${L('Kinh tế game', 'Economy')}` },
        ]}
      />
      <Loaded s={s}>
        {(d) => {
          if (tab === 'places') {
            const enters = byKey(d.rows, 'area_enter');
            const secs = byKey(d.rows, 'area_seconds');
            const talks = byKey(d.rows, 'npc_talk');
            const bus = byKey(d.rows, 'bus');
            return (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <ChartCard title={L('Lượt vào các khu', 'Visits per area')} table={{ head: ['area', 'visits'], rows: enters.map(([k, v]) => [k, v]) }}>
                    <BarList rows={enters.map(([k, v]) => ({ key: k, label: areaName(k), value: v }))} />
                  </ChartCard>
                  <ChartCard title={L('Tổng thời gian ở lại (giờ)', 'Total time spent (hours)')} table={{ head: ['area', 'hours'], rows: secs.map(([k, v]) => [k, v / 3600]) }}>
                    <BarList rows={secs.map(([k, v]) => ({ key: k, label: areaName(k), value: v / 3600 }))} format={(n) => fmtNum(n, 1)} />
                  </ChartCard>
                  <ChartCard title={L('NPC được nói chuyện nhiều nhất', 'Most talked-to NPCs')} table={{ head: ['npc', 'conversations'], rows: talks.map(([k, v]) => [k, v]) }}>
                    <BarList rows={talks.map(([k, v]) => ({ key: k, label: npcName(k), value: v }))} />
                  </ChartCard>
                  <ChartCard title={L('Xe buýt: điểm đến', 'Bus rides: destinations')} table={{ head: ['stop', 'rides'], rows: bus.map(([k, v]) => [k, v]) }}>
                    <BarList rows={bus.map(([k, v]) => ({ key: k, label: areaName(k), value: v }))} />
                  </ChartCard>
                </div>
                <Heat />
              </>
            );
          }
          if (tab === 'players') return <PlayersTab d={d} />;
          if (tab === 'learning') return <LearningTab d={d} days={days} npcName={npcName} />;
          return <EconomyTab d={d} />;
        }}
      </Loaded>
    </Page>
  );
}

function PlayersTab({ d }: { d: Daily }) {
  const L = useL();
  const dau = perDay(d, 'dau');
  const neu = perDay(d, 'new_users');
  const spend = perDay(d, 'spend_usd');
  const langs = byKey(d.rows, 'dau_lang');
  const levels = byKey(d.rows, 'dau_level');
  const devices = byKey(d.rows, 'join_device');
  const os = byKey(d.rows, 'dev_os_version');
  const net = byKey(d.rows, 'dev_network');
  const models = byKey(d.rows, 'dev_model');
  const browsers = byKey(d.rows, 'dev_browser');
  const netLabel = (k: string) => (k === 'wifi' ? 'Wi-Fi' : k.startsWith('cellular') ? `${L('Di động', 'Mobile data')}${k.slice(8)}` : k === 'ethernet' ? L('Mạng dây', 'Cable') : L('Không rõ', 'Unknown'));
  const ret = useLoad(() => get<{ week: string; users: number; d1: number; d7: number; d30: number; n1: number; n7: number; n30: number }[]>('/admin/stats/retention'));
  const funnel = useLoad(() => get<{ step: string; n: number }[]>(`/admin/stats/funnel?days=${d.days.length}`), [d.days.length]);
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label={L('Người chơi TB mỗi ngày', 'Avg daily players')} value={fmtNum(dau.reduce((a, b) => a + b, 0) / Math.max(1, dau.length), 1)} />
        <StatTile label={L('Người chơi mới', 'New players')} value={fmtNum(neu.reduce((a, b) => a + b, 0))} />
        <StatTile label={L('Chi phí Claude', 'Claude spend')} value={`$${spend.reduce((a, b) => a + b, 0).toFixed(2)}`} sub={L('chỉ có số từ khi bật admin', 'recorded since the admin site went live')} />
        <StatTile label={L('Có tài khoản / ngày', 'Registered / day')} value={fmtNum(total(d.rows, 'dau_registered') / Math.max(1, d.days.length), 1)} />
      </div>
      <ChartCard title={L('Người chơi mỗi ngày', 'Players per day')} table={{ head: ['day', 'players', 'new'], rows: d.days.map((x, i) => [x, dau[i]!, neu[i]!]) }}>
        <DailyColumns days={d.days} values={dau} />
      </ChartCard>
      <ChartCard title={L('Người chơi mới mỗi ngày', 'New players per day')} table={{ head: ['day', 'new'], rows: d.days.map((x, i) => [x, neu[i]!]) }}>
        <DailyColumns days={d.days} values={neu} height={120} />
      </ChartCard>
      <ChartCard title={L('Chi phí Claude mỗi ngày ($)', 'Claude spend per day ($)')} table={{ head: ['day', 'usd'], rows: d.days.map((x, i) => [x, spend[i]!]) }}>
        <DailyColumns days={d.days} values={spend} height={120} format={(n) => `$${n.toFixed(2)}`} />
      </ChartCard>
      <div className="grid gap-4 md:grid-cols-3">
        <ChartCard title={L('Ngôn ngữ mẹ đẻ (lượt-ngày)', 'Native language (player-days)')} table={{ head: ['lang', 'n'], rows: langs.map(([k, v]) => [k, v]) }}>
          <BarList rows={langs.map(([k, v]) => ({ key: k, label: k, value: v }))} />
        </ChartCard>
        <ChartCard title={L('Trình độ CEFR (lượt-ngày)', 'CEFR level (player-days)')} table={{ head: ['level', 'n'], rows: levels.map(([k, v]) => [k, v]) }}>
          <BarList rows={['A1', 'A2', 'B1', 'B2', 'C1'].map((k) => ({ key: k, label: k, value: levels.find((x) => x[0] === k)?.[1] ?? 0 }))} />
        </ChartCard>
        <ChartCard title={L('Thiết bị (lượt vào game)', 'Device (joins)')} table={{ head: ['device', 'n'], rows: devices.map(([k, v]) => [k, v]) }}>
          <BarList rows={devices.map(([k, v]) => ({ key: k, label: k === 'app' ? L('App điện thoại', 'Phone app') : k === 'touch' ? L('Trình duyệt cảm ứng', 'Touch browser') : L('Máy tính', 'Desktop'), value: v }))} />
        </ChartCard>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard title={L('Hệ điều hành (người-ngày)', 'Operating system (player-days)')} table={{ head: ['os', 'n'], rows: os.map(([k, v]) => [k, v]) }}>
          <BarList rows={os.map(([k, v]) => ({ key: k, label: k, value: v }))} />
        </ChartCard>
        <ChartCard
          title={L('Mạng (người-ngày)', 'Network (player-days)')}
          note={L('4G/5G chỉ biết được trong app iPhone; Android và trình duyệt chỉ cho biết Wi-Fi hay di động.', '4G/5G is only known in the iPhone app; Android and browsers only tell Wi-Fi or mobile data.')}
          table={{ head: ['network', 'n'], rows: net.map(([k, v]) => [k, v]) }}
        >
          <BarList rows={net.map(([k, v]) => ({ key: k, label: netLabel(k), value: v }))} />
        </ChartCard>
        <ChartCard
          title={L('Đời máy (người-ngày)', 'Device model (player-days)')}
          note={L('Safari trên iPhone không cho biết đời máy; app thì có.', 'Safari on iPhone hides the model; the app shows it.')}
          table={{ head: ['model', 'n'], rows: models.map(([k, v]) => [k, v]) }}
        >
          <BarList rows={models.map(([k, v]) => ({ key: k, label: k, value: v }))} />
        </ChartCard>
        <ChartCard title={L('Trình duyệt / app (người-ngày)', 'Browser / app (player-days)')} table={{ head: ['browser', 'n'], rows: browsers.map(([k, v]) => [k, v]) }}>
          <BarList rows={browsers.map(([k, v]) => ({ key: k, label: k === 'app' ? L('App điện thoại', 'Phone app') : k, value: v }))} />
        </ChartCard>
      </div>
      <Card title={L('Phễu: người mới đi được tới đâu', 'Funnel: how far new players get')}>
        <Loaded s={funnel}>{(f) => <BarList rows={f.map((x) => ({ key: x.step, label: x.step, value: x.n, sub: pct(x.n, f[0]?.n ?? 0) }))} format={(n) => `${fmtNum(n)} (${pct(n, f[0]?.n ?? 0)})`} />}</Loaded>
      </Card>
      <Card title={L('Tỉ lệ quay lại theo tuần đăng ký', 'Retention by sign-up week')}>
        <Loaded s={ret}>
          {(rows) => (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500">
                  <th className="py-1">{L('Tuần', 'Week')}</th>
                  <th className="text-right">{L('Người mới', 'New')}</th>
                  <th className="text-right">{L('Ngày 1', 'Day 1')}</th>
                  <th className="text-right">{L('Ngày 7', 'Day 7')}</th>
                  <th className="text-right">{L('Ngày 30', 'Day 30')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.week} className="border-t border-gray-100 tabular-nums">
                    <td className="py-1">{r.week}</td>
                    <td className="text-right">{r.users}</td>
                    <td className="text-right">{pct(r.d1, r.n1)}</td>
                    <td className="text-right">{pct(r.d7, r.n7)}</td>
                    <td className="text-right">{pct(r.d30, r.n30)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Loaded>
      </Card>
    </>
  );
}

function LearningTab({ d, days, npcName }: { d: Daily; days: string; npcName: (id: string) => string }) {
  const L = useL();
  const started = byKey(d.rows, 'quest_started');
  const completed = new Map(byKey(d.rows, 'quest_completed'));
  const scores = new Map(byKey(d.rows, 'quest_score'));
  const corr = byKey(d.rows, 'correction');
  const turns = total(d.rows, 'npc_turns');
  const voice = total(d.rows, 'voice_turns');
  const quiz = byKey(d.rows, 'quiz');
  const qc = new Map(byKey(d.rows, 'quiz_correct'));
  const qt = new Map(byKey(d.rows, 'quiz_total'));
  const words = useLoad(() => get<{ wrong: { key: string; n: number }[]; opened: { key: string; n: number }[] }>(`/admin/stats/words?days=${days}`), [days]);
  const npcTurns = byKey(d.rows, 'npc_turns');
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label={L('Lượt nói với NPC', 'NPC turns')} value={fmtNum(turns)} />
        <StatTile label={L('Dùng giọng nói', 'Spoken turns')} value={turns ? `${Math.round((voice / turns) * 100)}%` : '—'} />
        <StatTile label={L('Nhiệm vụ bắt đầu', 'Quests started')} value={fmtNum(total(d.rows, 'quest_started'))} />
        <StatTile label={L('Hoàn thành', 'Completed')} value={fmtNum(total(d.rows, 'quest_completed'))} />
      </div>
      <ChartCard
        title={L('Nhiệm vụ được chơi nhiều nhất', 'Most played quests')}
        table={{ head: ['quest', 'started', 'completed', 'avg score'], rows: started.map(([k, v]) => [k, v, completed.get(k) ?? 0, completed.get(k) ? Math.round((scores.get(k) ?? 0) / completed.get(k)!) : 0]) }}
      >
        <BarList rows={started.map(([k, v]) => ({ key: k, label: <a className="text-blue-700 underline" href={`#/quest/${k}`}>{k}</a>, value: v, sub: `${completed.get(k) ?? 0} ${L('xong', 'done')}` }))} format={(n) => fmtNum(n)} />
      </ChartCard>
      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard title={L('Loại lỗi hay gặp', 'Most common mistake types')} table={{ head: ['type', 'n'], rows: corr.map(([k, v]) => [k, v]) }}>
          <BarList rows={corr.map(([k, v]) => ({ key: k, label: k, value: v }))} />
        </ChartCard>
        <ChartCard title={L('Lượt nói theo NPC', 'Turns per NPC')} table={{ head: ['npc', 'turns'], rows: npcTurns.map(([k, v]) => [k, v]) }}>
          <BarList rows={npcTurns.map(([k, v]) => ({ key: k, label: npcName(k), value: v }))} />
        </ChartCard>
        <ChartCard title={L('Quiz các khu: tỉ lệ đúng', 'Area quizzes: share correct')} table={{ head: ['area', 'quizzes', 'correct %'], rows: quiz.map(([k, v]) => [k, v, Math.round(((qc.get(k) ?? 0) / Math.max(1, qt.get(k) ?? 0)) * 100)]) }}>
          <BarList rows={quiz.map(([k]) => ({ key: k, label: k, value: Math.round(((qc.get(k) ?? 0) / Math.max(1, qt.get(k) ?? 0)) * 100) }))} format={(n) => `${n}%`} />
        </ChartCard>
        <Loaded s={words}>
          {(w) => (
            <ChartCard title={L('Từ hay sai nhất trong quiz', 'Words most often wrong in quizzes')} table={{ head: ['word', 'wrong'], rows: w.wrong.map((x) => [x.key, x.n]) }}>
              <BarList rows={w.wrong.map((x) => ({ key: x.key, label: x.key.replace(':', ' · '), value: x.n }))} />
            </ChartCard>
          )}
        </Loaded>
      </div>
      <Loaded s={words}>
        {(w) => (
          <ChartCard title={L('Thẻ từ được mở nhiều nhất', 'Most opened word cards')} table={{ head: ['card', 'opened'], rows: w.opened.map((x) => [x.key, x.n]) }}>
            <BarList rows={w.opened.map((x) => ({ key: x.key, label: x.key.replace(':', ' · '), value: x.n }))} max={20} />
          </ChartCard>
        )}
      </Loaded>
    </>
  );
}

function EconomyTab({ d }: { d: Daily }) {
  const L = useL();
  const earned = byKey(d.rows, 'coins_earned');
  const spent = byKey(d.rows, 'coins_spent');
  const dishes = byKey(d.rows, 'dish');
  const perDayEarned = d.days.map((day) => d.rows.filter((r) => r[0] === day && r[1] === 'coins_earned').reduce((s, r) => s + r[3], 0));
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatTile label={L('Coins phát ra', 'Coins earned')} value={fmtNum(total(d.rows, 'coins_earned'))} />
        <StatTile label={L('Coins tiêu đi', 'Coins spent')} value={fmtNum(total(d.rows, 'coins_spent'))} />
        <StatTile label={L('Món được gọi', 'Dishes ordered')} value={fmtNum(total(d.rows, 'dish'))} />
      </div>
      <ChartCard title={L('Coins phát ra mỗi ngày', 'Coins earned per day')} table={{ head: ['day', 'coins'], rows: d.days.map((x, i) => [x, perDayEarned[i]!]) }}>
        <DailyColumns days={d.days} values={perDayEarned} height={130} />
      </ChartCard>
      <div className="grid gap-4 md:grid-cols-3">
        <ChartCard title={L('Coins phát ra theo nguồn', 'Coins earned by source')} table={{ head: ['source', 'coins'], rows: earned.map(([k, v]) => [k, v]) }}>
          <BarList rows={earned.map(([k, v]) => ({ key: k, label: k, value: v }))} />
        </ChartCard>
        <ChartCard title={L('Coins tiêu theo mục đích', 'Coins spent by use')} table={{ head: ['use', 'coins'], rows: spent.map(([k, v]) => [k, v]) }}>
          <BarList rows={spent.map(([k, v]) => ({ key: k, label: k === 'avatar' ? L('Quần áo / phụ kiện', 'Clothes / accessories') : k, value: v }))} />
        </ChartCard>
        <ChartCard title={L('Món bán chạy ở nhà hàng', 'Top restaurant dishes')} table={{ head: ['dish', 'orders'], rows: dishes.map(([k, v]) => [k, v]) }}>
          <BarList rows={dishes.map(([k, v]) => ({ key: k, label: k, value: v }))} />
        </ChartCard>
      </div>
    </>
  );
}

/** Street map: themed areas, street corridor and shop fronts. */
function mapShapes(): MapShape[] {
  const shapes: MapShape[] = [{ kind: 'street', x0: WORLD_BOUNDS.minX, x1: WORLD_BOUNDS.maxX, z0: -5.5, z1: 17.2 }];
  for (const a of AREAS) shapes.push({ kind: 'area', x0: a.x0, x1: a.x1, z0: WORLD_BOUNDS.minZ, z1: -6, label: `${a.icon} ${a.name}` });
  for (const s of SHOPS) shapes.push({ kind: 'shop', x0: s.tx * TILE - 2, x1: s.tx * TILE + 2, z0: -8 - 2, z1: -6, label: s.label.split(' ').slice(0, 2).join(' ') });
  return shapes;
}

function Heat() {
  const L = useL();
  const [days, setDays] = useState('7');
  const [hours, setHours] = useState('0-23');
  const [h0, h1] = hours.split('-').map(Number) as [number, number];
  const s = useLoad(() => get<{ cell: number; cells: [number, number, number][] }>(`/admin/stats/heat?days=${days}&h0=${h0}&h1=${h1}`), [days, hours]);
  const shapes = useMemo(mapShapes, []);
  return (
    <ChartCard
      title={L('Bản đồ nhiệt: người chơi đứng ở đâu', 'Heat map: where players spend time')}
      note={L('Mỗi người chơi được ghi vị trí 30 giây một lần, cộng theo ô 4 m. Giờ theo UTC (Việt Nam = UTC+7).', 'Every player position is sampled every 30 s and counted per 4 m cell. Hours are UTC (Vietnam = UTC+7).')}
      table={{ head: ['x', 'z', 'samples'], rows: (s.data?.cells ?? []).slice().sort((a, b) => b[2] - a[2]).slice(0, 200).map(([x, z, n]) => [x * 4, z * 4, n]) }}
    >
      <div className="mb-2 flex flex-wrap gap-2">
        <Select aria-label={L('Khoảng', 'Range')} inline value={days} onChange={setDays} options={[{ value: '1', label: L('24 giờ', '24 hours') }, { value: '7', label: L('7 ngày', '7 days') }, { value: '30', label: L('30 ngày', '30 days') }]} />
        <Select
          aria-label={L('Giờ trong ngày', 'Hours')} inline
          value={hours}
          onChange={setHours}
         
          options={[
            { value: '0-23', label: L('Cả ngày', 'All day') },
            { value: '0-4', label: '07:00–12:00 VN' },
            { value: '5-10', label: '12:00–18:00 VN' },
            { value: '11-16', label: '18:00–24:00 VN' },
            { value: '17-23', label: '00:00–07:00 VN' },
          ]}
        />
      </div>
      <Loaded s={s}>{(h) => <HeatMap cells={h.cells} cell={h.cell} shapes={shapes} bounds={WORLD_BOUNDS} />}</Loaded>
    </ChartCard>
  );
}
