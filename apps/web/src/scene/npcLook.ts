import type { ChibiSpec } from './chibi/buildChibi';

/**
 * How each NPC looks: which Quaternius character model to load, material recolours that turn the stock
 * outfit into a work uniform, and procedural accessories attached to bones (hats, badge, stethoscope…).
 * Material names come from the GLBs (see scripts/build-models.mjs → `mats`), e.g. "Suit", "White", "Tie".
 */
export type Hat = 'cap' | 'brim' | 'paperhat' | 'beanie' | 'tophat' | 'crown';
export type Accessory = 'stethoscope' | 'bowtie' | 'badge' | 'apron' | 'glasses' | 'sunglasses' | 'backpack';

export interface NpcLook {
  model: 'business' | 'casual' | 'hoodie' | 'worker' | 'farmer' | 'woman-casual' | 'woman-formal';
  /** material name → colour */
  colors: Record<string, string>;
  hat?: Hat;
  hatColor?: string;
  accessories?: Accessory[];
}

export const NPC_LOOK: Record<string, NpcLook> = {
  // Maya, barista: casual woman in a cream top, brown apron, barista cap.
  barista: { model: 'woman-casual', colors: { White: '#f3e9d6', Orange: '#3d2b1f', Grey: '#2b2b2b' }, hat: 'cap', hatColor: '#5b3a21', accessories: ['apron'] },
  // Tom, QuickMart cashier: green store vest over a white tee, name badge.
  cashier: { model: 'casual', colors: { LightBrown: '#2f8f5b', LightBlue: '#2f3a44', Red_Dark: '#1f1f1f' }, accessories: ['badge'] },
  // Priya, tourist guide: yellow uniform dress, wide-brim sun hat.
  guide: { model: 'woman-formal', colors: { LimeGreen: '#e9c047', Gold: '#8a6a1f', Red: '#7a3b1e' }, hat: 'brim', hatColor: '#efe2c0' },
  // Nadia, post office clerk: blue uniform, navy trousers, postal cap.
  postal: { model: 'woman-casual', colors: { White: '#2f63b8', Orange: '#1d2a44', Grey: '#1b1b1b', Hair_Blond: '#2d2118' }, hat: 'cap', hatColor: '#1d3f8a' },
  // Dr. Chen: white coat (recoloured hoodie), dark trousers, stethoscope.
  doctor: { model: 'hoodie', colors: { Purple: '#f7f7f7', LightBlue: '#3a4654', White: '#2a2a2a' }, accessories: ['stethoscope'] },
  // Marcus, bank teller: grey suit, red tie.
  teller: { model: 'business', colors: { Suit: '#55606e', Tie: '#9b2335', White: '#f2f2f2' } },
  // Sophie, recruiter: navy business dress with gold accents.
  recruiter: { model: 'woman-formal', colors: { LimeGreen: '#1f3a63', Gold: '#d2a93a', Red: '#3a2a22' } },
  // Lucas, waiter: black vest and trousers, white shirt, red bow tie, long apron.
  maitre: { model: 'business', colors: { Suit: '#161616', Tie: '#161616', White: '#fafafa', Black: '#0e0e0e' }, accessories: ['bowtie', 'apron'] },
};

export const HUMAN_MODEL_URL = (model: NpcLook['model']) => `/models/characters/${model}.glb`;

// ------------------------------------------------------------------------------------------------ chibi NPCs

const base: ChibiSpec = { body: 'tee', skin: '#e0ac80', hair: '#3a2618', hairStyle: 'short', top: '#4a90e2', bottom: '#24365c', shoes: '#2f3437', hat: 'none', hatColor: '#c8443a', glasses: 'none', bag: 'none' };
const npc = (s: Partial<ChibiSpec>): ChibiSpec => ({ ...base, ...s });

/** Shopkeepers as chibi characters in their work uniforms (same builder as the players). */
export const NPC_CHIBI: Record<string, ChibiSpec> = {
  barista: npc({ body: 'tee', skin: '#eec1a0', hair: '#6b4226', hairStyle: 'ponytail', top: '#f3e9d6', bottom: '#3d2b1f', hat: 'cap', hatColor: '#5b3a21', extras: ['apron'], apronColor: '#5b3a21' }),
  cashier: npc({ body: 'tee', skin: '#c98e62', hair: '#1c1410', hairStyle: 'spiky', top: '#2f8f5b', bottom: '#2f3a44', extras: ['badge'] }),
  guide: npc({ body: 'dress', skin: '#a86e45', hair: '#1c1410', hairStyle: 'long', top: '#e9c047', bottom: '#8a6a1f', shoes: '#7a3b1e', hat: 'sunhat', hatColor: '#efe2c0' }),
  postal: npc({ body: 'tee', skin: '#e0ac80', hair: '#2d2118', hairStyle: 'bob', top: '#2f63b8', bottom: '#1d2a44', hat: 'cap', hatColor: '#1d3f8a', extras: ['badge'] }),
  doctor: npc({ body: 'suit', skin: '#eec1a0', hair: '#1c1410', hairStyle: 'short', top: '#f7f7f7', bottom: '#3a6ea5', glasses: 'round', extras: ['stethoscope'] }),
  teller: npc({ body: 'suit', skin: '#8a5634', hair: '#1c1410', hairStyle: 'curly', top: '#55606e', bottom: '#9b2335' }),
  recruiter: npc({ body: 'dress', skin: '#f6d7c3', hair: '#d9b25c', hairStyle: 'bob', top: '#1f3a63', bottom: '#d2a93a', shoes: '#3a2a22', glasses: 'round' }),
  maitre: npc({ body: 'suit', skin: '#e0ac80', hair: '#6b4226', hairStyle: 'short', top: '#161616', bottom: '#161616', extras: ['bowtie', 'apron'], apronColor: '#1e1e1e' }),
  // Themed areas
  zookeeper: npc({ body: 'tee', skin: '#c98e62', hair: '#3a2618', hairStyle: 'curly', top: '#6b8f3a', bottom: '#8a6a44', shoes: '#4a3424', hat: 'sunhat', hatColor: '#d9c27a', extras: ['badge'] }),
  farmer: npc({ body: 'girl', skin: '#eec1a0', hair: '#a0682f', hairStyle: 'short', top: '#e5533d', bottom: '#3a6ea5', shoes: '#5a3d2a', hat: 'cap', hatColor: '#f2c94c' }),
  waiter: npc({ body: 'suit', skin: '#8a5634', hair: '#1c1410', hairStyle: 'short', top: '#fafafa', bottom: '#161616', extras: ['bowtie', 'apron'], apronColor: '#b5452f' }),
  chef: npc({ body: 'tee', skin: '#f6d7c3', hair: '#2d2118', hairStyle: 'buns', top: '#fafafa', bottom: '#2b2b2b', hat: 'paperhat', hatColor: '#ffffff', extras: ['apron'], apronColor: '#ffffff' }),
  grocer: npc({ body: 'tee', skin: '#e0ac80', hair: '#1c1410', hairStyle: 'ponytail', top: '#2a9d8f', bottom: '#2f3a44', extras: ['badge', 'apron'], apronColor: '#2a9d8f' }),
};
/** Any NPC without a hand-made look. */
export const NPC_CHIBI_DEFAULT = npc({ body: 'hoodie', top: '#8e5bd8', hairStyle: 'short' });
