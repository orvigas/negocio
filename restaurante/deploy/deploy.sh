#!/usr/bin/env bash
# Despliegue de producción (REQ-F-016, RF-5 y RF-6). Vive en /opt/restaurante/deploy/ (instalado por
# root, solo lectura para el usuario deploy) y es el único comando que puede ejecutar la llave SSH
# del workflow (authorized_keys: restrict,command="/opt/restaurante/deploy/deploy.sh"). Los
# argumentos llegan en SSH_ORIGINAL_COMMAND (o en $@ si se ejecuta a mano):
#
#   deploy <sha del commit> <digest app> <digest migrate> <digest api> <digest inventory> <suma de deploy/>
#
# Secuencia: precondiciones -> pull -> MySQL en marcha -> volcado (retención 7) -> migración ->
# api con el digest nuevo (REQ-F-038; healthy) -> inventory-manager con el digest nuevo (REQ-F-039;
# healthy + Traefik en el subdominio) -> app con el digest nuevo -> salud (healthy + Traefik) ->
# registro. Si falla antes del cambio de la app, no la toca: si la api nueva no queda healthy, vuelve
# a la api anterior y termina con 15; si inventory-manager no queda healthy, vuelve al anterior (o lo
# detiene si no lo había), deja la app como estaba y la api nueva en marcha y termina con 16. La app
# va la última porque la nueva activa el modo de solo lectura de los productos de /admin. Si falla la
# salud de la app, vuelve a los digests anteriores de app, api e inventory-manager (o lo detiene) con
# DATABASE_ALLOW_NEWER_SCHEMA=true (D-1) y termina con error. Nunca imprime secretos (sin set -x; no
# muestra el .env ni la configuración resuelta del compose).
set -euo pipefail
umask 077

DEPLOY_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
BASE_DIR=$(dirname -- "$DEPLOY_DIR")
ENV_FILE="$BASE_DIR/.env"
STATE_DIR="$BASE_DIR/state"
BACKUP_DIR="$BASE_DIR/backups"
COMPOSE_FILE="$DEPLOY_DIR/compose.prod.yaml"
# Archivos que se instalan en el VPS y cuya suma compara el workflow (el mismo orden en los dos).
DEPLOY_FILES=(compose.prod.yaml deploy.sh mysql/initdb/01-usuarios.sh)
KEEP_BACKUPS=7
HEALTH_TIMEOUT=180
PROBE_TIMEOUT=60
LOCK_TIMEOUT=1800

log() { printf '%s deploy: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
fail() {
  local code=$1
  shift
  log "ERROR: $*" >&2
  exit "$code"
}

deploy_sum() {
  (cd -- "$DEPLOY_DIR" && sha256sum -- "${DEPLOY_FILES[@]}" | sha256sum | cut -c1-64)
}

# Valor de una variable del .env (última aparición; sin comillas envolventes). No se usa `source`:
# el .env contiene secretos y valores con `$` (ADMIN_PASSWORD_HASH).
env_value() {
  local line
  line=$(grep -E "^[[:space:]]*$1=" "$ENV_FILE" | tail -n 1 || true)
  line=${line#*=}
  line=${line%\"}
  line=${line#\"}
  line=${line%\'}
  line=${line#\'}
  printf '%s' "$line"
}

# --- Argumentos ----------------------------------------------------------------------------------
if [[ -n "${SSH_ORIGINAL_COMMAND:-}" ]]; then
  # Solo letras, dígitos, espacios y ":" (nada que el shell pueda interpretar).
  [[ "$SSH_ORIGINAL_COMMAND" =~ ^[A-Za-z0-9:\ ]+$ ]] || fail 2 'comando SSH no permitido'
  read -r -a ARGS <<<"$SSH_ORIGINAL_COMMAND"
else
  ARGS=("$@")
fi
[[ ${#ARGS[@]} -eq 7 && "${ARGS[0]}" == deploy ]] || fail 2 'uso: deploy <sha> <digest app> <digest migrate> <digest api> <digest inventory> <suma de deploy/>'
SHA=${ARGS[1]}
APP_DIGEST=${ARGS[2]}
MIGRATE_DIGEST=${ARGS[3]}
API_DIGEST=${ARGS[4]}
INVENTORY_DIGEST=${ARGS[5]}
EXPECTED_SUM=${ARGS[6]}
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || fail 2 'sha del commit inválido'
[[ "$APP_DIGEST" =~ ^sha256:[0-9a-f]{64}$ ]] || fail 2 'digest de la app inválido'
[[ "$MIGRATE_DIGEST" =~ ^sha256:[0-9a-f]{64}$ ]] || fail 2 'digest de migrate inválido'
[[ "$API_DIGEST" =~ ^sha256:[0-9a-f]{64}$ ]] || fail 2 'digest de la api inválido'
[[ "$INVENTORY_DIGEST" =~ ^sha256:[0-9a-f]{64}$ ]] || fail 2 'digest de inventory-manager inválido'
[[ "$EXPECTED_SUM" =~ ^[0-9a-f]{64}$ ]] || fail 2 'suma de deploy/ inválida'

# --- Precondiciones ------------------------------------------------------------------------------
[[ -f "$ENV_FILE" ]] || fail 3 "falta $ENV_FILE"
[[ "$(stat -c '%a' -- "$ENV_FILE")" == 600 ]] || fail 3 "$ENV_FILE debe tener permisos 600"
if grep -Eq '^[[:space:]]*DATABASE_ALLOW_NEWER_SCHEMA=' "$ENV_FILE"; then
  fail 3 'DATABASE_ALLOW_NEWER_SCHEMA no puede estar en .env (solo la usa la vuelta atrás)'
fi
ACTUAL_SUM=$(deploy_sum)
[[ "$ACTUAL_SUM" == "$EXPECTED_SUM" ]] || fail 4 "deploy/ instalado no coincide con el del commit $SHA: reinstálalo (docs/despliegue.md, 'Actualizar deploy/')"

REGISTRY=$(env_value RESTAURANTE_REGISTRY)
REGISTRY=${REGISTRY:-ghcr.io/orvigas}
[[ "$REGISTRY" =~ ^[a-z0-9.-]+(:[0-9]+)?(/[a-z0-9._-]+)+$ ]] || fail 3 'RESTAURANTE_REGISTRY inválido'
DOMAIN=$(env_value RESTAURANTE_DOMAIN)
[[ "$DOMAIN" =~ ^[a-z0-9.-]+$ ]] || fail 3 'RESTAURANTE_DOMAIN inválido o ausente'
ADMIN_DOMAIN=$(env_value RESTAURANTE_ADMIN_DOMAIN)
[[ "$ADMIN_DOMAIN" =~ ^[a-z0-9.-]+$ ]] || fail 3 'RESTAURANTE_ADMIN_DOMAIN inválido o ausente (subdominio del admin nuevo, REQ-F-039)'
# Solo se comprueba la forma; el valor nunca se imprime.
NOTIFY_TOKEN_OK=false
[[ "$(env_value RESTAURANTE_INTERNAL_NOTIFY_TOKEN)" =~ ^[[:graph:]]{32,}$ ]] && NOTIFY_TOKEN_OK=true
[[ "$NOTIFY_TOKEN_OK" == true ]] || fail 3 'RESTAURANTE_INTERNAL_NOTIFY_TOKEN ausente o con menos de 32 caracteres (openssl rand -hex 32)'
PROBE_ADDRESS=$(env_value RESTAURANTE_PROBE_ADDRESS)
PROBE_ADDRESS=${PROBE_ADDRESS:-127.0.0.1}
[[ "$PROBE_ADDRESS" =~ ^[0-9a-fA-F.:]+$ ]] || fail 3 'RESTAURANTE_PROBE_ADDRESS debe ser una IP'

APP_IMAGE="$REGISTRY/restaurante@$APP_DIGEST"
MIGRATE_IMAGE="$REGISTRY/restaurante-migrate@$MIGRATE_DIGEST"
API_IMAGE="$REGISTRY/restaurante-api@$API_DIGEST"
INVENTORY_IMAGE="$REGISTRY/restaurante-inventory-manager@$INVENTORY_DIGEST"

mkdir -p -- "$STATE_DIR" "$BACKUP_DIR"
chmod 700 -- "$STATE_DIR" "$BACKUP_DIR"

exec 9>"$STATE_DIR/deploy.lock"
if ! flock -n 9; then
  log 'deploy_waiting_lock: otro despliegue en curso, esperando'
  flock -w "$LOCK_TIMEOUT" 9 || fail 5 'otro despliegue sigue en curso'
fi

# Nunca hereda la bandera de la vuelta atrás del entorno.
unset DATABASE_ALLOW_NEWER_SCHEMA

# Imágenes desplegadas antes de este despliegue (vacías en el primero; la de la api, también en el
# primer despliegue con api, REQ-F-038).
PREVIOUS_APP_IMAGE=''
PREVIOUS_MIGRATE_IMAGE=''
PREVIOUS_API_IMAGE=''
PREVIOUS_INVENTORY_IMAGE=''
if [[ -f "$STATE_DIR/release.env" ]]; then
  PREVIOUS_APP_IMAGE=$(sed -n 's/^RESTAURANTE_APP_IMAGE=//p' "$STATE_DIR/release.env")
  PREVIOUS_MIGRATE_IMAGE=$(sed -n 's/^RESTAURANTE_MIGRATE_IMAGE=//p' "$STATE_DIR/release.env")
  PREVIOUS_API_IMAGE=$(sed -n 's/^RESTAURANTE_API_IMAGE=//p' "$STATE_DIR/release.env")
  PREVIOUS_INVENTORY_IMAGE=$(sed -n 's/^RESTAURANTE_INVENTORY_IMAGE=//p' "$STATE_DIR/release.env")
fi

# docker compose con las imágenes indicadas (el entorno gana al .env).
# compose <imagen app> <imagen migrate> <imagen api> <imagen inventory> <argumentos...>
compose() {
  local app_image=$1 migrate_image=$2 api_image=$3 inventory_image=$4
  shift 4
  RESTAURANTE_APP_IMAGE="$app_image" RESTAURANTE_MIGRATE_IMAGE="$migrate_image" RESTAURANTE_API_IMAGE="$api_image" \
    RESTAURANTE_INVENTORY_IMAGE="$inventory_image" docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

# Con las imágenes de este despliegue.
compose_new() { compose "$APP_IMAGE" "$MIGRATE_IMAGE" "$API_IMAGE" "$INVENTORY_IMAGE" "$@"; }

# Imagen de un contenedor del proyecto (vacía si no existe). DEF-002 de REQ-F-038: tras una
# restauración (ops/backup/restore.sh), state/release.env ya no tiene RESTAURANTE_API_IMAGE; la api
# anterior es entonces la del contenedor en marcha.
running_image() { # running_image <servicio>
  local id
  id=$(compose_new ps -aq "$1" 2>/dev/null | head -n 1)
  if [[ -n "$id" ]]; then docker inspect -f '{{.Config.Image}}' "$id" 2>/dev/null || true; fi
}
if [[ -z "$PREVIOUS_API_IMAGE" ]]; then
  PREVIOUS_API_IMAGE=$(running_image api)
  # La imagen por defecto del compose (sin-desplegar) no es una api anterior.
  [[ "$PREVIOUS_API_IMAGE" =~ @sha256:[0-9a-f]{64}$ ]] || PREVIOUS_API_IMAGE=''
fi
if [[ -z "$PREVIOUS_INVENTORY_IMAGE" ]]; then
  PREVIOUS_INVENTORY_IMAGE=$(running_image inventory-manager)
  [[ "$PREVIOUS_INVENTORY_IMAGE" =~ @sha256:[0-9a-f]{64}$ ]] || PREVIOUS_INVENTORY_IMAGE=''
fi

# Migraciones terminadas en la base ("<n>:<última>"; vacío si la tabla aún no existe). Con el usuario
# de respaldo (solo lectura), por un archivo de opciones temporal: la contraseña nunca va en argv.
# shellcheck disable=SC2016 # Las variables se expanden dentro del contenedor.
applied_migrations() {
  compose_new exec -T mysql sh -c '
    set -eu
    umask 077
    f=$(mktemp)
    trap "rm -f \"$f\"" EXIT
    printf "[client]\nuser=restaurante_backup\npassword=%s\n" "$RESTAURANTE_DB_BACKUP_PASSWORD" >"$f"
    mysql --defaults-extra-file="$f" -N -B restaurante \
      -e "SELECT CONCAT(COUNT(*), \":\", COALESCE(MAX(migration_name), \"\")) FROM _prisma_migrations WHERE finished_at IS NOT NULL"
  ' 2>/dev/null || true
}

record() {
  printf '%s %s app=%s migrate=%s api=%s inventory=%s result=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$SHA" "$APP_DIGEST" "$MIGRATE_DIGEST" "$API_DIGEST" "$INVENTORY_DIGEST" "$1" >>"$STATE_DIR/releases.log"
}

log "inicio: commit $SHA, app $APP_DIGEST, migrate $MIGRATE_DIGEST, api $API_DIGEST, inventory $INVENTORY_DIGEST"

# --- 1. Imágenes ---------------------------------------------------------------------------------
docker pull --quiet "$APP_IMAGE" >/dev/null || { record pull_failed; fail 10 'no se pudo descargar la imagen de la app (¿token de GHCR caducado?)'; }
docker pull --quiet "$MIGRATE_IMAGE" >/dev/null || { record pull_failed; fail 10 'no se pudo descargar la imagen migrate'; }
docker pull --quiet "$API_IMAGE" >/dev/null || { record pull_failed; fail 10 'no se pudo descargar la imagen de la api'; }
docker pull --quiet "$INVENTORY_IMAGE" >/dev/null || { record pull_failed; fail 10 'no se pudo descargar la imagen de inventory-manager'; }
log 'imágenes descargadas'

# --- 2. MySQL en marcha (idempotente; en el primer despliegue crea la base y los usuarios) --------
compose_new up -d --wait --wait-timeout 240 mysql || { record mysql_failed; fail 11 'MySQL no quedó healthy'; }

# --- 3. Volcado previo (RF-5.3) ------------------------------------------------------------------
DUMP="$BACKUP_DIR/$(date -u +%Y%m%dT%H%M%SZ)-${SHA:0:12}.sql.gz"
# Credenciales en un archivo de opciones temporal dentro del contenedor: nunca en argv.
# shellcheck disable=SC2016 # Las variables se expanden dentro del contenedor.
if ! compose_new exec -T mysql sh -c '
  set -eu
  umask 077
  f=$(mktemp)
  trap "rm -f \"$f\"" EXIT
  printf "[mysqldump]\nuser=restaurante_backup\npassword=%s\n" "$RESTAURANTE_DB_BACKUP_PASSWORD" >"$f"
  mysqldump --defaults-extra-file="$f" --single-transaction --no-tablespaces --skip-lock-tables \
    --default-character-set=utf8mb4 --hex-blob --set-gtid-purged=OFF --databases restaurante
' | gzip -c >"$DUMP.partial"; then
  rm -f -- "$DUMP.partial"
  record dump_failed
  fail 12 'falló el volcado de la base; la app no se tocó'
fi
if ! gzip -t -- "$DUMP.partial" || ! gzip -dc -- "$DUMP.partial" | tail -n 1 | grep -q '^-- Dump completed'; then
  rm -f -- "$DUMP.partial"
  record dump_failed
  fail 12 'el volcado está incompleto; la app no se tocó'
fi
mv -- "$DUMP.partial" "$DUMP"
# Retención: los 7 más recientes.
find "$BACKUP_DIR" -maxdepth 1 -type f -name '*.sql.gz' -printf '%T@ %p\n' | sort -rn | tail -n +$((KEEP_BACKUPS + 1)) | cut -d' ' -f2- |
  while IFS= read -r old; do rm -f -- "$old"; done
log "volcado: $(basename -- "$DUMP")"

# --- 4. Migración --------------------------------------------------------------------------------
MIGRATIONS_BEFORE=$(applied_migrations)
if ! compose_new run --rm --no-deps migrate; then
  record migrate_failed
  fail 13 "falló la migración; la app no se tocó. Si quedó a medias, restaura $(basename -- "$DUMP") (docs/despliegue.md)"
fi
log 'migraciones aplicadas'
MIGRATIONS_AFTER=$(applied_migrations)

# --- 5, 6 y 7. API, inventory-manager y app con el digest nuevo y comprobación de salud ----------
# -a: también un contenedor que se está reiniciando o que se paró.
# service_container <servicio> <imagen app> <imagen migrate> <imagen api> <imagen inventory>
service_container() { compose "$2" "$3" "$4" "$5" ps -aq "$1"; }
app_container() { service_container app "$@"; }

# wait_healthy <servicio> <imagen app> <imagen migrate> <imagen api> <imagen inventory>
wait_healthy() {
  local service=$1 id status restarts deadline=$((SECONDS + HEALTH_TIMEOUT))
  shift
  while ((SECONDS < deadline)); do
    id=$(service_container "$service" "$@")
    if [[ -n "$id" ]]; then
      status=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$id")
      restarts=$(docker inspect -f '{{.RestartCount}}' "$id")
      [[ "$status" == healthy ]] && return 0
      # Un contenedor que se reinicia o que se paró no va a quedar healthy: no se espera más.
      if [[ "$restarts" -gt 0 || "$(docker inspect -f '{{.State.Status}}' "$id")" == exited ]]; then return 1; fi
    fi
    sleep 2
  done
  return 1
}

# probe_https <host> <ruta>: Traefik enruta el host (por PROBE_ADDRESS, sin depender del DNS).
probe_https() {
  local deadline=$((SECONDS + PROBE_TIMEOUT))
  while ((SECONDS < deadline)); do
    # -k: en el primer despliegue el certificado puede estar emitiéndose; aquí se comprueba el enrutado.
    # Sin mensajes: Traefik puede tardar un instante en ver el contenedor healthy (404 transitorio).
    if curl -fs -k -o /dev/null --max-time 5 --resolve "$1:443:$PROBE_ADDRESS" "https://$1$2"; then return 0; fi
    sleep 2
  done
  return 1
}
probe_traefik() { probe_https "$DOMAIN" /; }
probe_admin() { probe_https "$ADMIN_DOMAIN" /salud; }

# DEF-001 (REQ-F-038): si este despliegue aplicó migraciones y algo falla antes de cambiar la app, la
# app en marcha (creada sin DATABASE_ALLOW_NEWER_SCHEMA) no podría volver a arrancar sobre la base
# migrada si se reinicia (DATABASE_NEWER_THAN_CODE). Se recrea con su misma imagen y la bandera (D-1):
# un corte de unos segundos ahora en lugar de una caída total en el próximo reinicio. Sin migraciones
# nuevas (o sin app en marcha), la app no se toca.
# protect_running_app <imagen api vigente> <imagen inventory vigente> <resultado> <código> <mensaje>
protect_running_app() {
  local api_image=$1 inventory_image=$2 result=$3 code=$4 message=$5 running
  running=$(running_image app)
  if [[ -n "$running" && ( -z "$MIGRATIONS_AFTER" || "$MIGRATIONS_AFTER" != "$MIGRATIONS_BEFORE" ) ]]; then
    log "hubo migraciones nuevas: la app en marcha ($running) se recrea con DATABASE_ALLOW_NEWER_SCHEMA=true"
    export DATABASE_ALLOW_NEWER_SCHEMA=true
    compose "$running" "$MIGRATE_IMAGE" "$api_image" "$inventory_image" up -d --no-deps app
    if ! wait_healthy app "$running" "$MIGRATE_IMAGE" "$api_image" "$inventory_image" || ! probe_traefik; then
      record "${result}_app_unhealthy"
      fail 22 "$message; la app recreada tampoco quedó healthy: restaura la base desde $(basename -- "$DUMP") (docs/despliegue.md)"
    fi
    record "$result"
    fail "$code" "$message; la app sigue con su versión, recreada con DATABASE_ALLOW_NEWER_SCHEMA=true por las migraciones nuevas"
  fi
  record "$result"
  fail "$code" "$message; la app no se tocó"
}

# Versión de inventory-manager a la que se vuelve si algo falla: la anterior o, si no la había,
# ninguna (se detiene). Así nunca queda el admin nuevo junto a una app que todavía edita productos.
# restore_inventory <imagen app> <imagen api>
restore_inventory() {
  if [[ -n "$PREVIOUS_INVENTORY_IMAGE" ]]; then
    log "volviendo a inventory-manager $PREVIOUS_INVENTORY_IMAGE"
    compose "$1" "$MIGRATE_IMAGE" "$2" "$PREVIOUS_INVENTORY_IMAGE" up -d --no-deps inventory-manager || true
  else
    log 'sin versión anterior de inventory-manager: se detiene'
    compose "$1" "$MIGRATE_IMAGE" "$2" "$INVENTORY_IMAGE" stop inventory-manager >/dev/null 2>&1 || true
  fi
}

# 5. API (REQ-F-038). Las landings toleran que no esté (sirven su última copia o la semilla), pero
# no se cambia la app si la api nueva no queda healthy.
compose_new up -d --no-deps api
if ! wait_healthy api "$APP_IMAGE" "$MIGRATE_IMAGE" "$API_IMAGE" "$INVENTORY_IMAGE"; then
  log 'la api nueva no pasó la comprobación de salud'
  docker logs --tail 50 "$(service_container api "$APP_IMAGE" "$MIGRATE_IMAGE" "$API_IMAGE" "$INVENTORY_IMAGE")" 2>&1 | sed 's/^/  api: /' >&2 || true
  if [[ -n "$PREVIOUS_API_IMAGE" ]]; then
    log "volviendo a la api $PREVIOUS_API_IMAGE"
    # La api anterior no conoce las migraciones que se acaban de aplicar: las tolera (D-1). El script
    # termina justo después, así que la variable no llega a nada más.
    export DATABASE_ALLOW_NEWER_SCHEMA=true
    compose "$APP_IMAGE" "$MIGRATE_IMAGE" "$PREVIOUS_API_IMAGE" "${PREVIOUS_INVENTORY_IMAGE:-$INVENTORY_IMAGE}" up -d --no-deps api || true
  fi
  protect_running_app "${PREVIOUS_API_IMAGE:-$API_IMAGE}" "${PREVIOUS_INVENTORY_IMAGE:-$INVENTORY_IMAGE}" api_failed 15 'la api nueva no quedó healthy'
fi
log 'api healthy'

# 6. inventory-manager (REQ-F-039). Antes que la app: la app nueva activa el modo de solo lectura de los
# productos de /admin, y no debe hacerlo si el admin nuevo no queda sano.
compose_new up -d --no-deps inventory-manager
if ! wait_healthy inventory-manager "$APP_IMAGE" "$MIGRATE_IMAGE" "$API_IMAGE" "$INVENTORY_IMAGE" || ! probe_admin; then
  log 'inventory-manager no pasó la comprobación de salud'
  docker logs --tail 50 "$(service_container inventory-manager "$APP_IMAGE" "$MIGRATE_IMAGE" "$API_IMAGE" "$INVENTORY_IMAGE")" 2>&1 | sed 's/^/  inventory-manager: /' >&2 || true
  CURRENT_APP_IMAGE=$(running_image app)
  restore_inventory "${CURRENT_APP_IMAGE:-$APP_IMAGE}" "$API_IMAGE"
  # La api nueva queda (es compatible con la app anterior: los endpoints públicos no cambian).
  protect_running_app "$API_IMAGE" "${PREVIOUS_INVENTORY_IMAGE:-$INVENTORY_IMAGE}" inventory_failed 16 'inventory-manager no quedó healthy; la api nueva sigue'
fi
log 'inventory-manager healthy'

# 7. App.
compose_new up -d --no-deps app
if wait_healthy app "$APP_IMAGE" "$MIGRATE_IMAGE" "$API_IMAGE" "$INVENTORY_IMAGE" && probe_traefik; then
  if [[ -f "$STATE_DIR/release.env" ]]; then mv -f -- "$STATE_DIR/release.env" "$STATE_DIR/release.env.previous"; fi
  printf 'RESTAURANTE_APP_IMAGE=%s\nRESTAURANTE_MIGRATE_IMAGE=%s\nRESTAURANTE_API_IMAGE=%s\nRESTAURANTE_INVENTORY_IMAGE=%s\nRESTAURANTE_COMMIT=%s\n' \
    "$APP_IMAGE" "$MIGRATE_IMAGE" "$API_IMAGE" "$INVENTORY_IMAGE" "$SHA" >"$STATE_DIR/release.env.tmp"
  chmod 644 -- "$STATE_DIR/release.env.tmp"
  mv -f -- "$STATE_DIR/release.env.tmp" "$STATE_DIR/release.env"
  record ok
  log "desplegado: $APP_IMAGE"
  exit 0
fi

# --- Vuelta atrás (RF-6) -------------------------------------------------------------------------
log 'la versión nueva no pasó la comprobación de salud'
docker logs --tail 50 "$(app_container "$APP_IMAGE" "$MIGRATE_IMAGE" "$API_IMAGE" "$INVENTORY_IMAGE")" 2>&1 | sed 's/^/  app: /' >&2 || true
if [[ -z "$PREVIOUS_APP_IMAGE" ]]; then
  record health_failed_no_previous
  fail 20 'primer despliegue: no hay versión anterior a la que volver'
fi
log "volviendo a $PREVIOUS_APP_IMAGE"
# La versión anterior no conoce las migraciones que se acaban de aplicar: las tolera (D-1).
export DATABASE_ALLOW_NEWER_SCHEMA=true
# La api vuelve también a la anterior si la hay; si no (primer despliegue con api), se queda la nueva.
ROLLBACK_API_IMAGE=${PREVIOUS_API_IMAGE:-$API_IMAGE}
ROLLBACK_MIGRATE_IMAGE=${PREVIOUS_MIGRATE_IMAGE:-$MIGRATE_IMAGE}
ROLLBACK_INVENTORY_IMAGE=${PREVIOUS_INVENTORY_IMAGE:-$INVENTORY_IMAGE}
if [[ -n "$PREVIOUS_API_IMAGE" ]]; then
  log "volviendo a la api $PREVIOUS_API_IMAGE"
  compose "$PREVIOUS_APP_IMAGE" "$ROLLBACK_MIGRATE_IMAGE" "$ROLLBACK_API_IMAGE" "$ROLLBACK_INVENTORY_IMAGE" up -d --no-deps api || true
fi
# inventory-manager también vuelve (o se detiene): la app anterior puede editar productos.
restore_inventory "$PREVIOUS_APP_IMAGE" "$ROLLBACK_API_IMAGE"
compose "$PREVIOUS_APP_IMAGE" "$ROLLBACK_MIGRATE_IMAGE" "$ROLLBACK_API_IMAGE" "$ROLLBACK_INVENTORY_IMAGE" up -d --no-deps app
if wait_healthy app "$PREVIOUS_APP_IMAGE" "$ROLLBACK_MIGRATE_IMAGE" "$ROLLBACK_API_IMAGE" "$ROLLBACK_INVENTORY_IMAGE" && probe_traefik; then
  record health_failed_rolled_back
  fail 21 "versión anterior restaurada ($PREVIOUS_APP_IMAGE); el despliegue falló"
fi
record health_failed_rollback_failed
fail 22 "la versión anterior tampoco quedó healthy: restaura la base desde $(basename -- "$DUMP") (docs/despliegue.md)"
