-- AlterTable: WhatsApp group photo, stored with the group (a few KB)
ALTER TABLE "Group" ADD COLUMN "photo" BYTEA;
ALTER TABLE "Group" ADD COLUMN "photoType" TEXT;
ALTER TABLE "Group" ADD COLUMN "photoHash" TEXT;
