import { defineMiddleware } from "astro:middleware";
import { getSession } from "auth-astro/server";
import type { APIContext, MiddlewareNext } from "astro";
import { perfSnapshot, perfSince } from "./lib/perf";

// Rutas públicas que no requieren autenticación.
const publicRoutes = [
  "/login",
  "/health",
];

async function handleRequest(context: APIContext, next: MiddlewareNext): Promise<Response> {
  const { pathname } = context.url;

  // Ignorar archivos estáticos y assets internos de Astro para evitar sobrecargar la BD
  if (
    pathname.startsWith("/_astro/") ||
    pathname.startsWith("/_image") ||
    pathname.match(/\.(png|jpe?g|gif|webp|svg|css|js|ico|woff2?|ttf|avif)$/)
  ) {
    return next();
  }

  // El endpoint de la API de autenticación siempre debe ser accesible.
  if (pathname.startsWith("/api/auth")) {
    return next();
  }

  // Obtenemos la sesión en cada petición.
  const session = await getSession(context.request);

  // Hacemos que la sesión esté disponible en todas las páginas y componentes.
  context.locals.session = session;

  const isPublicRoute = publicRoutes.includes(pathname);

  // Si el usuario está autenticado y trata de acceder a una ruta pública (como /login), redirigir a inicio
  if (session && isPublicRoute) {
    return context.redirect("/");
  }

  // Si la ruta es pública y no hay sesión, permitir acceso libre
  if (isPublicRoute) {
    return next();
  }

  // Si la ruta NO es pública y NO hay sesión:
  if (!session) {
    // Para endpoints de API, devolver 401 JSON en lugar de redireccionar HTML a /login
    if (pathname.startsWith("/api/")) {
      return new Response(JSON.stringify({ message: "No autorizado" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }
    // Si hay cookie de sesión pero getSession() devolvió null, la sesión fue revocada por un admin
    const hasSessionCookie =
      context.cookies.has("authjs.session-token") ||
      context.cookies.has("__Secure-authjs.session-token");
    if (hasSessionCookie) {
      return context.redirect("/login?error=SesionRevocada");
    }
    return context.redirect("/login");
  }

  // --- Lógica de Control de Acceso por Secciones (RBAC Híbrido) ---
  const userSecciones = session.user?.secciones || [];
  
  const sectionRouteMap: Record<string, string> = {
    "/tickets/soporte/nuevo-ticket-csh": "crear_ticket_csh",
    "/tickets/soporte/traslado": "proceso_traslados",
    "/tickets/marketing/nuevo-ticket-marketing": "crear_ticket_marketing",
    "/tickets/soporte/usuario": "soporte_mis_tickets",
    "/tickets/soporte": "soporte_dashboard",
    "/tickets/marketing/usuario": "marketing_mis_tickets",
    "/tickets/marketing/dashboard": "marketing_dashboard",
    "/tickets/marketing": "marketing_todos",
    "/admin/correos/crear": "admin_correos_crear",
    "/admin/correos/actualizar": "admin_correos_actualizar",
    "/admin/categorias": "admin_siget_categorias",
    "/admin/ciclos": "admin_siget_ciclos",
    "/admin/secciones": "admin_siget_secciones",
    "/admin/usuarios": "admin_siget_usuarios",
    "/admin/empresas": "admin_siget_empresas",
    "/base-de-conocimientos": "base_conocimientos",
    "/horario-de-atencion": "horario_atencion",
  };

  // Ordenar rutas por longitud descendente para buscar primero la coincidencia más específica
  const sortedRoutes = Object.keys(sectionRouteMap).sort((a, b) => b.length - a.length);

  for (const route of sortedRoutes) {
    if (pathname === route || pathname.startsWith(route + "/")) {
        const requiredSection = sectionRouteMap[route];
        
        // Si el usuario no posee la sección requerida en su sesión, denegar el acceso.
        if (!userSecciones.includes(requiredSection)) {
            // Cookie de flash: sobrevive el redirect del ClientRouter
            context.cookies.set('siget_flash_unauthorized', '1', {
                path: '/',
                maxAge: 30,
                sameSite: 'lax',
                httpOnly: false,
                secure: false,
            });
            return context.redirect("/");
        }
        break; // Coincidencia de más alta especificidad lograda
    }
  }

  const response = await next();

  // Clonar la respuesta para permitir modificación de cabeceras HTTP de seguridad
  const newResponse = new Response(response.body, response);

  newResponse.headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  newResponse.headers.set("Cross-Origin-Embedder-Policy", "unsafe-none");
  newResponse.headers.set("Referrer-Policy", "no-referrer-when-downgrade");
  newResponse.headers.set("X-Frame-Options", "SAMEORIGIN");
  newResponse.headers.set("X-Content-Type-Options", "nosniff");

  return newResponse;
}

export const onRequest = defineMiddleware(async (context, next) => {
  if (!import.meta.env.DEV) {
    return handleRequest(context, next);
  }

  // Instrumentación de línea base (solo desarrollo): expone en `Server-Timing`
  // el tiempo total de la petición y el número de sentencias SQL que emitió.
  // Permite comparar el efecto de cada optimización sin adivinar.
  const startedAt = performance.now();
  const perfStart = perfSnapshot();

  const response = await handleRequest(context, next);

  const total = performance.now() - startedAt;
  const { sql, sqlMs } = perfSince(perfStart);

  const instrumented = new Response(response.body, response);
  instrumented.headers.set(
    "Server-Timing",
    `sql;desc="${sql} queries";dur=${sqlMs.toFixed(1)}, total;dur=${total.toFixed(1)}`
  );
  return instrumented;
});
