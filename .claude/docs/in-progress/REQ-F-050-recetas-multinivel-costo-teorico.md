# REQ-F-050 — T2: recetas multinivel, versiones y costo teórico

## Estado

QA_APPROVED — PR 1 de 3 (modelo, dominio y persistencia): implementación aprobada por el usuario ("Apruebo", 2026-11-19); QA Action Plan aprobado ("Si", 2026-11-19); QA ejecutado, ronda 1, sin defectos BLOCKER, CRITICAL ni MAJOR (4 MINOR). Ver "QA Report — PR 1 (T2)". Commit y PR hacia `epic/inventario` en curso (senior-fullstack); `READY_FOR_MERGE` se registra cuando el CI del PR esté en verde.

Technical Action Plan aprobado por el usuario el 2026-11-19: "Si" (en respuesta a "¿Apruebas el plan técnico de T2 con mis recomendaciones a PT-1 a PT-7?"). Decisiones, tal como se recomendaron:

- **PT-1:** sí, una prueba permanente de concurrencia A→B / B→A en MySQL.
- **PT-2:** la importación aborta todo ante conflictos, con la lista.
- **PT-3:** un Intermedio con la receta cerrada se costea por CPP → referencia → "Sin costo".
- **PT-4:** las versiones cerradas del historial se muestran sin costo, solo con líneas.
- **PT-5:** importar en producción solo cuando la épica llegue a `main`, tras T3.
- **PT-6:** se mantienen 3 PR (la importación pasa a un PR 2b solo si el PR 2 crece demasiado).
- **PT-7:** solo un Insumo puede ser no inventariable; el costo de referencia se admite en Insumo, Intermedio y Reventa (no en Compuesto ni en padre).

## Aprobación

Aprobado por el usuario (versión 1, fecha 2026-11-19): "si lo valido" (en respuesta a "¿Validas el requisito de T2 con mis dos recomendaciones, o corriges alguna?").

## Marco

- Ticket T2 de la épica de inventario. El marco (D-1 a D-4, PV-1 a PV-14, RN-1 a RN-16, glosario y partición) está en REQ-F-049 (`.claude/docs/in-progress/REQ-F-049-epica-inventario-catalogo-articulos.md`, versión vigente en la rama `epic/inventario`).
- Depende de T1 (REQ-F-049), completo en `epic/inventario` (PR #183).
- Respeta el "Plan técnico de T2 a T5 (aprobado 2026-11-19)" de REQ-F-049 (DT-1, DT-5 a DT-15 y P-1 a P-8), con las desviaciones C-1 a C-7 de este ticket, validadas por el usuario.
- Los PR van a `epic/inventario` (D-4, `.claude/rules/git.md`).

## Decisiones del usuario (citas textuales)

Origen: análisis del libro de datos reales del negocio (fuera del repositorio; PV-5). Este ticket solo contiene resúmenes y ejemplos ficticios.

- "Comienza con t2 despues de analizar los datos y decirme si se ajustan a nuestras necesidades o hay que hacer ajustes".
- "Si usa stitch": el editor de recetas se diseña con Stitch (`.claude/rules/stitch-diseno.md`).
- "Apruebo las recomendaciones de 1, 2, 3, 6, 10, 11 y 12":
  - **1:** se modifica PV-5 para permitir una importación única de datos maestros, sin existencias ni compras, desde un archivo fuera del repositorio;
  - **2:** unidad `hr` y atributo "inventariable sí/no" en T2;
  - **3:** costo de referencia como costo de arranque;
  - **6:** tabla de correcciones de nombres que el usuario revisa antes de importar;
  - **10:** inactivar un Intermedio usado en recetas vigentes se permite con aviso y la lista de recetas afectadas;
  - **11:** partición en 3 PR; solo el PR 3 espera el diseño de Stitch;
  - **12:** "usado en" aprobado.
- **3b:** "Si los incluyen pero no facturamos". Los costos incluyen IVA y no se factura: el costo es lo pagado con IVA (PV-6).
- **4:** "la merma solo es en la cocción".
- **5:** "Recorte de res y chambarete". Son los ingredientes con merma de cocción a capturar.
- **7:** "Si son recetas aun no capturadas los usare para probar la interfaz de creación de recetas". Se importan los ingredientes sin uso.
- **8:** "Pronto comenzaremos a venderlo, asi que ya son necesarios y debe importarse". Se importan las recetas de pozole, tostadas y tacos dorados.
- **9:** "Añade informacion ficticia si la necesitas aun no tengo esos datos". Proveedores, existencias iniciales y mínimos: solo datos ficticios en las semillas de desarrollo y pruebas.
- **Validación final:** "si lo valido", con las dos recomendaciones:
  - (a) la receta de la preparación de birria cocida se importa tal cual, con la mezcla cruda de carne y una merma del 40 % en su línea (RN-T2-1); el usuario creará después en pantalla una versión 2 con el recorte y el chambarete por separado;
  - (b) el recorte y el chambarete pierden el 40 % al cocerse; la merma es por línea y se ajusta con una versión nueva.

## Objetivo

Que Administrador y Gerente definan recetas multinivel versionadas de los artículos Intermedios y Compuestos y vean su costo teórico, como base del costo real de T3.

## Alcance

- Recetas y versiones: crear, cerrar y consultar el historial.
- Líneas con merma y rendimiento.
- Validación de ciclos.
- Costo teórico multinivel.
- "Usado en".
- Unidad `hr`, atributo inventariable y costo de referencia en el artículo.
- Importación única de datos maestros (A5).
- Recetas ficticias en la semilla de desarrollo.
- Editor de recetas diseñado con Stitch.

## Fuera de alcance

- Kardex, CPP, proveedores, compras, saldo inicial y "Devolución a proveedor" (T3, REQ-F-051).
- Lotes de producción, mermas operativas, reorden por categoría y porción por comensal (T4/T5).
- Reportes (T5).
- Ventas, POS, caja y precios con historial (épica E2).
- Conectar el cotizador (PV-3).
- Comparar versiones o simular costos.
- Cambios en el menú público, las landings, la página o el bot (D-2).

## Actores

- **Administrador y Gerente:** lectura y escritura de recetas.
- **Editor y cualquier otro rol:** no ven la sección; las rutas del admin y de la API responden 403.
- **Cocina (desde T4):** lectura sin costos, según el plan técnico.
- **Operador del servidor:** ejecuta la importación única. No es un rol de la app.

## Reglas de negocio

- **RN-T2-1. Merma de cocción en la línea.**
  - La pérdida por cocción de una carne va como merma de su línea en la receta que la cocina.
  - La cantidad neta es la cocida (aprovechable) y el rendimiento de la receta es lo cocido: el rendimiento no vuelve a descontar la pérdida.
  - Los demás ingredientes tienen merma 0 salvo indicación.
  - Ejemplo ficticio: neta 6.000 kg, merma 40 % → bruta 6.000 / (1 − 0.40) = 10.000 kg. Con un rendimiento de 6.000 kg y un costo de 100/kg, la carne cuesta 1 000 y el costo por unidad es 166.6667/kg.
  - **Riesgo de contarla dos veces:** capturar la cantidad cruda (10.000) como neta con el 40 % de merma daría 16.667 kg de bruta (+66.7 %).
- **RN-T2-2. Quién lleva receta.** Solo los Intermedios y los Compuestos, simples o variantes; nunca un padre. Como máximo una versión vigente por artículo.
- **RN-T2-3. Ingredientes permitidos.** Insumo (inventariable o no), Intermedio o Reventa, siempre activo. Nunca un padre ni un Compuesto (P-3).
- **RN-T2-4. Costo unitario.**
  - Orden: CPP (desde T3) → costo de referencia → "Sin costo".
  - Un Intermedio con receta vigente se costea por su receta (DT-7).
  - Un costo que falta nunca se trata como 0.
- **RN-T2-5. No inventariables.** Un artículo no inventariable no tiene existencias y su costo es siempre el de referencia.
- **RN-T2-6. IVA.** El costo de referencia incluye el IVA pagado, porque no se factura (PV-6, respuesta 3b).
- Aplican sin cambios RN-5 (sin ciclos), RN-6 (bruta = neta / (1 − merma), merma en [0 %, 100 %)), RN-7 (versiones) y RN-16 (historial) de REQ-F-049.

## Requisitos

- **RF-1. Lista de recetas** (Inventario → Recetas).
  - Columnas: artículo, tipo, rendimiento con su unidad, costo por unidad o "Sin costo", fecha de la versión vigente y aviso si usa artículos inactivos.
  - Filtro por tipo y búsqueda.
  - Mensaje cuando no hay resultados.
- **RF-2. Receta del artículo.**
  - Versión vigente con su costo teórico y la lista de ingredientes sin costo.
  - Historial de versiones en solo lectura.
- **RF-3. Editor de versión.**
  - Rendimiento > 0, en la unidad base del artículo producido (P-2).
  - Cada línea: artículo, cantidad neta > 0, unidad del sistema o empaque convertible a la base (sin factor, se rechaza), merma de 0 a 99.99 % con 2 decimales y nota opcional.
  - De 1 a 40 líneas, sin ingredientes repetidos.
  - La pantalla muestra la neta, la bruta y el costo de cada línea, con una ayuda de captura: "neta = cantidad aprovechable tras la merma".
- **RF-4. Versiones.**
  - Guardar con cambios crea una versión nueva vigente desde ese instante y cierra la anterior, que queda inmutable.
  - Guardar sin cambios no crea versión.
  - "Cerrar receta" deja el artículo sin receta vigente.
- **RF-5. Ciclos.** Se rechaza una línea que haría que la receta se contenga a sí misma, directa o indirectamente, mostrando la ruta del ciclo. Más de 8 niveles también se rechaza.
- **RF-6. Costo teórico.**
  - Multinivel y calculado al consultar.
  - Un cambio de una sub-receta o de un costo se refleja sin crear versiones nuevas.
  - Decimales exactos (PV-13); se muestra con 2.
  - Cada línea indica de dónde sale su costo (CPP o referencia).
- **RF-7. Inactivar un artículo usado en recetas vigentes.**
  - Se permite con confirmación, mostrando la lista de recetas afectadas.
  - Esas versiones no cambian y muestran un aviso.
  - El artículo no se ofrece en versiones nuevas.
  - Inactivar un Intermedio no cierra su receta.
- **RF-8. "Usado en".** La ficha del artículo lista las recetas vigentes que lo usan. RN-4 queda activo: un artículo con versiones o usado en líneas no cambia su unidad base ni sus factores.
- **RF-9. Conflicto y doble envío.**
  - Si se guarda una versión partiendo de otra que ya no es la vigente, se responde 409 con la versión vigente y se conserva lo escrito.
  - El doble envío no crea dos versiones.
- **RF-10. Ficha del artículo (T1).**
  - Costo de referencia: opcional, ≥ 0, 4 decimales, en MXN y con IVA.
  - Atributo inventariable: por defecto sí; solo se puede cambiar mientras el artículo no tenga movimientos.
  - Unidad `hr` (magnitud tiempo, sin conversión a otras).
  - Todo queda en el historial (RN-16).
- **RF-11. Importación única de datos maestros (A5).** Ver la sección A5.
- **RF-12. Semilla de desarrollo.**
  - Recetas ficticias: al menos una de 2 niveles, una carne con merma de cocción (RN-T2-1), un no inventariable en `hr` y un ingrediente sin costo.
  - Nada se carga en producción.
- **RF-13. Usabilidad.**
  - Mobile-first desde 360 px, con teclado y foco visible.
  - Funciona sin JavaScript (filas fijas, como el plan).
  - Errores junto a su línea y campo, que no dependen solo del color.

## A5 — Importación única de datos maestros

Habilitada por la modificación de PV-5 que aprobó el usuario (respuesta 1).

- **Qué importa:**
  - los 78 ingredientes del libro, incluidos los 15 que no se usan en ninguna receta (respuesta 7);
  - los 28 productos, como Compuestos o Reventa;
  - las 37 recetas: 26 de productos, incluidos pozole, tostadas y tacos dorados (respuesta 8), y 11 de preparaciones con su rendimiento;
  - las 185 líneas;
  - el padre de refrescos con sus 15 variantes;
  - las categorías;
  - los costos de referencia;
  - los 3 artículos no inventariables.
- **Qué no importa (no hay datos):** proveedores, existencias iniciales, mínimos, precios, menús ni parámetros. Las semillas ficticias de desarrollo los cubrirán para T3 y T4 (respuesta 9).
- **Origen:**
  - un JSON generado fuera del repositorio, que nunca se commitea: una barrera de git o del lint lo impide;
  - en producción se copia al servidor, se ejecuta y se borra; el procedimiento va en `restaurante/docs/despliegue.md`.
- **Validación:** esquema y tipos; unidades (`gr` → `g`, `lt` → `L` y `hr`); referencias; ciclos; rendimiento > 0; merma en [0, 100); costos ≥ 0; unicidad de nombres y SKU. Ante cualquier error rechaza todo y lista cada error con su fila.
- **Limpieza y transformaciones:**
  - una tabla de correcciones de nombres incluida en el JSON, que revisa el usuario antes (respuesta 6); nada fijo en el código;
  - nombres recortados;
  - las variantes reciben nombres completos ("Refresco <marca> <sabor> <presentación>"), porque el nombre es único en todo el catálogo (T1).
- **Merma de la carne (RN-T2-1):** la línea de la mezcla cruda de la preparación de birria cocida se importa con neta = cantidad cruda × 0.6 y merma del 40 %, sin cambiar el rendimiento. El costo resultante es idéntico al del libro. Esta transformación también viene en el JSON revisado.
- **Ejecución:**
  - el ensayo es el modo por defecto y solo informa;
  - escribir exige un parámetro explícito;
  - la escritura es una transacción: todo o nada.
- **Idempotencia:** clave natural, el nombre normalizado. Repetir con los mismos datos no crea nada; un dato distinto se informa como conflicto y no se sobrescribe.
- **Registro:**
  - las recetas se crean como versión 1, vigente desde la importación, con el autor "Importación" en el historial;
  - los logs solo llevan conteos, nunca costos ni contenido del archivo.
- **Pruebas:** con un JSON ficticio contra el MySQL de pruebas. Nunca con datos reales.

## Historias de usuario

- **HU-1.** Como gerente quiero capturar una preparación con su rendimiento, para conocer su costo por kilo.
- **HU-2.** Como gerente quiero usar esa preparación en un platillo, para conocer el costo por porción.
- **HU-3.** Como administrador quiero cambiar una receta conservando la anterior, para mantener la trazabilidad.
- **HU-4.** Como gerente quiero ver qué ingredientes no tienen costo, para completarlos.
- **HU-5.** Como gerente quiero crear recetas nuevas con los ingredientes importados que aún no se usan, por ejemplo la versión 2 de la birria cocida con recorte y chambarete.

## Criterios de aceptación

- **CA-1.** Given un rendimiento de 2 kg y líneas cuyo costo total es 100, Then el costo por unidad es 50.0000/kg.
- **CA-2.** Given una línea de 6.000 kg netos con merma del 40 %, Then la bruta es 10.000 kg. Given una merma del 100 %, Then se rechaza.
- **CA-3.** Given una línea de 500 g de un ingrediente en kg a 10/kg, Then la línea cuesta 5.00. Given una línea en pza de un ingrediente en kg sin factor, Then se rechaza con un mensaje claro.
- **CA-4.** Given que A usa B, When se añade A a la receta de B (o A a A), Then se rechaza mostrando la ruta y no se escribe nada. Given más de 8 niveles, Then se rechaza.
- **CA-5.**
  - Given la v1 vigente, When se guarda con cambios, Then la v2 queda vigente y la v1 cerrada, con intervalos contiguos e inmutable.
  - When se guarda sin cambios, Then no se crea versión.
  - When se cierra la receta, Then el artículo queda sin receta vigente.
- **CA-6.**
  - Given dos sesiones sobre la v1, When ambas guardan, Then la segunda recibe un 409 con la versión vigente y conserva lo escrito.
  - Given dos guardados simultáneos A→B y B→A, Then uno se rechaza por ciclo.
- **CA-7.**
  - Given un ingrediente sin CPP pero con costo de referencia, Then se usa ese costo, marcado como "referencia".
  - Given un ingrediente sin CPP ni referencia, Then la receta dice "Sin costo" y lo lista.
- **CA-8.** Given un cambio en una sub-receta o en un costo de referencia, Then el costo de la receta que la usa cambia, sin crear una versión nueva de esta.
- **CA-9.** Given un no inventariable en `hr` con costo de referencia, Then se costea en las recetas y no muestra existencias.
- **CA-10.**
  - Given un artículo usado en una receta, When se cambia su unidad base, Then se rechaza (RN-4).
  - Given un Intermedio usado en recetas vigentes, When se inactiva sin confirmar, Then responde 409 con la lista de recetas.
  - When se inactiva con confirmación, Then queda inactivo, las recetas muestran el aviso y el artículo no se ofrece en líneas nuevas.
- **CA-11.** Given un Compuesto o un padre, Then no se ofrece como ingrediente. Given un Insumo o una Reventa, Then no admite receta.
- **CA-12.** Given un Editor, When pide las rutas de recetas del admin o de la API, Then recibe 403 y no se escribe nada.
- **CA-13.** Given el JSON ficticio de prueba:
  - el ensayo no escribe nada;
  - la importación crea los conteos esperados;
  - la repetición no cambia nada;
  - un archivo con un ciclo o una unidad inválida no escribe nada y lista los errores;
  - las variantes quedan con nombres únicos.
- **CA-14.** La vuelta atrás con la migración de T2 deja la app anterior funcionando, con el alcance de C-2. Un respaldo restaurado conserva las recetas, las versiones, `hr`, el atributo inventariable y el costo de referencia.
- **CA-15.** Las pantallas de T2 se pueden usar a 360 px y en escritorio, solo con teclado, con foco visible y sin JavaScript.
- **CA-16.** Las landings, el bot, el menú público y las pantallas de T1 funcionan igual que antes.

## Casos límite

- Coma decimal o decimales de más: se rechaza.
- Cantidad que redondea a 0 en la unidad base: se rechaza.
- Receta cuya única línea pasa a inactiva.
- Sub-receta cerrada: la receta que la usa queda "Sin costo" para esa línea.
- Doble envío del formulario, botón atrás después de guardar, y la API caída sin perder lo escrito.
- Un artículo no inventariable que pasa a inventariable (solo sin movimientos).
- Captura de la cantidad cruda como neta: se mitiga con la ayuda de captura (RN-T2-1).

## Riesgos

- Contar la merma dos veces (RN-T2-1).
- ENUM nuevo (`hr`) y vuelta atrás en desarrollo (C-2).
- Fuga del archivo de datos reales al repositorio (A5).
- Que el diseño con Stitch retrase el PR 3.
- Divergencia de `epic/inventario` respecto de `main`.

## Dependencias

- T1 (REQ-F-049) en `epic/inventario`.
- Plan técnico de T2 a T5 aprobado, con C-1 a C-7.
- El JSON de datos generado fuera del repositorio y la revisión de sus correcciones por el usuario.
- La aprobación del diseño en Stitch, solo para el PR 3.

## Conciliación con el plan técnico aprobado (REQ-F-049)

Coincide sin cambios con el plan:

- tablas `inventory_recipe_version` e `inventory_recipe_line`;
- `current_item_id` único (una sola versión vigente);
- candado `inventory_lock('recetas')`;
- intervalos `[valid_from, valid_to)` contiguos, con la fecha puesta por el servidor;
- acción "cerrar receta";
- decimales con `bigint` (cantidades con 3, costos con 4, merma `DECIMAL(5,2)`), con redondeo mitad hacia arriba;
- P-1, P-2 y P-3;
- máximo de 40 líneas y 8 niveles;
- errores 422 `RECIPE_CYCLE`, 409 `ITEM_IN_ACTIVE_RECIPES` y `RECIPE_NOT_ALLOWED`;
- DT-7, sin caché;
- permisos por rol;
- editor sin JavaScript con filas fijas;
- `inventory_change` con `entity='recipe'`.

Desviaciones validadas por el usuario:

| # | Desviación | Resolución |
|---|---|---|
| C-1 | A2 cambia el costo teórico del plan: sin CPP ya no queda siempre "Sin costo". | Orden CPP → referencia → "Sin costo". Columna `reference_cost` `DECIMAL(15,4)` nula en `inventory_item` (migración aditiva). |
| C-2 | El §0 del plan advierte que un valor nuevo en un ENUM rompe la lectura en una imagen anterior. | La imagen de producción a la que se volvería es la de `main`, que no lee `inventory_item`, porque la épica no está en producción. El riesgo queda en desarrollo, al alternar entre T1 y T2, y se documenta en el README. La migración de T2 añade `hr` y el atributo inventariable (`BOOLEAN NOT NULL DEFAULT true`). |
| C-3 | El atributo inventariable afecta a T3 y T4. | T3 rechaza compras y movimientos de un no inventariable. T4 lo costea en un lote, pero no lo descuenta. Queda como entrada para REQ-F-051 y REQ-F-052. |
| C-4 | El candado ordena las escrituras, pero no detecta que alguien guarde partiendo de una versión antigua. | RF-9: el formulario envía la versión de partida; si ya no es la vigente, 409 de conflicto. |
| C-5 | "Usado en" no está en las rutas del plan. | Una lectura nueva en el PR 2. |
| C-6 | La importación A5 no está en el plan. | Comando en el PR 2, con salvaguardas de estilo `inventory-dev-seed.ts` y el autor "Importación". |
| C-7 | T1 exige nombres únicos en todo el catálogo, también en las variantes. | La importación da nombres completos a las variantes. |

## Action Plan

### Objetivo

Recetas versionadas con costo teórico y datos maestros reales cargados de forma segura.

### Cambios requeridos (3 PR hacia `epic/inventario`, en este orden)

1. **PR 1:** migración `inventario_recetas` (tablas del plan, más `hr`, atributo inventariable y `reference_cost`), dominio (líneas, merma, ciclos, versiones, costo según RN-T2-4), stores, `isInUse` y pruebas funcionales.
2. **PR 2:** contratos y rutas del plan, más "usado en" y el 409 de conflicto; campos nuevos en la ficha de T1; comando de importación con su JSON ficticio y el procedimiento en `despliegue.md`; semilla de desarrollo; pruebas de API.
3. **PR 3:** pantallas (lista, receta, editor e historial), documentación (`arquitectura.md` §4 y §6, `README.md`) y pruebas del admin. **Es el único PR que depende de la aprobación del diseño en Stitch.** Los PR 1 y 2 avanzan en paralelo al diseño.

### UX/UI y Stitch

- **Antes de diseñar:** revisar `_stich_source_/`, que no tiene diseño del admin, y el sistema visual de T1 (parciales `row-fieldset`, `field-*` y `error-summary`, y `inventory-manager/public/css`). Lo que genere Stitch se adapta a ese sistema.
- **Qué se pide diseñar:**
  - lista de recetas;
  - receta con su costo y los faltantes;
  - editor: cabecera con el rendimiento; tabla de líneas que en móvil pasa a tarjetas; filas sin JavaScript; avisos de ciclo, de inactivos y de conflicto; ayuda de neta frente a bruta;
  - historial de versiones.
- **Datos:** solo ficticios en las indicaciones; nunca datos reales ni credenciales.
- **Aprobación:** la propuesta se presenta al usuario antes de implementar. Se guarda en `_stich_source_/` solo con su autorización expresa.

### Resultado esperado

El gerente ve el costo teórico de cada receta, con los costos de referencia hasta que existan compras (T3), y el catálogo real queda cargado sin que ningún dato real entre al repositorio.

## Entradas para otros tickets

- **T3 (REQ-F-051):**
  - rechazar compras y movimientos de los artículos no inventariables (C-3);
  - tipo de movimiento "Devolución a proveedor" (salida);
  - proveedores y existencias iniciales ficticios en la semilla de desarrollo.
- **T4 (REQ-F-052):**
  - un lote costea los no inventariables, pero no los descuenta;
  - parámetros de reorden por categoría (días de ciclo, tiempo de entrega, colchón);
  - mínimos ficticios en la semilla.
- **T4/T5:** porción por comensal × comensales del día.
- **E2 (ventas):**
  - "se necesita un punto de venta para restaurante";
  - "se necesita un rol de cajero";
  - "no usamos apps de reparto hasta ahora";
  - "el fondo de caja es configurable y diario se tiene que definir";
  - precios con historial, menús con horarios, canales de venta, formas de pago y categorías de gasto del libro;
  - pozole, tostadas y tacos dorados se venderán pronto: sus recetas se importan en T2 y entrarán al POS.

## Trazabilidad

| Objetivo | Requisito | Historia | Criterios | Action Plan |
| --- | --- | --- | --- | --- |
| Costo teórico | RF-3, RF-6, RF-10, RN-T2-1, RN-T2-4 a RN-T2-6 | HU-1, HU-2, HU-4 | CA-1 a CA-3, CA-7 a CA-9 | PR 1, PR 2 |
| Integridad de recetas | RF-4, RF-5, RF-7 a RF-9, RN-T2-2, RN-T2-3 | HU-3 | CA-4 a CA-6, CA-10, CA-11 | PR 1, PR 2 |
| Acceso | Actores, PV-1 | — | CA-12 | PR 2, PR 3 |
| Datos maestros | RF-11 (A5), RF-12 | HU-5 | CA-13 | PR 2 |
| Operación segura | Riesgos, C-2 | — | CA-14, CA-16 | PR 1 a PR 3 |
| UX | RF-1, RF-2, RF-13, Stitch | HU-1 a HU-5 | CA-15 | PR 3 |

## Technical Action Plan

Autor: senior-fullstack, 2026-11-19. Fase de revisión: solo se editó este ticket.

**Fuentes.**

- Código real de T1 en la rama `epic/inventario` (`0c3c293`, PR #183), leído en el worktree de solo lectura `.claude/worktrees/epic-inventario-lectura`.
- El plan aprobado de T2 a T5 y los Implementation Result de T1 en REQ-F-049.
- `restaurante/landing-pages/Dockerfile`, `restaurante/deploy/compose.prod.yaml`, `restaurante/docs/despliegue.md` §5 y §6, y `.gitignore`, en `main`.
- CodeGraph indexa `main`, no la rama de la épica: en el worktree se usaron Read y Grep dirigidos.
- NotebookLM: sus herramientas no están disponibles en esta sesión, así que no se consultó. Ningún cuaderno conocido cubre el inventario.

### Objetivo técnico

- Añadir a `core/inventory` recetas versionadas e inmutables con líneas en bruta y neta, un DAG validado (sin ciclos, ≤ 8 niveles) y el costo teórico multinivel exacto (`bigint`).
- Persistirlas con una migración aditiva y exponerlas en la `api` y el admin.
- Añadir al artículo la unidad `hr`, el atributo inventariable y el costo de referencia.
- Cargar los datos maestros reales una sola vez, con un comando seguro y sin que ningún dato real entre al repositorio.

### Hechos del repositorio que condicionan el plan

| # | Hecho (código de T1) | Consecuencia |
|---|---|---|
| H-1 | El ENUM de unidad existe **solo** en `inventory_item.base_unit` (Prisma `InventoryUnit`: `kg, g, L, ml, pza`). `inventory_item_unit` guarda el nombre del empaque (`VARCHAR(30)`) y su factor hacia la base, sin ENUM. | `hr` se añade en una sola columna ENUM. La línea de receta guarda su unidad en `VARCHAR(30)`, como el plan. |
| H-2 | La lista de unidades está duplicada a propósito: `core/inventory/units.ts` y `contracts/inventory.ts` (`INVENTORY_UNITS`), con una prueba de `api` que exige que coincidan. | `hr` se añade en las dos listas y en el `enum` de Prisma. `units.ts` gana la magnitud `time` (`hr`, factor 1, sin conversión a otras). |
| H-3 | `readUnits` rechaza un empaque con el nombre de una unidad del sistema (`SYSTEM_UNIT_KEYS`). | Tras T2, un empaque llamado "hr" se vuelve inválido. La migración no lo corrige: QA comprueba que no exista ninguno (en producción no hay inventario; la semilla no lo tiene). |
| H-4 | `isInUse` devuelve `false` (`prisma-inventory-store.ts:198`). `updateItem` bloquea la unidad base y los empaques con `ItemLockedError` si `isInUse` es verdadero. | T2 solo implementa `isInUse` (RN-4). La regla ya está cableada. |
| H-5 | Las escrituras de T1 usan `WRITE_TX = Serializable` con reintento en 1213/P2034. `deactivateItem` de un padre inactiva sus variantes en cascada con `variants: 'deactivate'`. | Las recetas usan su propia transacción `ReadCommitted` con candado (ver Persistencia). Inactivar en cascada también comprueba si las variantes se usan en recetas. |
| H-6 | La idempotencia de las altas (`api/src/admin/idempotency.ts`) vive en memoria (10 min, por usuario, ámbito y huella) y responde 422 `IDEMPOTENCY_KEY_REUSED`. | Se reutiliza en `POST …/recetas`. La segunda barrera es natural: guardar lo mismo que la versión vigente no crea versión. |
| H-7 | `inventory_change.entity` es `VARCHAR(16)` y `InventoryEntity = 'item' \| 'category'`. | Se añade `'recipe'` solo en el tipo: sin DDL. |
| H-8 | La imagen `api` solo copia `scripts/admin-recover.ts`, `scripts/hash-password.ts` y `scripts/support/` (`landing-pages/Dockerfile`). El contenedor es `read_only`, con `/tmp` en tmpfs. `docker cp` no puede escribir en un tmpfs. | El comando de importación se copia a la imagen `api`. En producción lee el JSON por **stdin** (`--archivo -`), sin copiarlo al contenedor. |
| H-9 | `restaurante_migrator` tiene `INSERT`; `restaurante_app` solo DML. `truncateAll` vacía todas las tablas entre pruebas. | La fila `inventory_lock('recetas')` la siembra la migración. El candado se toma con un *upsert* que también funciona sin la fila (tras un TRUNCATE). |
| H-10 | `main` no tiene ninguna tabla de inventario en su `schema.prisma`. La suma de `deploy/` (cálculo del CI) es `591de8e7…5cc7f0`, comprobada hoy en el worktree. | La imagen de `main` nunca lee `inventory_item`, así que `hr` no le afecta (C-2). T2 no toca `deploy/`. |
| H-11 | `git check-ignore` no ignora `Datos de entrada.xlsx` (está sin seguimiento en la raíz del repositorio). `.gitignore` solo ignora `/Cotizador_Taquiza_Birria.xlsx`. Tampoco ignora `.claude/worktrees/`. | Hace falta la barrera de A5 (ver Seguridad). Hoy un `git add .` o `-A` subiría el libro real. |
| H-12 | `_stich_source_/` no tiene diseños del admin (solo landings). El sistema del admin está en `inventory-manager/src/styles/main.css` (`@theme`: brasa, surface, rim, outline, crema, masa, chile, maíz, error; Epilogue y Space Grotesk) y en los parciales `row-fieldset`, `field-*`, `error-summary*` e `inventory-*`. | Stitch diseña sobre ese sistema. `STITCH_API_KEY` está definida y no está vacía (comprobado sin imprimirla). |

### Conciliación de C-1 a C-7 con el plan aprobado y el código de T1

| # | Plan aprobado | Código de T1 | Resolución técnica | Cambio que hay que llevar al ticket marco (commit posterior) |
|---|---|---|---|---|
| C-1 | El costo teórico solo usaba CPP; sin CPP, "Sin costo". | `inventory_item` no tiene columna de costo. | `reference_cost DECIMAL(15,4) NULL`, **por unidad base**, en MXN con IVA. Se admite en Insumo, Intermedio y Reventa (simples o variantes). Un Compuesto o un padre responden 422 (no son ingredientes; P-3). `costoUnitario` sigue el orden CPP (T3) → referencia → sin costo. Un Intermedio con receta vigente se costea siempre por su receta (DT-7). | §2.1 "Costo teórico": añadir el paso de referencia y `reference_cost`. §0: nueva columna en `inventory_item`. |
| C-2 | §0: "un valor nuevo de ENUM rompe la lectura en una imagen anterior". | `base_unit` es `ENUM` (H-1). `main` no lee el inventario (H-10). | `hr` va **al final** del ENUM. La imagen de `main`, la que se usaría en una vuelta atrás de producción, no lee `inventory_item`: sin efecto. Una imagen de T1 (solo existe en desarrollo) falla al leer una fila en `hr`: Prisma lanza un error de valor desconocido y la `api` responde 503 en la lista y la ficha. Mitigación: nota en el README. Para volver a T1 en local, borrar o cambiar esos artículos, o recrear la base local (`db:down`, borrar el volumen, `db:up`, `db:migrate`). La producción nunca corre la imagen de T1, porque la épica llega a `main` con T2 y T3. | §4: fila `inventario_recetas` → "`hr` al final del ENUM; sin efecto en `main`; en desarrollo, nota del README". |
| C-3 | — | — | `inventoriable BOOLEAN NOT NULL DEFAULT true`. Solo un **Insumo** (simple o variante) puede ser no inventariable; el resto responde 422. El cambio se permite mientras no haya movimientos. `store.hasMovements(id)` devuelve `false` hasta T3, como `isInUse` en T1. | §2.2 (T3): rechazar compras y movimientos de un no inventariable e implementar `hasMovements`. §2.3 (T4): costearlo en el lote sin descontarlo. |
| C-4 | El candado serializa, pero no detecta una versión de partida antigua. | — | El cuerpo lleva `baseVersionId` (`null` si no hay receta). Con el candado tomado: si el contenido es igual al de la vigente, 200 sin versión nueva (también cubre el doble envío). Si no, y la base no es la vigente, 409 `RECIPE_VERSION_CONFLICT` con la versión vigente. | §3: añadir el 409 `RECIPE_VERSION_CONFLICT` y `baseVersionId`. |
| C-5 | Sin "usado en". | — | `GET articulos/:id/usado-en`: recetas **vigentes** que lo usan (artículo producido, versión, activo). Una consulta por índice `ingredient_item_id`. | §3: añadir la ruta. |
| C-6 | Sin importación. | La semilla (`api/scripts/inventory-seed-dev.ts`) tiene salvaguardas de host y de `NODE_ENV`. | Comando `inventory:import` (ver A5), con un núcleo testeable en `core`. | §1 y §3: añadir el comando al PR 2 de T2. §4: el procedimiento de `despliegue.md`. |
| C-7 | — | El nombre es único en todo el catálogo (`active_name_key`). | La importación exige nombres completos en las variantes: el JSON ya los trae; el importador solo valida que sean únicos. | Ninguno (ya está en RF-2 de T1). |

Otros cambios para el ticket marco:

- §2.1: transacción de recetas `ReadCommitted` con candado por *upsert*, en lugar de la `Serializable` heredada.
- §2.1: las versiones cerradas se muestran sin costo (PT-4).
- §5: archivos de prueba renombrados (ver Testing).
- Glosario: "inventariable" y "costo de referencia".

### Archivos o componentes afectados

- **PR 1 (dominio y persistencia):**
  - `packages/db/prisma/schema.prisma`;
  - la migración `packages/db/prisma/migrations/<ts>_inventario_recetas/migration.sql` (nueva, revisada a mano);
  - `packages/core/inventory/{units,item-schema,inventory-store,inventory-repository,memory-inventory-store,errors,index}.ts`, que se modifican;
  - `packages/core/inventory/{recipe-schema,recipe-graph,recipe-cost,recipe-repository}.ts`, nuevos;
  - `packages/db/src/prisma-inventory-store.ts`;
  - `packages/contracts/inventory.ts`: solo `INVENTORY_UNITS` con `hr`, para que la prueba de igualdad de H-2 siga en verde.
- **PR 2 (API, importación y semilla):**
  - `packages/contracts/inventory.ts` (campos nuevos del artículo) e `inventory-recipes.ts` (nuevo);
  - `api/src/admin/{inventory-routes.ts,router.ts}` e `inventory-recipe-routes.ts` (nuevo);
  - `packages/core/inventory/master-import.ts` (nuevo);
  - `api/scripts/inventory-import.ts`, `api/scripts/support/inventory-import-cli.ts` y `api/scripts/support/inventory-dev-seed.ts`;
  - el `package.json` de `api` y el de la raíz (script `inventory:import`; el `lint` encadena la comprobación de datos privados);
  - `scripts/check-private-data.ts` en la raíz del monorepo (nuevo);
  - `.gitignore`;
  - `landing-pages/Dockerfile`: una línea `COPY` del comando a la etapa `api`;
  - el fixture ficticio `api/tests/fixtures/inventory-import/ficticio.json`;
  - `docs/despliegue.md` §5.
- **PR 3 (pantallas):**
  - `inventory-manager/src/controllers/inventory.ts` (ficha y formulario) e `inventory-recipes.ts` (nuevo);
  - `inventory-manager/src/routes.ts`;
  - `views/pages/inventory-recipe*.html` y parciales `inventory-recipe-*.html`, nuevos;
  - `inventory-item*.html` y `inventory-section.html` (subnavegación "Recetas");
  - `src/styles/main.css`, solo si el diseño aprobado lo exige;
  - `docs/arquitectura.md` §4 y §6, y `README.md`.

### Modelo de datos y migración `inventario_recetas` (PR 1)

DDL aproximado. Prisma lo genera con `migrate dev --create-only` y se revisa a mano la colación de cada `CREATE TABLE`.

```sql
-- Aditiva. ENUM: valor nuevo al final, sin reconstruir la tabla. Columnas nuevas con INSTANT.
ALTER TABLE `inventory_item` MODIFY `base_unit` ENUM('kg','g','L','ml','pza','hr') NULL, ALGORITHM=INSTANT;
ALTER TABLE `inventory_item` ADD COLUMN `reference_cost` DECIMAL(15,4) NULL,
                             ADD COLUMN `inventoriable` BOOLEAN NOT NULL DEFAULT true, ALGORITHM=INSTANT;

CREATE TABLE `inventory_recipe_version` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `item_id` INTEGER NOT NULL,
  `number` INTEGER NOT NULL,
  `yield_quantity` DECIMAL(13,3) NOT NULL,
  `valid_from` DATETIME(3) NOT NULL,
  `valid_to` DATETIME(3) NULL,
  `current_item_id` INTEGER NULL,            -- = item_id mientras está vigente; NULL al cerrarse
  `note` VARCHAR(400) NULL,
  `created_at` DATETIME(3) NOT NULL,
  `created_by_id` INTEGER NULL,              -- NULL: importación o semilla
  `created_by_name` VARCHAR(60) NOT NULL,
  UNIQUE INDEX `inventory_recipe_version_item_id_number_key`(`item_id`,`number`),
  UNIQUE INDEX `inventory_recipe_version_current_item_id_key`(`current_item_id`),
  INDEX `inventory_recipe_version_item_id_valid_from_idx`(`item_id`,`valid_from`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;

CREATE TABLE `inventory_recipe_line` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `version_id` INTEGER NOT NULL,
  `position` INTEGER NOT NULL,               -- 1..40
  `ingredient_item_id` INTEGER NOT NULL,
  `quantity` DECIMAL(13,3) NOT NULL,         -- neta, en la unidad capturada
  `unit` VARCHAR(30) NOT NULL,               -- unidad del sistema o empaque del ingrediente
  `net_base_quantity` DECIMAL(13,3) NOT NULL,
  `waste_percent` DECIMAL(5,2) NOT NULL,     -- [0, 100)
  `gross_base_quantity` DECIMAL(13,3) NOT NULL,
  `note` VARCHAR(200) NULL,
  UNIQUE INDEX `inventory_recipe_line_version_id_position_key`(`version_id`,`position`),
  UNIQUE INDEX `inventory_recipe_line_version_id_ingredient_item_id_key`(`version_id`,`ingredient_item_id`),
  INDEX `inventory_recipe_line_ingredient_item_id_idx`(`ingredient_item_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;

CREATE TABLE `inventory_lock` (`name` VARCHAR(32) NOT NULL, PRIMARY KEY (`name`))
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;
INSERT INTO `inventory_lock` (`name`) VALUES ('recetas');
-- FK ON DELETE RESTRICT: version.item_id, version.current_item_id y line.ingredient_item_id → inventory_item;
-- line.version_id → inventory_recipe_version; version.created_by_id → user.
```

**Detalles de la migración:**

- **Prisma:**
  - `enum InventoryUnit { … hr }`;
  - en `InventoryItem`: `referenceCost Decimal? @db.Decimal(15,4) @map("reference_cost")` e `inventoriable Boolean @default(true)`;
  - modelos nuevos `InventoryRecipeVersion`, `InventoryRecipeLine` e `InventoryLock`, con relaciones nombradas (`recipeVersions`, `currentRecipe`, `usedInLines`).
  - La línea `note` (200) es nueva respecto del plan: RF-3 pide "nota opcional".
- **MySQL 8.4:**
  - Un valor nuevo **al final** de un ENUM (sin cambiar el tamaño de almacenamiento, < 256 valores) y `ADD COLUMN` (con o sin `DEFAULT`) son INSTANT: solo cambian metadatos, sin copiar ni reconstruir la tabla.
  - `ALGORITHM=INSTANT` explícito hace que MySQL **falle** en lugar de reconstruir en silencio si algún día no aplica.
  - El `MODIFY` no fija `COLLATE`: la columna conserva la de la tabla, igual que en `rol_gerente`. `verify.ts` y `migrations-collation.test.ts` lo vigilan.
  - Los `CREATE TABLE` no bloquean nada existente.
  - La comprobación de divergencia del CI (`migrate diff`) compara el esquema resultante, así que la cláusula `ALGORITHM` escrita a mano no la altera.
- **Unicidad sin índices parciales:**
  - `current_item_id` es único y nulo al cerrar: una sola vigente por artículo, como el patrón `active_name_key`.
  - `(item_id, number)` es único: el número de versión es `max + 1` dentro del candado.
- **Intervalos:**
  - `at = max(now(), vigente.valid_from + 1 ms)`: contiguos y nunca invertidos, aunque el reloj retroceda.
  - La vigente pasa a `valid_to = at, current_item_id = NULL`; la nueva entra con `valid_from = at`.
  - No hay fechas futuras ni fechas que mande el cliente.
- **Vuelta atrás:**
  - Imagen de `main` con `DATABASE_ALLOW_NEWER_SCHEMA`: no lee el inventario, así que funciona sin pasos.
  - Imagen de T1 (solo en desarrollo): ignora las columnas y tablas nuevas, pero falla con filas en `hr` (C-2).
  - Las inserciones de T1 toman los valores por defecto (`inventoriable = true`, costo nulo).
- **Respaldo:** `mysqldump` incluye las tablas, el ENUM y los valores, y la restauración los conserva (CA-14, sonda de QA).

### Dominio (`packages/core/inventory`, PR 1)

- **`units.ts`:**
  - `INVENTORY_UNITS = ['kg','g','L','ml','pza','hr']`, con la magnitud `time` (`hr`, factor 1);
  - una línea en `hr` solo se acepta para un ingrediente cuya base sea `hr`: un empaque con factor podría convertirla, pero no tiene sentido;
  - `equivalences` de un artículo en `hr` queda vacía salvo sus empaques.
- **`item-schema.ts` y `inventory-repository.ts`:**
  - campos `referenceCost: bigint | null` (escala 4, `COST_SCALE = 4`, `parseDecimal` con `scale: 4, integerDigits: 11`, ≥ 0) e `inventoriable: boolean`;
  - validación por tipo (C-1 y C-3);
  - el diff del historial incluye los dos campos (RN-16);
  - cambiar `inventoriable` exige `!hasMovements`.
- **`recipe-schema.ts`:**
  - Valida la entrada: rendimiento > 0 con escala 3, en la base del artículo (P-2).
  - Valida de 1 a 40 líneas, con un artículo por línea y sin repetidos.
  - Valida la cantidad neta > 0 (sin coma; 3 decimales), la merma en [0, 100) con 2 decimales y la nota de 200 caracteres como máximo.
  - Los errores van por campo: `lines.N.quantity`, `lines.N.unit`, `lines.N.ingredient`, `lines.N.wastePercent`.
  - Funciones puras:
    - `netToBase` (`convertToBase`: sin factor, error de la línea; si redondea a 0, error);
    - `gross = divideRounded(net × 10 000, 10 000 − merma_centésimas)` con escala 3, mitad hacia arriba;
    - ayuda inversa `netFromGross` (solo informativa).
- **`recipe-graph.ts`:**
  - Construye la adyacencia de las versiones vigentes en memoria, sustituyendo la de X por las líneas propuestas.
  - (a) Ciclo: un DFS desde los ingredientes de X que busca X y devuelve la ruta con nombres.
  - (b) Profundidad: altura de X más la mayor cadena de recetas que lo usan, con memoria.
  - Más de 8 niveles: `RecipeTooDeepError`. El costo es O(V+E): una consulta, sin recursión en SQL.
- **`recipe-cost.ts`:**
  - `unitCost(item)` con memoria por petición:
    - Intermedio o Compuesto con receta vigente: Σ (bruta × costo del ingrediente), en escala 7 (`multiplyDecimals(g,3,c,4,7)`), dividida por el rendimiento a escala 4 con `divideRounded`;
    - no inventariable: referencia;
    - Insumo, Reventa o Intermedio sin receta: CPP (T3, todavía ausente) → referencia → sin costo.
  - Cada línea devuelve su costo y su origen (`cpp | referencia | receta | sin_costo`).
  - Si falta un costo, la receta es `incomplete`, con `missing`: los artículos hoja sin costo, sin repetir y con la ruta. **Nunca se toma 0.**
  - El costo unitario de cada nivel se redondea a 4 decimales, como el CPP que se guardará en T3.
  - Comprobación con RN-T2-1: 6 kg netos al 40 % → bruta 10.000; 10 × 100 = 1 000; 1 000 / 6.000 = 166.6667.
  - La pantalla redondea a 2 decimales.
- **`recipe-repository.ts`** (`createRecipeRepository({ store, now })`):
  - `listRecipes`, `getRecipe(itemId)` (vigente con costo, historial e "inactivos"), `getVersion(id)` (líneas, sin costo; PT-4), `usedIn(itemId)`, `ingredientOptions()`, `saveVersion(itemId, input, author)` y `closeRecipe(itemId, { baseVersionId }, author)`.
  - Reglas:
    - RN-T2-2: el artículo es Intermedio o Compuesto y no es padre; si no, `RecipeNotAllowedError` (409). Si está inactivo no admite versiones nuevas (409 `RECIPE_ITEM_INACTIVE`), pero sí cerrar.
    - RN-T2-3: ingredientes activos, de tipo Insumo, Intermedio o Reventa, no padres. Un inactivo se rechaza en la línea, también si venía de la versión anterior (RF-7).
    - Ciclo y profundidad.
    - Igualdad de contenido: devuelve la vigente sin crear versión.
    - Conflicto de la versión de partida (C-4).
    - Historial: `inventory_change(entity 'recipe', entity_id = artículo, action 'new_version' | 'close', changes = [número, rendimiento, n.º de líneas])`. La versión completa ya es inmutable en sus tablas.
- **`isInUse` (RN-4):** `EXISTS` versión con `item_id` o `EXISTS` línea con `ingredient_item_id`, de cualquier versión. Dos consultas por índice.
- **Inactivar usado (RF-7, CA-10):**
  - `deactivateItem` reúne el artículo y, si es padre, sus variantes activas.
  - Si alguno está en líneas de versiones vigentes y no llega `recipes: 'keep'`, responde `ItemInActiveRecipesError` con la lista `{ itemId, name }` (409 `ITEM_IN_ACTIVE_RECIPES`).
  - Con la confirmación lo inactiva sin tocar las versiones.
  - Inactivar un Intermedio no cierra su receta.
- **Coste de la lista (RF-1):**
  - Tres consultas por petición:
    - versiones vigentes con sus líneas;
    - los artículos que intervienen (id, tipo, clase, base, empaques, referencia, inventariable, activo y nombre);
    - (T3) los CPP.
  - Después, el cálculo en memoria con memoria compartida: O(V+E), unas decenas de recetas y unos cientos de líneas. Sin N+1 y sin caché (DT-7).
  - El filtro por tipo, la búsqueda y la paginación (50, como los artículos) se aplican en memoria sobre ese resultado.

### Persistencia (store, PR 1)

- **Mismo store, contrato ampliado** (`InventoryStoreReader` y `InventoryStoreTx`; memoria y Prisma):
  - `currentRecipeGraph()`, `recipeVersions(itemId)`, `version(id)`, `usedIn(itemId)`;
  - `insertVersion(...)` con sus líneas y `closeVersion(id, at)`: la **única** escritura sobre una versión cerrada;
  - `lockRecipes()`, `hasMovements()` (`false`) e `isInUse` real.
  - No hay más `update` ni `delete` sobre las tablas de recetas.
- **Transacción de recetas:**
  - `store.recipeTransaction(task)`: `ReadCommitted`, `maxWait 5000`, `timeout 10000`, con el mismo reintento acotado ante 1213/P2034.
  - Primera sentencia: el candado `INSERT INTO inventory_lock (name) VALUES ('recetas') ON DUPLICATE KEY UPDATE name = name`. Bloquea en exclusiva la fila, exista o no (H-9), y serializa las escrituras de recetas.
  - Con `ReadCommitted`, cada lectura posterior ve lo último confirmado. En A→B y B→A simultáneos, la segunda ve la primera y se rechaza por ciclo (CA-6).
  - Se evita `Serializable`, que convierte las lecturas en bloqueos compartidos y provoca interbloqueos. Es coherente con DT-13.
- **Orden de bloqueo:** siempre el candado `recetas` primero y después las filas de artículos.
  - `updateItem` y `deactivateItem` de T1 (que siguen en `Serializable`) toman el candado como primera sentencia, porque consultan el uso en recetas.
  - Esto evita la carrera "inactivar el ingrediente mientras otra sesión lo añade a una receta".
  - Volumen bajo: el costo de serializar es despreciable.
- **Errores:**
  - Si la espera del candado se agota (1205: 5 s en pruebas, 10 s en producción), 503 `INVENTORY_BUSY` (el código ya previsto en T3), sin reintento.
  - Un choque con el único de `current_item_id` o de `(item_id, number)` es imposible dentro del candado. Si ocurre, se trata como conflicto (409) y nunca como 500.
  - Los errores inesperados pasan a `DatabaseUnavailableError` (503), sin registrar el `message` de Prisma.
- **Decimales:** se leen con `toFixed(n)` y `parseDecimal`, y se escriben como texto con `formatDecimal`. Core no ve `Prisma.Decimal`.

### Contratos y rutas de la API (PR 2)

Todas las rutas van bajo `/api/v1/admin/inventario/` y usan `access.inventory(ctx, { write })`: 401 → 403 `FORBIDDEN_ROLE` (Editor) → CSRF 403 en las escrituras. JSON cerrado (Zod), decimales como texto, errores con el formato central.

| Método y ruta | Uso | Respuestas propias |
|---|---|---|
| `GET recetas?tipo=&q=&pagina=` | RF-1: artículo, tipo, rendimiento y unidad, costo unitario o `null` con `missingCount`, `validFrom`, `usesInactive` | 422 de filtros |
| `GET articulos/:id/recetas` | RF-2: vigente (líneas con neta, bruta, costo y origen; `missing`) y lista de versiones (número, intervalo, autor) | 404, 409 `RECIPE_NOT_ALLOWED` |
| `GET recetas/versiones/:id` | Una versión del historial (solo lectura, sin costo; PT-4) | 404 `RECIPE_VERSION_NOT_FOUND` |
| `POST articulos/:id/recetas` | RF-3 y RF-4: `{ baseVersionId, yieldQuantity, note, lines: [{ ingredientId, quantity, unit, wastePercent, note }] }`, `Idempotency-Key` | 201 creada; 200 sin cambios; 422 `VALIDATION_FAILED` (`fields` por línea), 422 `RECIPE_CYCLE` (`path`), 422 `RECIPE_TOO_DEEP`; 409 `RECIPE_NOT_ALLOWED`, `RECIPE_ITEM_INACTIVE`, `RECIPE_VERSION_CONFLICT` (`current`); 503 `INVENTORY_BUSY` |
| `POST articulos/:id/recetas/cerrar` | RF-4: `{ baseVersionId }`. Sin vigente: 200 idempotente | 409 `RECIPE_VERSION_CONFLICT` |
| `GET articulos/:id/usado-en` | RF-8 (C-5) | 404 |
| `GET recetas/ingredientes` | Opciones del editor: activos, de tipo permitido, con su base y sus empaques | — |
| `PUT articulos/:id` y `POST articulos` (T1) | Más `referenceCost` (texto o `null`) e `inventoriable` | 422 por campo |
| `POST articulos/:id/desactivar` (T1) | Más `recipes: 'keep'` | 409 `ITEM_IN_ACTIVE_RECIPES` (`recipes: [{ itemId, name }]`) |

- **Contratos:** `packages/contracts/inventory-recipes.ts` (nuevo). `inventory.ts` añade `hr`, `referenceCost` e `inventoriable` al artículo.
- **Impacto en T1:**
  - Las pruebas de `admin-inventory-api.test.ts` e `inventory.test.ts` que comparan la forma exacta del artículo se **modifican**: no cuentan como pruebas nuevas.
  - La `api` y el admin se despliegan del mismo commit, así que no hay mezcla de contratos.
- **Logs:** `inventory_recipe_saved { itemId, versionNumber, action }`, `inventory_recipe_conflict { itemId }` e `inventory_recipe_cycle { itemId, depth }`. Nunca cantidades, costos ni nombres.

### A5 — Importación única (PR 2)

- **Comando:** `npm run inventory:import -- --archivo <ruta|-> [--escribir] [--produccion]`, que en la `api` ejecuta `node --env-file-if-exists=.env scripts/inventory-import.ts`. En la imagen `api`: `node scripts/inventory-import.ts`.
- **Modos:**
  - Sin `--escribir`, **ensayo**: valida todo, calcula el plan (qué crearía, qué ya existe igual y qué choca) y no abre ninguna transacción de escritura.
  - Con `--escribir`, una sola `store.transaction` todo o nada (`timeout` 60 s para este caso; se mide en QA).
- **Salvaguardas:**
  - Con `NODE_ENV=production` exige además `--produccion`: el VPS es el destino legítimo, porque el contenedor `api` siempre es `production`.
  - Fuera de producción, solo con bases locales (`DEV_SEED_HOSTS`, como la semilla).
  - Usa `DATABASE_URL`, el usuario solo DML: la importación solo hace DML.
  - Ejecuta `verifyDatabase` antes; no migra.
  - Archivo de 2 MB como máximo y JSON estricto.
  - Rechaza un archivo con `"ficticio": true` si lleva `--produccion` (la marca del fixture de pruebas).
- **Formato** (versión 1; decimales siempre como texto; `fila` = referencia al origen para los mensajes):

```json
{
  "formato": "inventario-importacion", "version": 1, "ficticio": true,
  "correcciones": [{ "original": "Tortiya", "corregido": "Tortilla", "motivo": "ortografía" }],
  "categorias": [{ "nombre": "Abarrotes", "fila": "Ing!2" }],
  "articulos": [{ "nombre": "Harina ficticia", "tipo": "insumo", "categoria": "Abarrotes",
                  "unidadBase": "gr", "empaques": [{ "nombre": "bulto", "factor": "25000" }],
                  "costoReferencia": "0.0200", "inventariable": true, "sku": null, "fila": "Ing!3" }],
  "padres": [{ "nombre": "Refresco ficticio", "tipo": "reventa", "categoria": "Bebidas", "fila": "Prod!20",
               "variantes": [{ "nombre": "Refresco Marca Sabor 600 ml", "unidadBase": "pza",
                               "costoReferencia": "15.0000", "fila": "Prod!21" }] }],
  "recetas": [{ "articulo": "Salsa ficticia", "rendimiento": "2.000", "nota": null, "fila": "Rec!5",
                "lineas": [{ "ingrediente": "Harina ficticia", "cantidad": "500", "unidad": "gr",
                             "merma": "0.00", "nota": null, "fila": "Rec!6" }] }]
}
```

- **Proceso:**
  1. Lee y valida el esquema con Zod (claves desconocidas = error).
  2. Aplica `correcciones`: coincidencia exacta tras recortar, sobre todos los nombres y referencias. Una corrección que no se usa se avisa.
  3. Recorta los nombres y normaliza las unidades (`gr`→`g`, `lt`→`L`; `kg`, `ml`, `pza` y `hr` sin cambios; el resto, error).
  4. Valida con las **mismas** funciones de core (`validateItemFields`, `recipe-schema`, `recipe-graph`): tipos, referencias, ciclos (con su ruta), rendimiento > 0, merma en [0, 100), costos ≥ 0, nombres únicos (`nameKey`) y SKU únicos.
  5. Si hay un error, nada se escribe y se listan **todos** los errores como `fila`, campo y mensaje, sin valores.
- **Transformación de la mezcla cruda:**
  - La neta × 0.6 y la merma del 40 % ya vienen calculadas en el JSON revisado, porque se genera fuera.
  - El código no tiene ninguna regla fija sobre la carne ni sobre nombres. Las variantes de refrescos ya traen su nombre completo (C-7).
- **Idempotencia** (clave = `nameKey`):
  - Un artículo o una categoría igual, en todos los campos importados, se omite.
  - Una receta cuya vigente tiene el mismo contenido se omite.
  - Cualquier diferencia es un **conflicto**: se informa por `fila` y campo, y con `--escribir` no se escribe nada (PT-2).
  - La repetición con los mismos datos termina con "0 creados".
- **Registro:**
  - Las recetas se crean como versión 1, vigente desde la importación.
  - Autor `{ id: null, name: 'Importación' }` en `inventory_change` (artículos `create`; recetas `new_version`) y en `created_by_name`.
  - Logs y salida: solo conteos (`categorias`, `articulos`, `variantes`, `recetas`, `lineas`, `omitidos`, `conflictos`, `errores`), sin costos, nombres ni contenido.
- **Núcleo:** `core/inventory/master-import.ts` (puro: `parse`, `plan` y `apply(tx, plan, author)`), probado con el store en memoria. El script solo hace la E/S, las salvaguardas y la conexión.
- **Barrera contra la fuga de datos reales (A5, H-11):**
  1. `.gitignore`: `*.xlsx`, `*.xls`, `*.ods`, `~$*` y `/datos-privados/` (carpeta local sugerida para el JSON real, fuera de `restaurante/`).
  2. `scripts/check-private-data.ts`, encadenado en `npm run lint`, así que corre en local y en el job de calidad del CI.
     - Falla si `git ls-files` contiene una hoja de cálculo.
     - Falla si un JSON versionado tiene `"formato": "inventario-importacion"` sin `"ficticio": true` o fuera de `api/tests/fixtures/inventory-import/`.
  3. La regla de no usar `git add -A` ni `.` ya existe en el flujo.
  4. Propuesta aparte: ignorar también `.claude/worktrees/`.
- **Producción** (`despliegue.md` §5; solo cuando la épica esté en `main`, después de T3; PT-5):
  1. `scp` del JSON a `~/` del administrador; `chmod 600`.
  2. Ensayo: `$C exec -T api node scripts/inventory-import.ts --archivo - --produccion < ~/inventario.json`.
  3. Si no hay errores ni conflictos, lo mismo con `--escribir`.
  4. `shred -u ~/inventario.json` (o `rm`) y comprobar que no quedó copia.
  5. No hace falta un respaldo previo distinto del diario, porque la importación es todo o nada. Se recomienda lanzar el volcado a mano antes.
- **Pruebas:** con el fixture ficticio de estructura idéntica, ver Testing. Nunca con datos reales.

### Semilla de desarrollo (PR 2)

`inventory-dev-seed.ts` se amplía, siempre con datos ficticios:

- "Mano de obra ficticia" (`hr`, no inventariable, con costo de referencia);
- costos de referencia en la mayoría de los insumos y uno **sin** costo;
- recetas:
  - "Salsa base" (Intermedio);
  - "Carne cocida ficticia" (Intermedio, 6.000 kg netos al 40 %, rendimiento de 6 kg);
  - "Taco ficticio" (Compuesto, que usa las dos anteriores: 2 niveles), que incluye la mano de obra y el insumo sin costo, para ver "Sin costo".

Sigue siendo idempotente ("si ya hay artículos, no hace nada"). La api nunca la ejecuta. Proveedores, existencias y mínimos ficticios: entradas de T3 y T4, sin nada ahora.

### Frontend (PR 3) y Stitch

- **Pantallas** (SSR, sin JavaScript obligatorio):
  1. Lista de recetas, con filtro GET por tipo y búsqueda, tabla con `caption` y mensaje vacío.
  2. Receta del artículo: vigente, costo por unidad o "Sin costo" con la lista de faltantes, origen del costo por línea, aviso de ingredientes inactivos, botones "Nueva versión" y "Cerrar receta", e historial.
  3. Editor de versión:
     - cabecera con el rendimiento y la unidad base (solo lectura) y la nota;
     - 10 filas por bloque hasta 40;
     - "Añadir 10 filas", un botón `submit` con `name=accion value=filas` que vuelve a pintar el formulario **con lo escrito**, sin guardar;
     - ingrediente con `<input list>` y un único `<datalist>` de nombres activos: unas 100 opciones una sola vez, no 40 `<select>`; el servidor resuelve el nombre;
     - unidad con `<input list>` de las unidades del sistema y los empaques;
     - neta, merma (%) y nota;
     - tras guardar o previsualizar con errores, la bruta y el costo por línea;
     - ayuda fija "neta = cantidad aprovechable tras la merma; si pesaste en crudo, escribe la cocida o deja merma 0";
     - `error-summary` con un enlace a cada campo.
  4. Avisos:
     - ciclo, con la ruta;
     - inactivos;
     - conflicto 409: banner con un enlace a la vigente; el formulario conserva lo escrito y se puede "Guardar de todos modos" con la nueva `baseVersionId`, como en T1;
     - `api` caída: se conserva lo escrito.
  5. Historial: versión en solo lectura.
  6. Confirmación de cierre.
  7. En T1:
     - la ficha muestra el costo de referencia, el inventariable, "Usado en" y el enlace a la receta;
     - el formulario incluye el costo de referencia, la casilla inventariable (solo Insumo) y la opción `hr`;
     - la página de inactivar lista las recetas afectadas con la confirmación `recipes=keep`;
     - la subnavegación añade "Recetas".
- **Móvil (360 px):** la tabla de líneas pasa a tarjetas por fila (`fieldset` por línea con `legend` "Línea N"). En escritorio se muestra como tabla. Foco visible, errores con texto e icono además del color, y el orden de tabulación natural.
- **Sistema visual:** tokens `@theme` del admin y parciales `row-fieldset`, `field-input`, `field-select`, `field-error`, `field-help`, `error-summary*`, `inventory-section`, `inventory-pagination` e `inventory-post-button`. No se inventan colores ni tipografías.
- **Stitch** (`.claude/rules/stitch-diseno.md`):
  1. Se revisó `_stich_source_/`, que no tiene un diseño equivalente del admin (H-12): procede usar Stitch.
  2. Antes de diseñar se carga la skill `frontend-design-direction` (`references/web-calidad-de-diseno.md`).
  3. Se envía el brief de abajo, solo con datos ficticios y sin credenciales ni datos reales. La clave nunca se imprime ni se copia.
  4. Lo que devuelva Stitch es un dato no confiable: se traduce a SSR, Tailwind, BEM y los parciales existentes, y no se copia su código.
  5. La propuesta (capturas y decisiones de UI/UX, y en qué se aparta del sistema actual) se presenta al usuario **antes** del PR 3. Se guarda en `_stich_source_/admin-recetas/` solo con su autorización expresa.
  6. Los PR 1 y 2 no esperan al diseño.
- **Brief para Stitch** (datos ficticios):

  > Admin interno de un restaurante (tema oscuro existente: fondo #1c1412, tarjetas #261a17/#33221e, borde #432c27, contorno de campos #ab8985, texto #fbf5ea/#d6c3b3, acento rojo #b91c1c, aviso ámbar #eab308, error #ffb4ab; títulos y texto en Epilogue, etiquetas en Space Grotesk en mayúsculas). Diseña, mobile-first (360 px) y escritorio (1280 px), cuatro pantallas de "Inventario → Recetas" para un gerente: (1) Lista de recetas: filtro por tipo (Intermedio/Compuesto) y búsqueda; columnas artículo, tipo, rendimiento ("2.000 kg"), costo por unidad ("$50.00 / kg" o una etiqueta "Sin costo" con texto, no solo color), fecha de la versión vigente y un aviso "usa artículos inactivos"; estado vacío. (2) Receta de "Taco ficticio": versión 3 vigente desde 19/11/2026, rendimiento 1 pza, costo $18.40/pza; tabla de líneas (ingrediente, neta, unidad, merma %, bruta, costo, origen "referencia"/"receta"); bloque "Ingredientes sin costo: Cebolla ficticia"; acciones "Nueva versión" y "Cerrar receta"; historial de versiones (número, vigencia desde/hasta, autor). (3) Editor de versión: cabecera con rendimiento y unidad base fija y nota; filas de líneas (ingrediente con autocompletado nativo, cantidad neta, unidad, merma %, nota) en bloques de 10 con botón "Añadir 10 filas" que no usa JavaScript; en escritorio tabla, en móvil una tarjeta por línea con encabezado "Línea N"; ayuda visible "neta = cantidad aprovechable tras la merma" con un ejemplo (6.000 kg netos al 40 % = 10.000 kg brutos); resumen de errores arriba con enlaces y error bajo cada campo; avisos: ciclo ("Salsa base → Taco ficticio → Salsa base"), ingrediente inactivo, conflicto ("otra persona guardó la versión 4: revisa antes de guardar") con lo escrito conservado. (4) Historial: una versión cerrada en solo lectura. Accesible (WCAG 2.2 AA): foco visible, objetivos ≥ 24 px, contraste AA, sin depender del color. Sin gráficos, sin modales obligatorios, sin animaciones.

### Seguridad

- Permisos de Administrador y Gerente en todas las rutas (CA-12). El Editor recibe 403 en la API y en el admin, y no se escribe nada.
- Las entradas se validan en el borde (Zod) y en core.
- El ciclo y la profundidad se validan en el servidor.
- El escape `{{ }}` en todas las vistas.
- No se registran cantidades, costos, nombres ni contenido del JSON.
- La importación tiene salvaguardas de `NODE_ENV`, host y bandera. Lee por stdin en el VPS y no deja copia en el contenedor.
- Barrera de git y de lint para los datos reales.
- Sin dependencias nuevas.
- Sin cambios en `deploy/`: la suma `591de8e7…5cc7f0` no cambia, y lo comprueba QA. El Dockerfile está en `landing-pages/` y no entra en esa suma.

### Testing (pruebas permanentes funcionales; cada archivo < 20 s)

| PR | Archivo | Casos |
|---|---|---|
| 1 | `api/tests/unit/inventory-recipes.test.ts` (nuevo, store en memoria) | CA-1; CA-2 (0 %, 99.99 %, 100 % rechazado); CA-3 (g→kg y pza sin factor); RN-T2-1 (166.6667); CA-4 (directo, indirecto con su ruta, 9 niveles); CA-5 (v2 cierra la v1 con intervalos contiguos, sin cambios no hay versión, cerrar); conflicto de la versión de partida y doble envío; CA-7; CA-8; CA-9 (`hr` no inventariable); CA-10 (RN-4, 409 con lista, confirmación, cascada de un padre); CA-11; ingrediente inactivo rechazado en la versión nueva; validación del costo de referencia y del inventariable por tipo |
| 1 | `landing-pages/tests/integration/prisma-inventory-recipes.test.ts` (nuevo, MySQL) | Ida y vuelta exacta de los DECIMAL, `hr`, inventariable y referencia; transacción fallida sin restos; `isInUse` e `usedIn` reales; **A→B y B→A simultáneos: uno falla por ciclo** (CA-6, plan §5; PT-1); dos versiones simultáneas del mismo artículo: una vigente y la otra 409 |
| 2 | `api/tests/integration/admin-inventory-recipes-api.test.ts` (nuevo) | CA-12 (Editor 403 en lectura y escritura, sin sesión 401, sin CSRF 403); Gerente y Administrador sí; 422 `RECIPE_CYCLE` con `path`; 409 `RECIPE_NOT_ALLOWED`, `RECIPE_VERSION_CONFLICT` con `current`, `ITEM_IN_ACTIVE_RECIPES` con lista; `Idempotency-Key` (misma clave, una versión); "usado en"; campos nuevos del artículo |
| 2 | `api/tests/unit/inventory-import.test.ts` (nuevo, memoria y fixture ficticio) | CA-13: el ensayo no escribe; conteos esperados; la repetición da 0; ciclo o unidad inválida no escriben y listan errores con `fila`; variantes únicas; `gr`/`lt`; correcciones aplicadas; conflicto sin escritura; salvaguardas (`production` sin `--produccion`, host remoto, `ficticio` en producción) |
| 2 | `landing-pages/tests/integration/prisma-inventory-import.test.ts` (nuevo, MySQL) | Fixture ficticio: escritura todo o nada en MySQL, autor "Importación" en el historial y repetición sin cambios |
| 2 | `admin-inventory-api.test.ts` (se modifica) | Forma del artículo con `referenceCost` e `inventoriable` |
| 3 | `inventory-manager/tests/integration/inventory-recipes.test.ts` (nuevo, doble de la API) | Editor sin JavaScript (40 filas y "Añadir 10 filas" conservando lo escrito); errores por línea con texto; "Sin costo" con faltantes; conflicto que conserva lo escrito; `api` caída; Editor 403; inactivar con lista y confirmación; ficha con "Usado en" |
| 3 | `inventory-manager/tests/integration/inventory.test.ts` (se modifica) | Campos nuevos del formulario |

**Se descartan** (sondas de QA, con el resultado en el QA Report):

- vuelta atrás con la imagen de `main` y con `DATABASE_ALLOW_NEWER_SCHEMA`, y el efecto de C-2 con la imagen de T1;
- respaldo y restauración (CA-14);
- carreras extra (inactivar y añadir a la vez, el cambio de unidad frente a una línea nueva);
- EXPLAIN de `usado-en` e `isInUse`;
- el tiempo de la importación del fixture ampliado;
- la comprobación de `INSTANT` (`information_schema.INNODB_TABLES.TOTAL_ROW_VERSIONS`);
- 360 px, teclado, sin JavaScript y axe (CA-15);
- regresión de las landings, el bot, el menú y T1 (CA-16);
- mutaciones;
- `check-private-data` con un `.xlsx` de prueba sin commitear.

### Orden de implementación y partición

Se confirman los 3 PR hacia `epic/inventario` (decisión 11). Cada uno sale de la punta de la épica.

1. **PR 1:** migración, dominio, store, `isInUse` y las pruebas de la fila 1.
   - Base para todo lo demás.
   - Tamaño M.
2. **PR 2:** contratos, rutas, campos de la ficha en la API, importación, barrera, semilla, Dockerfile, `despliegue.md` §5 y la parte del README de los comandos.
   - Tamaño M/L.
   - Si en la implementación pasa de unas 1 500 líneas, se propone separar la importación en un PR 2b (PT-6).
3. **PR 3:** pantallas, `arquitectura.md` §4 y §6, el README (C-2 en desarrollo) y las pruebas del admin.
   - Espera la aprobación del diseño en Stitch.
   - El brief se envía en cuanto se apruebe este plan, en paralelo con el PR 1.

### Documentación

- `arquitectura.md` §4 (recetas, costo y candado en `core/inventory`) y §6 (rutas).
- `despliegue.md`:
  - §5: importación única;
  - §6: la migración no requiere pasos de vuelta atrás.
- `README.md`:
  - `inventory:import` (ensayo y escritura) y la semilla ampliada;
  - el aviso C-2 al alternar entre ramas en desarrollo;
  - dónde guardar el JSON real (fuera del repositorio).
- `.env.example`: sin cambios (sin variables nuevas).
- **Propuestas para `.claude/`** (solo con autorización):
  - `CLAUDE.md` §8: recetas y costo teórico en la `api` y el admin;
  - `senior-fullstack.md` (Persistencia y API): recetas, candado e importación;
  - una línea en `rules/git.md` o una regla nueva: "datos reales del negocio nunca en el repositorio; `check-private-data` en el lint";
  - `.gitignore` de `.claude/worktrees/`.

### Riesgos técnicos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Merma contada dos veces (RN-T2-1) | Ayuda de captura y bruta visible por línea. El JSON trae la neta ya transformada y QA la revisa contra el costo del libro. |
| `hr` al alternar ramas en desarrollo (C-2) | Nota en el README. Producción no se ve afectada (H-10). |
| Fuga del libro o del JSON real | `.gitignore`, `check-private-data` en el lint y el CI, `--archivo -` en el VPS y borrado después. |
| Interbloqueos y esperas | Candado único primero, `ReadCommitted`, reintento ante 1213 y 503 ante 1205. Volumen bajo. |
| Transacción de importación larga (pool de 5) | Una sola ejecución, fuera de horas, con `timeout` de 60 s. QA la mide con un fixture de 150 artículos y 40 recetas. |
| Empaque llamado "hr" ya existente | QA lo comprueba antes de migrar (en desarrollo). Producción vacía. |
| Retraso del diseño | Solo bloquea el PR 3. |
| Divergencia con `main` | PR de integración `main` → épica (`git.md`). |

### Qué hace cada agente

- **senior-fullstack:** PR 1 a 3, envío del brief a Stitch y presentación de la propuesta, T4 de cada PR y propuestas de `.claude/`.
- **senior-qa:** plan y QA por PR, con las sondas descartables, la vuelta atrás, el respaldo, la suma de `deploy/`, la revisión del JSON ficticio y la barrera con un `.xlsx` de prueba.
- **Sesión principal:** aprobaciones (este plan, PT-1 a PT-7 y el diseño).
- **Usuario:** revisa la tabla de correcciones del JSON real, aprueba el diseño, decide cuándo importar en producción y ejecuta el procedimiento de §5 (o lo delega).

### Criterios de finalización (DoD por PR)

- **Todos los PR:**
  - `build:css` (si aplica), `typecheck`, `lint` (con `check-private-data`) y `test` en verde;
  - CI con `calidad`, `docker`, `auditoria` y `pruebas` en `pass`;
  - suma de `deploy/` sin cambios;
  - sin pruebas no funcionales commiteadas;
  - criterios del PR con evidencia.
- **PR 1:**
  - migración aditiva con la colación revisada y `INSTANT` comprobado;
  - costo exacto contra un cálculo a mano (CA-1, CA-3 y RN-T2-1);
  - ciclo rechazado, también en concurrencia;
  - vuelta atrás con la imagen de `main` comprobada.
- **PR 2:**
  - CA-12 y CA-13 con evidencia;
  - procedimiento de `despliegue.md` §5 ejecutado en local, tal como está escrito, contra el contenedor `api` construido (ensayo y escritura con el fixture);
  - barrera probada con un `.xlsx` sin commitear.
- **PR 3:**
  - diseño aprobado;
  - CA-15 (360 px, teclado, sin JavaScript, axe) y CA-16;
  - documentación actualizada.

### Decisiones técnicas para el usuario (con recomendación)

- **PT-1.** ¿La prueba de concurrencia A→B y B→A en MySQL queda como permanente?
  - Recomendado: **sí**, una sola. El plan aprobado (§5) la incluye y protege la integridad (CA-6).
  - Las demás carreras quedan como sondas de QA.
- **PT-2.** Importación con conflictos (un dato existente distinto):
  - recomendado: **abortar todo** con la lista;
  - alternativa: escribir solo lo nuevo y omitir los conflictos.
- **PT-3.** Un Intermedio cuya receta se cerró:
  - recomendado: se costea por CPP (T3) o, si no lo tiene, por su **costo de referencia**, y solo sin ninguno de los dos queda "Sin costo";
  - el caso límite del ticket supone que no tiene referencia.
- **PT-4.** Las versiones cerradas del historial:
  - recomendado: **sin costo**, solo líneas, neta y bruta, para no mezclar con los costos de hoy;
  - alternativa: con el costo actual y la etiqueta "a costos de hoy".
- **PT-5.** Importación en producción:
  - recomendado: **solo cuando la épica llegue a `main`**, tras T3, porque antes la producción no tiene las tablas;
  - mientras tanto, importar el JSON real en la base **local** para revisarlo en pantalla.
- **PT-6.** Partición:
  - recomendado: **3 PR**, como se aprobó;
  - la importación pasa a un PR 2b solo si el PR 2 resulta demasiado grande.
- **PT-7.** Alcance del atributo y del costo:
  - recomendado: **no inventariable solo en Insumo**;
  - **costo de referencia en Insumo, Intermedio y Reventa** (no en Compuesto ni en padre).

## Implementation Result — PR 1

### Rama

`feature/REQ-F-050-recetas-modelo-dominio`, desde `origin/epic/inventario` (`0c3c293`). Sin commit (pendiente de aprobación y QA). PR hacia `epic/inventario`.

### Cambios realizados

- **Migración** `packages/db/prisma/migrations/20261119200000_inventario_recetas/migration.sql` (generada con `prisma migrate diff` y revisada a mano):
  - `hr` al final del ENUM `base_unit` y `reference_cost DECIMAL(15,4) NULL` e `inventoriable BOOLEAN NOT NULL DEFAULT true`, con `ALGORITHM=INSTANT` explícito;
  - tablas `inventory_recipe_version`, `inventory_recipe_line` e `inventory_lock` en `utf8mb4_es_0900_as_cs`, con sus FK `RESTRICT`, y la fila `recetas`.
  - `schema.prisma`: `hr`, los dos campos y los modelos `InventoryRecipeVersion`, `InventoryRecipeLine` e `InventoryLock`.
- **Unidades:** `hr` (magnitud `time`, sin conversión) en `core/inventory/units.ts` y en `contracts/inventory.ts` (la prueba de igualdad sigue en verde).
- **Dominio** (`packages/core/inventory`):
  - `recipe-schema.ts`: forma de versión y línea, validación por campo (`lines.N.ingredient|quantity|unit|wastePercent|note`), conversión a la base, bruta = neta / (1 − merma) con mitad hacia arriba, ingredientes permitidos e igualdad de contenido;
  - `recipe-graph.ts`: ciclo con su ruta y profundidad (> 8 niveles se rechaza), en memoria, O(V+E);
  - `recipe-cost.ts`: costo multinivel exacto (`bigint`, escala 7 por línea y 4 por unidad), orden no inventariable → referencia; receta vigente → receta; si no, CPP → referencia → sin costo (PT-3), faltantes con su ruta, nunca 0;
  - `recipe-repository.ts`: lista, receta con costo, versión sin costo (PT-4), "usado en", opciones de ingrediente, guardar versión y cerrar receta;
  - `item-schema.ts` e `inventory-repository.ts`: `referenceCost` e `inventoriable` con las reglas de PT-7 (ausentes en una edición, se conservan), en el historial; `updateItem` y `deactivateItem` toman primero el candado; inactivar algo usado en recetas vigentes exige `recipes: 'keep'` (`ItemInActiveRecipesError` con la lista, también en cascada de un padre).
  - Errores nuevos en `errors.ts`; `RECIPE_ACTIONS` (`new_version`, `close`) aparte de `INVENTORY_ACTIONS`, para no cambiar el contrato del historial del artículo.
- **Persistencia** (`packages/db/src/prisma-inventory-store.ts` y el store en memoria): `recipeTransaction` READ COMMITTED; candado por upsert `INSERT … ON DUPLICATE KEY UPDATE`; reintento ante 1213; 1205 → `InventoryBusyError`; choque de únicos → `RecipeVersionConflictError`; `isInUse` real (versiones o líneas, de cualquier versión); `hasMovements` = false hasta T3; las versiones solo se cierran.
- **Barrera de datos privados** (adelantada del PR 2): `.gitignore` (`*.xlsx`, `*.xlsm`, `*.xls`, `*.ods`, `~$*`, `/datos-privados/`) y `restaurante/scripts/check-private-data.ts`, encadenado al inicio de `npm run lint` (y por tanto en el job de calidad del CI). `restaurante/tsconfig.json` lo incluye en el typecheck.

### Criterios de aceptación (alcance del PR 1)

- CA-1, CA-2, CA-3, CA-4, CA-5, CA-7, CA-8, CA-9 y CA-11: cumplidos en el dominio (prueba unitaria).
- CA-6: cumplido en MySQL (A→B / B→A y dos versiones simultáneas).
- CA-10: cumplido en el dominio (RN-4, lista, confirmación y cascada). El 409 HTTP llega en el PR 2.
- CA-12, CA-13, CA-15 y RF-12: PR 2 y PR 3.
- CA-14 y CA-16: sondas de QA.

### Validaciones ejecutadas

- `npm run build:css`: 0.
- `npm run typecheck`: 0.
- `npm run lint` (con `check-private-data`): 0; "835 archivos revisados, sin datos privados".
- `npm test`: api 53 archivos y 1227 pruebas; landing-pages 63 y 901; inventory-manager 17 y 287. Todo en verde.
- Pruebas nuevas: `api/tests/unit/inventory-recipes.test.ts` (17 casos, unos 0.2 s) y `landing-pages/tests/integration/prisma-inventory-recipes.test.ts` (4 casos, unos 3.6 s; 5 ejecuciones seguidas en verde).
- Mutación descartable: con el candado sustituido por `SELECT 1`, las 2 pruebas de concurrencia fallan en 3 de 3 ejecuciones; restaurado.
- INSTANT en MySQL 8.4, sonda descartable sobre una base con las migraciones de T1 y filas:
  - `TABLE_ID` igual antes y después (sin reconstruir la tabla);
  - `TOTAL_ROW_VERSIONS` de 0 a 1 (el ADD COLUMN instantáneo);
  - `ALGORITHM=INSTANT` aceptado en los dos ALTER;
  - `base_unit` conserva `utf8mb4_es_0900_as_cs` y las 8 tablas de inventario están en esa colación.
  - Base borrada.
- `prisma migrate diff` (migraciones → esquema): "This is an empty migration" (sin divergencia).
- Suma de `deploy/`: `591de8e7f259073f79ff34418c8b7a3a2680d465ef3bc7378c620221455cc7f0`, sin cambios.
- Barrera, sondas descartables:
  - `git check-ignore` ignora `Datos de entrada.xlsx`, un `.xlsx` de prueba y `datos-privados/inventario.json`; `git add` del `.xlsx` se rechaza;
  - con `git add -f`, `npm run lint` termina con 1 y nombra el archivo;
  - un JSON con `"formato": "inventario-importacion"` sin `ficticio` y uno ficticio fuera de `api/tests/fixtures/inventory-import/` hacen fallar el lint;
  - después se sacaron del índice y se borraron.

### Archivos afectados

`.gitignore`; `restaurante/package.json`, `tsconfig.json`, `scripts/check-private-data.ts`; `packages/db/prisma/schema.prisma` y la migración; `packages/db/src/prisma-inventory-store.ts`; `packages/core/inventory/{units,decimal,errors,index,item-schema,inventory-store,inventory-repository,memory-inventory-store}.ts` y `recipe-{schema,graph,cost,repository}.ts`; `packages/contracts/inventory.ts`; `api/tests/unit/inventory-catalog.test.ts` (mensaje con `hr`), `api/tests/unit/inventory-recipes.test.ts` y `landing-pages/tests/integration/prisma-inventory-recipes.test.ts`.

### Riesgos o pendientes

- **Desviación 1.** La barrera (`.gitignore` y `check-private-data`) estaba en el PR 2: se adelantó por petición de la sesión principal, porque hoy un `git add .` subiría el libro real (H-11).
- **Desviación 2.** La API todavía no expone `referenceCost` ni `inventoriable` (PR 2). Una edición desde el admin actual no los envía y se conservan.
- **Efecto visible.** El select de unidad del admin ya ofrece `hr`, porque usa `INVENTORY_UNITS` del contrato. Es la opción prevista para el PR 3 y es válida en el dominio.
- **Para QA:**
  - la vuelta atrás con la imagen de `main`;
  - el respaldo y la restauración;
  - la comprobación de que no exista un empaque llamado "hr" en desarrollo.
- **Base `restaurante_shadow`.** `migrate diff` usó la base sombra que ya existía, la de `SHADOW_DATABASE_URL`.

## QA Action Plan — PR 1 (T2)

### Objetivo

Validar con evidencia en MySQL 8.4 real que el PR 1 (migración `inventario_recetas`, dominio de recetas y costo, persistencia y barrera de datos privados) cumple RN-T2-1 a RN-T2-6, RF-3 a RF-10 en lo del dominio y la persistencia, CA-1 a CA-11 y CA-14, sin regresión de T1 y sin datos reales en el repositorio. El worktree no está indexado por CodeGraph: QA usa Read y Grep dirigidos.

### Requisito bajo prueba

Ticket aprobado (versión 1), Technical Action Plan aprobado ("Si", PT-1 a PT-7) e "Implementation Result — PR 1". Fuera de este PR, y por tanto "no aplica a este PR": API y códigos HTTP reales (CA-12 y el 409 HTTP de CA-10; aquí se comprueba el error de dominio que el PR 2 traducirá), importación A5 (CA-13), semilla (RF-12), pantallas (CA-15, RF-1/RF-2 visuales) y documentación de C-2 en el README (PR 3).

### Criterios de aceptación (cada uno → pruebas que lo cubren)

| CA | Pruebas |
|---|---|
| CA-1 | D1 (memoria y MySQL), X4 |
| CA-2 | D2, X4 |
| CA-3 | D3 |
| CA-4 | D4, C2, X2 |
| CA-5 | D5, X3 |
| CA-6 | C1, C2, X1 |
| CA-7 | D6, X5 |
| CA-8 | D7 |
| CA-9 | D8 |
| CA-10 | D9, D10, X6, X8 (solo dominio; el 409 HTTP es del PR 2) |
| CA-11 | D11, X7 |
| CA-14 | V1–V6 (vuelta atrás), B1–B4 (respaldo) |
| Barrera (A5, riesgo de fuga) | P1–P7, X9 |

### Riesgos identificados

- Una migración que reconstruya `inventory_item` o bloquee sus lecturas y escrituras (FK nuevas hacia `inventory_item` toman un bloqueo de metadatos del padre).
- Redondeo o escala incorrectos en el costo, o un faltante tratado como 0 (RN-T2-4).
- Ciclos o versiones dobles bajo concurrencia; candado que no serializa; interbloqueos que acaban en 500.
- Inactivación de un ingrediente mientras otra sesión lo añade a una receta (orden de bloqueo).
- C-2: el código de T1 falla con filas en `hr`; la api de `main` sobre la base migrada.
- Fuga del libro de datos o de un JSON real; falsos positivos o falsos negativos de `check-private-data`; que el script imprima contenido.
- Archivos tocados fuera de la lista del TAP (`decimal.ts` aparece en el diff y no en la lista de "Archivos o componentes afectados": se revisa que el cambio sea necesario y compatible).
- Pruebas permanentes que no detecten las mutaciones clave o que sean de arquitectura.

### Revisión estática (F)

- **F1.** `git status` y `git diff --stat` del worktree contra `0c3c293`: solo los archivos de "Archivos afectados" más el ticket; nada en landings, bot, `public/`, `inventory-manager/`, `api/src/`, `deploy/`, `ops/`, `.github/` ni `docs/`.
- **F2.** Diff completo frente al TAP: DDL (tipos, nulos, únicos `(item_id, number)`, `current_item_id`, `(version_id, position)`, `(version_id, ingredient_item_id)`, índice `ingredient_item_id`, 5 FK `RESTRICT`), `units.ts` (`hr`, magnitud `time`), `recipe-*` (escala 3/4/7, mitad hacia arriba, nunca 0), `recipeTransaction` `ReadCommitted` con el candado como primera sentencia, `updateItem`/`deactivateItem` con el candado primero, 1213 con reintento acotado, 1205 → `InventoryBusyError`, únicos → `RecipeVersionConflictError`, resto → `DatabaseUnavailableError` sin el `message` de Prisma, sin `update`/`delete` sobre las tablas de recetas salvo `closeVersion`. Reglas: `typescript.md` (sin `any`, `as`/`!` justificados, imports `.ts`, sintaxis borrable), `manejo-de-errores.md`, `logging.md` (sin cantidades, costos ni nombres en logs).
- **F3.** `dependencias.md`: `package-lock.json` sin cambios y `package.json` solo con el script `lint`.
- **F4.** Suma de `deploy/` con el método de `ci.yml` (`cd restaurante/deploy && shasum -a 256 -- compose.prod.yaml deploy.sh mysql/initdb/01-usuarios.sh | shasum -a 256 | cut -c1-64`; se confirma en `ci.yml` antes de calcularla) = `591de8e7f259073f79ff34418c8b7a3a2680d465ef3bc7378c620221455cc7f0`.
- **F5.** Sin secretos ni datos reales: `grep -rniE` en el diff, los archivos nuevos y el ticket con patrones de secretos (`password=`, `mysql://[^ ]*:[^ ]*@`, `EAA[A-Za-z0-9]{20,}`, `sk-`, `BEGIN .*PRIVATE KEY`) y con una lista de nombres de ingredientes característicos del libro y de costos con 4 decimales; la lista vive solo en un archivo del scratchpad que se borra. El informe dice solo "N coincidencias" y la ruta, nunca el valor. Los ejemplos del ticket y de las pruebas deben ser ficticios (100, 2 kg, 6 kg, 40 %).

### Migración (M), en el MySQL 8.4 de QA

- **M1.** Base `restaurante_test_qa050_m` con las migraciones de `0c3c293` y filas en `inventory_item` (simples, padre con variantes, con empaques, inactivo), categorías e historial. Antes: `INNODB_TABLES.TABLE_ID` y `TOTAL_ROW_VERSIONS` de `inventory_item`, `CHECKSUM TABLE` y `SELECT *` ordenado de las 5 tablas `inventory_*` existentes. Además, `SELECT … FROM inventory_package WHERE name = 'hr'` (o la columna equivalente) en esa base y en la de desarrollo **solo si ya está encendida no se toca**: ver pregunta 3.
- **M2.** `prisma migrate deploy` con la nueva migración, mientras dos sesiones en paralelo hacen lecturas y escrituras en bucle sobre `inventory_item` (se registran latencias máximas y errores). Después: mismo `TABLE_ID`, `TOTAL_ROW_VERSIONS` coherente con un ADD COLUMN instantáneo, checksums y filas de las tablas existentes iguales salvo las columnas nuevas (`inventoriable = 1`, `reference_cost NULL`), ambos ALTER aceptados con `ALGORITHM=INSTANT` (sin error).
- **M3.** `information_schema.TABLES/COLUMNS`: las 3 tablas nuevas y `base_unit` en `utf8mb4_es_0900_as_cs`; `SHOW CREATE TABLE` con los únicos, índices y FK del plan; `inventory_lock` con exactamente la fila `recetas`.
- **M4.** `prisma migrate diff --from-url <base migrada> --to-schema-datamodel schema.prisma --exit-code` → 0 y `migrate status` "up to date".

### Dominio contra MySQL real (D)

Sonda descartable del scratchpad que usa `createRecipeRepository` e `createInventoryRepository` con el store de Prisma sobre `restaurante_test_qa050_*` (no solo el store en memoria). Datos ficticios.

- **D1.** CA-1: rendimiento 2 kg, líneas que suman 100 → `50.0000`; lectura de los DECIMAL guardados exacta.
- **D2.** CA-2: 6.000 kg netos al 40 % → bruta 10.000; RN-T2-1: rendimiento 6.000 y costo 100/kg → 166.6667/kg; merma 20 % de 1.000 → 1.250 kg; 0 % y 99.99 % aceptadas; 100 % y 100.01 % rechazadas con error en `lines.N.wastePercent`; coma decimal, 4 decimales y una neta que redondea a 0 en la base rechazadas.
- **D3.** CA-3: 500 g de un ingrediente en kg a 10/kg → 5.00 (5.0000000 en escala 7); `pza` sin factor → error en `lines.N.unit` con mensaje claro; `hr` solo para una base `hr`.
- **D4.** CA-4: A→A, A→B→A (con la ruta de nombres en el error), cadena de 8 niveles aceptada y de 9 rechazada (`RecipeTooDeepError`), también cuando la profundidad se excede por las recetas que **usan** a X; nada escrito (conteos de versiones y líneas iguales).
- **D5.** CA-5: v1 → v2 con cambios: v1 `valid_to = v2.valid_from`, `current_item_id` NULL, números 1 y 2; v1 y sus líneas idénticas después (checksum por fila); guardar sin cambios → misma versión y sin fila nueva ni historial; cerrar → sin vigente; reloj simulado que retrocede → intervalo nunca invertido (+1 ms).
- **D6.** CA-7 y PT-3: CPP ausente → referencia marcada `referencia`; sin referencia → `sin_costo`, receta incompleta con `missing` (sin repetir, con ruta) y costo nunca 0; Intermedio con receta cerrada → referencia o "Sin costo".
- **D7.** CA-8: cambiar la referencia de un insumo y la sub-receta → cambia el costo del padre, sin versión nueva del padre.
- **D8.** CA-9: Insumo no inventariable en `hr` con referencia → costeado; no inventariable en Intermedio/Compuesto/Reventa → rechazado (PT-7); referencia en Compuesto o padre → rechazada; referencia negativa o con 5 decimales → rechazada; cambiar `inventoriable` permitido (sin movimientos hasta T3).
- **D9.** CA-10 (RN-4): `isInUse` real en MySQL para un artículo con versiones y para uno usado en líneas de una versión **cerrada**; cambiar su unidad base o un factor → rechazado; uno sin uso sí cambia.
- **D10.** CA-10 (RF-7): inactivar un Intermedio usado en vigentes sin `recipes: 'keep'` → `ItemInActiveRecipesError` con la lista; con confirmación → inactivo, versiones intactas, su propia receta sigue vigente, ya no aparece en `ingredientOptions` y una versión nueva que lo incluya se rechaza en su línea; un padre cuyas variantes están en recetas → la lista incluye las variantes (cascada).
- **D11.** CA-11: Compuesto o padre como ingrediente → rechazado y fuera de `ingredientOptions`; receta en Insumo, Reventa o padre → `RecipeNotAllowedError`; Intermedio y Compuesto (simple o variante) sí; artículo inactivo: sin versión nueva (`RECIPE_ITEM_INACTIVE`) pero se puede cerrar; de 1 a 40 líneas, 0 y 41 rechazadas, ingrediente repetido rechazado.
- **D12.** Conflicto de partida (C-4): dos guardados secuenciales desde la misma `baseVersionId` con contenido distinto → el segundo `RecipeVersionConflictError` con la vigente (el 409 es su traducción en el PR 2); el mismo contenido repetido (doble envío) → una sola versión.

### Concurrencia y robustez (C)

- **C1.** 10 rondas de dos `saveVersion` simultáneos del mismo artículo desde la misma base con contenidos distintos → una versión nueva y un conflicto; con el mismo contenido → una sola versión; nunca dos vigentes ni números repetidos.
- **C2.** 10 rondas de A→B y B→A simultáneos → uno rechazado por ciclo con su ruta y el grafo final acíclico.
- **C3.** 10 rondas de "inactivar el ingrediente" frente a "añadirlo a una receta" y de "cambiar su unidad base" frente a "usarlo en una línea" → nunca una línea vigente nueva con un ingrediente inactivo ni una unidad cambiada con uso.
- **C4.** Espera agotada: una sesión retiene la fila `recetas` (`SELECT … FOR UPDATE` abierto > 5 s) → `saveVersion` y `updateItem` terminan en `InventoryBusyError`, sin reintento, en ~5 s. Interbloqueo: provocar 1213 (dos transacciones cruzadas sobre filas de `inventory_item` con el orden inverso) → reintento acotado y resultado definido o `InventoryBusyError`/`DatabaseUnavailableError`, nunca un error inesperado.
- **C5.** Transacción fallida sin restos: error inyectado tras insertar la versión (p. ej. FK inválida en una línea) → conteos y checksums de las tablas de recetas e historial iguales a antes.
- **C6.** En C1–C5 ninguna operación termina con un error que no sea de la jerarquía del dominio (se captura y clasifica cada rechazo) ni registra SQL, nombres o costos.

### Vuelta atrás (V; CA-14)

Código anterior solo leído: `main` desde `/Users/orvigas/Desktop/Negocio/restaurante` y T1 desde `/Users/orvigas/Desktop/Negocio/.claude/worktrees/epic-inventario-lectura/restaurante` (confirmando que está en `0c3c293`), con `node src/server.ts` y env propio del scratchpad apuntando al MySQL de QA, nunca el `api/.env` de desarrollo.

- **V1.** Base migrada con la nueva migración, artículos (uno en `hr`, uno con referencia y uno no inventariable) y una receta vigente.
- **V2.** `api` de `main` sin `DATABASE_ALLOW_NEWER_SCHEMA` → sale con `DATABASE_NEWER_THAN_CODE`.
- **V3.** Con `DATABASE_ALLOW_NEWER_SCHEMA=true` → arranca; rutas públicas de productos y página 200; login de admin; producto y página 2xx.
- **V4.** `api` de T1 con la variable: lista y ficha de inventario → reproducir C-2 (503 en lo que lea la fila en `hr`, sin detalles internos); el resto del inventario y una alta de T1 (toma `inventoriable = true`, costo nulo) funcionan. Un efecto más amplio que el descrito en C-2 = defecto.
- **V5.** Mitigación de C-2: cambiar la unidad del artículo `hr` (o borrarlo de la base de QA) → la `api` de T1 vuelve a leer lista y ficha.
- **V6.** Vuelta a la `api` del worktree: arranca sin la variable y lee todo.

### Respaldo y restauración (B; CA-14)

Con las opciones de `ops/backup` (`backup.sh` y `restore.sh` leídos para reproducir sus flags) sobre la base de V1, en el contenedor de QA, sin VPS ni producción:

- **B1.** `mysqldump` → el volcado contiene `enum(…,'hr')`, `reference_cost`, `inventoriable`, las 3 tablas nuevas y la fila `recetas`.
- **B2.** Restauración en otra base del contenedor de QA.
- **B3.** Conteos y `CHECKSUM TABLE` idénticos de las 8 tablas `inventory_*`, `user` y `_prisma_migrations`.
- **B4.** La sonda D lee la receta restaurada con el mismo costo y historial; `migrate status` sin pendientes. `verify-backup.sh --drill`: lo hace el usuario tras desplegar la épica.

### Barrera de datos privados (P)

Todo con archivos ficticios del momento, sacados del índice y borrados al terminar; `Datos de entrada.xlsx` no se abre, no se mueve ni se toca.

- **P1.** `git check-ignore -v` para `*.xlsx`, `*.xlsm`, `*.xls`, `*.ods`, `~$x.xlsx` y `datos-privados/x.json` (raíz y subcarpetas); `git add` de un `.xlsx` de prueba → rechazado por ignorado.
- **P2.** `git add -f` del `.xlsx` → `npm run lint` termina ≠ 0 y nombra la ruta; idem con `.ods` y `.xls`.
- **P3.** JSON con `"formato": "inventario-importacion"` sin `"ficticio": true` (en la carpeta de fixtures y fuera) → falla; ficticio fuera de `api/tests/fixtures/inventory-import/` → falla; ficticio dentro → pasa.
- **P4.** La salida del script solo contiene rutas y el mensaje: se mete un marcador único dentro de los archivos de prueba y se verifica que no aparece en la salida.
- **P5.** Sin falsos positivos: `npm run lint` sobre el árbol actual → 0 y el número de archivos revisados (835 según la implementación; se explica cualquier diferencia). Comprobar qué revisa (índice de git) y que un archivo solo en el árbol de trabajo sin seguimiento no rompe el lint.
- **P6.** El CI lo ejecuta: el job de calidad corre `npm run lint` (lectura de `ci.yml`).
- **P7.** `Datos de entrada.xlsx`: `git status --ignored` lo muestra ignorado, sin seguimiento, y su `stat` (tamaño y mtime) igual al inicio y al final.

### Mutaciones (X), descartables

En una copia APFS (`cp -c`) de `restaurante/` del worktree en el scratchpad, una a una, ejecutando solo `inventory-recipes.test.ts`, `prisma-inventory-recipes.test.ts` e `inventory-catalog.test.ts`:

- **X1.** Candado sustituido por `SELECT 1`.
- **X2.** Sin detección de ciclos.
- **X3.** `saveVersion` no cierra la versión anterior.
- **X4.** Redondeo mitad hacia abajo (bruta y costo por unidad).
- **X5.** Costo 0 en lugar de "Sin costo".
- **X6.** Sin la comprobación de unidad bloqueada (RN-4).
- **X7.** Compuesto permitido como ingrediente.
- **X8.** Inactivar usado sin exigir `recipes: 'keep'`.
- **X9.** Barrera desactivada (`check-private-data` que siempre sale 0) frente a P2.

Una mutación que sobrevive es un hallazgo: `MAJOR` si ninguna prueba permanente cubre ese comportamiento, `MINOR` si otra lo cubre indirectamente. X9 no tiene prueba permanente por diseño (sonda de QA según el TAP): se documenta, no es defecto.

### Regresión (G)

- **G1.** Desde `restaurante/` del worktree: `npm run build:css`, `npm run typecheck`, `npm run lint` y `npm test` (3 workspaces) en 0, con los totales.
- **G2.** `inventory-recipes.test.ts`, `prisma-inventory-recipes.test.ts` e `inventory-catalog.test.ts` en 3 ejecuciones aisladas, cada una < 20 s.
- **G3.** T1 sin regresión: suite de inventario de `api` e `inventory-manager` en verde; en el HTML renderizado del formulario de artículo (doble de la API o `api` del worktree), el selector de unidad ofrece `hr` al final y una alta/edición en `hr` y en `kg` funciona; una edición desde el admin actual conserva `referenceCost` e `inventoriable` (desviación 2).
- **G4.** Revisión de las pruebas permanentes según `testing.md`: funcionales, sin duplicar otra, sin arquitectura ni migración "por sí misma", nombres de dominio, sin esperas fijas ni `retry`, `makeDatabase()`; el ajuste de `inventory-catalog.test.ts` solo por el cambio de comportamiento. Una que no cumpla → `MINOR` con la recomendación de quitarla.

### Pruebas automatizadas

Existentes: G1/G2. Sondas temporales (M, D, C, V, B, P, X) solo en el scratchpad; nada nuevo en `restaurante/landing-pages/tests/` ni en otro directorio del worktree.

### Pruebas en navegador

No aplica a este PR (sin pantallas nuevas). G3 se valida con el HTML renderizado.

### Evidencia requerida

Salida resumida (código de salida y totales) de cada comando; `git diff --name-only`; suma de `deploy/`; SQL de la migración; `INNODB_TABLES`, checksums y latencias de M1/M2; `migrate diff`; resultados de D1–D12 con los valores calculados; recuentos de C1–C6; logs de V2–V6; conteos y checksums de B3; salidas de P1–P7; tabla X1–X9; duraciones de G2; conteo (sin valores) de F5; comprobación de limpieza.

### Limpieza (comprobada, no supuesta)

`docker compose -p restaurante-qa-050 down -v` y `docker ps -a`, `docker volume ls`, `docker network ls` sin restos; `restaurante-mysql-dev-1` como estaba (apagado); sin procesos `server.ts`/`vitest` ni puertos de QA ni 3307 en escucha; 0 bases `restaurante_test*`; copia de mutaciones, sondas, env, listas de patrones, logs y volcados del scratchpad borrados; archivos de P sacados del índice y borrados; `git status` del worktree igual al inicial más el ticket; árbol principal en `main` sin cambios; `git worktree list` sin worktrees nuevos; `Datos de entrada.xlsx` intacto y sin seguimiento (P7).

### Criterios de aprobación

`QA_APPROVED` solo si: F1–F5 sin desviaciones relevantes, suma de `deploy/` igual y sin datos reales; migración sin reconstrucción, sin bloqueos más allá del de metadatos breve y sin diferencias (M2–M4); CA-1 a CA-11 en PASS contra MySQL (D1–D12); C1–C6 sin estados inválidos ni errores inesperados; CA-14 en PASS (V2, V3, V6, B3, B4) y C-2 igual a lo descrito (V4, V5); P1–P7 en PASS; `typecheck`, `lint` y `npm test` en 0; archivos < 20 s; sin `BLOCKER` ni `CRITICAL` y cada `MAJOR` aceptado por el usuario.

Escala por impacto observable: costo incorrecto, faltante tratado como 0, ciclo o dos vigentes aceptados, versión cerrada modificada, la api de `main` que no arranca con la variable o un dato real en el repositorio = `CRITICAL`; ALTER que reconstruye la tabla, error inesperado bajo concurrencia, transacción con restos, efecto de C-2 más amplio que lo descrito, falso negativo de la barrera o contenido impreso por el script = `MAJOR` o superior; mutación no detectada = `MAJOR`/`MINOR` (arriba); desviación documental o de mensaje sin impacto = `MINOR`.

### Autorizaciones que se piden al usuario

1. Docker local: `docker compose -p restaurante-qa-050 up -d --wait mysql-dev` con el `compose.yaml` del worktree, volumen propio y `127.0.0.1:3307`; bases `restaurante_test_qa050_*` para M, D, C, V y B. Si el `mysql-dev` de desarrollo está encendido, QA se detiene y pregunta.
2. Ejecutar la `api` del worktree, la de `main` (`/Users/orvigas/Desktop/Negocio/restaurante`) y la de T1 (worktree de lectura), solo leyendo su código, con `node src/server.ts` y env propios en el scratchpad; nunca el `api/.env` de desarrollo. `npm ci` y `db:generate` ya están hechos en el worktree.
3. Sondas, listas de patrones y copia de mutaciones solo en el scratchpad; archivos de P temporales en el worktree (añadidos con `git add -f` y retirados del índice y borrados al terminar).
4. Escribir en el ticket del worktree solo `## Estado`, este plan, el QA Report y el Historial.

### Preguntas abiertas (con recomendación)

1. ¿La lista de nombres característicos del libro para F5 la arma QA con lo que conoce del análisis (solo en el scratchpad, nunca impresa)? Recomendado: sí.
2. ¿Se acepta que X9 (barrera) no tenga prueba permanente, como dice el TAP? Recomendado: sí; queda como sonda y el lint del CI la ejerce sobre el árbol real.
3. Empaque llamado "hr" en desarrollo: comprobarlo exige encender el `mysql-dev` de desarrollo solo para un `SELECT`. Recomendado: no encenderlo en este QA; QA lo comprueba en la base de QA y deja la consulta exacta para que el usuario la ejecute (o autoriza explícitamente encenderlo solo lectura y volver a apagarlo).

## QA Report — PR 1 (T2)

### Ronda

1 (completa). Rama `feature/REQ-F-050-recetas-modelo-dominio` (worktree, sin commit, sobre `0c3c293`). Plan aprobado por el usuario: "Si", con las 4 autorizaciones y las respuestas recomendadas a las 3 preguntas.

Nota de entorno: al empezar ya estaban encendidos el contenedor `restaurante-qa-050-mysql-dev-1`, su volumen y 4 bases `restaurante_test_qa050_*`. Venían de una ejecución anterior de este mismo QA que se interrumpió, de otra sesión. Se comprobó su origen (contenedor creado desde este worktree con el proyecto autorizado; líneas base de volúmenes y redes de esa sesión), se borraron las bases y se repitió todo desde cero. El `mysql-dev` de desarrollo siguió apagado.

### Pruebas ejecutadas

| Id | Acción | Resultado |
|---|---|---|
| F1 | `git diff --stat 0c3c293` y archivos sin seguimiento | 15 modificados y 9 nuevos (incluido el ticket), todos en "Archivos afectados". Nada en landings, bot, `public/`, `inventory-manager/`, `api/src/`, `deploy/`, `ops/`, `.github/` ni `docs/`. PASS |
| F2 | Revisión del diff frente al TAP | DDL según el plan: únicos `(item_id, number)`, `current_item_id`, `(version_id, position)` y `(version_id, ingredient_item_id)`, índice `ingredient_item_id` y 5 FK `RESTRICT`. `hr` con magnitud `time`; escalas 3/4/7 y mitad hacia arriba; `recipeTransaction` READ COMMITTED con el candado como primera sentencia; `updateItem` y `deactivateItem` toman el candado primero; 1213 se reintenta, 1205 da `InventoryBusyError` y un choque de únicos da `RecipeVersionConflictError`; las versiones solo se cierran (`updateMany` sobre `valid_to IS NULL`). No hay `any` en `src`, logs nuevos, cantidades ni costos en los logs. `decimal.ts` solo añade constantes (`COST_SCALE`, `COST_INTEGER_DIGITS`, `WASTE_SCALE`). PASS (con DEF-001) |
| F3 | `package-lock.json` y `package.json` | Lock sin cambios; `package.json` solo cambia el script `lint`. PASS |
| F4 | Suma de `deploy/` (método de `ci.yml`) | `591de8e7f259073f79ff34418c8b7a3a2680d465ef3bc7378c620221455cc7f0`, igual. PASS |
| F5 | Patrones de secretos y lista de nombres del libro (solo en el scratchpad, ya borrada) en los 24 archivos | Secretos: 1 coincidencia, que es el propio texto de los patrones del QA Action Plan. Nombres: 0 en los archivos nuevos y en las líneas añadidas a `inventory-catalog.test.ts`; 3 en `inventory-recipes.test.ts`, todas con un nombre genérico con el sufijo "ficticia". Costos con 4 decimales en las pruebas: solo valores ficticios. PASS |
| G1 | `npm run build:css`, `typecheck`, `lint` y `npm test` | Los cuatro terminan en 0. Lint: "835 archivos revisados, sin datos privados". Tests: api 53 archivos y 1227 pruebas; landing-pages 63 y 901; inventory-manager 17 y 287. PASS |
| G2 | 3 ejecuciones aisladas de los 3 archivos | `inventory-recipes.test.ts` + `inventory-catalog.test.ts`: 37/37 en 149, 141 y 144 ms. `prisma-inventory-recipes.test.ts`: 4/4 en 2.75, 2.73 y 2.75 s. Todos < 20 s. PASS |
| M1 | Base con las 5 migraciones de T1 (código de `0c3c293`) y filas: 46 artículos (simples, padre con 3 variantes, con empaques, inactivo), 2 categorías y 50 cambios en el historial | Línea base: `TABLE_ID` de `inventory_item` 5379, `TOTAL_ROW_VERSIONS` 0, `CHECKSUM` y huella por tabla. Empaques llamados "hr": 0. |
| M2 | `prisma migrate deploy` con carga en paralelo (2 lectores y 2 escritores transaccionales sobre `inventory_item`) | Aplicada. `TABLE_ID` 5379 sin cambios (sin reconstrucción); `TOTAL_ROW_VERSIONS` de 0 a 1 (ADD COLUMN instantáneo); checksums y huellas de las 5 tablas y de las columnas de T1 idénticos; 46 filas con `inventoriable = 1` y `reference_cost NULL`. Carga: 89 350 lecturas y 23 305 escrituras; latencia máxima de 14 ms en lectura y 40 ms en escritura; 4 `ER_LOCK_DEADLOCK` en los escritores (OBS-1). PASS |
| M3 | `information_schema` | Las 8 tablas `inventory_*` y `base_unit` en `utf8mb4_es_0900_as_cs`; `base_unit` = `enum('kg','g','L','ml','pza','hr')`; únicos, índices y 5 FK RESTRICT/CASCADE como en el plan; `inventory_lock` = una fila, `recetas`. PASS |
| M4 | `migrate status` y `migrate diff --from-config-datasource --to-schema schema.prisma --exit-code` | "Database schema is up to date!"; "No difference detected." y salida 0. PASS |
| D1–D12 | Sonda del dominio con `createRecipeRepository` y `createInventoryRepository` sobre el store de Prisma, en MySQL 8.4 | 37 comprobaciones, 0 fallos (detalle por CA abajo). PASS |
| C1–C6 | Sonda de concurrencia, 10 rondas | C1: 10/10 con una versión y un conflicto; con el mismo contenido, 10/10 con una sola versión (`true+false`); nunca dos vigentes ni números repetidos. C2: 10/10 con un `RecipeCycleError` y un guardado; grafo final acíclico. C3: 20 carreras, 0 estados inválidos (gana uno u otro: `ItemInActiveRecipesError`/`ItemLockedError` o validación en la línea). C4: candado retenido, `saveVersion` y `updateItem` terminan en `InventoryBusyError` a los 5017 ms, sin escribir; interbloqueo provocado 4/4, la sesión externa es la víctima y la app termina bien. C5: fallo inyectado tras insertar y tras cerrar, checksums de versiones, líneas, historial y candado iguales, la v1 sigue vigente y el error es `DatabaseUnavailableError`. C6: 0 errores fuera de la jerarquía y 0 líneas de log. PASS |
| V1 | Base migrada: artículo en `hr` no inventariable con referencia, otro con referencia, otro sin costo y una receta vigente | Preparada. |
| V2 | `api` de `main` (`1c88e30`) sin la variable | Sale con `DATABASE_NEWER_THAN_CODE`. PASS |
| V3 | `api` de `main` con `DATABASE_ALLOW_NEWER_SCHEMA=true` | Arranca (aviso `database_newer_than_code_allowed` con las 3 migraciones). Públicas de productos y página de los dos negocios: 200; login de admin: 201; productos del admin: 200; borrar y recuperar un producto: 200 y 200; página del admin: 200; 0 errores en el log. PASS |
| V4 | `api` de T1 (copia de `0c3c293` con su cliente de Prisma) con la variable | Lista de inventario 503 y ficha del artículo en `hr` 503 (`DATABASE_UNAVAILABLE`, sin detalles; en el log, P2023). Las fichas de los demás, categorías y públicas: 200; alta: 201 con `inventoriable = 1` y `reference_cost NULL`. Coincide con C-2, sin efectos más amplios. PASS |
| V5 | Mitigación: el artículo `hr` pasa a `kg` por SQL en la base de QA | La `api` de T1 vuelve a leer: lista 200 y 4 fichas 200 (OBS-2). PASS |
| V6 | `api` del worktree sin la variable | Arranca. Lista, fichas, categorías, alta y públicas: 200/201; 0 errores. PASS |
| B1 | `mysqldump` con las opciones de `ops/backup/backup.sh` (`--single-transaction --no-tablespaces --skip-lock-tables --default-character-set=utf8mb4 --hex-blob --set-gtid-purged=OFF`) | Sin `--databases`, para restaurar en otra base del contenedor de QA. El volcado contiene el ENUM con `hr`, `reference_cost` e `inventoriable`, las 3 tablas nuevas y la fila `recetas`. PASS |
| B2 | Restauración en otra base con `mysql --default-character-set=utf8mb4` (como `restore.sh`) | Salida 0. PASS |
| B3 | Conteos y `CHECKSUM TABLE` de las 8 tablas `inventory_*`, `user` y `_prisma_migrations` | Idénticos. PASS |
| B4 | Sonda D sobre la base restaurada | La receta tiene el mismo costo (180.0000/kg, total 1080.0000) y las mismas fuentes, versiones y autor; `hr`, no inventariable y referencia 80.0000; `migrate status` sin pendientes. PASS |
| P1 | `git check-ignore -v` | `*.xlsx`, `*.xlsm`, `*.xls`, `*.ods` (también en subcarpetas y con mayúsculas), `~$qa.xlsx`, `datos-privados/x.json` y `Datos de entrada.xlsx`: ignorados. `git add` de un `.xlsx` sin `-f`: rechazado. `restaurante/datos-privados/x.json` no se ignora (OBS-3). PASS |
| P2 | `git add -f` de `.xlsx`, `.ods` y `.xls` y `npm run lint` | Salida 1, con las 3 rutas. PASS |
| P3 | JSON con `"formato": "inventario-importacion"` | Real en fixtures: falla. Real fuera: falla. Ficticio fuera: falla. Ficticio dentro: pasa ("836 archivos"). JSON inválido o con `"ficticio": "true"` en texto: falla. PASS |
| P4 | Marcador único dentro de los archivos de P2 y P3 | Nunca aparece en la salida (0 coincidencias). PASS |
| P5 | Falsos positivos y alcance | Árbol actual: 0 y "835 archivos". Un JSON real sin seguimiento no rompe el lint (solo revisa el índice). Falso negativo local: un JSON real preparado con `git add` y después editado o borrado en el árbol de trabajo pasa (DEF-002). PASS con DEF-002 |
| P6 | `ci.yml` | El job de verificación corre `npm run lint` tras `checkout`, así que la barrera corre en el CI. PASS |
| P7 | `Datos de entrada.xlsx` | Ignorado y sin seguimiento (`!!`; `ls-files --error-unmatch` falla). Tamaño y mtime iguales al principio, al final y en la línea base de la sesión anterior (779807 bytes). PASS |
| X1–X9 | Mutaciones en una copia APFS del scratchpad | Tabla abajo. |
| G3 | Admin y API de T1 | Formulario de alta (inventory-manager con el doble): opciones de unidad `["", kg, g, L, ml, pza, hr]`, con `hr` al final. `api` del worktree: alta en `hr` 201 y en `kg` 201. Una edición con la carga de T1, sin los campos nuevos, conserva `reference_cost` (100.0000 y 80.0000) e `inventoriable` (1 y 0). Cambiar la unidad de un artículo usado: 409 `ITEM_LOCKED`. Enviar `referenceCost` a la API actual: 422 (lista cerrada; se expone en el PR 2). Con el doble, el alta en `hr` da 422 (DEF-004). PASS con DEF-004 |
| G4 | Revisión de las pruebas permanentes | Las dos nuevas son funcionales y usan nombres de dominio. La de MySQL usa `makeDatabase()`; la concurrencia es PT-1, aprobada. No tienen esperas fijas, `retry`, `.only`/`.skip` ni sufijo `qa-req-f-*`. El ajuste de `inventory-catalog.test.ts` solo cambia el mensaje por `hr`. PASS |

Mutaciones (se ejecutaron solo `inventory-recipes.test.ts`, `inventory-catalog.test.ts` y `prisma-inventory-recipes.test.ts`):

| Id | Mutación | Resultado |
|---|---|---|
| X1 | Candado sustituido por `SELECT 1` | Detectada: MySQL 2/4 fallan (las dos de concurrencia) |
| X2 | Sin detección de ciclos | Detectada: unitaria 1 y MySQL 1 |
| X3 | `saveVersion` no cierra la anterior | Detectada: unitaria 3 y MySQL 2 |
| X4 | Redondeo de la mitad hacia abajo (`divideRounded`) | Sobrevive en los 3 archivos. La detecta `api/tests/unit/inventory-units.test.ts` (2 fallos; prueba permanente de T1) → MINOR (DEF-003) |
| X5 | Costo 0 en lugar de "Sin costo" | Detectada: unitaria 2 (CA-7 y PT-3) |
| X6 | Sin la comprobación de unidad bloqueada (RN-4) | Detectada: unitaria 2 |
| X7 | Compuesto permitido como ingrediente | Detectada: unitaria 1 |
| X8 | Inactivar algo usado sin exigir `recipes: 'keep'` | Detectada: unitaria 2 |
| X9 | Barrera que siempre sale con 0 | Sobrevive, por diseño: no tiene prueba permanente (decisión del usuario, pregunta 2). La original sale con 1; la mutante, con 0 |

### Criterios de aceptación

| CA | Resultado | Evidencia |
|---|---|---|
| CA-1 | PASS | D1: 100.0000 entre 2 kg = 50.0000/kg, con origen `referencia` por línea; DECIMAL leídos exactos (`2.000`, `0.00`). X4 (empate de redondeo): DEF-003 |
| CA-2 | PASS | D2: 6.000 al 40 % → 10.000; costo 1000.0000 y 166.6667/kg; 20 % de 1.000 → 1.250; 0 % y 99.99 % aceptadas; 100 %, 100.01 % y 3 decimales rechazados en `lines.0.wastePercent`; coma, 4 decimales, negativa y una cantidad que se redondea a 0 en la base rechazadas en `lines.0.quantity`, sin escribir nada |
| CA-3 | PASS | D3: 500 g a 10/kg → 5.0000 (5.0000000 con escala 7); `pza` sin factor → `lines.0.unit` "No hay factor para convertir pza a kg en este artículo."; `hr` solo con base `hr`, en los dos sentidos |
| CA-4 | PASS | D4: A→A con la ruta [A, A]; B→A→B con la ruta y conteos iguales; 8 niveles aceptados y 9 rechazados (`RecipeTooDeepError`), también por los usuarios de Z (profundidad 9, sin escribir); C2 10/10; X2 detectada |
| CA-5 | PASS | D5: `valid_to` de la v1 = `valid_from` de la v2, `current_item_id` NULL, números 1 y 2; v1 y sus líneas sin cambios; guardar sin cambios no crea versión ni historial; cerrar deja sin vigente; con el reloj atrasado, +1 ms sin invertir el intervalo; X3 detectada |
| CA-6 | PASS (dominio) | C1 10/10 y C2 10/10; D12: conflicto con la vigente (id y número 2); el 409 HTTP llega en el PR 2; X1 detectada |
| CA-7 | PASS | D6: referencia 12.3456 con origen `referencia`; sin referencia, total y unitario `null`, nunca 0, faltante una vez con la ruta [Top, Sub1, Sin ref]; la lista da `null` y 1 faltante; PT-3: receta → referencia 7.0000 → `sin_costo`; X5 detectada |
| CA-8 | PASS | D7: el costo del padre pasa de 10 a 20 al cambiar la referencia y de 20 a 10 con una versión nueva de la sub-receta; el padre sigue con 1 versión |
| CA-9 | PASS | D8: no inventariable en `hr` con referencia 80, 0.5 hr → 40.0000 con origen `referencia`; rechazos PT-7 (no inventariable en Intermedio, Compuesto o Reventa; referencia en Compuesto o padre, negativa o con 5 decimales; `inventoriable` en texto); el cambio de inventariable y de la referencia queda en el historial. "No muestra existencias": no aplica hasta T3 |
| CA-10 | PASS (dominio) | D9: `isInUse` real (productor y usado solo en una versión cerrada = true; sin uso = false); unidad base y factor → `ItemLockedError`; vía API, 409 `ITEM_LOCKED`. D10: sin confirmar, `ItemInActiveRecipesError` con las 2 recetas y el artículo sigue activo; con `keep`, inactivo, versiones intactas, su receta sigue vigente, fuera de `ingredientOptions`, una línea nueva rechazada, aviso (`inactiveIngredientIds` y `usesInactive`); cascada desde un padre; C3 sin estados inválidos; X6 y X8 detectadas. El 409 HTTP llega en el PR 2 |
| CA-11 | PASS | D11: Compuesto y padre rechazados en `lines.0.ingredient` y fuera de las opciones (la variante de un Compuesto también); Insumo, Reventa y padre → `RecipeNotAllowedError`; Intermedio, Compuesto y variante de Compuesto sí; un artículo inactivo no admite versiones nuevas pero se puede cerrar; 0 y 41 líneas o un ingrediente repetido se rechazan, 40 se aceptan; X7 detectada |
| CA-12, CA-13, CA-15, RF-12 | No aplica a este PR | PR 2 y PR 3 |
| CA-14 | PASS | V2, V3 y V6 (vuelta atrás); V4 y V5 (C-2 tal como se describe); B1 a B4 (respaldo con `hr`, inventariable, referencia, recetas y versiones). `verify-backup.sh --drill` queda para el usuario |
| CA-16 | PASS (lo que toca este PR) | `npm test` completo en verde (landings, bot y T1). En V3, públicas y admin de `main` en verde. Pantallas de T1: formulario con `hr` y edición que conserva los campos nuevos (G3) |

### Defectos encontrados

#### DEF-001

- **Severidad:** MINOR.
- **Criterio de aceptación afectado:** ninguno de este PR. Afecta a la regresión de T1: códigos HTTP de la API de inventario.
- **Descripción:** `run()` del store de Prisma convierte cualquier MySQL 1205 (espera de bloqueo agotada) en `InventoryBusyError`, en todas las transacciones del inventario. Las rutas de inventario de la `api` (las de T1, vigentes) no lo traducen, así que acaba en 500 `INTERNAL_ERROR`. Antes de este PR, un 1205 era `DatabaseUnavailableError`, que respondía 503 `DATABASE_UNAVAILABLE`.
- **Pasos para reproducir:**
  1. `api` del worktree sobre una base migrada.
  2. Una sesión retiene `SELECT … FROM inventory_lock WHERE name = 'recetas' FOR UPDATE`.
  3. `PUT /api/v1/admin/inventario/articulos/:id` con una edición válida.
- **Resultado esperado:** una respuesta de "ocupado / no disponible" coherente (503, como antes o como `INVENTORY_BUSY`).
- **Resultado actual:** 500 `INTERNAL_ERROR` "Error interno." a los 5020 ms. En el log, `request_error` con `name: InventoryBusyError`. No expone detalles internos.
- **Evidencia:** sonda G3-API.
- **Impacto:** solo ocurre con una espera de bloqueo de más de 10 s en producción y 5 s en pruebas, algo poco probable con transacciones cortas. Es una respuesta de error peor clasificada (500 en lugar de 503) y un `error` en los logs. Solo afecta a `epic/inventario` y al entorno de desarrollo, no a `main`.
- **Recomendación:** traducir `InventoryBusyError` a 503 en las rutas de inventario. Basta con hacerlo en el PR 2, junto con los demás errores nuevos (`ItemInActiveRecipesError` → 409, `Recipe*`), siempre que se compruebe también en las rutas de artículos de T1.

#### DEF-002

- **Severidad:** MINOR.
- **Criterio de aceptación afectado:** ninguno. Afecta a la barrera de datos privados (A5, riesgo de fuga).
- **Descripción:** `check-private-data.ts` toma las rutas del índice (`git ls-files`), pero lee el contenido del árbol de trabajo. Un JSON real preparado con `git add` y después editado (sin la marca) o borrado en el árbol de trabajo pasa el lint en local.
- **Pasos para reproducir:**
  1. Crear un JSON con `"formato": "inventario-importacion"` sin `ficticio`.
  2. `git add -f`.
  3. Sobrescribirlo con `{}` o borrarlo.
  4. `node scripts/check-private-data.ts`.
- **Resultado esperado:** falla, porque lo que se va a commitear es el contenido preparado.
- **Resultado actual:** "836 archivos revisados, sin datos privados." con salida 0.
- **Evidencia:** sonda P5. Los archivos se retiraron del índice y se borraron.
- **Impacto:** solo en local. En el CI el checkout coincide con el commit y la barrera lo detecta. La primera barrera local sigue siendo `.gitignore`.
- **Recomendación:** que el script revise el contenido preparado (el blob del índice) en lugar del archivo del árbol de trabajo.

#### DEF-003

- **Severidad:** MINOR.
- **Criterio de aceptación afectado:** CA-1, CA-2 (redondeo).
- **Descripción:** ningún caso de las pruebas de recetas cae en un empate de redondeo, ni en la bruta ni en el costo por unidad. La mutación X4 (mitad hacia abajo) sobrevive en los 3 archivos de recetas. La detecta, de forma indirecta, `inventory-units.test.ts` de T1, porque las dos cuentas usan `divideRounded`.
- **Pasos para reproducir:** cambiar en una copia `(2n * n + d) / (2n * d)` por `(2n * n + d - 1n) / (2n * d)` y ejecutar los 3 archivos de recetas.
- **Resultado esperado:** al menos un fallo en las pruebas de recetas.
- **Resultado actual:** 37/37 y 4/4 en verde.
- **Evidencia:** tabla X.
- **Impacto:** si en el futuro la bruta o el costo usaran otra función de redondeo, ninguna prueba de recetas lo detectaría.
- **Recomendación:** añadir un caso de empate a una prueba existente de costo (p. ej., un total cuyo costo por unidad tenga un 5 exacto en el quinto decimal).

#### DEF-004

- **Severidad:** MINOR (soporte de pruebas, no producción).
- **Criterio de aceptación afectado:** ninguno de este PR.
- **Descripción:** el doble de la API de inventario de `inventory-manager` (`tests/support/api-double-inventory.ts`) tiene su propia tabla de unidades sin `hr` y su mensaje sigue listando 5 unidades. El formulario real ya ofrece `hr` (desviación 2 del PR 1), así que con el doble el alta en `hr` da 422.
- **Pasos para reproducir:** con `startInventory`, hacer un alta con `baseUnit = hr`.
- **Resultado esperado:** que el doble acepte las unidades del contrato.
- **Resultado actual:** 422 `baseUnit`.
- **Evidencia:** sonda G3, en la copia del scratchpad (ya borrada).
- **Impacto:** hoy ninguna prueba falla. Las pruebas del PR 3 en `hr` fallarían contra el doble.
- **Recomendación:** que el doble use `INVENTORY_UNITS` del contrato, en el PR 3 a más tardar.

#### Observaciones (no son defectos)

- **OBS-1 (migración con carga):**
  - Durante el `ADD FOREIGN KEY` hacia `inventory_item`, las escrituras concurrentes de T1 sobre `inventory_item` recibieron `ER_LOCK_DEADLOCK`: 4 en M2 y 2 al repetir la migración sentencia a sentencia, ambas veces en la última FK (`inventory_recipe_line_ingredient_item_id_fkey`).
  - Es un bloqueo de metadatos breve: latencia máxima de 40 ms, sin reconstruir la tabla.
  - El store reintenta 1213 hasta 3 veces.
  - En producción no hay escrituras de inventario (`main` no lo tiene).
- **OBS-2 (C-2):** si el artículo en `hr` está en una receta, la mitigación "cambiar esos artículos" no se puede hacer desde la app, porque RN-4 bloquea la unidad base. El aviso del README del PR 3 debería indicar SQL o recrear la base local.
- **OBS-3 (barrera):** `/datos-privados/` solo se ignora en la raíz, como dice el TAP. Una carpeta `restaurante/datos-privados/` no se ignoraría; el contenido lo sigue vigilando el lint.

### Regresión

- `npm test` completo en verde en los 3 workspaces.
- V3: `main` sobre la base migrada.
- V6: `api` del worktree.
- G3: formulario de T1 y edición que conserva los campos nuevos.
- Única desviación: DEF-001, de 503 a 500 ante una espera de bloqueo agotada.

### Responsive, accesibilidad, UX/UI, performance y SEO

No aplican a este PR: no hay pantallas nuevas ni cambios en las landings.

Rendimiento del dominio:

- costo calculado en memoria en O(V+E);
- grafo y profundidad sin recursión SQL;
- G2 muy por debajo de 20 s.

### Pendientes de revisión manual

1. `verify-backup.sh --drill` pide TTY: no se ejecutó. Lo hace el usuario tras desplegar la épica.
2. Empaque llamado "hr" en desarrollo (no se encendió el `mysql-dev` de desarrollo; en la base de QA hay 0). Con el `mysql-dev` encendido, desde `restaurante/`:
   `docker compose exec mysql-dev sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" restaurante -e "SELECT i.id, i.name, u.name AS empaque FROM inventory_item_unit u JOIN inventory_item i ON i.id = u.item_id WHERE LOWER(TRIM(u.name)) = '"'"'hr'"'"' OR u.name_key = '"'"'hr'"'"';"'`
   Si devuelve filas, hay que renombrar esos empaques antes de usar T2: `hr` pasa a ser unidad del sistema y una edición del artículo rechazaría el empaque.
3. El scratchpad de la sesión de QA interrumpida (`/private/tmp/claude-501/-Users-orvigas-Desktop-Negocio/5597000e-fd28-435a-b7c2-0dd58961b5bc/scratchpad/`) contiene una copia del libro de datos reales (`xl/d.xlsx`), su análisis y listas de nombres. No es de esta sesión y no se tocó: el usuario debería borrarlo.

### Limpieza

- Bases `restaurante_test_qa050_{b,c,d,m,m2,v}` borradas, y las 4 remanentes de la sesión anterior: hoy hay 0 bases `restaurante_test*`.
- `docker compose -p restaurante-qa-050 down -v`: se quitaron el contenedor, el volumen `restaurante-qa-050_mysql-dev-data` y las redes `restaurante-qa-050_*`. Volúmenes y redes, iguales a la línea base previa al QA. `restaurante-mysql-dev-1` sigue `Exited`. Nada escucha en 3307, 3191 ni 3192.
- No quedan procesos `server.ts`, `vitest` ni de carga.
- Scratchpad de esta sesión vacío: copia de T1, copia de mutaciones, sondas, env, hash y contraseña de QA, lista de F5, logs y volcado.
- Archivos de P retirados del índice y borrados; `git status` del worktree igual al inicial (más este ticket).
- El árbol principal sigue en `main` sin cambios; `git worktree list` sin worktrees nuevos.
- `Datos de entrada.xlsx` intacto.

### Resultado final

QA_APPROVED

## Pendientes del PR 1 para los PR 2 y 3

Hallazgos MINOR y observaciones del QA del PR 1 que no bloquearon el merge y quedan asignados:

- **PR 2 (API, importación y semilla):**
  - **DEF-001:** traducir `InventoryBusyError` a 503 en las rutas de inventario de la `api` (también en las de artículos de T1), junto con los demás errores nuevos (`ItemInActiveRecipesError` → 409 y `Recipe*`). QA lo comprueba con una espera de bloqueo agotada en `PUT /api/v1/admin/inventario/articulos/:id`.
- **PR 3 (pantallas y documentación):**
  - **DEF-004:** que el doble de la API de inventario de `inventory-manager` (`tests/support/api-double-inventory.ts`) use `INVENTORY_UNITS` del contrato (acepta `hr`) y su mensaje liste las unidades del contrato.
  - **OBS-2:** el aviso del README sobre C-2 indica que un artículo en `hr` que ya está en una receta no se puede cambiar desde la app (RN-4 bloquea la unidad base): se corrige por SQL o recreando la base local.
- **Sin PR asignado (MINOR, a decidir al planificar el PR 2):**
  - **DEF-002:** que `scripts/check-private-data.ts` revise el contenido preparado (blob del índice) y no el del árbol de trabajo. Solo afecta en local; el CI lo detecta.
  - **DEF-003:** añadir un caso de empate de redondeo a una prueba existente de costo de recetas.
  - **OBS-3:** `/datos-privados/` solo se ignora en la raíz (como dice el TAP); el contenido lo sigue vigilando el lint.

Pendientes del usuario:

1. Ejecutar en desarrollo la consulta de empaques llamados "hr" (comando en "Pendientes de revisión manual", punto 2) antes de usar T2; si devuelve filas, renombrar esos empaques.
2. Ejecutar `verify-backup.sh --drill` tras desplegar la épica.
3. Borrar el scratchpad de la sesión de QA interrumpida con la copia del libro de datos reales (punto 3 de "Pendientes de revisión manual").

## Historial de cambios

### Commit y Pull Request PR 1 (senior-fullstack, 2026-11-19)

`epic/inventario` sin cambios desde la salida de la rama (`0c3c293`): no hizo falta integrarla. `npm run typecheck` y `npm run lint` en verde (barrera: 835 archivos, sin datos privados); índice revisado sin hojas de cálculo, JSON de importación real ni temporales. Pendientes del QA asignados a los PR 2 y 3 ("Pendientes del PR 1 para los PR 2 y 3"). Commit `feat` y PR en borrador hacia `epic/inventario`.

### QA Report PR 1, ronda 1 (senior-qa, 2026-11-19)

QA Action Plan aprobado por el usuario ("Si"). Ejecutado completo: F, G, M, D, C, V, B, P y X. CA-1 a CA-11 y CA-14 en PASS con evidencia; sin defectos BLOCKER, CRITICAL ni MAJOR; 4 MINOR (DEF-001 a DEF-004) y 3 observaciones. Estado `QA_APPROVED`. Limpieza comprobada.

### QA Action Plan PR 1 (senior-qa, 2026-11-19)

Implementación del PR 1 aprobada por el usuario ("Apruebo"). QA Action Plan del PR 1 escrito (F, M, D, C, V, B, P, X, G) sin ejecutar pruebas ni levantar procesos. Estado `NEEDS_QA_PLAN_APPROVAL`.

### Implementación PR 1 (senior-fullstack, 2026-11-19)

Plan aprobado por el usuario ("Si", con PT-1 a PT-7 como se recomendaron). Ticket copiado de `backlog/` a `in-progress/` (copia idéntica comprobada con `cmp` antes de borrar la de `backlog/`). Implementado el PR 1: migración `inventario_recetas`, dominio, persistencia, barrera de datos privados y sus pruebas. Estado `NEEDS_IMPLEMENTATION_APPROVAL`; sin commit.

### Revisión técnica (senior-fullstack, 2026-11-19)

Technical Action Plan añadido y estado `NEEDS_TECHNICAL_PLAN_APPROVAL`. Contiene:

- la conciliación de C-1 a C-7 con el código real de T1;
- la migración aditiva;
- el dominio, el store, la API y la importación A5 con su barrera;
- las pantallas, el brief de Stitch y las pruebas;
- las decisiones PT-1 a PT-7.

Sin cambios en el código.

### Versión 1

Descripción inicial: requisito de T2 refinado a partir del análisis del libro de datos reales (sin copiar sus valores), conciliado con el plan técnico de T2 a T5 aprobado y con el código de T1. Validado por el usuario el 2026-11-19.
