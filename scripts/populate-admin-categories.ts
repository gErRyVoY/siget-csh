import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const VICTOR_ID = 3;

// Las 9 subcategorías exclusivas de Victor
const VICTOR_SPECIAL_SUBS = new Set([
  '1-90', // Alumno > Colaboradores
  '1-89', // Alumno > Docentes
  '1-40', // Alumno > Notas aclaratorias
  '3-71', // Colaborador > Bajas
  '3-72', // Colaborador > Redireccionar correo institucional
  '3-13', // Colaborador > Redireccionar
  '4-10', // Docente > Actualizar
  '4-92', // Docente > Correo personal
  '4-86', // Docente > Lista negra
]);

async function main() {
  const [categories, subcategories, relations] = await Promise.all([
    prisma.categoria.findMany({ where: { activo: true }, orderBy: { id: 'asc' } }),
    prisma.subcategoria.findMany({ where: { activo: true }, orderBy: { id: 'asc' } }),
    prisma.subcategoriaCategorias.findMany({ where: { activo: true } })
  ]);

  // Construir mapa de pares (categoriaId, subcategoriaId) válidos
  // Función recursiva para obtener todas las subcategorías de una categoría
  function getSubcategoryIds(parentSubId: number | null, catId: number): number[] {
    const directSubs = subcategories.filter(sub => {
      if (parentSubId === null) {
        const isLinked = relations.some(r => r.categoriaId === catId && r.subcategoriaId === sub.id);
        return isLinked && sub.parent_subcategoriaId === null;
      } else {
        return sub.parent_subcategoriaId === parentSubId;
      }
    });

    let result: number[] = [];
    for (const sub of directSubs) {
      result.push(sub.id);
      const childSubs = getSubcategoryIds(sub.id, catId);
      result = result.concat(childSubs);
    }
    return result;
  }

  const allCategorySubcategoryPairs: { categoriaId: number; subcategoriaId: number | null; catName: string; subName?: string }[] = [];

  for (const cat of categories) {
    const subIds = getSubcategoryIds(null, cat.id);
    if (subIds.length === 0) {
      // Categoría sin subcategorías (ej. "Otro")
      allCategorySubcategoryPairs.push({
        categoriaId: cat.id,
        subcategoriaId: null,
        catName: cat.nombre
      });
    } else {
      // Registrar la categoría completa (null)
      allCategorySubcategoryPairs.push({
        categoriaId: cat.id,
        subcategoriaId: null,
        catName: cat.nombre
      });
      for (const subId of subIds) {
        const subObj = subcategories.find(s => s.id === subId);
        allCategorySubcategoryPairs.push({
          categoriaId: cat.id,
          subcategoriaId: subId,
          catName: cat.nombre,
          subName: subObj?.nombre
        });
      }
    }
  }

  console.log(`Total pares categoría-subcategoría en el sistema: ${allCategorySubcategoryPairs.length}`);

  // Listar usuarios admins (rolId = 2) y superadmins distintos de Victor (ej. ID 1)
  const adminUsers = await prisma.usuario.findMany({
    where: {
      rolId: 2, // Admin
      activo: true
    },
    orderBy: { id: 'asc' }
  });

  console.log(`\nUsuarios con Rol Admin (${adminUsers.length}):`);
  adminUsers.forEach(u => console.log(` - ID ${u.id}: ${u.nombres} ${u.apellidos} (${u.mail})`));

  console.log('\n--- POBLANDO ASIGNACIONES PARA LOS ADMINS ---');
  for (const user of adminUsers) {
    console.log(`\nProcesando Admin ${user.id} (${user.nombres} ${user.apellidos})...`);
    let countActive = 0;
    let countExcluded = 0;

    for (const pair of allCategorySubcategoryPairs) {
      const key = `${pair.categoriaId}-${pair.subcategoriaId}`;
      const isVictorSpecial = VICTOR_SPECIAL_SUBS.has(key);

      const targetActivo = !isVictorSpecial; // true si NO es especial de Victor, false si ES especial de Victor

      const existing = await prisma.asignacionesCategorias.findFirst({
        where: {
          atiendeId: user.id,
          categoriaId: pair.categoriaId,
          subcategoriaId: pair.subcategoriaId
        }
      });

      if (existing) {
        if (existing.activo !== targetActivo) {
          await prisma.asignacionesCategorias.update({
            where: { id: existing.id },
            data: { activo: targetActivo }
          });
        }
      } else {
        await prisma.asignacionesCategorias.create({
          data: {
            atiendeId: user.id,
            categoriaId: pair.categoriaId,
            subcategoriaId: pair.subcategoriaId,
            activo: targetActivo,
            prioridad: 5
          }
        });
      }

      if (targetActivo) countActive++;
      else countExcluded++;
    }

    console.log(`  -> ${countActive} subcats activadas, ${countExcluded} subcats excluidas (especiales de Victor).`);
  }

  // Superadmin Gerardo Omaña (ID 1): también habilitar todo excepto las de Victor
  const gerardo = await prisma.usuario.findUnique({ where: { id: 1 } });
  if (gerardo) {
    console.log(`\nProcesando Superadmin ID 1 (${gerardo.nombres} ${gerardo.apellidos})...`);
    for (const pair of allCategorySubcategoryPairs) {
      const key = `${pair.categoriaId}-${pair.subcategoriaId}`;
      const isVictorSpecial = VICTOR_SPECIAL_SUBS.has(key);
      const targetActivo = !isVictorSpecial;

      const existing = await prisma.asignacionesCategorias.findFirst({
        where: {
          atiendeId: 1,
          categoriaId: pair.categoriaId,
          subcategoriaId: pair.subcategoriaId
        }
      });

      if (existing) {
        if (existing.activo !== targetActivo) {
          await prisma.asignacionesCategorias.update({
            where: { id: existing.id },
            data: { activo: targetActivo }
          });
        }
      } else {
        await prisma.asignacionesCategorias.create({
          data: {
            atiendeId: 1,
            categoriaId: pair.categoriaId,
            subcategoriaId: pair.subcategoriaId,
            activo: targetActivo,
            prioridad: 5
          }
        });
      }
    }
    console.log(`  -> Superadmin ID 1 actualizado.`);
  }

  // Victor Barrera (ID 3): Asegurar SOLO sus 9 subcategorías y sus 3 categorías padre
  console.log(`\nProcesando Victor Barrera (ID 3)...`);
  const victorCats = [1, 3, 4]; // Alumno, Colaborador, Docente
  // Asegurar que las 9 de Victor estén activas
  for (const key of VICTOR_SPECIAL_SUBS) {
    const [catIdStr, subIdStr] = key.split('-');
    const catId = parseInt(catIdStr, 10);
    const subId = parseInt(subIdStr, 10);

    const existing = await prisma.asignacionesCategorias.findFirst({
      where: {
        atiendeId: VICTOR_ID,
        categoriaId: catId,
        subcategoriaId: subId
      }
    });

    if (existing) {
      await prisma.asignacionesCategorias.update({
        where: { id: existing.id },
        data: { activo: true }
      });
    } else {
      await prisma.asignacionesCategorias.create({
        data: {
          atiendeId: VICTOR_ID,
          categoriaId: catId,
          subcategoriaId: subId,
          activo: true,
          prioridad: 5
        }
      });
    }
  }

  console.log('✅ Asignaciones de categorías actualizadas con éxito.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
