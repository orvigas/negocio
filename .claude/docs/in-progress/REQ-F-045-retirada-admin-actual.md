# REQ-F-045 — Retirada del `/admin` actual de `landing-pages`

## Estado

READY_FOR_MERGE (PR 2 de 3)

- PR 1: #156 (https://github.com/orvigas/negocio/pull/156), mergeado en `epic/arquitectura` (`425e21a`).
- PR 2: #157 (https://github.com/orvigas/negocio/pull/157), hacia `epic/arquitectura`, commit `69c0c7e`. Abierto como borrador y marcado listo tras el último push; el resultado del CI con el PR listo (`calidad`, `docker`, `auditoria` y `pruebas`) queda en el informe del PR.

## Aprobación

Aprobado por el usuario (versión 1, fecha 2026-11-16). Cita textual: "apruebo", en respuesta a la presentación del requisito (resumen, RN-1 a RN-8, CA-1 a CA-14 y Action Plan de tres PR) con la pregunta "¿Lo apruebas?".

Decisiones previas del usuario (2026-11-16). Cita textual: "asume las recomendadas", en respuesta a las preguntas P1 a P8 con la opción recomendada en cada una. Se eligió la opción A en todas; quedan recogidas en las reglas RN-1 a RN-8.

Paso 4, ticket 6 del plan de migración (`restaurante/docs/arquitectura.md` §8, "Plan del paso 4 (REQ-F-039)"). Los PR de este ticket van a `epic/arquitectura` (`.claude/rules/git.md`).

### Autorización para `.claude/CLAUDE.md`

Autorizada por el usuario (2026-11-16) la actualización de `.claude/CLAUDE.md` §8, solo esa sección, para quitar "En transición, contiene también `/admin` y la importación única de la página desde los JSON al arrancar". La autorización iba dentro de la respuesta "asume las recomendadas" (P8 A). El cambio lo hace `senior-fullstack` dentro de la implementación (PR 2).

## Objetivo

Que solo haya un admin, `inventory-manager` (`admin.birriaelmuneco.com`), y que `landing-pages` sirva las landings sin tocar MySQL ni `DATA_DIR`. `npm run lint` debe impedir que la administración vuelva a `landing-pages`.

**Actores:**
- administrador y editor (con marcadores antiguos de `/admin`);
- operador del VPS (despliegue, vuelta atrás, respaldos y recuperación del acceso);
- visitante de las landings (su HTML no cambia).

## Hechos

### [Usuario] (2026-11-16)

- "asume las recomendadas" (P1 a P8, opción A) y "apruebo".
- REQ-F-044 está en `done/` (#149 y #150 mergeados). `epic/arquitectura` = `main` = `8abdff9`.

### [Producción] (transmitido por la sesión principal; no verificado por el BA)

- REQ-F-042, REQ-F-043 y REQ-F-044 están desplegados.
- `page_import` tiene 2 filas (molotes y birria, `source=current`).
- `app-data` conserva `current.json`, `previous.json` y `changes.jsonl`.
- `ADMIN_NEW_URL` está fijado en `deploy/compose.prod.yaml`. El `/admin` actual está en solo lectura: sus POST responden 410.

### [Repo] Qué usa `landing-pages` de los paquetes (CodeGraph y Grep de imports)

**`@restaurante/db`** solo lo importan:
- `src/server.ts`: `client`, `verify`, `prisma-bot-control-store`, `prisma-page-store`, `prisma-product-store` y `user-repository`;
- `src/config/env.ts`: `database-config`;
- `scripts/admin-recover.ts`.

Ningún archivo de las landings lo usa.

**`@restaurante/core/identity`** lo usan:
- todo el código de `/admin`: `controllers/admin*.ts`, `middleware/admin-guard.ts`, `views/admin/*` y `services/admin-bootstrap.ts`;
- `app.ts` (sesiones, límite de intentos y autenticador);
- `env.ts` (validación de `ADMIN_USER`/`ADMIN_PASSWORD_HASH`);
- `scripts/admin-recover.ts` y `scripts/hash-password.ts`;
- **además, `src/internal-app.ts`, que se conserva.** Importa `safeEqualStrings` para comparar la credencial del aviso en tiempo constante.

**`@restaurante/core/bot-control`** solo lo usan `server.ts`, `app.ts`, `env.ts` (`parseBotKeys`, `parseBotLimits`, `parseBotPanel`), `controllers/admin.ts`, `controllers/admin-bot.ts` y `views/admin/bot.ts`.

**`@restaurante/core/catalog`:**
- **Se conservan las funciones puras:**
  - `services/landing-page.ts` (`mergePageData`, `pickPageData`, `validateMenuDocument` y tipos);
  - `services/landing-products.ts` (tipo `MenuDataByBusiness`);
  - `views/landings/index.ts`;
  - `views/landings/shared.ts` (`formatPesos`);
  - `views/landings/birria.ts`.
- **Lo demás es persistencia o `/admin`:**
  - `createPageRepository` y `createProductRepository` en `server.ts`;
  - los tipos `ProductRepository` y `PageRepository` en `app.ts` y `routes/index.ts`;
  - `admin-guard`, `admin-products`, `admin`, `admin-business-view`, `admin-products-api`, `admin-form`, `product-form`, `views/admin/*`, `repositories/menu-repository.ts` y `services/page-import.ts`.

### [Repo] Qué cae en `landing-pages/src`

- `routes/admin.ts` y `routes/admin-api.ts` (incluida la API JSON `/admin/api` de REQ-F-008);
- `controllers/admin*.ts` (10 archivos);
- `middleware/admin-guard.ts`;
- `services/admin-bootstrap.ts`, `admin-form.ts`, `product-form.ts` y `page-import.ts`;
- `views/admin/*` (4 archivos);
- `repositories/file-menu-repository.ts`, `memory-menu-repository.ts` y `menu-repository.ts`;
- en `app.ts`, las dependencias `users`, `pages`, `products` y `botControl` y la puerta `createAdminGate`.

### [Repo] Qué se conserva

- **El aviso interno.** `createInternalApp` atiende `/internal/v1/productos-cambiados` en el puerto 3002 con la credencial `RESTAURANTE_INTERNAL_NOTIFY_TOKEN`. Solo invalida `landingProducts` y `landingPage` y confirma su frescura. No depende de `/admin`.
- **Las landings:** `controllers/landing.ts`, `controllers/icons.ts`, `services/landing-cache.ts`, `landing-page.ts` y `landing-products.ts`, `content/`, `views/landings/` y `middleware/error-handler.ts` y `request-logger.ts`. `landing.ts` ya declara: "Nunca la base de datos, un repositorio ni los JSON de DATA_DIR".

### [Repo] Arranque actual de `landing-pages` (`src/server.ts`)

1. `verifyDatabase`.
2. `pageStore.hasProductImports()`, para saber si la instalación ya existía.
3. `createFileMenuRepository(...).init({ seedMissing })`.
4. `importPages`.
5. `products.init({ getStartupSource })`, que siembra los productos en una instalación nueva.
6. `bootstrapAdmin`, el primer administrador (`ADMIN_USER`/`ADMIN_PASSWORD_HASH`).
7. `createBotControl` para `/admin/bot`.

Hoy `api` no prepara una instalación nueva: llama a `products.init()` sin fuentes y no crea el primer administrador. `despliegue.md` §1 lo confirma: "nunca migra ni importa semillas".

### [Repo] Scripts

- `admin:recover` y `admin:hash-password` se definen en `landing-pages/package.json`. La raíz (`restaurante/package.json`) los reenvía con `-w landing-pages`.
- `admin-recover.ts` usa `db` y `core/identity`. `hash-password.ts` solo usa `core/identity` (no toca la base).

### [Repo] Lint

`restaurante/eslint.config.ts:351` tiene el comentario "REGLA DE TRANSICIÓN — TEMPORAL" para `/admin`.

### [Repo] Deploy y operación

- **`deploy/compose.prod.yaml`:**
  - `app` recibe `DATA_DIR`, `DATABASE_URL`, el volumen `app-data` y las variables `WHATSAPP_BOT_*` (P-2 de REQ-F-042, "hasta el ticket 6");
  - define el router `restaurante-admin`, con un límite de 10 peticiones por minuto y ráfaga de 20.
- **Vuelta atrás automática:** `deploy.sh` usa el compose vigente con los digests anteriores. Por eso la app anterior necesita esas variables y ese volumen para arrancar.
- **CSP:** es global (`helmet`, con `frame-src` solo para Google Maps) y no tiene nada propio de `/admin`.
- **`deploy/ci/smoke.sh`:**
  - `:328-331` espera un 429 en `/admin/login`;
  - `:402-404` espera el 503 `ADMIN_UNAVAILABLE`.
- **`ops/backup`:**
  - `backup.sh` falla si `app-data` no tiene `molotes/` y `birria/`;
  - `verify-backup.sh` exige un JSON en cada carpeta y su `--drill` arranca la app del respaldo con ese `app-data`;
  - `restore.sh` y `lib.sh` exigen `app-data.tar`;
  - `ops/backup/ci/smoke.sh` escribe y restaura `app-data`.

### [Repo] Pruebas de `landing-pages/tests` (125 archivos)

**Caen con `/admin`** (prueban solo lo retirado):
- `integration/admin-*.test.ts`, incluidos los `*-moved`, `admin-bot*`, `admin-e2e` y `admin-recover*`;
- `users-api-qa-req-f-040*.test.ts` y `users-api-process.test.ts`;
- `bot-pantalla-qa-req-f-043-*.test.ts`, `bot-protection-qa-req-f-025.test.ts` y `unit/bot-control-qa-req-f-043.test.ts`;
- `unit/admin-form`, `product-form`, `promo-form`, `file-menu-repository`, `menu-repository-contract` y `page-import`;
- sus soportes: `support/admin*.ts`, `admin-products-*.ts`, `admin-recover.ts`, `admin-authorization-matrix.ts`, `admin-bot-qa-req-f-043-proceso.ts`, `bot-pantalla-qa-req-f-043.ts`, `users-api-*.ts` y `database-admin.ts`.

**Pasan a `api`, adaptadas** (cambia dónde viven; no se añaden):
- `last-admin-concurrency.test.ts`: `testing.md` obliga a conservarla. En `api/tests` no hay un equivalente con concurrencia.
- `unit/admin-bootstrap.test.ts`.
- `admin-recover*.test.ts`.
- Lo de `server-startup-base.test.ts` sobre "no arranca con una base inválida": también es obligatoria.

**Se modifican:** `server-startup*.test.ts`, `config.test.ts`, `db-outage.test.ts` (o se retira si solo probaba la base de `landing-pages`) y `tests/helpers.ts`.

**Se conservan, porque protegen las landings:**
- `landing-*`, `home-notice`, `footer-cross-link`, `icons`, `render`, `content`, `whatsapp`;
- `business-schedule`, `business-hours`, `birria-veracity`, `variant-selector`, `visible-menu`, `price`, `datetime`;
- `image-checker`, `internal-app`, `internal-notify-process`, `api-process`, `public-client`, `request-logger`, `audit-policy` y `landing-products*`.

**Prueban paquetes (`core` y `db`), no `/admin`, y se conservan:**
- `product-repository-contract-*`, `product-repository-reload`, `prisma-page-store`, `user-repository`, `bot-control-store`;
- `db-text-roundtrip`, `db-verify`, `migrations-collation`, `session-store`, `login-throttle`;
- `menu-schema`, `product-schema`, `user-schema`, `unit/admin-auth` (prueba `core/identity`) y `test-database-guard`.

Pueden seguir en `landing-pages/tests`, con la infraestructura de MySQL de pruebas, o moverse con ella sin cambiar los casos. Lo decide `senior-fullstack`.

### [Inferencia]

- La clasificación de las pruebas sale de los nombres y de CodeGraph. `senior-fullstack` la confirma archivo a archivo.
- Ningún cliente externo usa `/admin/api`.
- No hay enlaces públicos a `/admin`, solo los marcadores del personal.

## Alcance

- Retirar `/admin` y `/admin/api` de `landing-pages`, con redirección al admin nuevo.
- Landings sin MySQL ni `DATA_DIR`.
- Instalación nueva, primer administrador, `admin-recover` y `hash-password` en `api`.
- Retirar la importación desde JSON y el repositorio de menús por archivo.
- Activar la regla de lint de `/admin`.
- Retirar las pruebas de `/admin` y trasladar las obligatorias.
- Limpiar `deploy/` y `ops/` en una segunda etapa: compose, variables, router y límite de `/admin`, respaldos y `smoke.sh`.
- Documentación, incluida `.claude/CLAUDE.md` §8.

## Fuera de alcance

- Propuestas: adelgazar la imagen de `landing-pages` (sin Prisma ni `packages/db`), sacar `app` de la red `db` y retirar el refresco de 10 s del control del bot (RF-11 de REQ-F-043).
- Borrar el volumen `app-data` o los respaldos antiguos.
- Mover de sitio las pruebas de los paquetes, salvo lo que exija retirar `/admin`.
- Horarios y avisos como endpoints públicos.
- Cambios en las pantallas del admin nuevo.

## Reglas de negocio

- **RN-1 (P1).** GET y HEAD de `/admin` y `/admin/*` responden 302 a la raíz de `ADMIN_NEW_URL`, sin mapa de rutas, de forma indefinida. Cualquier otro método responde 410. Sin `ADMIN_NEW_URL` (en local), `/admin*` responde 404.
- **RN-2 (P2).** La instalación nueva la prepara `api` al arrancar, una sola vez. En una instalación existente nunca publica la semilla en silencio (D-10 de REQ-F-044).
- **RN-3 (P3).** La recuperación por consola y el hash de contraseñas se ejecutan en `api`.
- **RN-4 (P4).** MySQL es la única fuente de la página: no se reimporta desde los JSON. Se documenta el efecto de restaurar un respaldo anterior al 2026-11-16.
- **RN-5 (P5).** Tras la limpieza, los respaldos nuevos no incluyen `app-data`. Restaurar y verificar aceptan los dos formatos. El volumen queda en el VPS sin montar y sin borrar.
- **RN-6 (P6).** Dos etapas: primero el código, sin quitar nada de `deploy/` ni de `ops/`. La limpieza solo empieza con la confirmación del usuario de que producción está estable.
- **RN-7 (P7).** En la limpieza se quitan el router `restaurante-admin` y su límite.
- **RN-8 (P8).** Tres PR a `epic/arquitectura`; la épica llega a `main` entre el PR 2 y el PR 3. Se actualiza `.claude/CLAUDE.md` §8 (autorizado).

## Requisitos

- **RF-1 `/admin` retirado.** `landing-pages` no sirve ninguna pantalla, API, login ni sesión de administración. Se cumple RN-1. Las respuestas de `/admin*` no ponen ni leen cookies de sesión. El 410 no lee el cuerpo ni escribe nada.
- **RF-2 Landings sin base ni `DATA_DIR`.** `landing-pages` arranca y sirve las landings sin `DATABASE_URL` ni `DATA_DIR`. Si las recibe, las ignora: no las valida ni falla por ellas. Mismo HTML y mismas reglas de caché: 60 s, un vuelo por negocio, última copia buena y semilla.
- **RF-3 Aviso interno conservado.** `/internal/v1/productos-cambiados` se comporta igual: credencial, 404 fuera de esa ruta, invalidación, `products_change_notified` y comparación de la credencial en tiempo constante.
- **RF-4 Instalación nueva en `api` (RN-2).** Con la base vacía y migrada:
  - importa los productos de la semilla;
  - crea la página de cada negocio con la semilla;
  - crea el primer administrador con `ADMIN_USER`/`ADMIN_PASSWORD_HASH`, que ahora recibe `api`.

  Es idempotente. Con usuarios ya creados y las variables presentes, solo deja un aviso, sin los valores. Sin usuarios ni variables, `api` arranca igual y el admin nuevo no deja entrar hasta que se use `admin-recover`.
- **RF-5 Recuperación en `api` (RN-3).**
  - `npm run admin:recover -- --usuario <nombre>` y `docker compose exec api node scripts/admin-recover.ts --usuario <nombre>` crean o recuperan el administrador, cierran sus sesiones y lo registran en la auditoría como `console_recovery`.
  - El mensaje final remite al admin nuevo.
  - `npm run admin:hash-password` funciona igual.
  - Los alias de la raíz se conservan, apuntando a `api`.
- **RF-6 Importación desde JSON retirada (RN-4).** Desaparecen la importación única, el repositorio de menús por archivo y la lectura de `changes.jsonl` y de `DATA_DIR`.
- **RF-7 Regla de lint.**
  - Se elimina la regla de transición.
  - `npm run lint` rechaza en `landing-pages/src` y `scripts` cualquier import de `@restaurante/db`, Prisma, `mariadb`, `core/bot-control`, `core/identity` y la persistencia de `core/catalog`. Las funciones puras de `core/catalog` siguen permitidas.
  - La comparación de la credencial de `internal-app` sigue siendo de tiempo constante sin abrir una excepción general a `core/identity`. Cómo se resuelve lo decide `senior-fullstack`.
  - Se comprueba a mano con un import de prueba que no se commitea.
- **RF-8 Vuelta atrás durante la etapa de código (RN-6).** Hasta el PR 3, el compose sigue pasando a `app` `DATABASE_URL`, `DATA_DIR`, el volumen `app-data` y las variables del bot, y conserva el router `restaurante-admin`.
- **RF-9 Limpieza de `deploy/` y `ops/` (PR 3; RN-5 y RN-7).**
  - **Compose:**
    - se quitan de `app` `DATABASE_URL`, `DATA_DIR`, el montaje de `app-data` y las `WHATSAPP_BOT_*`;
    - se quitan el router `restaurante-admin` y su límite;
    - `api` recibe `ADMIN_USER`/`ADMIN_PASSWORD_HASH`, si no los recibió ya en el PR 1.
  - **`env.production.example`** se actualiza.
  - **Respaldos:** `backup.sh` deja de leer y exigir `app-data`. `restore.sh` y `verify-backup.sh` aceptan respaldos con y sin `app-data`. El `--drill` y `ops/backup/ci/smoke.sh` se adaptan.
  - **`deploy/ci/smoke.sh`** comprueba el 302 y el 410 en lugar del 429 y el 503.
  - **`despliegue.md` §6** documenta cómo volver a una versión anterior a este ticket tras la limpieza: un revert en `main` o el compose del commit anterior.
- **RF-10 Documentación.**
  - PR 2: `restaurante/README.md` ("Recuperar el acceso"), `docs/desarrollo.md` §3 y §4, `docs/arquitectura.md` (§1, §4, §6, §8 con el paso 4 completo, §10) y `.claude/CLAUDE.md` §8.
  - PR 3: `docs/despliegue.md` §1, §3, §4, §5, §6 y §11.
  - Se documenta el efecto de RN-4 al restaurar un respaldo anterior al 2026-11-16.

## Historias de usuario

- Como administrador con un marcador antiguo de `/admin`, quiero llegar al admin nuevo, para no encontrarme una página rota.
- Como operador, quiero que una instalación nueva y la recuperación del acceso funcionen sin `/admin`, para no quedarme sin administración.
- Como operador, quiero que un despliegue fallido vuelva solo a la versión anterior, para no tener que recuperar a mano.
- Como equipo, queremos que el lint impida devolver la administración a `landing-pages`, para mantener la arquitectura.

## Criterios de aceptación

- **CA-1.** Given producción con `ADMIN_NEW_URL`, when se pide GET o HEAD de `/admin`, `/admin/login?x=1`, `/admin/bot` o `/admin/api/molotes/productos`, then responde 302 con `Location` igual a la raíz del admin nuevo y sin `Set-Cookie`.
- **CA-2.** Given cualquier `/admin*`, when llega un POST, PUT, PATCH o DELETE (con o sin cuerpo), then responde 410 y la base no cambia.
- **CA-3.** Given `landing-pages` sin `ADMIN_NEW_URL`, when se pide `/admin`, then responde 404.
- **CA-4.** Given `landing-pages` arrancado sin `DATABASE_URL` ni `DATA_DIR` (o con ellas presentes), when se visitan `/`, `/molotes` y `/birria` los siete días (`?dia=` en desarrollo), then el HTML es el mismo que antes del ticket, y el arranque no conecta con MySQL ni abre `DATA_DIR`.
- **CA-5.** Given una escritura de productos o de página en el admin nuevo, when termina, then el log de `app` registra `products_change_notified` con `landing:true` y la landing muestra el cambio. Given un aviso sin credencial o con una incorrecta, then responde 401 y nada cambia.
- **CA-6.** Given una base vacía y migrada con `ADMIN_USER`/`ADMIN_PASSWORD_HASH` en `api`, when arranca `api`, then hay productos y página de la semilla en los dos negocios, y ese administrador entra en el admin nuevo. Given un segundo arranque, then no se duplica ni cambia nada.
- **CA-7.** Given una instalación existente, when arranca `api`, then no importa la semilla ni crea usuarios. Si faltan las filas de página, la página responde "no disponible".
- **CA-8.** Given `api` en marcha, when se ejecuta `admin-recover --usuario X` en el contenedor `api`, then se crea o recupera el administrador, se cierran sus sesiones y queda `console_recovery` en la auditoría. Given la desactivación del último administrador en paralelo con la recuperación, then nunca quedan cero administradores (la prueba de concurrencia, conservada en `api`).
- **CA-9.** Given `api` con una base inválida, when arranca, then termina con un código distinto de 0 y un mensaje sin detalles técnicos (la prueba obligatoria, conservada en `api`).
- **CA-10.** Given un archivo de `landing-pages/src` que importa `@restaurante/db`, `core/identity` o `core/bot-control`, when se ejecuta `npm run lint`, then falla. Given el árbol real, then termina con 0.
- **CA-11.** Given el despliegue del PR 2 con una app nueva que no arranca, when `deploy.sh` vuelve a los digests anteriores, then la app anterior arranca con el compose vigente.
- **CA-12 (PR 3).** Given la limpieza desplegada, when corre `backup.sh`, then el respaldo no incluye `app-data` y pasa la integridad. Given un respaldo antiguo con `app-data` y uno nuevo sin él, when se ejecutan `verify-backup.sh` y `restore.sh`, then aceptan los dos. Given el VPS, then el volumen `restaurante_app-data` sigue existiendo y no lo monta ningún servicio.
- **CA-13 (PR 3).** Given producción tras la limpieza, when se hacen 30 peticiones en paralelo a `/admin/login`, then ninguna responde 429 (todas 302) y `/molotes` responde 200.
- **CA-14.** `npm run typecheck`, `npm run lint` y `npm test` en `pass`. No queda en `landing-pages/src` ni en `landing-pages/scripts` ninguna referencia a `DATA_DIR`, `DATABASE_URL`, `ADMIN_USER` ni `admin-recover`.

## Casos límite

- **Vuelta atrás:**
  - Tras el PR 2, la app anterior vuelve con `/admin` en solo lectura (RF-8). Su importación encuentra la marca y no reimporta. Con los JSON congelados, ni siquiera registra `page_json_diverged`.
  - Tras el PR 3, la app anterior ya no arranca con el compose nuevo: se vuelve con un revert en `main` o con el compose del commit anterior (`despliegue.md` §6).
- **Enlaces y marcadores antiguos:** como la redirección es temporal (302), una vuelta atrás no queda tapada por la caché del navegador.
- **Respaldos antiguos con `app-data`:** se siguen aceptando. Uno anterior al 2026-11-16 restaura la base sin filas de página. La pantalla "Página" queda "no disponible" y las landings muestran la semilla (precio del hero de $195 en Birria y $145 en Molotes) hasta que se corrija a mano en "Página". Queda documentado.
- **CSP:** no cambia.
- **Límite de peticiones:** sigue hasta el PR 3. Después, `/admin` queda bajo el router general; el 302 no tiene coste.
- **`admin-recover` con la base caída o sin migrar:** el mismo mensaje sin detalles técnicos que hoy.
- **Sesiones abiertas del `/admin` viejo:** se pierden con el despliegue, como en cualquier despliegue.
- **Instalación nueva sin `ADMIN_USER`:** `api` arranca, el admin nuevo no deja entrar y se recupera con `admin-recover`.
- **Sin JavaScript:** no aplica (redirección por HTTP).

## Dependencias

- REQ-F-044 en `done/` (cumplido).
- El PR 3 depende de que el PR 2 esté desplegado (la épica en `main`) y de la confirmación del usuario de que producción está estable.

## Riesgos

- **Una instalación nueva incompleta** si RF-4 falla. Mitigación: el `smoke.sh` del CI parte de una base vacía (en el PR de la épica a `main`).
- **Perder la vuelta atrás automática** si la limpieza se adelanta. Mitigación: RN-6.
- **Restauraciones antiguas sin página.** Aceptado (RN-4) y documentado.
- **Que el lint rompa `internal-app`** al prohibir `core/identity` entero. Lo resuelve RF-7.
- **Dos arranques que siembran durante el PR 1** (`landing-pages` y `api`). Los dos deben ser idempotentes y seguros en paralelo; lo comprueba `senior-fullstack`.

## Action Plan

**Objetivo y alcance:** RF-1 a RF-10.

**Cambios por PR**, todos hacia `epic/arquitectura`:

1. **PR 1, arranque en `api`:**
   - instalación nueva (RF-4);
   - `admin-recover` y `hash-password` en `api`, con los alias de la raíz apuntando a `api` (RF-5);
   - `ADMIN_USER`/`ADMIN_PASSWORD_HASH` llegan a `api` en el compose (un cambio de `deploy/` que añade y no quita nada, compatible con RF-8);
   - se trasladan las pruebas de concurrencia del último administrador, del primer administrador, de la recuperación y de "no arranca con base inválida".

   `landing-pages` no cambia todavía.
2. **PR 2, retirada:**
   - RF-1, RF-2, RF-3, RF-6 y RF-7;
   - se borran el código y las pruebas de `/admin`;
   - una sola prueba nueva, en proceso: 302, 410 y 404 de `/admin*`;
   - la documentación de código y `.claude/CLAUDE.md` §8 (RF-10);
   - **el compose no cambia** (RF-8).
3. **La épica llega a `main`** con su CI y su `smoke.sh`. Se despliega y se comprueban en el VPS CA-1, CA-2, CA-4, CA-5, CA-8 y CA-11.
4. **PR 3, limpieza** (RF-9), solo con la confirmación del usuario de que producción está estable:
   - compose, `env.production.example`, respaldos, los dos `smoke.sh` y `despliegue.md`;
   - después, la épica vuelve a `main` y se comprueban CA-12 y CA-13.

**Integraciones:** Traefik (router de `/admin`, en el PR 3), R2 y los respaldos (PR 3), y el aviso interno `api` → `app`, que no cambia.

**Pruebas** (`.claude/rules/testing.md`):
- las de `/admin` se retiran;
- las obligatorias se trasladan;
- las del arranque se modifican;
- la única nueva es la de la redirección y el 410;
- las comprobaciones de la mudanza (arranque sin base, vuelta atrás, respaldos y lint a mano) son de QA y se descartan, y su resultado queda en el ticket.

**Limpieza al terminar:** sin bases `restaurante_test*` sobrantes, procesos ni worktrees.

**Resultado esperado:** un solo admin, landings sin base ni `DATA_DIR`, un lint que lo impone, instalación nueva y recuperación operativas en `api`, una vuelta atrás segura y respaldos coherentes.

## Trazabilidad

- Objetivo → RF-1, RF-2, RF-6, RF-7 → historias 1 y 4 → CA-1 a CA-4, CA-10, CA-14 → PR 2.
- Instalación y recuperación → RF-4 y RF-5 → historia 2 → CA-6 a CA-9 → PR 1.
- Operación → RF-8 y RF-9 → historia 3 → CA-11 a CA-13 → PR 2 y PR 3.
- Frescura de las landings → RF-3 → CA-5.
- Diseño: no aplica. `_stich_source_/` no tiene nada de administración y las landings no cambian de HTML.

## Revisión técnica

Revisión del 2026-11-15 sobre `main` = `epic/arquitectura` = `8abdff9`, sin cambios de código. Exploración con CodeGraph (`codegraph_explore`) y lecturas dirigidas de lo que no indexa (compose, `deploy.sh`, `smoke.sh`, `ops/backup`, Dockerfile, `despliegue.md`). NotebookLM: sus herramientas MCP no estaban expuestas en esta sesión; no se consultó.

El requisito es viable. Ningún punto bloquea, pero hay **seis correcciones técnicas** sobre el Action Plan del BA y **cuatro decisiones** que se proponen con su recomendación (al final).

### Hallazgos que corrigen el Action Plan

1. **Las semillas no están al alcance de `api`.** Viven en `landing-pages/src/content/<negocio>/seed.json` (`content/seeds.ts`). `api` no puede importar otra app (lint) y su imagen no copia ese directorio. Además, `api/tests/fixtures/seeds/*.json` es una copia idéntica (verificado con `cmp`). **Decisión técnica:** en el PR 1 se mueven con `git mv`, sin cambiar su contenido, a `packages/core/catalog/seeds/{molotes,birria}.json`. `core/catalog` gana `loadSeedDocument(business): unknown` y `SEED_FILES` (lectura con `node:fs`, que la regla de `core` permite), y `landing-pages/src/content/seeds.ts` las reexporta. La imagen de `api` ya copia `packages/core` entero. Alternativa descartada: copiar `landing-pages/src/content` en la imagen de `api`, que acopla dos apps por ruta y el lint no lo vería.
2. **La siembra doble no es segura en paralelo con el código actual** (punto (c), abajo). Hay que hacerla tolerante en el PR 1. La prueba existente `api-process.test.ts` ("CA-10 (O-1): arranque simultáneo…") afirma hoy que la `api` **nunca** importa (`products_imported` ausente), así que se modifica en el PR 1.
3. **Los dos `smoke.sh` del CI fallarían en el PR de la épica a `main` si esperan al PR 3:**
   - `deploy/ci/smoke.sh:402-404` espera el 503 `ADMIN_UNAVAILABLE` en `/admin/login`; tras el PR 2 la respuesta es un 302. El 429 de `:328-331` sigue siendo válido hasta el PR 3, porque el router `restaurante-admin` se conserva (RF-8).
   - `ops/backup/ci/smoke.sh:169-171` exige que la app haya escrito `molotes/*.json` en `app-data`. Tras el PR 2 la app ya no escribe nada ahí, y `backup.sh` y `verify-backup.sh` fallarían en una instalación desde cero.

   Las dos son pruebas del CI, no `deploy/` ni operación: se ajustan en el **PR 2** (la de respaldos escribe ella misma un JSON en cada carpeta, como ya hace con `birria/smoke.json`). Ninguno de esos dos archivos entra en la suma de `deploy/` que comprueba `deploy.sh` (solo `compose.prod.yaml`, `deploy.sh` y `mysql/initdb/01-usuarios.sh`). RN-6 se respeta: no se quita nada del despliegue ni de los respaldos reales.
4. **Documentación que dejaría de ser cierta antes del PR 3:**
   - `despliegue.md` §5 (`$C exec app node scripts/admin-recover.ts`), `README.md` ("Recuperar el acceso", `docker exec … admin-recover.ts`), `docs/desarrollo.md` y los `.env.example` cambian en el **PR 1**, cuando se mueve el script.
   - `despliegue.md` §8, punto 2 ("`/admin` muestra el acceso, no un 503"), y su tabla del webhook ("`/admin` muestra el acceso") cambian en el **PR 2**.
   - El resto de `despliegue.md` queda para el PR 3, como dice RF-10.
5. **Clasificación de pruebas.** El BA da por retiradas algunas que hay que conservar: `admin-e2e.test.ts` es la cadena real de punta a punta de productos (landing + `api` + `inventory-manager` + aviso interno), que `testing.md` obliga a conservar y que además es la prueba de CA-5. `admin-users-e2e.test.ts` es la de usuarios. Detalle en (b).
6. **Comentario prohibido por CA-14:** `controllers/landing.ts` dice "…ni los JSON de DATA_DIR". Se reescribe sin el nombre de la variable.

### (a) `core/identity` prohibido sin romper `internal-app`

- `safeEqualStrings` solo está definida en `packages/core/identity/admin-auth.ts:75`; no hay otra copia en `web` ni en `api`. La usan `internal-app.ts`, `admin-guard.ts` (se retira), `api/src/admin/access.ts` y `api/src/bot/providers/meta/whatsapp-bot.ts`.
- **Solución:** moverla a `packages/core/shared/safe-equal.ts`, exportarla desde `core/shared/index.ts` y quitarla de `identity` (no la usa por dentro: `verifyPassword` llama a `timingSafeEqual`). Se actualizan los tres consumidores que quedan y el import de `tests/unit/admin-auth.test.ts`. Va en `core/shared` y no en `web`: es criptografía pura sin HTTP, y la usa también el bot.
- **Regla de `eslint.config.ts` (PR 2):**
  - se borra el comentario "REGLA DE TRANSICIÓN — TEMPORAL";
  - `LANDING_CODE_FILES` se sustituye por `['landing-pages/src/**/*.ts', 'landing-pages/scripts/**/*.ts']`, con `LANDING_CODE_PATTERNS` (`@restaurante/db`, `prisma`, `mariadb`, `@prisma/*`, `core/identity`, `core/bot-control`) más `LANDING_APP_PATTERNS`;
  - para `@restaurante/core/catalog` se usa **`allowImportNames`**, una lista de permitidos (ESLint ≥ 9.4; aquí 10.13), en lugar de la lista de prohibidos actual. Así, una exportación nueva de persistencia queda prohibida por defecto. La lista sale de lo que usan las landings (`mergePageData`, `pickPageData`, `validateMenuDocument`, `loadSeedDocument`, `SEED_FILES`, los tipos `MenuDataByBusiness`/`MenuDocument`, el formato de precios…) y se fija en la implementación con `npm run lint`;
  - las pruebas (`landing-pages/tests`) quedan fuera, porque conservan la infraestructura de MySQL y las pruebas de los paquetes;
  - CA-10 se comprueba a mano con un import de prueba en `src/` y otro en `scripts/`, que no se commitean.

### (b) Pruebas de `landing-pages/tests`, archivo a archivo

`api/tests` no tiene MySQL (su `vitest.config.ts` corre en memoria). Las pruebas con base real de la `api` ya se lanzan desde `landing-pages/tests` como proceso hijo (`api-process.test.ts`, con `node ../api/src/server.ts`). Las obligatorias que "pasan a `api`" siguen ese patrón: **cambian de objetivo (proceso o script de `api`), no de carpeta**, salvo `admin-bootstrap`.

**Se retiran en el PR 2** (solo prueban lo retirado, o son sondas `qa-req-f-*` que `testing.md` no deja en el repositorio):
- `integration/`:
  - `admin-acceso`, `admin-account`, `admin-auth`, `admin-authorization`, `admin-authorization-matrix`, `admin-bot`, `admin-bot-moved`, `admin-csrf`, `admin-db-security`, `admin-guardar`, `admin-produccion`;
  - `admin-products-api-{crear,permissions,sesion,validar}`, `admin-products-{crear,logs,moved,pagina}`;
  - `admin-qa-round1`, `admin-users`, `admin-users-moved`, `db-outage` (503 de `/admin` con la base caída; el de la `api` ya está en `api-process`);
  - `bot-pantalla-qa-req-f-043-{fallos,flujo}`, `bot-protection-qa-req-f-025`, `users-api-qa-req-f-040`, `users-api-qa-req-f-040-ultimo-admin`;
  - `users-api-process` y `admin-bot-api-process`: prueban la `api` con MySQL, pero sus reglas ya las cubren `user-repository.test.ts` y `bot-control-store.test.ts` (MySQL) y `api/tests/integration/admin-{users,bot}-api.test.ts` (HTTP). Una prueba por comportamiento.
- `unit/`: `admin-form`, `product-form`, `promo-form`, `file-menu-repository`, `menu-repository-contract`, `bot-control-qa-req-f-043`.
- `support/`: `admin-page`, `admin-products-api`, `admin-products-page`, `admin-authorization-matrix`, `admin-bot-qa-req-f-043-proceso`, `bot-pantalla-qa-req-f-043`, `bot-procesos-qa-req-f-042` (si queda sin uso), `users-api-qa-req-f-040`, `users-api-process` y `database-admin` (si queda sin uso). `support/admin.ts` se reduce a lo que sigue usándose (`makeClock`, `FRIDAY_NOON_MX`, `ADMIN_PASSWORD_HASH`, `TEST_BOT_KEYS`, `TEST_HASH_PARAMS`…) o se reparte en `support/` sin `setupAdmin`.

**Pasan a `api`** (la misma protección, otro objetivo):
- `integration/last-admin-concurrency.test.ts`:
  - el primer `describe` (repositorio con dos clientes de Prisma) no cambia;
  - el segundo desactiva por HTTP contra el proceso de la `api` (`/api/v1/admin`) en paralelo con `../api/scripts/admin-recover.ts`, en lugar de `setupAdmin` y el script de `landing-pages`. En el PR 1 solo cambia la ruta del script; el cambio a HTTP de la `api` va en el PR 2.
- `integration/admin-recover.test.ts` y `admin-recover-errores.test.ts`: el script pasa a `../api/scripts/admin-recover.ts` (PR 1). En el PR 2, la sesión que se comprueba cerrada es la de la `api` (`/api/v1/admin/sesion`), no la de `/admin`.
- `integration/server-startup-base.test.ts` (PR 1): sus tres casos arrancan `../api/src/server.ts`:
  - "migración incompleta → 1";
  - "D-15: productos ilegibles → 1";
  - "primer arranque: base vacía y migrada → productos y página de la semilla, administrador que entra" (CA-6, ahora por `/api/v1/admin/sesion`), con la comprobación de que un segundo arranque no cambia nada.

  Las variantes de `landing-pages` caen en el PR 2.
- `integration/server-startup.test.ts` (credenciales, sin migrar, migración pendiente, base más nueva, migración modificada): en el PR 2 apunta a la `api`. Es la prueba obligatoria de "no arranca con una base inválida" (CA-9).
- `unit/admin-bootstrap.test.ts` → `api/tests/unit/admin-bootstrap.test.ts` (PR 1), con un doble en memoria de `hasUsers`/`bootstrap`. Sus cuatro casos son de lógica y no necesitan MySQL; la transacción real ya la cubre `user-repository.test.ts` ("bootstrap solo crea el primer administrador…").

**Se modifican y se conservan:**
- `integration/api-process.test.ts`, caso CA-10:
  - PR 1: los dos procesos arrancan a la vez y no hay ningún `*_init_failed`; `product_import` = 2, `page_import` = 2 y un solo usuario, ganen la carrera uno u otro;
  - PR 2: la landing ya no toca la base, así que queda "la `api` prepara la instalación y la landing la muestra por la API".
- `integration/admin-e2e.test.ts` (CA-5) y `integration/admin-users-e2e.test.ts`: la landing arranca sin `DATABASE_URL`, `DATA_DIR` ni `ADMIN_*`, y se quitan las aserciones sobre el `/admin` actual.
- `integration/db-text-roundtrip.test.ts`: los mismos casos de texto multibyte y usuario único sin distinguir mayúsculas, contra los repositorios (usuarios y productos) y el autenticador de `core/identity`, en lugar de `/admin` y `/admin/api`.
- `integration/admin-products-atomicity.test.ts`: sus cinco casos de atomicidad con MySQL real llaman al repositorio de productos en lugar de a `/admin/api`. El contrato (`product-repository-contract`) solo cubre el fallo del registro al crear. Se renombra a `product-repository-atomicity.test.ts`.
- `integration/landing-products.test.ts`:
  - cae "importación y landings" (CA-1 a CA-5: importación desde los JSON);
  - cae "fallo de la base con el servidor en marcha" (la landing ya no tiene base);
  - los casos CA-7 a CA-12 de pintado pasan al doble de la API (`products-api-double.ts`), salvo los que ya estén en `app.test.ts`, "landings con productos guardados".
- `integration/landing-products-api.test.ts`: caen "CA-4: los cambios de /admin…" y "DEF-003"; quedan CA-5, CA-6 y CA-7 (API caída y arranque sin API).
- `integration/icons.test.ts`: caen "favicon en /admin (CA-9)" y "funciona con la administración deshabilitada".
- `integration/server-startup-config.test.ts`: cae el caso REQ-F-025 (umbral del bot); el resto sigue.
- `integration/internal-notify-process.test.ts`, `integration/app.test.ts`, `landing-html-reference`, `request-logger`: solo cambia la creación de la app (sin `products`, `users` ni `pages`).
- `unit/config.test.ts`: caen los casos de `DATA_DIR`, `DATABASE_URL`, `ADMIN_*` y del bot. Uno existente se adapta a "con esas variables presentes, incluso inválidas, arranca" (RF-2). Los casos de `ADMIN_USER`/`ADMIN_PASSWORD_HASH` pasan a `api/tests/unit/config.test.ts` (PR 1).
- `unit/page-import.test.ts`: conserva solo lo que use la siembra de la `api`, incluido el D-10 (instalación existente → se niega la semilla), que cubre CA-7. Caen los casos de `changes.jsonl` cuando se borre `parseChangeLog` (PR 2).
- `integration/prisma-page-store.test.ts`: caen los casos de `addImportedChanges` si se borra (PR 2).
- `unit/content.test.ts`: `SEED_FILES` viene de `core` (PR 1).
- `tests/helpers.ts`: `VALID_ENV` sin `DATABASE_URL`, `DATA_DIR`, `ADMIN_*` ni `WHATSAPP_BOT_*`.

**Se conservan sin cambios** (landings y paquetes):
- `unit/`: `landing`, `landing-dom`, `landing-snapshot`, `landing-products`, `home-notice`, `footer-cross-link`, `icons`, `render`, `whatsapp`, `business-schedule`, `business-hours`, `birria-veracity`, `variant-selector`, `visible-menu`, `price`, `datetime`, `image-checker`, `internal-app`, `public-client`, `audit-policy`;
- de paquetes: `product-repository-contract-*`, `product-repository-reload`, `menu-schema`, `product-schema`, `user-schema`, `admin-auth` (prueba `core/identity`; solo cambia el import de `safeEqualStrings`), `session-store`, `login-throttle`, `db-verify`, `migrations-collation`, `test-database-guard`;
- `integration/`: `user-repository`, `bot-control-store`;
- `snapshots/` y `setup/`.

**Única prueba nueva** (PR 2): un `describe` en `integration/app.test.ts`, con dos apps en proceso (con y sin `ADMIN_NEW_URL`):
- GET y HEAD de `/admin`, `/admin/login?x=1`, `/admin/bot` y `/admin/api/molotes/productos` → 302 a `<ADMIN_NEW_URL>/`, sin `Set-Cookie`;
- POST, PUT, PATCH y DELETE con cuerpo grande → 410, sin leer el cuerpo;
- sin la variable → 404;
- `/administracion` → 404.

Para las comprobaciones de CA-6 y CA-7 que no cubran las pruebas trasladadas, se añade como mucho un caso al `admin-bootstrap` movido (el orquestador de la instalación con dobles en memoria), y se dice en el PR.

### (c) Siembra doble durante el PR 1: ¿segura e idempotente?

**Idempotente en serie: sí.**
- Productos: `importBusiness` (`core/catalog/product-repository.ts:353`) comprueba `isImported` y que no haya productos dentro de la transacción. `product_import` tiene clave primaria `business`.
- Página: `markImported` (`prisma-page-store.ts:73`) crea `page_import` con clave primaria `business`, y `putCurrent` crea `page_version` con clave `(business, slot)`.
- Usuarios: `users.bootstrap` es `Serializable`, con `count() > 0 → null` y reintento ante interbloqueo (`db/user-repository.ts:264`).

**En paralelo** (los dos procesos contra una base recién migrada), la integridad de los datos se mantiene, pero **un proceso puede no arrancar**:
- Productos: la transacción es `REPEATABLE READ` (la de Prisma por defecto) y `isImported` es una lectura sin bloqueo, así que los dos insertan. El segundo choca con la clave única (`P2002` → `SlugTakenError` en `prisma-product-store.ts:179`), se revierte entero y su proceso termina con 1 (`products_init_failed`).
- Página: lo mismo con `page_import` o `page_version` (`toUnavailable` → `page_import_failed`).
- Usuarios: seguro (`Serializable` + reintento → `null`).

Las dos siembras escriben lo mismo (la semilla), así que no importa quién gane.

**Dónde ocurre:**
- **No** en producción ni en `deploy/ci/smoke.sh`: `deploy.sh` cambia la `api`, espera `healthy` y solo después la app (`deploy.sh:346-379`). Además, la instalación de producción ya existe (`product_import` con filas): la `api` no siembra.
- **Sí** en `npm run dev` con una base vacía y en `api-process.test.ts` (CA-10), que arranca los dos con `Promise.all`.

**Protección (PR 1):**
- Tras un fallo de la transacción de importación, se vuelven a leer las marcas. Si ese negocio ya está marcado, otro proceso hizo la importación: se registra `products_import_skipped`/`page_seed_skipped` con `reason: 'concurrent'` y se continúa. Si no, se relanza el error.
- Se aplica en `importBusiness` (`core`, la usan las dos apps) y en la siembra de página de la `api`.
- La landing del PR 1 no se toca más (su `importPages` desaparece en el PR 2). Mientras convivan, si pierde la carrera de la página, termina con 1 y su reinicio encuentra la marca. Es aceptable y solo ocurre en desarrollo.
- La evidencia es el caso CA-10 modificado.

## Technical Action Plan

### Objetivo técnico

Un único admin (`inventory-manager`). `api` prepara la instalación y contiene la recuperación. `landing-pages` sirve las landings sin MySQL ni `DATA_DIR`, con `/admin*` → 302/410/404, y un lint que impide volver atrás. Se mantienen la vuelta atrás automática y unos respaldos coherentes.

### PR 1 — Arranque y recuperación en `api` (`landing-pages` sigue igual hacia fuera)

**Archivos y símbolos:**
- `packages/core/catalog/seeds/{molotes,birria}.json` (`git mv` desde `landing-pages/src/content/*/seed.json`) y un módulo `seeds.ts` con `SEED_FILES` y `loadSeedDocument`, exportados en `catalog/index.ts`. `landing-pages/src/content/seeds.ts` los reexporta (`loadSeedMenus`, `loadSeedPages` y `loadSeedProducts` no cambian).
- `packages/core/catalog/product-repository.ts` (`importBusiness`): tolerancia a la carrera (c). Se actualiza el comentario de `init` ("la importación es solo de landing-pages").
- `packages/core/catalog/page-import.ts`: un `planSeedPages`/`seedPages({ store, seeds, existing, logger, now })` que reutiliza `planPageImport` con candidatos de semilla (`seeded: true`) y escribe en una transacción `putCurrent`, `putPrevious` y `markImported` con `source: 'seed'`. Es idempotente (lee `readImports`) y tolerante a la carrera.
- `api/src/install/admin-bootstrap.ts`: `bootstrapAdmin`, movido de `landing-pages/src/services/admin-bootstrap.ts` (la copia de la landing se queda hasta el PR 2 o se borra si el arranque de la landing deja de usarla; se elige lo que deje menos código duplicado).
- `api/src/install/index.ts` (`prepareInstallation`):
  - `existing = pageStore.hasProductImports()`, antes de importar;
  - `products.init(existing ? undefined : seedSources)`: la semilla se valida con `validateMenuDocument` y falla rápido;
  - `seedPages`, solo si `!existing`;
  - `bootstrapAdmin`.

  Cada paso tiene su `logger.error` con solo códigos y su mensaje de `stderr` sin detalles, con salida 1, como en la landing.
- `api/src/server.ts`: llama a `prepareInstallation` tras `verifyDatabase` y sustituye `products.init()` sin fuentes. Se actualiza el comentario de la cabecera ("nunca … importa semillas").
- `api/src/config.ts`: `adminBootstrap` (con `parseAdminBootstrap` movido de la landing: los dos juntos o ninguno, `usernameError`, `parsePasswordHash`) y `loadDatabaseConfig` para el script.
- `api/scripts/admin-recover.ts`, `api/scripts/hash-password.ts` y `api/scripts/support/read-hidden.ts` (`git mv` desde `landing-pages/scripts`). El mensaje final remite al admin nuevo, sin `/admin`.
- `api/package.json`: `admin:recover` y `admin:hash-password`. En `restaurante/package.json`, los alias con `-w api`.
- Dockerfile:
  - etapa `api`: `COPY --from=build /app/api/scripts/admin-recover.ts /app/api/scripts/hash-password.ts ./scripts/` y `scripts/support`;
  - etapa `production`: se quitan las dos líneas de `scripts/` de la landing;
  - se mantienen `mkdir /var/lib/restaurante` y el `COPY` de `packages/db`, que salen del alcance o del PR 3.
- `api/.env.example`: `ADMIN_USER` y `ADMIN_PASSWORD_HASH` (opcionales).
- `eslint.config.ts`: sin cambios en este PR, salvo que haga falta permitir `scripts/` en `api` (ya entra en `api/**/*.ts`).
- Compose: sin cambios (decisión P-T1).

**Pruebas:** las de (b) marcadas "PR 1". **Documentación:**
- `README.md` ("Recuperar el acceso" y la tabla de comandos);
- `docs/desarrollo.md` (`admin:*`);
- `despliegue.md` §5 (`$C exec api node scripts/admin-recover.ts …`);
- `docs/arquitectura.md` (la `api` prepara la instalación nueva, las semillas en `core/catalog`).

### PR 2 — Retirada en `landing-pages` (compose sin cambios)

**Se borra:**
- `src/routes/admin.ts`, `src/routes/admin-api.ts`;
- `src/controllers/admin*.ts` (9: `admin`, `admin-access`, `admin-account`, `admin-api-access`, `admin-bot`, `admin-business-view`, `admin-products`, `admin-products-api`, `admin-users`);
- `src/middleware/admin-guard.ts`;
- `src/services/{admin-bootstrap,admin-form,product-form,page-import}.ts`;
- `src/repositories/` (las 3);
- `src/views/admin/` (entera);
- `src/styles/admin/` y los scripts `build:css:admin` y `watch:css:admin`; `public/css/admin` deja de generarse.

**`src/server.ts`:** `loadConfig` → cliente de la API → `landingProducts`/`landingPage` + `warmUp` → `createApp` → `listen` → `createInternalApp`. Sin Prisma, `verifyDatabase`, `DATA_DIR`, importaciones, `bootstrapAdmin` ni `botControl`.

**`src/app.ts`:**
- `AppOptions` = `{ config, landingProducts, landingPage, logger, now, viewsDir, publicDir }`;
- se quitan `products`, `pages`, `users`, `botControl`, `hashParams`, `createAdminGate`, `renderAdminUnavailable` y la suscripción `products.onChange`. La invalidación llega por el aviso interno, que ya hace eso.
- Se añade el middleware `src/middleware/admin-moved.ts` antes de `koa-static`:
  - `/admin` o `/admin/*`: sin `adminNewUrl` → `next()` (404 del router con el formato centralizado);
  - GET o HEAD → 302 `${adminNewUrl}/` con `Cache-Control: no-store` y `X-Robots-Tag: noindex`;
  - cualquier otro método → 410 `{ error: { code: 'ADMIN_MOVED', … } }` sin leer el cuerpo;
  - nunca toca cookies.

**`src/routes/index.ts`:** sin `admin`, `AdminRouteDeps` ni `products`. Se actualiza el comentario de rutas.

**`src/config/env.ts`:**
- se quitan `dataDir`, `database`, `allowNewerSchema`, `adminBootstrap`, `botPanel`, `botLimits`, `botKeys`, `loadDatabaseConfig`, `DEFAULT_DATA_DIR`, `parseDataDir`, `parseAdminBootstrap`, la regla D-6 (P-T4) y los imports de `db`, `identity` y `bot-control`;
- se conservan `trustProxy`, `adminNewUrl` (https en producción) e `internalNotify`;
- las variables retiradas se ignoran sin validarse (RF-2).

**Otros cambios en `landing-pages`:**
- `src/internal-app.ts`: `safeEqualStrings` desde `@restaurante/core/shared` (con el movimiento de (a), que también actualiza `api/src/admin/access.ts` y `whatsapp-bot.ts`);
- `src/controllers/landing.ts`: el comentario de CA-14.

**`packages/`:** se borra el código muerto de la importación desde JSON: `parseChangeLog`, `addImportedChanges` (contrato, Prisma y memoria) y lo que quede sin uso tras quitar `importPages`. `PAGE_ACTIONS.RESTORE_SEED` se conserva, porque hay filas importadas que la usan. `readImports` y `hasProductImports` siguen (los usa la siembra de la `api`).

**`landing-pages/package.json`:**
- `admin:*` ya salió en el PR 1;
- `@restaurante/db` se queda, porque lo usan las pruebas y adelgazar la imagen está fuera de alcance;
- se actualiza `description` en la raíz.

**Lint** según (a). **CI:** los dos ajustes de `smoke.sh` del hallazgo 3. **Pruebas:** las de (b) marcadas "PR 2" y la prueba nueva.

**Documentación:**
- `README.md`;
- `docs/desarrollo.md` §3 y §4;
- `docs/arquitectura.md` §1, §4 (fin de la desviación de `/admin`), §6, §8 (paso 4 completo) y §10;
- `despliegue.md` §8, punto 2, y la tabla del webhook;
- `landing-pages/.env.example`: sin `DATA_DIR`, `DATABASE_URL`, `ADMIN_*` ni `WHATSAPP_BOT_*`;
- `.claude/CLAUDE.md` §8, solo la frase autorizada.

### PR 3 — Limpieza de `deploy/` y `ops/` (solo con la confirmación del usuario)

- `deploy/compose.prod.yaml`:
  - `app` sin `DATA_DIR`, `DATABASE_URL`, `DATABASE_ALLOW_NEWER_SCHEMA`, `<<: *bot-env`, `ADMIN_*` ni el volumen `app-data`;
  - `api` con `ADMIN_USER`/`ADMIN_PASSWORD_HASH`;
  - se quitan las etiquetas de `restaurante-admin` y `restaurante-admin-ratelimit`;
  - `app-data` sigue declarado en `volumes:` (sin montar), para que `compose down` no lo trate como huérfano y para que se pueda volver con el compose anterior.
- `deploy/env.production.example`.
- Dockerfile: se quita el `mkdir /var/lib/restaurante`.
- `ops/backup`:
  - `backup.sh` deja de leer y exigir `app-data`, y el manifiesto lo omite;
  - `lib.sh`, `restore.sh` y `verify-backup.sh` aceptan respaldos con y sin `app-data.tar`. Si viene, se verifica y se restaura en el volumen; si no, se omite con un log;
  - `--drill` monta `app-data` solo si viene (una app anterior al PR 2 lo necesita);
  - `ops/backup/ci/smoke.sh` cubre los dos formatos.
- `deploy/ci/smoke.sh`: 30 peticiones a `/admin/login` → todas 302, ningún 429 (CA-13); 410 en un POST; se quita la comprobación del 503.
- `despliegue.md` §1, §3, §4, §5, §6 (volver a una versión anterior a este ticket: revert en `main` o compose del commit anterior; RN-4, un respaldo anterior al 2026-11-16 deja la página "no disponible" y las landings con la semilla, $195 y $145) y §11.

### Validaciones

- Variables: `ADMIN_*` se validan en `api` igual que hoy. En `landing-pages` se ignoran `DATA_DIR`, `DATABASE_URL`, `ADMIN_*` y `WHATSAPP_BOT_*`.
- Semilla: validada con `validateMenuDocument` antes de importar. Si no es válida, falla rápido.

### Manejo de errores

- Arranque de `api`: cada paso de la instalación registra el evento solo con códigos (`products_init_failed`, `page_seed_failed`, `admin_bootstrap_failed`), escribe un mensaje sin detalles y sale con 1.
- `admin-recover`: los mismos mensajes que hoy.
- 410: formato centralizado `{ error: { code, message } }`.

### Seguridad

- La CSP no cambia.
- El 302 lleva siempre el destino fijo de la configuración validada (sin la ruta ni la query de la petición: no hay redirección abierta).
- En `/admin*`, ni cookies ni lectura del cuerpo.
- La comparación de la credencial del aviso sigue en tiempo constante.
- El hash de `ADMIN_PASSWORD_HASH` nunca se registra.

### Performance

- La landing deja de abrir un pool de MySQL y de leer disco al arrancar.
- La `api` hace, una sola vez, dos lecturas de marcas al arrancar.

### Comprobación de cada CA

| CA | Prueba permanente | Comprobación de QA (se ejecuta y se descarta) | VPS |
| -- | ----------------- | --------------------------------------------- | --- |
| CA-1, CA-2, CA-3 | `app.test.ts` (nueva) | `curl` con y sin cuerpo contra la imagen local | sí (épica) |
| CA-4 | `landing-html-reference`, `landing-snapshot` | arrancar con `DATABASE_URL` hacia un puerto cerrado y `DATA_DIR` inexistente: arranca, sin `database_*` ni `menu_*` en el log; HTML de los 7 días contra `main` | sí |
| CA-5 | `admin-e2e`, `internal-app`, `internal-notify-process` | — | sí |
| CA-6, CA-7 | `server-startup-base` (api), `page-import` (D-10), `admin-bootstrap` (api) | segundo arranque: recuentos de tablas iguales | no (solo en una base nueva) |
| CA-8 | `last-admin-concurrency`, `admin-recover*` | `docker compose exec api node scripts/admin-recover.ts` contra la pila local | ver P-T3 |
| CA-9 | `server-startup` (api) | — | no |
| CA-10 | `npm run lint` | import de prueba en `src/` y en `scripts/` | no |
| CA-11 | — | pila local con el compose del PR 2 y la imagen de la app de `8abdff9`: queda `healthy` | solo si hubo vuelta atrás |
| CA-12, CA-13 | `ops/backup/ci/smoke.sh`, `deploy/ci/smoke.sh` | — | sí (PR 3) |
| CA-14 | — | `grep -rn 'DATA_DIR\|DATABASE_URL\|ADMIN_USER\|admin-recover' landing-pages/src landing-pages/scripts` vacío | no |

### Comprobaciones en el VPS (solo lectura, con `C` de `despliegue.md` §5)

**Antes del despliegue de la épica (PR 1 + PR 2):**
- `$C ps` (todo `healthy`); `tail state/releases.log`; `ls -lt backups/`.
- `page_import` con 2 filas, con el comando de §8.5. `product_import` con 2 filas y al menos un administrador activo, con el mismo patrón de `$C exec -T mysql sh -c '… -e "SELECT COUNT(*) FROM product_import; SELECT COUNT(*) FROM user WHERE role=\"admin\" AND active=1"'`.
- `app-data` presente para la vuelta atrás: `$C exec -T app sh -c 'cd /var/lib/restaurante && ls -l changes.jsonl molotes/current.json birria/current.json'`.
- `SELECT COUNT(*) FROM user_audit`, para comparar después.

**Después del despliegue de la épica:**
- §8, puntos 1 a 3.
- `curl -s -o /dev/null -D - https://birriaelmuneco.com/admin` y `curl -sI` de `/admin/login?x=1`, `/admin/bot` y `/admin/api/molotes/productos` → `302`, `location: https://admin.birriaelmuneco.com/`, sin `set-cookie`.
- `curl -s -o /dev/null -w '%{http_code}\n' -X POST -d x=1 https://birriaelmuneco.com/admin/login` (y `PUT`, `PATCH`, `DELETE`) → `410`. `user_audit` no cambia.
- `$C logs app`: `server_started`, sin `database_waiting`, `page_import_*` ni `menu_repository_*`. `$C logs api`: `server_started`, sin `products_imported` ni `admin_bootstrap_created` (instalación existente).
- Un cambio de prueba en el admin nuevo, deshecho después (como en §8.5): `products_change_notified` con `landing:true` en `$C logs app`.
- `sudo docker stats --no-stream`.

**Antes del PR 3:** confirmación explícita del usuario. Instalar el `deploy/` nuevo según §1.3 (cambia la suma). `sudo docker volume ls | grep app-data`.

**Después del PR 3:**
- `sudo docker volume inspect restaurante_app-data` (existe) y `sudo docker ps -a --filter volume=restaurante_app-data` (vacío).
- Un respaldo manual y su verificación con los comandos de §11.6.
- 30 peticiones en paralelo a `/admin/login` → todas 302; `/molotes` → 200.

### Riesgos técnicos y vuelta atrás

- **PR 1:** en producción la `api` no siembra (`existing`), así que el riesgo es nulo para los datos. Si la `api` nueva no queda `healthy`, `deploy.sh` vuelve a la anterior (código 15). Una instalación nueva incompleta la detectan `server-startup-base` (api) y el `smoke.sh` del PR de la épica a `main`, que parte de una base vacía con `deploy.sh`.
- **PR 2:**
  - La app nueva ignora las variables y el volumen que el compose sigue pasando (RF-8). Si no queda sana, `deploy.sh` vuelve a la app anterior (REQ-F-044) con el mismo compose y `DATABASE_ALLOW_NEWER_SCHEMA=true` (no hay migraciones nuevas en este ticket). Esa app arranca: tiene `DATABASE_URL`, `DATA_DIR`, `app-data` y las variables del bot, encuentra las marcas de `page_import` y `product_import` y no reimporta. Con los JSON congelados, ni siquiera registra `page_json_diverged` (CA-11).
  - **Si también falla la vuelta atrás automática** (códigos 22 o `health_failed_rollback_failed`): las landings quedan sin servicio. La base no corre peligro (la app nueva no escribe nada y la `api` no siembra en una instalación existente). Se recupera con §6 tal como está escrito, porque el compose no cambió, o con un revert en `main`.
  - El riesgo real llegaría si el PR 2 cambiara el compose (sin `DATABASE_URL`/`DATA_DIR`, la app anterior no arranca en producción). Por eso el compose no cambia (RF-8).
- **PR 3:** la vuelta atrás automática vuelve a la app del PR 2, que no necesita nada de lo quitado, así que sigue funcionando. Volver a una versión anterior al PR 2 exige un revert en `main` o el compose anterior (§6). El volumen `app-data` conserva los JSON, así que esa vuelta funciona.
- **REQ-F-046 en paralelo:** ver "Orden de implementación".

### Orden de implementación

1. Rama `feature/REQ-F-045-retirada-admin-actual-1-arranque` desde `epic/arquitectura` actualizada (con `main` integrada si REQ-F-046 entró antes). PR 1 → `epic/arquitectura`.
2. Rama `…-2-retirada` tras el merge del PR 1. PR 2 → `epic/arquitectura`.
3. PR `epic/arquitectura` → `main` con su CI completo (`smoke.sh` incluido). Despliegue y comprobaciones en el VPS.
4. Con la confirmación del usuario, rama `…-3-limpieza`. PR 3 → `epic/arquitectura` y otra vez la épica a `main`.

**Coordinación con REQ-F-046** (su revisión recomienda `main`):
- Archivos compartidos:
  - `api/src/server.ts`: bloques distintos (este ticket, la instalación tras `verifyDatabase`; REQ-F-046, `quotes.init()` antes de `createAdminRoutes`);
  - `README.md`, `docs/arquitectura.md` y `.claude/CLAUDE.md` §8: frases distintas (este ticket edita la viñeta de `landing-pages`; REQ-F-046, las de `api`/`inventory-manager`).
- REQ-F-045 no toca `contracts/admin.ts`, `inventory-manager` ni el menú, así que no hay conflicto ahí.
- Regla: antes de abrir cada PR de este ticket, si `main` tiene algo que `epic/arquitectura` no tiene, se integra con un PR de `main` → `epic/arquitectura` (`git.md`). El que llegue segundo resuelve el conflicto de texto.
- Si se puede elegir, conviene que **el PR 1 de REQ-F-046 entre antes del PR 1 de este ticket**: no toca `deploy/` y deja `api/src/server.ts` estable antes del cambio de arranque.

### Criterios de finalización

- CA-1 a CA-14 comprobados como dice la tabla.
- `npm run typecheck`, `npm run lint` y `npm test` en `pass`.
- `git diff` sin cambios ajenos.
- Limpieza comprobada: sin bases `restaurante_test*`, procesos ni worktrees.
- La documentación de cada PR al día.

### Decisiones para el usuario (con la recomendación)

- **P-T1. ¿Cuándo recibe la `api` `ADMIN_USER`/`ADMIN_PASSWORD_HASH` en el compose?**
  - Recomendación: **en el PR 3** (RF-9 lo permite: "si no los recibió ya en el PR 1"). Así el despliegue de la épica no cambia `deploy/`, sin reinstalar `deploy/` en el VPS (§1.3) ni sumar riesgo a ese despliegue.
  - Mientras tanto no habrá instalaciones nuevas en producción, y en desarrollo la `api` las lee de su `.env`.
  - Alternativa: en el PR 1, como dice el Action Plan, reinstalando `deploy/` antes del despliegue de la épica.
- **P-T2. Rama destino.**
  - Recomendación: **mantener `epic/arquitectura` para los tres PR** (RN-8, ya aprobada, y `git.md`: es el ticket 6 del paso 4).
  - Ventajas: el PR 1 y el PR 2 se despliegan juntos, en un solo despliegue coherente, y el `smoke.sh` desde una base vacía valida la instalación de la `api` en el PR de la épica a `main`.
  - Coste: integrar `main` en la épica si REQ-F-046 entra antes, y dos ejecuciones del CI por cada llegada a `main`.
  - Alternativa: PR directos a `main` (las dos ramas son iguales hoy). Cada PR tendría su propio `smoke.sh` y su despliegue, a cambio de desplegar el PR 1 solo.
- **P-T3. CA-8 en producción.**
  - Recomendación: **no ejecutar `admin-recover` real en el VPS** (cambia la contraseña y deja auditoría). Comprobar de solo lectura que el script existe (`$C exec -T api ls scripts/admin-recover.ts scripts/hash-password.ts`) y hacer la ejecución real en la pila local de QA.
  - Si se quiere en producción, con una cuenta temporal que después se desactiva en el admin nuevo.
- **P-T4. Regla D-6 de REQ-F-009** ("con el bot, `WHATSAPP_MOLOTES` y `WHATSAPP_BIRRIA` deben ser el mismo número").
  - Hoy la valida la landing con la configuración del bot.
  - Recomendación: **retirarla**. La landing deja de conocer el bot, y el PR 3 le quita las `WHATSAPP_BOT_*`, con lo que la regla dejaría de funcionar sin avisar. Se documenta en `env.production.example`.
  - Alternativa: que la `api` valide su número contra un `WHATSAPP_*` propio. Es un cambio fuera de alcance.

## Implementation Result

### PR 1 — Arranque y recuperación en `api`

#### Rama

`feature/REQ-F-045-retirada-admin-actual-1-arranque`, desde `epic/arquitectura` = `d261ff8` (ya integra `main`). PR destino: `epic/arquitectura`. Sin commit todavía.

#### Cambios realizados

- **Semillas en `core/catalog`:** `git mv` sin cambios de `landing-pages/src/content/{molotes,birria}/seed.json` a `packages/core/catalog/seeds/{molotes,birria}.json`; `packages/core/catalog/seeds.ts` con `SEED_FILES` y `loadSeedDocument`, exportado en `catalog/index.ts`. `landing-pages/src/content/seeds.ts` solo los reexporta. Se borra la copia idéntica `api/tests/fixtures/seeds/` y `api/tests/helpers.ts` lee la semilla de `core`.
- **Instalación nueva en `api`** (`api/src/install/index.ts`, `prepareInstallation`): `hasProductImports` → si es nueva, semilla validada con `validateMenuDocument` (fallo rápido, `install_seed_invalid`), `seedPages` y `products.init` con la semilla (`source: 'seed'`); si es existente, solo `products.init()`; después `bootstrapAdmin` (`api/src/install/admin-bootstrap.ts`). Cada paso que falla lanza `InstallationError` con su evento (`database_init_failed`, `page_seed_failed`, `products_init_failed`, `admin_bootstrap_failed`) y solo códigos; `server.ts` registra, escribe el mensaje sin detalles y sale con 1. Desviación menor del plan: la página se siembra **antes** que los productos, para que un arranque cortado entre los dos pasos siga viéndose como instalación nueva y complete lo que falte (con el orden del plan, unos productos ya importados harían "existente" la instalación y la página quedaría sin sembrar).
- **`seedPages`** en `core/catalog/page-import.ts` (con `seedCandidates` y `allMarked`): reutiliza `planPageImport` con la semilla como primera ejecución (vigente y anterior = semilla, marca `seed`, `historyCount` 0), una transacción, idempotente.
- **Siembra en paralelo:** `core/shared/concurrent-write.ts` (`isWriteConflict`: P2002/P2034/1062/1213; `confirmedByOther`: relee la marca hasta 20 veces cada 250 ms). Se aplica en `importBusiness` (`products_import_skipped`, `reason: 'concurrent'`), en `seedPages` (`page_seed_skipped`) y en la importación de página de `landing-pages` (`page_import_skipped`), que convive hasta el PR 2. La primera versión (releer una sola vez) fallaba siempre en el caso CA-10: la landing perdía con un interbloqueo (`P2034`) mientras la transacción de la `api` aún no había confirmado; por eso la espera acotada. Otros errores se relanzan sin esperar.
- **`api/src/config.ts`:** `adminBootstrap` (`ADMIN_USER`/`ADMIN_PASSWORD_HASH`, las dos o ninguna, mismos textos sin valores) y `loadDatabaseConfig` para el script.
- **Scripts:** `git mv` de `admin-recover.ts`, `hash-password.ts` y `support/read-hidden.ts` a `api/scripts/`; el mensaje final remite al admin nuevo. `admin:recover` y `admin:hash-password` pasan de `landing-pages/package.json` a `api/package.json`; los alias de la raíz delegan en `-w api`.
- **`safeEqualStrings`** pasa a `packages/core/shared/safe-equal.ts`; consumidores actualizados: `landing-pages/src/internal-app.ts`, `landing-pages/src/middleware/admin-guard.ts`, `api/src/admin/access.ts`, `api/src/bot/providers/meta/whatsapp-bot.ts` y `landing-pages/tests/unit/admin-auth.test.ts`.
- **Dockerfile:** la etapa `api` copia los dos scripts y `scripts/support`; la etapa `production` deja de copiar los scripts de la landing. Sin cambios en `deploy/`, compose ni `ops/` (P-T1). `/admin` sigue igual (la landing conserva su importación y su `bootstrapAdmin` hasta el PR 2).
- **Documentación:** `README.md` (comandos, primera ejecución, API propia, imágenes, "Recuperar el acceso", árbol), `docs/desarrollo.md`, `docs/despliegue.md` §1 y §5 (`$C exec api node scripts/admin-recover.ts`, con la nota para una `api` anterior tras una vuelta atrás), `docs/arquitectura.md` (§1 y "Paso 4, ticket 6, PR 1 aplicado"), `api/.env.example` (`ADMIN_*`) y `landing-pages/.env.example` (rutas de la semilla y de los comandos).

#### Pruebas (sin pruebas nuevas de arquitectura)

- `api/tests/unit/admin-bootstrap.test.ts` (`git mv` desde `landing-pages/tests/unit`): los cuatro casos con un doble en memoria de `hasUsers`/`bootstrap`, más **un caso** (el previsto en (b)) de `prepareInstallation` en una instalación existente (CA-7: ni semilla, ni página, ni usuarios).
- `api/tests/unit/config.test.ts`: los casos de `ADMIN_USER`/`ADMIN_PASSWORD_HASH` (traslado; los de la landing siguen hasta el PR 2, porque la landing aún los valida) y `adminBootstrap: null` en el caso por defecto.
- `landing-pages/tests/integration/server-startup-base.test.ts`: "migración incompleta", "D-15" y "primer arranque" arrancan `../api/src/server.ts` (CA-6 y CA-9: login por `/api/v1/admin/sesion`, `/productos` y `/pagina` en 200, `page_seeded` ×2, `products_imported` con `source: seed`, auditoría `bootstrap`, y un segundo arranque con los mismos recuentos de tablas). El caso de `DATA_DIR` sigue en la landing (cae en el PR 2). Soporte: `bootApi` y `API_ENTRY` en `tests/support/server-startup.ts`.
- `landing-pages/tests/integration/api-process.test.ts` (CA-10): los dos procesos a la vez, sin ningún `*_init_failed`, `page_seed_failed`, `page_import_failed` ni `admin_bootstrap_failed`; `product_import` = 2, `page_import` = 2 y un solo usuario.
- Ruta del script `../api/scripts/admin-recover.ts` en `tests/support/admin-recover.ts`, `last-admin-concurrency.test.ts` y `admin-users-moved.test.ts`.

#### Criterios de aceptación (alcance del PR 1)

| CA | Estado |
| -- | ------ |
| CA-6 | Cumplido en local: `server-startup-base` (api) — semilla en los dos negocios, administrador que entra, segundo arranque sin cambios. |
| CA-7 | Cumplido: caso nuevo de `admin-bootstrap` (api) con dobles en memoria. |
| CA-8 | Cumplido en local: `admin-recover*` y `last-admin-concurrency` contra `../api/scripts/admin-recover.ts`; comprobado a mano en la imagen `api` (ver abajo). El cambio de la sesión comprobada a la de la `api` va en el PR 2. |
| CA-9 | Cumplido para la `api`: "migración incompleta" y "D-15" arrancan la `api`. `server-startup.test.ts` pasa a la `api` en el PR 2, como dice el plan. |
| CA-1 a CA-5, CA-10, CA-11, CA-14 | PR 2. |
| CA-12, CA-13 | PR 3. |

#### Validaciones ejecutadas (resultado real)

- `npm run typecheck`: 0.
- `npm run lint`: 0, sin avisos.
- `npm test` (MySQL local con `npm run db:up`): `api` 49 archivos / 1161 pruebas; `landing-pages` 94 / 1310; `inventory-manager` 16 / 278. Todo en verde. `api-process.test.ts` + `server-startup-base.test.ts` repetidos 5 veces seguidas: 7/7 cada vez (antes de la espera acotada, el CA-10 fallaba 3 de 3 con `products_init_failed` `P2034` en la landing).
- `npm run build:css`: no aplica (sin cambios de estilos ni plantillas).
- Docker (local, se descarta): `docker build --target api` → `scripts/admin-recover.ts`, `scripts/hash-password.ts`, `scripts/support/read-hidden.ts` y `/app/packages/core/catalog/seeds/{molotes,birria}.json` presentes; `node scripts/hash-password.ts` y `node scripts/admin-recover.ts --usuario x` sin `DATABASE_URL` responden con sus mensajes controlados (código 1). `docker build --target production` → sin `scripts/`, y `src/content/seeds.ts` carga la semilla desde `core`. Imágenes borradas.
- Alias de la raíz: `npm run admin:hash-password` (genera `scrypt$…`) y `npm run admin:recover -- --usuario` (mensaje de uso) delegan en `api`.
- `git diff` revisado: solo cambios del PR 1.

#### Archivos afectados

- Nuevos: `restaurante/packages/core/catalog/seeds.ts`, `restaurante/packages/core/shared/safe-equal.ts`, `restaurante/packages/core/shared/concurrent-write.ts`, `restaurante/api/src/install/index.ts`, `restaurante/api/src/install/admin-bootstrap.ts`.
- Movidos: semillas → `restaurante/packages/core/catalog/seeds/`; scripts → `restaurante/api/scripts/`; `admin-bootstrap.test.ts` → `restaurante/api/tests/unit/`. Borrado: `restaurante/api/tests/fixtures/seeds/`.
- Modificados: `packages/core/{catalog/index.ts,catalog/page-import.ts,catalog/product-repository.ts,identity/admin-auth.ts,shared/index.ts}`, `api/{src/config.ts,src/server.ts,src/admin/access.ts,src/bot/providers/meta/whatsapp-bot.ts,scripts/bot-chat.ts,tests/helpers.ts,tests/unit/config.test.ts,package.json,.env.example}`, `landing-pages/{src/content/seeds.ts,src/internal-app.ts,src/middleware/admin-guard.ts,src/services/page-import.ts,Dockerfile,package.json,.env.example}`, `landing-pages/tests/{integration/api-process.test.ts,integration/server-startup-base.test.ts,integration/last-admin-concurrency.test.ts,integration/admin-users-moved.test.ts,support/admin-recover.ts,support/server-startup.ts,unit/admin-auth.test.ts}`, `package.json`, `README.md`, `docs/{arquitectura,desarrollo,despliegue}.md`.

#### Riesgos o pendientes

- `landing-pages/src/services/admin-bootstrap.ts` queda duplicado con `api/src/install/admin-bootstrap.ts` hasta el PR 2 (lo usan el arranque de la landing y `tests/support/admin.ts`); su prueba unitaria ya está en la `api`.
- La espera ante un choque (hasta ~5 s) solo ocurre con dos arranques sobre una base nueva; en producción `deploy.sh` arranca la `api` antes que la app y la instalación ya existe.
- `.claude/agents/senior-fullstack.md` (líneas 88 y 113) sigue nombrando `src/content/<negocio>/seed.json`; no se tocó (fuera de lo autorizado).
- No se puede ejecutar aquí el `smoke.sh` del despliegue (solo corre en el PR de la épica a `main`).

#### Limpieza

Sin bases `restaurante_test*` en el MySQL de pruebas (comprobado con `SHOW DATABASES`), sin procesos de Vitest ni servidores, sin worktrees extra (`git worktree list`), imágenes Docker de comprobación borradas, scripts temporales del scratchpad borrados. MySQL detenido con `npm run db:down` (estaba apagado al empezar).

### Correcciones tras el QA (2026-11-16)

Decisión del usuario (cita textual): "corrigelo y termina".

- **DEF-002 corregido:** en `api/src/install/index.ts`, la carga de la semilla pasa por `step('seed', …)`. Un archivo ilegible o un JSON roto termina como los demás pasos: `InstallationError` con el evento `install_seed_invalid`, solo códigos (`name`, `code`), el mensaje fijo y salida 1. Sin otros cambios. Prueba: un caso en el archivo existente `api/tests/unit/admin-bootstrap.test.ts` ("prepareInstallation con la semilla ilegible"), que falla sin la corrección.
- **DEF-001 pendiente del PR 2:** ajustar `ops/backup/ci/smoke.sh:169-171` (que escriba ella misma un JSON en cada carpeta) y tener en cuenta `ops/backup/verify-backup.sh:139-140`, que seguirá exigiendo un JSON en `molotes/` y `birria/` en una instalación nueva hasta que el PR 3 acepte respaldos sin `app-data`.
- Validaciones tras la corrección: `npm run typecheck` 0, `npm run lint` 0, `npm test` en verde (api 49/1162, landing-pages 94/1310, inventory-manager 16/278). Limpieza: sin bases `restaurante_test*`, sin procesos, un solo worktree, MySQL detenido.

### PR 2 — Retirada en `landing-pages`

#### Rama

`feature/REQ-F-045-retirada-admin-actual-2-retirada`, desde `epic/arquitectura` = `425e21a` (con el PR 1; `main` no tiene nada que la épica no tenga). PR destino: `epic/arquitectura`. Sin commit todavía.

#### Cambios realizados

- **`/admin` retirado (RF-1):** `landing-pages/src/middleware/admin-moved.ts` (nuevo), antes de `koa-static`. Con `ADMIN_NEW_URL`, GET y HEAD de `/admin` y `/admin/*` → 302 a `<ADMIN_NEW_URL>/` (destino fijo, sin la ruta ni la query), con `Cache-Control: no-store` y `X-Robots-Tag: noindex, nofollow`; cualquier otro método → 410 `{ error: { code: 'ADMIN_MOVED', … } }` sin leer el cuerpo. Sin `ADMIN_NEW_URL` → sigue al router (404 con el formato común). Nunca pone ni lee cookies.
- **Código borrado** (`git rm`): `routes/admin.ts`, `routes/admin-api.ts`, los 9 `controllers/admin*.ts`, `middleware/admin-guard.ts`, `services/{admin-bootstrap,admin-form,product-form,page-import}.ts`, `repositories/` (las 3), `views/admin/` y `styles/admin/`; scripts `build:css:admin` y `watch:css:admin`.
- **`app.ts`:** `AppOptions` = `{ config, landingProducts, landingPage, logger, now, viewsDir, publicDir }`; sin `products`, `pages`, `users`, `botControl`, `hashParams`, `createAdminGate` ni la suscripción `products.onChange` (la invalidación llega por el aviso interno).
- **`server.ts`:** `loadConfig` → cliente de la API → `landingProducts`/`landingPage` + `warmUp` → `createApp` → `listen` → `createInternalApp`. Sin Prisma, `verifyDatabase`, `DATA_DIR`, importaciones, `bootstrapAdmin` ni `botControl`. `server_started` lleva `adminMoved` en lugar de `adminStatus`, `botPanel`, `allowNewerSchema` y `*ReadOnly`.
- **`config/env.ts` (RF-2, P-T4):** sin `dataDir`, `database`, `allowNewerSchema`, `adminBootstrap`, `botPanel`, `botLimits`, `botKeys`, `loadDatabaseConfig`, `DEFAULT_DATA_DIR` ni la regla D-6; sin imports de `db`, `core/identity` ni `core/bot-control`. Esas variables se ignoran sin validarse. La regla D-6 la sigue comprobando la `api` con sus propias variables (`api/src/config.ts`), así que solo se retiró de las landings.
- **`routes/index.ts`** sin `admin`/`AdminRouteDeps`/`products`; **`controllers/landing.ts`**: comentario reescrito sin `DATA_DIR` (hallazgo 6).
- **Lint (RF-7):** `LANDING_CODE_FILES` = `landing-pages/src/**/*.ts` y `landing-pages/scripts/**/*.ts`; prohibidos `@restaurante/db`, Prisma, `mariadb`, `@prisma/*`, `core/identity` y `core/bot-control` (también con `import()`), y `@restaurante/core/catalog` con `allowImportNames` (`buildVisibleMenu`, `formatPesos`, `loadSeedDocument`, `mergePageData`, `pickPageData`, `SEED_FILES`, `validateMenuDocument` y los tipos `MenuDataByBusiness`, `MenuDocument`, `VisibleBirriaItem`, `VisibleMenuByBusiness`). Borrada la "REGLA DE TRANSICIÓN — TEMPORAL". `internal-app.ts` ya usaba `safeEqualStrings` de `core/shared` (PR 1).
- **`packages/` (RF-6):** borrados `parseChangeLog`/`parseChangeLine` (y su sección de `page-import.ts`), `addImportedChanges` (contrato, Prisma y memoria), `IMPORT_BATCH_SIZE` y `PageTransactionOptions` (solo los usaba `importPages`). `parseBotPanel`/`BotPanelConfig` (`core/bot-control/bot-config.ts`) quedaron sin uso y se borraron. Se conservan `planPageImport`, `seedPages`, `readImports`, `hasProductImports` y `PAGE_ACTIONS.RESTORE_SEED`. Comentarios que hablaban del `/admin` actual o de la importación desde `DATA_DIR` actualizados en `core`, `contracts`, `api` e `inventory-manager` (sin cambios de código).
- **CI (DEF-001 y hallazgo 3):**
  - `deploy/ci/smoke.sh`: el 503 `ADMIN_UNAVAILABLE` pasa a "302 a `https://$ADMIN_DOMAIN/`", "sin `Set-Cookie`" y "un POST a `/admin` → 410". El check de la vuelta atrás tras una migración nueva (`database_newer_than_code_allowed` en el log de la app) ya no puede cumplirse (la app no verifica la base): pasa a "sin ningún `database_*` en el log de la app". El 429 de la ráfaga sigue (el router `restaurante-admin` se conserva hasta el PR 3).
  - `ops/backup/ci/smoke.sh`: la app ya no importa productos ni escribe en `app-data`, y esta prueba no levanta la `api`. Inserta por SQL un producto de prueba (junto al usuario que ya insertaba) y escribe un JSON en `molotes/` y otro en `birria/` (como ya hacía con `birria/smoke.json`), así `backup.sh` y `verify-backup.sh` siguen pasando hasta el PR 3. `verify-backup.sh` no se toca (RN-6): seguirá exigiendo los JSON en una instalación nueva hasta el PR 3, que acepta respaldos sin `app-data`.
- **Documentación:** `README.md` (monorepo, regla de dependencias, puesta en marcha, scripts, pruebas HTTP, Docker/producción, API propia, admin nuevo, configuración, HTTP, bot, menús, nueva sección "Administración" con la tabla 302/410/404, usuarios, recuperar el acceso, `DATA_DIR`, base de datos y estructura); `docs/desarrollo.md` §3, §4 (ahora "MySQL local"), §5 y §8.3; `docs/arquitectura.md` §1, §4 (fin de la regla de transición y lista cerrada de `core/catalog`), §6, §8 (fila del ticket 6 y "Paso 4, ticket 6, PR 2 aplicado") y §10; `docs/despliegue.md` §8 punto 2 (comprobación del 302/410 y de que la app no usa la base), punto 4 y punto 5 (sin `/admin`), y la fila "El sitio sigue igual" de la tabla del webhook; `landing-pages/.env.example` (sin `DATABASE_URL`, `DATA_DIR`, `ADMIN_*`, `WHATSAPP_BOT_*` ni `DATABASE_ALLOW_NEWER_SCHEMA`; `ADMIN_NEW_URL` con el comportamiento nuevo); `landing-pages/.gitignore` (comentario de `data/`); `description` de `restaurante/package.json`; `.claude/CLAUDE.md` §8 (solo la frase autorizada).
- **Fuera de este PR (RF-8, RN-6):** `deploy/` (salvo `ci/smoke.sh`), compose, `ops/` (salvo `backup/ci/smoke.sh`), `Dockerfile` y `.github/` sin cambios. El CI del job `docker` sigue pasando `DATABASE_URL`/`DATA_DIR` a la app: ahora las ignora.

#### Pruebas (`.claude/rules/testing.md`)

- **Única prueba nueva:** `describe('/admin retirado de las landings (REQ-F-045, RF-1)')` en `tests/integration/app.test.ts` (8 casos): GET y HEAD de `/admin`, `/admin/login?x=1`, `/admin/bot` y `/admin/api/molotes/productos` → 302 a `<ADMIN_NEW_URL>/`, sin `Set-Cookie` y con `no-store`; POST, PUT, PATCH y DELETE con cuerpo → 410 `ADMIN_MOVED` sin cookies; sin la variable → 404; `/administracion` → 404. El cuerpo del 410 es de 32 KiB: con 2 MiB, PUT y PATCH daban `ECONNRESET` en el cliente (el servidor responde sin leerlo y cierra mientras el cliente aún envía); 10 ejecuciones seguidas 8/8. Comprobación de mutación (descartada): si GET deja de ser la condición del 302, fallan 3 casos.
- **Retiradas** (`git rm`), como en (b): 30 de `integration/` (las `admin-*` de `/admin`, `db-outage`, `bot-pantalla-qa-*`, `bot-protection-qa-*`, `users-api-qa-*`, `users-api-process`, `admin-bot-api-process`), 6 de `unit/` (`admin-form`, `product-form`, `promo-form`, `file-menu-repository`, `menu-repository-contract`, `bot-control-qa-req-f-043`) y 9 soportes (`admin-page`, `admin-products-api`, `admin-products-page`, `admin-authorization-matrix`, `admin-bot-qa-req-f-043-proceso`, `bot-pantalla-qa-req-f-043`, `bot-procesos-qa-req-f-042`, `users-api-qa-req-f-040`, `users-api-process`). `database-admin.ts` se conserva (lo usa la infraestructura de MySQL).
- **Retargeted a la `api` (obligatorias):**
  - `admin-recover.test.ts`: la sesión que se comprueba cerrada es la de `/api/v1/admin/sesion` (401 tras la recuperación; login 201 con la contraseña nueva).
  - `admin-recover-errores.test.ts`: la base de prueba con un administrador sin `setupAdmin`.
  - `last-admin-concurrency.test.ts`: el `describe` HTTP desactiva por `POST /api/v1/admin/usuarios/:id/desactivar` del proceso real de la `api` en paralelo con `../api/scripts/admin-recover.ts` (200 o 409; nunca cero administradores). El `describe` de repositorio no cambia.
  - `server-startup.test.ts` (CA-9): los cinco casos arrancan `../api/src/server.ts`. `server-startup-base.test.ts`: cae el caso de `DATA_DIR`.
  - Soporte: `support/admin.ts` reducido a credenciales, `makeClock`, `createUser`, `TEST_*` y `startApiAdmin()` (api real sobre una base de pruebas; login, petición con Bearer y CSRF, y desactivar). `support/server-startup.ts` sin `boot`/`dataDir`. `support/process.ts`: solo la `api` recibe una base de pruebas automática (las landings y el admin nuevo arrancan sin ella).
- **Modificadas y conservadas:** `admin-e2e` (CA-5) y `admin-users-e2e`: la landing arranca solo con `API_INTERNAL_URL` (y `ADMIN_NEW_URL`); en `admin-users-e2e` la `api` recibe `ADMIN_*` y las aserciones del `/admin` actual pasan a "302 al admin nuevo, 410 en un POST y sin cookies". `db-text-roundtrip` y `admin-products-atomicity` → `product-repository-atomicity` (`git mv`): mismos casos sobre los repositorios, `validateUserData` y el autenticador de `core/identity`. `landing-products`: caen "importación y landings" y "fallo de la base"; CA-7 a CA-11 con el doble de la API y la caché real. `landing-products-api`: caen CA-4 y DEF-003; quedan CA-5 a CA-7. `icons`: caen "favicon en /admin" y "administración deshabilitada", y la parte de `/admin/login` del caso de zona horaria. `server-startup-config`: cae REQ-F-025; el arranque de producción de CA-14 lleva ahora `DATABASE_URL` hacia un centinela y un `DATA_DIR` inexistente y comprueba que arranca sin ninguna conexión (RF-2). `api-process` CA-10: la landing arranca sin base y no registra nada de base ni de importación. `config.test.ts`: caen `DATA_DIR`, `DATABASE_URL`, `ADMIN_*` y bot; un caso nuevo por adaptación: "con esas variables presentes, incluso inválidas, la configuración es la misma" (test y production). `page-import.test.ts`: cae `parseChangeLog`. `helpers.ts`: `VALID_ENV` sin `DATABASE_URL`, sin `BOT_ENV`, `TWILIO_BOT_ENV`, `makeRepository` ni `seedPage`. `app.test.ts`, `landing-html-reference`, `request-logger`, `landing-products-api`: `createApp` sin `products`. Sin uso y borrados: `runningAsRoot` (`support/database.ts`), `landingPageFrom` (`support/landing-products.ts`), `sourcesFrom`/`makeProductsFor` (`support/products.ts`).

#### Criterios de aceptación (alcance del PR 2)

| CA | Estado |
| -- | ------ |
| CA-1 | Cumplido en local: `app.test.ts` (nueva) y `admin-users-e2e` (proceso real). En el VPS, tras el despliegue de la épica (`despliegue.md` §8.2). |
| CA-2 | Cumplido en local: 410 sin leer el cuerpo (`app.test.ts`). La base no puede cambiar: `landing-pages` ya no tiene base. |
| CA-3 | Cumplido: `app.test.ts` (404 sin `ADMIN_NEW_URL`). |
| CA-4 | Cumplido en local: `landing-html-reference` (21 respuestas byte a byte) y `landing-snapshot` en verde; `server-startup-config` CA-14 arranca en producción con `DATABASE_URL` hacia un centinela (0 conexiones) y `DATA_DIR` inexistente. El HTML de los 7 días contra `main` queda para QA. |
| CA-5 | Cumplido en local: `admin-e2e` (aviso interno → `products_change_notified` con `landing:true`), `internal-app` e `internal-notify-process` (401 sin credencial). |
| CA-8 / CA-9 | Cumplidos en local con la `api` real: `admin-recover*`, `last-admin-concurrency` y `server-startup` (5 casos) contra `../api/src/server.ts`. |
| CA-10 | Cumplido: `npm run lint` en 0 con el árbol real. A mano con `eslint --stdin` (sin escribir archivos) en `src/controllers/landing.ts` y `scripts/dev-server.ts`: fallan `@restaurante/db/client`, `core/identity`, `core/bot-control`, `createProductRepository` y `type PageRepository` de `core/catalog`, `@prisma/client` (`no-restricted-imports`) e `import('@restaurante/db/client')`/`import('@restaurante/core/identity')` (`no-restricted-syntax`); pasa `formatPesos` + `type MenuDocument`. |
| CA-11 | Sin cambios en el compose (RF-8): la vuelta atrás automática usa el mismo compose. Comprobación con la imagen anterior: QA. |
| CA-14 | Cumplido: `typecheck`, `lint` y `npm test` en verde; `grep -rn 'DATA_DIR\|DATABASE_URL\|ADMIN_USER\|admin-recover' landing-pages/src landing-pages/scripts` sin resultados. |
| CA-6, CA-7 | Del PR 1 (siguen en verde: `server-startup-base`, `admin-bootstrap` de la `api`). |
| CA-12, CA-13 | PR 3. |

#### Validaciones ejecutadas (resultado real)

- `npm run build:css`: 0 (sin la hoja de la administración).
- `npm run typecheck`: 0.
- `npm run lint`: 0, sin avisos.
- `npm test` (MySQL local con `npm run db:up`): `api` 49 archivos / 1162 pruebas; `landing-pages` 58 / 896; `inventory-manager` 16 / 278. Todo en verde. Las pruebas con procesos más largas: CA-10 de `api-process` 7,1 s (archivo ~16 s), `admin-users-e2e` 6,3 s, `admin-e2e` 5,2 s, `last-admin-concurrency` ~13 s el archivo.
- `bash -n` de los dos `smoke.sh`: 0. No se ejecutaron: `deploy/ci/smoke.sh` y `ops/backup/ci/smoke.sh` solo corren en el PR de la épica a `main` (el de respaldos necesita Linux, `age` y systemd; aquí tampoco hay `shellcheck`). Revisión de lectura: el 302 usa `redirect_of` (`%{redirect_url}` absoluto); el usuario `root` de MySQL inserta el producto con solo las columnas sin valor por defecto (`business`, `category`, `slug`, `name`, `position`, `updated_at`); el conteo `PRODUCTS` del manifiesto se compara con el de la base, no con un número fijo; los JSON se escriben con `docker exec` en la app, como ya se hacía.
- `git diff` revisado: solo cambios del PR 2; `Cotizador_Taquiza_Birria.xlsx` fuera.

#### Archivos afectados

- Nuevo: `restaurante/landing-pages/src/middleware/admin-moved.ts`.
- Borrados: el código de `/admin` listado arriba (`src/routes/admin*.ts`, `src/controllers/admin*.ts`, `src/middleware/admin-guard.ts`, `src/services/{admin-bootstrap,admin-form,product-form,page-import}.ts`, `src/repositories/`, `src/views/admin/`, `src/styles/admin/`) y las pruebas y soportes retirados.
- Movido: `landing-pages/tests/integration/admin-products-atomicity.test.ts` → `product-repository-atomicity.test.ts`.
- Modificados: `landing-pages/{src/app.ts,src/server.ts,src/config/env.ts,src/routes/index.ts,src/controllers/landing.ts,package.json,.env.example,.gitignore}`, las pruebas listadas, `eslint.config.ts`, `package.json`, `packages/core/{catalog/page-import.ts,catalog/page-store.ts,catalog/memory-page-store.ts,catalog/product-repository.ts,catalog/product-form-fields.ts,catalog/menu-schema.ts,bot-control/bot-config.ts,bot-control/bot-control.ts,identity/session-store.ts,identity/user-schema.ts}`, `packages/db/src/prisma-page-store.ts`, `packages/contracts/product-form.ts`, `api/src/{config.ts,install/index.ts,admin/index.ts,admin/user-routes.ts,admin/account-routes.ts,bot/control-timers.ts}` (comentarios), `inventory-manager/src/controllers/account.ts` (comentario), `deploy/ci/smoke.sh`, `ops/backup/ci/smoke.sh`, `README.md`, `docs/{arquitectura,desarrollo,despliegue}.md` y `.claude/CLAUDE.md` §8.

#### Riesgos o pendientes

- **`deploy/ci/smoke.sh`:** ahora hace tres peticiones a `/admin` (302, cabeceras y POST 410) en lugar de una, más tarde que la ráfaga de 30. Si el límite de `restaurante-admin` (10/min, ráfaga 20) no se hubiera recargado, saldría 429. Entre las dos secciones hay varios despliegues (más de un minuto), y la comprobación anterior del 503 tenía el mismo riesgo; se verá en el PR de la épica a `main`.
- **Los dos `smoke.sh` no se pudieron ejecutar aquí** (solo corren hacia `main`); queda para el CI de la épica o para QA (D-7 del PR 1).
- **`verify-backup.sh`** sigue exigiendo un JSON en `molotes/` y `birria/` de `app-data`: en una instalación nueva hecha con el PR 2 (no es el caso de producción) un respaldo fallaría la verificación hasta el PR 3. La prueba de humo de respaldos escribe ella misma esos JSON (DEF-001).
- **`.claude/rules/testing.md`** (líneas 25 y 31) sigue citando `setupAdmin`, que ya no existe (ahora `startApiAdmin` y `makeDatabase`). No lo toqué: editar las reglas no está autorizado en este ticket. `.claude/agents/senior-fullstack.md` también describe el `/admin` de `landing-pages` (fuera de lo autorizado, como en el PR 1).
- **Código de `core` que solo queda en uso por pruebas**, fuera del alcance acordado y sin tocar: el modo `'panel'` de `createBotControl` (solo lo usa `api/tests/unit/bot-control-timers.test.ts` para simular un segundo proceso) y las ramas `current`/`previous` de `planPageImport` (la siembra de la `api` solo usa la semilla; se conservan con sus pruebas, como decía (b)). Retirarlos sería un cambio de `core` y de pruebas de la `api`; se propone como tarea aparte.
- La imagen `production` sigue llevando `packages/db` y Prisma (adelgazarla está fuera de alcance), y el `Dockerfile` conserva el `mkdir /var/lib/restaurante` hasta el PR 3.

#### Limpieza

Sin bases `restaurante_test*` en el MySQL de pruebas (`SHOW DATABASES`: solo `restaurante`, `restaurante_shadow` y las del sistema), sin procesos de Vitest, `src/server.ts` ni `admin-recover`, sin puertos de node escuchando, un solo worktree (`git worktree list`). La copia de la comprobación de mutación se borró y `admin-moved.ts` quedó como estaba (`git diff` sin cambios tras restaurarlo). MySQL detenido con `npm run db:down` (estaba apagado al empezar). En el scratchpad quedan `cot.xlsx`, `cotizador-analisis.md` y `venv/`, que no son de esta tarea.

## QA Action Plan (PR 1)

Alcance: **PR 1 de 3** (`feature/REQ-F-045-retirada-admin-actual-1-arranque`, cambios sin commit, PR a `epic/arquitectura`). Preparado el 2026-11-16 por `senior-qa` tras la aprobación de la implementación del PR 1 por el usuario ("si", incluida la desviación de sembrar la página antes que los productos). Análisis con `codegraph_explore` (`prepareInstallation`, `seedPages`, `importBusiness`, `confirmedByOther`, `isWriteConflict`, `safeEqualStrings`, `loadSeedDocument`, `parseAdminBootstrap`, arranque de `landing-pages`) y lecturas dirigidas de Dockerfile, `package.json`, `deploy/ci/smoke.sh`, `ops/backup/ci/smoke.sh`, `ci.yml` y `read-hidden.ts`. NotebookLM: no consultado en esta fase (sus herramientas MCP no se usaron; el ticket y el repositorio son la fuente).

### Objetivo

Comprobar con evidencia que, en el PR 1, la `api` prepara una instalación nueva (página, productos y primer administrador) y respeta una instalación existente, que los comandos de consola funcionan desde la `api`, que las semillas y `safeEqualStrings` cambiaron de sitio sin cambiar de comportamiento, y que `landing-pages` (incluido su `/admin` actual), `inventory-manager`, el despliegue y los respaldos no sufren regresiones.

### Requisito bajo prueba

- RF-4 / RN-2 (instalación nueva en `api`), RF-5 / RN-3 (recuperación y hash en `api`), RF-8 (compose sin cambios hasta el PR 3).
- Technical Action Plan, PR 1: semillas en `core/catalog`, tolerancia a la carrera (c), `safeEqualStrings` en `core/shared`, Dockerfile, alias de la raíz, documentación del PR 1.
- Desviación aprobada: página antes que productos, para que un arranque cortado entre los dos pasos se complete en el siguiente.
- Fuera de este QA: CA-1 a CA-5, CA-10, CA-11 y CA-14 (PR 2), CA-12 y CA-13 (PR 3).

### Criterios de aceptación (cada uno → pruebas que lo cubren)

| CA / requisito | Pruebas |
| -- | -- |
| CA-6 (base vacía → semilla en los dos negocios, administrador que entra; segundo arranque sin cambios) | F-1, F-2, D-3, A-1 (`server-startup-base`) |
| CA-7 (existente → ni semilla ni usuarios; sin filas de página → "no disponible") | F-3, F-4, A-1 (`admin-bootstrap` api) |
| CA-8 (recuperación en `api`; concurrencia del último admin) | F-7, F-8, D-4, A-1 (`admin-recover*`, `last-admin-concurrency`) |
| CA-9 (base inválida → código ≠ 0, mensaje sin detalles) | N-1, N-2, A-1 (`server-startup-base` api) |
| RF-4 idempotencia y seguridad en paralelo | F-2, C-1, C-2, C-3 |
| Orden página → productos y reanudación | F-5, F-6 |
| Fallos de paso → 1 y mensajes sin detalles | N-1 a N-5 |
| ADMIN_USER/ADMIN_PASSWORD_HASH sin filtrar secretos | S-1 a S-4 |
| RF-5 (`admin-recover`/`hash-password` desde la imagen `api` y la raíz) | F-7, F-8, F-9, D-4 |
| `safeEqualStrings` en `core/shared` | R-4, S-5 |
| Semillas idénticas y fallback de las landings | R-1, R-2, D-5 |
| Imágenes (`production` sin `scripts/`; `api` con scripts y semillas) | D-1, D-2 |
| RF-8: `deploy/`, compose y `ops/` sin cambios | R-5 |
| `/admin` actual intacto; regresión de las 3 apps | A-1, R-6, D-6 |
| Lint de dependencias, typecheck, lint, suite | A-2, A-3, L-1 |
| Documentación vs implementación | Doc-1 a Doc-4 |

### Riesgos identificados

1. **Carrera de dos arranques** (`api` + landing con `Promise.all`): el perdedor debe registrar `reason:'concurrent'` y seguir; riesgo de flakiness por la espera acotada (20 × 250 ms) de `confirmedByOther`.
2. **Instalación nueva entre el PR 1 y el PR 2 con el orden del despliegue real** (`deploy.sh` arranca la `api` y después la app): la `api` siembra primero, la landing ve una instalación "existente" y `createFileMenuRepository.init({ seedMissing: false })` ya no escribe los JSON en `DATA_DIR`. `ops/backup/ci/smoke.sh:170` exige `molotes/*.json` en `app-data` y `verify-backup.sh` exige un JSON en cada carpeta. El ticket prevé ajustar ese smoke en el PR 2, pero hay que medir el efecto real del PR 1 (D-3) y clasificarlo.
3. **Corte dentro de `products.init`** entre los dos negocios (Molotes importado, Birria no): en el siguiente arranque `hasProductImports` es true y Birria no se importa. Mismo comportamiento que la landing antes del ticket; se comprueba (F-6b) y se clasifica (defecto, comportamiento heredado o ambigüedad).
4. **Error de lectura de la semilla fuera de `step`** (`seeds()` en `prepareInstallation:96`): un error que no sea de validación (archivo ilegible o JSON roto) no es `InstallationError`, `server.ts` lo relanza y Node puede imprimir la traza y la ruta (N-4).
5. **Secretos**: el hash o el usuario en logs o en `stderr` (config, bootstrap ignorado, fallos de paso).
6. **Alias de la raíz**: `admin:recover` usa `--env-file-if-exists=.env` relativo a `api/`; antes era `landing-pages/.env`. Riesgo de que la documentación siga apuntando a la `.env` de la landing.
7. **Imágenes**: un `COPY` que falte (scripts, `support/`, semillas) solo se ve en la imagen.
8. **`safeEqualStrings`**: un consumidor que siga importando de `core/identity` (rompería en PR 2) o una comparación que deje de ser de tiempo constante.
9. **Restos**: `.claude/agents/senior-fullstack.md` sigue nombrando `src/content/<negocio>/seed.json` (fuera de lo autorizado; se reporta, no es defecto del PR); `Cotizador_Taquiza_Birria.xlsx` sin seguimiento en la raíz no debe entrar en el PR.

### Pruebas funcionales (proceso real de la `api` contra MySQL de pruebas, bases `restaurante_test*` creadas con `makeScratchDatabase()`; sondas temporales)

- **F-1** Base vacía y migrada + `ADMIN_*` válidas → `page_seeded` ×2 (`source: seed`), `products_imported` ×2 (`source: seed`), `admin_bootstrap_created` (solo `userId`), `server_started`; `/api/v1/productos/{molotes,birria}` y `/pagina` en 200 con el contenido de la semilla (precio del hero $145/$195); login por `/api/v1/admin/sesion` con la contraseña del hash.
- **F-2** Segundo y tercer arranque sobre la misma base → recuentos de `product`, `product_change`, `product_import`, `page_version`, `page_import`, `user`, `user_audit` idénticos; sin `products_imported`, `page_seeded` ni `admin_bootstrap_created`; con `ADMIN_*` presentes, `admin_bootstrap_ignored` sin valores.
- **F-3** Instalación existente (marcas de productos presentes) sin filas de página → la `api` arranca, no siembra página ni crea usuarios, y `/api/v1/pagina/<negocio>` responde "no disponible" (CA-7).
- **F-4** Base vacía sin `ADMIN_*` → arranca, `admin_disabled`, cero usuarios; el login del admin nuevo no deja entrar; `admin-recover` lo resuelve (enlaza con F-7).
- **F-5** Orden: en F-1, el log muestra `page_seeded` antes de `products_imported`.
- **F-6a** Reanudación tras corte entre página y productos: estado con `page_import` ×2 y sin productos ni `product_import` (obtenido arrancando y vaciando las tablas de productos, o sembrando solo la página con `seedPages` desde la sonda) → el siguiente arranque importa los productos (`products_imported` ×2), no vuelve a sembrar la página (sin `page_seeded`) y termina en 200.
- **F-6b** Corte dentro de los productos (solo Molotes importado): se observa y documenta el resultado (riesgo 3).
- **F-7** `node scripts/admin-recover.ts --usuario qa` (desde `api/` con `DATABASE_URL` de prueba explícita, contraseña por tubería) → crea o recupera el administrador, cierra sus sesiones, `console_recovery` en `user_audit`, mensaje final que remite al admin nuevo sin `/admin`; la contraseña no aparece en stdout/stderr.
- **F-8** Alias de la raíz: `npm run admin:recover -- --usuario` (uso) y `npm run admin:hash-password` delegan en `-w api` (ver autorización 5 para la ejecución contra base).
- **F-9** `hash-password` (tubería) → una línea `scrypt$…` que `parsePasswordHash` acepta y con la que el login de F-1 funciona; no imprime la contraseña.

### Pruebas negativas y casos límite

- **N-1** Base sin migrar / migración incompleta → 1, `database_init_failed`, mensaje sin URL, SQL ni traza (prueba existente, repetida y leída).
- **N-2** D-15 productos ilegibles → 1 sin detalles (existente).
- **N-3** `page_seed_failed`: base vacía con una fila de `page_version` huérfana (sin `page_import`) → choque real → tras la espera acotada, 1, `page_seed_failed` solo con `name`/`code`, mensaje "No se pudo preparar la página…", sin datos de la fila.
- **N-4** Semilla ilegible o inválida: sonda unitaria de `loadSeeds` con un cargador que lanza (error de E/S con ruta en el mensaje) y con un documento inválido → comprobar si termina en `InstallationError` (`install_seed_invalid`) o se escapa (riesgo 4); si se escapa, ver qué imprimiría el proceso.
- **N-5** Mapeo de cada paso (`state`, `pages`, `products`, `admin`) con dobles que lanzan errores cuyo mensaje contiene un secreto simulado → `InstallationError` con el evento correcto y `fields` sin el mensaje.
- **N-6** `admin-recover` con la base caída o sin migrar → el mismo mensaje controlado sin detalles, código 1 (existente `admin-recover-errores`, repetida).
- **N-7** `products_import_skipped`/`page_seed_skipped` solo con choques reales: un error no de conflicto (p. ej. base caída en mitad) se relanza (sonda unitaria de `isWriteConflict`/`confirmedByOther` con dobles: P2002, P2034, 1062, 1213 → conflicto; otro código → no).

### Pruebas de concurrencia (flakiness)

- **C-1** `api-process.test.ts` (CA-10 modificado) **20 veces seguidas** → 20/20; en cada una sin ningún `*_init_failed`, `page_seed_failed`, `page_import_failed` ni `admin_bootstrap_failed`, y `product_import` = 2, `page_import` = 2, un usuario.
- **C-2** Sonda con los dos procesos y desfases (0, 100, 300 ms en ambos sentidos), 5 repeticiones por desfase → ambos procesos en marcha (código de salida distinto de "terminó con error"), recuentos correctos; se cuenta cuántas veces aparece `reason:'concurrent'` en cada proceso (evidencia de que la rama se ejercita, no solo que no falla).
- **C-3** `last-admin-concurrency.test.ts` 10 veces → 10/10, nunca cero administradores.
- Si alguna repetición falla, se captura el log completo del fallo y se repite el lote para estimar la frecuencia antes de clasificar.

### Pruebas de seguridad (secretos)

- **S-1** `ADMIN_USER` sin `ADMIN_PASSWORD_HASH` (y viceversa), usuario inválido y hash mal formado en la `api` → 1 con los textos de `config.ts`; stderr y stdout sin el valor del hash ni del usuario (grep del valor).
- **S-2** Logs de F-1/F-2/F-4 (JSON) sin el hash, el usuario ni la contraseña.
- **S-3** `admin-recover` y `hash-password`: la contraseña nunca aparece en la salida.
- **S-4** Fallo de paso (N-3, N-5): sin `DATABASE_URL`, SQL ni traza.
- **S-5** `safeEqualStrings`: iguales → true; distintos, de distinta longitud, vacío y no-string → false sin lanzar; las dos entradas pasan por SHA-256 de 32 bytes antes de `timingSafeEqual` (sin salida temprana por longitud). Medición orientativa de tiempos (iguales vs. difieren en el primer byte vs. distinta longitud, 10⁵ iteraciones): solo informativa, no criterio por sí sola.

### Pruebas de Docker / imágenes (locales, se descartan)

- **D-1** `docker build --target api` (etiqueta `qa-req-f-045-api`) → existen `scripts/admin-recover.ts`, `scripts/hash-password.ts`, `scripts/support/read-hidden.ts` y `/app/packages/core/catalog/seeds/{molotes,birria}.json`; no existen `scripts/bot-chat.ts` ni `scripts/dev-server.ts`.
- **D-2** `docker build --target production` (`qa-req-f-045-app`) → sin `/app/landing-pages/scripts`; `loadSeedDocument` resuelve las semillas dentro de la imagen; `migrate` (`qa-req-f-045-migrate`) se construye igual que antes.
- **D-3** **Pila efímera propia** (red y volúmenes `qa-req-f-045-*`, MySQL 8.4 con credenciales de prueba inventadas, sin `.env` real; puertos solo en `127.0.0.1`): migrate → `api` (espera `healthy`) → app con `DATA_DIR` en un volumen propio, en el orden de `deploy.sh`. Comprobar: los dos `healthy`; logs de la `api` (siembra) y de la app (sin `*_failed`; qué hace su importación al encontrar las marcas); `/molotes` y `/birria` 200 con la semilla; `/admin/login` de la landing como antes; **contenido del volumen `DATA_DIR`** (riesgo 2). Reinicio de los dos: sin cambios en los recuentos.
- **D-4** En esa pila: `docker exec <api> node scripts/admin-recover.ts --usuario qa` (contraseña por tubería) → `console_recovery`; `docker exec <api> node scripts/hash-password.ts` → hash válido.
- **D-5** Fallback: la app de la imagen `production` con la `api` detenida → `/molotes` y `/birria` 200 con la semilla (registra el uso de la semilla).
- **D-6** `/admin` de la landing en la pila (sin `ADMIN_NEW_URL`, como en local) responde como antes del ticket.
- **D-7 (opcional, ver autorización 3)** `deploy/ci/smoke.sh` real. En macOS no corre directo (exige GNU `find`/`stat`, `flock`, `sha256sum` y el puerto 5000, que aquí está ocupado). Se intentaría dentro de un contenedor Linux auxiliar (`docker:cli` + `bash curl jq gzip util-linux coreutils findutils`) con el socket de Docker montado, `--network host` y `SMOKE_WORKDIR` en el scratchpad (ruta compartida con Docker Desktop); descarga `traefik` y `registry` fijados por digest; proyecto `restaurante-smoke` y contenedores `smoke-*`. Si no funciona tras 2 intentos, queda como **pendiente** (corre en el PR de la épica a `main`) y D-3 es la evidencia. `ops/backup/ci/smoke.sh` no se ejecuta (necesita `age`, systemd y Linux; el ajuste está previsto en el PR 2): su supuesto se comprueba en D-3.

### Pruebas de regresión

- **R-1** Semillas byte a byte: `git show d261ff8:restaurante/landing-pages/src/content/<negocio>/seed.json` y `d261ff8:restaurante/api/tests/fixtures/seeds/<negocio>.json` contra `packages/core/catalog/seeds/<negocio>.json` con `cmp` y SHA-256.
- **R-2** Landings: `landing-html-reference`, `landing-snapshot`, `landing-products-api` (API caída → semilla), `content`, `birria-veracity` en verde; `SEED_FILES` apunta a `core`.
- **R-3** `landing-pages/src/content/seeds.ts` solo reexporta (sin lógica duplicada).
- **R-4** Consumidores de `safeEqualStrings` (CodeGraph + grep): `internal-app.ts`, `admin-guard.ts`, `api/src/admin/access.ts`, `whatsapp-bot.ts`, `admin-auth.test.ts`; ninguno importa ya de `core/identity` y `identity` no la exporta. Pruebas que los cubren en verde: `internal-app`/`internal-notify-process` (401 con credencial incorrecta), CSRF de la `api`, verificación del webhook.
- **R-5** `git diff d261ff8 -- restaurante/deploy restaurante/ops restaurante/compose.yaml .github` vacío.
- **R-6** `/admin` actual: toda la suite `admin-*` de `landing-pages` en verde; la landing conserva `importPages`, `bootstrapAdmin` y su validación de `ADMIN_*`.
- **R-7** `git status`/`git diff --stat`: solo archivos del PR 1; sin pruebas nuevas no permitidas (`testing.md`): solo traslados y el caso añadido a `admin-bootstrap` (api); sin `qa-req-f-*`.

### Pruebas automatizadas

- **A-1** `npm test` completo desde `restaurante/` (las 3 apps, MySQL de pruebas con `npm run db:up`).
- **A-2** `npm run typecheck` → 0.
- **A-3** `npm run lint` → 0 sin avisos (no `lint:fix`).
- **L-1** Lint de dependencias sin tocar archivos: `npx eslint --stdin --stdin-filename <ruta>` con imports de prueba → debe fallar: `api/src` importando `landing-pages/src/content/seeds.ts`; `packages/core/shared` importando `@restaurante/db`; `packages/core/catalog` importando `@restaurante/web`. Y pasar: `api/src` importando `loadSeedDocument` de `@restaurante/core/catalog` y `safeEqualStrings` de `@restaurante/core/shared`.
- Sondas temporales (F-*, N-3 a N-7, S-*, C-2): en `restaurante/landing-pages/tests/qa-req-f-045-*.test.ts` y soporte en el mismo prefijo, usando `listenLocal`, `makeScratchDatabase`, `bootApi`/`logLines` existentes. **Se borran al terminar y no se commitean.** Si una encuentra un defecto no cubierto, se propone (no se añade) la prueba funcional más barata.

### Documentación vs implementación

- **Doc-1** `README.md` (comandos, primera ejecución, "Recuperar el acceso", árbol), `docs/desarrollo.md`, `docs/despliegue.md` §1 y §5, `docs/arquitectura.md`: cada comando citado se ejecuta tal como está escrito (en la pila de D-3 o en local con la base de prueba) y cada ruta existe.
- **Doc-2** `api/.env.example` (`ADMIN_*` opcionales) coincide con `config.ts`; `landing-pages/.env.example` sin rutas obsoletas a `src/content/*/seed.json` ni a `landing-pages/scripts`.
- **Doc-3** Grep en el repo (excluyendo `.claude/docs/done/` y el historial) de `landing-pages/scripts/admin-recover`, `landing-pages/scripts/hash-password`, `src/content/<negocio>/seed.json`, `exec app node scripts/admin-recover`, `api/tests/fixtures/seeds` → solo restos justificados.
- **Doc-4** La nota de `despliegue.md` §5 para una `api` anterior tras una vuelta atrás es coherente con las imágenes de D-1/D-2.

### Pruebas en navegador / responsive / accesibilidad / UX / SEO / performance

No aplican: el PR 1 no cambia HTML, CSS ni JS del navegador. La no regresión visual queda cubierta por `landing-html-reference` y `landing-snapshot` (R-2) y por el HTML servido en D-3/D-5. Performance: solo se registra el tiempo de arranque de la `api` en F-1 y la espera de la carrera en C-2 (informativo).

### Autorizaciones temporales que pido

1. **MySQL de pruebas**: `npm run db:up` / `npm run db:down` (contenedor `mysql-dev` del `compose.yaml`; solo bases `restaurante_test*`; si estaba apagado al empezar, se vuelve a apagar).
2. **Sondas** en `restaurante/landing-pages/tests/qa-req-f-045-*` (y soporte con el mismo prefijo), borradas al terminar.
3. **Docker**: construir 3 imágenes `qa-req-f-045-{app,api,migrate}` y levantar la pila efímera de D-3 a D-6 (red, volúmenes y contenedores `qa-req-f-045-*`, puertos solo en `127.0.0.1`, credenciales inventadas). **Opcional**, por separado: D-7 (`smoke.sh` real en un contenedor auxiliar con el socket de Docker, `--network host`, descarga de `traefik`/`registry` por digest y la imagen `inventory-manager`). Nada toca producción, GHCR ni el VPS.
4. **Sin copias del árbol ni worktrees**: no hacen falta (las mutaciones se hacen con dobles y `--stdin` de ESLint).
5. **Alias `npm run admin:recover` contra una base**: el script carga `api/.env` (`--env-file-if-exists`) aunque `DATABASE_URL` se pase explícita (prevalece la del entorno). Opciones: (a) autorizarlo con `DATABASE_URL` de prueba explícita; (b) **recomendada**: validar el alias solo en caminos que no conectan (mensaje de uso) y la ejecución contra base con `node scripts/admin-recover.ts` directo (sin cargar `.env`) y en la imagen `api`.

### Limpieza (se comprueba, no se supone)

- Bases: `SHOW DATABASES LIKE 'restaurante_test%'` → solo las de una ejecución en curso (ninguna al final); borrado solo con prefijo `restaurante_test`.
- Procesos y puertos: sin Vitest, `node …/server.ts` ni contenedores de QA (`ps`, `lsof -iTCP -sTCP:LISTEN`, `docker ps -a --filter name=qa-req-f-045`, `name=smoke-`).
- Docker: `docker rm -f`, `docker network rm`, `docker volume rm` e `docker image rm` de todo `qa-req-f-045-*` (y de `restaurante-smoke`/`smoke-*`, `traefik`/`registry` descargadas si se hizo D-7); `docker builder prune` solo de la caché creada si crece.
- Archivos: sondas borradas (`git status` igual que al empezar), scratchpad vaciado, `git worktree list` con un solo árbol.
- MySQL detenido con `npm run db:down` si estaba apagado al empezar.

### Evidencia requerida

Salidas de `npm test` (resumen por app), `typecheck`, `lint`; recuentos SQL antes/después; extractos de logs JSON con los eventos; códigos de salida y stderr de cada caso negativo; tabla de repeticiones de C-1 a C-3 (pasadas/total y apariciones de `reason:'concurrent'`); `ls` dentro de las imágenes; `cmp`/SHA-256 de las semillas; `git diff --stat` de `deploy/ ops/ compose.yaml`; salida de ESLint `--stdin`; registro de la limpieza.

### Criterios de aprobación

- CA-6, CA-7, CA-8 y CA-9 en PASS con evidencia de proceso real (no solo dobles).
- C-1 20/20 y C-3 10/10; C-2 sin ningún arranque fallido.
- Ningún secreto en logs ni mensajes (S-1 a S-4).
- Semillas idénticas (R-1), imágenes correctas (D-1, D-2), `deploy/`/compose/`ops/` sin cambios (R-5).
- `typecheck`, `lint` y `npm test` en 0; sin regresión en `/admin` ni en las landings.
- Sin defectos `BLOCKER`/`CRITICAL`; cualquier `MAJOR` (p. ej. si el riesgo 2 rompe una instalación nueva o los respaldos antes del PR 2) se lleva al usuario como `NEEDS_USER_DECISION`.
- D-7 no bloquea la aprobación si no se puede ejecutar: queda como pendiente para el PR de la épica a `main`, con D-3 como evidencia.

### Aprobación del QA Action Plan

El usuario lo aprueba el 2026-11-16. Cita textual: "apruebo todo con b". Quedan aprobadas las autorizaciones 1 a 3 y D-7, con la opción (b) para el alias `admin:recover`.

## QA Report (PR 1)

### Ronda

1 (PR 1). Ejecutada el 2026-11-16 sobre `feature/REQ-F-045-retirada-admin-actual-1-arranque` (base `d261ff8`, cambios sin commit; `git status` con 47 entradas antes y después del QA).

### Pruebas ejecutadas

| Prueba | Acción | Resultado real |
| -- | -- | -- |
| A-2 | `npm run typecheck` | 0 |
| A-3 | `npm run lint` | 0, sin avisos |
| A-1 | `npm test` (las 3 apps, MySQL de pruebas) | `api` 49 archivos / 1161 pruebas; `landing-pages` 94 / 1310; `inventory-manager` 16 / 278; EXIT 0. Una primera ejecución se interrumpió a propósito porque Vitest habría recogido una sonda recién creada; se repitió con el árbol sin sondas. |
| C-1 | `api-process.test.ts -t "CA-10"` ×20 | 20/20 |
| C-3 | `last-admin-concurrency.test.ts` ×10 | 10/10 (4 pruebas en cada una) |
| C-2 | Sonda: `api` y landing a la vez con desfases de 0, 100, 300, −100 y −300 ms, 5 repeticiones cada uno | 25/25 arrancan los dos, sin `*_failed`, con `product_import`=2, `page_import`=2 y 1 usuario. `reason:'concurrent'`: en la landing 5/5 con desfases de 0 y 100; en la `api` 5/5 con −100; ninguno con ±300 (no hubo choque). Las dos ramas se ejercitan. |
| F-1/F-5 | Sonda: base vacía | La `api` arranca en 638 ms. Orden `page_seeded`×2 → `products_imported`×2 → `admin_bootstrap_created` (solo `userId`) → `server_started`. Login 201. `/pagina` de Birria con 19500 y de Molotes con 14500. |
| F-2 | Sonda: 2.º y 3.er arranque | Recuentos idénticos (16 productos, 16 cambios, 2+2 marcas, 4 versiones de página, 1 usuario, 1 auditoría); `admin_bootstrap_ignored` solo con `reason:users_exist`. |
| F-3 | Sonda: instalación existente sin filas de página | Sin `page_seeded`, `products_imported` ni `admin_bootstrap_created`; `/pagina` → 503 `PAGE_UNAVAILABLE`; recuentos sin cambios. |
| F-4 + F-7 | Sonda: sin `ADMIN_*`, después `node ../api/scripts/admin-recover.ts` directo | `admin_disabled` y 0 usuarios; login 401. El script termina con 0 y responde "Se creó el administrador "qa". Ya puede entrar en el admin nuevo con la contraseña nueva."; login 201. La segunda recuperación sube `session_version` de 0 a 1 (sesiones cerradas). Dos `console_recovery` en la auditoría. La contraseña no aparece en la salida. |
| F-6a | Sonda: estado "página sembrada, sin productos" | El siguiente arranque importa los productos (`products_imported`×2), no vuelve a sembrar la página y deja las filas de `page_version` intactas. |
| F-6b | Sonda: solo Molotes importado | Ver la observación O-2. |
| F-8 | Alias de la raíz (opción b) | `npm pkg get`: la raíz delega con `-w api`, `api` define los dos scripts y `landing-pages` ya no los tiene. `npm run admin:hash-password` (no carga `.env`) imprime `scrypt$…`. No se ejecutó `npm run admin:recover`, para no leer `api/.env`. |
| F-9 | `hash-password` por tubería | Código 0, solo `scrypt$…`, sin la contraseña; con ese hash en `ADMIN_*` el login responde 201. |
| N-1/N-2/N-6 | Pruebas existentes (`server-startup-base` contra la api, `admin-recover-errores`) | En verde dentro de A-1. |
| N-3 | Sonda: fila huérfana en `page_version` | Termina con 1 en unos 5,3 s (espera acotada). Stderr: "No se pudo preparar la página de los negocios en la base de datos."; `page_seed_failed` solo con `name`/`code` (`DatabaseUnavailableError`, `P2002`); sin datos de la fila, SQL, URL ni traza; nada escrito. |
| N-4 | Sonda unitaria de `loadSeeds`/`prepareInstallation` | Semilla inválida → `InstallationError` (`install_seed_invalid`, `{business, path}`). Semilla ilegible → **no** es `InstallationError` (ver DEF-002). |
| N-5 | Sonda unitaria: cada paso con un error que lleva un "secreto" | `state`, `pages`, `products` y `admin` → su evento, `fields` solo `{name, code}` y el mensaje fijo; el secreto no aparece. |
| N-7 | Sonda unitaria | `isWriteConflict`: P2002, P2034, 1062 y 1213 → true; P1001, 2002 y un `Error` cualquiera → false. `confirmedByOther`: true al aparecer la marca y false si la lectura falla siempre. |
| S-1 | Sonda: 4 configuraciones inválidas de `ADMIN_*` en la `api` | Termina con 1 y los textos de `config.ts`; ni el usuario ni el hash aparecen en stdout ni stderr. |
| S-2/S-3/S-4 | Logs de F-1, F-2, F-4, F-7, F-9 y N-3 | Sin hash, contraseña ni nombre de usuario. |
| S-5 | Sonda unitaria | Iguales → true; distintos, de otra longitud o vacíos → false. `core/identity` ya no exporta `safeEqualStrings`. Tiempos orientativos con un secreto de 64 caracteres: iguales 1808 ns, primer byte distinto 1843, último byte distinto 1828, entrada de 1 carácter 1785 (sin diferencia por posición; 4096 caracteres tardan más por el hash de la entrada, no del secreto). |
| R-1 | `cmp` contra `d261ff8` | Las dos semillas son idénticas byte a byte a `landing-pages/src/content/<negocio>/seed.json` y a `api/tests/fixtures/seeds/<negocio>.json`. SHA-256: molotes `e362fb29…0942681`, birria `8b7c185c…a82d`. `loadSeedDocument` devuelve copias nuevas y rechaza un negocio desconocido. |
| R-4 | grep + CodeGraph | `safeEqualStrings` solo desde `@restaurante/core/shared`: `internal-app.ts`, `admin-guard.ts`, `api/src/admin/access.ts`, `whatsapp-bot.ts` y `admin-auth.test.ts`. |
| R-5 | `git diff --stat d261ff8 -- deploy ops compose.yaml .github eslint.config.ts` | Vacío. |
| L-1 | `eslint --stdin` con nombres de archivos existentes, sin escribirlos | Fallan con `no-restricted-imports`: `api/src` → `landing-pages/src/content/seeds.ts`, `core/shared` → `@restaurante/db/client` y `core/catalog` → `@restaurante/web`. Pasan: `api/src` → `loadSeedDocument` (core/catalog), `safeEqualStrings` (core/shared) y `node:timers/promises` en core. |
| D-1 | Imagen `api` | WORKDIR `/app/api`; `scripts/admin-recover.ts`, `scripts/hash-password.ts`, `scripts/support/read-hidden.ts` y `/app/packages/core/catalog/seeds/{molotes,birria}.json` presentes; sin `bot-chat.ts` ni `dev-server.ts`. |
| D-2 | Imagen `production` | Sin `scripts/`; `content/seeds.ts` carga la semilla desde `/app/packages/core/catalog/seeds/`. Las imágenes `migrate` e `inventory-manager` se construyen. |
| D-3 | Pila efímera (MySQL 8.4 con `01-usuarios.sh`, migrate, `api` y después la app, como `deploy.sh`) | Las dos `healthy`. La `api` registra `page_seeded`×2 y `products_imported`×2. La app arranca sin `*_failed`, con `menu_data_missing`×2. `/`, `/molotes` y `/birria` → 200 con $145 y $195. Tras reiniciar las dos, los recuentos son iguales y no hay resiembra. `DATA_DIR` queda **sin JSON** (solo `molotes/` y `birria/`): ver DEF-001. |
| D-4 | `docker exec -i <api> node scripts/admin-recover.ts --usuario qa-docker` y `hash-password` | Código 0, `console_recovery`, login por la `api` 201; contraseña ausente de la salida. Sin `DATABASE_URL`: mensaje controlado y código 1. |
| D-5 | La `api` detenida y la app reiniciada | `/molotes` y `/birria` 200 con la semilla (`landing_*_fallback` `source: seed`). |
| D-6 | `/admin/login` de la landing | 503 `ADMIN_UNAVAILABLE` sin usuarios, igual que antes del ticket. |
| D-7 | `deploy/ci/smoke.sh` real en un contenedor `docker:cli` | Intento 1: 184 ok y 1 fallo del entorno (solo monté `deploy/`, así que `docs/despliegue.md` no existía; la misma comprobación pasa en el host con el archivo del PR y con el de `d261ff8`). Intento 2, con `docs/` montado: **185 ok, "todas las comprobaciones pasaron"**, incluidos el primer despliegue desde una base vacía, las vueltas atrás y "el /admin de las landings sigue en su dominio (503 sin usuarios)". |
| Doc-1 a Doc-4 | Lectura y ejecución de los comandos documentados | `README.md`, `desarrollo.md` y `despliegue.md` §5 nombran `api/.env`, `-w api` y `$C exec api node scripts/admin-recover.ts` (comprobado en D-4; WORKDIR `/app/api`). La nota de vuelta atrás (`exec app` con una `api` anterior) es coherente con las imágenes. Los restos que nombran la ruta antigua están justificados: `despliegue.md:489` es esa nota, `arquitectura.md:407` habla del movimiento y el comentario de `core/catalog/seeds.ts`. Fuera del PR: `.claude/agents/senior-fullstack.md:88`. |

### Criterios de aceptación

| CA | Resultado | Evidencia |
| -- | -- | -- |
| CA-6 | PASS | F-1, F-2 y D-3 (procesos e imagen reales); `server-startup-base` en A-1. |
| CA-7 | PASS | F-3 (sin semilla ni usuarios nuevos; página "no disponible" 503) y el caso de `admin-bootstrap` (api) en A-1. Ver la observación O-1. |
| CA-8 | PASS | F-7 y D-4 (`console_recovery`, sesiones cerradas, mensaje que remite al admin nuevo); C-3 10/10. |
| CA-9 | PASS (alcance del PR 1) | N-1, N-2 y N-3 (código 1, mensajes sin detalles). `server-startup.test.ts` pasa a la `api` en el PR 2, según el plan. |
| RF-4: idempotencia y paralelo | PASS | F-2, C-1 20/20, C-2 25/25 con las dos ramas `concurrent`. |
| Orden página → productos y reanudación | PASS | F-5 y F-6a. |
| RF-5: comandos en `api` | PASS | F-7, F-8 (opción b), F-9 y D-4. |
| Secretos | PASS | S-1 a S-4. |
| `safeEqualStrings` | PASS | R-4, S-5 y las pruebas de `internal-app`, CSRF y webhook en A-1. |
| Semillas y fallback | PASS | R-1, D-2 y D-5. |
| Imágenes | PASS | D-1 y D-2. |
| RF-8: `deploy/`, compose y `ops/` sin cambios | PASS | R-5. |
| `/admin` actual y regresión de las 3 apps | PASS | A-1, D-6 y D-7. |
| Lint, typecheck y suite | PASS | A-1, A-2, A-3 y L-1. |

### Defectos encontrados

#### DEF-001

- Severidad: MINOR
- Criterio de aceptación afectado: ninguno del PR 1 (afecta a los respaldos de una instalación nueva, RF-8 y RN-6 en su espíritu).
- Descripción: con el PR 1, en una instalación nueva desplegada en el orden de `deploy.sh` (primero la `api`), la `api` siembra antes y la landing ve una instalación "existente". `createFileMenuRepository.init({ seedMissing: false })` ya no escribe `current.json`/`previous.json` en `DATA_DIR`. `verify-backup.sh:139-140` exige un JSON en `molotes/` y en `birria/`, y `ops/backup/ci/smoke.sh:169-171` también.
- Pasos para reproducir: pila de D-3 con una base vacía; `docker exec <app> find /var/lib/restaurante`.
- Resultado esperado: hasta el PR 2, los respaldos de una instalación nueva siguen verificándose como antes.
- Resultado actual: `DATA_DIR` solo tiene las carpetas vacías y la app registra `menu_data_missing`×2. Un respaldo de esa instalación fallaría en `verify-backup.sh`, y `ops/backup/ci/smoke.sh` fallaría en su paso 170.
- Evidencia: D-3 (listado de `DATA_DIR` y logs de la app).
- Impacto: ninguno observable en el flujo aprobado. Producción ya es una instalación existente; el PR 1 no se despliega solo (la épica llega a `main` después del PR 2); y el `ops/backup/ci/smoke.sh` solo corre hacia `main`, cuando el PR 2 ya lo habrá ajustado (hallazgo 3 de la revisión técnica). Solo afectaría a una instalación nueva hecha con el código del PR 1 sin el PR 2.
- Recomendación: que el PR 2 incluya, como ya prevé, el ajuste de `ops/backup/ci/smoke.sh:169-171`. Hay que tener presente que, entre el PR 2 y el PR 3, `verify-backup.sh` seguirá exigiendo esos JSON en una instalación nueva hasta que el PR 3 acepte respaldos sin ellos.

#### DEF-002

- Severidad: MINOR
- Criterio de aceptación afectado: "fallos de paso → 1 y mensajes sin detalles" (Manejo de errores del plan técnico).
- Descripción: en `api/src/install/index.ts:96`, `seeds()` se llama fuera de `step(...)`. Un error que no sea de validación (archivo de semilla ilegible o JSON sintácticamente roto) no se convierte en `InstallationError`. `server.ts:68` lo relanza y Node termina por una excepción no capturada, con la traza y la ruta.
- Pasos para reproducir: sonda unitaria `loadSeeds(() => { throw Object.assign(new Error('ENOENT … /app/packages/core/catalog/seeds/molotes.json'), { code: 'ENOENT' }) })` y `prepareInstallation({ …, seeds: () => { throw … } })`.
- Resultado esperado: `install_seed_invalid` (o un evento equivalente) solo con códigos, el mensaje fijo y código 1.
- Resultado actual: `isInstallationError: false`; se propaga el error original con su mensaje (y la ruta).
- Evidencia: N-4 (sonda unitaria).
- Impacto: bajo. Las semillas van versionadas en la imagen (D-1) y las pruebas de contenido las validan en el CI, así que solo una imagen dañada lo dispararía. Además solo ocurre en una instalación nueva, sin datos que proteger.
- Recomendación: que un fallo al cargar la semilla termine como los demás pasos (evento y mensaje controlados).

### Observaciones (no son defectos)

- **O-1 (CA-7, caso límite):** una instalación existente con **0 usuarios** y `ADMIN_*` presentes crea el administrador (`admin_bootstrap_created`, F-3b). Es lo que dicen RF-4 ("solo si no hay usuarios") y `bootstrapAdmin`, y es el comportamiento de la landing antes del ticket. CA-7 habla de una instalación existente, que en la práctica tiene usuarios (producción los tiene). Si el usuario quiere que CA-7 también excluya este caso, sería un cambio de requisito.
- **O-2 (heredado):** si el arranque se corta *dentro* de `products.init`, entre Molotes y Birria, el siguiente arranque ve `product_import` con filas y Birria queda sin productos, sin ningún aviso (F-6b: 0 productos; solo `products_notify_disabled`). Es el mismo camino que tenía la landing (importación por negocio en transacciones separadas). Propuesta para un ticket futuro: detectar marcas parciales.
- **O-3 (heredado):** `safeEqualStrings(undefined, 'undefined')` devuelve true por `String(value)`. Sus consumidores descartan antes el valor ausente (`internal-app.ts:68`, `access.ts:72` y `admin-guard.ts:142` comprueban que no esté vacío ni ausente). Sin impacto.
- `Cotizador_Taquiza_Birria.xlsx` sin seguimiento en la raíz del repositorio: no debe entrar en el commit del PR 1.

### Regresión

Suite completa de las 3 apps en verde (A-1). `/admin` actual sin cambios (suite `admin-*`, D-6 y D-7). Landings: HTML de referencia y snapshot (A-1), D-3 y D-5. `deploy/`, compose, `ops/` y `.github` sin cambios (R-5). `smoke.sh` del despliegue completo en verde (D-7).

### Responsive / Accesibilidad / UX/UI / SEO

No aplican: el PR 1 no cambia HTML, CSS ni JS del navegador. La no regresión del HTML la cubren `landing-html-reference` y `landing-snapshot` (A-1), y el HTML servido en D-3 y D-5.

### Performance

Arranque de la `api` con instalación nueva: 638 ms (F-1). Espera acotada ante un choque real: unos 5,3 s antes de fallar (N-3), solo en ese caso.

### Pruebas no repetidas o no ejecutadas, con su motivo

- `npm run admin:recover` contra una base: no se ejecutó (opción b aprobada, para no leer `api/.env`); lo cubren F-7 y D-4 con el script directo.
- `ops/backup/ci/smoke.sh`: no se ejecutó (necesita Linux, `age` y systemd); su supuesto se comprobó en D-3 (DEF-001).
- `npm run build:css`: no aplica (sin cambios de estilos ni plantillas).

### Pendientes de revisión manual

Ninguno.

### Limpieza

- Sondas borradas: `landing-pages/tests/integration/qa-req-f-045-arranque.test.ts` y `landing-pages/tests/unit/qa-req-f-045-unit.test.ts`; `git status` con las mismas 47 entradas del inicio y ninguna `qa-`.
- Bases: `SHOW DATABASES LIKE 'restaurante\_test%'` vacío antes de detener MySQL. MySQL detenido con `npm run db:down` (estaba apagado al empezar).
- Procesos: sin Vitest, `src/server.ts` ni `admin-recover`; sin puertos de node escuchando.
- Docker: borrados los contenedores, la red y los volúmenes `qa-req-f-045-*`, el contenedor auxiliar (`--rm`), los contenedores, redes y volúmenes de `restaurante-smoke`/`smoke-*` (los limpió el propio `smoke.sh`, comprobado), las imágenes `qa-req-f-045-*` y las `localhost:5000/orvigas/*` que creó el smoke. No queda `traefik-public`. Se conservan `docker:cli` (ya estaba) y la caché de compilación de Docker.
- Scratchpad: borrados mis registros, sondas, `stack.env` y `smoke-work`. Quedan `cot.xlsx`, `cotizador-analisis.md` y `venv/`, que no son de este QA.
- `git worktree list`: un solo árbol.

### Resultado final

QA_APPROVED

## QA Action Plan (PR 2)

Alcance: **PR 2 de 3** (`feature/REQ-F-045-retirada-admin-actual-2-retirada`, base `425e21a`, cambios sin commit: 215 entradas en `git status`; PR a `epic/arquitectura`). Preparado el 2026-11-16 por `senior-qa` tras la aprobación de la implementación del PR 2 por el usuario ("Si la apruebo"). Análisis con `codegraph_explore` (`createApp`, `createAdminMoved`, `loadConfig`/`parseAdminNewUrl`, `server.ts` de las tres apps, controlador de landing y caché) y lecturas dirigidas de lo que no indexa (ticket, `git diff`, `eslint.config.ts`, los dos `smoke.sh`, `ci.yml`, Dockerfile, `compose.prod.yaml`). NotebookLM: sus herramientas MCP no están expuestas en esta sesión; no se consultó.

Hechos de partida observados en el repositorio (no inferidos):
- `deploy/compose.prod.yaml`, `deploy.sh`, `deploy/mysql/` y `env.production.example` son idénticos a `origin/main` (`8f37f4e`, lo desplegado): la suma de `deploy/` no cambia y el VPS no necesita reinstalar `deploy/`.
- `.claude/` solo cambia en `.claude/CLAUDE.md` (una línea de §8) y en este ticket; `.claude/agents/` y `.claude/rules/` sin cambios.
- `deploy/ci/smoke.sh`: la ráfaga de 30 peticiones a `/admin/login` (línea 330) y las tres nuevas peticiones a `/admin` (líneas 404 a 406) están en el **mismo despliegue**, sin otro despliegue entre medias (el "deploy v2" está en la línea 426). La afirmación del Implementation Result ("entre las dos secciones hay varios despliegues") no se sostiene: el margen depende solo del tiempo que tardan las secciones 335 a 401.
- `ops/backup/ci/smoke.sh` no necesita systemd (eso es el paso `systemd-analyze` aparte del CI): pide Docker con compose, bash, curl, `age`, gzip, tar, flock y coreutils de GNU.
- El job `docker` del CI (que sí corre en el PR a `epic/arquitectura`) sigue pasando `DATABASE_URL` y `DATA_DIR` a la imagen `production` y exige `landing_products_loaded` con `source: api`; `shellcheck` de los dos `smoke.sh` también corre en ese PR. Los dos `smoke.sh` solo corren hacia `main`.
- Quedan en Docker 10 imágenes `smoke/*` de hace 6-7 horas (las crea `derive` de `deploy/ci/smoke.sh`; casi seguro, de D-7 del QA del PR 1) y el contenedor `restaurante-mysql-dev-1` parado. No se reutilizan; ver la autorización 7.

### Objetivo

Comprobar con evidencia que `/admin*` responde 302/410/404 como dice RN-1 sin redirección abierta ni cookies; que `landing-pages` arranca y sirve las mismas landings sin base, sin `DATA_DIR` y sin cargar `db`, Prisma, `mariadb`, `identity` ni `bot-control`; que el lint impide que vuelvan; que la `api` y `inventory-manager` no cambian de comportamiento; que las pruebas obligatorias siguen existiendo contra la `api` y que ninguna prueba retirada se llevó cobertura funcional sin sustituto; que los dos `smoke.sh` ajustados pasan de verdad; que la vuelta atrás de un despliegue del PR 2 devuelve la app anterior (la de producción) con el compose vigente; y que la documentación dice lo que hace el código.

### Requisito bajo prueba

- RF-1 / RN-1 (`/admin` retirado), RF-2 (landings sin base ni `DATA_DIR`), RF-3 (aviso interno), RF-6 (importación desde JSON retirada, también en `packages/`), RF-7 (lint), RF-8 (compose sin cambios), RF-10 (documentación del PR 2 y `.claude/CLAUDE.md` §8).
- CA-1, CA-2, CA-3, CA-4, CA-5, CA-8 (reapuntada), CA-9 (reapuntada), CA-10, CA-11 y CA-14. CA-6 y CA-7 se repiten solo como regresión del PR 1.
- Technical Action Plan, PR 2, y las decisiones P-T4 (regla D-6 retirada de las landings) y P-T1 (compose sin `ADMIN_*` en la `api` hasta el PR 3).
- Fuera de este QA: CA-12 y CA-13 (PR 3) y las comprobaciones en el VPS (tras la épica a `main`).

### Criterios de aceptación (cada uno → pruebas que lo cubren)

| CA / requisito | Pruebas |
| -- | -- |
| CA-1 (GET/HEAD → 302 fijo, sin `Set-Cookie`) | F-1, F-2, F-4, N-1, N-2, D-4, D-7, A-1 (`app.test.ts`, `admin-users-e2e`) |
| CA-2 (otros métodos → 410, la base no cambia) | F-3, N-3, D-4, D-6, A-1 |
| CA-3 (sin `ADMIN_NEW_URL` → 404) | F-5, A-1 |
| CA-4 (mismo HTML los 7 días; arranque sin MySQL ni `DATA_DIR`, también con las variables presentes) | H-1 a H-5, B-1 a B-4, D-3, D-6 |
| CA-5 (escritura en el admin nuevo → `products_change_notified` con `landing:true` y la landing lo muestra; aviso sin credencial → 401) | D-6, R-3, A-1 (`admin-e2e`, `internal-app`, `internal-notify-process`) |
| CA-8 (recuperación en la `api`; concurrencia del último administrador) | T-1, T-2, D-6, A-1 |
| CA-9 (base inválida → código ≠ 0 sin detalles, en la `api`) | T-3, A-1 (`server-startup`, `server-startup-base`) |
| CA-10 (lint rechaza los imports prohibidos y acepta el árbol real) | L-1 a L-3, A-3 |
| CA-11 (vuelta atrás del PR 2 → la app anterior arranca con el compose vigente) | D-6, D-7 |
| CA-14 (typecheck, lint y tests; sin `DATA_DIR`, `DATABASE_URL`, `ADMIN_USER` ni `admin-recover` en `src/` y `scripts/`) | A-1 a A-4 |
| RF-3 (aviso interno igual) | R-3, A-1 |
| RF-6 (código muerto de `packages/` retirado sin romper la siembra) | R-4, R-5, A-1 |
| RF-8 (compose y `deploy/`/`ops/` sin cambios salvo los dos `smoke.sh`) | R-6 |
| Pruebas retiradas sin pérdida de cobertura funcional | P-1 a P-4 |
| `api` e `inventory-manager` sin cambio de comportamiento | R-4, D-6, A-1 |
| `smoke.sh` ajustados | D-7, D-8, S-1 |
| Documentación vs implementación; `.claude/CLAUDE.md` §8; `.claude/agents/` intacto | Doc-1 a Doc-5 |

### Riesgos identificados

1. **429 en `deploy/ci/smoke.sh`**: con la ráfaga (`average=10`, `period=1m`, `burst=20`: un permiso cada 6 s), las tres peticiones nuevas a `/admin` necesitan que pasen al menos unos 18 s desde la ráfaga; antes bastaba una (6 s). En un runner más rápido que la máquina local el margen puede faltar, y el fallo solo se vería en el PR de la épica a `main` (riesgo de PR atascado).
2. **410 con cuerpos grandes**: el middleware responde sin leer el cuerpo. El propio Implementation Result vio `ECONNRESET` en el cliente con 2 MiB (por eso la prueba usa 32 KiB). Hay que saber qué recibe un cliente real con cuerpos grandes directo al proceso y, sobre todo, a través de Traefik (topología de producción), y que el proceso no acumula el cuerpo en memoria.
3. **Variantes de ruta**: `isAdminPath` es exacto y sensible a mayúsculas (`/admin` o `/admin/…`). `/ADMIN`, `//admin`, `/admin;x`, `/%61dmin` o `/admin%2Flogin` darán 404 y no 302. RN-1 no define estas variantes: si alguna difiere de lo esperable, se clasifica como observación o `REQUIREMENT_AMBIGUITY`, no como defecto.
4. **Redirección abierta**: el destino debe ser siempre `<ADMIN_NEW_URL>/`, sin depender de la ruta, la query, `Host`, `X-Forwarded-Host` ni `TRUST_PROXY`.
5. **CSS de las landings**: Tailwind v4 detecta las fuentes automáticamente; al borrar `views/admin/` y `styles/admin/`, el CSS compilado de Molotes o Birria podría cambiar. Si cambia, hay que ver si alguna clase usada por las landings desapareció (impacto visual).
6. **Pérdida de cobertura**: 46 archivos de prueba retirados y 26 modificados. Algunos retirados no eran solo de `/admin` (`admin-db-security`, `admin-produccion`, `bot-protection-qa-req-f-025`, `users-api-process`, `admin-bot-api-process`, `db-outage`, `admin-products-pagina`, casos de `landing-products`, `icons`, `server-startup-config`, `prisma-page-store`). `testing.md` exige conservar una cadena real de punta a punta por flujo principal (productos, usuarios y página), la concurrencia del último administrador y "no arranca con configuración peligrosa o una base inválida".
7. **Cambios en `api`, `inventory-manager` y `packages/` que deberían ser solo comentarios o código muerto** (19 archivos, +42/−167): que no se haya colado un cambio de comportamiento.
8. **Vuelta atrás real (CA-11)**: `deploy/ci/smoke.sh` solo vuelve a imágenes del mismo commit; no prueba volver del PR 2 a la app de `main` (la de producción, con su importación, `DATA_DIR` y `/admin` en solo lectura) con una `api` del PR 1 + PR 2. Tampoco prueba la subida real `main` → épica sobre una base creada por `main`.
9. **`ops/backup/ci/smoke.sh`**: ahora inserta un producto por SQL con solo las columnas sin valor por defecto; si el esquema exige otra columna o el conteo del manifiesto se compara mal, falla solo hacia `main`.
10. **Comprobación de la vuelta atrás tras una migración nueva** (`deploy/ci/smoke.sh:548`): pasa de `database_newer_than_code_allowed` a "ningún `database_*`". Como la app de esa vuelta atrás es del mismo commit, la comprobación nueva es trivial; hay que ver si la `api` cubre lo que se dejó de comprobar.
11. **Duración por archivo** (`testing.md`, 20 s en el CI): `api-process` (~16 s), `last-admin-concurrency` (~13 s) y los e2e cerca del límite.
12. **Documentación**: comentarios del Dockerfile (la etapa `production` aún dice que la app "lee las migraciones para verificar el estado"), `docs/arquitectura.md:400` (cita `build:css:admin`, ya inexistente), `.claude/rules/testing.md` (cita `setupAdmin`, retirado) y `.claude/agents/senior-fullstack.md` (describe el `/admin` de las landings). Los dos últimos están fuera de lo autorizado: se reportan, no se corrigen.

### Pruebas funcionales (`/admin*`, proceso real; sondas temporales)

App en proceso con `listenLocal` y, además, el proceso real `node src/server.ts` en producción (con `ADMIN_NEW_URL=https://admin.example.test` y `TRUST_PROXY=true`) y en desarrollo:
- **F-1** GET y HEAD de `/admin`, `/admin/`, `/admin/login?x=1`, `/admin/bot`, `/admin/api/molotes/productos`, `/admin/x/y/z`, `/admin//login` → 302, `Location` exactamente `https://admin.example.test/`, `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, sin `Set-Cookie`, cuerpo vacío en HEAD. Se registran también las cabeceras de Helmet.
- **F-2** Con `Cookie: koa.sess=…; koa.sess.sig=…` y cabeceras de sesión de la app anterior → la misma respuesta, sin `Set-Cookie` (no hay middleware de sesión en la app: se confirma con CodeGraph).
- **F-3** POST, PUT, PATCH, DELETE, OPTIONS y un método no estándar admitido por Node (p. ej. `PROPFIND`) en `/admin`, `/admin/login` y `/admin/api/molotes/productos`, con y sin cuerpo (formulario, JSON) → 410 `{ error: { code: 'ADMIN_MOVED', … } }`, `no-store`, sin `Set-Cookie`.
- **F-4** `ADMIN_NEW_URL` con barra final y con ruta (`https://admin.example.test/panel/`) → `Location` normalizada con una sola barra final.
- **F-5** Sin `ADMIN_NEW_URL` → `/admin`, `/admin/login` y un POST → 404 con el formato común de errores (no 410).
- **F-6** `/administrador`, `/administracion`, `/adminx`, `/admin.html` → 404 en los dos modos.

### Pruebas negativas y casos límite

- **N-1 Redirección abierta**: `/admin?next=https://evil.test`, `/admin/https://evil.test`, `/admin/%2F%2Fevil.test`, `/admin/..%2F..%2Fevil`, `/admin/../molotes` con `--path-as-is`, `Host: evil.test`, `X-Forwarded-Host: evil.test` y `X-Forwarded-Proto: http` con `TRUST_PROXY=true` → siempre `Location: https://admin.example.test/`.
- **N-2 Variantes de ruta**: `/ADMIN`, `/Admin/login`, `//admin`, `/admin;x`, `/%61dmin`, `/admin%2Flogin`, `/admin%2e`, `/%2e/admin` → se registra el código de cada una y se clasifica según el riesgo 3 (ninguna puede responder 200 con contenido de administración ni redirigir a otro destino).
- **N-3 Cuerpos grandes**: POST y PUT a `/admin/login` con 0 B, 32 KiB, 1 MiB, 10 MiB y 100 MiB, con y sin `Expect: 100-continue`, en `Content-Length` y en `chunked`: (a) directo al proceso y (b) a través de Traefik (pila de D-7 o D-6). Se registra el código que recibe el cliente o el error de conexión, el tiempo y el RSS del proceso antes y después (no debe crecer con el tamaño). Además, `wc -c` del cuerpo nunca aparece en el log y el log de petición no registra el cuerpo.
- **N-4** Muchas peticiones seguidas a `/admin` (200 en paralelo) directo al proceso → todas 302, sin errores en el log ni fugas de sockets.
- **N-5** `ADMIN_NEW_URL` inválida (http en producción, con query o credenciales) → la app no arranca, con el mensaje de `env.ts` sin repetir el valor (regresión de REQ-F-039).

### Pruebas de las landings sin base ni `DATA_DIR` (CA-4, RF-2)

- **B-1** Proceso real en producción con `DATABASE_URL` hacia un centinela TCP propio que cuenta conexiones, `DATA_DIR` hacia una ruta inexistente y todas las variables retiradas presentes **e inválidas** (`ADMIN_USER` con caracteres prohibidos, `ADMIN_PASSWORD_HASH=x`, `WHATSAPP_BOT_*` y `BOT_*` basura, `DATABASE_ALLOW_NEWER_SCHEMA=quizá`, `WHATSAPP_MOLOTES` y `WHATSAPP_BIRRIA` distintos con `WHATSAPP_BOT_NUMBER` presente: regla D-6 retirada, P-T4) → arranca (`server_started`), 0 conexiones al centinela, `DATA_DIR` sigue sin existir, sin eventos `database_*`, `menu_*`, `page_import_*`, `admin_*` ni `bot_*` en el log, y `/molotes` 200.
- **B-2** Igual sin ninguna de esas variables → mismo resultado y mismo `server_started` salvo los campos.
- **B-3** Módulos cargados: el proceso real con un `--import` de sonda que registra `module.registerHooks` (Node 24) y anota cada especificador resuelto → ninguno de `@restaurante/db`, `prisma`, `@prisma/*`, `mariadb`, `@restaurante/core/identity` ni `@restaurante/core/bot-control`, ni durante el arranque ni tras pedir `/`, `/molotes`, `/birria`, `/admin` y el aviso interno.
- **B-4** Imagen `production` con la raíz de solo lectura (`docker run --read-only --tmpfs /tmp`), sin volumen y con `DATABASE_URL` hacia un MySQL apagado → `healthy`, landings 200 (semilla o API según el caso), sin escrituras.

### Pruebas de regresión del HTML (CA-4)

Referencia: la app de `425e21a` (épica antes del PR 2; el PR 1 no cambió HTML) y, para la topología real, la de `origin/main` (`8f37f4e`, producción). Ambas desde imágenes `production` construidas desde `git archive` (ver la autorización 3), contra la misma `api` y la misma base de prueba.
- **H-1** Desarrollo, `?dia=` con los 7 valores que acepta `parseForcedDay` × `/`, `/molotes`, `/birria` (21 respuestas) → cuerpo byte a byte igual entre la app de `425e21a` y la del PR 2; mismas cabeceras salvo `Date` (incluida la CSP).
- **H-2** Producción, día real: `/`, `/molotes`, `/birria` y HEAD → iguales byte a byte; canonical, `og:*`, `title`, meta description y un solo `h1` según el negocio (SEO).
- **H-3** Con la `api` caída (semilla de respaldo): las dos apps sirven el mismo HTML, con $145 en Molotes y $195 en Birria, y lo registran (`landing_*_fallback`, `source: seed`).
- **H-4** Recursos referenciados por el HTML (CSS, JS, imágenes, iconos, `manifest`, `robots.txt` y `sitemap` si existen) y una ruta inexistente → mismo código y mismos bytes en las dos apps. CSS: `public/css/{molotes,birria}/main.css` compilado desde `425e21a` y desde el PR 2 (`npm run build:css` en cada imagen) comparado byte a byte (riesgo 5).
- **H-5** Avisos del día y pedido por WhatsApp en el HTML del PR 2: lunes (Descanso en `/` y `/molotes`), martes a viernes (Molotes en `/`, nada en `/molotes`), sábado y domingo (nada en `/`, "Hoy toca birria" en `/molotes`), `/birria` nunca; enlace de WhatsApp de cada landing con `href` (`wa.me`, número y `text` codificado), `target` y `rel` iguales que antes. Como H-1 compara byte a byte, este punto solo documenta el contenido.

### Pruebas de las pruebas trasladadas o reapuntadas (CA-8, CA-9)

- **T-1** `last-admin-concurrency.test.ts` ×10 → 10/10; la sonda lee del log y de la base que el `describe` HTTP de verdad desactiva por `POST /api/v1/admin/usuarios/:id/desactivar` del proceso de la `api` y lanza `../api/scripts/admin-recover.ts` (no un doble) y que nunca queden cero administradores.
- **T-2** `admin-recover.test.ts` y `admin-recover-errores.test.ts` ×5 → la sesión cerrada es la de `/api/v1/admin/sesion` (401) y el login nuevo 201; los errores (base caída, sin migrar) con el mensaje sin detalles.
- **T-3** `server-startup.test.ts` y `server-startup-base.test.ts` ×5 → los cinco y los tres casos arrancan `../api/src/server.ts` (se confirma en el código de la prueba y con el `service` del log), código 1 y mensajes sin URL, SQL ni traza.
- **T-4** `api-process.test.ts` ×10, `admin-e2e` ×5, `admin-users-e2e` ×5 y el `describe` nuevo de `app.test.ts` ×20 (por el `ECONNRESET` que vio la implementación).

### Pruebas retiradas: ¿se perdió cobertura funcional? (contra `425e21a`)

- **P-1** Inventario: para cada uno de los 46 archivos borrados y los 26 modificados, títulos de `describe`/`it` en `425e21a` frente al árbol (extraídos con un script de la sonda, sin ejecutar nada).
- **P-2** Cada caso que desaparece se clasifica: (a) solo `/admin` retirado; (b) cubierto en otro sitio, con la referencia `archivo › caso` (en `landing-pages/tests`, `api/tests`, `inventory-manager/tests` o `packages`); (c) sin sustituto. Revisión obligatoria, caso a caso, de `admin-db-security`, `admin-produccion`, `admin-products-pagina`, `bot-protection-qa-req-f-025`, `users-api-process`, `admin-bot-api-process`, `db-outage`, `file-menu-repository` y `menu-repository-contract` (lo que probaban de `packages/`), y de los casos caídos de `landing-products`, `landing-products-api`, `icons`, `server-startup-config`, `config`, `page-import` y `prisma-page-store`.
- **P-3** Las pruebas que `testing.md` obliga a conservar existen y pasan: cadena real de punta a punta de productos (`admin-e2e`), de usuarios (`admin-users-e2e`) y **de página** (se identifica cuál es: si no queda ninguna con `inventory-manager` → `api` → aviso → landing para los datos de página, es un hallazgo), concurrencia del último administrador, y "no arranca con configuración peligrosa o una base inválida" (`server-startup*` y `server-startup-config`).
- **P-4** Las pruebas modificadas no se debilitaron: los casos que siguen tienen las mismas aserciones salvo lo que exige la retirada (diff de cada `it` conservado). Un caso (c) que proteja comportamiento de la app es un defecto (la severidad según lo que deje sin proteger); uno que solo protegía `/admin` no lo es.

### Pruebas de `api`, `inventory-manager` y `packages/` (riesgo 7)

- **R-1** `git diff 425e21a` de `api/src`, `inventory-manager/src`, `packages/contracts` y de los archivos de `packages/core` y `packages/db` → por cada archivo, la salida de `ts.transpileModule` con `removeComments` (TypeScript del propio repositorio, desde la sonda) antes y después: idéntica salvo las retiradas listadas en el Implementation Result.
- **R-2** Cada símbolo retirado de `packages/` (`parseChangeLog`, `parseChangeLine`, `addImportedChanges`, `IMPORT_BATCH_SIZE`, `PageTransactionOptions`, `parseBotPanel`, `BotPanelConfig`) no tiene consumidores (CodeGraph) y `typecheck` pasa.
- **R-3** Aviso interno (RF-3): 401 sin credencial y con una incorrecta, 404 fuera de su ruta, invalidación con credencial correcta y `products_change_notified` (prueba existente + D-6).
- **R-4** La siembra de la `api` (PR 1) sigue igual tras la poda de `page-import.ts`: `server-startup-base` (CA-6) y `admin-bootstrap` (CA-7) en A-1, y en D-6 una base vacía.
- **R-5** `inventory-manager` completo contra la `api` real: suite en A-1 y el recorrido de D-6.
- **R-6** `git diff 425e21a --stat -- restaurante/deploy restaurante/ops restaurante/compose.yaml restaurante/landing-pages/Dockerfile .github` → solo `deploy/ci/smoke.sh` y `ops/backup/ci/smoke.sh`; y `git diff origin/main` de `compose.prod.yaml`, `deploy.sh`, `deploy/mysql/` y `env.production.example` vacío.

### Lint de dependencias (CA-10)

Con `npx eslint --stdin --stdin-filename <ruta existente>`, sin escribir archivos:
- **L-1 Deben fallar** en `landing-pages/src/controllers/landing.ts` y en `landing-pages/scripts/dev-server.ts`: `@restaurante/db`, `@restaurante/db/client`, `prisma`, `@prisma/client`, `mariadb`, `@restaurante/core/identity` (y una subruta), `@restaurante/core/bot-control`; de `@restaurante/core/catalog`: `createProductRepository`, `createPageRepository`, `ProductStore`, `type PageRepository`, un nombre inventado (lista de permitidos), `import * as catalog` y `export { createPageRepository } from`; `import()` dinámico de `@restaurante/db/client`, `@restaurante/core/identity` y `@restaurante/core/bot-control`; `../../../packages/db/src/client.ts` (ruta interna); `../../api/src/…` (otra app).
- **L-2 Deben pasar**: cada uno de los 11 nombres permitidos de `core/catalog`, `safeEqualStrings` de `@restaurante/core/shared`, `@restaurante/core/schedule`, `@restaurante/contracts` y `@restaurante/web`.
- **L-3** Las pruebas quedan fuera a propósito: `@restaurante/db` en `landing-pages/tests/...` pasa. Y la regla de transición ya no está en `eslint.config.ts`.

### Docker, despliegue y vuelta atrás (locales, se descartan)

- **D-1** Imágenes del PR 2: `production`, `api`, `migrate` e `inventory-manager` (`qa-req-f-045b-*`); referencias `425e21a` y `origin/main` (`production`, `api`, `migrate` e `inventory-manager`), desde `git archive`.
- **D-2** Réplica local del job `docker` del CI (pasos "contenido de las imágenes" e "imagen production escucha en 0.0.0.0…"), tal como están en `ci.yml`, con las imágenes del PR 2 → todo en verde, incluido `landing_products_loaded` con `source: api`.
- **D-3** Contenido de la imagen `production`: sin `src/views/admin`, `src/styles/admin`, `public/css/admin` ni `scripts/`; arranca con la raíz de solo lectura (B-4).
- **D-4** CA-1/CA-2 contra la imagen local detrás de Traefik (pila de D-7 o D-6): `curl -sI` de las 4 rutas de CA-1 → 302 y sin `set-cookie`; POST/PUT/PATCH/DELETE → 410; N-3 (b).
- **D-6 Vuelta atrás y subida reales con `deploy.sh`** (CA-11 y CA-5 en la topología real). Copia temporal de `deploy/ci/smoke.sh` en el scratchpad, reducida a su preparación (registro local, Traefik, `.env` de la plantilla, `deploy.sh` real instalado como en el VPS) y con esta secuencia propia:
  1. Despliegue de las imágenes de `origin/main` sobre una base vacía (lo que hoy corre en producción) → 0; `/admin` de la landing en solo lectura; `app-data` con sus JSON; `page_import` y `product_import` con 2 filas.
  2. Despliegue de la épica con la app rota (`api`, `migrate` e `inventory-manager` del PR 2; la app, la derivada que sale con 1) → **21**; la app de `main` vuelve y queda `healthy` con el compose vigente (sin cambios), landings 200, sin `page_json_diverged` ni reimportación, recuentos de tablas iguales. Se registra qué `api` queda en marcha y que la app de `main` funciona con ella.
  3. Despliegue de la épica correcta (subida `main` → PR 2) → 0; la `api` no siembra ni crea usuarios (`products_imported`, `page_seeded` y `admin_bootstrap_created` ausentes); la app sin ningún `database_*`, `menu_*` ni `page_import_*`; landings con el mismo HTML que en el paso 1 (H-2 en producción a través de Traefik); `/admin*` 302/410.
  4. CA-5 y CA-8 en esa pila: `docker exec <api> node scripts/admin-recover.ts --usuario qa` (contraseña por tubería) → `console_recovery`; login en el admin nuevo por Traefik (`admin.<dominio>`), un cambio de precio de un producto y otro de la página (hero) con su CSRF → `products_change_notified` con `landing:true` en el log de la app y el cambio visible en `/molotes` y `/birria`; se deshacen. Aviso sin credencial → 401.
  5. Nuevo despliegue con la app rota → 21 y vuelve la app del PR 2.
- **D-7 `deploy/ci/smoke.sh` real** (como D-7 del PR 1): contenedor `docker:cli` con `bash curl jq gzip util-linux coreutils findutils`, socket de Docker, `--network host`, `SMOKE_WORKDIR` en el scratchpad y el repositorio montado completo (con `docs/`). Salida con marca de tiempo por línea para medir el **tiempo entre el fin de la ráfaga (línea 331) y las comprobaciones de las líneas 404 a 406** (riesgo 1). Resultado esperado: "todas las comprobaciones pasaron". Si el margen medido es menor que el doble de los ~18 s necesarios, se registra como riesgo de inestabilidad con la medida, aunque pase.
- **D-8 `ops/backup/ci/smoke.sh` real** en un contenedor `docker:cli` con `bash curl age gzip tar util-linux coreutils findutils jq` (sin systemd: el script no lo usa), el socket de Docker y el trabajo en el scratchpad, con las imágenes `production` y `migrate` del PR 2. Esperado: todas las comprobaciones en verde, incluidos "hay datos de prueba", `backup.sh`, `verify-backup.sh` y la restauración de `birria/smoke.json`. Si `age` o `flock` no funcionan en Alpine tras 2 intentos, se prueba con una imagen Debian (`debian:stable-slim` + `docker.io`); si tampoco, queda **no ejecutado** con revisión estricta (columnas del `INSERT` contra `schema.prisma` y las migraciones, conteo del manifiesto contra `backup.sh`, rutas de `docker exec`) y pasa a pendiente del PR de la épica a `main`. `systemd-analyze verify` no se ejecuta (las unidades no cambian; queda explícitamente fuera).
- **S-1 `shellcheck`** de los mismos archivos que el CI (`deploy.sh mysql/initdb/01-usuarios.sh ci/smoke.sh ci/resumen.sh ci/resumen-test.sh` y `lib.sh backup.sh env-backup.sh restore.sh verify-backup.sh ci/smoke.sh -x`) con la imagen `koalaman/shellcheck` (la versión más cercana a la del runner) → 0 avisos; y `bash -n`.

### Pruebas automatizadas

- **A-1** `npm test` completo desde `restaurante/` (las 3 apps, MySQL de pruebas) → todo en verde; con el informe de duración por archivo (ningún archivo cerca de 20 s sin anotarlo; riesgo 11).
- **A-2** `npm run typecheck` → 0.
- **A-3** `npm run lint` → 0 sin avisos (no `lint:fix`).
- **A-4** `npm run build:css` → 0; CA-14: `grep -rn 'DATA_DIR\|DATABASE_URL\|ADMIN_USER\|admin-recover' landing-pages/src landing-pages/scripts` vacío, y además `grep -rni 'prisma\|mariadb\|@restaurante/db\|core/identity\|core/bot-control' landing-pages/src landing-pages/scripts` (solo restos justificados en comentarios, si los hay).
- **A-5** `testing.md`: la única prueba nueva es el `describe` de `app.test.ts`; sin archivos `qa-req-f-*` ni pruebas de arquitectura nuevas; `product-repository-atomicity` es un `git mv` con los mismos casos.
- **Sondas** (F-*, N-*, B-1 a B-3, P-1, R-1, H-*): en `restaurante/landing-pages/tests/qa-req-f-045b-*` (y scripts auxiliares en el scratchpad), usando `listenLocal`, `makeScratchDatabase` y el soporte de procesos existente. **Se borran al terminar y no se commitean.** Si una encuentra un caso sin cubrir, se propone (no se añade) la prueba funcional más barata.

### Documentación vs implementación

- **Doc-1** `README.md` (sección "Administración" con la tabla 302/410/404, configuración, HTTP, puesta en marcha, scripts, recuperar el acceso, estructura), `docs/desarrollo.md` §3, §4, §5 y §8.3, `docs/arquitectura.md` §1, §4, §6, §8 y §10, `docs/despliegue.md` §8 (puntos 2, 4 y 5) y la tabla del webhook: cada comando citado se ejecuta tal como está escrito (en local con la base de prueba o en la pila de D-6; los de VPS, con la pila como sustituto) y cada ruta, script y variable existe. Nada describe un `/admin` vivo en las landings ni `DATA_DIR`/`DATABASE_URL` como necesarios para ellas.
- **Doc-2** `landing-pages/.env.example` frente a `config/env.ts`: sin `DATABASE_URL`, `DATA_DIR`, `ADMIN_*`, `WHATSAPP_BOT_*` ni `DATABASE_ALLOW_NEWER_SCHEMA`; `ADMIN_NEW_URL` describe 302/410/404. `npm run dev` arranca con una `.env` creada desde el `.env.example` en una carpeta temporal (no se toca la `.env` real).
- **Doc-3** `.claude/CLAUDE.md`: `git diff 425e21a -- .claude/CLAUDE.md` → solo la frase autorizada de §8 ("En transición, contiene también `/admin` y la importación única de la página desde los JSON al arrancar."). `git diff 425e21a -- .claude/agents .claude/rules` → vacío.
- **Doc-4** Restos: grep en el repositorio (sin `.claude/docs/done/` ni el historial de los tickets) de `build:css:admin`, `views/admin`, `setupAdmin`, `ADMIN_UNAVAILABLE`, `admin-guard`, `file-menu-repository`, `importPages`, `parseChangeLog` y `DATA_DIR` → cada aparición justificada o anotada (riesgo 12).
- **Doc-5** Comentario del Dockerfile y `compose.prod.yaml` (líneas 119 a 122, "modo de solo lectura"): se anotan como desfase de documentación del PR 3 si lo son (RN-6 impide tocarlos en este PR).

### Pruebas en navegador / responsive / accesibilidad / UX / SEO / performance

- La no regresión visual se demuestra con H-1, H-2 y H-4 (HTML, cabeceras y CSS byte a byte). **Si todo es idéntico**, no hay cambio visual posible y el navegador solo se usa para un recorrido corto: `/`, `/molotes` y `/birria` en 375×812, 768×1024 y 1440×900 (sin desbordamiento horizontal, CTA de WhatsApp visible sin scroll en móvil, foco visible al tabular, consola sin errores) y `/admin` con `ADMIN_NEW_URL` hacia el `inventory-manager` local (llega a su login). **Si el CSS o el HTML difieren** (riesgo 5), el recorrido se amplía a las secciones afectadas y se compara con `_stich_source_/`.
- Accesibilidad y SEO: los de H-2 (un `h1`, canonical, `og:*`, `title`, description, `X-Robots-Tag: noindex` en `/admin*`).
- Performance: tiempo de arranque de `landing-pages` (de `node src/server.ts` a `server_started`) frente a `425e21a` con la misma `api`; RSS en reposo de las dos; N-3 (RSS con cuerpos grandes). Informativo, salvo que algo empeore.
- Si la extensión de Chrome no responde tras 2-3 intentos, el recorrido queda pendiente de revisión manual; no bloquea si H-1 a H-4 son idénticos (ningún CA depende solo del navegador).

### Autorizaciones temporales que pido

1. **MySQL de pruebas**: `npm run db:up` / `npm run db:down` (contenedor `mysql-dev`; solo bases `restaurante_test*`; está parado ahora y se vuelve a parar).
2. **Sondas** en `restaurante/landing-pages/tests/qa-req-f-045b-*` y scripts en el scratchpad (copia reducida de `deploy/ci/smoke.sh` para D-6, centinela TCP, gancho de `registerHooks`, extractor de títulos, comparador de `transpileModule`), borrados al terminar.
3. **Copias del árbol de referencia** con `git archive` de `425e21a` y de `origin/main` en el scratchpad, **sin `node_modules`** (solo como contexto de `docker build`), borradas al terminar.
4. **Docker**: construir las imágenes de D-1 (`qa-req-f-045b-*`), levantar las pilas efímeras (red, volúmenes y contenedores `qa-req-f-045b-*`, puertos solo en `127.0.0.1`, credenciales inventadas, sin `.env` real) y ejecutar D-6, D-7 y D-8 en contenedores auxiliares con el socket de Docker y `--network host`; descargar las imágenes fijadas por digest que esos scripts usan (`traefik`, `registry`, `mysql:8.4`) y, para S-1, `koalaman/shellcheck`; para D-8, instalar `age` con `apk` dentro del contenedor auxiliar (o `debian:stable-slim` si Alpine falla). Nada toca producción, GHCR ni el VPS.
5. **Navegador** (Claude in Chrome) en una pestaña nueva, contra los servidores locales; se cierra al terminar.
6. **Mutaciones (opcional)**: comprobar que el `describe` nuevo de `app.test.ts` detecta 4 mutaciones de `admin-moved.ts` (destino con la ruta de la petición, 405 en lugar de 410, `startsWith('/admin')` sin barra y un `Set-Cookie`). Requiere un `git worktree` temporal en el scratchpad con `node_modules` enlazado al del árbol principal, sin tocar el árbol de trabajo; se borra al terminar. Si no se autoriza, se omite y se dice en el informe.
7. **Remanentes previos**: borrar al final las 10 imágenes `smoke/*` que ya estaban (D-7 las vuelve a crear con los mismos nombres; quedarían igual al terminar). El contenedor `restaurante-mysql-dev-1` parado es el de `npm run db:up` y se deja como está.

### Limpieza (se comprueba, no se supone)

- Bases: `SHOW DATABASES LIKE 'restaurante\_test%'` vacío al final; solo se borran bases con ese prefijo y sin ejecución en curso.
- Procesos y puertos: sin Vitest, `node …/server.ts`, `admin-recover`, centinelas ni contenedores auxiliares (`ps`, `lsof -iTCP -sTCP:LISTEN`, `docker ps -a`).
- Docker: `docker rm -f`, `docker network rm`, `docker volume rm` e `docker image rm` de todo `qa-req-f-045b-*`, `restaurante-smoke`/`smoke-*`, `smoke/*` y `localhost:5000/*`; sin red `traefik-public` creada por la prueba; `docker builder prune` solo si la caché creada crece de forma notable. Se conservan `docker:cli`, `mysql:8.4` y las imágenes que ya estaban.
- Archivos: sondas borradas (`git status` con las mismas 215 entradas del inicio y ninguna `qa-`), copias de `git archive`, worktree de mutaciones (`git worktree list` con un solo árbol) y scratchpad sin mis archivos (quedan `cot.xlsx`, `cotizador-analisis.md` y `venv/`, que no son de este QA).
- Navegador: la pestaña de la prueba cerrada.
- MySQL detenido con `npm run db:down`.

### Evidencia requerida

Tablas de códigos y cabeceras de F-*/N-* (incluida la de cuerpos grandes con códigos, tiempos y RSS); log de B-1/B-2, contador del centinela y lista de módulos de B-3; `cmp`/SHA-256 de las 21 + 3 respuestas, de los recursos y del CSS (H-*); inventario de casos retirados con su clasificación (P-*); diff de `transpileModule` (R-1); salidas de ESLint `--stdin` (L-*); resultados de las repeticiones (T-*); salida de D-2, D-6 (códigos de `deploy.sh`, `ps`, logs y recuentos SQL por paso), D-7 y D-8 con su resumen y la medida del margen del 429; `shellcheck`; `npm test` por app con duraciones, `typecheck`, `lint`, `build:css`; diffs de `deploy/`, `ops/`, `.claude/`; registro de la limpieza.

### Criterios de aprobación

- CA-1, CA-2, CA-3, CA-4, CA-5, CA-8, CA-9, CA-10, CA-11 y CA-14 en PASS con evidencia de proceso real o imagen (no solo de pruebas en proceso).
- `typecheck`, `lint` y `npm test` en 0; T-1 10/10 y T-4 sin fallos.
- `deploy/ci/smoke.sh` real en verde (D-7) y D-6 con los códigos esperados. `ops/backup/ci/smoke.sh` en verde (D-8) o, si el entorno no lo permite, revisión estricta sin hallazgos y pendiente explícito para el PR de la épica a `main`.
- HTML, cabeceras y CSS de las landings idénticos a `425e21a` (o diferencias explicadas y sin impacto visual comprobado en el navegador).
- Ninguna prueba retirada deja sin proteger un comportamiento de la app (P-2 sin casos (c) relevantes) y siguen las pruebas obligatorias de `testing.md` (P-3).
- `api`, `inventory-manager` y `packages/` sin cambios de comportamiento fuera de lo retirado (R-1, R-2).
- Sin defectos `BLOCKER`/`CRITICAL`. Un `MAJOR` (por ejemplo, un cliente que no recibe el 410 a través de Traefik, la pérdida de la cadena de punta a punta de página o un margen del 429 que haga fallar el smoke) se lleva al usuario como `NEEDS_USER_DECISION`. Las variantes de ruta no definidas por RN-1 (riesgo 3) se tratan como observación o `REQUIREMENT_AMBIGUITY`, no como defecto.

### Aprobación del QA Action Plan (PR 2)

El usuario lo aprueba el 2026-11-16. Cita textual: "Apruebo todo". Quedan aprobadas las autorizaciones 1 a 7, incluida la 6 (mutaciones).

## QA Report (PR 2)

### Ronda

1 (PR 2). Ejecutada el 2026-11-16/17 sobre `feature/REQ-F-045-retirada-admin-actual-2-retirada` (base `425e21a`, cambios sin commit; `git status` con 215 entradas antes y después del QA). Exploración con `codegraph_explore`; NotebookLM no disponible en la sesión.

### Pruebas ejecutadas

| Prueba | Acción | Resultado real |
| -- | -- | -- |
| A-2 | `npm run typecheck` | 0 |
| A-3 | `npm run lint` | 0, sin avisos |
| A-4 | `npm run build:css` | 0. CA-14: `grep -rn 'DATA_DIR\|DATABASE_URL\|ADMIN_USER\|admin-recover' landing-pages/src landing-pages/scripts` vacío; `grep -rni 'prisma\|mariadb\|@restaurante/db\|core/identity\|core/bot-control'` en los mismos, vacío. |
| A-1 | `npm test` por app (Vitest con informe JSON) | `api` 49 archivos / 1162 pruebas; `landing-pages` 58 / 896; `inventory-manager` 16 / 278; 0 fallos, 0 omitidas. Archivos más lentos en local (todo en paralelo): `product-repository-contract-prisma-actualizar` 21,6 s (sin cambios en este PR), `api-process` 19,7 s, `last-admin-concurrency` 16,7 s, `server-startup` 12,9 s. |
| A-5 | `git status` / diff de títulos | La única prueba nueva es el `describe` de `app.test.ts` (4 `it` parametrizados, 8 casos); `product-repository-atomicity` tiene los mismos 5 casos que `admin-products-atomicity`; no se añadió ningún `qa-req-f-*`. |
| T-4 | `app.test.ts -t "admin retirado"` ×20 | 20/20 |
| T-1 | `last-admin-concurrency.test.ts` ×10 | 10/10. El `describe` HTTP usa `startApiAdmin()` (proceso real `../api/src/server.ts`) y `runNode(['../api/scripts/admin-recover.ts', …])`. |
| T-2 | `admin-recover.test.ts` + `admin-recover-errores.test.ts` ×5 | 5/5 |
| T-3 | `server-startup.test.ts` + `server-startup-base.test.ts` ×5 | 5/5; todos los casos usan `bootApi` (`API_ENTRY = ../api/src/server.ts`). |
| T-4 | `api-process` ×10, `admin-e2e` ×5, `admin-users-e2e` ×5 | 10/10, 5/5, 5/5 |
| Mutaciones (aut. 6) | `git worktree` temporal; 4 mutaciones de `admin-moved.ts` contra el `describe` nuevo | Sin mutar 8/8. M1 (destino con la ruta): 2 fallan; M2 (405 en lugar de 410): 4 fallan; M3 (`startsWith('/admin')` sin barra): 1 falla; M4 (`Set-Cookie`): 6 fallan. Las 4 detectadas. |
| F-1 | Proceso real en producción (`ADMIN_NEW_URL=https://admin.example.test`, `TRUST_PROXY=true`), GET y HEAD de `/admin`, `/admin/`, `/admin/login?x=1`, `/admin/bot`, `/admin/api/molotes/productos`, `/admin/x/y/z`, `/admin//login` | Todas 302, `Location: https://admin.example.test/`, `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, sin `Set-Cookie`; HEAD con 0 bytes de cuerpo (GET: "Found", 5 bytes, el de Koa). |
| F-2 | Mismo GET con `Cookie: koa.sess=…; koa.sess.sig=…; restaurante.sid=…` | 302 igual, sin `Set-Cookie`. |
| F-3 | POST, PUT, PATCH, DELETE, OPTIONS y PROPFIND en `/admin`, `/admin/login` y `/admin/api/molotes/productos`, con JSON y sin cuerpo | Todos 410 `{"error":{"code":"ADMIN_MOVED","message":"La administración se mudó al admin nuevo."}}`, `no-store`, sin `Set-Cookie`. |
| F-4 | `ADMIN_NEW_URL=https://admin.example.test/panel/` | `Location: https://admin.example.test/panel/` (una sola barra). |
| F-5 | Desarrollo sin `ADMIN_NEW_URL`: GET y POST de `/admin` y `/admin/login` | 404 `NOT_FOUND` con el formato común (en desarrollo incluye `stack`, como cualquier 404 de esa app). |
| F-6 | `/administrador`, `/administracion`, `/adminx`, `/admin.html` en producción y desarrollo | 404 en todas. |
| N-1 | Redirección abierta: `?next=https://evil.test`, `/admin/https://evil.test`, `/admin/%2F%2Fevil.test`, `/admin/..%2F..%2Fevil`, `/admin/../molotes` (`--path-as-is`), `/admin/\evil.test`, `Host: evil.test`, `X-Forwarded-Host: evil.test` + `X-Forwarded-Proto: http` | Siempre 302 a `https://admin.example.test/`. |
| N-2 | `/ADMIN`, `/Admin/login`, `//admin`, `/admin;x`, `/%61dmin`, `/admin%2Flogin`, `/admin%2e`, `/%2e/admin` | 404 todas salvo `//admin` → 400 `Malicious Path` (de `koa-static`, igual para cualquier ruta que empiece por `//`, p. ej. `//molotes`). Ninguna sirve administración ni redirige a otro destino. Ver O-3. |
| N-3 (a) | POST y PUT de 0 B, 32 KiB, 1 MiB, 10 MiB y 100 MiB directo al proceso, con `Content-Length` (con y sin `Expect: 100-continue`) y `chunked` (`curl`) | 30/30 → 410 en ~1 ms; `curl` deja de subir en cuanto llega el 410 (≤1,1 MB subidos con 100 MiB); RSS 138 → 146 MB sin relación con el tamaño. El log nunca registra el cuerpo. |
| N-3 (b) | Lo mismo con POST a través de Traefik (pila de D-6) | 15/15 → 410 (≤57 ms; con 100 MiB Traefik reenvía 28-37 MB y corta); memoria de la app 48,8 MiB. |
| N-4 | 200 GET a `/admin/login` con 50 en paralelo | 200 × 302; 0 errores en el log; 2 sockets abiertos al final. |
| N-5 | `ADMIN_NEW_URL` http en producción, con query o con credenciales | Código 1 con el mensaje de `env.ts`; el valor no aparece en la salida. |
| B-1 / B-3 | Proceso real en producción con `DATABASE_URL` hacia un centinela TCP, `DATA_DIR` inexistente, `ADMIN_USER='bad user!'`, `ADMIN_PASSWORD_HASH=x`, `WHATSAPP_BOT_*` y `BOT_*` basura, `DATABASE_ALLOW_NEWER_SCHEMA=quiza` y `WHATSAPP_BOT_NUMBER` distinto de `WHATSAPP_*` (D-6 retirada), con un gancho `module.registerHooks` que anota cada módulo resuelto | Arranca (`server_started` con `adminMoved:true`); el centinela recibe **0 conexiones**; `DATA_DIR` sigue sin existir; eventos solo `landing_*_fallback`, `request`, `internal_notify_rejected`; `/`, `/molotes`, `/birria` 200, `/admin*` 302, aviso interno sin credencial 401. De 555 resoluciones, **ninguna** de `@restaurante/db`, `prisma`, `@prisma/*`, `mariadb`, `core/identity` ni `core/bot-control`. |
| B-2 | Mismo arranque sin ninguna de esas variables | Igual (`server_started`, fallbacks, 200). |
| B-4 | Imagen `production` con `--read-only --tmpfs /tmp`, sin volumen, `DATABASE_URL` hacia un MySQL apagado | `healthy`; `/molotes` y `/birria` 200, `/admin` 302; `/var/lib/restaurante` vacío. |
| R-1 | `ts.transpileModule` sin comentarios, `425e21a` frente al árbol, de los 19 archivos cambiados de `api/src`, `inventory-manager/src` y `packages/` | 15 idénticos; los 4 distintos (`bot-config.ts`, `memory-page-store.ts`, `page-import.ts`, `prisma-page-store.ts`) solo pierden `parseBotPanel`/`BotPanelConfig`, `parseChangeLog`/`parseChangeLine`/`ParsedChangeLog`, `addImportedChanges`, `IMPORT_BATCH_SIZE` y la opción `timeoutMs` de `transaction` (su valor de 5000 ms era el mismo que el predeterminado de Prisma). |
| R-2 | Símbolos retirados | Sin consumidores (`typecheck` en 0). |
| R-6 | `git diff 425e21a --stat` de `deploy`, `ops`, `compose.yaml`, `Dockerfile`, `.github`; `git diff origin/main` de `compose.prod.yaml`, `deploy.sh`, `deploy/mysql`, `env.production.example` | Solo `deploy/ci/smoke.sh` (+7/−4) y `ops/backup/ci/smoke.sh` (+8/−4); lo segundo, vacío (la suma de `deploy/` no cambia). |
| L-1 / L-2 / L-3 | `eslint --stdin` en `src/controllers/landing.ts` y `scripts/dev-server.ts` | Fallan los 20 imports prohibidos en los dos (incluidos `import *`, `export … from`, un nombre inventado de `core/catalog`, `type PageRepository`, `import()` dinámicos, ruta interna de `packages/db` y otra app). Pasan los 11 nombres permitidos de `core/catalog` más `core/shared`, `core/schedule`, `contracts` y `web`. En `tests/helpers.ts`, `@restaurante/db/client` pasa. La "REGLA DE TRANSICIÓN" ya no está. |
| P-1 a P-4 | Títulos de `describe`/`it` de los 46 archivos borrados y 26 modificados contra `425e21a` | Ver "Pruebas retiradas". |
| H-1 | Pila Docker: MySQL 8.4, `migrate` y `api` del PR 2; app de `425e21a` y app del PR 2 en desarrollo, misma `api` | 21 respuestas (`?dia=` × 3 rutas) + 3 sin `dia`: **24/24 idénticas byte a byte** y con las mismas cabeceras salvo `Date`; HEAD de las 3 rutas, iguales. |
| H-2 | Las dos apps en producción, día real | `/` (64 375 B), `/molotes` (60 448 B), `/birria` (62 783 B) idénticos. |
| H-3 | La `api` detenida y las dos apps reiniciadas | Las 3 páginas idénticas; `landing_products_fallback` `source: seed`; $145 en Molotes y $195 en Birria. |
| H-4 | Los 31 recursos referenciados por el HTML más `/robots.txt`, `/sitemap.xml`, `/favicon.ico`, una ruta inexistente | 36/36 iguales (código y bytes); CSS de Molotes y de Birria con el mismo SHA-256. Única diferencia: `/css/admin/main.css` 200 → 404 (se retiró a propósito). |
| H-5 | Contenido de los avisos y del pedido | Lunes: `rest` en `/` y `/molotes`; martes: `molotes` en `/`, nada en `/molotes`; sábado: nada en `/`, `weekend` en `/molotes`; `/birria`, nunca. WhatsApp: `https://wa.me/<número>`, `target="_blank"`, `rel="noopener noreferrer"`, `data-action="whatsapp-order"` en cada landing. Un `h1` por página; `title` y canonical del negocio. |
| D-2 | Réplica local del job `docker` del CI con las imágenes del PR 2 | Los 7 controles de "contenido de las imágenes" en verde; `migrate` sobre base vacía 0; `api` `healthy` con `server_started`; app `healthy` en `0.0.0.0`, `/molotes` 200 y `landing_products_loaded` `source: api`; `inventory-manager` `healthy`. Base `restaurante_test_ci` creada y borrada. |
| D-3 | Contenido de la imagen `production` | Sin `src/views/admin`, `src/styles/admin`, `public/css/admin`, `scripts/`, `src/repositories` ni `routes/admin.ts`. |
| S-1 | `koalaman/shellcheck:v0.10.0` con los mismos archivos y opciones que el CI | 0 en `deploy/` y 0 en `ops/backup/` (`-x`); `bash -n` de los dos `smoke.sh`, 0. |
| D-7 | `deploy/ci/smoke.sh` real (contenedor `docker:cli`, marca de tiempo por línea) | **186 ok, "todas las comprobaciones pasaron"**, incluidos los 3 checks nuevos de `/admin` y "sin tocar la base (ningún database_* en su log)". |
| D-7 (margen del 429) | Marcas de tiempo | Ráfaga: 20 × 302 y 10 × 429 a las T+0. Checks nuevos (302, sin cookies, 410): **T+71 s**. Hacen falta unos 18 s. El margen no depende de la velocidad del runner: entre medias el propio script hace `sleep 61` (sección del admin nuevo, `deploy/ci/smoke.sh:390`), así que el mínimo es 61 s. **Riesgo 1 descartado.** |
| D-8 | `ops/backup/ci/smoke.sh` real (contenedor `docker:cli` con `age`, `flock`, coreutils; descarga `versitygw` fijada por digest) | **58 ok, "todas las comprobaciones pasaron"**: "hay datos de prueba (usuarios 1, productos 1)", verificación de sumas, `app-data` con `birria/smoke.json`, restauración, `verify-backup.sh --drill` 0. |
| D-6 | Copia temporal reducida de `deploy/ci/smoke.sh` con `deploy.sh` real, registro, Traefik y la plantilla de `.env` | **"todas las comprobaciones pasaron"** (EXIT 0). Detalle abajo. |
| Doc-1 a Doc-5 | Lectura y ejecución | Ver "Documentación". |
| Navegador | Claude in Chrome, pestaña nueva contra la app del PR 2 en producción (`127.0.0.1`) | `/molotes`: un `h1`, sin desbordamiento horizontal, CTA de WhatsApp visible sin scroll, aviso "Descanso" (lunes en México), consola sin errores. Ver O-7. |

**D-6, paso a paso (CA-11, CA-5, CA-8 en la topología real):**
1. Imágenes de `origin/main` (`8f37f4e`, producción) sobre una base vacía → `deploy.sh` 0; recuentos `product 16, product_change 16, product_import 2, page_version 4, page_import 2, page_change 0, user 0, user_audit 0`; `app-data` con `current.json` y `previous.json` de los dos negocios; `/admin/login` de esa app 503 (sin usuarios, como en el PR 1).
2. Épica con la app rota (`api`, `migrate` e `inventory-manager` del PR 2) → **21**; vuelve **toda** la versión anterior (app, `api` e `inventory-manager` de `main`, según `releases.log`), la app de `main` queda `healthy` con el compose vigente, landings 200, sin `page_json_diverged`, `page_import_*`, `products_imported` ni `*_failed`; recuentos iguales; HTML de las 3 rutas idéntico al del paso 1.
3. Subida `main` → PR 2 → 0; la `api` no siembra ni crea usuarios; la app sin `database_*`, `menu_*`, `page_import*` ni `admin_*`; recuentos iguales; **HTML del PR 2 idéntico al de `main` a través de Traefik**; `/admin/login?x=1` 302 a `https://admin.birriaelmuneco.com/`; HEAD de `/admin`, `/admin/bot` y `/admin/api/molotes/productos` 302 sin `set-cookie`; POST/PUT/PATCH/DELETE 410; recuentos (incluida `user_audit`) sin cambios.
4. `docker exec -i <api> node scripts/admin-recover.ts --usuario qa` (contraseña de prueba por tubería) → 0, `console_recovery` en la auditoría, contraseña ausente de la salida. Login en el admin nuevo por Traefik (303); "Bajar" el primer producto de Molotes → la landing cambia el orden en la siguiente visita y la app registra `products_change_notified` `{"business":"molotes","landing":true}`; "Subir" lo deshace (segundo `products_change_notified`). Página de Molotes: precio del hero 145.00 → 150.00 → `?ok=saved&landing=confirmed`, `$150` aparece en `/molotes`; vuelta a 145.00 → `$150` desaparece. Aviso interno sin credencial desde la `api` → 401.
5. Nueva app rota → 21 y vuelve la app del PR 2; landings 200.

### Criterios de aceptación

| CA | Resultado | Evidencia |
| -- | -- | -- |
| CA-1 | PASS | F-1, F-2, F-4, N-1, D-6 paso 3, D-7; `app.test.ts` y `admin-users-e2e` en A-1/T-4. |
| CA-2 | PASS | F-3, N-3 (directo y por Traefik, hasta 100 MiB), D-6 paso 3 (recuentos y `user_audit` sin cambios). La app no tiene base (B-1, B-3). |
| CA-3 | PASS | F-5, F-6; `app.test.ts`. |
| CA-4 | PASS | H-1 (24/24), H-2, H-3, H-4, D-6 pasos 2 y 3 (HTML idéntico por Traefik), B-1 a B-4 (0 conexiones, sin `DATA_DIR`, sin módulos de base). |
| CA-5 | PASS | D-6 paso 4 (producto y página desde el admin nuevo, `landing:true`, cambio visible, aviso sin credencial 401); `admin-e2e`, `internal-app`, `internal-notify-process` en A-1. |
| CA-8 | PASS | T-1, T-2, D-6 paso 4. |
| CA-9 | PASS | T-3 (contra la `api`). |
| CA-10 | PASS | L-1 a L-3, A-3. |
| CA-11 | PASS | D-6 paso 2 (vuelta atrás a la versión de producción con el compose vigente) y paso 5; D-7. |
| CA-14 | PASS | A-1 a A-4. |
| RF-3 | PASS | B-1, D-6 paso 4, A-1. |
| RF-6 | PASS | R-1, R-2, A-1 (`server-startup-base`, `admin-bootstrap` de la `api`). |
| RF-8 | PASS | R-6. |
| CA-6 / CA-7 (regresión del PR 1) | PASS | `server-startup-base` y `admin-bootstrap` (api) en A-1 y T-3; D-6 paso 1 (base vacía) y paso 3 (instalación existente). |
| CA-12, CA-13 | Fuera de alcance (PR 3). | |

### Defectos encontrados

Ninguno.

### Pruebas retiradas (P-1 a P-4)

- **Solo `/admin` retirado (a):** 41 de los 46 archivos borrados (`admin-*`, `bot-pantalla-qa-*`, `admin-qa-round1`, `admin-produccion`, `admin-db-security`, `admin-products-logs`, `db-outage` —503 de `/admin` con la base caída—, `file-menu-repository`, `menu-repository-contract`, `admin-form`, `product-form`, `promo-form`) y los casos caídos de `icons` (favicon de `/admin`), `landing-products` (importación desde `DATA_DIR`; fallo de la base de la landing), `landing-products-api` (CA-4 y DEF-003 del `/admin` viejo), `server-startup-config` (umbral del bot en la landing), `config` (`DATA_DIR`, `DATABASE_URL`, `ADMIN_*`, bot y D-6 en la landing) y `page-import` (`parseChangeLog`, retirado).
- **Cubiertos en otro sitio (b):** `users-api-process` → `user-repository.test.ts` (MySQL) y `api/tests/integration/admin-users-api.test.ts`; `admin-bot-api-process` → `bot-control-store.test.ts` y `api/tests/integration/admin-bot-api.test.ts`; la privacidad de las tablas del bot (QA-T3) → `bot-control-store` ("ninguna columna guarda el número completo"); la mayoría de `bot-control-qa-req-f-043` → `api/tests/unit/bot-control.test.ts` (rotación, enmascarado), `bot-control-reached.test.ts` (token del día, salida de la lista, marca de bloqueo) y `bot-protection-release.test.ts`.
- **Sin sustituto exacto (c), en sondas `qa-req-f-*` que el plan aprobado mandaba retirar:** ver O-1. Ninguno protege comportamiento que cambie en este PR (R-1: `core/bot-control` y los repositorios de usuarios no cambian salvo comentarios).
- **Obligatorias de `testing.md` (P-3):** concurrencia del último administrador (`last-admin-concurrency`, 10/10), "no arranca con base inválida" (`server-startup*`) y con configuración peligrosa (`server-startup-config`), cadena real de productos (`admin-e2e`) y de usuarios (`admin-users-e2e`): presentes y en verde. No hay una cadena real de punta a punta para los datos de página, ni la había en `425e21a` (O-2).
- **Modificadas (P-4):** los casos conservados mantienen sus aserciones; los cambios son de objetivo (proceso de la `api`, repositorios en lugar de `/admin`) y los renombres de los títulos lo reflejan.

### Observaciones (no son defectos)

- **O-1 (cobertura de sondas retiradas):** de `unit/bot-control-qa-req-f-043.test.ts` desaparecen sin equivalente QA-37 (tope de 1000 marcas de "bloqueo quitado": se olvida la más antigua) y QA-65 (una pausa, alta o baja escrita durante un refresco no se pierde); de `users-api-qa-req-f-040-ultimo-admin`, las variantes "dos administradores se degradan entre sí" y "uno se degrada mientras el otro se desactiva". Eran sondas `qa-req-f-*` que el plan técnico aprobado retiraba; el código que probaban no cambia en este PR. Propuesta para una tarea aparte (no se añade aquí): llevar QA-65 y QA-37 a `api/tests/unit/bot-control.test.ts` con nombre de dominio, como pide `testing.md` para casos sin cobertura.
- **O-2:** no existe (ni existía) una cadena real de punta a punta para los datos de página (`inventory-manager` → `api` → aviso → landing); en este QA se recorrió a mano en D-6 paso 4.
- **O-3 (variantes de ruta no definidas por RN-1):** `/ADMIN`, `/Admin/login`, `/%61dmin`, `/admin%2Flogin`, `/admin;x`, `/admin%2e` → 404; `//admin` → 400 de `koa-static`, como cualquier ruta con `//`. Ningún marcador real usa esas formas.
- **O-4 (afirmación del Implementation Result):** "entre las dos secciones hay varios despliegues" no es cierto, pero el margen está garantizado por el `sleep 61` del propio `smoke.sh` (71 s medidos).
- **O-5 (clientes con cuerpos grandes):** `curl` y Traefik reciben siempre el 410; el `ECONNRESET` que vio la implementación con 2 MiB es del cliente de Node al seguir enviando tras la respuesta. Sin impacto para navegadores ni para el 410 en producción (N-3 b).
- **O-6 (documentación fuera de lo autorizado o del PR 3):** `.claude/rules/testing.md:25` y `:31` citan `setupAdmin` (retirado); `.claude/agents/senior-fullstack.md:115` cita `admin-guard.ts` (y `:88`, la semilla antigua); el comentario de la etapa `production` del Dockerfile (líneas 43-48: "la app las lee para verificar el estado de la base"; `DATA_DIR`, `ADMIN_*`) y el de `compose.prod.yaml:119-121` ("solo lectura") quedan desfasados hasta el PR 3 (RN-6 impide tocarlos ahora). `docs/arquitectura.md:370`, `:400`, `:408-409` y `:630` hablan de lo retirado en pasado o como historia: justificados.
- **O-7 (navegador):** `resize_window` no cambió el viewport (siguió en 2560 px), así que no hubo comprobación visual a 375/768/1440 en esta ronda; como el HTML, las cabeceras, el CSS y los 36 recursos son idénticos byte a byte a `425e21a` y a `main` (H-1 a H-4, D-6), no hay cambio visual posible y ningún CA depende de ello. Al abrir `/admin/login?x=1`, el navegador siguió la redirección al destino configurado (`https://admin.birriaelmuneco.com/acceso`, el admin real): solo se cargó la página de acceso (GET), no se escribió nada y la pestaña se cerró.
- **O-8:** `deploy/ci/smoke.sh` no borra las imágenes `smoke/*` que crea con `derive` (por eso había 10 de una ejecución anterior); sin efecto en el CI, cuyo runner es efímero.
- **O-9:** D-8 descargó `versity/versitygw:v1.9.0` (fijada por digest en `ops/backup/ci/smoke.sh`), que no figuraba por nombre en la autorización 4; era imprescindible para D-8 y se borró al terminar.
- **O-10 (duración por archivo):** en local, con las 3 apps en paralelo, `api-process` tardó 19,7 s y `product-repository-contract-prisma-actualizar` 21,6 s (este no cambia en el PR). En el CI se reparte por shards; conviene vigilar `api-process` en el PR (en las 10 repeticiones sueltas pasó siempre).
- `Cotizador_Taquiza_Birria.xlsx` sigue sin seguimiento en la raíz: no debe entrar en el commit.

### Regresión

Suite completa de las 3 apps en verde (A-1); repeticiones T-1 a T-4 sin fallos; réplica del job `docker` del CI (D-2), `shellcheck` (S-1) y los dos `smoke.sh` reales (D-7, D-8) en verde; `api`, `inventory-manager` y `packages/` sin cambios de comportamiento (R-1, R-2); landings idénticas (H-*, D-6).

### Responsive / Accesibilidad / UX/UI / SEO

HTML, cabeceras, CSS y recursos idénticos a `425e21a` y a producción (H-1 a H-4, D-6): sin cambio posible en responsive, accesibilidad, UX ni SEO. Comprobado además: un `h1`, `title` y canonical por negocio, CTA de WhatsApp con `target`/`rel` correctos, sin desbordamiento ni errores de consola en `/molotes`; `/admin*` lleva `X-Robots-Tag: noindex, nofollow`. Ver O-7.

### Performance

Arranque de la app (contenedor → `server_started`, misma `api`): `425e21a` 703 ms, PR 2 404 ms. Memoria en reposo: 105,6 MiB frente a 50,2 MiB. 410 con cuerpos grandes: ~1 ms directo, ≤57 ms por Traefik, sin crecimiento de memoria.

### Documentación

- Doc-1: `README.md` ("Administración" con la tabla 302/410/404, configuración, HTTP), `docs/desarrollo.md` §3-§5, `docs/arquitectura.md` y `docs/despliegue.md` §8 coinciden con lo medido (F-*, B-*, D-6); los `curl` de `despliegue.md` §8.2 se ejecutaron en forma equivalente en D-6 paso 3 (302 con `location: https://admin.birriaelmuneco.com/` sin `set-cookie`; 410) y "`$C logs app` sin ningún `database_*`" se cumplió.
- Doc-2: `landing-pages/.env.example` declara exactamente las variables que lee `env.ts` (`ADMIN_NEW_URL`, `API_INTERNAL_URL`, `BUSINESS_TIMEZONE`, `HOST`, `INTERNAL_NOTIFY_TOKEN`, `INTERNAL_PORT`, `NODE_ENV`, `PORT`, `SITE_URL`, `TRUST_PROXY` y `WHATSAPP_*`); B-2 arranca solo con ellas.
- Doc-3: `.claude/CLAUDE.md` cambia en una sola línea y solo por la frase autorizada; `.claude/agents/` y `.claude/rules/` sin cambios.
- Doc-4 / Doc-5: ver O-6.

### Pruebas no repetidas o no ejecutadas, con su motivo

- Comprobación visual a 375×812, 768×1024 y 1440×900: la ventana no cambió de tamaño (O-7); sustituida por la igualdad byte a byte de HTML, CSS y recursos.
- `systemd-analyze verify` de las unidades de respaldo: las unidades no cambian (fuera del plan).
- `npm run dev` con una `.env` desde el `.env.example` (Doc-2): no se ejecutó `dev`; se arrancó `node src/server.ts` con exactamente esas variables (B-2), que es lo que hace `dev` sin el observador de archivos.
- `npm run admin:recover` desde la raíz contra una base: igual que en el PR 1 (opción b), no se ejecutó para no leer `api/.env`; cubierto con el script en la imagen (D-6) y en T-1/T-2.
- No se crearon sondas en `landing-pages/tests/` (todas las comprobaciones se hicieron con procesos, imágenes y scripts en el scratchpad).

### Pendientes de revisión manual

Ninguno que bloquee. Opcional: una mirada visual a 375 px de `/` y `/molotes` cuando se despliegue la épica (O-7).

### Limpieza

- Bases: `SHOW DATABASES LIKE 'restaurante\_test%'` vacío antes de parar MySQL (`restaurante_test_ci` de D-2 creada y borrada). MySQL detenido con `npm run db:down` (estaba parado al empezar).
- Procesos y puertos: sin Vitest, `src/server.ts`, `admin-recover` ni centinelas; ningún puerto `39xxx` ni de node escuchando (solo un auxiliar de VS Code, ajeno).
- Docker: sin contenedores de QA ni de las pruebas de humo (solo queda `restaurante-mysql-dev-1`, parado, el de `npm run db:up`); sin redes `traefik-public`, `restaurante-smoke*`, `restaurante-bksmoke*` ni `qa-req-f-045b-*`, ni volúmenes de esas pilas; borradas las imágenes `qa-req-f-045b-*` (9), `smoke/*` (incluidas las 10 que ya existían), `bksmoke/*`, `localhost:5000/*`, `koalaman/shellcheck:v0.10.0`, `traefik:v3.7.14`, `registry:3` y `versity/versitygw:v1.9.0`. Se conservan `docker:cli`, `mysql:8.4`, las imágenes que ya estaban y la caché de compilación.
- Worktree de mutaciones borrado: `git worktree list` con un solo árbol. Copias de `git archive` (`425e21a` y `origin/main`) y todos los archivos de QA del scratchpad borrados (quedan `cot.xlsx`, `cotizador-analisis.md` y `venv/`, ajenos).
- Navegador: la pestaña de la prueba cerrada.
- `git status`: las mismas 215 entradas del inicio; ningún archivo de sonda.

### Resultado final

QA_APPROVED

## Historial de cambios

### Versión 1

Descripción inicial. Aprobada por el usuario el 2026-11-16 ("apruebo"), con las decisiones P1 a P8 en la opción A ("asume las recomendadas") y la autorización de `.claude/CLAUDE.md` §8.

### Revisión técnica (2026-11-15)

`senior-fullstack` añade "Revisión técnica" y "Technical Action Plan" (tres PR). Correcciones al Action Plan del BA: las semillas pasan a `core/catalog`, la siembra se hace tolerante a la carrera, los dos `smoke.sh` del CI se ajustan en el PR 2, la documentación de la recuperación pasa al PR 1, y se conservan las pruebas de punta a punta (`admin-e2e` y `admin-users-e2e`). Decisiones P-T1 a P-T4 pendientes. Estado: `NEEDS_TECHNICAL_PLAN_APPROVAL`. Sin cambios de código.

### PR 1 implementado (2026-11-16)

Aprobación del plan técnico y de P-T1 a P-T4 por el usuario ("Recomendadas"). `senior-fullstack` mueve el ticket a `in-progress/` e implementa el PR 1 en `feature/REQ-F-045-retirada-admin-actual-1-arranque`: semillas en `core/catalog`, instalación nueva y primer administrador en la `api`, siembra segura en paralelo, comandos de consola en la `api`, `safeEqualStrings` en `core/shared` y documentación de la recuperación. Validaciones en verde. Estado: `NEEDS_IMPLEMENTATION_APPROVAL` (PR 1 de 3). Sin commit.

### QA Action Plan del PR 1 (2026-11-16)

El usuario aprueba la implementación del PR 1 ("si"), incluida la desviación de sembrar la página antes que los productos. `senior-qa` añade la sección "QA Action Plan" (alcance del PR 1: CA-6 a CA-9, carrera, secretos, comandos de consola, semillas, `safeEqualStrings`, imágenes, regresión, documentación y autorizaciones temporales). Sin ejecutar pruebas. Estado: `NEEDS_QA_PLAN_APPROVAL`.

### QA del PR 1, ronda 1 (2026-11-16)

El usuario aprueba el QA Action Plan ("apruebo todo con b"). `senior-qa` lo ejecuta completo: typecheck, lint y suite en verde, carrera 20/20, 10/10 y 25/25, sondas de proceso real, pila Docker efímera y `deploy/ci/smoke.sh` real (185 ok). Encuentra dos defectos MINOR (DEF-001: `DATA_DIR` sin JSON en una instalación nueva con solo el PR 1; DEF-002: semilla ilegible fuera de `InstallationError`) y tres observaciones. Limpieza comprobada. Estado: `QA_APPROVED`.

### DEF-002 corregido (2026-11-16)

`senior-fullstack` corrige DEF-002 (semilla ilegible dentro de `InstallationError`) con un caso en una prueba existente y anota DEF-001 como pendiente del PR 2. Validaciones en verde. Estado: `QA_APPROVED` (PR 1 de 3), listo para commit y PR.

### PR 1 abierto (2026-11-16)

Commit `bf40141` (`feat: la api prepara las instalaciones nuevas y contiene la recuperación del acceso`) y PR #156 hacia `epic/arquitectura`, abierto como borrador y marcado listo tras el último push. Estado: `READY_FOR_MERGE` (PR 1 de 3), sujeto al CI en verde del PR listo. El ticket sigue en `in-progress/` hasta el PR 3.

### PR 2 implementado (2026-11-16)

Con el PR 1 mergeado en `epic/arquitectura` (`425e21a`), `senior-fullstack` implementa el PR 2 en `feature/REQ-F-045-retirada-admin-actual-2-retirada`: `/admin*` → 302/410/404, `landing-pages` sin base de datos, `DATA_DIR`, administración ni bot, importación desde JSON retirada (también en `packages/`), regla de lint sobre todo `landing-pages/src` y `scripts` con `allowImportNames`, pruebas retiradas y reapuntadas a la `api`, ajuste de los dos `smoke.sh` (DEF-001) y documentación, incluida `.claude/CLAUDE.md` §8. Validaciones en verde. Estado: `NEEDS_IMPLEMENTATION_APPROVAL` (PR 2 de 3). Sin commit.

### QA Action Plan del PR 2 (2026-11-16)

El usuario aprueba la implementación del PR 2 ("Si la apruebo"). `senior-qa` añade la sección "QA Action Plan (PR 2)" (CA-1 a CA-5, CA-8 a CA-11 y CA-14: `/admin*` con variantes, redirección abierta y cuerpos grandes; landings sin base ni `DATA_DIR`; HTML y CSS contra `425e21a`; pruebas retiradas contra la cobertura anterior; `api`, `inventory-manager` y `packages/` sin cambios de comportamiento; lint; los dos `smoke.sh` reales; vuelta atrás y subida `main` → épica con `deploy.sh`; documentación; autorizaciones y limpieza). Renombra las secciones del PR 1 a "QA Action Plan (PR 1)" y "QA Report (PR 1)". Sin ejecutar pruebas. Estado: `NEEDS_QA_PLAN_APPROVAL` (PR 2 de 3).

### QA del PR 2, ronda 1 (2026-11-16/17)

El usuario aprueba el QA Action Plan del PR 2 y las autorizaciones 1 a 7 ("Apruebo todo"). `senior-qa` lo ejecuta: typecheck, lint y suite en verde; repeticiones sin fallos; 4/4 mutaciones detectadas; `/admin*` con variantes, redirección abierta y cuerpos de hasta 100 MiB (directo y por Traefik); landings sin base, sin `DATA_DIR` y sin cargar módulos de base; HTML, CSS y recursos idénticos a `425e21a` y a producción; los dos `smoke.sh` reales en verde (margen del 429: 71 s, garantizado por el `sleep 61` del script); vuelta atrás y subida reales con `deploy.sh` desde la versión de producción. Sin defectos; diez observaciones. Limpieza comprobada. Estado: `QA_APPROVED` (PR 2 de 3).

### PR 2 abierto (2026-11-17)

Tras `QA_APPROVED` del PR 2, commit `69c0c7e` (`feat: las landings dejan el /admin actual y funcionan sin base de datos`) y PR #157 hacia `epic/arquitectura`, abierto como borrador y marcado listo después del último push. Estado: `READY_FOR_MERGE` (PR 2 de 3), sujeto al CI en verde del PR listo. El ticket sigue en `in-progress/` hasta el PR 3.
