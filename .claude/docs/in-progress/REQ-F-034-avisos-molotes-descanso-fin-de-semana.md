# REQ-F-034 — Avisos en `/molotes`: descanso el lunes y "hoy toca birria" el fin de semana

## Estado

NEEDS_IMPLEMENTATION_APPROVAL

## Aprobación

Aprobado por el usuario (versión 1, fecha 2026-10-15). Respuesta textual a "¿Apruebas los tres tickets con estos textos?": "si".

Technical Action Plan aprobado por el usuario el 2026-10-24. Respuesta textual a "¿Apruebas el Technical Action Plan de REQ-F-034 para que senior-fullstack empiece la implementación?": "Sí, apruebo el plan".

Serie de tickets y orden obligatorio: **REQ-F-032 → REQ-F-033 → REQ-F-034**. Este es el tercero y empieza cuando REQ-F-033 esté integrado.

## Objetivo

Que quien entre a `/molotes` un día en que no hay molotes sepa por qué y a dónde ir.

## Cambio de regla (aprobado por el usuario)

Hasta ahora (`CLAUDE.md` §5 y REQ-F-028, RN-3), `/molotes` y `/birria` nunca mostraban aviso. Con este ticket:

| Día (zona del negocio) | `/` (sin cambios) | `/molotes` (nuevo) | `/birria` |
|---|---|---|---|
| Lunes | Aviso "Descanso" | Aviso "Descanso" | Ninguno |
| Martes a viernes | Aviso "Molotes" | Ninguno | Ninguno |
| Sábado y domingo | Ninguno | Aviso "Hoy toca birria" | Ninguno |

El usuario autorizó actualizar `CLAUDE.md` §1, §5 y §11 en este ticket.

## Alcance

- Avisos de lunes y de fin de semana en `/molotes`.
- Textos editables en el contenido de Molotes.
- `?dia=` en `/molotes` en desarrollo.
- Pruebas.
- `CLAUDE.md` y README.

## Fuera de alcance

- El comportamiento y los textos del aviso de `/`.
- Avisos en `/birria`.
- Horarios de los negocios.
- Dependencias nuevas.

## Reglas de negocio

- **RN-1.** El aviso lo decide el servidor con la fecha en la zona horaria configurada (`TIMEZONE`). Nunca se usa el reloj del dispositivo.
- **RN-2.** Molotes abre de martes a viernes y Birria, sábado y domingo. El lunes no abre ningún negocio.
- **RN-3.** El aviso no impide consultar la página de Molotes.

## Requisitos

- **R-1. Decisión por día.** `/molotes` incluye el aviso según la tabla del cambio de regla.
- **R-2. Aviso de fin de semana.** Textos editables en el contenido de Molotes:
  - **Título:** "¡Raza, hoy toca birria!"
  - **Mensaje:** «¡Qué bueno que se te antojaron unos molotes! Los nuestros son de estilo poblano y te esperan de martes a viernes. Pero no te vayas con el antojo: este fin de semana nos ponemos bien birrieros con Birria El Muñeco. ¡Échale un ojo al menú y descubre qué se te antoja hoy!»
  - **Botón principal:** "Ver Birria El Muñeco", con el logo oficial `/img/birria/logo-birria.webp`. Lleva a `/birria`.
  - **Botón secundario:** "Quedarme en Molotes". Cierra el aviso.
- **R-3. Aviso de descanso del lunes.** Textos editables en el contenido de Molotes:
  - **Título:** "¡Los lunes descansamos!"
  - **Mensaje:** «Hoy el comal agarra fuerzas. Mañana martes volvemos con molotes estilo poblano recién hechecitos. Mientras, échale un ojo al menú y ve escogiendo tu antojo.»
  - **Botón único:** "Ver el menú". Cierra el aviso.
- **R-4. Comportamiento.** Es el mismo del aviso de `/`:
  - Diálogo modal nativo con `aria-labelledby`.
  - Escape lo cierra.
  - El foco queda contenido mientras está abierto y vuelve a la página al cerrarlo.
  - Sin JavaScript no se ve ni tapa nada.
  - No se abre si la persona ya interactuó con la página.
  - Se cierra en `pagehide`, así que el botón "atrás" no lo devuelve abierto.
- **R-5. Una vez por sesión del navegador.**
  - El aviso de fin de semana tiene su propia marca de sesión.
  - El aviso de descanso de `/molotes` **comparte** la marca con el aviso de descanso de `/`: se muestra una sola vez por sesión entre ambas rutas.
  - Si sessionStorage no está disponible, el aviso se muestra y se puede cerrar.
- **R-6. Aspecto.**
  - Misma estructura y comportamiento que el aviso de `/`, con la paleta de Molotes.
  - Se reutiliza el patrón y el módulo existentes sin duplicar la lógica.
  - No hay equivalente en `_stich_source_/`: es una diferencia deliberada respecto al diseño.
- **R-7. Desarrollo.** Con `NODE_ENV=development`, `?dia=lunes|...|domingo` fuerza el día también en `/molotes`. En test y en producción se ignora.
- **R-8. Documentación.** `CLAUDE.md` §1, §5 y §11 y el README describen la regla nueva.

## Historias de usuario

- **HU-1.** Como cliente que entra a `/molotes` en fin de semana, quiero saber que hoy toca birria y llegar a ella, o quedarme a ver los molotes.
- **HU-2.** Como cliente que entra a `/molotes` un lunes, quiero saber que hoy descansan y cuándo vuelven.

## Criterios de aceptación

- **CA-1.** Fin de semana en `/molotes`.
  - **Dado** sábado o domingo en `TIMEZONE`.
  - **Cuando** se carga `/molotes`.
  - **Entonces** el HTML incluye el aviso con los textos exactos de R-2 y, con JavaScript, se abre automáticamente.
- **CA-2.** Lunes y entre semana en `/molotes`.
  - **Dado** lunes: el HTML de `/molotes` incluye el aviso con los textos exactos de R-3.
  - **Dado** martes a viernes: no incluye ningún aviso.
- **CA-3.** Las otras rutas no cambian.
  - `/birria` no incluye ningún aviso, ningún día.
  - El aviso de `/` sigue igual: lunes "Descanso", martes a viernes "Molotes", fin de semana ninguno.
  - Las pruebas existentes de REQ-F-028 pasan.
- **CA-4.** Botones, teclado y foco.
  - "Ver Birria El Muñeco" lleva a `/birria`.
  - "Quedarme en Molotes", "Ver el menú" y Escape cierran el aviso, y el foco vuelve a la página.
  - Con el aviso abierto, Tab no sale de él.
- **CA-5.** Una vez por sesión.
  - En la misma sesión del navegador, recargar `/molotes` no vuelve a abrir el aviso.
  - Si el aviso de descanso ya se mostró en `/` ese lunes, no se muestra en `/molotes`, y al revés.
  - Haber visto el aviso "Molotes" de `/` no impide el aviso de fin de semana.
- **CA-6.** Sin JavaScript y sin almacenamiento.
  - Sin JavaScript, el aviso no se ve y los productos de `/molotes` se pueden consultar.
  - Si sessionStorage lanza un error, el aviso se muestra y se puede cerrar.
- **CA-7.** Forzar el día en desarrollo.
  - Con `NODE_ENV=development`, `/molotes?dia=sabado` y `/molotes?dia=lunes` muestran su aviso y `/molotes?dia=martes` no muestra ninguno.
  - En test y en producción, `?dia` se ignora.
- **CA-8.** Las transiciones viernes→sábado, domingo→lunes y lunes→martes a las 00:00 de `TIMEZONE` se prueban con un reloj inyectado.
- **CA-9.** A 320, 768 y 1280 px el aviso cabe en pantalla, con desplazamiento interno si hace falta. El contraste de textos y botones es al menos AA.
- **CA-10.** `CLAUDE.md` §1, §5 y §11 y el README describen la tabla del cambio de regla.
- **CA-11.** No hay dependencias nuevas. `npm run typecheck`, `npm run lint` y `npm test` terminan en 0, y el snapshot de Molotes se revisa.

## Casos límite

- Cambio de día a medianoche (CA-8). `Cache-Control: no-cache` ya obliga a revalidar.
- Botón "atrás" con caché del navegador (bfcache) y una pestaña nueva de la misma sesión.
- sessionStorage bloqueado (CA-6).
- Llegar desde el aviso de descanso de `/` con "Mañana hay molotes" (CA-5).
- Llegar desde el pie de Birria (REQ-F-033) en fin de semana: el aviso aparece, y es lo esperado.

## Dependencias

- Va después de REQ-F-033 por orden de integración: ambos tocan `molotes.html` y el contenido de Molotes.
- Aviso existente de REQ-F-028 (patrón que se reutiliza).

## Riesgos

- Romper el aviso de `/` al compartir el código: lo cubre CA-3.
- Restar visitas a Molotes el fin de semana: es intencional.

## Action Plan

### Objetivo
Avisos de lunes y de fin de semana en `/molotes`, coherentes con el de `/`.

### Cambios requeridos
1. Añadir los textos de R-2 y R-3 al contenido de Molotes.
2. Decidir el aviso por día en `/molotes`, en el servidor.
3. Reutilizar el diálogo y su módulo con la paleta de Molotes y la marca de sesión de R-5.
4. Activar `?dia` en `/molotes` en desarrollo.
5. Pruebas: días, medianoche, sesión, accesibilidad y no regresión de `/` y `/birria`.
6. Actualizar `CLAUDE.md` y el README.

### Orden recomendado
Lógica por día → contenido y plantilla → JavaScript (marcas de sesión) → pruebas → documentación.

### Resultado esperado
`/molotes` orienta a la persona el lunes y el fin de semana sin bloquear la página. `/` y `/birria` no cambian.

## Revisión técnica

Revisión del 2026-10-24 sobre `main` en `04e471e` (después de REQ-F-033, REQ-F-035 y los cambios de dependencias). Sin bloqueos: el alcance sigue siendo coherente con el código. Puntos desactualizados o implícitos que el plan resuelve sin cambiar el alcance funcional:

- **RT-1. Nombre de la variable.** El ticket dice `TIMEZONE`; la variable real es `BUSINESS_TIMEZONE` (`src/config/env.ts`, `.env.example`). El plan y la documentación usan `BUSINESS_TIMEZONE`.
- **RT-2. Deuda heredada de REQ-F-033 (R-T4, decisión 4).** `homeNotices.*.linkHref: '/molotes'` está escrito a mano en `src/content/birria/index.ts`. El usuario decidió en REQ-F-033 que se corrige aquí: se sustituye por el negocio de destino (`business: BUSINESS.MOLOTES`) y la ruta sale de `BUSINESS_PATHS`, como `footer.crossLink`. El HTML de `/` no cambia (lo comprueban las pruebas de REQ-F-028).
- **RT-3. Pruebas que codifican la regla anterior.** `tests/unit/home-notice.test.ts` ("Molotes nunca pinta el aviso") y `tests/integration/app.test.ts` (CA-13: "`?dia` en desarrollo no afecta a /birria ni a /molotes") afirman la regla que este ticket cambia. Se actualizan a la regla nueva; no son regresiones. El resto de pruebas de REQ-F-028 sigue igual.
- **RT-4. Paleta.** Las utilidades de Tailwind solo se generan desde las rutas `@source` de cada hoja: el diálogo de Molotes necesita su propio parcial en `src/views/partials/molotes/` con los tokens de `src/styles/molotes/main.css`. Se duplica el marcado (unas 10 líneas), no la lógica: el módulo `public/js/modules/home-notice.js` es el mismo.
- **RT-5. Logo del botón principal.** El texto "Ver Birria El Muñeco" ya nombra el destino, así que el logo es decorativo (`alt=""`): se usa `images.emblem` de Birria (`/img/birria/logo-birria.webp`), igual que el enlace del pie de REQ-F-033. Así el nombre accesible del enlace no repite el nombre.
- **RT-6. REQ-F-035** (forma de pago del bot) no toca landings, contenido de avisos ni `business-schedule.ts`: sin impacto.

## Technical Action Plan

### Objetivo técnico
Generalizar la decisión del aviso por día para que dependa de la página (`/` o `/molotes`), pintar en `/molotes` un `<dialog>` con la paleta de Molotes y abrirlo con el mismo módulo `home-notice.js`, sin cambiar `/` ni `/birria`.

### Archivos o componentes afectados
- `restaurante/src/services/business-schedule.ts`: tabla del aviso de `/molotes` y su tipo.
- `restaurante/src/controllers/landing.ts`: elige la tabla según la ruta; `?dia` también en `/molotes` (solo desarrollo).
- `restaurante/src/views/landings/index.ts`: `LandingView.homeNotice` pasa a tiparse por negocio; función común para resolver el enlace del aviso con `BUSINESS_PATHS`.
- `restaurante/src/views/landings/birria.ts`: usa el enlace resuelto (RT-2).
- `restaurante/src/views/landings/molotes.ts`: `renderNotice` del aviso de Molotes.
- `restaurante/src/content/molotes/index.ts`: `notices.weekend` y `notices.rest` con los textos de R-2 y R-3.
- `restaurante/src/content/birria/index.ts`: `linkHref` → `business` (RT-2).
- `restaurante/src/views/partials/molotes/notice.html` y `notice-weekend-action.html` (nuevos).
- `restaurante/src/views/partials/birria/home-notice-*-action.html`: `href` del enlace resuelto.
- `restaurante/src/views/pages/molotes.html`: `{{{ notice }}}` al final de la página, fuera de `<main>` (como en Birria).
- `restaurante/public/js/molotes/main.js`: llama a `initHomeNotice()` al final.
- `restaurante/public/js/modules/home-notice.js`: solo comentarios (documenta los avisos de `/molotes` y la marca compartida). Sin cambios de lógica.
- Pruebas: `tests/unit/business-schedule.test.ts`, `tests/unit/home-notice.test.ts`, `tests/integration/app.test.ts`, `tests/unit/landing-snapshot.test.ts` (snapshot de Molotes revisado).
- Documentación: `.claude/CLAUDE.md` §1, §5 y §11; `restaurante/README.md` (introducción).

### Backend
1. `business-schedule.ts`:
   - Tipo `MolotesNotice = 'rest' | 'weekend'` y tabla `MOLOTES_NOTICES` (lunes `rest`; martes a viernes `null`; sábado y domingo `weekend`).
   - `getMolotesNotice({ now, timeZone, forcedDay })`, con la misma forma que `getHomeNotice` (que no cambia).
   - Tipo `NoticeByBusiness = { birria: HomeNotice; molotes: MolotesNotice }`.
2. `landing.ts`: `/` → `getHomeNotice`; `/molotes` → `getMolotesNotice`; `/birria` → `null`. `forcedDay` sigue calculándose solo con `nodeEnv === 'development'`.
3. `renderLandingPage`: `homeNotice?: NoticeByBusiness[Id] | null`. Un valor que no corresponde al negocio es error de tipos (la prueba "Molotes nunca pinta el aviso" pasaba `'molotes'` a Molotes; se sustituye, RT-3).

### Frontend
- `partials/molotes/notice.html`: misma estructura que `partials/birria/home-notice.html`:
  - `<dialog data-home-notice="{{ variant }}" aria-labelledby="home-notice-title">`, con `h2`, párrafo, `{{{ action }}}` y botón `data-action="close-home-notice"`.
  - Mismas clases de tamaño y desplazamiento: `w-[calc(100%-2rem)] max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto`, `m-auto` y `backdrop:`.
  - Colores de Molotes: fondo `surface-container`; título en `secondary`; texto en `on-surface`; botón principal en `secondary-container` con texto `on-secondary`; botón secundario con borde claro; foco visible.
  - Contraste AA verificado con los valores hex del tema (CA-9).
- Variantes:
  - `weekend`: enlace con el emblema de Birria y "Ver Birria El Muñeco" hacia `BUSINESS_PATHS.birria`, más el botón "Quedarme en Molotes".
  - `rest`: sin enlace; un único botón "Ver el menú" que cierra.
- Marcas de sesión (R-5), sin tocar la lógica del módulo, porque la clave es `homeNotice:<variante>:seen`:
  - `rest` en `/molotes` usa la misma clave que `rest` en `/`: se ve una sola vez entre ambas rutas (CA-5).
  - `weekend` tiene su clave propia, distinta de `homeNotice:molotes:seen` del aviso "Molotes" de `/`.
- `molotes/main.js`: `initHomeNotice()` después de `initPromoForms()`.

### Contenido / configuración
- `molotesContent.notices`:
  - `weekend`: `{ title, body, linkLabel, business: BUSINESS.BIRRIA, closeLabel }`.
  - `rest`: `{ title, body, closeLabel }`.
  - Textos exactos de R-2 y R-3.
- Birria (RT-2): `homeNotices.molotes.linkHref` y `homeNotices.rest.linkHref` → `business: BUSINESS.MOLOTES`. Resto de textos y logo sin cambios.
- Sin variables de entorno nuevas.

### Validaciones
- `?dia` sigue pasando por `parseForcedDay`, que ya acepta solo los siete valores sin acento y descarta valores repetidos, `__proto__` o `constructor`. Se ignora fuera de desarrollo.
- El renderizador falla rápido si falta una clave de contenido.

### Manejo de errores
Sin cambios: un error de plantilla lo atiende el manejador central.

### Testing
- **Unitarias (`business-schedule.test.ts`)**:
  - `getMolotesNotice`: los 7 días.
  - Transiciones viernes→sábado, domingo→lunes y lunes→martes a las 00:00 de `America/Mexico_City`, con una fecha inyectada (CA-8).
  - Día de la zona del negocio y no de UTC.
  - El día forzado sustituye al calculado.
- **Unitarias (`home-notice.test.ts`, jsdom sobre el HTML real de Molotes)**:
  - Textos exactos de R-2 y R-3, `aria-labelledby` y que el diálogo llega sin `open` (CA-1, CA-2).
  - El enlace lleva a `/birria` y el emblema tiene `alt=""` (CA-4).
  - "Quedarme en Molotes" y "Ver el menú" cierran el diálogo (CA-4).
  - Marcas de sesión (CA-5):
    - recargar no reabre;
    - `homeNotice:rest:seen` puesta en `/` impide el aviso de `/molotes`, y al revés;
    - `homeNotice:molotes:seen` no impide `weekend`.
  - sessionStorage que lanza error: se abre y se cierra (CA-6).
  - Sin aviso, `/molotes` no tiene `<dialog>` y el resto del HTML es idéntico (CA-6, sin JS).
  - Los textos no están en las plantillas ni en el JS. La prueba equivalente de Birria se ajusta a `business` en lugar de `linkHref`.
  - La prueba antigua "Molotes nunca pinta el aviso" se sustituye por "Birria (`/birria`) nunca pinta aviso" (RT-3).
  - Escape y foco contenido son nativos de `showModal()`. jsdom no los implementa, así que se cubren como en REQ-F-028: marcado de `<dialog>` modal más verificación manual.
- **Integración (`app.test.ts`, `listenLocal`)**:
  - `/molotes` con reloj de lunes, martes y sábado (CA-1, CA-2).
  - `/birria` sin aviso los 7 días y `/` sin cambios (CA-3).
  - En desarrollo, `/molotes?dia=sabado|lunes|martes` (CA-7).
  - Con `NODE_ENV` test y production, `?dia` ignorado en `/molotes`.
  - La prueba CA-13 "no afecta a /molotes" pasa a "no afecta a /birria" (RT-3).
- **Snapshot (`landing-snapshot.test.ts`)**: el snapshot de Molotes se renderiza sin aviso. Se revisa el diff (a lo sumo un salto de línea por `{{{ notice }}}` vacío) y el de Birria debe quedar intacto (CA-11).
- **Manual (CA-9)**: `npm run dev` con `?dia=sabado` y `?dia=lunes` en `/molotes`, a 320, 768 y 1280 px. Se comprueban Tab y Escape.
- **Comandos**: `npm run build:css`, `npm run typecheck`, `npm run lint` y `npm test`.

### Seguridad
- Todo el texto se escapa con `{{ }}`. Solo `{{{ action }}}` y `{{{ notice }}}` llevan salida de otro render.
- Sin JS inline: la CSP no cambia.
- `?dia` sigue desactivado fuera de desarrollo.
- Sin dependencias nuevas.

### Performance
- Una búsqueda en una tabla congelada por petición.
- El módulo JS ya existe: Molotes solo añade un import pequeño.
- `Cache-Control: no-cache` se mantiene.

### Riesgos técnicos
- **Romper el aviso de `/` al tipar por negocio o al cambiar `linkHref`.** Lo cubren las pruebas existentes de REQ-F-028, que se conservan salvo las de RT-3.
- **Abuso del nombre "home-notice" fuera de `/`.** Se mantiene para no renombrar el módulo, los atributos ni las claves de sesión. Cambiar las claves rompería la marca compartida de R-5. Queda documentado en el módulo.
- **Marca de sesión sin fecha.** Una pestaña que sigue abierta de un lunes al siguiente no vuelve a ver el aviso de descanso. Es el comportamiento actual de REQ-F-028 y es aceptable.

### Orden de implementación
1. `business-schedule.ts` y sus pruebas.
2. Contenido de Molotes y Birria (RT-2), parciales y vistas.
3. Controlador e integración.
4. `molotes/main.js` y las pruebas jsdom.
5. Snapshot.
6. `build:css`, `typecheck`, `lint`, `test` y la verificación manual.
7. `CLAUDE.md` y README.

### Criterios de finalización
- CA-1 a CA-11 verificados (CA-9 a mano).
- `/` y `/birria` sin cambios visibles: el snapshot de Birria queda igual y las pruebas de REQ-F-028 pasan.
- `typecheck`, `lint` y `test` terminan en 0.
- Sin dependencias nuevas.

## Implementation Result

### Rama
`feature/REQ-F-034-avisos-molotes-descanso-fin-de-semana` (desde `origin/main` en `04e471e`).

### Cambios realizados
- `business-schedule.ts`: `MolotesNotice` (`'rest' | 'weekend'`), tabla congelada `MOLOTES_NOTICES` (lunes `rest`, martes a viernes `null`, sábado y domingo `weekend`), `getMolotesNotice` con la misma forma que `getHomeNotice` (sin cambios) y el tipo `NoticeByBusiness`.
- `controllers/landing.ts`: `noticeFor` elige la tabla por ruta (`/` → `getHomeNotice`, `/molotes` → `getMolotesNotice`, `/birria` → `null`). `?dia` sigue calculándose solo con `NODE_ENV=development` y ahora también afecta a `/molotes`.
- `views/landings/index.ts`: `homeNotice` tipado por negocio (`NoticeByBusiness[Id] | null`).
- RT-2: `homeNotices.*.linkHref: '/molotes'` sustituido por `business: BUSINESS.MOLOTES`; la ruta la resuelve `withNoticeHref` (`views/landings/shared.ts`) con `BUSINESS_PATHS`. Los parciales de Birria usan `notice.href`. El HTML de `/` no cambia.
- Contenido de Molotes: `notices.weekend` y `notices.rest` con los textos exactos de R-2 y R-3.
- Vistas: `partials/molotes/notice.html` (misma estructura y clases de tamaño/desplazamiento que el aviso de `/`, paleta de Molotes) y `partials/molotes/notice-weekend-action.html` (enlace a `/birria` con el `emblem` de Birria, `alt=""`). `renderNotice` en `views/landings/molotes.ts`; `{{{ notice }}}` al final de `pages/molotes.html`, fuera de `<main>`.
- JS: `public/js/molotes/main.js` llama a `initHomeNotice()` al final. `home-notice.js` solo cambia comentarios (avisos de Molotes y marca compartida `homeNotice:rest:seen`).
- Documentación: `.claude/CLAUDE.md` §1, §5 y §11 y `restaurante/README.md` (introducción con la tabla y sección HTTP).

### Desviaciones menores respecto al plan
- `withNoticeHref` vive en `views/landings/shared.ts` (utilidades de los constructores de landing) y no en `index.ts`: evita un import circular en tiempo de ejecución `index.ts` ↔ `molotes.ts`/`birria.ts`.
- El botón de cierre toma su tono de `NOTICE_CLOSE_TONES` (`molotes.ts`): en `weekend` es secundario (borde claro, junto al enlace a Birria); en `rest` es el **único** botón y se pinta como principal (`secondary-container` con texto `on-secondary`), para que el aviso de descanso no quede sin acción destacada. Mismo texto y comportamiento que el plan.
- Un aviso que no corresponde a Molotes (p. ej. `'molotes'`) es error de tipos y, en tiempo de ejecución, falla rápido ("Aviso desconocido") por `requireOption`.
- Se añadieron dos casos a `tests/unit/footer-cross-link.test.ts` (Molotes con `weekend` y `rest`): el enlace del pie sigue siendo único con los avisos.

### Criterios de aceptación
- CA-1: cumplido. `/molotes` en sábado y domingo incluye el aviso `weekend` con los textos exactos de R-2 (integración y jsdom); `molotes/main.js` lo abre con `initHomeNotice` (jsdom).
- CA-2: cumplido. Lunes: textos de R-3 y un único botón "Ver el menú"; martes a viernes: sin `<dialog>` (integración, 9 instantes).
- CA-3: cumplido. `/birria` sin aviso los 7 días; aviso de `/` sin cambios (lunes `rest`, martes a viernes `molotes`, fin de semana ninguno). Pruebas de REQ-F-028 en verde salvo las dos de RT-3, actualizadas a la regla nueva. Snapshot de Birria intacto.
- CA-4: cumplido en lo automatizable. Enlace a `/birria`; "Quedarme en Molotes" y "Ver el menú" cierran (jsdom). Escape y el foco contenido son nativos de `showModal()` (jsdom no los implementa, como en REQ-F-028): pendiente de comprobación manual con teclado.
- CA-5: cumplido (jsdom). Recargar no reabre (ambas variantes); `rest` visto en `/` impide el de `/molotes` y al revés; `homeNotice:molotes:seen` no impide `weekend`.
- CA-6: cumplido. Sin aviso no hay `<dialog>` y el resto del HTML de `/molotes` es idéntico byte a byte; con sessionStorage que lanza, se abre y se cierra.
- CA-7: cumplido. En desarrollo `/molotes?dia=sabado|domingo|lunes` muestran su aviso y `martes|viernes`, ninguno; valores no válidos se ignoran; con `NODE_ENV` test y production, `?dia` no tiene efecto.
- CA-8: cumplido. Viernes→sábado, domingo→lunes y lunes→martes a las 00:00 de `America/Mexico_City` con fecha inyectada, y día de la zona del negocio frente a UTC.
- CA-9: cumplido en lo visual. Capturas con Chrome headless (servidor de vista previa desechable fuera del repositorio) a 320 (iframe de 320 px, porque Chrome headless no baja la ventana de ~500 px), 768 y 1280 px: el aviso cabe en pantalla en las dos variantes. Contraste AA calculado con los hex del tema: título `#ffc472` sobre `#102038` 10.4:1; texto `#d6e3ff` sobre `#102038` 12.7:1; botón principal `#452b00` sobre `#f3a300` 6.3:1; botón secundario `#d6e3ff` sobre `#102038` 12.7:1. Tab y Escape: no comprobados de forma interactiva (pendiente manual).
- CA-10: cumplido. `.claude/CLAUDE.md` §1, §5 y §11 y el README describen la tabla.
- CA-11: cumplido. Sin dependencias nuevas; `typecheck`, `lint` y `test` en 0. Snapshot de Molotes revisado: sin cambios (el `{{{ notice }}}` vacío no añade bytes).

### Validaciones ejecutadas
- `npm ci --strict-allow-scripts` y `npm run db:generate` (worktree limpio): 0.
- `npm run build:css`: 0 (las utilidades nuevas están en `public/css/molotes/main.css`).
- `npm run typecheck`: 0.
- `npm run lint`: 0, sin errores ni avisos.
- `npm test` (MySQL local ya levantado): 93 archivos, 1980 pruebas superadas y 1 *expected fail* preexistente; 0 fallos.

### Archivos afectados
- `.claude/CLAUDE.md`, `restaurante/README.md`
- `restaurante/src/services/business-schedule.ts`, `restaurante/src/controllers/landing.ts`
- `restaurante/src/views/landings/{index,birria,molotes,shared}.ts`
- `restaurante/src/content/{birria,molotes}/index.ts`
- `restaurante/src/views/pages/molotes.html`, `restaurante/src/views/partials/molotes/notice.html` (nuevo), `restaurante/src/views/partials/molotes/notice-weekend-action.html` (nuevo), `restaurante/src/views/partials/birria/home-notice-{molotes,rest}-action.html`
- `restaurante/public/js/molotes/main.js`, `restaurante/public/js/modules/home-notice.js` (solo comentarios)
- `restaurante/tests/unit/{business-schedule,home-notice,footer-cross-link}.test.ts`, `restaurante/tests/integration/app.test.ts`

### Riesgos o pendientes
- Verificación manual con teclado (Tab contenido y Escape) en un navegador real, con `npm run dev` y `/molotes?dia=sabado` y `/molotes?dia=lunes`.
- Marca de sesión sin fecha (comportamiento heredado de REQ-F-028, aceptado en el plan).

## Trazabilidad

| Respuesta del usuario | Decisión | Requisitos | Criterios |
|---|---|---|---|
| Regla semanal "1 a" | Molotes de martes a viernes, lunes descanso | RN-2, R-1 | CA-2, CA-3 |
| Texto del modal "2 si" | «te esperan de martes a viernes» | R-2 | CA-1 |
| Cambio de regla "3 si" | Aviso en `/molotes`, actualizar CLAUDE.md | R-1, R-8 | CA-1, CA-10 |
| Lunes "4 b" | Aviso de descanso en `/molotes` | R-3 | CA-2 |
| Destino "5 si" (`/birria`) | El botón principal lleva a `/birria` | R-2 | CA-4 |
| Aspecto del modal: opción a) | Estructura del aviso de `/` con la paleta de Molotes | R-6 | CA-9 |
| V-5 | El descanso comparte la marca de sesión con `/` | R-5 | CA-5 |
| Tres tickets "19 b" | Tercero de la serie 032 → 033 → 034 | — | — |
| Aprobación "si" | Textos de R-2 y R-3 aprobados | R-2, R-3 | CA-1, CA-2 |

Objetivo → R-1 a R-8 → HU-1, HU-2 → CA-1 a CA-11 → diseño (aviso existente `restaurante/src/views/partials/birria/home-notice.html`; sin equivalente en `_stich_source_/`) → Action Plan.

## Historial de cambios

### Versión 1
Descripción inicial, aprobada por el usuario el 2026-10-15.

### Versión 2 (senior-fullstack, T1)
2026-10-24: revisión técnica sin bloqueos (RT-1 a RT-6) y Technical Action Plan. Estado `NEEDS_TECHNICAL_PLAN_APPROVAL`.

### Versión 3 (senior-fullstack, T2)
2026-10-24: Technical Action Plan aprobado por el usuario ("Sí, apruebo el plan"). Ticket a `in-progress/`, estado `IN_PROGRESS`; implementación en la rama `feature/REQ-F-034-avisos-molotes-descanso-fin-de-semana`, validada (`build:css`, `typecheck`, `lint`, `test`). Estado `NEEDS_IMPLEMENTATION_APPROVAL`.
