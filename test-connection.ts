import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("=== Probando conexion a la Base de Datos Restaurada ===");
  try {
    const totalUsuarios = await prisma.usuario.count();
    const totalTickets = await prisma.ticket.count();
    const totalTraslados = await prisma.traslado.count();
    const totalIncidencias = await prisma.incidencia.count();

    console.log("Conexion exitosa!");
    console.log(`- Total de Usuarios: ${totalUsuarios}`);
    console.log(`- Total de Tickets: ${totalTickets}`);
    console.log(`- Total de Traslados: ${totalTraslados}`);
    console.log(`- Total de Incidencias: ${totalIncidencias}`);

    if (totalTickets > 0 || totalTraslados > 0) {
      console.log("\n[OK] La base de datos contiene registros anteriores restaurados exitosamente!");
    } else {
      console.log("\n[WARNING] La conexion funciona, pero la base de datos parece estar vacia de datos historicos.");
    }
  } catch (error) {
    console.error("Error de conexion o consulta a la base de datos:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
