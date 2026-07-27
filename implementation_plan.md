# Optimización de Consultas de Sesión (N+1 por request)

> [!NOTE]
> **Estado:** Pendiente — postergado por el usuario. Implementar en una sesión futura.

## Problema

En cada request HTTP, `getSession()` dispara el callback `jwt` de Auth.js, que ejecuta un `prisma.usuario.findUnique` con 5 joins anidados:

```
usuario → empresa
       → rol → permisos (tabla _PermisoToRol)
             → permisos_seccion → seccion
       → permisos_seccion → seccion
```

Esto genera **7 queries por cada llamada a `getSession()`**. El problema es que `getSession()` se llama:
- Una vez en **`middleware.ts`** (para todo request)
- Una vez más en **cada `.astro` page** (vuelve a llamar `getSession`)
- Una vez más en **cada API endpoint** (mismo patrón)

**Resultado:** 14–21 queries solo para cargar la sesión por cada navegación.

## Análisis de Impacto en Permisos y Notificaciones

### ¿Afecta los cambios de permisos en `/admin/secciones`?

**✅ NO afecta.** El `WeakMap` usa el objeto `Request` como clave. Cada HTTP request genera un nuevo objeto `Request`. Por lo tanto, la caché vive **solo durante un único ciclo de request-response** y se destruye automáticamente cuando el garbage collector limpia el objeto.

- Un admin cambia permisos en `/admin/secciones` → escribe en BD
- El usuario afectado recarga cualquier página → nuevo `Request` → nueva query a BD → permisos actualizados ✅
- **El comportamiento actual (sin relogin) se preserva intacto.**

### ¿Afecta las notificaciones SSE de actualizaciones de tickets?

El endpoint SSE (`/api/notifications/sse.ts`) **NO usa `getSession()`** — lee el `userId` directamente del query param `?userId=...` enviado por el cliente. No tiene queries de sesión propias.

```typescript
// sse.ts — NO hay getSession() aquí
const userIdParam = url.searchParams.get('userId');
const userId = parseInt(userIdParam, 10);
```

**✅ Las notificaciones SSE no se ven afectadas en absoluto.**

### ¿Afecta `/api/notifications/count` y `/api/notifications/list`?

Estos sí usan `getSession()`. Son requests HTTP independientes (el cliente los llama periódicamente). Cada llamada = nuevo `Request` = sin caché entre ellas.

**✅ No afectados.** Cada polling del cliente obtiene datos frescos.

### ¿Qué sí mejoraría?

El `WeakMap` caché elimina la llamada duplicada **dentro del mismo request**:
- `middleware.ts` llama a `getSession()` → 7 queries → resultado cacheado en el WeakMap
- Luego la misma página `.astro` llama `getSession()` de nuevo → **0 queries extra** (usa caché)
- Resultado: de 14-21 queries por navegación → **7 queries** (reducción del 67%)

## Propuesta de Optimización

### Estrategia: "JWT Ligero + Locals Cache"

**Paso 1 — JWT almacena solo `userId` y datos mínimos invariables**

El callback `jwt` actualmente hace una consulta completa a la BD en cada refresh del token. La causa es que intenta mantener los datos "en tiempo real". El problema es que el JWT se refresca en cada `getSession()`.

**Nueva estrategia:** el JWT solo guarda `userId`, `rolId` y `mail` (datos que no cambian). Las secciones y permisos se reconstruyen una sola vez por request en el middleware.

**Paso 2 — Middleware reconstruye datos una vez y los guarda en `Astro.locals`**

```typescript
// middleware.ts
const session = await getSession(request);       // Solo lee el JWT (sin BD)
if (session?.user?.id) {
  const fullUser = await prisma.usuario.findUnique({...}); // UNA consulta por request
  context.locals.session = { ...session, user: { ...session.user, ...fullUser } };
}
```

**Paso 3 — Todas las páginas y APIs usan `Astro.locals.session` en lugar de `getSession()`**

Reemplazar todos los ~50 archivos que hacen `getSession(Astro.request)` por `Astro.locals.session`.

## Propuesta de Optimización

> [!IMPORTANT]
> Esto es un **cambio arquitectural** que toca ~50 archivos. El riesgo es alto.

### Alternativa más segura: Caché por Request con `WeakMap`

En lugar de cambiar la arquitectura, se puede cachear la sesión por request dentro del mismo ciclo de vida de Node.js:

```typescript
// src/lib/session-cache.ts
const requestSessionCache = new WeakMap<Request, Session>();

export async function getCachedSession(request: Request) {
  if (requestSessionCache.has(request)) {
    return requestSessionCache.get(request)!;
  }
  const session = await getSession(request);
  if (session) requestSessionCache.set(request, session);
  return session;
}
```

Esto elimina la duplicación dentro del mismo request sin cambiar ninguna firma.

### Optimización complementaria: Reducir los `includes` del JWT callback

El callback `jwt` en `auth.config.ts` recarga datos con includes en **cada verificación de token** (cada request). Podemos:
- Reemplazar `include: { rol: { include: { permisos: true, permisos_seccion: {...} } }, permisos_seccion: {...} }` 
- Por una consulta más ligera con `select` que solo traiga los campos necesarios

## Propuesta de Implementación (Fase 1 — Mínima)

### Cambios propuestos

---

### MODIFY [middleware.ts](file:///d:/Documentos/Proyectos_2025/00Humanitas/siget-csh/src/middleware.ts)
- Importar `getCachedSession` en lugar de `getSession`
- Guardar la sesión enriquecida en `context.locals.session`

### NEW [src/lib/session-cache.ts](file:///d:/Documentas/Proyectos_2025/00Humanitas/siget-csh/src/lib/session-cache.ts)
- Implementar caché por request usando `WeakMap<Request, Session>`

### MODIFY [auth.config.ts](file:///d:/Documentos/Proyectos_2025/00Humanitas/siget-csh/auth.config.ts) — JWT callback optimizado
- Cambiar `prisma.usuario.findUnique` con `include` por una versión con `select` que solo obtenga las columnas estrictamente necesarias para el token
- Esto reduce las 7 queries a **4 queries** (elimina `_PermisoToRol` que ya no se usa)

### MODIFY [~50 páginas y APIs] — Usar `Astro.locals.session`
- Reemplazar `await getSession(Astro.request)` por `Astro.locals.session`

---

## Open Questions

> [!IMPORTANT]
> **¿Qué tan importante es que los permisos se reflejen en tiempo real (sin relogin)?**
> Actualmente el `jwt` callback recarga la BD en cada request para garantizar que cambios en `/admin/secciones` se vean inmediatamente. Si aceptamos una latencia de hasta ~1 minuto, se puede cachear el JWT en servidor y eliminar el problema completamente.

> [!IMPORTANT]
> **¿Autorizamos a hacer el refactor de las ~50 páginas (Fase 2) o solo la Fase 1 (caché por request)?**
> - Fase 1 (WeakMap + select optimizado): Reduce de 14-21 queries a 7 queries por request. Bajo riesgo.
> - Fase 2 (locals completo): Reduce a 4 queries por request. Alto riesgo (muchos archivos).

## Verificación

- `npx astro check` con 0 errores
- Revisar log de consola: el bloque de 7 queries solo debe aparecer una vez por navegación
