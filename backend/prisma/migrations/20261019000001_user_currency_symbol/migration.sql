-- Moneda personalizada: código ISO/personalizado + símbolo para mostrar importes.
ALTER TABLE "User" ADD COLUMN "currencySymbol" TEXT NOT NULL DEFAULT 'S/';
