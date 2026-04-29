import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    SELECT setval(pg_get_serial_sequence('seccion', 'id'), coalesce(max(id),0) + 1, false) FROM seccion;
  `);

  const existing = await prisma.seccion.findUnique({ where: { identificador: 'feature_dark_mode' } });
  if (!existing) {
    await prisma.seccion.create({
      data: {
        nombre: 'Modo Oscuro',
        identificador: 'feature_dark_mode',
        grupo: 'Ajustes Globales',
        subgrupo: 'Apariencia',
        descripcion: 'Habilita el botón de Modo Oscuro globalmente en la plataforma.',
        activo: false,
      }
    });
  }
  console.log("Sección 'Modo Oscuro' agregada a la base de datos.");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
