CREATE TABLE IF NOT EXISTS "StoreProduct" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "priceCoins" INTEGER NOT NULL,
  "priceINR" DOUBLE PRECISION,
  "imageUrl" TEXT NOT NULL DEFAULT '',
  "division" TEXT NOT NULL DEFAULT 'fitpass',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "stock" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoreProduct_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StoreProduct_division_isActive_idx"
  ON "StoreProduct"("division", "isActive");

CREATE TABLE IF NOT EXISTS "StoreOrder" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  "division" TEXT NOT NULL,
  "coinsSpent" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RECEIVED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoreOrder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StoreOrder_memberId_createdAt_idx"
  ON "StoreOrder"("memberId", "createdAt");
CREATE INDEX IF NOT EXISTS "StoreOrder_division_status_createdAt_idx"
  ON "StoreOrder"("division", "status", "createdAt");

CREATE TABLE IF NOT EXISTS "CoinSettings" (
  "id" TEXT NOT NULL,
  "division" TEXT NOT NULL,
  "coinsPerSession" INTEGER NOT NULL DEFAULT 10,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CoinSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CoinSettings_division_key"
  ON "CoinSettings"("division");
