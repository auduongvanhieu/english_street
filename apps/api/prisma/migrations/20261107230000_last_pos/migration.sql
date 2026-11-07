-- where the player was when they last left the street
ALTER TABLE "User" ADD COLUMN "lastPos" JSONB;
