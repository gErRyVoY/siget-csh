import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupDir = path.join('scripts', 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  // Backup de asignaciones_categorias (permisos individuales por usuario)
  const asignaciones = await prisma.asignacionesCategorias.findMany({
    orderBy: [{ atiendeId: 'asc' }, { categoriaId: 'asc' }, { subcategoriaId: 'asc' }],
  });

  // Backup de permiso_categoria (permisos por rol)
  const permisosCategoriaRol = await prisma.permisoCategoria.findMany({
    orderBy: [{ rolId: 'asc' }, { categoriaId: 'asc' }, { subcategoriaId: 'asc' }],
  });

  const backupData = {
    timestamp,
    description: 'Backup previo a actualización masiva de categorías especiales de Victor Barrera (id=3)',
    asignaciones_categorias: {
      count: asignaciones.length,
      data: asignaciones,
    },
    permiso_categoria: {
      count: permisosCategoriaRol.length,
      data: permisosCategoriaRol,
    },
  };

  const filePath = path.join(backupDir, `backup-categorias-${timestamp}.json`);
  fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), 'utf-8');

  console.log(`✅ Backup completado: ${filePath}`);
  console.log(`   - asignaciones_categorias: ${asignaciones.length} registros`);
  console.log(`   - permiso_categoria (rol): ${permisosCategoriaRol.length} registros`);
}

main()
  .catch(e => { console.error('Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
