-- AlterTable
ALTER TABLE "Banner" ADD COLUMN     "imageMode" TEXT NOT NULL DEFAULT 'background',
ADD COLUMN     "overlay" TEXT NOT NULL DEFAULT 'medium';
