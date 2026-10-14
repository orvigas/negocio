# REQ-F-019 — Respaldos cifrados y restauración probada

## Estado

DONE

Pull Request: https://github.com/orvigas/negocio/pull/51 (mergeado el 2026-10-14, commit de merge `9f62592`). Corrección posterior de la prueba mensual en macOS: https://github.com/orvigas/negocio/pull/56. Verificación posterior P-1 a P-4 registrada en `## Cierre`.

## Aprobación

Aprobado por el usuario (versión 1, fecha 2026-10-14), con la respuesta "Aprobar".

## Objetivo

Que la pérdida del VPS, un borrado accidental o una migración a medias no cuesten más de 24 h de datos (RPO) y se recuperen en 2 h o menos (RTO), con un procedimiento probado.

## Alcance

- Respaldo diario automático, cifrado y fuera de Hostinger.
- Aviso si el respaldo falla o falta.
- Runbook de restauración completa.
- Prueba de restauración mensual manual.
- Copia cifrada del `.env` cuando cambie.

## Fuera de alcance

- Los volcados previos al despliegue de `deploy.sh` (siguen solo en local).
- Migrar `app-data` a un bind mount.
- Alertas generales (REQ-F-022).
- Snapshots del panel de Hostinger.
- Respaldo de `secrets/` aparte del `.env`.
- Binlogs o un RPO menor de 24 h.

## Requisitos

- **RF-1 Contenido.** Cada respaldo incluye un `mysqldump` consistente de `restaurante` en utf8mb4, hecho con el usuario de solo lectura `restaurante_backup`, y un archivo del volumen `app-data` completo (JSON de `molotes/` y `birria/`, y `changes.jsonl`), leído tal como está.
- **RF-2 Integridad.** Un volcado incompleto o corrupto no se cifra ni se sube: la ejecución falla.
- **RF-3 Cifrado.** Todo se cifra con `age` usando solo la clave pública antes de salir del VPS. La clave privada nunca está en el VPS.
- **RF-4 Destino.** Bucket de Cloudflare R2 con bloqueo de objetos o versionado. La credencial del VPS no puede borrar ni sobrescribir respaldos existentes.
- **RF-5 Programación.** Timer de systemd en el host, diario a las 03:00 de America/Mexico_City.
- **RF-6 Retención.** En R2, 7 diarios, 4 semanales y 6 mensuales, aplicada por el propio bucket, ya que el VPS no puede borrar. En el VPS, los últimos 7 respaldos cifrados, con permisos 600, en una carpeta separada de la de `deploy.sh`.
- **RF-7 Ubicación.** Scripts y unidades de systemd fuera de `restaurante/deploy/`, en una carpeta propia con su procedimiento de instalación documentado. Instalarlos o cambiarlos no altera la verificación SHA-256 de `deploy/`.
- **RF-8 Aviso.** Ping a Healthchecks.io (plan gratuito) tras cada respaldo correcto y ping de fallo si falla. Si no llega ningún ping en el plazo configurado, Healthchecks avisa al usuario. La URL del ping es un secreto y no está en el repositorio.
- **RF-9 `.env`.** Cuando cambie el `.env` de producción, se sube una copia cifrada con `age` al mismo bucket.
- **RF-10 Restauración.** Runbook y script para restaurar la base y `app-data` desde un respaldo de R2: parar la app, descifrar (con la clave privada fuera del VPS o introducida a mano), cargar, restaurar `app-data`, arrancar y verificar la salud. Cubre la migración a medias y `DATABASE_NEWER_THAN_CODE`.
- **RF-11 Prueba mensual.** El usuario, desde su Mac, descarga el último respaldo con una credencial de solo lectura que no vive en el VPS, lo descifra, lo carga en un MySQL 8.4 efímero y comprueba los conteos de `user` y `product`, la última `_prisma_migrations` y la presencia de los JSON de `app-data`. Registra el resultado (fecha, respaldo usado, conteos, éxito o fallo) en el lugar que se documente.
- **RF-12 Documentación.** `docs/despliegue.md` cubre la instalación, las credenciales, el runbook y la prueba mensual.

## Reglas de negocio

- RPO de 24 h y RTO de 2 h.
- La clave privada de `age` la guarda el usuario en su gestor de contraseñas. La segunda persona queda pendiente de definir.
- Ningún secreto en argumentos de línea de comandos ni en logs.

## Criterios de aceptación

- **CA-1.** Given el timer instalado, when son las 03:00 de México, then aparece en R2 un respaldo nuevo cifrado y Healthchecks recibe un ping de éxito.
- **CA-2.** Given un volcado que falla o está truncado, when se ejecuta el respaldo, then no se sube nada, la salida es distinta de 0 y Healthchecks recibe el fallo.
- **CA-3.** Given que no llega ningún respaldo en el plazo configurado, then Healthchecks avisa al usuario.
- **CA-4.** Given la credencial del VPS, when intenta borrar o sobrescribir un respaldo existente, then la operación se rechaza o la versión anterior sigue siendo recuperable.
- **CA-5.** En el VPS no hay ninguna clave privada de `age`. Los respaldos locales tienen permisos 600 y no pasan de 7.
- **CA-6.** Tras instalar los scripts, la verificación SHA-256 de `deploy/` sigue pasando sin reinstalar `deploy/`.
- **CA-7.** Siguiendo la prueba mensual en el Mac con el último respaldo de R2, los conteos y la migración coinciden con producción en el momento del respaldo, y el resultado queda registrado.
- **CA-8.** Antes de cerrar el ticket hay una restauración real superada y registrada, con un tiempo medido dentro del RTO.
- **CA-9.** Al cambiar el `.env` aparece en R2 una copia cifrada nueva.
- **CA-10.** La retención del bucket (7, 4 y 6) está configurada y documentada.

## Casos límite

- La subida falla: se queda la copia local y se envía el aviso.
- El disco se llena.
- El respaldo coincide con un despliegue: no deben interferir.
- Se pierde la clave privada.
- Se compromete el VPS: no puede borrar respaldos.
- Se restaura un respaldo más antiguo que la última migración.

## Dependencias

- REQ-F-016 (en producción).
- Lo que hace el usuario: crear la cuenta de Cloudflare y el bucket con su protección y retención, la credencial del VPS y la credencial de solo lectura para el Mac, el par de claves `age` y el check de Healthchecks.io, y tener Docker y `age` en su Mac.

## Riesgos

- **Segunda persona pendiente.** Hoy la clave privada la guarda una sola persona. Si se pierde, todos los respaldos quedan inútiles (I-7).
- **[verificar] Permisos y protección de R2.** Los tokens de R2 podrían no permitir escribir sin borrar, y R2 podría ofrecer bloqueo de bucket por prefijo en lugar de versionado S3. En ese caso, CA-4 se cumple con reglas de bloqueo, que deben ser compatibles con la retención de RF-6 (un bloqueo más largo que la expiración la impide). Lo resuelve la revisión técnica.
- **La prueba mensual es manual** y no tiene recordatorio automático.
- **Filtración de la URL de Healthchecks:** permitiría enviar pings falsos. Riesgo bajo.

## Action Plan

1. El usuario crea el bucket de R2 con su protección y retención, las dos credenciales, las claves `age` y el check de Healthchecks.
2. Script de respaldo (RF-1 a RF-3, RF-6 y RF-8).
3. Unidades de systemd y procedimiento de instalación fuera de `deploy/` (RF-5 y RF-7).
4. Copia cifrada del `.env` (RF-9).
5. Script y runbook de restauración (RF-10).
6. Procedimiento de la prueba mensual desde el Mac y su registro (RF-11).
7. Documentación (RF-12).
8. Instalación en el VPS, primer respaldo y restauración real medida (CA-8).

## Technical Action Plan

### Objetivo técnico

Scripts de shell (bash, sin dependencias de Node) y unidades de systemd en `restaurante/ops/backup/`, instalados en el host fuera de `/opt/restaurante/deploy/`, que cada día vuelcan la base y `app-data`, verifican, cifran con `age` y suben a R2 con una credencial que no puede borrar ni sobrescribir lo bloqueado; más restauración, prueba mensual y documentación.

### Verificación de R2 (riesgo [verificar])

Fuentes consultadas el 2026-10-14: [Authentication / tokens](https://developers.cloudflare.com/r2/api/tokens/) (act. 2026-10-01), [Bucket locks](https://developers.cloudflare.com/r2/buckets/bucket-locks/) (act. 2026-04-30), [Object lifecycles](https://developers.cloudflare.com/r2/buckets/object-lifecycles/) (act. 2026-04-21), [S3 API compatibility](https://developers.cloudflare.com/r2/api/s3/api/).

- **Tokens:** solo hay `Object Read & Write` (leer, escribir y listar; acotable a un bucket) y `Object Read only`. No existe "escribir sin borrar": con `Object Read & Write` un `DeleteObject` o un `PutObject` sobre la misma clave están permitidos por el token. Los tokens de objeto no pueden cambiar la configuración del bucket (bloqueos, ciclo de vida): eso exige `Admin Read & Write`.
- **Versionado:** R2 no implementa `PutBucketVersioning`/`GetBucketVersioning` ni las cabeceras `x-amz-object-lock-*`. No hay versiones recuperables.
- **Bucket locks:** reglas por prefijo (hasta 1000) con retención por edad, fecha o indefinida; impiden **borrar y sobrescribir** los objetos cubiertos, nuevos y existentes; si varias aplican, gana la más larga; **prevalecen sobre el ciclo de vida** (un objeto bloqueado no se expira hasta que vence el bloqueo).
- **Ciclo de vida:** reglas por prefijo con expiración por edad; borra en las 24 h siguientes al vencimiento.
- **Conclusión:** CA-4 se cumple con bucket locks (la operación se rechaza), no con versionado. La protección está en el bucket y el token del VPS no puede quitarla. Además el script escribe con `If-None-Match: *` (soportado en `PutObject`), así que tampoco sobrescribe por error una clave aún no bloqueada.

**Diseño de retención compatible (RF-6, CA-10).** El VPS no borra: escribe cada respaldo en el prefijo de cada nivel que le toca (los archivos pesan unos KB, la triple copia es irrelevante) y el bucket expira cada prefijo. Bloqueo 1 día más corto que la expiración, para que el ciclo de vida pueda borrar sin depender de reintentos:

| Prefijo | Se escribe | Bucket lock | Expiración | Copias resultantes |
| ------- | ---------- | ----------- | ---------- | ------------------ |
| `daily/` | cada día | 7 días | 8 días | 7-8 |
| `weekly/` | domingo (fecha de México) | 28 días | 29 días | 4-5 |
| `monthly/` | día 1 | 180 días | 186 días | 6-7 |
| `env/` | al cambiar el `.env` | 180 días | 365 días | (ver D-3) |

Ventana residual aceptada: con el VPS comprometido, se podrían borrar solo los objetos cuyo bloqueo ya venció (más viejos que 7/28/180 días), así que los 7, 4 y 6 mínimos siempre sobreviven.

### Archivos o componentes afectados

Nuevos en `restaurante/ops/backup/`:

- `lib.sh`: lectura de configuración sin `source` (mismo patrón que `env_value` de `deploy.sh`), `log`, ping a Healthchecks, `s3_put`/`s3_get`/`s3_list` con `curl --aws-sigv4`.
- `backup.sh`: respaldo diario (RF-1 a RF-3, RF-6, RF-8) y, al final, la comprobación del `.env` (RF-9).
- `env-backup.sh`: copia cifrada del `.env` si cambió (RF-9).
- `restore.sh`: restauración en el VPS (RF-10).
- `verify-backup.sh`: prueba mensual y simulacro de restauración en el Mac (RF-11, CA-7, CA-8); compatible con bash 3.2 y utilidades BSD de macOS.
- `systemd/restaurante-backup.service`, `.timer`, `restaurante-env-backup.service`, `.path`.
- `backup.env.example` (variables, sin valores), `ci/smoke.sh`.

Modificados: `.github/workflows/ci.yml` (job `despliegue`: shellcheck y prueba de humo de respaldos), `restaurante/.dockerignore` (excluir `ops`), `restaurante/docs/despliegue.md` (nueva sección y §9 actualizada), `restaurante/README.md` (enlace). Sin cambios en `restaurante/deploy/` ni en `src/` (CA-6).

### Backend / scripts

**Cliente de subida (punto 2): `curl --aws-sigv4` del host**, sin `rclone` ni `aws`. `curl` 8.5 ya está en el VPS y en macOS; no hay paquete nuevo ni descarga de imagen a las 03:00; las credenciales van en un archivo de configuración de curl (`-K` con sustitución de proceso, `user = "id:secret"`), nunca en argv. Subida con `If-None-Match: *`, `--retry 5`, y comprobación posterior con `HEAD` (tamaño). Listado con `ListObjectsV2` (`list-type=2&prefix=`) y extracción de `<Key>`. Alternativa si la firma de curl diera problemas con R2 en la prueba real: imagen `rclone/rclone` fijada por digest en un contenedor efímero.

**Volcado y `app-data` sin secretos expuestos (punto 3):**

- Contenedor de MySQL localizado por etiquetas (`com.docker.compose.project=restaurante`, `service=mysql`) con `docker ps -q --filter`; sin interpolar el compose ni leer el `.env`.
- `mysqldump` dentro del contenedor con el mismo patrón de `deploy.sh`: archivo de opciones temporal creado con `umask 077` desde `$RESTAURANTE_DB_BACKUP_PASSWORD` del entorno del contenedor; mismas opciones (`--single-transaction`, utf8mb4, `--databases restaurante`).
- Manifiesto previo al volcado, con el mismo usuario `restaurante_backup`: conteos de `user` y `product`, última migración terminada de `_prisma_migrations` y `RESTAURANTE_APP_IMAGE`/`RESTAURANTE_MIGRATE_IMAGE`/`RESTAURANTE_COMMIT` de `state/release.env`. Sirve para comparar en la prueba mensual (CA-7) y para saber qué imagen arrancar al restaurar.
- `app-data`: `docker run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges -v restaurante_app-data:/data:ro --entrypoint tar <imagen de la app de release.env> -C /data -cf - --exclude='.*.tmp' .`, con el usuario por defecto de la imagen (el dueño de los archivos 600; sin capacidades, root no podría leerlos). La imagen ya está en el host. Las escrituras de la app son atómicas (`writeFileAtomic`: temporal + `rename`), así que leer "tal como está" no ve JSON a medias; se excluyen los temporales.
- Integridad (RF-2): `gzip -t` + última línea `-- Dump completed`; `tar -tf` con `molotes/` y `birria/` presentes; `sha256` de cada parte en el manifiesto. Cualquier fallo: no se cifra ni se sube, salida distinta de 0, ping de fallo (CA-2).
- Paquete `restaurante-<AAAAMMDDTHHMMSSZ>.tar` (dump.sql.gz, app-data.tar, manifest.txt) → `age -R /etc/restaurante-backup/recipients.txt` → `.tar.age`. El texto claro vive solo en un `mktemp -d` 700 y se borra con `trap`. `recipients.txt` admite varias claves públicas: la segunda persona se añade después sin tocar scripts.
- Local (RF-6, CA-5): `/opt/restaurante/offsite/` (deploy, 700), archivos 600, se conservan los 7 más recientes. Si la subida falla se conserva la copia, se marca pendiente, se envía el fallo y la siguiente ejecución reintenta las pendientes.
- Disco lleno: comprobación de espacio libre mínimo antes de empezar (fallo + ping).

**Convivencia con `deploy.sh` (punto 4):** `backup.sh` abre `/opt/restaurante/state/deploy.lock` y toma `flock -w 1800` (el mismo candado y modo exclusivo). Lo mantiene solo durante volcado + `tar` (segundos); cifrado y subida van fuera del candado. Si no lo consigue en 30 min: fallo y ping. `deploy.sh` ya espera hasta 1800 s, así que tampoco falla por el respaldo.

**`.env` (punto 6, RF-9):** unidad `.path` con `PathChanged=/opt/restaurante/.env` que lanza `env-backup.sh`; el respaldo diario también la ejecuta (red de seguridad si el editor reemplaza el archivo y la vigilancia no lo ve). Compara el `sha256` del `.env` con el del último subido (`/opt/restaurante/offsite/env.sha256`, 600) y solo si difiere cifra y sube `env/<AAAAMMDDTHHMMSSZ>.env.age`. El hash nunca va a la clave del objeto ni a los logs.

**Healthchecks (RF-8):** `/start` al empezar, URL base al terminar bien y `/fail` (o `/<código>`) al fallar, vía `curl -K` (URL fuera de argv), con reintentos y sin hacer fallar el respaldo si el ping falla.

**systemd (RF-5):** `OnCalendar=*-*-* 03:00:00 America/Mexico_City` (systemd 255 en el VPS; el host está en UTC), `Persistent=true`. Servicio `Type=oneshot`, `User=deploy`, `NoNewPrivileges`, `PrivateTmp`, `ProtectSystem=strict`, `ProtectHome`, `ReadWritePaths=/opt/restaurante/offsite /opt/restaurante/state`, `TimeoutStartSec=1h`. Logs al journal, sin `set -x` ni volcados de configuración.

**Ubicación e instalación (punto 5, RF-7, CA-6):** en el repo, `restaurante/ops/backup/`. En el VPS, scripts en `/opt/restaurante/ops/backup/` (root, 755, solo lectura para `deploy`), unidades en `/etc/systemd/system/`, configuración en `/etc/restaurante-backup/` (`backup.env` root:deploy 640, `recipients.txt` 644). Instalación con `scp` + `install` + `systemctl daemon-reload && systemctl enable --now restaurante-backup.timer restaurante-env-backup.path`, documentada como la de `deploy/`. Como nada toca `/opt/restaurante/deploy/` ni la lista `DEPLOY_FILES`, la suma no cambia.

**Restauración (RF-10), `restore.sh` en el VPS:** toma `deploy.lock` todo el tiempo; descarga de R2 (clave, o `latest` de `daily/`) o usa un archivo local; pide la clave privada con `read -rs` y la pasa a `age -d -i <(printf ...)` (nunca a disco ni a argv); verifica los `sha256` del manifiesto; pide confirmación escribiendo el nombre de la base; `stop app`; `DROP DATABASE` y carga como root dentro del contenedor (como §9 actual); vacía y restaura `app-data` con un contenedor efímero de la imagen de la app; arranca la imagen del manifiesto, actualiza `state/release.env` y anota `restore` en `releases.log`; espera `healthy`. Mide e imprime la duración de cada fase. Runbook para: migración a medias (`MIGRATION_INCOMPLETE`: preferir el volcado local previo de `deploy.sh`, más reciente), respaldo más viejo que el código (`MIGRATIONS_PENDING`: arrancar la imagen del manifiesto o ejecutar `migrate` y la app actual) y `DATABASE_NEWER_THAN_CODE` (arrancar la imagen del manifiesto; `DATABASE_ALLOW_NEWER_SCHEMA=true` solo temporal, como la vuelta atrás). También cubre un VPS nuevo (instalar `deploy/`, `.env` desde `env/`, primer `up` de MySQL y `restore.sh`).

**Prueba mensual y simulacro (RF-11, CA-7, CA-8), `verify-backup.sh` en el Mac:** credencial de solo lectura en `~/.config/restaurante-backup/r2-readonly.conf` (600; nunca en el VPS); descarga el último `daily/`, pide la clave privada, descifra, verifica sumas; levanta un MySQL 8.4 efímero (el mismo digest, sin puertos publicados, `--network` propia) con `01-usuarios.sh` y contraseñas aleatorias; carga; compara conteos y última migración con el manifiesto y comprueba los JSON; con `--drill`, además arranca la imagen de la app del manifiesto (requiere `docker login ghcr.io` de lectura) contra esa base y ese `app-data` y espera `healthy`, midiendo el tiempo total desde la descarga (CA-8). Al terminar borra contenedores, volúmenes y temporales y añade una línea al registro (ver D-2).

### Contenido / configuración

`backup.env` (sin valores en el repo): `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `HC_PING_URL`, `BACKUP_MIN_FREE_MB`. Sin variables nuevas en el `.env` de la app ni en el compose.

### Validaciones

Formatos de configuración validados con expresiones regulares antes de usarlos (ID de cuenta hex, nombre de bucket, URL `https://hc-ping.com/...`, claves `age1...`); fallo rápido con código y mensaje sin valores.

### Manejo de errores

`set -euo pipefail`, `umask 077`, códigos de salida distintos por fase (configuración, candado, volcado, integridad, cifrado, subida), siempre con ping de fallo y mensaje sin secretos.

### Testing

- CI, job `despliegue` (sin añadir checks nuevos): `shellcheck` de todos los scripts de `ops/backup`, `systemd-analyze verify` de las unidades y `bash restaurante/ops/backup/ci/smoke.sh` con: MySQL 8.4 (mismo digest) con `01-usuarios.sh`, volumen `app-data` con JSON de prueba, servidor S3 local fijado por digest que soporte SigV4 e `If-None-Match` (MinIO, o `rclone serve s3` si la imagen de MinIO no sirve; se decide al implementar), un Healthchecks falso (registro de rutas) y `age` del apt de Ubuntu 24.04. Casos: respaldo correcto (objeto en `daily/` y, con fecha forzada, en `weekly/`/`monthly/`; descifra con la clave de prueba; contenido y manifiesto correctos; ping de éxito); contraseña de backup incorrecta y volcado truncado (nada subido, salida ≠ 0, `/fail`); segunda subida a la misma clave rechazada (412); candado ocupado (espera y luego falla); retención local 7 y permisos 600; ningún secreto en `ps`/salida (se buscan los valores de prueba en el log); `.env` sin cambios no sube, con cambios sube; `restore.sh` en modo no interactivo de prueba restaura base y `app-data` y los conteos coinciden.
- Lo que no se puede probar en CI (bucket locks y ciclo de vida reales de R2, CA-1, CA-3, CA-4, CA-8, CA-10) se verifica en la instalación con pasos documentados: intento de `DELETE` y de `PUT` sobre un respaldo existente con la credencial del VPS (ambos rechazados), reglas listadas en el panel, primer respaldo del timer, un check de Healthchecks que salte al pausar el timer y el simulacro medido.
- `npm run typecheck`, `npm run lint` y `npm test` siguen en verde (no se toca `src/`).

### Seguridad

Clave privada nunca en el VPS (CA-5; el instalador verifica que `/etc/restaurante-backup/` solo contiene destinatarios `age1...`). Credencial del VPS `Object Read & Write` acotada al bucket; la del Mac `Object Read only`; la de administración solo en el panel. Secretos solo en archivos 600/640 y en la sustitución de proceso de curl. El bucket no es público ni tiene dominio. El grupo `docker` de `deploy` sigue siendo el riesgo ya aceptado en REQ-F-016.

### Performance

Volcado actual ~6 KB comprimido y `app-data` 44 KB; el candado se retiene segundos. Coste de R2 despreciable (dentro del nivel gratuito).

### Riesgos técnicos

- `curl --aws-sigv4` contra R2 (firma de `PUT` y del listado) solo se prueba en CI contra un S3 local; se confirma en la instalación, con `rclone` en contenedor como plan B.
- Imagen de la app solo `linux/amd64`: en un Mac con Apple Silicon el simulacro corre emulado (más lento; se mide igualmente).
- Ventana de 1 día por prefijo en la que un VPS comprometido podría borrar objetos ya fuera de su bloqueo (no afecta a los mínimos 7/4/6).
- Si se configura un bloqueo sin prefijo o más largo que la expiración, la retención no se aplicaría; la documentación da las reglas exactas.

### Pasos del usuario (punto 7)

1. **Cloudflare:** activar R2; crear el bucket privado `restaurante-respaldos` (ubicación automática, sin jurisdicción, sin acceso público); en Settings → Bucket lock rules, las 4 reglas de la tabla; en Object Lifecycle Rules, las 4 expiraciones; crear dos tokens de cuenta `Object Read & Write` (VPS) y `Object Read only` (Mac) acotados a ese bucket, y guardar Access Key ID y Secret en el gestor de contraseñas; anotar el Account ID.
2. **age (en el Mac):** `brew install age`; `age-keygen -o restaurante-backup.key`; guardar el contenido completo en el gestor de contraseñas; copiar solo la línea `# public key: age1...` para el VPS; borrar el archivo con `rm -P`.
3. **Healthchecks.io:** crear el check "respaldo diario" con Cron `0 3 * * *`, zona `America/Mexico_City`, gracia 2 h, y notificación por correo; guardar la URL de ping como secreto. (Opcional según D-2: un segundo check mensual.)
4. Docker Desktop, `age` y `docker login ghcr.io` con un token de lectura en el Mac.

### Orden de implementación

1. `lib.sh` y prueba de humo con S3 local (cliente curl).
2. `backup.sh` + integridad + retención local + candado + Healthchecks.
3. `env-backup.sh` y unidades de systemd.
4. `restore.sh` y `verify-backup.sh`.
5. CI (`ci.yml`), `.dockerignore`, documentación.
6. Tras el merge: pasos del usuario, instalación en el VPS, verificación de CA-1, CA-3, CA-4, CA-9, CA-10 y simulacro medido (CA-8), registrados en el ticket antes de `DONE`.

### Criterios de finalización

CI en verde con la prueba de humo de respaldos; documentación completa; en el VPS, primer respaldo del timer en R2 con ping de éxito, `DELETE`/`PUT` rechazados con la credencial del VPS, retención visible en el panel, copia del `.env` subida al cambiarlo, `deploy/` verificado sin reinstalar, y una restauración medida dentro de 2 h registrada.

### Decisiones para el usuario (recomendación entre paréntesis)

- **D-1. Dónde se hace la "restauración real" de CA-8.** (a) Simulacro completo en el Mac con `verify-backup.sh --drill`: base, `app-data` y la app arrancada y sana, sin tocar producción (**recomendada**). (b) Restauración sobre producción en una ventana de mantenimiento con `restore.sh` (prueba también parar y arrancar la app real, pero conlleva caída y riesgo).
- **D-2. Registro de la prueba mensual (RF-11).** (a) Línea en `~/.config/restaurante-backup/pruebas.log` del Mac y un segundo check de Healthchecks "prueba mensual" (cron mensual, gracia de 7 días) al que el script hace ping si todo coincide: da el recordatorio automático que hoy falta (**recomendada**). (b) Solo el archivo local. (c) Una tabla en `docs/despliegue.md` (exige un PR cada mes).
- **D-3. Retención de las copias del `.env`** (el ticket no la fija). (a) Bloqueo de 180 días y expiración a los 365 (**recomendada**). (b) Sin expiración (se borran a mano desde el panel).
- **D-4. Cliente S3.** (a) `curl --aws-sigv4` del host, sin dependencias nuevas (**recomendada**). (b) `rclone` en un contenedor efímero fijado por digest.

## Implementation Result

### Rama

`feature/REQ-F-019-respaldos-cifrados`, en el worktree `/Users/orvigas/Desktop/Negocio-REQ-F-019` y creada desde `origin/main` (`beed9ee`). Sin commits.

### Decisiones aplicadas

D-1: simulacro en el Mac (`verify-backup.sh --drill`). D-2: log local y check mensual de Healthchecks. D-3: `env/`, bloqueo de 180 días y expiración a los 365. D-4: `curl --aws-sigv4`, con `rclone` en contenedor como plan B (no implementado).

### Cambios realizados

- `restaurante/ops/backup/lib.sh`: lectura de la configuración sin `source`, ping a Healthchecks, cliente S3 con `curl --aws-sigv4` (`PUT` con `If-None-Match: *` y comprobación de tamaño y MD5; `GET`; `ListObjectsV2` paginado), destinatarios y clave privada de `age`, y verificación del manifiesto. Compatible con bash 3.2 y BSD.
- `backup.sh`: respaldo diario (RF-1 a RF-3, RF-6 y RF-8; códigos 2 a 9).
- `env-backup.sh`: RF-9; el nombre del objeto lleva un sufijo aleatorio para que no choquen dos cambios en el mismo segundo.
- `restore.sh`: RF-10.
- `verify-backup.sh`: RF-11, CA-7 y CA-8. Para el simulacro, la app recibe un número de WhatsApp ficticio sin bot.
- `systemd/`: `restaurante-backup.{service,timer}` (`OnCalendar=*-*-* 03:00:00 America/Mexico_City`, `Persistent=true`) y `restaurante-env-backup.{service,path}`, con `User=deploy`, `ProtectSystem=strict` y `ReadWritePaths` acotadas.
- `backup.env.example` y `ci/smoke.sh`: prueba de humo con versitygw v1.9.0 fijado por digest. La imagen comunitaria de MinIO ya no se puede descargar.
- `.github/workflows/ci.yml`: solo pasos nuevos dentro del job `despliegue` (`shellcheck respaldos`, `systemd respaldos`, `age` y `prueba de humo de respaldos`).
- `restaurante/.dockerignore`: excluye `ops`.
- `restaurante/docs/despliegue.md`: sección 11 completa (11.1 a 11.9) y §9 enlazada.
- `restaurante/README.md`: enlace.
- Sin cambios en `restaurante/deploy/` ni en `src/`.

### Criterios de aceptación

- CA-1: probado en CI con S3 local (objeto en `daily/` y ping de éxito). Falta la prueba real con R2 y el timer en la instalación.
- CA-2: probado: permisos revocados da 5 y volcado truncado da 6; en los dos casos no se sube nada y se envía el ping `/5` o `/6`.
- CA-3: lo configura el usuario en Healthchecks; se verifica en la instalación (11.6 paso 2).
- CA-4: probado a nivel de cliente (412 y la clave no se sobrescribe). Los bucket locks reales se verifican en la instalación (11.6 paso 3).
- CA-5: probado: una clave privada en `recipients.txt` da 2, quedan 7 copias locales, todas 600, y no hay ninguna clave privada.
- CA-6: cumplido por diseño (nada en `deploy/`); se confirma con el siguiente despliegue.
- CA-7: probado con `verify-backup.sh` en la prueba de humo (conteos y migración coinciden y se registra `resultado=ok`). Falta la prueba en el Mac con R2.
- CA-8: pendiente (simulacro real y medido en el Mac antes de `DONE`).
- CA-9: probado: sin cambios no sube; con cambios sube una copia que se descifra igual al `.env`.
- CA-10: documentado en 11.2; lo configura el usuario.

### Validaciones ejecutadas

- `shellcheck -x` (koalaman/shellcheck:stable) sobre los 6 scripts, desde `ops/backup` y desde la raíz: 0 avisos.
- `systemd-analyze verify` de las 4 unidades (systemd 255, Ubuntu 24.04): 0. `systemd-analyze calendar` da `09:00:00 UTC` diario.
- `ops/backup/ci/smoke.sh` con imágenes `production` y `migrate` construidas desde la rama, en un contenedor Ubuntu 24.04 (curl 8.5.0 y age 1.1.1, como el VPS): **54 comprobaciones, 0 fallos**, 67 s. Al terminar no quedan contenedores ni volúmenes.
- `lib.sh` con el bash 3.2 y el curl 8.7.1 de macOS contra versitygw: `urlencode`, permisos, `PUT`, reintento idempotente, `LIST`, `GET` y conflicto 412 (código 2), correctos. `bash -n` de `verify-backup.sh`: correcto.
- `docker build` de `production` y `migrate` con el `.dockerignore` nuevo: correcto.
- typecheck, lint y test: no se ejecutaron porque no se tocó TypeScript.

### Archivos afectados

`.github/workflows/ci.yml`, `restaurante/.dockerignore`, `restaurante/README.md`, `restaurante/docs/despliegue.md` y `restaurante/ops/backup/` (11 archivos nuevos).

### Riesgos o pendientes

- Sin verificar contra R2 real: la firma de curl, el código exacto con que R2 rechaza `DELETE` y `PUT` sobre objetos bloqueados, y que el ETag sea el MD5 (si no lo fuera, el reintento tras un 412 daría código 2).
- Sin verificar en el VPS real: `ProtectSystem=strict` y `ProtectHome=read-only` con el CLI de docker, `PathChanged` y el primer timer.
- `verify-backup.sh` no se ejecutó completo en macOS porque `age` no está instalado en esta máquina; sí sus funciones con bash 3.2 y el curl de macOS.
- Conflicto previsible en `ci.yml` con REQ-F-020 (otro job y `publish.needs`); este ticket solo añade pasos dentro de `despliegue`.
- Durante T1 se ejecutó en el VPS `docker run alpine:3` (solo lectura del volumen), que pudo dejar esa imagen en el host.
- CA-8 exige el simulacro real medido antes de cerrar.

## QA Action Plan

### Objetivo

Validar que los respaldos cifrados, la copia del `.env`, la restauración y el simulacro cumplen RF-1 a RF-11 sin exponer secretos, sin tocar `deploy/` ni la imagen, y que lo que solo puede probarse contra R2, en el VPS o en el Mac queda identificado como verificación posterior.

### Requisito bajo prueba

REQ-F-019, con D-1 (a), D-2 (a), D-3 (a) y D-4 (a). Código en el worktree `/Users/orvigas/Desktop/Negocio-REQ-F-019`, rama `feature/REQ-F-019-respaldos-cifrados`. El checkout principal, el puerto 3000 y el VPS no se tocan.

### Criterios de aceptación

| CA | Pruebas locales | Verificación posterior (con el usuario) |
| --- | --- | --- |
| CA-1 | A-3 (objeto en `daily/` y ping de éxito) | P-1: timer real contra R2 |
| CA-2 | A-3, N-2 | — |
| CA-3 | — | P-2: check de Healthchecks sin ping |
| CA-4 | N-1 | P-3: bucket locks de R2 (`DELETE` y `PUT` rechazados) |
| CA-5 | A-3, N-6, S-4 | P-1: inspección de `/etc/restaurante-backup/` en el VPS |
| CA-6 | C-1 | P-1: la verificación SHA-256 tras instalar |
| CA-7 | A-3 (`verify-backup.sh`, `resultado=ok`) | P-4: prueba mensual en el Mac con R2 |
| CA-8 | — | P-4: simulacro `--drill` real y medido (requisito para `DONE`) |
| CA-9 | A-3 | P-1 |
| CA-10 | Doc-1 (11.2) | P-3 |

### Riesgos identificados

- Secretos (credenciales S3, URL de Healthchecks, clave privada) expuestos en argumentos de proceso, logs, archivos temporales o en el disco.
- Se sube un volcado incompleto, o se sobrescribe o borra un respaldo existente.
- El respaldo interfiere con un despliegue (candado compartido `deploy.lock`).
- La restauración con una clave equivocada deja la base a medias.
- `ops/` termina dentro de la imagen, o algo cambia en `deploy/` y rompe la verificación SHA-256.
- Compatibilidad con bash 3.2 y BSD en el Mac.

### Pruebas automatizadas (reejecución)

- A-1: `shellcheck -x` de los 6 scripts (imagen `koalaman/shellcheck:stable`), desde `ops/backup` como en el CI → 0 avisos.
- A-2: `systemd-analyze verify` de las 4 unidades en un contenedor Ubuntu 24.04 (con los scripts instalados en `/opt/restaurante/ops/backup`, como en el CI) → 0, y `systemd-analyze calendar` de `03:00 America/Mexico_City`.
- A-3: `ops/backup/ci/smoke.sh` con las imágenes `production` y `migrate` construidas desde el worktree, con versitygw como S3 local → 54 de 54, sin contenedores ni volúmenes residuales al terminar.
- A-4: `bash -n` de todos los scripts con el bash 3.2 de macOS.

### Pruebas negativas propias

Se ejecutan contra el mismo entorno de la prueba de humo (versitygw y MySQL en contenedores efímeros), con copias de la configuración en el scratchpad. Por cada caso se registran el código de salida, el ping enviado y el contenido del bucket:

- N-1: sobrescritura. `PUT` de un objeto con una clave ya existente → 412, código distinto de 0 y el objeto original intacto (mismo MD5). También el reintento idempotente del mismo contenido.
- N-2: volcado truncado o fallido → código 6 (o 5), nada nuevo en el bucket, ping `/6` (o `/5`), y la copia local no se cuenta como válida.
- N-3: candado ocupado. Con `deploy.lock` retenido por otro proceso (`flock`) y un `LOCK_TIMEOUT` corto → código 4, sin volcado ni subida y con el ping de fallo.
- N-4: S3 caído (endpoint inaccesible o contenedor detenido) → la copia local se conserva con su marca `.pending`, el código es distinto de 0, se envía el aviso, y la siguiente ejecución con S3 disponible sube la pendiente.
- N-5: restaurar con una clave privada equivocada (y con una mal formada) → `restore.sh` y `verify-backup.sh` fallan antes de tocar la base de destino, sin borrar ni recrear nada.
- N-6: configuración con permisos incorrectos (`backup.env` en 644, `recipients.txt` con `AGE-SECRET-KEY-`) → el script se niega a continuar con su código documentado y sin mostrar el contenido.
- N-7: manifiesto o suma alterados en un respaldo descargado → la verificación del manifiesto lo rechaza.

### Revisión de seguridad

- S-1: ningún secreto en argumentos. Durante A-3 se muestrea `ps -eo args` en el contenedor de ejecución: no aparecen las credenciales S3, la URL de Healthchecks ni la clave privada. Revisión del código: todo `curl` usa `-K <(…)` (sustitución de proceso) para credenciales y URL secretas.
- S-2: ningún secreto en los logs. Búsqueda en la salida completa de A-3 y N-1 a N-7 de las credenciales de prueba, del UUID de Healthchecks y de `AGE-SECRET-KEY-`.
- S-3: permisos. Los respaldos locales en 600, `offsite/` en 700 y la configuración en 600/640, según la tabla de §11. `umask` en los scripts.
- S-4: la clave privada nunca toca el disco. Se lee sin eco de la terminal o de stdin, se pasa a `age` por descriptor o sustitución de proceso, y no se escribe en archivos temporales (búsqueda de `AGE-SECRET-KEY-` en `/tmp` y en el directorio de trabajo tras `restore.sh` y `verify-backup.sh`).
- S-5: aislamiento de systemd. `User=deploy`, `ProtectSystem=strict`, `ProtectHome=read-only`, `ReadWritePaths` acotadas, `NoNewPrivileges` y equivalentes; `systemd-analyze security` de los dos servicios, solo como dato informativo.
- S-6: la configuración se lee sin `source` (no ejecuta código del archivo de configuración).

### Integridad de `deploy/` e imagen

- C-1: `git -C <worktree> diff main -- restaurante/deploy` vacío, y la suma `sha256sum compose.prod.yaml deploy.sh mysql/initdb/01-usuarios.sh | sha256sum` igual a la de `main`.
- C-2: `.dockerignore` excluye `ops`. En las imágenes `production` y `migrate` construidas desde el worktree no existe `ops/` (`docker run --rm --entrypoint sh … -c 'ls'`).
- C-3: diff de `ci.yml`: solo pasos nuevos dentro de `despliegue`, sin secretos ni permisos nuevos. Se anota el conflicto previsible con REQ-F-020 (job `auditoria` y `publish.needs`) para el merge.

### Documentación

- Doc-1: `docs/despliegue.md` §11 (11.1 a 11.9) frente al código: rutas, nombres de las unidades, horario, códigos de salida, variables de `backup.env.example`, retención (7 locales; 7, 4 y 6 en el bucket; `env/` 180 y 365 días), pasos de restauración y de simulacro, y el registro mensual (D-2). Cada discrepancia se registra con archivo y línea.
- Doc-2: el enlace del README y el de §9.

### Verificación posterior (fuera de esta ronda; con el usuario)

- P-1: instalación en el VPS: unidades activas, primer timer, copia del `.env` al cambiarlo, sin clave privada en `/etc/restaurante-backup/`, y la verificación SHA-256 de `deploy/` en verde sin reinstalar (CA-1, CA-5, CA-6, CA-9).
- P-2: Healthchecks avisa cuando no llega un ping (CA-3).
- P-3: R2 real: firma de curl, ETag igual al MD5, rechazo de `DELETE` y `PUT` sobre objetos bloqueados y retención configurada (CA-4, CA-10).
- P-4: en el Mac con `age`: prueba mensual (CA-7) y simulacro `--drill` real, medido dentro del RTO y registrado (CA-8, requisito para `DONE`).
- P-5: los pasos nuevos del job `despliegue` en verde en el PR.

### Evidencia requerida

Salida y código de salida de A-1 a A-4 y N-1 a N-7, listados del bucket antes y después, muestras de `ps` y búsquedas de secretos (S-1, S-2, S-4), `stat` de permisos, la comparación de sumas de C-1, `ls` de las imágenes en C-2 y las discrepancias de la documentación.

### Criterios de aprobación

- A-1 a A-4, N-1 a N-7, C-1 a C-3 y S-1 a S-6 sin defectos `BLOCKER`, `CRITICAL` ni `MAJOR` sin decisión del usuario.
- CA-2 y CA-6 en PASS con evidencia local. CA-1, CA-4, CA-5, CA-7 y CA-9 en PASS en lo verificable localmente, y el resto marcado como verificación posterior.
- `QA_APPROVED` no equivale a `DONE`: CA-8 (P-4) sigue siendo obligatorio antes de cerrar el ticket.

## QA Report

### Ronda

1 (2026-10-14). Worktree `/Users/orvigas/Desktop/Negocio-REQ-F-019`, rama `feature/REQ-F-019-respaldos-cifrados`, sin commit. El worktree no se modificó: las pruebas extra corrieron sobre una copia en el scratchpad.

### Pruebas ejecutadas

| ID | Acción | Resultado |
| --- | --- | --- |
| A-1 | `shellcheck -x` de los 6 scripts (`koalaman/shellcheck:stable`) | 0 avisos |
| A-2 | `systemd-analyze verify` de las 4 unidades (systemd 255, Ubuntu 24.04, scripts en `/opt/restaurante/ops/backup`) | 0. `calendar` → próxima ejecución diaria a las 09:00:00 UTC |
| A-3 | `ops/backup/ci/smoke.sh` original con las imágenes construidas desde el worktree (contenedor Ubuntu 24.04, versitygw) | 54 de 54, código 0 |
| A-4 | `bash -n` de los 6 scripts con el bash 3.2.57 de macOS | 0 errores |
| N-1 a N-7, S-1 a S-4 | La misma prueba de humo, más 21 comprobaciones de QA (copia en el scratchpad) | 75 de 75, código 0 |
| C-1 | `git diff main -- restaurante/deploy` y suma SHA-256 de `compose.prod.yaml`, `deploy.sh` y `01-usuarios.sh` | Diff vacío; suma `82c3e5ae…21596` idéntica a la de `main` |
| C-2 | `.dockerignore` e imágenes `production` y `migrate` | `ops` excluido; `/app` sin `ops/` en las dos imágenes, sin directorios `ops` fuera de `node_modules` |
| C-3 | Diff de `ci.yml` | Solo 4 pasos nuevos en `despliegue` (`shellcheck respaldos`, `systemd respaldos`, `age` y la prueba de humo); sin secretos ni permisos nuevos |
| Doc-1, Doc-2 | §11 frente al código | Coherente (ver UX/Documentación) |

Detalle de los casos negativos y de seguridad (todos en verde):

- N-1, sobrescritura: otro contenido a una clave existente → 2 (412) y el objeto no cambia; el reintento con el mismo contenido se acepta.
- N-2, volcado: sin permisos → 5 y ping `/5`; truncado → 6 y ping `/6`. En los dos casos no se sube nada.
- N-3, candado `deploy.lock` ocupado → 4.
- N-4, S3 caído → 8, ping `/8` y una marca `.pending`; la siguiente ejecución sube la pendiente y la nueva (3 en `daily/`), sin pendientes y con 7 copias locales.
- Disco (caso límite): `BACKUP_MIN_FREE_MB=9999999` → 3, ping `/3` y nada subido.
- N-5, clave equivocada → `restore.sh` 6; clave mal formada → 2. Los usuarios no cambian y la app sigue `healthy`. `verify-backup.sh --drill` con una clave equivocada falla, no registra `resultado=ok` y no deja contenedores.
- N-6: una clave privada en `recipients.txt` → 2; `backup.env` en 644 → 2 y en 604 → 2. Líneas `$(touch …)` en `backup.env` no se ejecutan (lectura sin `source`).
- N-7: `app-data.tar` alterado → `verify_parts` lo rechaza; un paquete alterado, recifrado y restaurado desde archivo → 6, y la base no cambia.
- S-1: 6456 líneas de `ps` muestreadas durante todas las ejecuciones, 541 de `curl`. Ninguna credencial S3, URL de ping, clave privada ni contraseña de BD en los argumentos. `curl` siempre usa `-K /dev/fd/63`.
- S-2: ningún secreto en los logs de los scripts.
- S-3: `offsite/` en 700, archivos (incluido `env.sha256`) en 600, `backup.env` en 640 y `recipients.txt` en 644. `umask 077` en `backup.sh`, `restore.sh` y `verify-backup.sh`.
- S-4: ni la clave del respaldo ni la equivocada aparecen en disco (`/tmp`, el directorio de trabajo, `opt/` ni `etc/`) fuera del archivo del arnés. `age_decrypt` usa `-i <(…)` (`lib.sh:246`).
- S-5: unidades con `User=deploy`, `NoNewPrivileges`, `PrivateTmp`, `ProtectSystem=strict`, `ProtectHome=read-only`, `ProtectKernel*`, `RestrictSUIDSGID` y `ReadWritePaths` acotadas. `systemd-analyze security`: 7.5 (informativo).
- S-6: configuración leída con `conf_value` y validada con expresiones regulares; sin `source`.

### Criterios de aceptación

| CA | Resultado | Evidencia |
| --- | --- | --- |
| CA-1 | PASS local; P-1 y P-3 pendientes | A-3: objetos en `daily/`, `weekly/` y `monthly/`, y pings de inicio y de éxito |
| CA-2 | PASS | N-2 |
| CA-3 | Pendiente P-2 | Configuración de Healthchecks |
| CA-4 | PASS a nivel de cliente; P-3 pendiente | N-1 |
| CA-5 | PASS local; P-1 pendiente | N-6, 7 copias locales en 600, S-4 |
| CA-6 | PASS | C-1 |
| CA-7 | PASS local; P-4 pendiente | `verify-backup.sh --drill` → `resultado=ok` |
| CA-8 | Pendiente P-4 (requisito para `DONE`) | — |
| CA-9 | PASS local; P-1 pendiente | Sin cambios no sube; con cambios sube y se descifra igual |
| CA-10 | Documentado (§11.2); P-3 pendiente | Tabla 7/8, 28/29, 180/186 y 180/365 días |

### Defectos encontrados

Ninguno `BLOCKER`, `CRITICAL`, `MAJOR` ni `MINOR`.

Observaciones `TRIVIAL` (no bloquean):

- OBS-1: `OnCalendar=… America/Mexico_City` (`ops/backup/systemd/restaurante-backup.timer:6`) necesita `tzdata`. En una imagen Ubuntu mínima sin `tzdata`, `systemd-analyze verify` rechaza el timer ("Timer unit lacks value setting"). Ubuntu Server (el VPS) y el runner `ubuntu-24.04` traen `tzdata`. Se puede confirmar en P-1 con `systemctl list-timers`.
- OBS-2: `systemd-analyze security` da 7.5 en los dos servicios. Se podría endurecer más (`PrivateDevices`, `RestrictAddressFamilies`, `CapabilityBoundingSet=`), pero el beneficio es limitado porque el usuario `deploy` está en el grupo `docker` (riesgo aceptado en REQ-F-016).

### Regresión

`deploy/` sin cambios (C-1). Las imágenes no cambian de contenido (C-2). `src/` sin cambios. La prueba de humo levanta el compose de producción y la app queda `healthy` tras la restauración.

### Responsive / Accesibilidad / UX/UI / SEO / Performance

No aplica (sin cambios de frontend). La prueba de humo completa con el arnés de QA tarda unos 2 min.

### Documentación

§11.1 (rutas, permisos, códigos 2 a 9, candado de 30 min, 7 copias locales y niveles `daily`, `weekly` y `monthly`), §11.2 (retención), §11.5 (instalación y SHA-256) y §11.7 y §11.8 (`restore.sh latest | clave | archivo`, `--confirm`, `RESTAURANTE_BACKUP_CONFIG` y `RESTAURANTE_BACKUP_LOG`, `pruebas.log`) coinciden con el código. El README y §9 enlazan a §11.

### Pendientes de verificación posterior (con el usuario)

- P-1: instalación en el VPS: unidades activas, primer timer (`list-timers` a las 09:00 UTC), copia del `.env` al cambiarlo, `/etc/restaurante-backup/` sin clave privada, verificación SHA-256 de `deploy/` sin reinstalar, y `ProtectSystem=strict`/`ProtectHome=read-only` compatibles con el CLI de docker (CA-1, CA-5, CA-6, CA-9).
- P-2: Healthchecks avisa cuando no llega un ping (CA-3).
- P-3: R2 real: firma SigV4 de curl, ETag igual al MD5, `DELETE` y `PUT` rechazados sobre objetos bloqueados, y retención configurada (CA-4, CA-10).
- P-4: en el Mac con `age`: prueba mensual (CA-7) y simulacro `--drill` real, medido dentro del RTO de 2 h y registrado (CA-8, **requisito para `DONE`**).
- P-5: los pasos nuevos del job `despliegue` en verde en el PR. Hay un conflicto previsible en `ci.yml` con REQ-F-020 (job `auditoria` y `publish.needs`).

### Resultado final

QA_APPROVED (no equivale a `DONE`: falta P-4 / CA-8).

## Cierre

PR #51 (https://github.com/orvigas/negocio/pull/51) mergeado en `main` el 2026-10-14 (commit de merge `9f62592`). En producción desde el 2026-10-14. Verificación posterior hecha con el usuario el 2026-10-14.

### P-1 — Instalación en el VPS (CA-1, CA-5, CA-6, CA-9)

- Scripts y las 4 unidades instalados en el VPS, idénticos a `main` (las sumas SHA-256 coinciden).
- Primer respaldo manual a las 22:46 UTC, en 3 s: `daily/restaurante-20261014T224648Z.tar.age` (51400 bytes; usuarios 1, productos 16, migración `20261009223102_inicial_mysql`).
- Copia cifrada del `.env` en R2: `env/20261014T224649Z-3e5e66b3.env.age` (CA-9).
- `restaurante-backup.timer` habilitado; próxima ejecución jueves 2026-10-15 09:00 UTC. OBS-1 resuelta: `tzdata` está presente y el timer funciona.
- `restaurante-env-backup.path` activo.
- `grep -rl AGE-SECRET-KEY-` sobre `/etc/restaurante-backup`, `/opt/restaurante/offsite` y el `.env`: sin resultados (CA-5).
- `offsite/` con archivos `-rw-------` de `deploy` (CA-5).
- Suma de `deploy/`: `82c3e5ae4b8f99ea424f55291032ab81c550632240d4bffedd0168579ee21596`. La instalación no toca `deploy/` (CA-6).

### P-2 — Healthchecks (CA-3)

- Checks "respaldo diario" (cron `0 3 * * *`, `America/Mexico_City`, gracia 2 h) y "prueba mensual" creados y en verde, según el usuario.
- Hallazgo: en el Mac se había configurado por error la URL del check diario para la prueba mensual. Se corrigió (las huellas de las dos URL son distintas) y se envió un ping manual al check mensual.

### P-3 — R2 real (CA-4, CA-10)

- Con la credencial del VPS, `DELETE` → 409 y `PUT` → 409 sobre el objeto bloqueado; el objeto sigue en `daily/` (CA-4).
- La credencial del VPS lista el bucket correctamente.
- Bucket locks y ciclo de vida (retención 7, 4 y 6) creados por el usuario en el panel de Cloudflare. Confirmado por el usuario; no lo inspeccionamos nosotros (CA-10).

### P-4 — Prueba mensual y simulacro en el Mac (CA-7, CA-8)

- `~/.config/restaurante-backup/r2-readonly.conf` (modo 600) con un token de solo lectura.
- `verify-backup.sh --drill` → `resultado=ok`, en 25 s con `main` y en 19 s con la rama de la corrección (2026-10-14T23:04:14Z), muy por debajo del RTO de 2 h. Registrado en `~/.config/restaurante-backup/pruebas.log` (CA-8).
- Los conteos restaurados coinciden con el manifiesto (CA-7).
- La app de producción (imagen `linux/amd64` emulada) respondió con la base y `app-data` restaurados.
- Defecto encontrado: el `chmod` BSD de macOS no acepta `--`. Con `set -e`, `record()` abortaba tras escribir `pruebas.log`, sin imprimir la línea de resultado ni enviar el ping a Healthchecks (con `main` salió `chmod: --: No such file or directory` tras el `resultado=ok`). Corregido en el PR #56 (https://github.com/orvigas/negocio/pull/56), con una comprobación anti-regresión en la prueba de humo.

### P-5 — CI

Los pasos de respaldos del job `despliegue` pasaron en el PR #51 (ver `### Pull Request`).

### Pendientes posteriores (no bloquean el cierre)

- **CA-1:** el primer respaldo programado (timer, 2026-10-15 09:00 UTC = 03:00 de México) y su ping de éxito aún no se han observado; el respaldo verificado fue manual.
- **CA-3:** no se forzó el aviso por falta de ping (dejar vencer la gracia). Los checks existen y están en verde, pero la alerta no se ha visto dispararse.
- **CA-6:** falta observar que el siguiente despliegue pase la verificación SHA-256 de `deploy/` sin reinstalar `deploy/`.
- **Pendiente de I-7:** guardar la clave privada de `age` en el gestor de contraseñas de una segunda persona.
- **PR #56:** la corrección de `verify-backup.sh` para macOS, pendiente de merge.

## Trazabilidad

- `pendientes.md` I-7 → RF-3, RF-4 y el riesgo de la segunda persona.
- Análisis VPS (`reports/VPS-DOCKER-MYSQL-2026-10-09-analisis.md`) §4.12 y §6.5 → RF-1, RF-2, RF-6, RF-10 y RF-11.
- REQ-F-014 (anexo del roadmap y R-T6) → RF-3, RF-4, RF-10 y RF-11.
- REQ-F-016 (verificación SHA-256 de `deploy/`) → RF-7.
- Decisiones del usuario del 2026-10-14 → el resto.

## Historial de cambios

### Versión 1

Descripción inicial. Aprobada por el usuario el 2026-10-14 con la respuesta "Aprobar".

### Revisión técnica (2026-10-14)

senior-fullstack (T1): verificado R2 en la documentación de Cloudflare (sin versionado S3; bucket locks por prefijo que prevalecen sobre el ciclo de vida; tokens de objeto sin "escribir sin borrar"). Agregado el Technical Action Plan con las decisiones D-1 a D-4. Estado: `NEEDS_TECHNICAL_PLAN_APPROVAL`.

### Implementación (2026-10-14)

senior-fullstack (T2): aprobado el plan ("Aprobar"; D-1 a D-4 en la opción recomendada). Implementación en el worktree `Negocio-REQ-F-019`, rama `feature/REQ-F-019-respaldos-cifrados`. Prueba de humo: 54 de 54. Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

### QA Action Plan (2026-10-14)

senior-qa: el usuario aprobó la implementación con "Aprobar". Plan con reejecución de shellcheck, systemd y la prueba de humo, casos negativos N-1 a N-7, revisión de seguridad, integridad de `deploy/` y de la imagen, y documentación §11. R2, VPS y Mac (CA-8) quedan como verificación posterior. Estado: NEEDS_QA_PLAN_APPROVAL.

### QA ronda 1 (2026-10-14)

senior-qa: el usuario aprobó el QA Action Plan con "Aprobar". shellcheck 0, systemd verify 0, prueba de humo 54/54 y 75/75 con las comprobaciones de QA; `deploy/` con la misma suma SHA-256; imágenes sin `ops/`. Sin defectos (dos observaciones TRIVIAL). P-1 a P-5 pendientes; CA-8 obligatorio antes de `DONE`. Estado: QA_APPROVED.

### Pull Request (2026-10-14)

senior-fullstack (T4): commit `44b670e`, rebasado sobre `origin/main` (`ea716f9`).
- PR: https://github.com/orvigas/negocio/pull/51
- CI en verde (ejecución 38613923297): `calidad`, `docker` y `despliegue` pasaron. Dentro de `despliegue` pasaron `shellcheck respaldos`, `systemd respaldos`, `age` y `prueba de humo de respaldos` ("todas las comprobaciones pasaron"). `publish` y `deploy` se omiten en un PR.
- Conflicto previsto en `.github/workflows/ci.yml` con el PR #50 (REQ-F-020), que sigue abierto: si se mergea antes, hay que rebasar este PR conservando el job `auditoria`, `publish.needs` con `auditoria` y los 4 pasos de respaldos en `despliegue`.
- Estado: `READY_FOR_MERGE`. **DONE requiere P-1 a P-4**: instalación y verificación en R2, Healthchecks y el VPS, y el simulacro real medido en el Mac (CA-8).

### Cierre (2026-10-14)

senior-fullstack (T5): PR #51 mergeado (`9f62592`). Verificación posterior P-1 a P-4 hecha con el usuario; CA-8 superado (`--drill` con `resultado=ok` en 25 s y 19 s). El defecto del `chmod` en macOS se corrige en el PR #56. El usuario lo aprobó con "aoarece en verde, lo apruebo, cierralo". Ticket movido a `done/`. Estado: DONE.
