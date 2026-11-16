# REQ-F-044 — Página en MySQL y edición en el admin nuevo

## Estado

DONE

PR 3 (el corte) mergeado en `epic/arquitectura` ([#147](https://github.com/orvigas/negocio/pull/147), `f144a4b`) y la épica en `main` con [#148](https://github.com/orvigas/negocio/pull/148) (merge `0736fa0`, ejecución 43801922215, `deploy` en `success`, 2026-11-16). CA-17 (`smoke.sh`): el job `docker` de #148, que lo corre en PR hacia `main`, terminó en `pass`.

Comprobaciones de producción tras el despliegue (2026-11-16, por la sesión principal, solo lectura):
- `api`, `app` e `inventory-manager` en `healthy`; `/`, `/molotes`, `/birria` y `/admin/login` responden 200, y el acceso del admin nuevo también.
- `app` registró dos `page_import_done` con `source` `current` (Molotes: historial 1; Birria: historial 2) y 0 líneas omitidas; sin `page_import_failed`, `page_json_diverged`, `landing_page_fallback` ni `menu_data_damaged`.
- `page_import` tiene dos filas (`molotes` 1@2026-10-14T16:39:21-06:00 y `birria` 2@2026-10-16T08:47:31-06:00) y `page_version` dos versiones por negocio.
- `current.json` de ambos negocios y `changes.jsonl` siguen con el mismo tamaño que antes (6746, 6960 y 1227 bytes).
- `/admin/molotes` sin sesión redirige al acceso.

**No comprobado:** con sesión de administrador, que `/admin/<negocio>` salga sin formulario con el enlace al admin nuevo, que "Página" se pueda editar y un cambio de prueba se vea en la landing y se deshaga con "Restaurar versión anterior"; quedan para el usuario. El ticket se cierra porque el usuario confirmó el merge. Sigue el ticket 6 (retirar `/admin`), solo cuando la importación se haya ejecutado en producción: ya se ejecutó.

## Aprobación

Aprobado por el usuario (versión 1, fecha 2026-11-05). Cita textual: "Apruebo el requisito y entran antes", en respuesta a "¿Apruebas el requisito, y qué opción eliges para los PR 1 y 2?".

Se le presentaron objetivo, alcance, las 9 decisiones, fuera de alcance, orden, riesgos y los CA-1 a CA-17, estos últimos solo por número y temas; no pidió verlos.

CA-18, CA-19 y la ampliación de RF-4 se redactaron después de esa respuesta, a pedido de la sesión principal, para cubrir la ventana que el usuario aceptó con D-9. No se le presentaron por separado.

Paso 4, ticket 5 del plan de migración (`restaurante/docs/arquitectura.md` §8, "Plan del paso 4 (REQ-F-039)"). Los PR de este ticket van a `epic/arquitectura` (`.claude/rules/git.md`).

### Autorización para `.claude/CLAUDE.md`

Autorizada por el usuario (2026-11-05, transmitida por la sesión principal) la actualización de `.claude/CLAUDE.md` §8, solo esa sección, para que `api` e `inventory-manager` incluyan los datos de página. Cita textual: "Sí a ambas (Recomendado)". El cambio lo hace `senior-fullstack` dentro de la implementación.

## Decisiones del usuario

- **D-0 — Dónde viven los datos de página:** "Pasa a MySQL", en respuesta a "¿el menú se queda en archivos o pasa a MySQL?".
- **D-1 — Historial (`changes.jsonl`):** "Importarlo a MySQL (Recomendado)".
- **D-2 — JSON dañado en la importación:** "Seguir con lo publicado (Recomendado)". No se detiene el despliegue; se importa lo que la landing publica y se conserva el archivo.
- **D-3 — Vuelta atrás:** "No sincronizar (Recomendado)". Los JSON quedan congelados, las ediciones se conservan en MySQL y un log avisa al avanzar de nuevo.
- **D-4 — Landing sin copia previa:** "La semilla (Recomendado)".
- **D-5 — Restaurar semilla:** "No llevarla (Recomendado)". El admin nuevo no tiene esa acción.
- **D-6 — `/admin` sin `ADMIN_NEW_URL`:** "Sigue escribiendo, en MySQL (Recomendado)".
- **D-7 — Secuencia:** "Sí, antes del PR 3 (Recomendado)". Se le advirtió que son dos despliegues y que el primero publica el bot en `api`.
- **D-8 — `.claude/CLAUDE.md` §8 y nombre:** "Sí a ambas (Recomendado)". La sección del admin nuevo se llama "Página".
- **D-9 — PR 1 y 2 frente al primer despliegue:** "Apruebo el requisito y entran antes". Entran en `epic/arquitectura` antes del primer despliegue. Queda aceptada la ventana en la que producción tiene las tablas y la pantalla "Página" en estado "no disponible".

- **D-10 — Aprobación del plan y protección de la semilla:** "si", en respuesta a "¿Apruebas el plan con los puntos 1 a 3, y añadimos esa protección al punto 4?" (2026-11-05, transmitida por la sesión principal). Puntos 1 a 3: importación conjunta; `/admin` sin `ADMIN_NEW_URL` sin aviso de "dañado" y con "restaurar semilla" en "no permitido"; `expectedVersion` obligatoria al restaurar. Protección del punto 4: la importación se niega a usar la semilla si ya hay productos importados en la base (instalación existente) y no publica semilla en silencio en producción; una instalación nueva sigue funcionando (CA-5).
- **Aceptación sobre D-10 y D-2 — JSON dañado sin `previous` válido:** "Lo apruebo", en respuesta a "¿Apruebas la implementación del PR 1 para pasarla a QA, y aceptas que un JSON dañado sin `previous` válido detenga el despliegue?" (2026-11-05, transmitida por la sesión principal). Decisión del usuario que resuelve el conflicto con D-2: en una instalación existente, `current` dañado sin `previous` válido detiene el despliegue (CA-20). `current` dañado con `previous` válido sigue sin detener nada.
- **D-11 — Implementación del PR 2 y aviso sin enlace:** "si", en respuesta a "¿Apruebas la implementación para pasarla a QA, con el aviso sin enlace?" (2026-11-05, transmitida por la sesión principal). El aviso de la puerta cerrada de "Página" no enlaza al `/admin` actual. El plan técnico pedía enlace, pero `inventory-manager` no conoce `RESTAURANTE_DOMAIN` y no se añaden variables. CA-18 y RF-4 no lo exigen.
- **D-12 — QA del PR 2 reducido a lógica y choque entre RF-9 y CA-18:** "Plan reducido a lógica (Recomendado)", descrita como "Edición, conflicto, restauración, permisos, fallos y accesibilidad con MySQL real. Sin mutaciones ni diferenciales. Acepta perder lo escrito si se cierra la puerta en una vuelta atrás." (2026-11-05, transmitida por la sesión principal). Resuelve el choque: si la puerta se cierra con un formulario abierto, prevalece CA-18 y lo escrito puede perderse.

- **D-13 — Plan técnico del PR 3:** "Apruebo, implementar" (2026-11-16, transmitida por la sesión principal).
- **D-14 — Aviso de "no disponible" tras el corte:** "Texto neutro (Recomendado)": "La página no está disponible en este momento. No se cambió nada. Inténtalo en unos minutos; si sigue igual, avisa al administrador." Mismo código, sin distinguir "sin datos" de "dañado".
- **D-15 — Pruebas del PR 3:** "Solo la unitaria pura (Recomendado)". Solo queda permanente la unitaria de `core/catalog/page-import.ts`; MySQL real, proceso, vuelta atrás, smoke y cadena completa se ejecutan en QA y se descartan. Las pruebas existentes que cambian de comportamiento se modifican y se borra `landing-pages/tests/integration/api-page-process.test.ts`.
- **D-16 — Ensayo con datos reales:** "Sí, ensayar (Recomendado)". Lo hace QA.
- **D-17 — Vuelta atrás con `page_json_diverged`:** "Vaciar y reimportar (Recomendado)". Solo documentación (`despliegue.md` §6).

Estas decisiones son propias de este ticket: no confundirlas con las D-x de otros tickets.

## Objetivo

Que los datos de página de cada negocio se editen en el admin nuevo y vivan en MySQL, sin perder datos y sin cambiar el HTML de las landings. Es lo último que falta para retirar `/admin` en el ticket 6.

**Actores:** administrador (ambos negocios), editor (sus negocios asignados) y visitante de las landings.

## Alcance

- Datos de página e historial en MySQL.
- Contratos y endpoints en `/api/v1/public` y `/api/v1/admin`.
- Importación única de los datos reales de producción.
- Consumo de la página por las landings a través de la API.
- Sección "Página" en `inventory-manager`.
- Solo lectura de la página en `/admin` con `ADMIN_NEW_URL`.
- Documentación.

## Fuera de alcance

- Horarios, avisos del día y textos estáticos de `src/content/`.
- Imágenes y carga de archivos: el esquema de página no tiene campos de imagen.
- Ver el historial en pantalla.
- Los productos, incluidas las listas congeladas de los JSON.
- "Restaurar semilla" en el admin nuevo (D-5).
- Sincronizar MySQL con los JSON en una vuelta atrás (D-3).
- Lo reservado al ticket 6: mover la importación de semillas, retirar `/admin`, el router `restaurante-admin` y el repositorio de archivos, quitar `DATA_DIR` y las credenciales de `landing-pages`, activar el lint de `/admin` y decidir el destino del volumen `app-data`.

## Hechos observados en el repositorio

Rama `epic/arquitectura`, `421f4e6`.

- **Qué entra en "página"** (`PAGE_SCHEMAS`, `core/catalog/menu-schema.ts`):
  - Molotes: showcase del hero (etiqueta, título, descripción, precio, unidad), `menu.highlight` y promo.
  - Birria: showcase (título, descripción, precio) y promo.
  - El resto del hero sigue en `src/content/`.
- **"Menú" en el código significa el documento JSON completo.** Sus listas de productos están congeladas desde REQ-F-008 (Q-3 A). Solo se migra la página.
- **Sin imágenes.** El esquema de página no tiene campos de imagen, así que `imageExists` no se aplica.
- **Validación:** `menu-schema` usa validadores propios de `core`. Zod solo está en `contracts`.
- **Bot:** `api/src` no menciona hero, promo, highlight ni showcase (búsqueda léxica).
- **Versionado actual:** `revision@updatedAt`, una sola versión anterior, y restaurar intercambia las dos versiones. `restoreSeed` solo se permite con datos dañados.
- **"Último cambio"** sale de `updatedAt` y `updatedBy` (nombre sin id), no de `changes.jsonl`.
- **`changes.jsonl`** es un solo archivo global. Las entradas anteriores a REQ-F-007 no tienen `authorId`.
- **Volumen:** solo `app` monta `app-data`; `api` y `migrate` no (`deploy/compose.prod.yaml`).
- **Orden de `deploy.sh`:** volcado, migrar, `api`, `inventory-manager`, `app`. Un fallo vuelve a los digests anteriores con `DATABASE_ALLOW_NEWER_SCHEMA=true`.
- **Respaldos:** `backup.sh` y `restore.sh` cubren dump y `app-data`. `backup.sh` falla si faltan ciertas carpetas en `app-data`.
- **`landing-pages/src/server.ts`** usa `repository.getStartupSource` para `products.init`: el repositorio de archivos no puede desaparecer antes del ticket 6.
- **`_stich_source_/`** no tiene nada de administración. Rige el sistema visual de `inventory-manager`.
- **`arquitectura.md` §6** menciona horarios y aviso en `/api/v1/public`, pero la decisión "Solo productos" de REQ-F-038 los dejó en `landing-pages`. Este ticket solo añade la página.

## Inferencias sin verificar

Las resuelve `senior-fullstack` en la revisión técnica.

- La importación la hace la `app` nueva al arrancar: es la única con volumen y credenciales, sigue el patrón D-8 de REQ-F-008 y la `app` anterior ya está detenida en ese momento. Si la hiciera `migrate`, necesitaría el volumen y la `app` anterior seguiría escribiendo después.
- El usuario `restaurante_backup` cubre las tablas nuevas.
- La lista exacta de carpetas que exige `backup.sh`.
- Cómo se avisa la frescura de la página: si reutiliza el aviso `/internal/v1/productos-cambiados` o usa uno propio.
- Cómo se comparte con `api` la lectura del formulario, que hoy está en `landing-pages/src/services/admin-form.ts`.

## Requisitos

- **RF-1 Datos.** MySQL guarda por negocio la versión vigente y una anterior, con revisión, fecha y autor. El formato y las validaciones no cambian. Los productos congelados no se migran.
- **RF-2 Importación única.** Se ejecuta una sola vez por negocio y es todo o nada. Lleva `current.json`, `previous.json` y el historial de `changes.jsonl`, conservando revisión, fecha y autor. No modifica ni borra los archivos. La marca de "ya importado" vive en MySQL, de modo que restaurar un dump anterior a la importación permite repetirla.
- **RF-3 Regla de la importación.** Se importa lo que la landing publica hoy: `current`; si está dañado, `previous`; si tampoco sirve, la semilla. El despliegue no se detiene por un JSON dañado.
  - **Precisión por D-10:** la semilla solo se importa en una instalación nueva. En una instalación existente, si ni `current` ni `previous` sirven, la importación se niega (CA-20). Es la única excepción a "no se detiene": un JSON dañado con otra versión válida sigue sin detener nada.
- **RF-4 Un solo escritor y ventana hasta la importación.** En ningún momento hay dos escritores en producción. Hasta que termine la importación:
  - `/admin` sigue siendo el escritor y las landings siguen leyendo los JSON;
  - la pantalla "Página" del admin nuevo se muestra como "no disponible", sin formulario ni acciones de restaurar, con un aviso que explica que la edición sigue en el `/admin` actual, de modo que no parezca una avería ni que se perdieron datos;
  - los endpoints de lectura y escritura de la página no escriben nada y responden un error propio de "no disponible".

  Esta ventana dura desde el primer despliegue hasta el del PR 3 (D-9).
- **RF-5 Landings.** Reciben la página por `/api/v1/public`, sin credenciales de MySQL. Mismas reglas que los productos: frescura de 60 s, un vuelo por negocio, invalidación tras cada escritura, última copia buena y, sin copia, la semilla. Nunca responden 5xx por la API. HTML idéntico.
- **RF-6 Edición en `inventory-manager`.** Sección "Página" por negocio, con edición por formulario, "Último cambio", conflicto y "Restaurar versión anterior" con confirmación. Sin "restaurar semilla".
- **RF-7 Permisos.** El administrador opera en ambos negocios; el editor solo en los suyos. Otro negocio responde 403 sin cambios. El autor sale de la sesión.
- **RF-8 Historial.** Cada guardado y restauración registra fecha, autor con id, negocio, acción (`save`, `overwrite_after_conflict`, `restore_previous`) y campos con valor anterior y nuevo. `restore_seed` solo aparece en entradas importadas. No se muestra en pantalla. Las líneas ilegibles de `changes.jsonl` se cuentan y registran, y no detienen la importación.
- **RF-9 Fallos.** Con la API caída o un 503 se conserva lo escrito. Una escritura sin confirmar pide revisar antes de repetir, como en REQ-F-043. `meta.freshness` dice la verdad sobre si la landing ya lo muestra.
- **RF-10 Solo lectura.** Desde el PR 3, con `ADMIN_NEW_URL`, `/admin/<negocio>` muestra los valores vigentes de MySQL, nunca los del JSON. No tiene formularios de página, muestra aviso y enlace, y sus POST de guardar y restaurar pasan sesión, permiso y CSRF y responden 410 sin escribir. Sin esa variable, escribe en MySQL.
- **RF-11 Documentación.** `arquitectura.md` (§1, §6, §8, §10), `README.md` (incluida la edición manual de JSON, que deja de aplicar), `despliegue.md` (§6 y respaldos), `.env.example` si cambia y `.claude/CLAUDE.md` §8.

## Historias de usuario

- **HU-1.** Como administrador o editor, quiero cambiar el hero, el texto destacado y la promoción de mi negocio en el admin nuevo, para mantener la landing al día sin usar el `/admin` actual.
- **HU-2.** Como persona del equipo, quiero saber si otra persona guardó antes que yo y volver a la versión anterior, para no pisar ni perder cambios.
- **HU-3.** Como visitante, quiero ver la landing igual que siempre aunque la API falle, para poder pedir.
- **HU-4.** Como dueño del negocio, quiero que los datos reales lleguen a MySQL sin pérdida y poder volver atrás, para desplegar sin riesgo para el contenido.
- **HU-5.** Como persona del equipo, quiero entender por qué "Página" aún no se puede usar y dónde editar mientras tanto, para no creer que algo se rompió.

## Reglas de negocio

- **RN-1.** MySQL es la fuente de verdad de la página desde la importación.
- **RN-2.** Los JSON no se modifican ni se borran en este ticket.
- **RN-3.** Una sola versión anterior por negocio; restaurar intercambia vigente y anterior, y repetirlo lo deshace.
- **RN-4.** Una vez importado un negocio, los JSON no vuelven a importarse.
- **RN-5.** Las listas de productos de `seed.json` no cambian mientras exista el formato actual.

## Criterios de aceptación

- **CA-1:** Given JSON válidos de ambos negocios, When arranca la versión nueva, Then MySQL tiene vigente y anterior con los mismos valores, revisión, fecha y autor, y los archivos quedan intactos byte a byte.
- **CA-2:** Given una importación ya hecha y una edición posterior, When se reinicia la app, Then la importación no se repite ni pisa la edición.
- **CA-3:** Given un fallo a mitad de la importación, When termina el arranque, Then no queda nada parcial, la app nueva no sirve y el siguiente intento importa completo.
- **CA-4:** Given `current.json` dañado y `previous.json` válido, When se importa, Then queda vigente el `previous`, el archivo dañado se conserva y se registra sin contenido. Sin `previous` válido, se usa la semilla solo en una instalación nueva; en una existente aplica CA-20 (D-10).
- **CA-5:** Given una instalación sin JSON, When arranca, Then la semilla queda como vigente y anterior.
- **CA-6:** Given los mismos datos, When se compara `/`, `/molotes` y `/birria` antes y después, Then el HTML es idéntico, en 375 px y en escritorio.
- **CA-7:** Given una API que no responde y una copia buena en memoria, When llega una visita, Then responde 200 con esa copia. Sin copia, responde 200 con la semilla y lo registra.
- **CA-8:** Given un guardado confirmado, When la landing recibe el aviso, Then la siguiente visita muestra el cambio. Si el aviso falla, se ve en 60 s como máximo y la respuesta dice `pending`.
- **CA-9:** Given dos personas con la misma versión, When guarda la segunda, Then ve 409 con quién y cuándo, conserva lo escrito y puede "Guardar mis cambios de todos modos" o "Descartar".
- **CA-10:** Given un editor de Molotes, When lee o escribe en Birria, Then recibe 403 y nada cambia.
- **CA-11:** Given un precio inválido o un texto demasiado largo, When se guarda, Then no se escribe nada y un resumen enlaza a cada campo, sin depender solo del color.
- **CA-12:** Given una versión anterior, When se restaura y se confirma, Then vigente y anterior se intercambian, y repetirlo lo deshace. Sin versión anterior válida, responde 409 sin cambios.
- **CA-13:** Given `ADMIN_NEW_URL`, When se guarda o restaura por POST en `/admin/<negocio>`, Then responde 410 sin escribir, y el GET muestra lo vigente en MySQL.
- **CA-14:** Given JavaScript desactivado, teclado y 375 px, When se edita y se resuelve un conflicto, Then todo funciona, con foco visible y sin desplazamiento horizontal.
- **CA-15:** Given una vuelta atrás, When vuelve la versión anterior, Then sirve los JSON de antes de importar sin marcarlos dañados, y las ediciones siguen en MySQL.
- **CA-16:** Given un JSON editado durante esa vuelta atrás, When se avanza de nuevo, Then no se reimporta, MySQL no cambia y un log avisa de la diferencia.
- **CA-17:** Given un respaldo posterior a la importación, When se restaura, Then la página vuelve a lo guardado en el respaldo sin reimportar.
- **CA-18:** Given un usuario con permiso sobre el negocio y datos aún sin importar, When abre "Página" o envía una escritura o restauración, Then ve "no disponible" con un aviso que explica que la edición sigue en el `/admin` actual, sin formulario ni acciones, y nada se escribe.
- **CA-19:** Given datos aún sin importar, When alguien guarda en el `/admin` actual, Then la landing muestra el cambio como hoy y la importación del PR 3 lo lleva a MySQL como versión vigente.
- **CA-20:** Given una instalación existente (`product_import` con filas al empezar el arranque) y ni `current` ni `previous` utilizables para algún negocio, When arranca la versión nueva, Then no importa ningún negocio, no deja marca, no escribe la semilla en `DATA_DIR`, registra `page_import_failed` con el código `PAGE_IMPORT_SEED_REFUSED` y termina con 1, de modo que el despliegue vuelve atrás; repetir el arranque da el mismo resultado. Una instalación nueva sigue en CA-5.

## Casos límite

- **Ventana hasta el PR 3:** ver RF-4, CA-18 y CA-19. La API pública de página también responde "no disponible"; ninguna landing la lee todavía.
- **Dentro del despliegue del PR 3:** entre el arranque de la `api` nueva y el de la `app` nueva aún no hay datos en MySQL; aplica la misma regla.
- **`app` nueva con `api` anterior** (solo por vuelta atrás manual): la página cae a la semilla. `despliegue.md` §6 debe advertirlo.
- **Líneas ilegibles en `changes.jsonl`:** se cuentan y registran, y no detienen la importación.
- **Entradas antiguas del historial sin `authorId`:** se importan solo con el nombre.
- **Restauración de un respaldo anterior a la importación:** la marca está en MySQL, así que la importación se repite con los JSON restaurados.

## Dependencias

- **Secuencia de despliegue (D-7 y D-9):**
  1. PR 1 y PR 2 entran en `epic/arquitectura`.
  2. La épica llega a `main` y se despliega. Este primer despliegue publica también el bot en `api`.
  3. Se hacen las comprobaciones de producción de REQ-F-042 y REQ-F-043.
  4. Empieza el PR 3, que llega en un segundo despliegue.
- **REQ-F-042 y REQ-F-043:** sus comprobaciones de producción deben estar hechas antes de empezar el PR 3.
- **REQ-F-008:** Q-3 A (listas congeladas) y `seed.json`.
- **REQ-F-039 y REQ-F-043:** patrón de solo lectura con `ADMIN_NEW_URL`, cliente de `contracts` y manejo de 503 y 409.
- **Ticket 6:** no empieza hasta que el PR 3 esté en producción y la importación se haya ejecutado allí, porque retira el `/admin` y el acceso a `DATA_DIR` que la importación necesita.

## Riesgos

- **Pantalla "no disponible" en producción (aceptado, D-9):** las tablas y la pantalla "Página" existen sin datos hasta el PR 3, mientras `/admin` sigue siendo el escritor. Se mitiga con RF-4 y CA-18. Si hace falta, el aviso al personal del primer despliegue lo menciona.
- **Ventana sin fecha de cierre:** su duración depende de las comprobaciones de producción. No afecta a los visitantes.
- **Vuelta atrás:** una edición en MySQL no se ve tras volver a la versión anterior, y una edición en el JSON durante ese periodo no vuelve a MySQL (aceptado, D-3).
- **Semilla con la API caída (aceptado, D-4):** hoy el hero y la promo no dependen de la API. Tras el PR 3, un reinicio de `app` con la API caída mostrará la semilla: precio del hero $195 en Birria y $145 en Molotes, quizá desactualizados.
- **Primer corte de datos reales de la épica:** se reduce desplegando antes el bot y el control del bot (D-7).
- **Semilla sincronizada:** las listas de `seed.json` siguen sin poder cambiar mientras exista el formato actual.

## Action Plan

### Objetivo

Llevar la página a MySQL, editarla en el admin nuevo y servirla a las landings por la API.

### Alcance

Datos, contratos, endpoints, pantalla, importación, consumo en landings, solo lectura y documentación.

### Fuera de alcance

Ver la sección "Fuera de alcance" de este ticket.

### Cambios requeridos

- Modelo y migración aditiva para página, versión anterior, historial y marca de importación.
- Contratos y endpoints públicos y de administración de la página, con estado "no disponible".
- Aviso de frescura para la página.
- Pantalla "Página" en `inventory-manager`, incluido su estado "no disponible".
- Importación única desde `DATA_DIR`.
- Landings leyendo la página de la API.
- `/admin` en solo lectura con `ADMIN_NEW_URL` y escribiendo en MySQL sin ella.
- Documentación de RF-11.

### Reglas de negocio

RN-1 a RN-5.

### UX/UI

Sistema visual de `inventory-manager`; formularios sin JavaScript, accesibles y utilizables en 375 px y en escritorio. Las landings no cambian de aspecto.

### Integraciones

`api`, `inventory-manager`, `landing-pages` y MySQL. Sin servicios externos nuevos.

### Casos límite

Ver la sección "Casos límite" de este ticket.

### Criterios de aceptación

CA-1 a CA-19.

### Dependencias

Ver la sección "Dependencias" de este ticket.

### Riesgos

Ver la sección "Riesgos" de este ticket.

### Orden recomendado

Tres PR hacia `epic/arquitectura`:

1. **Datos y `api`:** modelo, migración aditiva, contratos, endpoints y aviso de frescura. Sin consumidores.
2. **Pantalla** en `inventory-manager`, con el estado "no disponible".
3. **Corte:** importación, landings por API, solo lectura y documentación. Va junto porque cambiar el lector sin importar dejaría semilla en producción. Empieza solo cuando se cumpla la secuencia de "Dependencias".

### Resultado esperado

Una sola fuente de verdad en MySQL y `/admin` sin nada propio que editar.

## Trazabilidad

| Objetivo | Requisito | Historia | Criterios | UI | Action Plan |
| --- | --- | --- | --- | --- | --- |
| Datos en MySQL sin pérdida | RF-1, RF-2, RF-3 | HU-4 | CA-1 a CA-5, CA-15 a CA-17 | Ninguna | PR 1 y PR 3 |
| Un solo escritor | RF-4, RF-10 | HU-4, HU-5 | CA-13, CA-18, CA-19 | "Página" no disponible; `/admin` | PR 2 y PR 3 |
| Landings sin cambios | RF-5 | HU-3 | CA-6, CA-7, CA-8 | Landings (`_stich_source_/`) | PR 3 |
| Edición en el admin nuevo | RF-6, RF-7, RF-9 | HU-1, HU-2 | CA-8 a CA-12, CA-14 | "Página" | PR 1 y PR 2 |
| Historial y autoría | RF-8 | HU-2, HU-4 | CA-1, CA-12 | Solo "Último cambio" | PR 1 y PR 3 |
| Documentación | RF-11 | — | Revisión del PR 3 | Ninguna | PR 3 |

RF-8 y RF-11 no tienen un criterio propio dedicado: los comprueba la revisión técnica y QA.

## Revisión técnica

Rama base `epic/arquitectura` (`421f4e6`). Revisión hecha con CodeGraph; `deploy/`, `ops/`, Prisma y Markdown, con lecturas dirigidas. NotebookLM no estaba disponible en esta sesión: no se consultó. No se ejecutó nada en producción: lo que depende de los datos reales queda como comprobación previa al PR 3.

### Inferencias del ticket, resueltas

1. **Quién importa: confirmado, la `app` nueva al arrancar.** En `deploy.sh` el paso 7 es `compose up -d --no-deps app`, que para el contenedor anterior (`stop_grace_period: 15s`) antes de crear el nuevo: al leer los JSON, el único escritor anterior ya terminó. Con `api` nueva y datos sin importar, nadie más puede escribir la página (punto 4). `migrate` no serviría: no tiene volumen y la `app` anterior seguiría escribiendo después.
2. **Marca y atomicidad.** Marca `page_import` en MySQL y **una sola transacción para los dos negocios**, con versiones, historial y marcas. Si fueran dos transacciones y fallara el segundo negocio, habría vuelta atrás con el primero ya marcado: sus ediciones en el `/admin` anterior nunca volverían a importarse. RF-2 ("una vez por negocio") se cumple: la marca sigue siendo por negocio.
   - `changes.jsonl` se lee línea a línea y se reparte por su campo `business`. Se inserta por lotes de 500 con `createMany` dentro de la misma transacción interactiva (`timeout` de 60 s).
   - Línea ilegible: JSON roto, línea final cortada, negocio o acción desconocidos, autor vacío o de más de 60 caracteres, `at` no válido o texto mal formado. Se cuenta y se omite, y el log solo lleva el número de línea, nunca el contenido.
   - Sin `authorId`: se guarda `NULL`. `page_change.author_id` **no lleva clave foránea**: un id histórico sin usuario no debe impedir la importación.
   - Un error de lectura del archivo (`EACCES`, `EIO`) sí es fallo de importación; un archivo ausente es historial vacío.
3. **CA-3: viable, y encaja con la vuelta atrás.** Si la transacción falla, MySQL deja todo sin aplicar y `server.ts` termina con 1 antes de `listen`, con `page_import_failed` (solo códigos). `restart: unless-stopped` lo reinicia, `wait_healthy` ve `RestartCount > 0` y devuelve 1 sin esperar, y `deploy.sh` vuelve a los digests anteriores con `DATABASE_ALLOW_NEWER_SCHEMA=true` y termina con 21. El PR 3 no lleva migración, así que esa bandera no cambia nada aquí. El siguiente despliegue importa completo. Un JSON dañado no es fallo (D-2); un fallo de MySQL o de lectura de `DATA_DIR`, sí.
4. **Ventana y hallazgo de seguridad.** `api` lee MySQL en cada petición (sin caché propia) y responde 503 `PAGE_UNAVAILABLE` si no hay filas. Eso no basta. **Si el PR 3 importa y después hay vuelta atrás, las imágenes del PR 2 encontrarían filas y activarían la edición, con la `app` anterior leyendo y escribiendo los JSON: dos escritores, y ediciones que la landing no muestra.** Por eso `api` tiene además una constante de compilación, `PAGE_CUTOVER = false`, en PR 1 y PR 2 (responde "no disponible" aunque haya filas), y el PR 3 la elimina. Va en la imagen y no en una variable de entorno: así vuelve sola con la vuelta atrás y no toca `deploy/`.
5. **CA-15: confirmado.** La importación solo lee. La versión anterior valida los mismos archivos con el mismo esquema, sin marcador nuevo. Excepción heredada: `repository.init()` sigue aislando un `current.json` dañado y escribe la semilla si no hay archivos. Es lo que la versión anterior ya hizo en cada arranque; con JSON válidos no cambia ningún byte.
6. **Respaldos: sin cambios en los scripts.** `restaurante_backup` tiene `SELECT` sobre `restaurante.*`, y `restaurante_app`, DML sobre las tablas nuevas. `backup.sh` exige `molotes/` y `birria/` en `app-data` y `verify-backup.sh`, un `.json` en cada una: los archivos siguen ahí hasta el ticket 6. `restore.sh` hace `DROP DATABASE` y carga el volcado, así que la marca vuelve con él (CA-17 y el caso de un respaldo anterior). Como `api` no guarda caché de página, ve lo restaurado sin reiniciarse.
7. **Frescura: se reutiliza `/internal/v1/productos-cambiados`.** El aviso ya significa "cambió este negocio" y solo lleva `{ business }`. La `app` invalida los dos recursos y `landing` confirma si los dos quedaron al día. Sin ruta, token ni variable nuevos, y con versiones mezcladas no hay caso roto: una `app` anterior solo invalida productos, que es correcto porque no lee la página de la API. El notifier conserva su reparto por negocio. Coste: una lectura extra por escritura.
8. **Contratos y caché.** Se añade `GET /api/v1/public/:negocio/pagina`. La caché se generaliza: `landing-cache.ts` contiene TTL, un vuelo, última copia buena y semilla, y `landing-products.ts` y `landing-page.ts` son envoltorios finos que conservan los nombres de sus logs. La semilla solo entra si no hay copia buena, y nunca se marca como fresca ni se escribe en la API. Un fallo, incluido `PAGE_UNAVAILABLE`, nunca sustituye una copia buena.
9. **Migración aditiva:** tres tablas nuevas, sin tocar las existentes (Modelo de datos, abajo). La versión anterior las tolera. `verifyDatabase` revisa la colación de todas las tablas, así que un `CREATE TABLE` sin corregir rompería el arranque; `migrations-collation.test.ts` lo cubre.
10. **Lint.** `menu-schema` ya es puro y `core/catalog` ya se permite con lista de exclusión. Se excluyen del código de landings `createPageRepository`, `PageRepository`, `PageStore`, `PageStoreTx` y `createMemoryPageStore`, y se añade `services/landing-page.ts` y `services/landing-cache.ts` a `LANDING_CODE_FILES`. También se prohíbe en esas rutas `repositories/*menu-repository`. `dependency-rule.test.ts` lo comprueba. El código temporal hasta el ticket 6 son solo el importador, el repositorio de archivos y `/admin`, fuera de esas rutas.

Otras inferencias:

- **Lectura del formulario:** `api` no importa `landing-pages`. El análisis puro de `admin-form.ts` pasa a `core/catalog/page-form.ts`, y `landing-pages` lo reutiliza. `inventory-manager` no puede importar `core`, así que envía los campos planos como texto y la API responde 422 con `fields`, igual que en productos.
- **Bases de prueba:** `database-admin.ts` descubre las tablas, así que las nuevas se vacían solas.

### Protección de la semilla (D-10, PR 3)

**Instalación existente:** `product_import` tiene alguna fila. Se lee **antes** de `products.init()`: en una instalación nueva, ese mismo arranque crea esas filas.

**Comportamiento exacto**, para cualquier negocio sin marca cuyo origen sea la semilla en una instalación existente:

1. No se abre la transacción: no se importa ningún negocio, tampoco el que tenga datos válidos, y no queda marca.
2. `page_import_failed` con `code: PAGE_IMPORT_SEED_REFUSED`, el negocio y el motivo (`missing` o `damaged`), sin contenido, y mensaje claro en stderr.
3. Salida con 1 antes de `listen`: `deploy.sh` vuelve a la versión anterior y termina con 21. Visitantes y personal siguen como estaban.

**Hallazgo: `repository.init()` burlaría la protección.** Hoy escribe la semilla en `current.json` y `previous.json` si faltan, y además corre antes que la base. Con el volumen vacío, el primer arranque se negaría, pero dejaría esos archivos; Docker reinicia el contenedor y el segundo arranque vería un `current.json` válido e importaría la semilla como dato real. Por eso, en el PR 3, `server.ts` verifica la base y lee `product_import` antes de `repository.init()`, que recibe `seedMissing: false` en una instalación existente: no escribe y deja el origen como semilla por falta de archivos. CA-20 lo prueba con dos arranques seguidos.

Un `current.json` copia de la semilla (`updatedAt: null`) **no** se rechaza: es lo legítimo en un negocio cuya página nunca se editó, y su origen es `current`.

**Conflicto con RF-3, CA-4 y D-2 ("Seguir con lo publicado"), y cómo se resuelve.** Ahora hay dos causas para el origen semilla en una instalación existente:

- **Faltan los JSON:** es el riesgo que motivó la protección. Se niega, sin matices.
- **`current` dañado y `previous` también inservible:** la landing anterior publica de verdad la semilla. Es lo que RF-3 y CA-4 mandaban importar.

Se aplica la protección a los dos, por tres motivos: es lo que el usuario aprobó, sin distinguir causa; es posterior y más concreta que D-2; y publicar la semilla como dato real en una instalación con historial es justo "publicar semilla en silencio".

**Sí contradice en parte D-2.** D-2 dice "No se detiene el despliegue", y en este caso se detiene. No contradice su intención: nada se pierde, los archivos se conservan y, al volver atrás, la landing sigue publicando lo mismo que antes. Se limita a ese caso: `current` dañado con `previous` válido sigue sin detener nada. Por eso RF-3 y CA-4 llevan una precisión y no se reescriben; la sesión principal debe mencionárselo al usuario.

**Salida para el operador, sin herramientas nuevas:** restaurar los JSON desde un respaldo o, en el `/admin` anterior, usar "restaurar semilla" (solo disponible con datos dañados), que deja una elección explícita con autor en `current.json`. El siguiente despliegue importa ese `current`.

**Instalación nueva (CA-5):** sin filas en `product_import`, la semilla se importa con un `warn` (`page_import_from_seed`), para que tampoco sea silenciosa en producción.

### Revisión de CA-18, CA-19 y la ampliación de RF-4

No van más allá de lo aprobado: concretan la ventana que el usuario aceptó en D-9. Una matización: tal como están escritos, cubren "datos aún sin importar". Tras una vuelta atrás del PR 3 hay datos importados y la imagen del PR 2 debe seguir en "no disponible". Lo pide la frase de RF-4 "en ningún momento hay dos escritores"; el plan lo cumple con `PAGE_CUTOVER` y lo prueba, sin cambiar el requisito.

### Puntos aprobados en D-10

- **RF-2 con dos negocios:** la importación es todo o nada para los dos a la vez, no para cada uno (punto 2).
- **`/admin` sin `ADMIN_NEW_URL` (D-6):** en MySQL no existe el estado "dañado", así que su aviso desaparece y "restaurar semilla" responde con el mensaje actual de "no permitido".
- **Escrituras sin confirmar (RF-9):** guardar y restaurar exigen `expectedVersion`. Sin ella, repetir una restauración que llegó a aplicarse la desharía sin avisar; con ella, responde 409. Por eso la página no necesita `Idempotency-Key`.
- **Sin requisitos inviables.** El riesgo mayor (dos escritores tras una vuelta atrás) queda resuelto con `PAGE_CUTOVER`. La importación de la semilla con el volumen vacío se resuelve con la protección de D-10.

## Technical Action Plan

### Objetivo técnico

Llevar la página a MySQL con un único repositorio en `core`, exponerla por `api`, editarla en `inventory-manager` y cortar en el PR 3 con una importación atómica que no toca los JSON.

### Archivos o componentes afectados

| Capa | Archivos | PR |
| --- | --- | --- |
| `core` | `catalog/page-repository.ts`, `page-store.ts`, `memory-page-store.ts`, `page-form.ts` (nuevos); `catalog/index.ts`; recibe `versionOf`, `CHANGE_ACTIONS` y errores desde `menu-repository.ts` | 1 |
| `core` | `catalog/page-import.ts`: decide y analiza líneas, sin E/S | 3 |
| `db` | `prisma/schema.prisma`, migración `<fecha>_pagina`, `src/prisma-page-store.ts`, `package.json` (export) | 1 |
| `contracts` | `page.ts` (nuevo), `admin.ts`, `admin-client.ts`, `public-client.ts`, `index.ts` | 1 |
| `api` | `src/page-cutover.ts`, `src/admin/page-routes.ts` (nuevos); `src/admin/index.ts`, `router.ts`, `src/app.ts`, `src/server.ts` | 1 |
| `api` | Se elimina `src/page-cutover.ts` | 3 |
| `inventory-manager` | `src/controllers/page.ts`, `src/views/page.ts`, `views/pages/*`, `views/partials/*` (nuevos); `src/routes.ts`, `src/app.ts`, `src/views/index.ts` (`HeaderSection` y navegación) | 2 |
| `landing-pages` | `src/services/admin-form.ts` (delega en `core`, sin cambio visible) | 1 |
| `landing-pages` | `src/services/landing-cache.ts`, `landing-page.ts`, `page-import.ts` (nuevos); `landing-products.ts`, `src/server.ts`, `src/app.ts`, `src/internal-app.ts`, `src/controllers/landing.ts`, `admin.ts`, `admin-business-view.ts`, `src/routes/admin.ts`, `src/views/admin/index.ts`, `src/repositories/menu-repository.ts` (`getImportSource`) | 3 |
| Raíz | `eslint.config.ts`, `landing-pages/tests/unit/dependency-rule.test.ts` | 3 |
| `deploy/` | **Sin cambios:** la suma de comprobación no cambia. No hay variables, volúmenes ni pasos nuevos | — |
| `ops/` | Solo `ops/backup/ci/smoke.sh`, con una comprobación para CA-17. Los scripts del VPS no cambian | 3 |

### Modelo de datos

Migración aditiva en el PR 1, revisada a mano a `utf8mb4_es_0900_as_cs`. `Business` es el enum existente.

- **`page_version`** (`PageVersion`), PK `(business, slot)`: `slot` ENUM `current|previous`; `revision` INT; `updated_at` `VARCHAR(64)` NULL; `updated_by` `VARCHAR(60)` NULL; `updated_by_id` INT NULL, sin clave foránea; `data` `MEDIUMTEXT` con el JSON de `PageData`.
- **`page_change`** (`PageChange`), PK `id` autoincremental, índice `(business, id)`: `at` `VARCHAR(64)` NULL; `author` `VARCHAR(60)`; `author_id` INT NULL, sin clave foránea; `action` `VARCHAR(32)`; `changes` `MEDIUMTEXT` con `[{ field, before, after }]`; `imported` BOOLEAN.
- **`page_import`** (`PageImport`), PK `business`: `imported_at` DATETIME(3); `source` `VARCHAR(16)`; `source_version` `VARCHAR(96)`; `history_count` y `skipped_lines` INT.

`updated_at` y `at` son texto a propósito: conservan la fecha con su desplazamiento y `revision@updatedAt` sigue siendo idéntica (CA-1). `previous` puede no existir (CA-12). Antes de escribir se comprueban longitud de fecha, `revision` en rango INT y texto bien formado: un documento que no cumple se trata como inválido y un JSON no puede abortar la importación (D-2).

### Backend: endpoints

Todos usan el error centralizado `{ error: { code, message } }`. `:negocio` desconocido responde 404 y las rutas admin siguen `sesión 401 -> permiso 403 -> CSRF 403 -> disponibilidad 503 -> cuerpo`.

| Método y ruta | Éxito | Errores |
| --- | --- | --- |
| `GET /api/v1/public/:negocio/pagina` | 200 `{ data: PageData }` | 404 `BUSINESS_NOT_FOUND`, 405, 503 `PAGE_UNAVAILABLE`, 503 base de datos |
| `GET /api/v1/admin/:negocio/pagina` | 200 `{ page: { version, updatedAt, updatedBy, hasPrevious, values }, fields }` | 401, 403, 404, 503 `PAGE_UNAVAILABLE`, 503 base de datos |
| `PUT /api/v1/admin/:negocio/pagina` | 200 `{ page, meta: { freshness } }` | 401, 403, 404, 409 `PAGE_CONFLICT` con `currentPage: { version, updatedAt, updatedBy }`, 422 `VALIDATION_FAILED` con `fields`, 503 |
| `POST /api/v1/admin/:negocio/pagina/restaurar` | 200 `{ page, meta: { freshness } }` | 401, 403, 404, 409 `PAGE_CONFLICT`, 409 `PAGE_NO_PREVIOUS`, 503 |

- Cuerpo de `PUT`: `{ expectedVersion, overwrite, fields: Record<string, string> }`, cerrado y con límite de 64 KiB. `overwrite: true` registra `overwrite_after_conflict`. Cuerpo de restaurar: `{ expectedVersion }`.
- Autor: siempre de la sesión. El editor solo opera en sus negocios (RF-7).
- `freshness`: `confirmed` solo si el aviso confirma; si no, `pending`.
- Una fila que no cumple el esquema responde 503 `PAGE_UNAVAILABLE` y registra `page_data_invalid`, sin contenido.
- Cada escritura guarda versión e historial en la misma transacción, con `updateMany` condicionado a `revision` y `updated_at`: si no afecta a ninguna fila, es conflicto.

### Backend: importación (PR 3)

En `landing-pages/src/server.ts`, antes de `warmUp` y `listen`:

0. Tras `verifyDatabase`, y antes de `repository.init()` y `products.init()`, lee si `product_import` tiene filas (`existing`) y llama a `repository.init({ seedMissing: !existing })`.
1. `repository.getImportSource(negocio)` devuelve `{ source, current, previous }`, sin escribir. `current` válido y `previous` válido, se importan los dos. `previous` como vigente: `previous` queda vacío. Semilla de primera ejecución: vigente y anterior. Semilla por daño: `previous` vacío.
2. Sin marca: una transacción para los negocios sin marca, con versiones, historial y marcas. Registra `page_import_done` con `source` y contadores. Si el origen es la semilla, aplica la protección de D-10 (sección propia) antes de abrir la transacción.
3. Con marca: no escribe. Si `versionOf` del JSON difiere de `source_version`, registra `page_json_diverged`, sin contenido (CA-16).
4. Si falla: `page_import_failed` con códigos y salida con 1 antes de `listen`.

### Frontend

- `inventory-manager`, sin diseño en `_stich_source_/`: P-4 de REQ-F-039 y patrón de productos. Sección "Página" en la navegación del negocio.
- Rutas: `GET /:business/pagina`, `POST /:business/pagina`, `GET|POST /:business/pagina/restaurar`, con confirmación sin JavaScript y Post/Redirect/Get.
- Campos en `fieldset`, con el descriptor de la API y sus límites. Resumen de errores enlazado y texto en cada campo (CA-11).
- 409: conserva lo escrito, muestra quién y cuándo, y ofrece "Guardar mis cambios de todos modos" y "Descartar" (CA-9).
- Timeout o error de red en una escritura: conserva lo escrito y pide revisar antes de repetir, sin afirmar nada sobre el resultado. `pending`: aviso de hasta 60 s.
- "No disponible" (`PAGE_UNAVAILABLE`): GET responde 200 y POST 409, con `role="status"`, sin formulario ni acciones. Texto: "La edición de esta pantalla aún no está activa. Por ahora, los cambios de la página se hacen en el `/admin` actual. Los datos no se han perdido." con enlace.
- `/admin` (PR 3): con `ADMIN_NEW_URL`, solo lectura desde MySQL, aviso, enlace y 410 tras sesión, permiso y CSRF; sin ella, escribe en MySQL e invalida la caché en proceso. "Último cambio" sale de la fila vigente.
- Landings: mismo render con `mergePageData(semilla, página)` más `withProducts`; el HTML no cambia.

### Contenido / configuración

Sin variables nuevas: `.env.example` y `deploy/env.production.example` no cambian. `seed.json` no se toca (RN-5).

### Validaciones

`getPageSchema` y `validatePageData` siguen siendo la única regla, con los mismos mensajes que `/admin`. `contracts` valida la forma con Zod y `contract-types.test.ts` impide que se separe de `PageDataByBusiness`.

### Manejo de errores

- 503 de `api` sin datos internos; `DatabaseUnavailableError` como en productos.
- La landing nunca responde 5xx por la API.
- Logs sin el contenido de la página, los valores del historial ni las líneas ilegibles.

### Testing

Cada archivo apunta a ~10 s en local; se parte por `describe` si se acerca.

| PR | Archivo | Cubre |
| --- | --- | --- |
| 1 | `api/tests/unit/page-repository.test.ts` (nuevo) | Conflicto, intercambio y deshacer, sin anterior, acciones, autor (CA-9, CA-12, RF-8) |
| 1 | `api/tests/unit/page-form.test.ts` (nuevo) | Precios, largos, estructura manipulada (CA-11) |
| 1 | `api/tests/integration/prisma-page-store.test.ts` (nuevo) | MySQL real: transacción, condición de versión, acentos, longitudes |
| 1 | `api/tests/integration/admin-page-read.test.ts`, `admin-page-write.test.ts` (nuevos) | Códigos, CSRF, 403 (CA-10), 409 y 422, `freshness`, `expectedVersion` al restaurar |
| 1 | `api/tests/integration/page-unavailable.test.ts` (nuevo) | Sin filas y con `PAGE_CUTOVER` falso **con filas**: nada escribe (RF-4) |
| 1 | `api/tests/integration/public-page-endpoint.test.ts` (nuevo) | 200, 404, 405, 503 |
| 1 | `api/tests/unit/contract-types.test.ts`, `inventory-manager/tests/unit/admin-client.test.ts` | Contratos y cliente |
| 1 | `landing-pages/tests/unit/admin-form.test.ts`, `migrations-collation.test.ts` (sin cambios) | Regresión y colación |
| 2 | `inventory-manager/tests/support/api-double-page.ts` y `page-browser.ts` (nuevos) | Doble y preparación común |
| 2 | `inventory-manager/tests/integration/page-unavailable.test.ts` (nuevo) | CA-18 y permisos |
| 2 | `page-edit.test.ts`, `page-conflict.test.ts`, `page-failures.test.ts` (nuevos) | CA-9, CA-11, CA-12, CA-14 (sin JavaScript) y RF-9 |
| 3 | `landing-pages/tests/unit/page-import-source.test.ts` (nuevo) | Reglas de origen, líneas ilegibles, sin `authorId`, guardas (CA-4, CA-5) |
| 3 | `landing-pages/tests/integration/page-import.test.ts` (nuevo) | MySQL real: CA-1, CA-2, CA-5, CA-19; bytes intactos |
| 3 | `landing-pages/tests/integration/page-import-failure.test.ts` (nuevo) | Fallo a mitad, en el segundo negocio y reintento (CA-3); CA-4 |
| 3 | `landing-pages/tests/integration/page-import-rollback.test.ts` (nuevo) | CA-15, CA-16 y CA-17 (a nivel de base) |
| 3 | `landing-pages/tests/integration/server-startup-page-import.test.ts` (nuevo) | Proceso real: fallo termina con 1, sin escuchar; ~10 s en local |
| 3 | `landing-pages/tests/integration/page-import-seed-guard.test.ts` (nuevo) | CA-20: faltan los JSON, dos dañados, dos arranques seguidos, nada escrito, sin marca, otro negocio sin importar; `current` copia de la semilla sí se importa; instalación nueva (CA-5) |
| 3 | `landing-pages/tests/unit/landing-page.test.ts` y `landing-products.test.ts` | Caché común: copia buena, semilla, un vuelo, que la semilla no pise (CA-7) |
| 3 | `landing-pages/tests/integration/landing-page-api.test.ts`, `landing-html-reference.test.ts` | CA-6 y CA-8 |
| 3 | `landing-pages/tests/unit/internal-app.test.ts`, `tests/integration/internal-notify-process.test.ts` | El aviso invalida los dos recursos; versiones mezcladas |
| 3 | `landing-pages/tests/integration/admin-page-moved.test.ts` (nuevo), `admin-guardar.test.ts`, `admin-csrf.test.ts` | CA-13 y D-6 |
| 3 | `landing-pages/tests/unit/dependency-rule.test.ts` | Lint de landings |
| 3 | `ops/backup/ci/smoke.sh` | CA-17 con una restauración real |

CA-6 y CA-14 en 375 px y escritorio se comprueban además en navegador real en QA.

### Seguridad

- La landing no gana acceso nuevo a la base; el importador corre en el arranque, no por HTTP.
- Sin lectura admin sin sesión; el endpoint público solo devuelve lo que ya es público, y solo en la red interna.
- La salida se escapa con `{{ }}`. CSP sin cambios. Cuerpos cerrados y limitados.

### Performance

- `api` hace una lectura por clave primaria cuando vence la caché de la landing: unas dos por minuto, más los avisos.
- Las visitas no añaden E/S con la caché fresca.
- La importación es única. Comprobación previa: medir el tamaño de `changes.jsonl`. Debe tardar mucho menos que el `start_period` de 90 s.

### Riesgos técnicos

- **Volumen vacío o datos irrecuperables:** la protección de D-10 detiene el despliegue del PR 3 y vuelve atrás. La `app` anterior, por su comportamiento actual, escribiría la semilla en un volumen vacío: `despliegue.md` debe indicar restaurar `app-data` antes de reintentar.
- **Ediciones en `/admin` durante una vuelta atrás:** no vuelven a MySQL (aceptado, D-3). `despliegue.md` indica pasarlas a mano antes de avanzar, guiándose por `page_json_diverged`.
- **Tres fallos encadenados:** con filas importadas, una `api` nueva junto a un `inventory-manager` del PR 2 (paso 6 fallido tras una vuelta atrás previa) permitiría editar con la `app` anterior. No se añade código: exige dos despliegues fallidos seguidos, y `despliegue.md` lo advierte.
- **`app` nueva con `api` anterior:** el flujo automático no lo produce, porque la `app` cambia última y vuelve primero. Solo a mano: cae a la semilla; `despliegue.md` §6 lo advierte.
- **Cambio de `landing-products.ts`:** lo protegen sus pruebas actuales, que no deben cambiar de expectativa.
- **Cambios amplios en el soporte de pruebas del PR 3:** `setupAdmin` pasa a un store de página en memoria.

### Orden de implementación

**PR 1, datos y `api`:** migración, `core`, `db`, `contracts`, endpoints con `PAGE_CUTOVER = false`, reutilización del formulario. Sin consumidores: nadie ve nada. Documentación: una línea de avance en `arquitectura.md` §8.

**PR 2, pantalla:** sección "Página" en `inventory-manager`. En producción solo muestra "no disponible"; el resto queda probado contra el doble. Es lo único que cambia para el personal.

Después, secuencia D-7 y D-9: la épica llega a `main`, se despliega y se hacen las comprobaciones de REQ-F-042 y REQ-F-043.

**PR 3, corte, en su propio despliegue:** importación, caché y consumo de landings, aviso común, solo lectura, retirada de `PAGE_CUTOVER`, lint y toda la documentación: `arquitectura.md` (§1, §6, §8, §10), `README.md` (incluida la edición manual de JSON, que deja de aplicar), `desarrollo.md`, `despliegue.md` (§6, respaldos, comprobaciones previas y posteriores) y `.claude/CLAUDE.md` §8.

Comprobaciones antes del despliegue del PR 3: tamaño de `changes.jsonl`, y que `app-data` contiene `current.json` de los dos negocios. Después: `page_import` tiene dos filas con el `source` esperado, y `/`, `/molotes` y `/birria` no cambian.

### Cobertura de criterios

| Parte | Criterios |
| --- | --- |
| PR 1 | CA-9 a CA-12 en la API; RF-1, RF-4, RF-7, RF-8 |
| PR 2 | CA-9, CA-11, CA-12, CA-14, CA-18; RF-6, RF-9 |
| PR 3 | CA-1 a CA-8, CA-13, CA-15 a CA-17, CA-19, CA-20; RF-2, RF-3, RF-5, RF-10, RF-11 |

### Criterios de finalización

- Cada PR con `build:css`, `typecheck`, `lint` y `npm test` en verde, y CI `calidad`, `docker` y `auditoria` en verde hacia `epic/arquitectura`.
- Ningún archivo de prueba por encima de 20 s en el CI.
- PR 1 y PR 2 sin cambios para visitantes y sin cambios para el personal, salvo la pantalla "no disponible".
- CA-1 a CA-20 comprobados, con la evidencia en `## Implementation Result`.
- `deploy/` sin cambios en sus archivos con suma.
- Tras el PR 3 en producción, importación verificada: requisito para empezar el ticket 6.

## Implementation Result

Solo PR 1 (datos y `api`). Sin commit, push ni PR.

### Rama

`feature/REQ-F-044-pagina-en-mysql-1-api`, desde `epic/arquitectura` (`421f4e6`).

### Cambios realizados

- **Migración `20261105200300_pagina`:** `page_version`, `page_change` y `page_import`, aditiva y corregida a mano a `utf8mb4_es_0900_as_cs`.
- **`core/catalog`:** `page-store.ts`, `page-repository.ts`, `memory-page-store.ts` y `page-form.ts`. El análisis del formulario pasa de `landing-pages` a `core`, sin cambio de comportamiento; `versionOf` y las acciones, también.
- **`db`:** `prisma-page-store.ts`, con `UPDATE` condicionado a la versión.
- **`contracts`:** `page.ts`, rutas, `getPage`, `savePage` y `restorePage` en el cliente admin, y `getPage` en el público, sin consumidores.
- **`api`:** `GET /api/v1/public/:negocio/pagina`, `GET` y `PUT /api/v1/admin/:negocio/pagina`, `POST .../pagina/restaurar`, y `page-cutover.ts` con `PAGE_CUTOVER = false`.
- **Documentación:** una fila en `docs/arquitectura.md` §8.

### Criterios de aceptación

Comprobados en la API, sin pantalla: CA-8 (`freshness`), CA-9, CA-10, CA-11 y CA-12, y RF-1, RF-4, RF-7 y RF-8 en escrituras. CA-18, solo su parte de API. El resto corresponde a PR 2 y PR 3.

### Validaciones ejecutadas

- `npm run build:css`: correcto.
- `npm run typecheck`: 0 errores.
- `npm run lint`: 0 errores y 0 avisos.
- `npm test`: 216 archivos y 2.900 pruebas en verde (`api` 46 y 1.119; `landing-pages` 159 y 1.594, con un fallo esperado que ya existía; `inventory-manager` 11 y 187).
- `prisma migrate diff --exit-code`, el comando del CI: sin diferencias.
- Archivos nuevos en local: todos por debajo de 3 s.
- Mutaciones: 16 de 16 detectadas. "Restaurar sin CSRF" sobrevivió al principio: se agregó la prueba y ahora se detecta.
- Limpieza comprobada: un solo `git worktree`, sin procesos de prueba ni puertos ocupados por Node y sin bases `restaurante_test*`. Temporales de la sesión borrados.

### Archivos afectados

Ver `git status`. `deploy/` y `ops/` sin cambios. La migración se aplicó solo al MySQL local.

### Riesgos o pendientes

- **Desviaciones del plan:** la prueba del store con MySQL está en `landing-pages/tests/integration/prisma-page-store.test.ts`, porque `api/tests` no usa MySQL. Se agregó `landing-pages/tests/integration/api-page-process.test.ts` con el proceso real, en archivo propio porque `api-process.test.ts` tarda ~11 s en local y el CI casi lo duplica. `menu-repository.ts` conserva sus errores; los de la página son clases nuevas.
- **CA-20 es del PR 3:** queda en el plan, sin código aún. Incluye que `repository.init()` no escriba la semilla en una instalación existente.
- **Sin navegador:** no aplica en este PR, porque no hay pantalla.

## QA Action Plan

Alcance: **solo el PR 1** (migración, `core`, `db`, `contracts`, endpoints de `api`). Sin pantalla ni navegador. La importación, CA-20 y las landings son del PR 3; la pantalla, del PR 2.

### Objetivo

Comprobar de forma independiente que el PR 1 no cambia nada para nadie mientras `PAGE_CUTOVER = false`, que la migración es aditiva y segura frente a la versión anterior, y que la lógica oculta detrás de la puerta es correcta, sin que quede en el repositorio ninguna forma de abrir la puerta en producción.

### Requisito bajo prueba

RF-1, RF-4, RF-7, RF-8 (escrituras), D-9 y D-10 (`expectedVersion` obligatoria; sin `restore_seed` en la API), CA-8 (solo `freshness`), CA-9 a CA-12 y CA-18, en su parte de API.

### Criterios de aceptación

| Criterio (parte de API) | Casos |
| --- | --- |
| RF-4 y CA-18 | P-01 a P-07 |
| RF-1 | M-01 a M-07 |
| CA-8 | L-07, L-08 |
| CA-9 | L-03, L-04, L-09 |
| CA-10 y RF-7 | L-05 |
| CA-11 | L-06, C-01 a C-05 |
| CA-12 y D-10 | L-02 |
| RF-8 | L-01, L-02, L-10 |

CA-9 ("conserva lo escrito") y CA-11 ("resumen que enlaza") en pantalla son del PR 2.

### Riesgos identificados

- **La puerta oculta la lógica:** las pruebas de `api` usan el store en memoria y las de `db` no pasan por HTTP. Ninguna prueba recorre ruta, repositorio, Prisma y MySQL de una vez, y `api-page-process.test.ts` solo toca el endpoint público del proceso real.
- **Refactor con consumidor vivo, no previsto por el plan como riesgo:** `public-client.ts` pasa `getProducts` a una función común, y las landings lo usan hoy en producción.
- **`admin-form.ts`, `CHANGE_ACTIONS` y `versionOf`** se mueven a `core`, y `/admin` escribe los JSON de producción.
- **`verify.ts` revisa la colación de todas las tablas:** una columna mal colada impediría arrancar también a la versión anterior.
- **Rutas compartidas:** `PRODUCTS_PATH` pasó a `PUBLIC_PATH`, y el router admin suma `/:business/pagina`.

### Hipótesis por confirmar

Salen de leer el código. No son defectos hasta tener evidencia:

- **H-1:** dentro de `fields`, `_csrf`, `action` y `expectedVersion` se ignoran en silencio, porque `FORM_META_FIELDS` se comparte con `/admin`. El plan técnico pide cuerpos cerrados (C-03).
- **H-2:** `prisma-page-store.ts` no reintenta ante interbloqueo (1213/P2034), y los otros stores sí. Debe verse si la carrera real produce un 503 evitable (L-09).
- **H-3:** un `displayName` que supere `VARCHAR(60)` haría fallar el guardado con 503 engañoso; hay que comparar el límite de usuarios con la columna (L-10).
- **H-4:** los 413 y 400 de `readJsonBody` no están en la tabla de errores del plan técnico (C-04).
- **H-5:** `publicPageSchemas` puede rechazar algo que `validatePageData` acepta, lo que daría un 500 con datos válidos (C-01).
- **H-6:** el ticket afirma "16 de 16 mutaciones", pero no lista cuáles. Solo se nombra "Restaurar sin CSRF".

### Pruebas funcionales

**Puerta cerrada (RF-4, CA-18)**

- **P-01** Matriz de orden sobre el **proceso real** de `api/src/server.ts` con MySQL y filas en `page_version`, con login real, en `GET`, `PUT` y `restaurar`: sin sesión 401; negocio desconocido 404; editor en otro negocio 403; sin CSRF y CSRF incorrecto 403 (en `PUT` y en `restaurar`); válido 503 `PAGE_UNAVAILABLE`. Se repite sin filas.
- **P-02** Con la puerta cerrada, un cuerpo inválido, JSON roto o de 1 MiB sigue respondiendo 503, sin cortar la conexión ni leer el cuerpo.
- **P-03** Público: `GET` y `HEAD` 503, `POST` 405, negocio desconocido 404.
- **P-04** Tras P-01 a P-03, `page_version`, `page_change` y `page_import` quedan idénticas (volcado antes y después) y no sale ningún aviso a la landing.
- **P-05** La constante no se activa por entorno: proceso real con `PAGE_CUTOVER=true`, `PAGE_CUTOVER=1`, `API_PAGE_CUTOVER=true`, `CUTOVER=true` y `NODE_ENV=test`. Todos 503.
- **P-06** Inspección estática: `page-cutover.ts` no usa `process.env` ni configuración, `server.ts` no pasa `cutover` ni propaga opciones externas, y no hay referencias en `config.ts`, `deploy/`, `.github/` ni `compose.yaml`. `cutover` solo aparece en pruebas. Es complemento de P-05, no evidencia única.
- **P-07** Con la base caída, la puerta cerrada no toca MySQL en las peticiones: sigue en `PAGE_UNAVAILABLE`.

**Lógica detrás de la puerta (cadena completa, sonda S-2)**

Ruta real, repositorio real, store de Prisma y MySQL de pruebas, abriendo con el parámetro `cutover: true` que ya usan las pruebas, solo en la copia temporal. El repositorio no gana ninguna vía nueva.

- **L-01** Guardar: nueva versión, la anterior queda como `previous`, una entrada `save` con `field`, `before` y `after`, y autor con id salido de la sesión. Un `author` en el cuerpo es 422.
- **L-02** Restaurar: intercambio, repetirlo con la versión nueva lo deshace, repetirlo con la antigua da 409 sin cambios, sin `expectedVersion` es 422, sin anterior o con anterior inválido es 409 `PAGE_NO_PREVIOUS`. `restore_seed` no es alcanzable por la API.
- **L-03** Conflicto: 409 `PAGE_CONFLICT` con `currentPage` real; `overwrite: true` con versión antigua sigue siendo 409 y con la versión nueva registra `overwrite_after_conflict`.
- **L-04** Versiones con `updated_at` NULL (`0@seed`) y con desplazamiento: se releen iguales y se pueden guardar.
- **L-05** Permisos: editor de Molotes en Birria (`GET`, `PUT`, `restaurar`) 403 sin cambios; editor en lo suyo y administrador en ambos, 200.
- **L-06** 422 por campo, sin escribir: precio inválido, texto largo, formulario sin un campo, campo extra. Con 422 y versión antigua gana el 422, como declara el orden.
- **L-07** `freshness`: `confirmed` solo si la landing confirma (doble HTTP real de la landing).
- **L-08** Con el aviso caído: 200 `pending` y lo guardado queda; con fallo de MySQL: 503 sin aviso.
- **L-09** Carrera: 20 guardados en paralelo con la misma versión sobre MySQL: exactamente un 200, el resto 409, sin 5xx, una sola entrada de historial y `currentPage` veraz (H-2). Se repite 5 veces. Si un 503 aparece, se cuenta.
- **L-10** Atomicidad: forzar el fallo del historial tras escribir versión y anterior (acción mayor de 32 caracteres en la sonda): todo revertido. Autor con 60 puntos de código, emojis y ñ; autor mayor que la columna (H-3).
- **L-11** Ida y vuelta: `GET` y `PUT` de sus mismos `values` deja los mismos datos y un historial sin cambios falsos, en ambos negocios.

### Pruebas negativas y casos límite

- **C-01** Contratos frente a `menu-schema`: se recorre `getPageSchema` y la forma de `publicPageSchemas` para comparar hojas en ejecución; muestras generadas que `validatePageData` acepta deben pasar el contrato (valores límite incluidos), y `contract-types.test.ts` lo cubre solo en tipos (H-5).
- **C-02** Campos congelados: una fila con `menu.items` u otro campo extra no sale por ningún endpoint y responde 503 con `page_data_invalid`. El `GET` admin no expone `updatedById`, ni el público autor ni versión.
- **C-03** Cuerpo manipulado: `overwrite` no booleano, claves desconocidas, `fields` no objeto, valores no texto, `__proto__` y `constructor`, y metacampos dentro de `fields` (H-1).
- **C-04** Límites: 64 KiB exactos y uno más, JSON roto, tipo de contenido incorrecto, `expectedVersion` de 200 y 201 caracteres (H-4).
- **C-05** Filas dañadas: `data` no JSON, vigente inválida (503 sin contenido) y anterior inválida (`hasPrevious: false`).
- **C-06** Rutas: `/usuarios/pagina`, `/bot/pagina`, `/cuenta/pagina`, `/__proto__/pagina`, `/Molotes/pagina` (mayúsculas), barra final y 405 con `Allow`.

### Pruebas de migración (RF-1)

Sonda S-3, sobre una base `restaurante_test_qa044*`:

- **M-01** Aditiva: inspección del SQL (solo `CREATE TABLE`) y, con filas en las tablas existentes, `SHOW CREATE TABLE` y conteos idénticos antes y después.
- **M-02** Base frente a plan: `information_schema` contra la tabla del Modelo de datos: tipos, longitudes, nulos, PK, índice `(business, id)`, sin claves foráneas, `MEDIUMTEXT`, y colación `utf8mb4_es_0900_as_cs` en tablas y en cada columna de texto.
- **M-03** `prisma migrate diff --exit-code` (el comando del CI) y `migrate deploy` repetido sin efecto.
- **M-04** Texto real en `MEDIUMTEXT`: ñ, Ñ, acentos, emoji de 4 bytes, ZWJ, saltos de línea y comillas, byte a byte; 1 MiB y por encima de 64 KiB (lo que un `TEXT` no aceptaría).
- **M-05** Longitudes y modo estricto: 60 y 61 en `updated_by`; 64 y 65 en `updated_at`; 32 y 33 en `action`.
- **M-06** Versión anterior: proceso real de `api` y de `landing-pages` de `421f4e6` contra el esquema nuevo con filas. Con `DATABASE_ALLOW_NEWER_SCHEMA=true` arrancan, registran `database_newer_than_code_allowed` y sirven; sin ella, se niegan con su código, sin escribir.
- **M-07** El usuario de la app (solo DML) lee y escribe las tres tablas. Respaldos: `backup.sh` y `deploy.sh` vuelcan la base entera, sin lista de tablas (comprobado al planificar; `deploy/` y `ops/` sin cambios).

### Pruebas de integración (`landing-pages` y `/admin`)

- **R-01** Texto: diferencia entre `admin-form.ts` de `421f4e6` y `page-form.ts`. Solo se esperan cabecera, nombres, `ReadonlyMap` y el `imageExists` por defecto.
- **R-02** Diferencial de `parseAdminForm`: la versión de `421f4e6` y la nueva con la misma entrada (al menos 500 casos generados con semilla fija, más estructura manipulada, en ambos negocios). Resultado serializado idéntico.
- **R-03** Diferencial HTTP (S-4): la misma sonda en `421f4e6` y en la rama vuelca estado, `Location` y cuerpo de `GET /admin/<negocio>` y de los POST de guardar (válido, precio inválido, texto largo, campo extra, conflicto, sobrescribir) y restaurar (anterior, semilla); también `/`, `/molotes` y `/birria`, en un lunes, un miércoles y un sábado simulados, y el JSON escrito en disco. Solo se normalizan el token CSRF y la cookie, y el `diff` debe quedar vacío.
- **R-04** Valores de `CHANGE_ACTIONS` y salida de `versionOf` iguales a los de `421f4e6`.

### Pruebas de regresión

- **R-05** `npm run typecheck`, `npm run lint` (incluye la regla de dependencias) y `npm test` completo, en la rama real. Conteos reales frente a los afirmados (216 archivos y 2.900 pruebas).
- **R-06** **Pruebas de `421f4e6` contra el código nuevo** (S-1): las carpetas `tests/` anteriores de las tres apps sobre `src/` y `packages/` nuevos, para probar que no se rebajó ninguna expectativa. Debe pasar todo, incluido `public-client.test.ts` para `getProducts`. Además, revisar el `diff` de las pruebas existentes: `landing-products.test.ts` (solo un doble con `getPage`), `contract-types`, `admin-client`, `public-client`, `support/admin.ts`.
- **R-07** REQ-F-039 a REQ-F-043 en `api`: productos, usuarios, cuenta, bot, bloqueos y topes dentro de R-05 y R-06, y productos con `PUBLIC_PATH` (404, 405 y `BUSINESS_NOT_FOUND`).
- **R-08** Sin consumidores: CodeGraph confirma que `getPage`, `savePage` y `restorePage` no se llaman desde ningún `src/`, y `landing-pages` no importa `prisma-page-store`.
- **R-09** El puerto del webhook no sirve `/api/v1/public/*/pagina` ni `/api/v1/admin/*/pagina`.

### Pruebas de seguridad y privacidad

- **X-01** Con base caída, fila dañada y fallo interno en la cadena real: las respuestas no contienen SQL, stack, rutas, `DATABASE_URL`, nombres de tablas ni contenido de la fila.
- **X-02** Registro capturado del proceso real durante P-01, L-01 a L-10 y X-01: sin valores de página ni del historial (texto centinela), sin id de sesión, token CSRF ni credenciales.

### Pruebas de performance

- **T-01** Duración por archivo: dos ejecuciones completas con los workers por defecto y reporte JSON, sin `--maxWorkers`. Cada archivo nuevo debe quedar **por debajo de 10 s en local**, máximo de las dos. Se listan los ocho nuevos y `contract-types`, con la cifra real frente a los "menos de 3 s" afirmados.
- **T-02** Sin cambios en `testTimeout`, `hookTimeout` ni `retry`.

### Pruebas automatizadas (existentes y nuevas)

Contraste de mutaciones (H-6), en la copia temporal, una a una, con conteo real de **detectadas por la suite del repositorio**. Se ejecutan las pruebas afectadas y, si sobrevive, la suite de la app. La lista de 16 no está en el ticket, así que este catálogo es propio, de 31 mutaciones, y no compara una por una con las 16 salvo "Restaurar sin CSRF" (punto 3 por aprobar).

- **Puerta y orden:** `PAGE_CUTOVER = true`; `server.ts` pasa `cutover: true`; solo `get` queda cerrado; solo `save` queda cerrado; disponibilidad antes del permiso; cuerpo antes de la disponibilidad en `save` y en `restore`; sin CSRF en `save`; sin CSRF en `restore`; 503 público sustituido por 404.
- **Repositorio:** sin `assertVersion` en `save`; sin él en `restorePrevious`; `expectedVersion` opcional; sin `putPrevious`; sin `addChange`; autor sin id; `overwrite` ignorado; `hasPrevious` siempre verdadero; no validar la anterior; `revision` sin `max`.
- **`db`:** condición sin `revision`; condición sin `updatedAt`; sin `$transaction`; `PageError` convertido en no disponible.
- **API y contratos:** `freshness` siempre `confirmed`; respuesta pública sin pasar por el contrato; registrar contenido en `page_data_invalid`; `PAGE_BODY_LIMIT` a 1 MiB.
- **Migración y formulario:** colación `unicode_ci`; `TEXT` en vez de `MEDIUMTEXT`; sin control de campos extra.

Una mutación equivalente se justifica como tal. Una sobreviviente no equivalente es un hueco de cobertura que se informa con su severidad.

**Sondas:**

| Sonda | Qué hace | Dónde |
| --- | --- | --- |
| S-1 | Copia de la rama con las `tests/` de `421f4e6` | Copia temporal |
| S-2 | Cadena completa con MySQL (L, C, X) | Copia temporal |
| S-3 | Migración y versión anterior (M) | Copia temporal y árbol de `421f4e6` |
| S-4 | Volcado diferencial de `/admin` y landings (R-02, R-03) | Ambos árboles temporales |
| S-5 | Proceso real con puerta cerrada (P) | Copia temporal |

**Dónde quedan:** todas en el scratchpad de la sesión, en una copia de la rama (`rsync` sin `node_modules` ni `.env`) y un árbol de `421f4e6`, cada uno con su `npm ci` y `db:generate`. Hay que usar `npm ci`, porque los enlaces de workspaces de un `node_modules` copiado apuntarían al código equivocado. **Nada se escribe en el repositorio** salvo este ticket: ni pruebas, ni producción, ni archivos de QA. Las mutaciones y el `cutover: true` de las sondas solo existen en la copia. No se crean pruebas permanentes: si una sonda encuentra un hueco, se informa para que `senior-fullstack` agregue la prueba.

### Pruebas en navegador

No aplican: no hay pantalla. R-03 compara HTML por HTTP.

### Evidencia requerida

Salida de `typecheck`, `lint` y `npm test` con conteos; matriz de códigos de P-01; volcados antes y después (P-04, M-01); `information_schema` (M-02); registros de arranque de M-06; `diff` vacío de R-02 y R-03; tabla de mutaciones con la prueba que detecta cada una; tabla de duraciones; resultado de la limpieza.

**Limpieza (`.claude/rules/testing.md`):** al terminar, también si algo falla, se borran las copias y sus `node_modules`, las bases `restaurante_test*` de las sondas (incluidas las vacías) y los procesos y puertos, y se comprueba con `git worktree list`, los procesos y la lista de bases. Solo se usa el MySQL de pruebas. La suite y las sondas no corren a la vez sobre los mismos puertos.

### Criterios de aprobación

- P-01 a P-07 sin excepciones: cualquier escritura, dato servido o activación por entorno con la puerta cerrada es `BLOCKER`.
- CA-8 a CA-12 y RF-1, RF-7 y RF-8 con evidencia sobre MySQL real.
- M-06 correcto: si la versión anterior no arranca, es `BLOCKER` para el despliegue.
- R-02, R-03 y R-06 sin diferencias.
- `typecheck`, `lint` y `npm test` en verde.
- Todos los archivos nuevos por debajo de 10 s en local; uno por encima es un defecto a partir antes del CI.
- Sobrevivientes de mutación y H-1 a H-5 clasificados: los `MAJOR` pasan a decisión del usuario.

**No se repite en local:** las imágenes Docker. Las valida el trabajo `docker` del CI con el PR listo (punto 4 por aprobar).

**NotebookLM:** las herramientas MCP `notebooklm` no estaban disponibles en esta sesión de QA; no se consultó.

## QA Report

### Ronda

Ronda 1 del PR 1 (2026-11-05). Plan aprobado por el usuario, cita textual: "Si", a "¿Apruebas el plan de QA con esos 5 puntos?". Primera ronda: se ejecutó completa.

### Pruebas ejecutadas

| Comando o acción | Resultado real |
| --- | --- |
| `npm run build:css`, `npm run typecheck`, `npm run lint` | Salida 0 en los tres, sin errores ni avisos |
| Suite completa dos veces, por app, con workers por defecto | 216 archivos y 2.900 pruebas, 0 fallos en las dos (`landing-pages` 159 y 1.594, con 1 fallo esperado previo; `api` 46 y 1.119; `inventory-manager` 11 y 187). Coincide con lo afirmado |
| S-1: pruebas de `421f4e6` sobre el código nuevo | `landing-pages` 157 y 1.582; `api` 40 y 1.049; `inventory-manager` 11 y 182; 0 fallos |
| S-2: cadena completa con MySQL (L, C, X, M-04, M-05) | 19 de 19 sondas |
| S-5: proceso real con la puerta cerrada | 9 de 9 sondas |
| S-3: migración, comparación y versión anterior | Ver "Migración" |
| S-4: diferencial `421f4e6` frente a la rama | 5 volcados idénticos con `cmp` |
| `prisma migrate diff --exit-code` (comando del CI) | "No difference detected", salida 0 |
| Mutaciones | 27 de 31 detectadas por la suite; ver "Mutaciones" |

Todo lo temporal corrió fuera del repositorio. MySQL de pruebas en 127.0.0.1:3307. Sin `.env`, VPS, producción, WhatsApp ni Meta. La base `restaurante` no se tocó.

### Criterios de aceptación

Solo la parte de API de este PR.

| Criterio | Resultado | Evidencia |
| --- | --- | --- |
| RF-4 y CA-18 | PASS | P-01 a P-07: 25 combinaciones con los códigos esperados, con y sin filas; tablas idénticas tras las peticiones |
| RF-1 | PASS | M-01 a M-07 |
| CA-8 (`freshness`) | PASS | Notificador real: `confirmed` con confirmación; `pending` con 500 y con `landing: false`, y lo guardado queda |
| CA-9 | PASS | 409 con versión y autor reales; `overwrite` no salta la versión; `overwrite_after_conflict` registrado |
| CA-10 y RF-7 | PASS | 403 sin cambios en `GET`, `PUT` y restaurar; autor de la sesión |
| CA-11 | PASS | 422 por campo con precio, largo, campo extra y campo ausente; nada escrito ni avisado |
| CA-12 y D-10 | PASS | Intercambio, deshacer, 409 con versión antigua, 422 sin versión, 409 `PAGE_NO_PREVIOUS` sin anterior o con anterior inválido; `/restaurar-semilla` 404 |
| RF-8 | PASS | `save`, `overwrite_after_conflict` y `restore_previous`, con autor, id, campo, antes y después |

CA-9 y CA-11 en pantalla son del PR 2. CA-1 a CA-7, CA-13 a CA-17, CA-19 y CA-20 son del PR 3 o no aplican aquí.

### Puerta cerrada

- **Orden (proceso real, login real):** 401 sin sesión o con sesión falsa, 404 negocio desconocido, 403 `FORBIDDEN_BUSINESS`, 403 `CSRF_INVALID` sin token y con token incorrecto, 503 `PAGE_UNAVAILABLE`. JSON roto, cuerpo raro y 1 MiB también dan 503.
- **Sin escrituras:** `page_version`, `page_change` y `page_import` idénticas antes y después. Sin contenido de filas, id de sesión ni token CSRF en los registros.
- **Entorno:** `PAGE_CUTOVER=true`, `PAGE_CUTOVER=1`, `API_PAGE_CUTOVER=true`, `CUTOVER=true`, `NODE_ENV=test` y `NODE_ENV=development`: 503 en público, lectura y escritura.
- **Estática:** en `api/src`, `cutover` solo aparece en `page-cutover.ts`; `server.ts` no lo pasa. Sin referencias en `packages`, `deploy`, `.github`, `compose.yaml` ni `docker`.
- **Base caída:** sigue en `PAGE_UNAVAILABLE`, sin tocar MySQL en esa ruta.
- **Webhook:** los endpoints públicos y admin responden 404 por ese puerto.

### Migración

- **M-01:** solo `CREATE TABLE`, sin `ALTER`, `DROP`, `UPDATE` ni `DELETE`. Con datos reales en 6 tablas, contando `_prisma_migrations`: de 13 a 16 tablas, y `SHOW CREATE TABLE`, conteos y `CHECKSUM` idénticos en las 12 previas sin contar `_prisma_migrations`.
- **M-02:** `information_schema` coincide con el modelo: tipos, longitudes, nulos, PK, índice `(business, id)`, 0 claves foráneas, `mediumtext` en `data` y `changes`, y `utf8mb4_es_0900_as_cs` en tablas y columnas de texto.
- **M-03:** sin divergencia; repetir `migrate deploy` responde "No pending migrations".
- **M-04:** 1.048.608 bytes con ñ, acentos, emojis de 4 bytes, ZWJ, comillas y `</script>`: iguales byte a byte, también en `changes`.
- **M-05:** 60 sí y 61 no en `updated_by` y `author`; 64 sí y 65 no en `updated_at`; 32 sí y 33 no en `action`. La colación distingue ñ, acentos y mayúsculas.
- **M-06:** `api` y `landing-pages` de `421f4e6`, con filas en las tablas nuevas. Sin la bandera se niegan: `database_init_failed`, `DATABASE_NEWER_THAN_CODE`, migración `20261105200300_pagina`. Con `DATABASE_ALLOW_NEWER_SCHEMA=true` arrancan, registran `database_newer_than_code_allowed` y sirven `/`, `/molotes`, `/birria`, productos y login de `/admin`, y `/admin/molotes` responde 200. Las filas nuevas no cambian.
- **M-07:** el usuario solo DML lee y escribe las tres tablas. Respaldos sin lista de tablas.

### Defectos encontrados

```text
### DEF-001
- Severidad: TRIVIAL
- Criterio de aceptación afectado: ninguno. Technical Action Plan, "cuerpo cerrado".
- Descripción: dentro de `fields`, `_csrf`, `action`, `expectedVersion` y `__proto__` se ignoran en silencio.
- Pasos para reproducir: con la puerta abierta, en una prueba, PUT válido añadiendo en `fields` `_csrf`, `action: "restore_seed"` y `expectedVersion: "otra"`.
- Resultado esperado: 422, como cualquier otro campo extra.
- Resultado actual: 200. Se guarda lo correcto, con acción `save`. `constructor` y `toString` sí dan 422.
- Evidencia: sonda C-03; sin contaminación de prototipos y sin efecto en datos ni historial.
- Impacto: ninguno observable; un cliente con un error no se enteraría.
- Recomendación: decidir si `fields` debe rechazarlos. `/admin` debe conservar su comportamiento actual.
```

```text
### DEF-002
- Severidad: MINOR
- Criterio de aceptación afectado: ninguno. El comportamiento es correcto; falta cobertura.
- Descripción: dos mutaciones no equivalentes sobreviven a toda la suite.
- Pasos para reproducir: (a) en `restorePrevious`, `revision = target.stored.revision`; (b) `PAGE_BODY_LIMIT = 1024 * 1024`. Ejecutar `npm test`.
- Resultado esperado: alguna prueba falla.
- Resultado actual: 1.119 de 1.119 en `api`.
- Evidencia: el código real responde 413 con 64 KiB + 1 y 422 con 64 KiB exactos (C-04).
- Impacto: una regresión futura en esos dos puntos pasaría el CI.
- Recomendación: ver "Pruebas permanentes recomendadas".
```

Sin defectos `BLOCKER`, `CRITICAL` ni `MAJOR`.

### Hipótesis

| Hipótesis | Veredicto |
| --- | --- |
| H-1 metacampos en `fields` | **Confirmada**, sin impacto: DEF-001 |
| H-2 interbloqueo sin reintento | **No se materializa**: 5 rondas de 20 guardados dieron 1 × 200 y 19 × 409 en cada una, sin 5xx, con `currentPage` veraz en 95 de 95. La falta de reintento es real, pero solo se probó la carrera de guardados |
| H-3 `displayName` frente a la columna | **Descartada**: `DISPLAY_NAME_MAX_LENGTH`, `AUTHOR_MAX_LENGTH` y las columnas son 60, y 60 emojis funcionan. Forzando 61 da 503 sin fugas |
| H-4 400, 413 y 415 | **Confirmada, sin defecto**: existen con `PAYLOAD_TOO_LARGE`, `INVALID_JSON` y `UNSUPPORTED_MEDIA_TYPE`, en el formato común y sin escribir. Falta mencionarlos en la tabla de endpoints; el PR 2 debe tratarlos como error genérico |
| H-5 contrato frente a `menu-schema` | **Descartada**: mismas 9 y 6 hojas y tipos; 99 valores aceptados pasan el contrato y la ida y vuelta del formulario |
| H-6 las 16 mutaciones | **Confirmada**: la lista no está; solo se contrastó "Restaurar sin CSRF", que se detecta (mutación 09) |

### Mutaciones

**Detectadas por la suite: 27 de 31.** Las 31 se aplicaron y el código quedó restaurado (comparado con el original).

| Mutación | Resultado |
| --- | --- |
| 01 a 19, 23 a 27, 29 a 31 | Detectadas. La 30 (`TEXT`) solo por `migrate diff`, que corre en el CI. La 02 solo por el proceso real |
| 20 `revision` sin `max` | Sobrevive: hueco (DEF-002) |
| 21 condición sin `revision` | Sobrevive: redundante con `updatedAt` |
| 22 condición sin `updatedAt` | Sobrevive: redundante con `revision` |
| 28 `PAGE_BODY_LIMIT` a 1 MiB | Sobrevive: hueco (DEF-002) |

Las cuatro se repitieron con la suite completa de su app, sin detección. Quitar las dos condiciones a la vez **sí** se detecta (`prisma-page-store.test.ts`), así que 21 y 22 son redundancia y no huecos de comportamiento.

### Pruebas permanentes recomendadas

Para `senior-fullstack`; ninguna bloquea:

1. `api/tests/unit/page-repository.test.ts`: la revisión nunca baja al restaurar, con una anterior de revisión menor (mutación 20).
2. `api/tests/integration/admin-page-write.test.ts`: `PUT` con 64 KiB + 1 responde 413 `PAYLOAD_TOO_LARGE` sin escribir (mutación 28).
3. `landing-pages/tests/integration/prisma-page-store.test.ts`: `replaceCurrent` devuelve `false` con misma fecha y otra revisión, y con misma revisión y otra fecha, incluido `NULL` (mutaciones 21 y 22).
4. Opcional, para el PR 3, cuando desaparezca `cutover`: una prueba de cadena completa con MySQL. Hoy ninguna prueba del repositorio recorre ruta, repositorio, Prisma y MySQL juntos; la sonda S-2 lo cubrió sin hallar fallos.

### Regresión

- **Formulario:** `diff` de `admin-form.ts` frente a `page-form.ts`: solo imports, nombres, `ReadonlyMap`, `imageExists` por defecto y el código nuevo.
- **R-02:** 804 casos (272 de estructura, 255 con errores, 330 válidos): `cmp` idéntico.
- **R-03:** `/admin` de los dos negocios con repositorio de archivos real, 26 pasos (guardar, 422, 400, conflicto, sobrescribir, restaurar y semilla) y los 5 JSON escritos: idéntico. `/`, `/molotes` y `/birria` en lunes, miércoles y sábado: idéntico. Solo se normalizaron CSRF y cookie.
- **`CHANGE_ACTIONS` y `versionOf`:** mismos valores y formato.
- **`getProducts`:** el `public-client.test.ts` anterior pasa sin cambios. Las pruebas existentes solo suman; las líneas retiradas son imports y la línea ampliada del arnés.
- **REQ-F-039 a REQ-F-043:** sin fallos en la suite ni en S-1. `PUBLIC_PATH` conserva 200, 404 y 405 en productos.
- **Sin consumidores:** ningún `src/` llama `getPage`, `savePage` ni `restorePage`, ni importa `prisma-page-store` fuera de `api`.
- **Regla de dependencias:** `npm run lint` y sus pruebas, en verde.
- `deploy/`, `ops/` y `.github/` sin cambios; ni variables ni configuración de Vitest. Solo un `export` en `packages/db/package.json`.

### Responsive

No aplica: sin pantalla.

### Accesibilidad

No aplica: sin pantalla.

### UX/UI

No aplica: sin pantalla.

### Performance

Duración por archivo, en segundos, en las dos ejecuciones:

| Archivo nuevo o ampliado | Ejecución 1 | Ejecución 2 |
| --- | --- | --- |
| `landing-pages/.../api-page-process.test.ts` | 0,92 | 3,48 |
| `landing-pages/.../prisma-page-store.test.ts` | 2,21 | 2,43 |
| `api/.../admin-page-write.test.ts` | 1,67 | 1,65 |
| `api/.../page-unavailable.test.ts` | 0,73 | 0,70 |
| `api/.../admin-page-read.test.ts` | 0,52 | 0,50 |
| `api/.../public-page-endpoint.test.ts` | 0,10 | 0,08 |
| `api/.../contract-types.test.ts` | 0,02 | 0,03 |
| `api/.../page-repository.test.ts` | 0,01 | 0,01 |
| `api/.../page-form.test.ts` | 0,00 | 0,00 |

Todos muy por debajo de 10 s. El ticket afirmaba menos de 3 s: `api-page-process` llegó a 3,48 s, sin consecuencias. Sin `retry` ni cambios de tiempos. Fuera de este PR: `admin-authorization-matrix-concurrencia`, `last-admin-concurrency` y `admin-users-moved` rozan los 20 s en local.

### SEO

Sin cambios: `/`, `/molotes` y `/birria` idénticos a `421f4e6`.

### Privacidad y errores

MySQL real con la tabla renombrada: 503 `DATABASE_UNAVAILABLE` en lectura, escritura y público, solo con código y mensaje. Fila dañada: 503 `PAGE_UNAVAILABLE`. Sin SQL, stack, rutas, URL, tablas ni contenido en respuestas, y sin contenido, sesión, CSRF ni credenciales en registros. Campos congelados en una fila: no salen por ningún endpoint.

### Limpieza

Comprobada con datos: copias y sus `node_modules` borrados (0 `node_modules` en el scratchpad), `restaurante_test_qa044m` eliminada, sin bases `restaurante_test*` (quedan `restaurante`, `restaurante_shadow` y las de sistema), un solo `git worktree`, sin procesos de prueba, 0 puertos de Node en escucha. Repositorio: 40 entradas de `git status`, las mismas que al empezar, sin archivos de QA; HEAD `421f4e6`.

### Pendientes de revisión manual

Ninguno de este PR.

**Sin ejecutar:**

- Imágenes Docker: las valida el trabajo `docker` del CI con el PR listo (punto 4 aprobado).
- Contraste uno a uno de las 16 mutaciones: la lista no existe (punto 3 aprobado).
- Navegador: no hay pantalla.
- Carrera mixta de guardar y restaurar: el plan solo pedía guardados.

### Resultado final

QA_APPROVED

## Implementation Result del PR 3

### Rama

`feature/REQ-F-044-pagina-en-mysql-3-corte`, desde `origin/main` (`4db1413`), que ya incluye la épica. El PR irá a `epic/arquitectura`. Sin commit, push ni PR. `Calculadora.xlsx` (sin seguimiento) es ajeno y no se toca.

### Cambios realizados

- **`core/catalog/page-import.ts` (nuevo, puro):** `choosePageSource` y `planPageImport` (origen `current` → `previous` → semilla; `current` con `previous` válido importa los dos; `previous` como vigente deja el anterior vacío; semilla de primera ejecución en los dos huecos; semilla por daño con el anterior vacío; semilla en una instalación existente: `PAGE_IMPORT_SEED_REFUSED` con motivo `missing` o `damaged`). Un documento que no cabe en las columnas (fecha > 64, revisión fuera de INT, autor > 60 o texto mal formado) cuenta como dañado. `parseChangeLog` y `parseChangeLine` reparten `changes.jsonl` por negocio, cuentan las ilegibles por número de línea y dejan `authorId` nulo si falta.
- **Store de página:** `PageStoreTx` gana `putCurrent`, `addImportedChanges` y `markImported`; `PageStore`, `readImports`, `hasProductImports` y un `timeoutMs` opcional en `transaction`. Prisma: `createMany` por lotes de 500 con `imported: true`, marca con clave primaria por negocio. Memoria: `importedChanges`, `imports` y `productImports` separados de `changes`, para no tocar las expectativas existentes.
- **`api`:** se borra `src/page-cutover.ts`; `server.ts` usa `createPageRepository`. Soporte y pruebas sin `pageCutover`.
- **`landing-pages`:**
  - `server.ts`: verificar la base → primer administrador → `hasProductImports` (instalación existente) → `repository.init({ seedMissing: !existing })` → `importPages` → `products.init` → control del bot → `warmUp` de productos y página → `listen`. Un fallo o una negativa de la importación registra `page_import_failed` (solo códigos, negocio y motivo) y termina con 1.
  - `services/page-import.ts` (nuevo): una transacción de 60 s para los negocios sin marca; con marca no escribe y registra `page_json_diverged` si cambió la versión del JSON; logs `page_import_done`, `page_import_from_seed`, `page_import_from_previous` y `page_import_lines_skipped`, sin contenido.
  - `repositories/menu-repository.ts`: `init({ seedMissing })` (sin la semilla, no escribe y publica `previous` o la semilla solo en memoria; log `menu_data_missing`), `getImportSource` y `readChangeLog`; `readChanges` en los storages de archivos y memoria.
  - `services/landing-cache.ts` (nuevo): la caché común, movida de `landing-products.ts`. `landing-products.ts` queda como envoltorio con sus nombres de log; `landing-page.ts` (nuevo) es el envoltorio de la página (`landing_page_*`), con `loadSeedMenus`, `loadSeedPages` y `withPage`.
  - `controllers/landing.ts`: `withProducts(withPage(semilla, página de la API), productos)`, sin el repositorio de menús. `routes/index.ts` y `app.ts`: `createApp` ya no recibe el repositorio de menús; recibe `landingPage` y, con usuarios, `pages`.
  - `internal-app.ts`: el aviso invalida productos y página; `landing` solo es `true` si los dos quedaron al día.
  - `/admin`: la página sale de MySQL (`pages`). Sin `ADMIN_NEW_URL`, guarda y restaura en MySQL, invalida la caché de la landing y, si la API no lo confirma, redirige con `?ok=save_pending`. Restaurar exige la versión confirmada (campo oculto en la confirmación; 409 si cambió). "Restaurar semilla" responde siempre 409 "no permitido" (D-10). Desaparece el estado "dañado" (`damaged.html` y `restore-form.html` borrados). Con `ADMIN_NEW_URL`: GET con los valores vigentes en un `fieldset` deshabilitado fuera de cualquier formulario (`business-readonly.html`), aviso y enlace a `<ADMIN_NEW_URL>/<negocio>/pagina`; los tres POST pasan sesión → permiso → cuerpo → CSRF y responden 410 sin escribir (`admin_page_moved`); la confirmación de restaurar redirige a la página. `admin-guard.ts` responde 503 ante `PageUnavailableError`.
- **`inventory-manager`:** el aviso de "no disponible" usa el texto neutro de D-14 (título "La página no está disponible en este momento." y párrafo "No se cambió nada. Inténtalo en unos minutos; si sigue igual, avisa al administrador."). Comentarios y soporte de pruebas sin `PAGE_CUTOVER`.
- **`contracts/page.ts`:** solo el comentario de `PAGE_UNAVAILABLE`.
- **`eslint.config.ts`:** `landing-page.ts` y `landing-cache.ts` en `LANDING_CODE_FILES`; prohibidos en ellos `createPageRepository`, `PageRepository`, `PageRepositoryOptions`, `PageStore`, `PageStoreTx`, `createMemoryPageStore`, `MemoryPageStore` y cualquier `repositories/*menu-repository`. Comprobado con un import temporal: dos errores, revertido.
- **Documentación (RF-11):** `arquitectura.md` §1, §6 (endpoints y consumo de la página), §8 (fila del ticket 5 y sección "Paso 4, ticket 5 aplicado") y §10 (riesgos); `README.md` (endpoints de página, incluidos 400, 413 y 415 de H-4; landings; aviso interno; admin nuevo; `/admin` en solo lectura; tabla de menús; `DATA_DIR` solo de lectura y la edición manual de JSON que deja de aplicar; JSON dañados; base de datos); `desarrollo.md` §4; `despliegue.md` §6 (vuelta atrás tras el corte, con el vaciado de D-17), §8 (comprobaciones antes y después del corte), §9 (la marca vuelve con el volcado) y §11.1 (qué cubre cada respaldo); `.env.example` (comentario de `DATA_DIR`); `.claude/CLAUDE.md` §8 (D-8). `deploy/`, `ops/` y la migración no cambian.

### Pruebas

- **Nueva y permanente (D-15):** `landing-pages/tests/unit/page-import.test.ts`, 15 casos: origen con `current` y `previous`, sin `previous`, CA-4, falta `current` con `previous` válido, documento que no cabe (fecha y revisión), copia de la semilla en una instalación existente, CA-5, semilla por daño en una instalación nueva, CA-20 (`missing` y `damaged`, y `current` que no cabe sin `previous`), reparto de líneas con `restore_seed` y sin `authorId`, diez líneas ilegibles por número, archivo ausente. Está en `landing-pages` porque `core` no tiene ejecutor de pruebas.
- **Borradas:** `landing-pages/tests/integration/api-page-process.test.ts` (D-15: probaba la puerta cerrada, que ya no existe) y `landing-pages/tests/integration/admin-file-repository.test.ts` (probaba que `/admin` escribe los JSON; desde el corte no los escribe, RN-2). También dos casos de `api/tests/integration/page-unavailable.test.ts` (la imagen anterior al corte con filas y la constante), la `describe` "archivo dañado al arrancar" de `app.test.ts` (la landing ya no lee los JSON) y la `describe` "archivo dañado (RF-8)" de `admin-produccion.test.ts` (sin estado "dañado" en MySQL, D-10).
- **Modificadas por cambio de comportamiento:** el soporte (`setupAdmin` con store de página en memoria e importación real; `landingPageFrom`, `fixedLandingPage`, `restoreFields`, `pageOf`; `versionOf` sobre `pages`) y las pruebas de `/admin` que leían los JSON (acceso, CSRF, guardar, producción, autorización, seguridad de la base); `admin-products-moved` y `admin-users-moved` (con `ADMIN_NEW_URL` la página queda en solo lectura: el caso existente comprueba ahora CA-13: valores de MySQL, enlace, sin formulario, 410 en los tres POST, 403 sin CSRF y nada escrito); `internal-app.test.ts` (invalida los dos recursos); `createApp` sin repositorio en las pruebas de landings; textos de `inventory-manager`.
- **Comprobaciones descartadas (no quedan en el repositorio):** un archivo temporal con MySQL real y procesos reales: CA-20 con dos arranques seguidos y el volumen vacío (exit 1, `PAGE_IMPORT_SEED_REFUSED`, sin JSON escritos, sin filas ni marca) y con Birria dañado (ningún negocio importado); CA-1 (filas con revisión, fecha y autor; JSON y `changes.jsonl` con el mismo SHA-256; línea ilegible 3 contada; logs sin contenido); CA-2 y CA-16 (segundo arranque sin reimportar, un `page_json_diverged`, MySQL sin cambios); cadena real api + landing (la landing muestra lo editado en MySQL, no lo editado en el JSON); CA-3 con el store de Prisma (fallo en la marca del segundo negocio: nada escrito; el reintento importa los dos); CA-5 en proceso (`page_import_from_seed`, cuatro filas). 5 de 5 en verde. También un caso de `/admin` restaurando tras un cambio posterior a la confirmación (409, nada escrito), en verde y descartado.

### Criterios de aceptación

| Criterio | Estado |
| --- | --- |
| CA-1 | Cumplido en la comprobación descartada (MySQL real y proceso). Ensayo con datos reales: QA (D-16) |
| CA-2 | Cumplido (segundo arranque, comprobación descartada) |
| CA-3 | Cumplido (fallo en el segundo negocio con Prisma, comprobación descartada) |
| CA-4 | Cumplido (unitaria permanente) |
| CA-5 | Cumplido (unitaria y proceso) |
| CA-6 | `landing-html-reference.test.ts` sigue byte a byte con la página de la semilla servida como la API. 375 px y escritorio en navegador, y datos reales: QA |
| CA-7 | Misma caché que los productos (`landing-cache.ts`), cubierta por `landing-products*.test.ts` sin cambios de expectativa. Sin prueba propia de la página (D-15) |
| CA-8 | Aviso común (`internal-app.test.ts`); `save_pending` en `/admin`; `pending` en `api` sin cambios |
| CA-9 a CA-12, CA-14 | Sin cambios desde PR 1 y 2 |
| CA-13 | Cumplido (`admin-products-moved.test.ts`) |
| CA-15 | Por diseño: la importación solo lee y los JSON quedan intactos (SHA-256 comprobado). Vuelta atrás real: QA |
| CA-16 | Cumplido (comprobación descartada) |
| CA-17 | Por diseño (la marca va en el volcado); `smoke.sh` no cambia (decisión del plan). QA |
| CA-18 | Texto neutro (D-14); `inventory-manager/tests/integration/page-unavailable.test.ts` en verde |
| CA-19 | Por diseño: lo guardado en el `/admin` anterior queda en `current.json`, que es lo que se importa (CA-1) |
| CA-20 | Cumplido (unitaria y dos arranques reales) |

### Validaciones ejecutadas

- `npm run build:css`: correcto.
- `npm run typecheck`: código 0 en los cinco workspaces.
- `npm run lint`: código 0, sin errores ni avisos.
- `npm test`: código 0. `api` 46 archivos y 1.118 pruebas; `landing-pages` 95 archivos y 1.314 pruebas (56 s); `inventory-manager` 15 archivos y 257 pruebas. Sin fallos.
- `git diff` revisado: solo archivos del ticket; `Calculadora.xlsx` fuera.

### Desviaciones del plan

- `readChangeLog` en el repositorio de menús (y `readChanges` en sus storages), además de `getImportSource`: la importación lee `changes.jsonl` por el mismo repositorio, sin rutas propias.
- `PageStore.hasProductImports` hace la consulta de `product_import` (el plan no fijaba dónde).
- `createApp` deja de recibir el repositorio de menús: ya ningún código de la app lo usa (solo `server.ts`).
- Las líneas ilegibles se cuentan una vez para el archivo y ese total va en `skipped_lines` de cada negocio importado: una línea ilegible no se puede atribuir a un negocio.
- `/admin` sin `ADMIN_NEW_URL`, tras guardar sin confirmación de la API, muestra el aviso nuevo `save_pending` en lugar de afirmar que la landing ya lo muestra.
- La unitaria permanente vive en `landing-pages/tests/unit/` (plan: `page-import-source.test.ts`), porque `core` no tiene ejecutor de pruebas.

### Archivos afectados

Nuevos: `packages/core/catalog/page-import.ts`, `landing-pages/src/services/{landing-cache,landing-page,page-import}.ts`, `landing-pages/src/views/admin/business-readonly.html`, `landing-pages/src/views/admin/partials/page-moved-link.html`, `landing-pages/tests/unit/page-import.test.ts`.

Borrados: `api/src/page-cutover.ts`, `landing-pages/src/views/admin/partials/{damaged,restore-form}.html`, `landing-pages/tests/integration/{api-page-process,admin-file-repository}.test.ts`.

Modificados: `packages/core/catalog/{index,page-store,memory-page-store}.ts`, `packages/db/src/prisma-page-store.ts`, `packages/contracts/page.ts`, `api/src/server.ts`, `api/tests/{support/admin,integration/page-unavailable.test,integration/public-page-endpoint.test}.ts`, `inventory-manager/src/{routes,views/page}.ts`, `inventory-manager/tests/{support/page-browser,support/api-double-page,support/api-double,integration/page-unavailable.test,integration/page-failures.test}.ts`, `landing-pages/src/{app,server,internal-app}.ts`, `landing-pages/src/controllers/{admin,admin-business-view,admin-products,landing}.ts`, `landing-pages/src/middleware/admin-guard.ts`, `landing-pages/src/repositories/{menu,file-menu,memory-menu}-repository.ts`, `landing-pages/src/routes/index.ts`, `landing-pages/src/services/landing-products.ts`, `landing-pages/src/views/admin/{index.ts,business.html,confirm-restore.html}`, el soporte y las pruebas de `landing-pages` listadas arriba, `landing-pages/.env.example`, `eslint.config.ts`, `README.md`, `docs/{arquitectura,desarrollo,despliegue}.md` y `.claude/CLAUDE.md` (§8).

### Riesgos o pendientes

- **Ensayo con datos reales (D-16), para QA:** copia de `app-data` y un volcado de producción en local; comprobar CA-1 y CA-6. En particular, que las partes del JSON que no son de página coincidan con la semilla: la landing pinta ahora la semilla más la página, así que un texto no de página editado a mano en `current.json` antes de REQ-F-008 dejaría de verse.
- **Procedimientos documentados sin ejecutar:** los comandos nuevos de `despliegue.md` (§6, vaciado de tablas; §8, comprobaciones con `$C exec`) no se ejecutaron contra el VPS (prohibido en esta fase). Se ejecutaron sus equivalentes en local en las comprobaciones descartadas. QA debe ensayar la vuelta atrás y el vaciado en local.
- **Código sin uso hasta el ticket 6:** `save`, `restorePrevious`, `restoreSeed` y `getForEdit` del repositorio de menús ya no los usa la app (siguen probados en `file-menu-repository.test.ts`). Se retiran con `/admin` en el ticket 6.
- `ops/backup/ci/smoke.sh` no cambia (decisión del plan): CA-17 queda para QA.
- Limpieza comprobada: sin bases `restaurante_test*`, sin procesos de Vitest ni servidores, sin worktrees, y el archivo temporal de comprobación borrado. El MySQL local se levantó para las pruebas y se detuvo al terminar (`npm run db:down`; los datos siguen en su volumen).

## QA Action Plan del PR 3

Implementación aprobada por el usuario para pasar a QA: "Si" (2026-11-16). Análisis de solo lectura del árbol sin commit de `feature/REQ-F-044-pagina-en-mysql-3-corte` (76 entradas en `git status`) con CodeGraph, el diff y el ticket. NotebookLM no está disponible en esta sesión (sin herramientas MCP `notebooklm`): no se consultó.

### Objetivo

Confirmar con evidencia que el corte importa la página real de producción a MySQL una sola vez, sin pérdidas ni cambios en los JSON, que las landings siguen idénticas, que `/admin` queda en solo lectura y que la vuelta atrás y los procedimientos de `despliegue.md` §6 y §8 funcionan como están escritos.

### Requisito bajo prueba

RF-2, RF-3 (con D-10), RF-5, RF-10 y RF-11; CA-1 a CA-8, CA-13, CA-15 a CA-17, CA-19 y CA-20. De regresión: CA-9 a CA-12, CA-14 y CA-18 (texto neutro, D-14).

### Criterios de aceptación

| CA | Pruebas |
| --- | --- |
| CA-1 | P-3, P-4 (datos reales: filas = JSON en valores, revisión, fecha y autor; SHA-256 de todo `app-data` igual antes y después) |
| CA-2, CA-16 | P-5 (segundo arranque), P-9 (vuelta atrás con JSON editado: `page_json_diverged`, MySQL igual) |
| CA-3 | P-7 (sonda: fallo en la marca del segundo negocio con Prisma real; nada escrito; el reintento importa los dos) |
| CA-4 | Unitaria permanente + P-6 (copia de datos reales con `current` de un negocio dañado y `previous` válido) |
| CA-5 | P-6 (base nueva sin JSON: semilla en los dos huecos y `page_import_from_seed`) |
| CA-6 | P-8 (HTML de `/`, `/molotes` y `/birria` de `main` con JSON reales frente al PR 3 tras importar, byte a byte salvo nonce) y P-13 (navegador a 375 px y 1440 px) |
| CA-7 | P-10 (API detenida con copia buena: 200 con la copia; arranque sin API: 200 con la semilla y `landing_page_fallback`) |
| CA-8 | P-10 (guardado en el admin nuevo visible en la siguiente visita; aviso fallido: `pending` y visible en ≤ 60 s) |
| CA-13 | P-11 (`/admin/<negocio>` con `ADMIN_NEW_URL`: valores de MySQL, sin formulario, enlace; tres POST 410 tras sesión, permiso y CSRF; nada escrito) |
| CA-15 | P-9 (`main` sobre la misma base y una copia de `app-data`: sirve los JSON de antes, sin marcarlos dañados, filas intactas) |
| CA-17 | P-12 (volcado posterior a la importación, edición, restauración del volcado: la página vuelve sin reimportar) y `ops/backup/ci/smoke.sh` |
| CA-19 | P-4 (lo último guardado en el `/admin` de producción es el `current.json` importado) |
| CA-20 | P-6 (copia real sin los JSON de un negocio, y con los dos dañados: dos arranques seguidos, salida 1, `PAGE_IMPORT_SEED_REFUSED`, sin marca, sin filas, sin archivos escritos) |
| CA-9 a CA-12, CA-14, CA-18 | `npm test` + P-13 y P-14 (navegador) |

### Riesgos identificados

1. **Partes no de página:** la landing pinta ahora semilla + página. Un texto no de página editado a mano en un `current.json` de producción dejaría de verse sin error (P-2).
2. **RN-2 en `repository.init`:** con `seedMissing: false` no escribe la semilla, pero sigue pudiendo aislar un `current.json` dañado (renombrar). Si los JSON reales están sanos no cambia nada; hay que comprobarlo con SHA-256 de todo `app-data` (P-3).
3. **Negocio marcado y otro negado:** si un negocio ya tiene marca y el otro no tiene JSON utilizables, cada arranque termina con 1 de forma indefinida. Se comprueba que el mensaje y `despliegue.md` §6 dan una salida (P-6).
4. **Vaciado de D-17 (`despliegue.md` §6):** son tres `DELETE` sin transacción. Si fallara tras borrar `page_version` y antes de `page_import`, quedaría la marca sin datos: sin reimportación y la página "no disponible" en el admin nuevo y la semilla en la landing al reiniciar. Se ensaya el comando y su comprobación previa tal como están escritos (P-9) y se revisa ese caso.
5. **Comandos de §8:** dependen de que `DATA_DIR` sea `/var/lib/restaurante` (lo es en `compose.prod.yaml`), de que `changes.jsonl` esté en su raíz y de que la imagen tenga `ls` y `wc` (Alpine: sí). Se verifican en un contenedor local de la imagen `production` (P-15).
6. **Duración:** la importación corre antes de `listen`, dentro del `start_period` de 90 s; se mide con el `changes.jsonl` real (P-4).
7. **Privacidad:** los datos reales llevan nombres del personal (autores del historial y `updatedBy`) y el volcado, usuarios y hashes. Ningún informe, ticket ni chat lleva contenido: solo sumas, conteos, nombres de campos y resultados.
8. **`smoke.sh` en macOS:** `ops/backup/ci/smoke.sh` y `deploy/ci/smoke.sh` exigen GNU coreutils y `flock` (Linux), que este Mac no tiene. Si no se pueden ejecutar en un contenedor Linux local, quedan como evidencia del job `docker` del CI del PR (ver Pendientes).
9. **Orden de arranque documentado:** el Implementation Result dice "primer administrador → `hasProductImports`", pero `server.ts` ejecuta `bootstrapAdmin` después de la importación. Solo es una discrepancia del texto; se confirma que no cambia el comportamiento (instalación nueva sin usuarios).

### Pruebas funcionales y de migración (ensayo con datos reales, D-16)

1. **P-1 Copia de solo lectura:** con `ssh root@179.236.68.95`, empaquetar en solo lectura el volumen `restaurante_app-data` (`docker run --rm -v restaurante_app-data:/d:ro … tar`) y copiar el último volcado de `backups/` a `<scratchpad>/ensayo/` con permisos `700`. Sin comandos que escriban en el VPS, sin tocar contenedores. Sumas SHA-256 en el VPS y en local para comprobar la copia.
2. **P-2 Partes no de página:** script en el scratchpad que compara, por negocio, `current.json` (y `previous.json`) con `seed.json`, sin los campos de página (`PAGE_SCHEMAS`) ni las listas congeladas. Salida: "iguales" o la lista de rutas de campo distintas, nunca sus valores.
3. **P-3 Integridad de archivos:** SHA-256 de cada archivo de la copia antes y después de cada arranque del PR 3.
4. **P-4 Importación real:** base `restaurante_test_ensayo` en el MySQL local de pruebas, con el volcado cargado (y `npm run db:migrate` contra ella si el volcado es anterior a la migración de página). `api` y `landing-pages` del PR 3 con `DATABASE_URL` y `DATA_DIR` apuntando a la base y a una copia, por variables de entorno, sin tocar los `.env`. Comprobar: dos `page_import_done` con `source` `current`; `page_import` con dos filas; `page_version` igual a los JSON (valores, `revision@updatedAt`, autor) comparado por programa; `history_count` igual a las líneas válidas de cada negocio y `skipped_lines` igual a las ilegibles; logs sin ningún valor de la página ni del historial (búsqueda por programa, solo el conteo); duración del arranque y de la importación.
5. **P-5 Segundo arranque:** no reimporta, filas iguales, sin `page_json_diverged`.
6. **P-6 Casos límite sobre copias:** `current` de un negocio dañado con `previous` válido (CA-4); sin los JSON de un negocio y con los dos dañados en la base existente (CA-20, dos arranques seguidos); base nueva sin JSON (CA-5); un negocio ya marcado y el otro sin JSON (riesgo 3).
7. **P-7 CA-3:** sonda temporal en `landing-pages/tests/` con MySQL real que falla en la marca del segundo negocio; nada escrito y el reintento importa completo.
8. **P-8 CA-6:** `git worktree` temporal de `origin/main` (`4db1413`). `main` (`api` y `app`) sobre la copia real y la base del volcado: HTML de `/`, `/molotes` y `/birria`. Después, el PR 3 tras importar: mismo HTML, normalizando solo el nonce de CSP si cambia por petición.
9. **P-9 Vuelta atrás PR 3 → PR 2 → PR 3 sobre la misma base:** tras importar, una edición en el admin nuevo; volver a `main` (`api`, `inventory-manager` y `app`): "Página" no disponible, la landing con los JSON de antes, `/admin` sin aviso de dañado y escribiendo los JSON; editar un JSON desde ese `/admin`; avanzar al PR 3: sin reimportación, un `page_json_diverged`, MySQL sin cambios y la landing con MySQL. Ensayar el vaciado de §6 tal como está escrito (con la comprobación `imported = 0`, que debe dar distinto de 0 con la edición y 0 en una segunda pasada sin ediciones) y comprobar que el siguiente arranque reimporta los JSON actuales.
10. **P-10 CA-7 y CA-8:** cadena real `api` + `inventory-manager` + `app`: guardar en "Página" y ver el cambio en la siguiente visita (`confirmed`); con el aviso interno fallando, `pending` y visible en ≤ 60 s; detener la `api`: 200 con la copia buena; arrancar la `app` sin `api`: 200 con la semilla y el log.
11. **P-11 CA-13 y D-6:** `/admin/molotes` y `/admin/birria` con y sin `ADMIN_NEW_URL`, como administrador y como editor (403 en el otro negocio).
12. **P-12 CA-17:** volcado local tras la importación, una edición, restauración del volcado: la página vuelve a lo del volcado y el arranque no reimporta. `ops/backup/ci/smoke.sh` (riesgo 8).

### Pruebas negativas y casos límite

Incluidas en P-6, P-7, P-9 y P-11: JSON dañados, faltantes, marca parcial, fallo a mitad, aviso interno caído, API caída, POST sin CSRF o de otro negocio.

### Pruebas responsive y de accesibilidad

13. **P-13 Navegador (Claude in Chrome), 375×812, 768×1024 y 1440×900:** `/`, `/molotes` y `/birria` tras la importación (sin desplazamiento horizontal, CTA de WhatsApp visible sin scroll en móvil, aviso del día de hoy); `/admin/<negocio>` en solo lectura (un `h1`, jerarquía, `fieldset` deshabilitado legible, enlace con foco visible y texto significativo, sin formularios); "Página" del admin nuevo en estado neutro (`role="status"`, texto de D-14, sin formulario ni acciones).
14. **P-14 CA-14:** edición, conflicto y restauración en "Página" con teclado a 375 px y escritorio, y sin JavaScript (bloqueado para `127.0.0.1` en el navegador si la extensión lo permite; si no, flujo PRG por HTTP y revisión manual).

### Pruebas de integración (WhatsApp)

`href` del CTA en las dos landings (dominio, número y `text` codificado), `target` y `rel`, igual que en `main` (P-8 y P-13). No se sigue el enlace.

### Pruebas de performance

Duración de la importación real frente al `start_period` de 90 s (P-4); peticiones de la landing a la `api` con la caché fresca (ninguna por visita, comprobado en los logs de la `api`); consola sin errores (P-13).

### Pruebas SEO

`title`, meta description, canonical y Open Graph incluidos en la comparación byte a byte de P-8.

### Pruebas de regresión

`npm run build:css`, `npm run typecheck`, `npm run lint` (sin `lint:fix`) y `npm test` completos; avisos del día y selección de landing por la suite; `/admin` de productos, usuarios y bot sin cambios; `deploy/` sin cambios (`git diff --stat`); revisión del diff de documentación (§6, §8, §9, §11.1, `README.md`, `arquitectura.md`, `.claude/CLAUDE.md` §8).

### Pruebas de despliegue (`despliegue.md` §6 y §8)

15. **P-15:** revisión de cada comando nuevo y ejecución de su equivalente local contra la imagen `production` construida del árbol (`docker build --target production`) y el MySQL local: el `ls -l … && wc -l` de §8 dentro del contenedor con la copia montada en `/var/lib/restaurante`; el `SELECT … FROM page_import`; el `DELETE` y el `SELECT COUNT(*) … imported = 0` de §6. Nada contra producción.

### Pruebas automatizadas

- Existentes: la suite completa y la unitaria permanente `landing-pages/tests/unit/page-import.test.ts`, revisando que sus casos cubran CA-4, CA-5 y CA-20 sin reproducir la implementación.
- Sondas temporales (D-15, se borran al terminar): P-7 en `landing-pages/tests/`, y los scripts de P-2, P-3, P-4 y P-8 en el scratchpad. No quedan en el repositorio otras pruebas.

### Evidencia requerida

Códigos de salida y resúmenes de cada comando; sumas y conteos; nombres de eventos de log (sin valores); diferencias de HTML (vacías o normalizadas); capturas de navegador sin datos personales; duración medida. Ningún contenido de los JSON, del historial ni del volcado.

### Limpieza

Al terminar, también si algo falla: borrar la copia de `app-data`, el volcado, la base `restaurante_test_ensayo` y cualquier `restaurante_test*` sobrante, el `git worktree` de `main`, las imágenes y contenedores de la prueba, la sonda de P-7, los scripts y capturas; detener servidores y el MySQL local si lo levanta QA; cerrar las pestañas. Comprobado con `git worktree list`, `docker ps -a`, `lsof` de los puertos y la lista de bases.

### Criterios de aprobación

- CA-1 a CA-8, CA-13, CA-15 a CA-17, CA-19 y CA-20 en PASS con evidencia, incluidos los datos reales.
- Partes no de página iguales a la semilla en los dos negocios, o una decisión del usuario sobre cada diferencia.
- `typecheck`, `lint` y `npm test` en 0; sin regresión en landings ni en `/admin`.
- Comandos de §6 y §8 correctos en su equivalente local.
- Sin defectos `BLOCKER` ni `CRITICAL`; cada `MAJOR`, con decisión del usuario.
- Limpieza comprobada.

### Pendientes posibles

- `smoke.sh` (backup y deploy) si no corre en local: se toma el job `docker` del CI del PR como evidencia; si CA-17 dependiera solo de él, P-12 lo cubre a nivel de base.
- CA-14 sin JavaScript si la extensión no permite bloquearlo: revisión manual del usuario.

## QA Report del PR 3

### Ronda

1 (2026-11-16), sobre el árbol sin commit de `feature/REQ-F-044-pagina-en-mysql-3-corte` (76 entradas en `git status`, sin cambios al terminar). Plan aprobado: "Apruebo el plan"; `smoke.sh`: "Sí, acepto el CI (Recomendado)"; CA-14 sin JS: "Sí, revisión manual (Recomendado)". NotebookLM no disponible en la sesión: no se consultó.

### Pruebas ejecutadas

Datos reales: copia de solo lectura de `restaurante_app-data` (5 archivos: dos `current.json`, dos `previous.json` y `changes.jsonl` de 3 líneas) y del volcado `20261116T011751Z-49bcf4ac21f9.sql.gz`, en una carpeta 700 del scratchpad. El volcado es anterior a la migración de página (como en `deploy.sh`): se cargó en `restaurante_test_ensayo` del MySQL local (sin sus líneas `CREATE DATABASE`/`USE restaurante`) y se migró. Procesos reales (`node src/server.ts` con entorno explícito, sin los `.env`). Ningún contenido de datos en este informe.

| Paso | Resultado |
| --- | --- |
| Regresión | `build:css` 0, `typecheck` 0, `lint` 0, `npm test` 0: `api` 46 archivos/1.118, `landing-pages` 95/1.314 (58 s), `inventory-manager` 15/257 |
| P-1 | OK. SHA-256 de los 5 archivos y del volcado iguales en el VPS y en local. En el VPS solo `docker run --rm --network none -v …:/d:ro` (tar y sha256sum) y `scp` de lectura |
| P-2 | OK. Fuera de `hero`, `menu.highlight`, `promo` y las listas congeladas, `current` y `previous` de los dos negocios son iguales a `seed.json` (las cuatro comparaciones, "iguales") |
| P-3 | OK. SHA-256 de `app-data` igual tras el primer y el segundo arranque, y tras arrancar la imagen `production` |
| P-4 | OK. Dos `page_import_done` con `source` `current`; `page_import` 2 filas; `page_version` 4 filas iguales a los JSON en valores, revisión, `updatedAt` y autor (comparado por programa); `source_version` = `revision@updatedAt`; `history_count` = líneas válidas por negocio (1 y 2), `skipped_lines` 0; historial importado = `changes.jsonl` (negocio, fecha, autor, id, acción y cambios). 138 valores de los datos buscados en los logs: 0 apariciones. Arranque hasta `server_started`: 0,62 s (frente al `start_period` de 90 s) |
| P-5 | OK. Segundo arranque: sin `page_import_done` ni `page_json_diverged`; `CHECKSUM TABLE` de las tres tablas igual |
| P-6 | OK. CA-4: `page_import_from_previous`, vigente = `previous.json` (datos, revisión y fecha), sin anterior; el `current` dañado queda como `damaged-<fecha>.json` byte a byte (igual que `main`). CA-20 sin JSON de Birria y con los dos de Birria dañados, dos arranques cada uno: salida 1, `page_import_failed` `PAGE_IMPORT_SEED_REFUSED` (`missing`/`damaged`), 0 filas y 0 marcas, sin semilla escrita. CA-5 (base nueva, volumen vacío): `page_import_from_seed` en los dos, vigente y anterior = semilla. Riesgo 3 (Molotes marcado y Birria sin JSON): salida 1 en cada arranque con el mensaje que remite a §6; restaurando los JSON, el siguiente arranque importa Birria |
| P-7 | OK. Sonda temporal con Prisma real y los JSON reales: fallo en la marca de Birria → 0/0/0 filas; reintento → los dos importados (4/3/2). Borrada |
| P-8 | OK. `origin/main` (`4db1413`) en `git worktree` sobre la misma copia y el volcado frente al PR 3 tras importar: HTML de `/`, `/molotes` y `/birria` idéntico byte a byte (sin normalizar nada) |
| P-9 | OK. Edición en el admin nuevo → vuelta a `main` (`api`, `inventory-manager`, `app`; misma base): API 503 `PAGE_UNAVAILABLE`, "Página" sin formulario, landings iguales a antes del corte, `/admin` sin "dañado" y guardando en los JSON; tablas sin cambios. Avance al PR 3: sin reimportar, un `page_json_diverged` (Molotes), tablas iguales y la landing con lo de MySQL. §6: `COUNT(*) … imported = 0` dio 1 con la edición; en una segunda pasada sin ediciones dio 0, el `DELETE` tal como está escrito dejó 0/0/0 y el siguiente arranque reimportó los JSON actuales (datos, marca e historial iguales a los JSON) |
| P-10 | OK. CA-8: guardado → `landing=confirmed` y la siguiente visita lo muestra; con el aviso interno roto → `landing=pending` y visible a los 35,8 s (sondeo de 0,5 s). CA-7: API detenida → 200 con la última copia (`landing_page_fallback` `last_good`); arranque sin API → 200 en las tres rutas con la semilla (`landing_page_fallback` `seed`) |
| P-11 | OK. Con `ADMIN_NEW_URL`, administrador y editor: `/admin/molotes` y `/admin/birria` con valores de MySQL (no los del JSON), `fieldset` deshabilitado fuera de formularios, enlace a `<ADMIN_NEW_URL>/<negocio>/pagina`; guardar, restaurar anterior y restaurar semilla: 410 con CSRF, 403 sin CSRF, 303 al acceso sin sesión; editor en Birria: 403. Tablas y JSON sin cambios. Sin `ADMIN_NEW_URL`: guarda en MySQL (la landing lo muestra), restaurar semilla 409, restaurar anterior con la versión confirmada; JSON intactos |
| P-12 | OK a nivel de base: volcado tras la importación, edición, `DROP` y carga del volcado → tablas iguales al volcado, arranque sin `page_import_done` y la landing con lo del volcado |
| P-13 | OK (Chrome headless por CDP, porque la ventana de la extensión no baja de 606 px). 375×812, 768×1024 y 1440×900 en `/`, `/molotes` y `/birria`: sin desplazamiento horizontal, un `h1`, sin saltos de encabezado, `header`/`main`/`footer`/`nav`, CTA de WhatsApp visible sin desplazar (2 o 3), imágenes con `alt` y sin deformar, 0 errores de consola; domingo: sin aviso en `/` y "Hoy toca birria" en `/molotes`. `/admin/molotes` en solo lectura y "Página" del admin nuevo en estado neutro (texto de D-14 en `role="status"`, sin formulario ni acciones) en los tres tamaños, con capturas revisadas; enlace del `/admin` alcanzable con Tab y foco visible |
| P-14 | OK. Con teclado (Tab/Enter) a 375 px sin JavaScript (`Emulation.setScriptExecutionDisabled`), a 375 px con JS y a 1440 px con JS: acceso, edición, 409 con quién y cuándo, lo escrito conservado, "Guardar mis cambios de todos modos" y "Descartar…", confirmación y restauración; 66 pasos de Tab sin ninguno sin foco visible, sin desplazamiento horizontal. Único error de consola: el 409 esperado |
| P-15 | OK. Imagen `production` construida del árbol: el `ls -l … && wc -l` de §8 con la copia en `/var/lib/restaurante` (`DATA_DIR` de `compose.prod.yaml`) sale 0 con los tres archivos; el `SELECT … FROM page_import` de §8 y el `COUNT`/`DELETE` de §6 ejecutados con su `sh -c` en el contenedor MySQL local. La imagen arrancó sobre el volcado y la copia: dos `page_import_done` `current`, archivos intactos |
| WhatsApp, SEO, performance | `href` `https://wa.me/<número>`, `target="_blank"`, `rel="noopener noreferrer"` y `title`, canonical y Open Graph dentro de la comparación byte a byte de P-8. 20 visitas con la caché fresca: 0 peticiones de página a la `api` |
| Regresión de alcance | `git diff 4db1413 -- deploy ops packages/db/prisma landing-pages/public`: vacío. Revisados `despliegue.md` §6, §8 y §9 (ejecutados), `README.md` ("JSON dañados en la importación") y `.env.example` |

### Criterios de aceptación

| CA | Estado | Evidencia |
| --- | --- | --- |
| CA-1 | PASS | P-3, P-4 (datos reales) |
| CA-2 | PASS | P-5, P-9 |
| CA-3 | PASS | P-7 |
| CA-4 | PASS | P-6 y la unitaria permanente |
| CA-5 | PASS | P-6 |
| CA-6 | PASS | P-8 (byte a byte) y P-13 |
| CA-7 | PASS | P-10 |
| CA-8 | PASS | P-10 |
| CA-13 | PASS | P-11 |
| CA-15 | PASS | P-9 |
| CA-16 | PASS | P-9 |
| CA-17 | PASS a nivel de base (P-12); `smoke.sh` pendiente del CI | Ver Pendientes |
| CA-19 | PASS | P-4: la última entrada de cada negocio en `changes.jsonl` coincide en fecha y autor con su `current.json`, que es lo importado |
| CA-20 | PASS | P-6 |
| CA-9 a CA-12, CA-14, CA-18 | PASS | `npm test`, P-13 y P-14 (CA-14 sin JS comprobado, no queda para revisión manual) |

### Defectos encontrados

Sin `BLOCKER`, `CRITICAL`, `MAJOR` ni `MINOR`.

- **DEF-PR3-001 (TRIVIAL), documentación.** `landing-pages/.env.example` dice que los JSON "solo se leen al arrancar", pero un `current.json` dañado se renombra a `damaged-<fecha>.json` al arrancar (comportamiento previo, igual en `main` y descrito en `README.md`). Recomendación: matizarlo en el comentario.

Observaciones sin defecto: con los JSON de un negocio ausentes, el arranque negado deja la carpeta vacía del negocio (sin semilla; CA-20 se cumple). Los tres `DELETE` de §6 van sin transacción, pero repetir el comando completa un vaciado a medias. La frescura de la página sigue la regla de los productos (RF-5): un cambio `pending` se ve en la primera visita tras vencer los 60 s desde la última carga. El orden "primer administrador → `hasProductImports`" del Implementation Result no es el del código (va después de la importación), sin efecto en el comportamiento (P-6, CA-5).

### Regresión

Suite completa en verde, landings idénticas a `main` con datos reales, `/admin` de productos sin cambios (P-11 y suite), `deploy/`, `ops/`, migraciones y `public/` sin cambios.

### Responsive

Sin desplazamiento horizontal en 375, 768 y 1440 px en landings, `/admin/<negocio>` y "Página" (P-13 y P-14).

### Accesibilidad

Un `h1` y sin saltos de encabezado, landmarks, `alt`, foco visible en todos los pasos de Tab, avisos en `role="status"`/`role="alert"`, flujo completo sin JavaScript.

### UX/UI

Landings sin cambios visuales (HTML idéntico). Las capturas de `/admin` en solo lectura y del aviso neutro se revisaron y se borraron.

### Performance

Arranque con importación real: 0,62 s. Sin peticiones a la `api` por visita con la caché fresca. Sin errores de consola en las landings.

### SEO

Incluido en la comparación byte a byte de P-8.

### Pendientes de revisión manual

- **CA-17, `ops/backup/ci/smoke.sh`:** no se ejecutó en local (exige Linux con `flock` y GNU coreutils, y descargar la imagen de versitygw). Queda para el job `docker` del CI, como aceptó el usuario. **Ojo:** en `.github/workflows/ci.yml` las dos pruebas de humo solo corren en PR hacia `main`; en el PR del PR 3 hacia `epic/arquitectura` se omiten, así que la evidencia llegará con el PR de la épica a `main`.
- Antes de desplegar: las comprobaciones de `despliegue.md` §8 en el VPS.

### Limpieza

Comprobada: servidores detenidos (puertos 3100 a 3104 y 9333 a 9336 libres), Chrome headless cerrado y sus perfiles borrados, pestañas de la extensión cerradas; bases `restaurante_test_ensayo`, `_main`, `_p6`, `_p6m`, `_p9c` e `_img` borradas (no queda ninguna `restaurante_test*`); `git worktree` de `main` eliminado (`git worktree list`: solo el principal); imágenes `qa-req-f-044:production` y `:migrate` y el contenedor `qa-req-f-044-app` borrados; copias de `app-data`, el volcado, los volcados locales, scripts, logs y capturas borrados del scratchpad; la sonda de P-7 borrada; MySQL local detenido (`npm run db:down`). En el VPS no quedó ningún contenedor temporal ni archivo.

### Resultado final

QA_APPROVED

## Notas para los siguientes PR

- **DEF-001 (TRIVIAL), registrado sin corregir:** dentro de `fields`, `_csrf`, `action`, `expectedVersion` y `__proto__` se ignoran en silencio. Sin efecto en datos ni historial.
- **PR 2 (H-4):** `inventory-manager` trata los 400, 413 y 415 de la API (`INVALID_JSON`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`) como error genérico. Faltan en la tabla de endpoints: se añaden en la documentación del PR 3.
- **PR 3:** prueba de cadena completa con MySQL cuando desaparezca `cutover` (recomendación 4 de QA).

## Historial de cambios

### Versión 1

Descripción inicial. Aprobada por el usuario el 2026-11-05: "Apruebo el requisito y entran antes". Incluye las decisiones D-0 a D-9, la ampliación de RF-4 y CA-18 y CA-19, que cubren la ventana aceptada en D-9.

### Revisión técnica (2026-11-05)

`senior-fullstack` resolvió las inferencias, revisó CA-18, CA-19 y RF-4 y agregó el Technical Action Plan. Hallazgo principal: tras una vuelta atrás del PR 3, las imágenes del PR 2 encontrarían filas y habría dos escritores; se resuelve con `PAGE_CUTOVER`. Estado: `NEEDS_TECHNICAL_PLAN_APPROVAL`.

### Inicio de implementación del PR 1 (2026-11-05)

Aprobación del plan con D-10, cita textual: "si". Se agrega CA-20 y la precisión de RF-3 y CA-4. Rama `feature/REQ-F-044-pagina-en-mysql-1-api`. Estado: `IN_PROGRESS`.

### Implementación del PR 1 (2026-11-05)

Datos, contratos y endpoints de `api`, apagados con `PAGE_CUTOVER = false`. Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

### QA Action Plan del PR 1 (2026-11-05)

Implementación del PR 1 aprobada por el usuario para pasar a QA, con la aceptación registrada junto a D-10 (cita: "Lo apruebo"). `senior-qa` agrega el QA Action Plan, sin ejecutar sus pruebas. Estado: `NEEDS_QA_PLAN_APPROVAL`.

### QA del PR 1, ronda 1 (2026-11-05)

Plan aprobado por el usuario, cita textual: "Si". `senior-qa` ejecuta el plan: 2.900 pruebas en verde, 27 de 31 mutaciones detectadas, sin diferencias con `421f4e6` en `/admin` ni en las landings, y sin defectos `BLOCKER`, `CRITICAL` ni `MAJOR`. DEF-001 (`TRIVIAL`) y DEF-002 (`MINOR`) quedan registrados. Estado: `QA_APPROVED`.

### Pruebas de cobertura de QA (2026-11-05)

DEF-002 atendido solo con pruebas (recomendaciones 1 a 3 de QA); las mutaciones 20, 21, 22 y 28 se detectan ahora, comprobado en una copia temporal. `npm test`: 216 archivos y 2.908 pruebas en verde, con el fallo esperado que ya existía. DEF-001 queda registrado y H-4 anotado para el PR 2.

### Pull Request del PR 1 (2026-11-05)

PR 134 hacia `epic/arquitectura`, commit `2e59769`. CI en curso.

### Implementación del PR 2 (2026-11-05)

Pantalla "Página" en `inventory-manager`, rama `feature/REQ-F-044-pagina-en-mysql-2-pantalla`, desde `72658e2`. Se registra el CI de #135. Desviación: el aviso va sin enlace (ver `## Implementation Result del PR 2`). Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

### QA Action Plan del PR 2 (2026-11-05)

Se registra D-11 y se escribe `## QA Action Plan del PR 2`, sin ejecutar pruebas. Estado: `NEEDS_QA_PLAN_APPROVAL`.

### QA del PR 2 reducido (2026-11-05)

Se registra D-12 y se recorta el plan a la lógica. Se ejecuta la validación.

### Correcciones del PR 2 tras QA sin veredicto (2026-11-05)

Decisión del usuario: "Corrige..." y "retomalo". Se integra `epic/arquitectura` en la rama, se corrigen los 3 defectos y se reducen las pruebas de 98 a 66. Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

### QA corta del PR 2 (2026-11-05)

Aprobación del usuario: "si", a "¿Apruebas la implementación y esa QA corta?". Defectos 1 a 3 corregidos en cadena real, navegador, R-3, H-P10, C-09 y suite completa. Resultado: `QA_APPROVED`, ver "QA Report del PR 2".

### PR 2 abierto (2026-11-05)

Tras `QA_APPROVED`, se corrige en `Implementation Result` lo dicho sobre el foco de los campos, sin cambios de código. PR 2 abierto hacia `epic/arquitectura`, CI en curso.

### Implementación del PR 3 (2026-11-16)

Decisiones D-13 a D-17 registradas (aprobación del plan: "Apruebo, implementar"). Rama `feature/REQ-F-044-pagina-en-mysql-3-corte` desde `origin/main`. Importación única, landings por la API, `/admin` en solo lectura, retirada de `PAGE_CUTOVER`, texto neutro, lint y documentación. `typecheck`, `lint` y `npm test` (2.689 pruebas) en verde. Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

### QA Action Plan del PR 3 (2026-11-16)

Implementación aprobada por el usuario, cita textual: "Si". `senior-qa` escribe el "QA Action Plan del PR 3" (ensayo con datos reales en solo lectura, vuelta atrás, §6 y §8 en local), sin ejecutar pruebas ni tocar el VPS. Estado: `NEEDS_QA_PLAN_APPROVAL`.

### QA del PR 3, ronda 1 (2026-11-16)

Plan aprobado por el usuario: "Apruebo el plan"; `smoke.sh` por el CI: "Sí, acepto el CI (Recomendado)"; CA-14 sin JS: "Sí, revisión manual (Recomendado)". `senior-qa` ejecuta P-1 a P-15 con una copia de solo lectura de los datos reales: todos en OK, sin diferencias con `main` en las landings y sin defectos salvo DEF-PR3-001 (`TRIVIAL`, documentación). `smoke.sh` queda pendiente del CI del PR de la épica a `main`. Estado: `QA_APPROVED`.

### Pull Request del PR 3 (2026-11-16)

Se corrige DEF-PR3-001 en `landing-pages/.env.example` (al arrancar, un `current.json` dañado se conserva como `damaged-<fecha>.json`; los JSON ya no se reimportan). `typecheck` 0, `lint` 0 y `npm test` 0 (`api` 46/1.118, `landing-pages` 95/1.314, `inventory-manager` 15/257). Única prueba permanente nueva: `landing-pages/tests/unit/page-import.test.ts`. Commit `0562846` y PR [#147](https://github.com/orvigas/negocio/pull/147) hacia `epic/arquitectura`, que también integra en la épica el commit de documentación de #146. CA-17 (`smoke.sh`) queda para el CI del PR de la épica a `main`. CI de #147 en `pass` ([ejecución](https://github.com/orvigas/negocio/actions/runs/43795911542)). Estado: `READY_FOR_MERGE`.

## Incidencia del PR 1

El 2026-11-05, #134 se mergeó en `epic/arquitectura` sin que corrieran `calidad`, `docker`, `auditoria` ni `pruebas`. `git push && gh pr ready 134` se lanzaron seguidos, por una indicación errónea de la sesión principal: la ejecución 42122448914 (`ready_for_review`) se canceló y la 42122453025 (`fe7eeb6`) omitió las validaciones. GitHub permitió el merge con esas comprobaciones omitidas. Sin efecto en producción: un merge a la épica no despliega y `PAGE_CUTOVER` sigue en `false`.

Validación local previa al merge: `typecheck`, `lint` y `build:css` en 0, y 2.908 pruebas (`api` 1.122, `landing-pages` 1.599 con 1 fallo esperado, `inventory-manager` 187). Las mutaciones 20, 21, 22 y 28 de QA se detectan. QA no revisó las 3 pruebas añadidas tras su aprobación (DEF-002).

Decisión del usuario: "1 si, 2 si", a lanzar un PR para validar el árbol en CI y a añadir la regla a `.claude/rules/git.md`. El resultado del CI de ese PR se registra en el PR 2.

**Resultado del CI de validación:** #135, ejecución 42123270135 sobre `e7bde63`, en verde. El árbol del PR 1 queda validado en CI.

## Implementation Result del PR 2

### Rama

`feature/REQ-F-044-pagina-en-mysql-2-pantalla`, desde `epic/arquitectura` (`72658e2`) y avanzada a `c6b33d2` (#136, #137 y #138) por avance rápido, sin archivos en común ni conflictos.

### Cambios realizados

- `inventory-manager`: rutas `GET|POST /:negocio/pagina` y `GET|POST /:negocio/pagina/restaurar`, controlador `src/controllers/page.ts`, vistas `src/views/page.ts` y sus plantillas.
- Navegación: secciones "Productos" y "Página" en la cabecera del negocio (`partials/business-nav.html`, `HeaderSection` con `page`). Es el único cambio en las pantallas existentes.
- `controllers/common.ts`: `businessOf`, `postStart` e `isHttpError` pasan al kit compartido, sin cambio de comportamiento en productos ni en bot. `views/index.ts`: `errorSummary` se extrae de `productForm`.
- `session.ts`: la vuelta tras el acceso admite `/:negocio/pagina` y `/restaurar`. Lo destapó una prueba: sin esto, entrar de nuevo llevaba al inicio.
- Sin dependencias, variables ni cambios en `deploy/`, `api`, `core`, `db` ni `contracts`. `PAGE_CUTOVER` sigue en `false`.

### Criterios de aceptación

| Criterio | Estado | Evidencia |
| --- | --- | --- |
| CA-18, RF-4 | Cumplido | `page-unavailable.test.ts`. GET 200 y POST 409, `role="status"`, sin formulario ni acciones, nada escrito. Contra la API real con filas y `PAGE_CUTOVER` en `false`: mismos códigos y `pageStore` sin cambios. Una avería real sigue dando 503 común. Sin enlace: ver desviación |
| CA-9 | Cumplido contra el doble y la API real | `page-conflict.test.ts`: quién y cuándo, lo escrito intacto, "Guardar mis cambios de todos modos" y "Descartar". La sobrescritura envía `overwrite: true` |
| CA-11 | Cumplido | `page-edit.test.ts`: resumen enlazado, texto y `aria-invalid` por campo, nada escrito |
| CA-12 | Cumplido | Confirmación, `expectedVersion`, intercambio y deshacer, sin anterior 409. El doble envío da 409 y no deshace |
| CA-14 | Cumplido en Chrome real | 375 px y 1280 px sin desplazamiento horizontal, teclado y JavaScript desactivado: edición, conflicto, sobrescritura, errores y restauración. Foco sólido de 2 px en enlaces y botones; en los campos, cambio de color del borde de 1,5 px (3:1), según el QA Report (el parcial es común con productos y no cambia). QA debe repetirlo |
| RF-6, RF-7 | Cumplido | Editor limitado a sus negocios, 403 sin llamar a la API por el otro negocio |
| RF-9, H-4 | Cumplido | `page-failures.test.ts` deja 503, red y 413 tras el recorte de pruebas; 500, respuesta inválida, tiempo agotado, API anterior, 400 y 415 se comprobaron antes y siguen el mismo camino: conservan lo escrito y no afirman nada. `meta.freshness` llega a la pantalla: sin ese dato no se afirma nada de la landing |

CA-1 a CA-8, CA-13, CA-15 a CA-17, CA-19 y CA-20 son del PR 3. CA-10 ya se cubrió en el PR 1 y aquí se repite en la pantalla.

### Validaciones ejecutadas

- `npm run build:css`: correcto. `npm run typecheck`: 0. `npm run lint`: 0.
- `npm test`: `api` 1.122; `landing-pages` 1.598 más el fallo esperado que ya existía; `inventory-manager` 285, 98 de ellas nuevas. Sin fallos.
- Duración local de los archivos nuevos: `page-conflict` 0,52 s, `page-edit` 0,73 s, `page-failures` 1,65 s, `page-unavailable` 0,78 s.
- Mutaciones: 28 de 30 detectadas. La 06 no cambiaba nada. La 20 reveló una condición muerta (`!conflict` en `hasRestore`), que se eliminó.
- Sondas temporales, ya borradas: Chrome real por CDP y `inventory-manager` contra las rutas reales de `api` (almacén en memoria), con la puerta cerrada y abierta.

### Desviaciones del plan

- **Aviso sin enlace.** El plan pide enlace al `/admin` actual. `inventory-manager` vive en `RESTAURANTE_ADMIN_DOMAIN` y `/admin`, en `RESTAURANTE_DOMAIN`; no conoce el segundo y el plan prohíbe variables nuevas. Un enlace relativo daría 404 en el propio admin. CA-18 y RF-4 no exigen enlace. El texto es el del plan.
- **Frescura en la URL:** `?ok=saved&landing=confirmed|pending` en vez de `&pendiente=1`, para no afirmar que la landing está al día si falta el dato.
- **Texto de frescura:** habla solo de la landing, porque el bot no muestra estos datos.

### Archivos afectados

`restaurante/inventory-manager/`: `src/app.ts`, `src/routes.ts`, `src/session.ts`, `src/controllers/{admin,bot,common,page}.ts`, `src/views/{index,page}.ts`, `src/views/pages/page-{closed,form,restore}.html`, `src/views/partials/{header,business-nav,subnav-link,aria-current-true,page-discard,page-last-change,page-restore-form,page-restore-link}.html`, `tests/integration/page-{unavailable,edit,conflict,failures}.test.ts`, `tests/support/{api-double,api-double-bot,api-double-page,page-browser}.ts`.

### Riesgos o pendientes

- **PR 3:** `PAGE_UNAVAILABLE` también sale de una fila dañada. Tras el corte, el aviso "la edición sigue en /admin" sería falso en ese caso: hay que revisar el texto en el PR 3, al retirar `PAGE_CUTOVER`.
- Si la pantalla se cierra con un formulario abierto (vuelta atrás), el POST responde el aviso y lo escrito no se conserva: CA-18 pide no mostrar formulario.
- Con la API caída y un proceso recién arrancado, lo escrito vuelve en cajas con el nombre técnico del campo. Es feo, pero no se pierde.
- Sigue sin cubrir: cadena completa con MySQL real (recomendación 4 de QA, para el PR 3).
- DEF-001 no se corrige: `inventory-manager` retira esos campos antes de llamar a la API.
- En el navegador solo se probó Chrome.

### QA sin veredicto y correcciones (2026-11-05)

QA del PR 2 quedó **sin veredicto**. Pasaron: suite, puerta cerrada (48 de 48), edición, conflicto, carreras, permisos y redirecciones. Sin ejecutar: navegador, R-3, H-P10 y C-09.

Defectos confirmados y su corrección, en `src/controllers/page.ts`:

| Defecto | Corrección |
| ------- | ---------- |
| Restaurar: un doble envío daba 409 con "Otra persona [...] no se restauró nada [...] confirma de nuevo", y confirmar deshacía la restauración con aviso de éxito | El 409 muestra la versión vigente, sin formulario de confirmar: decidir pasa otra vez por "Restaurar versión anterior". Título: "La página cambió desde que abriste la confirmación." Sigue: "Puede ser tu propia restauración, si ya se aplicó, o un cambio posterior. Revisa la versión vigente antes de decidir: si ya se aplicó, restaurar otra vez la desharía." |
| Guardar: con la escritura aplicada y la respuesta perdida, repetir daba "Otra persona [...] no se guardó nada" | Si `updatedBy` del 409 es quien guarda: "La página ya cambió: el último cambio lleva tu nombre." y "Puede ser un guardado tuyo anterior que sí se aplicó, o un cambio desde otra pestaña." Con quién y cuándo, lo escrito y las mismas opciones de conflicto |
| Guardado correcto y GET posterior fallido: se perdía el aviso de éxito | 503 con el aviso de éxito, la frescura y "No pudimos cargar la página ahora. Inténtalo de nuevo en unos minutos." |

`overwrite` manipulado sin conflicto real (TRIVIAL): no se corrige.

Pruebas: de las 98 nuevas de este PR quedan 66, tras quitar 33 repetidas y añadir 1 del defecto de la lectura; los otros dos defectos modifican pruebas existentes. Se conservan puerta cerrada, permisos, conflicto, restauración y RF-9.

Resultado: `typecheck`, `lint` y `build:css` en 0. `npm test`: `api` 1.124, `landing-pages` 1.309, `inventory-manager` 257 (66 de `page-*`), todas en verde.

Límite: la comparación del autor es por nombre visible, lo único que trae el 409. Dos cuentas con el mismo nombre verían el texto "lleva tu nombre", que sigue siendo cierto.

## QA Action Plan del PR 2

Plan para aprobación. Todavía no se ha ejecutado ninguna prueba de este plan. El plan y el informe del PR 1 no se tocan.

### Recorte aprobado (D-12)

- **Se ejecuta:** C-01 a C-10, E, K, T, M-01, P, X, N2-01 a N2-03, F-01 a F-14, R-1 a R-3, N-01 a N-09 y la suite completa una vez, con S-P1 a S-P4. H-P1 y H-P2 son las prioritarias.
- **No se ejecuta:** mutaciones (S-P6), pruebas de `72658e2` contra el código nuevo (S-P5), diferenciales ni repeticiones de medición.
- **G-01 a G-06:** basta la suite existente en verde. **D:** basta la duración de esa pasada.
- Los puntos de abajo sobre esas pruebas quedan sin efecto. Sobre R-2, ver D-12.

### Objetivo

Comprobar con la cadena real, y no solo con dobles, que la pantalla "Página" de `inventory-manager` muestra en producción únicamente la puerta cerrada, y que detrás de la puerta edita, resuelve conflictos y restaura sin perder lo escrito ni afirmar nada falso, sin regresión en las pantallas existentes.

### Requisito bajo prueba

RF-4, RF-6, RF-7 y RF-9, con el diseño de "Frontend" del Technical Action Plan y la decisión D-11 (aviso sin enlace). Fuera: CA-1 a CA-8, CA-13, CA-15 a CA-17, CA-19 y CA-20 (PR 3). `_stich_source_/` no define esta pantalla: la referencia visual es P-4 de REQ-F-039 y el patrón de productos.

### Criterios de aceptación

| Criterio | Casos |
| --- | --- |
| CA-18, RF-4 | C-01 a C-10 |
| CA-9 | K-01 a K-05 |
| CA-10, RF-7 | P-01 a P-05 |
| CA-11 | E-03 a E-05 |
| CA-12 | T-01 a T-07 |
| CA-14 | N-01 a N-09 |
| RF-6 | E-01, E-02, E-06, E-07 |
| RF-9 | F-01 a F-14 |

### Riesgos identificados

1. Una afirmación falsa tras una escritura aplicada sin confirmación: es lo más grave que puede pasar detrás de la puerta (H-P1, H-P2).
2. La puerta solo se ha probado con el doble o con el almacén en memoria en el recorrido por `inventory-manager`.
3. La subnavegación y el refactor tocan todas las pantallas de negocio.
4. `sanitizeNext` se amplió: es una lista de redirecciones.
5. Los riesgos declarados en `## Implementation Result del PR 2` (R-1 a R-3 de este plan).

### Hipótesis por confirmar

Salen de leer el código. No son defectos hasta tener evidencia:

- **H-P1:** si un guardado se aplica pero su respuesta se pierde (tiempo agotado de 5 s), repetirlo da 409 y la pantalla dice "Otra persona cambió esta página [...]: no se guardó nada", cuando sí se guardó, y lo hizo la misma persona (`controllers/page.ts:200`). Contradiría RF-9. El doble no lo reproduce: aplica y responde a la vez.
- **H-P2:** lo mismo en el doble envío de restaurar: "Otra persona [...] no se restauró nada" (`page.ts:235`), texto que `page-conflict.test.ts:132` da por bueno.
- **H-P3:** guardado correcto y fallo en el GET del redirect: se pierde el aviso de éxito y solo se ve "Servicio no disponible".
- **H-P4:** el 413 del propio `readFormBody` (`MAX_FORM_BYTES`, `MAX_FORM_FIELDS`) no pasa por el repintado: lo escrito se pierde. Hay que medir también si la página más grande legítima, con acentos codificados, cabe en ambos límites y en los 64 KiB de la API.
- **H-P5:** con la sesión caducada o un 403 de CSRF de la API, un POST pierde lo escrito. RF-9 no lo cubre expresamente: se compara con productos antes de clasificar.
- **H-P6:** con la puerta cerrada, un POST sin `action` válida responde 400, no 409. Nada se escribe; se comprueba y, si es así, no es defecto de CA-18.
- **H-P7:** `confirmed` dice "La landing ya muestra el cambio", pero hasta el PR 3 la landing lee los JSON. Solo sería falso con la puerta abierta; hay que comprobar que producción no puede llegar ahí.
- **H-P8:** forzar `action=overwrite` con una versión vieja no debe saltarse el conflicto, y un `overwrite` sin conflicto previo registraría `overwrite_after_conflict`.
- **H-P9:** carrera mixta guardar y restaurar (sin ejecutar en el PR 1) con MySQL real: sin 503 por interbloqueo (H-2 del PR 1).
- **H-P10:** tras un repintado con nombres técnicos, cuando vuelve la API, reenviar el formulario guarda bien y sin perder saltos de línea.

### Pruebas funcionales

**Puerta cerrada, proceso real (S-P1).** Administrador y editor, sin filas y con filas en `page_version`:

- **C-01** GET `/:negocio/pagina`: 200, texto exacto del plan, `role="status"`, sin `form`, `input`, `textarea` ni enlace a restaurar.
- **C-02** GET `/:negocio/pagina/restaurar`: 200, igual.
- **C-03** POST de guardar y de restaurar, con CSRF válido: 409, mismo aviso.
- **C-04** Antes y después de todos los POST: suma de comprobación de `page_version` y recuento de `page_change` idénticos.
- **C-05** Comprobación con filas: la API real responde 503 `PAGE_UNAVAILABLE`, no los datos.
- **C-06** Otra causa (API detenida): 503 común, sin el aviso "aún no activa".
- **C-07** Sin sesión: redirige al acceso y vuelve a "Página". CSRF inválido: 403, antes de la disponibilidad.
- **C-08** POST sin `action` válida (H-P6): nada escrito.
- **C-09** El texto no da a entender avería ni pérdida de datos, y D-11 se cumple: sin enlace roto.
- **C-10** `PAGE_CUTOVER` sigue en `false`, `server.ts` no pasa `cutover` y `git diff` no toca `api`, `core`, `db`, `contracts` ni `deploy/`.

**Puerta abierta, cadena completa (S-P2).** `inventory-manager`, `api`, Prisma y MySQL de pruebas, procesos reales, en copia temporal:

- **E-01** Editar y guardar en ambos negocios: 303, aviso, MySQL con los valores, acentos y saltos de línea, autor de la sesión y una fila en `page_change` con acción `save`.
- **E-02** "Último cambio", con autor, sin autor y sin registrar (fila con `NULL`).
- **E-03** Precio inválido: 422, resumen enlazado al `id` real, texto y `aria-invalid`; nada escrito.
- **E-04** Texto de longitud máxima y máxima + 1, también con caracteres multibyte.
- **E-05** Los errores no dependen solo del color.
- **E-06** Sin acción "restaurar semilla" en ninguna pantalla.
- **E-07** `?ok=` y `?landing=` con valores desconocidos, `__proto__` y HTML: no pintan nada ni reflejan el valor.
- **K-01** Dos sesiones con la misma versión: la segunda ve 409, quién y cuándo, y lo escrito intacto.
- **K-02** "Guardar mis cambios de todos modos": MySQL queda con lo escrito y el historial con `overwrite_after_conflict`.
- **K-03** "Descartar": queda la versión vigente, sin escribir.
- **K-04** Un tercero guarda entre el conflicto y la sobrescritura: nuevo 409, sin pisar.
- **K-05** Conflicto seguido de un error de validación: conserva la opción de sobrescribir.
- **T-01** Confirmación por GET y restauración: intercambio exacto de vigente y anterior, `restore_previous` en el historial.
- **T-02** Restaurar otra vez lo deshace.
- **T-03** Sin anterior válida: 409 sin cambios y sin ofrecer el enlace.
- **T-04** Doble envío real, secuencial y en paralelo: un solo intercambio.
- **T-05** Sin `expectedVersion` o con una vieja: 409 o 422, sin cambios.
- **T-06** Otro guarda antes de confirmar: 409, sin restaurar, y la confirmación muestra la versión vigente.
- **T-07** El texto de T-04 no afirma nada falso (H-P2).
- **M-01** Carrera real: dos guardados y guardar frente a restaurar, 20 veces cada una: sin 503, sin pérdida silenciosa, una fila de historial por escritura aplicada (H-P9).

### Pruebas negativas y casos límite

**Permisos (con la puerta cerrada y abierta):**

- **P-01** Editor de Molotes en Birria: GET y POST 403 en ambas rutas, sin llamada a la API por ese negocio (traza del proxy S-P3) y sin cambios.
- **P-02** Administrador en ambos negocios.
- **P-03** La navegación del editor no muestra el otro negocio.
- **P-04** Permiso retirado con la sesión abierta: el 403 de la API no escribe ni filtra datos.
- **P-05** `/usuarios/pagina`, `/bot/pagina`, `/__proto__/pagina`, `/constructor/pagina`, `/MOLOTES/pagina`: 404, sin llamar a la API.

**CSRF, origen y lista cerrada:**

- **X-01** Sin `_csrf`, con uno ajeno o con otra sesión: 403 sin escribir.
- **X-02** `Origin` ajeno, `null` y sin `Origin`, según la regla existente: 403 antes de leer el cuerpo.
- **X-03** Campo desconocido, `updatedBy`, `authorId`, `version`, `__proto__`, `constructor`, nombre repetido y campo que falta: sin efecto en datos ni autor.
- **X-04** `action=overwrite` forzado con versión vieja (H-P8).
- **X-05** Nombre y valor de campo con HTML en todos los repintados, incluido el de nombres técnicos sin sesión comprobada: escapados.
- **X-06** Con la API caída, un POST a otro negocio no revela datos: solo devuelve lo enviado.

**`sanitizeNext`:**

- **N2-01** Valores que no deben pasar: `//evil.example`, `/\evil.example`, `https://evil.example`, `/molotes/pagina/../..//evil.example`, `/molotes/pagina\n`, `/molotes/pagina%0a`, `/molotes/pagina/`, `/molotes/pagina?x=1`, `/otro/pagina`, `/molotes/pagina/restaurar/x`, array y vacío.
- **N2-02** Los que sí: `/molotes/pagina`, `/birria/pagina`, `/molotes/pagina/restaurar`, y todas las rutas de antes del cambio.
- **N2-03** Con navegador: sesión caducada, volver a entrar y acabar en "Página", en GET y en POST.

### Pruebas de fallos (RF-9)

Con S-P3, proxy entre `inventory-manager` y la `api` real. Cada caso se ejecuta en guardar y en restaurar. Se comprueba que lo escrito sigue, que el texto no afirma ni niega la escritura, y lo que hay en MySQL:

- **F-01** 503 antes de la API. **F-02** 500. **F-03** Conexión cortada.
- **F-04** Tiempo agotado **sin** llegar a la API.
- **F-05** Tiempo agotado **con** la escritura aplicada, y repetición (H-P1, H-P2).
- **F-06** Respuesta inválida con 200.
- **F-07** 400 `INVALID_JSON`. **F-08** 413. **F-09** 415.
- **F-10** `api` anterior: 404 en las rutas de página, en GET y POST.
- **F-11** 413 propio y límite de campos (H-P4).
- **F-12** Guardado correcto y GET fallido (H-P3).
- **F-13** Sesión caducada y 403 de CSRF (H-P5).
- **F-14** `meta.freshness`: con receptor del aviso que confirma, que falla y que no responde: `confirmed`, `pending`, `pending`, con el tiempo del guardado; sin `landing` en la URL, nada se afirma. Un fallo del aviso no convierte en error una escritura aplicada (H-P7).

### Riesgos declarados

Valoración previa, por leer el código. El juicio definitivo irá en el QA Report con evidencia:

- **R-1 Fila dañada con `PAGE_UNAVAILABLE`.** Hoy no llega a producción: la puerta cerrada no lee filas. Aceptable en este PR **si** queda como trabajo obligatorio del PR 3, porque tras el corte el aviso sería falso. Caso: dañar una fila en S-P2 y registrar qué se ve y si se pierde lo escrito.
- **R-2 Lo escrito tras una vuelta atrás.** Solo ocurre con el PR 3 ya desplegado y un formulario abierto durante la vuelta atrás. Aceptable por raro, pero RF-9 ("un 503 [...] se conserva lo escrito") y CA-18 ("sin formulario") chocan. Punto 5 de abajo: lo decide el usuario. Caso: abrir el formulario con la copia de puerta abierta, cerrar la puerta y enviar.
- **R-3 API caída y proceso recién arrancado.** Aceptable si no se pierde nada, porque es un caso raro y dura lo que un despliegue. Caso: H-P10, y un repintado sin cabecera que deje salir de la pantalla.

### Pruebas responsive

Chrome headless (S-P4), en 375×812, 768×1024 y 1440×900, con la puerta cerrada y abierta: sin desplazamiento horizontal (`scrollWidth` frente a `clientWidth`) en cerrada, formulario, errores, conflicto, confirmación y aviso de fallo; textos largos sin cortes; áreas táctiles de la subnavegación y los botones.

### Pruebas de accesibilidad

- **N-01** Un solo `h1`, sin saltos de encabezado, en todas las pantallas nuevas.
- **N-02** Landmarks y `fieldset` con `legend`.
- **N-03** Solo con teclado: editar, guardar, conflicto, sobrescribir, descartar, restaurar y confirmar.
- **N-04** Foco visible, medido con el estilo calculado y captura, en enlaces, botones y campos.
- **N-05** JavaScript desactivado (`Emulation.setScriptExecutionDisabled`), con todo el flujo de N-03 y CA-14 en 375 px.
- **N-06** Contraste calculado de textos, avisos, errores, enlaces de la subnavegación y foco: 4,5:1, y 3:1 en texto grande y foco.
- **N-07** `role="status"` en la puerta cerrada, y sin `role="alert"` donde no hay error; el aviso urgente del conflicto se anuncia.
- **N-08** Enlaces del resumen de errores: mueven el foco al campo.
- **N-09** `aria-current` en la subnavegación, un único elemento marcado.

### Pruebas UX/UI

Contraste visual con productos (P-4 de REQ-F-039): tipografía, espaciado, avisos y botones. Capturas de cada estado. "Productos / Página" no desplaza ni rompe la cabecera en móvil.

### Pruebas de regresión

- **G-01** `npm test`, `npm run typecheck`, `npm run lint` y `npm run build:css`.
- **G-02** Pruebas de `72658e2` de `inventory-manager` contra el código nuevo (S-P5), para probar que no se rebajó ninguna expectativa, y revisión del `diff` de `api-double.ts` y `api-double-bot.ts`.
- **G-03** Refactor de `common.ts` y `admin.ts`: revisión del `diff` y flujos reales de productos (crear, editar, conflicto, eliminar y recuperar, mover), usuarios (crear, editar, 403 de editor), "Mi cuenta" (cambiar contraseña) y "Bot" (interruptor, bloquear), con S-P2.
- **G-04** `errorSummary` extraído: misma salida en productos con y sin campo conocido. El de `views/bot.ts` no cambió.
- **G-05** Subnavegación en cada pantalla de negocio y ausente en usuarios, cuenta y bot; `aria-current` correcto; orden de rutas sin capturar `/usuarios` ni `/bot`.
- **G-06** `/admin` y las landings no cambian: `landing-pages` sin archivos en el `diff`.

### Pruebas de performance

- **D-01** Reporte JSON de Vitest con los workers por defecto: cada archivo de `inventory-manager` por debajo de ~10 s, y los cuatro nuevos individualmente. Se comparan con 0,52, 0,73, 1,65 y 0,78 s.
- **D-02** Número de llamadas a la API por pantalla, con la traza de S-P3: sin lecturas duplicadas en el GET ni en un guardado correcto.
- **D-03** Sin JavaScript ni CSS nuevos en la pantalla; errores de consola en Chrome.

### Pruebas automatizadas

Sin pruebas permanentes nuevas: todo son sondas temporales. Si un hueco exige una prueba permanente, se indicará para `senior-fullstack`.

| Sonda | Qué hace | Dónde |
| --- | --- | --- |
| S-P1 | Puerta cerrada: `api` e `inventory-manager` reales, sin y con filas | Árbol de la rama, sin modificarlo; scripts en el scratchpad |
| S-P2 | Puerta abierta, cadena completa | Copia temporal con `PAGE_CUTOVER = true` |
| S-P3 | Proxy de fallos y traza de llamadas | Scratchpad, usado con S-P1 y S-P2 |
| S-P4 | Chrome headless por CDP, con perfil temporal | Scratchpad, sobre S-P1 y S-P2 |
| S-P5 | Pruebas de `72658e2` contra el código nuevo | Copia temporal |
| S-P6 | Mutaciones | Copia temporal |

**Base:** `restaurante_test_qa044p2_*`, con la salvaguarda de pruebas y las credenciales de `TEST_*`. Usuarios y contraseñas generados por la sonda, solo para esa base.

**Mutaciones (S-P6).** El ticket afirma 28 de 30 pero solo identifica la 06 y la 20: **no se pueden contrastar una a una**. Se usará un catálogo propio de unas 25, escrito antes de ejecutar, sobre `controllers/page.ts`, `session.ts`, `views/page.ts` y `common.ts`: `isClosed` por `503`, GET y POST de la puerta, orden de permisos, `writtenOf`, `overwrite` y su repintado, `expectedVersion`, `postedFields`, `FRESHNESS`, `SUCCESS`, `hasRestore`, cada patrón de `RETURN_PATTERNS` y cada rama de error. El informe dirá cuántas detecta la suite y cuáles sobreviven, sin presentar esa cifra como confirmación de las 28.

### Pruebas en navegador

Chrome headless con perfil temporal, sobre `127.0.0.1`: no usa el navegador ni las contraseñas del usuario. La extensión no se usa porque no baja de 1280 px. Solo Chrome.

### Evidencia requerida

Salida de cada comando, conteos antes y después en MySQL, códigos y texto por caso, capturas de cada estado y viewport (en el scratchpad, resumidas en el informe; se borran al terminar), tabla de duración y de mutaciones.

### Limpieza

Al terminar, también si algo falla: bases `restaurante_test_qa044p2_*`, procesos, puertos, Chrome headless, copias, capturas y scripts. Se comprueba con la lista de procesos, los puertos, `git worktree list` y las bases del MySQL de pruebas. Además, `git diff` de `api/src/page-cutover.ts` vacío y sin ninguna forma nueva de abrir la puerta en el repositorio. `git status` igual que al empezar, salvo este ticket.

### Criterios de aprobación

`QA_APPROVED` solo si:

1. CA-9 a CA-12, CA-14 y CA-18 pasan con evidencia, y CA-18 con la `api` real y MySQL.
2. Ninguna escritura indebida, en ningún caso de puerta cerrada, permisos, CSRF o lista cerrada.
3. Ninguna pantalla afirma algo falso sobre si se guardó (F-05, T-07) ni pierde lo escrito en los casos de RF-9.
4. Ninguna redirección abierta.
5. Suite, `typecheck` y `lint` en 0, sin regresión en productos, usuarios, "Mi cuenta" y "Bot".
6. Sin defectos `BLOCKER` ni `CRITICAL`, y los `MAJOR` aceptados por el usuario.
7. Cada archivo por debajo de ~10 s, y limpieza comprobada.

## QA Report del PR 2

### Ronda

Ronda 2 (QA corta, sobre las correcciones). Suma lo que pasó en la QA detenida: puerta cerrada (48 de 48), edición, conflicto, carreras, permisos y redirecciones. Sin mutaciones ni diferenciales, por decisión del usuario.

### Pruebas ejecutadas

Cadena real: `inventory-manager` de la rama, `api` real, proxy de fallos y MySQL 8.4 en `restaurante_test_qa044p2_1`. Puerta abierta solo en una copia temporal de `api/src` con `PAGE_CUTOVER = true`; puerta cerrada con el árbol de la rama.

| Prueba | Resultado |
| --- | --- |
| Restaurar con respuesta cortada y repetición | 503 "No pudimos confirmar el cambio [...]", solo con "Revisar la página". Repetición: 409 "La página cambió desde que abriste la confirmación", sin formulario de confirmar y sin "Otra persona". MySQL igual tras repetir |
| Doble envío de restaurar en paralelo | 303 y 409; un solo intercambio en MySQL |
| Guardado con respuesta cortada y repetición | 503 con lo escrito. Repetición: 409 "La página ya cambió: el último cambio lleva tu nombre", lo escrito intacto, sin "Otra persona" ni "no se guardó nada". Control con otra cuenta: sigue diciendo "Otra persona" |
| Guardado correcto y GET fallido | 503 con "Cambios guardados.", la frescura y "No pudimos cargar la página ahora" |
| R-3 | Proceso recién arrancado y API caída: 503, sin cabecera, 9 cajas con el nombre técnico, valores, `_csrf` y versión conservados, enlace para salir, sin desplazamiento horizontal en los 3 anchos, MySQL sin cambios. Restaurar: 503 con "Revisar la página" |
| H-P10 | Al volver la API, reenviar da 303; MySQL guarda los dos saltos de línea, `ñ`, `&`, `<b>` y 9500 centavos, con autor y acción `save` |
| C-09 | Texto sin avería ni pérdida de datos. Sin enlaces en `main`. Los 8 enlaces de la pantalla responden 200 |
| CA-18 con API real y filas | GET 200 y POST 409 con el aviso, `role="status"`, sin formulario ni acciones. Suma de `page_version` y recuento de `page_change` idénticos |
| `npm run typecheck`, `npm run lint`, `npm run build:css` | 0 |
| `npm test` | 0. `api` 1.124, `landing-pages` 1.309, `inventory-manager` 257 |

### Criterios de aceptación

| Criterio | Estado | Evidencia |
| --- | --- | --- |
| CA-9 | PASS | QA detenida, y flujo de conflicto en Chrome con teclado |
| CA-10, RF-7 | PASS | QA detenida |
| CA-11 | PASS | QA detenida; resumen enlazado en Chrome, mueve el foco al campo con y sin JavaScript |
| CA-12 | PASS | Restaurar, deshacer y doble envío en cadena real |
| CA-14 | PASS | Chrome a 375 px sin JavaScript: acceso, editar, error, conflicto, sobrescribir, descartar, restaurar y su 409, solo con teclado, sin desplazamiento horizontal |
| CA-18, RF-4 | PASS | Ver tabla |
| RF-6 | PASS | QA detenida |
| RF-9 | PASS | Defectos 1 a 3, R-3 y H-P10 |

### Defectos encontrados

Ninguno `BLOCKER`, `CRITICAL` ni `MAJOR`. Los 3 defectos de la QA detenida no se reproducen. `overwrite` manipulado sin conflicto real sigue como `TRIVIAL` no corregido.

Observaciones, sin bloqueo:

- **Foco de los campos.** No es el "foco sólido de 2 px" que dice el Implementation Result: `outline` es transparente y solo cambia el color del borde de 1,5 px. Contraste 3,26:1 con la página y 3,5:1 con el campo, sobre el 3:1 del plan, pero sutil en la captura. El parcial es común con productos y no cambia en este PR.
- **Enlaces sueltos de 17 px de alto** ("Volver a la página", "Revisar la página", "Volver al inicio", enlace del resumen). Sin objetivos cercanos, así que entran en la excepción de espaciado de WCAG 2.5.8. Cabecera, subnavegación y botones miden 44 px.

### Regresión

Suite completa, `typecheck` y `lint` en 0. `git status` igual antes y después de la suite, salvo este ticket. Sin errores en los registros de `api` e `inventory-manager`.

### Responsive

375×812, 768×1024 y 1440×900, en 18 estados con la puerta cerrada y abierta: `scrollWidth` igual a `clientWidth` en todos.

### Accesibilidad

- Un `h1` y sin saltos de encabezado en todos los estados; `main` único; todos los campos con `label`; cada `fieldset` con `legend`.
- Contraste de textos: sin incumplimientos con 4,5:1 y 3:1 en texto grande.
- `role="status"` en la puerta cerrada y en el éxito; `role="alert"` en error, conflicto y fallo.
- `aria-current="true"` único en la subnavegación, más `page` en el negocio.
- Foco de enlaces y botones: sólido de 2 px, 8,81:1 o 9,45:1. Campos: ver observación.

### UX/UI

Capturas revisadas de la puerta cerrada, el 409 de restaurar y el foco de campo a 375 px: coherentes con el patrón de productos. La subnavegación no rompe la cabecera en móvil.

### Performance

Consola sin errores de JavaScript; solo el 422 esperado de la prueba de error. Sin JavaScript ni CSS nuevos en la pantalla.

### Pendientes de revisión manual

- N2-03 (sesión caducada y vuelta a "Página") no se recorrió en Chrome; está cubierto por HTTP en `page-unavailable.test.ts` y `page-failures.test.ts`.
- Solo Chrome. La aplicación real por el proxy de Traefik queda fuera de esta QA.
- La primera pasada de navegador pidió Google Fonts, que las pantallas cargan como el resto del admin: 3 peticiones sin datos de la prueba. Después se bloquearon.

### Limpieza

Comprobado: sin procesos ni puertos 31000-31500, sin Chrome headless, base `restaurante_test_qa044p2_1` borrada y ninguna `restaurante_test*` restante, un solo worktree, scripts, copia y capturas borrados. `PAGE_CUTOVER` en `false` y sin diferencias en `api/src/page-cutover.ts`.

### Resultado final

QA_APPROVED
