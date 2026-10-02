# Restaurante — Moloteando / Birriería El Muñeco

> **Estado:** ambas landings implementan el diseño de `../_stich_source_/`
> (`moloteando_aut_nticos_molotes_artesanales` y
> `birrier_a_el_mu_eco_aut_ntica_birria_de_res_color_adobo`), con ruta automática por día
> y rutas dedicadas por negocio.

Aplicación Koa.js (Node.js 24 LTS) que sirve dos landing pages desde un mismo proyecto:

- **Moloteando (molotes)**: lunes a viernes.
- **Birriería El Muñeco (birria)**: sábado y domingo.

El día se calcula en la zona horaria del negocio (`BUSINESS_TIMEZONE`), no en la del
servidor. Cada landing tiene un CTA de pedido por WhatsApp configurable. Todo el contenido,
incluidos los menús, es estático y vive en `src/content/`.

## Requisitos

- Node.js >= 24 (ver `.nvmrc`; con nvm: `nvm use`)
- npm

## Puesta en marcha

```sh
nvm use
npm install
cp .env.example .env   # completa al menos WHATSAPP_MOLOTES(_URL) y WHATSAPP_BIRRIA(_URL)
npm run build:css
npm run dev            # http://localhost:3000
```

## Scripts

| Script               | Descripción                                                 |
| -------------------- | ----------------------------------------------------------- |
| `npm start`          | Inicia el servidor (carga `.env` si existe)                 |
| `npm run dev`        | Servidor con recarga (`node --watch`)                       |
| `npm run build:css`  | Compila el CSS de ambas landings (`build:css:molotes`, `build:css:birria`) |
| `npm run watch:css`  | Compilación de CSS de ambas landings en modo observación    |
| `npm test`           | Tests unitarios e integración (Vitest + Supertest) |
| `npm run test:watch` | Vitest en modo observación                                  |
| `npm run lint`       | Pendiente de configurar                                     |

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

## HTTP

| Ruta             | Respuesta                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------ |
| `GET /`          | Landing activa según el día en `BUSINESS_TIMEZONE`: L-V Moloteando, S-D Birriería El Muñeco |
| `GET /molotes`   | Landing de Moloteando, siempre                                                             |
| `GET /birria`    | Landing de Birriería El Muñeco, siempre                                                    |
| `GET /<archivo>` | Estáticos de `public/` (sin índices ni archivos ocultos)                                   |

Las tres rutas HTML usan el mismo controlador (`src/controllers/landing.js`): con un
`businessId` fijo renderiza ese negocio y sin él lo resuelve por fecha. Responden con
`Cache-Control: no-cache`. La `<link rel="canonical">` siempre apunta a la ruta dedicada
(`/` muestra la canónica del negocio del día), así que no hay contenido duplicado para SEO.
Cualquier otra ruta responde 404 y los métodos distintos de GET/HEAD, 405.

Los errores responden JSON con formato común:

```json
{ "error": { "code": "NOT_FOUND", "message": "Not Found" } }
```

Los errores 5xx usan un mensaje genérico; el stack solo se incluye con `NODE_ENV=development`.
Los logs son JSON por línea en stdout (método, ruta sin query string, estado y duración).

## Menús

Los menús son estáticos y salen del diseño fuente (`../_stich_source_/<landing>/code.html`):

| Archivo                         | Contenido                                                          | Plantilla |
| ------------------------------- | ------------------------------------------------------------------ | --------- |
| `src/content/molotes/menu.js`   | `molotesMenuItems`: 8 molotes (imagen, badge, tono, nombre, descripción, precio por pieza y por orden) | `partials/molotes/menu-card.html` |
| `src/content/molotes/menu.js`   | `molotesDrinkItems`: 2 bebidas (icono, tono, nombre, descripción, precio) | `partials/molotes/drink-item.html` |
| `src/content/birria/menu.js`    | `birriaMenuItems`: 6 platillos (imagen, etiqueta, nombre, descripción, precio, y detalle `chips`, `portion` o `variants`) | `partials/birria/menu-card.html` y `details-*.html` |

- Precios en centavos (enteros); el formato (`$45 c/u`, `$155 MXN`) se aplica en
  `src/views/landings/`. Con variantes, el precio y la descripción del platillo son los de la
  primera variante, que es la activa al cargar.
- En Birria, `slug` forma los id del DOM (`card-`, `title-`, `price-`, `desc-`, `variants-`)
  que usa el selector de variantes (`public/js/modules/variant-selector.js`).
- Para editar el menú, cambia esos archivos (el orden del arreglo es el orden en la página) y
  reinicia el servidor (`npm run dev` recarga solo). Una foto nueva va en `public/img/<negocio>/`
  con `image(src, alt, ancho, alto)` y sus medidas reales. `tests/unit/content.test.js`
  comprueba que las fotos existan y que los textos coincidan con el diseño fuente.

## Estructura

```text
restaurante/
├── src/
│   ├── server.js             # Entrada del proceso: valida config, escucha en PORT, cierre ordenado
│   ├── app.js                # createApp(): app Koa testeable (config, logger y `now` inyectables)
│   ├── config/               # env.js (carga/validación), businesses.js (ids de negocio), paths.js (views/, public/)
│   ├── controllers/          # landing.js: compone la landing del negocio activo
│   ├── routes/               # Router (@koa/router)
│   ├── middleware/           # Manejo centralizado de errores, log de requests
│   ├── services/             # business-schedule.js (día → negocio), whatsapp.js (CTA)
│   ├── content/              # Contenido por negocio, separado del markup (common/, molotes/, birria/ con menu.js)
│   ├── utils/                # logger.js (JSON estructurado, sin dependencias)
│   ├── views/                # render.js + plantillas HTML
│   │   ├── layouts/base.html # <head> común (SEO, fuentes, CSS/JS por negocio) y skip link
│   │   ├── pages/            # molotes.html, birria.html: header, secciones y footer del diseño
│   │   ├── partials/         # icons/ (WhatsApp), seo-absolute, molotes/ y birria/ (tarjetas, etc.)
│   │   └── landings/         # Contenido -> datos de plantilla (index.js, molotes.js, birria.js)
│   └── styles/
│       ├── shared/base.css   # Base común de ambos diseños
│       ├── molotes/main.css  # Entrada Tailwind + tokens @theme de Moloteando
│       ├── birria/main.css   # Entrada Tailwind + tokens @theme de Birriería El Muñeco
│       └── components/       # Bloques BEM propios (sin uso por ahora)
├── public/
│   ├── css/{molotes,birria}/main.css   # Generado por `npm run build:css` (ignorado por git)
│   ├── js/
│   │   ├── modules/          # Módulos ES compartidos (promo-form, variant-selector)
│   │   ├── molotes/main.js   # Entrada JS de Moloteando
│   │   └── birria/main.js    # Entrada JS de Birriería El Muñeco
│   └── img/
│       ├── common/           # Imágenes usadas por ambas landings
│       ├── molotes/
│       └── birria/
└── tests/
    ├── helpers.js            # Config válida para pruebas
    ├── unit/                 # config, selector de negocio, WhatsApp, renderizador, landings, contenido/menús vs. diseño, JS sobre el HTML real
    └── integration/          # GET /, /molotes, /birria (fecha inyectada, SEO, CTA), estáticos, errores
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
platillos y bebidas del menú, en `src/content/<negocio>/menu.js`. Los tonos de color son claves semánticas (`tone`,
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
  (`images`); las de cada platillo, en `menu.js` junto al platillo.
- **Fuentes:** Google Fonts (familias del diseño y Material Symbols), una hoja por landing
  declarada en `content.assets.fontsHref`.

La ubicación (Google Maps) es común a ambas landings: `src/content/common/index.js` → `location.mapsUrl`.

El layout carga `/css/<negocio>/main.css` y `/js/<negocio>/main.js` según el negocio activo.
Cada hoja de Tailwind solo escanea las vistas de su negocio (`@source`), así una landing no
incluye las clases de la otra.

Todos los CTA de pedido (header, hero, banner, plataformas y botón flotante) usan el enlace
calculado desde `WHATSAPP_MOLOTES*` / `WHATSAPP_BIRRIA*`. Los enlaces "Cómo llegar", la
dirección del footer, el mapa y "Pick Up / En Sucursal" usan `location.mapsUrl`.

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
# restaurant
