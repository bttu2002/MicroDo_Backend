-- CreateEnum
CREATE TYPE "DepartmentMemberRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('PENDING', 'ACTIVE', 'REMOVED');

-- CreateTable
CREATE TABLE "department_members" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "role" "DepartmentMemberRole" NOT NULL DEFAULT 'MEMBER',
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invitedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "department_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_invitations" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "DepartmentMemberRole" NOT NULL DEFAULT 'MEMBER',
    "token" TEXT NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "department_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "departmentId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "department_members_departmentId_idx" ON "department_members"("departmentId");

-- CreateIndex
CREATE INDEX "department_members_userId_idx" ON "department_members"("userId");

-- CreateIndex
CREATE INDEX "department_members_status_idx" ON "department_members"("status");

-- CreateIndex
CREATE UNIQUE INDEX "department_members_userId_departmentId_key" ON "department_members"("userId", "departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "department_invitations_token_key" ON "department_invitations"("token");

-- CreateIndex
CREATE INDEX "department_invitations_departmentId_email_idx" ON "department_invitations"("departmentId", "email");

-- CreateIndex
CREATE INDEX "department_invitations_token_idx" ON "department_invitations"("token");

-- CreateIndex
CREATE INDEX "department_invitations_email_idx" ON "department_invitations"("email");

-- CreateIndex
CREATE INDEX "activity_logs_actorUserId_idx" ON "activity_logs"("actorUserId");

-- CreateIndex
CREATE INDEX "activity_logs_departmentId_idx" ON "activity_logs"("departmentId");

-- CreateIndex
CREATE INDEX "activity_logs_entityType_entityId_idx" ON "activity_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "activity_logs_createdAt_idx" ON "activity_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "department_members" ADD CONSTRAINT "department_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_members" ADD CONSTRAINT "department_members_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_members" ADD CONSTRAINT "department_members_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_invitations" ADD CONSTRAINT "department_invitations_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_invitations" ADD CONSTRAINT "department_invitations_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
