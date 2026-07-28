-- CreateTable
CREATE TABLE "ProductStrip" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "placement" TEXT NOT NULL DEFAULT 'destacado',
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductStrip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductStripItem" (
    "id" TEXT NOT NULL,
    "stripId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductStripItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductStrip_active_position_idx" ON "ProductStrip"("active", "position");

-- CreateIndex
CREATE INDEX "ProductStripItem_stripId_position_idx" ON "ProductStripItem"("stripId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ProductStripItem_stripId_productId_key" ON "ProductStripItem"("stripId", "productId");

-- AddForeignKey
ALTER TABLE "ProductStripItem" ADD CONSTRAINT "ProductStripItem_stripId_fkey" FOREIGN KEY ("stripId") REFERENCES "ProductStrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductStripItem" ADD CONSTRAINT "ProductStripItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
