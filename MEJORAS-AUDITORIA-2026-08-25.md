# Auditoría técnica SiGeT — Mejoras detectadas

**Fecha:** 2026-08-25
**Rama analizada:** `siget-apprunner-new` (working tree limpio, commit `331ebcf`)
**Alcance:** escaneo de solo lectura de todo el repositorio (`src/`, `prisma/`, `scripts/`, `.github/`, Docker, configuración raíz). **No se modificó ningún archivo de la aplicación.**

Los hallazgos están ordenados por severidad. Cada uno incluye la referencia exacta al archivo y línea, el riesgo concreto y la corrección sugerida. Nada de esto se ha aplicado todavía.

---

## 🔴 Críticos (seguridad — recomendable atender antes del siguiente despliegue)

### C1. El stream SSE confía en el `userId` que envía el cliente (IDOR)

- **Dónde:** `src/pages/api/notifications/sse.ts:12-22` y `src/layouts/MainLayout.astro:606`
- **Qué pasa:** el endpoint toma el destinatario de las notificaciones directamente del query string (`?userId=`) y nunca lo compara con la sesión. Cualquier colaborador autenticado puede abrir `/api/notifications/sse?userId=<id_ajeno>` y recibir en tiempo real las notificaciones de tickets de otra persona (incluye asunto/mensaje de tickets que no le corresponden).
- **Corrección:** derivar el `userId` de la sesión (`getSession(request)` o `locals.session`) y eliminar el parámetro. Si se quiere conservar el parámetro por retrocompatibilidad, validar `paramUserId === session.user.id` y devolver `403` en caso contrario.

### C2. Endpoints de administración sin verificación de permisos

El middleware (`src/middleware.ts:46-62`) garantiza **autenticación** para todo `/api/*`, pero la **autorización** queda en cada handler y varios no la hacen:

| Endpoint | Estado | Impacto |
|---|---|---|
| `src/pages/api/admin/ciclos/toggle.ts:4` | Sin ninguna comprobación de sesión ni sección | Cualquier usuario logueado puede activar/desactivar el ciclo escolar activo, lo que afecta traslados, dashboards y validaciones de todo el sistema |
| `src/pages/api/admin/usuarios/import-csv.ts:6` | Sin ninguna comprobación | Cualquier usuario logueado puede dar de alta usuarios masivamente vía CSV |
| ~~`src/pages/api/admin/roles/create.ts:6-11`~~ | **Resuelto (2026-08-26):** endpoint eliminado junto con la vista `/admin/roles` | — |
| ~~`src/pages/api/admin/roles/categorias.ts:6-11`~~ | **Resuelto (2026-08-26):** endpoint eliminado | — |
| ~~`src/pages/api/admin/roles/secciones.ts:6-11`~~ | **Resuelto (2026-08-26):** endpoint eliminado | — |
| `src/pages/api/admin/usuarios/secciones.ts:6-8` | Solo sesión | Modificar overrides de secciones por usuario (escalada de privilegios) |
| `src/pages/api/admin/empresa.ts:7-9` | Solo sesión | Alta/edición de campus |
| `src/pages/api/admin/categorias/index.ts:7-14` | `isAuthenticated()` solo comprueba sesión | Alta/edición/baja de categorías |
| `src/pages/api/admin/subcategories.ts:7-14` | Igual que el anterior | Alta/edición/baja de subcategorías |
| `src/pages/api/dashboard/stats.ts:4` | Sin comprobación | Fuga de métricas globales (bajo impacto, pero inconsistente) |
| `src/pages/api/tickets/check-transfer.ts:4` | Sin comprobación | Enumeración de matrículas → devuelve nombre de alumno y estatus del traslado |

- **Nota:** sí lo hacía bien `admin/secciones.ts:13` (valida `secciones.includes("admin_siget_...")`). Ese es el patrón correcto a replicar, hoy extraído a `src/lib/auth-guards.ts` (`requireSection`). Los tres endpoints de `roles/` que también lo aplicaban (`revoke-user`, `toggle-active`, `toggle-flags`) se eliminaron el 2026-08-26 con la vista `/admin/roles`.
- **Corrección propuesta:** crear un helper único, p. ej. `src/lib/auth-guards.ts`:

  ```ts
  export async function requireSection(request: Request, seccion: string) { … }  // 401 / 403 / { session, userId }
  ```

  y aplicarlo en la primera línea de cada handler administrativo. Como red de seguridad adicional, extender `sectionRouteMap` del middleware para cubrir prefijos `/api/admin/*`, de modo que un endpoint nuevo quede protegido por defecto y no por olvido.

### C3. Secreto de API embebido en el código con valor por defecto

- **Dónde:** `auth.config.ts:122` y `auth.config.ts:147` → `process.env.TOKEN_ESPERADO || 'CHURRUMAIS-1979'`; también la URL de producción del API de RH en `auth.config.ts:118`.
- **Riesgo:** el secreto compartido con el API de Recursos Humanos está en el repositorio y viaja en la imagen Docker. Cualquiera con acceso al código (o a la imagen en ECR) puede consultar datos de nómina.
- **Corrección:** eliminar los fallbacks, exigir `TOKEN_ESPERADO` y `API_RH_URL` como variables obligatorias (fallar el arranque si faltan), **rotar el token** y añadir ambas a `.env.template`.

### C4. Credenciales en archivos locales del proyecto

- **Dónde:** `Mejoras.txt` (líneas finales) contiene una API key de Google (`AIza…`), el Client ID de OAuth y el **Client Secret** (`GOCSPX-…`); además existe en disco `client_secret_656956846562-….apps.googleusercontent.com.json`.
- **Estado:** ambos **están** en `.gitignore` (líneas 25 y 43), así que **no están versionados** — el riesgo es local, no del repositorio remoto. Se verificó con `git ls-files`: el único archivo de entorno rastreado es `.env.template`.
- **Corrección:** rotar el Client Secret y la API key por precaución, mover los valores a `.env` y borrar los archivos de la carpeta del proyecto.

### C5. PDFs y CSV con información institucional sí están versionados

- **Dónde:** `git ls-files` incluye `Equipo_y_Responsables_Tickets.pdf`, `datos-tablas-siget.pdf`, `siget-db.pdf`, `trl-traslados-todos-campus.csv`, `log-events-viewer-result.csv` (496 KB de logs de CloudWatch).
- **Detalle:** la regla `*.pdf` de `.gitignore:39` no los excluye porque ya estaban rastreados cuando se añadió. Contienen estructura de base de datos, responsables por área y datos de traslados por campus.
- **Corrección:** `git rm --cached` de esos archivos y moverlos a un almacenamiento interno (Drive/S3). Si contienen datos personales, considerar reescritura de historial.

---

## 🟠 Altos (corrección funcional / operativa)

### A1. Desfase entre el mapa de rutas del middleware y el menú lateral

- **Dónde:** `src/middleware.ts:72` mapea `/tickets/soporte` → `soporte_dashboard`, pero `src/components/shared/Sidebar.astro:127-132` publica `/tickets/soporte` como **"Todos"** y lo condiciona a la sección `soporte_todos`.
- **Consecuencia:** un usuario con `soporte_todos` pero sin `soporte_dashboard` ve el enlace y es redirigido a `/` al hacer clic; a la inversa, quien tiene solo `soporte_dashboard` puede entrar al listado completo de tickets sin tener la sección "Todos". La sección `soporte_todos` **no aparece en ninguna parte del `sectionRouteMap`**.
- **Corrección:** mapear `/tickets/soporte` → `soporte_todos` (el dashboard vive en `/`) y añadir la entrada faltante. Idealmente, derivar el mapa de una única fuente compartida entre `Sidebar.astro` y `middleware.ts` para que no puedan divergir.

### A2. Llamada duplicada al Google Admin Directory API en cada login

- **Dónde:** `auth.config.ts:43-58` construye el cliente JWT y ejecuta `admin.users.get()`, y acto seguido `auth.config.ts:66-81` **repite exactamente la misma operación** dentro de un `try` interno. El resultado de la primera llamada nunca se usa.
- **Consecuencia:** duplica la latencia del login, duplica el consumo de cuota de la API de Google, y la primera llamada lanza excepción sin el manejo especial de `isTestUser` que sí tiene la segunda.
- **Corrección:** eliminar el bloque `43-58` por completo.

### A3. `prisma` registra todas las queries en producción

- **Dónde:** `src/lib/db.ts:18` → `log: ['query', 'info', 'warn', 'error']`.
- **Consecuencia:** cada consulta SQL con sus parámetros se escribe en CloudWatch. Esto infla el costo de logs y **expone datos personales** (correos, matrículas, nombres de alumnos) en los registros. Con el volumen actual de páginas server-rendered es significativo.
- **Corrección:** `log: process.env.NODE_ENV === 'production' ? ['warn', 'error'] : ['query', 'info', 'warn', 'error']`.

### A4. Doble resolución de sesión por petición (coste en BD)

- **Contexto:** el commit `6f49c3a` ya optimizó 12 páginas para reutilizar `Astro.locals.session`. Los endpoints de API todavía no.
- **Dónde:** el middleware llama `getSession()` (`src/middleware.ts:28`) y después casi todos los handlers de `src/pages/api/**` vuelven a llamar `getSession(request)`.
- **Consecuencia:** el callback `jwt` de `auth.config.ts:264-284` ejecuta un `findUnique` con 4 niveles de `include` (empresa, rol, permisos, permisos_seccion ×2). Ese query pesado corre **dos veces por cada request a la API**.
- **Corrección:** en los handlers de API usar `locals.session` (ya está tipado en `src/env.d.ts:5`) en lugar de `getSession(request)`. Es el mismo patrón que ya se aplicó a las páginas.

### A5. El estado de SSE es in-memory: se rompe al escalar horizontalmente

- **Dónde:** `src/pages/api/notifications/sse.ts:9` → `let clients: Client[] = []`.
- **Consecuencia:** con más de una instancia de App Runner, una notificación emitida en la instancia A nunca llega a los clientes conectados a la instancia B. Las notificaciones se vuelven aleatoriamente silenciosas. Hoy funciona solo porque el servicio corre con una instancia.
- **Corrección:** si se prevé escalar, mover el fan-out a Redis pub/sub (ElastiCache) o SNS. Como mínimo, documentar en el README que el servicio **debe** permanecer en una sola instancia. Detalle menor: `clientId = Date.now()` (línea 33) puede colisionar si dos clientes conectan en el mismo milisegundo — usar un contador incremental.

### A6. `check-transfer` permite enumerar alumnos

- **Dónde:** `src/pages/api/tickets/check-transfer.ts:4-45`.
- **Consecuencia:** con solo estar logueado, recorriendo matrículas se obtiene nombre del alumno, folio y estatus del traslado. No hay comprobación de sección (`proceso_traslados`) ni límite de peticiones.
- **Corrección:** exigir la sección `proceso_traslados` y añadir un límite de tasa básico por usuario.

---

## 🟡 Medios (mantenibilidad y calidad)

### M1. Cero pruebas automatizadas y sin verificación en CI

No existe ninguna suite de tests (`vitest`, `playwright`, etc.) ni configuración de lint/formato (no hay ESLint ni Prettier). El workflow `.github/workflows/deploy.yml` construye y despliega directamente: **no ejecuta `astro check` ni ninguna validación previa**.

- **Corrección mínima y de alto valor:** añadir un paso `pnpm astro check` al workflow antes del `docker build` (falla rápido y barato). Después, tests unitarios sobre la lógica que más duele si se rompe: `src/services/ticketAssignmentService.ts` (la estrategia híbrida de asignación tiene muchas ramas), `filterBySchedule()` y `src/services/cycleService.ts`.

### M2. Constantes de negocio hardcodeadas y repetidas

- `MARKETING_CATEGORY_ID = 12` está duplicado en `src/services/ticketAssignmentService.ts:7`, `src/pages/index.astro:39` y `src/pages/tickets/view/[id].astro`.
- `subcategoriaId: 58` (Traslados) hardcodeado en `src/pages/api/dashboard/stats.ts:25`.
- IDs de rol mágicos: `rolId === 2 || rolId === 3` como criterio de administrador en `src/pages/index.astro:13`, `userRolId !== 1` en `Sidebar.astro:104,109`, `defaultRoleId = 1` en `auth.config.ts:205`.
- **Consecuencia:** el sistema ya tiene RBAC por secciones y flags (`rol.administrador`, `atiende_csh`, …); mezclarlo con IDs numéricos hace que renombrar o reordenar roles rompa la autorización de forma silenciosa.
- **Corrección:** centralizar en `src/config/constants.ts` y, donde se use como criterio de permiso, sustituir el ID por el flag o la sección correspondiente.

### M3. Archivos de página desproporcionadamente grandes

| Archivo | Líneas |
|---|---|
| `src/pages/user/perfil/incidencias.astro` | 2006 |
| `src/pages/tickets/soporte/traslado.astro` | 1920 |
| `src/lib/ticket-wizard.ts` | 1639 |
| `src/pages/tickets/view/[id].astro` | 1473 |
| `src/lib/marketing-ticket-wizard.ts` | 1255 |
| `src/pages/admin/usuarios/editar/[id].astro` | 1122 |

Total: ~29 700 líneas en `src/`. Mezclan consulta a BD, markup y lógica de cliente en el mismo archivo, lo que hace difícil revisar cambios y prácticamente imposible testear.

- **Corrección:** extraer las consultas Prisma a `src/services/` (patrón que ya existe y funciona: `ticketAssignmentService`, `cycleService`, `emailService`) y el JS de cliente a `src/scripts/` (patrón ya usado: `ticket-view-logic.ts`, `user-edit-form-logic.ts`). No hace falta reescribir: aplicarlo de forma incremental cuando se toque cada archivo.
- Nota relacionada: `ticket-wizard.ts` y `marketing-ticket-wizard.ts` suman 2894 líneas con lógica muy parecida; hay margen para una base común.

### M4. Páginas de prueba desplegadas en producción

- `src/pages/test-sonner.astro` y `src/pages/lifecycle.astro` se sirven en producción (protegidas solo por autenticación, no aparecen en `sectionRouteMap`).
- `src/pages/traslados.astro` es una única imagen (`proceso-traslado.png`) y tampoco está en el mapa de secciones.
- **Corrección:** borrar las de prueba; añadir `/traslados` al `sectionRouteMap` si debe estar restringida.

### M5. Cookie de flash sin `secure` en producción

- **Dónde:** `src/middleware.ts:104` → `secure: false` fijo.
- Es una cookie no sensible (`siget_flash_unauthorized`), pero conviene `secure: import.meta.env.PROD` por consistencia con el resto de la política de cookies.

### M6. Ruido en la raíz del repositorio

Rastreados en git y sin función clara: `read_pdf.js`, `read_pdf.cjs`, `read_pdf2.js`, `read_pdf3.js`, `test-connection.ts`, `add-clave.mjs`, `build_error.log`, `gemini.txt`, `V1_GEM.md`, `Detalles_ticket_traslado.txt`, `subcategorias_seed_corregido.sql`, `apprunner.yaml.reference`, `.github/workflows/deploy.yml.reference`.

Sin rastrear pero ocupando espacio local: `.wrangler/tmp/` con **cientos** de directorios `bundle-*` (residuo de Cloudflare Workers, tecnología que el proyecto ya no usa), más `.test-deploy/`, `test-gen/`, `test-size/`, `.amplify-hosting/`.

- **Corrección:** mover los scripts útiles a `scripts/`, eliminar el resto y borrar `.wrangler/`, `.amplify-hosting/` y los directorios `test-*` del disco.

### M7. `.env.template` incompleto

`.env.template` declara 11 variables, pero el código lee además: `TOKEN_ESPERADO`, `API_RH_URL`, `GOOGLE_DRIVE_*`, `SES_FROM_EMAIL`, `SES_FROM_NAME`, `SES_REGION`, `NODE_ENV`. Un despliegue nuevo arranca con fallbacks silenciosos en lugar de fallar de forma clara.

- **Corrección:** completar la plantilla y añadir una validación de variables al arranque.

### M8. `emailService` reutiliza las credenciales de S3 para SES

- **Dónde:** `src/services/emailService.ts:5-20` usa `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` para el cliente SES, e incluso deduce "SES está configurado" a partir de `S3_BUCKET_NAME` (línea 9).
- **Consecuencia:** un mismo par de llaves para dos servicios impide aplicar el principio de mínimo privilegio y confunde el diagnóstico cuando falla el envío.
- **Corrección:** variables propias (`SES_ACCESS_KEY_ID` / `SES_SECRET_ACCESS_KEY`) y, en App Runner, preferir un IAM role de instancia en lugar de llaves estáticas.

---

## 🔵 Bajos (infraestructura y detalles)

- **B1 — Docker corre como `root`:** `Dockerfile` no define `USER`. Añadir un usuario sin privilegios (`node`) antes del `CMD`.
- **B2 — `npx prisma@6.19.1 generate` en el build** (`Dockerfile`, etapa runner): descarga el paquete en cada build en lugar de usar el `prisma` ya instalado, lo que hace el build dependiente de la red y no reproducible.
- **B3 — Sin `HEALTHCHECK` en Docker** aunque el endpoint `src/pages/health.ts` ya existe.
- **B4 — CI con llaves AWS de larga vida:** `.github/workflows/deploy.yml` usa `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`. Migrar a OIDC (`role-to-assume`) elimina los secretos permanentes. Además `aws-actions/configure-aws-credentials@v3` está desactualizado (v5 es la vigente).
- **B5 — `docker push --all-tags` empuja también `latest`,** lo que dificulta el rollback determinista. Desplegar siempre por SHA.
- **B6 — Coexisten `package-lock.json` (431 KB) y `pnpm-lock.yaml`:** el primero está en `.gitignore:36` pero sigue en disco y puede inducir a usar npm por error. Borrarlo.
- **B7 — Sin política de reintentos en el envío de correos:** `NotificacionesCorreo` tiene el estatus `Fallido` en el esquema pero no hay proceso que reintente los fallidos.
- **B8 — `logs` sin retención:** el modelo `Logs` crece indefinidamente. Definir una política de archivado.
- **B9 — Enum `Prioridad` incluye `Urgente`,** que según `Mejoras.txt` se pidió eliminar. Si la decisión está confirmada, requiere migración.

---

## Orden de trabajo sugerido

1. **Ahora:** C1 (IDOR del SSE) y C2 (guardas en endpoints admin) — son las dos con impacto real de escalada de privilegios y ambas se resuelven en pocas horas con un helper compartido.
2. **Esta semana:** C3/C4 (rotar y externalizar secretos), A2 (llamada duplicada a Google), A3 (logs de Prisma en producción), A1 (desfase de `sectionRouteMap`).
3. **Siguiente iteración:** A4 (reutilizar `locals.session` en la API), M1 (`astro check` en CI + tests de asignación), M2 (constantes), C5/M6 (limpieza del repositorio).
4. **Continuo:** M3 (dividir archivos grandes al tocarlos), A5 (decidir si SSE necesita soportar escalado).

---

## Verificaciones realizadas

- `git ls-files` sobre patrones de credenciales: solo `.env.template` está rastreado. `.env`, `client_secret*.json` y `Mejoras.txt` **no** están versionados.
- `dist/` no está versionado.
- 238 archivos rastreados; ~29 700 líneas en `src/`; 28 migraciones de Prisma (de 2025-08 a 2026-06).
- Los hallazgos C1, C2, A1 y A2 se confirmaron leyendo el código completo de cada archivo citado, no solo por búsqueda de patrones.
