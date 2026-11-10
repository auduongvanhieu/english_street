/**
 * Top-ups: coin packs paid by bank transfer in VND (VietQR, confirmed by SePay) or in USDT (TRC20 / BEP20,
 * confirmed by reading the chain). The API owns prices and credits coins; these are the shapes the game sees.
 */
export const PAY_METHODS = ['vnd', 'usdt_trc20', 'usdt_bep20'] as const;
export type PayMethod = (typeof PAY_METHODS)[number];
export type PayStatus = 'pending' | 'paid' | 'expired' | 'cancelled' | 'refunded';
/** amounts are kept in the smallest unit: đồng, or micro-USDT (1 USDT = 1 000 000) */
export const MICRO_USDT = 1_000_000;

export interface PayPack {
  id: string;
  coins: number;
  vnd: number;
  usdt: number;
}

export interface PayOrderView {
  code: string;
  pack: string;
  /** coins this order gives (first top-up bonus included) */
  coins: number;
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
  /** the next paid top-up gives double coins */
  firstBonus: boolean;
  orders: PayOrderView[];
}

/** 50000 → "50.000đ"; 2137000 micro-USDT → "2.137 USDT" */
export function payAmountText(method: PayMethod, amount: number): string {
  if (method === 'vnd') return `${amount.toLocaleString('vi-VN')}đ`;
  return `${(amount / MICRO_USDT).toFixed(6).replace(/0+$/, '').replace(/\.$/, '')} USDT`;
}
