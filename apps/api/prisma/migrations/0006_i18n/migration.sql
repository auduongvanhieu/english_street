-- Learner language (multi-language translations). Existing users keep Vietnamese meanings.
ALTER TABLE "User" ADD COLUMN "nativeLang" TEXT NOT NULL DEFAULT '';
-- Themed areas: farm plots, quiz reward counters.
ALTER TABLE "User" ADD COLUMN "gameState" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "VocabEntry" RENAME COLUMN "meaningVi" TO "meaning";
ALTER TABLE "VocabEntry" ADD COLUMN "lang" TEXT NOT NULL DEFAULT 'vi';
