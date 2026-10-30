# REQ-F-041 — Reducir la duración de las pruebas lentas

## Estado

DONE

QA a posteriori sobre `main` (`1bbca3b`; PR #116 y #117 ya mergeados y desplegados), con el QA Action Plan aprobado ("Sí, apruebo el plan"), O-1 ("Sí, 2 relanzamientos (Recomendado)") y O-2 ("Script temporal (Recomendado)"). Ver `## QA Report`.

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

## Implementation Result

Fase T2 (senior-fullstack, 2026-10-29). Decisiones del usuario: D-1 a ("PR antes de QA (Recomendado)"), D-2 a ("5 s (Recomendado)"), D-3 a ("2 shards + agregador (Recomendado)") y el plan aprobado ("Sí, apruebo el plan").

### Rama

`feature/REQ-F-041-pruebas-lentas`, desde `main` (`c1805be`). PR #116: https://github.com/orvigas/negocio/pull/116.

**Incidencia: el PR #116 se mergeó en `main` el 2026-10-30 a las 02:56:38 UTC (orvigas, merge `e71a1e2`), antes del QA y antes de las 3 mediciones del CI.** Entró en `main` con los commits `f1aa6d5` y `591d7c8`. El tercer commit, `8a1976b`, que parte los cinco archivos que pasaban de 17 s en el CI, se subió a la rama después del merge (02:57 UTC): **no está en `main` ni en ningún PR**. El push a `main` corrió `validado` en verde (el árbol ya validado en el PR, con el `calidad` agregador) y `publish`.

### Cambios realizados

- **CI** (`.github/workflows/ci.yml`):
  - `verificacion`: tipos, lint y divergencia de migraciones.
  - `pruebas`: matriz de 2 shards, `npm test -- --maxWorkers=4 --shard=<n>/2`, con `fail-fast: false`.
  - `calidad`: agregador. Falla si `verificacion` o `pruebas` no terminan en `success` (rojo, cancelado u omitido).
  - La protección de `main` y `validado` no cambian.
- **MySQL de `compose.yaml`:** `--innodb-lock-wait-timeout=5`.
- **`db-lock-wait`:** pasa a 3 archivos (uno por caso), con la retención en 6 s (`tests/support/lock-wait.ts`). Comprueba que `innodb_lock_wait_timeout` sea menor que la retención; si no, falla y dice cómo recrear el MySQL.
- **`db-outage-handshake`:** pasa a 5 archivos, de 3 o 4 cortes cada uno (`tests/support/db-cut-proxy.ts`). Cada uno incluye dos cortes del saludo o la autenticación (los que tardan 5 s y dan 503).
  - Medición: 10 de los 16 cortes tardan 5 s (`acquireTimeout`) y 6 tardan menos de 1 s.
  - Cada archivo comprueba lo mismo que el original, y "al menos un 503" pasa a comprobarse en cada archivo.
- **`last-admin-concurrency`:** 2 archivos. Los 3 casos con `REPETITIONS = 50` siguen con 50.
- **Archivos de más de unos 15 s:** se parten por sus `describe` (tabla de RF-4), con la preparación en `tests/support/`, sin cambios de los casos.
  - `product-repository-contract` y las carreras de `admin-authorization-matrix` definen sus casos en una función de `tests/support/` que llama cada archivo.
  - `vitest list`, que analiza sin ejecutar, no ve esos casos. La ejecución sí: 2230 en landing-pages.
- **Desviación del plan, paso 5:** `truncateAll` (`tests/support/database-admin.ts`) solo vacía las tablas con filas o con el autoincremento usado. El resultado es el de un TRUNCATE de todas.
  - El plan lo condicionaba a más de 300 ms por llamada; se midió unos 70 ms.
  - Se hizo porque, sin él, partir los archivos empeoraba `npm test` en local: 99, 100 y 102 s, frente a la línea base de 95 s (RF-9 y CA-4). Con él: 90 y 94 s.
- **Documentación:**
  - `restaurante/README.md`: pruebas con base de datos, "Qué comprueba" y trabajadores y shards.
  - `.claude/rules/testing.md`: espera de bloqueo de 5 s y duración por archivo.

### Tabla de RF-4 (antes → después)

| Antes (landing-pages/tests/…) | Después | Preparación común |
| ----------------------------- | ------- | ----------------- |
| integration/db-outage-handshake | integration/db-outage-handshake-{saludo, autenticacion, bajada, subida-saludo, subida}: los 16 cortes, de 3 o 4 por archivo, cada uno con dos cortes del saludo o la autenticación | support/db-cut-proxy.ts |
| integration/db-lock-wait | integration/db-lock-wait-{usuario, producto, acceso}: un caso por archivo | support/lock-wait.ts |
| integration/last-admin-concurrency | integration/last-admin-concurrency (4 casos) y last-admin-concurrency-http (la carrera de dos administradores por HTTP, 50 repeticiones) | `deactivateUser` en support/admin.ts |
| integration/admin-api-qa-req-f-039 | integration/admin-api-qa-req-f-039-{acceso, productos, aviso (F-13 y F-14), aviso-en-curso (N-09 y N-09b), base-caida (N-10)} | support/admin-api-qa-req-f-039.ts |
| integration/inventory-manager-qa-req-f-039 | integration/inventory-manager-qa-req-f-039-{cookie (S-01), sesion (S-02 y S-05/S-06), salud (DEF-005), csrf (S-03, S-08 y F-10/S-10), formularios (F-11 y F-12)} | support/inventory-manager-qa-req-f-039.ts |
| unit/product-repository-contract | unit/product-repository-contract-{memoria (todo el contrato), prisma-importacion (importación y eliminar), prisma-crear, prisma-actualizar (actualizar y atomicidad)} | support/product-repository-contract.ts |
| integration/admin | integration/admin-{acceso (acceso protegido, primeros 11), csrf (CA-23), guardar (RF-6), produccion (CA-24 a CA-26, HTTPS, edición simultánea, restaurar, archivo dañado, rutas y límite)} | support/admin-page.ts |
| integration/admin-products-api | integration/admin-products-api-{sesion (sesión, permisos, eliminar y disponibilidad), crear (CA-16 a CA-18), validar (CA-19 a CA-22, 413/415)} | support/admin-products-api.ts |
| integration/admin-authorization-matrix | integration/admin-authorization-matrix (páginas, formularios, "Mi cuenta" y escape), -concurrencia (se desactivan, se degradan) y -concurrencia-mixta (uno desactiva y el otro degrada) | support/admin-authorization-matrix.ts |
| integration/admin-products | integration/admin-products-{pagina (página, editar y concurrencia), crear (crear/eliminar/ordenar y permisos)} | support/admin-products-page.ts |
| integration/db-verify | integration/db-verify (los 3 primeros casos), db-verify-colacion (las 4 colaciones) y db-verify-migraciones (migraciones y DATABASE_ALLOW_NEWER_SCHEMA) | support/db-verify.ts |
| integration/server-startup-config | integration/server-startup-config (NODE_ENV y API_INTERNAL_URL), server-startup-host (CA-6 y CA-7/CA-13) y server-startup-host-invalido (CA-12, CA-8 e IP ajena) | support/server-startup-config.ts |
| integration/server-startup | integration/server-startup (5 primeros casos) y server-startup-base (el resto y el primer arranque) | support/server-startup.ts |
| integration/server-startup-provider-qa | integration/server-startup-provider-qa (CA-8 a CA-10) y -twilio (L-8 a CA-20) | support/server-startup-provider-qa.ts |
| integration/users-api-process | integration/users-api-process (reglas y sesiones) y -ultimo-admin | support/users-api-process.ts |
| integration/users-api-qa-req-f-040 | integration/users-api-qa-req-f-040 (seguridad y validación) y -ultimo-admin | support/users-api-qa-req-f-040.ts |
| integration/admin-recover | integration/admin-recover (los 3 primeros casos) y admin-recover-errores (los casos de error) | support/admin-recover.ts |
| unit/dependency-rule | unit/dependency-rule (core y contracts), dependency-rule-paquetes (db, web y Zod en contracts) y dependency-rule-apps (landings, api e inventory-manager) | support/dependency-rule.ts |

Total de pruebas en una ejecución, contando los 3 workspaces:

- antes: 2481 (144 + 2226, con 1 *expected fail*, + 111);
- ahora: 2485 (144 + 2230 + 111).

La diferencia de +4 en landing-pages viene de `db-outage-handshake`: un caso con 16 cortes pasa a 5 casos con los mismos 16 cortes. En el resto, el número de casos de cada grupo de archivos es exactamente el de antes (contado con el reporter JSON de Vitest). Ningún `skip`, `only`, `todo` ni `retry` nuevo.

### Criterios de aceptación

- **CA-1 (línea base y medición final con el mismo método): parcial.** La línea base está en la revisión técnica. Medición final, ejecución 40993807702, commit `591d7c8`, la que se mergeó:
  - `pruebas (1/2)`: paso `test` de 122 s;
  - `pruebas (2/2)`: paso `test` de 153 s;
  - del primero al último: **153 s** (−41,6 % frente a 262 s).

  Faltan 2 ejecuciones: el PR se mergeó antes.
- **CA-2 (mediana de 3, al menos un 40 % menos): sin verificar.** Hay 1 de 3 ejecuciones, en el límite: 153 s frente al umbral de 157 s.
- **CA-3 (archivo más lento ≤ 20 s): no cumplido en lo mergeado.** En 40993807702 pasaban de 17 s:
  - `admin-api-qa-req-f-039-aviso`: 36,6 s;
  - `inventory-manager-qa-req-f-039-sesion`: 21,9 s;
  - `dependency-rule`: 18,4 s;
  - `db-verify`: 17,4 s;
  - `admin-recover`: 17,1 s.

  `8a1976b` los parte, pero no se ha medido en el CI.
- **CA-4 (5 veces en local, sin superar la línea base): cumplido.** 5 de 5 en verde: 92, 94, 94, 93 y 94 s (mediana 94 s), todas por debajo de la mediana de la línea base (95 s). Medido con `8a1976b`; con lo mergeado (`591d7c8`), 4 ejecuciones dieron 92, 93, 96 y 94 s.
- **CA-5 (3 ejecuciones del CI en verde): 1 de 3.** 40993807702 en verde, sin reintentos.
- **CA-6 (total de pruebas igual o mayor): cumplido.** 2485 frente a 2481; la diferencia está en la tabla de RF-4.
- **CA-7: cumplido.**
  - Las 50 repeticiones se conservan.
  - `db-lock-wait`: bloqueo real, la espera vence a los 5 s con el bloqueo puesto y 503 sin cambios a medias. Se observó 503 a los 5,0 y 5,3 s. La rama de éxito completo con su registro también se conserva, como antes.
  - `db-outage-handshake`: los mismos 16 cortes, ningún rechazo sin manejar, 503 y recuperación sola.
- **CA-8: cumplido.** El diff no toca `tests/setup/`, `test-database-config.ts` ni `test-database-guard.test.ts`. `npm run typecheck` y `npm run lint`: 0.
- **CA-9: cumplido.** Cada archivo está en un solo shard y la suite completa corre en cada PR: la ejecución vio 2485 pruebas en los 2 shards.

### Validaciones ejecutadas

- `npm run typecheck`: 0. `npm run lint`: 0 (los dos, también en `verificacion` del CI).
- `npm test` en local (macOS, 10 núcleos), con el commit `8a1976b`: 5 de 5 en verde, con 92, 94, 94, 93 y 94 s.
- CI, ejecución 40993807702 (commit `591d7c8`): `verificacion`, `pruebas (1/2)`, `pruebas (2/2)`, `calidad`, `docker` y `auditoria` en verde.
- Push a `main` tras el merge (40994564013, https://github.com/orvigas/negocio/actions/runs/40994564013): en verde.
  - `validado` dio el árbol por validado, así que `verificacion`, `pruebas`, `calidad`, `docker` y `auditoria` quedaron omitidas: esta ejecución no sirve como medición de las pruebas.
  - **`publish` corrió (02:56:57 a 02:58:19 UTC), `vigente` también, y `deploy` desplegó en producción** (02:58:30 a 02:58:59 UTC; el log dice "desplegado"). No cambia la app: solo pruebas, CI, `compose.yaml` local y documentación.
- Job `calidad` del PR: de 02:48:35 (inicio de los jobs) a 02:51:59, unos 3 min 24 s; antes, de 286 a 354 s. `docker` tardó 7 min 48 s y sigue marcando la duración total del CI.

### Archivos afectados

- `.github/workflows/ci.yml`
- `restaurante/compose.yaml`
- `restaurante/README.md`
- `.claude/rules/testing.md`
- `restaurante/landing-pages/tests/support/`:
  - `lock-wait.ts`, `db-cut-proxy.ts`, `product-repository-contract.ts`
  - `admin-*.ts`, `db-verify.ts`, `inventory-manager-qa-req-f-039.ts`
  - `server-startup*.ts`, `users-api-*.ts`, `dependency-rule.ts`, `admin-recover.ts`
  - `database-admin.ts` (`truncateAll`) y `admin.ts` (`deactivateUser`)
- `restaurante/landing-pages/tests/{integration,unit}/`: los archivos de la tabla de RF-4.

### Segunda parte: PR #117 (mediciones finales)

- **PR:** https://github.com/orvigas/negocio/pull/117.
  - Rama `feature/REQ-F-041-archivos-lentos`, creada desde `main` (`e71a1e2`) con `8a1976b` aplicado con cherry-pick (commit `22c1f82`). El diff es solo ese commit.
  - El usuario lo mergeó el 2026-10-30 a las 07:17:29 UTC (merge `1bbca3b`), mientras corría el intento 3.
- **Método:** el mismo que en la línea base. Es la duración del paso `test` de los shards, desde que empieza el primero hasta que termina el último.

| Ejecución | `pruebas (1/2)` | `pruebas (2/2)` | Span | Archivo más lento |
| --------- | --------------- | --------------- | ---- | ----------------- |
| PR #117, 41017410887 intento 1 | 151 s | 145 s | 154 s | 19,3 s (`inventory-manager-qa-req-f-039-csrf`) |
| PR #117, 41017410887 intento 2 (`gh run rerun`) | 152 s | 112 s | 157 s | 18,6 s (`server-startup-base`) |
| PR #117, 41017410887 intento 3 (`gh run rerun`) | 153 s | 117 s | 157 s | 19,1 s (`inventory-manager-qa-req-f-039-csrf`) |
| **Mediana (los 3 intentos del PR)** | | | **157 s** (−40,1 % frente a 262 s) | **19,3 s como máximo** |
| Push a `main`, 41019188860 (dato adicional) | 153 s | 149 s | 156 s | 19,4 s (`server-startup-base`) |

- **Archivos más lentos** (máximo de los 4): `server-startup-base` 19,4 s, `inventory-manager-qa-req-f-039-csrf` 19,3 s, `dependency-rule-apps` 18,3 s, `dependency-rule-paquetes` 18,0 s, `admin-api-qa-req-f-039-aviso-en-curso` 16,8 s y `server-startup-config` 16,9 s.
- **Cada ejecución:** 164 archivos y 2485 pruebas, todo en verde, sin reintentos de pruebas.
- **Push a `main` 41019188860:** `validado` no encontró el árbol validado (el intento 3 del PR aún no había terminado), así que corrieron todas las validaciones.
  - `verificacion`, `pruebas`, `calidad`, `docker` y `auditoria`: en verde.
  - **`publish`, `vigente` y `deploy` corrieron.** El log de `deploy` dice "desplegado" (07:27 UTC).

**Criterios actualizados con estas mediciones:**

- **CA-1: cumplido.** Línea base y medición final con el mismo método.
- **CA-2: cumplido, en el límite.** La mediana es de 157 s; el umbral es 157,2 s (40 % menos que 262 s). Con el push a `main` como cuarta muestra, la mediana es de 156,5 s. Si se quiere más margen, el número de shards está en la matriz (`shard: [1, 2]`); subirlo a 3 queda fuera de lo aprobado (D-3).
- **CA-3: cumplido.** El archivo más lento tarda 19,4 s, como máximo de 4 ejecuciones. Tiene poco margen: cuatro archivos pasan de 18 s.
- **CA-5: cumplido.** 3 ejecuciones seguidas del PR en verde, más la del push a `main`. Los intentos 2 y 3 son relanzamientos completos del workflow para medir, no reintentos de pruebas fallidas.

### Riesgos o pendientes

- Lo de `8a1976b` ya está en `main`, con el PR #117 (decisión del usuario: "PR nuevo a main (Recomendado)").
- El margen es escaso: en CA-2, la mediana de 157 s frente al umbral de 157,2 s; en CA-3, 19,4 s frente a 20 s.
- El nombre del job matriz omitido aparece sin expandir (`pruebas (${{ matrix.shard }}/2)`) cuando se omite en un push a `main`: es solo cosmético.

## QA Action Plan

Fase Q1 (senior-qa, 2026-10-30). Base de la validación: el árbol de `main` en `1bbca3b` (la rama `feature/REQ-F-041-archivos-lentos`, `22c1f82`, tiene el mismo árbol; solo difiere el ticket sin commit). Diff bajo prueba: `c1805be..1bbca3b` (85 archivos: `tests/` de landing-pages, `.github/workflows/ci.yml`, `restaurante/compose.yaml`, `restaurante/README.md` y `.claude/rules/testing.md`; ningún archivo de `src/`, `packages/`, `public/` ni `deploy/`). NotebookLM: sus herramientas MCP no están disponibles en esta sesión; no se consultó.

### Objetivo

Comprobar con evidencia propia, no solo con las mediciones del desarrollador, que el reparto en shards y los archivos partidos bajan el paso de pruebas del CI al menos un 40 %, sin perder ni debilitar casos, sin relajar la salvaguarda de bases, sin introducir inestabilidad y sin dejar un agujero en la comprobación requerida `calidad`.

### Requisito bajo prueba

REQ-F-041, RF-1 a RF-10, versión 1 aprobada, con las decisiones D-1 a, D-2 a y D-3 a.

### Criterios de aceptación

| Criterio | Pruebas |
| -------- | ------- |
| CA-1 (línea base y medición final con el mismo método) | QA-12 |
| CA-2 (mediana de 3 del CI ≤ 157,2 s) | QA-12, QA-14 |
| CA-3 (archivo más lento del CI ≤ 20 s) | QA-13, QA-14 |
| CA-4 (`npm test` 5 veces en local, ≤ 95 s) | QA-15 |
| CA-5 (CI 3 veces seguidas en verde, sin reintentos) | QA-12, QA-14 |
| CA-6 (número de pruebas igual o mayor, o explicado) | QA-03 |
| CA-7 (50 repeticiones; `db-lock-wait` y `db-outage-handshake` comprueban lo mismo) | QA-04, QA-05 |
| CA-8 (salvaguarda intacta; `typecheck` y `lint` en 0) | QA-01, QA-02, QA-15 |
| CA-9 (la suite completa en cada PR) | QA-08, QA-09, QA-10, QA-11 |
| RF-7 (sin `retry`, sin esperas fijas nuevas, sin subir plazos) | QA-02, QA-06 |
| RF-10 (documentación) | QA-18 |

### Riesgos identificados

1. **Margen de CA-2 casi nulo:** 157 s frente a 157,2 s. Las 3 muestras son relanzamientos del mismo commit; la variabilidad entre runners puede dejar la mediana por encima con otras muestras.
2. **Margen de CA-3 pequeño:** 19,4 s frente a 20 s, con cuatro archivos por encima de 18 s.
3. **Casos perdidos o debilitados al mover:** 18 archivos originales repartidos en unos 45, con preparación movida a 17 módulos de `tests/support/`. Algunos casos se definen en funciones de soporte (`product-repository-contract`, carreras de `admin-authorization-matrix`), que `vitest list` no ve: el inventario debe salir de una ejecución real.
4. **Esperas acortadas:** `HOLD_MS` de 12 a 6 s y `innodb_lock_wait_timeout` a 5 s. Si el MySQL local no se recreó, `expectLockWaitBelowHold` debe fallar con su mensaje; con carga, una espera normal podría vencer (1205 → 503) en `last-admin-concurrency` o las carreras de `admin-authorization-matrix`.
5. **Desviación del plan en `truncateAll`:** ahora solo vacía las tablas con filas o con el autoincremento usado. Si no equivale a un TRUNCATE de todas, una prueba podría heredar estado (falsos verdes o fallos intermitentes).
6. **Agregador `calidad`:** un error en `needs`/`if` dejaría un shard en rojo sin bloquear el merge ni `publish`. No hay en el CI una ejecución con un shard en rojo.
7. **Shards por número de archivos:** un shard vacío hace fallar Vitest; un archivo fuera de ambos shards no correría nunca.
8. **QA a posteriori:** todo está desplegado. Un defecto se corregiría con un PR nuevo; no hay riesgo para la app (no cambia código de producción), pero sí para la protección del CI.

### Pruebas funcionales

- **QA-01. Alcance del diff.** `git diff --name-status c1805be 1bbca3b`: solo `tests/`, `ci.yml`, `compose.yaml`, `README.md`, `testing.md` y el ticket. `git diff origin/main HEAD` vacío salvo el ticket. En `ci.yml`, los cambios se limitan a `verificacion`, `pruebas` y `calidad` (`docker`, `auditoria`, `validado`, `publish`, `vigente` y `deploy` sin cambios, acciones fijadas por SHA, `permissions: contents: read`, `persist-credentials: false`). `deploy/compose.prod.yaml` sigue en 10 s.
- **QA-02. Salvaguarda y configuración de Vitest.** Diff vacío en `landing-pages/tests/setup/`, `tests/support/test-database-config.ts`, `tests/unit/test-database-guard.test.ts` y los tres `vitest.config.ts` (`testTimeout`, `hookTimeout`, `retry`, `pool`). `--maxWorkers=4` igual que antes.
- **QA-03. Inventario de casos por ejecución (CA-6).** Ejecutar la suite con `--reporter=json` en `1bbca3b` (carpeta de trabajo) y en `c1805be` (un `git worktree` en el scratchpad, con `npm ci`, `db:generate` y `build:css`, contra el mismo MySQL y bases `restaurante_test*`, una ejecución detrás de otra). Comparar, por grupo de la tabla de RF-4 y por workspace, el multiconjunto de nombres completos (`describe` + título): esperado idéntico, salvo `db-outage-handshake` (1 caso → 5, con los mismos 16 cortes). Totales esperados: 2481 → 2485. Un fallo en la ejecución antigua solo se registra (no es objeto del QA); interesa el inventario.
- **QA-04. Cuerpos de los casos.** Con un script en el scratchpad, extraer los bloques `it`/`test` de cada archivo original (`git show c1805be:<ruta>`) y de los nuevos archivos y módulos de soporte, normalizar espacios e imports y comparar. Contar por grupo `expect(`, `expect.poll(`, `rejects`/`toThrow` y `afterEach`/limpiezas, antes y después. Cada diferencia se revisa a mano: mover una ayuda a `tests/support/` es aceptable; perder o relajar una aserción es `DEFECT`.
- **QA-05. CA-7 en detalle.**
  - `last-admin-concurrency` y `-http`: `REPETITIONS = 50` y los casos que lo usan.
  - `db-lock-wait-{usuario,producto,acceso}`: bloqueo real `SELECT … FOR UPDATE` desde otro pool, 503 sin cambios a medias o éxito completo con su registro, la app atendiendo durante el bloqueo, recuperación al liberar, `expectLockWaitBelowHold` y el `wait(1000)` posterior.
  - `db-outage-handshake-*`: los 16 cortes (dirección y byte de corte) idénticos a los del original, sin repetidos ni perdidos; en cada archivo: ningún `unhandledRejection`, solo 200 o 503, al menos un 503, landing en 200, recuperación sola y `database_unavailable` sin secretos ni SQL.
  - Ejecutar cada uno de estos archivos 5 veces seguidas (`npx vitest run <archivos>`) y comprobar en la salida el 503 a los ~5 s.

### Pruebas negativas y casos límite

- **QA-06. Sin `retry`, `skip`, `only`, `todo` ni esperas fijas nuevas (RF-4, RF-7).** `grep` sobre las líneas añadidas del diff de `retry`, `.skip`, `.skipIf`, `.runIf`, `.only`, `.todo`, `.concurrent`, `setTimeout`, `wait(`, `sleep(`; cada coincidencia debe existir en el original (p. ej. `it.skipIf(runningAsRoot())`, `setTimeout(…, 500)`) o ser el acortamiento aprobado (`HOLD_MS`, D-2). El número de `expect.poll` por grupo no baja (QA-04).
- **QA-07. `truncateAll` equivale a vaciar todo.** Con `makeScratchDatabase()` (base `restaurante_test*`): tabla con filas y autoincremento, tabla con filas sin autoincremento, tabla vaciada con `DELETE` pero con el autoincremento avanzado y tabla intacta. Tras `truncateAll`: todas vacías, `AUTO_INCREMENT` en 1 y `isPristine` en verdadero. Se ejecuta como script temporal en el scratchpad (o, si se aprueba O-2, como prueba permanente).
- **QA-16. Inestabilidad con la configuración del CI.** En local, `npm test -- --maxWorkers=4 --shard=1/2` y `--shard=2/2`, 2 veces cada uno, y los archivos de riesgo del punto 4 (`last-admin-concurrency*`, `admin-authorization-matrix-concurrencia*`, `db-lock-wait-*`) 5 veces seguidas en paralelo. Ningún fallo intermitente ni 1205 inesperado.
- **QA-17. Ejecución interrumpida.** Interrumpir `npm test` (SIGINT) a mitad, listar las bases `restaurante_test*` que quedan y comprobar que la siguiente ejecución las limpia como antes.
- **MySQL sin recrear.** Antes de QA-15, `SELECT @@GLOBAL.innodb_lock_wait_timeout` en el MySQL local. Si vale 50, ejecutar primero un `db-lock-wait-*` para comprobar que falla con el mensaje de `expectLockWaitBelowHold` y después `npm run db:up`.

### Pruebas de integración (CI)

- **QA-08. Reparto en shards en local (CA-9).** Por workspace, `npx vitest list --filesOnly` sin shard y con `--shard=1/2` y `--shard=2/2`: unión = lista completa, intersección vacía, ningún shard vacío (api y inventory-manager tienen pocos archivos). Se trabaja por archivos, porque `vitest list` no ve los casos de las funciones de soporte (riesgo 3).
- **QA-09. Reparto en el CI.** De los logs (`gh run view --log`, solo lectura) de 41017410887 (intentos 1 a 3) y 41019188860: archivos y pruebas por shard y por workspace; la suma de ambos shards = 164 archivos y 2485 pruebas, sin archivos repetidos.
- **QA-10. Agregador `calidad`.** Revisión de `needs` e `if`: `calidad` corre aunque `verificacion` o `pruebas` fallen (`!cancelled()`) y falla salvo que ambos sean `success`; `needs.pruebas.result` agrega todos los shards de la matriz; `validado` sigue buscando `calidad`; `publish` sigue dependiendo de `calidad`. Búsqueda en el historial (`gh run list`, `gh api`) de alguna ejecución con un shard o `verificacion` en rojo y `calidad` en rojo. Si no existe, queda como evidencia estática y se indica (no se fuerza un fallo: exigiría commits).
- **QA-11. Protección de rama.** `gh api repos/orvigas/negocio/branches/main/protection` y `gh api repos/orvigas/negocio/rulesets`: las comprobaciones requeridas siguen siendo `calidad`, `docker` y `auditoria`.

### Pruebas de performance

- **QA-12. Medición del CI (CA-1, CA-2, CA-5).** Con `gh api repos/orvigas/negocio/actions/runs/<id>/attempts/<n>/jobs`, recalcular para cada intento el span del paso `test` (del inicio del primer shard al final del último) y el estado de cada job. Ejecuciones: 41017410887 intentos 1 a 3 y 41019188860. Con el mismo método, recalcular la línea base (40987243851, 40985214161 y 40963168457) para comprobar que es la misma métrica. Comprobar que ningún intento tuvo un job relanzado por fallo.
- **QA-13. Archivo más lento (CA-3).** De los logs de cada shard de esas 4 ejecuciones, la duración por archivo del reporter de Vitest; máximo ≤ 20 s.
- **QA-14. Estabilidad de las mediciones.** Recoger, sin relanzar nada, todas las ejecuciones del CI posteriores a `1bbca3b` con `pruebas` (otros PR o pushes a `main`), con su span y su archivo más lento, para ver la dispersión. CA-2 se evalúa tal como está escrito (mediana de 3 ejecuciones); las muestras adicionales se informan. Si la mediana ampliada supera 157,2 s o algún archivo pasa de 20 s, se registra como hallazgo y se devuelve `NEEDS_USER_DECISION`.
- **QA-15. Local (CA-4, CA-8).** Desde `restaurante/`: `npm run typecheck`, `npm run lint`, `npm run build:css` y `npm test` 5 veces seguidas medidas con `time`; las 5 en verde y su mediana ≤ 95 s. Se anota la carga del equipo, porque la medida local depende de ella.

### Pruebas de regresión

- Toda la suite de los tres workspaces en verde (QA-15).
- El código de la app no cambia (QA-01): no hay regresión funcional posible en las landings, `/admin`, la API ni el bot.
- `docker` y `auditoria` sin cambios en `ci.yml` y en verde en las ejecuciones de QA-12.
- **QA-18. Documentación (RF-10).** `restaurante/README.md` (pruebas con base de datos, CI, trabajadores y shards, recrear el MySQL con `npm run db:up`) y `.claude/rules/testing.md` (5 s y duración por archivo) coinciden con `ci.yml`, `compose.yaml` y `lock-wait.ts`, sin documentar nada inexistente.

### Pruebas automatizadas

- Existentes: la suite completa y los archivos de riesgo (QA-05, QA-15 y QA-16).
- No se crean pruebas nuevas salvo que se apruebe O-2.

### Pruebas en navegador

No aplican: no cambia ninguna vista, CSS ni JS del navegador. Responsive, accesibilidad, UX/UI y SEO quedan fuera por el mismo motivo.

### Opcionales (requieren aprobación explícita)

- **O-1. Más muestras del CI.** Relanzar 2 veces el workflow del PR #117 (41017410887, evento `pull_request`: no publica ni despliega) para tener 5 muestras de CA-2 y CA-3. **Nunca** se relanza una ejecución de push a `main` (`publish` y `deploy` correrían). Sin aprobación, solo QA-14.
- **O-2. Prueba permanente de `truncateAll`.** Convertir QA-07 en `restaurante/landing-pages/tests/integration/database-truncate-all.test.ts`, para que la desviación del paso 5 quede cubierta. Sin aprobación, QA-07 se ejecuta como script temporal y se borra.

### Evidencia requerida

- Salidas de `git diff` (QA-01, QA-02, QA-06).
- Inventarios JSON antes y después, y el informe de diferencias por grupo (QA-03, QA-04), en el scratchpad y resumidos en el QA Report.
- Salidas de `vitest list` por shard (QA-08) y conteos de los logs del CI (QA-09).
- Respuestas de `gh api` de protección de rama y de jobs (QA-10 a QA-12).
- Tabla de spans y archivos más lentos (QA-12 a QA-14).
- Tiempos y resultados de las 5 ejecuciones locales, `typecheck` y `lint` (QA-15).

### Criterios de aprobación

- CA-1 a CA-9 en PASS con evidencia propia.
- Ningún caso perdido o con aserciones relajadas (QA-03, QA-04); ninguna diferencia sin explicar en la tabla de RF-4.
- Ningún `retry`, `skip`, `only`, `todo`, espera fija nueva ni plazo de Vitest subido.
- Salvaguarda sin cambios; `calidad`, `docker` y `auditoria` siguen siendo obligatorias y `calidad` no puede quedar en verde con un shard en rojo.
- `npm test`, `typecheck` y `lint` en verde.
- Sin defectos `BLOCKER` ni `CRITICAL`; cualquier `MAJOR` va al usuario (`NEEDS_USER_DECISION`).

## QA Report

### Ronda

1 (Q2, senior-qa, 2026-10-30). Rama `feature/REQ-F-041-archivos-lentos` (`22c1f82`), con el mismo árbol que `origin/main` (`1bbca3b`). La única diferencia es este ticket, sin commit.

### Pruebas ejecutadas

| Prueba | Comando o acción | Resultado |
| ------ | ---------------- | --------- |
| QA-01 | `git diff --name-status c1805be 1bbca3b`; `git diff origin/main HEAD`; hunks de `ci.yml` | Solo `tests/` de landing-pages, `ci.yml`, `compose.yaml`, `README.md`, `testing.md` y el ticket. Ningún cambio en `src/`, `packages/`, `public/`, `deploy/` ni `package.json`. En `ci.yml` cambian solo `verificacion`, `pruebas` y `calidad`. `deploy/compose.prod.yaml` sigue con `--innodb-lock-wait-timeout=10`. |
| QA-02 | `git diff --stat` de `tests/setup/`, `test-database-config.ts`, `test-database-guard.test.ts` y los 3 `vitest.config.ts` | Sin cambios. `--maxWorkers=4` igual que antes. |
| QA-03 | Suite con `--reporter=json`, en `c1805be` (worktree del scratchpad, ya borrado) y en `1bbca3b`, contra el mismo MySQL; se comparan los nombres completos por grupo de RF-4 | api 144 = 144, inventory-manager 111 = 111, landing-pages 2226 → 2230, sin fallos en ninguna de las dos. Los 18 grupos tienen los mismos nombres de caso, salvo `db-outage-handshake` (1 → 5, con el mismo nombre). El "DIFF" de `admin-products-api` es un artefacto del agrupado: `admin-products-api-permissions.test.ts` ya existía y no cambia. Total: 2481 → 2485. |
| QA-04 | Script de comparación de líneas (sin imports ni comentarios) entre los archivos originales y los nuevos con sus módulos de soporte | `expect(` 894 → 894; `expect.poll` 3 → 3; `.rejects` 21 → 21; `toThrow` 3 → 3; `afterEach` 13 → 36 (uno por archivo nuevo). Las 47 líneas que no aparecen en los nuevos son estructurales: listas de cortes, `it.each`/`describe.each` pasados a funciones de soporte, ayudas movidas y el `truncateAll` anterior. No falta ninguna aserción. |
| QA-05 | Revisión de los cortes, `REPETITIONS` y `db-lock-wait-*`; los 12 archivos de riesgo 5 veces seguidas (`npx vitest run db-lock-wait- db-outage-handshake- last-admin-concurrency admin-authorization-matrix-concurrencia`) | Cortes de bajada {4, 40, 78, 90, 110, 140, 200, 400, 1000, 4000} y de subida {4, 40, 100, 200, 400, 1000}: los mismos 16, sin repetir. `expectHandshakeCuts` hace las mismas comprobaciones que el original (líneas 90 a 121), ahora por archivo. `REPETITIONS = 50` en `last-admin-concurrency` y `-http`. Los `db-lock-wait-*` conservan sus aserciones y añaden `expectLockWaitBelowHold`. 5 de 5 en verde (16 pruebas, de 20 a 22 s); `db-lock-wait-*` de 6,6 a 9,2 s; `db-outage-handshake-*` de 12,9 a 15,3 s. |
| QA-06 | `grep` de `retry`, `skip`, `only`, `todo`, `concurrent`, `setTimeout`, `wait(` y `sleep(` en las líneas añadidas y en las quitadas | Cada coincidencia añadida tiene su par quitado, el mismo texto movido: `it.skipIf(runningAsRoot())`, `it.runIf(...)`, `sleep(...)`, `wait(...)`, `setTimeout(…, 500)` y `}, 180_000)`. Lo único nuevo es `HOLD_MS = 6000` (D-2). Ningún `retry` nuevo. |
| QA-07 | Script temporal en el scratchpad (ya borrado) sobre `restaurante_test_qa041_truncate`, migrada y con tablas propias | PASS. Tablas con filas y FK, sin autoincremento, con el autoincremento usado y sin filas, e intactas: todas vacías, el siguiente id vuelve a 1 y `foreign_key_checks` queda en 1. Con la base ya limpia, no falla ni cambia nada. Con las 8 tablas reales con autoincremento en 50: se reinician. Hallazgo: MySQL informa `AUTO_INCREMENT = NULL` en una tabla nunca usada o vaciada con TRUNCATE; `truncateAll` la trata como limpia, que es correcto. |
| QA-08 | `vitest list --shard` no reparte (lista todos los archivos en ambos shards), así que se ejecutaron los shards en local con `--maxWorkers=4 --shard=k/2 --reporter=json`, 2 veces cada uno | Shard 1: 83 archivos; shard 2: 81. Intersección vacía, unión = los 164 archivos del disco, 2485 pruebas y 0 fallos, en las 2 iteraciones. Unos 71 s por shard. |
| QA-09 | Logs de `pruebas (1/2)` y `(2/2)` de 41017410887 (intentos 1 a 5) y 41019188860 | En las 6 ejecuciones: 83 + 81 archivos, intersección vacía, unión = 164 = los archivos del disco, y 1554 + 931 = 2485 pruebas. |
| QA-10 | Revisión de `needs`/`if` de `calidad` y simulación del paso con las 16 combinaciones de `success`, `failure`, `cancelled` y `skipped` | Solo `success/success` termina en 0; las otras 15, en 1. En las 7 ejecuciones medidas, `calidad` empieza después de que terminen los dos shards. `publish` sigue en `needs: [..., calidad, ...]`. El historial no tiene ninguna ejecución con un shard en rojo, así que el caso negativo real no se observó (ver pendientes). |
| QA-11 | `gh api repos/orvigas/negocio/branches/main/protection` y `/rulesets` | Comprobaciones requeridas: `calidad`, `docker` y `auditoria`. No hay rulesets. |
| QA-12 | `gh api .../runs/<id>/attempts/<n>/jobs`: paso `test`, del inicio del primer shard al final del último. O-1: `gh run rerun 41017410887` 2 veces (intentos 4 y 5, evento `pull_request`) | Línea base recalculada: 216, 262 y 273 s (mediana 262 s), la misma métrica. Medición final en la tabla de abajo. Los intentos 4 y 5 terminaron en verde, con `publish`, `vigente` y `deploy` omitidos. |
| QA-13 | Duración por archivo en los logs de Vitest de cada shard | El archivo más lento de cada ejecución está en la tabla de abajo. Máximo: 19,4 s (`server-startup-base`). |
| QA-14 | `gh run list`: ejecuciones posteriores a `1bbca3b` | No hay ninguna más, aparte de 41019188860; las muestras extra son las de O-1. |
| QA-15 | `npm run typecheck`, `npm run lint`, `npm run build:css` y `npm test` 5 veces medidas con `date` | `typecheck` 0, `lint` 0 y `build:css` 0. `npm test`: 5 de 5 en verde (144 + 2230 con 1 *expected fail* + 111), en 99, 92, 93, 90 y 93 s; mediana 93 s. Carga media del equipo de 10 a 15. |
| QA-16 | Shards en local con `--maxWorkers=4` (QA-08) y archivos de riesgo 5 veces (QA-05). Además, con `SET GLOBAL innodb_lock_wait_timeout=50` y después de vuelta a 5 | Ningún fallo intermitente. Con 50 s, `db-lock-wait-acceso` falla con "innodb_lock_wait_timeout del MySQL de pruebas es 50 s; debe ser menor que 6 s. Recrea el contenedor con `npm run db:up`". Valor restaurado a 5 y verificado. |
| QA-17 | SIGINT a `npx vitest run` a los 25 s, en `1bbca3b` y en `c1805be` | En los dos commits quedan las bases de la ejecución, ya migradas: las borraría la limpieza de más de 6 h de `tests/setup/database-global.ts`, que no cambia. Las borré a mano (solo `restaurante_test_<run>_*` de mis ejecuciones). En los dos quedan también procesos hijos `src/server.ts` huérfanos: es igual que antes, no es una regresión. Los terminé. |
| QA-18 | Diff de `README.md` y `testing.md` frente a `ci.yml`, `compose.yaml` y `lock-wait.ts` | Coinciden en los 2 shards, los 4 trabajadores, `calidad` como agregador, el bloqueo de 5 s y la retención de 6 s, `npm run db:up` y que nunca se toca la salvaguarda. |

**Medición del CI (paso `test`, del primer shard al último):**

| Ejecución | Span | Archivo más lento |
| --------- | ---- | ----------------- |
| 41017410887 intento 1 | 154 s | 19,3 s (`inventory-manager-qa-req-f-039-csrf`) |
| 41017410887 intento 2 | 157 s | 18,6 s (`server-startup-base`) |
| 41017410887 intento 3 | 157 s | 19,1 s (`inventory-manager-qa-req-f-039-csrf`) |
| 41017410887 intento 4 (O-1) | 154 s | 18,4 s (`server-startup-base`) |
| 41017410887 intento 5 (O-1) | 148 s | 18,6 s (`inventory-manager-qa-req-f-039-csrf`) |
| 41019188860 (push a `main`) | 156 s | 19,4 s (`server-startup-base`) |

- Mediana de los 3 primeros: **157 s**. Mediana de los 5 intentos del PR: **154 s** (−41,2 %). Mediana de las 6 muestras: **155 s**.
- Umbral de CA-2: 157,2 s. La resolución de la API es de 1 s.

### Criterios de aceptación

- **CA-1: PASS.** La línea base y la medición final usan la misma métrica (QA-12). La recalculé de forma independiente y coincide con el ticket.
- **CA-2: PASS.** La mediana de 3 es 157 s ≤ 157,2 s. Con las 5 muestras del PR, 154 s (QA-12).
- **CA-3: PASS.** Máximo de 19,4 s en 6 ejecuciones (QA-13).
- **CA-4: PASS.** 5 de 5 en verde, con una mediana de 93 s ≤ 95 s (QA-15). La primera tardó 99 s, por encima de los 95; la línea base también se midió como mediana.
- **CA-5: PASS.** 5 intentos del PR seguidos y el push a `main` en verde. Son relanzamientos completos, sin reintentos de pruebas (QA-12, QA-16).
- **CA-6: PASS.** 2481 → 2485, y la diferencia es solo `db-outage-handshake` (QA-03).
- **CA-7: PASS.** 50 repeticiones, los mismos 16 cortes, las mismas comprobaciones y 5 de 5 en verde (QA-05, QA-16).
- **CA-8: PASS.** La salvaguarda no cambia y `typecheck` y `lint` terminan en 0 (QA-02, QA-15).
- **CA-9: PASS.** Partición exacta, en local y en el CI, y `calidad` solo queda en verde con todo en verde (QA-08 a QA-11).

### Defectos encontrados

Ninguno.

**Observaciones** (no son defectos: no incumplen ningún criterio):

1. **Pauta de 15 s.** `testing.md` y el README piden archivos de "unos 15 s" o menos. En el CI hay 6 que pasan de 16 s (`server-startup-base`, `inventory-manager-qa-req-f-039-csrf`, `dependency-rule-apps`, `dependency-rule-paquetes`, `server-startup-config` y `api-process`). El criterio del ticket es 20 s y se cumple.
2. **Shards desequilibrados.** El shard 1 manda en el span (148 a 157 s) y el shard 2 tarda de 112 a 149 s. El margen de CA-2 depende de ese shard.
3. **Huérfanos ajenos al ticket.**
   - Un SIGINT deja procesos hijos `src/server.ts` vivos; ocurre igual en `c1805be`.
   - Hay un proceso huérfano del 2026-10-29 (pid 56231, `../api/src/server.ts`) que no es de este QA y no toqué.
   - Hay 3 bases vacías `restaurante_test_da0302_*`, del 2026-10-14, que la limpieza de más de 6 h no borra porque no tienen `_prisma_migrations`.
4. **Protección de `main`.** Tiene `enforce_admins: false`: un administrador puede mergear sin esperar las comprobaciones, como pasó con el #116 y el #117. Es una configuración previa, fuera de alcance.
5. **Nombre del job omitido.** Cuando `pruebas` se omite en un push a `main`, su nombre aparece sin expandir. Es cosmético y ya lo había anotado el desarrollador.

### Regresión

- La suite completa pasa en local (5 veces) y en el CI (6 ejecuciones).
- `docker` y `auditoria` no cambian y quedan en verde en los intentos 4 y 5.
- El código de la app no cambia, así que no hay regresión funcional posible.

### Responsive

No aplica: no cambia ninguna vista.

### Accesibilidad

No aplica: no cambia ninguna vista.

### UX/UI

No aplica: no cambia ninguna vista.

### Performance

Ver QA-12 a QA-15:

- CI: −40,1 % con la mediana de 3 y −41,2 % con la de 5.
- Local: mediana de 93 s frente a 95 s.

### SEO

No aplica: no cambia ninguna vista.

### Pendientes de revisión manual

- El caso negativo del agregador (un shard en rojo deja `calidad` en rojo) solo está comprobado de forma estática y simulando el paso (QA-10). No hay ninguna ejecución real con un shard fallido, y provocarla exigiría commits.
- Ningún criterio depende solo de esto: CA-9 también queda cubierto por la partición comprobada.

### Resultado final

QA_APPROVED

## Historial de cambios

### Versión 1

Descripción inicial. Aprobada por el usuario el 2026-10-29 con la cita textual: "Si y ya están mergeado".

### Revisión técnica (T1)

2026-10-29, senior-fullstack: línea base medida (CI: mediana de 262 s del paso `test`; local: mediana de 95 s), revisión técnica con 9 hallazgos y Technical Action Plan propuesto. Quedan pendientes las decisiones D-1 (medición del CI antes de QA), D-2 (`innodb_lock_wait_timeout` del MySQL de pruebas) y D-3 (reparto del CI). Estado: `NEEDS_TECHNICAL_CLARIFICATION`.

### Implementación (T2)

2026-10-29/30, senior-fullstack: implementado el plan con D-1 a, D-2 a y D-3 a. PR #116 abierto antes del QA (D-1).
- El usuario lo mergeó en `main` ("Pr mergeado", merge `e71a1e2`, 2026-10-30 02:56:38 UTC) antes del QA y de las 3 mediciones; se publicó y se desplegó.
- El commit `8a1976b` (cinco archivos más partidos) quedó en la rama, fuera de `main`.
- Mediciones: 1 de 3 en el CI (153 s, −41,6 %; archivo más lento, 36,6 s) y 5 de 5 en local (mediana 94 s).

Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

### Implementación aprobada y PR #117

2026-10-30, senior-fullstack: el usuario aprobó la implementación ("Sí, apruebo") y pidió QA ahora ("Sí, QA ahora (Recomendado)") y un PR nuevo para `8a1976b` ("PR nuevo a main (Recomendado)").
- PR #117, mergeado por el usuario (`1bbca3b`) durante el intento 3; se publicó y se desplegó.
- 3 mediciones del CI: 154, 157 y 157 s (mediana de 157 s, −40,1 %); el archivo más lento, 19,3 s como máximo.
- Push a `main`: 156 s y 19,4 s.
- Listo para QA.

### QA Action Plan (Q1)

2026-10-30, senior-qa: QA Action Plan sobre `main` (`1bbca3b`), con 18 pruebas (QA-01 a QA-18) y 2 opcionales (O-1: 2 relanzamientos más del CI del PR #117; O-2: prueba permanente de `truncateAll`). Estado corregido de "IMPLEMENTATION_APPROVED (pendiente de QA)" a un estado válido. Estado: `NEEDS_QA_PLAN_APPROVAL`.

### QA (Q2), ronda 1

2026-10-30, senior-qa: plan aprobado ("Sí, apruebo el plan"), con O-1 ("Sí, 2 relanzamientos (Recomendado)") y O-2 ("Script temporal (Recomendado)").
- Se ejecutaron QA-01 a QA-18. Hubo 2 relanzamientos del CI del PR #117 (intentos 4 y 5: 154 y 148 s, en verde, sin publicar ni desplegar).
- Ningún defecto y 5 observaciones.
- El worktree y el script temporal se borraron; no hay commits ni push.

Estado: `QA_APPROVED`.

### Cierre

2026-10-30, senior-fullstack: el código ya está en `main` y desplegado.
- PR #116 (merge `e71a1e2`): shards del CI, `calidad` como agregador, la espera de bloqueo de 5 s y los archivos partidos.
- PR #117 (merge `1bbca3b`): los cinco archivos que pasaban de 17 s.
- QA: `QA_APPROVED`, sin defectos.
- El ticket pasa a `done/`. Estado: `DONE`.
