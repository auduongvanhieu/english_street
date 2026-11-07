import { useState } from 'react';
import { get } from '../api';
import { go } from '../App';
import { useL } from '../i18n';
import { Badge, Btn, Card, Loaded, Modal, Page, Select, Table, Text, Field, useLoad } from '../ui';

export interface ListRow {
  id: string;
  title: string;
  sub: string;
  disabled?: boolean;
  origin: 'yaml' | 'new';
  modified: boolean;
  deleted: boolean;
  data?: Record<string, unknown>;
}
/** The quest's reward from its content (quests and pair quests: `reward: { xp, coins }`). */
const reward = (r: ListRow) => (r.data?.reward ?? {}) as { xp?: number; coins?: number };
export const KIND_TITLE: Record<string, [string, string]> = {
  npc: ['NPC', 'NPCs'],
  quest: ['Nhiệm vụ', 'Quests'],
  pair: ['Nhiệm vụ cặp đôi', 'Pair quests'],
  placement: ['Bài test xếp lớp', 'Placement test'],
};

export function ContentList({ kind }: { kind: 'npc' | 'quest' | 'pair' | 'placement' }) {
  const L = useL();
  const s = useLoad(() => get<ListRow[]>(`/admin/content/${kind}`), [kind]);
  const [q, setQ] = useState('');
  const [npc, setNpc] = useState('');
  const [level, setLevel] = useState('');
  const [newId, setNewId] = useState<string | null>(null);
  const t = KIND_TITLE[kind]!;
  const canCreate = kind !== 'placement';
  return (
    <Page title={L(t[0], t[1])} actions={canCreate ? <Btn kind="primary" onClick={() => setNewId('')}>+ {L('Thêm mới', 'New')}</Btn> : null}>
      {kind === 'placement' ? <p className="mb-3 text-sm text-gray-600">{L('Bài test luôn có đúng 10 câu, từ dễ (A1) đến khó (C1). Sửa câu hỏi và đáp án ở đây.', 'The test always has exactly 10 questions, easy (A1) to hard (C1). Edit the questions and answers here.')}</p> : null}
      <Loaded s={s}>
        {(rows) => {
          const npcs = [...new Set(rows.map((r) => String(r.data?.npc ?? '')).filter(Boolean))].sort();
          const shown = rows.filter(
            (r) => (!q || `${r.id} ${r.title} ${r.sub}`.toLowerCase().includes(q.toLowerCase())) && (!npc || r.data?.npc === npc) && (!level || r.data?.level === level),
          );
          return (
            <Card>
              <div className="mb-3 grid gap-2 md:grid-cols-[2fr_1fr_1fr]">
                <Text value={q} onChange={setQ} placeholder={L('Tìm…', 'Search…')} aria-label={L('Tìm', 'Search')} />
                {kind === 'quest' || kind === 'pair' ? (
                  <>
                    <Select aria-label="NPC" value={npc} onChange={setNpc} options={[{ value: '', label: L('Mọi NPC', 'All NPCs') }, ...npcs.map((n) => ({ value: n, label: n }))]} />
                    <Select aria-label={L('Trình độ', 'Level')} value={level} onChange={setLevel} options={[{ value: '', label: L('Mọi trình độ', 'Any level') }, ...['A1', 'A2', 'B1', 'B2', 'C1'].map((x) => ({ value: x, label: x }))]} />
                  </>
                ) : null}
              </div>
              {kind === 'quest' || kind === 'pair' ? (
                <p className="mb-2 text-xs text-gray-500">
                  {L(
                    'XP và coin khi hoàn thành đủ mục tiêu. Chưa đủ thì nhận một nửa theo số mục tiêu đã xong. Nhiệm vụ đơn nằm trong danh sách hằng ngày được thêm 30 XP lần đầu mỗi ngày.',
                    'XP and coins for finishing every goal. Unfinished: half, in proportion to the goals done. A single quest on the daily list gives +30 XP the first time each day.',
                  )}
                </p>
              ) : null}
              <Table
                rows={shown}
                rowKey={(r) => r.id}
                onRow={(r) => go(`${kind}/${encodeURIComponent(r.id)}`)}
                cols={[
                  { key: 't', label: L('Tên', 'Title'), render: (r) => <b className={r.deleted ? 'line-through opacity-60' : ''}>{r.title}</b> },
                  { key: 's', label: '', render: (r) => <span className="text-gray-600">{r.sub}</span> },
                  { key: 'id', label: 'ID', render: (r) => <span className="font-mono text-xs text-gray-500">{r.id}</span>, wide: true },
                  ...(kind === 'quest' || kind === 'pair'
                    ? [
                        { key: 'xp', label: 'XP', render: (r: ListRow) => <span className="tabular-nums font-semibold text-emerald-700">{reward(r).xp ?? '—'}</span> },
                        { key: 'coins', label: L('Coin', 'Coins'), render: (r: ListRow) => <span className="tabular-nums font-semibold text-amber-600">{reward(r).coins ?? '—'}</span> },
                      ]
                    : []),
                  {
                    key: 'b',
                    label: '',
                    render: (r) => (
                      <span className="flex flex-wrap gap-1">
                        {r.origin === 'new' ? <Badge tone="violet">{L('mới', 'new')}</Badge> : null}
                        {r.modified && !r.deleted ? <Badge tone="amber">{L('đã sửa', 'edited')}</Badge> : null}
                        {r.deleted ? <Badge tone="red">{L('đã ẩn', 'hidden')}</Badge> : null}
                        {r.disabled ? <Badge>{L('đang tắt', 'off')}</Badge> : null}
                      </span>
                    ),
                  },
                ]}
              />
            </Card>
          );
        }}
      </Loaded>
      {newId !== null ? (
        <Modal title={L('Tạo mới', 'Create')} onClose={() => setNewId(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (/^[a-z0-9][a-z0-9-]{1,63}$/.test(newId)) go(`${kind}/${encodeURIComponent(newId)}/new`);
            }}
          >
            <Field label="ID" hint={L('Chữ thường, số và dấu gạch ngang, ví dụ cafe-order-03. Không đổi được sau khi tạo.', 'Lowercase letters, digits and dashes, e.g. cafe-order-03. It cannot be changed later.')}>
              <Text value={newId} onChange={(v) => setNewId(v.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} autoFocus />
            </Field>
            <div className="flex justify-end">
              <Btn kind="primary" type="submit" disabled={!/^[a-z0-9][a-z0-9-]{1,63}$/.test(newId)}>
                {L('Tiếp tục', 'Continue')}
              </Btn>
            </div>
          </form>
        </Modal>
      ) : null}
    </Page>
  );
}
