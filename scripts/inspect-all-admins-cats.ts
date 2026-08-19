import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== 1. USUARIO 3 (VICTOR BARRERA) ===');
  const victor = await prisma.usuario.findUnique({
    where: { id: 3 },
    include: {
      asignaciones_categorias: {
        where: { activo: true },
        include: { categoria: true, subcategoria: true }
      }
    }
  });
  console.log(`Victor Barrera (${victor?.mail}), rolId: ${victor?.rolId}`);
  console.log(`Asignaciones activas de Victor (${victor?.asignaciones_categorias.length}):`);
  const victorActivePerms = victor?.asignaciones_categorias.map(ac => ({
    categoriaId: ac.categoriaId,
    subcategoriaId: ac.subcategoriaId,
    catNombre: ac.categoria?.nombre,
    subNombre: ac.subcategoria?.nombre
  })) || [];
  console.table(victorActivePerms);

  console.log('\n=== 2. USUARIO 284 ===');
  const user284 = await prisma.usuario.findUnique({
    where: { id: 284 },
    include: {
      asignaciones_categorias: {
        include: { categoria: true, subcategoria: true }
      },
      rol: true
    }
  });
  console.log(`Usuario 284: ${user284?.nombres} ${user284?.apellidos} (${user284?.mail}), rol: ${user284?.rol?.rol} (id: ${user284?.rolId}), atiende_csh: ${user284?.atiende_csh}`);
  console.log(`Asignaciones en DB (${user284?.asignaciones_categorias.length}):`);
  console.table(user284?.asignaciones_categorias.map(ac => ({
    id: ac.id,
    catId: ac.categoriaId,
    subId: ac.subcategoriaId,
    catNombre: ac.categoria?.nombre,
    subNombre: ac.subcategoria?.nombre,
    activo: ac.activo
  })));

  console.log('\n=== 3. TODOS LOS USUARIOS CON ROL ADMIN O SUPERADMIN ===');
  const admins = await prisma.usuario.findMany({
    where: { rolId: { in: [2, 3] } },
    include: {
      asignaciones_categorias: {
        where: { activo: true },
        include: { categoria: true, subcategoria: true }
      }
    },
    orderBy: { id: 'asc' }
  });

  console.log(`Total admins/superadmins: ${admins.length}`);
  for (const admin of admins) {
    console.log(`\nUser ID ${admin.id}: ${admin.nombres} ${admin.apellidos} (${admin.mail}) | rolId: ${admin.rolId} | atiende_csh: ${admin.atiende_csh}`);
    const activeAsigns = admin.asignaciones_categorias;
    console.log(`  Asignaciones activas directas: ${activeAsigns.length}`);
    if (activeAsigns.length > 0) {
      console.log(`  Detalle:`, activeAsigns.map(a => `${a.categoria?.nombre} > ${a.subcategoria?.nombre || 'TODAS'} (cat:${a.categoriaId}, sub:${a.subcategoriaId})`).join(', '));
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
