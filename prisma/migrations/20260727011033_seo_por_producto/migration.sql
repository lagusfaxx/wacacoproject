-- AlterTable
ALTER TABLE "Collection" ADD COLUMN     "noIndex" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "seoDescription" TEXT,
ADD COLUMN     "seoImage" TEXT,
ADD COLUMN     "seoTitle" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "noIndex" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "seoDescription" TEXT,
ADD COLUMN     "seoImage" TEXT,
ADD COLUMN     "seoTitle" TEXT;
