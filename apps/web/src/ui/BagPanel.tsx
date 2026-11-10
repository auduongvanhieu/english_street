import { useEffect, useState } from 'react';
import { ANIMAL_INFO, BAG_ITEMS, CLOTH_COLORS, FURNITURE, GLASSES_ITEMS, HAIR_COLORS, HAT_ITEMS, PET_ITEMS, SKIN_TONES, TAG_ITEMS, type MyFarmState, type ShopItem } from '@es/shared';
import { get, fetchBooks, fetchMyBooks } from '../net/api';
import { getPlayerId } from '../net/player';
import { useProfile } from '../store/profile';
import { Panel, TopUpButton } from './ProfilePanels';
import { Icon } from './icons';
import { useT } from '../i18n';

const ICON: Record<string, string> = { carrot: '🥕', corn: '🌽', tomato: '🍅', potato: '🥔', pumpkin: '🎃', strawberry: '🍓', egg: '🥚', milk: '🥛', wool: '🧶', truffle: '🍄' };
const ITEMS = [HAT_ITEMS, GLASSES_ITEMS, BAG_ITEMS, TAG_ITEMS, PET_ITEMS] as Record<string, ShopItem>[];
const itemLabel = (id: string) => ITEMS.flatMap((r) => Object.values(r)).find((x) => x.id === id)?.label;
const colorName = (id: string) => [...SKIN_TONES, ...HAIR_COLORS, ...CLOTH_COLORS].find((c) => c.id === id);

/** 🎒 My bag: everything you own, from every place (the farm, your room, the bookshop, the character shop). */
export function BagPanel() {
  const t = useT();
  const p = useProfile((s) => s.profile);
  const [farm, setFarm] = useState<MyFarmState | null>(null);
  const [room, setRoom] = useState<Record<string, number>>({});
  const [books, setBooks] = useState<{ id: string; title: string }[]>([]);
  useEffect(() => {
    const q = `?playerId=${encodeURIComponent(getPlayerId())}`;
    void get<{ farm: MyFarmState }>(`/me/myfarm${q}`).then((r) => setFarm(r.farm)).catch(() => undefined);
    void get<{ owned: Record<string, number> }>(`/me/room${q}`).then((r) => setRoom(r.owned ?? {})).catch(() => undefined);
    void Promise.all([fetchMyBooks(), fetchBooks()])
      .then(([mine, all]) => setBooks(all.books.filter((b) => mine.owned.includes(b.id)).map((b) => ({ id: b.id, title: b.title }))))
      .catch(() => undefined);
  }, []);
  const owned = p?.avatar?.owned ?? [];
  const things = owned.filter((id) => id.includes(':'));
  const colours = owned.filter((id) => !id.includes(':'));
  const chip = (key: string, label: React.ReactNode) => (
    <span key={key} className="rounded-full bg-gray-100 px-2.5 py-1 text-sm" dir="ltr">
      {label}
    </span>
  );
  const section = (title: string, children: React.ReactNode[], empty: string) => (
    <section className="mb-3">
      <h3 className="mb-1 text-xs font-semibold uppercase text-gray-500">{title}</h3>
      {children.length ? <div className="flex flex-wrap gap-1.5">{children}</div> : <p className="text-sm text-gray-400">{empty}</p>}
    </section>
  );
  return (
    <Panel title={t('My bag')} icon="bag">
      <p className="mb-3 flex items-center gap-1 text-lg font-bold">
        <Icon name="coin" className="text-amber-500" /> {p?.coins ?? 0} {t('coins')} <TopUpButton />
      </p>
      {section(
        t('Seeds and feed'),
        [
          ...Object.entries(farm?.seeds ?? {})
            .filter(([, n]) => n > 0)
            .map(([k, n]) => chip(k, `${ICON[k] ?? '🌱'} ${k} seeds × ${n}`)),
          ...(farm?.feed ? [chip('feed', `🌾 feed × ${farm.feed}`)] : []),
        ],
        t('Nothing yet. Buy seeds in the farm shop.'),
      )}
      {section(
        t('In my barn (to sell)'),
        Object.entries(farm?.barn ?? {})
          .filter(([, n]) => n > 0)
          .map(([k, n]) => chip(k, `${ICON[k] ?? '📦'} ${k} × ${n}`)),
        t('Your barn is empty. Harvest your plants and collect from your animals.'),
      )}
      {section(
        t('My animals'),
        [
          ...Object.entries((farm?.animals ?? []).reduce<Record<string, number>>((m, a) => ({ ...m, [a.kind]: (m[a.kind] ?? 0) + 1 }), {})).map(([k, n]) => chip(k, `${ANIMAL_INFO[k as keyof typeof ANIMAL_INFO].icon} ${k} × ${n}`)),
          ...(farm?.dog ? [chip('dog', `🐕 ${farm.dog.name}`)] : []),
        ],
        t('No animals yet.'),
      )}
      {section(
        t('Furniture for my room'),
        Object.entries(room)
          .filter(([, n]) => n > 0)
          .map(([id, n]) => {
            const f = FURNITURE.find((x) => x.id === id);
            return chip(id, `${f?.icon ?? '🪑'} ${f?.en ?? id} × ${n}`);
          }),
        t('No furniture yet.'),
      )}
      {section(t('My books'), books.map((b) => chip(b.id, `📕 ${b.title}`)), t('No books yet.'))}
      {section(
        t('Clothes, pets and name tags'),
        [...things.map((id) => chip(id, itemLabel(id) ?? id)), ...(colours.length ? [chip('colours', `🎨 ${colours.length} ${t('colours')}: ${colours.map((c) => colorName(c)?.id ?? c).join(', ')}`)] : [])],
        t('Nothing bought yet. Visit the character shop!'),
      )}
    </Panel>
  );
}
