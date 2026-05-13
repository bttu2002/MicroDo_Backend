-- CreateIndex
CREATE INDEX "comments_taskId_parentId_idx" ON "comments"("taskId", "parentId");

-- CreateIndex
CREATE INDEX "profiles_passwordResetToken_idx" ON "profiles"("passwordResetToken");
