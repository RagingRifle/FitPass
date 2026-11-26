ALTER TABLE "StoreOrder"
  ADD COLUMN IF NOT EXISTS "amountINR" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "quantity" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;

CREATE INDEX IF NOT EXISTS "StoreOrder_division_productId_createdAt_idx"
  ON "StoreOrder"("division", "productId", "createdAt");
