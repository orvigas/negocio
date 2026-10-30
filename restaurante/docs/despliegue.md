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
    `traefik-public`. Se construye desde el workspace `restaurante/landing-pages/` del monorepo
    (REQ-F-036), que incluye los paquetes `restaurante/packages/core` y `packages/db` (REQ-F-037),
    con el contexto de build en `restaurante/`. Dentro de la imagen, la app está en
    `/app/landing-pages`, que es su directorio de trabajo: los comandos relativos de esta guía
    (`node scripts/admin-recover.ts`) valen para las imágenes de antes y de después del monorepo,
    así que la vuelta atrás no cambia.
  - `api` (REQ-F-038 y REQ-F-039): la imagen `api`, la API propia.
    - `GET /api/v1/public/{molotes|birria}/productos`: de aquí las landings de `app` leen los
      productos (`API_INTERNAL_URL=http://api:3001`).
    - `/api/v1/admin`: la administración de productos que usa `inventory-manager`. Desde REQ-F-039
      es la única que escribe los productos.
    - Tras cada escritura avisa a `app` por su puerto interno 3002 (`LANDING_INTERNAL_URL`, con la
      credencial `RESTAURANTE_INTERNAL_NOTIFY_TOKEN`), para que la landing y el bot muestren el cambio
      al instante.
    - Solo en las redes internas `db` (con `app` y MySQL) y `admin` (con `inventory-manager`): sin
      puertos publicados ni router de Traefik, así que nada fuera de Docker la alcanza (desviación D-3
      de REQ-F-039).
    - Usa el mismo usuario solo DML que la app; nunca migra ni importa semillas. Si se cae, las
      landings siguen respondiendo con su última copia buena (o la semilla, si `app` arrancó sin ella).
  - `inventory-manager` (REQ-F-039): la imagen `inventory-manager`, el admin nuevo (Koa con SSR) en
    `https://admin.birriaelmuneco.com`.
    - Gestiona los productos, los usuarios y "Mi cuenta" (REQ-F-040) llamando a `api` por la red
      interna `admin`.
    - Está en `traefik-public` y en `admin`: no alcanza MySQL y no tiene credenciales de la base ni
      la del aviso.
    - Con él desplegado, la edición de productos, la gestión de usuarios y "Mi cuenta" del `/admin`
      actual quedan en solo lectura (`ADMIN_NEW_URL`) y enlazan al admin nuevo. Bot y menú siguen en
      `/admin` hasta los tickets siguientes del paso 4.
    - **Aviso al personal (R-3 de REQ-F-040):** desde ese despliegue, las contraseñas se cambian en
      "Mi cuenta" de `https://admin.birriaelmuneco.com` (mismo usuario y contraseña), y las altas y
      cambios de usuarios, en "Usuarios" del admin nuevo. `npm run admin:recover` sigue igual.
  - `mysql`: MySQL 8.4 (utf8mb4, `utf8mb4_es_0900_as_cs`), solo en la red interna `db`, con sus
    datos en el volumen `restaurante_mysql-data`.
  - `migrate`: proceso puntual que aplica las migraciones con un usuario con DDL.
- **Borde HTTPS:** Traefik.
  - `https://birriaelmuneco.com` sirve la app.
  - `http://` responde 301 hacia `https://` del mismo host (redirección global del Traefik del
    VPS; sin ella, el router del proyecto responde 301 directamente a la raíz).
  - `https://www.` responde 301 a `https://birriaelmuneco.com`.
  - En los dos casos se conservan la ruta y la query.
  - Esos 301 son los de una petición GET (la de los navegadores). Con HEAD (`curl -I`), Traefik
    responde 308 a las mismas redirecciones: compruébalas con GET ([verificación](#verificación-del-primer-despliegue-supuestos-del-ticket)).
  - `/admin` tiene un límite de 10 peticiones por minuto por IP, con ráfaga de 20; después
    responde 429.
  - `https://admin.birriaelmuneco.com` sirve `inventory-manager` (REQ-F-039), con su propio
    certificado del certresolver y su propio límite: 60 peticiones por minuto por IP, con ráfaga de
    60. `http://admin.` responde 301 a `https://` conservando la ruta y la query.
  - Traefik no envía HSTS: lo envía la app.
- **Datos:**
  - los JSON de página y `changes.jsonl` viven en el volumen `restaurante_app-data`
    (`DATA_DIR=/var/lib/restaurante`);
  - los usuarios, la auditoría y los productos, en MySQL.
- **Estado en memoria:** sesiones de `/admin`, límite de intentos y conversaciones del bot, en
  `app`; sesiones del admin nuevo, su límite de intentos y las claves de idempotencia, en `api`.
  Cada despliegue reinicia los contenedores: cierra las sesiones, corta las conversaciones y deja el
  sitio sin servicio unos 10 a 30 s.

### Cómo llega una versión a producción

1. El CI (`.github/workflows/ci.yml`) del PR ejecuta `calidad`, `docker` (imágenes y pruebas de
   humo del despliegue y de los respaldos) y `auditoria`, y se hace merge a `main` con las tres en
   verde. En un PR de solo documentación o en borrador (ver "Cuándo se ejecuta" en la sección CI
   del `README.md`) quedan omitidas.
2. En el push a `main`, si solo trae documentación, no se publica ni se despliega nada. Con
   cambios de código, el job `validado` comprueba si el contenido exacto del commit de `main` (su
   *tree*) es el que validó el CI del PR. Si lo es, no se repiten las validaciones. Si no lo es
   (`main` avanzó después del CI del PR, push directo) o no se puede decidir, las tres
   validaciones corren en el push y, si alguna falla, no se publica ni se despliega. Así, un PR
   desactualizado respecto a `main` ya no llega a producción sin validar ([Árbol ya
   validado](../README.md#árbol-ya-validado)).
3. `publish` publica en GHCR (privado) cuatro imágenes, con la etiqueta `sha-<commit>`:
   - `ghcr.io/orvigas/restaurante`;
   - `ghcr.io/orvigas/restaurante-migrate`;
   - `ghcr.io/orvigas/restaurante-api` (REQ-F-038);
   - `ghcr.io/orvigas/restaurante-inventory-manager` (REQ-F-039).
4. `vigente` comprueba que el commit siga siendo la punta de `main`. Si mientras tanto llegó otro
   commit, este no se despliega (lo hará el siguiente): su resumen dice **Omitido** y `deploy`
   queda omitido, sin registro en Deployments.
5. `deploy` se ejecuta en el environment `production`.
   - Solo hay un despliegue a la vez. Justo antes del SSH vuelve a comprobar la punta de `main`:
     si avanzó mientras esperaba, el job falla sin tocar el VPS (resumen **Omitido**).
   - Se conecta por SSH como `deploy` y ejecuta `deploy.sh` con el commit, los cuatro digests (app,
     migrate, api e inventory-manager) y la
     suma SHA-256 de `restaurante/deploy/`. La llave **solo** puede ejecutar ese script
     (comando forzado).
6. `deploy.sh` en el VPS:
   1. Comprueba los argumentos, que `.env` tenga permisos 600, `RESTAURANTE_ADMIN_DOMAIN` y una
      `RESTAURANTE_INTERNAL_NOTIFY_TOKEN` de 32 caracteres como mínimo (código 3), y que el `deploy/`
      instalado sea el del commit (la suma).
   2. Descarga las imágenes por digest.
   3. Arranca MySQL si no está en marcha. En el primer arranque, crea la base y los usuarios.
   4. Hace un **volcado** en `/opt/restaurante/backups/` (gzip, permisos 600) y conserva los
      7 más recientes.
   5. **Migra.**
   6. Cambia la `api` al digest nuevo y espera `healthy` (REQ-F-038). Si no lo queda, vuelve a la
      `api` anterior (si la hay; si `state/release.env` no la registra, por ejemplo tras una
      restauración, toma la del contenedor `api` en marcha) y termina con el código 15:
      - si este despliegue **no** aplicó migraciones, la app no se toca;
      - si **sí** las aplicó, la app en marcha se recrea con su misma imagen y
        `DATABASE_ALLOW_NEWER_SCHEMA=true` (unos segundos sin servicio), como en la vuelta atrás.
        Sin la bandera, la app no podría volver a arrancar sobre la base migrada si se reiniciara
        (`DATABASE_NEWER_THAN_CODE`) antes del siguiente despliegue correcto. Si la app recreada no
        queda sana, termina con 22.
   7. Cambia `inventory-manager` al digest nuevo y espera `healthy`, más una respuesta 200 de
      `https://admin.<dominio>/salud` a través de Traefik (por `RESTAURANTE_PROBE_ADDRESS`, sin
      depender del DNS). Va **antes** que la app porque la app nueva activa el modo de solo lectura
      de los productos de `/admin`. Si no queda sano, vuelve al `inventory-manager` anterior (o lo
      detiene si no lo había), deja la app como estaba (con la misma protección de las migraciones
      nuevas que el punto 6) y la `api` nueva, y termina con el **código 16**.
   8. Cambia la app al digest nuevo y espera `healthy`, más una respuesta 200 a través de
      Traefik.
   9. Registra el resultado (las cuatro imágenes) en `state/release.env` y `state/releases.log`.
7. Ante un fallo:
   - si fallan la descarga, el volcado o la migración, la app en marcha no se toca y el workflow
     queda en rojo;
   - si la versión nueva no queda sana, `deploy.sh` vuelve a los digests anteriores de la app y
     de la `api` (si había una api anterior; en el primer despliegue con api se queda la nueva) con
     `DATABASE_ALLOW_NEWER_SCHEMA=true`, y `inventory-manager` vuelve al anterior o se detiene si
     no lo había (para que no quede junto a una app que todavía edita productos); el workflow queda
     en rojo. La base **no** se restaura
     sola ([Restaurar la base](#9-restaurar-la-base-desde-un-volcado)).
8. `deploy` escribe siempre un resumen en la ejecución (REQ-F-030): **Desplegado**,
   **Revertido** (código 21), **Fallido** (con el código), **Omitido** o **Cancelado o
   interrumpido**, con el SHA corto enlazado al commit y el SHA completo. Solo **Desplegado** deja
   el job en verde y es un despliegue exitoso en Deployments.

### Qué commit está desplegado

- **Desde GitHub:** la última ejecución del CI con el resumen **Desplegado** en `deploy`. El título
  de cada ejecución lleva su commit (en un push, el SHA corto aparece debajo del mensaje) y el
  resumen, el SHA corto enlazado, el SHA completo y los digests. Qué significa cada estado:
  sección CI del `README.md`, ["Qué se desplegó"](../README.md#qué-se-desplegó).
- **En el VPS:** `state/release.env` guarda los digests y el commit desplegado
  (`RESTAURANTE_COMMIT`); `state/releases.log`, el historial de intentos. Tras **Revertido**, el
  resumen no puede dar el commit anterior: está en `state/release.env`, que no cambia en una vuelta
  atrás.

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
| `/opt/restaurante/state/` | deploy, `700` | `release.env` (digests y commit desplegados: `RESTAURANTE_COMMIT`), `release.env.previous`, `releases.log`, `deploy.lock` |
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

**Al llegar a `main` el admin nuevo (REQ-F-039)** (aplicado el 2026-10-29 con el #105; se conserva
como referencia): `compose.prod.yaml` (servicio
`inventory-manager`, red `admin`, variables nuevas de `app` y `api`) y `deploy.sh` (cuatro digests,
código 16) cambian, así que su suma cambia. Antes del primer despliegue de ese commit, en este
orden:

1. Crea el registro DNS de `admin.birriaelmuneco.com` ([paso 1.6](#16-traefik-dns-y-firewall)).
2. Añade `RESTAURANTE_ADMIN_DOMAIN` y `RESTAURANTE_INTERNAL_NOTIFY_TOKEN` al `.env`
   ([paso 3](#3-env-del-vps)).
3. Da al token de GHCR acceso a `restaurante-inventory-manager` ([paso 1.4](#14-acceso-a-ghcr-solo-lectura)).
4. Reinstala `deploy/` con este paso: con el `deploy/` anterior, `deploy.sh` recibe 7 argumentos en
   lugar de 6 y termina con el código 2 sin tocar nada.
5. Los scripts de respaldos **del VPS** ([paso 11.5](#115-instalar-en-el-vps): `lib.sh`,
   `backup.sh`, `env-backup.sh`, `restore.sh` y las unidades de systemd) no cambian con REQ-F-039:
   no hace falta reinstalarlos. Solo cambia `verify-backup.sh`, que pasa ahora la credencial del
   aviso, obligatoria en producción, a la app que verifica; se ejecuta en tu máquina
   ([paso 11.8](#118-prueba-mensual-y-simulacro-en-tu-mac)), así que basta con actualizar tu copia
   local del repositorio.

Después del despliegue, la edición de productos se hace en `https://admin.birriaelmuneco.com`: el
`/admin` anterior la muestra en solo lectura con un enlace al admin nuevo.

**Al llegar a `main` la épica de arquitectura (REQ-F-038)** (aplicado el 2026-10-29 con el #105;
se conserva como referencia): `compose.prod.yaml` (servicio `api` y
`API_INTERNAL_URL` de la app) y `deploy.sh` (tres digests) cambian, así que su suma cambia.
Reinstala `deploy/` con este paso **antes** del primer despliegue de ese commit: con el `deploy/`
anterior, `deploy.sh` recibe 6 argumentos en lugar de 5 y termina con el código 2 sin tocar nada,
y con el nuevo instalado pero el workflow anterior también (rechaza la forma de 2 digests). El
token de GHCR del paso 1.4 debe poder leer también `ghcr.io/orvigas/restaurante-api` (con
`read:packages` basta si el paquete pertenece a la misma cuenta).

### 1.4 Acceso a GHCR (solo lectura)

Las imágenes son privadas. Crea en GitHub un **token clásico** (los de grano fino no sirven para
el registro de contenedores) con **solo** el permiso `read:packages` y con fecha de caducidad.
Apunta esa fecha: al caducar, los despliegues fallan en la descarga sin tocar la app.

```sh
sudo -u deploy -H docker login ghcr.io -u orvigas    # pega el token cuando lo pida
```

**Al llegar a `main` el admin nuevo (REQ-F-039)** (aplicado el 2026-10-29 con el #105; se conserva
como referencia): el token debe poder leer también
`ghcr.io/orvigas/restaurante-inventory-manager`. Comprueba en GitHub (Packages) que el paquete
pertenece a la misma cuenta o dale acceso al token antes del despliegue: si no, `deploy.sh`
termina con el código 10 sin tocar nada.

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
- DNS del admin nuevo (REQ-F-039, **a cargo del usuario**): registro `A` (y `AAAA`) de
  `admin.birriaelmuneco.com` hacia el VPS, **antes** de desplegar la épica a `main`. Sin él, el
  certificado no se emite y el subdominio no responde; las landings no cambian, y `deploy.sh` no
  depende del DNS (comprueba el enrutado con `--resolve`).
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

Con un repositorio privado y el plan Free, GitHub no ofrecía estas reglas; ahora que el
repositorio es público, el plan Free sí las ofrece y conviene activarlas. En cualquier caso, el
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
- **App:** las mismas variables que describe [`landing-pages/.env.example`](../landing-pages/.env.example) (WhatsApp, bot de
  Meta, `SITE_URL=https://birriaelmuneco.com`, primer administrador).
  - El compose fija `NODE_ENV`, `HOST`, `PORT`, `TRUST_PROXY`, `DATA_DIR` y `DATABASE_URL`: no
    las pongas.
  - `ADMIN_PASSWORD_HASH` va entre comillas simples. Genéralo con `npm run admin:hash-password`
    en tu máquina.
- **Admin nuevo (REQ-F-039):**
  - `RESTAURANTE_ADMIN_DOMAIN`: el subdominio, `admin.birriaelmuneco.com`;
  - `RESTAURANTE_INTERNAL_NOTIFY_TOKEN`: la credencial del aviso interno de la api a la app, generada
    con `openssl rand -hex 32`. Solo la reciben `app` y `api`.
  - Las dos son obligatorias: sin ellas, `deploy.sh` termina con el código 3 y `docker compose`
    no interpola el archivo.
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
| CA-2: redirecciones | Con GET, como un navegador: `curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' 'http://birriaelmuneco.com/molotes?a=1'` (y lo mismo con `http://www.`) → `301` hacia `https://` del mismo host con la ruta y la query (redirección global del entrypoint `web` del Traefik del VPS). Con `'https://www.birriaelmuneco.com/molotes?a=1'` → `301 https://birriaelmuneco.com/molotes?a=1`. Así, `http://www.` llega a la raíz en dos saltos. Con `curl -sI` (HEAD), Traefik responde `308` a las mismas redirecciones: no es un defecto, pero no sirve para esta comprobación |
| CA-3: puertos cerrados | Desde fuera: `nc -vz <vps> 3000` y `nc -vz <vps> 3306` fallan |
| CA-4: límite de `/admin` | 30 peticiones **en paralelo**, `seq 1 30 \| xargs -P 30 -I{} curl -s -o /dev/null -w '%{http_code}\n' https://birriaelmuneco.com/admin/login \| sort \| uniq -c`, dan unas 20 con 200 y el resto con 429 (el 2026-10-29: 20 y 10; 10 por minuto y ráfaga de 20, en `deploy/compose.prod.yaml`); `/molotes` sigue en 200. En serie puede no salir ningún 429: con la latencia real la ráfaga se recarga, como en el admin nuevo |
| CA-5: IP real | En `docker logs restaurante-app-1`, la línea `request` lleva `"protocol":"https"` y tu IP pública, no una `172.x` de Docker. Si sale una `172.x`, Traefik no ve la IP de origen (proxy de Docker en IPv6, CDN delante): revisa la publicación de puertos de Traefik |
| CA-6 y CA-9 | Un merge despliega solo; dos merges seguidos se despliegan uno tras otro (Actions → `deploy`) |
| CA-10 | `stat -c '%a %U' /opt/restaurante/.env` → `600 deploy`; `sudo -l -U deploy` sin sudo |
| Traefik | Certresolver, entrypoints, versión y que no haya routers con el prefijo `restaurante` de otros sitios |
| Docker | `docker version` del Engine ≥ 25 (para `start_interval` del healthcheck) |
| CA-15 de REQ-F-039: admin nuevo | Con el DNS ya propagado: `curl -sI https://admin.birriaelmuneco.com/acceso` → 200 con certificado válido en el navegador, `Cache-Control: no-store` y `X-Robots-Tag: noindex, nofollow`; `curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' 'http://admin.birriaelmuneco.com/acceso?next=%2F'` → `301` a `https://` con la ruta y la query (con `curl -sI`, HEAD, da `308`); 120 peticiones **en paralelo**, `seq 1 120 \| xargs -P 30 -I{} curl -s -o /dev/null -w '%{http_code}\n' https://admin.birriaelmuneco.com/salud \| sort \| uniq -c`, dan una parte con 200 y el resto con 429 (el 2026-10-29: 62 y 58); `/molotes` sigue en 200. En serie no sirve: con la latencia real la ráfaga se recarga y 75 peticiones seguidas dieron todas 200 |
| `api` y aviso no expuestos | `curl -s -o /dev/null -w '%{http_code}' https://admin.birriaelmuneco.com/api/v1/admin/sesion` → 404 (lo responde inventory-manager); `curl -s -o /dev/null -w '%{http_code}' -X POST https://birriaelmuneco.com/internal/v1/productos-cambiados` → 404 |
| Frescura (CA-9) | Marca un producto como no disponible en el admin nuevo: el mensaje dice «La landing y el bot ya muestran el cambio», la landing deja de mostrarlo y en el log de `app` aparece `products_change_notified` con `landing:true` y `bot:true` |

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

Corre `calidad`, `docker` y `auditoria`, y con las tres en verde, `publish` y
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

     `$C` incluye `state/release.env`, pero las variables del entorno tienen prioridad. Para la
     `api` (REQ-F-038), igual con `RESTAURANTE_API_IMAGE=ghcr.io/orvigas/restaurante-api@sha256:<digest>`
     y `up -d --no-deps api`. Nombra siempre el servicio (`up -d --no-deps app` o `api`): sin
     `RESTAURANTE_API_IMAGE`, el compose resuelve la `api` a la imagen
     `…/restaurante-api:sin-desplegar`, que no existe.
  3. El siguiente despliegue desde `main` deja todo como indica el CI.

**Imagen de la `api` (REQ-F-038).** Está en `state/release.env` (`RESTAURANTE_API_IMAGE`) después
de cada despliegue correcto. `ops/backup/restore.sh` reescribe ese archivo solo con la app y
migrate, así que **tras una restauración** la línea ya no está. Búscala, por orden, en:

1. el contenedor en marcha: `docker inspect -f '{{.Config.Image}}' "$($C ps -q api)"`;
2. `state/release.env.previous` (`restore.sh` guarda ahí el `release.env` anterior);
3. la última línea `api=sha256:<digest>` de `state/releases.log` (imagen
   `ghcr.io/orvigas/restaurante-api@sha256:<digest>`).

`deploy.sh` hace lo mismo con la primera opción: si `release.env` no tiene la api, toma la del
contenedor en marcha como api anterior para su vuelta atrás.

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

1. Actions → `deploy` en verde, con el resumen **Desplegado**: el commit (SHA corto enlazado y SHA
   completo) y los digests.
2. `https://birriaelmuneco.com/`, `/molotes` y `/birria` responden 200. `/admin` muestra el
   acceso, no un 503. `https://admin.birriaelmuneco.com/acceso` muestra el acceso del admin nuevo.
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

   Si el volcado es de un commit con otra `api` u otro `inventory-manager` (sus digests también
   están en `state/releases.log`), arráncalos igual con `RESTAURANTE_API_IMAGE` y
   `RESTAURANTE_INVENTORY_IMAGE`.

2. Los permisos de los usuarios (`GRANT ... ON restaurante.*`) sobreviven al `DROP DATABASE`.
3. Comprueba `$C ps` (healthy) y el [paso 8](#8-comprobaciones-después-de-cada-despliegue).
4. Si el siguiente despliegue desde `main` vuelve a fallar en la migración, corrige la migración
   antes de volver a desplegar.

Estos volcados solo existen en el VPS. Las copias cifradas diarias fuera del servidor, la
restauración desde ellas y la prueba mensual están en el [paso 11](#11-respaldos-fuera-del-vps).

## 10. Diagnóstico

El resumen de `deploy` (REQ-F-030) ya indica el estado y el código de salida; el detalle está en
el log del paso `desplegar`.

| Síntoma (log del job `deploy`) | Causa probable | Qué hacer |
| ------------------------------ | -------------- | --------- |
| Resumen **Omitido** (en `vigente` o en `deploy`) | `main` avanzó: este commit no es la punta | Nada: lo despliega la ejecución del commit nuevo |
| Resumen **Cancelado o interrumpido** | Job cancelado o paso `desplegar` sin terminar (17 min) | Revisa `state/releases.log` y `state/release.env`; vuelve a desplegar la punta de `main` |
| `vigente` en rojo | La API de GitHub no respondió con el commit de `main` | No se tocó producción; vuelve a ejecutar el job |
| `Host key verification failed` / `Permission denied (publickey)` | Huella del VPS cambiada o llave revocada | Revisa `VPS_SSH_KNOWN_HOSTS` y `authorized_keys` (paso 1.5) |
| `ssh: connect to host … Connection timed out`, código 255 | El runner no llegó al VPS (corte de red puntual o firewall); `deploy.sh` no llegó a ejecutarse y producción no se tocó | Comprueba que el VPS responda por SSH (`sshd` activo, sin baneos de fail2ban, ufw con el puerto 22). Si todo está bien, basta con **Re-run failed jobs** en Actions (el 2026-10-29, el primer despliegue de la épica pasó así en el intento 2) |
| Código 2 `uso: deploy ...` | Argumentos inválidos (o se usó la llave a mano) | — |
| Código 3 (`.env`, `RESTAURANTE_*`) | `.env` sin permisos 600, con `DATABASE_ALLOW_NEWER_SCHEMA`, con dominio, subdominio del admin o registro inválidos, o sin `RESTAURANTE_INTERNAL_NOTIFY_TOKEN` (32 caracteres como mínimo) | Corrige el `.env` |
| Código 4 `deploy/ instalado no coincide` | Cambió `restaurante/deploy/` en `main` | Reinstala `deploy/` (paso 1.3) y vuelve a ejecutar el job |
| Código 5 `otro despliegue sigue en curso` | Otro `deploy.sh` tiene el bloqueo hace más de 30 min | Revisa `state/releases.log` y los procesos `deploy.sh`; vuelve a ejecutar el job |
| Código 10 (descarga) | Token de GHCR caducado o sin `read:packages` | Nuevo token y `docker login` (paso 1.4) |
| Código 11 `MySQL no quedó healthy` | MySQL no arrancó (memoria, disco, volumen dañado) o el initdb falló en el primer arranque (contraseñas no hexadecimales) | `$C logs mysql`; la app no se tocó |
| Código 12 (volcado) | MySQL caído, disco lleno o usuario `restaurante_backup` | `$C logs mysql`, `df -h` |
| Código 13 (migración) | La migración falló; la app sigue con la versión anterior | Lee el error de Prisma en el log. Si quedó a medias, [restaura](#9-restaurar-la-base-desde-un-volcado) |
| Código 15 (REQ-F-038) | La `api` nueva no quedó `healthy`; se volvió a la anterior si la había. La app no se tocó o, si hubo migraciones nuevas, se recreó con su misma imagen y `DATABASE_ALLOW_NEWER_SCHEMA=true` (el log del paso lo dice) | `$C logs api`: suele ser la base (`database_init_failed`) o la imagen. Las landings siguen con su última copia buena. Corrige y vuelve a desplegar: el siguiente despliegue correcto deja la app sin la bandera |
| Código 16 (REQ-F-039) | `inventory-manager` no quedó `healthy` o Traefik no lo enruta en `admin.<dominio>`; volvió al anterior (o se detuvo si no lo había). La app no se tocó (o, con migraciones nuevas, se recreó con la bandera, como en el código 15); la `api` nueva sigue | `$C logs inventory-manager`: suele ser la configuración (`API_INTERNAL_URL`) o la imagen. Comprueba `RESTAURANTE_ADMIN_DOMAIN` y los routers `restaurante-inventory*` de Traefik. La edición de productos sigue en el `/admin` anterior hasta un despliegue correcto |
| `products_notify_failed` / `products_notify_gave_up` en `api` | El aviso interno a `app` (puerto 3002) falla: `app` caída o credencial distinta | `$C ps app`; comprueba que `RESTAURANTE_INTERNAL_NOTIFY_TOKEN` sea la misma para las dos (la reciben del mismo `.env`). Mientras tanto, la landing y el bot ven el cambio como mucho en 60 s |
| `admin.<dominio>` responde 429 | Límite de Traefik del admin nuevo (60 por minuto por IP, ráfaga de 60) | Espera un minuto |
| Las landings registran `landing_products_fallback` | La `api` no responde, tarda más de 1,5 s o devuelve algo fuera del contrato | `$C ps api` y `$C logs api`. Las landings sirven su última copia buena (o la semilla tras reiniciar `app`) y vuelven solas cuando la api responde (`landing_products_recovered`) |
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

`restore.sh` no toca `api` ni `inventory-manager` (REQ-F-039): siguen con su imagen. Si el respaldo
es de un commit con otra `api`, arráncala como en el [paso 9](#9-restaurar-la-base-desde-un-volcado);
`inventory-manager` no guarda datos, así que basta con que siga en marcha.

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
  5. `restore.sh` no conoce la `api` (REQ-F-038; decisión P-2: `ops/` no cambia): solo arranca la
     app. En un VPS nuevo la `api` no está en marcha y las landings sirven la semilla de
     `content/seeds.ts` (sin errores 5xx) hasta que la levantes. Vuelve a desplegar la punta de
     `main` ([Redesplegar](#redesplegar-la-punta-de-main)), o arráncala a mano con
     `RESTAURANTE_API_IMAGE=<imagen> $C up -d --no-deps api`. La `<imagen>` sale de
     `state/release.env.previous` o de `state/releases.log` ([Imagen de la `api`](#6-volver-a-una-versión-anterior-a-mano));
     `state/release.env` ya no la tiene, porque `restore.sh` lo reescribe sin ella. En el mismo VPS,
     la `api` sigue en marcha durante la restauración y no hace falta nada: si alguna vez necesitas
     su imagen, sácala del contenedor (`docker inspect`), como explica esa sección.
  6. Activa el timer.

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
