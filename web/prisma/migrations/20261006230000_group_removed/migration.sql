-- AlterTable: groups removed from /admin are hidden but kept, so they can be restored
ALTER TABLE "Group" ADD COLUMN "removedAt" TIMESTAMP(3);
ALTER TABLE "Group" ADD COLUMN "removedBy" TEXT;
