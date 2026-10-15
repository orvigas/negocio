# Despliegue a producción en el VPS

Guía para preparar el VPS, desplegar automáticamente con cada merge a `main`, volver a una
versión anterior y restaurar la base de datos (REQ-F-016), y para los respaldos cifrados fuera del
VPS (REQ-F-019). Los detalles de la app están en el [README](../README.md).

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
  - `http://` responde 301 hacia `https://` del mismo host (redirección global del Traefik del
    VPS; sin ella, el router del proyecto responde 301 directamente a la raíz).
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

1. El CI (`.github/workflows/ci.yml`) del PR ejecuta `calidad`, `docker`, `despliegue` y
   `auditoria`, y se hace merge a `main` con las cuatro en verde. En un PR de solo documentación
   (ver "Cuándo se ejecuta" en la sección CI del `README.md`) quedan omitidas.
2. En el push a `main`, si solo trae documentación, no se publica ni se despliega nada. Con
   cambios de código, el job `validado` comprueba si el contenido exacto del commit de `main` (su
   *tree*) es el que validó el CI del PR. Si lo es, no se repiten las validaciones. Si no lo es
   (`main` avanzó después del CI del PR, push directo) o no se puede decidir, las cuatro
   validaciones corren en el push y, si alguna falla, no se publica ni se despliega. Así, un PR
   desactualizado respecto a `main` ya no llega a producción sin validar ([Árbol ya
   validado](../README.md#árbol-ya-validado)).
3. `publish` publica en GHCR (privado) dos imágenes, con la etiqueta `sha-<commit>`:
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

Con los pasos 1 a 3 hechos, haz merge a `main` de un PR con cambios de código o lanza un
[redespliegue manual](#redesplegar-la-punta-de-main) (un push de solo documentación no publica
ni despliega).

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
| CA-2: redirecciones | `curl -sI 'http://birriaelmuneco.com/molotes?a=1'` y `http://www.` → `301` hacia `https://` del mismo host (redirección global del entrypoint `web` del Traefik del VPS). `curl -sI 'https://www.birriaelmuneco.com/molotes?a=1'` → `301` con `Location: https://birriaelmuneco.com/molotes?a=1`. Así, `http://www.` llega a la raíz en dos saltos |
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

### Redesplegar la punta de `main`

Para volver a publicar y desplegar lo que hay en `main` sin un commit nuevo (VPS restaurado,
despliegue fallido por un problema externo, primer despliegue): **Actions → CI → Run workflow**
con la rama `main`, o

```sh
gh workflow run ci.yml --ref main
```

Corre `calidad`, `docker`, `despliegue` y `auditoria`, y con las cuatro en verde, `publish` y
`deploy` del commit de la punta de `main` (con volcado y migración, como cualquier despliegue).
Sobre otra rama se rechaza (`cambios` falla y no corre nada más). Si mientras tanto llega otro
commit a `main`, no se despliega: lo hará el del commit nuevo.

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

Con el bot habilitado, `.env` también necesita `WHATSAPP_BOT_BLOCKLIST_KEY` (REQ-F-025): genérala
con `openssl rand -base64 32` y guárdala en el gestor de contraseñas. Sin ella la app no arranca.
Si el bot ya estaba activo cuando llega la versión que la exige, el orden es:

1. Añade la clave al `.env` del VPS.
2. Haz el merge; si el job `deploy` falla con el código 4 (`deploy/` cambió), reinstala `deploy/`
   (paso 1.3) y vuelve a ejecutar el job.

Los umbrales de los topes (`BOT_LIMIT_*`, `BOT_BUDGET_MONTH_USD`...) son opcionales: vacíos usan los
valores por defecto (ver `README.md`, "Topes de gasto, lista negra e interruptor").

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

Estos volcados solo existen en el VPS. Las copias cifradas diarias fuera del servidor, la
restauración desde ellas y la prueba mensual están en el [paso 11](#11-respaldos-fuera-del-vps).

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

## 11. Respaldos fuera del VPS

REQ-F-019. Objetivo: perder como mucho 24 h de datos (RPO) y recuperar el servicio en 2 h o menos
(RTO).

### 11.1 Qué hace

- **Cuándo:** cada día a las 03:00 de `America/Mexico_City` (`restaurante-backup.timer`; el host
  está en UTC). Si el VPS estaba apagado a esa hora, se ejecuta al arrancar.
- **Qué guarda:**
  - un `mysqldump` de `restaurante` hecho con el usuario de solo lectura `restaurante_backup`;
  - el volumen `restaurante_app-data` completo, sin los temporales;
  - un manifiesto con los conteos de `user` y `product`, la última migración, las imágenes y el
    commit de `state/release.env`, y las sumas sha256.
- **Integridad:** un volcado incompleto o dañado (o un `app-data` sin `molotes/` y `birria/`) no se
  cifra ni se sube.
- **Cifrado:** con `age`, usando solo las claves públicas de `/etc/restaurante-backup/recipients.txt`.
  La clave privada nunca está en el VPS.
- **Destino:** Cloudflare R2.
  - `daily/` recibe el respaldo todos los días; `weekly/`, también los domingos; y `monthly/`,
    también el día 1 (fecha de México).
  - Nunca sobrescribe: sube con `If-None-Match: *` y los bucket locks lo impiden.
- **Copia local:** en `/opt/restaurante/offsite/` (`deploy`, `700`; archivos `600`) quedan los 7
  últimos respaldos cifrados. Si la subida falla, la copia se marca como pendiente y se reintenta en
  la siguiente ejecución.
- **Aviso:** Healthchecks.io recibe un ping al empezar, al terminar bien y al fallar (con el
  código). Si no llega ningún ping a tiempo, avisa por correo.
- **`.env`:** `restaurante-env-backup.path` vigila `/opt/restaurante/.env`. Al cambiar, sube una
  copia cifrada a `env/`. El respaldo diario repite la comprobación.
- **Convivencia con `deploy.sh`:** comparten el candado `state/deploy.lock`. El respaldo lo
  mantiene solo durante el volcado (segundos) y espera hasta 30 min si hay un despliegue en curso.
- **Huella SHA-256:** los scripts viven en `restaurante/ops/backup/` y se instalan en
  `/opt/restaurante/ops/backup/`, fuera de `deploy/`. Instalarlos no cambia su suma SHA-256.

| Ruta en el VPS | Dueño | Contenido |
| -------------- | ----- | --------- |
| `/opt/restaurante/ops/backup/` | root, `755` | `lib.sh`, `backup.sh`, `env-backup.sh`, `restore.sh` |
| `/etc/systemd/system/restaurante-*` | root, `644` | Las cuatro unidades de systemd |
| `/etc/restaurante-backup/backup.env` | root:deploy, `640` | Credencial de R2 del VPS y URL de ping (plantilla: `ops/backup/backup.env.example`) |
| `/etc/restaurante-backup/recipients.txt` | root, `644` | Claves públicas de `age` (`age1...`), una por línea |
| `/opt/restaurante/offsite/` | deploy, `700` | Los 7 últimos respaldos cifrados, `env.sha256` y las marcas `.pending` |

Códigos de salida de `backup.sh`:

| Código | Significado |
| ------ | ----------- |
| 2 | Configuración inválida |
| 3 | Precondición: disco lleno, sin `release.env`, MySQL parado |
| 4 | Un despliegue siguió en curso 30 min |
| 5 | Falló el volcado o la lectura de `app-data` |
| 6 | Integridad |
| 7 | Cifrado |
| 8 | Subida; la copia local queda pendiente |
| 9 | Copia del `.env` |

### 11.2 Preparar Cloudflare R2 (una vez)

Fuentes: [bucket locks](https://developers.cloudflare.com/r2/buckets/bucket-locks/),
[ciclo de vida](https://developers.cloudflare.com/r2/buckets/object-lifecycles/) y
[tokens](https://developers.cloudflare.com/r2/api/tokens/).

R2 no tiene versionado S3. Además, un token `Object Read & Write` puede borrar y sobrescribir.
Por eso la protección la dan los **bucket locks**, que el token del VPS no puede quitar:

- impiden borrar y sobrescribir los objetos de cada prefijo durante el plazo;
- prevalecen sobre el ciclo de vida.

1. Activa R2 en el panel de Cloudflare y anota el **Account ID**.
2. Crea el bucket `restaurante-respaldos`: ubicación automática, sin jurisdicción y sin acceso
   público ni dominio.
3. En **Settings → Bucket lock rules**, añade estas reglas. Ninguna regla puede ir sin prefijo ni
   durar más que su expiración, porque impediría la retención.
4. En **Settings → Object Lifecycle Rules**, añade las expiraciones de la misma tabla. El bloqueo dura
   un día menos que la expiración: así el ciclo de vida puede borrar en cuanto vence el bloqueo.

   | Prefijo | Bucket lock (edad) | Expiración | Quedan |
   | ------- | ------------------ | ---------- | ------ |
   | `daily/` | 7 días | 8 días | 7 u 8 diarios |
   | `weekly/` | 28 días | 29 días | 4 o 5 semanales |
   | `monthly/` | 180 días | 186 días | 6 o 7 mensuales |
   | `env/` | 180 días | 365 días | Copias del `.env` de un año |

   Si el VPS queda comprometido, solo puede borrar objetos con el bloqueo ya vencido: los mínimos
   7, 4 y 6 sobreviven.
5. En **Manage API Tokens**, crea dos **Account API tokens** limitados a ese bucket y guarda en el
   gestor de contraseñas el Access Key ID y el Secret Access Key de cada uno:
   - **VPS:** `Object Read & Write`.
   - **Mac:** `Object Read only`. Nunca va al VPS.

### 11.3 Claves de `age` (una vez, en tu Mac)

```sh
brew install age
age-keygen -o restaurante-backup.key     # imprime "Public key: age1..."
```

1. Guarda el contenido **completo** de `restaurante-backup.key` en el gestor de contraseñas.
   Contiene la línea `AGE-SECRET-KEY-1...`, que es lo que te piden la restauración y la prueba
   mensual.
2. Copia solo la clave pública (`age1...`) para el VPS.
3. Borra el archivo con `rm -P restaurante-backup.key`.

Si se pierde la clave privada, **todos los respaldos quedan inútiles**. Para que una segunda persona
también pueda descifrar, añade su clave pública como otra línea de `recipients.txt`. Los respaldos
siguientes se cifran para las dos; los anteriores no.

### 11.4 Healthchecks.io (una vez)

1. Crea un check **"respaldo diario"**:
   - Schedule: Cron `0 3 * * *`;
   - zona horaria: `America/Mexico_City`;
   - gracia: 2 h;
   - integración de correo activa.

   Su URL de ping (`https://hc-ping.com/...`) va en `HC_PING_URL` del VPS. Es un secreto: con ella
   se pueden enviar pings falsos.
2. Crea un check **"prueba mensual"**:
   - Schedule: Cron `0 12 1 * *`;
   - gracia: 7 días.

   Su URL va en `HC_PING_URL` de la configuración del Mac. Si un mes no haces la prueba, avisa.

### 11.5 Instalar en el VPS

Desde tu máquina, en la raíz del repositorio, con el commit de `main` deseado:

```sh
scp -r restaurante/ops/backup <admin>@<vps>:/tmp/restaurante-backup
```

En el VPS, con tu usuario de administración:

```sh
sudo apt-get install -y age
sudo install -d -o root -g root -m 755 /opt/restaurante/ops /opt/restaurante/ops/backup
sudo install -d -o deploy -g deploy -m 700 /opt/restaurante/offsite
sudo install -d -o root -g deploy -m 750 /etc/restaurante-backup
cd /tmp/restaurante-backup
sudo install -o root -g root -m 755 lib.sh backup.sh env-backup.sh restore.sh /opt/restaurante/ops/backup/
sudo install -o root -g root -m 644 systemd/restaurante-backup.service systemd/restaurante-backup.timer \
  systemd/restaurante-env-backup.service systemd/restaurante-env-backup.path /etc/systemd/system/
sudo install -o root -g deploy -m 640 backup.env.example /etc/restaurante-backup/backup.env
sudo nano /etc/restaurante-backup/backup.env      # R2_ACCOUNT_ID, R2_*_KEY del token del VPS, HC_PING_URL
echo 'age1...' | sudo tee /etc/restaurante-backup/recipients.txt >/dev/null
sudo chmod 644 /etc/restaurante-backup/recipients.txt
sudo systemctl daemon-reload
sudo systemctl start restaurante-backup.service    # primer respaldo, a mano
sudo journalctl -u restaurante-backup.service -n 40 --no-pager
sudo systemctl enable --now restaurante-backup.timer restaurante-env-backup.path
systemctl list-timers restaurante-backup.timer     # próxima ejecución: 09:00 UTC
rm -rf /tmp/restaurante-backup
```

Para actualizar los scripts, repite `scp` y los `install`, y después `daemon-reload`. Nada de esto
toca `deploy/`: la suma de `cd /opt/restaurante/deploy && sha256sum compose.prod.yaml deploy.sh
mysql/initdb/01-usuarios.sh | sha256sum` no cambia.

### 11.6 Verificar la instalación

Haz estas comprobaciones una vez y anota el resultado en el ticket.

1. **Respaldo en R2 y ping de éxito.** Tras el primer respaldo, el panel de R2 muestra
   `daily/restaurante-<fecha>.tar.age` y Healthchecks muestra el ping. Al día siguiente, lo mismo
   a las 03:00 de México.
2. **Aviso si falta un respaldo.** `sudo systemctl stop restaurante-backup.timer` y espera a que
   venza la gracia: Healthchecks envía el correo. Después, `sudo systemctl start
   restaurante-backup.timer`.
3. **La credencial del VPS no puede borrar ni sobrescribir.** Las dos peticiones deben responder
   un código 4xx, y el respaldo debe seguir intacto en el panel:

   ```sh
   sudo -u deploy bash -c '
     . /opt/restaurante/ops/backup/lib.sh
     load_config /etc/restaurante-backup/backup.env required
     k=$(s3_list daily/ | head -n 1)
     echo "objeto: $k"
     curl -sS -o /dev/null -w "DELETE %{http_code}\n" -X DELETE -K <(s3_config) "$(s3_url "$k")"
     f=$(mktemp); echo prueba >"$f"
     curl -sS -o /dev/null -w "PUT %{http_code}\n" -K <(s3_config) \
       -H "x-amz-content-sha256: $(sha256_of "$f")" -T "$f" "$(s3_url "$k")"
     rm -f "$f"'
   ```

4. **Sin clave privada en el VPS.** `sudo grep -rl AGE-SECRET-KEY- /etc/restaurante-backup
   /opt/restaurante/offsite /opt/restaurante/.env` no imprime nada. `ls -l
   /opt/restaurante/offsite` muestra como mucho 7 respaldos, todos `-rw-------`.
5. **`.env`.** Añade una línea de comentario a `/opt/restaurante/.env` (como `deploy`): en
   `env/` aparece una copia nueva (`journalctl -u restaurante-env-backup.service`).
6. **Retención.** Las reglas de 11.2 están en el panel del bucket.
7. **`deploy/` intacto.** El siguiente despliegue desde `main` pasa sin reinstalar `deploy/`.

### 11.7 Restaurar (runbook)

Hazlo cuando se pierdan datos, cuando una migración quede a medias o cuando haya que levantar un VPS
nuevo. **Se pierde todo lo escrito después del respaldo.**

`restore.sh` hace lo siguiente:

1. Toma el candado de `deploy.sh`.
2. Descarga el respaldo y pide la clave privada sin eco; la clave no se guarda en ningún sitio.
3. Comprueba las sumas.
4. Pide que escribas `restaurante` para confirmar.
5. Para la app y recarga la base como root (`DROP DATABASE` y el volcado).
6. Vacía y restaura `app-data`.
7. Arranca **la imagen de la app del respaldo** y espera a que esté `healthy`.
8. Actualiza `state/release.env` y anota la restauración en `state/releases.log`.

Al terminar imprime la duración de cada fase y el tiempo sin servicio.

```sh
sudo -u deploy /opt/restaurante/ops/backup/restore.sh latest                 # último de daily/
sudo -u deploy /opt/restaurante/ops/backup/restore.sh monthly/restaurante-20261101T090000Z.tar.age
sudo -u deploy /opt/restaurante/ops/backup/restore.sh /opt/restaurante/offsite/restaurante-<fecha>.tar.age
```

Después, haz las comprobaciones del [paso 8](#8-comprobaciones-después-de-cada-despliegue).

**Casos:**

- **Migración a medias (`MIGRATION_INCOMPLETE`) justo tras un despliegue:** usa primero el volcado
  previo de `deploy.sh` ([paso 9](#9-restaurar-la-base-desde-un-volcado)), que es más reciente. Solo
  si no sirve, usa el último respaldo de R2.
- **El respaldo es más viejo que el código (`MIGRATIONS_PENDING`):** no pasa con `restore.sh`,
  porque arranca la imagen del respaldo. El siguiente despliegue desde `main` aplica las
  migraciones pendientes con su volcado previo.
- **`DATABASE_NEWER_THAN_CODE`:** la base tiene migraciones que la imagen arrancada no conoce, por
  ejemplo si se arrancó a mano una imagen anterior. Arranca la imagen del respaldo (la que imprime
  `restore.sh`, también en `state/release.env`). `DATABASE_ALLOW_NEWER_SCHEMA=true` solo se usa
  como en la vuelta atrás de `deploy.sh`, nunca en el `.env`.
- **VPS nuevo:**
  1. Prepara el VPS con los pasos 1.1 a 1.6, instala `deploy/` y la sección 11.5 sin activar el
     timer.
  2. Recupera el `.env` desde tu Mac. Con la credencial de solo lectura, descarga el último objeto
     de `env/` y descífralo con `age -d -i <archivo con la clave> -o .env <copia>.env.age`.
  3. Copia el `.env` a `/opt/restaurante/.env` (`deploy`, `600`).
  4. Haz `docker login ghcr.io` como `deploy` (paso 1.4) y ejecuta `restore.sh latest`. Crea
     MySQL, la base y los usuarios, y después restaura.
  5. Activa el timer.

### 11.8 Prueba mensual y simulacro (en tu Mac)

Una vez al mes, desde la raíz del repositorio, en tu Mac. Necesitas Docker Desktop, `age` y
`docker login ghcr.io` con un token de lectura (`read:packages`).

Configuración, una vez:

```sh
mkdir -p ~/.config/restaurante-backup && chmod 700 ~/.config/restaurante-backup
cp restaurante/ops/backup/backup.env.example ~/.config/restaurante-backup/r2-readonly.conf
chmod 600 ~/.config/restaurante-backup/r2-readonly.conf
# Edita: R2_ACCOUNT_ID, R2_BUCKET, las claves del token "Object Read only" y HC_PING_URL del check
# "prueba mensual". Borra BACKUP_MIN_FREE_MB (no se usa aquí).
```

Prueba:

```sh
restaurante/ops/backup/verify-backup.sh --drill
```

1. Descarga el último respaldo de `daily/`, pide la clave privada y lo descifra.
2. Comprueba las sumas.
3. Carga el volcado en un MySQL 8.4 efímero (el mismo digest de producción, sin puertos
   publicados).
4. Compara los conteos de `user` y `product` y la última migración con el manifiesto, es decir,
   con producción en el momento del respaldo. Si `counts_stable=false`, hubo escrituras durante el
   volcado y una diferencia en los conteos solo es un aviso.
5. Comprueba los JSON de `molotes/` y `birria/`.
6. Con `--drill`, arranca además la imagen de la app del respaldo con esa base y ese `app-data`, y
   espera a que responda.

Al terminar:

- borra todo lo efímero;
- añade una línea a `~/.config/restaurante-backup/pruebas.log` (fecha, respaldo, conteos, migración,
  duración y resultado);
- envía el ping al check mensual (éxito o fallo).

La duración del simulacro (`duracion=`) es el tiempo de una restauración completa sin la parada de
producción. Debe quedar dentro del RTO de 2 h. La imagen de la app es `linux/amd64`, así que en un
Mac con Apple Silicon corre emulada y tarda más.

### 11.9 Operación

| Tarea | Comando |
| ----- | ------- |
| Estado y próxima ejecución | `systemctl list-timers restaurante-backup.timer` |
| Log del último respaldo | `sudo journalctl -u restaurante-backup.service -n 60 --no-pager` |
| Respaldo a mano | `sudo systemctl start restaurante-backup.service` |
| Copias locales | `sudo ls -l /opt/restaurante/offsite` |
| Suspender los respaldos | `sudo systemctl disable --now restaurante-backup.timer restaurante-env-backup.path` |

Los logs nunca muestran credenciales, la URL de ping, contraseñas ni el contenido del `.env`.
