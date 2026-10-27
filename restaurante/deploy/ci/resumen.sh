#!/usr/bin/env bash
# Resumen del despliegue en la ejecución de GitHub Actions (REQ-F-030). Escribe en la salida
# estándar el Markdown del resumen; el workflow lo agrega a $GITHUB_STEP_SUMMARY. No lo instala ni
# lo usa el VPS: está fuera de la suma de deploy/ (DEPLOY_FILES de deploy.sh).
#
#   deploy/ci/resumen.sh vigente   # job `vigente`: el commit ya no es la punta de main (Omitido)
#   deploy/ci/resumen.sh deploy    # job `deploy`: resultado del paso `desplegar`
#
# Entradas (variables de entorno; nunca recibe secretos):
#   GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_SHA  las de GitHub Actions
#   MAIN_SHA        commit vigente de main (Omitido)
#   OMITIDO         `true` si la comprobación de `deploy` vio que main avanzó
#   SSH_OUTCOME     steps.ssh.outcome: success, failure, cancelled, skipped o vacío
#   SSH_CODE        código de salida de deploy.sh por SSH (vacío si el paso no lo pudo escribir)
#   JOB_STATUS      job.status: success, failure o cancelled
#   APP_DIGEST, MIGRATE_DIGEST, API_DIGEST  digests publicados (sha256:<64 hex>; API_DIGEST desde REQ-F-038)
#
# Toda entrada se valida antes de escribirla: un valor inesperado produce el resumen
# "Fallido (entrada no válida)" y nunca aparece en el Markdown. Termina siempre con 0: el estado
# del job lo decide el paso `desplegar`, nunca este script.
# Los textos llevan comillas invertidas de Markdown entre comillas simples, a propósito.
# shellcheck disable=SC2016
set -uo pipefail

MODO=${1:-}
SERVER=${GITHUB_SERVER_URL:-}
REPO=${GITHUB_REPOSITORY:-}
SHA=${GITHUB_SHA:-}
MAIN=${MAIN_SHA:-}
OMITIDO=${OMITIDO:-}
OUTCOME=${SSH_OUTCOME:-}
CODE=${SSH_CODE:-}
JOB=${JOB_STATUS:-}
APP=${APP_DIGEST:-}
MIGRATE=${MIGRATE_DIGEST:-}
API=${API_DIGEST:-}

es_sha() { [[ "$1" =~ ^[0-9a-f]{40}$ ]]; }
es_digest() { [[ "$1" =~ ^sha256:[0-9a-f]{64}$ ]]; }

invalida() {
  printf '### Fallido (entrada no válida)\n\n'
  printf 'El resumen no se pudo generar con los datos recibidos. El resultado real es el estado del '
  printf 'job y el log del paso `desplegar`; revisa `state/releases.log` en el VPS.\n'
  exit 0
}

# Comunes: sin ellos no hay enlace al commit.
[[ "$SERVER" =~ ^https://[A-Za-z0-9.-]+(:[0-9]+)?$ ]] || invalida
[[ "$REPO" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || invalida
es_sha "$SHA" || invalida
case "$MODO" in vigente | deploy) ;; *) invalida ;; esac
[[ -z "$OMITIDO" || "$OMITIDO" == true ]] || invalida
case "$OUTCOME" in '' | success | failure | cancelled | skipped) ;; *) invalida ;; esac
[[ -z "$CODE" || "$CODE" =~ ^[0-9]{1,3}$ ]] || invalida
case "$JOB" in '' | success | failure | cancelled) ;; *) invalida ;; esac

enlace() { printf '[`%s`](%s/%s/commit/%s)' "${1:0:7}" "$SERVER" "$REPO" "$1"; }
DOC="$SERVER/$REPO/blob/$SHA/restaurante/docs/despliegue.md"

cabecera() { # cabecera <estado>
  printf '### %s\n\n' "$1"
  printf -- '- commit: %s (`%s`)\n' "$(enlace "$SHA")" "$SHA"
}

omitido() { # omitido <true si el job termina en fallo>
  es_sha "$MAIN" || invalida
  cabecera Omitido
  printf -- '- `main` ya está en %s: este commit no es la punta de `main` y no se despliega; ' "$(enlace "$MAIN")"
  printf 'lo desplegará su propia ejecución.\n'
  if [[ "$1" == true ]]; then
    printf -- '- Producción no se tocó. El job termina en fallo para que Deployments no lo registre '
    printf 'como desplegado.\n'
  fi
  exit 0
}

fallido() { # fallido <texto>
  cabecera Fallido
  if [[ -n "$CODE" ]]; then printf -- '- código de salida de `deploy.sh`: %s\n' "$CODE"; fi
  printf -- '- %s\n' "$1"
  exit 0
}

interrumpido() { # interrumpido <texto>
  cabecera 'Cancelado o interrumpido'
  printf -- '- %s\n' "$1"
  exit 0
}

if [[ "$MODO" == vigente ]]; then omitido false; fi
if [[ "$OMITIDO" == true ]]; then omitido true; fi

case "$OUTCOME" in
  success)
    if ! es_digest "$APP" || ! es_digest "$MIGRATE" || ! es_digest "$API"; then invalida; fi
    cabecera Desplegado
    printf -- '- app: `ghcr.io/orvigas/restaurante@%s`\n' "$APP"
    printf -- '- migrate: `ghcr.io/orvigas/restaurante-migrate@%s`\n' "$MIGRATE"
    printf -- '- api: `ghcr.io/orvigas/restaurante-api@%s`\n' "$API"
    exit 0
    ;;
  '' | skipped)
    if [[ "$JOB" == cancelled ]]; then
      interrumpido 'El job se canceló antes de empezar el despliegue: producción no se tocó.'
    fi
    fallido 'El despliegue no empezó (falló un paso anterior): producción no se tocó.'
    ;;
  cancelled)
    interrumpido 'El job se canceló durante el despliegue: resultado no confirmado. Revisa `state/releases.log` en el VPS.'
    ;;
esac

# failure: sin código, el paso no terminó por su cuenta (tiempo agotado o proceso interrumpido).
if [[ -z "$CODE" ]]; then
  interrumpido 'El paso `desplegar` se interrumpió (tiempo agotado o cancelación): resultado no confirmado. Revisa `state/releases.log` en el VPS.'
fi

case "$CODE" in
  21)
    cabecera Revertido
    printf -- '- La versión nueva no quedó sana y producción volvió a la anterior: producción sigue con '
    printf 'la versión anterior (código 21).\n'
    printf -- '- Commit anterior no disponible: la imagen anterior figura en el log del paso '
    printf '`desplegar` y en `state/release.env` del VPS.\n'
    ;;
  2 | 3 | 4 | 5 | 10 | 11 | 12)
    fallido "Producción no se tocó. Causa y solución en [Diagnóstico]($DOC#10-diagnóstico)."
    ;;
  13)
    fallido "La app no se tocó; la migración pudo quedar a medias: [restaurar la base]($DOC#9-restaurar-la-base-desde-un-volcado)."
    ;;
  15)
    fallido "La api nueva no quedó sana: volvió a la anterior (si la había) y la app no se tocó, salvo que hubiera migraciones nuevas: entonces sigue con su versión, recreada con \`DATABASE_ALLOW_NEWER_SCHEMA=true\`. Causa y solución en [Diagnóstico]($DOC#10-diagnóstico)."
    ;;
  20 | 22)
    fallido "Producción pudo quedar sin servicio. Sigue [Diagnóstico]($DOC#10-diagnóstico)."
    ;;
  *)
    fallido 'Error de conexión o desconocido: no se puede asegurar si producción cambió. Revisa `state/releases.log` en el VPS.'
    ;;
esac
exit 0
