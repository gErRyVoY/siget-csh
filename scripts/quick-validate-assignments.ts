import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

async function main() {
  const adminUsers = await p.usuario.findMany({
    where: { rolId: 2, activo: true },
    include: {
      asignaciones_categorias: {
        where: { activo: true },
      }
    }
  });

  console.log('--- ADMINS ACTIVOS ---');
  for (const u of adminUsers) {
    console.log(`Admin ${u.id} (${u.nombres} ${u.apellidos}): ${u.asignaciones_categorias.length} categorías/subcategorías activas`);
  }

  const victor = await p.usuario.findUnique({
    where: { id: 3 },
    include: {
      asignaciones_categorias: {
        where: { activo: true },
        include: { categoria: true, subcategoria: true }
      }
    }
  });

  console.log(`\n--- VICTOR BARRERA (ID 3) ---`);
  console.log(`Victor (${victor?.nombres} ${victor?.apellidos}): ${victor?.asignaciones_categorias.length} asignaciones activas:`);
  victor?.asignaciones_categorias.forEach(a => console.log(`   * ${a.categoria?.nombre} > ${a.subcategoria?.nombre || 'TODAS'}`));

  const victorKeys = ['1-90', '1-89', '1-40', '3-71', '3-72', '3-13', '4-10', '4-92', '4-86'];
  let errorCount = 0;
  for (const vk of victorKeys) {
    const [catId, subId] = vk.split('-').map(Number);
    const others = await p.asignacionesCategorias.findMany({
      where: {
        atiendeId: { not: 3 },
        categoriaId: catId,
        subcategoriaId: subId,
        activo: true
      }
    });
    if (others.length > 0) {
      console.error(`ERROR: Usuario(s) ${others.map(o => o.atiendeId).join(', ')} tienen activa la subcat ${vk}`);
      errorCount++;
    }
  }

  if (errorCount === 0) {
    console.log(`\n✅ VALIDACIÓN 100% EXITOSA: Las 9 subcategorías de Victor están activas ÚNICAMENTE para Victor.`);
  }
}

main().catch(console.error).finally(() => p.$disconnect());
