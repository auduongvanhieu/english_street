-- CreateTable
CREATE TABLE "FriendMessage" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "FriendMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FriendMessage_fromId_toId_createdAt_idx" ON "FriendMessage"("fromId", "toId", "createdAt");

-- CreateIndex
CREATE INDEX "FriendMessage_toId_readAt_idx" ON "FriendMessage"("toId", "readAt");
