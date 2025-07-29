import { defineMiddleware } from "astro:middleware";
import { getSession } from "auth-astro/server";

// Rutas que no requieren autenticación. Todas las demás estarán protegidas.
const publicRoutes = [
  "/login",
  // Añade aquí otras rutas públicas si las hubiera, ej: /landing, /about
];

export const onRequest = defineMiddleware(async (context, next) => {
  // VALIDACIÓN DEL SECRETO DE PRUEBA
  console.log("Mensaje de depuración:", process.env.DEBUG_MESSAGE);
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

  // Si todo está en orden (ruta protegida y con sesión), continuamos.
  return next();
});
