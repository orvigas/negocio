#!/usr/bin/env bash
# Restauración de producción desde un respaldo cifrado (REQ-F-019, RF-10). Runbook completo en
# docs/despliegue.md ("Respaldos fuera del VPS"). Se ejecuta en el VPS como deploy:
#
#   sudo -u deploy /opt/restaurante/ops/backup/restore.sh <origen> [--confirm restaurante]
#
# <origen>: `latest` (último de daily/ en R2), una clave de R2 (daily/restaurante-...tar.age) o un
# archivo local .tar.age (p. ej. de /opt/restaurante/offsite/).
#
# Pide la clave privada de age (AGE-SECRET-KEY-1...) sin eco; nunca toca el disco ni los argumentos.
# Secuencia, con el candado de deploy.sh: descargar -> descifrar -> verificar sumas -> confirmar ->
# MySQL en marcha -> parar la app -> DROP DATABASE y carga del volcado -> restaurar app-data ->
# arrancar la imagen de la app del respaldo -> salud -> state/release.env y releases.log. Mide cada
# fase. Se pierde todo lo escrito después del respaldo.
#
# Códigos: 2 uso o configuración, 3 precondición, 4 candado, 6 descifrado o integridad, 10 carga de
# la base, 11 app-data, 12 la app no quedó healthy.
set -euo pipefail
umask 077

SCRIPT_NAME=restore
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=SCRIPTDIR/lib.sh
. "$SCRIPT_DIR/lib.sh"

BASE_DIR=${RESTAURANTE_BASE_DIR:-/opt/restaurante}
CONFIG_DIR=${BACKUP_CONFIG_DIR:-/etc/restaurante-backup}
PROJECT=${COMPOSE_PROJECT_NAME:-restaurante}
STATE_DIR="$BASE_DIR/state"
ENV_FILE="$BASE_DIR/.env"
COMPOSE_FILE="$BASE_DIR/deploy/compose.prod.yaml"
HEALTH_TIMEOUT=${RESTORE_HEALTH_TIMEOUT:-180}
DATA_PATH=/var/lib/restaurante

fail() { # fail <código> <mensaje>
  local code=$1
  shift
  log "ERROR: $*"
  exit "$code"
}

usage() { fail 2 'uso: restore.sh <latest | clave de R2 | archivo .tar.age> [--confirm restaurante]'; }

SOURCE=${1:-}
[[ -n "$SOURCE" ]] || usage
CONFIRM=''
if [[ $# -ge 2 ]]; then
  [[ $# -eq 3 && "$2" == --confirm ]] || usage
  CONFIRM=$3
fi

WORK=''
trap '[[ -n "$WORK" ]] && rm -rf -- "$WORK"' EXIT

START=$SECONDS
PHASE_START=$SECONDS
phase() { # phase <nombre>: registra la duración de la fase anterior
  log "fase: $1 (+$((SECONDS - PHASE_START)) s; total $((SECONDS - START)) s)"
  PHASE_START=$SECONDS
}

# docker compose con las imágenes del respaldo (el entorno gana al .env, como en deploy.sh).
compose() {
  RESTAURANTE_APP_IMAGE="$APP_IMAGE" RESTAURANTE_MIGRATE_IMAGE="$MIGRATE_IMAGE" COMPOSE_PROJECT_NAME="$PROJECT" \
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

# mysql como root dentro del contenedor (contraseña de su entorno a un archivo de opciones temporal).
# shellcheck disable=SC2016 # Las variables se expanden dentro del contenedor.
mysql_root() { # mysql_root <argumentos de mysql...> (stdin pasa a mysql)
  compose exec -T mysql sh -c '
    set -eu
    umask 077
    f=$(mktemp)
    trap "rm -f \"$f\"" EXIT
    printf "[client]\nuser=root\npassword=%s\n" "$MYSQL_ROOT_PASSWORD" >"$f"
    mysql --defaults-extra-file="$f" "$@"
  ' sh "$@"
}

# --- Precondiciones ------------------------------------------------------------------------------
[[ -f "$COMPOSE_FILE" ]] || fail 3 "falta $COMPOSE_FILE: instala deploy/ antes (docs/despliegue.md, paso 1.3)"
[[ -f "$ENV_FILE" ]] || fail 3 "falta $ENV_FILE: recupéralo de env/ en R2 (docs/despliegue.md)"
[[ -d "$STATE_DIR" ]] || fail 3 "falta $STATE_DIR"
for tool in age docker flock curl gzip tar; do
  command -v "$tool" >/dev/null 2>&1 || fail 3 "falta $tool en el host"
done

exec 9>>"$STATE_DIR/deploy.lock"
flock -w 60 9 || fail 4 'hay un despliegue o un respaldo en curso; vuelve a intentarlo'

WORK=$(mktemp -d)

# --- Descarga ------------------------------------------------------------------------------------
if [[ -f "$SOURCE" ]]; then
  cp -- "$SOURCE" "$WORK/backup.tar.age"
  BACKUP_LABEL=$(basename -- "$SOURCE")
else
  load_config "$CONFIG_DIR/backup.env" optional || fail 2 'configuración de R2 inválida'
  KEY=$SOURCE
  if [[ "$KEY" == latest ]]; then
    KEY=$(s3_list daily/ | grep -E '^daily/restaurante-[0-9]{8}T[0-9]{6}Z\.tar\.age$' | sort | tail -n 1) || true
    [[ -n "$KEY" ]] || fail 3 'no hay respaldos en daily/'
  fi
  [[ "$KEY" =~ ^(daily|weekly|monthly)/restaurante-[0-9]{8}T[0-9]{6}Z\.tar\.age$ ]] || fail 2 'clave de R2 no válida'
  s3_get "$KEY" "$WORK/backup.tar.age" || fail 3 "no se pudo descargar $KEY"
  BACKUP_LABEL=$KEY
fi
phase "descargado $BACKUP_LABEL"

# --- Descifrado e integridad ---------------------------------------------------------------------
read_identity || fail 2 'clave privada no válida'
age_decrypt "$WORK/backup.tar.age" "$WORK/bundle.tar" || fail 6 'no se pudo descifrar (¿clave equivocada?)'
AGE_IDENTITY=''
mkdir -- "$WORK/parts"
tar -C "$WORK/parts" -xf "$WORK/bundle.tar" manifest.txt dump.sql.gz app-data.tar || fail 6 'el paquete descifrado está dañado'
rm -f -- "$WORK/bundle.tar" "$WORK/backup.tar.age"
verify_parts "$WORK/parts" || fail 6 'el respaldo no pasó la verificación'
gzip -t -- "$WORK/parts/dump.sql.gz" || fail 6 'el volcado está dañado'

MANIFEST="$WORK/parts/manifest.txt"
APP_IMAGE=$(manifest_value "$MANIFEST" app_image)
MIGRATE_IMAGE=$(manifest_value "$MANIFEST" migrate_image)
COMMIT=$(manifest_value "$MANIFEST" commit)
[[ "$APP_IMAGE" =~ ^[A-Za-z0-9./:@_-]+$ ]] || fail 6 'el manifiesto no tiene una imagen de la app válida'
[[ "$MIGRATE_IMAGE" =~ ^[A-Za-z0-9./:@_-]*$ ]] || fail 6 'imagen migrate inválida en el manifiesto'
MIGRATE_IMAGE=${MIGRATE_IMAGE:-$APP_IMAGE}
log "respaldo del $(manifest_value "$MANIFEST" created_at), commit ${COMMIT:-?}: usuarios $(manifest_value "$MANIFEST" users), productos $(manifest_value "$MANIFEST" products), migración $(manifest_value "$MANIFEST" last_migration)"
log "imagen de la app que se arrancará: $APP_IMAGE"
phase 'descifrado y verificado'

# --- Confirmación --------------------------------------------------------------------------------
if [[ -z "$CONFIRM" && -t 0 ]]; then
  printf 'Se BORRAN la base restaurante y app-data de producción. Escribe "restaurante" para continuar: ' >&2
  IFS= read -r CONFIRM
fi
[[ "$CONFIRM" == restaurante ]] || fail 2 'restauración cancelada'
START_DOWNTIME=$SECONDS

# --- Base de datos -------------------------------------------------------------------------------
compose up -d --wait --wait-timeout 240 mysql || fail 3 'MySQL no quedó healthy'
compose stop app >/dev/null 2>&1 || true
phase 'app detenida'
mysql_root -e 'DROP DATABASE IF EXISTS restaurante' || fail 10 'no se pudo borrar la base'
gzip -dc -- "$WORK/parts/dump.sql.gz" | mysql_root --default-character-set=utf8mb4 || fail 10 'falló la carga del volcado (la app sigue parada; repite la restauración)'
phase 'base cargada'

# --- app-data ------------------------------------------------------------------------------------
# Se monta en la misma ruta que en la imagen: un volumen nuevo hereda su dueño (node).
compose create app >/dev/null 2>&1 || true
VOLUME="${PROJECT}_app-data"
docker volume inspect "$VOLUME" >/dev/null 2>&1 || fail 11 "no existe el volumen $VOLUME"
# shellcheck disable=SC2016 # Se expande dentro del contenedor.
docker run --rm -i --network none --cap-drop ALL --security-opt no-new-privileges \
  -v "$VOLUME:$DATA_PATH" --entrypoint sh "$APP_IMAGE" -c 'set -eu; find "$1" -mindepth 1 -delete; tar -C "$1" -xf -' sh "$DATA_PATH" \
  <"$WORK/parts/app-data.tar" || fail 11 'no se pudo restaurar app-data (la app sigue parada)'
phase 'app-data restaurado'
rm -rf -- "$WORK"
WORK=''

# --- App con la imagen del respaldo y salud ------------------------------------------------------
compose up -d --no-deps app || fail 12 'no se pudo arrancar la app'
deadline=$((SECONDS + HEALTH_TIMEOUT))
status=''
while ((SECONDS < deadline)); do
  id=$(compose ps -aq app)
  if [[ -n "$id" ]]; then
    status=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$id")
    [[ "$status" == healthy ]] && break
    [[ "$(docker inspect -f '{{.State.Status}}' "$id")" == exited ]] && break
  fi
  sleep 2
done
if [[ "$status" != healthy ]]; then
  docker logs --tail 40 "$(compose ps -aq app)" 2>&1 | sed 's/^/  app: /' >&2 || true
  fail 12 'la app no quedó healthy: revisa el runbook (MIGRATIONS_PENDING, DATABASE_NEWER_THAN_CODE)'
fi
phase 'app healthy'

if [[ -f "$STATE_DIR/release.env" ]]; then cp -f -- "$STATE_DIR/release.env" "$STATE_DIR/release.env.previous"; fi
printf 'RESTAURANTE_APP_IMAGE=%s\nRESTAURANTE_MIGRATE_IMAGE=%s\nRESTAURANTE_COMMIT=%s\n' "$APP_IMAGE" "$MIGRATE_IMAGE" "$COMMIT" >"$STATE_DIR/release.env.tmp"
chmod 644 -- "$STATE_DIR/release.env.tmp"
mv -f -- "$STATE_DIR/release.env.tmp" "$STATE_DIR/release.env"
printf '%s %s restore=%s app=%s result=restored\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${COMMIT:-?}" "$BACKUP_LABEL" "$APP_IMAGE" >>"$STATE_DIR/releases.log"

log "restauración completa en $((SECONDS - START)) s (app sin servicio $((SECONDS - START_DOWNTIME)) s). Comprueba docs/despliegue.md, paso 8."
