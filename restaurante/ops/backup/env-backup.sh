#!/usr/bin/env bash
# Copia cifrada del .env de producción cuando cambia (REQ-F-019, RF-9). La lanzan
# restaurante-env-backup.path (al modificarse /opt/restaurante/.env) y backup.sh cada día (por si la
# vigilancia no vio el cambio). Compara el sha256 del .env con el del último subido y solo si difiere
# lo cifra con age (claves públicas) y lo sube a env/<AAAAMMDDTHHMMSSZ>-<aleatorio>.env.age sin sobrescribir nada.
# El hash nunca va al nombre del objeto ni al log.
#
# Códigos: 0 subido o sin cambios, 2 configuración, 3 precondición, 7 cifrado, 8 subida.
set -euo pipefail
umask 077

SCRIPT_NAME=env-backup
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=SCRIPTDIR/lib.sh
. "$SCRIPT_DIR/lib.sh"

BASE_DIR=${RESTAURANTE_BASE_DIR:-/opt/restaurante}
CONFIG_DIR=${BACKUP_CONFIG_DIR:-/etc/restaurante-backup}
ENV_FILE="$BASE_DIR/.env"
OFFSITE_DIR="$BASE_DIR/offsite"
STATE_FILE="$OFFSITE_DIR/env.sha256"
CONFIG_FILE="$CONFIG_DIR/backup.env"
RECIPIENTS_FILE="$CONFIG_DIR/recipients.txt"

WORK=''
trap '[[ -n "$WORK" ]] && rm -rf -- "$WORK"' EXIT

# Fuera de backup.sh (lanzado por la unidad .path), un fallo avisa en el mismo check de Healthchecks.
fail() { # fail <código> <mensaje>
  local code=$1
  shift
  log "ERROR: $*"
  [[ -n "${BACKUP_PARENT:-}" ]] || hc_ping "$code" "env-backup: $*"
  exit "$code"
}

load_config "$CONFIG_FILE" required || fail 2 'configuración inválida (ver mensajes anteriores)'
check_recipients "$RECIPIENTS_FILE" || fail 2 'destinatarios de age inválidos'
[[ -f "$ENV_FILE" ]] || fail 3 "falta $ENV_FILE"
mkdir -p -- "$OFFSITE_DIR"
chmod 700 -- "$OFFSITE_DIR"

# Una sola copia a la vez (la unidad .path y backup.sh pueden coincidir).
exec 8>>"$OFFSITE_DIR/env.lock"
flock -w 300 8 || fail 3 'otra copia del .env sigue en curso'

CURRENT=$(sha256_of "$ENV_FILE")
if [[ -f "$STATE_FILE" && "$(cat -- "$STATE_FILE")" == "$CURRENT" ]]; then
  log '.env sin cambios'
  exit 0
fi

WORK=$(mktemp -d)
# Sufijo aleatorio: dos cambios en el mismo segundo no chocan (nunca se sobrescribe).
NAME="$(date -u +%Y%m%dT%H%M%SZ)-$(od -An -N4 -tx1 /dev/urandom | tr -d ' \n').env.age"
# Se cifra una copia tomada de una vez: si el .env cambia durante la subida, la próxima vez se nota.
cp -- "$ENV_FILE" "$WORK/env"
SNAPSHOT=$(sha256_of "$WORK/env")
age -R "$RECIPIENTS_FILE" -o "$WORK/$NAME" "$WORK/env" || fail 7 'falló el cifrado del .env'
rm -f -- "$WORK/env"
s3_put "$WORK/$NAME" "env/$NAME" || fail 8 'no se pudo subir la copia cifrada del .env'
printf '%s\n' "$SNAPSHOT" >"$STATE_FILE.tmp"
chmod 600 -- "$STATE_FILE.tmp"
mv -f -- "$STATE_FILE.tmp" "$STATE_FILE"
log "copia cifrada del .env subida: env/$NAME"
