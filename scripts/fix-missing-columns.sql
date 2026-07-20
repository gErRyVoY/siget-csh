-- Renombrar columna vacaciones -> acepta_tickets en tabla usuario
-- (Cambio aplicado originalmente el 18 de julio vía SQL directo)
ALTER TABLE "usuario" RENAME COLUMN "vacaciones" TO "acepta_tickets";

-- Asegurarse de que el valor por defecto sea true (igual que el schema actual)
ALTER TABLE "usuario" ALTER COLUMN "acepta_tickets" SET DEFAULT true;
