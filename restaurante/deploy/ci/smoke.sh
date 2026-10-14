#!/usr/bin/env bash
# Prueba de humo del despliegue de producción (REQ-F-016, job `despliegue` del CI). Ejecuta
# deploy/deploy.sh tal como lo hace el VPS (con SSH_ORIGINAL_COMMAND), contra un registro local, un
# Traefik v3 fijado por digest y el compose de producción. Nunca toca GHCR ni el VPS.
#
#   deploy/ci/smoke.sh <imagen production> <imagen migrate>
#
# Requiere Docker con compose, bash, curl, jq, gzip, flock, sha256sum y GNU find/stat (Linux).
# SMOKE_WORKDIR: carpeta de trabajo (por defecto, una temporal). Si Docker corre en otra máquina
# (p. ej. Docker Desktop), debe ser una ruta que el daemon vea igual (los bind mounts los resuelve él).
set -euo pipefail

APP_SRC=${1:?uso: smoke.sh <imagen production> <imagen migrate>}
MIGRATE_SRC=${2:?uso: smoke.sh <imagen production> <imagen migrate>}

DEPLOY_SRC=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)
WORK=${SMOKE_WORKDIR:-$(mktemp -d)}
mkdir -p -- "$WORK"
WORK=$(cd -- "$WORK" && pwd -P)
BASE="$WORK/opt/restaurante"
PROJECT=restaurante-smoke
DOMAIN=birriaelmuneco.com
REGISTRY_PORT=5000
REGISTRY="localhost:$REGISTRY_PORT/orvigas"
TRAEFIK_IMAGE=traefik:v3.7.14@sha256:575fa15b135078fe5e50aa847987d96dbddd7b093c172429618404df73f3fa7c
REGISTRY_IMAGE=registry:3@sha256:ddf754342cfc8acc51a56d5d0ab6af06826461864460636d8bd5c546dab2a7b8
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

compose() {
  RESTAURANTE_APP_IMAGE=unused RESTAURANTE_MIGRATE_IMAGE=unused \
    docker compose -f "$BASE/deploy/compose.prod.yaml" --env-file "$BASE/.env" "$@"
}

cleanup() {
  local status=$?
  if ((status != 0 || FAILURES > 0)); then
    say 'diagnóstico'
    compose ps -a 2>/dev/null || true
    docker logs --tail 80 "$(compose ps -aq app 2>/dev/null | head -n 1)" 2>&1 | sed 's/^/  app: /' || true
    docker logs --tail 40 smoke-traefik 2>&1 | sed 's/^/  traefik: /' || true
  fi
  compose --profile migrate down -v --remove-orphans >/dev/null 2>&1 || true
  docker rm -f smoke-traefik smoke-registry >/dev/null 2>&1 || true
  if [[ "$CREATED_NETWORK" == true ]]; then docker network rm traefik-public >/dev/null 2>&1 || true; fi
  if [[ -z "${SMOKE_WORKDIR:-}" ]]; then rm -rf -- "$WORK"; else rm -rf -- "$BASE"; fi
  exit "$status"
}
trap cleanup EXIT

hex() { od -An -N32 -tx1 /dev/urandom | tr -d ' \n'; }
# SHA ficticio que empieza por el número (los volcados se nombran con los 12 primeros caracteres).
fake_sha() { printf '%s%0*d' "$1" $((40 - ${#1})) 0; }
deploy_sum() { (cd -- "$BASE/deploy" && sha256sum -- compose.prod.yaml deploy.sh mysql/initdb/01-usuarios.sh | sha256sum | cut -c1-64); }

# Ejecuta deploy.sh como el comando forzado de SSH; deja la salida en $WORK/deploy-<n>.log.
run_deploy() { # run_deploy <n sha> <digest app> <digest migrate> [suma]
  local sum=${4:-$(deploy_sum)} status=0
  SSH_ORIGINAL_COMMAND="deploy $(fake_sha "$1") $2 $3 $sum" "$BASE/deploy/deploy.sh" >"$WORK/deploy-$1.log" 2>&1 || status=$?
  sed 's/^/  | /' "$WORK/deploy-$1.log"
  return "$status"
}
expect_exit() { # expect_exit <código> <función...>
  local expected=$1 status=0
  shift
  "$@" || status=$?
  [[ "$status" == "$expected" ]] || {
    printf '  (código %s, se esperaba %s)\n' "$status" "$expected" >&2
    return 1
  }
}

push() { # push <imagen local> <repositorio> <etiqueta> -> imprime el digest
  local ref="$REGISTRY/$2:$3"
  docker tag "$1" "$ref"
  docker push --quiet "$ref" >/dev/null
  docker inspect -f '{{range .RepoDigests}}{{println .}}{{end}}' "$ref" | grep "^$REGISTRY/$2@" | head -n 1 | cut -d@ -f2
}
derive() { # derive <etiqueta nueva> <Dockerfile en stdin> [contexto]
  docker build --quiet -t "$1" -f - "${2:-$WORK/empty}" >/dev/null
}

app_id() { compose ps -q app; }
app_image() { docker inspect -f '{{.Config.Image}}' "$(app_id)"; }
https_status() { curl -sk -o /dev/null -w '%{http_code}' --max-time 10 --resolve "$1:443:$TRAEFIK_IP" "https://$1$2"; }
redirect_of() { # redirect_of <esquema> <host> <ruta> -> "código destino"
  local port=80
  [[ "$1" == https ]] && port=443
  curl -sk -o /dev/null -w '%{http_code} %{redirect_url}' --max-time 10 --resolve "$2:$port:$TRAEFIK_IP" "$1://$2$3"
}

# --- Comprobaciones estáticas del compose (CA-3) ------------------------------------------------
say 'preparación'
mkdir -p -- "$BASE/deploy/mysql/initdb" "$WORK/empty"
install -m 755 "$DEPLOY_SRC/deploy.sh" "$BASE/deploy/deploy.sh"
install -m 644 "$DEPLOY_SRC/compose.prod.yaml" "$BASE/deploy/compose.prod.yaml"
install -m 755 "$DEPLOY_SRC/mysql/initdb/01-usuarios.sh" "$BASE/deploy/mysql/initdb/01-usuarios.sh"

docker network inspect traefik-public >/dev/null 2>&1 || {
  docker network create traefik-public >/dev/null
  CREATED_NETWORK=true
}
docker run -d --name smoke-registry -p "127.0.0.1:$REGISTRY_PORT:5000" "$REGISTRY_IMAGE" >/dev/null
docker run -d --name smoke-traefik --network traefik-public \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  "$TRAEFIK_IMAGE" \
  --entrypoints.web.address=:80 \
  --entrypoints.websecure.address=:443 \
  --providers.docker=true \
  --providers.docker.exposedbydefault=false \
  --providers.docker.network=traefik-public \
  "--providers.docker.constraints=Label(\`com.docker.compose.project\`,\`$PROJECT\`)" \
  --certificatesresolvers.letsencrypt.acme.storage=/tmp/acme.json \
  --certificatesresolvers.letsencrypt.acme.caserver=https://127.0.0.1:1/directory \
  --certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web >/dev/null
TRAEFIK_IP=$(docker inspect -f '{{(index .NetworkSettings.Networks "traefik-public").IPAddress}}' smoke-traefik)

# El .env de la prueba sale de la plantilla (comprueba que la plantilla esté completa).
{
  sed -e "s/^MYSQL_ROOT_PASSWORD=.*/MYSQL_ROOT_PASSWORD=$(hex)/" \
    -e "s/^RESTAURANTE_DB_APP_PASSWORD=.*/RESTAURANTE_DB_APP_PASSWORD=$(hex)/" \
    -e "s/^RESTAURANTE_DB_MIGRATOR_PASSWORD=.*/RESTAURANTE_DB_MIGRATOR_PASSWORD=$(hex)/" \
    -e "s/^RESTAURANTE_DB_BACKUP_PASSWORD=.*/RESTAURANTE_DB_BACKUP_PASSWORD=$(hex)/" \
    -e "s|^RESTAURANTE_REGISTRY=.*|RESTAURANTE_REGISTRY=$REGISTRY|" \
    -e "s/^RESTAURANTE_PROBE_ADDRESS=.*/RESTAURANTE_PROBE_ADDRESS=$TRAEFIK_IP/" \
    -e 's/^WHATSAPP_MOLOTES=.*/WHATSAPP_MOLOTES=5210000000001/' \
    -e 's/^WHATSAPP_BIRRIA=.*/WHATSAPP_BIRRIA=5210000000002/' \
    "$DEPLOY_SRC/env.production.example"
  printf 'COMPOSE_PROJECT_NAME=%s\n' "$PROJECT"
} >"$BASE/.env"
chmod 600 "$BASE/.env"

say 'compose de producción (CA-3)'
check 'docker compose config es válido' compose config -q
CONFIG=$(compose config --format json)
check 'el proyecto se llama como COMPOSE_PROJECT_NAME' test "$(jq -r .name <<<"$CONFIG")" = "$PROJECT"
check 'ningún servicio publica puertos' test "$(jq '[.services[] | select((.ports // []) | length > 0)] | length' <<<"$CONFIG")" = 0
check 'mysql solo está en la red interna' test "$(jq -c '.services.mysql.networks | keys' <<<"$CONFIG")" = '["db"]'
check 'la red db es interna' test "$(jq '.networks.db.internal' <<<"$CONFIG")" = true
check 'la app recibe NODE_ENV, HOST y TRUST_PROXY fijados' test "$(jq -c '.services.app.environment | [.NODE_ENV, .HOST, .TRUST_PROXY]' <<<"$CONFIG")" = '["production","0.0.0.0","true"]'
check 'la app no recibe la contraseña root de MySQL' test "$(jq '.services.app.environment | has("MYSQL_ROOT_PASSWORD")' <<<"$CONFIG")" = false

say 'imágenes en el registro local'
derive smoke/app-v2 <<<"FROM $APP_SRC
LABEL smoke.version=2"
derive smoke/app-bad <<<"FROM $APP_SRC
CMD [\"node\", \"-e\", \"process.exit(1)\"]"
derive smoke/migrate-bad <<<"FROM $MIGRATE_SRC
ENTRYPOINT [\"false\"]"
mkdir -p "$WORK/newer/29990101000000_smoke_compatible"
# shellcheck disable=SC2016 # Comillas invertidas de SQL, no de shell.
printf '%s\n' 'CREATE TABLE `smoke_extra` (`id` INTEGER NOT NULL, PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;' \
  >"$WORK/newer/29990101000000_smoke_compatible/migration.sql"
derive smoke/migrate-newer "$WORK/newer" <<<"FROM $MIGRATE_SRC
COPY 29990101000000_smoke_compatible /app/prisma/migrations/29990101000000_smoke_compatible"
APP1=$(push "$APP_SRC" restaurante v1)
APP2=$(push smoke/app-v2 restaurante v2)
APP_BAD=$(push smoke/app-bad restaurante bad)
MIG=$(push "$MIGRATE_SRC" restaurante-migrate v1)
MIG_BAD=$(push smoke/migrate-bad restaurante-migrate bad)
MIG_NEWER=$(push smoke/migrate-newer restaurante-migrate newer)
ok "app v1 $APP1"

# --- Rechazos antes de tocar nada ---------------------------------------------------------------
say 'argumentos y precondiciones'
check 'comando SSH con caracteres de shell -> 2' expect_exit 2 env SSH_ORIGINAL_COMMAND="deploy x; rm -rf /" "$BASE/deploy/deploy.sh"
check 'subcomando desconocido -> 2' expect_exit 2 env SSH_ORIGINAL_COMMAND="status" "$BASE/deploy/deploy.sh"
check 'digest mal formado -> 2' expect_exit 2 run_deploy 1 sha256:abc "$MIG"
check 'suma de deploy/ distinta -> 4' expect_exit 4 run_deploy 1 "$APP1" "$MIG" "$(printf '%064d' 0)"
chmod 644 "$BASE/.env"
check '.env sin permisos 600 -> 3' expect_exit 3 run_deploy 1 "$APP1" "$MIG"
chmod 600 "$BASE/.env"
cp "$BASE/.env" "$WORK/env.backup"
echo 'DATABASE_ALLOW_NEWER_SCHEMA=true' >>"$BASE/.env"
check 'DATABASE_ALLOW_NEWER_SCHEMA en .env -> 3' expect_exit 3 run_deploy 1 "$APP1" "$MIG"
cp "$WORK/env.backup" "$BASE/.env" && chmod 600 "$BASE/.env"
check 'ningún rechazo creó contenedores' test -z "$(compose ps -aq)"

# --- Primer despliegue (CA-1 en local) ----------------------------------------------------------
say 'primer despliegue'
check 'deploy v1 termina con 0' run_deploy 1 "$APP1" "$MIG"
check 'https raíz responde 200' test "$(https_status "$DOMAIN" /)" = 200
check 'release.env registra la app v1' grep -q "^RESTAURANTE_APP_IMAGE=$REGISTRY/restaurante@$APP1\$" "$BASE/state/release.env"
check 'releases.log registra el despliegue' grep -q 'result=ok' "$BASE/state/releases.log"
check 'el volcado existe con permisos 600' test "$(stat -c '%a' "$BASE"/backups/*.sql.gz)" = 600

say 'redirecciones (CA-2)'
for url in 'http birriaelmuneco.com' 'http www.birriaelmuneco.com' 'https www.birriaelmuneco.com'; do
  read -r scheme host <<<"$url"
  check "$scheme://$host -> 301 conservando ruta y query" test "$(redirect_of "$scheme" "$host" '/molotes?a=1&b=2')" = "301 https://$DOMAIN/molotes?a=1&b=2"
done

say 'límite de peticiones en /admin (CA-4)'
codes=''
for _ in $(seq 1 30); do codes+="$(https_status "$DOMAIN" /admin/login) "; done
check "/admin recibe 429 tras la ráfaga ($(tr ' ' '\n' <<<"$codes" | grep . | sort | uniq -c | awk '{printf "%s x %s; ", $1, $2}'))" grep -q 429 <<<"$codes"
check 'las primeras 20 peticiones no reciben 429' bash -c "! cut -d' ' -f1-20 <<<'$codes' | grep -q 429"
check 'las landings no se ven afectadas' test "$(https_status "$DOMAIN" /molotes)" = 200

say 'IP del cliente y esquema en el log (CA-5)'
LINE=$(docker logs "$(app_id)" 2>/dev/null | grep '"msg":"request"' | grep '"path":"/molotes"' | tail -n 1)
check 'el log de la petición lleva protocol https' grep -q '"protocol":"https"' <<<"$LINE"
CLIENT_IP=$(jq -r '.ip // empty' <<<"$LINE")
check "la IP registrada ($CLIENT_IP) es la del cliente, no la de Traefik ($TRAEFIK_IP)" test -n "$CLIENT_IP" -a "$CLIENT_IP" != "$TRAEFIK_IP"

# --- Segundo despliegue y retención (CA-7) ------------------------------------------------------
say 'segundo despliegue y retención de volcados'
for i in 1 2 3 4 5 6 7 8; do
  : >"$BASE/backups/20000101T00000${i}Z-viejo.sql.gz"
  touch -d "2000-01-0$i" "$BASE/backups/20000101T00000${i}Z-viejo.sql.gz"
done
check 'deploy v2 termina con 0' run_deploy 2 "$APP2" "$MIG"
check 'quedan 7 volcados' test "$(find "$BASE/backups" -name '*.sql.gz' | wc -l)" = 7
check 'el volcado nuevo se conserva' test -n "$(find "$BASE/backups" -name "*-$(fake_sha 2 | cut -c1-12).sql.gz")"
check 'la app usa v2' test "$(app_image)" = "$REGISTRY/restaurante@$APP2"

say 'migración que falla (CA-7)'
BEFORE=$(app_id)
check 'deploy con migrate roto -> 13' expect_exit 13 run_deploy 3 "$APP1" "$MIG_BAD"
check 'la app en marcha no se tocó' test "$(app_id)" = "$BEFORE"
check 'el sitio sigue en 200' test "$(https_status "$DOMAIN" /)" = 200
check 'el volcado previo existe' test -n "$(find "$BASE/backups" -name "*-$(fake_sha 3 | cut -c1-12).sql.gz")"

say 'imagen que no pasa la salud (CA-8)'
check 'deploy con app rota -> 21 (vuelta atrás)' expect_exit 21 run_deploy 4 "$APP_BAD" "$MIG"
check 'la app volvió al digest anterior (v2)' test "$(app_image)" = "$REGISTRY/restaurante@$APP2"
check 'el sitio sigue en 200' test "$(https_status "$DOMAIN" /)" = 200
check 'release.env sigue en v2' grep -q "@$APP2\$" "$BASE/state/release.env"

say 'dos despliegues a la vez (CA-9)'
run_deploy 5 "$APP2" "$MIG" >/dev/null & first=$!
sleep 1
second=0
run_deploy 6 "$APP2" "$MIG" >/dev/null || second=$?
wait "$first" && first=0 || first=$?
check 'los dos terminan con 0' test "$first:$second" = 0:0
check 'uno esperó al otro (flock)' grep -q deploy_waiting_lock "$WORK/deploy-5.log" "$WORK/deploy-6.log"

say 'vuelta atrás tras una migración nueva (D-1)'
check 'deploy con migración nueva y app rota -> 21' expect_exit 21 run_deploy 7 "$APP_BAD" "$MIG_NEWER"
check 'la app anterior arranca con la base más nueva' test "$(https_status "$DOMAIN" /)" = 200
check 'y lo registra (database_newer_than_code_allowed)' bash -c "docker logs '$(app_id)' 2>&1 | grep -q database_newer_than_code_allowed"

say 'resultado'
if ((FAILURES > 0)); then
  echo "$FAILURES comprobaciones fallaron" >&2
  exit 1
fi
echo 'todas las comprobaciones pasaron'
