import { prisma } from './db';

/**
 * Micro-caché de la consulta de usuario que resuelve la sesión.
 *
 * El callback `jwt` de `auth.config.ts` necesita el usuario con su empresa, su
 * rol, los permisos del rol y las secciones (del rol y los overrides del
 * usuario). Prisma resuelve ese `include` anidado con una sentencia por
 * relación: entre 6 y 8 por cada `getSession()`, y `getSession()` se ejecuta al
 * menos una vez en toda petición.
 *
 * Aquí se memoriza ese resultado 15 segundos por correo. En navegación normal la
 * mayoría de peticiones pasan a costar **una** sentencia en lugar de 6-8.
 *
 * Dos garantías que el caché no relaja:
 *
 * 1. `session_version` **nunca** se sirve desde el caché. Es el mecanismo con el
 *    que un administrador revoca una sesión (cambio de rol o desactivación) y
 *    debe surtir efecto de inmediato, así que se lee siempre con una consulta
 *    mínima e indexada.
 * 2. Los endpoints que modifican roles, secciones o usuarios invalidan la entrada
 *    afectada, de modo que un cambio de permisos se ve al instante y no al
 *    expirar el TTL.
 *
 * Limitación por diseño: el caché es de proceso. Con varias instancias de App
 * Runner cada una tiene el suyo y la invalidación solo alcanza a la instancia que
 * atendió la petición; el TTL de 15 s acota la divergencia. Es una degradación
 * aceptable (a diferencia del estado en memoria de SSE, que sí se rompe al
 * escalar).
 */

const TTL_MS = 15_000;

/** Techo de entradas para que el caché no crezca sin límite en procesos longevos. */
const MAX_ENTRIES = 1_000;

async function fetchSessionUser(email: string) {
  return prisma.usuario.findUnique({
    where: { mail: email },
    include: {
      empresa: true,
      rol: {
        include: {
          permisos: true,
          permisos_seccion: {
            include: {
              seccion: true,
            },
          },
        },
      },
      permisos_seccion: {
        include: {
          seccion: true,
        },
      },
    },
  });
}

export type SessionUser = NonNullable<Awaited<ReturnType<typeof fetchSessionUser>>>;

type Entry = { user: SessionUser; expiresAt: number };

const cache = new Map<string, Entry>();

/** Poda perezosa: primero lo caducado y, si aún sobra, lo más antiguo. */
function prune(now: number): void {
  for (const [email, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(email);
  }
  // El Map conserva el orden de inserción, así que el primero es el más antiguo.
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    cache.delete(oldest.value);
  }
}

/**
 * Usuario con empresa, rol, permisos y secciones para resolver la sesión.
 * `session_version` siempre viene de la base de datos, nunca del caché.
 */
export async function getSessionUser(email: string): Promise<SessionUser | null> {
  const now = Date.now();
  const cached = cache.get(email);

  if (cached && cached.expiresAt > now) {
    // Única consulta del camino rápido: comprobar que la sesión sigue vigente.
    const current = await prisma.usuario.findUnique({
      where: { mail: email },
      select: { session_version: true },
    });

    if (!current) {
      // El usuario dejó de existir: el caché ya no es válido.
      cache.delete(email);
      return null;
    }

    return { ...cached.user, session_version: current.session_version };
  }

  const user = await fetchSessionUser(email);

  if (!user) {
    cache.delete(email);
    return null;
  }

  cache.set(email, { user, expiresAt: now + TTL_MS });
  if (cache.size > MAX_ENTRIES) prune(now);

  return user;
}

/**
 * Descarta la entrada de un usuario. Llamar desde cualquier endpoint que cambie
 * su rol, sus secciones o su estado, para que el cambio no espere al TTL.
 */
export function invalidateSessionUser(email: string): void {
  cache.delete(email);
}

/**
 * Descarta el caché completo. Para cambios que afectan a muchos usuarios a la
 * vez: permisos de un rol, secciones globales, importación masiva.
 */
export function invalidateAllSessionUsers(): void {
  cache.clear();
}
