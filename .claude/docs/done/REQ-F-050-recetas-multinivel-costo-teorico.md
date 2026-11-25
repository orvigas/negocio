# REQ-F-050 — T2: recetas multinivel, versiones y costo teórico

## Estado

DONE — T2 completo en `epic/inventario` (2026-11-25). El usuario confirmó el merge del PR 3 ("mergeado") y aprobó el cierre ("Sí, empieza por el punto 1"). Pull Requests de T2, todos mergeados en `epic/inventario`:

- PR 1 (modelo, dominio y persistencia): #185 (https://github.com/orvigas/negocio/pull/185).
- PR 2a (contratos y rutas de la API de recetas): #188 (https://github.com/orvigas/negocio/pull/188), merge `1c18060`.
- PR 2b (importación única A5 y semilla de desarrollo): #189 (https://github.com/orvigas/negocio/pull/189), merge `9371772`.
- PR 3 (pantallas de recetas): #190 (https://github.com/orvigas/negocio/pull/190), commit `831fe9e`, merge `906290b` (2026-11-25T14:46:24Z).

CI de #190 (ejecución 45636199119): `calidad`, `docker`, `auditoria`, `pruebas (1/2)`, `pruebas (2/2)`, `verificacion` y `cambios` en `pass`; `deploy`, `publish`, `vigente` y `validado` omitidos (*skipped*) por ir a `epic/inventario`, que no publica ni despliega.

Seguimientos aprobados, fuera de este ticket:

- DEF-007 (MINOR): el error de ciclo y de profundidad no se marca en la línea que cierra el ciclo.
- DEF-008 (MINOR): tras "Añadir 10 filas" sin JS, el foco vuelve al inicio del documento.
- DEF-007 y DEF-008 van a un ticket aparte, aprobado por el usuario ("DEF-007 y DEF-008 como seguimiento aparte"), aún sin abrir.
- Observaciones OBS-10 a OBS-14 (ver "QA Report — PR 3 (T2)"), sin corregir.
- Revisión manual con VoiceOver (Y3 del QA del PR 3) pendiente: no se pudo ejecutar desde el entorno de QA.
- La importación A5 en producción sigue sujeta a PT-5: solo cuando la épica llegue a `main`, tras T3.

Antecedente (PR 3, commit y PR): READY_FOR_MERGE — PR 3 de 3 (pantallas de recetas): QA ronda 1 `QA_APPROVED`, sin defectos BLOCKER, CRITICAL ni MAJOR. DEF-007 y DEF-008 (MINOR) quedan como seguimiento aparte, aprobado por el usuario ("DEF-007 y DEF-008 como seguimiento aparte"); no se corrigen en este PR. Commit y Pull Request hacia `epic/inventario` en "Commit y Pull Request — PR 3". Este registro se hace antes de marcar el PR listo: el estado `READY_FOR_MERGE` queda sujeto a que su CI termine en verde (ver el informe de senior-fullstack).

Antecedente (QA del PR 3): QA_APPROVED — PR 3 de 3: QA ronda 1 sin defectos BLOCKER, CRITICAL ni MAJOR (2 MINOR: DEF-007 y DEF-008). Ver "QA Report — PR 3 (T2)".

Antecedente (QA Action Plan del PR 3, aprobado: "Sí, apruebo"): NEEDS_QA_PLAN_APPROVAL — PR 3 de 3: implementación aprobada por el usuario ("Sí, apruebo con las tres decisiones": sin vista previa de bruta y costo en el editor; tablas con desplazamiento horizontal en región con foco a 360 px y editor en tarjetas; `datalist` de unidades común con rechazo por línea en la API). QA Action Plan del PR 3 escrito; pendiente de aprobación. Ver "QA Action Plan — PR 3 (T2)".

Antecedente (implementación del PR 3): NEEDS_IMPLEMENTATION_APPROVAL — PR 3 de 3 (pantallas de recetas, campos nuevos de la ficha de T1, cliente HTTP de recetas, DEF-003 a DEF-006, OBS-2 y documentación) implementado en `feature/REQ-F-050-recetas-pantallas`, sin commit, con las decisiones de diseño H-1 a H-5 aprobadas por el usuario ("Si" a la propuesta móvil). Ver "Implementation Result — PR 3".

Antecedente (PR 2, mergeado en `epic/inventario` con #188 y #189, CI en verde): READY_FOR_MERGE — PR 2 de 3 (contratos y rutas de la API de recetas, importación única A5 y semilla de desarrollo), partido en PR 2a y PR 2b hacia `epic/inventario`. Implementación aprobada por el usuario ("Si": partir al commitear en PR 2a y PR 2b y aceptar las 6 desviaciones). QA Action Plan del PR 2 aprobado ("Si", 2026-11-20). QA ejecutado, ronda 1: `QA_APPROVED`, sin defectos BLOCKER, CRITICAL ni MAJOR (1 MINOR y 1 TRIVIAL). Reparto 2a/2b validado, con su huella. Ver "QA Report — PR 2 (T2)". PR 2a: commit `ade09f1`, PR #188 (https://github.com/orvigas/negocio/pull/188) con el CI en verde (ejecución 44750303792: `calidad`, `docker`, `auditoria`, `pruebas (1/2)`, `pruebas (2/2)` y `verificacion` en `pass`) y mergeado por el usuario en `epic/inventario` (merge `1c18060`, 2026-11-20). PR 2b: commit `05a4c4e` más el merge de `origin/epic/inventario` (`139c9df`) en `feature/REQ-F-050-recetas-importacion`, PR #189 hacia `epic/inventario` (https://github.com/orvigas/negocio/pull/189). Este registro se hace antes de marcar el PR listo: el estado `READY_FOR_MERGE` del PR 2b queda sujeto a que su CI termine en verde (ver el informe de senior-fullstack). Ver "Commit y Pull Requests — PR 2a y PR 2b".

Antecedente (PR 1, mergeado en `epic/inventario` con #185): READY_FOR_MERGE — PR 1 de 3 (modelo, dominio y persistencia): implementación aprobada por el usuario ("Apruebo", 2026-11-19); QA Action Plan aprobado ("Si", 2026-11-19); QA ejecutado, ronda 1, sin defectos BLOCKER, CRITICAL ni MAJOR (4 MINOR). Ver "QA Report — PR 1 (T2)". Commit `cb9bc4d` y Pull Request #185 hacia `epic/inventario`: https://github.com/orvigas/negocio/pull/185. Integrada `epic/inventario` (`d3a78be`, con el override de `effect` 3.22.5 de #186) en el merge commit `5df99c5`; CI del PR en verde (ejecución 44720216193): `calidad`, `docker`, `auditoria`, `pruebas (1/2)`, `pruebas (2/2)` y `verificacion` en `pass`.

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

## Implementation Result — PR 2

### Rama

`feature/REQ-F-050-recetas-api-importacion`, desde la punta de `origin/epic/inventario` (`0187298`, con el PR 1 mergeado en #185), en el worktree `.claude/worktrees/req-f-050-pr2`. Sin commit (pendiente de aprobación y QA). PR futuro hacia `epic/inventario`.

### Cambios realizados

- **Contratos** (`packages/contracts`):
  - `inventory.ts`: el artículo lleva `referenceCost` (texto con 4 decimales o `null`) e `inventoriable`; peticiones con esos campos y `recipes: 'keep'` en la baja; códigos `ITEM_IN_ACTIVE_RECIPES` e `INVENTORY_BUSY`; esquema del 409 `ITEM_IN_ACTIVE_RECIPES` con `recipes`.
  - `inventory-recipes.ts` (nuevo): rutas, esquemas de las 7 respuestas (lista, receta con costo por línea y origen, versión sin costo, guardar, cerrar, «usado en», ingredientes), errores `RECIPE_VERSION_CONFLICT` (con `current`) y `RECIPE_CYCLE` (con `path`), `INVENTORY_COST_SOURCES` y tipos de petición. Cantidades con 3 decimales, merma con 2 y costos con 4, siempre como texto; un costo que falta es `null`.
- **Rutas** (`api/src/admin`):
  - `inventory-recipe-routes.ts` (nuevo): `GET recetas`, `GET recetas/ingredientes`, `GET recetas/versiones/:id`, `GET|POST articulos/:id/recetas` (201 versión nueva con `Location`, 200 sin cambios, `Idempotency-Key`), `POST articulos/:id/recetas/cerrar` y `GET articulos/:id/usado-en`. Orden de acceso 401 → 403 `FORBIDDEN_ROLE` → CSRF → 404 → cuerpo cerrado (también dentro de `lines`) → reglas. Logs `inventory_recipe_saved`, `inventory_recipe_conflict`, `inventory_recipe_cycle` e `inventory_recipe_too_deep`, solo con ids, números y acciones.
  - `inventory-shared.ts` (nuevo): id de la ruta, clave de idempotencia, alta idempotente y el 503 `INVENTORY_BUSY`, compartidos con las rutas de T1 (antes duplicados).
  - `inventory-routes.ts` (T1): campos nuevos del artículo, `recipes: 'keep'` en la baja, 409 `ITEM_IN_ACTIVE_RECIPES` con la lista y **DEF-001**: `InventoryBusyError` → 503 `INVENTORY_BUSY` (antes 500).
  - `router.ts`, `index.ts` y `server.ts`: composición con `createRecipeRepository` sobre el mismo store.
- **Importación única (A5)**:
  - `packages/core/inventory/master-import.ts` (nuevo, puro): `parseImportFile` (forma cerrada del formato v1), `planImport` (correcciones, unidades `gr`/`lt`, validación con las funciones de core, comparación por nombre normalizado: omitido o conflicto, ciclos y profundidad con las vigentes) y `runMasterImport` (ensayo de solo lectura; escritura todo o nada con el candado de recetas, que vuelve a calcular el plan dentro de la transacción). Autor "Importación", recetas como versión vigente desde la importación (número = máximo + 1 si el artículo tenía versiones cerradas). Los problemas se informan por fila del origen, campo y mensaje, sin valores; un ciclo, con las filas de sus recetas.
  - `api/scripts/inventory-import.ts` y `api/scripts/support/inventory-import-cli.ts` (nuevos): argumentos, salvaguardas (`production` exige `--produccion`; `--produccion` exige `production`; fuera de producción solo bases locales; un archivo `"ficticio": true` nunca en producción), 2 MB, JSON estricto, ruta relativa desde donde se lanzó npm (`INIT_CWD`), `verifyDatabase` sin migrar, informe con conteos y código de salida 1 ante errores o conflictos.
  - `packages/db/src/prisma-inventory-store.ts`: opción `writeTimeoutMs` (por defecto 10 s); la importación usa 60 s.
  - `inventory-repository.ts`: exporta la forma del historial (`itemHistorySnapshot`, `categoryHistorySnapshot`, `historyChanges`) para que la importación deje las mismas entradas que un alta desde la API.
  - Scripts `inventory:import` en `api/package.json` y en la raíz; `landing-pages/Dockerfile` copia `scripts/inventory-import.ts` a la etapa `api`.
  - Fixture ficticio `api/tests/fixtures/inventory-import/ficticio.json` (5 categorías, 12 artículos simples, un padre con 3 variantes, 3 recetas y 9 líneas; con una corrección, `gr`, `lt`, `hr` no inventariable, un insumo sin costo y la carne con merma del 40 %).
- **Semilla de desarrollo** (`api/scripts/support/inventory-dev-seed.ts` y `inventory-seed-dev.ts`): costos de referencia ficticios, "Cebolla" sin costo, "Mano de obra ficticia" (`hr`, no inventariable) y las recetas "Salsa base", "Carne cocida ficticia" (6.000 kg netos al 40 %, rendimiento 6 kg) y "Taco ficticio" (Compuesto de 2 niveles, «Sin costo» por la cebolla). Sigue siendo idempotente.
- **DEF-002** (barrera de datos privados): `scripts/check-private-data.ts` revisa el contenido preparado en el índice (`git cat-file blob :ruta`) y, si existe, también el del árbol de trabajo.
- **Dobles de prueba:** `memory-inventory-store.ts` admite `failNext(n, 'busy')` (espera de bloqueo agotada); el doble de la API de `inventory-manager` devuelve los dos campos nuevos del artículo (solo para que compile; DEF-004 sigue asignado al PR 3).
- **Documentación:** `README.md` (comando `inventory:import`, semilla ampliada, campos nuevos del artículo y rutas de recetas en la API) y `docs/despliegue.md` §5 ("Importación única del inventario", procedimiento en el VPS por la entrada estándar). `.env.example` sin cambios.

### Criterios de aceptación (alcance del PR 2)

- **CA-12:** cumplido en la API. Un Editor recibe 403 `FORBIDDEN_ROLE` en las 7 rutas de recetas (lectura y escritura), sin sesión 401, sin CSRF 403, y no se escribe nada (`admin-inventory-recipes-api.test.ts`). Las rutas del admin son del PR 3.
- **CA-13:** cumplido con el fixture ficticio (memoria y MySQL): el ensayo no escribe; la importación crea 5 categorías, 13 artículos, 3 variantes, 3 recetas y 9 líneas; la repetición da 0 creados y no cambia nada; un ciclo o una unidad inválida no escriben nada y listan cada error con su fila; las variantes quedan con nombres únicos (un nombre repetido es error).
- **CA-10 (HTTP):** 409 `ITEM_IN_ACTIVE_RECIPES` con la lista, confirmación con `recipes: 'keep'` y aviso `usesInactive` / `inactiveIngredientIds` en la API.
- **CA-6 (HTTP):** 409 `RECIPE_VERSION_CONFLICT` con la vigente; el doble envío con la misma `Idempotency-Key` crea una sola versión; guardar sin cambios responde 200 sin versión nueva.
- **CA-4 y CA-11 (HTTP):** 422 `RECIPE_CYCLE` con la ruta y 409 `RECIPE_NOT_ALLOWED`; los Compuestos no aparecen en `recetas/ingredientes`.
- **CA-7, CA-8 y CA-9 (HTTP):** costo por línea con su origen (`referencia`, `receta`, `sin_costo`), «Sin costo» con los faltantes y su ruta, y la mano de obra en `hr` no inventariable costeada por referencia.
- **RF-12:** semilla ampliada (prueba de la semilla modificada en `inventory-catalog.test.ts`).
- CA-1 a CA-5, CA-7 a CA-9 y CA-11 en el dominio: ya cubiertos en el PR 1, sin cambios.
- CA-14 y CA-16: sondas de QA. CA-15: PR 3.

### Validaciones ejecutadas

Desde `restaurante/` en el worktree, contra un MySQL 8.4 aislado (`docker compose -p restaurante-fs-050`, volumen propio; el `restaurante-mysql-dev-1` de desarrollo no se tocó y sigue `Exited`):

- `npm run build:css`: 0 (el worktree nuevo no tenía el CSS generado; sin él fallaban 4 pruebas de landing-pages que leen el CSS publicado).
- `npm run typecheck`: 0.
- `npm run lint` (con `check-private-data`): 0; "844 archivos revisados, sin datos privados".
- `npm test`: api 55 archivos y 1244 pruebas; landing-pages 64 y 903; inventory-manager 17 y 287. Todo en verde.
- Pruebas nuevas: `api/tests/integration/admin-inventory-recipes-api.test.ts` (6 casos), `api/tests/unit/inventory-import.test.ts` (10 casos; los dos archivos de la api en 1.4 s) y `landing-pages/tests/integration/prisma-inventory-import.test.ts` (2 casos, 2.7 s). Modificadas: `admin-inventory-api.test.ts` (forma del artículo y DEF-001: `PUT` con espera agotada → 503 `INVENTORY_BUSY` sin escribir), `contract-types.test.ts` (orígenes del costo y tipos con receta, contrato = core) e `inventory-catalog.test.ts` (semilla ampliada).
- **Procedimiento de `despliegue.md` §5 ejecutado en local** contra la imagen `api` construida (`docker build --target api`), con `docker run --read-only --tmpfs /tmp` en la red del MySQL aislado y la base `restaurante` migrada, leyendo por la entrada estándar una copia del fixture **sin** la marca `ficticio` (datos ficticios, en el scratchpad, ya borrada):
  - sin `--produccion`: "Con NODE_ENV=production la importación exige --produccion.", salida 1;
  - el fixture con `"ficticio": true` y `--produccion`: rechazado, salida 1;
  - ensayo: "Se crearían: categorías 5, artículos 13, variantes 3, recetas 3, líneas 9", "Ensayo sin problemas", salida 0;
  - `--escribir`: "escrita" con esos conteos, salida 0;
  - repetición con `--escribir`: "Creados: … 0" y todo omitido, salida 0.
  - En local por npm: `npm run inventory:import -- --archivo <ruta relativa>` y `--archivo -` con redirección (ensayo); un host no local se rechaza; `inventory:seed-dev` sobre una base con datos no hace nada.
- **Barrera (DEF-002), sondas descartables:** con el fixture preparado en el índice, el lint pasa; un JSON de importación sin la marca, preparado con `git add -f` y después sobrescrito con `{}` o borrado en el árbol de trabajo, hace fallar `check-private-data` (salida 1, solo la ruta). Después se sacó del índice y se borró; el fixture se volvió a dejar sin preparar.

### Archivos afectados

- Nuevos: `packages/contracts/inventory-recipes.ts`; `packages/core/inventory/master-import.ts`; `api/src/admin/inventory-recipe-routes.ts` e `inventory-shared.ts`; `api/scripts/inventory-import.ts` y `api/scripts/support/inventory-import-cli.ts`; `api/tests/fixtures/inventory-import/ficticio.json`; `api/tests/integration/admin-inventory-recipes-api.test.ts`; `api/tests/unit/inventory-import.test.ts`; `landing-pages/tests/integration/prisma-inventory-import.test.ts`.
- Modificados: `packages/contracts/{index,inventory}.ts`; `packages/core/inventory/{index,inventory-repository,memory-inventory-store}.ts`; `packages/db/src/prisma-inventory-store.ts`; `api/src/admin/{index,inventory-routes,router}.ts`; `api/src/server.ts`; `api/scripts/inventory-seed-dev.ts` y `api/scripts/support/inventory-dev-seed.ts`; `api/package.json` y `package.json`; `landing-pages/Dockerfile`; `scripts/check-private-data.ts`; `api/tests/support/admin.ts`; `api/tests/integration/admin-inventory-api.test.ts`; `api/tests/unit/{contract-types,inventory-catalog}.test.ts`; `inventory-manager/tests/support/api-double-inventory.ts`; `README.md`; `docs/despliegue.md`.
- `deploy/` sin cambios.

### Riesgos o pendientes

- **Tamaño (PT-6).** El PR 2 suma unas 2 600 líneas (unas 2 140 en archivos nuevos), por encima del umbral de unas 1 500 del plan. Propuesta: partirlo al hacer el commit (T4) en **PR 2a** (contratos, rutas, DEF-001, semilla y la parte de la API del README; unas 1 250 líneas) y **PR 2b** (importación A5, DEF-002, Dockerfile, `despliegue.md` §5 y la parte del README del comando; unas 1 350), ambos hacia `epic/inventario` y en ese orden. El código ya está separado por archivos, así que partirlo no cambia nada. Decide el usuario; si prefiere un solo PR, se deja como está.
- **Desviaciones del TAP:**
  1. La forma del JSON se valida a mano en core (lista cerrada de claves y tipos), no con Zod: `core` no depende de Zod y el núcleo de la importación vive en core (TAP: "núcleo en core, puro"). El comportamiento es el pedido (claves desconocidas = error).
  2. Un ciclo de la importación se informa con las **filas** de sus recetas (p. ej. "Rec!2 → Rec!6 → Rec!2"), no con nombres, para cumplir "sin valores" en la salida.
  3. Además del índice, `check-private-data` revisa el árbol de trabajo (DEF-002, que estaba "sin PR asignado"); se resolvió aquí porque el PR 2 introduce el flujo del JSON real.
  4. `--produccion` sin `NODE_ENV=production` también se rechaza (el TAP solo pedía lo contrario), para que la bandera no se use por error en local.
  5. La respuesta de guardar devuelve el resumen de la versión (sin líneas); el admin del PR 3 redirige a la receta. El cliente HTTP de recetas en `contracts/admin-client.ts` queda para el PR 3, junto con su único consumidor.
  6. `arquitectura.md` §4 y §6 siguen asignados al PR 3, como dice el TAP; las rutas nuevas ya están en el README.
- **Pendientes del QA del PR 1:** DEF-001 y DEF-002 resueltos aquí. DEF-003 (caso de empate de redondeo) sigue sin PR asignado. DEF-004 y OBS-2 siguen en el PR 3; OBS-3 sin cambios.
- **Para QA:** la imagen `api` se construyó antes del último ajuste (ruta relativa con `INIT_CWD`, que no afecta a la lectura por la entrada estándar del procedimiento): conviene repetir el procedimiento con la imagen final. El tiempo de la importación con un fixture ampliado (150 artículos y 40 recetas) y la barrera con un `.xlsx` de prueba siguen siendo sondas de QA.
- **Limpieza:** se quitaron el proyecto `restaurante-fs-050` (contenedor, volumen y redes), la imagen `restaurante-api:fs050-sonda` y los temporales del scratchpad; volúmenes y redes de Docker iguales a la línea base; nada escucha en 3307; sin procesos de Vitest ni servidores. Queda la caché de capas de `docker build`. El repositorio principal sigue en `main` sin cambios. El worktree `req-f-050-pr2` se conserva (con `node_modules`, el cliente de Prisma y el CSS generados, todos ignorados por git).

## QA Action Plan — PR 2 (T2)

### Objetivo

Validar con evidencia, en un MySQL 8.4 de QA aislado y con la imagen `api` final, que el árbol de trabajo del PR 2 (contratos y 7 rutas de recetas, campos nuevos del artículo, DEF-001, importación única A5, DEF-002, semilla RF-12, Dockerfile y `despliegue.md` §5) cumple los criterios de su alcance sin regresión de T1, landings, bot, productos y página, sin datos reales en el repositorio, y que el reparto aprobado en **PR 2a** y **PR 2b** es viable: 2a compila y pasa lint y pruebas por sí solo, no depende de 2b y 2a + 2b = el árbol que QA valida. Se valida una sola vez el árbol completo. El worktree no está indexado por CodeGraph: QA usa Read y Grep dirigidos.

### Requisito bajo prueba

Ticket aprobado (versión 1), Technical Action Plan aprobado (PT-1 a PT-7; secciones "Contratos y rutas de la API (PR 2)", "A5 — Importación única (PR 2)", "Semilla de desarrollo (PR 2)", "Seguridad" y "Testing"), "Implementation Result — PR 2", los "Pendientes del PR 1 para los PR 2 y 3" (DEF-001 y DEF-002 asignados aquí) y la decisión del usuario sobre la implementación ("Si": 2a/2b y las desviaciones 1 a 6 aceptadas).

Fuera de alcance, sin tratarlo como defecto: pantallas del admin, CA-15 y la parte del admin de CA-12 (PR 3); DEF-003 (sin PR); DEF-004 y OBS-2 (PR 3); `arquitectura.md` §4 y §6 (PR 3, desviación 6); `verify-backup.sh --drill` (el usuario, tras desplegar la épica); importar el JSON real (PT-5). La migración no cambia en este PR (se comprueba en F2), así que CA-14 (vuelta atrás y respaldo) no se repite: queda como en el QA del PR 1.

### Criterios de aceptación (cada uno → pruebas que lo cubren)

| CA / alcance | Pruebas |
|---|---|
| CA-12 (API) | A1, A8, XA1, XA2 |
| CA-13 | I1–I6, I12, XI1–XI3, XI7 |
| CA-10 (HTTP: 409 `ITEM_IN_ACTIVE_RECIPES`, `recipes: 'keep'`, aviso) | A5, XA5 |
| CA-6 (HTTP: 409 con `current`, doble envío) | A2, A3, A7, XA3 |
| CA-4 y CA-11 (HTTP) | A2, A7 |
| CA-7, CA-8 y CA-9 (HTTP: costo por línea y origen, "Sin costo", `hr`) | A4, E1 |
| RF-10 (ficha: `referenceCost`, `inventoriable`, `hr`) | A4, G4 |
| RF-12 (semilla) | E1–E3, XE1 |
| DEF-001 (503 `INVENTORY_BUSY`, también en T1) | A6, XA4 |
| DEF-002 y barrera de datos privados (A5) | P1–P8, XB1 |
| Salvaguardas y salida de la importación (A5, Seguridad) | I7–I11, D1–D4 |
| CA-16 (regresión en lo que toca este PR) | G1–G5 |
| Reparto 2a / 2b | Z1–Z4 |
| Desviaciones 1–6 aceptadas | F4 |

### Riesgos identificados

- Una ruta de recetas sin el orden 401 → 403 → CSRF → 404 → cuerpo, o un Editor que escribe algo antes del 403.
- `Idempotency-Key` que no evita la segunda versión bajo envíos simultáneos, o que reutiliza la respuesta con otro cuerpo.
- DEF-001 corregido solo en algunas rutas de T1 (alta, edición, baja, categorías).
- Una edición de T1 desde el admin actual (que aún no envía `referenceCost` ni `inventoriable`) que los borre o los cambie.
- Ensayo que escribe o abre una transacción de escritura; `--escribir` que deja restos al fallar a mitad; conflicto que escribe lo nuevo (contra PT-2).
- Salvaguardas eludibles (`NODE_ENV`, `--produccion`, host, `ficticio`) o que se comprueban después de conectar a la base.
- Salida, errores o logs con nombres, cantidades, costos, contenido del JSON, SQL o pila (también en los caminos de error inesperado: `throw err` tras `verifyDatabase`).
- La imagen `api` probada antes del último ajuste (`INIT_CWD`); la imagen final sin el script o su soporte, o con piezas de desarrollo de más (la carpeta `scripts/support` entera entra en la imagen, incluida `inventory-dev-seed.ts`, que la importación importa por `DEV_SEED_HOSTS`).
- Procedimiento de §5 que no funciona tal como está escrito (`exec -T` con redirección, nombre de la unidad de respaldo, `$C`).
- Transacción de importación más larga que su `timeout` con el volumen real (pool de 5).
- Barrera de datos privados con falsos negativos (índice frente a árbol, borrado, `.xlsx` real) o que imprime contenido.
- El reparto 2a/2b: archivos compartidos a nivel de bloque (`core/inventory/index.ts` exporta `master-import.ts`; `inventory-repository.ts`, `prisma-inventory-store.ts`, `memory-inventory-store.ts`, `README.md`, ticket), un 2a que no compila sin 2b o un 2a + 2b distinto del árbol validado.
- Pruebas permanentes que no son funcionales o que duplican otras (`testing.md`), o archivos que pasan de 20 s.

### Revisión estática (F)

- **F1.** `git status` y `git diff 0187298 --stat`: solo los archivos de "Archivos afectados" más el ticket; nada en landings (`src/`, `public/`), bot, `inventory-manager/src`, `deploy/`, `ops/`, `.github/`, `.env.example` ni `package-lock.json` (`dependencias.md`: sin dependencias nuevas). `inventory-manager/tests/support/api-double-inventory.ts` solo con los dos campos.
- **F2.** Migración sin cambios: `git diff 0187298 -- restaurante/packages/db/prisma` vacío (también `schema.prisma`). Suma de `deploy/` con el método de `ci.yml` = `591de8e7f259073f79ff34418c8b7a3a2680d465ef3bc7378c620221455cc7f0`.
- **F3.** Lectura del diff completo frente al TAP y las reglas: tabla de rutas (códigos, cuerpos cerrados también en `lines`, decimales como texto, `null` para el costo que falta); entradas como `unknown` validadas (`typescript.md`); sin `any`, `as` y `!` justificados; errores con el formato central y sin el `message` de Prisma (`manejo-de-errores.md`); logs solo con ids, números y acciones (`logging.md`); `INIT_CWD`; `writeTimeoutMs` solo en la importación; Dockerfile solo con el script nuevo; README y §5 coherentes con el código.
- **F4.** Desviaciones 1 a 6 (aceptadas): se comprueba que el código hace lo que dice cada una (1: claves desconocidas = error sin Zod en core; 2: ciclo por filas; 3: índice y árbol; 4: `--produccion` sin `production` rechazado; 5: guardar devuelve el resumen; 6: `arquitectura.md` sin tocar). Una diferencia entre lo descrito y lo hecho es hallazgo; la desviación en sí no.
- **F5.** Sin secretos ni datos reales en el diff, los archivos nuevos (fixture incluido) y el ticket: patrones de secretos y una lista de nombres característicos del libro y de costos con 4 decimales, que vive solo en el scratchpad y se borra; el informe da "N coincidencias" y la ruta, nunca el valor. El fixture es ficticio y lleva `"ficticio": true`.
- **F6.** Pruebas permanentes nuevas y modificadas según `testing.md`: funcionales, sin duplicar otra, sin arquitectura, `listenLocal`/`startAdmin`, `makeDatabase()`, sin esperas fijas ni `retry`; la modificación de `admin-inventory-api.test.ts`, `contract-types.test.ts` e `inventory-catalog.test.ts` solo por el cambio de comportamiento. Una que no cumpla → `MINOR` con la recomendación de quitarla.

### API de recetas y ficha (A), contra la `api` del worktree y el MySQL de QA

`node src/server.ts` del worktree con un env propio en el scratchpad (el worktree no tiene `api/.env`), base `restaurante_test_qa050b_a` migrada, usuarios Administrador, Gerente y Editor creados con los scripts del proyecto, y datos ficticios con un marcador único en nombres, notas y costos. Cliente HTTP con sesión y CSRF como el admin.

- **A1. CA-12 y acceso.** Las 7 rutas: sin sesión 401; Editor 403 `FORBIDDEN_ROLE` en lectura y escritura (también con CSRF válido); escrituras de Administrador y Gerente sin CSRF o con uno inválido → 403; tras cada rechazo, conteos y `CHECKSUM TABLE` de las tablas `inventory_*` iguales; Administrador y Gerente 200/201.
- **A2. Códigos de cada ruta.** `GET recetas` (200; 422 con `tipo` inválido, `pagina` 0 o no numérica, `q` demasiado larga; vacío); `GET articulos/:id/recetas` (200 con vigente y versiones; 404; 409 `RECIPE_NOT_ALLOWED` en Insumo, Reventa y padre); `GET recetas/versiones/:id` (200 sin costo, PT-4; 404 `RECIPE_VERSION_NOT_FOUND`); `POST articulos/:id/recetas` (201 con `Location`; 200 sin cambios y sin fila nueva; 422 `VALIDATION_FAILED` con `fields` por línea: clave desconocida dentro de `lines`, coma decimal, decimales de más, merma 100, 0 y 41 líneas, ingrediente repetido, `pza` sin factor; 422 `RECIPE_CYCLE` con `path`; 422 `RECIPE_TOO_DEEP`; 409 `RECIPE_NOT_ALLOWED`, `RECIPE_ITEM_INACTIVE` y `RECIPE_VERSION_CONFLICT` con `current`); `POST …/cerrar` (200; 200 idempotente sin vigente; 409 con base vieja); `GET articulos/:id/usado-en` (200; 404); `GET recetas/ingredientes` (sin Compuestos, padres ni inactivos; con base y empaques). Ids `0`, `01`, `-1`, `abc` y de 11 cifras → 404; cuerpo no JSON, `Content-Type` ajeno y cuerpo grande → 400/415/413 del manejador central; `__proto__` en el cuerpo → 422 sin efecto.
- **A3. `Idempotency-Key`.** Misma clave y mismo cuerpo, en serie y en 10 rondas simultáneas → una sola versión y la misma respuesta; misma clave con otro cuerpo → 422 `IDEMPOTENCY_KEY_REUSED` sin escribir; clave inválida → 400; la misma clave de otro usuario o de otro artículo no se confunde.
- **A4. Costo y ficha (CA-7, CA-8, CA-9, RF-10).** Costo por línea y origen (`referencia`, `receta`, `sin_costo`) contra un cálculo a mano (CA-1, CA-3 y RN-T2-1: 166.6667/kg); "Sin costo" con `missing`, nunca 0; cambiar una referencia o una sub-receta cambia el costo sin versión nueva; Insumo `hr` no inventariable costeado. `POST`/`PUT articulos` con `referenceCost` e `inventoriable`: válidos guardados y devueltos tal cual; 422 por campo (negativo, 5 decimales, coma, texto, `inventoriable: false` fuera de Insumo, referencia en Compuesto o padre); historial RN-16 con ambos campos.
- **A5. Baja de un artículo usado (CA-10).** Sin `recipes: 'keep'` → 409 `ITEM_IN_ACTIVE_RECIPES` con `recipes: [{ itemId, name }]` y sin escribir; con `keep` → inactivo, sus recetas vigentes intactas con `usesInactive`/`inactiveIngredientIds`, fuera de `ingredientes`; padre con variantes usadas → la lista incluye las variantes.
- **A6. DEF-001.** Una sesión SQL retiene `SELECT … FROM inventory_lock WHERE name = 'recetas' FOR UPDATE`; entonces `PUT articulos/:id`, `POST articulos`, `POST articulos/:id/desactivar`, la escritura de categorías que tome el candado y `POST articulos/:id/recetas` → 503 `INVENTORY_BUSY` (~5 s, el `innodb_lock_wait_timeout` de pruebas), sin escribir, log `inventory_busy` en `warn` sin datos y nunca 500. Se repite el escenario exacto con el que se confirmó DEF-001 en el PR 1.
- **A7. Concurrencia por HTTP.** 10 rondas: dos `POST` del mismo artículo desde la misma base con contenidos distintos → un 201 y un 409 con `current`; A→B y B→A simultáneos → uno 422 `RECIPE_CYCLE`; nunca 500, nunca dos vigentes.
- **A8. Fugas.** En todas las respuestas de error de A1–A7, sin pila, SQL, nombres de tablas ni mensajes de Prisma. El log completo de la `api` durante A1–A7: 0 apariciones del marcador (nombres, notas y costos) y solo los eventos del TAP con sus campos.

### Importación A5 (I), contra el MySQL de QA

Por `npm run inventory:import` y por `node scripts/inventory-import.ts` del worktree, con env del scratchpad. Copias del fixture con marcadores únicos en todos los nombres, notas y filas.

- **I1. Ensayo (por defecto).** Sobre una base vacía y sobre una con datos: salida 0 y los conteos esperados (5 categorías, 13 artículos, 3 variantes, 3 recetas y 9 líneas); conteos y `CHECKSUM TABLE` de todas las tablas iguales; con el `general_log` del MySQL de QA activo, ninguna sentencia `INSERT`, `UPDATE`, `DELETE` ni `SELECT … FOR UPDATE` del proceso.
- **I2. Escritura.** `--escribir` → "escrita", los mismos conteos, recetas como versión 1 vigente, autor "Importación" en `inventory_change` y en `created_by_name`; la merma del 40 % y la neta de la carne tal como vienen en el JSON; variantes con nombre completo y únicas; `gr`→`g`, `lt`→`L`, `hr` no inventariable; correcciones aplicadas y una corrección sin usar como aviso. Lectura posterior por la API (A) con el costo calculado.
- **I3. Idempotencia.** Repetir el ensayo y `--escribir` → "Creados: … 0", todo omitido, checksums iguales. Un artículo con número de versión cerrada previa → la importada es máximo + 1.
- **I4. Todo o nada ante errores.** Una copia por caso, con ensayo y con `--escribir`: ciclo (filas en la ruta), unidad inválida, merma 100, rendimiento 0, costo negativo, coma decimal, nombre y SKU repetidos, referencia a un ingrediente inexistente, clave desconocida, `formato` o `version` distintos, JSON inválido, archivo vacío. Salida 1, **todos** los errores listados con fila y campo, sin valores, y checksums iguales. Un archivo con varios errores los lista todos.
- **I5. Todo o nada ante conflictos (PT-2).** Tras I2, una copia con un campo distinto en un artículo, una categoría y una receta existentes más artículos nuevos → salida 1, conflictos por fila y campo, y con `--escribir` no se escribe **nada** (tampoco lo nuevo).
- **I6. Fallo a mitad de la escritura.** (a) Candado retenido como en A6 → mensaje "ocupado", salida 1, sin restos. (b) Un `TRIGGER` de QA en la base de QA que hace `SIGNAL` al insertar la última línea de receta → salida 1 con el mensaje genérico, sin pila, y conteos y checksums iguales a antes. (c) Se mata el proceso (`SIGKILL`) durante la escritura del fixture ampliado → sin restos.
- **I7. Salvaguardas.** Matriz `NODE_ENV` (`production` / otro) × `--produccion` × host (`127.0.0.1`, `localhost`, `::1`, `mysql-dev`, uno remoto como `10.255.255.1`) × `ficticio`: solo pasan producción con `--produccion` y sin `ficticio`, y fuera de producción sin la bandera contra un host local. Los rechazos ocurren **antes** de conectar (sin conexiones nuevas en `SHOW PROCESSLIST` ni espera de red con el host remoto). Sin `DATABASE_URL` o mal formada → mensaje sin la URL. Argumentos desconocidos, `--archivo` sin valor o repetido → uso.
- **I8. Archivo y entrada estándar.** `--archivo -` con redirección y con tubería; entrada vacía; BOM; ruta relativa desde `restaurante/` y desde `restaurante/api` (`INIT_CWD`); ruta inexistente o directorio; 2 MB exactos aceptados y 2 MB + 1 byte rechazados, por archivo y por entrada estándar.
- **I9. Base no lista.** MySQL parado o base sin migrar → mensaje de `verifyDatabase` sin la URL, salida 1, no migra (sin tablas creadas).
- **I10. Salida sin valores.** En la salida estándar y de error de I1–I9 e I11–I12: 0 apariciones de los marcadores (nombres, notas, costos y contenido), incluido el JSON inválido y el error de base.
- **I11. Imagen `api` final.** `docker build --target api` del árbol que se valida (etiqueta `restaurante-api:qa050b`): contiene `scripts/inventory-import.ts` y su soporte y no contiene `tests/`, el fixture, `inventory-seed-dev.ts`, `dev-server.ts` ni `bot-chat.ts` (se informa qué de `scripts/support` entra, p. ej. `inventory-dev-seed.ts`, y si al importarlo tiene efectos); `docker run --read-only --tmpfs /tmp -i` en la red del MySQL de QA con `NODE_ENV=production`, como `exec -T` del procedimiento: sin `--produccion` → rechazo; ficticio con `--produccion` → rechazo; copia sin la marca (ficticia, en el scratchpad) → ensayo 0, `--escribir` 0, repetición "0 creados"; tras la escritura, ningún archivo nuevo en el contenedor.
- **I12. Procedimiento de `despliegue.md` §5 tal como está escrito.** Pasos 2 a 4 adaptados solo en `$C` (el compose del VPS no existe en local; se sustituye por el equivalente con la imagen de I11) y en el `scp` (copia local con `chmod 600`); se comprueba que `$C`, `restaurante-backup.service` y `exec -T` coinciden con el resto de `despliegue.md`, `ops/backup/systemd` y `deploy/compose.prod.yaml`; `shred -u` y la comprobación del paso 4 se ejecutan en la copia del scratchpad.
- **I13. Tiempo.** Fixture ficticio ampliado generado en el scratchpad (150 artículos, 40 recetas y unas 200 líneas, con 3 niveles): duración del ensayo y de `--escribir` con el comando del worktree y con la imagen, 3 repeticiones cada uno; holgado frente a los 60 s (`timeout`) y a los 10 s de las escrituras de la app. Más de 30 s = hallazgo.

### Semilla de desarrollo (E)

`node scripts/inventory-seed-dev.ts` del worktree con env del scratchpad sobre bases de QA:

- **E1.** Base migrada vacía → "Mano de obra ficticia" en `hr`, no inventariable y con referencia; la mayoría de los insumos con referencia y "Cebolla" sin ella; "Salsa base", "Carne cocida ficticia" (6.000 kg netos al 40 %, bruta 10.000, rendimiento 6 kg) y "Taco ficticio" (Compuesto de 2 niveles, "Sin costo" con la cebolla en `missing`). Costos por la API contra un cálculo a mano.
- **E2.** Segunda ejecución y ejecución sobre una base con solo artículos de T1 → no hace nada, conteos y checksums iguales.
- **E3.** Rechazo con un host no local y con `NODE_ENV=production`; la imagen `api` no la contiene (I11).

### Barrera de datos privados (P; DEF-002)

Archivos ficticios del momento en el worktree, sacados del índice y borrados al terminar. `Datos de entrada.xlsx` no se abre, no se mueve ni se toca.

- **P1.** Un `.xlsx` válido generado al momento (libro mínimo con un marcador), más `.xlsm`, `.xls` y `.ods`: `git check-ignore -v` los ignora; con `git add -f`, `npm run lint` termina ≠ 0 y nombra solo la ruta.
- **P2.** DEF-002, el escenario del PR 1 tal cual: JSON de importación sin `ficticio` preparado con `git add -f` y después sobrescrito con `{}` → falla; borrado del árbol → falla.
- **P3.** El inverso: fixture ficticio preparado y el árbol de trabajo cambiado a no ficticio (lo que incluiría `git commit -a`) → falla.
- **P4.** Ficticio fuera de `api/tests/fixtures/inventory-import/` → falla; el fixture en su sitio → pasa; un JSON que no es de importación → no cuenta; ruta con espacios y acentos preparada → se revisa.
- **P5.** La salida solo contiene rutas y el mensaje: 0 apariciones del marcador.
- **P6.** Sin falsos positivos: `npm run lint` sobre el árbol actual → 0 y el número de archivos revisados (844 según la implementación; se explica cualquier diferencia); un archivo solo en el árbol de trabajo sin seguimiento no lo rompe.
- **P7.** El job `calidad` del CI corre `npm run lint` (lectura de `ci.yml`).
- **P8.** `Datos de entrada.xlsx`: ignorado, sin seguimiento, y su tamaño y fecha iguales al inicio y al final.

### Reparto en PR 2a y PR 2b (Z)

- **Z1. Reparto de referencia.** QA escribe en el QA Report el reparto archivo por archivo y, donde un archivo se comparte, bloque por bloque. Partida: **2a** = `contracts/{index,inventory,inventory-recipes}.ts`, `api/src/admin/{index,router,inventory-routes,inventory-recipe-routes,inventory-shared}.ts`, `api/src/server.ts`, `memory-inventory-store.ts` (`failNext('busy')`, de la prueba de DEF-001), la semilla (`inventory-seed-dev.ts` e `inventory-dev-seed.ts`), `api/tests/support/admin.ts`, `admin-inventory-api.test.ts`, `admin-inventory-recipes-api.test.ts`, `contract-types.test.ts`, `inventory-catalog.test.ts`, `api-double-inventory.ts` y la parte de la API del README; **2b** = `master-import.ts` y su `export` en `core/inventory/index.ts`, las exportaciones del historial de `inventory-repository.ts`, `writeTimeoutMs` de `prisma-inventory-store.ts`, los dos scripts de la importación, el fixture, `inventory-import.test.ts`, `prisma-inventory-import.test.ts`, `check-private-data.ts` (DEF-002), el Dockerfile, los dos `package.json`, `despliegue.md` §5 y la parte del comando del README. Se ajusta si F3 o Z2 muestran otra dependencia.
- **Z2. 2a por sí solo.** Copia APFS (`cp -c`) de `restaurante/` del worktree en el scratchpad (con sus `node_modules` y el cliente de Prisma), con `git init` propio para que `check-private-data` tenga índice, y quitando 2b con `git apply -R` del parche de 2b: `typecheck`, `lint` y `npm test` (3 workspaces) en 0; `grep` sin referencias a `master-import`, `inventory-import`, `writeTimeoutMs` ni `IMPORT_MAX_BYTES`; los archivos de 2a < 20 s.
- **Z3. 2a + 2b = árbol validado.** Se vuelve a aplicar el parche de 2b en la copia y `diff -r` (sin `node_modules` ni generados) contra el worktree → sin diferencias. Se registra la huella del árbol validado: `git write-tree` con un índice temporal del scratchpad (`GIT_INDEX_FILE`, sin tocar el índice del worktree) sobre `restaurante/`; senior-fullstack la compara con el árbol del commit de 2b (`git diff --quiet <huella> <commit-2b> -- restaurante`) antes de abrir los PR.
- **Z4.** Los parches de 2a y 2b quedan en el scratchpad solo durante el QA y se borran; el reparto queda descrito en el QA Report para que senior-fullstack lo reproduzca.

### Mutaciones (X), descartables

En otra copia APFS de `restaurante/` del worktree en el scratchpad, una a una, ejecutando solo los archivos afectados:

- **XA1.** Recetas sin la comprobación de rol (Editor pasa). **XA2.** `POST` de recetas sin CSRF. **XA3.** `Idempotency-Key` ignorada. **XA4.** `InventoryBusyError` sin traducir en `inventory-routes.ts` (DEF-001). **XA5.** Baja sin exigir `recipes: 'keep'`.
- **XI1.** El ensayo escribe. **XI2.** Conflictos ignorados (escribe lo nuevo). **XI3.** Errores que no abortan. **XI4.** Sin el rechazo de `production` sin `--produccion`. **XI5.** Sin el rechazo de `ficticio` con `--produccion`. **XI6.** Sin el rechazo de host remoto. **XI7.** `gr` sin normalizar a `g`. **XI8.** Escritura en varias transacciones (una por artículo).
- **XE1.** Semilla sin la merma de la carne.
- **XB1.** `check-private-data` que vuelve a leer solo el árbol de trabajo (sin prueba permanente por diseño; se documenta, no es defecto).

Una mutación que sobrevive es hallazgo: `MAJOR` si ninguna prueba permanente cubre ese comportamiento, `MINOR` si otra lo cubre de forma indirecta.

### Regresión (G)

- **G1.** Desde `restaurante/` del worktree: `npm run build:css`, `npm run typecheck`, `npm run lint` y `npm test` (3 workspaces) en 0, con los totales.
- **G2.** Duración por archivo con el reporter JSON de Vitest: todos < 20 s; los 3 nuevos y los 3 modificados, además, en 3 ejecuciones aisladas.
- **G3.** T1 desde el admin real: `inventory-manager` del worktree contra la `api` del worktree; lista, ficha y formulario de artículo responden 200; editar desde el formulario actual (que aún no envía los campos nuevos) **conserva** `referenceCost` e `inventoriable`; alta y edición en `hr` y en `kg`.
- **G4.** Landings, bot, productos y página: `GET /`, `/birria`, `/molotes` de `landing-pages` del worktree contra esa `api` → 200 con su contenido; rutas públicas de productos y página 200; login, producto y página del admin 2xx; el bot con su suite (dentro de G1).
- **G5.** Arranque de la `api` del worktree sobre la base migrada sin `DATABASE_ALLOW_NEWER_SCHEMA` y sin advertencias nuevas en el log.

### Pruebas automatizadas

Existentes: G1/G2 y Z2. Sondas temporales (A, I, E, P, Z, X) solo en el scratchpad; nada nuevo en `restaurante/landing-pages/tests/` ni en otro directorio del worktree, salvo los archivos temporales de P (con `git add -f`, retirados y borrados).

### Pruebas en navegador

No aplica: el PR 2 no tiene pantallas. G3 y G4 se validan con el HTML renderizado por HTTP.

### Responsive, accesibilidad, UX/UI, performance y SEO

No aplican (sin pantallas ni cambios en las landings). Performance: I13 y la duración de G2.

### Evidencia requerida

Código de salida y totales de cada comando; `git diff --stat`; diff vacío de la migración; suma de `deploy/`; tablas de A1–A8 (ruta, rol, código, conteos antes y después); latencias de A6; salidas resumidas de I1–I13 (solo conteos y mensajes, sin valores) y los recuentos de marcadores; extracto del `general_log` de I1 (solo los tipos de sentencia); `docker image inspect` y el listado de `scripts/` de la imagen; resultados de E1–E3 con los costos calculados; salidas de P1–P8; reparto Z1, resultados de Z2 y Z3 y la huella del árbol; tabla X; duraciones de G2; F5 en conteos; comprobación de limpieza.

### Limpieza (comprobada, no supuesta)

`docker compose -p restaurante-qa-050b down -v`; `docker rmi restaurante-api:qa050b` (queda la caché de capas, como en la implementación); `docker ps -a`, `docker volume ls` y `docker network ls` iguales a la línea base; `restaurante-mysql-dev-1` como estaba (apagado); sin procesos `server.ts`, `vitest`, de la importación ni de carga, y nada escuchando en 3307 ni en los puertos de QA; 0 bases `restaurante_test*` (el `TRIGGER` de I6 desaparece con su base); copias APFS, parches, fixtures ampliados, sondas, env, listas de F5, logs y marcadores del scratchpad borrados; archivos de P retirados del índice y borrados; `git status` del worktree igual al inicial más el ticket; árbol principal en `main` sin cambios; `git worktree list` sin worktrees nuevos (QA no crea ninguno); `Datos de entrada.xlsx` intacto (P8).

### Criterios de aprobación

`QA_APPROVED` solo si: F1–F6 sin desviaciones relevantes, migración sin cambios, suma de `deploy/` igual y sin datos reales; CA-12, CA-13 y los criterios HTTP de CA-4, CA-6, CA-7 a CA-11 en PASS (A1–A8, I1–I6); DEF-001 y DEF-002 corregidos con su escenario original (A6, P2); salvaguardas, salida sin valores, imagen final y §5 en PASS (I7–I12); I13 holgado; E1–E3 en PASS; P1–P8 en PASS; Z2 y Z3 en PASS; `typecheck`, `lint` y `npm test` en 0 y archivos < 20 s; G3–G5 sin regresión; sin `BLOCKER` ni `CRITICAL` y cada `MAJOR` aceptado por el usuario.

Escala por impacto observable: Editor que lee o escribe recetas, ensayo que escribe, escritura parcial, importación que pasa una salvaguarda, archivo ficticio importado con `--produccion`, datos reales en el repositorio o en la salida, costo incorrecto o un faltante como 0 = `CRITICAL`; dos versiones por un doble envío, 500 ante el candado, edición de T1 que borra `referenceCost` o `inventoriable`, procedimiento de §5 que no funciona tal como está escrito, imagen sin el comando, falso negativo de la barrera, 2a que no compila o no pasa sus pruebas sin 2b = `MAJOR` o superior; mutación no detectada = `MAJOR`/`MINOR` (arriba); desviación documental o de mensaje sin impacto = `MINOR`.

### Autorizaciones que se piden al usuario

1. Docker local: `docker compose -p restaurante-qa-050b up -d --wait mysql-dev` con el `compose.yaml` del worktree (volumen propio, `127.0.0.1:3307`), bases `restaurante_test_qa050b_*`, `general_log` activado solo en ese contenedor y un `TRIGGER` solo en una base de QA (I6). Si `restaurante-mysql-dev-1` está encendido o 3307 ocupado, QA se detiene y pregunta. Nunca se usa `restaurante-mysql-dev-1` ni datos reales.
2. `docker build --target api` con la etiqueta `restaurante-api:qa050b` y `docker run` de esa imagen en la red del proyecto de QA; la imagen se borra al terminar.
3. Ejecutar `api`, `landing-pages` e `inventory-manager` del worktree, la importación y la semilla con env propios en el scratchpad (nunca un `.env` de desarrollo), en puertos libres.
4. Copias APFS de `restaurante/` del worktree en el scratchpad para Z y X (con `git init` propio en la de Z); parches, fixtures ampliados, listas de F5 y sondas solo en el scratchpad; archivos temporales de P en el worktree (`git add -f`, retirados y borrados).
5. Escribir en el ticket del worktree solo `## Estado`, este plan, el QA Report y el Historial.

### Preguntas abiertas (con recomendación)

1. **Reparto 2a/2b:** ¿se acepta que QA valide su reparto de referencia (Z1) y registre la huella del árbol (Z3), y que senior-fullstack reproduzca ese reparto y compruebe la huella antes de abrir los PR, con el CI de cada PR como validación final? Recomendado: sí. Si al commitear el reparto cambia de bloque, solo se repite Z2 (no el QA completo).
2. **I11/E3:** la imagen `api` incluye toda la carpeta `scripts/support`, también `inventory-dev-seed.ts` (sin su comando), porque la importación importa `DEV_SEED_HOSTS` de ahí. ¿Se acepta si QA comprueba que importarla no tiene efectos y que la semilla no se puede lanzar desde la imagen? Recomendado: sí; si tuviera efectos, sería un hallazgo.
3. **I13:** ¿basta con el tamaño del TAP (150 artículos y 40 recetas)? Recomendado: sí, más el límite de 2 MB solo para la lectura (I8).
4. **I6 (c):** matar el proceso durante la escritura requiere una ventana medible; si con el fixture ampliado dura menos de 1 s, ¿se acepta sustituirlo por (a) y (b)? Recomendado: sí.

Pendientes del PR 1 que siguen siendo del usuario y QA no toca: la consulta de empaques "hr" en desarrollo, `verify-backup.sh --drill` y el borrado del scratchpad de la sesión de QA interrumpida con la copia del libro.

## QA Report — PR 2 (T2)

### Ronda

1 (2026-11-20). Plan aprobado por el usuario ("Si"), con las 5 autorizaciones y las recomendaciones a las 4 preguntas. Árbol de trabajo del worktree `req-f-050-pr2`, sin commit. MySQL 8.4 de QA aislado (`docker compose -p restaurante-qa-050b`, volumen propio, `127.0.0.1:3307`); el `restaurante-mysql-dev-1` de desarrollo siguió `Exited` y no se tocó. Sin datos reales: todo con el fixture ficticio y copias marcadas en el scratchpad.

### Pruebas ejecutadas

- **G1.** Desde `restaurante/` del worktree: `npm run build:css` 0; `npm run typecheck` 0; `npm run lint` 0 ("844 archivos revisados, sin datos privados"); `npm test`: api 55 archivos / 1244 pruebas, landing-pages 64 / 903, inventory-manager 17 / 287, todo en verde.
- **G2.** Duración por archivo (reporter JSON): los nuevos y modificados, `admin-inventory-api` 1.59 s, `admin-inventory-recipes-api` 0.93 s, `inventory-import` 0.03 s, `contract-types` 0.02 s, `inventory-catalog` 0.03 s y `prisma-inventory-import` 1.40 s. Tres ejecuciones aisladas: 57 pruebas en 1.38–1.39 s (api) y 2 en 2.50–2.58 s (landing-pages). Ver OBS-7 sobre 3 archivos ajenos.
- **F1–F6.** `git diff 0187298 --stat`: 24 modificados (con el ticket) y 10 nuevos, los de "Archivos afectados"; nada en `landing-pages/src`, `landing-pages/public`, `inventory-manager/src`, `deploy/`, `ops/`, `.github/`, `.env.example` ni `package-lock.json`; `api-double-inventory.ts` solo con los 2 campos. Migración: `git diff 0187298 -- restaurante/packages/db/prisma` vacío. Suma de `deploy/` = `591de8e7f259073f79ff34418c8b7a3a2680d465ef3bc7378c620221455cc7f0` (igual). Revisión del diff frente al TAP y las reglas, sin hallazgos de tipos, errores ni logs. Desviaciones 1 a 6: el código hace lo descrito (1: clave desconocida = error sin Zod, I4; 2: ciclo por filas "Rec!2 → Rec!6 → Rec!2", I4; 3: índice y árbol, P2/P3; 4: `--produccion` sin `production` rechazado, I7; 5: guardar devuelve el resumen, A2; 6: `arquitectura.md` sin tocar). F5: 0 coincidencias de patrones de secretos (claves, tokens, URL con credenciales, IP del VPS) y 0 de los términos característicos del libro citados en el ticket; las 3 apariciones de nombres de platillos y refrescos están en la semilla de T1 ya existente. El fixture es ficticio y lleva `"ficticio": true`. F6: las 3 pruebas nuevas son funcionales (acceso y reglas de recetas por HTTP, importación en memoria y en MySQL), usan `startAdmin`/`makeDatabase()`, sin esperas fijas ni `retry`; las modificaciones solo siguen el cambio de comportamiento.
- **A (API de recetas)**: `api` del worktree con env del scratchpad sobre `restaurante_test_qa050b_a`, usuarios Administrador, Gerente y Editor creados por la API y datos con marcador. 130 comprobaciones en PASS (A1–A5: 98 + 21; A6: 7; A7: 4), 0 FAIL.
- **I (importación A5)**: `node scripts/inventory-import.ts` y `npm run inventory:import` del worktree sobre bases `restaurante_test_qa050b_{i,e,f,g,d}`, con 27 copias marcadas del fixture.
- **I11/I12 (imagen)**: `docker build --target api` → `restaurante-api:qa050b` (borrada al terminar); `docker run --read-only --tmpfs /tmp -i` y un contenedor de larga vida con `docker exec -i` (equivalente local de `$C exec -T api`).
- **E (semilla)**, **P (barrera)**, **Z (reparto)**, **X (mutaciones)** y **G3–G5 (regresión)**: abajo.

### Criterios de aceptación

| CA / alcance | Resultado | Evidencia |
|---|---|---|
| CA-12 (API) | PASS | A1: en las 7 rutas, sin sesión 401 y Editor 403 `FORBIDDEN_ROLE` (también en escrituras con CSRF válido y antes de 404/422); Administrador y Gerente, sin CSRF o con uno inválido, 403 en `POST recetas` y `POST cerrar`; checksums y conteos de las tablas `inventory_*` iguales tras todos los rechazos; Administrador y Gerente 200 en las 5 lecturas. XA1 y XA2 muertas. |
| CA-13 | PASS | I1: ensayo sobre base vacía y con datos, salida 0, "Se crearían: categorías 5, artículos 13, variantes 3, recetas 3, líneas 9", checksums iguales y, con `general_log`, solo `SELECT` (14), `BEGIN` y `COMMIT` del proceso: 0 `INSERT`, `UPDATE`, `DELETE`, `FOR UPDATE` o `inventory_lock`. I2: "escrita" con esos conteos; 16 filas de artículo (13 + 3 variantes, 1 padre); recetas versión 1 vigentes con `created_by_name` "Importación"; historial: 5 `category/create`, 16 `item/create`, 3 `recipe/new_version` con autor "Importación"; `gr`→`g`, `lt`→`L`, `hr` no inventariable; corrección aplicada (nombre recortado y corregido); carne 6.000 kg netos, merma 40.00, bruta 10.000. I3: repetición en ensayo y con `--escribir` → "Creados … 0", todo omitido, checksums iguales; tras cerrar una receta, la reimportación crea la versión 2 (máximo + 1). I4: 18 archivos con errores (ciclo, unidad, merma 100, rendimiento 0, costo negativo, coma, 4 decimales, nombre, variante y SKU repetidos, ingrediente inexistente, Compuesto como ingrediente, clave desconocida, formato, versión, JSON inválido, vacío, varios a la vez), en ensayo y con `--escribir`: salida 1 y checksums iguales en los 36 casos; cada error con fila y campo. Variantes con nombres únicos (repetida = error). XI1, XI2, XI3 y XI7 muertas. |
| CA-10 (HTTP) | PASS | A5: baja sin `recipes: 'keep'` → 409 `ITEM_IN_ACTIVE_RECIPES` con `recipes: [{ itemId, name }]` sin escribir; `recipes` inválido → 422; con `keep` → inactivo, la receta conserva su versión con `inactiveIngredientIds`, la lista marca `usesInactive`, sale de `ingredientes` y una versión nueva con él → 422 por línea; padre con variante usada → 409 con la receta. Cambiar la unidad base de un usado → 409 (RN-4). XA5 muerta. |
| CA-6 (HTTP) | PASS | A2: base vieja → 409 `RECIPE_VERSION_CONFLICT` con `current` y sin escribir. A3: misma `Idempotency-Key` y cuerpo en serie y en 10 rondas de 5 envíos simultáneos → una sola versión y respuestas idénticas (10/10); otro cuerpo → 422 `IDEMPOTENCY_KEY_REUSED` sin escribir; clave inválida → 400; otro usuario u otro artículo no se confunden. A7: 10/10 rondas de dos `POST` simultáneos desde la misma base → 201 + 409 con `current`. XA3 muerta. |
| CA-4 y CA-11 (HTTP) | PASS | A2: B usa A con A usando B → 422 `RECIPE_CYCLE` con `path` y sin escribir; A usa A → 422 `RECIPE_CYCLE`; cadena de 9 niveles → 422 `RECIPE_TOO_DEEP` ("9 niveles; el máximo es 8"); A7: 10/10 rondas A→B / B→A simultáneos → 201 + 422 `RECIPE_CYCLE`, nunca dos vigentes ni intervalos solapados. Compuesto y padre como ingrediente → 422; Insumo, Reventa y padre → 409 `RECIPE_NOT_ALLOWED` en `GET` y `POST`; receta de un Intermedio inactivo → 409 `RECIPE_ITEM_INACTIVE`; `ingredientes` sin Compuestos ni padres, con la variante y sus empaques. |
| CA-7, CA-8 y CA-9 (HTTP) | PASS | A4, contra cálculo a mano: carne 6.000 kg netos al 40 % → bruta 10.000, costo 1000.0000, 166.6667/kg (RN-T2-1); 500 g de un ingrediente en kg a 10/kg → 5.0000 (CA-3); 0.5 hr de mano de obra no inventariable a 80 → 40.0000 por referencia (CA-9); total 45 con rendimiento 2 → 22.5000/L (CA-1). Plato con un ingrediente sin costo → `total` y `unitCost` `null` (nunca 0), la línea con `cost` `null`, orígenes `receta`, `receta`, `sin_costo`, `referencia` y la cebolla en `missing` con ruta (CA-7). Al poner referencia a la cebolla → 25.7630; al cambiar el rendimiento de la sub-receta → 29.0963; en ambos casos sin versión nueva del plato (CA-8). |
| RF-10 (ficha) | PASS | A4: `referenceCost` "20" → "20.0000"; 422 por campo con negativo, 5 decimales, coma, texto, número JSON, `inventoriable` "no" o `false` en un Intermedio, referencia en Compuesto o padre; referencia en Intermedio aceptada (PT-7); alta en `hr` no inventariable; pasar a inventariable sin movimientos → 200; `PUT` sin los campos nuevos los conserva; historial con `referenceCost` e `inventoriable` (RN-16). |
| RF-12 (semilla) | PASS | E1: "22 artículos y 3 recetas"; mano de obra `hr`, no inventariable, 80.0000; cebolla sin referencia; costos por la API iguales al cálculo a mano: carne 1600.0000 → 266.6667/kg (6.000 netos, 40.00, bruta 10.000), salsa 42.2400, taco "Sin costo" con la cebolla en `missing` (líneas 21.3333, 0.8448, 0.8000). E2: segunda ejecución y base con solo una categoría de T1 → "ya tiene datos", checksums iguales. E3: host remoto y `NODE_ENV=production` rechazados; la imagen no trae el comando (I11). XE1 muerta. |
| DEF-001 (503) | PASS | A6, escenario del PR 1 (otra sesión retiene `inventory_lock` 'recetas' `FOR UPDATE`): `PUT articulos/:id`, `POST …/desactivar`, `POST …/recetas` y `POST …/recetas/cerrar` → 503 `INVENTORY_BUSY` en ~5.05 s, sin escribir, log `inventory_busy` en `warn` solo con método y ruta; nunca 500. Las altas de artículo y categoría no toman el candado y responden 201. XA4 muerta. |
| DEF-002 y barrera (A5) | PASS | P1: `.xlsx` válido generado al momento, `.xlsm`, `.xls` y `.ods` ignorados por `.gitignore`; con `git add -f`, `npm run lint` sale 1 y lista solo las 4 rutas. P2 (escenario del PR 1): JSON sin `ficticio` preparado y luego sobrescrito con `{}` → 1; borrado del árbol → 1. P3: ficticio preparado y árbol cambiado a no ficticio → 1 (control preparado ficticio → 0). P4: ficticio fuera de fixtures → 1; JSON que no es de importación → 0; ruta con espacios y acentos → 1; JSON inválido con la marca → 1. P5: 0 apariciones del marcador en todas las salidas. P6: un archivo solo en el árbol sin seguimiento → 0; árbol actual → 0 con 844 archivos. P7: `npm run lint` corre en el CI (OBS-8). P8: `Datos de entrada.xlsx` ignorado (`.git/info/exclude`), sin seguimiento, tamaño y fecha iguales al inicio y al final; no se abrió. XB1 sobrevive, como estaba previsto (sin prueba permanente por diseño). |
| Salvaguardas y salida (A5, Seguridad) | PASS | I7: matriz de 5 hosts × `NODE_ENV` × `--produccion` × `ficticio`: solo pasan desarrollo sin la bandera contra un host local y producción con `--produccion` sin `ficticio`; los rechazos tardan ~0.15 s (también con el host remoto `10.255.255.1`) y 5 rechazos seguidos abren 0 conexiones nuevas en MySQL (`Connections`). Argumentos: sin `--archivo`, sin valor, desconocido → uso; ruta inexistente o directorio → "No se encontró". Sin `DATABASE_URL` o mal formada → mensaje sin la URL ni la contraseña. I8: entrada estándar por redirección y tubería, vacía (JSON inválido), BOM por archivo y por entrada estándar; 2 MB exactos aceptados y 2 MB + 1 rechazados, por archivo y por entrada estándar; ruta relativa por npm desde `restaurante/` y desde `restaurante/api` (`INIT_CWD`). I9: base sin migrar → `MIGRATIONS_PENDING`, 0 tablas creadas; MySQL inalcanzable → `DATABASE_UNREACHABLE`; sin URL en la salida. I10: 301 líneas de salida de todos los casos con 0 apariciones de los marcadores de nombres, notas y costos. I6: (a) candado retenido → "ocupado", salida 1, sin restos; (b) `TRIGGER` con `SIGNAL` en la última línea de receta → mensaje genérico, sin pila ni texto del trigger, checksums iguales; (c) `SIGKILL` del proceso a 0.7, 0.9, 1.1 y 1.3 s del fixture ampliado → 0 filas; a 1.1 s el `general_log` muestra 504 `INSERT` ejecutados y 0 `COMMIT`. XI4, XI5 y XI6 muertas. |
| Imagen y §5 | PASS | I11: la imagen trae `scripts/inventory-import.ts` y `scripts/support/{inventory-import-cli,inventory-dev-seed,read-hidden}.ts`; no trae `tests/`, el fixture, `inventory-seed-dev.ts`, `dev-server.ts` ni `bot-chat.ts`. Importar `inventory-dev-seed.ts` en la imagen (sin red, solo lectura) no tiene efectos: solo exporta `DEV_SEED_AUTHOR`, `DEV_SEED_HOSTS`, `devSeedRefusal` y `seedInventoryDev`; `npm run inventory:seed-dev` falla por módulo inexistente (pregunta 2 resuelta). Con `NODE_ENV=production`: sin `--produccion` → rechazo; ficticio con `--produccion` → rechazo; copia sin la marca → ensayo 0, `--escribir` 0, repetición "0 creados". I12: pasos 2 a 4 tal como están escritos, con `$C exec -T api` sustituido por `docker exec -i` sobre un contenedor de la imagen: ensayo 0, escritura 0, repetición "Creados … 0"; `docker diff` del contenedor vacío y `/tmp` vacío; `chmod 600` y `shred -u` + `ls` (en un contenedor Linux sobre la copia; macOS no trae `shred`) → el archivo deja de existir. `$C` coincide con `despliegue.md` (línea 560), `restaurante-backup.service` existe en `ops/backup/systemd` y `exec` sobre el servicio `api` coincide con el resto del documento. |
| I13 (tiempo) | PASS | Fixture ficticio ampliado (150 artículos, 40 recetas, 200 líneas, 3 niveles). Comando del worktree, 3 ejecuciones: ensayo 0.33–0.34 s, `--escribir` 1.50–1.51 s (con el arranque de Node). Imagen: ensayo 0.64–0.68 s, `--escribir` 1.27–1.30 s. Muy por debajo de los 60 s de la transacción. |
| CA-16 (regresión de lo que toca) | PASS | G3–G5 (abajo). |
| Reparto 2a / 2b | PASS | Z1–Z4 (abajo). |
| Desviaciones 1–6 | PASS | F4. |

### Defectos encontrados

Sin defectos `BLOCKER`, `CRITICAL` ni `MAJOR`. Se numeran a continuación de los del PR 1.

#### DEF-005

- Severidad: MINOR.
- Criterio de aceptación afectado: CA-13 / A5 (listar cada conflicto con su fila y su campo).
- Descripción: un conflicto de receta se informa siempre con el campo `lineas`, aunque lo distinto sea el rendimiento o la nota.
- Pasos para reproducir: importar el fixture; repetir el ensayo con una copia donde solo cambia el `rendimiento` de una receta (`"2.000"` → `"3.000"`).
- Resultado esperado: el conflicto señala `rendimiento` (o los campos que difieren), como ya hacen los conflictos de artículos ("Ing!6 [costoReferencia]").
- Resultado actual: `Rec!2 [lineas]: El artículo ya tiene una receta vigente distinta: no se sobrescribe (crea una versión nueva en el admin).`
- Evidencia: I5, salida del ensayo de `conflicto.json` (salida 1, nada escrito).
- Impacto: quien revisa el JSON busca la diferencia en las líneas y no en el rendimiento. No afecta a los datos: el conflicto aborta todo igual.
- Recomendación: que el campo del conflicto de receta refleje qué difiere (rendimiento, nota o líneas).

#### DEF-006

- Severidad: TRIVIAL.
- Criterio de aceptación afectado: ninguno del requisito (salvaguarda de uso esperada por el plan de QA, I7).
- Descripción: `--archivo` repetido se acepta y se usa el último.
- Pasos para reproducir: `node scripts/inventory-import.ts --archivo a.json --archivo b.json`.
- Resultado esperado: mensaje de uso, como con un argumento desconocido.
- Resultado actual: importa (o ensaya) `b.json` con salida 0.
- Evidencia: I7.
- Impacto: mínimo; el ensayo es el modo por defecto y muestra los conteos antes de escribir.
- Recomendación: rechazar un `--archivo` repetido con el mensaje de uso.

#### Observaciones (no son defectos)

- **OBS-4.** La validación tiene dos fases: con errores de forma (claves desconocidas, formato, versión) no se llega a validar el contenido. Dentro de cada fase se listan todos (4 errores de forma en un archivo; 5 de contenido en otro). Además, un artículo rechazado deja como "no está en el archivo" las líneas que lo usan, y esa receta no se valida más.
- **OBS-5.** Un ensayo con errores sigue mostrando "Se crearían: …" con los conteos parciales, seguido de "No se escribió nada".
- **OBS-6.** Si existe un artículo **inactivo** con el mismo nombre, la importación crea uno activo nuevo. Es coherente con T1: la API también lo permite (alta con el nombre de un inactivo → 201).
- **OBS-7.** Tres archivos de landing-pages que este PR no toca (`product-repository-contract-prisma-{actualizar,importacion,crear}.test.ts`) tardaron 30.3, 28.9 y 24.4 s en la ejecución local en paralelo. Son anteriores a este PR. Ninguno de los archivos nuevos o modificados pasa de 2 s.
- **OBS-8.** `npm run lint` (con la barrera) corre en el CI en el job `verificacion`, del que depende `calidad`, no dentro de `calidad` como decía P7. No cambia la protección.
- **OBS-9.** Inspección estática: en `inventory-import.ts`, un error inesperado de `loadDatabaseConfig` o de `verifyDatabase` que no sea `ApiConfigError` ni `DatabaseInitError` se relanza (`throw err`) e imprime la pila de Node. No se pudo provocar; todos los caminos probados (I7–I10) dan mensajes sin URL ni contenido.
- **XI8** (escritura en varias transacciones) no se ejecutó: no se puede expresar como una mutación pequeña. La atomicidad queda demostrada con I6 (b) (trigger a mitad de la escritura) e I6 (c) (504 `INSERT` sin `COMMIT` y 0 filas tras `SIGKILL`) y la cubre `prisma-inventory-import.test.ts` ("un rechazo a mitad de la escritura … no deja nada escrito").

### Mutaciones (X)

En una copia APFS del árbol validado, ejecutando solo los archivos afectados. Todas restauradas; `git diff` de la copia vacío al terminar.

| Mutación | Resultado |
|---|---|
| XA1 recetas sin la comprobación de rol | muerta (`admin-inventory-recipes-api`, 1 de 6) |
| XA2 `POST` de recetas sin CSRF | muerta (1 de 6) |
| XA3 `Idempotency-Key` ignorada | muerta (1 de 6) |
| XA4 `InventoryBusyError` sin traducir en T1 | muerta (`admin-inventory-api`, 1 de 13) |
| XA5 baja sin exigir `recipes: 'keep'` | muerta (3 de 958) |
| XI1 el ensayo escribe | muerta (memoria 2 de 10; MySQL 1 de 2) |
| XI2 conflictos ignorados | muerta (1 de 10) |
| XI3 errores que no abortan | muerta (1 de 10) |
| XI4 sin rechazo de `production` sin `--produccion` | muerta (1 de 10) |
| XI5 sin rechazo de `ficticio` con `--produccion` | muerta (1 de 10) |
| XI6 sin rechazo de host remoto | muerta (1 de 10) |
| XI7 `gr` sin normalizar | muerta (6 de 10) |
| XE1 semilla sin la merma de la carne | muerta (`inventory-catalog`, 1 de 20) |
| XB1 barrera que solo lee el árbol | sobrevive (previsto: sin prueba permanente por diseño; P2 lo cubre en QA) |
| XI8 | no ejecutada (OBS de arriba) |

### Reparto en PR 2a y PR 2b (Z)

- **Z1. Reparto de referencia** (validado):
  - **PR 2b** (15 archivos):
    - `packages/core/inventory/master-import.ts` (nuevo);
    - `packages/core/inventory/index.ts` (sus 2 bloques: el comentario "importación única" y `export * from './master-import.ts'`);
    - `packages/core/inventory/inventory-repository.ts` (el bloque final de exportaciones del historial);
    - `packages/db/src/prisma-inventory-store.ts` (`writeTimeoutMs`);
    - `api/scripts/inventory-import.ts` y `api/scripts/support/inventory-import-cli.ts`;
    - `api/tests/fixtures/inventory-import/ficticio.json`;
    - `api/tests/unit/inventory-import.test.ts` y `landing-pages/tests/integration/prisma-inventory-import.test.ts`;
    - `scripts/check-private-data.ts` (DEF-002);
    - `landing-pages/Dockerfile`;
    - `package.json` y `api/package.json` (`inventory:import`);
    - `docs/despliegue.md` §5;
    - del `README.md`, **solo** la fila nueva de la tabla `npm run inventory:import -- --archivo <ruta\|-> [--escribir]`.
  - **PR 2a**: todo lo demás del árbol, incluidos, del `README.md`, la fila modificada de `inventory:seed-dev` (RF-12) y el bloque de la API (campos del artículo y rutas de recetas).
  - Entre 2a y 2b, `check-private-data.ts` queda como en la base: DEF-002 se corrige en 2b.
  - Dependencias comprobadas: 2b usa `DEV_SEED_HOSTS` de la semilla, que está en 2a. 2a no referencia `master-import`, `inventory-import`, `inventory:import`, `writeTimeoutMs`, `IMPORT_MAX_BYTES`, `runMasterImport` ni las exportaciones del historial. Su única mención de `inventory-import` es `FIXTURES_DIR`, de la base del PR 1.
- **Z2. 2a por sí solo** (copia APFS con `git init` propio, sin 2b):
  - `npm run typecheck` 0 y `npm run lint` 0 ("740 archivos revisados, sin datos privados": la copia no incluye `.claude/`);
  - `npm test`: api 54 / 1234, landing-pages 63 / 901 e inventory-manager 17 / 287, en verde. Son el total del árbol menos los 10 y los 2 casos de las pruebas de 2b;
  - los archivos de 2a, de 0.03 a 6.02 s.
- **Z3. 2a + 2b = árbol validado:**
  - el parche de 2b (1 598 líneas, 15 archivos, +1 419/−19) se aplica sobre 2a y el resultado es idéntico al commit completo de la copia;
  - `diff -r` contra `restaurante/` del worktree, sin `node_modules` ni generados, no da diferencias.
- **Huella** (calculada con un índice temporal del scratchpad, sin tocar el índice del worktree):
  - subárbol `restaurante` del árbol validado (2a + 2b): **`d385d63b05d0c3b340fa43139f4ef0183d359a67`**;
  - subárbol `restaurante` de 2a: **`59c7cc064a14daded1235e99001cf0221441a404`**;
  - árbol completo (base `0187298` con `restaurante/` del worktree): `480a9dbb7596f900d030d491cd7d70479d911b54`.
  - Para comprobarla, senior-fullstack ejecuta, antes de abrir los PR, `git rev-parse <commit-2a>:restaurante` y `git rev-parse <commit-2b>:restaurante`, y deben coincidir con esos valores. O bien `git diff --quiet d385d63b05d0c3b340fa43139f4ef0183d359a67 <commit-2b>:restaurante`. Si el reparto cambia de bloque, solo se repite Z2.
- **Z4.** Los parches y la copia se borraron. El reparto queda descrito aquí.

### Regresión

- **G1/G2:** todo en verde (arriba).
- **G3** (`inventory-manager` del worktree contra la `api` del worktree):
  - acceso 303; lista, ficha, edición, alta y categorías del inventario → 200;
  - al editar desde el formulario actual, que no envía `referenceCost` ni `inventoriable`, un artículo en `kg` con referencia y uno en `hr` no inventariable → 303 y versión + 1, con `referenceCost` (10.0000 y 80.0000) e `inventoriable` (true y false) **conservados**;
  - alta desde el formulario en `hr` y en `kg` → 303 y creadas.
- **G4:**
  - `landing-pages` del worktree contra esa `api`: `/` y `/birria` → 200 "Birria El Muñeco", `/molotes` → 200 "Moloteando", cada una con un `h1` y enlaces de WhatsApp;
  - rutas públicas de productos y página de los dos negocios → 200;
  - API del admin: productos, página, usuarios y bot → 200;
  - el bot, con su suite (G1).
- **G5:** la `api` arrancó sobre la base migrada con `allowNewerSchema: false`, sin advertencias nuevas (solo `products_notify_disabled`, de antes, por no configurar `LANDING_INTERNAL_URL`).
- **Logs:** 0 respuestas 500 y 0 líneas `error` en los logs de las 5 apps.
- **A8 (fugas):** las 101 respuestas de error de A1–A5 no contienen `prisma`, SQL, nombres de tablas, pila, `P\d{4}`, `mysql` ni `node_modules`. En los logs de la `api` (796 líneas) y de las demás apps, 0 apariciones de los marcadores de nombres y notas y 0 de los costos de prueba. Solo aparecen los eventos del TAP con ids, números y acciones.

### Responsive, accesibilidad, UX/UI, performance y SEO

No aplican: el PR 2 no tiene pantallas ni cambios en las landings. Performance: I13 y G2.

### Pendientes de revisión manual

- Ninguno de QA.
- Siguen siendo del usuario, sin cambios: la consulta de empaques "hr" en desarrollo, `verify-backup.sh --drill` tras desplegar la épica y el borrado del scratchpad de la sesión interrumpida del PR 1.
- DEF-003 sigue sin PR asignado. DEF-004 y OBS-2 siguen en el PR 3.

### Limpieza

- Se quitaron el proyecto `restaurante-qa-050b` (contenedor, volumen `restaurante-qa-050b_mysql-dev-data` y redes `_default` y `_db-test`) y, con él, las 8 bases `restaurante_test_qa050b_*` y el `TRIGGER` de I6. También se borraron la imagen `restaurante-api:qa050b` y los contenedores `qa050b-api` y `qa050b-imp`. Queda la caché de capas de `docker build`.
- `docker ps -a`, `docker volume ls` y `docker network ls` son iguales a la línea base. `restaurante-mysql-dev-1` sigue `Exited`.
- Procesos detenidos: 3 `api`, `inventory-manager` y `landing-pages`, y la sesión SQL que retenía el candado (`KILL`). No hay procesos de servidor, Vitest, importación ni semilla. Nada escucha en 3101–3104, 3111, 3114, 3121, 3124 ni 3307.
- Se borró del scratchpad lo que QA creó: la copia APFS de Z y X (525 MB), los parches, los fixtures marcados y ampliados, los env, los logs, las sondas y los libros de P.
- Los archivos de P se sacaron del índice y se borraron. El `git status` del worktree es igual al inicial más este ticket.
- El índice temporal de la huella se borró. Quedan, como objetos sueltos inalcanzables en el almacén de git del repositorio, los blobs y árboles que escribió `git write-tree`: inofensivos, los quita `git gc`.
- El repositorio principal sigue en `main` sin cambios. `git worktree list` no tiene worktrees nuevos. `Datos de entrada.xlsx` está intacto.

### Resultado final

QA_APPROVED

## Pendientes del PR 2 para el PR 3 y seguimientos

Hallazgos del QA del PR 2 que no bloquean el merge, con su PR asignado:

- **PR 3 (pantallas y documentación), propuesta:** los dos son cambios pequeños en el comando de importación, que el PR 3 no toca por lo demás; si el PR 3 crece demasiado, pasan a un seguimiento menor propio hacia `epic/inventario` (`fix:` de la importación) antes de llevar la épica a `main`.
  - **DEF-005 (MINOR):** que el conflicto de una receta en la importación señale el campo que difiere (`rendimiento`, `nota` o `lineas`), como ya hacen los conflictos de artículos.
  - **DEF-006 (TRIVIAL):** rechazar un `--archivo` repetido con el mensaje de uso.
- **Observaciones (sin cambio previsto; se revisan al planificar el PR 3):**
  - **OBS-4:** validación en dos fases (forma, luego contenido); un artículo rechazado deja sus líneas como "no está en el archivo". Documentarlo en `despliegue.md` §5 si confunde.
  - **OBS-5:** un ensayo con errores sigue mostrando "Se crearían: …" con conteos parciales. Candidato a acompañar a DEF-005 en el mismo cambio.
  - **OBS-6:** con un artículo inactivo del mismo nombre, la importación crea uno activo nuevo (coherente con T1). Sin cambio.
  - **OBS-7 (vigilar en el CI):** tres archivos de `landing-pages` que este PR no toca (`product-repository-contract-prisma-{actualizar,importacion,crear}.test.ts`) tardaron 30.3, 28.9 y 24.4 s en la ejecución local en paralelo, por encima de los 20 s por archivo de `.claude/rules/testing.md`. Son anteriores a este PR. Se vigila su duración en el CI de los PR 2a y 2b; si en el CI también pasan de 20 s, se avisa al usuario y se propone partirlos por sus `describe` en un cambio aparte. No se cambia nada sin avisar.
  - **OBS-8:** la barrera de datos privados corre en el job `verificacion` (del que depende `calidad`). Sin cambio.
  - **OBS-9:** un error inesperado de `loadDatabaseConfig` o `verifyDatabase` en `inventory-import.ts` se relanza con la pila de Node. Candidato a acompañar a DEF-005 (mensaje genérico y salida 1).
- **Siguen igual:** DEF-003 sin PR asignado; DEF-004 y OBS-2 en el PR 3.

## Commit y Pull Requests — PR 2a y PR 2b

El PR 2 se parte en dos PR hacia `epic/inventario`, con el reparto validado por QA (sección "Reparto en PR 2a y PR 2b (Z)"):

- **PR 2a** (contratos y rutas de recetas, campos nuevos del artículo, DEF-001 y semilla de desarrollo): rama `feature/REQ-F-050-recetas-api-importacion`.
- **PR 2b** (importación única A5, DEF-002, `Dockerfile` y `despliegue.md` §5): rama `feature/REQ-F-050-recetas-importacion`, salida del commit de 2a con un solo commit encima. Se publica la rama, pero el PR 2b (en borrador) se abre solo después de que el usuario haga merge del PR 2a, para que su diff contra `epic/inventario` sea solo 2b.

Resultado:

- `epic/inventario` sin cambios desde `0187298`: no hizo falta integrarla. Índice revisado sin hojas de cálculo, `~$`, `datos-privados` ni JSON de importación real; archivos añadidos por nombre.
- **PR 2a:** commit `ade09f1` (`feat`), huella `ade09f1:restaurante` = `59c7cc064a14daded1235e99001cf0221441a404` (igual a la de QA). Pull Request #188 hacia `epic/inventario`: https://github.com/orvigas/negocio/pull/188 (abierto en borrador; se marca listo tras este registro).
- **PR 2b:** commit `05a4c4e` (`feat`) sobre `ade09f1`, rama `feature/REQ-F-050-recetas-importacion` publicada; huella `05a4c4e:restaurante` = `d385d63b05d0c3b340fa43139f4ef0183d359a67` (igual a la de QA); su diff contra `ade09f1` son exactamente los 15 archivos del reparto. PR pendiente de abrir tras el merge del PR 2a.

- **Integración tras el merge del PR 2a (2026-11-20):** el PR 2a se mergeó como #188 (merge `1c18060`), con su CI en `pass` (`calidad`, `docker`, `auditoria`, `pruebas (1/2)`, `pruebas (2/2)` y `verificacion`). En `feature/REQ-F-050-recetas-importacion` se integró `origin/epic/inventario` con el merge commit `139c9df` (solo trae el ticket; `a772289` no toca `restaurante`). Huella `139c9df:restaurante` = `d385d63b05d0c3b340fa43139f4ef0183d359a67` (igual a la de QA). `git diff --name-only origin/epic/inventario...HEAD` = los 15 archivos del reparto 2b, sin hojas de cálculo, `~$`, `datos-privados` ni JSON de importación real.
- **PR 2b:** Pull Request #189 hacia `epic/inventario`: https://github.com/orvigas/negocio/pull/189 (abierto en borrador; se marca listo tras este registro, sin más commits después).

## Implementation Result — PR 3

### Rama

`feature/REQ-F-050-recetas-pantallas`, desde la punta de `origin/epic/inventario` (`9371772`, con los PR 1, 2a y 2b mergeados), en el worktree `.claude/worktrees/req-f-050-pr3`. Sin commit (pendiente de aprobación y QA). PR futuro hacia `epic/inventario`.

Decisiones de diseño aplicadas (aprobadas por el usuario, "Si" a la propuesta móvil): H-1 (contorno de foco `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maiz` en `field-input`, `field-select` y `field-textarea`), H-2 opción B (parcial de línea `recipe-line`: un `fieldset` por línea con `legend` "Línea N"; tarjeta en móvil y fila compacta `lg:grid-cols-[…]` en escritorio; sin JavaScript), H-3 (`name=action value=rows` en "Añadir 10 filas"), H-4 (página larga en móvil) y H-5 (el botón de conflicto es el de T1, "Guardar mis cambios sobre la versión vigente"). Referencias de Stitch no consultadas de nuevo (no son fuente de verdad; `_stich_source_/` no tiene diseño del admin y no se modificó).

### Cambios realizados

- **Cliente HTTP** (`packages/contracts/admin-client.ts`): `listInventoryRecipes`, `getInventoryRecipe`, `getInventoryRecipeVersion`, `inventoryRecipeIngredients`, `inventoryRecipeUsedIn`, `saveInventoryRecipe` (201 o 200, con `Idempotency-Key`) y `closeInventoryRecipe`, contra las rutas ya mergeadas. El cuerpo de error admite `path` (422 `RECIPE_CYCLE`), `recipes` (409 `ITEM_IN_ACTIVE_RECIPES`) y la vigente de un 409 `RECIPE_VERSION_CONFLICT`, que se entrega como `recipeCurrent` (el `current` de artículos y productos no cambia de forma). `request` acepta varios códigos esperados.
- **Pantallas de recetas** (`inventory-manager`; controlador `controllers/inventory-recipes.ts`, vistas `views/inventory-recipes.ts`, 5 páginas y 18 parciales `recipe-*`/`inventory-*` nuevos):
  - Lista `/inventario/recetas`: filtro GET por tipo y búsqueda, tabla con `caption` (artículo, tipo, rendimiento, costo por unidad o "Sin costo (faltan N)", vigente desde y aviso "Usa artículos inactivos" con icono y texto), estado vacío y páginas.
  - Receta del artículo `/inventario/articulos/:id/receta`: versión vigente (vigencia, autor, rendimiento, costo total y por unidad, nota), aviso "Sin costo" con cada faltante, su ruta y un enlace a su ficha, aviso de ingredientes inactivos, tabla de líneas (neta, merma, bruta, costo y origen), "Nueva versión"/"Crear receta", "Cerrar receta" e historial de versiones con enlace a cada una. 409 `RECIPE_NOT_ALLOWED` -> aviso con la vuelta a la ficha.
  - Editor `…/receta/nueva` (POST a `…/receta`): rendimiento con la unidad base (solo lectura) y nota; 10 filas por bloque hasta 40; "Añadir 10 filas" vuelve a pintar lo escrito sin guardar; ingrediente con `<input list>` y un único `<datalist>` (el admin resuelve el nombre con la lista de la API); unidad con un `<datalist>` de las unidades del sistema y los empaques; ayuda fija de neta y merma (asociada a cada cantidad con `aria-describedby`); `error-summary` con un enlace por línea y campo ("Línea 3, ingrediente: …"); ciclo con su ruta; conflicto 409 con lo escrito y la nueva versión de partida; 409 de artículo inactivo; 503 con lo escrito.
  - Historial `/inventario/recetas/versiones/:id` en solo lectura, sin costo (PT-4), y confirmación de cierre `…/receta/cerrar`.
  - Subnavegación "Recetas" en la sección Inventario.
- **T1** (`controllers/inventory.ts`, `views/inventory.ts`): el formulario admite el costo de referencia (alta simple; en edición, solo Insumo, Intermedio y Reventa) y la casilla inventariable (alta simple y Insumo), con su ayuda y la unidad `hr`; la ficha muestra el costo de referencia, el inventariable (Insumo), "Usado en" con enlaces y el enlace "Receta" (Intermedio y Compuesto); el historial nombra los dos campos nuevos; la página de inactivar lista las recetas vigentes que lo usan y envía `recipes=keep`, y un 409 `ITEM_IN_ACTIVE_RECIPES` vuelve a pedir la confirmación con la lista.
- **Refactor sin cambio de comportamiento:** `controllers/inventory-common.ts` reúne la sesión con rol, las respuestas de la API que no son de dominio y los textos comunes, compartidos por artículos y recetas (antes duplicados dentro de `inventory.ts`).
- **H-1:** contorno de foco visible en `field-input`, `field-select` y `field-textarea` (antes el plugin de formularios lo anulaba).
- **DEF-004:** el doble de la API de `inventory-manager` acepta las unidades del contrato (`INVENTORY_UNITS`, con `hr`) y su mensaje las lista; además admite el costo de referencia y el inventariable con las reglas de PT-7, la baja con `recipes: 'keep'` y las rutas de recetas (`tests/support/api-double-recipes.ts`, nuevo).
- **DEF-005:** el conflicto de una receta en la importación señala los campos que difieren (`rendimiento`, `nota` y/o `lineas`), como los de artículos.
- **DEF-006:** `--archivo` repetido se rechaza con el mensaje de uso.
- **DEF-003:** caso de empate exacto (mitad hacia arriba) en la bruta y en el costo por unidad, en `api/tests/unit/inventory-recipes.test.ts`.
- **OBS-2:** el README explica cómo volver de T2 a T1 en local con un artículo en `hr` usado en una receta (SQL o recrear la base local).
- **Documentación:** `docs/arquitectura.md` §4 (módulos de recetas e importación en `core/inventory`, candado y costo teórico) y §6 (rutas de recetas, cliente y pantallas), y §8 (T2 en tres PR); `README.md` (pantallas de recetas, campos nuevos de la ficha, tablas de T2 y nota de C-2).

### Criterios de aceptación (alcance del PR 3)

- **CA-15:** pantallas utilizables a 360 px y 1280 px, con teclado, foco visible y sin JavaScript (evidencia en "Validaciones ejecutadas"; QA lo repite en navegador real).
- **CA-12 (admin):** un Editor recibe 403 en las 5 pantallas y en los 2 POST de recetas sin que el admin pida nada del inventario a la API (`inventory-recipes.test.ts`).
- **CA-4, CA-5, CA-6, CA-7 y CA-10 en pantalla:** ciclo con su ruta y lo escrito conservado; nueva versión, sin cambios y cierre con confirmación; conflicto 409 que conserva lo escrito y guarda encima solo si se pide; "Sin costo" con faltantes en la receta y en la lista; inactivar con la lista de recetas y confirmación, y aviso de inactivos después.
- **RF-1 a RF-3, RF-8, RF-10 y RF-13:** cubiertos por las pantallas descritas; el resto ya estaba en la API (PR 1 y PR 2).
- **CA-16:** la suite completa de las tres apps sigue en verde; las pantallas de T1 cambian solo en los campos nuevos (prueba modificada en `inventory.test.ts`).

### Validaciones ejecutadas

Desde `restaurante/` en el worktree, contra un MySQL 8.4 aislado (`docker compose -p restaurante-fs-050pr3`, volumen propio; `restaurante-mysql-dev-1` no se tocó y sigue `Exited`):

- `npm run build:css`: 0.
- `npm run typecheck`: 0.
- `npm run lint` (con `check-private-data`): 0; "854 archivos revisados, sin datos privados".
- `npm test`: api 55 archivos y 1245 pruebas; landing-pages 64 y 903; inventory-manager 18 y 297. Todo en verde.
- Pruebas permanentes: nueva `inventory-manager/tests/integration/inventory-recipes.test.ts` (9 casos funcionales: editor sin JS con bloques de 10 hasta 40 y guardado; 422 por línea; ciclo; "Sin costo"; conflicto; API caída; cierre e historial; 403 del Editor; "Usado en" e inactivación con lista). Modificadas: `inventory.test.ts` (subnavegación con "Recetas" y un caso del alta con costo de referencia, inventariable desmarcado y `hr`), `api/tests/unit/inventory-import.test.ts` (DEF-005 y DEF-006) y `api/tests/unit/inventory-recipes.test.ts` (DEF-003). Los archivos de `inventory-manager` tardan menos de 2 s.
- Evidencia de accesibilidad y responsive (descartable, fuera del repositorio; no se commitea): 14 pantallas renderizadas contra el doble de la API (lista, lista vacía, receta con "Sin costo", receta con merma, editor, editor con 422, con ciclo, con 409 y con 20 filas, versión del historial, cierre, ficha de un insumo, inactivar un artículo usado y alta de T1), con estado HTTP esperado (200, 422 y 409). Comprobación estática con jsdom en las 14: un solo `h1`, sin ids repetidos, todo control con su `label`, sin saltos de encabezado, tablas con `caption` y `th` con `scope`, cada `fieldset` con `legend`, todos los `aria-describedby` resuelven y un único `datalist` de ingredientes en el editor. Capturas con Chrome sin interfaz a 1280 px: el editor muestra las líneas como filas compactas (H-2) y el aviso de conflicto con lo escrito. A 360 px el Chrome sin interfaz pinta con un ancho mínimo mayor que la ventana y recorta por la derecha, también en las pantallas de T1 sin cambios: no sirve como evidencia de 360 px; las tarjetas por línea se ven en una sola columna. La prueba a 360 px, con teclado y axe queda para QA en un navegador real.
- Ajuste tras la evidencia: la etiqueta de la merma pasó a "Merma %" (con `placeholder` 0), porque "Merma (%) (opcional)" partía en dos renglones y desalineaba la fila en escritorio.

### Archivos afectados

- Nuevos: `inventory-manager/src/controllers/{inventory-common,inventory-recipes}.ts`; `inventory-manager/src/views/inventory-recipes.ts`; `inventory-manager/src/views/pages/inventory-recipe{s,,-form,-version,-close}.html`; parciales `recipe-{table,th,row,cell,cell-html,cell-head,link,flag,ingredient,summary,history-entry,current-mark,line,line-saved,datalist,datalist-option,rows-button}.html`, `inventory-link-item.html` e `inventory-paragraph.html`; `inventory-manager/tests/integration/inventory-recipes.test.ts`; `inventory-manager/tests/support/api-double-recipes.ts`.
- Modificados: `packages/contracts/admin-client.ts`; `packages/core/inventory/master-import.ts`; `api/scripts/support/inventory-import-cli.ts`; `api/tests/unit/{inventory-import,inventory-recipes}.test.ts`; `inventory-manager/src/{app,routes}.ts`; `inventory-manager/src/controllers/inventory.ts`; `inventory-manager/src/views/{index,inventory}.ts`; `inventory-manager/src/views/pages/inventory-item.html`; `inventory-manager/src/views/partials/field-{input,select,textarea}.html`; `inventory-manager/tests/integration/inventory.test.ts`; `inventory-manager/tests/support/api-double-inventory.ts`; `docs/arquitectura.md`; `README.md`.
- `deploy/`, migraciones, `.env.example` y `_stich_source_/` sin cambios.

### Riesgos o pendientes

- **Desviación (bruta y costo tras errores):** el TAP pedía mostrar, tras guardar o previsualizar con errores, la bruta y el costo por línea. La API no tiene una ruta de vista previa y `inventory-manager` no puede importar `core` (regla de dependencias), así que repetir aquí la conversión y el redondeo duplicaría reglas del dominio. Se resolvió así: la receta muestra la neta, la bruta y el costo de cada línea tras guardar; en el editor, cada línea igual a una de la vigente muestra "Como en la versión vigente: bruta …; costo …"; la ayuda fija dice que la bruta y el costo se calculan al guardar. Si el usuario quiere la bruta y el costo de las líneas nuevas antes de guardar, haría falta una ruta de vista previa en la API (cambio de alcance).
- **Unidad con `datalist` común:** sin JavaScript no se puede filtrar por ingrediente, así que la lista de unidades reúne las del sistema y los empaques de todos los ingredientes; una unidad sin factor para ese ingrediente la rechaza la API en su línea (CA-3).
- **Lista con tabla en móvil:** las tablas de la lista y de las líneas se desplazan en horizontal dentro de una región con foco (`tabindex="0"`, `role="region"` y `aria-labelledby` del `caption`) a 360 px, en lugar de pasar a tarjetas; el editor sí usa tarjetas (H-2). QA lo valora.
- **Para QA:** navegador real a 360 px y 1280 px, solo teclado, sin JavaScript y axe; regresión de T1 con el contorno de foco de H-1; las pantallas contra la `api` real con la semilla de desarrollo (aquí se probaron contra el doble).
- **README (C-2/OBS-2):** el `UPDATE` de ejemplo se revisó pero no se ejecutó contra una base con artículos en `hr`; los demás comandos (`db:down`, `db:up`, `db:migrate`) ya estaban documentados.
- **Limpieza:** proyecto Docker `restaurante-fs-050pr3` retirado con su volumen y su red; sin bases `restaurante_test*`, procesos de Vitest ni Chrome sin interfaz; la prueba temporal de evidencia se borró del worktree. Docker Desktop no estaba encendido al empezar y se encendió para las pruebas.
- Sin dependencias nuevas.

## QA Action Plan — PR 3 (T2)

### Objetivo

Validar con evidencia que el árbol de trabajo de `feature/REQ-F-050-recetas-pantallas` (sin commit, base `origin/epic/inventario` `9371772`) cumple el alcance del PR 3: pantallas de recetas del admin, campos nuevos de la ficha de T1, cliente HTTP de recetas, DEF-003 a DEF-006, OBS-2 y documentación; que funciona contra la `api` real y MySQL con la semilla de desarrollo (no solo contra el doble), a 360 px y en escritorio, con teclado, foco visible, sin JavaScript y sin errores de axe relevantes; y que T1, las landings, el bot y el resto del admin no cambian.

### Requisito bajo prueba

Ticket aprobado (versión 1), Technical Action Plan aprobado (PT-1 a PT-7), H-1 a H-5 ("Si" a la propuesta móvil), "Implementation Result — PR 3" y la aprobación de la implementación con tres decisiones (cita: "Sí, apruebo con las tres decisiones"):

1. El editor no calcula bruta ni costo de líneas nuevas antes de guardar (sin vista previa). **No es defecto**; QA solo comprueba que la ayuda lo dice y que la receta guardada sí los muestra (RF-3 queda satisfecho así por decisión del usuario).
2. A 360 px la lista y las líneas de la receta se desplazan en horizontal dentro de una región con foco; el editor usa tarjetas. **No es defecto** el desplazamiento horizontal dentro de esa región; sí lo es el desbordamiento de la página fuera de ella.
3. El `datalist` de unidades mezcla las del sistema y todos los empaques; la API rechaza en su línea una unidad sin factor. **No es defecto** ver unidades ajenas; sí lo es que el rechazo no llegue a su línea y campo.

Fuera de alcance (sin tratarlo como defecto): vista previa de costos, importación del JSON real (PT-5), CA-13/CA-14 (validados en PR 2 y PR 1; la migración no cambia aquí, se comprueba en F2), kardex/CPP (T3), `_stich_source_/` (no tiene diseño del admin).

### Criterios de aceptación (cada uno → pruebas que lo cubren)

| CA / alcance | Pruebas |
|---|---|
| CA-15 / RF-13 (360 px, escritorio, teclado, foco, sin JS) | B1–B9, K1–K4, N1–N3 |
| CA-12 (admin) | S1–S4 |
| CA-4 en pantalla (ciclo con ruta, lo escrito conservado; > 8 niveles) | R6, R7 |
| CA-5 en pantalla (nueva versión, sin cambios, cerrar) | R3, R4, R5, R10 |
| CA-6 en pantalla (409 conserva lo escrito; guarda encima solo si se pide; doble envío) | R8, R9 |
| CA-2, CA-3 en pantalla (merma 100 rechazada; unidad sin factor en su línea; 500 g a 10/kg = 5.00) | R11, R12, R2 |
| CA-7, CA-8, CA-9 en pantalla ("Sin costo" con faltantes y ruta; origen; `hr`) | R1, R2, R13 |
| CA-10 / RF-7 / RF-8 en pantalla (Usado en, inactivar con lista y `recipes=keep`, aviso, no ofrecido) | T4, T5, R14 |
| CA-11 en pantalla (Compuesto/padre no ofrecido; Insumo/Reventa sin receta) | R15 |
| RF-1, RF-2 (lista, filtro, vacío, páginas, historial solo lectura sin costo) | L1–L4, R1, R5 |
| RF-10 (costo de referencia, inventariable, `hr`, historial) | T1–T3 |
| CA-16 (T1, landings, bot, menú público sin cambios) | G1–G5, T6 |
| DEF-003 a DEF-006, OBS-2 | D1–D4, O1 |

### Riesgos identificados

- Probado solo contra el doble: contrato real (formato de decimales, `recipeCurrent` en 409, `fields` con índices de línea, `path` de ciclo) puede no casar con lo que pinta el admin.
- Mapeo de errores por posición: con filas vacías intercaladas, el índice de la API (líneas compactadas) puede apuntar a la fila equivocada del formulario.
- "Añadir 10 filas" (`action=rows`) sin JS: pérdida de lo escrito, superar 40, o que guarde por accidente; idempotencia (`requestId`) al reenviar el mismo formulario o tras volver atrás.
- 409/503 que no conservan lo escrito o que, con la API caída, regeneran `requestId` y duplican al reintentar.
- Escapado de nombres, notas y la ruta del ciclo (XSS almacenado vía nombre de artículo).
- H-1 (contorno de foco en `field-*`) cambia todos los formularios del admin: regresión visual en productos, página, usuarios, cotizador.
- Refactor `inventory-common.ts`: cambio de comportamiento en 401/403/404/503 de T1.
- Rol: un Editor o una sesión sin rol que llegue a pedir algo a la API; CSRF ausente o ajeno aceptado en los 2 POST.
- Suite corrida antes del cambio "Merma %": hay que repetirla entera.

### Entorno

- Worktree `/Users/orvigas/Desktop/Negocio/.claude/worktrees/req-f-050-pr3`, rama `feature/REQ-F-050-recetas-pantallas`, sin tocar código de producción.
- MySQL 8.4 propio: `docker compose -p restaurante-qa-050c up -d --wait mysql-dev` con el `compose.yaml` del worktree (volumen y red propios, `127.0.0.1:3307`). Antes, línea base de `docker ps -a`, `docker volume ls`, `docker network ls` y puertos; si `restaurante-mysql-dev-1` está encendido o 3307 ocupado, QA se detiene y lo informa. `restaurante-mysql-dev-1` no se enciende.
- Base de pantallas: `restaurante_qa050c` (no `restaurante_test*`, porque la semilla y la `api` la usan como base de desarrollo local de ese contenedor), migrada con `npm run db:migrate` y sembrada con `npm run inventory:seed-dev`. Base desechable para OBS-2: `restaurante_qa050c_obs2`.
- `api` e `inventory-manager` del worktree con env propios en el scratchpad (nunca un `.env` de desarrollo), en puertos libres (p. ej. API 3210, admin 3211). Usuarios creados en esa base: un administrador, un gerente y un editor (por el arranque/alta del propio admin o el script existente de usuarios; sin contraseñas en el ticket).
- `npm test` con `TEST_DATABASE_URL`/`TEST_ADMIN_DATABASE_URL` hacia ese contenedor (bases `restaurante_test*`).
- Navegador real: Claude in Chrome (pestaña nueva; ventana a 360×800, 768×1024 y 1280×900). axe-core inyectado por `javascript_tool` desde un archivo local del scratchpad si está disponible en `node_modules`; si no está instalado, no se añade dependencia: QA lo informa y sustituye axe por la comprobación con jsdom (A11Y) más la revisión manual, y pide decisión si CA-15 dependiera solo de axe.
- Sin JS: Chrome con JavaScript deshabilitado para el origen del admin (ajustes del sitio) o, si la extensión no lo permite, `curl` + envíos de formulario sin JS (el admin no carga JS en estas pantallas; se comprueba).

### Revisión estática (F)

- **F1.** `git status`/`git diff origin/epic/inventario --stat`: solo los archivos listados; sin migraciones, `deploy/`, `.env.example` ni `_stich_source_/`; sin hojas de cálculo, `~$`, JSON de importación real ni `datos-privados`.
- **F2.** Diff vacío de `packages/db/prisma/migrations`.
- **F3.** `npm run typecheck`, `npm run lint` (incluye `check-private-data`) y `npm run build:css`: 0, sin avisos.
- **F4.** Lectura de `docs/arquitectura.md` §4, §6, §8 y del README (pantallas, campos nuevos, C-2): coherentes con lo observado, sin funcionalidades inexistentes.

### Suite (A)

- **A1.** `npm test` completo desde `restaurante/` (las 3 apps), tras el cambio "Merma %": 0 fallos; totales por app y duración por archivo; ninguno de los archivos nuevos/modificados > 20 s. OBS-7 se informa si reaparece, sin bloquear.
- **A2.** Revisión de las pruebas permanentes nuevas o modificadas contra `testing.md`: funcionales, sin duplicar otra existente, sin reproducir la implementación, sin sufijos `qa-req-f-*`.

### Lista de recetas (L), contra `api` real y semilla

- **L1.** `/inventario/recetas` con administrador y gerente: columnas de RF-1; "Taco ficticio" con "Sin costo (faltan 1)"; costos con 2 decimales iguales a los de `GET` de la API.
- **L2.** Filtro por tipo (intermedio/compuesto) y búsqueda por nombre (con acentos y mayúsculas); búsqueda sin resultados → mensaje de vacío; `tipo` inválido → 422 con su campo, sin 500.
- **L3.** Paginación: `pagina` fuera de rango, `0`, `abc` → respuesta controlada.
- **L4.** "Usa artículos inactivos" con icono **y** texto tras inactivar un ingrediente (enlaza con T5).

### Receta y editor (R), contra `api` real y semilla

- **R1.** Receta del Compuesto de 2 niveles: aviso "Sin costo" con el faltante, su ruta y enlace a su ficha; origen de cada línea (Referencia/Receta/Sin costo).
- **R2.** "Carne cocida ficticia": neta 6.000, merma 40.00, bruta 10.000; costos contra cálculo a mano; CA-3: crear una receta con 500 g de un insumo a 10/kg → línea 5.00.
- **R3.** Nueva versión con cambios → v2 vigente, v1 en historial con intervalo contiguo; aviso de éxito.
- **R4.** Guardar sin cambios → no crea versión (historial igual, mensaje de "sin cambios").
- **R5.** Historial `/inventario/recetas/versiones/:id`: solo lectura, sin costo (PT-4); id inexistente, `abc` y de otra cosa → 404 controlado.
- **R6.** Ciclo directo (A en A) e indirecto (B usa A; añadir B a A): 422 con la ruta en el `error-summary` y en su línea, lo escrito conservado, nada escrito en la base (conteo de versiones antes/después).
- **R7.** Profundidad > 8 (cadena de Intermedios creada por pantalla o por la API): rechazo con mensaje claro.
- **R8.** Conflicto: dos pestañas sobre la v1; la segunda guarda → 409 con lo escrito y la vigente nueva; "Guardar mis cambios sobre la versión vigente" crea la versión solo al pulsarlo.
- **R9.** Idempotencia: reenviar exactamente el mismo POST (mismo `requestId`) dos veces (curl con la cookie y el CSRF de la sesión, y "Atrás" + reenviar en el navegador) → una sola versión; 503 simulado (API detenida) y reintento con la API arriba → una sola versión y lo escrito conservado en el 503.
- **R10.** Cerrar receta: página de confirmación, POST con CSRF → sin vigente; la lista ya no la muestra; "Crear receta" disponible; conflicto de cierre (cerrar desde una versión ya no vigente) controlado.
- **R11.** Validación por línea: merma 100, -1, 99.999, coma decimal, cantidad 0, cantidad que redondea a 0, rendimiento 0/vacío, ingrediente inexistente o escrito a medias, ingrediente repetido, ninguna línea, nota > límite. Cada error en el `error-summary` con enlace a su campo ("Línea N, campo: …"), el campo con `aria-invalid` y texto (no solo color).
- **R12.** Filas vacías intercaladas (líneas 1, 5 y 23 llenas) con un error en la 23: el error aparece en la fila 23, no en la 3; unidad sin factor (decisión 3) en su línea.
- **R13.** Línea con "Mano de obra ficticia" en `hr` costeada por referencia; la ficha no muestra existencias.
- **R14.** Un ingrediente inactivo no aparece en el `datalist` del editor; escribirlo a mano → rechazo en su línea; la vigente que lo usa muestra el aviso de inactivos en receta y editor.
- **R15.** Insumo y Reventa: sin enlace "Receta"; `/inventario/articulos/<insumo>/receta` y `/nueva` → aviso `RECIPE_NOT_ALLOWED` con vuelta a la ficha; Compuestos y padres no aparecen en el `datalist`.
- **R16.** Bloques de filas: 10 iniciales, "Añadir 10 filas" ×3 → 40 sin perder lo escrito ni guardar nada (conteo de versiones igual); en 40 el botón desaparece o se ignora; POST manipulado con `rows=1000` o `lines.40.*` → no pasa de 40 ni da 500.
- **R17.** Datos manipulados: `baseVersionId` ajeno o de otro artículo, `requestId` inválido, campos desconocidos, cuerpo > límite, ids no numéricos en la ruta → respuestas controladas sin 500 ni pila.

### Ficha y formulario de T1 (T)

- **T1.** Alta simple con costo de referencia (4 decimales, ≥ 0; rechazos de -1, 5 decimales, coma) y casilla inventariable; alta con `hr`.
- **T2.** Edición: costo de referencia solo en Insumo, Intermedio y Reventa; inventariable solo en Insumo y solo sin movimientos (según PT-7); Compuesto/padre sin esos campos y un POST manipulado rechazado.
- **T3.** Historial de la ficha nombra los dos campos nuevos.
- **T4.** "Usado en" en la ficha de un insumo usado, con enlaces correctos; uno no usado sin la sección o con su vacío.
- **T5.** Inactivar un Intermedio usado: la página lista las recetas vigentes y envía `recipes=keep`; un 409 `ITEM_IN_ACTIVE_RECIPES` (receta creada entre la carga y el envío, con otra pestaña) vuelve a pedir la confirmación con la lista; tras confirmar, la receta del Intermedio no se cierra (RF-7).
- **T6.** Regresión de T1 sin cambios funcionales: lista, búsqueda, alta, edición con conflicto 409 (H-5), inactivar un artículo **no** usado, reactivar, 401/403/404/503 tras el refactor de `inventory-common.ts`.

### Permisos, CSRF y seguridad (S)

- **S1.** Editor: 403 en las 5 pantallas GET y en los 2 POST de recetas, y "Recetas" ausente de la navegación; el log de la `api` real confirma que el admin no le pidió nada del inventario. Sin sesión → redirección al login con `returnTo` correcto.
- **S2.** CSRF: POST de guardar y de cerrar sin `_csrf`, con uno de otra sesión y con uno alterado → rechazo sin escribir (conteo antes/después).
- **S3.** Escapado: artículo y nota con `<script>`, `"><img onerror>` y comillas, guardados por pantalla; se muestran como texto en lista, receta, editor, `datalist`, historial, ruta del ciclo, "Usado en" y la lista de inactivar.
- **S4.** Privacidad y errores: respuestas sin pila, SQL ni configuración (500 forzado con API caída o respuesta inválida); los logs del admin y de la `api` no llevan costos, cantidades, nombres ni contraseñas (`grep` de los logs del proceso); cabeceras de seguridad y `Cache-Control` de las pantallas iguales a las de T1.

### Navegador real (B), Claude in Chrome contra la `api` real

- **B1.** 360×800: lista, receta, editor (tarjetas), historial, cierre, ficha y alta de T1: sin desbordamiento horizontal de la página (`document.documentElement.scrollWidth <= innerWidth`); las tablas se desplazan solo dentro de su región (decisión 2); textos sin cortes; botones de al menos 44 px de alto o con área equivalente.
- **B2.** 768×1024 y 1280×900: las mismas pantallas; el editor en filas compactas (H-2) con "Merma %" en un renglón y las columnas alineadas.
- **B3.** Editor con 409 y con 422 a 360 y 1280: el aviso y el `error-summary` visibles y legibles.
- **B4.** Consola sin errores ni avisos de CSP; peticiones de red: solo CSS propio, sin JS en estas pantallas (o el JS ya existente del admin), sin 404.
- **B5.** Capturas de cada pantalla y viewport como evidencia (fuera del repositorio).

### Teclado y foco (K)

- **K1.** Recorrido solo con Tab/Shift+Tab/Enter/Espacio: crear una receta de 2 líneas, añadir 10 filas, guardar con un error, saltar desde el enlace del `error-summary` al campo, corregir y guardar; cerrar una receta.
- **K2.** Foco visible en cada parada (H-1: contorno `maiz` en `field-input`, `field-select`, `field-textarea`; enlaces, botones y la región desplazable con `tabindex="0"`), con contraste suficiente sobre su fondo.
- **K3.** Orden de tabulación lógico en tarjetas (móvil) y filas (escritorio); sin trampas de foco.
- **K4.** Región desplazable: con foco, las flechas la desplazan; su nombre accesible es el `caption`.

### Sin JavaScript (N)

- **N1.** Con JS deshabilitado: todo el flujo de R3, R6, R8, R10 y R16 funciona igual.
- **N2.** `datalist` de ingredientes y unidades usable sin JS (o escritura libre resuelta por el admin).
- **N3.** El error-summary y los avisos aparecen sin JS.

### Accesibilidad (Y)

- **Y1.** axe-core (por la vía que decida el usuario en la pregunta 2) en las 7 pantallas de recetas, el editor con 422 y con 409, la ficha y el formulario de T1, a 360 y 1280: 0 violaciones `serious`/`critical`; las `moderate`/`minor` se listan y clasifican.
- **Y2.** Estructura: un solo `h1`, sin saltos de encabezado; landmarks; tablas con `caption` y `th scope`; cada línea un `fieldset` con `legend` "Línea N"; etiquetas en todos los controles; `aria-describedby` de la ayuda y de los errores resolviendo a ids existentes; ids únicos; idioma `es`.
- **Y3.** Lector de pantalla (VoiceOver, muestreo): el `error-summary` recibe el foco o se anuncia al cargar; la región de la tabla se anuncia con su nombre; "Sin costo" y "Usa artículos inactivos" no dependen solo del color.
- **Y4.** Contraste de textos de ayuda, avisos y el contorno de foco medido (≥ 4.5:1 texto; ≥ 3:1 contorno).

### Documentación y defectos previos (D, O)

- **D1.** DEF-003: el caso de empate en `api/tests/unit/inventory-recipes.test.ts` comprueba la mitad hacia arriba (y falla si se invierte: mutación local descartable, revertida y comprobada con `git diff`).
- **D2.** DEF-004: el doble acepta `hr` y su mensaje lista `INVENTORY_UNITS`.
- **D3.** DEF-005: importación con un JSON ficticio de conflicto (fixture existente o copia en el scratchpad) → el mensaje nombra `rendimiento`, `nota` o `lineas`, sin valores.
- **D4.** DEF-006: `--archivo` repetido → mensaje de uso, salida distinta de 0, nada escrito.
- **O1.** OBS-2 en base desechable `restaurante_qa050c_obs2`: migrar, sembrar, comprobar que "Mano de obra ficticia" en `hr` está usada en una receta; ejecutar el `UPDATE` del README tal como está escrito; comprobar que no quedan artículos en `hr`, que la receta sigue legible por SQL y que la `api` de `origin/epic/inventario` en el commit de T1 (`git worktree` temporal de solo lectura en el scratchpad, o la imagen ya construida si existe) arranca y lista el inventario sin 503. Si arrancar T1 no es viable en tiempo razonable, se valida solo la parte SQL y se informa. También se comprueba que el procedimiento alternativo (borrar el volumen) se describe con los nombres reales del proyecto de Compose.

### Regresión (G)

- **G1.** `npm test` (A1) cubre landings, bot, menú, productos, página, usuarios y cotizador.
- **G2.** Admin: con JS, smoke de productos, página, usuarios y cotizador en el navegador (foco H-1 visible y sin desalineación a 360 y 1280).
- **G3.** Landings `/birria` y `/molotes` arrancadas contra la misma `api`: 200 y sin cambios (diff vacío de `landing-pages/src` y `public`).
- **G4.** Diff de `api/src`: vacío (este PR no toca rutas de la API) o justificado.
- **G5.** CodeGraph blast radius de `inventory-common.ts`, `field-*` y `admin-client.ts` para confirmar que todos sus consumidores quedan cubiertos por A1, T6 y G2.

### Pruebas automatizadas

Existentes: la suite completa (A1). Sondas temporales (no se commitean; en el scratchpad o borradas al terminar): script de jsdom para Y2 sobre el HTML real servido, comprobación de `scrollWidth` vía `javascript_tool`, `curl` para S1, S2, R9, R16 y R17, y la mutación de D1. No se escribe en `restaurante/landing-pages/tests/`. No se añaden dependencias.

### Evidencia requerida

En el QA Report: código de salida y totales de F3 y A1 (con duraciones > 10 s); `git diff --stat` y diff vacío de migraciones; tabla de S1/S2 (ruta, rol, código, conteo de versiones antes/después y líneas de log de la `api`); tablas de R y T con resultado y el dato observado; costos de R2 contra cálculo a mano; resultado de axe por pantalla/viewport (o motivo de sustitución); `scrollWidth` vs `innerWidth` por pantalla y viewport; descripción del recorrido K1; salidas de D3, D4 y O1 (solo conteos y mensajes, sin valores de costo de datos reales; aquí todo es ficticio); capturas referidas por ruta del scratchpad (no se adjuntan al repo). Ningún dato real ni credencial en el ticket.

### Limpieza (comprobada, no supuesta)

Al terminar, también si algo falla: detener `api`, `inventory-manager` y landings del QA (comprobar con `lsof` que los puertos quedan libres); cerrar la pestaña de Chrome y reactivar JS si se deshabilitó para el origen; `docker compose -p restaurante-qa-050c down -v` y comparar `docker ps -a`, `docker volume ls` y `docker network ls` con la línea base; `restaurante-mysql-dev-1` sigue `Exited`; 0 bases `restaurante_test*` (desaparecen con el volumen; se comprueba antes de bajarlo que ninguna ejecución sigue en curso); `git worktree list` sin el worktree temporal de O1; `git status` del worktree igual al inicial salvo el ticket (la mutación de D1 revertida); sin procesos `vitest`, `node server.ts`, Chrome headless; scratchpad sin env, cookies, sondas ni capturas que ya no hagan falta (las capturas se borran tras redactar el informe salvo que el usuario pida conservarlas).

### Criterios de aprobación

`QA_APPROVED` solo si: F1–F3 en 0 y F2 vacío; A1 en verde completo; CA-15, CA-12 (admin) y los criterios en pantalla de CA-2 a CA-11 en PASS con evidencia de la `api` real; S1–S4 sin hallazgos de seguridad; T1–T6 sin regresión; D1–D4 y O1 en PASS (o O1 parcial justificado); axe sin `serious`/`critical` en lo afectado; sin `BLOCKER` ni `CRITICAL`; `MAJOR` solo si el usuario los acepta. Las tres decisiones del usuario no se reportan como defecto. Si la extensión de Chrome no responde, CA-15 depende de ella: se devolverá `NEEDS_USER_DECISION` (revisión manual del usuario) en lugar de aprobar.

### Autorizaciones que se piden al usuario

1. Docker local: levantar `restaurante-qa-050c` (MySQL 8.4 con volumen propio en `127.0.0.1:3307`) y bajarlo con `-v` al terminar. Nunca `restaurante-mysql-dev-1` ni datos reales.
2. Ejecutar `api`, `inventory-manager` y landings del worktree con env propios en el scratchpad, y crear en esa base usuarios ficticios (administrador, gerente, editor).
3. Usar Claude in Chrome contra `127.0.0.1`, incluido deshabilitar JavaScript solo para ese origen y restaurarlo.
4. axe-core según la pregunta abierta 2 (no está instalado; no se añade como dependencia).
5. Crear un `git worktree` temporal de solo lectura de T1 para O1 y borrarlo al terminar.
6. Una mutación local descartable para D1, revertida en el acto.

### Preguntas abiertas (con recomendación)

1. **O1 completo o parcial:** ¿basta con ejecutar el `UPDATE` y comprobar el estado por SQL y con la `api` del worktree, o se exige además arrancar la `api` de T1? Recomendado: intentar T1 con el worktree temporal; si no arranca por motivos ajenos (dependencias, migraciones), aceptar la parte SQL y dejarlo como observación.
2. **axe:** `axe-core` **no** está en `node_modules` (comprobado). Opciones: (a) cargar `axe.min.js` en la pestaña de prueba desde un CDN público con `javascript_tool` (solo descarga el script; no envía datos de la página ni se añade al proyecto); (b) `npx axe-core` en caché temporal fuera del repo, borrada al terminar; (c) sustituir axe por Y2 (jsdom) + revisión manual. Recomendado: (a), con (c) como respaldo si el CDN o la CSP lo impiden.

## QA Report — PR 3 (T2)

### Ronda

1 (2026-11-25). QA Action Plan del PR 3 aprobado por el usuario ("Sí, apruebo"), con sus recomendaciones: O1 con la `api` de T1 y, si no arranca por causas ajenas, solo la parte SQL; axe por la opción (a), cargado desde un CDN público solo en la pestaña de prueba, y como respaldo (c) jsdom con revisión manual. Árbol validado: `feature/REQ-F-050-recetas-pantallas` sin commit, sobre `9371772`. `git status` era igual antes y después del QA: 48 entradas y ningún cambio de QA fuera de este ticket.

### Entorno y desviaciones del plan

- MySQL 8.4 en el proyecto Docker propio `restaurante-qa-050c`, en `127.0.0.1:3307`. `restaurante-mysql-dev-1` siguió `Exited`.
- **Base de las pantallas:** se usó `restaurante`, la base de ese contenedor desechable, en lugar de `restaurante_qa050c`, porque el usuario de la app ya tiene permisos sobre ella. No cambia nada del resultado.
- **Base desechable de O1, D3 y D4:** `restaurante_qa050c_obs2`.
- `api` (3210 y webhook 3212), `inventory-manager` (3211) y `landing-pages` (3213) del worktree, con su entorno en el scratchpad. Usuarios ficticios: `qa-admin` (arranque), `qa-gerente` y `qa-editor` (Birria).
- **Navegador:**
  - La ventana de Claude in Chrome está maximizada a 2560 px y `resize_window` no la cambió: `innerWidth` siguió en 2560 tras dos intentos. Tampoco se pudo abrir una ventana emergente (bloqueada).
  - Por eso los anchos de 360, 768 y 1280 px, el teclado, el modo sin JS y axe se validaron en el mismo motor (Chrome 158) sin interfaz, con emulación de dispositivo por CDP (`Emulation.setDeviceMetricsOverride`). Es emulación real del viewport, no la captura recortada que dio el desarrollador.
  - En Claude in Chrome se validó la vista de escritorio: receta y editor sin errores de consola y todas las peticiones en 200 (CSS, `main.js`, `reorder.js`, `submit-guard.js` y fuentes).
- **axe:** la CSP del admin (`script-src 'self'`, `default-src 'self'`) bloquea scripts externos, como debe. axe-core 4.10.2 se cargó desde cdnjs solo en la pestaña sin interfaz de prueba, con `Page.setBypassCSP`. Sin enviar datos de la página. Comprobación de que funciona: detecta `image-alt` en una imagen inyectada.

### Pruebas ejecutadas

| Id | Comando o acción | Resultado |
|---|---|---|
| F1/F2 | `git diff origin/epic/inventario --stat` de `packages/db`, `deploy`, `landing-pages`, `api/src`, `.env.example` y `_stich_source_` | Vacío (migraciones, `deploy/`, `landing-pages` y `api/src` sin cambios). Los cambios coinciden con "Archivos afectados". |
| F3 | `npm run build:css`, `npm run typecheck`, `npm run lint` | 0, 0 y 0. Lint: "854 archivos revisados, sin datos privados", 0 avisos. |
| A1 | `npm test` completo, tras "Merma %" | 0. api 55 archivos / 1245 pruebas en 6.0 s; landing-pages 64 / 903 en 31.8 s; inventory-manager 18 / 297 en 4.0 s. |
| A2 | Revisión de las pruebas permanentes nuevas o modificadas | `inventory-recipes.test.ts` (9 casos) y los cambios en `inventory.test.ts`, `inventory-import.test.ts` e `inventory-recipes.test.ts` protegen comportamiento (pantallas, 403, conflicto, DEF-003, DEF-005 y DEF-006). Sin sufijos `qa-req-f-*`. |
| S1 | Editor: GET de las 5 pantallas y los 2 POST de recetas | 403 en las 7. Log de la `api` durante el bloque: solo `/admin/sesion` y `/admin/birria/productos`, ninguna petición de inventario. "Recetas" no aparece en su navegación. Sin sesión: 303 a `/acceso`. Un POST de cierre con campos desconocidos da 400 antes de la sesión (formulario cerrado, igual que en T1). |
| S2 | CSRF en guardar y cerrar: ausente, de otra sesión, aleatorio y alterado | 403 "Petición no válida" en los 6 casos. Versiones antes y después: 6 y 6. La `api` registra `admin_csrf_rejected` (doble barrera). |
| S3 | Nombre de artículo, nota de versión y nota de línea con `<script>alert(1)</script>"><img src=x onerror=alert(2)> O'Neil & co` | Escapado en la lista, la receta, el editor y el `datalist`, el cierre, el historial, la ruta del ciclo, "Usado en", la página de inactivar y la ficha. Ningún `<script>alert` ni `<img src=x` sin escapar. |
| S4 | `grep` de los logs de `api` (1092 líneas) e `inventory-manager` (509) | Sin nombres, cantidades, costos, contraseñas ni contenido de formularios: solo ids, acciones y conteos. Cabeceras de seguridad idénticas entre T1 y las 4 pantallas de recetas (mismo hash): CSP, `Cache-Control: no-store`, `frame-ancestors 'none'`. |
| L1 | Lista como gerente | 3 recetas de la semilla. Carne cocida $266.67/kg, Salsa base $42.24/L, Taco ficticio "Sin costo (falta 1)". Fecha en hora del negocio (08:20 CST, 14:20Z). |
| L2/L3 | `tipo=intermedio` (2), `compuesto` (1), `q=SALSA` (1), `q=zzz` (vacío con mensaje); `tipo=padre`, `tipo=<script>`, `pagina=0` y `pagina=abc` | 422 con el error en su campo (`aria-invalid` y `role=alert`). `pagina=99`: 200 sin filas. |
| R1/R2 | Costos frente al cálculo a mano | Salsa base 1.5×28 + 0.02×12 = 42.24 ✓. Carne 10×160 = 1600, /6 = 266.67 ✓ (neta 6, merma 40 %, bruta 10). Taco: 0.08×266.6667 = 21.33, 0.02×42.24 = 0.84, 0.01 hr × 80 = 0.80, Cebolla "Sin costo" con la ruta "Taco ficticio → Cebolla" y el enlace "Completar el costo" ✓. CA-3: 500 g de Queso a 10/kg = $5.00 ✓. |
| R3/R4/CA-8 | Guardar sin cambios, con cambios y con cambio del costo de referencia | Sin cambios: `ok=unchanged`, 1 versión. Con cambios: v2 vigente y v1 con intervalo contiguo. Queso de 10 a 20: el costo de Salsa pasa de 4.00 a 8.00 sin crear versión ✓. |
| R5 | Historial `/versiones/:id` | Solo lectura, sin formularios ni importes (PT-4). `9999`, `abc` y `0`, y artículos o rutas inexistentes: 404 controlado. |
| R6 | Ciclo directo (Salsa base en sí misma) e indirecto (Salsa base → Salsa → Salsa base) | 422 con "Ruta del ciclo: Salsa base → Salsa → Salsa base", lo escrito conservado y versiones sin cambio. Ver DEF-007. |
| R7 | Cadena de Intermedios QA Nivel 1 a 10 | Hasta 8 niveles se guarda; la que haría 9 da 422 "quedarían anidadas en 9 niveles; el máximo es 8". |
| R8 | Dos sesiones (gerente y administrador) sobre la misma versión | La segunda recibe 409 con la vigente (número, autor y fecha) y lo escrito, y conserva la `baseVersionId` antigua. Reenviar el guardado normal: 409 otra vez. "Guardar mis cambios sobre la versión vigente" ×2: una sola versión nueva (v4). |
| R9 | Doble envío idéntico, y 503 con reintento | Doble POST con el mismo `requestId`: 303 y 303, versiones de 4 a 5 (+1). Con la `api` detenida: 503 "no se guardó nada", lo escrito y el mismo `requestId` conservados, y la lista también da 503 controlado. Con la `api` de vuelta (sesión nueva, porque las sesiones de la `api` están en memoria) y reenvío ×2: versiones de 5 a 6 (+1). |
| R10 | Cerrar | Confirmación, luego `ok=closed`. Sin vigente, desaparece de la lista y aparece "Crear receta". `baseVersionId` antigua: 409 "La receta cambió mientras lo revisabas: no se cerró". |
| R11 | 17 casos de validación | Todos dan 422 con el error en su campo (`aria-invalid`) y un enlace del `error-summary` a `#f-lines-N-campo` con el texto "Línea N, campo: …". Casos: merma 100, -1 y 9.999; coma; cantidad 0; 0.001 g ("se redondea a 0"); rendimiento 0 o vacío; ingrediente inexistente o repetido; `bulto` y `tazas` (no existen); `pza` sin factor; nota de 201 y de 401 caracteres; sin unidad; sin cantidad; ninguna línea (enlace a `#f-lines`). |
| R12 | Filas 1, 5 y 23 llenas, y error en la 23 | El error cae en `lines.22.unit` ("Línea 23, unidad: …"), no en la 3. Corregido, se guardan 3 líneas en orden. Decisión 3: una unidad sin factor se rechaza en su línea ✓. |
| R13 | Mano de obra en `hr` | Se costea por referencia en el Taco ($0.80). Alta de "QA Hora técnico" en `hr`, no inventariable y con $55.1234: la ficha dice "no lleva existencias; se costea por su costo de referencia". |
| R14/L4 | Ingrediente inactivo | No aparece en el `datalist`. Escrito a mano: 422 en su línea. La receta y el editor de Molote muestran el aviso de ingredientes inactivos, y la lista "⚠ Usa artículos inactivos" (icono y texto). |
| R15 | Tipos sin receta | Insumo, Reventa y padre sin enlace "Receta". GET de `/receta`, `/nueva` y `/cerrar` y POST a un Insumo: 409 "Sin receta" con la vuelta a la ficha. El `datalist` excluye los Compuestos (Molote, Quesabirria, Taco de birria y Taco ficticio) y los padres (Agua fresca y Refresco 600 ml). |
| R16 | "Añadir 10 filas" | 10, 20, 30 y 40, sin perder lo escrito. En 40 el botón desaparece. `rows=1000` vuelve a 20, sin 500. `lines.40.*`: 400 "campos desconocidos". Ninguna versión creada (0 → 0). |
| R17 | Datos manipulados | `baseVersionId=abc` y `action=otra`: 400 "valores imposibles". Campos desconocidos: 400. Cuerpo de 70 kB: 413. `requestId` inválido: se regenera. Nunca 500. |
| T1/T2 | Formulario de T1 | El costo de referencia rechaza -1, 5 decimales, coma y texto (422 en su campo). Un Intermedio no inventariable: 422 (PT-7). Alta de un Compuesto con costo: 422. Campos del formulario de edición: Insumo con costo e inventariable; Intermedio solo costo; Compuesto y padre sin ninguno; Reventa variante con costo. Un `referenceCost` añadido por POST a un Compuesto se ignora (no se guarda ni entra en el historial). |
| T3 | Historial de la ficha | "Costo de referencia: $140.0000 → pasa a $10.0000" ✓. |
| T4/T5 | "Usado en" e inactivar | La ficha de Sal lista Consomé, QA Nivel 10 y Salsa base con enlaces. La página de inactivar los lista y envía `recipes=keep`. Si se crea una receta entre la carga y el envío (QA Hora técnico usado por Molote en otra petición): 409 con "Se usa en recetas vigentes: no se inactivó" y la lista, y al confirmar, `ok=deactivated`. Inactivar Salsa base (Intermedio con receta) no cierra su receta: aviso "su receta se puede consultar o cerrar, pero no admite versiones nuevas". Reactivar: `ok=reactivated`. |
| T6 | Regresión de T1 | Lista, filtros, alta, edición, inactivar y reactivar en 200 o 303. 403 del Editor, 404 y 503 controlados. `inventorySession` y `apiFailure` son idénticos antes y después del refactor (diff de `inventory-common.ts` contra el bloque de `inventory.ts` de la épica). |
| B1/B2 | 13 pantallas × 360, 768 y 1280 (emulación CDP) | `scrollWidth == innerWidth` en las 39 combinaciones, sin ningún elemento fuera del viewport salvo dentro de su región desplazable. A 360 px las tablas de la lista y de las líneas desplazan 672 px dentro de su región (decisión 2). A 360 px el editor va en tarjetas y a 1280 en filas compactas con "Merma %" en un renglón (capturas revisadas). |
| B3 | Editor con 409 y con 422 a 360 y 1280 | Aviso y `error-summary` visibles y legibles (capturas revisadas). |
| B4 | Consola y red (Claude in Chrome, escritorio) | Sin mensajes de consola ni 404. Solo CSS y JS propios y las fuentes de Google ya existentes. |
| K1 | Recorrido solo con teclado (Tab y Enter) | Rendimiento, línea 1 y línea 2 con unidad errónea, "Añadir 10 filas" (20 filas, lo escrito conservado), "Guardar versión", y el foco va al aviso (`role=alert`, `autofocus`). Tab al enlace del resumen y Enter: el foco cae en `lines.1.unit` con `aria-invalid` y `aria-describedby` hacia su error. Corregir y guardar: `ok=saved`. Cerrar receta con teclado: `ok=closed`. |
| K2 | Foco visible | En las 30 primeras paradas del editor (enlaces, botones, campos), los botones de filas y guardar, la región y los enlaces del resumen: contorno sólido de 2 px `rgb(234,179,8)` (maíz) con `:focus-visible`. La casilla "inventariable" muestra un anillo blanco de 2 px (captura ampliada). |
| K3 | Orden de tabulación | Cabecera → subnavegación → volver → rendimiento → nota → línea 1 (ingrediente, cantidad, unidad, merma, nota) → línea 2…, sin trampas. |
| K4 | Región desplazable (360 px) | Recibe el foco con Tab (`role=region` y `aria-labelledby=recipe-list-caption`), y 5 × flecha derecha llevan `scrollLeft` de 0 a 200. |
| N1–N3 | JavaScript desactivado (`Emulation.setScriptExecutionDisabled`) | Funcionan añadir filas (20, con lo escrito), el error de la línea 16 con su resumen y `role=alert`, guardar, el conflicto 409 (lo escrito, "4", conservado) y el guardado encima, cerrar y el ciclo con su ruta. |
| Y1 | axe-core 4.10.2 en 15 pantallas × 360 y 1280, más el editor con 422 y con 409 a 360 y 1280 | 0 violaciones de cualquier gravedad en las 34 ejecuciones. |
| Y2 | Estructura con el DOM real | En todas: `lang=es`, un `h1`, sin saltos de encabezado, sin ids repetidos, todos los controles con etiqueta, todos los `aria-describedby` resueltos, tablas con `caption` y `th scope`, todos los `fieldset` con `legend` y los landmarks `header`, `nav` ×2 y `main`. |
| D1 | DEF-003, mutación descartable de `divideRounded` (mitad hacia abajo) | La prueba DEF-003 falla con la mutación y pasa al revertirla. `git diff` de `decimal.ts` vacío. |
| D2 | DEF-004 | El doble usa `INVENTORY_UNITS` (con `hr`) y su mensaje las lista (diff revisado; la suite pasa). |
| D3 | DEF-005, CLI real con el fixture ficticio | Escritura: 13 artículos, 3 recetas y 9 líneas. Ensayo con una copia alterada: "Rec!2 [rendimiento]" y "Rec!6 [nota]", sin valores, "No se escribió nada". |
| D4 | DEF-006 | `--archivo a --archivo b`: "--archivo repetido: indica un solo archivo. Uso: …" y salida 1. |
| O1 | OBS-2 en la base desechable con la semilla | "Mano de obra ficticia" en `hr` usada en 1 línea. El `UPDATE` del README, ejecutado tal cual, deja 0 artículos en `hr`. La `api` y el admin de T1 (`d3a78be`, en un worktree temporal con `DATABASE_ALLOW_NEWER_SCHEMA=true`, como indica el README) muestran la lista y las fichas en 200. Contraprueba: con un artículo de nuevo en `hr`, la lista de T1 da 503, y tras el `UPDATE`, 200. |
| G2 | Resto del admin a 360 y 1280 (administrador) | Negocios, productos ×2, página ×2, cotizador, usuarios, alta de usuario, bot y cuenta sin desbordamiento horizontal. Con Tab, los `field-input`, `field-select` y `field-textarea` muestran el contorno maíz (H-1). |
| G3 | `landing-pages` del worktree contra la misma `api` | `/` y `/birria` 200 (Birria, 5 enlaces `wa.me`), `/molotes` 200 (4), ruta inexistente 404. |
| G4 | Diff de `api/src` | Vacío. |
| G5 | Blast radius de CodeGraph (`createInventoryAccess`, `createControllerKit` y `saveInventoryRecipe`) y consumidores de los parciales `field-*` | Consumidores: `inventory.ts`, `inventory-recipes.ts`, `users`, `admin`, `bot`, `page` y `quote`, cubiertos por A1, T6 y G2. |

### Criterios de aceptación

| CA | Resultado | Evidencia |
|---|---|---|
| CA-15 / RF-13 | PASS | B1–B4, K1–K4, N1–N3, Y1–Y2. Defecto menor de usabilidad DEF-008. |
| CA-12 (admin) | PASS | S1 |
| CA-4 en pantalla | PASS | R6 y R7. El error no se marca en su línea: DEF-007, MINOR. |
| CA-5 en pantalla | PASS | R3, R4 y R10 |
| CA-6 en pantalla | PASS | R8 y R9 |
| CA-2 y CA-3 en pantalla | PASS | R11, R12 y R2 |
| CA-7, CA-8 y CA-9 en pantalla | PASS | R1, R2, R3 y R13 |
| CA-10 / RF-7 / RF-8 | PASS | T4, T5 y R14 |
| CA-11 | PASS | R15 |
| RF-1, RF-2 y RF-3 (con la decisión 1) | PASS | L1–L4, R1, R5. La ayuda fija dice que la bruta y el costo se calculan al guardar, y las líneas iguales a la vigente muestran "Como en la versión vigente: bruta …; costo …". |
| RF-10 | PASS | T1–T3 y R13 |
| CA-16 | PASS | A1, T6 y G2–G4 |
| DEF-003 a DEF-006 y OBS-2 | PASS | D1–D4 y O1 |

### Defectos encontrados

#### DEF-007
- Severidad: MINOR
- Criterio de aceptación afectado: RF-13 ("errores junto a su línea y campo"). CA-4 se cumple.
- Descripción: el rechazo por ciclo (`RECIPE_CYCLE`) y por profundidad (`RECIPE_TOO_DEEP`) solo aparece en el aviso superior, con la ruta. La línea que cierra el ciclo no se marca (`aria-invalid` sin marcar y sin enlace en el resumen).
- Pasos para reproducir: Salsa usa Salsa base. En el editor de Salsa base, añadir "Salsa" en la línea 3 y guardar.
- Resultado esperado: el error también junto a la línea 3, en su campo ingrediente, o un enlace a ella.
- Resultado actual: solo "Ruta del ciclo: Salsa base → Salsa → Salsa base. Quita el ingrediente que cierra el ciclo." arriba. `invalid=[]` y ningún enlace en el resumen.
- Evidencia: R6 y R7, y `/tmp/…/cyc.html` (borrado al limpiar).
- Impacto: bajo. La ruta nombra el ingrediente y lo escrito se conserva, pero con 40 filas hay que buscarlo a mano.
- Recomendación: asociar el error de ciclo a la línea del ingrediente que lo cierra (el penúltimo nombre de la ruta), si la información disponible lo permite.

#### DEF-008
- Severidad: MINOR
- Criterio de aceptación afectado: RF-13 / CA-15 (teclado). La funcionalidad se cumple.
- Descripción: tras "Añadir 10 filas" (POST sin JS que vuelve a pintar la página), el foco vuelve al inicio del documento (`BODY`). Quien usa teclado debe tabular otra vez por la cabecera y todas las filas ya escritas (hasta unas 150 paradas) para llegar a las filas nuevas.
- Pasos para reproducir: en el editor, con teclado, escribir dos líneas, tabular hasta "Añadir 10 filas" y pulsar Enter.
- Resultado esperado: el foco o la vista en la primera fila nueva (o en el botón), sin depender de JS.
- Resultado actual: `document.activeElement` es `BODY` y la vista está al principio.
- Evidencia: K1 ("after rows … BODY#").
- Impacto: bajo o medio para quien solo usa teclado o lector de pantalla con recetas largas. Es utilizable.
- Recomendación: devolver la página con un ancla o `autofocus` en la primera fila nueva.

### Observaciones (sin defecto del PR 3)

- **OBS-10 (TRIVIAL, decisión 2):** a 360 px el `caption` de la lista ("Recetas vigentes con su costo teórico por unidad") va dentro de la región desplazable y se ve cortado hasta desplazarla. Su nombre accesible está completo.
- **OBS-11 (anterior al PR, fuera de H-1):** en `field-password` (alta de usuario y cuenta), el foco solo cambia el color del borde (`outline` transparente). H-1 cubrió `field-input`, `field-select` y `field-textarea`. Candidato a un ajuste aparte.
- **OBS-12 (anterior, igual en T1):** sin sesión, las rutas de `/inventario/*` redirigen a `/acceso` sin `next` (`/usuarios/nuevo` sí lo lleva). La búsqueda no ignora acentos ("cárne" no encuentra "Carne"). `pagina` fuera de rango dice "N resultados" y "No hay … que coincidan". En los tres casos T1 se comporta igual.
- **OBS-13:** tras reiniciar la `api`, las sesiones del admin caducan (`/acceso?expirada=1`), porque las sesiones están en memoria. Comportamiento existente; el reintento del 503 funciona tras volver a entrar.
- **OBS-14:** volver a cerrar una receta ya cerrada redirige con `ok=closed` y el aviso "cerrada" otra vez. Es idempotente, sin efectos.
- **Objetivos de área táctil:** los enlaces de texto en línea miden 14–17 px de alto (excepción de WCAG 2.5.8 para enlaces en línea). La casilla "inventariable" mide 20×20 con su etiqueta clicable. No son defectos.

### Regresión

`npm test` completo en verde (A1). T1 sin cambios funcionales (T6). Landings (G3). Resto del admin y foco H-1 (G2). `api/src`, `landing-pages`, migraciones y `deploy/` sin diff (F1 y G4).

### Responsive

39 combinaciones de pantalla y ancho sin desbordamiento de página (B1). Las tablas se desplazan dentro de su región a 360 px, como en la decisión aprobada. Editor en tarjetas a 360 px y en filas a 1280 (capturas).

### Accesibilidad

axe: 0 violaciones en 34 ejecuciones (Y1). Estructura correcta en todas (Y2). Teclado y foco visibles (K1–K4). Los errores tienen icono, texto, `aria-invalid` y `role=alert`, y no dependen del color. DEF-007 y DEF-008 son MINOR.

### UX/UI

`_stich_source_/` no tiene diseño del admin. Se respetan H-1 a H-5 y las tres decisiones del usuario. "Merma %" cabe en un renglón a 1280 px.

### Performance

Las pantallas de recetas cargan solo `main.css`, `main.js` y sus 2 módulos existentes, más las fuentes ya usadas. Sin 404 ni errores de consola. El costo se calcula al consultar (DT-7) y no se observaron latencias anómalas en los logs (decenas de ms).

### SEO

No aplica: el admin es interno. Cada pantalla tiene `title` propio.

### Pendientes de revisión manual

- Muestra con VoiceOver (Y3) no ejecutada: no hay forma de manejar el lector de pantalla desde este entorno. La sustituyen la estructura (Y2), axe (Y1), el foco en el aviso con `role=alert` y `autofocus`, y el nombre accesible de la región (K4). Ningún CA depende solo de ella.
- Si el usuario quiere ver el comportamiento a 360 px en su propia ventana, puede reducirla o usar el modo dispositivo de DevTools: la ventana del agente estaba maximizada y no se pudo redimensionar.

### Limpieza

Comprobada, no supuesta:

- `api`, `inventory-manager`, `landing-pages`, la `api` y el admin de T1 y Chrome sin interfaz detenidos. Puertos 3210–3213, 3220–3222, 3307 y 9333 libres. Sin procesos `vitest`, `server.ts` ni `inventory-import`.
- `docker compose -p restaurante-qa-050c down -v`: contenedor, volumen y redes eliminados. `docker ps -a`, `docker volume ls` y `docker network ls` iguales a la línea base. `restaurante-mysql-dev-1` sigue `Exited`.
- 0 bases `restaurante_test*` antes de bajar el contenedor. `restaurante`, `restaurante_qa050c_obs2` y `restaurante_shadow` desaparecieron con su volumen.
- Worktree temporal de T1 eliminado (`git worktree list` solo muestra `main` y el del PR 3).
- La mutación de `decimal.ts` se revirtió (diff vacío). `git status` del worktree igual al inicial salvo este ticket.
- Pestañas de Claude in Chrome cerradas (grupo vacío). No hizo falta desactivar JS en Chrome: el modo sin JS se probó en la pestaña sin interfaz.
- Scratchpad vaciado: entornos, cookies, sondas, capturas, logs y el perfil de Chrome.

### Resultado final

QA_APPROVED

Todos los CA del alcance del PR 3 están en PASS con evidencia contra la `api` real y la semilla. No hay defectos BLOCKER, CRITICAL ni MAJOR. Hay 2 MINOR (DEF-007 y DEF-008), que no bloquean y se proponen como seguimiento. `npm test` completo en verde.

## Commit y Pull Request — PR 3

- Rama `feature/REQ-F-050-recetas-pantallas`, salida de `origin/epic/inventario` (`9371772`). La épica no cambió desde entonces (`git fetch` el 2026-11-25): no hizo falta integrarla.
- Antes del commit: `npm run typecheck` y `npm run lint` en 0. Índice revisado: solo los archivos del PR 3 y este ticket, añadidos por nombre, sin capturas, scratchpad, `.codegraph`, CSS generado ni temporales.
- Pruebas permanentes: las de "QA Report — PR 3" (A2), todas funcionales (pantallas, 403, conflicto, DEF-003, DEF-005 y DEF-006).
- **Seguimiento aparte, aprobado por el usuario** ("DEF-007 y DEF-008 como seguimiento aparte"):
  - DEF-007 (MINOR): el error de ciclo y de profundidad no se marca en la línea que cierra el ciclo.
  - DEF-008 (MINOR): tras "Añadir 10 filas" sin JS, el foco vuelve al inicio del documento.
  - No se corrigen en este PR. Las observaciones OBS-10 a OBS-14 tampoco.
- Pull Request en borrador hacia `epic/inventario`; se marca listo tras el último push, cuando haya terminado su ejecución del CI. El número, la URL y el resultado del CI están en el informe de senior-fullstack (sin más commits después de marcarlo listo).

## Historial de cambios

### Cierre (senior-fullstack, 2026-11-25)

El usuario confirmó el merge de #190 en `epic/inventario` ("mergeado"; merge `906290b`, commit `831fe9e`) y aprobó el cierre ("Sí, empieza por el punto 1"). CI de #190 en verde (`calidad`, `docker`, `auditoria`, `pruebas (1/2)` y `pruebas (2/2)` en `pass`; `deploy`, `publish`, `vigente` y `validado` omitidos por ir a `epic/inventario`). Ticket movido con `git mv` de `in-progress/` a `done/`. Quedan DEF-007 y DEF-008 (ticket aparte, sin abrir), OBS-10 a OBS-14 y la revisión manual con VoiceOver. Estado `DONE`.

### Commit y Pull Request PR 3 (senior-fullstack, 2026-11-25)

`epic/inventario` sin cambios (`9371772`). `typecheck` y `lint` en 0. DEF-007 y DEF-008 quedan como seguimiento aparte, aprobado por el usuario. Commit `feat` y PR en borrador hacia `epic/inventario`; se marca listo tras su CI. Estado `READY_FOR_MERGE`, sujeto al CI del PR.

### QA Report PR 3, ronda 1 (senior-qa, 2026-11-25)

QA Action Plan aprobado ("Sí, apruebo"). Ejecución completa contra la `api` real, MySQL `restaurante-qa-050c` y la semilla: `build:css`, `typecheck`, `lint` y `npm test` en 0; permisos, CSRF, escapado, idempotencia, 409/503, límite de 40 filas, ciclos y profundidad, T1, OBS-2 con la `api` de T1, DEF-003 a DEF-006; 360/768/1280 px con emulación CDP, teclado, sin JS y axe (0 violaciones). 2 defectos MINOR (DEF-007 y DEF-008). Limpieza comprobada. Estado `QA_APPROVED`.

### QA Action Plan PR 3 (senior-qa, 2026-11-25)

Plan de QA del PR 3 (pantallas de recetas contra la `api` real y la semilla, navegador real a 360/768/1280 px, teclado, sin JS y axe, permisos, CSRF, idempotencia, 409/503, límite de 40 filas, escapado, regresión de T1 y del admin, DEF-003 a DEF-006 y OBS-2 en base desechable, `npm test` completo). Estado `NEEDS_QA_PLAN_APPROVAL`.

### Implementación PR 3 (senior-fullstack, 2026-11-25)

Pantallas de recetas, campos nuevos de la ficha de T1, cliente HTTP de recetas, DEF-003 a DEF-006, OBS-2 y documentación, en `feature/REQ-F-050-recetas-pantallas` (sin commit). `build:css`, `typecheck`, `lint` y `npm test` en verde. Estado `NEEDS_IMPLEMENTATION_APPROVAL`.

### PR 2b abierto (senior-fullstack, 2026-11-20)

PR 2a mergeado en `epic/inventario` como #188 (merge `1c18060`, CI en `pass`). Integrada `origin/epic/inventario` en la rama del PR 2b (merge `139c9df`); huella `restaurante` = `d385d63b…` comprobada; diff contra la épica = los 15 archivos del reparto 2b. Pull Request #189 en borrador hacia `epic/inventario` (https://github.com/orvigas/negocio/pull/189). Estado `READY_FOR_MERGE`, pendiente del CI del PR 2b.

### Commit y Pull Requests PR 2a y PR 2b (senior-fullstack, 2026-11-20)

`epic/inventario` sin cambios (`0187298`). Pendientes del QA del PR 2 asignados ("Pendientes del PR 2 para el PR 3 y seguimientos"; DEF-005 y DEF-006 al PR 3 o a un seguimiento menor; OBS-7 vigilada en el CI). PR 2a: commit `ade09f1` y PR #188 en borrador hacia `epic/inventario` (https://github.com/orvigas/negocio/pull/188), huella `59c7cc06…` comprobada. PR 2b: commit `05a4c4e` en `feature/REQ-F-050-recetas-importacion`, publicada, huella `d385d63b…` comprobada; su PR se abre tras el merge del 2a.

### QA Report PR 2, ronda 1 (senior-qa, 2026-11-20)

QA Action Plan del PR 2 aprobado por el usuario ("Si", con las 5 autorizaciones y las recomendaciones a las 4 preguntas). Ejecutado completo: F, A, I, E, P, Z, X y G, contra un MySQL 8.4 de QA aislado y la imagen `api` final. CA-12, CA-13 y los criterios HTTP de CA-4, CA-6 y CA-7 a CA-11 en PASS; DEF-001 y DEF-002 corregidos con su escenario original; reparto 2a/2b validado, con huella (`restaurante` = `d385d63b…`, 2a = `59c7cc06…`). Sin defectos BLOCKER, CRITICAL ni MAJOR; DEF-005 (MINOR) y DEF-006 (TRIVIAL), y observaciones OBS-4 a OBS-9. Estado `QA_APPROVED`. Limpieza comprobada.

### QA Action Plan PR 2 (senior-qa, 2026-11-20)

Implementación del PR 2 aprobada por el usuario ("Si": partir en 2a y 2b al commitear y aceptar las 6 desviaciones). QA Action Plan del PR 2 escrito (F, A, I, E, P, Z, X y G), con la validación del reparto en 2a/2b, sin ejecutar pruebas ni levantar procesos. Estado `NEEDS_QA_PLAN_APPROVAL`.

### Implementación PR 2 (senior-fullstack, 2026-11-20)

Plan técnico aprobado ("Si", PT-1 a PT-7). Rama `feature/REQ-F-050-recetas-api-importacion` desde `origin/epic/inventario` (`0187298`), en un worktree. Implementados los contratos y las rutas de recetas, los campos nuevos del artículo en la API, DEF-001 (503 `INVENTORY_BUSY` también en las rutas de T1), la importación única A5 (núcleo en core, comando con salvaguardas, fixture ficticio y procedimiento de `despliegue.md` §5 ejecutado en local contra la imagen `api`), la semilla ampliada y DEF-002. `typecheck`, `lint` y `test` en verde. Se propone partir el PR en 2a y 2b (PT-6). Estado `NEEDS_IMPLEMENTATION_APPROVAL`; sin commit.

### Integración de epic/inventario y CI del PR 1 (senior-fullstack, 2026-11-20)

`auditoria` fallaba en #185 porque la rama salía de la base vieja `0c3c293` (sin el arreglo de GHSA-7589-6fvf-x4pw). Con la autorización del usuario ("Si lo autorizo"), merge de `origin/epic/inventario` (`d3a78be`, tras #186 y #187) en la rama: merge commit `5df99c5`, sin conflictos; el diff del PR contra la épica sigue siendo solo el PR 1 de T2. En local: `npm ls effect` = 3.22.5 (overridden), `npm run typecheck` y `npm run lint` en 0 (barrera: 844 archivos, sin datos privados). Push normal, sin force. CI del PR (ejecución 44720216193): `calidad`, `docker`, `auditoria`, `pruebas (1/2)`, `pruebas (2/2)` y `verificacion` en `pass` (`deploy`, `publish`, `vigente` y `validado` omitidos, como corresponde a un PR hacia `epic/inventario`). Estado `READY_FOR_MERGE`.

### Commit y Pull Request PR 1 (senior-fullstack, 2026-11-19)

`epic/inventario` sin cambios desde la salida de la rama (`0c3c293`): no hizo falta integrarla. `npm run typecheck` y `npm run lint` en verde (barrera: 835 archivos, sin datos privados); índice revisado sin hojas de cálculo, JSON de importación real ni temporales. Pendientes del QA asignados a los PR 2 y 3 ("Pendientes del PR 1 para los PR 2 y 3"). Commit `feat` (`cb9bc4d`) y PR #185 en borrador hacia `epic/inventario` (https://github.com/orvigas/negocio/pull/185); se marca listo tras el commit de este registro.

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
