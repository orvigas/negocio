# REQ-F-001 — Menús, precios y promociones configurables con página de administración

## Estado

READY_FOR_MERGE

Pull Request: https://github.com/orvigas/negocio/pull/2 (commit `ebfdf25`).

## Aprobación

Aprobado por el usuario (versión 1, fecha 2026-10-02). Cita textual: "ok, apruebo  el requisito".

La aprobación incluye en conjunto:

- las decisiones C-1 a C-15;
- las propuestas P-1 a P-9, que pasan a ser requisitos aprobados;
- que el `slug`, el tipo de detalle y la cantidad y el orden de productos, chips y variantes no son editables;
- que en Birria los platillos con variantes toman el precio y la descripción de la variante activa.

## Objetivo

El dueño del negocio podrá actualizar desde una página web protegida los productos del menú, sus precios, su disponibilidad, los precios del hero y los textos promocionales de cada landing (Moloteando y Birriería El Muñeco), sin cambiar código ni reiniciar el servidor. Los datos se guardan en archivos JSON a través de una capa de repositorio. Esa capa permite migrar más adelante a una base de datos sin tocar las páginas ni los controladores.

## Decisiones confirmadas por el usuario

| #    | Decisión                                                                                                                                         |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| C-1  | Formato **JSON**.                                                                                                                                |
| C-2  | La app corre en una **VM con disco persistente**. El JSON editable vive en una **ruta configurable fuera del código** y hay una **semilla versionada** en el repo. |
| C-3  | Desde la página se editan **todos los campos de cada producto**. **No** se agregan, eliminan ni reordenan productos.                              |
| C-4  | Imágenes: **solo se edita su metadata**. No se suben archivos.                                                                                   |
| C-5  | Los precios del hero se editan **por separado**, sin depender de ningún producto del menú.                                                       |
| C-6  | Un producto no disponible **se oculta**. Aplica también a **variantes y bebidas**.                                                               |
| C-7  | **Un usuario y contraseña comunes** para ambos negocios, definidos por variables de entorno.                                                     |
| C-8  | Interfaz de administración **sencilla**. No hay diseño en `_stich_source_/` y se acepta esa desviación de CLAUDE.md §3.                           |
| C-9  | Rutas `/admin/molotes` y `/admin/birria`.                                                                                                        |
| C-10 | Si hay ediciones simultáneas: **se avisa** y **se reintenta solo si el usuario lo acepta**.                                                      |
| C-11 | Se **guarda la versión anterior** y se **registra quién y cuándo** hizo cada cambio.                                                             |
| C-12 | Precios: **se permiten centavos (máximo 2 decimales)**, deben ser **mayores que $0** y **no pueden pasar de $5,000.00 MXN**.                     |
| C-13 | Archivo dañado: **se informa al usuario y se le dan opciones** (ver RF-8).                                                                       |
| C-14 | "8 Sabores de Barrio" y las promociones 2x1 se vuelven **editables**.                                                                            |
| C-15 | Sincronizar la disponibilidad con el bot de WhatsApp queda **fuera de alcance**.                                                                 |

## Alcance

- **Molotes:**
  - los 8 productos del menú y las 2 bebidas;
  - el texto destacado del menú ("8 Sabores de Barrio...");
  - el showcase del hero: etiqueta, título, descripción, precio y unidad;
  - la promoción "Jueves de Molotes 2x1": badge, título y descripción.
- **Birria:**
  - los 6 productos del menú, con sus chips, porción y variantes;
  - el showcase del hero: título, descripción y precio;
  - la promoción del Club: badge, título y descripción.
- Un archivo JSON editable por negocio, una semilla versionada, una copia de la versión anterior y un registro de cambios.
- Página de acceso, página de configuración por negocio, cierre de sesión, guardado, restauración y aviso de conflicto.
- Capa de repositorio con una implementación sobre archivos.
- Documentación (README y `.env.example`) y pruebas.

## Fuera de alcance

- Base de datos. Solo se deja preparada la abstracción.
- Agregar, eliminar o reordenar productos, variantes o chips.
- Subir, recortar u optimizar imágenes.
- Editar textos que no sean del menú, del hero o de las promociones: navegación, ritual, horarios, footer, contacto, SEO y etiquetas de formularios.
- Sincronizar con el bot de WhatsApp, Uber Eats o Rappi.
- Varios usuarios, roles o recuperación de contraseña.
- Una pantalla para consultar el historial de cambios. Los cambios se registran en archivo, pero no se muestran en pantalla.
- Diseño en `_stich_source_/` para la página de administración.

## Requisitos

### RF-1 Fuente de datos JSON por negocio

1. Cada negocio tiene un archivo JSON con todos los datos editables del Alcance. Los precios se guardan como enteros en centavos.
2. Las landings obtienen esos datos **solo** a través del repositorio (RF-9). Los módulos `menu.js` y los precios en texto del hero dejan de ser la fuente de verdad.
3. La carpeta de los archivos editables se configura con una variable de entorno. Tiene un valor por defecto para desarrollo y queda fuera de `src/`.
4. El repo incluye una **semilla** por negocio con los datos actuales, que coinciden con el diseño fuente.
5. Si el archivo editable **no existe** al arrancar (primera ejecución), se crea copiando la semilla y se registra en el log. Este caso no se trata como archivo dañado.

### RF-2 Campos editables

Se pueden editar todos los campos de cada producto, pero no su estructura.

- **Molotes, producto:**
  - nombre, descripción y badge;
  - tono, elegido de una lista cerrada: `secondary`, `primary`, `tertiary`, `sky`, `amber`, `red`, `gold`;
  - precio unitario, precio por orden y cantidad por orden;
  - disponible (sí/no);
  - imagen: ruta, alt, ancho y alto.
- **Molotes, bebida:**
  - nombre, descripción, icono y precio;
  - tono: `amber` o `red`;
  - disponible.
- **Birria, producto:**
  - nombre, etiqueta (tag), descripción y precio;
  - unidad de precio (opcional, p. ej. "c/u");
  - disponible;
  - imagen: ruta, alt, ancho y alto;
  - título del bloque de detalle.
  - Según el tipo de detalle:
    - chips: el texto de cada chip y si va resaltado;
    - porción: porción y extra;
    - variantes: la etiqueta, el precio, la descripción y la disponibilidad de cada variante.
- **No editables (estructura):**
  - el identificador del producto (`slug` en Birria);
  - el tipo de detalle (`chips`, `portion`, `variants`);
  - la cantidad y el orden de productos, chips y variantes.
- **Productos de Birria con variantes:** el precio y la descripción que muestra la tarjeta son los de la variante activa. Estos productos no tienen precio ni descripción propios.
- **Hero:**
  - Molotes: etiqueta, título, descripción, precio y texto de unidad (p. ej. "/ orden de 3");
  - Birria: título, descripción y precio.
- **Textos:** el texto destacado del menú de Molotes y, en cada negocio, el badge, el título y la descripción de la promoción.

### RF-3 Reglas de validación

Si un campo no es válido, no se guarda nada.

- **Precios** (unitario, por orden, bebidas, productos, variantes y hero):
  - número con **hasta 2 decimales**;
  - **mayor que $0.00** y **menor o igual que $5,000.00**;
  - se capturan en pesos y se guardan en centavos.
- **Textos obligatorios:** no pueden quedar vacíos después de quitar espacios. Longitudes máximas (P-1, aprobada):

  | Campo                                                  | Máximo |
  | ------------------------------------------------------ | ------ |
  | Nombre                                                 | 80     |
  | Badge, tag, chip, etiqueta de variante                 | 40     |
  | Descripción de producto, bebida o variante             | 400    |
  | Texto de unidad, porción, extra, título del detalle    | 40     |
  | Alt de imagen                                          | 150    |
  | Etiqueta, título y descripción del hero                | 40 / 120 / 400 |
  | Texto destacado del menú, badge y título de promoción  | 120    |
  | Descripción de promoción                               | 400    |
  | Nombre de quien hace el cambio                         | 60     |

- **Cantidad por orden:** entero de 1 a 20.
- **Imagen:**
  - la ruta empieza con `/img/`, termina en `.jpg`, `.jpeg`, `.png` o `.webp` y no contiene `..`;
  - la ruta **corresponde a un archivo que existe** en `public/img/`;
  - el alt es obligatorio, porque las fotos de producto no son decorativas;
  - ancho y alto son enteros de 1 a 4000.
- **Icono de bebida:** solo minúsculas, dígitos y `_` (nombre de Material Symbols).
- **Tono:** solo valores de la lista cerrada.
- Se rechazan campos desconocidos, cambios de estructura (RF-2) y cuerpos de petición demasiado grandes.
- Los errores se muestran junto a cada campo, con texto (no solo color), se anuncian de forma accesible y el formulario conserva lo que el usuario escribió.

### RF-4 Disponibilidad (se oculta)

1. Un producto o bebida no disponible **no aparece** en la landing.
2. Una variante no disponible **no aparece** entre las opciones.
3. La variante activa al cargar es la **primera variante disponible**. Su precio y su descripción son los que muestra la tarjeta.
4. Si un producto tiene **todas** sus variantes no disponibles, el producto se oculta.
5. Si **todos** los productos de una sección quedan ocultos, la sección conserva su encabezado y en lugar de la lista muestra el aviso "Por ahora no tenemos productos disponibles en esta sección. Escríbenos por WhatsApp." junto con el CTA de WhatsApp existente (P-2, aprobada).
6. La disponibilidad no afecta al bot de WhatsApp (C-15).

### RF-5 Acceso protegido

1. `/admin/molotes`, `/admin/birria` y todas sus acciones requieren una sesión iniciada con el usuario y la contraseña comunes definidos en variables de entorno.
2. Sin sesión, se redirige a la página de acceso.
3. Hay un botón para cerrar sesión.
4. La sesión caduca tras **2 horas de inactividad** (P-3, aprobada). Si caduca a mitad de una edición, al guardar se pide acceso de nuevo y no se escribe nada.
5. Tras **5 intentos fallidos** de acceso, se bloquea el acceso desde ese origen durante **15 minutos** (P-3, aprobada). El mensaje de error de acceso es genérico.
6. Las credenciales nunca aparecen en el código, en los logs ni en las respuestas.
7. Si las credenciales no están configuradas, la administración queda **deshabilitada**: responde "no disponible" y el log indica el motivo. Las landings siguen funcionando.
8. Toda acción que escribe exige protección CSRF y solo acepta POST.
9. Las páginas de administración llevan `noindex`, no se cachean y no tienen enlaces desde las landings.
10. La administración funciona con formularios HTML nativos, sin depender de JavaScript (P-8, aprobada).
11. Después de guardar se usa POST-redirect-GET, de modo que recargar no reenvía el formulario.

### RF-6 Guardado, versión anterior y registro

1. Al guardar datos válidos de un negocio:
   - el contenido actual pasa a ser la **versión anterior** (se conserva una por negocio);
   - el contenido nuevo se escribe de forma **atómica**, de modo que el archivo nunca queda escrito a medias;
   - se añade una entrada al **registro de cambios**;
   - la landing muestra los datos nuevos **en la siguiente petición**, sin reiniciar.
2. **Autor:** como la cuenta es común, cada guardado o restauración exige el campo "Nombre de quien hace el cambio" (P-4, aprobada).
3. Cada entrada del registro guarda:
   - fecha y hora (ISO, zona horaria del negocio);
   - nombre de quien hizo el cambio;
   - negocio;
   - acción: guardar, restaurar versión anterior, restaurar semilla o sobrescribir tras conflicto;
   - campos modificados, con su valor anterior y el nuevo.
4. El registro se guarda en un archivo. La página solo muestra "Último cambio: <fecha> por <nombre>" (P-7, aprobada).
5. El botón **"Restaurar versión anterior"** está siempre disponible (P-5, aprobada). Pide confirmación, intercambia la versión actual con la anterior y queda en el registro.

### RF-7 Edición simultánea

1. Cada guardado indica con qué versión de los datos empezó a editar el usuario.
2. Si mientras tanto se guardó otra versión, **no se guarda nada**. El usuario ve un aviso de que el menú cambió, con quién y cuándo, y dos opciones:
   - **"Guardar mis cambios de todos modos"**: se reintenta y se sobrescribe la versión más reciente, que pasa a ser la versión anterior. Queda en el registro como sobrescritura tras conflicto.
   - **"Descartar y cargar la versión actual"**: no se escribe nada y se muestran los datos vigentes.
3. Nunca se reintenta sin la aceptación explícita del usuario.

### RF-8 Archivo dañado (JSON inválido o que no cumple el esquema) — P-9, aprobada

1. **El servidor arranca igual.** Las landings públicas usan la **versión anterior** si es válida y, si no lo es, la **semilla**. El log registra el error sin exponer detalles al visitante.
2. El archivo dañado **se conserva** con otro nombre, con marca de fecha, para poder revisarlo.
3. La página de administración de ese negocio muestra el aviso "Los datos guardados están dañados; la landing está mostrando <versión anterior | semilla>" y ofrece estas opciones:
   - **Restaurar la versión anterior**, solo si es válida;
   - **Restaurar la semilla original** del repositorio.
4. Mientras el usuario no elija, la edición de ese negocio está bloqueada. La elección queda en el registro y desbloquea la edición.
5. Si el archivo se daña con el servidor en marcha, las landings siguen mostrando la última versión válida en memoria y la administración muestra el mismo aviso.
6. Las ediciones manuales del archivo JSON se aplican al reiniciar el servidor (P-6, aprobada). La vía recomendada para editar es la página de administración.

### RF-9 Capa de repositorio

- Controladores y vistas solo usan un contrato de repositorio. A nivel conceptual ofrece estas operaciones:
  - obtener los datos de un negocio junto con su versión;
  - guardar con la versión esperada y el autor;
  - restaurar la versión anterior;
  - restaurar la semilla;
  - obtener el último cambio.
- La implementación inicial trabaja sobre archivos. Para pasar a una base de datos basta con cambiar la implementación que se inyecta al crear la app.

### RF-10 Errores y seguridad

- Los errores de la administración siguen el formato centralizado del proyecto. No exponen rutas de archivos, stack traces ni el contenido del JSON.
- El log registra sin contraseñas estos eventos: acceso fallido, guardado, conflicto, restauración y archivo dañado.

## Historias de usuario

- **HU-1:** Como dueño quiero cambiar precios desde una página web para que la landing muestre el precio correcto sin pedir cambios de código.
- **HU-2:** Como dueño quiero ocultar un producto, una variante o una bebida que no hay para que los clientes no lo pidan.
- **HU-3:** Como dueño quiero editar nombres, descripciones, etiquetas, datos de imagen, el precio del hero y las promociones para mantener la landing al día.
- **HU-4:** Como dueño quiero que solo quien tenga la contraseña pueda cambiar datos para evitar alteraciones.
- **HU-5:** Como dueño quiero saber quién cambió qué y cuándo, y poder volver a la versión anterior, para corregir errores.
- **HU-6:** Como dueño quiero que me avisen si alguien guardó mientras yo editaba para no borrar su trabajo sin darme cuenta.
- **HU-7:** Como dueño quiero que, si el archivo se daña, la landing siga funcionando y se me den opciones para recuperarla.
- **HU-8:** Como cliente quiero ver precios y productos disponibles y actualizados para pedir por WhatsApp sin sorpresas.

## Reglas de negocio

- **RN-1:** Un precio es válido si es mayor que $0.00, menor o igual que $5,000.00 y tiene como máximo 2 decimales. Aplica a todos los precios editables.
- **RN-2:** El formato de precio en la landing no cambia ("$45", "$45.50", "$1,500"), con los sufijos actuales ("c/u", "MXN", "orden de N").
- **RN-3:** Lo no disponible se oculta. Un producto sin variantes disponibles se oculta. La variante activa es la primera disponible.
- **RN-4:** La estructura no se modifica: cantidad, orden, identificadores y tipo de detalle se mantienen.
- **RN-5:** Se guarda una versión anterior por negocio y cada escritura queda en el registro con autor y fecha.
- **RN-6:** Nunca se sobrescribe un cambio ajeno sin la aceptación explícita del usuario.
- **RN-7:** Las landings públicas nunca muestran un error por datos dañados. Usan la última fuente válida.
- **RN-8:** Un único juego de credenciales da acceso a ambos negocios.

## Criterios de aceptación

### Lectura y visualización

- **CA-1:** Given el precio unitario de "Molotes de Queso Oaxaca" en 50.00 en el JSON, When se carga `/molotes`, Then la tarjeta muestra "$50 c/u".
- **CA-2:** Given el precio del hero de Birria en 199.50, When se carga `/birria`, Then el showcase muestra "$199.50 MXN".
- **CA-3:** Given el texto destacado y la promoción de Molotes editados, When se carga `/molotes`, Then se ven los textos nuevos.
- **CA-4:** Given una instalación nueva sin archivo editable, When arranca el servidor, Then el archivo se crea a partir de la semilla y las landings se ven igual que antes de este cambio.

### Disponibilidad

- **CA-5:** Given "Molotes de Huitlacoche con Epazote" no disponible, When se carga `/molotes`, Then no aparece en el HTML y los demás productos mantienen su orden.
- **CA-6:** Given la bebida "Refrescos Familia Coca-Cola" no disponible, When se carga `/molotes`, Then no aparece en la sección de bebidas.
- **CA-7:** Given la variante "Con Carne" del "Tazón de Consomé Chico" no disponible, When se carga `/birria`, Then solo aparece "Sin Carne", está activa, y la tarjeta muestra "$45 MXN" y su descripción.
- **CA-8:** Given todas las variantes de "Birriamen Artesanal" no disponibles, When se carga `/birria`, Then el producto no aparece.
- **CA-9:** Given todos los productos de una sección no disponibles, When se carga la landing, Then la sección conserva su encabezado y muestra el aviso de RF-4.5 con el CTA de WhatsApp.

### Validación de precios (RN-1)

- **CA-10:** When se guarda un precio de 0 o 0.00, Then se rechaza con un mensaje junto al campo que indica que el precio debe ser mayor que $0, y el archivo no cambia.
- **CA-11:** When se guarda un precio de 0.01, Then se acepta.
- **CA-12:** When se guarda 5000 o 5000.00, Then se acepta. When se guarda 5000.01, Then se rechaza indicando que el máximo es $5,000.00.
- **CA-13:** When se guarda 45.505, -10, "abc" o un precio vacío, Then se rechaza con un mensaje junto al campo y el archivo no cambia.
- **CA-14:** CA-10 a CA-13 se cumplen en todos los precios de ambos negocios: unitario, por orden, bebidas, productos de Birria, variantes y hero.
- **CA-15:** Given un precio guardado de 45.5, When se carga la landing, Then muestra "$45.50".

### Otras validaciones

- **CA-16:** Given una ruta de imagen que no existe, que no empieza con `/img/`, que contiene `..` o que tiene otra extensión, When se guarda, Then se rechaza.
- **CA-17:** Given cualquiera de estos valores, When se guarda, Then se rechaza:
  - un alt vacío;
  - un ancho o alto que no sea entero o que esté fuera de 1 a 4000;
  - un tono fuera de la lista;
  - un icono con caracteres no permitidos;
  - una cantidad por orden fuera de 1 a 20;
  - un texto que supere su longitud máxima (P-1).
- **CA-18:** Given una petición que intenta cambiar el `slug`, el tipo de detalle, o la cantidad o el orden de productos, chips o variantes, o que trae campos desconocidos, When se procesa, Then se rechaza y el archivo no cambia.
- **CA-19:** Given un error de validación, When se vuelve a mostrar el formulario, Then conserva los valores escritos y los errores no dependen solo del color.

### Acceso y seguridad

- **CA-20:** Given que no hay sesión, When se abre `/admin/molotes` o `/admin/birria` o se envía un guardado, Then se redirige a la página de acceso o se rechaza la petición, y el archivo no cambia.
- **CA-21:** Given credenciales incorrectas, When se intenta entrar, Then se muestra un error genérico. Given 5 intentos fallidos, When se intenta otra vez dentro de los 15 minutos siguientes, Then el intento se bloquea.
- **CA-22:** Given las credenciales correctas, When se entra, Then se pueden editar ambos negocios. When se cierra sesión, Then las rutas de administración vuelven a pedir acceso. Given 2 horas sin actividad, When se intenta guardar, Then se pide acceso de nuevo y no se escribe nada.
- **CA-23:** Given un guardado sin token CSRF válido, When se procesa, Then se rechaza.
- **CA-24:** Given que no están configuradas las variables de credenciales, When arranca el servidor, Then las landings funcionan y la administración responde "no disponible".
- **CA-25:** Las respuestas de administración incluyen `noindex` y no se cachean. Las landings no tienen enlaces a `/admin`.
- **CA-26:** Ningún escenario deja la contraseña en los logs.

### Guardado, versión anterior y registro

- **CA-27:** Given un guardado válido, When termina, Then:
  - el archivo tiene los datos nuevos;
  - la versión anterior tiene los datos previos;
  - el registro tiene una entrada con fecha, autor, negocio, acción y campos modificados (antes y después);
  - la landing muestra los datos nuevos sin reiniciar el servidor.
- **CA-28:** Given el campo "Nombre de quien hace el cambio" vacío, When se guarda o se restaura, Then se rechaza.
- **CA-29:** Given un fallo simulado durante la escritura, When se lee el archivo, Then contiene la versión previa completa y válida.
- **CA-30:** Given que se confirma "Restaurar versión anterior", When termina, Then la landing muestra la versión anterior, la versión que estaba activa pasa a ser la anterior y la acción queda en el registro.
- **CA-31:** Given la página de administración de un negocio, When se carga, Then muestra "Último cambio: <fecha> por <nombre>".

### Edición simultánea

- **CA-32:** Given que A y B abren `/admin/birria` y A guarda primero, When B guarda, Then no se guarda nada y B ve un aviso con quién y cuándo cambió el menú, y las opciones "Guardar mis cambios de todos modos" y "Descartar y cargar la versión actual".
- **CA-33:** When B elige "Guardar mis cambios de todos modos", Then se guardan los datos de B, la versión de A queda como versión anterior y el registro marca la acción como sobrescritura tras conflicto. When B elige "Descartar", Then se muestran los datos de A y no se escribe nada.

### Archivo dañado

- **CA-34:** Given el JSON de Molotes con sintaxis inválida al arrancar y una versión anterior válida, When arranca el servidor, Then arranca, `/molotes` responde 200 con la versión anterior y el archivo dañado se conserva con otro nombre.
- **CA-35:** Given el mismo caso sin una versión anterior válida, When se carga `/molotes`, Then se muestra la semilla.
- **CA-36:** Given el estado de archivo dañado, When se abre `/admin/molotes`, Then:
  - aparece el aviso;
  - se ofrecen "Restaurar versión anterior" (solo si es válida) y "Restaurar semilla";
  - la edición está bloqueada hasta que se elija una opción;
  - la elección queda en el registro y desbloquea la edición.
- **CA-37:** Given un JSON con sintaxis válida que no cumple el esquema (p. ej. un precio de 6000.00 escrito a mano), When se carga, Then se trata como archivo dañado (CA-34 a CA-36).

### Arquitectura y documentación

- **CA-38:** Given una implementación en memoria del repositorio inyectada en la app de pruebas, When se ejecutan las pruebas de controladores y landings, Then pasan sin leer archivos.
- **CA-39:** La semilla coincide con el diseño fuente: la prueba de contenido existente se aplica a la semilla, no a los datos vivos. El README y `.env.example` documentan las variables nuevas, la ubicación de los archivos, la semilla, la versión anterior, el registro y el procedimiento de recuperación.

## Casos límite

- Primera ejecución sin archivo editable (CA-4).
- Archivo dañado al arrancar o con el servidor en marcha (RF-8, CA-34 a CA-37).
- Fallo a mitad de la escritura (CA-29).
- Dos editores a la vez (RF-7, CA-32, CA-33).
- Precios 0, 0.01, 5000, 5000.01, con 3 decimales, negativos, con texto o vacíos (CA-10 a CA-15).
- La variante activa por defecto deja de estar disponible, todas las variantes de un producto dejan de estarlo, o una sección se queda sin productos (CA-7 a CA-9).
- Ruta de imagen inválida, inexistente o que intenta salir del directorio (CA-16).
- Petición manipulada con cambios de estructura o campos extra (CA-18).
- La sesión caduca a mitad de una edición (CA-22).
- Recargar después de guardar (POST-redirect-GET) y botón atrás sin datos de administración en caché (RF-5).
- JavaScript deshabilitado en la administración (RF-5.10).
- Credenciales no configuradas (CA-24).
- "8 Sabores de Barrio" no se ajusta solo al ocultar productos. Es un riesgo aceptado: el texto es editable.

## Dependencias

- Variables de entorno nuevas: carpeta de datos, usuario y contraseña de administración y, si hace falta, un secreto de sesión. Los nombres los define `senior-fullstack`.
- Permisos de escritura en la carpeta de datos de la VM.
- Cualquier dependencia nueva (parseo de formularios, sesiones) debe justificarse según `.claude/rules/dependencias.md`. Se prefieren soluciones nativas o pequeñas.
- Hay que ajustar `restaurante/tests/unit/content.test.js` para que valide la semilla.
- La administración no puede usar JavaScript inline, por la CSP de Helmet.

## Riesgos

- **R-1:** Si se filtra la credencial común, se pierde el control de acceso a ambos negocios. Mitigación: límite de intentos, caducidad de sesión y registro de cambios.
- **R-2:** El autor que se registra no está verificado, porque la cuenta es común.
- **R-3:** El bot de WhatsApp puede ofrecer productos que la landing oculta. Riesgo aceptado (C-15).
- **R-4:** "8 Sabores" y otros textos pueden quedar inconsistentes con los productos ocultos. Mantenerlos al día es responsabilidad del usuario.
- **R-5:** La administración no sigue un diseño fuente. Riesgo aceptado (C-8).
- **R-6:** Solo se conserva una versión anterior. Los respaldos externos de la VM corresponden a la operación.

## Action Plan

### Objetivo

Que los menús, los precios del hero y las promociones de ambas landings se puedan configurar desde `/admin/molotes` y `/admin/birria`, guardados en JSON mediante un repositorio intercambiable, con:

- acceso protegido;
- versión anterior;
- registro de cambios;
- aviso de conflicto;
- recuperación de archivos dañados.

### Alcance

El definido en la sección "Alcance".

### Fuera de alcance

El definido en la sección "Fuera de alcance".

### Cambios requeridos

1. Definir el esquema de datos por negocio (RF-1, RF-2) y sus reglas de validación (RF-3, RN-1).
2. Pasar los datos actuales a semillas JSON versionadas que coincidan con el diseño: `menu.js`, los precios en texto del hero, el texto destacado y las promociones.
3. Crear el contrato de repositorio y la implementación sobre archivos. Debe cubrir lectura, versión, escritura atómica, versión anterior, registro, semilla, y detección y aislamiento de archivos dañados (RF-6, RF-8, RF-9).
4. Hacer que las landings lean del repositorio y apliquen las reglas de disponibilidad y de variante activa. Los únicos cambios visuales son los productos ocultos y el aviso de sección vacía (RF-4).
5. Añadir configuración nueva, validada al arrancar: carpeta de datos y credenciales. Si faltan las credenciales, la administración queda deshabilitada (RF-5).
6. Implementar acceso, sesión con caducidad, cierre de sesión, límite de intentos, CSRF, `noindex` y respuestas sin caché (RF-5).
7. Crear el controlador de administración con estas acciones (RF-6 a RF-8):
   - mostrar el formulario de cada negocio;
   - guardar;
   - resolver conflictos con sus dos opciones;
   - restaurar la versión anterior;
   - restaurar la semilla;
   - mostrar el aviso de archivo dañado.
8. Crear una página de administración sencilla, accesible y responsive, que funcione sin JavaScript, con errores por campo y "Último cambio".
9. Escribir pruebas unitarias, de integración y de casos límite según CA-1 a CA-39, con un repositorio en memoria para controladores y vistas.
10. Actualizar el README y `.env.example`.

### Reglas de negocio

RN-1 a RN-8.

### UX/UI

- **Landings:** sin cambios visuales, salvo los productos ocultos y el aviso de sección vacía.
- **Administración:**
  - interfaz sencilla con HTML semántico y Tailwind;
  - formulario agrupado por producto, en el mismo orden que la landing;
  - precios en pesos con 2 decimales;
  - errores por campo;
  - confirmación antes de restaurar;
  - avisos de conflicto y de archivo dañado con botones claros.

### Integraciones

Ninguna externa. El enlace de WhatsApp no cambia.

### Casos límite

Los de la sección "Casos límite".

### Criterios de aceptación

CA-1 a CA-39.

### Dependencias

Las de la sección "Dependencias".

### Riesgos

R-1 a R-6.

### Orden recomendado

1. Esquema y semillas.
2. Repositorio de archivos: atomicidad, versión anterior, registro y archivo dañado.
3. Landings leyendo del repositorio, con la lógica de disponibilidad.
4. Configuración y acceso.
5. Controlador y página de administración.
6. Conflictos y restauraciones.
7. Pruebas.
8. Documentación.

### Resultado esperado

El dueño entra con la credencial común y puede:

- cambiar precios;
- ocultar productos, variantes o bebidas;
- editar textos, la metadata de las imágenes, el hero y las promociones.

La landing refleja los cambios de inmediato. Cada cambio queda registrado con autor y fecha y se puede revertir. Los conflictos se avisan y un archivo dañado no tumba la landing.

## Trazabilidad

| Objetivo                 | Requisito  | Historia   | Criterios          | UI / diseño                                     |
| ------------------------ | ---------- | ---------- | ------------------ | ----------------------------------------------- |
| Datos en JSON            | RF-1, RF-9 | HU-8       | CA-1 a CA-4, CA-38, CA-39 | Landings actuales sin cambios visuales  |
| Editar todo producto     | RF-2, RF-3 | HU-1, HU-3 | CA-10 a CA-19      | Administración sencilla (C-8, sin diseño fuente) |
| Disponibilidad           | RF-4       | HU-2, HU-8 | CA-5 a CA-9        | Aviso de sección vacía (sin diseño fuente)      |
| Seguridad                | RF-5, RF-10 | HU-4      | CA-20 a CA-26      | Página de acceso sencilla                       |
| Versión anterior y autor | RF-6       | HU-5       | CA-27 a CA-31      | Botón de restaurar, "Último cambio"             |
| Concurrencia             | RF-7       | HU-6       | CA-32, CA-33       | Aviso de conflicto                              |
| Recuperación             | RF-8       | HU-7       | CA-34 a CA-37      | Aviso con opciones                              |
| Preparado para BD        | RF-9       | —          | CA-38              | —                                               |

## Technical Action Plan

Contexto de despliegue confirmado: VM con disco persistente y **una sola instancia** de Node. Por eso las sesiones, el límite de intentos y el bloqueo de escritura viven en memoria del proceso y no se agrega ningún almacén externo.

### Objetivo técnico

1. Sacar del código (`menu.js`, precios en texto del hero, textos de promoción) los datos editables y servirlos desde un repositorio intercambiable con implementación sobre archivos JSON.
2. Añadir `/admin/molotes` y `/admin/birria`: formularios HTML nativos, sin JS y sin dependencias nuevas, con sesión, CSRF, límite de intentos, escritura atómica, versión anterior, registro de cambios, control de concurrencia por revisión y recuperación de archivo dañado.
3. Las landings quedan idénticas con la semilla, salvo lo que se oculta por disponibilidad y el aviso de sección vacía.

### Decisiones técnicas que se aprueban con este plan

| #    | Decisión | Motivo |
| ---- | -------- | ------ |
| DT-1 | **Ninguna dependencia nueva.** Body, sesión, CSRF, hash de contraseña y límite de intentos se implementan con `node:crypto`, `node:fs/promises`, `URLSearchParams` y `ctx.cookies` de Koa. | `.claude/rules/dependencias.md`: Node y Koa ya lo resuelven. Para un único formulario urlencoded y una sola cuenta, `koa-body`, `koa-session` o `csrf` aportan más superficie que valor. |
| DT-2 | La contraseña se configura como **hash scrypt** (`ADMIN_PASSWORD_HASH`), no en claro. Se agrega `npm run admin:hash-password`, que pide la contraseña sin mostrarla y devuelve el hash. | Si se filtra el `.env` o el entorno de la VM, la contraseña no queda expuesta. Cumple C-7: la credencial sigue en variables de entorno. |
| DT-3 | **En producción la administración exige HTTPS.** Si una petición `/admin` llega por HTTP plano, responde 503 "no disponible" y el log indica `admin_requires_https`. Detrás de un proxy inverso (nginx o Caddy con TLS), `TRUST_PROXY=true` hace que Koa respete `X-Forwarded-Proto` y `X-Forwarded-For`. | La cookie de sesión es `Secure` y la contraseña no debe viajar en claro. Sin `TRUST_PROXY`, detrás de un proxy, el límite por IP bloquearía a todos a la vez (vería solo la IP del proxy). **Confirmar cómo se termina TLS en la VM** (ver Riesgos técnicos, RT-1). |
| DT-4 | `DATA_DIR` es **obligatoria en producción** y debe ser una ruta absoluta. En desarrollo vale por defecto `restaurante/data/`, que queda en `.gitignore`. En pruebas se usa un directorio temporal. | Un despliegue que reemplace la carpeta del código no debe borrar los datos (RF-1.3). |
| DT-5 | Molotes recibe un `id` estable, **no editable y no visible**, por producto y por bebida (p. ej. `queso-oaxaca`, `aguas-frescas`), equivalente al `slug` de Birria. | Sin identificador no se pueden detectar los cambios de orden de CA-18 ni hacer un registro de cambios legible. Las variantes y los chips se identifican por posición: no tienen identidad propia y "reordenarlos" en una petición equivale a editar sus textos, lo cual está permitido. |
| DT-6 | La existencia física de la imagen en `public/img/` se comprueba **al guardar desde la administración**. Al cargar el JSON (arranque o restauración) solo se valida el formato de la ruta. | Si un despliegue borra una foto, toda la data del negocio no debe pasar a "dañada" y bloquear la edición. Una imagen faltante solo provoca una imagen rota, igual que hoy. |
| DT-7 | Si **no** están `ADMIN_USER` ni `ADMIN_PASSWORD_HASH`, la administración queda deshabilitada (CA-24). Si está solo una, o si el hash tiene un formato inválido, el arranque falla con `ConfigError`. | "No configuradas" es un estado válido, mientras que "mal configuradas" es un error y el proyecto falla rápido (`src/config/env.js`). |
| DT-8 | Restaurar la semilla solo se ofrece en el estado de archivo dañado (RF-8.3). "Restaurar versión anterior" está siempre disponible (RF-6.5). | Es lo que pide el ticket; no se amplía el alcance. |

### Archivos o componentes afectados

**Nuevos**

| Archivo | Responsabilidad |
| ------- | --------------- |
| `src/content/molotes/seed.json`, `src/content/birria/seed.json` | Semillas versionadas con los datos actuales (precios en centavos). |
| `src/services/menu-schema.js` | Esquema por negocio: listas de tonos, longitudes máximas, validación estricta de un documento (tipos, rangos, campos desconocidos y estructura). |
| `src/services/price.js` | `parsePesosInput("45.50") -> 4550` sin aritmética de coma flotante, y `centsToInput(4550) -> "45.50"`. |
| `src/services/admin-form.js` | Formulario a documento: lee solo los campos esperados, compara la estructura con la versión vigente, junta los errores por campo y conserva lo escrito (CA-19). |
| `src/services/menu-diff.js` | Lista de `{ campo, antes, después }` para el registro. |
| `src/services/visible-menu.js` | Reglas de disponibilidad (RF-4): filtra productos y bebidas, elige la primera variante disponible y oculta los productos sin variantes. |
| `src/repositories/menu-repository.js` | Contrato (JSDoc) y errores tipados: `MenuConflictError`, `MenuDamagedError`, `PreviousUnavailableError`. |
| `src/repositories/file-menu-repository.js` | Implementación sobre archivos. |
| `src/repositories/memory-menu-repository.js` | Implementación en memoria, para pruebas (CA-38) y como referencia del contrato. |
| `src/services/admin-auth.js` | Verificación scrypt con `timingSafeEqual` y comparación de usuario en tiempo constante. |
| `src/services/session-store.js` | Sesiones en memoria: id aleatorio de 256 bits, caducidad por inactividad de 2 h, token CSRF por sesión y un tope de sesiones. |
| `src/services/login-throttle.js` | 5 fallos por IP provocan un bloqueo de 15 min. Usa el reloj inyectado `now` y tiene un tope de entradas. |
| `src/utils/form-body.js` | Lee el body urlencoded con límite de bytes y de campos. Responde 413 o 415 según el caso. |
| `src/middleware/admin-guard.js` | Admin deshabilitada (503), HTTPS en producción, cabeceras `noindex` y `no-store`, validación de origen en POST, sesión y CSRF. |
| `src/controllers/admin.js` | Acceso, cierre de sesión, ver, guardar, conflicto, confirmar y restaurar la versión anterior, y restaurar la semilla. |
| `src/routes/admin.js` | Rutas de administración, montadas desde `src/routes/index.js`. |
| `src/views/admin/*.js` | Constructores de vista: documento a campos con valores, errores y avisos. |
| `src/views/layouts/admin.html`, `src/views/pages/admin-*.html`, `src/views/partials/admin/*.html` | Layout con `<meta name="robots" content="noindex, nofollow">`, acceso, formulario por negocio, confirmación de restauración, avisos y campos. |
| `src/views/partials/molotes/menu-empty.html`, `drinks-empty.html`, `src/views/partials/birria/menu-empty.html` | Aviso de sección vacía con el CTA de WhatsApp existente (RF-4.5). |
| `src/styles/admin/main.css` | Hoja Tailwind de la administración (`@tailwindcss/forms`, que ya es devDependency). |
| `scripts/hash-password.js` | Genera `ADMIN_PASSWORD_HASH`. |

**Modificados**

| Archivo | Cambio |
| ------- | ------ |
| `src/config/env.js` | Lee y valida `DATA_DIR`, `ADMIN_USER`, `ADMIN_PASSWORD_HASH` y `TRUST_PROXY`. |
| `src/app.js` | Recibe `repository` (obligatorio), pone `app.proxy = config.trustProxy` y crea el almacén de sesiones y el limitador de intentos. |
| `src/server.js` | Crea el repositorio de archivos, ejecuta `await repository.init()` (primera ejecución o archivo dañado) y luego `listen`. |
| `src/controllers/landing.js` | Se vuelve `async` y obtiene los datos con `repository.getPublished(businessId)`. |
| `src/views/landings/index.js`, `molotes.js`, `birria.js` | Combinan el contenido estático con los datos del repositorio ya filtrados por `visible-menu`. Formatean el precio del hero desde centavos. Renderizan el aviso de sección vacía cuando corresponde. |
| `src/content/molotes/index.js`, `src/content/birria/index.js` | Quitan los campos que pasan a la semilla: `menu.items`, `menu.highlight`, `drinks.items`, `hero.showcase` y los textos de promoción o club. |
| `src/content/molotes/menu.js`, `src/content/birria/menu.js` | **Se eliminan.** La semilla es la nueva fuente (RF-1.2). |
| `src/views/pages/molotes.html`, `birria.html` | Cambios mínimos para leer los campos editables del nuevo objeto de vista. Sin cambios de marcado ni de clases. |
| `src/routes/index.js` | Monta el router de administración. |
| `package.json` | Scripts `build:css:admin` (incluido en `build:css`), `watch:css:admin` y `admin:hash-password`. No agrega dependencias. |
| `.gitignore` | Agrega `data/`. |
| `.env.example`, `README.md` | Documentan las variables, los archivos, la semilla, la versión anterior, el registro, la recuperación y la generación del hash. |
| `tests/helpers.js` y las pruebas existentes | Inyectan el repositorio en memoria. `content.test.js` valida la semilla contra `_stich_source_/`. |

### Contenido / configuración

**Variables de entorno nuevas**

| Variable | Obligatoria | Descripción |
| -------- | ----------- | ----------- |
| `DATA_DIR` | Solo en producción (ruta absoluta) | Carpeta de los datos editables. Por defecto en desarrollo: `restaurante/data`. Se valida que no esté dentro de `src/` ni de `public/`. |
| `ADMIN_USER` | No (si falta junto con el hash, la administración se deshabilita) | De 1 a 60 caracteres. |
| `ADMIN_PASSWORD_HASH` | No (igual que la anterior) | `scrypt$<N>$<r>$<p>$<salt base64url>$<hash base64url>`, generado con `npm run admin:hash-password`. |
| `TRUST_PROXY` | No (`false`) | Ponerla en `true` solo detrás de un proxy inverso que fije `X-Forwarded-For` y `X-Forwarded-Proto`. |

No hace falta un `SESSION_SECRET`. El id de sesión es un valor aleatorio opaco de 256 bits que se valida contra el almacén del servidor, así que no hay nada que firmar. Los parámetros de P-3 (2 h, 5 intentos, 15 min) son constantes del código y no variables de entorno.

**Estructura de `DATA_DIR`**

```text
DATA_DIR/
├── molotes/
│   ├── current.json               # versión vigente
│   ├── previous.json              # versión anterior (una)
│   ├── damaged-<fecha>.json       # archivo dañado aislado (RF-8.2)
│   └── damaged.marker.json        # estado "dañado" persistente: { since, damagedFile, servingFrom }
├── birria/ (igual)
└── changes.jsonl                  # registro de cambios (una línea JSON por entrada, ambos negocios)
```

**Documento JSON (sobre de versión + datos)**

```json
{
  "schemaVersion": 1,
  "business": "molotes",
  "revision": 7,
  "updatedAt": "2026-10-02T13:45:10-06:00",
  "updatedBy": "Ana",
  "data": { "hero": {}, "menu": { "highlight": "", "items": [] }, "drinks": { "items": [] }, "promo": {} }
}
```

- La semilla tiene `revision: 0`, `updatedAt: null` y `updatedBy: null`.
- Los precios se guardan como enteros en centavos (`unitPriceCents`, `orderPriceCents`, `priceCents`).
- En Birria, los productos con `detailsType: "variants"` no tienen `priceCents` ni `description` propios (RF-2).
- La disponibilidad se guarda en `available: true|false` en productos, bebidas y variantes.

### Backend

**Repositorio (RF-9)**

Contrato asíncrono, para poder pasar a una base de datos sin cambiar controladores ni vistas:

- `init()`: primera ejecución o detección de archivo dañado al arrancar.
- `getPublished(businessId)`: datos válidos en memoria para la landing. No hace E/S por petición.
- `getForEdit(businessId)`: vuelve a leer y validar el disco. Devuelve `{ document, damaged?: { servingFrom, previousValid } }`. Así detecta un daño ocurrido con el servidor en marcha (RF-8.5).
- `save(businessId, { data, expectedRevision, author, action })`: `action` es `save` u `overwrite_after_conflict`.
- `restorePrevious(businessId, { author })` y `restoreSeed(businessId, { author })`.
- `getLastChange(businessId)`: devuelve `{ at, by }` a partir del sobre de versión, sin leer el registro.

**Escritura atómica (RF-6.1, CA-29)**

1. `writeJsonAtomic(path, value)`: escribe `<path>.<pid>.<aleatorio>.tmp` en el **mismo directorio**, hace `filehandle.sync()`, ejecuta `rename(tmp, path)` (atómico en POSIX dentro del mismo sistema de archivos) y luego `fsync` del directorio. Si falla, borra el `.tmp` y propaga el error.
2. Orden al guardar:
   - lee y valida `current.json` del disco;
   - escribe `previous.json` (atómico) con ese contenido;
   - escribe `current.json` (atómico) con la revisión `+1`;
   - actualiza la caché en memoria;
   - añade la entrada a `changes.jsonl` (`appendFile` con `fsync`).
3. Si el proceso cae entre el segundo y el tercer paso, `current.json` sigue completo con la versión previa. Si falla el registro, el guardado ya está hecho: se registra `change_log_write_failed` en el log del servidor y el usuario ve el guardado como exitoso.
4. Restaurar la versión anterior hace un intercambio: escribe en `previous.json` el contenido vigente y en `current.json` el anterior, con una revisión nueva (`max + 1`). Así, quien tenga el formulario abierto recibe el aviso de conflicto.

**Concurrencia (RF-7)**

- Cada negocio tiene una cola de promesas (mutex en proceso) que serializa las escrituras. Basta con una sola instancia.
- Dentro del bloqueo se compara `expectedRevision` con la revisión del disco (compare-and-swap). Si no coinciden, se lanza `MenuConflictError({ revision, updatedAt, updatedBy })` y no se escribe nada.
- "Guardar mis cambios de todos modos" reenvía el mismo formulario con `expectedRevision` igual a la revisión mostrada en el aviso y `action=overwrite_after_conflict`. Si alguien vuelve a guardar en medio, aparece otro aviso: nunca se sobrescribe a ciegas (RN-6).
- "Descartar y cargar la versión actual" es un enlace GET a `/admin/<negocio>` y no escribe nada.

**Archivo dañado (RF-8)**

- **Al arrancar.** Si `current.json` no es JSON válido o no cumple el esquema:
  - se renombra a `damaged-<fecha>.json`;
  - se crea `damaged.marker.json`;
  - se publica `previous.json` si es válido y, si no, la semilla;
  - se registra `menu_data_damaged` con negocio y motivo, sin contenido ni rutas absolutas.
- **El marcador hace que el estado sobreviva a un reinicio.** Sin él, al no existir `current.json`, el siguiente arranque lo trataría como primera ejecución y desbloquearía la edición sin que nadie eligiera.
- **Primera ejecución** (no hay `current.json` ni marcador):
  - se copia la semilla a `current.json` y también a `previous.json`, para que "Restaurar versión anterior" siempre tenga algo válido (RF-6.5);
  - se registra `menu_data_seeded`.
- **Con el servidor en marcha.** `getForEdit` y `save` vuelven a validar el disco:
  - si está dañado, se aísla el archivo y se crea el marcador;
  - la landing sigue con la caché en memoria;
  - la administración muestra el aviso.
- **Elegir "Restaurar versión anterior" o "Restaurar semilla"** escribe `current.json` de forma atómica, borra el marcador, deja la acción en el registro y desbloquea la edición.
- **Ediciones manuales con el servidor en marcha.** Si el archivo se editó a mano pero sigue siendo válido, se aplica al reiniciar (P-6). Si antes se guarda desde la administración, el contenido del disco, con la edición manual incluida, pasa a `previous.json`. Así no se pierde.

**Acceso y sesión (RF-5)**

- **Cookie `admin_sid`:** `HttpOnly`, `SameSite=Strict`, `Path=/admin`, `Secure` en producción y sin `Max-Age` (cookie de sesión). La caducidad de 2 h por inactividad se controla en el servidor y se renueva en cada petición autenticada.
- **Al iniciar sesión** se crea un id nuevo (contra la fijación de sesión) y un token CSRF de 256 bits. Cerrar sesión (POST con CSRF) borra la sesión del almacén y la cookie.
- **Límite de intentos:** la clave es `ctx.ip`, que es fiable si `TRUST_PROXY` está bien configurado. Cada fallo suma y un acceso correcto reinicia el contador. Con 5 fallos se bloquea 15 min. Durante el bloqueo responde 429 con un mensaje genérico, incluso con credenciales correctas. El log registra `admin_login_failed` o `admin_login_locked` con la IP, sin el usuario ni la contraseña.
- **CSRF** (todas las acciones POST):
  1. validación de origen: si llega `Origin`, debe coincidir con el origen de la petición; si llega `Sec-Fetch-Site`, debe ser `same-origin`;
  2. token sincronizador en `<input type="hidden" name="_csrf">`, comparado con `timingSafeEqual`.
  - El formulario de acceso usa (1) y `SameSite`, porque todavía no hay sesión.
  - Si falla, responde 403 con el formato centralizado `{ error: { code: "CSRF_INVALID", ... } }`.
- **Sin sesión:** un GET redirige con 303 a `/admin/login?next=/admin/<negocio>` (`next` solo admite las rutas de administración conocidas, para evitar un redirect abierto). Un POST redirige igual, con el aviso "Tu sesión caducó, vuelve a entrar", y no escribe nada (CA-22).
- **Administración deshabilitada** (DT-7): todo `/admin*` responde 503 `ADMIN_UNAVAILABLE` "Administración no disponible". Al arrancar se registra `admin_disabled` con el motivo.
- **Todas las respuestas de `/admin*`** llevan:
  - `Cache-Control: no-store`;
  - `X-Robots-Tag: noindex, nofollow`;
  - `<meta name="robots">`.
- Las landings no enlazan a `/admin`.

**Body (RF-3, CA-18)**

- `form-body.js` solo acepta `application/x-www-form-urlencoded`; con otro tipo responde 415.
- Límite de **128 KB**, comprobado con `Content-Length` y contando bytes mientras se lee el stream (413), y de 600 campos. La cifra viene del peor caso de Molotes: unos 9.000 caracteres de texto con acentos codificados en porcentaje, más los nombres de campo.
- Se parsea con `URLSearchParams` y un mismo campo repetido es un error.
- Los nombres de campo son rutas planas, p. ej. `items.3.variants.1.priceCents`. `admin-form.js` recorre **solo** las rutas esperadas a partir del documento vigente. Cualquier campo extra es un error de estructura.
- `id`, `slug` y `detailsType` viajan en campos ocultos y deben coincidir, en orden, con el documento vigente. Si no coinciden, responde 400 "estructura modificada" y no escribe nada.
- Las casillas ausentes equivalen a `false`; si llegan, su único valor válido es `on`.

**Errores (RF-10)**

| Caso | Respuesta |
| ---- | --------- |
| Validación | 422 con el formulario, los valores escritos y los errores por campo. |
| Conflicto | 409 con el aviso y las dos opciones. |
| Datos dañados | 200 con el aviso; la edición queda bloqueada. |
| CSRF, estructura, 413, 415, 429 y 503 | Formato JSON centralizado (`error-handler.js`). |

Los mensajes nunca incluyen rutas, contenido JSON ni stack.

### Frontend

**Landings**

- Mismo marcado y mismas clases. `visible-menu.js` entrega solo lo disponible.
- En Birria, la variante activa (`aria-pressed="true"`) es la primera disponible y la tarjeta usa su precio y su descripción. `variant-selector.js` no cambia.
- Si una sección se queda sin productos, se renderiza el partial de aviso con el texto de RF-4.5 y el enlace `data-action="whatsapp-order"` con el `href` configurado.
  - El aviso usa los tokens existentes de cada landing.
  - Las clases nuevas (BEM `menu-empty`, `menu-empty__text`) quedan dentro del `@source` actual, así que la CSS se regenera con `npm run build:css`.

**Administración** (sin diseño fuente, C-8; Tailwind y BEM; sin JavaScript)

- Layout propio y sobrio, sin Google Fonts (fuente del sistema), mobile-first.
- **Página de acceso:** `<form method="post">` con `<label>`, `autocomplete="username"` y `current-password`, y mensaje de error genérico en `role="alert"`.
- **Página del negocio:**
  - cabecera con "Último cambio: <fecha> por <nombre>" y navegación entre negocios, con `aria-current`;
  - botón "Cerrar sesión";
  - un `<fieldset>` por producto, con `<legend>` y en el orden de la landing;
  - precios como `type="text" inputmode="decimal"` con 2 decimales, para conservar exactamente lo escrito (CA-19) y evitar la notación `e` de `type=number`;
  - tonos como `<select>`; disponibilidad como `<input type="checkbox">`;
  - campo "Nombre de quien hace el cambio" y botón "Guardar".
- **Errores:**
  - resumen al inicio (`role="alert"`, `tabindex="-1"`, con enlaces a cada campo);
  - mensaje junto a cada campo, enlazado con `aria-describedby` y `aria-invalid="true"`;
  - prefijo textual "Error:", para no depender del color.
- **Aviso de conflicto:** quién y cuándo, con el botón "Guardar mis cambios de todos modos" y el enlace "Descartar y cargar la versión actual".
- **Aviso de archivo dañado:** el texto de RF-8.3; el formulario queda deshabilitado (`<fieldset disabled>`, y el servidor también lo rechaza) y se muestran las opciones de restauración con el campo de autor.
- **Confirmar restauración sin JS:** `GET /admin/<negocio>/restaurar-anterior` muestra una página de confirmación con el campo de autor y un `POST`. Después, POST-redirect-GET (303) a `/admin/<negocio>?ok=<acción>` con un mensaje `role="status"`.

**Rutas**

| Método | Ruta | Acción |
| ------ | ---- | ------ |
| GET | `/admin` | 303 a `/admin/molotes`. |
| GET / POST | `/admin/login` | Formulario de acceso / acceder. |
| POST | `/admin/logout` | Cerrar sesión. |
| GET / POST | `/admin/:negocio` | Ver / guardar (incluye la sobrescritura tras conflicto). |
| GET / POST | `/admin/:negocio/restaurar-anterior` | Confirmar / restaurar. |
| POST | `/admin/:negocio/restaurar-semilla` | Solo en estado dañado. |

`:negocio` se valida contra `BUSINESS_IDS`; cualquier otro valor responde 404.

### Validaciones

| Campo | Regla |
| ----- | ----- |
| Precio | Regex `^\d{1,4}(\.\d{1,2})?$` sobre el texto recortado (rechaza `-10`, `abc`, `45.505`, `1e3` y vacío). Se convierte a centavos con aritmética entera y debe estar entre 1 y 500000. Mensajes: "El precio debe ser mayor que $0", "El máximo es $5,000.00" y "Usa un número con hasta 2 decimales". |
| Textos | Se recortan; son obligatorios y tienen las longitudes de P-1. La longitud se cuenta en puntos de código, no en unidades UTF-16. |
| Cantidad por orden | Entero de 1 a 20. |
| Ancho y alto de imagen | Enteros de 1 a 4000. |
| Ruta de imagen | Empieza con `/img/`, termina en `.jpg`, `.jpeg`, `.png` o `.webp` y no contiene `..`. Solo admite `[A-Za-z0-9/_.-]`, para rechazar espacios, `%` y caracteres de control. Al resolverla con `path.resolve` debe quedar dentro de `public/img`. Al guardar se comprueba con `stat` que sea un archivo regular (DT-6). |
| Tono | Lista cerrada por tipo. Las clases de Tailwind siguen en `views/landings/molotes.js`. |
| Icono | Regex `^[a-z0-9_]+$`, con un máximo de 40 caracteres. |
| Autor | Obligatorio, máximo 60 caracteres. |
| Documento (al cargar de disco) | `menu-schema.js` aplica las mismas reglas de tipos, rangos y longitudes, rechaza campos desconocidos y exige la estructura de la semilla: los mismos ids o slugs, `detailsType`, y la misma cantidad de chips y variantes. Si no cumple, el archivo se considera dañado (CA-37). |

### Manejo de errores

- Las escrituras que fallan (disco lleno, permisos) borran el `.tmp`, dejan `current.json` intacto, registran `menu_save_failed` en el log (solo `code` y negocio) y responden 500 genérico.
- `init()` nunca impide el arranque por datos dañados. Sí lo impide si `DATA_DIR` no existe y no se puede crear, o si no tiene permiso de escritura (fail fast, con mensaje claro y sin la ruta en respuestas HTTP).

### Testing

Vitest con Supertest y jsdom. El repositorio de archivos se prueba sobre `fs.mkdtemp(os.tmpdir())` y el reloj se controla con `now` inyectado o con `vi.setSystemTime`.

| Archivo | Cubre |
| ------- | ----- |
| `unit/price.test.js` | 0, 0.00, 0.01, 5000, 5000.00, 5000.01, 45.505, -10, `abc`, vacío, `1e3`, espacios y `45.5` -> 4550 (CA-10 a CA-13, CA-15). |
| `unit/menu-schema.test.js` | Las semillas son válidas. Rechaza tono, icono, ancho y alto, cantidad, longitudes, ruta de imagen (`..`, extensión, prefijo), campos desconocidos y estructura (CA-16 a CA-18, CA-37). |
| `unit/admin-form.test.js` | Mapeo del formulario. Prueba **cada** precio de ambos negocios con un caso límite (CA-14), casillas ausentes, campos extra, `slug`, `id` o `detailsType` cambiados, índices de más o de menos, conservación de lo escrito (CA-19) y autor vacío (CA-28). |
| `unit/visible-menu.test.js` | CA-5 a CA-9: producto oculto conservando el orden, bebida oculta, primera variante disponible, todas las variantes ocultas y sección vacía. |
| `unit/file-menu-repository.test.js` | Primera ejecución (CA-4), guardado con versión anterior y registro (CA-27), conflicto (CA-32 y CA-33), restauraciones (CA-30), dañado al arrancar con anterior válida o sin ella (CA-34 y CA-35), el marcador sobrevive a un reinicio, daño con el servidor en marcha (RF-8.5) y fallo simulado en `rename` o `write`, con `fs` inyectado (CA-29). |
| `unit/session-store.test.js`, `unit/login-throttle.test.js`, `unit/admin-auth.test.js` | Caducidad a las 2 h, 5 fallos y bloqueo de 15 min, scrypt y comparación en tiempo constante. |
| `unit/config.test.js` (amplía) | Admin deshabilitada, configuración parcial que falla, hash mal formado, `DATA_DIR` en producción y `TRUST_PROXY`. |
| `integration/admin.test.js` | Supertest con el repositorio en memoria (CA-38): redirección sin sesión (CA-20), acceso fallido y bloqueo (CA-21), acceso y cierre de sesión, caducidad al guardar sin escribir (CA-22), CSRF ausente o inválido y `Origin` ajeno (CA-23), 503 sin credenciales con landings en 200 (CA-24), cabeceras `noindex` y `no-store` y ausencia de `/admin` en las landings (CA-25), log capturado sin la contraseña (CA-26), guardado con PRG y landing actualizada (CA-27 y CA-1 a CA-3), "Último cambio" (CA-31), conflicto y sus dos opciones (CA-32 y CA-33), página de archivo dañado y desbloqueo (CA-36), 413 y 415. |
| `integration/app.test.js` (amplía) | Landings con datos editados (CA-1 a CA-3, CA-15) y archivo dañado con el repositorio de archivos real (CA-34 y CA-35). |
| `unit/content.test.js` (ajusta) | Valida la **semilla** contra `_stich_source_/` (CA-39). |
| `unit/landing-dom.test.js` (amplía) | Variante activa y sección vacía en el DOM. |

**Regresión visual (CA-4).** Antes del refactor se guarda el HTML actual de `/molotes` y `/birria` como snapshot de archivo (`toMatchFileSnapshot`). Después del refactor, el HTML renderizado con la semilla debe ser **idéntico byte a byte**.

Comandos: `npm run build:css`, `npm test` y `npm run lint` (este último se reportará como "lint no configurado").

### Seguridad

- No se registran ni se devuelven credenciales, hash, token CSRF, id de sesión ni rutas absolutas. CA-26 se prueba buscando la contraseña en todas las líneas del logger capturado.
- Toda la salida pasa por `{{ }}`, que escapa. No se usa `{{{ }}}` con datos editables.
- La CSP de Helmet no se relaja: no hay JS ni estilos inline en la administración y `form-action 'self'` ya permite los formularios.
- Se protege contra:
  - CSRF (origen y token);
  - fijación de sesión (id nuevo al acceder);
  - redirect abierto (`next` restringido);
  - fuerza bruta (límite de intentos);
  - path traversal en imágenes (`resolve` dentro de `public/img`);
  - DoS por body (límites de bytes y de campos);
  - prototype pollution: no se construyen objetos a partir de los nombres de campo; solo se leen rutas conocidas.
- Riesgos aceptados que siguen vigentes: R-1 (credencial común) y R-2 (autor no verificado).

### Performance

- Las landings leen de la caché en memoria del repositorio: sin E/S de disco por petición.
- La administración lee y valida el disco solo en sus propias páginas.
- scrypt usa la versión asíncrona de `node:crypto`, que no bloquea el event loop.
- No se agrega JS al cliente. La administración suma una hoja CSS propia pequeña que no se carga en las landings.

### Riesgos técnicos

| #    | Riesgo | Mitigación |
| ---- | ------ | ---------- |
| RT-1 | **TLS en la VM sin confirmar.** Si en producción Node se expone directamente por HTTP, la administración queda deshabilitada (DT-3). | Necesita un proxy con TLS (nginx o Caddy) y `TRUST_PROXY=true`, o se acepta el bloqueo. Se documenta en el README. |
| RT-2 | Sesiones y límite de intentos en memoria: un reinicio cierra las sesiones y reinicia los contadores. | Aceptable con una sola instancia. Si un día se escala a varias, hay que mover ambos a un almacén compartido. El repositorio ya es intercambiable. |
| RT-3 | `changes.jsonl` crece sin límite. | Es pequeño (unos pocos KB por cambio). La rotación queda para la operación de la VM y se documenta. |
| RT-4 | Ediciones manuales con el servidor en marcha: no se ven hasta reiniciar. Si antes se guarda desde la administración, la edición manual pasa a ser la versión anterior. | Se documenta (P-6). |
| RT-5 | Cambia la firma de `createApp` (`repository` obligatorio) y `renderLandingPage` recibe datos. | Se ajustan las pruebas existentes. El snapshot byte a byte protege contra regresiones visuales. |
| RT-6 | Refactor amplio: unos 25 archivos nuevos y unos 15 modificados. | Se implementa por capas en el orden siguiente, con las pruebas de cada capa antes de seguir. |

### Orden de implementación

1. Snapshots HTML actuales de `/molotes` y `/birria` (línea base para CA-4).
2. `price.js`, `menu-schema.js` y las semillas JSON. `content.test.js` pasa a validar la semilla.
3. Contrato del repositorio, implementación en memoria e implementación de archivos: atomicidad, versión anterior, registro, conflicto, dañado y primera ejecución.
4. `visible-menu.js`, landings leyendo del repositorio y aviso de sección vacía. Los snapshots siguen idénticos.
5. `env.js`, `form-body.js`, `admin-auth.js`, `session-store.js`, `login-throttle.js` y `admin-guard.js`. Script de hash.
6. `admin-form.js`, `menu-diff.js`, controlador, rutas y vistas de la administración, más la CSS de la administración.
7. Conflicto, restauraciones y archivo dañado en la interfaz.
8. Pruebas de integración y `build:css`.
9. README, `.env.example` y `.gitignore`.

### Criterios de finalización

- CA-1 a CA-39 verificados por pruebas automatizadas, salvo la parte de "contraste y foco" de la administración, que se revisa a mano.
- `npm test` en verde, `npm run build:css` sin errores y `npm run lint` reportado como no configurado.
- Con la semilla, el HTML de las landings es idéntico al anterior al cambio.
- No se agregan dependencias en `package.json`.
- README y `.env.example` actualizados.
- `git diff` sin cambios ajenos al ticket.

## Implementation Result

### Rama

`feature/REQ-F-001-menu-precios-configurables`, creada desde `main` actualizado (`aa45fed`). Sin commits: todos los cambios están en el árbol de trabajo. El ticket está en el índice porque `git mv` lo exige.

### Cambios realizados

- **Semillas y esquema.**
  - `src/content/{molotes,birria}/seed.json` contienen los datos actuales del diseño, con los precios en centavos y `available: true`.
  - Se agregó el `id` fijo de molotes y bebidas (DT-5).
  - En Birria, los platillos con variantes ya no tienen precio ni descripción propios.
  - `src/content/seeds.js` carga las semillas.
  - Se eliminaron `menu.js` y los campos editables de `src/content/*/index.js`.
  - `src/services/menu-schema.js` es el esquema declarativo único: valida el JSON y genera el formulario.
  - `price.js` convierte pesos a centavos con aritmética entera.
- **Repositorio (RF-9).**
  - `src/repositories/menu-repository.js` reúne el contrato, los errores tipados y las reglas comunes: versión, versión anterior, registro, conflicto, archivo dañado con marcador persistente y primera ejecución.
  - Las reglas trabajan sobre un `storage` con dos implementaciones: archivos (`file-menu-repository.js`, escritura atómica con tmp, fsync, rename y fsync del directorio) y memoria (`memory-menu-repository.js`).
  - Las escrituras de cada negocio se serializan con un mutex en proceso.
- **Landings.**
  - Leen de `repository.getPublished()`, que trabaja en memoria y no lee el disco por petición.
  - `visible-menu.js` aplica RF-4.
  - El aviso de sección vacía con el CTA de WhatsApp está en `partials/{molotes,birria}/section-empty.html`.
  - El controlador de landing pasó a ser asíncrono.
- **Administración.**
  - Archivos: `src/routes/admin.js`, `src/controllers/admin.js`, `src/middleware/admin-guard.js` (gate 503 y HTTPS en producción, `no-store`, `X-Robots-Tag`, Origin y Sec-Fetch-Site, CSRF y sesión), `services/admin-auth.js` (scrypt), `session-store.js`, `login-throttle.js`, `admin-form.js`, `menu-diff.js`, `utils/form-body.js` y `utils/datetime.js`.
  - Vistas en `src/views/admin/` y hoja `src/styles/admin/main.css`.
  - Script `scripts/hash-password.js`.
- **Configuración.** `env.js` valida `DATA_DIR`, `ADMIN_USER`, `ADMIN_PASSWORD_HASH` y `TRUST_PROXY`. `app.js` inyecta el repositorio, aplica `app.proxy = TRUST_PROXY` y `app.maxIpsCount = 1`. `server.js` hace `await repository.init()` antes de `listen`.
- **Documentación.** README (menús, administración, seguridad, ejemplo de nginx, archivos de `DATA_DIR`, recuperación y estructura), `.env.example`, `.gitignore` (`data/`) y `package.json` (scripts `build:css:admin`, `watch:css:admin` y `admin:hash-password`, sin dependencias nuevas).

**Ajustes respecto al Technical Action Plan** (técnicos, sin cambio de alcance funcional):

1. Las plantillas de la administración viven en `src/views/admin/` y no en `layouts/`, `pages/` o `partials/`. Así la hoja de Tailwind de cada landing no incluye las clases de la administración, porque sus `@source` escanean `views/layouts`.
2. La versión que viaja en el formulario es `revision@updatedAt`, no solo `revision`. Tras restaurar con datos dañados, la revisión nueva podría coincidir con la de la versión perdida; con la fecha, un formulario abierto antes del daño siempre recibe el aviso de conflicto.
3. El aviso de sección vacía se pinta dentro del mismo contenedor de la lista: `<li>` en Molotes, `<div>` en el grid de Birria. Así las páginas no cambian y la línea base sigue idéntica byte a byte.
4. `app.maxIpsCount = 1`: el límite de intentos usa la IP que añade nginx y no la que el cliente puede falsear en `X-Forwarded-For`.
5. En el estado dañado, las opciones "Restaurar versión anterior" y "Restaurar semilla original" son formularios POST directos con el campo de autor: la elección del usuario es la confirmación. Fuera de ese estado, "Restaurar versión anterior" pasa por una página de confirmación.
6. **Hallazgo:** en Koa 3, `ctx.origin` devuelve la cabecera `Origin` de la petición, no el origen del servidor. La validación de origen calcula `ctx.protocol://ctx.host`. Lo detectó la prueba de CSRF.

### Criterios de aceptación

| CA | Estado | Evidencia (prueba) |
| -- | ------ | ------------------ |
| CA-1 | Cumple | `integration/admin.test.js` (guardar), `integration/app.test.js` |
| CA-2 | Cumple | `admin.test.js` "CA-2" |
| CA-3 | Cumple | `admin.test.js` "CA-3" |
| CA-4 | Cumple | `unit/landing-snapshot.test.js` (HTML idéntico byte a byte a la línea base previa al cambio), `app.test.js` "CA-4" y `file-menu-repository.test.js` |
| CA-5 a CA-9 | Cumple | `unit/visible-menu.test.js`, `admin.test.js`, `app.test.js` y `landing-dom.test.js` |
| CA-10 a CA-15 | Cumple | `unit/price.test.js` y `unit/admin-form.test.js` (todos los precios de ambos negocios con los 10 casos límite) |
| CA-16, CA-17 | Cumple | `admin-form.test.js` y `menu-schema.test.js` |
| CA-18 | Cumple | `admin-form.test.js`, `menu-schema.test.js` y `admin.test.js` (400 `STRUCTURE_MODIFIED`) |
| CA-19 | Cumple | `admin.test.js` (conserva lo escrito; `aria-invalid`, `aria-describedby`, texto "Error:" y resumen con enlaces) |
| CA-20 a CA-26 | Cumple | `admin.test.js` |
| CA-27 a CA-31 | Cumple | `admin.test.js` y `file-menu-repository.test.js` (CA-29 con fallos de `rename` y de escritura inyectados) |
| CA-32, CA-33 | Cumple | `admin.test.js` y `file-menu-repository.test.js` |
| CA-34 a CA-37 | Cumple | `file-menu-repository.test.js` y `app.test.js` (repositorio de archivos real) |
| CA-38 | Cumple | Las pruebas de controladores y landings usan `createMemoryMenuRepository`; `menu-repository-contract.test.js` |
| CA-39 | Cumple | `content.test.js` valida la semilla contra `_stich_source_/`; README y `.env.example` actualizados |

### Validaciones ejecutadas

- `npm run build:css`: OK (molotes, birria y admin; Tailwind v4.3.3).
- `npm test`: 22 archivos, **416 pruebas pasan** y 0 fallan. Antes del cambio eran 146.
- `npm run lint`: **lint no configurado** (placeholder).
- Prueba manual con `node src/server.js`, `DATA_DIR` temporal y credenciales:
  - en la primera ejecución creó `current.json` y `previous.json` por negocio y registró `menu_data_seeded`;
  - `/molotes` respondió 200 y `/admin/molotes` respondió 303 al acceso;
  - `/css/admin/main.css` respondió 200;
  - `npm run admin:hash-password` generó el hash y rechazó una contraseña de menos de 12 caracteres.

### Archivos afectados

- **Modificados:** `restaurante/{.env.example,.gitignore,README.md,package.json}`; `src/{app.js,server.js,config/env.js,controllers/landing.js,routes/index.js}`; `src/content/{common,molotes,birria}/index.js`; `src/views/landings/{index,molotes,birria,shared}.js`; `tests/{helpers.js,integration/app.test.js,unit/config.test.js,unit/content.test.js,unit/landing-dom.test.js,unit/landing.test.js}`.
- **Eliminados:** `src/content/{molotes,birria}/menu.js`.
- **Nuevos:**
  - `src/content/{molotes,birria}/seed.json` y `src/content/seeds.js`;
  - `src/repositories/*`;
  - `src/services/{menu-schema,price,visible-menu,admin-form,menu-diff,admin-auth,session-store,login-throttle}.js`;
  - `src/utils/{datetime,form-body}.js`, `src/middleware/admin-guard.js`, `src/controllers/admin.js` y `src/routes/admin.js`;
  - `src/views/admin/**`, `src/views/partials/{molotes,birria}/section-empty.html` y `src/styles/admin/main.css`;
  - `scripts/hash-password.js`;
  - `tests/support/admin.js`, `tests/snapshots/landing-{molotes,birria}.html`, `tests/integration/admin.test.js` y 11 archivos nuevos en `tests/unit/`.

### Correcciones (ronda 1 de QA)

**DEF-001 (BLOCKER), corregido.** Causa: Helmet envía `Referrer-Policy: no-referrer` y, con esa política, el navegador manda `Origin: null` en los POST de formulario. `assertSameOrigin` rechazaba `null`.

Cambios en `src/middleware/admin-guard.js`:

1. **`assertSameOrigin`:**
   - `Sec-Fetch-Site`, si llega, debe ser `same-origin`. Es una cabecera que pone el navegador y otro sitio no puede falsear.
   - Un `Origin` concreto debe ser el propio, aunque `Sec-Fetch-Site` diga `same-origin`.
   - `Origin: null` solo se acepta si el navegador confirma `Sec-Fetch-Site: same-origin`; sin esa cabecera, o con `cross-site` o `same-site`, se rechaza.
   - Sin ninguna de las dos cabeceras (clientes que no son navegador) decide el token.
   - El token CSRF sincronizador y la cookie `SameSite=Strict` siguen siendo el control principal.
2. **`Referrer-Policy: same-origin` solo en `/admin`.** Así el navegador envía el `Origin` real a este mismo sitio, sin filtrar el referrer a terceros, porque la administración no enlaza a otros sitios. Las landings conservan `no-referrer`. Las dos medidas se complementan: aunque una política más estricta vuelva a producir `Origin: null`, el acceso sigue funcionando gracias a `Sec-Fetch-Site`.

**Pruebas nuevas** en `tests/integration/admin.test.js`:
- flujo completo (acceso, guardar, restaurar y cerrar sesión) con `Origin: null` + `Sec-Fetch-Site: same-origin`;
- `Origin` real con `same-origin`;
- rechazo, en acceso y en guardado y sin escribir nada, de seis combinaciones: origen ajeno con `cross-site`, sin `Sec-Fetch-Site` o con `same-origin`, y `Origin: null` con `cross-site`, con `same-site` o sin `Sec-Fetch-Site`;
- `Referrer-Policy: same-origin` en `/admin` y `no-referrer` en las landings.

**Verificación en un navegador real** (Chrome headless local por DevTools Protocol, servidor real con `DATA_DIR` temporal): acceso, guardado y cierre de sesión respondieron 303. Se vio "Cambios guardados.", la landing mostró el texto nuevo y el log registró 0 `admin_csrf_rejected`.

**Observaciones no bloqueantes: sin cambios, porque no contradicen el ticket.**
- *El quinto fallo ya responde 429.* CA-21 exige el bloqueo en el intento posterior a 5 fallos, y así ocurre. Avisar del bloqueo en el quinto fallo es más claro para el usuario y no revela si las credenciales eran correctas.
- *`changes: []` al restaurar desde el estado dañado.* El registro compara la versión que mostraba la landing con la restaurada. Si la landing ya mostraba esa versión anterior, no cambió ningún campo visible. El contenido dañado no se puede comparar porque no es válido. La acción, el autor y la fecha sí quedan registrados (RF-6.3).

**Validaciones:**
- `npm test`: 23 archivos, **429 de 429** en verde (incluye la prueba de QA `admin-file-repository.test.js`).
- `npm run lint`: lint no configurado.
- No se tocaron estilos ni plantillas, así que no hizo falta `build:css`.

**Archivos:** `restaurante/src/middleware/admin-guard.js`, `restaurante/tests/integration/admin.test.js` y `restaurante/README.md` (sección Seguridad).

### Riesgos o pendientes

- **Revisión visual y de contraste sin hacer.** No se revisó la administración en un navegador (no hay diseño fuente, C-8). Los colores elegidos (slate-700/800/900 sobre blanco, red-800/red-900, blue-800 con texto blanco) cumplen AA según la paleta de Tailwind, pero conviene que QA lo verifique, junto con el aviso de sección vacía de cada landing.
- El `.env` local del usuario no se modificó: la administración queda deshabilitada en desarrollo hasta definir `ADMIN_USER` y `ADMIN_PASSWORD_HASH`.
- **Producción:** `DATA_DIR` absoluta (p. ej. `/var/lib/restaurante`) con permisos de escritura para el usuario del proceso, `TRUST_PROXY=true` y nginx con `Host`, `X-Forwarded-Proto` y `X-Forwarded-For` (hay un ejemplo en el README).
- RT-2 a RT-4 siguen vigentes, con documentación en el README: sesiones en memoria, `changes.jsonl` sin rotación y ediciones manuales que se aplican al reiniciar.
- `tests/snapshots/` fija el HTML de las landings con la semilla. Un cambio visual intencional futuro exigirá regenerarlo con `vitest -u`.

## QA Action Plan

### Objetivo

Validar con evidencia ejecutada (no por inspección de código) que la implementación de REQ-F-001 cumple CA-1 a CA-39, que las landings `/`, `/molotes` y `/birria` no sufren regresiones con la semilla, y que la administración `/admin/molotes` y `/admin/birria` es segura, accesible y usable en móvil y escritorio.

### Requisito bajo prueba

RF-1 a RF-10, RN-1 a RN-8, decisiones C-1 a C-15, propuestas P-1 a P-9 y el Technical Action Plan aprobado (DT-1 a DT-8), con los ajustes técnicos 1 a 6 de "Implementation Result".

### Entorno de prueba

- Rama `feature/REQ-F-001-menu-precios-configurables`, desde `restaurante/`.
- Servidor real (`node --env-file-if-exists=.env src/server.js`) en puerto libre (3100, y 3101/3102 para escenarios de arranque aislados), con variables pasadas por el entorno del proceso, **sin modificar `.env`**:
  - `DATA_DIR=<scratchpad>/data-*` (carpeta temporal nueva por escenario);
  - `ADMIN_USER=qa-admin` y `ADMIN_PASSWORD_HASH` generado con `npm run admin:hash-password` para una contraseña de prueba de 12+ caracteres (se guarda solo en el scratchpad);
  - `NODE_ENV=development` (HTTP permitido) salvo en el escenario DT-3.
- Pruebas de caja negra HTTP con `curl` (cookie jar, extracción del `_csrf` del HTML) contra el servidor real con el **repositorio de archivos real**, complementando las pruebas automatizadas que usan el repositorio en memoria.
- Navegador: Claude in Chrome, pestaña nueva; viewports 375x812, 768x1024 y 1440x900.
- Los servidores se detienen al terminar; las carpetas temporales quedan solo en el scratchpad.

### Criterios de aceptación (cada uno -> pruebas que lo cubren)

| CA | Pruebas |
| -- | ------- |
| CA-1, CA-2, CA-3, CA-15 | AT (suite) + F-3 (guardar por la administración y verificar el texto exacto en `/molotes` y `/birria`: "$50 c/u", "$199.50 MXN", "$45.50", destacado y promoción) |
| CA-4 | AT (`landing-snapshot.test.js`) + F-1 (arranque con `DATA_DIR` vacío: creación de `current.json` y `previous.json`, log `menu_data_seeded`) + R-1 (comparación del HTML servido por el servidor real con `tests/snapshots/`) + B-1 visual |
| CA-5, CA-6, CA-7, CA-8, CA-9 | AT + F-4 (ocultar desde la administración y verificar HTML, orden, variante activa `aria-pressed`, precio y descripción) + B-2 (aviso de sección vacía en 3 viewports en ambas landings) |
| CA-10 a CA-14 | AT (`price.test.js`, `admin-form.test.js` con todos los precios) + N-1 (muestra en servidor real: un precio de cada tipo con 0, 0.00, 0.01, 5000, 5000.00, 5000.01, 45.505, -10, abc, vacío, y verificación de que `current.json` no cambia byte a byte cuando se rechaza) |
| CA-16, CA-17 | AT + N-2 (ruta inexistente, sin `/img/`, con `..`, `.gif`, `%2e%2e`; alt vacío; ancho 0, 4001, 1.5; tono inválido; icono `Local-Bar`; cantidad 0 y 21; texto de longitud máxima y máxima+1 con acentos/emoji) |
| CA-18 | AT + N-3 (peticiones manipuladas: `slug`/`id`/`detailsType` cambiados u ordenados distinto, índice extra o faltante, campo desconocido, campo repetido) -> 400 sin escritura |
| CA-19 | AT + N-1/N-2 (HTML 422 conserva lo escrito, `aria-invalid`, `aria-describedby`, prefijo "Error:", resumen `role="alert"` con enlaces) + B-4 visual |
| CA-20 | AT + S-1 (GET sin sesión -> 303 a login con `next`; POST sin sesión -> sin escritura) |
| CA-21 | AT + S-2 (5 fallos -> 6.º intento bloqueado con 429 incluso con credenciales correctas; mensaje genérico idéntico para usuario o contraseña incorrectos) |
| CA-22 | AT (caducidad de 2 h con reloj controlado) + S-3 (acceso a ambos negocios, logout y nueva redirección; sesión reutilizada tras logout rechazada) |
| CA-23 | AT + S-4 (POST sin `_csrf`, con `_csrf` de otra sesión, con `Origin` ajeno y `Sec-Fetch-Site: cross-site`) -> 403 `CSRF_INVALID` sin escritura |
| CA-24 | AT + S-5 (arranque sin `ADMIN_*`: landings 200, `/admin*` 503 `ADMIN_UNAVAILABLE`, log `admin_disabled`; con solo una de las dos variables o hash mal formado: arranque falla con `ConfigError`) |
| CA-25 | AT + S-6 (cabeceras `Cache-Control: no-store`, `X-Robots-Tag`, `<meta name="robots">` en todas las respuestas `/admin*`, incluidos 303/403/422/503; `grep` de `/admin` en el HTML de `/`, `/molotes`, `/birria`) |
| CA-26 | AT + S-7 (`grep` de la contraseña, del hash, del token CSRF y del id de sesión en la salida completa del servidor tras todos los escenarios) |
| CA-27 | AT + F-3 (inspección real de `current.json`, `previous.json` y `changes.jsonl`: fecha ISO con offset del negocio, autor, negocio, acción y campos antes/después; landing actualizada sin reinicio) |
| CA-28 | AT + N-4 (autor vacío y solo espacios al guardar, al restaurar anterior y al restaurar semilla) |
| CA-29 | AT (`file-menu-repository.test.js` con fallos inyectados en `rename` y escritura). En caja negra solo se verifica que no quedan `.tmp` huérfanos tras guardados normales. |
| CA-30 | AT + F-5 (página de confirmación GET, POST con autor, intercambio real de `current.json`/`previous.json`, landing y registro) |
| CA-31 | AT + F-3/B-3 ("Último cambio: <fecha> por <nombre>" tras guardar; comportamiento con la semilla recién creada) |
| CA-32, CA-33 | AT + F-6 (dos cookie jars A y B sobre `/admin/birria`: 409 con quién y cuándo; "Guardar de todos modos" -> datos de B, `previous.json` = A, acción `overwrite_after_conflict`; "Descartar" -> datos de A sin escritura; tercer guardado intercalado -> nuevo aviso) |
| CA-34, CA-35, CA-37 | AT + F-7 (arranque con `current.json` de sintaxis inválida y `previous.json` válido; igual sin `previous.json` válido; JSON válido con precio 600000 centavos): servidor arranca, `/molotes` 200 con la fuente correcta, `damaged-<fecha>.json` conservado, `damaged.marker.json`, log `menu_data_damaged` sin rutas absolutas ni contenido |
| CA-36 | AT + F-7/F-8 (aviso, opciones visibles según validez de la anterior, `<fieldset disabled>`, POST de guardado rechazado por el servidor, elección registrada y desbloqueo; el marcador sobrevive a un reinicio; daño con el servidor en marcha: landing sigue con la caché) + B-5 visual |
| CA-38 | AT (`menu-repository-contract.test.js` y suites con `createMemoryMenuRepository`); verificación de que las pruebas de controladores/landings no usan el repositorio de archivos |
| CA-39 | AT (`content.test.js` sobre la semilla) + D-1 (revisión de README y `.env.example`: variables, ubicación, semilla, versión anterior, registro, recuperación, hash) |

AT = suite automatizada existente (`npm test`).

### Riesgos identificados

- **R-QA-1:** las pruebas de administración usan el repositorio en memoria; el flujo HTTP completo con el repositorio de archivos real (guardar, conflicto, restaurar, dañado en marcha) no tiene prueba automatizada de extremo a extremo. Se cubre con F-3 a F-8 en el servidor real.
- **R-QA-2:** refactor amplio (unos 40 archivos): riesgo de regresión en la selección de landing por día, WhatsApp, selector de variantes y SEO.
- **R-QA-3:** el aviso de sección vacía y la administración no tienen diseño fuente (C-8): se valida coherencia con los tokens de cada landing, contraste y responsive, no conformidad con Stitch.
- **R-QA-4:** el CTA reutiliza texto blanco sobre `#25D366`, cuyo contraste es bajo para texto pequeño. Es el estilo existente del diseño fuente en los CTA actuales; se medirá y, si no cumple AA, se reportará como observación preexistente heredada, no como defecto de este ticket, salvo que el aviso nuevo empeore el caso.
- **R-QA-5:** seguridad (CSRF, `next` como redirect abierto, path traversal, límites de body, fijación de sesión, `X-Forwarded-For` falseado).
- **R-QA-6:** cálculo de fechas del registro y "Último cambio" en la zona horaria del negocio con el servidor en otra zona.

### Pruebas funcionales

- **F-1 Primera ejecución:** `DATA_DIR` vacío -> estructura creada, semilla copiada a `current.json` y `previous.json`, log `menu_data_seeded`, landings 200.
- **F-2 Acceso:** login correcto, navegación entre negocios con `aria-current`, `GET /admin` -> 303 a `/admin/molotes`.
- **F-3 Guardado (ambos negocios):** editar precio unitario, precio por orden, cantidad, bebida, hero, destacado, promo (Molotes) y producto, variante, chips, porción, hero y club (Birria). Verificar 303 (PRG) a `?ok=`, mensaje `role="status"`, recarga sin reenvío, archivos en disco, `changes.jsonl`, landing en la siguiente petición y "Último cambio".
- **F-4 Disponibilidad:** CA-5 a CA-9 desde la administración, incluida la sección de bebidas vacía y la sección de menú vacía en cada negocio.
- **F-5 Restaurar versión anterior:** confirmación, intercambio y registro (CA-30).
- **F-6 Conflicto:** CA-32 y CA-33.
- **F-7 Archivo dañado al arrancar:** CA-34, CA-35, CA-37 y CA-36, con reinicio intermedio para comprobar el marcador.
- **F-8 Archivo dañado en marcha:** corromper `current.json` con el servidor arrancado -> landing sigue 200 con los últimos datos, la administración muestra el aviso y bloquea; restaurar semilla desbloquea.
- **F-9 Edición manual válida (P-6):** editar a mano `current.json` con el servidor arrancado -> no se ve hasta reiniciar; tras reiniciar sí.

### Pruebas negativas y casos límite

- **N-1** precios límite (ver CA-10 a CA-14), con comparación de hash del archivo antes y después.
- **N-2** validaciones de imagen, alt, dimensiones, tono, icono, cantidad y longitudes (P-1).
- **N-3** peticiones manipuladas de estructura y campos (CA-18); casilla con valor distinto de `on`.
- **N-4** autor vacío (CA-28).
- **N-5** body > 128 KB -> 413; `Content-Type` JSON -> 415; más de 600 campos.
- **N-6** `:negocio` desconocido -> 404; `next=https://evil.example` y `next=//evil.example` -> redirección solo a rutas de administración conocidas.
- **N-7** restaurar semilla fuera del estado dañado -> rechazado (DT-8).
- **N-8** botón Atrás tras logout: la página de administración no se sirve de caché (cabecera `no-store`, verificado en navegador).

### Pruebas responsive

- **B-1** `/molotes` y `/birria` con la semilla en 375x812, 768x1024 y 1440x900: sin overflow horizontal (`scrollWidth <= clientWidth`), CTA de WhatsApp visible sin scroll en móvil, sin diferencias frente a la versión previa.
- **B-2** aviso de sección vacía (menú y bebidas en Molotes, menú en Birria) en los 3 viewports: sin overflow, texto completo, CTA alcanzable y área táctil >= 44 px.
- **B-3/B-4/B-5** administración (login, formulario, errores, conflicto, dañado, confirmación) en 375x812 y 1440x900; 768x1024 en el formulario principal.

### Pruebas de accesibilidad

- Landings: un solo `h1`, jerarquía de encabezados y landmarks sin cambios; aviso de sección vacía dentro de la lista/grid con texto legible y CTA con nombre accesible.
- Administración: `<label>` asociado a cada control, `<fieldset>`/`<legend>` por producto, foco visible al tabular todo el formulario, orden de tabulación lógico, resumen de errores con foco/enlaces, `aria-invalid` y `aria-describedby`, "Error:" textual, `role="alert"`/`role="status"`, `autocomplete` en login, idioma `lang="es"`, `aria-current` en la navegación.
- Contraste medido (cálculo WCAG con colores computados en el navegador) de: texto y botones de la administración, mensajes de error, avisos de conflicto y dañado, y aviso de sección vacía de cada landing. Umbral AA: 4.5:1 texto normal, 3:1 texto grande y componentes.

### Pruebas UX/UI (vs. _stich_source_/)

- Landings con la semilla: comparación visual contra `_stich_source_/` (móvil y escritorio) para confirmar que no hay cambios respecto al diseño.
- Aviso de sección vacía y administración: sin diseño fuente (C-8). Se valida que el aviso use los tokens de cada landing y que la administración sea sencilla y consistente (sin evaluar estética).

### Pruebas de integración (WhatsApp)

- `href`, `target="_blank"` y `rel="noopener noreferrer"` del CTA del aviso de sección vacía iguales a los demás CTA de la misma landing, en ambas landings. No se sigue el enlace.
- Los CTA existentes (header, hero, flotante) sin cambios.

### Pruebas de performance

- Las landings no leen disco por petición: verificación con `fs_usage`/`opensnoop` no disponible sin privilegios, por lo que se comprueba por comportamiento (F-9: una edición manual no se refleja hasta reiniciar) y por cronometrar 50 peticiones a `/molotes`.
- `main.css` de admin no se carga en las landings; las landings no cargan JS nuevo; la administración no carga JS. Consola del navegador sin errores ni violaciones de CSP en landings y administración.

### Pruebas SEO

- `title`, meta description, canonical, Open Graph y encabezados de `/molotes` y `/birria` idénticos a la línea base (cubierto por el snapshot y R-1).
- Administración: `noindex, nofollow` en meta y cabecera.

### Pruebas de regresión

- **R-1** HTML de `/molotes` y `/birria` del servidor real con `DATA_DIR` recién sembrado idéntico a `tests/snapshots/`.
- **R-2** `GET /` con fecha simulada en lunes, viernes 23:59, sábado 00:00, domingo 23:59 y lunes 00:00 (`America/Mexico_City`, con `TZ` del proceso distinto): cubierto por `business-schedule.test.js` y `landing.test.js` en la suite; además `GET /` en el servidor real para el día actual.
- **R-3** selector de variantes de Birria en el navegador (cambio de precio y descripción, `aria-pressed`) con todas las variantes y con una variante oculta.
- **R-4** suite completa `npm test`.
- **R-5** `git diff main --stat`: ningún archivo ajeno al ticket ni dependencias nuevas en `package.json`.

### Pruebas de seguridad

- **S-1 a S-7** según la tabla de CA.
- **S-8** fijación de sesión: el id de `admin_sid` cambia al iniciar sesión; atributos `HttpOnly`, `SameSite=Strict`, `Path=/admin`.
- **S-9** `NODE_ENV=production` sin `TRUST_PROXY`, por HTTP: `/admin*` 503 con log `admin_requires_https`; con `TRUST_PROXY=true` y `X-Forwarded-Proto: https`: funciona y la cookie lleva `Secure`.
- **S-10** con `TRUST_PROXY=true`, un `X-Forwarded-For` falseado por el cliente no permite evadir el bloqueo de intentos.
- **S-11** respuestas de error sin rutas absolutas, stack ni contenido del JSON.
- **S-12** XSS almacenado: guardar `<script>alert(1)</script>` y `"><img src=x onerror=...>` en un nombre y una descripción -> escapado en la landing y en la administración (se verifica el HTML, sin ejecutar diálogos en el navegador).

### Pruebas automatizadas

- Existentes: `npm run build:css` y `npm test` completos (se espera 416 en verde); revisión de que cada CA citado en "Implementation Result" tiene realmente una aserción que lo cubre.
- Nueva (solo con aprobación de este plan): `restaurante/tests/integration/admin-file-repository.test.js`, con Supertest sobre `createApp` y el **repositorio de archivos real** en un directorio temporal, para cubrir de extremo a extremo R-QA-1: guardar -> archivos y landing (CA-27), conflicto con sobrescritura (CA-33), restaurar anterior (CA-30) y daño en marcha con restauración de semilla (CA-36, RF-8.5). No modifica código de producción ni agrega dependencias.
- `npm run lint` no se cuenta como evidencia (placeholder).

### Pruebas en navegador

B-1 a B-5, R-3, N-8, contraste, foco y consola, con capturas como evidencia. Si la extensión no responde tras 2-3 intentos, la parte visual queda como pendiente de revisión manual del usuario; los CA no dependen exclusivamente del navegador salvo la parte de "contraste y foco" de la administración y el aviso de sección vacía, en cuyo caso se devolvería `NEEDS_USER_DECISION`.

### Evidencia requerida

- Salida de `npm run build:css` y `npm test`.
- Transcripción de las peticiones `curl` relevantes (código HTTP, cabeceras, fragmentos de HTML) y contenido de `current.json`, `previous.json`, `changes.jsonl`, `damaged-*.json` y `damaged.marker.json`.
- `grep` del log del servidor (CA-26, eventos de RF-10).
- Capturas por viewport y valores de contraste calculados.
- `git diff main --stat`.

### Criterios de aprobación

- CA-1 a CA-39 en PASS con evidencia.
- `npm test` completo en verde (incluida la prueba nueva, si se aprueba).
- Sin defectos `BLOCKER` ni `CRITICAL`; defectos `MAJOR` solo si el usuario los acepta explícitamente.
- Sin regresiones en las landings (snapshot idéntico, selección por día, WhatsApp, variantes, SEO).
- Contraste AA y foco visible en la administración y en el aviso de sección vacía (salvo la observación preexistente R-QA-4, que se reporta aparte).

## QA Report

### Ronda

1 (2026-10-02). QA Action Plan aprobado por el usuario: "apruebo el plan, sí a la prueba nueva, acepto".

### Pruebas ejecutadas

| Prueba | Resultado real |
| ------ | -------------- |
| `npm run build:css` | OK (molotes, birria, admin). |
| `npm test` (antes de la prueba nueva) | 22 archivos, 416/416 en verde. |
| Prueba nueva `tests/integration/admin-file-repository.test.js` (4 casos: CA-27, CA-33, CA-30, CA-36/RF-8.5 con el repositorio de archivos real) | 4/4 en verde. |
| `npm test` (final) | 23 archivos, **420/420** en verde. |
| `npm run lint` | Placeholder, no cuenta como evidencia. |
| Caja negra HTTP (fetch + cookies, sin Origin) contra el servidor real, `DATA_DIR` temporal, `TZ=Asia/Tokyo`, `.env` sin tocar | Precios límite: 64/64 casos. Otras validaciones y estructura: 64/64. Disponibilidad, restauración y conflicto: 17/17 (2 fallos iniciales eran errores del script de QA; se verificaron a mano). Seguridad: 29/29. Daño en marcha: 12/12. |
| Arranque con datos dañados (A: JSON inválido con anterior válida; B: sin anterior válida; C: precio 600000 centavos) y reinicio con marcador | Los 3 arrancan; `/molotes` 200 con anterior / semilla / anterior; `damaged-<fecha>.json` y `damaged.marker.json` creados; el marcador sobrevive al reinicio. |
| Configuración: sin credenciales, credencial parcial, hash inválido, `DATA_DIR` relativo en producción o dentro de `src/`/`public/` | Comportamiento según DT-4 y DT-7. |
| Producción: HTTP sin `TRUST_PROXY`, `TRUST_PROXY=true` con `X-Forwarded-Proto`, `X-Forwarded-For` falseado | Según DT-3 y el ajuste 4. |
| Línea base: HTML de `/molotes` y `/birria` renderizado desde `main` (worktree temporal) frente a la rama, con el mismo `.env` | Idéntico byte a byte. CSS: solo se añaden `.col-span-full` y `.p-8`. |
| Navegador: Claude in Chrome no conectado tras 3 intentos. Se usó Chrome headless local (perfil aislado en el scratchpad) mediante DevTools Protocol | Ver Responsive, Accesibilidad, UX/UI y DEF-001. |

### Criterios de aceptación

| CA | Estado | Evidencia |
| -- | ------ | --------- |
| CA-1, CA-2, CA-3, CA-15 | PASS (HTTP) | Tras guardar: "$50 c/u", "$199.50 MXN", "$45.50"; destacado, badge, título y descripción de la promoción nuevos en la landing. |
| CA-4 | PASS | Primera ejecución: `current.json` y `previous.json` por negocio, log `menu_data_seeded`; HTML idéntico a `main` y a `tests/snapshots/`. |
| CA-5 a CA-9 | PASS | Huitlacoche oculto y orden conservado; Refrescos oculto; solo "Sin Carne", `aria-pressed="true"`, "$45 MXN" y su descripción (también en Chrome); Birriamen oculto; 2 avisos en Molotes (menú y bebidas) y 1 en Birria, con el texto de RF-4.5 y el mismo `href`, `target` y `rel` que el CTA del hero. |
| CA-10 a CA-14 | PASS (HTTP) | 7 precios de ambos negocios (unitario, por orden, bebida, hero de Molotes, producto, variante y hero de Birria) con 0, 0.00, 5000.01, 45.505, -10, abc, vacío y 1e3: 422, archivo sin cambios (sha256), valor conservado, mensajes "Error: El precio debe ser mayor que $0." / "Error: El máximo es $5,000.00." / "Error: Usa un número con hasta 2 decimales…" / "Error: Escribe un precio.". 0.01, 5000 y 5000.00 aceptados. |
| CA-16, CA-17 | PASS | Ruta inexistente, sin `/img/`, con `..`, `%2e%2e`, `.gif`, espacios: 422. Alt vacío, ancho/alto 0, 4001 y 1.5, tono fuera de lista, icono `Local-Bar`, cantidad 0, 21 y 2.5, y cada longitud máxima + 1 (también con acentos y emoji): 422. Los límites exactos se aceptan. |
| CA-18 | PASS | `slug` cambiado o intercambiado, `detailsType`, campo desconocido, `__proto__`, índice, variante o chip de más o de menos, casilla con valor distinto de `on`, ids de Molotes reordenados: 400 `STRUCTURE_MODIFIED`. Campo repetido: 400 `INVALID_FORM`. El archivo no cambia. |
| CA-19 | PASS | 422 conserva lo escrito; `aria-invalid="true"`, `aria-describedby` con ayuda y error, prefijo "Error:", resumen `role="alert"` con enlaces y foco en el resumen (Chrome). |
| CA-20 | PASS | GET sin sesión: 303 a `/admin/login?next=…`; POST sin sesión: 303 con `expirada=1` y sin escritura. |
| CA-21 | PASS (HTTP) | 4 fallos: 401 con mensaje genérico; el 5.º fallo y los siguientes: 429, también con credenciales correctas; otra IP no queda bloqueada; logs `admin_login_failed`/`admin_login_locked` solo con IP. |
| CA-22 | **FAIL** | Por HTTP sin cabecera Origin funciona (acceso, ambos negocios, cierre de sesión, cookie reutilizada tras el cierre rechazada). En un navegador real **no se puede entrar**: ver DEF-001. La caducidad de 2 h se acepta por las pruebas automatizadas existentes (decisión del usuario). |
| CA-23 | PASS | Sin `_csrf`, con el de otra sesión, alterado, `Origin` ajeno o `Sec-Fetch-Site: cross-site`: 403 `CSRF_INVALID` sin escritura. Pero el control de origen también rechaza a los navegadores legítimos (DEF-001). |
| CA-24 | PASS | Sin credenciales: `/`, `/molotes` y `/birria` 200; `/admin*` 503 `ADMIN_UNAVAILABLE` con `no-store` y `noindex`; log `admin_disabled`. |
| CA-25 | PASS | `Cache-Control: no-store` y `X-Robots-Tag: noindex, nofollow` en 200/303/403/503; `<meta name="robots">`; `/`, `/molotes` y `/birria` sin `/admin`. |
| CA-26 | PASS | 6 logs (591 líneas): 0 apariciones de la contraseña, del hash, de valores de 43 caracteres (id de sesión/CSRF) ni de claves `password`/`_csrf`/`admin_sid`; sin rutas absolutas. |
| CA-27 | PASS (HTTP) | `current.json` con los datos nuevos, `previous.json` con los anteriores, revisión +1, `changes.jsonl` con `at` ISO en -06:00, `author`, `business`, `action` y `changes` antes/después; landing actualizada sin reiniciar; sin `.tmp` huérfanos. |
| CA-28 | PASS | Autor vacío, solo espacios o de 61 caracteres: 422 al guardar, al restaurar la anterior y al restaurar la semilla. |
| CA-29 | PASS (automatizada) | `file-menu-repository.test.js` con fallos inyectados (aceptado por el usuario). |
| CA-30 | PASS (HTTP) | Confirmación GET, POST con autor: `current` y `previous` intercambiados, landing con la versión anterior, registro `restore_previous`. |
| CA-31 | PASS | "Último cambio: 02/10/2026 18:22 por Ana QA"; con la semilla, "ninguno (datos originales)". |
| CA-32, CA-33 | PASS (HTTP; en Chrome con el workaround de QA) | 409 con "Ana A guardó otra versión el …", ambas opciones, formulario de B conservado; "Descartar" muestra los datos de A sin escribir; sobrescribir con versión obsoleta: nuevo 409 (RN-6); sobrescribir: datos de B, A como anterior, `overwrite_after_conflict`. |
| CA-34, CA-35, CA-37 | PASS | Escenarios A, B y C de arranque (ver tabla anterior); log `menu_data_damaged` sin contenido ni rutas. |
| CA-36 | PASS (HTTP) | Aviso con la fuente correcta, `<fieldset disabled>`, guardado rechazado por el servidor (409), opción "Restaurar versión anterior" solo si es válida (escenario B: solo la semilla), elección registrada (`restore_previous` / `restore_seed`), marcador borrado y edición desbloqueada; también con daño en marcha (RF-8.5: la landing sigue idéntica). |
| CA-38 | PASS | Suites de controladores y landings con `createMemoryMenuRepository`; `menu-repository-contract.test.js`. |
| CA-39 | PASS | `content.test.js` valida la semilla; README (secciones Menús, Administración, Seguridad, Archivos de datos, Recuperación) y `.env.example` documentan las variables nuevas. |

### Defectos encontrados

### DEF-001
- Severidad: BLOCKER
- Criterio de aceptación afectado: CA-22 (y, en la práctica, todo uso de la administración: CA-27, CA-28, CA-30, CA-32, CA-33 y CA-36 desde un navegador; RF-5.10 y el Resultado esperado de HU-1 a HU-7).
- Descripción: en un navegador real, todas las peticiones POST de la administración (acceso, guardar, cerrar sesión, restaurar) se rechazan con 403 `CSRF_INVALID`. El sitio envía `Referrer-Policy: no-referrer` (Helmet). Con esa política, el estándar Fetch obliga al navegador a enviar `Origin: null` en los POST de formulario. `assertSameOrigin` (`src/middleware/admin-guard.js`, líneas 66-70) rechaza cualquier `Origin` distinto de `<protocolo>://<host>`, también `null`. Las pruebas automatizadas no lo detectan porque Supertest no envía `Origin`.
- Pasos para reproducir:
  1. Arrancar con `ADMIN_USER` y `ADMIN_PASSWORD_HASH` válidos.
  2. Abrir `http://localhost:<puerto>/admin/login` en Chrome.
  3. Escribir las credenciales correctas y pulsar "Entrar".
- Resultado esperado: 303 a `/admin/molotes` con la sesión iniciada.
- Resultado actual: 403 con `{"error":{"code":"CSRF_INVALID","message":"La petición no es válida. Recarga la página e inténtalo de nuevo."…}}`. El log del servidor registra `admin_csrf_rejected` con `reason: "origin"`.
- Evidencia:
  - Chrome 154 headless: el login respondió 403 `CSRF_INVALID`.
  - Servidor de eco local: un formulario POST desde una página con `Referrer-Policy: no-referrer` envía `origin= null sec-fetch-site= same-origin`; la misma página sin esa cabecera envía `origin= http://localhost:3199`.
  - `curl -H "Origin: null" -H "Sec-Fetch-Site: same-origin" … /admin/login` devuelve 403, y con `Origin: http://localhost:3101` devuelve 401 (credenciales de prueba incorrectas, es decir, pasa el control de origen).
  - Las cabeceras de `/admin/login` incluyen `Referrer-Policy: no-referrer`.
  - Al forzar en Chrome `Origin: http://localhost:3101` (solo como workaround de QA, por DevTools), el acceso, el guardado, los errores, el conflicto y la sobrescritura funcionan.
- Impacto: la administración no se puede usar desde ningún navegador conforme al estándar (Chrome, Edge, Firefox y Safari aplican la misma regla), ni en desarrollo ni en producción detrás de nginx. El dueño no puede cambiar precios ni la disponibilidad. Las landings no se ven afectadas.
- Recomendación: la validación de origen debe aceptar las peticiones legítimas de mismo origen que el navegador envía con la política de referrer configurada, sin debilitar la protección frente a orígenes ajenos (CA-23). Conviene añadir una prueba automatizada que envíe las cabeceras que manda un navegador real (`Origin: null` y `Sec-Fetch-Site: same-origin`) y otra con un origen ajeno.

### Regresión

- HTML de `/molotes` y `/birria` idéntico byte a byte a `main` y a `tests/snapshots/`.
- `GET /` con el proceso en `TZ=Asia/Tokyo` (sábado allí, viernes en CDMX) muestra Molotes. Transiciones (llamadas directas a `getActiveBusinessId` con `TZ=Asia/Tokyo`): viernes 23:59:59 → molotes; sábado 00:00 → birria; domingo 23:59:59 → birria; lunes 00:00 → molotes. `business-schedule.js` no cambia en esta rama.
- Selector de variantes en Chrome: cambia `aria-pressed` y el precio ($80 → $45); con una variante oculta, la restante está activa.
- WhatsApp: header, hero, banner y flotante sin cambios; el `href` del aviso de sección vacía coincide con el del hero en ambas landings.
- `git diff main --stat`: 25 archivos modificados más los nuevos del ticket. `package.json` solo añade scripts, sin dependencias nuevas.

### Responsive

- Landings con la semilla y con secciones vacías, en 375x812, 768x1024 y 1440x900: sin overflow horizontal, un solo `h1`, sin imágenes rotas ni deformadas; CTA de header, hero y flotante visibles sin scroll en móvil (Molotes); en Birria móvil, hero y flotante visibles.
- Aviso de sección vacía: sin overflow; CTA de 48 px de alto.
- Administración (acceso, formularios de ambos negocios, errores, conflicto, confirmación y datos dañados) en 375 y 1440, y el formulario en 768: sin overflow horizontal.

### Accesibilidad

- Administración: `lang="es-MX"`, un `h1`, landmarks `header`/`nav`/`main`, enlace "Saltar al contenido", todos los controles con `<label>`, `aria-current` en la navegación y sin `<script>`.
- Foco visible al tabular: enlaces y botones con outline de 3 px azul; inputs con borde y anillo azules; casillas con anillo de 4 px.
- Contraste mínimo medido en la administración: 8.36:1 (mensajes de error) y 8.82:1 en el resto. Ningún texto por debajo de AA.
- Casillas de 20x20 px con etiqueta de 20 px de alto (por debajo de 24 px): observación menor, no es un criterio del ticket.
- Aviso de sección vacía: texto 10.35:1 en Molotes y 9.18:1 en Birria.
- **Observación heredada (no es defecto de este ticket):** el texto blanco sobre `#25D366` de todos los CTA de WhatsApp da 1.98:1. Viene de `_stich_source_/`, ya existía en los CTA anteriores y el aviso nuevo lo reutiliza sin empeorarlo.

### UX/UI

- Las landings con la semilla no cambian frente a `main`.
- El aviso de sección vacía usa los estilos de cada landing (tarjeta blanca en Molotes; gradiente granate en Birria) y se ve correctamente en las capturas.
- La administración es sencilla y legible. Avisos de conflicto y de datos dañados con botones claros. Capturas en el scratchpad de la sesión de QA (`shots/`).

### Performance

- 50 peticiones secuenciales a `/molotes`: 0.42 s en total.
- Una edición manual válida no se refleja hasta reiniciar (confirma que no hay E/S por petición).
- Las landings no cargan `css/admin/main.css` (20 KB) y no incluyen scripts nuevos.
- Consola de Chrome en landings y administración: sin errores de JS ni de CSP. El único 404 es `/favicon.ico`, que ya existía en `main`.

### SEO

- `title`, meta description, canonical y Open Graph de las landings sin cambios (HTML idéntico a `main`).
- La administración lleva `noindex, nofollow` en la cabecera y en `<meta>`.

### Pendientes de revisión manual

- Claude in Chrome no estaba conectado; la validación visual se hizo con Chrome headless local. Si se desea, el usuario puede revisarla en su navegador después de corregir DEF-001.
- Observaciones sin impacto en los CA:
  1. en `NODE_ENV=development` las respuestas JSON de error incluyen `stack` (comportamiento previo de `error-handler.js`, solo en desarrollo; en producción se verificó que no aparece);
  2. el quinto intento fallido ya responde 429 con el mensaje de bloqueo;
  3. la entrada de registro de una restauración desde el estado dañado tiene `changes: []`, porque no existe un contenido válido con el que comparar.

### Resultado final

QA_REJECTED

### Ronda 2 (2026-10-02) — revalidación de DEF-001

El usuario aprobó la corrección; cita textual: "Si la apruebo". El alcance acordado con el usuario fue revalidar DEF-001, CA-20 a CA-23, el snapshot de las landings y `npm test` completo. Los resultados de la ronda 1 se conservan arriba.

#### Qué cambió

- `src/middleware/admin-guard.js`:
  - `Origin: null` solo se acepta si llega con `Sec-Fetch-Site: same-origin`;
  - un `Origin` concreto debe ser el propio;
  - si llega `Sec-Fetch-Site`, debe ser `same-origin`;
  - `/admin` envía `Referrer-Policy: same-origin`.
- Pruebas nuevas en `tests/integration/admin.test.js` y ajuste de la sección Seguridad del README.

#### Pruebas ejecutadas

| Prueba | Resultado real |
| ------ | -------------- |
| `npm run build:css` | OK. |
| `npm test` | 23 archivos, **429/429** en verde. Incluye las 4 pruebas de "Origin null" y `admin-file-repository.test.js` de la ronda 1. |
| Snapshot | El HTML de `/molotes` y `/birria` servido por el servidor real con `DATA_DIR` nuevo es idéntico byte a byte a `tests/snapshots/`. |
| Cabeceras | `/molotes`: `Referrer-Policy: no-referrer` (sin cambios). `/admin/login`: `Referrer-Policy: same-origin`. |
| Combinaciones de `Origin` y `Sec-Fetch-Site` en `/admin/login` (curl) | Se aceptan: sin cabeceras; `null` + `same-origin`; el origen propio, solo o con `same-origin`. Se rechazan con 403: `null` sin `Sec-Fetch-Site`, o con `cross-site`, `same-site` o `none`; origen ajeno, con y sin `same-origin`; origen propio + `cross-site`; solo `cross-site`. Log: motivos `origin`, `origin_null` y `fetch_site`. |
| Token + `Origin: null` | `null` + `same-origin` + token válido: 303 y guarda. `null` sin `Sec-Fetch-Site` o con `cross-site` y token válido: 403 sin escritura. `null` + `same-origin` con token inválido: 403 sin escritura. |
| Batería de seguridad de la ronda 1 (CA-20 a CA-23, CA-25, cookie, `next`, XSS) contra el servidor de la ronda 2 | 29/29 PASS. |
| Producción (`NODE_ENV=production`, `TRUST_PROXY=true`, `X-Forwarded-Proto: https`) | `Origin: https://localhost:3102`: 303. `Origin: null` + `same-origin`: 303. `Origin: https://evil.example`: 403. |
| Navegador real (Chrome 154 headless, perfil aislado y **sin** forzar cabeceras). Claude in Chrome seguía sin conectar | 13 de 14 comprobaciones del script en PASS. La que marcó FAIL es un error del propio script (recortó el texto antes de "$0"); el resumen de errores sí aparece en pantalla. |

#### DEF-001: verificado en navegador real

| Flujo | Resultado |
| ----- | --------- |
| Acceso | PASS: 303 a `/admin/molotes`. |
| Guardar | PASS: `?ok=save`, "Cambios guardados…", `current.json` con 5250 y la landing muestra "$52.50". |
| Error de validación (precio 0) | PASS: 422 con el resumen `role="alert"`. |
| Conflicto | PASS: aviso "El menú cambió mientras lo editabas…" sin escritura. |
| "Guardar mis cambios de todos modos" | PASS: `?ok=overwrite_after_conflict`; la versión del otro editor queda como anterior. |
| "Descartar y cargar la versión actual" | PASS: muestra la versión vigente y no escribe nada. |
| Restaurar versión anterior (página de confirmación) | PASS: `?ok=restore_previous`, con `current` y `previous` intercambiados. |
| Archivo dañado | PASS: aviso visible; "Restaurar semilla original" da `?ok=restore_seed`, borra el marcador y desbloquea la edición. |
| Cerrar sesión | PASS: vuelve a `/admin/login`, y `/admin/birria` pide acceso de nuevo. |
| CSRF real desde otro origen (formulario en `http://127.0.0.1:3199` hacia `/admin/molotes` y `/admin/logout`, con la sesión iniciada) | PASS: 403 `CSRF_INVALID` (`fetch_site`), el archivo no cambia y la sesión sigue abierta. |

#### Criterios de aceptación

- **CA-22:** pasa de FAIL a **PASS**. Se puede entrar y editar ambos negocios desde el navegador; el cierre de sesión vuelve a pedir acceso. La caducidad de 2 h se cubre con la prueba automatizada (aceptado por el usuario).
- **CA-20, CA-21, CA-23:** PASS.
- **CA-27, CA-30, CA-32, CA-33 y CA-36:** también PASS desde el navegador real.
- **Resto de CA:** sin cambios respecto a la ronda 1, todos en PASS. El código de esos flujos no cambió en esta ronda; la regresión la cubren `npm test` y el snapshot.

#### Defectos

- DEF-001: **cerrado**.
- No hay defectos nuevos.

#### Regresión

- Landings idénticas al snapshot.
- Las landings siguen con `no-referrer`.
- `npm test` completo en verde.
- Consola: solo los 403 esperados del ataque CSRF simulado.
- No se encontraron la contraseña de prueba ni los tokens en el log.

#### Pendientes de revisión manual

- La revisión visual se hizo con Chrome headless porque Claude in Chrome no conectó. Ningún criterio depende solo de esa revisión.
- Las observaciones de la ronda 1 siguen igual: contraste heredado del CTA de WhatsApp, `stack` solo en desarrollo, 429 en el quinto intento y `changes: []` al restaurar desde dañado. Son menores o heredadas y no bloquean.

#### Resultado final (ronda 2)

QA_APPROVED

## Historial de cambios

### Versión 1

Descripción inicial, aprobada por el usuario el 2026-10-02. Incluye:

- las respuestas del usuario a las preguntas de análisis (C-1 a C-15);
- la regla de precios confirmada: centavos permitidos, mayor que $0 y tope de $5,000.00;
- las propuestas P-1 a P-9, aprobadas: longitudes máximas, aviso de sección vacía, sesión e intentos, campo de autor, restaurar versión anterior, ediciones manuales al reiniciar, historial solo en archivo, funcionamiento sin JavaScript y opciones ante archivo dañado.

### Revisión técnica (senior-fullstack) — 2026-10-02

Revisión técnica sin cambios de código. Se agrega el Technical Action Plan, con las decisiones técnicas DT-1 a DT-8 y los riesgos RT-1 a RT-6. El estado pasa a `NEEDS_TECHNICAL_PLAN_APPROVAL` y el ticket permanece en `backlog/`.

### Aprobación del Technical Action Plan — 2026-10-02

El usuario aprobó el plan completo (DT-1 a DT-8). Cita textual: "sí tiene nginx con TLS, lleva el ticket a la rama, apruebo". La VM tiene nginx con TLS delante, así que en producción se usa `TRUST_PROXY=true` (RT-1 resuelto). Se crea la rama `feature/REQ-F-001-menu-precios-configurables` desde `main` y el ticket pasa a `in-progress/` con estado `IN_PROGRESS`.

### Implementación (T2) — 2026-10-02

Implementación completa del Technical Action Plan, con los ajustes técnicos 1 a 6 descritos en "Implementation Result". Pruebas: 416 de 416 en verde; `build:css` OK; lint no configurado. Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

### QA Action Plan (senior-qa, Q1) — 2026-10-02

El usuario aprobó la implementación. Cita textual: "apruebo la implementación, pásalo a QA". Se agrega el QA Action Plan, sin ejecutar todavía la batería definitiva. Estado: `NEEDS_QA_PLAN_APPROVAL`.

### QA (senior-qa, Q2, ronda 1) — 2026-10-02

El usuario aprobó el QA Action Plan, la prueba nueva y la cobertura automatizada de CA-29 y de la caducidad de 2 h de CA-22. Cita textual: "apruebo el plan, sí a la prueba nueva, acepto". Se agregó `restaurante/tests/integration/admin-file-repository.test.js` (4 pruebas). `npm test`: 420/420. Se encontró DEF-001 (BLOCKER): en un navegador real todo POST de la administración se rechaza con 403 `CSRF_INVALID`, porque `Referrer-Policy: no-referrer` hace que el navegador envíe `Origin: null`. Estado: `QA_REJECTED`.

### Corrección de QA ronda 1 (T3) — 2026-10-02

Se corrige DEF-001 (`Origin: null` con `Referrer-Policy: no-referrer`) y se agregan 9 pruebas. Verificado en Chrome headless. 429 de 429 pruebas en verde. Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

### QA (senior-qa, Q2, ronda 2) — 2026-10-02

Revalidación de DEF-001 tras la corrección aprobada por el usuario ("Si la apruebo"). `npm test`: 429/429. Snapshot idéntico. Acceso, guardado, conflicto, restauración, recuperación de datos dañados y cierre de sesión funcionan en navegador real. Los orígenes ajenos y `Origin: null` sin `same-origin` se siguen rechazando. DEF-001 cerrado. Estado: `QA_APPROVED`.

### Commit y Pull Request (T4) — 2026-10-02

El usuario autorizó el commit y el PR. Cita textual: "sí, autorizo el commit y el PR". Commit `ebfdf25`; PR https://github.com/orvigas/negocio/pull/2 contra `main`. Estado: `READY_FOR_MERGE`. El ticket permanece en `in-progress/` hasta que el usuario confirme el merge.
