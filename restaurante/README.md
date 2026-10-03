# Restaurante — Moloteando / Birriería El Muñeco

> **Estado:** ambas landings implementan el diseño de `../_stich_source_/`
> (`moloteando_aut_nticos_molotes_artesanales` y
> `birrier_a_el_mu_eco_aut_ntica_birria_de_res_color_adobo`), con ruta automática por día
> y rutas dedicadas por negocio.

Aplicación Koa.js (Node.js 24 LTS) que sirve dos landing pages desde un mismo proyecto:

- **Moloteando (molotes)**: lunes a viernes.
- **Birriería El Muñeco (birria)**: sábado y domingo.

El día se calcula en la zona horaria del negocio (`BUSINESS_TIMEZONE`), no en la del
servidor. Cada landing tiene un CTA de pedido por WhatsApp configurable. El contenido estático
vive en `src/content/`; los menús, precios, showcase del hero y promociones se editan desde
`/admin/molotes` y `/admin/birria` y se guardan en archivos JSON (ver
[Administración de menús](#administración-de-menús)).

## Requisitos

- Node.js >= 24 (ver `.nvmrc`; con nvm: `nvm use`)
- npm
- Opcional: Docker con Compose v2 para ejecutar las pruebas o construir la imagen sin
  instalar Node (ver [Docker](#docker)).

## Puesta en marcha

```sh
nvm use
npm install
cp .env.example .env   # completa al menos WHATSAPP_MOLOTES(_URL) y WHATSAPP_BIRRIA(_URL)
npm run admin:hash-password   # opcional: genera ADMIN_PASSWORD_HASH para habilitar /admin
npm run build:css
npm run dev            # http://localhost:3000 (administración: http://localhost:3000/admin)
```

En la primera ejecución se crea la carpeta de datos (`DATA_DIR`, por defecto `data/`) con
una copia de la semilla de cada negocio.

## Scripts

| Script               | Descripción                                                 |
| -------------------- | ----------------------------------------------------------- |
| `npm start`          | Inicia el servidor (carga `.env` si existe)                 |
| `npm run dev`        | Servidor con recarga (`node --watch`)                       |
| `npm run build:css`  | Compila el CSS de ambas landings y de la administración (`build:css:molotes`, `build:css:birria`, `build:css:admin`) |
| `npm run watch:css`  | Compilación de CSS en modo observación                      |
| `npm run admin:hash-password` | Pide la contraseña de administración (sin mostrarla) e imprime el valor de `ADMIN_PASSWORD_HASH` |
| `npm test`           | Tests unitarios e integración (Vitest + Supertest) |
| `npm run test:watch` | Vitest en modo observación                                  |
| `npm run lint`       | Pendiente de configurar                                     |

## Docker

Opcional. El despliegue actual en la VM **no cambia** (Node + nginx, sin contenedores) y las
instrucciones sin Docker siguen vigentes. Los archivos están en esta carpeta: `Dockerfile`,
`.dockerignore` y `compose.yaml`.

El `Dockerfile` es multi-stage y todas las etapas parten de `node:24-alpine` (flotante dentro de
la versión 24: una reconstrucción puede traer un parche más reciente de Node o Alpine):

| Etapa        | Contenido                                                                      |
| ------------ | ------------------------------------------------------------------------------ |
| `base`       | Imagen base y directorio de trabajo (`/app`)                                   |
| `deps`       | `npm ci` con solo `package.json` y `package-lock.json` (caché de dependencias) |
| `build`      | Código + `npm run build:css` (si Tailwind falla, el build de la imagen falla)  |
| `test`       | `build` + diseño fuente; comando por defecto `npm test`                        |
| `production` | Dependencias de producción, `src/` y `public/` con el CSS compilado; usuario `node` |

El `.dockerignore` deja fuera `node_modules/`, `.env*` (salvo `.env.example`), `data/`, el CSS
generado localmente, logs, cobertura y `.git`: ningún secreto ni dato editable entra en las
imágenes.

### Pruebas

```sh
docker compose run --rm test   # código de salida 0 si todo pasa; distinto de 0 si algo falla
```

- Construye el target `test` en cada ejecución (`pull_policy: build`; gracias a la caché solo se
  repiten las capas afectadas) y ejecuta `vitest run` completo, sin red (`network_mode: none`).
- El código va dentro de la imagen (sin volúmenes): los cambios locales se incluyen al
  reconstruir automáticamente.
- Las pruebas de contenido comparan la semilla con `../_stich_source_/`, que compose pasa como
  contexto adicional `design` (solo entra en la imagen de pruebas). Sin compose:
  `docker build --target test --build-context design=../_stich_source_ -t restaurante:test .`
- El contenedor usa UTC; no afecta a la selección de landing, que usa `BUSINESS_TIMEZONE`.
- Compose lee el `.env` de esta carpeta solo para interpolar variables (no lo pasa al
  contenedor). Si `ADMIN_PASSWORD_HASH` está sin comillas, Compose interpreta cada `$` del hash
  y muestra avisos `variable is not set` con fragmentos del hash. Escríbelo entre comillas
  simples (`ADMIN_PASSWORD_HASH='scrypt$...'`, Node lo lee igual) o ejecuta
  `COMPOSE_DISABLE_ENV_FILE=true docker compose run --rm test`.
- Otra arquitectura (p. ej. amd64 en Apple Silicon):
  `DOCKER_DEFAULT_PLATFORM=linux/amd64 docker compose run --rm test`.

### Producción

```sh
docker build --target production -t restaurante:prod .
docker volume create restaurante-data
docker run -d --name restaurante -p 3000:3000 \
  -e WHATSAPP_MOLOTES=5215512345678 -e WHATSAPP_BIRRIA=5215512345678 \
  -e DATA_DIR=/var/lib/restaurante -v restaurante-data:/var/lib/restaurante \
  restaurante:prod
```

- La configuración se inyecta **al ejecutar** (`-e` o `--env-file .env`), nunca en el build. Se
  valida igual que sin Docker: si falta una variable obligatoria (`WHATSAPP_*`, `DATA_DIR`), el
  contenedor termina con código 1 y lista los problemas sin mostrar valores.
- `NODE_ENV=production` y `PORT=3000` vienen definidos en la imagen; la app corre con el usuario
  `node` (UID 1000) y el código es de solo lectura para él.
- `DATA_DIR` debe ser una ruta absoluta montada como volumen; `/var/lib/restaurante` ya existe
  en la imagen con dueño `node`, así que un volumen con nombre montado ahí funciona sin más. Con
  un bind mount del host, la carpeta debe ser escribible por el UID 1000. En el primer arranque
  se copia la semilla (log `menu_data_seeded`).
- `HEALTHCHECK`: cada 30 s pide `GET /` con el `wget` de la imagen
  (`docker inspect -f '{{.State.Health.Status}}' restaurante` -> `healthy`). Cada comprobación
  aparece como una línea `request` en el log.
- `docker stop` envía `SIGTERM` y la app cierra el servidor ordenadamente.
- `/admin` exige HTTPS en producción (ver [Seguridad](#seguridad)): un despliegue con Docker
  necesita un proxy con TLS y `TRUST_PROXY=true`, fuera del alcance actual.

## Configuración

La configuración se lee y valida al arrancar (`src/config/env.js`). Si algo es
inválido, el proceso termina con código 1 y lista los problemas (sin mostrar los valores).

| Variable                   | Obligatoria             | Descripción                                                        |
| -------------------------- | ----------------------- | ------------------------------------------------------------------ |
| `NODE_ENV`                 | No (`development`)      | `development`, `production` o `test`                               |
| `PORT`                     | No (`3000`)             | Puerto HTTP (1-65535)                                              |
| `BUSINESS_TIMEZONE`        | No (`America/Mexico_City`) | Zona horaria IANA del negocio, validada con `Intl`              |
| `SITE_URL`                 | No                      | URL pública (http/https, sin query ni fragmento). Hace absolutas la canónica, `og:url` y `og:image`; sin ella la canónica es relativa y se omiten `og:url`/`og:image` |
| `WHATSAPP_MOLOTES_URL`     | Esta o el número        | Enlace https del bot de Molotes; tiene prioridad sobre el número   |
| `WHATSAPP_MOLOTES`         | Esta o la URL           | Número internacional, solo dígitos (8-15)                          |
| `WHATSAPP_MOLOTES_MESSAGE` | No                      | Mensaje inicial (máx. 500), se añade a `wa.me` como `?text=`       |
| `WHATSAPP_BIRRIA_URL`      | Esta o el número        | Igual que arriba, para Birria                                      |
| `WHATSAPP_BIRRIA`          | Esta o la URL           | Igual que arriba, para Birria                                      |
| `WHATSAPP_BIRRIA_MESSAGE`  | No                      | Igual que arriba, para Birria                                      |
| `DATA_DIR`                 | Solo en producción (ruta absoluta) | Carpeta de los datos editables (por defecto `data/` del proyecto fuera de producción). No puede estar dentro de `src/` ni de `public/` |
| `ADMIN_USER`               | No                      | Usuario común de la administración (máx. 60). Sin `ADMIN_USER` ni `ADMIN_PASSWORD_HASH`, `/admin` responde 503 "no disponible"; con solo una de las dos, la app no arranca |
| `ADMIN_PASSWORD_HASH`      | No                      | Hash scrypt de la contraseña (`npm run admin:hash-password`). Nunca la contraseña en claro |
| `TRUST_PROXY`              | No (`false`)            | `true` detrás de nginx con TLS: Koa usa `X-Forwarded-Proto` (HTTPS) y la última IP de `X-Forwarded-For` (límite de intentos) |

## HTTP

| Ruta             | Respuesta                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------ |
| `GET /`          | Landing activa según el día en `BUSINESS_TIMEZONE`: L-V Moloteando, S-D Birriería El Muñeco |
| `GET /molotes`   | Landing de Moloteando, siempre                                                             |
| `GET /birria`    | Landing de Birriería El Muñeco, siempre                                                    |
| `GET /favicon.ico`, `GET /apple-touch-icon.png`, `GET /apple-touch-icon-precomposed.png` | Icono del negocio activo del día (ver [Iconos](#iconos-favicons-y-pantalla-de-inicio)) |
| `GET /molotes.webmanifest`, `GET /birria.webmanifest` | Web App Manifest de cada negocio                                  |
| `GET /<archivo>` | Estáticos de `public/` (sin índices ni archivos ocultos)                                   |
| `/admin/...`     | Administración de menús (ver [Administración de menús](#administración-de-menús))          |

Las tres rutas HTML usan el mismo controlador (`src/controllers/landing.js`): con un
`businessId` fijo renderiza ese negocio y sin él lo resuelve por fecha. Responden con
`Cache-Control: no-cache`. La `<link rel="canonical">` siempre apunta a la ruta dedicada
(`/` muestra la canónica del negocio del día), así que no hay contenido duplicado para SEO.
Cualquier otra ruta responde 404 y los métodos distintos de GET/HEAD, 405 (salvo los POST de
la administración).

Los errores responden JSON con formato común:

```json
{ "error": { "code": "NOT_FOUND", "message": "Not Found" } }
```

Los errores 5xx usan un mensaje genérico; el stack solo se incluye con `NODE_ENV=development`.
Los logs son JSON por línea en stdout (método, ruta sin query string, estado y duración).

## Menús

Los datos editables de cada landing viven en un documento JSON por negocio:

| Negocio  | Datos editables | Semilla versionada |
| -------- | --------------- | ------------------ |
| Molotes  | 8 molotes y 2 bebidas (nombre, descripción, badge, tono, precios, cantidad por orden, disponibilidad e imagen), texto destacado del menú, showcase del hero (etiqueta, título, descripción, precio y unidad) y promoción "Jueves de Molotes 2x1" (badge, título y descripción) | `src/content/molotes/seed.json` |
| Birria   | 6 platillos (nombre, etiqueta, precio, unidad, descripción, disponibilidad, imagen, título del detalle y chips, porción o variantes), showcase del hero (título, descripción y precio) y promoción del Club (badge, título y descripción) | `src/content/birria/seed.json` |

- Las semillas tienen los datos originales del diseño fuente; `tests/unit/content.test.js`
  comprueba que coincidan con `../_stich_source_/` y que sus fotos existan.
- El esquema (campos, longitudes máximas, tonos, rangos y estructura) está en
  `src/services/menu-schema.js`. Precios en centavos (enteros), mayores que $0 y hasta
  $5,000.00; el formato (`$45 c/u`, `$155 MXN`, `$45.50`) se aplica en `src/views/landings/`.
- La estructura no es editable: cantidad y orden de productos, chips y variantes, el `id` de
  cada molote y bebida, el `slug` de cada platillo de Birria y su tipo de detalle.
- Disponibilidad: lo no disponible se oculta (`src/services/visible-menu.js`). En Birria, la
  variante activa es la primera disponible y de ella salen el precio y la descripción de la
  tarjeta; un platillo sin variantes disponibles se oculta. Si una sección se queda sin
  productos, conserva su encabezado y muestra un aviso con el CTA de WhatsApp.
- En Birria, `slug` forma los id del DOM (`card-`, `title-`, `price-`, `desc-`, `variants-`)
  que usa el selector de variantes (`public/js/modules/variant-selector.js`).
- La landing lee los datos del repositorio de menús (`src/repositories/`), que los mantiene
  en memoria: los cambios guardados desde la administración se ven en la siguiente petición.

## Administración de menús

`/admin/molotes` y `/admin/birria` permiten editar los datos de la sección anterior con
formularios HTML (sin JavaScript). No hay diseño en `_stich_source_/` para estas páginas: la
interfaz es sencilla, con su propia hoja (`public/css/admin/main.css`).

| Ruta | Acción |
| ---- | ------ |
| `GET /admin` | Redirige a `/admin/molotes` |
| `GET` / `POST /admin/login` | Acceso con el usuario y la contraseña comunes |
| `POST /admin/logout` | Cierre de sesión |
| `GET` / `POST /admin/<negocio>` | Formulario y guardado (POST-redirect-GET) |
| `GET` / `POST /admin/<negocio>/restaurar-anterior` | Confirmación y restauración de la versión anterior |
| `POST /admin/<negocio>/restaurar-semilla` | Solo con datos dañados: vuelve a la semilla |

### Seguridad

- Sesión en memoria con cookie `admin_sid` (`HttpOnly`, `SameSite=Strict`, `Path=/admin` y
  `Secure` en producción). Caduca tras 2 horas sin actividad; un reinicio cierra las sesiones.
- 5 intentos de acceso fallidos desde la misma IP la bloquean 15 minutos.
- Todas las acciones son POST con token CSRF (control principal) y comprobación de
  `Origin`/`Sec-Fetch-Site`: se rechazan los orígenes ajenos y `Sec-Fetch-Site` distinto de
  `same-origin`; `Origin: null` solo se acepta si el navegador confirma `Sec-Fetch-Site: same-origin`.
  Las páginas de `/admin` envían `Referrer-Policy: same-origin` (las landings mantienen
  `no-referrer`) para que el navegador mande el `Origin` real en sus formularios.
- Las respuestas de `/admin` llevan `Cache-Control: no-store` y `X-Robots-Tag: noindex, nofollow`;
  las landings no enlazan a `/admin`.
- En producción solo funciona por HTTPS. Con nginx y TLS delante, define `TRUST_PROXY=true` y
  reenvía las cabeceras:

  ```nginx
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $remote_addr;
  }
  ```

  Sin HTTPS (o sin `TRUST_PROXY` detrás del proxy), `/admin` responde 503 y el log registra
  `admin_requires_https`.
- Las credenciales, el hash, los tokens y el contenido de los menús no se escriben en los logs.

### Archivos de datos (`DATA_DIR`)

```text
DATA_DIR/
├── molotes/
│   ├── current.json            # versión vigente
│   ├── previous.json           # versión anterior (una por negocio)
│   ├── damaged-<fecha>.json    # archivo dañado aislado para revisarlo
│   └── damaged.marker.json     # existe mientras los datos estén dañados y nadie elija una opción
├── birria/ (igual)
└── changes.jsonl               # registro de cambios: una línea JSON por guardado o restauración
```

- **Primera ejecución:** si no existe `current.json`, se copia la semilla a `current.json` y
  `previous.json` (log `menu_data_seeded`).
- **Guardado:** el contenido vigente pasa a `previous.json` y el nuevo se escribe de forma
  atómica (archivo temporal, `fsync` y `rename`): un fallo nunca deja el archivo a medias.
- **Registro (`changes.jsonl`):** fecha ISO en la zona del negocio, autor ("Nombre de quien
  hace el cambio", obligatorio), negocio, acción (`save`, `overwrite_after_conflict`,
  `restore_previous`, `restore_seed`) y campos modificados con su valor anterior y el nuevo.
  La página solo muestra "Último cambio: <fecha> por <nombre>". El archivo crece sin límite:
  rótalo o respáldalo con las herramientas de la VM.
- **Edición simultánea:** cada formulario lleva la versión con la que empezó. Si otra persona
  guardó antes, no se escribe nada y se ofrece "Guardar mis cambios de todos modos" o
  "Descartar y cargar la versión actual".
- **Restaurar versión anterior:** intercambia `current.json` y `previous.json` (se puede
  deshacer repitiendo la acción).
- **Ediciones manuales:** editar los JSON a mano se aplica al reiniciar el servidor. La vía
  recomendada es la administración; si se guarda desde ella antes de reiniciar, la edición
  manual queda como versión anterior. Haz respaldos de `DATA_DIR` con las herramientas de la VM.

### Recuperación de datos dañados

Si `current.json` no es JSON válido o no cumple el esquema (por ejemplo, un precio de
6000.00 escrito a mano):

1. El servidor arranca igual y la landing muestra la versión anterior si es válida o, si no,
   la semilla. Si se daña con el servidor en marcha, la landing sigue con la última versión
   válida en memoria. El log registra `menu_data_damaged` (sin contenido ni rutas).
2. El archivo dañado se conserva como `damaged-<fecha>.json` y se crea `damaged.marker.json`.
3. La página de administración del negocio avisa del daño, bloquea la edición y ofrece
   "Restaurar versión anterior" (si es válida) y "Restaurar semilla original". La elección
   queda en el registro, borra el marcador y desbloquea la edición.

## Estructura

```text
restaurante/
├── src/
│   ├── server.js             # Entrada del proceso: valida config, prepara DATA_DIR, escucha en PORT, cierre ordenado
│   ├── app.js                # createApp(): app Koa testeable (config, repositorio, logger y `now` inyectables)
│   ├── config/               # env.js (carga/validación), businesses.js (ids de negocio), paths.js (views/, public/)
│   ├── controllers/          # landing.js (landing del negocio activo), icons.js (iconos de la raíz y manifests), admin.js
│   ├── routes/               # Router (@koa/router): index.js (landings), admin.js (/admin)
│   ├── middleware/           # Manejo centralizado de errores, log de requests, protección de /admin
│   ├── repositories/         # Repositorio de menús: contrato y reglas, implementación de archivos y en memoria
│   ├── services/             # business-schedule, whatsapp, menu-schema, price, visible-menu, admin-form,
│   │                         # menu-diff, admin-auth, session-store, login-throttle
│   ├── content/              # Contenido estático por negocio (common/, molotes/, birria/), semillas seed.json e icons.js
│   ├── utils/                # logger.js (JSON estructurado), datetime.js (zona del negocio), form-body.js
│   ├── views/                # render.js + plantillas HTML
│   │   ├── layouts/base.html # <head> común (SEO, fuentes, CSS/JS por negocio) y skip link
│   │   ├── pages/            # molotes.html, birria.html: header, secciones y footer del diseño
│   │   ├── partials/         # icons/ (WhatsApp), seo-absolute, favicon-links, molotes/ y birria/ (tarjetas, aviso de sección vacía, etc.)
│   │   ├── landings/         # Contenido -> datos de plantilla (index.js, molotes.js, birria.js)
│   │   └── admin/            # Plantillas y vistas de la administración (formulario generado desde el esquema)
│   └── styles/
│       ├── shared/base.css   # Base común de ambos diseños
│       ├── molotes/main.css  # Entrada Tailwind + tokens @theme de Moloteando
│       ├── birria/main.css   # Entrada Tailwind + tokens @theme de Birriería El Muñeco
│       ├── admin/main.css    # Entrada Tailwind de la administración
│       └── components/       # Bloques BEM propios (sin uso por ahora)
├── public/
│   ├── css/{molotes,birria,admin}/main.css   # Generado por `npm run build:css` (ignorado por git)
│   ├── js/
│   │   ├── modules/          # Módulos ES compartidos (promo-form, variant-selector)
│   │   ├── molotes/main.js   # Entrada JS de Moloteando
│   │   └── birria/main.js    # Entrada JS de Birriería El Muñeco
│   └── img/
│       ├── common/           # Imágenes usadas por ambas landings
│       ├── molotes/          # icons/: favicons e iconos de pantalla de inicio (generados)
│       └── birria/           # icons/: ídem
├── scripts/
│   ├── hash-password.js      # `npm run admin:hash-password`
│   └── generate-icons.py     # Genera public/img/<negocio>/icons/ (Python 3 + Pillow; solo desarrollo)
├── data/                     # DATA_DIR por defecto fuera de producción (ignorado por git)
├── tests/
│   ├── helpers.js            # Config válida, semillas y repositorio en memoria para pruebas
│   ├── support/admin.js      # App con administración, inicio de sesión y lectura de formularios
│   ├── support/png.js        # Lectura mínima de PNG/ICO (dimensiones, opacidad, color de fondo)
│   ├── snapshots/            # HTML de referencia de las landings (regresión visual con la semilla)
│   ├── unit/                 # config, esquema, precios, formulario, repositorio de archivos, sesión, landings, contenido vs. diseño, JS sobre el HTML real
│   └── integration/          # Landings (fecha, SEO, CTA, datos editables, datos dañados), administración, estáticos, errores
├── Dockerfile                # Imagen multi-stage (base, deps, build, test, production); ver [Docker](#docker)
├── .dockerignore             # Excluye secretos, datos, dependencias y artefactos locales del build
└── compose.yaml              # Servicio `test`: `docker compose run --rm test`
```

### Plantillas

`src/views/render.js` es un renderizador mínimo sin dependencias. Las plantillas se leen una
sola vez al crear la app.

- `{{ clave }}`: valor escapado como HTML (siempre por defecto).
- `{{{ clave }}}`: inserta un fragmento ya renderizado. Solo acepta el resultado de otro
  `render()` (`SafeHtml`); un texto normal provoca error.
- `{{ a.b.0.c }}`: rutas con puntos sobre objetos y arrays (solo propiedades propias). Así las
  plantillas leen el contenido de `src/content/` directamente (`{{ c.hero.title }}`).
- `renderEach(plantilla, items)` y `join(fragmentos)` componen listas (tarjetas del menú,
  sucursales) sin lógica en las plantillas.
- Si falta una clave, el valor es un objeto o la plantilla no existe, se lanza un error.

Cada negocio tiene su propia página (`pages/<negocio>.html`) porque los diseños difieren
estructuralmente; comparten layout, icono/CTA de WhatsApp, enlace de ubicación y lógica.
Los textos, horarios, contacto e imágenes de sección viven en `src/content/<negocio>/`; los
datos editables (menú, precios, hero y promociones) llegan del repositorio de menús y se
combinan con ese contenido en `src/views/landings/`. Los tonos de color son claves semánticas (`tone`,
`highlight`) que los módulos de `src/views/landings/` traducen a utilidades de Tailwind.

## Assets por landing

Extraídos de `../_stich_source_/moloteando_aut_nticos_molotes_artesanales/code.html` y
`../_stich_source_/birrier_a_el_mu_eco_aut_ntica_birria_de_res_color_adobo/code.html`:

- **CSS:** el `tailwind.config` del CDN se convirtió en tokens `@theme` de Tailwind v4 en
  `src/styles/<negocio>/main.css`. El `<style>` común está en `src/styles/shared/base.css`.
- **JS:** los scripts y manejadores en línea se reescribieron como módulos ES con
  delegación de eventos y atributos `data-*` (`public/js/modules/`), con una entrada por landing.
- **Imágenes:** descargadas del diseño a `public/img/<negocio>/` (las compartidas en
  `public/img/common/`). Los logos y motivos PNG se convirtieron a WebP. Las rutas, `alt` y
  dimensiones de las imágenes de sección se declaran en `src/content/<negocio>/index.js`
  (`images`); las de cada platillo, en los datos editables (semilla `seed.json`), junto al platillo.
- **Fuentes:** Google Fonts (familias del diseño y Material Symbols), una hoja por landing
  declarada en `content.assets.fontsHref`.

La ubicación (Google Maps) es común a ambas landings: `src/content/common/index.js` → `location.mapsUrl`.

El layout carga `/css/<negocio>/main.css` y `/js/<negocio>/main.js` según el negocio activo.
Cada hoja de Tailwind solo escanea las vistas de su negocio (`@source`), así una landing no
incluye las clases de la otra.

Todos los CTA de pedido (header, hero, banner, plataformas y botón flotante) usan el enlace
calculado desde `WHATSAPP_MOLOTES*` / `WHATSAPP_BIRRIA*`. Los enlaces "Cómo llegar", la
dirección del footer, el mapa y "Pick Up / En Sucursal" usan `location.mapsUrl`.

### Iconos (favicons y pantalla de inicio)

Cada negocio tiene su juego de iconos en `public/img/<negocio>/icons/`, generado a partir de
los PNG de alta resolución de `../_stich_source_/logo_<negocio>.png/screen.png`:

| Archivo                  | Tamaño        | Arte                                                           |
| ------------------------ | ------------- | -------------------------------------------------------------- |
| `favicon.ico`            | 16, 32 y 48   | Mascota recortada en círculo sobre el color del negocio        |
| `icon-16.png`, `icon-32.png` | 16 y 32   | Ídem                                                           |
| `apple-touch-icon.png`   | 180           | Logo completo, opaco, sobre el color del negocio               |
| `icon-192.png`, `icon-512.png` | 192 y 512 | Logo completo sobre fondo transparente                       |
| `icon-maskable-512.png`  | 512           | Logo completo, opaco, dentro del círculo central del 80 %      |

- **Metadatos:** `icons` en `src/content/<negocio>/index.js` (versión, `themeColor` y nombres
  del manifest). Las rutas de los archivos y el manifest se arman en `src/content/icons.js`.
- **`<head>`:** cada landing declara el .ico, los PNG de 16 y 32, el apple-touch-icon, su
  manifest y su `theme-color`; `/` usa los del negocio del día. Las páginas de `/admin`
  muestran el favicon del negocio del día, sin manifest ni `theme-color`.
- **Raíz:** `/favicon.ico`, `/apple-touch-icon.png` y `/apple-touch-icon-precomposed.png`
  sirven el icono del negocio del día con `Cache-Control: no-cache` y `ETag` (responden 304
  si no cambió). Los archivos se cargan en memoria al arrancar; si falta alguno, la app no arranca.
  No crees archivos con esos nombres en la raíz de `public/`: `koa-static` los serviría con
  caché larga.
- **Caché:** los iconos de cada negocio se sirven como estáticos (1 h en producción) con
  `?v=<icons.version>` en la URL. Los manifests (`/molotes.webmanifest`, `/birria.webmanifest`)
  piden revalidación. Safari e iOS guardan su propia caché de favicons, que el servidor no controla.

**Regenerar los iconos** (por ejemplo, si cambia un logo):

1. Requisitos (solo en la máquina de desarrollo): Python 3 y Pillow (`pip install Pillow`).
2. Desde `restaurante/`: `python3 scripts/generate-icons.py --preview-dir /tmp/iconos`.
   El recorte de la mascota (coordenadas en píxeles de la fuente) y los colores de fondo están
   al inicio del script; los colores deben coincidir con `icons.themeColor` del contenido.
3. Revisa la hoja de contacto `icons-preview-<negocio>.png` que se deja en `--preview-dir`
   (fuera del repo).
4. Incrementa `icons.version` en `src/content/<negocio>/index.js` para invalidar la caché HTTP.
5. `npm test` (comprueba tamaños, opacidad, color de fondo y tamaños del .ico) y versiona los
   archivos nuevos.

### Diferencias deliberadas con el diseño fuente

- Enlaces `href="#"` del diseño: Uber Eats y Rappi no tienen URL configurada y se muestran
  como información (no como enlaces); "Aviso de Privacidad" y "Términos" son texto hasta que
  existan esas páginas. El menú de navegación apunta a las secciones de la página.
- Navegación por anclas: desplazamiento suave nativo (`scroll-behavior: smooth`, solo con
  `prefers-reduced-motion: no-preference`) y `scroll-padding-top` con el alto del header fijo
  de cada landing (`--landing-header-height` en `src/styles/<negocio>/main.css`). Los
  destinos tienen `tabindex="-1"` para que el foco quede en la sección. Sin JavaScript.
- El mapa estático remoto de Birria se sustituye por un enlace a Google Maps con la textura
  `fondo-birria.jpg` (no se usan imágenes remotas de Stitch).
- Accesibilidad: etiquetas (`sr-only`) en los campos, `aria-hidden` en iconos decorativos,
  `aria-pressed` en variantes, skip link, animaciones solo con `motion-safe`, jerarquía de
  encabezados corregida (h4/h5 del diseño ajustados) y, en Moloteando, textos pequeños sobre
  fondo claro oscurecidos para cumplir contraste (p. ej. ámbar `#d97706` -> `#b45309`,
  `on-surface-variant` -> `slate-600`, enlaces del menú en blanco).
- Teléfono y correo del footer son enlaces `tel:`/`mailto:`; el campo "correo o teléfono" del
  club de Birria es de texto (el diseño usaba `type="email"`, que rechazaba teléfonos).
- Responsive: el título de Moloteando usa la escala `display-lg-mobile` del propio diseño en
  móvil y la foto principal es 4:3 en móvil para que el pie de foto no tape el plato.
