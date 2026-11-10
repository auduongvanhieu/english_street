-- CreateTable
CREATE TABLE "CoinLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT '',
    "ref" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentOrder" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pack" TEXT NOT NULL,
    "coins" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAmount" INTEGER NOT NULL DEFAULT 0,
    "txRef" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "PaymentOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTx" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "txRef" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "orderCode" TEXT,
    "status" TEXT NOT NULL,
    "raw" JSONB NOT NULL DEFAULT '{}',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentTx_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoinLedger_userId_createdAt_idx" ON "CoinLedger"("userId", "createdAt");
CREATE INDEX "CoinLedger_reason_createdAt_idx" ON "CoinLedger"("reason", "createdAt");
CREATE UNIQUE INDEX "PaymentOrder_code_key" ON "PaymentOrder"("code");
CREATE UNIQUE INDEX "PaymentOrder_txRef_key" ON "PaymentOrder"("txRef");
CREATE INDEX "PaymentOrder_userId_createdAt_idx" ON "PaymentOrder"("userId", "createdAt");
CREATE INDEX "PaymentOrder_status_method_idx" ON "PaymentOrder"("status", "method");
CREATE UNIQUE INDEX "PaymentTx_source_txRef_key" ON "PaymentTx"("source", "txRef");
CREATE INDEX "PaymentTx_status_createdAt_idx" ON "PaymentTx"("status", "createdAt");
