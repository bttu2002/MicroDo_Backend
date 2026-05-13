/*
  Warnings:

  - You are about to drop the column `departmentId` on the `profiles` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "profiles" DROP CONSTRAINT "profiles_departmentId_fkey";

-- AlterTable
ALTER TABLE "profiles" DROP COLUMN "departmentId";
