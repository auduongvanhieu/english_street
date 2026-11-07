import { CLOTH_COLORS, type AvatarBody, type AvatarHat, type AvatarLook } from '@es/shared';

/**
 * Style Corner fitting room: which content items (packages/quests/content/areas/clothes.yaml ids) can be worn by
 * the player's chibi and how, the colour words, the customer requests of the game and the "I'm wearing…" sentence.
 */

/** Colour words used by the customers (all free palette colours). */
export const GAME_COLOURS: { en: string; hex: string }[] = [
  { en: 'red', hex: '#c8443a' },
  { en: 'blue', hex: '#4a90e2' },
  { en: 'green', hex: '#43b86a' },
  { en: 'yellow', hex: '#f3d14a' },
  { en: 'orange', hex: '#f08a3c' },
  { en: 'purple', hex: '#8e5bd8' },
  { en: 'pink', hex: '#ef8fb0' },
  { en: 'white', hex: '#f2f2f2' },
  { en: 'grey', hex: '#8a8f98' },
  { en: 'black', hex: '#2f3437' },
  { en: 'brown', hex: '#6b4a32' },
  { en: 'navy', hex: '#24365c' },
];
/** English names of the palette colours whose ids are not plain words. */
const COLOUR_WORD: Record<string, string> = { charcoal: 'black', crimson: 'dark red', midnight: 'dark blue', denim: 'denim blue' };
export function colourName(hex: string): string {
  const c = CLOTH_COLORS.find((x) => x.hex.toLowerCase() === hex.toLowerCase());
  return c ? (COLOUR_WORD[c.id] ?? c.id) : 'colourful';
}
export const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a');

/** Outfits (the chibi bodies) sold at the shop; `slot` = the look colour the garment's colour goes to. */
export const OUTFITS: { id: string; body: AvatarBody; slot: 'top' | 'bottom' }[] = [
  { id: 't-shirt', body: 'tee', slot: 'top' },
  { id: 'hoodie', body: 'hoodie', slot: 'top' },
  { id: 'dress', body: 'dress', slot: 'top' },
  { id: 'suit', body: 'suit', slot: 'top' },
  { id: 'overalls', body: 'girl', slot: 'bottom' },
];
/** The lower half that comes with an outfit (shorts with a T-shirt, trousers with a hoodie). */
export const LOWER: Partial<Record<AvatarBody, string>> = { tee: 'shorts', hoodie: 'trousers' };
export const HATS: { id: string; hat: AvatarHat }[] = [
  { id: 'cap', hat: 'cap' },
  { id: 'beanie', hat: 'beanie' },
  { id: 'sun-hat', hat: 'sunhat' },
  { id: 'top-hat', hat: 'tophat' },
];
export const GLASSES: { id: string; glasses: 'round' | 'sun' }[] = [
  { id: 'glasses', glasses: 'round' },
  { id: 'sunglasses', glasses: 'sun' },
];
export const SIZES = ['S', 'M', 'L', 'XL'] as const;
export type Size = (typeof SIZES)[number];
const SIZE_WORD: Record<Size, string> = { S: 'small', M: 'medium', L: 'large', XL: 'extra large' };

/** What the learner put together in the fitting room. */
export interface Pick {
  outfit: string | null;
  colour: string | null;
  lower: string | null;
  shoes: string | null;
  hat: string | null;
  hatColour: string | null;
  glasses: string | null;
  bag: boolean;
  size: Size | null;
}
export const EMPTY_PICK: Pick = { outfit: null, colour: null, lower: null, shoes: null, hat: null, hatColour: null, glasses: null, bag: false, size: null };

/** A customer's request: the line they say and the pick that answers it (null fields = not asked). */
export interface Request {
  who: string;
  text: string;
  want: Pick;
  /** Content item ids that are paid for (price question). */
  items: string[];
}

const rnd = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]!;
const CUSTOMERS = ['👩', '🧑', '👨', '👧', '👦', '👵', '👴', '🧔', '👩‍🦱', '👱'];

/** `n` requests, getting a little harder (second item, size) as the round goes on. Sold-out items never come up. */
export function makeRequests(n: number, gone: string[]): Request[] {
  const ok = (id: string) => !gone.includes(id);
  const out: Request[] = [];
  for (let i = 0; i < n; i++) {
    const outfits = OUTFITS.filter((o) => ok(o.id));
    if (!outfits.length) break;
    const o = rnd(outfits);
    const col = rnd(GAME_COLOURS);
    const want: Pick = { ...EMPTY_PICK, outfit: o.id, colour: col.hex };
    const items = [o.id];
    const garment = o.id === 'overalls' ? `a pair of ${col.en} overalls` : `${article(col.en)} ${col.en} ${o.id === 't-shirt' ? 'T-shirt' : o.id}`;
    const parts = [garment];
    if (i >= 2 || Math.random() < 0.3) {
      const lower = LOWER[o.body];
      const extras: (() => void)[] = [];
      if (lower && ok(lower))
        extras.push(() => {
          const c = rnd(GAME_COLOURS.filter((x) => x.hex !== col.hex));
          want.lower = c.hex;
          items.push(lower);
          parts.push(`${c.en} ${lower}`);
        });
      for (const h of HATS.filter((x) => ok(x.id)))
        extras.push(() => {
          const c = rnd(GAME_COLOURS);
          want.hat = h.id;
          want.hatColour = h.id === 'cap' || h.id === 'beanie' ? c.hex : null;
          items.push(h.id);
          const name = h.id.replace('-', ' ');
          parts.push(want.hatColour ? `${article(c.en)} ${c.en} ${name}` : `${article(name)} ${name}`);
        });
      for (const g of GLASSES.filter((x) => ok(x.id)))
        extras.push(() => {
          want.glasses = g.id;
          items.push(g.id);
          parts.push(`some ${g.id}`);
        });
      if (ok('backpack'))
        extras.push(() => {
          want.bag = true;
          items.push('backpack');
          parts.push('a backpack');
        });
      for (const s of ['shoes', 'trainers'].filter(ok))
        extras.push(() => {
          const c = rnd(GAME_COLOURS);
          want.shoes = c.hex;
          items.push(s);
          parts.push(`${c.en} ${s}`);
        });
      if (extras.length) rnd(extras)();
    }
    if (i % 2 === 1) want.size = rnd(SIZES);
    const list = parts.join(' and ');
    const size = want.size ? (Math.random() < 0.5 ? `, size ${want.size}` : ` in ${SIZE_WORD[want.size]}`) : '';
    const text = rnd([`Hi! I'd like ${list}${size}, please.`, `Excuse me, can I have ${list}${size}?`, `Hello! I'm looking for ${list}${size}.`, `Do you have ${list}${size}?`]);
    out.push({ who: rnd(CUSTOMERS), text, want, items });
  }
  return out;
}

/** Parts of the pick that do not match the request (content item ids, or 'size'). */
export function mistakes(want: Pick, got: Pick): string[] {
  const bad: string[] = [];
  if (got.outfit !== want.outfit || got.colour !== want.colour) bad.push(want.outfit ?? 'outfit');
  const lower = want.outfit ? LOWER[OUTFITS.find((o) => o.id === want.outfit)!.body] : undefined;
  if (want.lower && got.lower !== want.lower) bad.push(lower ?? 'lower');
  if (want.shoes && got.shoes !== want.shoes) bad.push('shoes');
  if (got.hat !== want.hat || (want.hatColour && got.hatColour !== want.hatColour)) bad.push(want.hat ?? got.hat ?? 'hat');
  if (got.glasses !== want.glasses) bad.push(want.glasses ?? got.glasses ?? 'glasses');
  if (got.bag !== want.bag) bad.push('backpack');
  if (want.size && got.size !== want.size) bad.push('size');
  return bad;
}

/** The player's look with the pick put on (pick fields left empty keep the player's own clothes). */
export function wearPick(base: AvatarLook, p: Pick): AvatarLook {
  const look: AvatarLook = { ...base, hat: 'none', glasses: 'none', bag: 'none' };
  const o = OUTFITS.find((x) => x.id === p.outfit);
  if (o) {
    look.body = o.body;
    if (p.colour) look[o.slot] = p.colour;
    if (o.slot === 'bottom') look.top = '#f2f2f2';
  }
  if (p.lower) look.bottom = p.lower;
  if (p.shoes) look.shoes = p.shoes;
  const h = HATS.find((x) => x.id === p.hat);
  if (h) {
    look.hat = h.hat;
    if (p.hatColour) look.hatColor = p.hatColour;
  }
  const g = GLASSES.find((x) => x.id === p.glasses);
  if (g) look.glasses = g.glasses;
  if (p.bag) look.bag = 'backpack';
  return look;
}

/** "I'm wearing a blue hoodie, grey trousers, white shoes and a red cap." */
export function describeLook(l: AvatarLook): string {
  const c = (hex: string) => colourName(hex);
  const a = (hex: string) => `${article(c(hex))} ${c(hex)}`;
  if (l.body === 'robot') return `I'm ${a(l.top)} robot!`;
  const parts: string[] = [];
  switch (l.body) {
    case 'hoodie':
      parts.push(`${a(l.top)} hoodie`, `${c(l.bottom)} trousers`);
      break;
    case 'suit':
      parts.push(`${a(l.top)} suit`, `${a(l.bottom)} tie`);
      break;
    case 'dress':
      parts.push(`${a(l.top)} dress`, `${a(l.bottom)} belt`);
      break;
    case 'girl':
      parts.push(`${a(l.top)} shirt`, `${c(l.bottom)} overalls`);
      break;
    default:
      parts.push(`${a(l.top)} T-shirt`, `${c(l.bottom)} shorts`);
  }
  parts.push(`${c(l.shoes)} shoes`);
  if (l.hat === 'crown') parts.push('a crown');
  else if (l.hat !== 'none') parts.push(`${a(l.hatColor)} ${{ cap: 'cap', beanie: 'beanie', sunhat: 'sun hat', tophat: 'top hat', beret: 'beret', cowboy: 'cowboy hat', party: 'party hat' }[l.hat]}`);
  if (l.glasses !== 'none') parts.push(l.glasses === 'sun' ? 'sunglasses' : 'glasses');
  if (l.bag !== 'none') parts.push('a backpack');
  return `I'm wearing ${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}.`;
}

/** Dollar price of a content item today (half price when on sale). */
export const priceOf = (price: number | undefined, onSale: boolean) => (price == null ? 0 : onSale ? price / 2 : price);
export const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
