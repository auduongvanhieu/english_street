import { z } from 'zod';

/**
 * Player character look ("Tạo nhân vật"). Everything is picked from fixed lists so a player who is not
 * into graphics can still make a nice character: a body (one of the Quaternius models, or the robot),
 * palette colours for skin / hair / clothes, and a few accessories. Some items cost coins.
 */
export const AVATAR_BODIES = ['tee', 'hoodie', 'suit', 'girl', 'dress', 'robot'] as const;
export type AvatarBody = (typeof AVATAR_BODIES)[number];
/** Outfit styles of the chibi characters (ids kept from the first character version). */
export const BODY_LABELS: Record<AvatarBody, string> = { tee: 'T-shirt', hoodie: 'Hoodie', suit: 'Suit', girl: 'Overalls', dress: 'Dress', robot: 'Robot' };

export const AVATAR_HAIRSTYLES = ['short', 'spiky', 'curly', 'bob', 'long', 'ponytail', 'buns', 'bald'] as const;
export type AvatarHairStyle = (typeof AVATAR_HAIRSTYLES)[number];
export const HAIRSTYLE_LABELS: Record<AvatarHairStyle, string> = { short: 'Short', spiky: 'Spiky', curly: 'Curly', bob: 'Bob', long: 'Long', ponytail: 'Ponytail', buns: 'Buns', bald: 'Bald' };

export const AVATAR_HATS = ['none', 'cap', 'beanie', 'sunhat', 'tophat', 'crown'] as const;
export const AVATAR_GLASSES = ['none', 'round', 'sun'] as const;
export const AVATAR_BAGS = ['none', 'backpack'] as const;
export type AvatarHat = (typeof AVATAR_HATS)[number];
export type AvatarGlasses = (typeof AVATAR_GLASSES)[number];
export type AvatarBag = (typeof AVATAR_BAGS)[number];

export interface PaletteColor {
  id: string;
  hex: string;
  /** coins; 0 = free */
  price: number;
}
export const SKIN_TONES: PaletteColor[] = ['#f6d7c3', '#eec1a0', '#e0ac80', '#c98e62', '#a86e45', '#8a5634', '#6b3f25', '#4a2a19'].map((hex, i) => ({ id: `skin${i + 1}`, hex, price: 0 }));
export const HAIR_COLORS: PaletteColor[] = ['#1c1410', '#3a2618', '#6b4226', '#a0682f', '#d9b25c', '#e8d9a8', '#b8b8b8', '#c2402e', '#e86fa8', '#3f7fd6'].map((hex, i) => ({ id: `hair${i + 1}`, hex, price: i >= 8 ? 20 : 0 }));
/** Clothes and hat colours. The last three were the paid robot colours before characters existed; their ids are kept so purchases carry over. */
export const CLOTH_COLORS: PaletteColor[] = [
  { id: 'blue', hex: '#4a90e2', price: 0 },
  { id: 'green', hex: '#43b86a', price: 0 },
  { id: 'orange', hex: '#f08a3c', price: 0 },
  { id: 'purple', hex: '#8e5bd8', price: 0 },
  { id: 'white', hex: '#f2f2f2', price: 0 },
  { id: 'grey', hex: '#8a8f98', price: 0 },
  { id: 'charcoal', hex: '#2f3437', price: 0 },
  { id: 'navy', hex: '#24365c', price: 0 },
  { id: 'denim', hex: '#4a6488', price: 0 },
  { id: 'khaki', hex: '#c2a878', price: 0 },
  { id: 'brown', hex: '#6b4a32', price: 0 },
  { id: 'red', hex: '#c8443a', price: 0 },
  { id: 'pink', hex: '#ef8fb0', price: 0 },
  { id: 'yellow', hex: '#f3d14a', price: 0 },
  { id: 'teal', hex: '#2a9d8f', price: 0 },
  { id: 'gold', hex: '#f2c41d', price: 50 },
  { id: 'crimson', hex: '#d93a4a', price: 50 },
  { id: 'midnight', hex: '#1f2a44', price: 80 },
];

export interface ShopItem {
  id: string;
  label: string;
  price: number;
}
export const HAT_ITEMS: Record<AvatarHat, ShopItem> = {
  none: { id: 'hat:none', label: 'None', price: 0 },
  cap: { id: 'hat:cap', label: 'Cap', price: 0 },
  beanie: { id: 'hat:beanie', label: 'Beanie', price: 0 },
  sunhat: { id: 'hat:sunhat', label: 'Sun hat', price: 40 },
  tophat: { id: 'hat:tophat', label: 'Top hat', price: 80 },
  crown: { id: 'hat:crown', label: 'Crown', price: 150 },
};
export const GLASSES_ITEMS: Record<AvatarGlasses, ShopItem> = {
  none: { id: 'glasses:none', label: 'None', price: 0 },
  round: { id: 'glasses:round', label: 'Glasses', price: 0 },
  sun: { id: 'glasses:sun', label: 'Sunglasses', price: 40 },
};
/** A pet that walks beside you (premium, coins; everybody sees it). Kinds are the street critters. */
export const AVATAR_PETS = ['none', 'cat', 'shiba', 'husky', 'rabbit', 'duck', 'guineapig'] as const;
export type AvatarPet = (typeof AVATAR_PETS)[number];
export const PET_ITEMS: Record<AvatarPet, ShopItem> = {
  none: { id: 'pet:none', label: 'No pet', price: 0 },
  cat: { id: 'pet:cat', label: 'Cat', price: 120 },
  shiba: { id: 'pet:shiba', label: 'Shiba dog', price: 150 },
  husky: { id: 'pet:husky', label: 'Husky', price: 180 },
  rabbit: { id: 'pet:rabbit', label: 'Rabbit', price: 100 },
  duck: { id: 'pet:duck', label: 'Duck', price: 80 },
  guineapig: { id: 'pet:guineapig', label: 'Guinea pig', price: 90 },
};
/** Name tag styles (premium: bought with coins, everybody sees them over your head). */
export const NAME_TAGS = ['plain', 'gold', 'ocean', 'rainbow'] as const;
export type NameTagStyle = (typeof NAME_TAGS)[number];
export const TAG_ITEMS: Record<NameTagStyle, ShopItem> = {
  plain: { id: 'tag:plain', label: 'Plain', price: 0 },
  gold: { id: 'tag:gold', label: 'Gold', price: 150 },
  ocean: { id: 'tag:ocean', label: 'Ocean', price: 200 },
  rainbow: { id: 'tag:rainbow', label: 'Rainbow', price: 300 },
};
export const BAG_ITEMS: Record<AvatarBag, ShopItem> = {
  none: { id: 'bag:none', label: 'None', price: 0 },
  backpack: { id: 'bag:backpack', label: 'Backpack', price: 30 },
};

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const AvatarBase = z.object({
  body: z.enum(AVATAR_BODIES).catch('tee').default('tee'),
  skin: hex.catch('#e0ac80').default('#e0ac80'),
  hair: hex.catch('#3a2618').default('#3a2618'),
  hairStyle: z.enum(AVATAR_HAIRSTYLES).catch('short').default('short'),
  top: hex.catch('#4a90e2').default('#4a90e2'),
  bottom: hex.catch('#24365c').default('#24365c'),
  shoes: hex.catch('#f2f2f2').default('#f2f2f2'),
  hat: z.enum(AVATAR_HATS).catch('none').default('none'),
  hatColor: hex.catch('#c8443a').default('#c8443a'),
  glasses: z.enum(AVATAR_GLASSES).catch('none').default('none'),
  bag: z.enum(AVATAR_BAGS).catch('none').default('none'),
  tag: z.enum(NAME_TAGS).catch('plain').default('plain'),
  pet: z.enum(AVATAR_PETS).catch('none').default('none'),
  /** Bought item / colour ids. */
  owned: z.array(z.string()).catch([]).default([]),
});
/** Stored avatar. Old saves only had `{ color, owned }` (robot tint) — that colour becomes the top colour. */
export const AvatarSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  if (r.top === undefined && typeof r.color === 'string') return { ...r, top: r.color };
  return r;
}, AvatarBase);
export type Avatar = z.infer<typeof AvatarBase>;
/** What other players need to draw you (sent as JSON in the join options and MSG.AVATAR). */
export type AvatarLook = Omit<Avatar, 'owned'>;

export function avatarLook(a: Avatar): AvatarLook {
  const { owned: _owned, ...look } = a;
  return look;
}
/** Parse a look from untrusted JSON (room state); never throws. */
export function parseLook(json: string | null | undefined): AvatarLook {
  try {
    return avatarLook(AvatarSchema.parse(JSON.parse(json || '{}')));
  } catch {
    return avatarLook(AvatarSchema.parse({}));
  }
}

const find = (list: PaletteColor[], h: string) => list.find((c) => c.hex.toLowerCase() === h.toLowerCase());
/** Ownable id of a palette colour or item ('gold', 'hair9', 'hat:crown'…), or null for anything free. */
export function itemPrice(id: string): number | null {
  for (const list of [SKIN_TONES, HAIR_COLORS, CLOTH_COLORS]) {
    const c = list.find((x) => x.id === id);
    if (c) return c.price;
  }
  for (const rec of [HAT_ITEMS, GLASSES_ITEMS, BAG_ITEMS, TAG_ITEMS, PET_ITEMS] as Record<string, ShopItem>[]) {
    const it = Object.values(rec).find((x) => x.id === id);
    if (it) return it.price;
  }
  return null;
}

/** Paid items / colours in a look that are not owned yet (ids, no duplicates), or null if a colour is not in its palette. */
export function missingItems(look: AvatarLook, owned: string[]): string[] | null {
  const out = new Set<string>();
  const colors: [PaletteColor[], string][] = [
    [SKIN_TONES, look.skin],
    [HAIR_COLORS, look.hair],
    [CLOTH_COLORS, look.top],
    [CLOTH_COLORS, look.bottom],
    [CLOTH_COLORS, look.shoes],
    [CLOTH_COLORS, look.hatColor],
  ];
  for (const [list, h] of colors) {
    const c = find(list, h);
    if (!c) return null;
    if (c.price > 0 && !owned.includes(c.id)) out.add(c.id);
  }
  for (const it of [HAT_ITEMS[look.hat], GLASSES_ITEMS[look.glasses], BAG_ITEMS[look.bag], TAG_ITEMS[look.tag], PET_ITEMS[look.pet]]) if (it.price > 0 && !owned.includes(it.id)) out.add(it.id);
  return [...out];
}

/**
 * Check a look against the catalog. Returns null when it is valid and everything paid is owned, otherwise
 * `{ error, item? }` (unknown colour, or the first item that still has to be bought).
 */
export function checkLook(look: AvatarLook, owned: string[]): { error: 'bad_color' | 'not_owned'; item?: string } | null {
  const missing = missingItems(look, owned);
  if (!missing) return { error: 'bad_color' };
  return missing.length ? { error: 'not_owned', item: missing[0] } : null;
}
