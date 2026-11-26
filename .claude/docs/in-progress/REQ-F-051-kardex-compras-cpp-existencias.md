# REQ-F-051 — T3: Kardex, saldo inicial, proveedores, compras con CPP y existencias valorizadas

## Estado

QA_APPROVED

QA del PR 2 aprobado por senior-qa el 2026-11-26 (ver "QA Report — PR 2", ronda 2). El usuario aprobó la implementación de la ronda 2 con "si". DEF-003 y DEF-004 quedan corregidos y verificados sobre MySQL y HTTP real; las pruebas permanentes detectan las dos mutaciones. Sin defectos nuevos. OBS-13 a OBS-18 siguen registradas. Siguiente paso: senior-fullstack hace el commit y abre el PR hacia `epic/inventario` (T4).

PR 2, ronda 2: DEF-003 y DEF-004 del QA corregidos en este PR (decisión previa del usuario: "Sí, apruebo el plan con las cinco recomendaciones", R-1 y R-2 opción A) y OBS-19 documentada. Sin commit (ver "Implementation Result — PR 2", "Ronda 2").

QA del PR 2 rechazado por senior-qa el 2026-11-26 (ver "QA Report — PR 2", ronda 1). El usuario había aprobado el plan con "Sí, apruebo el plan con las cinco recomendaciones". Se confirmaron R-1 y R-2 del plan, y el usuario había decidido de antemano que, si se confirmaban, serían `MINOR` y se corregirían en este PR: DEF-003 (404 antes que 401/403 en `devoluciones` y `reversion`) y DEF-004 (`stock` no nulo en la ficha y el Kardex de un Compuesto o un no inventariable). El resto del plan pasa. Siguiente paso: senior-fullstack corrige DEF-003 y DEF-004 y QA revalida (ronda 2).

QA Action Plan del PR 2 redactado por senior-qa el 2026-11-26 (ver "QA Action Plan — PR 2"), sin ejecutar ninguna prueba. El usuario aprobó la implementación del PR 2 con "si". Quedan 5 decisiones para la aprobación del plan.

PR 2 de T3 (API del Kardex y de los proveedores, contratos, cliente HTTP, semilla ampliada, DEF-001 y OBS-6 a OBS-8 del QA del PR 1b) implementado en `feature/REQ-F-051-kardex-api`, desde `origin/epic/inventario` (`851ec79`, con el PR 1b mergeado en #196), sin commit (ver "Implementation Result — PR 2"). Añade 1 445 líneas, por debajo de las ~1 500 del plan: no hace falta partirlo en 2a y 2b.

PR 1b mergeado en `epic/inventario` (#196, merge `851ec79`). Historial del PR 1b: commit `8f8c128` en `feature/REQ-F-051-kardex-dominio` y PR #196 (https://github.com/orvigas/negocio/pull/196) hacia `epic/inventario` (no se despliega). El CI de `7249efc`, con el PR listo (ejecución 45784137262), pasó `calidad`, `docker`, `auditoria` y `pruebas` (1/2 y 2/2). Siguiente paso: el usuario revisa y hace merge del PR #196. Después viene el PR 2 (API, semilla, DEF-001 y OBS-6 a OBS-8).

QA del PR 1b aprobado por senior-qa el 2026-11-26 (ver "QA Report — PR 1b", ronda 1). El usuario había aprobado el plan de QA con "Si", en respuesta a "¿Aprueba el plan de QA del PR 1b con esas cuatro respuestas?". Hay 2 defectos sin bloqueo: DEF-001 (`MINOR`) y DEF-002 (`TRIVIAL`). Siguiente paso: senior-fullstack hace el commit y abre el PR hacia `epic/inventario` (T4), y decide con el usuario si DEF-001 y DEF-002 se corrigen en este PR o en uno posterior.

PR 1b de T3 (Kardex, CPP, saldo inicial, compra, ajuste, devolución, reversión, existencias, `inventory:verify` y sus pruebas en MySQL) implementado y validado en `feature/REQ-F-051-kardex-dominio`, desde `origin/epic/inventario` (`27c7a25`), sin commit (ver "Implementation Result — PR 1b"). El usuario decidió mantenerlo como un solo PR y confirmó RN-T3-12 a RN-T3-14 (ver "Decisiones sobre el PR 1b"). Falta que apruebe la implementación para pasar a QA.

PR 1a mergeado en `epic/inventario` (#195, merge `27c7a25`).

Historial del PR 1a: commit `1fb5a02` en `feature/REQ-F-051-kardex-modelo` y PR #195 (https://github.com/orvigas/negocio/pull/195) hacia `epic/inventario` (no se despliega). El CI de `d8e7461`, con el PR listo (ejecución 45736787294), pasó `calidad`, `docker`, `auditoria` y `pruebas` (1/2 y 2/2). Siguiente paso: el usuario revisa y hace merge del PR #195. Después, el PR 1b sale de la punta de la épica.

QA del PR 1a aprobado por senior-qa el 2026-11-25 (ver "QA Report — PR 1a", ronda 1). El usuario aprobó el plan de QA: "Sí, apruebo el plan de QA con las tres respuestas". No hay defectos; quedan 4 observaciones. Siguiente paso: senior-fullstack hace el commit y abre el PR en borrador hacia `epic/inventario` (T4).

PR 1a de T3 (migración `inventario_kardex`, proveedores, existencias, RN-T3-11, búsqueda sin acentos, regla de inmutabilidad y trabajos de arrastre) implementado en `feature/REQ-F-051-kardex-modelo`, desde `origin/epic/inventario` (`ad50c50`), sin commit (ver "Implementation Result — PR 1a"). El PR 1 se parte en 1a y 1b porque completo pasa de unas 1 500 líneas, como prevé el plan. El PR 1b (Kardex, CPP, `inventory:verify` y sus pruebas en MySQL) sale de la punta de la épica cuando el 1a esté mergeado.

Plan técnico aprobado por el usuario el 2026-11-25: "Sí, apruebo el plan con A en DT-T3-6" (en respuesta a "¿Aprueba el plan técnico y las recomendaciones para DT-T3-3 a DT-T3-9 (A en DT-T3-6)?"). Quedan aprobadas DT-T3-1 a DT-T3-9 con la recomendación del plan (A en DT-T3-6). La edición de `.claude/CLAUDE.md` §8 y de `senior-fullstack.md` no está autorizada: se pedirá al cerrar T3.

## Aprobación

Aprobado por el usuario (versión 1, fecha 2026-11-25).

- Pregunta de la sesión principal: "¿Aprueba el borrador con las 13 propuestas y mis recomendaciones para P-1 a P-3?"
- Respuesta del usuario (cita textual): "Si lo apruebo".
- Origen: "Sigue con OBS-11 y al finalizarlo con T3" (OBS-11 mergeado en #194).

### Decisiones aprobadas (todas con la recomendación del borrador)

- **PV-T3-1 = A.** El documento "Ajuste" se adelanta a T3, con los motivos de P-5 (`error_captura`, `otro`). Los conteos siguen en T4.
- **PV-T3-2.** La reversión cubre el saldo inicial, la compra, la devolución y el ajuste. Si un saldo inicial se revierte y el artículo no tiene otros movimientos, se puede capturar otro.
- **PV-T3-3.** La devolución a proveedor se añade a la lista de tipos desde T3. Se implementa como devolución parcial de una compra, al costo de esa compra. Elegir entre ENUM o `VARCHAR` con lista cerrada en core es una decisión técnica de senior-fullstack.
- **PV-T3-4.** Los formularios con líneas van en bloques de 10, hasta 50, con el patrón del editor de recetas: "Añadir 10 filas" conserva lo escrito y deja el foco en la primera fila nueva.
- **PV-T3-5.** El saldo inicial exige una cantidad mayor que 0.
- **PV-T3-6.** El importe de compra se captura con hasta 2 decimales. El costo unitario resultante lleva 4.
- **PV-T3-7.** El costo del saldo inicial se precarga con el costo de referencia, si existe, y se puede editar.
- **PV-T3-8.** La reversión exige un motivo en texto libre.
- **PV-T3-9.** Los cambios de proveedores quedan en el historial (`inventory_change`).
- **PV-T3-10.** T3 no usa Stitch: reutiliza el sistema visual del admin y el patrón del editor de recetas (PV-8).
- **PV-T3-11.** La compra no pregunta el criterio de IVA. Se guarda "con IVA" (respuesta 3b de T2) y se muestra en el detalle del documento. Cambiar el criterio será un ticket posterior.
- **PV-T3-12.** OBS-12 de REQ-F-050 entra completo en el PR 3, en sus partes (a), (b) y (c). Si senior-fullstack justifica que la búsqueda sin acentos, la parte (b), exige un cambio de modelo desproporcionado, esa parte pasa a un seguimiento aparte antes del merge a `main`.
- **PV-T3-13.** Numeración:
  - REQ-F-051 es T3. REQ-F-052 y REQ-F-053 siguen reservados para T4 y T5.
  - La épica de Ventas (E2) no reserva ningún rango: cada ticket toma el siguiente número libre al crearse (hoy, REQ-F-055 o mayor). Ningún número se reutiliza.
  - En REQ-F-049 hay que corregir las menciones "REQ-F-054 y siguientes" y "REQ-F-054+" (hoja de ruta, cobertura y partición). REQ-F-054 ya se usó para el seguimiento DEF-007/DEF-008.
- **P-1.** El PR `epic/inventario` → `main` se registra en REQ-F-049, el marco y dueño de D-4. T3 queda `DONE` con sus PR mergeados en la épica.
- **P-2.** El saldo inicial real se captura en pantalla; no se carga desde la hoja (PV-5).
- **P-3.** Se autoriza editar `.claude/rules/git.md` para que la mención de los tickets de la épica (REQ-F-049 a REQ-F-053) diga "y sus seguimientos". Al cerrar T3 se propondrá también actualizar `.claude/CLAUDE.md` §8; esa edición necesita su propia autorización.

## Marco

- Ticket T3 de la épica de inventario. El marco está en REQ-F-049, versión vigente en `epic/inventario`: D-1 a D-4, PV-1 a PV-14, RN-1 a RN-16, glosario, partición y "Plan técnico de T2 a T5".
- Aplican sin reabrirse:
  - DT-1, DT-5, DT-8, DT-9 (con la ampliación de PV-T3-3), DT-13, DT-14 y DT-15;
  - P-1 a P-8;
  - de REQ-F-050: RN-T2-4 (CPP → referencia → "Sin costo"), RN-T2-5, C-1 y C-3.
- Depende de T2 (REQ-F-050) y del seguimiento REQ-F-054, los dos `DONE` en `epic/inventario`.
- Los PR van a `epic/inventario` (`.claude/rules/git.md`).
- No hay diseño del admin en `_stich_source_/`, así que aplica PV-8.

### Contradicciones resueltas al refinar

| # | Conflicto | Resolución |
|---|---|---|
| C-T3-1 | El valor mínimo del marco ("existencias valorizadas") choca con que no habría salidas hasta T4 o E2: las existencias solo subirían y el CPP se volvería obsoleto. | PV-T3-1: el ajuste se adelanta a T3. |
| C-T3-2 | Un saldo inicial erróneo, o una compra registrada antes del saldo inicial, no tenían corrección en T3. El plan remitía al ajuste o al conteo, que son de T4. | PV-T3-1 y PV-T3-2. |
| C-T3-3 | La "Devolución a proveedor" (entrada de T2) no estaba en la lista "completa" de tipos de DT-9. | PV-T3-3. |
| C-T3-4 | El alta, la importación A5 y la semilla no creaban la fila de existencia (observación del QA de T1). | RF-12. |
| C-T3-5 | REQ-F-054 estaba reservado a E2 y ya está usado. | PV-T3-13. |
| C-T3-6 | "Actores" de REQ-F-049 atribuye al Gerente, desde T3, ajustes, conteos y reportes. | En T3: compras, ajustes, correcciones y consultas. Conteos en T4; reportes en T5. |
| C-T3-7 | PV-2 dice "alerta y críticos desde T3", pero los críticos son de T4 (P-6). | En T3 el negativo se permite y se señala en Existencias. Alerta y críticos, en T4. |
| C-T3-8 | El plan crea filas de existencia también para Compuestos, frente a P-1 y C-3. | RN-T3-1. Cómo se guarda lo decide senior-fullstack. |
| C-T3-9 | Selector de IVA en la compra, frente a la respuesta 3b. | PV-T3-11. |
| C-T3-10 | Compra con "cabecera + 15 filas", frente al patrón del editor y el máximo de 50 líneas. | PV-T3-4. |
| C-T3-11 | Importe con 4 decimales, frente a pesos y centavos. | PV-T3-6. |
| C-T3-12 | Saldo inicial con cantidad ≥ 0: ambiguo. | PV-T3-5. |

## Objetivo

Que el Administrador y el Gerente registren en un Kardex inmutable el arranque, las compras y sus correcciones, y que conozcan la existencia, el CPP, el último costo, el valor del inventario y el costo real de las recetas. Es la condición para llevar la épica a `main`.

## Alcance

- Proveedores.
- Saldo inicial.
- Compras con CPP y último costo.
- Reversión de documentos.
- Ajuste (PV-T3-1).
- Devolución a proveedor (PV-T3-3).
- Kardex del artículo, y detalle y lista de documentos.
- Existencias valorizadas.
- Costo real en la ficha del artículo y en las recetas.
- Comando `inventory:verify`.
- Respaldo y restauración de las tablas nuevas.
- Semilla de desarrollo ficticia.
- OBS-12 de REQ-F-050 (PV-T3-12).

## Fuera de alcance

- T4: lotes, mermas, consumo interno, conteos, punto de reorden, alertas, críticos y rol Cocina.
- T5: Kardex filtrable, valorización a una fecha, historial de compras y evolución de precios.
- Ventas (E2). Los tipos `venta` y `devolucion_venta` solo se reservan.
- Cuentas por pagar (E4), CFDI e IVA acreditable.
- Exportación CSV (DT-12) y triggers de inmutabilidad (DT-5).
- Varias monedas, lotes y caducidad.
- Carga masiva del saldo inicial desde la hoja (P-2).
- Cambios en el menú, las landings, la página o el bot (D-2).
- Observaciones de REQ-F-050: OBS-10 (decisión 2 aceptada), OBS-13 (sesiones en memoria, por diseño) y OBS-14 (idempotente).
- OBS-1 a OBS-4 de REQ-F-054.
- El PR `epic/inventario` → `main`, que se registra en REQ-F-049 (P-1).

## Actores

- **Administrador y Gerente:** todo lo de T3, lectura y escritura, incluidas las reversiones (tabla de permisos del plan, §3).
- **Editor y cualquier otro rol:** sin acceso. La API y el admin responden 403 y no se escribe nada.
- **Cocina:** llega en T4; fuera de este ticket.
- **Operador del servidor:** ejecuta `inventory:verify`. No es un rol de la app.

## Requisitos

- **RF-1. Proveedores** (Inventario → Proveedores).
  - Lista con filtro de estado (por defecto, Activos) y búsqueda.
  - Alta y edición:
    - nombre: obligatorio, máximo 80 caracteres, único entre los activos sin distinguir mayúsculas;
    - contacto: opcional, máximo 120 caracteres; un teléfono o un correo, nada más (PV-7).
  - Inactivar y reactivar. Un proveedor inactivo no se ofrece en compras nuevas y sigue visible en la historia.
  - Conflicto de versión como en T1.
  - Historial de cambios (PV-T3-9).
- **RF-2. Saldo inicial.**
  - Documento con fecha del hecho, nota opcional y de 1 a 50 líneas.
  - Cada línea lleva:
    - el artículo;
    - la cantidad, mayor que 0, en unidad del sistema o de empaque (PV-T3-5);
    - el costo unitario por unidad base, mayor o igual que 0 y con 4 decimales. Se precarga con el costo de referencia (PV-T3-7).
  - Solo admite artículos de RN-T3-1 que cumplan RN-T3-8. Si no, el error se marca en la línea.
- **RF-3. Compra.**
  - Cabecera:
    - proveedor activo, opcional ("Sin proveedor");
    - fecha del hecho (RN-T3-3);
    - folio opcional, máximo 40 caracteres;
    - nota opcional, máximo 400 caracteres.
  - El criterio de costo no se pregunta: se guarda "con IVA" y se muestra en el detalle (PV-T3-11).
  - Cada línea lleva:
    - un artículo activo de RN-T3-1: Insumo, Intermedio o Reventa (P-4);
    - la cantidad, mayor que 0, en unidad del sistema o de empaque convertible a la base (RN-3);
    - el importe pagado, mayor o igual que 0, con 2 decimales como máximo (PV-T3-6).
  - El mismo artículo puede ir en varias líneas.
  - Un importe 0 se acepta y el detalle lo señala como "sin cargo".
  - El documento muestra su total.
- **RF-4. Reversión.**
  - Se lanza desde el detalle de un documento no revertido: compra, saldo inicial, devolución o ajuste.
  - Una página de confirmación muestra los movimientos contrarios y avisa si alguna existencia quedaría negativa.
  - Motivo obligatorio, máximo 400 caracteres (PV-T3-8).
- **RF-5. Ajuste** (PV-T3-1).
  - Entrada o salida de uno o varios artículos.
  - Motivo de la lista cerrada de P-5: `error_captura` u `otro`. `otro` exige nota.
  - La salida sale al CPP.
  - La entrada entra al CPP vigente. Si no hay CPP, exige un costo unitario.
- **RF-6. Devolución a proveedor** (PV-T3-3).
  - Se hace desde una compra no revertida.
  - En cada línea se devuelve, como máximo, lo comprado menos lo ya devuelto.
  - Sale al costo de esa compra, y el CPP se calcula como en RN-T3-6.
- **RF-7. Existencias valorizadas** (Inventario → Existencias).
  - Lista de los artículos de RN-T3-1 con:
    - existencia y unidad base;
    - CPP y último costo;
    - valor = existencia × CPP, con 2 decimales;
    - los estados "Negativo" y "Sin costo", con texto.
  - Filtros: búsqueda, categoría, tipo y estado (todos, negativos, sin costo).
  - Totales:
    - valor de las existencias positivas con costo;
    - valor de las negativas, aparte;
    - número de artículos "Sin costo".
  - Paginación de 50.
- **RF-8. Kardex del artículo**, en su ficha.
  - Movimientos del más reciente al más antiguo, paginados de 50.
  - Datos de cada movimiento:
    - fecha y hora de registro, y fecha del hecho, en `BUSINESS_TIMEZONE`;
    - tipo;
    - documento, con enlace;
    - cantidad capturada y cantidad en unidad base, con signo;
    - existencia anterior y nueva;
    - costo unitario;
    - CPP posterior;
    - usuario.
  - Los filtros del Kardex son de T5.
- **RF-9. Documentos.**
  - Detalle:
    - cabecera, líneas y total;
    - autor;
    - estado: "Revertido por #N" o "Reversión de #N";
    - acciones.
  - Lista de documentos, con filtro por tipo y proveedor, del más reciente al más antiguo y paginada.
- **RF-10. Costo real.**
  - La ficha muestra el CPP y el último costo en lugar de "Sin costo".
  - Las recetas usan el CPP según RN-T2-4, y la línea indica el origen "CPP".
- **RF-11. Concurrencia e idempotencia.**
  - Ninguna operación simultánea pierde un movimiento ni calcula mal la existencia (RN-12).
  - Si el sistema está ocupado, aviso "Inténtalo de nuevo" y lo escrito se conserva.
  - El doble envío crea un solo documento, también si la `api` se reinicia entre los dos envíos (DT-14).
- **RF-12. Alta lista para movimientos.** El alta del catálogo, la importación A5 y la semilla dejan cada artículo de RN-T3-1 con existencia 0, listo para recibir movimientos.
- **RF-13. `inventory:verify`.**
  - Comando de solo lectura.
  - Por cada artículo comprueba:
    - que la cadena de movimientos sea contigua;
    - que la existencia anterior de cada movimiento sea la nueva del anterior;
    - que nueva = anterior + cantidad;
    - que la existencia, el CPP y el último movimiento guardados coincidan con la cadena.
  - Sale con 0 si todo cuadra y con otro código si no.
  - Solo informa identificadores y conteos, nunca costos, cantidades ni nombres.
  - Se puede ejecutar en local y en el contenedor `api` de producción, y forma parte del simulacro de restauración.
- **RF-14. Respaldo y restauración.** Las tablas nuevas entran en el respaldo existente. Tras restaurar, el inventario se conserva y `inventory:verify` da 0.
- **RF-15. Semilla de desarrollo.**
  - Proveedores, saldos iniciales y compras ficticias, con CPP, "Sin costo", un negativo y un documento revertido.
  - Nada se carga en producción. Es idempotente.
- **RF-16. Usabilidad.**
  - Mobile-first desde 360 px, con teclado y foco visible.
  - Funciona sin JavaScript.
  - Errores por línea y campo que no dependen solo del color.
  - Patrón de filas del editor de recetas (PV-T3-4).
  - Sistema visual del admin, sin Stitch (PV-8 y PV-T3-10).
- **RF-17. OBS-12** (PV-T3-12). En todas las pantallas de `/inventario/*`, las existentes y las nuevas:
  - (a) sin sesión, redirige al acceso conservando la página de destino. Solo admite rutas internas, sin redirección abierta;
  - (b) la búsqueda ignora mayúsculas y acentos;
  - (c) una página fuera de rango no muestra mensajes contradictorios.

## Historias de usuario

- **HU-1.** Como gerente quiero capturar las existencias con que arranca el negocio, para empezar el Kardex con datos reales.
- **HU-2.** Como gerente quiero registrar una compra por bultos con lo que pagué, para que el sistema calcule el costo por kilo y el CPP.
- **HU-3.** Como administrador quiero revertir una compra mal capturada sin borrar nada, para conservar la trazabilidad.
- **HU-4.** Como gerente quiero ver cuánto vale mi inventario y qué artículos están en negativo o sin costo.
- **HU-5.** Como gerente quiero ver el costo real de mis recetas con el CPP de mis compras.
- **HU-6.** Como gerente quiero corregir con un ajuste justificado una existencia que no cuadra.
- **HU-7.** Como editor no debo ver ni modificar el inventario.

## Reglas de negocio

- **RN-T3-1. Qué artículos tienen existencias.**
  - Solo los Insumos, Intermedios y Reventa, simples o variantes, e inventariables.
  - Nunca un padre, un Compuesto (P-1) ni un no inventariable (C-3).
  - Todo artículo con existencias empieza con existencia 0 y "Sin costo", y puede recibir movimientos desde su alta.
- **RN-T3-2. Documentos y movimientos.**
  - Toda operación es un documento de 1 a 50 líneas, y cada línea es un movimiento.
  - Se registra todo o nada.
  - Cada movimiento guarda lo que pide RN-8, más la cantidad y la unidad tal como se capturaron.
- **RN-T3-3. Orden del Kardex** (DT-8).
  - El orden es el de registro, y el CPP se calcula en ese orden.
  - La fecha del hecho es informativa: hoy o hasta 31 días atrás, nunca futura, en `BUSINESS_TIMEZONE`.
- **RN-T3-4. Costo de compra** (PV-6, respuesta 3b).
  - Es el importe pagado, con IVA.
  - Costo por unidad base = importe / cantidad en unidad base, con 4 decimales y redondeo mitad hacia arriba.
  - Cada compra guarda su criterio. Un cambio futuro de criterio solo afecta a las compras posteriores.
- **RN-T3-5. CPP y último costo** (RN-9).
  - Entrada con costo:
    - si la existencia previa es ≤ 0 o no hay CPP, el CPP pasa a ser el costo de la entrada;
    - si no, se aplica la fórmula de RN-9.
  - El último costo es el de la última compra.
  - Las salidas salen al CPP vigente y no lo cambian. Sin CPP, la salida queda marcada "sin costo".
  - El CPP se conserva aunque la existencia llegue a 0.
- **RN-T3-6. Reversión** (RN-8).
  - Revierte el documento completo, una sola vez, con movimientos contrarios.
  - Revertir una entrada:
    - la salida va al costo con que entró;
    - si q − d > 0, CPP = (q·c − d·k) / (q − d);
    - si no, se conserva el CPP.
  - Revertir una salida: la entrada va al costo con que salió.
  - Una reversión no se puede revertir.
  - El documento original no cambia y muestra "Revertido por #N".
- **RN-T3-7. Negativos** (PV-2). Se permiten y se señalan en Existencias con texto. La alerta y los críticos llegan en T4.
- **RN-T3-8. Saldo inicial.**
  - Solo se admite si el artículo no tiene movimientos vigentes.
  - Un saldo inicial revertido no cuenta (PV-T3-2).
- **RN-T3-9. Inmutabilidad** (DT-5). No existe ninguna operación que edite o borre documentos o movimientos.
- **RN-T3-10. Precisión** (PV-13).
  - Cantidades con 3 decimales, costos unitarios con 4 e importes capturados con 2 como máximo. Los importes se muestran con 2.
  - Punto decimal. La coma se rechaza con un mensaje.
- **RN-T3-11. Bloqueo por uso** (RN-4 y C-3). Un artículo con movimientos no puede cambiar su unidad base, sus factores ni su atributo inventariable.

## Criterios de aceptación

- **CA-1. Compra por empaque.**
  - Given "Masa de maíz" en kg con el empaque "bulto = 25 kg" y existencia 0.
  - When se compran 2 bultos por 1 000.00.
  - Then entran 50.000 kg a 20.0000/kg, la existencia pasa de 0.000 a 50.000, el CPP es 20.0000 y el último costo es 20.0000.
- **CA-2. CPP.**
  - Given 50.000 kg con CPP 20.0000.
  - When se compran 25.000 kg por 600.00.
  - Then el CPP es 21.3333 y el último costo es 24.0000.
- **CA-3. Existencia ≤ 0.**
  - Given una existencia de −2.000 kg con CPP 21.3333.
  - When se compran 10.000 kg por 250.00.
  - Then la existencia es 8.000 y el CPP es 25.0000.
- **CA-4. Redondeo mitad hacia arriba.**
  - 3 pza por 10.00 dan 3.3333/pza.
  - 3 pza por 20.00 dan 6.6667/pza.
  - Una coma decimal o decimales de más se rechazan con un mensaje.
- **CA-5. Saldo inicial.**
  - Given un artículo sin movimientos.
  - When se registran 12.500 kg a 18.5000.
  - Then la existencia es 12.500, el CPP es 18.5000 y el Kardex muestra un movimiento "Saldo inicial".
  - Un segundo saldo inicial se rechaza con un mensaje que sugiere un ajuste.
  - En un artículo con una compra, el saldo inicial también se rechaza.
- **CA-6. Reversión de compra.**
  - Given el estado de CA-2: 75.000 kg con CPP 21.3333.
  - When se revierte la compra de 25.000 kg a 24.0000.
  - Then la existencia es 50.000 y el CPP es 20.0000.
  - La compra original no cambia y muestra "Revertido por #N".
  - Una segunda reversión responde 409.
  - Una reversión no ofrece "Revertir".
- **CA-7. Reversión con negativo.**
  - Revertir una entrada ya consumida deja la existencia negativa, señalada como "Negativo".
  - Con una existencia resultante ≤ 0, se conserva el CPP.
- **CA-8. Saldo inicial revertido.** Tras revertirlo, si el artículo no tiene otros movimientos, admite un saldo inicial nuevo.
- **CA-9. Artículos y proveedores no admitidos.**
  - Una línea con un Compuesto, un padre, un artículo no inventariable o uno inactivo se rechaza en esa línea, y no se escribe nada del documento.
  - Un proveedor inactivo no se ofrece y, si se envía, se rechaza.
- **CA-10. Conversión.**
  - Una cantidad en pza de un artículo en kg sin factor de conversión se rechaza en la línea.
  - Una cantidad que redondea a 0 en la unidad base también se rechaza.
- **CA-11. Fecha del hecho.**
  - Se aceptan hoy y hoy − 31 días.
  - Se rechazan mañana y hoy − 32 días.
  - "Hoy" se calcula en `BUSINESS_TIMEZONE`: a las 23:30 y a las 00:30 locales da el día local, sin importar la zona del servidor.
- **CA-12. Doble envío.** El mismo formulario enviado dos veces crea un solo documento, también si la `api` se reinicia entre los dos envíos.
- **CA-13. Concurrencia.**
  - 20 operaciones simultáneas sobre un artículo dejan 20 movimientos contiguos y la existencia exacta.
  - Dos documentos simultáneos con artículos cruzados terminan sin errores visibles.
  - `inventory:verify` da 0.
- **CA-14. Sistema ocupado.** Si se agota la espera, el usuario ve "Inténtalo de nuevo", lo escrito se conserva y no se escribe nada a medias.
- **CA-15. Inmutabilidad.**
  - Ninguna ruta ni pantalla edita o borra documentos o movimientos.
  - Con una fila alterada a mano, `inventory:verify` termina con un código distinto de 0, sin imprimir costos, cantidades ni nombres.
- **CA-16. Existencias.**
  - La pantalla muestra las columnas y los totales de RF-7.
  - No aparecen Compuestos, padres ni artículos no inventariables.
  - Ejemplo: 50.000 kg a 20.0000 valen 1 000.00.
- **CA-17. Kardex en la ficha.** Muestra los movimientos de RF-8 del más reciente al más antiguo, paginados y con enlace al documento.
- **CA-18. Costo real.**
  - Given un ingrediente con costo de referencia 30.0000 y una compra a 20.0000/kg.
  - Then su línea de 0.500 kg cuesta 10.00 con origen "CPP", y la receta que lo usa cambia de costo sin crear una versión nueva.
  - La ficha muestra el CPP y el último costo.
- **CA-19. Bloqueo por uso.** En un artículo con movimientos y sin recetas, cambiar la unidad base, los factores o el atributo inventariable se rechaza con un mensaje.
- **CA-20. Alta lista para movimientos.** Un artículo recién creado, importado con el fixture A5 ficticio o sembrado admite una compra al instante.
- **CA-21. Permisos.**
  - El Editor recibe 403 en todas las rutas de T3 de la API y del admin, sin escritura, y no ve las secciones.
  - Sin sesión, la API responde 401 y el admin redirige al acceso.
  - El Administrador y el Gerente acceden a todo.
  - Sin un CSRF válido, toda escritura responde 403.
- **CA-22. Proveedores.**
  - Un nombre repetido entre los activos (sin distinguir mayúsculas) se rechaza.
  - Reactivar un proveedor cuyo nombre ya está en uso se rechaza.
  - En un conflicto de versión, el segundo usuario recibe un aviso.
- **CA-23. Respaldo.** Un respaldo restaurado conserva proveedores, documentos, movimientos y existencias, y `inventory:verify` da 0.
- **CA-24. Vuelta atrás.** La imagen de `main` y la de T2 arrancan y funcionan sobre la base con la migración de T3 y `DATABASE_ALLOW_NEWER_SCHEMA`.
- **CA-25. Pantallas.**
  - Se pueden usar a 360 px y en escritorio, solo con teclado, con foco visible y sin JavaScript.
  - "Añadir 10 filas" deja el foco en la primera fila nueva.
- **CA-26. Regresión.** Las landings, el bot, el menú, las pantallas de productos y página, T1 y T2 funcionan igual que antes.
- **CA-27. Privacidad.**
  - Los logs no registran costos, cantidades, nombres de artículos ni datos de contacto de proveedores.
  - Ningún dato real entra al repositorio: `check-private-data` sigue en verde.
- **CA-28. Semilla.**
  - En desarrollo aparecen los datos de RF-15.
  - Una instalación de producción arranca sin proveedores, documentos ni existencias.
- **CA-29. Ajuste.**
  - Given 10.000 kg con CPP 20.0000.
  - When se registra una salida de 2.000 kg con motivo "error de captura".
  - Then la existencia es 8.000 y la salida sale a 20.0000.
  - El motivo "otro" sin nota se rechaza.
  - Una entrada sin CPP ni costo unitario se rechaza.
- **CA-30. Devolución.**
  - Devolver 5.000 de una línea de 25.000 sale al costo de esa compra.
  - Devolver más de lo que queda por devolver se rechaza.
- **CA-31. OBS-12.**
  - Sin sesión, `/inventario/existencias` vuelve a esa misma página tras iniciar sesión, y un destino externo se ignora.
  - Buscar "cárne" encuentra "Carne". Si esta parte pasa a un seguimiento (PV-T3-12), el criterio se traslada con ella.
  - Una página fuera de rango no dice a la vez "N resultados" y "No hay resultados".

## Casos límite

- Un artículo se inactiva o pasa a no inventariable mientras alguien llena el formulario: al guardar, error en la línea.
- Una cantidad o un importe superan los límites de precisión, o la existencia acumulada se desborda: se rechaza con un mensaje en el campo.
- Revertir con el artículo o el proveedor ya inactivos: se permite, porque la corrección siempre debe ser posible.
- Dos reversiones simultáneas del mismo documento: una se aplica y la otra responde 409.
- Una compra registrada antes del saldo inicial: se corrige con un ajuste.
- Un importe 0, un factor de empaque decimal o una salida sin CPP.
- Medianoche en `BUSINESS_TIMEZONE` para la fecha del hecho.
- El botón atrás tras guardar (respuesta 303), el doble envío, y la `api` caída sin perder lo escrito.
- Cambiar el atributo inventariable antes y después del primer movimiento.
- Un Intermedio con receta vigente y compras se costea por su receta (DT-7). Su CPP se muestra en la ficha y en Existencias.

## Dependencias

- REQ-F-050 (T2) y REQ-F-054 en `epic/inventario`.
- El plan técnico de T2 a T5 de REQ-F-049.
- Las entradas de T2 para T3: C-3, la devolución a proveedor y la semilla ficticia.
- REQ-F-019 (respaldos).
- El servicio `migrate`.
- `check-private-data` (T2).

## Riesgos

- Interbloqueos y el pool de 5 conexiones (DT-13). Mitigación: documentos de 50 líneas como máximo.
- La precisión del CPP en las reversiones y las devoluciones.
- Que la lista de tipos de movimiento no alcance para E2 (PV-T3-3; decisión técnica sobre ENUM o `VARCHAR`).
- Un Kardex alterado a mano (DT-5). Mitigación: `inventory:verify`.
- La divergencia de la rama `epic/inventario`.
- Archivos de prueba que pasen de 20 s (OBS-7 de T2).

## Action Plan

### Objetivo

Un Kardex inmutable con compras, CPP, correcciones y existencias valorizadas, que el Gerente pueda usar y que deje la épica lista para llevarla a `main`.

### Alcance

RF-1 a RF-17.

### Fuera de alcance

Ver "Fuera de alcance".

### Cambios requeridos (DT-1: 3 PR hacia `epic/inventario`)

1. **PR 1 (modelo, dominio y persistencia).**
   - Migración aditiva `inventario_kardex`: proveedores, documentos, movimientos y existencias, más la lista de tipos (PV-T3-3).
   - Dominio: CPP, saldo, reversión, ajuste y devolución.
   - Stores en memoria y Prisma, con bloqueo ordenado.
   - `hasMovements` e `isInUse` con movimientos.
   - Fila de existencia en el alta, en la importación A5 y en la semilla.
   - `inventory:verify`.
   - Pruebas funcionales: unitarias y en MySQL, incluidas la concurrencia y la cadena saldo inicial → compra → costo real de la receta.
2. **PR 2 (API).**
   - Contratos y rutas de:
     - proveedores;
     - documentos: saldo inicial, compra, reversión, ajuste, devolución, detalle y lista;
     - existencias;
     - Kardex del artículo.
   - Cliente HTTP y semilla ficticia.
   - `inventory:verify` dentro de la imagen `api`.
   - Pruebas de API.
   - Si el PR pasa de unas 1 500 líneas, se parte en 2a y 2b.
3. **PR 3 (pantallas).**
   - Proveedores, Existencias, Compra, Saldo inicial, Ajuste y Devolución.
   - Lista y detalle de documentos, con "Revertir".
   - Kardex en la ficha.
   - Costo real en la ficha y en las recetas.
   - OBS-12.
   - Documentación y pruebas del admin.

### Reglas de negocio

RN-T3-1 a RN-T3-11, más RN-8, RN-9, RN-12 a RN-14, PV-2, PV-5 a PV-7 y PV-13.

### UX/UI

- Sistema visual del admin, sin Stitch.
- Patrón de filas del editor de recetas.
- Mobile-first y funcionamiento sin JavaScript.
- Tablas con `caption`.
- Estados con texto, no solo con color.

### Integraciones

Ninguna externa: `inventory-manager` → `api` → MySQL.

### Casos límite

Ver "Casos límite".

### Criterios de aceptación

CA-1 a CA-31.

### Dependencias

Ver "Dependencias".

### Riesgos

Ver "Riesgos".

### Documentación

- `restaurante/docs/arquitectura.md`: Kardex, CPP, concurrencia e inmutabilidad.
- `restaurante/docs/despliegue.md`:
  - §5: el orden de arranque en producción tras el merge a `main` (desplegar → importación A5 por PT-5 → saldo inicial en pantalla → compras);
  - §6: la migración no requiere pasos de vuelta atrás;
  - §9 y §11.1: las tablas del Kardex;
  - §11.8: `inventory:verify` en el simulacro.
- `restaurante/README.md`: `inventory:verify` y la semilla ampliada.
- `.claude/rules/git.md`: añadir "y sus seguimientos" a la mención de los tickets de la épica. La edición está autorizada (P-3) y la hace senior-fullstack.
- REQ-F-049: corregir la numeración de E2 (PV-T3-13) y registrar el PR de la épica hacia `main` (P-1). Lo hace senior-fullstack, porque REQ-F-049 está en `in-progress/`.
- Propuesta de actualizar `.claude/CLAUDE.md` §8 al cerrar T3. Requiere autorización expresa.

### Impacto en despliegue, respaldos y CI

- **Despliegue:** sin contenedores nuevos y sin cambios en `deploy/`.
  - La suma de `deploy/` no cambia.
  - La migración es aditiva y solo la aplica `migrate`.
  - La vuelta atrás a la imagen de `main` no lee el inventario.
- **Respaldos:** `mysqldump --databases` ya incluye las tablas nuevas.
  - En el simulacro, `inventory:verify` hace las veces de ampliar el manifiesto.
  - El simulacro `--drill` lo ejecuta el usuario después de desplegar la épica.
- **CI:** los PR de T3 hacia `epic/inventario` se validan sin humo, sin publicar y sin desplegar. El PR de la épica hacia `main` corre el CI completo.
- **Datos reales:** proveedores, costos y existencias reales solo se capturan en producción. Nunca van en semillas, pruebas, tickets ni Stitch.

### Orden recomendado

1. PR 1, PR 2 y PR 3, en ese orden. Cada uno sale de la punta de `epic/inventario`.
2. Después, el PR de la épica hacia `main`, que se registra en REQ-F-049.

### Resultado esperado

En `epic/inventario`:

- El Gerente arranca el inventario, registra compras y sus correcciones, y ve las existencias valorizadas y los costos reales.
- `inventory:verify` cuadra en una base restaurada.

## Trazabilidad

| Objetivo | Requisito | Historia | Criterios | PR |
|---|---|---|---|---|
| Arranque | RF-2, RN-T3-8 | HU-1 | CA-5, CA-8 | 1–3 |
| Compras y CPP | RF-3, RN-T3-4, RN-T3-5 | HU-2 | CA-1 a CA-4, CA-9 a CA-11 | 1–3 |
| Correcciones | RF-4 a RF-6, RN-T3-6, RN-T3-7 | HU-3, HU-6 | CA-6, CA-7, CA-29, CA-30 | 1–3 |
| Valor del inventario | RF-7, RF-8, RF-10 | HU-4, HU-5 | CA-16 a CA-18 | 2–3 |
| Integridad | RF-11 a RF-13, RN-T3-9, RN-T3-11 | — | CA-12 a CA-15, CA-19, CA-20 | 1–2 |
| Proveedores | RF-1 | — | CA-22 | 1–3 |
| Acceso y privacidad | Actores, RF-17 | HU-7 | CA-21, CA-27, CA-31 | 2–3 |
| Operación | RF-14, RF-15 | — | CA-23, CA-24, CA-28 | 1–3 |
| UX | RF-16 | — | CA-25, CA-26 | 3 |

PR de T3: PR 1b #196 (https://github.com/orvigas/negocio/pull/196; Kardex, CPP, correcciones, existencias, costo real e `inventory:verify`). PR 1a #195 (https://github.com/orvigas/negocio/pull/195), que cubre la parte de modelo, proveedores y existencias de Integridad, Proveedores, Acceso y Operación.

No hay diseño en `_stich_source_/` (PV-8).

## Technical Action Plan

Autor: senior-fullstack, 2026-11-25. En esta fase solo se editó este ticket; no se tocó código.

**Fuentes.**

- Código real de la épica en `origin/epic/inventario` (`ad50c50`, tras #194). Se leyó en un worktree temporal de solo lectura, ya borrado: `schema.prisma` y las migraciones, `packages/core/inventory/*`, `packages/db/src/prisma-inventory-store.ts`, `api/src/admin/{access,inventory-*}.ts`, `api/scripts/*`, `inventory-manager/src/{session.ts,controllers/*}`, `landing-pages/Dockerfile`, `ops/backup/*`, `deploy/deploy.sh` y `docs/despliegue.md`.
- REQ-F-049 (marco, plan técnico de T2 a T5 y DT-1 a DT-15), REQ-F-050 y REQ-F-054, en su versión de `epic/inventario`.
- CodeGraph indexa `main`, no la épica. Como el código afectado solo existe en la épica, se leyó con Read y Grep dirigidos sobre el worktree.
- NotebookLM: sus herramientas no están disponibles en esta sesión, así que no se consultó.
- `main` está integrado en la épica: `git log origin/epic/inventario..origin/main` sale vacío.

### Objetivo técnico

Añadir a `core/inventory`:

- el Kardex inmutable: documentos y movimientos, con una cadena contigua por artículo;
- la proyección de existencias (cantidad, CPP, último costo y último `seq`);
- proveedores;
- las operaciones saldo inicial, compra, ajuste, devolución a proveedor y reversión, calculadas con `bigint` exacto;
- un verificador puro de la cadena.

Todo eso se persiste con la migración aditiva `inventario_kardex`. Las escrituras usan `ReadCommitted` con bloqueo ordenado por fila (DT-13) y una idempotencia persistente (DT-14). Se exponen en la `api` y en el admin, se conectan con el costo real de las recetas (RN-T2-4) y se entrega `inventory:verify`.

### Hechos del repositorio que condicionan el plan

| # | Hecho (código de la épica) | Consecuencia |
|---|---|---|
| H-1 | `InventoryStore` es un único contrato (lector, tx, `transaction` serializable y `recipeTransaction` READ COMMITTED). Lo implementan la memoria y Prisma (`prisma-inventory-store.ts`, 463 líneas). | Se amplía el mismo contrato con `kardexTransaction` y los métodos del Kardex. La implementación Prisma del Kardex va en un archivo propio (`prisma-kardex.ts`) que `txOn` compone, para no inflar el actual. |
| H-2 | `hasMovements` devuelve `false` (`prisma-inventory-store.ts:276`). `isInUse` solo mira recetas. `updateItem` ya rechaza el cambio de `inventoriable` si `hasMovements`, y el de unidad o empaques si `isInUse` (RN-4). | T3 implementa los dos (`last_seq > 0`). La regla ya está cableada; falta el bloqueo de la fila de existencia para la carrera (ver Concurrencia). |
| H-3 | `run()` ya convierte el 1205 en `InventoryBusyError` (503 `INVENTORY_BUSY`), reintenta el 1213/P2034 hasta 3 veces y pasa el resto a `DatabaseUnavailableError`. | El Kardex reutiliza `run()`. |
| H-4 | El ENUM de MySQL hace que una imagen anterior falle al leer un valor nuevo (C-2 de T2). Los motivos ya se decidieron en `VARCHAR` (DT-15). | Base de DT-T3-1. |
| H-5 | La búsqueda del catálogo es `nameKey contains` (minúsculas, distingue acentos). La lista de recetas filtra en memoria. La colación de la base es `utf8mb4_es_0900_as_cs`. | OBS-12 (b) sin cambio de modelo (ver Frontend y DT-T3-2). |
| H-6 | `sanitizeNext` (`inventory-manager/src/session.ts`) solo acepta una lista de rutas (`RETURN_PATTERNS`) que no incluye `/inventario/*`. Los controladores ya pasan `returnTo`. | OBS-12 (a): añadir los patrones de `/inventario/*` y pasar `ctx.path` con la consulta. |
| H-7 | La imagen `api` copia `admin-recover.ts`, `hash-password.ts`, `inventory-import.ts` y `scripts/support/` (`landing-pages/Dockerfile:163`). | `inventory-verify.ts` se añade a esa línea `COPY`. |
| H-8 | El manifiesto del respaldo (`ops/backup/backup.sh`) guarda `app_image` y `migrate_image`, pero no la imagen `api`. El simulacro (`verify-backup.sh --drill`) arranca solo la app, sobre un MySQL efímero sin puertos que borra al terminar. `ops/` no entra en la suma de `deploy/`. | Hoy no se puede ejecutar `inventory:verify` en el simulacro: ver DT-T3-6. |
| H-9 | La semilla de desarrollo pasa por los repositorios y ya trae "Masa de maíz" en kg con "bulto = 25" (el mismo ejemplo que CA-1). Es idempotente: "si ya hay artículos, no hace nada". | La parte de T3 de la semilla lleva su propia comprobación ("si no hay proveedores ni documentos"), para que funcione sobre bases ya sembradas con T2. |
| H-10 | `api/src/config.ts` ya valida `BUSINESS_TIMEZONE`. `core/shared/datetime.ts` tiene `formatToParts` por zona. | La fecha del hecho se calcula en core con `Intl`, sin dependencias. |
| H-11 | El cliente Prisma no fija la zona horaria del adaptador `mariadb`. | Una columna `DATE` puede desplazarse por la zona del proceso. Se prueba la ida y vuelta en MySQL con `TZ` distinta de UTC (ver Riesgos). |

### Decisión DT-T3-1: tipos de movimiento en `VARCHAR` con lista cerrada en core (PV-T3-3)

**Decisión técnica (delegada en PV-T3-3):** `type VARCHAR(24)` en `inventory_document` y en `inventory_movement`, con la lista cerrada en `core/inventory/kardex-schema.ts`. `cost_basis` también va en `VARCHAR(16)`, con la lista `con_iva` y `sin_iva`.

| Criterio | ENUM ampliado | `VARCHAR` con lista en core (elegido) |
|---|---|---|
| Vuelta atrás a una imagen anterior que lee una fila con un tipo que no conoce | Prisma lanza al leer el ENUM: el Kardex, el detalle y la lista responden 503. Por eso DT-9 obligaba a fijar hoy la lista completa. | Prisma devuelve el texto. Core lo muestra como "Movimiento (tipo no reconocido)" y no rompe la lectura. |
| Un tipo nuevo en E2 (riesgo del ticket: "que la lista no alcance") | `ALTER … MODIFY ENUM`: un valor al final es INSTANT, pero cualquier imagen anterior sigue rompiendo | Sin DDL: solo cambian core y los contratos |
| Integridad en la base | La base rechaza un valor desconocido | La valida core, que es el único escritor (DT-5: dominio + lint). `inventory:verify` cuenta los tipos desconocidos. |
| Coherencia | — | La misma solución que los motivos (DT-15) |
| Coste | 1 byte | ~12 bytes por fila. Con miles de movimientos al mes, es despreciable. |

- DT-9 se cumple en su objetivo (vuelta atrás segura y tipos de E2 previstos) y mejora: ya no depende de acertar hoy con la lista completa.
- **Lista de core (11 valores):**
  - se escriben en T3: `saldo_inicial`, `compra`, `devolucion_proveedor`, `ajuste` y `reversion`;
  - reservados, que nadie escribe todavía: `merma`, `consumo_interno`, `produccion` y `conteo` (T4), y `venta` y `devolucion_venta` (E2).
- No se añade `CHECK` en la base: Prisma no lo modela, y ampliarlo exigiría reescribir la restricción validando la tabla entera.

### Decisión DT-T3-2: dónde viven las existencias (C-T3-8, RF-12)

**Decisión técnica (C-T3-8 la delega):**

- **Una fila por artículo.** Hay una fila de `inventory_stock` por cada artículo que no es padre, también Compuestos y no inventariables. Las altas no tienen ramas, y un cambio de `inventoriable` (permitido sin movimientos) no crea ni borra filas.
- **RN-T3-1 decide lo demás.** Qué se muestra en Existencias y qué admite movimientos lo decide RN-T3-1, en core y en las consultas. La fila de un Compuesto queda en 0, nunca se mueve y nunca se muestra.
- **Altas.** `store.insertItem` crea la fila en la misma transacción. Así la cubren el alta, la importación A5 y la semilla (RF-12), que ya pasan por `insertItem`. La migración crea las filas de los artículos existentes.
- **Defensa.** Si al bloquear falta una fila, se crea en esa transacción y se vuelve a bloquear. Puede faltar si el artículo lo creó una imagen de T2 durante una vuelta atrás (CA-24), o tras el `TRUNCATE` de las pruebas. `inventory:verify` trata una fila ausente sin movimientos como existencia 0 y "Sin costo".

### Archivos o componentes afectados

- **PR 1 (modelo, dominio y persistencia):**
  - `packages/db/prisma/schema.prisma` y la migración `packages/db/prisma/migrations/<ts>_inventario_kardex/migration.sql` (nueva, con la colación revisada a mano y el relleno de existencias);
  - en `packages/core/inventory`, se modifican `{inventory-store,inventory-repository,memory-inventory-store,errors,text,index}.ts` y son nuevos `{kardex-schema,kardex-math,kardex-repository,supplier-schema,supplier-repository,kardex-verify,business-date}.ts`;
  - `packages/core/inventory/recipe-repository.ts`: CPP en el `CostCatalog` (RF-10);
  - `packages/db/src/prisma-inventory-store.ts`, que se modifica, y `packages/db/src/prisma-kardex.ts`, nuevo;
  - `api/scripts/inventory-verify.ts` y `api/scripts/support/inventory-verify-cli.ts`, nuevos; el script en el `package.json` de `api` y en el de la raíz;
  - `restaurante/eslint.config.ts`: la regla de inmutabilidad (DT-5).
- **PR 2 (API, semilla e imagen):**
  - `packages/contracts/inventory-kardex.ts` (nuevo), `inventory.ts` (existencia en la ficha) y `admin-client.ts`;
  - `api/src/admin/inventory-kardex-routes.ts` e `inventory-supplier-routes.ts` (nuevos), `router.ts` e `inventory-routes.ts` (ficha);
  - `api/scripts/support/inventory-dev-seed.ts`;
  - `landing-pages/Dockerfile` (una línea `COPY`).
- **PR 3 (pantallas, OBS-12 y documentación):**
  - `inventory-manager/src/controllers/{inventory-suppliers,inventory-documents,inventory-stock}.ts` (nuevos), `inventory.ts` (Kardex y costo en la ficha), `inventory-common.ts` (bloques de filas compartidos y paginación fuera de rango), `inventory-recipes.ts` (origen "CPP") y `routes.ts`;
  - `inventory-manager/src/session.ts` (`RETURN_PATTERNS`);
  - vistas nuevas `views/pages/inventory-{suppliers,supplier-form,stock,documents,document,purchase-form,initial-balance-form,adjustment-form,return-form,reversal}.html`, con sus parciales `inventory-document-*`, `inventory-kardex-*` e `inventory-stock-*`;
  - `inventory-section.html` (subnavegación);
  - `ops/backup/*`, solo si se aprueba DT-T3-6 A;
  - la documentación (ver Documentación).

### Modelo de datos y migración `inventario_kardex` (PR 1)

DDL aproximado. Prisma lo genera con `migrate dev --create-only`, se revisa a mano la colación de cada `CREATE TABLE` y se añade a mano el relleno.

```sql
CREATE TABLE `inventory_supplier` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(80) NOT NULL,
  `name_key` VARCHAR(160) NOT NULL,
  `active_name_key` VARCHAR(160) NULL,          -- = name_key si está activo; único (RF-1)
  `contact` VARCHAR(120) NULL,                  -- PV-7: un teléfono o un correo
  `active` BOOLEAN NOT NULL DEFAULT true,
  `version` INTEGER NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL, `updated_at` DATETIME(3) NOT NULL,
  `updated_by_id` INTEGER NULL, `updated_by_name` VARCHAR(60) NULL,   -- aviso de conflicto, como el artículo
  UNIQUE INDEX `inventory_supplier_active_name_key_key`(`active_name_key`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;

CREATE TABLE `inventory_stock` (                -- proyección mutable del Kardex
  `item_id` INTEGER NOT NULL,
  `quantity` DECIMAL(13,3) NOT NULL DEFAULT 0,  -- con signo (PV-2)
  `avg_cost` DECIMAL(15,4) NULL,                -- CPP; null = sin costo
  `last_cost` DECIMAL(15,4) NULL,               -- último costo de compra (DT-T3-4)
  `last_seq` INTEGER NOT NULL DEFAULT 0,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;

CREATE TABLE `inventory_document` (             -- cabecera, inmutable
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `type` VARCHAR(24) NOT NULL,                  -- DT-T3-1
  `occurred_on` DATE NOT NULL,                  -- fecha del hecho (RN-T3-3)
  `recorded_at` DATETIME(3) NOT NULL,
  `supplier_id` INTEGER NULL,
  `reference` VARCHAR(40) NULL,                 -- folio
  `cost_basis` VARCHAR(16) NULL,                -- compras: 'con_iva' (PV-T3-11)
  `reason` VARCHAR(32) NULL,                    -- ajuste: 'error_captura' | 'otro' (DT-15)
  `note` VARCHAR(400) NULL,                     -- nota; en la reversión, el motivo obligatorio (PV-T3-8)
  `total_cost` DECIMAL(19,4) NOT NULL,
  `reverses_document_id` INTEGER NULL,          -- único: una reversión por documento
  `source_document_id` INTEGER NULL,            -- devolución -> su compra
  `idempotency_key` VARCHAR(120) NULL,          -- `<actorId>:<tipo>:<requestId>` (DT-14)
  `request_hash` CHAR(64) NULL,                 -- sha256 del cuerpo canónico
  `actor_id` INTEGER NULL, `actor_name` VARCHAR(60) NOT NULL,
  UNIQUE INDEX `inventory_document_reverses_document_id_key`(`reverses_document_id`),
  UNIQUE INDEX `inventory_document_idempotency_key_key`(`idempotency_key`),
  INDEX `inventory_document_type_id_idx`(`type`, `id`),
  INDEX `inventory_document_supplier_id_id_idx`(`supplier_id`, `id`),
  INDEX `inventory_document_source_document_id_idx`(`source_document_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;

CREATE TABLE `inventory_movement` (             -- Kardex: solo altas (RN-T3-9)
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `document_id` INTEGER NOT NULL,
  `line` INTEGER NOT NULL,                      -- 1..50 dentro del documento
  `item_id` INTEGER NOT NULL,
  `seq` INTEGER NOT NULL,                       -- 1, 2, 3… por artículo, sin huecos
  `type` VARCHAR(24) NOT NULL,
  `quantity` DECIMAL(13,3) NOT NULL,            -- en unidad base, con signo, ≠ 0
  `entered_quantity` DECIMAL(13,3) NOT NULL,    -- tal como se capturó (positiva)
  `entered_unit` VARCHAR(30) NOT NULL,
  `balance_before` DECIMAL(13,3) NOT NULL, `balance_after` DECIMAL(13,3) NOT NULL,
  `unit_cost` DECIMAL(15,4) NULL,               -- null: salida o entrada sin costo
  `line_total` DECIMAL(19,4) NULL,              -- compra: importe capturado; resto: |cantidad| × costo
  `avg_cost_before` DECIMAL(15,4) NULL, `avg_cost_after` DECIMAL(15,4) NULL,
  `source_movement_id` INTEGER NULL,            -- reversión -> movimiento original; devolución -> línea de compra
  `recorded_at` DATETIME(3) NOT NULL,
  `actor_id` INTEGER NULL, `actor_name` VARCHAR(60) NOT NULL,
  UNIQUE INDEX `inventory_movement_item_id_seq_key`(`item_id`, `seq`),
  UNIQUE INDEX `inventory_movement_document_id_line_key`(`document_id`, `line`),
  INDEX `inventory_movement_source_movement_id_idx`(`source_movement_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;

-- FK ON DELETE RESTRICT: stock.item_id y movement.item_id -> inventory_item; movement.document_id ->
-- document; movement.source_movement_id -> movement; document.supplier_id -> supplier;
-- document.reverses_document_id y source_document_id -> document; actor_id y updated_by_id -> user.

-- Relleno (escrito a mano; restaurante_migrator tiene INSERT). En producción no hay artículos
-- hasta la importación A5, así que no inserta nada.
INSERT INTO `inventory_stock` (`item_id`, `updated_at`)
  SELECT `id`, CURRENT_TIMESTAMP(3) FROM `inventory_item` WHERE `kind` <> 'parent';
```

**Diferencias con el plan aprobado (§2.2 de REQ-F-049), todas aditivas:**

- `VARCHAR` en lugar de ENUM (DT-T3-1).
- `line`, `source_document_id`, `source_movement_id` y `request_hash` son nuevos. Los piden la devolución parcial (RF-6), la reversión al costo con que entró cada línea (RN-T3-6) y la idempotencia que distingue un reenvío de un abuso de la clave.
- `updated_by_*` en el proveedor, para el aviso de conflicto (RF-1), como en el artículo.
- Los índices `(type, recorded_at)` e `(item_id, recorded_at)` del Kardex quedan para la migración de T5, que el plan ya reservaba "solo para índices". T3 pagina por `(item_id, seq)` y por `id`.

**Más detalles de la migración:**

- **Bloqueos.** Solo crea tablas e inserta filas en una tabla nueva: no bloquea nada existente.
- **Vuelta atrás automática** (CA-24): la imagen de `main` no lee el inventario. La de T2 ignora las tablas nuevas, aunque sus altas no crean la fila de existencia (cubierto por DT-T3-2) y no bloquea los cambios de unidad de un artículo con movimientos, porque su `hasMovements` es `false`. Esto solo pasa en desarrollo: producción nunca corre la imagen de T2, porque la épica llega a `main` con T3. Se anota en el README.
- **Respaldo:** `mysqldump --databases` incluye las tablas nuevas.

### Dominio (`packages/core/inventory`, PR 1)

- **`kardex-schema.ts`:**
  - `MOVEMENT_TYPES` (DT-T3-1), `COST_BASES`, `ADJUSTMENT_REASONS = ['error_captura', 'otro']` y los tipos `KardexDocument`, `KardexMovement`, `StockRow` y `Supplier`;
  - la validación de las entradas, por campo y línea (`lines.N.item`, `lines.N.quantity`, `lines.N.unit`, `lines.N.amount`, `lines.N.unitCost` y `lines.N.direction`):
    - de 1 a 50 líneas;
    - cantidades con `parseDecimal` (escala 3, > 0; la coma se rechaza con su mensaje, RN-T3-10);
    - importe con escala 2 y ≥ 0 (PV-T3-6);
    - costo unitario con escala 4 y ≥ 0;
    - folio de 40 como máximo y nota de 400 como máximo (`readOptionalText`);
    - fecha `AAAA-MM-DD` válida.
  - El mismo artículo puede ir en varias líneas de una compra (RF-3).
- **`business-date.ts`:**
  - `businessDate(now, timeZone)`: `AAAA-MM-DD` con `Intl.DateTimeFormat#formatToParts`;
  - `isAllowedOccurredOn(date, today)`: entre hoy − 31 y hoy, nunca futura (RN-T3-3, CA-11).
  - Se prueba a las 23:30 y a las 00:30 locales con `vi.setSystemTime`, sin depender de la zona del servidor.
- **`kardex-math.ts`** (funciones puras, `bigint`, solo con `divideRounded` y `multiplyDecimals`; mitad hacia arriba):
  - `purchaseUnitCost(importe₂, base₃) = divideRounded(importe × 10⁵, base)` da escala 4. CA-1 da 20.0000, y CA-4 da 3.3333 y 6.6667.
  - `applyEntry(q, c, d, k)`:
    - si k es null, el CPP no cambia (la reversión de una salida sin costo);
    - si q ≤ 0 o c es null, c' = k;
    - si no, `c' = divideRounded(q·c + d·k, q + d)`.
    - Compra CA-2: 21.3333. Existencia negativa CA-3: 25.0000.
  - `applyExit(q, c, d)`: sale a c (o sin costo si c es null), y el CPP no cambia.
  - `applyEntryReversal(q, c, d, k)`: sale a k; si `q − d > 0`, `c' = divideRounded(q·c − d·k, q − d)`; si no, se conserva c (RN-T3-6). La devolución usa la misma función.
    - CA-6: (75·21.3333 − 25·24) / 50 = 19.99995, que redondea a **20.0000**. CA-6 depende justo del redondeo mitad hacia arriba, y la prueba lo fija.
  - `lineValue(qty₃, cost₄)`: escala 4, para el total del documento.
  - `stockValue(q₃, c₄)`: escala 2, el valor de una fila de Existencias.
  - `checkRange(balance)`: rechaza un saldo fuera de DECIMAL(13,3) (caso límite de desbordamiento).
- **`kardex-repository.ts`** (`createKardexRepository({ store, now, timeZone })`):
  - **Escrituras:** `createInitialBalance`, `createPurchase`, `createAdjustment`, `createSupplierReturn(purchaseId, …)` y `reverseDocument(id, { reason })`. Cada una:
    1. valida en el borde (sin tocar la base);
    2. abre `store.kardexTransaction`;
    3. comprueba la idempotencia;
    4. bloquea (ver Concurrencia);
    5. lee los artículos **después** de bloquear y aplica RN-T3-1 (activo, tipo, no padre e inventariable) y la conversión con `convertToBase`. Sin factor, error en la línea; si redondea a 0, también (CA-10);
    6. calcula línea a línea, en orden. Si el mismo artículo va en varias líneas, se encadena;
    7. inserta el documento y los movimientos, actualiza las existencias y confirma. Todo o nada.
  - **Reglas por operación:**
    - **Saldo inicial (RN-T3-8):** el artículo no tiene movimientos vigentes, es decir, de un documento no revertido que no sea una reversión. Si no, 409 `INITIAL_BALANCE_NOT_ALLOWED` con el mensaje "Usa un ajuste". Un saldo inicial revertido no cuenta (CA-8). No cambia el último costo.
    - **Compra:** proveedor activo o "Sin proveedor" (si está inactivo, 422 en `supplierId`, CA-9). Se guarda `cost_basis = 'con_iva'` (PV-T3-11). Es el único documento que fija `last_cost`. Un importe 0 se marca "sin cargo" (`line_total = 0`).
    - **Ajuste:** dirección por línea. La salida sale al CPP (sin CPP, "sin costo"). La entrada entra al CPP vigente; sin CPP, exige un costo unitario (CA-29; ver DT-T3-7). El motivo es `error_captura` u `otro`, y `otro` exige nota.
    - **Devolución (RF-6):** sale de una compra no revertida. Cada línea se refiere a una línea de la compra (`source_movement_id`) y devuelve como máximo lo comprado menos lo ya devuelto en devoluciones no revertidas (si no, 422 en la línea, CA-30). Sale al `unit_cost` de esa línea, con `applyEntryReversal`.
    - **Reversión (RN-T3-6):** solo de un documento no revertido, que no sea una reversión. Si es una reversión, 409 `REVERSAL_NOT_REVERSIBLE`; si ya está revertido, 409 `ALREADY_REVERSED`, y el único de `reverses_document_id` respalda las carreras. Lleva un movimiento contrario por línea, con `source_movement_id`. Una entrada se revierte con `applyEntryReversal` al costo con que entró; una salida, con `applyEntry` al costo con que salió. El motivo es obligatorio (400 como máximo). Se permite con el artículo o el proveedor inactivos (casos límite). Compra con devoluciones vigentes: DT-T3-3. Último costo: DT-T3-4.
    - **Doble envío:** si llega una clave ya usada con la misma huella, se devuelve el documento existente (`replayed: true`). Si la huella es otra, 422 `IDEMPOTENCY_KEY_REUSED`.
  - **Lecturas:**
    - `previewReversal(id)`: los movimientos contrarios y los artículos que quedarían en negativo con las existencias actuales, sin bloquear (RF-4).
    - `getDocument(id)`: cabecera, líneas, total, autor, "Revertido por #N" o "Reversión de #N", devoluciones y lo que queda por devolver por línea.
    - `listDocuments({ tipo, proveedor, pagina })`, de 50 en 50, del más reciente al más antiguo.
    - `listStock({ q, categoria, tipo, estado, pagina })` (RF-7). Carga una vez los artículos de RN-T3-1 con su existencia (unos cientos de filas, una consulta) y filtra, totaliza y pagina en memoria, como la lista de recetas de T2. El valor de cada fila se redondea a 2 decimales, y los totales suman los valores redondeados para que cuadren a la vista (DT-T3-8). Inactivos: DT-T3-5.
    - `itemKardex(itemId, pagina)`: por `seq` descendente, de 50 en 50 (RF-8).
    - `formOptions()`: artículos activos de RN-T3-1 con su unidad base, empaques, costo de referencia (precarga, PV-T3-7), CPP y si admiten saldo inicial.
- **`supplier-schema.ts` y `supplier-repository.ts`** (RF-1):
  - nombre obligatorio, de 80 como máximo y único entre los activos con `nameKey` (CA-22);
  - contacto opcional, de 120 como máximo: un correo (`algo@dominio.tld`) o un teléfono (dígitos, espacios, `+`, `-` y paréntesis; de 7 a 20 dígitos). Nada más (PV-7);
  - alta, edición con `version` (409 con quién guardó), inactivar y reactivar (si el nombre está en uso, 422);
  - historial en `inventory_change` con `entity 'supplier'`: el tipo se amplía, sin DDL (`VARCHAR(16)`; PV-T3-9);
  - lista con estado (por defecto, activos), búsqueda y página.
- **`kardex-verify.ts`** (puro). Recorre la cadena de cada artículo y su fila de existencia, y comprueba:
  - `seq` contiguo desde 1;
  - `balance_before(n) = balance_after(n−1)` y `balance_after = before + quantity`;
  - `avg_cost_before(n) = avg_cost_after(n−1)`;
  - el CPP recalculado: la regla sale del tipo, del signo y del costo, con las mismas funciones de `kardex-math`;
  - que el tipo sea conocido;
  - y que `quantity`, `avg_cost` y `last_seq` de la existencia coincidan con el último movimiento.
  - Devuelve incidencias `{ itemId, check, seq }`, sin valores.
- **`text.ts`:** `searchKey(text)` quita los acentos (NFD sin marcas, salvo la tilde de la ñ), pasa a minúsculas y vuelve a NFC (OBS-12 b).
- **RF-10:**
  - `recipe-repository` carga los CPP (`store.stockCosts()`, una consulta) en `CostCatalog.cpp`. El orden de `recipe-cost.ts` (CPP → referencia → sin costo, y receta antes que CPP en un Intermedio con receta, DT-7) ya existe, así que la receta cambia de costo sin versión nueva (CA-18).
  - `getItem` devuelve también `stock` (existencia, CPP y último costo).
- **`isInUse` y `hasMovements` (RN-T3-11, CA-19):** `hasMovements` es `last_seq > 0`, y `isInUse` es recetas o `hasMovements`.

### Concurrencia y persistencia (PR 1)

- **`kardexTransaction`:** `ReadCommitted`, `maxWait 5000` y `timeout 10000`, dentro de `run()`: reintento ante 1213 y 503 `INVENTORY_BUSY` ante 1205 (DT-13).
- **Orden de bloqueo, fijo:**
  1. Solo en la devolución y la reversión: `SELECT id FROM inventory_document WHERE id = ? FOR UPDATE` del documento de origen. Serializa las devoluciones y la reversión de una misma compra.
  2. Las existencias: `SELECT … FROM inventory_stock WHERE item_id IN (…) ORDER BY item_id FOR UPDATE`. Si falta alguna fila, `createMany({ skipDuplicates })` y el mismo `SELECT` otra vez (DT-T3-2).
  3. Después, lecturas sin bloqueo (artículos, compra de origen y devoluciones previas) y las escrituras.
- **Escrituras:** el documento con `create`, los movimientos con `createMany` y un `UPDATE` de existencia por artículo distinto (50 como máximo). Sin llamadas externas. Unos 10–30 ms con 50 líneas.
- **Catálogo frente a Kardex (RN-T3-11):**
  - `updateItem` toma el candado `recetas` y después `FOR UPDATE` de la fila de existencia del artículo, antes de `hasMovements` o `isInUse`.
  - El Kardex nunca toma el candado `recetas` ni bloquea artículos, así que no hay ciclo de espera.
  - Si `updateItem` va primero, el Kardex espera y después lee el artículo ya cambiado (por ejemplo, no inventariable), así que la línea se rechaza.
  - Si el Kardex va primero, `updateItem` ve `last_seq > 0` y rechaza el cambio.
- **Idempotencia (DT-14):**
  - La pide el formulario: un `requestId` (UUID) generado al pintar, que se conserva en cada repintado y viaja como `Idempotency-Key`.
  - Clave `<actorId>:<tipo>:<requestId>` y huella sha256 del cuerpo canónico.
  - Primero se busca la clave sin bloquear. Si dos envíos llegan a la vez, el único (P2002) hace que el segundo lea el documento ya confirmado.
  - Sobrevive a un reinicio de la `api` (CA-12).
- **Inmutabilidad (DT-5):**
  - El store no expone ningún `update` ni `delete` de documentos ni de movimientos.
  - Regla `no-restricted-syntax` en `eslint.config.ts` que prohíbe `inventoryDocument` e `inventoryMovement` con `.update`, `.updateMany`, `.upsert`, `.delete` o `.deleteMany` en todo el monorepo, e `inventoryStock` con `.delete` o `.deleteMany`.
  - `inventory:verify` detecta una fila alterada a mano.
- **Decimales y fechas:**
  - Los decimales se leen con `toFixed(n)` y `parseDecimal`, y se escriben con `formatDecimal`.
  - `occurred_on` se escribe como medianoche UTC del día local y se lee de vuelta a `AAAA-MM-DD`. La ida y vuelta se prueba en MySQL con `TZ=America/Mexico_City` (H-11).

### `inventory:verify` (RF-13; PR 1, y en la imagen en el PR 2)

- **Comando:** `npm run inventory:verify` (en la `api`: `node --env-file-if-exists=.env scripts/inventory-verify.ts`). En el contenedor: `$C exec -T api node scripts/inventory-verify.ts`.
- **Seguridad:**
  - Usa `DATABASE_URL`, el usuario solo DML, y solo hace lecturas en una transacción de lectura.
  - Antes ejecuta `verifyDatabase`. No migra nada.
- **Recorrido:** por lotes con clave (`item_id, seq`) de 5 000 movimientos, con la memoria acotada.
- **Salida:**
  - `inventory_verify_ok { items, movements, documents }` o `inventory_verify_mismatch { itemId, check, seq }`, hasta 100 líneas más un total;
  - nunca costos, cantidades ni nombres (CA-15, CA-27).
- **Códigos de salida:** 0 si todo cuadra, 1 si hay descuadres y 2 si no se pudo verificar (configuración o base).

### Contratos y rutas de la API (PR 2)

Todas van bajo `/api/v1/admin/inventario/` con `access.inventory(ctx, { write })`: 401 → 403 `FORBIDDEN_ROLE` (Editor) → CSRF 403 en las escrituras (CA-21). JSON cerrado con Zod, decimales como texto y errores con el formato central.

| Método y ruta | Uso | Respuestas propias |
|---|---|---|
| `GET proveedores?estado=&q=&pagina=`, `GET proveedores/:id` (con historial) | RF-1 | 404 `SUPPLIER_NOT_FOUND` |
| `POST proveedores`, `PUT proveedores/:id`, `POST proveedores/:id/desactivar`, `POST proveedores/:id/reactivar` | RF-1 (`Idempotency-Key` en memoria, como las altas de T1) | 422 `fields` (nombre en uso), 409 `SUPPLIER_VERSION_CONFLICT` (`current`) |
| `GET kardex/opciones` | `formOptions()` y proveedores activos | — |
| `POST documentos/saldo-inicial`, `POST documentos/compras`, `POST documentos/ajustes` | RF-2, RF-3 y RF-5, con `Idempotency-Key` persistente | 201; 200 con `replayed`; 422 `VALIDATION_FAILED` (`fields` por línea); 409 `INITIAL_BALANCE_NOT_ALLOWED`; 422 `IDEMPOTENCY_KEY_REUSED`; 503 `INVENTORY_BUSY` |
| `POST documentos/:id/devoluciones` | RF-6 | lo mismo, más 409 `DOCUMENT_REVERSED` y `DOCUMENT_NOT_RETURNABLE` |
| `GET documentos/:id/reversion`, `POST documentos/:id/reversion` | RF-4: vista previa y reversión (`{ reason }`) | 409 `ALREADY_REVERSED`, `REVERSAL_NOT_REVERSIBLE` y `DOCUMENT_HAS_RETURNS` (DT-T3-3) |
| `GET documentos/:id`, `GET documentos?tipo=&proveedor=&pagina=` | RF-9 | 404 `DOCUMENT_NOT_FOUND` |
| `GET existencias?q=&categoria=&tipo=&estado=&pagina=` | RF-7 | 422 de filtros |
| `GET articulos/:id/kardex?pagina=` | RF-8 | 404 |
| `GET articulos/:id` (T1) | Añade `stock: { quantity, avgCost, lastCost } \| null` | — |

- **Ninguna ruta** edita ni borra documentos o movimientos (CA-15).
- **Impacto en T1 y T2:** las pruebas que comparan la forma exacta de la ficha se **modifican**, sin contar como pruebas nuevas.
- **Logs:**
  - `inventory_document_created { documentId, type, lines }`, `inventory_document_reversed { documentId, reversalId }`, `inventory_document_replayed { documentId }`, `inventory_supplier_saved { supplierId, action }` e `inventory_busy`;
  - nunca costos, cantidades, nombres ni contactos (CA-27).
- **Semilla de desarrollo** (RF-15):
  - todo ficticio y por los repositorios, con el autor "Semilla de desarrollo";
  - dos proveedores (uno inactivo);
  - saldos iniciales, una compra por bultos (la de CA-1) y una segunda compra (CPP);
  - un artículo "Sin costo", un ajuste de salida que deja un negativo y una compra revertida;
  - idempotente: no hace nada si ya hay proveedores o documentos;
  - nunca se ejecuta en producción (CA-28): las salvaguardas de T1 siguen.

### Frontend (PR 3)

Sistema visual del admin y parciales existentes, sin Stitch (PV-8 y PV-T3-10). Se revisó `_stich_source_/`: no tiene diseños del admin.

- **Subnavegación:** "Artículos | Categorías | Recetas | Existencias | Documentos | Proveedores", solo para Administrador y Gerente.
- **Proveedores:** lista con filtro de estado y búsqueda, alta y edición, conflicto como en T1, inactivar y reactivar con botón POST, e historial.
- **Existencias:**
  - filtros por GET;
  - tabla con `caption`: artículo, categoría, tipo, existencia y unidad, CPP, último costo, valor y estado. "Negativo" y "Sin costo" van con texto, además de color e icono;
  - totales en un `dl` encima de la tabla;
  - paginación de 50.
- **Documentos:**
  - lista con filtro por tipo y proveedor;
  - acciones "Nueva compra", "Saldo inicial" y "Ajuste";
  - detalle con el estado ("Revertido por #N" o "Reversión de #N"), "sin cargo", el criterio "Con IVA" (PV-T3-11), el total y las acciones "Devolver" (solo compras) y "Revertir";
  - confirmación de la reversión, con la tabla de movimientos contrarios, el aviso de negativos y el motivo obligatorio.
- **Formularios con líneas** (saldo inicial, compra, ajuste y devolución) (PV-T3-4):
  - 10 filas por bloque, hasta 50. "Añadir 10 filas" (`accion=filas`) repinta con lo escrito y pone `autofocus` en el artículo de la primera fila nueva. Un aviso de error con `autofocus` tiene prioridad (patrón de REQ-F-054);
  - el artículo con `<input list>` y un único `<datalist>`;
  - la unidad con `<input list>` de las unidades del sistema y los empaques;
  - el costo del saldo inicial se precarga con la referencia (PV-T3-7);
  - la devolución muestra cada línea de la compra con "queda por devolver";
  - en móvil, un `fieldset` por línea con `legend` "Línea N"; en escritorio, una tabla;
  - `error-summary` con un enlace a cada campo.
  - Un 503 conserva lo escrito y el `requestId`, así que reintentar no duplica (CA-14 y CA-12).
  - La lógica de bloques se extrae a `inventory-common.ts` y la reutiliza el editor de recetas, sin cambiar su comportamiento.
- **Ficha del artículo:**
  - CPP y último costo en lugar de "Sin costo" (RF-10);
  - bloque "Kardex" con los movimientos de RF-8 (fechas en `BUSINESS_TIMEZONE`, tipo legible y enlace al documento), paginado con `?kardex=N#kardex`.
  - Las recetas muestran el origen "CPP".
- **OBS-12:**
  - (a) Patrones de `/inventario/*` en `RETURN_PATTERNS`, solo rutas internas con el mismo alfabeto de consulta, y `returnTo = ctx.path + consulta` en cada GET de inventario. Un destino externo cae en `/`.
  - (b) Sin cambio de modelo, así que **se queda en T3** (PV-T3-12):
    - las listas que filtran en memoria (recetas, existencias y proveedores) comparan con `searchKey`;
    - la lista de artículos, paginada en la base, busca con `name COLLATE utf8mb4_es_0900_ai_ci LIKE ?`. Así ignora mayúsculas y acentos, conserva la ñ y no hace falta columna nueva ni relleno. Se obtienen primero los ids con `$queryRaw` y después la página por Prisma.
    - "cárne" encuentra "Carne" (CA-31).
  - (c) Si la página queda fuera de rango con resultados, aparece un solo aviso, "Esta página no existe", con un enlace a la última página, y nunca "No hay resultados". Se aplica en todas las listas de `/inventario/*`.
- **Accesibilidad:** foco visible, objetivos de al menos 24 px, errores con texto, tablas con `caption` y `scope`, sin modales y funcionamiento sin JavaScript (RF-16, CA-25).

### Seguridad

- **Permisos:** Administrador y Gerente en todo (CA-21). El Editor recibe 403 en la API y en el admin, sin escritura.
- **CSRF** en cada escritura, y `same-origin` en el admin, como hoy.
- **Validación** en el borde (Zod) y en core. El servidor recalcula todos los costos: el cliente solo envía cantidades, importes y costos capturados.
- **Escape** con `{{ }}` en todas las vistas. `next` va por lista blanca, sin redirección abierta.
- **Logs y salidas sin datos:** ni costos, ni cantidades, ni nombres, ni contactos, tampoco en la salida de `verify`.
- **Datos ficticios:** la semilla y las pruebas solo usan datos ficticios, y `check-private-data` sigue en el lint (CA-27).
- **Sin dependencias nuevas.** Sin cambios en `deploy/`: la suma no cambia, y QA lo comprueba.

### Testing (pruebas permanentes funcionales; cada archivo < 20 s)

| PR | Archivo | Casos |
|---|---|---|
| 1 | `api/tests/unit/inventory-kardex.test.ts` (nuevo, memoria) | CA-1 a CA-4 (importe → costo, CPP, existencia ≤ 0, redondeo, coma); CA-5 y CA-8; CA-6 y CA-7 (reversión, 20.0000, 409, sin "revertir una reversión", negativo y CPP conservado); CA-9 y CA-10 (rechazo por línea sin escritura); CA-11 (`businessDate` en los bordes con `setSystemTime`); CA-29; CA-30; DT-T3-3 y DT-T3-4; RN-T3-11 y CA-19; CA-20 (alta, importación y semilla con fila de existencia); `kardex-verify` con una cadena alterada; proveedores (CA-22); `searchKey` |
| 1 | `landing-pages/tests/integration/prisma-inventory-kardex.test.ts` (nuevo, MySQL) | CA-13: 20 salidas simultáneas (`seq` contiguo y saldo exacto) y dos documentos cruzados sin errores; CA-12: doble envío con una segunda instancia del store (simula el reinicio) y una sola fila; DECIMAL y `DATE` exactos ida y vuelta con `TZ` local; CA-15: `inventory:verify` da 0 y, tras un `UPDATE` hecho a mano con el soporte de pruebas, no da 0 y no imprime valores; **cadena punta a punta** saldo inicial → compra → costo real de la receta (CA-18, conservada a propósito en `testing.md`); carrera entre el cambio de `inventoriable` y un primer movimiento |
| 1 | `landing-pages/tests/integration/prisma-inventory-store.test.ts` (se modifica) | La búsqueda sin acentos en MySQL ("cárne" → "Carne") |
| 2 | `api/tests/integration/admin-inventory-kardex-api.test.ts` (nuevo) | CA-21 en cada ruta (Editor 403 sin escritura, sin sesión 401, sin CSRF 403); 409, 422 por línea y 503 `INVENTORY_BUSY` con la forma central; `Idempotency-Key` persistente (reenvío y huella distinta); proveedores (conflicto, reactivar con nombre en uso); forma de la existencia en la ficha |
| 2 | `admin-inventory-api.test.ts` (se modifica) | Forma de la ficha con `stock` |
| 3 | `inventory-manager/tests/integration/inventory-kardex-forms.test.ts` (nuevo, doble de la API) | Formularios sin JavaScript; 50 filas en bloques con `autofocus` en la primera fila nueva y el aviso con prioridad; errores por línea con texto; 503 que conserva lo escrito y el `requestId`; confirmación de la reversión con motivo |
| 3 | `inventory-manager/tests/integration/inventory-kardex-views.test.ts` (nuevo) | Existencias (columnas, totales y estados con texto); Kardex en la ficha; lista y detalle de documentos; Editor 403 y sin secciones; OBS-12 (a) y (c) |
| 3 | La prueba existente de `sanitizeNext` (se modifica) | Rutas de `/inventario/*` aceptadas y un destino externo rechazado |

Antes de añadir cada caso se comprueba que no exista ya (`testing.md`). Si un archivo se acerca a 20 s, se parte por sus `describe`, con la preparación común en `tests/support/` (OBS-7 sigue vigilada).

**Se ejecutan y se descartan** (QA Report):

- vuelta atrás con las imágenes de `main` y de T2 (CA-24);
- respaldo y restauración con `inventory:verify` (CA-23);
- espera agotada real (1205, CA-14);
- carreras adicionales (dos reversiones a la vez, devolución y reversión de la misma compra);
- medición de contención del pool;
- 360 px, teclado, sin JavaScript y axe (CA-25);
- regresión de las landings, el bot, el menú, productos, página, T1 y T2 (CA-26);
- mutaciones;
- la suma de `deploy/`;
- `check-private-data`.

### Orden de implementación y partición (DT-1: 3 PR hacia `epic/inventario`)

Cada PR sale de la punta de `epic/inventario`. La rama del PR 1 incorpora este ticket con `git mv` a `in-progress/`. Hoy el ticket solo existe sin seguimiento en el árbol de `main`.

1. **PR 1 (L):** migración, core, stores, `hasMovements` e `isInUse`, fila de existencia en `insertItem`, CPP en el costo de recetas, `inventory:verify` (script), regla de lint, pruebas de la fila 1 y los trabajos de arrastre (ver más abajo). Si pasa de unas 1 500 líneas, se propone partirlo en **1a** (migración completa, proveedores, existencias y `hasMovements`) y **1b** (Kardex, `verify` y su prueba en MySQL).
2. **PR 2 (M):** contratos, rutas, cliente, semilla, `COPY` en el Dockerfile, `README` (comandos) y pruebas de API. Si pasa de unas 1 500 líneas, se parte en 2a (proveedores y lecturas) y 2b (documentos).
3. **PR 3 (M/L):** pantallas, OBS-12, documentación y pruebas del admin, más `ops/backup` si se aprueba DT-T3-6 A.
4. Después, el PR de la épica hacia `main` se registra en REQ-F-049 (P-1). Ese PR es el que corre el CI completo, incluidas las pruebas de humo de despliegue y de respaldos.

### Trabajos de arrastre (autorizados por P-3 y P-1; se ejecutan en T2, en el PR 1)

- **`.claude/rules/git.md`** (autorizado, P-3), línea 25:

  ```text
  - Los PR de los tickets de la épica de inventario (REQ-F-049 a REQ-F-053 y sus seguimientos, como REQ-F-054) van a `epic/inventario` …
  ```

  También el título de la excepción, si menciona el rango, y la frase "decidida por el usuario en REQ-F-049 (D-4, PV-12 y DT-4)", que se completa con ", ampliada en REQ-F-051 (P-3)".
- **REQ-F-049** (versión de `epic/inventario`; PV-T3-13). La numeración de E2 aparece **9 veces en 3 secciones**, no 3 veces:
  - Hoja de ruta (línea 129): "REQ-F-054 y siguientes" pasa a "Sin rango reservado: cada ticket toma el siguiente número libre al crearse (hoy, REQ-F-055 o mayor). REQ-F-054 se usó para el seguimiento DEF-007/DEF-008 de T2."
  - Cobertura (líneas 146 y 154 a 159, siete filas): "REQ-F-054+" pasa a "Siguiente número libre (REQ-F-055+)".
  - Partición (línea 243): "(REQ-F-054+)" pasa a "(siguiente número libre, REQ-F-055+)".
  - Se añade una entrada al historial de cambios que cita PV-T3-13.
- **Registro del PR de la épica hacia `main` en REQ-F-049 (P-1):** el PR 1 añade a REQ-F-049 una sección "PR de la épica hacia `main`" con el estado "pendiente de T3". Cuando T3 esté `DONE` y se abra ese PR, se rellenan la URL, el CI (`calidad`, `docker`, `auditoria` y `pruebas` en `pass`, más las pruebas de humo de despliegue y de respaldos) y el merge.
- **Observación:** el `## Estado` de REQ-F-049 en la épica sigue diciendo `READY_FOR_MERGE` del PR #183, que ya está mergeado. Se propone dejarlo en "T1 `DONE`; marco vigente; pendiente el PR de la épica hacia `main`" en esa misma edición. Es una corrección de trazabilidad, sin cambio funcional.
- **`.claude/CLAUDE.md` §8: NO autorizado. Solo se propone para el cierre de T3**, con su propia autorización. Texto propuesto sobre la versión de la épica:
  - `api`: "… y el inventario: catálogo de artículos, unidades, variantes y categorías (REQ-F-049), recetas y costo teórico (REQ-F-050), y proveedores, compras, saldo inicial, ajustes, devoluciones, reversiones, existencias valorizadas y Kardex (REQ-F-051) …";
  - `inventory-manager`: "… y el inventario (sección "Inventario": artículos, categorías, recetas, existencias, documentos y proveedores; solo administradores y gerentes) …";
  - y una línea nueva: "Operación del inventario: `npm run inventory:verify` comprueba la cadena del Kardex (solo lectura)."
  - También se propondrá, con la misma autorización, la sección "Persistencia y API" de `.claude/agents/senior-fullstack.md` (plan, §4).

### Documentación (PR 2 y PR 3)

- **`restaurante/docs/arquitectura.md`:** Kardex, CPP, existencias como proyección, concurrencia (orden de bloqueo), idempotencia persistente, inmutabilidad (dominio, lint y `verify`), DT-T3-1, y las rutas en §6.
- **`restaurante/docs/despliegue.md`:**
  - §5: orden de arranque en producción tras el merge a `main` (desplegar, importación A5 con PT-5, saldo inicial en pantalla y compras) y `inventory:verify` en el contenedor;
  - §6: la migración no requiere pasos de vuelta atrás, más la nota sobre la imagen de T2, que solo aplica en desarrollo;
  - §9 y §11.1: las tablas nuevas;
  - §11.8: `inventory:verify` en el simulacro, según DT-T3-6.
- **`restaurante/README.md`:** `inventory:verify`, la semilla ampliada y la nota de vuelta atrás a T2 en desarrollo.
- **`.env.example`:** sin cambios, porque no hay variables nuevas.

### Riesgos técnicos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Interbloqueos o esperas con el pool de 5 (DT-13) | Orden fijo (documento → existencias ascendentes), `ReadCommitted`, documentos de 50 líneas como máximo, reintento ante 1213 y 503 ante 1205. Medición de contención en QA. |
| Precisión del CPP en reversiones y devoluciones | Un único módulo `kardex-math` con `bigint`. CA-6 fija el borde de la mitad hacia arriba (19.99995 → 20.0000). `verify` recalcula el CPP. |
| `DATE` desplazado por la zona del proceso (H-11) | Prueba de ida y vuelta en MySQL con `TZ` local. Si falla, el plan B es `occurred_on CHAR(10)` (`AAAA-MM-DD`), que también es aditivo; se decidiría antes del merge del PR 1. |
| Filas de existencia ausentes (imagen de T2 o `TRUNCATE`) | Creación defensiva al bloquear (DT-T3-2). `verify` las tolera. |
| La búsqueda en memoria y la de MySQL difieren en algún carácter raro | Las dos ignoran mayúsculas y acentos, y conservan la ñ. Hay una prueba en cada lado. |
| Tamaño de los PR | Partición 1a/1b y 2a/2b prevista. |
| Archivos de prueba de más de 20 s (OBS-7) | Archivos separados por superficie y vigilancia en el CI. |
| Divergencia de la rama | PR de integración `main` → épica tras cada cambio en `main` (`git.md`). |

### Criterios de finalización (DoD por PR)

- **Todos:**
  - `build:css` (si aplica), `typecheck`, `lint` (con `check-private-data`) y `test` en verde;
  - CI con `calidad`, `docker`, `auditoria` y `pruebas` en `pass`;
  - la suma de `deploy/` sin cambios;
  - sin pruebas no funcionales commiteadas;
  - criterios del PR con evidencia.
- **PR 1:**
  - migración aditiva con la colación revisada;
  - CA-1 a CA-8, CA-29 y CA-30 exactos;
  - CA-13 (20 operaciones simultáneas) y CA-15 (`verify`);
  - CA-24 comprobado por QA con las imágenes de `main` y de T2;
  - los trabajos de arrastre hechos.
- **PR 2:**
  - CA-12 y CA-21 con evidencia;
  - `inventory:verify` ejecutado en el contenedor `api` construido, tal como lo documenta el README;
  - la semilla (CA-28).
- **PR 3:**
  - CA-16 a CA-18, CA-25, CA-26 y CA-31;
  - la documentación;
  - los procedimientos nuevos de `despliegue.md` ejecutados en local tal como están escritos.

### Decisiones técnicas para el usuario (con recomendación)

DT-T3-1 y DT-T3-2 son decisiones técnicas delegadas, ya tomadas arriba. Se informan, no se preguntan.

- **DT-T3-3. ¿Se puede revertir una compra que ya tiene devoluciones vigentes?** El ticket no lo dice. Revertir la compra completa volvería a sacar lo ya devuelto.
  - **Recomendado:** no. Responde 409 `DOCUMENT_HAS_RETURNS` con el mensaje "Revierte primero las devoluciones #N". Así se conserva "revierte el documento completo" (RN-T3-6), sin reversiones parciales.
  - Alternativa: revertir solo lo que queda sin devolver.
  - Y, en la misma línea, **la devolución con el artículo o el proveedor ya inactivos se permite**, como la reversión (casos límite: "la corrección siempre debe ser posible").
- **DT-T3-4. ¿Qué último costo queda al revertir la compra más reciente?** RN-T3-5 dice "el de la última compra".
  - **Recomendado:** el de la última compra **no revertida** del artículo, o vacío si no queda ninguna. Lo recalcula la reversión dentro de la misma transacción, con una consulta por índice.
  - Alternativa: dejarlo como estaba.
  - En los dos casos, la devolución, el ajuste y el saldo inicial no cambian el último costo.
- **DT-T3-5. ¿Los artículos inactivos aparecen en Existencias?** RN-T3-1 no lo dice. Un inactivo puede conservar existencia y valor.
  - **Recomendado:** aparece si su existencia es distinta de 0, con la etiqueta "Inactivo", y cuenta en los totales. Con existencia 0 se omite.
- **DT-T3-6. ¿Cómo entra `inventory:verify` en el simulacro (RF-13, CA-23)?** Hoy no puede entrar (H-8): el manifiesto no guarda la imagen `api` y el MySQL efímero se borra al terminar.
  - **A (recomendado):**
    - `backup.sh` añade `api_image=` al manifiesto (vacío si `state/release.env` no la tiene);
    - `verify-backup.sh --drill` ejecuta `node scripts/inventory-verify.ts` con esa imagen en la red efímera, con el usuario de la app, si la base restaurada tiene `inventory_movement`. Falla si el resultado no es 0. Con un respaldo sin `api_image` o sin tablas de inventario, solo lo anota;
    - se ajusta `ops/backup/ci/smoke.sh`, y en `ci.yml` se le pasa también la imagen `api` (solo corre en el PR de la épica hacia `main`);
    - tras llevar la épica a `main`, **hay que reinstalar `ops/backup` en el VPS** (§11.5, un paso manual del usuario);
    - todo queda en `ops/`, así que la suma de `deploy/` no cambia.
  - **B:** sin tocar scripts. QA comprueba CA-23 en local, y `despliegue.md` §9 y §11.7 añaden `inventory:verify` tras cada restauración real. El simulacro mensual no lo cubre, así que RF-13 se cumple solo en parte.
- **DT-T3-7. Ajuste de entrada con un costo escrito cuando el artículo ya tiene CPP.**
  - **Recomendado:** se rechaza en la línea con "Ya tiene CPP: deja el costo vacío; entra a su CPP". Nada se ignora en silencio. El formulario muestra el CPP de cada artículo.
  - Alternativa: ignorarlo y entrar al CPP.
- **DT-T3-8. Totales de Existencias.**
  - **Recomendado:** suma de los valores ya redondeados a 2 decimales, para que cuadren con la tabla.
  - Alternativa: suma exacta redondeada al final. Puede diferir en centavos de la suma visible.
- **DT-T3-9. Dónde van los trabajos de arrastre** (`git.md` y REQ-F-049).
  - **Recomendado:** en el PR 1 hacia `epic/inventario`. La copia de `main` de `git.md` no los verá hasta el merge de la épica, pero no afecta en la práctica: los PR de T3 ya están en el rango "REQ-F-049 a REQ-F-053".
  - Alternativa: un PR de solo `git.md` hacia `main` y después el PR de integración `main` → épica.

### Qué hace cada agente

- **senior-fullstack:** PR 1 a 3, los trabajos de arrastre, T4 de cada PR y las propuestas de `.claude/` al cierre.
- **senior-qa:** plan y QA por PR, con las sondas descartables (CA-23, CA-24, CA-14 real, carreras, accesibilidad, mutaciones y suma de `deploy/`).
- **Sesión principal:** las aprobaciones de este plan y de DT-T3-3 a DT-T3-9.
- **Usuario:** decide DT-T3-3 a DT-T3-9. Si elige DT-T3-6 A, reinstala `ops/backup` en el VPS tras el merge de la épica, y ejecuta el simulacro.

## Implementation Result — PR 1a

### Rama

`feature/REQ-F-051-kardex-modelo` (worktree `.claude/worktrees/req-f-051-pr1`), creada desde `origin/epic/inventario` (`ad50c50`) y sin upstream. Destino del PR: `epic/inventario`. Sin commit (T2).

### Cambios realizados

- **Partición:** el PR 1 completo pasa de unas 1 500 líneas, así que se parte como prevé el plan. Este **PR 1a** tiene 13 archivos modificados (+502/−78) y 4 nuevos (561 líneas). El **PR 1b** traerá `kardex-schema`, `kardex-math`, `kardex-repository`, `kardex-verify`, `business-date`, `prisma-kardex.ts`, el CPP en el costo de recetas, `inventory:verify` y las pruebas de Kardex y concurrencia en MySQL.
- **Migración `20261125120000_inventario_kardex`:** generada con `prisma migrate diff` y revisada a mano.
  - Las cuatro tablas del plan (`inventory_supplier`, `inventory_stock`, `inventory_document` e `inventory_movement`), con `VARCHAR` para los tipos (DT-T3-1) y las columnas `line`, `source_*` y `request_hash`.
  - Las 4 tablas con `utf8mb4_es_0900_as_cs`.
  - Relleno de existencias para los artículos que no son padres (DT-T3-2).
  - `migrate diff --exit-code` sin diferencias.
- **Prisma:** los modelos `InventorySupplier`, `InventoryStock`, `InventoryDocument` e `InventoryMovement`, con sus relaciones con `User` e `InventoryItem`.
- **Core (`packages/core/inventory`):**
  - `supplier-schema.ts`: nombre de 80 como máximo; contacto opcional, que solo admite un teléfono de 7 a 20 dígitos o un correo (PV-7).
  - `supplier-repository.ts` (RF-1): alta; edición con versión y conflicto (`SupplierConflictError` con quién guardó) y "guardar encima"; inactivar; reactivar, que rechaza un nombre en uso; lista con estado (por defecto, activos), búsqueda y página de 50; historial en `inventory_change` con `entity 'supplier'` (PV-T3-9).
  - `errors.ts`: `SupplierNotFoundError`, `SupplierConflictError` y `SupplierNameTakenError`.
  - `text.ts`: `searchKey`, que ignora mayúsculas y acentos y conserva la ñ (OBS-12 b). La usan la lista de recetas, la de proveedores y la búsqueda en memoria de artículos.
  - `inventory-store.ts`: el contrato añade proveedores, `lockStock` y `hasMovements` real; `insertItem` crea la existencia; `InventoryEntity` y `HistoryEntity` admiten `supplier`.
  - `inventory-repository.ts`: `updateItem` bloquea la existencia del artículo (`lockStock`) antes de `hasMovements` e `isInUse` (RN-T3-11).
- **Stores:**
  - **Memoria:** proveedores; existencias (`state.stock`), con su fila al dar de alta un artículo que no es padre; `hasMovements = lastSeq > 0`, que también cuenta en `isInUse`.
  - **Prisma:** `insertItem` crea la existencia; `lockStock` hace `SELECT … FOR UPDATE` en orden ascendente y crea las filas que falten (`skipDuplicates`), con un segundo bloqueo; `hasMovements` e `isInUse` miran `last_seq`; proveedores con la clave única `active_name_key` traducida a `SupplierNameTakenError`.
  - **Búsqueda de artículos en MySQL:** `name COLLATE utf8mb4_es_0900_ai_ci LIKE ?`, con los ids buscados en una consulta aparte. Los comodines se siguen buscando como texto.
- **Lint (`eslint.config.ts`, DT-5):** `KARDEX_IMMUTABLE` en los 12 bloques que configuran `no-restricted-syntax`.
  - Prohíbe `update`, `updateMany`, `updateManyAndReturn`, `upsert`, `delete` y `deleteMany` sobre `inventoryDocument` e `inventoryMovement`, y el borrado de `inventoryStock`.
  - Comprobado con un archivo temporal, ya borrado: marca `updateMany` y `delete` y deja pasar `create`.
- **Trabajos de arrastre (P-3, P-1, PV-T3-13 y DT-T3-9):**
  - `.claude/rules/git.md`: "REQ-F-049 a REQ-F-053 y sus seguimientos, como REQ-F-054", y "ampliada en REQ-F-051 (P-3)".
  - REQ-F-049:
    - las 9 menciones de la numeración de E2 pasan a "siguiente número libre (REQ-F-055+)";
    - nueva sección "PR de la épica hacia `main`" (pendiente), con el recordatorio de reinstalar `ops/backup` (DT-T3-6 A);
    - estado corregido a "T1 `DONE`; marco vigente";
    - entrada nueva en el historial.
  - `.claude/CLAUDE.md` y `senior-fullstack.md`: sin tocar (no autorizados).
- **Ticket:** incorporado a la rama en `.claude/docs/in-progress/` (en el índice). Ya no queda copia sin seguimiento en el árbol de `main`.

### Criterios de aceptación (alcance del PR 1a: modelo, proveedores y existencias; el resto en 1b, 2 y 3)

| CA | Estado | Evidencia |
|---|---|---|
| CA-19 (bloqueo por uso) | PASS (dominio y MySQL) | Unitaria (memoria) y MySQL (`last_seq = 1`): la unidad, los empaques y el inventariable rechazados, y el resto de la ficha editable. La carrera con un primer movimiento real se prueba en el 1b. |
| CA-20 (alta lista para movimientos) | PASS en el modelo | El alta, la importación A5 con el fixture ficticio y la semilla dejan existencia 0 y sin costo en cada artículo que no es padre; un padre no tiene existencia. La compra "al instante" llega con el 1b y el 2. |
| CA-22 (proveedores) | PASS (dominio y MySQL) | Nombre repetido sin distinguir mayúsculas, reactivar con el nombre en uso, conflicto de versión con quién guardó, y dos altas simultáneas en MySQL (una sola fila). |
| CA-31 (b) (búsqueda sin acentos) | PASS en core y en el store | "cárne" encuentra "Carne" y "pina" no encuentra "Piña", en memoria y en MySQL; también en recetas y proveedores. Las pantallas llegan en el PR 3. |
| CA-24 (vuelta atrás) | Pendiente de QA | La migración es aditiva y una existencia ausente se crea al bloquear (MySQL: artículo creado "por una imagen anterior"). La comprobación con las imágenes de `main` y de T2 es de QA. |
| Resto (CA-1 a CA-18, CA-21, CA-23, CA-25 a CA-30, CA-31 a y c) | Fuera del 1a | PR 1b, 2 y 3. |

### Validaciones ejecutadas

Todo desde `restaurante/` en el worktree, con el MySQL local (`npm run db:up`).

- `npm run db:generate`: correcto.
- `prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --exit-code`: "No difference detected", código 0.
- `npm run typecheck`: código 0.
- `npm run lint`: código 0, incluido `check-private-data` (885 archivos, sin datos privados).
- `npm run build:css`: código 0. Hizo falta en el worktree nuevo, porque el CSS no se versiona.
- `npm test`:
  - `api`: 56 archivos y 1253 pruebas, todas en verde;
  - `landing-pages`: 64 archivos y 907 pruebas, todas en verde;
  - `inventory-manager`: 18 archivos y 297 pruebas, todas en verde.
  - Una primera ejecución sin `build:css` falló en 4 pruebas que leen el CSS generado. Pasaron después de generarlo.
- Pruebas nuevas:
  - `api/tests/unit/inventory-kardex.test.ts`: 8 pruebas, unos 0.25 s;
  - el bloque nuevo de `prisma-inventory-store.test.ts`: 4 pruebas, unos 0.15 s cada una. El archivo entero tarda unos segundos.
- Mutación rápida descartable: con `hasMovements` siempre falso en la memoria, la prueba de CA-19 falla. Restaurado.
- Limpieza:
  - sin bases `restaurante_test*` en el MySQL de pruebas;
  - sin procesos de Vitest ni servidores;
  - archivo de sondeo del lint borrado;
  - registros temporales del lint y de las pruebas borrados.
  - El worktree `.claude/worktrees/req-f-051-pr1` se conserva para QA y para el commit (excluido en `.git/info/exclude`).

### Archivos afectados

- **Nuevos:**
  - `restaurante/packages/db/prisma/migrations/20261125120000_inventario_kardex/migration.sql`
  - `restaurante/packages/core/inventory/supplier-schema.ts`
  - `restaurante/packages/core/inventory/supplier-repository.ts`
  - `restaurante/api/tests/unit/inventory-kardex.test.ts`
- **Modificados:**
  - `restaurante/packages/db/prisma/schema.prisma`
  - `restaurante/packages/db/src/prisma-inventory-store.ts`
  - en `restaurante/packages/core/inventory/`: `{errors,index,inventory-repository,inventory-store,memory-inventory-store,recipe-repository,text}.ts`
  - `restaurante/eslint.config.ts`
  - `restaurante/landing-pages/tests/integration/prisma-inventory-store.test.ts`
  - `.claude/rules/git.md`
  - `.claude/docs/in-progress/REQ-F-049-epica-inventario-catalogo-articulos.md`
- **Movido:** `.claude/docs/backlog/REQ-F-051-…` pasa a `.claude/docs/in-progress/REQ-F-051-…`. No estaba en git: entra nuevo en la rama.

### Riesgos o pendientes

- **Tablas sin uso todavía:** el 1a deja creadas `inventory_document` e `inventory_movement`, que nadie escribe hasta el 1b. No afecta a nada, porque la épica no se despliega.
- **Columna `DATE` (H-11):** su ida y vuelta se prueba en el 1b, con el primer uso de `occurred_on`. Si fallara, el plan B (`CHAR(10)`) sería otra migración aditiva antes del merge a `main`.
- **Base de desarrollo:** el MySQL local de desarrollo no se migró (las pruebas usan bases `restaurante_test_*` propias). Para probar el 1a contra la base de desarrollo: `npm run db:migrate`, sabiendo que la `api` de `main` necesita entonces `DATABASE_ALLOW_NEWER_SCHEMA`.
- **Pendiente de QA:** la vuelta atrás con las imágenes de `main` y de T2 (CA-24) y la suma de `deploy/` (este PR no toca `deploy/`).
- **Siguiente paso:** con la aprobación de este 1a, QA y después T4 (commit y PR en borrador hacia `epic/inventario`). El 1b se implementa a continuación desde la punta de la épica.

## QA Action Plan — PR 1a

### Objetivo

Validar con evidencia que el PR 1a (rama `feature/REQ-F-051-kardex-modelo`, sin commit, sobre `ad50c50`) cumple sus criterios: la migración `20261125120000_inventario_kardex` es aditiva y correcta desde cero y sobre una base con datos de T2; los proveedores, la existencia en el alta y el bloqueo por uso funcionan en memoria y en MySQL; la búsqueda ignora los acentos y distingue la ñ; la regla de inmutabilidad del lint funciona; la vuelta atrás con el código de `main` y de T2 sigue funcionando (CA-24); y nada de T1, T2 ni del resto del monorepo cambia.

### Requisito bajo prueba

- RF-1 (proveedores), RF-12 y DT-T3-2 (una existencia por artículo que no es padre, con creación defensiva), RN-T3-11 (bloqueo por uso), OBS-12 (b) (PV-T3-12), DT-T3-1 (tipos en `VARCHAR`), DT-5 (regla de lint), y los trabajos de arrastre (P-1, P-3, PV-T3-13 y DT-T3-9).
- Fuera del 1a, sin tratarlos como defecto: el Kardex, el CPP, `business-date`, `inventory:verify`, la idempotencia de documentos y las pruebas de concurrencia del Kardex (PR 1b); rutas, contratos y semilla de T3 (PR 2); pantallas, CA-31 (a) y (c) (PR 3). La compra "al instante" de CA-20 llega con el 1b y el 2: aquí solo se valida la parte del modelo.

### Criterios de aceptación

| CA (alcance 1a) | Pruebas |
|---|---|
| CA-19 (bloqueo por uso, parte del modelo) | S3, D3, C4, C5, X1–X2 |
| CA-20 (alta lista para movimientos, parte del modelo) | S3, M5, D1, D2, C1–C2, X3 |
| CA-22 (proveedores) | S3, D4, C3, X5 |
| CA-31 (b) (búsqueda sin acentos) | S3, D5, D6, X4 |
| CA-24 (vuelta atrás con `main` y T2) | V1–V7 |
| DT-5 (regla de inmutabilidad, DoD del PR 1) | L1–L4 |
| CA-26 (regresión de lo tocado) y DoD | S1–S5, R1–R4, A1–A3 |

### Riesgos identificados

- **R-1. Relleno de la migración.** El `INSERT … SELECT` toma bloqueos compartidos sobre las filas de `inventory_item` (InnoDB, aislamiento por defecto). El plan dice que "no bloquea nada existente": se mide con carga (M3). En producción no hay artículos, así que el impacto esperado es nulo; un bloqueo medible en desarrollo sería una observación, no un defecto.
- **R-2. Existencia ausente.** Un artículo creado por la imagen de T2 durante una vuelta atrás no tiene existencia. La creación defensiva de `lockStock` dentro de una transacción `Serializable` puede interbloquearse si dos ediciones llegan a la vez (C2).
- **R-3. Búsqueda en MySQL.** Ahora busca en `name` con `utf8mb4_es_0900_ai_ci` y trae los ids en una consulta aparte. Riesgos: comodines (`%`, `_`, `\`), la ñ, que la memoria y MySQL difieran en caracteres raros (riesgo ya aceptado en el plan; se registra como observación), y regresiones del filtro (estado, tipo, categoría, SKU y paginación).
- **R-4. Regla de lint.** Solo detecta las formas `x.inventoryDocument.update(...)`. Puede no detectar desestructuración, acceso calculado, alias o SQL crudo (`$executeRaw`). DT-5 tiene a `inventory:verify` (PR 1b) como respaldo: una omisión se registra como observación, salvo que deje sin cubrir una forma que el plan aprobado nombra.
- **R-5. Vuelta atrás.** Hay dos limitaciones documentadas en el plan: las altas de T2 no crean la existencia, y T2 no bloquea la unidad de un artículo con movimientos. Un efecto más amplio que ese sería un defecto.
- **R-6. Pruebas permanentes.** Deben ser funcionales, no estar duplicadas y durar menos de 20 s por archivo (`testing.md`). La prueba MySQL simula un movimiento con `inventoryStock.update` (lo permite la regla de lint).
- **R-7. Trabajos de arrastre.** Afectan a `.claude/rules/git.md` y a REQ-F-049. Solo puede cambiar el texto autorizado.

### Pruebas funcionales

Todas sobre MySQL 8.4 local (`npm run db:up`). Las bases son propias, con prefijo `restaurante_test_qa051_`, y se crean con `TEST_ADMIN_DATABASE_URL`. Las sondas se escriben en el scratchpad y se ejecutan desde la raíz del worktree, importando los paquetes. Nunca se toca la base de desarrollo ni la de producción.

- **D1. Alta en MySQL** (`createInventoryRepository` sobre el store de Prisma). Se crean un simple, un padre, dos variantes, un Compuesto, un no inventariable y un Intermedio. Esperado: existencia 0, `avg_cost` y `last_cost` nulos y `last_seq` 0 en todos salvo el padre, que no tiene fila (DT-T3-2: también los Compuestos y no inventariables tienen fila).
- **D2. Importación A5 y semilla en MySQL.** Se ejecutan `runMasterImport` con `ficticio.json` y `seedInventoryDev` sobre bases nuevas. Esperado: filas de existencia = artículos que no son padres, sin huérfanas.
- **D3. RN-T3-11 en MySQL**, simulando el movimiento con `last_seq = 1` por SQL. Se prueban:
  - cambiar la unidad base;
  - cambiar un factor, añadir un empaque y quitar un empaque;
  - pasar a no inventariable;
  - con `last_seq = 0`: todo se permite, y el atributo inventariable va y vuelve;
  - con movimientos: el nombre, la categoría y el costo de referencia siguen editables, y la ficha dice `locked`.
  - Esperado: `ItemLockedError` o error en el campo `inventoriable`, sin escribir nada (versión e historial sin cambios).
- **D4. Proveedores en MySQL.**
  - alta con teléfono, con correo y sin contacto;
  - nombre repetido con otras mayúsculas;
  - inactivar libera el nombre;
  - reactivar con el nombre en uso (422 por campo);
  - edición con versión vieja (`SupplierConflictError` con quién guardó) y "guardar encima";
  - edición sin cambios (sin versión ni historial);
  - `inventory_change` con `entity = 'supplier'`, sin registrar nada fuera de esa tabla;
  - lista por estado, búsqueda y página 2 (51 proveedores).
- **D5. Búsqueda en MySQL.**
  - "cárne", "CARNE" y "carne" encuentran "Carne de res";
  - "PIÑA" encuentra "Piña", y "pina" no;
  - "ñ" escrita descompuesta (`n` + U+0303);
  - búsqueda por SKU;
  - combinada con estado, tipo y categoría, más la paginación y el total;
  - `%`, `_` y `\` se buscan como texto literal.
- **D6. Diferencial memoria frente a MySQL.** La misma lista de nombres y consultas (acentos, diéresis, ñ, mayúsculas, `ç`, `ß`, `æ`/`œ`, espacios) en los dos stores. Las diferencias se registran como observación (R-3), salvo en los casos de CA-31 (b).

### Pruebas negativas y casos límite

- **N1.** `lockStock` con:
  - un id inexistente;
  - un id de un padre;
  - ids repetidos y desordenados;
  - una lista vacía.
  - Esperado: no falla, no crea filas para el padre ni para el inexistente, y bloquea en orden ascendente.
- **N2.** Validación del proveedor:
  - contacto de 6 y de 21 dígitos;
  - teléfono más correo juntos;
  - 121 caracteres;
  - tipo no texto;
  - nombre de 81 caracteres o vacío.
  - Esperado: error por campo.
- **N3.** Un artículo creado por SQL sin existencia (el caso de "una imagen anterior"):
  - la edición la crea;
  - `isInUse` y `hasMovements` dan `false`;
  - la ficha se lee sin error.

### Pruebas de concurrencia (MySQL; 10 rondas cada una salvo que se indique otra cosa)

- **C1. Altas.**
  - 20 `createItem` simultáneos con nombres distintos: 20 artículos y 20 existencias.
  - 2 a 5 simultáneos con el mismo nombre: un artículo, una existencia, el resto `ItemNameTakenError` o error por campo, y ninguna existencia huérfana.
- **C2. Existencia ausente.** Dos ediciones simultáneas de un artículo sin existencia: una existencia; la otra edición termina en conflicto de versión o se aplica tras el reintento, sin errores fuera de la jerarquía del dominio.
- **C3. Proveedores.**
  - Dos altas con el mismo nombre (otras mayúsculas): una fila.
  - Reactivar A mientras otro renombra B al nombre de A: gana uno; nunca quedan dos activos con la misma `name_key`.
- **C4. Carrera de RN-T3-11.** Una sesión externa toma `SELECT … FOR UPDATE` de la existencia, espera unos 1–2 s, fija `last_seq = 1` y confirma. Mientras tanto, `updateItem` pasa a no inventariable. Esperado: la edición espera y termina rechazada. En el orden inverso (la edición confirma primero), el cambio se aplica.
- **C5. Espera agotada.** Con la existencia bloqueada más de 5 s por una sesión externa, `updateItem` termina en `InventoryBusyError` (unos 5 s) sin escribir nada. Se libera el bloqueo al terminar.
- **C6.** En C1–C5: cero errores fuera de la jerarquía del dominio, y ninguna línea de log con SQL, nombres ni contactos.

### Pruebas de la migración

- **M1. Desde cero.** Base nueva y `prisma migrate deploy` del worktree. Esperado:
  - las 4 migraciones aplicadas;
  - `migrate status`: "up to date";
  - `migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`: código 0;
  - `migrate diff --from-migrations … --to-schema … --exit-code`: código 0.
- **M2. Sobre una base con datos de T2.**
  - Se migra hasta `20261119200000_inventario_recetas` con el código de T2 (copia de `ad50c50`).
  - Se carga con T2: la semilla, el fixture A5, un padre con variantes, un Compuesto con receta vigente y un no inventariable.
  - Se toman conteos y `CHECKSUM TABLE` de las tablas `inventory_*` existentes, `user` y `_prisma_migrations`.
  - Se aplica la migración nueva con el `migrate deploy` del worktree.
  - Esperado: las tablas anteriores conservan conteos y checksums, y solo `_prisma_migrations` gana una fila.
- **M3. Bloqueos del relleno (R-1).** Se repite M2 con carga en paralelo (2 lectores y 2 escritores transaccionales sobre `inventory_item`). Se registran:
  - la latencia máxima;
  - los `ER_LOCK_WAIT_TIMEOUT` y `ER_LOCK_DEADLOCK`;
  - si algún artículo insertado durante la migración quedó sin existencia. Si quedó, se comprueba que `lockStock` lo repara (N3).
- **M4. `information_schema`.**
  - Las 4 tablas, y cada columna de texto, en `utf8mb4_es_0900_as_cs`.
  - `type`, `cost_basis` y `reason` en `VARCHAR`, no en ENUM (DT-T3-1).
  - Precisiones `DECIMAL(13,3)`, `(15,4)` y `(19,4)`.
  - Únicos `(item_id, seq)`, `(document_id, line)`, `reverses_document_id`, `idempotency_key` y `active_name_key`.
  - Las 9 FK con `ON DELETE RESTRICT`.
  - Todo frente al DDL del Technical Action Plan.
- **M5. Relleno.**
  - Filas de `inventory_stock` = artículos con `kind <> 'parent'`, y ningún padre.
  - Cantidad 0, `avg_cost` y `last_cost` nulos, y `last_seq` 0.
  - Con una base sin artículos, el relleno no inserta nada.
- **M6. Permisos.** Se lee `docker/mysql/initdb/01-usuarios.sh` (el migrador tiene `INSERT`). Si el `root` del MySQL local lo permite, se aplica M1 con un usuario temporal que tiene exactamente los permisos del migrador sobre una base `restaurante_test_qa051_*`. El usuario se borra al terminar.

### Pruebas de vuelta atrás (CA-24)

Se usa el mismo método que el QA de REQ-F-050 (V1–V6), con el código fuente arrancado con `node src/server.ts` y un env propio en el scratchpad que apunta a la base de QA (nunca al `.env` de desarrollo):

- `main`: `74ca737`, desde `/Users/orvigas/Desktop/Negocio/restaurante`, solo lectura. Si falta su cliente de Prisma generado, una copia con `git archive`.
- T2: `ad50c50`, en una copia con `git archive` en el scratchpad, con `node_modules` copiado con `cp -a` (no enlazado, para que `@restaurante/*` resuelva a la copia; se verifica con `realpath`) y `prisma generate` en la copia. Antes se comprueba que `package-lock.json` es idéntico entre `ad50c50` y la rama.

Construir las imágenes Docker no forma parte de este plan (ver "Decisiones para la aprobación").

- **V1.** Base de M2 ya migrada a T3, con un artículo con `last_seq = 1` (por SQL) y un proveedor.
- **V2.** La `api` de `main` sin `DATABASE_ALLOW_NEWER_SCHEMA` termina con `DATABASE_NEWER_THAN_CODE`.
- **V3.** La `api` de `main` con la variable:
  - arranca, con el aviso de las migraciones más nuevas;
  - productos y página públicos de los dos negocios: 200;
  - acceso al admin, productos y página del admin: 2xx;
  - la `landing-pages` de `main` contra esa `api`: `/`, `/birria` y `/molotes` en 200 con productos;
  - cero errores en el log.
- **V4.** La `api` de T2 sin la variable termina con `DATABASE_NEWER_THAN_CODE`. Con la variable, arranca y responden:
  - la lista, la ficha, las categorías y las recetas (lista, detalle y guardar una versión);
  - el alta de un artículo (sin existencia, como prevé DT-T3-2);
  - la edición;
  - el `inventory-manager` de T2: acceso y lista de inventario en 200.
- **V5. Límites documentados (R-5).**
  - Con T2, el artículo con `last_seq = 1` admite cambiar la unidad. Es la limitación descrita y no debe ir más allá.
  - Las tablas nuevas no se tocan, salvo la ausencia de existencia en las altas de T2.
- **V6.** De vuelta en la `api` del worktree, sin la variable:
  - arranca sin avisos nuevos;
  - la lista y la ficha del artículo dado de alta por T2 se leen;
  - su edición le crea la existencia;
  - la búsqueda sin acentos funciona sobre esos datos.
- **V7.** El resultado se contrasta con la nota de vuelta atrás del plan (el README la recogerá en el PR 2 o 3). Un efecto más amplio que el descrito es un defecto.

### Pruebas de la regla de lint (DT-5)

Las sondas son descartables y no se commitean:

- **L1. Configuración efectiva.** `npx eslint --print-config` sobre un archivo existente de cada bloque que configura `no-restricted-syntax` (`api/src`, `api/tests`, `inventory-manager/src`, `inventory-manager/tests`, `landing-pages/src`, `landing-pages/tests`, `packages/{core,contracts,web,db}`). Esperado: los dos selectores `KARDEX_IMMUTABLE` están presentes en los 12 bloques y conviven con las restricciones anteriores (comparación con `ad50c50`).
- **L2. Detección.** Con `eslint --stdin --stdin-filename <ruta de cada bloque>` (sin escribir archivos):
  - marca `update`, `updateMany`, `updateManyAndReturn`, `upsert`, `delete` y `deleteMany` sobre `inventoryDocument` e `inventoryMovement`;
  - marca `delete` y `deleteMany` sobre `inventoryStock`;
  - no marca `create`, `createMany`, `findMany` ni `inventoryStock.update`.
  - Si el linter con tipos rechaza `--stdin` para una ruta nueva, se usa un archivo temporal solo en `restaurante/landing-pages/tests/` (autorizado) y la cobertura de los demás bloques se apoya en L1.
- **L3. Formas no cubiertas (R-4):** desestructuración, alias, acceso calculado (`['update']`) y `$executeRaw` con `UPDATE`/`DELETE`. Se registran como observaciones.
- **L4.** `npm run lint` en verde sobre el árbol sin sondas, y la sonda borrada.

### Pruebas de regresión

- **S1.** `npm run build:css` y `npm run typecheck`: código 0.
- **S2.** `npm run lint`, con `check-private-data`: código 0, sin avisos.
- **S3.** `npm test` completo en las tres apps, sin fallos. Se compara el número de archivos y de pruebas con el del Implementation Result (api 56/1253, landing-pages 64/907, inventory-manager 18/297).
- **S4. Duración.** `prisma-inventory-store.test.ts` e `inventory-kardex.test.ts` se miden con el reporter de Vitest: menos de 20 s cada uno (`testing.md`).
- **S5. Blast radius.** CodeGraph indexa `main`, no la rama. Para los símbolos tocados (`itemWhere`/`listItems`, `isInUse`, `hasMovements`, `insertItem`, `updateItem`, `searchKey`/`nameKey`, `readListFilter` de recetas) se usa `codegraph explore` para listar los consumidores y las pruebas de la épica, y se confirma que la suite los ejecuta. Lo que no esté cubierto se ejerce en D1–D6.
- **S6. `deploy/`.** `git diff ad50c50 --stat` no toca `deploy/` (la suma no cambia), ni `package.json`, `package-lock.json`, `Dockerfile`, `compose.yaml` ni `.env.example`.

### Revisión de las pruebas permanentes (`testing.md`)

- **R1.** Cada prueba nueva o modificada (`api/tests/unit/inventory-kardex.test.ts`: 8 casos; el bloque nuevo de `prisma-inventory-store.test.ts`: 4 casos) protege un comportamiento de la app (proveedores, existencia en el alta, bloqueo por uso, búsqueda) y no es de arquitectura ni de mudanza.
- **R2. Duplicados.** Se busca con CodeGraph y, si hace falta, con grep, si ya había pruebas de lo mismo: por ejemplo, el bloqueo de unidad con `markInUse` de T1/T2, o la búsqueda de la lista. Un duplicado se informa.
- **R3.** No se borran ni se debilitan pruebas existentes (diff de `tests/`), no hay `retry` ni `testTimeout` nuevos, y cada caso usa la prueba más barata posible (memoria antes que MySQL).
- **R4.** En el árbol final no queda ninguna sonda de QA, y `git status` coincide con el del Implementation Result.

### Mutaciones (descartables)

Se hacen en una copia del árbol en el scratchpad (`rsync` del worktree sin `node_modules`, más `cp -a` de `node_modules`), nunca en el worktree:

- **X1.** `hasMovements` siempre `false` en Prisma: debe fallar la prueba MySQL de RN-T3-11.
- **X2.** Sin la llamada a `lockStock` en `updateItem`: se registra si alguna prueba falla. Si ninguna falla, es una observación (carrera cubierta solo por C4 y por el 1b).
- **X3.** `insertItem` de Prisma sin crear la existencia: debe fallar la prueba MySQL del alta.
- **X4.** `searchKey` sin quitar acentos, y otra mutación sin la excepción de la ñ: deben fallar las pruebas de búsqueda.
- **X5.** Reactivar sin `checkName`: debe fallar la prueba unitaria de CA-22.

### Trabajos de arrastre y documentación

- **A1.** `.claude/rules/git.md`: solo cambian las dos frases autorizadas por P-3.
- **A2.** REQ-F-049:
  - quedan 0 menciones de "REQ-F-054 y siguientes" y "REQ-F-054+";
  - existen la sección "PR de la épica hacia `main`" (pendiente), el estado corregido y la entrada del historial que cita PV-T3-13;
  - no hay otros cambios.
- **A3.** `.claude/CLAUDE.md` y `.claude/agents/senior-fullstack.md` sin cambios en la rama.

### Pruebas que no aplican en el 1a

- **Pruebas en navegador, responsive, accesibilidad, UX/UI frente a `_stich_source_/`, SEO, WhatsApp y performance del frontend:** el 1a no cambia vistas, CSS, JS de navegador ni rutas. V3 cubre con HTTP que las landings de `main` siguen respondiendo. No se usa Claude in Chrome.
- **Performance del backend:** solo M3 (bloqueos del relleno) y la duración de las pruebas (S4).

### Evidencia requerida

- La salida de cada comando, con su código de salida.
- Las consultas a `information_schema`, los conteos y los `CHECKSUM TABLE`.
- Los resultados de las sondas por ronda.
- Los logs de arranque de V2 a V6 (solo los códigos de evento, sin datos).
- La salida de ESLint de L1 y L2.
- El resultado de cada mutación.
- Todo queda en el QA Report del ticket.

### Criterios de aprobación

- CA-19, CA-20 y CA-22 (partes del modelo), CA-31 (b) y CA-24 en PASS, con evidencia.
- M1–M5 sin diferencias.
- L1–L2 cubren las formas nombradas en el plan.
- S1–S3 en verde y S4 por debajo de 20 s.
- Sin defectos `BLOCKER` ni `CRITICAL`. Los `MAJOR` necesitan una decisión del usuario.
- Las observaciones (R-1, R-3, R-4 y X2) no bloquean la aprobación si se registran.

### Limpieza

Al terminar, también si algo falla:

- se borran las bases `restaurante_test_qa051_*`, tras confirmar el prefijo;
- se borra el usuario temporal de M6;
- se detienen los procesos de `api`, `landing-pages`, `inventory-manager` y Vitest de V y de las sondas, y se liberan sus puertos;
- se borran las copias de T2 y de las mutaciones en el scratchpad, y las sondas;
- se comprueba con `git worktree list`, `lsof`/`ps` y `SHOW DATABASES LIKE 'restaurante\_test%'`.

### Decisiones para la aprobación

1. **CA-24 con código fuente** (como el QA de REQ-F-050) en lugar de construir las imágenes Docker de `main` y de T2. Construir las imágenes (`landing-pages/Dockerfile`, objetivo `api`) es posible, pero mucho más lento, y no añade cobertura a la lectura de la base. ¿Basta con el código fuente?
2. **M6:** ¿se autoriza crear, y borrar al terminar, un usuario temporal con los permisos del migrador, limitado a una base `restaurante_test_qa051_*` del MySQL local? Si no, M6 queda como revisión estática.
3. **L2:** si `--stdin` no funciona con el linter con tipos, ¿se autoriza una sonda temporal en `restaurante/landing-pages/tests/`, que se borra al terminar?

## QA Report — PR 1a

### Ronda

1. Rama `feature/REQ-F-051-kardex-modelo` sin commit, sobre `ad50c50`. Plan aprobado por el usuario: "Sí, apruebo el plan de QA con las tres respuestas", que son:

- CA-24 con el código fuente de `main` (`74ca737`) y de T2 (`ad50c50`);
- M6 con un usuario temporal con los permisos del migrador;
- L2 con una sonda en `landing-pages/tests/` si `--stdin` no funcionaba. No hizo falta.

### Pruebas ejecutadas

Todo sobre el MySQL 8.4 local, en bases `restaurante_test_qa051_*` propias.

| ID | Acción | Resultado |
|---|---|---|
| S1 | `npm run build:css` y `npm run typecheck` | Código 0 y 0. PASS |
| S2 | `npm run lint` | Código 0, sin avisos; `check-private-data`: 885 archivos, sin datos privados. PASS |
| S3 | `npm test` | api 56/1253, landing-pages 64/907 e inventory-manager 18/297, todo en verde: igual que el Implementation Result. Código 0. PASS |
| S4 | Duración de los archivos nuevos | `prisma-inventory-store.test.ts`: 4.32 s, con la preparación de la base. `inventory-kardex.test.ts`: 0.14 s. Los dos por debajo de 20 s. PASS |
| S5 | Consumidores de lo tocado | CodeGraph indexa `main`, donde no está el inventario; lo avisa y no da resultados útiles. Fallback con grep sobre el worktree: `api/src/admin/inventory-routes.ts`, `inventory-dev-seed`, `master-import` y los repositorios de core. Los cubren `admin-inventory-api`, `inventory-catalog`, `inventory-kardex` y `prisma-inventory-store`, todos en la suite, más D1 a D6. PASS |
| S6 | `git diff ad50c50` | Sin cambios en `deploy/`, `package.json`, `package-lock.json`, el Dockerfile, `compose.yaml` ni `.env.example`. PASS |
| M1 | Migración desde cero (`migrate deploy`) | Las 7 migraciones aplicadas. `migrate status`: "up to date". `migrate diff --from-config-datasource --to-schema --exit-code`: "No difference detected", código 0. `--from-migrations --to-schema --exit-code`: código 0. PASS |
| M2 | Bases de T2 creadas con el código de T2: una con la semilla (22 artículos: 2 padres, 4 variantes, 4 Compuestos, 1 no inventariable y 3 recetas) y otra con el fixture A5 (16 artículos). Después, la migración del worktree | `CHECKSUM TABLE` de `inventory_category`, `_item`, `_item_unit`, `_sku`, `_change`, `_recipe_version`, `_recipe_line`, `_lock` y `user`: idénticos antes y después. `_prisma_migrations` pasa de 6 a 7. `migrate status`: "up to date". PASS |
| M3 | M2 con carga en paralelo (2 lectores y 2 escritores transaccionales sobre `inventory_item`) | Aplicada. Durante la migración: 11 093 lecturas y 5 045 escrituras, latencia máxima de 19 ms en lectura y 50 ms en escritura, 0 `ER_LOCK_WAIT_TIMEOUT`. Hubo 56 `ER_LOCK_DEADLOCK`, pero la misma carga sin migrar también da interbloqueos (24 en unos 9 s): son entre los dos escritores. Los artículos insertados después del relleno quedan sin existencia, como prevé DT-T3-2; N3, C2 y V6 comprueban que se reparan. PASS (OBS-3) |
| M4 | `information_schema` | Las 4 tablas y sus 16 columnas de texto en `utf8mb4_es_0900_as_cs`. `type`, `cost_basis` y `reason` en `varchar` (DT-T3-1). Precisiones `decimal(13,3)`, `(15,4)` y `(19,4)`, y `occurred_on` en `date`. Únicos `(item_id, seq)`, `(document_id, line)`, `reverses_document_id`, `idempotency_key` y `active_name_key`. Índices `(type, id)`, `(supplier_id, id)`, `source_document_id` y `source_movement_id`. 9 FK `RESTRICT`/`CASCADE`. Todo coincide con el plan. PASS |
| M5 | Relleno | Base de semilla: 20 artículos que no son padres y 20 existencias. Base A5: 15 y 15. Ningún padre con fila. Todas en 0, sin costo y con `last_seq` 0. Base vacía: 0 filas. PASS |
| M6 | Usuario temporal con exactamente los permisos de `restaurante_migrator` (`SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES`), en una base de T2 con un simple y un padre | La migración se aplica; el relleno crea la fila del simple y no la del padre. Usuario borrado. PASS |
| D1 | Altas en MySQL | Simple, 2 variantes, Compuesto, no inventariable e Intermedio con existencia 0 y sin costo; el padre, sin fila. PASS |
| D2 | `inventory:seed-dev` y `inventory:import --escribir` (fixture A5) con el código del worktree | 20 de 20 y 15 de 15 existencias, sin padres, todas en 0. PASS |
| D3 | RN-T3-11 en MySQL (`last_seq = 1` por SQL) | Sin movimientos, se permite cambiar la unidad, los empaques y el atributo inventariable, de ida y vuelta. Con movimientos, `ItemLockedError` al cambiar la unidad, un factor, o al añadir o quitar un empaque, y error en el campo `inventoriable` al pasarlo a no inventariable. Versión e historial sin cambios. El nombre y el costo de referencia siguen editables, y la ficha dice `locked`. PASS |
| D4 | Proveedores en MySQL | Alta con teléfono, con correo y sin contacto. Nombre repetido con otras mayúsculas: error por campo. Inactivar libera el nombre; reactivar con el nombre en uso, error por campo. Conflicto de versión con `updatedBy`. "Guardar encima" queda en el historial (`overwrite_after_conflict`, `update`, `create`). Una edición sin cambios no crea versión. 54 proveedores: página 1 con 50 y página 2 con 4. Filtro de inactivos. PASS |
| D5 | Búsqueda en MySQL | "cárne", "CARNE" y "carne" encuentran "Carne de res". "PIÑA" encuentra "Piña"; "pina" no encuentra nada. La ñ descompuesta (`n` + U+0303) funciona. SKU `caf-0`. `%`, `_` y `\` se buscan como texto. Filtros de tipo, estado y categoría correctos. 55 resultados: 50 + 5, total 55. PASS |
| D6 | Diferencial memoria frente a MySQL (ü, ç, ß, æ, œ, mayúsculas, ñ y espacios) | Sin diferencias en las 11 consultas. PASS |
| N1 | `lockStock` con lista vacía, un id inexistente, un padre e ids repetidos | Sin errores; no crea fila para el padre ni para el inexistente. PASS |
| N2 | Validación del proveedor | 6 o 21 dígitos, teléfono más correo, 121 caracteres y un valor que no es texto: error en `contact`. Nombre de 81 caracteres o vacío: error en `name`. 7 y 20 dígitos se aceptan. PASS |
| N3 | Artículo creado por SQL sin existencia (el caso de "una imagen anterior") | `isInUse` y `hasMovements` dan `false`, la ficha se lee y la edición crea la fila. PASS |
| C1 | 10 rondas | 20 altas simultáneas con nombres distintos: 20 artículos y 20 existencias en cada ronda. 5 simultáneas con el mismo nombre: 1 alta, el resto errores del dominio. 0 existencias huérfanas. PASS |
| C2 | 10 rondas: dos ediciones de un artículo sin existencia | Siempre una aplicada y la otra `InventoryConflictError`; una sola fila; ningún interbloqueo visible. PASS |
| C3 | 10 rondas | Dos altas con el mismo nombre: 1 fila. Reactivar A mientras otro renombra B a "A": gana uno, nunca dos activos con la misma clave, y solo errores del dominio. PASS |
| C4 | Una sesión externa bloquea la existencia, espera 1.5 s y fija `last_seq = 1` | 10 de 10: la edición a no inventariable espera unos 1.5 s y termina rechazada en el campo `inventoriable`, sin cambios. En el orden inverso, 10 de 10 se aplican. PASS |
| C5 | Existencia bloqueada más de 5 s | `InventoryBusyError` a los 5 020 ms; nombre, versión e historial sin cambios. PASS |
| C6 | Logs durante D, N y C | Core no escribe nada: 0 líneas, sin SQL, nombres ni contactos. PASS |
| V1 | Base de M2 migrada a T3, más "Masa de maíz" con `last_seq = 1` y un proveedor | Preparada. |
| V2 | `api` de `main` sin `DATABASE_ALLOW_NEWER_SCHEMA` | Sale con `DATABASE_NEWER_THAN_CODE`, código 1. PASS |
| V3 | `api` de `main` con la variable | Arranca, con el aviso de las 4 migraciones más nuevas. Productos y página públicos de los dos negocios: 200. Acceso al admin: 201. Sesión, productos y página de los dos negocios y usuarios: 200. La `landing-pages` de `main` contra esa `api`: `/`, `/birria` y `/molotes` en 200, con `landing_products_loaded` desde la `api` para los dos negocios. 0 errores en los logs. PASS |
| V4 | `api` de T2 | Sin la variable: `DATABASE_NEWER_THAN_CODE`. Con ella: arranca, con el aviso de la migración de T3. Lista 200 (22), 22 de 22 fichas en 200, categorías y recetas 200. Guardar una versión de receta: 201 (v2). Alta: 201, sin existencia, como prevé DT-T3-2. Edición: 200. El `inventory-manager` de T2: acceso 303, y lista, ficha, recetas y búsqueda en 200. 0 errores. PASS |
| V5 | Límites documentados | Con T2, el artículo con `last_seq = 1` admite cambiar la unidad (200, a `g`) y no dice `locked`. Es exactamente la limitación del plan (solo en desarrollo). No hubo ningún otro efecto. PASS |
| V6 | `api` del worktree sin la variable, sobre esa base | Arranca sin avisos nuevos frente a T2: solo `admin_bootstrap_ignored` y `products_notify_disabled`, que vienen del env de QA. Lista 200 (23), 23 de 23 fichas, "Masa de maíz" con `locked = true`, búsqueda "máSA" encuentra "Masa de maíz", y la edición del artículo dado de alta por T2 (200) le crea la existencia en 0. PASS |
| V7 | Comparación con la nota de vuelta atrás del plan | Coincide; no hay efectos más amplios. PASS |
| L1 | `eslint --print-config` en los 12 bloques que configuran `no-restricted-syntax` | Los 2 selectores `KARDEX_IMMUTABLE` están en todos. Quitando esos dos, la configuración es idéntica a la de `ad50c50`. PASS |
| L2 | Sonda por `--stdin` con el nombre de un archivo existente de cada bloque (con un nombre nuevo, el lint con tipos da "Parsing error") | En los 11 bloques probados marca las 14 llamadas prohibidas (6 métodos sobre `inventoryDocument` e `inventoryMovement`, y `delete` y `deleteMany` sobre `inventoryStock`). No marca `create`, `createMany`, `findMany` ni `inventoryStock.update`. No hizo falta escribir ningún archivo. PASS |
| L3 | Formas no cubiertas | Desestructuración, alias, acceso calculado (`tx['inventoryMovement'].update` y `.inventoryMovement['delete']`) y `$executeRaw` con `UPDATE`: no se marcan (OBS-1). |
| L4 | `npm run lint` | En verde (S2); no quedó ninguna sonda. PASS |
| X1 | Mutación: `hasMovements` e `isInUse` de Prisma sin mirar `last_seq` | Falla 1 prueba MySQL. Detectada |
| X2 | Mutación: sin `lockStock` en `updateItem` | Falla la prueba MySQL de DT-T3-2 (la existencia ausente ya no se crea al editar). Las de memoria pasan, como es de esperar. Detectada |
| X3 | Mutación: `insertItem` de Prisma sin existencia | Fallan 2 pruebas MySQL. Detectada |
| X4 | Mutaciones de la búsqueda | `searchKey` sin quitar acentos: fallan 2 unitarias. Sin la excepción de la ñ: fallan 2 unitarias. MySQL con `as_cs`: fallan 2 MySQL. Detectadas |
| X5 | Mutación: reactivar sin `checkName` | No falla ninguna prueba: el mutante es equivalente, porque la clave única del store (`SupplierNameTakenError`) da el mismo error por campo (OBS-2) |
| R1 | Pruebas permanentes | 8 unitarias y 4 MySQL nuevas, todas funcionales (proveedores, existencia en el alta, bloqueo por uso y búsqueda). Ninguna de arquitectura ni de mudanza. PASS |
| R2 | Duplicados | `inventory-catalog.test.ts` ya cubre RN-4 con `markInUse`. Lo nuevo prueba otra fuente del bloqueo (los movimientos) y el atributo inventariable. Las pruebas de memoria y de MySQL ejercen implementaciones distintas (`searchKey` y la colación; el estado en memoria y `last_seq`). No hay duplicados. PASS |
| R3 | Diff de `tests/` frente a `ad50c50` | Solo +50 líneas en `prisma-inventory-store.test.ts`, ninguna borrada, sin `retry` ni `testTimeout`. PASS |
| R4 | `git status` final | Idéntico al del Implementation Result. PASS |
| A1–A3 | Trabajos de arrastre | `git.md`: solo las dos frases de P-3. REQ-F-049: 0 menciones de "REQ-F-054+" o "REQ-F-054 y siguientes", sección "PR de la épica hacia `main`" pendiente, estado corregido y entrada de historial con PV-T3-13. `.claude/CLAUDE.md` y `senior-fullstack.md` sin cambios. PASS |

### Criterios de aceptación

| CA | Estado | Evidencia |
|---|---|---|
| CA-19 (modelo) | PASS | S3, D3, C4, C5, X1 y X2 |
| CA-20 (modelo) | PASS | S3, M5, D1, D2, C1, C2, N3 y X3. La compra "al instante" se valida en el 1b y el 2 |
| CA-22 | PASS | S3, D4, N2 y C3 |
| CA-31 (b) | PASS en core y en el store | S3, D5, D6 y X4. Las pantallas se validan en el PR 3 |
| CA-24 | PASS | V1 a V7 |
| DT-5 (lint) | PASS | L1, L2 y L4, con OBS-1 |

### Defectos encontrados

Ninguno.

### Observaciones (no bloquean)

- **OBS-1 (DT-5).** La regla de lint no detecta la desestructuración, los alias, el acceso calculado ni el SQL crudo (`$executeRaw`/`$queryRaw` con `UPDATE` o `DELETE`). El plan solo pedía las formas `x.inventoryDocument.update(...)`, y `inventory:verify` (PR 1b) es el respaldo previsto. Recomendación: anotarlo en `arquitectura.md` cuando se documente DT-5. Opcionalmente, se puede ampliar el selector a las propiedades calculadas.
- **OBS-2 (X5).** Quitar la comprobación previa del nombre al reactivar no rompe ninguna prueba, porque la clave única da el mismo error. No es una carencia de pruebas, sino defensa en profundidad.
- **OBS-3 (M3).** El relleno no produjo esperas agotadas. La latencia máxima de escritura durante la migración fue de 50 ms, frente a 26 ms sin migrar. En producción no hay artículos, así que el efecto es nulo.
- **OBS-4 (V2/V4).** `DATABASE_NEWER_THAN_CODE` nombra solo la migración más nueva. Es el comportamiento existente de `verify.ts`, no un cambio del 1a.

### Regresión

Suite completa en verde (S3), con los mismos totales que antes. Siguen funcionando las landings, el admin y la `api` de `main` (V3), el catálogo y las recetas de T2 (V4) y su admin. Los consumidores de lo tocado los cubren las pruebas (S5).

### Responsive, Accesibilidad, UX/UI, SEO

No aplican: el 1a no cambia vistas, CSS, JS de navegador ni rutas. No se usó navegador; V3 comprueba por HTTP que las landings siguen respondiendo.

### Performance

M3 (bloqueos del relleno) y S4 (duración de las pruebas): sin hallazgos que bloqueen.

### Pendientes de revisión manual

Ninguno.

### Limpieza

- Se borraron las 10 bases `restaurante_test_qa051_*` (`SHOW DATABASES LIKE 'restaurante\_test%'` devuelve 0) y el usuario temporal `qa051_migrator` (0 en `mysql.user`).
- Se detuvieron todos los servidores de V; los puertos 3101 a 3110 están libres y no queda ningún proceso de Vitest ni de las sondas.
- Se borraron las copias de `main`, de T2 y de las mutaciones, y las sondas del scratchpad.
- `git worktree list` muestra solo `main` y el worktree del ticket, que queda como estaba.

### Resultado final

QA_APPROVED

## Pendientes del PR 1a para los PR 1b, 2 y 3

Salen de las observaciones del QA del PR 1a. Ninguna bloquea.

- **OBS-1 (DT-5, regla de lint): se documenta en el PR 1b, con la inmutabilidad y `inventory:verify`.** Va en la sección de inmutabilidad de `restaurante/docs/arquitectura.md`. Si la documentación de arquitectura se deja para el PR 3, se hace ahí. Se documenta que la regla solo cubre las llamadas directas (`x.inventoryDocument.update(...)` y similares) y no detecta la desestructuración, los alias, el acceso calculado ni el SQL crudo (`$executeRaw` o `$queryRaw` con `UPDATE` o `DELETE`). El respaldo de esos casos es `inventory:verify` (PR 1b). Ampliar el selector a las propiedades calculadas es opcional y se decidirá en el PR 1b.
- **OBS-2 (X5):** la comprobación previa del nombre al reactivar es defensa en profundidad, porque la clave única da el mismo error. No necesita una prueba nueva.
- **OBS-3 (M3):** el relleno de la migración no provocó esperas agotadas. En producción no hay artículos, así que no hace falta ninguna acción.
- **OBS-4 (V2/V4):** `DATABASE_NEWER_THAN_CODE` solo nombra la migración más nueva. Es el comportamiento que ya tenía `verify.ts`, fuera del alcance de T3. Si se quiere cambiar, irá en un ticket aparte.

## Implementation Result — PR 1b

### Rama

`feature/REQ-F-051-kardex-dominio` (worktree `.claude/worktrees/req-f-051-pr1b`), creada desde `origin/epic/inventario` (`27c7a25`, con el 1a mergeado) y sin upstream. Destino: `epic/inventario`. Sin commit.

### Cambios realizados

- **Core (`packages/core/inventory`):**
  - `kardex-schema.ts`:
    - los 11 tipos (DT-T3-1): 5 que se escriben en T3 y 6 reservados;
    - etiqueta legible, con "Movimiento (tipo no reconocido)" para un valor desconocido;
    - criterio de costo, motivos de ajuste, límites (50 líneas, folio de 40, nota de 400, ventana de 31 días) y las formas `StockRow`, `KardexDocument` y `KardexMovement`.
  - `kardex-math.ts`: el único módulo de cálculo, en `bigint`.
    - `purchaseUnitCost` (importe / cantidad base, escala 4);
    - `applyEntry` (RN-T3-5);
    - `applyEntryReversal` (RN-T3-6; nunca deja el CPP negativo, ver Riesgos);
    - `nextAvgCost`: decide la regla por tipo y signo, y la usan igual las escrituras y la verificación;
    - `lineValue` y `stockValue`.
  - `business-date.ts`: "hoy" en `BUSINESS_TIMEZONE` con `Intl`, y la fecha del hecho entre hoy − 31 y hoy (RN-T3-3, CA-11).
  - `kardex-repository.ts`:
    - **Escrituras:** `createInitialBalance`, `createPurchase`, `createAdjustment`, `createSupplierReturn` y `reverseDocument`.
    - **Lecturas:** `previewReversal`, `getDocument` (con lo que queda por devolver), `listDocuments`, `listStock` (RF-7, DT-T3-5 y DT-T3-8), `itemKardex` (RF-8) y `formOptions`.
    - **Orden de cada escritura:**
      1. valida en el borde (errores `lines.N.campo`);
      2. clave de envío persistente (DT-14);
      3. bloquea el documento de origen y después las existencias;
      4. lee los artículos **después** de bloquear;
      5. calcula en orden e inserta.
    - **Reglas aprobadas:** DT-T3-3 (409 `DocumentHasReturnsError`; la devolución se permite con el artículo o el proveedor inactivos), DT-T3-4 (último costo = última compra no revertida, o vacío) y DT-T3-7 (rechaza el costo escrito en una entrada cuando ya hay CPP).
  - `kardex-verify.ts`: verificador puro (`createKardexVerifier`, y `verifyKardex` por lotes con clave). Las incidencias solo llevan `{ itemId, check, seq }`.
  - `errors.ts`: `DocumentNotFoundError`, `InitialBalanceNotAllowedError`, `AlreadyReversedError`, `ReversalNotReversibleError`, `DocumentHasReturnsError`, `DocumentNotReturnableError`, `DocumentReversedError`, `IdempotencyKeyReusedError` e `IdempotencyRaceError`.
  - `inventory-store.ts`: el contrato añade `kardexTransaction` y los métodos de lectura y escritura del Kardex.
  - `recipe-repository.ts`: el CPP entra en el costo de las recetas (RF-10).
  - `inventory-repository.ts`: la ficha devuelve `stock`.
- **Stores:**
  - **Memoria:** documentos, movimientos y existencias.
  - **Prisma:** `prisma-kardex.ts`, nuevo. Decimales con signo sin coma flotante, y la fecha del hecho como medianoche UTC. Las claves únicas se traducen a `IdempotencyRaceError` y `AlreadyReversedError`. No hay ningún update ni delete de documentos o movimientos.
  - `prisma-inventory-store.ts`: `kardexTransaction` (`ReadCommitted`) y `readTimeoutMs`, este último solo para `verify`.
- **`inventory:verify`:**
  - `api/scripts/inventory-verify.ts` y `api/scripts/support/inventory-verify-cli.ts`;
  - un script en el `package.json` de `api` y otro en el de la raíz;
  - copiado a la imagen `api` en `landing-pages/Dockerfile`. El plan lo dejaba para el PR 2; se adelanta porque es una línea y el README ya lo documenta.
  - Salida: 0 si cuadra, 1 si hay descuadres y 2 si no pudo verificar; solo conteos, ids y nombres de comprobación.
- **Documentación:**
  - `docs/arquitectura.md`: la sección Kardex (costo, concurrencia, idempotencia, inmutabilidad con **los límites de la regla de lint de OBS-1**, verificación y tipos en `VARCHAR`) y el árbol de `core/inventory`;
  - `README.md`: el comando `inventory:verify`.
- **Fuera de este PR, según el plan:**
  - PR 2: contratos, rutas de la API y semilla ampliada;
  - PR 3: pantallas, OBS-12 (a) y (c), `ops/backup` (DT-T3-6 A) y `despliegue.md`.

### Criterios de aceptación (alcance del 1b: dominio y persistencia; API y pantallas en los PR 2 y 3)

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 a CA-4 | PASS | Unitarias: 50.000 kg a 20.0000; CPP 21.3333 y último costo 24.0000; existencia de −2 a 8 con CPP 25.0000; 3.3333 y 6.6667; coma y decimales de más rechazados |
| CA-5, CA-8 | PASS | Saldo de 12.500 a 18.5000; un segundo saldo o uno tras una compra dan 409 con el mensaje "ajuste"; tras revertir el saldo se admite otro |
| CA-6, CA-7 | PASS | 50.000 kg con CPP 20.0000 (19.99995 redondeado hacia arriba); el original no cambia; un segundo intento da `AlreadyReversedError` y una reversión no se revierte; negativo con el CPP conservado y la vista previa lo avisa |
| CA-9, CA-10 | PASS | Compuesto, padre, no inventariable e inactivo marcados por línea, sin escritura; proveedor inactivo rechazado; sin factor de conversión y redondeo a 0 rechazados |
| CA-11 | PASS | Hoy y hoy − 31 se aceptan; mañana, hoy − 32 y el 30 de febrero, no; a las 23:30 y a las 00:30 locales da el día local |
| CA-12 | PASS | Memoria: reenvío y huella distinta. MySQL: un segundo store (simula el reinicio) con dos envíos a la vez deja un solo documento |
| CA-13 | PASS | MySQL: 20 salidas simultáneas, con `seq` del 1 al 21 y 70.000 exactos; 10 documentos cruzados sin errores; `verify` da 0 |
| CA-14 | Parcial | 1205 → 503 `INVENTORY_BUSY` ya existe en `run()`. La espera agotada real es una sonda de QA |
| CA-15 | PASS | Unitaria y MySQL: un `UPDATE` hecho a mano lo detectan `cpp_recalculado` y `existencia_distinta`, sin valores |
| CA-16, CA-17 | PASS (dominio) | Columnas, totales, estados, inactivos (DT-T3-5) y totales redondeados (DT-T3-8); Kardex del más reciente al más antiguo. Las pantallas van en el PR 3 |
| CA-18 | PASS | 0.500 kg a 10.0000 con origen `cpp`, sin versión nueva; la ficha muestra el CPP y el último costo; cadena punta a punta en MySQL |
| CA-19 | PASS | Carrera en MySQL (3 rondas): el cambio de inventariable y el primer movimiento nunca se aplican los dos |
| CA-29, CA-30 | PASS | Salida a 20.0000; "otro" sin nota rechazado; entrada sin CPP ni costo rechazada; la devolución sale a 24.0000 y no pasa de lo pendiente; DT-T3-3 |
| CA-23, CA-24 | Pendiente de QA | Sin migración nueva en el 1b |
| Resto | Fuera del 1b | PR 2 y PR 3 |

### Validaciones ejecutadas

Todo desde `restaurante/` en el worktree.

- `npm run typecheck`: 0.
- `npm run lint`: 0, con `check-private-data`.
- `npm run build:css`: 0.
- `npm test`: `api` 1270, `landing-pages` 915 e `inventory-manager` 297, todas en verde.
- **Pruebas nuevas:**
  - `api/tests/unit/inventory-kardex.test.ts`: 25 pruebas en total (17 nuevas), unos 0.3 s;
  - `landing-pages/tests/integration/prisma-inventory-kardex.test.ts`: 8 pruebas, unos 4.7 s, verde 4 veces seguidas.
- **Defecto propio detectado y corregido:** la prueba de RN-T3-11 encontró que la compra leía los artículos antes de bloquear su existencia. El repositorio ahora bloquea primero (`lockItemIds`), como dice el plan.
- **`inventory:verify` como lo documenta el README** (sondas descartables, ya borradas):
  - contra una base `restaurante_test_verify051` migrada:
    - vacía: código 0;
    - con una compra y un ajuste: código 0;
    - con un `UPDATE` hecho a mano: código 1, que lista `existencia_nueva` y `existencia_anterior` solo con ids;
    - con MySQL inalcanzable: código 2;
  - con la imagen `api` construida en local (`docker build --target api`): `node scripts/inventory-verify.ts` contra una base temporal da 0.
- **Ida y vuelta de la fecha del hecho (`DATE`, H-11):** pasa con `TZ=America/Mexico_City` en el proceso de pruebas. **El plan B (`CHAR(10)`) no hace falta.**
- **Limpieza:**
  - sin bases `restaurante_test*`, sin procesos de Vitest y sin la imagen de sonda;
  - borrados los archivos temporales (`zz-probe.ts` y los registros).
  - El worktree se conserva para QA.

### Archivos afectados

- **Nuevos:**
  - en `restaurante/packages/core/inventory/`: `{kardex-schema,kardex-math,kardex-repository,kardex-verify,business-date}.ts`;
  - `restaurante/packages/db/src/prisma-kardex.ts`;
  - `restaurante/api/scripts/inventory-verify.ts` y `restaurante/api/scripts/support/inventory-verify-cli.ts`;
  - `restaurante/landing-pages/tests/integration/prisma-inventory-kardex.test.ts`.
- **Modificados:**
  - en `restaurante/packages/core/inventory/`: `{errors,index,inventory-repository,inventory-store,memory-inventory-store,recipe-repository}.ts`;
  - `restaurante/packages/db/src/prisma-inventory-store.ts`;
  - `restaurante/api/tests/unit/inventory-kardex.test.ts`;
  - `restaurante/api/package.json` y `restaurante/package.json`;
  - `restaurante/landing-pages/Dockerfile`;
  - `restaurante/docs/arquitectura.md` y `restaurante/README.md`;
  - este ticket.
- **Sin cambios en `deploy/`.**

### Riesgos o pendientes

- **CPP negativo, fecha de la reversión y unidad de la devolución:** confirmados por el usuario como RN-T3-12 a RN-T3-14 (ver "Decisiones sobre el PR 1b").
- **Tamaño del PR:** el usuario decidió mantenerlo como un solo PR.

## Decisiones sobre el PR 1b

Aprobadas por el usuario el 2026-11-25 con "Si", en respuesta a "¿Mantengo el PR 1b como un solo PR, y confirma esos tres supuestos con mis recomendaciones?".

- **Tamaño:** el PR 1b queda como **un solo PR**, aunque añade 2 438 líneas (unas 1 890 de producción con comentarios, 505 de pruebas y unas 45 de documentación) frente a las ~1 500 del plan. Motivo: el repositorio del Kardex es un único módulo cohesionado y ya está validado en conjunto. No se parte en 1b-1 y 1b-2.
- **RN-T3-12. CPP nunca negativo.** Si la fórmula de RN-T3-6, `(q·c − d·k) / (q − d)`, diera un CPP negativo al revertir una entrada o devolver mercancía, el CPP queda en 0. Ocurre cuando lo que sale costó mucho más que el promedio de lo que queda. Implementado en `applyEntryReversal` (`kardex-math.ts`); `inventory:verify` lo recalcula igual.
- **RN-T3-13. Fecha del hecho de una reversión.** Es el día en que se registra, en `BUSINESS_TIMEZONE`. La reversión no pregunta la fecha.
- **RN-T3-14. Cantidad de una devolución.** Se captura en la unidad base del artículo, y el detalle de la compra muestra "queda por devolver" en esa unidad.

## QA Action Plan — PR 1b

### Objetivo

Validar con evidencia que el PR 1b (rama `feature/REQ-F-051-kardex-dominio`, sin commit, sobre `27c7a25`) cumple sus criterios de dominio y persistencia:

- el CPP, el costo de compra, la reversión, la devolución, el ajuste y el saldo inicial calculan exactamente lo que dicen RN-T3-4 a RN-T3-8 y RN-T3-12 a RN-T3-14;
- la concurrencia, la idempotencia persistente y la espera agotada no pierden ni duplican movimientos;
- el Kardex es inmutable, e `inventory:verify` lo comprueba sin filtrar datos;
- la vuelta atrás a `main` y a la épica previa sigue funcionando;
- nada de T1, T2, el 1a ni el resto del monorepo cambia.

### Requisito bajo prueba

- **En el 1b:** RF-2 a RF-6, RF-7 y RF-8 (solo el dominio), RF-10, RF-11, RF-13, RN-T3-1 a RN-T3-10, RN-T3-12 a RN-T3-14, DT-14, DT-13, DT-5 (inmutabilidad y `verify`), DT-T3-3, DT-T3-4, DT-T3-5, DT-T3-7, DT-T3-8 y OBS-1 (documentación).
- **Fuera del 1b, sin tratarlo como defecto:**
  - PR 2: contratos, rutas, el 503 `INVENTORY_BUSY` en HTTP, CA-21 y la semilla (CA-28);
  - PR 3: pantallas, CA-25, OBS-12 (a) y (c), `ops/backup` (DT-T3-6 A) y `despliegue.md`.
  - "Lo escrito se conserva" (CA-14) y el texto visible de CA-6, CA-16, CA-17 y CA-18 son de pantalla: aquí solo se valida el dominio que los alimenta.

### Cálculos verificados a mano (antes de ejecutar)

Notación: cantidades con escala 3, costos con escala 4 e importes con escala 2. `divideRounded` hace `(2n + d) / (2d)`, es decir, mitad hacia arriba (lejos de cero).

| CA | Cálculo | Esperado |
|---|---|---|
| CA-1 | 2 bultos × 25 = 50.000 kg; 1 000.00 / 50.000 = 100 000·10⁵ / 50 000 = 200 000 | 20.0000; existencia 0.000 → 50.000; CPP y último costo 20.0000 |
| CA-2 | k = 600.00 / 25.000 = 24.0000; (50·20 + 25·24) / 75 = 1 600 / 75 = 21.33333… | CPP 21.3333; último costo 24.0000 |
| CA-3 | q = −2.000 ≤ 0 → c' = k = 250.00 / 10.000 = 25.0000 | existencia 8.000; CPP 25.0000 |
| CA-4 | 10.00 / 3 = 3.33333… → 3.3333; 20.00 / 3 = 6.66666… → 6.6667 | 3.3333 y 6.6667 |
| CA-5 | q = 0 → c' = k | existencia 12.500; CPP 18.5000 |
| CA-6 | (75.000·21.3333 − 25.000·24.0000) / 50.000 = (15 999 975 000 − 6 000 000 000) / 50 000 = 199 999.5 (escala 4) → 200 000 | 19.99995 → **20.0000**; existencia 50.000. Con redondeo hacia abajo o truncado saldría 19.9999 |
| CA-7 | q − d ≤ 0 → se conserva c | CPP sin cambio |
| CA-16 | 50.000 × 20.0000 = 1 000.0000000 → escala 2 | 1 000.00 |
| CA-18 | 0.500 × 20.0000 | 10.00, origen `cpp` |
| CA-29 | salida de 2.000 al CPP 20.0000; c sin cambio | existencia 8.000; costo 20.0000 |
| CA-30 | sobre el estado de CA-2: devolver 5.000 a 24.0000 → (75·21.3333 − 5·24) / 70 = (15 999 975 000 − 1 200 000 000) / 70 000 = 211 428.21… | sale a 24.0000; CPP 21.1428 |
| RN-T3-12 | compra de 10.000 por 10.00 (k = 1.0000, CPP 1.0000); compra de 10.000 por 1 000.00 (CPP (10 + 1 000) / 20 = 50.5000); salida de 9.000 (q = 11.000). Revertir la segunda compra: (11·50.5 − 10·100) / 1 = −444.5 < 0 | CPP **0.0000**; existencia 1.000; último costo 1.0000 (DT-T3-4) |

### Criterios de aceptación

| CA (alcance 1b) | Pruebas |
|---|---|
| CA-1 a CA-4 (compra, CPP, existencia ≤ 0, redondeo y formato) | S3, F1, F2, N1, X1 |
| CA-5 y CA-8 (saldo inicial) | S3, F3, C6, C7, X8 |
| CA-6 y CA-7 (reversión) | S3, F4, F5, C3, X1, X9 |
| CA-9 y CA-10 (artículos, proveedor y conversión) | S3, F6, N2 |
| CA-11 (fecha del hecho) | S3, F7, X10 |
| CA-12 (doble envío, también con reinicio) | S3, F8, C8, X5, X6 |
| CA-13 (concurrencia y `verify` en 0) | S3, C1, C2, C10, P1, X3 |
| CA-14 (espera agotada real) | B1 a B3 |
| CA-15 (inmutabilidad y `verify` con filas alteradas) | S3, I1, I2, K1 a K8, X7 |
| CA-16 y CA-17 (existencias y Kardex, dominio) | S3, F9, F10 |
| CA-18 (costo real) | S3, F11, H1 |
| CA-19 (bloqueo por uso con movimientos reales) | S3, C9 |
| CA-29 (ajuste) | S3, F12 |
| CA-30 (devolución) | S3, F13, C4, C5 |
| CA-23 (respaldo, con sonda) | RB1 a RB3 |
| CA-24 (vuelta atrás, con sonda) | V1 a V6 |
| RN-T3-12 a RN-T3-14 | F4, F5, F13, F14, X2 |
| CA-26 (regresión de lo tocado) y DoD | S1 a S7, H1, T1 a T4, A1 a A3 |

### Riesgos identificados

- **R-1. Desbordamiento de DECIMAL en MySQL.** El store en memoria no tiene límites de columna, así que las pruebas unitarias no lo verían. Hay dos casos que el dominio no comprueba:
  - `line_total` y `total_cost` (`DECIMAL(19,4)`) en un saldo inicial o un ajuste con una cantidad y un costo grandes: 9 999 999 999.999 × 99 999 999 999.9999 ≈ 10²¹;
  - un CPP posterior (`DECIMAL(15,4)`) que la fórmula de RN-T3-6 amplifica cuando q − d es muy pequeño. Ejemplo calculado: saldo de 0.001 kg a 99 999 999 999.0000, compra de 999.999 kg por 0.00 (CPP 100 000.0000) y reversión de la compra, que da (1 000·100 000) / 0.001 = 100 000 000 000.0000, uno más que el máximo.
  - Los casos límite piden "se rechaza con un mensaje en el campo". Un error de base (503) sería un defecto; su severidad depende de lo realista del dato (N3).
- **R-2. RN-T3-12 sin prueba permanente.** No hay ningún caso que fije el CPP en 0 (X2 lo comprueba). Si no lo hay, se registra como observación.
- **R-3. Unicidad del documento.** `insertDocument` traduce cualquier clave única repetida a `IdempotencyRaceError` si el envío trae clave. Una reversión con clave que choque por `reverses_document_id` acabaría en un error de carrera, en lugar de `AlreadyReversedError`. El bloqueo del documento de origen debería impedirlo (C3).
- **R-4. `verify` y la paginación por clave.** El lote de 5 000 movimientos puede partir la cadena de un artículo, y la lectura debe ser consistente mientras se escribe (K6 y C10).
- **R-5. `api/.env` existe en el worktree.** `npm run inventory:verify` lo carga con `--env-file-if-exists`. Toda sonda usa un env propio o variables exportadas, que tienen prioridad, y se comprueba con los conteos que la base usada es la de QA. Nunca se toca la base de desarrollo.
- **R-6. Pruebas permanentes.** La ida y vuelta de DECIMAL y `DATE` está en la frontera de las "pruebas de driver" de `testing.md`, aunque el plan aprobado la pide (H-11). Se revisa en T2 sin tratarla como defecto.
- **R-7. Vuelta atrás.** `27c7a25` no usa el CPP en las recetas (se costean por referencia), y `main` no conoce el inventario. Es lo esperado: un efecto más amplio sería un defecto.

### Pruebas funcionales (sondas en el scratchpad, MySQL 8.4 y memoria)

Las sondas se escriben en el scratchpad y se ejecutan desde la raíz del worktree, importando `@restaurante/core` y `@restaurante/db`. Usan bases propias `restaurante_test_qa051b_*`, creadas con `TEST_ADMIN_DATABASE_URL` y migradas con el `migrate deploy` del worktree. `BUSINESS_TIMEZONE=America/Mexico_City` y, cuando importa, `TZ` distinta (`Asia/Tokyo` y `UTC`). Cada escenario se ejecuta igual en memoria y en MySQL, y se comparan los movimientos y las existencias (diferencial).

- **F1. CA-1 a CA-3** exactos, con los valores de la tabla de cálculos: `unitCost`, `balanceBefore`, `balanceAfter`, `avgCostBefore`, `avgCostAfter`, `lineTotal` y `totalCost` de cada movimiento, y la existencia.
- **F2. CA-4:**
  - 3 pza por 10.00 y por 20.00;
  - la mitad exacta: 0.01 por 0.064 kg = 0.15625, que debe dar 0.1563; y un cociente exacto, 1.00 por 0.032 kg = 31.2500;
  - "1,5", "10.001" en el importe, "1.0005" en la cantidad y "18.50005" en el costo: error en su campo, sin escritura.
- **F3. CA-5 y CA-8:**
  - saldo de 12.500 a 18.5000; un segundo saldo: `InitialBalanceNotAllowedError` con el texto "ajuste";
  - saldo tras una compra: rechazado;
  - saldo revertido: admite otro;
  - compra revertida sin otros movimientos: admite saldo, según RN-T3-8 ("movimientos vigentes");
  - el mismo artículo dos veces en el mismo saldo: error en la línea;
  - el saldo no cambia el último costo.
- **F4. Reversiones sin devoluciones:**
  - de una compra (CA-6: 20.0000, el original sin cambios y `reversedById`);
  - de un saldo inicial, de un ajuste de entrada, de un ajuste de salida (entra al costo con que salió) y de una devolución;
  - de una salida sin costo: el CPP no cambia;
  - una reversión de una reversión: `ReversalNotReversibleError`;
  - una segunda reversión: `AlreadyReversedError`;
  - con el artículo y el proveedor inactivos: se permite;
  - motivo vacío o de 401 caracteres: error en `reason`;
  - un id inexistente: `DocumentNotFoundError`;
  - fecha del hecho = hoy en `BUSINESS_TIMEZONE`, aunque el original sea de hace 20 días (RN-T3-13);
  - DT-T3-4: revertir la compra más reciente deja el costo de la anterior no revertida; revertir una antigua conserva el último costo; revertir la única deja el último costo vacío.
- **F5. Reversiones con devoluciones (DT-T3-3) y CA-7:**
  - compra → devolución → revertir la compra: `DocumentHasReturnsError` con el id de la devolución;
  - revertir la devolución y después la compra: se aplica, con el estado final calculado a mano;
  - CA-7: entrada consumida y revertida → negativo con el CPP conservado; `previewReversal` lo marca sin escribir ni bloquear (conteos sin cambios).
- **F6. CA-9 y CA-10:**
  - un Compuesto, un padre, un no inventariable y un inactivo, cada uno en una línea distinta del mismo documento: un error por línea y ninguna fila nueva (documentos, movimientos, existencias y claves);
  - un proveedor inactivo y uno inexistente: error en `supplierId`;
  - pza en un artículo en kg sin factor; 0.001 g en un artículo en kg (redondea a 0);
  - un factor de empaque decimal (p. ej. caja = 0.75 kg).
- **F7. CA-11:**
  - con el reloj fijado a las 23:30 y a las 00:30 de `America/Mexico_City`, y el proceso en `TZ=Asia/Tokyo` y en `UTC`: "hoy" es el día local;
  - se aceptan hoy y hoy − 31; se rechazan mañana, hoy − 32, `2026-02-30` y "2026-1-5".
- **F8. CA-12, doble envío con reinicio real:**
  - el proceso A registra una compra con un `requestId` y termina; un proceso B nuevo envía lo mismo: `replayed: true` y el mismo id, con un solo documento en la base;
  - el mismo `requestId` con otro cuerpo: `IdempotencyKeyReusedError`, sin escritura;
  - el mismo `requestId` con otro actor o con otro tipo de documento: documentos distintos (la clave lleva el actor y el tipo);
  - un `requestId` que no es un UUID: error en `requestId`;
  - repetir el envío de una compra ya revertida: devuelve la compra original, sin escribir.
- **F9. CA-16 (dominio):**
  - con 50.000 kg a 20.0000: valor 1 000.00;
  - los estados "Negativo" y "Sin costo";
  - un CPP 0 (de RN-T3-12 o de una compra sin cargo) cuenta como "con costo" y vale 0.00. "Sin costo" es solo la ausencia de CPP;
  - los totales: positivos, negativos aparte y el conteo de sin costo;
  - sin Compuestos, padres ni no inventariables; un inactivo solo con existencia distinta de 0 (DT-T3-5);
  - los filtros (búsqueda, categoría, tipo y estado) y la paginación con 51 artículos;
  - el redondeo de un valor negativo con la mitad exacta se registra (ver N4).
- **F10. CA-17 (dominio):** con 51 movimientos de un artículo, la página 1 tiene `seq` 51 a 2 y la 2 tiene `seq` 1. Cada movimiento lleva su documento, el usuario, la fecha y hora de registro y la fecha del hecho.
- **F11. CA-18:** un ingrediente con referencia 30.0000 y una compra a 20.0000 hace que su línea de 0.500 kg cueste 10.00 con origen `cpp`, sin versión nueva de la receta. `getItem` devuelve la existencia, el CPP y el último costo. Un Intermedio con receta vigente y compras se costea por su receta (DT-7), aunque tenga CPP.
- **F12. CA-29:**
  - salida de 2.000 a 20.0000;
  - "otro" sin nota: error en `note`;
  - entrada sin CPP ni costo: error en la línea;
  - entrada con CPP y costo escrito: rechazada (DT-T3-7);
  - salida con costo escrito: rechazada;
  - salida sin CPP: `unitCost` nulo y la línea "sin costo";
  - motivo fuera de la lista y dirección inválida: error en su campo.
- **F13. CA-30 y RN-T3-14:**
  - devolver 5.000 de 25.000 sale a 24.0000, con el CPP 21.1428 de la tabla;
  - devolver 20.000 más: se acepta, porque queda justo 0;
  - devolver 0.001 más: rechazado;
  - dos líneas del mismo documento que juntas pasan lo pendiente: la segunda se rechaza;
  - una línea de otra compra: rechazada;
  - devolver desde un saldo inicial o un ajuste: `DocumentNotReturnableError`; desde una compra revertida: `DocumentReversedError`;
  - con el artículo y el proveedor inactivos: se permite;
  - la unidad guardada es la base, y `getDocument` da lo que queda por devolver en esa unidad;
  - revertir una devolución libera lo pendiente.
- **F14. RN-T3-12:** la cadena de la tabla de cálculos deja el CPP en 0.0000, y `verify` da 0 sobre ella. Una entrada posterior promedia desde 0 (no desde "sin CPP").

### Pruebas negativas y casos límite

- **N1. Formato:** importe "1e3", " 12 ", "-1", "+1", "00012.50", ".5", "5.", vacío y no texto, en cantidad, importe y costo. Se registra la respuesta de cada uno; cualquier valor aceptado que no sea un decimal con punto es un defecto de RN-T3-10.
- **N2. Documento:** 0 líneas, 50 líneas (se acepta), 51 líneas (se rechaza), folio de 41 y nota de 401 caracteres, y un `supplierId` que no es un entero.
- **N3. Desbordamiento (R-1), en MySQL:**
  - una cantidad que lleva la existencia acumulada por encima de `DECIMAL(13,3)`: error en `lines.N.quantity` (ya lo comprueba `compute`);
  - un saldo inicial y un ajuste de entrada con `line_total` mayor que `DECIMAL(19,4)`;
  - un documento de 50 líneas cuyo `total_cost` se desborda aunque cada línea quepa;
  - la reversión del ejemplo de R-1, con un CPP mayor que `DECIMAL(15,4)`.
  - Esperado: error del dominio con mensaje y nada escrito. Si sale un 503 o un error de base, es un defecto. Su severidad se propone por lo realista de los valores (importes de cientos de millones de pesos).
- **N4. Redondeo con signo:** `stockValue` de −0.001 × 5.0000 (−0.005 → ¿−0.01 o 0.00?). "Mitad hacia arriba" en negativos no está definido en el ticket. Se registra el resultado como dato; no es un defecto salvo que contradiga una regla escrita.
- **N5. Inmutabilidad del store en memoria:** mutar un documento o movimiento devuelto no cambia lo guardado (copias defensivas). Si lo cambia, es una observación, porque solo afecta a las pruebas.

### Pruebas de concurrencia (MySQL; 10 rondas cada una)

- **C1.** 20 operaciones simultáneas sobre un artículo, mezcladas (compras, ajustes de entrada y de salida): 20 movimientos con `seq` contiguo, la existencia exacta (la suma) y el CPP igual al que recalcula `verify`. `verify`: 0.
- **C2.** 10 documentos simultáneos con los artículos en órdenes cruzados (A, B, C frente a C, B, A), algunos de 50 líneas. Sin errores visibles, `verify` en 0. Se cuentan los interbloqueos (1213) reintentados: con el orden ascendente deberían ser 0.
- **C3.** Dos reversiones simultáneas del mismo documento, con `requestId` distintos y sin él: una se aplica y la otra da `AlreadyReversedError`, nunca `IdempotencyRaceError` ni 503 (R-3).
- **C4.** Una devolución y la reversión de la misma compra a la vez: o la devolución se aplica y la reversión da `DocumentHasReturnsError`, o la reversión se aplica y la devolución da `DocumentReversedError`. Nunca las dos.
- **C5.** Dos devoluciones simultáneas de 15.000 sobre una línea de 25.000: una se aplica y la otra da error en la línea. Lo devuelto nunca pasa de lo comprado.
- **C6.** Dos saldos iniciales simultáneos del mismo artículo: uno se aplica y el otro da `InitialBalanceNotAllowedError`.
- **C7.** Un saldo inicial y una compra simultáneos de un artículo sin movimientos: según el orden, se aplican los dos (primero el saldo) o el saldo se rechaza. Nunca queda un saldo inicial registrado después de una compra vigente.
- **C8.** 5 envíos simultáneos con el mismo `requestId`, repartidos entre dos instancias del store: 1 documento; los demás `replayed: true` con el mismo id.
- **C9. CA-19:** carrera entre el cambio de inventariable o de unidad y un primer movimiento real (no simulado con SQL): nunca se aplican los dos.
- **C10.** `inventory:verify` mientras 10 escritores registran documentos: siempre 0 (lectura consistente), sin errores ni esperas agotadas.
- **P1. Contención del pool (medición, no prueba).** Con el pool de 5 conexiones: 20 y 40 operaciones simultáneas de 1 y de 50 líneas. Se registran la latencia p50/p95/máxima, los reintentos y los errores de espera del pool (P2024 → 503). Es un hallazgo, no un defecto, salvo que una carga realista (≤ 5 usuarios) dé 503.
- En todas: cero errores fuera de la jerarquía del dominio, y core no escribe en los logs.

### Pruebas de espera agotada (CA-14)

El MySQL de pruebas corta la espera de bloqueo a los 5 s. Una sesión externa (cliente `mysql` en el contenedor, con el usuario administrador de pruebas) mantiene un bloqueo unos 8 s y después lo suelta:

- **B1.** `FOR UPDATE` sobre la existencia de un artículo y una compra de ese artículo: `InventoryBusyError` a unos 5 s. Documentos, movimientos, existencias y la clave de envío sin cambios. Al liberar, el mismo `requestId` crea un solo documento con `replayed: false`.
- **B2.** Bloqueo de solo el segundo artículo de una compra de dos líneas (el primero ya quedó bloqueado por la transacción): `InventoryBusyError` y nada escrito del primero (todo o nada).
- **B3.** `FOR UPDATE` sobre la fila de una compra y una reversión o devolución de esa compra: `InventoryBusyError`, nada escrito.
- La correspondencia con el 503 `INVENTORY_BUSY` de HTTP y la conservación de lo escrito en el formulario se validan en los PR 2 y 3.

### `inventory:verify` (RF-13, CA-15)

Se ejecuta como lo documenta el README (`npm run inventory:verify` desde `restaurante/`, con las variables exportadas) y como en el contenedor (`node scripts/inventory-verify.ts` desde `api/`). Se comprueba con los conteos que la base usada es la de QA (R-5).

- **K1.** Base vacía y migrada: código 0 con `artículos=0 movimientos=0 documentos=0`.
- **K2.** Datos correctos, con todos los tipos de documento, reversiones, devoluciones, negativos, sin costo y CPP 0: código 0 y conteos iguales a los de la base.
- **K3. Una alteración por copia nueva de la base** (`UPDATE` o `INSERT` con el administrador de pruebas):
  - la cantidad de un movimiento;
  - `balance_before` y `balance_after`;
  - `avg_cost_before` y `avg_cost_after`;
  - el `unit_cost` de una compra;
  - el `seq` de un movimiento (hueco);
  - el tipo (`'xxx'`);
  - una cantidad 0;
  - `quantity`, `avg_cost` y `last_seq` de la existencia;
  - una existencia con movimientos borrada, si la FK lo permite;
  - una existencia sin movimientos y con cantidad.
  - Esperado: código 1, con la comprobación correspondiente. Las alteraciones que RF-13 no pide (`line_total`, `last_cost`, `occurred_on`, el autor) se registran como no detectadas, como observación.
- **K4. Salida sin datos:** en cada salida de K1 a K3 y K7 solo aparecen los prefijos `inventory_verify_*`, `itemId`, `check`, `seq` y conteos. Ningún nombre, costo, cantidad, contraseña ni URL (CA-15 y CA-27). Se comprueba por patrón sobre stdout y stderr.
- **K5.** Más de 100 incidencias: 100 líneas, `inventory_verify_more N` y el total.
- **K6. Paginación por clave:** más de 5 000 movimientos (unos 110 documentos de 50 líneas), con un artículo cuya cadena cruza el borde del lote: código 0 y conteos exactos. Con una alteración justo después del borde, código 1.
- **K7. No pudo verificar (código 2):**
  - MySQL inalcanzable (puerto cerrado);
  - sin `DATABASE_URL`;
  - contraseña incorrecta (la salida no la muestra);
  - una base sin migrar o con migraciones pendientes.
- **K8. Solo lectura:** con un usuario temporal que solo tiene `SELECT` sobre la base de QA, da 0 (ver "Decisiones para la aprobación"). Tras ejecutarlo, los `CHECKSUM TABLE` de las tablas del inventario no cambian.
- **K9. En la imagen:** `docker build --target api` del worktree y `node scripts/inventory-verify.ts` en el contenedor contra una base de QA: código 0, y código 1 con una alteración (ver "Decisiones para la aprobación").

### Inmutabilidad (DT-5, CA-15)

- **I1.** Revisión del diff: el contrato `InventoryStore`, el store en memoria y `prisma-kardex.ts` no exponen ningún update ni delete de documentos o movimientos. Búsqueda en el árbol del worktree de `inventoryDocument`/`inventoryMovement` con `update*`, `upsert` o `delete*`, y de `$executeRaw`/`$queryRaw` con `UPDATE` o `DELETE` sobre esas tablas, también en las formas de OBS-1 (desestructuración, alias y acceso calculado): 0 en producción.
- **I2.** `npm run lint` en verde. `arquitectura.md` documenta los límites de la regla (OBS-1).

### Pruebas de respaldo (CA-23, sonda; el simulacro con `ops/backup` es del PR 3)

- **RB1.** Una base de QA con los datos de K2 y un proveedor inactivo se vuelca con los mismos parámetros que `ops/backup/backup.sh` (`--single-transaction --no-tablespaces --skip-lock-tables --default-character-set=utf8mb4 --hex-blob --set-gtid-purged=OFF`, sin `--databases` para poder restaurar con otro nombre) y se restaura en otra base `restaurante_test_qa051b_*`.
- **RB2.** Los conteos y los `CHECKSUM TABLE` de `inventory_supplier`, `inventory_document`, `inventory_movement`, `inventory_stock` y del resto de tablas `inventory_*` son iguales en el origen y en la restaurada. `inventory:verify` sobre la restaurada: 0.
- **RB3.** En la restaurada, una compra nueva continúa los `seq`, un reenvío con un `requestId` ya usado devuelve el documento existente, y `verify` sigue en 0.

### Pruebas de vuelta atrás (CA-24, sonda)

Mismo método que el QA del PR 1a: el código fuente arrancado con `node src/server.ts` y un env propio en el scratchpad que apunta a la base de QA, nunca al `.env` de desarrollo.

- `main` (`74ca737`): desde `/Users/orvigas/Desktop/Negocio/restaurante`, solo lectura. Si falta su cliente de Prisma, una copia con `git archive`.
- Épica previa (`27c7a25`): copia con `git archive` en el scratchpad, `node_modules` con `cp -a` (comprobado con `realpath`) y `prisma generate`. Antes se comprueba que `package-lock.json` y `packages/db/prisma` son idénticos entre `27c7a25` y la rama.

Pasos:

- **V1.** Base migrada con el worktree, con la semilla, el fixture A5 y los datos de K2 escritos con el core del worktree. Se toman los conteos y los `CHECKSUM TABLE`.
- **V2. `main`:**
  - sin `DATABASE_ALLOW_NEWER_SCHEMA`: `DATABASE_NEWER_THAN_CODE`;
  - con la variable: arranca; productos y página públicos de los dos negocios en 200; acceso al admin, productos, página y usuarios en 2xx; la `landing-pages` de `main` en `/`, `/birria` y `/molotes` en 200 con productos; 0 errores en el log.
- **V3. `27c7a25`, sin la variable:**
  - arranca sin aviso de esquema (no hay migración nueva);
  - la lista y todas las fichas en 200, con `locked = true` en los artículos con movimientos;
  - las recetas en 200, costeadas por referencia (R-7);
  - editar el nombre de un artículo con movimientos: 200; cambiar su unidad o su inventariable: rechazado (bloqueo del 1a);
  - alta: 201, con existencia en 0;
  - el `inventory-manager` de `27c7a25`: acceso, lista, ficha y recetas en 200.
- **V4.** Tras V2 y V3: las tablas del Kardex sin cambios (checksums), salvo la existencia nueva del alta de V3. `inventory:verify` del worktree: 0.
- **V5. De vuelta en el worktree:**
  - la receta usa el CPP;
  - el artículo creado por `27c7a25` admite una compra al instante (CA-20, dominio);
  - `verify`: 0.
- **V6.** Se compara el resultado con la nota de vuelta atrás del plan. Un efecto más amplio es un defecto.

### Pruebas de regresión

- **S1.** `npm run build:css` y `npm run typecheck`: código 0.
- **S2.** `npm run lint`, con `check-private-data`: código 0, sin avisos.
- **S3.** `npm test` completo, comparado con el Implementation Result: `api` 1270, `landing-pages` 915 e `inventory-manager` 297, con el número de archivos (frente al 1a: `api` 56, `landing-pages` 64 + 1 y `inventory-manager` 18).
- **S4. Duración y estabilidad:** `inventory-kardex.test.ts` y `prisma-inventory-kardex.test.ts` se miden con el reporter de Vitest: menos de 20 s cada uno. El de MySQL se ejecuta 10 veces seguidas, sin fallos intermitentes.
- **S5. Consumidores.** CodeGraph indexa `main`, que no tiene el inventario: se comprobó en Q1 y no da resultados útiles. Por grep en el worktree, los consumidores de lo tocado son `api/src/server.ts`, `api/src/admin/inventory-routes.ts` y `inventory-recipe-routes.ts` (DTO explícito, sin `stock`; el contrato ya admite `cpp`), los scripts `inventory-seed-dev`, `inventory-import` e `inventory-verify`, `api/tests/support/admin.ts` y las pruebas `inventory-{catalog,recipes,import,kardex}` y `prisma-inventory-{store,import,recipes,kardex}`. Se confirma que la suite los ejecuta.
- **S6. Sin cambios ajenos:** `git diff 27c7a25` no toca `deploy/` (la suma no cambia), `package-lock.json`, `compose.yaml`, los `.env.example` ni `packages/db/prisma` (sin migración nueva). `prisma migrate diff --from-migrations … --to-schema … --exit-code` y `--from-config-datasource` sobre una base nueva: código 0.
- **S7.** La línea `COPY` del Dockerfile copia `inventory-verify.ts`, y `scripts/support` incluye `inventory-verify-cli.ts` (K9 lo ejercita).
- **H1. HTTP con la `api` y el `inventory-manager` del worktree** sobre la base de V1: la ficha del artículo en 200 (sin `stock` en la respuesta, que es del PR 2) y el detalle de la receta en 200, con `source: 'cpp'` aceptado por el contrato y la etiqueta "CPP" en el HTML del admin. 0 errores en el log.

### Revisión de las pruebas permanentes (`testing.md`)

- **T1.** Cada caso nuevo (17 en `api/tests/unit/inventory-kardex.test.ts` y 8 en `landing-pages/tests/integration/prisma-inventory-kardex.test.ts`) protege un comportamiento de la app. Ninguno es de arquitectura ni de mudanza. Se valora la ida y vuelta de DECIMAL y `DATE` (R-6) frente a la lista de pruebas de driver; como el plan aprobado la pide, cualquier conflicto es una observación.
- **T2. Duplicados:** se busca por grep (CodeGraph no indexa la rama) que no haya casos que ya cubran lo mismo: el bloqueo por uso con `last_seq` del 1a frente a la carrera con movimientos reales; CA-12 en memoria y en MySQL (el reinicio solo lo prueba MySQL). Cada comportamiento debe estar en la prueba más barata.
- **T3.** El diff de `tests/` frente a `27c7a25` no borra ni debilita pruebas, y no añade `retry`, `testTimeout` ni esperas fijas. Los datos son ficticios.
- **T4.** En el árbol final no queda ninguna sonda, y `git status` coincide con el del Implementation Result.

### Mutaciones (descartables)

En una copia del árbol en el scratchpad (`rsync` sin `node_modules`, más `cp -a` de `node_modules`), nunca en el worktree. En cada una se registra qué prueba permanente falla:

- **X1.** `divideRounded` truncando en `applyEntryReversal` (CA-6 da 19.9999) y en `purchaseUnitCost` (CA-4 da 6.6666).
- **X2.** Sin el tope en 0 de `applyEntryReversal` (RN-T3-12, R-2).
- **X3.** Sin `lockStock` en `write()`: debe fallar la prueba de 20 salidas simultáneas.
- **X4.** Sin `lockDocument`: se registra si la de las dos reversiones simultáneas lo detecta (la clave única puede respaldarla).
- **X5.** Sin la búsqueda previa de la clave de envío: deben fallar las pruebas de CA-12.
- **X6.** Sin el manejo de `IdempotencyRaceError`: debe fallar la prueba de CA-12 en MySQL.
- **X7.** `verify` sin `cpp_recalculado` y sin `existencia_distinta`: deben fallar las pruebas de CA-15.
- **X8.** `itemsWithActiveMovements` contando los documentos revertidos: debe fallar CA-8.
- **X9.** `lastPurchaseCost` sin excluir el documento que se revierte: debe fallar DT-T3-4.
- **X10.** `businessDate` con la zona del servidor: debe fallar CA-11.
- **X11.** Sin la comprobación de DT-T3-3 y sin `remaining.set` en la devolución: deben fallar DT-T3-3 y CA-30.
- Un mutante que sobrevive a una regla aprobada es una observación (prueba que falta), no un defecto de la implementación.

### Documentación

- **A1.** `arquitectura.md`: la sección Kardex coincide con el código (aislamiento READ COMMITTED, orden documento → existencias ascendentes, clave `<actor>:<tipo>:<requestId>` con huella, los límites de la regla de lint de OBS-1, `verify` y tipos en `VARCHAR`).
- **A2.** README: la fila de `inventory:verify` coincide con el comportamiento (K1 a K7).
- **A3.** `.claude/CLAUDE.md`, `senior-fullstack.md` y `deploy/` sin cambios en la rama.

### Pruebas que no aplican en el 1b

- **Navegador, responsive, accesibilidad, UX/UI, SEO, WhatsApp y performance del frontend:** el 1b no cambia vistas, CSS, JS de navegador ni rutas. No se usa Claude in Chrome. H1 y V2 comprueban por HTTP que el admin y las landings siguen respondiendo.
- **Performance del backend:** solo P1 y S4.

### Evidencia requerida

- La salida y el código de salida de cada comando.
- Por sonda y ronda: los valores calculados frente a los esperados, los conteos y los errores por clase.
- Los `CHECKSUM TABLE` de RB y V.
- La salida completa de `verify` en K1 a K9.
- Los logs de arranque de V y H (solo códigos de evento).
- El resultado de cada mutación.
- Todo queda en el QA Report del ticket.

### Criterios de aprobación

- CA-1 a CA-13, CA-15 a CA-19, CA-29 y CA-30 (dominio y persistencia), y CA-14, CA-23 y CA-24 por sonda, en PASS con evidencia.
- Los cálculos de la tabla, exactos en memoria y en MySQL.
- S1 a S3 en verde, y S4 por debajo de 20 s sin intermitencias.
- Sin defectos `BLOCKER` ni `CRITICAL`. Los `MAJOR` necesitan una decisión del usuario.
- Las observaciones (mutantes supervivientes, alteraciones que RF-13 no pide, P1, N4 y N5) no bloquean si se registran.

### Limpieza

Al terminar, también si algo falla:

- se borran las bases `restaurante_test_qa051b_*`, tras confirmar el prefijo;
- se borra el usuario temporal de K8;
- se borra la imagen de K9;
- se detienen los procesos de V, H y las sondas (`api`, `landing-pages`, `inventory-manager` y Vitest) y las sesiones `mysql` de B, y se liberan los puertos;
- se borran las copias de `main`, de `27c7a25` y de las mutaciones, los volcados de RB y las sondas del scratchpad;
- se comprueba con `git worktree list`, `lsof`/`ps`, `docker images` y `SHOW DATABASES LIKE 'restaurante\_test%'`.

### Decisiones para la aprobación

1. **K8:** ¿se autoriza crear, con el `root` del MySQL local, y borrar al terminar, un usuario temporal con solo `SELECT` sobre una base `restaurante_test_qa051b_*`, para demostrar que `inventory:verify` solo lee? Si no, K8 queda como revisión estática más la comparación de checksums.
2. **K9:** ¿se autoriza construir en local la imagen `api` del worktree (`docker build --target api`, unos minutos) para ejecutar `verify` en el contenedor, y borrarla al terminar? El Dockerfile cambia en este PR. Si no, K9 queda en S7 (revisión estática), y el DoD del PR 2 lo vuelve a pedir.
3. **CA-24 con código fuente** de `main` (`74ca737`) y de `27c7a25`, como en el PR 1a, sin construir sus imágenes. ¿Basta? El 1b no añade migración, así que la imagen de T2 (`ad50c50`) no se repite: el QA del PR 1a ya la cubrió (V4 y V5) con `last_seq` simulado, que es equivalente para su código. ¿Está de acuerdo, o quiere que V3 se repita también con `ad50c50`?
4. **Sondas** en el scratchpad, ejecutadas desde la raíz del worktree (fuera de `landing-pages/tests/`) y borradas al terminar, como en el PR 1a. ¿Se autorizan?

## QA Report — PR 1b

### Ronda

1. Rama `feature/REQ-F-051-kardex-dominio`, sin commit, sobre `27c7a25`. El usuario aprobó el plan con "Si", con estas respuestas:

- K8: un usuario temporal de solo `SELECT`;
- K9: construir la imagen `api` en local;
- CA-24: con el código fuente de `main` (`74ca737`) y de `27c7a25`, sin imágenes y sin repetir T2;
- sondas en el scratchpad.

Todo se ejecutó sobre el MySQL 8.4 local, en bases `restaurante_test_qa051b_*` propias. Ninguna sonda se escribió en el repositorio.

### Pruebas ejecutadas

| ID | Acción | Resultado |
|---|---|---|
| S1 | `npm run build:css` y `npm run typecheck` | Código 0 y 0. PASS |
| S2 | `npm run lint` | Código 0, sin avisos; `check-private-data`: 898 archivos, sin datos privados. PASS |
| S3 | `npm test` | `api` 56/1270, `landing-pages` 65/915 e `inventory-manager` 18/297, todo en verde: igual que el Implementation Result. Código 0. PASS |
| S4 | Duración y estabilidad | `prisma-inventory-kardex.test.ts`, 10 veces seguidas: 8/8 en cada una, de 3.89 a 4.15 s. `inventory-kardex.test.ts`: 0.17 s. PASS |
| S5 | Consumidores | CodeGraph indexa `main`, sin el inventario. Por grep en el worktree: `api/src/server.ts`, las rutas de inventario y de recetas (DTO explícito; el contrato ya admite `cpp`), los scripts `inventory-{seed-dev,import,verify}` y las pruebas `inventory-*` y `prisma-inventory-*`. Todos están en la suite. PASS |
| S6 | `git diff 27c7a25` | Sin cambios en `deploy/`, `package-lock.json`, `compose.yaml`, los `.env.example`, `packages/db/prisma`, `.claude/CLAUDE.md` ni `.claude/agents`. Sobre una base nueva, `migrate diff --from-config-datasource` y `--from-migrations` contra el esquema dan "No difference detected" y código 0. PASS |
| S7 | Imagen `api` (ver K9) | `scripts/` tiene `inventory-verify.ts`, y `scripts/support/` tiene `inventory-verify-cli.ts`. PASS |
| F1–F14, N1, N2, N4, N5 | Sonda funcional, la misma en memoria y en MySQL (90 comprobaciones) | 90/90 en los dos stores, con salidas idénticas (el diferencial no tiene diferencias). En MySQL, también con el proceso en `TZ=Asia/Tokyo`, `America/Mexico_City` y `Pacific/Kiritimati` (UTC+14): 90/90; la fecha `DATE` va y vuelve igual. Cada cálculo de la tabla de Q1 sale exacto (detalle en "Criterios de aceptación"). PASS |
| F7 | CA-11 con el reloj fijado a las 23:30 y a las 00:30 de Ciudad de México, y el proceso en `Asia/Tokyo`, `UTC` y `America/Mexico_City` | 16/16 en cada zona. Hoy y hoy − 31 se aceptan; mañana y hoy − 32 se rechazan; `2026-02-30`, `2026-1-5`, `26-11-2026`, `2026-11-26T00:00` y vacío, también. La reversión toma la fecha de hoy local (RN-T3-13). PASS |
| F8 | CA-12 con reinicio real: cada envío en un proceso de Node distinto | El proceso A crea el documento 1. El B, nuevo, recibe `replayed: true` con el mismo id. Tres procesos a la vez: los tres `replayed`. Otro cuerpo con la misma clave: `IdempotencyKeyReusedError`. Siempre 1 documento y 10.000 kg. Cinco procesos simultáneos en el primer envío, 5 rondas: siempre 1 `replayed: false`, 4 `replayed: true` y 1 documento. PASS |
| C1–C10 | Concurrencia, 10 rondas cada una (112 comprobaciones) | Todas pasan. **C1:** 20 operaciones mezcladas dan 20 movimientos con `seq` del 1 al 21 y la existencia igual a la suma. **C2:** 10 documentos cruzados, algunos de 50 líneas, todos aplicados; 0 interbloqueos del Kardex (los 2 que se contaron fueron de la sonda al dar de alta 3 artículos a la vez, en el catálogo del 1a, y se reintentaron solos). **C3:** 1 reversión aplicada y 2 `AlreadyReversedError`, nunca `IdempotencyRaceError`. **C4:** 5 rondas aplicaron la devolución (la reversión dio `DocumentHasReturnsError`) y 5 la reversión (la devolución dio `DocumentReversedError`); nunca las dos. **C5:** 1 devolución y 1 error en la línea; existencia 10.000. **C6:** 1 saldo y 1 `InitialBalanceNotAllowedError`. **C7:** "saldo → compra" o solo la compra; nunca un saldo después de una compra. **C8:** 1 documento y 4 `replayed`. **C9:** inventariable y unidad base contra un primer movimiento real: nunca se aplican los dos. **C10:** `verify` durante 10 escrituras: 0 incidencias. Ningún error fuera del dominio. PASS |
| B1–B3 | CA-14: una sesión externa (`mysql`, usuario administrador de pruebas) mantiene `FOR UPDATE` unos 8 s | **B1:** `InventoryBusyError` a los 5 028 ms; documentos, movimientos y existencias sin cambios. Al liberar, el mismo `requestId` crea 1 documento con `replayed: false`. **B2:** solo el segundo artículo bloqueado: `InventoryBusyError` a los 5 019 ms, sin escribir nada del primero. **B3:** la compra de origen bloqueada: la reversión y la devolución dan `InventoryBusyError` (5 014 y 5 013 ms), sin escribir nada. `verify`: 0. PASS |
| N3 | Desbordamiento de DECIMAL en MySQL (R-1) | **DEF-001.** En MySQL, un `line_total`, un `total_cost` o un CPP fuera de rango terminan en `DatabaseUnavailableError` ("Base de datos no disponible"), sin escribir nada. En memoria se aceptan. La existencia fuera de rango y el costo unitario de compra fuera de rango sí se rechazan con un mensaje en el campo |
| K1–K2 | `npm run inventory:verify` desde la raíz con `DATABASE_URL` exportada; `node --env-file=<propio> scripts/inventory-verify.ts` desde `api/` | Base vacía: `inventory_verify_ok artículos=0 movimientos=0 documentos=0`, código 0. Base K2 (todos los tipos, reversiones, devoluciones, negativo, sin costo y CPP 0): `artículos=8 movimientos=20 documentos=20`, código 0. Los conteos coinciden con la base de QA, así que no se usó `api/.env`. PASS |
| K3 | 18 alteraciones, cada una sobre una copia nueva de K2 | Código 1 con la comprobación esperada en las 14 que pide RF-13: cantidad, `balance_before`, `balance_after`, `avg_cost_before`, `avg_cost_after`, `unit_cost`, hueco de `seq`, tipo `'xxx'`, cantidad 0, y `quantity`, `avg_cost` o `last_seq` de la existencia, existencia borrada (`existencia_ausente`) y existencia sin movimientos con cantidad. Código 0 en las 4 que RF-13 no pide: `line_total`, `last_cost`, `occurred_on` y el autor (OBS-5). PASS |
| K4 | Patrón sobre todas las salidas de K3 | 0 líneas fuera de `inventory_verify_{ok,failed,mismatch,more}` con ids, `check`, `seq` y conteos. 0 nombres, costos ni cantidades. PASS |
| K5 | 304 incidencias | 100 líneas, `inventory_verify_more 204` y el total. Código 1. PASS |
| K6 | 5 300 movimientos; la cadena del artículo 1 cruza el borde del lote (seq 5000/5001) | Código 0 y conteos exactos. Con el lote de 7, también 0. Con una alteración en el `seq` 5001: código 1, con `cpp_recalculado` en 5001 y `cpp_anterior` en 5002. PASS |
| K7 | Sin poder verificar | Código 2 con MySQL inalcanzable (`DATABASE_UNREACHABLE`), sin `DATABASE_URL`, con contraseña incorrecta (`DATABASE_AUTH_FAILED`), con la base sin migrar (`MIGRATIONS_PENDING`) y con una base inexistente (`DATABASE_ACCESS_DENIED`). Stdout vacío; la contraseña no aparece en ninguna salida. PASS |
| K8 | Usuario temporal `qa051b_ro` con solo `SELECT` sobre la base K2 | `inventory_verify_ok`, código 0. Los `CHECKSUM TABLE` de las tablas del inventario y de `_prisma_migrations` son iguales antes y después. Usuario borrado (0 filas en `mysql.user`). PASS |
| K9 | `docker build --target api` del worktree y `node scripts/inventory-verify.ts` en el contenedor | Base K2: código 0. Una copia con la existencia alterada: código 1 con `existencia_distinta`. Imagen borrada. PASS |
| I1 | Búsqueda en `packages`, `api`, `inventory-manager` y `landing-pages/src` | 0 `update*`, `upsert` ni `delete*` sobre documentos o movimientos, también en las formas de OBS-1, y 0 `UPDATE` o `DELETE` en SQL crudo sobre esas tablas (solo la alteración deliberada de la prueba de CA-15). El contrato del store y el store en memoria no tienen ninguna operación que los edite o borre. PASS |
| I2 | `npm run lint` y `arquitectura.md` | Lint en verde (S2). OBS-1 documentado. Ver DEF-002 |
| RB1–RB3 | CA-23: volcado de K2 con los parámetros de `backup.sh` (sin `--databases`) y restauración en otra base | Las 28 tablas tienen `CHECKSUM TABLE` idénticos, incluidas `inventory_supplier`, `_document`, `_movement` y `_stock`. `verify` sobre la restaurada: 0. Una compra nueva continúa el `seq`. Una segunda restauración (volcado de la restaurada) devuelve `replayed: true` al reenviar la clave. `verify`: 0. PASS |
| V1 | Base de V | Migrada con el worktree. Contiene un administrador de QA, la semilla (22 artículos y 3 recetas) y los datos de K2. El fixture A5 choca con la semilla, así que la importación no escribe nada, como está previsto: el A5 se probó en el 1a. `verify`: 0. |
| V2 | `api` de `main` sin la variable | `DATABASE_NEWER_THAN_CODE`, código 1. PASS |
| V3 (main) | `api` de `main` con `DATABASE_ALLOW_NEWER_SCHEMA=true` | Arranca con `database_newer_than_code_allowed`. Productos y página públicos de los dos negocios: 200. Acceso al admin: 201. Sesión, productos y página de los dos negocios, y usuarios: 200. La `landing-pages` de `main` responde 200 en `/`, `/birria` y `/molotes`, con `landing_products_loaded` y `landing_page_loaded` de los dos negocios. 0 errores en los logs. PASS |
| V3 (épica) | `api` e `inventory-manager` de `27c7a25` (copia con `git archive`, lock y `prisma` idénticos a la rama, `@restaurante/*` resuelto a la copia), sin la variable | Arranca sin aviso de esquema. Lista de 30 artículos y 30 fichas en 200. `locked = true` en los artículos con movimientos y en los que están en recetas. Categorías y recetas en 200; la receta de "Taco QA" cuesta 15.0000 por referencia (R-7, lo esperado). Cambiar la unidad de un artículo con movimientos: 409 `ITEM_LOCKED`. Pasarlo a no inventariable: 422. Editar su nombre: 200. Alta: 201. Admin: acceso 303 y lista, ficha, recetas y receta en 200; la búsqueda "máSA" encuentra "Masa QA". 0 errores. PASS |
| V4 | Checksums antes y después de la épica, y `verify` | `inventory_document`, `inventory_movement` e `inventory_supplier` sin cambios. Solo cambian `inventory_item` e `inventory_change` (la edición y el alta) e `inventory_stock` (la fila nueva del alta, en 0 y sin costo). `verify`: 0, con 29 artículos. PASS |
| V5 / H1 | `api` e `inventory-manager` del worktree sin la variable, sobre la misma base | Sin avisos nuevos. 31 fichas en 200; la ficha de la API no lleva `stock` (es del PR 2). La receta de "Taco QA" cuesta 11.2500 con origen `cpp` (0.500 × 22.5000), y el admin la muestra con la etiqueta "CPP". Cambiar la unidad: 409; pasar a no inventariable: 422; editar el nombre: 200. El artículo creado por `27c7a25` admite una compra al instante (3.000 kg a 20.0000, `seq` 1). `verify`: 0. 0 errores en los logs. PASS |
| V6 | Comparación con la nota de vuelta atrás del plan | Coincide. El único efecto es que `27c7a25` costea por referencia. PASS |
| P1 | Pool de 5 conexiones: 5, 20 y 40 operaciones simultáneas de 1 y de 50 líneas, sobre 1 y sobre 5 artículos | 0 errores en las 12 combinaciones. Máximo de 1 108 ms (40 documentos de 50 líneas); p95 de 211 ms con 20 operaciones de 1 línea sobre el mismo artículo. Sin hallazgos |
| X1–X11 | Mutaciones en una copia del árbol en el scratchpad | Ver la tabla de mutaciones |
| T1–T4 | Pruebas permanentes | Ver "Revisión de las pruebas permanentes" |

**Mutaciones** (pruebas permanentes: unitaria `inventory-kardex` y MySQL `prisma-inventory-kardex`)

| ID | Mutante | Lo detectan las pruebas permanentes | Lo detectan las sondas de QA |
|---|---|---|---|
| X1a | Truncar en `applyEntryReversal` | Sí: CA-6 y CA-30 (unitarias) | — |
| X1b | Truncar en `purchaseUnitCost` | Sí: CA-4 | — |
| X2 | Sin el tope en 0 (RN-T3-12) | **No** (OBS-6) | Sí: F14 da −444.5000 |
| X3 | Sin `lockStock` | Sí: 3 MySQL (CA-13 y RN-T3-11) | — |
| X4 | Sin `lockDocument` | No | No: es redundante con el bloqueo de las existencias, porque los documentos de una compra tocan sus mismos artículos (OBS-9) |
| X5 | Sin la búsqueda previa de la clave | No | Equivalente: la clave única lleva al mismo resultado |
| X6 | Sin el manejo de `IdempotencyRaceError` | **No** (OBS-7) | Sí: C8 (los reenvíos simultáneos fallan) |
| X7a | `verify` sin `cpp_recalculado` | Sí: CA-15 en MySQL | — |
| X7b | `verify` sin `existencia_distinta` | Sí: unitaria y MySQL | — |
| X8a | MySQL: los movimientos vigentes cuentan los revertidos | **No** (OBS-7) | Sí: F3 en MySQL |
| X8b | Lo mismo en memoria | Sí: CA-5 y CA-8 | — |
| X9a | MySQL: `lastPurchaseCost` sin excluir el documento | **No** (OBS-7) | Sí: F4, 5 comprobaciones |
| X9b | Lo mismo en memoria | Sí: CA-6, CA-7 y CA-30 | — |
| X10 | `businessDate` con la zona del servidor | Solo con el proceso en otra zona: con `TZ=UTC` falla CA-11; con la zona local (CST) no (OBS-8) | Sí: F7 en `Asia/Tokyo` y `UTC` |
| X11a | Sin DT-T3-3 | Sí | — |
| X11b | Sin `remaining.set` (dos líneas de la misma devolución) | **No** (OBS-7) | Sí: F13 |

### Criterios de aceptación

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 | PASS | F1, igual en memoria y MySQL: `compra 50.000 kg, 0.000 → 50.000, 20.0000, total 1000.0000`, CPP y último costo 20.0000, unidad capturada `bulto` |
| CA-2 | PASS | F1: 75.000, CPP 21.3333 y último costo 24.0000 |
| CA-3 | PASS | Unitaria y S3; con −2.000 y una compra de 10 por 250.00, existencia 8.000 y CPP 25.0000 |
| CA-4 | PASS | F2: 3.3333 y 6.6667. La mitad exacta 0.15625 da 0.1563; 31.2500 sale exacto. La coma, 3 decimales en el importe, 4 en la cantidad y 5 en el costo dan error en su campo. N1 |
| CA-5 | PASS | F3: 12.500 a 18.5000 con un movimiento `saldo_inicial`. Un segundo saldo y un saldo tras una compra dan `InitialBalanceNotAllowedError` con "ajuste" |
| CA-6 | PASS | F4: 50.000 kg con CPP **20.0000** (19.99995 redondeado hacia arriba) y último costo 20.0000. El original queda con `reversedById` y su total sin cambios. Una segunda reversión da `AlreadyReversedError`, y revertir una reversión, `ReversalNotReversibleError`. C3 en MySQL. X1a |
| CA-7 | PASS | F5: −8.000 con el CPP de 30.0000 conservado. La vista previa marca negativo sin escribir. Existencias la muestra como "Negativo" (−240.00) |
| CA-8 | PASS | F3: un saldo revertido admite otro; una compra revertida sin otros movimientos, también |
| CA-9 | PASS | F6: un error por línea para el Compuesto, el padre, el no inventariable, el inactivo y el inexistente, y nada escrito. Proveedor inactivo o inexistente, y `supplierId` no entero: error en `supplierId` |
| CA-10 | PASS | F6: pza sin factor y 0.001 g dan error en la línea. Un factor decimal (3 cajas de 0.75 kg) da 2.250 kg a 20.0000 |
| CA-11 | PASS | F7 en tres zonas del proceso; X10 |
| CA-12 | PASS | F8 (reinicio real entre procesos), C8, RB3 y S3 |
| CA-13 | PASS | C1, C2, C10, P1 y S3; `verify` en 0; X3 |
| CA-14 | PASS (dominio) | B1–B3: `InventoryBusyError` a los ~5 s y nada a medias. El 503 en HTTP y conservar lo escrito son de los PR 2 y 3 |
| CA-15 | PASS | I1 y K3–K4. Cada alteración que pide RF-13 da código distinto de 0, sin valores. X7 |
| CA-16 | PASS (dominio) | F9: 50.000 kg a 20.0000 valen 1 000.00; negativo y sin costo; sin Compuestos, padres ni no inventariables; un inactivo con existencia; totales igual a la suma de la página; CPP 0 cuenta "con costo" |
| CA-17 | PASS (dominio) | F10: página 1 con 50 movimientos (`seq` 51 → 2), página 2 con `seq` 1; total 51; documento, usuario y fechas |
| CA-18 | PASS | F11: de 15.0000 por referencia a 10.0000 por `cpp`, sin versión nueva; ficha con CPP y último costo de 20.0000; el Intermedio con receta se costea por receta (DT-7). V5/H1 por HTTP: origen `cpp` y etiqueta "CPP" |
| CA-19 | PASS | C9 con movimientos reales; V3 y V5: 409 y 422 |
| CA-23 | PASS (sonda) | RB1–RB3. El simulacro con `ops/backup` es del PR 3 |
| CA-24 | PASS | V1–V6 |
| CA-29 | PASS | F12: salida de 2.000 a 20.0000; "otro" sin nota, entrada sin CPP ni costo, costo escrito con CPP (DT-T3-7), costo escrito en una salida, motivo y dirección inválidos: todos rechazados en su campo. Una salida sin CPP queda sin costo |
| CA-30 | PASS | F13: devolver 5.000 de 25.000 sale a 24.0000 con CPP 21.1428 (igual al cálculo a mano). 20.000 más se aceptan; 0.001 más, y dos líneas que juntas pasan lo pendiente, se rechazan. Devolver desde un saldo inicial o una compra revertida, o una línea de otra compra, también. Con el artículo y el proveedor inactivos se permite. Revertir la devolución libera lo pendiente. C4 y C5 |
| RN-T3-12 a RN-T3-14 | PASS | F14 (CPP 0.0000, y la entrada siguiente promedia desde 0 a 1.5000); F4 y F7 (fecha de hoy local); F13 (unidad base `kg` y lo que queda por devolver en `kg`) |
| CA-26 (lo tocado) | PASS | S1–S7, V3, V5 y H1 |

### Defectos encontrados

#### DEF-001

- **Severidad:** `MINOR`.
- **Criterio de aceptación afectado:** ninguno directamente. Afecta al caso límite del ticket "una cantidad o un importe superan los límites de precisión, o la existencia acumulada se desborda: se rechaza con un mensaje en el campo" y a RN-T3-10.
- **Descripción:** el dominio valida la existencia acumulada (`DECIMAL(13,3)`) y el costo unitario de compra (`DECIMAL(15,4)`). No valida, en cambio, que caben en sus columnas:
  - el valor de la línea (`line_total`, `DECIMAL(19,4)`);
  - el total del documento (`total_cost`, `DECIMAL(19,4)`);
  - el CPP que calcula una reversión o una devolución (`DECIMAL(15,4)`).
- **Consecuencia:** en MySQL, la escritura falla en la base y se convierte en `DatabaseUnavailableError` (503 "Base de datos no disponible"), sin escribir nada. El store en memoria acepta esos mismos valores, así que las pruebas unitarias no lo ven.
- **Pasos para reproducir** (sonda N3, MySQL):
  1. Saldo inicial de 9 999 999 999.999 kg a 99 999 999 999.9999 (o un ajuste de entrada igual).
  2. Saldo inicial de 50 líneas de 10 000 000 kg a 10 000 000.0000 (cada línea cabe; el total, no).
  3. Saldo de 0.001 kg a 99 999 999 999.0000, compra de 999.999 kg por 0.00 y reversión de esa compra. La reversión da un CPP de 100 000 000 000.0000.
- **Resultado esperado:** un `InventoryValidationError` con un mensaje en el campo de la línea (o en el documento), como ya ocurre con la existencia y con el costo unitario de compra.
- **Resultado actual:** `DatabaseUnavailableError` en los tres casos. Documentos, movimientos y existencias sin cambios; `verify` en 0.
- **Evidencia:**
  - N3 en MySQL frente a memoria: memoria acepta 999 999 999 999 899 000 000.0000 y un CPP de 100 000 000 000.0000.
  - Con valores realistas (100 000 kg a 100 000.0000 = 10 000 000 000.00, y la misma reversión con un costo de 1 000) todo funciona.
- **Impacto:** solo con importes de billones de pesos por línea o costos de cientos de millones por unidad, que no se dan en el negocio. No hay corrupción ni escritura parcial. El usuario vería "inténtalo de nuevo" en lugar del motivo, y reintentar no lo resuelve.
- **Severidad propuesta:** `MINOR`, porque los valores no son realistas.
- **Recomendación:** comprobar en el dominio el rango de `line_total`, `total_cost` y el CPP resultante antes de escribir, con el mismo mensaje en el campo que ya se usa para la existencia. Puede ir en el PR 2, junto a los 422 por línea.

#### DEF-002

- **Severidad:** `TRIVIAL`.
- **Criterio de aceptación afectado:** ninguno (documentación; `.claude/rules/documentacion.md`).
- **Descripción:** `restaurante/docs/arquitectura.md`, en la sección Kardex, apartado "Inmutabilidad", dice que `npm run inventory:verify` "detecta cualquier fila alterada". K3 muestra que no detecta cambios en `line_total`, `last_cost`, `occurred_on` ni en el autor. RF-13 tampoco lo pide.
- **Pasos para reproducir:** K3, alteraciones 15 a 18: código 0.
- **Resultado esperado:** que el texto diga lo que se comprueba: la cadena de cantidades, existencias, CPP, `seq` y tipo, y la existencia guardada.
- **Resultado actual:** "cualquier fila alterada".
- **Impacto:** puede hacer creer que `verify` protege el importe o el autor de un documento. No afecta al funcionamiento.
- **Recomendación:** ajustar la frase. Si se quiere, mencionar también el tope en 0 de RN-T3-12 en el apartado "Costo", que hoy no lo nombra.

### Observaciones (no bloquean)

- **OBS-5 (K3).** `verify` no comprueba `line_total`, `last_cost`, `occurred_on` ni el autor. RF-13 no lo pide. Lo relevante para la documentación está en DEF-002.
- **OBS-6 (X2).** RN-T3-12 (el CPP no baja de 0), decidida por el usuario, no tiene ninguna prueba permanente: quitar el tope no rompe nada. Recomendación: un caso unitario, por ejemplo la cadena de F14, que es funcional según `testing.md`.
- **OBS-7 (X6, X8a, X9a, X11b).** Las implementaciones MySQL de "movimientos vigentes" y de "último costo sin el documento que se revierte", la carrera del primer envío simultáneo (`IdempotencyRaceError` → reenvío) y el límite de lo pendiente entre dos líneas de la misma devolución no tienen prueba permanente que las detecte. Las sondas de QA sí las detectan. Recomendación: valorar en el PR 2 si se añaden a las pruebas de MySQL o de la API, sin duplicar lo que ya cubre la memoria.
- **OBS-8 (X10).** La prueba de CA-11 solo detecta que "hoy" use la zona del servidor si el proceso corre en otra zona. En el CI (UTC) la detecta; en una máquina con la zona de Ciudad de México, no.
- **OBS-9 (X4).** El bloqueo del documento de origen es defensa en profundidad: el bloqueo de las existencias ya serializa las devoluciones y la reversión de una misma compra (C3 a C5 pasan sin él).
- **OBS-10 (N1).** Se aceptan " 12 " (con espacios) y "00012.50", y se normalizan. Es el comportamiento que ya tenía `parseDecimal` en T2. El número 12 (no texto) se rechaza.
- **OBS-11 (N4).** El valor de una existencia negativa redondea la mitad alejándose de cero (−0.005 da −0.01). Es simétrico con los positivos, y el ticket no define el caso.
- **OBS-12 (R-6).** La prueba permanente de ida y vuelta de DECIMAL y `DATE` está en la frontera de las "pruebas de driver" de `testing.md`. La pide el plan aprobado (H-11), y la sonda F muestra que el riesgo existe en otras zonas (UTC+14 pasa).

### Revisión de las pruebas permanentes (`testing.md`)

- **T1.** Los 17 casos unitarios nuevos y los 8 de MySQL protegen comportamientos de la app: CPP, saldo, reversión, ajuste, devolución, fecha, doble envío, existencias, Kardex, costo real, `verify`, concurrencia y RN-T3-11. Ninguno es de arquitectura ni de mudanza; la prueba de DECIMAL y `DATE` queda como OBS-12. PASS
- **T2.** No hay duplicados. CA-12 está en memoria (reenvío y huella) y en MySQL (reinicio y clave única), que son caminos distintos. CA-15 está en el verificador puro y en una alteración por SQL real. La carrera de RN-T3-11 con movimientos reales complementa la del 1a, que simulaba `last_seq`. PASS
- **T3.** El diff de `tests/` frente a `27c7a25` solo añade: +330 en la unitaria, con un comentario reescrito, y +175 en el archivo nuevo. No añade `retry`, `testTimeout` ni esperas fijas. Los datos son ficticios. PASS
- **T4.** `git status` final: los mismos 23 cambios del Implementation Result (22 archivos más el ticket). Ninguna sonda en el árbol. PASS

### Regresión

Suite completa en verde, con los mismos totales (S3). Siguen funcionando:

- las landings y la `api` de `main` sobre la base con el Kardex (V3);
- el catálogo, las recetas y el admin de `27c7a25` (V3 y V4);
- el worktree sobre los datos que dejó la épica (V5 y H1).

El inventario de T1/T2 y las búsquedas siguen igual.

### Responsive, Accesibilidad, UX/UI, SEO

No aplican: el 1b no cambia vistas, CSS, JS de navegador ni rutas. No se usó Chrome. H1 comprueba por HTTP la etiqueta "CPP" en el admin.

### Performance

P1 y S4: sin hallazgos. 0 errores con 40 documentos simultáneos de 50 líneas.

### Pendientes de revisión manual

Ninguno.

### Limpieza

- **Bases:** se borraron todas las `restaurante_test_qa051b_*`, incluidas las de dos sondas interrumpidas. `SHOW DATABASES LIKE 'restaurante\_test%'` devuelve 0.
- **Usuario e imagen:** se borró el usuario temporal `qa051b_ro` (0 filas en `mysql.user`) y la imagen `qa051b-api:probe` (0 imágenes `qa051b`). La caché de construcción de Docker no se purgó: es compartida.
- **Procesos y puertos:** se detuvieron los servidores de V y H. Los puertos 3101 a 3116 están libres, y no queda ningún proceso de Node de las sondas ni de Vitest.
- **Archivos:** se borraron la copia de mutaciones, la copia de `27c7a25`, las sondas, los env, los volcados y los logs del scratchpad.
- **Repositorio:** `git worktree list` muestra solo `main` y el worktree del ticket, que queda como estaba. El árbol de `main` sigue limpio.
- **MySQL:** `restaurante-mysql-dev-1` sigue encendido, como se pidió.

### Resultado final

QA_APPROVED

## Pendientes del PR 1b para los PR 2 y 3

Decisión de la sesión principal sobre los defectos del QA del PR 1b (ninguno es `MAJOR`): DEF-002 se corrige en este PR y DEF-001 queda para el PR 2.

- **DEF-002 (`TRIVIAL`): corregido en este PR.** En `restaurante/docs/arquitectura.md`, la sección Kardex dice ahora qué comprueba `inventory:verify` (la cadena de cantidades, existencias y CPP, el `seq`, el tipo, la cantidad distinta de 0 y la existencia guardada) y qué no (`line_total`, `last_cost`, `occurred_on` y el autor). Ya no promete detectar «cualquier fila alterada». También menciona en «Costo» el tope en 0 de RN-T3-12.
- **DEF-001 (`MINOR`): pendiente del PR 2.** Validar en el dominio, antes de escribir, el rango de `line_total` y `total_cost` (`DECIMAL(19,4)`) y del CPP que calculan una reversión o una devolución (`DECIMAL(15,4)`). Debe dar un error en el campo (422), como ya pasa con la existencia y con el costo unitario de compra, y no un 503. Hoy solo se da con valores irreales.
- **OBS-6: pendiente del PR 2.** Añadir un caso unitario de RN-T3-12 (CPP con tope en 0; la cadena de la sonda F14), que es funcional según `testing.md`.
- **OBS-7: pendiente del PR 2.** Valorar pruebas de MySQL o de la API, sin duplicar lo que ya cubre la memoria, para:
  - los "movimientos vigentes" de MySQL;
  - el "último costo sin el documento que se revierte";
  - la carrera del primer envío simultáneo (`IdempotencyRaceError` → reenvío);
  - el límite de lo pendiente entre dos líneas de la misma devolución.
- **OBS-8: pendiente del PR 2.** Revisar la prueba de CA-11 para que detecte el uso de la zona del servidor aunque el proceso corra en la zona del negocio. Por ejemplo, fijando `process.env.TZ` a otra zona dentro de la prueba.
- **OBS-5, OBS-9, OBS-10, OBS-11 y OBS-12:** no requieren acción.
  - OBS-5 está cubierta por la corrección de DEF-002.
  - OBS-9: el bloqueo del documento es defensa en profundidad.
  - OBS-10 y OBS-11 son el comportamiento existente y simétrico.
  - OBS-12: la prueba de DECIMAL y `DATE` la pide el plan aprobado (H-11).

## Implementation Result — PR 2

### Rama

`feature/REQ-F-051-kardex-api` (worktree `.claude/worktrees/req-f-051-pr2`), creada desde `origin/epic/inventario` (`851ec79`) y sin upstream. Destino: `epic/inventario`. Sin commit.

### Cambios realizados

- **Contratos (`packages/contracts`):**
  - `inventory-kardex.ts`, nuevo:
    - rutas en `inventoryKardexPaths` y códigos en `INVENTORY_KARDEX_ERROR_CODES`;
    - listas cerradas `INVENTORY_MOVEMENT_TYPES`, `INVENTORY_STOCK_ITEM_TYPES` e `INVENTORY_ADJUSTMENT_REASONS`, copias de core;
    - esquemas Zod de proveedores, documentos, movimientos, vista previa, existencias, Kardex del artículo y opciones;
    - tipos de las peticiones. Los decimales viajan como texto.
  - `inventory.ts`: `itemStockSchema`; la ficha añade `stock` (RF-10).
  - `admin-client.ts`: 17 métodos nuevos. Los documentos esperan 201 o 200 (`replayed`). El error admite `items` (409 `INITIAL_BALANCE_NOT_ALLOWED`) y `returnIds` (409 `DOCUMENT_HAS_RETURNS`).
- **API (`api/src/admin`):**
  - `inventory-supplier-routes.ts`: lista, ficha con historial, alta con `Idempotency-Key` en memoria (como las altas de T1), edición con 409 `SUPPLIER_VERSION_CONFLICT` y `current`, inactivar y reactivar.
  - `inventory-kardex-routes.ts`:
    - opciones;
    - saldo inicial, compra, ajuste, devolución y reversión, con `Idempotency-Key` persistente (DT-14): 201, o 200 con `replayed`;
    - vista previa de la reversión, lista y detalle de documentos, existencias (`estado` = `todos|negativos|sin_costo`) y Kardex del artículo;
    - cuerpos cerrados, también por línea (422 "Campo desconocido");
    - los `fields` de los filtros usan los nombres de la query;
    - errores de dominio traducidos a 404, 409, 422 y 503;
    - logs solo con ids, tipos y conteos.
  - `router.ts`, `index.ts` y `server.ts`: las 16 rutas nuevas, y los repositorios de proveedores y Kardex sobre el mismo store, con `BUSINESS_TIMEZONE`.
  - `inventory-routes.ts`: la ficha devuelve `stock`.
- **Core, DEF-001:** `compute` (`kardex-repository.ts`) rechaza en el campo, antes de escribir, un `line_total` o un `total_cost` que no caben en `DECIMAL(19,4)` y un costo unitario o CPP resultante que no cabe en `DECIMAL(15,4)`. Responde 422, no 503.
- **Semilla (RF-15, CA-28):** `seedKardexDev` en `api/scripts/support/inventory-dev-seed.ts`, llamada desde `npm run inventory:seed-dev`.
  - Crea 3 proveedores (uno inactivo).
  - Crea 7 documentos: un saldo inicial, dos compras de masa (CPP 21.3333), una de carne, un ajuste que deja el queso en negativo, y una compra revertida con su reversión.
  - La cebolla queda «Sin costo».
  - Tiene su propia comprobación de idempotencia, así que amplía una base ya sembrada con T2.
- **Pruebas** (funcionales, sin duplicar lo existente):
  - `api/tests/integration/admin-inventory-kardex-api.test.ts`, nuevo, 8 pruebas:
    - CA-21 en las 17 rutas (Editor 403 sin escritura; 401; sin CSRF, 403); el Gerente y el Administrador leen todo;
    - proveedores (CA-22): nombre repetido, contacto, conflicto con quién guardó, reactivar con el nombre en uso, historial, filtro y 404;
    - CA-12 por la API: 201, 200 `replayed` y 422 `IDEMPOTENCY_KEY_REUSED`;
    - 422 por línea y campo desconocido;
    - 409 `INITIAL_BALANCE_NOT_ALLOWED` (con `items`), `DOCUMENT_HAS_RETURNS` (con `returnIds`), `ALREADY_REVERSED`, `REVERSAL_NOT_REVERSIBLE` y `DOCUMENT_NOT_RETURNABLE`;
    - DEF-001 en 422;
    - 503 `INVENTORY_BUSY`;
    - existencias, lista de documentos, Kardex paginado, opciones y la ficha con `stock`.
  - `api/tests/unit/inventory-kardex.test.ts`, +3 pruebas:
    - DEF-001: línea, total del documento y CPP de una reversión;
    - **OBS-6:** RN-T3-12, el CPP queda en 0. Sin el tope, la prueba falla;
    - semilla del Kardex: datos, cadena en 0 e idempotencia.
    - **OBS-8:** la prueba de CA-11 añade un negocio en `Pacific/Kiritimati` (UTC+14). Detecta el uso de la zona del servidor en cualquier máquina (en UTC y en Ciudad de México). Sin `timeZone` en `businessDate`, falla.
  - `landing-pages/tests/integration/prisma-inventory-kardex.test.ts`, +2 pruebas (**OBS-7**):
    - en MySQL: último costo sin la compra revertida, lo pendiente entre dos líneas de una devolución, y los movimientos vigentes antes y después de revertir (con el saldo inicial que vuelve a admitirse);
    - dos primeros envíos simultáneos con la misma clave: un solo documento, y el otro recibe ese mismo. Sin el manejo de `IdempotencyRaceError`, falla.
  - `api/tests/unit/contract-types.test.ts` (se modifica): las tres listas nuevas son iguales en core y en el contrato.
  - `api/tests/support/admin.ts` e `inventory-manager/tests/support/api-double-inventory.ts` (soporte): los repositorios nuevos, y `stock: null` en la ficha del doble.
- **Documentación:** `docs/arquitectura.md` §6 (rutas, códigos y formato) y `README.md` (la semilla ampliada).

### Criterios de aceptación (alcance del PR 2: API y semilla; pantallas en el PR 3)

| CA | Estado | Evidencia |
|---|---|---|
| CA-12 | PASS | API: reenvío 200 e `IDEMPOTENCY_KEY_REUSED`. MySQL: carrera del primer envío y reinicio (PR 1b) |
| CA-14 | PASS (API) | 503 `INVENTORY_BUSY` sin escritura. La espera agotada real sigue siendo una sonda de QA |
| CA-21 | PASS (API) | Las 17 rutas con el Editor (403), sin sesión (401) y sin CSRF (403). Las pantallas, en el PR 3 |
| CA-22 | PASS | Por la API |
| CA-16 a CA-18 | PASS (API) | Existencias, Kardex paginado y `stock` de la ficha |
| CA-28 | PASS (desarrollo) | Semilla en memoria y en MySQL; la producción no la ejecuta (salvaguardas de T1) |
| CA-11 (OBS-8) | PASS | Zona del negocio distinta de la del servidor |
| RN-T3-12 (OBS-6) | PASS | Prueba permanente |
| DEF-001 | Corregido | Unitaria y API: 422 en el campo |
| Resto | Fuera del PR 2 | PR 3 (pantallas, OBS-12 a y c, `ops/backup` y `despliegue.md`) |

### Validaciones ejecutadas

Todo desde `restaurante/` en el worktree.

- `npm run typecheck`: 0.
- `npm run lint`: 0, con `check-private-data`.
- `npm run build:css`: 0.
- `npm test`: `api` 1281, `landing-pages` 917 e `inventory-manager` 297, todas en verde.
- **Duración de los archivos nuevos o modificados:** API, unos 1.1 s; Kardex en MySQL, unos 6.2 s; unitaria, menos de 1 s.
- **Mutaciones rápidas descartables** (todas restauradas):
  - sin el tope de RN-T3-12: falla 1 prueba;
  - `businessDate` sin zona: falla 1 prueba;
  - sin el manejo de `IdempotencyRaceError`: falla la carrera en MySQL.
- **Procedimiento documentado** (`README`), en una base temporal `restaurante_test_seed051` migrada y después borrada:
  - `npm run inventory:seed-dev`: "22 artículos y 3 recetas" y "3 proveedores y 7 documentos";
  - repetido: "no se cargó" en las dos partes;
  - `npm run inventory:verify`: `inventory_verify_ok`, código 0.
- **Limpieza:** sin bases `restaurante_test*`, sin procesos de Vitest y sin temporales.
  - El worktree se conserva para QA.
  - El MySQL de desarrollo queda encendido (`npm run db:up`).

### Archivos afectados

- **Nuevos:**
  - `restaurante/packages/contracts/inventory-kardex.ts`
  - `restaurante/api/src/admin/inventory-kardex-routes.ts`
  - `restaurante/api/src/admin/inventory-supplier-routes.ts`
  - `restaurante/api/tests/integration/admin-inventory-kardex-api.test.ts`
- **Modificados:**
  - `restaurante/packages/contracts/{admin-client,index,inventory}.ts`
  - `restaurante/packages/core/inventory/kardex-repository.ts`
  - `restaurante/api/src/admin/{index,router,inventory-routes}.ts` y `restaurante/api/src/server.ts`
  - `restaurante/api/scripts/inventory-seed-dev.ts` y `restaurante/api/scripts/support/inventory-dev-seed.ts`
  - `restaurante/api/tests/support/admin.ts`
  - `restaurante/api/tests/unit/{contract-types,inventory-kardex}.test.ts`
  - `restaurante/landing-pages/tests/integration/prisma-inventory-kardex.test.ts`
  - `restaurante/inventory-manager/tests/support/api-double-inventory.ts`
  - `restaurante/docs/arquitectura.md` y `restaurante/README.md`
  - este ticket.
- **Sin cambios** en `deploy/`, ni migraciones, ni dependencias.

### Riesgos o pendientes

- **Respuesta de una escritura:** la API vuelve a leer el documento con `getDocument` tras escribirlo, para devolver el nombre del proveedor. Es una lectura más por escritura, despreciable con el volumen esperado.
- **Error de estado en Existencias:** un valor de `estado` desconocido se envía a core marcado (`?valor`) para que el 422 llegue con la clave `estado`.
- **Pendientes del PR 3:** pantallas (proveedores, existencias, documentos, formularios con bloques de filas, reversión con confirmación y Kardex en la ficha), CA-25 y CA-26, OBS-12 (a) y (c), `ops/backup` (DT-T3-6 A) y `docs/despliegue.md`. El admin todavía no usa los métodos nuevos del cliente.

### Ronda 2 (correcciones del QA)

**Defectos corregidos.**

- **DEF-003 (`MINOR`, CA-21):** en `api/src/admin/inventory-kardex-routes.ts`, `supplierReturn` y `reverse` leían el `:id` antes que el acceso. Ahora `writeDocument` comprueba primero la sesión y el rol (con CSRF) y después lee el id (`withId`). Con un id que no es numérico, el orden queda como en el resto: anónimo 401, Editor 403 y Gerente sin CSRF 403, y no 404.
  - **Prueba:** la lista de rutas de CA-21 de `admin-inventory-kardex-api.test.ts` (archivo existente) añade `POST documentos/abc/devoluciones` y `POST documentos/abc/reversion`.
  - **Mutación descartable:** con el orden anterior, la prueba falla.
- **DEF-004 (`MINOR`, RF-10, RN-T3-1, DT-T3-2):** la ficha (`GET articulos/:id`) y el Kardex del artículo (`GET articulos/:id/kardex`) dan `stock: null` a todo artículo sin existencias: un padre, un Compuesto o un no inventariable. Antes solo se lo daban al padre.
  - La regla vive en `holdsStock` (`api/src/admin/inventory-shared.ts`) y la usan las dos rutas.
  - El comentario de `itemStockSchema` y el de la ficha en `packages/contracts/inventory.ts` describen la regla.
  - **Prueba:** la de lecturas de `admin-inventory-kardex-api.test.ts` (archivo existente) comprueba `stock: null` en la ficha y en el Kardex de un Compuesto y de un no inventariable.
  - **Mutación descartable:** con la regla anterior (solo el padre), la prueba falla.

**OBS-19 (documentación).** `docs/arquitectura.md` §6:
- documenta 400 `INVALID_IDEMPOTENCY_KEY` (formato de la clave) y 422 `IDEMPOTENCY_KEY_REUSED` (misma clave con otros datos), comunes a las altas de T1 y T2 y a T3;
- aclara que `stock` es `null` en un artículo sin existencias.
- El número de rutas correcto es **17**: corrige el "16" del primer Implementation Result.

**Sin tocar:** OBS-13 a OBS-18 quedan registradas en el QA Report para el PR 3 o el cierre.
- OBS-14 y OBS-15: mapear en las pantallas los campos `lines.N.quantity` de la reversión y `lines.N.item` / `lines.N.sourceMovement`.
- OBS-16: el PR 3 siempre envía `Idempotency-Key`.

**Validaciones (ronda 2), desde `restaurante/`:**
- `npm run typecheck`: 0.
- `npm run lint`: 0, con `check-private-data`.
- `npm test`: `api` 1281, `landing-pages` 917 e `inventory-manager` 297, todas en verde.
- Las pruebas relevantes por separado (`admin-inventory-kardex-api`, `inventory-kardex`, `contract-types` y `admin-inventory-api`): 57 en verde.
- Limpieza: sin bases `restaurante_test*`, sin procesos de Vitest y sin temporales. El worktree se conserva para QA.

**Archivos de la ronda 2:**
- `restaurante/api/src/admin/inventory-kardex-routes.ts`
- `restaurante/api/src/admin/inventory-routes.ts`
- `restaurante/api/src/admin/inventory-shared.ts`
- `restaurante/packages/contracts/inventory.ts`
- `restaurante/api/tests/integration/admin-inventory-kardex-api.test.ts`
- `restaurante/docs/arquitectura.md`
- este ticket.

## QA Action Plan — PR 2

### Objetivo

Validar con evidencia que el PR 2 (rama `feature/REQ-F-051-kardex-api`, sin commit, sobre `851ec79`) cumple lo suyo:

- expone el Kardex, los proveedores y las existencias por HTTP con el contrato, los permisos y los códigos de error del Technical Action Plan;
- el cliente HTTP del admin habla correctamente con esa API;
- la semilla de desarrollo cumple RF-15 y CA-28;
- DEF-001, OBS-6, OBS-7 y OBS-8 del QA del PR 1b quedan resueltos;
- nada de T1, T2, el PR 1 ni el resto del monorepo cambia.

Fuentes: el ticket (requisitos, CA, Technical Action Plan §"Contratos y rutas de la API (PR 2)", DoD del PR 2, "Pendientes del PR 1b"), el diff del worktree y las reglas del proyecto. CodeGraph solo indexa `main`, que no tiene el inventario: en Q1 se usaron lecturas dirigidas del worktree. NotebookLM no estaba disponible en la sesión de Q1 (no hay herramientas MCP `notebooklm`): no se consultó.

### Requisito bajo prueba

- **En el PR 2:** las rutas del plan (6 de proveedores, 10 del Kardex y la ficha con `stock`), CA-12 y CA-14 por HTTP, CA-15 (ninguna ruta edita ni borra), CA-21 en la API, CA-22, CA-16 a CA-18 en la API, CA-27 (logs de las rutas nuevas), CA-28, RF-15, RF-10 (ficha), DEF-001, OBS-6, OBS-7, OBS-8, la documentación de §6 y el README, y el DoD del PR 2 (`inventory:verify` en el contenedor `api` construido).
- **Fuera del PR 2, sin tratarlo como defecto:** pantallas, CA-25, CA-26 completo (solo lo tocado), CA-31 / OBS-12, `ops/backup` y `despliegue.md` (PR 3). Las reglas de cálculo ya aprobadas en el 1b no se repiten salvo por HTTP y MySQL donde el PR 2 añade un camino nuevo.
- **Conteo de rutas:** el router añade 17 (6 de proveedores, 10 de documentos, existencias y opciones, y `articulos/:id/kardex`). El Implementation Result dice 16 en un sitio y 17 en otro; se comprueban las 17.

### Valores esperados verificados a mano (antes de ejecutar)

Semilla de RF-15 tal como está escrita en `seedKardexDev`:

| Artículo | Movimientos | Existencia | CPP | Último costo | Valor |
|---|---|---|---|---|---|
| Masa de maíz | 2 bultos por 1 000.00; 25 kg por 600.00 | 75.000 | 21.3333 | 24.0000 | 75 × 21.3333 = 1 599.9975 → 1 600.00 |
| Carne de res cruda | 10 kg por 1 600.00 | 10.000 | 160.0000 | 160.0000 | 1 600.00 |
| Jitomate | saldo 5 kg a 25 | 5.000 | 25.0000 | null | 125.00 |
| Sal | saldo 2 kg a 12; compra 1 kg por 15.00 → CPP (24 + 15) / 3 = 13.0000; reversión: (3·13 − 1·15) / 2 = 12.0000 | 2.000 | 12.0000 | null (DT-T3-4: no queda ninguna compra vigente) | 24.00 |
| Queso | saldo 3 kg a 140; ajuste de salida de 4 kg | −1.000 ("Negativo") | 140.0000 | null | −140.00 |
| Cebolla y el resto de artículos de RN-T3-1 sin movimientos | — | 0.000 | null ("Sin costo") | null | null |

Totales esperados de Existencias: positivas 3 349.00, negativas −140.00 y "Sin costo" igual al número de artículos de RN-T3-1 sin CPP, contado aparte por SQL. 3 proveedores (1 inactivo) y 7 documentos (saldo, 4 compras, ajuste y reversión).

### Criterios de aceptación

| CA (alcance del PR 2) | Pruebas |
|---|---|
| CA-21 (permisos en la API) | S3, A1, A2, N1 |
| CA-22 (proveedores) | S3, A3, C3 |
| CA-12 (doble envío por HTTP, también con reinicio) | S3, A4, H3, C1 |
| CA-14 (sistema ocupado por HTTP) | S3, B1, B2 |
| CA-15 (ninguna ruta edita ni borra) | A9, H1 |
| CA-16, CA-17 y CA-18 en la API | S3, A6, A7, H2 |
| RF-10 (`stock` en la ficha) | A7, N4 |
| CA-27 (logs) y privacidad | L1, L2, S2 |
| CA-28 y RF-15 (semilla) | SD1 a SD5 |
| DEF-001 | D1 a D4 |
| OBS-6, OBS-7 y OBS-8 | X1 a X5, S4 |
| Cliente HTTP del admin (17 métodos) | CL1, CL2 |
| DoD del PR 2: `verify` en el contenedor `api` | K1 |
| CA-26 (regresión de lo tocado) y DoD | S1 a S6, R1 a R3, T1 a T4, DOC1 a DOC3 |

### Riesgos identificados

- **R-1. Orden de las comprobaciones en `devoluciones` y `reversion`.** `supplierReturn` y `reverse` calculan `routeId` antes de `access.inventory`, al revés que el resto de rutas de inventario y que el orden documentado en la cabecera del archivo (401 → 403 → CSRF → 404). Con un id no numérico (`/documentos/abc/reversion`), un anónimo o un Editor recibirían 404 en lugar de 401/403. La prueba permanente de CA-21 usa el id `1`, así que no lo vería (N1).
- **R-2. `stock` en la ficha de un Compuesto o de un no inventariable.** La ficha y el Kardex del artículo devuelven `stock: null` solo para un padre. Por DT-T3-2, un Compuesto y un no inventariable tienen su fila de existencia (en 0, sin costo), así que la API los mostraría con `{ quantity: '0.000', avgCost: null, lastCost: null }`. DT-T3-2 dice que esa fila "nunca se muestra" y RN-T3-1 que esos artículos no tienen existencias (N4; ver decisión 1).
- **R-3. DEF-001 en una reversión.** El error del CPP fuera de rango se informa en `lines.N.quantity`, pero el cuerpo de una reversión solo tiene `reason`. El cliente no tendría un campo donde mostrarlo. Se registra lo que devuelve (D3); se valora frente a "mensaje en el campo".
- **R-4. Semilla no atómica.** `seedKardexDev` crea proveedores y documentos uno a uno y su idempotencia mira si ya hay alguno. Si falla a mitad, un segundo intento no completa nada. Solo afecta al desarrollo (SD4).
- **R-5. Escritura correcta seguida de un fallo de lectura.** Tras escribir, la ruta vuelve a leer el documento. Si esa lectura falla, el cliente ve un 503 con el documento ya creado. Con `Idempotency-Key`, el reintento devuelve 200 `replayed`; sin clave, duplicaría (H3, observación si se confirma).
- **R-6. Logs.** Los 422 pasan por `validationFailed` y el manejador central: hay que comprobar que no registran valores de los campos (costos, cantidades, nombres o contactos) (L1).
- **R-7. Valores del filtro `estado`.** Existencias usa valores en español (`todos|negativos|sin_costo`) y proveedores los de core (`all`, …), como los artículos de T1. No es un requisito del ticket: se registra como observación si se confirma.
- **R-8. `api/.env` del worktree.** Toda sonda y todo arranque usan variables exportadas o un env propio en el scratchpad que apunta a una base `restaurante_test_qa051c_*`. Se comprueba por conteos que no se usó la base de desarrollo.
- **R-9. Cliente sin pruebas.** Ninguna prueba ejerce los 17 métodos nuevos de `admin-client.ts` (`expect`, consulta en español, cabecera `Idempotency-Key`, `items` y `returnIds` en el error) (CL1).

### Pruebas funcionales de la API (en proceso y sobre MySQL)

Las sondas se escriben en el scratchpad y se ejecutan desde la raíz del worktree. Las de MySQL arrancan la `api` del worktree (`node src/server.ts`) con un env propio sobre una base `restaurante_test_qa051c_*` creada con `TEST_ADMIN_DATABASE_URL` y migrada con el `migrate deploy` del worktree, y un administrador y un gerente de QA (más un editor).

- **A1. CA-21 en las 17 rutas** con ids existentes e inexistentes: Editor 403 `FORBIDDEN_ROLE`, anónimo 401, sin CSRF 403 `CSRF_INVALID` en cada escritura, y el Administrador y el Gerente en 2xx. Tras todo, documentos, movimientos, existencias, proveedores e historial sin cambios (conteos y `CHECKSUM TABLE`).
- **A2.** Mismas comprobaciones contra la `api` real sobre MySQL (H1), no solo en memoria.
- **A3. Proveedores (RF-1, CA-22):** alta (nombre de 80 y 81 caracteres, contacto teléfono, correo, texto libre y 121 caracteres), duplicado sin distinguir mayúsculas entre activos, mismo nombre que un inactivo (se admite), edición con versión, 409 con `current` (`version`, `updatedAt`, `updatedBy`), `overwrite`, inactivar y reactivar con el nombre en uso (422), filtros `estado`/`q`/`pagina` (incluida la búsqueda sin acentos, "molíno") y 404. Alta con la misma `Idempotency-Key`: un solo proveedor. Historial con las acciones en orden.
- **A4. Documentos (RF-2 a RF-6):** saldo inicial, compra (con y sin proveedor; proveedor inactivo → 422 en el campo), ajuste de entrada y salida (`otro` sin nota → 422), devolución y reversión, cada uno con 201, `Location` y el cuerpo del contrato; el mismo envío → 200 `replayed: true` sin `Location`; la misma clave con otro cuerpo → 422 `IDEMPOTENCY_KEY_REUSED`; clave mal formada → 400 `INVALID_IDEMPOTENCY_KEY`. Valores de CA-1, CA-2, CA-5, CA-6, CA-29 y CA-30 exactos en la respuesta y en el detalle.
- **A5. Errores propios:** 409 `INITIAL_BALANCE_NOT_ALLOWED` con `items`, `ALREADY_REVERSED`, `REVERSAL_NOT_REVERSIBLE`, `DOCUMENT_HAS_RETURNS` con `returnIds`, `DOCUMENT_NOT_RETURNABLE` y `DOCUMENT_REVERSED`; 404 `DOCUMENT_NOT_FOUND` e `ITEM_NOT_FOUND`. Todos con la forma central `{ error: { code, message } }` y sin datos internos.
- **A6. Lecturas:** existencias (columnas, totales, `estado`, `tipo`, `categoria`, `q` sin acentos, paginación de 50 con 51 artículos), lista de documentos (más reciente primero, filtros `tipo` y `proveedor`, paginación), detalle (`returnable`, `returns`, "Revertido por" con `reversedById` y "Reversión de" con `reversesDocumentId`, `costBasis: con_iva`, importe 0 "sin cargo"), vista previa de la reversión (`negative` cuando la existencia quedaría negativa) y opciones (solo artículos de RN-T3-1 activos, `initialBalanceAllowed`, `referenceCost` y solo proveedores activos).
- **A7. Kardex del artículo y ficha (RF-8 y RF-10):** del más reciente al más antiguo, 50 por página (51 movimientos → 2 páginas), fechas en `BUSINESS_TIMEZONE` (offset `-06:00`) y `occurredOn`, cantidades con signo, `stock` en la ficha igual al de Existencias. CA-18: la receta muestra el costo con origen `cpp` tras una compra por la API.
- **A8. Cuerpos:** campos desconocidos en la raíz y en las líneas (422), 51 líneas, 0 líneas, `lines` que no es lista, cuerpo de más de 64 KiB (413), sin JSON (415) y JSON mal formado (400).
- **A9. CA-15 en HTTP:** `PUT`, `PATCH` y `DELETE` sobre `documentos`, `documentos/:id` y los movimientos responden 404/405 y no cambian nada. Revisión del router: ninguna ruta de edición o borrado.

### Pruebas negativas y casos límite

- **N1. Orden de las comprobaciones (R-1):** anónimo, Editor y Gerente sin CSRF contra `documentos/abc/devoluciones`, `documentos/abc/reversion`, `documentos/0/reversion` y `documentos/99999999999/reversion`, comparado con las demás rutas con id (`proveedores/abc`, `documentos/abc`). Esperado: 401, 403 y 403 antes que 404.
- **N2. Filtros inválidos:** `pagina=0`, `pagina=-1`, `pagina=abc` y `estado=raro` por separado y juntos en existencias, documentos, proveedores y Kardex; `tipo` fuera de lista; `proveedor=abc`. Esperado: 422 con las claves de la query (`pagina`, `estado`, …). Se registra si dos errores juntos solo informan uno (la prueba permanente con `estado=raro&pagina=0` solo espera `estado`).
- **N3. Fecha del hecho por HTTP (CA-11):** hoy, hoy − 31, mañana y hoy − 32, con la `api` en `TZ=Asia/Tokyo` y `BUSINESS_TIMEZONE=America/Mexico_City`.
- **N4. `stock` fuera de RN-T3-1 (R-2):** ficha y Kardex de un padre, un Compuesto, un no inventariable y una variante. Se registra el valor de `stock` en cada uno (ver decisión 1).
- **N5. Artículos no admitidos por HTTP (CA-9 y CA-10):** Compuesto, padre, no inventariable e inactivo en una línea; pza en un artículo en kg sin factor; cantidad que redondea a 0. 422 en esa línea y nada escrito.

### DEF-001 (MySQL, por HTTP y por core)

Los tres escenarios de N3 del QA del 1b, ahora en MySQL:

- **D1.** Saldo inicial (y ajuste de entrada) de 9 999 999 999.999 kg a 99 999 999 999.9999: 422 en el campo de la línea, no 503.
- **D2.** Saldo inicial de 50 líneas de 10 000 000 kg a 10 000 000.0000: 422 en `lines` (total del documento).
- **D3.** Saldo de 0.001 kg a 99 999 999 999.0000, compra de 999.999 kg por 0.00 y reversión de esa compra: 422 con la clave que se devuelva (R-3).
- **D4. Bordes:** un `line_total` y un `total_cost` exactamente en 999 999 999 999 999.9999 se aceptan y se guardan; uno más se rechaza. Un CPP resultante de 99 999 999 999.9999 se acepta. En todos, `inventory:verify` en 0 y nada escrito en los rechazos.

### Concurrencia y sistema ocupado (MySQL, por HTTP; 10 rondas cada una)

- **C1.** 5 peticiones simultáneas del primer envío con la misma `Idempotency-Key`: 1 respuesta 201 y 4 respuestas 200 `replayed` con el mismo id, nunca 5xx. Un documento.
- **C2.** 20 compras simultáneas por HTTP sobre un artículo: 20 documentos, `seq` contiguo, existencia exacta y `verify` en 0; ningún 503 con el pool de 5 (medición de latencia como hallazgo).
- **C3.** Dos ediciones simultáneas del mismo proveedor con la misma versión: una 200 y otra 409 con `current`.
- **B1. CA-14 por HTTP:** una sesión `mysql` externa (usuario administrador de pruebas) mantiene `FOR UPDATE` sobre la existencia unos 8 s. Una compra responde 503 `INVENTORY_BUSY` con el mensaje "inténtalo de nuevo" a unos 5 s, y no se escribe nada. Al soltar, la misma clave crea 1 documento (201).
- **B2.** Lo mismo con una reversión y una devolución bloqueando la compra de origen.

### Arranque real y reinicio (H)

- **H1.** `api` del worktree sobre la base de QA: arranca sin errores; las 17 rutas responden; `inventory:verify` en 0 al terminar todas las sondas.
- **H2.** El `inventory-manager` del worktree contra esa `api`: acceso, artículos, ficha (con `stock` en la respuesta) y recetas en 200, sin errores en los logs (el contrato de la ficha cambió).
- **H3. CA-12 con reinicio por HTTP:** compra con clave → 201; se detiene la `api` (SIGTERM) y se arranca de nuevo; el mismo envío → 200 `replayed` con el mismo id; otro cuerpo → 422. Un documento. R-5 se valora por revisión del código y se registra.

### Logs y privacidad (CA-27)

- **L1.** Se capturan los logs de la `api` durante A1 a D4, B y H, con un proveedor de contacto `qa-contacto@ejemplo.example` y artículos de nombre `QA-NOMBRE-*`, cantidades y costos con dígitos reconocibles (`7777.777`, `8888.8888`). Búsqueda por patrón: 0 apariciones de nombres, contactos, cantidades ni costos. Aparecen los eventos del plan (`inventory_document_created|replayed`, `inventory_supplier_saved`, `inventory_busy`, `inventory_document_key_reused`) con solo ids, tipos y conteos.
- **L2.** `npm run lint` con `check-private-data` en verde (S2), y los datos de la semilla y de las pruebas nuevas son ficticios (`.example`, teléfonos de ceros).

### Semilla (RF-15, CA-28)

Procedimiento del README, desde `restaurante/`, con `DATABASE_URL` exportada hacia una base `restaurante_test_qa051c_seed` migrada:

- **SD1.** `npm run inventory:seed-dev` en una base vacía: los dos mensajes ("22 artículos y 3 recetas", "3 proveedores y 7 documentos"). Por SQL y por la API: los valores de la tabla de valores esperados, 1 proveedor inactivo, 1 reversión con "Revertido por", 1 negativo y la cebolla "Sin costo". `inventory:verify`: 0.
- **SD2.** Repetido: "no se cargó" en las dos partes, sin cambios (checksums).
- **SD3.** Base ya sembrada con la semilla de T2 de `851ec79` (sin Kardex): el segundo paso añade solo el Kardex.
- **SD4. Salvaguardas:** `NODE_ENV=production` y un host no local se niegan sin escribir. Una base con un proveedor creado a mano: no carga el Kardex. R-4 se registra por revisión.
- **SD5. Producción:** la `api` no ejecuta la semilla al arrancar (H1 sobre una base vacía: 0 proveedores y 0 documentos), y la imagen `api` no contiene `inventory-seed-dev.ts` (K1).

### `inventory:verify` en el contenedor (DoD del PR 2)

- **K1.** `docker build --target api` del worktree. En el contenedor: `node scripts/inventory-verify.ts` contra la base de SD1, código 0; contra una copia con una existencia alterada, código 1 sin datos en la salida. Se lista `scripts/` de la imagen (sin la semilla). Imagen borrada al terminar (ver decisión 2).

### Cliente HTTP del admin

- **CL1.** Sonda que crea `createAdminApiClient` del worktree contra la `api` de H1 con una sesión de gerente, y llama a los 17 métodos nuevos: resultado `ok` con el cuerpo validado por su esquema; 201 y 200 `replayed` aceptados en los documentos; la cabecera `Idempotency-Key` llega (se comprueba por el reenvío); los filtros llegan con las claves en español; los errores 409 traen `items` y `returnIds`; un 422 trae `fields`; un 503 se distingue.
- **CL2.** Revisión de `admin-client.ts`: cada método usa la ruta de `inventoryKardexPaths` y el esquema de su respuesta.

### Pruebas de regresión

- **S1.** `npm run build:css` y `npm run typecheck`: código 0.
- **S2.** `npm run lint`, con `check-private-data`: código 0, sin avisos.
- **S3.** `npm test` completo, frente al Implementation Result: `api` 1281, `landing-pages` 917 e `inventory-manager` 297, y el número de archivos (frente al 1b: `api` 56 → 57, `landing-pages` 65 e `inventory-manager` 18).
- **S4. Duración y estabilidad:** `admin-inventory-kardex-api.test.ts`, `inventory-kardex.test.ts` y `prisma-inventory-kardex.test.ts` medidos con el reporter de Vitest, por debajo de 20 s. El de MySQL, 10 veces seguidas sin fallos intermitentes; la unitaria con `TZ=America/Mexico_City`, `UTC` y `Asia/Tokyo` (OBS-8).
- **S5. Consumidores.** Por grep en el worktree: `server.ts`, `admin/index.ts`, `router.ts`, `inventory-routes.ts`, `tests/support/admin.ts`, el doble del `inventory-manager` y las pruebas que comparan la forma de la ficha (`admin-inventory-api.test.ts` y las del admin). Se confirma que la suite los ejecuta.
- **S6. Sin cambios ajenos:** `git diff 851ec79` no toca `deploy/` (la suma no cambia), `landing-pages/Dockerfile`, `package-lock.json`, `compose.yaml`, los `.env.example`, `packages/db/prisma`, `.claude/CLAUDE.md` ni `.claude/agents`.
- **R1.** Las rutas de T1 y T2 (artículos, categorías, recetas, importación) y las del resto del admin (productos, página, usuarios, bot, cotizador) siguen en verde en la suite (S3) y por HTTP en H1 (lista, ficha, receta y una edición).
- **R2.** La `landing-pages` del worktree contra la `api` de H1: `/`, `/birria` y `/molotes` en 200 con productos.
- **R3. Vuelta atrás:** el PR 2 no añade migración. CA-24 no se repite (ver decisión 4); se comprueba en S6 que `packages/db/prisma` no cambia.

### Revisión de las pruebas permanentes (`testing.md`)

- **T1.** Cada caso nuevo (8 en `admin-inventory-kardex-api.test.ts`, 3 en `inventory-kardex.test.ts` y 2 en `prisma-inventory-kardex.test.ts`) y el caso de CA-11 modificado protegen un comportamiento de la app (permisos, CSRF, idempotencia, errores, proveedores, existencias, Kardex, semilla, RN-T3-12, fecha del negocio, movimientos vigentes, devolución). La comparación de listas core ↔ contrato de `contract-types.test.ts` se valora frente a "pruebas de arquitectura" (es la misma técnica que ya existía para T1 y T2).
- **T2. Duplicados:** CA-12 en memoria (1b), en MySQL (1b) y ahora por HTTP; CA-21 frente a las pruebas de acceso de T1 y T2; DEF-001 en la unitaria y en la API. Cada comportamiento en la prueba más barata.
- **T3.** El diff de `tests/` frente a `851ec79` no borra ni debilita pruebas, y no añade `retry`, `testTimeout` ni esperas fijas. Datos ficticios.
- **T4.** En el árbol final no queda ninguna sonda, y `git status` coincide con el del Implementation Result.

### Mutaciones (descartables, en una copia del árbol en el scratchpad)

- **X1.** Sin el tope en 0 de RN-T3-12 (OBS-6): debe fallar la unitaria.
- **X2.** `businessDate` sin `timeZone` (OBS-8): debe fallar CA-11 con `TZ=America/Mexico_City` y con `TZ=UTC`.
- **X3.** Sin el manejo de `IdempotencyRaceError` (OBS-7): debe fallar la carrera en MySQL; se ejecuta 5 veces para ver si la detección es estable.
- **X4.** MySQL: movimientos vigentes contando los revertidos, `lastPurchaseCost` sin excluir el documento y sin `remaining.set` (OBS-7): deben fallar las pruebas de MySQL.
- **X5.** Sin cada comprobación de DEF-001 (línea, total, CPP): deben fallar la unitaria o la de la API.
- **X6.** Rutas: sin `unknownLineFields`, con `access.inventory({ write: false })` en una escritura, sin el mapa `STOCK_STATUS` y sin `renameFields`: deben fallar las pruebas de la API.
- Un mutante que sobrevive a una regla aprobada es una observación, no un defecto.

### Documentación

- **DOC1.** `arquitectura.md` §6: rutas, códigos y formato coinciden con el router y con las respuestas reales de A1 a A9 (incluidos 400 `INVALID_IDEMPOTENCY_KEY` y 422 `IDEMPOTENCY_KEY_REUSED`).
- **DOC2.** README: la fila de `inventory:seed-dev` describe lo que hace SD1 a SD4.
- **DOC3.** `.claude/CLAUDE.md`, `senior-fullstack.md` y `deploy/` sin cambios.

### Pruebas que no aplican en el PR 2

- **Navegador, responsive, accesibilidad, UX/UI, SEO, WhatsApp y performance del frontend:** el PR 2 no cambia vistas, CSS, JS de navegador ni rutas del admin. No se usa Claude in Chrome. H2 y R2 comprueban por HTTP que el admin y las landings siguen respondiendo.
- **Performance del backend:** solo C2 y S4.
- **Respaldo (CA-23):** el PR 2 no cambia tablas; el simulacro con `ops/backup` es del PR 3.

### Evidencia requerida

- La salida y el código de salida de cada comando.
- Por sonda: el estado HTTP, el código de error y los valores frente a los esperados.
- Los `CHECKSUM TABLE` y conteos de A1, SD2 y los rechazos.
- Los logs de la `api` de H, B y L (solo los eventos y el resultado del patrón).
- La salida de `verify` en K1 y SD1.
- El resultado de cada mutación.
- Todo queda en el QA Report del ticket.

### Criterios de aprobación

- CA-12, CA-14, CA-15, CA-21, CA-22, CA-27 y CA-28 (en la API), CA-16 a CA-18 y RF-10 (en la API), DEF-001 y OBS-6 a OBS-8 en PASS con evidencia.
- El DoD del PR 2: `verify` en el contenedor `api` (K1) y la semilla (SD1).
- S1 a S3 en verde, y S4 por debajo de 20 s sin intermitencias.
- Sin defectos `BLOCKER` ni `CRITICAL`. Los `MAJOR` necesitan una decisión del usuario.
- Las observaciones (mutantes supervivientes, R-4, R-5, R-7 y C2) no bloquean si se registran.

### Limpieza

Al terminar, también si algo falla:

- se borran las bases `restaurante_test_qa051c_*`, tras confirmar el prefijo;
- se borra la imagen de K1;
- se detienen la `api`, el `inventory-manager`, la `landing-pages`, Vitest y las sesiones `mysql` de B, y se liberan los puertos;
- se borran la copia de las mutaciones, las sondas, los env y los logs del scratchpad;
- se comprueba con `git worktree list`, `lsof`/`ps`, `docker images` y `SHOW DATABASES LIKE 'restaurante\_test%'`;
- el MySQL de desarrollo `restaurante-mysql-dev-1` queda encendido y su base de desarrollo no se toca.

### Decisiones para la aprobación

1. **`stock` en la ficha de un Compuesto o un no inventariable (R-2, N4).** Si N4 confirma que la API devuelve `{ quantity: '0.000', avgCost: null, lastCost: null }` para ellos (y `null` solo para un padre), ¿cómo se clasifica?
   - **A (recomendada):** defecto `MINOR` que se corrige en el PR 2: `stock: null` para todo artículo fuera de RN-T3-1, porque DT-T3-2 dice que esa fila "nunca se muestra".
   - **B:** se acepta en la API y el PR 3 decide qué mostrar en la ficha.
2. **K1:** ¿se autoriza construir en local la imagen `api` del worktree (`docker build --target api`, unos minutos) para ejecutar `verify` en el contenedor, como pide el DoD del PR 2, y borrarla al terminar? Si no, el DoD queda pendiente.
3. **Sondas y arranques:** ¿se autorizan las sondas en el scratchpad (fuera de `landing-pages/tests/`), las bases temporales `restaurante_test_qa051c_*`, el arranque de la `api`, el `inventory-manager` y la `landing-pages` del worktree con un env propio, la sesión `mysql` de B1 y B2 con el usuario administrador de pruebas, y el reinicio de la `api` de H3? Todo se borra al terminar.
4. **CA-24:** el PR 2 no añade migración ni cambia `packages/db/prisma`. ¿Está de acuerdo en no repetir la vuelta atrás con `main` y con `851ec79`, y comprobar solo en S6 que el esquema no cambia?
5. **R-1 (orden 404 frente a 401/403):** si N1 confirma que un anónimo o un Editor reciben 404 con un id no numérico en `devoluciones` y `reversion`, ¿lo clasifico como `MINOR` (no expone datos ni escribe nada, pero rompe el orden documentado y CA-21 dice "403 en todas las rutas")? Recomendación: sí, `MINOR`, a corregir en este PR porque es mover una línea.

## QA Report — PR 2

### Ronda

1. Rama `feature/REQ-F-051-kardex-api`, sin commit, sobre `851ec79`. El usuario aprobó el plan con "Sí, apruebo el plan con las cinco recomendaciones":

- R-2, si se confirma: `MINOR` y se corrige en el PR 2 (A);
- K1: se construye la imagen `api` en local;
- sondas, bases `restaurante_test_qa051c_*`, arranques con env propio, sesión `mysql` de B y reinicio de H3;
- CA-24 no se repite (solo S6);
- R-1, si se confirma: `MINOR` y se corrige en este PR.

Todo se ejecutó sobre el MySQL 8.4 local, en bases propias, con la `api` del worktree en `TZ=Asia/Tokyo` y `BUSINESS_TIMEZONE=America/Mexico_City`, sin `api/.env` (`env -i`). Las sondas, en el scratchpad. Ninguna se escribió en el repositorio.

### Pruebas ejecutadas

| ID | Acción | Resultado |
|---|---|---|
| S1 | `npm run build:css` y `npm run typecheck` | Código 0 y 0. PASS |
| S2 | `npm run lint` | Código 0, sin avisos; `check-private-data`: 898 archivos, sin datos privados. PASS |
| S3 | `npm test` | `api` 57/1281, `landing-pages` 65/917 e `inventory-manager` 18/297, todo en verde, igual que el Implementation Result. Código 0. PASS |
| S4 | Duración y estabilidad | `inventory-kardex.test.ts` + `admin-inventory-kardex-api.test.ts`: 36/36 en ~1 s con `TZ=America/Mexico_City`, `UTC` y `Asia/Tokyo`. `prisma-inventory-kardex.test.ts`, 10 veces seguidas: 10/10 en cada una, de 4.33 a 4.67 s. PASS |
| S5 | Consumidores | `server.ts`, `admin/index.ts`, `router.ts`, `inventory-routes.ts`, `tests/support/admin.ts` y el doble del admin. La suite (S3) y H2 los ejercen. PASS |
| S6 | `git diff 851ec79` | Sin cambios en `deploy/`, el Dockerfile, `package-lock.json`, `compose.yaml`, los `.env.example`, `packages/db/prisma`, `.claude/CLAUDE.md` ni `.claude/agents`. Sin migración nueva: CA-24 no se repite (decisión 4). PASS |
| A1/A2 | CA-21 en las 17 rutas, `api` real sobre MySQL | Editor 403 `FORBIDDEN_ROLE`, anónimo 401, sin CSRF y con CSRF erróneo 403 en cada escritura. El Administrador y el Gerente, 200 en las lecturas. `CHECKSUM TABLE` de documentos, movimientos, existencias, proveedores e historial iguales antes y después. PASS (con ids numéricos; ver N1) |
| A3 | Proveedores (RF-1, CA-22) | 80 caracteres → 201; 81 → 422 `name`. Contacto de teléfono → 201; texto libre y 121 caracteres → 422 `contact`. Alta con la misma `Idempotency-Key` → mismo proveedor (1 fila). "MOLÍNO qa" frente a "Molíno QA" → 422 `name`. Edición 200 (v2) y 409 `SUPPLIER_VERSION_CONFLICT` con `current` (`version` 2, `updatedBy`). "Guardar encima" con la versión vigente → 200, en el historial como `overwrite_after_conflict`. Inactivar 200. Mismo nombre que un inactivo → 201. Reactivar con el nombre en uso → 422. "molino" encuentra "Molíno" (sin acentos); el filtro por defecto da solo los activos. Historial `deactivate, overwrite_after_conflict, update, create`. 404. PASS |
| A4 | Documentos (RF-2 a RF-6) | CA-1: 201 con `Location`, contrato válido, `costBasis: con_iva`, total 1000.0000; línea 50.000 kg, `enteredQuantity` 2.000 `bulto`, 20.0000, 0.000 → 50.000, CPP 20.0000. Reenvío → 200 `replayed`, mismo id y sin `Location`. Misma clave con otro cuerpo → 422 `IDEMPOTENCY_KEY_REUSED`; clave mal formada → 400 `INVALID_IDEMPOTENCY_KEY`. CA-2: CPP 21.3333, último costo 24.0000, y la ficha da `{75.000, 21.3333, 24.0000}`. Proveedor inactivo → 422 `supplierId`. Importe 0 → 201, total 0.0000. CA-5: 12.500 a 18.5000. CA-29: salida de 2.000 a 20.0000, existencia 8.000; `otro` sin nota → 422; entrada sin CPP ni costo → 422 en la línea. CA-30: devolver 25.001 → 422; devolver 5.000 → sale a 24.0000 y el CPP queda en 21.1428. CA-6: tras revertir, 50.000 y 20.0000, con "Revertido por #N". PASS |
| A5 | Errores propios | 409 `INITIAL_BALANCE_NOT_ALLOWED` con `items` (2), `DOCUMENT_HAS_RETURNS` con `returnIds`, `ALREADY_REVERSED`, `REVERSAL_NOT_REVERSIBLE`, `DOCUMENT_NOT_RETURNABLE` y `DOCUMENT_REVERSED`. 404 `DOCUMENT_NOT_FOUND` e `ITEM_NOT_FOUND`. Todos con la forma central. PASS |
| A6 | Lecturas | Existencias: contrato válido; sin el Compuesto, el padre ni el no inventariable, con la variante. CA-16: 50 × 20 = 1000.00. Filtros `negativos` (−1.000, −10.00, total negativo −10.00 aparte), `sin_costo`, `categoria`+`tipo` y `q` sin acentos ni mayúsculas ("qa-nombre-mása"). Paginación de 50. Documentos del más reciente al más antiguo, con filtros `tipo` y `proveedor`. "Reversión de #N". `returnable` 20.000 y `returns`. Vista previa con `negative: true` y −8.000, sin escribir. Opciones: solo artículos de RN-T3-1 activos y solo proveedores activos, con `referenceCost`, `avgCost` e `initialBalanceAllowed`. PASS |
| A7 | Kardex del artículo y ficha | 51 movimientos: 50 en la página 1 y 1 en la 2, el `seq` 51 primero, −1.500, existencia anterior 50.000. `recordedAt` con `-06:00`, autor y `occurredOn` del hecho (hoy − 3). `stock` igual en la ficha y en el Kardex. CA-18: receta con 0.500 kg a 20.0000 = 10.0000, origen `cpp`. PASS |
| A8 | Cuerpos | Campo desconocido en la raíz (`extra`) y en la línea (`lines.0.price`), 51 y 0 líneas, `lines` que no es lista y una línea que no es objeto → 422. Más de 64 KiB → 413, sin JSON → 415 y JSON roto → 400. Nota de 401 caracteres, folio de 41 y motivo de 401 caracteres o vacío → 422. Coma decimal y 3 decimales en el importe → 422. PASS |
| A9 | CA-15 por HTTP | `PUT`, `PATCH` y `DELETE` sobre `documentos`, `documentos/:id`, `documentos/:id/reversion` y `existencias` → 405. Tablas del Kardex intactas. PASS |
| N1 | Orden de las comprobaciones (R-1) | **DEF-003.** `POST documentos/{abc,0,99999999999}/{devoluciones,reversion}`: 404 para el anónimo, el Editor y el Gerente sin CSRF. Las demás rutas con id (`GET documentos/abc`, `GET proveedores/abc`, `GET documentos/abc/reversion`, `POST proveedores/abc/desactivar`) dan 401 / 403 / 403. FAIL |
| N2 | Filtros inválidos | Los 15 casos dan 422 con la clave de la query (`pagina`, `estado`, `tipo`, `categoria` y `proveedor`). Con dos errores a la vez (`estado=raro&pagina=0` y `tipo=xxx&pagina=0`) solo se informa uno (OBS-13). PASS |
| N3 | Fecha por HTTP (CA-11) | Con la `api` en `Asia/Tokyo`: hoy y hoy − 31 → 201; mañana y hoy − 32 → 422 `occurredOn`. PASS |
| N4 | `stock` fuera de RN-T3-1 (R-2) | **DEF-004.** Un padre da `stock: null`. Un Compuesto y un no inventariable dan `{ quantity: '0.000', avgCost: null, lastCost: null }` en la ficha y en `GET articulos/:id/kardex`. La variante, con `stock`, como se espera. FAIL |
| N5 | Artículos no admitidos (CA-9, CA-10) | Compuesto, padre, no inventariable, inactivo e inexistente → 422 en `lines.N.item` de esa línea, con su mensaje. pza en kg sin factor → 422 `lines.0.unit`. 0.0001 kg y 0.4 g → 422. Nada escrito (conteos). PASS |
| D1–D3 | DEF-001 en MySQL por HTTP | D1: saldo inicial y ajuste de entrada de 9 999 999 999.999 × 99 999 999 999.9999 → 422 `lines.0.quantity` ("El valor de la línea supera…"). D2: 50 líneas de 10⁷ × 10⁷ → 422 `lines` ("El total del documento…"). D3: reversión con un CPP de 10¹¹ → 422 `lines.0.quantity` ("El costo por unidad resultante…"). Nada escrito y 0 respuestas 503 en el log. PASS |
| D4 | Bordes de DEF-001 | Total exacto de 999 999 999 999 999.9999 → 201, guardado tal cual. 10¹⁵ (el máximo + 0.0001) → 422 `lines`, sin escribir. Línea 10 000.001 × 99 999 999 999.9999 → 422. CPP 99 999 999 999.9999 guardado. `verify`: 0. PASS |
| C1 | 5 primeros envíos simultáneos con la misma clave, 10 rondas | 10/10: una respuesta 201, cuatro 200 `replayed` con el mismo id y un documento. Ningún 5xx. PASS |
| C2 | 20 compras simultáneas por HTTP, 10 rondas | 10/10: 20 respuestas 201, `seq` del 1 al 20 y existencia 210.000. Latencia: p50 132 ms, p95 225 ms y máximo 254 ms. Ningún 503 con el pool de 5. PASS |
| C3 | Dos ediciones simultáneas del proveedor, 10 rondas | 10/10: 200 + 409 con `current.version` 2. PASS |
| B1 | CA-14 por HTTP: `FOR UPDATE` externo de unos 8 s sobre la existencia | 503 `INVENTORY_BUSY` a los 5 042 ms: "El inventario está ocupado con otra escritura: inténtalo de nuevo en unos segundos. No se guardó nada." Conteos sin cambios. Al soltar, la misma clave → 201, `replayed: false`. PASS |
| B2 | La compra de origen bloqueada | La reversión y la devolución → 503 `INVENTORY_BUSY` (5 030 ms), sin escribir. `verify`: 0. PASS |
| H1 | `api` del worktree sobre la base de QA | Arranca sin errores; las 17 rutas responden (A1 a A9). Una base vacía arranca sin proveedores ni documentos (el primer proveedor de A3 es el id 1). PASS |
| H2 | `inventory-manager` del worktree contra esa `api` | Acceso 303; lista de artículos, fichas (simple, Compuesto y padre), recetas, búsqueda "mása" y la receta con la etiqueta "CPP": 200. 0 avisos o errores en su log. PASS |
| H3 | CA-12 con reinicio real | Compra con clave → 201 (doc 276). SIGTERM (`server_stopping`) y nuevo arranque. El mismo envío → 200 `replayed` con el id 276; otro cuerpo → 422 `IDEMPOTENCY_KEY_REUSED`. Un documento con esa clave. PASS |
| R2 | `landing-pages` del worktree contra la `api` | `/`, `/birria` y `/molotes` en 200, con un `h1`, `landing_products_loaded` y `landing_page_loaded` de los dos negocios. 0 errores. PASS |
| L1 | Logs de la `api` (1 629 líneas, todas las sondas) | Quitando `time`, `ip` y `durationMs`: 0 apariciones de nombres (`QA-NOMBRE-*`, "Molíno", "Harina"…), contactos (`*.example`), cantidades, costos ni `unitCost`/`amount`/`quantity`. Los eventos llevan solo ids, tipo y conteos: `inventory_document_created {documentId, type, lines[, reversesDocumentId]}`, `inventory_document_replayed`, `inventory_supplier_saved {supplierId, action}`, `inventory_supplier_conflict {supplierId}`, `inventory_busy {method, path}` e `inventory_document_key_reused {path}`. El log de peticiones no incluye la consulta (`q`). PASS |
| L2 | Datos ficticios | `check-private-data` en verde (S2). La semilla usa `.example` y teléfonos de ceros. PASS |
| SD1 | `npm run inventory:seed-dev` en una base vacía | "22 artículos y 3 recetas" y "3 proveedores y 7 documentos". Por SQL y por la API, igual a la tabla de Q1: Masa 75.000 / 21.3333 / 24.0000 / 1600.00, Carne 160.0000, Jitomate 25.0000, Sal 2.000 / 12.0000 / sin último costo, Queso −1.000 / 140.0000. Totales 3349.00 y −140.00; "Sin costo" 10 (la Cebolla, 5 intermedios sin compras y 4 variantes). Compra revertida con "Revertido por" y autor "Semilla de desarrollo". 3 proveedores, 1 inactivo. `verify`: 0 (`artículos=20 movimientos=9 documentos=7`). PASS |
| SD2 | Repetida | "no se cargó" en las dos partes; `CHECKSUM TABLE` iguales. PASS |
| SD3 | Base sembrada solo con el catálogo de T2 | "El inventario ya tiene datos" y "Kardex de desarrollo cargado: 3 proveedores y 7 documentos". `verify`: 0. PASS |
| SD4 | Salvaguardas | `NODE_ENV=production` → código 1 sin escribir. Host no local → código 1 sin conectar. Con un proveedor creado a mano, el catálogo se carga pero el Kardex no (22 artículos, 1 proveedor, 0 documentos). PASS |
| SD5 | Producción | `server.ts` no menciona la semilla. La imagen `api` no trae `inventory-seed-dev.ts` (sí `scripts/support/inventory-dev-seed.ts`, que ya estaba en T2 y no se ejecuta solo). PASS |
| K1 | `docker build --target api` y `node scripts/inventory-verify.ts` en el contenedor | Base de SD1: `inventory_verify_ok …`, código 0. Copia con la existencia del Jitomate alterada: `inventory_verify_mismatch itemId=4 check=existencia_distinta`, código 1, sin datos. Imagen borrada. PASS |
| CL1 | Los 17 métodos de `createAdminApiClient` contra la `api` real | 23 comprobaciones. 201 y 200 `replayed` aceptados. La cabecera `Idempotency-Key` llega (el reenvío da el mismo id). Las consultas usan claves en español (`estado`, `q`, `pagina`, `tipo`, `proveedor` y `categoria`). El 409 trae `items` y `returnIds`; el 422 trae `fields`; el 404 se distingue. Una comprobación de `listStock` falló por un valor esperado mal calculado en la sonda (14.000, no 13.000); la respuesta es correcta (14.000, CPP 10.6667). PASS |
| CL2 | Revisión de `admin-client.ts` | Cada método usa la ruta de `inventoryKardexPaths` y el esquema de su respuesta. PASS |
| X1–X6 | Mutaciones en una copia del árbol | Ver la tabla |
| DOC1–DOC3 | Documentación | Ver "Documentación" |
| T1–T4 | Pruebas permanentes | Ver "Revisión de las pruebas permanentes" |

**Mutaciones**

| ID | Mutante | Lo detectan las pruebas permanentes |
|---|---|---|
| X1 | Sin el tope en 0 (RN-T3-12, OBS-6) | Sí: "RN-T3-12: … el CPP queda en 0" |
| X2 | `businessDate` sin `timeZone` (OBS-8) | Sí, con `TZ=America/Mexico_City` y con `TZ=UTC`: CA-11 |
| X3 | Sin el manejo de `IdempotencyRaceError` (OBS-7) | Sí, 5 de 5 ejecuciones: "OBS-7: dos primeros envíos simultáneos…" |
| X4a | MySQL: los movimientos vigentes cuentan los revertidos (OBS-7) | Sí (MySQL) |
| X4b | MySQL: `lastPurchaseCost` sin excluir el documento (OBS-7) | Sí (MySQL) |
| X4c | Sin `remaining.set` entre líneas de una devolución (OBS-7) | Sí (MySQL); la unitaria no |
| X5a | Sin el límite de `line_total` (DEF-001) | Sí: unitaria y API |
| X5b | Sin el límite del CPP o costo resultante (DEF-001) | Sí: unitaria |
| X5c | Sin el límite del total del documento (DEF-001) | Sí: unitaria |
| X6a | Sin `unknownLineFields` | Sí: API |
| X6b | Escrituras con `write: false` (sin CSRF) | Sí: API |
| X6c | Sin el mapa `STOCK_STATUS` | Sí: API |
| X6d | Sin `renameFields` | Sí: API |

### Criterios de aceptación

| CA (alcance del PR 2) | Resultado | Evidencia |
|---|---|---|
| CA-21 (permisos en la API) | **FAIL** | A1, A2 y C pasan con ids numéricos. N1: con un id no numérico o fuera de rango, `POST documentos/:id/devoluciones` y `POST documentos/:id/reversion` responden 404 al anónimo y al Editor (DEF-003) |
| CA-22 | PASS | A3, C3 y CL1 |
| CA-12 | PASS | A4, C1, H3 y CL1 |
| CA-14 | PASS | B1 y B2 |
| CA-15 | PASS | A9 |
| CA-16, CA-17 y CA-18 (API) | PASS | A6, A7 y SD1 |
| RF-10 (`stock` en la ficha) | **FAIL** | A7 pasa para los artículos de RN-T3-1. N4: el Compuesto y el no inventariable reciben `stock` (DEF-004) |
| CA-27 | PASS | L1 y L2 |
| CA-28 y RF-15 | PASS | SD1 a SD5 |
| DEF-001 | Corregido. PASS | D1 a D4, X5 |
| OBS-6, OBS-7 y OBS-8 | Resueltas. PASS | X1 a X4, S4 |
| Cliente HTTP | PASS | CL1 y CL2 |
| DoD: `verify` en el contenedor `api` | PASS | K1 |
| CA-26 (lo tocado) | PASS | S1 a S6, H2 y R2 |

### Defectos encontrados

#### DEF-003

- **Severidad:** `MINOR` (decisión 5 del usuario, tomada de antemano).
- **Criterio de aceptación afectado:** CA-21 ("El Editor recibe 403 en todas las rutas de T3 de la API"; "Sin sesión, la API responde 401").
- **Descripción:** `supplierReturn` y `reverse` (`restaurante/api/src/admin/inventory-kardex-routes.ts`, líneas 249 a 257) validan el id de la ruta (`routeId`) antes de comprobar la sesión, el rol y el CSRF (`access.inventory`, dentro de `writeDocument`). Si el id no es válido, responden 404 a cualquiera. Las demás rutas con id siguen el orden de la cabecera del archivo: 401 → 403 → CSRF → 404.
- **Pasos para reproducir:**
  1. Sin sesión: `POST /api/v1/admin/inventario/documentos/abc/reversion` con `{ "reason": "x" }`.
  2. Lo mismo con la sesión de un Editor, y con la de un Gerente sin `X-CSRF-Token`.
  3. Repetir con `documentos/abc/devoluciones`, y con los ids `0` y `99999999999`.
- **Resultado esperado:** 401, 403 `FORBIDDEN_ROLE` y 403 `CSRF_INVALID`, como en `POST proveedores/abc/desactivar` o `GET documentos/abc/reversion`.
- **Resultado actual:** 404 `DOCUMENT_NOT_FOUND` en los tres casos y en las 6 combinaciones.
- **Evidencia:** sonda N1: `"POST abc/reversion":[404,404,404]` frente a `"POST proveedores/abc/desactivar":[401,403,403]`. La prueba permanente de CA-21 usa el id `1` y no lo detecta.
- **Impacto:** no expone datos ni escribe nada. Rompe el orden documentado, y un cliente sin sesión no recibe el 401 que lo lleva al acceso.
- **Recomendación:** comprobar el acceso antes que el id en esas dos rutas, como en las demás. Conviene que la prueba de CA-21 incluya un id no numérico en esas rutas.

#### DEF-004

- **Severidad:** `MINOR` (decisión 1 del usuario, opción A, tomada de antemano).
- **Criterio de aceptación afectado:** RF-10 y RN-T3-1 ("nunca un padre, un Compuesto ni un no inventariable"), con DT-T3-2 ("la fila de un Compuesto queda en 0, nunca se mueve y nunca se muestra").
- **Descripción:** la ficha (`GET articulos/:id`, `inventory-routes.ts`) y el Kardex del artículo (`GET articulos/:id/kardex`, `inventory-kardex-routes.ts`, línea 343) devuelven `stock: null` solo si el artículo es padre. Un Compuesto y un no inventariable tienen su fila de existencia (DT-T3-2), así que la API los muestra con existencia 0 y sin costo.
- **Pasos para reproducir:**
  1. Crear un Compuesto y un insumo con `inventoriable: false`.
  2. `GET /api/v1/admin/inventario/articulos/:id` y `GET …/articulos/:id/kardex` de cada uno.
- **Resultado esperado:** `stock: null` en los dos, como en un padre.
- **Resultado actual:** `{ "quantity": "0.000", "avgCost": null, "lastCost": null }` en la ficha y en el Kardex de los dos.
- **Evidencia:** sonda N4: `"compuesto":{"ficha":{"quantity":"0.000","avgCost":null,"lastCost":null},"kardex":[200,{…}]}`, igual que en el no inventariable; `"padre":{"ficha":null,"kardex":[200,null]}`.
- **Impacto:** el PR 3 mostraría existencia y "Sin costo" en la ficha de un Compuesto o de un no inventariable, que según RN-T3-1 no tienen existencias. Hoy no lo ve nadie (no hay pantalla).
- **Recomendación:** `stock: null` para todo artículo fuera de RN-T3-1 en los dos sitios, y el comentario del contrato (`itemStockSchema`: "null en un padre") actualizado.

### Observaciones (no bloquean)

- **OBS-13 (N2).** Con dos filtros inválidos a la vez, el 422 solo informa uno (`estado=raro&pagina=0` → solo `estado`). Ya era así en las listas de T1 y T2, y el ticket no lo pide.
- **OBS-14 (R-3).** El CPP fuera de rango de una reversión (DEF-001) se informa en `lines.0.quantity`, un campo que el cuerpo de la reversión no tiene. La pantalla de confirmación del PR 3 tendrá que mostrarlo en la tabla de movimientos o como error general. Lo fija la prueba unitaria.
- **OBS-15.** Los errores del artículo de una línea van en `lines.N.item`, no en `lines.N.itemId`, y los de la devolución en `lines.N.sourceMovement`. Sigue la convención de T2 (`lines.N.ingredient` para `ingredientId`). El PR 3 debe mapearlos.
- **OBS-16 (R-5).** La respuesta de una escritura vuelve a leer el documento fuera de la transacción. Si esa lectura fallara, el cliente vería un 503 con el documento ya creado. Con `Idempotency-Key`, el reintento devuelve 200 `replayed` (H3 y B1 lo muestran); sin clave, duplicaría. El PR 3 debe enviar siempre la clave.
- **OBS-17 (R-7).** El filtro `estado` de Existencias usa valores en español (`todos|negativos|sin_costo`); el de proveedores, los de core (`all|active|inactive`), como los artículos de T1. Es coherente con T1, pero no dentro de T3.
- **OBS-18 (R-4).** `seedKardexDev` no es atómica: si falla a mitad, un segundo intento no completa el Kardex (su idempotencia mira si ya hay algún proveedor o documento). Solo afecta al desarrollo; se resuelve con una base nueva.
- **OBS-19 (DOC1).** `arquitectura.md` §6 no menciona 422 `IDEMPOTENCY_KEY_REUSED` ni 400 `INVALID_IDEMPOTENCY_KEY`, que también dan las altas de T1 y T2 sin documentar. Y lista 17 rutas: el Implementation Result dice 16 en un sitio.

### Revisión de las pruebas permanentes (`testing.md`)

- **T1.** Los 8 casos de `admin-inventory-kardex-api.test.ts`, los 3 de `inventory-kardex.test.ts`, el de CA-11 ampliado y los 2 de `prisma-inventory-kardex.test.ts` protegen comportamientos de la app (permisos, CSRF, idempotencia, errores, proveedores, existencias, Kardex, semilla, RN-T3-12, fecha del negocio, movimientos vigentes y devolución). Las mutaciones X1 a X6 lo confirman. La comparación de listas core ↔ contrato de `contract-types.test.ts` amplía una técnica que ya existía para T1 y T2. PASS
- **T2.** Sin duplicados: CA-12 en memoria y en MySQL (1b) y ahora por HTTP (201/200 y `IDEMPOTENCY_KEY_REUSED`), que son caminos distintos. CA-21 es nuevo para las rutas de T3. DEF-001 está en la unitaria (los tres límites) y en la API (el 422 sobre HTTP). PASS
- **T3.** El diff de `tests/` frente a `851ec79` solo añade (+141 líneas, −4 por comentarios e imports reescritos). No añade `retry`, `testTimeout` ni esperas fijas. Datos ficticios. PASS
- **T4.** `git status` final: los mismos 22 cambios del Implementation Result (el ticket incluido). Ninguna sonda en el árbol. PASS

### Regresión

Suite completa en verde, con los mismos totales (S3). El admin del worktree funciona contra la `api` nueva, con la ficha que ahora trae `stock` (H2). Las landings cargan productos y página de la `api` (R2). T1 y T2 (artículos, categorías, recetas con origen `cpp`) siguen igual en A1 a A7 y en H2. Sin migración ni cambios de despliegue (S6).

### Responsive, Accesibilidad, UX/UI, SEO

No aplican: el PR 2 no cambia vistas, CSS, JS de navegador ni rutas del admin. No se usó Chrome. H2 y R2 comprueban por HTTP que el admin y las landings siguen respondiendo.

### Performance

C2: 20 compras simultáneas sobre un artículo, con p95 de 225 ms y un máximo de 254 ms, sin 503. Sin hallazgos.

### Pendientes de revisión manual

Ninguno.

### Limpieza

- **Bases:** se borraron `restaurante_test_qa051c_api`, `_seed`, `_seedalt`, `_seedp` y `_seedt2`. `SHOW DATABASES LIKE 'restaurante\_test%'` devuelve 0.
- **Imagen:** se borró `qa051c-api:probe` (0 imágenes `qa051c`). La caché de construcción de Docker no se purgó: es compartida.
- **Procesos y puertos:** se detuvieron la `api` (3201/3204), el `inventory-manager` (3203) y la `landing-pages` (3200). Los puertos 3200 a 3209 están libres, y no queda ningún proceso de `src/server.ts`, Vitest ni sondas. Las sesiones `mysql` de B terminaron solas (`SLEEP(8)`).
- **Archivos:** se borraron del scratchpad las sondas, la copia de mutaciones, los env, el hash, los logs y las cookies. Un script temporal de SD3 se ejecutó desde `api/` y se borró en el mismo comando. Un log de la `api` que acabó un momento en `api/` (por una ruta relativa) se movió y se borró. `git status` lo confirma (T4).
- **Repositorio:** `git worktree list` muestra solo `main` y el worktree del ticket.
- **MySQL:** `restaurante-mysql-dev-1` sigue encendido, y su base de desarrollo no se tocó.
- **Incidencia de entorno:** durante la preparación, un `pkill` con un patrón que no coincidía dejó la primera `api` en marcha mientras se recreaba su base. Eso dio dos ejecuciones de A3 contaminadas (y dos `server_listen_failed` en el log). Se detuvo esa `api` por su puerto y todo se repitió desde una base nueva. Los resultados de arriba son los de la ejecución limpia.

### Resultado final

QA_REJECTED

### Ronda 2

El usuario aprobó la implementación de la ronda 2 con "si". Se revalida sobre la misma rama, sin commit. Lo que cambió en la ronda 2:

- DEF-003: `writeDocument` comprueba el acceso antes de leer el id (`inventory-kardex-routes.ts`).
- DEF-004: `holdsStock` (`inventory-shared.ts`), usada por la ficha (`inventory-routes.ts`) y por el Kardex del artículo.
- Los comentarios del contrato (`packages/contracts/inventory.ts`).
- Dos pruebas existentes ampliadas en `admin-inventory-kardex-api.test.ts`.
- OBS-19 en `arquitectura.md` §6.

Ninguna prueba se escribió en el repositorio. MySQL 8.4 local, base `restaurante_test_qa051c_r2`, y la `api` del worktree con `env -i`, `TZ=Asia/Tokyo` y `BUSINESS_TIMEZONE=America/Mexico_City`.

#### Pruebas ejecutadas (ronda 2)

| ID | Acción | Resultado |
|---|---|---|
| S1 | `npm run build:css` y `npm run typecheck` | Código 0 y 0. PASS |
| S2 | `npm run lint` | Código 0, sin avisos; `check-private-data`: 898 archivos, sin datos privados. PASS |
| S3 | `npm test` | `api` 57/1281, `landing-pages` 65/917 e `inventory-manager` 18/297, todo en verde. Los totales no cambian porque se ampliaron casos existentes. Código 0. PASS |
| S4 | `admin-inventory-kardex-api.test.ts` | 8/8 en 1.03 s. PASS |
| N1 | DEF-003, sobre MySQL y HTTP real | `POST documentos/{abc,0,99999999999}/{devoluciones,reversion}` y la reversión de un documento existente: `[401, 403, 403]` en las 7 combinaciones (anónimo, Editor y Gerente sin CSRF). Códigos `FORBIDDEN_ROLE` y `CSRF_INVALID`. Checksums de documentos, movimientos, existencias y proveedores sin cambios. PASS |
| N1b | El Gerente con CSRF | Ids `abc`, `0`, `99999999999` y `999999` (inexistente) → 404 `DOCUMENT_NOT_FOUND` en la reversión. En `devoluciones`, con un id inexistente y `lines: []`, responde 422 `lines`: el cuerpo se valida antes de buscar el documento, igual que en la ronda 1 (sin cambio). Con un cuerpo válido, 404. PASS |
| N4 | DEF-004: ficha y Kardex del artículo | Padre, Compuesto y no inventariable → `stock: null` en los dos. Insumo `{9.000, 20.0000, 20.0000}` e Intermedio `{2.000, 5.0000, null}` conservan su stock. Reventa, variante e insumo inactivo sin movimientos → `{0.000, null, null}`. Contratos válidos en los 16 casos. Un insumo inactivo con existencias conserva su `stock` (1.000). Un no inventariable que pasa a inventariable (sin movimientos) vuelve a mostrar `{0.000, null, null}`. Existencias sigue sin el Compuesto ni el padre. PASS |
| R1 | Regresión de `writeDocument` (los 5 tipos de documento) | Compra 201 con `Location` y reenvío 200 `replayed`; saldo inicial 201; ajuste 201; devolución 201 con `sourceDocumentId` y reenvío 200; reversión 201. 409 `DOCUMENT_HAS_RETURNS` (con `returnIds`), `ALREADY_REVERSED`, `REVERSAL_NOT_REVERSIBLE` y `DOCUMENT_NOT_RETURNABLE`. 400 `INVALID_IDEMPOTENCY_KEY` y 422 `IDEMPOTENCY_KEY_REUSED`. Campo desconocido por línea → 422. PASS |
| H2 | `inventory-manager` del worktree contra esa `api` | Acceso 303. Las 8 fichas (insumo, intermedio, reventa, Compuesto, no inventariable, padre, variante e inactivo) y la lista: 200. 0 avisos o errores en su log. PASS |
| L1 | Log de la `api` | 0 nombres, cantidades ni costos (quitando `time`, `ip` y `durationMs`). 0 errores. PASS |
| M1 | Mutación: el id antes que el acceso (como antes de DEF-003) | La prueba permanente falla: "editor: 403 FORBIDDEN_ROLE…", "POST …/documentos/abc/devoluciones: expected 404 to be 403". PASS |
| M2 | Mutación: `holdsStock` solo excluye al padre (como antes de DEF-004) | La prueba permanente falla: "Taco ficticio: expected { quantity: '0.000', … } to be null". PASS |
| DOC | `arquitectura.md` §6 y comentarios del contrato | Coinciden con el comportamiento: patrón `IDEMPOTENCY_KEY_PATTERN` de 16 a 64 caracteres `[A-Za-z0-9_-]` (400 con "corta"), 422 `IDEMPOTENCY_KEY_REUSED` en T1, T2 y T3 (`inventory-shared.ts`, `product-routes.ts` y la ruta del Kardex), y `stock: null` en un padre, un Compuesto o un no inventariable (N4). Son 17 rutas, como se contó en la ronda 1. PASS |

En la sonda, dos comprobaciones dieron FAIL por un valor esperado mal calculado, no por la implementación:

- la existencia del insumo es 9.000, no 7.000, porque la reversión de la devolución devuelve los 2 kg;
- el 422 de `devoluciones` con un id inexistente y un cuerpo vacío (ver N1b).

#### Lo que no se repitió y por qué

La ronda 2 solo toca el orden de `writeDocument`, la regla de `stock` de dos lecturas, comentarios del contrato y documentación. Por eso no se repiten, con su resultado de la ronda 1 vigente:

- DEF-001 (D1–D4), concurrencia (C1–C3), sistema ocupado (B1–B2) y reinicio (H3): el core, el store y la idempotencia no cambian, y el flujo de escritura después del acceso es el mismo (R1).
- Semilla (SD1–SD5) y K1: no cambian ni los scripts ni el Dockerfile.
- Cliente HTTP (CL1): `admin-client.ts` no cambia. Solo cambió un comentario del contrato, y el esquema de `stock` sigue siendo el mismo (nullable).
- Landings (R2): no consumen las rutas tocadas.
- Mutaciones X1–X6: no cambia el código que mutaban. Se añadieron M1 y M2 para lo nuevo.

#### Criterios de aceptación (ronda 2)

| CA | Resultado | Evidencia |
|---|---|---|
| CA-21 (permisos en la API) | PASS | N1, M1 y A1/A2 de la ronda 1 |
| RF-10 / RN-T3-1 (`stock` en la ficha y el Kardex) | PASS | N4, M2 y H2 |
| El resto del alcance del PR 2 | PASS (ronda 1, sin cambios en lo que comprueban) | Ver la tabla de la ronda 1 |

#### Defectos

- **DEF-003:** corregido y verificado (N1 y M1).
- **DEF-004:** corregido y verificado (N4 y M2).
- Sin defectos nuevos.

#### Observaciones

OBS-13 a OBS-18 siguen registradas para el PR 3 o el cierre. OBS-19 queda resuelta (DOC).

#### Limpieza (ronda 2)

- **Base:** se borró `restaurante_test_qa051c_r2`. `SHOW DATABASES LIKE 'restaurante\_test%'` devuelve 0.
- **Procesos:** se detuvieron la `api` (3201/3204) y el `inventory-manager` (3203). Los puertos 3200 a 3209 están libres, y no queda ningún proceso de `src/server.ts` ni de Vitest.
- **Archivos:** se borraron del scratchpad las sondas, la copia de mutaciones, los logs y las cookies. Quedan `src050` y `t3`, que no son de este QA y no se tocaron.
- **Imagen:** no se construyó ninguna; 0 imágenes `qa051c`.
- **Repositorio:** `git status` muestra los cambios del Implementation Result más `inventory-shared.ts`, de la ronda 2, y ninguna sonda. `git worktree list` muestra solo `main` y el worktree del ticket.
- **MySQL:** `restaurante-mysql-dev-1` sigue encendido, y su base de desarrollo no se tocó.

#### Resultado final (ronda 2)

QA_APPROVED

## Historial de cambios

### Versión 1

Descripción inicial (2026-11-25), refinada por business-analyst a partir del marco de REQ-F-049, de REQ-F-050 y de REQ-F-054. El usuario la aprobó con "Si lo apruebo", con PV-T3-1 a PV-T3-13 y P-1 a P-3 tal como se recomendaron.

### Revisión técnica (T1)

- 2026-11-25, senior-fullstack: revisión contra el código de `epic/inventario` (`ad50c50`) y Technical Action Plan, con 3 PR hacia la épica, la migración `inventario_kardex`, el dominio, la concurrencia, la API, las pantallas, `inventory:verify`, los respaldos, el CI, la documentación y los trabajos de arrastre.
  - Decididas por senior-fullstack (delegadas): DT-T3-1 (tipos en `VARCHAR` con lista cerrada en core) y DT-T3-2 (una fila de existencia por artículo que no es padre, con creación defensiva).
  - PV-T3-12 (b) se queda en T3: no exige cambio de modelo.
  - Para el usuario: DT-T3-3 a DT-T3-9, con recomendación.
  - Estado: `NEEDS_TECHNICAL_PLAN_APPROVAL`.

### Implementación (T2)

- 2026-11-25, senior-fullstack: plan aprobado por el usuario ("Sí, apruebo el plan con A en DT-T3-6"). Ticket movido a `in-progress/` en `feature/REQ-F-051-kardex-modelo`. El PR 1 se parte en 1a y 1b por tamaño. El PR 1a queda implementado y validado (`typecheck`, `lint`, `test` y `build:css` en verde), sin commit. Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

### QA (Q1, PR 1a)

- 2026-11-25, senior-qa: implementación del PR 1a aprobada por el usuario ("Sí, apruebo la implementación"). QA Action Plan del PR 1a redactado a partir del ticket, del diff de la rama (sin commit) y de las reglas del proyecto, sin ejecutar ninguna prueba. Tres decisiones para la aprobación: CA-24 con código fuente, el usuario temporal de M6 y la sonda de lint de L2. Estado: `NEEDS_QA_PLAN_APPROVAL`.

### QA (Q2, PR 1a, ronda 1)

- 2026-11-25, senior-qa: el usuario aprobó el plan ("Sí, apruebo el plan de QA con las tres respuestas"). Ejecutado completo: S1 a S6, M1 a M6, D1 a D6, N1 a N3, C1 a C6, V1 a V7, L1 a L4, X1 a X5, R1 a R4 y A1 a A3. Sin defectos; 4 observaciones. Limpieza comprobada. Estado: `QA_APPROVED`.

### Commit y PR (T4, PR 1a)

- 2026-11-25, senior-fullstack: commit `1fb5a02` y PR #195 en borrador hacia `epic/inventario`. Observaciones OBS-1 a OBS-4 del QA registradas como pendientes del 1b, el 2 y el 3.
- 2026-11-25, senior-fullstack: el PR #195 pasa a listo. Su CI (ejecución 45736787294) dejó `calidad`, `docker`, `auditoria` y `pruebas` en `pass`. Estado: `READY_FOR_MERGE`.

### Implementación del PR 1b (T2)

- 2026-11-25, senior-fullstack: el PR 1b queda implementado y validado en `feature/REQ-F-051-kardex-dominio`, desde `27c7a25`, con `typecheck`, `lint`, `test` y `build:css` en verde. Está sin commit. Pasa de unas 1 500 líneas, así que se pide decidir la partición. Estado: `NEEDS_TECHNICAL_CLARIFICATION`.
- 2026-11-25, senior-fullstack: el usuario decidió con "Si" mantener el PR 1b como un solo PR y confirmó RN-T3-12 (el CPP no baja de 0), RN-T3-13 (la reversión toma la fecha del día en que se registra) y RN-T3-14 (la devolución se captura en la unidad base). Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

### QA (Q1, PR 1b)

- 2026-11-25, senior-qa: el usuario aprobó la implementación del PR 1b ("Si"). QA Action Plan del PR 1b redactado a partir del ticket, del diff del worktree (sin commit, sobre `27c7a25`) y de las reglas del proyecto, sin ejecutar ninguna prueba. Incluye los cálculos de CA-1 a CA-7, CA-16, CA-18, CA-29, CA-30 y RN-T3-12 verificados a mano (19.99995 → 20.0000) y dos riesgos de desbordamiento de DECIMAL en MySQL que no ven las pruebas en memoria (R-1). Cuatro decisiones para la aprobación: el usuario de solo lectura de K8, la imagen de K9, CA-24 con el código fuente y sin `ad50c50`, y las sondas en el scratchpad. Estado: `NEEDS_QA_PLAN_APPROVAL`.

### QA (Q2, PR 1b, ronda 1)

- 2026-11-26, senior-qa: el usuario aprobó el plan con "Si" y las cuatro respuestas recomendadas. Ejecutado completo: S1 a S7, F1 a F14, N1 a N5, C1 a C10, B1 a B3, K1 a K9, I1 a I2, RB1 a RB3, V1 a V6, H1, P1, X1 a X11 y T1 a T4. Todos los criterios del 1b pasan, también CA-14, CA-23 y CA-24 por sonda. Hay 2 defectos que no bloquean: DEF-001 (`MINOR`, desbordamiento de DECIMAL en MySQL con valores irreales) y DEF-002 (`TRIVIAL`, una frase de `arquitectura.md`). Quedan 8 observaciones. Limpieza comprobada. Estado: `QA_APPROVED`.

### Commit y PR (T4, PR 1b)

- 2026-11-26, senior-fullstack: DEF-002 corregido en `arquitectura.md`. DEF-001 y OBS-5 a OBS-12 quedan anotados en "Pendientes del PR 1b para los PR 2 y 3". Commit `8f8c128` y PR #196 en borrador hacia `epic/inventario`.
- 2026-11-26, senior-fullstack: el PR #196 pasa a listo. Su CI (ejecución 45784137262) dejó `calidad`, `docker`, `auditoria` y `pruebas` en `pass`. Estado: `READY_FOR_MERGE`.

### Implementación del PR 2 (T2)

- 2026-11-26, senior-fullstack: PR 2 implementado en `feature/REQ-F-051-kardex-api`, desde `851ec79`. Incluye la API, los contratos, el cliente, la semilla, DEF-001, OBS-6, OBS-7 y OBS-8. Validado (`typecheck`, `lint`, `test` y `build:css` en verde), sin commit. Añade 1 445 líneas, así que no se parte. Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

### QA (Q1, PR 2)

- 2026-11-26, senior-qa: el usuario aprobó la implementación del PR 2 ("si"). QA Action Plan del PR 2 redactado a partir del ticket, del diff del worktree (sin commit, sobre `851ec79`) y de las reglas del proyecto, sin ejecutar ninguna prueba. Incluye los valores esperados de la semilla calculados a mano y dos riesgos vistos en el código: el orden 404 antes que 401/403 en `devoluciones` y `reversion` con un id no numérico (R-1), y `stock` no nulo en la ficha de un Compuesto o un no inventariable (R-2). Cinco decisiones para la aprobación. Estado: `NEEDS_QA_PLAN_APPROVAL`.

### QA (Q2, PR 2, ronda 1)

- 2026-11-26, senior-qa: el usuario aprobó el plan con "Sí, apruebo el plan con las cinco recomendaciones". Ejecutado completo: S1 a S6, A1 a A9, N1 a N5, D1 a D4, C1 a C3, B1 a B2, H1 a H3, R2, L1 a L2, SD1 a SD5, K1, CL1 a CL2, X1 a X6, DOC y T1 a T4. DEF-001 y OBS-6 a OBS-8 quedan resueltos, y las 13 mutaciones las detectan las pruebas permanentes. Se confirman R-1 (DEF-003, `MINOR`, CA-21) y R-2 (DEF-004, `MINOR`, RF-10). El usuario había decidido de antemano que, si se confirmaban, se corregirían en este PR. Quedan 7 observaciones (OBS-13 a OBS-19). Limpieza comprobada. Estado: `QA_REJECTED`.
- 2026-11-26, senior-fullstack (ronda 2 del PR 2): DEF-003 (acceso antes que el id en devoluciones y reversión) y DEF-004 (`stock: null` en Compuestos y no inventariables) corregidos, con sus pruebas en los archivos existentes. OBS-19 documentada. OBS-13 a OBS-18 quedan registradas. Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

### QA (Q2, PR 2, ronda 2)

- 2026-11-26, senior-qa: el usuario aprobó la implementación de la ronda 2 ("si"). Revalidación selectiva: S1 a S4, N1, N1b, N4, R1 (regresión de los 5 tipos de documento), H2, L1, M1, M2 y la documentación. DEF-003 y DEF-004 quedan verificados, y OBS-19 resuelta. Lo no repetido está justificado en el QA Report. Limpieza comprobada. Estado: `QA_APPROVED`.
