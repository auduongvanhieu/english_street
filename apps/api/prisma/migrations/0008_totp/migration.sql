-- Admin site: optional two-step sign-in (authenticator app).
ALTER TABLE "User" ADD COLUMN "totpSecret" TEXT;
