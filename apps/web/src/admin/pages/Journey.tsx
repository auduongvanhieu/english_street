import { AREA_INFO, AREA_STEPS, MAIN_STEPS, weeklyFor } from '@es/shared';
import { get } from '../api';
import { fmtNum, useL } from '../i18n';
import { Card, Loaded, Page, useLoad } from '../ui';
import { BarList, ChartCard, StatTile } from '../charts';

interface JourneyStats {
  players: number;
  chapters: { id: string; reached: number }[];
  stamps: Record<string, number>;
  areaTasks: Record<string, number>;
  dailyAny: number;
  dailyAll: number;
  invited: number;
  week: { week: string; id: string; count: number; by: Record<string, number>; paid: boolean } | null;
}
const CHAPTER: Record<string, string> = {
  'm01-hello': '1 · Chào Priya',
  'm02-coffee': '2 · Ly cà phê',
  'm03-look': '3 · Đổi trang phục',
  'm04-shopping': '4 · Đi siêu thị',
  'm05-dinner': '5 · Ăn nhà hàng',
  'm06-chef': '6 · Nấu ăn',
  'm07-friend': '7 · Bạn mới',
  'm08-river': '8 · Qua sông',
  'm09-hotel': '9 · Khách sạn',
  'm10-sports': '10 · Thể thao',
  'm11-book': '11 · Đọc sách',
  'm12-citizen': '12 · Công dân',
};

/** Journey (quest system): where players stop, which stamps and tasks they finish, the weekly challenge. */
export function JourneyPage() {
  const L = useL();
  const s = useLoad(() => get<JourneyStats>('/admin/journey'), []);
  return (
    <Page title={L('Hành trình (nhiệm vụ)', 'Journey (quests)')}>
      <Loaded s={s}>
        {(d) => {
          const wk = d.week ? weeklyFor(d.week.week) : null;
          return (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatTile label={L('Người đã bắt đầu', 'Players started')} value={fmtNum(d.players)} />
                <StatTile label={L('Đã tới chương cuối', 'Reached the last chapter')} value={fmtNum(d.chapters.at(-1)?.reached ?? 0)} />
                <StatTile label={L('Hôm nay: làm ít nhất 1 việc / đủ 3 việc', 'Today: 1+ task / all 3')} value={`${d.dailyAny} / ${d.dailyAll}`} />
                <StatTile label={L('Bạn được mời đã vào', 'Invited friends joined')} value={fmtNum(d.invited)} />
              </div>
              <ChartCard
                title={L('Số người đi tới mỗi chương (chỗ tụt nhiều = khó / khó tìm)', 'Players reaching each chapter (a big drop = hard or hard to find)')}
                table={{ head: [L('Chương', 'Chapter'), L('Người', 'Players')], rows: d.chapters.map((c) => [CHAPTER[c.id] ?? c.id, c.reached]) }}
              >
                <BarList max={12} rows={d.chapters.map((c) => ({ key: c.id, label: CHAPTER[c.id] ?? c.id, value: c.reached }))} />
              </ChartCard>
              <ChartCard title={L('Tem hộ chiếu theo khu', 'Passport stamps by area')} table={{ head: [L('Khu', 'Area'), L('Người', 'Players')], rows: Object.entries(d.stamps) }}>
                <BarList max={13} rows={Object.entries(d.stamps).map(([a, n]) => ({ key: a, label: a === 'river' ? '🚣 River' : `${AREA_INFO[a as keyof typeof AREA_INFO]?.icon ?? ''} ${a}`, value: n }))} />
              </ChartCard>
              <ChartCard title={L('Nhiệm vụ khu đã làm', 'Area tasks done')} table={{ head: ['id', L('Người', 'Players')], rows: AREA_STEPS.map((s) => [s.id, d.areaTasks[s.id] ?? 0]) }}>
                <BarList max={40} rows={AREA_STEPS.map((s) => ({ key: s.id, label: s.id.replace(/^a-/, ''), value: d.areaTasks[s.id] ?? 0 }))} />
              </ChartCard>
              <Card title={L('Thử thách tuần', 'Weekly challenge')}>
                {d.week && wk ? (
                  <p className="text-sm">
                    {d.week.week} · <b>{wk.id}</b> · {d.week.count}/{wk.target} · {Object.keys(d.week.by).length} {L('người góp', 'players helped')} {d.week.paid ? `· ✅ ${L('đã trả thưởng', 'paid')}` : ''}
                  </p>
                ) : (
                  <p className="text-sm text-gray-500">{L('Tuần này chưa có ai góp.', 'Nobody has helped this week yet.')}</p>
                )}
                <p className="mt-2 text-xs text-gray-500">
                  {L('Các chương:', 'Chapters:')} {MAIN_STEPS.length} · {L('nhiệm vụ khu:', 'area tasks:')} {AREA_STEPS.length}. {L('Nội dung nhiệm vụ nằm trong code (packages/shared/src/journey.ts, chữ trong apps/web/src/ui/journey/journeyText.ts).', 'Quest content lives in code (packages/shared/src/journey.ts, texts in apps/web/src/ui/journey/journeyText.ts).')}
                </p>
              </Card>
            </>
          );
        }}
      </Loaded>
    </Page>
  );
}
