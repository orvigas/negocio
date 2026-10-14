# Despliegue a producción en el VPS

Guía para preparar el VPS, desplegar automáticamente con cada merge a `main`, volver a una
versión anterior y restaurar la base de datos (REQ-F-016). Los detalles de la app están en el
[README](../README.md).

## Antes de empezar

### Qué se despliega

- **VPS:** Hostinger con Ubuntu 24.04, Docker y un **Traefik ya instalado** que sirve otros sitios
  en la red externa `traefik-public`. El proyecto vive en `/opt/restaurante`.
- **Servicios** (`deploy/compose.prod.yaml`, proyecto `restaurante`):
  - `app`: la imagen `production` (Koa). Sirve las dos landings, `/admin`, la API `/admin/api` y
    el webhook del bot. Una sola réplica, sin puertos publicados, en la red interna `db` y en
    `traefik-public`.
  - `mysql`: MySQL 8.4 (utf8mb4, `utf8mb4_es_0900_as_cs`), solo en la red interna `db`, con sus
    datos en el volumen `restaurante_mysql-data`.
  - `migrate`: proceso puntual que aplica las migraciones con un usuario con DDL.
- **Borde HTTPS:** Traefik.
  - `https://birriaelmuneco.com` sirve la app.
  - `http://` responde 308 hacia `https://` del mismo host (redirección global del Traefik del
    VPS; sin ella, el router del proyecto responde 301 a la raíz).
  - `https://www.` responde 301 a `https://birriaelmuneco.com`.
  - En los dos casos se conservan la ruta y la query.
  - `/admin` tiene un límite de 10 peticiones por minuto por IP, con ráfaga de 20; después
    responde 429.
  - Traefik no envía HSTS: lo envía la app.
- **Datos:**
  - los JSON de página y `changes.jsonl` viven en el volumen `restaurante_app-data`
    (`DATA_DIR=/var/lib/restaurante`);
  - los usuarios, la auditoría y los productos, en MySQL.
- **Estado en memoria:** sesiones de `/admin`, límite de intentos y conversaciones del bot. Cada
  despliegue reinicia la app: cierra las sesiones, corta las conversaciones y deja el sitio sin
  servicio unos 10 a 30 s.

### Cómo llega una versión a producción

1. Merge de un PR a `main`.
2. El CI (`.github/workflows/ci.yml`) ejecuta `calidad`, `docker` y `despliegue`.
3. Con las tres en verde, `publish` publica en GHCR (privado) dos imágenes, con la etiqueta
   `sha-<commit>`:
   - `ghcr.io/orvigas/restaurante`;
   - `ghcr.io/orvigas/restaurante-migrate`.
4. `deploy` se ejecuta en el environment `production`.
   - Solo hay un despliegue a la vez. Si mientras tanto llegó otro commit a `main`, este no se
     despliega: lo hará el siguiente.
   - Se conecta por SSH como `deploy` y ejecuta `deploy.sh` con el commit, los dos digests y la
     suma SHA-256 de `restaurante/deploy/`. La llave **solo** puede ejecutar ese script
     (comando forzado).
5. `deploy.sh` en el VPS:
   1. Comprueba los argumentos, que `.env` tenga permisos 600 y que el `deploy/` instalado sea el
      del commit (la suma).
   2. Descarga las imágenes por digest.
   3. Arranca MySQL si no está en marcha. En el primer arranque, crea la base y los usuarios.
   4. Hace un **volcado** en `/opt/restaurante/backups/` (gzip, permisos 600) y conserva los
      7 más recientes.
   5. **Migra.**
   6. Cambia la app al digest nuevo y espera `healthy`, más una respuesta 200 a través de
      Traefik.
   7. Registra el resultado en `state/release.env` y `state/releases.log`.
6. Ante un fallo:
   - si fallan la descarga, el volcado o la migración, la app en marcha no se toca y el workflow
     queda en rojo;
   - si la versión nueva no queda sana, `deploy.sh` vuelve al digest anterior con
     `DATABASE_ALLOW_NEWER_SCHEMA=true` y el workflow queda en rojo. La base **no** se restaura
     sola ([Restaurar la base](#9-restaurar-la-base-desde-un-volcado)).

> **Migraciones compatibles hacia atrás.** La vuelta atrás automática arranca el código anterior
> sobre la base ya migrada: añade antes de quitar (expand/contract). Una migración que rompa el
> código anterior obliga a restaurar el volcado a mano.

### Regla del bot en producción

En producción el bot usa **Meta** (WhatsApp Cloud API). Con `NODE_ENV=production` y
`WHATSAPP_BOT_PROVIDER=twilio` la app **no arranca**. Twilio es solo para desarrollo
([Entorno de desarrollo](desarrollo.md#8-bot-real-con-el-sandbox-de-twilio)).

## 1. Preparar el VPS (una vez)

Con tu usuario de administración (con `sudo`), no con `deploy`.

### 1.1 Usuario `deploy`

Usuario dedicado, sin contraseña ni `sudo`, en el grupo `docker`.

> **Riesgo aceptado:** el grupo `docker` equivale a root. Por eso la llave del workflow solo
> puede ejecutar `deploy.sh`.

```sh
sudo adduser --disabled-password --gecos '' deploy
sudo usermod -aG docker deploy
sudo -l -U deploy          # debe decir que no puede ejecutar sudo
```

### 1.2 Carpetas

```sh
sudo install -d -o root -g root -m 755 /opt/restaurante /opt/restaurante/deploy /opt/restaurante/deploy/mysql /opt/restaurante/deploy/mysql/initdb
sudo install -d -o deploy -g deploy -m 700 /opt/restaurante/state /opt/restaurante/backups
```

| Ruta | Dueño | Contenido |
| ---- | ----- | --------- |
| `/opt/restaurante/deploy/` | root (solo lectura para `deploy`) | `compose.prod.yaml`, `deploy.sh`, `mysql/initdb/01-usuarios.sh` |
| `/opt/restaurante/.env` | deploy, `600` | Secretos y configuración ([paso 3](#3-env-del-vps)) |
| `/opt/restaurante/state/` | deploy, `700` | `release.env` (digests actuales), `release.env.previous`, `releases.log`, `deploy.lock` |
| `/opt/restaurante/backups/` | deploy, `700` | Volcados `AAAAMMDDTHHMMSSZ-<commit>.sql.gz` (los 7 últimos) |

### 1.3 Instalar `deploy/`

Instala los archivos del commit que se va a desplegar. Repite este paso **siempre que cambie
`restaurante/deploy/`** en `main`, incluida cada variable nueva de la app, que se añade al
compose. Si el `deploy/` instalado no coincide con el del commit, el despliegue falla sin tocar
nada (código 4: "deploy/ instalado no coincide").

Desde tu máquina, en la raíz del repositorio, con el commit de `main` deseado:

```sh
scp -r restaurante/deploy <admin>@<vps>:/tmp/restaurante-deploy
```

En el VPS:

```sh
cd /tmp/restaurante-deploy
sudo install -o root -g root -m 755 deploy.sh /opt/restaurante/deploy/deploy.sh
sudo install -o root -g root -m 644 compose.prod.yaml /opt/restaurante/deploy/compose.prod.yaml
sudo install -o root -g root -m 755 mysql/initdb/01-usuarios.sh /opt/restaurante/deploy/mysql/initdb/01-usuarios.sh
cd /opt/restaurante/deploy && sha256sum compose.prod.yaml deploy.sh mysql/initdb/01-usuarios.sh | sha256sum
rm -rf /tmp/restaurante-deploy
```

La última suma debe coincidir con la misma orden ejecutada en `restaurante/deploy/` de tu copia
local.

### 1.4 Acceso a GHCR (solo lectura)

Las imágenes son privadas. Crea en GitHub un **token clásico** (los de grano fino no sirven para
el registro de contenedores) con **solo** el permiso `read:packages` y con fecha de caducidad.
Apunta esa fecha: al caducar, los despliegues fallan en la descarga sin tocar la app.

```sh
sudo -u deploy -H docker login ghcr.io -u orvigas    # pega el token cuando lo pida
```

### 1.5 Llave SSH del workflow

En tu máquina, genera una llave dedicada a este uso:

```sh
ssh-keygen -t ed25519 -N '' -C restaurante-deploy -f ~/.ssh/restaurante_deploy
```

En el VPS, autorízala **solo** para `deploy.sh`:

```sh
sudo install -d -o deploy -g deploy -m 700 /home/deploy/.ssh
echo 'restrict,command="/opt/restaurante/deploy/deploy.sh" ssh-ed25519 AAAA...(contenido de restaurante_deploy.pub) restaurante-deploy' \
  | sudo tee /home/deploy/.ssh/authorized_keys >/dev/null
sudo chown deploy:deploy /home/deploy/.ssh/authorized_keys && sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

Comprobación desde tu máquina:

```sh
ssh -i ~/.ssh/restaurante_deploy deploy@<vps> 'id'
```

Debe responder `uso: deploy <sha> ...` con código 2: la llave no abre una shell.

### 1.6 Traefik, DNS y firewall

- La red `traefik-public` debe existir (`docker network inspect traefik-public`). Si no existe, créala una vez:
  `docker network create traefik-public`. Con Traefik en `network_mode: host` (el caso del VPS), Traefik
  llega a los contenedores de esa red por su IP.
- Anota el certresolver y los entrypoints de Traefik (`docker inspect <contenedor de traefik>`
  o su archivo de configuración). Si no se llaman `letsencrypt`, `web` y `websecure`, ajústalos
  en el `.env`.
- Traefik debe tener el proveedor Docker. Con `exposedByDefault=false` funciona igual (la app
  declara `traefik.enable=true`).
- DNS: registros `A` (y `AAAA` si hay IPv6) de `birriaelmuneco.com` y `www.birriaelmuneco.com`
  hacia el VPS.
- Firewall: solo 80, 443 y el puerto SSH abiertos. El compose no publica puertos: ni 3000 ni 3306
  responden desde fuera. Con Traefik en modo host, ufw sí filtra 80 y 443: ábrelos (`sudo ufw allow 80,443/tcp`).
  Los puertos publicados por Docker, en cambio, se saltan ufw.

## 2. GitHub: environment `production` y secrets

Los secretos de la app **nunca** van a GitHub: solo los de despliegue.

```sh
gh api -X PUT repos/orvigas/negocio/environments/production      # crea el environment
gh secret set VPS_HOST --env production --body '<IP o nombre del VPS>'
gh secret set VPS_SSH_PORT --env production --body '22'
gh secret set VPS_SSH_USER --env production --body 'deploy'
gh secret set VPS_SSH_PRIVATE_KEY --env production < ~/.ssh/restaurante_deploy
ssh-keyscan -p 22 -t ed25519 <IP o nombre del VPS> > /tmp/restaurante_known_hosts
ssh-keygen -lf /tmp/restaurante_known_hosts     # compárala con: sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub (en el VPS)
gh secret set VPS_SSH_KNOWN_HOSTS --env production < /tmp/restaurante_known_hosts && rm /tmp/restaurante_known_hosts
```

- Con otro puerto SSH, usa el mismo valor en `VPS_SSH_PORT` y en `ssh-keyscan -p`.
- Si GitHub rechaza los secrets de environment por el plan del repositorio, créalos como secrets
  del repositorio con los mismos nombres (`gh secret set <NOMBRE> --body ...`, sin `--env`). El
  workflow los lee igual.

### Reglas de protección recomendadas

En **Settings → Environments → production**:

- **Deployment branches and tags:** "Selected branches and tags" con solo `main`.
- **Required reviewers** (opcional): exige aprobar cada despliegue.

Con un repositorio privado y el plan Free, GitHub no ofrece estas reglas. Mientras tanto, el
límite real lo pone el comando forzado de la llave: aunque alguien la robe, solo puede desplegar
imágenes de `ghcr.io/orvigas` con el `deploy/` que instalaste.

## 3. `.env` del VPS

Plantilla: `restaurante/deploy/env.production.example`. Cópiala al VPS:

```sh
sudo install -o deploy -g deploy -m 600 env.production.example /opt/restaurante/.env
sudo -u deploy -H nano /opt/restaurante/.env
```

- **Contraseñas de MySQL:** cada una con `openssl rand -hex 32`. Son obligatorias y deben ser
  hexadecimales. Solo se aplican al crear el volumen de MySQL: cambiarlas después exige también
  `ALTER USER` en MySQL.
- **App:** las mismas variables que describe [`.env.example`](../.env.example) (WhatsApp, bot de
  Meta, `SITE_URL=https://birriaelmuneco.com`, primer administrador).
  - El compose fija `NODE_ENV`, `HOST`, `PORT`, `TRUST_PROXY`, `DATA_DIR` y `DATABASE_URL`: no
    las pongas.
  - `ADMIN_PASSWORD_HASH` va entre comillas simples. Genéralo con `npm run admin:hash-password`
    en tu máquina.
- **Traefik:** `TRAEFIK_CERTRESOLVER`, `TRAEFIK_ENTRYPOINT_HTTP`, `TRAEFIK_ENTRYPOINT_HTTPS` y
  `RESTAURANTE_DOMAIN`. Cambiarlos no exige tocar el código (CA-11). Se aplican en el siguiente
  despliegue.
- **Nunca** definas `DATABASE_ALLOW_NEWER_SCHEMA`: `deploy.sh` se niega a desplegar si la
  encuentra.
- Guarda una copia del `.env` cifrada y fuera del VPS.

## 4. Primer despliegue

Con los pasos 1 a 3 hechos, haz merge a `main` (o vuelve a ejecutar el workflow del último push
a `main` desde **Actions**).

En el primer arranque:

- MySQL crea la base y los usuarios: `restaurante_app` (solo DML), `restaurante_migrator` (DDL)
  y `restaurante_backup` (solo lectura).
- `migrate` crea las tablas.
- La app copia las semillas, importa los productos y crea el primer administrador.

Si la app no queda sana en el primer despliegue, no hay versión anterior: el workflow queda en
rojo y la app se queda como esté ([Diagnóstico](#10-diagnóstico)).

### Verificación del primer despliegue (supuestos del ticket)

| Comprobación | Cómo |
| ------------ | ---- |
| CA-1: HTTPS y certificado | `curl -sI https://birriaelmuneco.com` → 200, certificado válido en el navegador, landing del día |
| CA-2: redirecciones | `curl -sI 'http://birriaelmuneco.com/molotes?a=1'` y `http://www.` → `308` hacia `https://` del mismo host (redirección global del entrypoint `web` del Traefik del VPS). `curl -sI 'https://www.birriaelmuneco.com/molotes?a=1'` → `301` con `Location: https://birriaelmuneco.com/molotes?a=1`. Así, `http://www.` llega a la raíz en dos saltos |
| CA-3: puertos cerrados | Desde fuera: `nc -vz <vps> 3000` y `nc -vz <vps> 3306` fallan |
| CA-4: límite de `/admin` | 30 peticiones seguidas a `https://birriaelmuneco.com/admin/login`: las últimas reciben 429; `/molotes` sigue en 200 |
| CA-5: IP real | En `docker logs restaurante-app-1`, la línea `request` lleva `"protocol":"https"` y tu IP pública, no una `172.x` de Docker. Si sale una `172.x`, Traefik no ve la IP de origen (proxy de Docker en IPv6, CDN delante): revisa la publicación de puertos de Traefik |
| CA-6 y CA-9 | Un merge despliega solo; dos merges seguidos se despliegan uno tras otro (Actions → `deploy`) |
| CA-10 | `stat -c '%a %U' /opt/restaurante/.env` → `600 deploy`; `sudo -l -U deploy` sin sudo |
| Traefik | Certresolver, entrypoints, versión y que no haya routers con el prefijo `restaurante` de otros sitios |
| Docker | `docker version` del Engine ≥ 25 (para `start_interval` del healthcheck) |

Después, registra el webhook en Meta ([paso 7](#7-registrar-el-webhook-en-meta)).

## 5. Operar a mano

Con tu usuario de administración. La llave del workflow no sirve para esto.

```sh
cd /opt/restaurante
C="sudo docker compose -f deploy/compose.prod.yaml --env-file .env --env-file state/release.env"
$C ps
$C logs --tail 100 app
tail state/releases.log                           # historial: commit, digests y resultado
ls -lt backups/                                    # volcados
```

- **Recuperar el acceso a `/admin`:**
  `$C exec app node scripts/admin-recover.ts --usuario <nombre>`
  ([Recuperar el acceso](../README.md#recuperar-el-acceso)).
- **Reiniciar la app:** `$C restart app`.
- **Recrear la app** (`$C up -d app`): usa los digests de `state/release.env`. Tras una vuelta
  atrás con la base más nueva, la app recreada sin `DATABASE_ALLOW_NEWER_SCHEMA=true` no
  arranca (`DATABASE_NEWER_THAN_CODE`). Antepón `DATABASE_ALLOW_NEWER_SCHEMA=true` al comando o,
  mejor, despliega una versión corregida.

## 6. Volver a una versión anterior a mano

La vuelta atrás automática solo cubre una versión nueva que no arranca. Para volver por otro
motivo:

- Haz un revert en `main`: se despliega solo, con volcado y migración.
- Si es urgente, en el VPS:
  1. Toma los digests de `state/release.env.previous` o de `state/releases.log`.
  2. Ejecuta:

     ```sh
     DATABASE_ALLOW_NEWER_SCHEMA=true RESTAURANTE_APP_IMAGE=ghcr.io/orvigas/restaurante@sha256:<digest> $C up -d --no-deps app
     ```

     `$C` incluye `state/release.env`, pero las variables del entorno tienen prioridad.
  3. El siguiente despliegue desde `main` deja todo como indica el CI.

## 7. Registrar el webhook en Meta

Con la app en marcha detrás de HTTPS:

1. En la app de Meta: **WhatsApp → Configuración → Webhook**.
2. URL de devolución de llamada: `https://birriaelmuneco.com/webhooks/whatsapp`. Token de
   verificación: el valor de `WHATSAPP_BOT_VERIFY_TOKEN`.
3. Suscribe el campo `messages`.

Detalles y prerrequisitos de Meta en
[Registrar el webhook en Meta](../README.md#registrar-el-webhook-en-meta-producción). Sin el bot,
las landings funcionan igual: deja vacías las `WHATSAPP_BOT_*`.

## 8. Comprobaciones después de cada despliegue

1. Actions → `deploy` en verde, con el commit y los digests en el resumen.
2. `https://birriaelmuneco.com/`, `/molotes` y `/birria` responden 200. `/admin` muestra el
   acceso, no un 503.
3. En el log: `server_started` y, con el bot, `bot_provider_selected` con `meta`. Vigila
   `bot_staff_delivery_failed` y `bot_webhook_signature_invalid`.

## 9. Restaurar la base desde un volcado

Hazlo cuando una migración quede a medias (`MIGRATION_INCOMPLETE`), cuando una migración no sea
compatible con el código anterior, o cuando se pierdan datos. **Se pierde todo lo escrito después
del volcado.** El volcado lleva `CREATE DATABASE` con utf8mb4 y `utf8mb4_es_0900_as_cs`.

```sh
cd /opt/restaurante
C="sudo docker compose -f deploy/compose.prod.yaml --env-file .env --env-file state/release.env"
ls -lt backups/                                    # elige el volcado (el nombre lleva fecha UTC y commit)
$C stop app
$C exec -T mysql sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "DROP DATABASE restaurante"'
gzip -dc backups/<archivo>.sql.gz | $C exec -T mysql sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" --default-character-set=utf8mb4'
```

1. Arranca la versión de la app que corresponde a ese volcado: el commit del nombre del archivo,
   con sus digests en `state/releases.log`.

   ```sh
   RESTAURANTE_APP_IMAGE=ghcr.io/orvigas/restaurante@sha256:<digest> $C up -d --no-deps app
   ```

2. Los permisos de los usuarios (`GRANT ... ON restaurante.*`) sobreviven al `DROP DATABASE`.
3. Comprueba `$C ps` (healthy) y el [paso 8](#8-comprobaciones-después-de-cada-despliegue).
4. Si el siguiente despliegue desde `main` vuelve a fallar en la migración, corrige la migración
   antes de volver a desplegar.

Los volcados solo existen en el VPS. Copias cifradas fuera del servidor y pruebas periódicas de
restauración: REQ-F-019.

## 10. Diagnóstico

| Síntoma (log del job `deploy`) | Causa probable | Qué hacer |
| ------------------------------ | -------------- | --------- |
| `Host key verification failed` / `Permission denied (publickey)` | Huella del VPS cambiada o llave revocada | Revisa `VPS_SSH_KNOWN_HOSTS` y `authorized_keys` (paso 1.5) |
| Código 2 `uso: deploy ...` | Argumentos inválidos (o se usó la llave a mano) | — |
| Código 3 (`.env`, `RESTAURANTE_*`) | `.env` sin permisos 600, con `DATABASE_ALLOW_NEWER_SCHEMA` o con dominio o registro inválidos | Corrige el `.env` |
| Código 4 `deploy/ instalado no coincide` | Cambió `restaurante/deploy/` en `main` | Reinstala `deploy/` (paso 1.3) y vuelve a ejecutar el job |
| Código 5 `otro despliegue sigue en curso` | Otro `deploy.sh` tiene el bloqueo hace más de 30 min | Revisa `state/releases.log` y los procesos `deploy.sh`; vuelve a ejecutar el job |
| Código 10 (descarga) | Token de GHCR caducado o sin `read:packages` | Nuevo token y `docker login` (paso 1.4) |
| Código 11 `MySQL no quedó healthy` | MySQL no arrancó (memoria, disco, volumen dañado) o el initdb falló en el primer arranque (contraseñas no hexadecimales) | `$C logs mysql`; la app no se tocó |
| Código 12 (volcado) | MySQL caído, disco lleno o usuario `restaurante_backup` | `$C logs mysql`, `df -h` |
| Código 13 (migración) | La migración falló; la app sigue con la versión anterior | Lee el error de Prisma en el log. Si quedó a medias, [restaura](#9-restaurar-la-base-desde-un-volcado) |
| Código 20 | Primer despliegue sin versión anterior y la app no arranca | `$C logs app`: suele ser el `.env` (`ConfigError` lista los problemas) |
| Código 21 | La versión nueva no arrancó; se volvió a la anterior | Corrige y vuelve a desplegar. La app anterior corre con `DATABASE_ALLOW_NEWER_SCHEMA=true` si hubo migración |
| Código 22 | Tampoco arrancó la versión anterior | [Restaura la base](#9-restaurar-la-base-desde-un-volcado) y arranca la versión del volcado |
| `/admin` responde 503 y `admin_requires_https` | La petición no llegó por HTTPS a través de Traefik | Revisa el entrypoint HTTPS y el certresolver |
| `/admin` responde 429 | Límite de Traefik (10 por minuto por IP, ráfaga de 20) | Espera un minuto. Cada guardado son 2 peticiones (POST y redirección) |
| `database_init_failed` | Base inalcanzable, credenciales, migraciones pendientes o base más nueva que el código | Según el código del log ([Base de datos](../README.md#base-de-datos)) |
