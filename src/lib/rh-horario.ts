import { Prisma } from '@prisma/client';

/**
 * Horario laboral que SiGeT guarda en `usuario.horario_disponibilidad`.
 * Sólo aparecen los días que el trabajador labora, con horas en formato `HH:MM`.
 */
export type HorarioDisponibilidad = Record<string, { inicio: string; fin: string }>;

/**
 * Resultado de consultar el horario en la API de Recursos Humanos.
 *
 * - `ok`: RH devolvió al menos un día laborable utilizable.
 * - `sin-horario`: RH contestó, pero este trabajador no tiene turno asignado
 *   (responde HTTP 404 con `{"detail":"No se encontró un horario asignado para
 *   este trabajador."}`). Es un caso normal, no un error: hay colaboradores sin
 *   horario en la nómina.
 * - `indeterminado`: fallo de red, 5xx o respuesta con una forma inesperada. No
 *   sabemos nada, así que la BD NO se toca.
 */
export type ResultadoHorarioRH =
  | { estado: 'ok'; horario: HorarioDisponibilidad }
  | { estado: 'sin-horario' }
  | { estado: 'indeterminado'; motivo: string };

// La API numera los días 1 = lunes … 6 = sábado (no hay domingo).
const DIAS_RH: Record<string, string> = {
  '1': 'lunes',
  '2': 'martes',
  '3': 'miercoles',
  '4': 'jueves',
  '5': 'viernes',
  '6': 'sabado',
};

/**
 * ¿Este valor de `horario_disponibilidad` sirve para algo?
 *
 * Importa porque un objeto con los seis días a `null`
 * —`{"lunes":{"inicio":null,"fin":null}, …}`— es *truthy*, así que las guardas
 * escritas como `if (!user.horario_disponibilidad)` lo daban por bueno y nunca
 * volvían a consultar a RH. Esas filas existen en producción: las generó el
 * formulario de `/admin/usuarios/editar/<id>` al serializar unos `<select>`
 * deshabilitados. Para el reparto automático equivalen a no tener horario
 * (`filterBySchedule` exige `inicio` y `fin`), así que aquí cuentan como ausente.
 */
export function tieneHorarioUtil(valor: unknown): boolean {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return false;

  return Object.values(valor as Record<string, unknown>).some(dia => {
    if (!dia || typeof dia !== 'object') return false;
    const { inicio, fin } = dia as { inicio?: unknown; fin?: unknown };
    return typeof inicio === 'string' && inicio !== '' && typeof fin === 'string' && fin !== '';
  });
}

/**
 * Convierte el `dias_laborales` de RH al formato de SiGeT.
 * Las horas llegan como `"0900"` y se guardan como `"09:00"`; un día cuyo
 * `turno_normal` no traiga las cuatro cifras se omite (no se inventa un rango).
 */
export function parseDiasLaborales(diasLaborales: unknown): HorarioDisponibilidad {
  const horario: HorarioDisponibilidad = {};
  if (!diasLaborales || typeof diasLaborales !== 'object') return horario;

  const dias = diasLaborales as Record<string, { turno_normal?: { entrada?: string; salida?: string } }>;

  for (const num in DIAS_RH) {
    const turno = dias[num]?.turno_normal;
    if (!turno) continue;

    const entrada = typeof turno.entrada === 'string' ? turno.entrada.trim() : '';
    const salida = typeof turno.salida === 'string' ? turno.salida.trim() : '';
    if (entrada.length !== 4 || salida.length !== 4) continue;

    horario[DIAS_RH[num]] = {
      inicio: `${entrada.substring(0, 2)}:${entrada.substring(2)}`,
      fin: `${salida.substring(0, 2)}:${salida.substring(2)}`,
    };
  }

  return horario;
}

/**
 * Consulta el horario de un trabajador en la API de RH.
 *
 * Es la única implementación: la usan el login (`auth.config.ts`) y la ficha de
 * usuario (`/admin/usuarios/editar/<id>`), que antes tenían copias divergentes.
 */
export async function consultarHorarioRH(clave: string): Promise<ResultadoHorarioRH> {
  const baseUrl = process.env.API_RH_URL || 'https://pz3bmmqsty.us-east-1.awsapprunner.com';
  const apiKey = process.env.TOKEN_ESPERADO || 'CHURRUMAIS-1979';

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/rh/horario-trabajador?trabajador=${encodeURIComponent(clave)}`, {
      headers: { accept: 'application/json', 'x-api-key': apiKey },
    });
  } catch (error) {
    return { estado: 'indeterminado', motivo: `error de red: ${(error as Error).message}` };
  }

  // 404 es la respuesta documentada para «este trabajador no tiene horario».
  if (response.status === 404) {
    return { estado: 'sin-horario' };
  }

  if (!response.ok) {
    return { estado: 'indeterminado', motivo: `HTTP ${response.status}` };
  }

  let payload: any;
  try {
    payload = await response.json();
  } catch {
    return { estado: 'indeterminado', motivo: 'respuesta no es JSON' };
  }

  // Algunos despliegues devuelven el `detail` con 200 en lugar de 404.
  if (payload?.detail && !payload?.data) {
    return { estado: 'sin-horario' };
  }

  if (payload?.status !== 'ok' || !payload?.data?.dias_laborales) {
    return { estado: 'indeterminado', motivo: 'respuesta sin dias_laborales' };
  }

  const horario = parseDiasLaborales(payload.data.dias_laborales);

  // RH contestó bien pero ningún día tenía un turno utilizable: a efectos
  // prácticos el trabajador no tiene horario.
  if (Object.keys(horario).length === 0) {
    return { estado: 'sin-horario' };
  }

  return { estado: 'ok', horario };
}

/**
 * Valor a escribir en el campo `Json?` de Prisma. Un `null` a secas no vale:
 * Prisma exige `Prisma.DbNull` para poner NULL en la columna.
 */
export function horarioParaPrisma(horario: HorarioDisponibilidad | null) {
  return horario ?? Prisma.DbNull;
}
