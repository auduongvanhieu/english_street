import { useState } from 'react';
import { CROPS, MAX_PLOTS, WeatherConfigSchema, farmDefaults, type AreaContent, type WeatherConfig, type WorldConfig } from '@es/shared';
import { get } from '../api';
import { EditorShell, useDoc } from '../content';
import { useL } from '../i18n';
import { ENCLOSURES } from '../../world/zooLayout';
import { CRITTERS } from '../../world/critters';
import { Badge, Btn, Card, Check, Field, ListInput, Num, Page, Select, Tabs, Text, useLoad } from '../ui';

/** Defaults shown as placeholders: the code values (zoo spec, critters, farm constants). */
const FARM_DEF = farmDefaults();
const ZOO_DEF = new Map(ENCLOSURES.map((e) => [e.item, e.names]));
const CRITTER_DEF = new Map(CRITTERS.map((c) => [c.id, c.name]));

export function WorldEditor() {
  const L = useL();
  const doc = useDoc<WorldConfig>('world', 'world');
  const [tab, setTab] = useState<'farm' | 'zoo' | 'critters' | 'soldout' | 'weather'>('farm');
  return (
    <Page title={`🌍 ${L('Tên thú, luật nông trại, hết hàng, thời tiết', 'Animal names, farm rules, sold out, weather')}`}>
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
                { id: 'weather', label: `⛅ ${L('Thời tiết & giờ', 'Weather & time')}` },
              ]}
            />
            {tab === 'farm' ? <FarmTab d={d} set={set} /> : tab === 'zoo' ? <ZooTab d={d} set={set} /> : tab === 'critters' ? <CritterTab d={d} set={set} /> : tab === 'soldout' ? <SoldOutTab d={d} set={set} /> : <WeatherTab d={d} set={set} />}
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

const CITIES: { name: string; lat: number; lon: number }[] = [
  { name: 'Ho Chi Minh City', lat: 10.82, lon: 106.63 },
  { name: 'Hanoi', lat: 21.03, lon: 105.85 },
  { name: 'Da Nang', lat: 16.05, lon: 108.2 },
  { name: 'Hue', lat: 16.46, lon: 107.59 },
  { name: 'Hai Phong', lat: 20.86, lon: 106.68 },
  { name: 'Can Tho', lat: 10.03, lon: 105.78 },
  { name: 'Nha Trang', lat: 12.24, lon: 109.19 },
  { name: 'Da Lat', lat: 11.94, lon: 108.44 },
];

/** Where the street's real weather comes from, or a fixed weather / time of day (events, screenshots). */
function WeatherTab({ d, set }: { d: WorldConfig; set: (d: WorldConfig) => void }) {
  const L = useL();
  const w: WeatherConfig = d.weather ?? WeatherConfigSchema.parse({});
  const setW = (p: Partial<WeatherConfig>) => set({ ...d, weather: { ...w, ...p } });
  const now = useLoad(() => get<{ now: { kind: string; tempC: number | null; cloud: number; place: string; updatedAt: string } | null }>('/world'), []);
  const city = CITIES.find((c) => c.lat === w.lat && c.lon === w.lon)?.name ?? '';
  return (
    <>
      <Card title={L('Thời tiết thật', 'Live weather')}>
        <p className="mb-3 text-sm text-gray-600">
          {L(
            'Bầu trời trong game theo giờ Việt Nam (ngày, hoàng hôn, đêm có trăng sao) và thời tiết thật ở nơi chọn dưới đây (nắng, mây, mưa, giông, sương mù), lấy từ Open-Meteo mỗi 10 phút. Mọi người chơi thấy cùng một bầu trời.',
            'The sky follows Vietnam time (day, sunset, night with moon and stars) and the real weather at the place below (sun, cloud, rain, storm, fog), from Open-Meteo every 10 minutes. Every player sees the same sky.',
          )}
        </p>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label={L('Thành phố', 'City')}>
            <Select
              value={city}
              onChange={(v) => {
                const c = CITIES.find((x) => x.name === v);
                if (c) setW({ place: c.name, lat: c.lat, lon: c.lon });
              }}
              options={[...(city ? [] : [{ value: '', label: L('Toạ độ riêng', 'Custom place') }]), ...CITIES.map((c) => ({ value: c.name, label: c.name }))]}
            />
          </Field>
          <Field label={L('Tên hiện trong game', 'Name shown in the game')}>
            <Text value={w.place} onChange={(v) => setW({ place: v })} />
          </Field>
          <Field label={L('Vĩ độ', 'Latitude')}>
            <Num value={w.lat} step={0.01} min={-90} max={90} onChange={(v) => setW({ lat: v ?? 0 })} />
          </Field>
          <Field label={L('Kinh độ', 'Longitude')}>
            <Num value={w.lon} step={0.01} min={-180} max={180} onChange={(v) => setW({ lon: v ?? 0 })} />
          </Field>
        </div>
        {now.data?.now ? (
          <p className="mt-3 text-sm text-gray-600">
            {L('Đang hiện', 'Showing now')}: <b>{now.data.now.kind}</b> · {now.data.now.tempC ?? '—'}°C · {L('mây', 'cloud')} {now.data.now.cloud}% · {now.data.now.place}
          </p>
        ) : null}
      </Card>
      <Card title={L('Cố định (sự kiện, chụp ảnh)', 'Fixed (events, screenshots)')}>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={L('Thời tiết', 'Weather')} hint={L('"Thật" = theo thời tiết ngoài đời', '"Live" = the real weather')}>
            <Select
              value={w.mode}
              onChange={(v) => setW({ mode: v })}
              options={[
                { value: 'live', label: L('Thật', 'Live') },
                { value: 'clear', label: L('Nắng', 'Sunny') },
                { value: 'partly', label: L('Ít mây', 'Partly cloudy') },
                { value: 'cloudy', label: L('Nhiều mây', 'Cloudy') },
                { value: 'fog', label: L('Sương mù', 'Fog') },
                { value: 'drizzle', label: L('Mưa phùn', 'Drizzle') },
                { value: 'rain', label: L('Mưa', 'Rain') },
                { value: 'storm', label: L('Giông', 'Thunderstorm') },
              ]}
            />
          </Field>
          <Field label={L('Giờ trong ngày', 'Time of day')} hint={L('"Thật" = giờ Việt Nam', '"Live" = Vietnam time')}>
            <Select
              value={w.clock}
              onChange={(v) => setW({ clock: v })}
              options={[
                { value: 'live', label: L('Thật', 'Live') },
                { value: 'morning', label: L('Sáng (8:00)', 'Morning (8:00)') },
                { value: 'noon', label: L('Trưa (12:30)', 'Noon (12:30)') },
                { value: 'dusk', label: L('Hoàng hôn', 'Sunset') },
                { value: 'night', label: L('Đêm (22:00)', 'Night (22:00)') },
              ]}
            />
          </Field>
        </div>
      </Card>
    </>
  );
}
