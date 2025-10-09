# Plan de Trabajo (SIGET-CSH)

**Objetivo Actual:** Corregir `warnings` de TypeScript en los archivos de la API.

**Pasos Siguientes:**
1.  [x] Corregir `warnings` en `src/pages/api/tickets/create.ts`.
2.  [x] Corregir `warnings` en `src/pages/api/admin/usuarios.ts`.
3.  [x] Corregir `warnings` en `src/pages/api/tickets/update.ts`.

---
*Este plan se actualizará al finalizar cada tarea.*
---

# Historial de Cambios (Log)

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