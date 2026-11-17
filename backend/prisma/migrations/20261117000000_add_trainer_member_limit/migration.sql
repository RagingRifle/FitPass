-- Trainers need a configurable member assignment cap. Older databases may not
-- have this field yet, and auth reads the full User row during login.
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "trainerMemberLimit" INTEGER NOT NULL DEFAULT 10;
