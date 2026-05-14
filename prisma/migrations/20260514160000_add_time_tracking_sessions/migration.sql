-- CreateTable
CREATE TABLE "time_tracking_sessions" (
    "id"              TEXT NOT NULL,
    "taskId"          TEXT NOT NULL,
    "profileId"       TEXT NOT NULL,
    "startedAt"       TIMESTAMP(3) NOT NULL,
    "stoppedAt"       TIMESTAMP(3),
    "durationSeconds" INTEGER,

    CONSTRAINT "time_tracking_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "time_tracking_sessions_profileId_idx" ON "time_tracking_sessions"("profileId");

-- CreateIndex
CREATE INDEX "time_tracking_sessions_taskId_idx" ON "time_tracking_sessions"("taskId");

-- CreateIndex
CREATE INDEX "time_tracking_sessions_profileId_startedAt_idx" ON "time_tracking_sessions"("profileId", "startedAt");

-- CreateIndex
CREATE INDEX "time_tracking_sessions_profileId_stoppedAt_idx" ON "time_tracking_sessions"("profileId", "stoppedAt");

-- AddForeignKey
ALTER TABLE "time_tracking_sessions" ADD CONSTRAINT "time_tracking_sessions_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_tracking_sessions" ADD CONSTRAINT "time_tracking_sessions_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
