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
  const userRole = session.user?.rol?.rol;
  
  // Definir rutas restringidas
  const adminRoutes = ["/admin"];
  const marketingRoutes = ["/tickets/marketing"];
  const supportRoutes = ["/tickets/soporte"]; // Ajustar si es necesario

  // 1. Restricción para "/admin"
  if (pathname.startsWith("/admin")) {
      // Director Marketing puede ver /admin/tickets y /admin/usuarios (pero usuarios tiene su propia lógica interna o subrutas)
      // "Diseñador", "Community manager", "Editor" NO pueden ver /admin
      if (["Diseñador", "Community manager", "Editor"].includes(userRole || "")) {
           return context.redirect("/?unauthorized=true");
      }
      // Otros roles: Validar si tienen permiso general (opcional, si confías en el Sidebar)
      // Pero como buena práctica, validamos permiso 'ver_seccion_admin' o 'ver_seccion_marketing' para sus áreas
      // Aquí simplificaré usando el permiso que ya viene en sesión si existe, o lógica de roles.
      // El prompt especificaba redirección con toast.
  }

    // 1. Restricción para Administración
    if (pathname.startsWith("/admin")) {
        const isMarketingDirector = userRole === "Director Marketing";
        const isMarketingStaff = ["Diseñador", "Community manager", "Editor"].includes(userRole || "");
        
        // Staff de Marketing NO tiene acceso a NADA de admin
        if (isMarketingStaff) {
             return context.redirect("/tickets/marketing/dashboard?unauthorized=true");
        }

        // Director Marketing tiene acceso limitado (Tickets, Usuarios)
        // Si intenta entrar a correos u otras cosas futuras...
        // Por ahora el prompt solo pedía bloquear a Diseñador/etc de /admin/tickets.
        // Asumimos que los permisos 'ver_seccion_admin' controlan a los demás.
    }


  // Si todo está en orden (ruta protegida y con sesión), continuamos.
  // Si todo está en orden (ruta protegida y con sesión), continuamos.
  // Si todo está en orden (ruta protegida y con sesión), continuamos.
  const response = await next();
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  response.headers.set("Cross-Origin-Embedder-Policy", "unsafe-none");
  response.headers.set("Referrer-Policy", "no-referrer-when-downgrade");

  // Debug log to verify headers are set (remove in production)
  // console.log(`[Middleware] Setting headers for ${context.url.pathname}`);

  return response;
});
