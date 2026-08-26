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
