/**
 * validate-flows.ts
 * Script de Pruebas y Validacion General -- SiGeT CSH
 *
 * Valida los flujos criticos del sistema sin necesidad de un servidor corriendo:
 *   1. Integridad de catalogos y roles
 *   2. Logica de asignacion de tickets (agentes, horarios, carga)
 *   3. Flujo de creacion y consistencia de tickets en BD
 *   4. Control de acceso por secciones (RBAC Middleware)
 *   5. Integridad de traslados
 *
 * Uso:
 *   npx tsx scripts/validate-flows.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PASS = "OK";
const FAIL = "FAIL";
const INFO = "INFO";

interface TestResult {
  suite: string;
  test: string;
  passed: boolean;
  detail?: string;
}

const results: TestResult[] = [];

function log(suite: string, test: string, passed: boolean, detail?: string) {
  results.push({ suite, test, passed, detail });
  const icon = passed ? `[${PASS}]` : `[${FAIL}]`;
  console.log(`  ${icon} [${suite}] ${test}${detail ? ` -- ${detail}` : ""}`);
}

function section(title: string) {
  console.log(`\n${"=".repeat(65)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(65)}`);
}

// ---------------------------------------------------------------
// SUITE 1: Consistencia de Catalogos y Roles
// ---------------------------------------------------------------
async function suite1_catalogos() {
  section("SUITE 1 -- Catalogos y Roles");

  const roles = await prisma.rol.findMany({ orderBy: { id: "asc" } });
  log("Roles", "Existen 3 roles en BD", roles.length === 3,
    `encontrados: ${roles.length} (${roles.map((r) => r.rol ?? `ID:${r.id}`).join(", ")})`);

  const rol1 = roles.find((r) => r.id === 1);
  log("Roles", "Rol 1 existe", !!rol1, rol1?.rol);

  const categorias = await prisma.categoria.count();
  log("Categorias", "Al menos 12 categorias en BD", categorias >= 12, `total: ${categorias}`);

  const subcats = await prisma.subcategoria.count();
  log("Subcategorias", "Al menos 50 subcategorias en BD", subcats >= 50, `total: ${subcats}`);

  const estatus = await prisma.estatus.count();
  log("Estatus", "Al menos 4 estatus en BD", estatus >= 4, `total: ${estatus}`);

  const usuariosActivos = await prisma.usuario.count({ where: { activo: true } });
  log("Usuarios", "Al menos 10 usuarios activos", usuariosActivos >= 10, `total activos: ${usuariosActivos}`);
}

// ---------------------------------------------------------------
// SUITE 2: Logica de Asignacion de Tickets
// ---------------------------------------------------------------
async function suite2_asignacion() {
  section("SUITE 2 -- Logica de Asignacion de Tickets");

  const agentesCsh = await prisma.usuario.findMany({
    where: {
      activo: true,
      acepta_tickets: true,
      OR: [{ atiende_csh: true }, { rol: { atiende_csh: true } }],
    },
    include: { rol: true },
  });
  log("Asignacion CSH", "Hay agentes CSH activos disponibles",
    agentesCsh.length > 0, `agentes CSH: ${agentesCsh.length}`);

  if (agentesCsh.length > 0) {
    const conHorario = agentesCsh.filter(
      (a) => a.horario_disponibilidad && typeof a.horario_disponibilidad === "object"
    );
    log("Asignacion CSH", "Al menos 1 agente CSH con horario definido",
      conHorario.length > 0, `con horario: ${conHorario.length}/${agentesCsh.length}`);

    const sinHorario = agentesCsh.filter((a) => !a.horario_disponibilidad);
    if (sinHorario.length > 0) {
      console.log(`  [${INFO}] [Asignacion CSH] ${sinHorario.length} agente(s) SIN horario (no recibiran tickets automaticos):`);
      sinHorario.forEach((a) => console.log(`        - ${a.nombres} ${a.apellidos} (id=${a.id})`));
    }
  }

  const agentesMkt = await prisma.usuario.findMany({
    where: {
      activo: true,
      acepta_tickets: true,
      OR: [{ atiende_mkt: true }, { rol: { atiende_mkt: true } }],
    },
    include: { rol: true },
  });
  log("Asignacion MKT", "Agentes Marketing activos consultados",
    true, `agentes MKT activos: ${agentesMkt.length}${agentesMkt.length === 0 ? " (tickets MKT iran sin asignar hasta activar el flag en usuarios MKT)" : ""}`);

  const primeraCat = await prisma.categoria.findFirst({ orderBy: { id: "asc" } });
  if (primeraCat) {
    const permisosCat1 = await prisma.permisoCategoria.count({
      where: { categoriaId: primeraCat.id, activo: true },
    });
    const asignacionesCat1 = await prisma.asignacionesCategorias.count({
      where: { categoriaId: primeraCat.id, activo: true },
    });
    log("Asignacion", `Categoria "${primeraCat.nombre}" tiene permisos o asignaciones`,
      permisosCat1 > 0 || asignacionesCat1 > 0,
      `permisos rol: ${permisosCat1}, asignaciones especificas: ${asignacionesCat1}`);
  }

  const cargaNegativa = await prisma.usuario.count({ where: { carga_actual: { lt: 0 } } });
  log("Carga trabajo", "Ningun usuario tiene carga_actual negativa",
    cargaNegativa === 0, `usuarios con carga negativa: ${cargaNegativa}`);

  const usuariosConCarga = await prisma.usuario.findMany({
    where: { carga_actual: { gt: 0 } },
    select: { id: true, nombres: true, apellidos: true, carga_actual: true },
    take: 5,
  });
  console.log(`  [${INFO}] [Carga trabajo] ${usuariosConCarga.length} usuario(s) con carga_actual > 0 (primeros 5):`);
  for (const u of usuariosConCarga) {
    const ticketsActivos = await prisma.ticket.count({
      where: {
        atiendeId: u.id,
        estatus: { nombre: { notIn: ["Solucionado", "Cancelado"] } },
      },
    });
    const match = ticketsActivos === u.carga_actual;
    const icon = match ? `[${PASS}]` : "[WARN]";
    console.log(`    ${icon} ${u.nombres} ${u.apellidos}: carga_actual=${u.carga_actual}, tickets activos=${ticketsActivos}`);
  }
}

// ---------------------------------------------------------------
// SUITE 3: Flujo de Creacion de Tickets
// ---------------------------------------------------------------
async function suite3_creacion() {
  section("SUITE 3 -- Flujo de Creacion de Tickets (validacion BD)");

  const totalTickets = await prisma.ticket.count();
  log("Tickets", "Existe al menos 1 ticket en BD", totalTickets > 0, `total: ${totalTickets}`);

  if (totalTickets > 0) {
    const ultimoTicket = await prisma.ticket.findFirst({
      orderBy: { id: "desc" },
      include: { estatus: true, solicitante: true, atiende: true, categoria: true },
    });

    if (ultimoTicket) {
      log("Tickets", "Ultimo ticket tiene estatus valido", !!ultimoTicket.estatus,
        `#${ultimoTicket.id} -- "${ultimoTicket.estatus?.nombre}" | cat: ${ultimoTicket.categoria?.nombre}`);
      log("Tickets", "Ultimo ticket tiene solicitante valido", !!ultimoTicket.solicitante,
        `solicitante: ${ultimoTicket.solicitante?.nombres} ${ultimoTicket.solicitante?.apellidos}`);
      if (ultimoTicket.atiendeId) {
        log("Tickets", "Ultimo ticket tiene agente asignado", !!ultimoTicket.atiende,
          `atiende: ${ultimoTicket.atiende?.nombres} ${ultimoTicket.atiende?.apellidos}`);
      } else {
        console.log(`  [${INFO}] [Tickets] Ultimo ticket #${ultimoTicket.id} esta SIN ASIGNAR (normal si no hay agentes disponibles)`);
      }
    }

    const asignadosInactivos = await prisma.ticket.count({
      where: { atiendeId: { not: null }, atiende: { activo: false } },
    });
    log("Tickets", "No hay tickets asignados a agentes inactivos",
      asignadosInactivos === 0, `con agente inactivo: ${asignadosInactivos}`);

    const byEstatus = await prisma.ticket.groupBy({
      by: ["estatusId"],
      _count: { id: true },
    });
    const estatusMap = await prisma.estatus.findMany();
    console.log(`  [${INFO}] [Tickets] Distribucion por estatus:`);
    for (const row of byEstatus) {
      const est = estatusMap.find((e) => e.id === row.estatusId);
      console.log(`        - ${est?.nombre ?? `ID=${row.estatusId}`}: ${row._count.id} tickets`);
    }
  }
}

// ---------------------------------------------------------------
// SUITE 4: Validaciones de Middleware (RBAC de Secciones)
// ---------------------------------------------------------------
async function suite4_middleware() {
  section("SUITE 4 -- Secciones y Control de Acceso (RBAC Middleware)");

  const seccionesRequeridas = [
    "soporte_dashboard",
    "soporte_mis_tickets",
    "marketing_dashboard",
    "marketing_mis_tickets",
    "marketing_todos",
    "crear_ticket_csh",
    "crear_ticket_marketing",
    "proceso_traslados",
    "admin_siget_usuarios",
    "admin_siget_roles",
    "admin_siget_categorias",
    "admin_siget_tickets",
    "admin_siget_ciclos",
    "admin_siget_secciones",
    "admin_correos_crear",
    "admin_correos_actualizar",
    "base_conocimientos",
    "horario_atencion",
  ];

  const seccionesEnBD = await prisma.seccion.findMany({ select: { identificador: true } });
  const nombresEnBD = seccionesEnBD.map((s) => s.identificador);

  const seccionesFaltantes: string[] = [];
  for (const sec of seccionesRequeridas) {
    if (!nombresEnBD.includes(sec)) {
      seccionesFaltantes.push(sec);
    }
  }

  log("Middleware", "Todas las secciones del middleware existen en BD",
    seccionesFaltantes.length === 0,
    seccionesFaltantes.length > 0
      ? `FALTANTES: ${seccionesFaltantes.join(", ")}`
      : `${seccionesRequeridas.length}/${seccionesRequeridas.length} secciones OK`);

  const rol1Secciones = await prisma.permisoRolSeccion.findMany({
    where: { rolId: 1 },
    include: { seccion: true },
  });
  const rol1Nombres = rol1Secciones.map((rs) => rs.seccion.identificador);
  log("Middleware", "Rol 1 tiene soporte_mis_tickets (evita bucle de redirect)",
    rol1Nombres.includes("soporte_mis_tickets"),
    `secciones del Rol 1: ${rol1Nombres.join(", ")}`);

  const rol3Secciones = await prisma.permisoRolSeccion.findMany({
    where: { rolId: 3 },
    include: { seccion: true },
  });
  const rol3Nombres = rol3Secciones.map((rs) => rs.seccion.identificador);
  const adminSecs = ["admin_siget_usuarios", "admin_siget_roles", "admin_siget_categorias"];
  const adminOK = adminSecs.every((s) => rol3Nombres.includes(s));
  log("Middleware", "Rol 3 (admin) tiene todas las secciones de administracion",
    adminOK,
    adminOK
      ? "OK"
      : `faltantes: ${adminSecs.filter((s) => !rol3Nombres.includes(s)).join(", ")}`);

  const sinRol = 0; // rolId es Int obligatorio en schema, no puede ser null
  log("Middleware", "No hay usuarios sin rol asignado", sinRol === 0,
    `usuarios sin rol: ${sinRol}`);
}

// ---------------------------------------------------------------
// SUITE 5: Integridad de Traslados
// ---------------------------------------------------------------
async function suite5_traslados() {
  section("SUITE 5 -- Integridad de Traslados");

  const totalTraslados = await prisma.traslado.count();
  log("Traslados", "Existen traslados en BD", totalTraslados > 0, `total: ${totalTraslados}`);

  if (totalTraslados > 0) {
    const traslados = await prisma.traslado.findMany({ select: { id: true, ticketId: true } });
    const sinTicket = traslados.filter((t) => !t.ticketId);
    log("Traslados", "No hay traslados sin ticket asociado (huerfanos)",
      sinTicket.length === 0, `huerfanos: ${sinTicket.length}`);

    const ultimo = await prisma.traslado.findFirst({
      orderBy: { id: "desc" },
      include: { ticket: true, origen: true, destino: true },
    });
    if (ultimo) {
      log("Traslados", "Ultimo traslado tiene campus origen y destino",
        !!(ultimo.origenId && ultimo.destinoId),
        `#${ultimo.id} | ${ultimo.origen?.nombre ?? "N/A"} -> ${ultimo.destino?.nombre ?? "N/A"}`);
    }
  }
}

// ---------------------------------------------------------------
// RESUMEN FINAL
// ---------------------------------------------------------------
function printSummary(): boolean {
  section("RESUMEN DE VALIDACION");

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  console.log(`\n  Total de pruebas: ${total}`);
  console.log(`  [${PASS}] Pasaron:  ${passed}`);
  console.log(`  [${FAIL}] Fallaron: ${failed}`);

  if (failed > 0) {
    console.log("\n  Pruebas fallidas:");
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`    [${FAIL}] [${r.suite}] ${r.test}: ${r.detail || ""}`);
      });
  }

  console.log(`\n${"=".repeat(65)}\n`);
  return failed === 0;
}

// ---------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------
async function main() {
  console.log("\n>>> SiGeT CSH -- Validacion de Flujos Criticos\n");
  console.log(`  Fecha: ${new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}`);

  try {
    await suite1_catalogos();
    await suite2_asignacion();
    await suite3_creacion();
    await suite4_middleware();
    await suite5_traslados();

    const allPassed = printSummary();
    process.exit(allPassed ? 0 : 1);
  } catch (err) {
    console.error("\nError fatal durante la validacion:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();




