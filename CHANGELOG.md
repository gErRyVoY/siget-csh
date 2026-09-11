# Changelog - SiGeT V2.0

> [!WARNING]
> **Flujo de Despliegue (CI/CD):** No se deben realizar dos `git push` seguidos al repositorio. El último fallará debido al tiempo que le toma a AWS App Runner procesar y completar el despliegue automático del commit previo. Se debe hacer **un solo `git push`** cuando sea solicitado y esperar a que finalice la compilación/despliegue en curso.

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Versionado Semántico](https://semver.org/lang/es/).

## 2026-09-11 (Separación de los Circuitos de Marketing y Soporte, y Auditoría de Tablas y Columnas sin Uso)

### UX: Marketing Deja de Aparecer en el Alta de Soporte (`/tickets/soporte/nuevo-ticket-csh`)
*   **Motivo**: Marketing tiene su propia vista de alta (`/tickets/marketing/nuevo-ticket-marketing`), con sus subcategorías, sus agentes y su dashboard. Ofrecerla también en el asistente de CSH permitía crear un ticket de marketing por la puerta equivocada.
*   **Filtrado en la Consulta, no en el Cliente**: `where: { activo: true, id: { not: MARKETING_CATEGORY_ID } }`. El árbol de categorías se serializa completo dentro del HTML (`<script id="categories-data">`), así que ocultarlo con CSS o en JS habría dejado las subcategorías de Marketing viajando en cada carga. El selector pasa de 12 a 11 categorías.
*   **Sin Efectos Colaterales**: `src/scripts/init-nuevo-ticket-wizard.ts` consume ese JSON de forma genérica, sin ningún id ni nombre de categoría cableado.

### Security: Autorización de Alta por Categoría en `/api/tickets/create`
*   **Hueco Cerrado**: El endpoint solo comprobaba que existiera sesión, de modo que cualquier usuario autenticado podía crear un ticket en cualquier categoría sin tener la sección ni el flag correspondientes.
*   **Un Endpoint, Dos Circuitos**: Los dos asistentes hacen POST al mismo `/api/tickets/create` (`src/lib/ticket-wizard.ts:1312` y `src/lib/marketing-ticket-wizard.ts:857`), así que rechazar `categoriaId: 12` a secas habría roto el alta de marketing. La categoría por sí sola no dice de dónde viene la petición, y el `Referer` sería tan falsificable como el propio `categoriaId`: la restricción tiene que ser de autorización.
*   **Regla Aplicada**: la misma que el Sidebar usa para mostrar cada enlace (`Sidebar.astro:64` y `:66`) — Marketing exige `tckt_mkt` + sección `crear_ticket_marketing`; el resto, `tckt_csh` + `crear_ticket_csh`. Si no se cumple, **403**. El callback `jwt` recarga flags y secciones en cada petición (`auth.config.ts:265`, caché de 15 s), así que una cookie antigua no puede colarse con valores obsoletos.
*   **Verificado Contra Datos Reales**: los 3 tickets de marketing existentes los creó gente con `tckt_mkt = true`, y ningún ticket no-marketing viene de un usuario con `tckt_csh = false` (los 100 usuarios lo tienen en `true`). Ningún alta histórica habría sido rechazada.

### Security: La Vista de Alta de Marketing Exige el Flag, no Solo la Sección (`src/middleware.ts`)
*   **Comportamiento Anterior**: El middleware protegía las rutas **solo por sección**, y las tres roles tienen `crear_ticket_marketing`, así que los **90 usuarios con `tckt_mkt = false`** podían abrir `/tickets/marketing/nuevo-ticket-marketing` escribiendo la URL. El Sidebar no les mostraba el enlace, pero el alta se completaba.
*   **Nuevo `flagRouteMap`**: Segunda pasada tras el mapa de secciones que exige la casilla "puede abrir tickets" de la ficha del usuario para las dos vistas de alta (`tckt_csh` y `tckt_mkt`). La denegación usa la misma cookie de flash y el mismo redirect a `/` que la denegación por sección, así que el usuario ve el aviso habitual de "no autorizado". Se extrajo `denegarAcceso()` para no duplicar ese bloque.
*   **Orden de Evaluación Resultante**: sección global → override de usuario → rol → flag.
*   **Botón que Quedaba Colgando**: La tarjeta "Levantar ticket / Marketing" de `/tickets/marketing/dashboard` era una segunda entrada, visible para todo admin. Ahora se pinta con la misma condición. Afectaba a un usuario real: **Haide Herrera** (id 2, rol admin, `tckt_mkt = false`), para quien esa tarjeta era la única entrada visible al alta de marketing; en lugar de fallar al pulsarla, desaparece.
*   **`tckt_csh` Incluido por Simetría**: hoy es `true` en los 100 usuarios, así que no cambia nada para nadie, pero deja las dos vistas bajo la misma regla en vez de tratar Marketing como caso especial. Los cinco enlaces al alta de CSH se dejaron sin condicionar por el mismo motivo.

### Refactor: `MARKETING_CATEGORY_ID` Centralizado en `src/config/ticket-categories.ts`
*   **Problema**: El literal `12` estaba repetido en **once** archivos (servicio de asignación, las cuatro listas, los dos dashboards, el detalle de ticket y las dos vistas de alta, esta última con su propio `const catId = 12`). Un cambio de id habría dejado media aplicación mirando a la categoría equivocada. Corresponde al hallazgo de la línea 117 de `MEJORAS-AUDITORIA-2026-08-25.md`.
*   **Módulo Nuevo**: exporta `MARKETING_CATEGORY_ID`, los identificadores de sección `MARKETING_CREATE_SECTION` / `CSH_CREATE_SECTION` y el helper `isMarketingCategory()`. Queda **una declaración y once importadores**.
*   **Verificación**: `pnpm astro check` 0 errores / 0 warnings en 161 archivos y `pnpm build` completo.

### Auditoría: Tablas y Columnas sin Uso Tras la Actualización de Roles
Barrido con conteo de filas y de valores distintos por columna vía `information_schema`, más búsqueda de lectores y escritores en `src/`, `auth.config.ts`, `scripts/` y `prisma/seed.ts`. **No se aplicó ningún cambio de esquema**; queda como inventario para decidir.

*   **Tablas muertas**: `bloque` (0 filas, sin un solo `prisma.bloque`; el formulario usa opciones fijas de `form-options.ts:28` y guarda texto en `bloque_nombre`; `traslado.bloqueId` es NULL en las 9 filas y `transfer.ts:183` lo escribe así explícitamente; es también el único consumidor del enum `Grado`). `permiso` + `_PermisoToRol` (4 filas de catálogo, 0 vínculos, se cargan en cada resolución de sesión y su único consumidor es el `canViewAllTickets` de `Sidebar.astro:62`, que se calcula y no se usa). `logs` (634 filas, escritas por 4 endpoints, nunca leídas). `notificaciones_correo` (write-only; `estatus` siempre `Enviado` y `mensaje_error` siempre NULL, o sea que la rama de fallo no escribe).
*   **Columnas sin lector**: `rol.ticket_csh`, `rol.ticket_mkt`, `rol.traslados`, `rol.generales` — residuo directo de la actualización de roles, solo las escribe el seed; el acceso se resuelve por `seccion` + `permiso_rol_seccion` + `permiso_usuario_seccion`. **Ojo**: los homónimos del usuario (`usuario.tckt_csh` / `tckt_mkt`) **sí están vivos** y son la base de las restricciones de esta misma fecha. También `usuario.trl_coord`, `usuario.trl_mail`, `traslado.actualizacion`, `incidencia.imagen_reporte` y los dos `nivel_soporte_requerido` (viajan al navegador y nadie los evalúa).
*   **Cableado pero inerte**: `permiso_categoria` tiene 92 filas con `activo = false` en todas, contra tres consultas `activo: true` en `ticketAssignmentService.ts`. El nivel de asignación **por rol** nunca entra: un agente solo puede recibir una categoría que tenga explícitamente en `asignaciones_categorias`. Parece intencionado (`scripts/enforce-victor-exclusive-cats.ts` desactiva esas filas y las 92 comparten `updatedAt`), pero conviene confirmarlo.
*   **Inconsistencia de secciones**: `seccion` id 10 `plataforma_humanitas` está **activa y no gobierna nada** — sin referencias en `src/`, y `<PlataformaHumanitas />` se renderiza sin condición en `Sidebar.astro:327`. Apagar esa sección no tiene ningún efecto visible.
*   **Páginas sobrantes**: `src/pages/lifecycle.astro` (8 líneas) y `src/pages/test-sonner.astro` (232) no están enlazadas desde ningún sitio, pero cualquier usuario con sesión puede abrirlas por URL.

## 2026-09-02 (Check de Múltiple Identificador, Resolución de Campus por Slug y Estatus Automático Indebido al Crear Ticket)

### Feature: Check "Múltiple matrícula / folio / email / clave" (`/tickets/soporte/nuevo-ticket-csh`)
*   **Un Ticket para Varios Afectados**: Nuevo checkbox entre la fila de Campus/Identificador/Nombre completo y el textarea de detalles. Al activarlo se deshabilitan y limpian **Matrícula/Folio/Email/Clave** y **Nombre completo**, dejan de ser requeridos para el envío y no se persisten en la BD (`afectado_clave` y `afectado_nombre` quedan en `null` aunque el cliente los mande).
*   **Label Dinámico por Categoría**: El texto cambia según la categoría seleccionada — 1 Alumno → "Múltiple matrícula", 2 Aspirante → "Múltiple folio", 3 Colaborador → "Múltiple email", 4 Docente → "Múltiple clave".
*   **Aviso Contextual**: Mensaje en color `secondary` a la derecha del check recordando adjuntar un archivo con todos los identificadores o pegarlos en la descripción.
*   **Interacción con Campos de Solo Lectura**: `applyMultipleClaveState()` es idempotente y calcula el estilo *muted* como `active || afectadoNombre.readOnly`, de modo que activar y desactivar el check no destruye el estilo de un campo que ya era de solo lectura.

### Fix: Error 400 "El campo Campus contiene caracteres inválidos" con Campus Acentuados
*   **Causa Raíz**: `src/pages/api/tickets/create.ts` validaba el campus con `/^[a-zA-Z0-9\s]+$/`, que rechaza los nombres reales de la BD: **Cancún**, **Mérida**, **Presa Madín** y **Querétaro**. El defecto era previo a los cambios de esta fecha.
*   **Solución — Validar contra la BD, no contra un regex**: El formulario ahora envía `afectado_campus_slug` (el `slug` único de `Empresa`, sin acentos) en un `data-slug` de cada `<option>` más un hidden para el caso de campus fijo, y el endpoint resuelve la empresa con `findFirst({ where: { slug, activa: true } })`, con fallback al nombre (`mode: 'insensitive'`) por compatibilidad con clientes que aún no envíen el slug. Se eliminó el filtro de caracteres.
*   **Fallback Silencioso Convertido en Error Explícito**: Un campus que no corresponde a una empresa activa ahora devuelve 400 en lugar de caer sin aviso a la empresa de la sesión.
*   **Nota de Diseño**: El `value` del `<select>` sigue siendo el **nombre** del campus porque es lo que espera la API de RH de alumnos y aspirantes (`consultar-detalle?campus=...`); el slug viaja aparte.

### Fix: Estatus "En progreso" Asignado Automáticamente al Crear un Ticket con Adjuntos
*   **Registros Analizados** (ticket 31, BD de producción — la única que hay): creado `18:38:05.110` con `estatusId: 2` ("Nuevo"), y una única entrada de `historial_solicitud` (id 70) a las `18:38:13.384` — 8.3 s después — con `usuarioId: 1` (superadmin), comentario `"Archivos adjuntos en creación."` y `cambios: { fieldChanges: [{ field: "estatusId", oldValue: "Nuevo", newValue: "En progreso" }] }`.
*   **Causa Raíz**: Los wizards cierran el alta con un `PATCH /api/tickets/update` para adjuntar los archivos ya subidos a S3. Ese PATCH viaja con la sesión del creador y no incluye `estatusId`, así que disparaba la regla de `update.ts` que promueve un ticket "Nuevo" a "En progreso" cuando lo toca un usuario privilegiado. Solo se reproducía si el creador era admin/superadmin **y** el ticket llevaba al menos un adjunto (sin archivos no hay PATCH).
*   **Solución**: Los dos wizards (`src/lib/ticket-wizard.ts` y `src/lib/marketing-ticket-wizard.ts`) marcan ese PATCH con `origen: "creacion"`, y `update.ts` lo desestructura fuera de `updateDataInput` y añade `!esPatchDeCreacion` a la condición de la transición automática. Los PATCH reales de resolutores desde `view/[id].astro` y `traslado.astro` no envían `origen`, por lo que conservan el comportamiento anterior.

### Fix: `Ticket.fechaact` Nunca se Actualizaba
*   **Causa Raíz**: `fechaact` estaba declarada como `@default(now())` **sin** `@updatedAt` y ningún endpoint la escribía, de modo que en el ticket 31 seguía siendo idéntica a `fechaalta` tras la actualización. Las notificaciones (`api/notifications/count.ts` y `list.ts`) ordenan por `fechaact desc`, así que reflejaban la fecha de alta en lugar del último movimiento.
*   **Solución**: `@updatedAt` en `prisma/schema.prisma`. Es un atributo a nivel de Prisma Client: `prisma migrate diff` confirma que **no genera cambios de DDL**, por lo que no requiere migración, solo `prisma generate`. Los tickets existentes conservan su `fechaact` hasta su próxima actualización.
*   **Verificación**: `npx astro check` 0 errores / 0 warnings en 157 archivos y `pnpm build` completo.

## 2026-09-01 (Días Invisibles en el Reporte de Incidencias: Nueva Categoría "Salida Anticipada" y Aviso de Días Omitidos)

### Fix: Días con Salida Anticipada que Desaparecían del Reporte (`/user/perfil/incidencias`)
*   **Causa Raíz Identificada**: La vista evaluaba la salida real contra el horario **solo cuando era posterior** a la hora de fin (`diffSalida > 5` → "Tiempo adicional"). Si el colaborador salía **antes** de su hora, ninguna rama activaba `showRow = true`, por lo que el día no generaba fila, no se guardaba y no aparecía en el correo: el tiempo pendiente quedaba invisible tanto para el colaborador como para el Director del CSH. Caso reportado por Rogelio Elizalde López en el reporte de Agosto 2026 (viernes 28, salida `17:02` contra fin `18:00`), donde además quedaban ocultos los días 11, 12, 18 y 27.
*   **Nueva Categoría "Salida anticipada" con Motivo Obligatorio**: Simétrica al retardo de entrada y con la misma tolerancia de 5 minutos. Si la salida real es más de 5 min anterior al fin del turno, el día se renderiza en rojo (`#ca1c1c`) con los minutos faltantes, exige justificación (`requiresObs = true`, validación existente de mínimo 5 caracteres) y registra `tiempo_turno` negativo.
*   **Caso Combinado Retardo + Salida Anticipada**: Los minutos de ambos conceptos se acumulan en un único faltante (`tiempoTurno = -(minsRetardo + minsSalidaAntes)`) y la columna de estatus muestra las dos etiquetas apiladas.
*   **Compensación por Entrada Anticipada**: Si el colaborador entró antes de su hora y aun así salió temprano, los minutos a favor se descuentan del faltante y se muestran como reposición parcial.
*   **Colores Consistentes en las Tres Superficies**: Salida en rojo en la tabla de resultados, en la celda `SL` del calendario de la vista previa del correo y en el modal "Ver tabla".

### Fix: Aviso de Días Omitidos por Horario No Configurado
*   **Comportamiento Anterior**: Los días cuyo día de la semana no existe en `horario_disponibilidad` se descartaban **en silencio** (`return` sin rastro). Un colaborador con sábados sin configurar perdía todos sus sábados del reporte —incluidas las inasistencias— sin ninguna señal en pantalla.
*   **Recuadro de Advertencia**: Se acumulan los días descartados (excluyendo domingos) y se renderiza un aviso ámbar encima de los resultados listando día y nombre del día, con enlace directo a `/user/perfil` para corregir el horario. Se muestra en ambas ramas: con resultados y sin incidencias encontradas.

### Fix: Paridad entre la Vista Previa y el Correo Real (`/api/user/incidencias/send-report`)
*   **Celda del Calendario**: La celda `SL` de un día con salida anticipada pasa a rojo con fondo de "Justificar" y marca `dayHasProblem = true`, de modo que el día ya no se cuenta como "A tiempo" en la leyenda del correo.
*   **Lista Textual por Día**: Nueva línea `Salida anticipada N minutos.` en rojo, con orden fijo **Justificar → Salida anticipada → Tiempo adicional → Motivo**, y el día deja de caer en la rama `Sin incidencias.`.
*   **Verificación**: `npx astro check` 0 errores / 0 warnings en 157 archivos y `pnpm build` completo.

### Auditoría: Horarios Inválidos en Cuentas Admin/Superadmin
*   Revisión de los 10 usuarios con acceso a la vista. Tres requieren corrección de datos desde el perfil (no es un defecto de código): **Haide Herrera** (sin `clave` de RH y horario nulo, no puede generar reporte), **Jair Flores Téllez** (los seis días con `inicio`/`fin` en `null`, bloqueado por la validación del formulario) y **Victor Barrera** (sin sábado configurado, sus sábados nunca aparecían). El aviso de días omitidos hace visible el tercer caso.

## 2026-08-25 (Permisos Granulares en Traslados, Autoguardado de Incidencias y Replicación Global de Google Drive)

### UX & Security: Permisos Granulares de Edición en Detalle de Traslados (`/tickets/view/[id]`)
*   **Restricción de Edición en Campo "Atiende"**: Select bloqueado para administradores cuando el ticket no está asignado a ellos mismos; Superadministrador conserva permisos totales de reasignación.
*   **Campus Origen Dinámico**: Lógica condicional según `tckt_virtual` y si el origen es Campus Físico o Virtual (dropdown restringido con opciones permitidas).
*   **Campos de Alumno y Carrera Protegidos**: `Nombre del alumno`, `Carrera` y `Escolarizada` (checkbox) bloqueados contra modificaciones manuales arbitrarias.
*   **Matrícula Reactiva con Consulta en Tiempo Real**: Al tipear se limpian los datos asociados y al perder foco (`blur`) o presionar `Enter` se consulta la API de alumnos para autocompletar nombre, carrera, estatus escolarizado y filtrar bloques.
*   **Corrección de Historial Fantasma & Detección de Cambios**: Normalización de valor `bloque_nombre` (`null` vs `"0"`) en backend (`/api/tickets/update.ts`). Se retorna `hasNewHistoryEntry` para mostrar `toast.info("No se detectaron cambios para guardar.")` y evitar añadir `&new_entry=true` cuando no se registraron modificaciones reales.

### Feature & Storage: Replicación de Google Drive y Popover "Consulta lo que puedes añadir"
*   **Popover Informativo Estandarizado**: Se incorporó el botón flotante `"Consulta lo que puedes añadir"` con modal emergente responsivo detallando límites y formatos (Archivos hasta 5MB, Google Workspace, hasta 5 videos de Drive y hasta 5 carpetas de Drive) en `nuevo-ticket-csh.astro`, `nuevo-ticket-marketing.astro` y la sección de comentarios de `view/[id].astro`.
*   **Normalización de Inicialización de Drive**: Unificada la carga de librerías mediante `gapi.load('picker', ...)` en `traslado.astro`.

### UX & Data Protection: Autoguardado de Borrador en Reporte de Incidencias (`/user/perfil/incidencias`)
*   **Persistencia en `localStorage`**: Guardado reactivo en tiempo real de toggles de asistencia, tipo de inasistencia y comentarios por día bajo la clave `siget_incidencias_draft_{userId}_{mes}_{anio}`.
*   **Modal de Recuperación al Ingresar**: Modal flotante "¿Deseas recuperar los datos insertados anteriormente?" con opciones para restaurar la captura previa o descartarla.
*   **Limpieza Automática y Alerta de Salida**: Borrador eliminado al guardar/enviar satisfactoriamente y activación de confirmación de salida nativa (`window.beforeunload`).

## 2026-08-24 (Integración Global de Google Drive, Múltiples Recursos y Mejoras en Traslados e Incidencias)

### Feature & Storage: Integración Google Drive (Múltiples Carpetas y Videos sin Descarga)
*   **Soporte de Múltiples Carpetas y Videos**: Se amplió la integración con Google Drive para permitir adjuntar hasta 5 carpetas y 5 videos (`.mp4`, `.avi`, `.mov`, `.hevc`, `.3gp`, `video/*`) en `nuevo-ticket-csh.astro`, `nuevo-ticket-marketing.astro`, `traslado.astro` y la vista de detalle `[id].astro`.
*   **Compartición Restringida a Agentes Asignados**: Los recursos de Drive no se comparten de forma global ni se descargan al servidor; se otorgan permisos de lectura individuales vía Google Drive API únicamente a los correos institucionales de los agentes (`Usuario.mail`) con privilegios `atiende_csh` o `atiende_mkt`.
*   **Detección de Duplicados y Límites**: Alerta interactiva mediante toasts si un elemento ya fue añadido o si se rebasa el límite de 5 recursos por tipo.
*   **UI con Botón de Eliminación Inline (`✖️`)**: Cada carpeta o video añadido se renderiza en un contenedor independiente con su botón `✖️` superpuesto para retirarlo y liberar cupo antes del envío.
*   **Hipervínculos Estructurados**: Al enviar el formulario o guardar un comentario, los recursos se concatenan automáticamente en la descripción como enlaces HTML (`<a href="..." target="_blank" rel="noopener">`).

### UX & Validation: Mejoras en Formulario de Solicitud de Traslados (`/tickets/soporte/traslado`)
*   **Filtro y Validación de Campus Destino**: El dropdown de `Campus destino` excluye de forma reactiva el campus seleccionado en `Campus origen`. La validación de formulario rechaza el submit con mensaje de error si ambos campus coinciden.
*   **Limpieza de Carrera y Checkbox Escolarizada**: Al consultar un alumno vía API, se limpia automáticamente el sufijo `" Escolarizada"` o `" Escolarizado"` en licenciaturas para empatar con `carreraOptions`, activando el checkbox `escolarizada` automáticamente.
*   **Bloqueo de Checkbox Escolarizada**: Se deshabilitó la edición manual del checkbox para evitar alteraciones indebidas, preservando el valor en el payload de envío.
*   **Popover Informativo de Formatos Permitidos**: Se reemplazó el texto estático de formatos por el botón `"Consulta lo que puedes añadir ❓"` con ventana emergente flotante responsiva detallando archivos, Google Workspace, videos y carpetas de Drive.

### Feature & Validation: Reporte de Incidencias (`/user/perfil/incidencias`)
*   **Validación de Horario**: Validación previa ante horarios incompletos/nulos en días laborables al intentar guardar incidencias con toast de advertencia.
*   **Reordenamiento de Tarjeta**: Se reorganizó la vista de la jornada a orden cronológico estándar (Entrada → Comida → Salida).
*   **Captura de Motivo para "Evento"**: Textarea interactivo para capturar el motivo en inasistencias por evento especial, persistido en base de datos, reporte y correo.

## 2026-08-20 (Optimización SSE Global y Eliminación de Consultas N+1 de Sesión)

### Performance: Un Solo EventSource Global (Elimina Bloqueo de UI al Navegar)
*   **Causa Raíz Identificada**: Al navegar entre vistas, la UI se congelaba por agotamiento del límite de 6 conexiones HTTP/dominio del navegador. `MainLayout.astro`, `index.astro` y `marketing/dashboard.astro` abrían cada uno una conexión `EventSource` independiente hacia `/api/notifications/sse`, saturando el pool de sockets y bloqueando cualquier petición nueva.
*   **Bus de Eventos Global (`siget:sse-event`)**: Se añadió en `MainLayout.astro` un `window.dispatchEvent(new CustomEvent('siget:sse-event', { detail: data }))` que emite todos los eventos SSE recibidos al bus nativo del navegador, antes de filtrar por `originatorId`.
*   **Eliminación de `EventSource` Redundantes**: En `src/pages/index.astro` y `src/pages/tickets/marketing/dashboard.astro` se eliminó el `dashboardEventSource = new EventSource(...)`. Ambas páginas ahora escuchan el `CustomEvent` local `'siget:sse-event'` para actualizar sus tarjetas estadísticas en tiempo real sin consumir ningún socket HTTP adicional.
*   **Limpieza Estricta de Listeners**: Se usan referencias nombradas (`dashboardSseHandler`, `mktDashboardSseHandler`) para remover los listeners correctamente en `astro:before-preparation`, evitando duplicados en View Transitions.

### Performance: Reutilización de Sesión de Middleware (Elimina N+1 a BD)
*   **Causa Raíz Identificada**: En cada navegación, `middleware.ts` ejecutaba `getSession()` disparando 6–7 queries SQL (joins de rol, secciones, empresa, permisos). La página destino volvía a ejecutar `getSession()` de forma independiente, duplicando todas esas consultas.
*   **Reutilización de `Astro.locals.session`**: En 12 páginas Astro se reemplazó `await getSession(Astro.request)` por `Astro.locals.session`, que ya fue resuelto por `middleware.ts` en la misma request. Páginas actualizadas:
    *   `src/pages/index.astro`
    *   `src/pages/tickets/soporte/index.astro`
    *   `src/pages/tickets/soporte/usuario/index.astro`
    *   `src/pages/tickets/soporte/nuevo-ticket-csh.astro`
    *   `src/pages/tickets/soporte/traslado.astro`
    *   `src/pages/tickets/marketing/index.astro`
    *   `src/pages/tickets/marketing/usuario/index.astro`
    *   `src/pages/tickets/marketing/dashboard.astro`
    *   `src/pages/tickets/marketing/nuevo-ticket-marketing.astro`
    *   `src/pages/tickets/view/[id].astro`
    *   `src/pages/user/perfil.astro`
    *   `src/pages/user/perfil/incidencias.astro`
*   **Reducción estimada de carga en BD**: ~50–70% menos queries SQL por evento de navegación en páginas protegidas.
*   **Verificación**: `npx astro check` 0 errores en 157 archivos.

### Fix: Reordenamiento y Condición de Tarjetas en Dashboards Admin/Superadmin
*   **Tablero Personal**: Primera tarjeta siempre "Total asignados" (sin enlace, solo informativa). Las demás tarjetas de estatus solo se renderizan si `count >= 1`. Los enlaces filtran por `assignee=${currentUserId}`.
*   **Tablero General**: Reordenamiento estricto en 9 posiciones: Total (sin enlace) → Solucionados → Cancelados → Duplicados → Sin asignar → Nuevos → En progreso → En espera → Traslados activos.
*   **Soporte de alias de filtros**: `assignee` y `atiende` aceptados indistintamente en `soporte/index.astro`, `soporte/usuario/index.astro`, `marketing/index.astro` y `marketing/usuario/index.astro`.

## 2026-08-19 (Consulta de Aspirantes vía API y Asignación Individual de Categorías)

### Feature & Integration: Consulta y Autocompletado de Aspirante (`/tickets/soporte/nuevo-ticket-csh`)
*   **Integración con API de Aspirantes**: En `src/lib/ticket-wizard.ts`, se implementó la función `consultarAspirante()` para consultar `https://pz3bmmqsty.us-east-1.awsapprunner.com/api/aspirantes/consultar-detalle?campus={campus}&folio={folio}` con autenticación `x-api-key: CHURRUMAIS-1979`.
*   **Autocompletado y Bloqueo de Input**: Al ingresar el folio y disparar evento `blur`, presionar `Enter` o cambiar el campus seleccionado, se concatena y capitaliza el nombre completo (`nombre`, `ap_paterno`, `ap_materno`), asignándolo al campo `#afectado_nombre` y bloqueándolo en modo solo lectura (`readOnly: true`, `bg-muted`, `cursor-not-allowed`, `opacity-80`).
*   **Manejo de Errores y Validaciones**: Validación alfanumérica previa, feedback con toasts interactivos de éxito/error y desbloqueo automático del campo de nombre si no se localiza el folio o la búsqueda arroja error.

### Refactor & Security: Asignación Individual de Categorías y Exclusividad CSH
*   **Eliminación de Herencia Obsoleta de Rol**: Se removió completamente la lógica de `inheritedCategories` y herencia por rol (`permisos_categoria`) en `editar/[id].astro` y `UserSubcategoryItem.astro`. La visualización y clasificación entre *"Habilitadas"* y *"Sin acceso"* ahora depende 100% de la tabla `asignaciones_categorias`.
*   **Población Masiva Individual**: Se poblaron 197 categorías/subcategorías individuales activas en `asignaciones_categorias` para cada usuario con rol `Admin` y `Superadmin`.
*   **Exclusividad para Victor Barrera (ID: 3)**: Se aseguraron y aislaron como exclusivas las 9 subcategorías especiales para el Director del CSH (Alumno: *Colaboradores*, *Docentes*, *Notas aclaratorias*; Colaborador: *Bajas*, *Redireccionar correo institucional*, *Redireccionar*; Docente: *Actualizar*, *Correo personal*, *Lista negra*), desactivándolas en todos los demás administradores.
*   **Depuración de BD**: Se desactivaron 92 registros obsoletos en la tabla `permiso_categoria`.

## 2026-08-18 (Protección de Datos Sin Guardar, Búsqueda de Categorías y Ajustes de Edición)

### UX & Security: Prevención de Pérdida de Información Sin Guardar
*   **Wizards de Creación de Tickets (`nuevo-ticket-csh.astro` y `nuevo-ticket-marketing.astro`)**:
    *   Toast informativo persistente (`duration: 0`) ante cambios en descripción, campos de afectado o archivos adjuntos (locales o Google Drive).
    *   Modal interactivo de confirmación `#unsaved-ticket-modal` con opciones *"Descartar y salir"* y *"Permanecer aquí"*.
    *   Intercepción de navegación en enlaces del sidebar/breadcrumbs, botón atrás del navegador (`popstate`), transiciones Astro (`astro:before-preparation`) y cierre de pestaña/ventana (`beforeunload`).
*   **Edición de Usuario (`editar/[id].astro`)**:
    *   Snapshot inicial de valores del formulario y modales de confirmación con opciones *"Guardar y salir"*, *"Descartar y salir"* y *"Permanecer aquí"*.

### Fixes & Refinements: Edición de Usuarios y Catálogos
*   **Toggle "Otro"**: Corregido movimiento de perilla CSS (`peer-checked:translate-x-[16px]`) y visualización de color guinda en categorías sin subcategorías.
*   **Flags de Superadmin**: Refactorizado `performSave()` en `user-edit-form-logic.ts` para no enviar flags ausentes en el DOM y prevenir que el Superadmin pierda `tckt_csh` / `tckt_mkt`.
*   **Buscador de Categorías**: Eliminado el límite de 10 resultados para desplegar todas las coincidencias encontradas en wizards CSH y Marketing.
*   **Tipos de Empresa (`/admin/empresas`)**: Personalización de badges por tipo de empresa (Magno, Ejecutivo, Oficina, Social) y toggle de Campus Virtual Origen.

## 2026-08-10 (Invalidación de Sesión por Cambio de Rol y Restricción de Combos Select)

### Security & UX: Configuración de Combos Select para Rol Usuario (`/tickets/view/[id]`)
*   **Fix Navegación Indeseada en Detalle de Ticket**: Corregido un conflicto en el manejo del evento `astro:page-load` en los listados de tickets (`/tickets/soporte`, `/tickets/soporte/usuario`, `/tickets/marketing`, `/tickets/marketing/usuario`) donde `document.querySelectorAll("select")` capturaba globalmente cualquier desplegable de la página (incluyendo los de la vista de detalle en navegaciones client-side), provocando que al cambiar un combo como *Estatus* en la vista de detalle se recargara la página con parámetros de filtro `?assignee=...&page=1`. Se acotó la consulta exclusivamente a los elementos de filtro (`#estatus-select`, `#categoria-select`, `#empresa-select`, `#assignee-select`) con validación estricta de ID.
*   **Permiso de Estatus para Solicitante**: El usuario solicitante (`!isPrivileged`) conserva la capacidad de cambiar el **Estatus** de sus tickets (permitiendo cancelar o reabrir tickets a estados como *En progreso*, *En espera*, *Solucionado* o *Cancelado*).
*   **Exclusión de Estatus Sensibles**: Se omiten los estatus **Nuevo** y **Duplicado** del listado de opciones desplegables para usuarios sin privilegio (`!isPrivileged`), a menos que el ticket ya se encuentre actualmente en ese estatus (permitiendo que el usuario visualice el estatus **Duplicado** o **Nuevo** predeterminado si un administrador lo estableció, pero impidiéndole seleccionarlo en tickets donde no aplique).
*   **Combos Restringidos**: El desplegable de **Prioridad** queda deshabilitado para rol `user` (`disabled={!isPrivileged}`).
*   **Campo "Atiende" en Vista Normal**: Reemplazado el combo `<select>` de "Atiende" por texto plano en la vista normal de tickets cuando el usuario no tiene permisos privilegiados (`!isPrivileged`), logrando paridad de diseño con la vista de traslados.
*   **Protección en Backend**: Endpoint `PATCH /api/tickets/update` permite al solicitante actualizar el estatus validando que no intente conectarlo a *Nuevo* o *Duplicado*, mientras que `prioridad` y `archivado` requieren estrictamente `isPrivileged`.

### Security: Cierre Forzado de Sesión ante Cambios Administrativos

*   **`prisma/schema.prisma`**: Se añadió la columna `session_version Int @default(1)` al modelo `Usuario`. Este campo actúa como un sello de versión que permite detectar cuándo la sesión activa de un usuario ha quedado invalidada por una acción administrativa.
*   **`auth.config.ts` (Callback `jwt`)**: Al refrescar el token JWT, se compara el campo `session_version` almacenado en el token con el valor actual en la base de datos. Si los valores difieren, el callback devuelve `null`, lo que provoca que Auth.js destruya automáticamente la cookie de sesión del usuario afectado en su siguiente petición.
*   **`src/middleware.ts`**: Se añadió detección de "cookie huérfana": si una petición llega sin sesión válida pero con una cookie de sesión presente, el middleware redirige a `/login?error=SesionRevocada` en lugar de al `/login` genérico.
*   **`src/pages/api/admin/usuarios.ts` (Handler `PATCH`)**: Cuando un administrador guarda cambios sobre un usuario y se detecta un **downgrade de rol** (cualquier reducción de `rolId`, por ejemplo Superadmin→Admin o Admin→Usuario) o una **desactivación** (`activo: false`), se incrementa automáticamente el `session_version` del usuario afectado en la misma transacción. Esto invalida su sesión activa al instante en su siguiente petición.
*   **`src/pages/login.astro`**: Se añadió el caso `SesionRevocada` al switch de errores. Se muestra un alert con fondo **ámbar** (distinto al rojo de errores genéricos y al guinda de acceso denegado) con el mensaje: *"Tus permisos han sido modificados. Por favor inicia sesión nuevamente para continuar."*
*   **Casos que disparan el cierre de sesión**: Superadmin→Admin ✅ | Superadmin→Usuario ✅ | Admin→Usuario ✅ | Cualquier rol→Inactivo ✅
*   **Casos que NO afectan la sesión**: Edición de horario, alias, flags de tickets u otros campos que no impactan permisos de acceso.
*   **`npx astro check`**: 149 archivos verificados — 0 errores — 0 warnings.

## 2026-07-27 (Gestión de Secciones, Permisos de Usuario y Seguridad de Acceso)

### Feature: Módulo de Gestión de Secciones Globales (`/admin/secciones`)
*   **Ocultar "Secciones"**: Se omitió la sección `admin_siget_secciones` en la lista global editable para prevenir auto-bloqueos accidentalmente de administradores, incorporando una nota explicativa en el subgrupo SiGeT.
*   **Sección "Empresas"**: Se añadió la sección `admin_siget_empresas` (ID 23) a la base de datos, el script de seed y los permisos de roles. Se actualizó `src/middleware.ts` para que `/admin/empresas` requiera esta sección específica.
*   **Ordenamiento A→Z**: Se ajustó el ordenamiento de las consultas y la UI a alfabético ascendente (A→Z) por grupo y subgrupo, manteniendo `feature_dark_mode` al inicio del grupo Generales.

### Security: Restricciones de Acceso e Inactividad de Usuarios
*   **Bloqueo de Usuarios Inactivos en Login**: Se añadió una validación en `auth.config.ts` (`signIn` callback) que consulta el estado `activo` del usuario en la BD de SiGeT. Si la cuenta se encuentra inactiva, se rechaza la sesión arrojando el error `UsuarioInactivo` con mensaje descriptivo en `login.astro`.
*   **Restricción del Grupo Administrador**: Se restringió la visibilidad y acceso al grupo de menú "Administrador" (Secciones SiGeT y Correos Institucionales) en `Sidebar.astro` y en los roles base (`seed.ts`), haciéndolo exclusivo para usuarios con el rol **Superadmin** (`rolId === 3`).

### UX/UI & Feature: Rediseño de la Vista de Edición de Usuarios (`/admin/usuarios/editar/[id].astro`)
*   **Subcategorías Jerárquicas Recursivas**: Integración del componente `UserSubcategoryItem.astro` para desplegar subcategorías jerárquicas en acordeones anidados de N niveles de profundidad.
*   **Organización SSR de Categorías**: Categorías separadas dinámicamente en subsecciones "Habilitadas" (solo subcategorías activas) y "Sin acceso" (sub-acordeón interno para inactivas).
*   **Toggles Condicionales por Rol**:
    *   `canEditCategorias` independizado para permitir que Admin y Superadmin editen permisos de categorías de forma libre.
    *   La sección de Categorías se oculta automáticamente al editar usuarios con rol `Usuario` (`rolId === 1`).
    *   Toggles `Levanta CSH` (`tckt_csh`) y `Levanta Mkt` (`tckt_mkt`) ocultados cuando el usuario editado es `Superadmin` (`rolId === 3`).
*   **Colores y Estados de Toggles**:
    *   Toggles con borde blanco fino de 1px para destacar visualmente cuando están activos en color guinda.
    *   Color **Guinda** (`bg-secondary`) para encendido total (100% de subcategorías/hijas activas) y **Dorado** (`bg-primary`) para encendido parcial.
    *   Acordeones colapsados por defecto al cargar la vista.
*   **Sincronización Bidireccional de Toggles y Secciones (`user-edit-form-logic.ts`)**:
    *   Activación/desactivación dinámica en tiempo real entre toggles (`tckt_csh`, `tckt_mkt`, `atiende_csh`, `atiende_mkt`) y las casillas de verificación de secciones según el rol.
    *   Sincronización automática de la categoría Marketing (`cat-12`) al conmutar `atiende_mkt`.
    *   Desacoplamiento estricto de vistas entre CSH y Marketing.
    *   Evaluación unificada para las secciones `Abrir ticket > CSH` y `Abrir ticket > Marketing` (activas si al menos uno entre Levanta o Atiende está encendido).

## 2026-07-20 (Corrección de Filtros y Mejoras UX en Administración)

### Feature: Refinamientos UX en la Administración de Categorías
*   **Vistas (`src/pages/admin/categorias/`):**
    *   **Ocultar Eliminar con Hijos**: Ocultado el ícono de cesto de basura en categorías y subcategorías si estas tienen nodos hijos relacionados.
    *   **Flechas de Acordeón**: Corregida la dirección y rotación de las flechas indicadoras (cerrado = derecha `→`, abierto = abajo `↓`).
    *   **Estilo Seleccionado y Hover**: El elemento activo/seleccionado y los hovers en summaries ahora tienen fondo guinda (`#800020`) con texto en blanco para mejor legibilidad y contraste.
    *   **Tecla ESC y Confirmaciones**: Al presionar la tecla `Escape` se finaliza la edición o creación activa. Si existen cambios sin guardar o texto ingresado, se solicita confirmación al usuario mediante el modal personalizado antes de descartar. Si no hay cambios, se cierra inmediatamente. También aplica si no hay formularios abiertos para colapsar el acordeón activo.
    *   **Toast en Visibilidad**: Se muestra un toast confirmando la acción al alternar la visibilidad de una categoría o subcategoría con el botón del ojo.

### Fix: Persistencia de Filtros con View Transitions en Listados de Tickets
*   **Vistas (`src/pages/tickets/`):**
    *   Corregido el bug donde cambiar de estatus/filtro más de una vez dejaba de funcionar sin recargar la página.
    *   Se envolvieron todos los event listeners de los filtros `<select>`, paginación y filas de tablas en un único manejador del evento `astro:page-load`. Esto garantiza que los listeners se re-registren correctamente tras cada navegación suave iniciada por `navigate()` de Astro.
    *   Afecta a:
        - `src/pages/tickets/soporte/index.astro` (Vista CSH/Coordinador)
        - `src/pages/tickets/soporte/usuario/index.astro` (Vista Usuario)
        - `src/pages/tickets/marketing/index.astro` (Vista Marketing/Coordinador)
        - `src/pages/tickets/marketing/usuario/index.astro` (Vista Usuario Marketing)

## 2026-07-20 (Módulo de Categorías y Sincronización de Secuencias)

### Feature: Rediseño del Módulo de Categorías y Subcategorías
*   **Vistas (`src/pages/admin/categorias/`):**
    *   Reestructurada la administración en un árbol jerárquico recursivo tipo acordeón (details/summary) con padding en cascada según el nivel de profundidad.
    *   **Ojo (Activo/Inactivo)**: Iconos para alternar visibilidad activa de categorías y subcategorías (ojo abierto = activo, ojo cerrado/desvanecido = inactivo).
    *   **Lápiz (Editar/Eliminar)**: Visible únicamente si el nodo no tiene tickets asociados en la base de datos (seguridad referencial). Permite cambiar el nombre o eliminarlo (X).
    *   **Más (+)**: Fila inline que aparece al inicio del listado de subcategorías para registrar de forma inmediata un nuevo nodo hijo.
    *   **Restablecer**: Botón que colapsa todos los acordeones del árbol y limpia formularios activos.
    *   **Nueva categoría**: Botón que inserta una fila de entrada en la parte superior para añadir categorías raíz.
    *   **Validación de entrada**: Expresión regular para admitir únicamente letras (con acentos y diéresis), números y espacios.
    *   **Persistencia de Estado**: Se almacena la ruta de acordeones abiertos en `sessionStorage` para restaurar la vista tras recargar por guardar, editar o alternar visibilidad.
    *   **Animación y Scroll**: Scroll automático hacia el elemento nuevo o editado con un efecto de transición de color de fondo desde guinda (`#800020`) a transparente/blanco.

*   **API del Backend (`src/pages/api/admin/`):**
    *   `/api/admin/categorias/index.ts` — POST, PATCH y DELETE con control de integridad transaccional (recursivo para subcategorías descendientes sin tickets).
    *   `/api/admin/subcategories.ts` — POST, PATCH y DELETE con resolución de la categoría del padre.

*   **Wizards de Creación de Tickets (`src/pages/tickets/`):**
    *   `nuevo-ticket-csh.astro` y `nuevo-ticket-marketing.astro` actualizados para consultar el árbol de categorías/subcategorías activas dinámicamente desde la base de datos, en lugar del archivo JSON estático `categories.json`.

### Fix: Desfase de Secuencias de Base de Datos (PostgreSQL)
*   **Problema**: Al haber poblado las tablas en el seed utilizando IDs explícitos, las secuencias internas de PostgreSQL no avanzaron, provocando fallos por clave duplicada (`Unique constraint failed on the fields: (id)`) al insertar nuevos registros de categorías y subcategorías.
*   **Solución**:
    *   Se creó el script de mantenimiento `scripts/sync-sequences.ts` para buscar de forma automática las secuencias de base de datos y restablecerlas con el ID máximo (`MAX(id)`).
    *   Se integró esta lógica de sincronización al final de `prisma/seed.ts` para que siempre se alineen las secuencias de forma automática tras poblar la base de datos.

## 2026-07-20 (Restauración de BD y Protección del Seed)

### Fix: Recuperación de Datos y Hardening del Script de Seed
*   **Incidente:** El script `seed.ts` ejecutaba `deleteMany()` sin condición, borrando todos los datos transaccionales (tickets, traslados, incidencias, usuarios).
*   **Restauración:** Se restauró la base de datos desde un snapshot de AWS RDS del **17 de julio a las 03:00 AM** en una nueva instancia (`siget-db-dev-restored-v2`). Se recuperaron **100 usuarios, 21 tickets, 9 traslados y 123 incidencias**.
*   **Corrección de schema:** El snapshot del 17-jul tenía la columna `vacaciones` (nombre anterior). Se aplicó `ALTER TABLE "usuario" RENAME COLUMN "vacaciones" TO "acepta_tickets"` vía SQL directo para sincronizar con el schema actual de Prisma.
*   **Protección del seed (`prisma/seed.ts`):**
    *   Todos los bloques `deleteMany()` ahora están envueltos en `if (forceClean)` — solo se ejecutan si se pasa la variable de entorno `FORCE_CLEAN=true`.
    *   **Todos** los `createMany()` del archivo tienen `skipDuplicates: true`, garantizando que el seed sea completamente idempotente y re-ejecutable sin riesgo.
    *   El seed puede correrse en cualquier momento para sincronizar catálogos sin afectar datos históricos.
*   **Scripts de mantenimiento añadidos (`scripts/`):**
    *   `validate-db.ts` — Valida conteo de todas las tablas del sistema.
    *   `inspect-columns.ts` — Inspecciona columnas existentes en BD para detectar desfases de schema.
    *   `fix-missing-columns.sql` — SQL aplicado para renombrar `vacaciones` → `acepta_tickets`.
*   **Actualización de secreto AWS:** El secreto `DATABASE_URL` en AWS Secrets Manager fue actualizado por el usuario para apuntar a `siget-db-dev-restored-v2`. El `.env` local fue actualizado de forma correspondiente.

## 2026-07-16 (Toggles Homeoffice/Vacaciones, Correcciones de UI y Pulido Final en Incidencias)


### Feature: Estados Especiales para Inasistencias y Correcciones de UI
*   **Vista de Incidencias (`src/pages/user/perfil/incidencias.astro`):**
    *   Añadidos toggles **Homeoffice** (visible solo en sábados) y **Vacaciones** (visible cualquier día) en la cabecera de las tarjetas de inasistencia total. Los toggles son mutuamente excluyentes y ocultan el textarea de "Motivo (Turno)".
    *   **Ocultación por Omisión:** Si se selecciona el toggle "Omitir" en un día, se ocultan automáticamente los campos de texto de "Motivo (Turno)" y "Motivo (Comida)".
    *   **Corrección de Horario Excedido:** Se corrigió la lógica para que la leyenda de advertencia de almuerzo "Horario excedido" (y su correspondiente textarea de justificación) solo aparezca cuando existen *ambas* marcas (entrada comida y salida comida) y la diferencia es mayor a 30 minutos.
    *   **Visualización de Comida Incompleta:** La tabla del preview ahora renderiza marcas individuales parciales/incompletas de comida (`SC` o `RC` según existan en la base de datos) en lugar de ocultarlas si falta una de ellas, posicionando el `SL (-:--)` al final de la celda.
    *   **Simplificación de la Leyenda:** Actualizada la leyenda del reporte/preview a "A tiempo" (removiendo el texto de "Reposición").
    *   **Asunto de Correo Quincenal:** Se removió el sufijo de semanas (ej: `- Semana #27 a #29`) del asunto del correo cuando el reporte se envía de manera quincenal.
*   **Backend (`src/pages/api/user/incidencias/send-report.ts`):**
    *   Implementada la misma lógica de marcas individuales parciales (`SC` y `RC`) para la tabla de calendario del correo real enviado.
    *   Leyenda del correo real actualizada a "A tiempo" y añadido el bloque morado para "Homeoffice / Vacaciones" a la leyenda de colores.
    *   Se eliminó la información de semanas del asunto en el envío real de correos de la Quincena 1 y 2.


## 2026-07-16 (Actualización de Vista y Reporte de Incidencias)

### Feature: Optimización de Vista y Reporte de Incidencias
*   **Base de datos (`prisma/schema.prisma`):**
    *   Añadido campo `omitida` (boolean con valor por defecto false) al modelo `Incidencia` para persistir la exclusión.
*   **API (`src/pages/api/user/incidencias.ts` & `src/pages/api/user/incidencias/send-report.ts`):**
    *   Persistencia del estado `omitida` en base de datos.
    *   En `send-report.ts`, se utiliza el nuevo parámetro `todosLosRegistros` enviado desde el cliente para armar correctamente las celdas vacías y la estructura de días (Lun-Sáb) de la tabla de calendario del correo.
    *   Exclusión de visualización y detalles en el correo para incidencias con `omitida === true`.
    *   Cálculo del rango de semanas del año de forma dinámica e inclusión en el asunto del correo para Quincena 1 y Quincena 2.
    *   Actualización de textos en la leyenda de colores (A tiempo, Justificar, Retardo, Inasistencia).
*   **Vista (`src/pages/user/perfil/incidencias.astro`):**
    *   Lógica por defecto del toggle a "Enviar" si no existen comentarios.
    *   Se evita mostrar la leyenda "Horario excedido" en los registros marcados como incompletos.
    *   Sincronización de los colores de las tarjetas de incidencia con la tabla calendario (`#ca1c1c` para rojo, `#ea580c` para naranja, `#16a34a` para verde).
    *   Implementación de cierre de los modales "Ver tabla", "Enviar reporte" y "Previsualización del correo" al presionar la tecla `Escape` o hacer clic fuera del modal.
    *   Sustitución de los botones de texto por botones compactos con iconos y tooltips (`title`):
        - **Ojo**: Previsualización en vivo del correo del reporte.
        - **Calendario**: Ver tabla mensual/quincenal.
        - **Sobre de carta**: Enviar reporte final.
        - **Disco 3½**: Guardar justificaciones/incidencias.
    *   Añadido modal `#preview-reporte-modal` y generador de previsualización en vivo en JS, simulando el HTML/CSS exacto de AWS SES.


## 2026-07-15 (Lógica Avanzada de Asignación v2, Redirección Post-Ticket y Mejoras de Notificaciones)

### Feature: Lógica de Asignación Automática Mejorada
*   **`src/services/ticketAssignmentService.ts` (Servicio):**
    *   **Horario Obligatorio:** Un agente sin `horario_disponibilidad` definido ya no se considera disponible. Aplica para tickets CSH y Marketing por igual (antes Marketing no validaba horario).
    *   **Asignación Forzada por Unicidad:** Si la categoría/subcategoría elegida tiene exactamente un único candidato en la BD (excluyendo al solicitante), el ticket se asigna a ese candidato aunque esté fuera de horario o de vacaciones.
    *   **Eliminación del Fallback S-1:** Se eliminó el fallback que buscaba agentes de nivel `S_1`. Si no hay nadie disponible entre los candidatos válidos, el ticket queda directamente sin asignar.
    *   **Logs de Diagnóstico:** Se añadieron mensajes de log en consola que explican por qué un agente es descartado (sin horario, fuera de horario, no trabaja el día, etc.).

### Feature: Notificaciones por Correo con Nombres Personalizados
*   **`src/services/emailService.ts` (Servicio):**
    *   **Nuevo evento `ticket_sin_asignar`:** Plantilla HTML y asunto para notificar al solicitante cuando su ticket queda en espera por falta de disponibilidad de ingenieros.
*   **`src/pages/api/tickets/create.ts` (API):**
    *   **Bug Fix:** Se corrigió el uso de `userId` (variable inexistente) reemplazándolo por `solicitanteId` al enviar el correo de confirmación al creador del ticket.
    *   **Correo al Solicitante (Caso A):** Al crear un ticket con agente asignado, el solicitante recibe un correo indicando el nombre del ingeniero que lo atenderá.
    *   **Correo al Solicitante (Caso B):** Al crear un ticket sin agente disponible, el solicitante recibe un correo de tipo `ticket_sin_asignar` informando que su solicitud está en espera.
*   **`src/pages/api/tickets/update.ts` (API):**
    *   **Notificación de Primera Asignación:** Cuando un admin asigna manualmente un agente a un ticket que estaba sin asignar (`atiendeId` era `null`), el solicitante recibe un correo `ticket_creado_solicitante` informándole quién lo atenderá.

### Fix: Redirección Post-Creación de Ticket
*   **`src/pages/tickets/soporte/nuevo-ticket-csh.astro` y `nuevo-ticket-marketing.astro` (Frontend):**
    *   Se añadió importación de `getSession` y cálculo SSR del atributo `data-redirect-url` en el formulario. Si el usuario tiene la sección `soporte_dashboard` / `marketing_dashboard` va al dashboard de soporte/marketing; si no (usuario regular), va a `/tickets/soporte/usuario` o `/tickets/marketing/usuario`. Esto elimina el toast de "sin permisos" que aparecía al crear tickets como usuario normal.
*   **`src/lib/ticket-wizard.ts` y `src/lib/marketing-ticket-wizard.ts` (Cliente):**
    *   Los wizards ahora leen el atributo `data-redirect-url` del formulario en vez de tener la URL hardcoded, respetando el rol del usuario que creó el ticket.

### Feature: Rediseño del Dropdown de Notificaciones
*   **`src/layouts/MainLayout.astro` (Frontend):**
    *   **Nuevo formato por ítem:** Cada notificación muestra: `Ticket #N` (o `#TRL-N` si es traslado), badge de estatus con color, etiqueta dinámica ("Solicitante: nombre" para ingenieros, "Atiende: nombre" para usuarios), empresa y subcategoría/categoría del ticket.
    *   **Botón "Omitir":** Cada ítem tiene un botón que descarta la notificación del dropdown con animación de colapso suave (opacity + max-height).
    *   **Persistencia de omisiones:** Los IDs de tickets omitidos se guardan en `localStorage` bajo la clave `siget_dismissed_notifications` (máximo 200 IDs para evitar bloat).
    *   **Click siempre descarta:** Al hacer click en cualquier notificación (incluyendo tickets con estatus Solucionado), el ítem se descarta del dropdown. Corrección de bug previo donde tickets solucionados no se eliminaban.
    *   **Estado vacío corregido:** Se unificó el HTML del estado vacío en la constante `EMPTY_STATE_HTML`. Se añadió la función `checkEmptyState()` que se llama al final de cada render para mostrar "Estás al día" si todos los tickets fueron omitidos. El botón "Ver más" ahora solo aparece si `hasMore === true` y además hay ítems visibles en el DOM.
*   **`src/pages/api/notifications/list.ts` (API):**
    *   Se añadieron `atiende`, `subcategoria`, `empresa` y `traslados` al `include` de Prisma para soportar el nuevo formato del dropdown.

---

## 2026-07-01 (Sustitución de Imagen S3 por Tabla HTML en Reporte de Incidencias)


### Refactor: Eliminación de AWS S3 del flujo de Reporte de Incidencias
*   **`src/pages/user/perfil/incidencias.astro` (Frontend):**
    *   **Modal simplificado:** Se eliminó la sección de carga de archivos (Drag & Drop y el botón de Google Drive Picker) del modal "Enviar reporte". El modal ahora muestra únicamente el periodo seleccionado y un texto de confirmación, con el botón "Enviar" habilitado de forma directa.
    *   **Limpieza de código:** Se removieron ~200 líneas de código obsoleto del cliente: funciones `handleFileSelect`, `initGoogleDrive`, `openDrivePicker`, `drivePickerCallback`, eventos de Drag & Drop, variables de estado de Google API y referencias DOM a elementos eliminados.
    *   **Submit simplificado:** El handler del botón "Enviar" ahora realiza el POST directamente a `/api/user/incidencias/send-report` sin pasos intermedios de generación de URL firmada ni subida a S3.
*   **`src/pages/api/user/incidencias/send-report.ts` (API):**
    *   **Eliminación de S3:** Se removieron los imports `@aws-sdk/client-s3` y `@aws-sdk/s3-request-presigner`, la obtención de URL firmada de S3 y el parámetro `s3Key` del payload.
    *   **Tabla HTML Calendario:** Se implementó la función `buildCalendarTable()` que genera una tabla HTML `<table>/<tr>/<td>` con estilos CSS 100% inline para máxima compatibilidad en reenvíos de Gmail/Outlook. La tabla incluye: encabezado Lun-Sáb con fondo institucional guinda, colores condicionales por celda (verde para a tiempo/reposición, rojo para tardanza >15 min, naranja para 6-15 min, gris para inasistencia), marcas de agua semitransparentes del número de día, y siglas EL/SL/SC/RC con colores.
    *   **Leyenda de colores:** Se añade automáticamente una leyenda debajo de la tabla describiendo cada color de estado.
    *   **Destinatarios de producción:** Se eliminó el correo de prueba `gerardo.omana@humanitas.edu.mx`. El correo ahora se envía al Director CSH (`Para:`) y al colaborador que envía (`CC:`).
*   **`src/services/emailService.ts` (Servicio):**
    *   Se añadió el campo opcional `cc?: string` a la interfaz `SendEmailParams` y se incorporó `CcAddresses` al comando `SendEmailCommand` de AWS SES para soportar el envío en copia.

---

## 2026-06-30 (Filtros de Quincena y Reposición de Horario en Incidencias)

### UI/UX: Lógica de Tiempos y Filtros en Reporte de Incidencias
*   **`src/pages/user/perfil/incidencias.astro` (Frontend):**
    *   **Reposición de Tiempo:** Se implementó una regla de horario para marcar con "Reposición de tiempo" (con status y registros en color verde) a aquellos días en los que el usuario registró su entrada antes del horario laboral de entrada y su salida después del de salida.
    *   **Filtros de Quincenas:** Se añadieron botones de control dinámicos ("Ver todo", "Quincena 1" y "Quincena 2") en el extremo opuesto al botón "Guardar incidencias" (tanto arriba como abajo de la lista de incidencias). Estos botones se muestran únicamente cuando el listado de incidencias del mes consultado contiene días del 16 en adelante, y se sincronizan visualmente al hacer clic en ellos para filtrar la vista instantáneamente.

---

## 2026-06-23 (Corrección de Descuento en Vista de Ticket y Optimizaciones de Notificaciones)

### Bug Fix: Checkbox "¿Tiene descuento?" en Detalle de Ticket
*   **`src/pages/tickets/view/[id].astro` (Frontend):**
    *   **Causa del bug:** La base de datos tiene una relación no nula de descuento que por defecto apunta a `1` ("N/A") cuando no se aplica descuento. Como `traslado.descuento` siempre estaba definido, la condición `!!traslado.descuento` resultaba siempre verdadera y marcaba el checkbox.
    *   **Solución:** Se corrigió la condición de marcado del checkbox, la clase de visibilidad del contenedor y el valor por defecto para que solo se activen si `descuentoId !== 1` y la descripción no es `"N/A"`.
*   **`src/pages/api/tickets/update.ts` (API):**
    *   Se implementó la lógica en el backend (petición PATCH) para procesar los campos `tiene_descuento` y `descuento_nombre` de forma correcta. Si `tiene_descuento` es falso se actualiza el `descuentoId` a `1` ("N/A"), y si es verdadero se busca el descuento correspondiente por su descripción para guardar su ID correspondiente.

### UI/UX y Rendimiento: Optimizaciones en Sistema de Notificaciones
*   **`src/layouts/MainLayout.astro` (Frontend):**
    *   **Feedback Inmediato:** Se añadió un spinner de carga y mensaje visual ("Cargando notificaciones...") dentro del listado al abrir el dropdown de notificaciones. Esto evita que el menú se muestre vacío o desactualizado durante la petición de red.
    *   **Transición Visual:** Al hacer clic en cualquier notificación para ver el ticket, se activa inmediatamente el overlay de carga `#page-loading-overlay` (el parpadeo blanco/loader central) para dar feedback instantáneo de que la navegación ha comenzado.
*   **`src/pages/api/notifications/list.ts` & `count.ts` (API):**
    *   Se optimizó la consulta a la base de datos para usuarios comunes añadiendo una cláusula `take: 100` y ordenamiento `orderBy: { fechaact: 'desc' }`. Esto evita procesar en memoria todo el historial de tickets del usuario, reduciendo significativamente el tiempo de respuesta de las notificaciones.

---

## 2026-06-23 (Indicador de carga en Búsqueda de Alumno)

### UI/UX: Feedback Visual en Autocompletado de Alumnos
*   **`src/lib/toast.ts`:**
    *   Se modificaron los métodos `show`, `success`, `error`, `warning` y `info` para retornar un objeto con un método `dismiss()`. Esto permite descartar manualmente notificaciones activas de forma programática.
*   **`src/pages/tickets/soporte/traslado.astro`:**
    *   Se integró un toast informativo temporal con un spinner de carga SVG (`"Buscando alumno..."`) que se dispara al iniciar la consulta de detalles del alumno en `consultarDetalleAlumno()`.
    *   El toast se descarta automáticamente al recibir respuesta (tanto exitosa como errónea) utilizando el método `dismiss()` antes de mostrar el resultado definitivo.

---

## 2026-06-23 (Lógica de Asignación Avanzada de Tickets)

### Refactor: `src/services/ticketAssignmentService.ts`
Se refactorizó la función `findBestAgentHybrid` y sus helpers para considerar las tres variables de disponibilidad del agente en todos los pasos de la estrategia de asignación (específica, por rol, fallback):

*   **`atiendeTicketsCsh` / `atiendeTicketsMkt` (flag del Rol):** Se añadió un filtro a nivel de query de BD (`rol: { atiendeTicketsCsh: true }` o `atiendeTicketsMkt: true`) en `findAgentsByRolePermissions`. También se creó la función centralizada `isAgentAvailable()` que aplica esta validación en `findAgentsBySpecificAssignment`. El fallback (`findAgentByFallback`) también filtra por `atiendeTicketsCsh: true`.
*   **`vacaciones` (flag del Usuario):** Ya se filtraba en queries, pero ahora también se valida dentro de `isAgentAvailable()` de forma consistente para las asignaciones específicas.
*   **`horario_disponibilidad` (Json del Usuario):** Se corrigió el comportamiento de `filterBySchedule`: antes rechazaba a agentes sin horario definido (`return false`). Ahora los considera **disponibles sin restricción** (`return true`), lo que evita que ingenieros correctamente configurados (pero sin horario asignado aún) nunca reciban tickets.
*   **Marketing vs CSH:** La detección de categoría Marketing (`isMarketing`) ahora se calcula una sola vez y se propaga a todos los helpers, eliminando la constante duplicada y asegurando coherencia.

---

## 2026-06-23 (Corrección: Sin Asignación Automática de Auditores en Traslados Nuevos)

### Bug Fix: Auditores No Se Asignan al Crear Traslados
*   **`src/pages/api/tickets/transfer.ts` (API):**
    *   **Causa del bug:** Al crear un nuevo ticket de traslado, el endpoint buscaba y asignaba automáticamente usuarios con `auditor_docs: true` y `auditor_req: true` en los campos `auditor_docsId` y `auditor_reqId` del registro en BD.
    *   **Corrección:** Se eliminó toda la lógica de búsqueda automática de auditores. Ahora los campos `auditor_docsId` y `auditor_reqId` se guardan como `null` al crear el traslado, debiendo ser asignados manualmente por un privilegiado en la vista de detalle del ticket.
    *   **Notificaciones:** Se eliminaron también los auditores del listado de destinatarios de la notificación SSE al crear el traslado, ya que ya no hay auditores pre-asignados.

---

## 2026-06-23 (Sincronización de Horario al Editar Usuarios)

### Administración: Refresco de Horario al Actualizar Clave y Mejoras en Lista
*   **`src/pages/admin/usuarios/editar/[id].astro` (Frontend):**
    *   Se agregó el atributo `data-original-clave` al formulario para poder identificar si la clave ha cambiado tras guardar.
*   **`src/scripts/user-edit-form-logic.ts` (Frontend):**
    *   Se modificó la lógica de envío de datos del formulario para que si la clave ha cambiado, se fuerce una recarga suave de la página mediante `navigate()`. Esto refresca la vista y muestra los horarios de disponibilidad obtenidos por el servidor (SSR) desde la API de RH tras guardar la clave.
    *   **Feedback de guardado:** Se implementó una lógica interactiva en el submit que deshabilita el botón de "Guardar cambios", cambia su texto a `"Guardando..."` y activa el overlay de carga global (`#page-loading-overlay`) para simular el parpadeo/espera visual mientras la petición se procesa en el backend.
*   **`src/pages/admin/usuarios/[campus].astro` (Frontend):**
    *   Se implementó un spinner de carga y mensaje visual ("Cargando usuarios...") en la tabla de usuarios mientras se realiza el `fetch` asíncrono de datos desde el cliente. Esto elimina la visualización de una tabla vacía al volver atrás o filtrar, mejorando la respuesta percibida.

---

## 2026-06-23 (Restricción de Acceso a Vista de Ticket)

### Seguridad: Control de Acceso Granular por Ticket
*   **`src/pages/tickets/view/[id].astro` (Frontend/SSR):**
    *   Se implementó una verificación de permisos a nivel de ticket individual en la capa SSR de la página.
    *   **Reglas de acceso:** Un usuario autenticado puede ver un ticket si cumple al menos una de las siguientes condiciones:
        1.  Es el **solicitante** (creador) del ticket (`ticket.solicitanteId === userId`).
        2.  Tiene un **rol privilegiado CSH** (IDs: 1, 2, 3, 4, 5, 6, 15) y el ticket **no es** de la categoría Marketing.
        3.  Tiene el flag **`atiendeTicketsMkt: true`** en su rol y el ticket **sí es** de la categoría Marketing (ID 12).
    *   Si ninguna condición se cumple, se establece la cookie `siget_flash_unauthorized` y se redirige al dashboard (`/`), mostrando el mensaje de "no autorizado" al recargar.
    *   **Motivación:** Evitar que usuarios sin perfil de ingeniero accedan directamente a tickets ajenos pegando la URL en el navegador (e.g., `/tickets/view/7?new_entry=true`).

---

## 2026-06-23 (Mejoras y Restricciones en Traslados)

### Remoción de "Bloques" en Carrera
*   **`src/pages/tickets/soporte/traslado.astro`:**
    *   Se añadió una validación en la función `consultarDetalleAlumno` para limpiar el valor de la carrera devuelto por la API cuando el campus origen es `"Virtual"`.
    *   La limpieza remueve la palabra "Bloques" (independientemente de mayúsculas o minúsculas) y cualquier espacio en blanco precedente, asegurando que coincida exactamente con las opciones permitidas en `carreraOptions`.

### Restricción de Asignación de Auditores
*   **`src/pages/api/tickets/update.ts` (API):**
    *   Se implementó una validación robusta en el backend que verifica el `atiendeId` final contra el `auditor_docsId` y `auditor_reqId` (tanto los que llegan en el payload como los previamente existentes en la base de datos). Devuelve un error 400 si el ingeniero asignado coincide con alguno de los auditores del traslado.
*   **`src/pages/tickets/view/[id].astro` (Frontend):**
    *   Se añadió una validación defensiva en el manejador del botón `btn-save-transfer-changes` para evitar que el usuario intente guardar cambios si el ingeniero asignado coincide con el auditor de documentos o con el auditor de adeudos, mostrando un mensaje de advertencia mediante `toast.error`.
*   **`src/scripts/ticket-view-logic.ts` (Frontend):**
    *   Se integró la misma validación preventiva en la función de submit general `initEditForm` para garantizar la integridad y coherencia desde el envío del formulario.

### Selección por Defecto "Sin Asignar" en Auditores
*   **`src/pages/tickets/view/[id].astro` (Frontend):**
    *   Se modificaron los selectores de `auditor_docsId` y `auditor_reqId` agregando la expresión `selected={!traslado.auditor_docsId}` y `selected={!traslado.auditor_reqId}` en la opción de "Sin asignar" (`value=""`).
    *   Esto corrige el problema en el cual el navegador pre-seleccionaba por defecto al primer auditor de la lista (ej. Rogelio Elizalde o Angel Montes) cuando el ticket no tenía auditores asignados en la BD (valores `null`), forzando ahora a mostrar "Sin asignar".
    *   El backend en `src/pages/api/tickets/update.ts` y la serialización del formulario en el frontend ya gestionan correctamente el envío de la cadena vacía `""` convirtiéndola a `null` en la BD de Prisma.

---

## 2026-06-22 — Sesión 25 — Optimización de Navegación Global (Anti-Parpadeo) y Queries Paralelas

### Problema resuelto
Al cambiar entre vistas o aplicar filtros en las listas de tickets, el área de contenido central mostraba un **"parpadeo blanco"** (flash blanco) breve antes de cargar la nueva página. Esto ocurría porque `window.location.href` y `window.location.reload()` fuerzan una recarga completa del navegador, evitando el sistema de View Transitions de Astro.

### Solución implementada
Se reemplazó sistemáticamente **toda** navegación programática (`window.location.href = ...`, `window.location.reload()`) por `navigate()` de `astro:transitions/client` en los archivos de frontend, y se paralelizaron queries independientes de Prisma con `Promise.all()` en los endpoints de la API.

### Cambios en Frontend (navegación suave)

*   **Listas de Tickets de Soporte y Marketing:**
    *   `tickets/soporte/usuario/index.astro` — filtros, paginación y botón "Limpiar Filtros"
    *   `tickets/marketing/index.astro` — filtros, paginación y botón "Limpiar Filtros"
    *   `tickets/marketing/usuario/index.astro` — filtros, paginación y botón "Limpiar Filtros"
    *   **Patrón aplicado:** Se eliminó el atributo `onclick` inline del botón reset (que bloqueaba el uso de `navigate` del script) y se movió la lógica a un `addEventListener` dentro del bloque `<script>`. Todas las llamadas `window.location.href = url.toString()` se reemplazaron por `navigate(url.toString())`.

*   **Vista de Detalle de Ticket (`/tickets/view/[id].astro`):**
    *   Se agregó `import { navigate } from 'astro:transitions/client'` al bloque `<script>` principal.
    *   Se reemplazó `setTimeout(() => window.location.reload(), 1000)` (ejecutado tras guardar cambios de traslado) por `navigate(window.location.pathname + window.location.search)`.

*   **Listado de Usuarios (`/admin/usuarios/index.astro`):**
    *   La navegación al seleccionar una empresa/campus ya usaba `navigate()`. Se verificó que el buscador de autocompletado también usa `navigate()` correctamente.

### Cambios en Scripts TypeScript

*   **`src/scripts/ticket-view-logic.ts`:**
    *   Se reemplazó `window.location.href = \`...\`?new_entry=true\`` por un `import()` dinámico de `astro:transitions/client` para llamar `navigate()`. Esto mantiene el query param `?new_entry=true` que activa la animación de "flash" al nuevo entry del historial del ticket.

*   **`src/scripts/user-edit-form-logic.ts`:**
    *   Se reemplazó `window.location.reload()` (ejecutado al cambiar el rol de un usuario) por un `import()` dinámico de `navigate()` para mantener la transición suave al recargar la vista de edición.

### Cambios en API (queries paralelas)

*   **`src/pages/api/tickets/list.ts`:** Se paralelizaron `prisma.ticket.count()` y `prisma.ticket.findMany()` con `Promise.all()`, reduciendo la latencia percibida al listar tickets.
*   **`src/pages/api/dashboard/stats.ts`:** Se paralelizaron las queries de `groupBy`, `findFirst` (ciclo activo) y `findMany` (estatus) con `Promise.all()`.

---

## 2026-06-22 (Corrección de Restricción Única en Clave)
*   **Edición de Usuarios (`/api/admin/usuarios.ts`):**
    *   **Bug Fix Crítico:** Se solucionó el error 500 (Unique constraint failed on the fields: `clave`) al intentar guardar cambios en la edición de usuarios.
    *   **Causa Raíz:** Cuando el campo "Clave" se dejaba vacío, el formulario web enviaba una cadena vacía (`""`). Prisma intentaba actualizar el campo `clave` del usuario en la base de datos a `""`. Debido a la restricción de unicidad (`@unique`), si otro usuario ya tenía la clave vacía o si se intentaba guardar, fallaba.
    *   **Solución:** Se implementó una sanitización en la API del PATCH para que cualquier cadena vacía o que contenga solo espacios en blanco se guarde como `null` en la base de datos.
    *   **Depuración de Base de Datos:** Se ejecutó un script para limpiar y actualizar los registros existentes con clave vacía `""` a `NULL` en la base de datos de producción.
*   **Listado de Usuarios (`/admin/usuarios/[campus].astro`):**
    *   **Mejora de UX (Transición Suave):** Se implementó Astro `navigate` en la navegación al hacer clic en las filas de usuarios de la tabla. Esto activa el ClientRouter y el overlay de carga (`#page-loading-overlay`) para lograr una transición fluida y visualmente consistente con el resto de la aplicación, evitando reloads duros y parpadeos blancos.

## 2026-06-15 (Sesión 24 - Corrección Vista de Traslados)
*   **Vista de Detalle de Ticket (`/tickets/view/[id].astro`):**
    *   **Bug Fix Crítico:** Se corrigió un error que impedía mostrar la vista específica de traslados (campos de Matrícula, Campus Origen/Destino, Carrera, Bloque, Auditores, etc.) en la página de detalle de un ticket.
    *   **Causa Raíz:** El esquema de Prisma define la relación `Ticket → Traslado` como **uno-a-uno** (`Traslado?`), pero el código la trataba como un array, evaluando `ticket.traslados.length > 0` (siempre `undefined`) y accediendo con `ticket.traslados[0]`. Esto hacía que `isTraslado` fuera siempre `false` y se renderizara la vista genérica.
    *   **Solución:** Se actualizó la lógica de detección a `ticket.traslados != null` y el acceso al objeto a `ticket.traslados ?? null`, alineando el código con el esquema real de la BD.

## 2026-05-12 (Sesión 23 - Módulo de Reporte de Incidencias)
*   **Gestión de Incidencias (`/user/perfil/incidencias.astro` y `/api/user/incidencias.ts`):**
    *   **Rediseño Responsivo:** Se actualizó la interfaz para presentar una vista horizontal (tipo cuadrícula) en escritorio y vertical apilada en móviles.
    *   **Controles de Envío Granulares:** Se implementaron botones tipo *toggle switch* por incidencia para decidir si se envía o se omite el registro. Por defecto, los días pasados están en "Enviar" y el actual en "Omitir".
    *   **Validación de Captura:** Se estableció una restricción mínima de 5 caracteres en las observaciones obligatorias para habilitar el envío del registro.
    *   **Historial y Edición:** Se invirtió el orden cronológico (más reciente primero) y se integró un método GET para cargar las incidencias previamente guardadas. Estas se muestran deshabilitadas, pero se permite su edición y reenvío evitando registros duplicados.
    *   **Mejoras de UX:** Se añadió un botón adicional de guardado en la parte superior y se corrigieron conflictos CSS (`hidden` vs `flex`).
    *   **Distintivos Visuales de Horarios:** Se implementó una lógica de coloreado condicional en el texto de los registros de tiempo. En **rojo**, cuando la "Entrada laboral" excede la tolerancia (5 mins) o cuando la comida toma más de 30 minutos. En **verde**, cuando la "Entrada laboral" es una hora antes o más y la "Salida laboral" una hora después o más.

## 2026-04-02 (Sesión 21 - Integración de Vistas y Asignaciones de Marketing)
*   **Gestión de Tickets (Marketing):**
    *   **Vistas Diferenciadas:** La ruta `/tickets/marketing/usuario` ahora aplica estrictamente el filtro `atiendeId` para mostrar únicamente los tickets que el agente de Marketing tiene vigentes bajo su responsabilidad.
    *   **Asignaciones Condicionadas:** En la vista de detalle de ticket (`view/[id].astro`), si la categoría es Marketing (ID 12), el menú desplegable para reasignar ("Atiende") prefiltra exclusivamente a los usuarios de la empresa "Corporativo" que tienen los roles: 'Community manager', 'Director Marketing', 'Diseñador' o 'Editor'.

## 2026-03-18 (Sesión 17 - Estabilización de Permisos y Sidebar)
*   **Sidebar (`Sidebar.astro`):**
    *   **Refactorización:** Las opciones ahora se renderizan leyendo exclusivamente de las "secciones" configuradas vía JWT (RBAC dinámico puro) en lugar de variables globales "hardcodeadas".
    *   **Organización:** Se ordenaron alfabéticamente todos los sub-elementos de los menús (ej. *Dashboard, Mis Tickets, Todos*) y del grupo "Otros".
    *   **UX (Auto-Scroll):** Se restauró el auto-desplazamiento suave (`scrollIntoView`) para que al expandir menús grandes como "SiGeT" la vista baje sola si es necesario.
*   **Toggles Perfil (`/admin/usuarios/editar/[id].astro`):**
    *   Se corrigió la jerarquía DOM de los interruptores gráficos estilo Tailwind para que intercepten bien la pseudo-clase `peer-checked` y el círculo ruede de izquierda a derecha.
*   **Layout General (`MainLayout.astro`):**
    *   Cabecera inamovible (Sticky Header) garantizada fijando el body con `overflow-hidden` y permitiendo el movimiento interno del main content con `overflow-x-auto`.
*   **Carga CSV (`import-csv.ts`):**
    *   Se documentó la plena compatibilidad entre la API y el RBAC dinámico jerárquico.

## 2026-02-12 (Sesión 16 - Parte 2 - Refinamiento de Categorías)
*   **Mejoras en Filtrado (`/admin/categorias`):**
    *   **Lógica de Ocultamiento Inteligente:** Ahora se ocultan automáticamente las filas que no tienen información visible (es decir, donde tanto la categoría como todas las subcategorías muestran "-"), manteniendo la tabla limpia.
    *   **Filtros Contextuales:** Los dropdowns de subcategorías ahora solo muestran las opciones que están realmente visibles en la tabla, adaptándose dinámicamente a los filtros aplicados en niveles superiores.
*   **UX:**
    *   **Botón Restablecer:** Se añadió un botón "Restablecer" en el encabezado para limpiar rápidamente todos los filtros y mostrar la tabla completa.

## 2026-02-11 (Sesión 16 - Gestión de Categorías)
*   **Nueva Vista Administrativa (`/admin/categorías`):**
    *   **Página:** Se creó una nueva vista para visualizar categorías y subcategorías en formato jerárquico de tabla.
    *   **Consulta Profunda:** La query de Prisma obtiene hasta 5 niveles de subcategorías anidadas.
    *   **Eliminación de Repeticiones:** Se implementó lógica recursiva que reemplaza nombres repetidos con `-` y fondo gris claro (`bg-muted/30`), evaluando cada columna de forma independiente.
    *   **Columnas Dinámicas:** La tabla genera automáticamente las columnas de subcategoría según el nivel máximo encontrado en los datos.
    *   **Encabezados:** Renombrados de "Subcategoría Nivel X" a "Subcategoría X".
*   **Filtros Interactivos en Encabezados:**
    *   **Dropdowns:** Cada columna tiene un botón desplegable con checkboxes para filtrar.
    *   **Cascada:** Los filtros de subcategorías se actualizan dinámicamente mostrando solo las opciones relevantes según las filas visibles.
    *   **"Todos":** Checkbox "Todos" con estado indeterminado en las subcategorías.
*   **Integración en Sidebar:**
    *   Se añadió el enlace "Categorías" al menú de administración y al menú del Director de Marketing.
*   **Ordenamiento de Subcategorías:**
    *   Se cambió el `orderBy` en `/admin/tickets` de `nombre: "asc"` a `id: "asc"` para ordenar subcategorías por ID.

## 2026-01-24 (Sesión 15 - Historial Unificado de Traslados)
*   **Historial de Tickets:**
    *   **Lógica Unificada:** Se refactorizó `update.ts` para centralizar la detección de cambios, permitiendo el rastreo detallado de campos de traslado (Campus, Carrera, Descuento, Auditores).
    *   **Resolución de Nombres:** El historial ahora registra nombres legibles (ej. "Campus Tijuana" -> "Campus Guadalajara") en lugar de IDs opacos, realizando consultas adicionales a la base de datos cuando es necesario.
    *   **Integridad de Datos:** Se mejoró la detección de cambios para manejar correctamente valores vacíos y desasignaciones.
    *   **Corrección Frontend:** Se eliminaron filtros restrictivos en `view/[id].astro` que ocultaban los cambios de traslado y se agregaron campos ocultos para asegurar el envío de IDs originales.

## [0.5.0] - 2025-12-09


### Added
- **Edición Avanzada:** Descripción de tickets editable (textarea) y etiquetas dinámicas para campos de afectado.
- **Historial Mejorado:** Registro de cambios con nombres amigables para Estatus (ej. "Nuevo" -> "En progreso") y Agentes.
- **Vista Privilegiada:** Columnas adicionales ("Solicitante" + "Empresa") en "Mis Tickets" para agentes y administradores.
- **Filtros:** Botón "Limpiar Filtros" para restablecer rápidamente la vista.
- **Datos Extra:** Campos `afectado_clave` y `afectado_nombre` en base de datos y UI.

### Changed
- **UI Móvil:** Optimización de filtros a grid de 2 columnas para ahorrar espacio.
- **UI Tickets:** Cambio de etiqueta "Campus" a "Empresa".
- **Limpieza UI:** Ocultación de columna "Solicitante" en "Mis Tickets" para usuarios estándar.
## 2026-01-21 (Sesión 14 - Fixes de UI y Layout)
*   **Layout (Scrollbar):** Se solucionó el problema de la barra de scroll doble/incorrecta cambiando la altura del contenedor principal de `h-screen` a `h-full` en `MainLayout`.
*   **CSS:** Corrección de warnings de sintaxis de Tailwind para variables CSS (`h-[var(--...)]` -> `h-(--...)`).
*   **Dashboard:** Ajuste de altura (`h-full`) en `StatCard` para asegurar uniformidad en el grid.
*   **Traslados:** Optimización de tag de imagen (`Img` -> `img`) para mejor compatibilidad.

## 2026-01-22 (Sesión 14 - Parte 2)
*   **Adjuntos y Archivos:**
    *   **Corrección:** Se reparó el error 500 al descargar adjuntos (`key=undefined`) implementando un nuevo endpoint `/api/tickets/attachment`.
    *   **UI:** Nueva visualización en lista con icono y nombres separados por coma.
*   **Visualización de Ticket:**
    *   **Carrera:** Se corrigió el nombre de la carrera para incluir el nivel académico (ej. "Licenciatura en", "Maestría en") consultando la relación `Oferta`.
*   **Layout:**
    *   **Header Sticky:** Se implementó un encabezado fijo (`h-screen` en wrapper, `overflow-hidden` en contenedor y `overflow-y-auto` en `main`) para que no desaparezca al hacer scroll.

## 2026-01-19 (Sesión 13 - Parte 2)
*   **Base de Datos (Empresa):**
    *   Se añadió la columna `activa` (bool) a la tabla `Empresa`.
    *   Se actualizó el `seed.ts` para inicializar todas las empresas como activas.
    *   Ejecución exitosa de migración y seed.

## 2026-01-19 (Sesión 13 - Corrección CSV Import)
- **Notificaciones:** Corrección de colores en badges de estatus del dropdown.

## [0.9.4] - 2026-01-19

### Fixed
- **API Usuarios:** Corregido error 500 en carga masiva de usuarios por argumento inválido (`loading`) en la creación de Prisma.

### Added
- **Base de Datos:** Nueva columna `activa` (boolean) en la tabla `Empresa` con valor por defecto `true`.
- **Seed:** Actualización de datos de empresas para incluir el estado activo.

## [0.9.3] - 2026-01-17

### Added
- **Roles:** Se añadieron nuevos roles al seed (Ejecutivos acad/adm, Coordinadores, Soporte técnico) para cubrir la estructura organizacional completa (IDs 18-28).

## [0.9.2] - 2026-01-09

### Added
- **Gestión de Ciclos:** Panel administrativo para activar/desactivar ciclos escolares.
- **Validación de Ciclos:** Automatización de validación de ciclos activos al crear traslados.
- **Descuentos:** Sistema de autocompletado para el campo de descuento en traslados, sincronizado con la base de datos.
- **UX Search:** Búsqueda de campus y carreras insensible a acentos (normalización NFD).

### Changed
- **Optimización CSS:** Migración masiva de clases utilitarias (`flex-shrink-0` -> `shrink-0`, `flex-grow` -> `grow`) y simplificación de variables de tema (`var(--secondary)` -> `secondary`).
- **Sidebar:** Restauración de acceso al módulo de Ciclos para administradores.

### Fixed
- **API Traslados:** Error de sintaxis crítico (ReferenceError) y cierre prematuro de función en `transfer.api`.
- **UI Traslados:** Etiqueta del checkbox de descuento cambiada a "¿Tiene descuento? > Si".

### Removed
- **Código Muerto:** Eliminación del archivo `src/pages/tickets/view/ejemplo.astro`.

## [0.9.1] - 2026-01-07

### Fixed
- **API Traslados:** Error 500 en creación de tickets por nombre incorrecto de relación en Prisma (`usuario` -> `atiende`).

### Removed
- **Código Muerto:** Componente `NewTransfer.astro` eliminado tras migración exitosa.

## [0.9.0] - 2025-12-17

### Added
- **Traslados (UI/UX):** Mejoras visuales en autocompletado (bordes, navegación por teclado, estilos active/hover).
- **Traslados (Archivos):** Integración completa de carga de archivos (Drag & Drop, S3, Google Drive Picker).

### Changed
- **Lógica de Envío (Traslados):** Refactorización del flujo de creación a 3 pasos (Crear Ticket -> Subir Archivos -> Actualizar Ticket) para garantizar integridad de datos.

## [0.8.0] - 2025-12-14

### Added
- **Seguridad (Middleware):** Redirección automática de roles de Marketing fuera de `/admin` y desde raíz `/` a su dashboard específico.
- **Seguridad (UI):** Toast de "No tienes permisos suficientes" en `MainLayout` activado por query param `?unauthorized=true`.
- **Sidebar UX:** Expansión automática de la sección "Tickets Marketing" en el dashboard.

### Changed
- **Dashboard Marketing:** Reordenamiento de tarjetas (Total, Nuevos, En Progreso, En Espera) y funcionalidad de "Ver todo" (Toggle) para tarjetas ocultas.
- **Permisos Sidebar:** Staff de Marketing ahora ve `AddTicket` (CSH) y "Asistencia Remota", pero `NewTransfer` está explícitamente oculto.

### Fixed
- **Sidebar:** Error de compilación por duplicidad de variable `mainNavItems`.
- **Dashboard Marketing:** Enlace roto (botón sin funcionalidad JS) en "Ver todo".

## [0.7.0] - 2025-12-12

### Added
- **Marketing Separado:** Página dedicada de creación de tickets (`tickets/marketing/nuevo.astro`) con wizard simplificado.
- **Dashboard Marketing:** Estadísticas específicas ("Total", "Nuevos", "En Progreso") y ocultación de métricas irrelevantes.

### Changed
- **Sidebar:** Personalización de menú para roles de Marketing (ocultar soporte general, asistencia remota, base de conocimientos).
- **Layout:** Ajuste de ancho de dashboard (`w-full`) para eliminar scroll horizontal no deseado.
- **API:** Optimización de queries de Prisma para evitar bucles infinitos en vistas de Marketing.

## [0.6.0] - 2025-12-12

### Added
- **Transferencias:** Lógica completa de creación de tickets de traslado (Backend/Frontend).
- **Auditores:** Nuevos campos `auditor_docs` y `auditor_req` en usuarios.
- **RBAC Usuarios:** Roles estrictos para edición de usuarios (Editor Total vs Parcial).

### Changed
- **UI Edición Usuario:** Rediseño de checkboxes (Grid/Flex responsivo), restauración de cabecera y estilos personalizados para botón "Volver".

## [0.4.0] - 2025-12-04

### Added
- **Login:** Checkbox "Recordar este equipo" y sesión extendida a 30 días.
- **Drive:** Integración de solicitud de permisos de Google Drive en el login.
- **Prioridad:** Asignación automática de prioridad basada en el rol del usuario (`nivel_soporte`).

### Changed
- **Navegación:** Sidebar y botón "Volver" ahora mantienen el contexto ("Mis Tickets" vs "Todos") usando `?source=`.
- **Login:** Eliminación de la pantalla de consentimiento forzado de Google para usuarios recurrentes.
- **Drive:** Corrección de IDs para permitir borrado individual de archivos de Drive.

### Fixed
- Pérdida de contexto de navegación al ver detalles de tickets.
- Bug que impedía borrar archivos de Drive por incompatibilidad de tipos de ID.

## [0.3.0] - 2025-11-28

### Added
- **RBAC Híbrido:** Implementación completa de lógica de asignación (Usuario Específico > Rol > Fallback).
- **Componentes UI:** `StatusBadge` para estados de tickets y `SkeletonTable` para carga.
- **Diseño Responsivo:** Vista de tarjetas para móviles en listas de tickets.

### Changed
- **UI Tickets:** Eliminación de columna "Asunto" y reordenamiento de columnas (ID, Estatus, Solicitante, Categoría, Asignado a, Fecha).
- **Refactorización:** Migración de `tickets/soporte/usuario` a SSR para paridad visual y funcional.
- **Base de Datos:** Actualización de esquema para soportar prioridades y estados en asignaciones.

### Fixed
- Error de compilación por dependencia faltante (`date-fns`).
- Error 500 en creación de tickets (sincronización de cliente Prisma).

## [0.2.0] - 2025-11-27

### Added
- Sistema de notificaciones "toast" personalizado (reemplazando SweetAlert2).
- Conteo de usuarios por empresa en dashboard de admin.
- Estilos hover mejorados y filas clickeables en listas de tickets y usuarios.
- Soporte completo para tema oscuro en todos los componentes UI.

### Changed
- Migración completa de alertas a toasts en toda la aplicación.
- Mejora de UX en lista de usuarios (eliminación de columna acciones).
- Optimización de scripts de cliente para compatibilidad con View Transitions.

### Fixed
- Persistencia del tema oscuro al navegar entre páginas.
- Error de renderizado en scripts de edición de usuarios.
- Múltiples correcciones de tipos TypeScript en API y frontend.

---

## [0.1.0] - 2025-09-25

### Added
- Implementación inicial de SiGeT V2.0
- Sistema de autenticación con Auth.js y Google OAuth
- Gestión de tickets con estados y prioridades
- Dashboard con estadísticas
- Filtros dinámicos en lista de tickets
- Sistema de notificaciones SSE básico
- Integración con AWS S3 para adjuntos
- Roles y permisos básicos

### Changed
- Migración de SiGeT V1 a V2 con Astro 5
- Rediseño completo de UI con TailwindCSS 4
- Actualización de base de datos con Prisma

**Commits:** Múltiples commits iniciales

---

## Tipos de Cambios

- **Added** - para funcionalidades nuevas
- **Changed** - para cambios en funcionalidades existentes
- **Deprecated** - para funcionalidades que serán eliminadas
- **Removed** - para funcionalidades eliminadas
- **Fixed** - para corrección de bugs
- **Security** - para vulnerabilidades de seguridad

---

## Versionado

El proyecto usa [Versionado Semántico](https://semver.org/lang/es/):

- **MAJOR** (X.0.0): Cambios incompatibles en la API
- **MINOR** (0.X.0): Nueva funcionalidad compatible con versiones anteriores
- **PATCH** (0.0.X): Correcciones de bugs compatibles

---

**Última actualización:** 2025-12-09
