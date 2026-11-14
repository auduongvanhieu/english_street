import { FURNITURE, avatarGemItems, type GemInfo } from '@es/shared';
import { prisma } from '../plugins/prisma';
import { setting } from '../settings';
import { changeBalanceTx } from '../npc/attempts';
import { payOpenFor } from '../payments/core';

/**
 * 💎 Gems: a second balance next to coins. Bought with top-ups (payments/), with small gifts for signed-up
 * players. Spent on gem items (character shop, my room), extra NPC turns, or changed into coins (one way).
 * Every change goes through changeBalanceTx (CoinLedger, currency 'gem').
 */

/** Default gem price of every gem item (character shop + my-room furniture). */
export function defaultGemPrices(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const it of avatarGemItems()) out[it.id] = it.gems;
  for (const f of FURNITURE) if (f.gems) out[f.id] = f.gems;
  return out;
}
/** Gem prices now (admin changes win). */
export function gemPrices(): Record<string, number> {
  const def = defaultGemPrices();
  const over = setting('gemPrices');
  for (const k of Object.keys(def)) if (over[k]) def[k] = over[k];
  return def;
}
export const gemPrice = (id: string): number | null => gemPrices()[id] ?? null;

export async function gemInfo(userId: string): Promise<GemInfo> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, gems: true, npcBonusTurns: true } });
  return {
    gems: u?.gems ?? 0,
    bonusTurns: u?.npcBonusTurns ?? 0,
    rate: setting('gemRate'),
    turnPack: setting('gemTurnPack'),
    prices: gemPrices(),
    gifts: { streak: setting('gemGiftStreak'), chapter: setting('gemGiftChapter') },
    payOpen: !!u && payOpenFor(u),
  };
}

export class GemError extends Error {
  constructor(readonly code: 'not_enough_gems' | 'bad_request') {
    super(code);
  }
}

/** Gems → coins (one way). */
export async function exchangeGems(userId: string, gems: number) {
  const n = Math.trunc(gems);
  if (n < 1 || n > 1_000_000) throw new GemError('bad_request');
  const rate = setting('gemRate');
  const ref = `x${Date.now().toString(36)}`;
  return prisma.$transaction(async (tx) => {
    const g = await changeBalanceTx(tx, userId, 'gem', -n, 'exchange', 'coins', ref);
    if (!g) throw new GemError('not_enough_gems');
    const c = await changeBalanceTx(tx, userId, 'coin', n * rate, 'exchange', 'gems', ref);
    return { gems: g.balance, coins: c!.balance, got: n * rate };
  });
}

/** Buy one pack of extra NPC turns. */
export async function buyNpcTurns(userId: string) {
  const pack = setting('gemTurnPack');
  return prisma.$transaction(async (tx) => {
    const g = await changeBalanceTx(tx, userId, 'gem', -pack.gems, 'spend', 'npc_turns', String(pack.turns));
    if (!g) throw new GemError('not_enough_gems');
    const u = await tx.user.update({ where: { id: userId }, data: { npcBonusTurns: { increment: pack.turns } }, select: { npcBonusTurns: true } });
    return { gems: g.balance, bonusTurns: u.npcBonusTurns, turns: pack.turns };
  });
}

/** Pay for a gem item. Returns the new gem balance, or null when there are not enough gems. */
export async function spendGems(userId: string, amount: number, source: string, ref = '') {
  const r = await prisma.$transaction((tx) => changeBalanceTx(tx, userId, 'gem', -Math.max(0, amount), 'spend', source, ref));
  return r ? r.balance : null;
}

/** A small gift (signed-up players only: guest ids are free to make). Returns the gems given (0 = none). */
export async function giftGems(userId: string, gems: number, source: string, ref = ''): Promise<number> {
  if (gems <= 0) return 0;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!u?.email) return 0;
  await prisma.$transaction((tx) => changeBalanceTx(tx, userId, 'gem', gems, 'reward', source, ref));
  await prisma.event.create({ data: { name: 'gems_gift', playerId: userId, props: { source, gems, ref } } }).catch(() => undefined);
  return gems;
}

/** One bought NPC turn (atomic: never below 0). */
export async function takeBonusTurn(userId: string): Promise<boolean> {
  const r = await prisma.user.updateMany({ where: { id: userId, npcBonusTurns: { gt: 0 } }, data: { npcBonusTurns: { decrement: 1 } } });
  return r.count > 0;
}
export async function giveBackBonusTurn(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { npcBonusTurns: { increment: 1 } } }).catch(() => undefined);
}
export async function bonusTurnsOf(userId: string) {
  return (await prisma.user.findUnique({ where: { id: userId }, select: { npcBonusTurns: true } }))?.npcBonusTurns ?? 0;
}

/** The 7-day streak gift given today, if any (the game shows it once). */
export async function todayStreakGift(userId: string) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const r = await prisma.coinLedger.findFirst({ where: { userId, currency: 'gem', source: 'streak', createdAt: { gte: start } }, select: { delta: true, ref: true } });
  return r ? { gems: r.delta, ref: r.ref } : null;
}
