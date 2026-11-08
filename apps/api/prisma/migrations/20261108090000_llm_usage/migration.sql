-- CreateTable
CREATE TABLE "LlmUsage" (
    "day" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "input" INTEGER NOT NULL DEFAULT 0,
    "output" INTEGER NOT NULL DEFAULT 0,
    "cacheRead" INTEGER NOT NULL DEFAULT 0,
    "cacheWrite" INTEGER NOT NULL DEFAULT 0,
    "usd" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "LlmUsage_pkey" PRIMARY KEY ("day","purpose","detail","model")
);

-- CreateIndex
CREATE INDEX "LlmUsage_day_idx" ON "LlmUsage"("day");
