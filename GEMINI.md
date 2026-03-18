# Plan de Trabajo (SIGET-CSH)

**Tarea Actual:** Seguridad, Validación de Vistas y Optimización.

**Estado:** Completado - Refinamiento total de RBAC Híbrido, UI Toggles y Navegación Dinámica.

**Pasos Completados:**
- ✅ Análisis completo del proyecto (tecnologías, código, BD, UI/UX)
- ... (hitos anteriores consolidados)
- ✅ Vista administrativa de categorías con filtros jerárquicos en cascada
- ✅ Sistema de Toggles Rápidos en vista de lista de usuarios
- ✅ Implementación completa de RBAC Híbrido por Secciones (Lógica JWT + DB Auth)
- ✅ Reestructuración de Perfil de Usuarios (`editar/[id].astro`) con visibilidad total de permisos heredados vs explícitos.
- ✅ Refactorización completa y ordenamiento alfabético de la barra lateral dinámica (`Sidebar.astro`).
- ✅ Implementación de auto-scroll suave en menús expansibles de la barra lateral.
- ✅ Bloqueo de scroll global (`overflow-hidden`) en el layout principal para inmovilizar cabeceras.

**Pasos Siguientes (Próxima Iteración):**
1.  **Seguridad Adicional y Middleware:**
    - Terminar validación del `middleware.ts` para proteger absolutamente todas las rutas backend/frontend en base al token de Secciones Híbridas.
2.  **Optimización y Limpieza:**
    - Pruebas de carga y reconexión para el sistema SSE.
    - Puesta en producción / Traspaso a AWS ECR.


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
    * **Documentación de referencia:**
        - [Creating an AMI from an Amazon EC2 Instance](https://docs.aws.amazon.com/toolkit-for-visual-studio/latest/user-guide/tkv-create-ami-from-instance.html)
        - [Create an Auto Scaling group using the Amazon EC2 launch wizard](https://docs.aws.amazon.com/autoscaling/ec2/userguide/create-asg-ec2-wizard.html)
        - [Attach an Elastic Load Balancing load balancer to your Auto Scaling group](https://docs.aws.amazon.com/autoscaling/ec2/userguide/attach-load-balancer-asg.html)

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

# Reglas y Comportamiento
1. **Proactivo y Orientador:** No esperes a que te hagan todas las preguntas. Si ves una oportunidad de mejora, sugiérela.
2. **Enfoque en Prácticas Ágiles:** Desglosa siempre las funcionalidades en Historias de Usuario manejables ("Como _[rol]_, quiero _[objetivo]_ para _[beneficio]_") y ayúdame a priorizarlas en el backlog.
3. **Mentalidad de Automatización:** Para cada etapa, sugiere formas de automatizar tareas repetitivas.
4. **Claridad y Simplicidad:** Explica conceptos complejos de DevOps y SCRUM de manera sencilla y con ejemplos prácticos.
5. **Preguntas Clave:** Para iniciar la planificación, siempre pregunta sobre el "_Definition of Done_" (DoD).
6. **Generación de Código Útil:** El código que generes debe seguir las mejores prácticas, ser seguro y estar bien documentado.

# Protocolo de Inicio de Sesión y Contexto
Cuando el usuario me pida leer este archivo (`GEMINI.md`) al inicio de una sesión, debo seguir estos pasos para establecer el contexto:

1.  **Revisar el `Plan de Trabajo`:** Identificar el "Objetivo Actual" y los "Pasos Siguientes" para entender la meta inmediata.
2.  **Revisar el último `Historial de Cambios`:** Leer la entrada de log más reciente para comprender qué se completó en la sesión anterior.
3.  **Identificar Archivos Relevantes:**
    *   **Archivos Clave del Proyecto:** Para entender la lógica central, siempre debo tener presentes los siguientes archivos:
        *   `prisma/schema.prisma`: Define la estructura de la base de datos.
        *   `prisma/seed.ts`: Contiene la lógica para poblar la base de datos inicial.
        *   `auth.config.ts`: Configura la autenticación y los roles/permisos.
        *   `src/middleware.ts`: Gestiona la protección de rutas.
        *   `src/layouts/MainLayout.astro`: Es la plantilla principal de la interfaz.
        *   `astro.config.mjs` y `package.json`: Para dependencias y configuración del proyecto.
    *   **Archivos de Trabajo:** Debo prestar especial atención a los archivos mencionados en la última entrada del `Historial de Cambios` (trabajo recién completado) y en el `Plan de Trabajo` (trabajo por hacer).
4.  **Resumir y Presentar:** Presentar al usuario un resumen conciso que incluya:
    *   **Lo último que se hizo:** (Extraído del log).
    *   **El objetivo actual:** (Extraído del plan de trabajo).
    *   **El siguiente paso propuesto:** (Extraído del plan de trabajo).
5.  **Confirmar Rol y Esperar Instrucción:** Re-afirmar internamente mi rol como "ScrumBot" y esperar la siguiente instrucción del usuario para proceder.

# Historial de Cambios (Log)

## 2026-03-18 (Sesión 17 - RBAC Híbrido Frontend y Scroll UI)
*   **Sidebar (`Sidebar.astro`):**
    *   **Refactorización:** Las opciones ahora se renderizan leyendo exclusivamente de las "secciones" configuradas vía JWT (RBAC dinámico puro).
    *   **Organización:** Se ordenaron alfabéticamente todos submenús y el bloque "Otros".
    *   **UX:** Se implementó `scrollIntoView` suave al expandir menús grandes como "SiGeT".
*   **Perfil (`/admin/usuarios/editar/[id].astro`):** Se reparó la estructura DOM de los Toggles (`peer-checked`) para que su animación funcione apropiadamente.
*   **Layout General:** Cabecera inamovible lograda al bloquear el body con `overflow-hidden` permitiendo flujo solo en internal wrapper.

## 2026-03-17 (Sesión 17 - RBAC Híbrido y Permisos Híbridos)
*   **Base de Datos y Prisma:**
    *   **Nuevos Modelos:** Se introdujeron `Seccion`, `PermisoRolSeccion`, y `PermisoUsuarioSeccion` en el esquema para soportar permisos heredados de roles más "excepciones" por usuario individual.
    *   **Migración:** Se generó y aplicó exitosamente la migración relacional hacia el nuevo modelo híbrido.
    *   **Seeding Avanzado:** Se actualizaron todos los roles del sistema (Director, Staff, Soporte, etc.) inyectando permisos base vinculados a secciones específicas de la interfaz en lugar de nombres "hardcoded".
*   **Gestión de Permisos Dinámicos (Auth.js):**
    *   Se actualizó `auth.config.ts` para inyectar en el token JWT un set consolidado y desduplicado llamado `secciones`, que agrupa tanto los permisos del rol del usuario como los otorgados manualmente.
*   **Refactorización Completa del Sidebar (`Sidebar.astro`):**
    *   Se reemplazaron todos los chequeos inflexibles (`isMarketingDirector`, `isAdmin`) por validaciones dinámicas dependientes 100% de los `session.user.secciones` (ej. `canSeeTraslados`, `canSeeAdminCorreos`).
    *   Se consolidó el "Modo Administrador" en un único flujo de renderizado condicional.
*   **Perfil de Usuario - Toggles Híbridos (`/admin/usuarios/editar/[id].astro`):**
    *   **UI:** Nueva interfaz avanzada de permisos cruzados en la vista de edición. Los permisos heredados muestran estado (badge visual) ineditable. Las secciones opcionales/extra ofrecen **Toggle Switches** interactivos.
    *   **Optimistic UI:** Se agregó actualización inmediata al UI asíncrona (con notificación `toast`) ejecutando sentencias PATCH hacia la ruta especial `/api/admin/usuarios/secciones`.
    *   **Seguridad:** El nuevo endpoint `/api/admin/usuarios/secciones.ts` aplica operaciones de Upsert y Logging integral con cada cambio explícito de permiso.

## 2026-03-17 (Sesión 17 - Toggles Rápidos de Usuarios)
*   **Mejoras en Listado de Usuarios (`/admin/usuarios/[campus].astro`):**
    *   **Toggles Interactivos:** Se reemplazaron los badges de estado estáticos por toggle switches de Tailwind CSS interactivos para las columnas "Activo" y "Vacaciones".
    *   **Actualizaciones Optimistas:** La UI se actualiza inmediatamente al hacer clic (cambio de color y texto) para una mejor experiencia de usuario.
    *   **Notificaciones:** Se integró el sistema de `toast` para notificar al usuario sobre el éxito o error de la actualización en la base de datos a través de la API `PATCH /api/admin/usuarios`.
    *   **Corrección de Navegación:** Se aplicó `stopPropagation()` a los toggles para que al interactuar con ellos no se dispare el evento de fila que redirigía a la página de edición del usuario.

## 2026-02-12 (Sesión 16 - Parte 2 - Refinamiento de Categorías)
*   **Mejoras en Filtrado (`/admin/categorias`):**
    *   **Lógica de Ocultamiento Inteligente:** Ahora se ocultan automáticamente las filas que no tienen información visible (es decir, donde tanto la categoría como todas las subcategorías muestran "-"), manteniendo la tabla limpia.
    *   **Filtros Contextuales:** Los dropdowns de subcategorías ahora solo muestran las opciones que están realmente visibles en la tabla, adaptándose dinámicamente a los filtros aplicados en niveles superiores.
*   **UX:**
    *   **Botón Restablecer:** Se añadió un botón "Restablecer" en el encabezado para limpiar rápidamente todos los filtros y mostrar la tabla completa.

## 2026-02-11 (Sesión 16 - Gestión de Categorías)
*   **Nueva Vista (`/admin/categorias`):**
    *   **Tabla Jerárquica:** Creada vista para visualizar categorías y subcategorías con soporte para hasta 5 niveles de anidamiento.
    *   **Eliminación de Repeticiones:** Lógica recursiva que reemplaza nombres repetidos con `-` y fondo gris, evaluando cada columna independientemente.
    *   **Columnas Dinámicas:** La tabla genera columnas automáticamente según el nivel máximo de subcategorías.
*   **Filtros en Cascada (Encabezados):**
    *   Dropdowns con checkboxes directamente en los encabezados de cada columna.
    *   Las opciones de subcategorías se actualizan dinámicamente según las filas visibles.
    *   Checkbox "Todos" con soporte para estado indeterminado en subcategorías.
*   **Sidebar:** Enlace "Categorías" añadido al menú Admin y Marketing.
*   **Ordenamiento:** Subcategorías en `/admin/tickets` ordenadas por ID ascendente.

## 2026-01-22 (Sesión 14 - Parte 2)
*   **Adjuntos y Archivos:**
    *   **Corrección:** Se reparó el error 500 al descargar adjuntos (`key=undefined`) implementando un nuevo endpoint `/api/tickets/attachment`.
    *   **UI:** Nueva visualización en lista con icono y nombres separados por coma.
*   **Visualización de Ticket:**
    *   **Carrera:** Se corrigió el nombre de la carrera para incluir el nivel académico (ej. "Licenciatura en", "Maestría en") consultando la relación `Oferta`.
*   **Layout:**
    *   **Header Sticky:** Se implementó un encabezado fijo (`h-screen` en wrapper, `overflow-hidden` en contenedor y `overflow-y-auto` en `main`) para que no desaparezca al hacer scroll.

## 2026-01-21 (Sesión 14 - Fixes de UI y Layout)
*   **Layout & Scroll:**
    *   **Corrección:** Se reemplazó `h-screen` por `h-full` en el wrapper de `MainLayout` para solucionar problemas de scrollbar no deseado o cortado.
    *   **CSS:** Se actualizó la sintaxis de clases arbitrarias de Tailwind (ej. `h-(--header-height)`) para eliminar advertencias de consola.
*   **Componentes:**
    *   **StatCard:** Se forzó `h-full` para que las tarjetas del dashboard ocupen toda la altura disponible en su celda.
    *   **Traslados:** Simplificación del tag de imagen.
*   **Git:** Sincronización de cambios al repositorio.

## 2026-01-19 (Sesión 13 - Corrección CSV Import)
*   **Carga Masiva (Fix):**
    *   Se solucionó un error crítico 500 que impedía la importación de usuarios.
    *   **Causa:** Se estaba pasando un campo inexistente (`loading`) al método `create` de Prisma.
    *   **Solución:** Se eliminó el campo del objeto de datos en `api/admin/usuarios/import-csv.ts`.
*   **Documentación:** Sincronización de registros de cambios.

## 2026-01-17 (Sesión 12 - Roles y Validación)
*   **Base de Datos (Seed):**
    *   Se ampliaron los roles disponibles en `prisma/seed.ts` (IDs 18-28) para incluir posiciones administrativas y académicas (Ejecutivos, Coordinadores, Soporte).
    *   Se validó la consistencia con el enum `NivelSoporte`.
*   **Documentación:**
    *   Actualización de `CHANGELOG.md` con los nuevos cambios.
    *   Sincronización de repositorio.

## 2026-01-15 (Sesión 11 - Carga Masiva)
*   **Carga Masiva de Usuarios:**
    *   **Frontend:** Implementada nueva sección en `admin/usuarios/index.astro` con Drag & Drop y Google Drive Picker para archivos `.csv`.
    *   **Backend:** Nuevo endpoint `api/admin/usuarios/import-csv` utilizando `csv-parse`.
    *   **Validaciones:**
        *   Formato estricto `.csv`.
        *   Columnas requeridas: `nombres,apellidos,mail,empresa_slug,rol_nombre`.
        *   Verificación de existencia de Empresa (slug) y Rol (nombre).
        *   Validación de formato de email y duplicados en BD.
    *   **Feedback:** Sistema de notificaciones (toasts) con reporte de éxito/fallo.

## 2026-01-09 (Sesión 10 - Parte 3)
*   **Mejoras en Traslados:**
    *   **Autocomplete de Descuentos:** Se implementó búsqueda dinámica basada en la tabla `Descuento` (campo `descripcion`). Se actualizó tanto el frontend (`traslado.astro`) como el backend (`transfer.ts`).
    *   **Búsqueda Robusta:** Se aplicó normalización de texto (NFD) para ignorar acentos en las búsquedas de Campus, Carrera y Descuento.
*   **Limpieza y Mantenimiento:**
    *   **Eliminación de Código Muerto:** Se borró `src/pages/tickets/view/ejemplo.astro` al confirmar que no tiene usos en el proyecto.
    *   **Optimización CSS:** Se migraron clases de layout (`shrink-0`, `grow`) y se simplificaron referencias a variables de tema en múltiples archivos.
    *   **Corrección de API:** Se solucionó un error estructural en `transfer.ts` que causaba fallos de sintaxis intermitentes.
*   **Git:** Sincronización completa del repositorio con los últimos cambios de ciclos y traslados.

## 2026-01-08 (Sesión 10 - Parte 2)
*   **Gestión de Ciclos Escolares:**
    *   **Seed de Datos:** Se poblaron los ciclos académicos del 2026-3 al 2027-2 en la base de datos (`prisma/seed.ts`).
    *   **Automatización:** Se creó `src/services/cycleService.ts` que activa automáticamente el ciclo vigente y desactiva los anteriores basándose en la fecha actual.
    *   **Validación de Traslados:** Se actualizó la API `transfer.ts` para bloquear la creación de tickets si no existe un ciclo activo, garantizando la integridad de los datos.
    *   **Panel Administrativo:** Se implementó una nueva vista `/admin/ciclos` para visualizar y activar/desactivar ciclos manualmente.
    *   **Corrección de Errores Sidebar:** Se restauró el acceso al módulo "Ciclos" en el sidebar principal de administración.
*   **Correcciones Estéticas:**
    *   Se ajustaron los colores de las alertas informativas en la administración de ciclos (texto vino, fondo gris translúcido) según feedback de usuario.

## 2026-01-07 (Sesión 10)
*   **Corrección de Error Crítico (Traslados):**
    *   Se solucionó un error 500 en `src/services/ticketAssignmentService.ts` que impedía crear tickets de traslado.
    *   **Causa:** La consulta de Prisma intentaba incluir la relación `usuario` en `AsignacionesCategorias`, pero el nombre correcto en el esquema es `atiende`.
    *   **Solución:** Se corrigió el nombre de la relación en el `include` y en el `map` posterior.
*   **Limpieza de Código:**
    *   Se eliminó `src/components/shared/NewTransfer.astro` ya que su funcionalidad fue migrada completamente a `src/pages/tickets/soporte/traslado.astro`.
    *   Se verificó que `modal-controller.ts` sigue siendo utilizado por otros componentes (`NewTicketMkt`), por lo que se mantuvo.

## 2025-12-17 (Sesión 9)
*   **Mejoras en Página de Traslados (`src/pages/tickets/soporte/traslado.astro`):**
    *   **UI/UX Autocomplete:** Se implementó navegación por teclado (Flechas/Enter), bordes estilizados (`#797979`) y feedback visual (hover vino) en las listas de sugerencias.
    *   **Carga de Archivos:** Se integró funcionalidad completa de adjuntos.
        *   **Drag & Drop:** Zona de carga estilizada y validación de cliente (tipo/tamaño).
        *   **Google Drive:** Integración de Google Picker API para adjuntar desde Drive.
    *   **Lógica de Envío Robusta:** Se refactorizó el envío del formulario a un proceso secuencial de 3 pasos (Crear Ticket -> Obtener ID -> Subir Archivos a S3 -> Actualizar Ticket), garantizando que los archivos se vinculen correctamente.
*   **Verificación:**
    *   Pruebas manuales de UI y flujo de carga confirmaron el funcionamiento correcto.

## 2025-12-04 (Sesión 6)
*   **Mejoras en Navegación y Contexto:**
    *   **Sidebar Inteligente:** Se implementó lógica en `CollapsibleNavSection.astro` para resaltar correctamente "Mis Tickets" o "Todos" basándose en un parámetro `source` en la URL, corrigiendo el problema de pérdida de contexto al ver un ticket.
    *   **Botón Volver Dinámico:** La vista de detalle del ticket (`view/[id].astro`) ahora redirige a la lista correcta ("Mis Tickets" o "Todos") usando el mismo parámetro `source`.
    *   **Enlaces Actualizados:** Se actualizaron las listas de tickets (`soporte/index.astro` y `soporte/usuario/index.astro`) para incluir el parámetro `source` en los enlaces.
*   **Optimización de Login y Sesión:**
    *   **Experiencia de Usuario:** Se eliminó la pantalla de consentimiento forzado de Google (`prompt: "consent"`) para usuarios recurrentes.
    *   **Persistencia:** Se extendió la duración de la sesión a 30 días en `auth.config.ts`.
    *   **UI:** Se añadió un checkbox visual "Recordar este equipo" en la pantalla de login.
*   **Lógica de Negocio (Tickets):**
    *   **Prioridad Automática:** Se implementó la asignación automática de prioridad basada en el rol del usuario (`nivel_soporte`) al crear un ticket (`create.ts`).
    *   **Google Drive:** Se integró la solicitud de permisos de Drive en el flujo de login principal y se corrigió un bug que impedía borrar archivos individuales de Drive (debido a incompatibilidad de tipos de ID).
*   **Verificación:**
    *   Se ejecutó `pnpm build` exitosamente.

## 2025-12-12 (Sesión Actual)
*   **Refinamiento de Permisos y UI (Admin Usuarios):**
    *   Se definieron reglas estrictas de edición en `editar/[id].astro` basadas en roles específicos (Total vs. Restringido).
    *   Se solicitó rediseño de checkboxes (Grid responsivo) y ajustes visuales (Título, botón Volver).
*   **Corrección de Login y Autenticación:**
    *   **Mapeo de OU:** Se añadió lógica en `auth.config.ts` para mapear explícitamente la Unidad Organizativa "Corporativo Humanitas" a la empresa "Corporativo".
    *   **Manejo de Errores:** Se reemplazó el código de error `EmpresaNoMapeada` por `AccesoNoPermitido` para proporcionar un feedback más claro.
    *   **UI Login:** Se actualizó `src/pages/login.astro` para mostrar un mensaje de "Acceso denegado" estilizado con el color secundario (vino) cuando ocurre este error, indicando al usuario contactar a Soporte.

## 2025-12-12 (Sesión 8)
*   **Separación de Lógica de Marketing:**
    *   **Creación de Tickets:** Se implementó `tickets/marketing/nuevo.astro` y `marketing-ticket-wizard.ts` para un flujo de creación exclusivo, eludiendo la selección de categoría y enfocándose en subcategorías de Marketing.
    *   **Prisma Fix:** Se corrigió una query infinita en los índices de tickets de marketing cambiando `categorias` por `subcategoria_categorias`.
*   **Optimización UI/UX:**
    *   **Sidebar:** Se condicionó la visibilidad de elementos ("Base de conocimientos", "Asistencia remota", "Tickets soporte") para simplificar la vista a roles de Marketing.
    *   **Dashboard:** Se ajustaron las tarjetas estadísticas del Dashboard de Marketing (Mostrar Total, Ocultar Solucionados/Cancelados).
    *   **Layout:** Se corrigió el scroll horizontal forzando `w-full` en el wrapper del dashboard.

## 2025-12-14 (Sesión 8+ y Optimización)
*   **Seguridad y RBAC:**
    *   **Middleware:** Se implementó protección de rutas en `middleware.ts` para redirigir a usuarios de Staff de Marketing que intenten acceder a `/admin`.
    *   **Feedback Visual:** Se añadió lógica en `MainLayout.astro` para mostrar un toast de error ("No tienes permisos suficientes") cuando se detecta una redirección por falta de permisos.
    *   **Corrección:** Se solucionó un error de compilación crítico en `Sidebar.astro` (variable duplicada `mainNavItems`).
*   **Optimización Dashboard Marketing:**
    *   **Redirección Raíz:** Los roles de Marketing ahora son redirigidos automáticamente de `/` a `/tickets/marketing/dashboard`.
    *   **UX Sidebar:** La sección de Marketing se expande automáticamente al entrar al dashboard gracias a la lógica de redirección y coincidencia de rutas.
    *   **Tarjetas:** Se reorganizaron las tarjetas (Prioridad a Nuevos/En Progreso) y se ocultaron por defecto los estados finales (Solucionado/Cancelado/Duplicado).
    *   **Funcionalidad:** Se reparó el botón "Ver todo" en el dashboard de marketing, añadiendo la lógica JS faltante para alternar la visibilidad de las tarjetas secundarias.
*   **Ajuste Fino de Permisos (Sidebar):**
    *   **Staff Marketing:** Se habilitó la vista del botón `AddTicket` (CSH) y el enlace "Asistencia Remota". Se ocultó explícitamente el componente `NewTransfer`.
## 2025-12-09 (Sesión 7)
*   **Corrección de Modo Oscuro:**
    *   Se solucionó el problema de reseteo del tema al navegar. Se reemplazó el `MutationObserver` conflictivo en `MainLayout.astro` por un listener de `astro:after-swap`, asegurando que la preferencia del usuario persista correctamente.
*   **Gestión de Datos de Usuario Afectado:**
    *   **Base de Datos:** Se añadieron las columnas opcionales `afectado_clave` y `afectado_nombre` a la tabla `Ticket` mediante una migración de Prisma.
    *   **Creación de Tickets:** Se actualizó `nuevo-ticket-csh.astro` y su lógica (`ticket-wizard.ts`) para solicitar dinámicamente "Matrícula/Folio/Clave" y "Nombre" cuando la categoría es Alumno, Aspirante, Colaborador o Docente.
    *   **Vista de Tickets:** Se actualizó `view/[id].astro` para mostrar estos datos condicionalmente con etiquetas dinámicas, integrándolos visualmente en la sección de detalles.
    *   **Edición de Datos:** Se habilitó la modificación de `afectado_clave` y `afectado_nombre` desde la vista de detalle.
        *   Frontend: Campos `<input>` en lugar de texto estático.
        *   Backend: Lógica de actualización y seguimiento en historial (`historialSolicitud`).
    *   **Edición Avanzada:**
        - Se convirtió el campo "Descripción" en un `<textarea>` editable.
        - Se implementó lógica para cambiar dinámicamente la etiqueta de "Nombre del Afectado" a "Nombre del Alumno/Aspirante/etc." según la categoría.
        - Se mejoró el Historial de Cambios para registrar modificaciones en la Descripción y usar nombres amigables para todos los campos (incluyendo las etiquetas dinámicas).
        - Se actualizó el backend para registrar Nombres Reales (ej. "En progreso") en lugar de IDs en el historial para Estatus y Agente.
    *   **UI Notificaciones:** Se corrigieron los colores de los badges de estatus en el dropdown de notificaciones para que coincidan con la definición global.
    *   **Limpieza UI:** Se eliminó la columna "Solicitante" en la vista "Mis Tickets" por redundancia.
    *   **Optimización Móvil (Filtros):** Se mejoró el diseño de los filtros en móvil (grid de 2 columnas) y se renombró 'Campus' a 'Empresa' en las vistas de tickets.
    *   **Mejora UX (Mis Tickets):** Se implementó visualización condicional de columnas (Solicitante + Empresa) para usuarios privilegiados y un botón "Limpiar Filtros" para restablecer la vista.
    *   **Filtros Inteligentes:** La vista por defecto ahora muestra solo tickets activos. Los filtros secundarios (Categoría, Empresa, Agente) son dinámicos y dependen del Estatus seleccionado.
*   **Verificación:**
    *   Pruebas de flujo completo de creación y visualización de tickets con los nuevos campos.

## 2025-11-27 (Sesión 5)
*   **Actualización de Tema Oscuro en Vistas Adicionales:**
    *   Se actualizaron los selectores de filtros en `src/pages/tickets/soporte/index.astro` para usar variables de tema (`bg-input`, `border-border`, `text-foreground`).
    *   Se mejoraron los botones de paginación en la misma vista para incluir estados hover y transiciones suaves.
    *   Se actualizó el botón "Volver a la lista" en `src/pages/tickets/view/[id].astro` para usar variables de tema (`bg-muted`, `text-muted-foreground`).
    *   Se verificó que los botones "Volver" en `src/pages/admin/usuarios/[campus].astro` y `src/pages/admin/usuarios/editar/[id].astro` ya estaban correctamente actualizados.
    *   **Corrección de Persistencia de Tema:** Se actualizó `src/components/ui/ThemeToggle.astro` para re-adjuntar el listener de eventos en `astro:page-load`, solucionando el problema donde el botón de tema dejaba de funcionar al navegar entre páginas (View Transitions).
    *   **Mejora UI Admin Usuarios:**
        *   Se eliminó la columna "Acciones" en `src/pages/admin/usuarios/[campus].astro`.
        *   Se hicieron las filas de la tabla de usuarios clickeables para mejorar la navegación.
        *   Se reemplazó `SweetAlert2` por el sistema de `toasts` en `src/scripts/user-edit-form-logic.ts`.
        *   Se corrigieron errores de TypeScript en `user-edit-form-logic.ts` (tipado de `dataset` y manejo de errores).
    *   **Mejoras Visuales y de Datos:**
        *   Se aplicó un estilo hover específico (`bg-[#797979]/40`) a las filas de las tablas en `[campus].astro`, `soporte/index.astro` y `usuario/index.astro` para mejorar la visibilidad.
        *   Se añadió el conteo de usuarios por empresa en las tarjetas de `src/pages/admin/usuarios/index.astro`, mostrando el número solo si es mayor a 0.
*   **Implementación RBAC Híbrido (Fase 1):**
    *   **Base de Datos:** Se actualizó `prisma/schema.prisma` agregando campos de auditoría (`createdAt`, `updatedAt`), estado (`activo`) y prioridad a `PermisoCategoria` y `AsignacionesCategorias`. Se añadieron índices para optimizar búsquedas.
    *   **Seed:** Se actualizó `prisma/seed.ts` incluyendo los nuevos roles (`Ingeniero Hubspot`, `Editor`) y la lógica completa de población de `PermisoCategoria` con 73 permisos iniciales mapeados.
    *   **Migración:** Se ejecutó exitosamente la migración `add_rbac_improvements` y el seed de datos.
    *   **Verificación:** Se validó la integridad de los datos (roles y permisos) mediante script de prueba.
*   **Implementación RBAC Híbrido (Fase 2):**
    *   **Servicio:** Se creó `src/services/ticketAssignmentService.ts` implementando la lógica de asignación híbrida (Usuario > Rol > Fallback).
    *   **API:** Se actualizó `src/pages/api/tickets/create.ts` para utilizar el nuevo servicio de asignación.
    *   **Corrección:** Se corrigió un error de importación en `create.ts` que causaba fallos en el build.
*   **Implementación RBAC Híbrido (Fase 3):**
    *   **Componentes UI:** Se crearon `StatusBadge.astro` (badges de estado consistentes) y `SkeletonTable.astro` (loader).
    *   **Vista de Tickets:** Se actualizó `src/pages/tickets/soporte/index.astro` con diseño responsivo (tabla en desktop, cards en móvil) y uso de los nuevos componentes.
    *   **Dependencias:** Se instaló `date-fns` para el formateo de fechas en el servidor.
*   **Mejoras UI (Listas de Tickets):**
    *   **Soporte General:** Se eliminó la columna "Asunto" y se reordenaron las columnas (ID, Estatus, Solicitante, Categoría, Asignado a, Fecha) en `tickets/soporte/index.astro`.
    *   **Mis Tickets:** Se refactorizó `tickets/soporte/usuario/index.astro` a SSR para paridad visual y funcional, aplicando el mismo diseño responsivo y orden de columnas.
*   **Verificación:**
    *   Se ejecutó `pnpm build` exitosamente, confirmando la integridad del código.

## 2025-11-26 (Sesión 4)
*   **Migración Completa de SweetAlert2 a Toasts:**
    *   Se completó la migración de `modal-controller.ts` y sus consumidores (`NewTicketMkt.astro`, `NewTransfer.astro`) al sistema de toasts personalizado.
    *   Se eliminó la dependencia `sweetalert2` del proyecto.
    *   Se corrigió una duplicación masiva de código y errores de sintaxis en `NewTicketMkt.astro` que impedían la compilación.
    *   Se restauró código truncado en `NewTransfer.astro`.
    *   **Corrección Post-Verificación:** Se detectó y eliminó un bloque duplicado de código (frontmatter y HTML) en `NewTicketMkt.astro` que causaba errores visuales en el sidebar.
    *   **Migración Vista Ticket:** Se reemplazó `SweetAlert2` por `toast` en `src/pages/tickets/view/[id].astro` y `src/scripts/ticket-view-logic.ts`. Se implementó un modal HTML nativo para la confirmación de borrado de archivos.
    *   **Corrección Lógica Ticket:** Se corrigió el backend (`update.ts`) para detectar cambios en campos específicos (`estatusId`, `prioridad`, etc.) en lugar de objetos completos, asegurando que el historial se guarde correctamente.
    *   **Mejora UX Ticket:** Se añadió lógica en el frontend para cambiar automáticamente el estatus de "Nuevo" a "En progreso" al guardar cambios.
*   **Mejora del Sistema de Notificaciones (SSE):**
    *   **Backend (`notifications.ts`):** Se implementó identificación de usuarios (`userId`), heartbeats para mantener la conexión viva y limpieza de clientes desconectados.
    *   **Frontend (`MainLayout.astro`):** Se implementó un cliente SSE robusto con reconexión exponencial y filtrado de notificaciones propias.
    *   **Integración:** Se actualizaron los endpoints de creación (`create.ts`) y actualización (`update.ts`) de tickets para enviar notificaciones dirigidas (al agente asignado o al solicitante) en lugar de broadcasts generales.
    *   **UI:** Las notificaciones SSE ahora muestran un toast informativo en la interfaz del usuario.
*   **Verificación:**
    *   Se ejecutó `pnpm build` exitosamente, confirmando la integridad del código tras las refactorizaciones.

## 2025-11-26 (Sesión 3)
*   **Implementación Intensiva de Modo Oscuro:**
    *   **Dashboard:** Se actualizaron `StatCard.astro` para incluir bordes en modo oscuro y mejorar el contraste del texto.
    *   **Admin Usuarios:** Se actualizaron `[campus].astro` y `editar/[id].astro` para usar variables de tema en botones, badges y checkboxes.
    *   **Tickets Soporte:** Se actualizó `index.astro` para mejorar los estados hover de las filas y los colores de los badges de estado y fechas.
    *   **Vista de Ticket:** Se actualizó `view/[id].astro` para usar variables de tema en selectores, botones, badges y la animación de flash.
    *   **Limpieza:** Se verificó la ausencia de clases hardcoded (`bg-white`, `text-black`) en componentes clave.
*   **Corrección de Changelog:**
    *   Se restauró y actualizó `CHANGELOG.md` con la estructura correcta y los últimos cambios.

## 2025-11-26 (Sesión 2)
*   **Corrección de Sistema de Toasts:**
    *   Se corrigió el error de fondo transparente en los toasts eliminando el uso incorrecto de `hsl()` con variables hexadecimales en `toast.css`.
    *   Se implementó un borde blanco sutil para los toasts en modo oscuro.
    *   Se cambió la posición por defecto de los toasts a `top-right`.
    *   Se corrigieron errores de sintaxis en `toast.ts`.
*   **Actualización de Documentación:**
    *   Se actualizó `CHANGELOG.md` con la versión 0.2.0.
    *   Se actualizó `GEMINI.md` con el progreso actual y los pasos siguientes.

## 2025-11-26 (Sesión 1)
*   **Limpieza de Dependencias Obsoletas:**
    *   Se eliminaron dependencias no utilizadas: `express` (5.1.0), `socket.io` (4.8.1), `socket.io-client` (4.8.1)
    *   Se agregó `sonner` (1.7.0) para sistema de toasts moderno
    *   Se agregó `typescript` (5.7.2) explícitamente en devDependencies para mejor control de versión
    *   Se eliminaron archivos residuales: `package-lock.json`, `Humanitas_SCRUM.pdf`, `Humanitas_SCRUM_tablero.pdf`, `por_hacer_vscode.txt`
*   **Sistema de Changelog:**
    *   Se creó `CHANGELOG.md` siguiendo el estándar [Keep a Changelog](https://keepachangelog.com/)
    *   Se implementó versionado semántico para el proyecto
    *   Se documentaron cambios desde la versión 0.1.0 hasta la actual
*   **Documentación del Proyecto:**
    *   Se actualizó `GEMINI.md` con el plan de trabajo actual
    *   Se crearon planes de implementación detallados:
        - Plan RBAC Híbrido (3 sprints, 6 semanas)
        - Plan Notificaciones en Tiempo Real (5 días)
    *   Se documentaron hallazgos del análisis completo del proyecto

## 2025-10-10
*   **Mejora de la Lógica de Asignación de Tickets (`/api/tickets/create.ts`):**
    *   Se modificó la función `findBestAgent` para incluir una validación basada en el horario laboral del agente.
    *   La nueva lógica obtiene la fecha y hora actual (zona horaria de México) y la compara con el rango de `inicio` y `fin` definido en el campo `horario_disponibilidad` del usuario.
    *   Los agentes que no tienen un horario definido o no se encuentran dentro de su jornada laboral son excluidos de la asignación, haciendo el proceso más preciso.
*   **Refactorización y Corrección de UI de Horarios (`/admin/usuarios/editar/[id].astro`):**
    *   Se reemplazó el `textarea` de `horario_disponibilidad` por una serie de selectores dinámicos (Lunes a Sábado) para una edición de horarios más intuitiva.
    *   Se solucionó un error crítico de renderizado (`Cannot use import statement outside a module`) externalizando toda la lógica del formulario al nuevo script `src/scripts/user-edit-form-logic.ts`.
    *   Se desacopló el paso de datos del frontend al script, utilizando atributos `data-*` en el elemento `<form>`, lo que resuelve problemas de carga y ejecución de scripts en Astro.

## 2025-10-09
*   **Implementación y Depuración de Sistema de Permisos (RBAC):**
    *   Se diseñó e implementó un sistema de control de acceso basado en roles y permisos para reemplazar la lógica de visibilidad basada en `rolId`.
    *   **Base de Datos:** Se añadió el modelo `Permiso` a `schema.prisma` y se estableció una relación muchos-a-muchos con el modelo `Rol`.
    *   **Seeding:** Se actualizó `seed.ts` para crear una lista de permisos (`ver_seccion_admin`, `ver_seccion_marketing`, etc.) y asignarlos a los roles correspondientes.
    *   **Depuración de Seeding:** Se diagnosticó y resolvió un problema por el cual el script de `seed` no se ejecutaba. Se identificó que el comando correcto para el proyecto es `pnpm run seed` en lugar de `npx prisma db seed`.
    *   **Autenticación:** Se modificó `auth.config.ts` para cargar la lista de permisos del usuario en el token de sesión (`jwt`) y en el objeto de sesión final, haciéndolos disponibles en el frontend.
    *   **UI:** Se refactorizó el componente `Sidebar.astro` para que la visibilidad de los menús (como "Administrador" y "Marketing") se base en los permisos de la sesión (ej. `session.user.permisos.includes('ver_seccion_admin')`).
*   **Corrección Proactiva de Errores y Warnings:**
    *   Se solucionó un `warning` inicial de TypeScript en `auth.config.ts` convirtiendo el `id` numérico del usuario a `string` en el objeto de sesión.
    *   Se corrigieron los errores de validación de Prisma (`PrismaClientValidationError`) resultantes del cambio anterior. Esto implicó una búsqueda proactiva y la corrección en todos los archivos afectados (`/api/tickets/list.ts`, `/api/tickets/create.ts`, `/api/admin/usuarios.ts`, `/api/tickets/update.ts`), asegurando que el `id` del usuario se convierta de nuevo a `Int` (`parseInt`) antes de ser usado en cualquier consulta a la base de datos.
    *   Se corrigieron `warnings` de TypeScript adicionales en los archivos de API (`create.ts`, `update.ts`, `usuarios.ts`) relacionados con el manejo de tipos ambiguos (`string | number | undefined`) en la sesión del usuario.

## 2025-09-25
*   **Roles y Base de Datos:**
    *   Se ha ampliado el `enum NivelSoporte` en `schema.prisma` para incluir los roles `Usuario`, `Coordinador` y `Director`.
    *   Se actualizó el archivo `seed.ts` para asignar los nuevos niveles de soporte y para añadir un usuario administrador por defecto.
    *   Se corrigió un warning de tipo en `seed.ts` usando `Prisma.JsonNull`.
    *   Se regeneró el cliente de Prisma para solucionar un error de `enum` durante el login.
*   **Permisos y Experiencia de Usuario (Rol "Usuario"):**
    *   Se implementó una redirección en la página principal (`index.astro`) para que los usuarios con `nivel_soporte: 'Usuario'` vean su lista de tickets en lugar del dashboard.
    *   Se restringió la visibilidad de elementos en el `Sidebar` (menús de Marketing, Administrador, y vistas de Dashboard/Todos los tickets) para el rol `Usuario`.
    *   Se ajustó la página de "Mis Tickets" (`.../usuario/index.astro`) para que el filtro "Atiende" solo sea visible para los usuarios no privilegiados.

## 2025-09-19
*   **Mejoras en Carga de Archivos (`/tickets/view/[id].astro`):**
    *   Se implementó una validación completa de archivos en el cliente, incluyendo un límite de tamaño (5MB) y formatos permitidos (imágenes, PDF, documentos de Office).
    *   La interfaz ahora muestra el tamaño de cada archivo y marca en rojo aquellos que no son válidos, especificando la razón.
    *   Se añadió un flujo de eliminación de archivos con un nuevo botón "Borrar archivos", confirmación mediante `SweetAlert2` y un modo de selección para borrado específico.
    *   Se implementó una regla de negocio que obliga a escribir un comentario descriptivo (>10 caracteres) si se adjuntan archivos.

*   **Lógica de Tickets Mejorada:**
    *   **Acción Automática:** Al comentar en un ticket con estatus "Cancelado", "Duplicado" o "Solucionado", el estatus cambia automáticamente a "En progreso", reabriendo el ticket de forma efectiva.
    *   **Filtros Dinámicos:** Los filtros de "Categoría", "Empresa" y "Atiende" en las páginas de listado ahora solo muestran opciones que tienen tickets relevantes en la vista por defecto, mejorando la usabilidad.
    *   **Corrección de Filtros:** Se solucionó un bug que impedía que el filtro por estatus mostrara correctamente los tickets "Cancelados", "Duplicados" y "Solucionados".
    *   Se revirtió la restricción que impedía editar tickets con estatus cerrados.

*   **Mejoras de UI/UX:**
    *   Se añadió una animación de fundido a las transiciones entre páginas para suavizar la experiencia de navegación.
    *   Se aseguró que el menú lateral mantenga la selección en la sección correcta al ver el detalle de un ticket.

## 2025-09-18
*   **Lógica de Asignación de Tickets Mejorada (`/api/tickets/create.ts`):**
    *   Se implementó una restricción para evitar la auto-asignación de tickets (el solicitante no puede ser el agente asignado).
    *   Se añadió el estatus "Sin asignar" (ID 11) y se hizo opcional el campo `atiendeId` en la base de datos para permitir tickets en cola.
    *   La API ahora asigna automáticamente un ticket como "Sin asignar" si no hay agentes disponibles o si el único disponible es el propio solicitante.

*   **Modernización de Notificaciones (UI/UX):**
    *   Se reemplazó la librería `SweetAlert2` por `sonner` (a través de `shadcn/ui`) para mostrar notificaciones tipo "toast", mejorando la experiencia de usuario.
    *   Se instaló y configuró la integración de React en Astro (`@astrojs/react`) como requisito para `shadcn/ui`.
    *   Se personalizaron las notificaciones para usar los colores corporativos y la fuente Montserrat.
    *   Se actualizaron los formularios de nuevo ticket y la vista de detalle para usar el nuevo sistema de notificaciones.

*   **Corrección de Bugs y Refactorización:**
    *   Se solucionó un error crítico (`ERR_INVALID_STATE`) en el sistema de notificaciones en tiempo real (SSE) que ocurría al intentar enviar mensajes a clientes desconectados.
    *   Se corrigió un `SyntaxError` en la página de detalle del ticket (`view/[id].astro`) refactorizando el script en línea a un módulo externo (`ticket-view-logic.ts`).
    *   Esta refactorización también solucionó el bug que impedía el funcionamiento del botón para adjuntar archivos.
    *   Se corrigió una advertencia de TypeScript (`'ticket.atiende' is possibly 'null'`) derivada de los cambios en el esquema de la base de datos.

## 2025-09-17
*   **Mejoras en Login (`src/pages/login.astro`):**
    *   Se añadió un indicador visual de carga (efecto `pulse`) al hacer clic en el botón de inicio de sesión.
    *   Se mejoró el manejo de errores para mostrar un mensaje específico para usuarios no colaboradores (`NoEsColaborador`).
    *   Se ajustó la lógica para que los mensajes de error reemplacen el texto de bienvenida, mejorando la claridad.
    *   Se proveyó guía sobre cómo modificar la configuración de la app en Google Cloud (de "Interna" a "Externa") para permitir que la aplicación maneje internamente la validación de dominios.
*   **Rediseño del Dashboard (`src/pages/index.astro`):**
    *   Se rediseñó la página principal para mostrar un dashboard con tarjetas de estadísticas (`StatCard`).
    *   Se implementó la lógica para calcular y mostrar métricas clave: "Tickets Nuevos", "En progreso", "En espera" y "Traslados del ciclo".
    *   Se añadió un botón "Ver todo" / "Ver menos" que muestra/oculta estadísticas secundarias ("Total", "Solucionados", "Duplicados", "Cancelados").
    *   Se actualizó el componente `StatCard` para aceptar un color de fondo dinámico, mejorando la visualización de datos.
    *   Se corrigió una advertencia de CSS (`cssConflict`) entre las clases `grid` y `hidden` de Tailwind CSS.
*   **Base de Datos y Seeding (`prisma/seed.ts`):**
    *   Se añadió el estatus "En progreso" a la base de datos a través de una migración de Prisma.
    *   Se actualizó el script de `seed` para incluir el nuevo estatus y asegurar su persistencia.
    *   Se robusteció el script de `seed` corrigiendo el orden de borrado de las tablas para respetar las `foreign key constraints`, solucionando múltiples errores de ejecución.
    *   Se poblaron las tablas `subcategoria` y `subcategoria_categorias` con datos de un archivo SQL, integrándolos en el `seed.ts`.
    *   Se añadió la categoría "Marketing" con su jerarquía completa de subcategorías al script de `seed`.

## 2025-09-11
*   **Mejoras en Autenticación (`auth.config.ts`):**
    *   Se implementó una restricción para permitir el inicio de sesión únicamente a usuarios pertenecientes a una Unidad Organizativa (OU) de Google que contenga "colaboradores".
    *   Se corrigió una advertencia de TypeScript (`type 'number' is not assignable to type 'never'`) en el callback de `session` de Auth.js, asegurando la correcta asignación de un ID numérico a la sesión del usuario.
    *   Se ajustó la lógica de validación de la OU para que no sea sensible a mayúsculas y minúsculas, solucionando un bug que impedía el acceso.
*   **Gestión del Repositorio:**
    *   Se realizaron múltiples commits para separar lógicamente los cambios en la autenticación de otras actualizaciones de archivos.
    *   Se actualizó el archivo `.gitignore` para excluir `Mejoras.txt`.

## 2025-09-10
*   **Mejoras en Listado de Tickets (`src/pages/index.astro`):**
    *   Se ajustó el filtro de "Estatus" para mostrar solo los valores permitidos (`Nuevo`, `En espera`, `Solucionado`, `Cancelado`, `Duplicado`), eliminando los relacionados con traslados.
    *   Para usuarios con roles privilegiados, la vista de tickets ahora muestra por defecto solo los tickets asignados a ellos, eliminando el filtro manual de "Atiende".
    *   Se mejoró la usabilidad de la tabla de tickets, haciendo que toda la fila sea un enlace clickeable hacia la vista de detalle del ticket, con un efecto `hover` (fondo gris) para mayor claridad.
*   **Corrección de Notificaciones y UI (`src/layouts/MainLayout.astro`):**
    *   Se solucionó un bug visual que causaba que el ícono de la campana de notificaciones se deformara al hacer clic, asignándole un tamaño fijo.
    *   Se mejoró la lógica del sistema de notificaciones (SSE) para evitar que los usuarios reciban notificaciones por acciones que ellos mismos realizan. Se añadió un `originatorId` al payload del evento para su exclusión en el cliente.
*   **Correcciones Menores:**
    *   Se corrigió una advertencia de TypeScript en `src/pages/tickets/view/[id].astro` dentro de un bloque `catch`.
    *   Se validó la integridad del proyecto con múltiples `builds` exitosos después de los cambios.

## 2025-09-05
*   **Mejoras en la Página de Detalle de Tickets (`src/pages/tickets/view/[id].astro`):**
    *   Implementación de URLs pre-firmadas para archivos adjuntos.
    *   Mejora del comportamiento del popup de la lista de archivos adjuntos (cierre al hacer clic fuera, al presionar Esc, después de abrir el archivo).
    *   Filtrado de "Cambios de campos" para mostrar solo "Prioridad" y "Asignado a".
    *   Adición del estatus del ticket en las entradas del historial.
    *   Corrección del color del estatus en el formulario de edición.
    *   Implementación de scroll a la nueva entrada del historial con animación de parpadeo.
    *   Reubicación del ícono de clip de archivos adjuntos.
    *   Implementación de restricciones de edición para tickets "Cancelados", "Duplicado" o "Solucionados".
    *   Cambios en la UI para tickets de solo lectura (mostrar valores en etiquetas `<p>`, solo el campo "Archivado" es editable, se eliminó el textarea).

*   **Sistema de Notificaciones en Tiempo Real (SSE):**
    *   Eliminación de la integración de Socket.io.
    *   Implementación de Server-Sent Events (SSE) para notificaciones en tiempo real.
    *   Creación de un nuevo endpoint SSE (`src/pages/api/notifications.ts`).
    *   Modificación de las rutas de la API (`create.ts` y `update.ts`) para enviar notificaciones a través de SSE.
    *   Modificación de `MainLayout.astro` para conectar al endpoint SSE y mostrar el contador de notificaciones.
    *   Eliminación del componente `UserProfile` del encabezado de `MainLayout.astro`.

*   **Página de Listado de Tickets (`src/pages/index.astro`):**
    *   Adición de la columna "Prioridad".
    *   Implementación de filtrado para tickets "Cancelados", "Duplicados" o "Solucionados".

*   **Correcciones Adicionales:**
    *   Corrección de advertencias de TypeScript en `MainLayout.astro` relacionadas con la manipulación del DOM y el uso de componentes Astro en el cliente.
    *   Ajuste del script `dev` en `package.json` para asegurar que el servidor personalizado de Node.js se ejecute correctamente en desarrollo.

## 2025-09-04
*   **Implementación de Gestión de Tickets (Fase Completa):**
    *   **Lista de Tickets (`/`):** Implementación de la vista de lista de tickets con columnas dinámicas según el rol, semáforo de fechas y colores de estatus.
    *   **Vista de Detalle y Edición (`/tickets/view/[id]`):**
        *   Rediseño completo de la interfaz de usuario para optimizar espacios y hacerla responsiva.
        *   Implementación de la sección de historial de cambios, mostrando usuario, comentario, cambios de campos y archivos adjuntos.
        *   Funcionalidad de edición para roles privilegiados (estatus, prioridad, solicitante, atiende, archivado).
    *   **Sistema de Subida de Archivos (S3):**
        *   Integración con AWS S3 para el almacenamiento seguro de archivos.
        *   Implementación de API para generación de URLs pre-firmadas.
        *   Lógica de frontend para selección, validación y subida de archivos, consolidada con el guardado de cambios del ticket.
        *   Actualización del modelo `Ticket` y `HistorialSolicitud` para almacenar referencias a los archivos.
    *   **Correcciones y Mejoras:**
        *   Resolución de múltiples `warnings` de TypeScript y errores de ejecución (incluyendo problemas de carga de `sweetalert2` y acceso a propiedades de objetos).
        *   Refactorización de la lógica de guardado para un proceso más atómico y robusto.
        *   Ajustes de estilos y usabilidad en selectores y visualización de archivos.

## 2025-09-01
*   **Validación del Proyecto:** Se validó la integridad del proyecto `siget-csh` ejecutando el proceso de build de Astro, confirmando que no existen errores de compilación.
*   **Corrección de API de Usuarios (`/api/admin/usuarios.ts`):**
    *   Se corrigieron múltiples advertencias de TypeScript relacionadas con el manejo de tipos de Prisma.
    *   Se solucionó un error de tipo `unknown` en bloques `catch`.
    *   Se implementó la sintaxis correcta (`connect`) para actualizar relaciones de base de datos en Prisma.
*   **Corrección de UI de Usuarios (`/admin/usuarios`):**
    *   Se solucionó un bug donde los datos no se actualizaban al navegar entre diferentes "campus".
    *   Se aplicó el atributo `data-astro-reload` para forzar la recarga de la página y asegurar la consistencia de los datos.
*   **Confirmación Final:** Se realizó una última validación del proyecto a través del build, confirmando que todos los cambios se integraron correctamente.