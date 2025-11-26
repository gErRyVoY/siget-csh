# Plan de Trabajo (SIGET-CSH)

**Tarea Actual:** Implementación de Sistema de Notificaciones en Tiempo Real y RBAC Híbrido

**Estado:** En progreso - Fase 1 completada.

**Pasos Completados:**
- ✅ Análisis completo del proyecto (tecnologías, código, BD, UI/UX)
- ✅ Creación de planes de implementación detallados:
  - Plan RBAC Híbrido (3 sprints, 6 semanas)
  - Plan Notificaciones en Tiempo Real (5 días)
- ✅ Limpieza de dependencias obsoletas:
  - Eliminado: `express`, `socket.io`, `socket.io-client`
  - Agregado: `sonner` (toasts), `typescript 5.7.2`
  - Eliminados archivos residuales (package-lock.json, PDFs, archivos temporales)
- ✅ Creado sistema de changelog estructurado (`CHANGELOG.md`)

**Pasos Siguientes:**
1.  **Implementar Sistema de Notificaciones en Tiempo Real (5 días):**
    - Día 1-2: Instalar y configurar Sonner, migrar de SweetAlert2
    - Día 3-4: Mejorar sistema SSE con reconexión automática
    - Día 5: Integrar notificaciones con creación/actualización de tickets
2.  **Implementar RBAC Híbrido (6 semanas):**
    - Sprint 1: Actualizar BD, crear servicios de asignación
    - Sprint 2: Crear componentes UI, mejorar responsividad
    - Sprint 3: Desplegar y validar con usuarios

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

## 2025-11-26
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