-- CreateTable
CREATE TABLE "ShippingRate" (
    "regionCode" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "etaDays" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingRate_pkey" PRIMARY KEY ("regionCode")
);
