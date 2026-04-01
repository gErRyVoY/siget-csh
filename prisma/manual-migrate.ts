import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Running manual migration...");
  
  // Use $executeRawUnsafe to run our ALTER TABLE statements
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "public"."rol" ADD COLUMN IF NOT EXISTS "atiendeTicketsCsh" BOOLEAN NOT NULL DEFAULT false`
  );
  console.log("✅ Added atiendeTicketsCsh to rol");

  await prisma.$executeRawUnsafe(
    `ALTER TABLE "public"."rol" ADD COLUMN IF NOT EXISTS "atiendeTicketsMkt" BOOLEAN NOT NULL DEFAULT false`
  );
  console.log("✅ Added atiendeTicketsMkt to rol");

  await prisma.$executeRawUnsafe(
    `ALTER TABLE "public"."usuario" ADD COLUMN IF NOT EXISTS "alias" VARCHAR(50)`
  );
  console.log("✅ Added alias to usuario");

  // Verify
  const cols = await prisma.$queryRawUnsafe<Array<{table_name: string, column_name: string}>>(`
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name IN ('rol','usuario') 
      AND column_name IN ('atiendeTicketsCsh','atiendeTicketsMkt','alias')
    ORDER BY table_name, column_name
  `);
  console.log("Verification:", cols);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
