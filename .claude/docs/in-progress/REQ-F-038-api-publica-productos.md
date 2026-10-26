# REQ-F-038 — Crear `api/` con el endpoint público de productos y que las landings lo consuman

## Estado

QA_APPROVED

## Aprobación

Aprobado por el usuario (versión 1, fecha 2026-10-26). Respuesta textual: "Sí, lo apruebo".

Decisiones del usuario incorporadas (2026-10-26, citas textuales):

- Endpoints públicos del paso 3: "Solo productos (Recomendado)". Solo `GET /api/v1/public/<negocio>/productos` o equivalente.
- Despliegue: "Solo red interna (Recomendado)". Contenedor e imagen `api` solo en la red interna de Docker, sin router de Traefik; el subdominio `admin.<dominio>` queda para el paso 4. Confirmado que cambian `compose.prod.yaml`, `deploy.sh` (tercer digest) y el workflow, y que habrá que reinstalar `deploy/` en el VPS cuando la épica llegue a `main`.
- Frescura tras editar en `/admin`: "Seguir al instante (Recomendado)". Cada escritura de `/admin` en `landing-pages` invalida su caché de la API.
- API no disponible: en funcionamiento, se sirve la última copia buena sin límite de tiempo y se registra en el log. Al arrancar sin ninguna copia: "Menú de la semilla (Recomendado)". Persistencia de la copia: "Basta en memoria (Recomendado)".
- Importación de semillas: "landing-pages (Recomendado)". La importación se queda en `landing-pages`, la `api` solo lee y nunca la hacen dos contenedores.
- Convivencia: "Bot y /admin hasta el paso 4". `landing-pages` conserva las credenciales de la base hasta el paso 4.
- Regla de dependencias: "Lint solo en las landings". Se prohíben `core` y `db` en el código de las landings y se cierran los imports relativos internos (O-2 de REQ-F-037).
- Memoria: "Memoria: basta el 33,5 %". Se registra en §10 de `restaurante/docs/arquitectura.md`.
- Zod: "Zod solo en contracts". Solo para los esquemas públicos nuevos; no se migra ningún validador existente.
- Supuestos confirmados: "Semilla = content/seeds.ts", "api usa el usuario DML actual" y "CA-1 byte a byte".

Decisiones técnicas y aprobación del Technical Action Plan (2026-10-26, citas textuales):

- P-1: "Prohibir lo que lee datos (Recomendado)" (opción A). El código de las landings no puede importar `db`, Prisma, `mariadb`, `core/identity`, `core/bot-control`, las piezas de persistencia de `core/catalog` ni el repositorio de productos; puede importar `contracts`, `core/shared`, `core/schedule` y las funciones puras de `core/catalog`. Desviación registrada en §4 de `arquitectura.md`.
- P-2: "Valor por defecto para api (Recomendado)" (opción A). `ops/` no cambia; la restauración en un VPS nuevo queda en el runbook.
- P-3: "Solo servicios en ejecución (Recomendado)" (opción A). CA-8 se refiere a los servicios en ejecución (`migrate` es puntual).
- Plan: "Sí, aprobar e implementar". Technical Action Plan aprobado con estas respuestas.

## Objetivo

Paso 3 del plan de migración (`restaurante/docs/arquitectura.md` §8): que el código de las landings deje de leer la base y obtenga los productos publicados de una API propia (`restaurante/api/`), sin ningún cambio observable para los clientes (mismo HTML). Así la épica queda preparada para el paso 4. El PR va a `epic/arquitectura` (`.claude/rules/git.md`).

## Alcance

- Nuevo workspace `restaurante/api/` (Koa), que usa `core`, `db` y `contracts` y sirve solo el endpoint público de productos.
- `packages/contracts`: el esquema y el cliente HTTP del endpoint, con Zod instalado y justificado según `.claude/rules/dependencias.md`.
- Las landings (`/`, `/molotes`, `/birria`) consumen la API mediante el cliente de `contracts`, con su propia caché en memoria, que se invalida con cada escritura de productos en `/admin`.
- Imagen y contenedor `api` en producción, solo en la red interna: `compose.prod.yaml`, `deploy.sh`, el workflow del CI (construcción, publicación y smoke) y el `Dockerfile`.
- Desarrollo local con `api` y `landing-pages` juntas.
- Regla de dependencias activa para el código de las landings y cierre de los imports relativos internos (O-2).
- Cierre de O-1 y O-3 de REQ-F-037.
- Documentación: `arquitectura.md` §4, §6, §8, §9 y §10, el `README.md` de `restaurante/`, `docs/` y `.env.example`.

## Fuera de alcance

- El aviso del día, los horarios y los datos de página (hero, destacado y promociones) como endpoints: siguen en `landing-pages` como hoy.
- Exponer la API en Traefik, el subdominio `admin.<dominio>`, DNS y certificados (paso 4).
- Mover el bot, `/admin` o `/admin/api` a `api` (paso 4).
- Retirar las credenciales de la base del contenedor `landing-pages` (paso 4).
- Migrar validadores existentes a Zod (por ejemplo `product-schema.ts`).
- Persistir en disco la última copia buena.
- Un usuario de base de solo lectura para `api`: usa el usuario DML actual de la app.
- Una medición nueva de memoria.
- Cualquier cambio visual, de contenido o de SEO.

## Requisitos

- **RF-1. Endpoint público.** `api` responde `GET /api/v1/public/<negocio>/productos` (el nombre exacto lo fija el plan técnico) para `molotes` y `birria`.
  - Devuelve los productos publicados del negocio, con el contenido y el orden que hoy usan las landings (`PublishedProducts`).
  - Refleja el estado confirmado en la base en el momento de la petición: la API no guarda caché propia que impida el "al instante".
  - Un negocio desconocido responde 404 y un método distinto de GET (o HEAD) responde 405.
  - Los errores usan `{ "error": { "code", "message" } }`. Con la base no disponible responde 503, sin detalles internos (`.claude/rules/manejo-de-errores.md`).
- **RF-2. Contrato compartido.** El esquema de la respuesta se define una sola vez, con Zod, en `packages/contracts`. La API serializa con él y las landings validan con él lo que reciben. Una respuesta que no cumple el esquema se trata como API no disponible (RF-5).
- **RF-3. Solo red interna.**
  - El contenedor `api` no tiene router de Traefik ni puertos publicados en el host.
  - Solo `landing-pages` lo alcanza, por la red de Docker.
  - La URL base de la API para `landing-pages` es configurable y se valida al arrancar.
- **RF-4. Las landings no leen la base.** El controlador y las vistas de las landings obtienen los productos solo del cliente de la API, nunca de `core` ni de `db`. El aviso del día sigue decidiéndose en el servidor de las landings con `BUSINESS_TIMEZONE`, y `?dia=` sigue funcionando en desarrollo.
- **RF-5. Resiliencia.**
  - Las landings sirven los productos desde su caché en memoria.
  - Si la API no responde, tarda más del límite (lo fija el plan técnico) o devuelve datos inválidos, se sirve la última copia buena sin límite de tiempo y se registra un evento estructurado, sin datos sensibles.
  - Si nunca hubo una copia buena, se sirven los productos de la semilla del contenido del negocio (`content/seeds.ts`) y se registra el evento.
  - En cuanto la API vuelve a responder bien, las landings usan sus datos sin reiniciar.
  - Ninguna petición a una landing responde 5xx por un fallo de la API.
- **RF-6. Frescura "al instante".** Cada escritura de productos confirmada desde `/admin` (HTML o `/admin/api`) en `landing-pages` invalida la caché de la API de ese negocio, y la siguiente visita a la landing muestra el cambio.
- **RF-7. Convivencia hasta el paso 4.**
  - El bot, `/admin`, `/admin/api` y la importación de semillas siguen en `landing-pages`, con acceso a la base y sin cambios de comportamiento.
  - `api` solo lee: no importa semillas, no migra y no escribe en la base.
- **RF-8. Regla de dependencias.**
  - El lint rechaza que el código de las landings (`controllers/landing.ts`, `views/landings/**` y `services/landing-products.ts`) importe `db`, Prisma, `mariadb`, `core/identity`, `core/bot-control`, las piezas de persistencia de `core/catalog` o el repositorio de productos (P-1 A). Puede importar `contracts`, `core/shared`, `core/schedule` y las funciones puras de `core/catalog`.
  - El lint rechaza, en todo `landing-pages`, los imports relativos a archivos internos de un paquete (O-2).
  - `dependency-rule.test.ts` cubre esos casos.
  - La regla de transición sigue valiendo solo para `/admin` y el bot.
- **RF-9. Imagen y despliegue.**
  - La imagen `api` se construye y se publica en el CI.
  - El `Dockerfile` copia el código de `contracts` en las imágenes que lo usan (O-3).
  - `api` tiene `HEALTHCHECK`.
  - `deploy.sh` recibe y valida el digest de `api` además de los de `app` y `migrate`.
  - `compose.prod.yaml` declara el servicio `api` en la red interna.
  - Las imágenes `app` y `migrate` conservan sus nombres, rutas y routers.
- **RF-10. Desarrollo.** Hay un modo documentado de levantar `api` y `landing-pages` en local, y las pruebas de las landings no necesitan una API real (usan un doble).
- **RF-11. Documentación.** Se actualizan:
  - §4: la regla de transición limitada a `/admin` y el bot.
  - §6 y §8: el paso 3 aplicado.
  - §9: la decisión A en el paso 3.
  - §10: la revisión de memoria basada en el 33,5 %, sin una medición nueva, por decisión del usuario, y el riesgo de dependencia de la API.
  - El README (variables de entorno, ejecución, despliegue y reinstalación de `deploy/`) y `.env.example`.

## Historias de usuario

- **HU-1.** Como cliente, quiero ver el menú de siempre en `/`, `/molotes` y `/birria`, para pedir sin notar el cambio de arquitectura.
- **HU-2.** Como administrador, quiero que un cambio de producto en `/admin` se vea en la landing en cuanto recargo, para no publicar precios o disponibilidad equivocados.
- **HU-3.** Como dueño, quiero que las landings sigan funcionando aunque la API falle, para no perder pedidos.
- **HU-4.** Como equipo, quiero que las landings solo dependan del contrato de la API, para mover el admin en el paso 4 sin tocarlas.

## Reglas de negocio

- **RN-1.** La visibilidad, el orden y los precios de los productos son los de hoy (REQ-F-008 y `visible-menu`). La API no los reinterpreta.
- **RN-2.** El aviso del día lo decide siempre el servidor de las landings con `BUSINESS_TIMEZONE`, sin cambios.
- **RN-3.** Preferencia de datos en la landing: datos frescos de la API, después la última copia buena en memoria y, por último, la semilla (`content/seeds.ts`).
- **RN-4.** La importación de semillas solo la hace `landing-pages` y nunca dos contenedores a la vez.

## Criterios de aceptación

- **CA-1 (HTML idéntico).** Con los mismos datos, el HTML de `/`, `/molotes` y `/birria`, forzando cada uno de los 7 días en desarrollo, es byte a byte igual antes y después del cambio. Se comprueba con una prueba automatizada contra una referencia generada con el código actual.
- **CA-2 (endpoint).**
  - `GET` para `molotes` y `birria` responde 200, con un cuerpo que valida el esquema de `contracts` y coincide con los productos publicados en la base.
  - Un negocio desconocido responde 404 con el formato de error.
  - `POST`, `PUT` y `DELETE` responden 405.
  - Con la base no disponible responde 503, con el formato de error y sin stack, SQL ni credenciales.
- **CA-3 (sin caché en la API).** Si un producto cambia en la base, la siguiente petición a la API devuelve el valor nuevo.
- **CA-4 (al instante).** Se crea, edita, oculta, elimina, recupera y reordena un producto desde `/admin` HTML y desde `/admin/api`. En cada caso, la siguiente petición a la landing de ese negocio refleja el cambio, y la del otro negocio no cambia.
- **CA-5 (API caída en funcionamiento).** Con una copia buena cargada, se detiene la API, o se hace que tarde más del límite, o que devuelva un cuerpo inválido:
  - la landing responde 200 con los productos de la última copia buena;
  - se registra el evento estructurado;
  - al restablecer la API, sin reiniciar `landing-pages`, la landing vuelve a mostrar sus datos.
- **CA-6 (arranque sin API).** `landing-pages` arranca con la API inaccesible. Las landings responden 200 con los productos de `content/seeds.ts` y se registra el evento. Al levantar la API, pasan a mostrar sus datos sin reiniciar.
- **CA-7 (sin 5xx).** En CA-5 y CA-6, ninguna petición a `/`, `/molotes` ni `/birria` responde 5xx.
- **CA-8 (red interna).** En `compose.prod.yaml`, `api` no tiene labels de Traefik ni `ports`, y entre los servicios en ejecución solo comparte red con `landing-pages` y con MySQL (`migrate` es un proceso puntual; P-3 A). Los routers `restaurante*` no cambian.
- **CA-9 (regla de dependencias).** `npm run lint` falla:
  - si el código de las landings importa `@restaurante/db`, Prisma, `mariadb`, `@restaurante/core/identity`, `@restaurante/core/bot-control`, las piezas de persistencia de `@restaurante/core/catalog` o el repositorio de productos (P-1 A);
  - si cualquier archivo de `landing-pages` importa por ruta relativa un archivo interno de `packages/` (O-2).

  `dependency-rule.test.ts` contiene un caso por cada regla, y `/admin` y el bot siguen pudiendo importar `core` y `db`.
- **CA-10 (O-1 cerrado).** `api` no contiene ninguna ruta de código que importe semillas o escriba en la base. Una prueba arranca `api` y `landing-pages` a la vez contra una base recién migrada: los dos arrancan, la importación se hace una sola vez y no aparece `products_init_failed`.
- **CA-11 (O-3 cerrado).** Las imágenes que usan `contracts` contienen su código y arrancan. El job `docker` y `smoke.sh` del CI pasan con `api` y `landing-pages` levantadas, y el smoke comprueba que las landings muestran productos que vienen de la API.
- **CA-12 (despliegue).**
  - `deploy.sh` exige y valida el formato de 3 digests (`app`, `migrate` y `api`) y rechaza 2.
  - El workflow publica la imagen `api` y pasa su digest.
  - La suma de `deploy/` se recalcula.
  - El README documenta la reinstalación de `deploy/` en el VPS al llegar a `main`.
- **CA-13 (Zod).** Zod es una dependencia solo de `packages/contracts`. Ningún validador existente se migra (`product-schema.ts` no cambia). La justificación consta en el ticket o en la documentación.
- **CA-14 (convivencia).** El bot, `/admin`, `/admin/api` y la importación de semillas pasan sus pruebas actuales sin cambios de comportamiento.
- **CA-15 (configuración).** Una URL base de la API ausente o inválida hace que `landing-pages` termine al arrancar con un mensaje claro, sin repetir el valor. La variable está en `.env.example` y en el README.
- **CA-16 (calidad).** `npm run typecheck`, `npm run lint` y `npm test` terminan con 0 en la raíz. El CI completo (`calidad`, `docker`, `despliegue` y `auditoria`) pasa en el PR hacia `epic/arquitectura`.
- **CA-17 (documentación).** §4, §6, §8, §9 y §10 de `arquitectura.md` y el README reflejan RF-11. En particular, §10 registra que la revisión de memoria del paso 3 se basa en el 33,5 % por decisión del usuario.

## Casos límite

- La API caída al arrancar `landing-pages`: se usa la semilla (CA-6).
- La API cae después de haber cargado datos: se usa la última copia (CA-5).
- Respuesta lenta: el render no espera más del límite fijado y usa la caché.
- Cuerpo inválido o esquema incompatible: se trata como API caída (RF-2).
- La API devuelve 503 porque la base cayó: las landings sirven la última copia y `/admin` muestra su propio error, como hoy.
- Una escritura en `/admin` con la API caída: la caché se invalida; si el refresco falla, se sigue mostrando la última copia buena y se registra el evento.
- Reinicio de `landing-pages` con la API caída: la copia en memoria se pierde y se usa la semilla.
- Visitas simultáneas tras una invalidación: los datos son coherentes y no se lanza un número excesivo de peticiones a la API (la estrategia la fija el plan técnico).
- `?dia=` sigue funcionando en desarrollo y se ignora en test y producción.
- Arranque simultáneo de `api` y `landing-pages` contra una base recién migrada (CA-10).
- Ningún cliente externo alcanza `api` desde Internet (CA-8).

## Dependencias

- Paso 2 cerrado (REQ-F-037): `core`, `db` y el esqueleto de `contracts`.
- Decisión A (contenedores) y decisión C (Zod) de `arquitectura.md` §9.
- CI del PR hacia `epic/arquitectura`.
- Al llegar la épica a `main`: reinstalación de `deploy/` en el VPS (fuera de este PR).

## Riesgos

- **R-1. Cambio del pipeline de producción** (`deploy.sh`, `compose.prod.yaml` y el workflow). Mitigación: CI completo con smoke en el PR hacia la épica. El despliegue real llega con el merge de la épica a `main`, con la reinstalación de `deploy/` documentada.
- **R-2. Dependencia de las landings respecto de la API.** Mitigación: RF-5, con caché, última copia buena y semilla.
- **R-3. La semilla puede estar desfasada respecto de la base.** Un arranque con la API caída mostraría productos antiguos hasta que la API vuelva. Aceptado por el usuario.
- **R-4. Mínimo privilegio incompleto.** `landing-pages` conserva las credenciales hasta el paso 4, y `api` usa el usuario DML actual de la app (confirmado).
- **R-5. Memoria.** Hay un contenedor Node más, sin una medición nueva. Se acepta con la estimación del 33,5 % (umbral del 80 %).
- **R-6. Dos cachés de productos.** La del bot sale de la base y la de las landings de la API, así que pueden divergir momentáneamente si falla un refresco. Las dos se invalidan con cada escritura.

## Action Plan

### Objetivo

Que las landings lean los productos de `api` sin que cambie el HTML, la frescura ni la disponibilidad.

### Orden recomendado

1. **Línea base.** Generar la referencia de HTML de las 3 rutas × 7 días con el código actual (CA-1).
2. **Contrato.** Instalar Zod en `packages/contracts` con su justificación. Definir el esquema de la respuesta y el cliente HTTP tipado, publicados en el `exports` del paquete.
3. **`api/`.** Workspace Koa con el endpoint público (RF-1), el manejo centralizado de errores, el log estructurado, el `HEALTHCHECK`, la configuración propia validada y la lectura sin caché mediante `core` y `db`. No incluye importación de semillas ni escrituras. Lleva pruebas HTTP con `listenLocal` y MySQL real.
4. **Landings.**
   - El controlador de las landings obtiene los productos del cliente de `contracts`, con caché en memoria, última copia buena, semilla de `content/seeds.ts`, límite de tiempo y log (RF-5).
   - La caché se invalida tras cada escritura de productos de `/admin` (RF-6).
   - La URL base de la API se valida al arrancar (CA-15), y las pruebas usan un doble de la API.
5. **Regla de dependencias.** Bloques de `no-restricted-imports` para el código de las landings y para los imports relativos internos, con sus casos en `dependency-rule.test.ts` (RF-8).
6. **Imágenes y despliegue.** `Dockerfile` (imagen `api` y copia de `contracts`), `compose.prod.yaml` (servicio `api` interno), `deploy.sh` (tercer digest), el workflow (construcción, publicación y smoke) y el arranque en desarrollo (RF-9 y RF-10).
7. **O-1.** La prueba de arranque simultáneo (CA-10).
8. **Documentación** (RF-11).
9. **Verificación.** `typecheck`, `lint`, `test` y el CI completo en el PR hacia `epic/arquitectura`.

### Resultado esperado

`api` sirve los productos en la red interna y las landings los consumen con el mismo HTML. El admin y el bot no cambian, O-1 a O-3 quedan cerrados y la épica queda lista para el paso 4.

## Trazabilidad

| Origen | Requisitos | Criterios | Action Plan |
| --- | --- | --- | --- |
| Paso 3 de §8 ("mismo HTML") | RF-1, RF-4 | CA-1, CA-2, CA-3 | 1, 3, 4 |
| Decisión: solo productos | RF-1 | CA-2 | 3 |
| Decisión: red interna y decisión A | RF-3, RF-9 | CA-8, CA-11, CA-12 | 6 |
| Decisión: al instante | RF-6 | CA-3, CA-4 | 4 |
| Decisión: API caída y §10 | RF-5 | CA-5, CA-6, CA-7 | 4 |
| Decisiones: semillas y convivencia | RF-7 | CA-10, CA-14 | 3, 7 |
| Decisión: lint, §4 y O-2 | RF-8 | CA-9 | 5 |
| Decisión: memoria | RF-11 | CA-17 | 8 |
| Decisión: Zod y decisión C | RF-2 | CA-13 | 2 |
| O-1 / O-3 de REQ-F-037 | RF-7 / RF-9 | CA-10 / CA-11 | 7 / 6 |

## Revisión técnica

Revisión del 2026-10-26 (senior-fullstack, fase T1), sobre `epic/arquitectura` en `769ad8b`. Se exploró con CodeGraph: `createLandingController`, `createProductRepository` (`refresh`, `stale`, `write`), `createApp`/`createRouter`, `server.ts`, `products.init`, `content/seeds.ts` y las pruebas afectadas. También se leyeron por rangos el `Dockerfile`, `deploy/` (`compose.prod.yaml`, `deploy.sh`, `ci/smoke.sh`, `ci/resumen.sh`), `ops/backup/` (`backup.sh`, `restore.sh`, `ci/smoke.sh`), el workflow y `eslint.config.ts`.

El requisito es viable y el plan está listo (ver abajo). Quedan **tres puntos que necesitan una decisión del usuario**, porque el ticket, tal como está escrito, los deja imposibles o fuera de alcance.

### P-1. "Se prohíben `core` y `db` en el código de las landings" choca con RN-2 y con "mismo HTML" (RF-8 y CA-9)

- **Problema.** El código de las landings usa hoy módulos **puros** de `core` (sin E/S ni base de datos) que este ticket no mueve:
  - `@restaurante/core/schedule` (`getHomeNotice`, `getMolotesNotice`, `parseForcedDay`): el aviso del día, que RN-2 obliga a seguir decidiendo en el servidor de las landings;
  - `@restaurante/core/catalog`: `buildVisibleMenu`, `visibleBirriaItems`, `formatPesos` y los tipos de `menu-schema` (`MenuDataByBusiness`, `MolotesItem`…), que dan forma al hero, al destacado y a las promociones que siguen en `landing-pages`;
  - `@restaurante/core/shared`: `BUSINESS` y `BusinessId`.

  Prohibir **todo** `core` en esos archivos obliga a sacar esa lógica de `core` o a duplicarla.
- **Requisitos afectados:** RF-8, CA-9, RN-2, CA-1 y la tabla de §4.
- **Impacto.** La opción literal (B) mete lógica de dominio en `contracts`, cuyo papel en §5 son solo esquemas y DTO, o duplica el cálculo del aviso. Las dos cosas arriesgan CA-1 y agrandan el diff sin acercar el objetivo real, que es que las landings no lean la base de datos.
- **Alternativas:**
  - **A (recomendada).** En el código de las landings, el lint prohíbe:
    - `@restaurante/db`, Prisma (`prisma`, `@prisma/*`) y `mariadb`;
    - los módulos de `core` con persistencia o identidad (`@restaurante/core/identity` y `@restaurante/core/bot-control`);
    - de `@restaurante/core/catalog`, las piezas de persistencia y de servidor (`createMemoryProductStore`, `ProductStore`, `ProductStoreTx` y `toPublished`), mediante `importNames`;
    - el import del repositorio de productos (`repositories/product-repository.ts`).

    Permite `@restaurante/contracts`, `core/shared`, `core/schedule` y las funciones puras de `core/catalog`. Así los productos solo pueden llegar del cliente de la API. Se registra en §4 como desviación, hasta que los horarios y el aviso sean endpoints públicos (§6).
  - **B (literal).** Prohibir todo `core` y trasladar a `contracts` (o duplicar en `landing-pages`) `schedule`, `visible-menu`, `formatPesos`, los tipos de `menu-schema` y `BUSINESS`.
  - **C.** Exponer ya los endpoints de aviso y horarios. Contradice la decisión "Solo productos".
- **Decisión requerida:** A, B o C. Recomiendo A.

### P-2. `compose.prod.yaml` también lo usan los respaldos (`ops/backup/`), que el ticket no menciona

- **Problema.** `ops/backup/backup.sh`, `ops/backup/restore.sh` y `ops/backup/ci/smoke.sh` (job `despliegue`) ejecutan `docker compose -f deploy/compose.prod.yaml` pasando solo `RESTAURANTE_APP_IMAGE` y `RESTAURANTE_MIGRATE_IMAGE`. Si el servicio `api` declara su imagen como obligatoria (`${RESTAURANTE_API_IMAGE:?…}`, igual que `app`), compose no puede leer el archivo y esos tres scripts fallan. Además, `restore.sh` reescribe `state/release.env` solo con `app` y `migrate`.
- **Requisitos afectados:** RF-9, CA-12, CA-16 (el job `despliegue` corre el smoke de respaldos) y R-1.
- **Alternativas:**
  - **A (recomendada, sin tocar `ops/`).** En `compose.prod.yaml`, `image: ${RESTAURANTE_API_IMAGE:-ghcr.io/orvigas/restaurante-api:sin-desplegar}`: un valor por defecto que ningún flujo arranca. `deploy.sh` siempre pasa el digest real. Los respaldos siguen igual: no paran ni arrancan `api` (una restauración solo cambia `app`, y el contenedor `api` sigue en marcha). El runbook de `docs/despliegue.md` documenta que, si se restaura en un VPS nuevo, se ejecute después un despliegue. Mientras tanto, las landings sirven la semilla y ninguna petición responde 5xx (RF-5).
  - **B.** Integrar `api` en `ops/backup/`:
    - `restore.sh` arranca `api` y conserva su línea en `release.env`;
    - `backup.sh` la registra;
    - se adapta el smoke de respaldos;
    - hay que reinstalar también `ops/` en el VPS.

    Es más superficie de producción fuera del alcance escrito.
- **Decisión requerida:** A o B. Recomiendo A.

### P-3. CA-8: `api` comparte la red `db` también con `migrate`

- **Problema.** CA-8 pide que `api` "solo comparta red con `landing-pages` y con MySQL". La red interna `db` es la única que llega a MySQL, y en ella también está `migrate`, el proceso puntual del perfil `migrate` que aplica las migraciones y termina.
- **Alternativas:**
  - **A (recomendada).** Interpretar CA-8 como "servicios en ejecución": `api` va solo en `db`, sin `ports` ni labels, y la prueba de CA-8 lo comprueba con `docker compose config`, tratando `migrate` como puntual.
  - **B.** Separar redes: `db` para MySQL, `app` y `api`, y otra red para MySQL y `migrate`. Cambia más el compose sin ganancia real.
- **Decisión requerida:** A o B. Recomiendo A.

### Verificaciones sin problemas

- **O-1.** La importación ya está solo en `products.init` de `landing-pages`. `api` no la importa ni tiene ruta de escritura.
- **Invalidación.** Todas las escrituras de productos (`/admin` HTML y `/admin/api`) pasan por `write()` de `createProductRepository`: un único punto, en el mismo proceso.
- **Zod.** 4.6.7 es la última estable (2026-10-12, 14 días el 2026-10-26). Licencia MIT, sin dependencias en ejecución y sin scripts de instalación: no cambia `allowScripts`.
- **CA-1 es determinista.** Las instantáneas actuales (`tests/snapshots/`) ya se comparan byte a byte. El HTML no lleva nonces ni horas.
- **`?dia=`** solo actúa con `NODE_ENV=development`. CA-1 se comprueba en ese modo.

## Technical Action Plan

Aprobado el 2026-10-26 con A en P-1, P-2 y P-3. Zod: a las 14:25 UTC del 2026-10-26 la 4.6.7 aún no cumplía dos semanas y se instaló 4.6.5, como preveía el plan. `npm run audit:deps` la rechazó (GHSA-mrhx-c7xc-m3w5, high, corregido en 4.6.6). A las 17:13 UTC la 4.6.7 ya cumplía las dos semanas, así que queda fijada **4.6.7** (ver Implementation Result, desviaciones).

### Objetivo técnico

Que `landing-pages` obtenga los productos de las landings de un proceso `api` nuevo, con un contrato Zod compartido y una caché propia con estos niveles: datos frescos → última copia buena → semilla. Las escrituras de `/admin` invalidan esa caché en el mismo proceso. El HTML queda idéntico byte a byte, y `api` vive solo en la red interna de producción.

### Archivos o componentes afectados

- **Nuevo workspace `restaurante/api/`:**
  - `package.json`, con dependencias ya presentes en el lockfile: `koa`, `@koa/router`, `@restaurante/{core,db,contracts}`; `vitest` y `@types/koa` en desarrollo;
  - `tsconfig.json`, `vitest.config.ts` y `.env.example`;
  - en `src/`: `server.ts`, `app.ts`, `config.ts`, `routes.ts`, `error-handler.ts` y `request-logger.ts`;
  - `tests/{unit,integration}`.
- **`packages/contracts`:**
  - `products.ts`: ids públicos de negocio, esquemas Zod de `MolotesItem`, `MolotesDrink` y `BirriaItem` (unión discriminada por `detailsType`), la respuesta `{ data }`, sus tipos inferidos y `publicProductsPath(business)`;
  - `public-client.ts`: `createPublicApiClient`;
  - `index.ts` y `package.json` (`zod` 4.6.7, versión exacta).
- **`packages/core/catalog`:**
  - `published.ts` (nuevo): `PublishedProducts`, `toPublished` y sus funciones `molotesItem`, `molotesDrink` y `birriaItem`, movidos sin cambios desde `landing-pages/src/repositories/product-repository.ts` para que los use `api`;
  - `index.ts`.
- **`packages/db/src/database-config.ts`:** recibe `parseDatabaseUrl`, movido sin cambios desde `landing-pages/src/config/env.ts`, porque la usan las dos apps.
- **`landing-pages/src/`:**
  - `services/landing-products.ts` (nuevo): la caché de la API;
  - `controllers/landing.ts`, `routes/index.ts` y `app.ts`;
  - `repositories/product-repository.ts`: suscripción a cambios; reexporta `PublishedProducts` y `toPublished` desde `core` para no tocar a sus consumidores (bot y pruebas);
  - `config/env.ts`: `API_INTERNAL_URL`;
  - `server.ts`.
- **`landing-pages/scripts/bot-chat.ts`:** usa un adaptador local de pruebas.
- **`landing-pages/tests/`:**
  - de soporte: `support/products-api-double.ts` y `support/landing-products.ts`;
  - nuevas: `unit/landing-products.test.ts`, `unit/public-client.test.ts`, `integration/landing-html-reference.test.ts`, `integration/landing-products-api.test.ts` e `integration/api-process.test.ts`;
  - las referencias en `snapshots/landing-html/`;
  - actualizar `unit/dependency-rule.test.ts`, `unit/config.test.ts`, `helpers.ts` y las llamadas a `createApp` (unas 26, cambio mecánico).
- **Raíz:** `package.json` (workspace `api` y scripts `dev`, `dev:api`, `dev:landing`, `test` y `start:api`), `eslint.config.ts` y `package-lock.json`.
- **Docker y despliegue:**
  - `landing-pages/Dockerfile`: etapa `api` nueva; `contracts` en `production`; `api/package.json` en todas las etapas que ejecutan `npm ci`;
  - `deploy/compose.prod.yaml`, `deploy/deploy.sh`, `deploy/env.production.example`;
  - `deploy/ci/smoke.sh`, `deploy/ci/resumen.sh` y `deploy/ci/resumen-test.sh`;
  - `.github/workflows/ci.yml`.
- **Documentación:** `restaurante/docs/arquitectura.md` (§4, §6, §8, §9 y §10), `restaurante/README.md`, `restaurante/docs/despliegue.md`, `restaurante/docs/desarrollo.md` (si existe la sección de ejecución), `landing-pages/.env.example` y `api/.env.example`.

### Backend

**1. `api` (solo lectura)**

- **Endpoint:** `GET /api/v1/public/{molotes|birria}/productos`, por coherencia con `/admin/api/:business/productos`.
  - Lee del store Prisma en cada petición, con `store.listBusiness(business)` y `toPublished` de `core`. No guarda caché (CA-3).
  - Serializa con `ProductsResponseSchema.parse({ data })` de `contracts`. Si la salida no cumple el esquema, responde 500 `INTERNAL_ERROR` y registra `products_response_invalid` (no debería ocurrir: lo impide la prueba de tipos).
- **Errores**, con el formato `{ error: { code, message } }`:
  - negocio desconocido: 404 `BUSINESS_NOT_FOUND`;
  - otra ruta: 404 `NOT_FOUND`;
  - método distinto de GET o HEAD en la ruta: 405 `METHOD_NOT_ALLOWED`, con `Allow: GET, HEAD`;
  - `DatabaseUnavailableError` (el store Prisma ya convierte los errores inesperados): 503 `DATABASE_UNAVAILABLE`;
  - error inesperado: 500. Nunca lleva stack, SQL ni URL. El log solo registra `name` y `code`.
- **Cabeceras:** `Content-Type: application/json; charset=utf-8`, `Cache-Control: no-store` y `X-Content-Type-Options: nosniff`.
- **Arranque (`server.ts`):**
  - configuración propia validada (`config.ts`): `NODE_ENV`, `HOST` (127.0.0.1 por defecto), `PORT` (3001 por defecto), `DATABASE_URL` (usuario DML actual) y `DATABASE_ALLOW_NEWER_SCHEMA`;
  - `verifyDatabase` (los mismos reintentos de 60 s y el mismo `database_init_failed` con código 1);
  - `listen` y `server_started`.
  - **Nunca** llama a `products.init`, no importa `content/` ni semillas y no tiene repositorios de escritura (O-1, CA-10).
- **Health:** el `HEALTHCHECK` consulta el propio endpoint de Birria con `wget`, sin añadir rutas (respeta "Solo productos").
- **Log de peticiones:** un middleware propio de unas 30 líneas (método, ruta, estado y ms), con la misma forma que el de `landing-pages`. Se duplica a propósito: Koa no puede vivir en `core`.

**2. Contrato (`contracts`)**

- **Esquemas Zod:** objetos normales, que descartan los campos desconocidos. Así una ampliación compatible de la API no rompe las landings. Céntimos enteros ≥ 0, cadenas e `image { src, alt, width, height }`.
- **Tipos:** `PublicProducts[Id]` se obtiene con `z.infer`.
- **Cliente:** `createPublicApiClient({ baseUrl, fetch = globalThis.fetch, timeoutMs })`, con `getProducts(business, { signal })`. Devuelve `{ ok: true, data } | { ok: false, reason: 'timeout' | 'network' | 'http_status' | 'invalid_body', status? }` y nunca lanza.
  - Usa `AbortSignal.timeout`, `redirect: 'error'` y `Accept: application/json`.
  - Comprueba que el estado sea 200 y que el `Content-Type` sea JSON.
  - Rechaza cuerpos de más de 1 MiB.
  - Valida con `safeParse`.

**3. Caché de las landings (`services/landing-products.ts`)**

Interfaz: `createLandingProducts({ client, seeds, logger, now, ttlMs = 60_000, retryMs = 5_000 })` → `{ warmUp(), get(business), invalidate(business) }`. Estado por negocio:

- `data`: la última copia buena o, al principio, la semilla;
- `source`: `api` o `seed`;
- `generation` y `loadedGeneration`;
- `loadedAt`, `failedAt`, `inflight` y `failures`.

Comportamiento de `get` (nunca lanza):

- **Fresco** (`loadedGeneration === generation` y edad < TTL): devuelve `data`, sin E/S.
- **Invalidado** (`generation > loadedGeneration` y sin un fallo posterior a la invalidación): **espera** el refresco, con un único vuelo en curso por negocio y el límite de **1500 ms**. Si va bien, devuelve los datos nuevos ("al instante", CA-4). Si falla, devuelve `data`.
- **TTL vencido**, o en estado de fallo con `retryMs` cumplido: devuelve `data` al momento y lanza el refresco en segundo plano (*stale-while-revalidate*, §6). Así ninguna petición espera durante una caída.

Reglas del vuelo en curso y de la invalidación:

- Un vuelo iniciado **antes** de una invalidación no la satisface: se guarda con su `generation`, y una petición invalidada después lanza otro vuelo. Así se evita servir datos leídos antes del commit.
- Con N visitas simultáneas tras una invalidación sale **una sola** petición a la API.

Log, sin URL ni datos:

- `landing_products_fallback` (`business`, `reason`, `status?`, `source: last_good|seed`): en el primer fallo de una racha y, después, como mucho una vez por minuto;
- `landing_products_recovered` (`business`, `failures`);
- `landing_products_loaded` (`business`, `source: 'api'`): en la primera carga buena.

Al arrancar, `warmUp()` intenta los dos negocios con el mismo límite y **nunca** es fatal (CA-6).

**Semilla de respaldo:** se construye al arrancar desde `loadSeedDocument(business).data` (las listas v1 de `content/seeds.ts`) y se valida con el esquema del contrato (fallo rápido si la semilla no lo cumple). Una prueba unitaria comprueba que es igual a `toPublished(productsFromMenuData(semilla))`, es decir, a lo que la base tendría tras importar esa semilla.

**4. Invalidación en el mismo proceso**

- `ProductRepository` gana `onChange(listener): () => void`. `write()` avisa a los suscriptores **después** del commit, aunque falle la recarga de su propia caché, y nunca si la transacción falla.
- Un error de un suscriptor se registra (`products_change_listener_failed`, solo `name`) y no afecta a la escritura.
- `createApp` suscribe `landingProducts.invalidate`, de modo que el servidor y las pruebas quedan conectados igual.
- La caché del bot sigue como hoy (R-6).

**5. Controlador de las landings**

- `createLandingController` recibe `landingProducts: Pick<LandingProducts, 'get'>` en lugar del repositorio.
- `withProducts` pasa a `services/landing-products.ts`, tipado con `PublicProducts` y `MenuDataByBusiness`.
- El aviso, `?dia=`, las cabeceras y la vista no cambian.
- `createApp` exige `landingProducts`. Las pruebas que no prueban productos usan `landingProductsFrom(products)` de `tests/support/landing-products.ts`, un adaptador en memoria que nunca entra en `src/`. `bot-chat.ts` lo usa también.

**6. Configuración**

- `API_INTERNAL_URL` es obligatoria en todos los entornos.
  - Debe ser `http:` o `https:`, sin usuario ni contraseña, sin query ni fragmento, y sin barra final, que se normaliza.
  - Si falta o es inválida, el servidor termina con 1 y un mensaje con el formato esperado, **sin repetir el valor** (CA-15).
- Ejemplos de valor: en desarrollo `http://127.0.0.1:3001`; en producción `http://api:3001`.

### Contenido / configuración

- `landing-pages/.env.example`: `API_INTERNAL_URL`.
- `api/.env.example`: `NODE_ENV`, `HOST`, `PORT=3001`, `DATABASE_URL` (el mismo usuario DML que la app en local).
- `deploy/env.production.example`: sin variables nuevas obligatorias (la URL interna va fija en el compose).

### Regla de dependencias (RF-8, CA-9) (P-1)

- **Bloque "landings"** en `eslint.config.ts`. Sus archivos son `landing-pages/src/controllers/landing.ts`, `landing-pages/src/views/landings/**/*.ts` y `landing-pages/src/services/landing-products.ts`. Prohíbe:
  - `@restaurante/db*`, `prisma`, `@prisma/*` y `mariadb`;
  - `@restaurante/core/identity` y `@restaurante/core/bot-control`;
  - de `@restaurante/core/catalog`, los nombres de persistencia (`importNames`);
  - `**/repositories/product-repository.ts`.

  Repite los patrones de `.js`.
- **O-2:** en todo `landing-pages`, cualquier import relativo que llegue a `packages/` (`(?:^|/)packages/`) se rechaza, porque los paquetes solo se importan por su nombre.
- **Bloque de `api`:** puede importar `core` (solo por el `index.ts` de cada módulo), `db`, `contracts` y Koa; nunca `landing-pages` ni rutas relativas fuera de `api/`.
- **Comentario de la regla de transición:** se limita a `/admin` y al bot.
- **`dependency-rule.test.ts`:** un caso por regla nueva.
  - Las landings rechazan `db`, `@prisma/client`, `core/identity`, `createMemoryProductStore` y el repositorio de productos, y permiten `contracts`, `core/schedule` y `formatPesos`.
  - O-2: rechaza `../../packages/core/catalog/price.ts`.
  - `api`: rechaza `landing-pages`.
  - Comprueba que `/admin` (`src/controllers/admin.ts`) y el bot siguen pudiendo importar `core` y `db`.

### Docker, CI y despliegue (RF-9, CA-8, CA-11, CA-12) (P-2, P-3)

- **`Dockerfile`** (el mismo archivo y la misma construcción; se añade una etapa):
  - `deps`, `migrate` y `production` copian también `api/package.json`, porque `npm ci` necesita el manifiesto de cada workspace;
  - `build` copia `api/`, de modo que el `typecheck` de la raíz lo cubre;
  - `test` pasa a ejecutar `npm test` desde `/app`, para correr las suites de `api` y `landing-pages`;
  - `production` copia `/app/packages/contracts` (O-3);
  - **etapa nueva `api`:** `FROM base`; `npm ci --omit=dev --omit=optional` igual que `production`; `WORKDIR /app/api`; copia `api/src`, `packages/core`, `packages/contracts`, `packages/db/src` y las migraciones (que lee `verify.ts`); `ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001`; `USER node`; `EXPOSE 3001`; `HEALTHCHECK` con `wget` al endpoint de Birria; `CMD node src/server.ts`.
  - `app` y `migrate` conservan sus nombres, el WORKDIR, el comando, el usuario y el `HEALTHCHECK`.
- **`compose.prod.yaml`:**
  - **servicio `api`:**
    - imagen `${RESTAURANTE_API_IMAGE:-ghcr.io/orvigas/restaurante-api:sin-desplegar}` (P-2);
    - variables `NODE_ENV`, `HOST`, `PORT`, `DATABASE_URL` (`restaurante_app`), `DATABASE_ALLOW_NEWER_SCHEMA`;
    - solo en la red `db`, sin `ports` ni `labels`;
    - `depends_on: mysql (healthy)`, `read_only`, `tmpfs: /tmp`, `cap_drop: ALL` y `no-new-privileges`;
    - healthcheck con `start_interval`, `restart: unless-stopped` y el mismo `logging`.
  - **`app`:** gana `API_INTERNAL_URL: http://api:3001`. Sin `depends_on: api`, porque las landings toleran que la API no esté.
  - Los routers `restaurante*` no cambian.
- **`deploy.sh`:**
  - **Argumentos:** `deploy <sha> <digest app> <digest migrate> <digest api> <suma>` (6 argumentos). Valida los tres digests y rechaza la forma anterior (código 2).
  - **Imágenes:** `pull` de las tres.
  - **`compose()`:** pasa también `RESTAURANTE_API_IMAGE`.
  - **Paso 5a nuevo:** `up -d --no-deps api` y espera a que quede healthy, con `wait_healthy` generalizada por servicio. Si no lo consigue, vuelve a la `api` anterior si la hay (con `DATABASE_ALLOW_NEWER_SCHEMA=true`), registra `api_failed` y termina con un **código nuevo, 15**, sin tocar `app`.
  - **Paso 5b:** `app`, igual que hoy.
  - **Vuelta atrás de `app` (códigos 21 y 22):** devuelve también `api` a la imagen anterior si existe. Si no existe (primer despliegue con `api`), deja la nueva.
  - **Registro:** `release.env` y `releases.log` registran `RESTAURANTE_API_IMAGE`/`api=`.
  - `DEPLOY_FILES` no cambia, pero la suma cambia porque cambian dos de sus archivos. Se documenta la reinstalación de `deploy/` en el VPS (CA-12).
- **Workflow (`ci.yml`):**
  - **job `docker`:**
    - construye la etapa `api` (cache scope `api`);
    - comprueba el contenido de las imágenes: `/app/packages/contracts/index.ts` en `production` y en `api`, `zod` resoluble, y `api` sin el CLI de Prisma;
    - levanta `api` en `restaurante_db-test` hasta que queda healthy;
    - levanta `app-ca9` con `API_INTERNAL_URL` apuntando a ella y comprueba que `/molotes` responde.
  - **job `despliegue`:** construye `api` y ejecuta `smoke.sh restaurante:production restaurante:migrate restaurante:api`. El smoke de respaldos no cambia (P-2 A).
  - **job `publish`:** publica `ghcr.io/orvigas/restaurante-api:sha-<sha>` y expone la salida `api-digest`.
  - **job `deploy`:** pasa `$API_DIGEST` en el comando SSH.
  - `resumen.sh` (con su prueba) acepta `API_DIGEST`, lo muestra y traduce el código 15.
- **`smoke.sh`:**
  - **Uso:** recibe una tercera imagen, la sube al registro local y pasa tres digests.
  - **Comprobaciones de argumentos:** el uso con dos digests da 2 y un digest de `api` mal formado da 2.
  - **Red interna (CA-8):** `api` no tiene `ports` ni `labels` según `docker compose config`, y está solo en la red `db`. Desde el host no hay puerto de `api`.
  - **Comunicación interna:** desde el contenedor `app`, `wget http://api:3001/api/v1/public/birria/productos` responde 200 con JSON válido.
  - **Origen de los datos:** se cambia el nombre de un producto con `mysql` como root y se reinicia `app`. La landing muestra el nombre nuevo y el log de `app` contiene `landing_products_loaded` con `"source":"api"`: los productos vienen de la API y no de la semilla (CA-11).
  - **API caída:** con `docker compose stop api`, `/molotes` y `/birria` siguen respondiendo 200 por Traefik (CA-7 en producción).
  - **Despliegue con `api` rota:** termina con 15 y `app` no se toca.
  - Las comprobaciones actuales (vuelta atrás, candado, migración rota…) siguen, con tres digests.

### Desarrollo local (RF-10)

- **Scripts de la raíz:**
  - `npm run dev:api`: `node --watch --env-file-if-exists=.env src/server.ts` en `api/`;
  - `npm run dev:landing`: lo que hoy es `dev`;
  - `npm run dev`: levanta los dos con el mismo patrón `& … & wait` que ya usa `watch:css`;
  - `start:api` para ejecutarla sin recarga.
- **Pruebas:** las de las landings nunca necesitan una API real. Usan `products-api-double.ts`: un servidor HTTP en `127.0.0.1` sobre el mismo store en memoria, con modos `ok`, `down`, `slow`, `invalid` y `503`, y contador de peticiones.
- Si `api` no está en marcha en desarrollo, las landings muestran la semilla y registran el evento. El README lo explica.

### Validaciones

- La entrada del endpoint (`business`) se valida contra los ids del contrato.
- La respuesta se valida en los dos extremos: `parse` al serializar en `api` y `safeParse` en las landings.
- `API_INTERNAL_URL` y la configuración de `api` se validan al arrancar.
- **Tipos:** una prueba (`expectTypeOf`, que comprueba `tsc` en `typecheck`) asegura que `z.infer` del contrato y `PublishedProducts` de `core` son equivalentes, y que los ids del contrato coinciden con `BUSINESS_IDS`. Así el contrato no se desincroniza a mano (`.claude/rules/frontend-backend.md`).

### Manejo de errores

- **`api`:** un manejador centralizado con los códigos de arriba y el log solo con `name` y `code`.
- **Landings:** un fallo de la API nunca lanza hacia el render (RF-5, CA-7). El 503 de `/admin` no cambia.

### Testing

- **CA-1, referencia de HTML** (`integration/landing-html-reference.test.ts`):
  - **Generación** (paso 1 de T2):
    - se crea un `git worktree` del commit base de `epic/arquitectura`;
    - en él, una prueba temporal con el cableado actual (`createApp` con el repositorio en memoria importado desde las semillas, `nodeEnv: 'development'` y `?dia=` para los 7 días) escribe el HTML de `/`, `/molotes` y `/birria`;
    - se copian a `tests/snapshots/landing-html/` solo los archivos **distintos**, unos 7 de unos 60 KB, junto con un `manifest.json` (ruta × día → archivo y SHA-256);
    - en el ticket se registran el commit base, el código de esa prueba temporal y los SHA-256, para que QA pueda regenerarlos.
  - **Comparación:** la prueba definitiva usa el cableado nuevo (cliente real contra el doble HTTP sobre el mismo store) y compara byte a byte las 21 respuestas (`readFile` + `toBe`). No usa `toMatchFileSnapshot`, para que nunca reescriba la referencia.
- **CA-2 y CA-3:**
  - `api/tests`, en proceso con `createMemoryProductStore` y sin MySQL: 200 con un cuerpo que valida el esquema, 404, 405 (`POST`, `PUT`, `DELETE`, con `Allow`), HEAD, 503 con un store que lanza `DatabaseUnavailableError`, sin stack ni SQL, y sin caché (cambiar el store cambia la respuesta siguiente);
  - `landing-pages/tests/integration/api-process.test.ts`, con MySQL real (`makeDatabase`): arranca `node ../api/src/server.ts` como proceso hijo (`tests/support/process.ts`), sin importar código de `api`. Comprueba que el cuerpo coincide con los productos de la base, que un cambio en la base se ve en la petición siguiente, y que con la base cortada (`tests/support/tcp-proxy.ts`) responde 503 con el formato de error.
- **CA-4** (`integration/landing-products-api.test.ts` + `setupAdmin` con el doble): crear, editar, ocultar, eliminar, recuperar y reordenar desde `/admin` HTML y desde `/admin/api`. Después de cada operación:
  - la siguiente petición a la landing refleja el cambio;
  - la del otro negocio no cambia, y su contador del doble no sube;
  - sin invalidación, el TTL de 60 s mantendría el valor viejo. La prueba lo deja claro inyectando el reloj.
- **CA-5, CA-6 y CA-7** (`unit/landing-products.test.ts` y la integración):
  - con copia buena y el doble en modo `down`, `slow` (> 1500 ms) o `invalid`: 200 con la última copia y el evento registrado; al volver a `ok`, la landing muestra los datos nuevos tras `retryMs` (reloj inyectado), sin reiniciar;
  - arranque con el doble caído: semilla y evento; después, los datos de la API;
  - ninguna respuesta 5xx en `/`, `/molotes` ni `/birria`;
  - 20 visitas simultáneas tras una invalidación producen **una** petición al doble;
  - un vuelo iniciado antes de una invalidación no la satisface.
- **CA-9:** los casos nuevos de `dependency-rule.test.ts`.
- **CA-10** (`api-process.test.ts`): una base recién migrada y los dos procesos lanzados **a la vez**. Comprueba:
  - que los dos registran `server_started`;
  - que `product_import` tiene exactamente una fila por negocio;
  - que no aparece `products_init_failed`;
  - que la landing termina mostrando los datos de la API, con espera acotada.

  Además, una comprobación estática: en `api/src` no aparecen `products.init`, `importBusiness`, `content/`, `seeds` ni métodos de escritura del store.
- **CA-14:** la suite actual completa pasa. Solo cambian el cableado de `createApp` y los imports movidos (`toPublished`, `parseDatabaseUrl`).
- **CA-15:** `config.test.ts` (ausente, `ftp:`, con credenciales o con query: termina, el mensaje no contiene el valor) y `server-startup-config.test.ts` (código 1).
- **CA-11 y CA-12:** el job `docker` y `smoke.sh`, en el CI.
- **CA-13:** `zod` solo en `packages/contracts/package.json`; `product-schema.ts` sin cambios en el diff.
- **CA-16:** `typecheck`, `lint` y `test` en la raíz (ahora `test` ejecuta `api` y `landing-pages`), y el CI completo.

### Seguridad

- `api` no tiene puertos ni router de Traefik y solo está en la red interna `db`.
- `api` usa el usuario DML actual (R-4, aceptado) y no tiene rutas de escritura.
- El cliente no sigue redirecciones, limita el tamaño del cuerpo y el tiempo, y valida todo lo que recibe.
- La URL interna nunca aparece en logs ni en errores.
- La CSP y helmet de las landings no cambian. `api` solo sirve JSON con `nosniff` y `no-store`.

### Performance

- Las landings no hacen E/S por petición mientras la caché está fresca.
- Peticiones a la API: una por negocio y por escritura de `/admin`, más una de fondo por negocio cada 60 s como mucho, y una cada 5 s como mucho durante una caída.
- La espera máxima de una visita es de 1500 ms, y solo justo después de una escritura de `/admin` con la API lenta.
- Memoria: un contenedor Node más, estimado con el 33,5 % (R-5, decisión del usuario); se registra en §10.

### Justificación de Zod (`.claude/rules/dependencias.md`, CA-13)

- **Solución existente:** los validadores propios (`product-schema.ts`) validan, pero no dan tipos desde una sola definición. Un esquema compartido entre `api` y las landings duplicaría a mano tipo y validación.
- **Nativo:** Node no tiene validación de esquemas.
- **Decisión C:** tomada por el usuario (Zod), limitada a `contracts`.
- **Mantenimiento y compatibilidad:** paquete muy usado y activo, compatible con TypeScript 6 estricto y ESM, y sin dependencias en ejecución.
- **Seguridad:** sin scripts de instalación (no cambia `allowScripts`) y cubierto por `audit:deps`.
- **Versión:** `4.6.7` exacta, la última estable, publicada el 2026-10-12, con 14 días o más al instalarla en T2. Si T2 empezara antes de las 16:30 UTC del 2026-10-26, se usaría `4.6.5` (2026-09-13).

### Riesgos técnicos

- **R-T1. Pipeline de producción:** `deploy.sh` y `compose` cambian, y la vuelta atrás tiene un caso nuevo (`api`). Se mitiga con el smoke ampliado en el PR y la reinstalación documentada de `deploy/`.
- **R-T2. Diff de las pruebas:** unas 26 llamadas a `createApp` cambian de forma mecánica.
- **R-T3. Referencia de CA-1:** se genera en el worktree del commit base; un error ahí invalidaría la prueba. QA puede regenerarla con el procedimiento registrado y comparar los SHA-256.
- **R-T4. API antes de la importación:** con la base recién migrada, `api` devolvería listas vacías antes de la importación. No afecta, porque `landing-pages` solo pide a la API después de su propio `products.init`. Se documenta.
- **R-T5. Restauración en un VPS nuevo** (P-2 A): `api` no arranca hasta el siguiente despliegue. Mientras tanto se sirve la semilla, sin 5xx. Queda documentado en el runbook.
- **R-T6. Dos procesos en desarrollo:** si se olvida `api`, las landings muestran la semilla. El evento lo registra y el README lo explica.

### Orden de implementación

1. Rama `feature/REQ-F-038-api-publica-productos` desde `epic/arquitectura`. Generación de la referencia de CA-1 en el worktree del commit base.
2. `core/catalog/published.ts` y `db/database-config.ts` (movimientos sin cambios de lógica). La suite debe seguir en verde.
3. `contracts`: Zod, esquemas, cliente y sus pruebas.
4. `api/`: app, configuración, servidor y pruebas en proceso.
5. `landing-pages`: `onChange` en el repositorio, `landing-products.ts`, el controlador, `createApp` y `server.ts`, `API_INTERNAL_URL`, los dobles y las pruebas (CA-1, CA-4 a CA-7 y CA-15).
6. Lint (RF-8 y O-2) y `dependency-rule.test.ts`.
7. `api-process.test.ts` (CA-2, CA-3 y CA-10).
8. `Dockerfile`, `compose.prod.yaml`, `deploy.sh`, `smoke.sh`, `resumen.sh` y el workflow.
9. Documentación (RF-11) y `.env.example`.
10. `build:css`, `typecheck`, `lint` y `test`; revisión del diff; `Implementation Result`.

### Criterios de finalización

- CA-1 a CA-17 cumplidos, con la evidencia de cada uno en `Implementation Result`.
- `npm run typecheck`, `npm run lint` y `npm test` con 0 en la raíz.
- El CI completo en verde en el PR hacia `epic/arquitectura` (T4).
- `product-schema.ts`, los routers `restaurante*` y los nombres de las imágenes `app` y `migrate` sin cambios.

### Tamaño estimado del diff

Unas 3.000-3.500 líneas, sin contar las referencias HTML ni el lockfile:

| Bloque | Líneas aprox. |
| --- | --- |
| `api/` (código) | ~450 |
| `api/` (pruebas) | ~300 |
| `contracts` | ~250 |
| Caché y controlador de las landings | ~300 |
| Pruebas de las landings | ~900 |
| Movimientos a `core` y `db` | ~150 |
| Llamadas a `createApp` (mecánico) | ~60 |
| Lint y su prueba | ~120 |
| `Dockerfile` | ~60 |
| `compose.prod.yaml` | ~45 |
| `deploy.sh` | ~90 |
| `smoke.sh` y `resumen.sh` | ~150 |
| Workflow | ~90 |
| Documentación | ~300 |

A eso se suman unos 7 archivos de referencia HTML (unos 420 KB) y su `manifest.json`.

## Implementation Result

### Rama

`feature/REQ-F-038-api-publica-productos`, creada desde `epic/arquitectura` (`769ad8b`). Sin commit ni PR (fase T2). El PR irá a `epic/arquitectura` (`.claude/rules/git.md`).

### Cambios realizados

**Contrato y paquetes**
- **`packages/contracts`:** Zod 4.6.7 (versión exacta, solo aquí).
  - `products.ts`: `PUBLIC_BUSINESS_IDS`, `isPublicBusinessId`, `publicProductsPath`, los esquemas de `MolotesItem`, `MolotesDrink` y `BirriaItem` (unión discriminada por `detailsType`), `publicProductsSchemas`, `productsResponseSchemas`, `apiErrorSchema` y sus tipos.
  - `public-client.ts`: `createPublicApiClient`. Nunca lanza; usa `AbortSignal.timeout` y `redirect: 'error'`; exige 200 y JSON; rechaza cuerpos de más de 1 MiB; valida con `safeParse`.
- **`packages/core/catalog/published.ts`:** `PublishedProducts`, `toPublished`, `activeOf` y `byPosition`, movidos sin cambios desde `landing-pages`. `product-repository.ts` los reexporta para sus consumidores.
- **`packages/db/src/database-config.ts`:** recibe `parseDatabaseUrl`, movido sin cambios desde `landing-pages/src/config/env.ts`.

**`api/` (workspace nuevo)**
- `src/app.ts` atiende `GET|HEAD /api/v1/public/{molotes|birria}/productos` y responde `200 { data }`, serializado con el contrato. Lee la base en cada petición, sin caché.
- Errores con `{ error: { code, message } }`: 404 `BUSINESS_NOT_FOUND`/`NOT_FOUND`, 405 `METHOD_NOT_ALLOWED` con `Allow: GET, HEAD`, 503 `DATABASE_UNAVAILABLE` y 500 `INTERNAL_ERROR`. El log solo lleva `name` y `code`.
- Cabeceras `Cache-Control: no-store` y `X-Content-Type-Options: nosniff`.
- `src/config.ts` valida `NODE_ENV`, `HOST`, `PORT` (3001), `DATABASE_URL` y `DATABASE_ALLOW_NEWER_SCHEMA` sin repetir valores.
- `src/server.ts` solo verifica la base (`verifyDatabase`), escucha y cierra ordenadamente. No importa semillas ni escribe.
- `scripts/dev-server.ts` y `.env.example`.

**`landing-pages`**
- **`services/landing-products.ts`:** la caché de la API.
  - Fresca 60 s y luego *stale-while-revalidate*.
  - Al invalidarse, la siguiente visita espera, con un límite de 1,5 s.
  - Un vuelo por negocio y generación; un vuelo anterior a la invalidación no la satisface.
  - Si falla: última copia buena o semilla, y reintento de fondo cada 5 s.
  - Log `landing_products_loaded`/`fallback`/`recovered`, limitado a uno por minuto durante una caída.
  - También contiene `loadSeedProducts()` (semilla validada con el contrato) y `withProducts` (movida aquí).
- **`ProductRepository.onChange`:** avisa tras cada escritura confirmada. `createApp` exige `landingProducts` y suscribe la invalidación. El controlador y el router de las landings usan `landingProducts.get`.
- **`API_INTERNAL_URL`:** obligatoria y validada, sin repetir el valor. `server.ts` crea el cliente y la caché y hace `warmUp()` sin que un fallo impida arrancar.

**Lint y raíz**
- **Lint (`eslint.config.ts`):**
  - bloque del código de las landings (P-1 A);
  - O-2 en todo `landing-pages` y en `api`;
  - bloque de `api`;
  - pruebas de `api` con la misma regla de servidores en 127.0.0.1;
  - comentario de la regla de transición limitado a `/admin` y el bot.
- **Raíz:** workspace `api`; scripts `dev` (los dos procesos), `dev:api`, `dev:landing`, `start:api` y `test` (todos los workspaces con pruebas).

**Docker, despliegue y CI**
- **Docker:**
  - etapa `api` (`/app/api`, puerto 3001, usuario `node`, `HEALTHCHECK` contra su propio endpoint);
  - `production` copia `packages/contracts` (O-3);
  - todas las etapas con `npm ci` copian `api/package.json`;
  - `test` ejecuta `npm test` desde `/app`.
- **`deploy/compose.prod.yaml`:** servicio `api` solo en la red `db`, sin `ports` ni `labels`, con imagen por defecto `ghcr.io/orvigas/restaurante-api:sin-desplegar` (P-2 A), healthcheck, `read_only`, `cap_drop` y `no-new-privileges`. `app` recibe `API_INTERNAL_URL: http://api:3001`.
- **`deploy/deploy.sh`:**
  - 6 argumentos (tres digests); valida el de la api y rechaza la forma de 2 digests;
  - `pull` de la api;
  - paso 5a: si la `api` no queda healthy, vuelve a la anterior y termina con el código 15 sin tocar la app;
  - la vuelta atrás de la app devuelve también la api anterior si existe;
  - `release.env` y `releases.log` registran la api.
- **`deploy/ci/smoke.sh`:**
  - tercera imagen y tres digests;
  - comprobaciones de CA-8 (red, labels, puertos, routers);
  - llamada de la app a la api por la red interna;
  - `landing_products_loaded` con `source:"api"`;
  - un cambio en la base que se ve en la landing a través de la api;
  - con la api parada, `/`, `/molotes` y `/birria` responden 200;
  - una api rota termina con 15;
  - imagen `api-newer` para la prueba D-1.
- **`deploy/ci/resumen.sh` y su prueba:** `API_DIGEST` y el código 15.
- **`.github/workflows/ci.yml`:**
  - **`docker`:** construye `api`, comprueba el contenido de las imágenes (`contracts` y Zod), levanta la api y comprueba que queda healthy, y verifica que `app-ca9` la usa (`landing_products_loaded` con `source:"api"`).
  - **`despliegue`:** construye `api` y ejecuta el smoke con tres imágenes.
  - **`publish`:** publica `restaurante-api` y expone `api-digest`.
  - **`deploy`:** pasa `$API_DIGEST` en el comando SSH y al resumen.

**Documentación**
- `restaurante/docs/arquitectura.md`: §4 (excepción de P-1, O-2 y transición limitada), §6 (paso 3 aplicado), §8 ("Paso 3 aplicado"), §9 (A en el paso 3 y C aplicada, con la justificación de Zod) y §10 (riesgo de dependencia de la API y revisión de memoria con el 33,5 %, sin medición nueva, por decisión del usuario).
- `README.md`: monorepo, regla de dependencias, puesta en marcha, scripts, Docker, sección "API propia", configuración (`API_INTERNAL_URL`), CI y estructura.
- `docs/despliegue.md`: servicio `api`, tres imágenes y digests, paso 5a, código 15, diagnóstico, reinstalación de `deploy/` al llegar la épica a `main`, vuelta atrás manual de la api y runbook de restauración en un VPS nuevo (P-2 A).
- `docs/desarrollo.md` y los `.env.example` de `landing-pages` y `api`.

**Pruebas nuevas**
- `api/tests`:
  - `integration/products-endpoint.test.ts`: CA-2, CA-3 y el log;
  - `unit/config.test.ts`;
  - `unit/contract-types.test.ts`: equivalencia de tipos entre el contrato y `PublishedProducts`, y de los ids con `BUSINESS_IDS`.
- `landing-pages/tests`:
  - `unit/public-client.test.ts`;
  - `unit/landing-products.test.ts`: caché, invalidación, vuelo único, último bueno, semilla igual a `toPublished` de la importación, y log limitado;
  - `integration/landing-html-reference.test.ts`: CA-1;
  - `integration/landing-products-api.test.ts`: CA-4 a CA-7;
  - `integration/api-process.test.ts`: proceso real de la api con MySQL, para CA-2, CA-3, el 503 con proxy TCP y CA-10;
  - casos nuevos en `unit/dependency-rule.test.ts` (CA-9), `unit/config.test.ts` e `integration/server-startup-config.test.ts` (CA-15);
  - soporte: `support/landing-products.ts` (adaptador en memoria y caché real) y `support/products-api-double.ts` (doble HTTP de la API);
  - las llamadas a `createApp` se adaptaron de forma mecánica.

**Referencia de CA-1**
- 6 HTML distintos más `manifest.json` (21 entradas: ruta, día, archivo y SHA-256) en `landing-pages/tests/snapshots/landing-html/` (380 KB).
- Se generaron con el código del commit base `769ad8b`, con el árbol sin cambios: la generación se hizo antes de tocar código, en lugar de en un worktree, porque el contenido es idéntico.
- Generador temporal (no versionado): `createApp` con `makeRepository()`, `makeProductRepository()` (semilla importada), `makeConfig({ NODE_ENV: 'development' })` y `now = 2026-10-23T18:00:00Z`, pidiendo `${ruta}?dia=${día}`.
- SHA-256 de los archivos:

  | Ruta | Días | SHA-256 |
  | --- | --- | --- |
  | `/` | lunes | `0196111b…167d3` |
  | `/` | martes a viernes | `8f2808c0…d55eb` |
  | `/` | sábado y domingo, igual que `/birria` todos los días | `93d6dade…74fab` |
  | `/molotes` | lunes | `a46e35f7…197bc` |
  | `/molotes` | martes a viernes | `daaf1f88…1504b` |
  | `/molotes` | sábado y domingo | `099f192b…6cef` |

  Los hashes completos están en `manifest.json`.

### Criterios de aceptación

| CA | Estado | Evidencia |
| --- | --- | --- |
| CA-1 | Cumplido | `landing-html-reference.test.ts`: las 21 respuestas son iguales byte a byte a la referencia del código anterior, con los productos llegando por HTTP desde el doble |
| CA-2 | Cumplido | `products-endpoint.test.ts` (200, esquema, 404, 405 con `Allow`, 503 sin stack/SQL/credenciales) y `api-process.test.ts` (proceso real: cuerpo igual a `toPublished` de la base, 503 con la base cortada y recuperación) |
| CA-3 | Cumplido | En memoria y con MySQL real: un cambio en la base se ve en la petición siguiente |
| CA-4 | Cumplido | `landing-products-api.test.ts`: crear, editar, ocultar, eliminar, recuperar y reordenar desde `/admin/api` (Birria) y desde `/admin` HTML (Molotes). Cada operación provoca una petición nueva a la API del negocio y ninguna del otro, y el HTML cambia |
| CA-5 | Cumplido | Modos `down`, `slow`, `invalid` y `http503`: 200 con la última copia, evento con su motivo y recuperación sin reiniciar. En producción simulada (smoke), con la api parada, `/birria` sirve la última copia |
| CA-6 | Cumplido | Arranque con la API caída: semilla, eventos `source: seed` y datos de la API al levantarla |
| CA-7 | Cumplido | Esas pruebas comprueban 200 en `/`, `/molotes` y `/birria`; el smoke también, con la api parada |
| CA-8 | Cumplido (P-3 A) | `compose.prod.yaml` y el smoke: `api` solo en `db`, sin `ports` ni `labels`, sin puerto en el host y routers solo en `app` |
| CA-9 | Cumplido (P-1 A) | `dependency-rule.test.ts`: 61 casos, entre ellos landings sin `db`/Prisma/`mariadb`/`identity`/`bot-control`/persistencia de `catalog`/repositorio, O-2 en `src` y `tests`, `api` sin apps, y `/admin` y el bot con `core` y `db` |
| CA-10 | Cumplido | `api-process.test.ts`: api y landing-pages arrancan a la vez contra una base recién migrada; `product_import` tiene 2 filas; no hay `products_init_failed`; la landing carga de la API; `api/src` no contiene importación ni escrituras |
| CA-11 | Cumplido en local, pendiente del CI | Imágenes `production` y `api` con `contracts` y Zod (comprobado con las órdenes del job `docker`). `api` y `app` en `db-test`: las dos healthy y `landing_products_loaded` con `source: api`. Smoke completo en verde en local, dentro de un contenedor Linux |
| CA-12 | Cumplido | `deploy.sh` exige y valida 3 digests y rechaza 2 (smoke). El workflow publica `restaurante-api` y pasa su digest. La suma de `deploy/` cambia (`485616fd…e6a6b`). `docs/despliegue.md` §1.3 documenta la reinstalación |
| CA-13 | Cumplido | `zod` solo en `packages/contracts/package.json`; `product-schema.ts` sin cambios; justificación en `arquitectura.md` §9 y en el plan |
| CA-14 | Cumplido | La suite anterior completa pasa (bot, `/admin`, `/admin/api` e importación); solo cambió el cableado de `createApp` |
| CA-15 | Cumplido | `config.test.ts` (ausente, vacía e inválidas, sin repetir el valor) y `server-startup-config.test.ts` (código 1 y sin escuchar); documentada en `.env.example` y el README |
| CA-16 | Cumplido en local, pendiente del CI | `typecheck`, `lint` y `test` terminan con 0 en la raíz. El CI del PR hacia `epic/arquitectura` se comprobará en T4 |
| CA-17 | Cumplido | §4, §6, §8, §9 y §10 y el README, según RF-11 (§10 registra la revisión con el 33,5 %) |

### Validaciones ejecutadas

| Orden (desde `restaurante/`) | Resultado |
| --- | --- |
| `npm run typecheck` | 0 errores (todos los workspaces, incluido `api`) |
| `npm run lint` | 0 errores y 0 avisos |
| `npm test` | `api`: 3 archivos y 33 pruebas en verde. `landing-pages`: 99 archivos, 2096 en verde y 1 fallo esperado (había 94 archivos, 2011 en verde y 1 fallo esperado) |
| `npm run audit:deps` | 0 tras subir Zod a 4.6.7. Con 4.6.5 falló: GHSA-mrhx-c7xc-m3w5 |
| `docker build --target api`, `production` y `migrate` | Correcto (arm64 local) |
| Comprobaciones del job `docker` en local | Contenido de las imágenes correcto; `api` y `app` healthy en `db-test`; `/molotes` 200; `landing_products_loaded` con `source: api` |
| `deploy/ci/smoke.sh` con 3 imágenes (contenedor `docker:cli` con el socket, en macOS) | "todas las comprobaciones pasaron" (exit 0) |
| `deploy/ci/resumen-test.sh` | Todas las comprobaciones pasaron |
| `shellcheck` (imagen `koalaman/shellcheck`) de `deploy.sh`, `01-usuarios.sh`, `smoke.sh`, `resumen.sh` y `resumen-test.sh` | Sin avisos |
| `ops/backup/ci/smoke.sh` en local | La producción simulada (compose con la imagen por defecto de la api, app healthy) pasó. La subida al S3 local falló, porque en macOS ese S3 escucha en el 127.0.0.1 del host y no en el del contenedor runner: es una limitación del entorno local, no del cambio. En Linux (CI) no aplica |
| `build:css` | No hace falta: no cambiaron estilos ni plantillas |

### Archivos afectados

- **Nuevos:**
  - `restaurante/api/` (`package.json`, `tsconfig.json`, `vitest.config.ts`, `.env.example`, `scripts/dev-server.ts`, `src/{app,config,server}.ts`, `tests/...`);
  - `restaurante/packages/contracts/{products,public-client}.ts`;
  - `restaurante/packages/core/catalog/published.ts`;
  - `restaurante/landing-pages/src/services/landing-products.ts`;
  - las pruebas y el soporte nuevos;
  - `tests/snapshots/landing-html/`.
- **Modificados:**
  - `.github/workflows/ci.yml`;
  - `restaurante/{package.json,package-lock.json,eslint.config.ts,README.md}`;
  - `docs/{arquitectura,despliegue,desarrollo}.md`;
  - `deploy/{compose.prod.yaml,deploy.sh,ci/smoke.sh,ci/resumen.sh,ci/resumen-test.sh}`;
  - `landing-pages/{Dockerfile,.env.example}`;
  - en `landing-pages/src`: `{app,server}.ts`, `config/env.ts`, `controllers/landing.ts`, `routes/index.ts` y `repositories/product-repository.ts`;
  - `landing-pages/scripts/bot-chat.ts`;
  - `packages/contracts/{index.ts,package.json}`, `packages/core/catalog/index.ts` y `packages/db/src/database-config.ts`;
  - 20 archivos de pruebas existentes (cableado de `createApp`, `VALID_ENV`, configuración y regla de dependencias).
- **Tamaño:** unas 3.000 líneas añadidas y 300 eliminadas (sin el lockfile ni las referencias HTML).

### Riesgos o pendientes

- **Desviación 1 (Zod).** El plan preveía 4.6.5 si la 4.6.7 no cumplía las dos semanas. Se instaló 4.6.5, pero `audit:deps` la rechazó (aviso high, corregido en 4.6.6). Cuando se repitió la comprobación (17:13 UTC) la 4.6.7 ya cumplía las dos semanas, así que queda **4.6.7**, que es lo que pedía el plan original. Las imágenes del smoke local se construyeron con 4.6.5; el CI las reconstruirá con 4.6.7, y las pruebas en local ya corren con 4.6.7.
- **Desviación 2 (`api` sin `@koa/router`).** Una sola ruta con su 405 y su error JSON se resuelve con un middleware de Koa más simple. No se añade la dependencia al workspace.
- **Desviación 3 (referencia de CA-1).** Se generó en el árbol de trabajo antes de cualquier cambio (idéntico a `769ad8b`), no en un worktree. Para regenerarla: worktree de `769ad8b`, la prueba temporal descrita arriba y comparación de los SHA-256.
- **Desviación 4 (pruebas con MySQL de la API).** Están en `landing-pages/tests/integration/api-process.test.ts`, que arranca `../api/src/server.ts` como proceso hijo sin importarlo, para reutilizar el soporte y la salvaguarda de las bases de prueba. Las de `api/tests` usan el store en memoria.
- **Pendientes de T4:** el CI real (amd64) del PR hacia `epic/arquitectura`.
- **Pendiente al llegar la épica a `main`:** reinstalar `deploy/` en el VPS antes del primer despliegue. El token de GHCR debe leer `restaurante-api`.
- **Riesgo asumido (R-T4).** Con la base recién migrada, `api` devuelve listas vacías antes de la importación de `landing-pages`. No afecta, porque las landings piden a la API después de su propio `products.init`.

### Correcciones de la ronda 1 de QA (T3)

Decisión del usuario: DEF-001 "Corregirlo (Recomendado)"; DEF-002 y DEF-003 "Corregir DEF-002, Corregir DEF-003".

- **DEF-001 (MAJOR): código 15 y app sin `DATABASE_ALLOW_NEWER_SCHEMA`** (`deploy/deploy.sh`).
  - **Detección:** `applied_migrations()` lee, con el usuario de respaldo (solo lectura) y un archivo de opciones temporal, el número de migraciones terminadas y la última (`<n>:<última>`). Se lee antes y después del paso 4.
  - **Con migraciones nuevas:** si la api nueva falla y el despliegue aplicó migraciones (o no se pudieron leer), la app en marcha se recrea con su misma imagen (la del contenedor) y `DATABASE_ALLOW_NEWER_SCHEMA=true`, como en la vuelta atrás D-1. Se espera a que quede `healthy` y responda por Traefik.
    - Termina con 15 y el mensaje lo dice.
    - Si la app recreada no queda sana, termina con 22 (`api_failed_app_unhealthy`).
  - **Sin migraciones nuevas:** la app no se toca, como hasta ahora.
  - **Justificación de recrear la app:** es la única forma de que el contenedor arranque con la bandera. Supone unos segundos sin servicio solo en el caso raro de que coincidan una migración nueva y una api rota, frente a una caída total de las landings en el siguiente reinicio de la app.
  - **Códigos 0, 13, 21 y 22:** no cambian. Las pruebas del smoke siguen en verde.
  - **`resumen.sh`:** el mensaje del código 15 describe los dos casos.
  - **`docs/despliegue.md`:** el paso 6 y la fila del código 15 están actualizados. El README (tabla del CI) también.
  - **`smoke.sh`:** caso nuevo. Una migración nueva con la api rota termina con 15; la app se recrea con la misma imagen y la bandera; tras `docker restart` de la app, queda `healthy` y responde 200 por Traefik.
- **DEF-002 (MINOR): la imagen de la api tras una restauración.** `ops/` no cambia (P-2 A).
  - **`docs/despliegue.md` §6**, sección nueva "Imagen de la `api`": tras `restore.sh` no está en `state/release.env`. Se toma, por orden, del contenedor en marcha (`docker inspect`), de `state/release.env.previous` o de la última línea `api=` de `state/releases.log`. Se añade el aviso de nombrar siempre el servicio para no resolver la imagen `sin-desplegar`.
  - **§11.7 (VPS nuevo):** corregido para que no contradiga a `restore.sh`.
  - **`deploy.sh`:** si `release.env` no tiene la api anterior, toma la del contenedor `api` en marcha (solo si es un digest), así que la vuelta atrás de un código 15 ya no depende de la línea borrada.
- **DEF-003 (MINOR): aviso de `/admin`.**
  - **`LandingProducts.confirmFresh(negocio)`:** espera, como mucho el límite del cliente (1,5 s), a que la caché cargue la generación vigente y devuelve si lo consiguió.
  - **`admin-products.ts` (`update`):** redirige a `?ok=product_saved` (el texto de siempre, "La landing ya muestra los datos nuevos.") solo si la caché tiene el cambio. Si no, redirige a `?ok=product_saved_pending`: "Producto guardado. La landing lo mostrará en cuanto la API de productos vuelva a responder; mientras tanto sigue mostrando los datos anteriores."
  - `/admin` nunca falla por la API.
  - El aviso `save` (hero y promociones) sigue siendo cierto, porque esos datos no pasan por la API.
  - El HTML de las landings no cambia (CA-1 en verde).
  - **Pruebas:**
    - `landing-products-api.test.ts` (DEF-003): con la API disponible, `product_saved` y la landing actualizada; con la API caída, `product_saved_pending`, sin el texto "ya muestra", y la landing con la copia anterior y 200;
    - `landing-products.test.ts` (`confirmFresh`): sin pendientes no pide nada; tras una invalidación espera y devuelve `true` o `false` según la API.

**Validaciones de la ronda 1**

| Orden | Resultado |
| --- | --- |
| `npm run typecheck` | 0 errores |
| `npm run lint` | 0 errores y 0 avisos |
| `npm test` | `api`: 3 archivos y 33 en verde. `landing-pages`: 99 archivos, 2098 en verde y 1 fallo esperado (+2 pruebas nuevas) |
| `shellcheck` de `deploy.sh`, `01-usuarios.sh`, `smoke.sh`, `resumen.sh` y `resumen-test.sh` | Sin avisos |
| `deploy/ci/resumen-test.sh` | Todas las comprobaciones pasaron |
| `deploy/ci/smoke.sh` en local (imágenes reconstruidas con el código actual y Zod 4.6.7; runner `docker:cli` en macOS) | "todas las comprobaciones pasaron", incluido el caso DEF-001 |
| Suma de `deploy/` | Recalculada: `76103d8931cba2dc231de569ea5d549558897bddc855c750b20d82137c3a0420` (antes `485616fd…e6a6b`) |

**Archivos de la ronda 1:** `deploy/deploy.sh`, `deploy/ci/smoke.sh`, `deploy/ci/resumen.sh`, `docs/despliegue.md`, `README.md`, `landing-pages/src/services/landing-products.ts`, `src/controllers/admin.ts`, `src/controllers/admin-products.ts`, `src/views/admin/index.ts`, `src/app.ts`, `tests/support/landing-products.ts`, `tests/unit/landing-products.test.ts` y `tests/integration/landing-products-api.test.ts`.

## QA Action Plan

Aprobado por el usuario el 2026-10-26, incluidos el entorno aislado y el `npm ci` con red en un directorio temporal. Respuesta textual: "Si".

Fase Q1 (senior-qa, 2026-10-26). Implementación aprobada por el usuario ("Si"). Rama `feature/REQ-F-038-api-publica-productos` sobre `769ad8b`, sin commit. Exploración con CodeGraph (`createLandingProducts`, `createPublicApiClient`, `createApiApp`, `loadApiConfig`, `server.ts` de las dos apps y blast radius). Lectura dirigida de los diffs de `compose.prod.yaml`, `deploy.sh`, `Dockerfile`, `eslint.config.ts` y del workflow.

### Objetivo

Comprobar con evidencia que:

- las landings obtienen los productos de `api` sin ningún cambio de HTML;
- el endpoint cumple el contrato y no filtra detalles internos;
- un cambio en `/admin` se ve al instante;
- ningún fallo de la API produce un 5xx;
- `api` solo vive en la red interna;
- el despliegue exige tres digests;
- `/admin`, el bot y la importación no cambian de comportamiento.

### Requisito bajo prueba

RF-1 a RF-11, RN-1 a RN-4 y CA-1 a CA-17 del ticket, con las decisiones P-1 A, P-2 A y P-3 A. Desviaciones declaradas que también se validan:

1. Zod 4.6.7 en lugar de 4.6.5.
2. `api` sin `@koa/router`.
3. Referencia de CA-1 generada en el árbol de trabajo, no en un worktree.
4. Pruebas con MySQL de la API dentro de `landing-pages`.

### Criterios de aceptación

| CA | Pruebas que lo cubren |
| --- | --- |
| CA-1 | F-1 (regeneración independiente desde `769ad8b`), F-2 (E2E con procesos reales: servidor base contra servidor nuevo, 21 combinaciones) y la suite (`landing-html-reference.test.ts`) |
| CA-2 | E-1 a E-6 contra el proceso real de `api` y `api-process.test.ts` |
| CA-3 | E-7 |
| CA-4 | N-1 (navegador, con un usuario QA en `/admin`), N-2 (`/admin/api` con `curl`) y la suite (`landing-products-api.test.ts`) |
| CA-5 | R-2 a R-7 |
| CA-6 | R-1 |
| CA-7 | R-8 (registro de estados durante R-1 a R-7) |
| CA-8 | D-1 y D-2 |
| CA-9 | L-1 a L-3 |
| CA-10 | O-1 y O-2 |
| CA-11 | D-3 y D-4 en local. **El veredicto final queda para el CI** |
| CA-12 | P-1 a P-4 |
| CA-13 | Z-1 |
| CA-14 | G-1 a G-4 |
| CA-15 | C-1 y C-2 |
| CA-16 | Q-1 en local. **El CI completo queda para T4** |
| CA-17 | DOC-1 |

### Riesgos identificados

- **RQ-1. Referencia de CA-1 no independiente.** La generó el mismo agente que implementó, en el árbol de trabajo. Mitigación: F-1 y F-2.
- **RQ-2. Caché.** Pueden aparecer carreras entre invalidación y vuelo, el TTL puede tapar el "al instante" o el refresco puede quedar bloqueado tras un fallo, porque `failedGeneration` impide esperar.
- **RQ-3. Límites del cliente.** Hay que confirmar que el `AbortSignal.timeout` también corta un cuerpo que llega a goteo, el límite de 1 MiB sin `Content-Length`, que no se sigue ninguna redirección y que un `Content-Type` que no es JSON se rechaza.
- **RQ-4. Regla de dependencias.** El orden de los bloques de `eslint.config.ts` cambió (flat config: el último bloque que coincide con el archivo reemplaza la regla). Puede haberse perdido en silencio una restricción anterior en `landing-pages/src` o en `tests`.
- **RQ-5. `deploy.sh` con código 15.** Las migraciones ya se aplicaron y la `app` vieja sigue en marcha sin `DATABASE_ALLOW_NEWER_SCHEMA`. Si se reinicia, su `verifyDatabase` podría rechazar el esquema. Además, `release.env` no cambia. Hay que verificar si está documentado en el runbook.
- **RQ-6. `restore.sh` (P-2 A).** Reescribe `release.env` solo con `app` y `migrate`. Tras una restauración en el mismo VPS se pierde `RESTAURANTE_API_IMAGE`: un `docker compose up` manual usaría `sin-desplegar` y el siguiente código 15 no tendría una api anterior. Hay que verificar el impacto y la documentación.
- **RQ-7. Desarrollo.** `landing-pages/.env` local no tiene `API_INTERNAL_URL`, así que `npm run dev` fallará al arrancar hasta que se añada (CA-15 lo exige). Hay que verificar que el README lo explica. Además, `npm run dev` usa `& … & wait`: hay que comprobar que Ctrl+C detiene los dos procesos.
- **RQ-8. Fugas.** La URL interna o `DATABASE_URL` podrían aparecer en los logs o en los errores de `api` y de las landings.
- **RQ-9. Imágenes.** La etapa `api` instala las dependencias de todos los workspaces, `contracts` podría faltar en `production` y la `api` podría incluir el CLI de Prisma.

### Pruebas funcionales

**Endpoint (`api` real con `NODE_ENV=development`, contra la base QA):**

- **E-1.** `GET /api/v1/public/molotes/productos` y `.../birria/productos` responden 200, con `Content-Type: application/json; charset=utf-8`, `Cache-Control: no-store` y `X-Content-Type-Options: nosniff`. El cuerpo valida con `productsResponseSchemas` de `contracts` (script temporal) y coincide con `toPublished` de lo que hay en la base.
- **E-2.** `HEAD` responde 200 sin cuerpo.
- **E-3.** Responden 404 `BUSINESS_NOT_FOUND`: `xyz`, `MOLOTES`, `__proto__`, `constructor` y `%2e%2e`. Responden 404 `NOT_FOUND`: `/`, `/api/v1/public/molotes`, la barra final y `/api/v1/public/molotes/productos/x`. Todos con el formato `{ error: { code, message } }`.
- **E-4.** `POST`, `PUT`, `DELETE`, `PATCH` y `OPTIONS` responden 405 `METHOD_NOT_ALLOWED` con `Allow: GET, HEAD`, también con cuerpo JSON.
- **E-5.** 503 con la base caída: proxy TCP temporal entre `api` y MySQL, que se corta. La respuesta es 503 `DATABASE_UNAVAILABLE`, sin stack, SQL, host, usuario ni contraseña, en el cuerpo ni en el log (búsqueda de la contraseña y del host en la salida). Al restablecer el proxy vuelve el 200.
- **E-6.** La consulta (`?x=1`) se ignora (200).
- **E-7 (CA-3).** Se cambia un producto directamente en la base y la siguiente petición a la API devuelve el valor nuevo.

**Frescura (N-1 y N-2):** ver "Pruebas en navegador" e "Integración".

**Resiliencia, con `landing-pages` real y la API real detrás de un proxy de fallos temporal con modos `ok`, `down`, `slow`, `drip`, `invalid`, `503`, `redirect`, `html`, `big` y `big-chunked`, contador de peticiones y script fuera del repositorio:**

- **R-1 (CA-6).** Se arranca `landing-pages` con la API inaccesible:
  - arranca;
  - `/`, `/molotes` y `/birria` responden 200 con los productos de la semilla;
  - aparece `landing_products_fallback` con `source: seed`.

  Antes se modifica un producto en la base para distinguirla de la semilla. Al levantar la API, sin reiniciar, las landings pasan a los datos de la base y aparece `landing_products_recovered` o `loaded`.
- **R-2 (CA-5, API parada).** Con una copia buena cargada, se detiene la API: 200 con la última copia (el producto modificado, no la semilla) y el evento con `source: last_good`. Al restablecerla, se recupera sin reiniciar.
- **R-3 (lenta, más de 1500 ms).** La visita no espera más del límite: se mide con `curl -w %{time_total}`, también justo después de una invalidación (≤ ~1,6 s).
- **R-4 (inválida o 503).** El modo `invalid` (JSON que no cumple el esquema) y el modo `503` producen `reason: invalid_body` o `http_status` con `status: 503`, y se sirve la última copia.
- **R-5 (escritura con la API caída).** Se edita en `/admin` con la API parada: `/admin` responde con normalidad, la landing sirve la última copia y se registra el evento. Al volver la API, aparece el cambio.
- **R-6 (reinicio con la API caída).** Se usa la semilla (caso límite).
- **R-7 (log limitado).** Durante una caída de más de 1 minuto, `landing_products_fallback` aparece una vez al inicio y luego como mucho una vez por minuto. No contiene la URL ni datos.
- **R-8 (CA-7).** Durante R-1 a R-7, un bucle de peticiones a las 3 rutas registra los códigos: ningún 5xx.

### Pruebas negativas y casos límite

- **S-1 (seguridad del cliente, con el proxy de fallos):**
  - `redirect` (302 hacia el propio proxy con un contador): no se sigue y el motivo es `network`;
  - `html` (200 `text/html`): `invalid_body`;
  - `big` (más de 1 MiB con `Content-Length`) y `big-chunked` (sin `Content-Length`): `invalid_body`, sin consumir el cuerpo entero;
  - `drip` (cabeceras al momento y cuerpo a goteo): `timeout` a los ~1,5 s, sin colgar la visita.

  Todos los casos responden 200 con la última copia. Se revisa también la cobertura de `public-client.test.ts`.
- **S-2 (concurrencia).** Tras una invalidación, 20 visitas simultáneas a `/molotes` generan 1 sola petición a la API (contador del proxy), y a la de Birria, 0.
- **S-3.** `?dia=` actúa en desarrollo. En `test` y `production` lo cubre la suite: se revisa que exista la prueba y que pase.

### Pruebas de configuración (CA-15)

- **C-1.** Se arranca `landing-pages` con `API_INTERNAL_URL` en estos casos:
  - ausente;
  - vacía;
  - `ftp://x`;
  - `http://u:p@h:1`;
  - `http://h:1/?a=1`;
  - `http://h:1/#f`;
  - `nourl`.

  En todos termina con código 1, un mensaje claro y sin repetir el valor (se busca `u:p`, `a=1`, `nourl` y `ftp://x` en la salida). Con `http://127.0.0.1:3101/` (barra final), arranca normalizada.
- **C-2.** La configuración de `api` (`NODE_ENV`, `HOST`, `PORT` y `DATABASE_URL` inválidos) termina con 1 sin repetir los valores. La variable consta en los dos `.env.example` y en el README.

### Pruebas responsive

No hay cambios visuales: la conformidad la da CA-1 (HTML idéntico). Como prueba de humo en el navegador, `/`, `/molotes` y `/birria` a 375×812 y 1440×900:

- los productos se ven, sin overflow horizontal;
- el CTA de WhatsApp sigue visible;
- la consola no tiene errores.

### Pruebas de accesibilidad

Cubiertas por la identidad de HTML (CA-1). Con `read_page`, una comprobación rápida de un solo `h1` y de los landmarks en las dos landings (prueba de humo).

### Pruebas UX/UI (vs. _stich_source_/)

No aplica comparación nueva (fuera de alcance: ningún cambio visual). Lo cubre CA-1.

### Pruebas de integración (WhatsApp y /admin)

- **N-2 (CA-4 vía `/admin/api`, con `curl` y la sesión y el CSRF del usuario QA).** Crear, editar, ocultar, eliminar, recuperar y reordenar en Birria. Después de cada operación:
  - la siguiente petición a `/birria` refleja el cambio;
  - `/molotes` no cambia;
  - el contador de la API del otro negocio no sube.
- **W-1.** El `href` del CTA de WhatsApp en las dos landings es idéntico al de la base (incluido en F-2).

### Pruebas de performance

- **PF-1.** Con la caché fresca, una visita no hace ninguna petición a la API (contador del proxy). Como mucho hay un refresco de fondo por negocio cada 60 s, y uno cada 5 s durante una caída.
- **PF-2.** Tiempo de respuesta de las landings con la caché fresca, comparable al del servidor base (F-2), sin percepción subjetiva.
- **PF-3.** El tamaño de la respuesta de la API está muy por debajo de 1 MiB (se mide).

### Pruebas SEO

Cubiertas por CA-1: `title`, `meta`, `canonical` y Open Graph idénticos byte a byte.

### Pruebas de regresión

**Funcional:**

- **G-1.** `npm test` completo en la raíz (`api` y `landing-pages`). Se identifica el "1 fallo esperado" (que sea un `it.fails` previo y no un fallo real) y se compara el número de pruebas con la base.
- **G-2.** `/admin` en el navegador con el usuario QA: inicio de sesión, lista y edición de productos, y edición de página.
- **G-3.** El bot: `npm run bot:chat` con una conversación corta por la entrada estándar. Se revisa el cambio de `bot-chat.ts` al adaptador.
- **G-4.** Importación de semillas: solo en `landing-pages` (O-1).

**Regla de dependencias:**

- **L-1.** `npm run lint` termina con 0.
- **L-2.** `eslint --stdin --stdin-filename <archivo>` (sin escribir archivos) con imports prohibidos en:
  - `controllers/landing.ts`, `views/landings/x.ts` y `services/landing-products.ts`: `@restaurante/db`, `@restaurante/db/client`, `@prisma/client`, `mariadb`, `@restaurante/core/identity`, `@restaurante/core/bot-control`, `{ createMemoryProductStore }` y `{ toPublished }` de `@restaurante/core/catalog`, y `../repositories/product-repository.ts`. Deben fallar.
  - `@restaurante/contracts`, `@restaurante/core/schedule` y `{ formatPesos }`. Deben pasar.
  - Cualquier archivo de `landing-pages` (incluidos `src/controllers/admin.ts` y `tests/`) con `../../packages/core/catalog/price.ts`. Debe fallar.
  - `api/src/x.ts` con `../../landing-pages/src/app.ts` o `landing-pages`. Debe fallar.
  - `admin.ts` y el bot con `@restaurante/db`. Deben pasar.
- **L-3 (RQ-4).** `eslint --print-config` de archivos representativos (`src/app.ts`, `src/controllers/admin.ts`, `src/controllers/landing.ts`, `src/services/whatsapp-bot/orchestrator.ts`, `tests/support/http.ts` y un test de integración), comparado con el de la base (`769ad8b`, extraído con `git archive`). Ninguna restricción anterior debe desaparecer sin justificación.

**Arranque simultáneo (O-1):**

- **O-1.** Base QA nueva y recién migrada. Se lanzan `api` y `landing-pages` a la vez, 3 veces, cada una con una base nueva. En cada vez:
  - los dos registran `server_started`;
  - `product_import` tiene exactamente 1 fila por negocio;
  - no aparece `products_init_failed`;
  - la landing termina con `source: api`.
- **O-2.** Se revisa de forma estática que `api/src` no contiene `products.init`, `importBusiness`, `content/`, `seeds` ni métodos de escritura del store, con CodeGraph y Grep.

**Imágenes y compose:**

- **D-1 (CA-8).** `docker compose -f deploy/compose.prod.yaml config` con variables ficticias. El servicio `api`:
  - no tiene `ports` ni `labels`;
  - solo está en la red `db`, que es `internal: true`;
  - corre con `read_only`, `cap_drop: ALL` y `no-new-privileges`.

  `app` recibe `API_INTERNAL_URL=http://api:3001` y no tiene `depends_on: api`.
- **D-2.** Las labels y los routers `restaurante*` de `app` son idénticos a los de `compose config` de la base, y las imágenes `app` y `migrate` conservan sus nombres. También funciona `compose config` solo con `RESTAURANTE_APP_IMAGE` y `RESTAURANTE_MIGRATE_IMAGE` (camino de `ops/backup`, P-2 A).
- **D-3 (CA-11 local).** `docker build --target api`, `production` y `migrate` con Zod 4.6.7 (las imágenes del smoke del desarrollador usaban 4.6.5). Se comprueba el contenido con las mismas órdenes del job `docker`: `contracts` está, Zod se resuelve y la `api` no tiene el CLI de Prisma.
- **D-4 (CA-11 local).** Contenedor `api` en la red de `mysql-dev`, contra la base QA, hasta que queda `healthy`. Contenedor `production` con `API_INTERNAL_URL` hacia él:
  - `landing_products_loaded` con `source: api`;
  - desde el host no hay ningún puerto de `api`;
  - con `docker stop` de `api`, `/molotes` y `/birria` siguen respondiendo 200.

  Se eliminan los contenedores al terminar.

**Despliegue:**

- **P-1.** `deploy.sh` (validación de argumentos, antes de cualquier efecto) termina con 2 en estos casos:
  - con 5 argumentos (forma de 2 digests);
  - con el digest de `api` mal formado;
  - con 7 argumentos.

  No se ejecuta con argumentos válidos fuera del smoke.
- **P-2 (código 15).** Revisión del paso 5a: vuelta a la api anterior, `record api_failed` y `app` sin tocar. La vuelta atrás de `app` con y sin api anterior. Se verifican RQ-5 y RQ-6 en el código y en `docs/despliegue.md`. La ejecución real ("api rota termina con 15") la hace `smoke.sh` y **queda para el CI**. Si el entorno lo permite, se repite `smoke.sh` en local (contenedor `docker:cli`, como hizo el desarrollador). Si no, queda pendiente para el CI, sin bloquear la aprobación.
- **P-3.** `deploy/ci/resumen-test.sh` pasa, y `shellcheck` de `deploy.sh`, `smoke.sh` y `resumen*.sh` no da avisos.
- **P-4.** Revisión del workflow:
  - `publish` expone `api-digest`;
  - `deploy` pasa `$API_DIGEST` en el orden de `deploy.sh`;
  - `despliegue` ejecuta `smoke.sh` con 3 imágenes;
  - se recalcula la suma de `deploy/` con la misma orden que el workflow y se compara con la del ticket (`485616fd…e6a6b`).

**Calidad y dependencias:**

- **Z-1 (CA-13).** `zod` solo en `packages/contracts/package.json`, exacta en `4.6.7`. El lockfile resuelve 4.6.7. `npm run audit:deps` da 0. `git diff --stat -- '*product-schema.ts'` está vacío. La justificación consta en §9.
- **Q-1 (CA-16 local).** `npm run typecheck`, `npm run lint` y `npm test` con 0 en la raíz.

**Documentación:**

- **DOC-1 (CA-17).** Lectura dirigida de:
  - §4, §6, §8, §9 y §10 de `arquitectura.md` (§10 debe citar el 33,5 % por decisión del usuario);
  - el README: `API_INTERNAL_URL`, `npm run dev` con dos procesos, la sección "API propia" y la reinstalación de `deploy/`;
  - `docs/despliegue.md`: código 15, tres digests, runbook de restauración (RQ-5 y RQ-6);
  - `docs/desarrollo.md` y los dos `.env.example`.

  Se buscan contradicciones con el comportamiento observado.

### Pruebas automatizadas

- **Existentes, a ejecutar:** la suite completa (`npm test` en la raíz). Se revisa la calidad de:
  - `landing-html-reference.test.ts`;
  - `landing-products-api.test.ts`;
  - `landing-products.test.ts`;
  - `public-client.test.ts`;
  - `api-process.test.ts`;
  - `dependency-rule.test.ts`;
  - `products-endpoint.test.ts`.

  La revisión busca que no reproduzcan la implementación y que cubran los casos de RQ-2 y RQ-3.
- **Nuevas:** **no se prevé añadir pruebas al repositorio.** Las comprobaciones de QA usan scripts temporales en un directorio fuera del repositorio (`$TMPDIR/qa038/`), que se borran al terminar:
  - el generador de CA-1;
  - el proxy de fallos;
  - el proxy TCP;
  - el validador del esquema.

  Si en Q2 aparece un hueco de cobertura relevante, se registra como hallazgo para senior-fullstack, sin añadir la prueba.

### Pruebas en navegador

**Entorno local, sin tocar la base de desarrollo, los `.env` ni el estado de git:**

- Base QA dedicada `restaurante_test_qa038` en `mysql-dev`, creada y migrada con el usuario DDL de pruebas y borrada al final.
- `DATA_DIR` temporal.
- Usuario QA creado por el bootstrap (`ADMIN_USER=qa038` y un hash generado con `npm run admin:hash-password`).
- Procesos y puertos:
  - `api` en el 3101;
  - el proxy de fallos en el 3102;
  - `landing-pages` en el 3100, con `API_INTERNAL_URL=http://127.0.0.1:3102` y `NODE_ENV=development`;
  - el servidor base (F-2) en el 3200.
- Variables por línea de comandos (`--env-file-if-exists` no pisa las del entorno).

**Pruebas con Claude in Chrome (pestaña nueva):**

- **N-1 (CA-4 vía `/admin` HTML).** Con el usuario QA, en Molotes: crear, editar el precio, ocultar, eliminar, recuperar y subir o bajar un producto. Después de cada operación se recarga `/molotes`: el cambio se ve en la primera recarga, y `/birria` no cambia (también con el contador del proxy). No se pulsa nada que abra `confirm`: si eliminar lo usa, esa operación se hace con `curl`.
- **N-3 (API parada en el navegador).** Se detiene el proceso `api`:
  - `/`, `/molotes` y `/birria` se cargan con la última copia, sin página de error;
  - una edición en `/admin` no rompe `/admin`;
  - al levantar `api`, el cambio aparece sin reiniciar `landing-pages`.
- **Pruebas de humo:** responsive, `h1` y consola, como se describe arriba. Del CTA de WhatsApp solo se valida el `href`.
- Si la extensión no responde tras 2-3 intentos, N-1 y N-3 se ejecutan con `curl`, con la cookie de sesión y el CSRF, y la parte visual queda pendiente de revisión manual.

**CA-1:**

- **F-1.** `git archive 769ad8b` a un directorio temporal, con `npm ci` y `db:generate` allí. Si no hay red, se copia `node_modules` con sus enlaces relativos. Un generador propio, escrito por QA, monta `createApp` del código base con el repositorio de productos en memoria importado de la semilla, `NODE_ENV=development` y `now = 2026-10-23T18:00:00Z`, y pide las 21 combinaciones. Se compara el SHA-256 de cada respuesta con `manifest.json` y con los archivos de `tests/snapshots/landing-html/`.
- **F-2.** El servidor base (código de `769ad8b`, en el 3200) y el servidor nuevo (`api` y `landing-pages`), los dos contra la misma base QA y con la misma configuración y el mismo `DATA_DIR` de partida. Con `curl`, las 21 combinaciones (`?dia=`), comparadas byte a byte con `cmp`. Así se compara el HTML con datos reales llegando por la API real, no por el doble.

### Evidencia requerida

- La salida de `typecheck`, `lint`, `test`, `audit:deps`, `resumen-test.sh` y `shellcheck`.
- La tabla de SHA-256 de F-1 y el resultado de `cmp` de F-2 (21 de 21).
- Para cada caso E-x: estado, cabeceras y cuerpo, y el fragmento del log de E-5 sin datos sensibles.
- Para R-x y S-x: los códigos HTTP registrados, los tiempos, los eventos de log y los contadores del proxy.
- Para N-1 y N-3: el texto de la página o capturas.
- La salida de `compose config` filtrada (D-1 y D-2), las comprobaciones de las imágenes (D-3 y D-4) y los códigos de salida de `deploy.sh` (P-1).
- Para O-1: el conteo de `product_import` y el log de cada una de las 3 vueltas.
- Las citas de la documentación revisada.

### Criterios de aprobación

- **`QA_APPROVED`** si se cumplen todas estas condiciones:
  - CA-1 a CA-10, CA-12 a CA-15 y CA-17 pasan con evidencia local;
  - CA-11 y CA-16 pasan en la parte local, y su veredicto final queda explícitamente para el CI del PR (T4);
  - no hay defectos `BLOCKER`, `CRITICAL` ni `MAJOR` sin la decisión del usuario;
  - `npm test` pasa por completo (salvo el fallo esperado ya existente, si se confirma);
  - no hay ningún 5xx en las landings por un fallo de la API.
- **Queda para el CI del PR hacia `epic/arquitectura` (no lo puede cerrar QA en local):**
  - el job `docker` en amd64 (CA-11);
  - `smoke.sh` completo con tres imágenes, incluido el código 15 real (CA-11 y CA-12);
  - el smoke de respaldos (`ops/backup/ci/smoke.sh`, que falló en local por el S3 en macOS);
  - `calidad`, `despliegue` y `auditoria` (CA-16).
- **`QA_REJECTED`** si:
  - F-1 o F-2 dan alguna diferencia;
  - hay algún 5xx en R-x o S-x;
  - el endpoint expone detalles internos;
  - falla un CA;
  - la regla de dependencias perdió restricciones previas.
- **`NEEDS_USER_DECISION`** si RQ-5 o RQ-6 resultan defectos `MAJOR`, o si una validación imprescindible queda bloqueada por el entorno.

## QA Report

> Ronda 2: correcciones de la ronda 1 (T3) aprobadas por el usuario el 2026-10-26. Respuesta textual: "si".

### Ronda

1. Fecha: 2026-10-26. Sobre el árbol de trabajo de `feature/REQ-F-038-api-publica-productos` (`769ad8b` más los cambios sin commit).

**Entorno aislado, ya eliminado:**
- bases `restaurante_test_qa038` y `_o1` a `_o3` en `mysql-dev`;
- `DATA_DIR` temporales;
- el usuario QA `qa038` creado por el bootstrap;
- `api` en el 3101, detrás de un proxy TCP hacia MySQL (3308);
- un proxy de fallos en el 3102;
- `landing-pages` en el 3100;
- el servidor base en el 3200.

No se tocaron el estado de git (61 entradas, igual que al inicio), la base de desarrollo, los `.env` ni el código de producción.

### Pruebas ejecutadas

| Prueba | Resultado |
| --- | --- |
| `npm run build:css`, `typecheck` y `lint` (raíz) | 0, 0 y 0 (lint sin avisos) |
| `npm test` (raíz) | `api`: 3 archivos y 33 pruebas en verde. `landing-pages`: 99 archivos, 2096 en verde y 1 `expected fail`, el mismo `it.fails` que ya existía en `769ad8b` (archivos idénticos en la base) |
| `npm run audit:deps` | 0 ("Ninguno") |
| `deploy/ci/resumen-test.sh` | "todas las comprobaciones pasaron" |
| `shellcheck` v0.10.0 de `deploy.sh`, `ci/smoke.sh`, `ci/resumen.sh` y `ci/resumen-test.sh` | Sin avisos (rc 0) |
| F-1: `git archive 769ad8b`, `npm ci` y `db:generate` en un directorio temporal, más un generador propio de QA (repositorio en memoria con la semilla, `NODE_ENV=development`) | 21 de 21 SHA-256 iguales a `manifest.json` y a los archivos de referencia, con dos relojes distintos (viernes 2026-10-23 y domingo 2026-10-25): el HTML no depende del reloj, solo de `?dia=` |
| F-2: servidor base (`769ad8b`) contra servidor nuevo (`api` real), misma base con datos modificados (productos renombrados, creados, reordenados y ocultos) | `cmp` idéntico en 21 de 21 combinaciones (3 rutas × 7 días) |
| E-1 a E-7: endpoint real | Ver CA-2 y CA-3 |
| N-2 y N-1: CA-4 por `/admin/api` y por `/admin` HTML en el navegador | Ver CA-4 |
| R-1 a R-8 y S-1: proxy de fallos con los modos `down`, `slow`, `drip`, `invalid`, `badjson`, `503`, `redirect`, `html`, `big` y `big-chunked` | Ver CA-5 a CA-7 |
| S-2: 20 visitas simultáneas tras una invalidación | 1 petición a la API (modos `ok` y `slow`), 0 a la del otro negocio |
| C-1 y C-2: configuración | Ver CA-15 |
| L-1 a L-3: lint | Ver CA-9 |
| O-1: arranque simultáneo, 3 vueltas con bases nuevas | Ver CA-10 |
| D-1 y D-2: `docker compose config` | Ver CA-8 |
| D-3 y D-4: imágenes `qa038:{api,production,migrate}` (Zod 4.6.7) y contenedores en `restaurante_db-test` | Ver CA-11 |
| P-1: `deploy.sh` | 5 argumentos (2 digests): rc 2 "uso…". 7 argumentos: rc 2. Digest de api `BAD` o `sha256:xyz`: rc 2 "digest de la api inválido". 6 argumentos válidos: no se ejecutó, como estaba planificado |
| P-4: suma de `deploy/` con la orden del workflow | `485616fd…e6a6b`, igual que en el ticket (base: `dd2dc90d…72b30`). El workflow pasa `deploy $GITHUB_SHA $APP_DIGEST $MIGRATE_DIGEST $API_DIGEST $sum`, en el orden de `deploy.sh` |
| G-3: `bot-chat.ts` (stdin) | Responde con el saludo y el menú. Usa el adaptador de `tests/support`, pero no entra en la imagen `production` (`scripts/` solo tiene `admin-recover.ts`, `hash-password.ts` y `support/`) |
| RQ-5 (demostración): una migración desconocida en una base QA y el arranque de la app sin `DATABASE_ALLOW_NEWER_SCHEMA` | Termina con 1 (`database_init_failed`, `DATABASE_NEWER_THAN_CODE`). Con `true`, arranca |
| DOC-1 | Lectura dirigida de `arquitectura.md` (§4, §6, §8 "Paso 3 aplicado", §9 y §10 con el 33,5 %), README (l. 122-131, 341-350, 483, 692), `desarrollo.md` (l. 60-74, 136-155) y `despliegue.md` (l. 61-112, 366-378, 463, 700-716) |

### Criterios de aceptación

| CA | Resultado | Evidencia |
| --- | --- | --- |
| CA-1 | PASS | F-1: 21 de 21 SHA-256 de la referencia regenerados de forma independiente desde `769ad8b`. F-2: 21 de 21 `cmp` idénticos entre el servidor base y el nuevo con la API real y datos no semilla. La suite (`landing-html-reference.test.ts`) también está en verde |
| CA-2 | PASS | **200 y cabeceras:** `molotes` y `birria` responden 200 con `application/json; charset=utf-8`, `no-store` y `nosniff`. Los cuerpos validan `productsResponseSchemas` y son iguales a `toPublished(store.listBusiness())` de la base (8+2 y 6 productos).<br>**HEAD:** 200 sin cuerpo.<br>**404 `BUSINESS_NOT_FOUND`:** `xyz`, `MOLOTES`, `__proto__`, `constructor`, `toString` y `%2e%2e`.<br>**404 `NOT_FOUND`:** `/`, sin `/productos`, barra final, subruta y negocio vacío.<br>**405:** `POST`, `PUT`, `DELETE`, `PATCH` y `OPTIONS`, con `Allow: GET, HEAD`.<br>**Consulta:** `?x=1` responde 200.<br>**503 `DATABASE_UNAVAILABLE`:** con el proxy TCP cortado (~5 s, el `acquireTimeout` del pool). El log solo lleva `name: DatabaseUnavailableError` y `code: P2039`; 0 apariciones de la contraseña, los puertos, el usuario, SQL o el stack. Al restablecer el proxy, 200 |
| CA-3 | PASS | `UPDATE` directo en la base: la siguiente petición a la API devuelve el nombre nuevo |
| CA-4 | PASS | **`/admin/api` (Birria):** crear (201), editar, ocultar, mostrar, eliminar, recuperar y reordenar.<br>Tras cada operación:<br>- exactamente 1 petición a la API de Birria y 0 a la de Molotes;<br>- `/molotes` idéntico;<br>- `/birria` coherente con la base: un producto creado o recuperado queda "no disponible" y no se pinta, como en la base; al mostrarlo aparece; el nuevo nombre y el precio 99.50 se ven en la primera visita; el orden queda invertido.<br>**`/admin` HTML en el navegador (Molotes):** "Bajar", editar el nombre y desmarcar "Disponible". Cada cambio se ve en la primera recarga de `/molotes`, con 1 petición a la API de Molotes y 0 a la de Birria. Eliminar y recuperar desde el HTML los cubre `landing-products-api.test.ts` |
| CA-5 | PASS | Con una copia buena, en cada modo (`down`, `slow` > 3 s, `drip`, `invalid`, `badjson`, `503`, `redirect`, `html`, `big` y `big-chunked`), después de una escritura en `/admin`:<br>- 200 con la última copia (no la escritura nueva ni la semilla);<br>- evento `landing_products_fallback` con `source: last_good` y su motivo (`network`, `timeout`, `invalid_body`, o `http_status` con `status 503`);<br>- al volver a `ok`, el cambio aparece sin reiniciar (`landing_products_recovered`).<br>Con el proceso `api` detenido de verdad (N-3 en el navegador), `/molotes` sirve la última copia y vuelve sola al levantar `api` |
| CA-6 | PASS | `landing-pages` arranca con la API inaccesible: `landing_products_fallback` `source: seed` para los dos negocios y 200 en las 3 rutas. Con un producto cambiado en la base, al levantar la API se muestra en ~2 s sin reiniciar (`landing_products_recovered`). Repetido tras reiniciar con la API caída (R-6): semilla y después datos |
| CA-7 | PASS | Bucle de 8616 peticiones a `/`, `/molotes` y `/birria` durante toda la ronda: 8604 con 200 y 12 con `000` (conexión rechazada mientras se reiniciaba `landing-pages` en R-6). **Ningún 5xx**; los logs de `request` no tienen ningún `status` 5xx |
| CA-8 | PASS (P-3 A) | `compose config`:<br>- `api` sin `ports` ni `labels`, solo en la red `db` (`internal: true`), con `read_only`, `cap_drop: ALL`, `no-new-privileges`, `depends_on: mysql` y el usuario `restaurante_app`;<br>- servicios en `db`: `api`, `app` y `mysql`; labels de Traefik solo en `app`; ningún servicio con `ports`;<br>- las labels y los routers de `app` son iguales a los de la base, y `app` solo gana `API_INTERNAL_URL=http://api:3001`, sin `depends_on: api`;<br>- sin `RESTAURANTE_API_IMAGE`, la imagen es `…restaurante-api:sin-desplegar` (P-2 A).<br>El contenedor `api` no tiene puertos en el host (`docker port` vacío) |
| CA-9 | PASS (P-1 A) | `eslint --stdin` en `controllers/landing.ts`, `views/landings/index.ts` y `services/landing-products.ts`:<br>- **rechazados:** `@restaurante/db`, `@restaurante/db/client`, `@prisma/client`, `mariadb`, `core/identity`, `core/bot-control`, `{createMemoryProductStore}` y `{toPublished}` de `core/catalog`, el repositorio de productos, y `../packages/...` relativo;<br>- **permitidos:** `contracts`, `core/schedule` y `{formatPesos}`.<br>O-2 rechazado también en `controllers/admin.ts` y en `tests/`. `api` rechaza `../../landing-pages/...`, `landing-pages` y `../../packages/...`. `/admin` y el bot siguen pudiendo importar `@restaurante/db/client` y `core/identity`.<br>L-3: `--print-config` de 11 archivos representativos, comparado con `769ad8b`: **ninguna** regla, patrón ni ruta perdidos |
| CA-10 | PASS | 3 vueltas con bases nuevas y `api` y `landing-pages` lanzados a la vez. En cada una:<br>- `server_started` en los dos;<br>- `product_import`: molotes 1 y birria 1;<br>- `products_init_failed`: 0;<br>- `landing_products_loaded` con `source: api` en los dos negocios.<br>`api/src` no contiene `products.init`, `importBusiness`, `content/`, semillas ni escrituras (Grep y CodeGraph) |
| CA-11 | PASS en local; **pendiente del CI** | `qa038:production` contiene `contracts` y exporta `createPublicApiClient`. `qa038:api` cumple las órdenes del job `docker`:<br>- WORKDIR `/app/api`, `contracts`, `core`, el cliente Prisma generado y las migraciones;<br>- sin el CLI de Prisma;<br>- Zod 4.6.7;<br>- usuario `node`, `EXPOSE 3001` y `HEALTHCHECK` al endpoint.<br>En `restaurante_db-test`, `api` queda `healthy`. `production` también queda `healthy`, con `landing_products_loaded` `source: api`; desde el contenedor, `wget http://qa038-api:3001/...` devuelve JSON. Con `docker stop` de la api, `/`, `/molotes` y `/birria` responden 200. `?dia=` se ignora en producción. El job `docker` en amd64 y `smoke.sh` quedan para el CI |
| CA-12 | PASS (con el defecto DEF-001 en el camino del código 15) | `deploy.sh` rechaza la forma de 2 digests (rc 2) y un digest de api mal formado (rc 2). El workflow publica `restaurante-api` (`api-digest`) y lo pasa en orden. Suma `485616fd…e6a6b`. `despliegue.md` §1.3 documenta la reinstalación de `deploy/` y que el token de GHCR debe leer `restaurante-api`. La ejecución real del código 15 queda para el CI (`smoke.sh`) |
| CA-13 | PASS | `zod` solo en `packages/contracts/package.json`, exacta en `4.6.7`. El lockfile resuelve `node_modules/zod` en 4.6.7. `product-schema.ts` no aparece en el diff. Justificación en `arquitectura.md` §9 (l. 364-367) |
| CA-14 | PASS | Suite completa en verde (bot, `/admin`, `/admin/api` e importación). `/admin` en el navegador (inicio de sesión, lista, edición y orden), también con la API parada. `bot-chat.ts` responde |
| CA-15 | PASS | **`landing-pages`:** `API_INTERNAL_URL` ausente, vacía, `ftp://x`, `http://u:p@h:1`, `?a=1`, `#f` o `nourl` terminan con rc 1 y un mensaje con el formato, **sin repetir el valor**. Con `http://127.0.0.1:3102/` (barra final), arranca normalizada y carga de la API.<br>**`api`:** `NODE_ENV`, `HOST=localhost`, `PORT=99999`, una `DATABASE_URL` con consulta (y una contraseña ficticia) y `DATABASE_ALLOW_NEWER_SCHEMA=yes` terminan con rc 1 sin repetir los valores.<br>La variable está en los dos `.env.example`, en el README (l. 129, 350, 692) y en `desarrollo.md` |
| CA-16 | PASS en local; **pendiente del CI** | `typecheck`, `lint` y `test` terminan con 0 en la raíz. `calidad`, `docker`, `despliegue` y `auditoria` quedan para el PR hacia `epic/arquitectura` |
| CA-17 | PASS | §4 (excepción P-1, O-2 y transición limitada), §6 y §8 ("Paso 3 aplicado"), §9 (A y C aplicadas) y §10 (riesgo de la API y memoria con el 33,5 %, "sin una medición nueva", por decisión del usuario). El README y `docs/` reflejan RF-11 |

### Defectos encontrados

#### DEF-001

- **Severidad:** MAJOR.
- **Criterio afectado:** RF-9, CA-12 (el camino del código 15) y R-1 del ticket.
- **Descripción:** cuando `deploy.sh` termina con 15, la migración ya está aplicada y la `app` anterior sigue en marcha, pero fue creada sin `DATABASE_ALLOW_NEWER_SCHEMA=true`. Si ese contenedor se reinicia antes del siguiente despliegue correcto, `verifyDatabase` termina con `DATABASE_NEWER_THAN_CODE` y la app no arranca. Puede reiniciarse por un fallo, la memoria, un reinicio del VPS o el `restart: unless-stopped`. Hasta ahora, la vuelta atrás siempre dejaba la app creada con la bandera (códigos 21 y 22). El código 15 es el primer camino en el que la base queda migrada con una app que no la tolera al reiniciarse. Solo la `api` anterior se recrea con la bandera.
- **Pasos para reproducir:**
  1. Un despliegue con una migración nueva.
  2. Una imagen `api` que no queda `healthy`: termina con 15.
  3. `docker restart` de `app`.
- **Resultado esperado:** tras un código 15, la app en marcha sigue pudiendo arrancar sobre la base, o el runbook indica la acción necesaria.
- **Resultado actual:**
  - en `deploy.sh`, el paso 5a solo recrea `api`;
  - la demostración contra una base QA con una migración desconocida termina con rc 1 (`database_init_failed`, `DATABASE_NEWER_THAN_CODE`), y con la bandera arranca;
  - `docs/despliegue.md` (l. 82-83 y la fila del código 15, l. 463) dice que "la app no se tocó" y que "las landings siguen con su última copia buena", sin advertir de este riesgo.
- **Evidencia:** el código de `deploy.sh` (paso 5a), `verify.ts` (`checkMigrations`, l. 222) y la salida de la demostración descrita en "Pruebas ejecutadas".
- **Impacto:** caída total de `/`, `/molotes` y `/birria` (Traefik sin un backend sano) si la app se reinicia entre un código 15 y el siguiente despliegue correcto. Hay alternativa manual (`DATABASE_ALLOW_NEWER_SCHEMA=true … up -d --no-deps app`, §6 de `despliegue.md`), pero no está enlazada al código 15. La combinación es poco frecuente, y el siguiente despliegue puede volver a fallar con 15 si la causa persiste.
- **Recomendación:** que tras un código 15 la app en marcha quede preparada para reiniciarse sobre la base migrada, o al menos que el runbook y el resumen del código 15 indiquen la acción. La solución técnica la decide senior-fullstack.

#### DEF-002

- **Severidad:** MINOR.
- **Criterio afectado:** RF-9 y P-2 A (documentación del runbook).
- **Descripción:** `ops/backup/restore.sh` (l. 181) reescribe `state/release.env` solo con `RESTAURANTE_APP_IMAGE`, `RESTAURANTE_MIGRATE_IMAGE` y `RESTAURANTE_COMMIT`. Tras una restauración **en el mismo VPS** se pierde `RESTAURANTE_API_IMAGE`, y eso tiene tres efectos:
  1. el runbook (`despliegue.md` l. 713-714) propone arrancar la api "con la imagen de `state/release.env`", que ya no está (sí sigue en `release.env.previous` y en `releases.log`);
  2. el siguiente `deploy.sh` no tiene una api anterior a la que volver si la nueva falla;
  3. un `$C up -d` sin servicio resolvería `api` a `…:sin-desplegar`.
- **Impacto:** bajo. Las landings no dan 5xx (RF-5), la api sigue en marcha durante la restauración y `ops/` queda fuera de alcance por P-2 A.
- **Recomendación:** que el runbook indique de dónde sacar la imagen de la api tras una restauración en el mismo VPS.

#### DEF-003

- **Severidad:** MINOR.
- **Criterio afectado:** RF-6 y el caso límite "escritura en `/admin` con la API caída".
- **Descripción:** con la API parada, guardar un producto muestra en `/admin` el aviso "Producto guardado. La landing ya muestra los datos nuevos.", pero la landing sigue sirviendo la última copia buena hasta que la API vuelve (comprobado en N-3). Antes de este ticket el aviso siempre era cierto, porque la caché estaba en el mismo proceso.
- **Impacto:** el administrador puede creer que el cambio está publicado durante una caída de la API. El comportamiento de la landing es el que pide el ticket; solo el texto es inexacto.
- **Recomendación:** decidir si el aviso debe matizarse cuando la API no está disponible. Si no, aceptarlo.

### Regresión

- Suite completa en verde, con el mismo `expected fail` que la base.
- `/admin` y el bot funcionan.
- La importación se hace una sola vez (CA-10).
- Las labels y los routers de `app`, los servicios `mysql` y `app` (salvo `API_INTERNAL_URL`) y las imágenes `app` y `migrate` no cambian.
- El lint no pierde ninguna restricción (L-3).
- El HTML es idéntico (CA-1).
- `?dia=` funciona en desarrollo y se ignora en producción.

### Responsive

No hay cambios de HTML ni de CSS (CA-1 byte a byte). Prueba de humo en el navegador:

- `/molotes` y `/birria` sin overflow horizontal;
- 1 `h1`, `main`, 0 imágenes rotas;
- el CTA de WhatsApp con `target=_blank` y `rel="noopener noreferrer"`;
- consola sin errores.

`resize_window` no cambió el viewport (siguió en 2560 px de ancho), así que la vista a 375 px queda pendiente de revisión manual. Ningún CA depende de ella, porque el HTML y el CSS son idénticos a los de la base.

### Accesibilidad

Sin cambios: el HTML es idéntico. En las landings hay un `h1` y landmarks (`main`). El inicio de sesión de `/admin` tiene campos con etiqueta ("Usuario" y "Contraseña").

### UX/UI

No aplica comparación con `_stich_source_/`: no hay cambios visuales (CA-1). Ver DEF-003, sobre el texto de `/admin`.

### Performance

**Tiempos de respuesta (30 visitas a `/molotes` con la caché fresca):**

| Servidor | p50 | p90 |
| --- | --- | --- |
| Base | 1,30 ms | 1,50 ms |
| Nuevo | 1,18 ms | 1,41 ms |

**Peticiones a la API:**
- caché fresca: 0 peticiones en 20 s con ~200 visitas;
- caída de 75 s: unas 8-9 peticiones por negocio (reintento de ~5 s más TTL);
- espera máxima de una visita: 1,51-1,52 s, solo después de una escritura con la API lenta o a goteo;
- *stale-while-revalidate*: 0 s.

**Tamaños:** la respuesta de la API ocupa unos 4 KB (muy por debajo de 1 MiB). Las imágenes `api` y `production` pesan 260 MB y 263 MB.

**Log:** en la caída de 75 s se registró un solo `landing_products_fallback` por negocio, que cumple "como mucho uno por minuto". La repetición pasado el minuto no llegó a darse en esa ventana; la cubre `landing-products.test.ts`.

### SEO

Identidad byte a byte (CA-1): `title`, `meta`, `canonical` y Open Graph sin cambios.

### Pendientes de revisión manual

- Vista a 375×812 y 768×1024 en el navegador. El redimensionado no funcionó; no bloquea, porque el HTML y el CSS son idénticos.
- `npm run dev` con Ctrl+C sobre los dos procesos (RQ-7). No se ejecutó para no cargar el `landing-pages/.env` real, que además aún no tiene `API_INTERNAL_URL`: hay que añadirla en local, como indican el README y `desarrollo.md`.

**Pendiente del CI del PR hacia `epic/arquitectura`:**
- el job `docker` en amd64 (CA-11);
- `smoke.sh` con tres imágenes, incluido el código 15 real (CA-11 y CA-12);
- el smoke de respaldos (`ops/backup/ci/smoke.sh`);
- `calidad`, `despliegue` y `auditoria` (CA-16).

**Nota de limpieza:** se borraron las bases QA, los `DATA_DIR`, los contenedores `qa038-*`, las imágenes `qa038:*` y `koalaman/shellcheck:v0.10.0`, y `$TMPDIR/qa038`. Queda una imagen local `koalaman/shellcheck:stable` que QA no descargó (no apareció en el `docker pull` de esta ronda), así que no se borró. No queda ningún proceso ni puerto de QA abierto.

### Resultado final

NEEDS_USER_DECISION

DEF-001 es MAJOR y requiere una decisión del usuario. DEF-002 y DEF-003 son MINOR. El resto de los CA pasan con evidencia; CA-11 y CA-16 quedan pendientes del CI.

### Decisión del usuario sobre los defectos (2026-10-26)

Respuestas textuales:

- DEF-001: "Corregirlo (Recomendado)".
- DEF-002 y DEF-003: "Corregir DEF-002, Corregir DEF-003".

### Resultado final tras la decisión

QA_REJECTED. Hay que corregir los tres defectos. La solución técnica la decide senior-fullstack; abajo están el criterio de corrección y cómo se revalidará cada uno.

| Defecto | Criterio de corrección | Revalidación (ronda 2) |
| --- | --- | --- |
| DEF-001 (MAJOR) | Después de un código 15 de `deploy.sh`, con la base ya migrada, la `app` en marcha puede reiniciarse sin terminar por `DATABASE_NEWER_THAN_CODE`. La corrección no puede romper los códigos 0, 13, 21 y 22 ni la regla de no tocar la app cuando la api nueva falla (o, si hay que recrearla, el cambio queda justificado y documentado). `docs/despliegue.md` (paso 6 y fila del código 15) y, si aplica, `resumen.sh` describen el comportamiento real y la acción manual que quede. | 1. Revisión del diff de `deploy.sh`, `smoke.sh` y `despliegue.md`.<br>2. `shellcheck` y `resumen-test.sh`.<br>3. Si el entorno lo permite, `smoke.sh` en local: código 15 con una migración nueva, seguido de `docker restart app` → `healthy` y 200 por Traefik. Si no, se comprueba que el smoke cubre ese caso y queda para el CI.<br>4. Reproducción de la condición con una base QA (migración desconocida y arranque de la app como quede tras el 15).<br>5. Regresión de P-1 (2 digests → 2), de la suma de `deploy/` (recalculada) y de la suite completa. |
| DEF-002 (MINOR) | Tras una restauración en el mismo VPS, el operador sabe de dónde obtener la imagen de la api (y la vuelta atrás de la api en el siguiente código 15 no depende de una línea borrada), sin contradicción entre el runbook y el comportamiento de `restore.sh`. Se respeta P-2 A (`ops/` no cambia) salvo que el usuario decida otra cosa. | Lectura dirigida del runbook (§11.7 y vuelta atrás manual) frente a `restore.sh` y `deploy.sh`. Si cambia código, revisión del diff y de su prueba. |
| DEF-003 (MINOR) | Con la API no disponible (o si el refresco tras guardar falla), `/admin` no afirma que la landing ya muestra los datos nuevos. Con la API disponible, el aviso actual se mantiene o equivale. `/admin` nunca falla por la API y el HTML de las landings no cambia (CA-1). | 1. Navegador con el usuario QA: guardar con la API parada y con la API en marcha, y comparar los avisos.<br>2. Prueba automatizada del aviso en la suite.<br>3. CA-1 (referencia y E2E contra la base), CA-4, CA-14 y la suite completa. |

**Regresión general de la ronda 2:**

- `typecheck`, `lint` y `test` en la raíz;
- CA-1 (la referencia y una comparación E2E);
- CA-4 a CA-7 (frescura y resiliencia, con el proxy de fallos);
- CA-12 y CA-15.

Siguen pendientes del CI CA-11, CA-16, `smoke.sh` y el smoke de respaldos.

## QA Report — Ronda 2

Fecha: 2026-10-26. Revalida las correcciones T3 ("Correcciones de la ronda 1 de QA (T3)"), aprobadas por el usuario ("si"). El entorno fue el mismo que en la ronda 1, aislado y ya eliminado:

- base `restaurante_test_qa038`;
- `DATA_DIR` temporales;
- el usuario QA `qa038`;
- `api` en el 3101, el proxy de fallos en el 3102, `landing-pages` en el 3100 y el servidor base en el 3200.

Además:

- se construyeron las imágenes `qa038r2:{api,production,migrate}`;
- `smoke.sh` corrió en un contenedor `docker:cli` con `--network host`.

El estado de git no cambió: 64 entradas, igual que al inicio de la ronda.

### Qué cambió desde la ronda 1

| Archivo | Cambio |
| --- | --- |
| `deploy/deploy.sh` | `applied_migrations` y `running_image`; recreación de la app con la bandera tras un código 15 con migraciones nuevas; api anterior tomada del contenedor en marcha |
| `deploy/ci/smoke.sh` | Caso DEF-001 |
| `deploy/ci/resumen.sh` | Mensaje del código 15 |
| `docs/despliegue.md` y `README.md` | Paso 6, fila del código 15, sección "Imagen de la `api`" y §11.7 |
| `landing-pages` | `confirmFresh` en la caché, aviso `product_saved_pending` en `admin-products.ts` y `views/admin/index.ts`, y sus pruebas |

### Pruebas ejecutadas

| Prueba | Resultado |
| --- | --- |
| `npm run typecheck` y `npm run lint` (raíz) | 0 y 0 (sin avisos) |
| `npm test` (raíz) | `api`: 33 en verde. `landing-pages`: 99 archivos, 2098 en verde y 1 `expected fail` (el mismo de la base). Hay 2 pruebas nuevas |
| `deploy/ci/smoke.sh qa038r2:production qa038r2:migrate qa038r2:api` | "todas las comprobaciones pasaron" (exit 0, 77 `ok` y 0 FALLO). Un primer intento sin `--network host` falló en la sonda de Traefik por la red de macOS; el script limpió todo |
| `resumen-test.sh` | "todas las comprobaciones pasaron" |
| `deploy.sh` con la forma de 2 digests y con un digest de api `BAD` | rc 2 y rc 2 |
| Suma de `deploy/` (orden del workflow) | `76103d89…3a0420`, igual que la recalculada en T3 |
| CA-1: referencia | Los 6 archivos de `tests/snapshots/landing-html/` no cambian: su SHA-256 coincide con el nombre y con lo regenerado de forma independiente en la ronda 1. `landing-html-reference.test.ts` está en verde |
| CA-1: E2E (servidor `769ad8b` contra el nuevo con la API real, misma base y datos modificados) | 21 de 21 idénticos con `cmp` |
| CA-4: `/admin/api` en Birria | Crear, mostrar, editar (nombre y precio 99.50), ocultar, eliminar, recuperar y reordenar. Cada operación: 1 petición a Birria y 0 a Molotes, `/molotes` igual y `/birria` refleja el cambio en la primera visita |
| CA-6 | Arranque sin API: semilla, `fallback source: seed` y 200. Al levantar la API, el producto de la base se ve en 4 s |
| CA-5 y CA-7: proxy de fallos | 10 modos (`down`, `slow`, `drip`, `invalid`, `badjson`, `503`, `redirect`, `html`, `big` y `big-chunked`). En todos: 200 con la última copia y espera máxima de 1,51 s solo en `slow` y `drip` tras una escritura. Motivos registrados: `network` ×2, `timeout` ×2, `invalid_body` ×5 y `http_status 503` ×1. Recuperación sin reiniciar. Redirección no seguida |
| S-2 | 20 visitas simultáneas tras una invalidación: 1 petición a la API (`ok` y `slow`) |
| Bucle de control | 3564 peticiones a `/`, `/molotes` y `/birria`: todas 200. Ningún `request` con estado 5xx |
| CA-15 | `API_INTERNAL_URL` ausente, `ftp://x`, `http://u:p@h:1`, `?a=1` o `nourl`: rc 1, sin repetir el valor |

### Revalidación de los defectos

| Defecto | Resultado | Evidencia |
| --- | --- | --- |
| DEF-001 (MAJOR) | **CORREGIDO** | En el paso 5a de `deploy.sh`, `MIGRATIONS_BEFORE/AFTER` (usuario de respaldo, que tiene `SELECT` en `restaurante.*` según `01-usuarios.sh`) decide recrear la app con su imagen en marcha y `DATABASE_ALLOW_NEWER_SCHEMA=true`. Si no se puede leer, se recrea por precaución. Si la app recreada no queda sana, termina con 22. Sin migraciones nuevas, la app no se toca.<br>En `smoke.sh` (local):<br>- "deploy con migración nueva y api rota → 15";<br>- "la app se recreó", "con la misma imagen (v2)" y "y con DATABASE_ALLOW_NEWER_SCHEMA=true";<br>- "tras reiniciarla, la app queda healthy sobre la base migrada" y "y el sitio responde 200";<br>- el caso sin migración ("la app en marcha no se tocó") y los códigos 0, 13, 21 y 22 siguen en verde.<br>La fila del código 15 de `despliegue.md` (l. 484) describe los dos casos. `resumen.sh` traduce el 15 |
| DEF-002 (MINOR) | **CORREGIDO** | `despliegue.md` §6, "Imagen de la `api`" (l. 390-402): por orden, contenedor en marcha, `release.env.previous` y `releases.log`. §11.7 (l. 730-738) ya no contradice a `restore.sh`. `deploy.sh` toma la api anterior del contenedor en marcha si `release.env` no la tiene (solo si es un digest; `sin-desplegar` se descarta). `ops/` sin cambios (P-2 A) |
| DEF-003 (MINOR) | **CORREGIDO** | En el navegador, con el usuario QA, editando un producto de Molotes:<br>- **API en marcha:** redirección a `?ok=product_saved` con "Producto guardado. La landing ya muestra los datos nuevos.", y la landing ya tiene el cambio;<br>- **API parada:** redirección a `?ok=product_saved_pending` con "Producto guardado. La landing lo mostrará en cuanto la API de productos vuelva a responder; mientras…", sin "ya muestra"; `/molotes` responde 200 con la copia anterior y `/admin` no falla;<br>- **al levantar la API:** el cambio aparece sin reiniciar.<br>Es el único aviso de `/admin` que afirmaba el estado de la landing (los demás no lo hacen). Pruebas automatizadas en `landing-products-api.test.ts` y `landing-products.test.ts` (`confirmFresh`), en verde. CA-1 sigue idéntico |

### Criterios de aceptación (ronda 2)

| CA | Resultado | Evidencia |
| --- | --- | --- |
| CA-1 | PASS | Referencia sin cambios y E2E 21 de 21 |
| CA-2, CA-3, CA-8, CA-9, CA-10, CA-13, CA-17 | PASS (ronda 1, sin cambios en su código) | Lo afectado por T3 está en la suite y el smoke ("compose de producción", "api en la red interna"). La documentación se amplió sin contradicciones |
| CA-4 | PASS | `/admin/api` (7 operaciones) y `/admin` HTML (DEF-003) |
| CA-5, CA-6, CA-7 | PASS | 10 modos de fallo, arranque sin API, API parada de verdad y 0 respuestas 5xx en 3564 peticiones |
| CA-11 | PASS en local; **pendiente del CI** | Imágenes reconstruidas con Zod 4.6.7 y `smoke.sh` completo en verde ("la app cargó los productos de la api", "con la api parada … 200") |
| CA-12 | PASS en local; el CI confirma en amd64 | 3 digests (2 → rc 2), código 15 real en el smoke en sus dos variantes, suma `76103d89…`, workflow sin cambios desde la ronda 1 |
| CA-14 | PASS | Suite completa y `/admin` en el navegador |
| CA-15 | PASS | Ver arriba |
| CA-16 | PASS en local; **pendiente del CI** | `typecheck`, `lint` y `test` con 0 |

### Defectos encontrados (ronda 2)

Ninguno nuevo. DEF-001, DEF-002 y DEF-003 quedan corregidos.

### Regresión

- Suite completa, smoke de despliegue completo (códigos 0, 2, 3, 4, 13, 15, 21 y flock), CA-1 E2E, frescura y resiliencia: todo en verde.
- El HTML de las landings no cambia.

### Responsive, accesibilidad, UX/UI y SEO

No cambia el HTML de las landings (CA-1). El aviso nuevo de `/admin` usa la misma región de estado (`status`) que los demás avisos.

### Performance

- La espera tras una escritura con la API lenta sigue siendo como mucho 1,51 s.
- Con la caché fresca no hay ninguna petición a la API.
- `confirmFresh` solo espera en `update` de `/admin` HTML, como mucho el límite del cliente.

### Pendientes de revisión manual

Siguen pendientes de la ronda 1, sin bloquear:

- la vista a 375 px en el navegador;
- `npm run dev` con Ctrl+C.

### Pendiente del CI del PR hacia `epic/arquitectura`

- **`calidad`, `docker` (amd64), `despliegue` y `auditoria`:** CA-11 y CA-16.
- **`smoke.sh` en Linux amd64:** en local pasó en arm64 (macOS).
- **Smoke de respaldos (`ops/backup/ci/smoke.sh`):** en macOS no se puede comprobar, por el S3 local.

### Limpieza

- **Borrado:** la base QA, los `DATA_DIR`, las imágenes `qa038r2:*`, `$TMPDIR/qa038` y la pestaña del navegador. El smoke eliminó sus contenedores, redes y volúmenes.
- **Sin procesos:** no queda ningún proceso ni puerto de QA.
- **No borrado:** las etiquetas `localhost:5000/orvigas/*` ya existían de los smoke del desarrollador, así que no se borraron; el smoke de QA reetiquetó las tres `v1`.

### Resultado final

QA_APPROVED

## Historial de cambios

### Versión 1

Descripción inicial (2026-10-26): paso 3 de la épica de arquitectura con las decisiones del usuario sobre endpoints, despliegue, frescura, resiliencia, semillas, convivencia, lint, memoria y Zod, y los tres supuestos confirmados.

### Revisión técnica (T1)

2026-10-26 (senior-fullstack): revisión técnica y Technical Action Plan en borrador. Estado `NEEDS_TECHNICAL_CLARIFICATION` por tres decisiones:

- P-1: alcance de la prohibición de `core` en el código de las landings;
- P-2: `compose.prod.yaml` y los respaldos de `ops/backup/`;
- P-3: interpretación de CA-8 con `migrate` en la red `db`.

El plan asume la opción recomendada (A) en las tres.

### T2 — Inicio de implementación

2026-10-26 (senior-fullstack): respuestas P-1, P-2 y P-3 (A) y aprobación del plan registradas; RF-8, CA-8 y CA-9 ajustados. Rama `feature/REQ-F-038-api-publica-productos` desde `epic/arquitectura` (`769ad8b`). Ticket a `in-progress/` con estado `IN_PROGRESS` (el archivo no estaba versionado, así que se movió con `mv`).

### T2 — Implementación

2026-10-26 (senior-fullstack): implementación completa del Technical Action Plan con P-1, P-2 y P-3 (A). Validaciones en verde (`typecheck`, `lint`, `test`, `audit:deps`, smoke de despliegue en local). Zod fijado en 4.6.7 (desviación 1). Estado `NEEDS_IMPLEMENTATION_APPROVAL`.

### Q1 — QA Action Plan

2026-10-26 (senior-qa): QA Action Plan escrito (CA-1 regenerado de forma independiente desde `769ad8b` con `git archive` y comparado E2E con procesos reales; endpoint; frescura en el navegador con un usuario QA en una base QA dedicada; resiliencia con un proxy de fallos; O-1; lint; imágenes y compose; `deploy.sh`; regresión; documentación). Riesgos RQ-5 (código 15 y esquema más nuevo) y RQ-6 (`restore.sh` y `release.env`) a verificar. Estado `NEEDS_QA_PLAN_APPROVAL`.

### Q2 — Ronda 1 de QA

2026-10-26 (senior-qa): plan aprobado por el usuario ("Si"). Ronda 1 ejecutada (QA Report). CA-1 a CA-10, CA-12 a CA-15 y CA-17 pasan. CA-11 y CA-16 pasan en la parte local y quedan pendientes del CI. Defectos: DEF-001 (MAJOR: código 15 de `deploy.sh` y app sin `DATABASE_ALLOW_NEWER_SCHEMA`), DEF-002 (MINOR: `restore.sh` y `RESTAURANTE_API_IMAGE`) y DEF-003 (MINOR: aviso de `/admin` con la API caída). Estado `NEEDS_USER_DECISION`.

### Q2 — Decisión sobre los defectos

2026-10-26 (senior-qa): el usuario decidió corregir DEF-001 ("Corregirlo (Recomendado)"), DEF-002 y DEF-003 ("Corregir DEF-002, Corregir DEF-003"). Se añaden los criterios de corrección y la revalidación. Estado `QA_REJECTED`.

### T3 — Correcciones de la ronda 1

2026-10-26 (senior-fullstack): DEF-001 (`deploy.sh` recrea la app con `DATABASE_ALLOW_NEWER_SCHEMA=true` tras un código 15 con migraciones nuevas; smoke con el caso), DEF-002 (runbook de la imagen de la api y vuelta atrás con la api en marcha) y DEF-003 (aviso de `/admin` según `confirmFresh`). Suma de `deploy/` recalculada. Validaciones en verde. Estado `NEEDS_IMPLEMENTATION_APPROVAL`.

### Q2 — Ronda 2 de QA

2026-10-26 (senior-qa): correcciones T3 aprobadas por el usuario ("si"). DEF-001, DEF-002 y DEF-003 revalidados y corregidos (incluido `smoke.sh` completo en local con el caso DEF-001). Regresión en verde: `typecheck`, `lint`, `test` (2098 + 33), CA-1 E2E 21 de 21, CA-4 a CA-7, CA-12 y CA-15. Quedan pendientes del CI CA-11, CA-16 y el smoke de respaldos. Estado `QA_APPROVED`.
