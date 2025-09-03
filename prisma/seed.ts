import { PrismaClient, TipoEmpresa, NivelSoporte, Prioridad } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log(`Start seeding ...`);

  // --- Limpiar datos existentes ---
  console.log('Cleaning existing data...');
  await prisma.subcategoriaCategorias.deleteMany({});
  await prisma.subcategoria.deleteMany({});
  await prisma.categoria.deleteMany({});
  await prisma.estatus.deleteMany({});
  await prisma.descuento.deleteMany({});
  await prisma.carrera.deleteMany({});
  await prisma.oferta.deleteMany({});
  await prisma.rol.deleteMany({});
  await prisma.empresa.deleteMany({});
  
  // --- Insertar Empresas ---
  console.log('Seeding empresa...');
  await prisma.empresa.createMany({
    data: [
      { id: 1, nombre: 'Cancún', slug: 'cancun', tipo: 'Magno' },
      { id: 2, nombre: 'Chihuahua', slug: 'chihuahua', tipo: 'Magno' },
      { id: 3, nombre: 'Cuernavaca', slug: 'cuernavaca', tipo: 'Social' },
      { id: 4, nombre: 'Del Valle', slug: 'del-valle', tipo: 'Magno' },
      { id: 5, nombre: 'Guadalajara', slug: 'guadalajara', tipo: 'Ejecutivo' },
      { id: 6, nombre: 'Mérida', slug: 'merida', tipo: 'Magno' },
      { id: 7, nombre: 'Monterrey', slug: 'monterrey', tipo: 'Ejecutivo' },
      { id: 8, nombre: 'Presa Madín', slug: 'presa-madin', tipo: 'Magno' },
      { id: 9, nombre: 'Querétaro', slug: 'queretaro', tipo: 'Magno' },
      { id: 10, nombre: 'Reyes', slug: 'reyes', tipo: 'Magno' },
      { id: 11, nombre: 'Santa Fe', slug: 'santa-fe', tipo: 'Ejecutivo' },
      { id: 12, nombre: 'Tijuana', slug: 'tijuana', tipo: 'Magno' },
      { id: 13, nombre: 'Virtual', slug: 'virtual', tipo: 'Ejecutivo' },
      { id: 14, nombre: 'Corporativo', slug: 'corporativo', tipo: 'Oficina' },
      { id: 15, nombre: 'CSH', slug: 'csh', tipo: 'Oficina' },
    ],
  });

  // --- Insertar Roles ---
  console.log('Seeding rol...');
  await prisma.rol.createMany({
    data: [
      { id: 1, rol: 'Director CSH', descripcion: 'Director del Centro de Soporte', nivel_soporte: 'S_3' },
      { id: 2, rol: 'Ingeniero soporte 1', descripcion: 'Ingeniero de soporte nivel 1', nivel_soporte: 'S_1' },
      { id: 3, rol: 'Ingeniero soporte 2', descripcion: 'Ingeniero de soporte nivel 2', nivel_soporte: 'S_2' },
      { id: 4, rol: 'Ingeniero soporte 3', descripcion: 'Ingeniero de soporte nivel 3', nivel_soporte: 'S_3' },
      { id: 5, rol: 'Auditor CSH', descripcion: 'Auditor del centro de soporte', nivel_soporte: 'S_1' },
      { id: 6, rol: 'Desarrollador', descripcion: 'Desarrollador de aplicaciones', nivel_soporte: 'Desarrollador' },
      { id: 7, rol: 'Director campus', descripcion: 'Director de campus', nivel_soporte: 'S_1' },
      { id: 8, rol: 'Coordinador RR.PP.', descripcion: 'Coordinador de relaciones públicas', nivel_soporte: 'S_1' },
      { id: 9, rol: 'Ejecutivo RR.PP.', descripcion: 'Ejecutivo de relaciones públicas', nivel_soporte: 'S_1' },
      { id: 10, rol: 'Contador', descripcion: 'Contador', nivel_soporte: 'Contador' },
      { id: 11, rol: 'Director Marketing', descripcion: 'Director de Marketing', nivel_soporte: 'Marketing' },
      { id: 12, rol: 'Diseñador', descripcion: 'Diseñador gráfico (Marketing)', nivel_soporte: 'Marketing' },
      { id: 13, rol: 'Community manager', descripcion: 'Ejecutivo de atención en redes sociales', nivel_soporte: 'Marketing' },
      { id: 14, rol: 'Visitante', descripcion: 'Visitante', nivel_soporte: 'S_1' },
      { id: 15, rol: 'Visitante administrador', descripcion: 'Visitante administrador', nivel_soporte: 'S_1' },
    ],
  });

  // --- Insertar Oferta ---
  console.log('Seeding oferta...');
  await prisma.oferta.createMany({
    data: [
        { id: 1, descripcion: 'Licenciatura Ejecutiva' },
        { id: 2, descripcion: 'Licenciatura Escolarizada' },
        { id: 3, descripcion: 'Maestría' },
        { id: 4, descripcion: 'Doctorado' },
        { id: 5, descripcion: 'Diplomado' },
        { id: 6, descripcion: 'Idioma' },
    ],
  });

  // --- Insertar Descuento ---
  console.log('Seeding descuento...');
  await prisma.descuento.createMany({
    data: [
        { id: 13, descripcion: 'Beca 50', monto: 50, activo: true },
        { id: 14, descripcion: 'Beca Colab.', monto: 100, activo: true },
        { id: 15, descripcion: 'Convenio', monto: 10, activo: true },
        { id: 16, descripcion: 'Desc.Esp.', monto: 0, activo: true },
    ],
  });

  // --- Insertar Estatus ---
  console.log('Seeding estatus...');
  await prisma.estatus.createMany({
    data: [
        { id: 1, nombre: 'Nuevo', descripcion: 'Ticket nuevo en el sistema y asignado' },
        { id: 2, nombre: 'En espera', descripcion: 'El ticket está siendo atendido' },
        { id: 3, nombre: 'Solucionado', descripcion: 'Ticket cerrado' },
        { id: 4, nombre: 'Cancelado', descripcion: 'Ticket cancelado' },
        { id: 5, nombre: 'Duplicado', descripcion: 'Solicitud duplicada' },
        { id: 6, nombre: 'Revisión CSH', descripcion: 'Traslado: Revisión CSH' },
        { id: 7, nombre: 'Revisión campus origen', descripcion: 'Traslado en revisión por campus origen' },
        { id: 8, nombre: 'Información campus destino', descripcion: 'Traslado en espera de información de campus destino' },
        { id: 9, nombre: 'Confirmación alumno', descripcion: 'Traslado en espera de confirmación del alumno' },
    ],
  });

  // --- Insertar Categoria ---
  console.log('Seeding categoria...');
  await prisma.categoria.createMany({
    data: [
        { id: 1, nombre: 'Alumno', nivel_soporte_requerido: 'S_1', activo: true },
        { id: 2, nombre: 'Aspirante', nivel_soporte_requerido: 'S_1', activo: true },
        { id: 3, nombre: 'Colaborador', nivel_soporte_requerido: 'S_2', activo: true },
        { id: 4, nombre: 'Docente', nivel_soporte_requerido: 'S_2', activo: true },
        { id: 5, nombre: 'Plataforma Humanitas', nivel_soporte_requerido: 'S_2', activo: true },
        { id: 6, nombre: 'App Humanitas', nivel_soporte_requerido: 'S_2', activo: true },
        { id: 7, nombre: 'Canvas', nivel_soporte_requerido: 'S_2', activo: true },
        { id: 8, nombre: 'Hubspot', nivel_soporte_requerido: 'S_2', activo: true },
        { id: 9, nombre: 'Atom', nivel_soporte_requerido: 'S_2', activo: true },
        { id: 10, nombre: 'Página web', nivel_soporte_requerido: 'Desarrollador', activo: true },
        { id: 11, nombre: 'Otro', nivel_soporte_requerido: 'S_1', activo: true },
    ],
  });

  // --- Insertar Carrera ---
  console.log('Seeding carrera...');
  await prisma.carrera.createMany({
    data: [
        { id: 1, clave: 'LAC', descripcion: 'Administración', ofertaId: 1, activo: true },
        { id: 2, clave: 'LACE', descripcion: 'Administración', ofertaId: 2, activo: true },
        { id: 3, clave: 'LARE', descripcion: 'Arquitectura', ofertaId: 2, activo: true },
        { id: 4, clave: 'LCPAP', descripcion: 'Ciencias Políticas y Administración Pública', ofertaId: 1, activo: true },
        { id: 5, clave: 'LECPA', descripcion: 'Ciencias Políticas y Administración Pública', ofertaId: 2, activo: true },
        { id: 6, clave: 'LAC', descripcion: 'Contabilidad', ofertaId: 1, activo: true },
        { id: 7, clave: 'LACE', descripcion: 'Contabilidad', ofertaId: 2, activo: true },
        { id: 8, clave: 'LD', descripcion: 'Derecho', ofertaId: 1, activo: true },
        { id: 9, clave: 'LDE', descripcion: 'Derecho', ofertaId: 2, activo: true },
        { id: 10, clave: 'LDGE', descripcion: 'Diseño Gráfico', ofertaId: 2, activo: true },
        { id: 11, clave: 'LICED', descripcion: 'Educación', ofertaId: 1, activo: true },
        { id: 12, clave: 'LEED', descripcion: 'Educación', ofertaId: 2, activo: true },
        { id: 13, clave: 'LPS', descripcion: 'Psicología', ofertaId: 1, activo: true },
        { id: 14, clave: 'LPSE', descripcion: 'Psicología', ofertaId: 2, activo: true },
        { id: 15, clave: 'LATE', descripcion: 'Arte y Teatro', ofertaId: 2, activo: true },
        { id: 16, clave: 'MADEE', descripcion: 'Alta Dirección Corporativa', ofertaId: 3, activo: true },
        { id: 17, clave: 'MCEI', descripcion: 'Contabilidad e Impuestos', ofertaId: 3, activo: true },
        { id: 18, clave: 'MDEC', descripcion: 'Derecho Corporativo', ofertaId: 3, activo: true },
        { id: 19, clave: 'MDFI', descripcion: 'Derecho Fiscal', ofertaId: 3, activo: true },
        { id: 20, clave: 'MDP', descripcion: 'Derecho Penal', ofertaId: 3, activo: true },
        { id: 21, clave: 'MAED', descripcion: 'Educación', ofertaId: 3, activo: true },
        { id: 22, clave: 'MJPSP', descripcion: 'Justicia Penal y Seguridad Pública', ofertaId: 3, activo: true },
        { id: 23, clave: 'MMER', descripcion: 'Mercadotecnia', ofertaId: 3, activo: true },
        { id: 24, clave: 'MTPS8', descripcion: 'Psicoterapia con un Enfoque Psicoanalítico', ofertaId: 3, activo: true },
        { id: 25, clave: 'DOCAD', descripcion: 'Alta Dirección', ofertaId: 4, activo: true },
        { id: 26, clave: 'DOCDE', descripcion: 'Derecho', ofertaId: 4, activo: true },
        { id: 27, clave: 'DOCED', descripcion: 'Educación', ofertaId: 4, activo: true },
        { id: 28, clave: 'DIP11', descripcion: 'Diplomado en Bases de Administración y Principios Contables', ofertaId: 5, activo: true },
        { id: 29, clave: 'DIP01', descripcion: 'Diplomado en Criminología', ofertaId: 5, activo: true },
        { id: 30, clave: 'DIP02', descripcion: 'Diplomado en Juicios Orales', ofertaId: 5, activo: true },
        { id: 31, clave: 'DIP09', descripcion: 'Diplomado en Perfiles Criminales', ofertaId: 5, activo: true },
        { id: 32, clave: 'DIP04', descripcion: 'Diplomado en Tanatología', ofertaId: 5, activo: true },
        { id: 33, clave: 'DIP03', descripcion: 'Seminario de Introducción a la Psicoterapia Psicoanalítica en Niños', ofertaId: 5, activo: true },
        { id: 34, clave: 'DIP05', descripcion: 'Seminario de Introducción al Psicoanálisis', ofertaId: 5, activo: true },
        { id: 35, clave: 'DIP06', descripcion: 'Seminario de Reflexiones Psicoanalíticas sobre el Cuerpo, la Anorexia y la Obesidad', ofertaId: 5, activo: true },
        { id: 36, clave: 'ISEMI', descripcion: 'English Kingdom', ofertaId: 6, activo: true },
    ],
  });

  console.log(`Seeding finished.`);
}

main()
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
