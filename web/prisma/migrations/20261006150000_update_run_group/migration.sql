-- AlterTable: a run can cover a single group (null = every group)
ALTER TABLE "UpdateRun" ADD COLUMN "groupKey" TEXT;
