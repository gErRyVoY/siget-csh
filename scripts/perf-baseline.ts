/**
 * Mide la línea base de rendimiento del servidor en local.
 *
 * Emite una cookie de sesión válida (firmada con AUTH_SECRET) para un usuario de
 * la BD de desarrollo y pide un conjunto de rutas al servidor `astro dev`,
 * leyendo la cabecera `Server-Timing` que añade el middleware en modo DEV.
 *
 * Uso:
 *   pnpm perf:baseline                                  # elige un usuario con permisos amplios
 *   pnpm perf:baseline -- --email alguien@humanitas.edu.mx
 *   pnpm perf:baseline -- --base http://localhost:4321 --runs 3
 *   pnpm perf:baseline -- --ticket 22,25          # tickets concretos de detalle
 *
 * IMPORTANTE: apuntar siempre a una BD de desarrollo, nunca a RDS de producción.
 */
import { encode } from '@auth/core/jwt';
import { prisma } from '../src/lib/db';

type Timing = { sql: number; sqlMs: number; totalMs: number };

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name: string, fallback?: string) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
  };
  return {
    email: get('email'),
    base: get('base', 'http://localhost:4321')!,
    runs: Number(get('runs', '3')),
    // Lista de ids separados por coma. Sin esto se mide el ticket más reciente
    // del usuario, que puede no ser el mismo entre mediciones: un traslado carga
    // bastante más que un ticket normal y las cifras no serían comparables.
    tickets: get('ticket')?.split(',').map((t) => Number(t.trim())).filter((n) => Number.isFinite(n)),
  };
}

/** Lee `sql;desc="N queries";dur=X, total;dur=Y` de la cabecera Server-Timing. */
function parseServerTiming(header: string | null): Timing | null {
  if (!header) return null;
  const sql = header.match(/sql;desc="(\d+) queries";dur=([\d.]+)/);
  const total = header.match(/total;dur=([\d.]+)/);
  if (!sql || !total) return null;
  return {
    sql: Number(sql[1]),
    sqlMs: Number(sql[2]),
    totalMs: Number(total[1]),
  };
}

async function pickUser(email?: string) {
  if (email) {
    const user = await prisma.usuario.findUnique({ where: { mail: email } });
    if (!user) throw new Error(`No existe el usuario ${email} en esta BD.`);
    return user;
  }
  // Sin --email: el usuario activo con más secciones asignadas vía rol, para que
  // las rutas protegidas no acaben en redirect y la medición sea representativa.
  const user = await prisma.usuario.findFirst({
    where: { activo: true, rol: { permisos_seccion: { some: { activo: true } } } },
    orderBy: { id: 'asc' },
  });
  if (!user) throw new Error('No se encontró ningún usuario activo con secciones.');
  return user;
}

async function main() {
  const { email, base, runs, tickets } = parseArgs();
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('Falta AUTH_SECRET en el entorno.');

  const user = await pickUser(email);

  // Tickets reales para medir la ruta de detalle: los de --ticket si se pasan, y
  // si no el más reciente del usuario.
  let ticketIds = tickets ?? [];
  if (ticketIds.length === 0) {
    const ticket = await prisma.ticket.findFirst({
      where: { OR: [{ solicitanteId: user.id }, { atiendeId: user.id }] },
      orderBy: { id: 'desc' },
      select: { id: true },
    });
    if (ticket) ticketIds = [ticket.id];
  }

  // El salt de @auth/core es el nombre de la cookie; en http (dev) va sin prefijo.
  const cookieName = 'authjs.session-token';
  const token = await encode({
    token: {
      name: `${user.nombres} ${user.apellidos}`,
      email: user.mail,
      sub: String(user.id),
    },
    secret,
    salt: cookieName,
    maxAge: 60 * 60,
  });

  const routes = [
    '/health',
    '/health@anon',
    '/',
    '/tickets/soporte',
    '/tickets/soporte/usuario',
    '/tickets/marketing',
    '/api/notifications/count',
    // Solo las páginas admin que el usuario de la medición puede abrir. Si no
    // tiene la sección, el middleware responde 302 antes de renderizar y la
    // fila no mide nada.
    '/admin/secciones',
    '/admin/categorias',
    ...ticketIds.map((id) => `/tickets/view/${id}`),
  ];

  console.log(`Usuario: ${user.mail} (id ${user.id})`);
  console.log(`Servidor: ${base} · ${runs} pasada(s) por ruta\n`);
  console.log('ruta'.padEnd(34), 'estado'.padEnd(8), 'sql'.padStart(5), 'sql ms'.padStart(9), 'total ms'.padStart(10));
  console.log('-'.repeat(70));

  for (const route of routes) {
    // El sufijo `@anon` mide la misma ruta sin cookie de sesión.
    const anonymous = route.endsWith('@anon');
    const path = anonymous ? route.slice(0, -'@anon'.length) : route;

    const samples: Timing[] = [];
    let status = 0;

    // Una pasada de calentamiento que no se contabiliza: en `astro dev` el primer
    // render de cada ruta incluye la compilación bajo demanda.
    for (let i = 0; i <= runs; i++) {
      const res = await fetch(`${base}${path}`, {
        headers: anonymous ? {} : { cookie: `${cookieName}=${token}` },
        redirect: 'manual',
      });
      await res.arrayBuffer(); // agotar el cuerpo para no dejar sockets abiertos
      status = res.status;
      const timing = parseServerTiming(res.headers.get('server-timing'));
      if (timing && i > 0) samples.push(timing);
    }

    if (samples.length === 0) {
      console.log(route.padEnd(34), String(status).padEnd(8), 'sin Server-Timing (¿servidor en modo producción?)');
      continue;
    }

    // Mínimo, no mediana: los contadores de Prisma son globales al proceso, así
    // que cualquier petición concurrente (SSE, una pestaña abierta) solo puede
    // sumar sentencias. El mínimo de varias pasadas es la cota limpia.
    const min = (values: number[]) => Math.min(...values);

    console.log(
      route.padEnd(34),
      String(status).padEnd(8),
      String(min(samples.map((s) => s.sql))).padStart(5),
      min(samples.map((s) => s.sqlMs)).toFixed(1).padStart(9),
      min(samples.map((s) => s.totalMs)).toFixed(1).padStart(10)
    );
  }

  console.log('\nNotas:');
  console.log('- Cerrar las pestañas del navegador sobre este servidor antes de medir:');
  console.log('  el stream SSE y el sondeo de notificaciones inflan los contadores.');
  console.log('- En `astro dev` el "total ms" incluye compilación bajo demanda; el número');
  console.log('  comparable entre fases es la cuenta de sentencias SQL.');
}

main()
  .catch((error) => {
    console.error('\nError:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
