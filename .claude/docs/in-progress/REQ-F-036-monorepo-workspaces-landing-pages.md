# REQ-F-036 — Monorepo con npm workspaces: la app pasa a `landing-pages/` sin cambios funcionales

## Estado

QA_APPROVED

## Aprobación

Aprobado por el usuario (versión 1, fecha 2026-10-24). Respuesta textual: "Lo apruebo, y que sea el senior full stack". La segunda parte asigna la medición de memoria del VPS a `senior-fullstack` (ver Dependencias).

Decisiones del usuario incorporadas (2026-10-24, citas textuales):

- Decisión A de `restaurante/docs/arquitectura.md` §9 (despliegue): "tres contenedores". Se adopta la recomendación de §9-A: `api`, `landing-pages` e `inventory-manager` detrás del Traefik del VPS, el dominio actual para las landings y la API en `admin.<dominio>/api`.
- Estructura y README: "Lo compartido en la raíz (Recomendado)".
- Nombres de imágenes, servicio y routers: "Mantenerlos (Recomendado)".
- Archivos de `deploy/` cubiertos por la suma: "No tocar esos archivos (Recomendado)".
- Memoria del VPS: "Medir con umbral del 80 % (Recomendado)".

## Objetivo

Paso 1 del plan de migración (`restaurante/docs/arquitectura.md` §8): convertir `restaurante/` en un monorepo con npm workspaces y mover la app actual tal cual a `restaurante/landing-pages/`, sin ningún cambio observable para clientes, personal, administradores ni el bot. El pipeline debe seguir publicando y desplegando igual. La decisión A queda registrada y la memoria del VPS medida (riesgo de §10).

## Alcance

- Raíz de workspaces en `restaurante/`, con un único workspace: `landing-pages`.
- **Queda en la raíz (lo compartido):** `deploy/`, `ops/`, `security/`, `docs/`, `compose.yaml` (MySQL de desarrollo y pruebas), la configuración común, `package.json` y `package-lock.json` de los workspaces, y `README.md` como guía del monorepo.
- **Va a `landing-pages/`:** `src/`, `public/`, `tests/`, `scripts/`, `prisma/` (hasta el paso 2) y su `Dockerfile`.
- Ajustes en `.github/workflows/ci.yml`, `.github/dependabot.yml`, el `Dockerfile`, `compose.yaml` y la documentación.
- En `deploy/` y `ops/` solo se pueden tocar, si hace falta, archivos que no forman parte de la suma de `deploy/` (por ejemplo `deploy/ci/smoke.sh` u `ops/backup/ci/smoke.sh`, si cambia cómo se construyen las imágenes).
- Registro de la decisión A en §9 de `arquitectura.md`.
- Medición de la memoria del VPS con umbral del 80 %.

## Fuera de alcance

- Modificar `deploy/compose.prod.yaml`, `deploy/deploy.sh` o `deploy/mysql/initdb/01-usuarios.sh`. No hay ningún paso manual en el VPS.
- Renombrar las imágenes de GHCR (`ghcr.io/orvigas/restaurante`, `restaurante-migrate`), el servicio de compose `app` o los routers `restaurante*` de Traefik.
- Crear servicios, routers, DNS, subdominio o certificado para `api` o `inventory-manager` (pasos 3 y 4).
- `packages/core`, `contracts` y `db` (paso 2), `api/` (paso 3) e `inventory-manager/` (paso 4).
- Las decisiones B y C de §9.
- Las reglas de lint de dependencias entre paquetes de §4: todavía no hay paquetes.
- Cambiar rutas HTTP, variables de entorno, el esquema de la base o el webhook de Meta.

### Qué parte de la decisión A aplica en este paso

| Paso 1 (este ticket) | Más adelante |
| --- | --- |
| Registrar A en §9: fecha, respuesta textual y qué aplica en cada paso | Contenedor e imagen de `api` (paso 3) |
| La imagen y el contenedor actuales salen del workspace `landing-pages/`, con los mismos nombres, dominio y rutas | Contenedor `inventory-manager`, `admin.<dominio>`, DNS y certificado (paso 4) |
| Medir la memoria y comprobar el umbral del 80 % antes del paso 3 | Mover `/admin` al subdominio (paso 4) y retirar el `/admin` actual (ticket propio) |

## Requisitos

- **RF-1. Workspaces.** `restaurante/package.json` es la raíz privada de los workspaces y hay un único `package-lock.json`, en `restaurante/`. `npm ci --strict-allow-scripts` en la raíz instala todo con la misma lista de `allowScripts`.
- **RF-2. Comandos.** Desde `restaurante/` existen los mismos comandos que hoy, con el mismo resultado: `start`, `dev`, `build:css`, `watch:css`, `test`, `test:watch`, `typecheck`, `lint`, `lint:fix`, `db:*`, `admin:*`, `bot:chat` y `audit:deps`.
- **RF-3. Sin cambio funcional.** No cambian las rutas, el HTML, los encabezados, los códigos HTTP, las variables de entorno, el esquema, las migraciones, `DATA_DIR` ni los logs. La suite actual pasa sin quitar ni debilitar pruebas. Solo se ajustan rutas de archivos, como las del diseño fuente `_stich_source_` y del `README.md` de la raíz.
- **RF-4. Imágenes.** Las imágenes `production` y `migrate` se construyen desde la nueva estructura con el `Dockerfile` de `landing-pages/` y conservan lo que hoy se verifica:
  - production sin el CLI de Prisma ni SQLite, y con el adaptador MariaDB;
  - migrate con el CLI de Prisma y sin SQLite;
  - usuario no root, `HOST=0.0.0.0`, puerto 3000, el mismo HEALTHCHECK, el mismo punto de montaje de `DATA_DIR` y los comandos de consola `admin:recover` y `admin:hash-password`.

  Así, `deploy.sh` y `compose.prod.yaml` siguen funcionando sin cambios.
- **RF-5. CI.** Los jobs `cambios`, `validado`, `calidad`, `auditoria`, `docker`, `despliegue`, `publish`, `vigente` y `deploy` conservan sus nombres, su orden y sus condiciones, con las rutas nuevas. No cambian la detección de documentación, el árbol ya validado, la publicación en GHCR con los mismos nombres ni los resúmenes de REQ-F-030. La suma de `deploy/` que calcula el workflow sigue coincidiendo con la que está instalada en el VPS.
- **RF-6. Dependabot.** Sigue cubriendo npm (con el lockfile de la raíz), GitHub Actions y la imagen base de Docker (con el `Dockerfile` de `landing-pages/`), con la misma política de `allow`, `groups`, horario y prefijos.
- **RF-7. Despliegue.** El merge publica y despliega sin intervención manual en el VPS. El dominio actual responde, `www` y http redirigen con 301 como hoy y `/admin` mantiene su límite de peticiones.
- **RF-8. Respaldos.** `ops/backup` (scripts, unidades de systemd y su prueba de humo) sigue funcionando, con `deploy/` en la misma ubicación relativa.
- **RF-9. Registro de A.** `arquitectura.md` §9 registra la decisión A como tomada: fecha 2026-10-24, respuesta textual "tres contenedores", la opción elegida (la recomendación) y qué aplica en el paso 1 y qué en los pasos 3 y 4. El encabezado del documento deja de contar A como pendiente. Si el ticket se desvía de §4 u §8 (por ejemplo, `deploy/` y `ops/` en la raíz), el documento se actualiza en el mismo PR.
- **RF-10. Memoria del VPS.** Se miden y registran, con su fecha:
  - la RAM total;
  - el uso por contenedor (MySQL, `app` y Traefik) en reposo y con tráfico normal;
  - una estimación con dos contenedores Node más.

  Si el uso estimado con tres contenedores supera el 80 % de la RAM total, la documentación lo indica y la decisión A se revisa con el usuario antes del paso 3. El resultado queda en `arquitectura.md` §10 o en `docs/despliegue.md`.
- **RF-11. Documentación.** El `README.md` de la raíz es la guía del monorepo. Se actualizan `docs/desarrollo.md`, `docs/despliegue.md` y las rutas citadas en `.claude/rules/` (por ejemplo `restaurante/tests/support/http.ts` y `restaurante/public/js`) y en `CLAUDE.md`. No se documentan `api/` ni `inventory-manager/` como si ya existieran.

## Historias de usuario

**Como** dueño del negocio **quiero** reorganizar el proyecto en un monorepo sin que cambie nada para mis clientes **para** poder añadir después la API y el inventory manager sin poner en riesgo las landings ni el bot.

## Reglas de negocio

- Ningún cambio observable para clientes, personal ni administradores.
- Cada merge a `main` despliega en producción, así que el PR debe ser desplegable por sí solo.
- Si se supera el umbral del 80 % de RAM, la decisión A se revisa antes del paso 3.

## Criterios de aceptación

- **CA-1.** Given un checkout limpio, when se ejecuta `npm ci --strict-allow-scripts` en `restaurante/`, then termina con 0, hay un único `package-lock.json` (en `restaurante/`) y la app está en `restaurante/landing-pages/` con `src/`, `public/`, `tests/`, `scripts/`, `prisma/` y su `Dockerfile`.
- **CA-2.** `restaurante/` contiene `deploy/`, `ops/`, `security/`, `docs/`, `compose.yaml` y `README.md`, y no contiene `src/`, `public/`, `tests/` ni `prisma/`.
- **CA-3.** `npm run typecheck`, `npm run lint` y `npm test` desde `restaurante/` terminan con 0, y el número de pruebas es igual o mayor que en `main` antes del cambio.
- **CA-4.** En el PR quedan en verde:
  - `cambios`, `calidad` y `auditoria`;
  - `docker`: contenido de las imágenes, migrate sobre una base vacía y production healthy en 0.0.0.0;
  - `despliegue`: shellcheck, prueba del resumen, prueba de humo del despliegue, systemd y prueba de humo de los respaldos.
- **CA-5.** Un PR que solo cambia `restaurante/docs/*.md` o `.claude/**` omite las validaciones. Uno que cambia un archivo de `restaurante/landing-pages/**` las ejecuta.
- **CA-6.** `git diff main -- restaurante/deploy/compose.prod.yaml restaurante/deploy/deploy.sh restaurante/deploy/mysql/initdb/01-usuarios.sh` está vacío, y la suma de esos tres archivos que calcula el workflow es la misma antes y después del cambio.
- **CA-7.** Los nombres publicados en GHCR siguen siendo `ghcr.io/orvigas/restaurante:sha-<commit>` y `ghcr.io/orvigas/restaurante-migrate:sha-<commit>`, y no se añade ningún servicio, router de Traefik ni registro DNS.
- **CA-8.** No cambian las aserciones de la suite sobre `/`, `/molotes`, `/birria`, `/admin` y `/webhooks/whatsapp` (códigos HTTP y HTML). En las pruebas solo pueden cambiar las rutas de archivos.
- **CA-9.** Tras el merge, el workflow de `main` termina con `deploy` en "Desplegado" para el commit del merge, sin ningún paso manual en el VPS. `https://<dominio>/`, `/molotes` y `/birria` responden 200, y `www` y http redirigen con 301 como antes.
- **CA-10.** Tras el despliegue se conservan los menús editados (`DATA_DIR`), los productos y usuarios (MySQL) y el estado del interruptor del bot.
- **CA-11.** `.github/dependabot.yml` declara npm, github-actions y docker apuntando a rutas que existen, con la misma política de `allow`, `groups`, horario y prefijos.
- **CA-12.** `arquitectura.md` §9 contiene la decisión A con la fecha 2026-10-24, la cita "tres contenedores", la opción elegida y la división entre el paso 1 y los pasos 3 y 4. El encabezado ya no cuenta A como pendiente.
- **CA-13.** Existe un registro fechado con la RAM total, el uso por contenedor (MySQL, `app` y Traefik) en reposo y con tráfico normal, la estimación con dos contenedores Node más y su porcentaje sobre la RAM total. Si pasa del 80 %, el registro lo indica y dice que A se revisa antes del paso 3.
- **CA-14.** La puesta en marcha del `README.md` de la raíz y de `docs/desarrollo.md` funciona de principio a fin con la nueva estructura (`npm ci`, `npm run db:up`, `npm run dev`, `npm test` y `docker compose run --rm test`), y las rutas que citan `.claude/rules/` y `CLAUDE.md` existen.

## Casos límite

- **Vuelta atrás automática de `deploy.sh` a un digest anterior al monorepo.** Debe seguir funcionando, porque la imagen conserva el puerto, el healthcheck, las variables y el volumen (RF-4).
- **Volumen `app-data` y datos de `DATA_DIR`.** Se conservan sin migración.
- **Árbol ya validado en un push a `main`.** Sigue funcionando porque los nombres de los jobs no cambian.
- **PR de Dependabot abiertos antes del cambio.** Pueden quedar obsoletos; Dependabot los recrea con las rutas nuevas.
- **Pruebas que leen archivos fuera de la app.** El diseño fuente `_stich_source_` y el `README.md` de la raíz se leen con rutas relativas, que hay que ajustar (RF-3).
- **Desarrollo local desde la nueva ubicación.** `npm run dev`, `db:up` y `docker compose run --rm test` (CA-14).

## Dependencias

- **Medición de memoria del VPS (RF-10, CA-13).** La asignó el usuario a `senior-fullstack`, que la hace durante la implementación. Requiere acceso SSH al VPS (Hostinger, Traefik 3).
- Los secrets del environment `production` no cambian.
- Ningún ticket abierto depende de este ni lo bloquea.

## Riesgos

- **R-1. El paso toca el pipeline de producción.** Se mitiga con el CI completo en el PR, sin cambios en los archivos que cubre la suma de `deploy/` (CA-6) y verificando CA-9 tras el merge.
- **R-2. Rutas relativas rotas** en las pruebas, en el contexto `design` de Docker o en `ops/backup`. La suite y las pruebas de humo deben detectarlo.
- **R-3. Cachés invalidadas** de Actions y Docker. El primer CI será más lento; no hay impacto funcional.
- **R-4. Nota para los pasos 3 y 4 (fuera de este ticket).** Si el bot pasa a `api` en `admin.<dominio>/api`, cambia la URL del webhook y hay que volver a registrarlo en Meta (`docs/despliegue.md` §7).
- **R-5. Memoria insuficiente.** Si se supera el 80 %, la decisión A se revisa antes del paso 3 (RF-10).

## Action Plan

### Objetivo

Monorepo con npm workspaces y la app en `landing-pages/`, con producción idéntica, el pipeline intacto, la decisión A registrada y la memoria del VPS medida con su umbral.

### Alcance

RF-1 a RF-11.

### Fuera de alcance

Ver la sección "Fuera de alcance".

### Cambios requeridos

1. Crear la raíz de workspaces en `restaurante/` y mover `src/`, `public/`, `tests/`, `scripts/`, `prisma/` y el `Dockerfile` a `landing-pages/`.
2. Ajustar las rutas de configuración y de pruebas: TypeScript, ESLint, Vitest, Prisma, Tailwind, el diseño fuente y el README.
3. Ajustar el `Dockerfile` de `landing-pages/` y el `compose.yaml` de la raíz, incluido el contexto `design` y el servicio `test`.
4. Ajustar `ci.yml`: contextos y archivos de build, `.nvmrc`, lockfile, `working-directory`, detección de documentación y shellcheck. No cambian los nombres de jobs ni de imágenes.
5. Ajustar `dependabot.yml`.
6. Si hace falta, ajustar solo los archivos de `deploy/ci/` y `ops/backup/` fuera de la suma. Los tres archivos de la suma no se tocan.
7. Registrar la decisión A en `arquitectura.md` §9 y actualizar §4 u §8 si el ticket se desvía del plan.
8. Medir la memoria del VPS por SSH (lo hace `senior-fullstack`) y registrarla con el umbral del 80 %.
9. Actualizar el `README.md` de la raíz, `docs/desarrollo.md`, `docs/despliegue.md` y las rutas de `.claude/rules/` y `CLAUDE.md`.

### UX/UI

No aplica: el HTML es idéntico.

### Integraciones

- GHCR, con los mismos nombres.
- El VPS por SSH, con el mismo `deploy/`.
- Traefik, con los mismos routers.
- Dependabot.

Meta y Twilio no cambian.

### Orden recomendado

1. Medir la memoria del VPS (independiente y sin riesgo).
2. Workspaces, traslado y rutas, con la suite local en verde.
3. Docker y compose.
4. CI y Dependabot.
5. Pruebas de humo de `deploy/ci` y `ops/backup`, si hace falta.
6. Documentación y registro de A.
7. PR con el CI en verde.
8. Merge y verificación de CA-9 y CA-10.

### Resultado esperado

Producción idéntica servida desde `landing-pages/`, el repositorio listo para el paso 2 y datos de memoria para confirmar o revisar la decisión A antes del paso 3.

## Trazabilidad

| Objetivo / decisión | Requisito | Criterios | Action Plan |
| --- | --- | --- | --- |
| Monorepo (§4, §8 paso 1) | RF-1, RF-2 | CA-1, CA-2, CA-3, CA-14 | 1, 2 |
| Sin cambio funcional | RF-3, RF-4, RF-7 | CA-3, CA-8, CA-9, CA-10 | 2, 3 |
| Pipeline intacto (§10) | RF-5, RF-6, RF-8 | CA-4, CA-5, CA-6, CA-7, CA-11 | 4, 5, 6 |
| Decisión A | RF-9 | CA-12 | 7 |
| Memoria del VPS (§10) | RF-10 | CA-13 | 8 |
| Documentación | RF-11 | CA-14 | 9 |

No hay requisitos de UI ni de diseño: no se toca nada visual.

## Aprobación del Technical Action Plan

Aprobado por el usuario el 2026-10-24 (citas textuales):

- Plan técnico con DT-1 a DT-6: "Aprobar el plan".
- DT-6: "Sí, solo rutas (Recomendado)". En este PR se actualizan las rutas y el árbol de estructura de `.claude/agents/*.md` y `.claude/rules/codegraph.md`, sin cambiar reglas ni comportamiento.
- DT-5: "Sí, muévelos (Recomendado)". Se mueven los `restaurante/.env` y `restaurante/data/` locales (no versionados) a `restaurante/landing-pages/`, sin tocar su contenido.

## Technical Action Plan

### Objetivo técnico

Mover la app de `restaurante/` a `restaurante/landing-pages/` con `git mv`, para conservar el historial. `restaurante/` pasa a ser la raíz privada de los workspaces de npm, con un único `package-lock.json` y scripts que delegan en el workspace. Hay que ajustar las rutas que dependen de dónde está la raíz: `node_modules` queda elevado (*hoisted*) a la raíz, junto con el lockfile, `security/`, `README.md` y `_stich_source_`. También cambian el Dockerfile, `compose.yaml`, el CI, Dependabot y la documentación. Las imágenes, el compose de producción, `deploy.sh` y los nombres en GHCR quedan intactos.

### Decisiones técnicas (se aprueban con el plan)

- **DT-1. Distribución dentro de la imagen.** Las imágenes conservan la forma de un workspace:
  - `/app/package.json` y `/app/package-lock.json` (de la raíz) y `/app/node_modules` (elevado);
  - la app en `/app/landing-pages/{package.json,src,public,prisma/migrations,scripts}`;
  - `WORKDIR /app/landing-pages`.

  Motivo: `npm ci` exige que el lockfile de la raíz y el `package.json` de cada workspace estén en su sitio. Un `package.json` "aplanado" no coincide con el lockfile, y `npm ci` falla. Con `WORKDIR` en el workspace, los comandos relativos al directorio de trabajo siguen siendo válidos: `CMD ["node","src/server.ts"]`, `node scripts/admin-recover.ts` (`docs/despliegue.md`), `npm run admin:*` y el `prisma migrate deploy` de `migrate` con su `prisma.config.ts`.

  `compose.prod.yaml` no fija `working_dir`, `command` ni `entrypoint`. Así, la vuelta atrás a un digest anterior al monorepo (`WORKDIR /app`) sigue funcionando. Se mantienen sin cambios el usuario `node`, `HOST=0.0.0.0`, `PORT=3000`, `EXPOSE 3000`, el mismo `HEALTHCHECK` y `/var/lib/restaurante` (dueño `node`, permisos 700). El `ENTRYPOINT` de `migrate` pasa a `/app/node_modules/.bin/prisma migrate deploy`.
- **DT-2. Contexto de build y Dockerfile.** El contexto es `restaurante/` porque contiene el lockfile y el `package.json` de la raíz. El Dockerfile pasa a `restaurante/landing-pages/Dockerfile`, y se indica con `file:` en `build-push-action` y con `dockerfile:` en `compose.yaml`. El `.dockerignore` se queda en la raíz del contexto, `restaurante/.dockerignore`, que es el que lee BuildKit. Se reescribe con las rutas nuevas: `landing-pages/src/generated`, `landing-pages/public/css/*/`, `landing-pages/data`, `**/.env` y `ops`, y además `deploy`, `docs` y `security`, porque ninguna imagen los usa.

  En la etapa `build` solo se copian `landing-pages/` y `README.md`: la prueba del bot lee el README de la raíz, y la imagen `test` lo necesita. La imagen `production` sigue copiando solo lo seleccionado, así que el README no llega a producción. El contexto adicional `design` (`../_stich_source_`, relativo a `compose.yaml`, que no se mueve) y su `COPY` a `/_stich_source_/` no cambian.
- **DT-3. `allowScripts` y `engines` en la raíz.** npm lee `allowScripts` del proyecto raíz al instalar los workspaces (RF-1). Se mueve sin cambios al `package.json` de la raíz, y `engines.node` (`>=24.22.1`) se declara en los dos `package.json`. En la implementación se comprueba que `npm ci --strict-allow-scripts` ejecuta el `postinstall` de `prisma` y `@prisma/engines` y deniega `@parcel/watcher` y `fsevents`. Si npm se comportara de otro modo, se ajusta y se informa; nunca se relaja `--strict-allow-scripts`.
- **DT-4. Qué se queda en la raíz y qué va a `landing-pages/`.**
  - **Raíz:** `deploy/`, `ops/`, `security/`, `docs/`, `docker/` (el `initdb` del MySQL de desarrollo que usa `compose.yaml`), `compose.yaml`, `.nvmrc`, `.dockerignore`, `README.md`, `package.json` y `package-lock.json`, más un `.gitignore` con lo común (`node_modules/`, `.env*`, logs y editores).
  - **`landing-pages/`:** `src/`, `public/`, `tests/`, `scripts/`, `prisma/`, `prisma.config.ts`, `tsconfig.json`, `vitest.config.ts`, `eslint.config.ts`, `.env.example`, el `Dockerfile` y un `.gitignore` propio. Los patrones `public/css/*`, `src/generated/` y `data/` son relativos a su `.gitignore`, así que tienen que ir en el de `landing-pages/`.
  - **Sin `tsconfig.base.json` en este paso:** con un solo workspace no aporta nada; entra en el paso 2, con los paquetes. Esta desviación de §4 se registra en `arquitectura.md`.
- **DT-5. `.env` y `data/` locales.** `--env-file-if-exists=.env`, `prisma.config.ts` y `DEFAULT_DATA_DIR` resuelven desde el workspace, así que el `.env` de desarrollo y `data/` pasan a `landing-pages/`. En producción no cambia nada: `DATA_DIR` y las variables las fija `compose.prod.yaml`. Durante la implementación muevo tus `restaurante/.env` y `restaurante/data/` locales, que no se versionan, a `landing-pages/` sin modificar su contenido. El README explica cómo hacerlo en otra copia.

  `compose.yaml` interpola `RESTAURANTE_DB_*_PASSWORD` desde el entorno o desde un `.env` en `restaurante/`. Sin ese archivo usa los valores por defecto de desarrollo, igual que hoy si no están definidas. Se documenta.
- **DT-6. Archivos de `.claude/`.** RF-11 pide las rutas de `.claude/rules/` y `CLAUDE.md`. Las definiciones de los agentes (`.claude/agents/senior-fullstack.md`, `senior-qa.md` y `business-analyst.md`) también citan `restaurante/src`, `restaurante/tests`, la estructura y "comandos desde `restaurante/`". Propongo actualizar en el mismo PR solo sus rutas y su árbol de estructura, sin cambiar reglas ni comportamiento, junto con `.claude/rules/codegraph.md` (rutas indexadas). **Si no quieres tocar los agentes, indícalo al aprobar** y quedarán desactualizados hasta un ticket propio.

### Archivos o componentes afectados

- **Traslado con `git mv`** de `restaurante/` a `restaurante/landing-pages/`: `src/`, `public/`, `tests/`, `scripts/`, `prisma/`, `prisma.config.ts`, `tsconfig.json`, `vitest.config.ts`, `eslint.config.ts`, `.env.example`, `Dockerfile` y `.gitignore` (este con su contenido ajustado). `package.json` se divide: se crea uno nuevo para la raíz y el actual pasa al workspace. `package-lock.json` se regenera en la raíz con `npm install`.
- **Nuevos:** `restaurante/package.json` (raíz) y `restaurante/.gitignore` (raíz).
- **Cambian:**
  - `landing-pages/Dockerfile`, `restaurante/.dockerignore` y `restaurante/compose.yaml`;
  - `.github/workflows/ci.yml` y `.github/dependabot.yml`;
  - `landing-pages/scripts/audit-deps.ts`, `landing-pages/scripts/generate-icons.py`, `landing-pages/tests/unit/content.test.ts`, `landing-pages/tests/unit/whatsapp-bot-free-text.test.ts`, `landing-pages/tests/integration/db-migrations.test.ts` y `landing-pages/tests/support/database-admin.ts`;
  - `README.md`, `docs/desarrollo.md`, `docs/despliegue.md` y `docs/arquitectura.md`;
  - `.claude/CLAUDE.md`, `.claude/rules/{testing,javascript,typescript,assets,codegraph}.md` y, si se aprueba DT-6, `.claude/agents/*.md`.
- **No cambian:** `deploy/compose.prod.yaml`, `deploy/deploy.sh`, `deploy/mysql/initdb/01-usuarios.sh`, `deploy/ci/*` y `ops/backup/**`. Los scripts de humo reciben las imágenes por etiqueta y resuelven `deploy/` de forma relativa entre sí, y las dos carpetas no se mueven.

### Backend

Solo cambian rutas de archivos; ningún archivo de `src/` cambia de comportamiento.

- `PROJECT_DIR` (`src/config/env.ts`) pasa a apuntar a `landing-pages/` sin tocar el código, porque se calcula desde `import.meta.url`. Con él se mueven `DEFAULT_DATA_DIR`, `DEFAULT_MIGRATIONS_DIR` (`src/db/verify.ts`) y la regla de que `DATA_DIR` no puede estar en `src/` ni en `public/`, todos coherentes con el workspace. En la imagen, `PROJECT_DIR` vale `/app/landing-pages`.
- `scripts/audit-deps.ts`: `npm audit` corre en la raíz de los workspaces, donde está el lockfile, y `EXCEPTIONS_FILE` apunta a `restaurante/security/audit-exceptions.json`. Los cortes (`CUT_ARGS`) no cambian. Con un solo workspace, el árbol auditado es el mismo que hoy.
- `scripts/generate-icons.py`: `SOURCE_DIR` sube un nivel más (`ROOT.parent.parent / "_stich_source_"`).

### Contenido / configuración

`package.json` de la raíz:

- `"private": true`, `"workspaces": ["landing-pages"]`, `engines` y `allowScripts` (DT-3).
- Los mismos scripts de RF-2, cada uno delegando con `npm run <script> -w landing-pages --`. El `--` final permite pasar argumentos: `npm run db:migrate:dev -- --name x`, `npm run admin:recover -- --usuario y`, `npm run bot:chat -- --ahora ...` y filtros de `npm test`.
- `db:up` y `db:down` se definen en la raíz, porque `compose.yaml` es compartido. El workspace también los conserva, porque `docker compose` busca `compose.yaml` en los directorios padre. Se comprueba en la implementación.

`package.json` de `landing-pages/`: el actual, con `"name": "landing-pages"`, sin `allowScripts` y con los mismos scripts. `server-startup-config.test.ts` sigue leyendo `start` y `dev` de este archivo (`PROJECT_DIR/package.json`).

### Testing

Solo cambian rutas de archivos; ninguna aserción (CA-8):

- `content.test.ts`: `STITCH` sube cuatro niveles. En local llega a `Negocio/_stich_source_`, y en la imagen `test`, de `/app/landing-pages/tests/unit` a `/_stich_source_`. Ambos casos coinciden con el `COPY` actual.
- `whatsapp-bot-free-text.test.ts`: lee `../../../README.md`, el README de la raíz.
- `db-migrations.test.ts` y `tests/support/database-admin.ts` lanzan hoy `PROJECT_DIR/node_modules/.bin/prisma`, que con la elevación ya no existe. Pasan a resolver el CLI con `createRequire(...).resolve('prisma/package.json')` y su campo `bin`, sin suponer en qué `node_modules` está, y lo ejecutan con `process.execPath`. El `cwd` sigue siendo `PROJECT_DIR`.
- `http-test-convention.test.ts`, `chat-bot-boundaries.test.ts` y `tests/support/process.ts` usan `PROJECT_DIR` y siguen siendo válidos dentro del workspace.

Antes de mover nada, se cuenta el número de pruebas de `main` (`vitest run --reporter=json`). Después tiene que ser igual o mayor (CA-3).

### CI (`.github/workflows/ci.yml`)

Los nombres de los jobs, su orden, las condiciones, los `needs`, los scopes de caché y las etiquetas no cambian.

- **`cambios`:** el `case` no cambia. `restaurante/docs/*.md`, `.claude/*` y los `*.md` fuera de `restaurante/` siguen siendo documentación, y `restaurante/*`, que incluye `restaurante/landing-pages/**` y el README de la raíz, sigue siendo código (CA-5). Solo se actualiza el comentario con las rutas nuevas (`landing-pages/tests/...`).
- **`calidad`:** mantiene `working-directory: restaurante` (la raíz de los workspaces), `node-version-file: restaurante/.nvmrc` y `cache-dependency-path: restaurante/package-lock.json`. `npm ci` y los `npm run` delegan en el workspace. El paso "migraciones sin divergencia" pasa a `working-directory: restaurante/landing-pages`, con el CLI de la raíz, `../node_modules/.bin/prisma migrate diff ...`, o `npm exec -w landing-pages`, lo que se verifique que funciona. Las rutas `prisma/...` no cambian.
- **`auditoria`:** `working-directory: restaurante` y `npm run audit:deps`, que delega y no necesita `node_modules`; sigue sin ejecutar `npm ci`.
- **`docker`, `despliegue` y `publish`:** `context: restaurante` y `file: restaurante/landing-pages/Dockerfile` en las seis construcciones. Las comprobaciones de contenido pasan a rutas absolutas en los dos niveles posibles de `node_modules`. Por ejemplo, `test ! -e /app/node_modules/prisma && test ! -e /app/landing-pages/node_modules/prisma ...` y `test -e /app/node_modules/@prisma/adapter-mariadb`. Así no dan un falso positivo por el cambio de `WORKDIR`. "migrate sobre una base vacía" y "production healthy" no cambian, porque la red `restaurante_db-test` se llama así por la carpeta de `compose.yaml`, que no se mueve. Los shellcheck, la prueba del resumen, systemd y las dos pruebas de humo no cambian.
- **`validado`, `vigente` y `deploy`:** sin cambios. La suma de `restaurante/deploy` se calcula igual y sobre los mismos tres archivos (CA-6).

### Dependabot (`.github/dependabot.yml`)

- `npm`: `directory: /restaurante`, sin cambios. Es la raíz de los workspaces con el lockfile, y Dependabot actualiza los `package.json` de los workspaces desde ahí.
- `docker`: `directory: /restaurante/landing-pages`, donde queda el Dockerfile.
- `github-actions`: `/`, sin cambios.
- La política, los grupos, el horario y los prefijos no cambian. Solo se actualizan los comentarios: `allowScripts` está en el `package.json` de la raíz, y un PR que suba la imagen también sube `.nvmrc` y `engines.node` de los dos `package.json`.

### Documentación

- `README.md` de la raíz:
  - pasa a ser la guía del monorepo: la estructura nueva, qué hay en la raíz y qué en `landing-pages/`, y los comandos desde `restaurante/` (o con `-w landing-pages`);
  - se mueven el `.env` y `data/` (DT-5);
  - se actualizan las rutas de todas las secciones actuales.

  Se mantiene la sección "Plantilla del aviso al personal", que la prueba compara.
- `docs/desarrollo.md` y `docs/despliegue.md`: se actualizan las rutas. La vuelta atrás y los comandos de consola en el VPS no cambian.
- `docs/arquitectura.md`:
  - **§9:** registro de A con fecha 2026-10-24, la cita "tres contenedores", la opción elegida y qué corresponde al paso 1 y qué a los pasos 3 y 4. El título de la sección y el encabezado del documento dejan de contar A como pendiente.
  - **§4:** el árbol añade `deploy/`, `ops/`, `security/`, `docs/` y `docker/` en la raíz, y una nota indica que `tsconfig.base.json` y el lint común llegan en el paso 2.
  - **§8:** se precisa el paso 1: los archivos de la suma de `deploy/` no se tocan.
  - **§10:** resultado de la medición de memoria.
- No se documentan `api/` ni `inventory-manager/` como si existieran.

### Medición de memoria del VPS (RF-10, CA-13)

Por SSH a `root@179.236.68.95`, solo con comandos de lectura y sin reiniciar ni cambiar nada:

- `free -m` y `nproc`: RAM total, uso y swap.
- `docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}'`: uso de MySQL, `app` y Traefik.
- `docker ps --format '{{.Names}}\t{{.Image}}'`: confirma qué contenedores son.

Dos tomas:

- **En reposo:** fuera del horario de servicio.
- **Con tráfico normal:** durante el horario de servicio de un día de birria (sábado o domingo), con el tráfico real. No se genera carga artificial contra producción.

Estimación con tres contenedores:

- uso actual medido con tráfico más **2 ×** el uso de `app` con tráfico, como cota conservadora de `api` e `inventory-manager`;
- porcentaje sobre la RAM total.

Si supera el 80 %, el registro lo dice y anota que A se revisa con el usuario antes del paso 3. El registro, fechado, va en `arquitectura.md` §10. La medición la hago yo durante la implementación (T2). Si en ese momento no tengo acceso SSH, lo informo y no doy CA-13 por cumplido.

### Seguridad

- No se relajan la CSP, `--strict-allow-scripts`, la salvaguarda de bases de prueba ni la red interna `db-test`.
- La imagen `production` sigue sin el CLI de Prisma, TypeScript, el README, `deploy/`, `ops/` ni `security/`.
- No se toca ningún secreto. La medición del VPS no lee `.env` ni muestra variables.

### Performance

En ejecución no cambia nada. El primer CI tarda más porque las cachés de Actions y de Docker se invalidan (R-3).

### Riesgos técnicos

- **RT-1. `allowScripts` en workspaces** (DT-3): se comprueba en local, en `calidad` y en Docker.
- **RT-2. Rutas a `node_modules/.bin` elevado** en pruebas y en el CI: quedan cubiertas por las pruebas de migraciones y por el paso de divergencia.
- **RT-3. Falso positivo en las comprobaciones de contenido de las imágenes** por el cambio de `WORKDIR`: se resuelve con rutas absolutas en los dos niveles.
- **RT-4. Lockfile regenerado:** `npm install` puede cambiar versiones dentro de los rangos. Se regenera con las versiones que ya fija el lockfile y se compara (`npm ls` antes y después) para que no cambie ninguna versión resuelta. Si cambiara alguna, se informa.
- **RT-5. Tailwind, ESLint y tsc resuelven paquetes elevados** (`@import "tailwindcss"`, `@plugin` y `@types/node`) buscando en los directorios padre. Se comprueba con `build:css`, `lint` y `typecheck`.
- **RT-6. El merge despliega en producción.** El PR tiene que pasar los cuatro checks. Tras el merge se verifican CA-9 y CA-10; si fallan, `deploy.sh` vuelve atrás solo a la versión anterior.

### Orden de implementación

1. Rama `feature/REQ-F-036-monorepo-workspaces-landing-pages` y ticket a `in-progress/`.
2. Primera toma de memoria del VPS y línea base: número de pruebas, `npm ls --all` y la suma de `deploy/`.
3. `git mv` a `landing-pages/`, el `package.json` de la raíz, los dos `.gitignore`, `npm install` para regenerar el lockfile y traslado del `.env` y `data/` locales.
4. Rutas en las pruebas y en los scripts. En local: `npm ci --strict-allow-scripts`, `db:generate`, `typecheck`, `lint`, `build:css`, `db:up` y `test`.
5. Dockerfile, `.dockerignore` y `compose.yaml`. En local: `docker build` de `production` y `migrate`, las comprobaciones de contenido y `docker compose run --rm test`.
6. `ci.yml` y `dependabot.yml`, con la prueba local del `case` de `cambios` sobre rutas de ejemplo.
7. Documentación, registro de A y medición con tráfico.
8. Validación completa, revisión de `git diff` y estado `NEEDS_IMPLEMENTATION_APPROVAL`.

### Cómo se verifica cada CA

| CA | Verificación |
| --- | --- |
| CA-1, CA-2 | `npm ci --strict-allow-scripts` en un clon limpio (`git worktree`); `find restaurante -name package-lock.json -not -path '*/node_modules/*'` devuelve uno solo; `ls` de la raíz y de `landing-pages/` |
| CA-3 | `typecheck`, `lint` y `test` desde `restaurante/`; número de pruebas de `vitest --reporter=json` comparado con la línea base de `main` |
| CA-4 | `gh pr checks`: `cambios`, `calidad`, `auditoria`, `docker` y `despliegue` en verde |
| CA-5 | Prueba local del `case` con `restaurante/docs/x.md` y `.claude/x` (documentación) y con `restaurante/landing-pages/src/x.ts` (código); en el PR, `cambios` lo marca como código |
| CA-6 | `git diff main -- <los tres archivos>` vacío y la suma calculada antes y después |
| CA-7 | `diff` de las etiquetas de `publish` y de los routers; `compose.prod.yaml` sin cambios |
| CA-8 | `git diff main -M -- restaurante/landing-pages/tests` solo con cambios de rutas; las instantáneas sin cambios |
| CA-9, CA-10 | Tras el merge (fase T4/T5, con el usuario): `deploy` en "Desplegado"; `curl -o /dev/null -w '%{http_code}'` a `/`, `/molotes` y `/birria` (200), y `curl -sI` a `http://` y `www` (301). Por SSH, con lecturas antes y después: `docker compose exec app ls /var/lib/restaurante/*` y el número de filas de productos y usuarios y el estado del interruptor del bot, con `SELECT` desde el contenedor de MySQL |
| CA-11 | Las tres entradas de `dependabot.yml` apuntan a directorios que existen (`test -f restaurante/package-lock.json`, `test -f restaurante/landing-pages/Dockerfile`), y el resto de la política sin cambios en el diff |
| CA-12 | Revisión de §9 y del encabezado de `arquitectura.md` |
| CA-13 | Registro fechado en §10 con las cifras y el porcentaje |
| CA-14 | Seguir en local la puesta en marcha del README y de `docs/desarrollo.md`: `npm ci`, `db:up`, `dev` (curl a `/` y `/molotes`), `npm test` y `docker compose run --rm test`; `test -e` sobre cada ruta citada en `.claude/rules/` y `CLAUDE.md` |

### Criterios de finalización

- CA-1 a CA-8 y CA-11 a CA-14 verificados antes del PR.
- CA-9 y CA-10 tras el merge.
- `typecheck`, `lint` y `test` en 0.
- Sin cambios fuera del alcance en `git diff`.
- Los tres archivos de la suma de `deploy/` intactos.

## Implementation Result

### Rama

`feature/REQ-F-036-monorepo-workspaces-landing-pages`, creada desde `main` (`25eb36d`). Sin commits: el commit y el PR van en la fase T4.

### Cambios realizados

- **Traslado:** con `git mv` pasan de `restaurante/` a `restaurante/landing-pages/` los directorios `src/`, `public/`, `tests/`, `scripts/` y `prisma/` y los archivos `prisma.config.ts`, `tsconfig.json`, `vitest.config.ts`, `eslint.config.ts`, `.env.example`, `Dockerfile`, `.gitignore` y `package.json`, conservando el historial. Son 402 renombrados; los binarios no cambian.
- **Raíz de los workspaces:**
  - `restaurante/package.json` nuevo: `private`, `workspaces: ["landing-pages"]`, `engines`, `allowScripts` (traído del workspace sin cambios) y los scripts de RF-2. Cada script delega con `npm run <x> -w landing-pages --`; `db:up` y `db:down` van directos.
  - El `package.json` del workspace se llama ahora `landing-pages` y ya no lleva `allowScripts`.
  - El lockfile se regeneró. Las 510 dependencias resueltas son idénticas, con la misma versión y las mismas marcas `dev`, `optional` y `peer`; solo se añaden la entrada del workspace y su enlace.
  - Hay un `.gitignore` común en la raíz y otro propio en `landing-pages/`, cuyos patrones son relativos a su ubicación.
- **`.env` y `data/` locales (DT-5):** movidos a `landing-pages/` sin tocar su contenido. No se versionan.
- **Rutas en las pruebas y los scripts** (sin tocar ninguna aserción):
  - `content.test.ts`: `_stich_source_` está ahora cuatro niveles arriba.
  - `whatsapp-bot-free-text.test.ts`: lee el README de la raíz.
  - `tests/support/database-admin.ts`: nuevo `spawnPrisma`, que resuelve el CLI de Prisma con `createRequire` y su campo `bin`, sea cual sea el `node_modules` en que esté. Lo usan `runMigrateDeploy` y `db-migrations.test.ts`, y se reexporta desde `tests/support/database.ts`.
  - `scripts/audit-deps.ts`: `npm audit` y `security/` se leen en la raíz.
  - `scripts/generate-icons.py`: `_stich_source_` está un nivel más arriba.
  - `src/config/env.ts`: solo cambia el comentario de `PROJECT_DIR`.
- **Docker (DT-1, DT-2):**
  - `landing-pages/Dockerfile`: `WORKDIR /app/landing-pages`, y la raíz (`package*.json` y `node_modules`) en `/app`. `npm ci` se ejecuta en `/app`.
  - `build` copia `landing-pages/` y el `README.md` de la raíz.
  - `migrate` usa `ENTRYPOINT /app/node_modules/.bin/prisma migrate deploy`.
  - `production` copia lo mismo que antes, desde `/app/landing-pages`.
  - `restaurante/.dockerignore` tiene las rutas nuevas y excluye además `deploy/`, `docs/` y `security/`.
  - `compose.yaml`: `dockerfile: landing-pages/Dockerfile` en el servicio `test`.
- **CI (`ci.yml`):**
  - Mismos jobs, condiciones, caché y etiquetas.
  - `file: restaurante/landing-pages/Dockerfile` en las seis construcciones.
  - Comprobaciones de contenido con rutas absolutas en los dos niveles de `node_modules`.
  - Paso de divergencia en `restaurante/landing-pages`, con el CLI elevado de la raíz.
  - `auditoria` usa `npm run audit:deps`.
  - El `case` de `cambios` queda igual; solo cambian los comentarios.
- **Dependabot:** la entrada `docker` apunta a `/restaurante/landing-pages`. `npm` sigue en `/restaurante` y `github-actions` en `/`. Solo cambian los comentarios.
- **`deploy/ci/smoke.sh`** (fuera de la suma): la migración "más nueva" de la imagen derivada se copia a `prisma/migrations/`, relativo al `WORKDIR`, en lugar de a `/app/prisma/migrations/`. Con la ruta absoluta, la prueba de vuelta atrás D-1 fallaba localmente ("y lo registra (database_newer_than_code_allowed)"). La ruta relativa vale para las imágenes de antes y de después del monorepo.
- **Documentación:**
  - `README.md`: sección "Monorepo", árbol de estructura, puesta en marcha, Docker (contexto de build y `-f landing-pages/Dockerfile`), reproducción del CI en local, Dependabot y `allowScripts`.
  - `docs/desarrollo.md` y `docs/despliegue.md`: rutas y distribución de la imagen.
  - `docs/arquitectura.md`: §9 con la decisión A registrada; encabezado; §4 con lo compartido en la raíz y sin `tsconfig.base.json` hasta el paso 2; §8 con el detalle del paso 1; §10 con la medición de memoria.
  - `.claude/rules/{codegraph,javascript,testing,typescript,assets}.md` y `.claude/agents/*.md` (DT-6): solo rutas y estructura.
  - `.claude/CLAUDE.md` no cita rutas de `restaurante/`, así que no cambia.

### Criterios de aceptación

| CA | Estado | Evidencia |
| --- | --- | --- |
| CA-1 | Cumple | En una copia limpia (solo archivos versionados y no ignorados), `npm ci --strict-allow-scripts` termina con 0. Hay un único `package-lock.json`, en `restaurante/`, y `landing-pages/` contiene `src/`, `public/`, `tests/`, `scripts/`, `prisma/` y `Dockerfile`. Quitando `allowScripts` de la raíz, `npm ci` falla con los scripts sin aprobar: npm lo lee de la raíz (RT-1) |
| CA-2 | Cumple | La raíz tiene `deploy/`, `ops/`, `security/`, `docs/`, `compose.yaml` y `README.md`, y no tiene `src/`, `public/`, `tests/` ni `prisma/` |
| CA-3 | Cumple | `typecheck` 0, `lint` 0 y `test` 0 desde `restaurante/`: 1981 pruebas, 1981 superadas y 411 suites, igual que la línea base de `main` (1981 y 411) |
| CA-4 | Pendiente del PR (T4) | En local pasan los builds `production` y `migrate`, el contenido de las imágenes con las comprobaciones nuevas, migrate sobre una base vacía, production healthy en 0.0.0.0 (log `server_started` con `host 0.0.0.0` y 200 en `/molotes`), shellcheck de `deploy/` y `ops/backup` (imagen `koalaman/shellcheck:stable`), `resumen-test.sh`, `deploy/ci/smoke.sh` (45 ok, 0 fallos) y `ops/backup/ci/smoke.sh` (55 ok, 0 fallos). La prueba de systemd (`systemd-analyze`) solo corre en el runner Linux |
| CA-5 | Cumple (simulado) | El `case` de `cambios` clasifica `restaurante/docs/*.md`, `.claude/**` y `README.md` como documentación, y `restaurante/landing-pages/**`, `restaurante/README.md`, `restaurante/package-lock.json` y `.github/**` como código |
| CA-6 | Cumple | `git diff main` sobre los tres archivos está vacío. La suma es `dd2dc90d7d71b07ce53d8ecd5ddecfa6a6b678b7de56b65b56170980d9c72b30` antes y después |
| CA-7 | Cumple | Las etiquetas `ghcr.io/orvigas/restaurante:sha-…` y `restaurante-migrate:sha-…` no cambian. No se añade ningún servicio, router ni registro DNS |
| CA-8 | Cumple | En `tests/` solo cambian rutas: `content`, `whatsapp-bot-free-text`, `db-migrations` y el soporte de base de datos. Las instantáneas y las aserciones no cambian |
| CA-9, CA-10 | Pendiente (tras el merge) | Se verifican con `curl` y con lecturas por SSH según el plan |
| CA-11 | Cumple | `/restaurante/package-lock.json`, `/restaurante/landing-pages/Dockerfile` y `/` existen. La política no cambia |
| CA-12 | Cumple | §9 registra A con la fecha 2026-10-24, la cita "tres contenedores", la opción elegida y la división entre los pasos 1, 3 y 4. El encabezado ya no cuenta A como pendiente |
| CA-13 | **Parcial** | Registrada la toma en reposo del 2026-10-24 a las 19:57 (America/Mexico_City, sábado, fuera de horario): RAM total de 3915 MiB y 1066 MiB usados en el host; `app` 67,2, MySQL 509,9 y Traefik 118,4 MiB. Con dos contenedores Node más, la estimación es de 1200 MiB, el **30,7 %**, por debajo del 80 %. **Falta la toma con tráfico normal**: requiere el horario de servicio (sábado o domingo de 08:00 a 15:00) y no se generó carga artificial. Queda indicado como pendiente en §10 |
| CA-14 | Cumple | `npm ci` y `db:up`; `npm run dev` desde la raíz (200 en `/`, `/molotes` y `/birria`, y 303 en `/admin`); `npm test`; `docker compose run --rm test` (93 archivos; 1979 superadas, 1 *expected fail* y 1 omitida por root, igual que antes); argumentos con `--` (`npm test -- <archivo>`, `bot:chat -- --ahora`). Todas las rutas citadas en `.claude/` existen |

### Validaciones ejecutadas

- `npm ci --strict-allow-scripts` (raíz): 0.
- `npm run db:generate`: 0.
- `npm run typecheck`: 0.
- `npm run lint`: 0.
- `npm run build:css`: 0.
- `npm test`: 0, con 1981 de 1981.
- `docker build -f landing-pages/Dockerfile --target production` y `--target migrate`: 0.
- Comprobaciones de contenido del CI: 0.
- Imagen `migrate` sobre una base vacía: "All migrations have been successfully applied".
- Imagen `production`: `healthy`, `host` `0.0.0.0` y 200 en `/molotes`; `node scripts/hash-password.ts` responde dentro del contenedor.
- `docker compose run --rm test`: 0.
- `prisma migrate diff ... --exit-code` en `landing-pages/`: "No difference detected".
- `npm run audit:deps`: sin bloqueos.
- `deploy/ci/smoke.sh`: 0 después de la corrección de `smoke.sh`.
- `ops/backup/ci/smoke.sh`: 0, con las mismas rutas del host en el contenedor `docker:cli`.
- `shellcheck` de `deploy/` y `ops/backup`: 0.
- `resumen-test.sh`: todas las comprobaciones pasaron.

### Archivos afectados

- **Nuevos:**
  - `restaurante/package.json`;
  - `restaurante/.gitignore`.
- **Modificados:**
  - `.github/workflows/ci.yml`, `.github/dependabot.yml`;
  - `restaurante/.dockerignore`, `restaurante/compose.yaml`, `restaurante/package-lock.json`, `restaurante/README.md`;
  - `restaurante/deploy/ci/smoke.sh`;
  - `restaurante/docs/{arquitectura,desarrollo,despliegue}.md`;
  - `.claude/rules/{assets,codegraph,javascript,testing,typescript}.md` y `.claude/agents/{business-analyst,senior-fullstack,senior-qa}.md`.
- **Movidos y modificados:**
  - `landing-pages/{Dockerfile,package.json,.gitignore}`;
  - `landing-pages/scripts/{audit-deps.ts,generate-icons.py}`;
  - `landing-pages/src/config/env.ts` (solo el comentario);
  - `landing-pages/tests/{unit/content.test.ts,unit/whatsapp-bot-free-text.test.ts,integration/db-migrations.test.ts,support/database-admin.ts,support/database.ts}`.
- **Movidos sin cambios:** el resto de `src/`, `public/`, `tests/`, `scripts/` y `prisma/`, y los archivos `prisma.config.ts`, `tsconfig.json`, `vitest.config.ts`, `eslint.config.ts` y `.env.example`.

### Riesgos o pendientes

- **CA-13:** falta la toma con tráfico normal, en horario de birria. La conclusión con la toma en reposo (30,7 %) tiene mucho margen.
- **CA-4 y CA-5:** se confirman en el PR. CA-9 y CA-10, tras el merge.
- **Comprobación de systemd:** `systemd-analyze` solo corre en el runner.
- **Arquitectura:** los builds locales son arm64 y el CI construye amd64.
- **Primer CI del PR:** más lento, porque las cachés se invalidan (R-3).
- **Red de pruebas local:** para la prueba de humo creé la red de Docker `traefik-public` (si no existía ya). Es inocua y se puede borrar con `docker network rm traefik-public`.

## QA Action Plan

### Objetivo

Comprobar con evidencia que el traslado a `restaurante/landing-pages/` con npm workspaces no cambia nada observable (HTML, códigos HTTP, encabezados y logs), que la suite, el lint, el typecheck, las imágenes Docker y las pruebas de humo pasan con la nueva estructura, que el pipeline conserva los nombres, las condiciones y la suma de `deploy/`, y que la documentación permite trabajar desde cero.

### Requisito bajo prueba

RF-1 a RF-11 de REQ-F-036 (versión 1), con DT-1 a DT-6 del Technical Action Plan aprobado.

### Criterios de aceptación

| CA | Pruebas | Se confirma en |
| --- | --- | --- |
| CA-1 | F-1, F-2 | Local (Q2) |
| CA-2 | F-3 | Local (Q2) |
| CA-3 | F-4, F-5, F-6 | Local (Q2) |
| CA-4 | D-1 a D-6 (local, equivalente); I-1 en el PR | Local, de forma parcial; definitivo en el CI del PR |
| CA-5 | C-2 (simulación del `case`); I-2 en el PR | Simulado en local; definitivo en el CI del PR |
| CA-6 | C-3 | Local (Q2) |
| CA-7 | C-4 | Local (Q2) |
| CA-8 | R-1 a R-6 | Local (Q2) |
| CA-9, CA-10 | I-3 (después del merge) | No se valida en esta QA |
| CA-11 | C-5 | Local (Q2) |
| CA-12 | DOC-1 | Local (Q2) |
| CA-13 | DOC-2 (solo la parte registrada) | Parcial. La toma con tráfico la hace `senior-fullstack` el domingo 2026-10-25 |
| CA-14 | F-7, DOC-3, DOC-4 | Local (Q2) |

### Riesgos identificados

- **QR-1. Rutas relativas rotas** en las pruebas (`_stich_source_`, README de la raíz), en `generate-icons.py`, en `audit-deps.ts`, en el contexto `design` de Docker y en el `.dockerignore`, que ahora vive en la raíz del contexto.
- **QR-2. `node_modules` elevado:** `spawnPrisma` (nuevo, en `tests/support/database-admin.ts`), el paso de divergencia del CI y el `ENTRYPOINT` de `migrate`.
- **QR-3. `allowScripts` en la raíz:** el `postinstall` de Prisma se ejecuta y `@parcel/watcher` y `fsevents` se deniegan.
- **QR-4. Falso positivo en las comprobaciones de contenido de las imágenes** por el cambio de `WORKDIR` (si una ruta no existe, `test ! -e` pasa siempre).
- **QR-5. Fugas en la imagen `production`:** el README, `deploy/`, `ops/`, `security/`, `docs/`, `.env` o `data/` llegan a la imagen por el `.dockerignore` nuevo.
- **QR-6. Cambio en `deploy/ci/smoke.sh`, fuera de la suma de `deploy/`:** la ruta relativa al `WORKDIR` tiene que servir tanto para la imagen `migrate` de antes como para la de después, sin debilitar la prueba de vuelta atrás D-1.
- **QR-7. Lockfile regenerado:** podría haber cambiado alguna versión resuelta.
- **QR-8. Cambios de comportamiento ocultos en el traslado:** archivos marcados como `RM` (movidos y modificados) que no estaban previstos.
- **QR-9. Paso de argumentos con `--`** en los scripts de la raíz (`test -- <filtro>`, `db:migrate:dev -- --name`, `admin:recover -- --usuario`, `bot:chat -- --ahora`).
- **QR-10. Rutas de `.env` y `data/`:** con `--env-file-if-exists=.env` desde el workspace, si no se encuentra el `.env`, la app arranca con la configuración por defecto sin avisar.

### Pruebas funcionales

- **F-1.** Copia limpia en el scratchpad, solo con los archivos versionados y los del árbol de trabajo, sin `node_modules`, `.env`, `data/` ni archivos ignorados (con `git ls-files -co --exclude-standard`). `npm ci --strict-allow-scripts` en `restaurante/` termina con 0. Se registra en la salida que los scripts de `prisma` y `@prisma/engines` se ejecutan y que `@parcel/watcher` y `fsevents` no (QR-3).
- **F-2.** `find restaurante -name package-lock.json -not -path '*/node_modules/*'` devuelve una sola ruta, y en `landing-pages/` existen `src/`, `public/`, `tests/`, `scripts/`, `prisma/` y `Dockerfile`.
- **F-3.** `ls` de `restaurante/`: están `deploy/`, `ops/`, `security/`, `docs/`, `compose.yaml` y `README.md`, y no están `src/`, `public/`, `tests/` ni `prisma/` (tampoco como restos sin versionar).
- **F-4.** Desde `restaurante/`: `npm run typecheck`, `npm run lint` y `npm run build:css` terminan con 0, sin avisos.
- **F-5.** `npm test` desde `restaurante/` termina con 0. El número de pruebas y de archivos se compara con la línea base de `main` (1981 pruebas y 411 suites, según el Implementation Result). La línea base se recalcula en la copia de `main` de R-1 con `vitest run --reporter=json`, para no depender solo de lo que declara el implementador.
- **F-6.** Ninguna prueba se ha quitado ni se ha marcado como `skip`/`only`: se comparan los nombres de las pruebas del JSON de `main` con los de la rama.
- **F-7.** Scripts de RF-2: `diff` entre los nombres de `scripts` del `package.json` de `main` y los de la raíz nueva (deben estar todos). Además, se ejecutan desde la raíz `npm run dev` (curl a `/`, `/molotes`, `/birria` y `/admin`), `npm test -- tests/unit/business-schedule.test.ts` (que el filtro llegue) y `npm run bot:chat -- --help` o `--ahora` con una entrada mínima no interactiva, si el script lo permite (QR-9). `npm run audit:deps` (sin bloqueos).

### Pruebas negativas y casos límite

- **N-1.** Con `allowScripts` quitado de una copia temporal del `package.json` de la raíz (en el scratchpad, nunca en el repo), `npm ci --strict-allow-scripts` falla (QR-3).
- **N-2.** El servidor arrancado desde `restaurante/` y desde `restaurante/landing-pages/` usa el mismo `landing-pages/.env` (por ejemplo, el mismo puerto configurado y el mismo `DATA_DIR` en el log `server_started`). Se documenta qué pasa si se ejecuta con un `.env` todavía en `restaurante/` (QR-10). Esto se registra como observación y no como defecto, salvo que contradiga el README.
- **N-3.** `DATA_DIR` dentro de `landing-pages/src` o de `landing-pages/public` sigue rechazado. Lo cubre la suite; se confirma que la prueba existente sigue pasando.
- **N-4.** Vuelta atrás a un digest anterior al monorepo: la prueba D-1 de `deploy/ci/smoke.sh` ejecuta la imagen `migrate` derivada. Se ejecuta el smoke completo y se confirma que la aserción "database_newer_than_code_allowed" aparece en la salida (QR-6).

### Pruebas de regresión

- **R-1. HTML idéntico entre `main` y la rama.** `main` se extrae con `git archive main restaurante` en el scratchpad (sin `git worktree` ni `git stash`), con `npm ci`, `build:css`, `db:generate` y una copia del `.env` local con otro `PORT`. Los dos servidores se levantan a la vez (`NODE_ENV=development`, la misma base de desarrollo y el mismo `DATA_DIR`) en puertos libres. Se comparan con `diff` el cuerpo, el código HTTP y los encabezados de:
  - `/`, `/molotes` y `/birria` sin `?dia=` (sábado o domingo real, según el día de la ejecución);
  - `/?dia=<d>` y `/molotes?dia=<d>` para los siete días (`lunes` … `domingo`), con lo que se cubren los avisos "Descanso", "Molotes" y "Hoy toca birria" y su ausencia;
  - `/birria?dia=lunes` (nunca muestra aviso);
  - `/admin` (303 y `Location`), `/admin/login` (200 y HTML) y `/webhooks/whatsapp` (GET sin parámetros y POST sin firma: mismos códigos);
  - una ruta inexistente (404) y los assets referenciados en el HTML (CSS, JS, imágenes, `manifest` e iconos): mismo código, `Content-Type` y tamaño.

  Solo se normalizan los valores que cambian en cada petición (nonce de la CSP, `Date`, cookies de sesión y CSRF), y se indica cuáles. El CSS se compila en las dos copias con la misma versión de Tailwind, y el `diff` de `public/css/*.css` también tiene que estar vacío.
- **R-2.** La selección del día con la fecha del negocio (sin `?dia=`) se compara también con `BUSINESS_TIMEZONE=Pacific/Kiritimati` (UTC+14), de modo que el día del negocio sea distinto del de la zona del servidor. Las dos versiones tienen que dar el mismo aviso. Las transiciones de viernes 23:59 a sábado 00:00 y de domingo 23:59 a lunes 00:00 se validan con la suite (`business-schedule.test.ts` y `home-notice.test.ts`), que no cambia.
- **R-3. CA-8:** `git diff main -M --stat -- restaurante/tests restaurante/landing-pages/tests` (con rename detection). Se revisa el diff completo de los cinco archivos modificados (`content.test.ts`, `whatsapp-bot-free-text.test.ts`, `db-migrations.test.ts`, `support/database-admin.ts` y `support/database.ts`): solo pueden cambiar las rutas y la forma de lanzar Prisma, sin ninguna aserción tocada. Las instantáneas (`__snapshots__`, si las hay) no cambian.
- **R-4. Archivos movidos y modificados de `src/` y `scripts/`:** el diff de `src/config/env.ts` es solo el comentario; `audit-deps.ts` y `generate-icons.py` solo cambian las rutas. Se comprueba que ningún otro archivo de `src/`, `public/` ni `prisma/` aparece como modificado (QR-8).
- **R-5. Lockfile:** `npm ls --all --json` de la copia de `main` y de la rama, comparados sin la entrada del workspace (QR-7).
- **R-6. Blast radius de los símbolos modificados** (`PROJECT_DIR`, `spawnPrisma`, `runMigrateDeploy`): sus consumidores (`server-startup-config`, `chat-bot-boundaries`, `http-test-convention`, `tests/support/process.ts` y `db-migrations`) pasan dentro de F-5. Se confirma que `server-startup-config.test.ts` lee los scripts `start` y `dev` del `package.json` del workspace.

### Pruebas Docker e imágenes (CA-4 en local, RF-4)

- **D-1.** `docker build -f landing-pages/Dockerfile --target production` y `--target migrate` desde `restaurante/`, terminan con 0.
- **D-2.** Las comprobaciones de contenido de `ci.yml`, copiadas tal cual, sobre las dos imágenes. Además, para descartar el falso positivo (QR-4), se comprueba que las rutas positivas existen: `/app/node_modules/@prisma/adapter-mariadb` en `production` y el CLI de Prisma en `migrate`. Lo que no debe estar se busca en los dos niveles de `node_modules`, con `find / -name 'prisma' -path '*node_modules*'` y búsquedas de SQLite.
- **D-3.** Metadatos de las imágenes (`docker inspect`) comparados con los de las imágenes construidas desde la copia de `main`: `User`, `Env` (`HOST`, `PORT`, `NODE_ENV`), `ExposedPorts`, `Healthcheck`, `Volumes` y punto de montaje de `DATA_DIR`, `Cmd`, `Entrypoint` y `WorkingDir`. Solo puede cambiar `WorkingDir` (DT-1) y el `Entrypoint` de `migrate`, que pasa a `/app/node_modules/.bin/prisma migrate deploy`.
- **D-4.** La imagen `production` no contiene `README.md`, `deploy/`, `ops/`, `security/`, `docs/`, `.env`, `data/`, `tests/` ni TypeScript (QR-5). `/var/lib/restaurante` pertenece a `node` y tiene permisos 700.
- **D-5.** `migrate` sobre una base vacía ("All migrations have been successfully applied"). `production` queda `healthy` escuchando en `0.0.0.0`, responde 200 en `/molotes`, y `node scripts/hash-password.ts` y `node scripts/admin-recover.ts --help` (o su uso sin argumentos) responden dentro del contenedor.
- **D-6.** `docker compose run --rm test` desde `restaurante/` termina con 0, con el mismo recuento que el de `main` según el Implementation Result (1979 superadas, 1 *expected fail* y 1 omitida por root).
- **D-7.** `deploy/ci/smoke.sh`, `deploy/ci/resumen-test.sh` y `ops/backup/ci/smoke.sh` terminan con 0, y `shellcheck` (imagen `koalaman/shellcheck:stable`) pasa sobre `deploy/` y `ops/backup`. Para QR-6, `smoke.sh` se ejecuta también contra las imágenes `production` y `migrate` construidas desde la copia de `main`: tiene que pasar con las dos. `systemd-analyze` queda para el runner.

### Pruebas de CI, despliegue y configuración

- **C-1.** `git diff main -- .github/workflows/ci.yml`: los mismos jobs (`cambios`, `validado`, `calidad`, `auditoria`, `docker`, `despliegue`, `publish`, `vigente` y `deploy`), `needs`, `if`, scopes de caché, etiquetas y resúmenes. Solo cambian las rutas, `file:`, el `working-directory` del paso de divergencia y las comprobaciones de contenido. Se valida la sintaxis con `actionlint` en contenedor (`rhysd/actionlint`), si se puede usar sin instalar nada en el repositorio; si no, se deja como observación.
- **C-2. CA-5 simulado:** el bloque `case` de `cambios` se extrae del YAML a un script del scratchpad y se ejecuta con `restaurante/docs/x.md`, `.claude/x.md` y `README.md` (documentación, se omiten las validaciones) y con `restaurante/landing-pages/src/x.ts`, `restaurante/README.md`, `restaurante/package.json`, `restaurante/package-lock.json`, `restaurante/deploy/ci/smoke.sh` y `.github/workflows/ci.yml` (código).
- **C-3. CA-6:** `git diff main -- restaurante/deploy/compose.prod.yaml restaurante/deploy/deploy.sh restaurante/deploy/mysql/initdb/01-usuarios.sh` vacío, y la suma calculada con el mismo comando del workflow en la copia de `main` y en la rama: el mismo valor (`dd2dc90d…` según el Implementation Result).
- **C-4. CA-7:** las etiquetas de `publish` (`ghcr.io/orvigas/restaurante:sha-…` y `restaurante-migrate:sha-…`) sin cambios en el diff, y `compose.prod.yaml` sin servicios, routers ni etiquetas de Traefik nuevos. No se toca el DNS.
- **C-5. CA-11:** las tres entradas de `dependabot.yml` apuntan a directorios que existen con su manifiesto (`restaurante/package-lock.json`, `restaurante/landing-pages/Dockerfile` y `.github/workflows/`), y el diff solo cambia `directory` de `docker` y los comentarios.
- **C-6. `.dockerignore` y `compose.yaml`:** el diff es coherente con DT-2 (el contexto `design` sigue resolviendo `../_stich_source_`, y el servicio `test` usa `landing-pages/Dockerfile`).

### Pruebas de integración (WhatsApp)

- **W-1.** El `href`, `target` y `rel` del CTA de WhatsApp en `/molotes` y `/birria` son idénticos entre `main` y la rama (lo cubre R-1). Se extraen además con un selector para dejar evidencia explícita del dominio, el número y el `text` codificado. No se sigue el enlace.
- **W-2.** `/webhooks/whatsapp`: las mismas respuestas en las dos versiones (R-1). La suite del bot (`whatsapp-bot-*`) pasa en F-5.

### Pruebas responsive, de accesibilidad, UX/UI y SEO

El ticket no cambia nada visual. Si R-1 demuestra que el HTML y los assets son idénticos byte a byte (salvo el nonce), las conclusiones de responsive, accesibilidad, UX/UI frente a `_stich_source_/` y SEO (`title`, meta description, viewport, canonical y Open Graph) son las mismas que en `main`. Como comprobación de humo en el navegador (Claude in Chrome), sobre la rama:

- **B-1.** `/`, `/molotes` y `/birria` a 375×812 y 1440×900: la página carga con estilos, no hay errores en la consola ni peticiones 404, y no hay overflow horizontal (`document.documentElement.scrollWidth <= innerWidth`).
- **B-2.** `/molotes` (sábado o domingo real): se abre el aviso "Hoy toca birria" y se cierra con el botón para quedarse y con Escape. `/?dia=martes`: aviso "Molotes".
- **B-3.** El CTA de WhatsApp es visible sin desplazarse a 375×812 y se alcanza con el teclado.

Si la extensión no responde tras 2 o 3 intentos, B-1 a B-3 quedan como revisión manual pendiente, sin bloquear la aprobación: ningún CA depende solo de ellas, porque CA-8 y RF-3 se sustentan en R-1.

### Pruebas de performance

- **P-1.** Las mismas peticiones y los mismos tamaños de assets en las dos versiones (R-1). No se mide nada más: el ticket no cambia el comportamiento en ejecución.

### Documentación

- **DOC-1. CA-12:** `arquitectura.md` §9 registra la decisión A con la fecha 2026-10-24, la cita "tres contenedores", la opción elegida y la división entre los pasos 1, 3 y 4. El encabezado no cuenta A como pendiente, §4 recoge la raíz compartida y la nota sobre `tsconfig.base.json`, y §8 trae el detalle del paso 1.
- **DOC-2. CA-13 (parcial):** §10 contiene la toma en reposo fechada (2026-10-24 19:57) con la RAM total, el uso de `app`, MySQL y Traefik, la estimación con dos contenedores Node más y su porcentaje, calculado de nuevo aquí con las cifras del registro. También debe indicar que falta la toma con tráfico. Esta QA no accede al VPS.
- **DOC-3. CA-14:** se sigue paso a paso, en la copia limpia de F-1, la puesta en marcha del `README.md` de la raíz y de `docs/desarrollo.md` (`npm ci`, `npm run db:up`, el `.env` en `landing-pages/`, `npm run dev`, `npm test` y `docker compose run --rm test`). Cualquier comando o ruta del README que no funcione se registra.
- **DOC-4.** Todas las rutas `restaurante/...` citadas en `.claude/rules/*.md`, `.claude/agents/*.md`, `.claude/CLAUDE.md`, `README.md` y `docs/*.md` existen (extraídas con un script de grep y comprobadas con `test -e`). También se comprueba que la documentación no presenta `api/` ni `inventory-manager/` como existentes (RF-11) y que los cambios de `.claude/agents/*.md` y `.claude/rules/*.md` son solo de rutas y estructura (DT-6).

### Pruebas que se confirman fuera de esta QA

- **I-1. CA-4 en el PR:** `gh pr checks` con `cambios`, `calidad`, `auditoria`, `docker` y `despliegue` en verde, incluido `systemd-analyze` y los builds amd64 (los locales son arm64).
- **I-2. CA-5 en el PR:** el job `cambios` del PR lo marca como código.
- **I-3. CA-9 y CA-10, después del merge** (T4 y T5, con `senior-fullstack`).

### Pruebas automatizadas

- Existentes: toda la suite (`npm test`) y `docker compose run --rm test`.
- Nuevas: ninguna. El cambio es de estructura y la suite actual ya cubre el comportamiento. Las comparaciones de R-1, R-5, C-2 y D-3 son scripts temporales en el scratchpad, no pruebas del repositorio. No se escribe nada en `restaurante/landing-pages/tests/`.

### Evidencia requerida

- La salida (código de salida y resumen) de cada comando de F, N, D y C.
- Los ficheros de `diff` de R-1 (vacíos o con la lista de las diferencias normalizadas), R-3, R-5 y D-3, guardados en el scratchpad y resumidos en el QA Report.
- El recuento de pruebas de `main` y de la rama, calculado en esta QA.
- La suma de `deploy/` de las dos versiones.
- Capturas o texto de página de B-1 a B-3, o la nota de revisión manual pendiente.

### Limpieza

Al terminar se detienen los servidores y se borran los contenedores, las imágenes `qa/*` y las redes temporales que cree esta QA. No se usa `git stash` ni `git worktree`, no se modifican archivos del repositorio (salvo este ticket) y no se ejecuta `npm run lint:fix`.

### Criterios de aprobación

- `QA_APPROVED` si pasan con evidencia CA-1, CA-2, CA-3, CA-6, CA-7, CA-8, CA-11, CA-12 y CA-14; si R-1 no muestra ninguna diferencia funcional entre `main` y la rama; si las pruebas locales equivalentes a CA-4 (D-1 a D-7) y la simulación de CA-5 (C-2) pasan; y si no hay defectos `BLOCKER`, `CRITICAL` ni `MAJOR` sin decisión del usuario. El veredicto deja expresamente:
  - **CA-4 y CA-5:** "PASS local; pendiente de confirmación en el CI del PR" (los confirma `senior-fullstack` en T4 antes de pedir el merge).
  - **CA-9 y CA-10:** "fuera del alcance de la QA previa al merge; se verifican tras el merge".
  - **CA-13:** "PARCIAL. Toma en reposo verificada en el documento; la toma con tráfico la hará `senior-fullstack` el domingo 2026-10-25 entre las 08:00 y las 15:00 (America/Mexico_City), antes del merge, por decisión del usuario". No bloquea `QA_APPROVED`, pero el merge depende de esa toma y de que el registro final no supere el 80 % o, si lo supera, de que se revise A.
- `QA_REJECTED` si falla cualquiera de los CA locales, si R-1 muestra una diferencia observable, si una imagen pierde una propiedad de RF-4 o si cambia la suma de `deploy/`.
- `NEEDS_USER_DECISION` si aparece un defecto `MAJOR` o una ambigüedad, por ejemplo una diferencia de HTML que no sea funcional pero que no esté prevista.

### Aprobación del QA Action Plan

Aprobado por el usuario el 2026-10-24. Cita textual: "Si apruebo el plan pero quiero que todos los pull request vayan a una rama intermedia que contenga todos los cambios hasta que esté lo suficientemente madura para hacer un pr a main".

Decisiones asociadas, todas de la opción recomendada:

- Rama intermedia: `epic/arquitectura`, creada desde `main`.
- Solo los PR de la épica van a esa rama.
- El ajuste del CI se hace primero con un PR pequeño a `main`, que prepara `senior-fullstack` en otro worktree.

Consecuencias para esta QA:

- La regresión se sigue comparando contra `main`, que es lo que está en producción.
- El merge a `epic/arquitectura` no despliega, así que CA-9 y CA-10 se comprueban cuando la épica se mergee a `main`.
- El cambio de disparadores del CI queda fuera de esta QA.

## QA Report

### Ronda

1 (2026-10-24, sábado; fecha del negocio en America/Mexico_City). La rama `feature/REQ-F-036-monorepo-workspaces-landing-pages` está sin commits: se valida el árbol de trabajo del checkout principal.

### Pruebas ejecutadas

La copia de `main` se extrajo con `git archive main restaurante` en el scratchpad, sin `stash` ni `worktree`. La copia limpia contiene solo lo que devuelve `git ls-files -co --exclude-standard`. Node 24.22.1.

| Prueba | Comando o acción | Resultado |
| --- | --- | --- |
| F-1 | `npm ci --strict-allow-scripts --foreground-scripts` en la copia limpia | 0. Se ejecutan `prisma` (preinstall) y `@prisma/engines` (postinstall). `@parcel/watcher` y `fsevents` no se compilan |
| N-1 | La misma instalación sin `allowScripts` en el `package.json` de la raíz (copia temporal) | 1, `ESTRICTALLOWSCRIPTS` con 4 paquetes sin cubrir. Con la raíz restaurada: 0 |
| F-2, F-3 | `find … package-lock.json`; `ls` de la raíz y de `landing-pages/` | Un único `./package-lock.json`. La estructura coincide con CA-1 y CA-2 |
| F-4 | `npm run typecheck`, `npm run lint` y `npm run build:css` desde `restaurante/`, en el checkout y en la copia limpia | 0, 0 y 0. ESLint con `--max-warnings 0` |
| F-5 | `npm test` en la rama (checkout y copia limpia) y en la copia de `main`, con el reporter JSON | Las tres: 93 archivos y 1981 pruebas (1980 superadas y 1 *expected fail*), 411 suites |
| F-6 | Comparación por archivo y nombre completo de cada prueba (JSON de `main` frente al de la rama) y búsqueda de `.only`, `.skip` y `it.todo` | Ninguna falta, ninguna nueva y ninguna cambia de estado. 0 `.only`, `.skip` o `todo` en las dos versiones |
| F-7 | Scripts del `package.json` de `main` frente a los de la raíz y el workspace | Están todos los de RF-2. Los scripts, dependencias, `overrides`, `engines` y `type` del workspace son idénticos a los de `main`, y `allowScripts` de la raíz también |
| F-7 | `npm test -- tests/unit/business-schedule.test.ts` | Llega el filtro: 1 archivo, 55 pruebas |
| F-7 | `npm run bot:chat -- --ahora 2026-10-25T10:00` | Llega el argumento ("Simulador del bot con meta (2026-10-25T10:00:00-06:00 …)") |
| F-7 | `npm run audit:deps`, con `node_modules` y sin él (como el job `auditoria`) | 0 y 0, "sin bloqueos" |
| DOC-3 | Puesta en marcha del README en la copia limpia: `db:generate`, `cp landing-pages/.env.example landing-pages/.env`, `db:up`, `db:migrate`, `build:css` y `npm run dev` | Todo 0. `/`, `/molotes` y `/birria` responden 200 y `/admin` 303. Crea `landing-pages/data/` (birria y molotes), no `restaurante/data/` |
| R-1 | Dos servidores a la vez (`main` en el 3101 y la rama en el 3100), con el mismo `.env`, `DATA_DIR` y base, y `cmp-http.mjs`: 62 peticiones | **0 diferencias** en código, encabezados, cookies y cuerpo (ver Regresión) |
| R-2 | Los dos servidores con `BUSINESS_TIMEZONE=Pacific/Kiritimati` (domingo 17:50 allí; sábado 21:50 en CDMX) | `/`, `/molotes` y `/birria` idénticos. Las dos versiones muestran el aviso `weekend` en `/molotes` |
| R-3 | `diff -r` de `tests/` entre `main` y `landing-pages/tests/` | Solo 5 archivos, sin ninguna línea con `expect`, `it` o `test`: las rutas de `_stich_source_` y del README, y `spawnPrisma` (el CLI se resuelve con `createRequire`, se lanza con `process.execPath` y mantiene `cwd: PROJECT_DIR` y el mismo entorno) |
| R-4 | `diff -r` de `public/`, `prisma/`, `src/` y `scripts/` | `public/` y `prisma/` idénticos. `src/`: solo el comentario de `PROJECT_DIR`. `scripts/`: la raíz de `audit-deps.ts` y `SOURCE_DIR` de `generate-icons.py` |
| R-5 | `package-lock.json` de `main` frente al de la rama (versión, `resolved`, `integrity` y marcas `dev`, `optional`, `peer` y `devOptional`) | 510 y 510 paquetes, 0 diferencias. Solo se añaden `landing-pages` y `node_modules/landing-pages` |
| D-1 | `docker build` de `production` y `migrate`, en la rama (`-f landing-pages/Dockerfile`) y en `main` | Las 4 imágenes terminan con 0 |
| D-2 | Comprobaciones de contenido de `ci.yml`, copiadas tal cual | `production` 0 y `migrate` 0. Las rutas positivas existen: `/app/node_modules/@prisma/adapter-mariadb` y `/app/node_modules/prisma` |
| D-3 | `docker inspect` de la rama frente a `main` | Iguales `User=node`, `Cmd`, `ExposedPorts 3000`, `Healthcheck` (30 s, 5 s, 10 s, 3), `Env` (`HOST=0.0.0.0`, `PORT=3000`, `NODE_ENV=production`) y `Volumes`. Solo cambian `WorkingDir` (`/app/landing-pages`) y el `Entrypoint` de `migrate` (`/app/node_modules/.bin/prisma migrate deploy`), como prevé DT-1 |
| D-4 | Árbol de `/app` (sin `node_modules`) y `npm ls --omit=dev` de `production` en la rama frente a `main` | El mismo árbol, con `package.json` y `package-lock.json` de la raíz en `/app`. Los mismos 70 módulos, más el enlace `node_modules/landing-pages`. No hay README, `.env`, `data/`, `deploy/`, `ops/`, `security/`, `docs/`, `tests/` ni `typescript`. `/var/lib/restaurante` es de `node:node`, con permisos 700 |
| D-5 | `migrate` sobre la base vacía `restaurante_test_qa036`; `production` de la rama y de `main` en la red `db-test` | "All migrations have been successfully applied". El contenedor queda `healthy`, con `server_started` y `host 0.0.0.0`. Responden 200 `/`, `/molotes` y `/birria`. Las dos imágenes coinciden en cuerpo, encabezados y CSP (sin el nonce) en `/`, `/molotes`, `/birria`, `/admin` (503), `/admin/login`, `/no-existe` (404), `/webhooks/whatsapp` (503), el CSS y el JS. `node scripts/admin-recover.ts` (mensaje de uso), `node scripts/hash-password.ts` y `npm run` (lista `admin:*`) funcionan en `/app/landing-pages` |
| D-6 | `docker compose run --rm test` | 0: 93 archivos; 1979 superadas, 1 *expected fail* y 1 omitida por root |
| D-7 | `shellcheck` (koalaman/shellcheck:stable) de `deploy/` y `ops/backup` | 0 y 0 |
| D-7 | `bash deploy/ci/resumen-test.sh` | 0, "todas las comprobaciones pasaron" |
| D-7 / N-4 | `deploy/ci/smoke.sh` con las imágenes de la rama, en `docker:cli` con las mismas rutas del host | 0: 45 ok y 0 fallos, incluido "y lo registra (database_newer_than_code_allowed)" |
| D-7 / QR-6 | `deploy/ci/smoke.sh` de la rama con las imágenes de **`main`** | 0: 45 ok y 0 fallos, con la misma aserción D-1. La ruta relativa sirve para las dos distribuciones |
| D-7 | `ops/backup/ci/smoke.sh` con las imágenes de la rama | 0: 55 ok y 0 fallos |
| C-1 | `diff` de nombres de jobs, `name`, `needs` e `if` de `ci.yml` (`main` frente a la rama); `actionlint` de las dos versiones | Iguales. `actionlint`: 0 hallazgos en las dos |
| C-2 | El `case` de `cambios`, sin cambios en el diff, ejecutado con rutas de ejemplo | Documentación: `restaurante/docs/x.md`, `.claude/x.md` y `README.md`. Código: `restaurante/landing-pages/src/x.ts`, `restaurante/README.md`, `restaurante/package.json`, `restaurante/package-lock.json`, `restaurante/deploy/ci/smoke.sh`, `.github/workflows/ci.yml` y `restaurante/landing-pages/README.md` |
| C-3 | `git diff main` de los tres archivos de la suma; la suma con el comando del workflow (`sha256sum` de los tres archivos y luego de ese resultado) en `main` y en la rama | Diff vacío. La suma es `dd2dc90d7d71b07ce53d8ecd5ddecfa6a6b678b7de56b65b56170980d9c72b30` en las dos. En `deploy/` y `ops/` solo cambia `deploy/ci/smoke.sh` |
| C-4 | Etiquetas de `publish` en el diff | Sin cambios: `ghcr.io/orvigas/restaurante:sha-${{ github.sha }}` y `…/restaurante-migrate:sha-…`. `compose.prod.yaml` sin cambios |
| C-5 | `dependabot.yml` | `/restaurante` (con su lockfile), `/` y `/restaurante/landing-pages` (con su Dockerfile) existen. El diff solo cambia `directory` de `docker` y los comentarios |
| C-6 | Diff de `compose.yaml` y `.dockerignore` | `compose.yaml`: solo `dockerfile: landing-pages/Dockerfile` en `test`; el contexto `design` no cambia. `.dockerignore`: rutas de `landing-pages/`, y excluye además `deploy`, `security` y `docs` |
| W-1 | `href`, `target` y `rel` del CTA en la rama (también cubiertos por R-1) | `/molotes` (4 CTA): `https://wa.me/15556727947?text=Hola%2C%20quiero%20hacer%20un%20pedido%20de%20molotes`. `/birria` y `/` (5 CTA): `…pedido%20de%20birria`. Todos con `target="_blank"` y `rel="noopener noreferrer"` |
| DOC-1, DOC-2 | Revisión de `arquitectura.md` (encabezado, §4, §8, §9 y §10) | Ver CA-12 y CA-13. Cálculo: (1066 + 2 × 67,2) / 3915 = 30,66 %; el 80 % son 3132 MiB |
| DOC-4 | `test -e` sobre las 41 rutas `restaurante/…` citadas en `.claude/rules`, `.claude/agents`, `CLAUDE.md`, `README.md` y `docs/` | Todas existen. Las únicas que faltan son rutas del VPS (`/opt/restaurante/{.env,backups,state,offsite}`), que no son del repositorio. El diff de `.claude/rules` y `.claude/agents` solo cambia rutas y estructura (DT-6). `api/` e `inventory-manager/` solo aparecen en `arquitectura.md`, como plan |
| B-1 a B-3 | Claude in Chrome en la rama (puerto 3100) | `/molotes`: aviso `weekend` abierto ("¡Raza, hoy toca birria!"), se cierra con Escape y guarda `homeNotice:weekend:seen`. `/?dia=martes`: aviso `molotes` abierto. Un solo `h1`, ninguna imagen rota y sin errores en la consola en `/?dia=martes` ni en `/birria`. **El redimensionado no tuvo efecto**: la ventana siguió con `innerWidth` 2560, así que no se capturaron los viewports de 375, 768 y 1440 |

### Criterios de aceptación

| CA | Resultado | Evidencia |
| --- | --- | --- |
| CA-1 | PASS | F-1, F-2 y N-1 |
| CA-2 | PASS | F-3 |
| CA-3 | PASS | F-4, F-5 y F-6: 1981 pruebas = 1981 en `main`, calculado en esta QA |
| CA-4 | PASS local; **pendiente de confirmación en el CI del PR** | D-1 a D-7 en local (arm64). Faltan `systemd-analyze` y los builds amd64, que solo corren en el runner. El PR tendrá base `epic/arquitectura`: los checks dependen del PR aparte que ajusta los disparadores del CI. Los confirma `senior-fullstack` con `gh pr checks` |
| CA-5 | PASS simulado; **pendiente de confirmación en el CI del PR** | C-2 |
| CA-6 | PASS | C-3 |
| CA-7 | PASS | C-4 y D-3. No se añade ningún servicio, router ni registro DNS |
| CA-8 | PASS | R-1 (0 diferencias en 62 peticiones), R-3 y D-5 (las imágenes `production` dan las mismas respuestas) |
| CA-9, CA-10 | **Fuera del alcance de esta QA** | El merge a `epic/arquitectura` no despliega. Se verifican cuando la épica se mergee a `main` |
| CA-11 | PASS | C-5 |
| CA-12 | PASS | DOC-1. El encabezado dice "Decisión A tomada el 2026-10-24; quedan abiertas B y C". §9 trae la fecha, la cita "tres contenedores", la opción elegida y la tabla de los pasos 1, 3 y 4. §4 y §8 están actualizados |
| CA-13 | **PARCIAL** | DOC-2. La toma en reposo está registrada y fechada, y el cálculo cuadra (30,7 %, por debajo del 80 %). Falta la toma con tráfico, que hará `senior-fullstack` el domingo 2026-10-25 entre las 08:00 y las 15:00 (America/Mexico_City) por decisión del usuario. Esta QA no accedió al VPS |
| CA-14 | PASS | DOC-3, F-7, D-6 y DOC-4 |

### Defectos encontrados

Ninguno `BLOCKER`, `CRITICAL`, `MAJOR` ni `MINOR`.

#### DEF-001

- **Severidad:** `TRIVIAL` (solo documentación).
- **Criterio de aceptación afectado:** CA-13 (texto del registro), sin impacto funcional.
- **Descripción:** `arquitectura.md` §10 dice que la toma con tráfico "se registra aquí antes del paso 3", y el primer riesgo de §10 dice que el paso 1 "se valida con el despliegue de `main`". Las dos frases son anteriores a dos decisiones del usuario: tomar la medición el domingo antes del merge, y llevar los PR de la épica a `epic/arquitectura`, donde el despliegue llega con el merge de la épica a `main`.
- **Pasos para reproducir:** leer `restaurante/docs/arquitectura.md`, líneas 251-252 y 276-278.
- **Resultado esperado:** el texto refleja cuándo se hace la toma y cuándo se despliega el paso 1.
- **Resultado actual:** remite al paso 3 y al despliegue de `main`.
- **Evidencia:** las líneas citadas.
- **Impacto:** puede confundir sobre cuándo se cierra CA-13. No afecta a ningún comportamiento.
- **Recomendación:** ajustar la redacción al registrar la toma del domingo.

#### Observaciones (no son defectos)

- **OBS-1. Las pruebas de humo requieren herramientas de Linux.** En macOS, `deploy/ci/smoke.sh` falla porque usa `stat -c`, `find -printf` y `jq`. Se ejecutó en `docker:cli` con `bash`, `coreutils`, `findutils`, `jq` y otras herramientas GNU, `--network host` y las mismas rutas del host. Ya pasaba antes de este ticket, no es una regresión.
- **OBS-2. Scripts internos.** `build:css:*` y `watch:css:*` no están en la raíz. RF-2 no los pide, `build:css` y `watch:css` los invocan, y se pueden usar con `-w landing-pages`.
- **OBS-3. Diferencias normalizadas en R-1:**
  - en `development`, el campo `stack` de los errores JSON, que lleva la ruta absoluta de cada copia;
  - `Last-Modified` y `Content-Length` de los assets, por la fecha del archivo. El contenido es el mismo y el hash coincide.

  En `production` (D-5) no hay `stack` y las respuestas coinciden.
- **OBS-4. Worktree ajeno.** Hay un `.claude/worktrees/` sin versionar en el checkout. Es de otro agente; esta QA no lo creó ni lo tocó.

### Regresión

- **HTTP en desarrollo:** `/`, `/molotes` y `/birria` sin `?dia=` y con `?dia=` para los siete días, `/birria?dia=lunes|martes`, `/admin` (303), `/admin/login`, `HEAD /`, 404, `/webhooks/whatsapp` (GET 403 y POST sin firma 401), los 32 assets y los dos `webmanifest`. Las 62 peticiones coinciden con `main` (`http-diff2.txt`).
- **Avisos por día:** `/` muestra "Descanso" el lunes, "Molotes" de martes a viernes y nada el fin de semana. `/molotes` muestra "Descanso" el lunes, nada de martes a viernes y "Hoy toca birria" el fin de semana. `/birria` nunca muestra aviso. Las dos versiones coinciden byte a byte.
- **Fecha del negocio:** la zona del negocio distinta de la del servidor (R-2) da lo mismo en las dos versiones. Las transiciones de viernes a sábado y de domingo a lunes las cubre la suite, que no cambia.
- **Logs:** los mismos tipos y números de mensajes en las dos versiones (`server_started`, `request`, `request_error`, `bot_webhook_*`, `admin_bootstrap_ignored`), con los mismos campos.
- **Suite completa:** sin cambios (F-5 y F-6).

### Responsive

`public/` (CSS compilado incluido) y el HTML son idénticos a `main` (R-1 y R-4), así que el comportamiento responsive no puede haber cambiado. La captura en 375×812, 768×1024 y 1440×900 no se pudo hacer, porque la ventana del navegador no aceptó el redimensionado. Queda como revisión manual opcional; ningún CA depende de ella.

### Accesibilidad

El HTML es idéntico a `main`. En el navegador: un solo `h1`, y el aviso se cierra con Escape (`dialog` nativo).

### UX/UI

Sin cambios visuales: el HTML y los assets son idénticos byte a byte (salvo el nonce).

### Performance

Las mismas peticiones y los mismos tamaños de assets que en `main`, y sin errores en la consola. El contenido de la imagen `production` es el mismo (D-4).

### SEO

`title`, `description`, `viewport`, `canonical` y `og:*` de cada landing coinciden con `main` (R-1). Molotes: "Moloteando | Auténticos Molotes Artesanales", con canonical `/molotes`. Birria y `/`: "Birria El Muñeco | …", con canonical `/birria`.

### Pendientes de revisión manual

- Capturas responsive en 375, 768 y 1440 (opcional; el HTML y el CSS son idénticos a `main`).
- CA-4 y CA-5 en el CI del PR (base `epic/arquitectura`, después del PR que ajusta los disparadores).
- CA-13: la toma con tráfico del domingo 2026-10-25 (`senior-fullstack`).
- CA-9 y CA-10: cuando `epic/arquitectura` se mergee a `main`.

### Limpieza

- Detenidos los servidores de los puertos 3100 a 3103 y 3110, incluido el `node --watch` de la copia limpia.
- Borrados los contenedores `qa036-*`, la base `restaurante_test_qa036`, las imágenes `qa/*` y `smoke/*` y las copias del scratchpad.
- Las redes de Docker son las mismas que al empezar.
- No se modificó ningún archivo del repositorio salvo este ticket. No se usó `git stash` ni `git worktree`.
- Quedan en la caché local las imágenes base descargadas para las pruebas (`docker:cli`, `koalaman/shellcheck` y `rhysd/actionlint`).

### Resultado final

QA_APPROVED, con estas condiciones antes de llevar la épica a `main`:

- CA-4 y CA-5 confirmados en el CI del PR;
- CA-13 completado con la toma del domingo y por debajo del 80 %, o con la decisión A revisada si lo supera;
- CA-9 y CA-10 verificados tras el merge de `epic/arquitectura` a `main`.

## Historial de cambios

### Versión 1

Descripción inicial, aprobada el 2026-10-24. Decisiones del usuario: A = "tres contenedores"; lo compartido en la raíz, con el README como guía del monorepo; mantener los nombres de imágenes, servicio y routers; no tocar los archivos de la suma de `deploy/`; medir la memoria con umbral del 80 %.

Aclaración aprobada junto con la versión ("Lo apruebo, y que sea el senior full stack"): la medición de memoria del VPS la hace `senior-fullstack` por SSH durante la implementación.

### Revisión técnica (2026-10-24)

`senior-fullstack` agrega el Technical Action Plan. Incluye las decisiones técnicas DT-1 a DT-6, entre ellas la distribución de la imagen en forma de workspace con `WORKDIR /app/landing-pages`, el contexto de build en `restaurante/` y la propuesta de actualizar las rutas de `.claude/agents/`. Estado: `NEEDS_TECHNICAL_PLAN_APPROVAL`.

### Inicio de implementación (2026-10-24)

El plan técnico está aprobado (DT-5 y DT-6, sí). Se crea la rama `feature/REQ-F-036-monorepo-workspaces-landing-pages` y el ticket pasa a `in-progress/`. Estado: `IN_PROGRESS`.

### Implementación (2026-10-24)

`senior-fullstack` implementa el plan aprobado: workspaces, traslado a `landing-pages/`, Docker, CI, Dependabot, `deploy/ci/smoke.sh` (ruta relativa de la migración de la prueba D-1), documentación, registro de la decisión A y toma de memoria en reposo. La toma con tráfico queda pendiente. Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

### QA Action Plan (2026-10-24)

El usuario aprueba la implementación ("Aprobar, pasar a QA"). `senior-qa` agrega el QA Action Plan (Q1): la regresión compara el HTML de `main` y de la rama con `?dia=` para los siete días, la extracción de `main` se hace con `git archive` (sin `stash` ni `worktree`), Docker y las pruebas de humo se prueban en local y se fija cómo quedan en el veredicto CA-4 y CA-5 (CI del PR), CA-9 y CA-10 (después del merge) y CA-13 (toma con tráfico del domingo 2026-10-25, a cargo de `senior-fullstack`). Estado: `NEEDS_QA_PLAN_APPROVAL`.

### QA, ronda 1 (2026-10-24)

El usuario aprueba el QA Action Plan, con PR a `epic/arquitectura`. `senior-qa` ejecuta el plan:

- Sin diferencias entre `main` y la rama: 62 respuestas HTTP en desarrollo, la imagen `production`, el lockfile, `public/`, `prisma/` y las pruebas.
- Pasan en local la suite (1981 pruebas), `typecheck`, `lint`, Docker, `smoke.sh` (con las imágenes de la rama y con las de `main`), la prueba de respaldos y `shellcheck`.
- La suma de `deploy/` no cambia.
- Un defecto `TRIVIAL` de documentación (DEF-001).

Quedan pendientes CA-4 y CA-5 (CI del PR), CA-13 (toma del domingo) y CA-9 y CA-10 (merge de la épica a `main`). Estado: `QA_APPROVED`.
