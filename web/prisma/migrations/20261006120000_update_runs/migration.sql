-- CreateTable: "Update now" requests queued from /admin and run by the Mac poller
CREATE TABLE "UpdateRun" (
    "id" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "message" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "UpdateRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UpdateRun_status_requestedAt_idx" ON "UpdateRun"("status", "requestedAt");
