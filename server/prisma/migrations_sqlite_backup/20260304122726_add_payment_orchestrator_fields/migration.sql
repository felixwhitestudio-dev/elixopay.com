-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "paymentMethod" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "provider" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "providerChargeId" TEXT;

-- CreateTable
CREATE TABLE "MerchantGatewayConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MerchantGatewayConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MerchantGatewayConfig_userId_provider_key" ON "MerchantGatewayConfig"("userId", "provider");
