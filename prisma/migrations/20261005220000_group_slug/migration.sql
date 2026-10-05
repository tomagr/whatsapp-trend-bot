-- AlterTable: editable URL slug, backfilled from the stable key
ALTER TABLE "Group" ADD COLUMN "slug" TEXT;
UPDATE "Group" SET "slug" = "key";
ALTER TABLE "Group" ALTER COLUMN "slug" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Group_slug_key" ON "Group"("slug");

-- CreateTable
CREATE TABLE "GroupSlugAlias" (
    "slug" TEXT NOT NULL,
    "groupKey" TEXT NOT NULL,

    CONSTRAINT "GroupSlugAlias_pkey" PRIMARY KEY ("slug")
);

-- AddForeignKey
ALTER TABLE "GroupSlugAlias" ADD CONSTRAINT "GroupSlugAlias_groupKey_fkey" FOREIGN KEY ("groupKey") REFERENCES "Group"("key") ON DELETE CASCADE ON UPDATE CASCADE;
