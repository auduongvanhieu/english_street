-- Player device (model, OS, network) from the last join.
ALTER TABLE "User" ADD COLUMN "device" JSONB NOT NULL DEFAULT '{}';
