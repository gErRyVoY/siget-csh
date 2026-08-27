import { PrismaClient } from '@prisma/client';

/**
 * Elimina las secciones `admin_siget_roles` (id 21) y `admin_siget_tickets` (id 19),
 * huérfanas desde que se borraron las vistas /admin/roles y /admin/tickets.
 *
 * Ambas relaciones (`permiso_rol_seccion`, `permiso_usuario_seccion`) declaran
 * `onDelete: Cascade`, pero los borrados se hacen explícitos y dentro de una
 * transacción para que el recuento quede en el log.
 *
 * Ya se ejecutó contra la BD de desarrollo (`siget-db-dev-restored-v2`) el
 * 2026-08-26: 4 filas de permiso_rol_seccion y 2 de seccion. Queda pendiente en
 * producción. Es idempotente: si las secciones ya no existen, no hace nada.
 *
 *   dotenv -- tsx scripts/remove-secciones-roles-tickets.ts
 */

const IDENTIFICADORES = ['admin_siget_roles', 'admin_siget_tickets'];

const prisma = new PrismaClient();

async function main() {
  const secciones = await prisma.seccion.findMany({
    where: { identificador: { in: IDENTIFICADORES } },
  });

  if (secciones.length === 0) {
    console.log('No hay secciones que borrar: ya se eliminaron en esta base de datos.');
    return;
  }

  for (const s of secciones) {
    console.log(`  id ${s.id} | ${s.identificador} | ${s.nombre} | activo: ${s.activo}`);
  }

  const ids = secciones.map((s) => s.id);

  const resultado = await prisma.$transaction(async (tx) => {
    const rol = await tx.permisoRolSeccion.deleteMany({ where: { seccionId: { in: ids } } });
    const usuario = await tx.permisoUsuarioSeccion.deleteMany({ where: { seccionId: { in: ids } } });
    const seccion = await tx.seccion.deleteMany({ where: { id: { in: ids } } });
    return { rol: rol.count, usuario: usuario.count, seccion: seccion.count };
  });

  console.log(
    `Borrados -> permiso_rol_seccion: ${resultado.rol} | ` +
    `permiso_usuario_seccion: ${resultado.usuario} | seccion: ${resultado.seccion}`,
  );

  const restantes = await prisma.seccion.count({
    where: { identificador: { in: IDENTIFICADORES } },
  });
  console.log(`Verificación: quedan ${restantes} filas (debe ser 0).`);

  // Los tokens JWT ya emitidos siguen llevando estos identificadores en
  // `token.secciones` hasta que expire su caché de sesión (15 s), pero no
  // conceden acceso a nada: las rutas salieron de `sectionRouteMap`.
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
