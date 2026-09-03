# Roles y secciones en SiGeT — cómo funciona el control de acceso

Documento de referencia derivado del código (`auth.config.ts`, `src/middleware.ts`,
`src/components/shared/Sidebar.astro`, `src/pages/admin/usuarios/editar/[id].astro`,
`src/pages/api/admin/usuarios/secciones.ts`) y del estado real de la BD de desarrollo a
fecha 2026-09-03.

---

## 1. Las tres capas, en orden de precedencia

El acceso se calcula **una sola vez, al resolver la sesión**, en el callback `jwt` de
[auth.config.ts](auth.config.ts#L288-L306). El resultado es la lista `token.secciones`, que
viaja en la cookie de sesión y es la que consultan el middleware y el Sidebar.

```
1. seccion.activo          (interruptor GLOBAL, /admin/secciones)
        ↓  si está OFF, la sección se descarta y no hay nada que discutir
2. permiso_usuario_seccion (override POR USUARIO, /admin/usuarios/editar/<id>)
        ↓  si existe fila, gana: activo=true concede, activo=false revoca
3. permiso_rol_seccion     (línea base del ROL, /admin/roles)
        ↓  es el valor por defecto cuando el usuario no tiene override
```

El código, literalmente:

```ts
// 3 — base del rol, ya filtrada por el interruptor global
const seccionesRolList = fullUser.rol.permisos_seccion
  .filter(ps => ps.activo && ps.seccion.activo)
  .map(ps => ps.seccion.identificador);

let seccionesAprobadas = new Set(seccionesRolList);

// 2 — override del usuario, también sujeto al interruptor global
fullUser.permisos_seccion.forEach(ps => {
  if (!ps.seccion.activo) return;          // 1 — el global manda
  if (ps.activo) seccionesAprobadas.add(ps.seccion.identificador);
  else seccionesAprobadas.delete(ps.seccion.identificador);
});
```

Consecuencias exactas:

- **Una sección global en OFF no la ve nadie**, ni el superadmin, ni con override de usuario
  en ON. Es un kill switch verdadero.
- **El override de usuario gana al rol en las dos direcciones**: puede *conceder* algo que el
  rol no da (caso de Alumno Prueba) y puede *quitar* algo que el rol sí da.
- **El rol es solo el valor por defecto.** No hay ninguna sección reservada al rol por
  identificador, salvo las excepciones cableadas del punto 5.

### Cuándo se aplica un cambio

`/api/admin/usuarios/secciones` y los endpoints de roles y secciones llaman a
`invalidateAllSessionUsers()` tras escribir, así que el cambio se ve **en el siguiente F5**.
Sin esa invalidación habría que esperar el TTL de 15 s del micro-caché de sesión.

---

## 2. Qué hace cada toggle de `/admin/usuarios/editar/<id>`

El toggle escribe en `permiso_usuario_seccion` mediante un **upsert**
([secciones.ts:20](src/pages/api/admin/usuarios/secciones.ts#L20)):

| Acción | Efecto en BD | Efecto para el usuario |
|---|---|---|
| Encender un toggle | fila con `activo = true` | **concesión explícita**: tiene la sección aunque su rol no la dé |
| Apagar un toggle | fila con `activo = false` | **revocación explícita**: pierde la sección aunque su rol sí la dé |

Estado inicial que se pinta ([\[id\].astro:665](src/pages/admin/usuarios/editar/[id].astro#L665)):

```ts
const isChecked = explicitState !== undefined ? explicitState : isInherited;
```

es decir: si hay override se muestra el override; si no, se muestra lo que da el rol. El color
del toggle distingue los dos casos (`data-inherited`): heredado del rol en secundario,
concesión propia del usuario en color primario.

### Tres trampas a tener presentes

1. **No hay forma de volver a "heredar del rol" desde la interfaz.** Al ser un upsert, la fila
   nunca se borra. Un toggle apagado no significa "usa el valor del rol", significa
   "prohibido a este usuario". Si más adelante se concede esa sección al rol, este usuario
   seguirá sin ella. Para volver al estado heredado hay que borrar la fila de
   `permiso_usuario_seccion` en BD.
2. **El toggle no refleja el interruptor global.** La vista lista *todas* las secciones,
   incluidas las que están en OFF en `/admin/secciones`, y el estado del toggle se calcula
   sin mirar `seccion.activo`. Se puede ver un toggle en verde y que el usuario no tenga
   acceso, porque la sección está apagada globalmente. Hoy afectan a: `asistencia_remota`,
   `base_conocimientos`, `admin_correos_crear`, `admin_correos_actualizar`,
   `admin_siget_ciclos`, `feature_dark_mode`.
3. **"Todos" no aparece en esa vista.** `soporte_todos` y `marketing_todos` se filtran
   explícitamente del listado de toggles
   ([\[id\].astro:649](src/pages/admin/usuarios/editar/[id].astro#L649)), así que solo se
   pueden cambiar desde los permisos del rol.

---

## 3. Estado actual de las secciones (BD de desarrollo, 2026-09-03)

| id | identificador | global | qué controla |
|---:|---|:---:|---|
| 1 | `crear_ticket_csh` | ON | ruta `/tickets/soporte/nuevo-ticket-csh` + enlace |
| 2 | `proceso_traslados` | ON | ruta `/tickets/soporte/traslado` + enlace |
| 3 | `crear_ticket_marketing` | ON | ruta `/tickets/marketing/nuevo-ticket-marketing` + enlace |
| 4 | `soporte_mis_tickets` | ON | ruta `/tickets/soporte/usuario` + enlace "Mis tickets" |
| 5 | `soporte_dashboard` | ON | **solo** el enlace del Sidebar al Dashboard (`/`) |
| 6 | `soporte_todos` | ON | ruta `/tickets/soporte` + enlace "Todos" |
| 7 | `marketing_mis_tickets` | ON | ruta `/tickets/marketing/usuario` + enlace |
| 8 | `marketing_dashboard` | ON | ruta `/tickets/marketing/dashboard` + enlace |
| 9 | `marketing_todos` | ON | ruta `/tickets/marketing` + enlace "Todos" |
| 10 | `plataforma_humanitas` | ON | sin consumidor en `src/` — no hace nada hoy |
| 11 | `asistencia_remota` | **OFF** | enlace externo de descarga de AnyDesk |
| 12 | `base_conocimientos` | **OFF** | ruta `/base-de-conocimientos` + enlace |
| 13 | `horario_atencion` | ON | ruta `/horario-de-atencion` + enlace |
| 14 | `admin_correos_crear` | **OFF** | ruta `/admin/correos/crear` |
| 15 | `admin_correos_actualizar` | **OFF** | ruta `/admin/correos/actualizar` |
| 16 | `admin_siget_categorias` | ON | ruta `/admin/categorias` |
| 17 | `admin_siget_ciclos` | **OFF** | ruta `/admin/ciclos` |
| 18 | `admin_siget_secciones` | ON | ruta `/admin/secciones` |
| 20 | `admin_siget_usuarios` | ON | ruta `/admin/usuarios` |
| 22 | `feature_dark_mode` | **OFF** | flag de modo oscuro, no es una ruta |
| 23 | `admin_siget_empresas` | ON | ruta `/admin/empresas` |

**`/` (Dashboard) no está protegido por ninguna sección, y no puede estarlo**: es el destino
del `redirect` cuando el middleware deniega el acceso, así que protegerlo provocaría un bucle.
Cualquiera con sesión válida puede abrirlo; lo que cambia es el contenido, que se ramifica por
rol dentro de `index.astro`.

---

## 4. Línea base por rol (`permiso_rol_seccion` con `activo = true`)

Solo existen tres roles: `1 user`, `2 admin`, `3 superadmin`.

| sección | user | admin | superadmin |
|---|:---:|:---:|:---:|
| `crear_ticket_csh` | ✅ | ✅ | ✅ |
| `crear_ticket_marketing` | ✅ | ✅ | ✅ |
| `proceso_traslados` | ✅ | ✅ | ✅ |
| `horario_atencion` | ✅ | ✅ | ✅ |
| `plataforma_humanitas` | ✅ | ✅ | ✅ |
| `soporte_mis_tickets` | ✅ | ✅ | ✅ |
| `marketing_mis_tickets` | ✅ | ✅ | ✅ |
| `asistencia_remota` | ✅ | — | ✅ |
| `base_conocimientos` | ✅ | — | ✅ |
| `feature_dark_mode` | ✅ | — | ✅ |
| `soporte_dashboard` | — | ✅ | ✅ |
| `soporte_todos` | — | ✅ | ✅ |
| `marketing_dashboard` | — | ✅ | ✅ |
| `marketing_todos` | — | ✅ | ✅ |
| `admin_siget_*` (5) | — | — | ✅ |
| `admin_correos_*` (2) | — | — | ✅ |

Traducido a restricciones efectivas:

- **`user` (rol 1)**: puede abrir tickets de CSH y de marketing, iniciar un traslado, ver
  *sus* tickets y consultar el horario de atención. **No** ve dashboards, **no** ve "Todos" y
  **no** entra a nada de `/admin`. Tres de sus secciones (`asistencia_remota`,
  `base_conocimientos`, `feature_dark_mode`) están apagadas globalmente, así que hoy no las
  tiene en la práctica.
- **`admin` (rol 2)**: todo lo del usuario más los cuatro dashboards y vistas "Todos" de
  soporte y marketing. Sigue fuera de `/admin/*`. Curiosamente **no** tiene
  `asistencia_remota` ni `base_conocimientos`, que sí tiene el rol `user`; si eso no es
  intencionado, se corrige en `/admin/roles`.
- **`superadmin` (rol 3)**: todas las secciones existentes.

### Overrides vigentes en BD

```
usuario 290 Alumno Prueba:  +crear_ticket_csh  +soporte_dashboard  +soporte_mis_tickets
                            -crear_ticket_marketing  -marketing_dashboard  -marketing_mis_tickets
usuario   4 Centro de Soporte Humanitas:  +crear_ticket_marketing  +marketing_dashboard  +marketing_mis_tickets
```

Nótese que los `+crear_ticket_csh` y `+soporte_mis_tickets` de Alumno Prueba son redundantes:
su rol ya se los da. Lo único que realmente añade el override es `+soporte_dashboard`.

---

## 5. Excepciones cableadas en código (no configurables)

Además de las secciones, hay comprobaciones fijas que ninguna configuración puede cambiar:

- **Los menús de `/admin` exigen rol 3.**
  [Sidebar.astro:76-77](src/components/shared/Sidebar.astro#L76-L77) calcula
  `canSeeAdminCorreos` y `canSeeAdminSiget` como `isSuperAdmin && <tiene alguna sección>`.
  Ojo: eso oculta el *menú*, pero el **middleware protege las rutas `/admin/*` solo por
  sección**. Un usuario de rol 1 o 2 con un override `+admin_siget_usuarios` no vería el menú
  y aun así entraría escribiendo la URL. Si se quiere cerrar del todo, el chequeo de rol tiene
  que estar también en el middleware.
- **"Todos" de marketing exige rol distinto de 1.**
  [Sidebar.astro:113](src/components/shared/Sidebar.astro#L113):
  `secciones.includes("marketing_todos") && userRolId !== 1`.
- **Crear ticket exige además el flag del usuario**, no solo la sección:
  `canCreateTicketCSH = userTcktCsh && secciones.includes("crear_ticket_csh")`
  ([Sidebar.astro:64](src/components/shared/Sidebar.astro#L64)), y lo mismo para marketing con
  `userTcktMkt`. Son las casillas de "puede abrir tickets" de la ficha del usuario.
- **`session_version`**: si se desactiva un usuario o se fuerza el cierre de sesión, el
  callback `jwt` devuelve `null` y la cookie se destruye en la siguiente petición, sin
  importar sus secciones.

---

## 6. Corrección aplicada el 2026-09-03

El middleware pedía `soporte_dashboard` para `/tickets/soporte`, cuando esa ruta es la vista
"Todos" y el Sidebar la enlaza bajo `soporte_todos`; `soporte_dashboard` corresponde al enlace
del Dashboard (`/`). El equivalente de marketing (`/tickets/marketing` → `marketing_todos`)
siempre estuvo bien.

Efecto del error: cualquiera con `soporte_dashboard` y sin `soporte_todos` no veía el enlace
"Todos" pero entraba escribiendo la URL — que es exactamente lo que ocurría con Alumno Prueba.
Ya corregido en [middleware.ts](src/middleware.ts#L190). Ningún usuario legítimo pierde
acceso: los roles `admin` y `superadmin` tienen ambas secciones y el rol `user` no tiene
ninguna de las dos.

## 7. Usuario de prueba

`alumno.prueba1@humanitas.edu.mx` (id 290, rol `user`, campus Del Valle) entra por la rama
`isTestUser` de [auth.config.ts:47](auth.config.ts#L47): **no** consulta la API de RH
(trabajador ni horario), **no** valida la unidad organizativa y, desde el 2026-09-03, tampoco
llama a Google Admin Directory. Su fila en BD debe existir de antemano, porque el alta
automática de usuarios nuevos deriva el campus de la OU.
