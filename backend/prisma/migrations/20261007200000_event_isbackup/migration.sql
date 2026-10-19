-- DropForeignKey
ALTER TABLE "Event" DROP CONSTRAINT "Event_backupOfId_fkey";

-- AlterTable
ALTER TABLE "Event" DROP COLUMN "backupOfId",
DROP COLUMN "tentative",
ADD COLUMN "isBackup" BOOLEAN NOT NULL DEFAULT false;
