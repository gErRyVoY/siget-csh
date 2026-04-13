import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Running manual migration to fix cycle dates in DB...");
  
  // Arreglar el Ciclo 2026-3 (que terminaba el 04-01T00:00:00 y dejaba hueco)
  await prisma.$executeRawUnsafe(
    `UPDATE "public"."ciclo" SET "fecha_fin" = '2026-04-01 00:00:00' WHERE "id" = 1`
  );
  console.log("✅ Ciclo 1 (2026-3) finalizado");

  // Adelantar el inicio del Ciclo 2026-4 (empezaba apenas el 04-02T00:00:00) para cubrir el 1 de abril.
  await prisma.$executeRawUnsafe(
    `UPDATE "public"."ciclo" SET "fecha_inicio" = '2026-04-01 00:00:00' WHERE "id" = 2`
  );
  console.log("✅ Ciclo 2 (2026-4) actualizado para iniciar el 1 de Abril");
  
  // Arreglar la subsecuencia
  await prisma.$executeRawUnsafe(
    `UPDATE "public"."ciclo" SET "fecha_inicio" = '2026-07-01 00:00:00', "fecha_fin" = '2026-09-24 00:00:00' WHERE "id" = 3`
  );
  console.log("✅ Ciclo 3 (2027-1) alineado");

  const results = await prisma.$queryRawUnsafe(`SELECT id, ciclo, fecha_inicio, fecha_fin, activo FROM "public"."ciclo" ORDER BY id`);
  console.log("Current Rows:", results);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
