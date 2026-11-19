# REQ-F-049 — Épica de inventario (marco) y T1: catálogo de artículos, variantes y unidades

## Estado

IN_PROGRESS

T1 se implementa en el PR 0 (`ci.yml` y `git.md`, hacia `main`) y después en tres PR hacia `epic/inventario` (DT-1). En curso: PR 0.

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

Este documento contiene el **marco de la épica** (reglas comunes, glosario, partición y decisiones) y el **detalle del ticket T1**. Los tickets T2 a T5 se crearán como REQ-F-050 a REQ-F-053 cuando se refinen con el usuario.

---

# Parte A — Marco de la épica

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
| PV-10 (precio de venta) | Los artículos de inventario **no** llevan precio de venta en esta épica. El precio sigue en el menú y se vinculará en la épica de ventas. | Evita tener el precio en dos fuentes sin ventas que lo usen. |
| PV-11 (estado y baja) | "Dar de baja" es pasar a **Inactivo**, y es reversible. No hay un tercer estado "eliminado". | Unifica el estado ACTIVE/INACTIVE con el borrado lógico y evita una diferencia ambigua. |
| PV-12 (T4 y T5) | Tras llevar `epic/inventario` a `main`, T4 y T5 van directo a `main` y la rama se borra. | Para entonces el modelo ya es estable y T4 y T5 son aditivos. |
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
- **T4 (REQ-F-052, por crear):** producción por lotes, mermas, consumo interno, conteos físicos con ajuste justificado, stock mínimo y punto de reorden con alertas, y rol Cocina/Producción.
- **T5 (REQ-F-053, por crear):** reportes de Kardex filtrable, valorización, stock crítico, historial de compras y evolución de precios.

## Fuera de alcance (PV-4)

- **La épica de ventas (posterior):** POS o registro de ventas, persistencia de los pedidos del bot, descuento de insumos por venta y explosión al vuelo, modificadores, cancelaciones y cortesías, corte de caja (Zeta), mix de ventas, ventas por horario, consumo teórico contra real, utilidad bruta (COGS) y rol Cajero.
- Facturación electrónica (CFDI), impuestos y contabilidad.
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
| 4 | T4 — REQ-F-052 | `main` (PV-12) | Inventario al día sin depender de ventas |
| 5 | T5 — REQ-F-053 | `main` (PV-12) | Reportes de inventario |

Como nada llega a producción antes del merge, el orden interno de T1 a T3 no afecta a los usuarios.

La épica de ventas se refinará después, en sus propios tickets.

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

## Historial de cambios

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
