# REQ-F-008 — Modelo común de producto con Prisma/SQLite y CRUD

## Estado

APPROVED

## Aprobación

Aprobado por el usuario (versión 1, fecha 2026-10-03). Citas textuales:

- "apruebo 007 y 008";
- confirmación de que la versión aprobada es la que presentó el Business Analyst (P-1 a P-3 y CA-1 a CA-37): "a".

Respuestas a las preguntas de clarificación (cita textual: "apruebo todo"):

- 8.1 A: se reconfirman D-1 a D-4, D-6, D-8 a D-10 y D-12 a D-17 del análisis descartado;
- 8.2 A: el autor es el usuario autenticado;
- 8.3 A: permisos por rol y por negocio;
- 8.4 A: la API no tiene lectura pública.

Origen: trabajo aparte listado en REQ-F-004 ("Modelo de producto común con Prisma/SQLite"). Retoma el análisis de producto que antes llevaba el ID REQ-F-004 y que se descartó para migrar primero a TypeScript. Solicitud original (cita textual): "Quiero que diseñes un modelo en comun para ambos landign pages que se mapee a una tabla producto en sql-lite con prisma y crees el CRUD en la API, la pase de datos debe ser persistente".

Sustituye en parte a REQ-F-001 (`done/`), solo en lo que se refiere a los productos. No modifica ese ticket.

## Objetivo

Que ambas landings usen un único modelo de producto, guardado en la tabla `producto` de SQLite, sobre la base que deja REQ-F-007.

Los productos se gestionan desde la administración y desde una API JSON protegida por los usuarios y roles de REQ-F-007. Se pueden:

- crear, consultar y editar;
- eliminar con borrado lógico y recuperar;
- reordenar.

Los datos sobreviven a reinicios y despliegues.

## Decisiones confirmadas por el usuario

- **D-1.** En SQLite van solo los productos: platillos, bebidas, variantes y chips. Hero, promociones y texto destacado siguen en JSON (REQ-F-001).
- **D-2.** CRUD completo, con orden.
  - Se acepta que la cantidad de tarjetas no coincida con Stitch (8 en Molotes y 6 en Birria).
  - Textos como "8 Sabores de Barrio" los mantiene el usuario.
- **D-3.** Una tabla `producto` con los campos comunes y columnas opcionales por negocio, más tablas hijas de variantes y chips. Las bebidas de Molotes pasan a ser productos de la categoría "bebida".
- **D-4.** Borrado lógico.
- **D-5′.** Usan la API y la administración de productos los usuarios autenticados de REQ-F-007, con su sesión, CSRF y HTTPS en producción.
  - El administrador opera en ambos negocios.
  - El editor solo opera en sus negocios asignados.
  - Una operación sobre un negocio no permitido responde 403 y no cambia nada.
- **D-6.** La administración se adapta a la base de datos y añade crear, eliminar y ordenar.
- **D-7′.** Se conservan el registro de cambios y el aviso de conflicto por producto, con una versión por producto.
  - El autor es el usuario autenticado (nombre visible e identificador).
  - Ya no hay un campo "autor" escrito a mano.
  - Para productos no hay "restaurar versión anterior".
- **D-8.** En el primer arranque, los productos se importan **una sola vez**: desde `current.json` si existe y, si no, desde la semilla.
- **D-9.** Se mantienen las validaciones de REQ-F-001. El slug se genera a partir del nombre y no se puede editar.
- **D-10.** El `.db` vive en `DATA_DIR` y las migraciones se aplican al arrancar.
  - La base técnica la aporta REQ-F-007; este ticket añade tablas y migraciones.
  - Los respaldos del `.db` los hace quien opera la VM.
- **D-11′.** No hay API pública: todas las rutas exigen sesión, también las de lectura. Si el bot necesitara acceso, lo resolvería REQ-F-009.
- **D-12.** Los productos eliminados aparecen en una lista "Eliminados" y se pueden recuperar. Al recuperarlos vuelven al final del orden y como no disponibles.
- **D-13.** Límites:
  - como máximo **50 productos activos** por negocio;
  - de **1 a 6 variantes** por producto;
  - de **1 a 6 chips** por producto.

  Las variantes y los chips se pueden agregar, quitar y reordenar.
- **D-14.** El tipo de detalle de Birria (`chips`, `portion` o `variants`), el slug y la categoría se eligen al crear el producto y después no se pueden cambiar.
- **D-15.** Si la base de datos falla:
  - **al arrancar:** el servidor no arranca; termina con código 1 y un error controlado;
  - **con el servidor en marcha:** las landings muestran los últimos productos válidos que tiene en memoria, y la administración y la API de productos responden 503.
- **D-16.** Un slug repetido en el mismo negocio recibe un sufijo (`-2`, `-3`, …), aunque el producto original esté eliminado. Un slug nunca se reutiliza.
- **D-17.** Un producto nuevo se agrega al final de su categoría y se crea como no disponible.
- **D-18 (P-1).** Si el cuerpo de una petición a la API trae un campo `author`, se rechaza como campo desconocido (422).
- **D-19 (P-2).** La API hace las comprobaciones en este orden y responde con el código de la primera que falla:
  1. sesión (401);
  2. permiso sobre el negocio (403);
  3. CSRF y HTTPS (403);
  4. existencia del producto (404);
  5. validación (422);
  6. versión (409).
- **D-20 (P-3).** Las acciones que hizo un usuario que después se desactiva conservan a ese usuario como autor en el registro (coherente con REQ-F-007, D-6).

## Alcance

- Modelo de producto y sus migraciones sobre la base de REQ-F-007.
- Importación única desde la semilla o desde `current.json`/`previous.json`.
- Landings leyendo los productos de la base de datos.
- API JSON de productos bajo `/admin`, con autorización por rol y negocio.
- Administración HTML adaptada.
- Registro de cambios y aviso de conflicto por producto.
- Ajustes de Docker si hacen falta, README, `.env.example` y pruebas.

## Fuera de alcance

- Mover hero, promociones o texto destacado a la base de datos.
- API pública, consumidores externos o tokens.
- Subir imágenes: solo se edita su metadata (REQ-F-001, C-4).
- "Restaurar versión anterior" y "restaurar semilla" para productos.
- Sincronización con el bot de WhatsApp (REQ-F-009).
- Respaldos automáticos y varias instancias del servidor.
- Rediseñar las landings.

## Requisitos

### RF-1 Modelo común de producto

1. **Campos comunes:**
   - identificador;
   - negocio (`molotes` o `birria`);
   - categoría (`platillo` o `bebida`);
   - slug;
   - nombre y descripción;
   - etiqueta (badge en Molotes, tag en Birria);
   - precio en centavos y unidad de precio (opcional);
   - disponible;
   - posición;
   - imagen: src, alt, ancho y alto;
   - versión;
   - fechas de creación y de actualización;
   - eliminado y fecha de eliminación.
2. **Campos opcionales según el negocio y la categoría:**
   - **Molotes, platillo:** tono (lista cerrada de REQ-F-001), precio por orden y cantidad por orden.
   - **Molotes, bebida:** icono (Material Symbols) y tono (`amber` o `red`). No tiene imagen.
   - **Birria, platillo:** tipo de detalle y título del bloque de detalle. Según el tipo:
     - `portion`: porción y extra;
     - `chips`: tabla hija con texto, resaltado y posición;
     - `variants`: tabla hija con etiqueta, precio, descripción, disponible y posición. Estos productos no tienen precio ni descripción propios.
3. **Combinaciones permitidas:**
   - Molotes: platillo y bebida.
   - Birria: solo platillo. La tarjeta "Bebidas Frías del Comal" sigue siendo un producto con variantes.
4. Un campo que no corresponde a la combinación de negocio y categoría se rechaza.

### RF-2 Persistencia

1. Las tablas viven en el `.db` de REQ-F-007, en `DATA_DIR`. No se incluyen en el repositorio ni en las imágenes.
2. Las migraciones pendientes se aplican al arrancar. Si alguna falla, se aplica D-15.
3. Cada escritura es atómica: el producto, con sus variantes, sus chips y la entrada del registro, se guarda completo o no se guarda.
4. Los datos sobreviven a reinicios, despliegues y a la reconstrucción del contenedor si se conserva el volumen.

### RF-3 Carga inicial (D-8)

1. La carga se hace cuando un negocio no tiene productos y nunca se importó:
   - si hay un `current.json` válido, se importa desde él;
   - si no, desde la semilla.
2. La importación respeta el orden, la disponibilidad, las variantes y los chips.
   - Los slugs de Birria se mantienen.
   - Los `id` de Molotes pasan a ser slugs.
3. Ocurre una sola vez. Queda en el log y en el registro con el autor "sistema" y la acción "importación".
4. Si `current.json` está dañado, se usa `previous.json` y, si tampoco sirve, la semilla. El log indica la fuente.
5. Después de importar, los productos que sigan en el JSON se ignoran. El formato del JSON es la pregunta Q-3 de la revisión técnica.

### RF-4 Landings

1. `/molotes`, `/birria` y `/` muestran los productos activos y disponibles de su negocio, por orden de posición.
   - Los platillos van en el menú.
   - Las bebidas de Molotes van en su sección.
2. Se aplican sin cambios las reglas de REQ-F-001 RF-4:
   - lo que no está disponible se oculta;
   - la variante activa es la primera disponible;
   - un producto sin variantes disponibles se oculta;
   - una sección vacía muestra el aviso con el CTA de WhatsApp.
3. Con los datos importados, el HTML es idéntico al actual: los snapshots no cambian.
4. Un cambio guardado se ve en la siguiente petición, sin reiniciar el servidor.

### RF-5 API JSON de productos (D-5′, D-11′)

1. **Operaciones.** Los nombres de las rutas los decide `senior-fullstack` y van bajo `/admin`.
   - Listar, con los eliminados solo si se piden.
   - Ver.
   - Crear.
   - Actualizar con la versión esperada.
   - Eliminar con la versión esperada.
   - Recuperar.
   - Reordenar los productos de un negocio y una categoría.
2. **Autenticación y autorización.**
   - Se usa la sesión de REQ-F-007.
   - Se comprueba el permiso sobre el negocio (D-5′).
   - Las escrituras exigen CSRF y, en producción, HTTPS.
   - Si la administración está deshabilitada, la API también (503).
3. **Respuestas.**
   - JSON con el formato de error centralizado.
   - Precios en centavos y también en pesos.
   - Nunca se exponen rutas, SQL ni stack traces.
4. **Códigos HTTP** (en el orden de D-19):

   | Código | Cuándo |
   | --- | --- |
   | 200 / 201 | Lectura o actualización correcta / creación correcta |
   | 401 | Sin sesión |
   | 403 | Negocio no permitido para el usuario, sin CSRF o por HTTP en producción |
   | 404 | El producto no existe o es de otro negocio |
   | 409 | Conflicto de versión |
   | 413 / 415 | Cuerpo demasiado grande / tipo de contenido no admitido |
   | 422 | Error de validación, con los errores por campo |
   | 503 | Administración deshabilitada o base de datos no disponible |

5. El autor es siempre el usuario autenticado (D-7′, D-18).

### RF-6 Administración HTML

1. `/admin/molotes` y `/admin/birria`, solo para quien tenga permiso sobre ese negocio, muestran:
   - la lista de productos por categoría y en orden, con nombre, precio, disponibilidad y acciones;
   - el formulario de hero y promociones, sin cambios respecto a REQ-F-007.
2. Acciones disponibles:
   - crear;
   - editar;
   - eliminar, con confirmación;
   - recuperar;
   - subir y bajar en el orden.
3. Todo funciona sin JavaScript:
   - POST-redirect-GET;
   - errores por campo que conservan lo escrito;
   - la sesión y el CSRF de REQ-F-007.
4. Al crear un producto de Birria se elige el tipo de detalle. Las variantes y los chips se pueden agregar, quitar y reordenar dentro de los límites de D-13.
5. Las páginas siguen con `noindex` y sin caché, y las landings siguen sin enlaces a `/admin`.

### RF-7 Validaciones (D-9)

1. Se mantienen las reglas de REQ-F-001 RF-3, tanto en la API como en los formularios:
   - **Precios:** mayores que $0.00, hasta $5,000.00 y con 2 decimales como máximo. Se guardan en centavos.
   - **Textos:** las longitudes máximas de REQ-F-001.
   - **Cantidad por orden:** de 1 a 20.
   - **Imagen:**
     - el src empieza con `/img/`, tiene una extensión permitida y no contiene `..`;
     - el archivo existe al guardar;
     - el alt es obligatorio;
     - el ancho y el alto van de 1 a 4000.
   - **Icono y tonos:** solo valores de las listas cerradas.
   - **Campos desconocidos:** se rechazan.
2. **Slug:**
   - se genera al crear, a partir del nombre: minúsculas, sin acentos y con guiones;
   - no se puede editar;
   - es único por negocio (D-16).
3. Se aplican los límites de D-13. Recuperar un producto cuando ya hay 50 activos responde 422.
4. La categoría y el tipo de detalle no se pueden editar (D-14).
5. Si un campo no es válido, no se guarda nada.

### RF-8 Concurrencia y registro (D-7′)

1. Cada producto tiene una versión que aumenta con cada escritura: editar, eliminar, recuperar o reordenar.
2. Si la versión enviada ya no es la vigente:
   - la API responde 409 con quién hizo el cambio y cuándo;
   - la administración muestra el aviso con dos opciones, "Guardar mis cambios de todos modos" y "Descartar y cargar la versión actual". Es el comportamiento de REQ-F-001 RF-7, aplicado a cada producto.
3. Cada escritura queda en el registro con:
   - fecha y hora, en la zona horaria del negocio;
   - el usuario autenticado (nombre visible e identificador);
   - negocio y slug;
   - acción: crear, actualizar, eliminar, recuperar, reordenar, sobrescribir tras conflicto o importar;
   - campos modificados, con su valor anterior y el nuevo.
4. La página muestra por negocio "Último cambio: <fecha> por <nombre>", con el cambio más reciente entre productos y hero/promociones. El formato del registro lo decide `senior-fullstack`.

### RF-9 Arquitectura

1. Las landings, la administración y la API usan un repositorio de productos con dos implementaciones:
   - Prisma con SQLite;
   - memoria, para las pruebas.
2. Los menús de las semillas JSON pasan a ser la semilla de la importación de productos.
3. El esquema estructural de REQ-F-001 ("estructura igual a la semilla") deja de aplicarse a los productos.

## Historias de usuario

- **HU-1.** **Como** dueño o editor **quiero** agregar un producto **para** ofrecerlo sin cambiar código.
- **HU-2.** **Como** dueño o editor **quiero** eliminar un producto que ya no vendo y poder recuperarlo **para** corregir un error sin perder datos.
- **HU-3.** **Como** dueño o editor **quiero** cambiar el orden de los productos **para** destacar los que más me interesan.
- **HU-4.** **Como** dueño **quiero** que los productos y precios no se pierdan al reiniciar o actualizar la app.
- **HU-5.** **Como** editor **quiero** que me avisen si otra persona cambió el mismo producto mientras yo lo editaba.
- **HU-6.** **Como** dueño **quiero** saber qué usuario cambió qué producto y cuándo.
- **HU-7.** **Como** dueño **quiero** que un editor de un negocio no pueda tocar los productos del otro.
- **HU-8.** **Como** cliente **quiero** ver solo productos vigentes y disponibles con el precio correcto **para** pedir por WhatsApp sin sorpresas.

## Reglas de negocio

- **RN-1.** Se mantiene RN-1 de REQ-F-001 sobre precios válidos, también para las variantes.
- **RN-2.** Lo eliminado o no disponible nunca aparece en la landing.
- **RN-3.** Un slug no se edita ni se reutiliza.
- **RN-4.** Nunca se sobrescribe un cambio ajeno sin que el usuario lo acepte.
- **RN-5.** Toda escritura tiene como autor a un usuario autenticado y queda en el registro.
- **RN-6.** La importación inicial ocurre una sola vez y nunca pisa productos que ya existen.
- **RN-7.** Las landings nunca muestran un error por un fallo de la base de datos con el servidor en marcha.
- **RN-8.** Un editor nunca lee ni escribe productos de un negocio que no tiene asignado.

## Criterios de aceptación

### Persistencia e importación

- **CA-1.** Given un `DATA_DIR` sin productos, When arranca el servidor, Then:
  - se aplican las migraciones de producto;
  - se importa la semilla;
  - `/molotes` y `/birria` se ven igual que hoy (snapshots sin cambios).
- **CA-2.** Given un `current.json` de Molotes con "Queso Oaxaca" a 50.00 y "Huitlacoche" no disponible, When se hace la primera importación, Then la landing muestra "$50 c/u" y no muestra Huitlacoche.
- **CA-3.** Given una importación ya hecha, When el servidor se reinicia, Then:
  - no se vuelve a importar;
  - se conservan los cambios hechos después;
  - no se registra otra importación.
- **CA-4.** Given que se creó un producto, When se reinicia el contenedor de producción con el mismo volumen, Then el producto sigue ahí.
- **CA-5.** Given un `current.json` dañado y un `previous.json` válido, When se importa, Then se usa `previous.json` y el log indica la fuente.
- **CA-6.** Given una migración de producto que falla, When arranca el servidor, Then termina con código 1 y un mensaje controlado.

### Landings

- **CA-7.** Given un platillo nuevo de Molotes, disponible y en la posición 2, When se carga `/molotes`, Then aparece segundo con su nombre, badge, tono, precio unitario y precio por orden.
- **CA-8.** Given una bebida nueva disponible, When se carga `/molotes`, Then aparece en la sección de bebidas y no en el menú.
- **CA-9.** Given un producto eliminado o no disponible, When se carga la landing, Then no aparece en el HTML.
- **CA-10.** Given un producto de Birria cuya primera variante no está disponible, When se carga `/birria`, Then la variante activa es la siguiente disponible, con su precio y su descripción.
- **CA-11.** Given que se eliminan todos los platillos de un negocio, When se carga la landing, Then se muestra el aviso de REQ-F-001 RF-4.5 con el CTA de WhatsApp.
- **CA-12.** Given un cambio guardado, When se recarga la landing, Then el cambio se ve sin reiniciar el servidor.

### API y permisos

- **CA-13.** Given que no hay sesión, When se llama a cualquier operación de la API, también de lectura, Then responde 401 y no cambia nada.
- **CA-14.** Given una sesión válida sin token CSRF, When se intenta crear, actualizar, eliminar, recuperar o reordenar, Then responde 403 y no cambia nada.
- **CA-15.** Given un editor asignado solo a Molotes, When intenta cualquier operación sobre los productos de Birria, también de lectura, por la API o por la administración HTML, Then responde 403 y no cambia nada. Given un administrador, Then puede operar en ambos negocios.
- **CA-16.** Given datos válidos, When se crea un producto, Then:
  - responde 201;
  - el slug se generó a partir del nombre;
  - la versión es 1;
  - el producto queda en la última posición y no disponible;
  - el registro tiene como autor al usuario de la sesión.
- **CA-17.** Given que "Molotes de Queso Oaxaca" ya existe, When se crea otro con el mismo nombre, Then su slug termina en `-2`.
- **CA-18.** Given una actualización con cualquiera de estos campos, When se procesa, Then responde 422 y no cambia nada:
  - un slug, una categoría o un tipo de detalle distintos;
  - un campo desconocido;
  - un campo de otra categoría;
  - un campo `author` (D-18).
- **CA-19.** Given un precio de 0, 5000.01, 45.505, -10 o "abc", When se envía, Then responde 422 con el error en el campo. Given 0.01 o 5000.00, Then se acepta.
- **CA-20.** Given una imagen inexistente, sin alt, con `..` en el src o con una extensión no permitida, When se guarda, Then responde 422.
- **CA-21.** Given 50 productos activos, When se crea o se recupera otro, Then responde 422. Given 0 o 7 variantes o chips, When se guarda, Then responde 422.
- **CA-22.** Given un id que no existe o que es de otro negocio, dentro de un negocio permitido, When se consulta, actualiza o elimina, Then responde 404.
- **CA-23.** Given la administración deshabilitada (REQ-F-007 R-4), When se llama a la API, Then responde 503 y las landings siguen funcionando.
- **CA-24.** Given un error interno, When se responde, Then el cuerpo sigue el formato centralizado, sin SQL, rutas ni stack trace.

### Eliminar, recuperar y ordenar

- **CA-25.** Given un producto, When se elimina con la versión vigente, Then:
  - desaparece de la landing y de la lista principal;
  - sigue en la base de datos marcado como eliminado;
  - aparece en "Eliminados".
- **CA-26.** Given un producto eliminado, When se recupera, Then vuelve al final del orden, no disponible y con el mismo slug.
- **CA-27.** Given los platillos A, B y C, When se sube C una posición, Then el orden en la landing y en la administración es A, C, B.

### Concurrencia y registro

- **CA-28.** Given que los usuarios Ana y Luis abren el mismo producto y Ana guarda primero, When Luis guarda o elimina, Then no cambia nada y Luis ve que Ana lo cambió y cuándo:
  - en la API, con un 409;
  - en la administración, con el aviso y sus dos opciones.
- **CA-29.** Given el aviso de conflicto de CA-28:
  - When Luis elige "Guardar mis cambios de todos modos", Then se guardan sus cambios y el registro anota "sobrescribir tras conflicto" con Luis como autor.
  - When elige "Descartar", Then no se escribe nada y ve los datos de Ana.
- **CA-30.** Given dos usuarios que editan productos distintos, When ambos guardan, Then se aplican los dos cambios sin conflicto.
- **CA-31.** Given cualquier escritura, When termina, Then:
  - el registro tiene la fecha, el usuario, el negocio, el slug, la acción y los campos modificados (antes y después);
  - la página muestra "Último cambio" con el nombre visible.

### Administración HTML

- **CA-32.** Given JavaScript deshabilitado, When se crea, edita, elimina (con confirmación), recupera u ordena un producto, Then la operación se completa y recargar la página no la repite.
- **CA-33.** Given un error de validación, When se vuelve a mostrar el formulario, Then conserva lo escrito y muestra errores accesibles junto a cada campo.
- **CA-34.** Given la edición de hero o promociones, When se guarda, Then funciona como en REQ-F-007 y no toca los productos.

### Fallos con el servidor en marcha

- **CA-35.** Given que la base de datos falla con el servidor en marcha:
  - When se carga una landing, Then responde 200 con los últimos productos válidos.
  - When se usa la administración o la API de productos, Then responde 503 y el log registra el fallo.

### Docker, calidad y documentación

- **CA-36.** La imagen `production` sigue cumpliendo CA-19 de REQ-F-007. Además pasan `docker compose run --rm test`, el CI, `typecheck` y `lint`.
- **CA-37.** El README y `.env.example` documentan:
  - la importación única;
  - las operaciones de la API;
  - los permisos por rol;
  - la recomendación de respaldar el `.db`.

## Casos límite

- Primer arranque con un `current.json` válido, dañado o inexistente.
- Reinicio después de la importación.
- Una migración que falla.
- La base de datos falla con el servidor en marcha.
- Nombre duplicado, o slug igual al de un producto eliminado.
- Edición simultánea del mismo producto o de productos distintos.
- Intento de cambiar el slug, la categoría o el tipo de detalle.
- Producto de Birria con todas sus variantes no disponibles.
- Sección vacía.
- Límites de D-13.
- Pedir por id un producto de otro negocio.
- Un editor pierde el permiso sobre un negocio mientras lo edita (REQ-F-007, CA-11).
- La sesión caduca a mitad de una edición.
- Recarga después de un POST y botón atrás.
- Cuerpo enorme o con un tipo de contenido no admitido.
- Imagen que se borra de `public/img` después de guardar: se ve rota, pero no se bloquea nada.
- "8 Sabores de Barrio" no se actualiza solo.

## Dependencias

- REQ-F-007: base de Prisma, usuarios, roles, sesión y autor verificado.
- REQ-F-004: TypeScript.
- REQ-F-001: validaciones, formato de errores y registro de hero y promociones.
- REQ-F-003: Docker.
- REQ-F-005 y REQ-F-006: lint y CI.

## Riesgos

- **R-1.** Más productos que los del diseño pueden romper la cuadrícula. Es una desviación aceptada (D-2).
- **R-2.** Habrá dos fuentes de datos: los productos en la base de datos y hero/promociones en JSON. Aceptado (D-1).
- **R-3.** Si el `.db` se corrompe y no hay respaldo, se pierden los productos. Aceptado (D-10).
- **R-4.** Hasta REQ-F-009, el bot no se entera de los cambios de productos.
- **R-5.** Las migraciones automáticas pueden fallar en producción. Se mitiga con D-15 y con los respaldos.

## Pendiente para la revisión técnica (senior-fullstack)

- **Q-3** (de la revisión técnica del análisis descartado): qué formato tienen `current.json` y `previous.json` después de la importación. Las opciones son mantener la v1 con los productos "congelados", que permite volver atrás con seguridad, o pasar a una v2 sin productos.
- Q-1 ya no aplica, porque el backend es TypeScript. Q-2 se resuelve en REQ-F-007.
- Insumo: la propuesta técnica preliminar de esa revisión, que incluye:
  - esquema;
  - rutas `/admin/api/...`;
  - caché en memoria para las landings;
  - tabla de cambios escrita en la misma transacción.

  Hay que adaptarla a los usuarios de REQ-F-007.

## Action Plan

### Objetivo

Que los usuarios con permiso puedan crear, editar, ordenar, eliminar y recuperar productos. Los cambios se ven al instante, sobreviven a los despliegues y quedan atribuidos a un usuario verificado.

### Alcance

Ver la sección "Alcance".

### Fuera de alcance

Ver la sección "Fuera de alcance".

### Cambios requeridos

1. Modelo y migraciones de producto (RF-1, RF-2).
2. Repositorios de Prisma y de memoria (RF-9).
3. Importación única (RF-3).
4. Landings leyendo del repositorio, con los snapshots sin cambios (RF-4).
5. Validación compartida entre la API y los formularios (RF-7).
6. API con autorización por rol y negocio (RF-5).
7. Administración HTML (RF-6).
8. Registro y conflictos (RF-8).
9. Ajustes de Docker si hacen falta.
10. Pruebas CA-1 a CA-37.
11. Documentación.

### Reglas de negocio

RN-1 a RN-8.

### UX/UI

- **Landings:** no cambia el marcado; solo cambian la cantidad y el orden de las tarjetas.
- **Administración:**
  - sencilla y sin diseño en Stitch;
  - acciones etiquetadas en texto;
  - confirmación antes de eliminar;
  - botones de subir y bajar accesibles con teclado;
  - funciona sin JavaScript.

### Integraciones

Ninguna externa. El CTA de WhatsApp no cambia.

### Casos límite

Ver la sección "Casos límite".

### Criterios de aceptación

CA-1 a CA-37.

### Dependencias

Ver la sección "Dependencias".

### Riesgos

Ver la sección "Riesgos".

### Orden recomendado

El de "Cambios requeridos". Se empieza después de que REQ-F-007 esté terminado.

### Resultado esperado

Los usuarios con permiso gestionan los productos de su negocio desde `/admin` o desde la API. Los cambios se ven al instante en la landing, sobreviven a los despliegues y quedan atribuidos a un usuario verificado.

## Trazabilidad

| Objetivo | Requisito | Historia | Criterios | UI / diseño |
| --- | --- | --- | --- | --- |
| Modelo persistente | RF-1, RF-2, RF-9 | HU-4 | CA-1, CA-4, CA-6, CA-36 | — |
| Migrar sin perder datos | RF-3 | HU-4 | CA-1 a CA-3, CA-5 | — |
| Landings desde la base de datos | RF-4 | HU-8 | CA-7 a CA-12, CA-35 | Stitch, con cantidad variable de tarjetas (D-2) |
| CRUD y permisos | RF-5, RF-7, D-5′ | HU-1, HU-2, HU-7 | CA-13 a CA-24 | — |
| Eliminar, recuperar y ordenar | RF-5, RF-6 | HU-2, HU-3 | CA-25 a CA-27 | Administración sencilla |
| Conflictos y autor verificado | RF-8, D-7′ | HU-5, HU-6 | CA-28 a CA-31 | Aviso de conflicto |
| Administración HTML | RF-6 | HU-1 a HU-3 | CA-32 a CA-34 | Sin diseño fuente (aceptado) |
| Documentación | — | — | CA-37 | — |

## Historial de cambios

### Versión 1

Descripción inicial (2026-10-03). Retoma el análisis descartado: reconfirma D-1 a D-4, D-6, D-8 a D-10 y D-12 a D-17 (8.1 A) y adapta D-5, D-7 y D-11 a usuarios y roles (8.2 A, 8.3 A y 8.4 A). Las propuestas P-1 a P-3 pasan a D-18 a D-20. Aprobada por el usuario ("apruebo 007 y 008"; confirmación de versión: "a").
