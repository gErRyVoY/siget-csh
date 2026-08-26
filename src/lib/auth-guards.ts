import type { Session } from '@auth/core/types';

/**
 * Guardas de sesión y autorización para los handlers de `src/pages/api/**`.
 *
 * Motivo de rendimiento: el middleware ya resolvió la sesión y la dejó en
 * `context.locals.session` (`src/middleware.ts`). Cuando un handler llama otra
 * vez a `getSession(request)` paga la resolución completa por segunda vez
 * —descifrado del JWE, callback `jwt`, callback `session`— y con ella la
 * consulta de usuario. Leer `locals.session` cuesta cero.
 *
 * Motivo de seguridad: al centralizar la comprobación, `requireSection` da una
 * forma corta y uniforme de exigir permisos en los endpoints administrativos,
 * varios de los cuales hoy solo comprueban que exista sesión.
 *
 * Uso:
 *
 * ```ts
 * export const POST: APIRoute = async ({ request, locals }) => {
 *   const auth = requireSession(locals);
 *   if (auth instanceof Response) return auth;
 *   const { session, userId } = auth;
 *   ...
 * };
 * ```
 */

export type AuthContext = {
  session: Session;
  /** `session.user.id` ya convertido a número. */
  userId: number;
};

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Exige una sesión válida con un id de usuario numérico.
 * Devuelve el contexto de autenticación o la `Response` de error a propagar.
 */
export function requireSession(locals: App.Locals): AuthContext | Response {
  const session = locals.session;

  if (!session?.user?.id) {
    return jsonError('No autorizado', 401);
  }

  const userId = Number(session.user.id);
  if (!Number.isInteger(userId)) {
    return jsonError('ID de usuario inválido en la sesión.', 400);
  }

  return { session, userId };
}

/**
 * Exige una sesión válida **y** que el usuario tenga la sección indicada.
 * Devuelve 401 si no hay sesión y 403 si la hay pero sin permiso.
 */
export function requireSection(locals: App.Locals, seccion: string): AuthContext | Response {
  const auth = requireSession(locals);
  if (auth instanceof Response) return auth;

  if (!auth.session.user.secciones?.includes(seccion)) {
    return jsonError('Permisos insuficientes', 403);
  }

  return auth;
}
