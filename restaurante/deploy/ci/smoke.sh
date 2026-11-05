#!/usr/bin/env bash
# Prueba de humo del despliegue de producción (REQ-F-016, job `docker` del CI). Ejecuta
# deploy/deploy.sh tal como lo hace el VPS (con SSH_ORIGINAL_COMMAND), contra un registro local, un
# Traefik v3 fijado por digest y el compose de producción. Nunca toca GHCR ni el VPS.
#
#   deploy/ci/smoke.sh <imagen production> <imagen migrate> <imagen api> <imagen inventory-manager>
#
# Requiere Docker con compose, bash, curl, jq, gzip, flock, sha256sum y GNU find/stat (Linux).
# SMOKE_WORKDIR: carpeta de trabajo (por defecto, una temporal). Si Docker corre en otra máquina
# (p. ej. Docker Desktop), debe ser una ruta que el daemon vea igual (los bind mounts los resuelve él).
set -euo pipefail

USAGE='uso: smoke.sh <imagen production> <imagen migrate> <imagen api> <imagen inventory-manager>'
APP_SRC=${1:?$USAGE}
MIGRATE_SRC=${2:?$USAGE}
API_SRC=${3:?$USAGE}
INVENTORY_SRC=${4:?$USAGE}

DEPLOY_SRC=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)
WORK=${SMOKE_WORKDIR:-$(mktemp -d)}
mkdir -p -- "$WORK"
WORK=$(cd -- "$WORK" && pwd -P)
BASE="$WORK/opt/restaurante"
PROJECT=restaurante-smoke
DOMAIN=birriaelmuneco.com
ADMIN_DOMAIN=admin.birriaelmuneco.com
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
  RESTAURANTE_APP_IMAGE=unused RESTAURANTE_MIGRATE_IMAGE=unused RESTAURANTE_API_IMAGE=unused RESTAURANTE_INVENTORY_IMAGE=unused \
    docker compose -f "$BASE/deploy/compose.prod.yaml" --env-file "$BASE/.env" "$@"
}

cleanup() {
  local status=$?
  if ((status != 0 || FAILURES > 0)); then
    say 'diagnóstico'
    compose ps -a 2>/dev/null || true
    docker logs --tail 80 "$(compose ps -aq app 2>/dev/null | head -n 1)" 2>&1 | sed 's/^/  app: /' || true
    docker logs --tail 40 "$(compose ps -aq api 2>/dev/null | head -n 1)" 2>&1 | sed 's/^/  api: /' || true
    docker logs --tail 40 "$(compose ps -aq inventory-manager 2>/dev/null | head -n 1)" 2>&1 | sed 's/^/  inventory-manager: /' || true
    docker logs --tail 40 smoke-traefik 2>&1 | sed 's/^/  traefik: /' || true
  fi
  compose --profile migrate down -v --remove-orphans >/dev/null 2>&1 || true
  docker rm -f smoke-traefik smoke-registry smoke-vecino >/dev/null 2>&1 || true
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
run_deploy() { # run_deploy <n sha> <digest app> <digest migrate> <digest api> <digest inventory> [suma]
  local sum=${6:-$(deploy_sum)} status=0
  SSH_ORIGINAL_COMMAND="deploy $(fake_sha "$1") $2 $3 $4 $5 $sum" "$BASE/deploy/deploy.sh" >"$WORK/deploy-$1.log" 2>&1 || status=$?
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

# Cabeceras de la respuesta por Traefik. La CSP la pone la app (helmet), nunca la api: dice quién responde.
https_headers() { curl -sk -o /dev/null -D - --max-time 10 --resolve "$1:443:$TRAEFIK_IP" -X "${3:-GET}" "https://$1$2" | tr -d '\r'; }
served_by_app() { # served_by_app <ruta>
  local headers
  headers=$(https_headers "$DOMAIN" "$1")
  grep -qi '^content-security-policy:' <<<"$headers"
}
webhook_on_api() { # La ruta del webhook llega a la api: 503 BOT_DISABLED (sin bot en la prueba) y sin CSP.
  local body
  body=$(curl -sk --max-time 10 --resolve "$DOMAIN:443:$TRAEFIK_IP" "https://$DOMAIN/webhooks/whatsapp")
  grep -q BOT_DISABLED <<<"$body" && ! served_by_app /webhooks/whatsapp
}
webhook_on_app() { # Con una api sin webhook, la ruta vuelve al router raíz (aquí la app actual, sin bot: 404).
  test "$(https_status "$DOMAIN" /webhooks/whatsapp)" = 404 && served_by_app /webhooks/whatsapp
}
# El procedimiento de docs/despliegue.md, "Arrancar la api a mano": el router sigue a la imagen.
manual_api() { # manual_api <imagen>
  local webhook
  webhook=$(docker image inspect -f '{{index .Config.Labels "org.restaurante.webhook"}}' "$1" | grep -q whatsapp && echo true || echo false)
  RESTAURANTE_API_IMAGE="$1" RESTAURANTE_API_WEBHOOK="$webhook" \
    docker compose -f "$BASE/deploy/compose.prod.yaml" --env-file "$BASE/.env" --env-file "$BASE/state/release.env" up -d --no-deps api 2>/dev/null
}
wait_for() { # wait_for <función...>: Traefik tarda un instante en aplicar un cambio de router.
  local deadline=$((SECONDS + 30))
  until "$@"; do
    ((SECONDS < deadline)) || return 1
    sleep 2
  done
}

app_id() { compose ps -q app; }
app_image() { docker inspect -f '{{.Config.Image}}' "$(app_id)"; }
api_id() { compose ps -q api; }
api_image() { docker inspect -f '{{.Config.Image}}' "$(api_id)"; }
api_traefik_enable() { docker inspect -f '{{index .Config.Labels "traefik.enable"}}' "$(api_id)"; }
inventory_id() { compose ps -q inventory-manager; }
inventory_image() { docker inspect -f '{{.Config.Image}}' "$(inventory_id)"; }
wait_container_healthy() { # wait_container_healthy <id>
  local deadline=$((SECONDS + 120))
  while ((SECONDS < deadline)); do
    [[ "$(docker inspect -f '{{.State.Health.Status}}' "$1")" == healthy ]] && return 0
    sleep 2
  done
  return 1
}
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
    -e "s/^RESTAURANTE_INTERNAL_NOTIFY_TOKEN=.*/RESTAURANTE_INTERNAL_NOTIFY_TOKEN=$(hex)/" \
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
# REQ-F-038 (CA-8): la API solo en la red interna, sin puertos ni router de Traefik.
# REQ-F-039: la api también en la red interna admin (para inventory-manager).
# REQ-F-042: y en traefik, por la salida a Meta y la entrada del webhook.
check 'la api está en db, admin y traefik' test "$(jq -c '.services.api.networks | keys' <<<"$CONFIG")" = '["admin","db","traefik"]'
check 'la red admin es interna' test "$(jq '.networks.admin.internal' <<<"$CONFIG")" = true
check 'inventory-manager solo está en admin y traefik (no alcanza MySQL)' test "$(jq -c '.services["inventory-manager"].networks | keys' <<<"$CONFIG")" = '["admin","traefik"]'
check 'inventory-manager no recibe credenciales de la base ni la del aviso' test "$(jq '.services["inventory-manager"].environment | (has("DATABASE_URL") or has("MYSQL_ROOT_PASSWORD") or has("INTERNAL_NOTIFY_TOKEN"))' <<<"$CONFIG")" = false
check 'inventory-manager llega a la api por la red interna' test "$(jq -r '.services["inventory-manager"].environment.API_INTERNAL_URL' <<<"$CONFIG")" = 'http://api:3001'
check 'la app enlaza al admin nuevo (modo de solo lectura de productos)' test "$(jq -r '.services.app.environment.ADMIN_NEW_URL' <<<"$CONFIG")" = "https://$ADMIN_DOMAIN"
# DEF-004 (REQ-F-042): la api está en traefik-public; sus nombres no pueden ser los de un vecino.
check 'la api avisa a la app por su nombre de contenedor' test "$(jq -r '.services.api.environment.LANDING_INTERNAL_URL' <<<"$CONFIG")" = "http://$PROJECT-app-1:3002"
check 'la api llega a MySQL por su nombre de contenedor' test "$(jq --arg host "@$PROJECT-mysql-1:3306/" '.services.api.environment.DATABASE_URL | contains($host)' <<<"$CONFIG")" = true
check 'la app y la api comparten la credencial del aviso' test "$(jq -r '.services.app.environment.INTERNAL_NOTIFY_TOKEN == .services.api.environment.INTERNAL_NOTIFY_TOKEN and (.services.app.environment.INTERNAL_NOTIFY_TOKEN | length) >= 32' <<<"$CONFIG")" = true
check 'ningún router de Traefik apunta al puerto interno 3002' bash -c "! jq -r '[.services[] | .labels // {} | to_entries[] | .value] | .[]' <<<'$CONFIG' | grep -q 3002"
check 'el subdominio tiene su límite: 60 por minuto y ráfaga de 60' test "$(jq -c '.services["inventory-manager"].labels | [.["traefik.http.middlewares.restaurante-inventory-ratelimit.ratelimit.average"], .["traefik.http.middlewares.restaurante-inventory-ratelimit.ratelimit.period"], .["traefik.http.middlewares.restaurante-inventory-ratelimit.ratelimit.burst"]]' <<<"$CONFIG")" = '["60","1m","60"]'
check 'ningún router de Traefik apunta al puerto interno de la api (3001)' bash -c "! jq -r '[.services[] | .labels // {} | to_entries[] | .value] | .[]' <<<'$CONFIG' | grep -q 3001"
# REQ-F-042 (CA-3): el único router de la api es el del webhook, con la ruta exacta y su puerto propio.
API_ROUTERS=$(jq -c '[.services.api.labels | keys[] | select(startswith("traefik.http.routers.")) | split(".")[3]] | unique' <<<"$CONFIG")
check "la api solo tiene el router restaurante-webhook ($API_ROUTERS)" test "$API_ROUTERS" = '["restaurante-webhook"]'
check 'el router del webhook es la ruta exacta en el dominio raíz' test "$(jq -r '.services.api.labels["traefik.http.routers.restaurante-webhook.rule"]' <<<"$CONFIG")" = "Host(\`$DOMAIN\`) && Path(\`/webhooks/whatsapp\`)"
check 'el router del webhook está por encima de los de la app' test "$(jq -r '.services.api.labels["traefik.http.routers.restaurante-webhook.priority"]' <<<"$CONFIG")" = 200
check 'el servicio del webhook usa el puerto 3004' test "$(jq -r '.services.api.labels["traefik.http.services.restaurante-webhook.loadbalancer.server.port"]' <<<"$CONFIG")" = 3004
check 'la api escucha el webhook en el 3004' test "$(jq -r '.services.api.environment.WEBHOOK_PORT' <<<"$CONFIG")" = 3004
check 'fuera de deploy.sh, el router del webhook queda apagado' test "$(jq -r '.services.api.labels["traefik.enable"]' <<<"$CONFIG")" = false
check 'con una api con webhook, se enciende' test "$(RESTAURANTE_API_WEBHOOK=true compose config --format json | jq -r '.services.api.labels["traefik.enable"]')" = true
BOT_VARS='[.environment | to_entries[] | select(.key | test("^(WHATSAPP_BOT_|WHATSAPP_GRAPH_|BOT_|WHATSAPP_MOLOTES$|WHATSAPP_BIRRIA$)"))] | sort_by(.key)'
check 'la api y la app reciben las mismas variables del bot (RN-5, P-2)' test "$(jq -c ".services.api | $BOT_VARS" <<<"$CONFIG")" = "$(jq -c ".services.app | $BOT_VARS" <<<"$CONFIG")"
check 'la api recibe los secretos del bot' test "$(jq '.services.api.environment | has("WHATSAPP_BOT_ACCESS_TOKEN") and has("WHATSAPP_BOT_APP_SECRET") and has("WHATSAPP_BOT_VERIFY_TOKEN") and has("WHATSAPP_BOT_BLOCKLIST_KEY")' <<<"$CONFIG")" = true
check 'la api no publica puertos' test "$(jq '.services.api.ports // [] | length' <<<"$CONFIG")" = 0
check 'la api no recibe la contraseña root de MySQL' test "$(jq '.services.api.environment | has("MYSQL_ROOT_PASSWORD")' <<<"$CONFIG")" = false
check 'la app llega a la api por la red interna' test "$(jq -r '.services.app.environment.API_INTERNAL_URL' <<<"$CONFIG")" = 'http://api:3001'
check 'los routers de Traefik son solo de la app, de inventory-manager y del webhook' test "$(jq '[.services | to_entries[] | select(.key != "app" and .key != "inventory-manager" and .key != "api") | .value.labels // {} | keys[] | select(startswith("traefik."))] | length' <<<"$CONFIG")" = 0

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
# Destino relativo al WORKDIR de la imagen migrate (/app/landing-pages desde el monorepo, REQ-F-036;
# /app antes): ahí lee prisma.config.ts sus migraciones.
derive smoke/migrate-newer "$WORK/newer" <<<"FROM $MIGRATE_SRC
COPY 29990101000000_smoke_compatible prisma/migrations/29990101000000_smoke_compatible"
APP1=$(push "$APP_SRC" restaurante v1)
APP2=$(push smoke/app-v2 restaurante v2)
APP_BAD=$(push smoke/app-bad restaurante bad)
MIG=$(push "$MIGRATE_SRC" restaurante-migrate v1)
MIG_BAD=$(push smoke/migrate-bad restaurante-migrate bad)
MIG_NEWER=$(push smoke/migrate-newer restaurante-migrate newer)
derive smoke/api-bad <<<"FROM $API_SRC
CMD [\"node\", \"-e\", \"process.exit(1)\"]"
# La api de un despliegue conoce las migraciones de su commit: la de la prueba D-1 lleva también la
# migración nueva (verify.ts las lee en /app/packages/db/prisma/migrations).
derive smoke/api-newer "$WORK/newer" <<<"FROM $API_SRC
COPY 29990101000000_smoke_compatible /app/packages/db/prisma/migrations/29990101000000_smoke_compatible"
API1=$(push "$API_SRC" restaurante-api v1)
API_NEWER=$(push smoke/api-newer restaurante-api newer)
API_BAD=$(push smoke/api-bad restaurante-api bad)
# REQ-F-042 (RF-13): una api anterior no lleva la etiqueta del webhook.
derive smoke/api-sin-webhook <<<"FROM $API_SRC
LABEL org.restaurante.webhook=\"\""
# Y una api healthy cuyo webhook no responde: escucha en otro puerto y Traefik da 502.
derive smoke/api-webhook-mudo <<<"FROM $API_SRC
CMD [\"sh\", \"-c\", \"WEBHOOK_PORT=3099 exec node src/server.ts\"]"
# Y una api que funciona como versión nueva, pero no arranca cuando vuelve como anterior (DEF-003).
derive smoke/api-sin-vuelta <<<"FROM $API_SRC
CMD [\"sh\", \"-c\", \"[ \\\"\$DATABASE_ALLOW_NEWER_SCHEMA\\\" = true ] && exit 1; exec node src/server.ts\"]"
API_OLD=$(push smoke/api-sin-webhook restaurante-api sin-webhook)
API_FRAGILE=$(push smoke/api-sin-vuelta restaurante-api sin-vuelta)
API_MUTE=$(push smoke/api-webhook-mudo restaurante-api webhook-mudo)
derive smoke/inventory-bad <<<"FROM $INVENTORY_SRC
CMD [\"node\", \"-e\", \"process.exit(1)\"]"
INV1=$(push "$INVENTORY_SRC" restaurante-inventory-manager v1)
INV_BAD=$(push smoke/inventory-bad restaurante-inventory-manager bad)
ok "app v1 $APP1, api v1 $API1, inventory-manager v1 $INV1"

# --- Rechazos antes de tocar nada ---------------------------------------------------------------
say 'argumentos y precondiciones'
check 'comando SSH con caracteres de shell -> 2' expect_exit 2 env SSH_ORIGINAL_COMMAND="deploy x; rm -rf /" "$BASE/deploy/deploy.sh"
check 'subcomando desconocido -> 2' expect_exit 2 env SSH_ORIGINAL_COMMAND="status" "$BASE/deploy/deploy.sh"
check 'digest mal formado -> 2' expect_exit 2 run_deploy 1 sha256:abc "$MIG" "$API1" "$INV1"
check 'digest de la api mal formado -> 2' expect_exit 2 run_deploy 1 "$APP1" "$MIG" sha256:abc "$INV1"
check 'forma anterior con 2 digests -> 2' expect_exit 2 env SSH_ORIGINAL_COMMAND="deploy $(fake_sha 1) $APP1 $MIG $(deploy_sum)" "$BASE/deploy/deploy.sh"
check 'forma anterior con 3 digests (sin inventory-manager) -> 2' expect_exit 2 env SSH_ORIGINAL_COMMAND="deploy $(fake_sha 1) $APP1 $MIG $API1 $(deploy_sum)" "$BASE/deploy/deploy.sh"
check 'digest de inventory-manager mal formado -> 2' expect_exit 2 run_deploy 1 "$APP1" "$MIG" "$API1" sha256:abc
check 'suma de deploy/ distinta -> 4' expect_exit 4 run_deploy 1 "$APP1" "$MIG" "$API1" "$INV1" "$(printf '%064d' 0)"
chmod 644 "$BASE/.env"
check '.env sin permisos 600 -> 3' expect_exit 3 run_deploy 1 "$APP1" "$MIG" "$API1" "$INV1"
chmod 600 "$BASE/.env"
cp "$BASE/.env" "$WORK/env.backup"
echo 'DATABASE_ALLOW_NEWER_SCHEMA=true' >>"$BASE/.env"
check 'DATABASE_ALLOW_NEWER_SCHEMA en .env -> 3' expect_exit 3 run_deploy 1 "$APP1" "$MIG" "$API1" "$INV1"
cp "$WORK/env.backup" "$BASE/.env" && chmod 600 "$BASE/.env"
# REQ-F-039: el subdominio del admin y la credencial del aviso son obligatorios.
sed -i 's/^RESTAURANTE_ADMIN_DOMAIN=.*/RESTAURANTE_ADMIN_DOMAIN=/' "$BASE/.env"
check 'sin RESTAURANTE_ADMIN_DOMAIN -> 3' expect_exit 3 run_deploy 1 "$APP1" "$MIG" "$API1" "$INV1"
cp "$WORK/env.backup" "$BASE/.env" && chmod 600 "$BASE/.env"
sed -i 's/^RESTAURANTE_INTERNAL_NOTIFY_TOKEN=.*/RESTAURANTE_INTERNAL_NOTIFY_TOKEN=corta/' "$BASE/.env"
check 'credencial del aviso corta -> 3' expect_exit 3 run_deploy 1 "$APP1" "$MIG" "$API1" "$INV1"
cp "$WORK/env.backup" "$BASE/.env" && chmod 600 "$BASE/.env"
check 'ningún rechazo creó contenedores' test -z "$(compose ps -aq)"

# --- Primer despliegue (CA-1 en local) ----------------------------------------------------------
say 'primer despliegue'
check 'deploy v1 termina con 0' run_deploy 1 "$APP1" "$MIG" "$API1" "$INV1"
check 'https raíz responde 200' test "$(https_status "$DOMAIN" /)" = 200
check 'release.env registra la app v1' grep -q "^RESTAURANTE_APP_IMAGE=$REGISTRY/restaurante@$APP1\$" "$BASE/state/release.env"
check 'release.env registra la api v1' grep -q "^RESTAURANTE_API_IMAGE=$REGISTRY/restaurante-api@$API1\$" "$BASE/state/release.env"
check 'release.env registra inventory-manager v1' grep -q "^RESTAURANTE_INVENTORY_IMAGE=$REGISTRY/restaurante-inventory-manager@$INV1\$" "$BASE/state/release.env"
check 'release.env registra el webhook en la api' grep -q '^RESTAURANTE_API_WEBHOOK=true$' "$BASE/state/release.env"
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

# --- Webhook del bot en la api (REQ-F-042: CA-1 a CA-4) -----------------------------------------
# Antes de parar la api: tras un reinicio, Traefik tarda unos segundos en volver a publicar el router
# y, mientras, la ruta llega a la app.
say 'webhook en la api, acotado a su ruta'
check 'la api tiene el router del webhook encendido' test "$(api_traefik_enable)" = true
check 'GET /webhooks/whatsapp lo responde la api (503 BOT_DISABLED, sin bot en la prueba)' webhook_on_api
check 'POST /webhooks/whatsapp también' test "$(curl -sk -o /dev/null -w '%{http_code}' --max-time 10 -X POST --resolve "$DOMAIN:443:$TRAEFIK_IP" "https://$DOMAIN/webhooks/whatsapp")" = 503
check 'la petición aparece en el log de la api' bash -c "docker logs '$(api_id)' 2>/dev/null | grep '\"msg\":\"request\"' | grep -q '\"path\":\"/webhooks/whatsapp\"'"
check 'y no en el de la app' bash -c "! docker logs '$(app_id)' 2>/dev/null | grep '\"msg\":\"request\"' | grep -q '\"path\":\"/webhooks/whatsapp\"'"
check 'el log de la api lleva la IP del cliente, no la de Traefik' bash -c "docker logs '$(api_id)' 2>/dev/null | grep '\"path\":\"/webhooks/whatsapp\"' | tail -n 1 | jq -re '.ip | select(. != \"$TRAEFIK_IP\")' >/dev/null"
for path in /api/v1/admin/sesion /api/v1/public/birria/productos /webhooks /webhooks/ /webhooks/whatsapp/ /webhooks/whatsapp/x /webhooks/whatsappx; do
  check "$path no llega a la api (404 de la app)" test "$(https_status "$DOMAIN" "$path"):$(served_by_app "$path" && echo app)" = 404:app
done
check '/api/v1/admin no aparece en el log de la api' bash -c "! docker logs '$(api_id)' 2>/dev/null | grep -q '\"path\":\"/api/v1/admin'"
check 'el puerto del webhook no sirve /api/v1 (defensa en profundidad)' bash -c "docker exec '$(app_id)' wget -q -O - http://api:3004/api/v1/public/birria/productos 2>&1 | grep -q 404"
for path in / /molotes /birria; do
  check "$path sigue en 200" test "$(https_status "$DOMAIN" "$path")" = 200
done
check "www no enruta el webhook a la api (301 a la raíz)" test "$(redirect_of https "www.$DOMAIN" /webhooks/whatsapp)" = "301 https://$DOMAIN/webhooks/whatsapp"

# --- API propia en la red interna (REQ-F-038: CA-7, CA-8 y CA-11) -------------------------------
say 'api en la red interna y productos de las landings desde la api'
check 'la api queda healthy' test "$(docker inspect -f '{{.State.Health.Status}}' "$(api_id)")" = healthy
check 'la api no publica puertos en el host' test -z "$(docker port "$(api_id)")"
check 'la app llega a la api por la red interna (200 con JSON)' bash -c "docker exec '$(app_id)' wget -q -O - http://api:3001/api/v1/public/birria/productos | grep -q '\"data\"'"
check 'Traefik no enruta a la api' test "$(https_status "$DOMAIN" /api/v1/public/birria/productos)" = 404
check 'la app cargó los productos de la api (landing_products_loaded con source api)' bash -c "docker logs '$(app_id)' 2>/dev/null | grep '\"msg\":\"landing_products_loaded\"' | grep -q '\"source\":\"api\"'"
# Un cambio hecho en la base (fuera de /admin) llega a la landing por la api al reiniciar la app.
# shellcheck disable=SC2016 # Las variables se expanden dentro del contenedor.
compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot restaurante' \
  <<<"UPDATE product SET name = 'Humo API REQ038' WHERE business = 'birria' AND slug = 'quesabirria';"
docker restart "$(app_id)" >/dev/null
check 'la app reiniciada queda healthy' wait_container_healthy "$(app_id)"
check 'la landing muestra el producto que sirve la api' bash -c "for _ in \$(seq 1 30); do curl -sk --max-time 10 --resolve '$DOMAIN:443:$TRAEFIK_IP' 'https://$DOMAIN/birria' | grep -q 'Humo API REQ038' && exit 0; sleep 2; done; exit 1"
API_RUNNING=$(api_id)
docker stop "$API_RUNNING" >/dev/null
check 'con la api parada, /molotes responde 200' test "$(https_status "$DOMAIN" /molotes)" = 200
check 'con la api parada, /birria responde 200 con la última copia buena' bash -c "curl -sk --max-time 10 --resolve '$DOMAIN:443:$TRAEFIK_IP' 'https://$DOMAIN/birria' | grep -q 'Humo API REQ038'"
check 'con la api parada, / responde 200' test "$(https_status "$DOMAIN" /)" = 200
docker start "$API_RUNNING" >/dev/null
check 'la api vuelve a quedar healthy' wait_container_healthy "$API_RUNNING"

# --- Admin nuevo en su subdominio (REQ-F-039: CA-10, CA-15 y CA-18) -----------------------------
say 'admin nuevo en admin.<dominio>'
# El límite primero, con el contador del subdominio casi sin usar (solo la sonda de deploy.sh).
codes=''
for _ in $(seq 1 75); do codes+="$(https_status "$ADMIN_DOMAIN" /salud) "; done
check "el subdominio recibe 429 tras la ráfaga ($(tr ' ' '\n' <<<"$codes" | grep . | sort | uniq -c | awk '{printf "%s x %s; ", $1, $2}'))" grep -q 429 <<<"$codes"
check 'las primeras 50 peticiones no reciben 429' bash -c "! cut -d' ' -f1-50 <<<'$codes' | grep -q 429"
check 'el límite del subdominio no afecta a las landings' test "$(https_status "$DOMAIN" /molotes)" = 200
sleep 61
check 'inventory-manager queda healthy' test "$(docker inspect -f '{{.State.Health.Status}}' "$(inventory_id)")" = healthy
check 'inventory-manager no publica puertos en el host' test -z "$(docker port "$(inventory_id)")"
check "https://$ADMIN_DOMAIN/acceso responde 200" test "$(https_status "$ADMIN_DOMAIN" /acceso)" = 200
check 'el admin responde con no-store y noindex' bash -c "curl -sk -D - -o /dev/null --max-time 10 --resolve '$ADMIN_DOMAIN:443:$TRAEFIK_IP' 'https://$ADMIN_DOMAIN/acceso' | tr -d '\r' | grep -qi '^cache-control: no-store' && curl -sk -D - -o /dev/null --max-time 10 --resolve '$ADMIN_DOMAIN:443:$TRAEFIK_IP' 'https://$ADMIN_DOMAIN/acceso' | tr -d '\r' | grep -qi '^x-robots-tag: noindex'"
check "http://$ADMIN_DOMAIN -> 301 a https conservando la ruta" test "$(redirect_of http "$ADMIN_DOMAIN" '/acceso?next=%2F')" = "301 https://$ADMIN_DOMAIN/acceso?next=%2F"
check 'el subdominio no enruta a la api (404 de inventory-manager)' test "$(https_status "$ADMIN_DOMAIN" /api/v1/admin/sesion)" = 404
check 'el dominio de las landings no expone el aviso interno' test "$(curl -sk -o /dev/null -w '%{http_code}' --max-time 10 -X POST --resolve "$DOMAIN:443:$TRAEFIK_IP" "https://$DOMAIN/internal/v1/productos-cambiados")" = 404
check 'inventory-manager llega a la api por la red admin' bash -c "docker exec '$(inventory_id)' wget -q -O - http://api:3001/api/v1/public/birria/productos | grep -q '\"data\"'"
check 'inventory-manager no ve MySQL' bash -c "! docker exec '$(inventory_id)' getent hosts mysql"
check 'la api llega al aviso interno de la app y sin credencial recibe 401' bash -c "docker exec '$(api_id)' wget -q -O - --post-data '{\"business\":\"birria\"}' --header 'Content-Type: application/json' http://$PROJECT-app-1:3002/internal/v1/productos-cambiados 2>&1 | grep -q 401"
# Sin usuarios en la base de la prueba, /admin responde 503 (administración no disponible): lo que se
# comprueba es que el dominio de las landings sigue sirviendo su /admin, no el admin nuevo.
check 'el /admin de las landings sigue en su dominio (503 sin usuarios, no 404)' bash -c "curl -sk --max-time 10 --resolve '$DOMAIN:443:$TRAEFIK_IP' 'https://$DOMAIN/admin/login' | grep -q ADMIN_UNAVAILABLE"

# --- Vecino de traefik-public con los nombres de los servicios (REQ-F-042, DEF-004) --------------
say 'un vecino con los alias app y mysql no afecta a la api'
docker run -d --name smoke-vecino --network traefik-public --network-alias app --network-alias mysql --entrypoint sleep "$API_SRC" 600 >/dev/null
VECINO_IP=$(docker inspect -f '{{(index .NetworkSettings.Networks "traefik-public").IPAddress}}' smoke-vecino)
check 'la trampa funciona: desde la api, app resuelve al vecino' bash -c "docker exec '$(api_id)' getent ahosts app | grep -q '$VECINO_IP'"
docker restart "$(api_id)" >/dev/null
check 'la api arranca con el vecino en la red' wait_container_healthy "$(api_id)"
check 'y el aviso interno sigue llegando a la app' bash -c "docker exec '$(api_id)' wget -q -O - --post-data '{\"business\":\"birria\"}' --header 'Content-Type: application/json' http://$PROJECT-app-1:3002/internal/v1/productos-cambiados 2>&1 | grep -q 401"
check 'el nombre de la app no resuelve al vecino' bash -c "! docker exec '$(api_id)' getent ahosts $PROJECT-app-1 | grep -q '$VECINO_IP'"
docker rm -f smoke-vecino >/dev/null
check 'el webhook vuelve a la api' wait_for webhook_on_api

# --- Segundo despliegue y retención (CA-7) ------------------------------------------------------
say 'segundo despliegue y retención de volcados'
for i in 1 2 3 4 5 6 7 8; do
  : >"$BASE/backups/20000101T00000${i}Z-viejo.sql.gz"
  touch -d "2000-01-0$i" "$BASE/backups/20000101T00000${i}Z-viejo.sql.gz"
done
check 'deploy v2 termina con 0' run_deploy 2 "$APP2" "$MIG" "$API1" "$INV1"
check 'quedan 7 volcados' test "$(find "$BASE/backups" -name '*.sql.gz' | wc -l)" = 7
check 'el volcado nuevo se conserva' test -n "$(find "$BASE/backups" -name "*-$(fake_sha 2 | cut -c1-12).sql.gz")"
check 'la app usa v2' test "$(app_image)" = "$REGISTRY/restaurante@$APP2"

say 'migración que falla (CA-7)'
BEFORE=$(app_id)
check 'deploy con migrate roto -> 13' expect_exit 13 run_deploy 3 "$APP1" "$MIG_BAD" "$API1" "$INV1"
check 'la app en marcha no se tocó' test "$(app_id)" = "$BEFORE"
check 'el sitio sigue en 200' test "$(https_status "$DOMAIN" /)" = 200
check 'el volcado previo existe' test -n "$(find "$BASE/backups" -name "*-$(fake_sha 3 | cut -c1-12).sql.gz")"

say 'imagen que no pasa la salud (CA-8)'
check 'deploy con app rota -> 21 (vuelta atrás)' expect_exit 21 run_deploy 4 "$APP_BAD" "$MIG" "$API1" "$INV1"
check 'la app volvió al digest anterior (v2)' test "$(app_image)" = "$REGISTRY/restaurante@$APP2"
check 'el sitio sigue en 200' test "$(https_status "$DOMAIN" /)" = 200
check 'release.env sigue en v2' grep -q "@$APP2\$" "$BASE/state/release.env"

say 'dos despliegues a la vez (CA-9)'
run_deploy 5 "$APP2" "$MIG" "$API1" "$INV1" >/dev/null & first=$!
sleep 1
second=0
run_deploy 6 "$APP2" "$MIG" "$API1" "$INV1" >/dev/null || second=$?
wait "$first" && first=0 || first=$?
check 'los dos terminan con 0' test "$first:$second" = 0:0
check 'uno esperó al otro (flock)' grep -q deploy_waiting_lock "$WORK/deploy-5.log" "$WORK/deploy-6.log"

say 'api que no pasa la salud (REQ-F-038)'
BEFORE=$(app_id)
check 'deploy con api rota -> 15' expect_exit 15 run_deploy 8 "$APP2" "$MIG" "$API_BAD" "$INV1"
check 'la app en marcha no se tocó' test "$(app_id)" = "$BEFORE"
check 'la api volvió a la anterior (v1)' test "$(api_image)" = "$REGISTRY/restaurante-api@$API1"
check 'la api anterior queda healthy' wait_container_healthy "$(api_id)"
check 'el sitio sigue en 200' test "$(https_status "$DOMAIN" /)" = 200
check 'releases.log registra api_failed' grep -q 'result=api_failed' "$BASE/state/releases.log"

say 'inventory-manager que no pasa la salud (REQ-F-039, CA-18)'
BEFORE=$(app_id)
check 'deploy con inventory-manager roto -> 16' expect_exit 16 run_deploy 10 "$APP2" "$MIG" "$API1" "$INV_BAD"
check 'la app en marcha no se tocó' test "$(app_id)" = "$BEFORE"
check 'inventory-manager volvió al anterior (v1)' test "$(inventory_image)" = "$REGISTRY/restaurante-inventory-manager@$INV1"
check 'inventory-manager anterior queda healthy' wait_container_healthy "$(inventory_id)"
check 'las landings siguen en 200' test "$(https_status "$DOMAIN" /)" = 200
check 'la api sigue healthy' test "$(docker inspect -f '{{.State.Health.Status}}' "$(api_id)")" = healthy
check 'releases.log registra inventory_failed' grep -q 'result=inventory_failed' "$BASE/state/releases.log"

# --- El router del webhook sigue a la imagen de la api (REQ-F-042: RF-13 y CA-14) ----------------
say 'vuelta a una api sin webhook'
check 'deploy con una api sin la etiqueta -> 0' run_deploy 11 "$APP2" "$MIG" "$API_OLD" "$INV1"
check 'la api queda con traefik.enable=false' test "$(api_traefik_enable)" = false
check 'la ruta del webhook vuelve a la app' wait_for webhook_on_app
check 'release.env lo registra' grep -q '^RESTAURANTE_API_WEBHOOK=false$' "$BASE/state/release.env"

say 'primer despliegue con webhook y app rota: la vuelta atrás devuelve el router'
check 'deploy con api con webhook y app rota -> 21' expect_exit 21 run_deploy 12 "$APP_BAD" "$MIG" "$API1" "$INV1"
check 'la api volvió a la anterior' test "$(api_image)" = "$REGISTRY/restaurante-api@$API_OLD"
check 'con traefik.enable=false' test "$(api_traefik_enable)" = false
check 'la app volvió a la anterior' test "$(app_image)" = "$REGISTRY/restaurante@$APP2"
check 'la ruta del webhook vuelve a la app' wait_for webhook_on_app

say 'api healthy cuyo webhook no llega por Traefik'
BEFORE=$(app_id)
check 'deploy con webhook mudo -> 15' expect_exit 15 run_deploy 13 "$APP2" "$MIG" "$API_MUTE" "$INV1"
check 'la app en marcha no se tocó' test "$(app_id)" = "$BEFORE"
check 'la api volvió a la anterior' test "$(api_image)" = "$REGISTRY/restaurante-api@$API_OLD"
check 'con traefik.enable=false' test "$(api_traefik_enable)" = false
check 'la ruta del webhook sigue en la app' wait_for webhook_on_app

say 'sin api anterior y con el webhook mudo (DEF-005)'
docker rm -f "$(api_id)" >/dev/null
sed -i '/^RESTAURANTE_API_/d' "$BASE/state/release.env"
check 'deploy con webhook mudo y sin api anterior -> 15' expect_exit 15 run_deploy 15 "$APP2" "$MIG" "$API_MUTE" "$INV1"
check 'la api rota queda detenida' test -z "$(api_id)"
check 'la ruta del webhook vuelve a la app' wait_for webhook_on_app

say 'despliegue hacia una api con webhook'
check 'deploy con api con webhook -> 0' run_deploy 14 "$APP2" "$MIG" "$API1" "$INV1"
check 'la api queda con traefik.enable=true' test "$(api_traefik_enable)" = true
check 'el webhook lo responde la api' wait_for webhook_on_api

say 'la api anterior no vuelve en una vuelta atrás (DEF-003)'
check 'deploy con una api frágil -> 0' run_deploy 16 "$APP2" "$MIG" "$API_FRAGILE" "$INV1"
check 'con app rota y la api anterior sin arrancar -> 22, no 21' expect_exit 22 run_deploy 17 "$APP_BAD" "$MIG" "$API1" "$INV1"
check 'la app volvió a la anterior' test "$(app_image)" = "$REGISTRY/restaurante@$APP2"
check 'releases.log lo registra' grep -q 'result=health_failed_api_not_restored' "$BASE/state/releases.log"
check 'el siguiente despliegue lo arregla -> 0' run_deploy 18 "$APP2" "$MIG" "$API1" "$INV1"
check 'el webhook lo responde la api' wait_for webhook_on_api

say 'procedimientos de docs/despliegue.md (DEF-001 y DEF-002)'
cp "$BASE/state/release.env" "$WORK/release.env.backup"
# Como tras restore.sh: release.env sin las líneas de la api.
sed -i '/^RESTAURANTE_API_/d' "$BASE/state/release.env"
docker rm -f "$(api_id)" >/dev/null
check 'tras una restauración, el procedimiento arranca la api' manual_api "$REGISTRY/restaurante-api@$API1"
check 'con el router encendido' test "$(api_traefik_enable)" = true
check 'la api queda healthy' wait_container_healthy "$(api_id)"
check 'y el webhook la alcanza' wait_for webhook_on_api
cp "$WORK/release.env.backup" "$BASE/state/release.env"
# Con release.env en true, una api sin webhook no hereda el router (nada de 502).
check 'con una api sin webhook, el procedimiento apaga el router' manual_api "$REGISTRY/restaurante-api@$API_OLD"
check 'traefik.enable=false' test "$(api_traefik_enable)" = false
check 'la ruta vuelve a la app, sin 502' wait_for webhook_on_app
check 'volver a la api con webhook' manual_api "$REGISTRY/restaurante-api@$API1"
check 'la api queda healthy' wait_container_healthy "$(api_id)"
check 'el webhook lo responde la api' wait_for webhook_on_api
DOC="$DEPLOY_SRC/../docs/despliegue.md"
check 'todo comando documentado que recrea la api pasa RESTAURANTE_API_WEBHOOK' bash -c "test -f '$DOC' && ! grep -E '(up -d|up) --no-deps api' '$DOC' | grep -v RESTAURANTE_API_WEBHOOK | grep -q ."

say 'api rota tras una migración nueva (DEF-001 de REQ-F-038)'
BEFORE=$(app_id)
check 'deploy con migración nueva y api rota -> 15' expect_exit 15 run_deploy 9 "$APP2" "$MIG_NEWER" "$API_BAD" "$INV1"
check 'la app se recreó (las migraciones nuevas la obligan)' test "$(app_id)" != "$BEFORE"
check 'con la misma imagen (v2)' test "$(app_image)" = "$REGISTRY/restaurante@$APP2"
check 'y con DATABASE_ALLOW_NEWER_SCHEMA=true' bash -c "docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' '$(app_id)' | grep -qx DATABASE_ALLOW_NEWER_SCHEMA=true"
docker restart "$(app_id)" >/dev/null
check 'tras reiniciarla, la app queda healthy sobre la base migrada' wait_container_healthy "$(app_id)"
check 'y el sitio responde 200' bash -c "for _ in \$(seq 1 30); do [ \"\$(curl -sk -o /dev/null -w '%{http_code}' --max-time 10 --resolve '$DOMAIN:443:$TRAEFIK_IP' 'https://$DOMAIN/')\" = 200 ] && exit 0; sleep 2; done; exit 1"

say 'vuelta atrás tras una migración nueva (D-1)'
check 'deploy con migración nueva y app rota -> 21' expect_exit 21 run_deploy 7 "$APP_BAD" "$MIG_NEWER" "$API_NEWER" "$INV1"
check 'la app anterior arranca con la base más nueva' test "$(https_status "$DOMAIN" /)" = 200
check 'y lo registra (database_newer_than_code_allowed)' bash -c "docker logs '$(app_id)' 2>&1 | grep -q database_newer_than_code_allowed"

say 'resultado'
if ((FAILURES > 0)); then
  echo "$FAILURES comprobaciones fallaron" >&2
  exit 1
fi
echo 'todas las comprobaciones pasaron'
