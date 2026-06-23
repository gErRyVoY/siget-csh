# Changelog - SiGeT V2.0

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Versionado Semántico](https://semver.org/lang/es/).

## 2026-06-23 (Remoción de "Bloques" en Carrera para Traslados)

### Cambios en Frontend (Formulario de Traslado)

*   **`src/pages/tickets/soporte/traslado.astro`:**
    *   Se añadió una validación en la función `consultarDetalleAlumno` para limpiar el valor de la carrera devuelto por la API cuando el campus origen es `"Virtual"`.
    *   La limpieza remueve la palabra "Bloques" (independientemente de mayúsculas o minúsculas) y cualquier espacio en blanco precedente, asegurando que coincida exactamente con las opciones permitidas en `carreraOptions` y pase la validación.

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
