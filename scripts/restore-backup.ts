/**
 * scripts/restore-backup.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Restaura datos críticos desde el archivo JSON de respaldo al esquema actual.
 *
 * USO:
 *   npx tsx scripts/restore-backup.ts
 *
 * El script es IDEMPOTENTE: usa upsert / skipDuplicates para no duplicar.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const prisma = new PrismaClient();

// ── Ruta al backup ────────────────────────────────────────────────────────────
const BACKUP_DIR = path.join(__dirname, '..', 'prisma', 'backups');

function getLatestBackup(): string {
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse();
  if (files.length === 0) throw new Error('No se encontró ningún archivo de respaldo en ' + BACKUP_DIR);
  return path.join(BACKUP_DIR, files[0]);
}

// ── Mapeo rolId viejo → rolId nuevo ─────────────────────────────────────────
// Roles actuales en BD: 1 = user, 2 = admin, 3 = superadmin
function mapRolId(oldRol: {
  id: number;
  atiendeTicketsCsh?: boolean;
  atiendeTicketsMkt?: boolean;
  administrador?: boolean;
  atiende_csh?: boolean;
  atiende_mkt?: boolean;
}): number {
  const atiende = oldRol.atiendeTicketsCsh || oldRol.atiendeTicketsMkt
    || oldRol.atiende_csh || oldRol.atiende_mkt;
  const admin = oldRol.administrador;
  if (admin) return 3;   // superadmin
  if (atiende) return 2; // admin
  return 1;              // user
}

async function main() {
  console.log('=== RESTAURACIÓN DESDE BACKUP ===\n');

  const backupPath = getLatestBackup();
  console.log(`Usando backup: ${path.basename(backupPath)}\n`);

  const raw = fs.readFileSync(backupPath, 'utf-8');
  const backup = JSON.parse(raw);

  // Construir mapa rolId-viejo → rolId-nuevo
  const rolMap = new Map<number, number>();
  for (const r of backup.rol ?? []) {
    rolMap.set(r.id, mapRolId(r));
  }
  console.log(`Mapa de roles construido: ${rolMap.size} entradas`);

  // ── Verificar roles base ──────────────────────────────────────────────────
  const rolesEnBD = await prisma.rol.findMany({ select: { id: true } });
  const rolIds = new Set(rolesEnBD.map((r: {id: number}) => r.id));
  if (!rolIds.has(1) || !rolIds.has(2) || !rolIds.has(3)) {
    throw new Error('Faltan roles base (1, 2, 3) en la BD. Ejecuta el seed primero (sin FORCE_CLEAN).');
  }
  console.log('✅ Roles base verificados');

  const empresasEnBD = await prisma.empresa.findMany({ select: { id: true } });
  const empresaIds = new Set(empresasEnBD.map((e: {id: number}) => e.id));
  console.log(`✅ ${empresaIds.size} empresas verificadas\n`);

  // ── 1. Restaurar USUARIOS ─────────────────────────────────────────────────
  console.log('Restaurando usuarios...');
  let usuariosOk = 0, usuariosSkip = 0;

  for (const u of backup.usuario ?? []) {
    const newRolId = rolMap.get(u.rolId) ?? 1;
    const empId = empresaIds.has(u.empresaId) ? u.empresaId : 15;

    const data = {
      nombres: u.nombres,
      apellidos: u.apellidos,
      empresaId: empId,
      rolId: newRolId,
      activo: u.activo ?? true,
      acepta_tickets: u.acepta_tickets ?? u.vacaciones ?? true,
      ultimo_login: u.ultimo_login ? new Date(u.ultimo_login) : new Date(),
      horario_disponibilidad: u.horario_disponibilidad ?? undefined,
      carga_actual: u.carga_actual ?? 0,
      image: u.image ?? null,
      auditor_docs: u.auditor_docs ?? false,
      auditor_req: u.auditor_req ?? false,
      trl_coord: u.trl_coord ?? false,
      trl_mail: u.trl_mail ?? false,
      alias: u.alias ?? null,
      clave: u.clave ?? null,
      puesto: u.puesto ?? null,
      tckt_csh: u.tckt_csh ?? true,
      tckt_mkt: u.tckt_mkt ?? false,
      atiende_csh: u.atiende_csh ?? (u.atiendeTicketsCsh ?? false),
      atiende_mkt: u.atiende_mkt ?? (u.atiendeTicketsMkt ?? false),
    };

    try {
      await prisma.usuario.upsert({
        where: { mail: u.mail },
        update: data,
        create: { id: u.id, mail: u.mail, ...data },
      });
      usuariosOk++;
    } catch (err: any) {
      console.warn(`  ⚠️  Usuario ${u.mail}: ${err.message?.split('\n')[0]}`);
      usuariosSkip++;
    }
  }
  console.log(`  → ${usuariosOk} restaurados, ${usuariosSkip} omitidos`);
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"usuario"', 'id'), COALESCE(MAX(id), 1)) FROM "usuario";`
  );

  // ── 2. Verificar ESTATUS, CATEGORÍAS, SUBCATEGORÍAS ──────────────────────
  const estatusEnBD = await prisma.estatus.findMany({ select: { id: true } });
  const estatusIds = new Set(estatusEnBD.map((e: {id: number}) => e.id));

  const catEnBD = await prisma.categoria.findMany({ select: { id: true } });
  const catIds = new Set(catEnBD.map((c: {id: number}) => c.id));

  const subCatEnBD = await prisma.subcategoria.findMany({ select: { id: true } });
  const subCatIds = new Set(subCatEnBD.map((s: {id: number}) => s.id));
  console.log(`✅ ${estatusIds.size} estatus, ${catIds.size} categorías, ${subCatIds.size} subcategorías\n`);

  const usuariosEnBD2 = await prisma.usuario.findMany({ select: { id: true } });
  const usuarioIds = new Set(usuariosEnBD2.map((u: {id: number}) => u.id));

  // ── 3. Restaurar TICKETS ─────────────────────────────────────────────────
  console.log('Restaurando tickets...');
  let ticketsOk = 0, ticketsSkip = 0;

  for (const t of backup.ticket ?? []) {
    if (!estatusIds.has(t.estatusId) || !catIds.has(t.categoriaId)
      || !subCatIds.has(t.subcategoriaId) || !usuarioIds.has(t.solicitanteId)
      || !empresaIds.has(t.empresaId)) {
      ticketsSkip++;
      continue;
    }
    const atiendeId = t.atiendeId && usuarioIds.has(t.atiendeId) ? t.atiendeId : null;

    try {
      await prisma.ticket.upsert({
        where: { id: t.id },
        update: {},
        create: {
          id: t.id,
          fechaalta: new Date(t.fechaalta),
          fechaact: new Date(t.fechaact),
          estatusId: t.estatusId,
          categoriaId: t.categoriaId,
          subcategoriaId: t.subcategoriaId,
          solicitanteId: t.solicitanteId,
          atiendeId,
          prioridad: t.prioridad ?? 'Media',
          descripcion: t.descripcion ?? '',
          empresaId: t.empresaId,
          archivado: t.archivado ?? false,
          archivos: t.archivos ?? [],
          afectado_clave: t.afectado_clave ?? null,
          afectado_nombre: t.afectado_nombre ?? null,
          cicloId: t.cicloId ?? null,
        },
      });
      ticketsOk++;
    } catch (err: any) {
      console.warn(`  ⚠️  Ticket #${t.id}: ${err.message?.split('\n')[0]}`);
      ticketsSkip++;
    }
  }
  console.log(`  → ${ticketsOk} restaurados, ${ticketsSkip} omitidos`);
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"ticket"', 'id'), COALESCE(MAX(id), 1)) FROM "ticket";`
  );

  // ── 4. Restaurar TRASLADOS ───────────────────────────────────────────────
  console.log('\nRestaurando traslados...');
  let trasladosOk = 0, trasladosSkip = 0;

  const carrerasEnBD = await prisma.carrera.findMany({ select: { id: true } });
  const carreraIds = new Set(carrerasEnBD.map((c: {id: number}) => c.id));

  const descuentosEnBD = await prisma.descuento.findMany({ select: { id: true } });
  const descuentoIds = new Set(descuentosEnBD.map((d: {id: number}) => d.id));

  const planPagoEnBD = await prisma.planPago.findMany({ select: { id: true } });
  const planPagoIds = new Set(planPagoEnBD.map((p: {id: number}) => p.id));

  const ticketsEnBD = await prisma.ticket.findMany({ select: { id: true } });
  const ticketIdsEnBD = new Set(ticketsEnBD.map((t: {id: number}) => t.id));

  for (const tr of backup.traslado ?? []) {
    if (!ticketIdsEnBD.has(tr.ticketId) || !empresaIds.has(tr.origenId)
      || !empresaIds.has(tr.destinoId) || !carreraIds.has(tr.carreraId)) {
      trasladosSkip++;
      continue;
    }

    try {
      await prisma.traslado.upsert({
        where: { id: tr.id },
        update: {},
        create: {
          id: tr.id,
          ticketId: tr.ticketId,
          folio: tr.folio,
          matricula: tr.matricula ?? '',
          alumno: tr.alumno ?? '',
          origenId: tr.origenId,
          destinoId: tr.destinoId,
          carreraId: tr.carreraId,
          descuentoId: tr.descuentoId && descuentoIds.has(tr.descuentoId) ? tr.descuentoId : null,
          bloqueId: tr.bloqueId ?? null,
          actualizacion: tr.actualizacion ?? false,
          planpagoId: tr.planpagoId && planPagoIds.has(tr.planpagoId) ? tr.planpagoId : null,
          auditor_docsId: tr.auditor_docsId && usuarioIds.has(tr.auditor_docsId) ? tr.auditor_docsId : null,
          auditor_reqId: tr.auditor_reqId && usuarioIds.has(tr.auditor_reqId) ? tr.auditor_reqId : null,
          especial: tr.especial ?? false,
          descripcion_calif: tr.descripcion_calif ?? '',
          descripcion_docs: tr.descripcion_docs ?? '',
          descripcion_edocta: tr.descripcion_edocta ?? '',
          validacion_calif: tr.validacion_calif ?? false,
          validacion_docs: tr.validacion_docs ?? false,
          validacion_edocta: tr.validacion_edocta ?? false,
          bloque_nombre: tr.bloque_nombre ?? null,
          nuevo_ingreso: tr.nuevo_ingreso ?? false,
          mail: tr.mail ?? null,
          mail_escuela: tr.mail_escuela ?? null,
          tel_movil: tr.tel_movil ?? null,
          telefono: tr.telefono ?? null,
        },
      });
      trasladosOk++;
    } catch (err: any) {
      console.warn(`  ⚠️  Traslado #${tr.id}: ${err.message?.split('\n')[0]}`);
      trasladosSkip++;
    }
  }
  console.log(`  → ${trasladosOk} restaurados, ${trasladosSkip} omitidos`);
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"traslado"', 'id'), COALESCE(MAX(id), 1)) FROM "traslado";`
  );

  // ── 5. Restaurar HISTORIAL DE SOLICITUDES ────────────────────────────────
  console.log('\nRestaurando historial de solicitudes...');
  let histOk = 0, histSkip = 0;

  const ticketsEnBD2 = await prisma.ticket.findMany({ select: { id: true } });
  const ticketIds2 = new Set(ticketsEnBD2.map((t: {id: number}) => t.id));

  for (const h of backup.historialSolicitud ?? []) {
    if (!ticketIds2.has(h.ticketId)) { histSkip++; continue; }
    try {
      await prisma.historialSolicitud.upsert({
        where: { id: h.id },
        update: {},
        create: {
          id: h.id,
          ticketId: h.ticketId,
          estatusId: h.estatusId && estatusIds.has(h.estatusId) ? h.estatusId : null,
          usuarioId: h.usuarioId && usuarioIds.has(h.usuarioId) ? h.usuarioId : null,
          fecha_cambio: new Date(h.fecha_cambio),
          comentario: h.comentario ?? null,
          archivos: h.archivos ?? undefined,
          cambios: h.cambios ?? undefined,
        },
      });
      histOk++;
    } catch (err: any) {
      console.warn(`  ⚠️  Historial #${h.id}: ${err.message?.split('\n')[0]}`);
      histSkip++;
    }
  }
  console.log(`  → ${histOk} restaurados, ${histSkip} omitidos`);
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"historial_solicitud"', 'id'), COALESCE(MAX(id), 1)) FROM "historial_solicitud";`
  );

  // ── 6. Restaurar INCIDENCIAS ─────────────────────────────────────────────
  console.log('\nRestaurando incidencias...');
  let incOk = 0, incSkip = 0;

  for (const inc of backup.incidencia ?? []) {
    if (!usuarioIds.has(inc.usuarioId)) { incSkip++; continue; }
    try {
      await prisma.incidencia.upsert({
        where: { id: inc.id },
        update: {},
        create: {
          id: inc.id,
          usuarioId: inc.usuarioId,
          mes: inc.mes,
          quincena: inc.quincena ?? null,
          fecha: new Date(inc.fecha),
          entrada_turno: inc.entrada_turno ?? null,
          salida_turno: inc.salida_turno ?? null,
          tiempo_turno: inc.tiempo_turno ?? null,
          observaciones: inc.observaciones ?? null,
          entrada_comida: inc.entrada_comida ?? null,
          salida_comida: inc.salida_comida ?? null,
          observaciones_comida: inc.observaciones_comida ?? null,
          imagen_reporte: inc.imagen_reporte ?? null,
          omitida: inc.omitida ?? false,
        },
      });
      incOk++;
    } catch (err: any) {
      console.warn(`  ⚠️  Incidencia #${inc.id}: ${err.message?.split('\n')[0]}`);
      incSkip++;
    }
  }
  console.log(`  → ${incOk} restauradas, ${incSkip} omitidas`);
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"incidencia"', 'id'), COALESCE(MAX(id), 1)) FROM "incidencia";`
  );

  // ── RESUMEN ───────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════');
  console.log('         RESUMEN FINAL');
  console.log('══════════════════════════════════');
  console.log(`Usuarios:    ${await prisma.usuario.count()}`);
  console.log(`Tickets:     ${await prisma.ticket.count()}`);
  console.log(`Traslados:   ${await prisma.traslado.count()}`);
  console.log(`Historial:   ${await prisma.historialSolicitud.count()}`);
  console.log(`Incidencias: ${await prisma.incidencia.count()}`);
  console.log('══════════════════════════════════\n');
  console.log('✅ Restauración completada exitosamente');
}

main()
  .catch(e => {
    console.error('\n❌ Error en la restauración:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
