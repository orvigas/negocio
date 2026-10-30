# REQ-F-041 — Reducir la duración de las pruebas lentas

## Estado

IN_PROGRESS

## Aprobación

Aprobado por el usuario (versión 1, fecha 2026-10-29). Cita textual: "Si y ya están mergeado".

## Objetivo

Reducir al menos un 40 % la duración del paso `test` del job `calidad` del CI, sin perder escenarios, sin relajar la salvaguarda de las bases `restaurante_test*` y sin que vuelvan las pruebas inestables.

## Datos de partida

Caché de resultados de Vitest (`node_modules/.vite/vitest/*/results.json` de cada app) de la última ejecución local, del 2026-10-29. Son tiempos locales, no del CI; la línea base del CI se mide en el paso 1 del Action Plan.

- **Peso por app:** `landing-pages` suma unos 465 s, casi el 98 % del total; `api` unos 7 s e `inventory-manager` unos 2 s.
- **Esperas y repeticiones de diseño** (el 25 % del tiempo):
  - `db-outage-handshake`: 55,7 s. Es el camino crítico.
  - `db-lock-wait`: 40,4 s, por una retención fija de 12 s.
  - `last-admin-concurrency`: 20,7 s, por sus 50 repeticiones.
- **Procesos reales** (el 32 %): de 8 a 29 s por archivo; el más lento es `admin-api-qa-req-f-039`, con 29,4 s.
- **HTTP más MySQL dentro del proceso** (el 22 %): de 9 a 21 s por archivo; entre ellos `product-repository-contract`, de 16,9 s.

## Alcance

- Las suites de Vitest de `api`, `landing-pages` e `inventory-manager`.
- Las ayudas de pruebas: `tests/support/` y `tests/setup/`.
- El paso `test` del job `calidad`, y su posible reparto en varios jobs.

## Fuera de alcance

- El job `docker`. No ejecuta la suite de Vitest.
- Cambios de comportamiento de la app.
- La salvaguarda de las bases de pruebas.
- Sustituir MySQL o los procesos reales por dobles.
- Reducir las 50 repeticiones de `last-admin-concurrency`.

## Requisitos

- **RF-1. Línea base.** Antes de cambiar nada se mide:
  - la mediana de 3 ejecuciones del paso `test` (o de la suma de jobs de pruebas, si se reparte) en el CI;
  - la duración de `npm test` en local;
  - la duración por archivo de las tres apps.

  Todo queda registrado en este ticket.
- **RF-2. Objetivo de duración.** El paso `test` baja al menos un 40 % respecto a la línea base, con la misma métrica. Si se reparte en varios jobs paralelos, se mide desde que empieza el primero hasta que termina el último.
- **RF-3. Límite por archivo.** Ningún archivo de prueba pasa de 20 s en el CI.
- **RF-4. Mismos escenarios.** Se conservan todos los escenarios y verificaciones.
  - Si dos pruebas se fusionan o se mueven, una tabla en este ticket relaciona el antes y el después.
  - No se usan `skip`, `todo` ni `only`.
  - Todo se ejecuta en cada PR.
- **RF-5. Esperas acortadas con el mismo escenario.** Los plazos se pueden acortar solo en la base o en la prueba (por ejemplo, el tiempo de espera de bloqueo de MySQL), y el escenario no cambia.
  - Sigue habiendo un bloqueo real, una espera que vence y una respuesta 503 sin cambios a medias.
  - Siguen existiendo los mismos cortes de red.
  - `last-admin-concurrency` conserva sus 50 repeticiones.
- **RF-6. Salvaguarda intacta.** No se modifican las comprobaciones de host ni de prefijo `restaurante_test` de `tests/setup/`, y `test-database-guard.test.ts` sigue verificando lo mismo.
- **RF-7. Sin inestabilidad.**
  - No se agregan reintentos (`retry`).
  - Se mantienen `listenLocal`, `freePorts` y `expect.poll`.
  - No se sustituye una espera por condición por una espera fija más corta.
  - No se suben `testTimeout` ni `hookTimeout`.
- **RF-8. Reparto en el CI.** Se puede dividir la suite en jobs paralelos o subir los trabajadores si la medición lo justifica y no vuelve la inestabilidad. En cada PR se ejecuta siempre la suite completa.
- **RF-9. Local.** Para `npm test` en local basta con que no empeore respecto a la línea base.
- **RF-10. Documentación.** Si cambian los scripts, el número de trabajadores o los jobs del CI, se actualizan las secciones "Pruebas HTTP" y "CI" de `restaurante/README.md` y, si aplica, `.claude/rules/testing.md`.

## Criterios de aceptación

- **CA-1.** Este ticket registra la línea base y la medición final, con el mismo método.
- **CA-2.** La mediana de 3 ejecuciones del CI muestra al menos un 40 % menos que la línea base.
- **CA-3.** En el CI, el archivo más lento tarda 20 s o menos.
- **CA-4.** `npm test` pasa en local 5 veces seguidas, y su duración no supera la de la línea base.
- **CA-5.** El CI pasa 3 veces seguidas, sin reintentos y sin fallos intermitentes.
- **CA-6.** El número total de pruebas es igual o mayor que en la línea base, o la diferencia está explicada en la tabla de RF-4.
- **CA-7.** `last-admin-concurrency` conserva sus 50 repeticiones por caso. `db-lock-wait` y `db-outage-handshake` siguen comprobando lo mismo: 503 sin cambios a medias, recuperación sola y ningún rechazo sin manejar.
- **CA-8.** El diff no toca la salvaguarda de bases de pruebas. `npm run typecheck` y `npm run lint` terminan con 0.
- **CA-9.** Cada PR ejecuta la suite completa, esté en uno o en varios jobs.

## Casos límite

- **CI sin caché de Vitest:** el orden de arranque de los archivos no se conoce de antemano.
- **Bases compartidas:** dos trabajadores que reutilizan bases (vaciadas con TRUNCATE) no deben pisarse si aumenta el paralelismo.
- **Ejecución interrumpida:** la limpieza de las bases que deja sigue funcionando.
- **Runner lento:** las pruebas de procesos reales siguen arrancando dentro de su plazo.
- **Más trabajadores, más carga:** subirlos aumenta la carga sobre MySQL.

## Dependencias

- Empieza cuando `epic/arquitectura` esté mergeada en `main` (PR #114). El "ya están mergeado" de la aprobación se refiere al PR #113, no a la épica: al aprobar, el #114 seguía abierto.
- El PR va a `main`.
- Poder ejecutar el CI al menos 3 veces para medir.

## Riesgos

- Que un plazo acortado deje de cubrir la condición que se quería probar (lo mitigan RF-5 y CA-7).
- Que vuelva la inestabilidad al aumentar el paralelismo (lo mitigan RF-7 y CA-5).
- Más coste o complejidad en el CI si se reparte en varios jobs.

## Action Plan

1. Medir la línea base (RF-1).
2. Acortar el camino crítico con plazos solo de prueba (RF-5): `db-outage-handshake` y `db-lock-wait`.
3. Equilibrar el reparto: trabajadores y, si la medición lo justifica, jobs paralelos (RF-8 y CA-9).
4. Reducir el coste repetido de los procesos reales: pruebas `*-qa-req-f-039/040`, `server-startup*`, `users-api-*`, `db-verify` y `db-outage`.
5. Revisar las pruebas de HTTP más MySQL que pasen de 20 s, o se acerquen.
6. Medir de nuevo, rellenar la tabla de escenarios y actualizar la documentación (RF-10).

**Resultado esperado:** el paso `test` dura al menos un 40 % menos, ningún archivo pasa de 20 s, y se mantienen los mismos escenarios, la misma salvaguarda y la misma estabilidad.

## Trazabilidad

| Objetivo    | Requisitos             | Criterios              | Pasos del plan  |
| ----------- | ---------------------- | ---------------------- | --------------- |
| Duración    | RF-1, RF-2, RF-3, RF-9 | CA-1, CA-2, CA-3, CA-4 | 1 a 6           |
| Cobertura   | RF-4, RF-5, RF-8       | CA-6, CA-7, CA-9       | 2, 3, 4, 5 y 6  |
| Seguridad   | RF-6                   | CA-8                   | todos           |
| Estabilidad | RF-7                   | CA-5                   | 3 y 4           |

## Revisión técnica

Fase T1 (senior-fullstack, 2026-10-29). Rama de trabajo `feature/REQ-F-041-pruebas-lentas`, creada desde `origin/main` (`3715486`, merge del PR #114); el ticket sigue sin commit. NotebookLM: sus herramientas MCP no están disponibles en esta sesión; no se consultó.

### Línea base (RF-1)

**CI (paso `test` del job `calidad`).** Duración del paso según la API de GitHub (`gh run view --json jobs`), con `npm test -- --maxWorkers=4` en `ubuntu-24.04` (4 vCPU):

| Ejecución | PR | Paso `test` | Job `calidad` | Job `docker` | Pruebas (api + landing-pages + inventory-manager) |
| --------- | -- | ----------- | ------------- | ------------ | ------------------------------------------------- |
| 40987243851 | #114 (épica → `main`) | 216 s | 286 s | 465 s | 144 + 2226 + 111 |
| 40985214161 | #111 (REQ-F-040, PR 2) | 262 s | 346 s | 421 s | 144 + 2226 + 111 |
| 40963168457 | REQ-F-040, PR 1 | 273 s | 354 s | 477 s | 144 + 2214 + 71 |
| **Mediana** | | **262 s** | 346 s | 465 s | |

- Las dos primeras corren exactamente la suite actual (127 archivos, 2481 pruebas, 1 *expected fail*). En la tercera faltaban 12 pruebas de landing-pages y 40 de inventory-manager (unos 2 s en total).
- Muestra más amplia, con las 8 ejecuciones recientes con `calidad` en verde: 191, 216, 248, 249, 253, 253, 262 y 273 s; mediana 251 s.
- **Objetivo de RF-2:** 40 % menos que 262 s, es decir, **157 s o menos**. Para cubrir también la mediana amplia, el plan apunta a 150 s o menos.
- Reparto del paso: api unos 5 a 7 s, landing-pages de 206 a 260 s e inventory-manager de 3 a 4 s. Los tres workspaces corren uno detrás de otro.
- La suma de las duraciones por archivo es de unos 770 s (mediana de las 3 ejecuciones). Con 4 trabajadores, el mínimo teórico ya ronda los 192 s. **La suite está limitada por el volumen de trabajo por runner, no solo por el archivo más lento.**

**Por archivo en el CI** (mediana de las 3 ejecuciones; entre paréntesis, la de #114, #111 y REQ-F-040 PR 1). Son los 17 que superan, o casi, el límite de 20 s de RF-3; los 110 restantes tardan 13,2 s o menos:

| Mediana | Archivo (landing-pages/tests/…) | Tipo |
| ------- | -------------------------------- | ---- |
| 55,1 s (54,8 / 55,6 / 55,1) | integration/db-outage-handshake | Espera de diseño (16 cortes en serie) |
| 51,4 s (42,3 / 51,4 / 57,2) | integration/admin-api-qa-req-f-039 | Procesos reales (2 por caso, 10 casos) |
| 44,7 s (35,1 / 44,7 / 51,0) | integration/inventory-manager-qa-req-f-039 | Procesos reales (3 por caso, 9 casos) |
| 41,0 s (40,3 / 41,0 / 41,5) | integration/db-lock-wait | Espera de diseño (3 × 12 s de bloqueo + 1 s) |
| 39,0 s (31,0 / 39,0 / 45,9) | unit/product-repository-contract | HTTP + MySQL (18 casos × 2 stores) |
| 38,7 s (32,7 / 38,7 / 42,5) | integration/admin | HTTP + MySQL (44 casos) |
| 32,4 s (25,4 / 32,4 / 36,7) | integration/server-startup-config | Procesos reales |
| 29,1 s (25,0 / 29,1 / 31,4) | integration/admin-products-api | HTTP + MySQL (27 casos) |
| 29,0 s (23,8 / 29,0 / 32,8) | integration/admin-authorization-matrix | HTTP + MySQL |
| 28,2 s (21,2 / 28,2 / 32,0) | integration/server-startup | Procesos reales |
| 27,1 s (23,5 / 27,1 / 30,3) | integration/last-admin-concurrency | 2 casos × 50 repeticiones |
| 23,2 s (17,9 / 23,2 / 25,8) | integration/server-startup-provider-qa | Procesos reales |
| 22,7 s (17,0 / 22,7 / 25,5) | integration/db-verify | MySQL + bases desechables |
| 21,5 s (16,3 / 21,5 / 24,2) | integration/users-api-process | Procesos reales |
| 20,7 s (17,4 / 20,7 / 23,2) | integration/users-api-qa-req-f-040 | Procesos reales |
| 18,8 s (15,1 / 18,8 / 20,8) | integration/admin-products | HTTP + MySQL |
| 18,6 s (15,2 / 18,6 / 24,2) | unit/dependency-rule | ESLint con tipos (CPU) |

En api, el más lento es `admin-users-api` (6,4 s) y en inventory-manager ninguno pasa de 1 s.

**Local** (macOS, 10 núcleos, `npm test` con los trabajadores por defecto de Vitest, MySQL de `compose.yaml`):

| Ejecución | `npm test` (total) | landing-pages (Vitest) | api | inventory-manager |
| --------- | ------------------ | ---------------------- | --- | ----------------- |
| 1 | 95 s | 87,1 s | 4,8 s | 1,2 s |
| 2 | 90 s | 82,2 s | 4,6 s | 1,3 s |
| 3 | 95 s | 86,7 s | 4,7 s | 1,3 s |
| **Mediana** | **95 s** | 86,7 s | 4,7 s | 1,3 s |

- Por archivo, en las ejecuciones 2 y 3, los más lentos fueron:
  - `db-outage-handshake`: 56,6 y 57,4 s;
  - `admin`: 39,3 y 43,5 s;
  - `db-lock-wait`: 42,1 y 42,2 s;
  - `admin-api-qa-req-f-039`: 35,0 y 35,5 s;
  - `admin-products-api`: 31,4 y 33,0 s;
  - `product-repository-contract`: 31,0 y 31,4 s;
  - `last-admin-concurrency`: 28,3 y 29,3 s;
  - `inventory-manager-qa-req-f-039`: 26,5 y 26,8 s;
  - `admin-authorization-matrix`: 26,7 y 25,4 s.

  El resto, unos 21 s o menos. La suma de landing-pages es de unos 714 s.
- En local, el camino crítico es `db-outage-handshake`: con 57 s, ocupa más de la mitad de los 87 s de landing-pages. Partir los archivos más largos acorta el `npm test` local.

### Hallazgos

1. **El cuello de botella del CI es el volumen de trabajo, no solo las esperas.** La suite suma unos 770 s de archivos repartidos entre 4 trabajadores. El README ya documenta (sección "Trabajadores de Vitest en el CI") que, con 4 vCPU, más trabajadores empeoran: 6 trabajadores, 154 s; 8, 175 s; 4, de 143 a 149 s.
   - Acortar solo las esperas (`db-lock-wait`, unos 25 s de trabajo) y partir archivos no basta: el paso quedaría en unos 200 a 230 s, un 15 a 25 % menos.
   - **El 40 % solo es alcanzable repartiendo la suite en varios runners** (RF-8). Partir los archivos lentos sigue siendo necesario para RF-3 y para que el reparto quede equilibrado.
2. **El PR no terminará antes en conjunto.** El job `docker`, fuera de alcance, tarda de 421 a 477 s, más que `calidad` (de 286 a 354 s), y es el que marca la duración total del CI del PR. Lo que se gana es que `calidad` (tipos, lint y pruebas) responda antes, de unos 5 a 6 min a unos 3 min. Lo que tarda el CI completo del PR no cambia mientras `docker` no baje. No contradice el ticket, cuyo objetivo es el paso `test`, pero el usuario debe saberlo.
3. **`db-lock-wait`: el plazo que vence es el `timeout` de 10 s de las transacciones de Prisma**, que es código de la app (`WRITE_TX` en `packages/db/src/user-repository.ts` y en `prisma-bot-control-store.ts`; fuera de alcance).
   - La espera de bloqueo la corta `innodb_lock_wait_timeout`: 50 s en el MySQL de pruebas y 10 s en producción (`deploy/compose.prod.yaml`).
   - Para acortar la prueba sin tocar la app hay que bajar `innodb_lock_wait_timeout` en el servidor de pruebas: el mismo `mysql-dev` de `compose.yaml` que usan el CI, `docker compose run test` y el desarrollo local. Así el plazo que vence pasa a ser el de MySQL, el mismo mecanismo que en producción. El escenario se mantiene: un bloqueo real, una espera que vence y 503 sin cambios a medias (RF-5).
   - No se puede hacer por sesión: el cliente evita a propósito las consultas de inicio de sesión (`sessionVariables`, ver `packages/db/src/client.ts`, RF-9 de REQ-F-014).
4. **`db-outage-handshake`: cada uno de los 16 cortes tarda unos 3,4 s**, por el `acquireTimeout` de 5 s y el `connectTimeout` de 3 s del pool, que son código de la app. Los cortes se pueden repartir en varios archivos, cada uno con su proxy y su app y las mismas comprobaciones, pero el tiempo de cada corte no se puede reducir.
5. **Medir el CI exige un PR antes de T4.** CA-2, CA-3 y CA-5 se miden en el CI con 3 ejecuciones, pero el ciclo del agente solo permite commits y PR en T4, después de `QA_APPROVED`. El CI solo corre en PR que no estén en borrador: un borrador omite las validaciones y `workflow_dispatch` solo admite `main`. Hace falta una decisión (D-1).
6. **Reparto en jobs y protección de rama.** `main` exige las comprobaciones `calidad`, `docker` y `auditoria`. El job `validado` busca un job llamado exactamente `calidad` en verde.
   - Si las pruebas pasan a otros jobs, `calidad` debe seguir existiendo y no quedar en verde salvo que todos ellos lo estén. Si no, un shard en rojo no bloquearía el merge ni la publicación.
   - La solución propuesta: `calidad` pasa a ser un job agregador. Así no hay que tocar la protección de rama ni `validado`.
   - El repositorio es público: los jobs adicionales no tienen coste.
7. **Sharding de Vitest.** `--shard=i/n` reparte los archivos por número, ordenados por un hash de la ruta, no por duración. Por eso los archivos lentos tienen que quedar por debajo de unos 15 s: así ningún shard carga con dos o tres de 40 a 55 s.
   - `--shard` llega a los tres workspaces con el `--` del script `test` de la raíz, igual que `--maxWorkers` hoy.
   - Con 7 archivos (api) y 8 (inventory-manager), ningún shard de 2 queda vacío. Vitest falla si un shard no tiene archivos.
8. **No se toca la salvaguarda.** `tests/setup/database-guard.ts`, `tests/support/test-database-config.ts` (hosts y prefijo) y `test-database-guard.test.ts` quedan fuera del diff. Cada shard corre en su propio runner con su propio MySQL y sus bases `restaurante_test_<run>_<trabajador>`, y la limpieza de bases de ejecuciones interrumpidas no cambia.
9. **Sin cambios de comportamiento de la app.** El plan solo toca `tests/`, `compose.yaml` (servidor de pruebas y desarrollo), `.github/workflows/ci.yml` y la documentación.

### Decisiones requeridas

- **D-1. Cómo medir CA-2, CA-3 y CA-5 en el CI antes de QA.**
  - **a) (recomendada)** Autorizar en T2 el commit y el push de la rama, y abrir ya el PR hacia `main`, listo y no en borrador, para que corra el CI. Se mide relanzándolo 3 veces (`gh run rerun`) y los resultados se anotan en el ticket. El PR no se mergea hasta T4, y en T4 solo se agregan los commits de cierre. Es una excepción, autorizada por el usuario, a "commits solo en T4".
  - **b)** En T2 y T3 medir solo en local, con el contenedor `test` limitado a 4 CPU (como en el README). La medición del CI queda para T4. Si allí no se cumplen CA-2, CA-3 o CA-5, el ticket vuelve a T3 después del QA.
- **D-2. `innodb_lock_wait_timeout` del MySQL de `compose.yaml` (desarrollo, pruebas y CI).**
  - **a) (recomendada) 5 s**, con una retención de 6 s en `db-lock-wait`. Deja margen a las esperas normales de `last-admin-concurrency` (transacciones `Serializable` con dos pools) en un runner cargado.
  - **b) 3 s**, con una retención de 4 s. Ahorra unos 6 s más, pero con más riesgo de que una espera normal venza con carga (error 1205 → 503) y aparezcan fallos intermitentes.

  En ambos casos, producción sigue en 10 s y el código de la app no cambia.
- **D-3. Reparto del CI.**
  - **a) (recomendada)** Un job `verificacion` (tipos, lint y divergencia de migraciones), un job matriz `pruebas` con 2 shards de Vitest (4 trabajadores cada uno) y `calidad` como agregador, que solo queda en verde si los otros dos lo están. El número de shards es un valor de la matriz: si la medición final no llega al 40 %, se sube a 3 sin rediseñar nada.
  - **b)** Sin repartir: solo acortar esperas y partir archivos. Según el hallazgo 1, no llega al 40 % (CA-2 no se cumpliría).

## Technical Action Plan

Propuesta, sujeta a las decisiones D-1 a D-3; se describe con las opciones recomendadas.

### Objetivo técnico

Bajar el paso de pruebas del CI de 262 s (mediana) a 150 s o menos:

- repartiendo la suite en 2 runners paralelos;
- partiendo los archivos de más de unos 15 s;
- acortando la única espera que se puede acortar sin tocar la app (`db-lock-wait`).

Todo con los mismos escenarios, las 50 repeticiones, la salvaguarda intacta y sin reintentos.

### Archivos o componentes afectados

- `restaurante/compose.yaml`: `--innodb-lock-wait-timeout=5` en `mysql-dev`.
- `.github/workflows/ci.yml`: jobs `verificacion`, `pruebas` (matriz de shards) y `calidad` (agregador).
- `restaurante/landing-pages/tests/integration/`: se parten los 17 archivos de la tabla (ver "Cambios requeridos").
- `restaurante/landing-pages/tests/support/`: módulos nuevos con la preparación que hoy está dentro de los archivos que se parten (`startStack`, el proxy que corta la red, etc.), para no duplicarla. **Sin tocar** `test-database-config.ts`, `database.ts` (salvo lo indicado en el paso 5, si la medición lo justifica) ni `tests/setup/`.
- `restaurante/README.md` (secciones "Pruebas con base de datos", "CI" y "Trabajadores de Vitest en el CI") y `.claude/rules/testing.md` si cambia algo de lo que documenta.

### Cambios requeridos

**1. Esperas de diseño (RF-5 y CA-7).**

- **`db-lock-wait`:**
  - `HOLD_MS` pasa de 12 s a 6 s (D-2), con el servidor de pruebas en `innodb_lock_wait_timeout=5`.
  - Se parte en 3 archivos, uno por escenario: desactivar usuario, editar producto e iniciar sesión.
  - Se conservan todas las comprobaciones: bloqueo real con `SELECT … FOR UPDATE` desde otro pool, 503 sin cambios o éxito completo con su registro, el resto de la app atendiendo mientras dura y la recuperación al liberar.
  - El `wait(1000)` posterior se mantiene; no se sustituye ninguna espera por condición (RF-7).
  - Se actualiza el comentario del archivo (ya no son 50 s).
- **`db-outage-handshake`:**
  - Los 16 cortes (10 de bajada y 6 de subida) se reparten en 4 archivos de 4 cortes cada uno.
  - El proxy y el recorrido de cada corte van a `tests/support/db-cut-proxy.ts`.
  - Cada archivo incluye al menos un corte temprano del saludo (4 o 40 bytes) y comprueba lo mismo que hoy: ningún `unhandledRejection`, solo 200 o 503 durante los cortes, al menos un 503, la landing en 200, la recuperación sola y ningún secreto ni SQL en `database_unavailable`.
  - Que haya al menos un 503 se comprueba ahora en cada archivo, no solo en el conjunto: es una comprobación más estricta, no más débil.
- **`last-admin-concurrency`:** sus 2 casos van a 2 archivos, cada uno con sus 50 repeticiones (`REPETITIONS = 50` sin cambios).

**2. Procesos reales (RF-3).** Se parten por sus `describe`, ya agrupados por tema. Las funciones `startStack`, `client`, `call`, etc. pasan a `tests/support/`, sin cambios de comportamiento:

- `admin-api-qa-req-f-039`: 3 archivos (acceso, reglas de producto y aviso interno).
- `inventory-manager-qa-req-f-039`: 3 archivos (sesión; CSRF e IP; formularios y salud).
- `server-startup-config`: 2 archivos (NODE_ENV y API_INTERNAL_URL; HOST).
- `server-startup`, `server-startup-provider-qa`, `users-api-process`, `users-api-qa-req-f-040` y `db-verify`: 2 archivos cada uno.

No se comparte un mismo proceso entre pruebas: cada caso sigue arrancando sus procesos y su base, como hoy.

**3. HTTP + MySQL dentro del proceso (RF-3).**

- `admin` (44 casos): 3 archivos (acceso protegido y CSRF; guardar; edición simultánea, restaurar, archivo dañado, rutas y límite).
- `admin-products-api` y `admin-authorization-matrix`: 2 archivos cada uno.
- `product-repository-contract`: 2 archivos, el contrato con el store en memoria y con el de Prisma. Los casos se definen una vez en `tests/support/product-repository-contract.ts` y cada archivo los ejecuta con su store. Si el de Prisma sigue por encima de unos 15 s, se parte por bloques del contrato (importación, edición, orden…).
- `admin-products` y `dependency-rule` (unos 19 s, con picos de 21 y 24 s): 2 archivos cada uno. `dependency-rule` crea una instancia de ESLint por archivo, así que partirlo añade unos segundos de CPU en total, pero baja el pico por archivo.

**4. CI (RF-8 y CA-9).** En `.github/workflows/ci.yml`:

- `verificacion`: install, `db:generate`, typecheck, lint, `db:up` y migraciones sin divergencia. Los mismos pasos que hoy, sin `test`.
- `pruebas`, con matriz `shard: [1, 2]`: install, `db:generate`, `build:css`, `db:up` y `npm test -- --maxWorkers=4 --shard=${{ matrix.shard }}/2`, con `fail-fast: false` para ver todos los shards.
- `calidad`:
  - Tiene `needs: [cambios, validado, verificacion, pruebas]` y la misma condición `if` que hoy, más `!cancelled()`.
  - Un único paso que falla salvo que `verificacion` y `pruebas` hayan terminado en `success`.
  - En un PR de solo documentación o en borrador, los tres quedan omitidos como hoy. En un push a `main` validado, también.
- La condición de `verificacion` y `pruebas` es la misma que hoy tiene `calidad`.
- No cambian `validado`, `docker`, `auditoria`, `publish` ni `deploy`, ni las acciones fijadas por SHA.

**5. Coste fijo de `makeDatabase`.** Solo si la medición lo justifica (paso 5 del Action Plan del BA). Se mide en T2 cuánto tardan `isPristine` y `truncateAll` por llamada en el CI. Si superan unos 300 ms, se reducen sin cambiar su semántica, por ejemplo vaciando solo las tablas con filas o con `AUTO_INCREMENT` > 1, para que los autoincrementos sigan reiniciándose como hoy. Si no, no se toca.

### Contenido / configuración

- `compose.yaml`: `--innodb-lock-wait-timeout=5`, con un comentario como el de `--max-connections`: solo desarrollo y pruebas; producción sigue en 10 s.
- Para aplicarlo a un MySQL local ya creado: `npm run db:up`, que recrea el contenedor; los datos siguen en su volumen. Se documenta.

### Validaciones

- Por cada archivo partido, el número de casos antes y después (`vitest list` o el resumen del reporter) entra en la tabla de RF-4.
- El total de pruebas (2481, más el *expected fail*) debe ser igual o mayor (CA-6).
- `grep` de `.skip`, `.todo`, `.only` y `retry` sobre el diff: ninguno nuevo (RF-4 y RF-7).
- `git diff --stat` sin `tests/setup/`, `tests/support/test-database-config.ts` ni `test-database-guard.test.ts` (RF-6 y CA-8).
- `testTimeout` y `hookTimeout` sin cambios (RF-7).

### Manejo de errores

Sin cambios en la app. Las nuevas ayudas de `tests/support/` conservan la limpieza en `afterEach` (procesos, bases y proxies) de los archivos originales.

### Testing

- **En local, en cada paso:** `npm run typecheck`, `npm run lint` y `npm test`. Además, cada archivo nuevo de 5 a 10 veces seguidas con `npx vitest run <archivo>`, para descartar inestabilidad.
- **CA-4:** `npm test` 5 veces seguidas en local, en verde y sin superar la línea base local.
- **Antes de subir al CI:** la suite en el contenedor `test` con `--cpus=4` y cada shard por separado, para estimar el reparto.
- **CA-2, CA-3 y CA-5:** 3 ejecuciones del CI en verde y sin reintentos, según D-1.
  - Se mide desde que empieza el paso `test` del primer shard hasta que termina el del último (RF-2).
  - El archivo más lento sale del log de cada shard.

### Seguridad

- No se toca la salvaguarda de bases (RF-6). Las bases siguen siendo `restaurante_test_*` en 127.0.0.1, y cada shard tiene su propio MySQL en su runner.
- El workflow mantiene `permissions: contents: read`, las acciones fijadas por SHA, `persist-credentials: false` y ningún secreto en los jobs nuevos.

### Performance

Estimación con 2 shards y archivos de 15 s o menos:

- cada shard, unos 350 a 400 s de trabajo entre 4 trabajadores, es decir, de 90 a 120 s;
- con la diferencia de arranque entre runners (unos 5 a 10 s), el paso medido queda en unos 100 a 130 s, de un 50 a un 60 % menos.

El job `calidad` pasaría de unos 5,5 min a unos 3 min. La duración total del PR la sigue marcando `docker`, de 7 a 8 min (hallazgo 2).

En local, partir los archivos más largos acorta el camino crítico, hoy `db-outage-handshake`, con 57 s de un total de 95 s. `npm test` no debería empeorar (RF-9).

### Riesgos técnicos

- **Desequilibrio entre shards:** Vitest reparte por número de archivos. Se mitiga con archivos cortos y con el número de shards en la matriz (subir a 3 es un cambio de una línea).
- **Fallos intermitentes por `innodb_lock_wait_timeout=5`:** con carga, una espera normal podría vencer (1205 → 503). Se mitiga con el margen de D-2 a, ejecutando `last-admin-concurrency` y `admin-authorization-matrix` (que incluye peticiones simultáneas) 10 veces seguidas en local y con CA-5.
- **Más MySQL a la vez:** un `db:up` por shard, de unos 24 s, pero cada uno en su runner. La carga por MySQL baja, porque cada uno atiende la mitad de los archivos.
- **Diff grande:** mover pruebas entre archivos hace el diff más difícil de revisar. Se mitiga moviendo los casos sin editarlos (solo cambian el archivo y los imports) y con la tabla de RF-4.
- **Comprobación requerida `calidad`:** si el agregador estuviera mal escrito, un shard en rojo podría pasar inadvertido. Se comprueba a propósito en el PR, con una ejecución en la que un shard falle (por ejemplo, un commit temporal con una prueba rota que luego se revierte) o revisando la lógica con `needs.<job>.result`.

### Orden de implementación

1. Rama `feature/REQ-F-041-pruebas-lentas` (ya creada desde `origin/main`) y el ticket a `in-progress/`.
2. `compose.yaml` (D-2) y `db-lock-wait` en 3 archivos.
3. `db-outage-handshake` en 4 archivos con `tests/support/db-cut-proxy.ts`, y `last-admin-concurrency` en 2.
4. Archivos de procesos reales, con sus ayudas en `tests/support/`.
5. Archivos de HTTP + MySQL y `dependency-rule`.
6. Medir `makeDatabase`; optimizar solo si supera el umbral (paso 5).
7. CI: `verificacion`, `pruebas` y `calidad` agregador.
8. Documentación (README y, si aplica, `.claude/rules/testing.md`).
9. Medición final en local (CA-4) y en el CI (CA-2, CA-3 y CA-5, según D-1), y la tabla de RF-4.

### Criterios de finalización

- Mediana de 3 ejecuciones del CI de 157 s o menos, del inicio del primer shard al final del último (CA-1 y CA-2).
- Archivo más lento del CI de 20 s o menos (CA-3).
- `npm test` 5 veces en verde en local, sin superar la línea base (CA-4).
- 3 ejecuciones del CI en verde, sin reintentos (CA-5).
- Total de pruebas igual o mayor, con la tabla de RF-4 (CA-6).
- 50 repeticiones y las mismas comprobaciones de bloqueo y corte (CA-7).
- Salvaguarda intacta, y `typecheck` y `lint` en 0 (CA-8).
- La suite completa en cada PR, repartida en shards (CA-9).

**PR previstos:** 1, hacia `main`. Con D-1 a, se abre en T2 para medir el CI; con D-1 b, en T4.

## Historial de cambios

### Versión 1

Descripción inicial. Aprobada por el usuario el 2026-10-29 con la cita textual: "Si y ya están mergeado".

### Revisión técnica (T1)

2026-10-29, senior-fullstack: línea base medida (CI: mediana de 262 s del paso `test`; local: mediana de 95 s), revisión técnica con 9 hallazgos y Technical Action Plan propuesto. Quedan pendientes las decisiones D-1 (medición del CI antes de QA), D-2 (`innodb_lock_wait_timeout` del MySQL de pruebas) y D-3 (reparto del CI). Estado: `NEEDS_TECHNICAL_CLARIFICATION`.
