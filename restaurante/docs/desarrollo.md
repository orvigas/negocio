# Entorno de desarrollo

Guía paso a paso para trabajar en `restaurante/` desde tu computadora: instalar, configurar,
arrancar, comprobar la calidad y probar el bot de WhatsApp (con el simulador o con el sandbox de
Twilio). Los detalles de cada tema están en el [README](../README.md); esta guía los ordena y
enlaza.

Todos los comandos se ejecutan desde la carpeta `restaurante/` salvo que se indique otra cosa.

## 1. Requisitos

| Herramienta | Para qué | Notas |
| ----------- | -------- | ----- |
| Node.js >= 24.3 | Ejecutar la app, las pruebas y los scripts | Versión en `.nvmrc` (`24`); con nvm: `nvm use`. Las versiones 24.0 a 24.2 funcionan, pero escriben un `ExperimentalWarning` en cada arranque |
| npm | Dependencias y scripts | El que trae Node 24 |
| git | Clonar y trabajar en ramas | |
| Docker con Compose v2 | **MySQL 8.4 local** (`npm run db:up`), pruebas en contenedor y build de las imágenes | Sin Docker necesitas un MySQL 8.4 propio con utf8mb4 y `utf8mb4_es_0900_as_cs` (ver el [paso 4](#4-mysql-local-y-carpeta-de-datos-data_dir)) |
| `cloudflared` o `ngrok` | Opcional: solo para probar el bot real con Twilio | Ver el [paso 8](#8-bot-real-con-el-sandbox-de-twilio) |
| Python 3 + Pillow | Opcional: solo para regenerar los iconos | Ver [Iconos](../README.md#iconos-favicons-y-pantalla-de-inicio) |

## 2. Clonar e instalar

```sh
git clone git@github.com:orvigas/negocio.git
cd negocio/restaurante
nvm use                               # o asegúrate de tener Node >= 24.3
npm ci --strict-allow-scripts         # mismas dependencias que el lockfile, igual que CI y Docker
npm run db:generate                   # cliente de Prisma en src/generated/prisma (no se versiona)
npm run db:up                         # MySQL 8.4 local (ver el paso 4)
```

- `npm ci` instala exactamente lo que dice `package-lock.json`. Usa `npm install` solo cuando
  vayas a agregar o actualizar una dependencia (y justifícala según
  `.claude/rules/dependencias.md`).
- Solo se ejecutan los scripts de instalación aprobados en `allowScripts` de `package.json`. Si una
  dependencia nueva trae uno, `--strict-allow-scripts` falla hasta revisarlo (ver
  [Puesta en marcha](../README.md#puesta-en-marcha)).
- Repite `npm run db:generate` después de cambiar `prisma/schema.prisma` o de actualizar
  `@prisma/client`. Sin el cliente generado fallan `typecheck`, `lint`, `test` y `dev`.

## 3. Configurar `.env`

```sh
cp .env.example .env
```

`.env` no se versiona (está en `.gitignore` y en `.dockerignore`). Cada variable está explicada
en `.env.example` y en [Configuración](../README.md#configuración). Para empezar basta con:

```sh
NODE_ENV=development
WHATSAPP_MOLOTES=<número internacional, solo dígitos>
WHATSAPP_BIRRIA=<número internacional, solo dígitos>
DATABASE_URL=mysql://restaurante_app:app-dev@127.0.0.1:3307/restaurante
MIGRATION_DATABASE_URL=mysql://restaurante_migrator:migrator-dev@127.0.0.1:3307/restaurante
SHADOW_DATABASE_URL=mysql://restaurante_migrator:migrator-dev@127.0.0.1:3307/restaurante_shadow
```

- Las tres URL de la base ya vienen así en `.env.example` y apuntan al MySQL local del paso 4
  (credenciales de desarrollo, no secretas). `DATABASE_URL` es obligatoria: sin ella la app no
  arranca. Si cambias la contraseña, codifica los caracteres especiales (`@` -> `%40`).

- Deja vacías las variables `WHATSAPP_BOT_*`: con todas vacías el bot queda deshabilitado y las
  landings funcionan igual (el webhook responde 503).
- **Primer administrador de `/admin`** (opcional): genera el hash con
  `npm run admin:hash-password` (pide la contraseña sin mostrarla, mínimo 12 caracteres) y
  rellena `ADMIN_USER` y `ADMIN_PASSWORD_HASH`. Escribe el hash **entre comillas simples**
  (`ADMIN_PASSWORD_HASH='scrypt$...'`) para que Docker Compose no interprete los `$`. Solo se usa
  si la base de datos no tiene usuarios.
- Si la app no arranca, termina con código 1 y lista los problemas de configuración (sin mostrar
  valores). Corrige `.env` y vuelve a arrancar.

## 4. MySQL local y carpeta de datos (`DATA_DIR`)

La base de datos es MySQL 8.4 (usuarios de `/admin` y productos). `compose.yaml` trae uno local:

```sh
npm run db:up        # levanta mysql-dev (Docker), solo en 127.0.0.1:3307, y espera a que esté listo
npm run db:migrate   # aplica las migraciones (prisma migrate deploy con MIGRATION_DATABASE_URL)
npm run db:down      # lo detiene (los datos quedan en el volumen mysql-dev-data)
```

- El primer `db:up` crea (con `docker/mysql/initdb/01-usuarios.sh`) la base `restaurante` en
  utf8mb4 con `utf8mb4_es_0900_as_cs`, la base sombra `restaurante_shadow` y los usuarios
  `restaurante_app` (solo datos: el de la app), `restaurante_migrator` (DDL: migraciones) y los de
  las pruebas. Solo escucha en `127.0.0.1`: nunca es accesible desde otra máquina.
- La app **no migra**: si falta una migración, no arranca (`database_init_failed` con
  `MIGRATIONS_PENDING`). Ejecuta `npm run db:migrate` después de cada `git pull` que traiga
  migraciones nuevas.
- **Empezar de cero:** `docker compose down -v` borra el volumen (pierdes los usuarios y
  productos locales); después `npm run db:up` y `npm run db:migrate`.
- **Sin Docker:** un MySQL 8.4 propio con `character-set-server=utf8mb4`,
  `collation-server=utf8mb4_es_0900_as_cs` y modo estricto, y los mismos usuarios que crea
  `docker/mysql/initdb/01-usuarios.sh`.

`DATA_DIR` vacío usa la carpeta `data/` del proyecto (ignorada por git). Ahí se guardan los JSON
de página de cada negocio y `changes.jsonl`. Estructura y reglas en
[Archivos de datos](../README.md#archivos-de-datos-data_dir) y
[Base de datos](../README.md#base-de-datos).

- En el primer arranque se crea sola: copia la semilla de cada negocio, y los productos se
  importan a la base una sola vez.
- Para experimentar sin tocar tus datos, apunta `DATA_DIR` a otra ruta absoluta (fuera de `src/`
  y de `public/`).
- **Nunca** apuntes `DATABASE_URL` ni `MIGRATION_DATABASE_URL` a una base de producción mientras
  desarrollas.
- Las pruebas no usan `data/` ni la base `restaurante`: usan sus propias bases `restaurante_test_*`
  ([paso 6](#6-comprobar-la-calidad-antes-de-terminar)).

## 5. Compilar el CSS y arrancar

```sh
npm run build:css   # genera public/css/{molotes,birria,admin}/main.css (no se versiona)
npm run dev         # servidor con recarga en http://127.0.0.1:3000
```

| URL | Qué muestra |
| --- | ----------- |
| `http://127.0.0.1:3000/` | Landing del día según `BUSINESS_TIMEZONE` (L-V Molotes, S-D Birria) |
| `http://127.0.0.1:3000/molotes` y `/birria` | Cada landing, siempre |
| `http://127.0.0.1:3000/admin` | Administración (necesita el primer administrador del paso 3) |

- `npm run dev` reinicia al editar cualquier `.ts` importado. Un reinicio cierra las sesiones de
  `/admin` y borra las conversaciones del bot (están en memoria).
- `npm run dev` arranca siempre con `NODE_ENV=development`, aunque el `.env` diga otra cosa.
  `npm start` no lo fija: lo toma del `.env` o del entorno, y sin él la app no arranca.
- La app solo escucha en `127.0.0.1` (esta máquina). Para probarla desde otro dispositivo de tu
  red (p. ej. el móvil), define `HOST=0.0.0.0` en `.env` y abre `http://<IP de tu equipo>:3000`.
  `HOST` solo admite IP literales: `localhost` no es válido.
- Si editas estilos o clases en plantillas, vuelve a ejecutar `npm run build:css` o deja
  `npm run watch:css` corriendo en otra terminal.
- Los logs son JSON por línea en la terminal. Al arrancar verás `server_started` (y
  `database_waiting` si MySQL todavía estaba arrancando).
- ¿Perdiste la contraseña del administrador local? `npm run admin:recover -- --usuario <nombre>`
  (ver [Recuperar el acceso](../README.md#recuperar-el-acceso)).

## 6. Comprobar la calidad antes de terminar

Los mismos pasos que la comprobación `calidad` del [CI](../README.md#ci):

```sh
npm run typecheck   # debe terminar con 0
npm run lint        # debe terminar con 0, sin errores ni avisos (lint:fix aplica correcciones)
npm run build:css   # las pruebas leen el CSS generado
npm run db:up       # MySQL local (si no está en marcha)
npm test            # suite completa (Vitest) contra MySQL 8.4
```

- Las pruebas usan MySQL real con sus propias bases `restaurante_test_*` (nunca la de desarrollo
  ni una real; una salvaguarda lo impide). Sin MySQL, `npm test` falla y dice cómo levantarlo.
  Detalles en [Pruebas con base de datos](../README.md#pruebas-con-base-de-datos).

- Para reproducir el CI completo, incluido el build de la imagen, ver
  [Reproducirlo en local](../README.md#reproducirlo-en-local).
- Pruebas en contenedor, sin Node instalado: `docker compose run --rm test` (ver
  [Pruebas](../README.md#pruebas)).
- Las pruebas HTTP siguen la regla de [Pruebas HTTP](../README.md#pruebas-http-servidor-en-127001)
  (`listenLocal`, nunca `app.callback()`).
- **Cambios en la base de datos:** edita `prisma/schema.prisma` (con la longitud de cada texto),
  ejecuta `npm run db:migrate:dev -- --name <nombre>` contra el MySQL local, **revisa a mano** el
  `migration.sql` (cambia `utf8mb4_unicode_ci` por `utf8mb4_es_0900_as_cs` en cada
  `CREATE TABLE`), y después `npm run db:migrate` y `npm run db:generate`. Versiona la carpeta
  nueva de `prisma/migrations/` y nunca edites una migración ya aplicada.

## 7. Bot de WhatsApp sin cuentas: `bot:chat`

Para probar la conversación no necesitas Meta ni Twilio:

```sh
npm run bot:chat                              # simula Meta, hora actual
npm run bot:chat -- --ahora 2026-10-09T16:00  # fija la hora del negocio
npm run bot:chat -- --proveedor twilio        # simula Twilio
```

No usa tu `.env` ni `DATA_DIR`, y ninguna petición sale a internet. Comandos y detalles en
[Probar el bot en local](../README.md#probar-el-bot-en-local).

## 8. Bot real con el sandbox de Twilio

Para recibir y enviar mensajes reales de WhatsApp desde tu computadora, sin la cuenta de Meta.
Twilio es **solo para desarrollo**: con `NODE_ENV=production` y `WHATSAPP_BOT_PROVIDER=twilio`
la app no arranca. Referencia completa en [Twilio (desarrollo)](../README.md#twilio-desarrollo).

### 8.1 Preparar la cuenta de Twilio

1. Crea o usa una cuenta de Twilio y activa el sandbox de WhatsApp: Console → **Messaging** →
   **Try it out** → **Send a WhatsApp message**.
2. Copia el **Account SID** y el **Auth Token** (Console → Account info). El Auth Token es
   secreto: solo va en tu `.env`, nunca en el repositorio, en un ticket ni en el chat.
3. Desde tu teléfono de prueba **y desde los teléfonos del personal**, envía al número del
   sandbox (+1 415 523 8886) el mensaje `join <palabra>` que muestra la consola. La unión caduca
   a los pocos días: si un teléfono deja de recibir mensajes, repite el `join`.
4. Pide al personal que le escriba algo al sandbox antes de probar: el aviso del pedido va como
   texto libre y solo se entrega si escribió en las últimas 24 h.

### 8.2 Abrir el túnel HTTPS

Twilio necesita una URL pública con HTTPS que llegue a tu `127.0.0.1:3000`. En otra terminal:

```sh
cloudflared tunnel --url http://127.0.0.1:3000
```

Copia la URL `https://<algo>.trycloudflare.com` que imprime. **Cambia en cada reinicio del
túnel.** Con `ngrok http 3000` funciona igual.

El túnel publica toda la app, incluida `/admin`: ciérralo cuando termines.

### 8.3 Variables en `.env`

```sh
WHATSAPP_MOLOTES=14155238886          # número del sandbox: emisor del bot y chat de los botones
WHATSAPP_BIRRIA=14155238886           # el mismo número
WHATSAPP_BOT_PROVIDER=twilio
WHATSAPP_BOT_ACCOUNT_ID=<Account SID, AC...>
WHATSAPP_BOT_ACCESS_TOKEN=<Auth Token>
WHATSAPP_BOT_STAFF_MOLOTES=<WhatsApp del personal de Molotes, solo dígitos>
WHATSAPP_BOT_STAFF_BIRRIA=<WhatsApp del personal de Birria, solo dígitos>
WHATSAPP_BOT_WEBHOOK_URL=https://<túnel>/webhooks/whatsapp
```

- `WHATSAPP_MOLOTES` y `WHATSAPP_BIRRIA` deben ser **el mismo número** y `WHATSAPP_MOLOTES`
  debe estar como número (no solo como `_URL`): si no, la app no arranca. Con el sandbox ese
  número es `14155238886`; con otro, Twilio no acepta los envíos del bot.
- Las variables que solo usa Meta (`WHATSAPP_BOT_APP_SECRET`, `WHATSAPP_BOT_VERIFY_TOKEN`, …) se
  ignoran con Twilio.
- `WHATSAPP_BOT_STAFF_TEMPLATE` queda vacía: el sandbox no admite plantillas propias.
- Para volver a las landings sin bot, vacía todas las `WHATSAPP_BOT_*` y restaura tus números.

### 8.4 Configurar el webhook en Twilio

1. En Console → **Messaging** → **Try it out** → **Send a WhatsApp message**, abre la pestaña
   **Sandbox settings**.
2. En **"When a message comes in"** pon exactamente la misma URL que en
   `WHATSAPP_BOT_WEBHOOK_URL` (`https://<túnel>/webhooks/whatsapp`), método **POST**, y guarda.
3. "Status callback URL" puede quedar vacía: el bot pide su propio `StatusCallback` a esa URL.

### 8.5 Arrancar y probar

```sh
npm run dev
```

1. En el log debe aparecer `bot_provider_selected` con el proveedor `twilio`.
2. Escribe al sandbox desde tu teléfono de prueba: el bot responde con el negocio del día.
3. Haz un pedido completo y comprueba que el personal recibe el aviso.

**Cada vez que cambie la URL del túnel** actualiza las dos cosas (`WHATSAPP_BOT_WEBHOOK_URL` en
`.env` y "When a message comes in" en Twilio) y reinicia `npm run dev`. Si solo cambias una, el
webhook responde 403.

### 8.6 Problemas frecuentes

| Síntoma | Causa probable | Qué hacer |
| ------- | -------------- | --------- |
| La app no arranca: "WHATSAPP_MOLOTES y WHATSAPP_BIRRIA deben ser el mismo número" | Con el bot habilitado, los dos números difieren | Pon el número del sandbox (`14155238886`) en los dos |
| La app no arranca: "Con twilio, WHATSAPP_MOLOTES es obligatoria como número" | Solo definiste `WHATSAPP_MOLOTES_URL` | Define `WHATSAPP_MOLOTES` con el número del sandbox |
| La app no arranca: "`WHATSAPP_BOT_WEBHOOK_URL` no es válida" | Falta `https://`, la ruta no termina en `/webhooks/whatsapp` o lleva query | Copia la URL del túnel y agrega `/webhooks/whatsapp` |
| La app no arranca: "`WHATSAPP_BOT_PHONE_NUMBER_ID` ya no se usa" | Variable antigua en `.env` | Renómbrala a `WHATSAPP_BOT_ACCOUNT_ID` |
| La app no arranca: "twilio no se permite con NODE_ENV=production" | `npm start` con `NODE_ENV=production` en tu `.env` | Usa `npm run dev` (siempre `development`) o `NODE_ENV=development` |
| La app no arranca: "NODE_ENV es obligatorio" | `npm start` sin `NODE_ENV` en el `.env` ni en el entorno | Usa `npm run dev` o define `NODE_ENV=development` en `.env` |
| La app no arranca: "HOST debe ser una IP literal IPv4 o IPv6" | `HOST=localhost` u otro nombre en `.env`, o un `HOST` exportado por tu shell (p. ej. `tcsh` exporta el nombre de la máquina) | Usa `127.0.0.1` (o `0.0.0.0` para tu red), o `unset HOST` en la terminal |
| El bot no contesta y en el log no aparece nada | El túnel se cerró, la app no corre o la URL de Twilio es otra | Revisa el túnel y la URL de "When a message comes in" |
| `bot_webhook_signature_invalid` (403) | La URL del túnel cambió y una de las dos no se actualizó, o no coinciden letra por letra | Actualiza `.env` y Twilio con la misma URL y reinicia |
| `GET /webhooks/whatsapp` responde 405 | Normal con Twilio: no verifica el webhook por `GET` | Nada |
| `bot_api_error` con `status` 401 y `errorCode` 20003 | Twilio rechazó la autenticación del envío. Puede ser un SID o token que no corresponden, **o una restricción de la cuenta de Twilio** (fue el caso al configurarlo): no siempre son las credenciales | Comprueba que SID y token son de la misma cuenta; si lo son, revisa el estado de la cuenta en la consola de Twilio o con su soporte |
| `bot_staff_send_failed` o `bot_staff_delivery_failed` | El personal no está unido al sandbox o no escribió en las últimas 24 h | Que el personal repita `join <palabra>` y escriba al sandbox; el cliente recibe el contacto directo mientras tanto |
| Un teléfono dejó de recibir mensajes | La unión al sandbox caducó | Repite `join <palabra>` desde ese teléfono |
| La conversación empezó de nuevo sola | La app se reinició (`node --watch` al editar código): el estado está en memoria | Vuelve a escribir |

Los logs nunca muestran el texto de los mensajes, los tokens ni el Account SID; el número del
cliente va enmascarado (ver [Logs y privacidad](../README.md#logs-y-privacidad)).
