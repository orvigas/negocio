# REQ-F-043 — Control del bot en el admin nuevo: pausa, bloqueos y topes

## Estado

QA_APPROVED

PR 1 de 3 (contratos y `api`) aprobado por QA, sin commit. Quedan el PR 2 y el PR 3.

## Aprobación

Aprobado por el usuario (versión 2, fecha 2026-11-04). Cita textual: "Si lo apruebo", en respuesta a "¿Apruebas el requisito tal como está?".

Se le presentaron objetivo, alcance, las 4 decisiones, fuera de alcance, riesgos, la propuesta de RF-12 y los criterios CA-1 a CA-22, estos últimos solo mencionados por número; no pidió verlos.

Paso 4, ticket 4 del plan de migración (`restaurante/docs/arquitectura.md` §8, "Plan del paso 4 (REQ-F-039)"). Los PR de este ticket van a `epic/arquitectura` (`.claude/rules/git.md`).

### Autorización para `.claude/CLAUDE.md`

Autorizada por el usuario (2026-11-04, transmitida por la sesión principal) la actualización de `.claude/CLAUDE.md` §8, que hoy describe `inventory-manager` sin el bot. Cita textual: "Lo autorizo", en respuesta a "¿Autorizas actualizar `.claude/CLAUDE.md` §8 para que describa el bot en `inventory-manager`?". El cambio lo hace `senior-fullstack` dentro de la implementación y se limita a esa sección.

## Decisiones del usuario

- **D-1 — Topes:** "Solo mostrarlos (Recomendado)". Los topes se muestran y no se editan desde el admin.
- **D-2 — `/admin/bot` con `ADMIN_NEW_URL`:** "Solo lectura y 410 (Recomendado)". Se acepta el riesgo de no tener pausa web si cae `inventory-manager`.
- **D-3 — Personal en "alcanzaron un tope hoy":** "No aparece (Recomendado)". Tampoco se puede bloquear por token.
- **D-4 — Teléfono tras un alta fallida:** "Nunca, vuelve vacío (Recomendado)". Vale también con la API caída; duración y motivo se conservan.

Estas decisiones son propias de este ticket: no confundirlas con las D-1 a D-4 de REQ-F-042.

## Decisiones técnicas del usuario

Respuestas del 2026-11-04, transmitidas por la sesión principal:

- **DT-1 — CA-7 (H-6):** "Atender ya (Recomendado)". Opción A.
- **DT-2 — División en PR:** "3 PR (Recomendado)".
- **DT-3 — Fila histórica del personal (H-9):** "Revisar tras desplegar (Recomendado)". `isBlocked` no cambia.

**Aprobación del Technical Action Plan:** "Apruebo, implementar". Se indicó al usuario que incluye corregir H-1, H-7 y H-8, no migrar el esquema, añadir a `despliegue.md` §6 el paso de `inventory-manager` en la vuelta atrás, y la excepción a CA-17 (sin `ADMIN_NEW_URL` cambia el texto `REACHED_MOVED_MESSAGE`).

## Objetivo

Que los administradores gestionen la protección del bot desde el admin nuevo, con el mismo alcance que `/admin/bot`, recuperando la lista "alcanzaron un tope hoy" (D-2 de REQ-F-042), para poder retirar `/admin` en el ticket 6.

**Actor:** usuario con rol administrador. Un editor no tiene acceso.

## Alcance

- Contratos y endpoints en `/api/v1/admin`.
- Pantalla "Bot" en `inventory-manager`.
- Solo lectura en `/admin/bot` con `ADMIN_NEW_URL`.
- Documentación.

## Fuera de alcance

- Editar topes (D-1).
- Ver la auditoría en pantalla.
- Mostrar los topes por número.
- Persistir "alcanzaron un tope hoy".
- Pausa sin MySQL.
- Quitar las variables del bot de `app` (ticket 6, P-2 de REQ-F-042).
- Retirar `/admin` (ticket 6).

## Hechos observados en el repositorio

Observados el 2026-11-04 sobre `epic/arquitectura` (`76a70f2`).

- La tabla de la lista negra es `bot_block` (`schema.prisma`).
- Los topes son variables de entorno de solo lectura (`parseBotLimits`, `compose.prod.yaml`). La página actual muestra 5 contadores globales: avisos hoy y mes, mensajes hoy y mes, y gasto del mes. Los topes por número no se muestran.
- `api` como único escritor del panel solo es cierto con `ADMIN_NEW_URL`. Sin ella (solo en local), `/admin/bot` sigue escribiendo.
- `ADMIN_NEW_URL` es obligatoria en `compose.prod.yaml`: en producción el cambio se activa al desplegar, sin pasos manuales.
- `inventory-manager` no recibe `*bot-env` en el compose: no tiene clave ni números del personal. Sus logs llevan método, ruta, estado, duración e IP, nunca cuerpos.
- `_stich_source_/` solo contiene diseños de landings; no hay pantalla de administración. `/admin/bot` ya declara "sin diseño fuente". Aplica P-4 de REQ-F-039 (`DESIGN.md` de Birria y acento por negocio).
- La auditoría no se muestra en la página actual. El store la escribe en la misma transacción que cada acción manual.

Quién escribe hoy:

| Tabla | `landing-pages` (`/admin/bot`) | `api` |
| --- | --- | --- |
| `bot_control` | Sí (pausa). Es el único escritor real | Sin llamada en producción |
| `bot_block` | Altas y bajas manuales | Altas automáticas, reintentos, rekey y purga |
| `bot_audit` | Lo manual | Automático, caducidades y purga |
| `bot_usage` | No (solo lee; `mode: 'panel'`) | Sí, único |

Datos en memoria y propagación:

- Desde `/admin`, un cambio tarda hasta `BOT_CONTROL_REFRESH_SECONDS` (10 s; `control-timers.ts`). Desde `api` es en proceso: `setPaused`, `addManual` y `unblock` cambian la copia que lee el bot.
- "Alcanzaron un tope hoy" vive en el `Map` `reached` de `createBotControl`, en `api`: máximo 200 entradas, tokens de un solo uso, se limpia al cambiar de día y al reiniciar. Topes: `orders`, `messages`, `cooldown`, `burst` y `minute`. `snapshot()`, `blockReached` y `reachedLast4` ya existen.
- En `api`, el uso sale de la memoria del proceso del bot, no de la base.
- Solo `api` necesita la clave HMAC para dar de alta desde el admin nuevo.

## Inferencias sin verificar

- No hace falta migración de esquema.
- El orden de `deploy.sh` (api, inventory-manager, app) cubre la vuelta atrás.
- La tabla de Usuarios de `inventory-manager` se ve bien en 375 px.
- H-3 (comportamiento con MySQL caído) está inferido del código, no ejecutado.
- H-1 está confirmado por lectura de código, no reproducido.

## Hallazgos

- **H-1. Defecto latente que este ticket reabriría.** El personal no está exento de ráfaga ni de tope por minuto: `admit` llama a `guard.rate` y `recordReached` antes de calcular `exempt`. `recordReached` y `blockReached` no comprueban personal, y `isBlocked` no exime. Un número del personal podría entrar en la lista y bloquearse con "Bloquear", contra RF-4 y CA-8 de REQ-F-025. Hoy está tapado porque el botón está desactivado. Se corrige aquí según D-3.
- **H-2. Contradicción resuelta por D-4.** El admin nuevo conserva lo escrito si la API cae (RF-15 de REQ-F-040, salvo contraseñas), y CA-15 de REQ-F-025 prohíbe volver a pintar el teléfono. Prevalece CA-15 de REQ-F-025 para el teléfono.
- **H-3. MySQL caído.** `resolveSession` consulta `users.findById`, así que sin MySQL la autenticación falla antes de llegar a la página, en `/admin` y en la API. El aviso "última copia conocida" solo aparece en fallos parciales, y la pausa no funciona sin MySQL, igual que hoy.
- **H-4. Estado del bot.** Resuelve R-5 de REQ-F-042: el estado "Habilitado" saldrá de la configuración real de `api`.
- **H-5. Texto de `adminOnly`.** Tiene fijo "gestionar usuarios"; `api` debe dar un mensaje correcto para el bot.

## Requisitos

- **RF-1 Acceso.** Pantalla "Bot" y enlace en la cabecera solo para administradores. Orden en la API: sesión (401), rol (403 `FORBIDDEN_ROLE`, antes de mirar cuerpo o id), CSRF (403), cuerpo (413/415/400/422), dominio.
- **RF-2 Estado.** Muestra si el bot está habilitado (y con qué proveedor) o desactivado; activo o pausado, con autor, fecha y motivo.
- **RF-3 Pausa y reanudación.** Con motivo opcional (máximo 200 caracteres, sin 8 o más dígitos seguidos). Efecto en el bot sin esperar el refresco. Queda en `bot_audit`.
- **RF-4 Uso (D-1).** Los 5 contadores con usado, tope y estado en texto ("Alcanzado" o "Disponible"), periodos y zona horaria. Solo lectura.
- **RF-5 Alcanzaron un tope hoy (D-3).** Número enmascarado, tope, hora y "Bloquear" con duración y motivo. Lista vacía con texto propio. El personal no aparece.
- **RF-6 Lista negra.** Número enmascarado, origen, motivo, autor, desde, hasta y "Quitar". Un alta automática aún sin guardar dice "Pendiente de guardar" y no se puede quitar.
- **RF-7 Alta manual.** Teléfono, duración (24 h, 7 d por defecto, 30 d o permanente) y motivo. Toda la validación y el HMAC ocurren en `api`. Rechaza número inválido, personal y ya bloqueado. Sin clave, no hay formulario y el alta responde 409 sin guardar.
- **RF-8 Rotación.** Aviso con cuántos bloqueos siguen con la clave anterior y advertencia de no retirar `WHATSAPP_BOT_BLOCKLIST_KEY_PREVIOUS`.
- **RF-9 Privacidad (D-4).** El teléfono viaja solo en el cuerpo del POST: nunca en URL, logs, contrato de lectura ni HTML. El contrato no expone `phoneHash` ni `keyId`. Tras un error, el teléfono vuelve vacío; duración y motivo se conservan.
- **RF-10 Solo lectura en `/admin/bot` (D-2).** Con `ADMIN_NEW_URL`, la página muestra estado, uso y lista sin formularios, con aviso y enlace a `<ADMIN_NEW_URL>/bot`. Los POST responden 410 sin escribir, tras sesión, permiso y CSRF. Sin `ADMIN_NEW_URL`, sigue como hoy.
- **RF-11 Convivencia.** El refresco de 10 s se mantiene mientras exista el `/admin` actual. `landing-pages` conserva clave, personal y topes hasta el ticket 6.
- **RF-12 Fallos.** Base en fallo parcial: aviso de última copia conocida. API caída o 503: aviso y nada confirmado. Si la API no responde a una escritura, el aviso no afirma que no se guardó e invita a revisar el estado (propuesta del análisis, aprobada con esta versión).
- **RF-13 Accesibilidad y responsive.** Sin JavaScript obligatorio, HTML semántico, avisos `status` y `alert`, foco visible, sin depender solo del color y sin desplazamiento horizontal de la página en 375 px.
- **RF-14 Documentación.** `restaurante/docs/arquitectura.md` (§6, §8 y §10), `restaurante/docs/despliegue.md` (incluido el aviso al personal), `restaurante/README.md` y `.env.example` si aplica. También `.claude/CLAUDE.md` §8, con la autorización del usuario ("Lo autorizo").

## Historias de usuario

- **HU-1:** Como administrador quiero pausar el bot desde el admin nuevo para cortar el gasto o el abuso en una emergencia.
- **HU-2:** Como administrador quiero ver qué números alcanzaron un tope hoy y bloquearlos para frenar el abuso sin conocer su número completo.
- **HU-3:** Como administrador quiero bloquear y desbloquear números para controlar a quién atiende el bot.
- **HU-4:** Como administrador quiero ver el uso frente a los topes para anticipar el gasto.

## Reglas de negocio

- El personal no se puede bloquear por ninguna vía.
- Solo se muestran números enmascarados.
- Los topes son de solo lectura.
- La clave HMAC solo se usa en `api`.
- Cada alta, baja y cambio del interruptor queda en la auditoría.
- Las duraciones son una lista cerrada.

## Criterios de aceptación

- **CA-1 (RF-1).** Given un editor con sesión, When abre `/bot` o llama a cualquier endpoint del bot con o sin cuerpo, Then recibe 403 sin datos y no ve el enlace "Bot".
- **CA-2 (RF-1).** Given un POST sin token CSRF válido, Then recibe 403 y no cambia nada.
- **CA-3 (RF-3).** Given un bot activo, When un administrador lo pausa con motivo, Then el siguiente mensaje entrante se descarta sin reiniciar y sin esperar 10 s, y `bot_audit` tiene `bot_paused` con su autor y motivo.
- **CA-4 (RF-3).** Given un motivo con 8 o más dígitos seguidos, When se envía, Then responde 422 y el estado no cambia.
- **CA-5 (RF-7).** Given un número válido sin bloquear, When se bloquea por 7 días, Then el bot lo ignora en el siguiente mensaje, la lista lo muestra enmascarado y `bot_audit` tiene `block_added`.
- **CA-6 (RF-7, RF-9).** Given un número inválido, del personal o ya bloqueado, Then responde 422, 422 o 409 respectivamente, no se escribe nada y el campo teléfono vuelve vacío con duración y motivo conservados.
- **CA-7 (RF-6).** Given un bloqueo manual o automático, When se quita, Then el bot vuelve a atender el número y `bot_audit` tiene `block_removed`. Un id inexistente da 404.
- **CA-8 (RF-5).** Given un número que no es del personal y alcanzó un tope hoy, Then aparece enmascarado con su tope; When se bloquea, Then queda bloqueado y sale de la lista.
- **CA-9 (RF-5, H-1).** Given un número del personal que supera la ráfaga o el tope por minuto, Then no aparece en la lista y ninguna petición al endpoint de bloqueo lo bloquea.
- **CA-10 (RF-5).** Given un token usado, inexistente o de ayer, When se envía, Then responde 404 sin escribir y la pantalla muestra un aviso con la lista actual. Given un número de la lista ya bloqueado, Then responde 409 sin duplicar.
- **CA-11 (RF-5).** Given un reinicio de `api`, Then la lista está vacía, y la lista negra, el interruptor y los contadores siguen.
- **CA-12 (RF-4).** Given uso registrado por el bot, Then la pantalla muestra los 5 contadores con los valores vigentes y no ofrece ningún control para cambiar los topes.
- **CA-13 (RF-7).** Given `api` sin clave, Then la pantalla no ofrece el alta, explica el motivo, y un POST directo responde 409 sin guardar.
- **CA-14 (RF-8).** Given bloqueos con la clave anterior, Then la pantalla muestra cuántos y la advertencia; con 0, no la muestra.
- **CA-15 (RF-9).** Given un número de prueba conocido usado en un alta correcta y otra fallida, When se revisan logs de `api` e `inventory-manager`, HTML, URLs, respuestas de la API, `bot_block` y `bot_audit`, Then no aparece completo, y las respuestas no contienen `phoneHash` ni `keyId`.
- **CA-16 (RF-10).** Given `ADMIN_NEW_URL`, Then `/admin/bot` no tiene formularios, muestra el enlace, y sus 4 POST responden 410 sin escribir, comprobado en las 4 tablas.
- **CA-17 (RF-10).** Given sin `ADMIN_NEW_URL`, Then `/admin/bot` funciona como antes de este ticket y un cambio llega al bot en un máximo de 10 s.
- **CA-18 (RF-12).** Given la API caída, When se abre la pantalla o se envía un formulario, Then hay 503 con aviso, sin detalles internos, y el teléfono no se vuelve a pintar.
- **CA-19 (RF-12).** Given una lectura correcta con `storeHealthy` falso, Then se ve el aviso de última copia conocida.
- **CA-20 (RF-2, H-4).** Given el bot sin configurar, Then la pantalla dice "Desactivado" y permite pausar, sin depender solo de `WHATSAPP_BOT_PROVIDER`.
- **CA-21 (RF-13).** Given JavaScript deshabilitado, Then todas las acciones funcionan. A 375 px y en escritorio no hay desplazamiento horizontal de la página, y todo se usa con teclado.
- **CA-22.** `npm run typecheck`, `npm run lint` y `npm test` terminan sin errores, e `inventory-manager` sigue sin importar `core` ni `db`.

## Casos límite

- **Medianoche:** los contadores del día y la lista se reinician en el día del negocio (`BUSINESS_TIMEZONE`).
- **Dos administradores a la vez:** la última pausa prevalece y ambas quedan en auditoría (paridad, sin control de versión). Un alta doble da 409.
- **Doble envío o botón atrás:** POST/redirect/GET; el reenvío de un token usado da 404.
- **Bloqueo caducado:** deja la lista y se audita una sola vez, por `api`.
- **Número con bloqueo automático por tope de mensajes:** aparece en ambas listas; "Bloquear" da 409 (CA-10).
- **Lista llena (200):** se descarta la entrada más antigua, sin aviso.

## Dependencias

- REQ-F-042 está mergeado en la épica, pero sigue en `in-progress/` hasta las comprobaciones de producción.
- Los PR van a `epic/arquitectura`; su merge no despliega.
- Este ticket llega a producción junto con REQ-F-042, en el PR de la épica hacia `main`.
- Tras el despliegue, `ADMIN_NEW_URL` activa el cambio. Sin ella, nada cambia en `/admin/bot`.
- La actualización de `.claude/CLAUDE.md` §8 está autorizada por el usuario ("Lo autorizo") y la hace `senior-fullstack` dentro de la implementación.

## Riesgos

- **Pausa de emergencia dependiente de `inventory-manager` (aceptado, D-2).** Si cae con `/admin/bot` en solo lectura, no hay pausa web. Si cae `api`, tampoco hay bot que pausar.
- **Vuelta atrás a medias.** Por un momento, `inventory-manager` nuevo con `api` anterior daría 404 en "Bot". `senior-fullstack` debe verificarlo en `deploy.sh`.
- **Duración de pruebas.** Límite de 20 s por archivo en el CI.
- **Pérdida de la lista en cada despliegue.** Aceptada en REQ-F-025.

## Action Plan

### Objetivo

Control completo del bot en el admin nuevo, con `api` como único escritor del panel en producción.

### Alcance

El de la sección "Alcance". Lo excluido está en "Fuera de alcance".

### Cambios requeridos

1. Contratos del bot: estado, uso, lista negra, lista de topes, alta, baja y pausa, sin datos seudonimizados.
2. Rutas en `/api/v1/admin` solo para administradores.
3. Corrección de H-1 en el registro o el bloqueo desde "alcanzaron un tope hoy".
4. Pantalla "Bot" con enlace de cabecera solo para administradores.
5. Solo lectura y 410 en `/admin/bot`.
6. Actualización de pruebas y documentación.

### Reglas de negocio

Las de la sección "Reglas de negocio".

### UX/UI

Patrón de Usuarios y P-4 de REQ-F-039. Sin diseño en `_stich_source_/`. Textos reutilizados de `/admin/bot`.

### Integraciones

Ninguna nueva. Sin cambios en Meta.

### Casos límite

Los de la sección "Casos límite".

### Criterios de aceptación

CA-1 a CA-22.

### Dependencias

Las de la sección "Dependencias".

### Riesgos

Los de la sección "Riesgos".

### Orden recomendado

Contratos y API con H-1, pantalla, solo lectura y documentación. El número de PR lo propone `senior-fullstack`.

### Resultado esperado

`/admin/bot` queda sin escrituras en producción y el ticket 6 ya no depende de él para el bot.

## Trazabilidad

| Objetivo | Requisito | Historia | Criterios |
| --- | --- | --- | --- |
| Emergencia | RF-3 | HU-1 | CA-3, CA-4 |
| Abuso | RF-5, RF-6, RF-7 | HU-2, HU-3 | CA-5 a CA-11, CA-13 |
| Gasto | RF-4 | HU-4 | CA-12 |
| Paridad | RF-2, RF-8, RF-12 | Todas | CA-14, CA-18 a CA-20 |
| Seguridad | RF-1, RF-9 | Todas | CA-1, CA-2, CA-15 |
| Retirada de `/admin` | RF-10, RF-11 | Todas | CA-16, CA-17 |
| Calidad y documentación | RF-13, RF-14 | Todas | CA-21, CA-22 |

RF-14 no tiene criterio funcional propio; su cumplimiento se revisa en QA.

## Revisión técnica

Hecha sobre `epic/arquitectura` (`76a70f2`), el 2026-11-04. NotebookLM no estaba disponible en la sesión: no se consultó. Todo lo que sigue sale del repositorio. Las reproducciones se ejecutaron con scripts fuera del repositorio, sin tocar código de producción.

### Inferencias del ticket, resueltas

| Inferencia | Resultado | Evidencia |
| --- | --- | --- |
| Migración de esquema | **No hace falta** | `bot_block`, `bot_audit`, `bot_usage` y `bot_control` ya tienen todos los campos. `bot_audit.action` es texto y ya admite las 4 acciones. `api` usa `restaurante_app` (`compose.prod.yaml:219`), con DML sobre toda la base. |
| `deploy.sh` cubre la vuelta atrás | **Sí en el automático; no en dos ventanas que hay que tratar** | Ver "Vuelta atrás". No cambia ningún archivo de `deploy/`, así que su suma tampoco. |
| Usuarios a 375 px | **El patrón sirve, y no es una tabla** | `users.html` es `ul` con tarjetas `flex-col` y `md:flex-row`, con `dl`, `min-w-0` y `break-words`. Se repite ese patrón; la pantalla "Bot" no usa `<table>`. Conclusión por lectura: la medida real a 375 px queda en la validación de T2. |
| H-1 | **Reproducido** | Ver abajo. |
| H-3 | **Confirmado ejecutando** | Ver abajo. |

### H-1, reproducido

Con `createBotProtection` y `createBotControl` reales, store en memoria y `staff: ['5215511110001']`:

- 7 mensajes seguidos dan `process ×5, drop, drop`. `snapshot().reached` queda con `*********0001`, tope `burst`.
- `blockReached(token, '7d', …)` devuelve `blocked`.
- El siguiente mensaje del personal, una hora después, da `drop`: el personal queda sin bot 7 días.

Causa exacta: `admit` (`protection.ts:76-81`) llama a `guard.rate` y `recordReached` antes de calcular `exempt` (línea 84). `recordReached` (`bot-control.ts:422`) no comprueba `staffNumbers`, a diferencia de `autoBlock` (394) y `blockManual` (459).

**Corrección (D-3):** en `recordReached`, `if (!currentKey || staffNumbers.has(canonical)) return;`. Sin entrada no hay token, así que el endpoint responde 404 y no hay forma de bloquear por esa vía. Es el único camino del personal a la lista: `messages`, `cooldown` y `orders` ya lo excluyen (`exempt`, `commit`, `orderAccepted`). El límite de ráfaga para el personal no cambia: D-3 no lo pide.

### H-3, confirmado

Prisma contra un puerto cerrado: `resolveSession` lanza `DatabaseUnavailableError` a los 10,1 s; `setControl` y `getControl`, a los 5,0 s. `API_TIMEOUT_MS` de `inventory-manager` es 5 s.

- Con MySQL caído, `kit.session` termina casi siempre en `timeout`, o en 503 `DATABASE_UNAVAILABLE`. En ambos casos el resultado es la página 503. Ninguna escritura llega a intentarse.
- La sesión sobrevive a la caída: `resolveSession` lanza antes de `sessions.destroy`.
- El bot sigue con la última copia. No se puede pausar sin MySQL, igual que hoy (fuera de alcance).
- `storeHealthy: false` solo se ve en un fallo parcial, con la lectura de usuarios funcionando. Se prueba con un store envuelto. Si `snapshot()` tarda más de 5 s en ese fallo parcial, el resultado es la página 503, que también es seguro.

### Hallazgos nuevos

- **H-6. CA-7 no se cumple con un bloqueo automático (decisión DT-1).** Reproducido: con el tope diario alcanzado, `tope`, tras `unblock` el siguiente mensaje da `drop`. `guard.dailyExceeded` sigue en verdadero y `takeDailyNotice` ya se gastó, así que el número sigue sin atención hasta medianoche. Con el bloqueo por repeticiones pasa algo parecido: sigue el enfriamiento, hasta 30 min. El defecto ya existía en REQ-F-025, pero el aviso dice "el número vuelve a ser atendido" y CA-7 lo exige.
- **H-7. CA-10: un token de ayer sí bloquea.** Reproducido: `blockReached` devolvió `blocked` con un token del día anterior, porque `blockReached` y `reachedLast4` no llaman a `resetReachedIfNewDay`. La lista solo se limpiaba al llegar un `recordReached` o un `snapshot`. Se corrige en este ticket.
- **H-8. CA-8: el número no sale de la lista si alcanzó dos topes.** Reproducido: con `burst` y `minute`, tras bloquear queda 1 entrada. Se corrige borrando todas las entradas de ese `hash`.
- **H-9. Una fila histórica del personal.** El botón estuvo activo en producción hasta REQ-F-042 y `isBlocked` no exime al personal: un bloqueo ya guardado seguiría vigente (decisión DT-3).
- **H-10. `api` anterior y 404.** La `api` anterior responde a `/api/v1/admin/bot*` con 404 `NOT_FOUND`. Si `inventory-manager` lo tratara como "no encontrado", el administrador vería un error falso. Se distingue por `code`.

### Vuelta atrás

| Situación | Combinación | Efecto |
| --- | --- | --- |
| Falla la `api` nueva (código 15) | Nada cambió fuera de la `api` | Sin efecto. |
| Falla `inventory-manager` (16) | `api` nueva, `inventory-manager` y app anteriores | Sin efecto: la app anterior sigue escribiendo en `/admin/bot` y `api` lo recoge en 10 s. |
| Falla la app (21) | Orden `inventory-manager` → app → `api` | Nunca hay `inventory-manager` nuevo con `api` anterior. Cubierto. |
| Revert en `main` | Va `api` → `inventory-manager` → app | **Durante segundos sí hay `inventory-manager` nuevo con `api` anterior**. Con H-10 da 503 con aviso, no un error falso. Después, unos segundos de app nueva con `/admin/bot` en solo lectura y enlace a una pantalla que ya no existe. Aceptable. |
| Vuelta a mano urgente (`despliegue.md` §6) | Hoy habla de app y `api`, no de `inventory-manager` | **`inventory-manager` nuevo quedaría de forma estable con `api` anterior**: enlace "Bot" visible y 503. Se documenta el paso. Solo volver la app recupera `/admin/bot` escribible, y la `api` nueva lo recoge en 10 s. |

### Decisiones del usuario

- **DT-1, CA-7 (H-6). Recomendación: opción A.**
  - **A (recomendada):** quitar un bloqueo devuelve la atención de verdad. `unblock` anota el `hash` en un conjunto acotado; `takeReleased(canonical)` lo consume en `admit` y `guard.release(canonical)` borra los contadores del día, los textos repetidos y el enfriamiento de ese número. Son unas 15 líneas. Solo actúa en el proceso del bot. No hay otra vía: el guard usa un secreto por proceso y `unblock` solo conoce el `hash`.
  - **B:** dejarlo como está, y cambiar CA-7 y el aviso a "se le vuelve a atender cuando termine el tope del día o el enfriamiento". Sin cambios en protección. El administrador no tendría cómo devolver hoy la atención.
- **DT-2, división en PR. Recomendación: 3 PR**, en el orden de "Orden de implementación". Alternativa: un solo PR, unos 3.000 líneas entre código y pruebas.
- **DT-3, fila histórica del personal (H-9). Recomendación: no cambiar `isBlocked`** y comprobar tras el despliegue que la lista negra no tiene los 4 últimos dígitos del personal. Alternativa: eximir también en `isBlocked` (2 líneas), que deja una fila ignorada en silencio.

## Technical Action Plan

Escrito con las opciones recomendadas de DT-1 a DT-3, que el usuario eligió.

### Objetivo técnico

`api` pasa a ser el único escritor del panel del bot en producción. Expone el control en `/api/v1/admin/bot*` sobre la instancia de `BotControl` que usa el bot. `inventory-manager` lo presenta sin importar `core` ni `db`. `/admin/bot` queda en solo lectura con `ADMIN_NEW_URL`.

### Archivos o componentes afectados

**`packages/contracts`**

- `admin.ts`: rutas en `adminPaths`, esquemas de lectura y escritura, y listas cerradas (`BOT_MANUAL_DURATIONS`, `BOT_REASON_MAX`, `BOT_REACHED_CAPS`, `BOT_BLOCK_ORIGINS`, `BOT_USAGE_COUNTERS`). `inventory-manager` no puede importar las de core; se sincronizan con una prueba, como `PUBLIC_BUSINESS_IDS`.
- `admin-client.ts`: `getBot`, `setBotPaused`, `blockNumber`, `unblockNumber` y `blockReached`.

**`packages/core/bot-control`**

- `bot-control.ts`: H-1, H-7, H-8 y, con DT-1 A, `takeReleased`.

**`api`**

- `src/admin/bot-routes.ts` (nuevo).
- `src/admin/router.ts`: rutas.
- `src/admin/index.ts`: `botControl` y `botProvider`.
- `src/admin/access.ts`: mensaje de `adminOnly` (H-5).
- `src/server.ts`: pasa `botControl` y `bot?.chatBot.provider ?? null`.
- `src/bot/protection/protection.ts` y `number-guard.ts`: `guard.release` (DT-1 A).

**`inventory-manager`**

- `src/controllers/bot.ts` (nuevo).
- `src/controllers/common.ts`: reciben `readClosedForm` y `adminSession` con el texto de 403 como parámetro. Hoy están en `users.ts`, que pasa a usarlos.
- `src/views/bot.ts` (nuevo) y `src/views/index.ts`: enlace "Bot" y `HeaderSection`.
- `src/views/pages/bot.html` y parciales nuevos.
- `src/routes.ts` y `src/app.ts`.

**`landing-pages`**

- `src/controllers/admin-bot.ts`.
- `src/views/admin/bot.ts` y `bot.html`, con parciales para lo que desaparece en solo lectura.

**Documentación:** ver su apartado.

No cambian `deploy/`, el esquema, las variables de entorno ni `.env.example`.

### Backend: endpoints

Prefijo `/api/v1/admin`. Todos pasan por `access.adminOnly`. Orden: 401 `UNAUTHENTICATED` → 403 `FORBIDDEN_ROLE` → en escrituras, 403 `CSRF_INVALID` → cuerpo → dominio. Una ruta conocida con otro método da 405. Base de datos caída: 503 `DATABASE_UNAVAILABLE`. Límite de cuerpo: 4 KiB.

| Método y ruta | Cuerpo | Éxito | Errores propios |
| --- | --- | --- | --- |
| `GET /bot` | — | 200 `{ bot }` | — |
| `PUT /bot/interruptor` | `{ paused, reason? }` | 200 `{ control }` | 422 `VALIDATION_FAILED` (`paused`, `reason`) |
| `POST /bot/bloqueos` | `{ phone, duration, reason? }` | 201 `{ block: { masked } }` | 409 `BOT_KEY_MISSING`; 422 (`phone`, `duration`, `reason`; también personal); 409 `BOT_NUMBER_ALREADY_BLOCKED` |
| `POST /bot/bloqueos/:id/quitar` | `{}` | 200 `{ block: { masked } }` | 404 `BOT_BLOCK_NOT_FOUND` |
| `POST /bot/topes/:token/bloquear` | `{ duration, reason? }` | 201 `{ block: { masked } }` | 422 (`duration`, `reason`); 404 `BOT_REACHED_NOT_FOUND`; 409 `BOT_NUMBER_ALREADY_BLOCKED` |

Cuerpo también significa 413, 415, 400 y 422 de `closedBody`.

Forma de `GET /bot`, con fechas en ISO con la zona del negocio:

```text
bot: {
  status: { enabled, provider: 'meta' | 'twilio' | null },
  control: { paused, changedAt, changedByName, reason },
  usage: { day, month, timeZone, counters: [{ id, used, limit, reached }] },
  reached: [{ token, masked, cap, at }],
  blocks: [{ id, pending, masked, origin, reason, author, since, until }],
  canBlock, previousKeyBlocks, storeHealthy
}
```

Reglas:

- El DTO se construye campo a campo: `phoneHash`, `keyId` y `last4` no salen nunca. El contrato no los declara.
- Un alta sin guardar sale con `id: null` y `pending: true`.
- `status` sale de `bot?.chatBot.provider`, el bot realmente creado (H-4 y CA-20), no de la variable.
- El orden del alta es el del `/admin` actual: cuerpo → sin clave 409 → 422 → resultado de `blockManual`.
- `:id` se valida con `^[1-9]\d{0,9}$` y `:token` con `^[0-9a-f]{32}$`, después del cuerpo. Si no cumplen, 404.
- Sin clave, `/topes` da 404: no hay entradas (`recordReached` sale antes).
- Ninguna ruta usa la forma `/<x>/productos`, para no caer en `/:business/productos`.
- El token va en la ruta, como hoy en `/admin`. Es opaco, de un solo uso y no contiene el número, pero queda en el log de peticiones. Aceptado: nunca permite obtener el número.
- `adminOnly(ctx, { write, forbiddenMessage })`: por defecto, el texto actual (H-5); en el bot, "No tienes permiso para gestionar el bot.".

Efecto inmediato (CA-3, CA-5, CA-7): `createAdminRoutes` recibe el mismo objeto `botControl` que `createBotFromConfig`. `setPaused`, `addManual` y `unblock` cambian la copia que lee el bot.

### Backend: `core`

- `recordReached`: excluye al personal (H-1).
- `blockReached` y `reachedLast4`: `resetReachedIfNewDay(now())` al entrar (H-7).
- `blockReached`: tras `addManual`, tanto `blocked` como `already_blocked`, borra todas las entradas de ese `hash` (H-8). Si la base falla, lanza y conserva la entrada, para poder reintentar.
- `unblock` + `takeReleased` + `guard.release` (DT-1 A). Vale para cualquier baja, manual o automática. `admit` consume la marca en el primer mensaje que pasa la lista negra, y `guard.release` borra todo lo que el guard guarda del número salvo los limitadores de ráfaga y por minuto, que caducan solos en segundos:
  - **Tope diario:** se borra el estado del día (mensajes, aviso diario, pedidos y enfriamientos). El número vuelve a tener su cupo completo.
  - **Enfriamiento:** se borran `cooldownUntil` y los textos repetidos, así que se le atiende de inmediato aunque queden minutos de enfriamiento. Como `cooldowns` también vuelve a 0, las siguientes repeticiones cuentan como un primer enfriamiento: dan 30 min y no vuelven a bloquear al instante.
  - **Sin bloqueo no hay baja:** un enfriamiento normal sigue su curso; no hay forma ni necesidad de quitarlo.

### Frontend

Rutas de `inventory-manager`, antes de `/:business/productos`:

| Ruta | Acción |
| --- | --- |
| `GET /bot` | Pantalla |
| `POST /bot/interruptor` | Pausar o reanudar |
| `POST /bot/bloqueos` | Alta manual |
| `POST /bot/bloqueos/:id/quitar` | Baja |
| `POST /bot/topes/:token/bloquear` | Bloquear desde la lista |

Pantalla (sin diseño en `_stich_source_/`: P-4 de REQ-F-039 y patrón de Usuarios). Sin JavaScript nuevo y sin `<table>`. Secciones con `h2`:

1. **Estado:** `dl`, con el formulario del interruptor.
2. **Uso:** `ul` de tarjetas con usado, tope y estado en texto; periodos y zona.
3. **Alcanzaron un tope hoy:** `ul` de tarjetas; cada una con su formulario y etiquetas únicas por fila.
4. **Lista negra:** `ul` de tarjetas con `dl`.
5. **Bloquear un número.**

Avisos con `role="status"` y `role="alert"`, según `notice`. El enlace "Bot" solo aparece para el rol administrador.

Resultado de cada POST:

| Respuesta de la API | Pantalla |
| --- | --- |
| Éxito | 303 a `/bot?ok=…`. En altas y bajas, `&n=` con los 4 últimos dígitos, como hoy. Lista cerrada de `ok`. |
| 422 | Página con los errores junto al campo. |
| 409 ya bloqueado (alta) | Error en el campo teléfono. |
| 409 sin clave | Aviso, sin formulario. |
| 404 `BOT_BLOCK_NOT_FOUND` o `BOT_REACHED_NOT_FOUND` | Status 404 con aviso y la lista actual (CA-10). |
| 409 en `/topes` | Status 409 con aviso y la lista actual. |
| 404 con otro `code` | 503 con aviso (H-10). |
| 401, 403 | Como en Usuarios. |

Fallos (RF-12 y D-4):

- `GET /bot`: 503 con el aviso común.
- Escritura que no se confirma (503, 5xx, `timeout`, `network`, `invalid_response`): status 503 con "No pudimos confirmar el cambio. Revisa el estado antes de repetirlo." y enlace a `/bot`. **No se reutiliza `UNAVAILABLE` de Usuarios**, que afirma "no se guardó nada".
- En el alta, además, el formulario suelto con duración y motivo conservados y teléfono **siempre vacío**, también si la sesión no se pudo comprobar (`onUnavailable`, con el `_csrf` recibido).
- `telefono` nunca llega a una plantilla: no hay variable que lo reciba.

### Solo lectura de `/admin/bot`

Con `config.adminNewUrl`:

- `GET /admin/bot`: estado, uso y lista, con aviso y enlace a `<ADMIN_NEW_URL>/bot`. Sin formulario del interruptor, sin columna "Acción", sin alta.
- Los 4 POST: `access.post` (sesión → permiso → cuerpo → CSRF) y, después, 410 con esa misma página, antes de cualquier escritura.
- Registro `admin_bot_moved`, sin datos de negocio.

Sin `ADMIN_NEW_URL`, igual que hoy. **Única diferencia de texto:** `REACHED_MOVED_MESSAGE` dice que la lista "vuelve", y ahora pasa a decir que "está en el admin nuevo". Es una excepción declarada a CA-17, porque el texto actual quedaría falso.

### Contenido / configuración

Ninguna variable nueva. `inventory-manager` sigue sin `*bot-env`. `landing-pages` conserva clave, personal y topes (RF-11).

### Validaciones

- Motivo y duración: `validateReason` e `isManualDuration` de core, solo en `api`.
- Teléfono: `parsePhoneInput`, solo en `api`.
- `inventory-manager` solo conserva `duracion` si está en la lista del contrato; si no, usa `7d`.
- Formulario con lista cerrada de campos y mismo origen (`readClosedForm`).

### Manejo de errores

Formato común `{ error: { code, message, fields? } }`, con el manejador central de `api`. `BotControl` no traduce errores: `DatabaseUnavailableError` llega al manejador (503). Nunca se registra el cuerpo, el teléfono ni el motivo.

### Testing

Cada archivo debe quedar por debajo de 20 s en el CI; por eso se reparte por tema, sin `retry` ni esperas fijas. Pruebas HTTP con `listenLocal` (a través de `startAdmin` y `startInventory`); nada de `app.callback()`.

| Archivo | Tipo | Cubre |
| --- | --- | --- |
| `api/tests/unit/bot-control-reached.test.ts` (nuevo) | Core, memoria | H-1, H-7, H-8; CA-8, CA-9, CA-10 |
| `api/tests/unit/whatsapp-bot-protection.test.ts` | Ampliado | CA-9 en `admit`; CA-7 con DT-1 |
| `api/tests/unit/contract-types.test.ts` | Ampliado | Listas de contracts iguales a las de core |
| `api/tests/integration/admin-bot-api.test.ts` (nuevo) | HTTP | Matriz 401, 403, CSRF, 405, 413, 415, 400, 422; CA-1, CA-2, CA-4, CA-6, CA-13, CA-20 |
| `api/tests/integration/admin-bot-effects.test.ts` (nuevo) | HTTP y `createBotProtection` sobre el mismo control | CA-3, CA-5, CA-7 a CA-12, CA-14, CA-19 |
| `inventory-manager/tests/unit/admin-client.test.ts` | Ampliado | Métodos del cliente |
| `inventory-manager/tests/integration/bot-access.test.ts` (nuevo) | Doble | CA-1, CA-2, CA-21 (sin JS, teclado, sin `<table>`) |
| `inventory-manager/tests/integration/bot-actions.test.ts` (nuevo) | Doble | CA-3 a CA-8, CA-10, CA-12 a CA-14, CA-19, CA-20 en pantalla |
| `inventory-manager/tests/integration/bot-failures.test.ts` (nuevo) | Doble | CA-18, RF-12, D-4, H-10; CA-15 en logs, HTML y URL |
| `landing-pages/tests/integration/admin-bot-moved.test.ts` (nuevo) | MySQL real | CA-16 en las 4 tablas, orden de los controles |
| `landing-pages/tests/integration/admin-bot.test.ts` | Sin cambios, salvo el texto | CA-17 |
| `landing-pages/tests/integration/admin-bot-api-process.test.ts` (nuevo) | Proceso real de `api` con MySQL, como `api-process.test.ts` | `bot_audit` de CA-3, CA-5 y CA-7; CA-15 en logs de `api`, `bot_block` y `bot_audit` |

El doble de la API crece en `inventory-manager/tests/support/api-double-bot.ts`, para no alargar `api-double.ts`. `startAdmin` recibe un `BotControl` en memoria por defecto, con clave y personal de prueba.

El doble valida con el mismo contrato, pero no sustituye a la `api` real. Por eso, en T2 se hace una pasada completa en local con `npm run dev`, con navegador a 375 px y en escritorio, teclado y JavaScript desactivado (CA-21). jsdom no mide el desplazamiento horizontal.

CA-22: `npm run typecheck`, `npm run lint` y `npm test`, más `npm run build:css`.

### Seguridad

- El teléfono viaja solo en el cuerpo de dos POST internos (navegador → `inventory-manager` → `api`).
- La clave HMAC solo se usa en `api`. El contrato no expone datos seudonimizados.
- Sin cambios en CSP ni en cabeceras.
- CSRF y rol antes de leer el cuerpo en `api`. En `inventory-manager`, mismo origen en todo POST. Un editor recibe 403 sin ninguna llamada de datos a la API.
- `api` sigue solo en la red interna: no se publica nada nuevo en Traefik.

### Performance

`GET /bot` no añade consultas fijas: lee la copia en memoria y solo refresca si tiene más de 10 s. Lista de topes acotada a 200 tarjetas.

### Documentación

- `restaurante/docs/arquitectura.md`: §6 (quién escribe el panel), §8 (fila del ticket 4, subsección "Paso 4, ticket 4 aplicado" y estado de la convivencia), §10 (riesgo de pausa aceptado, D-2).
- `restaurante/docs/despliegue.md`: "Regla del bot en producción", aviso al personal (la pausa se hace en el admin nuevo), §6 (`inventory-manager` en la vuelta a mano, H-10), §8 (comprobaciones, incluida DT-3).
- `restaurante/README.md`: "API propia", "Admin nuevo" (pantalla y convivencia), "Topes de gasto, lista negra e interruptor".
- `.env.example`: no aplica, no hay variables nuevas.
- `.claude/CLAUDE.md` §8: líneas de `api` e `inventory-manager`, con la autorización "Lo autorizo", limitada a esa sección.

### Riesgos técnicos

- **Pausa dependiente de `inventory-manager`:** aceptado en D-2.
- **Alcance mayor en `core` y protección:** H-7, H-8 y DT-1 tocan el camino de cada mensaje entrante. Mitigación: las pruebas de protección y `chat-bot-contract` se mantienen en verde.
- **Reinicio de contadores con DT-1 A:** quitar un bloqueo devuelve el cupo diario de ese número. Es lo que pide el administrador al quitarlo y queda en `bot_audit`.
- **Convivencia local:** sin `ADMIN_NEW_URL`, dos escritores y hasta 10 s. Una baja desde `/admin` local no libera el cupo en `api`: `takeReleased` es por proceso.
- **`snapshot()` lenta en fallo parcial:** puede dar 503 en vez de "última copia conocida" si pasa de 5 s. Es seguro y no se cambia, para no tocar el refresco.
- **Duración de pruebas:** el proceso real de `api` es lo más caro. Va en su propio archivo.
- **Lo que no se puede ejecutar en local:** el despliegue real ni el `revert`. La vuelta a mano de `despliegue.md` se revisa contra `deploy.sh` y se indicará en `Riesgos o pendientes`.

### Orden de implementación

Rama base `epic/arquitectura`, `--base epic/arquitectura` y PR en borrador hasta el último push. Ninguno despliega.

1. **PR 1, contratos y `api`:** contracts y cliente, core (H-1, H-7, H-8, DT-1), rutas, `server.ts`, pruebas de `api` y `admin-bot-api-process`. Sin cambios visibles.
2. **PR 2, pantalla:** `inventory-manager` y sus pruebas.
3. **PR 3, solo lectura y documentación:** `landing-pages`, CA-16, documentación y `.claude/CLAUDE.md`.

Este orden nunca deja `/admin/bot` en solo lectura sin una pantalla que lo sustituya.

### Trazabilidad de los criterios

| CA | Parte | PR |
| --- | --- | --- |
| CA-1, CA-2 | `access.adminOnly`, `adminSession` | 1 y 2 |
| CA-3, CA-4 | `PUT /bot/interruptor`, pantalla | 1 y 2 |
| CA-5, CA-6, CA-13 | `POST /bot/bloqueos`, formulario | 1 y 2 |
| CA-7 | Baja y DT-1 | 1 y 2 |
| CA-8 a CA-11 | `recordReached`, `blockReached`, `/bot/topes/:token/bloquear`, lista | 1 y 2 |
| CA-12, CA-14, CA-20 | `GET /bot`, pantalla | 1 y 2 |
| CA-15 | DTO, controlador, pruebas en ambos procesos | 1 y 2 |
| CA-16, CA-17 | `admin-bot.ts` y su vista | 3 |
| CA-18, CA-19 | Fallos en `inventory-manager` | 2 |
| CA-21 | Vista y pasada en navegador | 2 |
| CA-22 | Validación de cada PR | 1, 2 y 3 |
| RF-14 | Documentación | 3 |

### Criterios de finalización

- CA-1 a CA-22 comprobados, con la excepción de texto declarada en CA-17 y lo que decida DT-1.
- Los tres escenarios reproducidos (H-1, H-6, H-7) y H-8 tienen prueba que falla sin la corrección.
- `inventory-manager` sin imports de `core` ni `db`, y `deploy/` sin cambios.
- `git diff` sin `Calculadora.xlsx` ni nada ajeno.

## Implementation Result

Resultado del PR 1 de 3 (contratos y `api`). Sin commit, push ni PR.

### Rama

`feature/REQ-F-043-control-bot-admin-nuevo-1-api`, creada desde `epic/arquitectura` (`76a70f2`).

### Cambios realizados

- **contracts:** rutas, esquemas de lectura y escritura sin `phoneHash`, `keyId` ni `last4`, listas cerradas y 5 métodos del cliente.
- **core:** H-1 (`recordReached`), H-7 (`blockReached` y `reachedLast4`), H-8 (salen todas las entradas del número), `takeReleased` (DT-1 A) y `setPaused` devuelve el estado.
- **api:** `src/admin/bot-routes.ts` con los 5 endpoints, con la misma instancia de `BotControl` que el bot; `adminOnly` con mensaje propio (H-5); `guard.release` y su uso en `admit`.

### Criterios de aceptación

| CA | Estado en este PR |
| --- | --- |
| CA-3, CA-5, CA-7, CA-8, CA-9, CA-10, CA-11, CA-12, CA-14, CA-19, CA-20 | Cumplidos en la API. Falta su pantalla (PR 2) |
| CA-1, CA-2, CA-4, CA-6, CA-13 | Cumplidos en la API. Falta su pantalla (PR 2) |
| CA-15 | Cumplido en respuestas, logs de `api`, `bot_block` y `bot_audit`. Faltan HTML y logs de `inventory-manager` (PR 2) |
| CA-22 | Cumplido en este PR. Se repite en el PR 2 y el PR 3 |
| CA-18, CA-21 | Pendientes (PR 2). La API ya da 503 sin detalles |
| CA-16, CA-17 | Pendientes (PR 3) |

### Validaciones ejecutadas

| Comando | Resultado |
| --- | --- |
| `npm run typecheck` | 0 |
| `npm run lint` | 0, sin avisos |
| `npm test`, `api` | 40 archivos, 1049 pruebas pasan |
| `npm test`, `inventory-manager` | 8 archivos, 115 pruebas pasan |
| `npm test`, `landing-pages` | 130 archivos, 1456 pasan y 1 fallo esperado (1457) |

- **Las pruebas detectan los defectos:** se quitó cada corrección de una en una y se restauró después. Fallan 3 pruebas sin H-1, 2 sin H-7, 1 sin H-8 y 7 sin DT-1.
- **Duración local (con los workers en paralelo):** archivos nuevos: `admin-bot-api-process` 6,4 s, `admin-bot-api` 2,1 s, `admin-bot-effects` 1,9 s y los dos unitarios menos de 0,1 s. Archivos existentes que no se tocaron y que están cerca del límite: `admin-produccion` 19,4 s, `last-admin-concurrency` 18,8 s, `admin-products-api-sesion` 18,2 s y `admin-products-api-validar` 17,1 s.

### Archivos afectados

- `restaurante/packages/contracts/admin.ts`, `admin-client.ts`
- `restaurante/packages/core/bot-control/bot-control.ts`
- `restaurante/api/src/admin/bot-routes.ts` (nuevo), `access.ts`, `index.ts`, `router.ts`
- `restaurante/api/src/bot/protection/protection.ts`, `number-guard.ts`
- `restaurante/api/src/server.ts`
- `restaurante/api/tests/support/admin.ts`
- `restaurante/api/tests/unit/bot-control-reached.test.ts`, `bot-protection-release.test.ts` (nuevos), `contract-types.test.ts`
- `restaurante/api/tests/integration/admin-bot-api.test.ts`, `admin-bot-effects.test.ts` (nuevos)
- `restaurante/inventory-manager/tests/unit/admin-client.test.ts`
- `restaurante/landing-pages/tests/integration/admin-bot-api-process.test.ts` (nuevo)

### Desviaciones del plan

- Las pruebas de `admit` van en `api/tests/unit/bot-protection-release.test.ts`, no en `whatsapp-bot-protection.test.ts`: usan la protección directamente y corren en milisegundos.
- `BotControl.setPaused` devuelve `ControlState` en lugar de `void`, para responder sin una segunda lectura. `landing-pages` ignora el valor.
- `BOT_REACHED_CAPS` solo se compara por tipo (`expectTypeOf`): en core `ReachedCap` es un tipo, sin lista en ejecución.
- `core` limita `released` a 1000 marcas: si se llena, se olvida la más antigua. El plan decía "conjunto acotado" sin fijar el número.

### Riesgos o pendientes

- **Sin efecto en producción por ahora:** nada usa los endpoints hasta el PR 2, y los PR van a la épica.
- **Archivos existentes cerca de 20 s:** no cambian con este PR, pero el margen es poco y conviene mirarlos en el CI.
- **`takeReleased` es por proceso:** una baja desde `/admin` local, sin `ADMIN_NEW_URL`, no libera el cupo en `api`. Sucede solo en local.
- **Cuota de pedidos:** `guard.release` también reinicia los pedidos del día del número, además de mensajes y enfriamientos.
- **Sin ejecutar:** despliegue real y revert. Los procedimientos de `despliegue.md` se revisan en el PR 3.

## QA Action Plan

Plan del PR 1 de 3 (contratos, core y `api`), sobre el working tree sin commit de `feature/REQ-F-043-control-bot-admin-nuevo-1-api` (base `epic/arquitectura`, `76a70f2`). Aprobación del usuario a la implementación, textual: "Si". NotebookLM no está disponible en la sesión: no se consultó. `Calculadora.xlsx` queda fuera.

Las pruebas del implementador se ejecutan, pero no cuentan como evidencia independiente: cada riesgo alto se comprueba con una sonda propia (S-1 a S-6) o con una mutación (M-1 a M-4).

### Objetivo

Confirmar que la capa API del control del bot cumple los CA del PR 1, que el camino de cada mensaje entrante sigue correcto tras H-1, H-7, H-8 y DT-1, y que no hay regresión en REQ-F-025 ni REQ-F-042.

### Requisito bajo prueba

RF-1 a RF-9 y RF-12 en la capa API, D-1, D-3, D-4 (parte API), H-1, H-5, H-6 (DT-1), H-7, H-8 y H-10 (el `code` de la API anterior no cambia).

Fuera de este PR: CA-16, CA-17, CA-18 y CA-21, y la parte de pantalla de los demás CA (enlace "Bot", textos, teléfono vacío en el formulario). No hay pasada de navegador, responsive, accesibilidad, UX ni SEO: van con el PR 2 y el PR 3.

### Criterios de aceptación

| CA | Alcance en este PR | Casos |
| --- | --- | --- |
| CA-1 | API: 403 sin datos | QA-20 a QA-23 |
| CA-2 | API | QA-24, QA-25 |
| CA-3 | API y `bot_audit` | QA-40, QA-41 |
| CA-4 | API | QA-30 |
| CA-5 | API y bot | QA-42 |
| CA-6 | Códigos, sin escribir | QA-31 |
| CA-7 | Baja, DT-1, 404 | QA-01 a QA-07, QA-32, QA-43 |
| CA-8 | Lista y H-8 | QA-10, QA-11, QA-44 |
| CA-9 | H-1 | QA-12, QA-44 |
| CA-10 | H-7, un solo uso, 409 | QA-13 a QA-15 |
| CA-11 | Reinicio real | QA-45 |
| CA-12 | Contadores | QA-46 |
| CA-13 | Sin clave | QA-33 |
| CA-14 | Rotación | QA-16 |
| CA-15 | Respuestas, logs de `api`, `bot_block`, `bot_audit` | QA-50 a QA-53 |
| CA-19 | `storeHealthy` falso en la API | QA-34 |
| CA-20 | `status` real | QA-35 |
| CA-22 | Comandos y dependencias | QA-70 a QA-72 |

### Riesgos identificados

Por orden de impacto. Los marcados "hipótesis" salen de leer el código: se confirman o se descartan en Q2 y todavía no son defectos.

- **R-1. Cableado real sin probar.** `startAdmin` crea su propio `BotControl`. Solo `server.ts` une el webhook y las rutas en la misma instancia, y `admin-bot-api-process` no envía mensajes al webhook. Las pruebas del implementador no cubren el efecto inmediato con el proceso real.
- **R-2. `takeReleased` en cada mensaje.** Corre antes de `cooling` y puede dejar cupos o enfriamientos mal, o escalar mal los bloqueos automáticos (RF-7.2).
- **R-3. Hipótesis: marca rancia.** La marca no se borra si el número se vuelve a bloquear sin escribir. Si ese bloqueo caduca, el primer mensaje vacía los contadores de un número que nadie liberó entonces.
- **R-4. Hipótesis: id fuera de rango.** `ID_PATTERN` admite hasta 9.999.999.999 y `bot_block.id` es `Int`. Puede dar 503 o 500 en vez del 404 de CA-7.
- **R-5. Hipótesis: personal sin bot.** `staff` queda vacío sin `whatsappBot`. Con clave y sin bot, un alta del personal podría guardarse, contra "por ninguna vía".
- **R-6. Carreras con MySQL real.** Altas dobles, bajas dobles y refresco en curso, sobre el Prisma store. Lo escrito hasta ahora va casi todo sobre el store en memoria.
- **R-7. Fugas por caminos de error.** Cuerpo truncado, campo desconocido o cuerpo grande con el número dentro.
- **R-8. Convivencia.** `landing-pages` sigue escribiendo por `/admin/bot`; `api` debe recogerlo sin pisar su copia.
- **R-9. Exposición.** Las rutas nuevas no deben responder en `WEBHOOK_PORT`, lo único publicado a internet.
- **R-10. Duración.** 4 archivos ya están cerca de 20 s. `core` cambia y `startAdmin` crea un `BotControl` más.

### Pruebas funcionales

**Camino de cada mensaje (`admit`), con el proceso real o con reloj inyectado (S-1, S-6)**

- **QA-01.** Tope diario de mensajes → bloqueo `tope` → baja → siguiente mensaje `process`, cupo completo de nuevo.
- **QA-02.** Bloqueo por repetición con enfriamiento en curso → baja → se atiende sin esperar.
- **QA-03.** Reinicio de pedidos: con `orders` agotado, bloqueo y baja → `startCheck` vuelve a `ok` (advertido al usuario).
- **QA-04.** La liberación se consume una vez y solo para ese número. Un segundo número con tope sigue igual.
- **QA-05.** Ráfaga y tope por minuto no se reinician con la baja, tal como declara `guard.release`.
- **QA-06.** Baja durante una pausa: el mensaje se descarta, la marca sigue y se aplica al reanudar.
- **QA-07.** Tras una baja, volver a alcanzar el tope bloquea de nuevo, y el escalón de RF-7.2 sigue contando los bloqueos automáticos anteriores. Un mensaje sin baja previa no se ve alterado.

**Alcanzaron un tope hoy**

- **QA-10.** Cada uno de los 5 topes (`orders`, `messages`, `cooldown`, `burst`, `minute`) entra enmascarado.
- **QA-11.** Número con dos o más topes: bloquear lo saca entero (H-8), también con 409.
- **QA-12.** Personal, en formas `521…` y `52…`: ráfaga y minuto no lo meten en la lista y el bot lo sigue atendiendo pasada la ventana. No se obtiene ningún token por ninguna petición.
- **QA-13.** Token de ayer a las 00:00:00 del negocio: 404 sin escribir, aunque nadie haya llamado a `snapshot`. A las 23:59:59 sigue válido.
- **QA-14.** Token usado, inexistente y mal formado: 404. Token válido con `duration` inválida: 422 y conserva el token.
- **QA-15.** Número ya bloqueado que sigue en la lista: 409, una sola fila y sale de la lista.
- **QA-16.** Rotación: bloqueos con la clave anterior → `previousKeyBlocks` correcto, con 0 cuando no hay. Una baja de un bloqueo con clave anterior libera el número (`hashes.previous`).

### Pruebas negativas y casos límite

- **QA-20.** Editor (Molotes y Birria): los 5 endpoints × {sin cuerpo, válido, JSON roto, más de 4 KiB, `text/plain`, sin CSRF, id y token inválidos} dan siempre 403 `FORBIDDEN_ROLE`, con el texto del bot y sin datos.
- **QA-21.** Sin sesión, Bearer mal formado o sesión caducada: 401 en los 5 endpoints.
- **QA-22.** Un administrador degradado a editor con sesión viva: 403 en la petición siguiente.
- **QA-23.** Ningún editor cambia nada: las 3 tablas y el estado del bot quedan iguales tras QA-20.
- **QA-24.** Administrador sin CSRF o con CSRF ajeno, con cuerpo inválido: 403 `CSRF_INVALID`, sin cambios (CSRF antes que cuerpo).
- **QA-25.** Con CSRF: 413, 415, 400 y 422 antes del dominio. Id y token inválidos solo se evalúan tras el cuerpo.
- **QA-26.** Rutas: otro método da 405 con `Allow`; `HEAD /bot` como editor no da datos; `/bot/productos` no cae en productos; `POST /bot/bloqueos/1/quitar/extra` da 404.
- **QA-30.** Motivo: 8 dígitos seguidos, 7 dígitos, 200 y 201 caracteres, solo espacios, tipos no texto, `null` y `paused` no booleano. CA-4: 422 y sin cambio de estado.
- **QA-31.** Alta inválida, del personal y ya bloqueado: 422, 422 y 409 sin escribir. Formatos `+52 55 …`, 10 dígitos, `52…` y `521…` son el mismo número: el bot lo ignora y el alta repetida da 409.
- **QA-32.** Id inexistente, ya quitado, `0`, `-1`, `1e3`, `2147483648` y `9999999999`: siempre 404, sin 500 ni 503 (R-4).
- **QA-33.** Sin clave: `GET` con `canBlock` falso, POST directo 409 antes del 422, 0 filas y `/topes` 404. Comprobar si `api` arranca con bot y sin clave.
- **QA-34.** Lectura con `storeHealthy` falso: 200 con la última copia. Escritura con la base caída: 503 sin detalles internos.
- **QA-35.** Sin bot: `enabled: false`, `provider: null`, y permite pausar. Con Twilio: `provider: 'twilio'`. Con `WHATSAPP_BOT_PROVIDER` definido y el bot sin crear, si la configuración lo permite: `enabled: false`.
- **QA-36.** Marca rancia (R-3): baja → alta de 24 h sin mensajes → caducidad → primer mensaje. Se registra qué pasa con los contadores.
- **QA-37.** Límite de 1000 marcas: 1001 bajas; solo se pierde la más antigua; repetir un hash ya marcado no debe expulsar otra. El caso borde del conjunto lleno se anota aparte.
- **QA-38.** Personal con clave y sin bot (R-5): alta directa del número del personal.
- **QA-39.** Día del negocio: paso de 23:59:59 a 00:00:00 con `BUSINESS_TIMEZONE=America/Mexico_City` y con una zona con horario de verano (`America/Tijuana`), con el proceso en `TZ=UTC` y `TZ=Asia/Tokyo`. Cubre lista, token, cupo diario y `release`.

### Pruebas de integración

Con procesos reales, MySQL 8.4 de pruebas y el doble de salida `salida-bot-doble.ts` (S-1). Ningún envío sale de la máquina. Webhook firmado y temporizadores reales, con `startStack`.

- **QA-40.** Pausar por `PUT /bot/interruptor` y enviar al webhook de inmediato: 0 salidas en el doble, sin esperar el refresco. Con refresco alto, para que no pueda ser él.
- **QA-41.** `bot_audit` tiene `bot_paused` y `bot_resumed` con autor y motivo; dos pausas seguidas: gana la última y hay dos filas.
- **QA-42.** Alta por API → webhook: el número no recibe nada y la lista lo muestra enmascarado.
- **QA-43.** Con un tope real alcanzado por webhook: baja por API → siguiente mensaje recibe respuesta. También con un bloqueo por repetición.
- **QA-44.** Ráfaga por webhook de un cliente y de un miembro del personal: solo el cliente aparece en `GET /bot`. Bloquear por token: `bot_block` y `bot_audit` correctos, y sale de la lista.
- **QA-45.** Reinicio real de `api` (SIGTERM y arranque sobre la misma base): lista vacía; bloqueos, interruptor y contadores siguen.
- **QA-46.** `GET /bot`: 5 contadores con `used`, `limit` y `reached`, frente a `bot_usage` tras tráfico real y frente a lo que muestra `/admin/bot` en la `landing-pages`. Ningún endpoint escribe topes.
- **QA-47.** Concurrencia con MySQL real (S-4): 5 altas simultáneas del mismo número dan una 201 y el resto 409, con 1 fila y 1 `block_added`. 5 bajas simultáneas: una 200, 1 `block_removed`. Dos envíos simultáneos del mismo token: 1 fila.

### Privacidad (CA-15)

Número conocido `5215512345678`, más las formas `525512345678` y `5512345678`. Se busca como texto en todo lo capturado.

- **QA-50.** Alta correcta y alta fallida en cada variante: inválido por campo, personal, ya bloqueado, JSON truncado, campo desconocido, más de 4 KiB, `text/plain`, y número en `reason`.
- **QA-51.** Cubre respuestas, stdout y stderr de `api`, y todas las filas de `bot_block` y `bot_audit`.
- **QA-52.** El mismo número entra además por el webhook (tope, bloqueo, baja). `GET /bot` no contiene `phoneHash`, `keyId` ni `last4`, ni como clave ni como valor. Los logs tampoco contienen el hash.
- **QA-53.** Contrato: `botStateResponseSchema` en modo estricto contra la respuesta real, sin claves de más. El número escrito con separadores en el motivo (`55 1234 5678`) se registra como observación: RF-3 solo prohíbe 8 dígitos seguidos, así que no es defecto por sí mismo.

### Pruebas de performance

**Duración por archivo (R-10)**

- **QA-60.** Archivos: `admin-produccion`, `last-admin-concurrency`, `admin-products-api-sesion` y `admin-products-api-validar`, en base y en PR.
- **Método:** árbol de base en un `git worktree` temporal en el scratchpad, con su propio `npm ci` (los enlaces de workspaces son relativos). 5 repeticiones alternadas base/PR de cada archivo, en serie y sin otra carga, con el reporte JSON de Vitest. Se dan mediana y rango.
- **QA-61.** Una pasada completa de `landing-pages` en cada árbol con los workers del CI, porque el dato del implementador es en paralelo.
- **QA-62.** Los 5 archivos nuevos y las sondas, 3 repeticiones, contra el límite de 20 s.
- **Lectura:** "empeora" solo si la mediana sube más del 5 % y los rangos no se solapan. Medida local, no del CI: si un archivo pasa de 20 s en local se informa aunque no empeore.

### Pruebas de regresión

- **QA-63.** `chat-bot-contract`, `whatsapp-bot-protection`, `bot-control*`, `bot-protection-qa-req-f-025`, `admin-bot*` y `bot-procesos-qa-req-f-042*`, dentro de la suite completa.
- **QA-64.** Convivencia (R-8): `/admin/bot` de la `landing-pages` con procesos reales. Pausa, alta y baja llegan a `api` dentro del refresco, y lo escrito por `api` se ve en `/admin/bot`. Se confirma lo declarado: esa baja no libera el cupo en `api`.
- **QA-65.** Refresco en curso que termina después de una escritura: no pisa la copia nueva, para `setPaused`, alta y baja (S-5, store envuelto con retardo).
- **QA-66.** Webhook: `WEBHOOK_PORT` responde 404 a `/api/v1/admin/bot*` (R-9). `git diff` sin cambios en `deploy/`, `compose*`, esquema ni `.env.example`.
- **QA-67.** Personal: órdenes y avisos al personal, y exenciones de `messages`, `cooldown` y `orders` iguales que en la base.
- **QA-68.** `adminOnly` sin mensaje propio sigue diciendo "gestionar usuarios". Los usuarios y la cuenta no cambian. `/bot/*` no choca con `/:business/productos`.

### Pruebas automatizadas

**Existentes, a ejecutar (desde `restaurante/`)**

- **QA-70.** `npm run typecheck`, `npm run lint` y `npm run build:css`, con salida 0 y sin cambios en `git status`.
- **QA-71.** `npm test` en los 3 workspaces. El "1 fallo esperado" de `landing-pages` se identifica y se compara con la base: debe ser una prueba marcada como esperada (`it.fails` o similar). Si es un fallo real, cuenta como rojo.
- **QA-72.** `inventory-manager` sin imports de `core` ni `db`, con el lint y `dependency-rule`.

**Sondas nuevas**

Solo en `restaurante/landing-pages/tests/`, con MySQL real de pruebas (`setupAdmin`, `makeDatabase`), y `listenLocal` o `startServer`. Sin `retry` ni `testTimeout` mayor, y partidas si pasan de 20 s.

| Sonda | Archivo | Casos |
| --- | --- | --- |
| S-1 | `integration/admin-bot-qa-req-f-043-proceso.test.ts` | QA-01, QA-02, QA-40 a QA-46, QA-64, QA-66 |
| S-2 | `integration/admin-bot-qa-req-f-043-acceso.test.ts` | QA-20 a QA-26, QA-30 a QA-35, QA-38 |
| S-3 | `integration/admin-bot-qa-req-f-043-privacidad.test.ts` | QA-50 a QA-53 |
| S-4 | `integration/admin-bot-qa-req-f-043-concurrencia.test.ts` | QA-32, QA-47 |
| S-5 | `unit/bot-control-qa-req-f-043.test.ts` | Core: QA-11, QA-13 a QA-16, QA-36, QA-37, QA-39, QA-65 |
| S-6 | Script temporal en el scratchpad, sin quedarse en el repositorio | `admit` con reloj inyectado: QA-03 a QA-07, QA-12, QA-39, QA-67 |

S-6 va fuera porque `landing-pages` no puede importar código de `api` (lint) y QA no escribe en `api/tests`. Si encuentra un defecto, la prueba permanente la añade `senior-fullstack`.

**Mutaciones (verificación de lo afirmado por `senior-fullstack`)**

Se hacen solo en la copia del scratchpad, nunca en el código del repositorio. Quitar cada corrección por separado y ejecutar las pruebas del PR:

- **M-1.** H-1 (`staffNumbers.has`): el implementador afirma 3 fallos.
- **M-2.** H-7 (`resetReachedIfNewDay`): afirma 2.
- **M-3.** H-8 (borrado por `hash`): afirma 1.
- **M-4.** DT-1 (`takeReleased` en `admit`): afirma 7.

Debe fallar al menos una prueba en cada mutación. Una diferencia en el número exacto se anota, pero no es defecto.

### Evidencia requerida

- Salida resumida y código de salida de QA-70 a QA-72.
- Por sonda: casos, resultado y captura de respuesta, filas o logs en cada fallo.
- Búsqueda del número conocido con 0 coincidencias, indicando el total de bytes revisados.
- Tabla base/PR de QA-60 a QA-62 y resultados de M-1 a M-4.
- `git status` antes y después, sin cambios fuera del ticket y de las sondas. Worktree temporal eliminado.

### Criterios de aprobación

- Todos los CA del PR 1 en PASS en la capa API, con evidencia de sonda y no solo de las pruebas del implementador.
- `typecheck`, `lint` y `npm test` en verde, con el fallo esperado explicado.
- Sin defectos `BLOCKER` ni `CRITICAL`; los `MAJOR` solo con decisión del usuario.
- Ninguna fuga del número en CA-15.
- Cada mutación es detectada.
- Los 4 archivos no empeoran según QA-60. Si empeoran, o si alguno pasa de 20 s en local por este PR, se informa y se pide decisión.
- Las hipótesis R-3, R-4 y R-5 quedan confirmadas como defecto o descartadas con evidencia. Si el requisito no permite decidir, se devuelve `NEEDS_USER_DECISION`.

No se ejecutan despliegue real ni `revert`, ni se usan bases de desarrollo o de producción.

## QA Report

### Ronda

Ronda 1, PR 1 de 3 (contratos, core y `api`), sobre el working tree sin commit (base `76a70f2`). Aprobación del plan, cita textual: "Si", en respuesta a "¿Apruebas el plan de QA con esos 3 puntos?". NotebookLM no estaba disponible: no se consultó.

### Pruebas ejecutadas

| Comando o acción | Resultado real |
| --- | --- |
| `npm run typecheck` (con sondas) | 0 |
| `npm run lint` (con sondas) | 0, sin avisos |
| `npm run build:css` | 0 |
| `npm test`, sin sondas | 0. `api` 40 archivos, 1049 pasan; `landing-pages` 130 archivos, 1456 pasan y 1 fallo esperado (1457); `inventory-manager` 8 archivos, 115 pasan |
| `npm test`, con las 5 sondas | 0. `api` 1049; `landing-pages` 135 archivos, 1489 pasan y 1 fallo esperado (1490); `inventory-manager` 115 |
| Sondas S-1 a S-5 | 5 archivos, 33 pruebas, 3 repeticiones sin fallos |
| Sonda S-6 (`admit`, reloj inyectado, scratchpad) | 14 casos PASS. QA-39 repetido en `TZ=UTC` y `TZ=Asia/Tokyo` con `America/Mexico_City` y `America/Tijuana`, PASS |
| Mutaciones M-1 a M-4 | Detectadas todas, ver abajo |
| `git worktree list` al final | Solo el árbol principal; el temporal se eliminó |

El "1 fallo esperado" es el `it.fails` de `landing-pages/tests/integration/local-server.test.ts:88`. El archivo no cambia en este PR, y la base da también 0 fallidos.

**Mutaciones**, en la copia temporal, nunca en el repositorio. Sin mutar: 0 fallos.

| Mutación | Afirmado | Medido |
| --- | --- | --- |
| M-1, H-1 | 3 | 3 |
| M-2, H-7 | 2 | 2 |
| M-3, H-8 | 1 | 1 |
| M-4, DT-1 | 7 | 7 |

Todos los fallos están en `api`. Las 17 pruebas de `landing-pages` ejecutadas en cada mutación (`admin-bot*`, `bot-control*`, `bot-protection*`, `tests/unit/bot*`) siguen en verde.

### Criterios de aceptación

Parte API de cada criterio. La parte de pantalla sigue pendiente del PR 2.

| CA | Resultado | Evidencia |
| --- | --- | --- |
| CA-1 | PASS | S-2: más de 70 combinaciones de editor dan 403 `FORBIDDEN_ROLE` con el texto del bot, sin datos y con las 3 tablas iguales. Administrador degradado: 403 en la petición siguiente |
| CA-2 | PASS | S-2: sin CSRF, inválido o de otra sesión: 403 `CSRF_INVALID` en las 4 escrituras, sin cambios |
| CA-3 | PASS | S-1, con `server.ts` real y refresco de 300 s: pausa → webhook → 0 salidas y `bot_paused_dropped`. Reanudar responde. `bot_audit` con autor y motivo |
| CA-4 | PASS | S-2: 8 dígitos y 201 caracteres dan 422 sin cambio; 7 dígitos y 200 caracteres pasan |
| CA-5 | PASS | S-1: alta por API → `bot_blocked_message` y 0 salidas; lista enmascarada |
| CA-6 | PASS (API) | S-2 y S-3: 422, 422 y 409 sin escribir. Las formas `+52`, 10 dígitos, `52` y `521` son el mismo número. El teléfono vacío en el formulario es del PR 2 |
| CA-7 | PASS | S-1 y S-6: baja de bloqueo manual, tope y enfriamiento devuelve la atención el mismo día. Ids inexistentes, ya quitados y fuera de rango dan 404 |
| CA-8 | PASS | S-1, S-5: enmascarado, los 5 topes, sale entero (H-8) |
| CA-9 | PASS | S-1, S-6: ráfaga y minuto del personal, formas `521` y `52`: no entra en la lista y se le atiende pasada la ventana |
| CA-10 | PASS (API) | S-5, S-6: token de ayer 404 a las 00:00:00 y válido a las 23:59:59; usado e inexistente 404; ya bloqueado 409 sin duplicar. S-4: 5 envíos simultáneos dan 1 fila |
| CA-11 | PASS | S-1, SIGTERM y arranque real: lista vacía; bloqueo, pausa y contadores iguales |
| CA-12 | PASS (API) | S-1: 5 contadores, iguales a `bot_usage` y a `/admin/bot`. No hay endpoint que escriba topes |
| CA-13 | PASS (API) | S-2: sin clave, 409 `BOT_KEY_MISSING` antes del 422, 0 filas. Con bot y sin clave, `api` no arranca |
| CA-14 | PASS (API) | S-5: `previousKeyBlocks` 1 y luego 0; la baja libera con el hash anterior |
| CA-15 | PASS (alcance del PR) | S-3: ver Privacidad |
| CA-19 | PASS (API) | S-2, fallo parcial real (`RENAME TABLE bot_block`): 200 con `storeHealthy: false` y la última copia; 503 sin detalles en la escritura; recupera al restaurar |
| CA-20 | PASS (API) | S-2: sin bot, `enabled: false`; solo `WHATSAPP_BOT_PROVIDER=meta`, `enabled: false`; Twilio, `provider: 'twilio'`; permite pausar |
| CA-22 | PASS | `typecheck`, `lint` y `npm test` en 0. `inventory-manager` sin imports de `core` ni `db` |

CA-16, CA-17, CA-18 y CA-21 no aplican a este PR.

### Hipótesis del plan

- **R-3, marca rancia:** confirmada, con impacto muy bajo. Es DEF-001.
- **R-4, id fuera de rango:** descartada. `2147483648`, `4294967296` y `9999999999` dan 404 con MySQL real.
- **R-5, personal sin bot:** descartada. Sin bot se ignora la clave (`parseBotKeys`), así que no hay alta posible: 409 y 0 filas.

### Defectos encontrados

Ninguno `BLOCKER`, `CRITICAL`, `MAJOR` ni `MINOR`.

### DEF-001

- Severidad: TRIVIAL
- Criterio de aceptación afectado: ninguno. Roza DT-1
- Descripción: la marca de `takeReleased` no se borra si el número se vuelve a bloquear sin haber escrito.
- Pasos para reproducir: número con enfriamiento activo → alta → baja → alta de 24 h sin mensajes → caducidad → primer mensaje.
- Resultado esperado: no definido por el requisito.
- Resultado actual: el primer mensaje consume la marca y olvida el estado del número.
- Evidencia: S-6, caso QA-36b, con enfriamiento de 48 h: `process`. S-5, "observación de la marca sin consumir".
- Impacto: con la configuración por defecto no se observa. El bloqueo manual más corto es de 24 h, así que los contadores del día ya cambiaron y el enfriamiento de 30 min ya terminó. Solo se nota con un enfriamiento de 24 h o más.
- Recomendación: dejarlo o borrar la marca al dar un alta. No bloquea este PR.

### DEF-002

- Severidad: TRIVIAL
- Criterio de aceptación afectado: ninguno
- Descripción: con el conjunto lleno (1000), marcar de nuevo un número ya marcado expulsa a otro sin necesidad.
- Pasos para reproducir: 1000 bajas de números distintos sin mensajes → alta y baja de uno de ellos → `takeReleased` del más antiguo.
- Resultado esperado: el conjunto no cambia, porque ese número ya estaba.
- Resultado actual: devuelve `false`.
- Evidencia: S-5, QA-37.
- Impacto: exige 1000 bajas sin consumir, y su efecto es que ese número conserva sus topes de hoy, comportamiento ya declarado al llenarse.
- Recomendación: mirar si ya está antes de expulsar.

### DEF-003

- Severidad: TRIVIAL
- Criterio de aceptación afectado: ninguno. Roza el orden de RF-1
- Descripción: en `/bot/topes/:token/bloquear`, el formato del token se valida antes que `duration` y `reason`.
- Pasos para reproducir: `POST /bot/topes/noesuntoken/bloquear` con `{"duration":"nope"}`.
- Resultado esperado: 422, según "cuerpo, luego dominio".
- Resultado actual: 404. Con un token bien formado, 422.
- Evidencia: S-2, QA-25.
- Impacto: solo con una petición manipulada; ambos códigos son seguros y no escriben. La pantalla siempre envía tokens de la lista.
- Recomendación: decidir el orden y dejarlo igual para token bien y mal formado.

### Regresión

- Suite completa en verde, incluidas las de REQ-F-025 y REQ-F-042.
- **Convivencia (S-1, procesos reales):** pausa y alta en `/admin/bot` llegan a `api` en el refresco; baja y pausa de la API se ven en `/admin/bot`. Una baja en `/admin/bot` no libera el cupo en `api`, tal como se declaró (solo en local).
- **Refresco en curso (S-5, con store en memoria envuelto):** pausa, alta y baja no se pierden.
- **Webhook:** `WEBHOOK_PORT` da 404 en `/api/v1/admin/bot*` con GET, PUT y POST. El puerto interno da 404 en `/webhooks/whatsapp`.
- **Infraestructura:** sin cambios en `deploy/`, `compose*`, esquema ni `.env.example`.
- **Personal (S-6):** exento de `messages`, `cooldown` y `orders`, sin lista ni bloqueo. El escalón RF-7.2 se conserva tras una baja: 24 h → 168 h.
- **Rutas:** `/bot/productos` da 404, sin caer en productos. `adminOnly` sin mensaje propio sigue diciendo "gestionar usuarios". 5 altas simultáneas dan 1 fila y 1 `block_added`; 5 bajas, 1 `block_removed`.

### Privacidad

- `5215512345678`, `525512345678` y `5512345678` no aparecen en ninguna parte tras un alta correcta, 8 envíos fallidos, un motivo con el número, tope por webhook, bloqueo automático y baja.
- Revisados: respuestas 3903 bytes, stdout 6420, stderr 0, tablas 1524 (2 filas de `bot_block`, 4 de `bot_audit`). 0 coincidencias.
- Las respuestas no contienen `phoneHash`, `phone_hash`, `keyId`, `key_id` ni `last4`. Las claves de `bot`, `blocks` y `reached` son exactamente las del contrato. Respuestas y logs tampoco contienen el hash real.
- **Motivo con separadores:** `validateReason` también rechaza `tel 55 1234 5678` y `55-1234-5678`, de modo que la observación prevista en QA-53 no aplica.
- **Observación:** el 422 de campo desconocido devuelve el nombre del campo. Solo repite lo que envió el propio administrador con una petición manipulada; el cliente nunca lo hace.

### Performance

**QA-60.** En serie, 5 repeticiones alternadas. Mediana (mínimo a máximo), en segundos. Ninguno empeora según el criterio del plan.

| Archivo | Base | PR |
| --- | --- | --- |
| `admin-produccion` | 5,63 (5,54 a 5,72) | 5,60 (5,56 a 5,65) |
| `last-admin-concurrency` | 9,71 (9,51 a 9,88) | 9,77 (9,53 a 10,01) |
| `admin-products-api-sesion` | 4,74 (4,72 a 4,76) | 4,70 (4,67 a 4,70) |
| `admin-products-api-validar` | 4,73 (4,68 a 4,79) | 4,66 (4,63 a 4,78) |

**QA-61.** `landing-pages` completo, sin sondas salvo donde se indica. Una pasada por configuración, en segundos.

| Archivo | Base, 4 workers | PR, 4 workers | Base, por defecto | PR, por defecto (con sondas) |
| --- | --- | --- | --- | --- |
| `admin-produccion` | 6,6 | 5,9 | 13,0 | 10,2 |
| `last-admin-concurrency` | 9,4 | 8,9 | 12,8 | 14,0 |
| `admin-products-api-sesion` | 5,8 | 5,6 | 10,9 | 12,0 |
| `admin-products-api-validar` | 5,7 | 5,6 | 11,4 | 12,0 |
| Pasada total | 126,8 | 125,4 | 91,6 | 94,6 |

Las diferencias van en los dos sentidos y son de una sola pasada: ruido de reparto entre workers. Ninguno llega a los 17 a 19 s anotados por el implementador. Es medida local, no del CI.

**QA-62.** 3 repeticiones, máximo en segundos: `admin-bot-api-process` 4,2, `admin-bot-api` 1,7, `admin-bot-effects` 1,6, los dos unitarios menos de 0,1. Sondas: `proceso` 16,2, `acceso` 13,4, `concurrencia` 4,4, `privacidad` 3,0, `bot-control` 0,1.

**Riesgo nuevo:** en la pasada por defecto, `acceso` (17,2 s) y `proceso` (17,1 s) son los dos archivos más largos de `landing-pages`. Cumplen el límite en local, pero hay que mirarlos en el CI: si pasan de 20 s, se parten por sus `describe`.

### Pendientes de revisión manual

Ninguno de este PR. No hubo pasada de navegador: no hay pantalla.

**Sin ejecutar:**

- CA-16, CA-17, CA-18 y CA-21, y la parte de pantalla de los demás CA: PR 2 y PR 3.
- Despliegue real y `revert`, y tiempos en el CI real.
- Sesión caducada de verdad: QA-21 usó tokens desconocidos y mal formados, no una caducidad real.
- Bloqueo automático por repetición por webhook: exige esperar 1 min de enfriamiento. Queda cubierto en S-6, y S-1 cubre la baja con un enfriamiento real.
- Medianoche con el proceso real: cubierta con reloj inyectado en S-5 y S-6, en las zonas del plan.

### Resultado final

QA_APPROVED

## Historial de cambios

### Versión 1

Análisis inicial con hallazgos H-1 a H-5 y cuatro decisiones de negocio abiertas. Estado: `NEEDS_CLARIFICATION`.

### Versión 2

Incorpora las decisiones D-1 a D-4 del usuario (2026-11-04), todas en la opción recomendada, y resuelve H-2. Aprobada por el usuario el 2026-11-04. Cita textual: "Si lo apruebo". Estado: `APPROVED`.

Registro posterior, sin cambio de requisitos ni de versión (2026-11-04): el usuario autorizó actualizar `.claude/CLAUDE.md` §8. Cita textual: "Lo autorizo".

### Implementación

Registro de DT-1 a DT-3 y aprobación del plan ("Apruebo, implementar", 2026-11-04). Ticket en `in-progress/`, rama `feature/REQ-F-043-control-bot-admin-nuevo-1-api`. PR 1 implementado y validado, sin commit (2026-11-04). Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

### Revisión técnica (T1)

Revisión técnica y Technical Action Plan de senior-fullstack (2026-11-04): resuelve las inferencias, reproduce H-1 y H-3, y añade H-6 a H-10. Quedan pendientes las decisiones DT-1 a DT-3. Sin cambios de código. Estado: `NEEDS_TECHNICAL_CLARIFICATION`.

### QA (Q1, PR 1)

Implementación del PR 1 aprobada por el usuario (cita textual: "Si", en respuesta a "¿Apruebas la implementación del PR 1 para pasarla a QA?"). QA Action Plan escrito por senior-qa (2026-11-04), sin ejecutar pruebas ni tocar código. Estado: `NEEDS_QA_PLAN_APPROVAL`.

### QA (Q2, PR 1, ronda 1)

Plan aprobado por el usuario (cita textual: "Si", en respuesta a "¿Apruebas el plan de QA con esos 3 puntos?"). Validación ejecutada (2026-11-05): 18 criterios en PASS en la capa API, 3 defectos `TRIVIAL` (DEF-001 a DEF-003), mutaciones detectadas y sin empeorar la duración. 5 archivos de prueba nuevos en `restaurante/landing-pages/tests/`, sin commit. Estado: `QA_APPROVED`.

### Pull Request del PR 1

PR #130 hacia `epic/arquitectura`, commit `9f88402` (2026-11-05). El CI quedó en verde, pero `admin-bot-qa-req-f-043-acceso` tardó 31,3 s y `-proceso` 30,3 s, por encima del límite de 20 s por archivo. Se parten por `describe`, sin cambiar los casos, en `-acceso`, `-validacion`, `-estado`, `-proceso`, `-proceso-reinicio` y `-convivencia`, con la preparación en `tests/support/`. Siguen las 33 pruebas de las sondas. Sin cambios en código de producción.
