import { defineMiddleware } from "astro:middleware";
import { getSession } from "auth-astro/server";
import type { APIContext, MiddlewareNext } from "astro";
import { perfSnapshot, perfSince } from "./lib/perf";

// Rutas públicas que no requieren autenticación.
const publicRoutes = [
  "/login",
  "/health",
];

// Tipos que vale la pena comprimir. Se excluye a propósito `text/event-stream`:
// el SSE de notificaciones necesita que cada evento salga al cliente en cuanto se
// escribe, y un flujo gzip lo retendría en el búfer del compresor.
const COMPRESIBLES =
  /^(text\/html|text\/plain|text\/css|text\/javascript|application\/json|application\/javascript|application\/xml|image\/svg\+xml)/;

// Por debajo de ~1 KB el encabezado gzip y el coste de CPU no se pagan solos.
const MINIMO_COMPRIMIBLE = 1024;

/**
 * Comprime la respuesta con gzip cuando el cliente lo acepta.
 *
 * Nota de alcance: en producción (`@astrojs/node` standalone) los assets de
 * `/_astro/*` y `public/*` los sirve el manejador de estáticos **antes** de que
 * corra este middleware, así que aquí sólo se comprime el HTML de SSR y el JSON
 * de la API — que es la mayor parte de los bytes de una navegación. Comprimir
 * también los assets requiere un CDN delante (ver PERF-BASELINE.md, 3.3).
 */
async function comprimir(request: Request, response: Response): Promise<Response> {
  if (!response.body) return response;
  if (response.status === 204 || response.status === 304) return response;
  if (response.headers.has("Content-Encoding")) return response;

  const tipo = response.headers.get("Content-Type") ?? "";
  if (!COMPRESIBLES.test(tipo)) return response;

  if (!/\bgzip\b/i.test(request.headers.get("Accept-Encoding") ?? "")) return response;

  const declarado = Number(response.headers.get("Content-Length"));
  if (Number.isFinite(declarado) && declarado > 0 && declarado < MINIMO_COMPRIMIBLE) return response;

  // Las respuestas de SSR no traen Content-Length, así que el umbral se decide
  // leyendo el principio del cuerpo: se acumula hasta 1 KB y, si el flujo termina
  // ahí, se devuelve tal cual. Sin esto, gzip *engorda* las respuestas pequeñas
  // (el JSON de /health son 74 bytes y comprimido 91) y quema CPU de la única
  // vCPU en cada carga de página. El resto se sigue enviando en streaming.
  const lector = response.body.getReader();
  // El cast acota `ArrayBufferLike` a `ArrayBuffer`: en Node los trozos nunca
  // vienen respaldados por un SharedArrayBuffer, que es el otro caso del tipo.
  const trozos: Uint8Array<ArrayBuffer>[] = [];
  let acumulado = 0;
  let terminado = false;
  while (acumulado < MINIMO_COMPRIMIBLE) {
    const { value, done } = await lector.read();
    if (done) {
      terminado = true;
      break;
    }
    if (value) {
      trozos.push(value as Uint8Array<ArrayBuffer>);
      acumulado += value.byteLength;
    }
  }

  if (terminado && acumulado < MINIMO_COMPRIMIBLE) {
    lector.releaseLock();
    return new Response(concatenar(trozos, acumulado), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  const cuerpo = new ReadableStream<BufferSource>({
    start(controller) {
      for (const trozo of trozos) controller.enqueue(trozo);
      if (terminado) controller.close();
    },
    async pull(controller) {
      const { value, done } = await lector.read();
      if (done) {
        controller.close();
        return;
      }
      if (value) controller.enqueue(value);
    },
    cancel(reason) {
      return lector.cancel(reason);
    },
  });

  const headers = new Headers(response.headers);
  headers.set("Content-Encoding", "gzip");
  // El tamaño cambia y deja de conocerse de antemano: Node responde en chunked.
  headers.delete("Content-Length");
  const vary = headers.get("Vary") ?? "";
  if (!/accept-encoding/i.test(vary)) {
    headers.set("Vary", vary ? `${vary}, Accept-Encoding` : "Accept-Encoding");
  }

  return new Response(cuerpo.pipeThrough(new CompressionStream("gzip")), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function concatenar(trozos: Uint8Array<ArrayBuffer>[], total: number): ArrayBuffer {
  const salida = new Uint8Array(new ArrayBuffer(total));
  let offset = 0;
  for (const trozo of trozos) {
    salida.set(trozo, offset);
    offset += trozo.byteLength;
  }
  return salida.buffer;
}

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

  // El health check de App Runner corre cada 5 s (≈17 000 peticiones al día) y no
  // necesita sesión: atravesar el handler completo de Auth.js para responder un
  // JSON fijo es trabajo tirado. Va antes de `getSession()` a propósito.
  // Efecto colateral conocido: con una cookie de sesión válida `/health` ya no
  // redirige a `/`, responde el health check igual que para un anónimo.
  if (pathname === "/health") {
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

  // Denegación uniforme: cookie de flash (sobrevive el redirect del ClientRouter) y
  // vuelta al inicio. "/" no puede protegerse, así que siempre es un destino válido.
  const denegarAcceso = () => {
    context.cookies.set('siget_flash_unauthorized', '1', {
      path: '/',
      maxAge: 30,
      sameSite: 'lax',
      httpOnly: false,
      secure: false,
    });
    return context.redirect("/");
  };

  const sectionRouteMap: Record<string, string> = {
    "/tickets/soporte/nuevo-ticket-csh": "crear_ticket_csh",
    "/tickets/soporte/traslado": "proceso_traslados",
    "/tickets/marketing/nuevo-ticket-marketing": "crear_ticket_marketing",
    "/tickets/soporte/usuario": "soporte_mis_tickets",
    // "Todos" de soporte. Antes pedía soporte_dashboard, que es la sección del Dashboard
    // (el enlace del Sidebar a "/"), no la de esta vista: un usuario con soporte_dashboard
    // y sin soporte_todos no veía el enlace "Todos" pero entraba escribiendo la URL. El
    // equivalente de marketing (/tickets/marketing → marketing_todos) siempre estuvo bien.
    // "/" no puede protegerse aquí porque es el destino del redirect al denegar acceso.
    "/tickets/soporte": "soporte_todos",
    "/tickets/marketing/usuario": "marketing_mis_tickets",
    "/tickets/marketing/dashboard": "marketing_dashboard",
    "/tickets/marketing": "marketing_todos",
    "/admin/correos/crear": "admin_correos_crear",
    "/admin/correos/actualizar": "admin_correos_actualizar",
    "/admin/categorias": "admin_siget_categorias",
    "/admin/ciclos": "admin_siget_ciclos",
    "/admin/secciones": "admin_siget_secciones",
    "/admin/traslados": "admin_siget_traslados",
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
            return denegarAcceso();
        }
        break; // Coincidencia de más alta especificidad lograda
    }
  }

  // --- Flags de alta de tickets, además de la sección ---
  // Las dos vistas de alta exigen también la casilla "puede abrir tickets" de la ficha
  // del usuario (/admin/usuarios/editar/<id>), no solo la sección. Es la misma regla que
  // el Sidebar usa para mostrar cada enlace (`src/components/shared/Sidebar.astro:64`
  // y `:66`) y que `/api/tickets/create` exige al recibir el POST. Sin esto la sección
  // bastaba para entrar escribiendo la URL, y el formulario terminaba en un 403 al
  // enviarlo: las tres roles tienen `crear_ticket_marketing`, así que la restricción
  // real de marketing es el flag.
  const flagRouteMap: Record<string, "tckt_csh" | "tckt_mkt"> = {
    "/tickets/soporte/nuevo-ticket-csh": "tckt_csh",
    "/tickets/marketing/nuevo-ticket-marketing": "tckt_mkt",
  };

  for (const route of Object.keys(flagRouteMap)) {
    if (pathname === route || pathname.startsWith(route + "/")) {
      if (session.user?.[flagRouteMap[route]] !== true) {
        return denegarAcceso();
      }
      break;
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
    return comprimir(context.request, await handleRequest(context, next));
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
  return comprimir(context.request, instrumented);
});
