-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "completedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "tasks_profileId_completedAt_idx" ON "tasks"("profileId", "completedAt");

-- CreateIndex
CREATE INDEX "tasks_departmentId_completedAt_idx" ON "tasks"("departmentId", "completedAt");

-- CreateIndex
CREATE INDEX "tasks_completedAt_idx" ON "tasks"("completedAt");
