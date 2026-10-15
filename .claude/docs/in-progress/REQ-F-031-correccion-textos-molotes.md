# REQ-F-031 — Corrección de textos y datos comerciales de la landing de Molotes

## Estado

QA_APPROVED

## Aprobación

Aprobado por el usuario (versión 1, fecha 2026-10-15): "Si lo apruebo así y lo del spam".

La aprobación incluye las métricas de R-3, los textos de la promoción de R-10 y el `title` del iframe de R-16. "Lo del spam" significa que R-11 queda como "Sin spam molesto." y se quita "Solo promociones crujientes y reales.", porque el formulario no envía datos.

Decisiones previas del usuario sobre las preguntas del análisis: "Si apruebo todo lo sugerido". Sobre Birria: "No, lo trabajamos separado". Birria queda fuera de alcance y tendrá su propio ticket.

Nota del análisis: en la sesión del Business Analyst no estaba disponible CodeGraph (ni la herramienta MCP ni el CLI). El análisis se hizo con lecturas dirigidas de `src/content/molotes/index.ts`, `src/content/molotes/seed.json`, `src/content/common/index.ts`, `src/views/pages/molotes.html`, `public/js/modules/promo-form.js`, `src/app.ts`, `tests/unit/content.test.ts` y del `README.md`.

## Objetivo

Que https://birriaelmuneco.com/molotes describa la operación real de Molotes:

- molotes estilo poblano;
- empezó en 2026;
- una sola sucursal;
- entregas con motomandados y costo según la distancia;
- teléfono oficial +527352782306;
- mapa oficial.

Se eliminan las afirmaciones inventadas sin rediseñar la página ni cambiar funcionalidades.

## Alcance

- Textos de `restaurante/src/content/molotes/index.ts`.
- Textos de la promoción en `restaurante/src/content/molotes/seed.json`. En producción se cambian desde /admin/molotes (CA-13).
- Una ubicación propia de Molotes, con el iframe oficial y el enlace "Cómo llegar".
- Ajustes mínimos de `restaurante/src/views/pages/molotes.html`: casillas de plataformas, línea de correo e inserción del mapa.
- Permitir el iframe de Google en la CSP.
- Ajuste de la prueba CA-39 (`tests/unit/content.test.ts`) y del snapshot `tests/snapshots/landing-molotes.html`.

## Fuera de alcance

- Birria El Muñeco. Tendrá su propio ticket.
- `common.location.mapsUrl`, que usan Birria y el bot. No cambia.
- El bot de WhatsApp, el número de WhatsApp (`WHATSAPP_MOLOTES`) y la lógica del aviso por día.
- Productos, precios y sabores, que viven en MySQL. Las listas de productos de `seed.json` no cambian.
- Los textos de proceso y receta, que se conservan: metate y prensa de madera, 185 °C, maíz azul y blanco, parcelas poblanas, cal viva, piedra volcánica, crema de Chipilo, puré de papa criolla.
- Añadir JSON-LD. Hoy no existe y añadirlo sería una funcionalidad nueva.
- El envío real del formulario de promoción. Hoy no envía datos y así sigue.
- Cambios de diseño, framework o dependencias.

## Hallazgo: dónde vive cada texto

| Texto | Dónde vive | Cómo llega a producción |
|---|---|---|
| SEO, hero, ritual, métricas, servicio, plataformas, etiquetas y mensajes del formulario, pie, contacto, copyright | `src/content/molotes/index.ts` (código) | Con el despliegue |
| Promoción (`badge`, `title`, `description`), showcase del hero y texto destacado del menú | `DATA_DIR/molotes/current.json`, editable en /admin/molotes. La semilla `seed.json` solo se copia si no existe `current.json` | **Paso manual en /admin/molotes** (CA-13) |
| Productos y bebidas | MySQL | No cambian |
| Ubicación común | `src/content/common/index.ts:18`, compartida por Birria y por el bot | No cambia |

## Requisitos

Todas las líneas se refieren a `restaurante/src/content/molotes/index.ts`, salvo donde se indica otro archivo.

| ID | Ubicación | Antes | Después |
|---|---|---|---|
| R-1 | 137 (`footer.about`) | "Tradición crujiente de maíz rellena de sazón mestizo. Molotes poblanos y oaxaqueños con crema de rancho, queso fresco y salsas de molcajete." | "Molotes estilo poblano, crujientes y hechos a mano, con crema de rancho, queso fresco y salsas de molcajete." |
| R-2 | 97 (`ritual.paragraphs.0`) | "…Logramos esta textura inigualable templando… celosamente cronometrados por tres generaciones de maestras cocineras." | "El secreto de un verdadero molote radica en su cáscara: debe sonar crujiente al primer mordisco sin absorber un gramo de grasa de más. Logramos esta textura templando la masa con un toque sutil de puré de papa criolla y cuidando cada fritura en el comal." |
| R-3 | 100–104 (`ritual.metrics`) | "+15 Años de Tradición", "3 Sucursales Activas", "1,500+ Molotes Diarios" | ① valor "2026", título "Desde", nota "Comal recién encendido". ② valor "1", título "Sucursal", nota "Te esperamos de martes a viernes". ③ valor "A mano", título "Hecho pieza por pieza", nota "Masa recién amasada" |
| R-4 | 52 (`nav`) | "Sucursales" | "Ubicación" (mismo destino, `#pedidos-seccion`) |
| R-5 | 157 (`footer.contact.title`) | "Contacto & Sucursales" | "Contacto y ubicación" |
| R-6 | 110 (`service.description`) | "Enviamos en empaques térmicos transpirables…" | "Disfruta tus molotes crujientes hasta tu puerta. Contamos con servicio de entrega mediante motomandados; el costo se calcula según la distancia de entrega. Consulta el costo al realizar tu pedido por WhatsApp." |
| R-7 | 119–124 (`service.platforms`) y `molotes.html:243-270` | 4 casillas: WhatsApp, Uber Eats, Rappi, En Sucursal | 2 casillas: "WhatsApp" / "Sin comisiones" (enlace al bot, sin cambios) y "Motomandados" / "Costo según distancia" (informativa, sin enlace). Se quitan Uber Eats, Rappi y "En Sucursal", porque no está confirmado que se pueda recoger. La cuadrícula se ajusta para no dejar huecos |
| R-8 | 131 (`promo.submit`) | "Activar Mi Descuento 2x1" | "Activar promoción" |
| R-9 | 132 (`promo.success`) | "¡Listo! Revisa tu bandeja para activar tu 2x1 este próximo jueves." | "¡Gracias por tu interés! Pregunta por la promoción vigente al pedir por WhatsApp." |
| R-10 | `seed.json:181-183` (y `current.json` en producción) | badge "Promoción Tradicional"; título "Jueves de Molotes 2x1"; descripción con "Club del Comal", "cupón semanal de 2x1", "ofertas secretas de temporada" y "molote de mole poblano con plátano macho" | badge "Promociones"; título "Promociones de Molotes"; descripción "Pregunta por la promoción vigente al hacer tu pedido por WhatsApp. Déjanos tus datos y no te pierdas nuestras novedades." No se publica ninguna condición, día ni porcentaje |
| R-11 | 133 (`promo.disclaimer`) | "Sin spam molesto. Solo promociones crujientes y reales." | "Sin spam molesto." |
| R-12 | 158 (`footer.contact.address`) y `molotes.html:346` | "Callejon del Sabor #42, Col. San Jerónimo, Ciudad de México" | "Ver ubicación en Google Maps". El enlace lleva a la ubicación de Molotes (R-15) |
| R-13 | 159 (`footer.contact.phone`) | "+52 55 4892 0184", `tel:+525548920184` | "+52 735 278 2306", `tel:+527352782306`. Es el teléfono de llamadas, distinto del WhatsApp del bot |
| R-14 | 160 (`footer.contact.email`) y `molotes.html:348` | `antojos@moloteando.mx` | Se oculta la línea de correo hasta que exista una dirección confirmada en @birriaelmuneco.com. No se publica ningún correo inventado |
| R-15 | Contenido de Molotes (dato nuevo) | Usa la ubicación común | Ubicación propia de Molotes. Enlace: `https://www.google.com/maps/search/?api=1&query=18.81823603166285,-98.96914471124853`. `src` del mapa: el oficial (ver más abajo), tal cual, en vista Street View. `common.location.mapsUrl` no cambia |
| R-16 | `molotes.html`, sección "Servicio y Domicilio" (`#pedidos-seccion`), columna izquierda bajo las plataformas | No hay mapa | Iframe adaptable al ancho, sin el ancho fijo de 600 px. Lleva `title` "Ubicación de Moloteando en Google Maps", `loading="lazy"`, `referrerpolicy="strict-origin-when-cross-origin"` y `allowfullscreen`. Debajo va el enlace "Cómo llegar" a R-15, que abre en otra pestaña con `rel="noopener noreferrer"` y texto de apoyo para lectores de pantalla. Usa los estilos existentes de la sección |
| R-17 | `src/app.ts:135` (`helmet()`) | La CSP por defecto (`default-src 'self'`, sin `frame-src`) bloquea el iframe | Permitir solo `https://www.google.com` en `frame-src`, sin relajar ninguna otra directiva. La forma concreta la decide senior-fullstack |
| R-18 | 58 (`hero.pills.2`) | "4.9 ★ en Calificaciones" | "Estilo Poblano" |
| R-19 | 162 (`footer.copyright`) | "© 2024 Moloteando S.A. de C.V. Todos los derechos reservados. Antojería de Barrio." | "© 2026 Moloteando. Todos los derechos reservados." |
| R-20 | 145 (`footer.nav.links.4`) | "Facturación y Pedidos Express" | "Pedidos y Domicilio" |
| R-21 | 114 (`service.schedule.note`) | "* Lunes cerramos comales por molienda de nixtamal artesanal y curación de cazuelas. Sábados y domingos te esperamos en Birria El Muñeco." | "* Lunes descansamos. Sábados y domingos te esperamos en Birria El Muñeco." |
| R-22 | 153 (`footer.hours.rows.2`) | "Lunes" / "Cerrado por nixtamal" | "Lunes" / "Cerrado" |
| R-23 | `tests/unit/content.test.ts:101-108` (CA-39) | Exige que los textos de la promo de la semilla estén en `_stich_source_` | Los textos comerciales corregidos de la promo prevalecen sobre `_stich_source_`. El resto de la comprobación (platillos, bebidas, hero, texto destacado) se mantiene. El diseño sigue mandando en lo visual |

`src` oficial del mapa (R-15), proporcionado por el usuario:

```text
https://www.google.com/maps/embed?pb=!4v1792064722212!6m8!1m7!1sCliD7xRS-mkCpf6MwseHcQ!2m2!1d18.81823603166285!2d-98.96914471124853!3f189.613958693852!4f-9.01272483181998!5f0.7820865974627469
```

Se conservan sin cambios:

- Nombres, descripciones y precios de los productos, incluido "Molotes de Queso Oaxaca", que nombra el tipo de queso y no el estilo.
- Los textos de proceso y receta.
- Title y description SEO, `alt` de las imágenes, horarios y anuncio.
- El bot y `common.location`.

## Historias de usuario

- **HU-1.** Como cliente quiero información verdadera sobre Molotes (origen, sucursal, entregas) para decidir mi pedido sin falsas expectativas.
- **HU-2.** Como cliente quiero ver dónde está Molotes y abrir la ruta para llegar.
- **HU-3.** Como cliente quiero llamar al número correcto con un toque.
- **HU-4.** Como dueño quiero que la página no prometa promociones ni correos que no existen.

## Reglas de negocio

- **RN-1.** No se publica ningún dato comercial sin confirmar: correo, dirección postal, promoción, recoger en sucursal, estadísticas.
- **RN-2.** El costo de envío siempre se consulta por WhatsApp. No se publican tarifas, tiempos, cobertura ni envío gratis.
- **RN-3.** El teléfono de llamadas y el WhatsApp del bot son datos distintos. El WhatsApp no cambia.

## Criterios de aceptación

- **CA-1.** El HTML de `/molotes` no contiene ninguno de estos textos: "oaxaqueños", "15 Años", "generaciones", "1,500", "Sucursales Activas", "Sucursales", "térmic", "Uber", "Rappi", "moloteando.mx", "2x1", "2×1", "Jueves", "Club del Comal", "ofertas secretas", "plátano macho", "Callejon del Sabor", "San Jerónimo", "5548920184", "4.9", "S.A. de C.V.", "2024", "Facturación", "curación de cazuelas", "Cerrado por nixtamal", "Solo promociones crujientes y reales". "Queso Oaxaca" sí puede aparecer.
- **CA-2.** El botón del formulario dice exactamente "Activar promoción". Al enviar con datos válidos se oculta el formulario y aparece "¡Gracias por tu interés! Pregunta por la promoción vigente al pedir por WhatsApp.". Con datos inválidos se muestra la validación nativa. No hay ninguna petición de red nueva.
- **CA-3.** El pie muestra "+52 735 278 2306" con `href="tel:+527352782306"`.
- **CA-4.** El pie no muestra ninguna línea de correo.
- **CA-5.** La sección "Servicio y Domicilio" contiene un iframe con el `src` oficial, el `title` "Ubicación de Moloteando en Google Maps" y `loading="lazy"`. Carga sin errores de CSP. A 320, 768 y 1280 px de ancho no hay desbordamiento horizontal.
- **CA-6.** "Cómo llegar" y "Ver ubicación en Google Maps" enlazan a `https://www.google.com/maps/search/?api=1&query=18.81823603166285,-98.96914471124853` y abren en otra pestaña con `rel="noopener noreferrer"`.
- **CA-7.** En `/birria`, en `/` y en la respuesta "Horario y ubicación" del bot, el enlace de ubicación sigue siendo `https://maps.app.goo.gl/sAFDEeLdKzs7GGPz9`.
- **CA-8.** Las plataformas muestran solo "WhatsApp / Sin comisiones" (enlace al bot, sin cambios) y "Motomandados / Costo según distancia", sin casillas vacías ni huecos.
- **CA-9.** Estos textos coinciden con sus requisitos: la descripción del servicio (R-6), las métricas (R-3), la pill (R-18), el aviso del formulario "Sin spam molesto." (R-11), el copyright (R-19), el enlace del pie (R-20), la nota de los lunes (R-21) y la fila de los lunes (R-22).
- **CA-10.** `seed.json` contiene los textos de R-10 y sus listas de productos no cambian.
- **CA-11.** La CSP no permite ningún otro origen de iframe además de `https://www.google.com`, y las demás directivas no se relajan.
- **CA-12.** `npm run typecheck`, `npm run lint` y `npm test` terminan en verde, con CA-39 ajustada según R-23 y el snapshot de la landing de Molotes actualizado.
- **CA-13.** Tras el despliegue, el usuario edita la promo en /admin/molotes con los textos de R-10. Entonces `/molotes` en producción ya no muestra "2x1" ni "Jueves". Es un paso manual, documentado en el resultado de la implementación.

## Casos límite

- **Google no responde o bloquea el iframe:** el enlace "Cómo llegar" sigue disponible.
- **Sin JavaScript:** el iframe y los enlaces funcionan; el formulario se comporta igual que hoy.
- **"Restaurar semilla original" en /admin/molotes:** se restauran los textos corregidos.
- **Promo en producción:** hasta que se haga el paso manual de CA-13, sigue mostrando los textos anteriores, porque `current.json` no cambia con el despliegue.
- **Móvil:** el iframe ocupa el ancho disponible sin desbordar; la cuadrícula de 2 plataformas no deja huecos.

## Dependencias

- La revisión técnica de la CSP (R-17) por senior-fullstack.
- El paso manual del usuario en /admin/molotes (CA-13).

## Riesgos

- Si no se hace CA-13, la promoción no verificada sigue publicada en producción.
- Una CSP mal ajustada podría abrir más orígenes de los necesarios.
- El iframe Street View puede pesar en móvil; se mitiga con `loading="lazy"`.

## Datos pendientes (no bloquean)

- Correo exacto en @birriaelmuneco.com. Cuando exista, se vuelve a mostrar la línea de correo.
- Dirección postal.
- Si Birria y el bot comparten la ubicación de Molotes (`common.location`).
- Promoción vigente y sus condiciones.
- Si se puede recoger en la sucursal.

## Action Plan

### Objetivo

El indicado en "Objetivo".

### Orden recomendado

1. Cambiar los textos de `content/molotes/index.ts`: R-1 a R-6, R-8, R-9, R-11 a R-13 y R-18 a R-22.
2. Crear la ubicación propia de Molotes en su contenido (R-15) y usarla en sus enlaces de la plantilla.
3. Ajustar la plantilla: cuadrícula de 2 plataformas (R-7), quitar la línea de correo (R-14) e insertar el mapa con "Cómo llegar" (R-16).
4. Añadir a la CSP `frame-src` limitado a `https://www.google.com` (R-17).
5. Cambiar los textos de la promo en `seed.json` (R-10) y ajustar CA-39 (R-23).
6. Actualizar el snapshot y las pruebas de landing; ejecutar typecheck, lint y test.
7. Revisar que no queden residuos (CA-1) en el HTML publicado, distinguiéndolo de comentarios e historial.
8. Documentar el paso manual en /admin/molotes (CA-13) y los datos pendientes.

### Resultado esperado

La landing de Molotes comunica fielmente la operación actual, sin información inventada, conserva el diseño y las funcionalidades y supera las validaciones. No hay commits, push ni despliegue en esta tarea.

## Trazabilidad

| Objetivo | Requisitos | Historias | Criterios |
|---|---|---|---|
| Identidad poblana | R-1, R-18 | HU-1 | CA-1, CA-9 |
| Antigüedad y sucursal reales | R-2, R-3, R-4, R-5, R-19 | HU-1 | CA-1, CA-9 |
| Entregas reales | R-6, R-7 | HU-1 | CA-1, CA-8, CA-9 |
| Promoción sin promesas falsas | R-8, R-9, R-10, R-11, R-23 | HU-4 | CA-1, CA-2, CA-9, CA-10, CA-12, CA-13 |
| Ubicación oficial | R-12, R-15, R-16, R-17 | HU-2 | CA-5, CA-6, CA-7, CA-11 |
| Contacto oficial | R-13, R-14 | HU-3 | CA-3, CA-4 |
| Lunes y navegación | R-20, R-21, R-22 | HU-1 | CA-1, CA-9 |

## Revisión técnica

Revisión de senior-fullstack (2026-10-15), con CodeGraph sobre `src/` y `tests/` y lecturas dirigidas de las plantillas, la semilla, el README y `_stich_source_/moloteando_aut_nticos_molotes_artesanales/code.html`. No hay bloqueos. Se registran estas observaciones y decisiones técnicas:

- **OT-1. CA-1 se verifica sobre el texto publicado, no sobre el HTML crudo.** "4.9" aparece dentro del `path` del icono SVG de WhatsApp (`…l4.945-1.411…`, cuatro veces) y "15 Años" nunca aparece en el HTML crudo porque valor y título van en elementos distintos (`<dd>+15</dd>` y `<dt>Años de Tradición</dt>`). Una búsqueda literal sobre el HTML fallaría por el icono y no detectaría la métrica. La prueba de CA-1 quita los `<svg>`, busca los términos en el HTML restante (atributos incluidos: `href`, `mailto:`, `tel:`) y, además, en el `textContent` del documento con los espacios normalizados.
- **OT-2. CSP.** Helmet 8 (vía `koa-helmet` 9) no emite `frame-src`; el navegador aplica entonces `default-src 'self'` y bloquea el iframe. Se añade solo `frame-src https://www.google.com` conservando los valores por defecto de Helmet (`useDefaults`). No hace falta `child-src`: en CSP 3, `frame-src` gobierna los iframes y prevalece sobre `child-src`, que no se emite. Los recursos que carga el propio iframe (teselas, Street View, scripts de Google) se rigen por la CSP de Google, no por la nuestra, así que no hay que añadir más orígenes. `https://www.google.com/maps/embed` responde en el mismo origen, sin redirección a otro dominio (se confirma en el navegador en QA, CA-5). El iframe lleva `referrerpolicy="strict-origin-when-cross-origin"`, que prevalece para esa petición sobre el `Referrer-Policy: no-referrer` global. La directiva se aplica a todo el sitio (una sola llamada a `helmet()`): es un único origen, no habilita scripts ni estilos y `frame-ancestors 'self'` no cambia. Limitarla solo a `/molotes` exigiría una segunda configuración de Helmet por ruta, sin beneficio real.
- **OT-3. Ubicación propia de Molotes.** Va en `src/content/molotes/index.ts` (`location`), sin tocar `common.location` ni `LandingView.location`. La plantilla de Molotes deja de usar `location.mapsUrl`; el texto "Cómo llegar" y el texto de apoyo para lectores de pantalla siguen siendo los comunes (`location.label` y `location.assistiveText`, idénticos en ambos negocios). Una prueba impide que `/molotes` vuelva a contener el enlace corto común.
- **OT-4. El bot de Molotes sigue enviando la ubicación común.** `hoursAndLocation` (`src/services/whatsapp-bot/messages.ts:111`) usa `commonContent.location.mapsUrl` para ambos negocios. Es lo que pide CA-7 y está en "Datos pendientes"; tras este ticket la landing y el bot de Molotes muestran ubicaciones distintas hasta que se decida en un ticket aparte.
- **OT-5. "Restaurar semilla original".** El repositorio carga `seed.json` al arrancar (`loadSeedDocument` en `createMenuRepository`), así que tras el despliegue la semilla restaurada trae los textos de R-10. Pero /admin/molotes solo ofrece esa acción cuando los datos están dañados (`renderDamaged`); no sirve como atajo para CA-13. El camino de CA-13 es editar los tres campos de la promoción y guardar (límites del esquema: 120, 120 y 400 caracteres; los textos de R-10 caben).
- **OT-6. Otras pruebas dependen del título de la promo de la semilla.** `tests/unit/file-menu-repository.test.ts:127` y `:270` esperan literalmente "Jueves de Molotes 2x1". Se cambian para leer el valor de la semilla, sin debilitarlas.
- **OT-7. Diseño.** `_stich_source_` no tiene mapa ni iframe (en ningún diseño), y su cuadrícula de plataformas es `grid-cols-2 sm:grid-cols-4` con 4 casillas. El mapa se compone con las piezas visuales que ya usa la sección (esquinas `rounded-2xl`, `shadow-md` de `.schedule-box`, tipografía `font-label-md` y el azul `rgb(3,43,95)` de los rótulos). No se añade ningún encabezado ni texto visible que no esté aprobado. La pill de R-18 conserva el icono `star` del diseño, porque el ticket solo cambia su texto.
- **OT-8. Documentación desactualizada.** `README.md:1423` dice que la ubicación es común a ambas landings, y `README.md:1474` menciona Uber Eats y Rappi. Se actualizan.

## Technical Action Plan

### Objetivo técnico

Corregir los textos comerciales de `/molotes` (R-1 a R-22) y añadir la ubicación oficial de Molotes con mapa embebido (R-15 a R-17), sin cambiar el diseño ni el comportamiento de Birria, `/`, el bot o /admin. Ajustar las pruebas sin debilitarlas (R-23).

### Archivos o componentes afectados

- `restaurante/src/content/molotes/index.ts`: textos y nuevo bloque `location`.
- `restaurante/src/content/molotes/seed.json`: solo `data.promo` (R-10).
- `restaurante/src/views/pages/molotes.html`: nav (vía contenido), plataformas, mapa y pie.
- `restaurante/src/app.ts`: configuración de `helmet()` (R-17).
- `restaurante/tests/unit/content.test.ts`, `restaurante/tests/unit/file-menu-repository.test.ts`, `restaurante/tests/integration/app.test.ts`, `restaurante/tests/snapshots/landing-molotes.html`, y si hace falta `restaurante/tests/unit/landing-dom.test.ts`.
- `restaurante/README.md`.
- Sin cambios: `src/content/common/index.ts`, `src/views/landings/*.ts`, `src/views/pages/birria.html`, el bot, `public/js/` y `tests/snapshots/landing-birria.html`.

### Contenido / configuración

En `src/content/molotes/index.ts`:

- R-1 `footer.about`, R-2 `ritual.paragraphs[0]`, R-3 `ritual.metrics` (tres objetos), R-4 `nav[4].label` = "Ubicación", R-5 `footer.contact.title`, R-6 `service.description`, R-8 `promo.submit`, R-9 `promo.success`, R-11 `promo.disclaimer`, R-18 `hero.pills[2].text` = "Estilo Poblano", R-19 `footer.copyright`, R-20 `footer.nav.links[4].label`, R-21 `service.schedule.note` y R-22 `footer.hours.rows[2].hours` = "Cerrado", con el texto exacto de cada requisito.
- R-7: `service.platforms` pasa a dos elementos: `{ name: 'WhatsApp', note: 'Sin comisiones' }` y `{ name: 'Motomandados', note: 'Costo según distancia' }`. Se actualiza el comentario que hablaba de "En Sucursal".
- R-12: `footer.contact.address` pasa a "Ver ubicación en Google Maps".
- R-13: `footer.contact.phone` pasa a `{ label: '+52 735 278 2306', href: 'tel:+527352782306' }`.
- R-14: se elimina `footer.contact.email` (sin datos muertos). Cuando exista el correo, se vuelve a añadir junto con su `<li>`.
- R-15: nuevo `location: { mapsUrl, embedSrc, embedTitle }`, con `mapsUrl` = `https://www.google.com/maps/search/?api=1&query=18.81823603166285,-98.96914471124853`, `embedSrc` = el `src` oficial tal cual y `embedTitle` = "Ubicación de Moloteando en Google Maps". Comentario: Molotes tiene ubicación propia; `common.location` sigue siendo la de Birria y el bot.

En `seed.json` (R-10): solo `data.promo.badge`, `title` y `description` con los textos aprobados. No se toca nada más; el diff se revisa para confirmar que las listas no cambian (CA-10).

### Frontend

En `src/views/pages/molotes.html` (sin JavaScript nuevo):

- **Plataformas (R-7, CA-8).** `<ul class="grid grid-cols-2 gap-space-sm">` (sin `sm:grid-cols-4`), con dos casillas en todas las anchuras: la de WhatsApp sin cambios y una informativa `<li class="platform …">` con el icono `moped` del diseño (el que hoy usa la casilla 1) y los textos de la plataforma 1. Se quitan las casillas de Rappi y "En Sucursal" (esta última era el único enlace `location.mapsUrl` de la sección).
- **Mapa (R-16, CA-5, CA-6).** Nuevo bloque bajo las plataformas, dentro de la columna `lg:col-span-7`:
  - `<div class="service__map space-y-space-xs">` con un contenedor `service__map-frame aspect-video w-full overflow-hidden rounded-2xl bg-surface-container shadow-md` (adaptable, sin ancho fijo; el fondo cubre la carga o el bloqueo).
  - `<iframe class="block h-full w-full border-0" src="{{ c.location.embedSrc }}" title="{{ c.location.embedTitle }}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`. El `src` pasa por `{{ }}`: el escape de `&` a `&amp;` es válido en atributos y el navegador lo decodifica. Se comprueba en la prueba con el valor decodificado.
  - Enlace `<a class="service__directions inline-flex items-center gap-space-xs font-label-md text-label-md font-bold text-[rgb(3,43,95)] transition-colors hover:text-secondary" href="{{ c.location.mapsUrl }}" target="_blank" rel="noopener noreferrer" data-action="open-map">`, con el icono `directions` (`aria-hidden`), `{{ location.label }}` y `<span class="sr-only"> {{ location.assistiveText }}</span>`. Foco visible con los estilos globales de foco de la landing.
- **Pie (R-12, R-14, CA-3, CA-4, CA-6).** El enlace de dirección usa `{{ c.location.mapsUrl }}` (texto "Ver ubicación en Google Maps", conserva `target`, `rel` y el texto de apoyo). Se elimina el `<li>` del correo. El teléfono no cambia de marcado.
- `npm run build:css` para generar `aspect-video`, `border-0` y las demás utilidades nuevas (las plantillas ya están en `@source`).

### Backend

En `src/app.ts`: `app.use(helmet({ contentSecurityPolicy: { directives: { 'frame-src': ['https://www.google.com'] } } }))`, con un comentario que cite REQ-F-031 (R-17), el único origen permitido y que el resto de directivas son las de Helmet por defecto. Sin otros cambios en `createApp`.

### Validaciones

- Los datos nuevos son contenido estático versionado (no hay entrada externa nueva). Una prueba de contenido valida que `mapsUrl` y `embedSrc` son https en `www.google.com`, con las rutas `/maps/search/` y `/maps/embed`, y que la consulta de `mapsUrl` lleva exactamente las coordenadas de R-15.
- La promoción sigue validándose con el esquema existente al cargar la semilla y al guardar en /admin.

### Manejo de errores

Sin cambios. Si Google no responde o bloquea el iframe, el contenedor muestra su fondo y el enlace "Cómo llegar" sigue disponible (caso límite). Sin JavaScript, iframe y enlaces funcionan igual.

### Testing

- **`tests/unit/content.test.ts`.** CA-39 (R-23): la prueba de Molotes deja de comparar `promo` con el diseño y sigue comparando el hero, el texto destacado, los 8 platillos y las 2 bebidas, sin cambios. Se añade `expect(promo).toEqual({ badge: 'Promociones', title: 'Promociones de Molotes', description: '…' })` con los textos de R-10 (CA-10), y el nombre de la prueba explica la excepción. La de Birria no cambia. Prueba nueva de la ubicación de Molotes (ver Validaciones). La prueba de `common.location` (`maps.app.goo.gl`) se conserva.
- **`tests/unit/file-menu-repository.test.ts`** (OT-6): los literales "Jueves de Molotes 2x1" se sustituyen por el título leído de la semilla.
- **`tests/integration/app.test.ts`** (servidor con `listenLocal`, como las demás pruebas):
  - CA-1: `/molotes` no contiene ninguno de los términos de CA-1 (método de OT-1) y sí contiene "Queso Oaxaca".
  - CA-2 y CA-9: botón "Activar promoción", el mensaje de éxito (oculto), "Sin spam molesto." sin la segunda frase y los textos de R-3, R-6, R-18, R-19, R-20, R-21 y R-22, leídos del contenido para no duplicar literales, más una comprobación literal de cada valor clave.
  - CA-3 y CA-4: `href="tel:+527352782306"` con "+52 735 278 2306"; ningún `mailto:`.
  - CA-5 y CA-6: un solo `<iframe>` con el `src` oficial (decodificado), `title`, `loading="lazy"`, `referrerpolicy` y `allowfullscreen`; los dos enlaces a `mapsUrl` con `target="_blank"` y `rel="noopener noreferrer"`; ningún `maps.app.goo.gl` en `/molotes`.
  - CA-8: exactamente 2 casillas `platform`, la primera con `data-action="whatsapp-order"` y el `href` del bot.
  - CA-7: `/` y `/birria` siguen enlazando al enlace corto común (se amplía la prueba existente a `/`) y no contienen ningún iframe; `hoursAndLocation` de ambos negocios sigue llevando el enlace común.
  - CA-11: la cabecera CSP de `/molotes` (y de `/admin/login`) se parsea en directivas y se compara **completa** con la esperada: los valores por defecto de Helmet más `frame-src https://www.google.com`. Así falla si aparece otro origen, `child-src`, `'unsafe-eval'` o se relaja cualquier directiva. Se conserva la prueba existente de cabeceras de seguridad.
- **Snapshot** (`tests/unit/landing-snapshot.test.ts`): se regenera solo `tests/snapshots/landing-molotes.html` (`npx vitest run -u tests/unit/landing-snapshot.test.ts`) y se revisa el diff línea a línea. `landing-birria.html` debe quedar sin cambios (prueba de que Birria y `/` no se tocan).
- **`tests/unit/landing-dom.test.ts` y `promo-form.test.ts`**: el comportamiento del formulario no cambia (sin petición de red, validación nativa). Solo se ajustan si alguna aserción usa los textos anteriores.
- **Comandos:** `npm run build:css`, `npm run typecheck`, `npm run lint` y `npm test` (con `npm run db:up`).
- **Manual (QA, navegador):** iframe sin errores de CSP en consola y sin desbordamiento horizontal a 320, 768 y 1280 px (CA-5); las métricas "2026" y "A mano" sin desbordar en la cuadrícula de 3 columnas (640 a 1024 px); foco visible en "Cómo llegar".

### Seguridad

- CSP: un solo origen nuevo, solo en `frame-src`. No cambian `script-src`, `style-src`, `img-src`, `connect-src`, `frame-ancestors` ni las demás directivas, y la prueba compara la política completa.
- Iframe sin `allow` de permisos extra (no hace falta geolocalización ni cámara) y sin `sandbox`, porque Street View necesita scripts dentro del iframe y el origen queda acotado por la CSP. `referrerpolicy` estricta.
- Los enlaces externos llevan `rel="noopener noreferrer"`. Todos los valores pasan por `{{ }}` (escape).
- No se publica correo ni dirección inventados (RN-1).

### Performance

El iframe usa `loading="lazy"` y está en la parte media de la página, así que no afecta a la carga inicial. Sin JavaScript ni assets nuevos; el CSS crece solo por unas pocas utilidades.

### Riesgos técnicos

- Google podría cambiar el formato del embed o exigir el referrer: el enlace "Cómo llegar" cubre el fallo. Se verifica en QA.
- Producción seguirá mostrando la promo anterior hasta el paso manual de CA-13.
- La landing y el bot de Molotes mostrarán ubicaciones distintas (OT-4) hasta un ticket aparte.
- Si una actualización menor de Helmet cambia sus valores por defecto, la prueba de CA-11 fallará y obligará a revisarlo. Es intencional.

### Orden de implementación

1. Contenido de Molotes (textos, plataformas, contacto y `location`).
2. Plantilla `molotes.html` (plataformas, mapa y pie) y `npm run build:css`.
3. CSP en `src/app.ts`.
4. `seed.json` (R-10).
5. Pruebas: CA-39, `file-menu-repository`, integración (CA-1 a CA-11) y snapshot de Molotes.
6. README (OT-8) y la documentación del paso manual CA-13 en `## Implementation Result`.
7. `typecheck`, `lint`, `test` y revisión del `git diff` (snapshot de Birria intacto; listas de `seed.json` intactas).

### Criterios de finalización

- CA-1 a CA-12 cubiertos por pruebas automáticas en verde, salvo las partes visuales de CA-5 (desbordamiento y consola), que verifica QA en el navegador.
- `npm run typecheck`, `npm run lint` y `npm test` terminan con código 0.
- El snapshot de Molotes está actualizado y revisado; el de Birria no cambia.
- El paso manual de CA-13 queda documentado (editar la promo en /admin/molotes con los textos de R-10, guardar y comprobar que `/molotes` ya no muestra "2x1" ni "Jueves").

## Implementation Result

### Rama

`feature/REQ-F-031-correccion-textos-molotes`, creada desde `origin/main` (`7da4c4a`). Sin commits ni push.

### Cambios realizados

- `src/content/molotes/index.ts`: textos de R-1 a R-6, R-8, R-9, R-11 a R-13 y R-18 a R-22 con el texto exacto de cada requisito; `service.platforms` con dos elementos (R-7); se elimina `footer.contact.email` (R-14); nuevo bloque `location` (`mapsUrl`, `embedSrc` oficial tal cual, `embedTitle`) (R-15).
- `src/views/pages/molotes.html`: cuadrícula `grid grid-cols-2` con dos casillas (WhatsApp sin cambios y "Motomandados" informativa con el icono `moped`); se quitan Rappi y "En Sucursal" (R-7). Nuevo bloque `service__map` bajo las plataformas: contenedor `aspect-video w-full` con `rounded-2xl`, `shadow-md` y fondo `bg-surface-container`; iframe con `title`, `loading="lazy"`, `referrerpolicy="strict-origin-when-cross-origin"` y `allowfullscreen`, sin ancho fijo; enlace "Cómo llegar" con icono `directions`, `target="_blank"`, `rel="noopener noreferrer"` y texto de apoyo `sr-only` (R-16). El enlace del pie usa `c.location.mapsUrl` y se elimina el `<li>` del correo (R-12, R-14).
- `src/app.ts`: `helmet({ contentSecurityPolicy: { directives: { 'frame-src': ['https://www.google.com'] } } })` (R-17). La cabecera resultante es la política por defecto de Helmet más `frame-src https://www.google.com`.
- `src/content/molotes/seed.json`: solo `data.promo` (R-10). Las listas de productos no cambian (diff de 3 líneas).
- Pruebas:
  - `tests/unit/content.test.ts`: CA-39 ajustada según R-23 (la promo se compara con los textos de R-10; hero, texto destacado, 8 platillos y 2 bebidas siguen comparándose con el diseño). Prueba nueva de la ubicación de Molotes (https, `www.google.com`, rutas, coordenadas, `title`, distinta de la común).
  - `tests/unit/file-menu-repository.test.ts` (OT-6): el título de la promo se lee de la semilla.
  - `tests/integration/app.test.ts`: nuevo `describe` de REQ-F-031 con CA-1 (método de OT-1: HTML sin `<svg>` y `textContent` normalizado), CA-2, CA-3/CA-4, CA-5/CA-6, CA-7 (`/`, `/birria` y `hoursAndLocation` de ambos negocios), CA-8, CA-9 y CA-11 (CSP completa comparada directiva por directiva en `/molotes`, `/` y `/admin/login`). Las pruebas de REQ-F-010 (CA-1 y CA-5) se actualizan a los textos de R-21 y R-22.
  - `tests/snapshots/landing-molotes.html` regenerado y revisado línea a línea; `landing-birria.html` sin cambios.
  - Corrección aprobada: `app.test.ts` (CA-5 y CA-6) exige el texto accesible "Ver ubicación en Google Maps (se abre en una pestaña nueva)" en el enlace del pie.
- `README.md` (OT-8): ubicación común frente a la propia de Molotes y `frame-src`; enlaces de ubicación por landing; diferencias deliberadas con el diseño (plataformas, mapa, correo, textos comerciales). No se toca la sección de CI.

### Criterios de aceptación

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 | Cumple | `app.test.ts` "CA-1: el HTML publicado no contiene ninguna afirmación retirada…" |
| CA-2 | Cumple (automático: texto del botón, mensaje oculto, sin `action`); el comportamiento del formulario no cambia (`promo-form.test.ts`, `landing-dom.test.ts` en verde) | `app.test.ts` "CA-2" |
| CA-3 | Cumple | `app.test.ts` "CA-3 y CA-4" |
| CA-4 | Cumple (ningún `mailto:` ni `@` en el pie) | `app.test.ts` "CA-3 y CA-4" |
| CA-5 | Cumple la parte automática (iframe, `src`, `title`, `lazy`, sin ancho fijo, CSP). Pendiente de QA en navegador: consola sin errores de CSP y sin desbordamiento a 320, 768 y 1280 px | `app.test.ts` "CA-5 y CA-6", "CA-11" |
| CA-6 | Cumple | `app.test.ts` "CA-5 y CA-6" |
| CA-7 | Cumple | `app.test.ts` "CA-7" y prueba existente de `/birria` |
| CA-8 | Cumple | `app.test.ts` "CA-8" |
| CA-9 | Cumple | `app.test.ts` "CA-9" y REQ-F-010 CA-1/CA-5 actualizadas |
| CA-10 | Cumple | `content.test.ts` (CA-39 ajustada) y diff de `seed.json` |
| CA-11 | Cumple | `app.test.ts` "CA-11" |
| CA-12 | Cumple | Ver validaciones |
| CA-13 | Pendiente (paso manual del usuario tras el despliegue) | Ver "Riesgos o pendientes" |

### Validaciones ejecutadas

- `npm run build:css`: correcto; `public/css/molotes/main.css` incluye `aspect-video` y `border-0`.
- `npm run typecheck`: código 0.
- `npm run lint`: código 0, sin errores ni avisos.
- `npm test` (MySQL local con `npm run db:up`): 89 archivos, 1787 pruebas superadas y 1 fallo esperado (`expected fail` ya existente).
- `git diff`: solo los archivos del ticket; `seed.json` solo cambia `data.promo`; `tests/snapshots/landing-birria.html` sin cambios.

### Archivos afectados

- `restaurante/src/app.ts`
- `restaurante/src/content/molotes/index.ts`
- `restaurante/src/content/molotes/seed.json`
- `restaurante/src/views/pages/molotes.html`
- `restaurante/tests/integration/app.test.ts`
- `restaurante/tests/unit/content.test.ts`
- `restaurante/tests/unit/file-menu-repository.test.ts`
- `restaurante/tests/snapshots/landing-molotes.html`
- `restaurante/README.md`
- `.claude/docs/in-progress/REQ-F-031-correccion-textos-molotes.md`

### Riesgos o pendientes

- **CA-13 (paso manual tras el despliegue).** En /admin/molotes, editar la promoción con badge "Promociones", título "Promociones de Molotes" y descripción "Pregunta por la promoción vigente al hacer tu pedido por WhatsApp. Déjanos tus datos y no te pierdas nuestras novedades.", guardar y comprobar que https://birriaelmuneco.com/molotes ya no muestra "2x1" ni "Jueves". Hasta entonces producción sigue mostrando la promo anterior (`current.json` no cambia con el despliegue).
- **QA en navegador (CA-5):** consola sin errores de CSP, sin desbordamiento a 320, 768 y 1280 px, métricas "2026" y "A mano" sin desbordar en 3 columnas (640 a 1024 px) y foco visible en "Cómo llegar".
- **OT-4:** el bot de Molotes sigue enviando la ubicación común (lo pide CA-7); landing y bot muestran ubicaciones distintas hasta un ticket aparte.
- **Accesibilidad (corregido tras la aprobación):** el enlace del pie tiene su propio texto de apoyo, `footer.contact.addressAssistiveText` = "(se abre en una pestaña nueva)", y se anuncia como "Ver ubicación en Google Maps (se abre en una pestaña nueva)". El texto visible no cambia, y "Cómo llegar" y Birria siguen usando el texto común.
- Datos pendientes del ticket (correo, dirección postal, promoción vigente, recoger en sucursal) sin cambios.

## QA Action Plan

Aprobado por el usuario (2026-10-15): "si" (respuesta a "¿Apruebas los dos planes de QA?").

Fase Q1 de senior-qa (2026-10-15). Base: diff de la rama frente a `main` (9 archivos), CodeGraph (`createApp`: 34 consumidores y 16 archivos de prueba afectados; `molotesContent`: lo consumen `content/index.ts` y `content/molotes/bot.ts`, que solo usa `name`) y lecturas dirigidas de `molotes.html` y del ticket.

### Objetivo

Comprobar con evidencia que `/molotes` publica solo los textos y datos comerciales aprobados (R-1 a R-22), que el mapa oficial carga con la CSP mínima (R-15 a R-17), y que Birria, `/`, el bot, /admin y el formulario de promoción no cambian.

### Requisito bajo prueba

REQ-F-031, versión 1 aprobada, con la corrección aprobada del texto accesible del enlace del pie ("Ver ubicación en Google Maps (se abre en una pestaña nueva)").

### Criterios de aceptación

| CA | Pruebas que lo cubren |
|---|---|
| CA-1 | A-3 (prueba de integración), F-1 (barrido del HTML servido sin `<svg>` y del texto visible en navegador) |
| CA-2 | A-3, F-4 (navegador: texto del botón, envío válido, envío inválido, sin petición de red nueva) |
| CA-3 | A-3, F-2 |
| CA-4 | A-3, F-2 |
| CA-5 | A-3, B-1 a B-4 (consola sin errores de CSP, iframe cargado, sin desbordamiento a 320, 768 y 1280 px) |
| CA-6 | A-3, F-2, X-1 |
| CA-7 | A-3, R-1 (`/` y `/birria` servidos), R-3 (snapshot de Birria intacto) |
| CA-8 | A-3, F-3, B-3 (cuadrícula sin huecos en los tres anchos) |
| CA-9 | A-3, F-1 (texto visible) |
| CA-10 | A-3/A-4 (`content.test.ts`), F-5 (diff de `seed.json`) |
| CA-11 | A-3, S-1 (cabecera CSP real con `curl` en `/molotes`, `/`, `/birria` y `/admin/login`) |
| CA-12 | A-1, A-2, A-3 |
| CA-13 | Fuera de la validación de QA: paso manual del usuario tras el despliegue. Queda en "Pendientes de revisión manual" y no bloquea `QA_APPROVED` |

### Riesgos identificados

- CA-1 sobre HTML crudo da falsos positivos ("4.9" en el `path` del SVG de WhatsApp) y falsos negativos (métricas partidas en `<dd>`/`<dt>`). Se valida sobre el HTML sin `<svg>` y sobre el texto visible (OT-1).
- La CSP es global (una sola llamada a `helmet()`): afecta también a `/`, `/birria` y /admin.
- `https://www.google.com/maps/embed` podría redirigir a otro origen o requerir referrer: se comprueba en consola y red del navegador.
- Las métricas "2026" y "A mano" en la cuadrícula de 3 columnas y el iframe en 320 px pueden desbordar.
- `/molotes` y el bot de Molotes muestran ubicaciones distintas (OT-4): es decisión aprobada, no defecto.
- La base MySQL de pruebas es compartida con el worktree de REQ-F-030 (en pausa): no se ejecuta la suite en paralelo con esa instancia.

### Pruebas funcionales

- **F-1.** `curl` a `/molotes`; búsqueda de cada término de CA-1 en el HTML sin `<svg>` y en el texto visible (`get_page_text` en navegador). "Queso Oaxaca" sí aparece. Textos de CA-9 (R-3, R-6, R-11, R-18, R-19, R-20, R-21, R-22) presentes literalmente.
- **F-2.** Pie: teléfono "+52 735 278 2306" con `tel:+527352782306`; sin línea de correo ni `mailto:`; "Ver ubicación en Google Maps" con `href` de R-15, `target="_blank"`, `rel="noopener noreferrer"` y texto de apoyo.
- **F-3.** Plataformas: exactamente 2 casillas; WhatsApp con `data-action="whatsapp-order"` y el `href` del bot; "Motomandados / Costo según distancia" sin enlace.
- **F-4.** Formulario de promoción en navegador: botón "Activar promoción"; con datos válidos se oculta el formulario y aparece el mensaje de R-9; con datos inválidos aparece la validación nativa; `read_network_requests` sin peticiones nuevas al enviar.
- **F-5.** `git diff main -- restaurante/src/content/molotes/seed.json`: solo cambian `badge`, `title` y `description` de `data.promo`.

### Pruebas negativas y casos límite

- **N-1.** Sin JavaScript (inspección del HTML servido): el iframe y los enlaces están en el marcado y no dependen de JS.
- **N-2.** Iframe bloqueado: el enlace "Cómo llegar" existe fuera del iframe (marcado) y es alcanzable por teclado.
- **N-3.** Ningún `maps.app.goo.gl` en `/molotes`; ningún `<iframe>` en `/` ni en `/birria`.

### Pruebas responsive

- **B-3.** Viewports 320×800, 375×812, 768×1024 y 1280×900 (los tres de CA-5 más el móvil de referencia), en `/molotes`: `document.documentElement.scrollWidth <= clientWidth`; iframe dentro de su columna con proporción 16:9; cuadrícula de 2 plataformas sin huecos; métricas "2026" y "A mano" sin desbordar su caja (comparación `scrollWidth`/`clientWidth` de cada métrica), revisadas también a 640 y 1024 px, donde la cuadrícula es de 3 columnas. Captura de la sección "Servicio y Domicilio" en cada ancho.

### Pruebas de accesibilidad

- **C-1.** Un solo `h1` y jerarquía de encabezados sin saltos en `/molotes` (sin cambios frente a `main`).
- **C-2.** El iframe tiene `title` "Ubicación de Moloteando en Google Maps".
- **C-3.** Nombre accesible de "Cómo llegar" (texto común con aviso de pestaña nueva) y del enlace del pie ("Ver ubicación en Google Maps (se abre en una pestaña nueva)"); iconos con `aria-hidden`.
- **C-4.** Foco visible al tabular hasta "Cómo llegar" y hasta los enlaces del pie (captura con el foco).
- **C-5.** Contraste del enlace "Cómo llegar" (azul `rgb(3,43,95)` sobre el fondo de la sección), calculado con los colores computados.

### Pruebas UX/UI (vs. _stich_source_/)

- **U-1.** Sección "Servicio y Domicilio" y pie frente a `_stich_source_/moloteando_aut_nticos_molotes_artesanales/`: se conservan tipografía, colores, radios y sombras; las diferencias son solo las aprobadas (2 plataformas, mapa sin equivalente en el diseño, sin correo, textos comerciales). La pill de R-18 conserva el icono `star`.
- **U-2.** El mapa no añade encabezados ni textos visibles no aprobados.

### Pruebas de integración (WhatsApp)

- **W-1.** CTA de WhatsApp de la cabecera, del hero y de la casilla de plataformas: `href`, `target` y `rel` iguales que en `main` (diff del snapshot de Molotes y prueba de integración existente, más inspección del `href` en navegador). No se sigue el enlace.
- **X-1.** Los dos enlaces de mapas se validan por `href`, `target` y `rel`; no se sigue el destino.

### Pruebas de performance

- **P-1.** El iframe lleva `loading="lazy"`; en navegador, la petición a `google.com/maps/embed` no ocurre antes de acercarse a la sección (red tras la carga inicial sin desplazar, y después de desplazar).
- **P-2.** Sin JavaScript ni assets nuevos (diff); consola sin errores propios de la página.

### Pruebas SEO

- **SEO-1.** `title`, meta description, canonical, Open Graph y `h1` de `/molotes` idénticos a `main` (comparación del `<head>` con el snapshot anterior por `git diff` del snapshot y `curl`); `/` y `/birria` sin cambios (snapshot de Birria intacto).

### Pruebas de regresión

- **R-1.** `/` y `/birria` responden 200, sin iframe, con el enlace corto común `https://maps.app.goo.gl/sAFDEeLdKzs7GGPz9`.
- **R-2.** `npm test` completo (incluye bot `hoursAndLocation`, /admin, aviso por día, `promo-form`, `landing-dom`).
- **R-3.** `git diff main --stat`: `tests/snapshots/landing-birria.html`, `src/content/common/`, `birria.html`, `public/js/` y el bot sin cambios.
- **S-1.** CSP real por `curl -I` en `/molotes`, `/`, `/birria` y `/admin/login`: política por defecto de Helmet más solo `frame-src https://www.google.com`; sin `child-src`, sin `'unsafe-eval'`, sin otros orígenes; `frame-ancestors 'self'` sin cambios. En navegador, /admin/login carga sin errores nuevos de CSP en consola.

### Pruebas automatizadas

- **A-1.** `npm run build:css` y `npm run typecheck` (código 0).
- **A-2.** `npm run lint` (código 0, sin avisos). No se ejecuta `lint:fix`.
- **A-3.** `npm test` completo con MySQL de pruebas (`npm run db:up` si hace falta), sin ejecutar a la vez la suite del worktree de REQ-F-030. Se acepta solo el `expected fail` ya existente.
- **A-4.** Revisión de las pruebas nuevas o ajustadas (`app.test.ts` REQ-F-031, `content.test.ts` CA-39, `file-menu-repository.test.ts`) para confirmar que no se debilitaron.
- No se crean pruebas nuevas: las del ticket cubren CA-1 a CA-12. Si QA detecta un hueco, se reporta como hallazgo en lugar de escribir pruebas fuera de este plan.

### Pruebas en navegador

Claude in Chrome, en pestaña nueva, con el servidor local en un puerto libre (p. ej. `PORT=3100 npm start`, `.env` existente), que se detiene al terminar: B-1 consola sin errores de CSP al cargar el iframe en `/molotes`; B-2 red: `www.google.com/maps/embed` responde sin redirección a otro origen; B-3 responsive (ver arriba); B-4 captura del mapa cargado; F-4 formulario; C-4 foco; S-1 consola de /admin/login. Si la extensión no responde tras 2-3 intentos, la parte visual queda pendiente de revisión manual y, como CA-5 depende de ella, el resultado sería `NEEDS_USER_DECISION`.

### Evidencia requerida

Salida de `typecheck`, `lint` y `npm test` (resumen); salida de `curl` con la cabecera CSP y del barrido de CA-1; resultados de `javascript_tool` (anchos, `scrollWidth`, atributos, nombres accesibles); mensajes de consola y peticiones de red; capturas de la sección "Servicio y Domicilio" en cada ancho y del foco en "Cómo llegar".

### Criterios de aprobación

- CA-1 a CA-12 en PASS con evidencia; CA-13 registrado como paso manual pendiente del usuario.
- `typecheck`, `lint` y `npm test` en verde (solo el `expected fail` existente).
- Sin defectos `BLOCKER` ni `CRITICAL`; cualquier `MAJOR` requiere decisión del usuario.
- Sin regresión en `/`, `/birria`, bot, /admin ni formulario.

## QA Report

### Ronda

1 (2026-10-15), con el QA Action Plan aprobado ("si").

### Pruebas ejecutadas

- Rama `feature/REQ-F-031-correccion-textos-molotes`; `git status` igual al de la implementación (sin cambios de QA en código ni pruebas).
- `npm run build:css`: correcto. `npm run typecheck`: código 0. `npm run lint`: código 0, sin avisos.
- `npm test` (con el candado de MySQL compartido con REQ-F-030): código 0; 89 archivos, 1787 pruebas superadas y 1 `expected fail` ya existente.
- Servidor local `PORT=3100 npm start`. El `.env` local no tiene `WHATSAPP_BOT_BLOCKLIST_KEY` (bloqueo de entorno, no defecto): se pasó una clave aleatoria solo a ese proceso, sin tocar `.env`. Servidor detenido al terminar.
- `curl` a `/molotes`, `/`, `/birria` y `/admin/login`: 200 y cabecera CSP.
- Barrido de CA-1 y CA-9 (HTML sin `<svg>` y texto visible normalizado).
- Claude in Chrome: consola, recursos, `securitypolicyviolation`, medición a 320, 375, 640, 768, 1024 y 1280 px (marcos `srcdoc` de ancho exacto), foco por teclado, nombres accesibles, contraste y formulario.
- Revisión del diff de las pruebas ajustadas (A-4): no se debilitaron; CA-39 compara la promo con igualdad exacta y `file-menu-repository` lee el título de la semilla.

### Criterios de aceptación

| CA | Resultado | Evidencia |
|---|---|---|
| CA-1 | PASS | Con una carpeta de datos nueva (semilla): 0 términos en el HTML sin `<svg>` y 0 en el texto visible; "Queso Oaxaca" presente. Con la `data/molotes/current.json` local de desarrollo aparecen "2x1", "Jueves", "Club del Comal", "ofertas secretas" y "plátano macho": es la promo editable anterior, el caso límite documentado que resuelve CA-13; no es defecto. Prueba de integración "CA-1" en verde |
| CA-2 | PASS | Botón "Activar promoción" (icono `aria-hidden`); con correo inválido y nombre vacío, validación nativa (`invalid` en `name` y `email`) y el formulario sigue visible; con datos válidos se oculta y aparece "¡Gracias por tu interés! Pregunta por la promoción vigente al pedir por WhatsApp."; sin `action`, URL igual y 26 recursos antes y después (ninguna petición nueva) |
| CA-3 | PASS | Único `href="tel:+527352782306"`, texto "+52 735 278 2306" |
| CA-4 | PASS | Ningún `mailto:` en `/molotes` |
| CA-5 | PASS | Iframe con el `src` oficial exacto, `title` "Ubicación de Moloteando en Google Maps", `loading="lazy"`, `referrerpolicy="strict-origin-when-cross-origin"`, `allowfullscreen`, sin `sandbox` ni `allow`. Street View cargado (captura). Recurso `www.google.com/maps/embed` como `iframe`, sin redirecciones a otro origen; 0 eventos `securitypolicyviolation` al recargar el iframe; consola sin errores. Sin desbordamiento: `scrollWidth` = `clientWidth` a 320, 375, 640, 768, 1024 y 1280 px |
| CA-6 | PASS | "Cómo llegar" y el enlace del pie: `href` `https://www.google.com/maps/search/?api=1&query=18.81823603166285,-98.96914471124853`, `target="_blank"`, `rel="noopener noreferrer"` |
| CA-7 | PASS | `/` y `/birria`: 0 iframes y solo `https://maps.app.goo.gl/sAFDEeLdKzs7GGPz9`; `/` abre el aviso "Molotes" (jueves); prueba "CA-7" (`hoursAndLocation`) en verde; `landing-birria.html`, `content/common`, `birria.html`, `public/js` y `services/` sin cambios frente a `main` |
| CA-8 | PASS | 2 casillas `.platform` en la misma fila, del mismo ancho y sin huecos en todos los anchos (p. ej. 140+140 px a 320, 322+322 px a 1280); la primera con `data-action="whatsapp-order"` |
| CA-9 | PASS | Textos literales de R-3, R-6, R-11, R-18, R-19, R-20, R-21 y R-22 presentes en el texto visible |
| CA-10 | PASS | `git diff main` de `seed.json`: solo cambian las 3 líneas de `data.promo`; con carpeta de datos nueva, `/molotes` muestra los textos de R-10 |
| CA-11 | PASS | CSP idéntica en `/molotes`, `/`, `/birria` y `/admin/login`: la de Helmet por defecto más `frame-src https://www.google.com`; sin `child-src` ni `'unsafe-eval'`; `frame-ancestors 'self'` sin cambios. Prueba "CA-11" en verde |
| CA-12 | PASS | `typecheck`, `lint` y `npm test` en verde |
| CA-13 | Pendiente (manual del usuario) | Fuera del alcance de QA; ver "Pendientes de revisión manual" |

### Defectos encontrados

Ninguno.

Observaciones (sin defecto):

- **OBS-1.** `frame-src https://www.google.com` sustituye a `default-src 'self'` para los marcos, así que el sitio ya no puede incrustarse a sí mismo en un iframe. Hoy la app no usa iframes propios (búsqueda en `src` y `public/js`), y es coherente con CA-11. Solo importaría si en el futuro se incrusta una página propia.
- **OBS-2.** Chrome cargó el iframe sin desplazarse, a unos 4.100 px del borde visible. `loading="lazy"` está presente (CA-5); el umbral de distancia lo decide el navegador. No hay evidencia de impacto en la carga inicial.
- **OBS-3.** El `.env` local de desarrollo no tiene `WHATSAPP_BOT_BLOCKLIST_KEY` y el servidor no arranca sin ella. Es de entorno y anterior a este ticket.

### Regresión

Suite completa en verde. `/` (aviso "Molotes" de jueves abierto), `/birria` y `/admin/login` sin errores de consola. Snapshot de Birria intacto. El bot de Molotes solo consume `molotesContent.name` (CodeGraph), que no cambia.

### Responsive

`/molotes` a 320, 375, 640, 768, 1024 y 1280 px:

- Sin desbordamiento horizontal.
- El mapa ocupa el ancho de su columna con proporción 16:9: 288×162 a 320 px y 653×367 a 1280 px, dentro de la columna.
- Las métricas ("2026", "A mano", "Hecho pieza por pieza") no desbordan. Van en una columna hasta 640 px y en 3 columnas desde 640 px (192, 235, 172 y 206 px por columna).
- Captura a 320 px: plataformas, mapa, "Cómo llegar" y promo sin cortes.

### Accesibilidad

- Un solo `h1`, sin saltos de encabezado, landmarks `header`, `nav`, `main` y `footer`.
- El iframe tiene `title`. Nombres accesibles: "Cómo llegar en Google Maps (se abre en una pestaña nueva)" y "Ver ubicación en Google Maps (se abre en una pestaña nueva)", con los iconos `aria-hidden`.
- Foco visible en "Cómo llegar" al llegar con teclado (Mayús+Tab): `:focus-visible` con anillo del navegador, igual que en los demás enlaces del pie; la landing no define un estilo de foco global propio.
- Contraste: "Cómo llegar" 13,86:1 y el enlace del pie 11,50:1.

### UX/UI

Respecto a `_stich_source_` solo están las diferencias aprobadas: 2 plataformas, un mapa sin equivalente en el diseño, sin correo y los textos comerciales. Se conservan radios, sombras, colores y tipografía de la sección, y la pill de R-18 mantiene el icono `star`. No se añadieron encabezados ni textos visibles no aprobados.

### Performance

Sin JS ni assets nuevos. El iframe es `lazy` (ver OBS-2). Consola sin errores.

### SEO

`title`, meta description, Open Graph y canonical de `/molotes` idénticos a los de `main`. Birria sin cambios.

### Pendientes de revisión manual

- **CA-13:** tras el despliegue, editar la promo en /admin/molotes con los textos de R-10, guardar y comprobar que https://birriaelmuneco.com/molotes ya no muestra "2x1" ni "Jueves". Lo mismo aplica a la copia local `restaurante/data/molotes/current.json` de desarrollo, si se quiere ver la promo nueva en local.

### Resultado final

QA_APPROVED

## Historial de cambios

### Versión 1

Descripción inicial, aprobada el 2026-10-15. Incluye el ajuste de R-11 a "Sin spam molesto." indicado en la aprobación.

### Revisión técnica (senior-fullstack)

2026-10-15: revisión técnica sin bloqueos (observaciones OT-1 a OT-8) y Technical Action Plan registrado. Estado: NEEDS_TECHNICAL_PLAN_APPROVAL.

### Implementación (senior-fullstack)

2026-10-15: Technical Action Plan aprobado por el usuario ("Si los apruebo"). Rama `feature/REQ-F-031-correccion-textos-molotes`, ticket movido a `in-progress/`, implementación y pruebas en verde. Estado: NEEDS_IMPLEMENTATION_APPROVAL.

### Aprobación de la implementación y corrección (senior-fullstack)

2026-10-15: el usuario aprueba la implementación: "La apruebo e incluye la corrección". Corrección: el enlace del pie tiene su propio texto de apoyo, "(se abre en una pestaña nueva)", para no anunciar "en Google Maps" dos veces. Cambian `src/content/molotes/index.ts`, `src/views/pages/molotes.html`, `tests/integration/app.test.ts` y el snapshot de Molotes. `typecheck` y `lint` terminan con código 0; `npm test`: 1787 pruebas superadas y 1 fallo esperado. Estado: NEEDS_IMPLEMENTATION_APPROVAL (pendiente de QA).

### QA Action Plan (senior-qa)

2026-10-15: implementación aprobada por el usuario ("La apruebo e incluye la corrección"). QA Action Plan registrado (fase Q1). Estado: NEEDS_QA_PLAN_APPROVAL.

### QA ronda 1 (senior-qa)

2026-10-15: QA Action Plan aprobado por el usuario ("si"). Ejecución completa: CA-1 a CA-12 en PASS con evidencia, sin defectos; CA-13 queda como paso manual del usuario. Estado: QA_APPROVED.
