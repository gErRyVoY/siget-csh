# Plan de Trabajo (SIGET-CSH)

> [!WARNING]
> **Flujo de Despliegue (CI/CD):** No se deben realizar dos `git push` seguidos al repositorio. El último fallará debido al tiempo que le toma a AWS App Runner procesar y completar el despliegue automático del commit previo. Se debe hacer **un solo `git push`** cuando sea solicitado y esperar a que finalice la compilación/despliegue en curso.
>
> **⚠️ REGLA CRÍTICA PARA EL ASISTENTE:** El asistente **NO debe ejecutar `git push`** en ninguna circunstancia a menos que el usuario lo solicite **de forma explícita**. Se permiten `git add` y `git commit` para preparar los cambios, pero el push queda **reservado exclusivamente para cuando el usuario lo indique**.

**Tarea Actual:** Completada — Rediseño de Edición de Usuarios y Validaciones de Asignación de Tickets (2026-07-27) ✅

**Estado:** Completado.
1. Se dividió el panel de categorías en dos subsecciones: **"Habilitadas"** y **"Sin acceso"**, ordenadas alfabéticamente A-Z en un grid responsivo (2 cols desktop / 1 col tablet-móvil).
2. Se implementaron las restricciones visuales y lógicas según el rol objetivo (**Usuario**, **Admin** y **Superadmin**) en `/admin/usuarios/editar/[id]`.
3. Se integraron listeners dinámicos en el cliente (`user-edit-form-logic.ts`) para sincronizar toggles (como la desactivación en cascada al apagar `Activo`) y recarga de vista tras guardar.
4. Se agregó la función `canAgentBeAssignedManually` en `ticketAssignmentService.ts` y se aplicó en `api/tickets/update.ts` para garantizar que la asignación manual requiera tener habilitada la categoría/subcategoría y el flag `atiende_csh`/`atiende_mkt`.
5. `npx astro check` validó la aplicación con **0 errores**.

**Pasos Siguientes:**
1. Monitoreo general y feedback del usuario.

**Pasos Completados:**
- ✅ **Rediseño de Edición de Usuarios y Validaciones de Asignación de Tickets (2026-07-27):** Categorías organizadas en subsecciones "Habilitadas" y "Sin acceso" (A-Z, grid responsivo); componentes y toggles de edición de usuarios condicionados estrictamente por rol (Usuario, Admin, Superadmin); sincronización dinámica de toggles y recarga de vista; validación de asignación manual de tickets verificando flag `atiende_csh/mkt` y permisos de categoría. `npx astro check` 0 errores.
- ✅ **Permisos Granulares de Atiende, Fix Selects Flashing y Marketing para Rol Usuario (2026-07-24):** Implementada lógica `canEditAtiende` en frontend y backend (Superadmin siempre; Admin solo si asignado y no creador; Usuario nunca). Corregido bug de selects con valor obsoleto al guardar, reemplazando `navigate()` View Transitions por `window.location.assign()`. Habilitadas secciones `crear_ticket_marketing` y `marketing_mis_tickets` para rolId=1 en seed y BD via script. `npx astro check` 0 errores.
- ✅ **Actualizaciones de UI/UX en Vistas de Tickets y Dashboard de Marketing (2026-07-24):** Aplicada paridad de diseño y restricciones de roles entre Soporte y Marketing: botón "Volver" estilizado, descripción sólo lectura, visibilidad de toggle archivado y prefijo "Solicita:" condicionada por rol, ocultamiento de solicitante para colaboradores, filtros de fecha en marketing/usuario, separación de tickets por categoría, dashboard con pestañas para marketing y spinner dorado de carga. `npx astro check` pasó con 0 errores.
- ✅ **Excepción de Inicio de Sesión para Usuario de Prueba (2026-07-23):** Omisión de validación con la API de RH y comprobación de OU en `auth.config.ts` para `alumno.prueba1@humanitas.edu.mx` con el fin de permitir pruebas con rol de usuario.
- ✅ **Ajustes de Edición de Usuario y Permisos de Perfil (2026-07-23):** Reestructurada la edición de usuarios para mostrar `puesto` como solo lectura. Permitido acceso a Administradores/Superadministradores (roles 2 y 3) a las páginas `/user/perfil` y `/user/perfil/incidencias`. Sanitizados `empresaId` y `rolId` en el submit de edición. `astro check` pasó con 0 errores.
- ✅ **Mejoras de UI en Listados de Tickets y Dashboard (2026-07-23):** Reestructurados los filtros de `/tickets/soporte`, `/tickets/marketing` y `/tickets/soporte/usuario` en dos filas (`grid-cols-4`): selectores en fila 1 y fechas "Desde/Hasta" en fila 2. El filtro de fechas solo navega cuando ambas fechas tienen valor. Se aplicaron colores de antigüedad (verde/amarillo/rojo) a la columna de fecha en la tabla desktop de `/tickets/soporte/usuario`. El Dashboard General se reorganizó en 3 filas con `Cancelados` solo en la 3ª fila alineado a la izquierda.
- ✅ **Renombrar Sección a GENERALES e Integrar Modo Oscuro (2026-07-23):** Se cambió la denominación del grupo de secciones de "Otros" a "GENERALES" en `/admin/secciones`, `/admin/roles`, edición de usuarios y `seed.ts`. Se incorporó la opción de "Modo Oscuro" (`feature_dark_mode`) posicionada al inicio de la lista de GENERALES, permitiendo a los administradores habilitar/inhabilitar el toggle de tema oscuro globalmente.
- ✅ **Despliegue a Repositorio (2026-07-22):** `git push` completado exitosamente a la rama `siget-apprunner-new` (commit `33e98d1`). AWS App Runner iniciando compilación y despliegue automático.
- ✅ **Activación de Asignación y Validación 100% Exitosa (2026-07-22):** Se activó `atiende_csh=true` en el rol 2 (`admin`) habilitando la asignación automática a los 8 agentes del equipo. Se resincronizó la columna `carga_actual` con `scripts/sync-carga-actual.ts` (7 usuarios corregidos). La suite de validación `scripts/validate-flows.ts` alcanzó **23/23 pruebas pasadas (100% OK)**.
- ✅ **Pruebas y Validación General (2026-07-22):** Se creó y ejecutó el script `scripts/validate-flows.ts` (5 suites: catálogos, asignación, tickets, middleware RBAC, traslados). Se documentaron hallazgos críticos de asignación y desincronización de `carga_actual`. Se creó `scripts/sync-carga-actual.ts` para corregir contadores.
- ✅ **Refactor y Seguridad Integral en Middleware (2026-07-22):** Refactorizado `src/middleware.ts` para responder status `401` JSON en endpoints `/api/*` sin sesión activa, validar secciones en rutas con ordenamiento por longitud descendente de `sectionRouteMap`, y añadir cabeceras HTTP de seguridad (`X-Frame-Options`, `X-Content-Type-Options`, `COOP`, `CEOP`, `Referrer-Policy`). Se validó compilación 100% limpia con 0 errores en `npx astro check`.
- ✅ **Refactor de Lógica de Asignación Avanzada (2026-07-22):** Refactorizado `src/services/ticketAssignmentService.ts` para validar permisos híbridos (`atiende_csh`/`atiende_mkt` en Usuario o Rol), verificar disponibilidad con `acepta_tickets`, y formatear horarios 24h en la zona horaria `America/Mexico_City`. Se incluyó desempate determinista por carga e ID, y validación de usuarios activos al asignar manualmente en `api/tickets/update.ts`. Se corrigieron errores de TypeScript en la app alcanzando 0 errores en `npx astro check`.
- ✅ **Restauración de BD y Hardening del Seed v2 (2026-07-22):** El seed borró datos transaccionales al ejecutarse con `FORCE_CLEAN=true`. Se creó el script `scripts/restore-backup.ts` que restaura datos desde el backup JSON más reciente, mapeando el esquema anterior al actual (rolId viejo → 1/2/3, columnas renombradas, defaults para campos nuevos). Se restauraron 100 usuarios, 20 tickets, 9 traslados, 41 historiales y 123 incidencias. El `seed.ts` fue refactorizado con doble protección: `FORCE_CLEAN=true` solo limpia catálogos estáticos; para borrar datos transaccionales se requiere además `FORCE_CLEAN_TRANSACTIONAL=true`.
- ✅ **OU Early Adopters en Login (2026-07-22):** Se añadió la Unidad Organizativa `Early Adopters` como válida en el callback `signIn` de `auth.config.ts`, además de `Colaboradores`. Se corrigió simultáneamente un `ReferenceError: userData is not defined` causado por el reordenamiento accidental de las líneas de asignación.
- ✅ **Doble Filtro de Autenticación y Cotejo de Puesto (2026-07-21):** Se implementó la validación obligatoria con Google (dominio `@humanitas.edu.mx` y verificación de Unidad Organizativa "Colaboradores"). Se añadió un segundo filtro obligatorio contra la API de Recursos Humanos; si el correo no devuelve datos del trabajador, el inicio de sesión es bloqueado devolviendo el error `ColaboradorNoActivo`. Si el colaborador es válido, se coteja su puesto actual en la base de datos contra el puesto arrojado por la API de Recursos Humanos (`desc_puesto`), actualizándose en la BD si existe alguna diferencia.
- ✅ **Reestructuración de Roles y Permisos (2026-07-21):** Se implementó el esquema simplificado de 3 roles. Se eliminaron roles antiguos del seed y permisos de categoría obsoletos. Se migró la consulta de privilegios, visualización de menú de perfil, asignación de tickets, y APIs (`usuarios.ts`, `empresa.ts`, `toggle-flags.ts`, etc.) para basarse en campos a nivel de usuario individual (`atiende_csh`/`atiende_mkt`, `tckt_csh`/`tckt_mkt`, `puesto`, `alias`). Se integraron inputs y toggles de control a las vistas de edición y campus. El proyecto compila al 100%.
- ✅ **Corrección de Filtros y Refinamientos UX en Categorías (2026-07-20):** Se refinó la UI de `/admin/categorias`: el botón eliminar ahora se oculta si el nodo tiene subcategorías relacionadas; se corrigió la orientación de las flechas del acordeón (cerrado `→` / abierto `↓`); se añadió color guinda (`#800020`) con texto en blanco para hovers y elemento seleccionado; se implementó el guard de seguridad para cerrar/finalizar edición y creación con ESC/clicks externos; y se integró un toast confirmando la habilitación/ocultación al pulsar el ojo. Asimismo, se corrigió el bug del filtro de tickets en los listados (soporte y marketing) donde no volvía a filtrar al cambiar más de una vez, moviendo todos los event listeners de filtros, paginación y filas al evento `astro:page-load` de Astro.
- ✅ **Módulo de Categorías y Sincronización de Secuencias (2026-07-20):** Rediseñada la interfaz de `/admin/categorias` con visualización jerárquica recursiva en acordeón. Integrada lógica de activación (ojo abierto/cerrado), adición inline (+), edición/eliminación condicionada a tickets registrados, persistencia de estado en acordeones usando `sessionStorage` y scroll con animación de resalte. Los wizards de creación de tickets ahora consultan la BD dinámicamente de forma activa. Se resolvió un error de clave duplicada (`id`) debido al desfase de secuencias de PostgreSQL tras seeding manual, implementándose el script de corrección `scripts/sync-sequences.ts` e incorporando la auto-sincronización al final de `prisma/seed.ts`.
- ✅ **Restauración de BD y Hardening del Seed (2026-07-20):** Se produjo un incidente donde `seed.ts` borró datos transaccionales al ejecutar `deleteMany()` sin condición. Se restauró la BD desde el snapshot del 17-jul-2026 a las 03:00 AM en la instancia `siget-db-dev-restored-v2`, recuperando 100 usuarios, 21 tickets, 9 traslados y 123 incidencias. Se aplicó `ALTER TABLE "usuario" RENAME COLUMN "vacaciones" TO "acepta_tickets"` para sincronizar el schema con el código actual. El `seed.ts` fue refactorizado: todos los `deleteMany()` requieren `FORCE_CLEAN=true` y todos los `createMany()` tienen `skipDuplicates: true`. Se crearon scripts de mantenimiento en `scripts/` (`validate-db.ts`, `inspect-columns.ts`, `fix-missing-columns.sql`). El secreto `DATABASE_URL` en AWS Secrets Manager fue actualizado al nuevo host.
- ✅ **Consulta a API de RH en Inicio de Sesión y Complementación de Clave (2026-07-18):** Se ajustó la URL de consulta de la API de RH en `auth.config.ts` para que apunte por defecto a `https://pz3bmmqsty.us-east-1.awsapprunner.com`. Se optimizó la lógica del callback de login para que al obtener la clave del trabajador (`trabajador`), esta se guarde en la BD en la columna `clave` solo si dicha columna se encuentra actualmente vacía (nula).
- ✅ **Renombrar Toggle "Vacaciones" → "Asignar tickets" (2026-07-18):** Se actualizó la lógica de disponibilidad del ingeniero renombrando el campo de BD `vacaciones` a `acepta_tickets` con valor `@default(true)`. El toggle del menú se modificó visualmente: apagado dice `"No asignar tickets"` y encendido (activo por defecto) dice `"Asignar tickets"`. Se actualizaron las interfaces de usuario del perfil, la vista administrativa de usuarios (`[campus].astro` y editar) y las llamadas API. Por último, se robusteció la asignación automática en `ticketAssignmentService.ts` considerando solo agentes con `acepta_tickets: true` y dentro de horario. Adicionalmente, se corrigieron todos los warnings y errores de tipado de TypeScript en `[campus].astro`, `auth.config.ts` y `UserProfile.astro` para mantener el proyecto con compilación 100% limpia.
- ✅ **Pulido Final y Correcciones de UI en Incidencias (2026-07-16):** Se ocultaron dinámicamente los campos de motivos cuando un día se encuentra como "Omitir". Se corrigió la leyenda "Horario excedido" en la UI de modo que solo aparezca si el periodo de almuerzo efectivamente se excede. Se simplificó la leyenda en los reportes a "A tiempo". Se corrigieron las tablas del correo y preview para pintar registros de comida incompletos/parciales (mostrando los que haya y al final `SL (-:--)`). Se eliminó el texto de semanas del asunto del correo quincenal.
- ✅ **Toggles Homeoffice/Vacaciones en Incidencias (2026-07-16):** Se añadieron toggles dinámicos en tarjetas de inasistencia. Homeoffice solo aparece en sábados; Vacaciones en cualquier día. Son mutuamente excluyentes. Al activarse: cambia el label de "Inasistencia" a la etiqueta especial, oculta el campo "Motivo (Turno)", limpian el textarea. El valor se guarda como `observaciones`. La tabla calendario del preview y del correo muestra fondo morado (`#ede9fe`) y texto morado (`#7c3aed`) para estos casos. La leyenda incluye la nueva entrada de "Homeoffice / Vacaciones". El preview se regenera al instante al cambiar los toggles.
- ✅ **Actualización de Vista, Iconos y Previsualización de Incidencias (2026-07-16):** Se añadió la columna `omitida` a la BD de incidencias y se integró su flujo de persistencia. Se rediseñó la barra de botones en el listado sustituyendo los textos por íconos minimalistas con tooltip (Ojo para previsualizar, Calendario para la tabla, Sobre para enviar y Disco 3½ para guardar). Se agregó un modal `#preview-reporte-modal` que renderiza una previsualización en vivo del correo del reporte (incluyendo asunto, tabla calendario alineada, leyenda y justificaciones no omitidas). Se alinearon los colores de tarjetas, se eliminó la advertencia de comida excedida para incompletos, y se implementó el cierre de modales con click fuera o Esc.
- ✅ **Redirección Post-Ticket y Mejoras de Notificaciones (2026-07-15):** Se corrigió la redirección post-creación de tickets: ahora `nuevo-ticket-csh.astro` y `nuevo-ticket-marketing.astro` calculan en SSR si el usuario tiene `soporte_dashboard`/`marketing_dashboard` y pasan la URL destino correcta vía `data-redirect-url` al wizard. Los wizards (`ticket-wizard.ts` y `marketing-ticket-wizard.ts`) leen ese atributo para redirigir correctamente. Se rediseñó el dropdown de notificaciones en `MainLayout.astro`: nuevo formato (Ticket #N / #TRL-N para traslados, badge de estatus, Solicitante/Atiende según rol, empresa y subcategoría/categoría), botón "Omitir" por ítem con animación de colapso, persistencia de omisiones en `localStorage` (clave `siget_dismissed_notifications`, máx 200 IDs), y click en cualquier item (incluyendo Solucionado) ahora descarta la notificación. Se actualizó `api/notifications/list.ts` para incluir `atiende`, `subcategoria`, `empresa` y `traslados` en el include de Prisma.

- ✅ **Campus Virtual como Origen por Empresa (2026-07-08):** Se agregó la columna `tckt_virtual` a `Empresa` en la BD (db push + prisma generate). Se creó el endpoint `api/admin/empresa` (GET/PATCH) con registro de Logs. Se añadió un toggle switch de configuración en el listado por campus y se desarrolló una nueva vista global en `/admin/empresas` con filtros y toggles de control. Por último, se adaptó el formulario de traslados para precargar y permitir edición flexible según este flag (Opción A).
- ✅ **Sustitución de carga de imagen por Tabla HTML en el Reporte de Incidencias (2026-07-01):** Se eliminó la lógica de subida de archivos a S3 (AWS SDK, URL firmadas, Drag & Drop, Google Drive Picker) del flujo de envío de reportes de incidencias. En su lugar, el backend genera una tabla HTML calendario responsiva con estilos CSS 100% inline (compatible con reenvío en Gmail/Outlook), incluyendo colores condicionales para EL/SL y una leyenda de estados. El modal de confirmación fue simplificado. El proyecto compila con éxito.
- ✅ **Filtros de Quincena y Reposición de Horario (2026-06-30):** En la vista de incidencias, se implementaron botones dinámicos para filtrar registros de Quincena 1 (días 1-15) y Quincena 2 (días 16 en adelante) de forma sincronizada si se detecta que los registros superan el día 16. Además, se configuró la lógica para detectar reposiciones de tiempo (entrada antes del horario de entrada laboral y salida después del de salida) marcándolas en color verde.
- ✅ **CSS Inline en Notificaciones por Correo (2026-06-29):** Se refactorizaron los estilos CSS a formato 100% inline en `src/services/emailService.ts` y en las plantillas de `prisma/seed.ts` (usando `upsert` para que sea idempotente) garantizando que el diseño institucional (colores dorado, guinda y estructura de botones) sobreviva al reenvío del correo en clientes de email (como Gmail u Outlook) que remueven la etiqueta `<style>` del `<head>`.
- ✅ **Botón de Resetear Horario (2026-06-25):** Se implementó un botón en la UI de edición de usuarios dentro del desplegable "Horario de disponibilidad". Este botón permite restablecer a "No disponible" todos los días laborales de forma masiva en el cliente, mostrando un mensaje toast de confirmación y con un estilo centrado, gris y animado al hover consistente con el resto de la interfaz.
- ✅ **Integración de AWS SES y Notificaciones por Correo (2026-06-25):** Se implementó el servicio de correos centralizado (`src/services/emailService.ts`) que gestiona el envío de correos transaccionales mediante el SDK de AWS SES y registra las notificaciones en la tabla `notificaciones_correo` de Prisma. Se integró en la creación de tickets, flujos de traslados y actualizaciones (reasignación de agentes, cambios de estatus y nuevos comentarios) con lógica asíncrona en segundo plano para evitar bloqueos y soporte auto-reparable de plantillas en base de datos. Se validó la compilación exitosa del proyecto.
- ✅ **Descuento y Notificaciones (2026-06-23):** Se corrigió el bug del checkbox "¿Tiene descuento?" en la vista de detalle de tickets (que se marcaba por defecto al existir el descuento `1` / `"N/A"`). Se agregaron optimizaciones de base de datos (`take: 100`) para acelerar la consulta de notificaciones de usuarios comunes, un spinner inmediato al abrir el dropdown de notificaciones y la animación de parpadeo blanco (overlay de carga) al hacer clic sobre cualquier notificación.
- ✅ **Indicador de Carga en Búsqueda de Alumno (2026-06-23):** Se modificó la librería de toasts (`toast.ts`) para devolver un manejador con función `.dismiss()`. En el formulario de traslados, al consultar la API de alumnos, se muestra un toast temporal con spinner SVG (`"Buscando alumno..."`) y se descarta al obtener respuesta.
- ✅ **Sin Asignación Automática de Auditores en Traslados (2026-06-23):** Se eliminó la búsqueda y asignación automática de `auditor_docsId` and `auditor_reqId` al crear nuevos tickets de traslado en `api/tickets/transfer.ts`. Ahora ambos campos inician en `null` y deben ser asignados manualmente en la vista de detalle. También se removieron los auditores del listado de destinatarios SSE al crear el traslado.
- ✅ **Sincronización de Horario al Editar Usuarios (2026-06-23):** Se implementó una recarga suave automática de la vista de edición de usuarios cuando la clave ha sido modificada al hacer clic en "Guardar cambios", permitiendo que los campos de horario de disponibilidad se refresquen instantáneamente con los datos sincronizados desde la API de RH mediante SSR. Además, se agregaron indicadores visuales al enviar el formulario (deshabilitar botón, cambiar texto a `"Guardando..."` y activar el overlay de carga).
- ✅ **Indicador de Carga en Lista de Usuarios (2026-06-23):** Se integró un spinner e indicador visual de carga ("Cargando usuarios...") en la tabla de usuarios de `[campus].astro` durante la consulta HTTP a la API. Esto previene que la tabla se muestre vacía al navegar hacia atrás o cambiar de campus.
- ✅ **Control de Acceso Granular a Vista de Ticket (2026-06-23):** Se implementó verificación de permisos SSR en `tickets/view/[id].astro`. Solo pueden ver un ticket: (1) el solicitante que lo creó, (2) usuarios con rol privilegiado CSH para tickets no-Marketing, (3) agentes de Marketing para tickets de esa categoría. Si no se cumple ninguna condición, se redirige a `/` con la cookie `siget_flash_unauthorized`.
- ✅ **Restricción de Asignación de Auditores en Traslados (2026-06-23):** Implementada validación en el frontend (formulario de traslados y submit general) y en el backend (API patch) para evitar que el ingeniero asignado al ticket ('Atiende') coincida con el auditor de documentos o con el auditor de adeudos.
- ✅ **Remoción de "Bloques" en Carrera (2026-06-23):** Implementada validación en el formulario de traslados (`consultarDetalleAlumno`) para remover la palabra "Bloques" (y el espacio previo) al consultar alumnos con campus origen "Virtual", asegurando la coincidencia exacta con `carreraOptions` y pasando la validación de oferta académica.
- ✅ **Selección por Defecto "Sin Asignar" en Auditores (2026-06-23):** Se configuraron los dropdowns de auditores en la vista de detalle de traslados para seleccionar la opción "Sin asignar" por defecto cuando no hay auditores definidos en la BD (valores `null`), en lugar de mostrar de forma automática el primer usuario de la lista.
- ✅ Implementada validación en el login de `auth.config.ts` consultando la API `/api/rh/consultar-trabajador` para obtener la `clave` y posteriormente sincronizar el `horario_disponibilidad` guardándolo en BD.
- ✅ Añadidas columnas `alias` (Usuario), `atiendeTicketsCsh` y `atiendeTicketsMkt` (Rol) a la base de datos vía SQL directo para evitar la congelación del cliente `dev`.
- ✅ Actualizado el sistema de Roles (`auth.config.ts`) para incluir y propagar los nuevos campos sin alterar el `DefaultSession["user"]` negativamente.
- ✅ Menú desplegable global de Astro (`UserProfile.astro`) reestructurado para ofrecer lógicas diferenciadas según si el rol del usuario actualizador tiene flags para atender tickets.
- ✅ Creada nueva interfaz `/user/perfil` exclusiva para agentes de CSH / Marketing con gestión de horarios, *toggle* de vacaciones rápidas ("En Oficina" / "De Vacaciones") y creación de Alias.
- ✅ Interfaz de `/admin/roles` mejorada con *Toggles* compactos adicionales para declarar globalmente si los usuarios de un rol pueden fungir como receptores de tickets.
- ✅ Resuelto el bug crítico del Picker de Google Drive: se corrigió el Client ID desactualizado ("deleted_client") purgando el caché de Vite, se limpiaron los CRLF de las variables de entorno (`.trim()`) y se puenteó el error "The API developer key is invalid" (400) prescindiendo de `.setDeveloperKey()` para depender exclusivamente de la autenticación OAuth mediante el token de sesión.
- ✅ Auditoría y Restauración de Roles RBAC: Se restauraron y sincronizaron los accesos completos de categorías en la base de datos de producción para "Ingeniero soporte 1", "Ingeniero Hubspot", y "Soporte técnico".
- ✅ **Auditoría de BD y Seed:** Se detectó que las tablas de Categorías y Subcategorías estaban vacías en producción (AWS RDS). Se confirmó que el archivo `seed.ts` es correcto. La pérdida de datos se debió a un fallo en un despliegue anterior donde el seed borró las tablas pero se interrumpió antes de poblarlas. Se ejecutó exitosamente el seed completo en RDS restaurando las **12 categorías** y **142 subcategorías** faltantes.
- ✅ Autenticación (API key) añadida al endpoint de Traslados y refactorización del dropdown de Asignación de Agentes con la nueva lógica RBAC.
- ✅ Implementado buscador dinámico (autocompletado) de usuarios en la vista administrativa e integrado control dinámico (BD) del Modo Oscuro.
- ✅ Corregido error 500 al guardar usuarios editados (Unique constraint failed en la columna `clave`) sanitizando valores vacíos a `null` y limpiando la base de datos.
- ✅ **Optimización de Navegación Global (Sesión 25):** Se eliminó el "parpadeo blanco" en todas las transiciones de vistas reemplazando `window.location.href` y `window.location.reload()` por `navigate()` de `astro:transitions/client`. Afecta: listas de tickets (soporte y marketing), vista de detalle, formularios de edición de usuario y ticket. Se utilizaron `import()` dinámicos de `navigate` en los scripts `.ts` para compatibilidad fuera del contexto Astro.
- ✅ **Queries paralelas (API):** Se paralelizaron `count()` + `findMany()` en `api/tickets/list.ts` y múltiples queries en `api/dashboard/stats.ts` con `Promise.all()` para reducir latencia.

**Pasos Siguientes (Próxima Iteración):**
1.  **Seguridad Adicional y Middleware:**
    - Terminar validación del `middleware.ts` para proteger absolutamente todas las rutas backend/frontend en base al token de Secciones Híbridas.
    - Lógica de Soporte de Niveles: Implementar `nivel_soporte` de manera dinámica.
2.  **Lógica de Asignación Avanzada (Refactor final):**
    - Refactorizar las reglas de creación y asignación inteligente (`create.ts` / `update.ts`) para honrar a totalidad las variables nativas creadas: `vacaciones`, `atiendeTicketsCsh/Mkt` y `horario_disponibilidad`.

**Documentos de Referencia:**
- `CHANGELOG.md`: Registro de cambios del proyecto
- Artifacts: Planes de implementación detallados en `.gemini/antigravity/brain/`

---
*Este plan se actualizará al finalizar cada tarea.*
---

# Persona y rol
Eres "**ScrumBot**", un Asesor Experto en DevOps y SCRUM. Tu rol es ser el Tech Lead y Scrum Master del equipo de desarrollo de la Universidad Humanitas.

Tu objetivo principal es guiar al equipo en el desarrollo de sus proyectos, especialmente el Sistema de Gestión de Tickets (SiGeT) V2.0, asegurando la implementación de las mejores prácticas ágiles y de DevOps.

# Base de Conocimiento
## 1. Áreas de Especialización
* **Metodología SCRUM:** Eres un Scrum Master experimentado. Ayudas a definir y refinar el backlog, planificar sprints de 2 semanas, crear historias de usuario, facilitar las ceremonias (planning, daily, review, retro) y asegurar el cumplimiento de los valores SCRUM (Compromiso, Coraje, Foco, Apertura y Respeto).
* **Cultura DevOps y SDLC:** Conoces a fondo los principios de DevOps para automatizar el ciclo de vida del software (planificación, diseño, desarrollo, pruebas, despliegue y mantenimiento), mejorando la colaboración y acelerando la entrega de valor.
* **Stack Tecnológico (SiGeT V2.0):**
    * **Framework Frontend:** Astro.js 5.10 (con TypeScript)
    * **Backend:** Node.js (con TypeScript)
    * **Estilos:** TailwindCSS
    * **Autenticación:** Auth.js (para login con Google)
    * **Contenerización:** Docker
    * **Cloud & CI/CD:** AWS (ECR, App Runner, Secrets Manager, RDS), GitHub Actions
    * **Base de Datos:** PostgreSQL (gestionada con AWS RDS)
* **Herramientas de Gestión:** Tienes experiencia con Jira, Trello, Asana, etc., pero recomiendas GitHub Projects por su integración nativa con el stack actual del equipo.

## 2. Contexto de Proyectos (Product Backlog General)
A continuación se listan los proyectos prioritarios. Tu tarea es ayudar a refinarlos en historias de usuario y gestionarlos en Sprints.

1. **Prioridad 1:** Sistema de Gestión de Tickets (SiGeT) V2.0
    * **Objetivo:** Actualizar y mejorar el sistema de tickets existente.
    * **Requerimientos iniciales:** Definir nuevas funcionalidades, mejorar la interfaz de usuario (UI/UX), optimizar el rendimiento y la seguridad.

2. **Prioridad 2:** Proyecto en AWS
    * **Objetivo:** Crear una infraestructura escalable y con alta disponibilidad para un CRM existente.
    * **Tareas clave:**
        1. Crear una Amazon Machine Image (AMI) a partir de la instancia EC2 actual del CRM.
        2. Crear un grupo de Auto Scaling utilizando la AMI generada.
        3. Adjuntar un Elastic Load Balancer al grupo de Auto Scaling.

3. **Prioridad 3:** Automatización de Traslados desde CRM
    * **Objetivo:** Generar un manual de requerimientos técnicos para solicitar a un tercero la automatización de un proceso.
        - **Nota:** Este proyecto es de análisis y documentación, no de implementación.

4. **Prioridad 4:** Base de Conocimientos para SiGeT
    * **Objetivo:** Diseñar e integrar un módulo de base de conocimientos dentro de SiGeT.

5. **Prioridad 5:** Herramienta SCRUM en SiGeT
    * **Objetivo:** Añadir funcionalidades de seguimiento de proyectos SCRUM directamente en SiGeT.

## 3. Equipo de Desarrollo
* **Composición:** 2 programadores Full Stack.
* **Estado actual de SiGeT V2.0:**
    * **Diseño UI/UX:** Finalizado (paleta de colores definida).
    * **Autenticación y Roles:** Concluido. Se usa Auth.js con el dominio de Google (**_@humanitas.edu.mx_**). La configuración en Google Cloud Console permite obtener la Unidad Organizativa (OU) del usuario, dato clave para la gestión de roles y permisos en la aplicación.
    * **Infraestructura y Despliegue (CI/CD):** Implementado. El flujo con GitHub Actions, Docker, AWS ECR, Secrets Manager y App Runner está operativo.

# Historial de Cambios (Log)
## 2026-07-15 (Lógica Avanzada de Asignación de Tickets v2)
*   **Servicio de Asignación (`src/services/ticketAssignmentService.ts`):**
    *   **Horario Obligatorio:** Un agente **sin `horario_disponibilidad`** definido ya no se considera disponible. Aplica para tickets **CSH y Marketing** por igual (antes Marketing no validaba horario).
    *   **Asignación Forzada por Unicidad:** Si la categoría/subcategoría elegida tiene exactamente **un único candidato** en la BD (excluyendo al solicitante), el ticket se asigna a ese candidato aunque esté fuera de horario o de vacaciones.
    *   **Eliminación del Fallback S-1:** Se eliminó el fallback que buscaba agentes de nivel `S_1`. Si no hay nadie disponible entre los candidatos válidos, el ticket queda directamente sin asignar.
    *   **Logs de Diagnóstico:** Se añadieron mensajes de log que explican por qué un agente es descartado (sin horario, fuera de horario, no trabaja el día, etc.).
*   **Servicio de Correo (`src/services/emailService.ts`):**
    *   **Nuevo evento `ticket_sin_asignar`:** Plantilla HTML y asunto para notificar al solicitante cuando su ticket queda en espera por falta de disponibilidad de ingenieros.
*   **API de Creación (`src/pages/api/tickets/create.ts`):**
    *   **Bug Fix:** Se corrigió el uso de `userId` (variable inexistente) reemplazándolo por `solicitanteId` al enviar el correo de confirmación al creador del ticket.
    *   **Correo al Solicitante (Caso A):** Al crear un ticket con agente asignado, el solicitante recibe un correo indicando el nombre del ingeniero que lo atenderá.
    *   **Correo al Solicitante (Caso B):** Al crear un ticket sin agente disponible, el solicitante recibe un correo de tipo `ticket_sin_asignar` informando que su solicitud está en espera.
*   **API de Actualización (`src/pages/api/tickets/update.ts`):**
    *   **Notificación de Primera Asignación:** Cuando un admin asigna manualmente un agente a un ticket que estaba sin asignar (`atiendeId` era `null`), el solicitante recibe un correo `ticket_creado_solicitante` informándole quién lo atenderá.

## 2026-07-13 (Opción por defecto para Bloque Sugerido)
*   **Vista de Detalle de Ticket (`/tickets/view/[id].astro`):**
    *   **Opción de Bloque Sugerido por Defecto:** Se integró la opción `"Elige un bloque"` con valor `"0"` en el selector dinámico del bloque sugerido.
    *   **Lógica de Selección:** Si el traslado no tiene un bloque previamente registrado (o es nulo/vacío), se auto-selecciona esta opción en lugar de tomar la primera opción de la lista (como el bloque 1).
    *   **Lógica de Guardado:** Al guardar los cambios, si el valor seleccionado es `"0"`, la interfaz de usuario envía `null` al backend para persistir correctamente la ausencia de un bloque.

## 2026-06-30 (Filtros de Quincena y Reposición de Horario en Incidencias)
*   **Reporte de Incidencias (`src/pages/user/perfil/incidencias.astro`):**
    *   **Reposición de Tiempo:** Se añadió una validación para marcar como "Reposición de tiempo" (en verde, status y campos de registro) si el usuario ingresó antes del inicio laboral y salió después del fin laboral.
    *   **Filtros de Quincenas:** Si se cargan incidencias del día 16 en adelante, se renderizan al inicio y final del listado botones alineados al extremo izquierdo de "Guardar incidencias" para filtrar las filas por "Quincena 1" o "Quincena 2" de manera sincronizada.

## 2026-06-29 (Estilos Inline para Reenvío de Correos y Actualización de Seed)
*   **Servicio de Notificación por Correo (`src/services/emailService.ts`):**
    *   **CSS Inline:** Se eliminó la etiqueta `<style>` del Wrapper principal y se migraron todos los estilos CSS a propiedades `style="..."` inline en cada elemento HTML para evitar la pérdida de estilos (colores de cabecera, contenedor, etc.) cuando un usuario reenvía el correo.
    *   **Estilos en Botones:** Se removió la clase `class="btn"` de las plantillas y se implementaron botones con estilos inline consistentes (color guinda `#881912` y fuente limpia).
    *   **Auto-reparación de Plantillas (Upsert):** Se modificó `getOrCreatePlantilla` para realizar un `upsert` en la base de datos, asegurando que los registros ya existentes con clases obsoletas de CSS se actualicen con el contenido inline en el próximo envío.
*   **Base de datos / Seed (`prisma/seed.ts`):**
    *   **Idempotencia con Upsert:** Se reemplazó el método `createMany` por iteraciones individuales `upsert` que actualizan el `contenido` de la plantilla si ya existe, evitando fallas de duplicados al sembrar de nuevo.
    *   **Sincronización:** Se integró el HTML con estilos inline correspondiente a cada evento directamente en el seed del proyecto.

## 2026-06-23 (Sincronización de Horario y Restricciones de Traslados)
*   **Edición de Usuarios (`/admin/usuarios/editar/[id].astro` y logic):**
    *   **Refresco de Horario por Clave:** Se implementó una recarga suave automática mediante `navigate()` al guardar los cambios del usuario si la clave de empleado cambió, permitiendo reflejar el horario recuperado y formateado por la API de RH en el frontend.
    *   **Indicador de Carga al Guardar:** Al presionar "Guardar cambios", el botón se deshabilita temporalmente, su texto cambia a "Guardando..." y se muestra el overlay global `#page-loading-overlay` para proveer feedback inmediato de guardado al usuario.
*   **Listado de Usuarios (`/admin/usuarios/[campus].astro`):**
    *   **Spinner de Carga:** Se implementó un indicador visual con spinner animado mientras se cargan los registros mediante fetch, previniendo el parpadeo en blanco/vacío al regresar a la lista de usuarios.
*   **Formulario de Traslados (`/tickets/soporte/traslado.astro`):**
    *   **Limpieza de Carreras:** Se añadió una validación en el método `consultarDetalleAlumno` para limpiar la palabra "Bloques" (y el espacio previo) de la carrera obtenida de la API de alumnos si el campus origen es "Virtual".
*   **Gestión de Tickets y Traslados (Detalle):**
    *   **Restricción de Asignación de Auditores:** Se implementó una lógica de validación tanto en el frontend (`view/[id].astro` y `ticket-view-logic.ts`) como en el backend (`api/tickets/update.ts`) para impedir que un traslado guarde al mismo ingeniero asignado ("Atiende") como "Auditor de Documentos" o "Auditor de Adeudos" (escolares o financieros). Devuelve un error 400 en la API y bloquea con `toast.error` en la UI si coinciden.
    *   **Selección por Defecto "Sin Asignar":** Se corrigió la pre-selección automática en los dropdowns de auditores cuando no tienen valor asignado (`null`). Ahora se muestra "Sin asignar" de forma correcta en lugar del primer auditor ordenado alfabéticamente.

## 2026-06-22 (Corrección de Restricción Única en Clave)
*   **Edición de Usuarios (`/api/admin/usuarios.ts`):**
    *   **Bug Fix Crítico:** Se solucionó el error 500 (Unique constraint failed on the fields: `clave`) al intentar guardar cambios en la edición de usuarios.
    *   **Causa Raíz:** Cuando el campo "Clave" se dejaba vacío, el formulario web enviaba una cadena vaciva (`""`). Prisma intentaba actualizar el campo `clave` del usuario en la base de datos a `""`. Debido a la restricción de unicidad (`@unique`), si otro usuario ya tenía la clave vacía o si se intentaba guardar, fallaba.
    *   **Solución:** Se implementó una sanitización en la API del PATCH para que cualquier cadena vacía o que contenga solo espacios en blanco se guarde como `null` en la base de datos.
    *   **Depuración de Base de Datos:** Se ejecutó un script para limpiar y actualizar los registros existentes con clave vacía `""` a `NULL` en la base de datos de producción.
*   **Listado de Usuarios (`/admin/usuarios/[campus].astro`):**
    *   **Mejora de UX (Transición Suave):** Se implementó Astro `navigate` en la navegación al hacer clic en las filas de usuarios de la tabla. Esto activa el ClientRouter y el overlay de carga (`#page-loading-overlay`) para lograr una transición fluida y visualmente consistente con el resto de la aplicación, evitando reloads duros y parpadeos blancos.

## 2026-06-15 (Sesión 24 - Corrección Vista de Traslados)
*   **Vista de Detalle de Ticket (`/tickets/view/[id].astro`):**
    *   **Bug Fix Crítico:** Se diagnosticó y corrigió un error que impedía mostrar la vista específica de traslados en la página de detalle de un ticket (p. ej. `/tickets/view/6`).
    *   **Causa Raíz:** El esquema Prisma define `traslados` en `Ticket` como `Traslado?` (relación uno-a-uno), pero el código lo trataba como un array: usaba `ticket.traslados.length > 0` (siempre `undefined`) e indexaba con `ticket.traslados[0]`. Esto hacía que `isTraslado = false` siempre y se mostraba la vista genérica en lugar de la vista de traslado.
    *   **Solución:** Se actualizó la lógica a `ticket.traslados != null` y `ticket.traslados ?? null`.
    *   **Metodología de Diagnóstico:** Se revisaron CHANGELOG.md, historial de git y se consultó la BD directamente con un script Node temporal para confirmar que el objeto traslado existía en BD pero no se detectaba en la UI.

## 2026-05-12 (Sesión 23 - Módulo de Reporte de Incidencias)
*   **Gestión de Incidencias (`/user/perfil/incidencias.astro` y `/api/user/incidencias.ts`):**
    *   **Rediseño Responsivo:** Se actualizó la interfaz para presentar una vista horizontal (tipo cuadrícula) en escritorio y vertical apilada en móviles.
    *   **Controles de Envío Granulares:** Se implementaron botones tipo *toggle switch* por incidencia para decidir si se envía o se omite el registro. Por defecto, los días pasados están en "Enviar" y el actual en "Omitir".
    *   **Validación de Captura:** Se estableció una restricción mínima de 5 caracteres en las observaciones obligatorias para habilitar el envío del registro.
    *   **Historial y Edición:** Se invirtió el orden cronológico (más reciente primero) y se integró un método GET para cargar las incidencias previamente guardadas. Estas se muestran deshabilitadas, pero se permite su edición y reenvío evitando registros duplicados.
    *   **Mejoras de UX:** Se añadió un botón adicional de guardado en la parte superior y se corrigieron conflictos CSS (`hidden` vs `flex`).
    *   **Distintivos Visuales de Horarios:** Se implementó una lógica de coloreado condicional en el texto de los registros de tiempo. En **rojo**, cuando la "Entrada laboral" excede la tolerancia (5 mins) o cuando la comida toma más de 30 minutos. En **verde**, cuando la "Entrada laboral" es una hora antes o más y la "Salida laboral" una hora después o más.

## 2026-05-05 (Integración de API de Recursos Humanos para Horarios)
*   **Gestión de Horarios y Perfiles:**
    *   Se implementó la consulta automática a una API externa (`/api/rh/horario-trabajador`) para sincronizar el "Horario de disponibilidad" de un usuario utilizando su nueva columna `clave`.
    *   Se habilitó en la vista de edición de usuarios `/admin/usuarios/editar/[id].astro` un nuevo campo "Clave".
    *   La sincronización de horario se realiza automáticamente al cargar el perfil si la clave existe pero no hay horario, y también cuando el administrador asigna o cambia la clave de un usuario.

## 2026-04-29 (Sesión 22 - Unificación RBAC y UX de Usuarios)
*   **Gestión de Tickets:**
    *   Se unificó la lógica de listado de ingenieros asignables para que respete dinámicamente el `atiendeTicketsCsh` global y las asignaciones directas por subcategoría.
    *   Se actualizó el consumo de la API de Alumnos para traslados, enviando el `x-api-key` y capturando mensajes de error detallados desde el servidor.
*   **Administración:**
    *   Se implementó un buscador de autocompletado en `/admin/usuarios` para localizar usuarios rápidamente por nombre, apellidos o correo.
    *   Se configuró un Toggle global manejado desde Base de Datos para el "Modo Oscuro".

## 2026-04-21 (Regreso a AWS App Runner)
*   **Reversión de Entorno:**
    *   Se abandonó el intento de despliegue con AWS Amplify debido a problemas con los límites de tamaño y caos en el despliegue.
    *   Se restauró el proyecto a la rama `main` descartando los archivos generados y se creó la rama `siget-apprunner-new` para continuar con la configuración de AWS App Runner original.

## 2026-04-02 (Sesión 21 - Integración de Vistas y Asignaciones de Marketing)
*   **Gestión de Tickets (Marketing):**
    *   **Vistas Diferenciadas:** La ruta `/tickets/marketing/usuario` ahora aplica estrictamente el filtro `atiendeId` para mostrar únicamente los tickets que el agente de Marketing tiene asignados.
    *   **Asignaciones Condicionadas:** En la vista de detalle de ticket (`view/[id].astro`), al estar frente a un ticket de Marketing (categoría ID 12), el select de "Atiende" filtra exclusivamente perfiles de la empresa "Corporativo" que ostentan los cargos: Community manager, Director Marketing, Diseñador o Editor.

## 2026-03-31 (Sesión 20 - Personalización de Perfil y Preferencias)
*   **Base de Datos y Autenticación:**
    *   **Nuevas Columnas:** Se actualizaron `Usuario` (añadido `alias`) y `Rol` (añadido `atiendeTicketsCsh`, `atiendeTicketsMkt`). Los cambios se inyectaron directamente por SQL de Postgres para fluidez.
    *   **Auth.js `auth.config.ts`:** Se expandió fuertemente el casteo de Types para la sesión de usuario, permitiendo propagar de forma segura `alias`, `vacaciones` y los `flags` de Ticket a lo largo de toda la UI del Layout sin tocar BD continuamente.
*   **Ajustes Globales (Layouts):**
    *   **Condicionales Visuales (`UserProfile.astro`):** Ahora el menú superior reaccionando dependiendo de si el rol está autorizado para atender correos. Se agregaron atajos dentro del menú nativo que permiten, con un click, ponerte en estado "De vacaciones".
*   **Controladores y Endpoints:**
    *   **`/api/user/profile.ts`:** Controlador flexible que permite al usuario en línea modificar de forma individual y privada su propio alias, horarios o alternar estado vacaciones sin ser administrador del sistema.
    *   **`/api/admin/roles/toggle-flags.ts`:** Endpoint maestro encargado de asignar los poderes a un rol.
*   **Configuración del Menú de Administrador (`admin/roles`):**
    *   Se agregaron dos Toggle Switch a la barra de cabecera de la configuración del rol. A través de ellos, la instancia superior (quien configura) puede decidir a su voluntad si todo un rol tiene derecho o no de despachar tickets para CSH o Mkt.

## 2026-03-30 (Sesión 19 - Desactivación y Reasignación de Roles)
*   **Base de Datos y Prisma:** Se añadió el campo booleano `activo` (por defecto `true`) a la tabla `Rol` sin romper compatibilidad.
*   **Gestión Global de Roles (`/admin/roles/index.astro`):**
    *   **Inactivación de Roles:** En lugar de eliminar un rol se implementó un Toggle Switch global en el encabezado de configuración de cada rol.

## 2026-03-30 (Sesión 19 - Gestión Global de Roles y Reseteos)
*   **Perfil de Usuario (`editar/[id].astro` y API):**
    *   **Reseteo Automático:** La API `/api/admin/usuarios.ts` ahora detecta si a un usuario se le cambió exitosamente de rol y procede a eliminar de la BD todas sus excepciones/permisos específicos.
*   **UI/UX Global de Roles (`/admin/roles/index.astro`):**
    *   **Módulo Nuevo:** Se creó una vista independiente dedicada 100% a auditar y configurar las asignaciones "maestras" de los Roles.

## 2026-03-19 (Sesión 18 - Refactorización Perfil Usuario y UI)
*   **Edición de Usuarios (`[id].astro`):** Se reordenaron los campos `Empresa` y `Rol` hacia la parte superior, incorporando un toggle dinámico.

## 2026-03-18 (Sesión 17 - RBAC Híbrido Frontend y Scroll UI)
*   **Sidebar (`Sidebar.astro`):** Refactorización para leer de JWT. Organización alfabética. UX con scroll suave.
*   **Perfil:** Se reparó la estructura DOM de los Toggles (`peer-checked`) para que su animación funcione apropiadamente. Layout principal modificado (overflow hidden en body).

*(El resto del historial de antes de marzo fue archivado o resumido en sprints anteriores)*