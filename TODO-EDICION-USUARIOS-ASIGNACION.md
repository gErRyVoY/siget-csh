# 📋 To-Do List: Actualizaciones en Edición de Usuarios & Asignación de Tickets

---

## 🟢 FASE 1: Rediseño y Reestructuración de la UI en `/admin/usuarios/editar/[id].astro`

### 1.1 Estructura Visual de "Categorías y Subcategorías que puede atender"
- [x] **1.1.1** Clasificar las categorías/subcategorías en dos subsecciones principales:
  - `Habilitadas`: Categorías con al menos una subcategoría activa.
  - `Sin acceso`: Categorías con 0 subcategorías activas.
- [x] **1.1.2** Ordenar las categorías en ambas subsecciones alfabéticamente de forma ascendente (A - Z).
- [x] **1.1.3** Configurar grid responsivo: 2 columnas en escritorio (`lg:grid-cols-2`) y 1 columna en móviles/tablets (`grid-cols-1`).
- [x] **1.1.4** Mantener la agrupación por categorías/subcategorías en acordeón como en la vista `/admin/categorias`.
- [x] **1.1.5** Asegurar que tras guardar los cambios la vista se actualice reflejando la reclasificación entre "Habilitadas" y "Sin acceso".

---

### 1.2 Visibilidad y Comportamiento Dinámico según el Rol

#### 👤 **Rol Usuario (`Usuario` / `rolId === 1`)**
- [x] **1.2.1** Toggles superiores: Mostrar solo `Activo`, `Levanta CSH` y `Levanta Mkt`. Ocultar `Asignar tickets`, `Atiende CSH`, `Atiende Mkt`, `Auditor Docs` y `Auditor Reqs`.
- [x] **1.2.2** Ocultar completamente la sección `"Horario de Disponibilidad"`.
- [x] **1.2.3** Sección `"Secciones que puede ver el usuario"`:
  - Si se activa/desactiva `Levanta CSH` → habilitar/deshabilitar automáticamente:
    - *Abrir ticket:* `CSH` (`crear_ticket_csh`)
    - *Tickets soporte:* `Dashboard` (personal, `soporte_dashboard`) y `Mis tickets` (`soporte_mis_tickets`).
  - Si se activa/desactiva `Levanta Mkt` → habilitar/deshabilitar automáticamente:
    - *Abrir ticket:* `Marketing` (`crear_ticket_marketing`)
    - *Tickets Marketing:* `Dashboard` (personal, `marketing_dashboard`) y `Mis tickets` (`marketing_mis_tickets`).
  - Ocultar siempre: `Tickets soporte: Todos`, `Tickets Marketing: Todos` y todo lo relacionado a `Administrador`.
- [x] **1.2.4** Ocultar completamente la sección `"Categorías y subcategorías que puede atender"`.

#### 👨‍💼 **Rol Admin (`Admin` / `rolId === 2`)**
- [x] **1.2.5** Al apagar el toggle de `Activo`: Desactivar automáticamente en interfaz y base de datos: `Asignar tickets`, `Levanta CSH`, `Levanta Mkt`, `Atiende CSH`, `Atiende Mkt`, `Auditor Docs` y `Auditor Reqs`.
- [x] **1.2.6** Si se activa/desactiva `Levanta Mkt` → activar/desactivar la categoría `Marketing` en el panel de categorías que puede atender.
- [x] **1.2.7** Sección `"Horario de disponibilidad"`: Mantener acordeón solo como vista de consulta (deshabilitado para edición), agregando nota informativa de que se sincroniza con la API de RH al iniciar sesión.
- [x] **1.2.8** Sección `"Secciones que puede ver el usuario"`:
  - Ocultar todo lo relacionado a `Administrador`.
  - Al activar/desactivar `Atiende CSH` → habilitar/deshabilitar `Tickets soporte: Dashboard, Mis tickets y Todos`.
  - Al activar/desactivar `Atiende Mkt` → habilitar/deshabilitar `Tickets Marketing: Dashboard, Mis tickets y Todos`.
  - Al activar/desactivar `Levanta CSH` → habilitar/deshabilitar `Abrir ticket: CSH`.
  - Al activar/desactivar `Levanta Mkt` → habilitar/deshabilitar `Abrir ticket: Marketing`.

#### 👑 **Rol Superadmin (`Superadmin` / `rolId === 3`)**
- [x] **1.2.9** En sesión propia (`/admin/usuarios/editar/[su_propio_id]`):
  - Ocultar el toggle `Activo` (solo puede ser desactivado por otro superadmin).
  - Deshabilitar el selector de `Rol` (solo informativo; no puede cambiarse el rol a sí mismo).
  - Ocultar la sección `"Horario de disponibilidad"`.
  - Ocultar la sección `"Secciones que puede ver el usuario"`.
  - Mostrar la sección `"Categorías y subcategorías que puede atender"`.

---

## 🟡 FASE 2: Backend y Scripts de Formulario

- [x] **2.1** Actualizar `src/scripts/user-edit-form-logic.ts` con los event listeners para sincronizar dinámicamente los toggles de acuerdo a las reglas de rol en el cliente.
- [x] **2.2** Actualizar `src/pages/api/admin/usuarios.ts` (PATCH) para que al desactivar `activo = false`, apague en BD todos los demás toggles correspondientes.
- [x] **2.3** Agregar validaciones de seguridad en el backend para evitar que un Superadmin se cambie el rol o se desactive a sí mismo.

---

## 🔵 FASE 3: Motor de Asignación de Tickets (`ticketAssignmentService.ts`)

- [x] **3.1** Validar que `Asignar tickets` (`acepta_tickets`) sea el primer filtro obligatorio para asignación automática. Si está deshabilitado, no asignar automáticamente ningún ticket (pero sí permitir asignación manual desde el detalle del ticket).
- [x] **3.2** Asegurar que la carga actual (`carga_actual`) solo aplique para el cálculo de asignación automática, no para la asignación manual.
- [x] **3.3** Asegurar que el horario de disponibilidad solo aplique para asignación automática, no para asignación manual.
- [x] **3.4** Validar que solo se puedan asignar (manual o automáticamente) tickets cuyas categorías/subcategorías estén habilitadas para el agente (`atiende_csh`/`atiende_mkt` + asignaciones activas). Si no tiene ninguna categoría habilitada, no se le podrá asignar ningún ticket.

---

## 🟣 FASE 4: Verificación y Compilación

- [x] **4.1** Correr `npx astro check` y verificar compilación limpia con 0 errores.
- [x] **4.2** Probar los flujos dinámicos con distintos roles y actualizar el estado de tareas.

---

## 🔴 FASE 5: Correcciones Post-Despliegue (2026-07-27)

- [x] **5.1** **Superadmin bloqueado en Categorías**: Se creó `canEditCategorias` independiente de `canEdit`/`isTargetSelfSuperAdmin` para que los toggles de categorías siempre sean editables para Admin y Superadmin, incluso en la edición del propio perfil.
- [x] **5.2** **Cascada de apagado de subcategoría a hijos**: Se añadió lógica en el cliente (`[id].astro` script) para que al apagar una subcategoría con hijos, se recorra el `details` padre del DOM y se apaguen visualmente todos los `category-toggle` descendientes (y se actualicen sus knobs).
- [x] **5.3** **"Habilitadas" mostraba subcategorías inactivas**: Se refactorizó la construcción del árbol SSR con dos funciones (`filterActiveSubtree`/`filterInactiveSubtree`) y se añadieron los campos `enabledSubcategorias` / `disabledSubcategorias` a `UserCatNode`. Las tarjetas en "Habilitadas" ahora solo muestran las subcategorías activas y agregan un sub-acordeón interno "Sin acceso" para las inactivas.
- [x] **5.4** Verificar compilación `npx astro check` con 0 errores. ✅ (149 archivos, 0 errores, 0 warnings)
