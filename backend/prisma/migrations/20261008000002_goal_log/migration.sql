-- AlterTable
ALTER TABLE "Goal" ADD COLUMN "filter" TEXT;

-- Constraints pendientes del renombre Sale->Income
ALTER TABLE "Income" RENAME CONSTRAINT "Sale_pkey" TO "Income_pkey";
ALTER TABLE "IncomeItem" RENAME CONSTRAINT "SaleItem_pkey" TO "IncomeItem_pkey";
ALTER TABLE "Income" RENAME CONSTRAINT "Sale_clientId_fkey" TO "Income_clientId_fkey";
ALTER TABLE "Income" RENAME CONSTRAINT "Sale_userId_fkey" TO "Income_userId_fkey";
ALTER TABLE "IncomeItem" RENAME CONSTRAINT "SaleItem_saleId_fkey" TO "IncomeItem_incomeId_fkey";
ALTER INDEX "Sale_userId_date_idx" RENAME TO "Income_userId_date_idx";

-- CreateTable GoalLog
CREATE TABLE "GoalLog" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoalLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GoalLog_goalId_date_idx" ON "GoalLog"("goalId", "date");
CREATE INDEX "GoalLog_userId_date_idx" ON "GoalLog"("userId", "date");

ALTER TABLE "GoalLog" ADD CONSTRAINT "GoalLog_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoalLog" ADD CONSTRAINT "GoalLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Pausadas vuelven a activas (estado retirado)
UPDATE "Goal" SET status='activa' WHERE status='pausada';
