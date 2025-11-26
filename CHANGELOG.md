# Changelog - SiGeT V2.0

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Versionado Semántico](https://semver.org/lang/es/).


### Fixed
- Error de renderizado "Cannot use import statement outside a module" en edición de usuarios
- Warnings de TypeScript en archivos de API
- Validación de tipos en sesión de usuario

**Commits:** `fa67848`, `82b41ed`, `4e2225e`

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

**Última actualización:** 2025-11-26
