/**
 * Cuentas de prueba y de servicio: existen en SiGeT pero **no** son colaboradores
 * de la nómina, así que el login las trata aparte.
 *
 * Para estos correos se omiten las tres comprobaciones externas de `signIn`
 * (`auth.config.ts`):
 *   1. Google Admin Directory (`admin.users.get`), cuyo único uso es sacar la OU.
 *   2. La validación de la OU (`colaboradores` / `early adopters`).
 *   3. La API de RH: `consultar-trabajador` y `horario-trabajador`.
 *
 * Sin esta lista no podrían entrar: RH responde `404 {"detail":"No se encontró
 * registro para el correo: …"}` para ambas, y `signIn` traduce ese fallo a
 * `/login?error=ColaboradorNoActivo`.
 *
 * Contrapartida: su fila debe existir ya en la base de datos, porque el alta
 * automática de `signIn` deriva el campus de la OU y sin ella daría
 * `error=ErrorOU`. Tampoco tendrán horario: RH no les asigna turno, así que
 * `horario_disponibilidad` se queda en `NULL` («No disponible»).
 */
export const TEST_USER_EMAILS = [
  'alumno.prueba1@humanitas.edu.mx',
  // Buzón del Centro de Soporte (usuario 4). Tiene `clave` en SiGeT, pero RH no
  // conoce el correo, así que no se le puede consultar nada.
  'soporte@humanitas.edu.mx',
] as const;

export function isTestUserEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return (TEST_USER_EMAILS as readonly string[]).includes(email.trim().toLowerCase());
}
