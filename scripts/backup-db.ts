import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando respaldo de base de datos...');
  
  // Obtener timestamp actual para el nombre del archivo
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(process.cwd(), 'prisma', 'backups');
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  const backupFilePath = path.join(backupDir, `backup-${timestamp}.json`);
  
  console.log('Consultando tablas...');
  
  // Realizar consultas de forma secuencial para evitar saturar memoria/conexión
  const data = {
    empresa: await prisma.empresa.findMany(),
    ciclo: await prisma.ciclo.findMany(),
    rol: await prisma.rol.findMany(),
    seccion: await prisma.seccion.findMany(),
    usuario: await prisma.usuario.findMany(),
    oferta: await prisma.oferta.findMany(),
    carrera: await prisma.carrera.findMany(),
    bloque: await prisma.bloque.findMany(),
    descuento: await prisma.descuento.findMany(),
    estatus: await prisma.estatus.findMany(),
    categoria: await prisma.categoria.findMany(),
    subcategoria: await prisma.subcategoria.findMany(),
    subcategoriaCategorias: await prisma.subcategoriaCategorias.findMany(),
    asignacionesCategorias: await prisma.asignacionesCategorias.findMany(),
    ticket: await prisma.ticket.findMany(),
    planPago: await prisma.planPago.findMany(),
    traslado: await prisma.traslado.findMany(),
    historialSolicitud: await prisma.historialSolicitud.findMany(),
    plantillaCorreo: await prisma.plantillaCorreo.findMany(),
    notificacionesCorreo: await prisma.notificacionesCorreo.findMany(),
    permiso: await prisma.permiso.findMany(),
    permisoCategoria: await prisma.permisoCategoria.findMany(),
    permisoRolSeccion: await prisma.permisoRolSeccion.findMany(),
    permisoUsuarioSeccion: await prisma.permisoUsuarioSeccion.findMany(),
    incidencia: await prisma.incidencia.findMany(),
    logs: await prisma.logs.findMany()
  };
  
  console.log(`Escribiendo datos en: ${backupFilePath}`);
  fs.writeFileSync(backupFilePath, JSON.stringify(data, null, 2), 'utf-8');
  
  console.log('¡Respaldo de base de datos finalizado exitosamente!');
}

main()
  .catch(e => {
    console.error('Error durante el respaldo:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
