-- CreateTable
CREATE TABLE "ProductBlock" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'story',
    "eyebrow" TEXT,
    "title" TEXT,
    "body" TEXT,
    "image" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "video" TEXT,
    "theme" TEXT NOT NULL DEFAULT 'dark',
    "ctaLabel" TEXT,
    "ctaHref" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductBlock_productId_position_idx" ON "ProductBlock"("productId", "position");

-- AddForeignKey
ALTER TABLE "ProductBlock" ADD CONSTRAINT "ProductBlock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
