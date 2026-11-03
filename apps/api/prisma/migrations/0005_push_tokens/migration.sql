-- CreateTable
CREATE TABLE "PushToken" (
    "token" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushToken_pkey" PRIMARY KEY ("token")
);

-- CreateIndex
CREATE INDEX "PushToken_playerId_idx" ON "PushToken"("playerId");
