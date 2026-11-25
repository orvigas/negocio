# REQ-F-054 — Editor de recetas: línea que provoca el ciclo o la profundidad y foco tras "Añadir 10 filas"

## Estado

DONE — Pull Request #192 (https://github.com/orvigas/negocio/pull/192) mergeado en `epic/inventario` el 2026-11-25: commit `017d84d`, merge `88209c4`. Ver "Cierre".

Antecedente: READY_FOR_MERGE — QA ronda 1 `QA_APPROVED` (CA-1 a CA-11 en PASS, sin defectos).

Antecedente (QA): QA_APPROVED — ronda 1 sin defectos; OBS-1 MINOR aceptada por el usuario y OBS-2 a OBS-4 anteriores o triviales. Pendiente manual: teclado móvil y `datalist` en un dispositivo real.

## Aprobación

Aprobado por el usuario (versión 1, fecha 2026-11-25).

- Pregunta de la sesión principal: "¿Aprueba el borrador con las propuestas PV-1, PV-2, PV-4 y PV-5, y qué elige para PV-3: A o B?"
- Respuesta del usuario (cita textual): "Sí, apruebo el borrador".
- Antes, el usuario aprobó que DEF-007 y DEF-008 fueran "seguimiento aparte" de REQ-F-050 y pidió: "Empieza por el ticket de DEF-007 y DEF-008".
- **PV-3:** el usuario no eligió A o B de forma expresa. Se aplica la **opción A**, la recomendada en el borrador aprobado y su opción por defecto. El usuario puede cambiarla a la B antes de que empiece la implementación. `senior-fullstack` debe recordárselo en la revisión técnica.

## Origen

Seguimiento de dos defectos MINOR del QA del PR 3 de REQ-F-050 (recetas multinivel y costo teórico), registrados en `.claude/docs/done/REQ-F-050-recetas-multinivel-costo-teorico.md` de la rama `epic/inventario` (merge `22733f0`):

- **DEF-007:** el rechazo por ciclo (`RECIPE_CYCLE`) y por profundidad (`RECIPE_TOO_DEEP`) solo aparece en el aviso superior. La línea que lo provoca no se marca y el resumen de errores no la enlaza.
- **DEF-008:** después de "Añadir 10 filas", el foco vuelve al inicio del documento (`BODY`).

## Rama de trabajo

- El editor de recetas solo existe en `epic/inventario`. El trabajo parte de su punta, y el PR va hacia `epic/inventario` (`gh pr create --base epic/inventario`).
- Es una excepción aprobada (PV-1): `.claude/rules/git.md` nombra REQ-F-049 a REQ-F-053 para la épica, pero `git.md` no se modifica. Este ticket se incorpora a la épica como seguimiento de T2.
- El ticket se guarda en `backlog/` de `main`, que es el árbol principal. El código está en `epic/inventario`.

## Objetivo

Cerrar DEF-007 y DEF-008 para que el editor de recetas del admin (`inventory-manager`) cumpla del todo RF-13 y CA-15 de REQ-F-050 con teclado y lector de pantalla, sin añadir JavaScript.

RF-13 de REQ-F-050 (literal): "Mobile-first desde 360 px, con teclado y foco visible. Funciona sin JavaScript (filas fijas, como el plan). Errores junto a su línea y campo, que no dependen solo del color."

## Alcance

1. **DEF-007, ciclo:** marcar y enlazar la línea de la receta editada que cierra el ciclo.
2. **DEF-007, profundidad:** marcar y enlazar la línea cuya cadena de subrecetas supera el límite, cuando exista esa línea. Para ello, la respuesta `RECIPE_TOO_DEEP` incluye la cadena (PV-3 = A).
3. **DEF-008:** después de "Añadir 10 filas", dejar el foco y la vista en la primera fila nueva.

## Fuera de alcance

- OBS-10 a OBS-14 del QA de REQ-F-050 (ver "Observaciones excluidas").
- La vista previa de bruta y costo, la tabla con desplazamiento horizontal a 360 px y el `datalist` de unidades común: son decisiones del PR 3 ya aceptadas.
- Añadir JavaScript al editor.
- Cambiar los límites (40 filas y 8 niveles), los textos de validación existentes o las reglas de ciclos y profundidad.
- Marcar varias líneas por un mismo rechazo (PV-2).

## Contexto verificado (estado actual en `epic/inventario`)

- **"Añadir 10 filas" (H-3 del PR 3):**
  - es un POST al mismo `action` del formulario con `action=rows`;
  - el controlador vuelve a pintar directamente con 200, sin redirigir, sin guardar y sin validar;
  - las filas pasan de 10 a 20, 30 y 40, y en 40 el botón desaparece;
  - la primera fila nueva es la de índice igual al número de filas visibles antes de pulsar (campo oculto `rows`);
  - la única respuesta con aviso de error en esta acción es la de 503 (sesión o API no disponibles).
- **Ids de los campos:**
  - el `fieldset` de cada línea es `f-lines-N`, con N desde 0, y su leyenda es "Línea N+1";
  - el ingrediente es `lines.N.ingredient`, con ancla `#f-lines-N-ingredient`;
  - el resumen ya construye la etiqueta "Línea N+1, ingrediente".
- **Contrato actual:** 422 `RECIPE_CYCLE` con `path` (lista de nombres) y 422 `RECIPE_TOO_DEEP` solo con el mensaje ("…quedarían anidadas en 9 niveles; el máximo es 8"). La API no devuelve el índice de la línea.
- **Nombres únicos:** una receta no repite ingrediente, y el admin resuelve el nombre de cada fila con la lista de ingredientes de la API. Un nombre de la ruta identifica una sola fila.
- **Errores excluyentes:** el ciclo y la profundidad llegan con códigos propios, distintos de `VALIDATION_FAILED`. Nunca coinciden con errores de campo en la misma respuesta.
- **Profundidad:** el límite es 8 niveles y 9 se rechaza. También puede superarse por las recetas que **usan** al artículo editado; en ese caso ninguna línea de la receta editada es la culpable.
- **Foco en los avisos:** en el admin, el aviso de error lleva `role="alert"`, `tabindex="-1"` y `autofocus`, y va antes de las líneas en el documento.
- **Textos actuales:**
  - Ciclo: "La receta se contendría a sí misma: no se guardó nada.", "Ruta del ciclo: … ." y "Quita el ingrediente que cierra el ciclo. Lo que escribiste sigue en el formulario.".
  - Profundidad: el mensaje de la API más "No se guardó nada. Lo que escribiste sigue en el formulario.".

## Requisitos

- **RF-1, ciclo en su línea.** Ante un 422 `RECIPE_CYCLE`:
  - (a) el campo ingrediente de la fila culpable muestra un mensaje de error junto al campo, con `aria-invalid="true"` y asociado por `aria-describedby`;
  - (b) el resumen de errores contiene un enlace "Línea N, ingrediente: …" que lleva a ese campo;
  - (c) el aviso que recibe el foco sigue mostrando la ruta del ciclo;
  - (d) hay un único aviso de error que recibe el foco, no dos avisos con `role="alert"` compitiendo;
  - (e) no se guarda nada y se conserva todo lo escrito.
  - La fila culpable es la de la receta editada cuyo ingrediente es el **siguiente nombre de la ruta después de la receta editada**. No es el "penúltimo", como sugería el QA: eso solo vale en los ciclos de 2 nodos.
  - Si no se puede identificar la fila (ruta vacía o nombre sin coincidencia), se mantiene el comportamiento actual: aviso con la ruta y sin enlace.
- **RF-2, profundidad en su línea (PV-3 = A).**
  - Ante un 422 `RECIPE_TOO_DEEP`, la respuesta de la API incluye la cadena más profunda como lista de nombres, igual que `path` del ciclo, además del mensaje actual.
  - Si el exceso viene de una línea de la receta editada, esa línea recibe la marca y el enlace de RF-1, y el aviso conserva el mensaje con el número de niveles.
  - Si el exceso viene de las recetas que usan el artículo editado, no se marca ninguna línea y el aviso explica esa causa (texto final a definir en la implementación).
- **RF-3, foco tras "Añadir 10 filas".** Con una respuesta correcta (200), la página vuelve con el foco en el campo ingrediente de la primera fila añadida (Línea N+1), visible en pantalla en móvil y en escritorio. El siguiente Tab avanza por las filas nuevas y se conserva lo escrito.
- **RF-4, prioridad del error.** Si "Añadir 10 filas" responde con un aviso de error (503), el foco va a ese aviso y no a las filas nuevas.
- **RF-5, sin JavaScript.** RF-1 a RF-4 se cumplen con el JavaScript desactivado.

## Historias de usuario

- **HU-1:** Como gerente o administrador que edita una receta larga con teclado o lector, quiero que el rechazo por ciclo o profundidad me lleve a la línea que lo provoca, para corregirla sin buscarla entre 40 filas.
- **HU-2:** Como gerente o administrador que escribe una receta con teclado, quiero que al añadir 10 filas el foco quede en la primera fila nueva, para seguir escribiendo sin volver a tabular por todo el formulario.

## Reglas de negocio

Sin cambios. Se mantienen las reglas de ciclos, de profundidad (máximo 8 niveles) y de filas (de 10 en 10, hasta 40) de REQ-F-050.

## Decisiones aprobadas

- **PV-1:** el PR va hacia `epic/inventario` y la excepción queda anotada en este ticket, sin tocar `git.md`.
- **PV-2:** se marca la línea que la API permite identificar. La API devuelve una sola ruta por rechazo, así que se marca una línea. Si hay otro ciclo, aparecerá al guardar de nuevo.
- **PV-3 = A (opción por defecto del borrador aprobado, modificable a B antes de implementar):** se amplía `RECIPE_TOO_DEEP` con la cadena para marcar la línea, y se añade un mensaje de causa externa cuando no hay línea culpable. La opción B consistía en cubrir solo el ciclo y dejar la profundidad como limitación aceptada.
- **PV-4:** DEF-008 se resuelve con `autofocus` en el campo ingrediente de la primera fila nueva, como único mecanismo y sin fragmento en la URL.
  - Funciona sin JS.
  - Como los avisos de error van antes que las líneas, el `autofocus` del aviso tiene prioridad (RF-4).
  - Alternativa descartada: `formaction` con fragmento, que no mueve el foco real ni lo anuncia el lector.
- **PV-5:** OBS-10 a OBS-14 quedan fuera de este ticket. OBS-11 se propone como un ajuste pequeño aparte.

## Criterios de aceptación

- **CA-1, ciclo indirecto:**
  - **Given** que Salsa usa Salsa base y que en el editor de Salsa base la línea 3 tiene "Salsa".
  - **When** se guarda.
  - **Then:**
    - responde 422 y no se crea ninguna versión;
    - el foco está en un único aviso con `role="alert"` que muestra "Ruta del ciclo: Salsa base → Salsa → Salsa base" y un enlace "Línea 3, ingrediente";
    - al activar el enlace, el foco queda en `#f-lines-2-ingredient`, que tiene `aria-invalid="true"` y un mensaje de error asociado con `aria-describedby`;
    - las demás líneas no tienen `aria-invalid`.
- **CA-2, ciclo de 3 niveles:** A → B → C → A, guardando A con B en la línea 5: se marca y enlaza la línea 5 (B), no ninguna otra.
- **CA-3, ciclo directo:** con un artículo como ingrediente de sí mismo en la línea 1, se marca y enlaza la línea 1.
- **CA-4, profundidad por una línea:**
  - **Given** la cadena de intermedios de nivel 1 a 8 (8 niveles, válida).
  - **When** se guarda una receta cuya línea N añade el noveno nivel.
  - **Then:** responde 422 y no se guarda nada; la línea N recibe la marca y el enlace como en CA-1; el aviso conserva "…9 niveles; el máximo es 8".
- **CA-5, profundidad por quien usa el artículo:** si el exceso lo provocan las recetas que usan el artículo editado, no se marca ninguna línea, el aviso explica la causa y no se guarda nada.
- **CA-6, ruta no mapeable:** si la ruta o la cadena no permiten identificar una fila (p. ej., vienen vacías), el comportamiento es el actual (aviso sin enlace) y nunca hay un 500.
- **CA-7, añadir filas:**
  - **Given** el editor con 10 filas visibles y dos escritas.
  - **When** se activa "Añadir 10 filas" con Enter.
  - **Then:**
    - responde 200 con 20 filas y lo escrito conservado;
    - `document.activeElement` es `#f-lines-10-ingredient` (Línea 11);
    - el campo está dentro del viewport a 360 px y a 1280 px;
    - el siguiente Tab va a "Cantidad neta" de la Línea 11.
- **CA-8:** al pasar de 30 a 40 filas, el foco queda en la Línea 31 y el botón "Añadir 10 filas" ya no aparece.
- **CA-9:** si "Añadir 10 filas" responde 503, el foco está en el aviso de error y no en las filas.
- **CA-10:** CA-1 a CA-9 se cumplen con el JavaScript desactivado.
- **CA-11:**
  - axe con 0 violaciones en el editor con ciclo, con profundidad y tras añadir filas, a 360 y 1280 px;
  - `npm run typecheck`, `npm run lint` y `npm test` terminan en 0;
  - las pruebas permanentes se limitan a ampliar los casos existentes de ciclo, profundidad y "Añadir 10 filas" (`inventory-manager/tests/integration/inventory-recipes.test.ts` y las pruebas existentes de `RECIPE_TOO_DEEP` en la `api`), según `.claude/rules/testing.md`.

## Casos límite

- Ciclo directo, indirecto y de 3 o más niveles.
- Profundidad causada por una línea o por los artículos que usan el editado.
- Ruta o cadena vacía, o con un nombre que no coincide con ninguna fila.
- Ingrediente escrito con otras mayúsculas o espacios, resuelto con la normalización actual del nombre.
- Pasar de 30 a 40 filas, con el botón que desaparece.
- 503 durante "Añadir 10 filas".
- Recargar después de añadir filas: el navegador pide reenviar el POST, como hoy, sin guardar nada.
- Volver atrás después de añadir filas: sin cambios respecto de hoy.
- Móvil a 360 px con el editor en tarjetas.
- El 409 de conflicto de versión, que no cambia.

## Dependencias

- **El editor y el controlador de recetas de `epic/inventario`:** `inventory-manager/src/controllers/inventory-recipes.ts`, `inventory-manager/src/views/inventory-recipes.ts`, el parcial `recipe-rows-button` y los parciales `field-error`, `error-summary*` y `notice`.
- **PV-3 = A:** la respuesta `RECIPE_TOO_DEEP` con la cadena, que afecta al contrato (`packages/contracts`, incluido `admin-client.ts`), a la `api` y a `core/inventory/recipe-graph.ts`.

## Riesgos

- **Orientación de `path`:** hay que confirmar en `core/inventory/recipe-graph.ts` que la ruta del ciclo empieza siempre en la receta que se guarda. Si no es así, la fila se identifica como la del ingrediente que sigue a la receta editada dentro de la ruta.
- **`datalist`:** en algunos navegadores, enfocar un `<input list>` puede mostrar las sugerencias. QA lo verifica, y si molesta se enfoca el `fieldset` o la leyenda de la línea.
- **Tamaño del QA:** PV-3 = A toca la API y el dominio, lo que amplía el QA (regresión de CA-4 de REQ-F-050).
- **Dos avisos de error con `autofocus`:** ocurriría si la implementación no los fusiona (RF-1 d).

## Action Plan

- **Objetivo:** DEF-007 y DEF-008 cerrados, sin JavaScript.
- **Alcance y fuera de alcance:** los de las secciones anteriores.
- **Cambios requeridos:**
  1. Confirmar la orientación de `path` y, en el admin, identificar la fila culpable del ciclo.
  2. Pintar el error en esa fila y en el resumen, en un único aviso que conserve la ruta.
  3. Ampliar `RECIPE_TOO_DEEP` con la cadena (contrato, API y dominio) y aplicar en el admin la misma marca, o el mensaje de causa externa.
  4. En la respuesta de `action=rows`, poner `autofocus` en el ingrediente de la primera fila nueva.
  5. Ampliar los casos existentes de las pruebas del editor y de `RECIPE_TOO_DEEP`.
- **UX/UI:** se reutiliza el patrón de error de campo y resumen del admin. `_stich_source_/` no tiene diseño del admin y no hace falta Stitch.
- **Integraciones:** solo la `api` interna (RF-2).
- **Orden recomendado:** primero DEF-008 (solo el admin), después el ciclo (solo el admin) y al final la profundidad (contrato, API y admin). Todo en un único PR hacia `epic/inventario`.
- **Resultado esperado:** con teclado o lector se llega directamente a la línea que hay que corregir y a las filas nuevas.

## Observaciones excluidas (OBS del QA de REQ-F-050)

| Obs. | Qué es | Decisión |
|---|---|---|
| OBS-10 | El pie de tabla de la lista se ve cortado a 360 px dentro de la región desplazable | Fuera: es TRIVIAL, efecto de la decisión 2 ya aceptada, y su nombre accesible está completo. |
| OBS-11 | `field-password` solo cambia el color del borde al recibir el foco | Fuera: es anterior y no está en el editor. Se propone como ajuste pequeño aparte, delegado a `senior-fullstack`. |
| OBS-12 | Sin `next` en `/inventario/*`; búsqueda sensible a acentos; texto de página fuera de rango | Fuera: T1 se comporta igual y es de la lista de inventario. |
| OBS-13 | Las sesiones caducan al reiniciar la `api` | Fuera: es un comportamiento de diseño existente (sesiones en memoria). |
| OBS-14 | Cerrar dos veces repite `ok=closed` | Fuera: es idempotente y no es un defecto. |

## Trazabilidad

| Origen | Requisito | Historia | Criterios |
|---|---|---|---|
| RF-13 de REQ-F-050 (errores junto a su línea), DEF-007 | RF-1, RF-2 | HU-1 | CA-1 a CA-6 |
| RF-13 y CA-15 de REQ-F-050 (teclado), DEF-008 | RF-3, RF-4 | HU-2 | CA-7 a CA-9 |
| RF-13 de REQ-F-050 (sin JS) | RF-5 | HU-1, HU-2 | CA-10 |
| Definición de hecho | — | — | CA-11 |

## Revisión técnica

Revisada sobre `origin/epic/inventario` (`22733f0`), en el worktree `../Negocio-wt-054` (rama local `feature/REQ-F-054-editor-recetas-ciclo-y-foco`, sin cambios). CodeGraph solo indexa `main`, donde este código no existe: la exploración se hizo con Grep y Read dirigidos en el worktree. NotebookLM no estaba disponible como herramienta MCP en esta sesión; no se consultó.

### Hallazgos

- **H-T1, orientación de `path` (riesgo del ticket, confirmado):** `findCycle(adjacency, itemId)` empieza en `visit(itemId, [itemId])` y recorre primero `adjacency.get(itemId)`, que es la receta **propuesta** (`buildAdjacency(…, { itemId, ingredientIds })`). La ruta siempre es `[editada, ingrediente directo de la editada, …, editada]`. Por tanto, `path[1]` es siempre un ingrediente de una línea de la receta que se guarda:
  - ciclo directo: `[A, A]` → `path[1] = A` (la línea con A; CA-3);
  - indirecto: `[Salsa base, Salsa, Salsa base]` → Salsa (CA-1);
  - 3 niveles: `[A, B, C, A]` → B (CA-2). El "penúltimo" del QA daría C, que no es una línea de A: confirmado el criterio de RF-1.
  - Si hay varios ciclos, gana la primera línea en orden del formulario que cierre uno (PV-2).
  - Un nombre sin resolver llega como `#<id>` y nunca coincide con una fila: cae en CA-6.
- **H-T2, el admin no conoce el nombre del artículo al guardar:** en `save` el controlador usa `name: 'este artículo'` hasta que vuelve a pedir el detalle. Por eso la fila culpable no se busca por el nombre de la receta editada, sino como el **segundo elemento** de una ruta que empieza en la editada. La cadena de profundidad (PV-3 = A) se diseña con la misma orientación para compartir esa lógica (ver el contrato abajo).
- **H-T3, dos alertas (RF-1 d):** si el controlador solo añadiera el error de campo, el editor pintaría el resumen genérico (`errorSummary`: alerta con `autofocus`, "No se guardó nada: revisa los campos marcados.") **y** el aviso del ciclo (otra alerta con `autofocus`). Hay que fusionarlos: `errorSummary` admite un título y párrafos propios, y para el ciclo y la profundidad el aviso es ese resumen.
- **H-T4, profundidad sin línea culpable:** `recipeDepth = altura(editada) + niveles de quienes la usan`. Regla técnica propuesta para RF-2: hay línea culpable si la cadena más profunda **baja** desde la editada a otra receta (la editada tiene al menos una subreceta en esa cadena); quitar esa línea reduce la altura. Si la editada solo tiene ingredientes sin receta (altura 1), el exceso viene entero de quienes la usan y no se marca ninguna línea (CA-5).
- **H-T5, `recipeDepth` lo usa también `master-import.ts`:** no se modifica. La cadena se calcula con una función nueva que solo corre cuando ya se rechaza (sin coste en el camino correcto).
- **H-T6, cliente tolerante:** `apiErrorBodySchema` de `admin-client.ts` ya acepta `path` opcional para cualquier código, y los esquemas de zod descartan campos desconocidos. Un admin antiguo ignora los campos nuevos y un admin nuevo frente a una API antigua (sin cadena) se comporta como hoy (CA-6). No hay migración ni cambio de base de datos.
- **H-T7, DEF-008 sin conflicto de foco:** la respuesta 503 de `action=rows` sale antes de pintar las filas (comprobación de sesión), así que nunca lleva el `autofocus` de la fila; la respuesta 200 de `action=rows` nunca lleva avisos de error. Además, ante dos `autofocus`, el navegador enfoca el primero del documento, y los avisos van antes de las líneas (doble garantía de RF-4).
- **H-T8, `datalist`:** Chrome, Firefox y Safari de escritorio no abren la lista de sugerencias solo por recibir foco al cargar (se abre al escribir, con flecha abajo o al hacer clic); en móvil, `autofocus` puede no abrir el teclado (iOS lo ignora), lo que no impide el foco. Lo verifica QA. Si molestara, la alternativa del ticket (enfocar el `fieldset`, que ya tiene `tabindex="-1"`) cambiaría CA-7: el siguiente Tab iría al ingrediente y no a "Cantidad neta". Se mantiene el ingrediente.
- **H-T9, CA verificables:** todos lo son. Precisiones de lectura, sin cambiar su intención:
  - CA-7 "con Enter" significa con el foco en el botón "Añadir 10 filas" (Enter dentro de un campo envía el primer botón del formulario, "Guardar versión", como hoy).
  - CA-1 "las demás líneas no tienen `aria-invalid`" se comprueba sobre los campos de línea.
  - CA-5 se prueba con un artículo sin subrecetas usado por una cadena de 8 niveles.

### PV-3: alcance de A frente a B

| | A (aprobada por defecto) | B |
|---|---|---|
| Qué cubre | Ciclo y profundidad marcan su línea; mensaje propio cuando la causa es de quienes usan el artículo | Solo el ciclo; la profundidad sigue con el aviso actual (DEF-007 queda abierto para la profundidad) |
| Archivos de código | 9: `core/inventory/{recipe-graph,errors,recipe-repository}.ts`, `api/src/admin/inventory-recipe-routes.ts`, `contracts/{inventory-recipes,admin-client}.ts`, `inventory-manager/src/{controllers/inventory-recipes,views/inventory-recipes,views/index}.ts` | 3: los tres de `inventory-manager` |
| Pruebas y soporte | `api/tests/unit/inventory-recipes.test.ts`, `inventory-manager/tests/integration/inventory-recipes.test.ts` y el doble `api-double-recipes.ts` (profundidad mínima); opcional `api/tests/integration/admin-inventory-recipes-api.test.ts` | `inventory-manager/tests/integration/inventory-recipes.test.ts` |
| Documentación | `docs/arquitectura.md` y `README.md` (contrato y editor) | `docs/arquitectura.md` y `README.md` (editor) |
| Riesgo | Bajo-medio: cambio aditivo del contrato y una función nueva del dominio; regresión de CA-4 de REQ-F-050 y del importador (no se toca) | Bajo: solo el admin |
| Estimación | ~1 día de implementación + QA de dominio, API y admin | ~0,5 día + QA del admin |

Recomendación: **A**, como está aprobado. El coste extra es acotado (una función pura, un campo aditivo del contrato), no hay cambio de base de datos ni de compatibilidad, y deja RF-13 de REQ-F-050 cumplido también para la profundidad. B solo se justifica si se quiere reducir el QA de este ticket.

## Technical Action Plan

### Objetivo técnico

Marcar y enlazar, en un único aviso con foco, la línea que provoca un ciclo o un exceso de niveles, y dejar el foco en la primera fila nueva tras "Añadir 10 filas", sin JavaScript nuevo ni cambios de base de datos.

### Archivos o componentes afectados

Todos en el worktree de `epic/inventario` (`restaurante/`):

- `packages/core/inventory/recipe-graph.ts`: función nueva `deepestChain`.
- `packages/core/inventory/errors.ts`: `RecipeTooDeepError` con la cadena.
- `packages/core/inventory/recipe-repository.ts`: nombres de la cadena al rechazar.
- `packages/contracts/inventory-recipes.ts`: `recipeTooDeepErrorSchema` y su tipo.
- `packages/contracts/admin-client.ts`: `usedBy` opcional en el cuerpo de error y comentario de `path`.
- `api/src/admin/inventory-recipe-routes.ts`: cuerpo 422 `RECIPE_TOO_DEEP` con la cadena.
- `inventory-manager/src/controllers/inventory-recipes.ts`: fila culpable, aviso único y foco de `action=rows`.
- `inventory-manager/src/views/inventory-recipes.ts`: título y párrafos del resumen, `autofocus` de la fila.
- `inventory-manager/src/views/index.ts`: `errorSummary` con título y párrafos opcionales.
- Pruebas y soporte: `api/tests/unit/inventory-recipes.test.ts`, `inventory-manager/tests/integration/inventory-recipes.test.ts`, `inventory-manager/tests/support/api-double-recipes.ts`; opcional `api/tests/integration/admin-inventory-recipes-api.test.ts`.
- Documentación: `docs/arquitectura.md` y `README.md` de `restaurante/`.

### Cambios requeridos

#### Backend (dominio, contrato y API) — PV-3 = A

1. **`deepestChain(adjacency, itemId): { path: number[]; usedBy: number[] }`** en `recipe-graph.ts`, con la misma memoización de altura y de usuarios que `recipeDepth` (que no cambia):
   - `path`: de la editada hacia abajo, siguiendo en cada paso el ingrediente con receta de mayor altura (empate: el primero en el orden de las líneas). Incluye solo artículos con receta. `path[0]` es la editada.
   - `usedBy`: de quien usa directamente a la editada hacia arriba, siguiendo al usuario con más niveles por encima (empate: el primero).
   - Invariante: `usedBy.length + path.length === recipeDepth(...)`.
2. **`RecipeTooDeepError(depth, max, path, usedBy)`** con `path` y `usedBy` como nombres. Mismo mensaje que hoy.
3. **`recipe-repository.ts`:** al rechazar, convierte los ids a nombres con el mismo mecanismo que el ciclo (ingredientes ya leídos, el artículo y `tx.itemsByIds` de los que falten; `#<id>` si no aparece). Sin consultas en el camino correcto.
4. **Contrato:** 422 `RECIPE_TOO_DEEP` = `{ error: { code, message, path: string[], usedBy: string[] } }`. `path` tiene la misma orientación que en `RECIPE_CYCLE` (empieza en la receta que se guarda), así que la fila culpable es `path[1]` en ambos. Cambio aditivo y retrocompatible.
5. **Ruta de la API:** `RecipeTooDeepError` responde como el ciclo (`ctx.status = 422; ctx.body = …`) en lugar de `ApiHttpError`. El log `inventory_recipe_too_deep` sigue con `{ itemId, depth }`, sin nombres.

#### Frontend del admin (SSR, sin JavaScript)

6. **Fila culpable (ciclo y profundidad):** función local del controlador `culpritSlot(path, values)`. Toma `path[1]` y devuelve la primera fila no vacía cuyo ingrediente coincide con `nameKey` (la normalización actual). Devuelve `null` si `path` tiene menos de 2 nombres o ninguna fila coincide (CA-6).
7. **Ciclo con fila:** `errors = { 'lines.N.ingredient': <mensaje de campo> }`, sin el aviso actual. El resumen usa como título "La receta se contendría a sí misma: no se guardó nada." y como párrafos "Ruta del ciclo: … ." y "Quita el ingrediente que cierra el ciclo. Lo que escribiste sigue en el formulario.". Queda una sola alerta con `autofocus`: título, ruta y el enlace "Línea N, ingrediente: …" (RF-1 a, b, c, d).
8. **Profundidad con fila:** igual, con el título del mensaje de la API ("…9 niveles; el máximo es 8."), el párrafo "Cadena más larga: … ." (`usedBy` invertido + `path`) y el de "No se guardó nada…".
9. **Profundidad sin fila (causa externa, `path.length < 2` y `usedBy` no vacío):** aviso sin marca de línea con el mensaje de la API y un párrafo de causa. Texto propuesto (definitivo en la implementación, RF-2): "Las recetas que usan este artículo ya llegan al límite: … . Ninguna línea de esta receta lo provoca. No se guardó nada; lo que escribiste sigue en el formulario."
10. **Sin cadena o no mapeable:** el aviso actual, igual que hoy (CA-6).
11. **`errorSummary(errors, fields, { title?, paragraphs? })`** en `views/index.ts`, con un tercer parámetro opcional. Los productos no cambian. `RecipeEditorView` y `EditorState` ganan `errorNotice?: { title; paragraphs }`.
12. **Mensajes de campo propuestos:**
    - ciclo: "Este ingrediente cierra el ciclo: quítalo o elige otro.";
    - profundidad: "Con este ingrediente las recetas pasan de 8 niveles: quítalo o elige otro." (el 8 sale del `max` del mensaje, nunca escrito a mano).
13. **DEF-008:** en `action=rows`, el controlador pasa `focusSlot = visibleRows(values, state.rows)` (filas visibles antes de pulsar). La vista añade `['autofocus', true]` al ingrediente de esa fila solo si `focusSlot < count`. Sin fragmento ni redirección (PV-4). El 503 no lo lleva (H-T7). En el último bloque (30 → 40), el foco queda en la Línea 31 y el botón no se pinta (CA-8).

### Validaciones

- Sin entradas nuevas del usuario. `path` y `usedBy` vienen de la API interna, ya validados por zod como `string[]`, y solo se comparan o se escapan con `{{ }}`.

### Manejo de errores

- Una ruta vacía o con nombres desconocidos nunca lanza: aviso actual (CA-6).
- El 409 de conflicto y el 503 no cambian.

### Testing

Pruebas permanentes (solo funcionales, ampliando casos existentes; `.claude/rules/testing.md`):

- `api/tests/unit/inventory-recipes.test.ts`, caso "admite 8 niveles… y rechaza el noveno":
  - comprobar `path` (`Nivel 9 … Nivel 1`) y `usedBy` vacío;
  - añadir en el mismo caso la causa externa: un intermedio sin subrecetas usado por la cadena de 8; al darle receta, `path` = [él] y `usedBy` = 8 nombres; no se escribe nada.
  - El caso de ciclos ya comprueba la orientación de `path` (no cambia).
- `inventory-manager/tests/integration/inventory-recipes.test.ts`:
  - caso de ciclo (CA-4 de REQ-F-050): ampliar con ciclo indirecto en una línea distinta de la 1, `aria-invalid` y `aria-describedby` en ese ingrediente, una sola `[role="alert"]` con `autofocus`, la ruta y el enlace `#f-lines-N-ingredient`, y sin `aria-invalid` en las demás líneas; añadir en el mismo caso un ciclo directo (CA-3) y la profundidad por una línea y por causa externa (CA-4 y CA-5);
  - caso "muestra 10 filas… hasta 40": en cada paso, `autofocus` en `#f-lines-10-ingredient`, `-20-` y `-30-`, y en ningún otro elemento;
  - caso "API caída… 503": añadir `action=rows` con la API caída (`mode = 'down'`); el `autofocus` está en la alerta y no en las filas (CA-9).
- `inventory-manager/tests/support/api-double-recipes.ts` (soporte, no prueba): 422 `RECIPE_TOO_DEEP` con `path` y `usedBy` según las vigentes del doble.
- `api/tests/integration/admin-inventory-recipes-api.test.ts`: ampliar el caso de errores con `recipeTooDeepErrorSchema` solo si el archivo sigue por debajo de 20 s. Si no, la serialización de la ruta se comprueba con una sonda de QA no permanente.

No permanentes (evidencia en el ticket):

- foco real, viewport a 360 y 1280 px, Tab siguiente y `datalist` en Chrome (CA-7, CA-8, H-T8);
- axe a 360 y 1280 px (CA-11);
- JavaScript desactivado (CA-10).

Validación final: `npm run build:css` (solo si cambian clases), `npm run typecheck`, `npm run lint` y `npm test` en 0.

### Seguridad

- Los nombres de la cadena solo se pintan escapados.
- Los logs no ganan datos (sin nombres).
- No cambian el acceso, el CSRF ni la CSP.

### Performance

- `deepestChain` solo corre al rechazar, en O(V+E) sobre el grafo ya construido, con una consulta adicional como mucho (nombres que falten).
- Sin coste en el guardado correcto ni en el importador.

### Riesgos técnicos

- `datalist` o teclado móvil al recibir foco (H-T8): lo verifica QA.
- Regresión de CA-4 de REQ-F-050 (mensaje y rechazo de profundidad): se mantiene el mismo mensaje y la misma comprobación; solo se añade la cadena.
- Empates en la cadena más profunda: se resuelven por orden de líneas o de usuarios, de forma determinista; se marca una sola línea (PV-2).
- La rama local del worktree sigue `origin/epic/inventario`. En T4 el push se hace con `-u origin feature/REQ-F-054-…` y el PR con `--base epic/inventario`.

### Orden de implementación

1. DEF-008 (admin: controlador y vista) y su ampliación de pruebas.
2. Ciclo en su línea (admin: `errorSummary`, controlador y vista) y su ampliación de pruebas.
3. Profundidad: dominio, contrato y API, prueba unitaria; después el doble y el admin, y su ampliación de pruebas.
4. Documentación (`docs/arquitectura.md`, `README.md`).
5. Validaciones completas y comprobación manual o en navegador de CA-7, CA-8, CA-10 y CA-11.

### Criterios de finalización

- CA-1 a CA-11 comprobados con evidencia en `## Implementation Result`.
- `typecheck`, `lint` y `test` en 0, y limpieza de bases y procesos verificada.
- Un único PR hacia `epic/inventario` (en T4).

## Implementation Result

### Rama

`feature/REQ-F-054-editor-recetas-ciclo-y-foco`, desde `origin/epic/inventario` (`22733f0`), en el worktree `../Negocio-wt-054`. Sin commit.

### Cambios realizados

- **Dominio (`core/inventory`):**
  - `recipe-graph.ts`: `levelsOf` (altura y niveles por encima, memoizados) lo comparten `recipeDepth`, sin cambios de comportamiento, y la nueva `deepestChain` (`path` desde la receta hacia abajo y `usedBy` hacia arriba; empates por orden).
  - `errors.ts`: `RecipeTooDeepError` lleva `path` y `usedBy` por nombre; el mensaje es el mismo.
  - `recipe-repository.ts`: un único `namesOf` para el ciclo y la profundidad, que consulta solo los nombres que falten y solo al rechazar.
- **Contrato y API:**
  - `recipeTooDeepErrorSchema` en `contracts/inventory-recipes.ts`;
  - `usedBy` opcional en `admin-client.ts`;
  - la ruta responde 422 `RECIPE_TOO_DEEP` con `path` y `usedBy`;
  - el log sigue siendo `{ itemId, depth }`.
- **Admin (`inventory-manager`):**
  - `culpritSlot`: `path[1]` contra las filas escritas, con la normalización actual.
  - Ciclo y profundidad con línea: error en el campo y una sola alerta (el resumen con el título y los párrafos del rechazo, y el enlace "Línea N, ingrediente: …").
  - Causa externa (`path` de un solo nombre y `usedBy` no vacío): aviso sin marca, con el texto aprobado.
  - Sin ruta o sin coincidencia: el aviso de siempre.
  - `action=rows`: `autofocus` en el ingrediente de la primera fila nueva.
  - `errorSummary` acepta un título y párrafos opcionales; los demás usos no cambian.
- **Textos:** los cuatro aprobados, tal cual.
  - Desviación menor del plan: el 8 del mensaje de campo de profundidad sale de la constante `RECIPE_MAX_DEPTH = 8` de la vista del admin (junto a `RECIPE_MAX_ROWS = 40`, con el mismo criterio), no del mensaje de la API. El admin no importa `core` y extraer el número del texto sería frágil.
- **Documentación:** `docs/arquitectura.md` y `README.md` (contrato `RECIPE_TOO_DEEP` y comportamiento del editor).

### Criterios de aceptación

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 | Cumple | Prueba del admin (ciclo indirecto en la Línea 3: una alerta con `autofocus`, ruta, enlace `#f-lines-2-ingredient`, `aria-invalid` y `aria-describedby` solo en ese campo, sin versión). Chrome sin interfaz: Enter sobre el enlace deja el foco en `f-lines-2-ingredient` (`aria-invalid=true`, `f-lines-2-ingredient-error`; 1 campo inválido). |
| CA-2 | Cumple (dominio) | `path[1]` es siempre el ingrediente directo (`findCycle` empieza en la editada); prueba unitaria de ciclos existente (`['Base B', 'Base A', 'Base B']`). El doble del admin solo simula ciclos de 2 niveles: el de 3 niveles con la API real queda para QA. |
| CA-3 | Cumple | Prueba del admin (ciclo directo en la Línea 1: enlace `#f-lines-0-ingredient`). |
| CA-4 | Cumple | Prueba unitaria (`path` de Nivel 9 a Nivel 1, `usedBy` vacío), prueba de integración de la API (`recipeTooDeepErrorSchema`, 422 sin escritura) y prueba del admin (Línea 2 marcada y enlazada; aviso con "9 niveles; el máximo es 8" y "Cadena más larga: …"). |
| CA-5 | Cumple | Prueba unitaria (`path: ['Base ficticia']`, `usedBy` con 8 nombres, sin escritura) y prueba del admin (sin enlaces ni `aria-invalid`; aviso con la causa). |
| CA-6 | Cumple | `culpritSlot` devuelve null con ruta vacía o sin coincidencia y se pinta el aviso de siempre; nunca lanza. |
| CA-7 | Cumple | Prueba del admin (`autofocus` único en `f-lines-10-ingredient`). Chrome sin interfaz a 360 y 1280 px: foco en `f-lines-10-ingredient`, dentro del viewport; Tab va a `f-lines-10-quantity`; lo escrito se conserva. |
| CA-8 | Cumple | Prueba del admin (30 → 40: `autofocus` en `f-lines-30-ingredient`, sin botón). Chrome: foco y Tab correctos. |
| CA-9 | Cumple | Prueba del admin (`action=rows` con la API caída: 503 y el único `autofocus` es la alerta). Chrome: foco en la alerta. |
| CA-10 | Cumple | Chrome sin interfaz con JavaScript desactivado: los mismos resultados en los 28 casos (7 páginas × 2 anchos × con y sin JS). |
| CA-11 | Parcial | `typecheck`, `lint` y `test` en 0, y pruebas limitadas a ampliar casos existentes. axe no se ejecutó: no está instalado en el proyecto y no añadí dependencias. Queda para QA. Sin ids duplicados en las 7 páginas. |

### Validaciones ejecutadas

Desde `restaurante/` del worktree, con un MySQL de pruebas propio (`docker compose -p req054`, en `127.0.0.1:3307`; `restaurante-mysql-dev-1` siguió apagado):

- `npm ci --strict-allow-scripts`: 0 (0 vulnerabilidades).
- `npm run build:css`: 0.
- `npm run typecheck`: 0.
- `npm run lint`: 0 (sin avisos).
- `npm test`: 0, con tres bloques: 55 archivos y 1245 pruebas, 64 y 903, y 18 y 297, todo en verde.
- Archivos de las pruebas ampliadas:
  - `api/tests/integration/admin-inventory-recipes-api.test.ts`: 6/6 en ~0,8 s;
  - `inventory-manager/tests/integration/inventory-recipes.test.ts`: 9/9 en ~1,5 s.
- Sonda no permanente (borrada): una prueba temporal generó las páginas desde el doble, y Chrome sin interfaz, por DevTools Protocol, comprobó el foco, el viewport, el Tab y el enlace a 360 y 1280 px, con y sin JavaScript. Resultados en la tabla de CA.

### Archivos afectados

- `restaurante/packages/core/inventory/{recipe-graph,errors,recipe-repository}.ts`
- `restaurante/packages/contracts/{inventory-recipes,admin-client}.ts`
- `restaurante/api/src/admin/inventory-recipe-routes.ts`
- `restaurante/inventory-manager/src/controllers/inventory-recipes.ts`
- `restaurante/inventory-manager/src/views/{inventory-recipes,index}.ts`
- Pruebas ampliadas:
  - `restaurante/api/tests/unit/inventory-recipes.test.ts`
  - `restaurante/api/tests/integration/admin-inventory-recipes-api.test.ts`
  - `restaurante/inventory-manager/tests/integration/inventory-recipes.test.ts`
- Soporte: `restaurante/inventory-manager/tests/support/api-double-recipes.ts`
- Documentación: `restaurante/docs/arquitectura.md` y `restaurante/README.md`
- Ticket: `.claude/docs/done/REQ-F-054-editor-recetas-ciclo-y-foco.md` (en `in-progress/` durante la implementación)

### Riesgos o pendientes

- **Para QA:**
  - axe a 360 y 1280 px;
  - si el `datalist` despliega sugerencias al recibir el foco (no se puede observar en Chrome sin interfaz);
  - teclado móvil real;
  - CA-2 (ciclo de 3 niveles) contra la API real.
- **Ticket:** el archivo pasó de `backlog/` de `main` (sin seguimiento en git) a `in-progress/` de esta rama, y se borró de `main`. No hay duplicados.
- **Rama remota:** la rama local sigue `origin/epic/inventario`. En T4, el push va con `-u origin feature/REQ-F-054-editor-recetas-ciclo-y-foco` y el PR con `--base epic/inventario`.
- **Limpieza verificada:**
  - contenedor `req054-mysql-dev-1` y volumen `req054_mysql-dev-data` borrados (con él, cualquier base `restaurante_test*`);
  - sin procesos de Vitest ni de Chrome;
  - páginas, perfil de Chrome, logs y la prueba temporal borrados;
  - `git worktree list`: solo `main` y este worktree, que se conserva para QA y T4.

## QA Action Plan

Aprobación de la implementación (cita textual del usuario): "Sí, apruebo la implementación", con PV-3 = A, los cuatro textos aprobados y `RECIPE_MAX_DEPTH = 8` en la vista del admin aceptada.

Análisis hecho sobre el worktree `../Negocio-wt-054` (rama `feature/REQ-F-054-editor-recetas-ciclo-y-foco`, sin commit, base `epic/inventario` `22733f0`), con `git diff` y lecturas dirigidas: CodeGraph solo indexa `main`, donde este código no existe. NotebookLM no está expuesto como herramienta MCP en esta sesión: no se consultó.

### Objetivo

Comprobar con evidencia que DEF-007 (ciclo y profundidad en su línea, en una sola alerta) y DEF-008 (foco en la primera fila nueva) quedan cerrados, con y sin JavaScript, a 360 y 1280 px; que el contrato ampliado de `RECIPE_TOO_DEEP` es retrocompatible, y que no hay regresión en el dominio de recetas, el resto del admin ni las landings.

### Requisito bajo prueba

RF-1 a RF-5 y CA-1 a CA-11 de este ticket, sobre el Technical Action Plan aprobado (regla de la fila culpable `path[1]` de H-T1 y H-T2; causa externa de H-T4; foco de PV-4 y H-T7).

### Criterios de aceptación

| CA | Pruebas |
|---|---|
| CA-1 | F-1 (API real + admin, navegador), A-1, N-4 |
| CA-2 | F-2 (A → B → C → A contra la API real y la base de pruebas, B en la línea 5) |
| CA-3 | F-3 |
| CA-4 | F-4 (cadena de 8 Intermedios reales + noveno nivel por una línea), R-1 |
| CA-5 | F-5 (artículo sin subrecetas usado por la cadena de 8) |
| CA-6 | N-1, N-2, C-1 (API antigua) |
| CA-7 | F-6 (Enter sobre el botón; `activeElement`, viewport, Tab, lo escrito), B-1 (`datalist`) |
| CA-8 | F-7 |
| CA-9 | F-8 (API detenida durante "Añadir 10 filas") |
| CA-10 | J-1 (F-1 a F-8 con JavaScript desactivado) |
| CA-11 | A-2 (axe a 360 y 1280 px), T-1 (`typecheck`, `lint`, `test`), T-2 (revisión de las pruebas permanentes frente a `testing.md`) |

### Riesgos identificados

- **RQ-1, causa mixta de profundidad:** si el artículo editado ya está usado por una cadena que por sí sola llega al límite y además se le añade una subreceta, `path` tiene 2 nombres y se marca esa línea, pero quitarla no basta para guardar (sigue el exceso por quien lo usa). Es la regla aprobada en H-T4, pero el mensaje de campo ("Con este ingrediente las recetas pasan de 8 niveles…") puede inducir a error. Se prueba en N-5 (ver pregunta 4).
- **RQ-2, empates:** con dos líneas de la misma altura solo se marca una (PV-2); al quitarla, el siguiente guardado debe marcar la otra (N-6).
- **RQ-3, normalización:** fila escrita con otras mayúsculas o espacios (N-3).
- **RQ-4, XSS:** los nombres de `path` y `usedBy` se pintan en párrafos del aviso; el enlace del resumen usa el texto fijo del campo (N-7).
- **RQ-5, dos alertas o dos `autofocus`:** en el ciclo y la profundidad con línea, y en `action=rows` (A-1).
- **RQ-6, contrato:** la ruta de la API deja `ApiHttpError` y escribe el cuerpo a mano; comprobar forma, `Content-Type`, código y log sin nombres (I-1).
- **RQ-7, `datalist` y teclado móvil al recibir el foco** (H-T8).
- **RQ-8, `rows` manipulado:** `rows` fuera de la lista, 40 con `action=rows` o filas escritas por encima de `rows` (N-8).

### Pruebas funcionales

Entorno real (API + admin del worktree + MySQL de pruebas propio, con la semilla de desarrollo y artículos de prueba creados por el admin), roles administrador y gerente:

- **F-1 (CA-1):** Salsa usa Salsa base; en Salsa base, Salsa en la línea 3 → 422, versiones sin cambio (historial y consulta a la base), una sola `[role="alert"]` con foco al cargar, título y "Ruta del ciclo: Salsa base → Salsa → Salsa base.", enlace "Línea 3, ingrediente: …"; activar el enlace con Enter deja el foco en `#f-lines-2-ingredient`, con `aria-invalid="true"` y `aria-describedby` hacia un mensaje existente; ningún otro campo de línea con `aria-invalid`; lo escrito se conserva.
- **F-2 (CA-2):** con las recetas vigentes B → C y C → A (válidas), guardar A con B en la línea 5 y otras cuatro líneas escritas → 422, "Ruta del ciclo: A → B → C → A.", enlace y `aria-invalid` solo en `#f-lines-4-ingredient` (B), sin versión nueva.
- **F-3 (CA-3):** el artículo como ingrediente de sí mismo en la línea 1 → enlace `#f-lines-0-ingredient`.
- **F-4 (CA-4):** cadena real Nivel 1 … Nivel 8 (válida, se guarda); receta cuya línea N añade el noveno → 422, línea N marcada y enlazada, aviso con "…9 niveles; el máximo es 8." y "Cadena más larga: …".
- **F-5 (CA-5):** artículo sin subrecetas usado por la cadena de 8; al darle receta de insumos → 422, sin marca ni enlace, aviso con la causa aprobada, sin escritura.
- **F-6 (CA-7):** 10 filas, dos escritas, Enter con el foco en "Añadir 10 filas" → 200, 20 filas, lo escrito conservado, `activeElement` = `f-lines-10-ingredient`, dentro del viewport a 360 y 1280 px, Tab → `f-lines-10-quantity`.
- **F-7 (CA-8):** 30 → 40: foco en `f-lines-30-ingredient` y sin botón.
- **F-8 (CA-9):** API detenida con el editor abierto, "Añadir 10 filas" → 503 y foco en el aviso, ningún `autofocus` en filas.
- **F-9:** guardado correcto después de corregir la línea marcada (ciclo y profundidad): 303 y versión nueva.

### Pruebas negativas y casos límite

- **N-1 (CA-6):** ruta vacía, `#<id>` o nombre sin fila (doble de la API): aviso de siempre, sin enlace, sin 500.
- **N-2:** ruta con fila culpable vacía (la fila se borró antes de reenviar): sin enlace, sin 500.
- **N-3:** ingrediente culpable escrito con otras mayúsculas y espacios: se marca su fila.
- **N-4:** ciclo con varias filas escritas: solo la culpable con `aria-invalid`; ningún `aria-invalid` en cabecera.
- **N-5 (RQ-1):** causa mixta (usado por una cadena de 8 y con una subreceta propia): se registra el comportamiento observado y si quitar la línea marcada permite guardar.
- **N-6 (RQ-2):** dos líneas empatadas en altura: se marca la primera; al quitarla, el siguiente guardado marca la otra.
- **N-7 (RQ-4, XSS):** artículos con nombres `<img src=x onerror=…>`, `"><script>…` y `&amp;` en la ruta del ciclo, en la cadena y en `usedBy`: salen escapados en el HTML (comprobado con `curl`/sonda sobre el HTML, sin ejecutar el payload en Chrome).
- **N-8 (RQ-8):** `rows` = 15, 0, 50 o texto, y `rows` = 40 con `action=rows`: sin 500, sin `autofocus` fuera de rango; filas escritas por encima de `rows`: foco en la primera fila realmente nueva.
- **N-9:** 409 de conflicto, recarga del POST de `action=rows` y volver atrás: sin cambios respecto de `epic/inventario` y sin `autofocus` de fila en el 409.
- **N-10:** POST sin CSRF o de otro origen a `action=rows` y al guardar: 403 como hoy; rol editor: 403 sin pedir nada a la API.

### Pruebas responsive

360×800 (mínimo de RF-13 de REQ-F-050) y 1280×900 (los anchos de CA-7 y CA-11), más 375×812, 768×1024 y 1440×900 del procedimiento estándar: alerta, enlace del resumen, campo marcado y fila con foco visibles y sin overflow horizontal fuera de la región desplazable ya aceptada.

### Pruebas de accesibilidad

- **A-1:** exactamente una `[role="alert"]` y un `autofocus` por página (ciclo, profundidad con línea, causa externa, 422 de campo, `action=rows` 200 y 503); ids únicos; `aria-describedby` apunta a ids existentes; el mensaje de campo no depende solo del color (texto); foco visible en el enlace del resumen y en el ingrediente enfocado.
- **A-2 (CA-11):** axe-core con 0 violaciones en 6 estados (ciclo con línea, profundidad con línea, causa externa, tras añadir filas 10 → 20, 30 → 40 y 503) a 360 y 1280 px. Respaldo si axe no puede cargarse en el navegador: axe-core en jsdom sobre el mismo HTML (sin reglas de color ni de viewport, lo que se indicará).
- **A-3:** orden de lectura y anuncio: el título de la alerta, la ruta o cadena y el enlace en el orden del documento (árbol de accesibilidad de Chrome).

### Pruebas UX/UI (vs. _stich_source_/)

No aplica la comparación con `_stich_source_/` (no hay diseño del admin, Action Plan). Se comprueba la coherencia con el patrón existente de error de campo y resumen del admin, y que los cuatro textos aprobados aparecen literalmente.

### Pruebas de integración

- **I-1 (RQ-6):** `POST` real a la API: 422 `RECIPE_TOO_DEEP` con `{ error: { code, message, path, usedBy } }`, validado con `recipeTooDeepErrorSchema`, `Content-Type` JSON, y log `inventory_recipe_too_deep` solo con `itemId` y `depth`; `RECIPE_CYCLE` sin cambios.
- **C-1 (retrocompatibilidad):** admin nuevo contra la API de `22733f0` (cuerpo sin `path` ni `usedBy`): aviso de siempre (CA-6). Admin de `22733f0` contra la API nueva: ignora `path`/`usedBy` y pinta el aviso con el mensaje, sin 500. Ver pregunta 3.

### Pruebas de performance

- **P-1:** el guardado correcto no hace consultas nuevas (revisión del diff y log de consultas de la sonda de dominio si hace falta); al rechazar, como mucho una consulta de nombres. Tiempo del 422 de profundidad con la cadena de 8 (sin umbral; solo evidencia).
- **P-2:** errores en la consola del navegador: ninguno.

### Pruebas SEO

No aplica: el admin no es indexable y no cambia.

### Pruebas de regresión

- **R-1:** CA-4 de REQ-F-050 (ciclos y profundidad), idempotencia (guardar sin cambios no crea versión), doble envío, 409, límite de 40 filas y validación de líneas: suites existentes + F-9 y N-9.
- **R-2:** `master-import.ts` usa `recipeDepth`, que se refactorizó (`levelsOf`): sus pruebas en verde.
- **R-3:** `errorSummary` con el tercer parámetro: los demás usos (productos, página, usuarios, inventario T1, cotizador) siguen con el título genérico; prueba en navegador de un 422 de campo en productos y en el editor de recetas.
- **R-4:** recorrido de humo del resto del admin (productos, página, usuarios, cuenta, bot, cotizador) y de las landings (`/`, `/molotes`, `/birria`): sin errores ni cambios visibles.
- **R-5:** `npm test` completo de las tres apps y paquetes.

### Pruebas automatizadas

- Existentes: `npm run build:css`, `npm run typecheck`, `npm run lint` y `npm test`; tiempos de `inventory-manager/tests/integration/inventory-recipes.test.ts` y `api/tests/integration/admin-inventory-recipes-api.test.ts` (menos de 20 s).
- **T-2:** las pruebas permanentes del diff solo amplían casos existentes (CA-11) y no hay sondas, sufijos `qa-req-f-*` ni pruebas de arquitectura.
- Sondas temporales (no permanentes, se borran; pregunta 1): N-1, N-2, N-7, N-8 y C-1 en el admin con el doble de la API; I-1 y P-1 en la `api`; respaldo de axe en jsdom.
- Mutaciones (en una copia temporal, no en el worktree): `path[1]` → `path[path.length - 2]`, quitar el `autofocus` de la fila y `external` siempre falso; las suites ampliadas deben fallar en cada una.

### Pruebas en navegador

Claude in Chrome contra `127.0.0.1` para F-1 a F-9 (pestaña nueva, cerrada al terminar). Si no puede fijar 360 y 1280 px o desactivar JavaScript, Chrome sin interfaz con DevTools Protocol (emulación de viewport y `Emulation.setScriptExecutionDisabled`), como en el QA del PR 3. No se pulsa nada que abra diálogos ni se renderiza el payload XSS.

### Entorno

- MySQL de pruebas propio: `docker compose -p req054qa` con el `compose.yaml` del worktree, en `127.0.0.1:3307`; antes se comprueba que `restaurante-mysql-dev-1` está apagado y sigue así. La base de la app es una base desechable dentro de ese contenedor (migraciones y `inventory:seed-dev`); `npm test` usa sus `restaurante_test*`.
- API y admin del worktree con `.env` en el scratchpad (`--env-file`), puertos libres (p. ej. 3111, 3114 y 3113), `NODE_ENV=development`, usuarios ficticios (administrador, gerente y editor) creados con `admin:recover` en esa base; sin tocar los `.env` del repositorio.
- Credenciales de prueba generadas en la sesión, no se repiten en el informe.

### Evidencia requerida

Salidas y códigos de salida de los comandos; HTML relevante (alerta, enlace, campo marcado, `autofocus`) por caso; `activeElement`, `getBoundingClientRect` y viewport por caso y ancho; resultado de axe por estado y ancho (violaciones = 0 o el detalle); cuerpo JSON de la API y línea de log; recuento de versiones antes y después de cada rechazo; resultado de mutaciones y de retrocompatibilidad; comprobación final de limpieza.

### Limpieza

Al terminar (también si falla): detener API, admin y Chrome sin interfaz; cerrar la pestaña; `docker compose -p req054qa down -v` (contenedor, volumen y bases); borrar el worktree temporal de `22733f0` si se crea, las copias de mutación, sus `node_modules`, las sondas, los `.env` y capturas del scratchpad. Se verifica con `docker ps -a`, `docker volume ls`, `lsof -i` de los puertos, `ps` (Vitest, node, Chrome), `git worktree list` y `git status` del worktree (solo los cambios del desarrollador y el ticket).

### Criterios de aprobación

- CA-1 a CA-11 en PASS con evidencia (CA-2 contra la API real; CA-11 con axe ejecutado o, si no se puede en navegador, con su respaldo y la decisión del usuario).
- `typecheck`, `lint` y `npm test` en 0; archivos ampliados por debajo de 20 s.
- Sin BLOCKER ni CRITICAL; los MAJOR, con decisión del usuario.
- Sin regresión en recetas (R-1, R-2), el resto del admin y las landings; retrocompatibilidad en ambos sentidos.
- Limpieza verificada.

### Preguntas y autorizaciones abiertas

1. **Sondas fuera de `landing-pages/tests/`:** el rol de QA solo permite escribir en `restaurante/landing-pages/tests/`, pero este ticket toca la `api` y el admin. ¿Autoriza sondas temporales en `restaurante/inventory-manager/tests/` y `restaurante/api/tests/`, que se borran al terminar y no se commitean? Recomendación: sí.
2. **axe-core:** no está en el proyecto. ¿(A) cargarlo desde cdnjs en una versión fija, solo en la pestaña o el Chrome sin interfaz de prueba, desactivando la CSP solo ahí (como la vez anterior), o (B) descargar el paquete del registro de npm al scratchpad e inyectarlo desde ahí? En ambos casos, respaldo en jsdom. Recomendación: A, por precedente y porque no toca el proyecto.
3. **Retrocompatibilidad de punta a punta:** ¿autoriza un worktree temporal de `22733f0` en el scratchpad con `npm ci --strict-allow-scripts` para cruzar admin y API de versiones distintas? Alternativa más barata: validar el cuerpo nuevo con el esquema antiguo (`git show`) y el cuerpo antiguo con el doble en el admin nuevo. Recomendación: el worktree temporal, con la alternativa como respaldo si `npm ci` falla.
4. **Causa mixta (RQ-1):** si se confirma que se marca una línea cuya retirada no basta para guardar, ¿se registra como observación MINOR no bloqueante (la regla de H-T4 está aprobada) o como ambigüedad que pide decisión antes de aprobar? Recomendación: observación MINOR y, si el usuario quiere cambiarlo, un ajuste aparte.
5. **Teclado móvil y `datalist` en un dispositivo real** (iOS o Android): no se pueden validar desde aquí. ¿Acepta que queden como revisión manual pendiente, sin bloquear, dado que CA-7 se mide con el foco y el viewport? Recomendación: sí.

## QA Report

### Ronda

1. El usuario aprobó el plan con "Sí, apruebo el plan" y aceptó las cinco recomendaciones: (1) sondas temporales, (2) axe opción A, (3) worktree temporal de `22733f0`, (4) RQ-1 como MINOR no bloqueante y (5) dispositivo real pendiente sin bloquear. La ejecución se interrumpió una vez por un límite de uso de la API. Al retomarla comprobé que el entorno estaba intacto (contenedor `req054qa`, API y admin vivos y `git status` sin cambios) y no repetí lo que ya estaba hecho.

### Pruebas ejecutadas

Todo se hizo en el worktree `../Negocio-wt-054`, desde `restaurante/`. El diff de producción no cambió durante el QA: `git diff` es idéntico al del inicio.

- **Entorno:**
  - MySQL propio con `docker compose -p req054qa` en `127.0.0.1:3307`. `restaurante-mysql-dev-1` siguió apagado todo el tiempo.
  - Base desechable con `prisma migrate deploy` e `inventory:seed-dev` (22 artículos y 3 recetas).
  - API (3111/3114) y admin (3113) del worktree, con `.env` en el scratchpad.
  - Usuarios ficticios: `qa-admin` (por bootstrap), `qa-gerente` y `qa-editor` (Molotes), con una contraseña generada en la sesión.
  - Datos de prueba creados por el admin: QA Salsa base y QA Salsa; QA A, B y C; una cadena QA Nivel 1…8 sobre QA Base libre (sin receta); QA Nivel 8b; QA Nueve, QA Empate, QA Filas, QA Directo y tres artículos con nombres de marcado (XSS).
- **Comandos:**
  - `npm run build:css`: 0.
  - `npm run typecheck`: 0.
  - `npm run lint`: 0 (883 archivos sin datos privados, sin avisos).
  - `npm test`: 0, en tres bloques: 55 archivos y 1245 pruebas; 64 y 903; 18 y 297.
- **Archivos ampliados:** `inventory-manager/tests/integration/inventory-recipes.test.ts`, 9/9 en 1,35 s. `api` (unitaria e integración de recetas), 24/24 en 0,82 s. Los dos, muy por debajo de 20 s.
- **Funcionales contra la API real:** un cliente HTTP con cookies y CSRF reales. Cuento las versiones y las líneas de receta en la base antes y después de cada rechazo.
- **Chrome sin interfaz por CDP:**
  - Configuraciones: 360×800 y 1280×900, con y sin JavaScript (`Emulation.setScriptExecutionDisabled`).
  - Que el JavaScript queda realmente desactivado lo comprobé con el efecto de `submit-guard`: `aria-busy` vale `true` con JS y `null` sin JS.
  - Teclado real (`Input.dispatchKeyEvent`): Enter sobre los botones, Tab y Enter sobre el enlace del resumen.
  - axe-core 4.10.2: el archivo fijo se descargó de cdnjs y se evaluó solo en ese Chrome de prueba, por DevTools. No hizo falta desactivar la CSP.
- **Claude in Chrome contra 127.0.0.1:** comprobación visual del foco, de la alerta y del `datalist`. La ventana no se pudo redimensionar (se quedó en 606 px de ancho), así que los anchos de CA-7 y CA-11 se midieron con CDP, como prevé el plan.
- **Sondas temporales, todas fuera del repositorio** (en el scratchpad, y ya borradas):
  - el cliente HTTP;
  - una sonda directa a la API (I-1);
  - un proxy hacia la API real que reescribe `path` y `usedBy` del 422 (N-1 y N-2);
  - CDP.
  - No hizo falta escribir en `inventory-manager/tests/` ni en `api/tests/`.
- **Retrocompatibilidad:** worktree temporal de `22733f0` con `npm ci --strict-allow-scripts` (0 vulnerabilidades) y `db:generate`. Crucé el admin antiguo con la API nueva y el admin nuevo con la API antigua, sobre la misma base.
- **Mutaciones:** en esa copia temporal, con el diff aplicado; cada una aislada y restaurada, y la copia verificada idéntica.

### Criterios de aceptación

| CA | Resultado | Evidencia |
|---|---|---|
| CA-1 | PASS | 422, versiones y líneas sin cambio. Una sola `role=alert` con el foco al cargar: "Ruta del ciclo: QA Salsa base → QA Salsa → QA Salsa base." y el enlace "Línea 3, ingrediente: Este ingrediente cierra el ciclo: quítalo o elige otro.". Tab desde la alerta llega al enlace (`:focus-visible`, contorno de 2 px) y Enter deja el foco en `f-lines-2-ingredient`, con `aria-invalid="true"` y `aria-describedby="f-lines-2-ingredient-error"` (texto "⚠Error: …"). Ningún otro campo inválido. Igual en los 4 anchos y modos y con el rol gerente. |
| CA-2 | PASS | Con la API real y la base de prueba: con B → C y C → A vigentes, al guardar A con B en la línea 5 (y otras cuatro líneas escritas) la respuesta es 422 con "Ruta del ciclo: QA A → QA B → QA C → QA A.". Solo `f-lines-4-ingredient` queda inválido y enlazado, y no se crea ninguna versión. |
| CA-3 | PASS | Ciclo directo en la Línea 1: enlace y foco en `f-lines-0-ingredient`, sin versión nueva. |
| CA-4 | PASS | Cadena real de 8 niveles guardada (303). QA Nueve con QA Nivel 8 en la línea 2: 422 con "Las recetas quedarían anidadas en 9 niveles; el máximo es 8." y "Cadena más larga: QA Nueve → QA Nivel 8 → … → QA Nivel 1.". Enlace y `aria-invalid` en `f-lines-1-ingredient`, con el mensaje de campo aprobado. Sin escritura. |
| CA-5 | PASS | QA Base libre (usada por la cadena de 8) con una receta de insumos: 422, sin enlaces ni `aria-invalid`. El aviso dice el texto aprobado: "Las recetas que usan este artículo ya llegan al límite: QA Nivel 8 → … → QA Base libre. Ninguna línea de esta receta lo provoca…". Sin escritura. |
| CA-6 | PASS | Con el proxy, en 9 variantes (ciclo con `path` vacío, ausente, `#999`, nombre sin fila o un solo nombre; profundidad sin `path`/`usedBy`, vacíos, nombre sin fila o un solo nombre sin `usedBy`): siempre 422, una alerta, ningún enlace ni `aria-invalid` y nunca un 500. Con la API antigua (sin cadena), la profundidad cae en el aviso de siempre. |
| CA-7 | PASS | Enter sobre "Añadir 10 filas": 200, 20 filas y lo escrito se conserva (`Jitomate\|2\|Cebolla`). `activeElement` = `f-lines-10-ingredient`, dentro del viewport y sin desbordamiento horizontal, a 360 y 1280 px y con y sin JS. Tab lleva a `f-lines-10-quantity`. El paso 20 → 30 enfoca `f-lines-20-ingredient`. |
| CA-8 | PASS | De 30 a 40 filas: foco en `f-lines-30-ingredient`, Tab a `-30-quantity` y el botón ya no aparece (4 configuraciones). |
| CA-9 | PASS | Con la API detenida, Enter sobre "Añadir 10 filas" da 503. El foco está en la alerta "Servicio no disponible…", el único `autofocus` es el aviso, ninguna fila lo lleva y lo escrito se conserva (4 configuraciones y HTTP). |
| CA-10 | PASS | CA-1 a CA-5 y CA-7 a CA-9, repetidos con el JavaScript desactivado (comprobado) a 360 y 1280 px: los mismos resultados. CA-6 se comprobó por HTTP, que es el comportamiento sin JS. |
| CA-11 | PASS | axe 4.10.2 da 0 violaciones en 8 estados (filas 10 → 20, 20 → 30 y 30 → 40; ciclo en CA-1, CA-2 y CA-3; profundidad con línea; causa externa; 503) a 360 y a 1280 px. `typecheck`, `lint` y `test` terminan en 0. Las pruebas permanentes solo amplían casos existentes (tres archivos de prueba y el soporte del doble), sin sondas ni sufijos `qa-req-f-*`. |

### Defectos encontrados

Ninguno.

Observaciones, que no son defectos de este ticket:

- **OBS-1 (MINOR, RQ-1 confirmado; no bloquea, por decisión del usuario):**
  - Escenario: QA Base libre, usada por la cadena de 8, recibe una receta con QA Salsa base (una subreceta) en la línea 2.
  - Resultado: 422 con "10 niveles", y la línea 2 se marca con "Con este ingrediente las recetas pasan de 8 niveles…".
  - Al quitar esa línea sigue el 422 (9 niveles), ahora con el aviso de causa externa y sin marca. Se marcó una línea cuya retirada no basta.
  - Es la regla aprobada en H-T4; el siguiente guardado orienta bien. Si se quiere mejorar, es un ajuste aparte.
- **OBS-2 (TRIVIAL, patrón existente):** tras activar el enlace del resumen, el navegador lleva el campo al borde superior. La leyenda "Línea N" y la etiqueta "Ingrediente" quedan fuera de la vista, aunque el foco, el mensaje y su anuncio son correctos. Pasa igual con todos los enlaces del resumen de errores del admin; no lo introduce este ticket.
- **OBS-3 (anterior, sin impacto):** `action=rows` con un `_csrf` inválido responde 200 y repinta. Comprobado igual en el admin de `22733f0`. No escribe nada, un origen ajeno recibe 403, y guardar con un CSRF inválido o vacío da 403 sin escritura.
- **OBS-4 (anterior):** la consola muestra un bloqueo de la CSP para el `preconnect` a `fonts.googleapis.com` del `layout.html` del admin, que este diff no toca. No hay otros errores de consola, salvo los registros de red de los 422 y 503 esperados.

### Regresión

- **CA-4 de REQ-F-050:** 8 niveles se guardan y 9 se rechazan. Los ciclos directo, indirecto y de 3 niveles se rechazan sin escritura.
- **Empates (N-6):** se marca la primera línea (Línea 2, QA Nivel 8). Al quitarla, el siguiente guardado marca la Línea 4 (QA Nivel 8b).
- **Mayúsculas y espacios (N-3):** `"  qa SALSA  "` en la Línea 4 se marca correctamente.
- **409:** sin cambios (aviso de conflicto, ningún `autofocus` de fila ni `aria-invalid`, sin escritura).
- **Idempotencia:** guardar sin cambios da `ok=unchanged` sin versión nueva; el doble envío con el mismo `requestId` crea una sola versión.
- **Límite de filas:** 41 líneas dan 400 (lista cerrada de campos). `rows` manipulado (15, 0, 50, texto) se normaliza a 10 → 20 sin 500. `rows=40` con `action=rows` no añade foco. Una fila escrita por encima de `rows` no recibe foco porque no hay fila nueva.
- **Permisos y CSRF:**
  - el gerente ve la misma marca y el mismo foco;
  - el editor recibe 403 en el editor y en `action=rows`;
  - un origen ajeno recibe 403;
  - un CSRF inválido o vacío al guardar da 403 sin escritura.
- **XSS:** con nombres `QA <img src=x onerror=alert(1)>`, `QA "><script>alert(2)</script>` y `QA <svg onload=alert(3)>` en la ruta del ciclo y en la "Cadena más larga", el HTML no contiene el marcado sin escapar: aparece escapado. Los enlaces usan el texto fijo del campo.
- **`errorSummary` con su título genérico:** "No se guardó nada: revisa los campos marcados." en el 422 de usuarios y de artículos, con una alerta. El intento con productos devolvió 404 por cómo la sonda leía el formulario, no por la app; lo sustituí por esos dos usos.
- **`recipeDepth` refactorizado:** `npm test` en verde, incluido `api/tests/unit/inventory-import.test.ts`, que cubre el importador maestro que lo usa.
- **Resto del admin:** 200, sin alertas ni `autofocus` inesperados, en `/`, productos y página de Molotes y Birria, usuarios, cuenta, bot, cotizador, artículos, recetas, categorías y la ficha y la receta de un artículo.
- **Landings** (servidor del worktree contra la API): `/`, `/molotes` y `/birria` dan 200, con su `<title>` y sus enlaces de WhatsApp.
- **Retrocompatibilidad:**
  - El admin de `22733f0` con la API nueva: ciclo y profundidad (por línea y por causa externa) con 422, una alerta y el aviso de siempre. Ignora `path`/`usedBy` de la profundidad y no da 500.
  - El admin nuevo con la API de `22733f0`: el ciclo se marca y enlaza (Línea 3), y la profundidad cae en el aviso sin enlace (CA-6). Sin escritura en ningún caso.
- **Mutaciones:** las tres hacen fallar la suite ampliada del admin.
  - `path[1]` cambiado por el penúltimo: 1 fallo.
  - Sin `autofocus` en la fila: 1 fallo.
  - `external` siempre falso: 1 fallo.
- **Contrato y logs (I-1):**
  - 422 `RECIPE_TOO_DEEP` con `application/json; charset=utf-8` y `{ error: { code, message, path, usedBy } }`, válido con `recipeTooDeepErrorSchema` tanto por línea como por causa externa.
  - `RECIPE_CYCLE` sin cambios, válido con su esquema.
  - Los 8 registros `inventory_recipe_too_deep` llevan solo `itemId` y `depth`, sin nombres.

### Responsive

A 360×800 y 1280×900 no hay desbordamiento horizontal en ningún estado, y la alerta, el enlace, el campo marcado y la fila enfocada quedan dentro del viewport. En Claude in Chrome (606 px), la alerta y el campo enfocado se ven completos.

### Accesibilidad

- Una sola `role=alert` y un solo `autofocus` por página en todos los estados. Sin ids duplicados.
- `aria-describedby` apunta a ids existentes, y el mensaje de campo lleva texto y un icono "⚠Error:", así que no depende solo del color.
- Foco visible en el enlace del resumen (contorno de 2 px) y en el ingrediente enfocado (contorno amarillo, `:focus-visible`).
- axe: 0 violaciones (CA-11).
- `datalist` en Chrome de escritorio: al recibir el foco por `autofocus`, la lista de sugerencias no se despliega. Solo se ve el indicador del campo (captura en Claude in Chrome).

### UX/UI

No hay diseño del admin en `_stich_source_/`. El patrón coincide con el error de campo y el resumen existentes, y los cuatro textos aprobados aparecen literalmente.

### Performance

- Por el diff, el guardado correcto no ejecuta consultas nuevas: `namesOf` y `deepestChain` solo corren al rechazar.
- Tiempos en el log de la API: el 422 de recetas tarda de 2,5 a 23,7 ms y el 201, de 3,2 a 25 ms. Comparables.

### SEO

No aplica: el admin no es indexable.

### No repetido y por qué

- Tras la interrupción no repetí `build:css`, `typecheck`, `lint` ni `npm test`: el código de producción y de pruebas no cambió (`git diff` idéntico) y su resultado está arriba.
- Hay una matriz de navegador por cada configuración; no repetí ninguna, porque todas pasaron a la primera.

### Pendientes de revisión manual

- Teclado móvil real y `datalist` en un dispositivo iOS o Android (H-T8). Decisión 5 del usuario: no bloquea. CA-7 se midió con el foco y el viewport a 360 px.

### Limpieza

Verificada:

- `docker compose -p req054qa down -v`: el contenedor, el volumen (con la base desechable y todas sus `restaurante_test*`) y las redes, borrados. `restaurante-mysql-dev-1` sigue apagado y nadie lo tocó.
- Procesos detenidos: API, admin, admins cruzados, proxy, landing y Chrome sin interfaz. Ningún puerto 3111–3141, 3307 ni 9333/9334 escucha.
- Worktree temporal de `22733f0` quitado (`git worktree list`: solo `main` y este worktree). Copias de mutación, sondas, `.env`, contraseña, axe y páginas, borrados con la carpeta `qa` del scratchpad. No quedan archivos en `/tmp`.
- Pestañas de Claude in Chrome cerradas.
- `git status` del worktree: los 15 archivos del desarrollador y este ticket.
- En el scratchpad queda la carpeta `src050`, que no creó este QA y no se tocó.

### Resultado final

QA_APPROVED

## Commit y Pull Request

- Rama `feature/REQ-F-054-editor-recetas-ciclo-y-foco`, desde `epic/inventario` (`22733f0`).
- Un commit con los 15 archivos del cambio y este ticket en `in-progress/`; sin capturas, temporales ni archivos generados.
- Pull Request hacia `epic/inventario` (`gh pr create --base epic/inventario`), abierto en borrador y marcado como listo cuando termina el CI del commit. El número, la URL y el resultado de los checks quedan en el PR y en el informe de senior-fullstack, para no subir commits después de `gh pr ready`.
- OBS-11 de REQ-F-050 (foco de `field-password`) queda como ajuste aparte, fuera de este PR.

## Cierre

- Pull Request: #192 (https://github.com/orvigas/negocio/pull/192), hacia `epic/inventario`. Commit `017d84d`; merge `88209c4` (2026-11-25). El usuario confirmó el merge ("192 mergeado").
- CI del PR en verde: `calidad`, `docker`, `auditoria`, `pruebas (1/2)`, `pruebas (2/2)`, `verificacion`, `cambios` y GitGuardian en `pass`. `publish`, `deploy`, `validado` y `vigente` omitidos, como corresponde a un PR hacia `epic/inventario` (sin publicar ni desplegar).
- Observaciones del QA que siguen abiertas, sin ticket:
  - OBS-1 (MINOR, aceptada por el usuario): en un rechazo por profundidad con varias causas, la línea marcada puede no bastar por sí sola; el siguiente guardado orienta bien. Ajuste aparte si se quiere mejorar.
  - OBS-2 (TRIVIAL, patrón existente del admin): el enlace del resumen deja la leyenda y la etiqueta del campo fuera de la vista.
  - OBS-3 (anterior): `action=rows` con un `_csrf` inválido responde 200 y repinta, sin escribir nada.
  - OBS-4 (anterior): la CSP bloquea el `preconnect` a `fonts.googleapis.com` del `layout.html` del admin.
- Revisión manual pendiente (no bloquea, decisión 5 del usuario): teclado móvil y `datalist` en un dispositivo iOS o Android real.
- OBS-11 de REQ-F-050 (foco de `field-password`): ajuste pequeño aparte, todavía sin abrir.

## Historial de cambios

### Versión 1

Descripción inicial (2026-11-25). Seguimiento de DEF-007 y DEF-008 de REQ-F-050, aprobado por el usuario con "Sí, apruebo el borrador". PV-1, PV-2, PV-4 y PV-5 se aprueban tal cual. PV-3 = A se aplica como opción por defecto del borrador aprobado y es modificable a B antes de la implementación.

### Revisión técnica (2026-11-25)

`senior-fullstack` revisa el ticket sobre `epic/inventario` (`22733f0`): confirma que `path` del ciclo empieza siempre en la receta que se guarda (la fila culpable es `path[1]`), compara PV-3 A frente a B (recomienda A, la aprobada por defecto) y añade la `## Revisión técnica` y el `## Technical Action Plan`. Estado: `NEEDS_TECHNICAL_PLAN_APPROVAL`.

### Inicio de la implementación (2026-11-25)

El usuario aprueba el Technical Action Plan con "Sí, apruebo con A y los textos": PV-3 = A confirmada y los cuatro textos propuestos aprobados tal cual. El ticket pasa de `backlog/` de `main` (sin commit) a `in-progress/` de la rama `feature/REQ-F-054-editor-recetas-ciclo-y-foco`, que sale de `epic/inventario` (`22733f0`). Estado: `IN_PROGRESS`.

### Implementación (2026-11-25)

Implementado el Technical Action Plan con PV-3 = A y los textos aprobados. `typecheck`, `lint` y `test` en 0. Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

### QA Action Plan (2026-11-25)

`senior-qa` analiza la implementación aprobada ("Sí, apruebo la implementación") y añade el `## QA Action Plan`, con cinco preguntas abiertas (sondas fuera de `landing-pages/tests/`, carga de axe-core, retrocompatibilidad con un worktree temporal, causa mixta de profundidad y revisión en dispositivo real). No se ejecutaron pruebas. Estado: `NEEDS_QA_PLAN_APPROVAL`.

### QA (2026-11-25)

El usuario aprueba el QA Action Plan con "Sí, apruebo el plan", con las cinco recomendaciones. `senior-qa` ejecuta la ronda 1: CA-1 a CA-11 en PASS, sin defectos y con cuatro observaciones (OBS-1 MINOR aceptada; OBS-2 a OBS-4, anteriores o triviales). La limpieza está verificada. Estado: `QA_APPROVED`.

### Commit y Pull Request (2026-11-25)

`senior-fullstack` hace el commit del cambio y abre el Pull Request hacia `epic/inventario`. Estado: `READY_FOR_MERGE`, sujeto a que el CI del PR termine en verde.

### Cierre (2026-11-25)

El usuario confirma el merge del PR #192 en `epic/inventario` ("192 mergeado"; commit `017d84d`, merge `88209c4`), con el CI en verde. El ticket pasa de `in-progress/` a `done/`. Quedan abiertas OBS-1 a OBS-4, la revisión manual en dispositivo real y OBS-11 de REQ-F-050 como ajuste aparte. Estado: `DONE`.
