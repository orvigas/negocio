# REQ-F-046 — Cotizador de taquizas (Birria) en el admin nuevo

## Estado

READY_FOR_MERGE (PR 1: dominio, contrato y API) — Pull Request https://github.com/orvigas/negocio/pull/151 hacia `main`, con el CI (`calidad`, `docker`, `auditoria` y `pruebas`) comprobado en `pass` tras marcarlo como listo. El PR 2 (pantalla) sigue pendiente.

## Aprobación

Aprobado por el usuario (versión 1, fecha 2026-11-16). Cita textual: "apruebo con tus sugerencias", en respuesta a la presentación del requisito con los supuestos S-1 a S-7 y la pregunta de escenarios guardados (recomendación: fuera de esta versión).

Con esa respuesta quedan aceptados los supuestos S-1 a S-7 tal como están redactados (incluidos F = b − 20 en cada paquete, las filas extra 150, 200 y 300 de la matriz y que "Restablecer" conserve N), y los escenarios guardados quedan fuera de alcance, para un ticket posterior. El Excel `Cotizador_Taquiza_Birria.xlsx` sigue fuera del repo salvo que el usuario pida otra cosa.

Decisiones previas del usuario (2026-11-16):
- solo Birria;
- solo administradores;
- JSON en el repo dentro de `api`, validado en CI;
- tarifa propia por paquete, sin tope en 100 personas y con F = 100 en el Tradicional ("una fórmula que dé los resultados del Excel y nos permita seguir calculando más allá de 100 personas, entendiendo que entre más personas el descuento también comienza a diluirse hasta estabilizarse después de 100");
- "Quiero que el cotizador me deje cambiar al menos todo lo que puedo modificar en el excel".

## Objetivo

Llevar `Cotizador_Taquiza_Birria.xlsx` a `admin.birriaelmuneco.com` (`inventory-manager`) como herramienta de cálculo que permita cambiar, como mínimo, todo lo que se puede cambiar en el Excel:
- Los valores por defecto, los ítems y los paquetes salen de un JSON del repo.
- Los ajustes del administrador se aplican solo al cálculo en curso y nunca se guardan.
- Para N personas se obtienen precio, venta, costo, utilidad y margen por paquete.
- La tarifa se extiende más allá de 100 personas.
- Queda preparado el paso futuro de leer los ítems de la tabla de productos sin reescribir el cálculo.

## Alcance

- Solo Birria El Muñeco, con el modelo preparado por negocio.
- Solo administradores.
- JSON versionado en `api`, validado en CI; cambiar un valor por defecto exige un PR y un despliegue.
- Pantalla con todos los parámetros editables del Excel, la composición de los paquetes y la configuración de la matriz (S-1).
- Recálculo al enviar el formulario, sin guardar nada.
- "Restablecer valores del JSON".
- URL que se puede recargar y compartir entre administradores.
- Fórmula de precio extendida (sin tope comercial en 100).
- Documentación de la fórmula.

## Fuera de alcance

- Guardar los ajustes como "escenarios" o cotizaciones (ticket posterior).
- Imprimir, PDF, WhatsApp o una versión para el cliente.
- Crear insumos, ítems o paquetes desde la pantalla: eso se hace en el JSON.
- Editar o subir el JSON desde la interfaz.
- Leer de la tabla de productos (fase 2; aquí solo se deja preparado).
- Molotes.
- Impuestos, comisiones de cobro, renta, depreciación y transporte extraordinario (tampoco están en el Excel).
- Inventario real de insumos.

## Supuestos aceptados

- **S-1. Qué se puede editar en la pantalla:** todo lo que en el Excel es una celda editable de la hoja Parametros (ver "Campos editables"), más N, la cantidad por persona de cada ítem en cada paquete, la activación de cada paquete y el rango, el paso y las filas extra de la matriz.
- **S-2. Qué es estructura (solo en el JSON) y qué es ajuste (pantalla):**
  - Estructura: ids y nombres, unidades, la lista de insumos, la lista de ítems de venta, qué insumos lleva cada receta y la lista de paquetes.
  - Ajuste: todos los valores numéricos.
  - En cada paquete aparecen todos los ítems del JSON. Cantidad 0 significa "no incluido", así que un ítem existente se puede añadir o quitar de un paquete, pero no se pueden crear ítems nuevos.
  - Los paquetes se activan o desactivan, y al menos uno debe quedar activo.
- **S-3. "Piezas por persona" (Excel) deja de ser un campo propio.** Es la suma de las cantidades de los ítems marcados como pieza (taco y quesabirria) del paquete y se muestra como dato calculado. Un único "gramos de carne cocida por pieza" del Excel corresponde a dos campos: los gramos de carne de la receta del taco y los de la quesabirria. Lo mismo pasa con "gramos de masa por tortilla".
- **S-4. "Máximo de personas" (Excel) pasa a ser `refPersonas`**, donde acaba el tramo recto de la tarifa. N admite hasta 5 000 personas como límite técnico de entrada, no comercial.
- **S-5. Un enlace compartido significa "valores del JSON vigentes + estas diferencias".** Si un valor por defecto cambia después en el JSON, el enlace recalcula con el valor nuevo en los campos que no se tocaron.
- **S-6. F = b − 20 en cada paquete:** 100, 110, 120 y 130.
- **S-7. "Restablecer valores del JSON" conserva N.**

## Requisitos

- **RF-1. Pantalla:** `GET /birria/cotizador` en `inventory-manager`. Arriba, "Personas" y "Calcular". Debajo, los parámetros en secciones plegables (`details`/`summary`) ordenadas por frecuencia de uso:
  1. Paquetes (activación y cantidades) y tarifas.
  2. Costos de insumos y recetas.
  3. Costos por persona, combustible y costos fijos.
  4. Política (mínimo, referencia y margen) y precios a la carta.
  5. Matriz.

  Las secciones con algún campo modificado o con error se abren solas. Cada campo modificado se marca como "modificado" con texto, no solo con color.
- **RF-2. Envío:** formulario GET sin JavaScript obligatorio. Cada envío recalcula en el servidor. No se guarda nada ni se escribe en la base.
- **RF-3. Resultado por paquete activo:**
  - precio sugerido por persona;
  - venta, costo del evento, utilidad y margen real;
  - costo variable, costo fijo y piezas por persona;
  - precio por margen frente a precio comercial, con la indicación de cuál mandó;
  - diferencia frente a la carta (RN-12).
- **RF-4. Matriz de volumen** de los paquetes activos (precio por persona y margen real), según la configuración de la sección 5.
- **RF-5. Avisos fijos:**
  - junto a la masa y al consomé, el texto "provisional";
  - una nota con lo que no se incluye (impuestos, comisiones, renta, depreciación, transporte extraordinario);
  - una nota que avisa que cambiar la composición de un paquete no cambia su tarifa: hay que ajustar a, b y F.
- **RF-6. Restablecer valores del JSON:** un enlace que vuelve a los valores por defecto (S-7).
- **RF-7. URL compartible:** la URL resultante reproduce el cálculo al recargarla o al abrirla otro administrador, y contiene solo N y los campos que difieren del JSON. Recomendación técnica: sin JavaScript, el formulario envía todos sus campos, así que `inventory-manager` responde con una redirección 303 a la URL que solo contiene las diferencias. La decisión final la toma la revisión técnica.
- **RF-8. Validación de campos:** con cualquier campo inválido no se calcula nada.
  - Arriba aparece un resumen de errores con enlaces a cada campo.
  - Cada campo muestra su mensaje asociado (`aria-describedby`, `aria-invalid`), sin depender solo del color.
  - Se conservan los valores escritos.
  - Se acepta punto o coma decimal.
- **RF-9. Privacidad de los ajustes:** nunca se guardan ni se registran.
  - Los logs de `inventory-manager` y de `api` registran la ruta sin la query string ni el cuerpo del cálculo.
  - Los errores de validación se registran sin los valores.
- **RF-10. Origen de los datos:** el JSON de `api` es la fuente de los valores por defecto, los ítems y los paquetes. Se valida al arrancar y en CI. Si no es válido, el servidor registra el detalle y la pantalla muestra "Cotizador no disponible", sin detalles internos.
- **RF-11. Permiso:** solo administradores, igual en la pantalla que en la API. Un editor recibe 403 y no ve el enlace en el menú.
- **RF-12. Preparación para la base de datos:** el cálculo recibe el catálogo ya validado, sin saber de dónde viene. Cada ítem de venta puede llevar el `slug` del producto de Birria (`producto`) para enlazarlo con la tabla de productos en la fase 2.

## Campos editables (valores por defecto = Excel)

| Sección | Campo (correspondencia con el Excel) | Unidad | Por defecto | Rango válido | Nota |
|---|---|---|---|---|---|
| General | Personas | personas | — | entero de 1 a 5 000 | |
| Insumos | Costo de la carne de res cruda | $/kg | 170 | 0 a 100 000 | |
| | Merma de la carne | % | 40 | 0 ≤ x < 100 | |
| | Costo de la masa | $/kg | 15 | 0 a 100 000 | provisional |
| | Costo del queso | $/kg | 150 | 0 a 100 000 | |
| | Costo del vitrolero de agua | $ | 150 | 0 a 100 000 | |
| | Volumen del vitrolero | L | 18 | > 0 y ≤ 1 000 | |
| | Costo incremental del consomé | $/500 ml | 0.5 | 0 a 100 000 | provisional |
| Recetas | Carne cocida en el taco y en la quesabirria (S-3) | g/pieza | 40 y 40 | 0 a 5 000 | |
| | Masa por tortilla en el taco y en la quesabirria | g | 40 y 40 | 0 a 5 000 | provisional (la nota del Excel dice 32.5) |
| | Queso por quesabirria | g | 40 | 0 a 5 000 | |
| | Agua por porción "agua 500 ml" | L | 0.5 | 0 a 100 | |
| | Consomé por porción | porciones de 500 ml | 1 | 0 a 100 | provisional |
| Por persona | Complementos y desechables | $/persona | 6 | 0 a 100 000 | |
| | Otros costos variables | $/persona | 0 | 0 a 100 000 | |
| Combustible | Costo por hora | $/h | 5 | 0 a 100 000 | |
| | Horas por tanda | h | 4.5 | 0 a 48 | |
| | Carne cruda por tanda | kg | 7 | > 0 y ≤ 1 000 | |
| Fijos | Mano de obra y logística | $/evento | 1 600 | 0 a 1 000 000 | |
| | Otros costos fijos | $/evento | 0 | 0 a 1 000 000 | |
| Política | Mínimo de personas (`minPersonas`) | personas | 30 | entero de 1 a 4 999 | |
| | Referencia (`refPersonas`, el "máximo" del Excel) | personas | 100 | entero mayor que el mínimo y ≤ 5 000 | |
| | Margen objetivo | % | 30 | 0 ≤ x < 100 | |
| Tarifas | a, b y F de cada paquete | $/persona | Tradicional 145/120/100; Mixto 1 155/130/110; Mixto 2 165/140/120; Especial 175/150/130 | > 0 y ≤ 100 000; F < b ≤ a | |
| Paquetes | Activo (por paquete) | sí/no | sí | al menos uno activo | |
| | Cantidad por persona de cada ítem (taco, quesabirria, consomé 500, agua 500) | unidades | según el paquete | 0 a 50, hasta 2 decimales; al menos un ítem > 0 | "ml por persona" de agua y consomé del Excel: 500 ml = 1 |
| Carta | Precio a la carta: taco, agua, consomé y quesabirria | $ | 30, 25, 45 y vacío | vacío o 0 a 100 000 | |
| Matriz | Desde, hasta y paso | personas | 30, 100 y 10 | desde ≥ mínimo; hasta ≥ desde; paso ≥ 1 | |
| | Filas extra | lista | 150, 200, 300 | hasta 10 enteros de 1 a 5 000 | máximo 50 filas en total |

**Validación transversal:**
- todos los números son finitos y tienen como máximo 4 decimales (2 en los importes en pesos);
- la query string mide 8 KB como máximo; si la supera, aparece "La configuración es demasiado larga; restablece los valores" y no se calcula nada;
- se rechazan los parámetros desconocidos y los ids que no existen en el JSON.

## Reglas de negocio

N = personas; un paquete P tiene ítems i con una cantidad qᵢ por persona. Todo valor usado es el ajuste de la pantalla si existe, y si no, el del JSON.

- **RN-1. Merma:** la receta indica cantidades netas (cocidas). Cantidad cruda = neta / (1 − merma). Costo = cantidad cruda × costo unitario del insumo.
- **RN-2. Costo variable por persona:** Σ qᵢ × costo de la receta de i, más los costos por persona, más el combustible. Valores por defecto: Tradicional 47.11, Mixto 1 53.11, Mixto 2 59.11, Especial 65.11.
- **RN-3. Combustible:** gramos de carne cruda por persona × costo por hora × horas por tanda / (kg crudos por tanda × 1 000). Equivale al Excel: 0.643 $ con 200 g crudos.
- **RN-4. Agua:** costo lineal (costo del vitrolero / litros del vitrolero) × litros, sin redondear a vitroleros completos.
- **RN-5. Consomé:** costo incremental por porción de 500 ml, sin volver a cargar la carne. Provisional.
- **RN-6. Masa y queso:** según la receta de cada ítem (una tortilla por pieza). La masa es provisional.
- **RN-7. Costo fijo:** costo fijo por persona = Σ costos fijos del evento / N. Costo total por persona = variable + fijo por persona.
- **RN-8. Precio por margen:** redondeo hacia arriba al peso entero de (costo total por persona / (1 − margen objetivo)).
- **RN-9. Precio comercial:** la fórmula del apartado "Cómo funciona la fórmula de precio y cómo modificarla". Sustituye la interpolación del Excel y el recargo por quesabirria.
- **RN-10. Precio sugerido:** sin precio si N < minPersonas. En otro caso, el mayor entre RN-8 y RN-9.
- **RN-11. Resultados del evento:** venta = precio × N; costo del evento = costo total por persona × N; utilidad = venta − costo; margen real = utilidad / venta.
- **RN-12. Diferencia frente a la carta:** Σ qᵢ × precio a la carta − precio sugerido. Solo se muestra si todos los ítems con qᵢ > 0 tienen precio a la carta. Si es positiva, se muestra como "ahorro"; si es negativa, como "más caro que la carta".
- **RN-13. Redondeo:** RN-8 hacia arriba; RN-9 al más cercano (0.5 sube, como `ROUND` de Excel). Los costos se muestran con 2 decimales.
- **RN-14. Sin persistencia:** cada cálculo usa solo el JSON vigente y los ajustes recibidos en esa petición.

## Cómo funciona la fórmula de precio y cómo modificarla

*(Este apartado también irá al README y a `restaurante/docs/arquitectura.md`.)*

**En lenguaje sencillo.** Cada paquete tiene una tarifa por persona que baja conforme el evento crece:
- Entre `minPersonas` y `refPersonas` baja en línea recta, como en el Excel.
- A partir de ahí sigue bajando cada vez menos, hasta estabilizarse en un piso F que nunca cruza.

El precio final nunca baja del precio que garantiza el margen objetivo.

**Fórmula.** Con a = tarifa en `minPersonas`, b = tarifa en `refPersonas` y F = piso:
- s = (a − b) / (refPersonas − minPersonas), en pesos por persona.
- Si minPersonas ≤ N ≤ refPersonas: tarifa(N) = a − (N − minPersonas) × s.
- Si N > refPersonas: tarifa(N) = F + (b − F) × e^(−s × (N − refPersonas) / (b − F)).
- Precio comercial = tarifa(N) redondeada al peso entero. Precio sugerido = máx(precio por margen, precio comercial).
- La curva es continua en valor y en pendiente en refPersonas, converge a F y nunca baja de F.
- Con los valores por defecto reproduce el Excel en los 71 enteros de 30 a 100 (matriz: 145, 141, 138, 134, 131, 127, 124, 120).

**Parámetros** (ejemplo: Tradicional, a = 145, b = 120, F = 100, s = 0.357 $/persona):

| Parámetro | Significado | Si lo cambias |
|---|---|---|
| `minPersonas` (30) | Desde dónde se cotiza y dónde vale a | Por debajo no hay precio |
| `refPersonas` (100) | Fin del tramo recto; desde aquí el descuento se va apagando | Si lo subes, la recta es más suave y más larga (con 120, N = 100 da 126) |
| `a` (145) | Tarifa en el mínimo | Mueve el arranque del tramo recto |
| `b` (120) | Tarifa en la referencia | Mueve el final del tramo recto y el arranque de la curva |
| `F` (100) | Piso de estabilización | Subir F frena antes el descuento (F = 110 da 110 en 200 personas); bajarlo lo extiende (F = 90 da 99) |
| Margen objetivo y costos | Precio mínimo por margen | Si suben, puede mandar el margen en lugar de la tarifa (con margen del 50 %, N = 60 da 148) |

**Ejemplo (Tradicional, valores por defecto):**

| N | Tarifa | Precio comercial | Precio por margen | Precio sugerido |
|---|---|---|---|---|
| 30 | 145.00 | 145 | 144 | 145 |
| 60 | 134.29 | 134 | 106 | 134 |
| 100 | 120.00 | 120 | 91 | 120 |
| 120 | 113.99 | 114 | 87 | 114 |
| 150 | 108.19 | 108 | 83 | 108 |
| 200 | 103.35 | 103 | 79 | 103 |
| 300 | 100.56 | 101 | 75 | 101 |
| 500 | 100.02 | 100 | 72 | 100 |

**Dónde se cambia:**
- **Para probar:** en la pantalla (sección "Paquetes y tarifas" para a, b y F; "Política" para minPersonas, refPersonas y margen). No se guarda nada y la URL se puede compartir.
- **Para dejarlo como valor por defecto:** en el JSON del cotizador dentro de `api`, con un PR. El CI lo valida y el despliegue lo publica. No hace falta tocar código.

**Restricciones** (en la pantalla, con un mensaje junto al campo; en el JSON, el arranque y el CI fallan nombrando el paquete y el campo):
- todos los valores son positivos y finitos;
- F < b ≤ a;
- minPersonas < refPersonas.

Ejemplo: «Tarifa del paquete "Tradicional": el piso F (120) debe ser menor que la tarifa en la referencia b (120).»

Con a = b la tarifa es plana: vale b también por encima de refPersonas.

**Cambiar la curva.** La función de tarifa vive aislada en `core/cotizador`, con su prueba unitaria contra los valores del Excel y la tabla de arriba. Para usar otra curva basta con sustituir esa función y sus valores esperados; el resto del cálculo, la API y la pantalla no cambian.

## Modelo del JSON (estructura y valores por defecto)

Propuesta. Los nombres finales de los campos los decide la revisión técnica; los valores son los del Excel.

```json
{
  "version": 1, "negocio": "birria",
  "insumos": [
    {"id": "carne-res", "nombre": "Carne de res cruda", "unidad": "kg", "costo": 170, "merma": 0.40},
    {"id": "masa", "nombre": "Masa", "unidad": "kg", "costo": 15, "provisional": true},
    {"id": "queso", "nombre": "Queso", "unidad": "kg", "costo": 150},
    {"id": "agua", "nombre": "Agua fresca", "unidad": "l", "costo": 150, "presentacion": 18},
    {"id": "consome", "nombre": "Consomé (incremental)", "unidad": "porcion-500ml", "costo": 0.5, "provisional": true}
  ],
  "itemsVenta": [
    {"id": "taco", "nombre": "Taco de birria", "producto": null, "precioCarta": 30, "pieza": true,
     "receta": [{"insumo": "carne-res", "cantidad": 40, "unidad": "g"}, {"insumo": "masa", "cantidad": 40, "unidad": "g"}]},
    {"id": "quesabirria", "nombre": "Quesabirria", "producto": null, "precioCarta": null, "pieza": true,
     "receta": [{"insumo": "carne-res", "cantidad": 40, "unidad": "g"}, {"insumo": "masa", "cantidad": 40, "unidad": "g"}, {"insumo": "queso", "cantidad": 40, "unidad": "g"}]},
    {"id": "consome-500", "nombre": "Consomé 500 ml", "producto": null, "precioCarta": 45,
     "receta": [{"insumo": "consome", "cantidad": 1}]},
    {"id": "agua-500", "nombre": "Agua 500 ml", "producto": null, "precioCarta": 25,
     "receta": [{"insumo": "agua", "cantidad": 0.5, "unidad": "l"}]}
  ],
  "costosPorPersona": [
    {"id": "complementos", "concepto": "Complementos y desechables", "costo": 6},
    {"id": "otros", "concepto": "Otros variables", "costo": 0}
  ],
  "combustible": {"costoHora": 5, "horasTanda": 4.5, "insumoBase": "carne-res", "crudoPorTandaKg": 7},
  "costosFijosEvento": [
    {"id": "mano-obra", "concepto": "Mano de obra y logística", "costo": 1600},
    {"id": "otros", "concepto": "Otros", "costo": 0}
  ],
  "politica": {"minPersonas": 30, "refPersonas": 100, "margenObjetivo": 0.30},
  "matriz": {"desde": 30, "hasta": 100, "paso": 10, "extra": [150, 200, 300]},
  "paquetes": [
    {"id": "tradicional", "nombre": "Tradicional", "tarifa": {"a": 145, "b": 120, "F": 100},
     "items": [{"item": "taco", "porPersona": 3}, {"item": "consome-500", "porPersona": 1}, {"item": "agua-500", "porPersona": 1}]},
    {"id": "mixto-1", "nombre": "Mixto 1", "tarifa": {"a": 155, "b": 130, "F": 110},
     "items": [{"item": "taco", "porPersona": 2}, {"item": "quesabirria", "porPersona": 1}, {"item": "consome-500", "porPersona": 1}, {"item": "agua-500", "porPersona": 1}]},
    {"id": "mixto-2", "nombre": "Mixto 2", "tarifa": {"a": 165, "b": 140, "F": 120},
     "items": [{"item": "taco", "porPersona": 1}, {"item": "quesabirria", "porPersona": 2}, {"item": "consome-500", "porPersona": 1}, {"item": "agua-500", "porPersona": 1}]},
    {"id": "especial", "nombre": "Especial", "tarifa": {"a": 175, "b": 150, "F": 130},
     "items": [{"item": "quesabirria", "porPersona": 3}, {"item": "consome-500", "porPersona": 1}, {"item": "agua-500", "porPersona": 1}]}
  ]
}
```

- Se elimina el recargo de 10 $ por quesabirria: lo absorbe la tarifa propia de cada paquete.
- La validación del JSON aplica las mismas reglas que la tabla de campos, más ids únicos y referencias existentes (insumos en las recetas, ítems en los paquetes, `insumoBase` del combustible).

## Arquitectura e impacto en la API

Respeta la regla de dependencias de `npm run lint`: `inventory-manager` solo importa `contracts` y `web`, no `core`.

- `packages/core/cotizador/` (TS puro, sin E/S):
  - validación del catálogo y de los ajustes, ambos recibidos como `unknown`;
  - aplicación de los ajustes sobre el catálogo;
  - función de tarifa aislada;
  - cálculo y matriz;
  - puerto `QuoteCatalogSource.load(negocio)`.
- `packages/contracts`: esquema de los ajustes, DTO de la respuesta (con los valores por defecto para precargar el formulario y los errores por campo) y método del cliente del admin.
- `api`:
  - el JSON;
  - una implementación del puerto basada en el archivo, validada al arrancar y en CI;
  - un endpoint que devuelve la estructura y los valores por defecto (p. ej. `GET /api/v1/admin/birria/cotizador`);
  - un endpoint de cálculo que recibe `{ personas, ajustes }` y devuelve el resultado o un 422 con errores por campo (p. ej. `POST /api/v1/admin/birria/cotizador/calculos`);
  - ambos solo para administradores y sin registrar el cuerpo.
- `inventory-manager`: pide los valores por defecto, convierte la query string en ajustes, llama a la API y renderiza. No calcula nada. El navegador solo envía el formulario.
- **La API recibe solo las diferencias respecto del JSON**, no la configuración completa:
  - la API sigue siendo la dueña de los valores por defecto (una sola fuente de verdad);
  - las peticiones son más pequeñas;
  - es coherente con la URL de diferencias (S-5);
  - la API puede rechazar ids desconocidos;
  - en la fase 2, los valores por defecto vendrán de la base de datos sin cambiar el contrato.

  Alternativa descartada: enviar la configuración completa. Reproduce exactamente un enlace antiguo aunque cambie el JSON, pero duplica la estructura en cada petición y obliga a validarla.
- **Cálculo en el servidor:** una sola lógica y funciona sin JS. Calcular en el navegador duplicaría la lógica, porque `inventory-manager` no puede importar `core`. Más adelante se puede añadir una mejora progresiva.
- `_stich_source_/` no tiene diseño del admin: la pantalla usa el estilo actual de `inventory-manager`.
- **Fase 2 (fuera de alcance):** una implementación del puerto en `db` que tome nombre y precio a la carta de `productos` por `slug`. Insumos, recetas y tarifas siguen en el JSON hasta que tengan tablas propias. La tabla de productos actual no tiene costos ni recetas.

## Historias de usuario

- **HU-1.** Como administrador quiero escribir el número de personas para ver precio, costo, utilidad y margen por paquete.
- **HU-2.** Como administrador quiero cambiar cualquier parámetro que podía cambiar en el Excel y ver el resultado al momento, sin afectar los valores guardados.
- **HU-3.** Como administrador quiero cambiar la composición de los paquetes y activar o desactivar paquetes para probar combinaciones.
- **HU-4.** Como administrador quiero compartir o recargar la URL de un cálculo y restablecer los valores del JSON.
- **HU-5.** Como dueño quiero que los valores por defecto se cambien solo en el JSON, con un PR.

## Criterios de aceptación

- **CA-1:** Given los valores por defecto, When N = 60, Then Tradicional da 134 $/persona, venta 8 040, costo 4 426.57, utilidad 3 613.43 y margen real 44.9 %; y Mixto 1, Mixto 2 y Especial dan 144, 154 y 164.
- **CA-2:** Given los valores por defecto, Then el costo variable por persona es 47.11, 53.11, 59.11 y 65.11 y las piezas por persona son 3 en los cuatro paquetes.
- **CA-3:** When N = 30, Then Tradicional da 145. When N = 100, Then da 120 (y 130, 140 y 150 los otros paquetes).
- **CA-4:** When N = 120, 150, 200 y 300, Then Tradicional da 114, 108, 103 y 101. Mixto 1 en N = 200 da 113.
- **CA-5:** When N = 500 y N = 5 000, Then Tradicional da 100 (= F). Para todo N entre 101 y 5 000, ningún paquete baja de su F y el precio nunca sube al aumentar N.
- **CA-6:** When N = 29, Then ningún paquete muestra precio y aparece "El mínimo es 30 personas".
- **CA-7 (insumo):** Given carne a 200 $/kg, When N = 60, Then el costo variable del Tradicional es 53.11 (+6.00), el costo del evento 4 786.57, la utilidad 3 253.43 y el precio sigue en 134.
- **CA-8 (combustible):** Given 9 h por tanda, Then el costo variable del Tradicional es 47.75.
- **CA-9 (composición):**
  - Given el consomé en 0 en el Tradicional, When N = 60, Then su costo variable es 46.61, su precio a la carta 115 y aparece "19 $ más caro que la carta", junto con el aviso de RF-5 sobre la tarifa.
  - Given el Mixto 1 desactivado, Then no aparece ni en los resultados ni en la matriz.
- **CA-10 (margen):** Given un margen objetivo del 50 %, When N = 60, Then Tradicional da 148, venta 8 880, se indica que mandó el margen y el margen real es 50.2 %.
- **CA-11 (costo fijo):** Given costos fijos de 3 000, When N = 30, Then Tradicional da 211 y se indica que mandó el margen.
- **CA-12 (tarifa):** Given F = 110 en el Tradicional, When N = 200, Then da 110. Given refPersonas = 120, When N = 100, Then da 126.
- **CA-13 (carta):** Given un taco a 35 $, When N = 60, Then el Tradicional muestra un ahorro de 41 $. Los paquetes con quesabirria (sin precio a la carta) no muestran diferencia.
- **CA-14 (matriz):** Given desde 30, hasta 50, paso 5 y sin filas extra, Then la matriz muestra 30, 35, 40, 45 y 50. Con los valores por defecto, el Tradicional muestra 145, 141, 138, 134, 131, 127, 124, 120, 108, 103 y 101 (30 a 100 de 10 en 10, más 150, 200 y 300), con los mismos precios que el cálculo individual.
- **CA-15 (validación):** Given cualquiera de estos casos, When envío, Then no se calcula nada, aparecen el resumen y el mensaje junto a cada campo afectado, se conservan los valores escritos y no hay error 500:
  - F ≥ b o a < b;
  - mínimo ≥ referencia;
  - merma o margen de 100 %;
  - un valor negativo, texto, un campo obligatorio vacío o `Infinity`;
  - todos los ítems de un paquete en 0;
  - ningún paquete activo.
- **CA-16 (URL):** Given ajustes aplicados, When recargo o abro la URL en otra sesión de administrador, Then obtengo el mismo resultado. La URL contiene solo los campos modificados y N.
- **CA-17 (restablecer):** When pulso "Restablecer valores del JSON", Then todos los campos vuelven a los valores por defecto, se conserva N y no queda ninguna marca de "modificado".
- **CA-18 (no persistencia):** Given ajustes aplicados, When otro administrador abre `/birria/cotizador` sin query, Then ve los valores del JSON. Ni la base ni los archivos cambian.
- **CA-19 (logs):** Given un cálculo con ajustes, Then ni los logs de `inventory-manager` ni los de `api` contienen la query string, el cuerpo ni los valores.
- **CA-20 (query larga):** Given una query de más de 8 KB o con parámetros desconocidos, Then aparece un mensaje claro, sin cálculo y sin error 500.
- **CA-21 (JSON inválido):** Given un JSON con F ≥ b o una referencia rota, Then el CI y el arranque fallan con un mensaje que nombra el paquete y el campo, y la pantalla muestra "Cotizador no disponible" sin detalles internos.
- **CA-22 (permiso):** Given un editor, Then recibe 403 en la pantalla y en la API y no ve el enlace. Given un administrador, Then accede. `/molotes/cotizador` responde 404.
- **CA-23:** La masa y el consomé aparecen marcados como "provisional" y se muestra la nota de lo que no se incluye.
- **CA-24:** Funciona con teclado y sin JavaScript. En un móvil de 360 px las secciones están plegadas, salvo las que tienen cambios o errores, y los resultados se pueden leer.

## Casos límite

- **N:** vacío, decimal, negativo, 0, más de 5 000 o texto; y los bordes 29, 30, 100, 101 y 5 000.
- **Continuidad en 100:** N = 101 da 120 (tarifa 119.64).
- **Campos:** no numéricos, negativos, vacíos, con coma decimal, con demasiados decimales, `NaN` o `Infinity`, y extremos (merma de 99.99 %, margen de 99.99 %, costos de 100 000).
- **Tarifas:** F ≥ b, a < b, y a = b (tarifa plana igual a b).
- **Paquetes:** todos los ítems en 0; ningún paquete activo; un ítem añadido a un paquete sin precio a la carta (sin diferencia frente a la carta).
- **Combustible:** kg por tanda en 0 (rechazado).
- **Matriz:** desde < mínimo; hasta < desde; más de 50 filas.
- **URL:** query de más de 8 KB, parámetros desconocidos o duplicados, ids inexistentes.
- **Cambios en el JSON:**
  - un enlace antiguo después de cambiar el JSON (S-5);
  - un enlace con ids que el JSON ya no tiene: se ignoran con un aviso o se rechazan (decisión técnica), siempre sin error 500.
- **Fallos de infraestructura:**
  - API caída o lenta: el aviso "no disponible" de las pantallas actuales;
  - sesión caducada: acceso y vuelta al cotizador con la misma query;
  - un administrador degradado a editor durante la sesión: 403 en la siguiente petición.

## Dependencias

- REQ-F-045 (retirar el `/admin` actual) va en paralelo; la pantalla nueva se añade al menú del admin nuevo.
- Estilo visual de las pantallas actuales de `inventory-manager`.
- `Cotizador_Taquiza_Birria.xlsx` está sin seguimiento en git y queda fuera del repo salvo que el usuario pida guardarlo como referencia en `restaurante/docs/`.

## Riesgos

- **Unos 60 campos son mucha pantalla en móvil.** Mitigación: secciones plegables con `details`/`summary`, orden por frecuencia de uso, apertura automática de las secciones con cambios o errores, y resultados antes que parámetros en móvil.
- **Los ajustes podrían filtrarse a los logs.** Mitigación: RF-9 y CA-19.
- **Decisiones de precio con datos provisionales** (masa y consomé). Mitigación: marca en la pantalla.
- **Diferencias de redondeo con el Excel.** Mitigación: criterios numéricos y prueba unitaria de la tarifa y del cálculo.
- **Confusión entre ajuste y valor por defecto.** Mitigación: marca de "modificado" y nota de que no se guarda.
- **Una composición cambiada con la tarifa sin ajustar.** Mitigación: el aviso de RF-5.
- **Un F mal elegido puede regalar margen en eventos grandes.** Mitigación: la documentación y la validación F < b.

## Action Plan

### Objetivo
El de arriba.

### Alcance y fuera de alcance
Los de arriba.

### Cambios requeridos
1. Crear el JSON inicial en `api` con los datos del Excel y las tarifas a, b y F de cada paquete.
2. `core/cotizador`:
   - validación del catálogo y de los ajustes;
   - función de tarifa aislada;
   - aplicación de los ajustes;
   - cálculo y matriz;
   - pruebas unitarias contra el Excel y contra CA-1 a CA-14.
3. `contracts`: esquemas de los ajustes, de los valores por defecto y del resultado, y el método del cliente del admin.
4. `api`:
   - lectura y validación del JSON al arrancar y en CI;
   - los endpoints de valores por defecto y de cálculo, solo para administradores;
   - sin registrar los ajustes.
5. `inventory-manager`:
   - pantalla `/birria/cotizador` con secciones plegables, validación accesible y marcas de "modificado" y "provisional";
   - URL de diferencias y "Restablecer valores del JSON";
   - enlace en el menú solo para administradores;
   - logs sin query string.
6. Documentación: formato del JSON, tabla de campos y el apartado "Cómo funciona la fórmula de precio y cómo modificarla", en el README de `restaurante/` y en `restaurante/docs/arquitectura.md`.

### Reglas de negocio
RN-1 a RN-14 y la fórmula de precio.

### UX/UI
RF-1 y RF-8; mobile-first; accesible; sin JavaScript obligatorio.

### Integraciones
Ninguna externa.

### Casos límite y criterios de aceptación
Los de las secciones correspondientes (CA-1 a CA-24).

### Dependencias y riesgos
Los de las secciones correspondientes.

### Orden recomendado
1 → 2 → 3 → 4 → 5 → 6.

### Resultado esperado
El administrador cambia cualquier valor del Excel, la composición o los paquetes activos y ve el resultado al instante, sin guardar nada. Con los valores por defecto, los resultados son idénticos al Excel hasta 100 personas y siguen la curva por encima. Los valores por defecto solo cambian en el JSON, con un PR.

## Trazabilidad

| Objetivo | Requisitos | Reglas | Historia | Criterios | Paso |
|---|---|---|---|---|---|
| Precio y costo por persona | RF-3 | RN-1 a RN-13 | HU-1 | CA-1 a CA-6 | Pasos 2 a 5 |
| Editar lo mismo que en el Excel | RF-1, RF-2, RF-8 | RN-14 | HU-2 | CA-7 a CA-13, CA-15 | Pasos 2, 3 y 5 |
| Paquetes dinámicos | RF-1, RF-5 | RN-2, RN-12 | HU-3 | CA-9 | Pasos 2 y 5 |
| Compartir y restablecer | RF-6, RF-7 | — | HU-4 | CA-16, CA-17 | Paso 5 |
| Privacidad de los ajustes | RF-9 | RN-14 | — | CA-18, CA-19 | Pasos 4 y 5 |
| Más de 100 personas | — | RN-9 y la fórmula | HU-1 | CA-4, CA-5, CA-12 | Pasos 2 y 6 |
| Matriz de volumen | RF-4 | — | HU-1 | CA-14 | Pasos 2 y 5 |
| Valores por defecto en el JSON | RF-10, RF-12 | — | HU-5 | CA-21 | Pasos 1, 4 y 6 |
| Seguridad | RF-11 | — | — | CA-20, CA-22 | Pasos 4 y 5 |
| Transparencia de datos provisionales | RF-5 | RN-5, RN-6 | — | CA-23 | Paso 5 |

Sin diseño en `_stich_source_/`: toda la pantalla, que reutiliza el estilo del admin nuevo.

## Revisión técnica

Revisión del 2026-11-15 sobre `main` = `epic/arquitectura` = `8abdff9`. Sin cambios de código. NotebookLM no estaba disponible en la sesión (sus herramientas MCP no se expusieron): no se consultó.

### Comprobaciones hechas

- **Números del ticket.** Recalculados a mano con la fórmula y el modelo propuestos: RN-2 (47.11, 53.11, 59.11, 65.11), CA-1, CA-3, CA-4, CA-7 a CA-13, la tabla de ejemplo (120 → 113.99, 150 → 108.19, 200 → 103.35, 300 → 100.56, 500 → 100.02) y los casos del apartado de parámetros (`refPersonas` 120 → 126, F 110 → 110, F 90 → 99, margen 50 % → 148). Todos cuadran. Script de comprobación ejecutado en el scratchpad y descartado.
- **Coma flotante (riesgo real).** En el tramo recto con los valores por defecto, la tarifa cae exactamente en ,5 en N = 37, 51, 65, 79 y 93 (142.5, 137.5…), y el precio por margen puede ser un entero exacto que la división en coma flotante deja en `x.00000000000001` (p. ej. 63 / 0.7 = 90.00000000000001, y `Math.ceil` daría 91). Con los valores por defecto `Math.round` acierta en los 71 enteros de 30 a 100, pero con otros ajustes no está garantizado. Decisión: redondeos "seguros" en `core` (ver TAP, Validaciones), sin aritmética en céntimos.
- **Regla de dependencias (`restaurante/eslint.config.ts`).** `inventory-manager` solo importa `@restaurante/contracts` y `@restaurante/web`; `contracts` no importa nada del proyecto; `core` no importa paquetes npm; `api` importa `core` por el `index.ts` de cada módulo. El diseño de abajo lo respeta: `core/cotizador` es un módulo nuevo con su `index.ts` y su entrada en `exports` de `packages/core/package.json`.
- **Logs.** El registro de peticiones de `inventory-manager` (`src/middleware/request-logger.ts`) y de `api` (`createRequestLogger` en `api/src/app.ts`) y sus manejadores de errores ya usan `ctx.path` (sin query) y no registran cuerpos. CA-19 se cumple sin tocarlos, siempre que los controladores nuevos no registren valores.
- **Imagen de producción.** La etapa `api` del Dockerfile (`landing-pages/Dockerfile`) copia `api/src` entera y `.dockerignore` no excluye `.json`: un JSON en `api/src/cotizador/` llega a la imagen sin tocar el Dockerfile (mismo patrón que `landing-pages/src/content/<negocio>/seed.json`).
- **Vuelta al cotizador tras el acceso.** `sanitizeNext` (`inventory-manager/src/session.ts`) solo admite rutas fijas sin query: hay que añadir `/birria/cotizador` con una query acotada para cumplir "sesión caducada: acceso y vuelta al cotizador con la misma query".

### Problemas o ambigüedades encontradas (con la solución propuesta)

1. **CA-21 se contradice con RF-10.** CA-21 dice que con un JSON inválido "el arranque falla" y a la vez que "la pantalla muestra 'Cotizador no disponible'". Si la `api` no arranca, la pantalla no puede mostrar eso y, sobre todo, caen el bot de WhatsApp, los productos y los datos de página que sirve la misma `api`. Propuesta (P-2): la `api` arranca igual, registra `quote_catalog_invalid` con los errores (ruta del campo y mensaje, sin valores de ajustes) y deja el cotizador desactivado: sus endpoints responden 503 `QUOTE_UNAVAILABLE` y la pantalla muestra "Cotizador no disponible". El CI sí falla (prueba del JSON real). Así un JSON roto nunca llega a producción por la vía normal y, si llegara, no tumba nada más.
2. **Coma decimal frente a separador de miles.** "1,600" puede leerse como 1.6. En los importes en pesos (2 decimales) lo rechaza la regla de decimales; en los campos de 4 decimales (g, kg, h, L) no. Mitigación: ayuda visible "Usa punto o coma para los decimales, sin separador de miles", se rechaza más de un separador o cualquier espacio interno, y la redirección 303 devuelve el valor normalizado con punto (el campo muestra "1" y la marca "modificado"). No requiere decisión.
3. **Enlaces con ids que el JSON ya no tiene** (casos límite, decisión técnica). Se rechazan como cualquier parámetro desconocido: mensaje "El enlace tiene campos que ya no existen; restablece los valores", sin cálculo, con el enlace "Restablecer valores del JSON" (conserva N) y sin 500. Coherente con "se rechazan los parámetros desconocidos".
4. **"Activo" de un paquete con un formulario GET sin JS.** Una casilla desmarcada no se envía, así que no se distingue "desactivado" de "sin tocar". Se usan dos radios "Activo / Inactivo" en un `fieldset` con `legend` (siempre se envían; accesibles con teclado).
5. **Unidades en el JSON.** El modelo del ticket mezcla fracciones (merma 0.40, margen 0.30) con porcentajes en la pantalla, y repite la unidad en cada línea de receta. Se fija (decisión técnica): porcentajes en el JSON (`mermaPct: 40`, `margenObjetivoPct: 30`) y la unidad de la receta se deriva del insumo (insumo en kg → receta en g; en l → l; en porciones → porciones), con `presentacion` opcional (costo por presentación; agua: 150 $ por 18 l). Menos conversiones y menos errores posibles.
6. **Rama de destino.** `.claude/rules/git.md`: los PR de la épica de arquitectura van a `epic/arquitectura`; los cambios ajenos a la épica van a `main`. Este ticket es funcionalidad nueva, no un paso del plan de migración (§8 de `arquitectura.md`; el paso 6 es REQ-F-045), así que propongo `main` (P-1), con un PR de `main` hacia `epic/arquitectura` tras cada merge, como manda la regla. Cada merge a `main` despliega; el riesgo es bajo porque todo queda tras el rol administrador.
7. **`.claude/CLAUDE.md` §8** describe el alcance de `api` e `inventory-manager` ("productos, datos de página, usuarios, cuenta propia y control del bot"). Quedaría desactualizado. No lo toco sin autorización explícita (P-3).

### Preguntas para el usuario

- **P-1. Rama de destino.** Recomendación: `main` (funcionalidad ajena a la épica), integrando después `main` en `epic/arquitectura`.
- **P-2. JSON inválido en producción.** Recomendación: la `api` arranca y solo el cotizador queda "no disponible" (503); el CI es la barrera que impide publicarlo. Alternativa: que la `api` entera no arranque (el despliegue volvería a la versión anterior, pero un fallo así deja sin bot y sin datos de página mientras dura).
- **P-3. Actualizar `.claude/CLAUDE.md` §8** para añadir el cotizador a la descripción de `api` e `inventory-manager`. Recomendación: sí, en el último PR.

## Technical Action Plan

### Objetivo técnico

Un módulo de dominio puro (`core/cotizador`) que valida el catálogo y los ajustes, calcula la cotización y la matriz con una función de tarifa aislada; un contrato en `contracts`; dos endpoints solo para administradores en `api` que leen un JSON versionado; y una pantalla SSR en `inventory-manager` que solo traduce la query a ajustes, llama a la API y pinta. Sin persistencia, sin migraciones, sin variables de entorno nuevas.

### Archivos o componentes afectados

Nuevos:
- `restaurante/packages/core/cotizador/` — `index.ts`, `catalog-schema.ts`, `adjustments.ts`, `tariff.ts`, `calculator.ts`, `rounding.ts`, `fields.ts`, `catalog-source.ts`.
- `restaurante/packages/contracts/quote.ts`.
- `restaurante/api/src/cotizador/catalogs/birria.json`, `restaurante/api/src/cotizador/file-catalog-source.ts`, `restaurante/api/src/admin/quote-routes.ts`.
- `restaurante/inventory-manager/src/controllers/quote.ts`, `restaurante/inventory-manager/src/views/quote.ts`, `src/views/pages/quote.html` y parciales `src/views/partials/quote-*.html` (resultados, matriz, sección plegable, campo con marca).
- Pruebas: ver "Testing".

Modificados:
- `packages/core/package.json` (`"./cotizador": "./cotizador/index.ts"`).
- `packages/contracts/index.ts`, `packages/contracts/admin.ts` (`adminPaths.quote`, `adminPaths.quoteCalculations`), `packages/contracts/admin-client.ts` (`AdminApiClient.getQuoteDefaults`, `AdminApiClient.calculateQuote`).
- `api/src/admin/index.ts` (`createAdminRoutes` recibe `quotes: QuoteCatalogSource`), `api/src/admin/router.ts` (rutas nuevas), `api/src/server.ts` (carga del JSON al arrancar).
- `inventory-manager/src/routes.ts`, `src/app.ts` (`createQuoteController`), `src/views/index.ts` (`HeaderSection` + `'quote'`, enlace en `businessNav`), `src/session.ts` (`RETURN_PATTERNS`).
- Documentación: `restaurante/README.md`, `restaurante/docs/arquitectura.md` (y `.claude/CLAUDE.md` §8 solo si se autoriza, P-3).

### Cambios requeridos

#### `packages/core/cotizador` (TS puro, sin E/S)

- `catalog-schema.ts`: `parseQuoteCatalog(raw: unknown): { ok: true; catalog: QuoteCatalog } | { ok: false; issues: { path: string; message: string }[] }`. Valida tipos, rangos de la tabla de campos, ids `^[a-z0-9-]{1,30}$` únicos por lista, referencias (insumos de cada receta, ítems de cada paquete, `combustible.insumoBase`), `f < b ≤ a`, `minPersonas < refPersonas`, al menos un paquete y un ítem > 0 por paquete, `producto` (slug o `null`, RF-12). Los mensajes nombran el paquete y el campo: «Tarifa del paquete "Tradicional": el piso F (120) debe ser menor que la tarifa en la referencia b (120).»
- `fields.ts`: `quoteFields(catalog): QuoteField[]` — la lista ordenada de campos editables derivada del catálogo: `key`, `section` (1 a 5 de RF-1), `label`, `unit`, `kind` (`int` | `decimal` | `money` | `percent` | `optionalMoney` | `active` | `intList`), `min`, `max`, `decimals`, `provisional`, `defaultValue` (texto canónico). Es la única definición de claves: la usan la validación, la API y, a través del DTO, la pantalla. Claves cortas y estables, basadas en los ids del JSON (seguras en una URL sin codificar):
  - `n` (personas);
  - `i.<insumo>.costo`, `i.<insumo>.merma` (si el insumo la declara), `i.<insumo>.pres` (si declara presentación);
  - `r.<item>.<insumo>` (cantidad de la receta);
  - `pp.<id>` (costos por persona), `fe.<id>` (fijos del evento);
  - `cb.hora`, `cb.horas`, `cb.kg`;
  - `po.min`, `po.ref`, `po.margen`;
  - `p.<paquete>.a|b|f`, `p.<paquete>.on` (`1`/`0`), `p.<paquete>.q.<item>`;
  - `c.<item>` (carta; vacío = sin precio);
  - `m.desde`, `m.hasta`, `m.paso`, `m.extra` (enteros separados por coma o espacio).
- `adjustments.ts`: `applyAdjustments(catalog, input: { personas: unknown; ajustes: unknown }): { ok: true; personas; effective: QuoteCatalog; modified: string[] } | { ok: false; errors: Record<string, string> }`. Acepta textos, punto o coma decimal (un solo separador, sin espacios internos), rechaza `NaN`, `Infinity`, exponentes, demasiados decimales, claves desconocidas (error general `''`), y aplica las reglas cruzadas (F < b ≤ a, mínimo < referencia, matriz desde ≥ mínimo, hasta ≥ desde, ≤ 50 filas, ≥ 1 paquete activo, ≥ 1 ítem > 0 por paquete activo). Un valor igual al por defecto no cuenta como modificado.
- `tariff.ts`: `commercialTariff({ a, b, f, minPersonas, refPersonas }, n): number` — exactamente la fórmula del ticket, con la recta calculada como `a − ((n − min) × (a − b)) / (ref − min)` (multiplica antes de dividir). Sustituirla basta para cambiar la curva.
- `rounding.ts`: `roundHalfUp(x, decimals = 0)` y `ceilInt(x)`, ambos normalizando antes a 9 decimales (`Number(x.toFixed(9))`) para absorber el error de coma flotante, como hace `ROUND` de Excel con sus 15 cifras.
- `calculator.ts`: `calculateQuote(effective, n): QuoteResult` y `buildMatrix(effective): QuoteMatrix`. RN-1 a RN-13. Devuelve importes ya redondeados a 2 decimales y el margen real en porcentaje con 1 decimal (la pantalla no hace cuentas), `priceSource: 'margin' | 'commercial'`, `belowMinimum` (CA-6), `cartaDiff` (`null` si algún ítem con qᵢ > 0 no tiene precio a la carta). La matriz: filas de `desde` a `hasta` con `paso` más `extra`, sin repetidos, ordenadas, solo paquetes activos, con los mismos precios que el cálculo individual.
- `catalog-source.ts`: `interface QuoteCatalogSource { load(business: BusinessId): Promise<QuoteCatalog> }` y `QuoteUnavailableError`. Asíncrono para la fase 2 (base de datos) sin cambiar el contrato.

#### `packages/contracts/quote.ts` (Zod)

- `quoteDefaultsResponseSchema`: `{ quote: { business, sections: [{ id, title }], fields: QuoteField[], notes } }` (con `provisional` por campo).
- `quoteCalculationRequestSchema`: `{ personas: string, ajustes: Record<string, string> }`, como máximo 200 claves, claves `^[a-z0-9.-]{1,80}$`, valores de hasta 64 caracteres.
- `quoteCalculationResponseSchema`: `{ result: { personas, belowMinimum, minPersonas, modified: string[], packages: [{ id, name, price, sale, eventCost, profit, marginPct, variableCost, fixedCost, pieces, marginPrice, commercialPrice, priceSource, cartaDiff }], matrix: { rows: number[], packages: [{ id, name, cells: [{ price, marginPct } | null] }] } } }`.
- `adminPaths.quote(business)` = `/api/v1/admin/<negocio>/cotizador`; `adminPaths.quoteCalculations(business)` = `…/cotizador/calculos`.
- `AdminApiClient.getQuoteDefaults(auth, business)` y `AdminApiClient.calculateQuote(auth, business, body)`; el 422 llega por el `fields` habitual.

#### `api`

- `src/cotizador/catalogs/birria.json`: el modelo del ticket con los ajustes de la Revisión técnica (porcentajes, unidad derivada, `presentacion`, `f` en minúscula), con `"version": 1` y los valores del Excel.
- `src/cotizador/file-catalog-source.ts`: `createFileQuoteCatalogSource({ files: { birria: URL }, logger })` con `init()` (lee con `readFile`, `JSON.parse` como `unknown`, `parseQuoteCatalog`) y `load(business)`. Inválido o ilegible: `quote_catalog_invalid` con `{ business, issues }` (rutas y mensajes del JSON del repo, nunca ajustes) y `load` lanza `QuoteUnavailableError`. Negocio sin JSON (molotes): `QuoteUnavailableError` de tipo "no existe" → 404.
- `src/admin/quote-routes.ts`: `createQuoteRoutes({ access, quotes, logger })` con `defaults` y `calculate`, usando `createResponder`, `validationFailed` y `access.adminOnly(ctx, { write: false, forbiddenMessage })` (401 → 403 antes de mirar el negocio). `calculate` lee con `closedBody(ctx, ['personas', 'ajustes'], QUOTE_BODY_LIMIT = 16 KiB)`, valida con `quoteCalculationRequestSchema`, aplica `applyAdjustments` y responde 200 o 422 `VALIDATION_FAILED` con errores por clave. Solo registra `quote_validation_failed { fields: <número> }`.
- `src/admin/router.ts`: `GET /:business/cotizador` y `POST /:business/cotizador/calculos` (antes de las rutas de productos). Molotes y negocios desconocidos: 404 `QUOTE_NOT_FOUND`.
- `src/server.ts`: `await quotes.init()` antes de `createAdminRoutes`; nunca termina el proceso por el cotizador (P-2).

**Por qué POST con cuerpo entre `inventory-manager` y `api`:** el cálculo no tiene efectos, pero en un cuerpo JSON los ajustes no viajan en ninguna URL interna, no hay límites de longitud de URL, se reutiliza `closedBody` con lista cerrada y tope, y el contrato es un objeto tipado. `write: false`: no cambia nada, y la API se autentica con `Authorization: Bearer` (no con cookies), así que no necesita CSRF.

**Ida y vuelta "solo diferencias" (decisión del ticket, se mantiene):** la API recibe solo los campos modificados (y acepta también uno igual al por defecto, que no cuenta como modificado).

#### `inventory-manager`

- `src/routes.ts`: `GET /birria/cotizador` → `quote.page` (ruta fija; `/molotes/cotizador` no coincide con nada y responde el 404 común, CA-22).
- `src/controllers/quote.ts`: `createQuoteController({ config, api, views, logger })` con `createControllerKit` y `kit.adminSession(ctx, returnTo, FORBIDDEN)` (editor → 403). Orden en `page`:
  1. `Buffer.byteLength(ctx.querystring) > 8192` → aviso "La configuración es demasiado larga; restablece los valores" (200, sin cálculo, sin parsear).
  2. Sesión de administrador (con `returnTo` = ruta + query, aceptada por `sanitizeNext`).
  3. `api.getQuoteDefaults` (503 `QUOTE_UNAVAILABLE` → "Cotizador no disponible"; caída o lentitud → `kit.unavailable`).
  4. `URLSearchParams`: clave repetida o desconocida → aviso, sin cálculo.
  5. Si viene el marcador del botón (`calcular=1`, el formulario completo): normaliza (recorta, coma → punto) y quita los campos iguales al valor por defecto; responde **303** a `/birria/cotizador?n=…&<diferencias>`. Los valores no numéricos se conservan tal cual en la URL para volver a pintarlos con su error.
  6. Sin marcador: si no hay `n`, pinta el formulario con los valores del JSON y sin resultados; si hay, `api.calculateQuote` → 200 resultados, 422 resumen de errores + mensajes por campo + valores escritos.
  - Nunca registra la query ni valores; solo `quote_rejected { reason: 'too_long' | 'duplicate' | 'unknown' }` y `api_unavailable`.
- `src/views/quote.ts` + plantillas: `h1` "Cotizador de taquizas", fila "Personas" + "Calcular", región de resultados (`aria-live` no hace falta: es una página nueva; resumen de errores con `role="alert"` y foco, como `errorSummary`), y las 5 secciones `details`/`summary` con `open` si tienen algún campo modificado o con error. Campo: `label` con unidad, `input inputmode="decimal"` (texto, no `type=number`, para aceptar coma), ayuda, `aria-describedby`, `aria-invalid`, texto "modificado" y "provisional". Matriz como `table` con `caption` y `th scope`. Avisos fijos de RF-5. Enlace "Restablecer valores del JSON" = `/birria/cotizador?n=<N>`. Reutiliza `field-input`, `field-error`, `field-help`, `fieldset`, `error-summary*`, `notice`; formato de cifras con `Intl.NumberFormat('es-MX')`.
- `src/views/index.ts`: `HeaderSection` añade `'quote'`; `businessNav` añade "Cotizador" solo si `business === 'birria'` y `context.user.role === 'admin'` (se pasa el rol a `businessNav`).
- `src/session.ts`: `RETURN_PATTERNS` añade `/^\/birria\/cotizador(?:\?[A-Za-z0-9._~%&=+,-]{0,8192})?$/` (ruta fija: sin redirección abierta).
- Sin JavaScript nuevo: `details` es nativo.

### Validaciones

- Todas en `core` (una sola lógica); `inventory-manager` solo comprueba tamaño, repetidos, desconocidos y la normalización para la URL.
- Redondeos: RN-8 con `ceilInt`, RN-9 con `roundHalfUp`, importes a 2 decimales con `roundHalfUp(x, 2)`, margen real en % a 1 decimal.

### Manejo de errores

- `api`: 401, 403 `FORBIDDEN_ROLE`, 404 `QUOTE_NOT_FOUND`, 422 `VALIDATION_FAILED` con `fields`, 503 `QUOTE_UNAVAILABLE`, con el formato `{ error: { code, message } }` del manejador central.
- `inventory-manager`: 403 "Sin permiso", "Cotizador no disponible" (503), servicio no disponible común, avisos de query; nunca 500 por entradas del usuario (CA-15, CA-20).

### Testing

Permanentes (solo funcionales, `.claude/rules/testing.md`; `core` no tiene carpeta de pruebas: sus unitarias viven en `api/tests/unit`, como `page-repository.test.ts`):
1. `api/tests/unit/quote-calculator.test.ts` (nuevo; ningún archivo cubre el cotizador): tarifa en los 71 enteros de 30 a 100 contra los valores del Excel y la tabla de ejemplo; los casos ,5 (N = 37 → 143); CA-1 a CA-14 y los bordes 29, 30, 100, 101 y 5 000; monotonía y piso de CA-5; validación de CA-15 (cada caso → su clave de error) y de claves desconocidas; y el **JSON real** `api/src/cotizador/catalogs/birria.json` cargado con `createFileQuoteCatalogSource` (es la validación en CI de RF-10/CA-21: un JSON inválido hace fallar `npm test`), más un JSON con F ≥ b y otro con una referencia rota que nombran paquete y campo.
2. API, permiso y privacidad (CA-22, CA-19): editor 403, administrador 200, `molotes` 404, y que un cálculo con ajustes no deja valores en el logger capturado. En `api/tests/integration/admin-api.test.ts` si cabe en los 20 s; si no, un archivo nuevo pequeño con `startAdmin`.
3. `inventory-manager`, pantalla (CA-15, CA-19, CA-22): con el doble de la API, editor 403 sin enlace "Cotizador", administrador con enlace; un 422 pinta resumen, `aria-invalid` y los valores escritos; el envío completo responde 303 a la URL con solo las diferencias; los logs no contienen la query. Archivo nuevo `inventory-manager/tests/integration/quote.test.ts` con un `tests/support/api-double-quote.ts` (patrón de `api-double-page.ts`).
4. `inventory-manager/tests/unit/config-session.test.ts` (existente): `sanitizeNext` acepta `/birria/cotizador?…` y rechaza otro origen o una query con caracteres no permitidos.

Se ejecutan y se descartan: comprobaciones de redondeo ad hoc, diferenciales con el Excel fuera de los valores del ticket, pruebas de navegador, accesibilidad con teclado y 360 px (QA).

### Seguridad

- Solo administradores, igual en `api` (`adminOnly`) y en la pantalla (`adminSession`); el enlace también se oculta.
- Lista cerrada de claves, tope de 8 KiB de query y 16 KiB de cuerpo, números finitos con decimales acotados, N ≤ 5 000, matriz ≤ 50 filas: el costo de cada cálculo está acotado.
- Escape de toda salida con `{{ }}`; sin JavaScript ni cambios de CSP.

### Performance

- Un cálculo son unas pocas operaciones por paquete y como mucho 50 × 4 celdas: despreciable. El JSON se lee una vez al arrancar. Una petición a la API por pintado (dos con la redirección del envío completo).

### Riesgos técnicos

- **Query en la URL:** la URL de diferencias (decisión RF-7) queda en el historial del navegador y, si el Traefik del VPS tiene activado el registro de accesos, en ese registro (no está configurado en el repo; no se puede comprobar desde aquí). Son cifras de costo, no datos personales; CA-19 cubre los logs de `inventory-manager` y `api`. Se revisará en el despliegue.
- **Ambigüedad de la coma** (punto 2 de la Revisión técnica): mitigada con la ayuda y la normalización visible.
- **JSON inválido** (P-2): mitigado por la prueba en CI.
- **Conflictos con REQ-F-045** si va en paralelo en `epic/arquitectura`: este ticket toca sobre todo archivos nuevos; las piezas compartidas (`views/index.ts`, `routes.ts`, `session.ts` de `inventory-manager`, `api/src/admin/*`) se integran con el PR de `main` hacia la épica.

### Orden de implementación (2 PR a la rama de P-1)

1. **PR 1 — dominio, contrato y API:** `core/cotizador`, `contracts/quote.ts` y el cliente, JSON y fuente de archivo, rutas de `api`, `server.ts`, pruebas 1 y 2, y la documentación de la API, del JSON y de la fórmula (README y `arquitectura.md`). Desplegable sola: los endpoints son internos y solo para administradores.
2. **PR 2 — pantalla:** controlador, vistas, ruta, enlace del menú, `sanitizeNext`, pruebas 3 y 4, documentación de la pantalla en el README y, si se autoriza (P-3), `.claude/CLAUDE.md` §8.

Sin migraciones, variables de entorno ni cambios en `deploy/`, `ops/` o el Dockerfile: `despliegue.md` no cambia.

### Criterios de finalización

- CA-1 a CA-24 comprobados (CA-24 y la parte visual, en QA).
- `npm run build:css`, `npm run typecheck`, `npm run lint` y `npm test` en verde.
- El apartado "Cómo funciona la fórmula de precio y cómo modificarla" en el README y en `arquitectura.md`.
- Sin bases `restaurante_test*`, procesos ni archivos temporales remanentes.

## Implementation Result

### PR 1 — dominio, contrato y API

#### Rama

`feature/REQ-F-046-cotizador-taquizas`, creada desde `main` (`dda01f7`; P-1: el PR irá a `main`). Sin commits todavía.

#### Cambios realizados

- `packages/core/cotizador/` (módulo nuevo, TS puro, exportado como `@restaurante/core/cotizador`):
  - `catalog.ts`: tipos del catálogo (unidades `kg`, `l` y `porcion`; `mermaPct`, `presentacion`, `margenObjetivoPct` y `f` en minúscula, como fijó la Revisión técnica).
  - `catalog-schema.ts`: `parseQuoteCatalog(unknown)`. Valida campos conocidos, ids únicos, referencias (recetas, ítems de paquetes, `insumoBase` en kg), slug de `producto`, los rangos de cada campo editable y las reglas cruzadas, y devuelve el catálogo congelado o `{ path, message }` que nombra paquete y campo.
  - `fields.ts`: la única definición de los 64 campos editables (claves de la Revisión técnica, sección, grupo, rango, decimales, `provisional` y lectura y escritura sobre el catálogo), con su análisis de texto (punto o coma decimal, sin exponentes ni `Infinity`), la comprobación de rango y las reglas cruzadas (F < b ≤ a, mínimo < referencia, un paquete activo, un ítem > 0 por paquete, matriz).
  - `adjustments.ts`: `applyAdjustments` sobre una copia; errores por clave (`n`, `''`) y `modified` (un valor igual al JSON no cuenta).
  - `tariff.ts`: `commercialTariff`, la fórmula del ticket (multiplica antes de dividir).
  - `rounding.ts`: `roundHalfUp` y `ceilInt` con normalización a 9 decimales.
  - `calculator.ts`: `calculateQuote` y `buildMatrix` (RN-1 a RN-13), con `cartaPrice` además de `cartaDiff`.
  - `catalog-source.ts`: puerto `QuoteCatalogSource` y errores `QuoteNotFoundError` y `QuoteUnavailableError`.
- `packages/contracts/quote.ts` (Zod): campos, respuesta de valores por defecto, cuerpo del cálculo (≤ 200 claves `^[a-z0-9.-]{1,80}$`, valores ≤ 64 caracteres), resultado y códigos `QUOTE_UNAVAILABLE` y `QUOTE_NOT_FOUND`; `adminPaths.quote` y `adminPaths.quoteCalculations`; `AdminApiClient.getQuoteDefaults` y `calculateQuote`.
- `api`:
  - `src/cotizador/catalogs/birria.json` con los valores del Excel;
  - `src/cotizador/file-catalog-source.ts`: lectura y validación en `init()`; inválido o ilegible → `quote_catalog_invalid` y 503 (P-2); sin JSON (Molotes) → 404;
  - `src/admin/quote-routes.ts`: `GET /:business/cotizador` y `POST /:business/cotizador/calculos`, con `adminOnly` (401 → 403 `FORBIDDEN_ROLE` → 404 `QUOTE_NOT_FOUND` → 503 `QUOTE_UNAVAILABLE` → cuerpo de 16 KiB → 422 `VALIDATION_FAILED` por clave); log `quote_validation_failed { fields }` sin claves ni valores;
  - `router.ts`, `admin/index.ts` y `server.ts` (`await quotes.init()` antes de las rutas; nunca termina el proceso);
  - `tests/support/admin.ts`: `startAdmin` acepta `quotes` (por defecto, el JSON real).
- Documentación: README (endpoints en "API propia", módulo en la tabla del monorepo y en "Estructura", y la sección nueva "Cotizador de taquizas" con el formato del JSON, los rangos y "Cómo funciona la fórmula de precio y cómo modificarla"); `docs/arquitectura.md` (módulo en el árbol de §4 y apartado "Cotizador de taquizas (REQ-F-046)" en §6 con la fórmula).
- Pruebas permanentes (las del plan): `api/tests/unit/quote-calculator.test.ts` (25 casos) y `api/tests/integration/admin-quote-api.test.ts` (5 casos).

#### Criterios de aceptación (alcance del PR 1: dominio y API)

| Criterio | Estado |
| --- | --- |
| CA-1 a CA-4 | Cumplido en `core` (prueba unitaria): 134/8 040/4 426.57/3 613.43/44.9 %; 47.11 a 65.11; 3 piezas; 145 y 120 (+10, +20, +30); 114, 108, 103, 101; Mixto 1 en 200 = 113 |
| CA-5 | Cumplido: de 101 a 5 000 ningún paquete baja de F ni sube; 500 y 5 000 dan 100 |
| CA-6 | Cumplido en `core`: `belowMinimum` y `minPersonas` = 30 sin precios. El texto "El mínimo es 30 personas" es de la pantalla (PR 2) |
| CA-7 a CA-13 | Cumplido en `core` (53.11/4 786.57/3 253.43; 47.75; 46.61, carta 115 y −19; Mixto 1 fuera de resultados y matriz; 148/8 880/margen/50.2 %; 211 por margen; 110 y 126; ahorro 41 y sin diferencia en los paquetes con quesabirria). Los textos ("19 $ más caro", "mandó el margen") son del PR 2 |
| CA-14 | Cumplido: 30, 35, 40, 45, 50; y 145…101 por defecto, iguales al cálculo individual |
| CA-15 | Cumplido en `core` y en la API (422 por clave, sin cálculo ni 500). Resumen, `aria-*` y valores conservados: PR 2 |
| CA-16, CA-17, CA-24 | Pantalla: PR 2 |
| CA-18 | Cumplido en la API: nada se escribe y cada cálculo parte del JSON vigente; la parte de la pantalla, PR 2 |
| CA-19 | Cumplido en `api` (prueba: los logs no contienen claves ni valores de los ajustes). `inventory-manager`: PR 2 |
| CA-20 | Parámetros desconocidos rechazados en la API (`''`); la query de 8 KB es de `inventory-manager` (PR 2) |
| CA-21 | Cumplido con P-2: el CI falla (la prueba carga el JSON real) con mensajes que nombran paquete y campo; el arranque registra `quote_catalog_invalid` y responde 503 `QUOTE_UNAVAILABLE` sin detalles. La pantalla "Cotizador no disponible": PR 2 |
| CA-22 | Cumplido en la API (editor 403, administrador 200, Molotes 404). Pantalla y menú: PR 2 |
| CA-23 | `provisional` en los campos de masa y consomé y la nota de exclusiones en el DTO; la marca visible es del PR 2 |

Nota: el ticket cita la tarifa en N = 101 como 119.64; el valor exacto es 119.646 (cita truncada). El precio, 120, coincide.

#### Validaciones ejecutadas

- `npm run typecheck`: 0.
- `npm run lint`: 0, sin errores ni avisos.
- `npm test` (con `npm run db:up`): api 48 archivos / 1 148 pruebas, landing-pages 95 / 1 314, inventory-manager 15 / 257; todo en verde. `quote-calculator.test.ts` tarda unos 0.6 s y `admin-quote-api.test.ts` unos 0.7 s.
- Comprobaciones descartadas (no quedan en el repo): script de los CA-1 a CA-15 contra el JSON real; los 71 enteros de 30 a 100 calculados con aritmética entera de la fórmula del Excel (coinciden); mutación de `quote-routes.ts` registrando el cuerpo y los errores: la prueba de logs falla, como se espera.
- `git diff` revisado: solo archivos del ticket.

#### Archivos afectados

Nuevos: `restaurante/packages/core/cotizador/{index,catalog,catalog-schema,fields,adjustments,tariff,rounding,calculator,catalog-source}.ts`, `restaurante/packages/contracts/quote.ts`, `restaurante/api/src/cotizador/catalogs/birria.json`, `restaurante/api/src/cotizador/file-catalog-source.ts`, `restaurante/api/src/admin/quote-routes.ts`, `restaurante/api/tests/unit/quote-calculator.test.ts`, `restaurante/api/tests/integration/admin-quote-api.test.ts`.

Modificados: `restaurante/packages/core/package.json`, `restaurante/packages/contracts/{admin,admin-client,index}.ts`, `restaurante/api/src/admin/{index,router}.ts`, `restaurante/api/src/server.ts`, `restaurante/api/tests/support/admin.ts`, `restaurante/README.md`, `restaurante/docs/arquitectura.md`.

#### Riesgos o pendientes

- PR 2 (pantalla de `inventory-manager`, `sanitizeNext`, pruebas 3 y 4, documentación de la pantalla y `.claude/CLAUDE.md` §8 por P-3).
- Con un campo inválido no se aplican las reglas cruzadas (se evita un mensaje sobre un valor a medio escribir); aparecen al corregirlo.
- "Todos los ítems en 0" marca el primer ítem del paquete; "ningún paquete activo", el campo "Activo" de cada paquete.
- Las pruebas permanentes del plan quedaron en dos archivos nuevos de `api`; no se añadió nada a `admin-api.test.ts`.
- Limpieza: sin bases `restaurante_test*` (comprobado con `SHOW DATABASES`), sin procesos de Vitest ni servidores, sin worktrees; el MySQL local se levantó para las pruebas y se detuvo después (`npm run db:down`), como estaba; los scripts de comprobación del scratchpad se borraron.

#### Correcciones tras el QA (2026-11-16)

Decisión del usuario: "Si corrigelos".

- DEF-001: `quoteCalculationRequestSchema` (`packages/contracts/quote.ts`) revisa las claves propias de `ajustes` con el patrón antes del `z.record` (que descartaba `__proto__`). `{"ajustes":{"__proto__":"1"}}` responde ahora 422 `VALIDATION_FAILED` con `''` «Los ajustes no son válidos; restablece los valores.», como cualquier clave fuera del patrón. Caso añadido a la prueba existente de CA-19 en `api/tests/integration/admin-quote-api.test.ts` (sin archivos nuevos). Mutación descartada: sin la comprobación, la prueba falla con «expected 200 to be 422».
- DEF-002: la fila N = 300 de la tabla de ejemplo dice ahora precio por margen 75 en `restaurante/README.md` y en este ticket.
- Validaciones: `npm run typecheck` 0; `npm run lint` 0; `npm test` (con `npm run db:up`): api 48 / 1 148, landing-pages 95 / 1 314, inventory-manager 15 / 257, en verde.
- Limpieza: sin bases `restaurante_test*`, sin procesos de Vitest ni servidores, un solo worktree; MySQL detenido de nuevo con `npm run db:down`; copia de seguridad de la mutación borrada del scratchpad.

## QA Action Plan

Alcance: **PR 1** (dominio `core/cotizador`, contrato `contracts/quote.ts`, JSON y endpoints de `api`, documentación). La pantalla de `inventory-manager` es el PR 2 y tendrá su propio plan. NotebookLM no está disponible en esta sesión (sus herramientas MCP no se exponen): no se consultó.

### Objetivo

Comprobar con evidencia que el dominio y la API del cotizador calculan lo que fija el ticket (RN-1 a RN-14 y la fórmula), reproducen el Excel hasta 100 personas, rechazan toda entrada inválida sin 500, solo atienden a administradores, no registran los ajustes y no rompen el resto de la API.

### Requisito bajo prueba

REQ-F-046, versión 1, con la Revisión técnica y las decisiones P-1 a P-3 ("Recomendadas"). En el PR 1: RF-9 (parte `api`), RF-10, RF-11 (parte API), RF-12, RN-1 a RN-14, la fórmula de precio y el modelo del JSON.

### Criterios de aceptación (alcance PR 1 → pruebas)

| Criterio | Qué se comprueba en el PR 1 | Pruebas |
| --- | --- | --- |
| CA-1, CA-2 | Cifras exactas por paquete con N = 60; costo variable y piezas | F-1, X-1, X-2 |
| CA-3, CA-4, CA-5 | Bordes 30/100, curva 120–300, Mixto 1 en 200, piso F y monotonía 101–5 000 | F-2, F-3, X-3 |
| CA-6 | `belowMinimum` y sin precios con N = 29 (el texto es del PR 2) | F-2 |
| CA-7 a CA-13 | Cada ajuste del ticket por la API (no solo en `core`) | F-4 |
| CA-14 | Matriz con rango propio y por defecto, iguales al cálculo individual | F-5, X-1 |
| CA-15 | 422 por clave, sin cálculo y sin 500 | N-1 a N-4 |
| CA-18 (parte API) | Un cálculo con ajustes no cambia el siguiente sin ajustes; ni el JSON ni la base cambian | F-6 |
| CA-19 (parte `api`) | Logs sin claves, valores ni cuerpo | S-3 |
| CA-20 (parte API) | Claves desconocidas rechazadas | N-3 |
| CA-21 | CI y arranque con JSON inválido; 503 sin detalles; el resto de la API sigue | S-4, S-5 |
| CA-22 (parte API) | 401, 403, 404, administrador 200 | S-1, S-2 |
| CA-23 (parte API) | `provisional` en masa y consomé y la nota de exclusiones en el DTO | F-7 |

No aplican al PR 1 (se validan en el PR 2): CA-16, CA-17, CA-24, los textos de pantalla de CA-6, CA-9, CA-10, CA-11 y CA-23, la pantalla de CA-21 y CA-22, la query de 8 KB de CA-20 y los logs de `inventory-manager` de CA-19.

### Riesgos identificados

- **Redondeo en coma flotante** en los ,5 exactos del tramo recto (N = 37, 51, 65, 79, 93) y en el precio por margen entero (63 / 0.7).
- **Interpretación de la coma decimal** ("1,600" en campos de 4 decimales = 1.6, aceptado a propósito; en importes, rechazado).
- **Fugas en logs** por el logger de peticiones, el manejador central de errores o el `admin_forbidden`.
- **JSON inválido** que tumbe la `api` entera (contradice P-2) o que el CI no detecte.
- **Ruta `/:business/cotizador`** registrada en el router común: posible choque con rutas existentes o con el 405 de `allowedMethods`.
- **Cifras no finitas** con ajustes extremos (merma o margen de 99.99 %, costos de 100 000, N = 5 000), que harían fallar el contrato de respuesta y darían 500.
- **Diferencia con el Excel** si el JSON no copia bien un parámetro.

### Pruebas funcionales (por la API, con `startAdmin` y sesión de administrador)

- **F-1.** Valores por defecto, N = 60: los cuatro paquetes (precio, venta, costo, utilidad, margen, costo variable, fijo, piezas, `priceSource`, `cartaPrice`, `cartaDiff`) contra CA-1 y CA-2.
- **F-2. Bordes de la fórmula y del redondeo**, los cuatro paquetes, con N = 29, 30, 37, 51, 65, 79, 93, 100, 101, 120, 150, 200, 300, 500 y 5 000. Valor esperado calculado de forma independiente (X-3), no copiado del código. En concreto: 37 → 143 (142.5 sube), 101 → 120, 200 → 103 y Mixto 1 → 113, 500 → 100, 5 000 → F.
- **F-3. CA-5:** barrido de N = 101 a 5 000 en los cuatro paquetes: precio ≥ F y no creciente.
- **F-4. CA-7 a CA-13** por la API, con las claves del contrato: `i.carne-res.costo` = 200; `cb.horas` = 9; `p.tradicional.q.consome-500` = 0; `p.mixto-1.on` = 0 (fuera de `packages` y de `matrix.packages`); `po.margen` = 50; `fe.mano-obra` = 3000 con N = 30; `p.tradicional.f` = 110 con N = 200; `po.ref` = 120 con N = 100; `c.taco` = 35. Más los ejemplos de la tabla de parámetros: F = 90 → 99 en N = 200.
- **F-5. Matriz:** `m.desde` 30, `m.hasta` 50, `m.paso` 5, `m.extra` vacío → filas 30, 35, 40, 45, 50; por defecto, las 11 filas y el Tradicional 145…101; cada celda igual a un cálculo individual con ese N; filas extra repetidas o sobre la rejilla sin duplicar; filas extra por debajo del mínimo → celda `null`.
- **F-6. Sin persistencia (CA-18, RN-14):** cálculo con ajustes y luego otro sin ajustes → valores del JSON; `GET` de valores por defecto igual antes y después; hash del JSON (`shasum`) igual antes y después de la batería; ninguna escritura en base (el cotizador no recibe repositorio; se confirma por el `git status` del árbol y por inspección).
- **F-7. DTO de valores por defecto:** 64 campos, claves únicas y con el patrón del contrato, cada `defaultValue` igual al Excel (X-2), `provisional` solo en masa y consomé (costo, receta y porción), la nota de exclusiones y la nota de la tarifa, las 5 secciones y `personas` {1, 5 000}.
- **F-8. Coma decimal y "modificado":** "200,5" y "200.5" dan el mismo resultado; un valor igual al por defecto ("170", "170,0", "170.00") no aparece en `modified`; el orden de `modified` es el de los campos.

### Pruebas negativas y casos límite

- **N-1. Personas:** "", " ", "0", "-1", "1.5", "60,0", "1e2", "abc", "5001", "999999", "060" (aceptado como 60), " 60 " (recortado), un número JSON en lugar de texto → 422 con `n` (o `''` si el tipo no cumple el contrato), nunca 500.
- **N-2. Valores de campos:** texto, vacío en obligatorio, vacío en `c.quesabirria` (válido), negativo, "-0", "+5", ".5", "5.", "1.2.3", "1,2,3", "1 5", "1e3", "0x10", "Infinity", "NaN", dígitos no ASCII ("１"), demasiados decimales (3 en importes, 5 en gramos), "1,600" en importes (rechazado) y en gramos (1.6, aceptado según la Revisión técnica), extremos (merma 99.99, margen 99.99, costos 100 000, kg por tanda 0 rechazado, volumen 0 rechazado), `p.*.on` distinto de 1/0, `m.extra` con 11 valores, con 0 o 5 001, con separadores mixtos.
- **N-3. Reglas cruzadas y claves:** F = b, F > b, a < b, a = b (plano, aceptado), mínimo = referencia, mínimo > referencia, todos los ítems de un paquete activo en 0 (y de uno inactivo: aceptado), ningún paquete activo, matriz desde < mínimo, hasta < desde, más de 50 filas; clave desconocida (`p.borrado.a`) → `''`; clave con mayúsculas o con `_` → 422 por contrato; `constructor`, `toString` y `__proto__` como claves.
- **N-4. Límites del cuerpo:** exactamente 200 claves válidas → procesa; 201 → 422; valor de 64 caracteres → procesa (y su error de campo), de 65 → 422; clave de 80 y de 81 caracteres; cuerpo justo por debajo y por encima de 16 KiB → 413 por encima; campo extra en la raíz → 422 "Campo desconocido"; `ajustes` como array, `null` o con valores numéricos → 422; JSON mal formado → 400; `Content-Type` distinto de JSON → 415; claves duplicadas en el texto JSON del cuerpo (se registra el comportamiento observado: `JSON.parse` conserva la última; la regla de "duplicados" del ticket es de la query string, que es del PR 2, así que solo se clasifica como defecto si produce 500 o un cálculo con un valor no validado).
- **N-5. Extremos numéricos:** combinación peor (carne 100 000, merma 99.99, margen 99.99, N = 1 y N = 5 000, fijos 1 000 000) → 200 con cifras finitas o 422, nunca 500 ni `admin_response_invalid` en el log.

### Pruebas de seguridad y permisos

- **S-1.** Sin cabecera, con un bearer mal formado o con una sesión inexistente → 401 en los dos endpoints.
- **S-2.** Editor de Birria y editor de Molotes → 403 `FORBIDDEN_ROLE` en los dos endpoints, también sobre `/molotes/cotizador` y un negocio desconocido (el rol se mira antes del negocio). Administrador → 200 en Birria y 404 `QUOTE_NOT_FOUND` en `molotes` y en un negocio desconocido. Administrador degradado a editor durante la sesión → 403 en la siguiente petición; desactivado → 401. `PUT`/`DELETE` sobre las dos rutas → 405 con `Allow`. El POST funciona sin cabecera CSRF (decisión documentada: Bearer, sin cookies).
- **S-3. Logs (CA-19, RF-9):** con el logger capturado de `startAdmin` y valores centinela únicos (p. ej. `98765.43`, `texto-secreto`, una clave desconocida) en peticiones aceptadas, rechazadas por campo, por contrato, por cuerpo grande, por JSON mal formado y por 403: ninguna línea contiene centinelas, nombres de clave de ajustes, el cuerpo ni la query; solo `quote_validation_failed { fields: n }`, `admin_forbidden` con ruta sin query y el registro de peticiones con `ctx.path`. Además, una petición con query string (`?p.tradicional.f=1`) no deja la query en el log.
- **S-4. JSON inválido (CA-21, P-2), sin tocar el JSON real:** `createFileQuoteCatalogSource` con copias del JSON en el scratchpad: F ≥ b, a < b, referencia rota de receta, de ítem de paquete y de `insumoBase`, id duplicado, campo desconocido, `negocio` distinto, sintaxis JSON rota y archivo inexistente. Comprobar: `init()` nunca lanza; `quote_catalog_invalid` nombra paquete y campo (o `reason: 'unreadable'` sin contenido del archivo); con ese origen en `startAdmin`, los endpoints del cotizador → 503 `{ code: 'QUOTE_UNAVAILABLE', message: 'Cotizador no disponible.' }` sin detalles, y las rutas de productos, página y sesión de la misma app siguen respondiendo.
- **S-5. Barrera del CI:** en una copia temporal del árbol en el scratchpad (sin `node_modules` propios, con enlace a los del repo), se rompe el JSON copiado (F ≥ b, y luego una referencia rota) y se ejecuta `api/tests/unit/quote-calculator.test.ts`: debe fallar nombrando paquete y campo. La copia se borra al terminar. Si la copia no puede ejecutar Vitest por el entorno, se documenta como bloqueo y se acepta la evidencia de la prueba permanente que carga el JSON real más S-4.

### Pruebas de integración (contrato y cliente)

- **I-1.** Respuestas 200 y 422 validan contra `quoteDefaultsResponseSchema`, `quoteCalculationResponseSchema` y el error común; `adminPaths.quote('birria')` y `quoteCalculations('birria')` dan las rutas reales.
- **I-2.** `AdminApiClient.getQuoteDefaults` y `calculateQuote` contra el servidor de `startAdmin`: 200, 422 con `fields`, 403 y 503 devueltos con el formato habitual del cliente.
- **I-3. Imagen de producción:** `docker build --target api` (Docker 29 disponible) y comprobar que `src/cotizador/catalogs/birria.json` está en la imagen. Si el build no es posible en el entorno, se registra como bloqueo y se acepta la inspección del Dockerfile (`COPY --from=build /app/api/src ./src`) y del `.dockerignore`, que no excluye `.json`.

### Contraste independiente con el Excel

Con el venv de openpyxl del scratchpad y la copia `cot.xlsx` (solo lectura, `python -I`):
- **X-1.** Valores en caché (`data_only=True`) de las hojas Costeo, Cotizador y Matriz volumen: costos variables por paquete, cifras del Cotizador con el N guardado y la matriz de 30 a 100 de 10 en 10, comparados con la API en los mismos N.
- **X-2.** Celdas editables de la hoja Parametros contra el JSON real y los `defaultValue` del DTO (incluidos los cambios de forma de la Revisión técnica: porcentajes, unidad derivada, `presentacion`, piezas como suma).
- **X-3.** Reimplementación propia en Python, a partir de las fórmulas del Excel (`data_only=False`) y de la fórmula escrita del ticket (no del código TS): precio de los cuatro paquetes en los 71 enteros de 30 a 100 (con `ROUND` de Excel, mitad hacia arriba con `Decimal`) y por encima de 100 con la curva; comparación con la API en todos esos N y en los bordes de F-2. Cualquier diferencia de un peso es un defecto, salvo que el ticket la explique (recargo por quesabirria sustituido por la tarifa propia).

### Pruebas de performance

- **P-1.** Tiempo de respuesta de 20 cálculos en el peor caso permitido (N = 5 000, matriz de 50 filas, 4 paquetes, 200 claves) y de 20 en el caso por defecto, contra el servidor local de `startAdmin`. Se registra la cifra; solo es defecto si una petición se acerca a los tiempos de espera del cliente de `inventory-manager` o si el costo crece sin límite con la entrada.
- **P-2.** El JSON se lee una sola vez (inspección de `init()` y de `server.ts`) y `load` no lee disco.

### Pruebas de regresión

- **R-1.** Desde `restaurante/`: `npm run typecheck`, `npm run lint` (0, sin avisos) y `npm test` completo (api, landing-pages, inventory-manager), con `npm run db:up` si MySQL no está levantado.
- **R-2.** Rutas vecinas del router de administración tras añadir `/:business/cotizador` antes de `/:business/pagina`: `GET/PUT /birria/pagina`, productos, usuarios, bot y sesión siguen respondiendo como antes (cubierto por la suite; se añade una comprobación manual de `GET /birria/pagina` y `GET /api/v1/admin/bot` en la sonda de S-4).
- **R-3.** `startAdmin` sin `quotes` usa el JSON real y no cambia el resto de pruebas de `api` (suite verde).
- **R-4.** Regla de dependencias: `inventory-manager` no importa `core`; `contracts` no importa paquetes del proyecto (`npm run lint`).
- **R-5. Documentación:** README y `docs/arquitectura.md` frente a la implementación: endpoints, códigos (401, 403 `FORBIDDEN_ROLE`, 404 `QUOTE_NOT_FOUND`, 413, 415, 422, 503 `QUOTE_UNAVAILABLE`), claves, rangos, formato del JSON, la fórmula y el ejemplo numérico (se comprueban sus cifras con X-3).

### Pruebas no aplicables al PR 1

Responsive, accesibilidad, UX/UI frente a `_stich_source_/` (no hay diseño del admin), SEO y navegador: el PR 1 no tiene pantalla. Se cubren en el plan del PR 2.

### Pruebas automatizadas (existentes y sondas temporales)

- Existentes: `api/tests/unit/quote-calculator.test.ts` (25 casos) y `api/tests/integration/admin-quote-api.test.ts` (5 casos), más toda la suite.
- Sondas temporales que se crean y se borran (no se commitean, `.claude/rules/testing.md`): un archivo de Vitest temporal en `restaurante/api/tests/integration/` (para usar `startAdmin`, `session`, `call` y el logger capturado: F-1 a F-8, N-1 a N-5, S-1 a S-4, I-1, I-2, P-1) y los scripts de Python de X-1 a X-3 en el scratchpad. **Aprobación necesaria:** la definición del agente limita las sondas a `restaurante/landing-pages/tests/`, pero el código bajo prueba está en `api` y su soporte (`startAdmin`) en `restaurante/api/tests/support/`; pido permiso para crear la sonda temporal en `restaurante/api/tests/integration/` y borrarla al terminar. Alternativa si no se aprueba: scripts en el scratchpad que importen los módulos por ruta absoluta (más lento de montar y sin el logger capturado de `startAdmin`).
- No se añade ninguna prueba permanente. Si una sonda encuentra un defecto de lógica que ninguna prueba cubre, se propone en el QA Report que el caso pase a `quote-calculator.test.ts` o `admin-quote-api.test.ts` al corregirlo.

### Evidencia requerida

Salida de `typecheck`, `lint` y `npm test` (archivos y pruebas por workspace); salida de la sonda con cada caso y su resultado; tabla X-3 de diferencias (esperado 0); líneas de log capturadas en S-3 y S-4; resultado de S-5 (fallo esperado con el mensaje); `docker build` e inspección de la imagen (I-3); tiempos de P-1; hash del JSON antes y después.

### Criterios de aprobación

- Todos los criterios de la tabla de arriba en PASS con evidencia.
- Ninguna diferencia con el Excel en 30–100 ni con la fórmula del ticket por encima de 100.
- Ninguna respuesta 500 ni `admin_response_invalid` con cualquier entrada de N-1 a N-5.
- Logs sin ajustes, claves de ajustes ni cuerpos (S-3).
- JSON inválido: la `api` arranca, el cotizador da 503 sin detalles y el CI falla (S-4, S-5).
- `typecheck`, `lint` y `npm test` en verde.
- Sin defectos `BLOCKER` ni `CRITICAL`; los `MAJOR`, solo con decisión del usuario.

### Limpieza

Al terminar (también si algo falla): borrar la sonda de `api/tests/integration/`, la copia del árbol de S-5 y los scripts y JSON temporales del scratchpad; eliminar la imagen de Docker de I-3; comprobar con `SHOW DATABASES LIKE 'restaurante_test%'` que no quedan bases, que no quedan procesos de Vitest, Node ni servidores ni puertos ocupados, y `git worktree list` y `git status` iguales que al empezar; si MySQL estaba detenido al empezar, volver a detenerlo (`npm run db:down`).

## QA Report

### Ronda

1 (PR 1: dominio, contrato y API), 2026-11-16, sobre `feature/REQ-F-046-cotizador-taquizas` (`dda01f7` + cambios sin commit). Plan aprobado por el usuario: "Apruebo las tres" (plan, sonda temporal en `api/tests/integration/` y copia del árbol más `docker build`). NotebookLM no estaba disponible: no se consultó.

### Pruebas ejecutadas

| Prueba | Acción | Resultado |
| --- | --- | --- |
| R-1 | `npm run db:up`, `npm run typecheck`, `npm run lint`, `npm test` (antes de crear las sondas) | typecheck 0; lint 0 (sin avisos); api 48 archivos / 1 148 pruebas, landing-pages 95 / 1 314, inventory-manager 15 / 257, todo en verde |
| Sonda 1 | `api/tests/integration/qa-req-f-046-sonda.test.ts` (temporal, 11 casos: F-1 a F-8, N-1 a N-5, S-1 a S-4, I-1, I-2, P-1) | 11/11 en verde. Un primer fallo fue de la propia sonda (supuse que `modified` iba en el orden de las claves enviadas; va en el orden de los campos, sección 1 primero, que es lo especificado) |
| Sonda 2 | `qa-req-f-046-sonda2.test.ts` (temporal): cuerpo de 16 384 y 16 385 bytes exactos y `__proto__` | 1/1; ver DEF-001 |
| X-1 a X-3 | `venv/bin/python -I contrast.py cot.xlsx` (openpyxl, solo lectura; modelo propio de las fórmulas del Excel con `Decimal` y `ROUND`/`ROUNDUP`, y la fórmula del ticket por encima de 100) | 20 416 comparaciones, **0 diferencias** |
| S-5 | Copia del árbol en el scratchpad (sin `node_modules`, enlazados), JSON roto en la copia, `vitest run tests/unit/quote-calculator.test.ts` | Con F = b: falla (`$.paquetes[0].tarifa.f`, «Tarifa del paquete "Tradicional": el piso F (120) debe ser menor que la tarifa en la referencia b (120).»). Con ítem roto: falla (`$.paquetes[2].items[0].item`, «Paquete "Mixto 2": el ítem "gordita" no existe.»). Con el JSON intacto: 25/25 |
| I-3 | `docker build -f landing-pages/Dockerfile --target api` e inspección de la imagen | Build en 0; en la imagen, `/app/api/src/cotizador/catalogs/birria.json` (3 524 bytes, `negocio` = birria, 4 paquetes), `file-catalog-source.ts` y los 9 módulos de `/app/packages/core/cotizador/`; sin `tests/` en la imagen |
| R-5 | Revisión de README y `docs/arquitectura.md` frente a la implementación y recálculo de la tabla de ejemplo | Coinciden, salvo DEF-002 |
| F-6 | `shasum` del JSON antes y después | `ac593bf9…` igual antes y después |

### Criterios de aceptación (alcance PR 1)

| Criterio | Resultado | Evidencia |
| --- | --- | --- |
| CA-1 | PASS | N = 60 por la API: Tradicional 134 / 8 040 / 4 426.57 / 3 613.43 / 44.9 %; Mixto 1, Mixto 2 y Especial 144, 154 y 164. Idéntico a la caché de la hoja Cotizador del Excel (B3 = 60) en las 10 columnas por paquete y en el ahorro (26) |
| CA-2 | PASS | Costo variable 47.11 / 53.11 / 59.11 / 65.11 (= Costeo!N5:N8) y 3 piezas en los cuatro |
| CA-3 | PASS | N = 30: 145/155/165/175; N = 100: 120/130/140/150 |
| CA-4 | PASS | Tradicional 114, 108, 103, 101 en 120, 150, 200, 300; Mixto 1 en 200 = 113 |
| CA-5 | PASS | 500 y 5 000 → 100 (F); barrido 101 a 5 000 en los cuatro paquetes: ninguno baja de F ni sube (y coincide entero a entero con la fórmula del ticket en Python) |
| CA-6 (API) | PASS | N = 29: `belowMinimum: true`, `minPersonas: 30`, `price: null` en todos (también N = 1). El texto es del PR 2 |
| CA-7 | PASS | Carne 200: 53.11 / 4 786.57 / 3 253.43 / 134 |
| CA-8 | PASS | 9 h: 47.75 |
| CA-9 | PASS | Consomé 0: 46.61, carta 115, `cartaDiff` −19; Mixto 1 inactivo: fuera de `packages` y de `matrix.packages` |
| CA-10 | PASS | Margen 50: 148 / 8 880 / `margin` / 50.2 % |
| CA-11 | PASS | Fijos 3 000, N = 30: 211, `margin` |
| CA-12 | PASS | F = 110, N = 200: 110; ref 120, N = 100: 126 (y F = 90 → 99) |
| CA-13 | PASS | Taco 35: ahorro 41; los paquetes con quesabirria, `cartaDiff: null` |
| CA-14 | PASS | 30/50/5 sin extra → 30, 35, 40, 45, 50; por defecto 145…101 en 11 filas, cada celda igual al cálculo individual (44 celdas); matriz 30–100 igual a la caché de "Matriz volumen" (precio, costo y utilidad, 96 valores) |
| CA-15 (API) | PASS | Cada caso → 422 `VALIDATION_FAILED` con su clave (F = b, F > b, a < b, mínimo = / > referencia, merma o margen 100, negativo, texto, vacío, `Infinity`, `NaN`, todos los ítems en 0, ningún paquete activo), sin cálculo y sin 500 |
| CA-18 (API) | PASS | Un cálculo con ajustes no cambia el siguiente sin ajustes ni el `GET` de valores por defecto; JSON con el mismo hash; el cotizador no recibe ningún repositorio |
| CA-19 (`api`) | PASS | Logs capturados en peticiones aceptadas, rechazadas por campo, por contrato, por 413, 400, 415 y 403, y un `GET` con query: ninguna línea contiene los 16 centinelas (valores, claves de ajustes, `?`). Solo `request` con `ctx.path`, `quote_validation_failed { fields: n }`, `admin_forbidden` sin query y el acceso |
| CA-20 (API) | PASS | Clave desconocida → `''` «El enlace tiene campos que ya no existen…»; clave fuera del patrón → `''` «Los ajustes no son válidos…». Ver DEF-001 para `__proto__` |
| CA-21 | PASS | CI: S-5. Arranque: `init()` no lanza con ninguno de los 11 JSON rotos; `quote_catalog_invalid` nombra ruta, paquete y campo (o `reason: unreadable` con `name`/`code`, sin el contenido del archivo); los dos endpoints → 503 `{ code: QUOTE_UNAVAILABLE, message: "Cotizador no disponible." }`; sesión, productos, bot y usuarios siguen en 200 (página, 503 igual que con el JSON válido: almacén vacío del arnés) |
| CA-22 (API) | PASS | Sin sesión, bearer mal formado o inexistente → 401; editores de Birria y de Molotes → 403 `FORBIDDEN_ROLE` (también sobre `molotes` y un negocio desconocido); administrador → 200, y 404 `QUOTE_NOT_FOUND` en `molotes` y `tacos`; administrador degradado → 403 en la siguiente petición; desactivado → 401 |
| CA-23 (API) | PASS | `provisional: true` solo en `i.masa.costo`, `i.consome.costo`, `r.taco.masa`, `r.quesabirria.masa` y `r.consome-500.consome`; notas `exclusions`, `tariff` y `not-saved` en el DTO |
| CA-16, CA-17, CA-24 y la parte de pantalla de los demás | No aplica | PR 2 |

### Defectos encontrados

### DEF-001
- Severidad: TRIVIAL
- Criterio de aceptación afectado: CA-20 (parte API: "se rechazan los parámetros desconocidos").
- Descripción: una clave `__proto__` dentro de `ajustes` se descarta en silencio en lugar de rechazarse. El patrón del contrato no admite `_`, pero el `z.record` de Zod omite esa clave antes de validarla, así que `ajustes` llega vacío.
- Pasos para reproducir: `POST /api/v1/admin/birria/cotizador/calculos` con el cuerpo literal `{"personas":"60","ajustes":{"__proto__":"1"}}` (o con un objeto como valor).
- Resultado esperado: 422 `VALIDATION_FAILED` con `''`, como `p_tradicional` o `P.tradicional.a`.
- Resultado actual: 200 con el cálculo de los valores por defecto y `modified: []`.
- Evidencia: sonda 2 (`proto` y `protoObj` → 200; `__proto__` en la raíz → 422 «Campo desconocido.»).
- Impacto: ninguno observable en las cifras (el cálculo es el del JSON) ni contaminación de prototipos; solo una incoherencia con la regla de claves desconocidas. La pantalla del PR 2 filtra antes las claves desconocidas de la query.
- Recomendación: que el cuerpo con esa clave se rechace igual que cualquier otra clave fuera del patrón. No bloquea.

### DEF-002
- Severidad: TRIVIAL
- Criterio de aceptación afectado: ninguno (documentación de la fórmula).
- Descripción: en la tabla "Ejemplo (Tradicional, valores por defecto)", la fila N = 300 dice "Precio por margen 76"; el valor correcto es **75** ((47.1095 + 1 600 / 300) / 0.7 = 74.92 → 75). El precio sugerido (101) es correcto.
- Pasos para reproducir: `POST …/calculos` con `personas: "300"` → `marginPrice: 75`; recálculo independiente en Python, también 75.
- Resultado esperado: 75 en la tabla.
- Resultado actual: 76 en `restaurante/README.md` (línea 1484) y en el ticket ("Cómo funciona la fórmula…", línea 199).
- Evidencia: `prices.json` de la sonda (N = 300, `marginPrice: 75`) y el cálculo independiente.
- Impacto: un lector que compruebe la tabla verá una cifra que la herramienta no da. No afecta a ningún cálculo.
- Recomendación: corregir la cifra en el README (y, si se quiere, en el ticket).

### Observaciones (no son defectos)

- "-0" se acepta como 0 en los importes (es 0; los negativos sí se rechazan).
- Las claves repetidas dentro del cuerpo JSON se quedan con el último valor (`JSON.parse`), que sí se valida: con el último inválido → 422; con el último válido → 200. La regla de "parámetros duplicados" del ticket es de la query string (PR 2).
- "1,600" en un importe se rechaza con «Usa como máximo 2 decimales.»; en gramos se acepta como 1.6. Es lo que fijó la Revisión técnica, mitigado por la ayuda de la pantalla (PR 2).
- Con 200 claves de 80 caracteres y valores de 64, el cuerpo supera los 16 KiB y responde 413 antes que el tope de claves: los dos topes son coherentes (16 384 bytes exactos → 200; 16 385 → 413; 200 claves cortas → se procesan; 201 → 422).
- Con ajustes absurdos (carne 100 000 $/kg, merma 99.99 %, margen 99.99 %, 50 tacos de 5 000 g) los precios rondan 2.5 × 10¹⁵: finitos y sin 500, pero la venta (precio × N) pierde precisión entera por encima de 2⁵³. Fuera de todo uso real.
- `pagina` responde 503 en el arnés con y sin el JSON roto (el almacén de páginas del arnés está vacío): no lo provoca el cotizador.
- No arranqué el `server.ts` real con el JSON roto: habría conectado con la base de desarrollo y el proveedor del bot del `.env`. La parte del cotizador en el arranque es `await quotes.init()`, que no lanza en ninguno de los 11 casos probados.

### Regresión

- Suite completa en verde (api 1 148, landing-pages 1 314, inventory-manager 257), typecheck y lint en 0.
- Router: `PUT /birria/cotizador` → 405 `Allow: HEAD, GET`; `GET`/`DELETE …/calculos` → 405 `Allow: POST`; sesión, productos, bot y usuarios responden igual con y sin el cotizador disponible.
- `startAdmin` sin `quotes` usa el JSON real: el resto de la suite de `api` sigue en verde.
- Regla de dependencias: `npm run lint` en 0.

### Responsive, Accesibilidad, UX/UI y SEO

No aplican al PR 1 (sin pantalla). Se validan en el PR 2.

### Performance

- 20 cálculos por defecto: mediana 0.79 ms (máx. 2.92 ms).
- 20 en el peor caso permitido (N = 5 000, matriz de 50 filas, 4 paquetes): mediana 1.37 ms (máx. 1.89 ms).
- 200 claves → 422 en 1.04 ms.
- El JSON se lee una vez en `init()`; `load` no lee disco.

### Contraste con el Excel

- **X-1:** caché del Excel frente a la API.
  - Costeo N5:N8: el modelo propio coincide con la caché.
  - Cotizador con N = 60 (B3 = 60), los cuatro paquetes: costo variable, fijo, total, precio por margen, precio comercial, precio, venta, costo, utilidad, margen real y el ahorro del Tradicional.
  - Matriz volumen de 30 a 100: precio, costo y utilidad de los cuatro paquetes.
  - 0 diferencias.
- **X-2:** los 29 parámetros de la hoja Parametros y las cantidades y tarifas derivadas frente a los `defaultValue` del DTO (a y b de cada paquete = 145/120 + 10 × quesabirrias): 0 diferencias.
- **X-3:** precios de los cuatro paquetes con N de 26 a 101 por la API y con la fórmula del Excel; por encima de 100, la fórmula del ticket por la API (102 a 5 000, 12 puntos) y por `core` (30 a 5 000, todos los enteros): 0 diferencias.
  - Bordes: 37 → 143/153/163/173 (142.5 sube); 51 → 138; 65 → 133; 79 → 128; 93 → 123; 101 → 120 (tarifa 119.646); 200 → 103/113/123/133; 500 → 100/110/120/130.
- Redondeo: `ceilInt(63 / 0.7)` = 90 y `roundHalfUp(142.5)` = 143.

### Pendientes de revisión manual

Ninguno en el PR 1.

### Limpieza

- Borradas las dos sondas de `restaurante/api/tests/integration/`.
- Borrados la copia del árbol, los JSON rotos, los scripts, las salidas y los logs del scratchpad (quedan solo `cot.xlsx`, `cotizador-analisis.md` y `venv`, que ya existían).
- Eliminada la imagen `qa-req-f-046-api:tmp`.
- Sin bases `restaurante_test*` (`SHOW DATABASES`: solo `restaurante`, `restaurante_shadow` y las del sistema).
- Sin procesos de Vitest ni servidores Node escuchando.
- MySQL detenido de nuevo con `npm run db:down`, como estaba al empezar.
- `git worktree list` (un solo árbol) y `git status` iguales que al empezar (mismo resumen; solo cambió este ticket, que ya estaba sin seguimiento). JSON del cotizador con el mismo hash.

### Resultado final

QA_APPROVED. Todos los criterios del alcance del PR 1 pasan con evidencia. Hay dos defectos TRIVIAL que no bloquean (DEF-001 y DEF-002); se pueden corregir en el PR 2 o antes del commit, a decisión del usuario. No se añade ninguna prueba permanente.

## Historial de cambios

### Versión 1

Descripción inicial, aprobada por el usuario el 2026-11-16. Incluye las decisiones del usuario de ese día y el cambio de alcance "Quiero que el cotizador me deje cambiar al menos todo lo que puedo modificar en el excel", más los supuestos S-1 a S-7.

### Revisión técnica (2026-11-15)

senior-fullstack añade la "Revisión técnica" (sin bloqueos; preguntas P-1 a P-3 con recomendación) y el "Technical Action Plan" en 2 PR. Estado: `NEEDS_TECHNICAL_PLAN_APPROVAL`. El ticket sigue en `backlog/`.

### Implementación del PR 1 (2026-11-16)

El usuario aprueba el plan técnico ("Recomendadas": P-1 rama `main`, P-2 la `api` arranca y el cotizador responde 503, P-3 `.claude/CLAUDE.md` §8 en el PR 2). senior-fullstack crea `feature/REQ-F-046-cotizador-taquizas` desde `main`, mueve el ticket a `in-progress/` e implementa el PR 1 (dominio, contrato y API, con su documentación y pruebas). Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

### QA Action Plan del PR 1 (2026-11-16)

El usuario aprueba la implementación del PR 1 ("Si"). senior-qa analiza el ticket, el diff y las pruebas, y añade el "QA Action Plan" del PR 1 (dominio, contrato y API; la pantalla queda para el plan del PR 2). Pide además permiso para crear una sonda temporal en `restaurante/api/tests/integration/`. Sin ejecutar pruebas. Estado: `NEEDS_QA_PLAN_APPROVAL`.

### QA del PR 1, ronda 1 (2026-11-16)

El usuario aprueba el QA Action Plan, la sonda temporal en `api/tests/integration/` y la copia del árbol más `docker build` ("Apruebo las tres"). senior-qa ejecuta el plan y añade el "QA Report", con dos defectos TRIVIAL (DEF-001 `__proto__` ignorado en `ajustes`; DEF-002 la cifra 76 en lugar de 75 en la tabla de ejemplo del README). Limpieza verificada. Estado: `QA_APPROVED`.

### Correcciones y Pull Request del PR 1 (2026-11-16)

El usuario pide corregir los dos defectos antes del commit ("Si corrigelos"). senior-fullstack corrige DEF-001 (el contrato rechaza `__proto__` en `ajustes` con 422) y DEF-002 (75 en la tabla de ejemplo), vuelve a validar, hace el commit `2f257bc` y abre el Pull Request https://github.com/orvigas/negocio/pull/151 hacia `main` (en borrador hasta este commit; se marca como listo después de su push y se comprueba el CI). Estado: `READY_FOR_MERGE` (PR 1).
