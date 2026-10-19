-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "backupOfId" TEXT;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_backupOfId_fkey" FOREIGN KEY ("backupOfId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
