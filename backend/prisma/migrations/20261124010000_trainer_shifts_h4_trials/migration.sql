ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "shiftsPerDay" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "TrainerAttendance" ADD COLUMN IF NOT EXISTS "shiftNumber" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "TrainerAttendance" ADD COLUMN IF NOT EXISTS "shiftCountExpected" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "TrainerAttendance" ADD COLUMN IF NOT EXISTS "shiftType" TEXT NOT NULL DEFAULT 'full';
ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);
ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "trialCheckInsLimit" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "trialCheckInsUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "trialWorkoutAccess" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "trialCouponCode" TEXT;

CREATE TABLE IF NOT EXISTS "H4TrialCoupon" (
  "id" TEXT NOT NULL,
  "gymId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "trialDays" INTEGER NOT NULL,
  "checkInLimit" INTEGER NOT NULL,
  "workoutAccess" BOOLEAN NOT NULL DEFAULT false,
  "maxRedemptions" INTEGER,
  "redemptionCount" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "H4TrialCoupon_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "H4TrialCoupon_code_key" ON "H4TrialCoupon"("code");
CREATE INDEX IF NOT EXISTS "H4TrialCoupon_gymId_isActive_startsAt_endsAt_idx" ON "H4TrialCoupon"("gymId", "isActive", "startsAt", "endsAt");

CREATE TABLE IF NOT EXISTS "H4TrialRedemption" (
  "id" TEXT NOT NULL,
  "couponId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "gymId" TEXT NOT NULL,
  "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "checkInLimit" INTEGER NOT NULL,
  "workoutAccess" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "H4TrialRedemption_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "H4TrialRedemption_couponId_memberId_key" ON "H4TrialRedemption"("couponId", "memberId");
CREATE INDEX IF NOT EXISTS "H4TrialRedemption_memberId_expiresAt_idx" ON "H4TrialRedemption"("memberId", "expiresAt");
