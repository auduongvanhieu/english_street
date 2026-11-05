import { useState } from 'react';
import { CROPS, MAX_PLOTS, farmDefaults, type AreaContent, type WorldConfig } from '@es/shared';
import { get } from '../api';
import { EditorShell, useDoc } from '../content';
import { useL } from '../i18n';
import { ENCLOSURES } from '../../world/zooLayout';
import { CRITTERS } from '../../world/critters';
import { Badge, Btn, Card, Check, Field, ListInput, Num, Page, Tabs, Text, useLoad } from '../ui';

/** Defaults shown as placeholders: the code values (zoo spec, critters, farm constants). */
const FARM_DEF = farmDefaults();
const ZOO_DEF = new Map(ENCLOSURES.map((e) => [e.item, e.names]));
const CRITTER_DEF = new Map(CRITTERS.map((c) => [c.id, c.name]));

export function WorldEditor() {
  const L = useL();
  const doc = useDoc<WorldConfig>('world', 'world');
  const [tab, setTab] = useState<'farm' | 'zoo' | 'critters' | 'soldout'>('farm');
  return (
    <Page title={`🌍 ${L('Tên thú, luật nông trại, hết hàng', 'Animal names, farm rules, sold out')}`}>
      <EditorShell
        doc={doc}
        form={(d, set) => (
          <>
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { id: 'farm', label: `🌱 ${L('Nông trại', 'Farm')}` },
                { id: 'zoo', label: `🦁 ${L('Tên thú sở thú', 'Zoo animal names')}` },
                { id: 'critters', label: `🐈 ${L('Thú trên phố & góc vuốt ve', 'Street & petting-corner pets')}` },
                { id: 'soldout', label: `🚫 ${L('Hết hàng hôm nay', 'Sold out today')}` },
              ]}
            />
            {tab === 'farm' ? <FarmTab d={d} set={set} /> : tab === 'zoo' ? <ZooTab d={d} set={set} /> : tab === 'critters' ? <CritterTab d={d} set={set} /> : <SoldOutTab d={d} set={set} />}
          </>
        )}
      />
    </Page>
  );
}

function FarmTab({ d, set }: { d: WorldConfig; set: (d: WorldConfig) => void }) {
  const L = useL();
  const f = d.farm ?? {};
  const setF = (patch: Partial<WorldConfig['farm']>) => set({ ...d, farm: { ...f, ...patch } });
  const crop = (c: (typeof CROPS)[number]) => f.crops?.[c] ?? {};
  const setCrop = (c: (typeof CROPS)[number], patch: { price?: number; growMin?: number; enabled?: boolean }) => {
    const next = { ...crop(c), ...patch };
    for (const k of Object.keys(next) as (keyof typeof next)[]) if (next[k] === undefined) delete next[k];
    setF({ crops: { ...(f.crops ?? {}), [c]: next } });
  };
  return (
    <>
      <Card title={L('Cây trồng', 'Crops')}>
        <p className="mb-2 text-xs text-gray-500">{L('Để trống = dùng giá trị mặc định (chữ mờ).', 'Empty = default value (greyed).')}</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500">
              <th className="py-1">{L('Cây', 'Crop')}</th>
              <th>{L('Giá bán mỗi quả (coins)', 'Price per piece (coins)')}</th>
              <th>{L('Thời gian lớn (phút)', 'Growing time (min)')}</th>
              <th>{L('Cho trồng', 'Can plant')}</th>
            </tr>
          </thead>
          <tbody>
            {CROPS.map((c) => (
              <tr key={c} className="border-t border-gray-100">
                <td className="py-1.5 font-medium">{c}</td>
                <td className="pr-2">
                  <Num value={crop(c).price} min={0} placeholder={String(FARM_DEF.CROP_PRICE[c])} onChange={(v) => setCrop(c, { price: v })} />
                </td>
                <td className="pr-2">
                  <Num value={crop(c).growMin} min={0.5} step={0.5} placeholder={String(FARM_DEF.GROW_MS[c] / 60000)} onChange={(v) => setCrop(c, { growMin: v })} />
                </td>
                <td>
                  <Check checked={crop(c).enabled !== false} onChange={(v) => setCrop(c, { enabled: v ? undefined : false })} label="" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card title={L('Luật chung', 'General rules')}>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label={L('Số quả mỗi lần thu hoạch', 'Pieces per harvest')}>
            <Num value={f.harvestQty} min={1} max={50} placeholder={String(FARM_DEF.FARM.harvestQty)} onChange={(v) => setF({ harvestQty: v })} />
          </Field>
          <Field label={L('Số ô đất mỗi người', 'Plots per player')} hint={`${L('tối đa', 'max')} ${MAX_PLOTS} (${L('số ô có trong cảnh 3D', 'plots built in the 3D scene')})`}>
            <Num value={f.plotCount} min={1} max={MAX_PLOTS} placeholder={String(FARM_DEF.FARM.plotCount)} onChange={(v) => setF({ plotCount: v })} />
          </Field>
          <Field label={L('Coins tối đa mỗi giờ từ nông trại', 'Max farm coins per hour')} hint={L('Chống cày coins', 'Stops coin farming')}>
            <Num value={f.coinsPerHour} min={0} placeholder={String(FARM_DEF.FARM.coinsPerHour)} onChange={(v) => setF({ coinsPerHour: v })} />
          </Field>
          <Field label={L('Chờ giữa 2 lần làm việc chuồng (phút)', 'Chore cooldown (min)')}>
            <Num value={f.choreCooldownMin} min={0.5} placeholder={String(FARM_DEF.FARM.choreCooldownMs / 60000)} onChange={(v) => setF({ choreCooldownMin: v })} />
          </Field>
        </div>
        <h3 className="mb-1 text-xs font-semibold text-gray-600">{L('XP thưởng cho mỗi việc', 'XP per action')}</h3>
        <div className="grid gap-3 md:grid-cols-5">
          {(['plant', 'water', 'harvest', 'sell', 'chore'] as const).map((k) => (
            <Field key={k} label={k}>
              <Num value={f.xp?.[k]} min={0} max={100} placeholder={String(FARM_DEF.FARM.xp[k])} onChange={(v) => setF({ xp: { ...(f.xp ?? {}), [k]: v } })} />
            </Field>
          ))}
        </div>
      </Card>
    </>
  );
}

function ZooTab({ d, set }: { d: WorldConfig; set: (d: WorldConfig) => void }) {
  const L = useL();
  return (
    <Card title={L('Tên các con vật trong từng chuồng (1–5 tên, cách nhau dấu phẩy)', 'Names of the animals in each enclosure (1–5, comma-separated)')}>
      <div className="grid gap-x-4 md:grid-cols-2">
        {ENCLOSURES.map((e) => {
          const cur = d.zooNames[e.item];
          return (
            <Field key={e.item} label={<span>{e.item} {cur ? <Badge tone="amber">{L('đã đổi', 'changed')}</Badge> : null}</span>} hint={`${L('Mặc định', 'Default')}: ${ZOO_DEF.get(e.item)?.join(', ')} · ${L('số con = số tên', 'one animal per name')}`}>
              <div className="flex gap-1">
                <ListInput
                  value={cur ?? ZOO_DEF.get(e.item) ?? []}
                  onChange={(v) => {
                    const names = v.slice(0, 5).map((n) => n.slice(0, 20));
                    const z = { ...d.zooNames };
                    if (!names.length || JSON.stringify(names) === JSON.stringify(ZOO_DEF.get(e.item))) delete z[e.item];
                    else z[e.item] = names;
                    set({ ...d, zooNames: z });
                  }}
                />
                {cur ? (
                  <Btn
                    small
                    kind="ghost"
                    onClick={() => {
                      const z = { ...d.zooNames };
                      delete z[e.item];
                      set({ ...d, zooNames: z });
                    }}
                    aria-label={L('Về mặc định', 'Reset')}
                  >
                    ↺
                  </Btn>
                ) : null}
              </div>
            </Field>
          );
        })}
      </div>
    </Card>
  );
}

function CritterTab({ d, set }: { d: WorldConfig; set: (d: WorldConfig) => void }) {
  const L = useL();
  return (
    <Card title={L('Tên thú đi dạo trên phố, ở góc vuốt ve và ở nông trại', 'Names of the pets on the street, in the petting corner and on the farm')}>
      <div className="grid gap-x-4 md:grid-cols-3">
        {CRITTERS.map((c) => (
          <Field key={c.id} label={`${c.kind} · ${c.id}`} hint={`${L('Mặc định', 'Default')}: ${CRITTER_DEF.get(c.id)}`}>
            <Text
              value={d.critterNames[c.id] ?? ''}
              placeholder={CRITTER_DEF.get(c.id)}
              maxLength={20}
              onChange={(v) => {
                const n = { ...d.critterNames };
                if (!v.trim()) delete n[c.id];
                else n[c.id] = v;
                set({ ...d, critterNames: n });
              }}
            />
          </Field>
        ))}
      </div>
    </Card>
  );
}

function SoldOutTab({ d, set }: { d: WorldConfig; set: (d: WorldConfig) => void }) {
  const L = useL();
  const restaurant = useLoad(() => get<{ data: AreaContent }>('/admin/content/area/restaurant'));
  const market = useLoad(() => get<{ data: AreaContent }>('/admin/content/area/supermarket'));
  const toggle = (area: string, id: string, on: boolean) => {
    const list = new Set(d.soldOut[area] ?? []);
    if (on) list.add(id);
    else list.delete(id);
    set({ ...d, soldOut: { ...d.soldOut, [area]: [...list] } });
  };
  const block = (area: string, a: AreaContent | undefined) => (
    <Card title={area === 'restaurant' ? L('Nhà hàng', 'Restaurant') : L('Siêu thị', 'Supermarket')} actions={<Btn small onClick={() => set({ ...d, soldOut: { ...d.soldOut, [area]: [] } })}>{L('Còn hàng hết', 'All available')}</Btn>}>
      <p className="mb-2 text-xs text-gray-500">{L('Món hết hàng: NPC sẽ nói "hết rồi", người chơi không gọi/mua được.', 'Sold out: the NPC says it is gone, players cannot order/buy it.')}</p>
      <div className="grid gap-1 md:grid-cols-3">
        {(a?.items ?? [])
          .filter((i) => i.price != null && !i.hidden)
          .map((i) => (
            <Check key={i.id} checked={(d.soldOut[area] ?? []).includes(i.id)} onChange={(v) => toggle(area, i.id, v)} label={`${i.icon} ${i.en} ($${i.price})`} />
          ))}
      </div>
    </Card>
  );
  return (
    <>
      {block('restaurant', restaurant.data?.data)}
      {block('supermarket', market.data?.data)}
    </>
  );
}
