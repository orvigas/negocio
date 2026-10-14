#!/usr/bin/env bash
# Respaldo diario cifrado fuera del VPS (REQ-F-019, RF-1 a RF-3, RF-6, RF-8 y RF-9). Lo ejecuta
# restaurante-backup.service (timer diario a las 03:00 de America/Mexico_City) como el usuario
# deploy. Vive en /opt/restaurante/ops/backup/, fuera de deploy/: no altera su suma SHA-256.
#
# Secuencia: configuración -> ping de inicio -> pendientes -> candado de deploy.sh -> conteos,
# mysqldump (usuario restaurante_backup) y tar de app-data -> fin del candado -> integridad ->
# manifiesto -> paquete cifrado con age (solo claves públicas) -> subida a R2 en daily/ (y weekly/ el
# domingo, monthly/ el día 1, fecha de México) sin sobrescribir -> retención local (7) -> .env ->
# ping de éxito. Cualquier fallo: código distinto de 0 y ping de fallo. Nunca imprime secretos.
#
# Códigos: 2 configuración, 3 precondición, 4 candado, 5 volcado, 6 integridad, 7 cifrado,
# 8 subida (la copia local se conserva y se reintenta en la próxima ejecución), 9 copia del .env.
set -euo pipefail
umask 077

SCRIPT_NAME=backup
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=SCRIPTDIR/lib.sh
. "$SCRIPT_DIR/lib.sh"

# Rutas (las variables solo las cambia la prueba de humo).
BASE_DIR=${RESTAURANTE_BASE_DIR:-/opt/restaurante}
CONFIG_DIR=${BACKUP_CONFIG_DIR:-/etc/restaurante-backup}
PROJECT=${COMPOSE_PROJECT_NAME:-restaurante}
STATE_DIR="$BASE_DIR/state"
OFFSITE_DIR="$BASE_DIR/offsite"
RELEASE_FILE="$STATE_DIR/release.env"
CONFIG_FILE="$CONFIG_DIR/backup.env"
RECIPIENTS_FILE="$CONFIG_DIR/recipients.txt"
KEEP_LOCAL=7
LOCK_TIMEOUT=${BACKUP_LOCK_TIMEOUT:-1800}
BUSINESS_TZ=America/Mexico_City

PINGED=false
WORK=''

fail() { # fail <código> <mensaje>
  local code=$1
  shift
  log "ERROR: $*"
  hc_ping "$code" "backup: $*"
  PINGED=true
  exit "$code"
}

on_exit() {
  local status=$?
  [[ -n "$WORK" ]] && rm -rf -- "$WORK"
  if ((status != 0)) && [[ "$PINGED" == false ]]; then hc_ping "$status" "backup: fallo inesperado (código $status)"; fi
  exit "$status"
}
trap on_exit EXIT

# Niveles del respaldo según la fecha de México (BACKUP_TODAY=AAAA-MM-DD solo en pruebas).
tiers_for_today() {
  local today=${BACKUP_TODAY:-$(TZ=$BUSINESS_TZ date +%F)}
  [[ "$today" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || fail 2 'BACKUP_TODAY inválida'
  local tiers=daily
  [[ "$(date -d "$today" +%u)" == 7 ]] && tiers="$tiers weekly"
  [[ "$(date -d "$today" +%d)" == 01 ]] && tiers="$tiers monthly"
  printf '%s' "$tiers"
}

# Sube <archivo> a cada nivel; 0 si todos quedaron arriba.
upload_tiers() { # upload_tiers <archivo> <niveles>
  local file=$1 name tier status=0
  name=$(basename -- "$file")
  for tier in $2; do
    if s3_put "$file" "$tier/$name"; then
      log "subido: $tier/$name"
    else
      status=1
    fi
  done
  return "$status"
}

# Ejecuta SQL o mysqldump en el contenedor de MySQL con el usuario de solo lectura. La contraseña
# sale del entorno del contenedor a un archivo de opciones temporal dentro de él: nunca en argv.
# shellcheck disable=SC2016 # Las variables se expanden dentro del contenedor.
in_mysql() { # in_mysql <mysql|mysqldump> <argumentos...>
  docker exec -i "$MYSQL_CID" sh -c '
    set -eu
    umask 077
    f=$(mktemp)
    trap "rm -f \"$f\"" EXIT
    printf "[client]\nuser=restaurante_backup\npassword=%s\n" "$RESTAURANTE_DB_BACKUP_PASSWORD" >"$f"
    cmd=$1
    shift
    "$cmd" --defaults-extra-file="$f" "$@"
  ' sh "$@"
}

db_counts() { # -> "usuarios productos última_migración"
  in_mysql mysql -N -B -e "SELECT (SELECT COUNT(*) FROM restaurante.user), (SELECT COUNT(*) FROM restaurante.product), (SELECT COALESCE(MAX(migration_name), '-') FROM restaurante._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)" |
    tr '\t' ' '
}

# --- Configuración -------------------------------------------------------------------------------
load_config "$CONFIG_FILE" required || fail 2 'configuración inválida (ver mensajes anteriores)'
check_recipients "$RECIPIENTS_FILE" || fail 2 'destinatarios de age inválidos'
if grep -rqs 'AGE-SECRET-KEY-' -- "$CONFIG_DIR" "$OFFSITE_DIR"; then
  fail 2 "hay una clave privada de age en $CONFIG_DIR u $OFFSITE_DIR: bórrala del VPS"
fi
for tool in age docker flock curl gzip tar; do
  command -v "$tool" >/dev/null 2>&1 || fail 2 "falta $tool en el host"
done
hc_ping start

# --- Precondiciones ------------------------------------------------------------------------------
[[ -d "$STATE_DIR" ]] || fail 3 "falta $STATE_DIR (¿se desplegó alguna vez?)"
mkdir -p -- "$OFFSITE_DIR"
chmod 700 -- "$OFFSITE_DIR"
MIN_FREE_MB=$(conf_value "$CONFIG_FILE" BACKUP_MIN_FREE_MB)
MIN_FREE_MB=${MIN_FREE_MB:-1024}
[[ "$MIN_FREE_MB" =~ ^[0-9]{1,7}$ ]] || fail 2 'BACKUP_MIN_FREE_MB debe ser un número de MB'
FREE_KB=$(df -Pk -- "$OFFSITE_DIR" | awk 'NR == 2 { print $4 }')
((FREE_KB >= MIN_FREE_MB * 1024)) || fail 3 "espacio libre insuficiente en $OFFSITE_DIR ($((FREE_KB / 1024)) MB; mínimo $MIN_FREE_MB MB)"

TIERS=$(tiers_for_today)

# Reintenta las subidas pendientes de ejecuciones anteriores (la subida falló; caso límite).
PENDING_FAILED=0
for marker in "$OFFSITE_DIR"/*.tar.age.pending; do
  [[ -e "$marker" ]] || continue
  file=${marker%.pending}
  if [[ ! -f "$file" ]]; then
    rm -f -- "$marker"
    continue
  fi
  tiers=$(cat -- "$marker")
  [[ "$tiers" =~ ^daily( weekly)?( monthly)?$ ]] || tiers=daily
  if upload_tiers "$file" "$tiers"; then
    rm -f -- "$marker"
    log "pendiente subido: $(basename -- "$file")"
  else
    PENDING_FAILED=1
  fi
done

[[ -f "$RELEASE_FILE" ]] || fail 3 "falta $RELEASE_FILE (¿se desplegó alguna vez?)"
APP_IMAGE=$(sed -n 's/^RESTAURANTE_APP_IMAGE=//p' "$RELEASE_FILE" | tail -n 1)
MIGRATE_IMAGE=$(sed -n 's/^RESTAURANTE_MIGRATE_IMAGE=//p' "$RELEASE_FILE" | tail -n 1)
COMMIT=$(sed -n 's/^RESTAURANTE_COMMIT=//p' "$RELEASE_FILE" | tail -n 1)
[[ "$APP_IMAGE" =~ ^[A-Za-z0-9./:@_-]+$ ]] || fail 3 "RESTAURANTE_APP_IMAGE ausente o inválida en $RELEASE_FILE"

MYSQL_CID=$(docker ps -q --filter "label=com.docker.compose.project=$PROJECT" --filter label=com.docker.compose.service=mysql --filter status=running)
[[ "$MYSQL_CID" =~ ^[0-9a-f]+$ ]] || fail 3 'el contenedor de MySQL no está en marcha (o hay más de uno)'
VOLUME="${PROJECT}_app-data"
docker volume inspect "$VOLUME" >/dev/null 2>&1 || fail 3 "no existe el volumen $VOLUME"

WORK=$(mktemp -d)
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
NAME="restaurante-$STAMP.tar.age"

# --- Volcado y app-data con el candado de deploy.sh (no coinciden con un despliegue) ---------------
exec 9>>"$STATE_DIR/deploy.lock"
if ! flock -n 9; then
  log 'esperando a que termine un despliegue en curso'
  flock -w "$LOCK_TIMEOUT" 9 || fail 4 "un despliegue sigue en curso tras ${LOCK_TIMEOUT}s"
fi

COUNTS_BEFORE=$(db_counts) || fail 5 'no se pudieron leer los conteos de la base'
if ! in_mysql mysqldump --single-transaction --no-tablespaces --skip-lock-tables \
  --default-character-set=utf8mb4 --hex-blob --set-gtid-purged=OFF --databases restaurante |
  gzip -c >"$WORK/dump.sql.gz"; then
  fail 5 'falló el volcado de la base'
fi
COUNTS_AFTER=$(db_counts) || fail 5 'no se pudieron leer los conteos de la base'

# Lectura tal cual del volumen, con la imagen de la app (su usuario es el dueño de los archivos 600).
# Las escrituras de la app son atómicas (temporal + rename): se excluyen los temporales.
if ! docker run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges \
  -v "$VOLUME:/data:ro" --entrypoint tar "$APP_IMAGE" -C /data --exclude '.*.tmp' -cf - . >"$WORK/app-data.tar"; then
  fail 5 'falló la lectura del volumen app-data'
fi

flock -u 9
exec 9>&-

# --- Integridad (RF-2) ---------------------------------------------------------------------------
gzip -t -- "$WORK/dump.sql.gz" 2>/dev/null || fail 6 'el volcado comprimido está corrupto'
gzip -dc -- "$WORK/dump.sql.gz" | tail -n 1 | grep -q '^-- Dump completed' || fail 6 'el volcado está incompleto'
# Sin -q: grep lee todo y gzip no recibe SIGPIPE (pipefail).
# shellcheck disable=SC2016 # Las comillas invertidas son literales del SQL.
gzip -dc -- "$WORK/dump.sql.gz" | grep '^CREATE DATABASE .*`restaurante`' >/dev/null || fail 6 'el volcado no contiene la base restaurante'
tar -tf "$WORK/app-data.tar" >"$WORK/app-data.list" 2>/dev/null || fail 6 'el archivo de app-data está corrupto'
for dir in molotes birria; do
  grep -Eq "^(\./)?$dir/$" "$WORK/app-data.list" || fail 6 "app-data no contiene $dir/"
done

read -r USERS PRODUCTS LAST_MIGRATION <<<"$COUNTS_BEFORE"
COUNTS_STABLE=true
[[ "$COUNTS_BEFORE" == "$COUNTS_AFTER" ]] || COUNTS_STABLE=false
[[ "$USERS" =~ ^[0-9]+$ && "$PRODUCTS" =~ ^[0-9]+$ ]] || fail 6 'conteos de la base inválidos'

{
  printf 'format=1\n'
  printf 'created_at=%s\n' "$STAMP"
  printf 'commit=%s\n' "$COMMIT"
  printf 'app_image=%s\n' "$APP_IMAGE"
  printf 'migrate_image=%s\n' "$MIGRATE_IMAGE"
  printf 'users=%s\n' "$USERS"
  printf 'products=%s\n' "$PRODUCTS"
  printf 'last_migration=%s\n' "$LAST_MIGRATION"
  # false: hubo escrituras durante el volcado; los conteos del volcado pueden diferir un poco.
  printf 'counts_stable=%s\n' "$COUNTS_STABLE"
  printf 'app_data_entries=%s\n' "$(wc -l <"$WORK/app-data.list" | tr -d ' ')"
  printf 'dump_sha256=%s\n' "$(sha256_of "$WORK/dump.sql.gz")"
  printf 'app_data_sha256=%s\n' "$(sha256_of "$WORK/app-data.tar")"
} >"$WORK/manifest.txt"

# --- Cifrado (RF-3): solo claves públicas ----------------------------------------------------------
tar -C "$WORK" -cf "$WORK/bundle.tar" manifest.txt dump.sql.gz app-data.tar || fail 7 'no se pudo empaquetar el respaldo'
age -R "$RECIPIENTS_FILE" -o "$OFFSITE_DIR/$NAME.partial" "$WORK/bundle.tar" || {
  rm -f -- "$OFFSITE_DIR/$NAME.partial"
  fail 7 'falló el cifrado con age'
}
head -c 21 -- "$OFFSITE_DIR/$NAME.partial" | grep -q '^age-encryption.org/v1' || {
  rm -f -- "$OFFSITE_DIR/$NAME.partial"
  fail 7 'el archivo cifrado no tiene la cabecera de age'
}
chmod 600 -- "$OFFSITE_DIR/$NAME.partial"
mv -- "$OFFSITE_DIR/$NAME.partial" "$OFFSITE_DIR/$NAME"
rm -rf -- "$WORK"
WORK=''
log "cifrado: $NAME ($(size_of "$OFFSITE_DIR/$NAME") bytes; usuarios $USERS, productos $PRODUCTS, migración $LAST_MIGRATION)"

# --- Subida (RF-4) -------------------------------------------------------------------------------
UPLOAD_FAILED=0
if ! upload_tiers "$OFFSITE_DIR/$NAME" "$TIERS"; then
  printf '%s\n' "$TIERS" >"$OFFSITE_DIR/$NAME.pending"
  UPLOAD_FAILED=1
fi

# --- Retención local (RF-6): los 7 más recientes ---------------------------------------------------
find "$OFFSITE_DIR" -maxdepth 1 -type f -name 'restaurante-*.tar.age' -printf '%f\n' | sort -r | tail -n +$((KEEP_LOCAL + 1)) |
  while IFS= read -r old; do
    if [[ -e "$OFFSITE_DIR/$old.pending" ]]; then log "aviso: se descarta $old sin haberse subido"; fi
    rm -f -- "$OFFSITE_DIR/$old" "$OFFSITE_DIR/$old.pending"
  done
find "$OFFSITE_DIR" -maxdepth 1 -type f -name '*.partial' -mmin +60 -delete

if ((UPLOAD_FAILED || PENDING_FAILED)); then
  fail 8 "la subida a R2 falló; la copia cifrada queda en $OFFSITE_DIR y se reintentará"
fi

# --- Copia del .env si cambió (RF-9; también lo vigila restaurante-env-backup.path) ---------------
BACKUP_PARENT=1 "$SCRIPT_DIR/env-backup.sh" || fail 9 'falló la copia cifrada del .env'

log "respaldo completo: $NAME en $TIERS"
hc_ping '' "backup: $NAME en $TIERS; usuarios $USERS, productos $PRODUCTS, migración $LAST_MIGRATION"
PINGED=true
