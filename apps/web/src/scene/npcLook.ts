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
