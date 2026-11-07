-- AlterTable
ALTER TABLE "User" ADD COLUMN     "playSeconds" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PlayDay" (
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL DEFAULT 0,
    "sessions" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlayDay_pkey" PRIMARY KEY ("userId","day")
);

-- CreateIndex
CREATE INDEX "PlayDay_day_idx" ON "PlayDay"("day");

