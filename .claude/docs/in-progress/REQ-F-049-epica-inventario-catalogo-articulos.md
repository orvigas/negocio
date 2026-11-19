# REQ-F-049 — Épica de inventario (marco) y T1: catálogo de artículos, variantes y unidades

## Estado

READY_FOR_MERGE

PR 3 de T1: commit `784cada` en `feature/REQ-F-049-pantallas` y PR #183 (https://github.com/orvigas/negocio/pull/183) hacia `epic/inventario` (no se despliega). CI del PR: `calidad`, `docker`, `auditoria` y `pruebas` en pass. Siguiente paso: el usuario revisa y hace merge del PR #183. DEF-003, DEF-004 y DEF-005: corregidos y verificados. `.claude/CLAUDE.md` §8 actualizado (edición autorizada). Con este PR, T1 queda completo: PR 0 #180, PR 1 #181, PR 2 #182 y PR 3 #183. Lo siguiente es T2 (REQ-F-050, recetas), que se refina con el business-analyst; según la hoja de ruta, la épica de ventas va tras T3, y T4 y T5 después.

QA del PR 3 aprobado en la ronda 2 (ver "QA Report — PR 3", "Ronda 2"): DEF-003, DEF-004 y DEF-005 corregidos y verificados (X4a y X4b ahora se detectan). Siguiente paso: senior-fullstack hace el commit (con la edición autorizada de `.claude/CLAUDE.md` §8) y el PR hacia `epic/inventario`.

PR 3 de T1 (pantallas de inventario, redirección del gerente, semilla de desarrollo y documentación) implementado en `feature/REQ-F-049-pantallas`, desde `origin/epic/inventario` (`077dcf6`), sin commit (ver "Implementation Result — PR 3"). Implementación aprobada por el usuario ("Apruebo y autorizo", que también autoriza a senior-fullstack a editar `.claude/CLAUDE.md` §8 en el commit). QA ronda 1 (ver "QA Report — PR 3"): CA-1 a CA-17 en PASS. Pendiente la decisión del usuario sobre DEF-003 (`MAJOR` de cobertura: mutación X4a no detectada), DEF-004 (`MINOR` de cobertura) y DEF-005 (`MINOR` documental). PR 2 mergeado en `epic/inventario` (#182).

PR 2 de T1 (rol Gerente, API del inventario y opción Gerente en usuarios): commit `6d1e355` en `feature/REQ-F-049-gerente-api` y PR #182 (https://github.com/orvigas/negocio/pull/182) hacia `epic/inventario` (no se despliega). QA aprobado en la ronda 2 (ver "QA Report — PR 2"). DEF-002 corregido con un caso nuevo de MySQL en `user-repository.test.ts` y verificado (X3a detectada). Pasan al PR 3: el doble de usuarios de `inventory-manager` con el rol, la redirección del gerente y el procedimiento de DT-2 en `despliegue.md` §6. Siguiente paso: el usuario revisa y hace merge del PR #182.

T1 se implementa en el PR 0 (`ci.yml` y `git.md`, hacia `main`) y después en tres PR hacia `epic/inventario` (DT-1). PR 0 mergeado (#180). PR 1 (modelo, migración, dominio y persistencia) mergeado en `epic/inventario` (#181, merge `84f0a9a`).

Las decisiones técnicas DT-5 a DT-15 del plan técnico de T2 a T5 y las respuestas recomendadas a P-1 a P-8 están aprobadas (ver "Aprobación" y "Plan técnico de T2 a T5").

## Aprobación

Aprobado por el usuario (versión 1, fecha 2026-11-18).

- Technical Action Plan (versión 2, 2026-11-18): "si lo apruebo" (en respuesta a "¿Apruebas el plan técnico con mis cuatro recomendaciones, incluida la edición de git.md y, si quieres, de CLAUDE.md §8?"). Decisiones:
  - **DT-1:** PR 0 de `ci.yml` hacia `main`, y T1 en tres PR hacia `epic/inventario`:
    - PR 1: modelo, migración, dominio y persistencia;
    - PR 2: rol Gerente, API y pantalla de usuarios;
    - PR 3: pantallas, semilla de desarrollo y documentación.
  - **DT-2:** procedimiento documentado en `despliegue.md` para la vuelta atrás a mano con gerentes (degradarlos a editor sin negocios y anotar quiénes eran), sin cambio previo en la `api`.
  - **DT-3:** SKU editable, con un registro de todos los SKU asignados alguna vez.
  - **DT-4:** autorizados el PR 0 de `ci.yml` hacia `main` y la actualización de `.claude/rules/git.md` redactada en el plan. La edición de `.claude/CLAUDE.md` §8 **no** está autorizada: se propondrá en el PR 3.

- Decisiones bloqueantes (respuestas literales del selector): ventas = "Inventario sin ventas por ahora (Recomendado)"; catálogo = "Uno aparte (Recomendado)"; negocios = "Compartidos"; rama = "Sí, rama intermedia (Recomendado)".
- Validación del requisito completo, con las 14 propuestas PV-1 a PV-14 tal como se presentaron: "si lo valido" (en respuesta a "Dime si validas el requisito con las 14 propuestas tal cual, o cuáles corriges").
- Hoja de ruta de cuatro épicas y orden nuevo (versión 5, 2026-11-18), tras entregar el requerimiento completo (Anexo A): "A tu recomendación y ajustar lo necesario ya que estamos en una etapa temprana" (camino A: T1 a T3; después la épica de Ventas; después T4 y T5; luego Costos y rentabilidad, y Finanzas y administración).

Este documento contiene el **marco de la épica** (reglas comunes, glosario, partición y decisiones) y el **detalle del ticket T1**. Los tickets T2 a T5 se crearán como REQ-F-050 a REQ-F-053 cuando se refinen con el usuario.

---

# Parte A — Marco de la épica

- Plan técnico completo de T2 a T5 (versión 6): "apruebo las recomedaciones" (cita textual). Quedan aprobadas:
  - **DT-1** (partición de T2 a T5: 3 PR por T2, T3 y T4; 2 en T5) y **DT-5 a DT-15** con la recomendación de la tabla de la sección 7 del plan.
  - Respuestas recomendadas a las preguntas abiertas:
    - **P-1:** los platillos (compuestos) no tienen existencias; solo receta y costo.
    - **P-2:** el rendimiento de la receta va siempre en la unidad base del artículo.
    - **P-3:** un platillo no es ingrediente de otro en esta épica.
    - **P-4:** se pueden comprar intermedios (además de insumos y reventa).
    - **P-5:** listas de motivos de merma, consumo interno y ajuste aprobadas tal como se propusieron (sección 2.3 del plan).
    - **P-6:** alertas solo en pantalla.
    - **P-7:** evolución de precios en tabla.
    - **P-8:** Cocina no captura conteos (son del gerente).
- DEF-001 (`MINOR`, QA del PR 1) aceptado sin cambios, con la aprobación de la implementación y del plan de QA por el usuario.

## Decisiones del usuario

### Decisiones bloqueantes

- **D-1 (ventas):** "Inventario sin ventas por ahora (Recomendado)". La épica no incluye POS, registro de ventas ni descuento de insumos por venta; las ventas serán una épica posterior.
- **D-2 (catálogo):** "Uno aparte (Recomendado)". Los artículos de inventario son un catálogo nuevo. El menú público (`Product`, `ProductVariant`), los datos de página, las landings y el bot **no cambian**.
- **D-3 (negocios):** "Compartidos". Molotes y Birria comparten cocina y almacén: un solo catálogo y una sola existencia por artículo, sin separación por negocio. Cuando existan ventas, los reportes serán consolidados con desglose por negocio.
- **D-4 (rama intermedia):** "Sí, rama intermedia (Recomendado)". Es la decisión expresa del usuario prevista en `.claude/rules/git.md`:
  - Nombre: **`epic/inventario`**, creada desde `main` justo antes del primer PR de T1.
  - Los PR de los tickets de la épica van a `epic/inventario` (no a `main`).
  - La rama se lleva a `main` con un PR cuando T1 a T3 sean utilizables.
  - Después de ese merge aplica PV-12.

### Decisiones validadas ("si lo valido")

| # | Decisión | Motivo |
| --- | --- | --- |
| PV-1 (roles) | **Gerente** se añade en T1. **Cocina/Producción** en T4. **Cajero** con la épica de ventas. **Editor** sin acceso al inventario. **Administrador**, todo. | Un rol sin pantallas no aporta, y cada rol toca contratos, sesión y la pantalla de usuarios (REQ-F-040). |
| PV-2 (saldos negativos) | Una salida sin existencia suficiente **se permite**: deja el saldo negativo, genera alerta y el artículo aparece en críticos. Nunca se pierde un movimiento por concurrencia. Aplica desde T3. | La operación no debe bloquearse por el registro; bloquear lleva a no registrar los consumos reales. |
| PV-3 (cotizador) | El cotizador (REQ-F-046) sigue con su JSON. Su conexión con los costos reales será un ticket posterior. | Sus valores son provisionales y ya funciona; conectarlo amplía el alcance. |
| PV-4 (fuera de alcance) | La lista de "Fuera de alcance" de este documento. | El requisito no lo pide y cada punto es un proyecto propio. |
| PV-5 (datos reales) | El usuario entrega en una hoja los insumos, recetas, costos y existencias iniciales. Las semillas de desarrollo y pruebas son ficticias. Producción arranca con el inventario vacío y los datos se capturan en pantalla. El arranque se registra como movimiento de "saldo inicial" (T3). | Los costos reales no deben estar en el repositorio. |
| PV-6 (IVA) | El costo de compra es lo realmente pagado, con IVA, salvo que el negocio acredite el IVA. **Aviso dado al validar:** conviene confirmarlo con su contador. **Requisito derivado:** el modelo debe permitir cambiar este criterio en una revisión posterior sin reescribir la historia. Cada compra conserva el costo con el que se registró, y un cambio de criterio solo afecta a los movimientos posteriores. | Afecta al CPP y al costo de las recetas. |
| PV-7 (conservación) | Movimientos, compras y versiones de receta se conservan indefinidamente. Del proveedor solo se guardan el nombre comercial y un contacto mínimo. | Trazabilidad y minimización de datos personales. |
| PV-8 (diseño) | Se reutiliza el sistema visual del admin (Decisión B de `restaurante/docs/arquitectura.md`). Stitch solo para pantallas complejas (el editor de recetas de T2), con aprobación previa del usuario (`.claude/rules/stitch-diseno.md`). | No hay diseño en `_stich_source_/` para el admin y el diseño de interfaces está aparcado. |
| PV-9 (tickets) | REQ-F-049 contiene el marco y T1. T2 a T5 son REQ-F-050 a REQ-F-053, y cada uno se refina con el usuario cuando le toque. | Cada ticket pasa su propia revisión técnica, implementación y QA, y queda revisable. |
| PV-10 (precio de venta) | Los artículos de inventario **no** llevan precio de venta en esta épica. El precio sigue en el menú y se vinculará en la épica de ventas. **Revisable (v5):** vigente por ahora; se revisa al refinar E2, porque el requerimiento original (Anexo A) lista "precio de venta" entre los datos del producto. Se resolverá enlazando el artículo con el precio del menú. | Evita tener el precio en dos fuentes sin ventas que lo usen. |
| PV-11 (estado y baja) | "Dar de baja" es pasar a **Inactivo**, y es reversible. No hay un tercer estado "eliminado". | Unifica el estado ACTIVE/INACTIVE con el borrado lógico y evita una diferencia ambigua. |
| PV-12 (T4 y T5) | Tras llevar `epic/inventario` a `main`, T4 y T5 van directo a `main` y la rama se borra. Sigue vigente (v5), con la épica de Ventas (E2) entre T3 y T4. | Para entonces el modelo ya es estable y T4 y T5 son aditivos. |
| PV-13 (precisión) | Cantidades con 3 decimales en la unidad base. Costos unitarios con 4 decimales en MXN. Importes mostrados redondeados a 2 decimales. Nunca coma flotante. Los tipos exactos los confirma senior-fullstack. | Un costo por gramo necesita más de 2 decimales. |
| PV-14 (SKU) | El SKU o código de barras es opcional. Si se informa, es único entre todos los artículos (activos e inactivos) y no se reutiliza. | Evita confusiones en la historia; mismo criterio que el slug de productos. |

## Objetivo

Dar al negocio un inventario único de su cocina y almacén, compartido por Molotes y Birria El Muñeco, que incluya:

- el catálogo de artículos y sus unidades;
- recetas multinivel con merma y versiones;
- un Kardex inmutable con compras y Costo Promedio Ponderado (CPP);
- producción por lotes, mermas, consumo interno y conteos físicos;
- reportes de inventario.

Con ello el negocio conoce el costo real de cada platillo, el valor de lo que tiene y qué debe comprar, todo sin registrar ventas.

## Contexto verificado en el repositorio

- **No se persiste ninguna venta ni pedido.** El bot arma el pedido y avisa al personal; los pedidos no se guardan (`restaurante/docs/arquitectura.md` §1). No existen POS, caja ni cortes.
- **El menú público es de presentación y de un solo negocio:** `Product` con `priceCents Int`, `ProductVariant` solo para Birria, baja lógica y control de versión. Por D-2 no se toca.
- **Hay dos roles, `admin` y `editor`.** El editor está limitado a los negocios que tiene asignados (`packages/core/identity/authorization.ts`).
- **El cotizador (REQ-F-046) define insumos, recetas y merma en un JSON, sin persistencia.** Su regla RN-1 de merma es la misma que RN-6 de esta épica.
- **`arquitectura.md` §8, paso 5,** ya prevé "Dominios nuevos, un ticket por módulo: inventario → ventas (incluidos los pedidos del bot) → CRM". Esta épica es el módulo de inventario.

## Alcance de la épica (T1 a T5)

- **T1 (REQ-F-049, este ticket):** catálogo de artículos (cuatro tipos), categorías, variantes o sabores, unidades y conversiones, estado, historial de cambios y rol Gerente.
- **T2 (REQ-F-050, por crear):** recetas multinivel con validación de ciclos, merma y rendimiento por ingrediente, versiones con vigencia y costo teórico.
- **T3 (REQ-F-051, por crear):** Kardex, saldo inicial, proveedores, compras con CPP y último costo, consulta del Kardex, y respaldo y restauración de las tablas nuevas.
- **T4 (REQ-F-052, por crear; se hace después de E2):** producción por lotes, mermas, consumo interno, conteos físicos con ajuste justificado, stock mínimo y punto de reorden con alertas, y rol Cocina/Producción.
- **T5 (REQ-F-053, por crear; después de T4):** reportes de inventario que no dependen de ventas:
  - Kardex filtrable;
  - valorización, actual y a una fecha;
  - stock crítico;
  - historial de compras y evolución de precios;
  - **mermas y desperdicios** (v5): cantidad y valor por artículo, motivo, usuario y periodo;
  - **consumo de insumos críticos** (v5): salidas por periodo de los insumos marcados como críticos (p. ej. carne, queso, aceite, gas y masa);
  - **costeo de recetas estándar o escandallos** (v5): costo por porción de cada platillo según la versión vigente o la de una fecha.

  Criterios de aceptación de T5 (a detallar en REQ-F-053): cada reporte filtra por rango de fechas en `BUSINESS_TIMEZONE`, sus totales cuadran con el Kardex del periodo, el escandallo usa la versión de receta vigente en la fecha consultada y el CPP de esa fecha, y ninguno requiere ventas registradas.

## Hoja de ruta: cuatro épicas encadenadas (v5, decisión del usuario)

| Épica | Tickets | Contenido | Cuándo |
| --- | --- | --- | --- |
| **E1 — Inventario** | REQ-F-049 a REQ-F-053 | T1, T2, T3 → [E2] → T4, T5 | En curso |
| **E2 — Ventas** | REQ-F-054 y siguientes | Registro de ventas o POS en el admin (o captura); descuento de insumos por receta al vender, con explosión al vuelo; modificadores fijos, removibles y extras; cancelaciones con reintegro frente a merma; cortesías; formas de pago (efectivo, tarjeta, transferencia y apps de reparto); comisiones de plataformas; rol Cajero; enlace producto del menú ↔ receta o artículo (revisa PV-10). Reportes: corte de caja Zeta con cuadre del fondo de caja, mix de ventas, ventas por horario y día, cancelaciones y cortesías, y comisiones de delivery. | **No se empieza hasta que T1 a T3 estén utilizables.** Se refina con el business-analyst después de T3. |
| **E3 — Costos y rentabilidad** | Por asignar | Escandallos por porción frente al precio de venta, Food Cost, ingeniería de menú e inventario teórico contra físico. | Después de T5 |
| **E4 — Finanzas y administración** | Por asignar | Gastos operativos, estado de resultados, flujo de efectivo, cuentas por pagar, nómina y costo laboral. Reporte fiscal y de facturación **solo como estructura pendiente**: el negocio aún no está dado de alta ante el SAT; la facturación y los impuestos reales siguen fuera de alcance. | Después de E3 |

Cada épica posterior tiene sus propias decisiones pendientes (rama intermedia, POS frente a pedidos del bot, persistencia de esos pedidos, roles, etc.), que se toman con el usuario cuando se refine. Nada de E2 a E4 está aprobado en su detalle.

## Cobertura del requerimiento original (Anexo A)

| Requisito o reporte | Épica | Ticket |
| --- | --- | --- |
| Catálogo: nombre, descripción, id único, unidad, costo de adquisición | E1 | T1 (costo: T3) |
| Precio de venta del producto | E2 | Enlace con el menú (PV-10 revisable) |
| Ingredientes anidados (tortilla en pza hecha de masa en g). La "referencia circular" descrita es una **receta anidada**, soportada; lo que se rechaza es un **ciclo real** (RN-5) | E1 | T2 |
| Unidades de compra y consumo (masa por kg, agua en L, sal en g) | E1 | T1 |
| Sabores y versiones (refrescos, aguas frescas) | E1 | T1 (variantes) |
| Recetas libres, editables y versionadas | E1 | T2 |
| Actualizar y dar de baja sin afectar el historial | E1 | T1 (PV-11, RN-2) |
| Descuento de insumos al vender | E2 | REQ-F-054+ |
| Movimientos históricos de inventario | E1 | T3 (Kardex), T5 (reporte) |
| Compras y proveedores, variación de precios | E1 | T3, T5 |
| Cuentas por pagar | E4 | Por asignar |
| Mermas y desperdicios | E1 | T4 (registro), T5 (reporte) |
| Consumo de insumos críticos | E1 | T5 |
| Escandallos (costo por porción) | E1 / E3 | T5 (costo); E3 (frente al precio) |
| Inventario físico vs. teórico | E3 | Necesita ventas (conteos en T4) |
| Corte de caja Zeta | E2 | REQ-F-054+ |
| Mix de ventas | E2 | REQ-F-054+ |
| Ventas por horario y día | E2 | REQ-F-054+ |
| Cancelaciones y cortesías | E2 | REQ-F-054+ |
| Comisiones de delivery | E2 | REQ-F-054+ |
| Reportes de ventas | E2 | REQ-F-054+ |
| Food Cost | E3 | Por asignar |
| Ingeniería de menú | E3 | Por asignar |
| Estado de resultados | E4 | Por asignar |
| Flujo de efectivo | E4 | Por asignar |
| Nómina y costo laboral | E4 | Por asignar |
| Fiscal y facturación (solo estructura) | E4 | Por asignar |

## Fuera de alcance de E1 (PV-4)

Ventas, costos y rentabilidad, y finanzas no quedan fuera para siempre: son las épicas E2 a E4 de la hoja de ruta.

- **E2 — Ventas (posterior):** POS o registro de ventas, persistencia de los pedidos del bot, descuento de insumos por venta y explosión al vuelo, modificadores, cancelaciones y cortesías, corte de caja (Zeta), mix de ventas, ventas por horario, comisiones de plataformas, utilidad bruta (COGS) y rol Cajero.
- **E3 y E4 (posteriores):** Food Cost, ingeniería de menú, inventario teórico contra físico, gastos, estado de resultados, flujo de efectivo, cuentas por pagar y nómina.
- Facturación electrónica (CFDI), impuestos y contabilidad reales (E4 solo dejará la estructura).
- Varias monedas: solo MXN.
- Lotes y caducidad por lote. La caducidad solo existe como motivo de merma.
- Escáner de códigos de barras (el campo SKU sí entra).
- Impresión de comandas.
- Integración con apps de reparto.
- Migración de historia (no existe).
- Funcionamiento sin conexión.
- Conexión del cotizador con el inventario (PV-3).
- Cambios en el menú público, los datos de página, las landings o el bot (D-2).
- Existencias separadas por negocio (D-3).

## Actores

- **Administrador:** todo.
- **Gerente (desde T1):** catálogo y recetas; desde T3, también compras, ajustes, conteos y reportes.
- **Cocina/Producción (desde T4):** lotes, mermas y consumo interno; consulta de existencias.
- **Editor:** sin acceso al inventario.

## Glosario

- **Artículo:** todo lo que se almacena o se cuenta en el inventario.
- **Tipos de artículo:**
  - **Insumo:** se compra (masa de maíz, carne cruda, sal, jitomate).
  - **Intermedio:** se produce con una receta y se almacena (tortilla, consomé, salsa, carne adobada).
  - **Compuesto:** platillo con receta (taco de birria, quesabirria, molote).
  - **Reventa:** se compra y se vende tal cual (refresco embotellado).
- **Artículo padre:** agrupa variantes o sabores (Refresco 600 ml). No tiene existencias ni receta propias.
- **Variante:** artículo hijo de un padre (Coca-Cola, Mundet), con existencias, unidades y receta propias.
- **Unidad base:** la unidad en que se guardan las existencias y los movimientos del artículo (kg, L o pza).
- **Unidad de compra o de empaque:** presentación propia del artículo, con un factor hacia su unidad base (caja = 24 pza; bulto = 25 kg).
- **Unidad de consumo:** la que usa una receta (g, ml o pza).
- **Magnitud:** masa, volumen o pieza.
- **Merma o rendimiento:** porcentaje que se pierde al limpiar o cocer. Cantidad bruta = cantidad neta / (1 − merma).
- **Versión de receta:** lista inmutable de ingredientes, con inicio (`valid_from`) y fin (`valid_to`) de vigencia.
- **Kardex:** registro cronológico e inmutable de movimientos.
- **CPP:** Costo Promedio Ponderado.
- **Punto de reorden:** existencia a la que el artículo pasa a ser crítico.

## Reglas de negocio comunes

- **RN-1. Tipos de artículo.** Hay cuatro tipos: Insumo, Intermedio, Compuesto y Reventa. Un artículo padre solo agrupa variantes.
- **RN-2. Nada se borra físicamente.** Ningún artículo, variante, versión de receta ni movimiento se borra físicamente. Dar de baja es pasar a Inactivo (PV-11). Un artículo inactivo no se ofrece para recetas ni movimientos nuevos, pero sigue visible en la historia.
- **RN-3. Unidades y conversiones.**
  - Cada artículo tiene una sola unidad base.
  - Entre unidades de la misma magnitud se convierte con factores fijos (1 kg = 1 000 g; 1 L = 1 000 ml).
  - Entre magnitudes distintas o presentaciones (caja → pza, pza → kg) solo se convierte con un factor de empaque propio del artículo.
  - Una conversión sin factor se rechaza.
- **RN-4. Unidad base y factores bloqueados por el uso.** No se pueden cambiar una vez que el artículo aparece en una receta o en un movimiento. Para cambiarlos, se inactiva el artículo y se crea otro.
- **RN-5. Sin ciclos (T2).** Una receta no puede contenerse a sí misma, ni directa ni indirectamente.
- **RN-6. Merma (T2).** Cantidad bruta = neta / (1 − merma), con la merma en [0 %, 100 %). Es la misma regla que REQ-F-046 RN-1.
- **RN-7. Versiones de receta (T2).** Cambiar una receta crea una versión nueva, vigente desde ese momento. La anterior se cierra y es inmutable. En cada instante hay como máximo una versión vigente.
- **RN-8. Kardex (T3).** Solo admite altas; un error se corrige con un movimiento contrario. Cada movimiento guarda saldo anterior, cantidad, saldo nuevo, costo unitario, tipo, usuario, fecha y hora, y documento de referencia.
- **RN-9. CPP (T3).** CPP = (existencia × CPP + cantidad × costo) / (existencia + cantidad). Si la existencia previa es 0 o negativa, el CPP pasa a ser el costo de la compra. También se guarda el último costo. El criterio del costo de compra es el de PV-6.
- **RN-10. Lotes de producción (T4).** Un lote descuenta los insumos según la versión vigente de la receta y suma el intermedio. Se registra todo o nada.
- **RN-11. Motivos (T4).** Mermas, consumo interno y ajustes exigen un motivo de una lista cerrada y quedan con el usuario que los registró.
- **RN-12. Concurrencia.** Dos operaciones simultáneas sobre el mismo artículo nunca pierden un movimiento ni calculan mal el saldo. La política de negativos es la de PV-2.
- **RN-13. Fechas.** Fechas y rangos en `BUSINESS_TIMEZONE`.
- **RN-14. Precisión.** Cantidades y costos son decimales exactos (PV-13). Moneda: MXN.
- **RN-15. Sin negocio en el inventario.** Los artículos y las existencias no llevan negocio (D-3).
- **RN-16. Historial de cambios.** Cada cambio del catálogo y de las recetas queda registrado: quién, cuándo, y antes y después.

## Partición, orden y valor mínimo

| Orden | Ticket | Destino del PR | Valor |
| --- | --- | --- | --- |
| 1 | T1 — REQ-F-049 | `epic/inventario` | Catálogo con unidades y variantes |
| 2 | T2 — REQ-F-050 | `epic/inventario` | Recetas y costo teórico. Sin CPP, el costo se muestra como "sin costo" |
| 3 | T3 — REQ-F-051 | `epic/inventario` | Existencias valorizadas y CPP |
| — | Merge `epic/inventario` → `main` | `main` | **Valor mínimo en producción:** costo real de las recetas y existencias valorizadas |
| — | **E2 — Ventas** (REQ-F-054+) | Por decidir al refinarla | Ventas con descuento de insumos por receta |
| 4 | T4 — REQ-F-052 | `main` (PV-12) | Producción, mermas, conteos y alertas |
| 5 | T5 — REQ-F-053 | `main` (PV-12) | Reportes de inventario, incluidos mermas, insumos críticos y escandallos |

Como nada llega a producción antes del merge, el orden interno de T1 a T3 no afecta a los usuarios.

La épica de ventas (E2) se refina después de T3, en sus propios tickets, y se ejecuta antes de T4 (versión 5).

## Riesgos de la épica

- **Concurrencia y bloqueos con Prisma y MySQL.** Bloqueo por fila del saldo y espera de bloqueo de 10 s en producción (5 s en pruebas).
- **Pool de conexiones.** El pool de 5 conexiones (`restaurante/packages/db/src/client.ts`) se comparte con el bot y el admin.
- **Precisión.** Los nuevos decimales exactos conviven con `priceCents Int` del menú (PV-13).
- **Inmutabilidad.** El Kardex y las versiones de receta deben ser inmutables, en el dominio y, si es viable, también en la base.
- **Recetas.** Validación de ciclos y rendimiento del cálculo multinivel.
- **Migraciones.** Solo aditivas y compatibles con la vuelta atrás automática (`allowNewerSchema`), aplicadas solo por el servicio `migrate`. El usuario de la app solo tiene DML.
- **Respaldos.** Las tablas nuevas deben quedar en el respaldo, la restauración y `restaurante/docs/despliegue.md` (sección de respaldos).
- **Rama larga.** `epic/inventario` puede divergir de `main` mientras dure.
- **Diseño.** Las pantallas son nuevas y no tienen diseño fuente (PV-8).
- **Pruebas.** Solo quedan las funcionales permanentes, y ningún archivo de pruebas puede pasar de 20 s (`.claude/rules/testing.md`).
- **Memoria.** La del VPS no cambia, porque no hay contenedores nuevos.

## Dependencias de la épica

- REQ-F-039 (admin nuevo).
- REQ-F-040 (usuarios y roles).
- REQ-F-019 (respaldos).
- El servicio `migrate` y el despliegue.
- REQ-F-046 (regla de merma, por coherencia).
- Los datos reales que aporte el usuario (PV-5).

---

# Parte B — T1: catálogo de artículos, variantes y unidades

## Objetivo

Que el administrador y el gerente registren y mantengan todos los artículos del inventario con sus unidades y conversiones, como base de T2 a T5.

## Alcance

- RF-1 a RF-11.
- Creación de la rama `epic/inventario` (D-4).

## Fuera de alcance

- Todo lo de T2 a T5.
- La épica de ventas.
- El precio de venta (PV-10).
- Cambios en el menú, las landings, la página o el bot.

## Requisitos

- **RF-1. Lista de artículos.** En `inventory-manager`, sección "Inventario" → "Artículos".
  - Filtros: tipo, categoría, estado (por defecto, Activos) y búsqueda por nombre o SKU.
  - Columnas: nombre, tipo, categoría, unidad base, SKU, estado y número de variantes si es padre.
  - Si no hay resultados, un mensaje que lo explica.
- **RF-2. Alta y edición de un artículo.** Campos:
  - nombre (obligatorio; único entre los activos, sin distinguir mayúsculas);
  - descripción (opcional);
  - tipo (obligatorio; no se cambia después de crearlo, salvo justificación de senior-fullstack en su revisión técnica);
  - categoría (obligatoria);
  - SKU o código de barras (opcional; PV-14);
  - unidad base (obligatoria: kg, g, L, ml o pza; RN-4);
  - estado.

  No lleva precio de venta (PV-10). El último costo y el CPP se muestran solo como lectura, con "sin costo" hasta T3.
- **RF-3. Unidades de empaque del artículo.** Puede tener de 0 a N, cada una con nombre (caja, bulto, garrafón) y un factor positivo hacia la unidad base (caja = 24 pza). Se añaden, editan y quitan mientras lo permita RN-4.
- **RF-4. Conversión.** Una cantidad expresada en una unidad del sistema o de empaque del artículo se convierte a su unidad base (RN-3). En T1 se ve en la ficha como tabla de equivalencias; T2 y T3 usan la misma conversión para recetas y compras.
- **RF-5. Variantes.**
  - Un artículo padre (de tipo Reventa o Compuesto) agrupa variantes.
  - Cada variante es un artículo con nombre, SKU, unidad base, empaques y estado propios, y hereda la categoría y el tipo del padre.
  - El padre no tiene existencias.
  - Para inactivar el padre, no debe tener variantes activas, o se inactivan todas con confirmación. La forma concreta la decide senior-fullstack.
- **RF-6. Categorías.** Lista administrable: crear, renombrar e inactivar. No se puede inactivar una categoría que usan artículos activos.
- **RF-7. Baja e historial.** Inactivar y reactivar un artículo (PV-11). La ficha muestra el historial de cambios (RN-16).
- **RF-8. Concurrencia.** Si dos usuarios editan el mismo artículo, el segundo recibe un aviso de conflicto con los datos vigentes y no se pierde ningún cambio. Mismo patrón que en productos.
- **RF-9. Permisos.**
  - Administrador y Gerente (PV-1): lectura y escritura.
  - Editor y cualquier otro rol: no ven la sección en el menú, y las rutas de la API y del admin responden 403.
  - El rol Gerente se asigna desde la pantalla de usuarios existente. El Gerente no accede a usuarios, bot, cotizador, productos ni página.
- **RF-10. Semillas de desarrollo y pruebas.** No se cargan en producción (PV-5). Cubren:
  - insumos: masa de maíz (kg, bulto = 25 kg), carne de res cruda (kg), sal (kg), jitomate (kg), cebolla (kg) y queso (kg);
  - intermedios: tortilla (pza), consomé (L) y salsa (L);
  - compuestos: quesabirria, taco de birria y molote;
  - reventa: padre "Refresco 600 ml" con las variantes Coca-Cola y Mundet (pza, caja = 24), y padre "Agua fresca" con las variantes Horchata y Jamaica (L).
- **RF-11. Usabilidad.**
  - Pantallas responsivas (mobile-first) y accesibles con teclado, con foco visible.
  - Formularios con etiquetas y errores claros que no dependen solo del color.
  - Funcionan sin JavaScript (formularios SSR, como el resto del admin).

## Historias de usuario

- **HU-1.** Como gerente quiero dar de alta "Masa de maíz" en kg con la presentación "bulto = 25 kg", para capturar después las compras por bulto.
- **HU-2.** Como gerente quiero crear "Refresco 600 ml" con sus sabores, para controlar cada sabor por separado.
- **HU-3.** Como administrador quiero inactivar un artículo que ya no se usa, sin perder su historia.
- **HU-4.** Como editor no debo ver ni modificar el inventario.

## Criterios de aceptación

- **CA-1.** Given un gerente, When crea un insumo con los campos obligatorios válidos, Then aparece en la lista de activos y su historial registra "alta" con el nombre del usuario.
- **CA-2.** Given un artículo activo "Sal", When se crea otro "sal", Then se rechaza indicando el campo. Given "Sal" inactivo, When se crea "Sal", Then se acepta.
- **CA-3.** Given un SKU usado por cualquier artículo (activo o inactivo), When se repite, Then se rechaza.
- **CA-4.** Given "Refresco Coca-Cola" con unidad base pza y empaque "caja = 24", When se consultan sus equivalencias, Then 2 cajas = 48 pza.
- **CA-5.** Given "Masa de maíz" en kg, When se convierten 500 g, Then el resultado es 0.5 kg. Given el mismo artículo sin factor pza↔kg, When se intenta convertir pza a kg, Then se rechaza con un mensaje claro.
- **CA-6.** Given un factor de empaque 0, negativo o no numérico, When se guarda, Then se rechaza indicando el campo.
- **CA-7.** Given un padre con dos variantes, When se consulta, Then el padre no muestra existencias y cada variante tiene SKU, unidad base y estado propios.
- **CA-8.** Given un artículo inactivo, When se filtra por Activos, Then no aparece; When se filtra por Inactivos, Then aparece y se puede reactivar.
- **CA-9.** Given dos sesiones con la misma versión de un artículo, When ambas guardan, Then la segunda recibe un aviso de conflicto con los datos vigentes y el primer cambio se conserva.
- **CA-10.** Given un usuario Editor, When abre el admin, Then no ve "Inventario"; When pide directamente las rutas del inventario (del admin o de la API), Then recibe 403 y no se escribe nada.
- **CA-11.** Given un administrador, When crea un usuario con rol Gerente, Then ese usuario entra y accede al inventario, pero no a usuarios, bot, cotizador, productos ni página.
- **CA-12.** Given la base de desarrollo con las semillas, When se abre la lista, Then aparecen los artículos de RF-10 con sus tipos, unidades y variantes. Given una instalación nueva de producción, Then el inventario está vacío.
- **CA-13.** Given una categoría usada por artículos activos, When se intenta inactivarla, Then se rechaza indicando cuántos artículos la usan.
- **CA-14.** Given el menú público y el bot, When se despliega T1, Then las landings, `/api/v1/public/*`, el bot y las pantallas de productos y página se comportan igual que antes.
- **CA-15.** Given la imagen anterior y la base con la migración de T1, When ocurre una vuelta atrás, Then la app anterior arranca y funciona.
- **CA-16.** Given un respaldo hecho después de T1, When se restaura, Then se conservan los artículos, las unidades, las categorías y el historial.
- **CA-17.** Las pantallas de T1 se pueden usar a 360 px de ancho y en escritorio, solo con teclado, con foco visible y sin JavaScript.

## Casos límite

- Nombres con tildes, con espacios al inicio o al final, o con solo espacios: se recortan y se rechaza el nombre vacío.
- Factores muy grandes o con más decimales de los permitidos (PV-13).
- Variante de un padre inactivo.
- Reactivar un artículo cuyo nombre ya usa otro artículo activo: se rechaza con un mensaje.
- Un Gerente desactivado a mitad de sesión: su sesión se invalida, como hoy.
- Doble envío del formulario de alta: no crea duplicados.
- Botón atrás después de guardar.
- API caída: el admin muestra "no disponible" sin perder lo escrito, cuando sea posible.

## Trazabilidad

| Objetivo | Requisito | Historia | Criterios |
| --- | --- | --- | --- |
| Catálogo base | RF-1, RF-2, RF-6, RF-7 | HU-1, HU-3 | CA-1, CA-2, CA-3, CA-8, CA-13 |
| Unidades y conversiones | RF-3, RF-4 | HU-1 | CA-4, CA-5, CA-6 |
| Variantes | RF-5 | HU-2 | CA-7 |
| Integridad | RF-8, RN-2, RN-16 | HU-3 | CA-8, CA-9 |
| Acceso | RF-9, PV-1 | HU-4 | CA-10, CA-11 |
| Datos de prueba | RF-10, PV-5 | — | CA-12 |
| Sin regresiones y operación segura | D-2, riesgos | — | CA-14, CA-15, CA-16 |
| UX | RF-11, PV-8 | — | CA-17 |

Ninguna pantalla de T1 tiene diseño en `_stich_source_/`; aplica PV-8.

## Action Plan (T1)

### Objetivo

Un catálogo de artículos con unidades, conversiones, variantes, categorías, historial y permisos, utilizable en el admin.

### Alcance

RF-1 a RF-11 y la creación de la rama `epic/inventario`.

### Fuera de alcance

T2 a T5, la épica de ventas, el precio de venta y cualquier cambio en el menú, las landings, la página o el bot.

### Cambios requeridos

1. Crear `epic/inventario` desde `main` justo antes del primer PR de T1. El PR de T1 va a esa rama.
2. Modelo de datos aditivo: artículos, categorías, unidades de empaque, historial de cambios y rol Gerente.
3. Dominio en `core`: validaciones de RF-2, RF-3, RF-5 y RF-6, conversiones (RN-3) y autorización por rol.
4. Contratos y endpoints de administración del inventario en la `api`, con CSRF, idempotencia en el alta y conflicto de versión, siguiendo los patrones de productos.
5. Pantallas SSR en `inventory-manager` con el sistema visual del admin (PV-8).
6. Rol Gerente en el modelo de usuarios, los contratos y la pantalla de usuarios.
7. Semillas de desarrollo y pruebas (RF-10).
8. Documentación:
   - `restaurante/docs/arquitectura.md` §8, paso 5: la épica, la rama y la partición;
   - `restaurante/docs/despliegue.md`: las tablas nuevas en el respaldo y la restauración;
   - el README, si cambian la configuración o los comandos.

### Reglas de negocio

RN-1 a RN-4, RN-14 a RN-16, PV-10, PV-11, PV-13 y PV-14.

### UX/UI

- Lista con filtros.
- Ficha con datos, unidades, variantes e historial.
- Formularios accesibles.
- Mobile-first.
- Funciona sin JavaScript.

### Integraciones

Ninguna externa: `inventory-manager` → `api` → MySQL.

### Casos límite

Los de la sección "Casos límite" de la Parte B.

### Criterios de aceptación

CA-1 a CA-17.

### Dependencias

REQ-F-039, REQ-F-040, REQ-F-019 y el servicio `migrate`.

### Riesgos

- Una migración que no sea compatible hacia atrás.
- El impacto del rol nuevo en las sesiones y los permisos existentes.
- La precisión de los factores de conversión.
- La divergencia de la rama.

### Orden recomendado

1. Rama.
2. Modelo y migración.
3. Dominio y conversiones.
4. Rol y autorización.
5. API y contratos.
6. Pantallas.
7. Semillas.
8. Documentación.
9. Pruebas funcionales permanentes: conversiones, unicidad, permisos y conflicto.

### Resultado esperado

En `epic/inventario`, el administrador y el gerente gestionan el catálogo completo del inventario, con unidades y variantes, sin ningún cambio visible en las landings, el bot ni el menú. El catálogo queda listo para que T2 defina recetas sobre esos artículos.

## Technical Action Plan

Revisión técnica de senior-fullstack (2026-11-18), hecha sobre el código de `main` (`1f7005e`) con CodeGraph y lecturas dirigidas de `schema.prisma`, migraciones, `deploy/`, `ops/backup/`, `ci.yml`, `arquitectura.md` y `despliegue.md`. NotebookLM no estaba disponible en la sesión (sin herramientas MCP `notebooklm`): no se consultó. No hay problemas bloqueantes; hay cuatro decisiones técnicas con recomendación (DT-1 a DT-4, al final), y el plan está escrito con las recomendaciones.

### Objetivo técnico

Un módulo nuevo `inventory` con las mismas capas que productos y página (REQ-F-044): dominio puro en `packages/core/inventory`, persistencia Prisma en `packages/db`, contratos Zod en `packages/contracts`, rutas en `api/src/admin` bajo `/api/v1/admin/inventario` y pantallas SSR en `inventory-manager`. Más el rol `gerente` en identidad. Todo en `epic/inventario`, sin tocar `deploy/`, el menú, las landings ni el bot.

### Hechos del repositorio que condicionan el plan

- **Rol en la base:** `user.role` es un `ENUM('admin','editor')` de MySQL (`enum Role` en `schema.prisma`). `toRecord` (`packages/db/src/user-repository.ts:50`) lanza "Rol desconocido" si el valor no está en `ROLES`, y `run()` lo convierte en `DatabaseUnavailableError` (503). Los contratos (`adminUserSchema.role`, `managedUserSchema.role` con `USER_ROLES`) son `z.enum` cerrados. `landing-pages/tests/unit/user-schema.test.ts:94` y `api/tests/unit/contract-types.test.ts:74` ya obligan a que el enum de Prisma, `ROLES` de core y `USER_ROLES` de contracts coincidan.
- **Negocios del editor:** `createUser`, `diffUser` y `validateUserData` tratan "no admin" como editor (`data.role === 'admin' ? [] : businesses`). Con un tercer rol hay que invertirlo a "solo el editor tiene negocios".
- **Acceso:** `access.ts` ofrece `business()` (401 → 404 → 403 `FORBIDDEN_BUSINESS` → CSRF) y `adminOnly()` (401 → 403 `FORBIDDEN_ROLE` → CSRF). Un gerente, sin negocios y sin rol admin, ya recibe 403 en productos, página, cotizador, bot y usuarios **sin cambiar esas rutas**.
- **Admin:** `inventory-manager` decide por `user.role` (`adminSession`, `header()`), y `home` muestra "Elige un negocio" con la lista vacía si el usuario no tiene negocios: hay que redirigir al gerente al inventario.
- **Unicidad sin distinguir mayúsculas:** la colación es `utf8mb4_es_0900_as_cs` (distingue mayúsculas y acentos), así que el patrón del proyecto es una columna clave normalizada en la app (`username_key`). MySQL no tiene índices parciales.
- **Grants:** `deploy/mysql/initdb/01-usuarios.sh` da DML (`restaurante_app`), DDL (`restaurante_migrator`) y lectura (`restaurante_backup`) sobre `restaurante.*`: las tablas nuevas quedan cubiertas **sin tocar `deploy/`**.
- **Respaldos:** `backup.sh` y `deploy.sh` hacen `mysqldump --databases restaurante` completo: las tablas nuevas entran solas. El manifiesto solo cuenta `user` y `product`.
- **Verificación al arrancar:** `verify.ts` comprueba la colación de **todas** las tablas y columnas, y con `allowNewerSchema` acepta migraciones desconocidas. No comprueba valores de ENUM.
- **Semillas:** hoy no existe ninguna semilla "solo de desarrollo": `api/src/install` publica en producción la semilla de página y productos. Hace falta un mecanismo nuevo y explícito.
- **CI:** `on.pull_request.branches: [main]` (commit `0318f3d` retiró `epic/arquitectura`). Un PR hacia `epic/inventario` **no correría el CI**. Las pruebas de humo ya llevan `github.base_ref == 'main'` y `publish`/`deploy` exigen push o ejecución manual sobre `main`, así que el cambio mínimo es volver a añadir la rama al disparador.
- **Lint:** `LANDING_ADMIN_PATTERN` de `eslint.config.ts` prohíbe a las landings `core/identity` y `core/bot-control`; hay que añadir `core/inventory`.

### Archivos o componentes afectados

Nuevos:

- `packages/core/inventory/` (plano, sin subcarpetas): `decimal.ts` (punto fijo con `bigint`), `units.ts` (unidades, magnitudes y conversión), `item-schema.ts` (validación y normalización de artículo, empaques y SKU), `category-schema.ts`, `inventory-store.ts` (interfaz del store, tipos y errores de dominio), `inventory-repository.ts` (casos de uso y reglas), `memory-inventory-store.ts` (doble de pruebas) e `index.ts`.
- `packages/db/src/prisma-inventory-store.ts`.
- `packages/db/prisma/migrations/<marca>_inventario_catalogo/migration.sql` y `<marca>_rol_gerente/migration.sql`.
- `packages/contracts/inventory.ts`.
- `api/src/admin/inventory-routes.ts`.
- `api/scripts/inventory-seed-dev.ts` y `api/scripts/support/inventory-dev-seed.ts` (datos ficticios de RF-10).
- `inventory-manager/src/controllers/inventory.ts`, `inventory-manager/src/views/inventory.ts`, páginas `views/pages/inventory-*.html` (lista, ficha, formulario de artículo, confirmación de baja, categorías, formulario de categoría) y los parciales que falten (fila de artículo, fila de empaque, fila de equivalencia, fila de historial, filtros, paginación).
- Pruebas (ver Testing) y `inventory-manager/tests/support/api-double-inventory.ts`.

Modificados:

- `packages/core/package.json` (export `./inventory`); `packages/db/package.json` (export `./prisma-inventory-store`).
- `packages/core/identity/user-schema.ts` (`ROLES`, `ROLE_LABELS`, negocios solo del editor), `authorization.ts` (`canManageInventory`; `allowedBusinesses` explícito por rol).
- `packages/db/prisma/schema.prisma` (enum `Role` + modelos nuevos), `packages/db/src/user-repository.ts` (negocios solo del editor en `createUser`, `update` y `diffUser`).
- `packages/contracts/admin.ts` (`USER_ROLES` y `adminUserSchema.role` con `gerente`; `INVENTORY_ROLES` para la interfaz), `admin-client.ts` (métodos de inventario), `index.ts`.
- `api/src/admin/access.ts` (`inventory()`), `router.ts`, `index.ts`; `api/src/server.ts` (raíz de composición); `api/tests/support/admin.ts` (`startAdmin` con el store en memoria); `api/package.json` (script `inventory:seed-dev`).
- `inventory-manager/src/routes.ts`, `app.ts` (composición), `controllers/admin.ts` (`home`), `controllers/common.ts` (sesión de inventario), `views/index.ts` (`HeaderSection 'inventory'`, enlace "Inventario", subnavegación), `views/users.ts` y `pages/user-form.html` (opción Gerente y ayuda de negocios).
- `eslint.config.ts` (`LANDING_ADMIN_PATTERN` con `inventory`).
- `restaurante/package.json` (script `inventory:seed-dev` que delega en `api`).
- Documentación: `restaurante/docs/arquitectura.md`, `restaurante/docs/despliegue.md`, `restaurante/README.md`.
- Previo, en `main` y con su propio PR: `.github/workflows/ci.yml`.

No se tocan: `deploy/` (sin cambio de suma ni reinstalación en el VPS), `ops/backup/`, `Dockerfile`, `compose*.yaml`, landings, bot, productos, página, cotizador.

### Modelo de datos (Prisma, migración `inventario_catalogo`)

Tipos exactos (PV-13): **factores y cantidades `DECIMAL(13,3)`** (hasta 9 999 999 999.999), **costos `DECIMAL(15,4)`** (en T3; T1 no guarda costos). Nunca `FLOAT`/`DOUBLE`. Prisma los mapea a `Decimal` (`Prisma.Decimal`, ya incluido en `@prisma/client`); el store los convierte a texto (`toFixed(3)`) y los escribe como texto. Core nunca ve `Prisma.Decimal`.

```prisma
enum InventoryItemType { insumo intermedio compuesto reventa }
/// simple: artículo normal; parent: agrupa variantes (sin unidad, SKU ni empaques); variant: hija de un parent.
enum InventoryItemKind { simple parent variant }
enum InventoryUnit { kg g L ml pza }

model InventoryCategory {
  id            Int      @id @default(autoincrement())
  name          String   @db.VarChar(60)
  nameKey       String   @map("name_key") @db.VarChar(120)
  /// = nameKey si está activa; null si no. Único: nombre único entre las activas.
  activeNameKey String?  @unique @map("active_name_key") @db.VarChar(120)
  active        Boolean  @default(true)
  createdAt     DateTime @map("created_at")
  updatedAt     DateTime @map("updated_at")
  items         InventoryItem[]
  @@map("inventory_category")
}

model InventoryItem {
  id            Int               @id @default(autoincrement())
  kind          InventoryItemKind
  type          InventoryItemType
  parentId      Int?              @map("parent_id")
  categoryId    Int               @map("category_id")
  name          String            @db.VarChar(80)
  nameKey       String            @map("name_key") @db.VarChar(160)
  /// = nameKey si está activo; null si no (RF-2: único entre los activos, sin distinguir mayúsculas).
  activeNameKey String?           @unique @map("active_name_key") @db.VarChar(160)
  description   String?           @db.VarChar(400)
  /// SKU vigente tal como se escribió (su unicidad la impone inventory_sku).
  sku           String?           @db.VarChar(40)
  /// null solo en un parent.
  baseUnit      InventoryUnit?    @map("base_unit")
  active        Boolean           @default(true)
  version       Int               @default(1)
  createdAt     DateTime          @map("created_at")
  updatedAt     DateTime          @map("updated_at")
  updatedById   Int?              @map("updated_by_id")
  updatedByName String?           @map("updated_by_name") @db.VarChar(60)
  parent        InventoryItem?    @relation("variants", fields: [parentId], references: [id], onDelete: Restrict)
  variants      InventoryItem[]   @relation("variants")
  category      InventoryCategory @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  units         InventoryItemUnit[]
  skus          InventorySku[]
  @@index([active, type])
  @@index([categoryId, active])
  @@index([parentId])
  @@map("inventory_item")
}

/// Unidad de empaque propia del artículo (RF-3): factor > 0 hacia la unidad base.
model InventoryItemUnit {
  id       Int           @id @default(autoincrement())
  itemId   Int           @map("item_id")
  position Int
  name     String        @db.VarChar(30)
  nameKey  String        @map("name_key") @db.VarChar(60)
  factor   Decimal       @db.Decimal(13, 3)
  item     InventoryItem @relation(fields: [itemId], references: [id], onDelete: Restrict)
  @@unique([itemId, nameKey])
  @@unique([itemId, position])
  @@map("inventory_item_unit")
}

/// Registro de todo SKU asignado alguna vez (PV-14): único entre activos e inactivos y no reutilizable,
/// aunque el artículo cambie de SKU.
model InventorySku {
  skuKey     String        @id @map("sku_key") @db.VarChar(40)
  itemId     Int           @map("item_id")
  assignedAt DateTime      @map("assigned_at")
  item       InventoryItem @relation(fields: [itemId], references: [id], onDelete: Restrict)
  @@index([itemId])
  @@map("inventory_sku")
}

/// Historial del catálogo (RN-16), en la misma transacción que el cambio.
model InventoryChange {
  id        Int      @id @default(autoincrement())
  at        DateTime
  /// item | category
  entity    String   @db.VarChar(16)
  entityId  Int      @map("entity_id")
  /// create | update | overwrite_after_conflict | deactivate | reactivate | inherit
  action    String   @db.VarChar(32)
  /// null: el sistema (semilla de desarrollo).
  actorId   Int?     @map("actor_id")
  actorName String   @map("actor_name") @db.VarChar(60)
  /// JSON: [{ field, before, after }].
  changes   String   @db.MediumText
  actor     User?    @relation(fields: [actorId], references: [id], onDelete: Restrict)
  @@index([entity, entityId, id])
  @@map("inventory_change")
}
```

DDL aproximado (`migration.sql`, generado con `npm run db:migrate:dev -- --create-only --name inventario_catalogo` y revisado a mano): cinco `CREATE TABLE … ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;` (`migrations-collation.test.ts` lo comprueba), sus índices y sus `ALTER TABLE … ADD CONSTRAINT … FOREIGN KEY` (hacia `inventory_item`, `inventory_category` y `user`). Cabecera como la de `20261105200300_pagina`: "Aditiva: la versión anterior funciona con ella (DATABASE_ALLOW_NEWER_SCHEMA)".

Migración `rol_gerente` (aparte, va en el PR del rol):

```sql
-- Aditiva: añade un valor al final del ENUM (cambio de metadatos en MySQL 8.4). El código anterior
-- sigue escribiendo y leyendo admin y editor. Ver "Riesgos técnicos" sobre leer un gerente.
ALTER TABLE `user` MODIFY `role` ENUM('admin', 'editor', 'gerente') NOT NULL;
```

La columna hereda la colación de la tabla (`utf8mb4_es_0900_as_cs`), que es la que exige `verify.ts`; QA lo comprueba arrancando la `api`.

**Por qué es solo aditiva y compatible con la vuelta atrás:** solo crea tablas nuevas, que el código anterior no conoce ni consulta, con la colación que exige `verify.ts`, y amplía un ENUM añadiendo un valor al final. No renombra, no borra, no cambia tipos ni restricciones de tablas existentes. La imagen anterior arranca con `DATABASE_ALLOW_NEWER_SCHEMA=true` (como hace `deploy.sh` en la vuelta atrás automática) porque `verify.ts` acepta migraciones desconocidas y todas las tablas tienen la colación correcta. **Excepción documentada:** la imagen anterior no sabe leer un usuario `gerente` (ver Riesgos y DT-2).

**Aplicación:** solo el servicio `migrate` (`prisma migrate deploy` con `MIGRATION_DATABASE_URL`, usuario `restaurante_migrator`), como hoy. La app sigue con `DATABASE_URL` (`restaurante_app`, solo DML). No hace falta ningún `GRANT` nuevo (ya son sobre `restaurante.*`): **no se toca `deploy/mysql/initdb/01-usuarios.sh`, `compose.prod.yaml` ni `deploy.sh`, y la suma de `deploy/` no cambia.**

### Dominio (`packages/core/inventory`)

- **Precisión sin coma flotante (`decimal.ts`):** punto fijo con `bigint` nativo (ES2024, ya en `tsconfig.base.json`). `parseDecimal(texto, escala)` acepta solo `^\d{1,10}(\.\d{1,3})?$` (punto decimal; la coma se rechaza con mensaje), `formatDecimal`, y multiplicación o división con redondeo a la escala de salida **mitad hacia arriba** (el mismo criterio "0.5 sube" del cotizador). Sin `decimal.js` ni otra dependencia (`dependencias.md`): la operación que se necesita es pequeña y `bigint` la resuelve de forma exacta.
- **Unidades (`units.ts`, RN-3):** `kg`, `g` (masa), `L`, `ml` (volumen), `pza` (pieza), con factores fijos hacia la unidad de referencia de su magnitud (kg = 1000 g; L = 1000 ml). `convert(cantidad, desde, artículo)`: misma magnitud → factor fijo; unidad de empaque del artículo → su factor hacia la base; otra magnitud sin empaque → `UnitConversionError` ("No hay factor para convertir pza a kg en este artículo"). Un resultado positivo que redondea a 0 en la unidad base se rechaza ("cantidad demasiado pequeña"). CA-4 (2 cajas = 48 pza) y CA-5 (500 g = 0.5 kg; pza → kg rechazado) son funciones puras de este módulo. Las equivalencias de la ficha (RF-4) las calcula el mismo módulo.
- **Artículo (`item-schema.ts`, RF-2, RF-3, RF-5):**
  - nombre: recorte y NFC, obligatorio, ≤ 80 puntos de código, sin caracteres de control; clave = `toLowerCase()` (distingue acentos, como pide "sin distinguir mayúsculas");
  - descripción opcional ≤ 400;
  - tipo obligatorio e **inmutable** (no hay justificación técnica para cambiarlo: alteraría recetas y existencias de T2 y T3);
  - `kind` (simple, parent o variant) inmutable; un parent solo de tipo Reventa o Compuesto, sin unidad base, SKU ni empaques; una variante hereda tipo y categoría del padre y no puede ser padre (un solo nivel);
  - categoría obligatoria y activa;
  - SKU opcional, recortado, ≤ 40, `[A-Za-z0-9._-]`; clave en mayúsculas;
  - unidad base obligatoria (salvo parent);
  - empaques: 0 a 8 por artículo, nombre ≤ 30 único en el artículo sin distinguir mayúsculas y distinto de las unidades del sistema; factor > 0, ≤ 1 000 000 y con 3 decimales como máximo (CA-6 y casos límite).
  - Errores por campo (`fields`) con mensajes en español, como `ProductValidationError`.
- **RN-4 sin sobreingeniería:** en T1 no hay recetas ni movimientos. El repositorio comprueba el bloqueo en un solo punto, `store.isInUse(itemId)`, que en T1 devuelve siempre `false` (comentario: "T2 y T3 añaden recetas y movimientos"). Si devuelve `true`, cambiar la unidad base o tocar un empaque da `ItemLockedError` (409). La ficha muestra si está bloqueado. No se crean tablas ni columnas para esto.
- **Repositorio (`inventory-repository.ts`):**
  - Alta, edición, baja y reactivación de artículos y categorías. Cada escritura va en una transacción del store con su entrada de historial (autor = `{ id, displayName }`), como `product-repository.ts`.
  - **Concurrencia (RF-8, CA-9):** `version` por artículo con UPDATE condicionado (`updateMany where { id, version }`); 0 filas → `InventoryConflictError` con `{ id, version, updatedAt, updatedBy }`. "Guardar encima" envía la versión vigente y registra `overwrite_after_conflict`, como productos.
  - **Unicidad del nombre:** comprobación previa para dar el error por campo, y el índice único `active_name_key` como garantía ante carreras (P2002 → error por campo `name`). La baja pone `active_name_key = NULL`; la reactivación la vuelve a poner y, si choca, `ItemNameTakenError` ("Ya hay un artículo activo con ese nombre").
  - **SKU (PV-14 y DT-3):** al asignar o cambiar el SKU se inserta su clave en `inventory_sku`; si existe y es de otro artículo → error por campo `sku` ("Ese SKU ya se usó"). Volver al propio SKU anterior está permitido.
  - **Padre (RF-5):** inactivar un padre con variantes activas exige confirmación. Sin ella, 409 `ITEM_HAS_ACTIVE_VARIANTS` con el número; con `variants: 'deactivate'`, se inactivan padre y variantes en la misma transacción, cada una con su historial. Reactivar el padre no reactiva variantes. No se crea ni reactiva una variante de un padre inactivo (409 `PARENT_INACTIVE`). Cambiar la categoría del padre la cambia en sus variantes en la misma transacción, con una entrada `inherit` en cada una.
  - **Categorías (RF-6, CA-13):** nombre único entre las activas sin distinguir mayúsculas (mismo patrón). Inactivar con artículos activos → 409 `CATEGORY_IN_USE` con "La usan N artículos activos". No se puede asignar una categoría inactiva, ni reactivar un artículo con categoría inactiva (409 `CATEGORY_INACTIVE`).
  - **Aislamiento:** escrituras en transacción `Serializable` con reintento acotado ante interbloqueo (`MAX_ATTEMPTS` y `isTransactionConflict`, como `user-repository.ts`). Así la cuenta de "artículos activos de la categoría" y el alta de un artículo en esa categoría no se cruzan.
  - **Lista:** filtros `estado` (activos por defecto, inactivos o todos), `tipo`, `categoria`, `q` (contiene, sobre `name_key` y `sku`), orden por nombre y página de 50. Cada padre lleva su número de variantes.
- **Identidad:** `ROLES = ['admin', 'editor', 'gerente']`, `ROLE_LABELS.gerente = 'Gerente'`. `validateUserData`: solo el editor exige y guarda negocios; admin y gerente, `[]`. `authorization.ts`: `canManageInventory(user) = role === 'admin' || role === 'gerente'`; `allowedBusinesses`: admin todos, editor los suyos, gerente ninguno (explícito).

### Backend: contratos y endpoints

`packages/contracts/inventory.ts` define una sola vez los enums (`INVENTORY_ITEM_TYPES`, `INVENTORY_UNITS`, `INVENTORY_ITEM_KINDS`), los DTO (artículo con empaques, variantes y padre resumidos, equivalencias e historial; categoría con su número de artículos activos), los cuerpos de escritura y las rutas. Las cantidades y los factores viajan como **texto decimal** (`"24.000"`), nunca como `number`.

Rutas (todas tras `access.inventory(ctx, { write })`: sesión 401 → rol admin o gerente, si no 403 `FORBIDDEN_ROLE` "No tienes permiso para gestionar el inventario." → en escrituras, CSRF 403 `CSRF_INVALID`). Se registran en `router.ts` **antes** de las rutas `/:business/...`:

| Método y ruta (`/api/v1/admin/inventario/…`) | Respuesta |
| --- | --- |
| `GET articulos?estado=&tipo=&categoria=&q=&pagina=` | 200 `{ items, page: { number, size, total } }`; filtro inválido → 422 `fields` |
| `POST articulos` (`Idempotency-Key`) | 201 `{ item }`; 422 `fields` (nombre o SKU repetido incluidos); 409 `PARENT_INACTIVE` o `CATEGORY_INACTIVE` |
| `GET articulos/:id` | 200 `{ item, history }` (últimos 50 cambios); 404 `ITEM_NOT_FOUND` |
| `GET articulos/:id/conversion?cantidad=&unidad=` | 200 `{ quantity, unit }`; 422 `UNIT_CONVERSION_UNAVAILABLE` o cantidad inválida (RF-4, CA-4 y CA-5 en pantalla) |
| `PUT articulos/:id` (con `version`) | 200; 409 `VERSION_CONFLICT` con `current { id, version, updatedAt, updatedBy }` (mismo formato que productos, ya en `apiErrorBodySchema`); 409 `ITEM_LOCKED`; 422 |
| `POST articulos/:id/desactivar` (`version`, `variants?`) | 200; 409 `ITEM_HAS_ACTIVE_VARIANTS` o `VERSION_CONFLICT` |
| `POST articulos/:id/reactivar` (`version`) | 200; 409 `ITEM_NAME_TAKEN`, `PARENT_INACTIVE` o `CATEGORY_INACTIVE` |
| `GET categorias` | 200 `{ categories }` |
| `POST categorias` (`Idempotency-Key`) | 201; 422 |
| `PUT categorias/:id` | 200; 404; 422 |
| `POST categorias/:id/desactivar` y `…/reactivar` | 200; 409 `CATEGORY_IN_USE` con el número en el mensaje; 409 `CATEGORY_NAME_TAKEN` |

- Cuerpos JSON cerrados (`responder.closedBody`, 16 KiB), ids con `^[1-9]\d{0,9}$` (otro → 404), errores con `ApiHttpError` y el manejador central (`{ error: { code, message, fields?, current? } }`). La base caída da 503 sin detalles (`DatabaseUnavailableError`).
- **Idempotencia:** `createIdempotencyStore` existente, con ámbito `inventario-articulos` o `inventario-categorias`, y el campo oculto `requestId` del formulario como clave (como el alta de productos). El índice único del nombre es la segunda barrera ante un doble envío.
- Logs: solo ids, acción y códigos (`inventory_item_saved`, `inventory_conflict`), nunca nombres ni el cuerpo.
- **Usuarios:** `adminUserSchema.role` y `USER_ROLES` con `gerente`. `POST/PUT /usuarios` aceptan `gerente` (negocios ignorados y guardados vacíos). Cambiar el rol de un usuario ya incrementa `sessionVersion` (`closesSessions` cuando cambia el rol): un gerente degradado o desactivado pierde la sesión, como hoy (caso límite cubierto sin código nuevo).
- `toAdminUser`: un gerente devuelve `businesses: []`.

### Frontend (`inventory-manager`)

- **Rutas SSR** (antes de `/:business/...` en `routes.ts`), todas con sesión y rol (admin o gerente; si no, 403 con la página "Sin permiso", como `adminSession`):
  - `GET /inventario/articulos` (lista y filtros por GET);
  - `GET /inventario/articulos/nuevo` y `POST /inventario/articulos` (alta; `?padre=<id>` para una variante, con tipo y categoría heredados de solo lectura);
  - `GET /inventario/articulos/:id` (ficha) y `GET …/:id?cantidad=&unidad=` (formulario GET de conversión en la ficha);
  - `GET …/:id/editar` y `POST /inventario/articulos/:id`;
  - `GET|POST …/:id/desactivar` (confirmación; si es padre, la lista de variantes activas que se inactivarán) y `POST …/:id/reactivar`;
  - `GET /inventario/categorias` (lista y formulario de alta), `POST /inventario/categorias`, `GET …/:id/editar`, `POST …/:id`, `POST …/:id/desactivar|reactivar`.
  - POST/redirect/GET con 303 (el botón atrás no reenvía), mismo origen, formularios cerrados y CSRF.
- **Lista (RF-1):** formulario GET de filtros (tipo, categoría y estado como `select`, búsqueda como `input type="search"`, botón "Filtrar") y lista de tarjetas `ul > li` mobile-first (nombre como enlace, tipo, categoría, unidad base, SKU, estado como texto y "N variantes" si es padre) que pasa a cuadrícula en `md`. Vacío: parcial `empty` con el mensaje. Paginación con enlaces "Anterior"/"Siguiente" y `aria-label`.
- **Ficha (RF-2 a RF-5 y RF-7):** datos en `dl`; "Último costo" y "CPP" como "Sin costo" (solo lectura, hasta T3); empaques; tabla de equivalencias (`table` con `caption` y `th scope`, con desplazamiento horizontal acotado a 360 px); formulario GET de conversión; variantes con enlace y "Añadir variante"; historial (`ol`, fecha en `BUSINESS_TIMEZONE`, autor y cambios antes → después); acciones Editar e Inactivar o Reactivar.
- **Formularios:** se reutilizan los parciales existentes (`field-input`, `field-select`, `field-textarea`, `fieldset`, `row-fieldset` para las 8 filas de empaque, `error-summary`, `field-error`, `notice`, `overwrite` del 409, `submit`, `status-form`). El 409 muestra quién y cuándo, y deja "Cargar la versión vigente" o "Guardar encima", como productos (RF-8). Con la API caída o en 503: aviso y lo escrito se vuelve a pintar (patrón `preserve` de REQ-F-039).
- **Navegación:** `HeaderSection` suma `'inventory'`. En la cabecera, el enlace "Inventario" (`nav-link`) va después de los negocios y antes de "Usuarios" y "Bot", visible para admin y gerente (`INVENTORY_ROLES` de contracts; la autoridad sigue siendo la API). Dentro de la sección, una subnavegación "Artículos | Categorías", reutilizando el parcial `business-nav` con el título "Inventario". El tema es `neutral` (no hay negocio, D-3). La cabecera ya hace `flex-wrap`: un enlace más no la rompe a 360 px (QA lo comprueba).
- **Inicio:** `home` redirige a `/inventario/articulos` a quien no tiene negocios y puede usar el inventario (el gerente); el resto, igual que hoy.
- **Usuarios:** opción "Gerente" en el `select` de rol, con ayuda: "Gestiona el inventario; no accede a productos, página, usuarios, bot ni cotizador. Los negocios solo aplican al editor." `ROLE_LABELS` del admin con `gerente`.
- **Accesibilidad (RF-11 y CA-17):** HTML semántico, `label` en cada campo, errores con texto e icono (no solo color) y resumen enlazado, foco visible (las clases del sistema actual), `aria-current` en la navegación, objetivos de 44 px (`min-h-11`), sin JavaScript obligatorio. `npm run build:css` regenera `inventory-manager/public/css/main.css`.
- **Stitch:** ninguna pantalla de T1 lo necesita. Son listas, fichas y formularios que el sistema visual del admin (decisión B) ya resuelve con parciales existentes: usuarios, productos y bot tienen el mismo patrón. PV-8 reserva Stitch para pantallas complejas (el editor de recetas de T2) con aprobación previa. `_stich_source_/` no tiene diseño del admin.

### Contenido / configuración

- Sin variables de entorno nuevas.
- **Semillas de desarrollo (RF-10, CA-12, PV-5):** comando explícito `npm run inventory:seed-dev` (`api/scripts/inventory-seed-dev.ts`), con los datos ficticios de RF-10 en `api/scripts/support/inventory-dev-seed.ts`. Las categorías también son ficticias (p. ej. "Abarrotes", "Carnes", "Verduras", "Lácteos", "Producción", "Platillos", "Bebidas"). Carga a través del repositorio (mismas reglas e historial con autor "Semilla de desarrollo"). Es idempotente: si ya hay artículos, no hace nada.
  - Se niega a ejecutarse con `NODE_ENV=production` o si el host de `DATABASE_URL` no es `127.0.0.1`, `localhost`, `::1` o `mysql-dev` (misma lista que la salvaguarda de pruebas).
  - La `api` **no** siembra el inventario al arrancar (`api/src/install` no cambia), así que una instalación de producción queda vacía. Las pruebas usan los mismos datos sobre el store en memoria.

### Validaciones

En el borde (la `api`): JSON cerrado, tipos y longitudes, y después las reglas de core. `inventory-manager` no valida reglas (no puede importar core): pinta los `fields` del 422. Filtros de la lista: valores de lista cerrada y `q` ≤ 80. Conversión: cantidad con `parseDecimal` y unidad del sistema o empaque existente.

### Manejo de errores

Errores de dominio de core → 404, 409 o 422 en `inventory-routes.ts`. Los inesperados → 503 con el formato central, sin el `message` de Prisma. P2002 en `active_name_key` o `inventory_sku` → error por campo. Los interbloqueos se reintentan; si se agotan los intentos, 503.

### Testing

Permanentes y funcionales (`testing.md`): cada comportamiento una vez, en la prueba más barata; ningún archivo > 20 s.

- `api/tests/unit/inventory-units.test.ts`: punto fijo (parseo, límites, redondeo), conversiones fijas y por empaque (CA-4, CA-5), rechazo sin factor, resultado que redondea a 0, factor 0, negativo, no numérico o con 4 decimales (CA-6).
- `api/tests/unit/inventory-catalog.test.ts` (repositorio sobre el store en memoria):
  - CA-1: alta y su historial con autor;
  - CA-2: nombre repetido entre activos sin distinguir mayúsculas y aceptado si el otro está inactivo; reactivación con el nombre ocupado;
  - CA-3: SKU repetido, también inactivo o liberado por un cambio;
  - CA-7: padre y variantes, variante de padre inactivo, inactivación del padre con y sin confirmación, herencia de categoría;
  - CA-8: filtros de estado;
  - CA-9: conflicto de versión y "guardar encima";
  - CA-13: categoría en uso con su número;
  - tipo inmutable y recorte de nombres;
  - CA-12: la semilla de desarrollo se carga y da los artículos de RF-10.
- `landing-pages/tests/integration/prisma-inventory-store.test.ts` (MySQL real, `makeDatabase()`): solo lo que depende de la base. Altas simultáneas con el mismo nombre (un éxito y un error por campo, sin duplicado), unicidad del registro de SKU, factor `0.355` exacto ida y vuelta, conflicto de versión con dos escrituras a la vez, inactivación de categoría frente a un alta simultánea, y un usuario `gerente` guardado y leído (enum ampliado).
- `api/tests/integration/admin-inventory-api.test.ts` (`startAdmin`):
  - 401 sin sesión;
  - CA-10: editor con 403 `FORBIDDEN_ROLE` en lectura y escritura, sin escribir nada;
  - 403 CSRF;
  - CA-11: gerente con 200 en inventario y 403 en usuarios, bot, cotizador, productos y página;
  - 409 con `current`, 422 con `fields`, 404, conversión y alta idempotente (misma clave y cuerpo, un solo artículo).
  - Si pasa de 20 s, se parte en `…-access` y `…-api` por sus `describe`.
- `api/tests/integration/admin-users-api.test.ts` (existente, se amplía): alta y cambio a gerente con negocios vacíos y sesión cerrada al cambiar el rol.
- `inventory-manager/tests/integration/inventory.test.ts` (con el doble de la API):
  - CA-10 en pantalla: el editor no ve "Inventario" y recibe 403 en `/inventario/articulos`; CA-11: el gerente lo ve y `/` lo redirige;
  - filtros y mensaje sin resultados;
  - 422 con resumen de errores, 409 con quién y cuándo, y API caída conservando lo escrito.
- **Cadena real de punta a punta (una, testing.md):** dentro de `prisma-inventory-store.test.ts`, la `api` en proceso sobre MySQL: login de un gerente → alta de "Masa de maíz" con "bulto = 25" → ficha con su equivalencia → edición con conflicto.
- Ajustes de pruebas existentes por el rol nuevo (no son pruebas nuevas): `user-schema.test.ts`, `contract-types.test.ts` y `users.test.ts` del admin, si fijan la lista de roles.

Se ejecutan y **no se commitean** (evidencia en el QA Report):

- vuelta atrás con la imagen anterior (CA-15);
- respaldo y restauración (CA-16);
- pantallas a 360 px y en escritorio, solo con teclado y sin JavaScript (CA-17), con axe;
- regresión de landings, `/api/v1/public/*`, bot, productos y página (CA-14, con la suite existente y una sonda manual);
- carreras adicionales, mutaciones y mediciones de duración.

No hay pruebas de arquitectura: las fronteras las impone `npm run lint`.

### Seguridad

- Mínimo privilegio sin cambios: la `api` sigue con el usuario solo DML, y las rutas viven en la red interna (`/api/v1/admin`).
- Autorización en la API por rol en cada ruta (la interfaz solo oculta), CSRF en escrituras y mismo origen en `inventory-manager`.
- Sin datos personales nuevos; el historial guarda id y nombre visible del autor, como productos.
- CSP y cabeceras sin cambios.
- La semilla de desarrollo se niega a correr fuera de local.

### Performance

- Índices por estado y tipo, categoría y padre. La búsqueda `LIKE '%q%'` recorre la tabla, aceptable para el volumen esperado (cientos de artículos); si crece, se añade un índice o una búsqueda por prefijo.
- Paginación de 50, sin N+1: el número de variantes sale de una consulta agrupada.
- La ficha carga artículo, empaques, variantes e historial (50) en una transacción de lectura.
- El pool de 5 conexiones no cambia; las escrituras son cortas.

### Riesgos técnicos

1. **Usuario `gerente` y vuelta atrás a mano a una imagen anterior a la épica (riesgo real).** Esa `api` lanza "Rol desconocido" al leer un gerente. El efecto: la lista de usuarios da 503 al administrador, el gerente no puede entrar, y con un `inventory-manager` anterior el contrato rechaza toda la lista. El resto (landings, bot, productos, página, acceso de admins y editores) funciona. La vuelta atrás **automática** del despliegue que lleva la épica no lo sufre, porque en ese momento aún no hay gerentes; las vueltas atrás automáticas de despliegues posteriores van a imágenes que ya conocen el rol. Mitigación propuesta (DT-2): un procedimiento en `despliegue.md` §6. Antes de volver a mano a una imagen anterior a la épica, `UPDATE user SET role='editor', session_version=session_version+1 WHERE role='gerente';` (editor sin negocios = sin acceso), y anotar quiénes eran para restaurarles el rol al volver a avanzar. Con eso, CA-15 se cumple con ese paso documentado.
2. **ENUM ampliado:** si Prisma generara el `MODIFY` con otra colación, `verify.ts` rechazaría el arranque. Se revisa a mano y QA arranca la `api` sobre la base migrada.
3. **Rama larga:** se integra `main` en la épica tras cada merge a `main` (ver abajo). En desarrollo local, una base migrada con la épica hace que la `api` de `main` no arranque sin `DATABASE_ALLOW_NEWER_SCHEMA=true` en su `.env` local: se documenta en el README de la épica.
4. **Precisión:** el redondeo solo ocurre en la conversión hacia la base y se prueba en sus límites. Los factores se guardan exactos.
5. **Serializable:** más interbloqueos posibles en escrituras concurrentes del catálogo (poco frecuentes), absorbidos por el reintento acotado.
6. **Cabecera a 360 px** con un enlace más: comprobación visual en QA.

### Rama `epic/inventario` y CI

1. **Primer cambio, a `main` y con su propio PR (antes del primer PR de T1):** rama `ci/rama-epic-inventario` que vuelve a admitir la rama intermedia en `.github/workflows/ci.yml`:
   - `on.pull_request.branches: [main, epic/inventario]`;
   - el comentario de "Rama intermedia" (como antes de `0318f3d`, con el nombre nuevo);
   - el comentario de las pruebas de humo, que vuelve a explicar que en un PR a la épica se omiten.

   No hace falta cambiar ninguna condición. Las pruebas de humo ya tienen `github.base_ref == 'main'`. `publish` y `deploy` exigen push o ejecución manual sobre `main`. `validado` solo cuenta PR hacia `main`. `cambios` compara con la rama base de cada PR. El cambio de `ci.yml` cuenta como código: **su merge a `main` publica y redespliega producción con el mismo código de la app**, con volcado y sin migraciones. Es inocuo, pero hay que saberlo.
2. **Crear la rama** justo después de ese merge y antes del primer PR de T1, sin checkout:

   ```sh
   git fetch origin && git push origin origin/main:refs/heads/epic/inventario
   ```

   Sin protección de rama, igual que `main` hoy. No hay push directo a la épica: todo entra por PR, con el CI completo (`calidad`, `docker` sin pruebas de humo, `auditoria` y `pruebas`) y sin publicar ni desplegar.
3. **Integrar `main` en la épica tras cada cambio a `main`:**

   ```sh
   gh pr create --base epic/inventario --head main --title "chore: integra main en epic/inventario"
   ```

   Se mergea con *merge commit* (nunca squash) cuando el CI está en verde. Si hay conflictos, rama `chore/integra-main-en-inventario` desde la épica, `git merge origin/main`, se resuelven, y PR hacia la épica.
4. **Llevar la épica a `main`** (D-4: cuando T1 a T3 sean utilizables): PR `epic/inventario` → `main`, con su CI completo, incluidas las pruebas de humo de despliegue y respaldos con las migraciones nuevas. Al mergearlo, `validado` lo trata como cualquier PR hacia `main`. Después, PV-12: T4 y T5 directo a `main`, borrar la rama y quitarla de `ci.yml`.
5. **Propuesta para `.claude/rules/git.md`** (es de `.claude/`: requiere la autorización expresa del usuario; aquí solo se propone). En "Rama de destino de los Pull Requests", añadir:
   - "Épica de inventario (REQ-F-049, D-4): los PR de T1 a T3 (REQ-F-049 a REQ-F-051) van a `epic/inventario` (`gh pr create --base epic/inventario`). El CI los valida sin publicar ni desplegar y omite las pruebas de humo. Tras cada merge a `main`, PR de `main` hacia la épica (merge commit). La épica llega a `main` con un PR propio; después, T4 y T5 van a `main` y la rama se borra (PV-12)."
   - Y en las fases T4 y T5 del flujo: "en tickets de la épica, la rama de trabajo sale de `epic/inventario` y el PR apunta a ella".

### Partición de T1 en PR (todos hacia `epic/inventario`)

| PR | Contenido | Valor |
| --- | --- | --- |
| 0 (a `main`) | `ci.yml` con la rama intermedia | Que los PR de la épica tengan CI |
| 1 | Migración `inventario_catalogo` + `core/inventory` (punto fijo, unidades, esquema, repositorio, store en memoria) + `prisma-inventory-store` + lint (`LANDING_ADMIN_PATTERN`) + pruebas unitarias y de MySQL | Reglas, conversiones y persistencia probadas, y la migración verificada contra la vuelta atrás |
| 2 | Migración `rol_gerente` + rol en core, db y contratos + `access.inventory` + rutas y contratos de inventario + cliente + pantalla de usuarios (opción Gerente) + pruebas de la API | API completa y rol asignable (CA-9 a CA-11 en la API) |
| 3 | Pantallas de inventario en `inventory-manager` + navegación e inicio + semilla de desarrollo + documentación + pruebas del admin + cadena de punta a punta | T1 utilizable (CA-1 a CA-17) |

Cada PR pasa su propio ciclo (implementación, aprobación, QA, PR y CI en verde); el ticket queda en `in-progress/` hasta el tercero. Ramas: `feature/REQ-F-049-catalogo-modelo`, `feature/REQ-F-049-catalogo-api` y `feature/REQ-F-049-catalogo-pantallas`, cada una desde la punta de `epic/inventario`. Alternativa: un solo PR de unas 4 000 a 5 000 líneas con pruebas, difícil de revisar (DT-1).

### Orden de implementación

1. PR 0 (`ci.yml`) a `main`, merge y CI en verde; crear `epic/inventario`.
2. Esquema y migración `inventario_catalogo` (revisión a mano de la colación); `npm run db:generate`.
3. `decimal.ts` y `units.ts` con sus pruebas; `item-schema.ts` y `category-schema.ts`.
4. Store (interfaz, memoria y Prisma), repositorio y pruebas unitarias y de MySQL. Lint.
5. Rol gerente (migración, core, db y contratos) y pruebas de usuarios.
6. Contratos, `access.inventory`, rutas, cliente y pruebas de la API.
7. Pantallas, navegación, inicio y usuarios; `build:css`.
8. Semilla de desarrollo y su comando.
9. Documentación.
10. Validación: `build:css`, `typecheck`, `test` y `lint` en cada PR; sondas de QA.

### Documentación a actualizar

- `restaurante/docs/arquitectura.md`:
  - §4: `core/inventory` deja de ser "nuevo" y describe el catálogo; la regla de las landings incluye `inventory`;
  - §6: las rutas `/api/v1/admin/inventario`;
  - §8, paso 5: la épica de inventario, la rama `epic/inventario`, la partición T1 a T5 y el PR 0 de `ci.yml`.
- `restaurante/docs/despliegue.md`:
  - 11.1 "Qué guarda": las tablas `inventory_*`;
  - §9: el inventario vuelve con el volcado;
  - §6: el procedimiento del gerente antes de una vuelta atrás a mano (DT-2);
  - `ci.yml` (comentarios de la rama intermedia) en el PR 0.
- `restaurante/README.md`: el comando `npm run inventory:seed-dev`, el rol Gerente y la nota de `DATABASE_ALLOW_NEWER_SCHEMA` local al alternar entre la épica y `main`.
- **Propuestas (`.claude/`, requieren autorización expresa):**
  - `.claude/CLAUDE.md` §8: `api` "…productos, datos de página, usuarios, control del bot, el cotizador **y el catálogo de inventario**" e `inventory-manager` "…y el **inventario (administradores y gerentes)**";
  - `.claude/rules/git.md` (arriba);
  - `.claude/agents/senior-fullstack.md` ("Persistencia y API"), para mencionar `core/inventory`.

### Respaldos y restauración (CA-16)

- **Hoy:** `backup.sh` (diario, a R2) y `deploy.sh` (antes de migrar) hacen `mysqldump --databases restaurante` completo con `restaurante_backup` (SELECT, SHOW VIEW, TRIGGER, LOCK TABLES sobre `restaurante.*`). Las cinco tablas nuevas entran en el volcado y en la restauración (`restore.sh`, `despliegue.md` §9 y §11.7) **sin cambiar `ops/backup/` ni `deploy/`**.
- El manifiesto solo cuenta `user` y `product`. Se propone **no** añadir contadores de inventario: cambiaría `backup.sh`, `verify-backup.sh` y el formato del manifiesto, y obligaría a reinstalar los scripts en el VPS, sin aportar a CA-16 más que la verificación de abajo.
- **Verificación de QA (no se commitea):** en local, volcado con `mysqldump` de una base `restaurante_test_*` con semilla e historial, restauración en otra base `restaurante_test_*`, y comparación de conteos y contenido de las cinco tablas (CA-16).
- En el PR de la épica hacia `main`, la prueba de humo de respaldos del CI corre con las migraciones nuevas.
- Tras el despliegue, el simulacro mensual (`verify-backup.sh --drill`, §11.8) más una consulta de conteos de `inventory_item` sobre la base restaurada; se documenta en §11.8.

### Qué hace cada agente

- **senior-fullstack:** PR 0 (tras aprobación), rama, PR 1 a 3, documentación y propuestas de `.claude/`.
- **senior-qa** (por PR):
  - vuelta atrás: la `api` de `main` anterior sobre la base migrada con `DATABASE_ALLOW_NEWER_SCHEMA=true` (arranca, landings, bot, productos, página y usuarios), con y sin gerentes, y el procedimiento DT-2 (CA-15);
  - respaldo y restauración (CA-16);
  - concurrencia de conflicto y alta simultánea (CA-9, doble envío);
  - permisos por rol en la API y en el admin (CA-10, CA-11);
  - regresión de landings, `/api/v1/public/*`, bot, productos y página (CA-14);
  - 360 px, teclado, sin JavaScript y axe (CA-17).

### Criterios de finalización

- CA-1 a CA-17 comprobados (los de QA, con evidencia en el QA Report).
- `typecheck`, `lint` y `test` en verde, y `build:css` hecho.
- Migraciones aditivas con la colación correcta y vuelta atrás comprobada.
- Ninguna diferencia en `deploy/` ni en `ops/backup/`.
- CI en verde en cada PR hacia `epic/inventario`.
- Documentación actualizada.
- Sin pruebas no funcionales commiteadas.

### Decisiones técnicas para el usuario (con recomendación)

- **DT-1. Partición.** Recomendado: T1 en **3 PR** hacia `epic/inventario` (más el PR 0 de `ci.yml` a `main`). Alternativa: un solo PR grande.
- **DT-2. Gerentes y vuelta atrás a mano.** Recomendado: aceptar el riesgo con el **procedimiento documentado** (degradar los gerentes a editor sin negocios antes de volver a una imagen anterior a la épica). Así CA-15 queda cumplido con ese paso. Alternativa: un cambio previo en `main` que haga tolerante la lectura de roles desconocidos. Amplía el alcance a producción antes de la épica y no cubre el contrato del `inventory-manager` anterior.
- **DT-3. SKU "no reutilizable".** Recomendado: SKU **editable**, con un registro (`inventory_sku`) de todo SKU asignado alguna vez, que impide reutilizarlo aunque el artículo cambie el suyo. Alternativa: SKU inmutable una vez guardado (como el slug), sin tabla extra; un error de captura obligaría a inactivar y crear otro artículo.
- **DT-4. CI y regla de git.** Recomendado: autorizar el PR 0 de `ci.yml` a `main` (redespliega producción sin cambios funcionales) y la actualización propuesta de `.claude/rules/git.md` (y, si lo quiere, la de `.claude/CLAUDE.md` §8).

## Implementation Result — PR 1

### Rama

`feature/REQ-F-049-catalogo-modelo`, desde `origin/epic/inventario` (`1c88e30`). Sin commit ni PR (pendiente de aprobación). El nombre es el del plan aprobado (partición de T1), no `feature/REQ-F-049-t1-1-modelo-dominio`.

### Cambios realizados

- **Modelo y migración** (`packages/db/prisma/schema.prisma`, `migrations/20261119004332_inventario_catalogo/migration.sql`): enums `InventoryItemType`, `InventoryItemKind`, `InventoryUnit` y las cinco tablas del plan (`inventory_category`, `inventory_item`, `inventory_item_unit`, `inventory_sku`, `inventory_change`), con la relación `User.inventoryChanges` (solo en Prisma; no altera `user`). Generada con `prisma migrate dev --create-only` contra bases desechables `restaurante_test_gen_*` (no la de desarrollo) y revisada a mano: colación `utf8mb4_es_0900_as_cs` en los cinco `CREATE TABLE` y cabecera de migración aditiva. `prisma migrate diff --from-migrations … --to-schema …`: sin diferencias.
- **Dominio** (`packages/core/inventory/`, export `@restaurante/core/inventory`): `decimal.ts` (punto fijo con `bigint`, escala 3, coma rechazada, redondeo mitad hacia arriba), `units.ts` (RN-3: factores fijos, empaques, `UnitConversionError`, resultado que redondea a 0 o supera el máximo, equivalencias de la ficha), `text.ts`, `item-schema.ts` (RF-2, RF-3, RF-5, CA-6), `category-schema.ts`, `errors.ts`, `inventory-store.ts` (contrato, con `isInUse` como único punto de RN-4, siempre `false` en T1), `inventory-repository.ts` (alta, edición con conflicto y "guardar encima", baja y reactivación, padres y variantes, herencia de categoría, SKU con registro, categorías, lista, ficha y conversión) y `memory-inventory-store.ts` (doble con las mismas claves únicas, `failNext` y `markInUse`).
- **Persistencia** (`packages/db/src/prisma-inventory-store.ts`, export `@restaurante/db/prisma-inventory-store`): escrituras `Serializable` con reintento acotado ante interbloqueo; P2002 → `ItemNameTakenError`, `SkuTakenError` o `CategoryNameTakenError`; resto → `DatabaseUnavailableError`; factores leídos con `toFixed(3)` y escritos como texto; número de variantes con una consulta agrupada; búsqueda con los comodines de `LIKE` escapados.
- **Lint** (`eslint.config.ts`): `LANDING_ADMIN_PATTERN` incluye `core/inventory` (comprobado con un archivo de sonda en `landing-pages/src`, borrado después).

Desviaciones del plan (menores): los errores de dominio van en `errors.ts` (no en `inventory-store.ts`) para que `units.ts` no dependa del store; `text.ts` reúne la normalización de nombres. La búsqueda por SKU usa el registro `inventory_sku`, así que un SKU anterior del artículo también lo encuentra (es único y no reutilizable: no hay ambigüedad). Hallazgo corregido: Prisma no escapa `%` y `_` en `contains`; se escapan en el store y queda cubierto en la prueba de MySQL.

### Criterios de aceptación (alcance del PR 1: reglas y persistencia; pantallas y API en PR 2 y PR 3)

- CA-1, CA-2, CA-3, CA-4, CA-5, CA-6, CA-7, CA-8, CA-9 y CA-13: cumplidos en el dominio y la persistencia (pruebas abajo).
- CA-15 (parcial, para esta migración): `verifyDatabase` con las migraciones anteriores sobre una base con la migración nueva da `DATABASE_NEWER_THAN_CODE` sin `allowNewerSchema` y arranca con él (aviso `database_newer_than_code_allowed`); el usuario solo DML sigue escribiendo `user`. Sonda no commiteada. La vuelta atrás con la imagen anterior la comprueba QA.
- Permisos: los `GRANT` de `deploy/mysql/initdb/01-usuarios.sh` y `docker/mysql/initdb/01-usuarios.sh` son sobre `restaurante.*` (app: DML; migrator: DDL con `REFERENCES` e `INDEX`; backup: lectura): las tablas nuevas quedan cubiertas sin tocar `deploy/`. Las pruebas de MySQL corren con el usuario solo DML.
- CA-10, CA-11, CA-12, CA-14, CA-16 y CA-17: PR 2 y PR 3.

### Validaciones ejecutadas

- `npm run build:css`: 0. `npm run typecheck`: 0. `npm run lint`: 0, sin avisos.
- `npm test`: api 51 archivos y 1196 pruebas; landing-pages 61 y 894; inventory-manager 16 y 278. Todo en verde.
- `prisma-inventory-store.test.ts` ejecutado 5 veces seguidas: 7/7 cada vez, unos 3 a 4 s por archivo; las unitarias, menos de 0.2 s.

### Archivos afectados

`restaurante/packages/db/prisma/schema.prisma`, `restaurante/packages/db/prisma/migrations/20261119004332_inventario_catalogo/migration.sql`, `restaurante/packages/db/src/prisma-inventory-store.ts`, `restaurante/packages/db/package.json`, `restaurante/packages/core/inventory/*` (9 archivos), `restaurante/packages/core/package.json`, `restaurante/eslint.config.ts`, `restaurante/api/tests/unit/inventory-units.test.ts`, `restaurante/api/tests/unit/inventory-catalog.test.ts`, `restaurante/landing-pages/tests/integration/prisma-inventory-store.test.ts`.

### Riesgos o pendientes

- Sin documentación en este PR (el plan la asigna al PR 3).
- En desarrollo local, una base migrada con esta rama exige `DATABASE_ALLOW_NEWER_SCHEMA=true` para arrancar la `api` de `main` (riesgo técnico 3, documentación en el PR 3).
- Nombre de variante único en todo el catálogo (RF-2): dos padres no pueden tener una variante "Coca-Cola" cada uno.

## QA Action Plan — PR 1

### Objetivo

Validar con evidencia que el PR 1 (migración `20261119004332_inventario_catalogo`, `packages/core/inventory`, `packages/db/src/prisma-inventory-store.ts`, lint y 37 pruebas permanentes) cumple el Technical Action Plan de T1 en lo que le toca, que la migración es solo aditiva y compatible con la vuelta atrás, que los respaldos conservan las tablas nuevas y que no hay regresión.

Objeto bajo prueba: worktree `.claude/worktrees/agent-a695af6eae346107d`, rama `feature/REQ-F-049-catalogo-modelo` desde `1c88e30`, sin commit. Todo se ejecuta desde `restaurante/` del worktree salvo donde se indique.

### Requisito bajo prueba

RF-2 a RF-8 (reglas y persistencia), RN-3, RN-4 (punto único `isInUse`), RN-16 (historial), PV-13 (decimales), PV-14 y DT-3 (SKU no reutilizable); CA-15 y CA-16 para la migración de este PR.

### Criterios de aceptación (cada uno → pruebas que lo cubren)

| CA | Alcance en el PR 1 | Prueba |
| --- | --- | --- |
| CA-1 | Alta con historial "create" y autor (repositorio) | `inventory-catalog.test.ts` + sonda MySQL (S5) que lee `inventory_change` |
| CA-2 | Nombre único entre activos sin distinguir mayúsculas; aceptado si el otro está inactivo; reactivación con nombre ocupado | `inventory-catalog.test.ts`; carrera "Sal"/"SAL" en `prisma-inventory-store.test.ts` y S1; mutación M1 |
| CA-3 | SKU único entre activos e inactivos y no reutilizable tras cambiarlo | `inventory-catalog.test.ts`; registro `inventory_sku` en MySQL; S2; mutación M2 |
| CA-4 | 2 cajas = 48 pza | `inventory-units.test.ts` |
| CA-5 | 500 g = 0.5 kg; pza → kg sin factor rechazado con mensaje | `inventory-units.test.ts` |
| CA-6 | Factor 0, negativo, no numérico, con coma o con 4 decimales rechazado por campo | `inventory-units.test.ts`, `inventory-catalog.test.ts`; S4 (límites) |
| CA-7 | Padre sin unidad/SKU/empaques ni existencias; variantes con SKU, unidad y estado propios; padre inactivo | `inventory-catalog.test.ts` |
| CA-8 | Filtro activos/inactivos/todos y reactivación | `inventory-catalog.test.ts` + S6 (filtros y búsqueda en MySQL) |
| CA-9 | Conflicto de versión con datos vigentes; "guardar encima" con `overwrite_after_conflict` | `inventory-catalog.test.ts`, `prisma-inventory-store.test.ts`; S3; mutación M4 |
| CA-13 | Categoría en uso rechazada con el número de artículos | `inventory-catalog.test.ts`; carrera inactivar-categoría/alta en MySQL y S7 |
| CA-15 | Vuelta atrás con el código de `main` sobre la base migrada | Procedimiento R1 a R5 (sondas descartables) |
| CA-16 | Respaldo y restauración con las tablas nuevas | Procedimiento B1 a B4 |
| CA-14 | Regresión: landings, `/api/v1/public/*`, bot, productos y página | Suite completa + diff fuera de alcance vacío (el PR no toca esas rutas) |

**No aplica a este PR** (se validan en el QA de PR 2 o PR 3): CA-10 y CA-11 (rol Gerente, rutas y 403), CA-12 (semilla), CA-17 (pantallas), la parte de API y pantallas de CA-1, CA-8 y CA-9 (lista visible, aviso en pantalla, idempotencia del doble envío por HTTP), CA-14 en su forma de despliegue y la cadena de punta a punta. Tampoco el procedimiento DT-2 de gerentes (el rol no existe aún).

### Riesgos identificados

1. La migración altera algo existente (FK hacia `user` mal generada, cambio de colación o de columnas): rompe la vuelta atrás.
2. Unicidad sostenida solo por la comprobación previa (carrera) o por el índice sin traducción a error por campo (P2002 sin mapear → 503).
3. Pérdida de precisión: `Prisma.Decimal` → `number`, redondeo distinto de "mitad hacia arriba", límites 0.001 y 1 000 000.000.
4. Comodines `%` y `_` sin escapar en la búsqueda (hallazgo ya corregido: confirmar).
5. Serializable con reintento: interbloqueo no reintentado o reintento que duplica historial.
6. Pruebas que no detectan la regresión que dicen proteger (se mide con mutaciones).
7. Nombre de variante único en todo el catálogo (observación de RF-2, no defecto si el requisito no dice lo contrario).
8. T3 deberá crear el saldo del artículo en el alta: hoy no hay tabla de saldos (observación para T3, no defecto del PR 1).

### Pruebas funcionales

- **F1. Revisión del diff frente al plan.** `git status`, `git diff --stat` y `git diff` de los 5 archivos modificados; lectura dirigida de los nuevos. Comprobar: tablas, tipos (`DECIMAL(13,3)`, sin `FLOAT`/`DOUBLE`), índices y FK del plan; dominio solo con sintaxis borrable, imports `.ts`, entradas como `unknown`, sin `any` ni `as`/`!` injustificados (`typescript.md`); errores de dominio con código y sin mensaje de Prisma hacia fuera, inesperados → `DatabaseUnavailableError` (`manejo-de-errores.md`); `package.json` de `core` y `db` solo con `exports` nuevos, sin dependencias nuevas, y `package-lock.json` sin cambios (`dependencias.md`).
- **F2. Fuera de alcance.** `git diff --name-only` limitado a los archivos de "Archivos afectados"; ningún cambio en `api/src`, `landing-pages/src`, `inventory-manager/`, `public/`, `ops/`, `.github/`, `docker/`, `compose*.yaml`. Suma de `deploy/` con el mismo cálculo del CI, adaptado a macOS: `cd restaurante/deploy && shasum -a 256 compose.prod.yaml deploy.sh mysql/initdb/01-usuarios.sh | shasum -a 256 | cut -c1-64` debe dar `591de8e7f259073f79ff34418c8b7a3a2680d465ef3bc7378c620221455cc7f0`.
- **F3. Migración solo aditiva.** Lectura completa del `migration.sql`: solo `CREATE TABLE`, `CREATE INDEX`/`UNIQUE` sobre tablas nuevas y `ALTER TABLE <tabla nueva> ADD CONSTRAINT … FOREIGN KEY`; ningún `ALTER`, `DROP`, `RENAME` ni `MODIFY` sobre tablas existentes; cinco `CREATE TABLE` con `utf8mb4_es_0900_as_cs`. Comprobación en MySQL real: en una base desechable, `information_schema.COLUMNS`/`STATISTICS`/`TABLE_CONSTRAINTS` de las tablas existentes antes y después de aplicar la migración, diff vacío. `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url <base restaurante_test_qa049_shadow>`: sin diferencias.

### Pruebas negativas y casos límite (sondas en MySQL real, descartables)

Sondas en `restaurante/landing-pages/tests/qa-req-f-049-*.test.ts` usando `makeDatabase()` y el usuario solo DML (la única carpeta donde QA puede escribir); se borran al terminar y no se commitean.

- **S1.** 10 altas simultáneas alternando "Sal", "SAL", "sal", " Sal " → exactamente 1 éxito, el resto error por campo `name`, 1 fila activa, 1 entrada de historial.
- **S2.** Mismo SKU (`ab-1` y `AB-1`) en altas simultáneas → 1 éxito; SKU de un artículo inactivo rechazado; artículo A cambia su SKU y B intenta el anterior → rechazado; A vuelve a su SKU anterior → aceptado.
- **S3.** 5 ediciones simultáneas con la misma versión → 1 éxito, 4 `InventoryConflictError` con `version`, `updatedAt` y `updatedBy` vigentes; versión final = inicial + 1; "guardar encima" con la versión vigente registra `overwrite_after_conflict`.
- **S4.** Factores `0.355`, `1000000.000`, `0.001` guardados y leídos exactos; `0.0005`, `1000000.001`, `1e3`, `-1`, `0`, `1,5`, `abc` rechazados por campo; conversión con redondeo mitad hacia arriba en el límite (p. ej. 1 g → kg = `0.001`; 0.4 g → rechazado por "demasiado pequeña"; un caso .0005 que sube).
- **S5.** Historial: cada escritura de S1 a S4 deja exactamente su entrada en `inventory_change` (sin duplicados por reintento), con autor.
- **S6.** Búsqueda `q` con `%`, `_` y `\` literales: solo devuelve artículos que los contienen; filtros estado/tipo/categoría combinados; nombre con tildes ("Jitomate" vs "jitomate", "Cebolla" vs "cebollá" distintos).
- **S7.** Inactivar una categoría mientras otro proceso da de alta un artículo en ella, repetido 10 veces → nunca queda una categoría inactiva con un artículo activo; uno de los dos recibe `CATEGORY_IN_USE` o `CATEGORY_INACTIVE`.
- **S8.** Interbloqueos: en las carreras S1, S3 y S7 se registra cuántas veces actuó el reintento (si es observable) y que ninguna operación termina en `DatabaseUnavailableError` salvo agotamiento; ningún error expone texto de Prisma.

### Pruebas de regresión

- `npm run typecheck`, `npm run lint` (0, sin avisos) y `npm test` completo de los 3 workspaces, con MySQL desechable.
- Lint de la regla nueva: archivo de sonda temporal en `landing-pages/src/` que importa `@restaurante/core/inventory` → `npm run lint` debe fallar; borrar la sonda y repetir → 0. Además, un import desde `api/src` no debe fallar (la regla solo afecta a landings).
- Duración: `npx vitest run <archivo>` de los 3 archivos nuevos, 3 veces cada uno; cada ejecución < 20 s (referencia: 3 a 4 s el de MySQL).
- CA-14: con el diff fuera de alcance vacío (F2), la suite existente de landings, `/api/v1/public/*`, bot, productos y página es la evidencia; no se levantan pantallas en este PR.
- Blast radius con CodeGraph de `eslint.config.ts` y de los `exports` de `core` y `db` para confirmar que ningún consumidor existente cambia.

### Mutaciones (diferencial mínimo, descartable)

En una copia del árbol fuera del repo (`cp -c` de `restaurante/` del worktree, con `node_modules`, al scratchpad; clon APFS), una mutación cada vez, ejecutando solo el archivo de prueba afectado; cada una debe hacer fallar al menos una prueba permanente:

- **M1.** Quitar el `UNIQUE` de `active_name_key` en `inventory_item` (migración) y la comprobación previa del repositorio → falla la carrera de nombre de `prisma-inventory-store.test.ts`.
- **M2.** No insertar en `inventory_sku` al cambiar el SKU → falla la prueba de SKU no reutilizable.
- **M3.** Redondeo "mitad hacia abajo" en `decimal.ts` → falla `inventory-units.test.ts`.
- **M4.** `updateMany` sin la condición de `version` → falla la prueba de conflicto.
- **M5.** No escapar `%`/`_` en la búsqueda → falla la prueba de comodines.

Una mutación que sobrevive es un hallazgo (prueba insuficiente): `MINOR` si otra prueba cubre el comportamiento, `MAJOR` si ninguna lo cubre.

### Vuelta atrás (CA-15, descartable)

Entorno: MySQL desechable (ver Autorizaciones) con la base `restaurante` del contenedor de QA, no la de desarrollo. Código anterior: el árbol principal del repo (`/Users/orvigas/Desktop/Negocio/restaurante`, en `main` = `1c88e30`, ya con `node_modules`), arrancado con `node src/server.ts` y las variables en un archivo del scratchpad pasado con `--env-file=<scratch>`; **nunca** `npm start` ahí, porque carga el `api/.env` de desarrollo.

- **R1.** Migrar la base con el código de `main` (`prisma migrate deploy` con el usuario migrator), arrancar la `api` de `main`, crear datos (un producto, un usuario editor). Línea base.
- **R2.** Aplicar las migraciones del worktree (incluida la nueva) con el migrator. Insertar con el store del worktree una categoría, un artículo con empaque y un SKU (para que las tablas no estén vacías).
- **R3.** Arrancar la `api` de `main` **sin** `DATABASE_ALLOW_NEWER_SCHEMA` → debe negarse a arrancar con `DATABASE_NEWER_THAN_CODE` (log y código de salida).
- **R4.** Arrancar con `DATABASE_ALLOW_NEWER_SCHEMA=true` → arranca con el aviso `database_newer_than_code_allowed`; `GET /api/v1/public/*` de ambos negocios 200; login de admin, alta y edición de un producto, edición de datos de página y alta de un usuario 2xx (el usuario de app solo DML escribe en las tablas existentes).
- **R5.** `migrate deploy` del código de `main` sobre la base con la migración nueva presente: documentar el resultado tal cual (en el despliegue el servicio `migrate` de la imagen anterior no corre en la vuelta atrás automática; si fallara, se registra como observación con su contexto, no como defecto, y se pregunta). Opcional (pregunta 2): repetir R3–R4 con la imagen `production` construida de `1c88e30` en lugar del código.

### Respaldo y restauración (CA-16)

Sin VPS, sin R2 y sin producción. `ops/backup/ci/smoke.sh` requiere Linux (GNU coreutils, flock): no se ejecuta en el Mac; corre en el CI del PR de la épica hacia `main`.

- **B1.** Sobre la base del contenedor de QA con datos en las cinco tablas (R2 más varias escrituras con historial, un padre con variantes y un SKU cambiado), `mysqldump` dentro del contenedor con las mismas opciones que `backup.sh` (`--single-transaction --no-tablespaces --skip-lock-tables --default-character-set=utf8mb4 --hex-blob --set-gtid-purged=OFF --databases restaurante`), con un usuario de solo lectura con los mismos privilegios que `restaurante_backup` (SELECT, SHOW VIEW, TRIGGER, LOCK TABLES), creado solo en el contenedor de QA.
- **B2.** Comprobar que el volcado contiene los cinco `CREATE TABLE inventory_*` con su colación y sus `INSERT`.
- **B3.** Restaurar en un segundo contenedor desechable del mismo proyecto (o tras `DROP DATABASE` en el de QA), como hace `restore.sh` (mysql como root con el volcado).
- **B4.** Comparar conteos y `CHECKSUM TABLE` de las cinco tablas, y de `user`, `product` y `_prisma_migrations`, antes y después; arrancar la `api` del worktree sobre la base restaurada (verifica colación y migraciones).
- `verify-backup.sh --drill` pide la clave privada de age por TTY y un respaldo real de R2 o un `.tar.age`: **QA no lo ejecuta**. Lo que cubre (descifrado, manifiesto, arranque de la imagen) no cambia en este PR; recomendación: el usuario lo corre en el simulacro mensual tras desplegar la épica, con la consulta de conteos de `inventory_item` que añadirá el PR 3 a §11.8.

### Revisión de las pruebas permanentes

Para cada una de las 37 (12 + 18 + 7): protege un comportamiento de la app (catálogo, permisos, conflicto, datos) según `testing.md`, no reproduce la implementación, no hay duplicados con otra prueba, nombres de dominio sin `qa-req-f-*`, ninguna prueba de arquitectura, fronteras ni migración "por sí misma"; usan `makeDatabase()` sin leer `DATABASE_URL`; sin esperas fijas ni `retry`. Una prueba que no cumpla se informa como hallazgo `MINOR` con la recomendación de quitarla.

### Evidencia requerida

Salida resumida de cada comando (código de salida y totales), suma de `deploy/`, `git diff --name-only`, extracto del SQL, salida de `migrate diff`, diff de `information_schema`, logs de R3 y R4 y códigos HTTP, conteos y checksums de B4, resultado de cada sonda S1–S8 y de cada mutación M1–M5, duraciones por archivo y la comprobación de limpieza.

### Limpieza (comprobada, no supuesta)

- Sondas `qa-req-f-049-*` borradas del worktree; `git status` del worktree idéntico al inicial (solo los cambios del PR 1 y el ticket).
- Copia de mutaciones, archivos de env y volcados del scratchpad borrados.
- `docker compose -p restaurante-qa-049 down -v` (contenedores, volúmenes y red del proyecto); `docker ps -a`, `docker volume ls` y `docker network ls` sin restos `restaurante-qa-049`. El `mysql-dev` de desarrollo sigue como estaba (hoy apagado; Docker sin contenedores en marcha al planificar).
- Procesos `node`/`vitest` de la `api` de `main` detenidos y puertos libres (`lsof -i :3307` y los de la `api`).
- Bases `restaurante_test*` inexistentes al final (se van con el volumen de QA).
- `git worktree list` sin worktrees nuevos; el árbol principal en `main` sin cambios (`git status`).
- Si se instalan `node_modules` o el cliente generado en el worktree (`npm ci`, `db:generate`), se dejan (los necesita el PR) o se borran según indique el usuario; se informa.

### Criterios de aprobación

`QA_APPROVED` solo si: F1–F3 sin desviaciones relevantes; suma de `deploy/` igual; migración solo aditiva demostrada en MySQL; CA-1 a CA-9 y CA-13 (alcance del PR 1) en PASS; CA-15 (R3 y R4) y CA-16 (B4) en PASS; `typecheck`, `lint` y `npm test` en 0; S1–S8 sin duplicados ni pérdida de precisión; M1–M5 detectadas; cada archivo nuevo < 20 s; sin `BLOCKER` ni `CRITICAL`, y cada `MAJOR` aceptado por el usuario. Escala de defectos: la del agente (`BLOCKER`, `CRITICAL`, `MAJOR`, `MINOR`, `TRIVIAL`), justificada por impacto observable. Ejemplos: duplicado posible en carrera o vuelta atrás que no arranca = `CRITICAL`; pérdida de precisión = `CRITICAL`; mutación sin prueba que la detecte = `MAJOR`; desviación documental = `MINOR`.

### Autorizaciones que se piden al usuario

1. Docker local: `docker compose -p restaurante-qa-049 up -d --wait mysql-dev` con el `compose.yaml` del worktree (volumen propio, `127.0.0.1:3307`). Requiere que el `mysql-dev` de desarrollo siga apagado (si estuviera encendido, QA se detiene y pregunta). Un segundo contenedor del mismo proyecto para B3, si hace falta.
2. `npm ci` y `npm run db:generate` en el worktree, si no tiene `node_modules` o el cliente de Prisma.
3. Ejecutar la `api` de `main` desde el árbol principal (solo lectura del código) contra el MySQL de QA, con variables en el scratchpad.
4. Crear sondas temporales en `restaurante/landing-pages/tests/` del worktree (se borran) y una copia del árbol en el scratchpad para las mutaciones.
5. Escribir en el ticket del worktree solo `## Estado`, este QA Action Plan, el QA Report y el Historial.

### Preguntas abiertas (con recomendación)

1. ¿El simulacro `verify-backup.sh --drill` lo hace el usuario? **Recomendado:** sí, tras desplegar la épica a producción (no en este PR); QA cubre CA-16 con B1–B4.
2. ¿Vuelta atrás con el código de `main` o también con la imagen `production` construida de `1c88e30`? **Recomendado:** solo con el código (mismo código que la imagen; ahorra tiempo y créditos); la imagen, en el QA del PR de la épica hacia `main`.
3. ¿`node_modules` y el cliente generado del worktree se conservan al terminar? **Recomendado:** conservarlos hasta el commit del PR 1 (los usa senior-fullstack) y que se borren con el worktree.
4. Nombre de variante único en todo el catálogo: ¿se acepta como lo dice RF-2 o se quiere único por padre? **Recomendado:** aceptarlo en T1 (es lo que dice RF-2) y revisarlo en E2 si hace falta; QA no lo trata como defecto.

**Aprobado por el usuario** ("si a las dos"), con las cuatro recomendaciones.

## QA Report — PR 1

### Ronda

1 (2026-11-18). Worktree `agent-a695af6eae346107d`, rama `feature/REQ-F-049-catalogo-modelo` sobre `1c88e30`, sin commit. CodeGraph no indexa el worktree: lecturas dirigidas con Read y Grep. MySQL desechable `docker compose -p restaurante-qa-049` (`127.0.0.1:3307`); el `mysql-dev` de desarrollo estaba apagado y siguió apagado.

### Pruebas ejecutadas

- `npm run build:css` 0; `npm run typecheck` 0; `npm run lint` 0 (sin avisos); `npm test` 0: api 51 archivos / 1196 pruebas, landing-pages 61 / 894, inventory-manager 16 / 278.
- F1/F2: `git diff --name-only` = solo los archivos de "Archivos afectados" (más el ticket); `package-lock.json` sin cambios; `package.json` de `core` y `db` solo con un `exports` nuevo cada uno; suma de `deploy/` = `591de8e7f259073f79ff34418c8b7a3a2680d465ef3bc7378c620221455cc7f0` (igual).
- F3: SQL con solo cinco `CREATE TABLE` (`utf8mb4_es_0900_as_cs`), sus índices y FK desde tablas nuevas (una hacia `user`, sin alterarla); `DECIMAL(13, 3)` en `factor`, sin `FLOAT`/`DOUBLE`. `prisma migrate diff --from-migrations … --to-schema …`: "No difference detected". `information_schema` (columnas, índices, restricciones, colación) de las tablas existentes antes y después de migrar: idéntico; solo aparecen las cinco tablas nuevas.
- Sondas MySQL (descartables, borradas): S1 10 altas simultáneas "Sal/SAL/sal/␣Sal␣" → 1 ok + 9 error por campo `name`, 1 fila, 1 historial. S2 6 altas con `ab-1/AB-1…` → 1 ok + 5 `sku`; SKU de inactivo rechazado; SKU liberado rechazado en otro artículo; volver al propio aceptado. S3 5 ediciones con la misma versión → 1 ok + 4 `InventoryConflictError` con versión 2 y autor; "guardar encima" → historial `create, update, overwrite_after_conflict`. S4 factores `0, -1, abc, 1,5, 0.0005, 1000000.001, 1e3, ""` → error en `units.0.factor`, 0 filas; 1 g = 0.001, 1.5 g = 0.002, 2.5 g = 0.003, 0.5 g = 0.001 (mitad hacia arriba), 500 g = 0.500, 2 bultos = 50.000; 0.4 g y pza→kg rechazados. S6 `%`, `_`, `l_f` y `\` literales; "JITOMATE" encuentra "Jitomate"; "cebollá" ≠ "Cebolla"; filtros tipo y categoría combinados. S7 10 rondas inactivar categoría vs. alta → nunca categoría inactiva con artículo activo. S8 ninguna operación terminó en `DatabaseUnavailableError` en las carreras.
- Duración: los 3 archivos nuevos (+ sondas), 3 veces: MySQL 3.9 a 4.7 s; unitarias ~0.14 s. Todo < 20 s.
- Lint de la regla nueva: import estático y dinámico de `@restaurante/core/inventory` en `landing-pages/src` → error; en `api/src` → sin error (sondas borradas).

### Criterios de aceptación

| CA | Resultado | Evidencia |
| --- | --- | --- |
| CA-1 | PASS (dominio y persistencia) | unitaria de alta; historial `create` con autor en MySQL (S3, prueba de lista y ficha) |
| CA-2 | PASS | unitaria; S1; prueba de clave única; M1 detectada |
| CA-3 | PASS | unitaria; S2; M2 detectada |
| CA-4 | PASS | `inventory-units.test.ts`; 2 bultos = 50 en S4 |
| CA-5 | PASS | `inventory-units.test.ts`; S4 |
| CA-6 | PASS | unitarias; S4 (error por campo `units.0.factor`) |
| CA-7 | PASS | unitarias de padres y variantes; lista con `variantCount` en MySQL |
| CA-8 | PASS | unitaria de lista; MySQL (inactivos, todos, búsqueda) |
| CA-9 | PASS | unitaria; prueba MySQL y S3; M4b detectada (ver DEF-001) |
| CA-13 | PASS | unitaria; carrera de categoría en MySQL y S7 |
| CA-15 | PASS | R1 base con migraciones de `main` + `api` de `main` (público 200, login, alta de usuario, edición de producto y de página 2xx). R2 migración nueva + datos en las 5 tablas. R3 `api` de `main` sin la variable → salida 1 con `DATABASE_NEWER_THAN_CODE` (`20261119004332_inventario_catalogo`). R4 con `DATABASE_ALLOW_NEWER_SCHEMA=true` → aviso `database_newer_than_code_allowed`; `/api/v1/public/{molotes,birria}/{productos,pagina}` 200; login 201, alta de usuario 201, edición de producto 200, guardado de página 200 (usuario solo DML). R5 `migrate deploy` de `main` sobre la base nueva: "No pending migrations to apply", sin error. |
| CA-16 | PASS | `mysqldump` con las opciones de `backup.sh` y un usuario con los privilegios de `restaurante_backup`; volcado con los 5 `CREATE TABLE inventory_*` y sus `INSERT`; `DROP DATABASE` y restauración como `restore.sh`; `CHECKSUM TABLE` de las 5 tablas, `user`, `product`, `page_version` y `_prisma_migrations` idéntico; conteos 4/3/3/7/1 iguales; `api` del worktree arranca sobre la restaurada sin la variable; lectura: factor `0.355`, SKU vigente `MASA-2`, búsqueda por el SKU anterior, historial y `variantCount` conservados. `--drill`: lo hace el usuario tras desplegar la épica (P1). |
| CA-14 | PASS (alcance del PR 1) | suite completa en verde; diff sin cambios en rutas, landings, bot, productos ni página; R4 con la `api` de `main` |
| CA-10, CA-11, CA-12, CA-17 | No aplica a este PR | PR 2 y PR 3 |

### Defectos encontrados

### DEF-001
- Severidad: `MINOR`
- Criterio de aceptación afectado: CA-9 (cobertura de pruebas, no comportamiento)
- Descripción: la condición `version` del `updateMany` de `replaceItem` en `prisma-inventory-store.ts` no la protege ninguna prueba: quitarla (M4) deja las 7 pruebas de MySQL en verde, porque el repositorio ya compara la versión dentro de la transacción `Serializable`.
- Pasos para reproducir: en una copia del árbol, cambiar `where: { id: item.id, version: expectedVersion }` por `where: { id: item.id }` y ejecutar `prisma-inventory-store.test.ts`.
- Resultado esperado: alguna prueba falla.
- Resultado actual: 7/7 en verde. Quitar la comprobación del repositorio (M4b) sí falla (1 prueba en MySQL y 1 unitaria), y quitar ambas (M4c) también.
- Evidencia: salidas de M4, M4b y M4c en esta ronda.
- Impacto: ninguno observable hoy (CA-9 se cumple y está protegido por el repositorio); la segunda defensa podría perderse sin aviso en un refactor.
- Recomendación: aceptar como está o cubrir la condición del store con una prueba dirigida en la prueba de MySQL existente; decisión de senior-fullstack/usuario, no bloquea.
- Decisión: **aceptado sin cambios** (T4 del PR 1).

### Mutaciones

M1 (sin `UNIQUE` en `active_name_key`) detectada: 1 fallo. M2 (sin registro de SKU) detectada: 2 fallos. M3 (redondeo mitad hacia abajo) detectada: 2 fallos en `inventory-units.test.ts` (en `inventory-catalog.test.ts` no, como es de esperar). M4 (sin `version` en el UPDATE) **no detectada** (DEF-001). M4b (sin comprobación del repositorio) detectada. M5 (sin escapar comodines) detectada: 1 fallo.

### Regresión

Suite completa en verde en los 3 workspaces; lint y typecheck en 0; R4 confirma que el código de `main` funciona sobre la base migrada.

### Revisión de pruebas permanentes

Las 37 protegen comportamientos del catálogo (unidades, conversión, nombres, SKU, conflicto, padres, categorías, lista) y garantías de la base (claves únicas en carrera, decimales exactos, comodines); nombres de dominio, sin `qa-req-f-*`, sin esperas fijas ni `retry`, con `makeDatabase()`. Ninguna es de arquitectura. Algunas reglas (CA-2, CA-3, CA-9) se prueban en memoria y en MySQL, pero la de MySQL comprueba la garantía de la base ante carreras, no la regla: se aceptan.

### Responsive / Accesibilidad / UX/UI / SEO / Performance

No aplica a este PR (sin pantallas). Performance: lista con `count` + página y una consulta agrupada para variantes (sin N+1), revisado en el código.

### Observaciones (no defectos)

- Nombre de variante único en todo el catálogo (RF-2), aceptado por el usuario (P4).
- S7 resolvió siempre con la inactivación rechazada (`CategoryInUseError`/ok); el invariante se cumple, el otro orden no se observó en 10 rondas.
- T3 deberá crear la fila de saldo en el alta del artículo.

### Pendientes de revisión manual

- Simulacro `verify-backup.sh --drill` tras desplegar la épica (usuario, P1).

### Limpieza

Sonda `qa-req-f-049-sondas.test.ts` y sondas de lint borradas; copia de mutaciones (`scratchpad/mut`), env, logs y volcados borrados; `docker compose -p restaurante-qa-049 down -v` (contenedor, volumen y redes eliminados); 0 bases `restaurante_test*` antes del borrado; sin procesos `server.ts`/`vitest` ni puertos 3191, 3192 y 3307 en escucha; `restaurante-mysql-dev-1` sigue apagado como estaba; `git status` del worktree igual al inicial (más el ticket); `git worktree list` sin worktrees nuevos; árbol principal sin cambios. `node_modules` y cliente generado del worktree conservados (P3).

### Resultado final

QA_APPROVED

## Implementation Result — PR 2

### Rama

`feature/REQ-F-049-gerente-api`, desde `origin/epic/inventario` (`84f0a9a`). Sin commit ni PR (pendiente de aprobación). El nombre es el que pidió la sesión principal; el plan proponía `feature/REQ-F-049-catalogo-api`.

### Cambios realizados

- **Migración `20261119120000_rol_gerente`** (`packages/db/prisma/migrations/…/migration.sql`) y `enum Role` en `schema.prisma`: `ALTER TABLE `user` MODIFY `role` ENUM('admin', 'editor', 'gerente') NOT NULL;`. Valor al final del ENUM: aditiva, sin reconstruir la tabla. Columna resultante: `enum('admin','editor','gerente')`, `utf8mb4_es_0900_as_cs`. `verifyDatabase` de la rama arranca sobre ella.
- **Identidad** (`packages/core/identity`): `ROLES` y `ROLE_LABELS` con `gerente`; `validateUserData` guarda negocios solo del editor; `authorization.ts` con `canManageInventory` (admin o gerente) y `allowedBusinesses` explícito por rol (gerente: ninguno). `packages/db/src/user-repository.ts`: negocios solo del editor en `createUser` y `diffUser` (pasar un editor a gerente borra sus negocios y sube `sessionVersion`).
- **Contratos** (`packages/contracts`): `admin.ts` con `USER_ROLES` (subido antes de `adminUserSchema`, que ahora lo usa) e `INVENTORY_ROLES`; `inventory.ts` nuevo (listas cerradas, códigos, `inventoryPaths`, DTO de lista, artículo, ficha, historial, conversión y categorías, cuerpos de petición; cantidades y factores como texto decimal); `admin-client.ts` con 11 métodos de inventario.
- **API** (`api/src/admin`): `access.inventory()` (401 → 403 `FORBIDDEN_ROLE` "No tienes permiso para gestionar el inventario." → CSRF); `inventory-routes.ts` con las 12 rutas del plan bajo `/api/v1/admin/inventario`, registradas antes de `/:business/...` (`router.ts`); cuerpos cerrados de 16 KiB; ids con `^[1-9]\d{0,9}$` (otro → 404); 422 por campo (en la lista y la conversión con los nombres de la query: `estado`, `tipo`, `categoria`, `pagina`, `cantidad`); 409 `VERSION_CONFLICT` con `current`, `ITEM_LOCKED`, `ITEM_HAS_ACTIVE_VARIANTS`, `ITEM_NAME_TAKEN`, `PARENT_INACTIVE`, `CATEGORY_INACTIVE`, `CATEGORY_IN_USE`, `CATEGORY_NAME_TAKEN`; 422 con el código de `UnitConversionError` (`UNIT_CONVERSION_UNAVAILABLE`, …); "guardar encima" con `overwrite: true`; altas idempotentes con `Idempotency-Key` (ámbitos `inventario-articulos` e `inventario-categorias`); logs solo con ids, acción y códigos. `index.ts` y `server.ts`: repositorio de core sobre `createPrismaInventoryStore`, sin semilla.
- **inventory-manager** (`src/views/users.ts`): opción "Gerente" en el rol, etiqueta, ayuda ("El gerente gestiona el inventario; no accede a productos, página, usuarios, bot ni cotizador.") y negocios "No aplica" en la ficha.

Desviaciones del plan:

- **Redirección del inicio del gerente a `/inventario/articulos`: no hecha.** El plan la asigna al PR 3 ("navegación e inicio") y la ruta SSR no existe todavía: redirigir ahí daría 404. Con el PR 2, un gerente que entra al admin ve "Elige un negocio" vacío; la API ya le da acceso al inventario.
- La sesión del gerente (`sessionVersion`) no necesitó código nuevo: desactivar, cambiar el rol o los negocios ya la invalidan (REQ-F-040); queda cubierto con pruebas.
- El detalle del artículo devuelve `{ item, history }` con la categoría, el padre, las variantes, `locked` y las equivalencias dentro de `item`.
- En la edición se lee el cuerpo antes de comprobar que el artículo existe (productos lo hace al revés); un id inexistente con un cuerpo válido da 404 igual.

### Criterios de aceptación (alcance del PR 2: API y rol; pantallas de inventario en el PR 3)

- CA-9 (en la API): cumplido (409 con los datos vigentes, el primer cambio se conserva, "guardar encima" registrado).
- CA-10 (API): cumplido (editor con 403 `FORBIDDEN_ROLE` en las 12 rutas, sin escribir nada). La parte del admin (no ver "Inventario") es del PR 3.
- CA-11 (API y usuarios): cumplido (un administrador crea un gerente; entra y accede al inventario; 403 en usuarios, bot, cotizador, productos y página).
- CA-1, CA-2, CA-4, CA-5, CA-6, CA-7 y CA-13: expuestos por la API con los códigos del plan (reglas probadas en el PR 1).
- CA-15 (para esta migración, evidencia de sonda no commiteada contra el código de `main` en la base migrada): `verifyDatabase` de `main` da `DATABASE_NEWER_THAN_CODE` sin `allowNewerSchema` y arranca con él. Con un gerente guardado, el cliente Prisma de `main` rechaza la fila (`P2023`, "Value 'gerente' not found in enum 'Role'") y el repositorio lo convierte en `DatabaseUnavailableError`: `list()`, `findById(gerente)` y `findCredentials(gerente)` fallan (503 en la lista de usuarios y en el acceso del gerente); `findById(admin)` y `hasUsers()` funcionan. Es el riesgo DT-2: la vuelta atrás automática del despliegue de la épica no lo sufre (aún no hay gerentes); la vuelta atrás a mano con gerentes exige el procedimiento de `despliegue.md`, que se documenta en el PR 3.
- CA-3, CA-8, CA-12, CA-14, CA-16 y CA-17: PR 3 y QA.

### Validaciones ejecutadas

- `npm run build:css`: 0. `npm run typecheck`: 0. `npm run lint`: 0, sin avisos.
- `npm test`: api 52 archivos y 1208 pruebas; landing-pages 61 y 895; inventory-manager 16 y 278. Todo en verde.
- Duración: `admin-inventory-api.test.ts` 1.3 s (12 pruebas); `user-repository.test.ts` (MySQL) 3.5 s.

### Archivos afectados

Nuevos: `restaurante/api/src/admin/inventory-routes.ts`, `restaurante/packages/contracts/inventory.ts`, `restaurante/packages/db/prisma/migrations/20261119120000_rol_gerente/migration.sql`, `restaurante/api/tests/integration/admin-inventory-api.test.ts`.

Modificados: `restaurante/api/src/admin/{access,index,router}.ts`, `restaurante/api/src/server.ts`, `restaurante/api/tests/support/admin.ts`, `restaurante/api/tests/unit/contract-types.test.ts`, `restaurante/inventory-manager/src/views/users.ts`, `restaurante/landing-pages/tests/integration/user-repository.test.ts`, `restaurante/packages/contracts/{admin,admin-client,index}.ts`, `restaurante/packages/core/identity/{authorization,user-schema}.ts`, `restaurante/packages/db/prisma/schema.prisma`, `restaurante/packages/db/src/user-repository.ts`.

Pruebas permanentes: `admin-inventory-api.test.ts` (nuevo: 401, 403 del editor, CSRF, gerente con acceso al inventario y 403 en el resto, alta de un gerente por un administrador, sesión invalidada al desactivarlo, alta con ficha, lista y conversión, 422 y 404, 409 y "guardar encima", alta idempotente, 409 de variantes, categoría en uso y padre inactivo, 503); `user-repository.test.ts` (un caso nuevo en MySQL: el ENUM acepta `gerente`, sin negocios, y pasar un editor a gerente borra sus negocios y cierra sus sesiones); `contract-types.test.ts` (ampliado: listas cerradas del inventario iguales a las de core); doble de usuarios de `api/tests/support/admin.ts` ajustado a "negocios solo del editor".

- **DEF-002 corregido (T3):** caso nuevo en `user-repository.test.ts` (MySQL): "cambiar solo el rol, sin negocios de por medio, cierra las sesiones (gerente -> admin -> gerente)"; la mutación X3a (quitar `'role' in changes` de `closesSessions`) ahora hace fallar ese caso; código restaurado (mismo hash), sin cambios de producción.

### Riesgos o pendientes

- **DT-2 (conocido):** una vuelta atrás a mano a una imagen anterior a la épica con gerentes ya creados rompe la lista de usuarios y el acceso de los gerentes en esa `api` (evidencia arriba). Mitigación: procedimiento de `despliegue.md` §6 (degradar los gerentes a editor sin negocios con `session_version + 1`, anotarlos), que se escribe en el PR 3.
- En local, una base migrada con esta rama exige `DATABASE_ALLOW_NEWER_SCHEMA=true` para la `api` de `main` (se documenta en el PR 3).
- Sin pantallas de inventario, navegación ni redirección del gerente (PR 3).
- Limpieza: sonda temporal contra el código de `main` borrada; 0 bases `restaurante_test*`; MySQL de desarrollo detenido con `npm run db:down`; sin procesos ni worktrees adicionales.

## QA Action Plan — PR 2

### Objetivo

Validar, sin commit ni PR, la rama `feature/REQ-F-049-gerente-api` (desde `epic/inventario` = `84f0a9a`): el rol Gerente (migración, core, db, contratos y opción en usuarios) y las 12 rutas de la API del inventario, con sus permisos, errores, concurrencia, vuelta atrás y respaldo, sin regresiones. La implementación y la desviación (la redirección del gerente pasa al PR 3) están aprobadas por el usuario ("Si, apruebo").

### Requisito bajo prueba

RF-9 (permisos), PV-1, DT-2 y el contrato "Backend: contratos y endpoints" del Technical Action Plan; CA-10, CA-11, CA-14, CA-15 y CA-16 en el alcance del PR 2; CA-9 y la idempotencia de CA-8 por HTTP.

### Criterios de aceptación (cada uno → pruebas que lo cubren)

| CA | Alcance del PR 2 | Pruebas |
| --- | --- | --- |
| CA-10 | Editor: 403 en las 12 rutas de la API, sin escribir nada | P1–P4, X1, X4 |
| CA-11 | Un admin crea un gerente; entra; accede al inventario y no a usuarios, bot, cotizador, productos ni página | P1, P5–P8, U1, X2, X3 |
| CA-9 / CA-8 (HTTP) | 409 con `current` y "guardar encima"; alta idempotente | E2, E5, C1, C2, X5, X6 |
| CA-14 | Landings, `/api/v1/public/*`, bot, productos, página y usuarios igual que antes | F2, G1–G4, P6 |
| CA-15 | La `api` de `main` sobre la base migrada (sin gerentes) y el riesgo DT-2 con gerentes | V1–V6 |
| CA-16 | Respaldo y restauración con el ENUM ampliado y gerentes | B1–B4 |

**No aplica a este PR** (PR 3): CA-10 en pantalla ("Inventario" oculto en el menú), redirección del gerente a `/inventario/articulos`, CA-12 (semilla), CA-17 (pantallas de inventario), documentación de DT-2 en `despliegue.md`, cadena de punta a punta, responsive/SEO/performance de pantallas nuevas. Con el PR 2 el gerente ve "Elige un negocio" vacío: es lo aprobado, no un defecto.

### Riesgos identificados

1. Ruta de inventario registrada después de `/:business/...` o sin `access.inventory` (fuga a editores o 404 inesperado).
2. Orden de comprobaciones: CSRF antes del rol daría `CSRF_INVALID` a un editor (filtra que la ruta existe y rompe el contrato).
3. El gerente hereda acceso a productos/página por `allowedBusinesses` o por una comprobación "no editor".
4. Sesión del gerente no invalidada al desactivarlo o cambiar rol/negocios.
5. Escritura parcial en un 403/422/409 (historial o idempotencia guardados antes del rechazo).
6. Idempotencia por proceso: dos altas concurrentes con la misma clave crean dos artículos o devuelven 500.
7. ALTER del ENUM que reconstruye `user` o la bloquea (el despliegue migra con la `api` en marcha).
8. Errores 503 que filtran el `message` de Prisma o SQL; logs con nombres o cuerpos.
9. Vuelta atrás con gerentes (DT-2) peor que lo descrito (p. ej. que también caiga el login de admins).

### Revisión estática (F)

- **F1.** `git diff --stat` y `git status` del worktree contra `84f0a9a`: solo los archivos listados en "Implementation Result — PR 2" más el ticket; nada en landings, bot, `public/`, `deploy/`, `ops/`, `.github/` ni `docs/`.
- **F2.** Diff completo frente al TAP: tabla de rutas (método, ruta, códigos), `access.inventory` (401 → 403 `FORBIDDEN_ROLE` → CSRF), registro antes de `/:business`, cuerpos cerrados de 16 KiB, ids `^[1-9]\d{0,9}$`, texto decimal en contratos, `toAdminUser` con `businesses: []`, `canManageInventory` y `allowedBusinesses` del gerente vacío. Reglas: `typescript.md` (sin `any`, `as` y `!` justificados, imports `.ts`), `manejo-de-errores.md` (formato central, sin detalles internos), `frontend-backend.md` (contratos en `packages/contracts`, el cliente usa los mismos esquemas, sin duplicar tipos), `logging.md` (solo ids, acción y códigos).
- **F3.** `dependencias.md`: `package.json` y `package-lock.json` sin cambios.
- **F4.** Suma de `deploy/` con el método de `ci.yml`: `cd restaurante/deploy && shasum -a 256 -- compose.prod.yaml deploy.sh mysql/initdb/01-usuarios.sh | shasum -a 256 | cut -c1-64` (equivalente a `sha256sum` en macOS) = `591de8e7f259073f79ff34418c8b7a3a2680d465ef3bc7378c620221455cc7f0`.

### Migración (M), en el MySQL 8.4 de QA

- **M1.** El SQL de `20261119120000_rol_gerente` es una sola sentencia `ALTER TABLE \`user\` MODIFY \`role\` ENUM('admin','editor','gerente') NOT NULL` (valor añadido al final, mismo `NOT NULL`, sin cambio de colación/charset ni de valor por defecto).
- **M2.** Algoritmo real: base con las migraciones de `84f0a9a` y filas en `user` (admin, editor con negocios, inactivo). Antes y después de `migrate deploy`: `TABLE_ID` y `TOTAL_ROW_VERSIONS` de `information_schema.INNODB_TABLES` para `restaurante/user` (mismo `TABLE_ID` = sin reconstrucción). Además, en una base gemela, la misma sentencia con `, ALGORITHM=INSTANT` y con `, ALGORITHM=INPLACE, LOCK=NONE` debe aceptarse; y con una transacción abierta que lee y otra que escribe en `user` en paralelo, el ALTER no bloquea esas sesiones más allá del bloqueo de metadatos breve (se registra el tiempo).
- **M3.** Filas intactas: `CHECKSUM TABLE user` y `SELECT id, role, session_version, …` antes/después idénticos; `SHOW CREATE TABLE user` solo cambia la definición del ENUM.
- **M4.** `prisma migrate diff --from-url <base migrada> --to-schema-datamodel packages/db/prisma/schema.prisma --exit-code` → 0 (sin diferencias), y `migrate status` "up to date".

### Permisos contra la API real y MySQL (P)

Entorno: la `api` del worktree con stores de Prisma sobre una base `restaurante_test_*` del MySQL de QA, arrancada con `node src/server.ts --env-file=<scratchpad>` en un puerto libre de `127.0.0.1`; peticiones con un script `fetch` del scratchpad (login, cookie y token CSRF como el cliente real). Usuarios: admin, editor (con negocio), gerente, y un gerente creado por el admin vía `POST /usuarios`.

- **P1.** Matriz de las 12 rutas × {sin sesión, editor, gerente, admin}: 401 / 403 `FORBIDDEN_ROLE` (mensaje exacto) / 2xx o el error de dominio esperado / ídem. Las escrituras del editor se envían **con** CSRF válido (para aislar el rol).
- **P2.** Orden: editor sin CSRF en una escritura → `FORBIDDEN_ROLE` (no `CSRF_INVALID`); gerente sin CSRF o con uno ajeno → 403 `CSRF_INVALID`, sin escribir.
- **P3.** Sin escritura en 403: conteos y `CHECKSUM TABLE` de las 5 tablas `inventory_*` y del almacén de idempotencia antes/después de toda la matriz del editor y de los `CSRF_INVALID`.
- **P4.** Logs del rechazo: sin cuerpo ni nombres.
- **P5.** CA-11: el admin crea un gerente con negocios en el cuerpo → 201, `businesses: []` en la respuesta y en la base; el gerente hace login y lista/crea en el inventario.
- **P6.** El gerente recibe 403 en usuarios (lista, alta, edición), bot (estado y cambio), cotizador, productos y página de **ambos** negocios (lectura y escritura), y en "mi cuenta" conserva lo que hoy tiene un editor (cambio de su propia contraseña), sin regresión para admin y editor en esas mismas rutas.
- **P7.** `sessionVersion`: con sesión abierta del gerente, el admin (a) lo desactiva, (b) lo pasa a editor, (c) pasa un editor con sesión a gerente → la siguiente petición de esa sesión da 401; `session_version` sube en la base. Cambiar solo los negocios de un gerente (ignorados) no debe cerrar su sesión ni guardar negocios.
- **P8.** Editor → gerente borra sus filas de negocios en la base (consulta directa).

### Contrato de errores y códigos HTTP (E)

- **E1.** Por ruta: 422 con `fields` (cuerpo inválido, filtro fuera de la lista cerrada, `q` > 80, `pagina` 0/negativa/no numérica, cantidad inválida en conversión, nombre/SKU repetido como error de campo).
- **E2.** `PUT` con versión vieja → 409 `VERSION_CONFLICT` con `current { id, version, updatedAt, updatedBy }` real; el primer cambio se conserva; "guardar encima" (`overwrite: true`) lo aplica y queda en el historial.
- **E3.** 404 con ids `0`, `-1`, `01`, `abc`, `1e3`, 11 dígitos, `%20` y uno inexistente válido, en GET, PUT y las acciones.
- **E4.** Cuerpo: JSON no cerrado (campo extra) → 422; > 16 KiB → 413 (o el código central vigente); `Content-Type` no JSON y JSON malformado → código del manejador central, sin stack.
- **E5.** Alta con la misma `Idempotency-Key` dos veces seguidas → mismo 201 y un solo artículo; misma clave con otro cuerpo → el comportamiento del alta de productos (se documenta tal cual); sin clave → según el contrato.
- **E6.** 503: con MySQL detenido (`docker compose -p … stop`) una lectura y una escritura dan 503 con el formato central y sin texto de Prisma/SQL; al volver la base, la `api` se recupera sin reiniciar.
- **E7.** Ningún cuerpo de error ni log contiene SQL, stack, rutas de archivo, `DATABASE_URL`, nombres de artículos o cuerpos (búsqueda en la salida capturada).

### Concurrencia y robustez (C), con la `api` real

- **C1.** 10 rondas de dos `POST articulos` simultáneos con la misma `Idempotency-Key` y cuerpo → un artículo, ambas respuestas 201 iguales o una 201 y una respuesta definida por el contrato; nunca 500 ni duplicado.
- **C2.** 10 rondas de dos `PUT` simultáneos con la misma versión → un 200 y un 409 con `current`.
- **C3.** Inactivar una categoría mientras otro alta la usa → el invariante de CA-13 (nunca categoría inactiva con artículos activos), sin 500.
- **C4.** Lista: `pagina` enorme → lista vacía con `total`; filtros repetidos (`?estado=a&estado=b`) → 422 o el primero, documentado; `q` con `%`, `_` y Unicode.

### Vuelta atrás (V; CA-15 automática y DT-2 manual)

Código anterior: el árbol principal `/Users/orvigas/Desktop/Negocio/restaurante` en `main`, solo lectura, con `node src/server.ts --env-file=<scratchpad>` (nunca `npm start` ni su `api/.env`). Base: la del MySQL de QA.

- **V1.** Base con las migraciones de `epic/inventario` + la nueva, con admin y editor y **sin** gerentes.
- **V2.** `api` de `main` sin `DATABASE_ALLOW_NEWER_SCHEMA` → sale con `DATABASE_NEWER_THAN_CODE` (log y código de salida).
- **V3.** Con `DATABASE_ALLOW_NEWER_SCHEMA=true` → arranca; `/api/v1/public/{molotes,birria}/{productos,pagina}` 200; login de admin y editor; lista y alta de usuario; edición de producto y de página 2xx (CA-15 automática).
- **V4.** DT-2: con la `api` del worktree se crea un gerente; con la de `main`: lista de usuarios 503, login y `findById` del gerente 503, sin detalles internos; rutas públicas, login de admin/editor, productos y página siguen 2xx. Cualquier efecto más amplio que lo descrito = defecto.
- **V5.** Mitigación: `UPDATE user SET role='editor', session_version=session_version+1 WHERE role='gerente';` → con la `api` de `main` la lista de usuarios vuelve a 200, el exgerente entra sin negocios (sin acceso) y su sesión anterior queda cerrada; el ENUM con `gerente` sigue en la base sin efectos.
- **V6.** Avance de nuevo a la `api` del worktree: arranca sin la variable y el rol se restaura con `PUT /usuarios`.

### Respaldo y restauración (B; CA-16)

Igual que B1–B4 del PR 1 (opciones de `backup.sh`, usuario con los privilegios de `restaurante_backup` solo en el contenedor de QA, restauración como `restore.sh`), sobre una base con gerentes, artículos, variantes, categorías e historial creados por la API:

- **B1.** `mysqldump` → el volcado contiene `enum('admin','editor','gerente')` y las filas de gerente.
- **B2.** Restauración en otra base/contenedor.
- **B3.** `CHECKSUM TABLE` y conteos iguales de `user`, `user_business` (o su tabla de negocios), las 5 `inventory_*` y `_prisma_migrations`.
- **B4.** La `api` del worktree arranca sobre la restaurada sin la variable; el gerente hace login y lee una ficha con su historial.
- `verify-backup.sh --drill`: lo hace el usuario tras desplegar la épica (no en este PR).

### Mutaciones (X), descartables

En una copia APFS (`cp -c`) de `restaurante/` del worktree en el scratchpad, una a una, ejecutando solo los archivos afectados (`admin-inventory-api.test.ts`, `admin-users-api.test.ts`, `user-repository.test.ts`, `authorization`/`user-schema` unitarias):

- **X1.** `inventory()` sin la comprobación de rol.
- **X2.** `canManageInventory` siempre `true`.
- **X3.** Cambiar el rol no cierra sesiones (`closesSessions` sin el rol) y, aparte, el gerente con `allowedBusinesses` = todos.
- **X4.** Escrituras del inventario sin CSRF.
- **X5.** Alta sin idempotencia.
- **X6.** 409 sin `current`.
- **X7.** Editor → gerente conserva negocios.

Una mutación que sobrevive es un hallazgo: `MAJOR` si ninguna prueba cubre ese comportamiento, `MINOR` si otra lo cubre indirectamente.

### Regresión (G)

- **G1.** Desde `restaurante/` del worktree: `npm run build:css`, `npm run typecheck`, `npm run lint` y `npm test` (3 workspaces) en 0.
- **G2.** `admin-inventory-api.test.ts` y `user-repository.test.ts` en 3 ejecuciones aisladas, cada una < 20 s.
- **G3.** CA-14: diff sin cambios en landings, `/api/v1/public/*`, bot, productos ni página (F1/F2) + suite verde + V3 y P6 para admin y editor.
- **G4.** Revisión de las pruebas permanentes nuevas o cambiadas según `testing.md`: funcionales (permisos, sesión, conflicto, idempotencia, rol en MySQL), sin duplicar otra prueba, sin arquitectura ni migración "por sí misma", nombres de dominio, sin esperas fijas ni `retry`, `listenLocal`/`startAdmin` y `makeDatabase()`. El caso de 503 y el de contratos (`contract-types.test.ts`) se revisan con lupa por si son de arquitectura. Una que no cumpla → `MINOR` con la recomendación de quitarla.

### Pantalla de usuarios (U)

- **U1.** Con el doble de la API de `inventory-manager` (o el entorno local de QA con la `api` del worktree): alta y edición con rol "Gerente": opción visible, texto de ayuda, negocios "No aplica" en la ficha, el formulario envía `gerente` y pinta los `fields` de un 422.
- **U2.** Accesibilidad básica del formulario: `label` asociado al selector de rol, ayuda referenciada (`aria-describedby` o texto contiguo), orden de tabulación, foco visible y funcionamiento sin JavaScript (SSR). Captura a 375 px y 1440 px si se usa el navegador; si Claude in Chrome no responde, se valida con el HTML renderizado y queda como revisión manual (ningún CA depende solo de ello).

### Evidencia requerida

Salida resumida (código de salida y totales) de cada comando; suma de `deploy/`; `git diff --name-only`; SQL de la migración; `INNODB_TABLES` antes/después; salida de `migrate diff`; matriz P1 con códigos; conteos/checksums de P3 y B3; logs de V2–V5; resultados de C1–C4 y X1–X7; duraciones de G2; comprobación de limpieza.

### Limpieza (comprobada, no supuesta)

`docker compose -p restaurante-qa-049b down -v` y `docker ps -a`, `docker volume ls`, `docker network ls` sin restos; `restaurante-mysql-dev-1` como estaba (apagado); sin procesos `server.ts`/`vitest` ni puertos de QA ni 3307 en escucha; 0 bases `restaurante_test*`; copia de mutaciones, sondas, env, logs y volcados del scratchpad borrados; `git status` del worktree igual al inicial más el ticket; árbol principal en `main` sin cambios; `git worktree list` sin worktrees nuevos; `node_modules` y cliente generado del worktree conservados.

### Criterios de aprobación

`QA_APPROVED` solo si: F1–F4 sin desviaciones relevantes y suma de `deploy/` igual; migración aditiva sin reconstrucción (M2) y sin diferencias (M4); CA-10, CA-11, CA-14, CA-15 (V2, V3) y CA-16 (B3, B4) en PASS; DT-2 (V4, V5) igual a lo descrito y la mitigación funciona; E1–E7 y C1–C3 sin 500, sin duplicados y sin filtraciones; `typecheck`, `lint` y `npm test` en 0; archivos < 20 s; sin `BLOCKER` ni `CRITICAL` y cada `MAJOR` aceptado por el usuario. Escala por impacto observable: editor con acceso o escritura en 403, gerente con acceso a usuarios/productos/página, o vuelta atrás que no arranca = `CRITICAL`; sesión no invalidada, duplicado por idempotencia, filtración de SQL/stack o ALTER que reconstruye la tabla = `MAJOR` o superior; mutación no detectada = `MAJOR`/`MINOR` (arriba); desviación de código HTTP sin impacto en el cliente o documental = `MINOR`.

### Autorizaciones que se piden al usuario

1. Docker local: `docker compose -p restaurante-qa-049b up -d --wait mysql-dev` con el `compose.yaml` del worktree, volumen propio y `127.0.0.1:3307`; parar/arrancar ese contenedor para E6, y una base/contenedor gemelo para M2 y B2. Si el `mysql-dev` de desarrollo está encendido, QA se detiene y pregunta.
2. Ejecutar la `api` del worktree y la de `main` (desde `/Users/orvigas/Desktop/Negocio/restaurante`, solo lectura) con `node src/server.ts` y env propios en el scratchpad; nunca el `api/.env` de desarrollo. `npm ci` y `db:generate` ya están hechos en el worktree.
3. Sondas y copia de mutaciones solo en el scratchpad (fuera del repo); nada en `restaurante/landing-pages/tests/` del worktree.
4. Escribir en el ticket del worktree solo `## Estado`, este plan, el QA Report y el Historial.

### Preguntas abiertas (con recomendación)

1. ¿Vuelta atrás solo con el código de `main` o también con la imagen `production`? **Recomendado:** solo con el código, como en el PR 1; la imagen, en el QA del PR de la épica hacia `main`.
2. ¿U1/U2 en el navegador o solo con el HTML del doble? **Recomendado:** HTML del doble más una pasada rápida en el navegador si la extensión responde; el cambio es una opción y un texto.
3. Misma `Idempotency-Key` con otro cuerpo: ¿se acepta el comportamiento del alta de productos? **Recomendado:** sí; QA lo documenta y solo es defecto si crea un duplicado o da 500.
4. Un hallazgo `MINOR` en las pruebas permanentes (G4, X): ¿se corrige en este PR o se acepta? **Recomendado:** decidirlo con el informe, como DEF-001 del PR 1.

**Aprobado por el usuario** ("Si"), con las autorizaciones y las cuatro recomendaciones.

## QA Report — PR 2

### Ronda

1 (2026-11-19), sobre el árbol de trabajo sin commit de `feature/REQ-F-049-gerente-api` (base `84f0a9a`). MySQL 8.4 desechable `restaurante-qa-049b` en `127.0.0.1:3307`; el `mysql-dev` de desarrollo siguió apagado.

### Pruebas ejecutadas

- G1: `build:css` 0; `typecheck` 0; `lint` 0, sin avisos; `npm test`: api 52 archivos y 1208 pruebas, landing-pages 61 y 895, inventory-manager 16 y 278, todo en verde.
- G2: `admin-inventory-api.test.ts` (+ `contract-types.test.ts`) 1.32 / 1.28 / 1.27 s; `user-repository.test.ts` 3.39 / 3.31 / 3.26 s.
- F1–F4: `git status`/diff solo con los archivos del Implementation Result; sin cambios en `package*.json`, `deploy/`, `ops/`, `.github/` ni `docs/`; suma de `deploy/` = `591de8e7f259073f79ff34418c8b7a3a2680d465ef3bc7378c620221455cc7f0` (igual).
- M1–M4, P1–P8, E1–E7, C1–C4, V1–V6, B1–B4, X1–X7, U1–U2 con la `api` del worktree y la de `main` (`1c88e30`, solo lectura, `node src/server.ts` y env del scratchpad) sobre el MySQL de QA.

### Migración

- M1: una sola sentencia; `gerente` al final; `NOT NULL` y colación `utf8mb4_es_0900_as_cs` sin cambios.
- M2: `INNODB_TABLES` de `restaurante/user` antes y después: `TABLE_ID` 1967 → 1967, `TOTAL_ROW_VERSIONS` 0 → 0 (solo metadatos, sin reconstrucción). En una base gemela, la sentencia con `ALGORITHM=INSTANT` y con `ALGORITHM=INPLACE, LOCK=NONE`: aceptada (código 0); control negativo (reordenar el ENUM con `INSTANT`): rechazado con ERROR 1846 "Need to rebuild the table". Con 200 000 filas y 40 escrituras/lecturas concurrentes, el ALTER tardó 0.197 s y el escritor terminó sus 40 operaciones.
- M3: `CHECKSUM TABLE user` 603916290 antes y después; filas (id, rol, activo, `session_version`, `updated_at`) idénticas; `SHOW CREATE TABLE` solo cambia la definición del ENUM.
- M4: `prisma migrate diff --from-config-datasource --to-schema` → "No difference detected" (código 0); `migrate status` "up to date".

### Criterios de aceptación

| CA | Resultado | Evidencia |
| --- | --- | --- |
| CA-10 (API) | PASS | P1: sin sesión 401 `UNAUTHENTICATED` en las 12 rutas; editor 403 `FORBIDDEN_ROLE` en las 12 con CSRF válido y en las 8 escrituras sin CSRF (P2: el rol se comprueba antes que el CSRF). P3: las 5 tablas `inventory_*` en 0,0,0,0,0 antes y después. X1 y X2 detectadas. |
| CA-11 (API y usuarios) | PASS | P5: el admin crea un gerente con `businesses: ['molotes','birria']` → 201, `businesses: []` en la respuesta y 0 filas en `user_business`; login 201. P1: gerente con 2xx en las 12 rutas (409 `CATEGORY_IN_USE` donde corresponde). P6: 403 en usuarios (lista, alta, ficha, edición), bot (estado e interruptor), cotizador de ambos negocios (`FORBIDDEN_ROLE`), productos y página de ambos negocios, lectura y escritura (`FORBIDDEN_BUSINESS`); cambia su propia contraseña (200). Admin y editor conservan sus accesos. |
| CA-9 / CA-8 (HTTP) | PASS | E2: 409 `VERSION_CONFLICT` con `current {id, version, updatedAt, updatedBy}`; el primer cambio se conserva; "guardar encima" con la versión de `current` → 200 y `overwrite_after_conflict` en el historial (con la versión vieja, otra vez 409). E5/C1: misma clave repetida → mismo id, 1 fila; 10 rondas concurrentes con la misma clave → 201/201 con el mismo id y 1 fila cada una. |
| CA-14 | PASS | Diff sin cambios en landings, `/api/v1/public/*`, bot, productos ni página; suite completa en verde; P6 y V3 (públicas, productos, página y usuarios 2xx). |
| CA-15 automática | PASS | V2: la `api` de `main` sin la variable termina con código 1 y `DATABASE_NEWER_THAN_CODE` (`20261119120000_rol_gerente`). V3: con `DATABASE_ALLOW_NEWER_SCHEMA=true` y sin gerentes, aviso `database_newer_than_code_allowed`; las 4 públicas 200; login de admin, lista y alta de usuario; editor: login, edición de producto 200 y guardado de página 200. |
| DT-2 manual | PASS (igual a lo descrito) | V4 con 6 gerentes: lista de usuarios, ficha del gerente y login del gerente → 503 `DATABASE_UNAVAILABLE` sin detalles (log `P2023`); públicas 200; login de admin y editor, productos, página, bot, ficha de un editor y alta de usuario 2xx. Su sesión previa da 401 porque las sesiones viven en memoria y no sobreviven al cambio de proceso. V5: con el `UPDATE … role='editor', session_version=session_version+1 WHERE role='gerente'` (6 filas), la lista vuelve a 200; el exgerente entra como editor sin negocios y recibe 403 en productos, página y usuarios. V6: la `api` del worktree arranca sin la variable y el rol se restaura con `PUT /usuarios/5` (200; el gerente vuelve a tener 200 en el inventario). |
| CA-16 | PASS | B1: `mysqldump` con las opciones de `backup.sh` y un usuario con los privilegios de `restaurante_backup` (salida 0): 5 `CREATE TABLE inventory_*`, `enum('admin','editor','gerente')` y filas de gerente. B2: `DROP DATABASE` y restauración como `restore.sh`. B3: conteos y `CHECKSUM TABLE` de `user`, `user_business`, las 5 `inventory_*`, `product`, `page_version` y `_prisma_migrations` idénticos (10/3/32/20/70/0/32/16/4/5), con el ENUM y 6 gerentes. B4: la `api` del worktree arranca sin la variable; el gerente entra y lee una ficha con 13 entradas de historial y su empaque `25.000`. `--drill`: lo hace el usuario tras desplegar la épica. |
| CA-10 en pantalla, CA-12, CA-17, redirección del gerente | No aplica a este PR | PR 3 |

### Errores y robustez

- E1: 422 `VALIDATION_FAILED` con `fields` para los filtros `estado`, `tipo`, `categoria` y `pagina` (0, -1, x), `q` > 80, filtro repetido y cantidad de conversión inválida (texto, negativa, 4 decimales); campo extra, nombre repetido, nombre vacío, factor 0, tipo inválido y categoría repetida sin distinguir mayúsculas. Unidad inexistente en la conversión → 422 `UNKNOWN_UNIT` (código de core, no `UNIT_CONVERSION_UNAVAILABLE`; correcto: es otra causa). Parámetro desconocido en la lista: ignorado (200).
- E3: ids `0`, `-1`, `01`, `abc`, `1e3`, 11 dígitos, `%20` e inexistente → 404 en GET, PUT, desactivar y PUT de categoría.
- E4: más de 16 KiB → 413 `PAYLOAD_TOO_LARGE`; JSON malformado → 400 `INVALID_JSON`; no JSON → 415; array → 422.
- E5: misma clave con otro cuerpo → 422 `IDEMPOTENCY_KEY_REUSED` sin escribir (aceptado, P3); sin clave → 201; la misma clave de otro usuario es independiente (201).
- E6: con MySQL detenido, lectura y escritura → 503 `DATABASE_UNAVAILABLE` "Servicio no disponible temporalmente."; al volver la base, 200/201 sin reiniciar la `api`.
- E7: 551 líneas de log revisadas: eventos `inventory_item_saved`, `inventory_category_saved`, `inventory_conflict`, `inventory_create_replayed`, `inventory_create_key_reused`, `admin_forbidden` y `admin_csrf_rejected` solo con ids, acción, ruta y códigos; sin nombres de artículos, cuerpos, SQL, stack, URL de la base ni tokens. Ninguna respuesta de error lleva detalles internos.
- C2: 10 rondas de dos `PUT` con la misma versión → siempre un 200 y un 409 con `current`. C3: 10 rondas de inactivar una categoría frente a un alta en ella → 409 `CATEGORY_IN_USE` y 201, 0 violaciones del invariante. C4: página 999999 → 200 vacía con `total`; `%`, `_` y Unicode en `q` sin comodines ni error.
- P7: desactivar a un gerente, pasarlo a editor, pasar un editor a gerente o un gerente a admin → la sesión abierta da 401 y `session_version` sube. Cambiar solo los negocios de un gerente se ignora (200, sin negocios, sin cerrar la sesión). P8: de editor a gerente quedan 0 filas en `user_business`.

### Mutaciones

X1 (sin comprobación de rol en `inventory()`): detectada. X2 (`canManageInventory` siempre verdadero): detectada. **X3a (cambiar el rol no cierra sesiones en `user-repository.ts`): no detectada** con la suite completa de api, landing-pages e inventory-manager (DEF-002). X3b (gerente con todos los negocios): detectada (api y MySQL). X4 (escrituras sin CSRF): detectada. X5 (alta sin idempotencia): detectada. X6 (409 sin `current`): detectada. X7 (pasar un editor a gerente conserva sus negocios en `diffUser`): detectada en MySQL.

### Defectos encontrados

### DEF-002

- Severidad: `MAJOR` (según el criterio aprobado: una mutación no detectada cuyo comportamiento no protege ninguna prueba)
- Criterio de aceptación afectado: RF-9, caso límite "gerente degradado pierde la sesión" (cobertura; el comportamiento actual es correcto)
- Descripción: ninguna prueba protege que `updateUser` del repositorio de Prisma suba `sessionVersion` cuando cambia **solo** el rol. La prueba nueva de `user-repository.test.ts` pasa de editor con negocios a gerente, y el cambio de negocios ya cierra la sesión por sí solo. Las pruebas de la API usan el doble de usuarios de `api/tests/support/admin.ts`, no este código. El TAP preveía ampliar `admin-users-api.test.ts` con "sesión cerrada al cambiar el rol", y eso no se hizo.
- Pasos para reproducir: en una copia del árbol, cambiar en `packages/db/src/user-repository.ts` `const closesSessions = 'role' in changes || 'businesses' in changes;` por `const closesSessions = 'businesses' in changes;`, y ejecutar `npm test` de api, landing-pages e inventory-manager.
- Resultado esperado: alguna prueba falla.
- Resultado actual: api 1208/1208, `user-repository.test.ts` 17/17 e inventory-manager 278/278 en verde. Las 2 únicas fallas de la suite completa de landing-pages son de `content.test.ts`, que en la copia del árbol no encuentra `_stich_source_/` y falla igual sin la mutación.
- Evidencia: X3a de esta ronda. En vivo, con el código sin mutar, pasar un gerente a admin sin tocar negocios da 401 en la sesión vieja.
- Impacto: hoy ninguno observable. Con el rol Gerente, los cambios de rol sin cambio de negocios se vuelven habituales (gerente ↔ admin y editor sin negocios ↔ gerente). Un cambio futuro podría dejar abierta la sesión de un gerente degradado sin que falle ninguna prueba.
- Recomendación: un caso en MySQL en `user-repository.test.ts` (o en `admin-users-api.test.ts`, como decía el TAP) que cambie solo el rol, p. ej. gerente → admin o editor sin negocios → gerente, y compruebe que sube `sessionVersion`. O aceptarlo sin cambios.

### Revisión de pruebas permanentes

- Las 12 de `admin-inventory-api.test.ts` son funcionales: permisos, CSRF, sesión, alta y ficha, errores, conflicto, idempotencia, 409 de dominio y 503. Usan `startAdmin`/`listenLocal`, no usan esperas fijas ni `retry`, y los nombres son de dominio.
- El caso nuevo de `user-repository.test.ts` (ENUM con `gerente` y de editor a gerente) es funcional y usa `makeDatabase()`.
- Lo de `contract-types.test.ts` amplía un archivo existente (listas cerradas iguales a las de core) y se acepta. Lo de `support/admin.ts` es solo un ajuste del doble.
- Ninguna es de arquitectura.

### Regresión

Suite completa en verde, lint y typecheck en 0. V3 y V4 confirman que el código de `main` funciona sobre la base migrada.

### Responsive / Accesibilidad / UX/UI

U1 se probó con el doble y con el entorno real (inventory-manager del worktree y la `api` del worktree):

- El selector "Rol" tiene `label`, las opciones Editor, Gerente y Administrador, y la ayuda con `aria-describedby="f-role-help"`.
- El formulario es SSR (`method=post`, `action=/usuarios`) y envía `gerente`.
- En la lista real, "Gema (gema2) Rol: Gerente Negocios: No aplica".
- La ficha de edición carga el rol `gerente` y los negocios sin marcar, y hay un solo `h1`.

Observaciones (no son defectos):

- El doble de la API de `inventory-manager` (`tests/support/api-double.ts`) no conoce el rol: guarda un gerente como editor.
- El formulario deja marcar negocios para un gerente; la API los ignora (P5).

SEO y performance: no aplican (sin pantallas nuevas).

### Pendientes de revisión manual

- Visual a 375 px y foco visible del selector: la extensión de Chrome no capturó la pantalla (CDP agotó el tiempo). Ningún CA depende de ello; el DOM se validó arriba.
- Simulacro `verify-backup.sh --drill` tras desplegar la épica (usuario).

### Limpieza

- `docker compose -p restaurante-qa-049b down -v`: volumen y redes eliminados. La base `restaurante_test_v1` se fue con el volumen; no había otras `restaurante_test*`. `docker ps -a`, `docker volume ls` y `docker network ls` sin restos `qa-049b`.
- `restaurante-mysql-dev-1` sigue apagado, como estaba.
- Sin procesos `server.ts` ni `vitest`; los puertos 3291 a 3295 y 3307 están libres.
- Borrado el directorio `qa2` del scratchpad: copia de mutaciones, sondas, env, logs, volcados y capturas.
- La pestaña del navegador está cerrada.
- `git status` del worktree igual al inicial, más el ticket. El árbol principal en `main` sin cambios. `git worktree list` sin worktrees nuevos.
- `node_modules` y el cliente generado del worktree se conservan.

### Resultado final

NEEDS_USER_DECISION

### Ronda 2

Revalidación de DEF-002 (decisión del usuario: "Si"). senior-fullstack añadió un caso a `landing-pages/tests/integration/user-repository.test.ts`: "gerente (REQ-F-049): cambiar solo el rol, sin negocios de por medio, cierra las sesiones (gerente -> admin -> gerente)". No cambió código de producción.

**Qué cambió.** `git status` tiene los mismos archivos que en la ronda 1.
- El diff de `packages/db/src/user-repository.ts` contra `84f0a9a` es el validado: 4 inserciones y 3 borrados (comentario del ENUM, negocios solo del editor en `diffUser` y en `createUser`). `closesSessions` sigue igual en la línea 208.
- Ese archivo tiene una fecha de modificación posterior a la ronda 1 (04:35), pero su contenido coincide con el validado.
- El resto de los archivos de `src/` y `packages/` conservan la fecha de modificación de antes de la ronda 1 (22:58–23:04).
- El único cambio nuevo es el caso de prueba.

**Pruebas repetidas.**
- `typecheck` 0 y `lint` 0.
- `npm test`: api 1208, landing-pages 896 (+1, el caso nuevo) e inventory-manager 278, todo en verde.
- `user-repository.test.ts`: 18/18 en 3.47 / 3.43 / 3.47 s.
- X3a, en una copia del árbol en el scratchpad: quitar `'role' in changes` de `closesSessions` hace **fallar** el caso nuevo (1 fallo y 17 en verde).

**No repetido, a propósito.** Lo demás del plan (migración, permisos, errores, concurrencia, vuelta atrás, respaldo, pantalla y el resto de las mutaciones) no se repite: el código de producción no cambió y las pruebas añadidas no afectan a esas comprobaciones.

**DEF-002: corregido y verificado.**

**Limpieza.**
- `docker compose -p restaurante-qa-049b down -v`: contenedor, volumen y redes eliminados; 0 bases `restaurante_test*` antes del borrado.
- La copia del árbol en el scratchpad está borrada.
- No quedan procesos `vitest` ni `server.ts`, y el puerto 3307 está libre.
- `restaurante-mysql-dev-1` está apagado (ya lo estaba al empezar).
- No hay worktrees nuevos y el árbol principal no cambió.

**Resultado final: QA_APPROVED**

## Implementation Result — PR 3

### Rama

`feature/REQ-F-049-pantallas`, desde `origin/epic/inventario` (`077dcf6`, con los PR 1 y 2 mergeados). Sin commit ni PR (pendiente de aprobación). El nombre es el que pidió la sesión principal; el plan proponía `feature/REQ-F-049-catalogo-pantallas`.

### Cambios realizados

- **Pantallas** (`inventory-manager`): controlador `src/controllers/inventory.ts`, vistas `src/views/inventory.ts`, 6 páginas `views/pages/inventory-*.html` y 25 parciales `views/partials/inventory-*.html`; rutas en `src/routes.ts` (antes de `/:negocio/...`) y composición en `src/app.ts`. Rutas: `GET /inventario` (303 a artículos), `GET|POST /inventario/articulos` (lista con filtros GET de estado, tipo, categoría y búsqueda, y páginas "Anterior/Siguiente"; alta), `GET /inventario/articulos/nuevo[?clase=padre|?padre=<id>]`, `GET /inventario/articulos/:id[?cantidad=&unidad=]` (ficha con datos, "Sin costo", empaques, tabla de equivalencias, formulario GET de conversión, variantes e historial), `GET …/:id/editar` y `POST …/:id` (409 con quién y cuándo, "Cargar la versión vigente" y "Guardar mis cambios sobre la versión vigente"), `GET|POST …/:id/desactivar` (confirmación con la lista de variantes activas que se inactivan), `POST …/:id/reactivar`, `GET|POST /inventario/categorias`, `GET …/:id/editar`, `POST …/:id` (renombrar) y `POST …/:id/desactivar|reactivar` (409 `CATEGORY_IN_USE` con el número). Sesión y rol (admin o gerente; si no, 403 "No tienes permiso para gestionar el inventario." sin llamar a la API), mismo origen, formularios cerrados (400), CSRF reenviado, PRG con 303, alta idempotente con `requestId`, 422 junto a cada campo y en el resumen enlazado (los errores de empaque vuelven a su fila del formulario), 503 conservando lo escrito, 404 y 403. Sin JavaScript nuevo; reutiliza `field-input`, `field-select`, `field-textarea`, `user-fieldset`, `row-fieldset`, `option`, `hidden`, `notice`, `empty`, `action-link`, `submit`, `overwrite`, `field-error`, `field-help`, `error-summary` y `business-nav`/`subnav-link`. Sistema visual del admin (PV-8): sin diseño nuevo y sin Stitch.
- **Navegación e inicio:** `HeaderSection` con `inventory` e `inventory-categories`; enlace "Inventario" en la cabecera tras los negocios y antes de "Usuarios" y "Bot", solo para `INVENTORY_ROLES` (`src/views/index.ts`); subnavegación "Artículos | Categorías". `home` (`src/controllers/admin.ts`) lleva a `/inventario/articulos` a quien no tiene negocios y puede usar el inventario (el gerente).
- **Semilla de desarrollo** (RF-10, PV-5): `api/scripts/support/inventory-dev-seed.ts` (datos ficticios por el repositorio de core, autor "Semilla de desarrollo", idempotente: con artículos o categorías no hace nada; `devSeedRefusal` rechaza `NODE_ENV=production` y hosts que no sean `127.0.0.1`, `localhost`, `::1` o `mysql-dev`) y `api/scripts/inventory-seed-dev.ts` (verifica la base sin migrar). Scripts `inventory:seed-dev` en `api/package.json` y `restaurante/package.json`. La `api` no siembra el inventario al arrancar.
- **Documentación:** `restaurante/docs/arquitectura.md` (§4: módulo `inventory` y regla de las landings; §6: rutas del inventario; §8: "Paso 5: épica de inventario" con la rama, la partición y el rol), `restaurante/docs/despliegue.md` (§6: procedimiento DT-2 para gerentes antes de una vuelta atrás manual; §9 y §11.1: las tablas `inventory_*` en el volcado; §11.7: consulta de conteos del inventario tras restaurar) y `restaurante/README.md` (scripts, API, admin, roles, tablas y la nota de `DATABASE_ALLOW_NEWER_SCHEMA=true` al alternar en local entre la épica y `main`).
- **Pruebas:** doble de la API con el rol Gerente (usuarios: solo el editor guarda negocios) y el inventario en memoria (`inventory-manager/tests/support/api-double-inventory.ts`, `api-double.ts`, `browser.ts` con `GEMA` y la opción `users`).

Desviaciones del plan:

- La semilla usa nombres completos en las variantes ("Refresco Coca-Cola 600 ml", "Agua fresca de horchata"…), porque el nombre es único en todo el catálogo (decisión P4 del QA del PR 1) y así se distinguen en la lista.
- La edición no permite cambiar la clase ni el tipo (inmutables en core); en una variante, la categoría tampoco (la hereda del padre). Se muestran como texto de solo lectura.
- Filas de empaque: se muestran las escritas más dos vacías (hasta 8), porque sin JavaScript no se pueden añadir filas; para más de dos empaques nuevos se guarda y se edita otra vez.
- La cadena de punta a punta va en un archivo propio, `landing-pages/tests/integration/admin-inventory-e2e.test.ts` (como `admin-users-e2e.test.ts`, con los procesos reales), en lugar de dentro de `prisma-inventory-store.test.ts`: necesita arrancar la `api` y el admin como procesos.

### Criterios de aceptación

- CA-1: cumplido (alta en pantalla y en la cadena real: aparece en la lista y el historial dice "Alta · <usuario>").
- CA-2, CA-3, CA-5, CA-6 y CA-13: reglas de core y API (PR 1 y 2); en pantalla, el 422 se pinta en su campo y la categoría en uso responde 409 con el número.
- CA-4: cumplido en la ficha (tabla "1 bulto = 25 kg" y conversión "2 bulto = 50 kg"; con la caja de 24, igual).
- CA-7: cumplido (padre sin existencias, variantes con SKU, unidad y estado propios; alta de variante con tipo y categoría heredados).
- CA-8: cumplido (filtro de estado y reactivar desde la ficha).
- CA-9: cumplido (409 con quién y cuándo, lo escrito conservado y "guardar encima"; también en la cadena real).
- CA-10: cumplido (el editor no ve "Inventario"; 403 en todas las pantallas y acciones sin llamar a la API).
- CA-11: cumplido (el gerente entra directo al inventario, solo ve "Inventario" y recibe 403 en usuarios, bot, cotizador, productos y página).
- CA-12: cumplido (la semilla carga los 18 artículos de RF-10 en memoria y en MySQL local; segunda vez, nada; producción, vacía porque la `api` no siembra).
- CA-14, CA-15, CA-16 y CA-17: los comprueba QA (regresión, vuelta atrás, respaldo y 360 px/teclado/sin JS/axe). Procedimiento DT-2 y consulta de conteos ejecutados en local (abajo).

### Validaciones ejecutadas

- `npm ci --strict-allow-scripts` y `npm run db:generate`: 0. `npm run build:css`: 0. `npm run typecheck`: 0. `npm run lint`: 0, sin avisos.
- `npm test` (MySQL local con `npm run db:up`): api 52 archivos y 1210 pruebas; landing-pages 62 y 897; inventory-manager 17 y 286. Todo en verde.
- Pruebas permanentes nuevas (funcionales): `inventory-manager/tests/integration/inventory.test.ts` (8 casos, ~0.7 s: CA-10 del editor sin llamar a la API, CA-11 del gerente con la redirección y la subnavegación, alta con empaque, ficha, equivalencia y conversión, 422 por campo y en la fila de empaque, 503 conservando lo escrito, 409 y "guardar encima", padre con variantes y su baja confirmada con filtros de estado y 422 de filtro, categoría en uso); `landing-pages/tests/integration/admin-inventory-e2e.test.ts` (1 caso, ~5 s: la cadena real del plan); `api/tests/unit/inventory-catalog.test.ts` (+2 casos: semilla RF-10 idempotente y su salvaguarda). Ajuste de una prueba existente: `bot-access.test.ts` (cabecera del administrador con "Inventario").
- Semilla en local, sobre una base desechable `restaurante_test_seeddev` migrada con `prisma migrate deploy`: `npm run inventory:seed-dev` → "Semilla de desarrollo cargada: 18 artículos." (6 insumos kg, 3 intermedios, 3 compuestos, 2 padres de reventa y 4 variantes; 7 categorías; 3 empaques); segunda vez → "El inventario ya tiene datos: no se cargó la semilla."; con `NODE_ENV=production` y con un host remoto se niega con su mensaje y código 1.
- Procedimiento DT-2 de `despliegue.md` §6 ejecutado en local (mismo SQL por `docker exec … mysql` sobre esa base, con un gerente y un editor): el paso 1 lista al gerente; el paso 2 lo deja como editor sin negocios con `session_version` + 1 y `gerentes_restantes = 0`, sin tocar al editor. La consulta de conteos de §11.7 devuelve `18 / 7 / 25`. Base borrada después.

### Archivos afectados

Nuevos: `restaurante/inventory-manager/src/controllers/inventory.ts`, `restaurante/inventory-manager/src/views/inventory.ts`, `restaurante/inventory-manager/src/views/pages/inventory-{items,item,item-form,item-deactivate,categories,category-form}.html`, 25 parciales `restaurante/inventory-manager/src/views/partials/inventory-*.html`, `restaurante/inventory-manager/tests/integration/inventory.test.ts`, `restaurante/inventory-manager/tests/support/api-double-inventory.ts`, `restaurante/api/scripts/inventory-seed-dev.ts`, `restaurante/api/scripts/support/inventory-dev-seed.ts`, `restaurante/landing-pages/tests/integration/admin-inventory-e2e.test.ts`.

Modificados: `restaurante/inventory-manager/src/{app,routes}.ts`, `restaurante/inventory-manager/src/controllers/admin.ts`, `restaurante/inventory-manager/src/views/index.ts`, `restaurante/inventory-manager/tests/support/{api-double,browser}.ts`, `restaurante/inventory-manager/tests/integration/bot-access.test.ts` (la cabecera del administrador incluye "Inventario"), `restaurante/api/tests/unit/inventory-catalog.test.ts` (semilla), `restaurante/api/package.json`, `restaurante/package.json`, `restaurante/docs/arquitectura.md`, `restaurante/docs/despliegue.md`, `restaurante/README.md`.

### Riesgos o pendientes

- `.claude/CLAUDE.md` §8 no se editó (no autorizado): la propuesta va en el informe a la sesión principal.
- QA: 360 px, teclado, sin JavaScript y axe de las pantallas nuevas (CA-17), regresión (CA-14), vuelta atrás con el procedimiento DT-2 contra la imagen de `main` (CA-15) y respaldo/restauración (CA-16).
- El procedimiento DT-2 se probó en local con `docker exec … mysql` y el usuario de pruebas sobre una base `restaurante_test_*` (no con `$C` ni root del VPS, que no existen en local).

### Correcciones del QA ronda 1

- DEF-003 y DEF-004: caso nuevo en `inventory-manager/tests/integration/inventory.test.ts`, "la baja de un padre sin la confirmación de sus variantes activas no inactiva nada y vuelve a pedirla con sus nombres". Reproduce la carrera (confirmación cargada sin variantes activas, se reactiva la variante y se envía el formulario viejo, sin `variants`): 409, nada inactivado, la confirmación nombra "Coca-Cola" y lleva `variants=deactivate`; con ella, 303 y padre y variante inactivos. X4a y X4b ahora fallan en ese caso (archivos de producción restaurados, `shasum -c` OK).
- DEF-005: `restaurante/docs/arquitectura.md` §8: "T4 y T5; T2 a T5 son REQ-F-050 a REQ-F-053, al refinarse". Sin el error en `despliegue.md` ni en el `README.md`.
- Validaciones: `inventory.test.ts` 9/9 tres veces (~1.2 s); `npm run typecheck` 0; `npm run lint` 0; `npm test -w inventory-manager` 17 archivos y 287 pruebas en verde. Sin código de producción cambiado.

## QA Action Plan — PR 3

### Objetivo

Validar, sin commit ni PR, el worktree `feature/REQ-F-049-pantallas` (desde `origin/epic/inventario` = `077dcf6`): pantallas de inventario, enlace y subnavegación, redirección del gerente, doble de usuarios con el rol, semilla `inventory:seed-dev`, documentación y pruebas permanentes, sin regresiones. Implementación y desviaciones aprobadas por el usuario ("Apruebo y autorizo"). El worktree no está indexado por CodeGraph: la revisión usa Read/Grep dirigidos.

### Requisito bajo prueba

RF-1, RF-3 a RF-7, RF-9 a RF-11, PV-1, PV-5, PV-8, DT-2 y "Frontend (`inventory-manager`)", "Contenido / configuración", "Documentación a actualizar" y "Testing" del Technical Action Plan. Fuera: T2 a T5 y ventas.

### Criterios de aceptación (cada uno → pruebas que lo cubren)

| CA | Alcance del PR 3 (en pantalla, contra `api` y admin reales sobre MySQL) | Pruebas |
| --- | --- | --- |
| CA-1 | Alta de insumo por el gerente → lista de activos e historial "Alta · <nombre>" | F1, F2 |
| CA-2, CA-3, CA-6 | Nombre repetido (activo/inactivo), SKU repetido, factor 0/negativo/no numérico → 422 junto al campo y en el resumen | F4 |
| CA-4, CA-5 | Ficha: tabla de equivalencias y conversión GET (2 cajas = 48 pza; 500 g = 0.5 kg; pza→kg rechazado con mensaje) | F3 |
| CA-7 | Padre sin existencias; variantes con SKU, unidad y estado propios; alta de variante con tipo y categoría heredados de solo lectura | F6 |
| CA-8 | Filtro Activos/Inactivos y reactivar desde la ficha | F2, F6 |
| CA-9 | 409 con quién y cuándo, lo escrito conservado, "Cargar la versión vigente" y "Guardar encima" | F5 |
| CA-10 | Editor: sin "Inventario"; 403 en las 16 rutas sin llamar a la API ni escribir | P1, P2, X1, X2 |
| CA-11 | Gerente creado por el admin: entra, `/` lo lleva a `/inventario/articulos`, solo ve "Inventario"; 403 en usuarios, bot, cotizador, productos y página | P1, P3 |
| CA-12 | Semilla: 18 artículos y 7 categorías de RF-10; idempotente; producción vacía | S1–S6 |
| CA-13 | Categoría en uso → 409 con el número | F7 |
| CA-14 | Landings, `/api/v1/public/*`, bot, productos, página y usuarios igual | G1–G4 |
| CA-15 | Vuelta atrás con el código de `main` y DT-2 documentado | V1–V5 |
| CA-16 | Consulta de conteos de §11.7 tras dump/restore | B1, B2 |
| CA-17 | 360 y 1440 px, solo teclado, foco visible y sin JavaScript | A1–A10 |

### Riesgos identificados

1. Ruta `/inventario/...` registrada después de `/:negocio/...` o sin la comprobación de rol antes de llamar a la API (fuga o 404).
2. Comprobación de rol solo en la vista (enlace oculto) y no en el controlador; o el admin reenvía sin CSRF.
3. `?padre=<id>` o campos ocultos manipulables (cambiar tipo/categoría de una variante, clase en la edición): el formulario cerrado debe rechazarlos con 400 y la API manda.
4. Doble envío del alta sin `requestId` estable → duplicado.
5. 503/409 que pierden lo escrito o filtran detalles; errores de empaque pintados en la fila equivocada.
6. Redirección del gerente en bucle o aplicada a un editor sin negocios.
7. Semilla ejecutable contra una base remota o en producción, o enganchada al arranque de la `api`.
8. Cabecera más alta a 360/375 px por el enlace y la subnavegación (AUD-006 ya conocido: 273 px a 375 px).
9. Documentación que describe rutas, comandos o SQL inexistentes o erróneos (DT-2 con SQL que no funciona).

### Revisión estática (R)

- **R1.** `git status` y `git diff --stat origin/epic/inventario` del worktree: solo los archivos de "Implementation Result — PR 3" y el ticket; nada en landings (`src/`, `public/`), bot, `api/src`, `packages/`, `ops/`, `.github/`, `deploy/` ni `package-lock.json` (`dependencias.md`: sin dependencias nuevas; los cambios de `package.json` son solo el script `inventory:seed-dev`).
- **R2.** Suma de `deploy/` con el método de `ci.yml`: `cd restaurante/deploy && shasum -a 256 -- compose.prod.yaml deploy.sh mysql/initdb/01-usuarios.sh | shasum -a 256 | cut -c1-64` = `591de8e7f259073f79ff34418c8b7a3a2680d465ef3bc7378c620221455cc7f0` (se confirma antes el método leyendo `ci.yml`).
- **R3.** Diff frente al TAP: tabla de rutas (16 en `routes.ts` antes de `/:negocio`), orden sesión → rol → mismo origen → campos cerrados → CSRF, PRG 303, `requestId` del alta, parciales reutilizados (`componentizacion.md`), `HeaderSection`, `INVENTORY_ROLES` de contracts (sin duplicar listas de roles), `home` del gerente, tema `neutral`.
- **R4.** Reglas: `html.md` (`main`, `nav`, `section`, `dl`, `table` con `caption` y `th scope`, `ol` del historial, botones para acciones y enlaces para navegar), `bem.md` y `tailwind.md` (sin CSS propio nuevo; clases del sistema), `javascript.md` (ningún archivo nuevo en `public/js` ni `<script>` en las páginas), `accesibilidad.md` y `formularios.md` (`label`, `aria-describedby`, `aria-invalid`, error con texto e icono), `diseno-responsivo.md`, `assets.md` (sin assets nuevos), `stitch-diseno.md` (sin diseño nuevo, PV-8), `typescript.md` (sin `any`, `as`/`!` justificados, imports `.ts`), `manejo-de-errores.md` (páginas de error sin detalles internos), `testing.md`.
- **R5.** Sin secretos ni datos reales: semilla y documentación con datos ficticios; búsqueda de teléfonos, correos, contraseñas, IP y tokens en el diff.

### Permisos y flujos contra la `api` y el admin reales (P y F)

Entorno: MySQL 8.4 de QA (`docker compose -p restaurante-qa-049c`, `127.0.0.1:3307`), base `restaurante_test_*` migrada; `api` y admin del worktree con `node src/server.ts --env-file=<scratchpad>` en puertos libres de `127.0.0.1`. Cliente: script `fetch` del scratchpad que imita al navegador (cookie, token CSRF leído del formulario, `Origin`), más Chrome headless para A. Usuarios: admin, editor con negocio, gerente creado por el admin desde la pantalla de usuarios.

- **P1.** Matriz de las 16 rutas × {sin sesión, editor, gerente, admin}: sin sesión → redirección al login (302/303) o 401 según el patrón del admin; editor → 403 "No tienes permiso para gestionar el inventario." y, en el log de la `api`, ninguna petición a `/api/v1/admin/inventario` (CA-10 "sin llamar a la API"); gerente y admin → 200/303. Las escrituras del editor se envían con CSRF válido.
- **P2.** CSRF y origen: gerente sin token, con token ajeno o con `Origin` de otro sitio → 403 sin escribir; campos extra o faltantes en cada formulario POST → 400 sin escribir. Conteos de las tablas `inventory_*` antes y después de P1–P2 idénticos.
- **P3.** CA-11: `/` del gerente → `/inventario/articulos`; cabecera solo con "Inventario"; 403 en `/usuarios`, bot, cotizador, productos y página de ambos negocios; `/` del editor y del admin igual que antes (sin bucle).
- **F1.** Alta de "Masa de maíz" (kg, bulto = 25) → 303 a la ficha; lista de activos; historial con el nombre del gerente y la fecha en `BUSINESS_TIMEZONE`.
- **F2.** Lista: filtros de tipo, categoría, estado y búsqueda por nombre y SKU; mensaje sin resultados; paginación con más de una página (sembrar > tamaño de página) y `aria-label`; filtro fuera de la lista cerrada → mensaje, sin 500.
- **F3.** Ficha: "Sin costo"; equivalencias; conversión GET con valores válidos, inválidos (`abc`, `-1`, vacío) y unidad sin factor.
- **F4.** 422: nombre repetido, SKU repetido (también de un inactivo), factor 0/negativo/`abc` en una fila de empaque concreta → error en su campo y fila, resumen enlazado enfocable, `aria-invalid`, lo escrito conservado.
- **F5.** Dos sesiones (gerente y admin) editan la misma versión → la segunda ve 409 con quién y cuándo y lo escrito; "Cargar la versión vigente" no guarda; "Guardar encima" guarda y queda en el historial; el primer cambio se conserva.
- **F6.** Padre con dos variantes: alta de variante desde `?padre=<id>` (tipo y categoría heredados de solo lectura; manipular el campo → 400 o ignorado por la API), padre sin existencias, inactivación del padre con la confirmación que lista las variantes activas, filtros Activos/Inactivos y reactivación.
- **F7.** Categorías: alta, renombrado, nombre repetido (422), inactivación en uso → 409 con el número; inactivación sin uso y reactivación.
- **F8.** Idempotencia: el mismo POST del alta reenviado dos veces (mismo `requestId`) y dos simultáneos → un solo artículo. PRG: tras el 303, recargar la ficha no reenvía.
- **F9.** 503: `api` detenida (y aparte MySQL detenido) al guardar alta, edición y categoría → aviso, código 503, lo escrito conservado y sin detalles internos; al volver, guarda.
- **F10.** 404: ids `0`, `abc`, `01`, inexistente, en ficha, edición, desactivar y categoría → página 404 del admin.

### Accesibilidad y responsive (A; CA-17)

Chrome headless con perfil temporal en el scratchpad y puerto de depuración 9222 (o Claude in Chrome si responde en 2–3 intentos), sobre las 6 páginas (lista, ficha con equivalencias y variantes, formulario con errores, confirmación de baja, categorías y su edición) y las páginas de 403/404:

- **A1.** 360×800 y 1440×900: `scrollWidth` ≤ `clientWidth` (sin desborde; la tabla de equivalencias desplaza solo su contenedor); capturas sin datos personales.
- **A2.** Cabecera a 360 y 375 px: altura medida de la cabecera y de la subnavegación para admin y gerente, comparada con `epic/inventario` sin el PR (AUD-006: 273 px a 375 px). Se declara el resultado; solo es defecto si el PR rompe la cabecera (solapes, recortes, desborde).
- **A3.** Solo teclado: orden de foco lógico, skip link a `main`, foco visible (estilo del sistema) en enlaces, campos, botones y paginación, resumen de errores que recibe el foco o está al inicio y sus enlaces llevan al campo.
- **A4.** Etiquetas: cada campo con `label` asociada, ayudas y errores por `aria-describedby`, `aria-invalid` solo con error; errores con texto (no solo color).
- **A5.** Un `h1` por página y jerarquía sin saltos; landmarks `header`, `nav` (con nombre accesible distinto para la subnavegación), `main`.
- **A6.** `aria-current="page"` en "Inventario" y en "Artículos"/"Categorías" según la página.
- **A7.** Objetivos táctiles: ≥ 24×24 px (WCAG 2.5.8) en todos; se informa cuáles no llegan a 44 px.
- **A8.** Contraste WCAG (texto 4.5:1, grande y no textual 3:1) con colores computados de los componentes nuevos o combinaciones nuevas (estado Inactivo, "N variantes", historial, filas de empaque, tabla). Componente reutilizado sin cambios: se anota, no es defecto del PR.
- **A9.** axe-core (inyectado desde el `node_modules` existente si está; si no, sin instalar nada y se declara) sin violaciones serias o críticas en las páginas nuevas.
- **A10.** Sin JavaScript (Chrome con JS desactivado o el cliente `fetch`): alta, edición, 409 y guardar encima, conversión, filtros, paginación, baja con confirmación, reactivar y categorías funcionan; ninguna página nueva carga `<script>`.

### Semilla (S; CA-12)

- **S1.** Base desechable migrada: `npm run inventory:seed-dev` con env del scratchpad → 18 artículos (6 insumos, 3 intermedios, 3 compuestos, 2 padres y 4 variantes) y 7 categorías por SQL; historial con autor "Semilla de desarrollo".
- **S2.** Segunda ejecución → mensaje "ya tiene datos" y conteos sin cambios; también con solo una categoría creada a mano.
- **S3.** `NODE_ENV=production` → se niega, código 1, sin escribir. Host remoto (p. ej. `DATABASE_URL` con `10.0.0.1` y con `db.example.com`) → se niega antes de conectar (sin intento de red: tiempo inmediato).
- **S4.** Base sin migrar → mensaje claro, código ≠ 0, sin stack de Prisma.
- **S5.** Producción vacía: la `api` arrancada sobre una base nueva migrada → `GET /inventario/articulos` vacío y 0 filas en `inventory_*`; `grep` de que `api/src` no importa la semilla.
- **S6.** RF-10 en pantalla: masa 1 bulto = 25 kg; Refresco Coca-Cola y Mundet en pza con caja = 24 (2 cajas = 48 pza); agua fresca en L; tipos y padres correctos.

### Vuelta atrás y DT-2 (V; CA-15)

Código de `main` desde `/Users/orvigas/Desktop/Negocio/restaurante` (solo lectura) con `node src/server.ts --env-file=<scratchpad>`, nunca su `api/.env`, sobre la base migrada de la épica con datos de la semilla.

- **V1.** Sin gerentes y sin `DATABASE_ALLOW_NEWER_SCHEMA` → sale con `DATABASE_NEWER_THAN_CODE`.
- **V2.** Con `DATABASE_ALLOW_NEWER_SCHEMA=true` → arranca; públicas 200; login de admin; productos y página 2xx.
- **V3.** Con gerentes: usuarios 503 (lo conocido de DT-2).
- **V4.** Procedimiento de `despliegue.md` §6 "Volver a una versión anterior a la épica de inventario (REQ-F-049) con gerentes", copiado tal cual y adaptado solo en la forma de conectarse (`docker exec` al MySQL de QA en lugar de `$C`/root del VPS): cada SQL funciona y da lo que el texto dice; la `api` de `main` vuelve a dar 200 en usuarios; el exgerente queda sin acceso y su sesión cerrada.
- **V5.** Avance a la `api` del worktree: arranca sin la variable y los roles se restauran como indica el documento.

### Respaldo (B; CA-16)

- **B1.** `mysqldump` con las opciones de `ops/backup` sobre la base con semilla, gerentes e historial; restauración en otra base del contenedor de QA.
- **B2.** La consulta de conteos de §11.7, tal cual, da los mismos valores que en el origen (`18 / 7 / 25` o los vigentes tras F); el admin del worktree sobre la restaurada muestra la ficha con su historial. El simulacro `--drill` lo hace el usuario tras desplegar la épica.

### Documentación (D)

- **D1.** `arquitectura.md` §4/§6/§8 paso 5, `despliegue.md` §6, §9, §11.1 y §11.7, y `README.md` contra el código: rutas (admin y API), nombres de scripts (`inventory:seed-dev` en raíz y `api`), tablas `inventory_*` reales del esquema, roles y variables; nada inventado (T2 a T5 no descritos como existentes).
- **D2.** Enlaces internos y anclas válidos; ortografía y tildes.

### Pruebas permanentes (T; `testing.md`)

- **T1.** Cada caso nuevo es funcional y no duplica otro (`inventory.test.ts` frente a `admin-inventory-api.test.ts`; la semilla en `inventory-catalog.test.ts`); sin pruebas de arquitectura; la cadena de punta a punta existe una sola vez (`admin-inventory-e2e.test.ts`) y usa `listenLocal`/procesos y `makeDatabase()` según la regla; sin esperas fijas ni `retry`; los ajustes de `bot-access.test.ts` y del doble no debilitan aserciones.
- **T2.** `inventory.test.ts`, `admin-inventory-e2e.test.ts` e `inventory-catalog.test.ts` en 3 ejecuciones aisladas, cada una < 20 s.

### Mutaciones (X), descartables

Copia APFS (`cp -c`) de `restaurante/` del worktree en el scratchpad; una a una, ejecutando solo los archivos afectados:

- **X1.** Quitar la comprobación de rol en el controlador del inventario.
- **X2.** Mostrar el enlace "Inventario" al editor.
- **X3.** No reenviar el token CSRF a la API.
- **X4.** Quitar la confirmación de variantes (inactivar el padre sin `confirm`).
- **X5.** Omitir el 409 / "guardar encima" (enviar siempre `overwrite`, y aparte no pintar el conflicto).
- **X6.** Semilla sin la salvaguarda de `NODE_ENV=production` (y aparte sin la del host).
- **X7.** `home` sin la redirección del gerente.

Una mutación que sobrevive: `MAJOR` si ninguna prueba cubre el comportamiento, `MINOR` si otra lo cubre indirectamente.

### Regresión (G; CA-14)

- **G1.** Desde `restaurante/` del worktree: `npm run build:css`, `npm run typecheck`, `npm run lint` y `npm test` (3 workspaces) en 0.
- **G2.** Landings `/`, `/molotes`, `/birria` y `/api/v1/public/{molotes,birria}/{productos,pagina}` 200 con la `api` del worktree.
- **G3.** Admin: productos, página, usuarios (con la opción Gerente), bot y cotizador para el admin; productos y página para el editor; cabecera sin cambios salvo "Inventario".
- **G4.** Diff sin cambios en landings, bot ni `api/src` (R1).

### Evidencia requerida

Salidas resumidas (código y totales) de cada comando; suma de `deploy/`; `git diff --name-only`; matriz P1 con códigos y el log de la `api` del editor; conteos antes/después; capturas a 360 y 1440 px; alturas de cabecera; resultados de foco, contraste, objetivos y axe; salidas de S1–S6, V1–V5 y B1–B2; duraciones de T2; resultado de X1–X7; comprobación de limpieza.

### Limpieza (comprobada, no supuesta)

`docker compose -p restaurante-qa-049c down -v` y `docker ps -a`, `docker volume ls`, `docker network ls` sin restos; `restaurante-mysql-dev-1` como estaba (apagado); sin procesos `server.ts`, `vitest` ni Chrome headless; puertos 3000–3004, 3307 y 9222 libres; 0 bases `restaurante_test*`; perfil de Chrome, copia de mutaciones, sondas, env, logs, capturas y volcados del scratchpad borrados; `git status` del worktree igual al inicial más el ticket; árbol principal en `main` sin cambios; `git worktree list` sin worktrees nuevos.

### Criterios de aprobación

`QA_APPROVED` solo si: R1–R5 sin desviaciones relevantes y suma de `deploy/` igual; CA-1 a CA-14 y CA-17 en PASS con evidencia; CA-15 (V1, V2, V4, V5) y CA-16 (B2) en PASS; documentación correcta; `build:css`, `typecheck`, `lint` y `npm test` en 0; archivos < 20 s; sin `BLOCKER` ni `CRITICAL` y cada `MAJOR` aceptado por el usuario.

Escala por impacto observable: editor que ve o usa el inventario, gerente con acceso a usuarios/productos/página, semilla que corre en producción o contra un host remoto, o procedimiento DT-2 que no restablece la `api` de `main` = `CRITICAL`; pérdida de lo escrito en 409/503, duplicado por doble envío, pantalla inutilizable a 360 px o sin teclado/sin JS, filtración de detalles internos o mutación no detectada sin cobertura = `MAJOR`; contraste o foco insuficiente en un componente nuevo, objetivo < 24 px, error documental con impacto operativo = `MAJOR` o `MINOR` según el impacto; errata, tilde u objetivo entre 24 y 44 px = `MINOR`/`TRIVIAL`.

### Autorizaciones que se piden al usuario

1. Docker local: `docker compose -p restaurante-qa-049c up -d --wait mysql-dev` con el `compose.yaml` del worktree, volumen propio y `127.0.0.1:3307`; parar y arrancar ese contenedor (F9) y una base gemela para B. Si el `mysql-dev` de desarrollo está encendido, QA se detiene y pregunta.
2. Arrancar la `api` y el admin del worktree, y la `api` de `main` (desde `/Users/orvigas/Desktop/Negocio/restaurante`, solo lectura), con `node src/server.ts` y env propios en el scratchpad; nunca el `api/.env` de desarrollo.
3. Chrome headless con perfil temporal en el scratchpad (puerto 9222), o Claude in Chrome si responde.
4. Sondas y copia de mutaciones solo en el scratchpad; nada en `restaurante/landing-pages/tests/` del worktree.
5. Escribir en el ticket del worktree solo `## Estado`, este plan, el QA Report y el Historial.

### Preguntas abiertas (con recomendación)

1. ¿Vuelta atrás solo con el código de `main` o también con la imagen `production`? **Recomendado:** solo con el código, como en los PR 1 y 2; la imagen, en el QA del PR de la épica hacia `main`.
2. Si la cabecera crece a 360/375 px respecto a AUD-006 sin romperse: ¿se acepta y queda en la auditoría aparcada? **Recomendado:** sí; se mide y se declara, y solo es defecto si hay solape, recorte o desborde.
3. Si axe no está disponible en `node_modules`: ¿se valida con las comprobaciones manuales A3–A8 sin instalar nada? **Recomendado:** sí (`dependencias.md`), declarándolo en el informe.
4. Un hallazgo `MINOR` en pruebas o documentación: ¿se corrige en este PR o se acepta? **Recomendado:** decidirlo con el informe, como DEF-001 del PR 1.

**Aprobado por el usuario** ("Si"), con las autorizaciones y las cuatro recomendaciones.

## QA Report — PR 3

### Ronda

1 (2026-11-19), sobre el worktree `feature/REQ-F-049-pantallas` sin commit (52 entradas en `git status`, igual antes y después). MySQL 8.4 de QA `restaurante-qa-049c` en `127.0.0.1:3307`; la `api` y el admin del worktree y la `api`/admin de `main` con env propio en el scratchpad; Chrome headless con perfil temporal (9222). axe no está instalado: accesibilidad con comprobaciones manuales por CDP (respuesta 3).

### Pruebas ejecutadas

- `npm run build:css`, `typecheck` y `lint`: 0. `npm test`: api 52 archivos/1210 pruebas, landing-pages 62/897, inventory-manager 17/286, todo en verde.
- Duración en 3 ejecuciones aisladas: `inventory.test.ts` 1.45/1.13/1.10 s; `admin-inventory-e2e.test.ts` 4.07/4.02/3.86 s; `inventory-catalog.test.ts` 0.14/0.13/0.15 s.
- Sondas HTTP descartables (cliente sin JS: cookie, `_csrf` del formulario, `Origin`) contra la `api` y el admin reales: matriz P1 (72 comprobaciones), flujos F (86 + 4), F9 (503) y regresión G.
- CDP: 9 páginas + 422 × {360, 1440} × {gerente, admin}, teclado, skip link, cabecera y flujo sin JavaScript.

### Revisión estática

- R1: solo los archivos del Implementation Result; nada en landings, bot, `api/src`, `packages/`, `ops/`, `.github/` ni `package-lock.json`. Los `package.json` solo suman `inventory:seed-dev`. Ningún archivo nuevo en `public/js` ni `<script>` en las páginas (solo el `main.js` del layout ya existente).
- R2: suma de `deploy/` (método de `ci.yml`) = `591de8e7f259073f79ff34418c8b7a3a2680d465ef3bc7378c620221455cc7f0`. Igual.
- R3/R4: las 16 rutas van antes de `/:business`. Orden: mismo origen → campos cerrados (400) → sesión → rol (403 sin llamar a la API) → API. `INVENTORY_ROLES` sale de contracts. Se reutilizan los parciales y no hay CSS ni assets nuevos.
- R5: semilla y documentación con datos ficticios; sin secretos. Los logs solo llevan eventos, ids y códigos (se buscaron nombres, cuerpos, tokens y cookies: ninguno).

### Criterios de aceptación

| CA | Resultado | Evidencia |
| --- | --- | --- |
| CA-1 | PASS | Alta 303 a la ficha con "Artículo creado."; aparece en Activos; historial "Alta · QA qagerente". |
| CA-2 | PASS | "sal" con "Sal" activa → 422 en el campo; con "Sal" inactiva → 303. |
| CA-3 | PASS | SKU repetido (activo e inactivo) → 422 en `sku` con `aria-invalid`. |
| CA-4 | PASS | Coca-Cola de la semilla: "2 caja = 48 pza"; Masa QA: "2 bulto = 50 kg" y tabla con `caption` y `th scope`. |
| CA-5 | PASS | "500 g = 0.5 kg"; pza→kg → 422 con mensaje; `abc`, `-1`, vacío, `1e3` y una unidad inexistente → 422. |
| CA-6 | PASS | Factor 0 en la fila 2 se marca en `units.1.factor` y no en la 1; `-3`, `abc` y `1.2345` → 422 en su campo. |
| CA-7 | PASS | Padre "Existencias: No tiene"; variantes con SKU, unidad y estado propios; tipo y categoría heredados sin campo editable (un `categoryId` inyectado se ignora: queda la del padre); `?padre=` de variante o `abc` → 404. |
| CA-8 | PASS | Activos/Inactivos correctos (`estado=active|inactive`); reactivar 303. |
| CA-9 | PASS | 409 con "Última modificación: qaadmin, el 19/11/2026 06:54", lo escrito conservado y el primer cambio intacto; "Cargar la versión vigente" y "Guardar encima" (303, aplicado y en el historial). |
| CA-10 | PASS | Editor: 403 con el mensaje en 9 GET y 8 POST (con CSRF válido); 0 peticiones a `/api/v1/admin/inventario` en el log; sin "Inventario" en la cabecera. |
| CA-11 | PASS | Gerente creado desde Usuarios (negocio marcado ignorado: 0 filas en `user_business`); `/` → 303 `/inventario/articulos`; cabecera solo con "Inventario"; 403 en usuarios, bot, cotizador, productos y página (`/cotizador` 404: no existe esa ruta). |
| CA-12 | PASS | `inventory:seed-dev`: 18 artículos (6 insumos, 3 intermedios, 3 compuestos, 2 padres, 4 variantes), 7 categorías, 3 empaques y 25 cambios de "Semilla de desarrollo". La segunda vez no hace nada. La `api` arrancada sobre una base nueva deja `inventory_*` en 0. |
| CA-13 | PASS | Inactivar "Abarrotes" → 409 con el número de artículos activos y sin escrituras; sin uso → 303. |
| CA-14 | PASS | Suite verde; landings `/`, `/molotes` y `/birria` 200 con CTA; `/api/v1/public/*` 200; admin: productos, página, usuarios, bot, cotizador y cuenta 200; el editor como antes; webhook 503 sin bot configurado (igual que antes). |
| CA-15 | PASS | V1–V5 (abajo). |
| CA-16 | PASS | La consulta de §11.7 da `57 / 9 / 81` en el origen y en la restaurada; `CHECKSUM TABLE` idéntico en las 5 `inventory_*` y `user`. |
| CA-17 | PASS | Ver Responsive y Accesibilidad. |

### Semilla

- S3: se niega con `NODE_ENV=production` y con los hosts `10.0.0.1`, `db.example.com` y `127.0.0.2` (código 1, 0.4 s, sin conectar).
- S4: sobre una base sin migrar, sale con código 1 y "MIGRATIONS_PENDING", sin traza de Prisma.
- `api/src` no importa la semilla.

### Vuelta atrás y DT-2 (código de `main`)

- V3: con gerentes y `DATABASE_ALLOW_NEWER_SCHEMA=true`, Usuarios da 503 y el login del gerente 503. Las públicas, productos y página siguen 200 y el editor entra. Es lo documentado.
- V4: procedimiento de `despliegue.md` §6 ejecutado tal cual. Solo se cambió la conexión (`docker exec` en lugar de `$C`) y el nombre de la base.
  - Paso 1: lista al gerente y `tee` crea el archivo.
  - Paso 2: `gerentes_restantes = 0`. El gerente pasa a editor con `session_version` 0 → 1, y se borra el negocio que se le había puesto a mano. El editor no cambia.
  - Después, la `api` de `main` da 200 en Usuarios; la sesión anterior del exgerente queda cerrada (303 al acceso) y el exgerente entra sin negocios.
- V1: sin gerentes y sin la bandera, la `api` de `main` sale con código 1 y `DATABASE_NEWER_THAN_CODE`. V2: con la bandera, públicas, productos, página y bot 200.
- V5: la `api` del worktree arranca sin la bandera; el admin devuelve el rol Gerente desde Usuarios (303) y el gerente vuelve al inventario con los datos intactos.

### Mutaciones

| Mutación | Resultado |
| --- | --- |
| X1 sin comprobación de rol | Detectada (`inventory.test.ts`) |
| X2 enlace al editor | Detectada (`inventory.test.ts`, `bot-access.test.ts`) |
| X3 sin reenviar CSRF | Detectada (6 casos y la e2e) |
| X4a baja sin confirmación (`variants` siempre) | **Sobrevive** → DEF-003 |
| X4b confirmación sin la lista de variantes | **Sobrevive** → DEF-004 |
| X5a siempre "guardar encima" | Detectada (`inventory.test.ts` y la e2e) |
| X5b sin pintar el 409 | Detectada (`inventory.test.ts` y la e2e) |
| X6a semilla en producción | Detectada (`inventory-catalog.test.ts`) |
| X6b semilla contra host remoto | Detectada (`inventory-catalog.test.ts`) |
| X7 sin redirección del gerente | Detectada (`inventory.test.ts`) |

### Defectos encontrados

### DEF-003

- Severidad: `MAJOR` (de cobertura; el código es correcto).
- Criterio de aceptación afectado: RF-5 (inactivar el padre con confirmación de sus variantes), CA-7.
- Descripción: ninguna prueba detecta que el admin envíe `variants: "deactivate"` sin que el usuario lo haya confirmado. Con esa mutación pasan las 8 pruebas.
- Pasos para reproducir:
  1. Abrir `/inventario/articulos/<padre>/desactivar` con 0 variantes activas: el formulario no lleva `variants`.
  2. Reactivar una variante.
  3. Enviar el formulario viejo.
- Resultado esperado: 409 y una nueva confirmación que lista la variante. Es lo que hace el código actual: "El artículo tiene 1 variante activa: confirma que también se inactivan."
- Resultado actual con X4a: 303 `?ok=deactivated`, y la variante se inactiva sin haberse mostrado (comprobado contra la `api` real).
- Evidencia: X4a sobrevive; sonda de carrera sobre los artículos 21 y 22.
- Impacto: una regresión futura inactivaría variantes sin confirmación y nadie lo notaría.
- Recomendación: un caso en el que un POST de baja sin el campo de confirmación, sobre un padre con variantes activas, no inactive nada y vuelva a pedir la confirmación.

### DEF-004

- Severidad: `MINOR` (de cobertura).
- Criterio de aceptación afectado: RF-5.
- Descripción: la confirmación de baja puede dejar de listar los nombres de las variantes sin que ninguna prueba falle (X4b). La prueba solo comprueba "Tiene 1 variante activa: se inactivarán también.", y ese texto sigue en la página.
- Pasos para reproducir: quitar `{{{ variants }}}` de `inventory-item-deactivate.html` y ejecutar `inventory.test.ts`: 8/8 en verde.
- Resultado esperado: alguna prueba falla si la confirmación deja de nombrar las variantes que se inactivarán.
- Resultado actual: no falla ninguna.
- Evidencia: X4b sobrevive.
- Impacto: bajo; el aviso con el número de variantes se mantiene.
- Recomendación: comprobar en el mismo caso el nombre de la variante en la confirmación.

### DEF-005

- Severidad: `MINOR` (documental).
- Criterio de aceptación afectado: ninguno (documentación de la épica).
- Descripción: `restaurante/docs/arquitectura.md` §8, paso 5, línea 380, dice "T4 y T5 (REQ-F-050 a REQ-F-053, al refinarse)". Según el ticket (PV-9) y `git.md`, REQ-F-050 a REQ-F-053 son T2 a T5.
- Pasos para reproducir: leer esa línea de §8, paso 5 y compararla con PV-9 del ticket.
- Resultado esperado: que la documentación asigne REQ-F-050 a REQ-F-053 a T2 a T5.
- Resultado actual: los asigna solo a T4 y T5.
- Evidencia: `arquitectura.md`, línea 380.
- Impacto: confusión sobre la numeración de los tickets.
- Recomendación: atribuir los cuatro identificadores a T2 a T5.

### Regresión

Sin regresión. CA-14 en PASS; las mismas pruebas de admin y editor pasan con la `api` de `main` (V2).

### Responsive

- Sin desborde horizontal en ninguna página a 360 y 1440 px (`scrollWidth − clientWidth = 0`). La tabla de equivalencias cabe a 360 px.
- Cabecera, frente a AUD-006:
  - Admin: 273 px a 360 y 375 px en el inventario y en los negocios, y 217 px en Usuarios. Quitar el enlace "Inventario" no cambia nada (273 → 273, 217 → 217): el enlace no añade fila. Los 273 px en el inventario se deben a la subnavegación "Artículos | Categorías", igual que la de un negocio.
  - Gerente: 181 px en el inventario (125 px de cabecera más la subnavegación) y 125 px en Mi cuenta.
  - No empeora lo conocido. Queda anotado (respuesta 2).

### Accesibilidad

- Un `h1` por página y sin saltos de nivel.
- Landmarks `header`, `main` y `nav` con nombres distintos: "Secciones", "Secciones de Inventario" y "Páginas de resultados".
- `aria-current`: "Inventario" lleva `page`, y "Artículos" o "Categorías" `true`.
- Todos los campos tienen etiqueta y ningún `aria-describedby` está roto.
- En el 422, el resumen (`role="alert"`, `tabindex="-1"`) recibe el foco y sus enlaces van a cada campo. Los errores llevan texto e icono ⚠.
- Teclado: el skip link es la primera parada y Enter lleva a `main#contenido`. El orden de foco es lógico (cabecera → subnavegación → acciones → filtros) y todas las paradas tienen foco visible.
- Contraste WCAG calculado sobre todo el texto visible: 0 fallos.
- Objetivos táctiles:
  - Los controles miden ≥ 42 px de alto y los botones ≥ 44 px.
  - Los nombres de artículo en las tarjetas, "Volver a artículos" y los enlaces del resumen de errores (componente reutilizado) miden 17 px de alto. Cumplen 2.5.8 por la excepción de espaciado: cada uno es el único objetivo de su fila o tarjeta. Quedan por debajo de los 44 px recomendados.
- Sin JavaScript (Chrome con scripts desactivados, 360 px): alta 303 a la ficha, conversión "3 costal = 150 kg" y filtro por GET, como gerente y como administrador.

### UX/UI

Sistema visual del admin sin componentes nuevos; capturas a 360 y 1440 px revisadas (sin datos personales, ya borradas). Observaciones, sin defecto:

1. El 409 muestra el usuario ("qaadmin"), mientras que el historial muestra el nombre visible ("QA qaadmin").
2. El resumen del 422 ordena los errores Tipo → Categoría → Nombre → Unidad, y el formulario empieza por Nombre.
3. La semilla imprime ".env not found. Continuing without it." (aviso de Node por `--env-file-if-exists`, igual que en `admin:recover`).

### Performance

Sin JS nuevo ni recursos nuevos. En consola solo aparecen los 404 y 422 provocados a propósito.

### SEO

No aplica: es el admin, con `X-Robots-Tag: noindex, nofollow`.

### Pendientes de revisión manual

- `verify-backup.sh --drill` tras desplegar la épica (usuario).
- Vuelta atrás con la imagen `production` en el PR de la épica hacia `main`.

### Limpieza

- Bases `restaurante_test_qa049c` y `_rest` borradas (la `_vacia`, al terminar S4). `docker compose -p restaurante-qa-049c down -v`: sin contenedor, volumen ni redes de QA.
- `restaurante-mysql-dev-1` sigue apagado, como estaba.
- Sin procesos `server.ts`, vitest ni Chrome; puertos 3000–3009, 3307 y 9222 libres.
- Scratchpad sin la copia de mutaciones, el perfil de Chrome, capturas, env, logs ni volcados.
- `git worktree list` igual; `git status` del worktree igual (52 entradas); árbol principal en `main` sin cambios.

### Resultado final

NEEDS_USER_DECISION

### Ronda 2

Revalidación tras la corrección de DEF-003, DEF-004 y DEF-005 por senior-fullstack (decisión del usuario: "Si"). Sin Docker ni MySQL.

- **Qué cambió.** Archivos modificados después de la ronda 1 (`find -newermt`, fuera de `node_modules`):
  - `inventory-manager/tests/integration/inventory.test.ts`: un caso nuevo.
  - `docs/arquitectura.md`: una línea.
  - el ticket.
  - `src/controllers/inventory.ts` y `src/views/pages/inventory-item-deactivate.html`: cambió la fecha de modificación (07:25), pero no el contenido de producción. Comprobado frente a la ronda 1: 532 líneas, la línea 434 (`variants` solo si el formulario lo trae) idéntica, y la plantilla con `{{{ variants }}}`. Son restos de mutaciones aplicadas y revertidas en el sitio.
  - `api`, `packages` y `landing-pages`: sin cambios nuevos (`git diff --name-only` igual a la ronda 1; `git status` con 52 entradas).
- **DEF-003: corregido.** En una copia APFS del árbol en el scratchpad, X4a (`variants: 'deactivate'` siempre) hace fallar `inventory.test.ts` (1 de 9, el caso nuevo).
- **DEF-004: corregido.** X4b (sin `{{{ variants }}}`) hace fallar el mismo caso. Sin mutación pasan las 9 pruebas.
- **DEF-005: corregido.** La línea 381 de `arquitectura.md` dice "T4 y T5; T2 a T5 son REQ-F-050 a REQ-F-053, al refinarse". `despliegue.md` y `README.md` no mencionan REQ-F-050 a REQ-F-053.
- **Comprobaciones.**
  - `npm run typecheck` y `npm run lint`: 0.
  - `inventory-manager`: 17 archivos y 287 pruebas en verde.
  - `inventory.test.ts` en 3 ejecuciones: 1.21, 1.28 y 1.21 s.
  - El caso nuevo es funcional (RF-5) y no duplica otro: cumple `testing.md`.
- **No repetido, porque no cambió lo que comprueba:**
  - suites de `api` y `landing-pages`, y sondas HTTP contra MySQL (sin cambios de código de producción);
  - CA en pantalla, accesibilidad y responsive (la vista no cambió);
  - semilla, vuelta atrás, DT-2 y respaldo (sin cambios);
  - el resto de mutaciones (su código no cambió).
- **Limpieza.**
  - Copia del árbol del scratchpad borrada; sin procesos vitest ni `server.ts`.
  - `git worktree list` sin worktrees nuevos y `git status` del worktree con 52 entradas.
  - No se usó Docker.

Resultado final de la ronda 2: QA_APPROVED

## Plan técnico de T2 a T5 (aprobado 2026-11-19)

Copia íntegra del plan técnico completo de T2 a T5 de senior-fullstack, aprobado por el usuario ("apruebo las recomedaciones").

# Plan técnico completo — Épica de inventario (T2 a T5: REQ-F-050 a REQ-F-053)

Autor: senior-fullstack, 2026-11-18. Solo lectura y redacción: nada modificado en el repositorio ni en el ticket.

Fuentes: ticket `REQ-F-049` (marco, D-1 a D-4, PV-1 a PV-14 y TAP de T1); implementación del PR 1 de T1 sin commit en el worktree `agent-a695af6eae346107d` (`schema.prisma`, migración `20261119004332_inventario_catalogo`, `packages/core/inventory/*`, `packages/db/src/prisma-inventory-store.ts`); `deploy/mysql/initdb/01-usuarios.sh` (grants), `compose.yaml` y `deploy/compose.prod.yaml` (espera de bloqueo), `packages/db/src/client.ts` (pool), `api/src/config.ts` (`BUSINESS_TIMEZONE` ya existe en la api), `landing-pages/tests/support/database.ts` (TRUNCATE).
NotebookLM: no se consultó en esta fase (encargo de solo lectura con créditos limitados; ningún cuaderno conocido cubre el inventario). Todo lo que sigue sale del repositorio o es una propuesta mía, marcada como tal.

## 0. Base heredada de T1 (lo que T2 a T5 deben respetar)

| Aspecto | Lo implementado en T1 (worktree) | Consecuencia para T2 a T5 |
| --- | --- | --- |
| Precisión | `decimal.ts`: `bigint` escalado; `QUANTITY_SCALE = 3`, `parseDecimal`, `formatDecimal`, `divideRounded` (mitad hacia arriba), `multiplyDecimals(a, aEsc, b, bEsc, outEsc)` | Cantidades `DECIMAL(13,3)`, costos unitarios `DECIMAL(15,4)`, importes `DECIMAL(19,4)`. Se añade `COST_SCALE = 4` y `PERCENT_SCALE = 2`. Core nunca ve `Prisma.Decimal`; el store escribe texto. |
| Colación | Cada `CREATE TABLE … DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs`, revisado a mano | Igual en cada migración nueva (`migrations-collation.test.ts` lo vigila). |
| Unicidad sin mayúsculas | `name_key` + `active_name_key` único y nulo cuando está inactivo | Mismo patrón para proveedores y para "una sola versión vigente" de receta. |
| Historial | `inventory_change` (`entity` VarChar(16), `action` VarChar(32), `changes` JSON en MediumText) | T2 añade `entity = 'recipe'`; T4 `entity = 'item'` para el punto de reorden. Sin tabla nueva de historial. |
| Bloqueo por uso (RN-4) | `store.isInUse(itemId)` devuelve `false` | T2: `true` si aparece en una línea de receta o tiene versiones; T3: también si tiene movimientos. |
| Transacciones | `WRITE_TX = { Serializable, maxWait 5000, timeout 10000 }`; pool `connectionLimit 5`, `acquireTimeout 5000` | El Kardex NO usa Serializable (ver 2.3). |
| Enums | Prisma `enum` → `ENUM` de MySQL | Un valor nuevo de ENUM rompe la lectura en una imagen anterior (Prisma lanza): en T3 se define la lista completa de tipos de movimiento (ver DT-9). |
| Grants | `restaurante_app`: DML sobre `restaurante.*`; `restaurante_migrator`: DDL sin `TRIGGER`; `restaurante_backup`: incluye `TRIGGER` | Sin tocar `deploy/`, la base no puede imponer la inmutabilidad (ver 2.3). |

## 1. Partición en PR, destino y tamaño

| Ticket | PR | Contenido | Destino | Tamaño |
| --- | --- | --- | --- | --- |
| T2 REQ-F-050 | 1 | Migración `inventario_recetas` + `core/inventory/recipe-*.ts` (esquema, DAG, costo) + store memoria/Prisma + `isInUse` + pruebas unitarias y de MySQL | `epic/inventario` | M |
| | 2 | Contratos `inventory-recipes` + rutas api + cliente + pruebas de API | `epic/inventario` | M |
| | 3 | Pantallas (editor de receta: propuesta Stitch previa si el usuario la aprueba) + docs + pruebas del admin | `epic/inventario` | M |
| T3 REQ-F-051 | 1 | Migración `inventario_kardex` + `core/inventory/kardex-*.ts` (CPP, saldo, reversión) + stores + comando `inventory:verify` + pruebas (incluida concurrencia en MySQL) | `epic/inventario` | L |
| | 2 | Contratos y rutas: proveedores, saldo inicial, compras, reversión, Kardex por artículo + pruebas de API | `epic/inventario` | M |
| | 3 | Pantallas + costo real en recetas y fichas + docs (`despliegue.md` §6, §9, §11) + pruebas del admin + cadena punta a punta | `epic/inventario` | M |
| — | 4 | PR `epic/inventario` → `main` (CI completo con humo de despliegue y respaldos) | `main` | — |
| T4 REQ-F-052 | 1 | Migración `inventario_produccion` (lotes, conteos, punto de reorden) + `rol_cocina` + core + stores + pruebas | `main` | L |
| | 2 | Contratos y rutas + rol en usuarios + pruebas de API | `main` | M |
| | 3 | Pantallas (lotes, mermas, consumo, conteos, alertas) + docs + pruebas del admin | `main` | M |
| T5 REQ-F-053 | 1 | Migración `inventario_reportes` (solo índices) + consultas en store + rutas + pruebas | `main` | M |
| | 2 | Pantallas de reportes + docs + pruebas del admin | `main` | S/M |

Total: 11 PR de ticket + el PR de la épica. Se puede fusionar PR 2 y 3 de cada ticket si el usuario prefiere menos ciclos (DT-1).

## 2. Esquema de datos y decisiones por ticket

### 2.1 T2 — Recetas multinivel (migración `inventario_recetas`)

```sql
-- Aditiva: solo crea tablas nuevas. La versión anterior funciona con ella (DATABASE_ALLOW_NEWER_SCHEMA).
CREATE TABLE `inventory_recipe_version` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `item_id` INTEGER NOT NULL,                 -- intermedio o compuesto (simple o variante), nunca parent
  `number` INTEGER NOT NULL,                  -- 1, 2, 3… por artículo
  `yield_quantity` DECIMAL(13,3) NOT NULL,    -- rendimiento en la unidad base del artículo (> 0)
  `valid_from` DATETIME(3) NOT NULL,
  `valid_to` DATETIME(3) NULL,                -- null = vigente
  `current_item_id` INTEGER NULL,             -- = item_id si vigente; null si cerrada
  `note` VARCHAR(400) NULL,
  `created_at` DATETIME(3) NOT NULL,
  `created_by_id` INTEGER NULL, `created_by_name` VARCHAR(60) NOT NULL,
  UNIQUE INDEX `inventory_recipe_version_item_id_number_key`(`item_id`, `number`),
  UNIQUE INDEX `inventory_recipe_version_current_item_id_key`(`current_item_id`),
  INDEX `inventory_recipe_version_item_id_valid_from_idx`(`item_id`, `valid_from`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;

CREATE TABLE `inventory_recipe_line` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `version_id` INTEGER NOT NULL,
  `position` INTEGER NOT NULL,
  `ingredient_item_id` INTEGER NOT NULL,      -- insumo, intermedio o reventa; activo al crear la versión
  `quantity` DECIMAL(13,3) NOT NULL,          -- neta, en la unidad de receta tal como se capturó
  `unit` VARCHAR(30) NOT NULL,                -- unidad del sistema o nombre de empaque del ingrediente
  `net_base_quantity` DECIMAL(13,3) NOT NULL, -- neta en la unidad base del ingrediente (instantánea)
  `waste_percent` DECIMAL(5,2) NOT NULL,      -- [0, 100)
  `gross_base_quantity` DECIMAL(13,3) NOT NULL, -- neta/(1−merma), mitad hacia arriba
  UNIQUE INDEX (`version_id`, `position`),
  UNIQUE INDEX (`version_id`, `ingredient_item_id`),
  INDEX (`ingredient_item_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;

CREATE TABLE `inventory_lock` (               -- candados de aplicación (una fila por ámbito)
  `name` VARCHAR(32) NOT NULL, PRIMARY KEY (`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;
INSERT INTO `inventory_lock` (`name`) VALUES ('recetas');
-- FK: version.item_id → inventory_item, version.current_item_id → inventory_item, line.version_id → version,
-- line.ingredient_item_id → inventory_item (todas ON DELETE RESTRICT).
```

Decisiones (a):

- **Versiones inmutables y una sola vigente.** MySQL no tiene índices parciales: se usa `current_item_id` único y nulo al cerrar (el patrón `active_name_key` de T1). Crear versión = en una transacción: candado `recetas`, `UPDATE … SET valid_to = now, current_item_id = NULL WHERE current_item_id = :item`, `INSERT` de la nueva con `valid_from = now` (mismo instante: intervalos `[valid_from, valid_to)` contiguos) y sus líneas, y la entrada `inventory_change` (`entity 'recipe'`, `action 'new_version'`). Las líneas nunca se actualizan; la única escritura sobre una versión cerrada es la del cierre. El store no expone ningún otro `update`/`delete` sobre estas tablas. "Desactivar receta" = cerrar la vigente sin crear otra (`action 'close'`). `valid_from` lo pone el servidor; no se programan versiones futuras.
- **Líneas.** Cantidad neta > 0, unidad del sistema de la misma magnitud o empaque del ingrediente (conversión con `units.ts`; sin factor → 422), merma con 2 decimales en [0, 100) (100 → 422), máximo 40 líneas, ingrediente repetido rechazado, ingrediente activo y no `parent` ni `compuesto` (un platillo no es ingrediente de otro en esta épica; ver P-3). Se guardan la captura y la instantánea en unidad base: como RN-4 bloquea los factores en cuanto el artículo está en una receta, la instantánea nunca diverge.
- **Bruta** = `divideRounded(net × 10 000, 10 000 − merma×100)` en escala 3 (merma en centésimas de punto: `bigint`), mitad hacia arriba, coherente con REQ-F-046 RN-1.
- **DAG (RN-5).** Al guardar la versión de X: cargar en una consulta todas las líneas de las versiones vigentes (cientos de filas), construir la adyacencia en memoria y hacer DFS desde cada ingrediente de X buscando X (coste O(V+E) del subgrafo alcanzable, < 1 ms con cientos de nodos; profundidad máxima 8, más → 422 "demasiados niveles"). Error 422 `RECIPE_CYCLE` con la ruta ("Salsa → Adobo → Salsa"). Carrera A→B y B→A simultáneas: el candado `SELECT … FROM inventory_lock WHERE name='recetas' FOR UPDATE` serializa las escrituras de recetas (poco frecuentes), así que la segunda ve la primera y detecta el ciclo. Evita depender de interbloqueos de Serializable.
- **Costo teórico.** `costoUnitario(art)`: insumo o reventa → CPP vigente (T3); intermedio con receta vigente → Σ(bruta × costoUnitario(ingrediente)) / rendimiento, recursivo con memoización por petición (DT-7: se explota hasta los insumos; el CPP propio del intermedio producido se muestra aparte desde T4). Aritmética: `multiplyDecimals(bruta, 3, costo, 4, 7)`, suma en escala 7, división por el rendimiento a escala 4 con `divideRounded`; se muestra a 2 decimales. Sin CPP (antes de T3, o un insumo sin compras): el resultado es `{ status: 'incomplete', missing: [ids] }` y la pantalla dice "Sin costo" con la lista de ingredientes sin costo; nunca se trata como 0. **Sin caché**: se recalcula en cada lectura (volumen pequeño; una consulta de líneas vigentes + una de saldos). Si un día pesa, una caché por petición basta.
- **Inactivar un artículo usado en recetas vigentes** (insumo o sub-receta): se permite con confirmación, como las variantes de T1: sin ella 409 `ITEM_IN_ACTIVE_RECIPES` con el número; las versiones vigentes siguen igual (historia intacta) y muestran "usa un artículo inactivo"; una versión nueva no puede añadirlo. Inactivar un intermedio no cierra su receta.
- `isInUse` (RN-4): `true` si el artículo tiene versiones o aparece en líneas.

### 2.2 T3 — Kardex, proveedores, compras, CPP, saldo inicial (migración `inventario_kardex`)

```sql
CREATE TABLE `inventory_supplier` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(80) NOT NULL, `name_key` VARCHAR(160) NOT NULL,
  `active_name_key` VARCHAR(160) NULL UNIQUE,
  `contact` VARCHAR(120) NULL,                -- PV-7: un contacto mínimo (teléfono o correo), nada más
  `active` BOOLEAN NOT NULL DEFAULT true, `version` INTEGER NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL, `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;

CREATE TABLE `inventory_stock` (               -- proyección mutable del Kardex (una fila por artículo no parent)
  `item_id` INTEGER NOT NULL,
  `quantity` DECIMAL(13,3) NOT NULL DEFAULT 0, -- con signo: PV-2 permite negativos
  `avg_cost` DECIMAL(15,4) NULL,              -- CPP; null = sin costo
  `last_cost` DECIMAL(15,4) NULL,
  `last_seq` INTEGER NOT NULL DEFAULT 0,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;
INSERT INTO `inventory_stock` (`item_id`, `updated_at`)
  SELECT `id`, CURRENT_TIMESTAMP(3) FROM `inventory_item` WHERE `kind` <> 'parent';

CREATE TABLE `inventory_document` (            -- documento de referencia (cabecera), inmutable
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `type` ENUM('saldo_inicial','compra','reversion','ajuste','merma','consumo_interno','produccion','conteo','venta','devolucion_venta') NOT NULL,
  `occurred_on` DATE NOT NULL,                -- fecha del hecho en BUSINESS_TIMEZONE (factura)
  `recorded_at` DATETIME(3) NOT NULL,
  `supplier_id` INTEGER NULL,                 -- compras
  `reference` VARCHAR(40) NULL,               -- folio de factura o nota
  `cost_basis` ENUM('con_iva','sin_iva') NULL,-- PV-6: criterio con el que se registró la compra
  `reason` VARCHAR(32) NULL,                  -- T4: motivo de lista cerrada (validado en core)
  `note` VARCHAR(400) NULL,
  `total_cost` DECIMAL(19,4) NOT NULL,
  `reverses_document_id` INTEGER NULL UNIQUE, -- una reversión por documento
  `idempotency_key` VARCHAR(80) NULL UNIQUE,  -- ámbito + requestId del formulario
  `actor_id` INTEGER NULL, `actor_name` VARCHAR(60) NOT NULL,
  INDEX (`type`, `recorded_at`), INDEX (`supplier_id`, `recorded_at`), INDEX (`recorded_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;

CREATE TABLE `inventory_movement` (            -- Kardex: solo altas
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `document_id` INTEGER NOT NULL,
  `item_id` INTEGER NOT NULL,
  `seq` INTEGER NOT NULL,                     -- 1, 2, 3… por artículo, sin huecos
  `type` (mismo ENUM que el documento) NOT NULL,
  `quantity` DECIMAL(13,3) NOT NULL,          -- con signo: + entrada, − salida (≠ 0)
  `entered_quantity` DECIMAL(13,3) NOT NULL, `entered_unit` VARCHAR(30) NOT NULL,
  `balance_before` DECIMAL(13,3) NOT NULL, `balance_after` DECIMAL(13,3) NOT NULL,
  `unit_cost` DECIMAL(15,4) NULL,             -- costo aplicado (compra: pagado/unidad base; salida: CPP)
  `line_total` DECIMAL(19,4) NULL,            -- compra: importe pagado tal como se capturó
  `avg_cost_before` DECIMAL(15,4) NULL, `avg_cost_after` DECIMAL(15,4) NULL,
  `recorded_at` DATETIME(3) NOT NULL,
  `actor_id` INTEGER NULL, `actor_name` VARCHAR(60) NOT NULL,
  UNIQUE INDEX (`item_id`, `seq`),
  INDEX (`item_id`, `recorded_at`), INDEX (`document_id`), INDEX (`type`, `recorded_at`), INDEX (`recorded_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;
-- FK: stock.item_id, movement.item_id → inventory_item; movement.document_id → document;
-- document.supplier_id → supplier; document.reverses_document_id → document; actor_id → user. RESTRICT.
```

Decisiones (b):

- **Inmutabilidad del Kardex (DT-5).** Opciones:
  | Opción | Pros | Contras |
  | --- | --- | --- |
  | Solo dominio: el store no tiene `update`/`delete` de documento ni movimiento; regla de ESLint (`no-restricted-syntax`) que prohíbe `inventoryMovement.update*/delete*/upsert` e `inventoryDocument.*` igual fuera del store; comando `inventory:verify` que comprueba la cadena | Sin tocar `deploy/` ni el VPS; compatible con TRUNCATE de pruebas y con la vuelta atrás | Un acceso SQL manual con el usuario de la app podría alterar filas (lo detecta `verify`) |
  | Grants por tabla (quitar UPDATE/DELETE a `restaurante_app`) | Garantía en la base | MySQL no revoca una tabla de un grant `restaurante.*`: hay que rehacer todos los grants por tabla en `01-usuarios.sh` y a mano en el VPS, y mantenerlos en cada tabla nueva |
  | Triggers `BEFORE UPDATE/DELETE … SIGNAL` | Garantía en la base | `restaurante_migrator` no tiene `TRIGGER`; con binlog hace falta `log_bin_trust_function_creators`; cambia `deploy/` y el VPS; las restauraciones deben llevar los triggers |
  Recomendación: **solo dominio + lint + `inventory:verify`** ahora; triggers como endurecimiento posterior en un ticket de operación si el usuario lo quiere.
- **`inventory:verify`** (`api/scripts/inventory-verify.ts`, solo lectura): para cada artículo, `seq` contiguo, `balance_before(n) = balance_after(n−1)`, `balance_after = before + quantity`, y `inventory_stock.quantity/last_seq/avg_cost` = último movimiento. Sale con 1 si algo no cuadra. Se usa en el simulacro de restauración (sustituye a ampliar el manifiesto de respaldos).
- **Saldo y bloqueo por fila.** Toda escritura del Kardex: transacción `ReadCommitted` (no Serializable: evita los bloqueos compartidos implícitos y los interbloqueos de rango), `timeout 10 000`, `maxWait 5 000`; primero `SELECT … FROM inventory_stock WHERE item_id IN (…) ORDER BY item_id FOR UPDATE` (`$queryRaw`, orden ascendente fijo = sin interbloqueos entre documentos de varios artículos), después cálculo en core y `INSERT` de documento y movimientos y `UPDATE` de los saldos. Interbloqueo (1213) → reintento acotado (3); espera agotada (1205, 10 s en producción, 5 s en pruebas) → 503 `INVENTORY_BUSY` "Inténtalo de nuevo". Las filas de saldo existen siempre: la migración las crea para los artículos de T1 y el alta de un artículo no parent (repositorio de T1, ajuste mínimo) las crea en su transacción. El cambio de unidad o empaques (RN-4) toma también el `FOR UPDATE` de su saldo antes de `isInUse`, así un primer movimiento simultáneo no se cuela.
- **Pool de 5.** Transacciones cortas (una lectura bloqueante, N inserciones en un `createMany`, N updates): ~10–30 ms. Un documento admite como máximo 50 líneas. Sin llamadas externas dentro de la transacción.
- **CPP (RN-9) en enteros.** `q` escala 3, `c` escala 4. Entrada con costo `k` y cantidad `d`: si `q ≤ 0` o `c` nulo → `c' = k`; si no, `c' = divideRounded(q·c + d·k, q + d)` (numerador escala 7 / denominador escala 3 = escala 4, mitad hacia arriba). Salidas: `unit_cost = c`, CPP sin cambio; con `c` nulo, salida sin costo (se marca). `last_cost = k`.
- **Compra.** Cabecera: proveedor (opcional, activo), fecha del hecho (`occurred_on`: hoy o hasta 31 días atrás, nunca futura; DT-8), folio, criterio de IVA (por defecto `con_iva`, PV-6), nota. Líneas: artículo activo de tipo insumo o reventa (o intermedio comprado: P-4), cantidad en unidad del sistema o empaque, **importe pagado de la línea** (escala 4). Costo por unidad base = importe / cantidad base (escala 4). Importe 0 se permite (regalo) con aviso. El Kardex se ordena por `seq` (orden de registro); `occurred_on` es informativo y filtra reportes de compras.
- **Saldo inicial (PV-5).** Documento `saldo_inicial` con varias líneas (cantidad ≥ 0 y costo unitario); solo para artículos con `last_seq = 0`, si no 409 `INITIAL_BALANCE_NOT_ALLOWED` ("Usa un ajuste o un conteo").
- **Corrección (RN-8).** Reversión de un documento completo, una vez (`reverses_document_id` único): movimientos contrarios. Compra revertida: salida al costo de la compra; CPP = `(q·c − d·k)/(q − d)` si `q − d > 0`, si no se conserva `c`. Reversión de salidas: entrada al costo con que salió.
- **Idempotencia.** Persistente (dinero): `idempotency_key` único en el documento (`compra:<requestId>`); P2002 en esa clave → 200 con el documento existente. El store en memoria de T1 (`createIdempotencyStore`) no sobrevive a un reinicio: no basta aquí.
- **Respaldo y restauración.** `mysqldump --databases restaurante` ya incluye las tablas; `restore.sh` sin cambios; simulacro (`verify-backup.sh --drill`, §11.8) + `npm run inventory:verify` contra la base restaurada.

### 2.3 T4 — Producción, mermas, consumo interno, conteos, reorden, rol Cocina (migraciones `inventario_produccion` y `rol_cocina`)

```sql
CREATE TABLE `inventory_production` (           -- detalle del lote (1:1 con su documento 'produccion')
  `document_id` INTEGER NOT NULL,
  `item_id` INTEGER NOT NULL,                   -- intermedio producido
  `recipe_version_id` INTEGER NOT NULL,         -- versión vigente al registrar
  `batches` DECIMAL(13,3) NOT NULL,             -- tandas de receta (consumo = líneas × tandas)
  `expected_quantity` DECIMAL(13,3) NOT NULL,   -- rendimiento × tandas
  `actual_quantity` DECIMAL(13,3) NOT NULL,     -- lo que realmente salió (entra al Kardex)
  PRIMARY KEY (`document_id`)
) …;
CREATE TABLE `inventory_count` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `status` ENUM('abierto','aplicado','cancelado') NOT NULL,
  `category_id` INTEGER NULL, `note` VARCHAR(400) NULL,
  `opened_at` DATETIME(3) NOT NULL, `closed_at` DATETIME(3) NULL,
  `document_id` INTEGER NULL UNIQUE,            -- documento 'conteo' al aplicar
  `version` INTEGER NOT NULL DEFAULT 1,
  `actor_id` INTEGER NULL, `actor_name` VARCHAR(60) NOT NULL, PRIMARY KEY (`id`)
) …;
CREATE TABLE `inventory_count_line` (
  `count_id` INTEGER NOT NULL, `item_id` INTEGER NOT NULL,
  `counted_quantity` DECIMAL(13,3) NOT NULL, `entered_quantity` DECIMAL(13,3) NOT NULL, `entered_unit` VARCHAR(30) NOT NULL,
  `seq_at_count` INTEGER NOT NULL,              -- last_seq del artículo al capturar
  `balance_at_count` DECIMAL(13,3) NOT NULL,
  `reason` VARCHAR(32) NULL,                    -- obligatorio si hay diferencia
  `counted_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`count_id`, `item_id`)
) …;
ALTER TABLE `inventory_item` ADD COLUMN `min_quantity` DECIMAL(13,3) NULL, ADD COLUMN `reorder_point` DECIMAL(13,3) NULL;
-- rol_cocina (aparte):
ALTER TABLE `user` MODIFY `role` ENUM('admin','editor','gerente','cocina') NOT NULL;
```

Decisiones (c):

- **Lote atómico (RN-10).** Una transacción: versión vigente del intermedio (si no tiene → 409 `NO_ACTIVE_RECIPE`), consumo de cada ingrediente = `gross_base_quantity × tandas` (un nivel: consume existencias de intermedios, no las vuelve a explotar), bloqueo `FOR UPDATE` de todos los saldos (ingredientes + producto) en orden de `item_id`, salidas al CPP, entrada del producto con `unit_cost = Σ valor consumido / actual_quantity` (actualiza su CPP). Saldos negativos permitidos (PV-2) y señalados. Todo o nada. Diferencia entre esperado y real queda en `inventory_production` (rendimiento real; DT-10).
- **Mermas, consumo interno y ajustes (RN-11).** Documentos con `reason` de lista cerrada en core (`VARCHAR` y no ENUM, para poder ampliarla sin romper la vuelta atrás). Propuesta (P-5): merma = `caducidad`, `dano`, `preparacion`, `derrame`, `otro`; consumo interno = `comida_personal`, `prueba`, `otro`; ajuste = `error_captura`, `otro`. `otro` exige nota. Ajuste de entrada sin costo usa el CPP vigente.
- **Conteos concurrentes con movimientos.** Cada línea guarda `seq_at_count` y `balance_at_count` al capturarla. Al aplicar: diferencia = contado − `balance_at_count`; se aplica como movimiento `conteo` sobre el saldo actual (saldo nuevo = actual + diferencia), así los movimientos posteriores a la captura no se pierden ni se duplican. Diferencia ≠ 0 exige motivo. Aplicar bloquea los saldos en orden. Un conteo abierto no bloquea la operación.
- **Reorden y alertas.** `reorder_point` y `min_quantity` en el artículo (edición del catálogo con historial; `ADD COLUMN NULL` es instantáneo en MySQL 8.4 y la imagen anterior lo ignora). Crítico = `quantity ≤ reorder_point` o `quantity < 0`. Alertas calculadas al consultar (sin tabla de alertas ni notificaciones salientes; P-6): aviso en la cabecera del inventario con el número de críticos y la lista.
- **Rol Cocina/Producción.** Mismo procedimiento que el gerente (core `ROLES`, contratos, `user-repository`, pantalla de usuarios, sin negocios). Riesgo de vuelta atrás manual a una imagen sin `cocina`: el procedimiento DT-2 de T1 se amplía (`UPDATE user SET role='editor', session_version=session_version+1 WHERE role IN ('gerente','cocina')`). La vuelta atrás automática del despliegue de T4 no lo sufre (aún no hay cocineros).

### 2.4 T5 — Reportes (migración `inventario_reportes`, solo índices si las mediciones lo piden)

- **Kardex filtrable:** artículo, tipo, usuario, documento, rango de fechas. Rangos en `BUSINESS_TIMEZONE` (la api ya la tiene): el día local se convierte a `[inicio, fin)` en UTC en core con `Intl` (como `schedule`). Paginación por clave (`id < :cursor ORDER BY id DESC LIMIT 50`) con los índices de T3 `(item_id, recorded_at)`, `(type, recorded_at)`, `(recorded_at)`; si se filtra por usuario, índice `(actor_id, recorded_at)` en esta migración.
- **Valorización:** actual = Σ `inventory_stock.quantity × avg_cost` (una consulta, agrupada por categoría y tipo; negativos y "sin costo" aparte). A una fecha (DT-11): último movimiento de cada artículo con `recorded_at < fin` (`balance_after × avg_cost_after`) con el índice `(item_id, recorded_at)`.
- **Stock crítico:** consulta de T4, ordenada por déficit.
- **Historial de compras y evolución de precios:** documentos `compra` por proveedor, artículo y fecha (`occurred_on`); evolución = tabla de `unit_cost` por compra de un artículo (sin gráfica con JavaScript; P-7).
- **Exportación:** el marco de la épica no la pide → **no** se incluye (DT-12); si el usuario la quiere, CSV desde la api con escape contra inyección de fórmulas.
- **Rendimiento:** todas las consultas por índice y paginadas; sin N+1; lectura en `READ_TX`. Volumen esperado: miles de movimientos al mes.

## 3. Contratos, endpoints y pantallas

Todas bajo `/api/v1/admin/inventario/…`, con `access.inventory(ctx, { write, permission })` (401 → 403 `FORBIDDEN_ROLE` → CSRF 403), JSON cerrado, cantidades y costos como texto decimal, errores con el formato central.

| Ticket | Rutas (api) | Códigos propios |
| --- | --- | --- |
| T2 | `GET articulos/:id/recetas` (vigente + versiones), `GET recetas/versiones/:id` (líneas + costo teórico), `POST articulos/:id/recetas` (nueva versión, `Idempotency-Key`), `POST articulos/:id/recetas/cerrar`, `GET recetas` (lista de artículos con receta y su costo) | 422 `RECIPE_CYCLE`, `fields`; 409 `ITEM_IN_ACTIVE_RECIPES`, `RECIPE_NOT_ALLOWED` |
| T3 | `GET/POST proveedores`, `PUT proveedores/:id`, `POST …/desactivar|reactivar`; `POST documentos/saldo-inicial`, `POST documentos/compras`, `POST documentos/:id/reversion`, `GET documentos/:id`; `GET existencias?q=&categoria=&pagina=`; `GET articulos/:id/kardex?pagina=` | 409 `INITIAL_BALANCE_NOT_ALLOWED`, `ALREADY_REVERSED`; 503 `INVENTORY_BUSY` |
| T4 | `POST documentos/produccion`, `POST documentos/mermas`, `POST documentos/consumo-interno`, `POST documentos/ajustes`; `GET/POST conteos`, `PUT conteos/:id/lineas`, `POST conteos/:id/aplicar|cancelar`; `GET criticos` | 409 `NO_ACTIVE_RECIPE`, `COUNT_CLOSED` |
| T5 | `GET reportes/kardex`, `GET reportes/valorizacion?fecha=`, `GET reportes/criticos`, `GET reportes/compras`, `GET reportes/precios/:itemId` | 422 filtros |

Permisos (core `authorization.ts`, `canInventory(user, permiso)`):

| Permiso | Admin | Gerente | Cocina (T4) | Editor |
| --- | --- | --- | --- | --- |
| Catálogo y recetas (escribir) | sí | sí | no | no |
| Recetas y existencias (leer) | sí | sí | sí, sin costos | no |
| Proveedores, compras, saldo inicial, reversiones | sí | sí | no | no |
| Lotes, mermas, consumo interno | sí | sí | sí | no |
| Ajustes y conteos | sí | sí | no (P-8) | no |
| Reportes con costos | sí | sí | no | no |

Pantallas SSR (`inventory-manager/src/controllers/inventory-*.ts`, `views/pages/inventory-*.html`, subnavegación "Artículos | Categorías | Recetas | Existencias | Compras | Producción | Conteos | Reportes" según rol):

- T2: receta del artículo (versión vigente, historial de versiones, costo teórico o "Sin costo" con faltantes) y editor de versión: formulario con filas fijas (`row-fieldset`, 40 filas en bloques de 10 con "Añadir más filas" por GET, sin JS). Es la única pantalla candidata a Stitch (PV-8): propuesta y aprobación del usuario antes del PR 3.
- T3: proveedores (lista y formulario), existencias (lista con saldo, CPP, valor y estado negativo), alta de compra (cabecera + 15 filas), saldo inicial (filas), documento (detalle + "Revertir" con confirmación), Kardex del artículo en su ficha; la ficha y las recetas muestran el CPP y el costo real.
- T4: registrar lote (artículo → versión vigente mostrada → tandas y cantidad real), merma, consumo interno, ajuste, conteos (abrir por categoría, capturar, revisar diferencias con motivo, aplicar), aviso de críticos en la cabecera del inventario.
- T5: reportes con formulario GET de filtros, tablas con `caption`, paginación.

## 4. Compatibilidad, respaldos y documentación

| Migración | Vuelta atrás automática (imagen anterior + `DATABASE_ALLOW_NEWER_SCHEMA`) | Vuelta atrás manual |
| --- | --- | --- |
| `inventario_recetas` | Tablas nuevas ignoradas; colación correcta | Sin pasos |
| `inventario_kardex` | Tablas nuevas + filas de saldo; la imagen de T2 no las lee | Sin pasos. Los movimientos registrados se conservan y vuelven a usarse al avanzar |
| `inventario_produccion` | `ADD COLUMN NULL` y tablas nuevas; la imagen de T3 lee documentos con tipos de T4: no rompe porque el ENUM ya los traía desde T3 (DT-9) | Sin pasos |
| `rol_cocina` | Sin cocineros en el momento del despliegue | Procedimiento DT-2 ampliado a `cocina` |
| `inventario_reportes` | Solo índices | Sin pasos |

Documentación por ticket:

- T2: `arquitectura.md` §4 (recetas en `core/inventory`) y §6 (rutas); `README.md` (semilla de desarrollo con recetas ficticias).
- T3: `arquitectura.md` (Kardex, CPP, concurrencia, inmutabilidad); `despliegue.md` §9 y §11.1 (tablas del Kardex), §11.8 (`inventory:verify` en el simulacro); `README.md` (`npm run inventory:verify`).
- T4: `despliegue.md` §6 (procedimiento de roles ampliado); `arquitectura.md` (lotes y conteos, rol Cocina); `README.md`.
- T5: `arquitectura.md` §6 (rutas de reportes).
- Propuestas de `.claude/` (con autorización expresa): `CLAUDE.md` §8 y `senior-fullstack.md` (Persistencia y API) al cerrar T3 y T4.

## 5. Pruebas funcionales permanentes y DoD

| Ticket | Archivo (permanente) | Casos |
| --- | --- | --- |
| T2 | `api/tests/unit/inventory-recipes.test.ts` (store en memoria) | bruta = neta/(1−merma) con redondeo y límites (0 %, 99.99 %, 100 % rechazado); conversión de unidad de receta; ciclo directo e indirecto con su ruta; profundidad máxima; nueva versión cierra la anterior (una vigente, intervalos contiguos); versión cerrada inmutable; costo teórico multinivel exacto y "Sin costo" con faltantes; inactivar usado con y sin confirmación; RN-4 bloquea la unidad base al usarse |
| | `landing-pages/tests/integration/prisma-inventory-store.test.ts` (ampliar) | dos versiones simultáneas del mismo artículo (una vigente); ciclo A→B / B→A simultáneo (uno falla) |
| | `api/tests/integration/admin-inventory-api.test.ts` (ampliar o `…-recipes-api.test.ts` si pasa de 20 s) | permisos, 422 `RECIPE_CYCLE`, idempotencia |
| | `inventory-manager/tests/integration/inventory-recipes.test.ts` | editor de versión sin JS, errores por línea, "Sin costo" |
| T3 | `api/tests/unit/inventory-kardex.test.ts` | CPP (fórmula, existencia ≤ 0, redondeo), salida al CPP, negativo permitido, saldo inicial solo una vez, reversión de compra y su CPP, una reversión por documento, costo por unidad base desde empaque, criterio de IVA guardado |
| | `landing-pages/tests/integration/prisma-inventory-kardex.test.ts` (MySQL) | N salidas concurrentes del mismo artículo: `seq` contiguo y saldo exacto; dos documentos con artículos cruzados sin interbloqueo visible; idempotencia persistente (doble envío = un documento); DECIMAL exacto ida y vuelta; `inventory:verify` detecta una fila alterada; **cadena punta a punta** (saldo inicial → compra → costo real de una receta) |
| | `api/tests/integration/admin-inventory-kardex-api.test.ts` | permisos por rol, 409/422/503 |
| | `inventory-manager/tests/integration/inventory-kardex.test.ts` | compra, Kardex, existencias, reversión con confirmación |
| T4 | `api/tests/unit/inventory-production.test.ts` | lote todo o nada, consumo × tandas, costo del lote, sin receta vigente, motivos cerrados, conteo con movimientos posteriores, críticos |
| | `prisma-inventory-kardex.test.ts` (ampliar) | lote concurrente con una compra del mismo insumo; aplicar conteo con una salida simultánea; usuario `cocina` guardado y leído |
| | API y admin | permisos de Cocina (sí lotes/mermas, no compras/ajustes/costos) |
| T5 | `api/tests/unit/inventory-reports.test.ts` | rango de fechas en `BUSINESS_TIMEZONE` (borde de medianoche, `vi.setSystemTime`), valorización con negativos y sin costo, valorización a una fecha, paginación por clave |
| | API y admin | filtros inválidos 422, permisos |

Cada archivo < 20 s (si no, se parte por `describe` con la preparación en `tests/support/`). Se ejecutan y **no se commitean** (QA Report): vuelta atrás por migración, respaldo y restauración con `inventory:verify`, carreras extra y mediciones de contención del pool, 360 px/teclado/sin JS/axe, regresión de landings, bot, productos y página, mutaciones.

DoD por ticket (verificable): migración aditiva con colación revisada y vuelta atrás comprobada con la imagen anterior; `build:css`, `typecheck`, `lint` y `test` en verde; CI en verde (`calidad`, `docker`, `auditoria`, `pruebas` en `pass`); permisos por rol comprobados en API y admin; criterios del ticket con evidencia; docs actualizadas; sin pruebas no funcionales commiteadas. Además: T2, costo teórico exacto contra un cálculo a mano y ciclo rechazado; T3, 20 salidas concurrentes sin pérdida y `inventory:verify` en 0 sobre la base restaurada; T4, lote revertible solo por documento y conteo concurrente correcto; T5, consultas del Kardex con índice (EXPLAIN en QA) y < 300 ms con 50 000 movimientos sintéticos (medición, no prueba).

## 6. Dependencias, riesgos y lo que puede posponerse

Dependencias: T2 ← T1 (PR 1–3). T3 ← T2 (`isInUse`, costo real). PR épica → `main` ← T3. T4 ← T3 (Kardex) y T2 (recetas). T5 ← T3 y T4 (críticos).

| Riesgo | Mitigación |
| --- | --- |
| Concurrencia/interbloqueos | `FOR UPDATE` en orden ascendente de `item_id`, `ReadCommitted`, reintento acotado de 1213, 503 en 1205, pruebas reales en MySQL |
| Precisión | Solo `bigint`; una única función de redondeo; pruebas de límites; importes guardados tal como se pagaron |
| Inmutabilidad | Store sin updates, lint, `inventory:verify` en el simulacro; triggers como opción futura |
| Explosión multinivel | Una consulta de líneas vigentes y DFS/memoización en memoria; profundidad ≤ 8, ≤ 40 líneas |
| Pool de 5 | Transacciones cortas, ≤ 50 líneas por documento, medición de contención en QA |
| Divergencia de la rama | PR de integración `main` → épica tras cada merge; la épica a `main` al acabar T3 |
| ENUM en vuelta atrás | Tipos de movimiento completos desde T3; motivos en VARCHAR; procedimiento de roles |
| Pantallas sin diseño | Sistema visual del admin; Stitch solo en el editor de recetas, con aprobación |

Posponible sin romper el modelo: valorización a una fecha (T5), reversión de documentos que no sean compras (T3 → T4), punto mínimo separado del de reorden, CSV, triggers.

## 7. Decisiones técnicas para aprobar

| # | Decisión | Recomendación |
| --- | --- | --- |
| DT-1 | Partición | 3 PR por T2, T3 y T4; 2 en T5 (11 en total) |
| DT-5 | Inmutabilidad del Kardex y de las versiones | Dominio + lint + `inventory:verify`; sin triggers ni cambios en `deploy/` |
| DT-6 | Versiones de receta | `valid_from/valid_to` + `current_item_id` único; candado `inventory_lock('recetas')` para serializar escrituras de recetas |
| DT-7 | Costo teórico de un intermedio | Explosión hasta insumos al CPP (teórico puro); el CPP propio del intermedio producido se muestra aparte (T4) |
| DT-8 | Fecha de los documentos | Orden del Kardex por registro (`seq`); fecha del hecho informativa, hasta 31 días atrás |
| DT-9 | ENUM de tipos de movimiento | Lista completa desde T3, incluidos `venta` y `devolucion_venta` reservados para la épica de ventas |
| DT-10 | Lote | Tandas de receta + cantidad real; consumo según receta, entrada según lo real |
| DT-11 | Valorización a una fecha | Incluirla en T5 (sale del Kardex sin tablas nuevas) |
| DT-12 | Exportación CSV | No incluir (no está pedida) |
| DT-13 | Transacciones del Kardex | `ReadCommitted` + `SELECT … FOR UPDATE` ordenado, no Serializable |
| DT-14 | Idempotencia de documentos | Clave persistente única en `inventory_document` |
| DT-15 | Motivos | Lista cerrada en core sobre `VARCHAR(32)` |

Preguntas abiertas imprescindibles (con recomendación):

- **P-1.** ¿Un compuesto (platillo) necesita existencias? Recomendado: no; se prepara al momento, solo tiene receta y costo (su descuento llega con ventas).
- **P-2.** Rendimiento de la receta: ¿siempre en la unidad base del artículo? Recomendado: sí (p. ej. "rinde 5 kg de salsa", "1 pza de taco").
- **P-3.** ¿Un platillo puede ser ingrediente de otro (combo)? Recomendado: no en esta épica.
- **P-4.** ¿Se compran intermedios (tortilla comprada)? Recomendado: permitir compras de insumo, reventa e intermedio.
- **P-5.** Listas de motivos de merma, consumo interno y ajuste: confirmar la propuesta de 2.3.
- **P-6.** ¿Alertas solo en pantalla, o también aviso por WhatsApp al personal? Recomendado: solo pantalla.
- **P-7.** ¿Evolución de precios como tabla o con gráfica? Recomendado: tabla (sin JS).
- **P-8.** ¿Cocina captura conteos? Recomendado: no; los conteos y ajustes son del gerente.

## 8. Épica de ventas posterior (solo cómo queda preparada)

- **Enlace menú ↔ inventario:** tabla futura `sales_product_link (product_id, variant_id NULL) → inventory_item (compuesto o reventa)`; T1 a T5 no tocan el menú (D-2).
- **Descuento y explosión:** una venta crea un documento `venta` (tipo ya reservado en DT-9) con salidas de los ingredientes de la versión de receta vigente en el instante de la venta (`valid_from ≤ t < valid_to`), consumiendo intermedios de existencias (mismo criterio de un nivel que el lote). El bloqueo ordenado y el CPP de T3 sirven sin cambios.
- **Modificadores:** fijos = líneas de la receta; removibles y extras = columna futura en `inventory_recipe_line` (`ADD COLUMN NULL`, aditiva) o una tabla de modificadores; nada que adelantar ahora.
- **Cancelaciones:** reintegro = documento `devolucion_venta` (entrada al costo con que salió, como la reversión); si el producto ya se preparó, documento `merma`. Ambos existen tras T3/T4.

## 9. Correspondencia con las 5 fases del prompt original

| Fase original | Ticket | Qué queda fuera por decisión del usuario |
| --- | --- | --- |
| 1. Catálogo, unidades y variantes | T1 | Precio de venta (PV-10); negocio en artículos (D-3) |
| 2. Recetas multinivel, merma y costo | T2 | Modificadores (ventas) |
| 3. Kardex, compras, CPP | T3 | Facturación/CFDI, varias monedas |
| 4. Operación diaria (producción, mermas, conteos, alertas) | T4 | Lotes con caducidad, escáner, comandas |
| 5. Ventas, POS, corte Zeta, mix, teórico vs. real, utilidad | — (épica posterior, D-1) | Todo; T5 solo cubre los reportes de inventario |

## Anexo A — Requerimiento original completo del usuario (texto íntegro)

> Quiero crear una épica nueva para integrar la estructura completa de inventarios, en ella se podrá manejar desde la existencia de productos, los ingredientes que conforman los productos si son manufacturados/preparados en el negocio, los sabores de las bebidas, todos los productos tienen, su información individual, nombre, descripción, id único, unidad de medida costo de adquisición y precio de venta, los ingredientes que conforman un taco, o un molote o una birria y los ingredientes pueden tener referencia circular ya que la tortilla es un ingrediente pero está hecha de otro ingrediente que es la masa, la tortilla es por unidad y su unidad de medida está en piezas y usa cierta cantidad de masa en gramos, la masa de maíz se adquiere por kilo, lo mismo el consomé, usa agua en litros, jitomate en kilos, cebolla en kilos, sal en gramos, etc.
> De esta forma cuando marque un taco o quesabirria vendida sabre cuantas tortillas, cuantos gramos de maza, queso carne etc., tengo que descontar del inventario, lo mismo con refrescos y sus sabores, las aguas frescas, etc.
> Quiero contar una interfaz intuitiva, segura y fiable, para controlar el CRUD de ingredientes, productos, hay productos que tienen sabores o versiones y otros tienen una receta asociada, quiero poder crear recetas libremente y poder modificarlas, quiero poder actualizar productos y darlos de baja sin afectar el historial, quiero contar con reportes históricos de movimientos de inventarios, registro y gestión de recetas e ingredientes con la capacidad de guardar las versiones con forme vayan cambiando, así poder saber cuáles eran los ingredientes en el pasado si consulto un reporte, quiero poder generar reportes de ventas, compras.
> A continuación, se enlistan los reportes esenciales clasificados por área operativa:
> 1. Reportes de Ventas y Operación (Diarios y Semanales)
> • Reporte de corte de caja diario (Zeta): Detalla el total vendido, las formas de pago (efectivo, tarjeta, transferencias, apps de reparto) y el cuadre del fondo de caja.
> • Reporte de ventas por platillo (Mix de ventas): Muestra cuáles antojitos o bebidas se venden más y cuáles tienen baja rotación.
> • Reporte de ventas por horario y día: Identifica las horas pico y los días más flojos para programar turnos de personal y producción de masa o guisados.
> • Reporte de cancelaciones y cortesías: Registra platillos devueltos, errores en comanda o descuentos otorgados para prevenir robos hormiga.
> • Reporte de comisiones por plataformas de delivery: Desglosa las ventas generadas por aplicaciones externas y el porcentaje exacto retenido por comisiones.
> 2. Reportes de Inventarios y Almacén (Diarios y Semanales)
> • Reporte de inventario físico vs. teórico: Compara la materia prima que debería haber según las ventas contra lo que realmente queda en cocina y almacén.
> • Reporte de mermas y desperdicios: Contabiliza ingredientes echados a perder, comida quemada o sobrantes no reutilizables al final del día.
> • Reporte de consumo de insumos críticos: Monitorea el gasto exacto de ingredientes de alto costo o volumen, como carne, queso, aceite, gas y masa.
> • Reporte de compras y proveedores: Registra las adquisiciones realizadas, variaciones de precios en insumos clave (como limón, aguacate o tomate) y cuentas por pagar.
> 3. Reportes de Costos y Rentabilidad (Quincenales o Mensuales)
> • Reporte de costeo de recetas estándar (Escandallos): Define el costo exacto de producción por porción de cada taco, quesadilla, pozole o agua fresca.
> • Reporte de costo de alimentos y bebidas (Food Cost): Calcula el porcentaje que representa el gasto en insumos respecto al total de las ventas (idealmente debe mantenerse entre el 28% y 35%).
> • Reporte de ingeniería de menú: Clasifica los platillos según su popularidad y margen de ganancia para decidir cuáles promocionar, rediseñar o eliminar.
> 4. Reportes Financieros y Administrativos (Mensuales)
> • Estado de resultados (Pérdidas y ganancias): Muestra los ingresos totales menos los costos de insumos, gastos operativos (renta, luz, gas, nómina) y la utilidad neta real.
> • Reporte de flujo de efectivo (Cash Flow): Controla las entradas y salidas reales de dinero para asegurar liquidez y cubrir pagos inmediatos.
> • Reporte de nómina y costo laboral: Detalla sueldos, horas extras, propinas y prestaciones del personal frente al volumen de ventas.
> • Reporte fiscal y de facturación: Resume las facturas emitidas a clientes, facturas recibidas de proveedores y el cálculo de impuestos (IVA, ISR). (Solo crea la estructura, queda pendiente, aun no estamos dados de alta ante el SAT México)

## Historial de cambios

- 2026-11-19, senior-fullstack (T4, PR 3): PR #183 hacia `epic/inventario` con el CI en pass. Estado `READY_FOR_MERGE`.
- 2026-11-19, senior-fullstack (T4, PR 3): `.claude/CLAUDE.md` §8 actualizado (inventario en `api` e `inventory-manager`, `core` con `inventory`, roles del admin). Commit del PR 3 en `feature/REQ-F-049-pantallas` hacia `epic/inventario`. T1 queda completo con este PR.
### PR 3 de T1 (implementación)

- 2026-11-19, senior-qa (Q2, ronda 2): DEF-003, DEF-004 y DEF-005 corregidos por senior-fullstack (decisión del usuario: "Si"), con un caso nuevo en `inventory.test.ts` y una línea en `arquitectura.md`, sin cambios de producción. X4a y X4b detectadas; `typecheck` y `lint` en 0; `inventory-manager` con 287 pruebas en verde; el archivo tarda < 1.3 s en 3 ejecuciones. Limpieza comprobada. Estado `QA_APPROVED`.
- 2026-11-19, senior-fullstack (T3): el usuario aprueba corregir los tres defectos en este PR ("Si"). DEF-003 y DEF-004: caso nuevo en `inventory.test.ts` (X4a y X4b ahora detectadas). DEF-005: `arquitectura.md` §8 atribuye REQ-F-050 a REQ-F-053 a T2 a T5. Estado `NEEDS_IMPLEMENTATION_APPROVAL`.
- 2026-11-19, senior-qa (Q2, ronda 1): plan aprobado por el usuario ("Si") con las autorizaciones y las cuatro respuestas. CA-1 a CA-17 en PASS; suite, typecheck y lint en verde. DT-2 ejecutado tal cual desde `despliegue.md` §6: funciona. Cabecera sin empeorar AUD-006. Mutaciones: 8 de 10 detectadas; sobreviven X4a (DEF-003, `MAJOR` de cobertura) y X4b (DEF-004, `MINOR`). DEF-005 `MINOR` documental. Limpieza comprobada. Estado `NEEDS_USER_DECISION`.
- 2026-11-19, senior-qa (Q1): implementación del PR 3 aprobada por el usuario ("Apruebo y autorizo"). QA Action Plan del PR 3 escrito (revisión estática, permisos y flujos contra la `api` y el admin reales sobre MySQL, CA-17 a 360 y 1440 px con teclado y sin JavaScript, semilla, vuelta atrás y DT-2, documentación, mutaciones, regresión y limpieza). Sin ejecutar nada. Estado `NEEDS_QA_PLAN_APPROVAL`.
- 2026-11-19, senior-fullstack (T2): PR 3 de T1 implementado en `feature/REQ-F-049-pantallas` (pantallas de inventario, cabecera e inicio del gerente, doble con el rol, semilla `npm run inventory:seed-dev`, cadena de punta a punta y documentación), sin commit; estado `NEEDS_IMPLEMENTATION_APPROVAL`.

### QA del PR 2 (Q1)

- 2026-11-19, senior-fullstack (T4): commit `6d1e355` y PR #182 (https://github.com/orvigas/negocio/pull/182) hacia `epic/inventario`. DEF-002 corregido (caso nuevo, X3a detectada); el doble de usuarios con el rol y la redirección del gerente pasan al PR 3. Estado `READY_FOR_MERGE`.
- 2026-11-19, senior-qa (Q2, ronda 2): DEF-002 corregido por senior-fullstack (decisión del usuario: "Si") con un caso nuevo en `user-repository.test.ts`, sin cambios de producción. X3a ahora se detecta; `typecheck`, `lint` y `npm test` en verde; `user-repository.test.ts` < 3.5 s en 3 ejecuciones; limpieza comprobada. Estado `QA_APPROVED`.
- 2026-11-19, senior-fullstack (T3): DEF-002 corregido por decisión del usuario ("Si"): caso de MySQL que cambia solo el rol (gerente -> admin -> gerente, sin negocios) y comprueba que sube `session_version`; X3a detectada; typecheck y lint en 0, archivo en verde 3 veces. El doble de usuarios queda para el PR 3. Estado `NEEDS_IMPLEMENTATION_APPROVAL`.
- 2026-11-19, senior-qa (Q2): plan aprobado por el usuario ("Si") con las autorizaciones y las cuatro recomendaciones. Ejecutado (ronda 1): CA-10, CA-11, CA-14, CA-15, CA-16 y DT-2 en PASS; migración sin reconstrucción (`TABLE_ID` 1967 → 1967, `INSTANT` aceptado); mutaciones X1–X7 detectadas salvo X3a (DEF-002, `MAJOR` de cobertura). Estado `NEEDS_USER_DECISION`.
- 2026-11-19, senior-qa: implementación del PR 2 aprobada por el usuario ("Si, apruebo"), incluida la desviación (la redirección del gerente pasa al PR 3). QA Action Plan del PR 2 escrito; estado `NEEDS_QA_PLAN_APPROVAL`.

### PR 2 de T1 (implementación)

- 2026-11-18, senior-fullstack (T2): PR 2 de T1 implementado en `feature/REQ-F-049-gerente-api` (migración `rol_gerente`, rol Gerente, contratos y cliente del inventario, 12 rutas de la API con acceso por rol, CSRF, conflicto e idempotencia, opción Gerente en usuarios), sin commit; estado `NEEDS_IMPLEMENTATION_APPROVAL`. La redirección del gerente queda para el PR 3, como dice el plan.

### Versión 6 (T4 del PR 1)

- 2026-11-19, senior-fullstack (T4): DT-1 y DT-5 a DT-15 del plan técnico de T2 a T5 y las respuestas recomendadas a P-1 a P-8 aprobadas por el usuario ("apruebo las recomedaciones"); el plan se copia íntegro en "Plan técnico de T2 a T5". DEF-001 aceptado sin cambios. Commit `d459b5a` y PR #181 (https://github.com/orvigas/negocio/pull/181) hacia `epic/inventario`; estado `READY_FOR_MERGE`.

### QA del PR 1 (Q1)

- 2026-11-18, senior-qa (Q2): plan aprobado por el usuario ("si a las dos"; P1 simulacro `--drill` lo hace el usuario tras desplegar la épica; P2 vuelta atrás solo con el código de `main`; P3 se conservan `node_modules` y el cliente generado; P4 nombre de variante único en todo el catálogo aceptado). Ejecutado; estado `QA_APPROVED` con DEF-001 (`MINOR`).
- 2026-11-18, senior-qa: QA Action Plan del PR 1 escrito; estado `NEEDS_QA_PLAN_APPROVAL`. Contexto transmitido por la sesión principal: el usuario aprobó la implementación del PR 1 ("si la apruebo pero no inicies el agente QA ... cuando se restablezcan mis límites") y las recomendaciones del plan técnico de T2 a T5 ("apruebo las recomedaciones"); persistir esta última aprobación en el plan corresponde a senior-fullstack.

### Versión 5

Requerimiento completo del usuario (Anexo A) y decisión de orden (2026-11-18): "A tu recomendación y ajustar lo necesario ya que estamos en una etapa temprana". Cambios:

- hoja de ruta de cuatro épicas (E1 Inventario, E2 Ventas, E3 Costos y rentabilidad, E4 Finanzas y administración), con E2 entre T3 y T4 y sin empezar hasta que T1 a T3 estén utilizables;
- tabla de cobertura del requerimiento original por épica y ticket;
- T5 añade los reportes de mermas y desperdicios, consumo de insumos críticos y escandallos; T4 sin cambios salvo su posición;
- "Fuera de alcance" de E1 reescrito: ventas, costos y finanzas son épicas posteriores; PV-10 revisable al refinar E2; PV-12 vigente;
- estado `IN_PROGRESS`: PR 1 de T1 aprobado, sin commit. Pendientes de aprobación: DT-5 a DT-15 del plan técnico de T2 a T5 y las respuestas a las 8 preguntas abiertas. Sin cambios en el Technical Action Plan de T1 ni en el Implementation Result.

### Versión 4

PR 1 de T1 implementado (2026-11-18, senior-fullstack) en `feature/REQ-F-049-catalogo-modelo`: migración `inventario_catalogo`, `core/inventory`, `prisma-inventory-store`, lint y pruebas funcionales. Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

### Versión 3

Plan técnico aprobado por el usuario, con DT-1 a DT-4 (2026-11-18). Ticket en `in-progress/` con estado `IN_PROGRESS`. PR 0 (rama `chore/ci-admite-epic-inventario`, hacia `main`):

- `.github/workflows/ci.yml`: `epic/inventario` en `on.pull_request.branches` y comentarios ajustados (sin cambios de lógica);
- `.claude/rules/git.md`: la rama intermedia de la épica.

Tras su merge, la sesión principal crea `epic/inventario` desde `main`.

### Versión 2

Revisión técnica (2026-11-18, senior-fullstack): se añade el Technical Action Plan con las decisiones DT-1 a DT-4. Estado: `NEEDS_TECHNICAL_PLAN_APPROVAL`.

### Versión 1

Descripción inicial (2026-11-18):

- marco de la épica de inventario, con las decisiones D-1 a D-4 y PV-1 a PV-14 validadas por el usuario;
- detalle de T1 con su Action Plan.
