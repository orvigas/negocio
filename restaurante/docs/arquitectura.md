# Arquitectura: API, landing pages e inventory manager

Estrategia para convertir `restaurante/` en una **API Koa** que alimenta a **dos frontends**: las
landing pages de Molotes y Birria El Muñeco (como hoy) y un **inventory manager** (inventario,
ventas, CRM y la administración que hoy vive en `/admin`). Es la referencia de los tickets de la
épica de migración: cada ticket implementa un paso de la [sección 8](#8-plan-de-migración) y, si
necesita desviarse de este documento, lo actualiza en el mismo PR.

| | |
| --- | --- |
| Estado | **Aceptada** (estrategia general). Decisiones A (2026-10-24) y C (2026-10-26) tomadas; queda abierta B ([sección 9](#9-decisiones)). Paso 1 aplicado en REQ-F-036 y paso 2 en REQ-F-037 |
| Fecha | 2026-10-24 |
| Alcance | Estructura del código, regla de dependencias, contratos, consumo de la API y orden de la migración. No cambia el stack de `.claude/CLAUDE.md` §2 |

## 1. Contexto

Hoy `restaurante/` es **una sola app Koa** que hace todo (desde el paso 1, en el workspace
`restaurante/landing-pages/`; las rutas `src/...` de este documento son relativas a él):

- **Landings** por SSR (`src/views/`, `src/content/`, `public/`), con el aviso del día decidido en
  el servidor (REQ-F-028 y REQ-F-034).
- **Administración** en `/admin` por SSR, con sesión y CSRF (usuarios, productos y control del bot),
  más una **API JSON de productos** en `/admin/api` (REQ-F-008).
- **Bot de WhatsApp** (`src/services/whatsapp-bot/`), que arma el pedido y **avisa al personal**:
  los pedidos **no se guardan**.
- **MySQL 8.4 con Prisma** (`prisma/`, `src/repositories/`).

El código ya tiene la base de lo que se propone aquí:

- **Repositorios con interfaz** y varias implementaciones: `ProductRepository` (Prisma y memoria),
  el repositorio de menús (archivo y memoria) y `BotControlStore` (Prisma y memoria). Gracias a eso
  el bot y buena parte de la lógica se prueban sin MySQL.
- **Reglas de negocio sin Koa** en `src/services/` (`product-schema.ts`, `visible-menu.ts`,
  `business-schedule.ts`, `price.ts`).
- **Inyección por fábricas** (`createX({ deps })`) armada en `src/server.ts` y `src/app.ts`.

Lo que falta es **separar físicamente** esas piezas para que dos frontends y nuevos dominios
(inventario, ventas, CRM) las compartan sin duplicarlas.

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
│   │   └── bot-control/     (bloqueos, pausa y uso del bot de WhatsApp; desde el paso 2)
│   ├── contracts/           ← esquemas y DTO de la API + cliente HTTP tipado
│   └── db/                  ← implementaciones Prisma de los repositorios, schema y migraciones
├── api/                     ← Koa: la única app que habla con MySQL
├── landing-pages/           ← Koa SSR de las landings: HTML, SEO, Tailwind y Vanilla JS
└── inventory-manager/       ← frontend del administrador
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
| `packages/db` | `core` (para implementar sus interfaces) | Koa, `contracts` |
| `api` | `core`, `db`, `contracts` | Código de los frontends |
| `landing-pages` | `contracts` | `core`, `db`, Prisma |
| `inventory-manager` | `contracts` | `core`, `db`, Prisma |

- **Las flechas apuntan hacia `core`.** Entre módulos de `core`, solo a través de su `index.ts`.
- **Lo compartido queda en la raíz** (desviación registrada en el paso 1, REQ-F-036): `deploy/`,
  `ops/`, `security/`, `docs/`, `compose.yaml` y `docker/` no pertenecen a ninguna app. `deploy/`
  conserva su ubicación porque la suma de `compose.prod.yaml`, `deploy.sh` y
  `mysql/initdb/01-usuarios.sh` debe coincidir con la instalada en el VPS.
- **La regla la aplica el lint**, no la memoria: `npm run lint` rechaza un import que la rompa,
  igual que rechaza los imports `./x.js` fuera de `public/js`. Desde el paso 2 (REQ-F-037) hay un
  único `eslint.config.ts` en la raíz, con un bloque de `no-restricted-imports` por paquete (sin
  plugins adicionales), y la prueba `landing-pages/tests/unit/dependency-rule.test.ts` comprueba
  cada caso. Además, el `exports` del `package.json` de cada paquete solo publica los `index.ts`
  de los módulos de `core` (y los archivos de `db`), así que `tsc` y Node rechazan también un
  import a un archivo interno. Los módulos de `core` y `packages/db/src` son planos (sin
  subcarpetas): los patrones de "sale del paquete" cuentan con ello.
- **Paquetes:** `@restaurante/core` (sin dependencias), `@restaurante/db` (Prisma, `mariadb` y
  `core`) y `@restaurante/contracts` (esqueleto sin dependencias hasta el paso 3). Todos los
  `tsconfig.json` extienden `tsconfig.base.json`, en la raíz.
- **Regla de transición** (desviación registrada en el paso 2, REQ-F-037): mientras `landing-pages`
  siga conteniendo `/admin` y el bot, **puede importar `core`, `db` y `contracts`**. El lint lo
  permite con un comentario que lo marca como temporal. La restricción de la tabla
  (`landing-pages` solo importa `contracts`) se activa en el paso 3 para las landings, cuando
  consuman la API, y en el paso 4 para `/admin`, cuando pase a `inventory-manager`.

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
| Endpoints | `GET /api/v1/public/...`: menú visible, horarios y aviso del día. Públicos y de solo lectura | `/api/v1/admin/...`: lectura y escritura, con autenticación y permisos por negocio |
| Renderizado | **Sigue en SSR** con Koa: el SEO y la regla de que el servidor decide el aviso no cambian | Ver la [decisión B](#9-decisiones) |
| Resiliencia | Caché corta con `stale-while-revalidate` y la última copia buena como respaldo: una caída de la API no tira las landings | Muestra el error de la API (503 o 409) y no pierde lo que se estaba editando |
| Seguridad | **Sin credenciales de la base** (mínimo privilegio) | Sesión con cookie `SameSite=Strict` y token CSRF, como hoy en `/admin` |

**El bot de WhatsApp es un cliente más de `core`.** Vive dentro de `api` (su webhook es otra entrada
HTTP) y, cuando exista `sales`, sus pedidos confirmados se guardan como ventas en lugar de solo
avisar al personal.

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
  compartida que corre contra la implementación en memoria y contra la de Prisma, como hoy
  `product-repository-contract.test.ts`.

## 8. Plan de migración

Se sigue el patrón *strangler fig*: lo nuevo crece alrededor de lo actual y lo reemplaza por partes.
**Cada paso es un ticket y un PR desplegable**; las pruebas actuales son la red de seguridad.
Los PR de los pasos van a la rama intermedia `epic/arquitectura`, que valida sin desplegar, y la
épica llega a `main` con un solo PR cuando está madura (`.claude/rules/git.md` y la sección "Rama
intermedia" del CI en `restaurante/README.md`).

| Paso | Qué hace | Cambia el comportamiento |
| --- | --- | --- |
| 1 | **Monorepo sin cambios funcionales** (REQ-F-036). Workspaces en `restaurante/` y la app actual pasa tal cual a `landing-pages/`. Se ajustan el CI (`.github/workflows/ci.yml`, Dependabot), el `Dockerfile`, `compose.yaml` y la documentación. De `deploy/` no se toca ningún archivo de la suma (`compose.prod.yaml`, `deploy.sh`, `mysql/initdb/01-usuarios.sh`): las imágenes y sus nombres no cambian | No |
| 2 | **Extraer `core`, `contracts` y `db`** del `src/` actual (REQ-F-037). Se mueven los archivos y se ajustan los imports, sin reescribir la lógica (detalle abajo) | No |
| 3 | **Crear `api/`** con los endpoints públicos. Las landings pasan a consumirlos y dejan de acceder a la base | No (mismo HTML) |
| 4 | **Llevar `/admin`** (productos, usuarios y control del bot) a `/api/v1/admin` y al nuevo `inventory-manager`. El `/admin` actual se retira cuando el nuevo tenga lo mismo | Sí: nueva interfaz de administración |
| 5 | **Dominios nuevos, un ticket por módulo:** inventario → ventas (incluidos los pedidos del bot) → CRM | Sí |

### Dónde queda el código actual

| Hoy | Destino |
| --- | --- |
| `src/services/product-schema.ts`, `visible-menu.ts`, `menu-schema.ts`, `price.ts`, `slug.ts` | `packages/core/catalog/` |
| `src/services/business-schedule.ts` | `packages/core/schedule/` |
| `src/services/authorization.ts`, `user-schema.ts`, `admin-auth.ts` | `packages/core/identity/` |
| Interfaces de `src/repositories/*` | El módulo de `core` correspondiente |
| `src/repositories/prisma-*.ts`, `prisma/` | `packages/db/` |
| `src/repositories/memory-*.ts` | Junto a su interfaz en `core` (son las implementaciones de prueba) |
| `src/controllers/admin-products-api.ts` y `routes/admin-api.ts` | `api/` (`/api/v1/admin/products`) |
| `src/services/whatsapp-bot/`, `controllers/whatsapp-webhook.ts` | `api/` (el bot), usando `core` |
| `src/views/`, `src/content/`, `src/styles/`, `public/` | `landing-pages/` |
| `src/views/admin/`, `controllers/admin*.ts` | Se sustituyen por `inventory-manager/` en el paso 4 |
| `src/config/env.ts` | Cada app valida solo sus variables; lo común va en un módulo compartido |

Los nombres exactos de archivos y endpoints los fija el plan técnico de cada ticket.

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
| **B** | **Tecnología del inventory manager** | Vanilla JS con Web Components y Tailwind, respetando `.claude/CLAUDE.md` §2 | Cambiar la regla de §2 solo para el admin, para permitir un framework |
| **C** | **Validación de esquemas en `contracts`** (**tomada**, ver abajo) | Una librería de esquemas (por ejemplo Zod o Valibot) que da tipos y validación desde una sola definición, justificada según `.claude/rules/dependencias.md` | Seguir con validadores propios, como `product-schema.ts` hoy |

Cada decisión se toma antes del paso que la necesita (A en el paso 1, C en el paso 2 y B en el paso 4)
y se registra aquí, con la fecha y lo que respondió el usuario. B sigue pendiente.

### Decisión A: tomada

- **Fecha:** 2026-10-24 (REQ-F-036).
- **Respuesta del usuario:** "tres contenedores".
- **Opción elegida:** la recomendación. Tres contenedores, `api`, `landing-pages` e
  `inventory-manager`, detrás del Traefik del VPS. El dominio actual queda para las landings y la
  API va en `admin.<dominio>/api`.
- **Qué aplica en cada paso:**

| Paso | Qué se hace |
| --- | --- |
| 1 (REQ-F-036) | La imagen y el contenedor actuales salen del workspace `landing-pages/`, con los mismos nombres (`ghcr.io/orvigas/restaurante`, `restaurante-migrate`, servicio `app` y routers `restaurante*`), el mismo dominio y las mismas rutas. Se mide la memoria del VPS ([sección 10](#10-riesgos)) |
| 3 | Contenedor e imagen de `api`. Antes se revisa la memoria con el umbral del 80 % |
| 4 | Contenedor `inventory-manager`, `admin.<dominio>`, DNS y certificado. `/admin` pasa al subdominio y el `/admin` actual se retira en un ticket propio |

### Decisión C: tomada

- **Fecha:** 2026-10-26 (REQ-F-037).
- **Respuesta del usuario:** "Zod (Recomendado)".
- **Opción elegida:** Zod, una librería de esquemas que da tipos y validación desde una sola
  definición. Se justificará según `.claude/rules/dependencias.md` en el ticket que la instale.
- **Cuándo se aplica:** desde el paso 3. En el paso 2 no se instala Zod ni se migra ningún
  validador: `packages/contracts` es un esqueleto vacío y los validadores propios (por ejemplo
  `product-schema.ts`) siguen como están.

## 10. Riesgos

- **El paso 1 toca el pipeline de producción.** Se valida con el CI completo (incluido el
  `smoke.sh`) en el PR hacia `epic/arquitectura`; el despliegue real llega cuando la épica se
  mergea a `main`.
- **Las landings pasan a depender de la API** (paso 3). Se mitiga con la caché y la última copia
  buena de la [sección 6](#6-cómo-se-consume-la-api).
- **Memoria del VPS** con más contenedores (decisión A): medida en el paso 1 (REQ-F-036, CA-13
  cumplido el 2026-10-26 con la toma de tráfico simulado: 33,5 %). Umbral: si la estimación con
  tres contenedores supera el 80 % de la RAM total, la decisión A se revisa con el usuario. La
  revisión previa al paso 3 parte de esta medición y el paso 3 vuelve a comprobar el umbral del
  80 % ([sección 9](#9-decisiones)). Ver [Medición de memoria](#medición-de-memoria-del-vps).
- **Dos administraciones a la vez** durante el paso 4: el `/admin` actual se mantiene hasta que el
  nuevo tenga lo mismo, y se retira en un ticket propio.

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
