-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "color" TEXT,
ADD COLUMN     "tentative" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'Evento';
