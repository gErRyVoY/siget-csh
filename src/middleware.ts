import { defineMiddleware } from "astro:middleware";
import { getSession } from "auth-astro/server";

// Rutas que no requieren autenticación. Todas las demás estarán protegidas.
const publicRoutes = [
  "/login",
  "/health",
  // Añade aquí otras rutas públicas si las hubiera, ej: /landing, /about
];

export const onRequest = defineMiddleware(async (context, next) => {

  const { pathname } = context.url;

  // El endpoint de la API de autenticación siempre debe ser accesible.
  if (pathname.startsWith("/api/auth")) {
    return next();
  }

  // Obtenemos la sesión en cada petición.
  const session = await getSession(context.request);

  // Hacemos que la sesión esté disponible en todas las páginas y componentes.
  context.locals.session = session;

  // Verificamos si la ruta actual es pública.
  const isPublicRoute = publicRoutes.includes(pathname);

  // Si el usuario está autenticado y trata de acceder a una ruta pública (como /login),
  // lo redirigimos a la página de inicio.
  if (session && isPublicRoute) {
    return context.redirect("/");
  }

  // Si la ruta es pública, permitimos el acceso sin importar la sesión.
  if (isPublicRoute) {
    return next();
  }

  // Si la ruta NO es pública y NO hay sesión, redirigimos al login.
  if (!session) {
    return context.redirect("/login");
  }

  // --- Lógica de Control de Acceso (RBAC) ---
  const userSecciones = session.user?.secciones || [];
  
  // Mapa de rutas a seciones necesarias.
  // El orden no importa tanto, pero verificaremos buscando la ruta más específica.
  const sectionRouteMap: Record<string, string> = {
    "/tickets/soporte/nuevo-ticket-csh": "crear_ticket_csh",
    "/tickets/soporte/traslado": "proceso_traslados",
    "/tickets/marketing/nuevo": "crear_ticket_marketing",
    "/tickets/soporte/usuario": "soporte_mis_tickets",
    "/tickets/soporte": "soporte_dashboard", // Podría ser soporte_todos o soporte_dashboard dependiendo de qué es /tickets/soporte index, pero asumimos que requiere soporte_dashboard
    "/tickets/marketing/usuario": "marketing_mis_tickets",
    "/tickets/marketing/dashboard": "marketing_dashboard",
    "/tickets/marketing": "marketing_todos",
    "/admin/correos/crear": "admin_correos_crear",
    "/admin/correos/actualizar": "admin_correos_actualizar",
    "/admin/categorias": "admin_siget_categorias",
    "/admin/ciclos": "admin_siget_ciclos",
    "/admin/secciones": "admin_siget_secciones",
    "/admin/tickets": "admin_siget_tickets",
    "/admin/usuarios": "admin_siget_usuarios",
  };

  // Convert map to array sorted by path length descending to match most specific path first.
  const sortedRoutes = Object.keys(sectionRouteMap).sort((a, b) => b.length - a.length);

  // Buscar coincidencia en la ruta
  for (const route of sortedRoutes) {
    if (pathname.startsWith(route)) {
        const requiredSection = sectionRouteMap[route];
        
        // Si el usuario no tiene la sección en su JWT, denegar el acceso.
        // Esto también captura el caso en donde la sección esté apagada globalmente 
        // porque auth.config.ts ya omite las inhabilitadas globalmente.
        if (!userSecciones.includes(requiredSection)) {
             return context.redirect("/?unauthorized=true");
        }
        break; // Detener la verificación porque logramos el match más específico
    }
  }


  // Si todo está en orden (ruta protegida y con sesión), continuamos.
  // Si todo está en orden (ruta protegida y con sesión), continuamos.
  // Si todo está en orden (ruta protegida y con sesión), continuamos.
  const response = await next();

  // Clone response to ensure it's mutable (fixes immutable errors with redirects)
  const newResponse = new Response(response.body, response);

  newResponse.headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  newResponse.headers.set("Cross-Origin-Embedder-Policy", "unsafe-none");
  newResponse.headers.set("Referrer-Policy", "no-referrer-when-downgrade");

  return newResponse;
});
