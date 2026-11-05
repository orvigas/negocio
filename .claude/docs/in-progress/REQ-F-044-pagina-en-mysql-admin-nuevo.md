# REQ-F-044 — Página en MySQL y edición en el admin nuevo

## Estado

PR 1 mergeado ([#134](https://github.com/orvigas/negocio/pull/134), `9dd95b1`) sin CI completo: ver "Incidencia del PR 1". Siguiente: PR 2.

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

## Incidencia del PR 1

El 2026-11-05, #134 se mergeó en `epic/arquitectura` sin que corrieran `calidad`, `docker`, `auditoria` ni `pruebas`. `git push && gh pr ready 134` se lanzaron seguidos, por una indicación errónea de la sesión principal: la ejecución 42122448914 (`ready_for_review`) se canceló y la 42122453025 (`fe7eeb6`) omitió las validaciones. GitHub permitió el merge con esas comprobaciones omitidas. Sin efecto en producción: un merge a la épica no despliega y `PAGE_CUTOVER` sigue en `false`.

Validación local previa al merge: `typecheck`, `lint` y `build:css` en 0, y 2.908 pruebas (`api` 1.122, `landing-pages` 1.599 con 1 fallo esperado, `inventory-manager` 187). Las mutaciones 20, 21, 22 y 28 de QA se detectan. QA no revisó las 3 pruebas añadidas tras su aprobación (DEF-002).

Decisión del usuario: "1 si, 2 si", a lanzar un PR para validar el árbol en CI y a añadir la regla a `.claude/rules/git.md`. El resultado del CI de ese PR se registra en el PR 2.
