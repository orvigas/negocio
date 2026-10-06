# REQ-F-008 — Modelo común de producto con Prisma/SQLite y CRUD

## Estado

DONE (2026-10-06; PR #28 mergeado en `main`, commit de merge `94760b1`)

Pull Request: https://github.com/orvigas/negocio/pull/28 (CI del commit `dfe6b72`: `calidad` y `docker` en verde; CI del push a `main` de `94760b1`: `calidad` y `docker` en verde).

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

## Revisión técnica

Revisión de `senior-fullstack` (2026-10-06) sobre `main` en `2bad7cf`, con el código que dejaron REQ-F-007, REQ-F-010 y REQ-F-011. Incluye spikes en el scratchpad, sin tocar el repositorio.

### Hallazgos del spike

| # | Hallazgo | Consecuencia en el plan |
| --- | --- | --- |
| S-1 | `prisma migrate diff --from-migrations prisma/migrations --to-schema <borrador>` genera para las tablas de producto una migración de solo `CREATE TABLE` y `CREATE INDEX`, sin redefinir tablas existentes. `src/db/migrate.ts` la aplica sobre una base con usuarios sin cambios. | La migración se crea con `npm run db:migrate:dev -- --name productos`. No hay que tocar el aplicador. |
| S-2 | Con 100 productos y 600 variantes en `ON DELETE CASCADE`, una migración futura que redefine `product` al estilo de Prisma (`CREATE new_…`, `INSERT … SELECT`, `DROP`, `RENAME`) conserva las 600 variantes y las 100 entradas del registro. La protección de REQ-F-007 (S-7: FK desactivadas antes de `BEGIN` y `foreign_key_check` antes de `COMMIT`) funciona con las tablas hijas. Con `foreign_keys=ON`, borrar un producto con entradas en el registro falla (`RESTRICT`). | Una prueba de regresión de este escenario entra en `tests/unit/db-migrate.test.ts`. Los productos nunca se borran físicamente (D-4). |
| S-3 | Importación de ida y vuelta: semilla → filas de producto → listas con la forma actual de `MenuData` → `renderLandingPage`. El HTML es **idéntico byte a byte** a `tests/snapshots/landing-{molotes,birria}.html` en los dos negocios. Los slugs de Molotes no aparecen en el HTML. Los de Birria sí, como sufijo de los `id` (`card-`, `price-`, `title-`, `desc-`, `variants-`), y no chocan con los `id` fijos de la página. | Las landings siguen usando `renderLandingPage` y `buildVisibleMenu` sin cambios: solo cambia de dónde salen las listas (CA-1 y RF-4.3). |
| S-4 | Costos: insertar 100 productos con 600 variantes y su registro en una transacción tarda unos 4 ms. Leer el catálogo completo de un negocio (productos y variantes) tarda unos 0,45 ms. Renderizar una landing tarda unos 0,16-0,18 ms por petición. | Las landings leen de una caché en memoria por negocio, que se recarga después de cada escritura. Lo exige D-15 (servir los últimos productos válidos si la base falla), no el rendimiento. |
| S-5 | **REQ-F-007 (RT-6): con una base ya migrada, el código anterior no arranca** (`DATABASE_NEWER_THAN_CODE`). Volver a la versión anterior a este ticket exige restaurar también el respaldo del `.db` previo a la actualización. | Cambia el análisis de Q-3 (abajo): la vuelta atrás realista es "imagen anterior + `.db` del respaldo + los JSON tal como estén". |

### Q-3: formato de `current.json` y `previous.json` después de la importación

| | A) Formato actual (v1) con los productos "congelados" (recomendada) | B) Formato nuevo (v2) sin productos |
| --- | --- | --- |
| Qué guarda el JSON | Igual que hoy. Los productos del JSON dejan de usarse: se copian tal cual en cada guardado de hero y promociones, y nunca se editan. | Solo hero, texto destacado y promociones (`schemaVersion: 2`). |
| Cambios en el código | El formulario y el registro de cambios trabajan solo con hero, destacado y promociones. El repositorio de menús conserva su validación y añade los productos vigentes al guardar. | Esquema nuevo, conversión v1 → v2 de `current.json` y `previous.json` al arrancar, semilla de hero y promociones separada de la de productos y pruebas de la conversión. |
| Volver a la versión anterior (imagen anterior + `.db` del respaldo, S-5) | Los JSON siguen siendo válidos para el código anterior. Se conservan los cambios de hero y promociones hechos después de la actualización. Los productos vuelven a los del JSON, es decir, a los del momento de la importación o de la última restauración. | El código anterior no reconoce `schemaVersion: 2`: aísla el archivo como dañado, publica la semilla y bloquea la edición hasta que alguien restaura. Los cambios de hero y promociones no se pierden, pero quedan en `damaged-*.json`. |
| Riesgo | Alguien que abra el JSON a mano puede creer que esos productos son los vigentes. `seed.json` no debe cambiar sus listas de productos mientras exista el formato v1: si cambiaran, los JSON existentes se tratarían como dañados (como hoy). | Conversión de archivos en producción, aunque sea una sola vez. |
| Tamaño | Pequeño. | Mediano. |

**Recomendación: A.** Es el cambio más pequeño, no reescribe archivos de producción y es el único que permite volver atrás sin pasar por el estado "dañado". El riesgo de confusión se documenta en el README y en `.env.example`.

### Desajustes con lo que dejó REQ-F-007

| # | Requisito del ticket | Situación real tras REQ-F-007 | Propuesta (se aprueba con el plan) |
| --- | --- | --- | --- |
| M-1 | RF-5.4: HTTP en producción → **403**. | `src/middleware/admin-guard.ts` responde **503 `ADMIN_UNAVAILABLE`** a cualquier `/admin` por HTTP en producción, antes de mirar la sesión. | **Q-5 A (recomendada):** mantener el 503 en todo `/admin`, también en la API, y no tener dos respuestas para el mismo caso. B: 403 solo en `/admin/api`. |
| M-2 | CA-17: si "Molotes de Queso Oaxaca" ya existe, el nuevo se llama `…-2`. | RF-3.2 convierte los `id` de Molotes en slugs: el producto importado tiene el slug `queso-oaxaca`. Uno nuevo con el mismo nombre genera `molotes-de-queso-oaxaca`, que no choca. El criterio no se cumple tal como está escrito con los productos importados. Lo mismo pasa en Birria: `quesabirria` frente a `quesabirria-con-tortilla-de-mano`. | **Q-4 A (recomendada):** mantener RF-3.2 y leer CA-17 como "si el slug generado ya existe en el negocio (activo o eliminado)". Se prueba con un producto creado por la API y con un slug importado escrito a propósito. B: al importar, generar los slugs de Molotes a partir del nombre. CA-17 se cumpliría literalmente, pero se perdería la correspondencia con los `id` de la semilla y del historial. Los de Birria no pueden cambiar, porque están en el HTML (snapshots). |
| M-3 | D-19: sesión → permiso → CSRF/HTTPS → 404 → 422 → 409. | En los formularios HTML, DT-12 de REQ-F-007 comprueba el mismo origen antes de la sesión, y la sesión ausente responde 303 al acceso. | La API sigue exactamente D-19: 401 JSON, 403 JSON por permiso, origen y CSRF, 404, cuerpo (413/415/400), 422 y 409. Los formularios HTML conservan el orden y las respuestas de REQ-F-007. |
| M-4 | CA-18 y D-18: campo desconocido o `author` → **422**. | `admin-access.ts` responde **400 `INVALID_FORM`** a un campo desconocido en los formularios HTML: solo ocurre si alguien manipula el formulario. | 422 con el error en el campo en la API (D-18). 400 en los formularios HTML (convención de REQ-F-007). |
| M-5 | RF-5.2: CSRF en las escrituras de la API. | El token solo viaja en el campo `_csrf` de los formularios. No hay forma de pedirlo en JSON. | Cabecera `X-CSRF-Token` y `GET /admin/api/sesion`, que devuelve el usuario y el token. Es segura porque la cookie es `SameSite=Strict`, no hay CORS y, por lo tanto, otro sitio no puede leer la respuesta. El acceso sigue siendo el formulario `POST /admin/login`; no hay acceso JSON (no se pidió). |
| M-6 | RF-5.4: 503 si la base de datos falla. | El gate responde a ese caso con una página HTML. | En `/admin/api/*`, el 503 es JSON (`DATABASE_UNAVAILABLE`). En el resto de `/admin` sigue la página HTML. |
| M-7 | RF-6.1: el formulario de hero y promociones, "sin cambios respecto a REQ-F-007". | Hoy ese formulario incluye todos los productos. | Pierde los campos de productos. Conserva hero, texto destacado ("8 Sabores de Barrio"), promociones, conflicto, restaurar versión anterior y datos dañados. |
| M-8 | RF-2.3: el producto y la entrada del registro se guardan juntos o no se guardan. | El registro de hero y promociones es `changes.jsonl`, fuera de la base de datos. | Registro de productos en la tabla `product_change`, en la misma transacción. Hero y promociones siguen en `changes.jsonl`. "Último cambio" toma el más reciente de los dos. |

Ninguno cambia el alcance funcional. Q-3, Q-4 y Q-5 se presentan con su recomendación en "Decisiones que se aprueban con este plan".

## Technical Action Plan

### Objetivo técnico

- Mover los productos (platillos, bebidas, variantes y chips) a SQLite (Prisma 7, la base de REQ-F-007), con una importación única desde los JSON o desde la semilla.
- Las landings deben quedar idénticas con los datos importados.
- Exponer el CRUD por una API JSON bajo `/admin/api` y por la administración HTML, con la sesión, los roles, el CSRF y el autor verificado de REQ-F-007.
- Conservar hero, texto destacado y promociones en los JSON de REQ-F-001 (Q-3 A).

### Decisiones técnicas

| ID | Decisión | Motivo |
| --- | --- | --- |
| DT-1 | **Esquema** (migración `…_productos`, generada con `prisma migrate dev`): `product` con los campos comunes y las columnas opcionales de RF-1 (`tone`, `order_price_cents`, `order_quantity`, `icon`, `details_type`, `details_label`, `portion`, `portion_extra`, imagen en 4 columnas anulables), `version`, `created_at`, `updated_at`, `deleted` y `deleted_at`, `UNIQUE(business, slug)` e índice `(business, category, deleted, position)`. Tablas hijas `product_variant` y `product_chip` (`ON DELETE CASCADE`, `UNIQUE(product_id, position)`). Registro `product_change`: `at`, `business`, `product_id`, `slug`, `action`, `actor_id` (anulable, `RESTRICT`), `actor_name` y `changes` en JSON. `product_import` con `business` como PK, `imported_at`, `source` y `count`. Enums de Prisma `ProductCategory` (`platillo`, `bebida`) y `DetailsType`. | S-1 y S-2. Una sola tabla con columnas opcionales (D-3). `actor_name` guarda el nombre visible del momento: el registro no cambia si el usuario se renombra o se desactiva (D-20). |
| DT-2 | **Reglas por combinación** en `src/services/product-schema.ts`: una definición declarativa por negocio, categoría y tipo de detalle, con los campos permitidos y sus reglas. Reutiliza las hojas de `menu-schema.ts` (`textError`, `imageSrcError`, `isValidPriceCents`, `ICON_PATTERN`, longitudes y listas cerradas de REQ-F-001). La API (JSON) y los formularios (campos planos) se convierten a la misma entrada y se validan con la misma función. Errores por ruta (`name`, `image.src`, `variants.2.price`). Un campo de otra combinación, desconocido o `author` es un error (RF-1.4, D-18). | RF-7 sin duplicar reglas. |
| DT-3 | **Precios:** la entrada va en pesos (número JSON o texto, `"45.50"`) y se procesa con `parsePesosInput`, que ya rechaza 0, 5000.01, 45.505, -10 y "abc" (CA-19). La salida lleva `priceCents` y `price` (`"45.00"`), y lo mismo para `orderPrice` y las variantes (RF-5.3). | CA-19 está escrito en pesos. |
| DT-4 | **Slug** (`src/services/slug.ts`): NFD, sin diacríticos, minúsculas, `[^a-z0-9]+` → `-`, sin guiones en los extremos y como máximo 54 caracteres (queda espacio para el sufijo dentro de los 60 de `KEY_PATTERN`). Un nombre sin letras ni dígitos genera `producto`. Si ya existe en el negocio, aunque esté eliminado, se agregan `-2`, `-3`, … (D-16). El índice único es la última defensa. | RF-7.2 y RN-3. |
| DT-5 | **Repositorio de productos** (`src/repositories/product-repository.ts`): una sola implementación de las reglas sobre un **`ProductStore`** con dos implementaciones, `prisma-product-store.ts` (transacciones de Prisma) y `memory-product-store.ts` (copia y sustitución, atómica). Las mismas pruebas de contrato corren contra los dos. Operaciones: `init`, `importOnce`, `getPublished` (desde memoria), `list`, `get`, `create`, `update`, `remove`, `restore`, `reorder` y `getLastChange`. Las escrituras de un negocio se serializan con un mutex en proceso (como el repositorio de menús). Dentro de la transacción: comprobación de versión (`UPDATE … WHERE id AND version`), límite de 50 activos, slug, posiciones y la entrada de `product_change`. | RF-9.1 sin duplicar reglas. Las pruebas de landings y controladores no necesitan SQLite. El comportamiento con Prisma se prueba con bases temporales (`tests/support/database.ts`). |
| DT-6 | **Caché de las landings:** `getPublished(business)` devuelve listas con la forma actual de `MenuData` (`MolotesItem[]`, `MolotesDrink[]`, `BirriaItem[]`), en orden de posición y sin los eliminados. Se carga en `init` y se recarga después de cada escritura confirmada. Si la recarga falla, se registra el error, se conserva la caché anterior y se reintenta en la siguiente operación de la administración. Las landings nunca consultan la base de datos. | D-15, RN-7, CA-12 y CA-35. Es posible porque hay una sola instancia (fuera de alcance tener varias). |
| DT-7 | **Landings:** el controlador combina `menuRepository.getPublished(b).data` (hero, destacado y promociones) con `products.getPublished(b)` y llama a `renderLandingPage` igual que hoy. `buildVisibleMenu` y las plantillas no cambian. | S-3: snapshots sin cambios (CA-1 y RF-4.3). |
| DT-8 | **Importación única** (`importOnce`, al arrancar, después de abrir la base): un negocio sin fila en `product_import` y sin productos importa, en una transacción, los productos con su orden, disponibilidad, variantes y chips, la fila de `product_import` y una entrada `import` por producto (autor `sistema`, `actor_id` nulo). La fuente es el documento que el repositorio de menús ya resolvió al arrancar: `current` si es válido; si no, `previous`; si no, `seed`. Se expone con un método nuevo, `getStartupSource(b)`. En una instalación nueva, el repositorio de menús escribe la semilla como `current` y la fuente queda como `seed`. Log `products_imported { business, source, count }`. Un negocio con productos pero sin fila de importación no se toca y genera un aviso en el log. | RF-3, CA-1 a CA-3, CA-5 y RN-6. Se reutiliza el manejo de datos dañados de REQ-F-001 sin volver a leer los archivos. |
| DT-9 | **Q-3 A:** el formulario, el guardado y el registro de hero y promociones usan un "esquema de página" (`hero`, `menu.highlight` y `promo`; `drinks` sale del formulario). `save` recibe solo esos datos y el repositorio copia las listas de productos del documento vigente. `restorePrevious` y `restoreSeed` no cambian. `diffMenuData` se aplica solo a los campos de página, para que `changes.jsonl` no muestre cambios de productos que ya no se usan. | Ver Q-3. |
| DT-10 | **Rutas de la API** (`src/routes/admin-api.ts`, registradas antes de `/:business`): `GET /admin/api/sesion`; `GET /admin/api/:negocio/productos` (`?eliminados=1` y `?categoria=`); `POST /admin/api/:negocio/productos` (201 con `Location`); `GET`, `PUT` y `DELETE /admin/api/:negocio/productos/:id`; `POST /admin/api/:negocio/productos/:id/recuperar`; `PUT /admin/api/:negocio/productos/orden`. `PUT` reemplaza todos los campos editables y exige `version`. Si incluye `slug`, `category` o `detailsType` iguales a los actuales, se aceptan; si son distintos, 422 (CA-18). `DELETE` lleva la versión en `?version=`. `recuperar` lleva `{ version }`. `orden` lleva `{ category, items: [{ id, version }] }` con exactamente los activos de esa categoría; si no coinciden, 422; con una versión vieja, 409. | RF-5.1. |
| DT-11 | **Acceso de la API** (`src/controllers/admin-api-access.ts`, junto a `admin-access.ts`): sesión con la misma comprobación de `sessionVersion`, pero **401 JSON** en lugar de 303; permiso con `canEditBusiness` (403 JSON); en las escrituras, mismo origen y `X-CSRF-Token` (403); después, el 404 del producto (un producto de otro negocio responde 404, CA-22); después, el cuerpo con `readJsonBody` (nuevo en `src/utils/json-body.ts`: solo `application/json` o 415, como máximo 32 KB o 413, UTF-8 y JSON válido o 400 `INVALID_JSON`); y por último la validación (422 con `{ error: { code: 'VALIDATION_FAILED', message, fields: { ruta: mensaje } } }`) y la versión (409 con `{ error: { code: 'VERSION_CONFLICT', current: { version, updatedAt, updatedBy } } }`). El gate responde 503 en JSON en `/admin/api/*` si la base falla (M-6). | D-19 y M-3 a M-6. |
| DT-12 | **Administración HTML** (`src/controllers/admin-products.ts`, `src/views/admin/products.ts` y parciales). `GET /admin/:negocio`: "Último cambio", lista de productos por categoría (nombre, precio, disponible y acciones Editar, Eliminar, Subir y Bajar), enlaces "Agregar platillo" y "Agregar bebida" (esta solo en Molotes) y "Ver eliminados", y debajo el formulario de hero y promociones. Producto nuevo: `GET …/productos/nuevo?categoria=` y, en Birria, primero la elección del tipo de detalle (formulario GET); después `POST …/productos`. Editar: `GET/POST …/productos/:id`, con la versión oculta, el aviso de conflicto y sus dos opciones. Eliminar: `GET …/productos/:id/eliminar` (confirmación) y `POST`; con conflicto, "Eliminar de todos modos" o "Cancelar y ver la versión actual". Además: `POST …/recuperar`, `POST …/subir` y `…/bajar` (cada uno con la versión del producto), y `GET …/productos/eliminados`. Variantes y chips: 6 filas fijas. Cada una tiene sus campos, un selector "Posición" (1 a 6) y la casilla "Quitar". Las filas vacías se ignoran. Se exige de 1 a 6 filas (D-13). Todo funciona sin JavaScript y con POST-redirect-GET. Los errores por campo conservan lo escrito y usan los patrones accesibles de las vistas de REQ-F-007 (`aria-invalid`, `aria-describedby` y resumen con `role="alert"`). | RF-6 y CA-32 a CA-34. La administración no tiene diseño en Stitch (aceptado en el ticket). Se reutilizan las clases y parciales actuales. |
| DT-13 | **Versión:** entero que empieza en 1 y aumenta en cada escritura (editar, eliminar, recuperar y, al reordenar, en los productos que cambian de posición). Recuperar: posición al final, `available=false`, 422 si ya hay 50 activos. Crear: al final de su categoría y `available=false` (D-17), aunque la entrada diga lo contrario. Si la entrada trae `available`, se ignora al crear. | RF-8.1, D-12 y D-17. |
| DT-14 | **Registro:** acciones `create`, `update`, `delete`, `restore`, `reorder`, `overwrite_after_conflict` e `import`. `changes` guarda un diff campo a campo (antes y después, precios en centavos) con `diffMenuData`. "Último cambio" = el más reciente entre `product_change` (de ese negocio) y `updatedAt` del JSON. Las fechas se guardan en UTC y se muestran en `BUSINESS_TIMEZONE`. | RF-8.3, RF-8.4 y CA-31. |
| DT-15 | **Errores:** los errores de Prisma inesperados pasan por `toUnavailable` (como en `user-repository.ts`). `P2002` en el slug se reintenta una vez con el siguiente sufijo. Errores de dominio: `ProductNotFoundError` (404), `ProductValidationError` (422), `ProductConflictError` (409) y `ProductLimitError` (422, en el campo correspondiente). El log nunca lleva el `message` de Prisma ni el contenido de los productos: solo `business`, `productId`, `action` y `version`. | RF-5.3, CA-24 y CA-35. |
| DT-16 | **Arranque** (`src/server.ts`): repositorio de menús → base de datos (migraciones) → primer administrador → `products.init()` (importación y caché) → app. Si falla un paso de productos: log `products_init_failed` con el código y salida con 1. | D-15 y CA-6. |

### Archivos o componentes afectados

Nuevos:
- `prisma/migrations/<fecha>_productos/migration.sql` (generada).
- `src/services/product-schema.ts` y `src/services/slug.ts`.
- `src/repositories/product-repository.ts`, `prisma-product-store.ts` y `memory-product-store.ts`.
- `src/utils/json-body.ts`.
- `src/controllers/admin-api-access.ts`, `admin-products-api.ts` y `admin-products.ts`.
- `src/routes/admin-api.ts`.
- `src/views/admin/products.ts` y sus parciales `.html`: lista, formulario, filas de variantes y chips, confirmación y eliminados.
- Pruebas (ver Testing).

Modificados:
- `prisma/schema.prisma`.
- `src/server.ts` y `src/app.ts` (dependencia `products`).
- `src/routes/index.ts` y `admin.ts`.
- `src/controllers/landing.ts` y `admin.ts` (formulario de página y "Último cambio").
- `src/middleware/admin-guard.ts` (503 JSON en la API).
- `src/repositories/menu-repository.ts` (`getStartupSource`, guardado de página) y `memory-menu-repository.ts`.
- `src/services/menu-schema.ts` (esquema de página), `admin-form.ts` y `menu-diff.ts` (si hace falta).
- `src/views/admin/index.ts` y `business.html`.
- `tests/helpers.ts` y `tests/support/admin.ts` (repositorio de productos en memoria por defecto).
- Pruebas de administración que hoy editan productos desde el formulario de página: `admin.test.ts`, `admin-form.test.ts`, `admin-file-repository.test.ts` y `file-menu-repository.test.ts`.
- `README.md`, `.env.example` y `.claude/agents/senior-fullstack.md` (sección de persistencia).
- Docker y CI: no se esperan cambios. `production` ya copia `prisma/migrations` y el cliente generado. Se verifica igualmente.

### Frontend

- Landings: sin cambios de marcado, CSS ni JS. Solo cambian la cantidad y el orden de las tarjetas (D-2, R-1).
- Administración: HTML semántico (`table` para las listas, con `caption` y encabezados; `fieldset` y `legend` en los formularios), botones con texto ("Subir <nombre>", "Bajar <nombre>", "Eliminar <nombre>") y foco visible. Sin JavaScript nuevo. Si una página nueva usa clases nuevas, se ejecuta `npm run build:css` (admin).

### Backend

Ver DT-1 a DT-16. Las escrituras de productos no tocan los JSON, y las de hero y promociones no tocan la base (CA-34).

### Contenido / configuración

- `seed.json` de cada negocio: sin cambios. Sigue siendo la semilla de hero y promociones y la de la importación (RF-9.2). Sus listas de productos quedan fijas mientras exista el formato v1 (Q-3 A).
- Sin variables de entorno nuevas.

### Validaciones

- Las de RF-7 (DT-2 a DT-4) en la API y en los formularios, con los mismos mensajes que REQ-F-001.
- La imagen se comprueba en disco con `createImageChecker` (ya existe).
- `:id` entero positivo (si no, 404). `:negocio` de `BUSINESS_IDS` (si no, 404). Consulta `categoria` de la lista cerrada (si no, 422 en la API y 404 en el HTML).

### Manejo de errores

- La API usa siempre el formato centralizado `{ error: { code, message } }`, con `fields` o `current` cuando corresponda. Nunca SQL, rutas ni stack (CA-24).
- HTML: 422 con el formulario y los errores; 409 con el aviso de conflicto; 403 y 503 con las páginas de REQ-F-007; 404 con el JSON común actual.

### Testing

- **Unitarias:**
  - `product-schema`: cada combinación; campos de otra combinación y desconocidos; `author`; precios de CA-19; imagen de CA-20; límites de D-13.
  - `slug`: acentos, símbolos, longitud y sufijos.
  - Contrato del repositorio contra los dos stores: crear (versión 1, al final, no disponible y autor), editar, conflicto, sobrescribir, eliminar, recuperar (al final, no disponible, mismo slug y límite de 50), reordenar (A, C, B), slug `-2` con un original eliminado, registro de cada acción y atomicidad (un fallo simulado a mitad no deja nada).
  - `json-body`.
  - Caché: un fallo de recarga conserva la anterior.
- **Integración (SQLite temporal, `listenLocal`):**
  - CA-1: snapshots sin cambios tras importar la semilla.
  - CA-2 y CA-5: `current.json` con Queso Oaxaca a 50.00 y Huitlacoche no disponible; `current.json` dañado con `previous.json` válido y el log de la fuente.
  - CA-3: segundo arranque sin reimportar.
  - CA-6: una migración que falla sale con 1 (`server-startup.test.ts`).
  - CA-7 a CA-12 en las landings.
  - Matriz de la API (CA-13 a CA-24): sin sesión, sin CSRF, editor del otro negocio, 404 cruzado, 413 y 415, 503 deshabilitada.
  - CA-25 a CA-31: eliminar, recuperar, ordenar, conflicto Ana/Luis con dos sesiones y productos distintos sin conflicto.
  - CA-32 y CA-33: HTML sin JavaScript y PRG, errores accesibles.
  - CA-34: hero y promociones no tocan productos.
  - CA-35: la base falla con el servidor en marcha → landing 200 con la caché, y API y HTML 503 con log.
- **Regresión de migraciones:** redefinición de `product` con variantes (S-2) y compatibilidad con el CLI (prueba existente).
- **Docker (CA-36):** `docker compose run --rm test`, imagen `production` en amd64 y arm64 con volumen (migración, importación en el primer arranque y ninguna en el segundo) y CA-4 (reinicio con el mismo volumen).
- Comandos: `npm run db:generate`, `npm run build:css`, `npm run typecheck`, `npm run lint` y `npm test`. CI `calidad` y `docker` en el PR.

### Seguridad

- Ninguna ruta de productos sin sesión (D-11′). Permiso por negocio antes de leer el cuerpo (RN-8). CSRF con token sincronizador (campo o cabecera) más el origen.
- Cuerpo JSON limitado y sin construir objetos a partir de claves recibidas (lista cerrada de campos).
- El autor siempre sale de la sesión (D-18).
- Salida HTML escapada con `{{ }}`. CSP y Helmet sin cambios.
- El token CSRF solo sale en `/admin/api/sesion` y en los formularios. Nunca se registra.

### Performance

- Las landings: cero consultas por petición (caché).
- La administración: una lectura del catálogo por página.
- La recarga de la caché solo ocurre después de una escritura (unos 0,5 ms, S-4).

### Riesgos técnicos

| ID | Riesgo | Mitigación |
| --- | --- | --- |
| RT-1 | Tamaño del cambio: unos 25 archivos nuevos y 25 modificados. Hay que reescribir buena parte de `admin.test.ts`, porque el formulario de página ya no lleva productos. | Etapas con la suite en verde. Las pruebas que se reescriben conservan la intención de sus criterios (REQ-F-001 y REQ-F-007). |
| RT-2 | Dos fuentes de datos y dos registros (R-2). | "Último cambio" combina las dos fuentes. El README explica qué hay en cada sitio. |
| RT-3 | Volver atrás exige restaurar el `.db` del respaldo (S-5). | README: respaldo antes de actualizar y procedimiento de vuelta atrás. Con Q-3 A, los JSON siguen sirviendo. |
| RT-4 | Una caché desfasada si alguien edita la base a mano con el servidor en marcha. | Fuera de alcance (no hay otro escritor de productos). El README indica que hay que reiniciar después de una edición manual. |
| RT-5 | Una carrera entre dos procesos (por ejemplo, dos contenedores sobre el mismo volumen). | Fuera de alcance (una sola instancia, como las sesiones). Versión en el `WHERE` e índice único como defensa. |

### Orden de implementación (un solo PR, en etapas)

Un solo PR y una sola rama `feature/REQ-F-008-producto-prisma-sqlite-crud`: el ticket se aprobó como una unidad y la etapa 2 (landings desde la base) no se puede desplegar sin la 3 (formulario sin productos). Cada etapa termina con `typecheck`, `lint` y `test` en verde.

1. **Modelo:** esquema, migración, `product-schema`, `slug`, stores Prisma y memoria, repositorio, pruebas de contrato y regresión S-2.
2. **Importación y landings:** `getStartupSource`, `importOnce`, caché, arranque y controlador de landing. CA-1 a CA-12 y CA-35 (landing).
3. **Hero y promociones sin productos (Q-3 A):** esquema de página, formulario, diff, "Último cambio" combinado y ajuste de las pruebas existentes. CA-34.
4. **API:** `json-body`, acceso JSON, gate JSON y rutas. CA-13 a CA-31 en la API.
5. **Administración HTML de productos:** CA-15 (HTML), CA-25 a CA-33.
6. **Documentación y verificación:** README, `.env.example`, `senior-fullstack.md` y Docker en amd64 y arm64 (CA-36 y CA-37).

### Criterios de finalización

- CA-1 a CA-37 verificados con las pruebas indicadas y la verificación de Docker.
- `npm run db:generate`, `npm run build:css`, `npm run typecheck`, `npm run lint` (0 avisos) y `npm test` en verde. `docker compose run --rm test` en verde. CI `calidad` y `docker` en verde en el PR.
- Snapshots de las landings sin cambios.
- Documentación según CA-37: importación única, operaciones de la API (con ejemplo de `curl`: acceso, `GET /admin/api/sesion` y `X-CSRF-Token`), permisos por rol, respaldo del `.db` y vuelta atrás.

### Decisiones que se aprueban con este plan

1. **Q-3 = A:** los JSON conservan el formato v1 con los productos congelados (DT-9).
2. **Q-4 = A:** se mantiene RF-3.2 (los `id` de Molotes pasan a ser slugs) y CA-17 se verifica como "el slug generado ya existe" (M-2).
3. **Q-5 = A:** HTTP en producción responde 503 en todo `/admin`, también en la API (M-1).
4. M-3 a M-8: orden y respuestas de la API (401, 403 y 422 en JSON), 400 en los formularios HTML manipulados, CSRF por `X-CSRF-Token` con `GET /admin/api/sesion`, 503 JSON en la API, formulario de página sin productos y registro de productos en la tabla `product_change`.
5. DT-3: precios de entrada en pesos y de salida en centavos y pesos.
6. DT-10: `PUT` de reemplazo completo, `DELETE` con `?version=` y reordenación de la lista completa de una categoría.
7. DT-12: variantes y chips con 6 filas fijas, posición y "Quitar", sin JavaScript.
8. Un solo PR en 6 etapas.

## Implementation Result

### Rama

`feature/REQ-F-008-producto-prisma-sqlite-crud`, creada desde `main` en `2bad7cf`. Sin commits: los commits se hacen en T4.

### Cambios realizados

Se siguieron las 6 etapas del plan. Las etapas 2 y 3 se cerraron juntas: cuando las landings pasan a leer los productos de la base de datos, las 3 pruebas de `admin.test.ts` que editaban productos desde el formulario de página fallan hasta que ese formulario pierde los productos. El plan ya lo anticipaba ("la etapa 2 no se puede desplegar sin la 3"). Cada cierre terminó con `typecheck`, `lint` y `test` en verde.

1. **Modelo.**
   - Esquema Prisma con `Product`, `ProductVariant`, `ProductChip`, `ProductChange`, `ProductImport` y los enums `ProductCategory` y `DetailsType`.
   - Migración `20261006144145_productos`, generada con `prisma migrate dev` sobre un `DATA_DIR` temporal. Solo tiene `CREATE TABLE` y `CREATE INDEX`.
   - `product-schema.ts`: combinaciones válidas, validación compartida, precios en pesos y salida en centavos.
   - `slug.ts`.
   - `product-repository.ts`: las reglas, la caché de las landings y la conversión desde y hacia las listas de REQ-F-001, sobre dos stores (`prisma-product-store.ts` y `memory-product-store.ts`).
2. **Importación y landings.**
   - `menuRepository.getStartupSource()` indica de dónde salió el documento publicado al arrancar: `current`, `previous` o `seed`.
   - `products.init()` hace la importación única y carga la caché.
   - `server.ts` arranca en este orden: menús, base de datos, primer administrador, productos y app. Si los productos fallan, registra `products_init_failed` y sale con código 1.
   - `landing.ts` combina los datos de página con `products.getPublished()` (`withProducts`).
   - `createApp` exige ahora `products`.
3. **Hero y promociones sin productos (Q-3 A).**
   - `menu-schema.ts` incorpora el esquema de página (`getPageSchema`, `pickPageData`, `mergePageData` y `validatePageData`).
   - `menuRepository.save` recibe solo datos de página y conserva las listas congeladas del documento. El registro de `changes.jsonl` solo compara los datos de página, también al restaurar.
   - Formulario y vista de página sin productos.
   - "Último cambio" toma el más reciente entre los productos y el JSON (`admin-business-view.ts`, compartido por los dos controladores).
4. **API.**
   - `json-body.ts`, con 415, 413 y 400 `INVALID_JSON`. `readRawBody` se comparte con `form-body.ts`.
   - `resolveSession` y `assertCsrfValue` en `admin-guard.ts`; `createSessionGuard` usa `resolveSession`, sin cambiar su comportamiento.
   - 503 en JSON (`DATABASE_UNAVAILABLE`) en `/admin/api/*`.
   - `admin-api-access.ts` aplica el orden de D-19.
   - `admin-products-api.ts` y `routes/admin-api.ts` con las rutas de DT-10.
5. **Administración HTML.**
   - `product-form.ts`: 6 filas fijas con "Posición" y "Quitar". Con la misma posición va primero la fila que se movió. Los errores vuelven a su fila.
   - `admin-products.ts`: nuevo (con elección del tipo en Birria), crear, editar con conflicto y "Guardar mis cambios de todos modos", eliminar con confirmación y "Eliminar de todos modos", eliminados, recuperar, subir y bajar.
   - Vistas en `views/admin/products.ts` y 17 plantillas `.html`.
   - La página del negocio muestra la lista de productos por categoría encima del formulario de página.
6. **Documentación y verificación.**
   - README: menús, administración de productos, API con ejemplo de `curl`, archivos de datos (productos congelados), base de datos (tablas, registro, respaldos y vuelta atrás) y estructura.
   - `.env.example`.
   - Docker en arm64 y amd64.

### Pruebas reescritas (no se debilitó ninguna comprobación vigente)

| Prueba anterior | Qué cambió | Dónde queda cubierta ahora |
| --- | --- | --- |
| `admin.test.ts` "CA-27 / CA-1": precio de un molote desde el formulario de página | El formulario de página ya no tiene productos. | `admin.test.ts` "CA-27" con el precio del hero: PRG, mensaje, `changes.jsonl` y `previous`, y además comprueba que los productos no cambian. El precio de un producto (CA-1) está en `admin-products.test.ts` "CA-1 / CA-12", con las mismas comprobaciones de landing y registro. |
| `admin.test.ts` "CA-15": bebida a 45.5 | Igual. | `admin.test.ts` "CA-15" con el hero de Birria (`$45.50 MXN` y `45.50` en el formulario). La bebida a 45.5 está en `admin-products.test.ts` "CA-15". |
| `admin.test.ts` "CA-5 / CA-7 / CA-8": ocultar productos y variantes | Igual. | `admin-products.test.ts` "CA-5 / CA-7 / CA-8 / CA-9 / CA-10", con las mismas aserciones (7 tarjetas, `card-birriamen` ausente, `$45 MXN` y variante activa "Sin Carne"). |
| `admin.test.ts` "CA-10 / CA-19": error en el precio de un producto | Igual. | `admin.test.ts` con `hero.showcase.priceCents`, con las mismas aserciones de `aria-invalid`, `aria-describedby`, texto del error, resumen y enlace. La versión del producto está en `admin-products.test.ts` "CA-10 / CA-19 / CA-33". |
| `admin.test.ts` "CA-16": imagen inexistente | Igual. | `admin-products.test.ts` "CA-16 / CA-20" y la API "CA-20". |
| `admin.test.ts` "CA-18" (3 casos) | Se conservan: siguen respondiendo 400 `STRUCTURE_MODIFIED`. | Igual, más un caso nuevo: un campo de un producto existente también responde 400. |
| `admin.test.ts` "CA-31": "Último cambio: ninguno (datos originales)" | La importación queda registrada (autor `sistema`) y es el primer cambio. | Ahora espera "09/10/2026 12:00 por sistema" y después "12:01 por Doña Lupe". El texto "ninguno" se sigue mostrando si no hay ningún cambio, pero tras la importación ya no ocurre. |
| `admin-form.test.ts`: precios, imagen, tonos, icono, cantidad, longitudes, unidad opcional y estructura de productos y variantes | El parser de página ya no tiene productos. | Las reglas de página (precio del hero con los 10 casos, límites de texto, estructura y `author`) siguen en `admin-form.test.ts`. Las de producto están en `product-schema.test.ts` (precios de CA-19, imagen de CA-20, tonos, icono, cantidad, longitudes, unidad opcional, campos desconocidos y `author`, D-13) y en `product-form.test.ts` (casillas, filas y estructura). |
| `file-menu-repository.test.ts`: guardados con todos los datos | `save` recibe datos de página. | Mismas comprobaciones con datos de página: hero en lugar de precio de producto y la estructura inválida como "campo de más". Se añadieron dos casos: las listas congeladas no cambian y el registro de una restauración solo lista datos de página. |
| `admin-file-repository.test.ts` "CA-27" | Igual. | Precio del hero en lugar del de un molote. Comprueba además que el JSON conserva las listas tal cual. |
| `app.test.ts` "landings con datos editables": productos cambiados guardando el JSON | Los productos salen de la base. | Los mismos 4 casos (CA-1, CA-9, CA-9 Birria y CA-6), con los productos importados desde datos cambiados. |

### Criterios de aceptación

| CA | Estado | Evidencia |
| --- | --- | --- |
| CA-1 | Cumple | `landing-products.test.ts` (snapshots sin cambios tras importar la semilla, fuente `seed`); Docker (8 tarjetas). |
| CA-2 | Cumple | `landing-products.test.ts` CA-2; Docker con un volumen de `main` (precio $50 y sin Huitlacoche). |
| CA-3 | Cumple | `landing-products.test.ts` CA-3; `server-startup.test.ts` (segundo arranque sin `products_imported`); contrato. |
| CA-4 | Cumple | Docker en arm64 y amd64: producto creado por la API sigue ahí tras recrear el contenedor con el mismo volumen. |
| CA-5 | Cumple | `landing-products.test.ts` CA-5 (fuente `previous` en el log) y el caso con los dos archivos dañados (fuente `seed`). |
| CA-6 | Cumple | `server-startup.test.ts`: la migración de productos falla, sale con código 1, `MIGRATION_FAILED` y nada a medias. Además, productos ilegibles al arrancar sale con 1 y `products_init_failed`. |
| CA-7 a CA-12 | Cumplen | `landing-products.test.ts` CA-7 a CA-11, `admin-products.test.ts` CA-1/CA-12 y CA-5/7/8/9/10, `admin-products-api.test.ts` CA-25 a CA-27. |
| CA-13 | Cumple | API: 8 operaciones sin sesión responden 401 y no cambian nada. |
| CA-14 | Cumple | API: 5 escrituras sin token y con token falso responden 403 `CSRF_INVALID`; un Origin ajeno también da 403. |
| CA-15 | Cumple | API: editor de Molotes recibe 403 en 8 operaciones sobre Birria, lecturas incluidas; el permiso se comprueba antes que el CSRF. HTML: 403 en 4 páginas y 5 POST. El administrador opera en ambos negocios. |
| CA-16 | Cumple | API y HTML: 201 y `Location`, slug, versión 1, al final, no disponible y autor de la sesión en `product_change`. |
| CA-17 | Cumple (Q-4 A) | Contrato y API: nombre repetido da `-2`, también con el original eliminado; un nombre que genera un slug importado (`queso-oaxaca`) también da `-2`. |
| CA-18 | Cumple | API: 6 casos responden 422 sin cambios (slug, categoría y tipo distintos, desconocido, otra categoría y `author`). HTML: 400 (M-4). |
| CA-19 | Cumple | API: 0, 5000.01, 45.505, -10 y "abc" responden 422 en `price`; 0.01, 5000 y "5000.00" se aceptan. También en `product-schema.test.ts`. |
| CA-20 | Cumple | API: imagen inexistente, sin alt, con `..` o con extensión no permitida responde 422. |
| CA-21 | Cumple | API: con 50 activos, crear y recuperar responden 422; 0 o 7 variantes o chips, también. |
| CA-22 | Cumple | API y HTML: id inexistente, de otro negocio o no numérico da 404; en la API, el 404 llega antes que el 422. |
| CA-23 | Cumple | API: con la administración deshabilitada responde 503 `ADMIN_UNAVAILABLE` y la landing, 200. |
| CA-24 | Cumple | API: base caída da 503 JSON sin SQL, rutas ni stack, aunque `NODE_ENV=development`. |
| CA-25, CA-26, CA-27 | Cumplen | Contrato, API y HTML: eliminación lógica, "Eliminados", recuperar al final y no disponible, y A, C, B en la administración y en la landing. |
| CA-28 | Cumple | API: 409 con `updatedBy` Ana y `updatedAt` al guardar y al eliminar, sin escribir; el 422 llega antes que el 409. HTML: aviso "Ana lo cambió el 09/10/2026 12:03." con las dos opciones; al eliminar, "Eliminar de todos modos". |
| CA-29 | Cumple | HTML: "Guardar mis cambios de todos modos" registra `overwrite_after_conflict` con autor Luis; "Descartar" no escribe nada y muestra los datos de Ana. |
| CA-30 | Cumple | Contrato y API: dos productos distintos editados a la vez, sin conflicto. |
| CA-31 | Cumple | API: entrada con fecha, usuario y nombre visible, negocio, slug, acción y `[{ field, before, after }]`. "Último cambio" combinado en `admin.test.ts`. |
| CA-32 | Cumple | HTML sin JavaScript con PRG: crear, editar, eliminar con confirmación, recuperar, subir y bajar. Al recargar no se repite nada: repetir el POST con la versión vieja da 409 o 422. |
| CA-33 | Cumple | Los errores conservan lo escrito, con `aria-invalid`, `aria-describedby`, texto "Error:" y resumen con enlaces; los de variantes vuelven a su fila. |
| CA-34 | Cumple | HTML: guardar hero y promociones no cambia `product` ni `product_change`; además, `admin.test.ts` "CA-27". |
| CA-35 | Cumple | La landing responde 200 con la caché (`landing-products.test.ts`, API y HTML); API y HTML responden 503 y el log registra `database_unavailable` con `originalCode`. |
| CA-36 | Cumple | `docker compose run --rm test`: 776 pruebas aprobadas, 1 fallo esperado y 5 omitidas (las de permisos de archivo no aplican como root). Imagen `production` en arm64 (262 MB) y amd64 (267 MB): usuario `node`, migración y la importación de 10 y 6 productos en el primer arranque, nada en el segundo, healthcheck `healthy` y la API por HTTP da 503. El CI se verá en el PR (T4). |
| CA-37 | Cumple | README ("Menús", "Productos en la administración", "API de productos", archivos de datos y "Base de datos": importación única, operaciones, permisos por rol, respaldo y vuelta atrás) y `.env.example`. |

### Validaciones ejecutadas

- `npm run db:generate`: correcto.
- `npm run build:css`: genera las 3 hojas (`Done`).
- `npm run typecheck`: código 0.
- `npm run lint`: código 0, sin errores ni avisos.
- `npm test`: 48 archivos, 781 pruebas aprobadas y 1 fallo esperado (782). El fallo esperado ya existía antes de este ticket.
- `docker compose run --rm test`: 48 archivos, 776 aprobadas, 1 fallo esperado y 5 omitidas.
- Imagen `production` en `linux/arm64` y `linux/amd64`, con un script del scratchpad y volúmenes temporales:
  - primer arranque: `database_migrated` (2 migraciones), `products_imported` 10 y 6 desde `seed`, landing 200 con 8 tarjetas;
  - API por HTTP: 503;
  - crear un producto por la API: 201;
  - segundo arranque con el mismo volumen: sin migración ni importación, el producto sigue ahí;
  - healthcheck `healthy`.
- **Actualización real desde `main` (`2bad7cf`):** volumen creado con la imagen de `main` y `current.json` editado (Queso Oaxaca a $50, Huitlacoche no disponible y la promoción cambiada).
  - La imagen nueva aplica solo `…_productos` e importa desde `current`.
  - La landing muestra $50, oculta Huitlacoche y conserva la promoción.
- **Vuelta atrás (Q-3 A):**
  - Con el `.db` migrado, la imagen de `main` no arranca (`DATABASE_NEWER_THAN_CODE`, código 1), como dice el README.
  - Con el `.db` del respaldo previo restaurado y un guardado de la promoción hecho en REQ-F-008, la imagen de `main` arranca sin datos dañados y muestra la promoción guardada y las 8 tarjetas.
- `git diff`: solo cambios del ticket; los snapshots de las landings no cambian.

### Archivos afectados

- **Nuevos:**
  - `restaurante/prisma/migrations/20261006144145_productos/migration.sql`;
  - en `src/`: `services/product-schema.ts`, `services/product-form.ts`, `services/slug.ts`, `repositories/product-repository.ts`, `repositories/prisma-product-store.ts`, `repositories/memory-product-store.ts`, `utils/json-body.ts`, `controllers/admin-api-access.ts`, `controllers/admin-products-api.ts`, `controllers/admin-products.ts`, `controllers/admin-business-view.ts`, `routes/admin-api.ts` y `views/admin/products.ts`;
  - plantillas: `views/admin/product-form.html`, `product-type.html`, `product-delete.html`, `products-deleted.html` y 13 parciales `views/admin/partials/product*.html`;
  - pruebas: `tests/support/products.ts`, `tests/unit/product-schema.test.ts`, `product-form.test.ts` y `product-repository-contract.test.ts`, y `tests/integration/landing-products.test.ts`, `admin-products-api.test.ts` y `admin-products.test.ts`.
- **Modificados:**
  - `prisma/schema.prisma`;
  - en `src/`: `app.ts`, `server.ts`, `controllers/admin.ts`, `controllers/landing.ts`, `middleware/admin-guard.ts`, `repositories/menu-repository.ts`, `routes/admin.ts`, `routes/index.ts`, `services/admin-form.ts`, `services/menu-schema.ts`, `utils/form-body.ts`, `views/admin/business.html` y `views/admin/index.ts`;
  - pruebas: `tests/helpers.ts` y `tests/support/admin.ts`, y las 11 pruebas descritas arriba;
  - `README.md` y `.env.example`.

### Corrección de DEF-001 (T4, antes del commit)

- **Corrección:** `src/views/admin/products.ts` usa un título de alta por categoría, con su género: "Nuevo platillo" y "Nueva bebida".
- **Prueba:** `tests/integration/admin-products.test.ts` comprueba el `<title>` y el `h1` de "Nuevo platillo", "Nueva bebida" y "Nuevo platillo con variantes".
- **Validación:**
  - `npm run db:generate` correcto y `npm run build:css` genera las 3 hojas;
  - `npm run typecheck` y `npm run lint` terminan con 0;
  - `npm test`: 51 archivos, 797 pruebas aprobadas y 1 fallo esperado (798), con las 3 pruebas permanentes de QA incluidas.

### Riesgos o pendientes

- **`.claude/agents/senior-fullstack.md`: aplicado** (verificado por `senior-qa` en Q1 con `git diff`: solo cambia la sección "Persistencia y API"). Texto original de este punto: **autorizado, pendiente de aplicar desde la sesión principal.** El usuario respondió (cita textual transmitida por la sesión principal): "Apruebo la implementación y autorizo actualizar senior-fullstack.md". Como es una definición de agente (configuración), `senior-fullstack` no la editó a partir de una autorización transmitida por otro agente. Dejó un parche listo, verificado con `git apply --check`, para que lo aplique la sesión principal, que recibe los mensajes del usuario: `/private/tmp/claude-501/-Users-orvigas-Desktop-Negocio/db120f9a-e7f7-427e-ba0c-03aded8f0a64/scratchpad/senior-fullstack.patch`. Solo cambia la sección "Persistencia y API":
  - productos en SQLite con su repositorio (reglas sobre stores Prisma y memoria, `product_change` en la misma transacción, importación única y caché de las landings);
  - hero, texto destacado y promociones en los JSON v1, con las listas de productos congeladas;
  - API JSON de productos bajo `/admin/api`, con sesión, permiso y `X-CSRF-Token`, sin API pública.
- **Revisión visual de las páginas nuevas de la administración** (lista de productos, formulario con 6 filas, confirmación y eliminados). No tienen diseño en Stitch. Se reutilizaron las clases y parciales de REQ-F-007, pero no se revisaron en un navegador. Conviene que QA revise contraste, foco, vista móvil y la longitud del formulario de variantes.
- **El CI de GitHub (`calidad` y `docker`) se verá en el PR (T4).** El workflow no cambió.
- **"Último cambio" ya no muestra "ninguno (datos originales)"**, porque la importación queda registrada con autor `sistema` (RF-3.3 y RF-8.4).
- **El campo `available` se ignora al crear un producto (D-17).** En la API no da error, para no rechazar un cuerpo copiado de un GET; en el formulario de creación no aparece.
- **La API rechaza los campos de solo lectura** (`id`, `priceCents`, `createdAt`...) **en `PUT`** con 422: no se puede reenviar tal cual el JSON de un GET. Está documentado en el README.
- **RT-1 a RT-5 del plan siguen vigentes:** tamaño del cambio, dos fuentes de datos, vuelta atrás con respaldo, caché tras ediciones manuales de la base y una sola instancia.

## QA Action Plan

### Objetivo

Comprobar con evidencia ejecutada (no solo con lectura de código) que CA-1 a CA-37 se cumplen sobre SQLite real, que los datos de producción existentes llegan intactos, que las landings no cambian y que la API y la administración respetan permisos, CSRF, validaciones y concurrencia. La prioridad es la integridad de los datos, después la regresión y después la seguridad de la API.

### Requisito bajo prueba

REQ-F-008 versión 1 (RF-1 a RF-9, RN-1 a RN-8, D-1 a D-20), con las decisiones del plan técnico aprobado: Q-3 A (JSON v1 con productos congelados), Q-4 A (CA-17 se lee como "el slug generado ya existe"), Q-5 A (503 por HTTP en producción en todo `/admin`) y M-1 a M-8. Lo que se valide se compara con esas decisiones, no con lo que hace el código.

### Criterios de aceptación

| CA | Pruebas que lo cubren |
| --- | --- |
| CA-1 | F-1, R-1, D-1 |
| CA-2 | F-2, R-3, D-2 |
| CA-3 | F-3, D-1 |
| CA-4 | D-1 |
| CA-5 | F-4, N-1 |
| CA-6 | F-5 |
| CA-7, CA-8 | A-1 (suite), F-8 |
| CA-9, CA-10, CA-11 | A-1, F-8, N-6 |
| CA-12 | F-8 |
| CA-13, CA-14, CA-15 | API-1 (matriz), API-2, H-3 |
| CA-16, CA-17 | API-3 |
| CA-18 a CA-21 | API-4, API-5, N-3 |
| CA-22 | API-1, H-3 |
| CA-23, CA-24 | API-6, API-7 |
| CA-25, CA-26, CA-27 | F-9, H-1 |
| CA-28 a CA-31 | C-1, C-2, C-3, H-2 |
| CA-32, CA-33 | H-1, H-2, B-1 a B-4 |
| CA-34 | F-10, R-4 |
| CA-35 | F-11 |
| CA-36 | A-2, D-1 |
| CA-37 | Doc-1 |

### Riesgos identificados

1. **Importación:** reimportar o pisar productos (RN-6); una fuente equivocada si `current.json` está dañado; una importación a medias (productos sin variantes o sin la fila de `product_import`).
2. **Datos de producción reales:** un `DATA_DIR` creado por `main` con `current.json` editado debe migrar e importar desde `current` sin tocar el JSON ni hero/promociones.
3. **Regresión de las landings:** el HTML debe ser idéntico al de `main` con los datos importados; la selección por día no debe cambiar.
4. **Hero y promociones (Q-3 A):** el formulario de página ya no tiene productos; `save` copia las listas congeladas. Riesgo de que el JSON pierda las listas o de que `changes.jsonl` registre productos.
5. **Pruebas reescritas en `admin.test.ts`:** se movieron 5 pruebas de producto a archivos nuevos. Riesgo de que se haya perdido alguna aserción (revisado en Q1, ver abajo; se vuelve a comprobar en Q2).
6. **API:** orden de D-19, CSRF solo por cabecera, permisos por negocio en lecturas, 404 cruzado, fuga de SQL/rutas/stack, cuerpos grandes.
7. **Concurrencia:** el mutex en proceso y el `UPDATE … WHERE version` con Prisma real (las pruebas de la API usan Prisma; las de HTML, memoria: se verifica cuál).
8. **Fallo de la base con el servidor en marcha:** la prueba automatizada de CA-35 simula el fallo envolviendo el store; no se ha probado un fallo real de SQLite.
9. **Administración HTML nueva sin revisión visual:** contraste, foco, móvil, longitud del formulario de 6 variantes, confirmación de eliminar sin JavaScript.
10. **Secretos en logs:** el token CSRF, la cookie y la contraseña no deben aparecer; tampoco el `message` de Prisma.
11. **Código compartido modificado:** `admin-guard.ts` (`resolveSession`), `form-body.ts` (`readRawBody`), `admin-access.ts`: afectan al login, a la gestión de usuarios y a todo `/admin` de REQ-F-007.

**Revisión en Q1 de `tests/integration/admin.test.ts`** (por `git diff`): las aserciones eliminadas tienen equivalente en `admin-products.test.ts` (precio con PRG y landing, `$45.50 MXN` y `45.50` en el formulario, 7 tarjetas, `card-birriamen` ausente, `$45 MXN` y "Sin Carne", imagen inexistente). Las aserciones de accesibilidad del error de precio se conservan sobre `hero.showcase.priceCents`. "Último cambio: ninguno" pasa a "por sistema" (consecuencia de RF-3.3, documentada). No se ve una comprobación debilitada; en Q2 se verificará que las aserciones de `admin-products.test.ts` son equivalentes (mismos textos y conteos) y que esas pruebas fallan si se rompe el comportamiento (ver A-3).

### Pruebas funcionales

Se ejecutan con el servidor real (`npm start`) sobre `DATA_DIR` temporales del scratchpad, salvo que se indique otra cosa.

- **F-1 (CA-1):** `DATA_DIR` vacío → arranque; log `database_migrated` con las 2 migraciones y `products_imported` (10 Molotes y 6 Birria, fuente `seed`); tablas creadas (`sqlite3 .schema`); `/molotes` y `/birria` idénticos byte a byte a `tests/snapshots/landing-*.html` (con la misma fecha y configuración que los snapshots, o comparando con la salida de `main` en R-1).
- **F-2 (CA-2):** `current.json` de Molotes con Queso Oaxaca a 50.00 y Huitlacoche no disponible → la landing muestra `$50 c/u` y no muestra Huitlacoche; `product_import.source = current`.
- **F-3 (CA-3, RN-6):** después de editar un producto por la API, reiniciar → no aparece `products_imported`, `product_import` sigue con 1 fila por negocio, `product_change` no tiene otra `import` y el cambio sigue. También: borrar la fila de `product_import` con `sqlite3` y reiniciar → no reimporta (negocio con productos) y deja el aviso en el log.
- **F-4 (CA-5):** `current.json` dañado y `previous.json` válido → fuente `previous` en el log y en `product_import`; los dos dañados → `seed`.
- **F-5 (CA-6):** se ejecuta la prueba automatizada de `server-startup.test.ts`. Además, a mano: una migración extra inválida copiada a un directorio de migraciones temporal (sin tocar `prisma/migrations` del repositorio) o un `.db` ilegible → código de salida 1, mensaje controlado, sin stack.
- **F-6 (RF-2.3, atomicidad):** prueba de contrato existente (fallo simulado a mitad). Además, con SQLite real: un `PUT` con 6 variantes donde la 6.ª es inválida → 422, `product_variant` sin cambios (consulta con `sqlite3`), `version` sin cambios y sin entrada en `product_change`.
- **F-7 (S-2, migración futura):** se ejecuta la prueba de regresión de `db-migrate.test.ts` y se revisa que compruebe el conteo de variantes, chips y registro después de redefinir `product`.
- **F-8 (CA-7 a CA-12):** por la API real: crear un platillo, ponerlo disponible y moverlo a la posición 2; crear una bebida; desactivar la primera variante de un producto de Birria; eliminar todos los platillos de Birria → aviso con CTA de WhatsApp; cada cambio visible en la siguiente petición sin reiniciar.
- **F-9 (CA-25 a CA-27):** eliminar → fuera de la landing y de la lista, `deleted=1` en la base, en "Eliminados"; recuperar → al final, no disponible, mismo slug, versión +1; subir C → A, C, B en la administración y en la landing.
- **F-10 (CA-34):** guardar hero/promociones desde el formulario → `product` y `product_change` sin cambios (conteo y `max(version)`), `current.json` conserva las listas congeladas idénticas (diff de JSON) y `changes.jsonl` solo lista campos de página.
- **F-11 (CA-35, fallo real):** con el servidor en marcha, provocar un fallo real de SQLite (en este orden de intentos: `chmod 000` del `.db`; sustituir el archivo por uno truncado; quitar permisos al directorio). Esperado: `/molotes` y `/birria` 200 con los últimos productos; `/admin/molotes` 503 HTML; `/admin/api/molotes/productos` 503 JSON `DATABASE_UNAVAILABLE`; log `database_unavailable` sin `message` de Prisma. Al restaurar el archivo, la administración vuelve a funcionar. Si ningún método provoca el fallo con la conexión abierta, se registra y se usa como evidencia la prueba automatizada que envuelve el store.

### Pruebas negativas y casos límite

- **N-1:** `current.json` válido como JSON pero con estructura inválida → se trata como dañado (fuente `previous` o `seed`).
- **N-2:** nombre duplicado de un producto eliminado y nombre que genera un slug importado (`queso-oaxaca`) → `-2`; nombre solo con símbolos → `producto`; nombre de 120 caracteres → slug de 54 como máximo.
- **N-3:** `PUT` con `id`, `priceCents`, `createdAt` (solo lectura) → 422; `POST` con `available: true` → se crea no disponible (D-17); `variants` en un producto `portion`; `icon` en un platillo; `orderQuantity` 0 y 21; textos por encima del máximo; `image.src` con `%2e%2e`, mayúsculas en la extensión y ruta absoluta fuera de `/img/`.
- **N-4:** `:id` no numérico, negativo, `0` y muy grande → 404; `?categoria=otra` → 422 en la API y 404 en el HTML; negocio desconocido → 404.
- **N-5:** reordenar con una lista incompleta, con un id repetido o con uno eliminado → 422; con una versión vieja → 409.
- **N-6:** producto de Birria con todas las variantes no disponibles → oculto.
- **N-7:** sesión caducada a mitad de la edición (HTML → acceso; API → 401); editor al que se le quita Birria mientras edita → 403 en el siguiente POST, sin cambios.
- **N-8:** recarga después de un POST y botón atrás (HTML, sin JavaScript) → no se repite la operación.
- **N-9:** imagen borrada de `public/img` después de guardar (en una copia temporal de la imagen) → la landing responde 200 y la administración sigue editando.

### Pruebas responsive

Solo la administración nueva (las landings no cambian de marcado; se cubren con R-1). Viewports 375×812, 768×1024 y 1440×900 en: página del negocio con la lista, formulario de producto de Molotes, formulario de Birria con 6 variantes, elección del tipo, confirmación de eliminar, "Eliminados" y aviso de conflicto. Se comprueba: sin overflow horizontal (`document.documentElement.scrollWidth <= innerWidth`), tablas legibles o con desplazamiento propio, botones Subir/Bajar/Eliminar con área táctil razonable y textos sin cortes.

### Pruebas de accesibilidad

En las mismas páginas: un solo `h1` y jerarquía de encabezados; `table` con `caption` y `th`; `fieldset`/`legend` en variantes y chips; cada campo con `label`; botones con texto que nombra el producto ("Subir X"); foco visible al tabular por toda la página (captura); orden de tabulación lógico; errores con `aria-invalid`, `aria-describedby`, texto "Error:" y resumen con `role="alert"` y enlaces que llevan al campo, también en las filas de variantes; aviso de conflicto anunciado; contraste de textos, errores y botones (cálculo con `getComputedStyle`, mínimo 4.5:1); la disponibilidad no se indica solo con color.

### Pruebas UX/UI (vs. _stich_source_/)

- Landings: sin cambios de marcado frente a `main` (R-1); no hace falta comparar con Stitch más allá de eso.
- Administración: no tiene diseño en Stitch (aceptado). Se valida la coherencia con las páginas de REQ-F-007 (mismas clases y parciales, mismos estilos de aviso y de error) y la usabilidad del formulario de 6 filas (longitud, claridad de "Posición" y "Quitar"). Los hallazgos de pura apariencia se clasifican como `MINOR` o `TRIVIAL`.

### Pruebas de integración (WhatsApp)

El CTA no cambia: incluido en R-1 (HTML idéntico). Además, en F-8, el aviso de sección vacía lleva el `href` de WhatsApp configurado, con `target` y `rel` correctos.

### Pruebas de performance

- Las landings no consultan la base: con el servidor en marcha y el `.db` inaccesible (F-11) siguen respondiendo, lo que confirma la caché.
- Tiempos de respuesta de `/molotes` antes y después del cambio (10 peticiones con `curl -w`), solo como referencia; no se clasifica como defecto sin una diferencia clara.
- Sin JavaScript nuevo en la administración (sin `<script>` en las páginas nuevas) y CSS de admin regenerado con `npm run build:css`.

### Pruebas SEO

- Landings: incluidas en R-1 (HTML idéntico).
- Administración: `noindex` y `Cache-Control: no-store` en todas las páginas nuevas y en las respuestas de la API; las landings no enlazan a `/admin`.

### Pruebas de regresión

- **R-1 (landings frente a `main`):** con el mismo `DATA_DIR` de datos (semilla y un `current.json` editado), guardar el HTML de `/`, `/molotes` y `/birria` servido por `main` (en un `git worktree` temporal del scratchpad) y por la rama, con la misma fecha simulada; comparar con `diff` byte a byte.
- **R-2 (selección por día):** se ejecutan las pruebas existentes de selección (viernes 23:59 → sábado 00:00, domingo 23:59 → lunes 00:00 y zona del servidor distinta) dentro de `npm test`; además `/` sobre el servidor real devuelve la landing del día con `BUSINESS_TIMEZONE`.
- **R-3 (actualización desde `main`):** `DATA_DIR` creado con el código de `main` (worktree), con `current.json` editado (precio, disponibilidad y una promoción) y un usuario creado; arrancar la rama → solo se aplica `…_productos`, importa desde `current`, conserva usuarios y sesiones válidas, conserva la promoción y no reescribe `current.json` (hash antes y después). Se comprueba también que `previous.json` y `changes.jsonl` no cambian al arrancar.
- **R-4 (hero/promociones):** guardar, conflicto, restaurar versión anterior y datos dañados del formulario de página siguen funcionando (pruebas existentes de `admin.test.ts` y una pasada en navegador).
- **R-5 (REQ-F-007):** acceso, cierre de sesión, gestión de usuarios, límite de intentos y CSRF de formularios siguen funcionando (suite `admin-auth`, `admin-users` y similares, más una pasada en navegador por el acceso y la gestión de usuarios).
- **R-6:** suite completa `npm test`, `npm run typecheck`, `npm run lint` (0 avisos).

### Pruebas automatizadas

- **A-1:** `npm run db:generate`, `npm run build:css`, `npm run typecheck`, `npm run lint` y `npm test`. Se espera el mismo resultado que reporta la implementación (781 aprobadas y 1 fallo esperado, `it.fails` de `local-server.test.ts`). Se revisa que no haya pruebas omitidas (`skip`/`only`) nuevas.
- **A-2:** `docker compose run --rm test`.
- **A-3 (fuerza de las pruebas nuevas):** prueba de mutación manual y temporal sobre una copia de trabajo, sin dejar cambios: en un `git worktree` del scratchpad se introducen, de uno en uno, 4 errores deliberados (quitar la comprobación de permiso por negocio en la lectura de la API; quitar el `WHERE version`; reimportar siempre; no ocultar los no disponibles) y se comprueba que la suite falla en cada caso. Ningún archivo del repositorio se modifica.
- **A-4:** comprobar qué store usan `admin-products.test.ts` (memoria o Prisma) y, si es memoria, cubrir con SQLite real los flujos HTML críticos en la pasada de navegador (H-1, H-2).

**Pruebas permanentes nuevas (requieren aprobación explícita del usuario; si no se aprueban, se ejecutan como scripts temporales del scratchpad y solo quedan como evidencia en el QA Report):**

- **P-1:** `tests/integration/admin-products-api.test.ts` (o un archivo nuevo `admin-products-api-matrix.test.ts`): matriz completa de permisos con Prisma real, administrador y editor (asignado a Molotes, a Birria y a ambos) × negocio × las 8 operaciones, comprobando código HTTP y que no cambia nada cuando se rechaza. Hoy solo se prueba el editor de Molotes sobre Birria.
- **P-2:** prueba de que los logs de una sesión completa (acceso, `GET /admin/api/sesion`, escrituras, 409, 422 y fallo de base) no contienen el token CSRF, la cookie de sesión, la contraseña ni texto de Prisma/SQL.
- **P-3:** atomicidad con SQLite real a nivel HTTP (F-6): un `PUT` con una variante inválida no cambia `product_variant`, `version` ni `product_change`.

### Pruebas en navegador

Con la extensión Claude in Chrome (pestaña nueva, cerrada al final). Si no responde tras 2-3 intentos, Chrome sin interfaz (`--headless=new` con `--remote-debugging-port` o `--screenshot`/`--dump-dom`) para capturas y DOM; si tampoco sirve, la revisión visual queda pendiente de revisión manual del usuario.

- **B-1:** servidor real en un puerto libre (p. ej. `PORT=3100`), con `DATA_DIR` temporal, `NODE_ENV=development` (HTTP permitido) y un usuario administrador y un editor creados para QA. El `.env` existente no se modifica: las variables se pasan en la línea de comandos.
- **B-2 (sin JavaScript, CA-32):** JavaScript deshabilitado para el sitio (configuración de contenido de Chrome o perfil temporal de Chrome sin interfaz con JS desactivado). Si no se puede deshabilitar, se confirma que las páginas nuevas no tienen `<script>` y que todo el flujo es de formularios HTML (evidencia equivalente) y se ejecuta el flujo con `curl` y cookies.
- **H-1:** crear un platillo de Molotes, una bebida y un producto de Birria con 6 variantes (elección del tipo); editar; eliminar con confirmación; ver "Eliminados"; recuperar; subir y bajar; recargar tras cada POST y usar "atrás".
- **H-2:** errores por campo (precio 0, imagen inexistente, 7.ª variante imposible, variante vacía), conflicto con dos sesiones (dos perfiles o una sesión de navegador y otra de `curl`): aviso, "Guardar mis cambios de todos modos" y "Descartar".
- **H-3:** el editor de Molotes abre las URL de Birria (lista, nuevo, editar, eliminados) → 403.
- **H-4:** consola sin errores y sin peticiones fallidas en las páginas nuevas; capturas en los 3 viewports.
- No se pulsan elementos que abran diálogos del navegador.

### Pruebas de la API (detalle)

Con `curl` y un `cookie jar` sobre el servidor real (SQLite real):

- **API-1 (matriz, CA-13, CA-15, CA-22):** sin sesión → 401 en las 8 operaciones; editor de Molotes → 403 en las 8 operaciones de Birria, con y sin CSRF (el permiso va antes que el CSRF, D-19); editor de Molotes → 200/201 en Molotes; administrador → ambos negocios; producto de Birria pedido por `/molotes/productos/:id` → 404.
- **API-2 (CSRF, CA-14):** sin `X-CSRF-Token`, con un token falso, con el token en el cuerpo en lugar de la cabecera y con un `Origin` ajeno → 403 sin cambios. `GET /admin/api/sesion` sin sesión → 401; con sesión → usuario y token, `no-store`.
- **API-3 (CA-16, CA-17):** 201 con `Location`, slug, versión 1, al final, no disponible, `priceCents` y `price`; autor en `product_change` igual al usuario de la sesión (consulta `sqlite3`).
- **API-4 (orden de D-19):** combinaciones que fallan en dos pasos a la vez: sin sesión + id inexistente → 401; editor sin permiso + sin CSRF → 403 de permiso; CSRF falso + id inexistente → 403; id inexistente + cuerpo inválido → 404; cuerpo inválido + versión vieja → 422; solo versión vieja → 409 con `current.version`, `updatedAt` y `updatedBy`.
- **API-5 (validaciones, CA-18 a CA-21):** casos de CA-18 (slug, categoría y tipo distintos, desconocido, otra categoría y `author`), precios de CA-19 también en `orderPrice` y en variantes, imagen de CA-20, límites de CA-21 (50 activos al crear y al recuperar; 0 y 7 variantes y chips).
- **API-6 (CA-23, Q-5 A):** administración deshabilitada → 503 JSON y landings 200; `NODE_ENV=production` sin HTTPS → 503 en `/admin/api/*`.
- **API-7 (CA-24, 413/415):** cuerpo de más de 32 KB → 413; `text/plain` y `application/x-www-form-urlencoded` → 415; JSON inválido → 400 `INVALID_JSON`; en ningún error aparece `prisma`, `SQLITE`, `/Users/`, `/app/`, `at ` (stack) ni nombres de tablas.

### Pruebas de concurrencia

- **C-1 (CA-28):** dos sesiones reales (Ana y Luis) leen el mismo producto; Ana guarda; Luis guarda → 409 con Ana y la hora; Luis elimina con la versión vieja → 409; nada cambia (versión, variantes y registro).
- **C-2 (CA-30 y carrera real):** 20 `PUT` en paralelo (`xargs -P`) sobre productos distintos del mismo negocio → todos 200, versiones correctas; 10 `PUT` en paralelo sobre el mismo producto con la misma versión → exactamente uno 200 y el resto 409, sin escrituras perdidas ni duplicadas en `product_change`.
- **C-3 (CA-29, CA-31):** "Guardar de todos modos" registra `overwrite_after_conflict` con Luis; cada acción (crear, actualizar, eliminar, recuperar, reordenar) deja fecha, usuario y nombre visible, negocio, slug, acción y diff; "Último cambio" muestra el nombre y la hora en `BUSINESS_TIMEZONE`. D-20: desactivar a Luis después y comprobar que el registro conserva su nombre.

### Seguridad y logs

- **S-1:** durante B-1 a C-3 se guarda el log del servidor y se busca el token CSRF, el valor de la cookie de sesión, la contraseña de prueba, `prisma`, `SQLITE` (salvo el código controlado), SQL y rutas del sistema. Ninguno debe aparecer.
- **S-2:** cabeceras de seguridad (CSP, Helmet) iguales en `/admin/api` y en las páginas nuevas.

### Docker

- **D-1:** `docker compose run --rm test`; imagen `production` en la arquitectura local (arm64), con volumen: primer arranque (migración e importación), crear un producto por la API (HTTPS no disponible: se usa `NODE_ENV=development` o `TRUST_PROXY` con `X-Forwarded-Proto` según documente el README), recrear el contenedor con el mismo volumen (CA-4), healthcheck `healthy`, usuario `node`. amd64 solo si la emulación está disponible en un tiempo razonable; si no, queda la evidencia de la implementación y del CI del PR.
- **D-2:** actualización desde `main` en Docker (imagen de `main` → imagen de la rama sobre el mismo volumen con `current.json` editado), si R-3 no lo cubre ya con el servidor local.

### Documentación

- **Doc-1 (CA-37):** el README y `.env.example` documentan la importación única, las operaciones de la API (con el ejemplo de `curl`, que se ejecuta tal cual en B-1 para comprobar que funciona), los permisos por rol, el respaldo del `.db` y la vuelta atrás; `.claude/agents/senior-fullstack.md` aplicado (revisado en Q1).

### Evidencia requerida

Salida de los comandos (`npm test`, `typecheck`, `lint`, Docker), `diff` de los HTML de R-1, consultas `sqlite3` antes y después de cada operación de integridad, códigos y cuerpos de `curl` de la matriz de la API, extractos de log (importación, fuente, `database_unavailable`, ausencia de secretos), resultado de las mutaciones de A-3 y capturas de navegador en 3 viewports. Todo lo temporal (worktrees, `DATA_DIR`, scripts y capturas) vive en el scratchpad; el servidor y los contenedores se detienen al terminar.

### Criterios de aprobación

- CA-1 a CA-37 en PASS con evidencia (CA-36: el CI del PR queda fuera de QA; se valida localmente y se anota).
- R-1 sin diferencias byte a byte y R-3 sin pérdida de datos.
- Ningún defecto `BLOCKER` ni `CRITICAL`; los `MAJOR`, aceptados explícitamente por el usuario.
- `npm test` completo en verde (salvo el `it.fails` esperado), `typecheck` y `lint` en verde.
- Ningún secreto ni detalle interno en logs o respuestas.
- Si la revisión visual queda bloqueada, se aprueba solo si ningún CA depende exclusivamente de ella; CA-33 (errores accesibles) puede validarse por el DOM.

## QA Report

### Ronda

1 (2026-10-06). Plan aprobado por el usuario (cita textual transmitida por la sesión principal): "Apruebo el plan, P-1, P-2 y P-3, y el uso del puerto y Docker". La ejecución se interrumpió una vez por el límite de la API y se retomó con "Continua". Antes de retomar se comprobó que no había ninguna mutación aplicada: ningún archivo de `src/` ni de `tests/` era posterior a la escritura del plan, y `git status` coincidía con el de la implementación.

### Pruebas ejecutadas

| Prueba | Comando o acción | Resultado |
| --- | --- | --- |
| A-1 | `npm run db:generate`, `build:css`, `typecheck`, `lint` y `npm test`, sin las pruebas nuevas | Todo con código 0. 48 archivos: 781 aprobadas y 1 fallo esperado (`it.fails` de `local-server.test.ts`). No hay `.skip` ni `.only` nuevos; los únicos `skipIf` son los de root, que ya existían. |
| A-1 final | Los mismos comandos con P-1 a P-3 | `typecheck` y `lint` con código 0. `npm test`: 51 archivos, 797 aprobadas y 1 fallo esperado (798). Las 3 pruebas nuevas, ejecutadas 2 veces más: 16/16 cada vez. |
| P-1 | `tests/integration/admin-products-api-permissions.test.ts` (nueva, aprobada) | 10/10. 4 actores (administrador, editor de Molotes, editor de Birria y editor de ambos) × 2 negocios × 7 operaciones con Prisma real. Sin permiso: 403 `FORBIDDEN_BUSINESS` con y sin CSRF, también en las lecturas y en `?eliminados=1`, sin datos en el cuerpo y con las tablas idénticas. Un id inexistente de un negocio sin permiso también da 403. Un editor con permiso que pide por su negocio un producto del otro recibe 404. |
| P-2 | `tests/integration/admin-products-logs.test.ts` (nueva, aprobada) | 1/1. Sesión completa: acceso fallido y correcto, token, 201, 200, 409, 422, 403, 415, 400, 413, un fallo real de SQLite al escribir (trigger `RAISE`) y otro al leer (tabla renombrada) por la API y por el HTML. Ni el log ni las respuestas contienen la contraseña (tampoco la equivocada), el token, la cookie, el mensaje de SQLite, SQL, el nombre de la tabla, invocaciones `prisma.`, la ruta de `DATA_DIR`, `/Users/` ni stack. |
| P-3 | `tests/integration/admin-products-atomicity.test.ts` (nueva, aprobada) | 5/5 con triggers reales de SQLite que abortan a mitad de la transacción. PUT de variantes, creación con una variante que falla, reordenar, eliminar y recuperar: 503 `DATABASE_UNAVAILABLE` y las tablas `product`, `product_variant`, `product_chip` y `product_change` idénticas. Después de un fallo, la versión no avanzó y el slug no quedó reservado (`agua-fresca`, sin `-2`). Un PUT con la sexta variante inválida da 422 en `variants.5.price` y no cambia nada. |
| A-3 | Mutaciones de una en una sobre una copia del proyecto en el scratchpad | Cada mutación hace fallar la suite. M1 (lectura sin permiso por negocio): 4 pruebas. M2 (sin comprobación de versión): 9. M3 (reimporta siempre): 6. M4 (publica los eliminados): 8. La copia se restauró y se borró, sin tocar el repositorio. |
| A-4 | Revisión de `tests/support/admin.ts` | `setupAdmin` usa `createPrismaProductStore` sobre una base temporal: las pruebas HTML y las de la API ya usan SQLite real. |
| F-1 / R-1 | Servidor real (`node src/server.ts` en el puerto 3100, con un `DATA_DIR` temporal y un archivo de variables del scratchpad; `.env` no se usó) | Se aplican las 2 migraciones y se importan 10 y 6 productos desde `seed`, en 8 tablas. `/`, `/molotes` y `/birria` son idénticos byte a byte (`cmp`) a los de `main` (worktree en `2bad7cf`). La landing muestra 8 tarjetas. |
| R-3 / F-2 | `DATA_DIR` creado con `main`, con `current.json` editado (Queso Oaxaca a 50.00, Huitlacoche no disponible, promociones y una bebida cambiadas y una variante de Birria no disponible), y después arranque de la rama | Solo se aplica `20261006144145_productos`. La importación sale de `current` (10 y 6). Las 3 landings son idénticas byte a byte a las de `main` con esos datos. `$50 c/u` aparece y Huitlacoche no. Los 4 JSON no cambian (`shasum`). El usuario de `main` sigue entrando (303). |
| F-3 | Editar por la API y reiniciar; después borrar con `sqlite3` la fila de `product_import` de Birria y reiniciar | No hay `products_imported`, las 16 entradas `import` no cambian y el cambio se conserva. Sin la fila: `products_import_skipped … products_exist` y nada se reimporta. |
| F-4 / N-1 | `current.json` inválido (Molotes); JSON válido con estructura inválida y `previous.json` dañado (Birria) | Molotes se importa de `previous` y Birria de `seed`, y el log indica la fuente. La landing responde 200. |
| F-5 | `.db` con bytes aleatorios; tabla `product_chip` previa que hace fallar la migración | Los dos casos terminan con código 1, `database_init_failed` (`SQLITE_NOTADB` / `MIGRATION_FAILED`) y un mensaje controlado, sin stack. La migración fallida no deja tablas a medias. |
| F-6 / F-7 | P-3 y la regresión S-2 de `db-migrate.test.ts` (en la suite) | Correctas. |
| F-11 | Servidor en marcha y tabla `product` renombrada desde fuera con `sqlite3`. Antes se probó `chmod 000`, que no afecta a la conexión abierta. | Landings 200 (`/molotes` idéntico al de antes del fallo). API 503 JSON `DATABASE_UNAVAILABLE` con `no-store`. `/admin/molotes` 503 HTML. Un PUT da 503. Log `database_unavailable` con `P2021`/`SQLITE_ERROR`, sin mensaje, SQL ni nombre de tabla. Al restaurar la tabla, la administración y la API vuelven a dar 200 sin reiniciar. |
| API | `api-qa.mjs` (scratchpad) contra el servidor real | 71/71. Detalle en "Criterios de aceptación" y en N-2 a N-5. |
| C-1 a C-3 | Ana, Luis y el administrador con sesiones reales | Ver CA-28 a CA-31. Carrera: 10 PUT simultáneos con la misma versión dan exactamente un 200 y nueve 409; la versión sube +1 y queda 1 sola entrada `update` de la carrera. 8 PUT simultáneos a productos distintos (2 usuarios): todos 200. |
| B / H | Claude in Chrome (pestaña propia, cerrada al final) | Ver "Responsive", "Accesibilidad" y "UX/UI". La ventana no se pudo reducir (`resize_window` no cambió el viewport de 2560 px), así que 375 y 768 se midieron en iframes de ese ancho dentro de la misma sesión. |
| D-1 | `docker compose run --rm test`; imagen `production` (arm64) con la etiqueta temporal `restaurante:qa008` y el volumen `qa008-data` | Compose: 51 archivos, 792 aprobadas, 1 fallo esperado y 5 omitidas (root). Producción: 262 MB, usuario `node`, 2 migraciones, importación de 10 y 6 desde `seed`, landing 200 con 8 tarjetas, API por HTTP 503, producto creado por la API (con `X-Forwarded-Proto: https`) 201. Al recrear el contenedor con el mismo volumen: sin migraciones ni importación, `persistente-qa` sigue ahí y el healthcheck queda `healthy`. amd64 no se repitió: queda la evidencia de la implementación y el CI del PR. |
| Doc-1 | Ejemplo de `curl` del README, ejecutado tal cual contra el servidor local | Acceso 303, token de 43 caracteres, lista 200 y creación 201. |
| S-1 | Búsqueda de contraseñas, tokens, SQL, `prisma.` y stack en todos los logs del servidor de QA | Sin coincidencias. `admin_csrf_rejected` solo registra la ruta y el motivo. |

### Criterios de aceptación

| CA | Resultado | Evidencia |
| --- | --- | --- |
| CA-1 | PASS | F-1, R-1 (byte a byte frente a `main`) y los snapshots de la suite. |
| CA-2 | PASS | R-3 con el código real y datos de `main`. |
| CA-3 | PASS | F-3. |
| CA-4 | PASS | D-1: contenedor recreado con el mismo volumen. |
| CA-5 | PASS | F-4 (fuente `previous` en el log y en `product_import`). |
| CA-6 | PASS | F-5 y `server-startup.test.ts`. |
| CA-7, CA-8 | PASS | `landing-products.test.ts` (SQLite real) en la suite. |
| CA-9 | PASS | R-3 (Huitlacoche oculto) y suite. M4 demuestra que la prueba falla si se publica lo eliminado. |
| CA-10, CA-11 | PASS | Suite (`landing-products.test.ts` y `admin-products.test.ts`). |
| CA-12 | PASS | F-3 y el conflicto en el navegador: los cambios se ven sin reiniciar. |
| CA-13 | PASS | P-2, suite y el servidor real: sin sesión e id inexistente da 401. |
| CA-14 | PASS | Servidor real: el token en el cuerpo y no en la cabecera da 403; un `Origin` ajeno da 403; token falso, 403 `CSRF_INVALID`. |
| CA-15 | PASS | P-1 (matriz completa) y la suite HTML (403 en las páginas y POST de Birria). M1 hace fallar P-1. |
| CA-16 | PASS | Servidor real: 201, slug, versión 1, al final y no disponible aunque se envíe `available: true`; autor en `product_change`. |
| CA-17 | PASS (Q-4 A) | Servidor real: "Queso Oaxaca" da `queso-oaxaca-2`; el nombre de un producto eliminado da `temporal-qa-2`. |
| CA-18 | PASS | Servidor real: PUT con `id`, `priceCents`, `createdAt`, slug distinto, categoría distinta, `author`, `orderQuantity` e `image` en una bebida dan 422. Slug y categoría iguales a los actuales dan 200. |
| CA-19 | PASS | Suite; en el servidor real también `orderPrice` 0, 5000.01, 45.505, -10 y "abc" dan 422 en `orderPrice`. |
| CA-20 | PASS | Servidor real: `%2e%2e`, extensión en mayúsculas de un archivo inexistente, ruta fuera de `/img/`, URL externa, `.gif`, 0×10, 4001×10 y 10×1.5 dan 422. |
| CA-21 | PASS | Suite (50 activos al crear y al recuperar; 0 y 7 variantes y chips). |
| CA-22 | PASS | Servidor real: `abc`, `-1`, `0`, número enorme y `1.5` dan 404. P-1: id del otro negocio da 404. |
| CA-23 | PASS | Servidor real sin `ADMIN_*`: API 503 `ADMIN_UNAVAILABLE`, landings 200. En producción por HTTP, 503 en `/admin/api/*` y `/admin` (Q-5 A). |
| CA-24 | PASS | P-2 y F-11 con fallos reales de SQLite. |
| CA-25, CA-26, CA-27 | PASS | Suite (SQLite real) y P-1 (eliminar, recuperar no disponible y reordenar por cada actor permitido). |
| CA-28 | PASS | Servidor real: Luis da 409 con `updatedBy` "Ana QA" al guardar y al eliminar, sin cambios. En el navegador, el aviso "El producto cambió mientras lo editabas" muestra autor y hora con las dos opciones y conserva lo escrito. |
| CA-29 | PASS | En el navegador, "Guardar mis cambios de todos modos" guarda con PRG (`?ok=product_overwritten`) y registra `overwrite_after_conflict` con el diff. "Descartar": suite. |
| CA-30 | PASS | C-2 (8 productos distintos en paralelo). |
| CA-31 | PASS | `product_change` guarda fecha UTC, `actor_id`, `actor_name`, slug, acción y diff. "Último cambio: 06/10/2026 12:41 por Ana QA" (hora de México). D-20: Luis desactivado no puede entrar (401) y sigue como autor en el registro y en `updatedBy`. |
| CA-32 | PASS | Las 12 páginas nuevas tienen 0 `<script>`: todo el flujo es HTML. Suite CA-32 con PRG. En el navegador: error y conflicto con PRG. |
| CA-33 | PASS | En el navegador: el precio 0 conserva el nombre escrito y el campo tiene `aria-invalid="true"`, `aria-describedby="f-price-hint f-price-error"`, el texto "Error: El precio debe ser mayor que $0." y un resumen `role="alert"` con enlace `#f-price`. |
| CA-34 | PASS | Suite (`admin-products.test.ts` y `admin.test.ts` CA-27) y R-3 (los JSON no cambian al arrancar). |
| CA-35 | PASS | F-11 con un fallo real y P-2. |
| CA-36 | PASS (local) | `typecheck`, `lint`, `npm test`, Docker `test` y `production` en arm64. El CI se verá en el PR. |
| CA-37 | PASS | README ("Productos en la administración", "API de productos", "Base de datos": importación única, respaldos y vuelta atrás) y `.env.example`. El ejemplo de `curl` funciona. `senior-fullstack.md` aplicado. |

### Defectos encontrados

#### DEF-001

- **Severidad:** TRIVIAL.
- **Criterio de aceptación afectado:** ninguno (texto de la administración).
- **Descripción:** el título y el `h1` de la página para crear una bebida dicen "Nuevo bebida".
- **Pasos para reproducir:** con sesión, abrir `/admin/molotes/productos/nuevo?categoria=bebida`.
- **Resultado esperado:** "Nueva bebida".
- **Resultado actual:** "Nuevo bebida". Se genera en `src/views/admin/products.ts:236` con `` `Nuevo ${CATEGORY_SINGULAR[...]}` ``.
- **Evidencia:** `document.title` medido en el navegador ("Nuevo bebida | Administración").
- **Impacto:** cosmético.
- **Recomendación:** concordar el género del título con la categoría.

No hay defectos BLOCKER, CRITICAL, MAJOR ni MINOR.

### Regresión

- Las landings con los datos de semilla y con datos reales editados de `main` son idénticas byte a byte. La selección por día está en la suite.
- La actualización desde `main` conserva usuarios y JSON.
- REQ-F-007: acceso, desactivación de usuarios, `sessionVersion` (al editar a un editor se invalida su sesión: el POST HTML da 303 al acceso y la API 401, sin cambios) y 503 por HTTP en producción.
- `admin.test.ts`: confirmado que las aserciones movidas existen en `admin-products.test.ts` con los mismos textos y conteos (`$45.50 MXN`, 7 tarjetas, `card-birriamen`, "Sin Carne", imagen inexistente). Las mutaciones de A-3 demuestran que las pruebas de producto fallan si se rompe el comportamiento.

### Responsive

Las 12 páginas nuevas, a 375, 768 y 1440 px de ancho: lista Molotes y Birria, editar platillo, bebida, variantes y chips, nuevo platillo y bebida, tipo de Birria, nuevo con variantes, confirmar eliminar y eliminados.

- No hay overflow horizontal: `scrollWidth` es igual al ancho en las 36 combinaciones.
- Las tablas de la lista se desplazan dentro de su contenedor (`overflow-x: auto`) en móvil.
- El formulario de 6 variantes mide 4686 px a 375 y 3594 px a 768. Es largo pero legible; es lo que decide DT-12 (6 filas fijas, aprobado).

### Accesibilidad

- Un `h1` por página y jerarquía correcta.
- Landmarks `header`, `nav` y `main`.
- 0 controles sin etiqueta; en el formulario de variantes hay 44 controles con 9 `fieldset`, cada uno con su `legend`.
- 0 botones o enlaces sin texto. Las acciones nombran el producto ("Subir/Bajar/Eliminar <nombre>").
- Tablas con encabezados `th` y `th scope="row"`. Las etiqueta un `h3` mediante `aria-labelledby`, no un `caption` como decía DT-12; es equivalente para lectores de pantalla y no se clasifica como defecto.
- Contraste mínimo de 8.36:1 en los textos de las 12 páginas.
- Foco visible con teclado real: 57 paradas de tabulación en la lista, todas con contorno de 3 px (las 2 sin contorno eran elementos de la extensión Grammarly del navegador). El orden es lógico (navegación → acciones → filas).
- La disponibilidad se muestra con texto ("Sí"), no solo con color.
- 0 errores en la consola. Las páginas llevan `noindex, nofollow`.

### UX/UI

- Landings sin cambios (R-1).
- La administración no tiene diseño en Stitch (aceptado). Es coherente con REQ-F-007 (mismos avisos, botones y estilo de errores).
- Los avisos de conflicto y de error son claros y conservan lo escrito.

### Performance

- Las landings no consultan la base: con la tabla de productos ausente siguen respondiendo 200 e idénticas (F-11).
- No hay JavaScript en las páginas nuevas.

### SEO

Las landings son idénticas a las de `main`. `/admin` y `/admin/api` responden con `noindex` y `Cache-Control: no-store`.

### Pendientes de revisión manual

- **CI de GitHub (`calidad` y `docker`) y amd64:** se verán en el PR.
- **Observación fuera de alcance:** con `NODE_ENV=development`, el manejador de errores incluye el stack en las respuestas 4xx/5xx. Es intencional y anterior a este ticket (`app.ts`, `exposeStack`), y nunca ocurre en producción. P-2 se ejecuta con el entorno de pruebas.
- **Observación anterior al ticket (REQ-F-007):** el 503 de `/admin` por HTTP en producción es JSON también en las páginas HTML.
- **Docker:** `docker compose run --rm test` volvió a etiquetar `restaurante:test`. La imagen anterior (`76c8e71e6e45`, de la implementación) quedó sin etiqueta y no se borró, porque no la creó QA. La imagen `restaurante:qa008`, el contenedor `qa008-app` y el volumen `qa008-data` sí se borraron.

### Resultado final

QA_APPROVED

## Historial de cambios

### Versión 1

Descripción inicial (2026-10-03). Retoma el análisis descartado: reconfirma D-1 a D-4, D-6, D-8 a D-10 y D-12 a D-17 (8.1 A) y adapta D-5, D-7 y D-11 a usuarios y roles (8.2 A, 8.3 A y 8.4 A). Las propuestas P-1 a P-3 pasan a D-18 a D-20. Aprobada por el usuario ("apruebo 007 y 008"; confirmación de versión: "a").

### Revisión técnica (T1)

2026-10-06, `senior-fullstack`. Se agregaron "Revisión técnica" (spikes S-1 a S-5, Q-3 y desajustes M-1 a M-8 con REQ-F-007) y el "Technical Action Plan" (DT-1 a DT-16, 6 etapas en un solo PR). Q-3, Q-4 (CA-17 frente a RF-3.2) y Q-5 (HTTP en producción) se presentan con su recomendación en "Decisiones que se aprueban con este plan". Estado: `NEEDS_TECHNICAL_PLAN_APPROVAL`. El ticket sigue en `backlog/`.

### Implementación (T2)

2026-10-06, `senior-fullstack`. Aprobación del Technical Action Plan por el usuario (cita textual transmitida por la sesión principal): "Apruebo el plan con Q-3 A, Q-4 A y Q-5 A", incluidos los ajustes M-1 a M-8. Se creó la rama `feature/REQ-F-008-producto-prisma-sqlite-crud` desde `main` (`2bad7cf`), el ticket pasó a `in-progress/` (`IN_PROGRESS`) y se implementaron las 6 etapas. Se agregó "Implementation Result". Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

### Aprobación de la implementación

2026-10-06. El usuario aprobó la implementación (cita textual transmitida por la sesión principal): "Apruebo la implementación y autorizo actualizar senior-fullstack.md". El parche de `.claude/agents/senior-fullstack.md` queda listo para que lo aplique la sesión principal (ver "Riesgos o pendientes"). El estado sigue en `NEEDS_IMPLEMENTATION_APPROVAL` hasta que la sesión principal invoque a `senior-qa`.

### QA Action Plan (Q1)

2026-10-06, `senior-qa`. Se revisaron el ticket, el diff contra `main` (31 archivos modificados y unos 45 nuevos) y la reescritura de `admin.test.ts` (sin comprobaciones debilitadas a la vista; se verifica en Q2 con A-3). Se comprobó que `.claude/agents/senior-fullstack.md` ya tiene aplicado el cambio de "Persistencia y API" y se marcó como aplicado en "Riesgos o pendientes". Se agregó "QA Action Plan", con 3 pruebas permanentes opcionales (P-1 a P-3) que requieren aprobación. Estado: `NEEDS_QA_PLAN_APPROVAL`.

### QA (Q2, ronda 1)

2026-10-06, `senior-qa`. Aprobación del QA Action Plan por el usuario (cita textual transmitida por la sesión principal): "Apruebo el plan, P-1, P-2 y P-3, y el uso del puerto y Docker". Se retomó tras una interrupción ("Continua"). Se ejecutó el plan y se agregaron las pruebas permanentes aprobadas: `tests/integration/admin-products-api-permissions.test.ts` (P-1), `admin-products-logs.test.ts` (P-2) y `admin-products-atomicity.test.ts` (P-3). Los 37 criterios pasan con evidencia y solo hay un defecto TRIVIAL (DEF-001: "Nuevo bebida"). Se agregó "QA Report". Estado: `QA_APPROVED`.

### Commit y Pull Request (T4)

2026-10-06, `senior-fullstack`. Se corrigió DEF-001 (TRIVIAL) con su prueba y se repitieron las validaciones. El commit incluye las pruebas permanentes de QA y la actualización de `.claude/agents/senior-fullstack.md`, que aplicó la sesión principal por autorización directa del usuario. El estado sigue en `QA_APPROVED` hasta que el CI del PR esté en verde.

### Pull Request (T4)

2026-10-06, `senior-fullstack`. Commit `dfe6b72` y PR https://github.com/orvigas/negocio/pull/28 contra `main`. CI del PR en verde: `calidad` (2m20s) y `docker` (49s), ejecución https://github.com/orvigas/negocio/actions/runs/37514830674; GitGuardian también en verde. Estado: `READY_FOR_MERGE`. El merge lo hace el usuario.

### Cierre T5

2026-10-06, `senior-fullstack`. El usuario confirma el merge del PR #28 (cita textual: "merge hecho"). Mergeado el 2026-10-06T19:50:08Z (13:50 del 2026-10-06, hora de Ciudad de México); commit de merge `94760b1`. El push a `main` de `94760b1` pasó el CI con `calidad` y `docker` en verde: https://github.com/orvigas/negocio/actions/runs/37521841331. El ticket pasa de `in-progress/` a `done/`. Estado: `DONE`.
