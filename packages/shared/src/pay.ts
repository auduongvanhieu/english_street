/**
 * Top-ups: 💎 gem packs paid by bank transfer in VND (VietQR, confirmed by SePay) or in USDT (TRC20 / BEP20,
 * confirmed by reading the chain). The API owns prices and credits gems; these are the shapes the game sees.
 */
export const PAY_METHODS = ['vnd', 'usdt_trc20', 'usdt_bep20'] as const;
export type PayMethod = (typeof PAY_METHODS)[number];
export type PayStatus = 'pending' | 'paid' | 'expired' | 'cancelled' | 'refunded';
/** amounts are kept in the smallest unit: đồng, or micro-USDT (1 USDT = 1 000 000) */
export const MICRO_USDT = 1_000_000;

export interface PayPack {
  id: string;
  gems: number;
  vnd: number;
  usdt: number;
}

export interface PayOrderView {
  code: string;
  pack: string;
  /** gems this order gives (first top-up bonus included) */
  gems: number;
  method: PayMethod;
  /** smallest unit (đồng / micro-USDT) */
  amount: number;
  status: PayStatus;
  createdAt: string;
  expiresAt: string;
  paidAt: string | null;
  /** how to pay (only while pending / expired) */
  pay?: { kind: 'vnd'; bank: string; account: string; name: string; content: string; qr: string } | { kind: 'usdt'; network: 'TRC20' | 'BEP20'; address: string; qr: string };
}

export interface PayInfo {
  enabled: boolean;
  /** signed-in account needed (guests are asked to sign up first) */
  needAccount: boolean;
  methods: PayMethod[];
  packs: PayPack[];
  /** the next paid top-up gives double gems */
  firstBonus: boolean;
  orders: PayOrderView[];
}

/** 50000 → "50.000đ"; 2137000 micro-USDT → "2.137 USDT" */
export function payAmountText(method: PayMethod, amount: number): string {
  if (method === 'vnd') return `${amount.toLocaleString('vi-VN')}đ`;
  return `${(amount / MICRO_USDT).toFixed(6).replace(/0+$/, '').replace(/\.$/, '')} USDT`;
}

/**
 * 💎 Gems: bought with top-ups (plus small gifts for a 7-day streak and journey chapters). Coins stay the reward
 * for learning; gems buy special items, extra NPC turns, or turn into coins (one way only).
 */
export interface GemInfo {
  gems: number;
  /** NPC turns bought (used after the free daily turns) */
  bonusTurns: number;
  /** coins for 1 gem */
  rate: number;
  /** extra NPC turns: how many for how many gems */
  turnPack: { turns: number; gems: number };
  /** gem price of each gem item (admin may change them) */
  prices: Record<string, number>;
  /** gifts: gems for every 7 days in a row, for each journey chapter (0 = off) */
  gifts: { streak: number; chapter: number };
  /** top-ups are open for this player */
  payOpen: boolean;
}
