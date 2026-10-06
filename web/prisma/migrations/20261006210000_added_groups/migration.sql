-- AlterTable: groups added from /admin keep their config in the database
ALTER TABLE "Group" ADD COLUMN "addedAt" TIMESTAMP(3);
ALTER TABLE "Group" ADD COLUMN "addedBy" TEXT;
ALTER TABLE "Group" ADD COLUMN "context" TEXT;
ALTER TABLE "Group" ADD COLUMN "description" TEXT;
ALTER TABLE "Group" ADD COLUMN "vendorTypes" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Group" ADD COLUMN "scrubChildNames" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Group" ADD COLUMN "color" TEXT;

-- AlterTable: a run can also just list the Mac's WhatsApp groups
ALTER TABLE "UpdateRun" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'update';

-- CreateTable
CREATE TABLE "WaChatList" (
    "id" TEXT NOT NULL DEFAULT 'latest',
    "chats" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaChatList_pkey" PRIMARY KEY ("id")
);
