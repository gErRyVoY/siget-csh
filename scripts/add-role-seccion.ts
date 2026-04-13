import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Adding 'Roles' section...");

    const maxIdSec = await prisma.seccion.findFirst({
        orderBy: { id: 'desc' }
    });

    const nextId = (maxIdSec?.id || 0) + 1;

    const roleSec = await prisma.seccion.upsert({
        where: { identificador: 'admin_roles' },
        update: {
            nombre: 'Roles',
            grupo: 'Administrador',
            subgrupo: 'SiGeT',
            descripcion: 'Gestión de roles y permisos del sistema.',
        },
        create: {
            id: nextId,
            nombre: 'Roles',
            identificador: 'admin_roles',
            grupo: 'Administrador',
            subgrupo: 'SiGeT',
            descripcion: 'Gestión de roles y permisos del sistema.',
            activo: true
        }
    });

    console.log("Added section:", roleSec.nombre);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
