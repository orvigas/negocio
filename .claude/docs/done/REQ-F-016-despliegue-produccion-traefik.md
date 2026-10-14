# REQ-F-016 — Despliegue de producción con Traefik y pipeline de GitHub Actions

## Estado

DONE

## Aprobación

Aprobado por el usuario (versión 1, fecha 2026-10-14).

## Objetivo

Que cada merge a `main` que pase el CI se despliegue automáticamente en el VPS de Hostinger (Ubuntu 24.04, Docker y Traefik preinstalados) y se sirva por HTTPS en `birriaelmuneco.com` a través del Traefik existente, sin dejar la app caída si el despliegue falla.

Consolida los tickets del roadmap REQ-F-016 (imagen y compose de producción endurecidos), REQ-F-017 (proxy con TLS, ahora Traefik en lugar de nginx con certbot) y REQ-F-021 (publicación en GHCR y despliegue, ahora pipeline automático en lugar de `deploy.sh` manual). Los números 017 y 021 quedan absorbidos y no se reutilizan.

## Alcance

- Compose de producción con los servicios `app`, `mysql` y `migrate`.
- Borde HTTPS con el Traefik existente (red externa `traefik-public`).
- Publicación de las imágenes `production` y `migrate` en GHCR.
- Workflow de despliegue en el environment `production` de GitHub.
- Volcado local de la base antes de migrar y rollback automático de la app.
- Lista de GitHub Secrets y comandos `gh secret set`.
- Plantilla del `.env` del VPS.
- Actualización de `docs/despliegue.md` en lo que toca este ticket.

## Fuera de alcance

- Respaldos cifrados fuera del VPS y restauración probada (REQ-F-019).
- Alertas y monitorización (REQ-F-022).
- Endurecimiento del webhook (REQ-F-018).
- Guía final y checklist de salida (REQ-F-023).
- Tareas de infraestructura del usuario: firewall, creación del usuario `deploy`, DNS, `.env` real con sus valores y creación de los secrets.

## Requisitos

### RF-1 Compose de producción

- MySQL 8.4 en una red interna, sin puertos publicados, con sus datos en un volumen persistente.
- La app se une a la red interna y a `traefik-public`. No publica puertos en el host.
- Imágenes referenciadas por digest. Una sola réplica.
- Tres usuarios de base: app (solo DML), migrator (DDL) y backup (solo lectura).
- Base creada en utf8mb4 con colación `utf8mb4_es_0900_as_cs`.
- Se fijan `NODE_ENV=production`, `HOST=0.0.0.0` y `TRUST_PROXY` activado.

### RF-2 Traefik

- Router HTTPS para `birriaelmuneco.com`.
- `www.birriaelmuneco.com` responde 301 hacia `https://birriaelmuneco.com`, conservando ruta y query.
- HTTP responde 301 hacia HTTPS. La redirección se declara en el router del proyecto, así que funciona aunque Traefik no tenga una global.
- Límite de peticiones en `/admin`: 10 por minuto por IP, con ráfaga de 20. Sin restricción por IP de origen.
- Sin HSTS en Traefik (helmet ya lo envía).
- Routers y middlewares con prefijo propio del proyecto, para no chocar con otros sitios servidos por el mismo Traefik.
- Certresolver y entrypoints configurables en el `.env` del VPS. Valores por defecto: `letsencrypt`, `web` y `websecure`.

### RF-3 Publicación

- Las imágenes `production` y `migrate` se publican en GHCR privado (`ghcr.io/orvigas/...`), identificadas por digest y etiquetadas con el SHA del commit.
- Los PR no publican nada.
- El VPS descarga las imágenes con un token de GHCR de solo lectura, configurado una vez en el VPS.

### RF-4 Disparador

- Solo un push a `main` con el CI en verde despliega, siempre en el environment `production`.
- No se ejecutan dos despliegues a la vez.
- La ventana de mantenimiento de 04:00 a 05:00 no aplica a los despliegues.

### RF-5 Secuencia de despliegue

1. Conexión SSH como el usuario `deploy` (dedicado, sin sudo, en el grupo docker) a `/opt/restaurante`.
2. Descarga de las imágenes nuevas.
3. Volcado local de la base con `mysqldump` en utf8mb4. Se conservan los últimos 7 volcados y se borran los más antiguos.
4. Migración con el contenedor `migrate`.
5. Cambio de la app al digest nuevo.
6. Comprobación de salud.
7. Registro del digest desplegado.

### RF-6 Fallos

- Si fallan el volcado o la migración, no se toca la app en marcha y el workflow termina en error.
- Si falla la comprobación de salud, la app vuelve automáticamente al digest anterior y el workflow termina en error.
- El rollback automático revierte solo la app. La base no se restaura automáticamente: se restaura a mano desde el volcado, con el procedimiento documentado.

### RF-7 Secretos

- Los secretos de la app (contraseñas de MySQL, tokens de WhatsApp y Meta, `ADMIN_PASSWORD_HASH`, etc.) viven solo en `/opt/restaurante/.env`, con permisos 600.
- GitHub guarda solo los secretos de despliegue, en el environment `production`: `VPS_HOST`, `VPS_SSH_PORT` (22 por defecto), `VPS_SSH_USER`, `VPS_SSH_PRIVATE_KEY` y `VPS_SSH_KNOWN_HOSTS`.
- La publicación en GHCR usa el `GITHUB_TOKEN` del workflow.
- El ticket entrega la lista y los comandos `gh secret set --env production`. El usuario los ejecuta.
- Se documentan las reglas de protección recomendadas para el environment `production`: solo la rama `main` y, opcionalmente, revisores requeridos.

## Reglas de negocio

- RN-1: solo `main` con el CI en verde llega a producción.
- RN-2: un despliegue fallido nunca deja el sitio sin servicio si existía una versión anterior funcionando.
- RN-3: ningún secreto de la app sale del VPS ni se guarda en el repositorio.
- RN-4: todo el tráfico público va por HTTPS en el dominio raíz.

## Supuestos que se verifican en el primer despliegue

- Que el certresolver se llame `letsencrypt` y los entrypoints `web` y `websecure`.
- Que el puerto SSH sea el 22.
- Que no haya conflicto de nombres con otros sitios servidos por el mismo Traefik.
- Que el DNS de la raíz y de `www` apunte al VPS.

## Criterios de aceptación

- **CA-1:** `https://birriaelmuneco.com` responde 200 con un certificado válido y muestra la landing del día según `America/Mexico_City`.
- **CA-2:** conservando ruta y query en todos los casos:
  - `http://birriaelmuneco.com` y `http://www.birriaelmuneco.com` responden 301 hacia `https://` del mismo host (redirección global del entrypoint `web` del Traefik del VPS; verificado en el primer despliegue);
  - `https://www.birriaelmuneco.com` responde 301 hacia `https://birriaelmuneco.com`;
  - ajustado el 2026-10-14 con la decisión del usuario "Aceptar 308 + 301 (Recomendado)" y corregido a 301 tras el primer despliegue, porque el Traefik del VPS redirige con 301.

  La prueba de humo, sin redirección global, sigue comprobando el 301 del router del proyecto en las tres variantes.
- **CA-3:** desde fuera del VPS no responden ni el puerto 3000 ni el 3306. El compose no publica puertos.
- **CA-4:** más de 10 peticiones por minuto desde una IP a `/admin`, una vez agotada la ráfaga de 20, reciben 429. Las landings no se ven afectadas.
- **CA-5:** la app registra la IP real del cliente y el esquema `https`, comprobable en el log de una petición.
- **CA-6:** un merge a `main` con el CI en verde publica las imágenes y despliega sin pasos manuales. Un PR no publica ni despliega. Un CI en rojo no despliega.
- **CA-7:** cada despliegue deja un volcado nuevo en el VPS antes de migrar y nunca quedan más de 7. Con una migración que falla, la versión anterior sigue sirviendo y el workflow termina en error.
- **CA-8:** con una imagen que no pasa la comprobación de salud, se restaura el digest anterior de la app, el sitio sigue respondiendo 200 y el workflow termina en error.
- **CA-9:** dos merges seguidos no producen despliegues simultáneos.
- **CA-10:** el repositorio no contiene secretos y los logs del workflow no los muestran. `.env` tiene permisos 600. El usuario `deploy` no tiene sudo.
- **CA-11:** cambiar el certresolver, los entrypoints o el puerto SSH solo requiere tocar el `.env` o los secrets, no el código ni el compose.
- **CA-12:** `docs/despliegue.md` describe:
  - la preparación del VPS;
  - los secrets con sus comandos;
  - las reglas de protección del environment `production`;
  - el `.env`;
  - la restauración manual desde un volcado.

## Casos límite

- Primer despliegue sin digest anterior: si falla la comprobación de salud no hay a qué volver. Se informa del fallo y no se hace rollback.
- Disco lleno por acumulación de volcados (mitigado con la retención de 7).
- Migración no reversible seguida de un rollback de la app: el código anterior queda contra el esquema nuevo. Las migraciones deben ser compatibles hacia atrás, o se restaura a mano.
- DDL de MySQL aplicado a medias, porque no es transaccional.
- Token de GHCR caducado en el VPS: falla la descarga de las imágenes y no se toca la app.
- Llave SSH revocada o huella del host cambiada: el despliegue falla sin conectarse.

## Dependencias

- Técnicas: REQ-F-014 y REQ-F-015, ambos mergeados.
- Del usuario:
  - usuario `deploy` creado en el grupo docker;
  - `/opt/restaurante` con su `.env`;
  - `docker login ghcr.io` hecho una vez con el token de solo lectura;
  - DNS apuntando al VPS;
  - firewall con solo los puertos 80, 443 y SSH abiertos;
  - secrets creados en el environment `production`.
- REQ-F-019 no bloquea este ticket.

## Riesgos

- **Grupo docker equivale a root:** quien robe la llave SSH de `deploy` controla el VPS. Mitigación:
  - environment `production` protegido (solo la rama `main` y, opcionalmente, revisores requeridos);
  - llave dedicada a este uso;
  - `known_hosts` fijado.
- **Llave SSH en GitHub:** revoca la decisión del 2026-10-09 ("sin llave del VPS en GitHub") y se acepta de forma explícita.
- **Rollback solo de la app:** no revierte la base.
- **Volcados solo en el VPS:** hasta que exista REQ-F-019 no protegen ante la pérdida del VPS.

## Action Plan

1. Compose de producción y plantilla del `.env` con las variables de Traefik (RF-1, RF-2).
2. Labels y middlewares de Traefik con prefijo del proyecto: redirects y límite de peticiones en `/admin` (RF-2).
3. Publicación en GHCR desde el CI, solo en `main` (RF-3).
4. Job de despliegue que depende del CI, con concurrencia controlada y environment `production` (RF-4).
5. Secuencia de despliegue: volcado con retención de 7, migración, cambio de digest, comprobación de salud y rollback de la app (RF-5, RF-6).
6. Lista de secrets, comandos `gh secret set` y reglas de protección del environment; documentación en `docs/despliegue.md` (RF-7, CA-12).
7. Primer despliegue real con verificación de los supuestos y de CA-1 a CA-11.

**Resultado esperado:** producción en HTTPS que se actualiza sola con cada merge a `main` y protegida ante migraciones o arranques fallidos.

## Trazabilidad

| Objetivo | Requisito | Criterios de aceptación | Paso del Action Plan |
|----------|-----------|-------------------------|----------------------|
| Servir en producción | RF-1 | CA-3, CA-5 | 1 |
| HTTPS en el dominio raíz | RF-2 | CA-1, CA-2, CA-4, CA-11 | 2 |
| Imágenes verificables | RF-3 | CA-6 | 3 |
| Despliegue automático | RF-4, RF-5 | CA-6, CA-7, CA-9 | 4, 5 |
| Despliegue seguro ante fallos | RF-6 | CA-7, CA-8 | 5 |
| Secretos protegidos | RF-7 | CA-10, CA-11, CA-12 | 6 |

No hay UI afectada: `_stich_source_/` no aplica.

## Revisión técnica

Revisión de senior-fullstack (T1, 2026-10-14). Hay decisiones bloqueantes (D-1 a D-3) y otras menores (D-4 a D-6). Abajo, la propuesta de plan, que se convertirá en el Technical Action Plan cuando se resuelvan.

### Hallazgos que requieren decisión

- **D-1 (bloqueante): el rollback "solo de la app" no funciona si el despliegue aplicó migraciones.** `checkMigrations` (`src/db/verify.ts:211-214`) hace que la app no arranque si la base tiene una migración que su código no conoce (`DATABASE_NEWER_THAN_CODE`). Tras migrar, el digest anterior nunca pasará la comprobación de salud: el sitio queda caído. Contradice RN-2, RF-6 y CA-8 en ese caso. El caso límite "las migraciones deben ser compatibles hacia atrás" no basta: la verificación rechaza el arranque aunque lo sean. Opciones:
  - **A (recomendada):** variable `DATABASE_ALLOW_NEWER_SCHEMA=true` que solo pone el script de rollback en el contenedor restaurado. Con ella, `verifyDatabase` acepta migraciones aplicadas desconocidas (todas las conocidas aplicadas y con checksum correcto) y registra `database_newer_than_code_allowed` (warn). Cambio pequeño en `env.ts` y `verify.ts`, con pruebas. Exige migraciones compatibles hacia atrás (expand/contract), que se documenta.
  - B: si hubo migraciones y falla la salud, restaurar el volcado de forma automática y volver al digest anterior. Revoca la decisión de RF-6 y pierde lo escrito entre el volcado y la restauración.
  - C: aceptar que, con migraciones, el fallo deja el sitio caído hasta la restauración manual. Contradice RN-2.
- **D-2 (bloqueante): environments en un repositorio privado con el plan Free.** El repositorio es privado y la API responde "Upgrade to GitHub Pro" a la protección de ramas. Según la documentación de GitHub, las reglas de protección de los environments (ramas permitidas, revisores) en repositorios privados exigen GitHub Pro, Team o Enterprise. Sin ellas, cualquier workflow de cualquier rama que declare `environment: production` recibe la llave SSH. Hoy solo el usuario hace push, pero RF-7 y la mitigación del riesgo "grupo docker equivale a root" dependen de esa protección. Opciones:
  - **A (recomendada):** usar el environment `production` igual (sin reglas si el plan no las permite) y limitar la llave en el VPS con un comando forzado (D-3 A). Así, una llave robada solo puede desplegar digests de `ghcr.io/orvigas`, no ejecutar comandos.
  - B: pasar a GitHub Pro (protección de ramas y de environments).
  - C: aceptar el riesgo sin más mitigación.
- **D-3 (bloqueante): cómo llegan el script y el compose al VPS.**
  - **A (recomendada):** llave con `restrict,command="/opt/restaurante/deploy/deploy.sh"` en `authorized_keys`. El script valida sus argumentos (SHA y digests con expresión regular). `deploy/` lo instala el usuario una vez (dueño root, solo lectura para `deploy`) y lo reinstala cuando cambia. El workflow envía la suma SHA-256 de `deploy/` y el script se niega a desplegar si no coincide ("reinstala deploy/ del commit X"). Cambiar `deploy/` exige un paso manual, que es raro.
  - B: sin comando forzado, el workflow envía `deploy/` por SSH (`tar` por stdin) a `/opt/restaurante/releases/<sha>/` y lo ejecuta. Totalmente automático, pero la llave equivale a root en el VPS.
- **D-4: CA-5 exige cambiar código.** `src/middleware/request-logger.ts` no registra la IP ni el esquema. Propuesta: añadir `ip` (`ctx.ip`, que con `app.proxy` y `maxIpsCount = 1` es la que añade Traefik) y `protocol` a la línea `request`. La IP es un dato personal: se limita la retención con la rotación de logs de Docker (`json-file`, 10 MB x 5). **Recomendada:** IP completa en todas las peticiones. Alternativa: solo `protocol`, y la IP solo en `/admin`.
- **D-5: dónde corre la prueba de humo del compose de producción.** **Recomendada:** un job nuevo `despliegue` en `ci.yml`, también en los PR, del que dependa la publicación. Exige añadir `despliegue` a las comprobaciones que T4 espera en verde (`.claude/agents/senior-fullstack.md`, `CLAUDE.md` no cambia). Alternativa: dentro del job `docker` (sin tocar el proceso, pero el job dura más y tiene un timeout de 20 min).
- **D-6: `.env` del VPS en uno o dos archivos.** Si la app recibe el `.env` entero (`env_file`), recibe también la contraseña root de MySQL. **Recomendada:** un solo `.env` (600, como dice RF-7) y la app con una lista `environment:` explícita en el compose. Cada variable nueva de la app exige tocar el compose (con D-3 A, reinstalar `deploy/`). Alternativa: `.env` (infraestructura) y `app.env` (app, con `env_file`), los dos con 600. La contraseña de la app quedaría repetida en los dos.

### Otros hallazgos (sin decisión; el plan los resuelve)

- **Corte breve en cada despliegue:** una sola réplica (sesiones y conversaciones en memoria) y Traefik solo enruta a contenedores `healthy`: unos 10 a 30 s sin servicio en cada cambio de digest. RN-2 se refiere a los fallos. Se documenta.
- **Orden de los despliegues:** si el CI de un commit anterior termina después del de uno nuevo, desplegaría una versión vieja. El job de despliegue comprueba que su SHA sigue siendo la cabeza de `main` y, si no, termina sin desplegar.
- **`HEALTHCHECK` de la imagen:** `interval=30s` retrasa el estado `healthy` unos 30 s. El compose lo sobrescribe (`start_period: 90s`, `start_interval: 2s`, que exige Docker Engine 25 o superior; se verifica en el VPS) para cubrir la ventana de 60 s de conexión a la base.
- **Límite en `/admin`:** `/admin` se renderiza en el servidor y cada guardado son 2 peticiones (POST y 303). Agotada la ráfaga, un editor puede guardar unas 5 veces por minuto. Riesgo de 429 en sesiones intensas: se documenta, sin cambiar el valor aprobado.
- **Redirección permanente de Traefik:** responde 301 a GET y HEAD (CA-2 se comprueba con GET) y, según la versión, 308 a los demás métodos.
- **`innodb_lock_wait_timeout`:** `src/db/client.ts` deja para este ticket bajarlo en el servidor. Propuesta: `--innodb-lock-wait-timeout=10`.
- **`SITE_URL=https://birriaelmuneco.com`** se fija en el `.env` (URL canónica y Open Graph absolutas).
- **Token de GHCR:** los PAT de grano fino no sirven para el registro de contenedores; hace falta un PAT clásico con solo `read:packages`, que lee todos los paquetes del usuario, con fecha de caducidad. Se documenta su renovación (caso límite del ticket).
- **Documentación desactualizada:** `docs/despliegue.md` describe Node directo con nginx. Se reescriben las secciones 1, 4 a 7, 10 a 12 y Pendientes. También se actualizan los comentarios que citan nginx: `.env.example` (`TRUST_PROXY`), `src/app.ts:77-80` y `src/middleware/admin-guard.ts:79`, y las cabeceras de `compose.yaml` y `docker/mysql/initdb/01-usuarios.sh`.

### Propuesta de plan (pendiente de D-1 a D-6)

**Archivos nuevos** (`restaurante/deploy/`):

- `compose.prod.yaml`
- `deploy.sh`
- `mysql/initdb/01-usuarios.sh`
- `env.production.example`
- `ci/smoke.sh` y `ci/traefik.yml` (solo prueba de humo)

**Archivos modificados:**

- `.github/workflows/ci.yml`
- `docs/despliegue.md`
- `README.md` (sección Docker)
- `.env.example`
- comentarios de `compose.yaml`, `docker/mysql/initdb/01-usuarios.sh`, `src/app.ts` y `src/middleware/admin-guard.ts`
- con D-4: `src/middleware/request-logger.ts` y sus pruebas
- con D-1 A: `src/config/env.ts`, `src/db/verify.ts`, `src/server.ts` y sus pruebas

**Compose** (proyecto fijo `-p restaurante`, independiente del directorio):

- `mysql`:
  - imagen `mysql:8.4@sha256:…` (el digest de `compose.yaml`);
  - utf8mb4 y `utf8mb4_es_0900_as_cs`;
  - `--skip-log-bin`, `--mysqlx=OFF` e `--innodb-lock-wait-timeout=10`;
  - volumen `mysql-data` e initdb de solo lectura;
  - red `db` con `internal: true`, sin `ports`, healthcheck y rotación de logs.
- `app`:
  - imagen `${RESTAURANTE_APP_IMAGE:?}`;
  - redes `db` y `traefik-public` (externa);
  - fijadas en el compose: `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=3000`, `TRUST_PROXY=true`, `DATA_DIR=/var/lib/restaurante` y `DATABASE_URL` construida con la contraseña de la app;
  - volumen `app-data`;
  - endurecimiento: `read_only`, `tmpfs /tmp`, `cap_drop: ALL` y `no-new-privileges`;
  - `restart: unless-stopped`, `stop_grace_period: 15s` y healthcheck sobrescrito;
  - sin `ports` ni réplicas.
- `migrate`:
  - imagen `${RESTAURANTE_MIGRATE_IMAGE:?}`, `profiles: [migrate]` y red `db`;
  - `MIGRATION_DATABASE_URL` con el usuario migrator.
- Las contraseñas de MySQL se generan con `openssl rand -hex 32`, así que no hace falta codificarlas en la URL.

**Usuarios de MySQL** (`deploy/mysql/initdb/01-usuarios.sh`; corre solo con el volumen vacío):

- base `restaurante` en utf8mb4 con `utf8mb4_es_0900_as_cs`;
- `restaurante_app`: `SELECT, INSERT, UPDATE, DELETE`;
- `restaurante_migrator`: lo anterior más `CREATE, ALTER, DROP, INDEX, REFERENCES` (sin base sombra);
- `restaurante_backup`: `SELECT, SHOW VIEW, TRIGGER, LOCK TABLES`, con `mysqldump --no-tablespaces`;
- todos sobre `restaurante.*`.

**Labels de Traefik** (prefijo `restaurante`; los `$` van escapados como `$$`):

- Generales:
  - `traefik.enable=true`;
  - `traefik.docker.network=traefik-public`, imprescindible porque la app está en dos redes;
  - servicio `restaurante` en el puerto 3000.
- Router `restaurante`:
  - regla ``Host(`${RESTAURANTE_DOMAIN}`)``;
  - entrypoint `${TRAEFIK_ENTRYPOINT_HTTPS:-websecure}`;
  - `tls.certresolver=${TRAEFIK_CERTRESOLVER:-letsencrypt}`.
- Router `restaurante-admin`:
  - mismo host, con ``Path(`/admin`) || PathPrefix(`/admin/`)``;
  - `priority=100`;
  - middleware `restaurante-admin-ratelimit`: `average=10`, `period=1m`, `burst=20`. Cuenta por la IP remota, que fija Traefik (no confía en el `X-Forwarded-For` entrante).
- Router `restaurante-www`:
  - host `www.` en el entrypoint HTTPS, con certificado propio;
  - middleware `restaurante-canonical`.
- Router `restaurante-http`:
  - los dos hosts en `${TRAEFIK_ENTRYPOINT_HTTP:-web}`;
  - middleware `restaurante-canonical`.
- Middleware `restaurante-canonical` (`redirectregex`):
  - regex `^https?://(?:www\.)?<dominio>(.*)$`;
  - destino `https://<dominio>${1}`;
  - `permanent=true`.
- Sin HSTS. Sintaxis compatible con Traefik v2 y v3. El reto HTTP de ACME lo atiende Traefik antes que los routers.

**Script `deploy.sh`** (POSIX sh, `set -eu`, sin `set -x`):

- Argumentos: `<sha> <digest app> <digest migrate> <suma de deploy/>`.
- Precondiciones:
  - `flock`;
  - `.env` con permisos 600;
  - digests de `${RESTAURANTE_REGISTRY:-ghcr.io/orvigas}`.
- Secuencia:
  1. pull;
  2. `up -d --wait mysql`, idempotente;
  3. volcado con `MYSQL_PWD` dentro del contenedor (sin contraseña en argv): `mysqldump --single-transaction --default-character-set=utf8mb4 | gzip` en `backups/` con `umask 077`, comprobado con `gzip -t` y la marca "Dump completed", y retención de 7;
  4. `run --rm migrate`;
  5. guarda el `release.env` anterior y escribe el nuevo;
  6. `up -d --no-deps app`;
  7. espera `healthy` (180 s) y hace `curl` a través de Traefik (`--resolve <dominio>:443:127.0.0.1`, `-k` en el primer despliegue, mientras se emite el certificado);
  8. añade una línea a `releases.log`.
- Fallos:
  - en los pasos 1 a 4: sale con error sin tocar la app;
  - en el paso 7: restaura el `release.env` anterior (con D-1 A, más `DATABASE_ALLOW_NEWER_SCHEMA`), espera `healthy` y sale con error;
  - sin versión anterior: sale con error e informa.

**Workflow** (en `ci.yml`; los permisos globales siguen en `contents: read`):

- `despliegue` (con D-5 A): prueba de humo, también en los PR.
- `publish`:
  - `needs: [calidad, docker, despliegue]`;
  - `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`;
  - `permissions: {contents: read, packages: write}`;
  - `docker/login-action` fijada por SHA, con `GITHUB_TOKEN`;
  - build-push de `production` y `migrate` con la caché `gha`, `provenance: false`, etiquetas `sha-<sha>` y la etiqueta `org.opencontainers.image.source`;
  - sus salidas son los digests.
- `deploy`:
  - `needs: publish`;
  - `environment: {name: production, url: https://birriaelmuneco.com}`;
  - `concurrency: {group: deploy-production, cancel-in-progress: false}`;
  - `permissions: {contents: read}`;
  - comprueba que su SHA es la cabeza de `main` (`gh api`);
  - llave y `known_hosts` en archivos con `umask 077`;
  - `ssh -o StrictHostKeyChecking=yes -p $VPS_SSH_PORT`;
  - `timeout-minutes: 20`;
  - el resumen del job registra el SHA y los digests.
- Los PR solo ejecutan `calidad`, `docker` y `despliegue`.

**Secrets** (environment `production`):

- `VPS_HOST`
- `VPS_SSH_PORT`
- `VPS_SSH_USER`
- `VPS_SSH_PRIVATE_KEY`
- `VPS_SSH_KNOWN_HOSTS`

**`.env` del VPS:**

- Infraestructura:
  - `RESTAURANTE_DOMAIN`
  - `RESTAURANTE_REGISTRY`
  - `TRAEFIK_CERTRESOLVER`, `TRAEFIK_ENTRYPOINT_HTTP` y `TRAEFIK_ENTRYPOINT_HTTPS`
  - `MYSQL_ROOT_PASSWORD`
  - `RESTAURANTE_DB_APP_PASSWORD`, `RESTAURANTE_DB_MIGRATOR_PASSWORD` y `RESTAURANTE_DB_BACKUP_PASSWORD`
- App:
  - `BUSINESS_TIMEZONE` y `SITE_URL`
  - `WHATSAPP_MOLOTES*` y `WHATSAPP_BIRRIA*`
  - `WHATSAPP_BOT_*` (Meta) y `WHATSAPP_GRAPH_API_VERSION`
  - `ADMIN_USER` y `ADMIN_PASSWORD_HASH`
- Estado del despliegue, no secreto, en `release.env`: `RESTAURANTE_APP_IMAGE` y `RESTAURANTE_MIGRATE_IMAGE`.

**Pruebas en el CI** (`deploy/ci/smoke.sh`, job `despliegue`):

- `shellcheck` (preinstalado en `ubuntu-24.04`).
- `docker compose config -q` con `env.production.example`.
- Aserción con `jq`: ningún servicio publica puertos y `mysql` solo está en la red interna (CA-3 en el compose).
- Registro local `registry:2` con las imágenes construidas, más Traefik fijado por digest. Usa un certresolver ficticio que no llega a ninguna autoridad, así que sirve el certificado por defecto, con entrypoints en puertos altos.
- Comprobaciones:
  - primer despliegue con `deploy.sh`;
  - 200 en la raíz;
  - 301 de HTTP y de `www`, conservando la ruta y la query (CA-2);
  - 25 peticiones a `/admin`: aparece 429 y `/molotes` sigue en 200 (CA-4);
  - el log `request` con `ip` y `protocol: https` (CA-5);
  - migrate que falla (imagen derivada con `ENTRYPOINT false`): la app sigue con el digest anterior y el script sale con error (CA-7);
  - 8 volcados preexistentes: después quedan 7;
  - imagen que nunca queda healthy: rollback al digest anterior y 200 (CA-8);
  - con D-1 A: rollback tras una migración nueva;
  - suma de `deploy/` incorrecta: rechazo;
  - dos despliegues simultáneos: el segundo espera el `flock`.
- Pruebas unitarias y de integración de los cambios de código (D-1 y D-4).

**Solo en el primer despliegue real:**

- certificado válido (CA-1);
- DNS;
- nombres reales del certresolver y de los entrypoints, versión y configuración global de Traefik (`exposedByDefault`, redirección global);
- IP real del cliente a través del proxy de Docker y con IPv6 (CA-5);
- firewall visto desde fuera (CA-3);
- token de GHCR;
- comando forzado y usuario `deploy` sin sudo (CA-10);
- Docker Engine 25 o superior;
- disparo real y dos merges seguidos (CA-6 y CA-9).

CA-7 y CA-8 no se provocan en producción: se dan por cubiertos con la prueba de humo.

### Riesgos técnicos

- La IP real se pierde si Traefik no recibe la IP de origen. Puede pasar con el proxy de usuario de Docker en IPv6 o con un CDN delante. Se verifica en el primer despliegue.
- Una migración no compatible hacia atrás anula el rollback (con D-1 A, la app anterior arranca, pero puede fallar en tiempo de ejecución).
- El DDL de MySQL no es transaccional: una migración a medias deja `MIGRATION_INCOMPLETE` y se restaura a mano.
- Con D-3 A, olvidar reinstalar `deploy/` hace fallar el despliegue, sin tocar la app.
- El plan Free (D-2).

### Decisiones del usuario (2026-10-14)

- D-1: "Bandera de rollback (Recomendado)". `DATABASE_ALLOW_NEWER_SCHEMA=true` solo durante el rollback. Las migraciones deben ser compatibles hacia atrás.
- D-2 y D-3: "Comando forzado (Recomendado)".
  - `restrict,command=` hacia `/opt/restaurante/deploy/deploy.sh`.
  - root instala `deploy/` una vez, de solo lectura, y se verifica por SHA-256.
  - Se sigue en el plan Free.
- D-4: "IP y protocolo siempre (Recomendado)". `ip` y `protocol` en el log `request`, con rotación de 10 MB x 5.
- D-5 y D-6: "Aceptar ambas (Recomendado)".
  - Job nuevo `despliegue`, también en los PR y requerido en T4.
  - Un solo `.env`; la app recibe solo su lista explícita de variables.

## Technical Action Plan

### Objetivo técnico

Cada push a `main` con `calidad`, `docker` y `despliegue` en verde cumple tres cosas:

- publica en GHCR las imágenes `production` y `migrate`, identificadas por digest;
- las despliega por SSH con un comando forzado en `/opt/restaurante`, detrás del Traefik existente;
- hace el volcado previo, migra, comprueba la salud y vuelve a la versión anterior de la app si falla.

### Archivos o componentes afectados

**Nuevos** en `restaurante/deploy/`:

- `compose.prod.yaml`
- `deploy.sh`
- `mysql/initdb/01-usuarios.sh`
- `env.production.example`
- `ci/smoke.sh` y `ci/traefik.yml`

**Modificados:**

- Código:
  - `src/config/env.ts`, `src/db/verify.ts` y `src/server.ts` (D-1)
  - `src/middleware/request-logger.ts` (D-4)
- Comentarios que citan nginx:
  - `src/app.ts`
  - `src/middleware/admin-guard.ts`
  - cabeceras de `compose.yaml` y `docker/mysql/initdb/01-usuarios.sh`
- Pruebas: `tests/unit/config.test.ts`, `tests/unit/db-verify.test.ts`, `tests/integration/db-migrations.test.ts`, y una prueba del log de peticiones.
- CI y documentación:
  - `.github/workflows/ci.yml`
  - `docs/despliegue.md`
  - `README.md` (Docker y la nueva variable)
  - `.env.example`
- Configuración del proyecto, que el usuario aprueba de forma explícita con este plan: `.claude/agents/senior-fullstack.md`. En T4, las comprobaciones que deben quedar en verde pasan de `calidad` y `docker` a `calidad`, `docker` y `despliegue`, en los pasos 8 y 10 y en la regla crítica 7.

### Backend

- **D-1:**
  - `DATABASE_ALLOW_NEWER_SCHEMA` es booleana, `false` por defecto, y se valida con `parseBoolean`.
  - Con ella, `checkMigrations` no lanza `DATABASE_NEWER_THAN_CODE`: registra `database_newer_than_code_allowed` (warn, con los nombres de las migraciones y sin SQL).
  - Siguen exigiéndose todas las migraciones locales aplicadas, con su checksum y terminadas. `MIGRATION_INCOMPLETE` se mantiene.
  - `server_started` incluye `allowNewerSchema`.
  - Solo la pone `deploy.sh` en la vuelta atrás. Nunca va en `.env`: el script se niega si la encuentra ahí.
- **D-4:** la línea `request` añade:
  - `ip`: `ctx.ip`, con `app.proxy` y `maxIpsCount = 1`;
  - `protocol`: `ctx.protocol`.

### Contenido / configuración

**Compose:**

- Proyecto fijo `-p restaurante`.
- `mysql`:
  - fijado por digest, en utf8mb4 con `utf8mb4_es_0900_as_cs`;
  - `--skip-log-bin`, `--mysqlx=OFF` e `--innodb-lock-wait-timeout=10`;
  - red `db` interna, volumen `mysql-data`, sin puertos.
- `app`:
  - imagen `${RESTAURANTE_APP_IMAGE:?}`;
  - redes `db` y `traefik-public` (externa);
  - el compose fija `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=3000`, `TRUST_PROXY=true`, `DATA_DIR=/var/lib/restaurante` y `DATABASE_URL`;
  - el resto, como lista explícita `environment:` (D-6);
  - endurecimiento: `read_only`, `tmpfs /tmp`, `cap_drop: ALL` y `no-new-privileges`;
  - `restart: unless-stopped` y `stop_grace_period: 15s`;
  - healthcheck con `start_period: 90s` y `start_interval: 2s`;
  - sin `ports`.
- `migrate`: `profiles: [migrate]` y `MIGRATION_DATABASE_URL`.
- Logs `json-file` de 10 MB x 5 en todos los servicios.

**MySQL** (initdb, solo con el volumen vacío):

- base `restaurante` en utf8mb4 con `utf8mb4_es_0900_as_cs`;
- `restaurante_app`: DML;
- `restaurante_migrator`: DML más `CREATE`, `ALTER`, `DROP`, `INDEX` y `REFERENCES`;
- `restaurante_backup`: `SELECT`, `SHOW VIEW`, `TRIGGER` y `LOCK TABLES`;
- contraseñas generadas con `openssl rand -hex 32`.

**Traefik** (prefijo `restaurante`; v2 y v3):

- Generales:
  - `traefik.enable`;
  - `traefik.docker.network=traefik-public`;
  - servicio en el puerto 3000.
- Router `restaurante`: HTTPS del dominio raíz.
- Router `restaurante-admin`:
  - ``Path(`/admin`) || PathPrefix(`/admin/`)``, con `priority=100`;
  - `ratelimit` con `average=10`, `period=1m` y `burst=20`.
- Router `restaurante-www`: HTTPS de `www`.
- Router `restaurante-http`: los dos hosts en el entrypoint `web`.
- Middleware `redirectregex`: de `^https?://(?:www\.)?<dominio>(.*)$` a `https://<dominio>${1}`, permanente.
- Certresolver y entrypoints salen de `.env`, con valores por defecto `letsencrypt`, `web` y `websecure`.
- Sin HSTS.

**`.env` del VPS** (600, uno solo):

- Infraestructura:
  - `RESTAURANTE_DOMAIN`
  - `RESTAURANTE_REGISTRY`
  - `TRAEFIK_CERTRESOLVER`, `TRAEFIK_ENTRYPOINT_HTTP` y `TRAEFIK_ENTRYPOINT_HTTPS`
  - `MYSQL_ROOT_PASSWORD`
  - `RESTAURANTE_DB_APP_PASSWORD`, `RESTAURANTE_DB_MIGRATOR_PASSWORD` y `RESTAURANTE_DB_BACKUP_PASSWORD`
- App:
  - `BUSINESS_TIMEZONE` y `SITE_URL`
  - `WHATSAPP_MOLOTES*` y `WHATSAPP_BIRRIA*`
  - `WHATSAPP_BOT_*` (Meta) y `WHATSAPP_GRAPH_API_VERSION`
  - `ADMIN_USER` y `ADMIN_PASSWORD_HASH`
- Estado, no secreto, en `state/release.env`: `RESTAURANTE_APP_IMAGE` y `RESTAURANTE_MIGRATE_IMAGE`.

**Disposición en el VPS:**

- `/opt/restaurante/deploy/`: root, 755 y 644.
- `/opt/restaurante/{state,backups}`: `deploy`, 700.
- `/opt/restaurante/.env`: `deploy`, 600.
- `authorized_keys` de `deploy`: `restrict,command="/opt/restaurante/deploy/deploy.sh" ssh-ed25519 …`. El script lee sus argumentos de `SSH_ORIGINAL_COMMAND`.

**Secrets** (`gh secret set --env production`):

- `VPS_HOST`
- `VPS_SSH_PORT`
- `VPS_SSH_USER`
- `VPS_SSH_PRIVATE_KEY` (desde archivo)
- `VPS_SSH_KNOWN_HOSTS` (desde `ssh-keyscan`, con la huella comprobada aparte)

### Despliegue (`deploy.sh`, sh POSIX, `set -eu`, sin `set -x`)

Argumentos: `<sha> <digest app> <digest migrate> <sha256 de deploy/>`, validados con expresiones regulares.

1. Precondiciones:
   - `flock`;
   - `.env` con permisos 600 y sin `DATABASE_ALLOW_NEWER_SCHEMA`;
   - la suma de `deploy/` coincide (si no: "reinstala deploy/ del commit X").
2. `docker pull` de los dos digests del registro configurado.
3. `up -d --wait mysql`.
4. Volcado:
   - `mysqldump --single-transaction --no-tablespaces --default-character-set=utf8mb4`, con `MYSQL_PWD` dentro del contenedor;
   - comprimido con gzip, con `umask 077`, a `backups/<UTC>-<sha>.sql.gz`;
   - verificado con `gzip -t` y la marca "Dump completed";
   - retención de 7.
5. `run --rm migrate`.
6. Guarda el `release.env` anterior, escribe el nuevo y ejecuta `up -d --no-deps app`.
7. Espera `healthy` (180 s) y hace `curl` a través de Traefik (`--resolve <dominio>:443:127.0.0.1 -k`).
8. Añade el resultado a `state/releases.log`.

Fallos:

- En los pasos 1 a 5: sale con un código distinto de 0 sin tocar la app.
- En el paso 7: vuelve al `release.env` anterior con `DATABASE_ALLOW_NEWER_SCHEMA=true` solo en ese `up`, espera `healthy` y sale con un código distinto de 0.
- Sin versión anterior: informa y sale con un código distinto de 0.

### Workflow (`ci.yml`; los permisos globales siguen en `contents: read`)

- `despliegue` (también en los PR): prueba de humo.
- `publish`:
  - `needs: [calidad, docker, despliegue]`;
  - solo en push a `main`;
  - `permissions: {contents: read, packages: write}`;
  - `docker/login-action` fijada por SHA;
  - build-push de `ghcr.io/orvigas/restaurante` y `ghcr.io/orvigas/restaurante-migrate` con la etiqueta `sha-<sha>`;
  - sus salidas son los digests.
- `deploy`:
  - `needs: publish`;
  - `environment: {name: production, url: https://birriaelmuneco.com}`;
  - `concurrency: {group: deploy-production, cancel-in-progress: false}`;
  - `permissions: {contents: read}`;
  - si su SHA ya no es la cabeza de `main`, termina sin desplegar;
  - `ssh -o StrictHostKeyChecking=yes`, con la llave y `known_hosts` en archivos con `umask 077`;
  - `timeout-minutes: 20`;
  - resumen del job con el SHA y los digests.

### Validaciones

- Variables de entorno validadas por `env.ts`.
- `deploy.sh` valida los argumentos de SSH, los permisos del `.env`, la suma de `deploy/`, el volcado y la forma de los digests.

### Manejo de errores

- Fallo rápido con mensajes sin valores.
- El workflow termina en rojo ante cualquier fallo remoto.
- Ningún secreto en logs: sin `set -x` y sin imprimir `docker compose config`.

### Testing

- Unitarias e integración:
  - la bandera de D-1, en `env.ts` y con MySQL real: tolera una migración desconocida, pero `MIGRATION_INCOMPLETE` y `MIGRATION_MODIFIED` siguen fallando;
  - `ip` y `protocol` en el log, con y sin `TRUST_PROXY`.
- Job `despliegue` (`deploy/ci/smoke.sh`):
  - `shellcheck`;
  - `compose config -q`;
  - con `jq`: sin `ports` y `mysql` solo en la red interna (CA-3);
  - un `registry:2` local y Traefik fijado por digest, con un certresolver ficticio.
- Casos de la prueba de humo:
  - primer despliegue y 200;
  - CA-2: 301 conservando la ruta y la query;
  - CA-4: 429 en `/admin`, `/molotes` sigue en 200;
  - CA-5: log con `ip` y `protocol: https`;
  - CA-7: migración que falla, y retención con 8 volcados previos;
  - CA-8: imagen que nunca queda healthy;
  - rollback tras una migración nueva (D-1);
  - suma de `deploy/` incorrecta;
  - dos despliegues simultáneos (`flock`);
  - argumentos inválidos.
- `npm run typecheck`, `npm run lint` y `npm test`.
- Solo en el primer despliegue real:
  - CA-1, DNS y certificado;
  - nombres reales del certresolver y de los entrypoints, versión y configuración global de Traefik;
  - IP real del cliente, también con IPv6;
  - firewall visto desde fuera (CA-3);
  - token de GHCR (PAT clásico con `read:packages`);
  - comando forzado y usuario sin sudo (CA-10);
  - Docker Engine 25 o superior;
  - CA-6 y CA-9 con merges reales.

### Seguridad

- Comando forzado con `restrict`.
- Permisos mínimos de `GITHUB_TOKEN` por job.
- Acciones fijadas por SHA.
- La app no recibe la contraseña root (D-6).
- Contenedores sin capacidades y con sistema de archivos de solo lectura.
- MySQL sin puertos.
- Volcados con permisos 600.

### Riesgos técnicos

- Corte de 10 a 30 s en cada despliegue (una sola réplica).
- 429 en sesiones intensas de `/admin`.
- Migración no compatible hacia atrás: la app anterior arranca con la bandera, pero puede fallar.
- DDL a medias: restauración manual.
- Olvidar reinstalar `deploy/`: el despliegue falla sin tocar la app.
- Plan Free: el environment no se puede limitar a `main`. Lo mitiga el comando forzado.
- IP real con un CDN o con el proxy de Docker en IPv6.
- Caducidad del PAT de GHCR.

### Orden de implementación

1. Bandera de D-1 y log de D-4, con sus pruebas.
2. `deploy/` (compose, initdb, `env.production.example` y `deploy.sh`).
3. Prueba de humo y job `despliegue`.
4. `publish` y `deploy` en `ci.yml`.
5. Documentación (`docs/despliegue.md`, `README.md` y `.env.example`) y `.claude/agents/senior-fullstack.md`.
6. Validación completa.

### Criterios de finalización

- `typecheck`, `lint` y `test` en verde.
- El job `despliegue` cubre CA-2, CA-3 (compose), CA-4, CA-5, CA-7, CA-8 y CA-9 (`flock`).
- CA-12 documentado.
- CA-1, CA-3 (externo), CA-6, CA-10 y CA-11 quedan como lista de verificación del primer despliegue real, que hace el usuario después del merge.

## Implementation Result

### Rama

`feature/REQ-F-016-despliegue-produccion-traefik`, creada desde `main` (`62db1be`). Sin commits: pendiente de aprobación.

### Cambios realizados

- **D-1:** `DATABASE_ALLOW_NEWER_SCHEMA` (booleana, `false` por defecto) en `src/config/env.ts`.
  - `verifyDatabase` acepta `allowNewerSchema` y, con él, tolera las migraciones aplicadas que no conoce y emite `database_newer_than_code_allowed` (warn, solo los nombres).
  - `MIGRATIONS_PENDING`, `MIGRATION_INCOMPLETE` y `MIGRATION_MODIFIED` se mantienen.
  - `server.ts` la pasa y la registra en `server_started`.
- **D-4:** la línea `request` lleva `ip` y `protocol`.
- **`restaurante/deploy/`:**
  - `compose.prod.yaml`:
    - MySQL en la red interna con `--innodb-lock-wait-timeout=10`;
    - app endurecida, con su lista explícita de variables;
    - `migrate` con perfil;
    - labels de Traefik con prefijo `restaurante`;
    - logs de 10 MB x 5.
  - `deploy.sh`: comando forzado; suma de `deploy/`; `flock`; volcado con un archivo de opciones temporal y retención de 7; migración; healthy y prueba a través de Traefik; vuelta atrás con la bandera; `releases.log`.
  - `mysql/initdb/01-usuarios.sh`: usuarios app, migrator y backup.
  - `env.production.example`.
  - `ci/smoke.sh`.
- **`ci.yml`:**
  - jobs `despliegue` (también en los PR), `publish` (GHCR, `packages: write`) y `deploy` (environment `production`, `concurrency: deploy-production`, solo si su commit sigue siendo la cabeza de `main`);
  - `docker/login-action` v4.6.0 fijada por SHA.
- **Documentación:**
  - `docs/despliegue.md`, reescrita: VPS, `deploy/`, GHCR, llave, secrets con `gh secret set`, reglas del environment, `.env`, primer despliegue con la verificación de los supuestos, operación, vuelta atrás manual, restauración desde un volcado y diagnóstico por código de salida;
  - `README.md` (Docker, CI, configuración, seguridad y logs);
  - `.env.example`;
  - comentarios que citaban nginx (`app.ts`, `admin-guard.ts`, `client.ts`, `compose.yaml` e initdb de desarrollo).
- **Configuración del proyecto (aprobada):** en `.claude/agents/senior-fullstack.md`, T4 exige `calidad`, `docker` y `despliegue`.
- **Desviación menor del plan:** `deploy.sh` y `smoke.sh` usan bash (`pipefail`), no sh POSIX; Ubuntu 24.04 lo trae. El Traefik de la prueba se configura con argumentos, así que `ci/traefik.yml` no hace falta.

### Criterios de aceptación

| CA | Estado |
| -- | ------ |
| CA-1 | Local: 200 por HTTPS a través de Traefik. Certificado real: primer despliegue |
| CA-2 | Cumplido en la prueba de humo (las 3 variantes, con ruta y query) |
| CA-3 | Cumplido en el compose (sin `ports`; `mysql` solo en `db`, interna). Desde fuera: primer despliegue |
| CA-4 | Cumplido en la prueba de humo: 20 respuestas 503 (sin usuarios) y luego 10 respuestas 429; `/molotes` en 200 |
| CA-5 | Cumplido en la prueba y en la prueba de integración: `protocol: https` y la IP del cliente, distinta de la de Traefik. IP pública real: primer despliegue |
| CA-6 | Workflow listo (`publish` y `deploy` solo en push a `main` y tras las 3 comprobaciones). Primer merge real |
| CA-7 | Cumplido en la prueba de humo: código 13, la app intacta y 200, volcado previo; con 8 volcados viejos quedan 7 |
| CA-8 | Cumplido en la prueba de humo: código 21, vuelta al digest anterior y 200; `release.env` sin cambios. También tras una migración nueva (D-1) |
| CA-9 | `concurrency` en el job y `flock` en el VPS (probado: uno espera al otro) |
| CA-10 | Sin secretos en el repositorio; el script no usa `set -x`; `.env` con 600, exigido por el script. Usuario sin sudo: primer despliegue |
| CA-11 | Certresolver, entrypoints y dominio vienen de `.env`; el puerto SSH, de `VPS_SSH_PORT` |
| CA-12 | `docs/despliegue.md`, secciones 1 a 3 y 9 |

### Validaciones ejecutadas

- `npm run typecheck`: 0.
- `npm run lint`: 0.
- `npm test`: 78 archivos, 1512 pruebas pasadas y 1 fallo esperado (sin cambios). Las 4 suites tocadas suman 155 pruebas.
- `shellcheck` (koalaman/shellcheck:stable) sobre `deploy.sh`, `01-usuarios.sh` y `smoke.sh`: sin avisos.
- `actionlint` sobre los workflows: sin errores.
- Prueba de humo local en Docker Desktop 29.6.1, con imágenes arm64 y desde un contenedor Linux: 45 de 45 comprobaciones, dos veces.

### Archivos afectados

- Nuevos:
  - `restaurante/deploy/compose.prod.yaml`
  - `restaurante/deploy/deploy.sh`
  - `restaurante/deploy/mysql/initdb/01-usuarios.sh`
  - `restaurante/deploy/env.production.example`
  - `restaurante/deploy/ci/smoke.sh`
  - `restaurante/tests/integration/request-logger.test.ts`
- Modificados:
  - `.github/workflows/ci.yml`
  - `.claude/agents/senior-fullstack.md`
  - `restaurante/src/config/env.ts`
  - `restaurante/src/db/verify.ts`
  - `restaurante/src/db/client.ts`
  - `restaurante/src/server.ts`
  - `restaurante/src/app.ts`
  - `restaurante/src/middleware/request-logger.ts`
  - `restaurante/src/middleware/admin-guard.ts`
  - `restaurante/tests/unit/config.test.ts`
  - `restaurante/tests/unit/db-verify.test.ts`
  - `restaurante/tests/integration/db-verify.test.ts`
  - `restaurante/.env.example`
  - `restaurante/README.md`
  - `restaurante/docs/despliegue.md`
  - `restaurante/compose.yaml`
  - `restaurante/docker/mysql/initdb/01-usuarios.sh`

### Riesgos o pendientes

- **Sin verificar en local:** el job `despliegue` en el runner `ubuntu-24.04` (amd64; se verá en el PR). `publish` y `deploy` contra GHCR y el VPS reales (tras el merge).
- **Supuestos del primer despliegue:** nombres y versión de Traefik, IP real, certificado, firewall, Docker Engine 25 o superior (`start_interval`) y si GitHub permite secrets de environment en el plan Free. Si no, se usan secrets del repositorio con los mismos nombres.
- **Pasos manuales previos al primer merge:** los de `docs/despliegue.md`, secciones 1 a 3. Si se hace merge antes, el job `deploy` falla sin efecto en el VPS.

## QA Action Plan

### Objetivo

Validar de forma independiente la implementación de REQ-F-016 (compose de producción, `deploy.sh`, jobs `despliegue`/`publish`/`deploy`, `DATABASE_ALLOW_NEWER_SCHEMA`, `ip`/`protocol` en el log) sin regresiones en las landings ni en `/admin`. No hay UI nueva: sin pruebas visuales frente a `_stich_source_/`.

### Requisito bajo prueba

RF-1 a RF-7, RN, CA-1 a CA-12 y las decisiones D-1 a D-6 del ticket.

### Criterios de aceptación (CA → pruebas; "posterior" = verificación en el primer despliegue real, no bloqueante)

| CA | Ahora (bloqueante) | Posterior |
| -- | ------------------ | --------- |
| CA-1 | F-4 (200 por HTTPS a través de Traefik en la prueba de humo) | Certificado válido y landing del día en `https://birriaelmuneco.com` |
| CA-2 | F-4 (3 variantes → 301 con ruta y query) | — |
| CA-3 | S-6 (compose sin `ports`, `mysql` solo en red interna) | Escaneo de 3000/3306 desde fuera |
| CA-4 | F-4 (20 + 429; landings en 200) | — |
| CA-5 | F-1, F-4 (`ip` y `protocol: https` en la línea `request`) | IP pública real en el log |
| CA-6 | S-3, S-4 (disparadores, `needs`, `if`) | Primer merge: publica y despliega; un PR no |
| CA-7 | F-4 (código 13, app intacta, volcado previo, retención 7) | — |
| CA-8 | F-4 (código 21, vuelta al digest anterior con la bandera, 200) | — |
| CA-9 | S-4 (`concurrency` sin cancelación) + `flock` en `deploy.sh` | Dos merges seguidos |
| CA-10 | S-1, S-2, S-5 (sin secretos en repo/logs, 600 exigido) | Logs reales del workflow; usuario `deploy` sin sudo |
| CA-11 | S-6 (certresolver, entrypoints, dominio y puerto SSH parametrizados) | — |
| CA-12 | D-1 (documentación frente a lo implementado) | — |

### Riesgos identificados

- Inyección o escalada vía `SSH_ORIGINAL_COMMAND` en el comando forzado.
- Secretos en logs (`set -x`, `docker compose config`, `echo` de variables, llave SSH).
- `deploy` ejecutable fuera de push a `main` (environments sin protección en plan Free: D-2).
- `DATABASE_ALLOW_NEWER_SCHEMA` activa fuera del rollback (debilita la verificación de esquema).
- `TRUST_PROXY`/`app.proxy` aceptando `X-Forwarded-*` falsificados sin proxy (rate limit y IP de `/admin`).
- El job `despliegue` no probado aún en el runner amd64.

### Pruebas funcionales

- F-1: `npm test` completo (incluye `request-logger.test.ts`, `config.test.ts`, `db-verify` unit e integración). Esperado: todo verde salvo el `it.fails` intencional de `tests/integration/local-server.test.ts`, que Vitest cuenta como esperado.
- F-2: `npm run typecheck` y `npm run lint` → 0, sin avisos.
- F-3: `shellcheck` (imagen `koalaman/shellcheck:stable`) sobre `deploy/deploy.sh`, `deploy/ci/smoke.sh`, `deploy/mysql/initdb/01-usuarios.sh` y `docker/mysql/initdb/01-usuarios.sh`; `actionlint` (imagen `rhysd/actionlint`) sobre `.github/workflows/`.
- F-4: `deploy/ci/smoke.sh` en Docker local, ejecutado por QA tal como lo invoca el job `despliegue`; revisar que cubre CA-1/2/4/5/7/8 y que termina en 0.

### Pruebas negativas y casos límite (`deploy.sh`, en un contenedor desechable, sin Docker real cuando no haga falta)

- N-1: `SSH_ORIGINAL_COMMAND` con `;`, `$(...)`, `` ` ``, `|`, `&`, saltos de línea, `../`, comillas, número de argumentos distinto de 4 → código 2 sin ejecutar nada.
- N-2: SHA no hexadecimal o de longitud distinta, digests sin `sha256:` o con mayúsculas, suma inválida → código 2.
- N-3: `.env` con permisos distintos de 600 o con `DATABASE_ALLOW_NEWER_SCHEMA` → fallo antes de tocar la app.
- N-4: suma de `deploy/` distinta → mensaje "reinstala deploy/" y fallo.
- N-5: app con `DATABASE_ALLOW_NEWER_SCHEMA=false` y migración desconocida → no arranca (`DATABASE_NEWER_THAN_CODE`); con `true` arranca y emite `database_newer_than_code_allowed`; `MIGRATIONS_PENDING`/`MODIFIED` siguen bloqueando (cubierto por tests; revisar evidencia).
- N-6: valores no booleanos en `DATABASE_ALLOW_NEWER_SCHEMA` → `env.ts` rechaza.

### Pruebas de seguridad (revisión dirigida con evidencia de líneas)

- S-1: `deploy.sh` sin `set -x`, sin `eval`, variables entrecomilladas, sin imprimir valores de `.env` ni `docker compose config`; mensajes de error sin valores.
- S-2: volcado con `umask 077`, `MYSQL_PWD`/archivo de opciones temporal eliminado (trap), no expuesto en `ps`/argumentos.
- S-3: workflow: `on` solo `pull_request` y `push` a `main`; `publish` con `if` de push a `main` y `needs: [calidad, docker, despliegue]`; `deploy` depende de `publish` (se omite en PR y con CI en rojo).
- S-4: permisos: global `contents: read`; `publish` solo `packages: write`; `deploy` `contents: read`; `GITHUB_TOKEN` no llega al VPS; acciones de terceros fijadas por SHA; `concurrency: deploy-production` sin cancelación; comprobación de cabeza de `main` vía API antes de `checkout` y SSH.
- S-5: secretos `VPS_*` solo en el paso `desplegar` (env, no interpolados en `run:`); llave y `known_hosts` con `umask 077`; `StrictHostKeyChecking=yes`; sin `echo` de secretos; limpieza de la llave.
- S-6: `compose.prod.yaml`: sin `ports`, red `db` interna, app con lista explícita de variables (sin `MYSQL_ROOT_PASSWORD`), endurecimiento (usuario no root, `read_only`/`cap_drop`/`no-new-privileges` si el plan lo fija), logs 10 MB x 5, labels parametrizados; `git grep` de patrones de secretos en el diff.
- S-7: `01-usuarios.sh` de producción: privilegios mínimos de `app` (DML), `migrator` (DDL) y `backup` (solo lectura/lock necesarios).

### Pruebas de regresión

- R-1: con el servidor local (`PORT=3100`, `.env` existente): `GET /`, `/molotes`, `/birria` en 200 con el `href` de WhatsApp intacto; `/admin` (login) y su rate limit sin cambios; línea `request` con `ip` y `protocol`, sin datos sensibles.
- R-2: `TRUST_PROXY` desactivado: un `X-Forwarded-For` falsificado no cambia `ip` ni el límite de `/admin` (cubierto por tests existentes; confirmar con curl).
- R-3: `compose.yaml` de desarrollo e initdb de desarrollo: solo cambian comentarios (revisión del diff); `npm run db:up` sigue funcionando (lo ejercita F-1).
- Sin pruebas de navegador ni responsive: no hay cambios de HTML/CSS/JS de frontend (se confirma con `git diff --stat` sobre `src/views`, `public/`).

### Pruebas automatizadas

Se usan las existentes y las nuevas de la implementación. QA no crea tests salvo que F-1/N-5 revelen un hueco; en ese caso se propondría en una nueva ronda.

### Documentación

- D-1: `docs/despliegue.md`, `README.md`, `.env.example` y `deploy/env.production.example` frente al código: nombres de variables y secrets, comandos `gh secret set`, reglas del environment (y la limitación del plan Free), preparación del VPS, instalación de `deploy/` con su SHA-256, restauración desde un volcado y códigos de salida coincidentes con `deploy.sh`.
- D-2: `.claude/agents/senior-fullstack.md` (T4 exige `calidad`, `docker`, `despliegue`), cambio aprobado.

### Evidencia requerida

Salidas de los comandos (typecheck, lint, test, shellcheck, actionlint, smoke), salidas de las pruebas N-1 a N-4, líneas citadas de `deploy.sh`/`ci.yml`/`compose.prod.yaml`, respuestas `curl` y líneas de log de R-1/R-2.

### Criterios de aprobación

- F-1 a F-4 en verde; N-1 a N-6 con el resultado esperado; S-1 a S-7 sin hallazgos `BLOCKER`/`CRITICAL`; R-1 a R-3 sin regresión; documentación coherente.
- Los CA marcados "Posterior" quedan como pendientes de verificación en el primer despliegue y no bloquean.
- Si la prueba de humo no puede ejecutarse por el entorno local (Docker), se registra como bloqueo de entorno y se devuelve `NEEDS_USER_DECISION`, porque CA-7 y CA-8 dependen de ella.

## QA Report

### Ronda

1 (2026-10-14). QA Action Plan aprobado por el usuario ("Aprobar").

### Pruebas ejecutadas

- Rama `feature/REQ-F-016-despliegue-produccion-traefik`. Los cambios no tienen commit.
- `npm run typecheck`: 0.
- `npm run lint`: 0, sin avisos.
- `npm test`: 78 de 78 archivos y 1512 pruebas pasadas, más 1 "expected fail" (el `it.fails` intencional de `tests/integration/local-server.test.ts`).
- `shellcheck` (`koalaman/shellcheck:stable`) sobre `deploy/deploy.sh`, `deploy/ci/smoke.sh`, `deploy/mysql/initdb/01-usuarios.sh` y `docker/mysql/initdb/01-usuarios.sh`: 0, sin avisos.
- `actionlint` (`rhysd/actionlint:latest`) sobre `.github/workflows/`: 0.
- F-4, prueba de humo: se construyeron las imágenes `production` y `migrate` y se ejecutó `deploy/ci/smoke.sh` desde un contenedor Linux (`docker:cli` con bash, util-linux, coreutils y findutils) con el socket de Docker. Termina en 0 con 45 de 45 comprobaciones ("todas las comprobaciones pasaron") y sin contenedores residuales.
- N-1 y N-2, 17 casos propios contra `deploy.sh` en `ubuntu:24.04`:
  - inyección por `SSH_ORIGINAL_COMMAND` con `;`, `$()`, backticks, `|`, salto de línea, tabulador, `../` y comillas: código 2, "comando SSH no permitido";
  - 4 o 6 argumentos, o un subcomando distinto de `deploy`: código 2, "uso";
  - SHA corto o en mayúsculas, digest sin `sha256:` o en mayúsculas, suma inválida: código 2 con el mensaje de cada campo;
  - argumentos válidos sin `.env`: código 3;
  - ningún efecto secundario: `/tmp/pwned` no existe.
- N-3 y N-4 (en la prueba de humo): `.env` sin 600 da 3, `.env` con `DATABASE_ALLOW_NEWER_SCHEMA` da 3, suma distinta da 4, y ningún rechazo creó contenedores.
- N-5 y N-6: cubiertos por `tests/unit/db-verify.test.ts`, `tests/integration/db-verify.test.ts` y `tests/unit/config.test.ts` (en verde), y por la sección D-1 de la prueba de humo: la app anterior arranca con la base más nueva y registra `database_newer_than_code_allowed`.
- R-1 y R-2, servidor local (`NODE_ENV=development PORT=3100 npm start`):
  - `/`, `/molotes`, `/birria` y `/admin/login` responden 200; `/admin` responde 303;
  - el `href` de WhatsApp es correcto en las dos landings (`wa.me/...?text=...molotes` y `...birria`);
  - `server_started` registra `trustProxy:false` y `allowNewerSchema:false`;
  - con `X-Forwarded-For: 203.0.113.9` y `X-Forwarded-Proto: https`, la línea `request` registra `"ip":"127.0.0.1","protocol":"http"`: sin `TRUST_PROXY`, las cabeceras falsificadas se ignoran;
  - en el log solo aparece el aviso esperado `admin_bootstrap_ignored`.
  - El servidor quedó detenido.
- R-3: en `compose.yaml` y en el initdb de desarrollo solo cambian comentarios. `git diff main` sobre `src/views`, `src/content` y `public/` está vacío.
- S-1 a S-7: revisión con las líneas citadas más abajo. Un escaneo de patrones de secretos sobre `deploy/`, `ci.yml`, `.env.example` y `docs/despliegue.md` no encontró nada; el log de la prueba de humo tiene 0 apariciones de "password".

### Criterios de aceptación

| CA | Resultado | Evidencia |
| -- | --------- | --------- |
| CA-1 | PASS (local); certificado real pendiente del primer despliegue | Prueba de humo: "https raíz responde 200" a través de Traefik |
| CA-2 | PASS | Prueba de humo: las 3 variantes dan 301 conservando la ruta y la query |
| CA-3 | PASS (compose); desde fuera, pendiente | Prueba de humo: "ningún servicio publica puertos", "mysql solo está en la red interna", "la red db es interna" |
| CA-4 | PASS | Prueba de humo: 20 respuestas sin 429 y luego 10 con 429; las landings no se ven afectadas. Labels en `compose.prod.yaml:134-136` |
| CA-5 | PASS (local); IP pública, pendiente | Prueba de humo: `protocol https` e IP 172.24.0.1 (la del cliente), distinta de la de Traefik (172.24.0.2). Pruebas de integración en verde |
| CA-6 | PASS (configuración); merge real, pendiente | `ci.yml:16-21` (solo PR y push a `main`); `publish` con `if` de push a `main` y `needs: [calidad, docker, despliegue]` (`ci.yml:210-211`); `deploy` con `needs: publish` |
| CA-7 | PASS | Prueba de humo: código 13, la app no se tocó y responde 200, existe el volcado previo, quedan 7 volcados |
| CA-8 | PASS | Prueba de humo: código 21, vuelta al digest anterior, 200, `release.env` sin cambios; también tras una migración nueva |
| CA-9 | PASS (local); merges reales, pendiente | Prueba de humo: "uno esperó al otro (flock)". `concurrency: deploy-production` con `cancel-in-progress: false` |
| CA-10 | PASS (repositorio y script); logs reales y sudo, pendientes | Sin `set -x`, `eval` ni `compose config` en `deploy.sh`; secrets `VPS_*` solo en el `env` del paso `desplegar`; llave con `umask 077` y `trap`; `.env` 600 exigido (`deploy.sh:75`) |
| CA-11 | PASS | `compose.prod.yaml:121-146` toma el dominio, los entrypoints y el certresolver del `.env`; puerto SSH desde `VPS_SSH_PORT` |
| CA-12 | PASS | `docs/despliegue.md` §1 (VPS), §2 (secrets con `gh secret set` y reglas del environment, con la limitación del plan Free), §3 (`.env`) y §9 (restauración) coinciden con el código. Ver DEF-001 |

### Defectos encontrados

#### DEF-001
- Severidad: TRIVIAL.
- Criterio de aceptación afectado: CA-12 (no lo invalida).
- Descripción: la tabla de diagnóstico de `docs/despliegue.md` (§10, línea 360 en adelante) no recoge los códigos de salida 5 (`deploy.sh:100`, otro despliegue sigue en curso al agotar `flock`) ni 11 (`deploy.sh:134`, "MySQL no quedó healthy").
- Pasos para reproducir: comparar los `fail <código>` de `deploy.sh` con la tabla §10.
- Resultado esperado: la tabla cubre todos los códigos de salida.
- Resultado actual: faltan el 5 y el 11.
- Evidencia: `grep` sin coincidencias para "Código 5" y "Código 11" en `docs/despliegue.md`.
- Impacto: el operador no tiene una guía para esos dos fallos, aunque el mensaje del script los explica.
- Recomendación: añadir las dos filas.

#### Observaciones (no son defectos)

- `deploy.sh:211`: en la vuelta atrás, las últimas 50 líneas del log de la app llegan al log del workflow. Pueden incluir IP de clientes (D-4) con la retención de GitHub Actions, que es distinta de la de 10 MB x 5. Solo ocurre cuando falla un despliegue.
- Tras una vuelta atrás, el contenedor sigue con `DATABASE_ALLOW_NEWER_SCHEMA=true` hasta el siguiente despliegue. Es coherente con D-1 y está documentado en §10, código 21.
- D-2, aceptado por el usuario: con el plan Free, un workflow modificado en un PR del mismo repositorio podría leer los secrets del environment. La mitigación documentada es el comando forzado.

### Regresión

Sin regresión. La suite completa está en verde. Las landings y `/admin` responden igual; el log `request` añade `ip` y `protocol` sin datos sensibles; `TRUST_PROXY` está desactivado por defecto e ignora `X-Forwarded-*`.

### Responsive, accesibilidad, UX/UI, SEO y performance

No aplican: no hay cambios de frontend (el diff de `src/views`, `src/content` y `public/` está vacío).

### Pendientes de revisión manual (primer despliegue, no bloqueantes)

1. CA-1: `https://birriaelmuneco.com` responde 200 con un certificado válido de Let's Encrypt y muestra la landing del día.
2. CA-3: los puertos 3000 y 3306 no responden desde fuera del VPS.
3. CA-5: la línea `request` registra la IP pública real del cliente y `protocol: https`.
4. CA-6:
   - el primer merge a `main` publica las dos imágenes en GHCR y despliega sin pasos manuales;
   - un PR no ejecuta `publish` ni `deploy`;
   - un CI en rojo no despliega.
5. CA-9:
   - dos merges seguidos no despliegan a la vez;
   - el commit que ya no es la cabeza de `main` termina sin desplegar.
6. CA-10:
   - los logs reales del workflow no muestran secretos;
   - `sudo -l -U deploy` no concede sudo;
   - `.env` tiene permisos 600 en el VPS.
7. El job `despliegue` pasa en el runner `ubuntu-24.04` (amd64) del PR.
8. Supuestos de `docs/despliegue.md` §4: nombres y versión de Traefik, Docker Engine 25 o superior y secrets de environment en el plan Free (si no, secrets del repositorio).

### Resultado final

QA_APPROVED

## Cierre

PR #43 mergeado en `main` (commit de merge `05bd9e7`, 2026-10-14T07:14:54Z). El merge disparó el primer despliegue real: run 38527090517 de Actions, todos los jobs en `success`, y el job `deploy` de 07:24:12Z a 07:25:08Z.

### Verificación del primer despliegue (2026-10-14)

| CA | Resultado |
| -- | --------- |
| CA-1 | 200 con certificado de Let's Encrypt (YR2), válido hasta el 2027-01-12; landing de Molotes un miércoles |
| CA-2 | Las 3 variantes responden 301. `http://` y `http://www` van a `https://` del mismo host (redirección global de Traefik) y `https://www` va a la raíz, con ruta y query |
| CA-3 | Puertos 3000 y 3306 cerrados desde fuera |
| CA-4 | De 30 peticiones a `/admin`: 21 con 200 y 9 con 429; `/molotes` sigue en 200 |
| CA-5 | El log registra la IP pública real y `protocol: https` |
| CA-6 | El merge desplegó sin pasos manuales, con volcado previo en `/opt/restaurante/backups` |
| CA-7 y CA-8 | Cubiertos por la prueba de humo del CI (no se provocan en producción) |
| CA-9 | Verificado el 2026-10-14 con los merges seguidos de #50 y #51 (ver "Verificación de CA-9" en el historial) |
| CA-10 | `.env` con permisos 600 y dueño `deploy`; `deploy` sin sudo |
| CA-11 y CA-12 | Cumplidos (configuración en `.env` y secrets; `docs/despliegue.md`) |

Al arrancar, la app y MySQL quedaron healthy y el log registró `admin_bootstrap_created`. El bot está deshabilitado: el usuario aún no tiene cuenta de Meta y Twilio no se permite en producción (anotado en `pendientes.md`).

### Infraestructura del VPS

Preparada el 2026-10-14 desde la sesión principal, con aprobación del usuario:

- SSH solo con llave;
- ufw con 22, 80 y 443;
- red `traefik-public` creada;
- usuario `deploy` creado;
- `deploy/` instalado (suma `82c3e5ae4b8f99ea424f55291032ab81c550632240d4bffedd0168579ee21596`).

Traefik del VPS:

- 3.7.14 con `network_mode: host`;
- certresolver `letsencrypt` y entrypoints `web` y `websecure`;
- redirección global de HTTP a HTTPS (301).

Docker Engine 29.8.1.

## Historial de cambios

### Versión 1

Descripción inicial (2026-10-14). Consolida los REQ-F-016, 017 y 021 del roadmap, adaptados a Traefik preinstalado y a un pipeline automático.

Decisiones del usuario:
- despliegue en cada push a `main` tras el CI;
- llave SSH en GitHub Secrets;
- secretos de la app solo en el `.env` del VPS;
- volcado previo a cada migración, con retención de 7;
- rollback automático solo de la app;
- límite en `/admin` de 10 por minuto con ráfaga de 20;
- red de Traefik `traefik-public`;
- usuario `deploy`;
- ruta del proyecto `/opt/restaurante`.

### Revisión técnica (T1)

2026-10-14, senior-fullstack: revisión técnica y propuesta de plan. Estado `NEEDS_TECHNICAL_CLARIFICATION` por las decisiones D-1 a D-6.

### Technical Action Plan (T1)

2026-10-14, senior-fullstack: decisiones D-1 a D-6 registradas y Technical Action Plan cerrado. Estado `NEEDS_TECHNICAL_PLAN_APPROVAL`.

### Implementación (T2)

2026-10-14, senior-fullstack: rama `feature/REQ-F-016-despliegue-produccion-traefik` y ticket movido a `in-progress/`. Implementado el Technical Action Plan aprobado ("Aprobar todo"). Estado `NEEDS_IMPLEMENTATION_APPROVAL`.

### QA Action Plan (Q1)

2026-10-14, senior-qa: implementación aprobada por el usuario ("Aprobar"). QA Action Plan redactado. Estado `NEEDS_QA_PLAN_APPROVAL`.

### QA (Q2, ronda 1)

2026-10-14, senior-qa: el usuario aprobó el QA Action Plan ("Aprobar"). Plan ejecutado: todos los criterios de aceptación pasan con evidencia local, con un defecto TRIVIAL (DEF-001). Las verificaciones del primer despliegue quedan pendientes. Estado `QA_APPROVED`.

### Commit y PR (T4)

2026-10-14, senior-fullstack:

- DEF-001 corregido: códigos 5 y 11 en `docs/despliegue.md` §10.
- CA-2 ajustado a 308 (redirección global de Traefik) más 301 (`https://www`), por decisión del usuario.
- `docs/despliegue.md` §1.6: creación de `traefik-public` y ufw con Traefik en modo host.
- Commit y PR.

PR https://github.com/orvigas/negocio/pull/43 (commit `5fafb82`). CI en verde:

- `calidad`: 8 min 30 s.
- `docker`: 2 min 13 s.
- `despliegue`: 3 min 29 s. La prueba de humo pasó todas sus comprobaciones en amd64.
- `publish` y `deploy`: omitidos en el PR.

SHA-256 de `deploy/`: `82c3e5ae4b8f99ea424f55291032ab81c550632240d4bffedd0168579ee21596`. Estado `READY_FOR_MERGE`.

### Cierre (T5)

2026-10-14, senior-fullstack:

- PR #43 mergeado (`05bd9e7`) y primer despliegue verificado (run 38527090517).
- CA-2 corregido a 301 en las tres variantes.
- CA-9 queda pendiente para el próximo par de merges seguidos.
- Ticket movido a `done/`. Estado `DONE`.

### Verificación de CA-9 (2026-10-14)

CA-9 verificado con dos merges seguidos: PR #50 (`fad5c4d`, REQ-F-020) y PR #51 (`9f62592`, REQ-F-019).

- El job `deploy` de `fad5c4d` (18:34:17Z → 18:34:27Z) no desplegó porque ya no era la cabeza de `main` y no aparece en `releases.log`.
- El de `9f62592` desplegó de 18:37:06Z a 18:37:33Z, sin solaparse con el anterior.
- Producción corre `9f62592` con la app healthy.
