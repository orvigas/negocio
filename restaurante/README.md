# Restaurante — Moloteando / Birriería El Muñeco

> **Estado:** ambas landings implementan el diseño de `../_stich_source_/`
> (`moloteando_aut_nticos_molotes_artesanales` y
> `birrier_a_el_mu_eco_aut_ntica_birria_de_res_color_adobo`), con Birria como página de
> inicio, un aviso según el día y rutas dedicadas por negocio.

Aplicación Koa.js (Node.js 24 LTS) que sirve dos landing pages desde un mismo proyecto. El
backend está escrito en TypeScript estricto y Node lo ejecuta directamente (type stripping,
sin paso de compilación); el JavaScript del navegador (`public/js/`) es Vanilla JS.

- **Moloteando (molotes)**: martes a viernes (`/molotes`).
- **Birriería El Muñeco (birria)**: sábado y domingo (`/birria`). Es también la página de
  inicio (`/`) todos los días.
- **Lunes:** descanso, no abre ningún negocio.

En `/`, según el día, se abre además un aviso (REQ-F-028): de martes a viernes, que la birria
es de fin de semana y un enlace a `/molotes`; los lunes, que ese día se descansa. El fin de
semana no hay aviso. El día se calcula en la zona horaria del negocio (`BUSINESS_TIMEZONE`),
no en la del servidor ni en la del dispositivo. Cada landing tiene un CTA de pedido por WhatsApp configurable. El contenido estático
vive en `src/content/`; los menús, precios, showcase del hero y promociones se editan desde
`/admin/molotes` y `/admin/birria` y se guardan en archivos JSON (ver
[Administración de menús](#administración-de-menús)).

Un solo **bot de WhatsApp** (opcional, conectado a la WhatsApp Cloud API de Meta) atiende a
los clientes de los dos negocios con la misma regla de días, muestra el menú del día, arma el
pedido y lo envía al personal (ver [Bot de WhatsApp](#bot-de-whatsapp)).

## Guías

Paso a paso, con enlaces a las secciones de este README:

- [Entorno de desarrollo](docs/desarrollo.md): instalación, MySQL local, `.env`, `DATA_DIR`,
  arranque, calidad (typecheck, lint y pruebas), `bot:chat` y el bot real con el sandbox de Twilio.
- [Despliegue a producción en la VM](docs/despliegue.md): `.env` de producción con Meta, `DATA_DIR`
  en el disco persistente, migraciones, webhook de Meta, comprobaciones, actualización, rollback y
  copias de seguridad.

## Requisitos

- Node.js >= 24.3 (ver `.nvmrc`; con nvm: `nvm use`). Desde 24.3 Node ejecuta los `.ts` sin
  avisos; las versiones 24.0 a 24.2 escriben un `ExperimentalWarning` en stderr.
- npm
- Docker con Compose v2 (o un MySQL 8.4 propio): la base de datos es MySQL 8.4 y el
  `compose.yaml` del proyecto levanta uno local solo en `127.0.0.1:3307` (`npm run db:up`). Sin
  MySQL no arrancan la app ni las pruebas. Docker también sirve para ejecutar las pruebas o
  construir las imágenes sin instalar Node (ver [Docker](#docker)).

## Puesta en marcha

```sh
nvm use
npm install
npm run db:generate    # genera el cliente de Prisma (src/generated/prisma; no se versiona)
cp .env.example .env   # completa al menos WHATSAPP_MOLOTES(_URL) y WHATSAPP_BIRRIA(_URL); trae DATABASE_URL local
npm run db:up          # MySQL 8.4 local (Docker), solo en 127.0.0.1:3307
npm run db:migrate     # aplica las migraciones (MIGRATION_DATABASE_URL del .env)
npm run admin:hash-password   # opcional: genera ADMIN_PASSWORD_HASH para crear el primer administrador
npm run build:css
npm run dev            # http://127.0.0.1:3000 (administración: http://127.0.0.1:3000/admin)
```

En la primera ejecución se crea la carpeta de datos (`DATA_DIR`, por defecto `data/`) con
una copia de la semilla de cada negocio, y los productos se importan una sola vez a la base de
datos MySQL. La app no migra: verifica al arrancar que la base esté lista. Ver
[Base de datos](#base-de-datos).

`npm install` solo ejecuta los scripts de instalación aprobados en `allowScripts` de
`package.json` (`prisma` y `@prisma/engines`; `@parcel/watcher` y `fsevents`
están denegados porque no los necesitan). Si una dependencia nueva trae un script de
instalación, `npm ci --strict-allow-scripts` (CI y Docker) falla hasta que se revise y se
apruebe con `npm install-scripts approve <paquete>`.

## Scripts

| Script               | Descripción                                                 |
| -------------------- | ----------------------------------------------------------- |
| `npm start`          | Inicia el servidor (carga `.env` si existe). No fija `NODE_ENV`: debe venir del `.env` o del entorno |
| `npm run dev`        | Servidor con recarga (`node --watch`; reinicia al editar cualquier `.ts` importado). Siempre con `NODE_ENV=development` (`scripts/dev-server.ts`), diga lo que diga el `.env` |
| `npm run build:css`  | Compila el CSS de ambas landings y de la administración (`build:css:molotes`, `build:css:birria`, `build:css:admin`) |
| `npm run watch:css`  | Compilación de CSS en modo observación                      |
| `npm run admin:hash-password` | Pide la contraseña de administración (sin mostrarla) e imprime el valor de `ADMIN_PASSWORD_HASH` |
| `npm run admin:recover -- --usuario <nombre>` | Recupera el acceso de administración por consola (ver [Recuperar el acceso](#recuperar-el-acceso)) |
| `npm run bot:chat [-- --ahora AAAA-MM-DDTHH:MM]` | Conversación con el bot de WhatsApp en la terminal contra el simulador de la Cloud API, sin Meta (ver [Probar el bot en local](#probar-el-bot-en-local)) |
| `npm run db:generate` | Genera el cliente de Prisma en `src/generated/prisma` (necesario antes de `typecheck`, `lint`, `test` y `dev`) |
| `npm run db:up` / `npm run db:down` | Levanta / detiene el MySQL 8.4 local de `compose.yaml` (solo en `127.0.0.1:3307`; datos en el volumen `mysql-dev-data`) |
| `npm run db:migrate` | Aplica las migraciones pendientes (`prisma migrate deploy`) con `MIGRATION_DATABASE_URL` |
| `npm run db:migrate:dev -- --name <nombre>` | Crea una migración nueva a partir de `prisma/schema.prisma` (solo desarrollo, contra el MySQL local con `MIGRATION_DATABASE_URL` y `SHADOW_DATABASE_URL`). Revisa a mano la colación de cada `CREATE TABLE` (ver [Base de datos](#base-de-datos)) |
| `npm test`           | Tests unitarios e integración (Vitest + Supertest) contra MySQL 8.4 real (requiere `npm run db:up`; ver [Pruebas](#pruebas-con-base-de-datos)) |
| `npm run typecheck`  | Verificación de tipos con `tsc` (`tsconfig.json`, sin generar archivos); termina con código distinto de 0 si hay errores. No forma parte de `npm test` |
| `npm run test:watch` | Vitest en modo observación                                  |
| `npm run lint`       | ESLint (`eslint.config.ts`): backend en TypeScript con información de tipos (typescript-eslint) y `public/js` con las reglas de JavaScript para navegador. No modifica archivos; termina con código distinto de 0 si hay errores o avisos. No forma parte de `npm test` ni del Dockerfile, pero sí del [CI](#ci) |
| `npm run lint:fix`   | Igual que `lint`, pero aplica las correcciones automáticas |
| `npm run audit:deps` | Auditoría de dependencias por imagen (production, migrate y desarrollo) con la política del CI y las excepciones de `security/audit-exceptions.json` (ver [Auditoría de dependencias](#auditoría-de-dependencias)). Necesita red |

Excepciones al lint: una regla solo se desactiva en una línea concreta y con la justificación
después de `--` (`// eslint-disable-next-line <regla> -- <motivo>`); sin justificación, el lint
falla. Las excepciones globales están comentadas en `eslint.config.ts`.

### Pruebas HTTP: servidor en 127.0.0.1

Las pruebas que hacen peticiones HTTP a la app crean su servidor con `listenLocal(app)` de
`tests/support/http.ts` (o con `setupAdmin` de `tests/support/admin.ts`, que la usa):

```ts
const server = await listenLocal(createApp({ config, repository }));
await server.request().get('/molotes'); // petición suelta
const browser = server.browser();       // cliente con cookies (sesión y CSRF de /admin)
```

- El servidor escucha solo en `127.0.0.1`, con un puerto libre que asigna el sistema, y el
  cliente conecta a esa misma dirección y puerto.
- Se cierra solo al terminar la prueba, también si falla. Por eso se llama dentro de cada prueba
  (`it`); en `beforeAll` o al nivel del módulo da error.
- Nunca `request(app.callback())` ni `request.agent(app.callback())`: supertest abriría su propio
  servidor en `::` (todas las interfaces) y conectaría a `127.0.0.1`. En macOS ese puerto puede
  estar ocupado en `127.0.0.1` por otro proceso local, que recibiría la petición (fallos
  intermitentes; REQ-F-011). `npm run lint` lo impide en `tests/`: solo `tests/support/http.ts`
  importa `supertest` (salvo `import type`), no se permite `.callback()` y todo `listen` lleva
  `'127.0.0.1'`.
- Excepción: las pruebas de arranque (`tests/integration/server-startup*.test.ts`) lanzan el
  proceso real (`src/server.ts`), que escucha en `HOST` (`127.0.0.1` por defecto; REQ-F-015).

### Pruebas con base de datos

La suite corre contra **MySQL 8.4 real** (REQ-F-014), nunca contra una base de desarrollo o de
producción. Antes de `npm test`: `npm run db:up` (el MySQL local de `compose.yaml`).

- `TEST_DATABASE_URL` (usuario solo DML: el mismo tipo de usuario que usa la app) y
  `TEST_ADMIN_DATABASE_URL` (DDL: solo el soporte de pruebas crea, migra, vacía y borra bases).
  Sin ellas se usan las del MySQL local (`127.0.0.1:3307`, credenciales de desarrollo).
- **Salvaguarda** (`tests/support/test-database-config.ts`, en el `globalSetup` y en cada
  archivo): las dos URL solo pueden apuntar a `127.0.0.1`, `localhost`, `::1` o `mysql-dev` y a
  bases con el prefijo `restaurante_test`; cualquier otra hace fallar la suite antes de conectar.
- Sin MySQL, la suite falla con el mensaje de cómo levantarlo. Ninguna prueba se salta.
- Cada ejecución tiene su id y cada trabajador de Vitest sus bases
  (`restaurante_test_<id>_<trabajador>`), migradas con el CLI real de Prisma la primera vez y
  vaciadas (`TRUNCATE`) antes de cada uso: dos ejecuciones en paralelo no se pisan. Si una prueba
  altera el esquema (DROP, ALTER, triggers), la base se vuelve a crear (se compara con la base de
  referencia `restaurante_test_<id>_ref`). Al terminar se borran.
- Usa `makeDatabase()`, `setupAdmin()` o `makeScratchDatabase()` de `tests/support/` (y
  `adminSql()` para el DDL de una prueba); nunca conexiones propias ni `DATABASE_URL`.
- La suite tarda unos 55 s (antes, con SQLite, unos 16 s).

## Docker

Los archivos están en esta carpeta: `Dockerfile`, `.dockerignore`, `compose.yaml` (MySQL local
`mysql-dev` y el servicio `test`) y `docker/mysql/initdb/` (bases y usuarios del MySQL local).

El `Dockerfile` es multi-stage y todas las etapas parten de `node:24-alpine` (flotante dentro de
la versión 24: una reconstrucción puede traer un parche más reciente de Node o Alpine):

| Etapa        | Contenido                                                                      |
| ------------ | ------------------------------------------------------------------------------ |
| `base`       | Imagen base y directorio de trabajo (`/app`)                                   |
| `deps`       | `npm ci` con solo `package.json` y `package-lock.json` (caché de dependencias) |
| `build`      | Código + `npm run typecheck` + `npm run build:css` (si hay errores de tipos o Tailwind falla, el build de la imagen falla) |
| `test`       | `build` + diseño fuente; comando por defecto `npm test`                        |
| `migrate`    | Dependencias de producción + CLI de Prisma, `prisma/` y `prisma.config.ts`; usuario `node`; ejecuta `prisma migrate deploy` con `MIGRATION_DATABASE_URL` y termina |
| `production` | Dependencias de producción (sin `typescript` ni `@types/*`), `src/` (`.ts`) y `public/` con el CSS compilado; usuario `node`; arranca con `node src/server.ts` |

El `.dockerignore` deja fuera `node_modules/`, `.env*` (salvo `.env.example`), `data/`, el CSS
generado localmente, logs, cobertura y `.git`: ningún secreto ni dato editable entra en las
imágenes.

### Pruebas

```sh
docker compose run --rm test   # código de salida 0 si todo pasa; distinto de 0 si algo falla
```

- Construye el target `test` en cada ejecución (`pull_policy: build`; gracias a la caché solo se
  repiten las capas afectadas), levanta `mysql-dev` y ejecuta `vitest run` completo contra él.
  El contenedor de pruebas solo está en la red interna `db-test` (sin salida a internet).
- El código va dentro de la imagen (sin volúmenes): los cambios locales se incluyen al
  reconstruir automáticamente.
- Las pruebas de contenido comparan la semilla con `../_stich_source_/`, que compose pasa como
  contexto adicional `design` (solo entra en la imagen de pruebas). Sin compose:
  `docker build --target test --build-context design=../_stich_source_ -t restaurante:test .`
- El contenedor usa UTC; no afecta a la selección de landing, que usa `BUSINESS_TIMEZONE`.
- Compose lee el `.env` de esta carpeta solo para interpolar variables (no lo pasa al
  contenedor). Si `ADMIN_PASSWORD_HASH` está sin comillas, Compose interpreta cada `$` del hash
  y muestra avisos `variable is not set` con fragmentos del hash. Escríbelo entre comillas
  simples (`ADMIN_PASSWORD_HASH='scrypt$...'`, Node lo lee igual) o ejecuta
  `COMPOSE_DISABLE_ENV_FILE=true docker compose run --rm test`.
- Otra arquitectura (p. ej. amd64 en Apple Silicon):
  `DOCKER_DEFAULT_PLATFORM=linux/amd64 docker compose run --rm test`.

### Producción

En el VPS la app corre con esta imagen, publicada en GHCR y desplegada en cada push a `main` por
el CI con `deploy/compose.prod.yaml` y `deploy/deploy.sh` detrás de Traefik (REQ-F-016; guía
completa en [Despliegue a producción](docs/despliegue.md)). Esta sección describe la imagen
`production` por sí sola.

```sh
docker build --target production -t restaurante:prod .
docker build --target migrate -t restaurante:migrate .
# Migraciones (usuario con DDL), antes de arrancar la app:
docker run --rm -e MIGRATION_DATABASE_URL='mysql://migrador:...@mysql:3306/restaurante' restaurante:migrate
docker volume create restaurante-data
docker run -d --name restaurante -p 3000:3000 \
  -e WHATSAPP_MOLOTES=5215512345678 -e WHATSAPP_BIRRIA=5215512345678 \
  -e DATABASE_URL='mysql://app:...@mysql:3306/restaurante' \
  -e DATA_DIR=/var/lib/restaurante -v restaurante-data:/var/lib/restaurante \
  restaurante:prod
```

El compose de producción (red interna con MySQL, Traefik, usuarios de la base, volcados y vuelta
atrás) está en `deploy/` y se describe en [docs/despliegue.md](docs/despliegue.md).

- La configuración se inyecta **al ejecutar** (`-e` o `--env-file .env`), nunca en el build. Se
  valida igual que sin Docker: si falta una variable obligatoria (`WHATSAPP_*`, `DATABASE_URL`, `DATA_DIR`), el
  contenedor termina con código 1 y lista los problemas sin mostrar valores.
- `NODE_ENV=production`, `HOST=0.0.0.0` (todas las interfaces del contenedor, para que funcionen
  el puerto publicado y el `HEALTHCHECK`) y `PORT=3000` vienen definidos en la imagen; `-e HOST=…`
  los sustituye. La app corre con el usuario
  `node` (UID 1000) y el código es de solo lectura para él.
- `DATA_DIR` debe ser una ruta absoluta montada como volumen; `/var/lib/restaurante` ya existe
  en la imagen con dueño `node`, así que un volumen con nombre montado ahí funciona sin más. Con
  un bind mount del host, la carpeta debe ser escribible por el UID 1000. En el primer arranque
  se copia la semilla (log `menu_data_seeded`).
- `HEALTHCHECK`: cada 30 s pide `GET /` con el `wget` de la imagen
  (`docker inspect -f '{{.State.Health.Status}}' restaurante` -> `healthy`). Cada comprobación
  aparece como una línea `request` en el log.
- El contenedor arranca con `node src/server.ts`: Node 24 ejecuta el TypeScript directamente,
  sin compilar y sin TypeScript instalado en la imagen.
- `docker stop` envía `SIGTERM` y la app cierra el servidor y la base de datos ordenadamente.
- Al arrancar, la app **verifica** la base de `DATABASE_URL` (no migra; ver
  [Base de datos](#base-de-datos)); si no está lista, el contenedor termina con código 1 y el log
  `database_init_failed`. La imagen no incluye el CLI de Prisma ni SQLite: lleva el cliente
  generado, las migraciones (`prisma/migrations`, solo para comprobar su estado) y los comandos
  de consola (`scripts/`). Pesa unos 250 MB.
- La imagen `migrate` (target `migrate`) solo ejecuta `prisma migrate deploy` con
  `MIGRATION_DATABASE_URL` (usuario con DDL) y termina: 0 si todo se aplicó, 1 si no.
- Recuperar el acceso dentro del contenedor:
  `docker exec -it restaurante node scripts/admin-recover.ts --usuario <nombre>`.
- `/admin` exige HTTPS en producción (ver [Seguridad](#seguridad-1)): en el VPS lo da Traefik y
  `deploy/compose.prod.yaml` fija `TRUST_PROXY=true`.

## CI

El workflow `.github/workflows/ci.yml` (en la raíz del repositorio, GitHub Actions) comprueba
cada cambio y, en `main`, publica y despliega (REQ-F-016). Las comprobaciones no necesitan
secretos ni `.env`: las pruebas usan su propia configuración (`tests/helpers.ts`). Solo el job
`deploy` usa secretos (los del environment `production`).

### Cuándo se ejecuta

- En cada PR hacia `main`, al abrirlo, al actualizarlo (push nuevo) o al reabrirlo.
- En cada push a `main` (por ejemplo, al hacer merge de un PR).
- Un push nuevo al mismo PR cancela la ejecución anterior de ese PR; las de `main` nunca se
  cancelan.
- Cada comprobación tiene un tiempo máximo de 20 minutos (`despliegue`, 30; `auditoria`, 10).
- `publish` y `deploy` solo corren en un push a `main`, después de que `calidad`, `docker`,
  `despliegue` y `auditoria` terminen en verde. Un PR nunca publica ni despliega.

### Qué comprueba

Cuatro comprobaciones independientes, que aparecen por separado en el PR (`CI / calidad`,
`CI / docker`, `CI / despliegue` y `CI / auditoria`). Si un paso falla, la comprobación queda en rojo y sus pasos
siguientes no se ejecutan; un fallo en una no afecta a las otras.

| Comprobación | Pasos, en orden |
| ------------ | --------------- |
| `calidad`    | Node 24 (versión de `.nvmrc`), `npm ci --strict-allow-scripts`, `npm run db:generate` (cliente de Prisma), `npm run typecheck`, `npm run lint`, `npm run build:css` (las pruebas leen el CSS generado), `npm run db:up` (MySQL 8.4 de `compose.yaml`), `prisma migrate diff` (el esquema y las migraciones no divergen) y `npm test` (contra MySQL) |
| `docker`     | Build de los targets `production` y `migrate` del `Dockerfile` (su etapa `build` ejecuta `npm run typecheck`), solo `linux/amd64` y sin publicar las imágenes; comprueba que `production` no lleva el CLI de Prisma ni SQLite y que `migrate` aplica el esquema sobre una base vacía con código 0; arranca `production` sin `HOST` y comprueba que escucha en `0.0.0.0`, queda `healthy` y responde por el puerto publicado (REQ-F-015) |
| `despliegue` | `shellcheck` de los scripts de `deploy/` y prueba de humo `deploy/ci/smoke.sh` (REQ-F-016): el compose de producción no publica puertos y MySQL solo está en la red interna; con un registro local y un Traefik v3 ejecuta `deploy.sh` como el comando forzado de SSH y comprueba los rechazos (argumentos, suma de `deploy/`, permisos del `.env`), el primer despliegue, las redirecciones 301, el 429 en `/admin`, la IP y el esquema en el log, la retención de 7 volcados, la migración fallida (la app no se toca), la vuelta atrás ante una imagen rota (también tras una migración nueva) y dos despliegues a la vez |
| `auditoria`  | Node 24 y `node scripts/audit-deps.ts` (REQ-F-020), sin `npm ci`: `npm audit` sobre `package-lock.json` por imagen, con la política de [Auditoría de dependencias](#auditoría-de-dependencias) |

La caché de npm se invalida al cambiar `package-lock.json`; la de Docker reutiliza las capas que
no cambian. El runner usa UTC; la selección de landing depende de `BUSINESS_TIMEZONE`, no de la
zona del sistema.

### Reproducirlo en local

Desde esta carpeta (`restaurante/`):

```sh
npm ci --strict-allow-scripts && npm run db:generate && npm run typecheck && npm run lint && npm run build:css && npm run db:up && npm test   # calidad
SHADOW_DATABASE_URL=mysql://restaurante_migrator:migrator-dev@127.0.0.1:3307/restaurante_shadow npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --exit-code   # divergencia
docker buildx build --platform linux/amd64 --target production .              # docker
docker buildx build --platform linux/amd64 --target migrate .
npm run audit:deps                                                            # auditoria
```

La prueba de humo necesita Linux (`flock`, GNU `find` y `stat`). Con Docker Desktop, ejecútala
dentro de un contenedor con el socket de Docker y una carpeta de trabajo que el daemon vea con la
misma ruta:

```sh
docker build -t restaurante:production --target production . && docker build -t restaurante:migrate --target migrate .
docker network create traefik-public 2>/dev/null; w=/tmp/restaurante-smoke; mkdir -p "$w"
docker run --rm --network traefik-public -v /var/run/docker.sock:/var/run/docker.sock \
  -v "$PWD/deploy:/src/deploy:ro" -v "$w:$w" -e SMOKE_WORKDIR="$w" docker:cli \
  sh -c 'apk add -q bash curl jq coreutils findutils util-linux gzip && bash /src/deploy/ci/smoke.sh restaurante:production restaurante:migrate'
```

Si un paso falla en GitHub por un problema de red (npm o Docker Hub), vuelve a ejecutarlo desde
la pestaña **Actions** del PR con **Re-run failed jobs**.

### Seguridad

- Permisos de solo lectura del repositorio (`permissions: contents: read`); `publish` añade solo
  `packages: write` (GHCR con el `GITHUB_TOKEN`). Los únicos secretos (`VPS_*`) están en el
  environment `production` y solo los usa `deploy`, cuya llave SSH solo puede ejecutar
  `deploy.sh` en el VPS (comando forzado).
- Usa el evento `pull_request`: los PR desde forks se ejecutan sin secretos y con un token de
  solo lectura. En un repositorio privado, GitHub además no ejecuta workflows de forks salvo que
  se habilite en **Settings → Actions → General**.
- Las acciones de terceros están fijadas por el SHA completo de su versión (comentario
  `# vX.Y.Z` al lado). Para actualizar una, toma el SHA de la nueva etiqueta
  (`gh api repos/<dueño>/<acción>/commits/<etiqueta> --jq .sha`) y cambia SHA y comentario
  juntos.

### Auditoría de dependencias

`npm run audit:deps` (job `auditoria`, REQ-F-020) ejecuta `npm audit --json` sobre
`package-lock.json` en tres cortes, con los mismos `--omit` que el `Dockerfile`, y aplica la
política de `scripts/support/audit-policy.ts`:

| Corte | Árbol | Qué rompe el CI |
| --- | --- | --- |
| `production` | `--omit=dev --omit=optional` (imagen production) | Un aviso `high` o `critical` sin excepción vigente |
| `migrate` | `--omit=dev` (imagen migrate: añade el CLI de Prisma) | Un aviso `high` o `critical` sin excepción vigente |
| `desarrollo` | Todo el árbol | Nada: solo informa |

- Los avisos `moderate`, `low` e `info` de cualquier corte solo informan. Todo aparece en el
  resumen del job (pestaña **Summary** de la ejecución) y en la consola.
- **Fail closed:** si el registro de npm no responde o la salida no es un informe válido, el job
  falla. Se reintenta con **Re-run failed jobs**.
- Un aviso nuevo publicado sin cambios en el código deja en rojo el siguiente PR o push a `main`
  hasta corregirlo o aceptarlo con una excepción.
- Prohibido: `npm audit fix --force` y bajar cualquier dependencia de versión mayor. Las
  correcciones se hacen subiendo la dependencia o con `overrides` que pasen todo el CI
  (typecheck, lint, pruebas contra MySQL 8.4, `docker` y `despliegue`).

#### Excepciones

Viven en `security/audit-exceptions.json`. Cada una acepta un aviso concreto en un paquete
concreto durante 30 días como máximo:

```json
{
  "exceptions": [
    {
      "ghsa": "GHSA-xxxx-xxxx-xxxx",
      "package": "nombre-del-paquete",
      "justification": "Por qué no se explota en esta app y qué lo corregirá",
      "approvedBy": "Nombre de quien la aprueba",
      "approvedOn": "2026-10-14",
      "reviewBy": "2026-11-13"
    }
  ]
}
```

- Todos los campos son obligatorios y no se admiten otros. `ghsa` tiene el formato
  `GHSA-xxxx-xxxx-xxxx` y las fechas, `AAAA-MM-DD` (UTC).
- `reviewBy` está como mucho 30 días después de `approvedOn`; el día `reviewBy` todavía vale.
- Una excepción vencida, con más de 30 días de plazo, con `approvedOn` en el futuro, con un campo
  vacío o repetida rompe el CI, y el mensaje nombra el GHSA. Rompe aunque su aviso ya no exista.
- Una excepción que ya no excusa ningún aviso aparece como **sin uso**: retírala.
- **Añadir:** analiza si el aviso se explota en esta app, agrega la entrada con la aprobación del
  responsable y `reviewBy` a 30 días como máximo, y súbela en un PR.
- **Renovar:** vuelve a analizar el aviso. Si sigue sin corrección, actualiza `approvedOn` (la
  fecha de la nueva aprobación), `reviewBy` y, si cambió, la justificación, en un PR.

#### Overrides vigentes

`package.json` no admite comentarios; el motivo de cada override está aquí:

| Override | Motivo |
| --- | --- |
| `mariadb` → `$mariadb` (3.4.7) | `@prisma/adapter-mariadb` 7.10.0 fija `mariadb` 3.4.5 exacto, afectado por GHSA-cqhc-2h57-wpxf, GHSA-r3rv-jm3r-62q2, GHSA-v6pj-gxxw-phfw y GHSA-48qf-xh34-q73r (high). 3.4.7 es un parche con las mismas dependencias. Queda GHSA-cx2f-j9fh-8g68 (moderate, solo con autenticación ed25519 de MariaDB, que MySQL 8.4 no usa; se corrige en 3.5.4). Retirarlo cuando el adaptador fije una versión corregida |
| `prisma` → `mysql2` 3.24.6 | El CLI de Prisma 7.10.0 fija `mysql2` 3.15.3 (GHSA-3f6p-5ww8-9rcr, high; GHSA-rgwj-5xj2-c3m3, moderate). Solo lo usa Prisma Studio; `migrate deploy` no lo carga. Misma versión mayor |
| `@prisma/config` → `deepmerge-ts` 8.0.2 | `@prisma/config` 7.10.0 fija `deepmerge-ts` 7.1.5 (GHSA-ggr8-5vv4-36mx, high; la rama 7 no se corrige). Solo fusiona `prisma.config.ts`; la API `deepmerge` no cambia en la 8 y `migrate deploy` lo valida en `calidad`, `docker` y `despliegue` |

Al subir Prisma, revisa si cada override sigue haciendo falta.

### Dependabot

`.github/dependabot.yml` (REQ-F-020) revisa cada lunes las dependencias npm de `restaurante/` y
las acciones de GitHub. Las alertas y las actualizaciones de seguridad de Dependabot están
activadas en el repositorio (**Settings → Code security**).

- **Actualización rutinaria:** un PR semanal agrupado con las versiones menores y de parche. Las
  versiones mayores no se proponen y se revisan a mano.
- **Seguridad:** los PR de seguridad se abren siempre, también si exigen una versión mayor.
- **Prisma:** `prisma`, `@prisma/*` y `mariadb` llegan juntos en un PR propio. Ese PR queda en
  rojo en `npm ci --strict-allow-scripts` hasta que actualices en el mismo PR las entradas
  `prisma@x.y.z` y `@prisma/engines@x.y.z` de `allowScripts` en `package.json`, después de revisar
  sus scripts de instalación.
- **Acciones:** siguen fijadas por SHA completo; Dependabot actualiza el SHA y el comentario de
  versión.
- **Sin merge automático:** cada merge a `main` despliega en producción. Los PR de Dependabot
  pasan por el mismo CI y se revisan a mano.

### Comprobaciones obligatorias para el merge

Hoy GitHub **no puede bloquear** el merge con el CI en rojo: el repositorio es privado con el
plan Free, que no ofrece protección de rama ni rulesets. La regla es de proceso: no se hace
merge de un PR con `calidad`, `docker`, `despliegue` o `auditoria` en rojo (el agente
`senior-fullstack` no lo entrega como listo para merge).

Si el repositorio pasa a GitHub Pro (o se hace público), para hacerlas obligatorias:

1. **Settings → Rules → Rulesets → New ruleset → New branch ruleset** (o **Settings → Branches
   → Add branch protection rule**).
2. Destino: la rama `main`; estado **Active**.
3. Activa **Require status checks to pass** y agrega `calidad`, `docker`, `despliegue` y
   `auditoria` (aparecen después de que el CI se haya ejecutado al menos una vez).
4. Guarda. Desde entonces, el botón de merge queda bloqueado hasta que las cuatro estén en verde.

## Configuración

La configuración se lee y valida al arrancar (`src/config/env.ts`). Si algo es
inválido, el proceso termina con código 1 y lista los problemas (sin mostrar los valores).

| Variable                   | Obligatoria             | Descripción                                                        |
| -------------------------- | ----------------------- | ------------------------------------------------------------------ |
| `NODE_ENV`                 | Sí                      | `development`, `production` o `test` (exacto). Sin ella, vacía o con otro valor, la app no arranca. `npm run dev` fija `development` y la suite de pruebas `test`; `npm start` no la fija |
| `HOST`                     | No (`127.0.0.1`)        | Dirección en la que escucha el servidor. Solo IP literal IPv4 o IPv6 (`127.0.0.1`, `::1`, `0.0.0.0`, `::`…); `localhost` u otro nombre no es válido. `0.0.0.0` o `::` escuchan en todas las interfaces (solo si se pide; la imagen Docker fija `0.0.0.0`) |
| `PORT`                     | No (`3000`)             | Puerto HTTP (1-65535)                                              |
| `BUSINESS_TIMEZONE`        | No (`America/Mexico_City`) | Zona horaria IANA del negocio, validada con `Intl`              |
| `SITE_URL`                 | No                      | URL pública (http/https, sin query ni fragmento). Hace absolutas la canónica, `og:url` y `og:image`; sin ella la canónica es relativa y se omiten `og:url`/`og:image` |
| `WHATSAPP_MOLOTES_URL`     | Esta o el número        | Enlace https del bot de Molotes; tiene prioridad sobre el número   |
| `WHATSAPP_MOLOTES`         | Esta o la URL           | Número internacional, solo dígitos (8-15)                          |
| `WHATSAPP_MOLOTES_MESSAGE` | No                      | Mensaje inicial (máx. 500), se añade a `wa.me` como `?text=`       |
| `WHATSAPP_BIRRIA_URL`      | Esta o el número        | Igual que arriba, para Birria                                      |
| `WHATSAPP_BIRRIA`          | Esta o la URL           | Igual que arriba, para Birria                                      |
| `WHATSAPP_BIRRIA_MESSAGE`  | No                      | Igual que arriba, para Birria                                      |
| `DATABASE_URL`             | Sí                      | Conexión a MySQL de la app: `mysql://usuario:contraseña@host[:puerto]/base`, sin parámetros; usuario solo DML. Los caracteres especiales van codificados (`@` -> `%40`, `:` -> `%3A`, `/` -> `%2F`, `%` -> `%25`). Secreta: nunca aparece en logs ni errores. Ver [Base de datos](#base-de-datos) |
| `MIGRATION_DATABASE_URL`   | Solo para migrar        | Conexión con DDL para `npm run db:migrate`, `db:migrate:dev` y la imagen `migrate`. La app no la lee |
| `SHADOW_DATABASE_URL`      | Solo `db:migrate:dev`   | Base sombra de Prisma para crear migraciones (desarrollo y CI) |
| `DATA_DIR`                 | Solo en producción (ruta absoluta) | Carpeta de los datos editables: JSON de página y `changes.jsonl` (por defecto `data/` del proyecto fuera de producción). No puede estar dentro de `src/` ni de `public/` |
| `ADMIN_USER`               | No                      | Usuario del **primer administrador** (1-60 caracteres). Solo se usa si la base de datos no tiene usuarios; después se ignora (aviso `admin_bootstrap_ignored` en el log, sin valores). Sin usuarios ni estas variables, `/admin` responde 503 "no disponible"; con solo una de las dos o un hash inválido, la app no arranca |
| `ADMIN_PASSWORD_HASH`      | No                      | Hash scrypt de la contraseña del primer administrador (`npm run admin:hash-password`). Nunca la contraseña en claro |
| `TRUST_PROXY`              | No (`false`)            | `true` detrás de un proxy con TLS (Traefik en producción): Koa usa `X-Forwarded-Proto` (HTTPS) y la última IP de `X-Forwarded-For` (límite de intentos y log) |
| `DATABASE_ALLOW_NEWER_SCHEMA` | No (`false`)         | Solo la pone `deploy/deploy.sh` al volver a la versión anterior: la app arranca aunque la base tenga migraciones que no conoce (REQ-F-016). Nunca en `.env` |
| `WHATSAPP_BOT_*`, `WHATSAPP_GRAPH_API_VERSION` | Todas o ninguna | Bot de WhatsApp; ver [Variables del bot](#variables-del-bot). Sin ninguna, el bot queda deshabilitado |

## HTTP

| Ruta             | Respuesta                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------ |
| `GET /`          | Landing de Birriería El Muñeco, siempre, con el aviso del día en `BUSINESS_TIMEZONE` (lunes descanso, martes a viernes Molotes, fin de semana ninguno; REQ-F-028) |
| `GET /molotes`   | Landing de Moloteando, siempre                                                             |
| `GET /birria`    | Landing de Birriería El Muñeco, siempre                                                    |
| `GET /favicon.ico`, `GET /apple-touch-icon.png`, `GET /apple-touch-icon-precomposed.png` | Icono de Birria, el de `/` (ver [Iconos](#iconos-favicons-y-pantalla-de-inicio)) |
| `GET /molotes.webmanifest`, `GET /birria.webmanifest` | Web App Manifest de cada negocio                                  |
| `GET /<archivo>` | Estáticos de `public/` (sin índices ni archivos ocultos)                                   |
| `/admin/...`     | Administración de menús y productos (ver [Administración de menús](#administración-de-menús))  |
| `/admin/api/...` | API JSON de productos, con sesión (ver [API de productos](#api-de-productos))                |
| `GET`/`POST /webhooks/whatsapp` | Webhook del bot de WhatsApp: verificación de la suscripción y recepción de mensajes firmados (ver [Bot de WhatsApp](#bot-de-whatsapp)); 503 si el bot no está configurado |

Las tres rutas HTML usan el mismo controlador (`src/controllers/landing.ts`): con un
`businessId` fijo renderiza ese negocio y sin él (`/`) renderiza Birria con el aviso del día.
Responden con `Cache-Control: no-cache`, así que cada carga de `/` trae el aviso del día. La
`<link rel="canonical">` siempre apunta a la ruta dedicada (`/` apunta a `/birria`), así que no
hay contenido duplicado para SEO.

El aviso es un `<dialog>` que el servidor pinta cerrado y que abre
`public/js/modules/home-notice.js` una sola vez por sesión del navegador (`sessionStorage`).
Sin JavaScript no se ve ni tapa nada. Sus textos están en `homeNotices`, en
`src/content/birria/index.ts`. En desarrollo (`NODE_ENV=development`), `/?dia=lunes`, `martes`,
`miercoles`, `jueves`, `viernes`, `sabado` o `domingo` fuerza el día del aviso. En `test` y
`production` el parámetro se ignora.
Cualquier otra ruta responde 404 y los métodos distintos de GET/HEAD, 405 (salvo los POST de
la administración y del webhook del bot).

Los errores responden JSON con formato común:

```json
{ "error": { "code": "NOT_FOUND", "message": "Not Found" } }
```

Los errores 5xx usan un mensaje genérico; el stack solo se incluye con `NODE_ENV=development`.
Los logs son JSON por línea en stdout (método, ruta sin query string, estado y duración).

## Bot de WhatsApp

Un solo bot para los dos negocios (REQ-F-009), dentro de esta misma app: el proveedor envía cada
mensaje del cliente al webhook `POST /webhooks/whatsapp` y el bot responde con la API del
proveedor. No hay pago, ni panel de pedidos, ni pedidos guardados.

**Proveedores (REQ-F-012).** El bot funciona con uno de dos proveedores, elegido con
`WHATSAPP_BOT_PROVIDER` (un solo proveedor activo por arranque):

- **`meta`** — WhatsApp Cloud API de Meta. Es el proveedor de **producción**.
- **`twilio`** — API de WhatsApp de Twilio, incluido su sandbox. Solo para **desarrollo**: con
  `NODE_ENV=production` y `twilio` la app no arranca, esté o no habilitado el bot.

Cada proveedor es una implementación de la interfaz `ChatBot`
(`src/services/whatsapp-bot/chat-bot.ts`): `WhatsAppBot` (Meta, `providers/meta/`) y `TwilioBot`
(Twilio, `providers/twilio/`). `ChatBot` cubre solo lo que depende del proveedor: verificación y
firma del webhook, formato de las entregas, respuesta al proveedor, envío y longitud máxima de un
mensaje. La conversación (máquina de estados, catálogo, horario, carrito, textos, deduplicación,
colas, límite por número y logs) existe una sola vez en el orquestador
(`src/services/whatsapp-bot/orchestrator.ts`), que no importa código de ningún proveedor. El
único módulo que conoce las dos implementaciones es `providers/select.ts`; la app, las rutas y
el webhook solo usan `ChatBot`. Cambiar de proveedor es cambiar las variables y reiniciar; al
arrancar queda `bot_provider_selected` con el proveedor en el log.

- **Negocio:** el del día en `BUSINESS_TIMEZONE`, con la misma regla que las landings (L-V
  Moloteando, S-D Birriería El Muñeco). Se fija con el primer mensaje y se mantiene hasta que el
  pedido se confirma o se cancela, o tras 2 h sin actividad. Si el cliente pide el otro negocio
  (p. ej. llega desde `/birria` un martes), el bot le indica sus días y atiende con el del día.
- **Conversación (REQ-F-013):** solo texto. El cliente escribe su pedido como lo diría ("2
  molotes de papa y una coca", "3 quesabirrias y un consomé chico con carne") y los números de
  opción siguen funcionando. Flujo típico, 4 mensajes del cliente: el mensaje de la landing (el
  bot saluda y muestra el menú), el pedido (el bot agrega lo que entendió, muestra el carrito y
  pide los datos con el aviso de privacidad), los datos en un mensaje ("Ana, recoger" o "Ana,
  domicilio, Calle 5 #10, Centro"; el bot pide solo lo que falte) y "sí" en el resumen. En el
  resumen, cualquier otro texto es una nota ("sin notas" la borra) y "agrega …" o "quita …"
  editan el carrito. Lo ambiguo ("uno de epazote", "consomé") se pregunta en un solo mensaje y
  lo que no entiende lo dice. "x2" o "2x" junto al producto es la cantidad. Sin separadores ("2
  tacos 1 coca") separa por las cantidades si cada parte es un producto; si no, no agrega esa
  parte y pide escribirla con comas. "1 de 3 de tinga" es 1 orden de 3 (si la orden del
  catálogo no es de 3, pregunta). En un producto sin orden, "2 órdenes de 3 tacos" son 6 tacos;
  sin la palabra "orden" ("una de 3 de tacos") o sin número ("una orden de tacos"), pregunta
  cuántos y no agrega esa línea. Un fragmento como "…, con carne" o "…, grande" completa la
  línea anterior. Cada línea puede llevar un detalle de hasta 60 caracteres ("sin
  cebolla", "coca sin azúcar") que no cambia el precio y llega al personal. Palabras clave en
  cualquier momento, sin distinguir mayúsculas ni acentos (solo si son el mensaje completo):
  `menú`, `carrito`, `cancelar`, `persona` y `ayuda` ("cancela la coca" quita la coca, no
  cancela el pedido). Menú del catálogo de productos (la misma caché y las mismas reglas de
  visibilidad que la landing; nunca consulta la base de datos), carrito (1 a 20 unidades por
  línea, hasta 15 líneas), resumen con código de referencia (`M-XXXX` o `B-XXXX`) y
  confirmación. Antes de confirmar vuelve a comprobar precios y disponibilidad. Ver
  [Vocabulario del bot](#vocabulario-del-bot).
- **Horario:** sale de `src/content/hours.ts` (REQ-F-010). Fuera de horario avisa cuándo abre,
  deja pedir y marca el resumen "FUERA DE HORARIO". El lunes atiende como Molotes (cerrado; abre
  el martes). Si el negocio no abre ni ese día ni el siguiente (Molotes el viernes después de las
  15:00; Birria el domingo después de las 15:00), muestra el menú pero **no toma el pedido** e
  informa cuándo abre cada negocio. Esa comprobación se hace al empezar el pedido.
- **Aviso al personal:** una sola vez por pedido. Con Meta, siempre con la plantilla aprobada
  (ver [Plantilla del aviso al personal](#plantilla-del-aviso-al-personal)); con Twilio, con un
  Content Template o como texto libre (ver [Twilio](#twilio-desarrollo)). Si falla, el cliente
  recibe el contacto directo del personal (`https://wa.me/<número>`). "persona" da ese mismo
  contacto.
- **Mensajes largos:** se parten por líneas según el límite del proveedor (4096 caracteres con
  Meta, 1600 con Twilio), sin cortar nunca un producto del menú.
- **Textos:** `src/content/common/bot.ts` (flujo y vocabulario común) y
  `src/content/<negocio>/bot.ts` (lema, palabras del negocio, secciones del menú, emojis de los
  productos y vocabulario del negocio).
- **Emojis:** los textos llevan emojis de comida y bebida con moderación: acompañan a la palabra,
  nunca la sustituyen, y como mucho dos por línea. El emoji de cada producto del menú se define
  por slug en `emojis` de `src/content/<negocio>/bot.ts`; un producto sin emoji se muestra sin
  él. El intérprete los ignora, así que un cliente que copie un texto del bot (el ejemplo de
  pedido, una línea del menú o "🏪 Recoger en sucursal") se entiende igual. No van en los
  parámetros de la plantilla de Meta, cuyo texto fija la plantilla aprobada; el aviso en texto
  libre de Twilio empieza con 🔔.
- **Logs del intérprete:** cada mensaje interpretado deja `bot_order_interpreted` con el
  `conversationId`, el negocio y solo contadores (`recognized`, `ambiguous`, `unrecognized`,
  `rejected`, `unavailable`, `otherBusiness`), nunca el texto del cliente ni los detalles.
- **Estado en memoria** (una sola instancia, como las sesiones de `/admin`): si la app se
  reinicia, la conversación en curso se pierde y el bot empieza de nuevo.
- **Celulares de México con Meta:** la Cloud API entrega el `wa_id` como `521` + 10 dígitos,
  pero solo acepta enviar a `52` + 10 (si no, error 131030). Al enviar (respuestas y aviso al
  personal), `providers/meta/cloud-api.ts` quita ese `1`; el identificador del cliente en la
  conversación, la deduplicación, el límite y los logs no cambian. Twilio no lo necesita.

### Prerrequisitos de Meta (los provee el dueño)

No hacen falta para desarrollar ni para las pruebas (usan el simulador), pero sí para la puesta
en producción y la prueba de punta a punta con Meta (CA-26 de REQ-F-009, pendiente):

1. Cuenta de Meta Business (verificada si Meta lo pide por volumen o por las plantillas).
2. App en Meta for Developers con el producto WhatsApp y una cuenta de WhatsApp Business (WABA).
3. Número dedicado al bot, registrado en la Cloud API y que no esté en uso en la app de WhatsApp.
4. Token de acceso permanente (de un usuario del sistema), el ID del número y el ID de la WABA.
5. El secreto de la app (App Secret), para validar la firma.
6. URL pública con HTTPS para el webhook (el dominio del VPS, detrás de Traefik).
7. Plantilla aprobada para el aviso al personal.
8. Método de pago en Meta (ver [Costos de Meta y Twilio](#costos-de-meta-y-twilio)): sin él,
   Meta deja de entregar las respuestas del bot al agotar el cupo gratuito del mes.
9. Números de WhatsApp del personal de Molotes y de Birria.

### Vocabulario del bot

El intérprete de pedidos es determinista y propio (`src/services/whatsapp-bot/interpreter/`):
no usa IA ni servicios externos y se puede sustituir por otro que cumpla la interfaz
`OrderInterpreter` (`interpreter/types.ts`; opción `interpreter` de `createBotOrchestrator`).

- **Reconocimiento por nombre:** cada producto se reconoce por las palabras de su nombre y de
  sus variantes, sin distinguir mayúsculas, acentos, singular o plural ni género ("chico" =
  "Chica"), con tolerancia a errores de ortografía (1 letra en palabras de 4 a 7 letras, 2 en
  palabras de 8 o más; si dos productos empatan, el bot pregunta). Un producto nuevo o renombrado
  en `/admin` se reconoce sin tocar nada.
- **Vocabulario común** (`botVocabulary` en `src/content/common/bot.ts`): cantidades en palabra
  ("una", "media docena"), relleno que se ignora ("hola", "quiero", "por favor"), intención de
  pedir, palabras de entrega, de confirmación, para terminar, para quitar y para agregar. Las
  palabras clave están en `botKeywords`.
- **Vocabulario de cada negocio** (`vocabulary` en `src/content/<negocio>/bot.ts`):
  - `example`: el ejemplo de la invitación a pedir;
  - `separatedExample`: el ejemplo con comas que se da cuando un mensaje sin separadores no se
    puede separar con seguridad ("2 tacos, 1 coca");
  - `genericWords`: palabras que no identifican un producto ("molote" en Molotes, "birria" en
    Birria, porque aparecen en todos los nombres o en el mensaje de la landing);
  - `products`, por slug del producto: `synonyms` (otras formas de llamarlo), `variants`
    (sinónimos por etiqueta de variante) y `details` (detalles reconocidos: identifican el
    producto y quedan como detalle; con `variant`, fijan esa variante).

**Añadir un sinónimo:** agrégalo, en minúsculas y sin acentos, en el slug del producto (el slug
aparece en `/admin/api` o en la base de datos y no cambia nunca). Por ejemplo, para que
"quesadilla" se entienda como el Queso Oaxaca:

```ts
products: Object.freeze({
  'queso-oaxaca': { synonyms: ['quesillo', 'quesadilla'] },
}),
```

Agrega la frase a la batería de `tests/unit/whatsapp-bot-interpreter.test.ts` y ejecuta
`npm test`: la prueba también comprueba que el vocabulario esté normalizado y que sus slugs
existan en las semillas. Un sinónimo de un slug que ya no existe se ignora sin error.

### Costos de Meta y Twilio

Consultados el 2026-10-08 (cambian con el tiempo; revisa las páginas de precios de Meta y de
Twilio):

- **Meta** (tarifas vigentes desde el 1 de octubre de 2026, México, en USD por mensaje
  entregado): marketing 0.0397, utility 0.0085 y servicio (las respuestas del bot dentro de la
  ventana de 24 h) 0.0085. Desde esa fecha Meta vuelve a cobrar los mensajes de servicio, con un
  cupo gratuito de 1000 al mes por número de negocio. El aviso al personal es una plantilla
  utility y se cobra. Los mensajes del cliente no se cobran. Con el flujo de REQ-F-013, un pedido
  usa unos 4 mensajes del bot.
- **Twilio:** 0.005 USD por mensaje (entrante o saliente), más las tarifas de Meta.

Meta no ofrece un límite de gasto para esta cuenta: el límite real lo pone la tarjeta con la que
se paga (tarjeta virtual con límite bajo y alertas de facturación). La app añade sus propios topes
(siguiente sección), con una **estimación** del gasto que puede no coincidir con la factura.

### Topes de gasto, lista negra e interruptor (REQ-F-025)

Controles de cada mensaje entrante, en este orden (uno descartado no cuenta en los siguientes):

1. **Interruptor** (página "Bot" de `/admin`): pausado, el bot no envía nada y descarta lo que
   llega; el webhook sigue respondiendo 200 y las landings y `/admin` siguen igual.
2. **Lista negra:** un número bloqueado no recibe respuesta ni cuenta en los topes.
3. **Enfriamiento:** 5 textos idénticos en 10 minutos (los que no son texto cuentan como el mismo)
   dan 30 minutos sin respuesta; un segundo enfriamiento el mismo día bloquea el número 24 h,
   7 d o 30 d según sus bloqueos automáticos de los últimos 30 días.
4. **Ráfaga y tope por minuto:** 5 mensajes cada 10 s y 20 por minuto; lo demás se ignora.
5. **Tope diario por número:** 60 mensajes procesados; el siguiente recibe **un** mensaje con el
   contacto directo y el número queda bloqueado 7 días.
6. **Cola global:** como mucho 100 mensajes en proceso o en espera; con la cola llena se descartan.
7. Procesamiento. Una conversación nueva con los pedidos del día del número agotados (3) o con el
   tope de avisos al personal alcanzado recibe el contacto directo (como mucho una vez cada 2 h).
8. **Topes globales antes de cada envío:** avisos al personal (60 al día, 1500 al mes), mensajes
   del bot al cliente (800 al día, 12 000 al mes; cada parte de un texto largo cuenta) y
   presupuesto mensual estimado (20 USD). Gasto estimado = avisos del mes × tarifa utility +
   máx(0, mensajes del mes − cupo gratuito) × tarifa de servicio. Con el tope de avisos, quien
   confirma recibe el contacto directo y no se envía la plantilla; con el de mensajes o el
   presupuesto, silencio hasta el siguiente periodo. Un envío que el proveedor rechaza no cuenta.

Los números del personal (`WHATSAPP_BOT_STAFF_*`) están exentos de los topes por número y de los
repetidos, y no se pueden bloquear. `521…` y `52…` de un celular de México son el mismo número.
Los días y meses se cuentan en `BUSINESS_TIMEZONE`.

- **Persistencia:** la lista negra, la auditoría (`bot_audit`), los contadores globales
  (`bot_usage`) y el interruptor (`bot_control`) están en MySQL; los topes por número, los
  enfriamientos y "alcanzaron un tope hoy" viven en memoria y se pierden al reiniciar.
- **Con MySQL caído,** el bot sigue con la última copia conocida de la lista negra y del
  interruptor y registra `bot_control_store_failed` (una vez por caída); los contadores y las
  altas automáticas se guardan cuando vuelve.
- **Privacidad:** de cada número bloqueado solo se guardan un HMAC-SHA256 con
  `WHATSAPP_BOT_BLOCKLIST_KEY` (que no está en la base) y sus 4 últimos dígitos. Las entradas
  vencidas o quitadas se borran a los 30 días; la auditoría, a los 12 meses; los contadores
  diarios, a los 13 meses (mantenimiento al arrancar y cada hora).
- **Página "Bot" de `/admin`** (solo administradores): contadores de hoy y del mes frente a sus
  topes, interruptor, "alcanzaron un tope hoy" (con "Bloquear"), lista negra con alta (número,
  duración de 24 h, 7 d, 30 d o permanente y motivo opcional, sin números de teléfono) y baja.
  Cada alta, baja, caducidad y cambio del interruptor queda en `bot_audit`.
- **Rotar la clave:** pon la nueva en `WHATSAPP_BOT_BLOCKLIST_KEY` y la anterior en
  `WHATSAPP_BOT_BLOCKLIST_KEY_PREVIOUS`. Cada número bloqueado pasa a la clave nueva cuando vuelve
  a escribir; la página "Bot" muestra cuántos siguen con la anterior. Quita la anterior cuando
  llegue a 0 (o cuando esos bloqueos hayan vencido): si se pierde una clave, sus bloqueos dejan
  de aplicarse.
- **Desplegar con el bot ya activo:** la clave es obligatoria con el bot. Añádela al `.env` del
  VPS **antes** de desplegar la versión que la exige; sin ella, la app nueva no arranca y el
  despliegue vuelve a la versión anterior.

### Variables del bot

El bot queda habilitado si defines al menos una variable de datos del bot (todas las de la tabla
salvo `WHATSAPP_BOT_PROVIDER`, que no lo habilita por sí sola; un valor vacío cuenta como no
definido). Sin ninguna, el bot queda deshabilitado (el webhook responde 503 y las landings siguen
igual). Habilitado, el proveedor y sus obligatorias deben estar y ser válidas o la app no arranca
(lista los problemas sin mostrar valores). Las variables que solo usa el otro proveedor se
ignoran. Con el bot, `WHATSAPP_MOLOTES` y `WHATSAPP_BIRRIA` deben ser el número del bot (el
mismo): el botón de cada landing abre ese chat con su propio mensaje inicial.

Los dos proveedores comparten los nombres de los datos de la cuenta. `WHATSAPP_BOT_PHONE_NUMBER_ID`
se renombró a **`WHATSAPP_BOT_ACCOUNT_ID`**, sin compatibilidad: si la anterior sigue definida, la
app no arranca y pide renombrarla.

| Variable | Meta (`meta`) | Twilio (`twilio`) |
| --- | --- | --- |
| `WHATSAPP_BOT_PROVIDER` | `meta` | `twilio` (sin distinguir mayúsculas). Obligatoria con el bot habilitado |
| `WHATSAPP_BOT_ACCOUNT_ID` | Obligatoria: ID del número del bot en la Cloud API (solo dígitos; no es el teléfono) | Obligatoria: Account SID (`AC` + 32 hexadecimales) |
| `WHATSAPP_BOT_ACCESS_TOKEN` | Obligatoria: token permanente del usuario del sistema (secreto; sin espacios) | Obligatoria: Auth Token (secreto; 32 hexadecimales). Autentica los envíos y firma el webhook |
| `WHATSAPP_BOT_STAFF_MOLOTES` | Obligatoria: WhatsApp del personal de Molotes; recibe los pedidos y es el contacto directo (solo dígitos, formato internacional) | Igual (se envía como `whatsapp:+<dígitos>`) |
| `WHATSAPP_BOT_STAFF_BIRRIA` | Igual, para Birria | Igual, para Birria |
| `WHATSAPP_BOT_STAFF_TEMPLATE` | Obligatoria: nombre de la plantilla del aviso (minúsculas, dígitos y `_`) | Opcional: `ContentSid` (`HX…`) de un Content Template; sin ella, el aviso va como texto libre |
| `WHATSAPP_BOT_APP_SECRET` | Obligatoria: secreto de la app de Meta; valida `X-Hub-Signature-256` (secreto) | No aplica (se ignora) |
| `WHATSAPP_BOT_VERIFY_TOKEN` | Obligatoria: token de verificación del webhook, 16 a 128 caracteres `[A-Za-z0-9._~-]` (secreto; p. ej. `openssl rand -hex 32`) | No aplica |
| `WHATSAPP_BOT_STAFF_TEMPLATE_LANGUAGE` | Opcional (`es_MX`): idioma de la plantilla | No aplica |
| `WHATSAPP_GRAPH_API_VERSION` | Opcional (`v26.0`): versión de la Graph API (formato `vNN.N`) | No aplica |
| `WHATSAPP_BOT_WEBHOOK_URL` | No aplica | Obligatoria: URL https completa del webhook, exactamente la configurada en Twilio, terminada en `/webhooks/whatsapp`, sin query ni fragmento |
| `WHATSAPP_BOT_BLOCKLIST_KEY` | Obligatoria: clave del seudónimo de la lista negra, ≥ 32 bytes en base64, base64url o hex (secreto; `openssl rand -base64 32`). No habilita el bot | Igual |
| `WHATSAPP_BOT_BLOCKLIST_KEY_PREVIOUS` | Opcional: clave anterior durante una rotación | Igual |
| `WHATSAPP_MOLOTES` | Número del bot (igual a `WHATSAPP_BIRRIA`) | Igual, y además es el número emisor (`From`): con el sandbox, `14155238886` |

Las bases de las API son fijas (`https://graph.facebook.com` y `https://api.twilio.com`): los
tokens nunca se envían a otro host, ni van en una URL ni en un log.

Umbrales de la protección (REQ-F-025; opcionales, vacíos = valor por defecto; un valor inválido
impide arrancar con un mensaje que nombra la variable):

| Variable | Defecto | Valores |
| --- | --- | --- |
| `BOT_LIMIT_ORDERS_PER_NUMBER_DAY` | 3 | entero 1-100 |
| `BOT_LIMIT_MESSAGES_PER_NUMBER_DAY` | 60 | entero 5-10 000 |
| `BOT_LIMIT_MESSAGES_PER_MINUTE` | 20 | entero 1-1000 |
| `BOT_LIMIT_BURST` / `BOT_LIMIT_BURST_WINDOW_SECONDS` | 5 / 10 | entero 1-100 / 1-3600 |
| `BOT_LIMIT_TEMPLATES_DAY` / `BOT_LIMIT_TEMPLATES_MONTH` | 60 / 1500 | entero 1-100 000; diario ≤ mensual |
| `BOT_LIMIT_OUTBOUND_DAY` / `BOT_LIMIT_OUTBOUND_MONTH` | 800 / 12 000 | entero 1-1 000 000; diario ≤ mensual |
| `BOT_BUDGET_MONTH_USD` | 20 | USD > 0 y ≤ 10 000, con punto y hasta 4 decimales |
| `BOT_COST_UTILITY_USD` / `BOT_COST_SERVICE_USD` | 0.0085 / 0.0085 | USD de 0 a 1, hasta 6 decimales |
| `BOT_FREE_SERVICE_MONTH` | 1000 | entero 0-1 000 000 |
| `BOT_REPEAT_COUNT` / `BOT_REPEAT_WINDOW_MINUTES` / `BOT_COOLDOWN_MINUTES` | 5 / 10 / 30 | entero 2-100 / 1-1440 / 1-1440 |
| `BOT_BLOCK_CAP_DAYS` | 7 | entero 1-365 |
| `BOT_BLOCK_REPEAT_STEPS_HOURS` | `24,168,720` | de 1 a 5 horas crecientes (1-8760) |
| `BOT_BLOCK_HISTORY_DAYS` | 30 | entero 1-365 |
| `BOT_AUDIT_RETENTION_MONTHS` | 12 | entero 1-120 |
| `BOT_QUEUE_MAX` | 100 | entero 1-10 000 |
| `BOT_CONTROL_REFRESH_SECONDS` | 10 | entero 1-300 |

### Registrar el webhook en Meta (producción)

1. Define las variables del bot con `WHATSAPP_BOT_PROVIDER=meta` y despliega la app detrás de
   Traefik con HTTPS (`TRUST_PROXY=true`; ver [docs/despliegue.md](docs/despliegue.md)).
2. En la app de Meta: WhatsApp → Configuración → Webhook. URL de devolución de llamada:
   `https://<tu-dominio>/webhooks/whatsapp`; token de verificación: el valor de
   `WHATSAPP_BOT_VERIFY_TOKEN`. Meta hace `GET` con `hub.mode=subscribe`, `hub.verify_token` y
   `hub.challenge`; la app devuelve el reto solo si el token coincide (si no, 403).
3. Suscribe el campo `messages`.
4. Cada entrega llega con `X-Hub-Signature-256` (HMAC-SHA256 del cuerpo con el App Secret). Sin
   firma o mal formada responde 401; si no coincide, 403. En ambos casos no se procesa y queda
   `bot_webhook_signature_invalid` en el log. Las entregas válidas reciben 200 enseguida y se
   procesan en segundo plano.

Meta reintenta durante días las entregas que no reciben 200 y puede duplicarlas: el bot procesa
cada mensaje una sola vez (por su id) e **ignora los mensajes de hace más de 2 h**
(`bot_message_stale`; tras una caída, el cliente tendrá que volver a escribir). Además, ignora
los mensajes de un mismo número por encima de 20 por minuto (`bot_rate_limited`).

### Plantilla del aviso al personal

El número del personal casi nunca tiene abierta la ventana de 24 h con el bot, así que el aviso
se envía **siempre** con una plantilla utility, que se cobra (ver
[Costos de Meta y Twilio](#costos-de-meta-y-twilio)). Créala en el Administrador de WhatsApp con:

- **Categoría:** Utility. **Idioma:** Español (México), `es_MX` (o el de
  `WHATSAPP_BOT_STAFF_TEMPLATE_LANGUAGE`). **Nombre:** `nuevo_pedido` (el valor de
  `WHATSAPP_BOT_STAFF_TEMPLATE`).
- **Tipo de parámetros:** con nombre. **Solo cuerpo** (sin encabezado, pie ni botones):

```text
Hola, acaba de llegar un nuevo pedido por WhatsApp.

Código del pedido: {{codigo}}
Negocio: {{negocio}}
Horario: {{horario}}
Nombre del cliente: {{cliente}}
WhatsApp del cliente: {{whatsapp}}
Forma de entrega: {{entrega}}
Productos: {{lineas}}
Total a cobrar: {{total}}
Notas del cliente: {{notas}}

Por favor confirma el pedido respondiendo directamente al cliente por WhatsApp.
```

Meta exige suficiente texto fijo en proporción a las variables: un cuerpo con poco texto fijo se
rechaza con el error 2388293 ("demasiadas variables en relación con su longitud"). Por eso cada
variable va con su etiqueta y el cuerpo abre y cierra con una frase fija. La plantilla vigente se
llama `nuevo_pedido` (Utility, `es_MX`, parámetros con nombre).

Ejemplos para la revisión de Meta: `codigo` M-4F7K, `negocio` Moloteando, `horario` En horario,
`cliente` Ana Pérez, `whatsapp` +5215512345678, `entrega` Recoger en sucursal, `lineas`
2 × Molotes de Queso Oaxaca (orden de 3) a $130 = $260; 1 × Aguas Frescas Naturales del Día a
$35 = $35, `total` $295, `notas` Sin notas.

Los valores nunca llevan saltos de línea ni tabuladores (la API los rechaza): las líneas del
pedido van separadas por `; ` y llevan su detalle (`2 × Taco de Birria con Tortilla de Mano ·
sin cebolla a $40 = $80`). El cuerpo de la plantilla admite como máximo 1024 caracteres: si un
pedido muy grande no cabe, `lineas` se abrevia por niveles (sin precio unitario, detalles más
cortos y, al final, cada línea recortada con el prefijo "(abreviado)"); si aun así no cabe (nombre,
dirección y notas al máximo), se recortan con "…" las notas, después la entrega y, por último, el nombre del cliente. Nunca se omite una línea,
una cantidad ni el total, y queda `bot_staff_notice_compacted` en el log. Este texto de la
plantilla debe coincidir con `STAFF_TEMPLATE_BODY` (`src/services/whatsapp-bot/messages.ts`);
una prueba lo comprueba. Si Meta acepta el aviso pero avisa después de que no se entregó
(estado `failed`, p. ej. plantilla pausada o número del personal sin WhatsApp), el cliente ya
recibió la confirmación: **ese pedido puede perderse sin aviso**. Queda
`bot_staff_delivery_failed` (con el negocio y el código de error) en el log; vigílalo.

### Twilio (desarrollo)

Sirve para probar el bot de punta a punta desde tu computadora con el **sandbox de WhatsApp de
Twilio**, sin la cuenta de Meta. Nunca se usa en producción.

**Prerrequisitos (los provee el desarrollador):**

1. Una cuenta de Twilio con el sandbox de WhatsApp activado (Console → Messaging → Try it out →
   Send a WhatsApp message).
2. El **Account SID** y el **Auth Token** de la cuenta (Console → Account info). El Auth Token es
   secreto: solo va en tu `.env` local, nunca en el repositorio, en un ticket ni en el chat.
3. Desde el teléfono de prueba **y desde los teléfonos del personal**, envía al número del
   sandbox (+1 415 523 8886) el mensaje `join <palabra>` que muestra la consola. **La unión
   caduca** (a los pocos días): si un teléfono deja de recibir mensajes, vuelve a enviar
   `join <palabra>`. Si el personal no está unido, el aviso falla, el cliente recibe el contacto
   directo y el log registra el error (`bot_staff_send_failed` o `bot_staff_delivery_failed`,
   con el código de Twilio).
4. Un **túnel HTTPS** hacia la app local (p. ej. `cloudflared tunnel --url http://127.0.0.1:3000`
   o `ngrok http 3000`).

**Configuración:**

1. En `.env`: `WHATSAPP_BOT_PROVIDER=twilio`, el Account SID en `WHATSAPP_BOT_ACCOUNT_ID`, el
   Auth Token en `WHATSAPP_BOT_ACCESS_TOKEN`, los teléfonos del personal en
   `WHATSAPP_BOT_STAFF_MOLOTES` y `WHATSAPP_BOT_STAFF_BIRRIA`, y en `WHATSAPP_BOT_WEBHOOK_URL` la
   URL del túnel con la ruta: `https://<túnel>/webhooks/whatsapp`.
2. Cambia `WHATSAPP_MOLOTES` y `WHATSAPP_BIRRIA` al número del sandbox (`14155238886`): es el
   número emisor del bot y el chat que abren los botones de las landings.
3. En la consola del sandbox (Sandbox settings), en **"When a message comes in"**, pon
   exactamente la misma URL (`https://<túnel>/webhooks/whatsapp`, método `POST`). El campo
   "Status callback URL" del sandbox puede quedar vacío: cada envío del bot ya pide su
   `StatusCallback` a esa misma URL.
4. Arranca con `npm run dev`. Cada vez que cambie la URL del túnel, actualiza las dos cosas
   (`.env` y la consola) y reinicia.

**Cómo funciona con Twilio:**

- Twilio no verifica el webhook por `GET`: con Twilio, `GET /webhooks/whatsapp` responde 405.
- Cada entrega llega como formulario con `X-Twilio-Signature`: HMAC-SHA1 en Base64, con el Auth
  Token, de la **URL configurada** (`WHATSAPP_BOT_WEBHOOK_URL`, nunca la que reconstruye la
  petición: detrás de un túnel o de nginx cambia) seguida de los parámetros ordenados. Sin firma
  o mal formada responde 401; si no coincide (p. ej. la URL del túnel cambió y no actualizaste
  `.env`), 403. En ambos casos no se procesa y queda `bot_webhook_signature_invalid` en el log.
  Las entregas válidas reciben 200 con TwiML vacío y se procesan en segundo plano; el bot
  responde con la API de mensajes.
- Twilio no envía la hora del mensaje: la antigüedad y el orden se calculan con la hora de
  recepción. Cada mensaje se procesa una sola vez (por su `MessageSid`). Un mensaje con adjuntos
  o sin texto recibe "Por ahora solo entiendo mensajes de texto".
- **Aviso al personal:** con `WHATSAPP_BOT_STAFF_TEMPLATE` (un `ContentSid` `HX…`), se envía con
  ese Content Template y sus variables numeradas en este orden: `{{1}}` código, `{{2}}` negocio,
  `{{3}}` horario, `{{4}}` cliente, `{{5}}` WhatsApp, `{{6}}` entrega, `{{7}}` líneas (separadas
  por `; `), `{{8}}` total y `{{9}}` notas. Sin ella, se envía como **texto libre** con el mismo
  contenido (una línea por producto). Si un pedido muy grande supera 1600 caracteres, el texto va
  en varias partes ordenadas; si alguna falla, el cliente recibe el contacto directo.
- **Limitaciones del sandbox:** no admite plantillas propias (el aviso va como texto libre) y el
  texto libre solo se entrega si el personal escribió al sandbox en las últimas 24 h. Si la
  ventana venció, Twilio acepta el envío pero lo rechaza después: llega como `StatusCallback`
  `failed` o `undelivered` y queda `bot_staff_delivery_failed` en el log (el cliente ya recibió
  la confirmación). Antes de probar, que el personal le escriba al sandbox.
- El sandbox no reproduce las plantillas ni la facturación de Meta: no sustituye la prueba de
  punta a punta con Meta.

### Logs y privacidad

Eventos: `bot_provider_selected` (al arrancar, solo con el proveedor), `bot_conversation_started`,
`bot_order_confirmed`, `bot_order_cancelled`, `bot_staff_send_failed`,
`bot_staff_delivery_failed`, `bot_webhook_signature_invalid`, `bot_webhook_verify_failed`,
`bot_api_error`, `bot_message_stale`, `bot_message_out_of_order`, `bot_rate_limited`,
`bot_webhook_ignored` y `bot_conversation_evicted`. De la protección (REQ-F-025):
`bot_paused_dropped` y `bot_queue_full` (como mucho uno por minuto, con el número de descartes),
`bot_blocked_message` (como mucho uno por número y hora), `bot_burst_limited`,
`bot_cooldown_started`, `bot_number_cap_reached`, `bot_auto_blocked`, `bot_conversation_refused`,
`bot_order_not_sent`, `bot_daily_cap_reached` y `bot_monthly_cap_reached` (nivel error, sin
números), `bot_block_added`, `bot_block_removed`, `bot_control_paused`, `bot_control_resumed`,
`bot_control_store_failed`, `bot_control_store_recovered` y `bot_control_maintenance`. El número del cliente va enmascarado (solo
los 4 últimos dígitos). Nunca se registran el texto de los mensajes, el nombre, la dirección,
las notas, el código de referencia, los tokens, el Account SID ni el mensaje de error del
proveedor (solo su código).
La línea `request` de cada petición HTTP lleva la IP del cliente y el esquema (REQ-F-016, para
diagnosticar abusos y el límite de `/admin`); nunca la query. En el VPS los logs de Docker rotan a
10 MB x 5 archivos por contenedor, lo que limita cuánto tiempo se conserva la IP.
El nombre y la dirección se piden con un aviso de privacidad y se borran de memoria al cerrar la
conversación. Se recomienda publicar el Aviso de Privacidad del negocio (LFPDPPP).

### Probar el bot en local

```sh
npm run bot:chat                              # simula Meta, hora actual
npm run bot:chat -- --ahora 2026-10-09T16:00  # viernes 16:00 (hora del negocio): Molotes no toma pedidos
npm run bot:chat -- --proveedor twilio        # simula Twilio (aviso al personal en texto libre)
```

Arranca la app en 127.0.0.1 con los productos de las semillas (en memoria; no toca `DATA_DIR`
ni tu `.env`) y el bot del proveedor elegido conectado a su simulador
(`tests/support/cloud-api-double.ts` o `tests/support/twilio-api-double.ts`). Cada línea que
escribes llega al webhook como un mensaje firmado igual que los del proveedor; verás las
respuestas del bot y el aviso que recibiría el personal. Ninguna petición sale a internet.
Comandos: `/hora AAAA-MM-DDTHH:MM`, `/audio` (mensaje que no es texto) y `/salir`. Solo para
desarrollo (no está en la imagen de producción). Las pruebas automáticas usan los mismos
simuladores con entregas de ejemplo en `tests/fixtures/whatsapp/` (Meta) y
`tests/fixtures/twilio/` (Twilio), y una batería de contrato
(`tests/integration/chat-bot-contract.test.ts`) recorre los mismos casos con los dos
proveedores. Ninguna prueba llama a Meta ni a Twilio (`tests/setup/no-meta.ts` lo impide).

## Menús

Los datos editables de cada landing están en dos sitios (REQ-F-008):

| Qué | Dónde | Semilla versionada |
| --- | ----- | ------------------ |
| **Productos**: platillos y bebidas de Molotes, platillos de Birria (con sus variantes o chips) | Base de datos MySQL (tablas `product`, `product_variant`, `product_chip`) | Las listas de `src/content/<negocio>/seed.json` (solo para la importación inicial) |
| **Página**: showcase del hero, texto destacado del menú ("8 Sabores de Barrio") y promoción | JSON por negocio (`DATA_DIR/<negocio>/current.json`) | `src/content/<negocio>/seed.json` |

- **Modelo común de producto** (`src/services/product-schema.ts`): negocio, categoría
  (`platillo` o `bebida`; Birria solo tiene platillos), slug, nombre, descripción, etiqueta
  (badge en Molotes, tag en Birria), precio y unidad, disponible, posición, imagen, versión y
  fechas. Según la combinación: tono, precio y cantidad por orden (Molotes platillo); icono y
  tono (Molotes bebida); tipo de detalle (`chips`, `portion` o `variants`) y su bloque (Birria).
  Un campo que no corresponde a la combinación se rechaza.
- **Reglas:** precios mayores que $0 y hasta $5,000.00 con 2 decimales como máximo (se guardan en
  centavos); las longitudes y listas cerradas de REQ-F-001; la imagen debe existir en
  `public/img/`; como máximo 50 productos activos por negocio y de 1 a 6 variantes o chips. El
  slug se genera a partir del nombre (minúsculas, sin acentos, con guiones), no se edita y nunca
  se reutiliza: si ya existe en el negocio, aunque esté eliminado, recibe `-2`, `-3`, … La
  categoría y el tipo de detalle se eligen al crear y no cambian. Un producto nuevo o recuperado
  queda al final de su categoría y no disponible.
- **Eliminar** es lógico: el producto deja de verse y se puede recuperar.
- Las semillas tienen los datos originales del diseño fuente; `tests/unit/content.test.ts`
  comprueba que coincidan con `../_stich_source_/` y que sus fotos existan.
- El esquema del JSON de página está en `src/services/menu-schema.ts`. El formato de los precios
  (`$45 c/u`, `$155 MXN`, `$45.50`) se aplica en `src/views/landings/`.
- Disponibilidad: lo no disponible se oculta (`src/services/visible-menu.ts`). En Birria, la
  variante activa es la primera disponible y de ella salen el precio y la descripción de la
  tarjeta; un platillo sin variantes disponibles se oculta. Si una sección se queda sin
  productos, conserva su encabezado y muestra un aviso con el CTA de WhatsApp.
- En Birria, `slug` forma los id del DOM (`card-`, `title-`, `price-`, `desc-`, `variants-`)
  que usa el selector de variantes (`public/js/modules/variant-selector.js`).
- La landing combina los datos de página del repositorio de menús con los productos del
  repositorio de productos (`src/repositories/`). Los dos los mantienen en memoria: las landings
  nunca consultan la base de datos, y un cambio guardado se ve en la siguiente petición. Si la
  base de datos falla con el servidor en marcha, las landings siguen mostrando los últimos
  productos válidos.
- **Importación única:** en el primer arranque con una base sin productos, cada negocio importa
  sus productos (orden, disponibilidad, variantes y chips) desde `current.json` si es válido; si
  no, desde `previous.json`; si tampoco, desde la semilla. Los `id` de Molotes pasan a ser slugs
  y los slugs de Birria se conservan. Queda en el log (`products_imported`, con la fuente) y en
  el registro de productos con el autor `sistema`. No se repite nunca (tabla `product_import`),
  aunque después se vacíe el negocio.

## Administración de menús

`/admin/molotes` y `/admin/birria` permiten gestionar los productos (crear, editar, eliminar,
recuperar y ordenar) y editar los datos de página, con formularios HTML (sin JavaScript). No hay diseño en `_stich_source_/` para estas páginas: la
interfaz es sencilla, con su propia hoja (`public/css/admin/main.css`).

Cada persona entra con su **cuenta personal** (REQ-F-007), guardada en la base de datos:

| Rol | Puede |
| --- | ----- |
| Administrador | Editar los dos negocios (productos y página, también por la API) y gestionar usuarios |
| Editor | Editar solo sus negocios asignados (al menos uno), también por la API. En otro negocio (incluso para leer sus productos), o en la gestión de usuarios, recibe 403 y no se escribe nada |

| Ruta | Acción |
| ---- | ------ |
| `GET /admin` | Inicio: solo enlaza a lo que el usuario tiene permitido |
| `GET` / `POST /admin/login` | Acceso con usuario (sin distinguir mayúsculas) y contraseña |
| `POST /admin/logout` | Cierre de sesión |
| `GET` / `POST /admin/<negocio>` | Lista de productos y formulario de página (hero, destacado y promoción) con su guardado (POST-redirect-GET) |
| `GET /admin/<negocio>/productos/nuevo?categoria=…` | Producto nuevo (en Birria, primero se elige el tipo de detalle) |
| `POST /admin/<negocio>/productos` | Crear producto |
| `GET` / `POST /admin/<negocio>/productos/<id>` | Editar producto (incluye "Guardar mis cambios de todos modos" tras un conflicto) |
| `GET` / `POST /admin/<negocio>/productos/<id>/eliminar` | Confirmar y eliminar |
| `POST /admin/<negocio>/productos/<id>/subir` y `…/bajar` | Mover una posición |
| `GET /admin/<negocio>/productos/eliminados`, `POST …/<id>/recuperar` | Productos eliminados y recuperar |
| `GET` / `POST /admin/<negocio>/restaurar-anterior` | Confirmación y restauración de la versión anterior |
| `POST /admin/<negocio>/restaurar-semilla` | Solo con datos dañados: vuelve a la semilla |
| `GET /admin/usuarios` | Lista de usuarios (solo administradores) |
| `GET /admin/usuarios/nuevo`, `POST /admin/usuarios` | Crear usuario |
| `GET` / `POST /admin/usuarios/<id>` | Editar usuario, nombre visible, rol y negocios |
| `POST /admin/usuarios/<id>/desactivar` y `…/reactivar` | Desactivar o reactivar (los usuarios no se eliminan) |
| `GET` / `POST /admin/usuarios/<id>/contrasena` | Restablecer la contraseña de otro usuario |
| `GET` / `POST /admin/cuenta` | Mi cuenta: cambiar la propia contraseña (pide la actual) |

### Productos en la administración

- Variantes y chips se editan en 6 filas fijas: las filas vacías se ignoran, "Posición" las
  ordena y "Quitar esta fila" elimina una.
- Cada producto tiene una versión. Si otra persona lo cambió mientras lo editabas, no se guarda
  nada y se muestra quién y cuándo, con "Guardar mis cambios de todos modos" o "Descartar y cargar
  la versión actual" (al eliminar: "Eliminar de todos modos"). Editar productos distintos a la
  vez no genera conflicto.
- "Último cambio" muestra el más reciente entre productos y datos de página.

### API de productos

API JSON bajo `/admin/api`, **sin lectura pública**: todas las rutas exigen la sesión de la
administración y el permiso sobre el negocio. Las escrituras exigen además el token CSRF en la
cabecera `X-CSRF-Token` (y, en producción, HTTPS).

| Método y ruta | Qué hace |
| ------------- | -------- |
| `GET /admin/api/sesion` | Usuario de la sesión, negocios permitidos y `csrfToken` |
| `GET /admin/api/<negocio>/productos` | Lista de activos por categoría y orden (`?eliminados=1` incluye los eliminados; `?categoria=platillo\|bebida`) |
| `POST /admin/api/<negocio>/productos` | Crear (201 y `Location`): `category`, `detailsType` (Birria) y los campos de la combinación |
| `GET /admin/api/<negocio>/productos/<id>` | Ver |
| `PUT /admin/api/<negocio>/productos/<id>` | Reemplazar todos los campos editables, con `version` y `available` |
| `DELETE /admin/api/<negocio>/productos/<id>?version=<n>` | Eliminar (lógico) |
| `POST /admin/api/<negocio>/productos/<id>/recuperar` | Recuperar: `{ "version": n }` |
| `PUT /admin/api/<negocio>/productos/orden` | Reordenar una categoría: `{ "category": "platillo", "items": [{ "id", "version" }, …] }` con exactamente los activos de esa categoría |

- **Precios:** se envían en pesos (`45`, `45.5` o `"45.50"`) en `price`, `orderPrice` y
  `variants[].price`; las respuestas traen el precio en pesos (`"45.50"`) y en centavos
  (`priceCents`, `orderPriceCents`, `variants[].priceCents`).
- **Autor:** siempre el usuario de la sesión. Un campo `author` (o cualquier campo desconocido,
  de otra combinación o de solo lectura) se rechaza con 422.
- **Comprobaciones y códigos**, en este orden: sesión (401 `UNAUTHENTICATED`) → permiso sobre el
  negocio (403 `FORBIDDEN_BUSINESS`) → en escrituras, origen y token (403 `CSRF_INVALID`) →
  producto del negocio (404 `PRODUCT_NOT_FOUND`, también si es de otro negocio) → cuerpo (413,
  415 si no es `application/json`, 400 `INVALID_JSON`) → validación (422 `VALIDATION_FAILED`, con
  `fields`: `{ "ruta": "mensaje" }`) → versión (409 `VERSION_CONFLICT`, con `current`: versión,
  `updatedAt` y `updatedBy`). La administración deshabilitada, HTTP en producción o la base de
  datos caída responden 503.

Ejemplo con `curl` (el acceso es el mismo formulario de la administración):

```sh
curl -c cookies.txt -X POST https://<sitio>/admin/login -d 'username=<usuario>' --data-urlencode 'password=<contraseña>'
TOKEN=$(curl -s -b cookies.txt https://<sitio>/admin/api/sesion | jq -r .csrfToken)
curl -s -b cookies.txt https://<sitio>/admin/api/molotes/productos
curl -s -b cookies.txt -X POST https://<sitio>/admin/api/molotes/productos \
  -H 'Content-Type: application/json' -H "X-CSRF-Token: $TOKEN" \
  -d '{"category":"bebida","name":"Café de Olla","description":"Con canela.","icon":"coffee","tone":"amber","price":"30"}'
```

### Usuarios

- **Datos:** usuario de acceso (único sin distinguir mayúsculas, 1-60 caracteres), nombre
  visible (1-60; es el autor de los cambios), rol, negocios del editor, activo o no y fechas de
  creación, actualización y último acceso. Contraseñas de 12 a 256 caracteres, guardadas como
  hash scrypt.
- **Primer administrador:** en el primer arranque sin usuarios se crea con `ADMIN_USER` y
  `ADMIN_PASSWORD_HASH` (la cuenta de siempre sigue funcionando). Después esas variables se
  ignoran y los usuarios se gestionan desde `/admin/usuarios`.
- **Siempre hay al menos un administrador activo:** no se puede desactivar ni pasar a editor al
  último, tampoco a uno mismo.
- **Sesiones:** desactivar a un usuario, cambiarle el rol o los negocios, o restablecer su
  contraseña cierra sus sesiones abiertas; cambiar la propia contraseña cierra las demás. Una
  cuenta desactivada no puede entrar (mismo mensaje que con credenciales incorrectas).
- **Edición simultánea de un usuario:** gana la última escritura; las dos quedan en la auditoría.
- **Auditoría (`user_audit`):** fecha, quién (usuario, `console` o `system`), a quién y la
  acción (`bootstrap`, `create`, `update`, `deactivate`, `reactivate`, `password_reset`,
  `password_change`, `console_recovery`), con los campos cambiados. Nunca guarda contraseñas ni
  hashes. No tiene pantalla: se consulta en la base de datos.

### Recuperar el acceso

No hay recuperación por correo. Un administrador restablece la contraseña de otro usuario desde
`/admin/usuarios`. Si se pierde la del último administrador:

```sh
npm run admin:recover -- --usuario <nombre>                                  # sin Docker
docker exec -it restaurante node scripts/admin-recover.ts --usuario <nombre>  # en el contenedor
```

Pide la contraseña nueva dos veces sin mostrarla (al menos 12 caracteres) y trabaja sobre la base
de `DATABASE_URL`. No migra: antes verifica la base (hasta 10 s de espera) y, si no está lista
(sin migrar, inalcanzable, credenciales inválidas), termina con código 1 y un mensaje con el
código, sin detalles técnicos. Si el usuario no existe, crea un
administrador; si existe, lo reactiva, lo deja como administrador y le cambia la contraseña.
Funciona con el servidor parado o en marcha: en ese caso sus sesiones abiertas se cierran. Queda
en la auditoría como `console_recovery`. Si la base de datos no tenía usuarios, `/admin` se
habilita sin reiniciar.

### Seguridad

- Sesión en memoria con cookie `admin_sid` (`HttpOnly`, `SameSite=Strict`, `Path=/admin` y
  `Secure` en producción). Caduca tras 2 horas sin actividad; un reinicio cierra las sesiones.
- 5 intentos de acceso fallidos desde la misma IP la bloquean 15 minutos.
- Todas las acciones son POST con token CSRF (control principal) y comprobación de
  `Origin`/`Sec-Fetch-Site`: se rechazan los orígenes ajenos y `Sec-Fetch-Site` distinto de
  `same-origin`; `Origin: null` solo se acepta si el navegador confirma `Sec-Fetch-Site: same-origin`.
  Las páginas de `/admin` envían `Referrer-Policy: same-origin` (las landings mantienen
  `no-referrer`) para que el navegador mande el `Origin` real en sus formularios.
- Las respuestas de `/admin` llevan `Cache-Control: no-store` y `X-Robots-Tag: noindex, nofollow`;
  las landings no enlazan a `/admin`.
- En producción solo funciona por HTTPS. En el VPS lo da Traefik (REQ-F-016), que añade
  `X-Forwarded-Proto` y `X-Forwarded-For`, y `deploy/compose.prod.yaml` fija `TRUST_PROXY=true`.
  Con otro proxy, define `TRUST_PROXY=true` y reenvía esas cabeceras. Traefik además limita
  `/admin` a 10 peticiones por minuto por IP (ráfaga de 20; luego 429).
  Sin HTTPS (o sin `TRUST_PROXY` detrás del proxy), `/admin` responde 503 y el log registra
  `admin_requires_https`.
- Las credenciales, el hash, los tokens y el contenido de los menús no se escriben en los logs.
- Si la base de datos falla con el servidor en marcha, `/admin` (también la página de acceso)
  responde 503 con un aviso y el log registra `database_unavailable` solo con códigos; las
  landings no se ven afectadas.

### Archivos de datos (`DATA_DIR`)

```text
DATA_DIR/
├── molotes/
│   ├── current.json            # versión vigente
│   ├── previous.json           # versión anterior (una por negocio)
│   ├── damaged-<fecha>.json    # archivo dañado aislado para revisarlo
│   └── damaged.marker.json     # existe mientras los datos estén dañados y nadie elija una opción
├── birria/ (igual)
└── changes.jsonl               # registro de cambios de los datos de página: una línea JSON por guardado o restauración
```

- **Productos en los JSON:** desde REQ-F-008 los JSON conservan su formato, pero sus listas de
  productos quedan "congeladas": ya no se usan ni se editan (los productos vigentes están en la
  base de datos). Se mantienen para poder volver a una versión anterior de la app sin que los
  archivos se traten como dañados. Por la misma razón, las listas de productos de
  `src/content/<negocio>/seed.json` no deben cambiar.

- **Primera ejecución:** si no existe `current.json`, se copia la semilla a `current.json` y
  `previous.json` (log `menu_data_seeded`).
- **Guardado:** el contenido vigente pasa a `previous.json` y el nuevo se escribe de forma
  atómica (archivo temporal, `fsync` y `rename`): un fallo nunca deja el archivo a medias.
- **Registro (`changes.jsonl`, datos de página):** fecha ISO en la zona del negocio, autor (nombre visible del
  usuario de la sesión, `author`, y su identificador, `authorId`; las entradas anteriores a
  REQ-F-007 solo tienen el nombre escrito a mano), negocio, acción (`save`, `overwrite_after_conflict`,
  `restore_previous`, `restore_seed`) y campos modificados con su valor anterior y el nuevo.
  La página solo muestra "Último cambio: <fecha> por <nombre>". El archivo crece sin límite:
  rótalo o respáldalo con las herramientas de la VM. Los cambios de productos se registran en la
  tabla `product_change` de la base de datos (ver abajo).
- **Edición simultánea:** cada formulario lleva la versión con la que empezó. Si otra persona
  guardó antes, no se escribe nada y se ofrece "Guardar mis cambios de todos modos" o
  "Descartar y cargar la versión actual".
- **Restaurar versión anterior:** intercambia `current.json` y `previous.json` (se puede
  deshacer repitiendo la acción).
- **Ediciones manuales:** editar los JSON a mano se aplica al reiniciar el servidor. La vía
  recomendada es la administración; si se guarda desde ella antes de reiniciar, la edición
  manual queda como versión anterior. Haz respaldos de `DATA_DIR` con las herramientas de la VM.

### Base de datos

- **Motor:** MySQL 8.4 LTS (REQ-F-014) con Prisma 7 y el adaptador oficial
  `@prisma/adapter-mariadb` (driver `mariadb`). Guarda los usuarios de `/admin`, sus negocios, su
  auditoría y los productos. Los JSON de página y `changes.jsonl` siguen en `DATA_DIR`.
- **Español completo:** utf8mb4 con la colación `utf8mb4_es_0900_as_cs` (español moderno: la ñ va
  después de la n; distingue acentos y mayúsculas) en la base, las tablas y las columnas, y en la
  conexión. Cualquier texto con ñ, acentos, ¿¡«», € o emojis se guarda y se devuelve idéntico. La
  única excepción es `_prisma_migrations`, la tabla interna de Prisma (la crea siempre con
  `utf8mb4_unicode_ci`; solo guarda nombres de migración, checksums y logs): solo se le exige
  utf8mb4. El usuario de acceso es único sin distinguir mayúsculas porque la app lo normaliza
  (NFC y minúsculas) antes de guardarlo: "jose" y "josé" son usuarios distintos.
- **Longitudes:** cada texto tiene en el esquema la longitud máxima que permite la validación de
  la app (`@db.VarChar(n)`, que cuenta caracteres igual que la app) o `@db.MediumText` (JSON de
  cambios). Con el modo estricto de MySQL, un texto más largo da error; nunca se recorta.
- **Menor privilegio:** la app usa `DATABASE_URL` con un usuario solo DML (`SELECT`, `INSERT`,
  `UPDATE`, `DELETE`) y **nunca migra**. Las migraciones las aplica un proceso aparte con un
  usuario con DDL (`MIGRATION_DATABASE_URL`): `npm run db:migrate` en local o la imagen `migrate`
  (`prisma migrate deploy`).
- **Verificación al arrancar** (`src/db/verify.ts`): conexión (reintenta hasta 60 s si MySQL aún
  arranca), credenciales, modo estricto (`STRICT_TRANS_TABLES`), utf8mb4 y colación de la base,
  las tablas y las columnas, y estado de las migraciones. Si algo falla, el servidor termina con
  código 1 y el log `database_init_failed` con un código estable, sin SQL, URL, credenciales ni
  stack: `DATABASE_UNREACHABLE`, `DATABASE_AUTH_FAILED`, `DATABASE_ACCESS_DENIED`,
  `DATABASE_NOT_STRICT`, `DATABASE_CHARSET_INVALID` (con la tabla o columna), `MIGRATIONS_PENDING`,
  `MIGRATION_INCOMPLETE`, `MIGRATION_MODIFIED`, `DATABASE_NEWER_THAN_CODE`,
  `MIGRATIONS_UNREADABLE` o `DATABASE_ERROR`. Mientras espera registra `database_waiting`.
- **Migraciones nuevas (desarrollo):** cambia `prisma/schema.prisma`, ejecuta
  `npm run db:migrate:dev -- --name <nombre>` (contra el MySQL local) y **revisa a mano** el
  `migration.sql`: Prisma escribe `COLLATE utf8mb4_unicode_ci` en cada `CREATE TABLE` y hay que
  cambiarlo por `utf8mb4_es_0900_as_cs` (`tests/unit/migrations-collation.test.ts` falla hasta
  hacerlo). Después `npm run db:migrate` y `npm run db:generate`. Versiona la carpeta nueva de
  `prisma/migrations/`; nunca edites una migración ya aplicada (`MIGRATION_MODIFIED`). En MySQL el
  DDL no es transaccional: una migración que falla a mitad queda incompleta
  (`MIGRATION_INCOMPLETE`) y la salida es restaurar el respaldo. Prefiere migraciones pequeñas.
- **Último administrador con concurrencia:** las escrituras de usuarios son transacciones
  `Serializable`; ante un interbloqueo se reintentan (hasta 3 intentos) y la operación rechazada
  recibe el aviso de siempre (409) o, si no se resuelve, 503 sin cambios.
- **Fallo con el servidor en marcha:** `/admin` responde 503 (HTML), la API 503 JSON
  `DATABASE_UNAVAILABLE`, las landings siguen en 200 desde la caché y el log registra
  `database_unavailable` solo con códigos. Al volver MySQL, todo se recupera sin reiniciar.
- **Productos:** tablas `product`, `product_variant`, `product_chip`, `product_import` (la
  importación única) y `product_change`: el registro de cambios de productos, escrito en la misma
  transacción que el cambio (fecha, usuario y su nombre visible, negocio, slug, acción —`create`,
  `update`, `delete`, `restore`, `reorder`, `overwrite_after_conflict`, `import`— y campos con su
  valor anterior y el nuevo). No tiene pantalla: se consulta en la base de datos. Si se edita la
  base a mano con el servidor en marcha, reinícialo para que las landings lo vean.
- **Despliegue en el VPS (REQ-F-016):** cada despliegue hace antes un volcado local (se conservan
  7) y migra con la imagen `migrate`. Una base migrada no arranca con un código anterior
  (`DATABASE_NEWER_THAN_CODE`) salvo en la vuelta atrás automática, que usa
  `DATABASE_ALLOW_NEWER_SCHEMA=true`: por eso **cada migración debe ser compatible con el código
  anterior** (añadir antes de quitar). Respaldos cifrados fuera del VPS, restauración y prueba
  mensual (REQ-F-019; scripts en `ops/backup/`): [docs/despliegue.md](docs/despliegue.md#11-respaldos-fuera-del-vps).

### Recuperación de datos dañados

Si `current.json` no es JSON válido o no cumple el esquema (por ejemplo, un precio de
6000.00 escrito a mano):

1. El servidor arranca igual y la landing muestra la versión anterior si es válida o, si no,
   la semilla. Si se daña con el servidor en marcha, la landing sigue con la última versión
   válida en memoria. El log registra `menu_data_damaged` (sin contenido ni rutas).
2. El archivo dañado se conserva como `damaged-<fecha>.json` y se crea `damaged.marker.json`.
3. La página de administración del negocio avisa del daño, bloquea la edición y ofrece
   "Restaurar versión anterior" (si es válida) y "Restaurar semilla original". La elección
   queda en el registro, borra el marcador y desbloquea la edición.

## Estructura

```text
restaurante/
├── src/
│   ├── server.ts             # Entrada del proceso: valida config, prepara DATA_DIR y la base de datos, primer administrador, importación de productos, escucha en PORT, cierre ordenado
│   ├── app.ts                # createApp(): app Koa testeable (config, repositorio, logger y `now` inyectables)
│   ├── config/               # env.ts (carga/validación y tipo Config), businesses.ts (ids de negocio)
│   ├── controllers/          # landing.ts (landing del negocio activo), icons.ts (iconos de la raíz y manifests), whatsapp-webhook.ts (webhook del bot),
│   │                         # admin.ts (acceso, inicio y menús), admin-products.ts (productos en HTML), admin-products-api.ts y
│   │                         # admin-api-access.ts (API JSON), admin-business-view.ts, admin-users.ts, admin-account.ts, admin-access.ts
│   ├── db/                   # client.ts (Prisma + adaptador MariaDB/MySQL), verify.ts (verificación al arrancar), errors.ts
│   ├── generated/prisma/     # Cliente de Prisma generado por `npm run db:generate` (ignorado por git)
│   ├── routes/               # Router (@koa/router): index.ts (landings), admin.ts (/admin), admin-api.ts (/admin/api)
│   ├── middleware/           # Manejo centralizado de errores, log de requests, protección de /admin
│   ├── repositories/         # Menús (contrato y reglas, archivos y memoria), productos (reglas + store Prisma y memoria) y usuarios (Prisma)
│   ├── services/             # business-schedule, whatsapp, menu-schema, price, visible-menu, admin-form,
│   │                         # menu-diff, admin-auth, session-store, login-throttle, user-schema,
│   │                         # authorization, admin-bootstrap, product-schema, product-form, slug,
│   │                         # whatsapp-bot/ (bot de WhatsApp: chat-bot (interfaz ChatBot), orchestrator, conversation, catalog,
│   │                         #   schedule, messages, store, text; providers/: select, http-send, meta/ (WhatsAppBot), twilio/ (TwilioBot))
│   ├── content/              # Contenido estático por negocio (common/, molotes/, birria/), textos del bot (bot.ts), horarios (hours.ts), semillas seed.json e icons.ts
│   ├── utils/                # logger.ts (JSON estructurado), datetime.ts (zona del negocio), form-body.ts, json-body.ts, errors.ts
│   ├── views/                # render.ts + plantillas HTML
│   │   ├── layouts/base.html # <head> común (SEO, fuentes, CSS/JS por negocio) y skip link
│   │   ├── pages/            # molotes.html, birria.html: header, secciones y footer del diseño
│   │   ├── partials/         # icons/ (WhatsApp), seo-absolute, favicon-links, molotes/ y birria/ (tarjetas, aviso de sección vacía, etc.)
│   │   ├── landings/         # Contenido -> datos de plantilla (index.ts, molotes.ts, birria.ts)
│   │   └── admin/            # Plantillas y vistas de la administración (formulario generado desde el esquema)
│   └── styles/
│       ├── shared/base.css   # Base común de ambos diseños
│       ├── molotes/main.css  # Entrada Tailwind + tokens @theme de Moloteando
│       ├── birria/main.css   # Entrada Tailwind + tokens @theme de Birriería El Muñeco
│       ├── admin/main.css    # Entrada Tailwind de la administración
│       └── components/       # Bloques BEM propios (sin uso por ahora)
├── public/
│   ├── css/{molotes,birria,admin}/main.css   # Generado por `npm run build:css` (ignorado por git)
│   ├── js/
│   │   ├── modules/          # Módulos ES compartidos (promo-form, variant-selector)
│   │   ├── molotes/main.js   # Entrada JS de Moloteando
│   │   └── birria/main.js    # Entrada JS de Birriería El Muñeco
│   └── img/
│       ├── common/           # Imágenes usadas por ambas landings
│       ├── molotes/          # icons/: favicons e iconos de pantalla de inicio (generados)
│       └── birria/           # icons/: ídem
├── prisma/
│   ├── schema.prisma         # Esquema de la base de datos (usuarios, negocios asignados, auditoría y productos)
│   └── migrations/           # Migraciones SQL de MySQL versionadas (las aplica el proceso migrate, nunca la app)
├── prisma.config.ts          # Configuración del CLI de Prisma (solo desarrollo, CI y las etapas build/test/migrate)
├── scripts/
│   ├── hash-password.ts      # `npm run admin:hash-password`
│   ├── admin-recover.ts      # `npm run admin:recover`
│   ├── bot-chat.ts           # `npm run bot:chat`: el bot en la terminal contra el simulador (solo desarrollo)
│   ├── audit-deps.ts         # `npm run audit:deps`: auditoría de dependencias por imagen (CI, job auditoria)
│   ├── support/read-hidden.ts # Lectura de contraseñas sin eco (compartida)
│   ├── support/audit-policy.ts # Política de la auditoría (umbral, excepciones, fail closed)
│   └── generate-icons.py     # Genera public/img/<negocio>/icons/ (Python 3 + Pillow; solo desarrollo)
├── security/audit-exceptions.json # Excepciones de la auditoría de dependencias (30 días como máximo)
├── data/                     # DATA_DIR por defecto fuera de producción (ignorado por git)
├── tests/
│   ├── helpers.ts            # Config válida, semillas y repositorio en memoria para pruebas
│   ├── setup/                # no-meta.ts (ninguna llamada a Meta ni Twilio), database-global.ts y database-guard.ts (MySQL de pruebas y salvaguarda)
│   ├── support/admin.ts      # App con administración (base de datos de prueba), usuarios, inicio de sesión y formularios
│   ├── support/products.ts   # Entradas válidas de producto y repositorios de productos para pruebas
│   ├── support/database.ts   # Bases MySQL de prueba por trabajador (restaurante_test_*; nunca una base real) y database-admin.ts, test-database-config.ts (salvaguarda), tcp-proxy.ts
│   ├── support/process.ts    # Procesos reales: arranque del servidor y comandos de consola
│   ├── support/png.ts        # Lectura mínima de PNG/ICO (dimensiones, opacidad, color de fondo)
│   ├── support/cloud-api-double.ts # Doble de la WhatsApp Cloud API (ninguna prueba llama a Meta)
│   ├── support/twilio-api-double.ts # Doble de la API de mensajes de Twilio (ninguna prueba llama a Twilio)
│   ├── support/whatsapp.ts   # Entregas del webhook de Meta, firma, reloj y bot de prueba
│   ├── support/twilio.ts     # Entregas (formulario) y firma de Twilio, y bot de prueba con Twilio
│   ├── support/chat-bot-drivers.ts # Drivers por proveedor de la batería de contrato de ChatBot
│   ├── fixtures/whatsapp/    # Entregas de ejemplo del webhook de Meta (forma de los ejemplos oficiales)
│   ├── fixtures/twilio/      # Entregas de ejemplo del webhook de Twilio (formulario y StatusCallback)
│   ├── snapshots/            # HTML de referencia de las landings (regresión visual con la semilla)
│   ├── unit/                 # config, esquema, precios, formulario, repositorio de archivos, sesión, landings, contenido vs. diseño, JS sobre el HTML real
│   └── integration/          # Landings (fecha, SEO, CTA, datos editables, datos dañados), administración, estáticos, errores
├── tsconfig.json             # TypeScript estricto solo para verificar tipos (`npm run typecheck`; sin emitir archivos)
├── vitest.config.ts          # Configuración de Vitest
├── eslint.config.ts          # Configuración de ESLint (`npm run lint`)
├── Dockerfile                # Imagen multi-stage (base, deps, build, test, migrate, production); ver [Docker](#docker)
├── .dockerignore             # Excluye secretos, datos, dependencias y artefactos locales del build
├── docker/mysql/initdb/      # Bases y usuarios del MySQL local (solo desarrollo y pruebas)
└── compose.yaml              # MySQL local `mysql-dev` (`npm run db:up`) y servicio `test` (`docker compose run --rm test`)
```

### Plantillas

`src/views/render.ts` es un renderizador mínimo sin dependencias. Las plantillas se leen una
sola vez al crear la app.

- `{{ clave }}`: valor escapado como HTML (siempre por defecto).
- `{{{ clave }}}`: inserta un fragmento ya renderizado. Solo acepta el resultado de otro
  `render()` (`SafeHtml`); un texto normal provoca error.
- `{{ a.b.0.c }}`: rutas con puntos sobre objetos y arrays (solo propiedades propias). Así las
  plantillas leen el contenido de `src/content/` directamente (`{{ c.hero.title }}`).
- `renderEach(plantilla, items)` y `join(fragmentos)` componen listas (tarjetas del menú,
  sucursales) sin lógica en las plantillas.
- Si falta una clave, el valor es un objeto o la plantilla no existe, se lanza un error.

Cada negocio tiene su propia página (`pages/<negocio>.html`) porque los diseños difieren
estructuralmente; comparten layout, icono/CTA de WhatsApp, enlace de ubicación y lógica.
Los textos, horarios, contacto e imágenes de sección viven en `src/content/<negocio>/`; los
datos editables (menú, precios, hero y promociones) llegan del repositorio de menús y se
combinan con ese contenido en `src/views/landings/`. Los tonos de color son claves semánticas (`tone`,
`highlight`) que los módulos de `src/views/landings/` traducen a utilidades de Tailwind.

### Horario de servicio

El horario real de cada negocio tiene una sola fuente estructurada: `src/content/<negocio>/hours.ts`
(días de servicio, apertura y cierre en `HH:MM` de 24 h), validada y expuesta por
`src/content/hours.ts` (`BUSINESS_HOURS`, `getBusinessHours(id)`). Las horas son locales en
`BUSINESS_TIMEZONE`; la fuente no guarda la zona. Esta fuente no decide qué landing se muestra
(eso sigue en `src/services/business-schedule.ts`) y la usará el bot de WhatsApp.

Los textos de horario de las landings son literales en `src/content/<negocio>/index.ts`, porque
cada lugar tiene su propio estilo. `tests/unit/business-hours.test.ts` comprueba que coinciden con
la fuente: **para cambiar un horario, edita `hours.ts` y todos sus textos**; si solo se cambia uno
de los dos, la prueba falla.

## Assets por landing

Extraídos de `../_stich_source_/moloteando_aut_nticos_molotes_artesanales/code.html` y
`../_stich_source_/birrier_a_el_mu_eco_aut_ntica_birria_de_res_color_adobo/code.html`:

- **CSS:** el `tailwind.config` del CDN se convirtió en tokens `@theme` de Tailwind v4 en
  `src/styles/<negocio>/main.css`. El `<style>` común está en `src/styles/shared/base.css`.
- **JS:** los scripts y manejadores en línea se reescribieron como módulos ES con
  delegación de eventos y atributos `data-*` (`public/js/modules/`), con una entrada por landing.
- **Imágenes:** descargadas del diseño a `public/img/<negocio>/` (las compartidas en
  `public/img/common/`). Los logos y motivos PNG se convirtieron a WebP. Las rutas, `alt` y
  dimensiones de las imágenes de sección se declaran en `src/content/<negocio>/index.ts`
  (`images`); las de cada platillo, en los datos editables (semilla `seed.json`), junto al platillo.
- **Fuentes:** Google Fonts (familias del diseño y Material Symbols), una hoja por landing
  declarada en `content.assets.fontsHref`.

La ubicación (Google Maps) es común a ambas landings: `src/content/common/index.ts` → `location.mapsUrl`.

El layout carga `/css/<negocio>/main.css` y `/js/<negocio>/main.js` según el negocio activo.
Cada hoja de Tailwind solo escanea las vistas de su negocio (`@source`), así una landing no
incluye las clases de la otra.

Todos los CTA de pedido (header, hero, banner, plataformas y botón flotante) usan el enlace
calculado desde `WHATSAPP_MOLOTES*` / `WHATSAPP_BIRRIA*`. Los enlaces "Cómo llegar", la
dirección del footer, el mapa y "Pick Up / En Sucursal" usan `location.mapsUrl`.

### Iconos (favicons y pantalla de inicio)

Cada negocio tiene su juego de iconos en `public/img/<negocio>/icons/`, generado a partir de
los PNG de alta resolución de `../_stich_source_/logo_<negocio>.png/screen.png`:

| Archivo                  | Tamaño        | Arte                                                           |
| ------------------------ | ------------- | -------------------------------------------------------------- |
| `favicon.ico`            | 16, 32 y 48   | Mascota recortada en círculo sobre el color del negocio        |
| `icon-16.png`, `icon-32.png` | 16 y 32   | Ídem                                                           |
| `apple-touch-icon.png`   | 180           | Logo completo, opaco, sobre el color del negocio               |
| `icon-192.png`, `icon-512.png` | 192 y 512 | Logo completo sobre fondo transparente                       |
| `icon-maskable-512.png`  | 512           | Logo completo, opaco, dentro del círculo central del 80 %      |

- **Metadatos:** `icons` en `src/content/<negocio>/index.ts` (versión, `themeColor` y nombres
  del manifest). Las rutas de los archivos y el manifest se arman en `src/content/icons.ts`.
- **`<head>`:** cada landing declara el .ico, los PNG de 16 y 32, el apple-touch-icon, su
  manifest y su `theme-color`; `/` usa los de Birria. Las páginas de `/admin`
  muestran el favicon del negocio del día, sin manifest ni `theme-color`.
- **Raíz:** `/favicon.ico`, `/apple-touch-icon.png` y `/apple-touch-icon-precomposed.png`
  sirven el icono de Birria, el mismo de `/` (REQ-F-028), con `Cache-Control: no-cache` y `ETag` (responden 304
  si no cambió). Los archivos se cargan en memoria al arrancar; si falta alguno, la app no arranca.
  No crees archivos con esos nombres en la raíz de `public/`: `koa-static` los serviría con
  caché larga.
- **Caché:** los iconos de cada negocio se sirven como estáticos (1 h en producción) con
  `?v=<icons.version>` en la URL. Los manifests (`/molotes.webmanifest`, `/birria.webmanifest`)
  piden revalidación. Safari e iOS guardan su propia caché de favicons, que el servidor no controla.

**Regenerar los iconos** (por ejemplo, si cambia un logo):

1. Requisitos (solo en la máquina de desarrollo): Python 3 y Pillow (`pip install Pillow`).
2. Desde `restaurante/`: `python3 scripts/generate-icons.py --preview-dir /tmp/iconos`.
   El recorte de la mascota (coordenadas en píxeles de la fuente) y los colores de fondo están
   al inicio del script; los colores deben coincidir con `icons.themeColor` del contenido.
3. Revisa la hoja de contacto `icons-preview-<negocio>.png` que se deja en `--preview-dir`
   (fuera del repo).
4. Incrementa `icons.version` en `src/content/<negocio>/index.ts` para invalidar la caché HTTP.
5. `npm test` (comprueba tamaños, opacidad, color de fondo y tamaños del .ico) y versiona los
   archivos nuevos.

### Diferencias deliberadas con el diseño fuente

- Enlaces `href="#"` del diseño: Uber Eats y Rappi no tienen URL configurada y se muestran
  como información (no como enlaces); "Aviso de Privacidad" y "Términos" son texto hasta que
  existan esas páginas. El menú de navegación apunta a las secciones de la página.
- Navegación por anclas: desplazamiento suave nativo (`scroll-behavior: smooth`, solo con
  `prefers-reduced-motion: no-preference`) y `scroll-padding-top` con el alto del header fijo
  de cada landing (`--landing-header-height` en `src/styles/<negocio>/main.css`). Los
  destinos tienen `tabindex="-1"` para que el foco quede en la sección. Sin JavaScript.
- El mapa estático remoto de Birria se sustituye por un enlace a Google Maps con la textura
  `fondo-birria.jpg` (no se usan imágenes remotas de Stitch).
- Accesibilidad: etiquetas (`sr-only`) en los campos, `aria-hidden` en iconos decorativos,
  `aria-pressed` en variantes, skip link, animaciones solo con `motion-safe`, jerarquía de
  encabezados corregida (h4/h5 del diseño ajustados) y, en Moloteando, textos pequeños sobre
  fondo claro oscurecidos para cumplir contraste (p. ej. ámbar `#d97706` -> `#b45309`,
  `on-surface-variant` -> `slate-600`, enlaces del menú en blanco).
- Teléfono y correo del footer son enlaces `tel:`/`mailto:`; el campo "correo o teléfono" del
  club de Birria es de texto (el diseño usaba `type="email"`, que rechazaba teléfonos).
- Responsive: el título de Moloteando usa la escala `display-lg-mobile` del propio diseño en
  móvil y la foto principal es 4:3 en móvil para que el pie de foto no tape el plato.
