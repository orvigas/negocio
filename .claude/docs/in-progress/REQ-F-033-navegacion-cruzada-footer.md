# REQ-F-033 — Navegación cruzada desde el pie de página

## Estado

QA_APPROVED

## Aprobación

Aprobado por el usuario (versión 1, fecha 2026-10-15). Respuesta textual a "¿Apruebas los tres tickets con estos textos?": "si".

Serie de tickets y orden obligatorio: **REQ-F-032 → REQ-F-033 → REQ-F-034**. Este es el segundo y empieza cuando REQ-F-032 esté integrado.

## Objetivo

Que desde el pie de cada landing se pueda ir a la otra con un botón que muestre su logo oficial.

## Alcance

- Pie de `/` y `/birria`: enlace a `/molotes`.
- Pie de `/molotes`: enlace a `/birria`.
- Textos del enlace en el contenido de cada negocio.
- Pruebas y snapshots.

## Fuera de alcance

- Otros cambios del pie.
- Navegación en la cabecera.
- Generar logos o assets nuevos.
- Rutas o páginas nuevas.

## Requisitos

- **R-1. Pie de Birria (también en `/`).**
  - Un enlace a `/molotes` que contiene el logo oficial `/img/molotes/logo-molotes.webp` y el texto visible "Conoce nuestros Molotes".
  - Logo y texto forman una sola área interactiva.
  - El nombre accesible es único y no se repite: el logo no duplica el texto.
- **R-2. Pie de Molotes.** Un enlace a `/birria` con `/img/birria/logo-birria.webp` y el texto visible "Conoce nuestra Birria", con las mismas condiciones de R-1.
- **R-3. Enlace normal.**
  - Se abre en la misma pestaña, sin redirecciones intermedias ni JavaScript. Se acepta que cargue la otra página.
  - Los textos viven en el contenido de cada negocio. La ruta de destino no se repite escrita a mano.
- **R-4. Estilo.**
  - El enlace va en la columna de marca de cada pie, con la paleta de esa landing (granate y ámbar en Birria, azul marino en Molotes).
  - Clase BEM propia y utilidades de Tailwind.
  - No hay equivalente en `_stich_source_/`: es una diferencia deliberada respecto al diseño.
- **R-5. Accesibilidad.**
  - Se alcanza con Tab y tiene foco visible.
  - Contraste del texto de al menos 4.5:1.
  - Área táctil de al menos 44×44 px.
  - El botón flotante de WhatsApp no lo tapa.
- **R-6. Logos.** Solo se usan los logos oficiales existentes. Las imágenes cargan de forma diferida y con dimensiones declaradas.

## Historias de usuario

- **HU-1.** Como cliente de un negocio, quiero llegar al otro desde el pie, para conocer toda la oferta.

## Criterios de aceptación

- **CA-1.** En `/` y `/birria`, el pie tiene exactamente un `<a href="/molotes">` que contiene una imagen `logo-molotes.webp` y cuyo nombre accesible es "Conoce nuestros Molotes".
- **CA-2.** En `/molotes`, el pie tiene exactamente un `<a href="/birria">` que contiene `logo-birria.webp` y cuyo nombre accesible es "Conoce nuestra Birria".
- **CA-3.** Los enlaces no llevan `target`. Al activarlos con Enter o clic se carga la otra landing con respuesta 200.
- **CA-4.** El enlace se ve bien en todos los anchos:
  - Tiene foco visible.
  - A 320, 768 y 1280 px se ve completo.
  - Mide al menos 44×44 px.
  - El botón flotante no lo tapa.
  - No hay desbordamiento horizontal.
- **CA-5.** El contraste del texto con su fondo es de al menos 4.5:1 en ambas landings.
- **CA-6.** Funciona sin JavaScript. No se añaden archivos a `restaurante/public/img/`.
- **CA-7.** `npm run typecheck`, `npm run lint` y `npm test` terminan en 0. Los snapshots de ambas landings se regeneran y su diff se revisa.

## Casos límite

- Si el logo no carga, el enlace conserva su texto visible y su nombre accesible.
- Al llegar a `/molotes` desde el pie, se aplican las reglas de avisos de REQ-F-034 cuando ese ticket exista.
- En móvil, el pie queda al final de la página, donde el botón flotante puede solaparse: CA-4.

## Dependencias

- REQ-F-032, porque modifica el pie de Birria y el de Molotes (contacto).

## Riesgos

- Que el botón flotante de WhatsApp tape el enlace en móvil.

## Action Plan

### Objetivo
Navegación cruzada visible y accesible desde ambos pies.

### Cambios requeridos
1. Añadir los textos al contenido de cada negocio.
2. Añadir el enlace con logo a ambos pies, en la columna de marca.
3. Pruebas de presencia, destino, nombre accesible y ausencia de `target`.
4. Snapshots.

### Orden recomendado
Contenido → plantillas → pruebas → revisión visual a 320, 768 y 1280 px.

### Resultado esperado
Ir de una landing a la otra en un clic desde el pie, en cualquier dispositivo.

## Trazabilidad

| Respuesta del usuario | Decisión | Requisitos | Criterios |
|---|---|---|---|
| Destino "5 si" (`/birria`) | Molotes enlaza a `/birria` | R-2 | CA-2 |
| Recargas "18 si" | Enlace normal; se acepta que cargue la página | R-3 | CA-3 |
| Tres tickets "19 b" | Segundo de la serie 032 → 033 → 034 | — | — |
| Aprobación "si" | Textos "Conoce nuestros Molotes" y "Conoce nuestra Birria" | R-1, R-2 | CA-1, CA-2 |

Objetivo → R-1 a R-6 → HU-1 → CA-1 a CA-7 → diseño (pies actuales de `restaurante/src/views/pages/birria.html` y `molotes.html`; sin equivalente en `_stich_source_/`) → Action Plan.

## Technical Action Plan

Revisión hecha contra `origin/main` (6ccfec0, con REQ-F-032 integrado). La rama local `docs/cierra-REQ-F-032` solo difiere en el ticket de cierre de REQ-F-032, así que el código revisado es el de `main`. No se encontraron bloqueos; las decisiones técnicas que el usuario puede cambiar están en "Decisiones técnicas (revisables)".

### Objetivo técnico

Añadir al pie (`footer.site-footer`) de cada landing un enlace normal (`<a href>`) a la otra landing. El enlace muestra el logo oficial del destino y un texto visible. El texto sale del contenido del negocio. La ruta sale de `BUSINESS_PATHS` y el logo, de las imágenes del negocio de destino. Funciona sin JavaScript y no añade assets.

### Archivos o componentes afectados

| Archivo | Cambio |
|---|---|
| `restaurante/src/content/birria/index.ts` | `footer.crossLink = { label: 'Conoce nuestros Molotes', business: BUSINESS.MOLOTES }` |
| `restaurante/src/content/molotes/index.ts` | `footer.crossLink = { label: 'Conoce nuestra Birria', business: BUSINESS.BIRRIA }` |
| `restaurante/src/views/landings/index.ts` | Campo nuevo `crossLink` en `LandingView` y función `buildCrossLink()`, llamada desde `renderLandingPage` |
| `restaurante/src/views/pages/birria.html` | Enlace al final de la columna de marca del pie (sirve para `/` y `/birria`) |
| `restaurante/src/views/pages/molotes.html` | Enlace al final de la columna de marca del pie |
| `restaurante/tests/unit/footer-cross-link.test.ts` (nuevo) | Pruebas de marcado: CA-1, CA-2, CA-3 (atributos), CA-6 y caso límite del logo |
| `restaurante/tests/unit/content.test.ts` | Coherencia de `footer.crossLink` en ambos negocios |
| `restaurante/tests/integration/app.test.ts` | CA-3: seguir el enlace del pie desde `/`, `/birria` y `/molotes` responde 200 |
| `restaurante/tests/snapshots/landing-birria.html`, `landing-molotes.html` | Regenerados (CA-7) |
| `restaurante/README.md` | Párrafo breve sobre el enlace cruzado del pie y de dónde salen texto, ruta y logo |

No se tocan `public/img/`, `public/js/`, `src/styles/`, rutas, controladores ni el aviso de `/`.

### Cambios requeridos

#### Contenido / configuración (sin duplicar)

- Cada negocio declara solo **el texto** y **el negocio de destino** (`business`, con la constante `BUSINESS` de `src/config/businesses.ts`; el contenido ya importa de ahí en `hours.ts`, `bot.ts` e `icons.ts`).
- `buildCrossLink(content)` en `src/views/landings/index.ts` resuelve:
  - `href = BUSINESS_PATHS[target]`, la misma fuente que el router y la URL canónica. La ruta no se vuelve a escribir.
  - `logo = getBusinessContent(target).images.emblem`. `emblem` es el descriptor decorativo que ya existe, con `alt` vacío y dimensiones reales: `/img/molotes/logo-molotes.webp` (461×512) y `/img/birria/logo-birria.webp` (418×512).
  - `label = content.footer.crossLink.label`.
- `LandingView` gana `crossLink: { href: string; label: string; logo: ImageDescriptor }`. Lo usan las dos páginas, y la vista previa también lo hereda porque todo pasa por `renderLandingPage`.

#### Frontend: marcado (mismo en ambas páginas, cambia la paleta)

```html
<a class="cross-link flex w-fit max-w-full min-h-11 items-center gap-3 rounded-full … scroll-mb-28 focus-visible:outline-2 focus-visible:outline-offset-2 …" href="{{ crossLink.href }}">
  <img class="cross-link__logo h-10 w-auto shrink-0 rounded-full … p-0.5" src="{{ crossLink.logo.src }}" alt="{{ crossLink.logo.alt }}" width="{{ crossLink.logo.width }}" height="{{ crossLink.logo.height }}" loading="lazy" decoding="async" />
  <span class="cross-link__label min-w-0">{{ crossLink.label }}</span>
</a>
```

- Bloque BEM `cross-link` con los elementos `__logo` y `__label`, todo con utilidades de Tailwind y sin CSS propio. No lleva `target`, `rel`, `data-action` ni `aria-label`.
- **Dónde va.**
  - Birria: último hijo de la primera columna del pie (`div.space-y-4`), después de la línea "Hecha con paciencia".
  - Molotes: último hijo de la primera columna (`div.space-y-space-sm`), después de los iconos sociales decorativos.
  - En ambos casos es la columna de marca (R-4). En móvil queda arriba del pie, lejos de la franja inferior.
- **Paleta.** Se usa el botón secundario de cada `DESIGN.md` de `_stich_source_/`, que no compite con el CTA de WhatsApp:
  - **Birria** (botón "Secondary / Ghost" de `birria_tradicional_jalisciense/DESIGN.md`): `border-[1.5px] border-amber-glow bg-[rgba(255,251,235,0.08)] text-[#fffbeb] hover:bg-[rgba(255,251,235,0.16)]`, con `font-label text-xs font-bold tracking-wider uppercase` y foco `focus-visible:outline-amber-light`. El logo de Molotes va sobre un círculo `bg-cream/90`, el mismo tratamiento que ya tiene en el aviso de `/` (`home-notice__logo`).
  - **Molotes** (botón "Secondary" de `moloteando_tradicional/DESIGN.md`, azul marino y cobalto): `border border-[#2575FC] bg-[rgba(27,94,184,0.25)] text-white hover:bg-[rgba(27,94,184,0.4)]`, con `font-label-md text-label-md font-bold tracking-wider uppercase` y foco `focus-visible:outline-secondary`. El logo de Birria va sobre `bg-white/90`, para que se lea sobre el azul sea cual sea la transparencia del archivo.
- **Reutilización.** Se reutiliza el *patrón* del aviso de `/` (logo y texto dentro de un mismo `<a>`, logo en círculo claro, el alt no repite el texto), pero no el partial `home-notice-molotes-action.html`, por tres motivos:
  - pertenece al bloque `home-notice` (modal);
  - tiene un degradado ámbar sólido de botón primario;
  - su `alt` es "Molotes", y aquí el nombre accesible debe ser exactamente el texto (R-1).

  Crear un partial compartido para dos usos con paletas distintas exigiría pasarle las clases como datos, sin beneficio. Por eso el marcado va en cada página, igual que el resto de cada pie.

### Accesibilidad

- **Nombre accesible único.** El `<img>` usa `emblem` (`alt=""`, decorativo), así que el nombre sale solo del `<span>`: "Conoce nuestros Molotes" o "Conoce nuestra Birria". No hay `aria-label` ni `title`. Si el logo no carga, no aparece texto alternativo extra y el nombre no cambia (caso límite).
- **Una sola área interactiva.** Logo y texto están dentro del mismo `<a>`. No hay otro enlace a ese destino en el pie (el aviso de `/` está fuera del pie).
- **Foco.** Es un `<a href>` nativo, así que entra en el orden de Tab. El foco visible usa `focus-visible:outline-2 outline-offset-2`. Contraste del contorno: ámbar claro `#fbbf24` sobre `#450707`, 9.78:1; dorado `#ffc472` sobre `rgb(8,24,48)`, 11.31:1. Ambos superan 3:1.
- **44×44 px.** `min-h-11` (44 px). La altura real es de unos 51 px: logo `h-10` (40) + `py-1` + borde. El ancho mínimo es el logo más el texto, mucho más de 44.
- **Contraste del texto** (calculado con la fórmula WCAG sobre el fondo resultante de mezclar la capa translúcida con el fondo del pie):
  - Birria: `#fffbeb` sobre `#541b19` (reposo), 13.08:1; en hover sigue por encima de 10:1.
  - Molotes: blanco sobre `#0d2a52` (reposo), 14.28:1; en hover sigue por encima de 10:1.
- **Encabezados.** No se añade ninguno, así que la jerarquía no cambia.

### Responsividad (planificado para 320 px)

- `w-fit max-w-full`: el enlace mide lo que su contenido y nunca supera la columna. El ancho útil a 320 px es de 288 px (Birria `px-4`; Molotes `px-margin` = 1rem). El texto en mayúsculas a 12 px ocupa unos 190 px, más 36 px del logo, 12 px de separación y el relleno: unos 260 px. Entra en una línea.
- El `<span>` lleva `min-w-0` y no lleva `whitespace-nowrap`: si un texto futuro no cabe, se parte en dos líneas dentro del botón en lugar de desbordar. `shrink-0` en el logo evita que se deforme.
- A 768 px (2 columnas) y 1280 px (4 columnas), el enlace queda en la columna izquierda. El CTA flotante está a la derecha (`right-6`, unos 180 px de ancho) y no se cruzan en horizontal.
- **CTA flotante en móvil.** Al final del desplazamiento, el enlace está arriba del pie (primera columna apilada), lejos de los 72 px inferiores que ocupa el CTA. Queda un riesgo: al llegar con Tab desde arriba, el navegador puede desplazarse lo justo y dejar el enlace pegado al borde inferior, debajo del CTA. Para evitarlo, `scroll-mb-28` (112 px) en el enlace hace que el desplazamiento por foco lo deje por encima del CTA.
  - Si la verificación en Chrome muestra que el foco no respeta `scroll-margin`, la alternativa es `scroll-padding-bottom` en `html`, en `src/styles/shared/base.css`, junto al `scroll-padding-top` que ya existe. Afecta a toda la página, así que solo se aplicaría informándolo en el Implementation Result.

### Validaciones

No hay entrada externa nueva. El destino sale de `BUSINESS`/`BUSINESS_PATHS` (tipado: `business` debe ser un `BusinessId`) y el texto se escapa con `{{ }}`. Una prueba de contenido comprueba que cada negocio apunta al *otro* negocio y que el texto no está vacío.

### Manejo de errores

Sin cambios. `getBusinessContent` ya lanza ante un id desconocido, y el tipo `BusinessId` impide que llegue uno.

### Testing

1. **`tests/unit/footer-cross-link.test.ts`** (JSDOM sobre `renderLandingPage`, con la semilla):
   - Para Birria se renderiza con `homeNotice` `null`, `'molotes'` y `'rest'`: cubre `/` todos los días y `/birria`. En `footer.site-footer` hay exactamente un `a[href="/molotes"]` (CA-1). En Molotes hay exactamente un `a[href="/birria"]` (CA-2).
   - El enlace contiene un `img` con `src` del logo del destino, `alt=""`, `width`/`height` numéricos y `loading="lazy"` (R-6).
   - Nombre accesible: el texto del enlace, sustituyendo cada `img` por su `alt` y normalizando espacios, es exactamente "Conoce nuestros Molotes" o "Conoce nuestra Birria". Sin `aria-label`, `aria-labelledby` ni `title` (CA-1, CA-2, caso límite).
   - Sin `target`, `rel` ni `data-action` (CA-3, CA-6: no depende de JS).
   - En `/` con aviso, el enlace del aviso sigue existiendo fuera del pie: no hay regresión de REQ-F-028.
2. **`tests/unit/content.test.ts`**: para cada negocio, `footer.crossLink.business` es un `BusinessId` distinto del propio y `label` no está vacío.
3. **`tests/integration/app.test.ts`** (con `listenLocal`, MySQL real): para `/`, `/birria` y `/molotes`, se toma el `href` del enlace del pie y `GET` sobre él responde 200 sin redirección (CA-3).
4. **Snapshots** (CA-7): `npx vitest run tests/unit/landing-snapshot.test.ts -u`. En la revisión del diff, solo deben aparecer las líneas nuevas del enlace en cada pie.
5. **Pruebas existentes que conviene vigilar:**
   - `app.test.ts`: las líneas 386, 541 y 622 recorren el pie. Toman el primer `ul` del último `footer` y los enlaces `tel:`, `mailto:` y del mapa; el enlace nuevo no está en un `ul` ni usa esos esquemas.
   - `birria-veracity.test.ts`: los textos nuevos no contienen términos retirados.
   - `home-notice.test.ts` y `landing-dom.test.ts` (anclas `#`: el enlace nuevo no es un ancla).
6. **Comandos:** `npm run build:css`, `npm run typecheck`, `npm run lint` y `npm test` (con `npm run db:up`).
7. **Verificación visual (CA-4, CA-5, caso límite)** en Chrome headless por CDP, con un script en el scratchpad como el de la QA de REQ-F-032, contra `npm run dev`, en `/`, `/birria` y `/molotes`, a 320, 360, 375, 414, 768, 1024 y 1280 px:
   - `document.scrollingElement.scrollWidth <= clientWidth` (sin desbordamiento horizontal);
   - el rectángulo del enlace queda dentro del viewport en horizontal, mide al menos 44×44, y el `<span>` no se recorta (`scrollWidth <= clientWidth`);
   - se llega con `Tab` simulado (`Input.dispatchKeyEvent`) desde el elemento anterior: el enlace es `document.activeElement`, `outline-style` no es `none`, y su rectángulo no se cruza con el de `.whatsapp-cta--floating`;
   - al final del desplazamiento, tampoco se cruza con el CTA;
   - bloqueando las peticiones `*.webp` (`Fetch.enable` o `Network.setBlockedURLs`), el texto sigue visible y el nombre no cambia;
   - capturas a 320, 768 y 1280 px de cada pie, enfocado y sin enfocar.

   Los resultados y las rutas de las capturas van en el Implementation Result. jsdom no calcula el layout, así que esta parte no se cubre con Vitest.

### Seguridad

Sin superficie nueva: enlace interno relativo, sin `target` (no aplica `noopener`). Sin cambios en la CSP (imágenes del mismo origen). Sin datos de usuario.

### Performance

- Ningún asset nuevo. Cada logo ya lo descarga su propia landing (cabecera o hero), pero aquí se muestra el del *otro* negocio. Supone una petición diferida (`loading="lazy"`) de unos 76-86 KB solo cuando el pie se acerca al viewport, y la caché del navegador la reutiliza al navegar.
- Las dimensiones declaradas evitan saltos de diseño.
- Optimizar los logos (que sirven a unos 40 px) queda fuera de alcance porque supone tocar assets.

### Riesgos técnicos

- **R-T1. CTA flotante sobre el enlace al enfocarlo en móvil.** Mitigado con `scroll-mb-28` y verificado en Chrome. La alternativa está descrita arriba.
- **R-T2. Legibilidad del logo de Birria sobre azul.** Mitigada con el círculo `bg-white/90`; se confirma en las capturas.
- **R-T3. REQ-F-034.** Cambiará los avisos de `/molotes` (`molotes.html` y el contenido de Molotes). Este ticket solo añade `footer.crossLink` y el enlace al final de la primera columna del pie, sin tocar el `<body>` ni el `<main>` ni crear estado. No le cierra el camino: los avisos son otro bloque y otra clave de contenido.
- **R-T4. Duplicación previa fuera de alcance.** `homeNotices.*.linkHref` de Birria tiene `'/molotes'` escrito a mano (REQ-F-028). No se toca aquí. Puede derivarse de `BUSINESS_PATHS` en REQ-F-034 o en un ajuste aparte si el usuario lo pide.

### Decisiones técnicas (aprobadas)

Aprobadas por el usuario el 2026-10-15. Respuesta textual a «¿Apruebas el plan de REQ-F-033 con estas decisiones?»: "1 si". La decisión 4 queda fuera de alcance: el `'/molotes'` escrito a mano en `homeNotices` de Birria se corrige en REQ-F-034.

#### Propuesta original

Ninguna es bloqueante. Se aplican si el usuario no indica otra cosa:

1. **Estilo de botón secundario.** Ghost con borde ámbar en Birria y botón cobalto translúcido en Molotes, ambos de los `DESIGN.md`. La alternativa sería el botón primario dorado, pero competiría con el CTA de WhatsApp, que es la acción principal.
2. **Texto en mayúsculas** (`uppercase`, como los CTA de ambas landings). El contenido conserva la capitalización aprobada; solo cambia la presentación, y los lectores de pantalla leen el texto del contenido.
3. **Logo sobre círculo claro** en ambas landings, como en el aviso de `/`.

### Orden de implementación

1. Contenido (`footer.crossLink` en Birria y Molotes).
2. `buildCrossLink` y el campo `crossLink` en `LandingView`.
3. Marcado en `birria.html` y `molotes.html`.
4. `npm run build:css`.
5. Pruebas nuevas y ajustes (unit, contenido e integración).
6. Regenerar snapshots y revisar su diff.
7. `typecheck`, `lint` y `test`.
8. Verificación en Chrome headless (CA-4, CA-5, caso límite del logo).
9. README.
10. Revisión de `git diff`: sin cambios en `public/img/` ni ajenos al ticket.

### Criterios de finalización

- CA-1 a CA-3 y CA-6 cubiertos por pruebas automáticas en verde.
- CA-4 y CA-5 verificados en Chrome headless con medidas y capturas registradas; el contraste, además, está calculado en este plan.
- CA-7: `typecheck`, `lint` y `test` en 0, con los snapshots regenerados y su diff revisado.
- `git diff --stat restaurante/public/img` vacío.
- README actualizado.

## Implementation Result

### Rama

`feature/REQ-F-033-navegacion-cruzada-footer`, creada desde `main` (8414a12, con el PR #68 ya mezclado). Sin commits.

### Cambios realizados

- **Contenido.** `footer.crossLink` en Birria (`'Conoce nuestros Molotes'`, `BUSINESS.MOLOTES`) y en Molotes (`'Conoce nuestra Birria'`, `BUSINESS.BIRRIA`).
- **Vista.** Nuevos `CrossLink` y `buildCrossLink(businessId)` en `src/views/landings/index.ts`. La ruta sale de `BUSINESS_PATHS[destino]` y el logo, de `images.emblem` del destino (alt vacío). El campo `crossLink` de `LandingView` se rellena en `renderLandingPage`.
- **Plantillas.** Enlace `a.cross-link` (con `__logo` y `__label`) al final de la columna de marca del pie, en `birria.html` y en `molotes.html`, con el estilo aprobado:
  - Birria: ghost con borde ámbar, logo sobre `bg-cream/90`.
  - Molotes: cobalto translúcido, logo sobre `bg-white/90`.
  - En ambos: mayúsculas solo en pantalla, `min-h-11`, `scroll-mb-28`, `focus-visible:outline-*`, imagen con `loading="lazy"`, `decoding="async"`, `width` y `height`.
- **Pruebas.** Archivo nuevo `tests/unit/footer-cross-link.test.ts` y ampliaciones en `tests/unit/content.test.ts` y `tests/integration/app.test.ts`.
- **Snapshots** regenerados.
- **README**: párrafo sobre el enlace cruzado del pie, en la sección de ubicación y contacto.

### Criterios de aceptación

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 | Cumple | `footer-cross-link.test.ts`: en `/` (avisos `null`, `molotes`, `rest`) y `/birria`, un solo `a[href="/molotes"]` en `footer.site-footer`, con `logo-molotes.webp` y nombre "Conoce nuestros Molotes" |
| CA-2 | Cumple | La misma prueba en `/molotes`: un solo `a[href="/birria"]`, con `logo-birria.webp` y nombre "Conoce nuestra Birria" |
| CA-3 | Cumple | Sin `target`, `rel` ni `data-action` (unit). `app.test.ts` › REQ-F-033: desde `/` (viernes y sábado), `/birria` y `/molotes`, seguir el `href` del pie responde 200 sin redirección y con la canónica del destino. Con Tab y foco, el enlace es el elemento activo (Chrome) |
| CA-4 | Cumple | Chrome headless, 28 combinaciones de página y ancho, 0 fallos (detalle abajo) |
| CA-5 | Cumple | Contraste medido en el navegador con colores computados: Birria 13.13:1; Molotes 14.36:1 |
| CA-6 | Cumple | Enlace `<a href>` sin JS. `git diff --stat -- restaurante/public/img` vacío |
| CA-7 | Cumple | `typecheck`, `lint` y `test` en 0. El diff de los snapshots solo añade las 4 líneas del enlace en cada landing |

### Validaciones ejecutadas

- `npm run build:css`: sin errores. Clases nuevas presentes en el CSS generado: `border-[1.5px]`, `bg-[rgba(255,251,235,0.08)]` y su hover, `bg-[rgba(27,94,184,0.25)]` y su hover, `border-[#2575FC]`, `scroll-mb-28`, `min-h-11`, `outline-amber-light`, `outline-secondary`, `bg-cream/90` y `bg-white/90`.
- `npm run typecheck`: 0.
- `npm test`: 91 archivos; 1829 pruebas pasadas y 1 *expected fail* (ya existía).
- `npm run lint`: 0, sin avisos.
- **Snapshots:** `npx vitest run tests/unit/landing-snapshot.test.ts -u`. Diff revisado: solo `+4` líneas por landing (`<a class="cross-link …" href="/molotes">` o `href="/birria"`, el `<img … alt="" width height loading="lazy" decoding="async">`, el `<span>` y el cierre).
- **Verificación visual.** Chrome headless por CDP con `/private/tmp/claude-501/-Users-orvigas-Desktop-Negocio/2cff8506-aad0-4b07-aeb9-699ff9708e48/scratchpad/crosslink/measure.mjs`, contra el servidor local (`npm start` en el puerto 3210, con una `WHATSAPP_BOT_BLOCKLIST_KEY` temporal solo para ese proceso; `.env` sin cambios). Páginas `/` (jueves, con el aviso cerrado), `/?dia=sabado`, `/birria` y `/molotes`, a 320, 360, 375, 414, 768, 1024 y 1280 px. Resultados (`/private/tmp/claude-501/-Users-orvigas-Desktop-Negocio/2cff8506-aad0-4b07-aeb9-699ff9708e48/scratchpad/crosslink/out/results.json`):
  - **Desbordamiento horizontal:** 0 px en todos los casos.
  - **Tamaño:** Birria 254×50 px y Molotes 228×50 px. A 1024 px (4 columnas) mide 216×50 o 222×50 y el texto pasa a 2 líneas dentro del botón, sin recortes. En todos los casos el texto cabe (`scrollWidth <= clientWidth`).
  - **Foco con Tab** desde el elemento anterior: el enlace queda activo, con `:focus-visible` y contorno `solid 2px` (`rgb(251,191,36)` en Birria, `rgb(255,196,114)` en Molotes). Queda dentro del viewport y no se cruza con el CTA flotante.
  - **Al final del desplazamiento:** no se cruza con el CTA.
  - **Enlace bajo el CTA y Tab** (`/private/tmp/claude-501/-Users-orvigas-Desktop-Negocio/2cff8506-aad0-4b07-aeb9-699ff9708e48/scratchpad/crosslink/tab-under-cta.mjs`, a 320, 375 y 414 px): con el enlace colocado 5, 20 y 60 px por debajo del borde superior del CTA, Tab lo deja en 558-608 px (CTA en 646). No se cruzan en ningún caso.
  - **Control sin `scroll-margin`** (`/private/tmp/claude-501/-Users-orvigas-Desktop-Negocio/2cff8506-aad0-4b07-aeb9-699ff9708e48/scratchpad/crosslink/control.mjs`): el enlace se queda debajo del CTA (651-701 px). Esto confirma que `scroll-mb-28` es necesario y suficiente; no hizo falta la alternativa de `scroll-padding-bottom`.
  - **Logo sin cargar** (`Network.setBlockedURLs *.webp`, a 320 y 1280 px): el texto y el nombre no cambian, el enlace sigue midiendo 254×50 o 228×50 y no hay desbordamiento.
- **Capturas** en `/private/tmp/claude-501/-Users-orvigas-Desktop-Negocio/2cff8506-aad0-4b07-aeb9-699ff9708e48/scratchpad/crosslink/out/`:
  - `{inicio,birria,molotes}-{320,768,1280}.png` y las mismas con `-foco.png`;
  - `{birria,molotes}-{320,1280}-sin-logo.png`.

  Y en `/private/tmp/claude-501/-Users-orvigas-Desktop-Negocio/2cff8506-aad0-4b07-aeb9-699ff9708e48/scratchpad/crosslink/out2/`: `birria-320-tab-bajo-cta.png` y `molotes-320-tab-bajo-cta.png`.

### Archivos afectados

- `restaurante/src/content/birria/index.ts`
- `restaurante/src/content/molotes/index.ts`
- `restaurante/src/views/landings/index.ts`
- `restaurante/src/views/pages/birria.html`
- `restaurante/src/views/pages/molotes.html`
- `restaurante/tests/unit/footer-cross-link.test.ts` (nuevo)
- `restaurante/tests/unit/content.test.ts`
- `restaurante/tests/integration/app.test.ts`
- `restaurante/tests/snapshots/landing-birria.html`
- `restaurante/tests/snapshots/landing-molotes.html`
- `restaurante/README.md`
- este ticket

### Riesgos o pendientes

- **Desviaciones menores del plan:**
  - `buildCrossLink` recibe el `businessId` en lugar del contenido. El resultado es el mismo.
  - Se añadió una prueba de ubicación (el enlace está en la primera columna de la cuadrícula del pie).
  - Sin otras desviaciones.
- **A 1024 px** el texto ocupa 2 líneas dentro del botón por el ancho de la columna (4 columnas). Era el comportamiento previsto (texto que se parte en lugar de desbordar). No hay captura a 1024 px; la evidencia son las medidas.
- **Fuera de alcance:** el `'/molotes'` escrito a mano en `homeNotices` de Birria se corrige en REQ-F-034 (decisión 4).
- **Ticket sin versionar:** se movió con `mv` y quedará versionado en el commit de T4.

## QA Action Plan

### Objetivo
Validar con evidencia que el pie de `/`, `/birria` y `/molotes` tiene un enlace normal, accesible y visible a la otra landing, con su logo oficial, sin regresiones en el pie, el aviso de `/` (REQ-F-028), el contacto (REQ-F-032) ni el CTA de WhatsApp.

### Requisito bajo prueba
REQ-F-033, R-1 a R-6, HU-1, CA-1 a CA-7 y casos límite del ticket (versión 1 aprobada; Technical Action Plan aprobado "1 si"; implementación aprobada: "apruebo la implementacion Revisión técnica REQ-F-033").

### Criterios de aceptación
| CA | Pruebas que lo cubren |
|---|---|
| CA-1 | F-1, F-2, F-3, A-1, N-1 |
| CA-2 | F-1, F-2, F-3, A-1 |
| CA-3 | F-4, F-5, B-2 |
| CA-4 | RS-1 a RS-5, A-2, A-3 |
| CA-5 | A-4 |
| CA-6 | F-6, B-3, RG-5 |
| CA-7 | AU-1 a AU-4 |

Casos límite: N-2 (logo sin cargar), RS-4 (CTA flotante en móvil). El de REQ-F-034 no aplica (ese ticket no existe aún en código).

### Riesgos identificados
- El CTA flotante de WhatsApp tapa el enlace al enfocarlo con Tab en móvil (mitigado con `scroll-mb-28`; se verifica de forma independiente).
- Duplicar el nombre accesible si el logo tuviera `alt` no vacío.
- Regresión en las pruebas que recorren el pie (`app.test.ts`: primer `ul`, `tel:`, `mailto:`, mapa) y en el aviso de `/`, cuyo enlace también apunta a `/molotes` (fuera del pie).
- Texto partido en 2 líneas a 1024 px (4 columnas): verificar que no se recorta ni se sale.
- Vista previa del administrador (también pasa por `renderLandingPage` vía `renderLanding`): el enlace aparece también ahí; se verifica que no rompe la vista.
- Peso de los logos (76-86 KB) cargados de forma diferida; solo se registra, no es defecto (optimizar assets está fuera de alcance).

### Pruebas funcionales
- **F-1.** HTML servido por `GET /` (lunes, martes-viernes y sábado simulados con `?dia=` en desarrollo o por las pruebas de integración), `/birria` y `/molotes`: dentro de `footer.site-footer` hay exactamente un `a[href="/molotes"]` (Birria) o `a[href="/birria"]` (Molotes).
- **F-2.** Ese enlace contiene un solo `img` con `src` `/img/molotes/logo-molotes.webp` o `/img/birria/logo-birria.webp`, `alt=""`, `width`/`height` numéricos, `loading="lazy"` y `decoding="async"` (R-6).
- **F-3.** Texto visible "Conoce nuestros Molotes" / "Conoce nuestra Birria" (en pantalla en mayúsculas por CSS; el DOM conserva la capitalización aprobada).
- **F-4.** Sin `target`, `rel`, `data-action`, `aria-label` ni `title`. Activación con Enter y con clic en Chrome: carga la otra landing en la misma pestaña, `location.pathname` correcto, respuesta 200 sin redirección (`curl -sI` sobre el destino).
- **F-5.** El enlace va en la primera columna (marca) del pie de cada landing, después de "Hecha con paciencia" (Birria) y de los iconos sociales (Molotes).
- **F-6.** Funciona sin JavaScript: el marcado es un `<a href>` nativo y el destino se carga por `curl`; en Chrome, con JS deshabilitado vía CDP (`Emulation.setScriptExecutionDisabled`), el clic navega.
- **F-7.** Texto y destino salen del contenido/`BUSINESS_PATHS` (revisión del diff: no hay `/molotes` ni `/birria` escritos a mano en las plantillas nuevas).

### Pruebas negativas y casos límite
- **N-1.** El pie no contiene otro enlace al mismo destino; el aviso de `/` (martes-viernes y lunes) mantiene su propio enlace a `/molotes` fuera del pie.
- **N-2.** Logo bloqueado (`Network.setBlockedURLs *.webp`): el texto sigue visible, el nombre accesible no cambia, sin desbordamiento ni icono de imagen rota con texto alternativo.
- **N-3.** `/` en lunes con el aviso "Descanso" abierto: el enlace del pie sigue presente (no se tapa en el DOM; el modal es otra capa).

### Pruebas responsive
Viewports: 320×640 (CA-4), 375×812, 768×1024, 1024×768 (4 columnas), 1280×800 (CA-4) y 1440×900, en `/`, `/birria` y `/molotes`.
- **RS-1.** `document.scrollingElement.scrollWidth <= clientWidth` (sin desbordamiento horizontal).
- **RS-2.** El rectángulo del enlace queda dentro del viewport en horizontal y mide ≥ 44×44 px.
- **RS-3.** El `<span>` no se recorta (`scrollWidth <= clientWidth`) y el logo no se deforma (relación de aspecto renderizada ≈ 461:512 / 418:512).
- **RS-4.** Al final del desplazamiento y al llegar con Tab, el rectángulo del enlace no se cruza con `.whatsapp-cta--floating` (320, 375 y 414 px; incluido el caso con el enlace colocado justo bajo el CTA antes de pulsar Tab).
- **RS-5.** Capturas de cada pie a 320, 768 y 1280 px, con y sin foco.

### Pruebas de accesibilidad
- **A-1.** Nombre accesible desde el árbol de accesibilidad de Chrome (`Accessibility.getPartialAXTree` o `read_page`): rol `link`, nombre exacto "Conoce nuestros Molotes" / "Conoce nuestra Birria", sin repetición; la imagen es ignorada (presentacional).
- **A-2.** Orden de Tab: el enlace es alcanzable desde el elemento anterior; `:focus-visible` con `outline-style` distinto de `none` y contraste del contorno ≥ 3:1 frente al fondo del pie.
- **A-3.** Área táctil ≥ 44×44 px (de RS-2).
- **A-4.** Contraste del texto ≥ 4.5:1 con colores computados (texto contra el fondo resultante de la capa translúcida sobre el fondo del pie), en reposo y en hover, en ambas landings.
- **A-5.** Jerarquía de encabezados y número de `h1` sin cambios respecto a `main` (el cambio no añade encabezados); landmarks intactos.

### Pruebas UX/UI (vs. _stich_source_/)
- Sin equivalente en `_stich_source_/` (diferencia deliberada, R-4). Se valida contra la decisión aprobada: botón "Secondary / Ghost" de `birria_tradicional_jalisciense/DESIGN.md` (borde ámbar, texto crema) y botón "Secondary" de `moloteando_tradicional/DESIGN.md` (cobalto translúcido, texto blanco), logo sobre círculo claro, mayúsculas, sin competir con el CTA de WhatsApp.
- El resto del pie de cada landing no cambia visualmente (comparación de capturas con `main` solo si el diff del snapshot muestra algo más que las 4 líneas del enlace).

### Pruebas de integración (WhatsApp)
- El CTA flotante y los CTA de WhatsApp de ambas landings conservan `href`, `target` y `rel` (suite existente y comprobación en Chrome); solo se valida que no tapan el enlace nuevo (RS-4).

### Pruebas de performance
- Petición del logo del otro negocio: solo al acercarse el pie (lazy), tamaño transferido y ausencia de saltos de diseño (dimensiones declaradas). Registro informativo.
- Consola sin errores ni 404 en las tres rutas.

### Pruebas SEO
- `title`, meta description, canonical y Open Graph de cada landing sin cambios (comparación del `<head>` con el snapshot previo); el enlace interno es rastreable (`<a href>` relativo).

### Pruebas de regresión
- **RG-1.** `npm test` completo (incluye `app.test.ts` del pie y contacto de REQ-F-032, `home-notice.test.ts`, `landing-dom.test.ts`, `birria-veracity.test.ts`, `landing.test.ts`, `business-hours.test.ts`, snapshots).
- **RG-2.** Revisión del diff de los snapshots: solo las 4 líneas nuevas por landing.
- **RG-3.** Aviso de `/` (lunes y martes-viernes) sigue abriendo y su enlace funciona; `/molotes` y `/birria` sin aviso.
- **RG-4.** Vista previa del administrador (consumidor de `renderLandingPage` vía `renderLanding`): carga con 200 y muestra el enlace sin romper la página, si el entorno local permite autenticarse; si no, queda cubierta por la suite.
- **RG-5.** `git diff main --stat -- restaurante/public` vacío (sin assets ni JS nuevos); sin cambios ajenos al ticket en la rama.

### Pruebas automatizadas
- Existentes y nuevas del ticket (ya creadas por senior-fullstack): `tests/unit/footer-cross-link.test.ts`, ampliaciones de `tests/unit/content.test.ts` y `tests/integration/app.test.ts` (REQ-F-033), snapshots.
- **AU-1.** `npm run build:css`. **AU-2.** `npm run typecheck`. **AU-3.** `npm run lint` (sin `lint:fix`). **AU-4.** `npm test` (con MySQL de pruebas levantado: `npm run db:up`).
- No se prevé crear pruebas nuevas en `restaurante/tests/`. La cobertura automática actual cubre CA-1, CA-2, CA-3, CA-6; CA-4 y CA-5 dependen del layout y se validan en navegador. Los scripts de medición (CDP) van en el scratchpad, no en el repositorio.

### Pruebas en navegador
- Servidor propio en segundo plano (`PORT=3100 npm start`, o `npm run dev` para usar `?dia=`), con el `.env` existente; si falta configuración, se registra como bloqueo de entorno. Se detiene al terminar.
- Claude in Chrome (pestaña nueva, cerrada al final): inspección visual, foco con Tab, Enter y clic, árbol de accesibilidad, consola y red. Sin seguir el enlace de WhatsApp.
- Chrome headless por CDP con script propio en el scratchpad para las medidas repetibles (RS-1 a RS-4, A-2, A-4, N-2, F-6) y las capturas. Se reejecuta de forma independiente, sin reutilizar los resultados del Implementation Result.

### Evidencia requerida
- Salida resumida de `build:css`, `typecheck`, `lint` y `npm test` (archivos y pruebas).
- `git diff --stat` de la rama y de `restaurante/public`.
- JSON de medidas por ruta y ancho, y capturas a 320, 768 y 1280 px (con y sin foco, y sin logo) con rutas absolutas en el scratchpad.
- Nombre accesible del árbol de accesibilidad, ratios de contraste calculados y estado HTTP del destino.

### Criterios de aprobación
- CA-1 a CA-7 en PASS con evidencia; `npm test`, `typecheck` y `lint` en 0.
- Sin defectos `BLOCKER` ni `CRITICAL`; `MAJOR` solo con aceptación explícita del usuario.
- Sin regresión en el pie, el aviso de `/`, el contacto de REQ-F-032 ni el CTA de WhatsApp.
- Si Claude in Chrome no responde, CA-4 y CA-5 pueden darse por validados con la evidencia CDP headless (medidas y capturas); si tampoco esa vía funciona, se devuelve `NEEDS_USER_DECISION`.

## QA Report

### Ronda
1 (2026-10-16). QA Action Plan aprobado por el usuario: "lo apruebo".

### Pruebas ejecutadas
- `git branch --show-current`: `feature/REQ-F-033-navegacion-cruzada-footer`. `git status`: solo los archivos del ticket, más los ajenos ya conocidos (sin tocar).
- `npm run build:css`: OK. `npm run typecheck`: 0. `npm run lint`: 0, sin avisos.
- `npm test`: primero falló por entorno (Docker detenido, sin MySQL de pruebas). Arranqué Docker Desktop y ejecuté `npm run db:up`. Resultado: **91 archivos; 1829 pruebas pasadas y 1 *expected fail* (ya existía); salida 0**.
- Diff de los snapshots: solo 4 líneas `+` por landing (`<a class="cross-link">`, `<img>`, `<span>`, `</a>`). El `<head>` no cambia.
- `git diff --stat -- restaurante/public`: vacío, y `git status` no muestra nada en `public/`.
- Servidor propio: `PORT=3100 NODE_ENV=development`. Bloqueo de entorno: el `.env` tiene una `WHATSAPP_BOT_BLOCKLIST_KEY` no válida. Se resolvió con una clave temporal aleatoria solo para ese proceso, sin modificar `.env`. El servidor ya está detenido y el puerto 3100 está libre.
- HTML servido, analizado con jsdom (`/private/tmp/claude-501/-Users-orvigas-Desktop-Negocio/291ea311-1716-458c-af85-6065feab38b5/scratchpad/qa033/served.mjs`), en `/`, `/?dia=lunes`, `/?dia=martes`, `/?dia=sabado`, `/birria` y `/molotes`:
  - un único `a.cross-link` en el pie y un único enlace al destino;
  - `href` correcto, texto correcto e imagen con `alt=""`, 461×512 o 418×512, `lazy` y `async`;
  - sin `target`, `rel`, `data-action`, `aria-label` ni `title`;
  - en la primera columna del pie, con un solo `h1`;
  - title, canonical y `og:title` del negocio correcto;
  - destino 200 sin redirección;
  - aviso `molotes` / `rest` / ninguno según el día, con su propio enlace a `/molotes` fuera del pie.
- **Claude in Chrome** (pestaña propia, ya cerrada), viewport 1280×906:
  - el árbol de la extensión expone el enlace "Conoce nuestros Molotes" dentro de `contentinfo` y la imagen no aparece;
  - Tab real desde el elemento anterior: el foco queda en el enlace, con `:focus-visible` y contorno `solid 2px rgb(251,191,36)` visible en la captura, sin cruzarse con el CTA;
  - Enter: navega a `/molotes` en la misma pestaña, 200, `redirectCount` 0;
  - clic real en el enlace del pie de `/molotes`: navega a `/birria`, 200, sin redirección;
  - consola sin errores.
  - **Limitación:** `resize_window` no cambia el viewport (siguió en 1280). Un iframe del mismo origen lo bloquea la CSP (`frame-src https://www.google.com`). Por eso, en Claude in Chrome no se pudieron validar 320, 768 ni otros anchos de móvil o tableta.
- **Chrome headless por CDP** (`/private/tmp/claude-501/-Users-orvigas-Desktop-Negocio/291ea311-1716-458c-af85-6065feab38b5/scratchpad/qa033/cdp.mjs`, resultados en `/private/tmp/claude-501/-Users-orvigas-Desktop-Negocio/291ea311-1716-458c-af85-6065feab38b5/scratchpad/qa033/out/results.json`):
  - 5 variantes de página (`/` martes, lunes y sábado; `/birria`; `/molotes`) × 8 anchos (320, 360, 375, 414, 768, 1024, 1280 y 1440);
  - Tab real (`Input.dispatchKeyEvent`) con el enlace colocado 5, 20 y 60 px bajo el borde del CTA, en 320, 360, 375 y 414;
  - contraste con colores computados, en reposo y con `:hover` forzado;
  - árbol de accesibilidad de Chrome;
  - `.webp` bloqueados;
  - JavaScript deshabilitado, con clic real;
  - capturas.

### Criterios de aceptación
| CA | Resultado | Evidencia |
|---|---|---|
| CA-1 | **BLOCKED (ambigüedad, pregunta 1)** | Presencia, unicidad, `href` y logo: PASS (jsdom sobre el HTML servido y la suite). Nombre accesible: el contenido DOM es "Conoce nuestros Molotes", pero Chrome lo calcula como **"CONOCE NUESTROS MOLOTES"** (`Accessibility.getPartialAXTree`), porque aplica `text-transform: uppercase` (decisión técnica 2). La imagen no aporta nombre. |
| CA-2 | **BLOCKED (ambigüedad, pregunta 1)** | Igual que CA-1: `href="/birria"` y `logo-birria.webp` PASS; nombre en Chrome "CONOCE NUESTRA BIRRIA". |
| CA-3 | PASS | Sin `target`. Enter (Claude in Chrome) y clic (Claude in Chrome y headless): carga la otra landing, 200, sin redirección. Integración REQ-F-033 en `app.test.ts` en verde. |
| CA-4 | **PASS en headless; pendiente de decisión (pregunta 2)** | 1280: PASS en Claude in Chrome (foco visible, 254×50, sin cruzarse con el CTA, sin desbordamiento). En headless, 40 combinaciones: desbordamiento 0 px; enlace dentro del viewport; 254×50 (Birria) o 228×50 (Molotes) y 216/222×50 a 1024 con texto en 2 líneas sin recorte; logo sin deformar (0.91 y 0.835, iguales a 461:512 y 418:512); sin cruce con el CTA al final de la página; 60/60 pruebas de Tab con foco activo, `:focus-visible`, dentro del viewport y sin cruce con el CTA. Por indicación del usuario no se da por validado solo con headless para 320 y 768. |
| CA-5 | PASS | Contraste medido con colores computados en Claude in Chrome (1280) y en headless. Birria / `/`: 13.13:1 en reposo y 10.36:1 en hover. Molotes: 14.36:1 en reposo y 12.31:1 en hover. El color del texto y del fondo no depende del ancho (sin variantes responsive en esas clases). |
| CA-6 | PASS | Con JavaScript deshabilitado (CDP), el clic real navega: `/birria` a `/molotes`, `/molotes` a `/birria` y `/?dia=martes` a `/molotes`. Sin cambios en `restaurante/public`. |
| CA-7 | PASS | `typecheck` 0, `lint` 0 y `npm test` 0. Diff de los snapshots revisado: solo las 4 líneas del enlace en cada landing. |

Casos límite:
- **Logo sin cargar:** PASS. Con `*.webp` bloqueado, a 320 y 1280, el texto sigue visible, el nombre no cambia, el tamaño se mantiene y no hay desbordamiento. Observación: Chrome dibuja el icono de imagen rota dentro del círculo (`birria-320-sin-logo.png`). No lo exige ningún requisito; es cosmético.
- **CTA flotante en móvil:** PASS en headless (ver CA-4).
- **REQ-F-034:** no aplica todavía.

### Defectos encontrados
Ninguno clasificado como defecto. Hay una `REQUIREMENT_AMBIGUITY`:
- **AMB-1 (CA-1, CA-2).** El ticket exige el nombre accesible "Conoce nuestros Molotes" / "Conoce nuestra Birria". La decisión técnica aprobada (texto en mayúsculas por CSS) se justificó con que "los lectores de pantalla leen el texto del contenido". En Chrome, el nombre accesible calculado sale en mayúsculas.
  - Las palabras son las mismas y no hay duplicación.
  - Los demás CTA en mayúsculas del proyecto usan el mismo patrón.
  - La pregunta es si la capitalización forma parte del criterio.

### Regresión
- La suite completa está en verde: incluye pie y contacto de REQ-F-032, aviso de `/` (`home-notice`), `landing-dom`, `birria-veracity`, `landing`, `business-hours` y snapshots.
- Aviso de `/` (lunes y martes) presente, con su enlace a `/molotes` fuera del pie. `/birria` y `/molotes` sin aviso.
- La vista previa del administrador comparte `renderLandingPage` (CodeGraph: `renderLanding`). No se abrió en el navegador porque requiere autenticación; queda cubierta por la suite.
- CTA de WhatsApp: sin cambios en el diff y suite en verde.

### Responsive
Ver CA-4. Capturas en `/private/tmp/claude-501/-Users-orvigas-Desktop-Negocio/291ea311-1716-458c-af85-6065feab38b5/scratchpad/qa033/out/`:
- `{inicio,birria,molotes}-{320,768,1280}.png` y `-foco.png`;
- `{birria,molotes}-{320,1280}-sin-logo.png`.

### Accesibilidad
- Rol `link` con un único nombre: la imagen queda fuera del árbol de accesibilidad, así que no se duplica.
- Foco visible: contorno frente al fondo del pie de 15.74:1 (Birria) y 17.74:1 (Molotes).
- Área de 50 px de alto y 216-254 px de ancho.
- Un solo `h1` y ningún encabezado nuevo.
- Pendiente: AMB-1.

### UX/UI
- No tiene equivalente en `_stich_source_/` (desviación deliberada, R-4).
- Coincide con lo aprobado:
  - Birria: botón ghost con borde ámbar y texto crema;
  - Molotes: botón cobalto translúcido con texto blanco;
  - logo sobre un círculo claro;
  - mayúsculas;
  - en la columna de marca;
  - no compite visualmente con "ORDENAR YA!".

### Performance
- Sin assets nuevos.
- `logo-molotes.webp` (86 KB) ya se descargaba en `/` de martes a viernes por el aviso; ahora también se descarga en `/birria`.
- Con `loading="lazy"`, en Chrome de escritorio a 1280 la imagen se pidió antes de desplazarse, por el umbral de distancia del navegador. Es informativo: el atributo exigido está presente.
- Dimensiones declaradas. Consola sin errores ni respuestas ≥ 400 (headless y Claude in Chrome).

### SEO
- `<head>` sin cambios (diff de los snapshots).
- title, description, canonical y Open Graph correctos para cada negocio.
- El enlace interno `<a href>` es rastreable.

### Pendientes de revisión manual
- CA-4 a 320 y 768 px en un navegador con ventana real de ese ancho (en Claude in Chrome no se pudo emular el ancho).

### Resultado final (ronda 1, antes de la decisión)
NEEDS_USER_DECISION

Preguntas:
1. AMB-1: en Chrome, el nombre accesible del enlace sale en mayúsculas ("CONOCE NUESTROS MOLOTES" / "CONOCE NUESTRA BIRRIA") por el `uppercase` que aprobaste. ¿Das CA-1 y CA-2 por cumplidos (mismas palabras, sin duplicación) o quieres que se corrija para que el nombre conserve la capitalización (por ejemplo, sin mayúsculas en este enlace)?
2. CA-4 a 320 y 768 px solo se pudo validar en Chrome headless, con las medidas y capturas indicadas. A 1280 está validado también en Claude in Chrome. ¿Aceptas esa evidencia, o prefieres revisarlo tú en el móvil o la tableta antes de aprobar?

### Decisión del usuario (2026-10-16)
Respuesta textual: "Aprueba con todas las sugerencias". Las sugerencias eran:
1. Aceptar AMB-1: el nombre accesible en mayúsculas ("CONOCE NUESTROS MOLOTES" / "CONOCE NUESTRA BIRRIA"), que viene del `uppercase` aprobado. CA-1 y CA-2 pasan a **PASS**.
2. Aceptar la evidencia de Chrome headless para CA-4 a 320 y 768 px. CA-4 pasa a **PASS**.

No se ejecutaron pruebas nuevas ni se tocó código: la decisión se aplica sobre la evidencia de la ronda 1.

### Resultado final
QA_APPROVED

CA-1 a CA-7 en PASS. Sin defectos BLOCKER, CRITICAL ni MAJOR. `npm test`, `typecheck` y `lint` en 0. Sin regresiones. Queda como observación cosmética, fuera de requisito, el icono de imagen rota que Chrome dibuja si el logo no carga.

## Historial de cambios

### Versión 1
Descripción inicial, aprobada por el usuario el 2026-10-15.

### Revisión técnica (senior-fullstack, 2026-10-15)
Revisión contra `origin/main` (6ccfec0). Sin bloqueos. Se añade el Technical Action Plan y el estado pasa a `NEEDS_TECHNICAL_PLAN_APPROVAL`.

### Inicio de implementación (2026-10-15)
Plan aprobado ("1 si"). Rama `feature/REQ-F-033-navegacion-cruzada-footer` desde `main` (8414a12). El ticket pasa a `in-progress/` con estado `IN_PROGRESS`. Se movió con `mv` y no con `git mv` porque aún no estaba versionado.

### Implementación (2026-10-15)
Implementado según el plan aprobado. Validaciones en verde y verificación en Chrome headless sin fallos. Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

### QA Action Plan (senior-qa, 2026-10-16)
Implementación aprobada por el usuario ("apruebo la implementacion Revisión técnica REQ-F-033"). Se añade el QA Action Plan. Estado: `NEEDS_QA_PLAN_APPROVAL`.

### QA ronda 1 (senior-qa, 2026-10-16)
QA Action Plan aprobado ("lo apruebo"). Validación ejecutada: suite, typecheck y lint en 0; CA-3, CA-5, CA-6 y CA-7 PASS; CA-1 y CA-2 bloqueados por ambigüedad del nombre accesible en mayúsculas; CA-4 validado en headless y pendiente de aceptación. Estado: `NEEDS_USER_DECISION`.

### Decisión de QA (senior-qa, 2026-10-16)
El usuario aceptó las dos sugerencias ("Aprueba con todas las sugerencias"): el nombre accesible en mayúsculas cumple CA-1 y CA-2, y la evidencia headless de CA-4 a 320 y 768 px es suficiente. Estado: `QA_APPROVED`.
