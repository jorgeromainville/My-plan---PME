-- Rename Sale->Income
ALTER TABLE "Sale" RENAME TO "Income";
ALTER TABLE "SaleItem" RENAME TO "IncomeItem";
ALTER TABLE "IncomeItem" RENAME COLUMN "saleId" TO "incomeId";
ALTER TABLE "Income" RENAME COLUMN "product" TO "title";
ALTER TABLE "IncomeItem" RENAME COLUMN "product" TO "title";
