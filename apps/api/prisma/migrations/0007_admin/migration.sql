-- Admin site: roles, moderation, audit log, editable content, live settings, beta codes, announcements, heat map, daily stats.
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('player', 'editor', 'admin');

-- AlterTable
ALTER TABLE "Feedback" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'new';

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "handledAt" TIMESTAMP(3),
ADD COLUMN     "handledBy" TEXT,
ADD COLUMN     "note" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'new';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "banReason" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "bannedUntil" TIMESTAMP(3),
ADD COLUMN     "mutedUntil" TIMESTAMP(3),
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'player',
ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "AdminAudit" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL DEFAULT '',
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentDoc" (
    "kind" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentDoc_pkey" PRIMARY KEY ("kind","id")
);

-- CreateTable
CREATE TABLE "ContentRevision" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "data" JSONB,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedBy" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "BetaCode" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "uses" INTEGER NOT NULL DEFAULT 0,
    "maxUses" INTEGER,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BetaCode_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeatCell" (
    "hour" TIMESTAMP(3) NOT NULL,
    "cx" INTEGER NOT NULL,
    "cz" INTEGER NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "HeatCell_pkey" PRIMARY KEY ("hour","cx","cz")
);

-- CreateTable
CREATE TABLE "DailyStat" (
    "day" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT '',
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "DailyStat_pkey" PRIMARY KEY ("day","metric","key")
);

-- CreateIndex
CREATE INDEX "AdminAudit_createdAt_idx" ON "AdminAudit"("createdAt");

-- CreateIndex
CREATE INDEX "AdminAudit_actorId_createdAt_idx" ON "AdminAudit"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "ContentRevision_kind_docId_createdAt_idx" ON "ContentRevision"("kind", "docId", "createdAt");

-- CreateIndex
CREATE INDEX "Announcement_endsAt_idx" ON "Announcement"("endsAt");

-- CreateIndex
CREATE INDEX "HeatCell_hour_idx" ON "HeatCell"("hour");

-- CreateIndex
CREATE INDEX "DailyStat_metric_day_idx" ON "DailyStat"("metric", "day");

-- CreateIndex
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");

