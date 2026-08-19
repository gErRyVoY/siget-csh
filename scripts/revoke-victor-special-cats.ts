/**
 * ACTUALIZACIÓN QUIRÚRGICA: Revocar acceso a las 9 subcategorías especiales de Victor Barrera
 * para los otros usuarios con atiende_csh activo (Gerardo id=1, Jair id=286).
 *
 * Estrategia: Crear/actualizar registros en asignaciones_categorias con activo=false
 * para cada par (catId, subId) de Victor × cada usuario afectado.
 * Esto genera una "exclusión explícita" que tiene prioridad sobre la herencia del rol.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const VICTOR_ID = 3;
  const AFFECTED_USER_IDS = [1, 286]; // Gerardo, Jair

  // 1. Obtener los 9 pares de Victor
  const victorPerms = await prisma.asignacionesCategorias.findMany({
    where: { atiendeId: VICTOR_ID, activo: true },
    include: {
      categoria:    { select: { nombre: true } },
      subcategoria: { select: { nombre: true } },
    },
  });

  console.log(`\n=== Plan de ejecución ===`);
  console.log(`Subcategorías especiales de Victor: ${victorPerms.length}`);
  console.log(`Usuarios a excluir: ${AFFECTED_USER_IDS.length} (ids: ${AFFECTED_USER_IDS.join(', ')})`);
  console.log(`Operaciones totales (upserts): ${victorPerms.length * AFFECTED_USER_IDS.length}`);
  console.log(`\nEjecutando...\n`);

  let created = 0;
  let updated = 0;

  for (const userId of AFFECTED_USER_IDS) {
    const userName = userId === 1 ? 'Gerardo Omaña' : 'Jair Flores';
    console.log(`  → Usuario id=${userId} (${userName}):`);

    for (const vp of victorPerms) {
      const catName = vp.categoria?.nombre   ?? `Cat ${vp.categoriaId}`;
      const subName = vp.subcategoria?.nombre ?? `Sub ${vp.subcategoriaId}`;

      // Verificar si ya existe un registro
      const existing = await prisma.asignacionesCategorias.findFirst({
        where: {
          atiendeId:      userId,
          categoriaId:    vp.categoriaId,
          subcategoriaId: vp.subcategoriaId,
        },
      });

      if (existing) {
        if (existing.activo === false) {
          console.log(`     ✓ Ya está revocado: "${catName}" > "${subName}" (id=${existing.id})`);
        } else {
          await prisma.asignacionesCategorias.update({
            where: { id: existing.id },
            data:  { activo: false },
          });
          console.log(`     ✏️  Actualizado a false: "${catName}" > "${subName}" (id=${existing.id})`);
          updated++;
        }
      } else {
        await prisma.asignacionesCategorias.create({
          data: {
            atiendeId:      userId,
            categoriaId:    vp.categoriaId,
            subcategoriaId: vp.subcategoriaId,
            activo:         false,
            prioridad:      5,
          },
        });
        console.log(`     ➕ Creado (activo=false): "${catName}" > "${subName}"`);
        created++;
      }
    }
  }

  console.log(`\n╔══════════════════════════════════════════════════╗`);
  console.log(`║  RESULTADO                                       ║`);
  console.log(`╚══════════════════════════════════════════════════╝`);
  console.log(`  Registros creados:     ${created}`);
  console.log(`  Registros actualizados: ${updated}`);
  console.log(`\n✅ Las 9 subcategorías especiales de Victor ahora`);
  console.log(`   están bloqueadas explícitamente para Gerardo y Jair.`);
}

main()
  .catch(e => { console.error('Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
