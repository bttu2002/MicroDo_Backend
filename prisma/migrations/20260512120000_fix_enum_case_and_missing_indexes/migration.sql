-- Migration: fix_enum_case_and_missing_indexes
--
-- Context:
--   commit ffb21ce normalized TaskStatus/TaskPriority to lowercase in schema.prisma
--   but applied the change via prisma db push instead of prisma migrate dev.
--   commit 9fd5da2 added composite indexes the same way.
--   The initial migration.sql (20260509183900) was never updated, leaving it with
--   UPPERCASE enum values and missing 4 indexes.
--
--   This migration makes both changes reproducible via prisma migrate deploy
--   on a fresh database while being a safe no-op on the existing live database.
--
-- Idempotency:
--   Each enum rename uses a per-value pg_enum existence check.
--   Each index uses CREATE INDEX IF NOT EXISTS.
--   Safe to run against both fresh (UPPERCASE) and existing (already lowercase) databases.

-- TaskStatus: rename each value individually

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'TaskStatus' AND e.enumlabel = 'TODO'
  ) THEN
    ALTER TYPE "TaskStatus" RENAME VALUE 'TODO' TO 'todo';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'TaskStatus' AND e.enumlabel = 'DOING'
  ) THEN
    ALTER TYPE "TaskStatus" RENAME VALUE 'DOING' TO 'doing';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'TaskStatus' AND e.enumlabel = 'DONE'
  ) THEN
    ALTER TYPE "TaskStatus" RENAME VALUE 'DONE' TO 'done';
  END IF;
END $$;

-- TaskPriority: rename each value individually

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'TaskPriority' AND e.enumlabel = 'LOW'
  ) THEN
    ALTER TYPE "TaskPriority" RENAME VALUE 'LOW' TO 'low';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'TaskPriority' AND e.enumlabel = 'MEDIUM'
  ) THEN
    ALTER TYPE "TaskPriority" RENAME VALUE 'MEDIUM' TO 'medium';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'TaskPriority' AND e.enumlabel = 'HIGH'
  ) THEN
    ALTER TYPE "TaskPriority" RENAME VALUE 'HIGH' TO 'high';
  END IF;
END $$;

-- Missing indexes from initial migration (were applied via prisma db push in commit 9fd5da2)

CREATE INDEX IF NOT EXISTS "tasks_title_idx"                ON "tasks"("title");
CREATE INDEX IF NOT EXISTS "tasks_createdAt_idx"            ON "tasks"("createdAt");
CREATE INDEX IF NOT EXISTS "tasks_profileId_status_idx"     ON "tasks"("profileId", "status");
CREATE INDEX IF NOT EXISTS "tasks_departmentId_status_idx"  ON "tasks"("departmentId", "status");
