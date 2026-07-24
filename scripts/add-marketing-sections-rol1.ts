import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Agregar secciones crear_ticket_marketing (id=3) y marketing_mis_tickets (id=7) al rol Usuario (rolId=1)
  await prisma.permisoRolSeccion.upsert({
    where: { rolId_seccionId: { rolId: 1, seccionId: 3 } },
    update: { activo: true },
    create: { rolId: 1, seccionId: 3, activo: true },
  });

  await prisma.permisoRolSeccion.upsert({
    where: { rolId_seccionId: { rolId: 1, seccionId: 7 } },
    update: { activo: true },
    create: { rolId: 1, seccionId: 7, activo: true },
  });

  // Verificar secciones del rol 1
  const result = await prisma.permisoRolSeccion.findMany({
    where: { rolId: 1 },
    include: { seccion: { select: { identificador: true } } },
    orderBy: { seccionId: 'asc' },
  });

  console.log('Secciones del Rol Usuario (rolId=1):');
  result.forEach(r => console.log(`  seccionId=${r.seccionId} -> ${r.seccion.identificador} (activo=${r.activo})`));
  console.log('✅ Secciones de marketing añadidas correctamente.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
