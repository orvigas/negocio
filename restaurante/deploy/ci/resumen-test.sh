#!/usr/bin/env bash
# Pruebas de deploy/ci/resumen.sh (REQ-F-030, job `despliegue` del CI): ejecuta el generador con
# entradas simuladas de cada estado y comprueba el encabezado, el enlace al commit, el SHA completo
# y los textos clave. No toca GitHub ni el VPS.
#
#   deploy/ci/resumen-test.sh
# Los textos esperados llevan comillas invertidas de Markdown entre comillas simples, a propósito.
# shellcheck disable=SC2016
set -euo pipefail

RESUMEN="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)/resumen.sh"
SERVER=https://github.com
REPO=orvigas/negocio
SHA=0123456789abcdef0123456789abcdef01234567
MAIN=89abcdef0123456789abcdef0123456789abcdef
APP=sha256:$(printf 'a%.0s' {1..64})
MIGRATE=sha256:$(printf 'b%.0s' {1..64})
ENLACE="[\`0123456\`]($SERVER/$REPO/commit/$SHA)"
FAILURES=0
SALIDA=''

# genera <modo> [VAR=valor...]: ejecuta resumen.sh con un entorno limpio más las variables dadas.
genera() {
  local modo=$1
  shift
  local code=0
  SALIDA=$(env -i PATH="$PATH" GITHUB_SERVER_URL="$SERVER" GITHUB_REPOSITORY="$REPO" GITHUB_SHA="$SHA" \
    "$@" bash "$RESUMEN" "$modo") || code=$?
  if [[ $code -ne 0 ]]; then
    printf '  FALLO: resumen.sh terminó con %s\n' "$code" >&2
    FAILURES=$((FAILURES + 1))
  fi
}

contiene() { # contiene <descripción> <texto esperado>
  if [[ "$SALIDA" == *"$2"* ]]; then
    printf '  ok: %s\n' "$1"
  else
    printf '  FALLO: %s: falta «%s» en:\n%s\n' "$1" "$2" "$SALIDA" >&2
    FAILURES=$((FAILURES + 1))
  fi
}

no_contiene() { # no_contiene <descripción> <texto>
  if [[ "$SALIDA" != *"$2"* ]]; then
    printf '  ok: %s\n' "$1"
  else
    printf '  FALLO: %s: sobra «%s» en:\n%s\n' "$1" "$2" "$SALIDA" >&2
    FAILURES=$((FAILURES + 1))
  fi
}

commit() { # commit <caso>: enlace con el SHA corto y SHA completo
  contiene "$1: enlace al commit" "- commit: $ENLACE (\`$SHA\`)"
}

caso() { printf '\n== %s\n' "$*"; }

caso 'desplegado'
genera deploy SSH_OUTCOME=success SSH_CODE=0 JOB_STATUS=success APP_DIGEST="$APP" MIGRATE_DIGEST="$MIGRATE"
contiene 'desplegado: encabezado' '### Desplegado'
commit desplegado
contiene 'desplegado: digest de la app' "ghcr.io/orvigas/restaurante@$APP"
contiene 'desplegado: digest de migrate' "ghcr.io/orvigas/restaurante-migrate@$MIGRATE"

caso 'omitido en vigente'
genera vigente MAIN_SHA="$MAIN"
contiene 'omitido: encabezado' '### Omitido'
commit omitido
contiene 'omitido: commit vigente de main' "[\`89abcde\`]($SERVER/$REPO/commit/$MAIN)"
contiene 'omitido: lo desplegará su ejecución' 'lo desplegará su propia ejecución'
no_contiene 'omitido en vigente: sin fallo del job' 'termina en fallo'

caso 'omitido en la segunda comprobación de deploy'
genera deploy OMITIDO=true MAIN_SHA="$MAIN" SSH_OUTCOME=skipped JOB_STATUS=failure
contiene 'omitido en deploy: encabezado' '### Omitido'
commit 'omitido en deploy'
contiene 'omitido en deploy: termina en fallo' 'El job termina en fallo'
contiene 'omitido en deploy: producción intacta' 'Producción no se tocó'

caso 'revertido (21)'
genera deploy SSH_OUTCOME=failure SSH_CODE=21 JOB_STATUS=failure
contiene 'revertido: encabezado' '### Revertido'
commit revertido
contiene 'revertido: sigue la versión anterior' 'producción sigue con la versión anterior'
contiene 'revertido: commit anterior' 'Commit anterior no disponible'

caso 'fallido (22)'
genera deploy SSH_OUTCOME=failure SSH_CODE=22 JOB_STATUS=failure
contiene '22: encabezado' '### Fallido'
commit 22
contiene '22: código' 'código de salida de `deploy.sh`: 22'
contiene '22: producción afectada' 'Producción pudo quedar sin servicio'
contiene '22: enlace a diagnóstico' "$SERVER/$REPO/blob/$SHA/restaurante/docs/despliegue.md#10-diagnóstico"

caso 'fallido (20)'
genera deploy SSH_OUTCOME=failure SSH_CODE=20 JOB_STATUS=failure
contiene '20: encabezado' '### Fallido'
contiene '20: código' 'código de salida de `deploy.sh`: 20'
contiene '20: enlace a diagnóstico' 'despliegue.md#10-diagnóstico'

caso 'fallido (13)'
genera deploy SSH_OUTCOME=failure SSH_CODE=13 JOB_STATUS=failure
contiene '13: encabezado' '### Fallido'
contiene '13: migración' 'la migración pudo quedar a medias'
contiene '13: enlace a restaurar' 'despliegue.md#9-restaurar-la-base-desde-un-volcado'

caso 'fallido (4)'
genera deploy SSH_OUTCOME=failure SSH_CODE=4 JOB_STATUS=failure
contiene '4: encabezado' '### Fallido'
contiene '4: código' 'código de salida de `deploy.sh`: 4'
contiene '4: producción intacta' 'Producción no se tocó'

caso 'fallido (255)'
genera deploy SSH_OUTCOME=failure SSH_CODE=255 JOB_STATUS=failure
contiene '255: encabezado' '### Fallido'
contiene '255: código' 'código de salida de `deploy.sh`: 255'
contiene '255: no confirmado' 'no se puede asegurar si producción cambió'

caso 'paso no ejecutado'
genera deploy SSH_OUTCOME=skipped JOB_STATUS=failure
contiene 'no ejecutado: encabezado' '### Fallido'
commit 'no ejecutado'
contiene 'no ejecutado: producción intacta' 'El despliegue no empezó'
no_contiene 'no ejecutado: sin código' 'código de salida'

caso 'cancelado durante el despliegue'
genera deploy SSH_OUTCOME=cancelled JOB_STATUS=cancelled
contiene 'cancelado: encabezado' '### Cancelado o interrumpido'
commit cancelado
contiene 'cancelado: no confirmado' 'resultado no confirmado'
contiene 'cancelado: releases.log' 'state/releases.log'

caso 'tiempo agotado (failure sin código)'
genera deploy SSH_OUTCOME=failure JOB_STATUS=failure
contiene 'tiempo agotado: encabezado' '### Cancelado o interrumpido'
contiene 'tiempo agotado: no confirmado' 'resultado no confirmado'

caso 'cancelado antes del despliegue'
genera deploy SSH_OUTCOME=skipped JOB_STATUS=cancelled
contiene 'cancelado antes: encabezado' '### Cancelado o interrumpido'
contiene 'cancelado antes: producción intacta' 'producción no se tocó'

caso 'entradas no válidas'
genera deploy SSH_OUTCOME=success JOB_STATUS=success APP_DIGEST='sha256:<script>' MIGRATE_DIGEST="$MIGRATE"
contiene 'digest inválido: encabezado' '### Fallido (entrada no válida)'
no_contiene 'digest inválido: no se escribe' '<script>'
genera deploy SSH_OUTCOME=failure SSH_CODE='21; rm' JOB_STATUS=failure
contiene 'código inválido: encabezado' '### Fallido (entrada no válida)'
no_contiene 'código inválido: no se escribe' '21; rm'
genera vigente MAIN_SHA='main'
contiene 'commit de main inválido: encabezado' '### Fallido (entrada no válida)'
genera deploy SSH_OUTCOME=raro JOB_STATUS=failure
contiene 'resultado inválido: encabezado' '### Fallido (entrada no válida)'
genera otro
contiene 'modo inválido: encabezado' '### Fallido (entrada no válida)'
genera deploy GITHUB_SHA='abc' SSH_OUTCOME=success
contiene 'SHA inválido: encabezado' '### Fallido (entrada no válida)'
no_contiene 'SHA inválido: sin enlace' '/commit/'

if [[ $FAILURES -gt 0 ]]; then
  printf '\n%s comprobaciones fallidas\n' "$FAILURES" >&2
  exit 1
fi
printf '\nresumen.sh: todas las comprobaciones pasaron\n'
