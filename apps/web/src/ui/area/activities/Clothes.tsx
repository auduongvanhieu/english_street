import { Suspense, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { AvatarSchema, CLOTH_COLORS, avatarLook, itemPrice, missingItems, type AreaContentDto, type AreaItemDto, type AvatarLook } from '@es/shared';
import { tk, useLang, useT } from '../../../i18n';
import { useWorld } from '../../../store/world';
import { useProfile } from '../../../store/profile';
import { useArea } from '../../../store/area';
import { buyItem, saveAvatar, sendAreaQuiz } from '../../../net/api';
import { sendAvatar } from '../../../net/client';
import { track } from '../../../net/analytics';
import { PlayerAvatar } from '../../../scene/PlayerAvatar';
import { say } from '../common';
import {
  EMPTY_PICK,
  GAME_COLOURS,
  GLASSES,
  HATS,
  LOWER,
  OUTFITS,
  SIZES,
  colourName,
  describeLook,
  makeRequests,
  mistakes,
  money,
  priceOf,
  wearPick,
  type Pick,
  type Request,
} from './clothesShop';

const NONE: string[] = [];
const ROUND = 5;
type Mode = 'menu' | 'game' | 'wardrobe';

/** The wardrobe sells coin colours; 💎 colours (and any already owned) are in Create character. */
const SHOP_COLORS = CLOTH_COLORS.filter((c) => !c.gems);

/** 🪞 Fitting room: serve customers (pick the right clothes, colours and size, then the price) or try clothes on yourself and buy them. */
export default function ClothesActivity({ content }: { content: AreaContentDto }) {
  const t = useT();
  const [mode, setMode] = useState<Mode>('menu');
  if (mode === 'game') return <Game content={content} onExit={() => setMode('menu')} />;
  if (mode === 'wardrobe') return <Wardrobe content={content} onExit={() => setMode('menu')} />;
  return (
    <div className="space-y-3 py-3">
      <p className="text-sm text-gray-600">{t('Chloe needs help in the shop today! Choose a game.')}</p>
      <button type="button" onClick={() => setMode('game')} className="flex min-h-16 w-full items-center gap-3 rounded-xl border-2 border-pink-200 bg-pink-50 p-3 text-left hover:border-pink-400">
        <span className="text-3xl">🛍️</span>
        <span>
          <span className="block font-semibold">{t('Help the customers')}</span>
          <span className="block text-xs text-gray-600">{t('Listen to {n} customers, find the right clothes, colour and size, then say the price.', { n: ROUND })}</span>
        </span>
      </button>
      <button type="button" onClick={() => setMode('wardrobe')} className="flex min-h-16 w-full items-center gap-3 rounded-xl border-2 border-violet-200 bg-violet-50 p-3 text-left hover:border-violet-400">
        <span className="text-3xl">🪞</span>
        <span>
          <span className="block font-semibold">{t('Try on & buy')}</span>
          <span className="block text-xs text-gray-600">{t('Try clothes on your own character, describe your outfit and buy special items with coins.')}</span>
        </span>
      </button>
    </div>
  );
}

/** Small turning 3D preview of a look (same character as on the street). */
function Preview({ look, className = '' }: { look: AvatarLook; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-gradient-to-b from-pink-100 to-violet-100 ${className}`}>
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, 1.0, 3.4], fov: 32 }} onCreated={({ camera }) => camera.lookAt(0, 0.75, 0)}>
        <hemisphereLight args={['#ffffff', '#b8a0b0', 1.6]} />
        <directionalLight position={[2, 4, 3]} intensity={1.5} />
        <Suspense fallback={null}>
          <PlayerAvatar look={look} anim="idle" />
        </Suspense>
        <mesh rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.65, 32]} />
          <meshStandardMaterial color="#f7d6e6" />
        </mesh>
        <OrbitControls makeDefault target={[0, 0.75, 0]} enablePan={false} enableZoom={false} minPolarAngle={Math.PI / 3} maxPolarAngle={1.58} autoRotate autoRotateSpeed={1.5} />
      </Canvas>
    </div>
  );
}

function useBaseLook(): AvatarLook {
  const avatar = useProfile((s) => s.profile?.avatar);
  return useMemo(() => avatarLook(avatar ?? AvatarSchema.parse({})), [avatar]);
}

/** Price tag of a content item: dollars, crossed out and halved when on sale. */
function Tag({ item, sale }: { item?: AreaItemDto; sale: string[] }) {
  if (item?.price == null) return null;
  const on = sale.includes(item.id);
  return (
    <span className="text-[10px] leading-3" dir="ltr">
      {on ? (
        <>
          <s className="text-gray-400">{money(item.price)}</s> <b className="text-red-600">{money(priceOf(item.price, true))}</b>
        </>
      ) : (
        <span className="text-emerald-700">{money(item.price)}</span>
      )}
    </span>
  );
}

function Chip({ on, onClick, disabled, children }: { on: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative flex min-h-11 min-w-[4.25rem] flex-col items-center justify-center rounded-xl border-2 px-1.5 py-1 text-xs disabled:opacity-40 ${on ? 'border-pink-500 bg-pink-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
    >
      {children}
    </button>
  );
}

function Swatches({ value, onPick, colours, owned, label }: { value: string | null; onPick: (hex: string) => void; colours: { hex: string; price?: number; id?: string }[]; owned?: string[]; label: string }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {colours.map((c) => {
        const locked = !!c.price && !!owned && !owned.includes(c.id ?? '');
        return (
          <button
            key={c.hex}
            type="button"
            onClick={() => onPick(c.hex)}
            aria-label={`${label}: ${colourName(c.hex)}`}
            className={`relative h-11 w-11 rounded-full shadow-inner ring-offset-2 ${value?.toLowerCase() === c.hex.toLowerCase() ? 'ring-[3px] ring-pink-500' : 'ring-1 ring-black/15'}`}
            style={{ background: c.hex }}
          >
            {locked ? <span className="absolute -bottom-1 -right-1 rounded-full bg-white px-1 text-[9px] leading-4 shadow">🪙{c.price}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

const H = ({ children }: { children: React.ReactNode }) => <h4 className="mb-1 mt-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500">{children}</h4>;

// ------------------------------------------------------------------------------------------- customers game

interface Result {
  correct: number;
  total: number;
  xp: number;
  coins: number;
}

function Game({ content, onExit }: { content: AreaContentDto; onExit: () => void }) {
  const t = useT();
  const gone = useWorld((s) => s.cfg?.soldOut.clothes ?? NONE);
  const sale = useWorld((s) => s.cfg?.sale?.clothes ?? NONE);
  const base = useBaseLook();
  const [reqs, setReqs] = useState<Request[]>(() => makeRequests(ROUND, gone));
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<Pick>(EMPTY_PICK);
  const [step, setStep] = useState<'pick' | 'checked' | 'price' | 'priced'>('pick');
  const [bad, setBad] = useState<string[]>([]);
  const [priceAnswer, setPriceAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [wrong, setWrong] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const req = reqs[i];
  const item = (id: string) => content.items.find((x) => x.id === id);
  const set = (p: Partial<Pick>) => step === 'pick' && setPick((old) => ({ ...old, ...p }));

  const total = req ? req.items.reduce((n, id) => n + priceOf(item(id)?.price, sale.includes(id)), 0) : 0;
  const options = useMemo(() => {
    const full = req ? req.items.reduce((n, id) => n + (item(id)?.price ?? 0), 0) : 0;
    const opts = new Set([total, full !== total ? full : total + 5, total + 10, Math.max(1, total - 3), total * 2]);
    return [...opts].slice(0, 3).sort(() => Math.random() - 0.5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, reqs, total]);

  const check = () => {
    if (!req) return;
    const b = mistakes(req.want, pick);
    setBad(b);
    if (!b.length) setScore((s) => s + 1);
    else setWrong((w) => [...w, ...b.filter((x) => x !== 'size')]);
    setStep('checked');
    say(b.length ? "Hmm, that's not quite what I asked for." : 'Perfect, thank you! How much is it?');
  };
  const answerPrice = (n: number) => {
    setPriceAnswer(n);
    setStep('priced');
    if (n === total) setScore((s) => s + 1);
    else setWrong((w) => [...w, 'price-tag']);
    say(`That's ${money(total).replace('$', '')} dollars, please.`);
  };
  const next = async () => {
    const n = i + 1;
    if (n < reqs.length) {
      setI(n);
      setPick(EMPTY_PICK);
      setStep('pick');
      setBad([]);
      setPriceAnswer(null);
      say(reqs[n]!.text);
      return;
    }
    const all = reqs.length * 2;
    let xp = 0;
    let coins = 0;
    try {
      const r = await sendAreaQuiz('clothes', score, all, wrong);
      xp = r.xp;
      coins = r.coins;
      if (r.badge) useArea.getState().showBadge(r.badge);
      void useProfile.getState().refresh();
    } catch {
      /* offline: no reward */
    }
    track('clothes_fitting_done', { correct: score, total: all });
    setResult({ correct: score, total: all, xp, coins });
  };
  const again = () => {
    const r = makeRequests(ROUND, gone);
    setReqs(r);
    setI(0);
    setPick(EMPTY_PICK);
    setStep('pick');
    setBad([]);
    setPriceAnswer(null);
    setScore(0);
    setWrong([]);
    setResult(null);
    if (r[0]) say(r[0].text);
  };

  if (result || !req)
    return (
      <div className="py-6 text-center">
        <div className="text-5xl">{result && result.correct === result.total ? '🏆' : '🛍️'}</div>
        {result ? <p className="mt-1 font-semibold">{t('{score} / {total} right', { score: result.correct, total: result.total })}</p> : null}
        {result && (result.xp || result.coins) ? <p className="text-sm text-emerald-700">+{result.xp} XP{result.coins ? ` · +${result.coins} 🪙` : ''}</p> : null}
        <p className="mt-1 text-sm" dir="ltr">
          “Thanks for your help today! You're a great shop assistant.”
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <button type="button" onClick={onExit} className="min-h-11 rounded-lg border px-4 text-sm">
            ← {t('Back')}
          </button>
          <button type="button" onClick={again} className="min-h-11 rounded-lg bg-pink-600 px-5 text-sm font-semibold text-white">
            🔁 {t('Play again')}
          </button>
        </div>
      </div>
    );

  const outfit = OUTFITS.find((o) => o.id === pick.outfit);
  const lowerId = outfit ? LOWER[outfit.body] : undefined;
  const look = wearPick(base, pick);
  const hatHasColour = pick.hat === 'cap' || pick.hat === 'beanie';
  return (
    <div className="space-y-2 py-2">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <button type="button" onClick={onExit} className="min-h-9 rounded px-1 hover:bg-gray-100">
          ← {t('Back')}
        </button>
        <span>{t('Customer {n} of {total}', { n: i + 1, total: reqs.length })} · ⭐ {score}</span>
      </div>
      <div className="flex items-start gap-2 rounded-xl bg-yellow-50 p-3 shadow-inner">
        <span className="text-3xl">{req.who}</span>
        <p className="flex-1 text-base font-medium" dir="ltr">
          “{req.text}”
        </p>
        <button type="button" onClick={() => say(req.text)} className="min-h-11 min-w-11 rounded-full bg-white text-lg shadow" aria-label={t('Listen')}>
          🔊
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-[11rem_1fr]">
        <Preview look={look} className="h-44 sm:h-60" />
        <div>
          <H>{t('Clothes')}</H>
          <div className="flex flex-wrap gap-1.5">
            {OUTFITS.map((o) => (
              <Chip key={o.id} on={pick.outfit === o.id} disabled={gone.includes(o.id)} onClick={() => set({ outfit: o.id, lower: null })}>
                <span className="text-xl">{item(o.id)?.icon}</span>
                <span dir="ltr">{item(o.id)?.en ?? o.id}</span>
                {gone.includes(o.id) ? <span className="text-[10px] text-gray-600">{t('Sold out')}</span> : <Tag item={item(o.id)} sale={sale} />}
              </Chip>
            ))}
          </div>
          {pick.outfit ? (
            <>
              <H>{t('Colour')}</H>
              <Swatches label={t('Colour')} colours={GAME_COLOURS} value={pick.colour} onPick={(colour) => set({ colour })} />
            </>
          ) : null}
          {lowerId && !gone.includes(lowerId) ? (
            <>
              <H>
                <span dir="ltr">
                  {item(lowerId)?.icon} {item(lowerId)?.en}
                </span>{' '}
                <Tag item={item(lowerId)} sale={sale} />
              </H>
              <Swatches label={item(lowerId)?.en ?? lowerId} colours={GAME_COLOURS} value={pick.lower} onPick={(lower) => set({ lower })} />
            </>
          ) : null}
        </div>
      </div>

      <H>
        👟 <span dir="ltr">shoes / trainers</span> <Tag item={item('shoes')} sale={sale} />
      </H>
      <Swatches label="shoes" colours={GAME_COLOURS} value={pick.shoes} onPick={(shoes) => set({ shoes })} />

      <H>{t('Hats, glasses and bags')}</H>
      <div className="flex flex-wrap gap-1.5">
        {HATS.map((h) => (
          <Chip key={h.id} on={pick.hat === h.id} disabled={gone.includes(h.id)} onClick={() => set({ hat: pick.hat === h.id ? null : h.id })}>
            <span className="text-xl">{item(h.id)?.icon}</span>
            <span dir="ltr">{item(h.id)?.en}</span>
            <Tag item={item(h.id)} sale={sale} />
          </Chip>
        ))}
        {GLASSES.map((g) => (
          <Chip key={g.id} on={pick.glasses === g.id} disabled={gone.includes(g.id)} onClick={() => set({ glasses: pick.glasses === g.id ? null : g.id })}>
            <span className="text-xl">{item(g.id)?.icon}</span>
            <span dir="ltr">{item(g.id)?.en}</span>
            <Tag item={item(g.id)} sale={sale} />
          </Chip>
        ))}
        <Chip on={pick.bag} disabled={gone.includes('backpack')} onClick={() => set({ bag: !pick.bag })}>
          <span className="text-xl">🎒</span>
          <span dir="ltr">backpack</span>
          <Tag item={item('backpack')} sale={sale} />
        </Chip>
      </div>
      {hatHasColour ? (
        <>
          <H>{t('Hat colour')}</H>
          <Swatches label={t('Hat colour')} colours={GAME_COLOURS} value={pick.hatColour} onPick={(hatColour) => set({ hatColour })} />
        </>
      ) : null}

      <H>{t('Size')}</H>
      <div className="flex gap-1.5">
        {SIZES.map((s) => (
          <Chip key={s} on={pick.size === s} onClick={() => set({ size: pick.size === s ? null : s })}>
            <span className="text-sm font-bold">{s}</span>
          </Chip>
        ))}
      </div>

      {step === 'pick' ? (
        <button type="button" onClick={check} disabled={!pick.outfit || !pick.colour} className="mt-2 min-h-11 w-full rounded-lg bg-pink-600 text-sm font-semibold text-white disabled:opacity-50">
          🛍️ {t('Here you are!')}
        </button>
      ) : (
        <div className="mt-2 space-y-2 rounded-xl border bg-white p-3">
          {bad.length ? (
            <p className="text-sm text-red-700">
              ✗ {t('Not quite. Check:')}{' '}
              <span dir="ltr">{bad.map((b) => (b === 'size' ? `size ${req.want.size}` : (item(b)?.en ?? b))).join(', ')}</span>
            </p>
          ) : (
            <p className="text-sm text-green-700">✓ {t('Perfect! That is exactly what the customer wanted.')}</p>
          )}
          {step === 'checked' ? (
            <button type="button" onClick={() => setStep('price')} className="min-h-11 w-full rounded-lg bg-emerald-600 text-sm font-semibold text-white">
              🏷️ {t('Next: the price')}
            </button>
          ) : (
            <>
              <p className="text-sm font-medium" dir="ltr">
                {req.who} “How much is it?”
              </p>
              <p className="text-xs text-gray-500">{t('Add up the price tags of everything the customer asked for. SALE items are half price.')}</p>
              <div className="flex gap-2">
                {options.map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={step === 'priced'}
                    onClick={() => answerPrice(n)}
                    className={`min-h-11 flex-1 rounded-lg border-2 text-base font-semibold ${step === 'priced' && n === total ? 'border-green-600 bg-green-50' : step === 'priced' && n === priceAnswer ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}
                    dir="ltr"
                  >
                    {money(n)}
                  </button>
                ))}
              </div>
              {step === 'priced' ? (
                <>
                  <p className="text-sm" dir="ltr">
                    “That's {money(total)}, please.” {priceAnswer === total ? '✓' : '✗'}
                  </p>
                  <button type="button" onClick={() => void next()} className="min-h-11 w-full rounded-lg bg-pink-600 text-sm font-semibold text-white">
                    {i + 1 < reqs.length ? `➡ ${t('Next customer')}` : `🏁 ${t('Finish')}`}
                  </button>
                </>
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------------------------------- try on & buy

const COMPLIMENTS = ['That colour really suits you!', 'You look great!', 'It fits perfectly!', 'I love your new look!'];
const ERR: Record<string, string> = { not_enough_coins: tk('Not enough coins.'), unauthorized: tk('Sign in to buy clothes.') };

/**
 * Try on & buy. `compact` (the 3D fitting room): no little preview (the mirror shows you) and every change is passed
 * to `onLook` so the character in the street wears it while you try.
 */
export function Wardrobe({ content, onExit, compact, onLook }: { content: AreaContentDto; onExit: () => void; compact?: boolean; onLook?: (l: AvatarLook) => void }) {
  const t = useT();
  const noTr = useLang((s) => s.lang === 'en');
  const gone = useWorld((s) => s.cfg?.soldOut.clothes ?? NONE);
  const sale = useWorld((s) => s.cfg?.sale?.clothes ?? NONE);
  const profile = useProfile((s) => s.profile);
  const saved = useBaseLook();
  const [look, setLook] = useState<AvatarLook>(saved);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const owned = profile?.avatar.owned ?? NONE;
  const missing = missingItems(look, owned) ?? [];
  const cost = missing.reduce((n, id) => n + (itemPrice(id) ?? 0), 0);
  const dirty = JSON.stringify(look) !== JSON.stringify(saved);
  const item = (id: string) => content.items.find((x) => x.id === id);
  const set = (p: Partial<AvatarLook>) => {
    setMsg(null);
    setLook((l) => ({ ...l, ...p }));
  };
  useEffect(() => onLook?.(look), [look, onLook]);
  const sentence = describeLook(look);
  const outfit = OUTFITS.find((o) => o.body === look.body);
  const lowerId = LOWER[look.body];
  const hatColour = look.hat !== 'none' && look.hat !== 'crown';

  async function wear() {
    setBusy(true);
    setMsg(null);
    try {
      for (const id of missing) await buyItem(id);
      await saveAvatar(look);
      await useProfile.getState().refresh();
      sendAvatar(look);
      track('clothes_wardrobe_save', { body: look.body, hat: look.hat, glasses: look.glasses, bag: look.bag, bought: missing.length, coins: cost });
      const c = COMPLIMENTS[Math.floor(Math.random() * COMPLIMENTS.length)]!;
      say(c, 'en-GB');
      setMsg({ ok: true, text: `Chloe: “${c}”` });
    } catch (e) {
      const m = (e as Error).message;
      setMsg({ ok: false, text: ERR[m] ? t(ERR[m]) : m });
      void useProfile.getState().refresh();
    } finally {
      setBusy(false);
    }
  }

  const label = (id: string) => (
    <>
      <span className="text-xl">{item(id)?.icon}</span>
      <span dir="ltr">{item(id)?.en ?? id}</span>
      {!noTr && item(id)?.tr.meaning ? <span className="max-w-[4.5rem] truncate text-[10px] text-blue-800">{item(id)?.tr.meaning}</span> : null}
      {gone.includes(id) ? <span className="text-[10px] text-gray-600">{t('Sold out')}</span> : sale.includes(id) ? <span className="absolute -right-1 -top-1 rounded bg-red-600 px-1 text-[9px] font-bold text-white">SALE</span> : null}
    </>
  );

  return (
    <div className="space-y-2 py-2">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <button type="button" onClick={onExit} className="min-h-9 rounded px-1 hover:bg-gray-100">
          ← {t('Back')}
        </button>
        <span>🪙 {profile?.coins ?? 0}</span>
      </div>
      <div className={compact ? '' : 'grid gap-3 sm:grid-cols-[11rem_1fr]'}>
        {compact ? null : <Preview look={look} className="h-44 sm:h-60" />}
        <div>
          <div className="rounded-xl bg-violet-50 p-2.5">
            <p className="text-sm font-medium" dir="ltr">
              {sentence}{' '}
              <button type="button" onClick={() => say(sentence)} className="text-xs" aria-label={t('Listen')}>
                🔊
              </button>
            </p>
            <p className="mt-0.5 text-[11px] text-gray-500">{t('Read it aloud: this is how you describe your outfit in English.')}</p>
          </div>
          <H>{t('Clothes')}</H>
          <div className="flex flex-wrap gap-1.5">
            {OUTFITS.map((o) => (
              <Chip key={o.id} on={look.body === o.body} disabled={gone.includes(o.id)} onClick={() => set({ body: o.body })}>
                {label(o.id)}
              </Chip>
            ))}
          </div>
        </div>
      </div>
      {outfit ? (
        <>
          <H>
            <span dir="ltr">{item(outfit.id === 'overalls' ? 'shirt' : outfit.id)?.en}</span>
          </H>
          <Swatches label={t('Colour')} colours={SHOP_COLORS} owned={owned} value={look.top} onPick={(top) => set({ top })} />
          <H>
            <span dir="ltr">{lowerId ? item(lowerId)?.en : outfit.id === 'suit' ? 'tie' : outfit.id === 'dress' ? 'belt' : 'overalls'}</span>
          </H>
          <Swatches label={t('Colour')} colours={SHOP_COLORS} owned={owned} value={look.bottom} onPick={(bottom) => set({ bottom })} />
          <H>
            <span dir="ltr">shoes</span>
          </H>
          <Swatches label="shoes" colours={SHOP_COLORS} owned={owned} value={look.shoes} onPick={(shoes) => set({ shoes })} />
        </>
      ) : null}
      <H>{t('Hats, glasses and bags')}</H>
      <div className="flex flex-wrap gap-1.5">
        {HATS.map((h) => (
          <Chip key={h.id} on={look.hat === h.hat} disabled={gone.includes(h.id)} onClick={() => set({ hat: look.hat === h.hat ? 'none' : h.hat })}>
            {label(h.id)}
            {itemPrice(`hat:${h.hat}`) && !owned.includes(`hat:${h.hat}`) ? <span className="text-[10px] text-amber-700">🪙 {itemPrice(`hat:${h.hat}`)}</span> : null}
          </Chip>
        ))}
        {GLASSES.map((g) => (
          <Chip key={g.id} on={look.glasses === g.glasses} disabled={gone.includes(g.id)} onClick={() => set({ glasses: look.glasses === g.glasses ? 'none' : g.glasses })}>
            {label(g.id)}
            {itemPrice(`glasses:${g.glasses}`) && !owned.includes(`glasses:${g.glasses}`) ? <span className="text-[10px] text-amber-700">🪙 {itemPrice(`glasses:${g.glasses}`)}</span> : null}
          </Chip>
        ))}
        {look.body !== 'robot' ? (
          <Chip on={look.bag === 'backpack'} disabled={gone.includes('backpack')} onClick={() => set({ bag: look.bag === 'backpack' ? 'none' : 'backpack' })}>
            {label('backpack')}
            {!owned.includes('bag:backpack') ? <span className="text-[10px] text-amber-700">🪙 {itemPrice('bag:backpack')}</span> : null}
          </Chip>
        ) : null}
      </div>
      {hatColour ? (
        <>
          <H>{t('Hat colour')}</H>
          <Swatches label={t('Hat colour')} colours={SHOP_COLORS} owned={owned} value={look.hatColor} onPick={(hatColor) => set({ hatColor })} />
        </>
      ) : null}
      <p className="text-[11px] text-gray-500">{t('Trying on is free. Items with 🪙 cost coins when you buy them; everything else is free to wear.')}</p>

      <div className="sticky bottom-0 -mx-1 flex items-center gap-2 border-t bg-white/95 px-1 py-2">
        <p className={`min-w-0 flex-1 text-sm ${msg ? (msg.ok ? 'text-green-700' : 'text-red-600') : 'text-gray-500'}`}>
          {msg?.text ?? (cost > 0 ? t('Buying {n} item(s): 🪙 {cost}', { n: missing.length, cost }) : dirty ? t('Not saved yet') : t('This is you!'))}
        </p>
        {dirty ? (
          <button type="button" onClick={() => set(saved)} className="min-h-11 rounded-lg border px-3 text-sm">
            {t('Undo')}
          </button>
        ) : null}
        <button type="button" onClick={() => void wear()} disabled={!profile || busy || !dirty || cost > (profile?.coins ?? 0)} className="min-h-11 rounded-lg bg-pink-600 px-4 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? t('Saving…') : cost > (profile?.coins ?? 0) ? t('Not enough 🪙') : cost > 0 ? t('Buy & wear · 🪙{cost}', { cost }) : t('Wear it')}
        </button>
      </div>
    </div>
  );
}
