-- 💎 gems: a second balance bought with top-ups (coins stay the reward for learning)
ALTER TABLE "User" ADD COLUMN "gems" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "npcBonusTurns" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CoinLedger" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'coin';
-- orders now sell gems (no paid order exists yet; earlier test orders keep their number)
ALTER TABLE "PaymentOrder" RENAME COLUMN "coins" TO "gems";
