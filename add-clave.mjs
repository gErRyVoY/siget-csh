import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  await prisma.$executeRawUnsafe(
    'ALTER TABLE usuario ADD COLUMN IF NOT EXISTS clave VARCHAR(8) UNIQUE;'
  );
  console.log('✅ Columna "clave" añadida correctamente a la tabla "usuario".');
} catch (e) {
  console.error('❌ Error:', e.message);
} finally {
  await prisma.$disconnect();
}
