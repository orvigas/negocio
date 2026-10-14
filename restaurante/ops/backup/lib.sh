# shellcheck shell=bash
# Funciones comunes de los respaldos (REQ-F-019). Las cargan backup.sh, env-backup.sh y restore.sh
# (VPS, bash 5 y GNU) y verify-backup.sh (Mac, bash 3.2 y BSD): nada de bash 4 (arrays asociativos,
# mapfile, ${v,,}) ni opciones exclusivas de GNU aquí.
#
# Secretos (regla de negocio del ticket): nunca en argumentos ni en logs. Las credenciales de R2 y la
# URL de Healthchecks llegan a curl en un archivo de configuración por sustitución de proceso (-K
# <(...)), que solo ve este proceso. Sin `set -x`.

# --- Log y errores -------------------------------------------------------------------------------

SCRIPT_NAME=${SCRIPT_NAME:-$(basename -- "$0" .sh)}

log() { printf '%s %s: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$SCRIPT_NAME" "$*" >&2; }

# --- Utilidades portables (GNU y BSD) ------------------------------------------------------------

sha256_of() { # sha256_of <archivo> -> hex
  if command -v sha256sum >/dev/null 2>&1; then sha256sum -- "$1" | cut -c1-64; else shasum -a 256 -- "$1" | cut -c1-64; fi
}

md5_of() { # md5_of <archivo> -> hex
  if command -v md5sum >/dev/null 2>&1; then md5sum -- "$1" | cut -c1-32; else md5 -q -- "$1"; fi
}

size_of() { # size_of <archivo> -> bytes
  wc -c <"$1" | tr -d ' '
}

mode_of() { # mode_of <archivo> -> permisos en octal (600, 640...)
  stat -c '%a' -- "$1" 2>/dev/null || stat -f '%Lp' -- "$1"
}

# Codifica un valor para la query de una URL (RFC 3986: solo se dejan sin codificar A-Z a-z 0-9 -_.~).
urlencode() {
  local LC_ALL=C value=$1 out='' char i
  for ((i = 0; i < ${#value}; i++)); do
    char=${value:i:1}
    case $char in
      [A-Za-z0-9._~-]) out+=$char ;;
      *) out+=$(printf '%%%02X' "'$char") ;;
    esac
  done
  printf '%s' "$out"
}

# --- Configuración -------------------------------------------------------------------------------

# Valor de una variable de un archivo KEY=valor (última aparición; sin comillas envolventes). No se
# usa `source`: es un archivo de secretos y no debe ejecutarse.
conf_value() { # conf_value <archivo> <nombre>
  local line
  line=$(grep -E "^[[:space:]]*$2=" "$1" | tail -n 1 || true)
  line=${line#*=}
  line=${line%\"}
  line=${line#\"}
  line=${line%\'}
  line=${line#\'}
  printf '%s' "$line"
}

# Solo para pruebas (ci/smoke.sh): permite http:// hacia un S3 y un Healthchecks locales.
insecure_allowed() { [[ "${BACKUP_ALLOW_INSECURE_ENDPOINTS:-}" == 1 ]]; }

# Carga y valida la configuración de R2 y de Healthchecks. Deja R2_*, S3_ENDPOINT, S3_REGION y
# HC_PING_URL. <hc>: required | optional. Devuelve 1 con el motivo en el log (sin valores).
load_config() { # load_config <archivo> <hc>
  local file=$1 hc_mode=${2:-required} mode
  if [[ ! -f "$file" ]]; then
    log "ERROR: falta el archivo de configuración $file"
    return 1
  fi
  mode=$(mode_of "$file")
  if [[ "${mode: -1}" != 0 ]]; then
    log "ERROR: $file no puede ser legible por otros usuarios (permisos $mode; usa 600 o 640)"
    return 1
  fi
  R2_ACCOUNT_ID=$(conf_value "$file" R2_ACCOUNT_ID)
  R2_BUCKET=$(conf_value "$file" R2_BUCKET)
  R2_ACCESS_KEY_ID=$(conf_value "$file" R2_ACCESS_KEY_ID)
  R2_SECRET_ACCESS_KEY=$(conf_value "$file" R2_SECRET_ACCESS_KEY)
  HC_PING_URL=$(conf_value "$file" HC_PING_URL)
  S3_ENDPOINT=$(conf_value "$file" S3_ENDPOINT)
  S3_REGION=$(conf_value "$file" S3_REGION)
  S3_REGION=${S3_REGION:-auto}
  local problems=0
  [[ "$R2_ACCOUNT_ID" =~ ^[0-9a-f]{32}$ ]] || { log 'ERROR: R2_ACCOUNT_ID debe ser el Account ID de Cloudflare (32 caracteres hexadecimales)'; problems=1; }
  [[ "$R2_BUCKET" =~ ^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$ ]] || { log 'ERROR: R2_BUCKET no es un nombre de bucket válido'; problems=1; }
  [[ "$R2_ACCESS_KEY_ID" =~ ^[A-Za-z0-9]{16,128}$ ]] || { log 'ERROR: R2_ACCESS_KEY_ID no es válido'; problems=1; }
  [[ "$R2_SECRET_ACCESS_KEY" =~ ^[A-Za-z0-9]{16,128}$ ]] || { log 'ERROR: R2_SECRET_ACCESS_KEY no es válido'; problems=1; }
  [[ "$S3_REGION" =~ ^[a-z0-9-]{1,32}$ ]] || { log 'ERROR: S3_REGION no es válida'; problems=1; }
  if [[ -z "$S3_ENDPOINT" ]]; then
    S3_ENDPOINT="https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com"
  elif ! [[ "$S3_ENDPOINT" =~ ^https://[a-z0-9.-]+(:[0-9]+)?$ ]] && ! { insecure_allowed && [[ "$S3_ENDPOINT" =~ ^http://[a-z0-9.-]+(:[0-9]+)?$ ]]; }; then
    log 'ERROR: S3_ENDPOINT debe ser https://host[:puerto] (déjala vacía para R2)'
    problems=1
  fi
  if [[ -z "$HC_PING_URL" ]]; then
    if [[ "$hc_mode" == required ]]; then
      log 'ERROR: falta HC_PING_URL'
      problems=1
    fi
  elif ! [[ "$HC_PING_URL" =~ ^https://hc-ping\.com/[A-Za-z0-9_-]+(/[A-Za-z0-9_-]+)?$ ]] && ! { insecure_allowed && [[ "$HC_PING_URL" =~ ^http://[a-z0-9.-]+(:[0-9]+)?/[A-Za-z0-9_/-]+$ ]]; }; then
    log 'ERROR: HC_PING_URL debe ser la URL de ping de Healthchecks.io (https://hc-ping.com/...)'
    problems=1
  fi
  return "$problems"
}

# --- Healthchecks.io -----------------------------------------------------------------------------

# hc_ping <sufijo> [mensaje]: sufijo vacío (éxito), start, fail o un código de salida. El mensaje
# (sin secretos) se ve en el panel de Healthchecks. Un ping fallido nunca hace fallar el respaldo.
hc_ping() {
  [[ -n "${HC_PING_URL:-}" ]] || return 0
  local url=$HC_PING_URL
  [[ -n "$1" ]] && url="$url/$1"
  if ! printf '%s\n' "${2:-}" | curl -fsS -o /dev/null --max-time 15 --retry 5 --retry-connrefused \
    -K <(printf 'url = "%s"\n' "$url") --data-binary @- 2>/dev/null; then
    log "aviso: no se pudo enviar el ping a Healthchecks (${1:-success})"
  fi
  return 0
}

# --- Cliente S3 (R2) con curl --aws-sigv4 --------------------------------------------------------

s3_config() {
  printf 'user = "%s:%s"\naws-sigv4 = "aws:amz:%s:s3"\nconnect-timeout = 20\n' \
    "$R2_ACCESS_KEY_ID" "$R2_SECRET_ACCESS_KEY" "$S3_REGION"
}

s3_url() { printf '%s/%s/%s' "$S3_ENDPOINT" "$R2_BUCKET" "$1"; }

# Cabeceras del objeto (HEAD) en stdout; 1 si no existe o falla.
s3_head() { # s3_head <clave>
  curl -fsS -I --max-time 60 --retry 3 -K <(s3_config) "$(s3_url "$1")" 2>/dev/null | tr -d '\r'
}

# Sube sin sobrescribir nunca (If-None-Match: *). 0: subido (o ya estaba exactamente ese archivo,
# p. ej. tras un reintento cuya respuesta se perdió); 2: la clave existe con otro contenido; 1: error.
s3_put() { # s3_put <archivo> <clave>
  local file=$1 key=$2 code headers etag length
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 900 --retry 5 --retry-connrefused \
    -K <(s3_config) \
    -H 'If-None-Match: *' \
    -H "x-amz-content-sha256: $(sha256_of "$file")" \
    -H 'Content-Type: application/octet-stream' \
    -T "$file" "$(s3_url "$key")" 2>/dev/null) || code=000
  case $code in
    200) ;;
    412) ;;
    *)
      log "ERROR: la subida de $key respondió $code"
      return 1
      ;;
  esac
  # Comprobación posterior: el objeto existe con el tamaño y el MD5 (ETag de un PUT simple) locales.
  headers=$(s3_head "$key") || {
    log "ERROR: $key no aparece tras la subida"
    return 1
  }
  length=$(printf '%s\n' "$headers" | sed -n 's/^[Cc]ontent-[Ll]ength: *//p' | head -n 1)
  etag=$(printf '%s\n' "$headers" | sed -n 's/^[Ee][Tt]ag: *"\{0,1\}\([0-9a-fA-F]*\)"\{0,1\}.*/\1/p' | head -n 1)
  if [[ "$length" == "$(size_of "$file")" && "$etag" == "$(md5_of "$file")" ]]; then
    return 0
  fi
  if [[ "$code" == 412 ]]; then
    log "ERROR: $key ya existe con otro contenido (no se sobrescribe)"
    return 2
  fi
  log "ERROR: $key no coincide con el archivo local tras la subida"
  return 1
}

s3_get() { # s3_get <clave> <archivo de salida>
  curl -fsS --max-time 900 --retry 5 --retry-connrefused -K <(s3_config) -o "$2" "$(s3_url "$1")" 2>/dev/null || {
    log "ERROR: no se pudo descargar $1"
    return 1
  }
}

# Claves con un prefijo, una por línea (ListObjectsV2, con paginación).
s3_list() { # s3_list <prefijo>
  local token='' query body
  while :; do
    query="list-type=2&prefix=$(urlencode "$1")"
    [[ -n "$token" ]] && query="continuation-token=$(urlencode "$token")&$query"
    body=$(curl -fsS --max-time 120 --retry 3 -K <(s3_config) "$S3_ENDPOINT/$R2_BUCKET?$query" 2>/dev/null) || {
      log "ERROR: no se pudo listar $1"
      return 1
    }
    printf '%s' "$body" | grep -o '<Key>[^<]*</Key>' | sed 's/^<Key>//; s/<\/Key>$//' || true
    printf '%s' "$body" | grep -q '<IsTruncated>true</IsTruncated>' || return 0
    token=$(printf '%s' "$body" | sed -n 's/.*<NextContinuationToken>\([^<]*\)<\/NextContinuationToken>.*/\1/p')
    [[ -n "$token" ]] || return 0
  done
}

# --- age -----------------------------------------------------------------------------------------

# Comprueba que el archivo de destinatarios solo tiene claves públicas (CA-5).
check_recipients() { # check_recipients <archivo>
  local file=$1 line count=0
  [[ -f "$file" ]] || {
    log "ERROR: falta $file"
    return 1
  }
  if grep -q 'AGE-SECRET-KEY-' "$file"; then
    log "ERROR: $file contiene una clave privada de age: bórrala del VPS (solo van claves públicas age1...)"
    return 1
  fi
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "${line// /}" || "$line" == \#* ]] && continue
    [[ "$line" =~ ^age1[0-9a-z]{58}$ ]] || {
      log "ERROR: $file tiene una línea que no es una clave pública de age"
      return 1
    }
    count=$((count + 1))
  done <"$file"
  ((count > 0)) || {
    log "ERROR: $file no tiene ninguna clave pública"
    return 1
  }
}

# Lee la clave privada de age (línea AGE-SECRET-KEY-1...) de la terminal sin eco, o de stdin si no
# es una terminal (pruebas). La deja en AGE_IDENTITY; nunca toca el disco.
read_identity() {
  AGE_IDENTITY=''
  if [[ -t 0 ]]; then
    printf 'Pega la clave privada de age (AGE-SECRET-KEY-1...; no se muestra): ' >&2
    IFS= read -rs AGE_IDENTITY
    printf '\n' >&2
  else
    IFS= read -r AGE_IDENTITY || true
  fi
  [[ "$AGE_IDENTITY" =~ ^AGE-SECRET-KEY-1[0-9A-Z]{58}$ ]] || {
    AGE_IDENTITY=''
    log 'ERROR: la clave privada no tiene el formato AGE-SECRET-KEY-1...'
    return 1
  }
}

# Descifra con la clave de AGE_IDENTITY (por sustitución de proceso: ni disco ni argumentos).
age_decrypt() { # age_decrypt <cifrado> <salida>
  age -d -i <(printf '%s\n' "$AGE_IDENTITY") -o "$2" "$1"
}

# --- Paquete de respaldo -------------------------------------------------------------------------

manifest_value() { # manifest_value <manifest> <clave>
  sed -n "s/^$2=//p" "$1" | head -n 1
}

# Comprueba las sumas del manifiesto contra las partes extraídas en <dir>.
verify_parts() { # verify_parts <dir>
  local dir=$1
  [[ -f "$dir/manifest.txt" && -f "$dir/dump.sql.gz" && -f "$dir/app-data.tar" ]] || {
    log 'ERROR: el respaldo no tiene manifest.txt, dump.sql.gz y app-data.tar'
    return 1
  }
  [[ "$(manifest_value "$dir/manifest.txt" format)" == 1 ]] || {
    log 'ERROR: formato de manifiesto desconocido'
    return 1
  }
  [[ "$(sha256_of "$dir/dump.sql.gz")" == "$(manifest_value "$dir/manifest.txt" dump_sha256)" ]] || {
    log 'ERROR: la suma del volcado no coincide con el manifiesto'
    return 1
  }
  [[ "$(sha256_of "$dir/app-data.tar")" == "$(manifest_value "$dir/manifest.txt" app_data_sha256)" ]] || {
    log 'ERROR: la suma de app-data no coincide con el manifiesto'
    return 1
  }
}
