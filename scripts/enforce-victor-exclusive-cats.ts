import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const VICTOR_ID = 3;

// Las 9 subcategorías que SOLO puede atender Victor Barrera
const VICTOR_SPECIAL_SUBCATS = [
  { categoriaId: 1, subcategoriaId: 90, catName: 'Alumno', subName: 'Colaboradores' },
  { categoriaId: 1, subcategoriaId: 89, catName: 'Alumno', subName: 'Docentes' },
  { categoriaId: 1, subcategoriaId: 40, catName: 'Alumno', subName: 'Notas aclaratorias' },
  { categoriaId: 3, subcategoriaId: 71, catName: 'Colaborador', subName: 'Bajas' },
  { categoriaId: 3, subcategoriaId: 72, catName: 'Colaborador', subName: 'Redireccionar correo institucional' },
  { categoriaId: 3, subcategoriaId: 13, catName: 'Colaborador', subName: 'Redireccionar' },
  { categoriaId: 4, subcategoriaId: 10, catName: 'Docente', subName: 'Actualizar' },
  { categoriaId: 4, subcategoriaId: 92, catName: 'Docente', subName: 'Correo personal' },
  { categoriaId: 4, subcategoriaId: 86, catName: 'Docente', subName: 'Lista negra' },
];

async function main() {
  console.log('=== 1. VERIFICAR Y ASEGURAR ASIGNACIONES DE VICTOR BARRERA (ID 3) ===');
  for (const item of VICTOR_SPECIAL_SUBCATS) {
    const existing = await prisma.asignacionesCategorias.findFirst({
      where: {
        atiendeId: VICTOR_ID,
        categoriaId: item.categoriaId,
        subcategoriaId: item.subcategoriaId,
      }
    });

    if (existing) {
      if (!existing.activo) {
        await prisma.asignacionesCategorias.update({
          where: { id: existing.id },
          data: { activo: true }
        });
        console.log(`  [Victor] Activada asignación: ${item.catName} > ${item.subName}`);
      } else {
        console.log(`  [Victor] OK activa: ${item.catName} > ${item.subName}`);
      }
    } else {
      await prisma.asignacionesCategorias.create({
        data: {
          atiendeId: VICTOR_ID,
          categoriaId: item.categoriaId,
          subcategoriaId: item.subcategoriaId,
          activo: true
        }
      });
      console.log(`  [Victor] Creada y activada asignación: ${item.catName} > ${item.subName}`);
    }
  }

  console.log('\n=== 2. DESACTIVAR ESTAS 9 SUBCATEGORÍAS EN TODOS LOS DEMÁS USUARIOS ===');
  // Buscar todas las asignaciones activas de estas 9 subcategorías para usuarios != 3
  for (const item of VICTOR_SPECIAL_SUBCATS) {
    const othersActive = await prisma.asignacionesCategorias.findMany({
      where: {
        atiendeId: { not: VICTOR_ID },
        categoriaId: item.categoriaId,
        subcategoriaId: item.subcategoriaId,
        activo: true,
      },
      include: {
        atiende: { select: { id: true, nombres: true, apellidos: true, mail: true } }
      }
    });

    if (othersActive.length > 0) {
      for (const asig of othersActive) {
        await prisma.asignacionesCategorias.update({
          where: { id: asig.id },
          data: { activo: false }
        });
        console.log(`  [Desactivada] ${item.catName} > ${item.subName} para usuario ${asig.atiendeId} (${asig.atiende?.nombres} ${asig.atiende?.apellidos})`);
      }
    } else {
      console.log(`  [OK] Ningún otro usuario tiene activa: ${item.catName} > ${item.subName}`);
    }
  }

  console.log('\n=== 3. DESACTIVAR PERMISOS OBSOLETOS EN TABLA permiso_categoria ===');
  // Desactivar en permiso_categoria cualquier permiso para estas subcategorías o de categorías generales de rol
  const updatedPermisoCat = await prisma.permisoCategoria.updateMany({
    where: {
      activo: true,
    },
    data: {
      activo: false
    }
  });
  console.log(`  Desactivados ${updatedPermisoCat.count} registros obsoletos en permiso_categoria.`);

  console.log('\n=== 4. AUDITORÍA FINAL DE ASIGNACIONES ACTIVAS POR USUARIO ===');
  const allUsersWithAssignments = await prisma.usuario.findMany({
    where: {
      asignaciones_categorias: {
        some: { activo: true }
      }
    },
    include: {
      asignaciones_categorias: {
        where: { activo: true },
        include: { categoria: true, subcategoria: true }
      },
      rol: true
    },
    orderBy: { id: 'asc' }
  });

  for (const u of allUsersWithAssignments) {
    console.log(`\nUsuario ${u.id}: ${u.nombres} ${u.apellidos} (${u.mail}) - Rol: ${u.rol?.rol}`);
    u.asignaciones_categorias.forEach(ac => {
      console.log(`   - ${ac.categoria?.nombre} > ${ac.subcategoria?.nombre || 'Categoría completa'} (cat: ${ac.categoriaId}, sub: ${ac.subcategoriaId})`);
    });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
