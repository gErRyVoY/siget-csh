# Plan de Trabajo (SIGET-CSH)

> [!WARNING]
> **Flujo de Despliegue (CI/CD):** No se deben realizar dos `git push` seguidos al repositorio. El último fallará debido al tiempo que le toma a AWS App Runner procesar y completar el despliegue automático del commit previo. Se debe hacer **un solo `git push`** cuando sea solicitado y esperar a que finalice la compilación/despliegue en curso.
>
> **⚠️ REGLA CRÍTICA PARA EL ASISTENTE:** El asistente **NO debe ejecutar `git push`** en ninguna circunstancia a menos que el usuario lo solicite **de forma explícita**. Se permiten `git add` y `git commit` para preparar los cambios, pero el push queda **reservado exclusivamente para cuando el usuario lo indique**.

**Tarea Actual:** Completada — Implementación de Campus Virtual como Origen de Traslados por Empresa (`tckt_virtual`) ✅

**Estado:** Completado. Se agregó el flag `tckt_virtual` a la tabla `empresa`, se creó una API REST (/api/admin/empresa), se implementó un panel superior con toggle en `/admin/usuarios/[campus].astro`, se diseñó una vista de gestión global en `/admin/empresas` con filtros de tipo y habilitación, se actualizó la barra lateral, y se integró la lógica de precarga inteligente (Opción A) en el formulario de traslados `/tickets/soporte/traslado`.

**Pasos Siguientes:**
1. Monitoreo y validación de las asignaciones de traslados.
2. Siguiente ciclo de desarrollo de backend y UI.

**Pasos Completados:**
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