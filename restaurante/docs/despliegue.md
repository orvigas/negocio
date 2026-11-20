# Despliegue a producción en el VPS

Guía para preparar el VPS, desplegar automáticamente con cada merge a `main`, volver a una
versión anterior y restaurar la base de datos (REQ-F-016), y para los respaldos cifrados fuera del
VPS (REQ-F-019). Los detalles de la app están en el [README](../README.md).

## Antes de empezar

### Qué se despliega

- **VPS:** Hostinger con Ubuntu 24.04, Docker y un **Traefik ya instalado** que sirve otros sitios
  en la red externa `traefik-public`. El proyecto vive en `/opt/restaurante`.
- **Servicios** (`deploy/compose.prod.yaml`, proyecto `restaurante`):
  - `app`: la imagen `production` (Koa). Sirve las dos landings; `/admin` solo responde 302 al admin
    nuevo y 410 a cualquier escritura (REQ-F-045). Desde REQ-F-045 no usa MySQL, `DATA_DIR`, el
    volumen `app-data` ni las variables del bot: el compose no se los pasa. Una sola réplica, sin
    puertos publicados, en la red interna `db` (por la que llega a la `api`) y en
    `traefik-public`. Se construye desde el workspace `restaurante/landing-pages/` del monorepo
    (REQ-F-036), que incluye los paquetes `restaurante/packages/core` y `packages/db` (REQ-F-037),
    con el contexto de build en `restaurante/`. Dentro de la imagen, la app está en
    `/app/landing-pages`, que es su directorio de trabajo. Desde REQ-F-045, los comandos de consola
    (`node scripts/admin-recover.ts`) están en la imagen `api` (directorio de trabajo `/app/api`).
  - `api` (REQ-F-038, REQ-F-039 y REQ-F-042): la imagen `api`, la API propia y el bot de WhatsApp.
    - `GET /api/v1/public/{molotes|birria}/productos`: de aquí las landings de `app` leen los
      productos (`API_INTERNAL_URL=http://api:3001`).
    - `/api/v1/admin`: la administración que usa `inventory-manager`. Desde REQ-F-039 es la única
      que escribe los productos y, desde REQ-F-043, el control del bot.
    - Tras cada escritura avisa a `app` por su puerto interno 3002 (`LANDING_INTERNAL_URL`, con la
      credencial `RESTAURANTE_INTERNAL_NOTIFY_TOKEN`), para que la landing muestre el cambio al
      instante. El bot lo ve en proceso, con la misma caché de productos.
    - **Webhook del bot (REQ-F-042):** se sirve en el puerto 3004 (`WEBHOOK_PORT`), una app que solo
      tiene `/webhooks/whatsapp`. Es lo único de `api` que Traefik publica: el router
      `restaurante-webhook` lleva esa ruta exacta al 3004. El puerto 3001 no se publica.
    - Redes: `db` (con `app` y MySQL), `admin` (con `inventory-manager`) y `traefik-public`, por la
      entrada del webhook y porque el bot necesita salida a internet para hablar con Meta. Sin
      puertos publicados. Un contenedor vecino de `traefik-public` alcanza `api:3001`, como alcanza
      `app:3000`: `/api/v1/admin` exige sesión y `/api/v1/public` es de solo lectura.
    - Llega a MySQL y a `app` por sus nombres de contenedor (`restaurante-mysql-1` y
      `restaurante-app-1`), no por los de servicio: en `traefik-public`, un alias `app` o `mysql` de
      otro proyecto respondería por ellos. Lo fija el compose; el `.env` no cambia.
    - Usa el usuario solo DML (`restaurante_app`); nunca migra. Solo en una instalación nueva (base
      vacía) siembra los productos y la página de la semilla y crea el primer administrador con
      `ADMIN_USER`/`ADMIN_PASSWORD_HASH`, que desde la limpieza de REQ-F-045 recibe ella (antes, la
      app). Si se cae, las landings siguen respondiendo con su última copia buena (o la semilla, si
      `app` arrancó sin ella).
  - `inventory-manager` (REQ-F-039): la imagen `inventory-manager`, el admin nuevo (Koa con SSR) en
    `https://admin.birriaelmuneco.com`.
    - Gestiona los productos, los usuarios y "Mi cuenta" (REQ-F-040) llamando a `api` por la red
      interna `admin`.
    - Está en `traefik-public` y en `admin`: no alcanza MySQL y no tiene credenciales de la base ni
      la del aviso.
    - Es el único admin desde REQ-F-045: `/admin` de las landings responde 302 a su raíz
      (`ADMIN_NEW_URL`).
    - **Aviso al personal (R-3 de REQ-F-040):** desde ese despliegue, las contraseñas se cambian en
      "Mi cuenta" de `https://admin.birriaelmuneco.com` (mismo usuario y contraseña), y las altas y
      cambios de usuarios, en "Usuarios" del admin nuevo. `npm run admin:recover` sigue igual.
  - `mysql`: MySQL 8.4 (utf8mb4, `utf8mb4_es_0900_as_cs`), solo en la red interna `db`, con sus
    datos en el volumen `restaurante_mysql-data`.
  - `migrate`: proceso puntual que aplica las migraciones con un usuario con DDL.
- **Borde HTTPS:** Traefik.
  - `https://birriaelmuneco.com` sirve la app, salvo la ruta exacta `/webhooks/whatsapp`, que va a
    `api`.
  - `http://` responde 301 hacia `https://` del mismo host (redirección global del Traefik del
    VPS; sin ella, el router del proyecto responde 301 directamente a la raíz).
  - `https://www.` responde 301 a `https://birriaelmuneco.com`.
  - En los dos casos se conservan la ruta y la query.
  - Esos 301 son los de una petición GET (la de los navegadores). Con HEAD (`curl -I`), Traefik
    responde 308 a las mismas redirecciones: compruébalas con GET ([verificación](#verificación-del-primer-despliegue-supuestos-del-ticket)).
  - `/admin` no tiene límite propio desde la limpieza de REQ-F-045: va por el router raíz y solo
    responde 302 o 410.
  - `https://admin.birriaelmuneco.com` sirve `inventory-manager` (REQ-F-039), con su propio
    certificado del certresolver y su propio límite: 60 peticiones por minuto por IP, con ráfaga de
    60. `http://admin.` responde 301 a `https://` conservando la ruta y la query.
  - Traefik no envía HSTS: lo envía la app.
- **Datos:**
  - los usuarios, la auditoría, los productos y la página (REQ-F-044), en MySQL;
  - el volumen `restaurante_app-data` (los JSON de página de antes de REQ-F-044) se conserva sin
    montar desde la limpieza de REQ-F-045: ningún servicio lo usa ni se respalda, pero **no se
    borra** (lo necesita una vuelta a una versión anterior; [§6](#volver-a-una-versión-anterior-a-req-f-045)).
- **Estado en memoria:** sesiones del admin nuevo, su límite de intentos, las claves de idempotencia
  y las conversaciones del bot, en `api`.
  Cada despliegue reinicia los contenedores: cierra las sesiones, corta las conversaciones y deja el
  sitio sin servicio unos 10 a 30 s.

### Cómo llega una versión a producción

1. El CI (`.github/workflows/ci.yml`) del PR ejecuta `calidad`, `docker` (imágenes y pruebas de
   humo del despliegue y de los respaldos, estas solo en un PR hacia `main`) y `auditoria`, y se hace merge a `main` con las tres en
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
      restauración, toma la del contenedor `api` en marcha) y termina con el código 15. La app
      no se toca nunca, haya o no migraciones nuevas: desde REQ-F-045 no usa la base (REQ-F-047).
   7. Cambia `inventory-manager` al digest nuevo y espera `healthy`, más una respuesta 200 de
      `https://admin.<dominio>/salud` a través de Traefik (por `RESTAURANTE_PROBE_ADDRESS`, sin
      depender del DNS). Va **antes** que la app porque la app nueva lleva `/admin` al admin nuevo. Si no queda sano, vuelve al `inventory-manager` anterior (o lo
      detiene si no lo había), deja la `api` nueva en marcha y termina con el **código 16**. Como en
      el punto 6, la app no se toca nunca, haya o no migraciones nuevas.
   8. Cambia la app al digest nuevo y espera `healthy`, más una respuesta 200 a través de
      Traefik.
   9. Registra el resultado (las cuatro imágenes) en `state/release.env` y `state/releases.log`.
7. Ante un fallo:
   - si fallan la descarga, el volcado o la migración, la app en marcha no se toca y el workflow
     queda en rojo;
   - si la versión nueva no queda sana, `deploy.sh` vuelve a los digests anteriores de la app y
     de la `api` (si había una api anterior; en el primer despliegue con api se queda la nueva) con
     `DATABASE_ALLOW_NEWER_SCHEMA=true`, y `inventory-manager` vuelve al anterior o se detiene si
     no lo había; el workflow queda
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
`WHATSAPP_BOT_PROVIDER=twilio` la `api` **no arranca** (ni la app). Twilio es solo para desarrollo
([Entorno de desarrollo](desarrollo.md#8-bot-real-con-el-sandbox-de-twilio)).

El control del bot (pausa, bloqueos y topes) se hace en la pantalla "Bot" de
`https://admin.birriaelmuneco.com/bot`, solo para administradores (REQ-F-043). `/admin/bot` queda en
solo lectura: muestra estado, uso y lista, y enlaza a esa pantalla. **Sin `inventory-manager` no hay
pausa web**: es un riesgo aceptado ([arquitectura §10](arquitectura.md#10-riesgos)).

**Aviso al personal (REQ-F-043):** desde ese despliegue, el bot se pausa y los números se bloquean en
"Bot" de `https://admin.birriaelmuneco.com`, con el mismo usuario y contraseña. El despliegue cierra las
sesiones de `/admin`: quien envíe un formulario de `/admin/bot` abierto desde antes irá al acceso con
"Tu sesión caducó. Vuelve a entrar. No se guardó ningún cambio." Al entrar verá la página en solo
lectura, con el enlace al admin nuevo: **esa acción no se aplicó** y hay que repetirla allí.

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

Es la sección "Actualizar deploy/" a la que remite el mensaje de ese código 4 (`deploy.sh`, "reinstálalo
(docs/despliegue.md, 'Actualizar deploy/')"): instalar y actualizar son el mismo procedimiento.

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

**Al llegar a `main` la limpieza de REQ-F-045 (PR 3):** cambian `compose.prod.yaml` y los scripts
de respaldos; `deploy.sh` y `mysql/initdb/` no. En el compose:

- la app deja de recibir `DATABASE_URL`, `DATABASE_ALLOW_NEWER_SCHEMA`, `DATA_DIR`, `ADMIN_*` y las
  variables del bot, y deja de montar `app-data`;
- la `api` recibe `ADMIN_USER`/`ADMIN_PASSWORD_HASH`;
- desaparece el router `restaurante-admin` con su límite de peticiones.

Los scripts de respaldos nuevos se instalan **antes del merge**, con la app del PR 2 todavía en
marcha: así ningún respaldo de formato 1 lleva la imagen de la app de la limpieza. Esa imagen ya no
tiene la carpeta de `DATA_DIR`, y un respaldo de formato 1 con ella no se restaura en un volumen
`app-data` nuevo (VPS nuevo) ni pasa el simulacro. El `backup.sh` nuevo no lee el volumen y funciona
igual con el compose del PR 2.

En este orden:

1. **`.env`: nada que cambiar.** Las variables son las mismas: el compose solo cambia a quién se las
   pasa. `ADMIN_USER`/`ADMIN_PASSWORD_HASH` pasan a la `api`, que las valida con las mismas reglas
   que la app. Con usuarios en la base, solo deja un aviso, sin los valores. No hace falta
   borrarlas del `.env`.
2. **Antes del merge, comprobación de solo lectura:** el volumen existe y lo monta la app (todavía):

   ```sh
   sudo docker volume ls | grep app-data                            # restaurante_app-data
   sudo docker ps -a --filter volume=restaurante_app-data           # la app
   ```

3. **Antes del merge, instala los scripts de respaldos del PR** en el VPS, con la sección
   [11.5](#115-instalar-en-el-vps), pero desde el último commit de la rama del PR (`gh pr checkout
   <número>` en tu copia local) en lugar de `main`. Solo cambian `lib.sh`, `backup.sh` y
   `restore.sh` (`env-backup.sh` no cambia) y la unidad `restaurante-backup.service` (solo su
   descripción). Ni `age`, ni las carpetas, ni `backup.env`, ni `recipients.txt` se tocan:

   ```sh
   # En tu máquina, en la raíz del repositorio, en la rama del PR:
   scp -r restaurante/ops/backup <admin>@<vps>:/tmp/restaurante-backup
   # En el VPS:
   cd /tmp/restaurante-backup
   sudo install -o root -g root -m 755 lib.sh backup.sh restore.sh /opt/restaurante/ops/backup/
   sudo install -o root -g root -m 644 systemd/restaurante-backup.service /etc/systemd/system/
   sudo systemctl daemon-reload
   rm -rf /tmp/restaurante-backup
   ```

   Desde aquí, todos los respaldos son de formato 2. Con la app del PR 2 se restauran y pasan el
   simulacro: esa app no usa la base ni `DATA_DIR`. El `restore.sh` nuevo sigue aceptando los
   respaldos de formato 1 que ya están en R2. No hagas el merge hasta terminar el paso 4.
4. **Antes del merge, comprueba que el respaldo nuevo es de formato 2.** Haz un respaldo a mano en
   el VPS (`sudo systemctl start restaurante-backup.service`; `sudo journalctl -u
   restaurante-backup.service -n 40 --no-pager` dice `respaldo completo`). Después,
   en tu Mac, en la misma rama del PR (el `verify-backup.sh` anterior no acepta el formato 2), ejecuta
   `restaurante/ops/backup/verify-backup.sh --drill`
   ([11.8](#118-prueba-mensual-y-simulacro-en-tu-mac)). Debe terminar con 0 e imprimir
   `manifiesto: formato 2` y `sin app-data (formato 2, posterior a REQ-F-045)`. El volumen sigue
   igual y montado por la app (el segundo comando del paso 2). Si sale `formato 1`, los scripts
   nuevos no quedaron instalados: repite el paso 3 antes de seguir.
5. **Haz el merge.** El job `deploy` falla con el código 4 (`deploy/` cambió) sin tocar nada.
   **Reinstala `deploy/`** con este paso, desde ese commit de `main`, y vuelve a ejecutar el job
   (**Re-run failed jobs**). Los scripts de respaldos ya están instalados: no se reinstalan.
6. **Vuelve tu copia local a `main`** (`git switch main && git pull`) para las próximas pruebas
   mensuales. `verify-backup.sh` es el mismo que el de la rama del PR.
7. **Comprobaciones** (solo lectura), con `C` del [paso 5](#5-operar-a-mano):

   ```sh
   sudo docker volume inspect restaurante_app-data >/dev/null && echo existe
   sudo docker ps -a --filter volume=restaurante_app-data          # vacío: nadie lo monta
   seq 1 30 | xargs -P 30 -I{} curl -s -o /dev/null -w '%{http_code}\n' https://birriaelmuneco.com/admin/login | sort | uniq -c
   # 30 302 (ningún 429)
   curl -s -o /dev/null -w '%{http_code}\n' https://birriaelmuneco.com/molotes     # 200
   $C logs api | grep -E '"msg":"(server_started|admin_bootstrap_ignored)"'          # y ningún admin_bootstrap_created
   ```

   Después, un respaldo a mano y su verificación ([11.6](#116-verificar-la-instalación), punto 1;
   `journalctl` dice `respaldo completo`), y `verify-backup.sh` en tu Mac: `manifiesto: formato 2`,
   ahora con la imagen de la app de la limpieza.

Vuelta atrás: la automática de `deploy.sh` vuelve a la app de REQ-F-045 (PR 2), que arranca con
este compose. Volver a una versión anterior a REQ-F-045 exige el compose de su commit
([§6](#volver-a-una-versión-anterior-a-req-f-045)).

**Al llegar a `main` el bot en `api` (REQ-F-042):** cambian `compose.prod.yaml` (variables del bot
y router del webhook en `api`) y `deploy.sh`, así que su suma cambia. **Reinstala `deploy/` con este
paso** cuando el job `deploy` falle con el código 4 y vuelve a ejecutarlo. Actualiza también
`restore.sh` en el VPS ([paso 11.5](#115-instalar-en-el-vps)): sin eso todo funciona igual, pero no
avisa si el bot queda sin servicio tras restaurar. Hasta entonces producción
no se toca, así que el webhook sigue en la versión anterior. No hay nada que hacer en Meta ni en el
`.env`: las variables del bot son las mismas.

Qué pasa con los mensajes en ese despliegue, y en cualquier vuelta atrás:

- Mientras la `api` nueva arranca, Traefik no publica su router (solo enruta contenedores `healthy`):
  `/webhooks/whatsapp` sigue yendo a la app anterior, que atiende el bot como siempre.
- En cuanto la `api` queda `healthy`, Traefik publica `restaurante-webhook` y los mensajes pasan a
  ella. `deploy.sh` comprueba ese enrutado **antes** de cambiar la app, la única que dejaría la ruta
  sin bot. Si no lo ve en 60 s, vuelve a la `api` anterior y termina con el código 15, con la app
  anterior todavía atendiendo el webhook.
- En la **vuelta atrás automática** (código 21), la `api` nueva sigue atendiendo el webhook hasta que
  la app anterior está lista, y solo entonces vuelve la `api` anterior.
- Las entregas de Meta que no reciben 200 se reintentan: un fallo breve no pierde mensajes. Las ya
  respondidas con 200 no se repiten. Las **conversaciones a medias se pierden**, porque viven en
  memoria: el cliente vuelve a empezar (aceptado, D-3).

Fallos de `/webhooks/whatsapp` medidos en local (2026-11-04, una petición cada 0,3 s, con las imágenes
de `main` y las de REQ-F-042). Los tiempos del VPS pueden ser mayores:

| Operación | Resultado |
| --------- | --------- |
| Corte hacia la versión nueva | Ningún fallo: la app anterior responde hasta que la `api` toma el relevo |
| Vuelta atrás automática (código 21) | Entre 1 y 4 respuestas 502 |
| Reinicio o despliegue de la `api`, ya con la app nueva | 404 de la app durante unos 4 s |
| Volver a la versión anterior desplegándola con `deploy.sh` | 404 y 502 durante unos 8 s: la `api` cambia antes que la app |

El último caso no tiene arreglo sin cambiar el orden de un despliegue normal. Si no corre prisa,
hazlo fuera de las horas de pedidos.

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
  declara `traefik.enable=true`, y la `api` lo declara cuando su imagen trae el webhook).
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
- **App y `api`:** las variables que describen [`landing-pages/.env.example`](../landing-pages/.env.example) (WhatsApp y
  `SITE_URL=https://birriaelmuneco.com`) y [`api/.env.example`](../api/.env.example) (bot de Meta y
  primer administrador).
  - Un solo `.env`: el compose pasa a cada servicio solo lo suyo. Las variables del bot y
    `ADMIN_USER`/`ADMIN_PASSWORD_HASH` solo llegan a `api` (desde la limpieza de REQ-F-045);
    `WHATSAPP_MOLOTES` y `WHATSAPP_BIRRIA` llegan a las dos (CTA de las landings y regla D-6 del
    bot, que comprueba la `api`).
  - El compose fija `NODE_ENV`, `HOST`, `PORT`, `WEBHOOK_PORT`, `TRUST_PROXY` y `DATABASE_URL` (solo
    de la `api`): no las pongas.
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
- **Nunca** definas `DATABASE_ALLOW_NEWER_SCHEMA` (`deploy.sh` se niega a desplegar si la
  encuentra) ni `RESTAURANTE_API_WEBHOOK` (la calcula `deploy.sh` en cada despliegue).
- Guarda una copia del `.env` cifrada y fuera del VPS.

## 4. Primer despliegue

Con los pasos 1 a 3 hechos, haz merge a `main` de un PR con cambios de código o lanza un
[redespliegue manual](#redesplegar-la-punta-de-main) (un push de solo documentación no publica
ni despliega).

En el primer arranque:

- MySQL crea la base y los usuarios: `restaurante_app` (solo DML), `restaurante_migrator` (DDL)
  y `restaurante_backup` (solo lectura).
- `migrate` crea las tablas.
- La `api`, que arranca antes que la app, siembra los productos y la página de la semilla y crea el
  primer administrador con `ADMIN_USER`/`ADMIN_PASSWORD_HASH` (REQ-F-045). Sin esas variables, el
  acceso se crea con `admin-recover` ([paso 5](#5-operar-a-mano)). La app no toca la base.

Si la app no queda sana en el primer despliegue, no hay versión anterior: el workflow queda en
rojo y la app se queda como esté ([Diagnóstico](#10-diagnóstico)).

### Verificación del primer despliegue (supuestos del ticket)

| Comprobación | Cómo |
| ------------ | ---- |
| CA-1: HTTPS y certificado | `curl -sI https://birriaelmuneco.com` → 200, certificado válido en el navegador, landing del día |
| CA-2: redirecciones | Con GET, como un navegador: `curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' 'http://birriaelmuneco.com/molotes?a=1'` (y lo mismo con `http://www.`) → `301` hacia `https://` del mismo host con la ruta y la query (redirección global del entrypoint `web` del Traefik del VPS). Con `'https://www.birriaelmuneco.com/molotes?a=1'` → `301 https://birriaelmuneco.com/molotes?a=1`. Así, `http://www.` llega a la raíz en dos saltos. Con `curl -sI` (HEAD), Traefik responde `308` a las mismas redirecciones: no es un defecto, pero no sirve para esta comprobación |
| CA-3: puertos cerrados | Desde fuera: `nc -vz <vps> 3000` y `nc -vz <vps> 3306` fallan |
| CA-13 de REQ-F-045: `/admin` sin límite propio | 30 peticiones **en paralelo**, `seq 1 30 \| xargs -P 30 -I{} curl -s -o /dev/null -w '%{http_code}\n' https://birriaelmuneco.com/admin/login \| sort \| uniq -c`, dan `30 302` (ningún 429); `/molotes` sigue en 200. Hasta esa limpieza había un límite de 10 por minuto y ráfaga de 20 (el 2026-10-29: 20 con 200 y 10 con 429) |
| CA-5: IP real | En `docker logs restaurante-app-1`, la línea `request` lleva `"protocol":"https"` y tu IP pública, no una `172.x` de Docker. Si sale una `172.x`, Traefik no ve la IP de origen (proxy de Docker en IPv6, CDN delante): revisa la publicación de puertos de Traefik |
| CA-6 y CA-9 | Un merge despliega solo; dos merges seguidos se despliegan uno tras otro (Actions → `deploy`) |
| CA-10 | `stat -c '%a %U' /opt/restaurante/.env` → `600 deploy`; `sudo -l -U deploy` sin sudo |
| Traefik | Certresolver, entrypoints, versión y que no haya routers con el prefijo `restaurante` de otros sitios |
| Docker | `docker version` del Engine ≥ 25 (para `start_interval` del healthcheck) |
| CA-15 de REQ-F-039: admin nuevo | Con el DNS ya propagado: `curl -sI https://admin.birriaelmuneco.com/acceso` → 200 con certificado válido en el navegador, `Cache-Control: no-store` y `X-Robots-Tag: noindex, nofollow`; `curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' 'http://admin.birriaelmuneco.com/acceso?next=%2F'` → `301` a `https://` con la ruta y la query (con `curl -sI`, HEAD, da `308`); 120 peticiones **en paralelo**, `seq 1 120 \| xargs -P 30 -I{} curl -s -o /dev/null -w '%{http_code}\n' https://admin.birriaelmuneco.com/salud \| sort \| uniq -c`, dan una parte con 200 y el resto con 429 (el 2026-10-29: 62 y 58); `/molotes` sigue en 200. En serie no sirve: con la latencia real la ráfaga se recarga y 75 peticiones seguidas dieron todas 200 |
| `api` y aviso no expuestos | `curl -s -o /dev/null -w '%{http_code}' https://admin.birriaelmuneco.com/api/v1/admin/sesion` → 404 (lo responde inventory-manager); `curl -s -o /dev/null -w '%{http_code}' -X POST https://birriaelmuneco.com/internal/v1/productos-cambiados` → 404 |
| Frescura (CA-9) | Marca un producto como no disponible en el admin nuevo: el mensaje dice «La landing y el bot ya muestran el cambio», la landing deja de mostrarlo, el siguiente mensaje al bot ya no lo ofrece y en el log de `app` aparece `products_change_notified` con `landing:true` |
| Webhook del bot (REQ-F-042) | Ver [Comprobaciones del webhook](#comprobaciones-del-webhook-req-f-042) |

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

- **Recuperar el acceso al admin nuevo** (en la `api` desde REQ-F-045):
  `$C exec api node scripts/admin-recover.ts --usuario <nombre>`
  ([Recuperar el acceso](../README.md#recuperar-el-acceso)). Si la `api` en marcha es una imagen
  anterior a REQ-F-045 (tras una vuelta atrás), el comando sigue en la `app`:
  `$C exec app node scripts/admin-recover.ts --usuario <nombre>`.
- **Reiniciar la app:** `$C restart app`. Para reiniciar el bot, `$C restart api`: conserva el router
  del webhook.
- **Recrear la app** (`$C up -d app`): usa los digests de `state/release.env`. Desde REQ-F-045 la
  app no usa la base, así que arranca igual tras una vuelta atrás con la base más nueva.
- **Recrear la `api`:** sigue [Arrancar la `api` a mano](#arrancar-la-api-a-mano), para que el router del
  webhook quede coherente con la imagen.

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

### Importación única del inventario (REQ-F-050, A5)

Carga una sola vez los datos maestros del inventario (categorías, artículos, variantes, costos de
referencia, inventariable y recetas) desde el JSON revisado por el usuario. Solo cuando la épica de
inventario esté en `main`, después de T3 (PT-5): antes, la base de producción no tiene las tablas.
El JSON tiene datos reales del negocio: se genera y se guarda **fuera del repositorio** y nunca se
copia al contenedor (la `api` lo lee por la entrada estándar).

1. En tu Mac, copia el JSON a tu carpeta del VPS (no a `/opt/restaurante`):
   `scp <ruta-local>/inventario.json <tu-usuario>@<vps>:~/inventario.json`.
2. En el VPS, con tu usuario de administración:

   ```sh
   chmod 600 ~/inventario.json
   cd /opt/restaurante
   C="sudo docker compose -f deploy/compose.prod.yaml --env-file .env --env-file state/release.env"
   sudo systemctl start restaurante-backup.service      # recomendado: un respaldo justo antes
   # Ensayo: valida y cuenta sin escribir nada.
   $C exec -T api node scripts/inventory-import.ts --archivo - --produccion < ~/inventario.json
   ```

   Termina con código 0 y "Ensayo sin problemas" si se puede importar. Con errores o conflictos
   termina con 1 y los lista por fila del origen, campo y mensaje (sin valores): corrige el JSON en
   tu Mac y repite desde el paso 1.
3. Escritura (todo o nada en una transacción):

   ```sh
   $C exec -T api node scripts/inventory-import.ts --archivo - --produccion --escribir < ~/inventario.json
   ```

   Debe decir "escrita" con los conteos esperados. Repetirla con el mismo archivo no crea nada
   ("Creados: … 0"); un dato que ya existe distinto es un conflicto y no se sobrescribe.
4. Borra el archivo y comprueba que no quedó copia:

   ```sh
   shred -u ~/inventario.json
   ls ~/inventario.json      # debe responder que no existe
   ```

- El comando se niega sin `--produccion` (el contenedor `api` siempre es `NODE_ENV=production`) y
  con el archivo ficticio de las pruebas (`"ficticio": true`).
- Usa el `DATABASE_URL` de la `api` (usuario solo DML) y no migra: si la base no está lista, termina
  con 1 sin escribir nada.
- Las recetas entran como versión 1, vigentes desde la importación, y todo queda en el historial con
  el autor "Importación". No hace falta otro respaldo que el del paso 2: si algo falla, no se escribe
  nada.
- En local (base de `api/.env`, solo `127.0.0.1`, `localhost`, `::1` o `mysql-dev`):
  `npm run inventory:import -- --archivo <ruta>` (ensayo) y con `--escribir`.

## 6. Volver a una versión anterior a mano

La vuelta atrás automática solo cubre una versión nueva que no arranca. Para volver por otro
motivo:

- Haz un revert en `main`: se despliega solo, con volcado y migración.
- Si es urgente, en el VPS:
  1. Toma los digests de `state/release.env.previous` o de `state/releases.log`.
  2. Prepara el comando. Usa siempre `sudo env`: un `VAR=valor` delante de `$C` no llega a
     `docker compose`, porque `sudo` borra el entorno, y compose usaría sin avisar la imagen de
     `state/release.env`. Las variables de `sudo env` tienen prioridad sobre ese archivo.

     ```sh
     CE="docker compose -f deploy/compose.prod.yaml --env-file .env --env-file state/release.env"
     ```

     El orden es `inventory-manager`, app y `api`. Nombra siempre el servicio (`up -d --no-deps
     inventory-manager`, `app` o `api`): sin `RESTAURANTE_API_IMAGE`, el compose resuelve la `api` a
     la imagen `…/restaurante-api:sin-desplegar`, que no existe.
  3. **Solo si vas a volver la `api` a una versión anterior a REQ-F-043**, vuelve primero
     `inventory-manager`, con su digest de los mismos archivos de `state/`:

     ```sh
     sudo env RESTAURANTE_INVENTORY_IMAGE=ghcr.io/orvigas/restaurante-inventory-manager@sha256:<digest> $CE up -d --no-deps inventory-manager
     ```

     Si no, el `inventory-manager` nuevo queda con esa `api` de forma estable: el enlace "Bot" sigue
     visible y la pantalla da 503 con un aviso. Sobre una base más nueva que esa imagen no hace falta
     la bandera: `inventory-manager` no usa la base.
  4. Vuelve la app (con este compose, solo a una versión de REQ-F-045 o posterior; para una
     anterior, ver [abajo](#volver-a-una-versión-anterior-a-req-f-045)):

     ```sh
     sudo env RESTAURANTE_APP_IMAGE=ghcr.io/orvigas/restaurante@sha256:<digest> $CE up -d --no-deps app
     ```

  5. Si también vuelves la `api`, sigue ahora [Arrancar la `api` a mano](#arrancar-la-api-a-mano).
  6. El siguiente despliegue desde `main` deja todo como indica el CI.

Para volver a escribir en `/admin/bot` basta con la app: una versión anterior a REQ-F-043 vuelve a
tener los formularios, y una `api` nueva recoge esos cambios en 10 s
(`BOT_CONTROL_REFRESH_SECONDS`).

### Volver a una versión anterior a REQ-F-045

Desde la limpieza de REQ-F-045 (PR 3), el compose ya no pasa a la app `DATABASE_URL`, `DATA_DIR`,
`ADMIN_*` ni las variables del bot, ni le monta `app-data`. Una app anterior a REQ-F-045 (anterior
al PR 2, el que retiró `/admin`) los necesita: **con el compose actual no arranca**. La vuelta atrás
automática de `deploy.sh` nunca llega ahí (vuelve a la app anterior, que ya es de REQ-F-045), así que
solo afecta a una vuelta atrás a mano:

- **Revert en `main`** del PR de la limpieza (y del PR 2 si quieres esa app): el revert devuelve el
  compose anterior. El job `deploy` falla con el código 4: reinstala el `deploy/` de ese commit
  ([1.3](#13-instalar-deploy)) y vuelve a ejecutarlo.
- **Urgente, en el VPS:** instala con [1.3](#13-instalar-deploy) el `deploy/` del último commit de
  `main` anterior a la limpieza y sigue los pasos de arriba, con la bandera para la app (la base es
  más nueva que ella):

  ```sh
  sudo env DATABASE_ALLOW_NEWER_SCHEMA=true RESTAURANTE_APP_IMAGE=ghcr.io/orvigas/restaurante@sha256:<digest> $CE up -d --no-deps app
  ```

  El siguiente despliegue desde `main` falla con el código 4 hasta que reinstales el `deploy/` de
  `main`.

En los dos casos el volumen `restaurante_app-data` vuelve a montarse con los JSON que tenía (nadie
los cambia desde REQ-F-044): la app anterior encuentra las marcas de `page_import` y no reimporta
nada. Por eso el volumen **no se borra**. En un VPS nuevo, restaurado desde un respaldo de formato 2
(sin `app-data`), no vuelvas a una versión anterior a REQ-F-045: restaura antes un respaldo de
formato 1 ([11.7](#117-restaurar-runbook)).

### Volver a una versión anterior a la épica de inventario (REQ-F-049) con gerentes

La épica de inventario añade el rol **Gerente** (migración `rol_gerente`). Una `api` anterior a la
épica no conoce ese valor: al leer un gerente responde 503 (la lista de usuarios falla para el
administrador y el gerente no puede entrar), y un `inventory-manager` anterior rechaza la lista
entera. Las landings, el bot, los productos, la página y el acceso de administradores y editores
siguen funcionando. La vuelta atrás automática del despliegue que trae la épica no lo sufre (todavía
no hay gerentes), y las de despliegues posteriores van a imágenes que ya conocen el rol. **Solo una
vuelta atrás a mano a una `api` anterior a la épica, con gerentes ya creados, necesita este paso
previo** (decisión DT-2 de REQ-F-049):

1. Anota quiénes son los gerentes, para devolverles el rol al volver a avanzar:

   ```sh
   cd /opt/restaurante
   C="sudo docker compose -f deploy/compose.prod.yaml --env-file .env --env-file state/release.env"
   $C exec -T mysql sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" restaurante' <<'SQL' | tee "gerentes-$(date -u +%Y%m%dT%H%M%SZ).txt"
   SELECT id, username FROM user WHERE role = 'gerente';
   SQL
   ```

2. Degrádalos a editor sin negocios (sin acceso a nada) y cierra sus sesiones:

   ```sh
   $C exec -T mysql sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" restaurante' <<'SQL'
   DELETE ub FROM user_business ub JOIN user u ON u.id = ub.user_id WHERE u.role = 'gerente';
   UPDATE user SET role = 'editor', session_version = session_version + 1 WHERE role = 'gerente';
   SELECT COUNT(*) AS gerentes_restantes FROM user WHERE role = 'gerente';
   SQL
   ```

   Debe quedar `gerentes_restantes` en 0.

3. Sigue los pasos de [arriba](#6-volver-a-una-versión-anterior-a-mano), con
   `DATABASE_ALLOW_NEWER_SCHEMA=true` para la `api` (la base tiene las migraciones de la épica).
4. Al volver a desplegar la épica (o una versión posterior), un administrador devuelve el rol
   Gerente a cada usuario anotado desde "Usuarios" del admin.

El inventario (tablas `inventory_*`) se queda en la base: la versión anterior no lo lee ni lo
toca.

### Vuelta atrás tras el corte de la página (REQ-F-044)

Histórico: solo aplica a las versiones anteriores a REQ-F-045, que se arrancan con el compose de su
commit ([arriba](#volver-a-una-versión-anterior-a-req-f-045)). Desde REQ-F-045 la app no importa
nada.

Desde el PR 3 de REQ-F-044 la página (hero, texto destacado y promociones) vive en MySQL. La `app`
la importaba una sola vez desde `app-data` al arrancar, antes de escuchar, y dejaba la marca en
`page_import`. Los JSON no se modifican.

- **Si la importación falla o se niega** (`page_import_failed` en `$C logs app`), la `app` termina
  con 1 y `deploy.sh` vuelve atrás solo (código 21): no queda nada importado y los visitantes siguen
  como antes. Con `PAGE_IMPORT_SEED_REFUSED` faltan o están dañados los JSON de un negocio y la
  base ya tenía productos. **Restaura `app-data` desde un respaldo antes de reintentar**
  ([11.7](#117-restaurar-runbook)): la `app` anterior, con el volumen vacío, escribiría la semilla y
  el siguiente intento la importaría como dato real. Otra salida es el "restaurar semilla" del
  `/admin` anterior, que deja una elección explícita con autor en `current.json`.
- **Para volver a la versión anterior al corte**, vuelve los tres servicios, en el orden de arriba:
  `inventory-manager`, app y `api`. La `api` anterior responde "no disponible" aunque haya filas, así
  que el admin nuevo deja de editar la página y el `/admin` anterior vuelve a ser el único escritor,
  sobre los JSON de antes del corte. Las ediciones hechas en MySQL no se ven mientras tanto (D-3).
- **No combines una `app` del corte con una `api` anterior:** las landings mostrarían la semilla de
  la página (precio del hero de $195 en Birria y $145 en Molotes). El flujo automático no lo produce.
  Tampoco una `api` del corte con un `inventory-manager` y una app anteriores tras dos despliegues
  fallidos seguidos: el admin nuevo editaría MySQL mientras el `/admin` anterior escribe los JSON.
- **Al volver a avanzar**, la importación no se repite. Si algún JSON cambió durante la vuelta atrás,
  el arranque registra `page_json_diverged` (con el negocio, sin contenido) y MySQL no cambia:
  - **Si la vuelta atrás fue en el mismo despliegue del corte** (nadie pudo escribir en MySQL),
    antes de avanzar puedes vaciar las tablas de la página para que la importación se repita con los
    JSON actuales:

    ```sh
    $C exec -T mysql sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" restaurante -e "DELETE FROM page_change; DELETE FROM page_version; DELETE FROM page_import;"'
    ```

    Compruébalo antes: `SELECT COUNT(*) FROM page_change WHERE imported = 0` debe dar `0` (ninguna
    edición hecha en el admin nuevo).
  - **Si ya hubo ediciones en el admin nuevo**, no vacíes nada: pasa a mano, en la pantalla "Página",
    los cambios que se hicieron en el `/admin` anterior durante la vuelta atrás.

### Arrancar la `api` a mano

Úsalo siempre que recrees la `api` fuera de `deploy.sh`: el router del webhook debe coincidir con la
imagen. Si no, el bot se queda fuera sin ningún error: una `api` con webhook y el router apagado da
404 de la app, y una `api` anterior a REQ-F-042 con el router encendido da 502.

```sh
cd /opt/restaurante
CE="docker compose -f deploy/compose.prod.yaml --env-file .env --env-file state/release.env"
API=ghcr.io/orvigas/restaurante-api@sha256:<digest>
sudo -u deploy -H docker pull "$API"
WEBHOOK=$(sudo docker image inspect -f '{{index .Config.Labels "org.restaurante.webhook"}}' "$API" | grep -q whatsapp && echo true || echo false)
sudo env RESTAURANTE_API_IMAGE="$API" RESTAURANTE_API_WEBHOOK="$WEBHOOK" $CE up -d --no-deps api
```

- Sobre una base más nueva que esa imagen, añade `DATABASE_ALLOW_NEWER_SCHEMA=true` a `sudo env`.
- **Alguien tiene que atender el webhook:** una `api` con la etiqueta, o una app anterior a REQ-F-042
  con su bot. Si `WEBHOOK` sale `false` y la app es de REQ-F-042 o posterior, el bot queda sin
  servicio: vuelve también la app a una versión con bot, o usa una `api` con webhook.
- `$C restart api` no recrea nada y conserva el router.
- Comprueba el resultado con [las comprobaciones del webhook](#comprobaciones-del-webhook-req-f-042).

**Imagen de la `api` (REQ-F-038).** Está en `state/release.env` (`RESTAURANTE_API_IMAGE`) después
de cada despliegue correcto. `ops/backup/restore.sh` reescribe ese archivo solo con la app y
migrate, así que **tras una restauración** la línea ya no está. Búscala, por orden, en:

1. el contenedor en marcha: `docker inspect -f '{{.Config.Image}}' "$($C ps -q api)"`;
2. `state/release.env.previous` (`restore.sh` guarda ahí el `release.env` anterior);
3. la última línea `api=sha256:<digest>` de `state/releases.log` (imagen
   `ghcr.io/orvigas/restaurante-api@sha256:<digest>`).

`deploy.sh` hace lo mismo con la primera opción: si `release.env` no tiene la api, toma la del
contenedor en marcha como api anterior para su vuelta atrás.

**Vuelta atrás y webhook (REQ-F-042).** El router del webhook sigue a la imagen de la `api`, no al
compose instalado: `deploy.sh` lee la etiqueta `org.restaurante.webhook` de la imagen y calcula
`RESTAURANTE_API_WEBHOOK` en cada operación.

- **Vuelta atrás automática** (código 21): `deploy.sh` vuelve a la app y después a la `api` anteriores,
  y comprueba que esa `api` queda `healthy` y con el webhook; si no, termina con el código 22. Si esa
  `api` no tiene la etiqueta, el router se apaga y `/webhooks/whatsapp` vuelve al router raíz, es
  decir, a la app. Hasta REQ-F-045 esa app anterior tenía el bot y recibía sus variables; desde la
  limpieza de REQ-F-045 la app no las recibe, pero toda `api` desde REQ-F-042 lleva la etiqueta, así
  que la automática siempre deja el webhook en una `api`.
- **Revert en `main`:** también exige reinstalar el `deploy/` de ese commit (código 4), que no tiene
  el router.

## 7. Registrar el webhook en Meta

El webhook ya está registrado en producción. Este paso solo hace falta en una cuenta nueva: REQ-F-042
no cambia nada en Meta, porque la URL es la misma aunque ahora la atienda `api`.

Con la `api` en marcha detrás de HTTPS:

1. En la app de Meta: **WhatsApp → Configuración → Webhook**.
2. URL de devolución de llamada: `https://birriaelmuneco.com/webhooks/whatsapp`. Token de
   verificación: el valor de `WHATSAPP_BOT_VERIFY_TOKEN`.
3. Suscribe el campo `messages`.

Detalles y prerrequisitos de Meta en
[Registrar el webhook en Meta](../README.md#registrar-el-webhook-en-meta-producción). Sin el bot,
las landings funcionan igual: deja vacías las `WHATSAPP_BOT_*`.

Con el bot habilitado, `.env` también necesita `WHATSAPP_BOT_BLOCKLIST_KEY` (REQ-F-025): genérala
con `openssl rand -base64 32` y guárdala en el gestor de contraseñas. Sin ella la `api` y la app no
arrancan.
Si el bot ya estaba activo cuando llega la versión que la exige, el orden es:

1. Añade la clave al `.env` del VPS.
2. Haz el merge; si el job `deploy` falla con el código 4 (`deploy/` cambió), reinstala `deploy/`
   (paso 1.3) y vuelve a ejecutar el job.

Los umbrales de los topes (`BOT_LIMIT_*`, `BOT_BUDGET_MONTH_USD`...) son opcionales: vacíos usan los
valores por defecto (ver `README.md`, "Topes de gasto, lista negra e interruptor").

## 8. Comprobaciones después de cada despliegue

1. Actions → `deploy` en verde, con el resumen **Desplegado**: el commit (SHA corto enlazado y SHA
   completo) y los digests.
2. `https://birriaelmuneco.com/`, `/molotes` y `/birria` responden 200.
   `https://admin.birriaelmuneco.com/acceso` muestra el acceso del admin nuevo. Desde REQ-F-045,
   `/admin` de las landings lleva ahí y no deja escribir:

   ```sh
   curl -s -o /dev/null -D - https://birriaelmuneco.com/admin/login | grep -iE '^(HTTP|location|set-cookie)'
   # HTTP/2 302 y location: https://admin.birriaelmuneco.com/ (sin set-cookie)
   curl -s -o /dev/null -w '%{http_code}\n' -X POST -d x=1 https://birriaelmuneco.com/admin/login
   # 410
   ```

   `$C logs app` tiene `server_started` sin ningún `database_*`: la app ya no usa la base.
3. En el log de `api`: `server_started` y, con el bot, `bot_provider_selected` con `meta`. Vigila
   `bot_staff_delivery_failed` y `bot_webhook_signature_invalid`.
4. **Control del bot (REQ-F-043), como administrador:**
   - `https://admin.birriaelmuneco.com/bot` muestra el estado, los contadores y la lista negra.
5. **Despliegue del corte de la página (REQ-F-044), una sola vez** (aplicado; se conserva como
   referencia: desde la limpieza de REQ-F-045 la app no monta `app-data` y el primer comando ya no
   funciona):
   - **Antes de desplegar**, en el VPS: el tamaño de `changes.jsonl` y que existan los
     `current.json` de los dos negocios en `app-data` (sin mirar su contenido):

     ```sh
     $C exec -T app sh -c 'cd /var/lib/restaurante && ls -l changes.jsonl molotes/current.json birria/current.json && wc -l changes.jsonl'
     ```

     Si falta un `current.json`, no despliegues: la importación se negaría
     ([§6](#vuelta-atrás-tras-el-corte-de-la-página-req-f-044)).
   - **Después:** `$C logs app` tiene dos `page_import_done` (con `source` `current`, salvo un JSON
     dañado) y ningún `page_import_failed`; `page_import` tiene dos filas:

     ```sh
     $C exec -T mysql sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" restaurante -e "SELECT business, source, source_version, history_count, skipped_lines FROM page_import"'
     ```

   - `/`, `/molotes` y `/birria` muestran el mismo hero, destacado y promoción que antes.
   - `https://admin.birriaelmuneco.com/molotes/pagina` permite editarla. Un cambio de prueba se ve
     en la landing y se deshace con "Restaurar versión anterior".
6. **Primer despliegue de REQ-F-043, una sola vez (fila histórica del personal):** el botón de
   "alcanzaron un tope hoy" estuvo activo hasta REQ-F-042 y un número del personal pudo quedar
   bloqueado, porque la lista negra no exime al personal. Compara la lista negra de la pantalla "Bot"
   con los 4 últimos dígitos de `WHATSAPP_BOT_STAFF_MOLOTES` y `WHATSAPP_BOT_STAFF_BIRRIA`, sin copiarlos en un ticket ni en el
   chat. Si alguno coincide, quítalo con «Quitar»: queda en `bot_audit` como `block_removed`.

### Comprobaciones del webhook (REQ-F-042)

Tras el primer despliegue con el bot en `api` y tras cualquier vuelta atrás. `<token>` es
`WHATSAPP_BOT_VERIFY_TOKEN`; no lo pegues en un ticket ni en el chat.

| Comprobación | Cómo |
| ------------ | ---- |
| Verificación con el token correcto | `curl -s 'https://birriaelmuneco.com/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=123'` → `123` |
| Token incorrecto | Igual con otro token → 403, y `bot_webhook_verify_failed` en `$C logs api` |
| Lo atiende `api` | Sin cabecera CSP: `curl -sI -X GET 'https://birriaelmuneco.com/webhooks/whatsapp' \| grep -ic content-security-policy` → `0`. `$C logs api` tiene `bot_provider_selected` y la línea `request` de esa ruta; `$C logs app`, no |
| Firma | `curl -s -o /dev/null -w '%{http_code}\n' -X POST https://birriaelmuneco.com/webhooks/whatsapp -d '{}'` → 401, y `bot_webhook_signature_invalid` en `$C logs api` |
| Un mensaje real | Escribe al número del bot: responde, y `$C logs api` lo refleja |
| Otras rutas de `api` no expuestas | `curl -si https://birriaelmuneco.com/api/v1/admin/sesion` y `.../api/v1/public/birria/productos` → 404 con `Content-Security-Policy`: las responde `app`, no `api`. Para el log de `api`, usa una ruta inventada, como `/api/v1/admin/sonda-ca3`: no debe aparecer (la ruta de sesión sí la llama `inventory-manager`) |
| Ruta exacta | `.../webhooks/whatsapp/` y `.../webhooks/` → 404 |
| El sitio sigue igual | `/`, `/molotes` y `/birria` → 200; `/admin` → 302 al admin nuevo (REQ-F-045) |
| Vuelta atrás (solo tras volver a una versión de antes de REQ-F-042) | La verificación con el token correcto responde `123` y sí lleva CSP: la atiende `app` |
| Memoria (§10 de la [arquitectura](arquitectura.md#10-riesgos)) | `free -m` y `sudo docker stats --no-stream`; compara con el 31,5 % y el umbral del 80 % |

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
   CE="docker compose -f deploy/compose.prod.yaml --env-file .env --env-file state/release.env"
   sudo env RESTAURANTE_APP_IMAGE=ghcr.io/orvigas/restaurante@sha256:<digest> $CE up -d --no-deps app
   ```

   Si el volcado es de un commit con otra `api` (sus digests también están en
   `state/releases.log`), arráncala con [Arrancar la `api` a mano](#arrancar-la-api-a-mano), nunca solo
   con `RESTAURANTE_API_IMAGE`: una `api` anterior a REQ-F-042 heredaría el router encendido de
   `state/release.env` y el webhook daría 502. Con otro `inventory-manager`, arráncalo igual con
   `sudo env RESTAURANTE_INVENTORY_IMAGE=<imagen> $CE up -d --no-deps inventory-manager`.

   Desde REQ-F-045 la app no usa la base: lo que debe corresponder al volcado es la `api`, que
   verifica las migraciones al arrancar.

2. Los permisos de los usuarios (`GRANT ... ON restaurante.*`) sobreviven al `DROP DATABASE`.
   La página (REQ-F-044) vuelve con el volcado, incluida su marca `page_import`. Desde REQ-F-045
   nada la reimporta: con un volcado anterior a la importación (antes del 2026-11-16), la pantalla
   "Página" queda "no disponible" y las landings muestran la página de la semilla (RN-4 de
   REQ-F-045; ver [11.7](#117-restaurar-runbook)). El inventario (REQ-F-049: `inventory_category`,
   `inventory_item`, `inventory_item_unit`, `inventory_sku` e `inventory_change`) también vuelve
   con el volcado; con uno anterior a la épica, el inventario queda vacío.
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
| Código 15 (REQ-F-038) | La `api` nueva no quedó `healthy` o Traefik no le enruta `/webhooks/whatsapp` (REQ-F-042); se volvió a la anterior si la había. La app no se tocó, haya o no migraciones nuevas (REQ-F-047): este código nunca pasa a 22 por la salud de la app; si ya estaba caída, sigue igual y se diagnostica aparte (`$C ps app`) | `$C logs api`: suele ser la base (`database_init_failed`), la imagen o, con el bot, su configuración (lista los problemas sin valores). Si la `api` estaba `healthy`, revisa el router `restaurante-webhook` en Traefik y que la `api` esté en `traefik-public`. Las landings siguen con su última copia buena y el webhook, donde estaba. Corrige y vuelve a desplegar |
| Código 16 (REQ-F-039) | `inventory-manager` no quedó `healthy` o Traefik no lo enruta en `admin.<dominio>`; volvió al anterior (o se detuvo si no lo había). La app no se tocó, haya o no migraciones nuevas (como en el código 15); la `api` nueva sigue. En el primer despliegue de REQ-F-042 quedan a la vez la `api` con el bot y la app anterior: el webhook va a la `api`, pero el mantenimiento del control puede correr en las dos hasta el siguiente despliegue y duplicar alguna auditoría de caducidad | `$C logs inventory-manager`: suele ser la configuración (`API_INTERNAL_URL`) o la imagen. Comprueba `RESTAURANTE_ADMIN_DOMAIN` y los routers `restaurante-inventory*` de Traefik. Hasta un despliegue correcto queda el `inventory-manager` anterior |
| `products_notify_failed` / `products_notify_gave_up` en `api` | El aviso interno a `app` (puerto 3002) falla: `app` caída o credencial distinta | `$C ps app`; comprueba que `RESTAURANTE_INTERNAL_NOTIFY_TOKEN` sea la misma para las dos (la reciben del mismo `.env`). Mientras tanto, la landing ve el cambio como mucho en 60 s; el bot, al instante |
| `POST /webhooks/whatsapp` responde 404 con CSP, o el bot no contesta | La ruta llegó a `app`: `api` caída o reiniciándose, o su router apagado | `$C ps api`; `docker inspect -f '{{index .Config.Labels "traefik.enable"}}' "$($C ps -q api)"` debe decir `true`. Si dice `false` con la imagen actual, recréala con [Arrancar la `api` a mano](#arrancar-la-api-a-mano). Meta reintenta lo que no recibió 200 |
| El webhook responde 503 `BOT_DISABLED` | La `api` no ve variables del bot | Revisa las `WHATSAPP_BOT_*` del `.env` y recrea la `api` |
| `/webhooks/whatsapp` responde 502 | Traefik enruta a una `api` que no escucha en el 3004: una `api` anterior a REQ-F-042 con el router encendido, o una `api` recreada a mano. Su healthcheck no mira el 3004 y sale `healthy` | `sudo docker image inspect -f '{{index .Config.Labels "org.restaurante.webhook"}}' "$($C ps -q api \| xargs sudo docker inspect -f '{{.Config.Image}}')"`: si no dice `whatsapp`, recréala con [Arrancar la `api` a mano](#arrancar-la-api-a-mano). Meta reintenta lo que no recibió 200 |
| `restore.sh` termina con `AVISO: el bot queda SIN SERVICIO` | App restaurada sin bot y `api` sin router | [Arrancar la `api` a mano](#arrancar-la-api-a-mano) con una `api` con webhook, o vuelve a desplegar |
| `bot_api_error` sin respuesta de Meta en `api` | Sin salida a internet | Comprueba que la `api` esté en `traefik-public` (`$C ps`, `docker inspect`) |
| `admin.<dominio>` responde 429 | Límite de Traefik del admin nuevo (60 por minuto por IP, ráfaga de 60) | Espera un minuto |
| Las landings registran `landing_products_fallback` | La `api` no responde, tarda más de 1,5 s o devuelve algo fuera del contrato | `$C ps api` y `$C logs api`. Las landings sirven su última copia buena (o la semilla tras reiniciar `app`) y vuelven solas cuando la api responde (`landing_products_recovered`) |
| Código 20 | Primer despliegue sin versión anterior y la app no arranca | `$C logs app`: suele ser el `.env` (`ConfigError` lista los problemas) |
| Código 21 | La versión nueva no arrancó; se volvió a la anterior | Corrige y vuelve a desplegar. La `api` anterior corre con `DATABASE_ALLOW_NEWER_SCHEMA=true` si hubo migración |
| Código 22 | Tampoco arrancó la versión anterior | [Restaura la base](#9-restaurar-la-base-desde-un-volcado) y arranca la versión del volcado |
| Código 22 con `la app anterior está restaurada` (REQ-F-042) | La app volvió, pero la `api` anterior no quedó `healthy` o Traefik no le enruta el webhook: el bot puede estar sin servicio | `$C ps api` y `$C logs api`. Arranca una `api` que funcione con [Arrancar la `api` a mano](#arrancar-la-api-a-mano) o vuelve a desplegar. No hace falta restaurar la base |
| `/admin` responde 404 en lugar del 302 | La app no recibe `ADMIN_NEW_URL` (REQ-F-045) | Revisa `RESTAURANTE_ADMIN_DOMAIN` en el `.env` y que el `deploy/` instalado sea el de `main` |
| `database_init_failed` en `$C logs api` | Base inalcanzable, credenciales, migraciones pendientes o base más nueva que el código | Según el código del log ([Base de datos](../README.md#base-de-datos)). Desde REQ-F-045 solo la `api` usa la base |

## 11. Respaldos fuera del VPS

REQ-F-019. Objetivo: perder como mucho 24 h de datos (RPO) y recuperar el servicio en 2 h o menos
(RTO).

### 11.1 Qué hace

- **Cuándo:** cada día a las 03:00 de `America/Mexico_City` (`restaurante-backup.timer`; el host
  está en UTC). Si el VPS estaba apagado a esa hora, se ejecuta al arrancar.
- **Qué guarda:**
  - un `mysqldump` de `restaurante` hecho con el usuario de solo lectura `restaurante_backup` (con
    la página desde REQ-F-044: `page_version`, `page_change` y `page_import`; y el inventario
    desde REQ-F-049: `inventory_category`, `inventory_item`, `inventory_item_unit`, `inventory_sku`
    e `inventory_change`, sin cambiar los scripts);
  - un manifiesto con los conteos de `user` y `product`, la última migración, las imágenes y el
    commit de `state/release.env`, y las sumas sha256.
- **Formatos:**
  - **2** (desde la limpieza de REQ-F-045, cuyos scripts se instalan justo antes de su merge, con
    la app del PR 2; ver [1.3](#13-instalar-deploy)): manifiesto y volcado. El volumen
    `restaurante_app-data` no se respalda: la app no lo usa y, desde la limpieza, nadie lo monta (se
    conserva en el VPS).
  - **1** (los anteriores, que siguen en R2 hasta que caduquen): además, `app-data.tar`, el volumen
    `restaurante_app-data` sin los temporales. Todos llevan una imagen de la app anterior a la
    limpieza, con la carpeta de `DATA_DIR`.

  `restore.sh` y `verify-backup.sh` aceptan los dos.
- **Integridad:** un volcado incompleto o dañado no se cifra ni se sube.
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
| 5 | Falló el volcado |
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

Para actualizar los scripts, repite `scp` y los `install`, y después `daemon-reload`. Excepción:
los de la limpieza de REQ-F-045 se instalan desde la rama del PR, antes de su merge
([1.3](#13-instalar-deploy)). Nada de esto
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
6. Solo con un respaldo de formato 1: vacía y restaura el volumen `app-data` (lo crea si no existe).
   Ningún servicio lo monta; queda para una vuelta a una versión anterior a REQ-F-045.
7. Arranca **la imagen de la app del respaldo** y espera a que esté `healthy`.
8. Actualiza `state/release.env` y anota la restauración en `state/releases.log`.

`restore.sh` no toca `api` ni `inventory-manager` (REQ-F-039): siguen con su imagen. Si el respaldo
es de un commit con otra `api`, arráncala con [Arrancar la `api` a mano](#arrancar-la-api-a-mano);
`inventory-manager` no guarda datos, así que basta con que siga en marcha.

**El bot tras restaurar (REQ-F-042).** La `api` en marcha conserva su router. Solo hay un caso sin
servicio: una app restaurada sin bot y una `api` sin router. Entonces `restore.sh` termina con 0,
porque los datos sí están restaurados y repetirlo no cambiaría nada, pero su última línea es
`AVISO: el bot queda SIN SERVICIO`. Si la ves, arranca una `api` con webhook o vuelve a desplegar.

Al terminar imprime la duración de cada fase y el tiempo sin servicio.

```sh
sudo -u deploy /opt/restaurante/ops/backup/restore.sh latest                 # último de daily/
sudo -u deploy /opt/restaurante/ops/backup/restore.sh monthly/restaurante-20261101T090000Z.tar.age
sudo -u deploy /opt/restaurante/ops/backup/restore.sh /opt/restaurante/offsite/restaurante-<fecha>.tar.age
```

Después, haz las comprobaciones del [paso 8](#8-comprobaciones-después-de-cada-despliegue).

**Casos:**

- **Respaldo anterior a REQ-F-045** (formato 1 con una app anterior al PR 2 de REQ-F-045, del
  2026-11-17 o antes): esa app necesita la base y `DATA_DIR`, que el compose actual ya no le pasa, y
  `restore.sh` termina con el código 12 con la base y `app-data` ya restaurados. Vuelve a desplegar
  la punta de `main` ([Redesplegar](#redesplegar-la-punta-de-main)): migra la base si hace falta y
  arranca la app y la `api` actuales. Si de verdad necesitas esa versión, sigue
  [Volver a una versión anterior a REQ-F-045](#volver-a-una-versión-anterior-a-req-f-045).
- **Respaldo de formato 2 con la app del PR 2 de REQ-F-045** (hecho entre la instalación de los
  scripts nuevos y el merge de la limpieza, [1.3](#13-instalar-deploy)): se restaura como cualquier
  otro de formato 2. Esa app no usa la base ni `DATA_DIR` y arranca con el compose actual.
- **Limitación conocida:** un respaldo de formato 1 con la imagen de la app de la limpieza o posterior
  (sin la carpeta de `DATA_DIR`) no se restaura sobre un volumen `app-data` nuevo: `restore.sh`
  termina con el código 11, con la base restaurada y la app parada, y el `--drill` falla. Con el
  orden de [1.3](#13-instalar-deploy) no se genera ninguno. Si aparece, usa otro respaldo, o
  redespliega la punta de `main` ([Redesplegar](#redesplegar-la-punta-de-main)), que arranca la app
  sin `app-data`.
- **Respaldo anterior al 2026-11-16 (antes de la importación de la página, RN-4 de REQ-F-045):** la
  base vuelve sin filas de página y nada las reimporta. La pantalla "Página" del admin nuevo queda
  "no disponible" y las landings muestran la página de la semilla (precio del hero de $195 en Birria
  y $145 en Molotes) hasta que la corrijas a mano en "Página".
- **Migración a medias (`MIGRATION_INCOMPLETE`) justo tras un despliegue:** usa primero el volcado
  previo de `deploy.sh` ([paso 9](#9-restaurar-la-base-desde-un-volcado)), que es más reciente. Solo
  si no sirve, usa el último respaldo de R2.
- **El respaldo es más viejo que el código (`MIGRATIONS_PENDING`):** el siguiente despliegue desde
  `main` aplica las migraciones pendientes con su volcado previo. Desde REQ-F-045 la app no
  verifica la base: la que lo hace es la `api`, que `restore.sh` no toca, y solo al arrancar. Si el
  respaldo es más viejo que la `api` en marcha, vuelve a desplegar la punta de `main` en cuanto
  termine la restauración.
- **`DATABASE_NEWER_THAN_CODE`:** la base tiene migraciones que la imagen arrancada no conoce, por
  ejemplo si se arrancó a mano una imagen anterior. Arranca la imagen del respaldo (la que imprime
  `restore.sh`, también en `state/release.env`). `DATABASE_ALLOW_NEWER_SCHEMA=true` solo se usa
  como en la vuelta atrás de `deploy.sh`, nunca en el `.env`.
- **Inventario (REQ-F-049):** vuelve completo con el volcado (artículos, unidades, categorías e
  historial). El manifiesto no cuenta sus filas; para comprobarlo tras restaurar:

  ```sh
  $C exec -T mysql sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" restaurante -e "SELECT (SELECT COUNT(*) FROM inventory_item) AS articulos, (SELECT COUNT(*) FROM inventory_category) AS categorias, (SELECT COUNT(*) FROM inventory_change) AS cambios"'
  ```

  Compáralo con la misma consulta en producción antes del incidente si la tienes, o revisa en la
  sección "Inventario" del admin que la lista y el historial de algunos artículos estén.
- **VPS nuevo:**
  1. Prepara el VPS con los pasos 1.1 a 1.6, instala `deploy/` y la sección 11.5 sin activar el
     timer.
  2. Recupera el `.env` desde tu Mac. Con la credencial de solo lectura, descarga el último objeto
     de `env/` y descífralo con `age -d -i <archivo con la clave> -o .env <copia>.env.age`.
  3. Copia el `.env` a `/opt/restaurante/.env` (`deploy`, `600`).
  4. Haz `docker login ghcr.io` como `deploy` (paso 1.4) y ejecuta `restore.sh latest`. Crea
     MySQL, la base y los usuarios, y después restaura.
  5. `restore.sh` no conoce la `api` (REQ-F-038): solo arranca la
     app. En un VPS nuevo la `api` no está en marcha y las landings sirven la semilla de
     `content/seeds.ts` (sin errores 5xx) hasta que la levantes, y el bot no atiende a nadie.
     Vuelve a desplegar la punta de `main` ([Redesplegar](#redesplegar-la-punta-de-main)), o
     arráncala con [Arrancar la `api` a mano](#arrancar-la-api-a-mano). La imagen sale de
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
5. Solo con un respaldo de formato 1: comprueba los JSON de `molotes/` y `birria/` de `app-data`.
6. Con `--drill`, arranca además la imagen de la app del respaldo y espera a que responda. Con un
   respaldo de formato 1 le da también esa base y ese `app-data`, que la app de entonces
   necesitaba; desde REQ-F-045 la app no usa ninguno de los dos.

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
