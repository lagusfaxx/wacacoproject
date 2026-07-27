-- AlterTable
ALTER TABLE "Banner" ADD COLUMN     "placement" TEXT NOT NULL DEFAULT 'hero';

-- CreateIndex
CREATE INDEX "Banner_placement_active_position_idx" ON "Banner"("placement", "active", "position");
