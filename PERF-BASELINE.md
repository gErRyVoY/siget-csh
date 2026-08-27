# Línea base de rendimiento — rama `nuevos-cambios-claude`

Medido con `pnpm perf:baseline` contra `astro dev` y la BD de desarrollo
(`siget-db-dev-restored-v2`, RDS us-east-1). Usuario `gerardo.omana@humanitas.edu.mx`
(id 1, superadmin), 4 pasadas por ruta más una de calentamiento, estimador **mínimo**.

## Fase 0 — antes de cualquier optimización

| Ruta | Estado | Sentencias SQL | Tiempo motor (ms) | Total (ms) |
|---|---|---|---|---|
| `/health` (con cookie) | 302 | 7 | 443 | 456 |
| `/health` (sin cookie) | 200 | **0** | 0.0 | 0.5 |
| `/` | 200 | 17 | 1193 | 799 |
| `/tickets/soporte` | 200 | 20 | 1248 | 1299 |
| `/tickets/soporte/usuario` | 200 | 14 | 873 | 921 |
| `/tickets/marketing` | 200 | 19 | 1181 | 1231 |
| `/api/notifications/count` | 200 | 16 | 994 | 1028 |
| `/tickets/view/23` | 200 | 29 | 1804 | 1874 |

## Fase 1 — después de los quick wins (1.1 – 1.8)

| Ruta | Fase 0 | Fase 1 | Δ |
|---|---|---|---|
| `/health` (con cookie) | 7 | 1 | −86 % |
| `/health` (sin cookie) | 0 | 0 | — |
| `/` | 17 | 10 | −41 % |
| `/tickets/soporte` | 20 | 13 | −35 % |
| `/tickets/soporte/usuario` | 14 | 7 | −50 % |
| `/tickets/marketing` | 19 | 12 | −37 % |
| `/api/notifications/count` | 16 | 3 | **−81 %** |
| `/tickets/view/23` | 29 | 22 | −24 % |

De dónde sale cada reducción:

- **−6 sentencias en toda petición** (1.2): el micro-caché de 15 s de la
  consulta de usuario de la sesión. En caché sólo queda el `select
  session_version`, que no se cachea nunca para no romper la revocación de
  sesiones.
- **−1 sentencia adicional en las rutas de API** (1.3): desaparece la segunda
  resolución completa de la sesión. Es donde el conteo de SQL infravalora la
  mejora: lo que también se ahorra en cada llamada es el descifrado del JWE,
  los callbacks `jwt`/`session` y un round-trip JSON, que no son SQL.
- **−1 sentencia en toda página** (1.7): el flag `feature_dark_mode` cacheado
  60 s.
- Sin efecto en el conteo, sí en el coste: 1.8 (`count` → `findFirst` en el
  Sidebar) y 1.1 (log de Prisma sólo fuera de producción).

Las rutas POST (`/api/tickets/create`, `/update`, `/transfer`) no aparecen en
la tabla porque el arnés sólo hace GET, pero son las que más ganan con 1.3:
antes pagaban la resolución de sesión **dos** veces.

### Arranque en frío (1.6)

`import { google } from "googleapis"` → `@googleapis/admin`, medido con
`require()` directo del paquete:

| | Carga del módulo | Tamaño en disco |
|---|---|---|
| `googleapis` 154.1.0 | 3394 ms | 180 MB |
| `@googleapis/admin` 32.1.0 | 223 ms | 2.3 MB |

Son ~3.2 s menos de arranque por instancia nueva de App Runner. El número
local puede estar amplificado (Windows, antivirus sobre `node_modules`), pero
la proporción y el ahorro de imagen en ECR no dependen de eso.

## Fase 2 y 3 — consultas por página, índices, Prisma y assets

Medido igual que las fases anteriores (`--runs 4`, estimador mínimo), añadiendo
`--ticket` al arnés para fijar qué tickets de detalle se piden: el ticket «más
reciente del usuario» cambia entre mediciones y un traslado carga bastante más
que un ticket normal.

| Ruta | Fase 0 | Fase 1 | Fase 2+3 | Δ vs Fase 0 |
|---|---|---|---|---|
| `/health` (con cookie) | 7 | 1 | 1 | −86 % |
| `/health` (sin cookie) | 0 | 0 | 0 | — |
| `/` | 17 | 10 | 10 | −41 % |
| `/tickets/soporte` | 20 | 13 | **7** | −65 % |
| `/tickets/soporte/usuario` | 14 | 7 | **6** | −57 % |
| `/tickets/marketing` | 19 | 12 | **4** | −79 % |
| `/api/notifications/count` | 16 | 3 | 3 | −81 % |
| `/tickets/view/23` (normal) | 29 | 22 | **5** | −83 % |

Rutas que no estaban en la tabla de las fases anteriores, para tenerlas medidas:

| Ruta | Fase 2+3 |
|---|---|
| `/tickets/view/25` (normal) | 5 |
| `/tickets/view/22` (traslado) | 7 |
| `/admin/secciones` | 2 |
| `/admin/categorias` | 6 |

De dónde sale cada reducción:

- **Listas de tickets, de 13 a 7 y de 12 a 4** (2.1 – 2.4): los tres desplegables
  ya no se resuelven con subconsultas correlacionadas sobre `ticket` sino con
  `groupBy` + los catálogos cacheados de `src/lib/reference-data.ts`, y las seis
  consultas en serie pasaron a un único `Promise.all`. Marketing baja más porque
  sus dos desplegables (área y campus) salen enteros del caché.
- **Detalle de ticket, de 22 a 5** (2.5 y 3.2): campus, carreras, descuentos y
  auditores sólo se consultan si el ticket es un traslado (por eso `view/22`
  cuesta 7 y `view/25` cuesta 5); el breadcrumb ya no emite una consulta por
  nivel de subcategoría; y el `include` de siete relaciones se resuelve con
  `relationLoadStrategy: 'join'` en una sentencia en vez de catorce.
- **`/` se queda en 10.** Ninguna de las dos fases toca el panel de inicio: sus
  consultas son las del dashboard, que no estaban en el alcance del plan. Es el
  candidato obvio para una fase siguiente.

### Índices (3.1)

En la BD de desarrollo (22 tickets, 9 traslados) `EXPLAIN` no distingue nada:
Postgres hace seq scan de tablas de 22 filas con y sin índice. Los números se
midieron sobre tablas de trabajo de 200 000 filas creadas dentro de una
transacción revertida, comparando siempre contra los índices que **ya existen**:

| Consulta | Hoy | Con el índice nuevo | Factor |
|---|---|---|---|
| `traslado` por matrícula (`check-transfer`) | 2.34 ms, seq scan | 0.04 ms, index scan | 60x |
| `ticket` por estatus + `fechaalta desc` | 0.21 ms | 0.06 ms | 3.3x |
| `ticket` por solicitante + `fechaact desc` (~40 tickets/usuario) | 0.10 ms | 0.10 ms | 1.0x |
| ídem con 4 000 tickets por solicitante | 2.43 ms | 0.13 ms | 19x |
| `incidencia` por usuario + mes | 0.15 ms | 0.04 ms | 3.8x |

El índice `(solicitanteId, fechaact desc)` se añade por el escenario de volumen,
no por el actual; `fechaact` cambia en cada actualización de ticket, así que ese
índice se mantiene en cada `UPDATE`. Si algún día hay que quitar uno, es ese.

### `relationLoadStrategy: 'join'` (3.2)

| Consulta | `query` (defecto) | `join` |
|---|---|---|
| Sesión: usuario + empresa + rol + permisos + secciones | 7 sentencias, 440 ms | 1 sentencia, 71 ms |
| Detalle de ticket: 7 relaciones (5 más anidadas en traslado) | 14 sentencias, 875 ms | 1 sentencia, 68 ms |

Los milisegundos son de local: cada ida y vuelta a RDS us-east-1 desde aquí
cuesta ~65 ms, así que lo que se ve es «una ida y vuelta en vez de 7 o 14». En
App Runner, misma región, el ahorro es de milisegundos por consulta; lo
estructural es la cuenta de sentencias. Verificado que ambas estrategias
devuelven exactamente lo mismo (12 usuarios y los 22 tickets, campo a campo).

### Assets (3.5)

| Archivo | Antes | Después |
|---|---|---|
| `leon-querer-es-poder` (fondo del Sidebar, en toda página autenticada) | 1.06 MB PNG | 69 KB WebP |
| `proceso-traslado` (contenido único de `/traslados`) | 2.02 MB PNG | 571 KB WebP |
| `leus-missing.png` (sin referencias) | 117 KB | borrado |

Mismas dimensiones en los dos casos: no se reescaló nada, sólo se recodificó.

### Lo que queda sin medir

- **3.3 (compresión HTTP)**: sin implementar, pendiente de decidir entre
  CloudFront delante de App Runner y gzip en el middleware.
- **3.4 (Dockerfile)**: los cambios están hechos pero sin validar con
  `docker build` — el demonio de Docker Desktop no responde en esta máquina.
- **Producción**: el SQL de índices de 3.1 está aplicado sólo en la BD de
  desarrollo.

## Cómo leer estas cifras

- **Sentencias SQL** es la métrica que vale para comparar fases. Es el número real
  de sentencias que emite el motor de Prisma, no de operaciones del cliente: un
  `findUnique` con `include` anidados cuenta varias.
- **Tiempo motor** es la *suma* de la duración de cada sentencia. Puede superar el
  total porque Prisma resuelve las relaciones de un `include` en paralelo; sirve
  como medida de carga sobre la BD, no de latencia.
- **Total (ms) no es representativo de producción.** Se mide desde una máquina
  local contra RDS en us-east-1: cada ida y vuelta cuesta ~60-70 ms, cuando en
  App Runner (misma región) son ~1-2 ms. Localmente el coste por sentencia está
  amplificado unas 30×, lo que hace muy visible el número de sentencias pero
  exagera el tiempo. En `astro dev` además incluye compilación bajo demanda.

## Hallazgos de la medición que corrigen el diagnóstico previo

1. **El health check no toca la base de datos.** Sin cookie de sesión,
   `getSession()` devuelve `null` sin consultar nada: 0 sentencias y 0.5 ms.
   El punto 1.4 del plan (cortocircuitar `/health` antes de `getSession`) partía
   de que las ~17 000 peticiones diarias de la sonda de App Runner atravesaban el
   handler completo de Auth.js con coste en BD. **No es así**, y ese punto queda
   descartado por falta de beneficio medible.
2. **Efecto secundario latente:** `/health` **con** cookie de sesión devuelve
   `302` a `/` porque el middleware trata las rutas públicas como
   «redirigir si ya hay sesión». La sonda de App Runner no envía cookies, así que
   hoy no rompe nada, pero es una respuesta incorrecta para un endpoint de salud.
3. **El coste por página es mayor de lo estimado:** 17 sentencias en `/`,
   20 en la lista de soporte y **29** en el detalle de ticket, frente a las ~10
   que suponía el diagnóstico inicial. El margen de mejora de las fases 1 y 2 es
   por tanto más alto de lo previsto.

## Reproducir la medición

```bash
# Terminal 1 — servidor de desarrollo (silenciando el log de queries)
PRISMA_QUERY_LOG=off pnpm dev

# Terminal 2 — medición (cerrar antes las pestañas del navegador sobre :4321,
# porque el stream SSE y el sondeo de notificaciones inflan los contadores)
pnpm perf:baseline -- --runs 4
```

### `P1001 Can't reach database server` en el primer arranque

Síntoma: al levantar `pnpm dev` justo después de cambiar dependencias, Vite
imprime `Re-optimizing dependencies because vite config has changed` y las
primeras peticiones fallan con `P1001` en **~5 000 ms** exactos, con el rastro
apuntando a `getSessionUser` → callback `jwt`. Tras 20-30 s deja de ocurrir.

No es la base de datos ni el caché de sesión: 5 000 ms es el `connect_timeout`
por defecto de Prisma. Mientras esbuild reoptimiza dependencias, el proceso
compite por CPU y el handshake completo contra RDS us-east-1 (TCP + TLS + SCRAM,
~400 ms con la máquina descargada) no cabe en esos 5 s. Comprobado con un
handshake crudo: TCP 140 ms, TLS 169 ms, `AuthenticationRequest` 58 ms, y 20/20
consultas correctas con 58 ms de mediana en cuanto Vite termina.

Mitigación aplicada: `connect_timeout=20` en el `DATABASE_URL` del `.env`. En
producción conviene el mismo parámetro en la variable de entorno de App Runner:
el arranque en frío de una instancia de 1 vCPU tiene el mismo perfil y con 5 s
las primeras peticiones de una instancia nueva pueden responder 500.

Efecto secundario que conviene conocer: si la consulta de usuario lanza, Auth.js
convierte la excepción en `JWTSessionError`, `getSession()` devuelve `null` y el
middleware trata la petición como no autenticada — un corte momentáneo de BD
saca al usuario a `/login` en lugar de mostrar un error. Es el comportamiento
previo a la Fase 1 (antes lanzaba el `findUnique` en línea de `auth.config.ts`);
el caché no lo cambia, pero podría amortiguarlo sirviendo la entrada caducada
cuando la consulta falla, como ya hace `src/lib/feature-flags.ts`.

**Si todas las columnas de SQL salen a 0, la instrumentación está rota, no es
un resultado.** Ocurre cuando el HMR de Vite recarga `src/lib/db.ts` —por
ejemplo al añadir un módulo nuevo— pero `globalThis.prisma` conserva el cliente
anterior: su listener `$on('query')` escribe en la instancia previa del módulo
`src/lib/perf.ts`, mientras que el middleware lee los contadores de la nueva.
Se arregla reiniciando el servidor de desarrollo.
