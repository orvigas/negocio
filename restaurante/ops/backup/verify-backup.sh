#!/usr/bin/env bash
# Prueba mensual de restauración desde tu Mac (REQ-F-019, RF-11, CA-7) y simulacro completo (CA-8,
# con --drill). Nunca toca producción ni el VPS. Compatible con el bash 3.2 y las utilidades de macOS.
#
#   restaurante/ops/backup/verify-backup.sh [--drill] [--key <clave de R2> | --file <archivo .tar.age>]
#
# Sin --key ni --file usa el respaldo más reciente de daily/. Requiere Docker, age y curl, y la
# credencial de SOLO LECTURA de R2 en ~/.config/restaurante-backup/r2-readonly.conf (permisos 600;
# nunca en el VPS). Pide la clave privada de age sin eco.
#
# 1. Descarga, descifra y verifica las sumas del manifiesto.
# 2. Carga el volcado en un MySQL 8.4 efímero (el mismo digest de producción, sin puertos publicados)
#    y compara los conteos de user y product y la última migración con el manifiesto.
# 3. Solo en un respaldo de formato 1 (anterior a la limpieza de REQ-F-045): comprueba que app-data trae
#    los JSON de molotes/ y birria/. Los de formato 2 no traen app-data (la app ya no lo usa).
# 4. --drill: arranca la imagen de la app del respaldo y espera a que responda (requiere `docker login
#    ghcr.io` con un token de lectura). Con un respaldo de formato 1 le da también esa base y ese
#    app-data, que la app de entonces necesitaba; desde REQ-F-045 la app no usa ninguno de los dos.
#    Mide el tiempo total.
#
# Registra el resultado en ~/.config/restaurante-backup/pruebas.log y, si HC_PING_URL está en la
# configuración (check mensual), avisa a Healthchecks del éxito o del fallo. Borra al terminar los
# contenedores, el volumen, la red y los archivos descifrados.
set -euo pipefail
umask 077

SCRIPT_NAME=verify-backup
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=SCRIPTDIR/lib.sh
. "$SCRIPT_DIR/lib.sh"

DEPLOY_DIR=$(cd -- "$SCRIPT_DIR/../../deploy" && pwd -P)
CONFIG_FILE=${RESTAURANTE_BACKUP_CONFIG:-$HOME/.config/restaurante-backup/r2-readonly.conf}
RESULT_LOG=${RESTAURANTE_BACKUP_LOG:-$HOME/.config/restaurante-backup/pruebas.log}
HEALTH_TIMEOUT=${VERIFY_HEALTH_TIMEOUT:-300}
DATA_PATH=/var/lib/restaurante

DRILL=false
KEY=''
FILE=''
while [[ $# -gt 0 ]]; do
  case $1 in
    --drill) DRILL=true ;;
    --key)
      KEY=${2:-}
      shift
      ;;
    --file)
      FILE=${2:-}
      shift
      ;;
    *)
      log 'uso: verify-backup.sh [--drill] [--key <clave de R2> | --file <archivo .tar.age>]'
      exit 2
      ;;
  esac
  shift
done

ID=restaurante-verify-$(od -An -N4 -tx1 /dev/urandom | tr -d ' \n')
WORK=''
LABEL='?'
USERS='?'
PRODUCTS='?'
MIGRATION='?'
START=$SECONDS

cleanup() {
  local status=$?
  docker rm -f "$ID-app" "$ID-mysql" >/dev/null 2>&1 || true
  docker volume rm "$ID-data" >/dev/null 2>&1 || true
  docker network rm "$ID" >/dev/null 2>&1 || true
  [[ -n "$WORK" ]] && rm -rf -- "$WORK"
  exit "$status"
}
trap cleanup EXIT

record() { # record <ok|fallo> [motivo]
  local line
  line="fecha=$(date -u +%Y-%m-%dT%H:%M:%SZ) respaldo=$LABEL usuarios=$USERS productos=$PRODUCTS migracion=$MIGRATION simulacro=$DRILL duracion=$((SECONDS - START))s resultado=$1${2:+ motivo=\"$2\"}"
  mkdir -p -- "$(dirname -- "$RESULT_LOG")"
  printf '%s\n' "$line" >>"$RESULT_LOG"
  chmod 600 "$RESULT_LOG" # Sin --: el chmod de macOS lo toma como archivo y sale con 1.
  printf '%s\n' "$line"
}

fail() { # fail <mensaje>
  log "ERROR: $*"
  record fallo "$*"
  hc_ping fail "verify-backup: $*"
  exit 1
}

for tool in age docker curl gzip tar od; do
  command -v "$tool" >/dev/null 2>&1 || {
    log "ERROR: falta $tool (brew install age; Docker Desktop)"
    exit 2
  }
done

WORK=$(mktemp -d)

# --- 1. Descarga, descifrado y verificación ------------------------------------------------------
if [[ -n "$FILE" ]]; then
  [[ -f "$FILE" ]] || fail "no existe $FILE"
  cp -- "$FILE" "$WORK/backup.tar.age"
  LABEL=$(basename -- "$FILE")
  load_config "$CONFIG_FILE" optional >/dev/null 2>&1 || HC_PING_URL=''
else
  load_config "$CONFIG_FILE" optional || {
    log "ERROR: configuración inválida en $CONFIG_FILE"
    exit 2
  }
  if [[ -z "$KEY" ]]; then
    KEY=$(s3_list daily/ | grep -E '^daily/restaurante-[0-9]{8}T[0-9]{6}Z\.tar\.age$' | sort | tail -n 1) || true
    [[ -n "$KEY" ]] || fail 'no hay respaldos en daily/'
  fi
  [[ "$KEY" =~ ^(daily|weekly|monthly)/restaurante-[0-9]{8}T[0-9]{6}Z\.tar\.age$ ]] || fail 'clave de R2 no válida'
  LABEL=$KEY
  s3_get "$KEY" "$WORK/backup.tar.age" || fail "no se pudo descargar $KEY"
fi
log "respaldo: $LABEL"

read_identity || fail 'clave privada no válida'
age_decrypt "$WORK/backup.tar.age" "$WORK/bundle.tar" || fail 'no se pudo descifrar (¿clave equivocada?)'
AGE_IDENTITY=''
mkdir -- "$WORK/parts"
extract_parts "$WORK/bundle.tar" "$WORK/parts" || fail 'el paquete descifrado está dañado'
rm -f -- "$WORK/bundle.tar" "$WORK/backup.tar.age"
verify_parts "$WORK/parts" || fail 'el respaldo no pasó la verificación de sumas'
gzip -t "$WORK/parts/dump.sql.gz" || fail 'el volcado está dañado'
MANIFEST="$WORK/parts/manifest.txt"
EXPECTED_USERS=$(manifest_value "$MANIFEST" users)
EXPECTED_PRODUCTS=$(manifest_value "$MANIFEST" products)
EXPECTED_MIGRATION=$(manifest_value "$MANIFEST" last_migration)
COUNTS_STABLE=$(manifest_value "$MANIFEST" counts_stable)
APP_IMAGE=$(manifest_value "$MANIFEST" app_image)
log "manifiesto: formato $(manifest_value "$MANIFEST" format), creado $(manifest_value "$MANIFEST" created_at), commit $(manifest_value "$MANIFEST" commit), usuarios $EXPECTED_USERS, productos $EXPECTED_PRODUCTS, migración $EXPECTED_MIGRATION"

# --- 3. app-data (solo formato 1) ----------------------------------------------------------------
if has_app_data "$WORK/parts"; then
  tar -tf "$WORK/parts/app-data.tar" >"$WORK/app-data.list" || fail 'app-data está dañado'
  for dir in molotes birria; do
    grep -Eq "^(\./)?$dir/[^/]+\.json$" "$WORK/app-data.list" || fail "app-data no trae JSON de $dir/"
  done
  log 'app-data: JSON de molotes/ y birria/ presentes'
else
  log 'sin app-data (formato 2, posterior a REQ-F-045)'
fi

# --- 2. MySQL efímero ----------------------------------------------------------------------------
MYSQL_IMAGE=$(sed -n 's/^[[:space:]]*image:[[:space:]]*\(mysql:8\.4@sha256:[0-9a-f]\{64\}\)[[:space:]]*$/\1/p' "$DEPLOY_DIR/compose.prod.yaml" | head -n 1)
[[ -n "$MYSQL_IMAGE" ]] || fail "no se encontró la imagen de MySQL en $DEPLOY_DIR/compose.prod.yaml"
hex() { od -An -N32 -tx1 /dev/urandom | tr -d ' \n'; }
# Contraseñas efímeras: pasan a docker por el entorno (-e NOMBRE), nunca en argumentos.
MYSQL_ROOT_PASSWORD=$(hex)
RESTAURANTE_DB_APP_PASSWORD=$(hex)
RESTAURANTE_DB_MIGRATOR_PASSWORD=$(hex)
RESTAURANTE_DB_BACKUP_PASSWORD=$(hex)
export MYSQL_ROOT_PASSWORD RESTAURANTE_DB_APP_PASSWORD RESTAURANTE_DB_MIGRATOR_PASSWORD RESTAURANTE_DB_BACKUP_PASSWORD

docker network create --internal "$ID" >/dev/null
docker run -d --name "$ID-mysql" --network "$ID" --network-alias mysql \
  -e MYSQL_ROOT_PASSWORD -e RESTAURANTE_DB_APP_PASSWORD -e RESTAURANTE_DB_MIGRATOR_PASSWORD -e RESTAURANTE_DB_BACKUP_PASSWORD \
  -v "$DEPLOY_DIR/mysql/initdb:/docker-entrypoint-initdb.d:ro" \
  "$MYSQL_IMAGE" --character-set-server=utf8mb4 --collation-server=utf8mb4_es_0900_as_cs \
  --default-time-zone=+00:00 --skip-log-bin --mysqlx=OFF >/dev/null || fail 'no se pudo arrancar MySQL'

# shellcheck disable=SC2016 # Las variables se expanden dentro del contenedor.
mysql_root() {
  docker exec -i "$ID-mysql" sh -c '
    set -eu
    umask 077
    f=$(mktemp)
    trap "rm -f \"$f\"" EXIT
    printf "[client]\nuser=root\npassword=%s\nhost=127.0.0.1\n" "$MYSQL_ROOT_PASSWORD" >"$f"
    mysql --defaults-extra-file="$f" "$@"
  ' sh "$@"
}

# Listo cuando acepta conexiones TCP (durante la inicialización solo escucha en el socket).
ready=false
for _ in $(seq 1 90); do
  if mysql_root -N -B -e 'SELECT 1' >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 2
done
[[ "$ready" == true ]] || fail 'MySQL efímero no quedó listo'

gzip -dc "$WORK/parts/dump.sql.gz" | mysql_root --default-character-set=utf8mb4 || fail 'falló la carga del volcado'
COUNTS=$(mysql_root -N -B -e "SELECT (SELECT COUNT(*) FROM restaurante.user), (SELECT COUNT(*) FROM restaurante.product), (SELECT COALESCE(MAX(migration_name), '-') FROM restaurante._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)" | tr '\t' ' ') ||
  fail 'no se pudieron leer los conteos'
read -r USERS PRODUCTS MIGRATION <<EOF
$COUNTS
EOF
log "restaurado: usuarios $USERS, productos $PRODUCTS, migración $MIGRATION"
[[ "$MIGRATION" == "$EXPECTED_MIGRATION" ]] || fail "la última migración ($MIGRATION) no coincide con el manifiesto ($EXPECTED_MIGRATION)"
if [[ "$USERS" != "$EXPECTED_USERS" || "$PRODUCTS" != "$EXPECTED_PRODUCTS" ]]; then
  if [[ "$COUNTS_STABLE" == false ]]; then
    log "aviso: los conteos difieren del manifiesto, pero hubo escrituras durante el volcado (counts_stable=false)"
  else
    fail "los conteos no coinciden con el manifiesto (usuarios $EXPECTED_USERS, productos $EXPECTED_PRODUCTS)"
  fi
fi

# --- 4. Simulacro: la app del respaldo (con esta base y este app-data si es de formato 1) -----------
if [[ "$DRILL" == true ]]; then
  [[ "$APP_IMAGE" =~ ^[A-Za-z0-9./:@_-]+$ ]] || fail 'el manifiesto no tiene una imagen de la app válida'
  if ! docker image inspect "$APP_IMAGE" >/dev/null 2>&1; then
    log "descargando $APP_IMAGE"
    docker pull --quiet "$APP_IMAGE" >/dev/null || fail 'no se pudo descargar la imagen de la app (docker login ghcr.io)'
  fi
  # Sin el .env de producción: número de WhatsApp ficticio y sin bot (no envía nada).
  # API_INTERNAL_URL es obligatoria desde REQ-F-038; sin api en esta red, la app sirve la semilla.
  # INTERNAL_NOTIFY_TOKEN es obligatoria en producción desde REQ-F-039: una aleatoria y desechable (en
  # esta red no hay api que avise).
  INTERNAL_NOTIFY_TOKEN=$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')
  export INTERNAL_NOTIFY_TOKEN
  set -- -e NODE_ENV=production -e HOST=0.0.0.0 -e PORT=3000 -e TRUST_PROXY=true \
    -e BUSINESS_TIMEZONE=America/Mexico_City -e INTERNAL_NOTIFY_TOKEN \
    -e WHATSAPP_MOLOTES=5210000000000 -e WHATSAPP_BIRRIA=5210000000000 -e API_INTERNAL_URL=http://api:3001
  if has_app_data "$WORK/parts"; then
    # La app de un respaldo de formato 1 (anterior a REQ-F-045) no arranca sin la base ni DATA_DIR.
    docker volume create "$ID-data" >/dev/null
    # Misma ruta que en la imagen: el volumen nuevo hereda su dueño (node).
    # shellcheck disable=SC2016 # Se expande dentro del contenedor.
    docker run --rm -i --network none --cap-drop ALL --security-opt no-new-privileges \
      -v "$ID-data:$DATA_PATH" --entrypoint sh "$APP_IMAGE" -c 'tar -C "$1" -xf -' sh "$DATA_PATH" \
      <"$WORK/parts/app-data.tar" || fail 'no se pudo cargar app-data en el volumen'
    DATABASE_URL="mysql://restaurante_app:$RESTAURANTE_DB_APP_PASSWORD@mysql:3306/restaurante"
    export DATABASE_URL
    set -- "$@" -e DATABASE_URL -e DATA_DIR="$DATA_PATH" -v "$ID-data:$DATA_PATH"
  fi
  docker run -d --name "$ID-app" --network "$ID" "$@" \
    --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges \
    "$APP_IMAGE" >/dev/null || fail 'no se pudo arrancar la app'
  deadline=$((SECONDS + HEALTH_TIMEOUT))
  healthy=false
  while ((SECONDS < deadline)); do
    if docker exec "$ID-app" wget -q -O /dev/null http://127.0.0.1:3000/ >/dev/null 2>&1; then
      healthy=true
      break
    fi
    [[ "$(docker inspect -f '{{.State.Status}}' "$ID-app")" == exited ]] && break
    sleep 2
  done
  if [[ "$healthy" != true ]]; then
    docker logs --tail 30 "$ID-app" 2>&1 | sed 's/^/  app: /' >&2 || true
    fail 'la app del respaldo no respondió'
  fi
  log "simulacro: la app $APP_IMAGE responde"

  # --- 5. Simulacro: la cadena del Kardex (REQ-F-051, RF-13 y DT-T3-6 A) -------------------------
  # `inventory:verify` de la imagen api del respaldo, contra la base restaurada y con el usuario de la
  # app (solo lectura). Un respaldo sin tablas del Kardex, o sin `api_image` en el manifiesto
  # (anterior a REQ-F-051, o hecho tras una restauración), solo se anota.
  KARDEX=$(mysql_root -N -B -e "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'restaurante' AND TABLE_NAME = 'inventory_movement'") ||
    fail 'no se pudo comprobar si la base tiene Kardex'
  API_IMAGE=$(manifest_value "$MANIFEST" api_image)
  if [[ "$KARDEX" != 1 ]]; then
    log 'simulacro: el respaldo no tiene Kardex; inventory:verify no aplica'
  elif [[ -z "$API_IMAGE" ]]; then
    log 'aviso: el manifiesto no trae la imagen de la api; el Kardex no se verificó'
  else
    [[ "$API_IMAGE" =~ ^[A-Za-z0-9./:@_-]+$ ]] || fail 'el manifiesto no tiene una imagen de la api válida'
    if ! docker image inspect "$API_IMAGE" >/dev/null 2>&1; then
      log "descargando $API_IMAGE"
      docker pull --quiet "$API_IMAGE" >/dev/null || fail 'no se pudo descargar la imagen de la api (docker login ghcr.io)'
    fi
    DATABASE_URL="mysql://restaurante_app:$RESTAURANTE_DB_APP_PASSWORD@mysql:3306/restaurante"
    export DATABASE_URL
    # La salida solo lleva conteos, ids y nombres de comprobación (nunca costos, cantidades ni nombres).
    if VERIFY_OUT=$(docker run --rm --network "$ID" -e NODE_ENV=production -e DATABASE_URL \
      --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges \
      --entrypoint node "$API_IMAGE" scripts/inventory-verify.ts 2>&1); then
      log "simulacro: inventory:verify da 0 ($(printf '%s' "$VERIFY_OUT" | tail -n 1))"
    else
      printf '%s\n' "$VERIFY_OUT" | tail -n 20 | sed 's/^/  inventory:verify: /' >&2
      fail 'el Kardex restaurado no cuadra (inventory:verify distinto de 0)'
    fi
  fi
fi

record ok
hc_ping '' "verify-backup: $LABEL correcto en $((SECONDS - START)) s (simulacro: $DRILL)"
