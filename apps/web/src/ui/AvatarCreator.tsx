import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from '@react-three/drei';
import {
  AVATAR_BAGS,
  AVATAR_BODIES,
  AVATAR_GLASSES,
  AVATAR_HAIRSTYLES,
  AVATAR_HATS,
  HAIRSTYLE_LABELS,
  AvatarSchema,
  BAG_ITEMS,
  BODY_LABELS,
  CLOTH_COLORS,
  GLASSES_ITEMS,
  HAIR_COLORS,
  HAT_ITEMS,
  NAME_TAGS,
  TAG_ITEMS,
  AVATAR_PETS,
  PET_ITEMS,
  SKIN_TONES,
  avatarLook,
  itemPrice,
  missingItems,
  type AvatarBody,
  type AvatarLook,
  type PaletteColor,
  type ShopItem,
} from '@es/shared';
import { useGame } from '../store/game';
import { useProfile } from '../store/profile';
import { buyItem, saveAvatar } from '../net/api';
import { sendAvatar } from '../net/client';
import { track } from '../net/analytics';
import { PlayerAvatar } from '../scene/PlayerAvatar';
import { slotLabels } from '../scene/playerLook';
import { Sheet, SheetHeader } from './Sheet';
import { t as tr, useT } from '../i18n';

// Labels that reach t() dynamically (TABS, BODY_LABELS, HAIRSTYLE_LABELS, shop item labels, slotLabels, colour names); listed literally for key extraction. Never called.
const _i18n = () => [
  tr('Body'), tr('Skin & hair'), tr('Clothes'), tr('Extras'),
  tr('T-shirt'), tr('Hoodie'), tr('Suit'), tr('Overalls'), tr('Dress'), tr('Robot'),
  tr('Short'), tr('Spiky'), tr('Curly'), tr('Bob'), tr('Long'), tr('Ponytail'), tr('Buns'), tr('Bald'),
  tr('None'), tr('Cap'), tr('Beanie'), tr('Sun hat'), tr('Top hat'), tr('Crown'), tr('Glasses'), tr('Sunglasses'), tr('Backpack'),
  tr('Details'), tr('Tie'), tr('Shoes'), tr('Belt'), tr('Shirt'), tr('Trousers'), tr('Shorts'),
  tr('blue'), tr('green'), tr('orange'), tr('purple'), tr('white'), tr('grey'), tr('charcoal'), tr('navy'), tr('denim'), tr('khaki'), tr('brown'), tr('red'), tr('pink'), tr('yellow'), tr('teal'), tr('gold'), tr('crimson'), tr('midnight'),
];
void _i18n;

/** Shown once per device: the creator opens by itself on the first visit. */
export const AVATAR_INTRO_KEY = 'es:avatar-intro';

type Tab = 'body' | 'looks' | 'clothes' | 'extras';
const TABS: { id: Tab; label: string }[] = [
  { id: 'body', label: 'Body' },
  { id: 'looks', label: 'Skin & hair' },
  { id: 'clothes', label: 'Clothes' },
  { id: 'extras', label: 'Extras' },
];
const BODY_ICON: Record<AvatarBody, string> = { tee: '👕', hoodie: '🧥', suit: '🤵', girl: '👖', dress: '👗', robot: '🤖' };
const HAT_ICON: Record<string, string> = { none: '🚫', cap: '🧢', beanie: '🧶', sunhat: '👒', tophat: '🎩', crown: '👑', beret: '🎨', cowboy: '🤠', party: '🥳' };
const GLASSES_ICON: Record<string, string> = { none: '🚫', round: '👓', sun: '🕶️' };
const HAIR_ICON: Record<string, string> = { short: '👦', spiky: '⚡', curly: '🌀', bob: '👧', long: '👩', ponytail: '🎀', buns: '🍡', bald: '🥚' };
const HAIRSTYLE_ITEMS = Object.fromEntries(AVATAR_HAIRSTYLES.map((k) => [k, { id: `hair:${k}`, label: HAIRSTYLE_LABELS[k], price: 0 }])) as Record<(typeof AVATAR_HAIRSTYLES)[number], ShopItem>;
const BAG_ICON: Record<string, string> = { none: '🚫', backpack: '🎒' };
const PET_ICON: Record<string, string> = { none: '🚫', cat: '🐈', shiba: '🐕', husky: '🐺', rabbit: '🐇', duck: '🦆', guineapig: '🐹' };
const TAG_ICON: Record<string, string> = { plain: '🏷️', gold: '🥇', ocean: '🌊', rainbow: '🌈' };

const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]!;

/** A random look using only free items. */
function randomLook(): AvatarLook {
  const free = (l: PaletteColor[]) => l.filter((c) => c.price === 0).map((c) => c.hex);
  const freeIds = <K extends string>(rec: Record<K, ShopItem>) => (Object.keys(rec) as K[]).filter((k) => rec[k].price === 0);
  const cloth = free(CLOTH_COLORS);
  return {
    body: pick(AVATAR_BODIES.filter((b) => b !== 'robot')),
    skin: pick(free(SKIN_TONES)),
    hair: pick(free(HAIR_COLORS)),
    hairStyle: pick(AVATAR_HAIRSTYLES),
    top: pick(cloth),
    bottom: pick(cloth),
    shoes: pick(cloth),
    hat: Math.random() < 0.5 ? 'none' : pick(freeIds(HAT_ITEMS)),
    hatColor: pick(cloth),
    glasses: Math.random() < 0.7 ? 'none' : pick(freeIds(GLASSES_ITEMS)),
    bag: 'none',
    tag: 'plain',
    pet: 'none',
  };
}

/** Character creator: pick body, colours and accessories with a live 3D preview; paid items can be tried on before buying. */
export function AvatarCreator() {
  const t = useT();
  const profile = useProfile((s) => s.profile);
  const refresh = useProfile((s) => s.refresh);
  const close = useGame((s) => s.setUiPanel);
  const saved = useMemo(() => avatarLook(profile?.avatar ?? AvatarSchema.parse({})), [profile?.avatar]);
  const [look, setLook] = useState<AvatarLook>(saved);
  const [tab, setTab] = useState<Tab>('body');
  const [wave, setWave] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => localStorage.setItem(AVATAR_INTRO_KEY, '1'), []);

  if (!profile) return null;
  const owned = profile.avatar.owned;
  const missing = missingItems(look, owned) ?? [];
  const cost = missing.reduce((n, id) => n + (itemPrice(id) ?? 0), 0);
  const dirty = JSON.stringify(look) !== JSON.stringify(saved);
  const labels = slotLabels(look.body);
  const set = (patch: Partial<AvatarLook>) => {
    setMsg(null);
    setLook((l) => ({ ...l, ...patch }));
  };

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      for (const id of missing) await buyItem(id);
      await saveAvatar(look);
      await refresh();
      sendAvatar(look);
      track('avatar_save', { body: look.body, hat: look.hat, glasses: look.glasses, bag: look.bag, bought: missing.length, coins: cost });
      setMsg({ ok: true, text: missing.length ? (missing.length > 1 ? t('Bought {n} items and saved!', { n: missing.length }) : t('Bought 1 item and saved!')) : t('Saved! Everyone on the street sees your new look.') });
      setWave((w) => w + 1);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
      void refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet onClose={() => close(null)} label={t('Create your character')} wide>
      <SheetHeader>
        <h2 className="text-lg font-bold">🎨 {t('Your character')}</h2>
        <span className="ml-auto mr-2 text-sm text-gray-600">🪙 {profile.coins}</span>
        <button type="button" onClick={() => close(null)} className="min-h-9 min-w-9 rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100" aria-label={t('Close')}>
          ✕
        </button>
      </SheetHeader>

      <div className="relative h-[30dvh] min-h-44 shrink-0 bg-gradient-to-b from-sky-200 to-emerald-100 sm:h-64">
        <Preview look={look} wave={wave} head={tab === 'extras' || tab === 'looks'} />
        <div className="absolute bottom-2 left-2 flex gap-1.5">
          <button type="button" onClick={() => set(randomLook())} className="rounded-full bg-white/90 px-3 py-1 text-sm shadow hover:bg-white">
            🎲 {t('Random')}
          </button>
          <button type="button" onClick={() => setWave((w) => w + 1)} className="rounded-full bg-white/90 px-3 py-1 text-sm shadow hover:bg-white" aria-label={t('Wave')}>
            👋
          </button>
        </div>
        <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/30 px-2 py-0.5 text-[11px] text-white">{t('drag to turn · scroll/pinch to zoom')}</span>
      </div>

      <div className="flex shrink-0 gap-1 border-b px-3 pt-2">
        {TABS.map((tb) => (
          <button key={tb.id} type="button" onClick={() => setTab(tb.id)} className={`flex-1 rounded-t-lg px-2 py-1.5 text-sm ${tab === tb.id ? 'bg-blue-600 font-semibold text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
            {t(tb.label)}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        {tab === 'body' && (
          <div className="grid grid-cols-3 gap-2">
            {AVATAR_BODIES.map((b) => (
              <button key={b} type="button" onClick={() => set({ body: b })} className={`flex flex-col items-center rounded-xl border-2 py-2 text-sm ${look.body === b ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <span className="text-3xl">{BODY_ICON[b]}</span>
                {t(BODY_LABELS[b])}
              </button>
            ))}
          </div>
        )}
        {tab === 'looks' &&
          (look.body === 'robot' ? (
            <p className="text-sm text-gray-500">{t('Robots have no skin or hair 🤖 — pick their colours under Clothes. The antenna light uses the hat colour.')}</p>
          ) : (
            <>
              <Swatches title={t('Skin')} list={SKIN_TONES} value={look.skin} owned={owned} onPick={(skin) => set({ skin })} />
              <Items title={t('Hairstyle')} keys={AVATAR_HAIRSTYLES} items={HAIRSTYLE_ITEMS} icons={HAIR_ICON} value={look.hairStyle} owned={owned} onPick={(hairStyle) => set({ hairStyle })} />
              <Swatches title={t('Hair colour')} list={HAIR_COLORS} value={look.hair} owned={owned} onPick={(hair) => set({ hair })} />
            </>
          ))}
        {tab === 'clothes' && (
          <>
            <Swatches title={t(labels.top)} list={CLOTH_COLORS} value={look.top} owned={owned} onPick={(top) => set({ top })} />
            {labels.bottom && <Swatches title={t(labels.bottom)} list={CLOTH_COLORS} value={look.bottom} owned={owned} onPick={(bottom) => set({ bottom })} />}
            {labels.shoes && <Swatches title={t(labels.shoes)} list={CLOTH_COLORS} value={look.shoes} owned={owned} onPick={(shoes) => set({ shoes })} />}
          </>
        )}
        {tab === 'extras' && (
          <>
            <Items title={t('Hat')} keys={AVATAR_HATS} items={HAT_ITEMS} icons={HAT_ICON} value={look.hat} owned={owned} onPick={(hat) => set({ hat })} />
            {(look.body === 'robot' || (look.hat !== 'none' && look.hat !== 'crown')) && <Swatches title={t('Hat colour')} list={CLOTH_COLORS} value={look.hatColor} owned={owned} onPick={(hatColor) => set({ hatColor })} />}
            <Items title={t('Glasses')} keys={AVATAR_GLASSES} items={GLASSES_ITEMS} icons={GLASSES_ICON} value={look.glasses} owned={owned} onPick={(glasses) => set({ glasses })} />
            {look.body !== 'robot' && <Items title={t('Bag')} keys={AVATAR_BAGS} items={BAG_ITEMS} icons={BAG_ICON} value={look.bag} owned={owned} onPick={(bag) => set({ bag })} />}
            <Items title={t('A pet that walks with you')} keys={AVATAR_PETS} items={PET_ITEMS} icons={PET_ICON} value={look.pet} owned={owned} onPick={(pet) => set({ pet })} />
            <Items title={t('Name tag (everybody sees it)')} keys={NAME_TAGS} items={TAG_ITEMS} icons={TAG_ICON} value={look.tag} owned={owned} onPick={(tag) => set({ tag })} />
            <p className="mt-1 text-xs text-gray-500">{t('Items with 🪙 can be tried on for free — you only pay when you save. Earn coins by finishing quests.')}</p>
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t p-3">
        <p className={`min-w-0 flex-1 text-sm ${msg ? (msg.ok ? 'text-green-700' : 'text-red-600') : 'text-gray-500'}`}>
          {msg?.text ?? (cost > 0 ? (missing.length > 1 ? t('Buying {n} items: 🪙 {cost}', { n: missing.length, cost }) : t('Buying 1 item: 🪙 {cost}', { cost })) : dirty ? t('Unsaved changes') : t('This is you!'))}
        </p>
        {dirty && (
          <button type="button" onClick={() => set(saved)} className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
            {t('Undo')}
          </button>
        )}
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || !dirty || cost > profile.coins}
          className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          {busy ? t('Saving…') : cost > profile.coins ? t('Not enough 🪙') : cost > 0 ? t('Buy & save · 🪙{cost}', { cost }) : t('Save')}
        </button>
      </div>
    </Sheet>
  );
}

function Preview({ look, wave, head }: { look: AvatarLook; wave: number; head: boolean }) {
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 1.05, 2.7], fov: 32 }} gl={{ antialias: true }} onCreated={({ camera }) => camera.lookAt(0, 0.78, 0)}>
      <hemisphereLight args={['#ffffff', '#8aa08a', 1.6]} />
      <directionalLight position={[2, 4, 3]} intensity={1.6} />
      <Suspense fallback={null}>
        <WavingAvatar look={look} wave={wave} />
      </Suspense>
      <mesh rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.7, 32]} />
        <meshStandardMaterial color="#9fcf9a" />
      </mesh>
      <OrbitControls makeDefault target={[0, 0.78, 0]} enablePan={false} minDistance={0.8} maxDistance={3.2} minPolarAngle={Math.PI / 3} maxPolarAngle={1.58} autoRotate autoRotateSpeed={1.2} />
      <Focus head={head} />
    </Canvas>
  );
}

/** Glide the camera to the face (skin, hair, hats, glasses) or back to the whole body when the tab changes. */
function Focus({ head }: { head: boolean }) {
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null;
  const camera = useThree((s) => s.camera);
  const goal = useRef({ y: 0.78, d: 2.7, polar: 1.43, t: 0 });
  useEffect(() => {
    // Eye level for the face (from above, hat brims would hide the eyes); slightly from above for the body.
    goal.current = head ? { y: 1.15, d: 1.9, polar: 1.5, t: 1.2 } : { y: 0.78, d: 2.7, polar: 1.43, t: 1.2 };
  }, [head]);
  useFrame((_, dt) => {
    const g = goal.current;
    if (!controls || g.t <= 0) return;
    g.t -= dt;
    const k = 1 - Math.pow(0.004, dt);
    controls.target.y += (g.y - controls.target.y) * k;
    const sph = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    sph.radius += (g.d - sph.radius) * k;
    sph.phi += (g.polar - sph.phi) * k;
    camera.position.setFromSpherical(sph).add(controls.target);
    controls.update();
  });
  return null;
}

/** Waves for ~2 s whenever `wave` changes (save, 👋 button). */
function WavingAvatar({ look, wave }: { look: AvatarLook; wave: number }) {
  const [waving, setWaving] = useState(false);
  useEffect(() => {
    if (!wave) return;
    setWaving(true);
    const t = setTimeout(() => setWaving(false), 2200);
    return () => clearTimeout(t);
  }, [wave]);
  return <PlayerAvatar look={look} anim={waving ? 'wave' : 'idle'} />;
}

function Swatches({ title, list, value, owned, onPick }: { title: string; list: PaletteColor[]; value: string; owned: string[]; onPick: (hex: string) => void }) {
  const t = useT();
  return (
    <div className="mb-3">
      <h3 className="mb-1.5 text-sm font-semibold text-gray-700">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {list.map((c) => {
          const selected = c.hex.toLowerCase() === value.toLowerCase();
          const locked = c.price > 0 && !owned.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onPick(c.hex)}
              title={locked ? `${t(c.id)} · 🪙${c.price}` : t(c.id)}
              aria-label={locked ? t('{title} {colour} ({price} coins)', { title, colour: t(c.id), price: c.price }) : `${title} ${t(c.id)}`}
              className={`relative h-9 w-9 rounded-full shadow-inner ring-offset-2 ${selected ? 'ring-2 ring-blue-600' : 'ring-1 ring-black/10 hover:ring-gray-400'}`}
              style={{ background: c.hex }}
            >
              {locked && <span className="absolute -bottom-1 -right-1 rounded-full bg-white px-1 text-[9px] leading-4 shadow">🪙{c.price}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Items<K extends string>({ title, keys, items, icons, value, owned, onPick }: { title: string; keys: readonly K[]; items: Record<K, ShopItem>; icons: Record<string, string>; value: K; owned: string[]; onPick: (k: K) => void }) {
  const t = useT();
  return (
    <div className="mb-3">
      <h3 className="mb-1.5 text-sm font-semibold text-gray-700">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {keys.map((k) => {
          const it = items[k];
          const locked = it.price > 0 && !owned.includes(it.id);
          return (
            <button key={k} type="button" onClick={() => onPick(k)} className={`flex w-20 flex-col items-center rounded-xl border-2 py-1.5 text-xs ${value === k ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
              <span className="text-2xl">{icons[k]}</span>
              {t(it.label)}
              {locked && <span className="text-[10px] text-amber-700">🪙 {it.price}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
