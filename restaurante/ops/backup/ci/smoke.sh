#!/usr/bin/env bash
# Prueba de humo de los respaldos (REQ-F-019, job `despliegue` del CI). Levanta el compose de
# producción (MySQL y app), un S3 local (versitygw, fijado por digest; admite SigV4 e If-None-Match
# como R2) y un Healthchecks falso, y ejecuta backup.sh, env-backup.sh, restore.sh y
# verify-backup.sh --drill tal como en el VPS y en el Mac. Nunca toca R2, Healthchecks ni el VPS.
#
#   ops/backup/ci/smoke.sh <imagen production> <imagen migrate>
#
# Requiere Docker con compose, bash, curl, age, gzip, tar, flock y GNU coreutils (Linux).
# Lo que no se puede probar aquí (bucket locks y ciclo de vida de R2, el timer real, Healthchecks
# real) se comprueba en la instalación (docs/despliegue.md, "Respaldos fuera del VPS").
# SMOKE_WORKDIR: carpeta de trabajo (por defecto, una temporal). Si Docker corre en otra máquina,
# debe ser una ruta que el daemon vea igual (el compose monta deploy/mysql/initdb).
set -euo pipefail

APP_SRC=${1:?uso: smoke.sh <imagen production> <imagen migrate>}
MIGRATE_SRC=${2:?uso: smoke.sh <imagen production> <imagen migrate>}

OPS_SRC=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)
DEPLOY_SRC=$(cd -- "$OPS_SRC/../../deploy" && pwd -P)
WORK=${SMOKE_WORKDIR:-$(mktemp -d)}
mkdir -p -- "$WORK"
WORK=$(cd -- "$WORK" && pwd -P)
BASE="$WORK/opt/restaurante"
ETC="$WORK/etc/restaurante-backup"
OPS="$BASE/ops/backup"
export COMPOSE_PROJECT_NAME=restaurante-bksmoke
S3_IMAGE=versity/versitygw:v1.9.0@sha256:eb7f786fcd91e72194e48fcf1ac16302d686bf8e3a71434bdbc067a6efd3fdc7
S3_PORT=${SMOKE_S3_PORT:-17070}
HC_PORT=${SMOKE_HC_PORT:-18000}
BUCKET=restaurante-respaldos
CREATED_NETWORK=false
FAILURES=0

say() { printf '\n== %s\n' "$*"; }
ok() { printf '  ok: %s\n' "$*"; }
ko() {
  printf '  FALLO: %s\n' "$*" >&2
  FAILURES=$((FAILURES + 1))
}
check() { # check <descripción> <comando...>
  local description=$1
  shift
  if "$@"; then ok "$description"; else ko "$description"; fi
}
expect_exit() { # expect_exit <código> <comando...>
  local expected=$1 status=0
  shift
  "$@" || status=$?
  [[ "$status" == "$expected" ]] || {
    printf '  (código %s, se esperaba %s)\n' "$status" "$expected" >&2
    return 1
  }
}

hex() { od -An -N"${1:-32}" -tx1 /dev/urandom | tr -d ' \n'; }

compose() {
  RESTAURANTE_APP_IMAGE="$APP_SRC" RESTAURANTE_MIGRATE_IMAGE="$MIGRATE_SRC" \
    docker compose -f "$BASE/deploy/compose.prod.yaml" --env-file "$BASE/.env" "$@"
}

cleanup() {
  local status=$?
  if ((status != 0 || FAILURES > 0)); then
    say 'diagnóstico'
    compose ps -a 2>/dev/null || true
    docker logs --tail 40 bksmoke-s3 2>&1 | sed 's/^/  s3: /' || true
  fi
  compose --profile migrate down -v --remove-orphans >/dev/null 2>&1 || true
  docker rm -f bksmoke-s3 bksmoke-hc >/dev/null 2>&1 || true
  if [[ "$CREATED_NETWORK" == true ]]; then docker network rm traefik-public >/dev/null 2>&1 || true; fi
  if [[ -z "${SMOKE_WORKDIR:-}" ]]; then rm -rf -- "$WORK"; else rm -rf -- "${WORK:?}"/*; fi
  exit "$status"
}
trap cleanup EXIT

# Entorno de los scripts (en el VPS son los valores por defecto).
export RESTAURANTE_BASE_DIR="$BASE" BACKUP_CONFIG_DIR="$ETC" BACKUP_ALLOW_INSECURE_ENDPOINTS=1

run() { # run <nombre del log> [VAR=valor...] <comando> [args...]: salida en $WORK/logs/<nombre>.log
  local name=$1 status=0
  shift
  env "$@" >"$WORK/logs/$name.log" 2>&1 || status=$?
  sed 's/^/  | /' "$WORK/logs/$name.log"
  return "$status"
}

mysql_root() { # mysql_root <sql>
  # shellcheck disable=SC2016 # Se expande dentro del contenedor.
  compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -N -B restaurante -e "$1"' sh "$1"
}

# --- Preparación ---------------------------------------------------------------------------------
say 'preparación'
if [[ -n "${SMOKE_WORKDIR:-}" ]]; then rm -rf -- "${WORK:?}"/*; fi
mkdir -p -- "$BASE/deploy/mysql/initdb" "$BASE/state" "$OPS" "$ETC" "$WORK/logs" "$WORK/bin"
chmod 700 "$BASE/state"
install -m 644 "$DEPLOY_SRC/compose.prod.yaml" "$BASE/deploy/compose.prod.yaml"
install -m 755 "$DEPLOY_SRC/mysql/initdb/01-usuarios.sh" "$BASE/deploy/mysql/initdb/01-usuarios.sh"
for script in lib.sh backup.sh env-backup.sh restore.sh; do install -m 755 "$OPS_SRC/$script" "$OPS/$script"; done

{
  sed -e "s/^MYSQL_ROOT_PASSWORD=.*/MYSQL_ROOT_PASSWORD=$(hex)/" \
    -e "s/^RESTAURANTE_DB_APP_PASSWORD=.*/RESTAURANTE_DB_APP_PASSWORD=$(hex)/" \
    -e "s/^RESTAURANTE_DB_MIGRATOR_PASSWORD=.*/RESTAURANTE_DB_MIGRATOR_PASSWORD=$(hex)/" \
    -e "s/^RESTAURANTE_DB_BACKUP_PASSWORD=.*/RESTAURANTE_DB_BACKUP_PASSWORD=$(hex)/" \
    -e 's/^WHATSAPP_MOLOTES=.*/WHATSAPP_MOLOTES=5210000000001/' \
    -e 's/^WHATSAPP_BIRRIA=.*/WHATSAPP_BIRRIA=5210000000002/' \
    "$DEPLOY_SRC/env.production.example"
} >"$BASE/.env"
chmod 600 "$BASE/.env"

docker network inspect traefik-public >/dev/null 2>&1 || {
  docker network create traefik-public >/dev/null
  CREATED_NETWORK=true
}

# S3 local y Healthchecks falso (registra cada petición en sus logs).
ACCESS_KEY=$(hex 16)
SECRET_KEY=$(hex 32)
HC_TOKEN=$(hex 16)
docker run -d --name bksmoke-s3 -p "127.0.0.1:$S3_PORT:7070" -e ACCESS_KEY="$ACCESS_KEY" -e SECRET_KEY="$SECRET_KEY" \
  --entrypoint sh "$S3_IMAGE" -c "mkdir -p /data/$BUCKET && exec versitygw --access \"\$ACCESS_KEY\" --secret \"\$SECRET_KEY\" --region auto posix /data" >/dev/null
docker run -d --name bksmoke-hc -p "127.0.0.1:$HC_PORT:8000" --entrypoint node "$APP_SRC" -e \
  "require('http').createServer((q,s)=>{console.log(q.method+' '+q.url);q.resume();q.on('end',()=>s.end('OK'))}).listen(8000)" >/dev/null

cat >"$ETC/backup.env" <<EOF
R2_ACCOUNT_ID=$(hex 16)
R2_BUCKET=$BUCKET
R2_ACCESS_KEY_ID=$ACCESS_KEY
R2_SECRET_ACCESS_KEY=$SECRET_KEY
HC_PING_URL=http://127.0.0.1:$HC_PORT/$HC_TOKEN
S3_ENDPOINT=http://127.0.0.1:$S3_PORT
EOF
chmod 640 "$ETC/backup.env"
age-keygen -o "$WORK/age.key" 2>/dev/null
IDENTITY=$(grep '^AGE-SECRET-KEY-1' "$WORK/age.key")
age-keygen -y "$WORK/age.key" >"$ETC/recipients.txt"
chmod 644 "$ETC/recipients.txt"

# Mismo cliente S3 que los scripts, para comprobar el bucket.
# shellcheck source=SCRIPTDIR/../lib.sh
. "$OPS_SRC/lib.sh"
load_config "$ETC/backup.env" required
objects() { s3_list "$1" | grep -c . || true; }
hc_requests() { docker logs bksmoke-hc 2>/dev/null; }
hc_count() { hc_requests | grep -c "^POST /$HC_TOKEN$1\$" || true; }

for _ in $(seq 1 30); do
  s3_list daily/ >/dev/null 2>&1 && break
  sleep 1
done

say 'producción simulada'
compose up -d --wait --wait-timeout 240 mysql
compose run --rm --no-deps migrate >/dev/null
compose up -d --no-deps --wait --wait-timeout 180 app
# Un usuario de prueba (la importación de productos ya creó los productos al arrancar la app).
# shellcheck disable=SC2016 # Comillas invertidas de SQL.
mysql_root "INSERT INTO user (username, username_key, display_name, role, password_hash, updated_at) VALUES ('smoke', 'smoke', 'Smoke', 'admin', 'scrypt\$x', NOW(3))"
USERS=$(mysql_root 'SELECT COUNT(*) FROM user')
PRODUCTS=$(mysql_root 'SELECT COUNT(*) FROM product')
check "hay datos de prueba (usuarios $USERS, productos $PRODUCTS)" test "$USERS" -ge 1 -a "$PRODUCTS" -ge 1
printf 'RESTAURANTE_APP_IMAGE=%s\nRESTAURANTE_MIGRATE_IMAGE=%s\nRESTAURANTE_COMMIT=%s\n' "$APP_SRC" "$MIGRATE_SRC" "$(printf '1%.0s' {1..40})" >"$BASE/state/release.env"
# Un JSON propio en app-data para comprobar que se restaura tal cual.
APP_ID=$(compose ps -q app)
docker exec "$APP_ID" sh -c 'mkdir -p /var/lib/restaurante/molotes /var/lib/restaurante/birria && printf "{\"smoke\":1}\n" > /var/lib/restaurante/birria/smoke.json && touch /var/lib/restaurante/molotes/.current.json.1.ab.tmp'
docker exec "$APP_ID" sh -c 'ls /var/lib/restaurante/molotes/*.json /var/lib/restaurante/birria/*.json' >/dev/null ||
  ko 'la app no escribió los JSON de app-data'

# --- Configuración inválida ----------------------------------------------------------------------
say 'configuración (CA-5)'
cp "$ETC/recipients.txt" "$WORK/recipients.ok"
printf '%s\n' "$IDENTITY" >>"$ETC/recipients.txt"
check 'una clave privada en recipients.txt -> 2' expect_exit 2 run bad-recipients "$OPS/backup.sh"
cp "$WORK/recipients.ok" "$ETC/recipients.txt"
chmod 644 "$ETC/backup.env"
check 'backup.env legible por todos -> 2' expect_exit 2 run bad-mode "$OPS/backup.sh"
chmod 640 "$ETC/backup.env"
check 'sin pings con la configuración inválida' test "$(hc_count '')" = 0

# --- Respaldo correcto (CA-1) --------------------------------------------------------------------
say 'respaldo correcto (CA-1, RF-6)'
# Ocho copias locales antiguas: tras el respaldo deben quedar 7 (RF-6).
mkdir -p -- "$BASE/offsite"
for i in 1 2 3 4 5 6 7 8; do install -m 600 /dev/null "$BASE/offsite/restaurante-2020010${i}T000000Z.tar.age"; done
# 2026-11-01 es domingo y día 1: daily, weekly y monthly.
check 'backup.sh termina con 0' run ok-1 BACKUP_TODAY=2026-11-01 "$OPS/backup.sh"
check 'un objeto en daily/' test "$(objects daily/)" = 1
check 'un objeto en weekly/' test "$(objects weekly/)" = 1
check 'un objeto en monthly/' test "$(objects monthly/)" = 1
check 'copia cifrada del .env en env/ (primera vez)' test "$(objects env/)" = 1
check 'ping de inicio y de éxito' test "$(hc_count /start)" = 1 -a "$(hc_count '')" = 1
check 'quedan 7 copias locales' test "$(find "$BASE/offsite" -maxdepth 1 -name 'restaurante-*.tar.age' | wc -l)" = 7
check 'las copias locales tienen permisos 600' test -z "$(find "$BASE/offsite" -maxdepth 1 -name 'restaurante-*.tar.age' ! -perm 600)"
check 'la carpeta local tiene permisos 700' test "$(stat -c %a "$BASE/offsite")" = 700
check 'ninguna clave privada en el VPS simulado' test -z "$(grep -rl 'AGE-SECRET-KEY-' "$BASE/offsite" "$BASE/state" "$BASE/.env" "$ETC" 2>/dev/null)"

KEY=$(s3_list daily/ | head -n 1)
s3_get "$KEY" "$WORK/latest.tar.age"
mkdir -p "$WORK/plain"
age -d -i "$WORK/age.key" -o "$WORK/plain/bundle.tar" "$WORK/latest.tar.age"
tar -C "$WORK/plain" -xf "$WORK/plain/bundle.tar"
check 'el paquete descifrado pasa la verificación de sumas' verify_parts "$WORK/plain"
check 'el manifiesto trae los conteos de producción' test "$(manifest_value "$WORK/plain/manifest.txt" users)" = "$USERS" -a "$(manifest_value "$WORK/plain/manifest.txt" products)" = "$PRODUCTS"
check 'el manifiesto trae la imagen de la app' test "$(manifest_value "$WORK/plain/manifest.txt" app_image)" = "$APP_SRC"
check 'el volcado está completo' sh -c "gzip -dc '$WORK/plain/dump.sql.gz' | tail -n 1 | grep -q '^-- Dump completed'"
check 'app-data incluye birria/smoke.json' sh -c "tar -tf '$WORK/plain/app-data.tar' | grep -q 'birria/smoke.json'"
check 'app-data excluye los temporales' sh -c "! tar -tf '$WORK/plain/app-data.tar' | grep -q '\\.tmp$'"
rm -rf -- "$WORK/plain" "$WORK/latest.tar.age"

say 'sin sobrescribir (CA-4, a nivel de cliente)'
printf 'otro contenido\n' >"$WORK/other"
check 'subir otro contenido a una clave existente -> 2 (412)' expect_exit 2 s3_put "$WORK/other" "$KEY"
s3_get "$KEY" "$WORK/same"
check 'volver a subir el mismo contenido se acepta (reintento)' s3_put "$WORK/same" "$KEY"
check 'el objeto no cambió' test "$(objects daily/)" = 1

say '.env (RF-9, CA-9)'
check 'sin cambios no sube' run env-same "$OPS/env-backup.sh"
check 'sigue habiendo 1 copia del .env' test "$(objects env/)" = 1
printf '# cambio de prueba\n' >>"$BASE/.env"
check 'con cambios sube' run env-changed "$OPS/env-backup.sh"
check 'hay 2 copias del .env' test "$(objects env/)" = 2
env_matches() { # alguna copia de env/ se descifra igual al .env actual
  local key
  for key in $(s3_list env/); do
    s3_get "$key" "$WORK/env.age" && age -d -i "$WORK/age.key" "$WORK/env.age" | cmp -s - "$BASE/.env" && return 0
  done
  return 1
}
check 'la copia nueva del .env se descifra igual al .env' env_matches

# --- Fallos (CA-2) -------------------------------------------------------------------------------
say 'fallos (CA-2)'
mysql_root "REVOKE SELECT ON restaurante.* FROM 'restaurante_backup'@'%'"
check 'volcado sin permisos -> 5' expect_exit 5 run dump-denied BACKUP_TODAY=2026-11-02 "$OPS/backup.sh"
mysql_root "GRANT SELECT ON restaurante.* TO 'restaurante_backup'@'%'"
check 'ping de fallo con el código 5' test "$(hc_count /5)" = 1
check 'no se subió nada nuevo' test "$(objects daily/)" = 1

# docker falso que corta la salida de mysqldump (volcado truncado con código 0).
cat >"$WORK/bin/docker" <<EOF
#!/usr/bin/env bash
case " \$* " in
  *" mysqldump "*) $(command -v docker) "\$@" | head -c 2000 ;;
  *) exec $(command -v docker) "\$@" ;;
esac
EOF
chmod 755 "$WORK/bin/docker"
check 'volcado truncado -> 6' expect_exit 6 run dump-truncated PATH="$WORK/bin:$PATH" BACKUP_TODAY=2026-11-02 "$OPS/backup.sh"
check 'ping de fallo con el código 6' test "$(hc_count /6)" = 1
check 'no se subió nada nuevo' test "$(objects daily/)" = 1

exec 7>>"$BASE/state/deploy.lock"
flock 7
check 'candado de deploy.sh ocupado -> 4' expect_exit 4 run locked BACKUP_LOCK_TIMEOUT=2 BACKUP_TODAY=2026-11-02 "$OPS/backup.sh"
flock -u 7
exec 7>&-

say 'subida fallida y reintento (caso límite)'
docker stop bksmoke-s3 >/dev/null
sleep 1
check 'R2 caído -> 8' expect_exit 8 run s3-down BACKUP_TODAY=2026-11-02 "$OPS/backup.sh"
check 'la copia queda pendiente en local' test "$(find "$BASE/offsite" -maxdepth 1 -name '*.pending' | wc -l)" = 1
docker start bksmoke-s3 >/dev/null
for _ in $(seq 1 30); do
  s3_list daily/ >/dev/null 2>&1 && break
  sleep 1
done
sleep 1
check 'la siguiente ejecución sube la pendiente y la nueva' run ok-2 BACKUP_TODAY=2026-11-03 "$OPS/backup.sh"
check 'tres objetos en daily/' test "$(objects daily/)" = 3
check 'sin pendientes' test "$(find "$BASE/offsite" -maxdepth 1 -name '*.pending' | wc -l)" = 0
check 'quedan 7 copias locales' test "$(find "$BASE/offsite" -maxdepth 1 -name 'restaurante-*.tar.age' | wc -l)" = 7

say 'ningún secreto en la salida'
SECRETS=("$SECRET_KEY" "$HC_TOKEN" "$IDENTITY")
while IFS= read -r line; do SECRETS+=("${line#*=}"); done < <(grep -E '^(MYSQL_ROOT_PASSWORD|RESTAURANTE_DB_[A-Z]+_PASSWORD)=' "$BASE/.env")
leaks=0
for secret in "${SECRETS[@]}"; do
  if grep -rqF -- "$secret" "$WORK/logs"; then leaks=1; fi
done
check 'los logs no contienen credenciales, la URL de ping ni contraseñas' test "$leaks" = 0

# --- Restauración (RF-10) ------------------------------------------------------------------------
say 'restauración en "producción" (RF-10)'
LATEST=$(s3_list daily/ | sort | tail -n 1)
s3_get "$LATEST" "$WORK/for-restore.tar.age"
mkdir -p "$WORK/plain"
age -d -i "$WORK/age.key" -o "$WORK/plain/bundle.tar" "$WORK/for-restore.tar.age"
tar -C "$WORK/plain" -xf "$WORK/plain/bundle.tar" manifest.txt
EXPECTED_USERS=$(manifest_value "$WORK/plain/manifest.txt" users)
rm -rf -- "$WORK/plain" "$WORK/for-restore.tar.age"
# Daños posteriores al respaldo: un usuario más y un JSON cambiado.
mysql_root "INSERT INTO user (username, username_key, display_name, role, password_hash, updated_at) VALUES ('tarde', 'tarde', 'Tarde', 'editor', 'scrypt\$x', NOW(3))"
docker exec "$(compose ps -q app)" sh -c 'printf "{\"smoke\":2}\n" > /var/lib/restaurante/birria/smoke.json'
check 'sin --confirm y sin terminal -> 2' expect_exit 2 run restore-noconfirm sh -c "printf '%s\n' '$IDENTITY' | '$OPS/restore.sh' latest"
check 'clave privada equivocada -> 6' expect_exit 6 run restore-badkey sh -c "printf '%s\n' '$(age-keygen 2>/dev/null | grep '^AGE-SECRET')' | '$OPS/restore.sh' latest --confirm restaurante"
check 'restore.sh latest termina con 0' run restore sh -c "printf '%s\n' '$IDENTITY' | '$OPS/restore.sh' latest --confirm restaurante"
check 'los usuarios vuelven a los del respaldo' test "$(mysql_root 'SELECT COUNT(*) FROM user')" = "$EXPECTED_USERS"
check 'app-data vuelve al del respaldo' test "$(docker exec "$(compose ps -q app)" cat /var/lib/restaurante/birria/smoke.json)" = '{"smoke":1}'
check 'la app está healthy' test "$(docker inspect -f '{{.State.Health.Status}}' "$(compose ps -q app)")" = healthy
check 'release.env apunta a la imagen del respaldo' grep -qx "RESTAURANTE_APP_IMAGE=$APP_SRC" "$BASE/state/release.env"
check 'releases.log registra la restauración' grep -q 'result=restored' "$BASE/state/releases.log"

# --- Prueba mensual y simulacro (RF-11, CA-7, CA-8) ----------------------------------------------
say 'prueba mensual con --drill (RF-11)'
install -m 600 "$ETC/backup.env" "$WORK/r2-readonly.conf"
check 'verify-backup.sh --drill termina con 0' run verify RESTAURANTE_BACKUP_CONFIG="$WORK/r2-readonly.conf" RESTAURANTE_BACKUP_LOG="$WORK/pruebas.log" sh -c "printf '%s\n' '$IDENTITY' | '$OPS_SRC/verify-backup.sh' --drill"
check 'el resultado queda registrado' grep -q 'resultado=ok' "$WORK/pruebas.log"
check 'sin contenedores ni redes del simulacro' test -z "$(docker ps -aq --filter name=restaurante-verify-)"
check 'los logs de la prueba no contienen la clave privada' sh -c "! grep -qF -- '$IDENTITY' '$WORK/logs/verify.log'"

say 'resultado'
if ((FAILURES > 0)); then
  printf '%s comprobaciones fallaron\n' "$FAILURES" >&2
  exit 1
fi
printf 'todas las comprobaciones pasaron\n'
