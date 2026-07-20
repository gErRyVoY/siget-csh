import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const [
    empresas, ciclos, roles, secciones, usuarios, ofertas, descuentos,
    planes, estatus, categorias, carreras, subcategorias, subCats,
    asignaciones, permisos, plantillas, tickets, traslados, incidencias
  ] = await Promise.all([
    prisma.empresa.count(),
    prisma.ciclo.count(),
    prisma.rol.count(),
    prisma.seccion.count(),
    prisma.usuario.count(),
    prisma.oferta.count(),
    prisma.descuento.count(),
    prisma.planPago.count(),
    prisma.estatus.count(),
    prisma.categoria.count(),
    prisma.carrera.count(),
    prisma.subcategoria.count(),
    prisma.subcategoriaCategorias.count(),
    prisma.asignacionesCategorias.count(),
    prisma.permisoCategoria.count(),
    prisma.plantillaCorreo.count(),
    prisma.ticket.count(),
    prisma.traslado.count(),
    prisma.incidencia.count(),
  ]);

  console.log('\n=== VALIDACIÓN DE BASE DE DATOS ===\n');
  console.log('--- Catálogos ---');
  console.log(`  Empresas:      ${empresas}`);
  console.log(`  Ciclos:        ${ciclos}`);
  console.log(`  Roles:         ${roles}`);
  console.log(`  Secciones:     ${secciones}`);
  console.log(`  Ofertas:       ${ofertas}`);
  console.log(`  Descuentos:    ${descuentos}`);
  console.log(`  Planes de pago:${planes}`);
  console.log(`  Estatus:       ${estatus}`);
  console.log(`  Categorías:    ${categorias}`);
  console.log(`  Carreras:      ${carreras}`);
  console.log(`  Subcategorías: ${subcategorias}`);
  console.log('\n--- Relaciones ---');
  console.log(`  SubcategoriaCategorias: ${subCats}`);
  console.log(`  AsignacionesCategorias: ${asignaciones}`);
  console.log(`  PermisoCategoria:       ${permisos}`);
  console.log(`  Plantillas correo:      ${plantillas}`);
  console.log('\n--- Usuarios ---');
  console.log(`  Usuarios registrados: ${usuarios}`);
  console.log('\n--- Datos transaccionales ---');
  console.log(`  Tickets:     ${tickets}`);
  console.log(`  Traslados:   ${traslados}`);
  console.log(`  Incidencias: ${incidencias}`);
  console.log('\n===================================\n');
}

main()
  .catch(e => { console.error('Error:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
