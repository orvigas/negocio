# REQ-F-025 — Topes de coste, protección contra abuso y lista negra del bot

## Estado

QA_APPROVED

## Aprobación

Aprobado por el usuario (versión 1, fecha 2026-10-14) con "aprobado". Respuestas previas a las preguntas de aclaración: "acepto las recomendaciones".

## Objetivo

Antes de anunciar el bot, acotar el gasto diario y mensual en Meta mediante configuración, impedir que pedidos o mensajes falsos generen gasto, saturen al personal o agoten los recursos de la app, poder bloquear los números que abusen y poder cortar el bot en una emergencia sin editar `.env` ni volver a desplegar.

Origen: hallazgo F-04 de `.claude/docs/reports/OWASP-2026-10-09-auditoria.md` (REQ-F-017 propuesto en la auditoría) y solicitud del usuario del 2026-10-14: "quiero terminar la activación del bot, quiero establecer limite de gastos y protección con blacklisting para numeros que estén generando gasto innecesario".

## Contexto y hechos de partida

**Lo que hay hoy en el código**

- El único tope por número es de 20 mensajes por minuto (`RATE_LIMIT`, `restaurante/src/services/whatsapp-bot/store.ts:15`). El limitador guarda un HMAC del número con una clave por proceso.
- Hay una cola por cliente (`queues`, `orchestrator.ts`) sin máximo global.
- Los mensajes ya vistos se descartan en memoria (`seen`).
- Por cada pedido confirmado se envía una plantilla UTILITY al personal (`notifyStaff`). Si falla, el cliente recibe el contacto directo (D-18 de REQ-F-009).
- El bot es determinista: no usa IA.

**Privacidad y costos**

- Los logs solo llevan el número enmascarado (`maskPhone`).
- Meta no ofrece un límite de gasto configurable para esta cuenta, que se paga con tarjeta.
- No está confirmado si Meta cobra los mensajes de servicio. Supuesto prudente: se cobran 0.0085 USD por mensaje, con 1000 gratis al mes (`restaurante/README.md:624-629`). La plantilla utility también cuesta 0.0085 USD.
- Roles de `/admin`: `admin` y `editor` (REQ-F-007).

## Decisiones

- **D-1 (Excepción a RN-5 y D-17 de REQ-F-009):** el usuario aprueba conservar los números bloqueados, solo de forma seudonimizada y con caducidad (RF-3.6, RF-10).
- **D-2 (Persistencia):**
  - En MySQL: la lista negra, la auditoría, los contadores globales y el estado del interruptor.
  - En memoria: los topes por número, los enfriamientos y la lista "alcanzaron un tope hoy". Se acepta que un reinicio los pierda.
- **D-3 (Mensajes de servicio):** se supone que se cobran. La tarifa y el cupo gratuito son configurables.
- **D-4 (I-5):** el "límite de gasto en Meta" se sustituye por "tarjeta virtual con límite bajo y alertas de facturación". Lo hace el usuario fuera del código; la sesión principal actualizará `pendientes.md`.

## Alcance

RF-1 a RF-10.

## Fuera de alcance

- La activación en Meta: variables `WHATSAPP_BOT_*`, registro del webhook, número real, verificación de la empresa y aprobación de la plantilla.
- La tarjeta virtual y las alertas de facturación de Meta.
- REQ-F-018 (webhook frente a DoS) y REQ-F-024 (límite de intentos y sesión).
- La alerta por WhatsApp al personal cuando se alcanza un tope.
- El tope de mensajes no reconocidos seguidos: lo cubren RF-1.2 y RF-7.
- La deduplicación persistente de ids de mensaje en MySQL (posible ticket futuro).
- Que la landing deje de apuntar al bot mientras está pausado o en silencio.

## Requisitos

Todos los días se cuentan en la zona horaria del negocio (configurable; hoy `America/Mexico_City`). Cada día empieza a las 00:00 y cada mes, el día 1 a las 00:00.

### RF-1. Topes por número de cliente y día

Viven en memoria; un reinicio los pone a cero, y eso se acepta.

- **RF-1.1 Pedidos confirmados** (avisos al personal aceptados por Meta): **3 por número y día**.
  - Si el número ya llegó a 3, al empezar un pedido nuevo recibe un mensaje fijo con el contacto directo del personal de ese negocio y no se toma el pedido.
  - Si el número llega al tope durante una conversación, al confirmar no se envía la plantilla y el cliente recibe el resumen con el contacto directo, como en D-18.
  - Un aviso rechazado por Meta no cuenta como pedido.
- **RF-1.2 Mensajes entrantes procesados:** **60 por número y día**.
  - Al llegar a 60, el número recibe **un único** mensaje fijo de "límite de hoy" con el contacto directo, y no recibe más respuestas ese día.
  - Además queda en la lista negra de forma automática durante 7 días (RF-3.2).
- **RF-1.3** Se mantiene el tope de 20 mensajes por minuto.
- **RF-1.4 Límite de ráfaga:** **5 mensajes cada 10 s** por número.
  - Lo que lo supera se ignora en silencio y no cuenta para RF-1.2.
  - Se registra en el log la primera vez de cada ventana, con el número enmascarado.

### RF-2. Topes globales

Persisten en MySQL y no contienen datos personales.

- **RF-2.1 Plantillas al personal:** **60 al día y 1500 al mes**.
  - Al llegar al tope, el bot entra en "modo contacto directo": las conversaciones nuevas reciben un mensaje fijo con el contacto del personal y no se envían más plantillas.
  - Las conversaciones en curso que llegan a confirmar reciben el resumen y el contacto directo.
- **RF-2.2 Mensajes salientes del bot** (todos, incluidos los mensajes fijos): **800 al día y 12 000 al mes**. Al llegar al tope, silencio total hasta que empiece el siguiente periodo.
- **RF-2.3 Presupuesto mensual estimado:** **20 USD**.
  - Gasto estimado = plantillas del mes × tarifa utility + máx(0, salientes del mes − cupo gratuito) × tarifa de servicio.
  - Valores por defecto: tarifa utility 0.0085, tarifa de servicio 0.0085 y cupo gratuito 1000.
  - Al llegar al presupuesto, se aplica lo mismo que en RF-2.2 hasta el mes siguiente.
- **RF-2.4** La primera vez que se alcanza cada tope en su periodo se registra un evento de nivel error (`bot_daily_cap_reached`, o el mensual equivalente) con el tipo de tope y su valor, sin números. También se ve en `/admin` (RF-6).

### RF-3. Lista negra

Se guarda en MySQL de forma seudonimizada.

- **RF-3.1** Un número bloqueado no recibe ninguna respuesta, no cuenta en ningún tope y no provoca avisos. Sus mensajes se registran con el número enmascarado y sin repetir el registro en exceso.
- **RF-3.2 Formas de entrar en la lista:**
  - manual, desde `/admin`;
  - automática durante **7 días** al llegar a RF-1.2;
  - automática y escalonada por repeticiones o bucles (RF-7).
- **RF-3.3** Duración del bloqueo manual: 24 h, 7 d, 30 d o permanente. Por defecto, 7 d.
- **RF-3.4** Para salir de la lista: al vencer el plazo, o cuando un `admin` la quita a mano (también si el bloqueo fue automático).
- **RF-3.5** Solo el rol `admin` ve y gestiona la lista. El `editor` no tiene acceso.
- **RF-3.6 Qué se guarda de cada entrada:**
  - un identificador no reversible del número, normalizado para que `521…` y `52…` sean el mismo número;
  - los 4 últimos dígitos;
  - el motivo, el origen (manual, tope o repetición) y el autor (o "sistema");
  - las fechas de alta y de caducidad.
  - El número completo nunca se guarda en claro ni se muestra.
- **RF-3.7** Auditoría de cada alta, baja y caducidad: quién, cuándo, motivo y número enmascarado.
- **RF-3.8** Si MySQL no está disponible, el bot sigue con la última copia conocida de la lista negra y del interruptor, y lo registra como error.

### RF-4. Lista blanca

- Los números del personal (`WHATSAPP_BOT_STAFF_*`) están exentos de RF-1.1, RF-1.2 y RF-7, y no se pueden bloquear: el formulario lo rechaza con un mensaje claro.
- A esos números sí les aplican RF-1.3, RF-1.4, RF-2, RF-8 y RF-9.

### RF-5. Configuración

- Todos los umbrales, ventanas, duraciones, tarifas, el cupo gratuito, el presupuesto y la capacidad de la cola se fijan con variables de entorno, con los valores por defecto de este documento.
- Se validan al arrancar: un valor inválido impide arrancar con un mensaje claro.
- Se documentan en `.env.example` y en el README.
- En el panel solo se gestionan la lista negra y el interruptor.

### RF-6. Página "Bot" en `/admin` (solo `admin`)

- Recuentos de hoy y del mes: plantillas, salientes y gasto estimado frente al presupuesto.
- Estado de cada tope.
- Estado del interruptor.
- Lista negra, con alta y baja.
- Números (enmascarados) que alcanzaron un tope hoy, con la acción "bloquear". Esta lista vive en memoria y se pierde al reiniciar.
- Un estado coherente cuando el bot está desactivado (webhook en 503).

### RF-7. Mensajes idénticos repetidos y bucles

- **RF-7.1** Si un número envía el mismo texto normalizado **5 veces en 10 minutos** (seguidas o intercaladas), entra en **enfriamiento de 30 minutos**: sus mensajes se ignoran en silencio y no cuentan. Se registra con el número enmascarado.
- **RF-7.2** Si vuelve a entrar en enfriamiento el mismo día, pasa a la lista negra de forma automática y escalonada, según cuántos bloqueos automáticos tuvo en los 30 días anteriores:
  - el primero dura **24 h**;
  - el segundo, **7 d**;
  - el tercero y siguientes, **30 d**.
- **RF-7.3** Las entradas vencidas se conservan 30 días (RF-10) y sirven para calcular el escalón.

### RF-8. Cola global acotada

- Como máximo **100** mensajes en proceso o en espera entre todos los clientes.
- Con la cola llena, los mensajes nuevos se descartan sin respuesta y no cuentan en los topes.
- Se registra un evento de cola llena con el número de descartes, como mucho una vez por minuto y sin números.

### RF-9. Interruptor de emergencia

- **RF-9.1** En `/admin`, un `admin` puede activar y desactivar "Bot pausado". Cada cambio queda en la auditoría (quién, cuándo y motivo opcional) y en el log.
- **RF-9.2** Con el bot pausado:
  - no se envía ningún mensaje ni plantilla;
  - los mensajes entrantes se descartan sin contar en los topes;
  - el webhook sigue respondiendo con normalidad, para que Meta no reintente;
  - las landings y `/admin` siguen funcionando.
- **RF-9.3** El estado se guarda en MySQL y se mantiene tras un reinicio. Surte efecto sin redesplegar y en pocos segundos.

### RF-10. Privacidad y retención

- Los logs, la base de datos y el HTML del panel nunca llevan el número completo.
- Las entradas vencidas de la lista negra se borran a los 30 días.
- La auditoría se conserva 12 meses, solo con números enmascarados.
- Los contadores globales no contienen datos personales.

### Orden de aplicación de los controles a cada mensaje entrante

1. Interruptor.
2. Lista negra.
3. Enfriamiento.
4. Ráfaga y tope por minuto.
5. Tope diario por número.
6. Cola global.
7. Procesamiento.
8. Topes globales, antes de cada envío.

Un mensaje que se descarta en un paso no cuenta en los pasos siguientes.

## Historias de usuario

- **Como** dueño, **quiero** que el gasto en Meta tenga un techo diario y mensual configurable, **para** no recibir cobros inesperados (RF-2).
- **Como** personal, **quiero** no recibir avisos de pedidos falsos en masa, **para** no perder trabajo (RF-1.1, RF-2.1).
- **Como** admin, **quiero** bloquear, desbloquear y ver los números abusivos, **para** cortar el abuso sin tocar el código (RF-3, RF-6).
- **Como** admin, **quiero** pausar el bot desde el panel, **para** reaccionar a un incidente sin redesplegar (RF-9).
- **Como** cliente legítimo, **quiero** que, si se alcanza un límite, se me dé el contacto directo, **para** poder pedir de todos modos (RF-1.1, RF-2.1).

## Criterios de aceptación

- **CA-1 (Tope de pedidos por número)**
  - Given un número con 3 pedidos confirmados hoy, When empieza otro pedido, Then recibe el mensaje fijo con el contacto directo y no se envía ninguna plantilla.
  - Given un número que llega al tope durante una conversación, When confirma, Then recibe el resumen con el contacto y no se envía la plantilla.
- **CA-2 (Tope de mensajes por número)** Given un número con 60 mensajes procesados hoy, When envía más, Then recibe exactamente un mensaje fijo, después ninguno, y queda bloqueado 7 días con origen "tope".
- **CA-3 (Ráfaga)** Given 6 mensajes de un número en 10 s, Then el sexto se ignora sin respuesta, no cuenta en RF-1.2 y aparece un único registro en esa ventana. El tope de 20 por minuto sigue funcionando.
- **CA-4 (Tope global de plantillas)** Given que se alcanzó el tope diario o mensual de plantillas, When un cliente empieza o confirma un pedido, Then recibe el contacto directo, no se envía la plantilla y hay un único evento de error sin números.
- **CA-5 (Tope de salientes y presupuesto)** Given que se alcanzó el tope de salientes o el presupuesto estimado (con las tarifas y el cupo configurados), Then el bot no envía nada hasta el siguiente periodo. Los contadores y el corte se mantienen tras un reinicio.
- **CA-6 (Lista negra)**
  - Given un número en la lista negra, When escribe, Then no recibe respuesta, no cuenta en los topes y no se envía ningún aviso.
  - Given que el bloqueo venció, Then vuelve a ser atendido.
- **CA-7 (Permisos y auditoría)**
  - Given un `editor`, Then no puede ver ni gestionar la página "Bot".
  - Given un `admin`, Then puede dar de alta (con motivo y duración), dar de baja y bloquear desde "alcanzaron un tope hoy", y cada acción queda en la auditoría.
- **CA-8 (Lista blanca)** Un número del personal no se puede bloquear y está exento de RF-1.1, RF-1.2 y RF-7.
- **CA-9 (Normalización)** El mismo número de México con `521` y con `52` se reconoce como uno solo en los topes, la lista negra y la detección de repetidos.
- **CA-10 (Repetidos y escalado)**
  - Given 5 textos idénticos de un número en 10 minutos, Then entra en enfriamiento 30 minutos sin respuestas.
  - Given un segundo enfriamiento ese día, Then queda bloqueado 24 h. Con historial previo, el bloqueo es de 7 d y después de 30 d.
- **CA-11 (Cola global)** Given 100 mensajes en proceso, When llegan más, Then se descartan sin respuesta y hay como mucho un registro de cola llena por minuto, sin números.
- **CA-12 (Interruptor)**
  - Given que un `admin` pausa el bot, Then en pocos segundos no sale ningún mensaje ni plantilla, el webhook responde con normalidad, las landings siguen en 200, el estado se mantiene tras un reinicio y el cambio queda en la auditoría.
  - Al reanudar, el bot vuelve a atender.
- **CA-13 (Base de datos caída)** Given que MySQL no está disponible, Then el bot aplica la última copia conocida de la lista negra y del interruptor, y registra el error.
- **CA-14 (Configuración)** Con cualquier umbral inválido en el entorno, la app no arranca y muestra un mensaje claro. Sin variables, se aplican los valores por defecto de este documento.
- **CA-15 (Privacidad)** La base de datos, los logs y el HTML del panel no contienen ningún número completo. Las entradas vencidas se borran a los 30 días y la auditoría de más de 12 meses también.
- **CA-16 (Textos)** Los textos fijos nuevos del bot son editables junto al resto de textos del bot.

## Casos límite

- Medianoche y cambio de mes a mitad de una conversación.
- Un reinicio pone a cero los topes por número, los enfriamientos y la lista "alcanzaron un tope hoy", pero no la lista negra, los contadores globales ni el interruptor.
- Un mensaje reenviado por Meta no cuenta dos veces (`seen` en memoria; la versión persistente queda fuera de alcance).
- Un aviso al personal rechazado por Meta.
- Un tope global alcanzado a mitad de una conversación.
- Intentar bloquear un número del personal o un número con formato inválido.
- Desbloquear a mano un bloqueo automático.
- El interruptor cambia mientras hay mensajes en la cola.
- Los mensajes fijos también cuentan como salientes.
- Con el bot desactivado (webhook en 503), la página "Bot" muestra un estado coherente.

## Dependencias

- MySQL y Prisma (REQ-F-014), con una migración nueva.
- Roles y auditoría de `/admin` (REQ-F-007).
- La zona horaria del negocio (CLAUDE.md §11).
- La normalización de números de México (PR #47).
- REQ-F-022, para convertir los eventos de error en alertas.

## Riesgos

- Falsos positivos: clientes legítimos bloqueados. Pueden pedir por el contacto directo publicado en la landing.
- Umbrales mal calibrados.
- Perder o rotar la clave del identificador seudonimizado deja inservible la lista negra.
- Con el bot pausado o en silencio, los CTA de la landing siguen apuntando al bot.
- El gasto estimado puede no coincidir con la facturación real de Meta. El límite efectivo lo pone la tarjeta virtual (D-4).

## Action Plan

### Objetivo

Gasto en Meta acotado, abuso contenido y control de emergencia antes de anunciar el bot.

### Alcance

RF-1 a RF-10.

### Fuera de alcance

Ver la sección "Fuera de alcance".

### Cambios requeridos

1. Configuración por entorno de todos los valores, con validación y documentación.
2. Normalización del número para todos los controles.
3. Controles por número: ráfaga, tope diario de mensajes y de pedidos, repetidos y enfriamiento.
4. Cola global acotada.
5. Contadores globales diarios y mensuales con presupuesto estimado, persistentes, con modo contacto directo y silencio.
6. Lista negra persistente y seudonimizada: altas manuales y automáticas, escalado, caducidad y una última copia conocida si falla la base.
7. Interruptor persistente.
8. Página "Bot" en `/admin`, solo para `admin`, con auditoría.
9. Retención: borrado a los 30 días y a los 12 meses.
10. Textos fijos editables.
11. Documentación: README (costos y variables) y `.env.example`. La nota de I-5 la actualiza la sesión principal.

### Reglas de negocio

Las de RF-1 a RF-10, incluido el orden de aplicación de los controles.

### UX/UI

- Mensajes fijos breves, con el enlace de contacto directo del negocio que corresponda.
- La página "Bot" sigue las convenciones visuales y de accesibilidad del panel y `.claude/rules/formularios.md`.
- No hay diseño del panel en `_stich_source_/`.

### Integraciones

Meta Cloud API (envío de texto y de plantilla). No se crean plantillas nuevas.

### Casos límite

Los de la sección "Casos límite".

### Criterios de aceptación

CA-1 a CA-16.

### Dependencias

Las de la sección "Dependencias".

### Riesgos

Los de la sección "Riesgos".

### Orden recomendado

Configuración y normalización → controles por número → cola → contadores globales y presupuesto → lista negra → interruptor → panel → retención → documentación.

### Resultado esperado

Con el bot activo, el gasto diario y mensual no supera lo configurado, los abusadores se bloquean de forma automática o desde el panel, y un admin puede pausar el bot desde `/admin` sin tocar el servidor.

## Trazabilidad

| Objetivo | Requisito | Historia | Criterios de aceptación |
| --- | --- | --- | --- |
| Gasto acotado | RF-2, RF-5 | Dueño | CA-4, CA-5, CA-14 |
| Pedidos falsos | RF-1.1, RF-2.1 | Personal | CA-1, CA-4 |
| Abuso por número | RF-1.2, RF-1.4, RF-3, RF-4, RF-7 | Admin | CA-2, CA-3, CA-6 a CA-10 |
| Recursos de la app | RF-8 | — | CA-11 |
| Emergencia | RF-9 | Admin | CA-12, CA-13 |
| Privacidad | RF-3.6, RF-10 | — | CA-15 |
| Textos editables | RF-1, RF-2 (mensajes fijos) | Cliente | CA-16 |

No hay diseño de UI en `_stich_source_/` para el panel: esa parte se rige por las convenciones del panel actual.

## Technical Action Plan

### Objetivo técnico

Añadir al bot una capa de protección compartida por los dos proveedores (Meta y Twilio), situada en el orquestador y nunca en `providers/`. Esa capa:

- aplica los controles en el orden de RF ("Orden de aplicación") a cada mensaje entrante;
- comprueba los topes globales antes de cada envío;
- persiste en MySQL (con una migración nueva de Prisma) la lista negra seudonimizada, la auditoría, los contadores globales y el interruptor;
- añade la página `/admin/bot`, solo para `admin`.

La activación en Meta (solo `.env`) no cambia: el webhook, la firma, la respuesta 200 inmediata, la deduplicación y el envío siguen igual. La única condición nueva para el despliegue es la clave del seudónimo (D-T1).

### Decisiones técnicas (se confirman al aprobar este plan)

- **D-T1. Clave del identificador seudonimizado.** Recomendada: una variable nueva y dedicada, `WHATSAPP_BOT_BLOCKLIST_KEY`, con al menos 32 bytes aleatorios en base64url o hex (≥ 43 caracteres) y generada con `openssl rand -base64 32`.
  - Es obligatoria solo si el bot está habilitado; si falta, la app no arranca (fail fast).
  - No habilita el bot por sí sola.
  - Nunca se registra en el log ni se guarda en la base de datos. Así, una copia filtrada de la base no basta para recuperar los números por fuerza bruta: el espacio de números de México es de solo unos 10^10.
  - Se guarda junto al resto de secretos, en el gestor de contraseñas. Perderla deja la lista negra inservible (riesgo ya anotado por el BA).
  - **Rotación:** variable opcional `WHATSAPP_BOT_BLOCKLIST_KEY_PREVIOUS`. Cada entrada guarda un `key_id` (8 hex de `HMAC(clave, "key-id")`). La búsqueda prueba primero la clave actual y después la anterior. Cuando escribe un número que coincide con la clave anterior, su entrada se vuelve a calcular con la clave actual (re-key perezoso). El panel muestra cuántas entradas siguen con la clave anterior, y la variable anterior se retira cuando ese número llega a 0. Un bloqueo permanente que nunca vuelve a escribir se queda con la clave anterior: retirarla lo deja sin efecto, y el panel lo avisa.
  - **Alternativa descartada:** derivar la clave del App Secret de Meta (HKDF). No pide una variable nueva, pero rotar el App Secret inutilizaría la lista sin avisar, y Twilio no tiene un equivalente.
  - **Impacto en el despliegue:** si el bot ya está activo cuando se despliegue este cambio, hay que añadir la variable al `.env` del VPS **antes** del merge. Sin ella, la app nueva no arranca y `deploy.sh` vuelve a la versión anterior, que tolera la migración nueva gracias a `DATABASE_ALLOW_NEWER_SCHEMA`. El PR lo incluirá como paso previo.
- **D-T2. Qué es un "saliente" (RF-2.2).** Recomendada: los salientes son los textos del bot al cliente, incluidos los mensajes fijos, con cada parte de `chunkText` contada como un mensaje. Las plantillas al personal **no** cuentan como salientes, porque tienen su propio tope (RF-2.1) y su propio término en la fórmula de RF-2.3. Si contaran en los dos sitios, se cobrarían dos veces en el presupuesto y se mezclarían con el cupo gratuito de servicio.
  - Cada envío reserva su unidad en memoria antes de enviarse, para que dos clientes a la vez no superen el tope.
  - Si el proveedor rechaza el envío de forma definitiva (`ok: false` de tipo `http`, `network` o `invalid_response`), la unidad se libera.
  - Con un resultado `ambiguous` o `timeout` la unidad se mantiene, porque Meta pudo cobrarlo (supuesto prudente).
- **D-T3. Repetición de los mensajes fijos.** Recomendada: el mensaje fijo de "tope de pedidos" (RF-1.1) y el de "modo contacto directo" (RF-2.1) se envían como mucho una vez por número cada 2 h (memoria acotada, igual que una conversación). Los mensajes siguientes de ese número en ese plazo se ignoran en silencio. Si se respondiera cada vez, el abusador podría generar gasto con los propios mensajes fijos.
- **D-T4. Alta manual de un número.**
  - Se acepta en formato internacional (`+52 55 1234 5678`, `5215512345678`, `525512345678`) y también con 10 dígitos, que se toman como México (se antepone `52`).
  - Se ignoran los espacios, los guiones, los paréntesis y el `+`. Después de normalizar deben quedar entre 8 y 15 dígitos.
  - El motivo es opcional: hasta 200 caracteres, en NFC y sin caracteres de control. Se rechaza si contiene 8 o más dígitos seguidos, para que nadie escriba un número completo en la base (CA-15).
  - Si el número ya está bloqueado, el alta se rechaza con el mensaje "Ese número ya está en la lista: quítalo antes para cambiar la duración".
  - Las duraciones manuales (24 h, 7 d, 30 d o permanente; 7 d por defecto) son opciones fijas en el código, no variables de entorno, porque RF-3.3 las define como opciones del formulario.
- **D-T5. Tiempo de efecto del interruptor y de la lista.** Hay una sola instancia, y el panel y el bot comparten el mismo servicio en memoria, así que un cambio hecho desde el panel actualiza la copia en memoria en cuanto se confirma la transacción, de forma inmediata.
  - Para los cambios hechos fuera del proceso (SQL a mano, `admin:recover` o un futuro script), la copia se refresca de forma perezosa como mucho cada `BOT_CONTROL_REFRESH_SECONDS` (10 s por defecto), al llegar un mensaje o al abrir el panel, sin temporizadores en el camino del bot.
  - El mantenimiento (retención y auditoría de las caducidades) corre al arrancar y después cada hora con un `setInterval(...).unref()` en `server.ts`, que se detiene al apagar el servidor.
- **D-T6. Normalización `521`/`52`.** La regla (`^521(\d{10})$` → `52$1`) se mueve a `phone.ts` (capa compartida) como `canonicalPhone()`, y `toCloudApiRecipient` pasa a delegar en ella. Su comportamiento es idéntico y lo siguen cubriendo las pruebas actuales. Todos los controles usan el número canónico: topes, lista negra, repetidos, lista blanca y "alcanzaron un tope hoy".
- **D-T7. Mensajes que no son texto (RF-7).** Recomendada: un mensaje no soportado (imagen, audio…) cuenta como el mismo "texto" a efectos de repetición. Si no, un bucle de imágenes no se detectaría.
- **D-T8. Pausa con conversaciones abiertas.** Recomendada: la pausa no borra las conversaciones en memoria. Mientras dura, no se envía nada y los mensajes entrantes se descartan. Al reanudar, una conversación que siga vigente (menos de 2 h) continúa donde estaba.
- **D-T9. Retención de los contadores diarios.** Recomendada: las filas de `bot_usage` (sin datos personales) se borran a los 13 meses, en el mismo mantenimiento horario.
- **D-T10. Protección opcional en `createBotOrchestrator`.**
  - La opción `protection` es opcional en el orquestador. Sin ella se mantiene el comportamiento actual, con solo `RATE_LIMIT`. Así no cambian las 9 pruebas y dobles que construyen el orquestador.
  - `createApp` **siempre** la inyecta cuando crea el bot desde la configuración, y lanza un `TypeError` si falta. Una prueba lo comprueba.
  - `npm run bot:chat` usa la protección con el store en memoria y los valores por defecto, para poder probar los topes en local.
- **D-T11. "Alcanzaron un tope hoy".** Entran en la lista: el tope diario de pedidos, el de mensajes, el enfriamiento y la primera vez de cada ventana de ráfaga o de tope por minuto.
  - Cada entrada guarda en memoria el número enmascarado, el tipo de tope, la hora y el seudónimo HMAC.
  - El botón "Bloquear" envía un token aleatorio de un solo uso, que se resuelve en memoria. El HTML nunca contiene ni el número ni el seudónimo.
  - La lista guarda como máximo 200 entradas y se vacía al cambiar el día.

### Archivos o componentes afectados

Nuevos:

- `prisma/migrations/<timestamp>_bot_proteccion/migration.sql`: migración revisada a mano con `DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs` en cada `CREATE TABLE`.
- `src/services/whatsapp-bot/protection/limits.ts`: tipo `BotLimits` y `DEFAULT_BOT_LIMITS`.
- `src/services/whatsapp-bot/protection/number-guard.ts`: controles por número en memoria (ráfaga, minuto, topes diarios, repetidos y enfriamiento, mensajes fijos ya enviados, "alcanzaron un tope hoy").
- `src/services/whatsapp-bot/protection/global-usage.ts`: espejo en memoria de los contadores globales, evaluación de topes y presupuesto en micro-USD (enteros, sin coma flotante), y eventos de "primera vez".
- `src/services/whatsapp-bot/protection/protection.ts`: `createBotProtection()`, fachada que usa el orquestador (`admit`, `reserveSend` y `settleSend`, `orderAllowed` y `recordOrder`, `paused`).
- `src/services/bot-control.ts`: servicio compartido por el bot y el panel. Calcula el seudónimo HMAC con rotación, mantiene la copia en memoria de la lista negra y del interruptor (última copia conocida), hace el refresco perezoso, persiste los contadores (cola serie con deltas pendientes) y ejecuta el mantenimiento.
- `src/repositories/bot-control-repository.ts` (contrato y reglas, transacciones), `prisma-bot-control-store.ts` y `memory-bot-control-store.ts`, con el mismo patrón que productos. Convierte los errores inesperados en `DatabaseUnavailableError`.
- `src/controllers/admin-bot.ts`, `src/views/admin/bot.ts`, `src/views/admin/bot.html` y los partials de `src/views/admin/partials/` (fila de bloqueo, fila de tope y tarjeta de contador).

Modificados:

- `prisma/schema.prisma`: 4 modelos y 1 enum.
- `src/config/env.ts`: `Config.botLimits` y `Config.botBlocklistKeys`.
- `src/services/whatsapp-bot/orchestrator.ts`: `receive`, `enqueue`, `reply`, `notifyStaff` y `processMessage` (comprobaciones antes de crear una conversación).
- `src/services/whatsapp-bot/phone.ts` (`canonicalPhone`) y `providers/meta/cloud-api.ts` (delegación, sin cambio de comportamiento).
- `src/content/common/bot.ts`: textos fijos nuevos (CA-16).
- `src/app.ts` (`botControl` en `AppOptions`, inyección en el bot y en el admin) y `src/server.ts` (creación del servicio, carga inicial, mantenimiento y apagado con vaciado de los deltas).
- `src/routes/admin.ts`: rutas `/admin/bot`, declaradas antes de `/:business`.
- `src/controllers/admin.ts`: `AdminDeps.botControl` y `ALLOWED_NEXT`.
- `src/views/admin/index.ts`: `AdminSection` `'bot'`, enlace "Bot" en la navegación y tarjeta en el inicio, solo para `admin`.
- `scripts/bot-chat.ts`: protección en memoria.
- Documentación: `README.md` (costos, variables, panel Bot, rotación de la clave y paso previo al despliegue), `.env.example` y `deploy/env.production.example`.
- Pruebas: ver "Testing".

### Modelo de datos (Prisma, MySQL)

Todas las columnas de texto llevan un `@db.VarChar(n)` o `@db.Char(n)` explícito, y la colación se fija en cada tabla. Ninguna columna guarda un número completo.

- **`bot_block`** (lista negra; una fila por bloqueo, con historial):
  - `id`; `phone_hash Char(64)` (HMAC-SHA256 en hex del número canónico con el prefijo de dominio `bot-block:v1:`); `key_id Char(8)`; `last4 Char(4)`;
  - `origin` como enum `BotBlockOrigin { manual, tope, repeticion }`; `reason VarChar(200)?`;
  - `created_at`; `expires_at DateTime?` (null = permanente); `created_by_id Int?` (FK a `user`, `Restrict`; null = sistema);
  - `removed_at?` y `removed_by_id?` (baja manual); `expiry_audited_at?` (caducidad ya auditada).
  - Índices: `phone_hash`, `expires_at` y `created_at`.
  - "Activo" significa `removed_at IS NULL AND (expires_at IS NULL OR expires_at > now)`.
  - El alta se hace en una transacción `Serializable` con reintento acotado (como en `user-repository`) para que nunca haya dos bloqueos activos del mismo `phone_hash`.
- **`bot_audit`** (RF-3.7 y RF-9.1):
  - `id`; `at`; `action VarChar(32)` (`block_added`, `block_removed`, `block_expired`, `bot_paused` o `bot_resumed`);
  - `actor_id Int?` (FK a `user`); `actor_kind VarChar(16)` (`user` o `system`);
  - `masked VarChar(20)?` (salida de `maskPhone`); `origin VarChar(16)?`; `reason VarChar(200)?`; `details VarChar(200)?` (duración o caducidad).
  - Índice: `at`.
- **`bot_usage`** (contadores globales; sin datos personales):
  - Clave `(period_type, period)`: `period_type` es `day` o `month` y `period VarChar(10)` es `AAAA-MM-DD` o `AAAA-MM` en la zona del negocio.
  - `templates Int`, `outbound Int`, `templates_capped_at?`, `outbound_capped_at?`, `budget_capped_at?` (solo en las filas `month`) y `updated_at`.
  - Los incrementos usan `INSERT … ON DUPLICATE KEY UPDATE templates = templates + ?` (con `upsert` de Prisma y `increment`). Las marcas `*_capped_at` garantizan un solo evento de error por periodo, también tras un reinicio (RF-2.4).
- **`bot_control`** (interruptor): una única fila con `id = 1`, `paused Boolean`, `changed_at`, `changed_by_id Int?` y `reason VarChar(200)?`. Si la fila no existe, el bot no está pausado. El primer cambio la crea con `upsert`, y la migración no inserta datos.

La migración es aditiva: la versión anterior de la app funciona con ella (vuelta atrás con `DATABASE_ALLOW_NEWER_SCHEMA`). Los permisos DML de `restaurante_app` (`restaurante.*`) ya cubren las tablas nuevas, y los respaldos de REQ-F-019 las incluyen sin cambios.

### Backend

**Dónde vive cada control y orden de aplicación (RF "Orden de aplicación")**

En `orchestrator.receive`, para cada mensaje ya deduplicado (`seen`) y no viejo (las dos comprobaciones actuales se mantienen delante), se calcula `canonical = canonicalPhone(from)` y se aplican en orden:

1. **Interruptor** (`botControl.paused`): descarte silencioso, sin contar. Un log `bot_paused_dropped` con el número de descartes, como mucho uno por minuto.
2. **Lista negra** (`botControl.isBlocked(canonical)`, en memoria): descarte. Log `bot_blocked_message` con el número enmascarado, como mucho uno por número y hora.
3. **Enfriamiento** (`numberGuard`): descarte.
4. **Ráfaga** (5 cada 10 s) y después **tope por minuto** (20/min, el `createRateLimiter` actual con la ventana configurable). La ráfaga se evalúa primero: lo que descarta no cuenta en el tope por minuto. Log `bot_burst_limited` la primera vez de cada ventana.
5. **Tope diario de mensajes por número** (60/día; el personal está exento). Primero se *consulta*:
   - si con este mensaje se supera el tope: se encola **un único** mensaje fijo `dailyLimitReached`, se da de alta un bloqueo automático de 7 d con origen `tope` y se registra `bot_number_cap_reached`;
   - si no: se continúa.
6. **Cola global** (`pending.size >= BOT_QUEUE_MAX`): descarte sin contar, con un log `bot_queue_full` con `dropped`, como mucho uno por minuto y sin números. Solo si el mensaje pasa la cola se *confirman* los recuentos del paso 5 y de repetidos: un mensaje descartado nunca cuenta en los pasos siguientes.
7. **Repetidos** (RF-7): con el mensaje ya admitido, se calcula un hash SHA-256 truncado del texto normalizado (`normalizeInput`; los mensajes no soportados usan una clave fija, D-T7). Las marcas de tiempo se guardan en memoria, sin texto. Cuando hay 5 iguales en 10 min:
   - el número entra en enfriamiento 30 min y ese 5.º mensaje se ignora;
   - si es el segundo enfriamiento del día, se da de alta un bloqueo automático escalonado: el escalón se calcula con los bloqueos automáticos (`tope` o `repeticion`) del número en los 30 días anteriores (0 → 24 h, 1 → 7 d, ≥ 2 → 30 d).
   - El personal está exento.
8. **Procesamiento** (`enqueue`, como hoy). En `processMessage`, si no hay conversación guardada (sería una nueva):
   - con el **tope de pedidos por número** alcanzado (RF-1.1), se envía el mensaje fijo `orderLimitReached` (como mucho uno cada 2 h, D-T3) y no se crea conversación;
   - con el **tope global de plantillas** alcanzado (RF-2.1, modo contacto directo), se envía `directContactMode`, con la misma regla.
9. **Topes globales antes de cada envío**:
   - `reply()` llama a `protection.reserveSend('outbound')` por cada parte. Con el interruptor activo, el tope de salientes diario o mensual alcanzado o el presupuesto alcanzado, no se envía nada (silencio) y se detiene ese envío.
   - `notifyStaff()` comprueba, por este orden, el interruptor, el tope de pedidos del número (salvo el personal) y el tope global de plantillas.
     - Si alguno falla: no se envía la plantilla, la conversación se cierra y el cliente recibe `orderCapContact` (resumen con el código y el contacto directo, como D-18).
     - Si la plantilla se acepta: cuenta en las plantillas y en los pedidos del número.
     - Si se rechaza: no cuenta (RF-1.1) y se libera la reserva de plantilla.

**Presupuesto (RF-2.3).** Se calcula en micro-USD enteros:

```text
templatesMes × tarifaUtility + max(0, salientesMes − cupoGratis) × tarifaServicio
```

Antes de cada envío se comprueba que el gasto estimado *después* del envío no supere el presupuesto. Si lo supera, hay silencio hasta el mes siguiente.

**Contadores y persistencia.**

- Al arrancar, `bot-control` carga el día y el mes actuales desde `bot_usage`.
- En ejecución, la memoria es la fuente de verdad: así no hay carreras entre clientes y la comprobación es síncrona.
- Cada reserva o liberación produce un delta, que se persiste en una cola serie (un `upsert … increment` cada vez).
- Si MySQL falla, el delta queda pendiente (suma acumulada), se registra `bot_control_store_failed` (error, una vez por caída) y se reintenta con la siguiente escritura o con el mantenimiento. El apagado ordenado (`SIGTERM`) vacía los deltas antes de `$disconnect`.
- Un fallo abrupto del proceso puede perder solo los deltas en vuelo, de milisegundos (riesgo aceptado).
- Al cambiar el día o el mes (zona del negocio, con `toZonedIsoString`), el espejo empieza en 0 de forma perezosa. Una conversación que cruza la medianoche se rige por el periodo vigente en cada envío.

**Lista negra e interruptor con MySQL caído (RF-3.8, CA-13).** La copia en memoria se carga al arrancar; si esa carga falla, el servidor no arranca, como con productos. Si falla un refresco, se conserva la última copia conocida y se registra `bot_control_refresh_failed` (error, una vez por caída), y después `bot_control_refresh_recovered`.

Las altas automáticas se aplican en memoria al instante. Si su escritura falla, quedan en una lista de pendientes acotada (100) que se reintenta en el siguiente refresco. Las acciones del panel exigen la base: sin ella, `/admin/bot` responde 503 con la página "no disponible" actual.

**Retención (RF-10, CA-15).** El mantenimiento, al arrancar y cada hora:

1. Audita las caducidades: inserta `block_expired` para las entradas vencidas sin `expiry_audited_at` y marca la columna.
2. Borra de `bot_block` lo que tenga `COALESCE(removed_at, expires_at) < ahora − 30 d`.
3. Borra de `bot_audit` lo que tenga `at < ahora − 12 meses`.
4. Borra las filas `day` de `bot_usage` de más de 13 meses (D-T9).

La caducidad surte efecto al instante en la comprobación en memoria, que compara `expires_at` con la hora actual.

**Logs nuevos.** Todos sin número completo, sin texto, sin claves ni seudónimos HMAC:

- `bot_paused_dropped`, `bot_blocked_message`, `bot_burst_limited`, `bot_cooldown_started`, `bot_number_cap_reached` (con `cap: orders|messages`) y `bot_auto_blocked` (con `origin` y `days`);
- `bot_daily_cap_reached` y `bot_monthly_cap_reached` (nivel error, con `cap: templates|outbound|budget` y `limit`);
- `bot_queue_full`, `bot_control_store_failed`, `bot_control_refresh_failed` y `bot_control_refresh_recovered`;
- `bot_control_paused` y `bot_control_resumed` (con `actorId`), y `bot_block_added` y `bot_block_removed` (con el número enmascarado, el origen y `actorId`).

**Memoria acotada.** Todas las estructuras por número usan claves HMAC con la clave por proceso actual (nunca el número en claro) y tienen un máximo de entradas (`maxTracked`, 1000 como `RATE_LIMIT`), con limpieza perezosa (patrón de `store.ts`).

### Frontend (página "Bot" de `/admin`)

No hay diseño en `_stich_source_/` (comprobado: ningún recurso de panel, admin ni bot). Se siguen las convenciones de `/admin`: `adminPage`, `ADMIN_CLASSES`, `renderAdminNotice`, formularios HTML nativos con POST-redirect-GET, sin JavaScript nuevo, Tailwind con BEM (`bot-panel`, `bot-panel__counter`, `bot-panel__table`…) y la hoja `admin`, que se regenera con `npm run build:css`.

Rutas, todas detrás de `createAdminAccess` (sesión → permiso `isAdmin` → body con campos permitidos y 4 KB → CSRF). Un `editor` recibe 403, con la página `forbidden` actual en GET y en POST, y no ve el enlace ni la tarjeta.

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | `/admin/bot` | La página |
| POST | `/admin/bot/interruptor` | Campos `accion` (`pausar` o `reanudar`) y `motivo` |
| POST | `/admin/bot/bloqueos` | Campos `telefono`, `duracion` (`24h`, `7d`, `30d` o `permanente`) y `motivo` |
| POST | `/admin/bot/bloqueos/:id/quitar` | Baja manual |
| POST | `/admin/bot/topes/:token/bloquear` | Campos `duracion` y `motivo` |

Contenido de la página:

1. **Estado del bot:** "Habilitado (Meta o Twilio)", o "Desactivado: sin configuración (el webhook responde 503)". Con el bot desactivado se muestran la lista negra y el interruptor (que se puede cambiar y queda guardado), y el alta se deshabilita si no hay clave (texto explicativo).
2. **Interruptor:** estado, quién lo cambió y cuándo, motivo, y el botón "Pausar bot" o "Reanudar bot" con un motivo opcional.
3. **Contadores de hoy y del mes:** plantillas y salientes frente a su tope, gasto estimado frente al presupuesto (USD con 2 decimales) y el estado de cada tope ("Disponible" o "Alcanzado", con texto y no solo con color).
4. **"Alcanzaron un tope hoy":** tabla con el número enmascarado, el tope, la hora y un formulario "Bloquear" con la duración. Indica que se pierde al reiniciar.
5. **Lista negra:** tabla con el número enmascarado (`*********5678`), el origen, el motivo, el autor (nombre visible o "Sistema"), el alta, la caducidad o "Permanente" y el botón "Quitar".
6. **Formulario de alta:**
   - campo `type="tel"`, `inputmode="tel"`, `autocomplete="off"`, con su etiqueta y su ayuda;
   - `select` de duración;
   - motivo;
   - errores accesibles con el resumen y los enlaces a los campos (`.claude/rules/formularios.md`).
   - **Tras un error, el campo del teléfono se vuelve a mostrar vacío.** Nunca se devuelve el número en el HTML (CA-15).
   - Alta y baja muestran sus avisos de éxito con el número enmascarado.

Los encabezados siguen la jerarquía (h1 "Bot" y un h2 por sección), las tablas usan `caption` y `th scope`, el foco es visible y la página es responsive (las tablas se desplazan en el móvil).

### Contenido / configuración

**Textos nuevos en `src/content/common/bot.ts` (CA-16)**, con marcadores `{negocio}`, `{contacto}` y `{codigo}`:

- `orderLimitReached`
- `orderCapContact`
- `dailyLimitReached`
- `directContactMode`

El negocio de una conversación nueva es el negocio activo del día, como hoy en `newConversation`.

**Variables nuevas (RF-5)**, validadas en `env.ts` al arrancar:

- Si un valor es inválido, la app no arranca y el mensaje dice qué variable falla y qué se espera, sin mostrar el valor.
- Si una variable falta, se usa su valor por defecto.
- Los límites se validan siempre, aunque el bot esté desactivado, porque el panel los muestra.
- Ninguna habilita el bot (no entran en `ENABLING_VARS`).

| Variable | Defecto | Validación |
| --- | --- | --- |
| `WHATSAPP_BOT_BLOCKLIST_KEY` | — (obligatoria con el bot) | base64url o hex de ≥ 32 bytes |
| `WHATSAPP_BOT_BLOCKLIST_KEY_PREVIOUS` | vacía | igual que la anterior y distinta de ella |
| `BOT_LIMIT_ORDERS_PER_NUMBER_DAY` | 3 | entero 1–100 |
| `BOT_LIMIT_MESSAGES_PER_NUMBER_DAY` | 60 | entero 5–10 000 |
| `BOT_LIMIT_MESSAGES_PER_MINUTE` | 20 | entero 1–1000 |
| `BOT_LIMIT_BURST` / `BOT_LIMIT_BURST_WINDOW_SECONDS` | 5 / 10 | entero 1–100 / 1–3600 |
| `BOT_LIMIT_TEMPLATES_DAY` / `BOT_LIMIT_TEMPLATES_MONTH` | 60 / 1500 | entero 1–100 000; diario ≤ mensual |
| `BOT_LIMIT_OUTBOUND_DAY` / `BOT_LIMIT_OUTBOUND_MONTH` | 800 / 12 000 | entero 1–1 000 000; diario ≤ mensual |
| `BOT_BUDGET_MONTH_USD` | 20 | decimal > 0 y ≤ 10 000, hasta 4 decimales |
| `BOT_COST_UTILITY_USD` / `BOT_COST_SERVICE_USD` | 0.0085 / 0.0085 | decimal ≥ 0 y ≤ 1, hasta 6 decimales |
| `BOT_FREE_SERVICE_MONTH` | 1000 | entero 0–1 000 000 |
| `BOT_REPEAT_COUNT` / `BOT_REPEAT_WINDOW_MINUTES` / `BOT_COOLDOWN_MINUTES` | 5 / 10 / 30 | entero 2–100 / 1–1440 / 1–1440 |
| `BOT_BLOCK_CAP_DAYS` | 7 | entero 1–365 |
| `BOT_BLOCK_REPEAT_STEPS_HOURS` | `24,168,720` | 1 a 5 enteros crecientes de 1–8760 |
| `BOT_BLOCK_HISTORY_DAYS` | 30 | entero 1–365 (escalón y retención de los vencidos) |
| `BOT_AUDIT_RETENTION_MONTHS` | 12 | entero 1–120 |
| `BOT_QUEUE_MAX` | 100 | entero 1–10 000 |
| `BOT_CONTROL_REFRESH_SECONDS` | 10 | entero 1–300 |

Los importes se convierten a micro-USD enteros al validar.

**Documentación.**

- `.env.example` y `deploy/env.production.example`: las variables, con los defectos comentados.
- README:
  - "Costos de Meta y Twilio": fórmula y supuesto prudente;
  - "Variables del bot": clave, rotación y aviso de que la clave se guarda en el gestor de contraseñas;
  - "Panel Bot";
  - paso previo al despliegue (D-T1).

### Validaciones

- **Entorno:** la tabla anterior.
- **Formularios:**
  - `telefono`: D-T4 y rechazo de los números del personal (canónicos), con el mensaje "Ese número es del personal y no se puede bloquear";
  - `duracion`: lista cerrada;
  - `motivo`: D-T4;
  - `accion`: `pausar` o `reanudar`;
  - `:id`: `^[1-9]\d{0,9}$`, que debe existir y estar activo (404 si no);
  - `:token`: 32 hex vigente (404 si no; un solo uso).
- **Cuerpo:** cualquier campo no permitido responde 400, como en usuarios.

### Manejo de errores

- La base de datos caída en el panel da 503 con la página "no disponible" (`DatabaseUnavailableError`), y nunca registra el `message` de Prisma.
- En el bot, los fallos del store nunca lanzan hacia el webhook: se registran y se aplica la última copia conocida.
- El webhook mantiene la verificación de la firma, la respuesta 200 inmediata, el procesamiento en segundo plano y la deduplicación sin cambios.
- Los errores de validación del panel devuelven 422 con el resumen de errores, como en usuarios.

### Testing

**Unitarias** (sin MySQL; store en memoria, reloj y zona inyectados con `vi.setSystemTime`; dobles de Meta y Twilio, nunca la red):

- `config.test.ts` (CA-14): defectos sin variables; un caso inválido por variable (no numérico, fuera de rango, diario > mensual, escalones no crecientes, clave corta o igual a la anterior); clave obligatoria con el bot; el mensaje no contiene el valor.
- `phone.test.ts`, nuevo o ampliado (CA-9): `521…` y `52…` son el mismo número; el resto no cambia; `toCloudApiRecipient` es idéntico.
- `whatsapp-bot-protection.test.ts`, nuevo, con `number-guard` y `global-usage`:
  - CA-3: ráfaga, con un solo log por ventana; el tope de 20/min sigue funcionando;
  - CA-2: el tope de 60, un único mensaje fijo y la petición de bloqueo de 7 d;
  - CA-1: pedidos;
  - CA-10: repetidos, enfriamiento y escalones 24 h, 7 d y 30 d con historial;
  - CA-8: exenciones del personal;
  - medianoche y cambio de mes en `America/Mexico_City`;
  - CA-4 y CA-5: presupuesto con las tarifas y el cupo configurados, y un solo evento de "primera vez";
  - liberación de la reserva en un envío fallido y no en uno `ambiguous`;
  - memoria acotada.
- `whatsapp-bot-orchestrator.test.ts`, ampliado con la protección y el store en memoria:
  - el orden exacto de los controles (un mensaje descartado no cuenta después);
  - CA-11: cola llena, con un log por minuto y sin números;
  - CA-12: pausa con mensajes en la cola, sin ningún `fetch` al doble;
  - CA-6: bloqueado y vencido;
  - CA-4: tope de plantillas al empezar y al confirmar;
  - CA-5: silencio por salientes;
  - CA-1: aviso rechazado que no cuenta;
  - D-T3: el mensaje fijo como mucho una vez cada 2 h.
- `bot-control.test.ts`, nuevo:
  - seudónimo y rotación (búsqueda con la clave anterior y re-key);
  - CA-13: última copia conocida con el store fallando, con un único log de error y la recuperación;
  - refresco perezoso a los 10 s;
  - deltas pendientes que se reintentan;
  - cálculo de la retención.
- `content.test.ts` (CA-16): los textos nuevos y sus marcadores.
- Vista `admin/bot`: el HTML no contiene números completos con un número de prueba conocido (CA-15); el teléfono no se devuelve tras un error.

**Integración** (MySQL real con `makeDatabase()` o `setupAdmin()`; HTTP con `listenLocal`):

- `bot-control-repository.test.ts`, nuevo:
  - alta, baja, unicidad del bloqueo activo con concurrencia y escalón por historial;
  - incrementos concurrentes de `bot_usage` y marcas `*_capped_at`;
  - el interruptor persiste tras un reinicio (otro cliente Prisma contra la misma base);
  - retención a los 30 días y a los 12 meses (CA-15);
  - recorrido de todas las columnas de las 4 tablas buscando el número de prueba completo, que debe dar 0 coincidencias (CA-15).
- `admin-bot.test.ts`, nuevo:
  - CA-7: un editor recibe 403 en GET y en cada POST y no ve el enlace;
  - un admin da de alta, de baja y bloquea desde "alcanzaron un tope hoy", y cada acción queda en `bot_audit`;
  - sin CSRF, 403; con campos extra, 400;
  - CA-8: el número del personal se rechaza;
  - el formato inválido se rechaza;
  - el HTML de cada respuesta no contiene el número completo;
  - CA-12: pausa desde el panel, después un POST firmado al webhook que responde 200 sin envíos, landings en 200, y al reanudar vuelve a responder; el estado se mantiene con una app nueva sobre la misma base;
  - estado coherente con el bot desactivado.
- `db-outage` con `tests/support/tcp-proxy.ts` (CA-13): con la conexión cortada, un número bloqueado sigue sin respuesta, la pausa se mantiene y se registra `bot_control_refresh_failed`.
- `admin-authorization-matrix.test.ts`: las rutas nuevas en la matriz de roles.
- `server-startup-config.test.ts` (CA-14): un umbral inválido hace que el proceso termine con 1 y un mensaje claro.
- `migrations-collation.test.ts` y `db-migrations.test.ts`: cubren la migración nueva sin cambios.
- `chat-bot-contract.test.ts`: un caso de pausa y de lista negra con los dos proveedores.

**Regresión:** la suite completa (`npm test`), `npm run typecheck`, `npm run lint` y `npm run build:css`.

### Seguridad

- El HMAC-SHA256 usa una clave fuera de la base de datos. La clave nunca va al log ni al HTML, y el seudónimo tampoco va al HTML (se usan tokens de un solo uso).
- Solo los `admin` acceden. Cada POST pasa por CSRF y por la comprobación de origen, y lleva una lista cerrada de campos y un límite de cuerpo.
- El motivo no puede contener un número completo.
- No se relaja la CSP ni se añade JavaScript.
- La firma del webhook se verifica antes de cualquier control.
- Los controles protegen el gasto, pero no protegen contra un ataque de denegación de servicio al webhook (REQ-F-018, fuera de alcance). La cola global (RF-8) acota la memoria y la CPU por mensajes firmados.

### Performance

- Cada mensaje cuesta O(1) en memoria: varios HMAC y búsquedas en `Map`.
- No hay consultas a la base por mensaje: la lista y el interruptor se leen de la copia en memoria.
- Hay una escritura asíncrona por envío (`upsert` con incremento), del orden de 800 al día como máximo, más un refresco como mucho cada 10 s con tráfico, y el mantenimiento horario.
- La memoria está acotada con `maxTracked`.

### Riesgos técnicos

- **Clave (D-T1).** Si falta en el `.env` al desplegar con el bot activo, la app nueva no arranca y el despliegue vuelve a la versión anterior. Si se pierde la clave, la lista negra queda inservible. Mitigación: documentarlo, añadir un paso previo al PR y guardar la clave en el gestor de contraseñas.
- **Contadores en vuelo.** Un fallo abrupto puede perder deltas de milisegundos. Es aceptable: el límite real lo pone la tarjeta virtual (D-4).
- **Estimación frente a facturación real.** El gasto estimado puede diferir de lo que factura Meta (ya anotado por el BA).
- **Pruebas existentes.** Las pruebas que envían muchos mensajes de un mismo número no se ven afectadas, porque la protección es opcional en el orquestador (D-T10). Las de `createApp` construyen el bot inyectado.
- **Calibración.** Con la ráfaga de 5 cada 10 s, un cliente que pega varios mensajes seguidos puede perder respuestas. Es configurable.
- **Tamaño del cambio.** Es grande. Se mitiga implementando en el orden de abajo y probando cada capa por separado.

### Orden de implementación

1. Configuración (`env.ts`) y `canonicalPhone`, con sus pruebas.
2. `number-guard` (ráfaga, minuto, topes por número, repetidos y enfriamiento), con sus pruebas.
3. Cola global en el orquestador.
4. Esquema Prisma, migración (revisión de la colación), `bot-control-repository` (Prisma y memoria) y `bot-control` (seudónimo, copias, deltas y última copia conocida).
5. `global-usage` y presupuesto, e integración con `reply` y `notifyStaff`.
6. Lista negra (altas automáticas y escalado) e interruptor en el orquestador.
7. Inyección en `app.ts` y `server.ts` (carga, mantenimiento y apagado), y `bot-chat`.
8. Página `/admin/bot` (controlador, vistas, rutas, navegación y CSS).
9. Retención y auditoría de las caducidades.
10. Textos, README, `.env.example` y `env.production.example`.
11. Validación completa: `build:css`, `typecheck`, `test` y `lint`.

### Criterios de finalización

- CA-1 a CA-16 cubiertos por pruebas automáticas en verde y comprobados uno a uno en el Implementation Result.
- `npm run build:css`, `npm run typecheck`, `npm run lint` y `npm test` terminan con 0.
- La migración tiene la colación correcta en cada tabla.
- El diff no contiene cambios ajenos al ticket. El webhook (firma, 200 inmediato y deduplicación) y la configuración de activación en Meta no cambian.
- La documentación está actualizada, incluido el paso previo de la clave para el despliegue.

## Implementation Result

### Rama

`feature/REQ-F-025-topes-coste-abuso-bot`, creada desde `main` actualizado (`1160367`). No hay commits: los cambios están en el árbol de trabajo. El ticket se movió de `backlog/` a `in-progress/` con `mv`, porque no tenía seguimiento en git; se añadirá en T4.

### Cambios realizados

**Configuración (RF-5, CA-14; D-T1)**

- `src/config/env.ts` añade `Config.botLimits` y `Config.botKeys`.
- Las 22 variables `BOT_*` tienen valor por defecto y se validan por rango. Los importes en USD se convierten a micro-USD enteros. También se valida que el tope diario no supere al mensual.
- `WHATSAPP_BOT_BLOCKLIST_KEY` (≥ 32 bytes en base64, base64url o hex) es obligatoria solo con el resto del bot ya válido, para que cada error de configuración del bot aparezca una sola vez.
- `WHATSAPP_BOT_BLOCKLIST_KEY_PREVIOUS` es opcional y no puede ser igual a la actual.
- Ninguna de estas variables habilita el bot, y los mensajes de error nunca repiten el valor.
- Umbrales por defecto: `src/services/whatsapp-bot/protection/limits.ts`.

**Normalización (CA-9; D-T6)**

- `phone.ts` añade `canonicalPhone`, `parsePhoneInput` y `withoutMxMobilePrefix`.
- `toCloudApiRecipient` ahora delega en `withoutMxMobilePrefix`, con el mismo comportamiento (cubierto por pruebas).

**Persistencia**

- Migración `prisma/migrations/20261015024103_bot_proteccion`: aditiva, revisada a mano con `utf8mb4_es_0900_as_cs` en las 4 tablas (`bot_block`, `bot_audit`, `bot_usage` y `bot_control`).
- Contrato en `src/repositories/bot-control-store.ts`, con dos implementaciones:
  - `prisma-bot-control-store.ts`: altas en una transacción serializable con reintento; contadores con INSERT IGNORE y un UPDATE relativo, sin carreras.
  - `memory-bot-control-store.ts`: para las pruebas y `bot:chat`; puede simular una base caída.
- Desviación de nombre respecto al plan: no hay una capa "repository" aparte. Las reglas, que son pocas, viven en el contrato del store y en sus dos implementaciones.

**Estado compartido**

- `src/services/bot-control.ts`:
  - seudónimo HMAC-SHA256 con prefijo de dominio y rotación con re-key perezoso;
  - copia en memoria de la lista negra, el historial de bloqueos automáticos y el interruptor, con refresco perezoso cada `refreshMs`;
  - última copia conocida si la base falla, con un `bot_control_store_failed` por caída y después `…_recovered`;
  - altas automáticas pendientes de guardar;
  - cola serie de los deltas de los contadores;
  - "alcanzaron un tope hoy" con tokens de un solo uso;
  - mantenimiento (auditoría de las caducidades y retención) y `flush` al apagar.
- `src/services/bot-usage.ts`: contadores por día y por mes, presupuesto y evento de "primera vez" por periodo (persistido).

**Controles por número y orquestador**

- `protection/number-guard.ts`: ráfaga, tope por minuto, topes diarios, repetidos mediante hash del texto, enfriamiento y mensajes fijos como mucho cada 2 h.
- `protection/protection.ts`: aplica el orden del requisito (pasos 1 a 6; el recuento se confirma solo después de pasar la cola) y los controles antes de cada envío.
- `orchestrator.ts`, con la opción `protection` opcional (D-T10):
  - `reply` reserva y liquida cada parte;
  - `notifyStaff` comprueba la pausa, el tope de pedidos y el de plantillas;
  - `processMessage` rechaza una conversación nueva con los topes agotados;
  - el mensaje fijo de RF-1.2 va por la cola del cliente.
- Textos nuevos en `src/content/common/bot.ts` (CA-16): `orderLimitReached`, `orderCapContact`, `dailyLimitReached` y `directContactMode`.

**Integración**

- `app.ts`: `botControl` en `AppOptions`. Crear el bot desde la configuración sin `botControl` lanza un `TypeError`.
- `server.ts`: crea el servicio, lo carga (si falla, `bot_control_init_failed` y código 1), ejecuta el mantenimiento al arrancar y cada hora (`unref`) y hace `flush` antes de `$disconnect`.
- `scripts/bot-chat.ts` usa la protección con el store en memoria.

**Página `/admin/bot` (RF-6, solo `admin`)**

- `controllers/admin-bot.ts`, `views/admin/bot.ts`, `bot.html` y 9 partials `bot-*`.
- Rutas en `routes/admin.ts`, enlace "Bot" en la navegación y tarjeta en el inicio, solo para administradores.
- Formularios nativos con POST-redirect-GET, CSRF, lista cerrada de campos y cuerpo de 4 KB como máximo.
- El teléfono escrito nunca se vuelve a pintar ni se registra.

**Documentación**

- `README.md`: costos, topes, variables, logs, rotación y paso previo al despliegue.
- `.env.example`, `deploy/env.production.example` y `docs/despliegue.md` (§7, orden de despliegue).

**Despliegue (punto pedido por la sesión principal)**

- `deploy/compose.prod.yaml` pasa al contenedor la clave, la clave anterior y los 22 umbrales con `${VAR:-}`. Si quedan vacías, se aplican los valores por defecto (la app trata un valor vacío como ausente).
- Valoré pasar solo la clave para que el cambio fuera mínimo. Lo descarté por dos razones:
  - la regla de §1.3 de `docs/despliegue.md` dice que "cada variable nueva de la app se añade al compose";
  - pasar las 22 ahora no cuesta nada extra, porque la clave ya obliga a reinstalar `deploy/`. Sin ellas, cambiar un umbral en producción exigiría otro cambio en `deploy/`, otra reinstalación y otro despliegue.
- **Orden de despliegue si el bot ya está activo:**
  1. Añadir `WHATSAPP_BOT_BLOCKLIST_KEY` al `.env` del VPS (y al gestor de contraseñas) **antes** del merge.
  2. Hacer el merge. El job `deploy` fallará con el código 4 (`deploy/` instalado no coincide) sin tocar nada.
  3. Reinstalar `deploy/` (§1.3) y volver a ejecutar el job.
- Si el bot aún no está activo, la clave puede añadirse junto con la activación. Reinstalar `deploy/` sigue siendo necesario tras el merge, porque el compose cambió.
- **Desarrollo local:** el `.env` local tiene el bot habilitado, así que `npm run dev` no arrancará hasta añadir la clave (`openssl rand -base64 32`). No toqué el `.env`.

**Pruebas**

- Nuevas:
  - `tests/unit/bot-protection-config.test.ts`
  - `tests/unit/bot-control.test.ts`
  - `tests/unit/whatsapp-bot-protection.test.ts`
  - `tests/integration/bot-control-store.test.ts`
  - `tests/integration/admin-bot.test.ts`
  - `tests/support/bot-control.ts`
- Ampliadas:
  - `admin-authorization-matrix.test.ts`: rutas del bot y tablas del bot en la instantánea;
  - `server-startup-config.test.ts`: CA-14 con el proceso real;
  - `tests/support/admin.ts`: `setupAdmin` con `botControl`, `botKeys`, `botLimits`, `wrapBotStore` y `providerFetch`;
  - `tests/support/whatsapp.ts`: el arnés acepta `protection`;
  - `tests/helpers.ts`: la clave de prueba en `BOT_ENV` y `TWILIO_BOT_ENV`.
- Ajustadas por el cambio:
  - `admin-db-security.test.ts`: borra antes las tablas del bot, que referencian a `user`;
  - `chat-bot-contract.test.ts` y `whatsapp-twilio-qa-round1.test.ts`: pasan `botControl` cuando crean el bot desde la configuración.

### Criterios de aceptación

- **CA-1 (tope de pedidos por número) — Cumple.** `whatsapp-bot-protection.test.ts`:
  - con los pedidos del día agotados, recibe el contacto y no sale plantilla;
  - el mensaje fijo sale como mucho una vez cada 2 h;
  - un aviso rechazado por Meta no cuenta.
  - La ruta de "llega al tope al confirmar" se cubre con `templateCheck`. En la práctica no se alcanza de forma secuencial con un solo número.
- **CA-2 (tope de mensajes por número) — Cumple:** un único mensaje fijo, después silencio y bloqueo de 7 d con origen `tope`.
- **CA-3 (ráfaga) — Cumple:** el sexto mensaje en 10 s se ignora, no cuenta para RF-1.2 y deja un solo registro; el tope de 20/min sigue funcionando.
- **CA-4 (tope global de plantillas) — Cumple:** al empezar y al confirmar se recibe el contacto directo; hay un único error sin números.
- **CA-5 (salientes y presupuesto) — Cumple:**
  - unitarias: tope de salientes, presupuesto con tarifas y cupo, y reinicio sobre el mismo store;
  - integración con MySQL: los contadores y el interruptor se mantienen tras un reinicio.
- **CA-6 (lista negra) — Cumple:** un número bloqueado no recibe respuesta ni cuenta; al vencer el bloqueo vuelve a ser atendido.
- **CA-7 (permisos y auditoría) — Cumple:** un editor recibe 403 en el GET y en los 4 POST, y no ve el enlace; el admin da de alta, de baja y bloquea desde "alcanzaron un tope hoy", con auditoría en `bot_audit`.
- **CA-8 (lista blanca) — Cumple:** el personal está exento de los topes por número y de los repetidos, y no se puede bloquear (422 con mensaje claro).
- **CA-9 (normalización) — Cumple:** `521` y `52` del mismo número comparten topes, lista negra y repetidos.
- **CA-10 (repetidos y escalado) — Cumple:** enfriamiento de 30 min y segundo enfriamiento con bloqueo de 24 h; los escalones de 24 h, 7 d y 30 d se calculan con el historial (`bot-control.test.ts`).
- **CA-11 (cola global) — Cumple:** con la cola llena se descarta sin respuesta, con un registro por minuto y sin números.
- **CA-12 (interruptor) — Cumple:**
  - de punta a punta en `admin-bot.test.ts`: webhook en 200 sin envíos, landings en 200, auditoría, reinicio y reanudación;
  - antes de cada envío se comprueba la pausa (unitaria).
- **CA-13 (base de datos caída) — Cumple:** corte real con `tcp-proxy`: el número bloqueado sigue sin respuesta, otro número sí es atendido y se registra el error sin datos de conexión. También hay prueba unitaria con el store que falla.
- **CA-14 (configuración) — Cumple:** valores por defecto, cada valor inválido y arranque real que termina con código 1.
- **CA-15 (privacidad) — Cumple:**
  - el HTML, los logs y todas las columnas de las 4 tablas, revisadas en MySQL real, no contienen números completos;
  - retención a los 30 días y a los 12 meses;
  - el motivo rechaza números de teléfono.
- **CA-16 (textos) — Cumple:** los textos fijos viven en `src/content/common/bot.ts` con sus marcadores.

### Validaciones ejecutadas

Desde `restaurante/`, con el MySQL local en marcha:

- `npm run db:migrate`: aplicó `20261015024103_bot_proteccion`. Después, `npm run db:generate`.
- `npm run build:css`: terminó correctamente.
- `npm run typecheck`: código de salida 0.
- `npm run lint`: código de salida 0, sin errores ni avisos.
- `npm test`: 85 archivos de prueba pasan (1700 pruebas pasan y 1 es un fallo esperado).
- Arranque real de prueba con `node --env-file-if-exists=.env src/server.ts` y una clave temporal en el entorno: `/` y `/molotes` responden 200 y `/admin/bot` responde 303 al acceso. No se hizo ningún envío.

### Archivos afectados

**Nuevos**

- `prisma/migrations/20261015024103_bot_proteccion/migration.sql`
- `src/repositories/{bot-control-store,prisma-bot-control-store,memory-bot-control-store}.ts`
- `src/services/{bot-control,bot-usage}.ts`
- `src/services/whatsapp-bot/protection/{limits,number-guard,protection}.ts`
- `src/controllers/admin-bot.ts`
- `src/views/admin/bot.ts`, `src/views/admin/bot.html` y `src/views/admin/partials/bot-{add-form,block-row,empty,pending,reached-row,table,th,unblock-form,usage-row}.html`
- Las 6 pruebas y apoyos listados en "Pruebas".

**Modificados**

- `prisma/schema.prisma`
- `src/config/env.ts`, `src/app.ts`, `src/server.ts`, `src/routes/admin.ts`, `src/controllers/admin.ts`, `src/views/admin/index.ts`
- `src/content/common/bot.ts`
- `src/services/whatsapp-bot/{orchestrator,messages,phone}.ts`, `src/services/whatsapp-bot/providers/meta/cloud-api.ts`
- `scripts/bot-chat.ts`
- `.env.example`, `README.md`, `docs/despliegue.md`, `deploy/compose.prod.yaml`, `deploy/env.production.example`
- `tests/helpers.ts`, `tests/support/{admin,whatsapp}.ts`
- `tests/integration/{admin-authorization-matrix,admin-db-security,chat-bot-contract,server-startup-config,whatsapp-twilio-qa-round1}.test.ts`

### Corrección de DEF-001 (decisión del usuario: "A")

- Tras un alta o una baja, `/admin/bot` redirige con `?ok=blocked&n=<4 últimos dígitos>` o `?ok=unblocked&n=…`.
- El aviso de éxito muestra el número enmascarado: "Número bloqueado. (*********1234)".
- Un `n` que no sean exactamente 4 dígitos se ignora. La URL nunca lleva el número completo.
- `BotControl.unblock` ahora devuelve los 4 últimos dígitos, o `null` en lugar de `false`. Nuevo método: `reachedLast4(token)`.
- Prueba en `tests/integration/admin-bot.test.ts`: aviso de alta y de baja, bloqueo desde "alcanzaron un tope hoy" y `n` falsificado.
- Validación tras la corrección:
  - `npm run typecheck`: código de salida 0.
  - `npm run lint`: código de salida 0.
  - `npm test`: 86 archivos y 1706 pruebas pasan (más 1 fallo esperado); incluye las pruebas de QA.

### Riesgos o pendientes

- **Despliegue:** la clave en el `.env` del VPS y la reinstalación de `deploy/` (ver el orden arriba). La activación en Meta solo cambia el `.env` y es compatible con este orden.
- **Log de la base caída:** el plan nombraba `bot_control_refresh_failed` y `…_recovered`. Quedó un único par, `bot_control_store_failed` (con el campo `operation`) y `bot_control_store_recovered`, que también cubre las escrituras.
- **Bloqueos pendientes de guardar:** un alta automática sin guardar (base caída) aparece en el panel como "Pendiente de guardar" y no se puede quitar hasta que se guarde.
- **Memoria acotada:** con más de 1000 números activos a la vez, se descartan los contadores por número del menos reciente, como en el limitador de REQ-F-009.
- **Avisos al personal con Twilio:** con Twilio sin Content Template, el aviso de texto libre cuenta como 1 plantilla aunque vaya en varias partes. Twilio es solo para desarrollo.
- **Fallo abrupto:** un fallo abrupto del proceso puede perder los incrementos de contador que aún no se habían guardado (aceptado en el plan).
- **Pendiente de la sesión principal:** actualizar `pendientes.md` (D-4). No lo toqué.

## QA Action Plan

### Objetivo

Validar con evidencia que la capa de protección del bot (RF-1 a RF-10) cumple CA-1 a CA-16, que la página `/admin/bot` es segura, accesible y responsive, que la migración y el cambio de `deploy/` se pueden desplegar y revertir sin incidentes, y que no hay regresiones en el bot, el panel ni las landings.

### Requisito bajo prueba

REQ-F-025 versión 1 (aprobada), Technical Action Plan D-T1 a D-T11 (aprobado con "apruebo el plan") e Implementation Result (aprobado con "apruebo la implementacion", 2026-10-14). Alcance de la rama `feature/REQ-F-025-topes-coste-abuso-bot`, sin commits: 26 archivos modificados y los nuevos listados en `git status`.

### Criterios de aceptación (cada uno → pruebas que lo cubren)

| CA | Pruebas existentes (del Implementation Result) | Verificación adicional de QA |
| --- | --- | --- |
| CA-1 | `whatsapp-bot-protection.test.ts` (tope al empezar, aviso rechazado, D-T3) | QA-T1: llegar al tope **durante** una conversación (ver "Pruebas automatizadas"); el Implementation Result admite que esta rama solo está cubierta con `templateCheck` |
| CA-2 | `whatsapp-bot-protection.test.ts` | Revisar que el bloqueo automático tenga origen `tope` y 7 d en la base (`bot-control-store`/`admin-bot`) |
| CA-3 | `whatsapp-bot-protection.test.ts` | Comprobar un único `bot_burst_limited` por ventana y que el 6.º no cuenta en RF-1.2 |
| CA-4 | `whatsapp-bot-protection.test.ts` | Un único `bot_daily_cap_reached`/`bot_monthly_cap_reached` sin números, también tras reinicio (`*_capped_at`) |
| CA-5 | unitarias + `bot-control-store.test.ts` (MySQL) | QA-T2: frontera exacta del presupuesto con el cupo gratuito y cambio de día/mes en `America/Mexico_City` |
| CA-6 | unitarias + `chat-bot-contract.test.ts` | Bloqueo vencido vuelve a ser atendido sin reiniciar |
| CA-7 | `admin-bot.test.ts`, `admin-authorization-matrix.test.ts` | Navegador: el editor no ve enlace ni tarjeta y recibe 403; auditoría visible en `bot_audit` |
| CA-8 | unitarias + `admin-bot.test.ts` | Rechazo del personal escrito en las 3 formas (`+52 55…`, `521…`, 10 dígitos) |
| CA-9 | unitarias | QA-T1 (alias `521`/`52` del mismo número en conversaciones distintas) |
| CA-10 | `whatsapp-bot-protection.test.ts`, `bot-control.test.ts` | Escalones 24 h / 7 d / 30 d con historial y D-T7 (no texto) |
| CA-11 | orquestador con protección | Log de cola llena como mucho uno por minuto y sin números |
| CA-12 | `admin-bot.test.ts` (de punta a punta) | Navegador: pausar y reanudar desde el panel; landings en 200 mientras está pausado |
| CA-13 | `db-outage` con `tcp-proxy` + unitaria | Revisar que el log no lleve el `message` de Prisma ni datos de conexión |
| CA-14 | `bot-protection-config.test.ts`, `server-startup-config.test.ts` | Arranque real con un umbral inválido y con el bot sin clave: código 1, mensaje claro, sin el valor |
| CA-15 | `admin-bot.test.ts`, `bot-control-store.test.ts` | Revisión de seguridad y privacidad (ver "Pruebas negativas") |
| CA-16 | `content.test.ts` | Revisar que los 4 textos estén en `src/content/common/bot.ts` y usen sus marcadores |

### Riesgos identificados

- **R-1 Conversaciones por número sin normalizar:** `orchestrator.ts` guarda las conversaciones con `message.from` sin canonizar, mientras los topes usan `canonicalPhone`. El mismo número con `521` y con `52` puede tener dos conversaciones, y es la vía para llegar al tope de pedidos durante una conversación (CA-1, 2.º escenario, y CA-9).
- **R-2 Privacidad del motivo:** D-T4 solo rechaza 8 o más dígitos **seguidos**; un número escrito con espacios o guiones en el motivo (`55 1234 5678`) podría guardarse en la base (CA-15).
- **R-3 Despliegue:** el compose pasa 22 umbrales, pero `deploy/env.production.example` solo lista 7; la prueba de humo genera el `.env` desde esa plantilla. El orden de despliegue de `docs/despliegue.md` §7 depende del código 4 de `deploy.sh` (suma de `deploy/`).
- **R-4 Vuelta atrás:** la versión anterior (`main`) debe arrancar contra una base con la migración nueva y `DATABASE_ALLOW_NEWER_SCHEMA=true`.
- **R-5 FK `Restrict` a `user`** desde `bot_block`, `bot_audit` y `bot_control`: no hay borrado de usuarios en la app (se desactivan), pero las pruebas que vacían `user` sí se ven afectadas (`admin-db-security.test.ts` se ajustó).
- **R-6 Desarrollo local:** con el bot habilitado en `.env` y sin la clave, `npm start`/`npm run dev` no arrancan (anunciado en el Implementation Result).
- **R-7 Desviación de logs:** `bot_control_refresh_failed/recovered` del plan quedó como `bot_control_store_failed/recovered`. CA-13 solo exige "registra el error": se valida el comportamiento, no el nombre.
- **R-8 Calibración de ráfaga:** un cliente legítimo que pega varios mensajes seguidos puede perder respuestas (riesgo aceptado en T1; solo se documenta lo observado).

### Pruebas funcionales

- F-1 Recorrido de `npm run bot:chat` (simulador con protección en memoria): pedido normal completo de punta a punta, y después forzar con variables de entorno bajas (`BOT_LIMIT_ORDERS_PER_NUMBER_DAY=1`, `BOT_LIMIT_BURST=2`, `BOT_REPEAT_COUNT=2`) los mensajes fijos `orderLimitReached`, silencio por ráfaga y enfriamiento. Evidencia: transcripción.
- F-2 Panel `/admin/bot` como admin (navegador): ver estado, contadores de hoy y del mes, estado de cada tope con texto; alta manual (24 h, 7 d, 30 d, permanente), baja, pausar y reanudar con motivo; aviso de éxito con el número enmascarado; auditoría en `bot_audit` (consulta SQL a la base de QA).
- F-3 "Alcanzaron un tope hoy" → "Bloquear": con un arnés local (abajo) que genera topes sin red, bloquear desde la tabla y comprobar la entrada en la lista negra.
- F-4 Estado coherente con el bot desactivado (sin `WHATSAPP_BOT_*`): webhook en 503, la página muestra "Desactivado" y el alta deshabilitada si no hay clave.

### Pruebas negativas y casos límite

- N-1 Formulario de alta: número inválido (7 dígitos, 16 dígitos, letras), personal en las 3 formas, número ya bloqueado (mensaje exacto de D-T4), duración fuera de la lista, motivo > 200, motivo con caracteres de control, motivo con 8 dígitos seguidos y con dígitos separados (R-2), campo extra (400), sin CSRF (403). Tras cada error: 422, resumen con enlaces a los campos y **teléfono vacío** en el HTML.
- N-2 `:id` inexistente, no numérico o ya quitado → 404; `:token` inválido, ya usado (segundo POST del mismo token) o de otro día → 404 (un solo uso).
- N-3 Editor: GET y los 4 POST a `/admin/bot*` → 403 con la página `forbidden`; sin sesión → 303 al acceso.
- N-4 Base caída en el panel → 503 "no disponible" sin detalles de Prisma (prueba existente `db-outage`, revisada).
- N-5 Privacidad (CA-15 y el punto pedido por la sesión principal):
  - grep del HTML de cada respuesta del panel, de los logs capturados en la suite y en el servidor local, y de un volcado de las 4 tablas de la base de QA, buscando los números completos de prueba (con `521`, `52` y 10 dígitos), la clave `WHATSAPP_BOT_BLOCKLIST_KEY`, la clave anterior y los seudónimos HMAC (64 hex): 0 coincidencias;
  - la clave no aparece en ningún `logger.*` ni en mensajes de error de `env.ts` (lectura dirigida de `env.ts`, `bot-control.ts` y `server.ts`);
  - el HTML del botón "Bloquear" solo lleva un token de 32 hex, nunca el seudónimo.
- N-6 Casos límite del ticket: medianoche y cambio de mes con una conversación en curso; reinicio (topes por número a 0, lista negra, contadores globales e interruptor intactos); mensaje reenviado por Meta (`seen`) no cuenta dos veces; tope global alcanzado a mitad de conversación; desbloqueo manual de un bloqueo automático; interruptor cambiado con mensajes en cola; los mensajes fijos cuentan como salientes. Se verifican con las pruebas existentes y, donde falten, con QA-T2.

### Pruebas responsive

`/admin/bot` en 375×812, 768×1024 y 1440×900: sin desbordamiento horizontal de la página (las tablas se desplazan dentro de su contenedor), botones y campos alcanzables, áreas táctiles adecuadas, textos sin cortes. Regresión rápida de `/admin` (inicio con la tarjeta nueva) en 375 y 1440.

### Pruebas de accesibilidad

- Un solo `h1` ("Bot") y un `h2` por sección; landmarks (`header`, `nav`, `main`); enlace "Bot" marcado como actual en la navegación.
- Tablas con `caption` y `th scope`; foco visible al tabular por toda la página y los formularios; orden de tabulación lógico.
- Formulario de alta: `label` asociada, ayuda con `aria-describedby`, `type="tel"`, `inputmode="tel"`, `autocomplete="off"`; resumen de errores con enlaces a los campos y foco/anuncio según el patrón del panel (`.claude/rules/formularios.md`).
- Estado de cada tope ("Disponible"/"Alcanzado") y del interruptor comunicado con texto, no solo con color; contraste suficiente (lectura de estilos computados).
- Página sin JavaScript nuevo: los formularios funcionan con POST-redirect-GET (comprobar que no hay `<script>` nuevo y que la CSP no cambió).

### Pruebas UX/UI (vs. _stich_source_/)

No hay diseño de panel en `_stich_source_/` (comprobado en T1). Se valida la coherencia con el resto de `/admin` (cabecera, navegación, avisos, botones, tablas de usuarios/productos) y que la hoja `admin` regenerada no altera otras páginas del panel.

### Pruebas de integración (WhatsApp)

- Webhook: firma, 200 inmediato y deduplicación sin cambios (`chat-bot-contract.test.ts` con Meta y Twilio, `whatsapp-twilio-qa-round1.test.ts` y pruebas del webhook existentes).
- CTA de WhatsApp de ambas landings sin cambios (`href`, `target`, `rel`) en `/`, `/molotes` y `/birria`.
- Sin envíos reales: el servidor local usa las credenciales falsas de `tests/helpers.ts` (`BOT_ENV`) y no se publica ningún webhook contra Meta/Twilio reales.

### Pruebas de performance

- Sin consultas a la base por mensaje (lectura dirigida del camino `admit`/`reserveSend` y del refresco perezoso).
- Memoria acotada (`maxTracked`, 200 entradas en "alcanzaron un tope", 100 pendientes) cubierta por las unitarias.
- Panel: sin JS, peso de `public/css/admin/main.css` antes/después (`git diff --stat` del CSS generado o tamaño en bytes) y sin errores de consola.

### Pruebas SEO

Las landings no cambian: `title`, meta description, canonical y Open Graph de `/`, `/molotes` y `/birria` siguen igual (pruebas existentes + `curl`). `/admin/bot` conserva `noindex` como el resto del panel.

### Pruebas de regresión

- Suite completa `npm test` (incluye landings, panel, productos, usuarios, webhook, bot, migraciones y colación), `npm run typecheck`, `npm run lint` y `npm run build:css`.
- Blast radius de CodeGraph: `createApp` (34 llamadores, 16 archivos de prueba), `createBotOrchestrator` (20 llamadores, 9 archivos de prueba), `createBotControl`, `createBotProtection` y `canonicalPhone`: todos sus archivos de prueba están en la suite.
- `toCloudApiRecipient` delega en `withoutMxMobilePrefix`: comportamiento idéntico (pruebas existentes de `cloud-api`).
- **El "1 fallo esperado" de `npm test`:** es `it.fails('una prueba que falla a mitad (debe fallar)')` en `tests/integration/local-server.test.ts:87` (REQ-F-011, anterior a este ticket). Falla a propósito con un servidor abierto para comprobar que `listenLocal` lo cierra igualmente; Vitest lo informa como "expected fail" y no rompe la suite. QA confirmará en el resumen de Vitest que es el **único** resultado distinto de "passed" y que no hay pruebas saltadas.
- **Migración `20261015024103_bot_proteccion`:**
  - `migrations-collation.test.ts` y `db-migrations.test.ts` en verde; lectura de la migración (4 `CREATE TABLE` con `utf8mb4_es_0900_as_cs`, solo `CREATE TABLE`/`ADD CONSTRAINT`, sin `ALTER`/`DROP` sobre tablas existentes);
  - `prisma migrate diff` entre el esquema y las migraciones sin diferencias;
  - **vuelta atrás:** en una base de QA desechable `restaurante_test_qa025` con todas las migraciones aplicadas, arrancar la versión de `main` (worktree temporal en el scratchpad, `db:generate` propio) con `DATABASE_ALLOW_NEWER_SCHEMA=true` y comprobar `/`, `/molotes`, `/birria` en 200 y `/admin` en 303; sin la bandera, debe negarse a arrancar como hasta ahora.
- **Despliegue (`deploy/`):**
  - `docker compose -f deploy/compose.prod.yaml --env-file <.env generado desde env.production.example> config -q` y `config --format json`: las 24 variables nuevas llegan a `services.app.environment`, vacías por defecto, y la app arranca con ellas vacías (vacío = defecto);
  - coherencia entre compose, `deploy/env.production.example`, `.env.example` y README (R-3);
  - `shellcheck` de `deploy.sh` y `ci/smoke.sh` sin cambios; si Docker lo permite en local, `bash deploy/ci/smoke.sh` con imágenes construidas en local (si no, queda para el job `despliegue` del PR, que la ejecuta en cada PR);
  - orden documentado en `docs/despliegue.md` §7 frente a `deploy.sh` (`.env` comprobado antes de la suma, `fail 4` si `deploy/` no coincide) y la suma que calcula el job `deploy` de `ci.yml`.
- Landings: `/`, `/molotes`, `/birria` en 200 con el bot pausado y sin pausar.

### Pruebas automatizadas

Existentes: todas las del Implementation Result más la suite completa.

Nuevas de QA (solo en `restaurante/tests/`, archivo `tests/integration/bot-protection-qa-req-f-025.test.ts` o unitario equivalente, con `setupAdmin`/`listenLocal` y dobles de proveedor, nunca la red):

- **QA-T1 (CA-1 escenario 2, CA-9, R-1):** con `BOT_LIMIT_ORDERS_PER_NUMBER_DAY=1`, abrir una conversación desde `521XXXXXXXXXX` y otra desde `52XXXXXXXXXX` (mismo número), confirmar la primera (sale 1 plantilla) y luego la segunda: no sale plantilla y el cliente recibe `orderCapContact` con el código y el contacto.
- **QA-T2 (CA-5, casos límite):** presupuesto en la frontera del cupo gratuito con tarifas configuradas; contadores al cruzar 23:59→00:00 y fin de mes en `America/Mexico_City` con el servidor en otra zona (`TZ=UTC`).
- **QA-T3 (CA-15, N-5):** flujo completo (bloqueo automático, alta manual, "Bloquear" desde topes, pausa) recogiendo logs y HTML; aserción de 0 apariciones de números completos, de la clave, de la clave anterior y de seudónimos de 64 hex.
- **QA-T4 (N-2):** el token de "Bloquear" es de un solo uso (segundo POST → 404) y un editor no puede usarlo (403).

Si alguno ya está cubierto por una prueba existente al revisarla, no se duplica y se cita la existente.

### Pruebas en navegador

- Servidor local con `PORT=3100`, contra la base de QA desechable `restaurante_test_qa025` (creada con el usuario DDL de pruebas, migrada con `prisma migrate deploy` y borrada al terminar), con `ADMIN_USER=dueno` y un hash de la contraseña de pruebas del proyecto (`npm run admin:hash-password`), credenciales falsas de bot (`BOT_ENV`) y una clave de prueba. Nunca las credenciales reales ni la base de desarrollo.
- Un editor de prueba creado desde `/admin/usuarios` para CA-7.
- Para poblar "alcanzaron un tope hoy" sin llamar a Meta: arnés en el scratchpad que monta `createApp` con un `fetch` de proveedor falso (como `setupAdmin`), o webhooks firmados con el App Secret falso **solo** si los envíos no salen a la red; si no es posible sin red, F-3 queda cubierto por `admin-bot.test.ts` y se anota.
- Claude in Chrome: `/admin/bot` en los 3 viewports, teclado, foco, formularios con errores, pausa/reanudación, alta/baja/bloqueo; consola sin errores; páginas con JavaScript desactivado no aplica (no hay JS nuevo), se verifica por ausencia de `<script>` nuevos.
- Arranque con el bot habilitado y sin clave: debe terminar con código 1 y un mensaje claro (CA-14, D-T1).

### Evidencia requerida

Salidas de `npm test` (resumen con el "expected fail"), `typecheck`, `lint`, `build:css`; salida de `docker compose config`; consultas SQL a la base de QA (auditoría, bloqueos, ausencia de números completos); transcripción de `bot:chat`; capturas o texto de página de `/admin/bot` en los 3 viewports y como editor; códigos HTTP de `curl`; resultado de la vuelta atrás con la versión de `main`.

### Criterios de aprobación

- CA-1 a CA-16 en PASS con evidencia.
- `npm test` en verde con el único "expected fail" de `local-server.test.ts`; `typecheck`, `lint` y `build:css` con código 0.
- Ningún número completo, clave ni seudónimo en HTML, logs o base de datos.
- Migración aditiva con la colación correcta y vuelta atrás verificada.
- Compose válido y orden de despliegue documentado coherente con `deploy.sh` y el CI.
- Sin defectos BLOCKER/CRITICAL; los MAJOR, solo con decisión explícita del usuario.
- Sin regresiones en el bot, el panel ni las landings.

Al terminar se detiene el servidor, se cierra la pestaña, se borra la base `restaurante_test_qa025` y el worktree temporal, y no se toca el `.env` local.

## QA Report

### Ronda

1 (2026-10-14). QA Action Plan aprobado por el usuario con "Apruebo el plan".

### Pruebas ejecutadas

Todas desde `restaurante/`, en la rama `feature/REQ-F-025-topes-coste-abuso-bot`, con el árbol de trabajo sin commits.

- **Calidad:**
  - `npm run build:css`, `npm run typecheck` y `npm run lint` terminan con 0, sin avisos.
  - `npm test`, antes de las pruebas de QA: 85 archivos, `1700 passed | 1 expected fail (1701)`.
  - `npm test`, con las pruebas de QA: 86 archivos, `1706 passed | 1 expected fail (1707)`.
  - El "expected fail" es `it.fails` en `tests/integration/local-server.test.ts:87` (REQ-F-011): falla a propósito para comprobar que `listenLocal` cierra el servidor. No hay pruebas saltadas.
- **Pruebas nuevas de QA:** `tests/integration/bot-protection-qa-req-f-025.test.ts`, con 6 pruebas en verde:
  - QA-T1: tope de pedidos alcanzado durante una conversación, con el alias `521`/`52`.
  - QA-T2 (3 pruebas): frontera del presupuesto, cambio de mes y cambio de día en la zona del negocio (31-10 23:58 MX = 1-11 UTC).
  - QA-T3: barrido de privacidad de un flujo completo por HTTP con MySQL real (62 mensajes con bloqueo automático "tope", alta manual, "Bloquear" desde topes, errores de formulario, pausa y reanudación).
  - QA-T4: token de "Bloquear": un editor recibe 403 con un token válido, el admin puede usarlo una sola vez, y tras el cambio de día ya no vale.
- **Migración:**
  - Base desechable `restaurante_test_qa025`: `prisma migrate deploy` aplicó la migración nueva.
  - `prisma migrate diff --exit-code`: "No difference detected".
  - `information_schema`: las 4 tablas `bot_*` y todas sus columnas de texto usan `utf8mb4_es_0900_as_cs` (0 columnas con otra colación).
  - El SQL solo contiene `CREATE TABLE` y `ADD CONSTRAINT` sobre tablas nuevas.
- **Vuelta atrás:** la versión de `main` (worktree temporal) sobre esa base:
  - sin bandera, se niega a arrancar (`DATABASE_NEWER_THAN_CODE`);
  - con `DATABASE_ALLOW_NEWER_SCHEMA=true`: `/`, `/molotes` y `/birria` responden 200 y `/admin` responde 303.
- **Arranque real (CA-14):**
  - bot sin clave → código 1, "WHATSAPP_BOT_BLOCKLIST_KEY es obligatoria…";
  - `BOT_BUDGET_MONTH_USD=abc`, `BOT_LIMIT_OUTBOUND_DAY=0`, `BOT_BLOCK_REPEAT_STEPS_HOURS=24,12`, `BOT_QUEUE_MAX=1e3`, diario mayor que mensual y clave anterior igual a la actual: cada uno da un mensaje claro;
  - la clave corta no aparece en la salida (0 coincidencias).
- **Servidor local en el puerto 3100:** base de QA, credencial de pruebas `dueno` y credenciales falsas de `BOT_ENV`. Sin envíos a Meta: el único webhook se envió con el bot pausado.
  - `/`, `/molotes` y `/birria` responden 200 con el bot pausado; el webhook firmado responde 200 y se registra `bot_paused_dropped`, sin envíos.
  - Tras un SIGTERM real y un nuevo arranque, el interruptor sigue en "Bot pausado".
  - Con el bot sin configurar, el webhook responde 503 y la página muestra "Desactivado: sin configuración (el webhook responde 503)" y el alta deshabilitada con su explicación.
- **Navegador (Claude in Chrome):** `/admin/bot` como admin.
  - Alta con errores: el motivo `ver 55-1234-5678` se rechaza; el número del personal escrito como `55 1111 0001` se rechaza con "Ese número es del personal…". En ambos casos: resumen con enlaces, `aria-invalid` y `aria-describedby` hacia el error, y el teléfono vuelve vacío.
  - Alta válida: `+52 1 55 0000 4321`, 30 d → fila `*********4321`.
  - Pausar con motivo, reanudar y quitar el bloqueo.
  - Consola sin errores.
- **Editor (`eva-qa`, creado desde `/admin/usuarios`):** `/admin` sin enlace al Bot; GET `/admin/bot` y los 4 POST responden 403.
- **SQL de `bot_audit`:** `block_added` (dueno, `*********4321`, "Pedidos falsos QA", 30 d), `bot_paused` (motivo "Prueba QA") y `bot_resumed`. `bot_block` solo guarda `key_id`, `last4` y el seudónimo.
- **Simulador `bot:chat`:**
  - pedido completo de punta a punta, hasta "¡Listo! … fue enviado a Moloteando";
  - 7 mensajes seguidos: a partir del 6.º, silencio (ráfaga 5/10 s).
- **Despliegue:**
  - `docker compose -f deploy/compose.prod.yaml config -q` termina con 0, con un `.env` generado desde `deploy/env.production.example`, como en `smoke.sh`.
  - Las 24 variables nuevas llegan a `services.app.environment`, vacías (= valores por defecto), y coinciden 1:1 con `.env.example`. La app no recibe `MYSQL_ROOT_PASSWORD`.
  - `deploy.sh`, `ci/smoke.sh` y `ci.yml` no cambian.
  - El orden de `docs/despliegue.md` §7 es coherente con `deploy.sh`: `fail 4` cuando la suma de `deploy/` no coincide, antes de tocar nada.

### Criterios de aceptación

- **CA-1 PASS:**
  - unitarias existentes;
  - QA-T1: la 2.ª confirmación recibe "no se pudo enviar automáticamente al personal…", con el código y `wa.me/<personal>`, y sale 1 sola plantilla.
- **CA-2 PASS:** unitaria existente; QA-T3: bloqueo automático con origen `tope` en MySQL.
- **CA-3 PASS:** unitarias; `bot:chat` real: el 6.º mensaje en 10 s no recibe respuesta.
- **CA-4 PASS:** unitaria (un único `bot_daily_cap_reached` sin números).
- **CA-5 PASS:**
  - QA-T2: 4 salientes = 2 gratis + 2 USD, igual al presupuesto; el 5.º se silencia y hay un único `bot_monthly_cap_reached`;
  - el mes y el día cambian a las 00:00 de México;
  - persistencia tras reinicio: unitaria y `bot-control-store`.
- **CA-6 PASS:** unitarias y contrato con los dos proveedores.
- **CA-7 PASS:** `admin-bot.test.ts`, QA-T4, el navegador (editor 403 y sin enlace) y la auditoría en SQL.
- **CA-8 PASS:** el personal se rechaza también con 10 dígitos (navegador); exenciones en la unitaria.
- **CA-9 PASS:** unitaria y QA-T1.
- **CA-10 PASS:** unitarias (enfriamiento y escalones 24 h / 7 d / 30 d).
- **CA-11 PASS:** unitaria (un registro por minuto, sin números).
- **CA-12 PASS:** `admin-bot.test.ts` de punta a punta; servidor real: pausa desde la UI, webhook en 200 sin envíos, landings en 200, auditoría y estado mantenido tras un SIGTERM y un nuevo arranque.
- **CA-13 PASS:** `admin-bot.test.ts` con `tcp-proxy`: el log no lleva `mysql://`, IP ni SQL.
- **CA-14 PASS:** unitarias, `server-startup-config` y arranques manuales.
- **CA-15 PASS:**
  - QA-T3: 0 coincidencias de los números completos (en sus 3 formas), de la clave y de los seudónimos en el HTML y los logs, y de los números y la clave en las 4 tablas;
  - los logs del servidor real tienen 0 coincidencias;
  - el motivo con dígitos separados por guiones se rechaza.
- **CA-16 PASS:** `content.test.ts`; los 4 textos están en `src/content/common/bot.ts`.

### Defectos encontrados

#### DEF-001

- **Severidad:** TRIVIAL.
- **Criterio de aceptación afectado:** ninguno. Es una indicación del Technical Action Plan (Frontend, punto 6: "Alta y baja muestran sus avisos de éxito con el número enmascarado").
- **Descripción:** los avisos de éxito son "Número bloqueado." y "Bloqueo quitado: el número vuelve a ser atendido.", sin el número enmascarado.
- **Pasos para reproducir:** como admin, dar de alta un número en `/admin/bot`.
- **Resultado esperado:** el aviso incluye `*********4321`.
- **Resultado actual:** el aviso no lo incluye. La fila de la tabla sí lo muestra.
- **Evidencia:** texto de la página `/admin/bot?ok=blocked` y `?ok=unblocked`.
- **Impacto:** cosmético; la información está en la tabla.
- **Recomendación:** incluir el número enmascarado en el aviso, o aceptar el comportamiento actual.

### Observaciones (no son defectos)

- `bot:chat` usa siempre los umbrales por defecto y no lee `BOT_*` del entorno, conforme a D-T10. Con la ráfaga de 5 cada 10 s, pegar varias líneas seguidas en el simulador deja sin respuesta a partir de la 6.ª.
- `deploy/env.production.example` lista 7 de los 22 umbrales. El compose los pasa todos con `${VAR:-}`, así que añadir cualquiera al `.env` del VPS funciona sin cambios en `deploy/`.
- Con el bot ya activo, el job `deploy` fallará con el código 4 tras el merge, siempre, porque el compose cambió. `docs/despliegue.md` lo dice como condicional ("si…").
- La plantilla al personal sigue llevando el número completo del cliente: comportamiento previo y necesario. No va a logs, base ni HTML.

### Regresión

- Suite completa en verde.
- Blast radius de `createApp`, `createBotOrchestrator`, `createBotControl`, `createBotProtection` y `canonicalPhone`: todas sus pruebas están en la suite.
- Webhook (firma y 503 sin configuración) sin cambios.
- Landings en 200.
- Vuelta atrás verificada.

### Responsive

- 375×812 y 768×1024: iframes del mismo origen, porque la ventana no se podía redimensionar. 1280×850: ventana real.
- 0 px de desbordamiento horizontal en todos los tamaños.
- En 375, la tabla de la lista negra (618 px) se desplaza dentro de su contenedor (`overflow-x: auto`).
- Sin textos cortados y con controles de al menos 24 px de alto. El enlace "Saltar al contenido" (sr-only) es de antes de este ticket.

### Accesibilidad

- Un `h1` ("Bot de WhatsApp") y un `h2` por sección.
- Landmarks `header`, `nav` y `main`; el enlace "Bot" lleva `aria-current`.
- Tablas con `caption` y `th scope` (`col`/`row`).
- Etiquetas asociadas; el teléfono es `type=tel`, `inputmode=tel`, `autocomplete=off` y tiene ayuda con `aria-describedby`.
- Resumen de errores con `role=alert` y enlaces a los campos.
- "Quitar" tiene nombre accesible con el número enmascarado.
- Foco visible con Tab (anillo en los campos y contorno en los botones; capturas).
- Contraste mínimo medido de 8.8:1; el estado se comunica con texto ("Disponible"/"Alcanzado").
- Sin `<script>`.

### UX/UI

Sin diseño en `_stich_source_/`. La página es coherente con el resto de `/admin` (cabecera, navegación, avisos, tarjetas y tablas). Capturas:

- `/var/folders/qq/ffbhzmd91t5frq8508zm2knw0000gn/T/claude-chrome-screenshots-kcbSrl/screenshot-1792035218356-1.jpg`
- `/var/folders/qq/ffbhzmd91t5frq8508zm2knw0000gn/T/claude-chrome-screenshots-kcbSrl/screenshot-1792035231184-2.jpg`

### Performance

Sin JS ni consultas por mensaje en el camino del bot; el panel no carga scripts y la consola no tiene errores. La hoja `admin` se regeneró sin errores.

### SEO

Las landings no cambian: siguen en 200 y sus pruebas de SEO e instantánea están en verde. `/admin/bot` lleva `noindex, nofollow`.

### Pendientes de revisión manual

- La prueba de humo completa de `deploy/ci/smoke.sh` (construye las imágenes, Traefik y registro) no se ejecutó en local. La ejecuta el job `despliegue` del CI en el PR, y debe estar en verde antes del merge.
- `shellcheck` no está instalado en local; los scripts de `deploy/` no cambiaron.
- Antes del merge, si el bot ya está activo: añadir `WHATSAPP_BOT_BLOCKLIST_KEY` al `.env` del VPS. Después del merge: reinstalar `deploy/` (§1.3) y volver a ejecutar `deploy`.
- Al desarrollar en local con el bot habilitado en `.env`, hay que añadir la clave (R-6).

Limpieza: servidor detenido; pestaña cerrada; base `restaurante_test_qa025` (y su shadow) y worktree temporal borrados; `.env` y código de producción sin tocar. El servidor `dev-server.ts` que ya estaba en marcha (PID 59439) no es de QA y no se tocó.

### Resultado final

QA_APPROVED

## Historial de cambios

### Versión 1

- Descripción inicial (2026-10-14), a partir de F-04 de la auditoría OWASP y de la solicitud del usuario.
- Preguntas de aclaración respondidas con "acepto las recomendaciones": se aplicaron las opciones recomendadas de las preguntas 1 a 12, y en la 13 se mantiene el supuesto prudente de que se cobran los mensajes de servicio.
- En la misma respuesta el usuario aceptó añadir cuatro controles:
  - el límite de ráfaga (RF-1.4);
  - la cola global acotada (RF-8);
  - la detección de repetidos y bucles con escalado (RF-7);
  - el interruptor de emergencia (RF-9).
- La deduplicación persistente queda fuera de alcance.
- Aprobada por el usuario con "aprobado".

### Revisión técnica (T1)

- 2026-10-14: senior-fullstack agrega el Technical Action Plan con las decisiones técnicas D-T1 a D-T11 (opciones recomendadas) y pone el estado NEEDS_TECHNICAL_PLAN_APPROVAL. No se modificó código.

### Implementación (T2)

- 2026-10-14: el usuario aprobó el Technical Action Plan con "apruebo el plan". Se creó la rama `feature/REQ-F-025-topes-coste-abuso-bot`, el ticket pasó a `in-progress/` (IN_PROGRESS) y se implementó por capas. Validaciones en verde. Estado: NEEDS_IMPLEMENTATION_APPROVAL.

### QA (Q1)

- 2026-10-14: el usuario aprobó la implementación con "apruebo la implementacion". senior-qa agrega el QA Action Plan (sin ejecutar la batería definitiva) y pone el estado NEEDS_QA_PLAN_APPROVAL.

### QA (Q2, ronda 1)

- 2026-10-14: el usuario aprobó el QA Action Plan con "Apruebo el plan". senior-qa ejecuta el plan, agrega `tests/integration/bot-protection-qa-req-f-025.test.ts` (QA-T1 a QA-T4) y registra el QA Report. Un defecto TRIVIAL (DEF-001). Estado: QA_APPROVED.

### Commit y Pull Request (T4)

- 2026-10-14: se corrige DEF-001 a petición del usuario ("A"). Validaciones en verde (1706 pruebas). Commit, rebase sobre `origin/main` y PR contra `main`.
