/**
 * sync-carga-actual.ts
 * Resincroniza el campo carga_actual de cada usuario con el conteo
 * real de tickets activos (no Solucionados ni Cancelados) en BD.
 *
 * Uso: npx tsx scripts/sync-carga-actual.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log(">>> Sincronizando carga_actual con tickets activos reales...\n");

  const usuariosConCarga = await prisma.usuario.findMany({
    where: { carga_actual: { gt: 0 } },
    select: { id: true, nombres: true, apellidos: true, carga_actual: true },
  });

  let corregidos = 0;
  let sinCambios = 0;

  for (const u of usuariosConCarga) {
    const ticketsActivos = await prisma.ticket.count({
      where: {
        atiendeId: u.id,
        estatus: { nombre: { notIn: ["Solucionado", "Cancelado"] } },
      },
    });

    if (ticketsActivos !== u.carga_actual) {
      console.log(`  [FIX] ${u.nombres} ${u.apellidos} (id=${u.id}): carga_actual=${u.carga_actual} -> ${ticketsActivos}`);
      await prisma.usuario.update({
        where: { id: u.id },
        data: { carga_actual: ticketsActivos },
      });
      corregidos++;
    } else {
      sinCambios++;
    }
  }

  // Tambien resetear a 0 a quienes no tienen tickets pero carga_actual = 0
  // (ya estan en cero, solo reportamos)
  console.log(`\nResumen:`);
  console.log(`  Corregidos: ${corregidos}`);
  console.log(`  Sin cambios: ${sinCambios}`);
  console.log(`\nSincronizacion completada.`);

  await prisma.$disconnect();
}

main();
