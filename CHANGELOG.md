# Changelog - SiGeT V2.0

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Versionado Semántico](https://semver.org/lang/es/).



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
- **Notificaciones:** Corrección de colores en badges de estatus del dropdown.

## [0.9.4] - 2026-01-19

### Fixed
- **API Usuarios:** Corregido error 500 en carga masiva de usuarios por argumento inválido (`loading`) en la creación de Prisma.

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
