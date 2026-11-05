import { useMemo, useState } from 'react';
import type { AreaContent, AreaItem, AreaQuizQuestion } from '@es/shared';
import { get } from '../api';
import { EditorShell, ListEditor, useDoc } from '../content';
import { useL } from '../i18n';
import { Badge, Btn, Card, Check, Field, ListInput, Modal, Num, Page, Select, Table, Text, Area, Loaded, useLoad } from '../ui';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;
type AreaId = 'zoo' | 'farm' | 'restaurant' | 'supermarket';
const AREA_TITLE: Record<AreaId, [string, string, string]> = {
  zoo: ['Sở thú', 'Zoo', '🦁'],
  farm: ['Nông trại', 'Farm', '🐄'],
  restaurant: ['Nhà hàng — thực đơn', 'Restaurant — menu', '🍽️'],
  supermarket: ['Siêu thị — sản phẩm', 'Supermarket — products', '🛒'],
};

export function AreaEditor({ id }: { id: AreaId }) {
  const L = useL();
  const doc = useDoc<AreaContent>('area', id);
  const t = AREA_TITLE[id] ?? AREA_TITLE.zoo;
  return (
    <Page title={`${t[2]} ${L(t[0], t[1])}`}>
      <AreaHint id={id} />
      <EditorShell
        doc={doc}
        extraTabs={[
          { id: 'cats', label: L('Danh mục & nhóm câu', 'Categories & groups'), render: () => (doc.draft ? <CatsTab d={doc.draft} set={doc.setDraft} /> : null) },
          { id: 'phrases', label: L('Mẫu câu', 'Phrases'), render: () => (doc.draft ? <PhrasesTab d={doc.draft} set={doc.setDraft} /> : null) },
          { id: 'quiz', label: L('Câu hỏi quiz', 'Quiz questions'), render: () => (doc.draft ? <QuizTab d={doc.draft} set={doc.setDraft} /> : null) },
          { id: 'reports', label: `⚑ ${L('Báo dịch sai', 'Translation reports')}`, render: () => <TrReports area={id} /> },
        ]}
        form={(d, set) => <ItemsTab d={d} set={set} area={id} />}
      />
    </Page>
  );
}

function AreaHint({ id }: { id: AreaId }) {
  const L = useL();
  const text: Record<AreaId, string> = {
    zoo: L('Thẻ từ về con vật. Tên riêng của từng con trong chuồng sửa ở mục "Tên thú, luật nông trại".', 'Animal word cards. The names of the animals in each enclosure live under "Animal names, farm rules".'),
    farm: L('Thẻ từ của nông trại. Giá bán, sản lượng và thời gian lớn của cây trồng sửa ở mục "Tên thú, luật nông trại".', 'Farm word cards. Crop prices, harvest size and growing time live under "Animal names, farm rules".'),
    restaurant: L('Thực đơn: giá ($), mô tả (ghi chú), chất gây dị ứng. NPC và quest cặp đôi dùng giá ở đây. Món hết hàng hôm nay đặt ở mục "hết hàng".', 'Menu: price ($), description (note), allergens. The NPCs and pair quests use these prices. Sold-out dishes are set under "sold out".'),
    supermarket: L('Sản phẩm: giá ($), đơn vị ("a bottle of"…), quầy (danh mục). Ẩn sản phẩm để tạm bỏ khỏi game.', 'Products: price ($), unit ("a bottle of"…), aisle (category). Hide a product to take it out for now.'),
  };
  return (
    <p className="mb-3 text-sm text-gray-600">
      {text[id]}{' '}
      <a className="text-blue-700 underline" href="#/world">
        {L('Mở', 'Open')} →
      </a>
    </p>
  );
}

const blankItem = (cat: string): AreaItem => ({ id: '', en: '', icon: '⭐', pos: 'noun', category: cat, sentences: [{ en: '', level: 'A1' }] });

function ItemsTab({ d, set, area }: { d: AreaContent; set: (d: AreaContent) => void; area: AreaId }) {
  const L = useL();
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<{ index: number; item: AreaItem } | null>(null);
  const priced = area === 'restaurant' || area === 'supermarket' || area === 'farm';
  const rows = useMemo(
    () => d.items.map((item, index) => ({ item, index })).filter(({ item }) => (!cat || item.category === cat) && (!q || `${item.id} ${item.en}`.toLowerCase().includes(q.toLowerCase()))),
    [d.items, cat, q],
  );
  const catLabel = (id: string) => d.categories.find((c) => c.id === id)?.label ?? id;
  return (
    <Card
      title={`${d.items.length} ${L('thẻ', 'cards')}`}
      actions={
        <Btn kind="primary" small onClick={() => setEdit({ index: -1, item: blankItem(cat || d.categories[0]?.id || '') })}>
          + {area === 'restaurant' ? L('Thêm món', 'Add dish') : area === 'supermarket' ? L('Thêm sản phẩm', 'Add product') : L('Thêm thẻ', 'Add card')}
        </Btn>
      }
    >
      <div className="mb-3 grid gap-2 md:grid-cols-[2fr_1fr]">
        <Text value={q} onChange={setQ} placeholder={L('Tìm…', 'Search…')} aria-label={L('Tìm', 'Search')} />
        <Select aria-label={L('Danh mục', 'Category')} value={cat} onChange={setCat} options={[{ value: '', label: L('Mọi danh mục', 'All categories') }, ...d.categories.map((c) => ({ value: c.id, label: c.label }))]} />
      </div>
      <Table
        rows={rows}
        rowKey={(r) => `${r.index}`}
        onRow={(r) => setEdit({ index: r.index, item: structuredClone(r.item) })}
        cols={[
          { key: 'i', label: '', render: (r) => <span className="text-2xl">{r.item.icon}</span> },
          { key: 'en', label: L('Từ', 'Word'), render: (r) => <b className={r.item.hidden ? 'line-through opacity-50' : ''}>{r.item.en}</b> },
          { key: 'c', label: L('Danh mục', 'Category'), render: (r) => catLabel(r.item.category), wide: true },
          ...(priced ? [{ key: 'p', label: L('Giá', 'Price'), render: (r: { item: AreaItem }) => (r.item.price != null ? `$${r.item.price}` : '—'), className: 'text-right tabular-nums' }] : []),
          { key: 'n', label: L('Ghi chú', 'Note'), render: (r) => <span className="text-xs text-gray-600">{r.item.unit ? `${r.item.unit} · ` : ''}{r.item.note ?? ''}</span>, wide: true },
          { key: 'h', label: '', render: (r) => (r.item.hidden ? <Badge>{L('ẩn', 'hidden')}</Badge> : r.item.allergens?.length ? <Badge tone="amber">⚠ {r.item.allergens.join(', ')}</Badge> : null) },
        ]}
      />
      {edit ? (
        <ItemModal
          area={area}
          d={d}
          init={edit.item}
          isNew={edit.index < 0}
          onClose={() => setEdit(null)}
          onApply={(item) => {
            const items = edit.index < 0 ? [...d.items, item] : d.items.map((x, i) => (i === edit.index ? item : x));
            set({ ...d, items });
            setEdit(null);
          }}
          onDelete={
            edit.index < 0
              ? undefined
              : () => {
                  set({ ...d, items: d.items.filter((_, i) => i !== edit.index) });
                  setEdit(null);
                }
          }
        />
      ) : null}
    </Card>
  );
}

function ItemModal({ area, d, init, isNew, onClose, onApply, onDelete }: { area: AreaId; d: AreaContent; init: AreaItem; isNew: boolean; onClose: () => void; onApply: (it: AreaItem) => void; onDelete?: () => void }) {
  const L = useL();
  const [it, setIt] = useState<AreaItem>(init);
  const idTaken = isNew && d.items.some((x) => x.id === it.id);
  const valid = /^[a-z0-9-]+$/.test(it.id) && !idTaken && it.en.trim() && it.icon && it.sentences.every((s) => s.en.trim()) && it.sentences.length >= 1;
  const s = (patch: Partial<AreaItem>) => setIt({ ...it, ...patch });
  return (
    <Modal title={isNew ? L('Thêm', 'Add') : `${it.icon} ${it.en}`} onClose={onClose} wide>
      <div className="grid gap-3 md:grid-cols-4">
        <Field label="ID" hint={idTaken ? L('ID đã có', 'ID taken') : isNew ? L('chữ thường, số, gạch ngang', 'lowercase, digits, dashes') : L('Không đổi được', 'Fixed')}>
          <Text value={it.id} disabled={!isNew} onChange={(v) => s({ id: v.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} className="font-mono text-xs" />
        </Field>
        <Field label={L('Từ tiếng Anh', 'English word')}>
          <Text value={it.en} onChange={(v) => s({ en: v, ...(isNew && !it.id ? {} : {}) })} onBlur={() => isNew && !it.id && s({ id: it.en.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') })} />
        </Field>
        <Field label={L('Số nhiều', 'Plural')}>
          <Text value={it.plural} onChange={(v) => s({ plural: v || undefined })} />
        </Field>
        <Field label={L('Biểu tượng (emoji)', 'Icon (emoji)')}>
          <Text value={it.icon} onChange={(v) => s({ icon: v })} className="text-xl" />
        </Field>
        <Field label={L('Loại từ', 'Part of speech')}>
          <Select value={it.pos} onChange={(v) => s({ pos: v })} options={['noun', 'verb', 'adjective', 'phrase'] as const} />
        </Field>
        <Field label={L('Danh mục', 'Category')}>
          <Select value={it.category} onChange={(v) => s({ category: v })} options={d.categories.map((c) => ({ value: c.id, label: c.label }))} />
        </Field>
        {area !== 'zoo' ? (
          <Field label={L('Giá ($)', 'Price ($)')}>
            <Num value={it.price} min={0} step={0.5} onChange={(v) => s({ price: v })} />
          </Field>
        ) : null}
        {area === 'supermarket' || area === 'farm' ? (
          <Field label={L('Đơn vị', 'Unit')} hint='"a bottle of", "a kilo of"'>
            <Text value={it.unit} onChange={(v) => s({ unit: v || undefined })} />
          </Field>
        ) : null}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label={area === 'restaurant' ? L('Mô tả món', 'Dish description') : L('Ghi chú (ngữ pháp, tiếng kêu…)', 'Note (grammar, sound…)')}>
          <Text value={it.note} onChange={(v) => s({ note: v || undefined })} />
        </Field>
        <Field label={L('Chuyện thú vị', 'Fun fact')}>
          <Text value={it.fact} onChange={(v) => s({ fact: v || undefined })} />
        </Field>
      </div>
      {area === 'restaurant' ? (
        <Field label={L('Chất gây dị ứng (tiếng Anh, cách nhau dấu phẩy)', 'Allergens (English, comma-separated)')} hint="milk, eggs, nuts, gluten, fish, shellfish, soy">
          <ListInput value={it.allergens} onChange={(v) => s({ allergens: v.length ? v : undefined })} />
        </Field>
      ) : null}
      <Field label={L('Câu mẫu (1–4, theo trình độ)', 'Example sentences (1–4, by level)')}>
        <ListEditor
          items={it.sentences}
          onChange={(sentences) => s({ sentences: sentences.slice(0, 4) })}
          blank={() => ({ en: '', level: 'A2' as const })}
          addLabel={L('Thêm câu', 'Add sentence')}
          render={(x, setX) => (
            <div className="grid grid-cols-[1fr_5rem] gap-2">
              <Text value={x.en} onChange={(v) => setX({ ...x, en: v })} dir="ltr" />
              <Select value={x.level} onChange={(v) => setX({ ...x, level: v })} options={LEVELS} />
            </div>
          )}
        />
      </Field>
      <Check checked={!!it.hidden} onChange={(v) => s({ hidden: v || undefined })} label={L('Ẩn khỏi game (giữ lại để dùng sau)', 'Hide from the game (keep for later)')} />
      <p className="mt-2 text-xs text-gray-500">{L('Sau khi lưu, bản dịch sang các ngôn ngữ được làm tự động trong vài phút.', 'After saving, translations into every language are made automatically within a few minutes.')}</p>
      <div className="mt-3 flex justify-between gap-2">
        {onDelete ? (
          <Btn kind="danger" onClick={onDelete}>
            🗑 {L('Xoá thẻ', 'Remove')}
          </Btn>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Btn onClick={onClose}>{L('Huỷ', 'Cancel')}</Btn>
          <Btn kind="primary" disabled={!valid} onClick={() => onApply(it)}>
            {L('Xong (nhớ bấm Lưu)', 'Done (then Save)')}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

function CatsTab({ d, set }: { d: AreaContent; set: (d: AreaContent) => void }) {
  const L = useL();
  const used = (id: string) => d.items.filter((i) => i.category === id).length;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title={L('Danh mục thẻ', 'Card categories')}>
        <ListEditor
          items={d.categories}
          onChange={(categories) => set({ ...d, categories })}
          blank={() => ({ id: `cat-${d.categories.length + 1}`, label: '' })}
          addLabel={L('Thêm danh mục', 'Add category')}
          render={(c, setC) => (
            <div className="grid grid-cols-[8rem_1fr_auto] items-center gap-2">
              <Text value={c.id} onChange={(v) => setC({ ...c, id: v.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} className="font-mono text-xs" aria-label="id" />
              <Text value={c.label} onChange={(v) => setC({ ...c, label: v })} aria-label={L('Tên', 'Label')} />
              <span className="text-xs text-gray-500">{used(c.id)}</span>
            </div>
          )}
        />
      </Card>
      <Card title={L('Nhóm mẫu câu', 'Phrase groups')}>
        <ListEditor
          items={d.groups}
          onChange={(groups) => set({ ...d, groups })}
          blank={() => ({ id: `group-${d.groups.length + 1}`, label: '' })}
          addLabel={L('Thêm nhóm', 'Add group')}
          render={(c, setC) => (
            <div className="grid grid-cols-[8rem_1fr] gap-2">
              <Text value={c.id} onChange={(v) => setC({ ...c, id: v.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} className="font-mono text-xs" aria-label="id" />
              <Text value={c.label} onChange={(v) => setC({ ...c, label: v })} aria-label={L('Tên', 'Label')} />
            </div>
          )}
        />
      </Card>
      <Card title={L('Tên & giới thiệu khu', 'Area name & intro')}>
        <Field label={L('Tên', 'Title')}>
          <Text value={d.title} onChange={(v) => set({ ...d, title: v })} />
        </Field>
        <Field label={L('Giới thiệu', 'Intro')}>
          <Area value={d.intro} onChange={(v) => set({ ...d, intro: v })} rows={3} />
        </Field>
      </Card>
    </div>
  );
}

function PhrasesTab({ d, set }: { d: AreaContent; set: (d: AreaContent) => void }) {
  const L = useL();
  return (
    <Card title={`${d.phrases.length} ${L('mẫu câu', 'phrases')}`}>
      <ListEditor
        items={d.phrases}
        onChange={(phrases) => set({ ...d, phrases })}
        blank={() => ({ en: '', level: 'A1' as const, group: d.groups[0]?.id ?? '' })}
        addLabel={L('Thêm mẫu câu', 'Add phrase')}
        render={(p, setP) => (
          <div className="grid gap-2 md:grid-cols-[1fr_10rem_5rem]">
            <Text value={p.en} onChange={(v) => setP({ ...p, en: v })} dir="ltr" />
            <Select value={p.group} onChange={(v) => setP({ ...p, group: v })} options={d.groups.map((g) => ({ value: g.id, label: g.label }))} />
            <Select value={p.level} onChange={(v) => setP({ ...p, level: v })} options={LEVELS} />
          </div>
        )}
      />
    </Card>
  );
}

function QuizTab({ d, set }: { d: AreaContent; set: (d: AreaContent) => void }) {
  const L = useL();
  const blank = (): AreaQuizQuestion => ({ id: `q-${(d.quiz?.length ?? 0) + 1}`, question: '', options: ['', '', '', ''], answer: 0, level: 'A1' });
  return (
    <Card title={L('Câu hỏi tự viết', 'Hand-written questions')}>
      <p className="mb-3 text-xs text-gray-600">{L('Mỗi lượt quiz có 6 câu: tối đa 2 câu lấy ngẫu nhiên từ đây, còn lại tự sinh từ các thẻ từ.', 'Every quiz has 6 questions: up to 2 picked at random from here, the rest generated from the word cards.')}</p>
      <ListEditor
        items={d.quiz ?? []}
        onChange={(quiz) => set({ ...d, quiz })}
        blank={blank}
        addLabel={L('Thêm câu hỏi', 'Add question')}
        render={(q, setQ) => (
          <div>
            <div className="mb-2 grid gap-2 md:grid-cols-[7rem_1fr_5rem]">
              <Text value={q.id} onChange={(v) => setQ({ ...q, id: v.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} className="font-mono text-xs" aria-label="id" />
              <Text value={q.question} onChange={(v) => setQ({ ...q, question: v })} placeholder={L('Câu hỏi (tiếng Anh)', 'Question (English)')} dir="ltr" />
              <Select value={q.level} onChange={(v) => setQ({ ...q, level: v })} options={LEVELS} />
            </div>
            <div className="grid gap-1 md:grid-cols-2">
              {q.options.map((o, i) => (
                <label key={i} className="flex items-center gap-2">
                  <input type="radio" checked={q.answer === i} onChange={() => setQ({ ...q, answer: i })} aria-label={L('Đáp án đúng', 'Right answer')} />
                  <Text value={o} onChange={(v) => setQ({ ...q, options: q.options.map((x, j) => (j === i ? v : x)) })} dir="ltr" />
                </label>
              ))}
            </div>
          </div>
        )}
      />
    </Card>
  );
}

function TrReports({ area }: { area: AreaId }) {
  const L = useL();
  const s = useLoad(() => get<{ item: string; lang: string; n: number; last: string }[]>(`/admin/translation-reports?area=${area}`), [area]);
  return (
    <Card title={L('Người chơi báo bản dịch sai (90 ngày)', 'Players reporting a wrong translation (90 days)')}>
      <Loaded s={s}>
        {(rows) => (
          <Table
            rows={rows}
            rowKey={(r) => `${r.item}:${r.lang}`}
            empty={L('Chưa có báo cáo nào', 'No reports')}
            cols={[
              { key: 'i', label: L('Thẻ', 'Card'), render: (r) => <b>{r.item}</b> },
              { key: 'l', label: L('Ngôn ngữ', 'Language'), render: (r) => r.lang },
              { key: 'n', label: L('Số lần', 'Times'), render: (r) => r.n, className: 'text-right' },
              { key: 'f', label: '', render: (r) => <a className="text-blue-700 underline" href={`#/translations/${r.lang}?q=${encodeURIComponent(`${area}.item.${r.item}`)}`}>{L('Sửa bản dịch', 'Fix translation')} →</a> },
            ]}
          />
        )}
      </Loaded>
    </Card>
  );
}
