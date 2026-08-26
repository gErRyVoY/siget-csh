/**
 * Instrumentación de rendimiento solo para desarrollo.
 *
 * Sirve para medir la línea base y comparar el efecto de cada optimización:
 * cuenta las sentencias SQL reales que emite Prisma (no las operaciones del
 * cliente: un `findUnique` con `include` anidados genera varias sentencias) y
 * el tiempo que pasa dentro del motor.
 *
 * El middleware toma un snapshot antes y después de `next()` y publica el delta
 * en la cabecera `Server-Timing`.
 *
 * Limitación conocida: los contadores son globales al proceso, no por petición.
 * Prisma emite el evento `query` desde el motor, fuera de la cadena de promesas
 * de la petición, así que `AsyncLocalStorage` no puede atribuirlo a su origen.
 * Para que las cifras sean exactas hay que medir con peticiones secuenciales
 * (es lo que hace `pnpm perf:baseline`); con carga concurrente el delta de una
 * petición puede incluir sentencias de otra.
 */

export type PerfSnapshot = {
  /** Sentencias SQL acumuladas en el proceso. */
  queries: number;
  /** Milisegundos acumulados dentro del motor de Prisma. */
  ms: number;
};

let totalQueries = 0;
let totalQueryMs = 0;

/** Registra una sentencia SQL emitida por Prisma. */
export function recordQuery(durationMs: number): void {
  totalQueries += 1;
  totalQueryMs += durationMs;
}

/** Lectura instantánea de los contadores. */
export function perfSnapshot(): PerfSnapshot {
  return { queries: totalQueries, ms: totalQueryMs };
}

/** Sentencias y milisegundos transcurridos desde `start`. */
export function perfSince(start: PerfSnapshot): { sql: number; sqlMs: number } {
  return {
    sql: totalQueries - start.queries,
    sqlMs: totalQueryMs - start.ms,
  };
}
