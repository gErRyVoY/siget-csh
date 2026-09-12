import { prisma } from './db';

/**
 * Configuración del periodo de traslados, con caché en memoria.
 *
 * Es la única fuente de verdad para cuatro cosas:
 *
 *   1. Si la sección `proceso_traslados` (la vista `/tickets/soporte/traslado`)
 *      se ve o no. Lo aplica el callback `jwt` de `auth.config.ts`, que recalcula
 *      `token.secciones` en cada petición: quitarla de ahí apaga a la vez el
 *      enlace del sidebar y el acceso a la ruta en `src/middleware.ts`, sin cron
 *      ni escrituras programadas.
 *   2. Si Campus Virtual sigue admitiéndose como campus destino.
 *   3. A qué ciclo pertenecen los traslados que se creen.
 *   4. Si la ficha de «Traslados activos» aparece en los dashboards.
 *
 * El TTL es de 60 s —el mismo criterio que `src/lib/feature-flags.ts`— y
 * `PUT /api/admin/traslados` invalida el caché al guardar, así que un cambio
 * hecho desde `/admin/traslados` se ve con un F5. Como el callback `jwt` corre en
 * cada petición, el caché es lo que hace que esto no cueste dos consultas por
 * request.
 *
 * El caché es por proceso: con varias instancias de App Runner cada una tiene el
 * suyo, y como mucho hay 60 s de desfase en la instancia que no atendió el PUT.
 */

const TTL_MS = 60_000;

/**
 * El contenedor de producción corre en UTC (el Dockerfile no define `TZ`) y los
 * usuarios están en México, que desde 2022 no aplica horario de verano: UTC-6
 * fijo todo el año. Sin esto, un periodo que termina el 15 de octubre se cerraría
 * a las 17:59 hora de México en lugar de a medianoche.
 */
const OFFSET_CDMX_MS = 6 * 60 * 60 * 1000;

/** Nº de ciclos por año escolar: 2026-1 … 2026-4, luego 2027-1. */
const PERIODOS_POR_ANIO = 4;

export type CicloResumen = {
    id: number;
    ciclo: string;
    fecha_inicio: Date;
    fecha_fin: Date;
};

export type EstadoTraslados = {
    fechaInicio: Date | null;
    fechaFin: Date | null;
    fechaFinVirtual: Date | null;
    /** Ciclo fijado a mano en `/admin/traslados`. `null` = modo automático. */
    cicloFijado: CicloResumen | null;
    /** Ciclo activo hoy según sus fechas, sin escribir en la BD. */
    cicloActivo: CicloResumen | null;
    /** Ciclo al que pertenecen los traslados: el fijado, o el siguiente al activo. */
    cicloDestino: CicloResumen | null;
    /**
     * Etiqueta del ciclo que tocaría según la mecánica (activo 2027-1 → 2027-2),
     * incluso si ese ciclo todavía no existe en `/admin/ciclos`.
     */
    etiquetaCicloSugerido: string | null;
    /** `true` mientras el instante actual cae dentro del periodo configurado. */
    periodoAbierto: boolean;
    /** `true` mientras Campus Virtual siga admitiéndose como destino. */
    virtualPermitido: boolean;
    actualizadoPorId: number | null;
    updatedAt: Date | null;
};

/** Estado con los traslados cerrados: el que se usa si no hay configuración. */
const ESTADO_CERRADO: EstadoTraslados = {
    fechaInicio: null,
    fechaFin: null,
    fechaFinVirtual: null,
    cicloFijado: null,
    cicloActivo: null,
    cicloDestino: null,
    etiquetaCicloSugerido: null,
    periodoAbierto: false,
    virtualPermitido: false,
    actualizadoPorId: null,
    updatedAt: null,
};

type CachedEstado = { estado: EstadoTraslados; expiresAt: number };

let cache: CachedEstado | null = null;

/**
 * `"2026-10-15"` → instante de las 00:00:00.000 en CDMX.
 * Devuelve `null` si la cadena no es una fecha ISO válida.
 */
export function inicioDeDiaCDMX(fechaISO: string): Date | null {
    const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaISO.trim());
    if (!partes) return null;
    const [, y, m, d] = partes;
    const utc = Date.UTC(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0);
    const fecha = new Date(utc + OFFSET_CDMX_MS);
    // Rechaza fechas imposibles («2026-02-31») que Date.UTC normalizaría.
    if (fechaISOCDMX(fecha) !== fechaISO.trim()) return null;
    return fecha;
}

/** `"2026-10-15"` → instante de las 23:59:59.999 en CDMX. */
export function finDeDiaCDMX(fechaISO: string): Date | null {
    const inicio = inicioDeDiaCDMX(fechaISO);
    if (!inicio) return null;
    return new Date(inicio.getTime() + 24 * 60 * 60 * 1000 - 1);
}

/** Instante → día civil en CDMX (`"2026-10-15"`), listo para un `<input type="date">`. */
export function fechaISOCDMX(fecha: Date): string {
    return new Date(fecha.getTime() - OFFSET_CDMX_MS).toISOString().slice(0, 10);
}

/**
 * `"2027-1"` → `"2027-2"`, `"2026-4"` → `"2027-1"`.
 * Devuelve `null` si la etiqueta no sigue el formato `AAAA-N`.
 */
export function siguienteEtiquetaCiclo(etiqueta: string): string | null {
    const partes = /^(\d{4})-(\d{1,2})$/.exec(etiqueta.trim());
    if (!partes) return null;
    const anio = Number(partes[1]);
    const periodo = Number(partes[2]);
    if (periodo < 1 || periodo > PERIODOS_POR_ANIO) return null;
    return periodo === PERIODOS_POR_ANIO ? `${anio + 1}-1` : `${anio}-${periodo + 1}`;
}

function resolverEstado(
    config: {
        fecha_inicio_traslados: Date | null;
        fecha_fin_traslados: Date | null;
        fecha_fin_trl_virtual: Date | null;
        cicloId: number | null;
        actualizado_porId: number | null;
        updatedAt: Date;
    } | null,
    ciclos: CicloResumen[],
    ahora: Date
): EstadoTraslados {
    if (!config) return ESTADO_CERRADO;

    // El ciclo activo se deduce de las fechas, igual que en `ensureActiveCycle`,
    // pero sin escribir: este módulo se lee desde el callback `jwt`.
    const cicloActivo =
        ciclos.find((c) => c.fecha_inicio <= ahora && c.fecha_fin >= ahora) ?? null;

    // «El siguiente» es el próximo por calendario, no `id + 1`: así no se rompe si
    // los ciclos se dan de alta desordenados en `/admin/ciclos`.
    const cicloSiguiente = cicloActivo
        ? ciclos.find((c) => c.fecha_inicio > cicloActivo.fecha_inicio) ?? null
        : null;

    const cicloFijado = config.cicloId
        ? ciclos.find((c) => c.id === config.cicloId) ?? null
        : null;

    const { fecha_inicio_traslados: inicio, fecha_fin_traslados: fin } = config;
    const periodoAbierto = Boolean(inicio && fin && inicio <= ahora && ahora <= fin);

    return {
        fechaInicio: inicio,
        fechaFin: fin,
        fechaFinVirtual: config.fecha_fin_trl_virtual,
        cicloFijado,
        cicloActivo,
        cicloDestino: cicloFijado ?? cicloSiguiente,
        etiquetaCicloSugerido: cicloActivo ? siguienteEtiquetaCiclo(cicloActivo.ciclo) : null,
        periodoAbierto,
        virtualPermitido:
            periodoAbierto &&
            (!config.fecha_fin_trl_virtual || ahora <= config.fecha_fin_trl_virtual),
        actualizadoPorId: config.actualizado_porId,
        updatedAt: config.updatedAt,
    };
}

/**
 * Estado actual del periodo de traslados.
 *
 * Si la consulta falla se devuelve el último valor conocido y, si no hay ninguno,
 * el estado cerrado: ante un fallo de BD los traslados quedan ocultos, que es el
 * comportamiento por defecto pedido.
 */
export async function getEstadoTraslados(): Promise<EstadoTraslados> {
    const now = Date.now();
    if (cache && cache.expiresAt > now) return cache.estado;

    try {
        // La tabla `ciclo` tiene un puñado de filas, así que traerlas todas y
        // resolver en memoria sale más barato que tres consultas correlacionadas.
        const [config, ciclos] = await Promise.all([
            prisma.configuracionTraslados.findFirst({ orderBy: { id: 'asc' } }),
            prisma.ciclo.findMany({
                orderBy: { fecha_inicio: 'asc' },
                select: { id: true, ciclo: true, fecha_inicio: true, fecha_fin: true },
            }),
        ]);

        const estado = resolverEstado(config, ciclos, new Date(now));
        cache = { estado, expiresAt: now + TTL_MS };
        return estado;
    } catch (error) {
        console.error('No se pudo leer la configuración de traslados', error);
        return cache?.estado ?? ESTADO_CERRADO;
    }
}

/**
 * Descarta el caché. Debe llamarse desde cualquier endpoint que modifique
 * `configuracion_traslados` o la tabla `ciclo`.
 */
export function invalidateTrasladosConfig(): void {
    cache = null;
}
