/**
 * Auditoría completa de categorías de Victor Barrera (id=3)
 * Revisa AMBAS fuentes de permisos:
 *  1. asignaciones_categorias  → permisos individuales por usuario
 *  2. permiso_categoria        → permisos heredados por rol
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const VICTOR_ID = 3;

  // --- 1. Categorías de Victor en asignaciones_categorias (permisos individuales) ---
  const victorPerms = await prisma.asignacionesCategorias.findMany({
    where: { atiendeId: VICTOR_ID, activo: true },
    include: {
      categoria:    { select: { id: true, nombre: true } },
      subcategoria: { select: { id: true, nombre: true } },
    },
    orderBy: [{ categoriaId: 'asc' }, { subcategoriaId: 'asc' }],
  });

  console.log(`\n╔══════════════════════════════════════════════════════════════════╗`);
  console.log(`║  Categorías que atiende Victor Barrera (id=${VICTOR_ID})              ║`);
  console.log(`╚══════════════════════════════════════════════════════════════════╝`);
  for (const p of victorPerms) {
    const c = p.categoria?.nombre   ?? `CatId ${p.categoriaId}`;
    const s = p.subcategoria?.nombre ?? 'Categoría completa';
    console.log(`  ▸ [CatId=${p.categoriaId}] "${c}"  >  [SubId=${p.subcategoriaId ?? 'null'}] "${s}"`);
  }
  console.log(`\n  Total: ${victorPerms.length} permisos individuales\n`);

  if (victorPerms.length === 0) {
    console.log('Victor no tiene asignaciones. Nada que auditar.');
    return;
  }

  // Preparar los pares (catId, subId) de Victor
  const victorPairs = victorPerms.map(p => ({
    categoriaId:    p.categoriaId,
    subcategoriaId: p.subcategoriaId,
    catName: p.categoria?.nombre   ?? `Cat ${p.categoriaId}`,
    subName: p.subcategoria?.nombre ?? 'Categoría completa',
  }));

  // ─────────────────────────────────────────────────────────────────────
  // FUENTE A: asignaciones_categorias (permisos directos por usuario)
  // ─────────────────────────────────────────────────────────────────────
  console.log(`╔══════════════════════════════════════════════════════════════════╗`);
  console.log(`║  FUENTE A: asignaciones_categorias  (permisos directos)         ║`);
  console.log(`╚══════════════════════════════════════════════════════════════════╝`);

  let totalA = 0;
  const affectedAsignIds: number[] = [];

  for (const pair of victorPairs) {
    const others = await prisma.asignacionesCategorias.findMany({
      where: {
        atiendeId:      { not: VICTOR_ID },
        categoriaId:    pair.categoriaId,
        subcategoriaId: pair.subcategoriaId,
        activo: true,
      },
      include: {
        atiende: { select: { id: true, nombres: true, apellidos: true, mail: true } },
      },
    });

    if (others.length > 0) {
      console.log(`\n  [${pair.catName}] > [${pair.subName}]:`);
      for (const o of others) {
        console.log(`    AsigId=${o.id} | Usuario id=${o.atiendeId}: ${o.atiende?.nombres} ${o.atiende?.apellidos} (${o.atiende?.mail})`);
        affectedAsignIds.push(o.id);
      }
      totalA += others.length;
    }
  }

  if (totalA === 0) {
    console.log('  (ningún otro usuario tiene permisos directos en estas categorías)\n');
  } else {
    console.log(`\n  → ${totalA} registros en asignaciones_categorias a desactivar.`);
    console.log(`  → IDs: [${affectedAsignIds.join(', ')}]\n`);
  }

  // ─────────────────────────────────────────────────────────────────────
  // FUENTE B: permiso_categoria (permisos heredados por rol)
  // ─────────────────────────────────────────────────────────────────────
  console.log(`╔══════════════════════════════════════════════════════════════════╗`);
  console.log(`║  FUENTE B: permiso_categoria  (herencia por rol)                ║`);
  console.log(`╚══════════════════════════════════════════════════════════════════╝`);

  let totalB = 0;
  const affectedPermCatIds: number[] = [];

  for (const pair of victorPairs) {
    // Buscar en permiso_categoria con cualquier rol (excepto si quisiéramos excluir alguno)
    const rolePerms = await prisma.permisoCategoria.findMany({
      where: {
        categoriaId:    pair.categoriaId,
        subcategoriaId: pair.subcategoriaId,
        activo: true,
      },
      include: {
        rol: { select: { id: true, rol: true } },
      },
    });

    if (rolePerms.length > 0) {
      console.log(`\n  [${pair.catName}] > [${pair.subName}]:`);
      for (const rp of rolePerms) {
        // Buscar usuarios con ese rol que tengan atiende_csh o atiende_mkt activo
        const usersWithRole = await prisma.usuario.findMany({
          where: { rolId: rp.rolId, activo: true, atiende_csh: true },
          select: { id: true, nombres: true, apellidos: true, mail: true, rolId: true },
        });
        console.log(`    PermCatId=${rp.id} | Rol id=${rp.rolId} "${rp.rol?.rol}" → ${usersWithRole.length} usuarios con atiende_csh activo:`);
        for (const u of usersWithRole) {
          if (u.id !== VICTOR_ID) {
            console.log(`      Usuario id=${u.id}: ${u.nombres} ${u.apellidos} (${u.mail})`);
          }
        }
        affectedPermCatIds.push(rp.id);
      }
      totalB += rolePerms.length;
    }
  }

  if (totalB === 0) {
    console.log('  (ningún rol tiene permiso_categoria para estas subcategorías)\n');
  } else {
    console.log(`\n  → ${totalB} registros en permiso_categoria detectados.`);
    console.log(`  → IDs de permiso_categoria: [${affectedPermCatIds.join(', ')}]\n`);
  }

  // ─────────────────────────────────────────────────────────────────────
  // RESUMEN FINAL
  // ─────────────────────────────────────────────────────────────────────
  console.log(`╔══════════════════════════════════════════════════════════════════╗`);
  console.log(`║  RESUMEN FINAL                                                   ║`);
  console.log(`╚══════════════════════════════════════════════════════════════════╝`);
  console.log(`  Permisos directos (asignaciones_categorias) a revocar: ${totalA}`);
  console.log(`  Permisos por rol  (permiso_categoria)      detectados: ${totalB}`);
  if (totalA + totalB === 0) {
    console.log(`\n  ✅ Ya no hay otros usuarios con estas categorías. BD en estado correcto.`);
  } else {
    console.log(`\n  ⚠️  Hay registros que requieren acción. Ejecutar el script de revocación.`);
  }
}

main()
  .catch(e => { console.error('Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
