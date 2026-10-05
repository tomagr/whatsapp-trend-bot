-- CreateTable
CREATE TABLE "Group" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "vendorMode" TEXT NOT NULL,
    "checkedAt" TEXT,
    "messagesThrough" TEXT,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "groupKey" TEXT NOT NULL,
    "slug" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT '',
    "service" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "contact" TEXT NOT NULL DEFAULT '',
    "recommendedBy" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "quote" TEXT NOT NULL DEFAULT '',
    "mentions" INTEGER NOT NULL DEFAULT 1,
    "sentiment" TEXT,
    "type" TEXT,
    "dates" TEXT[],
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "groupKey" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "offer" TEXT NOT NULL DEFAULT '',
    "alternatives" TEXT NOT NULL DEFAULT '',
    "gap" TEXT NOT NULL DEFAULT 'open',
    "signals" INTEGER NOT NULL DEFAULT 0,
    "people" INTEGER NOT NULL DEFAULT 0,
    "firstDate" TEXT NOT NULL DEFAULT '',
    "lastDate" TEXT NOT NULL DEFAULT '',
    "quotes" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("groupKey","key")
);

-- CreateIndex
CREATE INDEX "Vendor_groupKey_deletedAt_idx" ON "Vendor"("groupKey", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_groupKey_slug_key" ON "Vendor"("groupKey", "slug");

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_groupKey_fkey" FOREIGN KEY ("groupKey") REFERENCES "Group"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_groupKey_fkey" FOREIGN KEY ("groupKey") REFERENCES "Group"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
