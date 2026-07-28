-- AlterTable
ALTER TABLE "ProductBlock" ADD COLUMN     "imageSize" TEXT NOT NULL DEFAULT 'md',
ADD COLUMN     "imageSide" TEXT NOT NULL DEFAULT 'auto';
