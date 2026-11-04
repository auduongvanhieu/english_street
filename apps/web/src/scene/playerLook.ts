import type { AvatarBody, AvatarLook } from '@es/shared';
import type { Accessory, Hat, NpcLook } from './npcLook';

/**
 * Which material of each Quaternius model is which part of the body (found by colour-coding every
 * material and looking at the render). `bottom`/`shoes` are what the editor labels them as — on the suit
 * the "bottom" slot is the tie, on the dress it is the belt.
 */
interface BodyMap {
  model: NpcLook['model'];
  skin: string[];
  skinDark?: string[];
  hair: string[];
  hairDark?: string[];
  top: string[];
  bottom?: string[];
  shoes?: string[];
}
const BODIES: Record<Exclude<AvatarBody, 'robot'>, BodyMap> = {
  tee: { model: 'casual', skin: ['Skin'], skinDark: ['Skin_Darker'], hair: ['Hair'], hairDark: ['Eyebrows'], top: ['LightBrown'], bottom: ['LightBlue'], shoes: ['Red_Dark'] },
  hoodie: { model: 'hoodie', skin: ['Skin'], hair: ['Hair'], hairDark: ['Eyebrows'], top: ['Purple'], bottom: ['LightBlue'], shoes: ['White'] },
  suit: { model: 'business', skin: ['Skin'], hair: ['Hair'], hairDark: ['Eyebrows'], top: ['Suit'], bottom: ['Tie'], shoes: ['Black'] },
  girl: { model: 'woman-casual', skin: ['Skin'], hair: ['Hair_Blond'], hairDark: ['Hair_Brown'], top: ['White'], bottom: ['Orange'], shoes: ['Grey'] },
  // The dress model shares one material between hair and shoes, so its shoes follow the hair colour.
  dress: { model: 'woman-formal', skin: ['Skin'], hair: ['Red'], top: ['LimeGreen'], bottom: ['Gold'] },
};

/** Editor labels for the bottom / shoes slots of a body (null = the body has no such part). */
export function slotLabels(body: AvatarBody): { top: string; bottom: string | null; shoes: string | null } {
  if (body === 'robot') return { top: 'Body', bottom: null, shoes: null };
  const b = BODIES[body];
  return {
    top: body === 'suit' ? 'Jacket' : body === 'dress' ? 'Dress' : body === 'hoodie' ? 'Hoodie' : 'Top',
    bottom: !b.bottom ? null : body === 'suit' ? 'Tie' : body === 'dress' ? 'Belt' : body === 'hoodie' ? 'Shorts' : 'Trousers',
    shoes: !b.shoes ? null : 'Shoes',
  };
}

function darken(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.round(v * f).toString(16).padStart(2, '0');
  return `#${c((n >> 16) & 255)}${c((n >> 8) & 255)}${c(n & 255)}`;
}

const HAT: Record<AvatarLook['hat'], Hat | undefined> = { none: undefined, cap: 'cap', beanie: 'beanie', sunhat: 'brim', tophat: 'tophat', crown: 'crown' };

/** Turn a player's look into what <Human> draws (null for the robot body). Pure; memoise per look JSON. */
export function lookToHuman(l: AvatarLook): NpcLook | null {
  if (l.body === 'robot') return null;
  const b = BODIES[l.body];
  const colors: Record<string, string> = {};
  const put = (names: string[] | undefined, hex: string) => names?.forEach((n) => (colors[n] = hex));
  put(b.skin, l.skin);
  put(b.skinDark, darken(l.skin, 0.82));
  put(b.hair, l.hair);
  put(b.hairDark, darken(l.hair, 0.7));
  put(b.top, l.top);
  put(b.bottom, l.bottom);
  put(b.shoes, l.shoes);
  const accessories: Accessory[] = [];
  if (l.glasses === 'round') accessories.push('glasses');
  if (l.glasses === 'sun') accessories.push('sunglasses');
  if (l.bag === 'backpack') accessories.push('backpack');
  return { model: b.model, colors, hat: HAT[l.hat], hatColor: l.hatColor, accessories };
}
