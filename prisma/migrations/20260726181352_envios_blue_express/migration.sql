-- AlterTable
ALTER TABLE "Address" ADD COLUMN     "regionCode" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "shipCarrier" TEXT,
ADD COLUMN     "shipDistrictCode" TEXT,
ADD COLUMN     "shipPromiseDays" INTEGER,
ADD COLUMN     "shipRegionCode" TEXT,
ADD COLUMN     "shipServiceName" TEXT,
ADD COLUMN     "shipServiceType" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "heightCm" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN     "lengthCm" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "widthCm" INTEGER NOT NULL DEFAULT 12;
