import { useState } from 'react';
import type { NpcPersona, PairQuest, PlacementQuestion, Quest } from '@es/shared';
import { api, get } from '../api';
import { go } from '../App';
import { EditorShell, ListEditor, useDoc } from '../content';
import { fmtNum, useL } from '../i18n';
import { AsyncBtn, Badge, Btn, Card, Check, Field, ListInput, Loaded, Num, Page, Select, Text, Area, toastError, useLoad } from '../ui';
import { KIND_TITLE } from './ContentList';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;
type Kind = 'npc' | 'quest' | 'pair' | 'placement';

const BLANK = {
  npc: (id: string): NpcPersona => ({ id, name: '', role: '', shop: '', voice: 'en-US', personality: '', knowledge: '', greeting: 'Hello! How can I help you?', position: [0, 0, 0], facing: 0 }),
  quest: (id: string): Quest => ({ id, npc: '', level: 'A1', title: '', intro: '', goals: [{ id: 'greet', desc: 'Greet the NPC' }], target_vocab: [], target_phrases: [], max_turns: 12, reward: { xp: 50, coins: 10 } }),
  pair: (id: string): PairQuest => ({
    id,
    npc: '',
    level: 'A2',
    title: '',
    intro: '',
    roles: [
      { id: 'customer', label: 'Customer', brief: '', facts: '', goals: [{ id: 'order', desc: 'Order something' }] },
      { id: 'staff', label: 'Staff', brief: '', facts: '', goals: [{ id: 'serve', desc: 'Take the order' }] },
    ],
    target_vocab: [],
    target_phrases: [],
    max_turns: 8,
    reward: { xp: 80, coins: 20 },
  }),
  placement: (id: string): PlacementQuestion => ({ id, level: 'A1', question: '', options: ['', '', '', ''], answer: 0 }),
};

export function DocEditor({ kind, id, isNew }: { kind: Kind; id: string; isNew: boolean }) {
  const L = useL();
  const t = KIND_TITLE[kind]!;
  return (
    <Page
      title={
        <span>
          <a className="text-blue-700" href={`#/${kind}`}>
            {L(t[0], t[1])}
          </a>{' '}
          / <span className="font-mono text-base">{id}</span>
        </span>
      }
    >
      {kind === 'npc' ? <NpcEditor id={id} isNew={isNew} /> : kind === 'quest' ? <QuestEditor id={id} isNew={isNew} /> : kind === 'pair' ? <PairEditor id={id} isNew={isNew} /> : <PlacementEditor id={id} />}
    </Page>
  );
}

function useNpcOptions() {
  const s = useLoad(() => get<{ id: string; name: string; role: string }[]>('/admin/npcs'));
  return (s.data ?? []).map((n) => ({ value: n.id, label: `${n.name} — ${n.role} (${n.id})` }));
}

// ---------------------------------------------------------------- NPC
function NpcEditor({ id, isNew }: { id: string; isNew: boolean }) {
  const L = useL();
  const doc = useDoc<NpcPersona>('npc', id, isNew, () => BLANK.npc(id));
  const quests = useLoad(() => get<{ id: string; title: string; sub: string; data: Quest }[]>('/admin/content/quest'));
  return (
    <EditorShell
      doc={doc}
      canDelete
      onDeleted={() => go('npc')}
      extraTabs={[
        { id: 'test', label: `💬 ${L('Thử nói chuyện', 'Try it')}`, render: () => <TestChat npcId={id} quests={(quests.data ?? []).filter((q) => q.data.npc === id)} /> },
        {
          id: 'quests',
          label: L('Nhiệm vụ của NPC', 'Quests'),
          render: () => (
            <Card>
              <ul className="text-sm">
                {(quests.data ?? [])
                  .filter((q) => q.data.npc === id)
                  .map((q) => (
                    <li key={q.id} className="py-1">
                      <a className="text-blue-700 underline" href={`#/quest/${q.id}`}>
                        {q.title}
                      </a>{' '}
                      <span className="text-xs text-gray-500">{q.data.level}</span>
                    </li>
                  ))}
              </ul>
              <Btn small onClick={() => go(`quest/${id}-${Date.now().toString(36).slice(-4)}/new`)}>+ {L('Thêm nhiệm vụ cho NPC này', 'New quest for this NPC')}</Btn>
            </Card>
          ),
        },
      ]}
      form={(d, set) => (
        <div className="grid gap-4 md:grid-cols-2">
          <Card title={L('Nhân vật', 'Character')}>
            <div className="grid grid-cols-2 gap-3">
              <Field label={L('Tên', 'Name')}>
                <Text value={d.name} onChange={(v) => set({ ...d, name: v })} />
              </Field>
              <Field label={L('Nghề', 'Role')} hint={L('Ví dụ: Barista', 'e.g. Barista')}>
                <Text value={d.role} onChange={(v) => set({ ...d, role: v })} />
              </Field>
              <Field label={L('Cửa hàng / nơi làm', 'Shop / place')} hint="cafe, bank, zoo…">
                <Text value={d.shop} onChange={(v) => set({ ...d, shop: v })} />
              </Field>
              <Field label={L('Giọng đọc', 'Voice')}>
                <Select value={d.voice} onChange={(v) => set({ ...d, voice: v })} options={['en-US', 'en-GB', 'en-AU', 'en-IN']} />
              </Field>
            </div>
            <Field label={L('Lời chào', 'Greeting')}>
              <Text value={d.greeting} onChange={(v) => set({ ...d, greeting: v })} />
            </Field>
            <Field label={L('Tính cách', 'Personality')} hint={L('Viết bằng tiếng Anh — NPC đọc phần này.', 'Write it in English — the NPC reads this.')}>
              <Area rows={4} value={d.personality} onChange={(v) => set({ ...d, personality: v })} />
            </Field>
          </Card>
          <Card title={L('Kiến thức (menu, giá, giờ mở cửa…)', 'Knowledge (menu, prices, hours…)')}>
            <Area rows={14} value={d.knowledge} onChange={(v) => set({ ...d, knowledge: v })} className="font-mono text-xs" />
            <p className="mt-1 text-xs text-gray-500">{L('NPC chỉ trả lời theo những gì có ở đây. Đổi giá ở đây là NPC nói giá mới ngay.', 'The NPC only answers from this. Change a price here and the NPC says the new price at once.')}</p>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {(['x', 'y', 'z'] as const).map((k, i) => (
                <Field key={k} label={k} className="mb-0">
                  <Num value={d.position[i]} onChange={(v) => set({ ...d, position: d.position.map((p, j) => (j === i ? (v ?? 0) : p)) as [number, number, number] })} step={0.1} />
                </Field>
              ))}
              <Field label={L('Hướng (rad)', 'Facing (rad)')} className="mb-0">
                <Num value={d.facing} onChange={(v) => set({ ...d, facing: v ?? 0 })} step={0.1} />
              </Field>
            </div>
          </Card>
        </div>
      )}
    />
  );
}

// ---------------------------------------------------------------- quest
function QuestEditor({ id, isNew }: { id: string; isNew: boolean }) {
  const L = useL();
  const npcs = useNpcOptions();
  const doc = useDoc<Quest>('quest', id, isNew, () => ({ ...BLANK.quest(id), npc: id.split('-')[0] ?? '' }));
  return (
    <EditorShell
      doc={doc}
      canDelete
      onDeleted={() => go('quest')}
      extraTabs={[
        { id: 'stats', label: `📈 ${L('Thống kê', 'Stats')}`, render: () => <QuestStats id={id} goals={doc.draft?.goals ?? []} /> },
        { id: 'test', label: `💬 ${L('Chơi thử', 'Try it')}`, render: () => (doc.draft ? <TestChat npcId={doc.draft.npc} quests={[{ id, title: doc.draft.title }]} fixedQuest={id} /> : null) },
      ]}
      form={(d, set) => (
        <div className="grid gap-4 md:grid-cols-2">
          <Card title={L('Thông tin', 'Basics')}>
            <Field label={L('Tiêu đề', 'Title')}>
              <Text value={d.title} onChange={(v) => set({ ...d, title: v })} />
            </Field>
            <Field label={L('Giới thiệu cho người chơi', 'Intro for the player')}>
              <Area rows={3} value={d.intro} onChange={(v) => set({ ...d, intro: v })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="NPC">
                <Select value={d.npc} onChange={(v) => set({ ...d, npc: v })} options={[{ value: '', label: '—' }, ...npcs]} />
              </Field>
              <Field label={L('Trình độ', 'Level')}>
                <Select value={d.level} onChange={(v) => set({ ...d, level: v })} options={LEVELS} />
              </Field>
              <Field label={L('Số lượt tối đa', 'Max turns')}>
                <Num value={d.max_turns} min={2} max={40} onChange={(v) => set({ ...d, max_turns: v ?? 12 })} />
              </Field>
              <Field label={L('Thưởng XP / coins', 'Reward XP / coins')}>
                <div className="flex gap-1">
                  <Num value={d.reward.xp} min={0} onChange={(v) => set({ ...d, reward: { ...d.reward, xp: v ?? 0 } })} />
                  <Num value={d.reward.coins} min={0} onChange={(v) => set({ ...d, reward: { ...d.reward, coins: v ?? 0 } })} />
                </div>
              </Field>
            </div>
            <Field label={L('Từ vựng mục tiêu (cách nhau bằng dấu phẩy)', 'Target words (comma-separated)')}>
              <ListInput value={d.target_vocab} onChange={(v) => set({ ...d, target_vocab: v })} />
            </Field>
            <Field label={L('Mẫu câu mục tiêu', 'Target phrases')}>
              <ListInput value={d.target_phrases} onChange={(v) => set({ ...d, target_phrases: v })} />
            </Field>
            <Check checked={!d.disabled} onChange={(on) => set({ ...d, disabled: on ? undefined : true })} label={L('Đang bật trong game', 'On in the game')} />
          </Card>
          <Card title={L('Mục tiêu (NPC chấm theo thứ tự này)', 'Goals (the NPC grades these)')}>
            <GoalsEditor goals={d.goals} onChange={(goals) => set({ ...d, goals })} />
          </Card>
        </div>
      )}
    />
  );
}

function GoalsEditor({ goals, onChange }: { goals: { id: string; desc: string }[]; onChange: (g: { id: string; desc: string }[]) => void }) {
  const L = useL();
  return (
    <ListEditor
      items={goals}
      onChange={onChange}
      blank={() => ({ id: `goal-${goals.length + 1}`, desc: '' })}
      addLabel={L('Thêm mục tiêu', 'Add goal')}
      render={(g, set) => (
        <div className="grid grid-cols-[8rem_1fr] gap-2">
          <Text value={g.id} onChange={(v) => set({ ...g, id: v.replace(/[^a-z0-9_-]/gi, '_').toLowerCase() })} aria-label="id" className="font-mono text-xs" />
          <Text value={g.desc} onChange={(v) => set({ ...g, desc: v })} placeholder={L('Ví dụ: Order a drink', 'e.g. Order a drink')} aria-label={L('Mô tả', 'Description')} />
        </div>
      )}
    />
  );
}

function QuestStats({ id, goals }: { id: string; goals: { id: string; desc: string }[] }) {
  const L = useL();
  const s = useLoad(() => get<{ attempts: number; completed: number; avgScore: number | null; avgTurns: number | null; goals: Record<string, number> }>(`/admin/stats/quest/${encodeURIComponent(id)}`), [id]);
  return (
    <Loaded s={s}>
      {(d) => (
        <Card>
          <div className="mb-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
            <div>
              {L('Lượt chơi', 'Attempts')}: <b>{fmtNum(d.attempts)}</b>
            </div>
            <div>
              {L('Hoàn thành', 'Completed')}: <b>{d.attempts ? Math.round((d.completed / d.attempts) * 100) : 0}%</b>
            </div>
            <div>
              {L('Điểm TB', 'Avg score')}: <b>{d.avgScore ?? '—'}</b>
            </div>
            <div>
              {L('Số lượt TB', 'Avg turns')}: <b>{d.avgTurns ?? '—'}</b>
            </div>
          </div>
          <h3 className="mb-1 text-xs font-semibold text-gray-600">{L('Tỉ lệ đạt từng mục tiêu (thấp = hay bị bỏ lỡ)', 'Share reaching each goal (low = often missed)')}</h3>
          <ul className="text-sm">
            {goals.map((g) => {
              const p = d.attempts ? (d.goals[g.id] ?? 0) / d.attempts : 0;
              return (
                <li key={g.id} className="grid grid-cols-[1fr_8rem_3rem] items-center gap-2 py-1">
                  <span>{g.desc}</span>
                  <span className="h-2 rounded bg-gray-100">
                    <span className="block h-2 rounded bg-[#2a78d6]" style={{ width: `${p * 100}%` }} />
                  </span>
                  <span className="text-right tabular-nums">{Math.round(p * 100)}%</span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </Loaded>
  );
}

// ---------------------------------------------------------------- pair quest
function PairEditor({ id, isNew }: { id: string; isNew: boolean }) {
  const L = useL();
  const npcs = useNpcOptions();
  const doc = useDoc<PairQuest>('pair', id, isNew, () => BLANK.pair(id));
  return (
    <EditorShell
      doc={doc}
      canDelete
      onDeleted={() => go('pair')}
      form={(d, set) => (
        <>
          <Card title={L('Thông tin', 'Basics')}>
            <div className="grid gap-3 md:grid-cols-4">
              <Field label={L('Tiêu đề', 'Title')} className="md:col-span-2">
                <Text value={d.title} onChange={(v) => set({ ...d, title: v })} />
              </Field>
              <Field label={L('NPC giám khảo', 'Judging NPC')}>
                <Select value={d.npc} onChange={(v) => set({ ...d, npc: v })} options={[{ value: '', label: '—' }, ...npcs]} />
              </Field>
              <Field label={L('Trình độ', 'Level')}>
                <Select value={d.level} onChange={(v) => set({ ...d, level: v })} options={LEVELS} />
              </Field>
            </div>
            <Field label={L('Giới thiệu', 'Intro')}>
              <Area rows={2} value={d.intro} onChange={(v) => set({ ...d, intro: v })} />
            </Field>
            <div className="grid gap-3 md:grid-cols-4">
              <Field label={L('Số câu tối đa mỗi người', 'Max lines per player')}>
                <Num value={d.max_turns} min={2} max={30} onChange={(v) => set({ ...d, max_turns: v ?? 8 })} />
              </Field>
              <Field label="XP">
                <Num value={d.reward.xp} onChange={(v) => set({ ...d, reward: { ...d.reward, xp: v ?? 0 } })} />
              </Field>
              <Field label="Coins">
                <Num value={d.reward.coins} onChange={(v) => set({ ...d, reward: { ...d.reward, coins: v ?? 0 } })} />
              </Field>
              <div className="self-end pb-3">
                <Check checked={!d.disabled} onChange={(on) => set({ ...d, disabled: on ? undefined : true })} label={L('Đang bật', 'On')} />
              </div>
            </div>
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            {d.roles.map((r, i) => (
              <Card key={i} title={`${L('Vai', 'Role')} ${i + 1}: ${r.label}`}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="ID">
                    <Text value={r.id} onChange={(v) => set({ ...d, roles: d.roles.map((x, j) => (j === i ? { ...x, id: v } : x)) as PairQuest['roles'] })} className="font-mono text-xs" />
                  </Field>
                  <Field label={L('Tên vai', 'Label')}>
                    <Text value={r.label} onChange={(v) => set({ ...d, roles: d.roles.map((x, j) => (j === i ? { ...x, label: v } : x)) as PairQuest['roles'] })} />
                  </Field>
                </div>
                <Field label={L('Nhiệm vụ của vai', 'Brief')}>
                  <Area rows={2} value={r.brief} onChange={(v) => set({ ...d, roles: d.roles.map((x, j) => (j === i ? { ...x, brief: v } : x)) as PairQuest['roles'] })} />
                </Field>
                <Field label={L('Thông tin vai biết', 'Facts this role knows')} hint={L('Dùng {{menu:restaurant}} hoặc {{menu:supermarket}} để chèn bảng giá thật.', 'Use {{menu:restaurant}} or {{menu:supermarket}} to insert the real price list.')}>
                  <Area rows={4} value={r.facts} onChange={(v) => set({ ...d, roles: d.roles.map((x, j) => (j === i ? { ...x, facts: v } : x)) as PairQuest['roles'] })} className="font-mono text-xs" />
                </Field>
                <GoalsEditor goals={r.goals} onChange={(goals) => set({ ...d, roles: d.roles.map((x, j) => (j === i ? { ...x, goals } : x)) as PairQuest['roles'] })} />
              </Card>
            ))}
          </div>
        </>
      )}
    />
  );
}

// ---------------------------------------------------------------- placement question
function PlacementEditor({ id }: { id: string }) {
  const L = useL();
  const doc = useDoc<PlacementQuestion>('placement', id);
  return (
    <EditorShell
      doc={doc}
      form={(d, set) => (
        <Card>
          <div className="grid gap-3 md:grid-cols-[1fr_8rem]">
            <Field label={L('Câu hỏi (dùng ___ cho chỗ trống)', 'Question (use ___ for the gap)')}>
              <Text value={d.question} onChange={(v) => set({ ...d, question: v })} />
            </Field>
            <Field label={L('Trình độ', 'Level')}>
              <Select value={d.level} onChange={(v) => set({ ...d, level: v })} options={LEVELS} />
            </Field>
          </div>
          {d.options.map((o, i) => (
            <div key={i} className="mb-2 flex items-center gap-2">
              <input type="radio" name="answer" checked={d.answer === i} onChange={() => set({ ...d, answer: i })} aria-label={L('Đáp án đúng', 'Right answer')} />
              <Text value={o} onChange={(v) => set({ ...d, options: d.options.map((x, j) => (j === i ? v : x)) })} />
              {d.answer === i ? <Badge tone="green">{L('đúng', 'right')}</Badge> : null}
            </div>
          ))}
        </Card>
      )}
    />
  );
}

// ---------------------------------------------------------------- try the NPC
interface Turn {
  turn: { reply: string; emotion: string; goals_completed: string[]; corrections: { original: string; corrected: string; explanation: string; type: string }[]; new_vocab: { word: string }[]; hint?: string | null };
  state: { goalsDone: string[]; turns: number; maxTurns: number; finished: boolean };
  summary: { status: string; score: number } | null;
}
function TestChat({ npcId, quests, fixedQuest }: { npcId: string; quests: { id: string; title: string }[]; fixedQuest?: string }) {
  const L = useL();
  const [questId, setQuestId] = useState(fixedQuest ?? '');
  const [session, setSession] = useState<{ id: string; greeting: string } | null>(null);
  const [lines, setLines] = useState<{ me: string; t: Turn }[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const start = async () => {
    const s = await api<{ sessionId: string; messages: { role: string; content: string }[] }>('POST', '/admin/test/start', { npcId, questId: questId || null });
    setSession({ id: s.sessionId, greeting: s.messages.filter((m) => m.role === 'assistant').at(-1)?.content ?? '' });
    setLines([]);
  };
  const send = async () => {
    if (!session || !text.trim()) return;
    setBusy(true);
    try {
      const t = await api<Turn>('POST', '/admin/test/chat', { sessionId: session.id, text });
      setLines((l) => [...l, { me: text, t }]);
      setText('');
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title={L('Thử nói chuyện với NPC (dùng Claude thật, tính vào ngân sách)', 'Talk to the NPC (real Claude, counts against the budget)')}>
      {!session ? (
        <div className="flex flex-wrap items-end gap-2">
          {!fixedQuest ? (
            <Field label={L('Nhiệm vụ', 'Quest')} className="mb-0 min-w-60">
              <Select value={questId} onChange={setQuestId} options={[{ value: '', label: L('Nói chuyện tự do', 'Free talk') }, ...quests.map((q) => ({ value: q.id, label: q.title }))]} />
            </Field>
          ) : null}
          <AsyncBtn kind="primary" onRun={start}>
            ▶ {L('Bắt đầu', 'Start')}
          </AsyncBtn>
          <span className="text-xs text-gray-500">{L('Lưu thay đổi trước khi thử — NPC dùng bản đã lưu.', 'Save first — the NPC uses the saved version.')}</span>
        </div>
      ) : (
        <>
          <div className="mb-3 max-h-[28rem] overflow-auto text-sm" dir="ltr">
            <div className="mr-10 mb-2 rounded-lg bg-gray-50 px-3 py-2">{session.greeting}</div>
            {lines.map((l, i) => (
              <div key={i}>
                <div className="mb-1 ml-10 rounded-lg bg-blue-50 px-3 py-2">{l.me}</div>
                <div className="mr-10 mb-1 rounded-lg bg-gray-50 px-3 py-2">
                  {l.t.turn.reply} <Badge>{l.t.turn.emotion}</Badge>
                </div>
                <div className="mb-3 text-xs text-gray-600">
                  {l.t.turn.goals_completed.length ? <Badge tone="green">✓ {l.t.turn.goals_completed.join(', ')}</Badge> : null}{' '}
                  {l.t.turn.corrections.map((c, j) => (
                    <span key={j} className="mr-2">
                      <s className="text-red-700">{c.original}</s> → <b>{c.corrected}</b> ({c.type})
                    </span>
                  ))}
                  {l.t.turn.hint ? <span>💡 {l.t.turn.hint}</span> : null}
                  <span className="ml-2">
                    {L('Mục tiêu', 'Goals')} {l.t.state.goalsDone.length} · {L('lượt', 'turn')} {l.t.state.turns}/{l.t.state.maxTurns}
                  </span>
                  {l.t.summary ? (
                    <Badge tone="violet">
                      {l.t.summary.status} · {l.t.summary.score}
                    </Badge>
                  ) : null}
                  <details className="mt-1">
                    <summary className="cursor-pointer">JSON</summary>
                    <pre className="overflow-auto rounded bg-gray-50 p-2">{JSON.stringify(l.t.turn, null, 2)}</pre>
                  </details>
                </div>
              </div>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <Text value={text} onChange={setText} placeholder={L('Gõ như người chơi (tiếng Anh)…', 'Type as a player (English)…')} disabled={busy || lines.at(-1)?.t.state.finished} />
            <Btn kind="primary" type="submit" disabled={busy}>
              {busy ? '…' : L('Gửi', 'Send')}
            </Btn>
            <AsyncBtn onRun={async () => (await api('POST', '/admin/test/end', { sessionId: session.id }), setSession(null))}>{L('Kết thúc', 'End')}</AsyncBtn>
          </form>
        </>
      )}
    </Card>
  );
}
