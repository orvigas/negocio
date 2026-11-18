# Arquitectura: API, landing pages e inventory manager

Estrategia para convertir `restaurante/` en una **API Koa** que alimenta a **dos frontends**: las
landing pages de Molotes y Birria El Muñeco (como hoy) y un **inventory manager** (inventario,
ventas, CRM y la administración, que desde REQ-F-045 vive solo en `inventory-manager`). Es la referencia de los tickets de la
épica de migración: cada ticket implementa un paso de la [sección 8](#8-plan-de-migración) y, si
necesita desviarse de este documento, lo actualiza en el mismo PR.

| | |
| --- | --- |
| Estado | **Aceptada** (estrategia general). Decisiones A (2026-10-24), B y C (2026-10-26) tomadas ([sección 9](#9-decisiones)). Aplicados los pasos 1 (REQ-F-036), 2 (REQ-F-037) y 3 (REQ-F-038) y los tickets 1 (REQ-F-039) y 2 (REQ-F-040) del paso 4, en producción desde el 2026-10-29 (PR #105, `c53f6f3`; REQ-F-040 con el PR #114, `3715486`). La épica terminó: todos los pasos del plan, hasta el ticket 6 del paso 4 (REQ-F-045), están en `main` (último PR de `epic/arquitectura` hacia `main`: #161, `d358e9f`, 2026-11-17). La rama intermedia se borró el 2026-11-18 y los PR van a `main` |
| Fecha | 2026-10-24 (última actualización: 2026-11-18) |
| Alcance | Estructura del código, regla de dependencias, contratos, consumo de la API y orden de la migración. No cambia el stack de `.claude/CLAUDE.md` §2 |

## 1. Contexto

`restaurante/` es un **monorepo de npm workspaces** (pasos 1 y 2, REQ-F-036 y REQ-F-037) con tres
apps Koa y cuatro paquetes compartidos. Las rutas `src/...` de este documento, sin otro prefijo,
son relativas a `restaurante/landing-pages/`.

- **`landing-pages`**: las landings por SSR (`src/views/`, `src/content/`, `public/`), con el aviso
  del día decidido en el servidor (REQ-F-028 y REQ-F-034), que obtienen de la API los productos
  (REQ-F-038) y los datos de página: hero, texto destacado y promociones (REQ-F-044). Desde
  REQ-F-045 no usa base de datos ni `DATA_DIR` y no tiene administración: `/admin*` responde 302 a
  la raíz del admin nuevo (`ADMIN_NEW_URL`; 410 a cualquier otro método y 404 sin la variable).
- **`api`** (REQ-F-038, REQ-F-039, REQ-F-042 y REQ-F-044): la API JSON propia, solo en la red
  interna. Publica los productos y los datos de página de cada negocio
  (`/api/v1/public/<negocio>/productos` y `/pagina`) y su administración (`/api/v1/admin/...`). Ejecuta además el **bot de WhatsApp** (`api/src/bot/`), que arma el pedido
  y avisa al personal: los pedidos **no se guardan**. Su webhook se sirve en un puerto propio, lo
  único de `api` que se alcanza desde internet. Desde REQ-F-045 prepara una instalación nueva al
  arrancar (productos y página de la semilla y el primer administrador) y contiene los comandos de
  consola `admin:recover` y `admin:hash-password`.
- **`inventory-manager`** (REQ-F-039, REQ-F-040, REQ-F-043 y REQ-F-044): el admin nuevo por SSR de
  productos, usuarios, cuenta propia, control del bot y página, que solo habla con la `api` mediante
  el cliente de `contracts`.
- **Paquetes**: `core` (dominio en TypeScript puro, sin E/S de infraestructura), `db` (MySQL 8.4
  con Prisma: esquema, migraciones y repositorios), `contracts` (esquemas y clientes de la API) y
  `web` (utilidades HTTP y SSR sin dominio que comparten las apps).

El código ya tenía la base de esta separación: **repositorios con interfaz** y varias
implementaciones (`ProductRepository` sobre Prisma o memoria, el repositorio de menús en archivo o
memoria y `BotControlStore`), **reglas de negocio sin Koa** e **inyección por fábricas**
(`createX({ deps })`) armada en el `server.ts` y el `app.ts` de cada app. Lo que queda es terminar
de sacar de `landing-pages` la administración (§8) para que los frontends y los dominios
nuevos (inventario, ventas, CRM) compartan esas piezas sin duplicarlas.

## 2. Objetivos y restricciones

- **Una sola fuente de verdad por regla de negocio.** Qué producto se ve hoy, cuánto cuesta o qué
  aviso toca se calcula una vez, en el dominio. Ningún frontend lo reimplementa.
- **Desacoplar** la lógica de cómo se entrega (HTTP, SSR, webhook del bot, procesos en segundo
  plano) y de cómo se guarda (Prisma).
- **Migrar sin romper producción**: cada paso es un PR desplegable con las pruebas actuales en verde.
- **Respetar el stack** de `.claude/CLAUDE.md` §2: Node 24, Koa, TypeScript estricto con type
  stripping (sin `dist/`), npm, Tailwind, BEM y Vanilla JS, sin frameworks de frontend.
- **No añadir ceremonia** que no pague su costo en un proyecto de este tamaño.

## 3. Decisión: capas modulares con inversión de dependencias

Se usa una **arquitectura de capas** con los nombres de siempre (controller, service y repository),
**organizada por módulo de negocio** y con **una sola regla** tomada de la arquitectura hexagonal: la
inversión de dependencias en la persistencia y en los servicios externos.

```text
controller (HTTP / SSR / webhook) ──► service (casos de uso) ──► repository (interfaz del dominio)
                                                                        ▲
                                              implementación Prisma o en memoria (infraestructura)
```

- **El service solo conoce interfaces** que define el dominio (`ProductRepository`,
  `StockRepository`, `Clock`, el proveedor de WhatsApp). Prisma, Meta o Twilio se conectan desde
  fuera, en la raíz de composición de cada app.
- **El dominio usa tipos propios** (`Product`, `Stock`, `Sale`), no los tipos que genera Prisma, que
  reflejan las tablas. Así un cambio de esquema no se propaga hasta la API ni los frontends.
- **La inversión se aplica solo donde aporta**: persistencia, servicios externos y el reloj. No se
  crean interfaces para todo, ni carpetas `ports/` y `adapters/`, ni mappers en cada frontera.

### Por qué no capas clásicas (controller → service → model)

En las capas clásicas el service importa el modelo del ORM: la regla de negocio depende de cómo se
guardan los datos. Con cuatro entradas a la misma lógica (landings, inventory manager, webhook del
bot y procesos en segundo plano) y pruebas que hoy corren sin MySQL, eso obligaría a duplicar lógica
o a montar una base para todo.

### Por qué no hexagonal pura

Añade capas, interfaces con una sola implementación y mappers que, para dos negocios y un equipo
pequeño, empeoran la mantenibilidad en lugar de mejorarla.

### Por qué por módulo y no por tipo técnico

Todo lo de inventario vive junto (`inventory/`), en lugar de repartido entre una carpeta global de
controllers y otra de services. Cada módulo crece, se prueba y, si algún día hiciera falta, se separa
sin tocar los demás.

## 4. Estructura: monorepo con npm workspaces

```text
restaurante/
├── package.json             ← raíz de workspaces: scripts, lint y typecheck comunes
├── package-lock.json        ← lockfile único
├── tsconfig.base.json       ← opciones estrictas compartidas (desde el paso 2)
├── compose.yaml, docker/    ← MySQL de desarrollo y pruebas (compartido)
├── deploy/                  ← producción: compose.prod.yaml, deploy.sh, mysql/initdb y ci/
├── ops/                     ← respaldos del host (ops/backup)
├── security/                ← excepciones de la auditoría de dependencias
├── docs/                    ← guías (desarrollo, despliegue y este documento)
├── packages/
│   ├── core/                ← dominio y casos de uso. TS puro: sin Koa, sin Prisma, sin HTML
│   │   ├── shared/          (ids de negocio, logger, errores comunes; desde el paso 2)
│   │   ├── catalog/         (productos y menú visible)
│   │   ├── schedule/        (horarios y aviso del día)
│   │   ├── inventory/       (existencias, movimientos y mermas)   ← nuevo
│   │   ├── sales/           (pedidos, ventas y cobros)            ← nuevo
│   │   ├── customers/       (CRM: clientes e historial)           ← nuevo
│   │   ├── identity/        (usuarios, roles y permisos por negocio)
│   │   ├── bot-control/     (bloqueos, pausa y uso del bot de WhatsApp; desde el paso 2)
│   │   └── cotizador/       (cotizador de taquizas: catálogo, ajustes, tarifa y cálculo; REQ-F-046)
│   ├── contracts/           ← esquemas y DTO de la API + cliente HTTP tipado
│   ├── db/                  ← implementaciones Prisma de los repositorios, schema y migraciones
│   └── web/                 ← utilidades HTTP/SSR sin dominio de las apps Koa (desde REQ-F-039)
├── api/                     ← Koa: la única app que habla con MySQL
├── landing-pages/           ← Koa SSR de las landings: HTML, SEO, Tailwind y Vanilla JS
└── inventory-manager/       ← admin nuevo: Koa con SSR, Tailwind y Vanilla JS (decisión B, REQ-F-039)
```

Cada módulo de `core` sigue la misma forma:

```text
packages/core/inventory/
├── stock.ts                 ← tipo de dominio y reglas (invariantes, validación)
├── stock-service.ts         ← casos de uso: ajustarExistencias, registrarMerma…
├── stock-repository.ts      ← interfaz que implementa packages/db
└── index.ts                 ← lo único que se importa desde fuera del módulo
```

### Regla de dependencias

| Paquete o app | Puede importar | Nunca importa |
| --- | --- | --- |
| `packages/core` | Nada del proyecto (solo la biblioteca estándar de Node) | Koa, Prisma, HTML, `contracts` |
| `packages/contracts` | Nada del proyecto | `core`, `db`, Koa |
| `packages/db` | `core` (para implementar sus interfaces) | Koa, `contracts`, `web` |
| `packages/web` | Nada del proyecto (sí Koa) | `core`, `db`, `contracts`, Prisma |
| `api` | `core`, `db`, `contracts`, `web` | Código de los frontends |
| `landing-pages` | `contracts`, `web` | `core`, `db`, Prisma |
| `inventory-manager` | `contracts`, `web` | `core`, `db`, Prisma |

- **Las flechas apuntan hacia `core`.** Entre módulos de `core`, solo a través de su `index.ts`.
- **Lo compartido queda en la raíz** (desviación registrada en el paso 1, REQ-F-036): `deploy/`,
  `ops/`, `security/`, `docs/`, `compose.yaml` y `docker/` no pertenecen a ninguna app. `deploy/`
  conserva su ubicación porque la suma de `compose.prod.yaml`, `deploy.sh` y
  `mysql/initdb/01-usuarios.sh` debe coincidir con la instalada en el VPS.
- **La regla la aplica el lint**, no la memoria: `npm run lint` rechaza un import que la rompa,
  igual que rechaza los imports `./x.js` fuera de `public/js`. Desde el paso 2 (REQ-F-037) hay un
  único `eslint.config.ts` en la raíz, con un bloque de `no-restricted-imports` por paquete (sin
  plugins adicionales). Además, el `exports` del `package.json` de cada paquete solo publica los `index.ts`
  de los módulos de `core` (y los archivos de `db`), así que `tsc` y Node rechazan también un
  import a un archivo interno. Los módulos de `core` y `packages/db/src` son planos (sin
  subcarpetas): los patrones de "sale del paquete" cuentan con ello.
- **`packages/web`** (REQ-F-039, decisión P-1 del usuario: "Paquete packages/web (Recomendado)"):
  el renderizador de plantillas, la lectura de formularios y de JSON, la comprobación de mismo
  origen y el logger JSON (`createLogger`), movidos desde `landing-pages` y `core/shared`; `core`
  conserva solo la interfaz `Logger` y `silentLogger`. También la comprobación de imágenes en disco
  (`createImageChecker`), movida desde `core/catalog`: `core` conserva solo el puerto
  `ImageExists` (en `product-repository.ts`), que `web` implementa con una firma propia compatible
  (no importa `core`). Lo comparten las apps Koa sin duplicarlo.
- **Paquetes:** `@restaurante/core` (sin dependencias), `@restaurante/db` (Prisma, `mariadb` y
  `core`) y `@restaurante/contracts` (Zod desde el paso 3, REQ-F-038). La app `api` (paso 3)
  importa `core`, `db` y `contracts`. Todos los `tsconfig.json` extienden `tsconfig.base.json`,
  en la raíz.
- **Código de `landing-pages`** (paso 3, REQ-F-038; desviación registrada por la decisión P-1 del
  usuario, "Prohibir lo que lee datos"; desde REQ-F-045, todo `landing-pages/src` y `scripts`):
  **no puede importar** `db`, Prisma, `mariadb`, `core/identity` ni `core/bot-control` (tampoco con
  `import()`), y de `core/catalog` solo una **lista cerrada** de funciones puras y tipos
  (`allowImportNames` en `eslint.config.ts`: `buildVisibleMenu`, `formatPesos`, `loadSeedDocument`,
  `mergePageData`, `pickPageData`, `SEED_FILES`, `validateMenuDocument` y sus tipos), así que una
  exportación nueva de persistencia queda prohibida por defecto. Los productos y la página solo le
  llegan del cliente de `contracts`. **Sí puede importar** `core/shared` y `core/schedule`
  (`safeEqualStrings`, del aviso interno, vive en `core/shared` desde REQ-F-045), porque
  el aviso del día y el hero, el destacado y las promociones siguen decidiéndose en las landings.
  La desviación respecto de la tabla (`landing-pages` solo importa `contracts`) dura hasta que los
  horarios y el aviso sean endpoints públicos (§6).
- **O-2 (REQ-F-038):** en todo `landing-pages` (y en `api`), los paquetes solo se importan por su
  nombre: un import relativo a un archivo de `packages/` o a un archivo interno de un módulo de
  `core` falla en el lint.
- **Fin de la regla de transición (REQ-F-045):** la excepción que dejaba a `/admin` importar `core`
  y `db` desde `landing-pages` (paso 2, REQ-F-037) se retiró con `/admin`. Para el bot sigue activa
  la suya (REQ-F-042): el lint rechaza un archivo del bot en `landing-pages` y cualquier import de
  otra app. Las pruebas de `landing-pages/tests` quedan fuera de la regla del código: conservan la
  infraestructura de MySQL de pruebas, las pruebas de los paquetes y las que arrancan la `api`.

## 5. Contratos compartidos (`packages/contracts`)

- **Cada esquema se define una vez**: la API lo usa para validar lo que entra y serializar lo que
  sale, y los frontends para tipar el cliente HTTP. Así se cumple `.claude/rules/frontend-backend.md`:
  no duplicar a mano un contrato que se puede compartir.
- **La API está versionada** (`/api/v1`). Un cambio incompatible crea `/api/v2`; el anterior se
  mantiene hasta que ningún frontend lo use.
- **Los errores mantienen el formato actual**: `{ "error": { "code", "message" } }`, con `fields`
  en los 422 y `current` en los 409 (como la API de productos de REQ-F-008).
- **Las entradas externas llegan como `unknown`** y se validan en el borde, como pide
  `.claude/rules/typescript.md`.

## 6. Cómo se consume la API

| | Landing pages | Inventory manager |
| --- | --- | --- |
| Endpoints | `GET /api/v1/public/...`: productos (REQ-F-038) y datos de página (REQ-F-044). Públicos y de solo lectura; el aviso del día y los horarios siguen en `landing-pages` | `/api/v1/admin/...`: lectura y escritura, con autenticación y permisos por negocio |
| Renderizado | **Sigue en SSR** con Koa: el SEO y la regla de que el servidor decide el aviso no cambian | Ver la [decisión B](#9-decisiones) |
| Resiliencia | Caché corta con `stale-while-revalidate` y la última copia buena como respaldo: una caída de la API no tira las landings | Muestra el error de la API (503 o 409) y no pierde lo que se estaba editando |
| Seguridad | **Sin credenciales de la base** (mínimo privilegio) | Sesión de la API (cookie `SameSite=Strict` en `inventory-manager`) y token CSRF |

**Paso 3 aplicado (REQ-F-038):** las landings consumen solo `GET /api/v1/public/{negocio}/productos`
(decisión "Solo productos": el aviso del día, los horarios y el hero, el destacado y las promociones
siguen en `landing-pages`; los tres últimos pasan a la API en REQ-F-044, abajo). La resiliencia es la de la tabla, concretada así:

- caché en memoria por negocio, fresca 60 s y refrescada en segundo plano al vencer
  (*stale-while-revalidate*);
- cada escritura de productos invalida la caché de ese negocio (desde REQ-F-039, con el aviso
  interno de la `api`; hasta REQ-F-045 también en proceso desde `/admin`) y la siguiente visita
  espera los datos nuevos (como mucho 1,5 s): la frescura sigue siendo "al instante";
- un vuelo por negocio (las visitas simultáneas comparten la petición) y, durante una caída, un
  reintento de fondo cada 5 s como mucho;
- si la API falla (caída, más de 1,5 s, 5xx o un cuerpo que no cumple el contrato), la última copia
  buena sin límite de tiempo y, si no la hubo (arranque sin API), la semilla
  (`core/catalog/seeds/` desde REQ-F-045, reexportada en `content/seeds.ts`); ninguna landing
  responde 5xx por la API;
- las landings no tienen credenciales de la base en su código ni las usan (REQ-F-045), y desde la
  limpieza de `deploy/` (PR 3 de REQ-F-045) el compose tampoco se las pasa al contenedor.

**Paso 4, ticket 1 aplicado (REQ-F-039):** `inventory-manager` renderiza en el servidor (decisión
B) y es lo único con lo que habla el navegador. Llama a `/api/v1/admin` por la red interna `admin`
con el cliente de `contracts` (`createAdminApiClient`, que nunca lanza). Concretamente:

- **Sesión (D-1):** la crea y la decide la API. `inventory-manager` guarda su id en la cookie
  `__Host-admin_sid` y lo reenvía como `Authorization: Bearer`.
- **CSRF (D-2):** mismo origen en `inventory-manager` y el token de la sesión en `X-CSRF-Token`,
  que valida la API.
- **Resiliencia:** con la API caída o en 503, aviso y lo escrito se conserva. Un 409 muestra quién y
  cuándo, y deja cargar la versión vigente o guardar encima.
- **Frescura:** tras cada escritura confirmada, la API avisa a `landing-pages` por su puerto interno
  (`INTERNAL_PORT`, 3002, con credencial): invalida la caché de esa landing. La escritura espera ese
  primer aviso como mucho 2 s para decir la verdad (`meta.freshness`). La red de seguridad es la
  caducidad de 60 s de las landings. Desde REQ-F-042 el bot está en `api` y usa la misma caché de
  productos que `/api/v1/admin`: lo ve en proceso, sin aviso, y `meta.freshness` solo confirma si
  esa caché quedó al día. Su red de seguridad es una recarga cada 60 s.
- **Un solo escritor:** la API, con una réplica y su mutex, es la única que escribe productos (hasta
  REQ-F-045 el `/admin` de las landings los mostraba en solo lectura con `ADMIN_NEW_URL`).

**Paso 4, ticket 5 aplicado (REQ-F-044):** las landings consumen también
`GET /api/v1/public/{negocio}/pagina` (hero, texto destacado y promociones), con las mismas reglas
que los productos: una caché común (`src/services/landing-cache.ts`) con frescura de 60 s, un vuelo
por negocio, última copia buena y, sin copia, la semilla. Un 503 `PAGE_UNAVAILABLE` es un fallo más
y nunca sustituye una copia buena. El documento que se pinta es la semilla de `content/` con la
página de la API encima (`mergePageData`) y los productos de la API: el HTML no cambia.

- **Frescura:** el aviso interno `/internal/v1/productos-cambiados` significa "cambió este negocio".
  Invalida productos y página, y `landing` solo es `true` si los dos quedaron al día. La `api` lo
  envía tras cada escritura de productos o de página.
- **Un solo escritor:** MySQL es la fuente de verdad de la página y la `api` la única que la escribe.
- **Importación única:** la hizo la `app` al arrancar entre REQ-F-044 y REQ-F-045 (ver el paso 4,
  ticket 5, en la [sección 8](#8-plan-de-migración)). Desde REQ-F-045 se retiró: una instalación
  nueva la prepara la `api` con la semilla, y los JSON de `DATA_DIR` no los lee ninguna app.

**El bot de WhatsApp es un cliente más de `core`** (REQ-F-042). Vive dentro de `api` (`api/src/bot/`)
y su webhook es otra entrada HTTP, en un puerto propio. Cuando exista `sales`, sus pedidos
confirmados se guardan como ventas en lugar de solo avisar al personal.

**Quién escribe el control del bot (REQ-F-043).** La pausa, los bloqueos y los topes se manejan en la
pantalla "Bot" de `inventory-manager`, con `/api/v1/admin/bot`. Ese endpoint usa la misma instancia
de `BotControl` que el bot, en el proceso de `api`: los cambios le llegan sin esperar el refresco, y
la lista "alcanzaron un tope hoy" es la de su memoria. `api` es la única que escribe (la página
"Bot" del `/admin` de las landings se retiró en REQ-F-045). `api` sigue refrescando el control desde
la base cada `BOT_CONTROL_REFRESH_SECONDS` (10 s); retirar ese refresco es una propuesta aparte.

### Cotizador de taquizas (REQ-F-046)

Funcionalidad ajena al plan de migración (fue directa a `main`, no a `epic/arquitectura`), construida con
las mismas capas:

- `packages/core/cotizador/` (TS puro, sin E/S): valida el JSON del catálogo y los ajustes (ambos
  como `unknown`), define una sola vez los campos editables (claves, rangos y lectura y escritura
  sobre el catálogo), aplica los ajustes sobre una copia, calcula y arma la matriz. La tarifa está
  aislada en `tariff.ts`. El catálogo llega por el puerto `QuoteCatalogSource` (asíncrono), así
  que el cálculo no sabe de dónde viene.
- `packages/contracts/quote.ts`: el DTO de los campos con sus valores por defecto, el cuerpo del
  cálculo (personas y solo las diferencias respecto del JSON, como texto) y su resultado, y los
  métodos `getQuoteDefaults` y `calculateQuote` del cliente del admin.
- `api`: el JSON (`api/src/cotizador/catalogs/birria.json`), su lectura y validación al arrancar
  (`file-catalog-source.ts`) y las rutas `GET /api/v1/admin/<negocio>/cotizador` y
  `POST …/cotizador/calculos`, solo para administradores. Un JSON inválido no impide arrancar
  (decisión P-2 del usuario): el cotizador responde 503 `QUOTE_UNAVAILABLE` y el CI es la barrera.
- `inventory-manager`: la pantalla `GET /birria/cotizador` (`controllers/quote.ts` y
  `views/quote.ts`), solo para administradores y con su enlace en el menú de Birria. Pide los
  campos, traduce la query a ajustes, llama a la API y pinta; no calcula ni valida nada, porque no
  puede importar `core`. El formulario es GET y funciona sin JavaScript: al pulsar «Calcular»
  responde 303 a la URL con solo N y los campos que difieren del JSON (recargable y compartible),
  y rechaza sin calcular una query de más de 8 KiB o con claves repetidas o desconocidas. Nunca
  registra la query ni los valores.
- Fase 2: otra implementación del puerto (en `db`) tomará de la tabla de productos el nombre y el
  precio a la carta de cada ítem por el `slug` de `producto`, sin cambiar el contrato.

**Fórmula de precio.** Con a = tarifa en `minPersonas`, b = tarifa en `refPersonas` y F = piso,
s = (a − b) / (refPersonas − minPersonas):

- si minPersonas ≤ N ≤ refPersonas: tarifa(N) = a − (N − minPersonas) × s (la recta del Excel);
- si N > refPersonas: tarifa(N) = F + (b − F) × e^(−s × (N − refPersonas) / (b − F)), continua en
  valor y en pendiente en la referencia, que converge a F sin cruzarlo;
- precio comercial = tarifa(N) redondeada (0.5 sube); precio sugerido = el mayor entre el
  comercial y el precio por margen, ((costo variable + fijos / N) / (1 − margen), hacia arriba).

Restricciones: F < b ≤ a y minPersonas < refPersonas. Para modificarla: los valores, en el JSON
(con un PR); la curva, sustituyendo `tariff.ts` y sus valores esperados en
`api/tests/unit/quote-calculator.test.ts`. El detalle (parámetros, ejemplo y formato del JSON)
está en el [README](../README.md#cotizador-de-taquizas).

## 7. Patrones

- **Casos de uso (servicios de aplicación).** Cada acción del negocio es una función del service del
  módulo. El controller solo traduce: HTTP → caso de uso → HTTP. Hoy parte de esa lógica está en los
  controladores de `src/controllers/`.
- **Raíz de composición por app.** Cada `server.ts` crea las implementaciones (Prisma, Meta, reloj) y
  se las pasa a los services con las fábricas `createX({ deps })` que ya se usan. No hace falta un
  contenedor de inyección de dependencias.
- **Eventos de dominio con outbox** para lo que cruza módulos. Por ejemplo, una venta confirmada
  descuenta existencias y actualiza el historial del cliente: `sales` guarda el evento en la misma
  transacción que la venta y un proceso lo aplica en `inventory` y `customers`. Ningún módulo llama
  directamente a otro para escribir, y no se pierden eventos si el proceso cae.
- **Concurrencia optimista** con `version` (error 409), como los productos hoy, extendida a
  existencias, pedidos y clientes.
- **Repositorio en memoria por cada interfaz** para las pruebas unitarias, con una prueba de contrato
  compartida que corre contra la implementación en memoria y contra la de Prisma, como hoy la de
  productos (`landing-pages/tests/support/product-repository-contract.ts`, que ejecutan
  `product-repository-contract-memoria.test.ts` y los `product-repository-contract-prisma-*.test.ts`).

## 8. Plan de migración

Se sigue el patrón *strangler fig*: lo nuevo crece alrededor de lo actual y lo reemplaza por partes.
**Cada paso es un ticket y un PR desplegable**; las pruebas actuales son la red de seguridad.
Los PR de los pasos fueron a la rama intermedia `epic/arquitectura`, que validaba sin desplegar, y
la épica llegó a `main` con PR desde esa rama (#105, #114, #141, #148, #158 y #161). La rama se
borró el 2026-11-18, con todo su contenido en `main`; hoy los PR van a `main`.

**En producción:** los pasos 1 a 3 y el ticket 1 del paso 4 llegaron a `main` con el PR #105
(`epic/arquitectura` → `main`, merge `c53f6f3`) y se desplegaron el 2026-10-29 ([Despliegue](despliegue.md)).
El ticket 2 del paso 4 (REQ-F-040) llegó con el PR #114 (merge `3715486`) y se desplegó el mismo día.

| Paso | Qué hace | Cambia el comportamiento |
| --- | --- | --- |
| 1 | **Monorepo sin cambios funcionales** (REQ-F-036). Workspaces en `restaurante/` y la app actual pasa tal cual a `landing-pages/`. Se ajustan el CI (`.github/workflows/ci.yml`, Dependabot), el `Dockerfile`, `compose.yaml` y la documentación. De `deploy/` no se toca ningún archivo de la suma (`compose.prod.yaml`, `deploy.sh`, `mysql/initdb/01-usuarios.sh`): las imágenes y sus nombres no cambian | No |
| 2 | **Extraer `core`, `contracts` y `db`** del `src/` actual (REQ-F-037). Se mueven los archivos y se ajustan los imports, sin reescribir la lógica (detalle abajo) | No |
| 3 | **Crear `api/`** con los endpoints públicos. Las landings pasan a consumirlos y dejan de acceder a la base (REQ-F-038, detalle abajo) | No (mismo HTML) |
| 4 | **Llevar `/admin`** (productos, usuarios y control del bot) a `/api/v1/admin` y al nuevo `inventory-manager`. El `/admin` actual se retira cuando el nuevo tenga lo mismo | Sí: nueva interfaz de administración |
| 5 | **Dominios nuevos, un ticket por módulo:** inventario → ventas (incluidos los pedidos del bot) → CRM | Sí |

### Dónde quedó el código (punto de partida del plan)

Tabla histórica: describe el `src/` de la app única antes del paso 2 (REQ-F-037), ya en
`landing-pages/` desde el paso 1, y adónde se llevó cada parte. No es el estado actual: lo que se
movió a `packages/`, a `api/` o a `inventory-manager/` ya no está en `landing-pages/` (y el `/admin`
de las landings se retiró en REQ-F-045); lo que se quedó en `landing-pages/` (`src/views/`,
`src/content/`, `src/styles/`, `public/` y `src/config/env.ts`) sigue ahí. La estructura vigente
está en el §4.

| Antes del paso 2 | Destino |
| --- | --- |
| `src/services/product-schema.ts`, `visible-menu.ts`, `menu-schema.ts`, `price.ts`, `slug.ts` | `packages/core/catalog/` |
| `src/services/business-schedule.ts` | `packages/core/schedule/` |
| `src/services/authorization.ts`, `user-schema.ts`, `admin-auth.ts` | `packages/core/identity/` |
| Interfaces de `src/repositories/*` | El módulo de `core` correspondiente |
| `src/repositories/prisma-*.ts`, `prisma/` | `packages/db/` |
| `src/repositories/memory-*.ts` | Junto a su interfaz en `core` (son las implementaciones de prueba) |
| `src/controllers/admin-products-api.ts` y `routes/admin-api.ts` | `api/` (`/api/v1/admin/products`) |
| `src/services/whatsapp-bot/`, `controllers/whatsapp-webhook.ts` | `api/src/bot/`, usando `core` (**aplicado en REQ-F-042**) |
| `src/views/`, `src/content/`, `src/styles/`, `public/` | `landing-pages/` |
| `src/views/admin/`, `controllers/admin*.ts` | Se sustituyen por `inventory-manager/` en el paso 4 |
| `src/config/env.ts` | Cada app valida solo sus variables; lo común va en un módulo compartido |

Los nombres exactos de archivos y endpoints los fija el plan técnico de cada ticket.

### Plan del paso 4 (REQ-F-039)

Decisión del usuario: "Sí, 6 tickets en ese orden". Cada ticket es su propio PR (o varios) hacia
`epic/arquitectura`.

| # | Ticket | Notas |
| --- | --- | --- |
| 1 | **REQ-F-039**: base del admin nuevo y productos | Terminado en tres PR (#94, #95 y #99), detalle abajo |
| 2 | **REQ-F-040**: usuarios y cuenta propia | Terminado en dos PR (#110 y #111) y en producción desde el 2026-10-29 (#114), detalle abajo |
| 3 | **REQ-F-042**: mover el bot a `api` | Tres PR (#121, #124 y el de despliegue) hacia `epic/arquitectura`, detalle abajo. Publica una entrada de `api` para el webhook con un router de Traefik solo para esa ruta. **La URL se conserva** (`https://birriaelmuneco.com/webhooks/whatsapp`, decisión D-1 de REQ-F-042): no hay ningún cambio en Meta. Activa la regla de lint para el bot |
| 4 | **REQ-F-043**: control del bot en el admin nuevo | Tres PR (#130, #131 y el de solo lectura y documentación) hacia `epic/arquitectura`, detalle abajo. Pausa, bloqueos y topes |
| 5 | **REQ-F-044**: página en MySQL y edición en el admin nuevo | Tres PR hacia `epic/arquitectura` (#134, #139 y el del corte), detalle abajo. PR 1: tablas, `core`, `db`, contratos y endpoints de `api`, apagados por `PAGE_CUTOVER`. PR 2: pantalla "Página". PR 3, en un segundo despliegue: importación, landings por API, solo lectura en `/admin` y retirada de `PAGE_CUTOVER` |
| 6 | **REQ-F-045**: retirada del `/admin` actual | Tres PR hacia `epic/arquitectura`, detalle abajo. PR 1: instalación nueva y recuperación en la `api`. PR 2: retirada del código de `/admin` e importación desde JSON en `landing-pages` y regla de lint. PR 3 (tras confirmar producción estable): limpieza de `deploy/` y `ops/` (credenciales de la base y `app-data` de `landing-pages`, router `restaurante-admin`) |

Los IDs de los tickets 5 y 6 se asignan al crearlos.

### Paso 4, ticket 6, PR 3 aplicado (REQ-F-045)

Limpieza de `deploy/` y `ops/`, una vez confirmada la estabilidad de producción con los PR 1 y 2:

- **Compose:** la app ya no recibe `DATABASE_URL`, `DATABASE_ALLOW_NEWER_SCHEMA`, `DATA_DIR`, `ADMIN_*`
  ni las variables del bot (sí `WHATSAPP_MOLOTES`/`WHATSAPP_BIRRIA`, para el CTA), y no monta
  `app-data`. La `api` recibe `ADMIN_USER`/`ADMIN_PASSWORD_HASH` (primer administrador de una
  instalación nueva). Sin el router `restaurante-admin` ni su límite: `/admin` va por el router raíz.
  La app sigue en la red `db`, por la que llega a la `api` (sacarla queda fuera del ticket).
- **Volumen `app-data`:** declarado pero sin montar; se conserva en el VPS y no se borra.
- **Respaldos:** formato 2 (manifiesto y volcado, sin `app-data`). `restore.sh` y `verify-backup.sh`
  aceptan también el formato 1; con él, `app-data` se restaura en el volumen y el simulacro le da a
  la app de entonces la base y `DATA_DIR`. Los scripts nuevos se instalan en el VPS antes del merge,
  con la app del PR 2 en marcha ([despliegue §1.3](despliegue.md#13-instalar-deploy)): ningún
  respaldo de formato 1 lleva una imagen sin la carpeta de `DATA_DIR`.
- **Imagen `production`:** sin la carpeta de `DATA_DIR`. Sigue llevando `packages/db` y Prisma
  (adelgazarla queda fuera del ticket).
- **Vuelta atrás:** la automática vuelve a la app del PR 2, que arranca con este compose. Una
  versión anterior a REQ-F-045 necesita el compose de su commit ([despliegue
  §6](despliegue.md#volver-a-una-versión-anterior-a-req-f-045)).

### Paso 4, ticket 6, PR 2 aplicado (REQ-F-045)

Con el PR 2, `landing-pages` queda solo con las landings: el paso 4 está completo en el código (la
limpieza de `deploy/` y `ops/` es el PR 3).

- **`/admin` retirado** (`src/middleware/admin-moved.ts`, antes de `koa-static`): GET y HEAD de
  `/admin` y `/admin/*` responden 302 a `<ADMIN_NEW_URL>/` (destino fijo, sin la ruta ni la query: no
  hay redirección abierta), con `Cache-Control: no-store`; cualquier otro método, 410 `ADMIN_MOVED`
  sin leer el cuerpo; sin `ADMIN_NEW_URL`, 404. Nunca pone ni lee cookies. Se borran las rutas,
  controladores, vistas, estilos (`build:css:admin`), servicios y repositorios de `/admin`
  (incluida la API JSON `/admin/api` de REQ-F-008) y su creación del primer administrador.
- **Sin base de datos ni `DATA_DIR`:** `server.ts` valida la configuración, crea el cliente de la API,
  carga las cachés de productos y página, escucha y abre el aviso interno. `config/env.ts` ignora sin
  validar `DATABASE_URL`, `DATABASE_ALLOW_NEWER_SCHEMA`, `DATA_DIR`, `ADMIN_*` y `WHATSAPP_BOT_*`
  (el compose se las pasó hasta el PR 3). Se retira de `landing-pages` la regla D-6 de
  REQ-F-009 (los números de WhatsApp iguales al del bot), que dependía de la configuración del bot;
  la `api` la sigue comprobando con sus propias variables.
- **Importación desde JSON retirada (RN-4):** se borran `importPages`, el repositorio de menús por
  archivo y en memoria, `parseChangeLog` y `addImportedChanges` (contrato, Prisma y memoria). MySQL
  es la única fuente de la página; `PAGE_ACTIONS.RESTORE_SEED` se conserva porque hay filas
  importadas que la usan.
- **Lint:** la regla del código de `landing-pages` cubre `src/` y `scripts/` (ver §4) y se borra la
  regla de transición.
- **Pruebas:** las que arrancan la `api` desde `landing-pages/tests` (recuperación, concurrencia del
  último administrador, arranque con una base inválida y primer arranque) sustituyen la sesión del
  `/admin` retirado por la de `/api/v1/admin`.

### Paso 4, ticket 6, PR 1 aplicado (REQ-F-045)

Retirada del `/admin` actual en tres PR hacia `epic/arquitectura`. El PR 1 lleva a la `api` lo que la
administración necesita fuera de `landing-pages`, sin cambiar todavía nada de `landing-pages` hacia
fuera ni de `deploy/` u `ops/`:

- **Semillas en `core/catalog`:** `core/catalog/seeds/{molotes,birria}.json` (las mismas, movidas sin
  cambios desde `landing-pages/src/content/<negocio>/seed.json`), con `SEED_FILES` y
  `loadSeedDocument` (`core/catalog/seeds.ts`, lectura con `node:fs`). `landing-pages` las reexporta
  en `content/seeds.ts`; las pruebas de la `api` ya no tienen su copia.
- **Instalación nueva en la `api`** (`api/src/install/`): tras verificar la base, si `product_import`
  no tiene filas, siembra la página (`seedPages` de `core/catalog/page-import.ts`: vigente y
  anterior = semilla, marca `seed`) y después los productos de la semilla, y crea el primer
  administrador con `ADMIN_USER`/`ADMIN_PASSWORD_HASH` (ahora variables de la `api`). En una
  instalación existente no siembra nada. Cada paso que falla termina con 1 y un mensaje sin
  detalles.
- **Dos arranques a la vez** (hasta el PR 2, la `api` y la importación de `landing-pages`, solo en desarrollo; después, dos arranques de la `api`):
  `isWriteConflict` y `confirmedByOther` (`core/shared/concurrent-write.ts`). Ante un choque de
  claves o un interbloqueo, el que pierde vuelve a leer las marcas; si aparecen, registra
  `products_import_skipped`, `page_seed_skipped` o `page_import_skipped` con `reason: "concurrent"` y
  sigue.
- **Comandos de consola en la `api`:** `api/scripts/admin-recover.ts`, `hash-password.ts` y
  `support/read-hidden.ts`, en la imagen `api` (`docker compose exec api node scripts/admin-recover.ts`).
  Los alias de la raíz (`npm run admin:recover`, `npm run admin:hash-password`) delegan en `-w api`.
- **`safeEqualStrings`** pasa de `core/identity` a `core/shared/safe-equal.ts`: la usan el aviso
  interno de las landings, el CSRF de la API y el webhook del bot, que no dependen de la identidad.
  Así el PR 2 puede prohibir `core/identity` en `landing-pages` sin excepciones.

### Paso 4, ticket 5 aplicado (REQ-F-044)

Decisiones del usuario D-0 a D-12 en el ticket. Lo esencial del corte (PR 3):

- **Importación única en el arranque de la `app`** (`src/services/page-import.ts`, reglas puras en
  `core/catalog/page-import.ts`). Orden de `server.ts`: verificar la base → ¿`product_import` tiene
  filas? (instalación existente) → preparar `DATA_DIR` sin escribir la semilla si la instalación ya
  existía → importar la página → importar productos → cargar las cachés → escuchar.
  - Origen por negocio: `current.json`; si no sirve, `previous.json`; si tampoco, la semilla, que solo
    se acepta en una instalación nueva. En una existente se niega (`page_import_failed` con
    `PAGE_IMPORT_SEED_REFUSED`) y la `app` termina con 1: el despliegue vuelve atrás (D-10).
  - Una sola transacción para los negocios sin marca: versiones, historial de `changes.jsonl` (por
    lotes de 500, líneas ilegibles contadas y omitidas, `authorId` nulo si falta) y la marca
    `page_import`. Si algo falla, no queda nada y la `app` termina con 1.
  - Con marca, no se reimporta. Si el JSON cambió desde entonces (una edición durante una vuelta
    atrás), solo se registra `page_json_diverged`, sin contenido.
  - Los JSON y `changes.jsonl` no se modifican ni se borran.
- **`api` sin `PAGE_CUTOVER`:** usa el repositorio de página directamente. Sin filas (dentro del
  despliegue, entre el arranque de la `api` nueva y la importación) o con una fila dañada, responde
  `PAGE_UNAVAILABLE`, y la pantalla "Página" muestra un aviso neutro, el mismo en los dos casos.
- **Lint:** `landing-cache.ts` y `landing-page.ts` son código de las landings: no pueden importar el
  repositorio ni el store de página, ni el repositorio de menús.
- **Sin migración, variables ni cambios en `deploy/` u `ops/`.** El repositorio de archivos y
  `DATA_DIR` siguen hasta el ticket 6, que retira `/admin` y decide el destino del volumen `app-data`.

### Paso 4, ticket 4 aplicado (REQ-F-043)

Decisiones del usuario: "Solo mostrarlos (Recomendado)" para los topes, y "Solo lectura y 410
(Recomendado)" para `/admin/bot`.

- **PR 1 (#130), contratos y `api`:**
  - `/api/v1/admin/bot`, solo para administradores: estado, interruptor, alta y baja de bloqueos, y
    bloqueo desde "alcanzaron un tope hoy" con un token de un solo uso;
  - la lista de topes vuelve a estar disponible, y el personal no aparece en ella ni se puede bloquear
    por token;
  - quitar un bloqueo devuelve el cupo diario del número: `takeReleased` y `guard.release`.
- **PR 2 (#131), pantalla:** "Bot" en `inventory-manager`, sin JavaScript nuevo. Un teléfono escrito
  nunca se vuelve a pintar. Una escritura sin confirmar da 503 y pide revisar el estado antes de
  repetirla. Un 404 de una `api` anterior a este ticket (código `NOT_FOUND`) tampoco se toma por
  "no encontrado".
- **PR 3, solo lectura y documentación:** con `ADMIN_NEW_URL`, `/admin/bot` muestra estado, uso y
  lista, sin formularios, con un aviso y un enlace a `<ADMIN_NEW_URL>/bot`. Sus 4 POST pasan sesión,
  permiso, cuerpo y CSRF, y responden 410 con esa misma página, sin escribir. Registran
  `admin_bot_moved`.
- **Sin cambios de esquema ni variables nuevas.** `landing-pages` conserva la clave, el personal y los
  topes hasta el ticket 6, porque `/admin/bot` sigue leyendo.

### Paso 4, ticket 3 aplicado (REQ-F-042)

- **Bot en `api/src/bot/`:** orquestador, proveedores, intérprete, protección, contenido propio,
  simulador y pruebas. Lo que comparte con las landings y con `/admin` pasó a `core` (horario,
  nombres, enlace de Maps, enlace de WhatsApp y `bot-control`).
- **Webhook en un puerto propio (P-1):** `WEBHOOK_PORT`, 3004, una app Koa que solo tiene
  `/webhooks/whatsapp`. El puerto 3001 sigue siendo interno.
- **URL conservada (D-1):** `https://birriaelmuneco.com/webhooks/whatsapp`. El router
  `restaurante-webhook` usa `Host(<dominio>) && Path(/webhooks/whatsapp)`, ruta exacta, con prioridad
  200, por encima de los routers de la app, y apunta al 3004. El resto del dominio sigue yendo a
  `landing-pages`.
- **Red:** `api` entra en `traefik-public`, por la entrada del webhook y porque necesita salida a
  internet para hablar con Meta. Un contenedor vecino de esa red alcanza `api:3001`, como alcanza
  `app:3000` (riesgo aceptado). `api` llega a MySQL y a `app` por sus nombres de contenedor, para que
  un alias `mysql` o `app` de un vecino no responda por ellos.
- **Vuelta atrás (RF-13):** la imagen `api` lleva `LABEL org.restaurante.webhook="whatsapp"` y
  `deploy.sh` enciende el router solo con esa etiqueta (`RESTAURANTE_API_WEBHOOK`). Con una `api`
  anterior el router no existe y la ruta vuelve a la app anterior, que tiene el bot y sigue recibiendo
  sus variables (P-2, hasta el ticket 6). Antes de cambiar la app, `deploy.sh` comprueba que Traefik
  ya enruta el webhook a `api`. En la vuelta atrás automática, la `api` vuelve la última, cuando la
  app anterior ya está lista, y se comprueba que quede atendiendo.
- **`/admin` en transición:** pausa, bloqueos y uso (leído de la base). La lista de topes de hoy
  volvió en el ticket 4 (REQ-F-043), en el admin nuevo.
- **Regla de lint:** la regla de transición ya no menciona el bot.

### Paso 4, ticket 2 aplicado (REQ-F-040)

Decisiones del usuario: "Dos PR (Recomendado)" y "Como productos (Recomendado)" para la solo lectura.

- **PR 1 (#110), `api` y `contracts`:**
  - usuarios en `/api/v1/admin/usuarios` (solo administradores: 403 `FORBIDDEN_ROLE` antes de mirar
    el id) y la cuenta propia en `POST /api/v1/admin/cuenta/contrasena`;
  - las reglas de REQ-F-007 sin cambios, desde `core/identity` y `db/user-repository`: D-7 (409
    `LAST_ADMIN`), D-8 (las sesiones de los dos admins caen en su siguiente petición porque sube
    `sessionVersion`; la API además libera las suyas) y la auditoría;
  - `meta.ownSessionClosed` cuando un administrador se cierra la sesión a sí mismo, y una sesión nueva
    al cambiar la propia contraseña;
  - en `contracts`: `ManagedUser`, las respuestas, `USER_LIMITS` (solo para los textos de ayuda; la
    regla sigue en `core`) y el cliente del admin;
  - tres mensajes pasan a `core/identity` para que los dos admins digan lo mismo.
- **PR 2, `inventory-manager` y `landing-pages`:**
  - pantallas "Usuarios" (solo administradores) y "Mi cuenta", sin JavaScript, con el sistema visual
    P-4 de REQ-F-039; `controllers/common.ts` reúne lo común de los controladores;
  - tras cambiar la propia contraseña, el admin reescribe su cookie con la sesión nueva;
  - con `ADMIN_NEW_URL`, usuarios y "Mi cuenta" del `/admin` actual quedan en solo lectura: la lista
    sin controles; el resto, GET o POST, con 410 y el enlace a la pantalla equivalente;
  - la prueba de extremo a extremo con los tres procesos y MySQL.
- La concurrencia de D-7 se probó con el proceso real de la API sobre MySQL (una sonda de QA, retirada
  en REQ-F-045) y en el repositorio. Hoy la cubren, sobre MySQL,
  `landing-pages/tests/integration/last-admin-concurrency-deactivation.test.ts` y
  `last-admin-concurrency-recovery.test.ts` (soporte común en `tests/support/last-admin-concurrency.ts`)
  y las dos degradaciones cruzadas del bloque D-7 de `user-repository.test.ts` (REQ-F-047).
- No añade contenedores: la medición de memoria de §10 no cambia.

### Paso 4, ticket 1 aplicado (REQ-F-039)

- **PR 1, `api` y paquetes:**
  - `packages/web` nuevo (decisión P-1: "Paquete packages/web (Recomendado)");
  - a `core` pasan el repositorio de productos (con `reload` e `init()` sin importar), las sesiones,
    el límite de intentos, `resolveSession`, los campos del formulario, el DTO, el comprobador de
    imágenes y las fechas;
  - contratos del admin en `contracts`;
  - `/api/v1/admin` (acceso y productos, con `Idempotency-Key` por negocio y cuerpo);
  - el aviso interno y su receptor en `landing-pages`, la recarga del bot cada 60 s y el modo de solo
    lectura con `ADMIN_NEW_URL`.
  - La imagen `api` lleva una copia de `landing-pages/public/img` para validar `image.src`, del mismo
    commit que la imagen de las landings.
- **PR 2, `inventory-manager`:**
  - pantallas de acceso y productos sin JavaScript, con el JS como mejora;
  - Tailwind con el sistema visual de las landings (P-4);
  - el cliente del admin y el formulario guiado por el descriptor en `contracts`;
  - la regla de lint de `inventory-manager`, también para `import()` dinámicos (CA-17).
- **PR 3, despliegue:**
  - imagen `inventory-manager` (`ghcr.io/orvigas/restaurante-inventory-manager`, `/app/inventory-manager`,
    puerto 3003, `HEALTHCHECK` contra `/salud`, solo las dependencias de su workspace y los iconos de
    las landings para el favicon);
  - servicio con router de Traefik en `admin.<dominio>`: HTTPS, HTTP a HTTPS, límite de 60 por minuto
    con ráfaga de 60;
  - red interna `admin` (api e inventory-manager);
  - `deploy.sh` con cuatro digests: `inventory-manager` va antes que la app, y el código 16 si no
    queda sano;
  - las variables del aviso, obligatorias en producción;
  - smoke, CI y la prueba de extremo a extremo de la frescura;
  - la revisión de memoria (§10).
- **El DNS de `admin.birriaelmuneco.com` lo crea el usuario** antes de desplegar la épica a `main`
  ([Despliegue](despliegue.md)). Hecho: desde el 2026-10-29 (#105) el subdominio responde con su
  certificado de Let's Encrypt.

### Paso 3 aplicado (REQ-F-038)

- **`api/`** (workspace nuevo, Koa): `GET|HEAD /api/v1/public/{molotes|birria}/productos` con
  `200 { data }` validado por `contracts`; 404, 405 (con `Allow`), 503 (`DATABASE_UNAVAILABLE`) y
  500 con el formato `{ error: { code, message } }`. Lee la base en cada petición
  (`createPrismaProductStore` y `toPublished`), sin caché propia. Al arrancar solo verifica la base
  (`verifyDatabase`): nunca migra, nunca importa semillas ni escribe (O-1 de REQ-F-037 cerrado: la
  importación sigue solo en `landing-pages`). Usa el usuario solo DML de la app.
- **`packages/contracts`:** `products.ts` (ids públicos de negocio, esquemas Zod de los productos
  publicados y de la respuesta, `publicProductsPath`, error común) y `public-client.ts`
  (`createPublicApiClient`: nunca lanza; límite de tiempo, sin redirecciones, cuerpo de 1 MiB como
  máximo y validación con el contrato). Zod 4.6.7, solo aquí.
- **`packages/core/catalog/published.ts`:** `PublishedProducts` y `toPublished`, movidos sin
  cambios desde `landing-pages` porque los usa la API. Una prueba de tipos de `api/` comprueba que
  el contrato y `PublishedProducts` son equivalentes. `parseDatabaseUrl` pasó a
  `packages/db/src/database-config.ts` (la usan las dos apps).
- **`landing-pages`:** `services/landing-products.ts` (caché de la API, ver §6),
  `API_INTERNAL_URL` obligatoria, y el repositorio de productos avisa de cada escritura
  confirmada (`onChange`), que `createApp` conecta con la invalidación.
- **Imágenes y despliegue:** etapa `api` en `landing-pages/Dockerfile`
  (`ghcr.io/orvigas/restaurante-api`, `/app/api`, puerto 3001, `HEALTHCHECK` contra su propio
  endpoint); `production` incluye ahora `packages/contracts` (O-3 de REQ-F-037 cerrado). En
  `deploy/compose.prod.yaml`, el servicio `api` solo en la red interna `db`, sin puertos ni labels;
  `deploy.sh` recibe tres digests y levanta la `api` antes de la app (código 15 si no queda sana).
  Los respaldos de `ops/` no cambian (decisión P-2): su runbook explica qué hacer con la `api` tras
  restaurar en un VPS nuevo.

### Paso 2 aplicado (REQ-F-037)

- **`packages/core`:**
  - `catalog/`: `product-schema`, `menu-schema`, `visible-menu`, `price`, `slug` y `menu-diff`, más
    `product-store.ts` (acciones del registro, contrato del store y errores de dominio, extraídos
    de `product-repository.ts`) y `memory-product-store.ts`.
  - `schedule/`: `business-schedule`.
  - `identity/`: `authorization`, `user-schema`, `admin-auth` y `user-repository.ts` (tipos,
    acciones de auditoría, errores y la interfaz, extraídos de la implementación Prisma).
  - `bot-control/`: la interfaz del store del control del bot y su versión en memoria.
  - `shared/`, las piezas que esos módulos necesitan: los ids de negocio (`BUSINESS`,
    `BUSINESS_IDS`, `isBusinessId`), `DatabaseUnavailableError` y su `DatabaseErrorDetails`, el
    logger (con `silentLogger`) y `errorProp`.
- **`packages/db`:** `prisma/` (schema y migraciones, idénticos), `prisma.config.ts`, el cliente
  generado (`src/generated/prisma`), `client.ts`, `errors.ts`, `verify.ts`, la implementación
  Prisma de usuarios, `prisma-product-store.ts` y `prisma-bot-control-store.ts`. También
  `database-config.ts` (el tipo `DatabaseConfig`, antes en `config/env.ts`) y `paths.ts` (la
  carpeta del paquete, de la que `verify.ts` toma las migraciones). Sus variables del CLI
  (`MIGRATION_DATABASE_URL`, `SHADOW_DATABASE_URL`) van en `packages/db/.env`.
- **`packages/contracts`:** esqueleto, sin exportaciones ni dependencias. Su regla de lint ya está
  activa.
- **Se queda en `landing-pages/`:**
  - el servicio de productos (`repositories/product-repository.ts`, que aplica las reglas sobre el
    store de `core/catalog`);
  - `menu-repository.ts`, `file-menu-repository.ts` y `memory-menu-repository.ts`
    (`menu-repository.ts` depende de `content/seeds.ts`);
  - `bot-control.ts`, `bot-usage.ts`, `session-store.ts`, `login-throttle.ts`, `admin-form.ts`,
    `product-form.ts`, `admin-bootstrap.ts` y `whatsapp.ts`;
  - `services/whatsapp-bot/`, `config/env.ts`, `config/business-paths.ts` (`BUSINESS_PATHS`, las
    rutas de las landings) y el resto de `utils/`;
  - las pruebas, que siguen en `landing-pages/tests` y solo cambiaron sus imports.
- **Imágenes:** `production` incluye `/app/packages/core` y, de `packages/db`, el código, el cliente
  generado y las migraciones. Los mismos nombre, directorio de trabajo, comando, usuario y
  `HEALTHCHECK`. `migrate` conserva la misma estructura: `prisma/` y `prisma.config.ts` en
  `/app/landing-pages`.

## 9. Decisiones

| | Decisión | Recomendación | Alternativa |
| --- | --- | --- | --- |
| **A** | **Despliegue** (**tomada**, ver abajo) | Tres contenedores (`api`, `landing-pages` e `inventory-manager`) detrás del Traefik del VPS: el dominio actual para las landings y un subdominio de administración, con la API en `admin.<dominio>/api`. El admin y la API comparten origen, así que la cookie funciona sin CORS | Un solo contenedor con las tres apps: menos memoria en el VPS, pero se despliegan juntas |
| **B** | **Tecnología del inventory manager** (**tomada**, ver abajo) | Vanilla JS con Web Components y Tailwind, respetando `.claude/CLAUDE.md` §2 | Cambiar la regla de §2 solo para el admin, para permitir un framework |
| **C** | **Validación de esquemas en `contracts`** (**tomada**, ver abajo) | Una librería de esquemas (por ejemplo Zod o Valibot) que da tipos y validación desde una sola definición, justificada según `.claude/rules/dependencias.md` | Seguir con validadores propios, como `product-schema.ts` hoy |

Cada decisión se toma antes del paso que la necesita (A en el paso 1, C en el paso 2 y B en el paso 4)
y se registra aquí, con la fecha y lo que respondió el usuario. Las tres están tomadas.

### Decisión A: tomada

- **Fecha:** 2026-10-24 (REQ-F-036).
- **Respuesta del usuario:** "tres contenedores".
- **Opción elegida:** la recomendación. Tres contenedores, `api`, `landing-pages` e
  `inventory-manager`, detrás del Traefik del VPS. El dominio actual queda para las landings y la
  API va en `admin.<dominio>/api`.
- **Qué aplica en cada paso:**

| Paso | Qué se hace |
| --- | --- |
| 1 (REQ-F-036; en producción desde el 2026-10-29, #105) | La imagen y el contenedor actuales salen del workspace `landing-pages/`, con los mismos nombres (`ghcr.io/orvigas/restaurante`, `restaurante-migrate`, servicio `app` y routers `restaurante*`), el mismo dominio y las mismas rutas. Se mide la memoria del VPS ([sección 10](#10-riesgos)) |
| 3 | Contenedor e imagen de `api` (**aplicado en REQ-F-038**; en producción desde el 2026-10-29, #105): solo en la red interna, sin router de Traefik (decisión "Solo red interna"); el subdominio `admin.<dominio>` queda para el paso 4. La revisión de memoria se basó en la estimación del 33,5 % ([sección 10](#10-riesgos)) |
| 4 | Contenedor `inventory-manager`, `admin.<dominio>`, DNS (a cargo del usuario) y certificado (**aplicado en REQ-F-039** para los productos y en producción desde el 2026-10-29, #105; desviación D-3: la API sigue sin publicarse). El `/admin` actual se retiró en el ticket 6 del paso 4 (REQ-F-045) |

### Decisión B: tomada

- **Fecha:** 2026-10-26 (REQ-F-039).
- **Respuestas del usuario:** "Quiero que la api use koa.js y todo lo que usan las landing Pagés
  para que podamos unificar todo en una sola API", "Va acusar koa.js y vainilla js" e
  "inventory-manager como las landings"; interfaz "SSR + Vanilla JS que mejora (Recomendado)".
- **Opción elegida:** **Vanilla JS + SSR con Koa (como las landings)**, sin cambiar
  `.claude/CLAUDE.md` §2.
  - `inventory-manager` es una app Koa propia, en su contenedor: plantillas, Tailwind y Vanilla JS
    que mejora la experiencia; los formularios funcionan sin JS.
  - Una sola API (`api`) sirve `/api/v1/public` y `/api/v1/admin`.
  - Sistema visual: el de las landings ("Sistema visual de las landings"; base de Birria El Muñeco y
    acento por negocio, validado en P-4).
- **Desviación D-3 de la decisión A** ("D-3: api sin publicar hasta el ticket 3"): la API **no** va
  en `admin.<dominio>/api`.
  - El navegador solo habla con `inventory-manager`, que reenvía la sesión a la API por la red
    interna `admin`; así la cookie sigue en el mismo origen sin CORS.
  - El ticket 3 (webhook del bot, REQ-F-042) publicó una sola entrada de `api`: la ruta exacta
    `/webhooks/whatsapp` en el dominio raíz, en un puerto propio (el 3004), con la misma URL que ya
    conocía Meta. El resto de `api` sigue sin publicarse.

### Decisión C: tomada

- **Fecha:** 2026-10-26 (REQ-F-037).
- **Respuesta del usuario:** "Zod (Recomendado)".
- **Opción elegida:** Zod, una librería de esquemas que da tipos y validación desde una sola
  definición. Se justificará según `.claude/rules/dependencias.md` en el ticket que la instale.
- **Cuándo se aplica:** desde el paso 3. En el paso 2 no se instala Zod ni se migra ningún
  validador: `packages/contracts` es un esqueleto vacío y los validadores propios (por ejemplo
  `product-schema.ts`) siguen como están.
- **Aplicada en el paso 3 (REQ-F-038):** Zod 4.6.7 (versión exacta), solo en
  `packages/contracts` y solo para los esquemas públicos nuevos (decisión "Zod solo en
  contracts"); ningún validador existente se migró. Justificación según
  `.claude/rules/dependencias.md`: Node no valida esquemas y los validadores propios no dan tipos
  desde una sola definición; Zod es MIT, sin dependencias en ejecución ni scripts de instalación
  (no cambia `allowScripts`) y queda cubierto por `audit:deps`. Se eligió la última versión con al
  menos dos semanas de antigüedad al instalarla (2026-10-26, 17:13 UTC). La 4.6.5 se descartó: tiene
  el aviso GHSA-mrhx-c7xc-m3w5 (high, corregido en 4.6.6) que detectó `audit:deps`.

## 10. Riesgos

- **El paso 1 toca el pipeline de producción.** Se valida con el CI completo (incluido el
  `smoke.sh`) en el PR hacia `epic/arquitectura`; el despliegue real llegó con el merge de la
  épica a `main` (#105, desplegado el 2026-10-29).
- **Las landings pasan a depender de la API** (paso 3, aplicado en REQ-F-038). Se mitiga con la
  caché, la última copia buena y la semilla de la [sección 6](#6-cómo-se-consume-la-api). Riesgo
  aceptado: si `landing-pages` se reinicia con la API caída, muestra la semilla (que puede estar
  desfasada respecto de la base) hasta que la API vuelva. Las cachés del bot (de la base) y de las
  landings (de la API) pueden divergir un momento si falla un refresco; las dos se actualizan con
  cada escritura.
- **Memoria del VPS** con más contenedores (decisión A): medida en el paso 1 (REQ-F-036, CA-13
  cumplido el 2026-10-26 con la toma de tráfico simulado: 33,5 %). Umbral: si la estimación con
  tres contenedores supera el 80 % de la RAM total, la decisión A se revisa con el usuario. La
  revisión previa al paso 3 parte de esta medición y el paso 3 vuelve a comprobar el umbral del
  80 % ([sección 9](#9-decisiones)). Ver [Medición de memoria](#medición-de-memoria-del-vps).
- **Revisión de memoria del paso 3** (REQ-F-038): por decisión del usuario ("Memoria: basta el
  33,5 %"), se basa en la estimación del paso 1 **sin una medición nueva**. El contenedor `api` es
  uno de los dos contenedores Node de esa estimación (1310,2 MiB, el 33,5 % de la RAM total, muy
  por debajo del umbral del 80 %): **la decisión A se mantiene**. La medición real con `api` en
  marcha se hizo tras el despliegue de la épica (ver la revisión del paso 4, ticket 1).
- **Revisión de memoria del paso 4, ticket 1** (REQ-F-039, RF-19): con la misma medición del paso 1
  (pico de 1142 MiB usados en el host y 84,1 MiB del contenedor Node), la estimación con tres
  contenedores Node (`api`, `inventory-manager` y la app medida) es
  1142 + 3 × 84,1 = **1394,3 MiB, el 35,6 %** de 3915 MiB, muy por debajo del umbral del 80 %
  (3132 MiB): **la decisión A se mantiene** sin volver al usuario.
  - La imagen de `inventory-manager` solo instala las dependencias de su workspace (unos 17 MiB de
    `node_modules`, sin Prisma). Medida local (Docker Desktop, `docker stats`, tras arrancar y servir
    unas peticiones): **45,5 MiB**, por debajo de la cota de 84,1 MiB usada en la estimación.
  - **Medición real en producción** (2026-10-29, tras el despliegue del #105; `free -m` y
    `docker stats --no-stream` en el VPS, sin carga simulada): **1232 MiB usados en el host, el
    31,5 %** de 3915 MiB (disponible: 2682 MiB; swap sin usar), por debajo de la estimación del
    35,6 % y del umbral del 80 %. Por contenedor: `app` 76,9 MiB, `api` 72,6 MiB,
    `inventory-manager` 43,2 MiB, MySQL 527,3 MiB y Traefik 120,3 MiB (los tres Node suman
    192,7 MiB frente a los 252,3 MiB de la estimación). **La decisión A se mantiene.**
- **Revisión de memoria del paso 4, ticket 3** (REQ-F-042): no hay contenedores nuevos; el bot sale
  de `app` y entra en `api`, y el balance es casi neutro.
  Medida local (Docker Desktop, `docker stats`, 2026-11-04, con el bot configurado en `api`, unos 20 s
  después del arranque y sin conversaciones): **`api` 100,0 MiB**, `app` 98,0 MiB,
  `inventory-manager` 47,3 MiB. Cota con la medición real del VPS: 1232 + (100,0 − 72,6) =
  **1259,4 MiB, el 32,2 %** de 3915 MiB, muy por debajo del umbral del 80 %, sin contar lo que libera
  `app`: **la decisión A se mantiene**.
  - **Pendiente:** la medición real en el VPS tras desplegar la épica (`free -m` y
    `docker stats --no-stream`, solo lectura), para compararla con el 31,5 % y el umbral del 80 %.
- **Dos administraciones a la vez** durante el paso 4 (cerrado en REQ-F-045): el `/admin` de las
  landings quedó en solo lectura ticket a ticket y se retiró en el ticket 6; hoy solo redirige al
  admin nuevo. Mientras el compose del PR 2 siga vigente, una vuelta atrás automática devuelve la app
  anterior con su `/admin` en solo lectura, que encuentra las marcas de importación y no reimporta.
- **Restaurar un respaldo anterior al 2026-11-16** (REQ-F-045, RN-4, riesgo aceptado): la base queda
  sin filas de página y ya no hay importación desde los JSON. La pantalla «Página» del admin nuevo
  queda "no disponible" y las landings muestran la semilla hasta que se corrija a mano.
- **La página tras el corte** (REQ-F-044): con la API caída, un reinicio de `landing-pages` muestra
  la semilla (precio del hero de $195 en Birria y $145 en Molotes, quizá desactualizados) hasta que
  la API vuelva (aceptado, D-4). Una vuelta atrás tras el corte deja las ediciones de MySQL sin
  mostrar y las del JSON sin volver a MySQL (aceptado, D-3); el procedimiento está en
  [despliegue.md §6](despliegue.md#6-volver-a-una-versión-anterior-a-mano).
- **Sin pausa web si cae `inventory-manager`** (REQ-F-043, D-2, riesgo aceptado): la pausa y los
  bloqueos dependen de `inventory-manager` y de `api` (desde REQ-F-045 no hay `/admin/bot` ni para
  consultar). Si solo falla `inventory-manager`, el bot sigue
  atendiendo; pausarlo exige recuperar ese contenedor o volver la app
  ([vuelta atrás a mano](despliegue.md#6-volver-a-una-versión-anterior-a-mano)).
- **Estado en memoria de la `api`** (REQ-F-039): viven en el proceso las sesiones del admin nuevo,
  el límite de intentos de acceso y las claves de idempotencia (creadas en `api/src/admin/index.ts`),
  la caché y el mutex del repositorio de productos de `core/catalog` (compuesto en
  `api/src/server.ts`) y, desde REQ-F-042, las conversaciones del bot, su deduplicación y la copia del
  control. Un reinicio o un despliegue de `api` cierra todas las sesiones (hay que volver a entrar) y
  corta las conversaciones a medias, y la `api` no puede tener más de una réplica mientras ese estado
  no pase a MySQL.

### Medición de memoria del VPS

Medida en el paso 1 (REQ-F-036) por SSH, solo con comandos de lectura (`free -m`, `nproc` y
`docker stats --no-stream`). En MiB.

| Toma | Fecha y hora (America/Mexico_City) | RAM total | Usada en el host | `app` | MySQL | Traefik |
| --- | --- | --- | --- | --- | --- | --- |
| En reposo | 2026-10-24 19:57 (sábado, fuera del horario de servicio) | 3915 (1 vCPU, swap de 2047 sin usar) | 1066 (27,2 %) | 67,2 | 509,9 | 118,4 |
| Con tráfico simulado | 2026-10-25 20:32 a 20:59 (domingo, fuera del horario de servicio; carga generada). Media / pico | 3915 | 1106,9 / 1142 (29,2 % en el pico) | 80,1 / 84,1 | 515,3 / 515,3 | 124,5 / 127,1 |

- **Perfil de la carga simulada** (2026-10-25, de 20:27 a 21:04, contra `https://birriaelmuneco.com`,
  aprobada por el usuario): reposo de 5 min, rampa de 2 min, 15 min de promedio con 2 visitas por
  minuto, 10 min de pico con 10 visitas por minuto (× 5) y 5 min de enfriamiento. Cada visita es un
  navegador nuevo (HTML de la landing y sus CSS, JS e imágenes). A la vez, 10 sesiones de
  `/admin` de solo lectura (una cuenta de editor temporal) a 8 peticiones por minuto en total. En
  total: 148 visitas, 2315 peticiones de landing y 217 lecturas de `/admin`, todas con 200; los 10
  accesos y los 10 cierres de sesión, con 303. Sin 5xx, sin 429 y sin errores de red; p95 máximo
  de 709 ms en las landings y de 770 ms en `/admin`. La tabla resume las 95 muestras (cada 15 s)
  de la rampa, el promedio y el pico. Por fase (media / pico de la memoria usada en el host y de
  `app`): reposo 1101,2 / 1123 y 79,0 / 79,0; promedio 1106,3 / 1128 y 79,0 / 80,8; pico
  1102,9 / 1113 y 82,1 / 84,1; enfriamiento 1107,9 / 1117 y 81,3 / 81,3. MySQL se mantuvo en
  515,3 todo el tiempo. Memoria disponible mínima en el host: 2772 MiB.
- **Estimación con tres contenedores:** con el pico de la carga simulada, el uso del host más dos
  contenedores Node con el pico de `app` (cota de `api` e `inventory-manager`): 1142 + 2 × 84,1 =
  **1310,2 MiB, el 33,5 %** de la RAM total. Con la toma en reposo del 2026-10-24 daba
  1066 + 2 × 67,2 = 1200 MiB (30,7 %). Las dos están muy por debajo del umbral del 80 %
  (3132 MiB): **la decisión A se mantiene**.
- **Margen:** aun si cada contenedor Node usara cinco veces lo medido en el pico (unos 420 MiB),
  la estimación sería de unos 1980 MiB (51 %).
- **Por qué es simulada:** el tráfico real del domingo 2026-10-25 entre 08:00 y 15:00 fue casi nulo
  (2 visitas a las landings; el resto, el healthcheck), y el log del sábado 2026-10-24 se perdió
  porque el contenedor se reinició ese día a las 22:25. El perfil simulado supera con creces ese
  tráfico real (148 visitas en 27 minutos frente a 2 en 7 horas). El VPS ejecuta todavía la imagen
  de `main`, anterior al monorepo, con código equivalente. Dos intentos previos esa misma noche se
  cortaron sin generar carga porque el primer acceso a `/admin` respondió 401 (credenciales de la
  cuenta temporal); el tercero se completó sin cortes.
- **Cierre (2026-10-26):** la medición queda cerrada con la toma de tráfico simulado. Por decisión
  del usuario ("Cierra CA-13 y continua no puedo esperar hasta el sábado") se renunció a la toma
  pasiva con tráfico real prevista para el sábado 2026-10-31 de 08:00 a 15:00. Es la base de la
  revisión de memoria previa al paso 3, que vuelve a aplicar el umbral del 80 %: si la estimación lo
  supera entonces, la decisión A se revisa con el usuario antes de seguir.
- El Traefik es el del VPS y también sirve otros sitios: su uso no depende de este proyecto.
