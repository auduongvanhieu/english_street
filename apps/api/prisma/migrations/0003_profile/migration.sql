-- AlterTable
ALTER TABLE "User" ADD COLUMN     "placementDoneAt" TIMESTAMP(3),
ADD COLUMN     "reviewsDone" INTEGER NOT NULL DEFAULT 0;

