import { prisma } from './db';

/**
 * Caché en memoria de los interruptores globales guardados en la tabla `seccion`.
 *
 * Motivo: `MainLayout.astro` es el layout de todas las páginas autenticadas y
 * consultaba `seccion.findUnique({ identificador: 'feature_dark_mode' })` en
 * cada render, para leer un booleano que cambia como mucho una vez al mes. Era
 * una consulta fija por página servida.
 *
 * El TTL es de 60 s, pero además `PATCH /api/admin/secciones` invalida el caché
 * al guardar, así que un cambio hecho desde /admin/secciones se ve con un F5 y
 * no hay que esperar a que expire.
 *
 * El caché es por proceso: con varias instancias de App Runner cada una tiene
 * el suyo. Degrada de forma benigna —como mucho 60 s de desfase en una
 * instancia que no atendió el PATCH— y no afecta a permisos ni a sesiones.
 */

const TTL_MS = 60_000;

type CachedFlag = { value: boolean; expiresAt: number };

const cache = new Map<string, CachedFlag>();

/**
 * Lee el flag `identificador` de la tabla `seccion`.
 *
 * Si la consulta falla se devuelve el último valor conocido, y `fallback` si no
 * hay ninguno. Es el mismo criterio conservador que tenía `MainLayout.astro`:
 * un fallo de BD no debe tumbar el render del layout.
 */
async function getFlag(identificador: string, fallback: boolean): Promise<boolean> {
  const now = Date.now();
  const cached = cache.get(identificador);

  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  try {
    const seccion = await prisma.seccion.findUnique({
      where: { identificador },
      select: { activo: true },
    });
    const value = seccion?.activo ?? fallback;
    cache.set(identificador, { value, expiresAt: now + TTL_MS });
    return value;
  } catch (error) {
    console.error(`No se pudo leer el flag '${identificador}'`, error);
    return cached?.value ?? fallback;
  }
}

/** ¿Está habilitado el modo oscuro a nivel global? */
export function isDarkModeEnabled(): Promise<boolean> {
  return getFlag('feature_dark_mode', false);
}

/**
 * Descarta el caché de flags. Debe llamarse desde cualquier endpoint que
 * modifique `seccion.activo`.
 */
export function invalidateFeatureFlags(): void {
  cache.clear();
}
