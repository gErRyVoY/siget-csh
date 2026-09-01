# Runbook de cierre del plan de rendimiento — SiGeT

Escrito el 2026-09-01, sobre la rama `nuevos-cambios-claude` (26 commits por
delante de `siget-apprunner-new`, sin push). Recoge **sólo lo que queda pendiente
y depende de una persona**: validar la imagen Docker, el QA funcional, el push, y
los pasos en la base de datos y en la consola de AWS.

Las mediciones y el detalle de cada optimización están en `PERF-BASELINE.md`.
El plan original está en
`C:\Users\Gerardo\.claude\plans\actualmente-est-s-conectado-a-fluffy-ullman.md`.

## Estado: qué ya está verificado

- Fases 1, 2 y 3 implementadas, un commit por punto del plan.
- `astro check` 0 errores / 0 advertencias (158 archivos) y `pnpm build` en verde.
- Sentencias SQL por ruta (Fase 0 → ahora): `/tickets/view/23` 29 → 5,
  `/tickets/marketing` 19 → 4, `/tickets/soporte` 20 → 7, `/health` con cookie
  7 → 0. `/` sigue en 10: el dashboard nunca estuvo en el alcance.
- gzip verificado **contra el build de producción**
  (`NODE_ENV=production node ./dist/server/entry.mjs`), no sólo contra
  `astro dev`: 43–70 KB → 9–15 KB por página (4.4–4.7x).
- Verificado también el límite de alcance del gzip: el CSS de `/_astro/` sale con
  68 908 B **sin** `Content-Encoding`, porque lo sirve el manejador de estáticos
  antes del middleware. Sólo lo arregla un CDN delante.

## Corrección importante sobre el plan

`docker compose up` **no sirve** para validar el punto 3.4: el
[docker-compose.yml](docker-compose.yml) sólo define un Postgres local, no la
app. La validación real es `docker build` + `docker run`.

## Orden recomendado

`A` Docker (20 min) → `B` QA funcional (45–60 min) → `C` push de la rama y
revisión → `D` índices en producción → `E` merge/deploy + `connect_timeout` →
`F` script de limpieza y verificación post-deploy → `G` CloudFront (otro día)

---

## A. Validar la imagen Docker (3.4)

Lo que esto comprueba y nada más lo hace: que `node:22-slim` no rompe los
binarios de Prisma, que `pnpm exec prisma generate` funciona sin descargar de la
red, que `USER node` no impide arrancar, que el `HEALTHCHECK` responde y que el
`.dockerignore` no dejó fuera nada necesario.

```bash
# 1. Arranca Docker Desktop y espera a que responda
docker info --format '{{.ServerVersion}}'      # debe imprimir una versión, no un error de npipe

# 2. Construir (desde la raíz del repo)
docker build -t siget:perf-test .

# 3. Tamaño de la imagen (referencia: era node:20-slim + googleapis)
docker images siget --format '{{.Repository}}:{{.Tag}}  {{.Size}}'

# 4. Arrancar. .env apunta a la BD de desarrollo, que es lo que queremos
docker run -d --name siget-test --env-file .env -p 4444:4321 siget:perf-test

# 5. Esperar ~30 s y mirar el healthcheck
docker ps --filter name=siget-test --format '{{.Status}}'    # -> "Up 40 seconds (healthy)"

# 6. Comprobaciones dentro del contenedor
docker exec siget-test id                       # -> uid=1000(node), no root
docker logs siget-test | tail -20               # NO debe haber líneas "prisma:query"

# 7. Comprobaciones desde fuera
curl -s http://localhost:4444/health
curl -sI -H 'Accept-Encoding: gzip' http://localhost:4444/login | grep -i content-encoding
```

Prueba de que Prisma funciona dentro de la imagen (el arnés acuña su propia
cookie y recorre 11 rutas):

```bash
pnpm perf:baseline -- --base http://localhost:4444 --runs 1 --ticket 22,23
```

Todas las rutas deben dar **200**. Las columnas `sql` y `sql ms` saldrán en 0: la
instrumentación `Server-Timing` es sólo de desarrollo. Lo que valida aquí es el
código de estado.

Limpieza: `docker rm -f siget-test` y, si quieres, `docker rmi siget:perf-test`.

Diagnóstico rápido: si falla el paso 2 con un error de OpenSSL o del motor de
Prisma, es el cambio de `node:20-slim` a `node:22-slim`. Si falla el 5
(`unhealthy`) pero el `curl` del paso 7 responde, el problema es el `HEALTHCHECK`
con `fetch` de Node, no la app.

---

## B. QA funcional en local (BD de desarrollo, nunca RDS de producción)

Empieza por lo barato, que no necesita servidor:

```bash
npx tsx scripts/validate-flows.ts
```

Valida catálogos, roles, lógica de asignación y RBAC. Si pasa, arranca `pnpm dev`
y ve por la tabla. La columna «qué cambió» es dónde mirar si algo se ve raro.

| # | Qué hacer | Qué debe pasar | Qué cambió (dónde miraría si falla) |
|---|---|---|---|
| 1 | `/tickets/soporte`: usar los filtros de estatus, categoría, empresa y agente, y los de fecha `dd/mm/aaaa` | Los desplegables traen **las mismas opciones que antes** y los filtros acotan bien | 2.3: los desplegables ya no salen de subconsultas sobre `ticket` sino de `groupBy` + catálogos cacheados. El síntoma de regresión es un desplegable con menos opciones |
| 2 | Lo mismo en `/tickets/soporte/usuario`, `/tickets/marketing` y `/tickets/marketing/usuario` | Ídem | 2.1–2.4 en las cuatro listas |
| 3 | En cualquier lista, pasar a la página 2 y 3 | Paginación correcta, sin filas repetidas ni saltadas | 2.4 (`select` explícito) y 3.1 (índice `estatusId, fechaalta desc`) |
| 4 | Abrir un **ticket normal** desde una lista | Breadcrumb con **la ruta completa** de subcategorías, no sólo la hoja; desplegables de estatus y de agente poblados | 2.5: el breadcrumb ya no consulta por nivel, se resuelve en memoria |
| 5 | Abrir un **ticket de traslado** | Los selects de campus, carrera y descuento llenos, y los auditores de documentos y requisitos | 2.5: esos catálogos ahora sólo se cargan si el ticket es traslado. **Es el cambio con más probabilidad de romper algo** |
| 6 | Como agente no privilegiado, abrir un ticket propio | Sólo aparece el agente asignado y los estatus permitidos | 2.5: la lista de agentes se calcula distinto |
| 7 | Formulario de traslado: escribir una matrícula que ya tenga traslado | Avisa de duplicado | 3.1: índice nuevo en `traslado.matricula` |
| 8 | `/admin/secciones`: quitar y devolver una sección a un rol, y F5 | El cambio se ve **de inmediato**; en el peor caso a los 15 s | 1.2: invalidación explícita del micro-caché de sesión |
| 9 | Desactivar un usuario desde admin mientras tiene sesión abierta en otro navegador; que navegue | Va a `/login?error=SesionRevocada` | 1.2: `session_version` se lee siempre fresco, fuera del caché |
| 10 | Crear un ticket con dos navegadores abiertos: uno como solicitante, otro como el agente que lo recibe | La campanita del agente se actualiza **sin recargar**, y llega el correo | 1.3 y 3.3: si la notificación sólo aparece al recargar, el gzip está tocando el SSE (no debería: está excluido y verificado) |
| 11 | Vista de incidencias de un usuario: cambiar mes y año | Datos correctos por mes **y** por año | 2.8: el año se filtra en SQL, ya no en JavaScript |
| 12 | F12 → Network en `/tickets/soporte`: mirar `Content-Encoding` y el tamaño transferido | `gzip`, ~9 KB en lugar de ~43 KB | 3.3 |
| 13 | F12 → Network: pasar el cursor por un enlace del Sidebar y luego por una fila de la tabla de tickets | El del Sidebar dispara una petición de documento; la fila **no** | 3.6: antes las 21 filas prefetchaban |
| 14 | Login con un usuario real y con `alumno.prueba1@` | Ambos entran | 1.5 y 1.6 (`googleapis` → `@googleapis/admin`) |
| 15 | Activar y desactivar el modo oscuro en `/admin/secciones` | Cambia; puede tardar hasta 60 s | 1.7: caché del flag |

Los puntos 5, 8 y 10 son los tres donde una regresión sería de verdad.

---

## C. Push de la rama

Estado: `nuevos-cambios-claude`, 26 commits por delante de
`siget-apprunner-new`, sin upstream. [deploy.yml](.github/workflows/deploy.yml#L4)
sólo despliega en `main` y `siget-apprunner-new`.

```bash
git push -u origin nuevos-cambios-claude      # NO despliega nada
```

Eso permite revisar los 26 commits en GitHub y abrir un PR contra
`siget-apprunner-new` antes de tocar producción. Cada commit lleva sus
mediciones en el mensaje.

---

## D. Índices en producción (3.1)

**Primero decide si hace falta `CONCURRENTLY`.** Contra la BD de producción:

```sql
SELECT relname, n_live_tup, pg_size_pretty(pg_total_relation_size(relid)) AS tamano
FROM pg_stat_user_tables
WHERE relname IN ('ticket','traslado','incidencia');
```

**Menos de ~50 000 filas en `ticket`**: aplica el archivo tal cual, bloquea
escrituras unos milisegundos.

```bash
DATABASE_URL="<prod>" npx prisma db execute \
  --file prisma/migrations/20260827193943_add_perf_indexes_fase3/migration.sql \
  --schema prisma/schema.prisma
```

**Más que eso, o si prefieres no arriesgar**: `CONCURRENTLY`, una sentencia a la
vez y **fuera de transacción** (por eso no valen dentro del archivo de
migración):

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS "traslado_matricula_idx" ON "traslado"("matricula");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ticket_estatusId_fechaalta_idx" ON "ticket"("estatusId","fechaalta" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ticket_solicitanteId_fechaact_idx" ON "ticket"("solicitanteId","fechaact" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "incidencia_usuarioId_mes_idx" ON "incidencia"("usuarioId","mes");
DROP INDEX CONCURRENTLY IF EXISTS "incidencia_usuarioId_idx";
```

Después, obligatorio: comprobar que ninguna construcción quedó a medias.

```sql
SELECT indexrelid::regclass AS indice_invalido FROM pg_index WHERE NOT indisvalid;
```

Debe devolver cero filas. Si sale alguno, se borra
(`DROP INDEX CONCURRENTLY "<nombre>"`) y se reintenta: un índice inválido no se
usa pero sí se mantiene en cada escritura.

**Luego alinea el historial de migraciones**, o la próxima migración se peleará
con esto:

```bash
DATABASE_URL="<prod>" npx prisma migrate status
DATABASE_URL="<prod>" npx prisma migrate resolve --applied 20260827193943_add_perf_indexes_fase3
```

Dos avisos:

- **Nunca `prisma migrate dev` contra producción.** El historial de este repo
  está desalineado (hay columnas aplicadas a mano) y `migrate dev` exige
  resetear el esquema, o sea borrar todo. Ya lo intentó en desarrollo.
- El workflow de despliegue **no ejecuta ninguna migración**: nada de esto se
  aplica solo, es manual por diseño.

Al imprimir o pegar un `DATABASE_URL`, enmascara las credenciales:
`sed 's#//[^@]*@#//***:***@#'`.

---

## E. Deploy y `connect_timeout`

Cuando B y C estén en verde:

```bash
git checkout siget-apprunner-new
git merge --no-ff nuevos-cambios-claude
git push origin siget-apprunner-new          # esto SÍ despliega a App Runner
```

En la consola de App Runner, servicio de SiGeT → **Configuration** → **Edit** →
variables de entorno → `DATABASE_URL`: copiar el valor actual y añadirle
`&connect_timeout=20` al final, conservando `connection_limit=30&pool_timeout=30`.
Guardar lanza un despliegue rolling de unos 5 minutos, sin caída. Si la variable
vive en Secrets Manager o SSM, editarla allí.

Para qué sirve: el `P1001 Can't reach database server` aparece cuando Prisma se
rinde con el timeout de conexión por defecto y RDS tarda en aceptar. En App
Runner el síntoma sería un 500 esporádico al arrancar una instancia nueva.

---

## F. Post-deploy en producción

1. **Respaldo antes de borrar nada.** `npx dotenv -- tsx scripts/backup-db.ts`
   con el `DATABASE_URL` de producción escribe
   `prisma/backups/backup-<fecha>.json`. Ese archivo lleva datos personales de
   usuarios y tickets: no dejarlo en el repo, borrarlo al confirmar que todo
   está bien.
2. **Script de limpieza** (después del deploy, no antes: borra secciones que el
   código nuevo ya no usa):
   ```bash
   DATABASE_URL="<prod>" npx tsx scripts/remove-secciones-roles-tickets.ts
   ```
   Salida esperada: lista las dos secciones (`admin_siget_roles`,
   `admin_siget_tickets`), luego
   `Borrados -> permiso_rol_seccion: N | permiso_usuario_seccion: M | seccion: 2`
   y `quedan 0 filas`. Es idempotente: la segunda vez dice que no hay nada que
   borrar.
3. **Confirmar que `NODE_ENV=production` surtió efecto**: en CloudWatch, los logs
   del servicio **no** deben tener líneas `prisma:query`. Si siguen apareciendo,
   el `ENV NODE_ENV=production` del Dockerfile no llegó y 1.1 no está activo
   (además de ser una fuga de datos personales al log).
4. **Repasar en producción** los puntos 1, 5, 8 y 10 de la tabla de QA: los de
   más riesgo y los que dependen de datos reales.
5. Si algo va mal: `git revert` del commit concreto —cada punto del plan es un
   commit independiente— y push. Los índices se pueden dejar puestos, no
   dependen del código.

---

## G. CloudFront (cuando se quiera, no urgente)

La guía paso a paso está en `PERF-BASELINE.md`, sección «Guía de CloudFront».
Los tres puntos donde este montaje se rompe de forma habitual:

- Reenviar `Cookie` y dejar pasar `Set-Cookie`, o Auth.js pierde la sesión.
- Un comportamiento aparte para `/api/notifications/sse` **sin compresión**, o el
  SSE deja de entregar en tiempo real.
- Caché desactivada en `/*`, porque todo el HTML es por usuario.

Lo que se gana y hoy no existe: compresión y caché en el borde de `/_astro/*` y
`public/*` — los 68 KB de CSS y los 36 KB de JS que ahora Node sirve enteros en
cada visita nueva. Cuando exista, el gzip del middleware se puede quitar en un
commit (borrar `comprimir()` y sus dos llamadas en `onRequest`) para devolverle
la CPU a la única vCPU.

---

## Restricciones que siguen en vigor

- **`git push` sólo cuando se pida de forma explícita** (`GEMINI.md`). `git add` y
  `git commit` sí.
- La validación local va **contra la BD de desarrollo**, nunca contra RDS de
  producción.
- No dejar copias de `.env` en el árbol: `.gitignore` cubre la ruta exacta
  `.env`, así que un `.env.bak-*` sí es committeable.
