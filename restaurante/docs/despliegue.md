# Despliegue a producción en la VM

Guía paso a paso para poner la app en producción en la máquina virtual (VM), actualizarla,
volver a una versión anterior y respaldar sus datos. Los detalles de cada tema están en el
[README](../README.md); esta guía los ordena y enlaza.

> **A definir.** El repositorio no describe la infraestructura de la VM. Lo marcado como
> **"a definir"** depende de decisiones que aún no están documentadas (lista completa en
> [Pendientes](#pendientes-a-definir)). Esta guía no las supone.

## Antes de empezar

### Qué se despliega

- Un solo proceso Node (Koa) que sirve las dos landings, `/admin`, la API `/admin/api` y el
  webhook del bot (`/webhooks/whatsapp`). Escucha en `PORT` (3000 por defecto) en todas las
  interfaces.
- Delante, un proxy inverso con TLS (nginx según el README): `/admin` y la API solo funcionan
  por HTTPS en producción, y Meta exige HTTPS para el webhook.
- Los datos editables viven **fuera del código**, en `DATA_DIR`, sobre el disco persistente de
  la VM: JSON de página de cada negocio, `changes.jsonl` y la base SQLite `restaurante.db`
  (usuarios, auditoría y productos). Un despliegue nunca los sobrescribe.
- Estado en memoria (una sola instancia): sesiones de `/admin`, límite de intentos y
  conversaciones del bot. **Cada reinicio cierra las sesiones y corta las conversaciones en
  curso.** No ejecutes dos instancias a la vez.

### Cómo se ejecuta

En la VM la app corre con **Node directo** (`npm start`) detrás de nginx, sin contenedores.
Docker solo se usa para las pruebas y el CI (ver [Docker](../README.md#docker)).

### Regla del bot en producción

En producción el bot usa **Meta** (WhatsApp Cloud API). Con `NODE_ENV=production` y
`WHATSAPP_BOT_PROVIDER=twilio` la app **no arranca**, esté o no habilitado el bot. Twilio es solo
para desarrollo ([Entorno de desarrollo](desarrollo.md#8-bot-real-con-el-sandbox-de-twilio)).

## 1. Requisitos de la VM

- Disco persistente para `DATA_DIR` (se conserva entre reinicios y despliegues).
- Node.js >= 24.3 (versión de `.nvmrc`), npm y git. La forma de instalar Node en la VM es **a
  definir**.
- Proxy inverso con TLS (nginx), dominio y certificado: **a definir**.
- Solo el proxy debe recibir tráfico de internet; el puerto 3000 no debe quedar expuesto. Reglas
  de firewall: **a definir**.
- `sqlite3` (CLI) en la VM para los respaldos en caliente ([paso 10](#10-copias-de-seguridad)).

## 2. Prerrequisitos de Meta

Los provee el dueño del negocio y están listados en
[Prerrequisitos de Meta](../README.md#prerrequisitos-de-meta-los-provee-el-dueño): cuenta de Meta
Business, app con WhatsApp y WABA, número dedicado al bot, token permanente, ID del número, App
Secret, URL pública HTTPS, plantilla aprobada del aviso al personal
([Plantilla](../README.md#plantilla-del-aviso-al-personal)), método de pago y los números del
personal.

Sin el bot, las landings funcionan igual: deja vacías todas las `WHATSAPP_BOT_*` y despliega; el
bot se puede habilitar después solo cambiando el `.env` y reiniciando.

## 3. Preparar `DATA_DIR`

`DATA_DIR` es obligatoria en producción y debe ser una **ruta absoluta** en el disco
persistente, fuera del código (nunca dentro de `src/` ni de `public/`). Ejemplo:
`/var/lib/restaurante` (la ruta exacta en la VM es **a definir**).

- Crea la carpeta con dueño el usuario del sistema que ejecuta la app (**a definir**) y
  permisos `700`.
- La primera vez la app la llena sola: copia las semillas, crea `restaurante.db`, aplica las
  migraciones e importa los productos una sola vez
  ([Archivos de datos](../README.md#archivos-de-datos-data_dir)).

## 4. `.env` de producción

Créalo en la VM a partir de `.env.example`, con permisos `600` y dueño el usuario de la app. **No
se versiona** ni entra en la imagen: se inyecta al ejecutar. Guarda una copia de los secretos en
un lugar seguro fuera de la VM (**a definir** dónde). Explicación de cada variable en
[Configuración](../README.md#configuración) y [Variables del bot](../README.md#variables-del-bot).

```sh
# --- Servidor ---
NODE_ENV=production
PORT=3000
BUSINESS_TIMEZONE=America/Mexico_City
SITE_URL=https://<dominio>                    # dominio a definir

# --- WhatsApp: con el bot, los dos llevan el número del bot (el mismo) ---
WHATSAPP_MOLOTES=<número del bot, solo dígitos>
WHATSAPP_BIRRIA=<número del bot, solo dígitos>
WHATSAPP_MOLOTES_MESSAGE=Hola, quiero hacer un pedido de molotes
WHATSAPP_BIRRIA_MESSAGE=Hola, quiero hacer un pedido de birria

# --- Bot de WhatsApp: siempre Meta en producción ---
WHATSAPP_BOT_PROVIDER=meta
WHATSAPP_BOT_ACCOUNT_ID=<ID del número del bot en la Cloud API, no el teléfono>
WHATSAPP_BOT_ACCESS_TOKEN=<token permanente del usuario del sistema>
WHATSAPP_BOT_APP_SECRET=<App Secret de la app de Meta>
WHATSAPP_BOT_VERIFY_TOKEN=<genéralo con: openssl rand -hex 32>
WHATSAPP_BOT_STAFF_MOLOTES=<WhatsApp del personal de Molotes>
WHATSAPP_BOT_STAFF_BIRRIA=<WhatsApp del personal de Birria>
WHATSAPP_BOT_STAFF_TEMPLATE=<nombre de la plantilla aprobada, p. ej. nuevo_pedido>
WHATSAPP_BOT_STAFF_TEMPLATE_LANGUAGE=         # opcional (es_MX)
WHATSAPP_GRAPH_API_VERSION=                   # opcional (v26.0)

# --- Datos ---
DATA_DIR=/var/lib/restaurante                 # ruta absoluta en el disco persistente

# --- Primer administrador (solo se usan si la base no tiene usuarios) ---
ADMIN_USER=<usuario>
ADMIN_PASSWORD_HASH='<salida de npm run admin:hash-password>'

# --- Proxy con TLS delante ---
TRUST_PROXY=true
```

- `WHATSAPP_BOT_WEBHOOK_URL` es solo de Twilio: no la definas.
- Genera `ADMIN_PASSWORD_HASH` con `npm run admin:hash-password` en una máquina con el proyecto
  instalado (en la VM, desde `restaurante/` tras el [paso 5](#5-instalar-y-arrancar)).
  Nunca pongas la contraseña en claro. Tras el primer arranque esas dos variables se ignoran
  (aviso `admin_bootstrap_ignored`) y puedes vaciarlas.
- Si un valor es inválido, la app termina con código 1 y lista los problemas sin mostrar valores.

## 5. Instalar y arrancar

Despliega una versión concreta de `main` con el CI en verde (`calidad` y `docker`). Cómo se
identifican las versiones (etiquetas git o commits) es **a definir**.

```sh
git clone git@github.com:orvigas/negocio.git    # acceso de la VM al repositorio: a definir
cd negocio/restaurante
git checkout <commit o etiqueta>
npm ci --strict-allow-scripts --no-audit --no-fund
npm run db:generate
npm run build:css
npm start                                       # carga .env de esta carpeta si existe
```

- `npm ci` instala también las dependencias de desarrollo: hacen falta para `db:generate`
  (CLI de Prisma) y `build:css` (Tailwind).
- Opcional, igual que el CI: `npm run typecheck` antes de arrancar.
- `npm start` carga el `.env` de `restaurante/`. Si el gestor de procesos inyecta las variables
  de otra forma, `.env` puede no existir.
- El gestor que mantiene el proceso en marcha, lo reinicia ante fallos y al encender la VM, y le
  envía `SIGTERM` para pararlo es **a definir**. Con `SIGTERM` (o `SIGINT`) la app cierra el
  servidor y la base de datos ordenadamente.

## 6. Proxy inverso con TLS

`/admin` exige HTTPS en producción. Con nginx delante, define `TRUST_PROXY=true` y reenvía las
cabeceras como en el ejemplo de [Seguridad de la administración](../README.md#seguridad-1)
(`Host`, `X-Forwarded-Proto` y `X-Forwarded-For` hacia `http://127.0.0.1:3000`).

Sin HTTPS, o sin `TRUST_PROXY=true` detrás del proxy, `/admin` responde 503 y el log registra
`admin_requires_https`. La configuración completa de nginx, el dominio y la obtención y
renovación del certificado son **a definir**.

## 7. Migraciones de la base de datos

No hay un paso manual: **la app aplica las migraciones pendientes al arrancar**
(`src/db/migrate.ts`), cada una en una transacción. En producción no hace falta el CLI de Prisma.

- Log `database_migrated` con las migraciones aplicadas (solo si había alguna).
- Si una falla, la base está dañada o no se puede escribir, la app no arranca (código 1) y
  registra `database_init_failed` con un código.
- **Haz un respaldo de `restaurante.db` antes de cada actualización**
  ([paso 10](#10-copias-de-seguridad)): una base migrada no arranca con el código anterior.

Detalles en [Base de datos](../README.md#base-de-datos).

## 8. Registrar el webhook en Meta

Con la app en marcha detrás de HTTPS:

1. En la app de Meta: **WhatsApp → Configuración → Webhook**.
2. URL de devolución de llamada: `https://<dominio>/webhooks/whatsapp`. Token de verificación: el
   valor de `WHATSAPP_BOT_VERIFY_TOKEN`. Al guardar, Meta hace un `GET` y la app devuelve el reto
   solo si el token coincide (si no, 403 y `bot_webhook_verify_failed` en el log).
3. Suscribe el campo `messages`.

Firma, reintentos y deduplicación en
[Registrar el webhook en Meta](../README.md#registrar-el-webhook-en-meta-producción).

## 9. Comprobaciones después de desplegar

1. **Proceso:** el log (JSON por línea en stdout) muestra `server_started` y, con el bot,
   `bot_provider_selected` con `meta`. En el primer arranque, además, `menu_data_seeded`,
   `products_imported` y `admin_bootstrap_created` (primer administrador).
2. **Landings:** `https://<dominio>/`, `/molotes` y `/birria` responden 200 y `/` muestra el
   negocio del día. Los botones de pedido abren el chat del número del bot.
3. **Administración:** `https://<dominio>/admin` muestra el acceso (no un 503) y se puede entrar.
4. **Webhook:** Meta acepta la verificación del paso 8.
5. **Bot de punta a punta:** escribe al número del bot, haz un pedido de prueba y comprueba que
   el personal del negocio recibe el aviso. Busca en el log `bot_staff_send_failed`,
   `bot_staff_delivery_failed` o `bot_api_error`.
6. **Datos:** `DATA_DIR` contiene `molotes/`, `birria/` y `restaurante.db` en el disco
   persistente.

Vigila después `bot_staff_delivery_failed` (un pedido confirmado que no llegó al personal) y
`bot_webhook_signature_invalid` ([Logs y privacidad](../README.md#logs-y-privacidad)). Dónde se
guardan y consultan los logs en la VM es **a definir**.

## 10. Copias de seguridad

Respaldar `DATA_DIR` es responsabilidad de quien opera la VM. Sin respaldo, perder
`restaurante.db` es perder los usuarios, su auditoría y los productos.

| Qué | Cómo |
| --- | ---- |
| `restaurante.db` (en marcha) | `sqlite3 <DATA_DIR>/restaurante.db ".backup /ruta/respaldo/restaurante-<fecha>.db"`. No copies el archivo en marcha: el respaldo puede quedar incompleto |
| `restaurante.db` (parada) | Copia `restaurante.db` junto con `-wal` y `-shm` si existen |
| JSON de página y registro | Copia `molotes/`, `birria/` y `changes.jsonl` (`changes.jsonl` crece sin límite: rótalo) |
| `.env` de producción | Copia cifrada o en un gestor de secretos, fuera de la VM |

- **Siempre** antes de cada actualización, y además con regularidad.
- **Restaurar:** para la app, reemplaza `restaurante.db` por el respaldo (borra los `-wal` y
  `-shm` sobrantes) y los JSON si hace falta, comprueba dueño y permisos, y arranca.
- Frecuencia, destino (fuera de la VM), retención y prueba periódica de restauración: **a
  definir**.

## 11. Actualizar a una versión nueva

1. Confirma que la versión nueva está en `main` con el CI en verde.
2. Avisa: el reinicio cierra las sesiones de `/admin` y corta las conversaciones del bot.
3. Respalda `restaurante.db` y los JSON ([paso 10](#10-copias-de-seguridad)).
4. Revisa si la versión trae variables nuevas o renombradas (`.env.example` y el README) y
   ajusta el `.env`.
5. Despliega: `git fetch && git checkout <nueva versión>`, `npm ci --strict-allow-scripts`,
   `npm run db:generate`, `npm run build:css` y reinicia el proceso. Anota la versión anterior
   para poder volver.
6. Repite las [comprobaciones](#9-comprobaciones-después-de-desplegar).

## 12. Volver a la versión anterior (rollback)

1. Para la app.
2. Si la versión nueva aplicó migraciones, el código anterior **no arranca** con esa base
   (`DATABASE_NEWER_THAN_CODE`): restaura el respaldo de `restaurante.db` hecho en el paso 3 de
   la actualización. Los cambios hechos en la administración desde entonces se pierden.
3. Los JSON de página sirven tal como están.
4. Arranca la versión anterior: `git checkout <versión anterior>`,
   `npm ci --strict-allow-scripts`, `npm run db:generate`, `npm run build:css` y reinicia el
   proceso.
5. Restaura también el `.env` anterior si lo cambiaste.
6. Repite las [comprobaciones](#9-comprobaciones-después-de-desplegar).

## 13. Recuperar el acceso a `/admin`

Si se pierde la contraseña del último administrador:

```sh
npm run admin:recover -- --usuario <nombre>    # desde restaurante/, con el .env de producción
```

Ver [Recuperar el acceso](../README.md#recuperar-el-acceso).

## 14. Problemas frecuentes

| Síntoma | Causa probable | Qué hacer |
| ------- | -------------- | --------- |
| La app termina con código 1 y una lista de problemas | Configuración inválida (falta `DATA_DIR`, ruta relativa, número mal escrito, variable del bot ausente) | Corrige el `.env` según la lista |
| "twilio no se permite con NODE_ENV=production" | `.env` de desarrollo copiado a producción | `WHATSAPP_BOT_PROVIDER=meta` y sus variables |
| `database_init_failed` | Sin permisos en `DATA_DIR`, base dañada, migración fallida o base más nueva que el código | Revisa dueño y permisos; restaura el respaldo si hace falta |
| `/admin` responde 503 y `admin_requires_https` | Acceso por HTTP o falta `TRUST_PROXY=true` / `X-Forwarded-Proto` | Revisa el proxy ([paso 6](#6-proxy-inverso-con-tls)) |
| `/admin` responde 503 "no disponible" y `admin_disabled` al arrancar | La base no tiene usuarios ni `ADMIN_USER`/`ADMIN_PASSWORD_HASH` | Define las dos variables o usa `admin:recover` |
| Meta no verifica el webhook (403) | `WHATSAPP_BOT_VERIFY_TOKEN` no coincide con el de Meta | Usa el mismo valor en los dos lados |
| `bot_webhook_signature_invalid` | `WHATSAPP_BOT_APP_SECRET` no es el de la app de Meta | Corrige el secreto y reinicia |
| `bot_staff_delivery_failed` | Plantilla pausada o número del personal sin WhatsApp | Revisa la plantilla en el Administrador de WhatsApp; el pedido pudo perderse |

## Pendientes a definir

Datos de la infraestructura de producción que no están en el repositorio:

1. Proveedor y sistema operativo de la VM.
2. Gestor del proceso (reinicio ante fallos y al encender la VM) y usuario del sistema que
   ejecuta la app.
3. Dominio, configuración completa de nginx y certificado TLS (emisión y renovación).
4. Firewall: puertos abiertos (solo 80/443 hacia el proxy).
5. Ruta de `DATA_DIR` en el disco persistente.
6. Cómo llega el código a la VM (p. ej. clon con clave de despliegue) y cómo se identifican las
   versiones (etiquetas o commits).
7. Dónde se guarda el `.env` de producción y la copia de sus secretos.
8. Copias de seguridad: frecuencia, destino fuera de la VM, retención y prueba de restauración.
9. Dónde se guardan, rotan y consultan los logs (stdout de la app y `changes.jsonl`).
10. Datos de Meta del [paso 2](#2-prerrequisitos-de-meta): siguen pendientes hasta la prueba de
    punta a punta con Meta.
