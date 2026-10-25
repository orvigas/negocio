# Arquitectura: API, landing pages e inventory manager

Estrategia para convertir `restaurante/` en una **API Koa** que alimenta a **dos frontends**: las
landing pages de Molotes y Birria El Muñeco (como hoy) y un **inventory manager** (inventario,
ventas, CRM y la administración que hoy vive en `/admin`). Es la referencia de los tickets de la
épica de migración: cada ticket implementa un paso de la [sección 8](#8-plan-de-migración) y, si
necesita desviarse de este documento, lo actualiza en el mismo PR.

| | |
| --- | --- |
| Estado | **Aceptada** (estrategia general). Quedan abiertas las decisiones de la [sección 9](#9-decisiones-pendientes) |
| Fecha | 2026-10-24 |
| Alcance | Estructura del código, regla de dependencias, contratos, consumo de la API y orden de la migración. No cambia el stack de `.claude/CLAUDE.md` §2 |

## 1. Contexto

Hoy `restaurante/` es **una sola app Koa** que hace todo:

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
├── tsconfig.base.json       ← opciones estrictas compartidas
├── packages/
│   ├── core/                ← dominio y casos de uso. TS puro: sin Koa, sin Prisma, sin HTML
│   │   ├── catalog/         (productos y menú visible)
│   │   ├── schedule/        (horarios y aviso del día)
│   │   ├── inventory/       (existencias, movimientos y mermas)   ← nuevo
│   │   ├── sales/           (pedidos, ventas y cobros)            ← nuevo
│   │   ├── customers/       (CRM: clientes e historial)           ← nuevo
│   │   └── identity/        (usuarios, roles y permisos por negocio)
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
- **La regla la aplica el lint**, no la memoria: `npm run lint` rechaza un import que la rompa
  (con `no-restricted-imports` o una regla de rutas en `eslint.config.ts`), igual que hoy rechaza los
  imports `./x.js` fuera de `public/js`.

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
| Renderizado | **Sigue en SSR** con Koa: el SEO y la regla de que el servidor decide el aviso no cambian | Ver la [decisión B](#9-decisiones-pendientes) |
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

| Paso | Qué hace | Cambia el comportamiento |
| --- | --- | --- |
| 1 | **Monorepo sin cambios funcionales.** Workspaces en `restaurante/` y la app actual pasa tal cual a `landing-pages/`. Se ajustan el CI (`.github/workflows/ci.yml`, Dependabot), el `Dockerfile`, `compose.yaml`, `deploy/` y la documentación | No |
| 2 | **Extraer `core`, `contracts` y `db`** del `src/` actual. Se mueven los archivos y se ajustan los imports, sin reescribir la lógica | No |
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

## 9. Decisiones pendientes

| | Decisión | Recomendación | Alternativa |
| --- | --- | --- | --- |
| **A** | **Despliegue** | Tres contenedores (`api`, `landing-pages` e `inventory-manager`) detrás del Traefik del VPS: el dominio actual para las landings y un subdominio de administración, con la API en `admin.<dominio>/api`. El admin y la API comparten origen, así que la cookie funciona sin CORS | Un solo contenedor con las tres apps: menos memoria en el VPS, pero se despliegan juntas |
| **B** | **Tecnología del inventory manager** | Vanilla JS con Web Components y Tailwind, respetando `.claude/CLAUDE.md` §2 | Cambiar la regla de §2 solo para el admin, para permitir un framework |
| **C** | **Validación de esquemas en `contracts`** | Una librería de esquemas (por ejemplo Zod o Valibot) que da tipos y validación desde una sola definición, justificada según `.claude/rules/dependencias.md` | Seguir con validadores propios, como `product-schema.ts` hoy |

Cada decisión se toma antes del paso que la necesita (A en el paso 1, C en el paso 2 y B en el paso 4)
y se registra aquí, con la fecha y lo que respondió el usuario.

## 10. Riesgos

- **El paso 1 toca el pipeline de producción.** Se valida con el despliegue de `main` y el
  `smoke.sh` del CI antes de seguir.
- **Las landings pasan a depender de la API** (paso 3). Se mitiga con la caché y la última copia
  buena de la [sección 6](#6-cómo-se-consume-la-api).
- **Memoria del VPS** con más contenedores (decisión A): se mide en el paso 1.
- **Dos administraciones a la vez** durante el paso 4: el `/admin` actual se mantiene hasta que el
  nuevo tenga lo mismo, y se retira en un ticket propio.
