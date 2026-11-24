ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "comments" JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "StoreProduct" ADD COLUMN IF NOT EXISTS "priceINR" DOUBLE PRECISION;
ALTER TABLE "GymSettings" ADD COLUMN IF NOT EXISTS "inactivityReminderDays" INTEGER NOT NULL DEFAULT 7;
UPDATE "Lead" SET "status" = 'Opened' WHERE "status" = 'New';
UPDATE "Lead" SET "status" = 'Closed' WHERE "status" = 'Lost';
