-- CreateTable: the WhatsApp group's picture, refreshed by the weekly job
CREATE TABLE "GroupPhoto" (
    "groupKey" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mime" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupPhoto_pkey" PRIMARY KEY ("groupKey")
);

-- AddForeignKey
ALTER TABLE "GroupPhoto" ADD CONSTRAINT "GroupPhoto_groupKey_fkey" FOREIGN KEY ("groupKey") REFERENCES "Group"("key") ON DELETE CASCADE ON UPDATE CASCADE;
