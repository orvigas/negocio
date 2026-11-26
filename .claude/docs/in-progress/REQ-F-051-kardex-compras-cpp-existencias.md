# REQ-F-051 — T3: Kardex, saldo inicial, proveedores, compras con CPP y existencias valorizadas

## Estado

QA_APPROVED

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
