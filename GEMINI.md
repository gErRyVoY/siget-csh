# Plan de Trabajo (SIGET-CSH)

**Tarea Actual:** Optimización UX — Navegación suave (anti-parpadeo) global completada ✅

**Estado:** Completado. Todos los `window.location.href` y `window.location.reload()` han sido reemplazados por `navigate()` de Astro View Transitions en todo el proyecto. Pendiente: despliegue a AWS.

**Pasos Siguientes:**
1. Estabilizar y continuar el flujo de despliegue usando la infraestructura AWS (ECR, App Runner, RDS).
2. Revisar si existen configuraciones pendientes en GitHub Actions o AWS.
3. Probar el proyecto en local con la base de datos PostgreSQL para verificar la integridad tras la fusión.

**Pasos Completados:**
- ✅ **Remoción de "Bloques" en Carrera (2026-06-23):** Implementada validación en el formulario de traslados (`consultarDetalleAlumno`) para remover la palabra "Bloques" (y el espacio previo) al consultar alumnos con campus origen "Virtual", asegurando la coincidencia exacta con `carreraOptions` y pasando la validación de oferta académica.
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
## 2026-06-23 (Remoción de "Bloques" en Carrera para Traslados)
*   **Formulario de Traslados (`/tickets/soporte/traslado.astro`):**
    *   **Limpieza de Carreras:** Se añadió una validación insensible a mayúsculas/minúsculas en el método `consultarDetalleAlumno` para limpiar la palabra "Bloques" (y el espacio previo) de la carrera obtenida de la API de alumnos si el campus origen es "Virtual". Esto previene fallas de validación de oferta académica en el frontend.

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