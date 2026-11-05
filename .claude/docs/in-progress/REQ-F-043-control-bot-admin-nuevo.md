# REQ-F-043 — Control del bot en el admin nuevo: pausa, bloqueos y topes

## Estado

READY_FOR_MERGE

PR 1 de 3 (contratos y `api`): [PR #130](https://github.com/orvigas/negocio/pull/130), mergeado en `epic/arquitectura` (`1c801cf`). PR 2 de 3 (pantalla): [PR #131](https://github.com/orvigas/negocio/pull/131), mergeado en `epic/arquitectura` (`0391e86`). PR 3 de 3 (solo lectura y documentación): [PR #132](https://github.com/orvigas/negocio/pull/132) hacia `epic/arquitectura`, con el CI en verde, pendiente del merge del usuario.

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

## Implementation Result (PR 2 de 3)

Resultado del PR 2 de 3 (pantalla "Bot" en `inventory-manager`). Sin commit, push ni PR. No corrige DEF-001 a DEF-003, y `/admin/bot` en solo lectura y la documentación siguen en el PR 3.

### Rama

`feature/REQ-F-043-control-bot-admin-nuevo-2-pantalla`, creada desde `epic/arquitectura` (`1c801cf`).

### Cambios realizados

- **Pantalla:** `GET /bot` con Estado, Uso, Alcanzaron un tope hoy, Lista negra y Bloquear un número, en `ul` de tarjetas, sin `<table>` y sin JavaScript nuevo. Enlace "Bot" en la cabecera solo para administradores.
- **Acciones:** los 4 POST con POST/redirect/GET, mismo origen, lista cerrada de campos y el cliente de `contracts`. `ok` es una lista cerrada, y `n` solo acepta 4 dígitos.
- **Fallos (RF-12):** una escritura sin confirmar da 503 con "No pudimos confirmar el cambio. Revisa el estado antes de repetirlo." y enlace a `/bot`. El alta pinta además el formulario suelto. Un 404 con otro `code` no se trata como "no encontrado" (H-10).
- **`common.ts`:** recibe `readClosedForm`, `adminSession`, `forbidden` y `fieldErrors`, que `users.ts` ahora usa sin cambiar su comportamiento.
- **Pruebas:** doble `api-double-bot.ts`, `bot-page.ts` y 3 archivos nuevos con 63 pruebas.

### Criterios de aceptación

| CA | Estado en este PR |
| --- | --- |
| CA-1, CA-2 | Cumplidos en pantalla (`bot-access`) |
| CA-3, CA-4, CA-5, CA-6, CA-7, CA-8, CA-10, CA-12, CA-13, CA-14, CA-19, CA-20 | Cumplidos en pantalla (`bot-actions`) contra el doble. CA-3, CA-5, CA-6 y CA-7 también en la pasada con la `api` real |
| CA-9, CA-11 | Son de la API y siguen cubiertos por el PR 1. La pantalla solo pinta lo que recibe |
| CA-15 | Cumplido en HTML, URL y logs de `inventory-manager`. En la pasada real, tampoco en los logs de `api` |
| CA-18 | Cumplido (`bot-failures`) |
| CA-21 | Cumplido: medido en Chrome headless (ver abajo) |
| CA-22 | Cumplido en este PR. Se repite en el PR 3 |
| CA-16, CA-17 | Pendientes (PR 3) |

### Validaciones ejecutadas

| Comando | Resultado |
| --- | --- |
| `npm run typecheck` | 0 |
| `npm run lint` | 0, sin avisos |
| `npm run build:css` | 0 |
| `npm test`, `api` | 40 archivos, 1049 pruebas pasan |
| `npm test`, `inventory-manager` | 11 archivos, 182 pruebas pasan |
| `npm test`, `landing-pages` | 139 archivos, 1489 pasan y 1 fallo esperado (1490) |

- **Duración local:** `bot-access` 0,5 s (12 pruebas), `bot-actions` 1,1 s (26) y `bot-failures` 1,7 s (25). El límite acordado era ~10 s.
- **Mutaciones (se restauró el código tras cada una):** ignorar `code` en el 404 y 409: 2 fallos. Afirmar "no se guardó": 15. Conservar un motivo con teléfono: 4. Tratar un 404 ajeno como "no encontrado": 3.
- **Navegador:** Chrome headless por el protocolo de DevTools, con pruebas temporales ya borradas.
  - Contra el doble, con textos de 200 caracteres sin espacios, 2 topes, 2 bloqueos y 2 avisos: sin desplazamiento horizontal a 375, 768 y 1280 px, ni a 375 px sin JavaScript.
  - Teclado: 21 paradas en orden visual, todas con foco visible (`outline` de 2 px).
  - Con JavaScript desactivado y usando solo Enter, contra `api` real y MySQL: pausa, alta, alta repetida (409), inválida y del personal (422), baja y reanudación funcionan. `bot_audit` queda con `bot_paused`, `block_added`, `block_removed` y `bot_resumed`, y el número no aparece en los logs de `api` ni de `inventory-manager`.
- **Corregido por la pasada:** `sanitizeNext` no aceptaba `/bot`, de modo que al volver a entrar se perdía el retorno. Y el nombre de la variable de la clave se salía del aviso a 375 px: `notice.html` ahora lleva `break-words`, en todas las pantallas.

### Archivos afectados

- `restaurante/inventory-manager/src/controllers/bot.ts` (nuevo), `common.ts`, `users.ts`
- `restaurante/inventory-manager/src/views/bot.ts` (nuevo), `index.ts`
- `restaurante/inventory-manager/src/views/pages/bot.html`, `bot-block-form.html` (nuevos)
- `restaurante/inventory-manager/src/views/partials/bot-*.html` (9 nuevos), `notice.html`
- `restaurante/inventory-manager/src/routes.ts`, `app.ts`, `session.ts`
- `restaurante/inventory-manager/tests/integration/bot-access.test.ts`, `bot-actions.test.ts`, `bot-failures.test.ts` (nuevos)
- `restaurante/inventory-manager/tests/support/api-double-bot.ts`, `bot-page.ts` (nuevos), `api-double.ts`, `browser.ts`
- `restaurante/inventory-manager/tests/unit/config-session.test.ts`

### Desviaciones del plan

- **Motivo con posible teléfono:** no se conserva tras un error, ni con la API caída, aunque D-4 dice que el motivo se conserva. Copia la regla de dígitos de core solo para no repintar (`keptReason`), porque ese motivo podría ser el número que RF-9 protege. Es lo que hace hoy `/admin/bot`.
- **`session.ts`:** no estaba en la lista del plan. Hacía falta para volver a `/bot` tras entrar.
- **`notice.html`:** cambio mínimo que afecta a todos los avisos del admin nuevo.
- **Sin `type="tel"`:** `field-input.html` fija `type="text"`; se usa `inputmode="tel"`, que da el mismo teclado.
- **Un `:id` que no es número:** responde con la página 404 común, sin lista. Solo pasa con una URL manipulada.
- **Tras un 422 o 409 del alta, si tampoco se puede leer el estado:** formulario suelto con el aviso de cambio sin confirmar.

### Riesgos o pendientes

- **"Alcanzaron un tope hoy" contra la `api` real:** no se probó en navegador, porque exige tráfico real al bot. Se probó contra el doble, y la API en el PR 1.
- **El doble no sustituye a la `api`:** las reglas siguen probadas en `api/tests`. En un fallo real con la escritura aplicada, la pantalla no lo distingue: por eso invita a revisar.
- **Duraciones en CI:** son locales. En el PR 1 casi se duplicaron en el CI.
- **`npm run dev`:** la pasada usó los mismos procesos (`server.ts`) con una base de pruebas, no el entorno de `npm run dev` ni los datos locales.
- **DEF-001 a DEF-003:** siguen abiertos, a la espera de la decisión del usuario.

## Implementation Result (PR 3 de 3)

Resultado del PR 3 de 3 (`/admin/bot` en solo lectura y documentación). Sin commit, push ni PR. No corrige DEF-001 a DEF-004.

### Rama

`feature/REQ-F-043-control-bot-admin-nuevo-3-solo-lectura`, creada desde `epic/arquitectura` (`0391e86`).

### Cambios realizados

- **Solo lectura (RF-10):** con `ADMIN_NEW_URL`, `GET /admin/bot` muestra estado, contadores, aviso de topes y lista negra, sin formularios ni columna "Acción", con el aviso "El bot ahora se controla en el admin nuevo." y el enlace a `<ADMIN_NEW_URL>/bot`.
- **Los 4 POST:** pasan por `access.post` (sesión, permiso, cuerpo y CSRF, cada uno con su lista de campos) y responden 410 con esa misma página, sin validar el contenido ni escribir. Registran `admin_bot_moved` con `action` y `userId`.
- **Sin `ADMIN_NEW_URL`:** el controlador es el de siempre. Solo cambia `REACHED_MOVED_MESSAGE`: "La lista de números que alcanzaron un tope hoy está en el admin nuevo." (excepción aprobada a CA-17).
- **Plantillas:** el formulario del interruptor y la sección de alta salen de `bot.html` a los parciales `bot-switch-form.html` y `bot-add-section.html`, para no duplicar la página. Nuevos: `bot-moved-link.html` y `bot-block-row-readonly.html`.
- **Documentación (RF-14):** `docs/arquitectura.md` (§1, §6, §8 y §10), `docs/despliegue.md` (qué se despliega, regla del bot, aviso al personal, §6 y §8), `README.md` (monorepo, API propia, Admin nuevo, Bot, Topes) y `.claude/CLAUDE.md` §8 (solo las líneas de `api` e `inventory-manager`). `.claude/rules/` y `.claude/agents/` sin cambios: el plan no los pide.
- **Pruebas:** `admin-bot-moved.test.ts` (nuevo, 7 pruebas). El texto nuevo sustituye al anterior en `bot-procesos-qa-req-f-042.test.ts` y `bot-protection-qa-req-f-025.test.ts`, con 4 líneas. El comentario de cabecera de `admin-users-moved.test.ts` deja de decir que el bot sigue igual.

### Criterios de aceptación

Estado final de todo el ticket:

| CA | Estado |
| --- | --- |
| CA-1 a CA-15, CA-18 a CA-21 | Cumplidos en el PR 1 y el PR 2, con QA aprobado. Sin cambios en este PR. CA-11 y CA-9 son de la API |
| CA-16 | Cumplido: sin formularios, con el enlace; los 4 POST dan 410 y `bot_control`, `bot_block`, `bot_audit` y `bot_usage` no cambian, con filas en las 4. Pendiente de QA |
| CA-17 | Cumplido, con la excepción de texto aprobada: formularios, escrituras y 410 de la lista de topes siguen igual. `admin-bot.test.ts` (CA-12 de REQ-F-025) pasa sin cambios y cubre el plazo de 10 s. Pendiente de QA |
| CA-22 | Cumplido en este PR |
| RF-14 | Hecho. Se revisa en QA |

### Validaciones ejecutadas

| Comando | Resultado |
| --- | --- |
| `npm run typecheck` | 0 |
| `npm run lint` | 0, sin avisos |
| `npm run build:css` | 0 |
| `npm test`, `api` | 40 archivos, 1049 pruebas pasan |
| `npm test`, `inventory-manager` | 11 archivos, 182 pruebas pasan |
| `npm test`, `landing-pages` | 151 archivos, 1557 pasan y 1 fallo esperado (1558), 103 s |

- **Duración local:** `admin-bot-moved.test.ts`, 7 pruebas en 3,4 s de pruebas (4,8 s con la preparación). El límite acordado era ~10 s.
- **Mutaciones (se restauró el código tras cada una):** dejar escribir el interruptor: 2 fallos. El alta: 1. La baja: 1. Pintar los formularios en `GET`: 1.
- **Procedimiento de `despliegue.md` §6:** `docker compose config` con `RESTAURANTE_INVENTORY_IMAGE` en el entorno, sobre `deploy/compose.prod.yaml` y un archivo de variables de prueba, resuelve la imagen por digest. Sin `sudo`, sin `--env-file state/release.env` y sin arrancar nada.

### Archivos afectados

- `restaurante/landing-pages/src/controllers/admin-bot.ts`
- `restaurante/landing-pages/src/views/admin/bot.ts`, `bot.html`
- `restaurante/landing-pages/src/views/admin/partials/bot-switch-form.html`, `bot-add-section.html`, `bot-moved-link.html`, `bot-block-row-readonly.html` (nuevos)
- `restaurante/landing-pages/tests/integration/admin-bot-moved.test.ts` (nuevo), `admin-users-moved.test.ts`, `bot-procesos-qa-req-f-042.test.ts`, `bot-protection-qa-req-f-025.test.ts`
- `restaurante/docs/arquitectura.md`, `restaurante/docs/despliegue.md`, `restaurante/README.md`
- `.claude/CLAUDE.md` (§8)
- Este ticket

### Desviaciones del plan

- **Aviso extra en el 410:** además de la página, muestra "No se guardó nada: este cambio se hace en el admin nuevo." con `role="alert"`. El plan solo pide la misma página, pero una pestaña antigua con un formulario debe saber que su pausa no se aplicó.
- **`?ok=` en solo lectura:** se ignora, para no anunciar un cambio que ya no se hace aquí.
- **Motivo del log:** `admin_bot_moved` lleva `action` en lugar de `path`, a diferencia de `admin_users_moved`, para no guardar en esa línea el token de la ruta de topes. La línea `request` de siempre sí registra la ruta, y ese token ya no corresponde a ningún número en `landing-pages`.
- **"Mientras tanto":** sin `ADMIN_NEW_URL` se conserva la frase "Mientras tanto, puedes bloquear un número…", porque el cambio aprobado es solo `REACHED_MOVED_MESSAGE`. Suena algo desfasada. En solo lectura se omite.
- **`docs/arquitectura.md` §1:** no estaba en la lista del plan. Se actualizó porque describía `inventory-manager` sin el bot.
- **`README.md`, "Bot de WhatsApp" y "Monorepo":** tampoco estaban en la lista. Tenían afirmaciones que dejaban de ser ciertas.

### Riesgos o pendientes

- **Sin ejecutar:** el despliegue real, el `revert` y `sudo env … up` de §6. Las comprobaciones nuevas de §8, incluida DT-3, se hacen en producción tras desplegar la épica.
- **Sin pasada en navegador de `/admin/bot`:** la página usa el mismo diseño, con menos controles, pero no se midió a 375 px.
- **Aviso al personal:** está documentado; darlo es tarea del usuario al desplegar.
- **Duraciones en CI:** son locales.
- **DEF-001 a DEF-004:** siguen abiertos, a la espera de la decisión del usuario.

### Correcciones tras QA (DEF-005 a DEF-007)

`QA_REJECTED` solo por documentación. Sin cambios de comportamiento.

- **DEF-005:** `despliegue.md` §6 sigue el orden `inventory-manager`, app y `api`. El paso 3 (`inventory-manager`, solo si la `api` vuelve a una versión anterior a REQ-F-043) va antes de la app (paso 4) y de la `api` (paso 5). Los comandos no cambian.
- **DEF-006:** el aviso al personal describe lo que pasa: el despliegue cierra las sesiones, el formulario antiguo lleva al acceso con "Tu sesión caducó. Vuelve a entrar. No se guardó ningún cambio." y la acción no se aplicó.
- **DEF-007:** `landing-pages/.env.example`, `deploy/compose.prod.yaml` y `src/config/env.ts` incluyen el bot y las demás pantallas en solo lectura. §8 nombra `WHATSAPP_BOT_STAFF_MOLOTES` y `WHATSAPP_BOT_STAFF_BIRRIA`.
- **Desviación:** el criterio de finalización "`deploy/` sin cambios" ya no se cumple al pie de la letra: `compose.prod.yaml` cambia solo en un comentario, a petición de QA. Ese archivo está en `DEPLOY_FILES` de `deploy.sh`, así que cambia la suma y un despliegue da código 4 hasta reinstalar `deploy/`. La épica ya lo exigía: `compose.prod.yaml` y `deploy.sh` difieren entre `origin/main` y `origin/epic/arquitectura`.
- **Validación:** `typecheck` 0, `lint` 0. `npm test`: `api` 40 archivos y 1049 pruebas; `landing-pages` 155 archivos, 1570 pasan y 1 fallo esperado (1571), con las sondas de QA; `inventory-manager` 11 archivos y 182 pruebas.
- **Sin ejecutar:** §6 en el VPS, con su nuevo orden.

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

## QA Action Plan (PR 2 de 3)

Plan del PR 2 de 3 (pantalla "Bot" de `inventory-manager`), sobre el working tree sin commit de `feature/REQ-F-043-control-bot-admin-nuevo-2-pantalla` (base `epic/arquitectura`, `1c801cf`). Aprobación de la implementación, textual: "Si y apruebo", aceptando que el motivo con posible teléfono se vacíe. DEF-001 a DEF-003: "No, a QA tal cual (Recomendado)"; no se revalidan. NotebookLM no tiene herramientas disponibles en la sesión: no se consultó. `Calculadora.xlsx` queda fuera.

Las 63 pruebas del implementador corren contra un doble que él mismo escribió: se ejecutan, pero no cuentan como evidencia independiente. Cada riesgo alto se comprueba con procesos reales, con una sonda propia o con una mutación.

### Objetivo

Comprobar de forma independiente que la pantalla "Bot" cumple su parte de los CA contra la `api` real, que el número nunca se filtra y que el cambio en piezas compartidas no rompe nada.

### Requisito bajo prueba

RF-1 a RF-9, RF-12 y RF-13 en pantalla; D-1 a D-4, con la desviación de D-4 aceptada por el usuario (motivo con 8 o más dígitos vaciado); H-10. Fuera: CA-16, CA-17 y RF-14 (PR 3), y CA-9 y CA-11, salvo lo que se ve en pantalla (ya aprobados en la API).

### Criterios de aceptación

| CA | Casos |
| --- | --- |
| CA-1 | QA2-30 a QA2-33, QA2-60 |
| CA-2 | QA2-34, QA2-35 |
| CA-3, CA-4 | QA2-01, QA2-02, QA2-21 |
| CA-5, CA-6 | QA2-03, QA2-04, QA2-20 a QA2-23 |
| CA-7 | QA2-05, QA2-06 |
| CA-8, CA-10 | QA2-10 a QA2-15 |
| CA-9 (solo en pantalla) | QA2-11 |
| CA-12, CA-14, CA-20 | QA2-07 a QA2-09 |
| CA-13 | QA2-08 |
| CA-15 | QA2-24 a QA2-27 |
| CA-18, CA-19 | QA2-40 a QA2-47 |
| CA-21 | QA2-60 a QA2-68 |
| CA-22 | QA2-90 a QA2-92 |

### Riesgos identificados

Por orden de impacto. Las hipótesis salen de leer el código y aún no son defectos: se confirman o se descartan en Q2.

- **R-1. Doble frente a `api` real.** La lista de topes nunca se vio contra la `api` real con tráfico al webhook. El doble puede aceptar formas que la `api` no devuelve.
- **R-2. Hipótesis: `keptReason` diverge de core.** Core normaliza espacios y rechaza controles antes de mirar dígitos; `keptReason` no. Un motivo como `5512<U+0001>3456` da 422 en core y `keptReason` lo vuelve a pintar. Si el carácter separa un teléfono completo, RF-9 queda rozado.
- **R-3. Hipótesis: error invisible en topes.** Si el 422 llega con un token que ya no está en la lista, `reachedRows` no pinta el error: 422 sin explicación.
- **R-4. Hipótesis: orden frente a CA-1.** `readClosedForm` corre antes de `adminSession`: un editor con un campo desconocido o un cuerpo grande recibe 400 o 413, no el 403 de "con o sin cuerpo". Sin datos ni escritura, pero distinto del texto de CA-1. Se compara con Usuarios.
- **R-5. Fuga por caminos de error.** Formulario suelto con `_csrf` reflejado (escapado), 400, 413, sesión caída, y `failureReason` en logs.
- **R-6. Aviso engañoso (RF-12).** `api` caída, 5xx, `network`, `invalid_response`, `timeout`, 404 `NOT_FOUND`, 429 y otros 400: ninguno puede afirmar que no se guardó. Los desvíos 5 y 6 (404 común, formulario suelto tras un rechazo) se juzgan aquí.
- **R-7. Regresión compartida.** `common.ts` y `users.ts`, `sanitizeNext` y `notice.html`.
- **R-8. Medida a 375 px desfasada.** La captura previa es anterior a `break-words`.
- **R-9. Lista grande.** 200 topes y muchos bloqueos: peso del HTML, ids duplicados y tiempo de la página.
- **R-10. Salidas reales.** Una pasada con `.env` podría enviar WhatsApp de verdad o tocar la base de desarrollo. Se excluye por diseño (ver "Pruebas en navegador").
- **R-11. Duración.** En el PR 1 el CI casi duplicó lo local, y cada sonda con procesos reales arranca al menos `api` e `inventory-manager`.

### Pruebas funcionales

Contra `api` e `inventory-manager` reales, MySQL de pruebas y webhook firmado, con la salida al proveedor doblada (`salida-bot-doble.ts`).

- **QA2-01.** Pausar con motivo desde la pantalla: el siguiente mensaje firmado se descarta sin esperar 10 s (refresco en 300 s), con `bot_audit` `bot_paused`, autor y motivo. Reanudar: vuelve a atender y `bot_resumed`.
- **QA2-02.** Motivo con 8 dígitos: 422, estado sin cambios, sin motivo pintado.
- **QA2-03.** Alta de 7 días: 303 con `ok=blocked&n=<4>`, lista enmascarada, bot lo ignora, `block_added`.
- **QA2-04.** Alta inválida (422), del personal (422) y repetida (409): nada escrito; error junto al campo con `aria-invalid` y `aria-describedby`.
- **QA2-05.** Quitar un bloqueo manual y uno automático: el bot vuelve a atender y `block_removed`.
- **QA2-06.** Id inexistente: 404 con aviso y lista actual. `:id` no numérico, doble clic y reenvío.
- **QA2-07.** Los 5 contadores coinciden con la `api` tras tráfico real; sin controles para cambiar topes; estado en texto.
- **QA2-08.** `api` sin clave: sin formulario, motivo explicado y POST directo con 409 sin guardar. Con clave anterior: aviso con la cuenta; con 0, sin aviso.
- **QA2-09.** Bot sin configurar: "Desactivado" y se puede pausar. Con proveedor: nombre correcto.
- **QA2-10.** Un cliente real supera un tope por webhook: aparece enmascarado con tope y hora, también en navegador.
- **QA2-11.** Un número del personal supera ráfaga y tope por minuto: no aparece.
- **QA2-12.** Bloquear desde la lista: 303, sale de la lista con todos sus topes, entra en la lista negra y `block_added`.
- **QA2-13.** Reenvío del token usado: 404, aviso y lista actual.
- **QA2-14.** Número ya bloqueado que sigue en la lista: 409 sin duplicar.
- **QA2-15.** Token inexistente o manipulado (`..%2f`, 300 caracteres): 404, sin alcanzar otra ruta de la `api`; `encodeURIComponent` en ambos saltos.

### Pruebas negativas y casos límite

**D-4 y `keptReason`**

- **QA2-20.** Teléfono vacío en cada salida del alta: 422, 409 ya bloqueado, 409 sin clave, 503, 5xx, `network`, `invalid_response`, `timeout`, 400, 413, sesión no comprobable y 422 con relectura fallida. Búsqueda del número en el cuerpo: 0.
- **QA2-21.** Matriz de motivo contra la `api` real y la regla de core, en alta, tope e interruptor: 7 dígitos, 8, 8 con espacios, guiones, puntos, `+` y paréntesis, dígitos en los bordes, separadores no incluidos (`/`, `_`), NBSP y control entre dígitos (R-2), 200 y 201 caracteres, solo espacios, emoji y NFD. Cada fila anota core (acepta o rechaza), `keptReason` (conserva o vacía) y si divergen.
- **QA2-22.** Motivo normal conservado y duración conservada; duración fuera de lista vuelve a `7d`.
- **QA2-23.** Motivo con 8 o más dígitos vaciado también con la `api` caída.

**RF-9, CA-15**

- **QA2-24.** Número conocido en alta correcta y fallida: 0 coincidencias (completo, sin prefijo y con separadores) en stdout y stderr de ambos procesos, HTML, cabeceras `Location`, respuestas de la API, `bot_block` y `bot_audit`, indicando bytes revisados.
- **QA2-25.** Las respuestas y el HTML no tienen `phoneHash` ni `keyId`.
- **QA2-26.** En navegador: ni URL ni historial llevan el número; `n=` solo acepta 4 dígitos.
- **QA2-27.** `?ok=` y `?n=` manipulados (`__proto__`, repetidos, HTML): sin efecto ni reflejo.

**Escapado**

- **QA2-28.** Motivo, nombre del autor y `_csrf` del formulario suelto con `<script>`, comillas y `{{ }}`: siempre escapados.

### Pruebas de acceso

- **QA2-30.** Editor: `GET /bot` 403 sin datos y sin enlace "Bot" en la cabecera; administrador con enlace.
- **QA2-31.** Editor en los 4 POST, con cuerpo válido y sin cuerpo: 403, tablas sin cambios.
- **QA2-32.** Editor con campo desconocido y cuerpo sobre 4 KB (R-4): se registra el status y se compara con `/usuarios`.
- **QA2-33.** Anónimo: `GET` a `/acceso?next=%2Fbot`; `POST` con `expirada=1`. Sesión inválida en la `api`.
- **QA2-34.** CSRF ausente o falso en los 4 POST: 403, tablas sin cambios.
- **QA2-35.** `Origin` ajeno, `Sec-Fetch-Site: cross-site` y lista cerrada de campos (campo de más: 400 sin escribir).

### Pruebas de fallos (RF-12, H-10)

Contra `inventory-manager` real y una `api` falsa de `node:http` que da cada respuesta por petición.

- **QA2-40.** `GET /bot` con conexión rechazada, 503, 500, `NOT_FOUND` e `invalid_response`: 503 con aviso, sin detalles internos.
- **QA2-41.** Los 4 POST con 503, 500, 502, `network` e `invalid_response`: 503, "No pudimos confirmar el cambio", enlace a `/bot`, y ningún texto de "no se guardó".
- **QA2-42.** Los 4 POST con 404 `NOT_FOUND` (`api` anterior): tratados como sin confirmar, no como "no encontrado". 404 con `code` del bot: aviso y lista.
- **QA2-43.** Timeout real de 5 s en el alta: teléfono vacío y aviso de sin confirmar.
- **QA2-44.** 429, 400 y 409 con un `code` inesperado: aviso sin confirmar y sin afirmar el resultado.
- **QA2-45.** `api` caída con la sesión sin comprobar: formulario suelto, `_csrf` recibido y sin cabecera con datos. Al volver la `api`, enviar desde ese formulario funciona.
- **QA2-46.** Desvío 6: 422 con relectura fallida. Se decide si el aviso induce a error sobre un rechazo seguro.
- **QA2-47.** `storeHealthy` falso, con la base de `api` cortada de verdad (`db-cut-proxy`): aviso de última copia conocida.
- **QA2-48.** R-3: 422 en `/topes` con un token que ya no está en la lista.
- **QA2-49.** Desvío 5: `:id` no numérico. Se decide si la página 404 común es aceptable frente a CA-7.

### Pruebas responsive

Viewports 375×812, 768×1024 y 1440×900.

- **QA2-50.** `scrollWidth <= clientWidth` medido, con motivo de 200 caracteres sin espacios, varios topes y bloqueos y el aviso con el nombre largo de la variable (arreglo de `break-words`).
- **QA2-51.** Lo mismo a 375 px sin JavaScript.
- **QA2-52.** Áreas táctiles de al menos 44 px, textos sin cortar y tarjetas legibles. Capturas nuevas.
- **QA2-53.** Avisos de otras pantallas tras `break-words` a 375 px: Usuarios y productos.

### Pruebas de accesibilidad

- **QA2-60.** Un `h1`, `h2` por sección, `nav`, `main`, sin `<table>`; enlace "Bot" con `aria-current` como sus vecinos.
- **QA2-61.** Teclado: todas las acciones solo con Tab, Enter y Espacio, con foco visible y orden visual.
- **QA2-62.** Sin ids duplicados y cada control con etiqueta única por fila.
- **QA2-63.** Avisos con `role="status"` y `role="alert"` y estado no dependiente del color.
- **QA2-64.** Contraste medido en el texto y estados de la pantalla.
- **QA2-65.** JavaScript desactivado en el navegador: pausa, reanudar, alta, baja y bloquear desde la lista.
- **QA2-66.** Con JavaScript: `data-submit-guard` funciona y CSP sin errores en consola.
- **QA2-67.** Doble envío sin JavaScript y botón atrás: 409 o 404, sin duplicar.
- **QA2-68.** Dos administradores a la vez: la última pausa prevalece y un alta doble da 409.

### Pruebas UX/UI

No hay diseño en `_stich_source_/` (P-4 de REQ-F-039): se compara con el patrón de Usuarios en tipografía, tarjetas, botones y avisos. Se evalúa la conformidad, no el gusto.

### Pruebas de performance

- **QA2-70.** Página con 200 topes y 50 bloqueos: peso del HTML y tiempo de respuesta, sin JavaScript nuevo. Solo se reporta como defecto con una medida que afecte al uso.
- **QA2-71.** Requests de la pantalla: sin recursos nuevos ni errores en consola.

### Pruebas de regresión

- **QA2-80.** Usuarios tras mover `readClosedForm`, `adminSession`, `forbidden` y `fieldErrors`: textos, status y orden iguales a la base (`users.test.ts` y comparación de 403, 400 y 422 entre `1c801cf` y el PR).
- **QA2-81.** `sanitizeNext`: `/bot` vale; `/bot/`, `/bot?x`, `//evil`, `/bot/bloqueos`, `https://evil`, `/\evil`, `%2F%2Fevil` y salto de línea vuelven a `/`. Por `POST /acceso` real.
- **QA2-82.** `/usuarios/productos` y `/bot/productos`: las rutas nuevas no pisan `/:business/productos`.
- **QA2-83.** Las rutas de `landing-pages` y `/admin/bot` no cambian: sin archivos tocados y sus pruebas en verde.
- **QA2-84.** `bot-*.html` solo usan clases compiladas por `build:css`.
- **QA2-85.** Las sondas del PR 1 siguen siendo 33 pruebas: títulos de `9f88402` frente a los archivos partidos, y `vitest list` del conjunto, sin casos perdidos.

### Pruebas automatizadas

**Existentes (desde `restaurante/`)**

- **QA2-90.** `npm run typecheck`, `npm run lint` y `npm run build:css`, con salida 0.
- **QA2-91.** `npm test` en los 3 workspaces, sin y con sondas. El único fallo esperado admitido es el `it.fails` de `local-server.test.ts:88`.
- **QA2-92.** `inventory-manager` sin imports de `core` ni `db`, y sin archivos ajenos en el diff.
- **QA2-93.** Duración por archivo con los workers por defecto, en la suite completa: `bot-access`, `bot-actions`, `bot-failures` y cada sonda.

**Sondas nuevas**

Las reglas impiden que `inventory-manager` importe `core` o `db`, y este agente solo escribe en `restaurante/landing-pages/tests/`. Por eso las sondas van allí y son de caja negra: arrancan `api/src/server.ts` e `inventory-manager/src/server.ts` como procesos con `startServer`, sin importar código de otra app (la regla "una app nunca importa otra app" sigue intacta). Se reutilizan `start` (`admin-bot-qa-req-f-043-proceso.ts`), `client` y `loginAs`. Sin `retry`, sin subir tiempos de espera y sin esperas fijas. MySQL real con `setupAdmin` y `makeDatabase`. `inventory-manager/tests/` no se toca.

| Sonda | Archivo (`landing-pages/tests/integration/`) | Pila | Casos |
| --- | --- | --- | --- |
| S-1 | `bot-pantalla-qa-req-f-043-flujo.test.ts` | Real | QA2-01 a QA2-09 |
| S-2 | `bot-pantalla-qa-req-f-043-topes.test.ts` | Real, topes bajos | QA2-10 a QA2-15, QA2-48 |
| S-3 | `bot-pantalla-qa-req-f-043-acceso.test.ts` | Real | QA2-30 a QA2-35, QA2-80 a QA2-82 |
| S-4 | `bot-pantalla-qa-req-f-043-privacidad.test.ts` | Real | QA2-24, QA2-25, QA2-27, QA2-28 |
| S-5 | `bot-pantalla-qa-req-f-043-motivo.test.ts` | Real | QA2-21, QA2-22 |
| S-6 | `bot-pantalla-qa-req-f-043-fallos.test.ts` | `inventory-manager` y `api` falsa | QA2-20, QA2-23, QA2-40 a QA2-42, QA2-44 a QA2-46, QA2-49 |
| S-7 | `bot-pantalla-qa-req-f-043-lentitud.test.ts` | `inventory-manager` y `api` falsa | QA2-43 (5 s reales del `API_TIMEOUT_MS` fijo de `server.ts`) |
| S-8 | `bot-pantalla-qa-req-f-043-base.test.ts` | Real, con `db-cut-proxy` | QA2-47 |

Preparación común en `landing-pages/tests/support/bot-pantalla-qa-req-f-043.ts`, incluida la `api` falsa, solo en `127.0.0.1`. Esta usa `node:http` y `@restaurante/contracts` para los tipos, que no tienen base de datos.

**Duración.** Cada sonda usa una sola pila por archivo (`beforeAll`), con pocas pruebas. El objetivo es menos de 10 s en local con los workers por defecto. Si un archivo pasa de ahí, se parte por `describe` antes de ejecutar la batería definitiva.

**Mutaciones**

Solo en una copia temporal del scratchpad, nunca en el repositorio:

- **M-1.** Ignorar `code` en 404 y 409: afirma 2 fallos.
- **M-2.** Afirmar "no se guardó": afirma 15.
- **M-3.** Conservar un motivo con teléfono: afirma 4.
- **M-4.** Tratar un 404 ajeno como "no encontrado": afirma 3.

Debe fallar al menos una prueba en cada mutación. Una diferencia en el número se anota, pero no es defecto.

### Pruebas en navegador

Pasada con Claude in Chrome en `http://127.0.0.1`, en pestaña nueva, con los casos QA2-10, QA2-12, QA2-26 y QA2-50 a QA2-67.

- **Arranque.** El plan técnico pide `npm run dev`. Se usan los mismos puntos de entrada (`scripts/dev-server.ts` de `api` e `inventory-manager`, con `NODE_ENV=development`), pero con variables explícitas: base `restaurante_test*` desechable, credenciales falsas de `BOT_ENV` y salida doblada con `salida-bot-doble.ts`. Las variables del proceso prevalecen sobre `.env`. No se usa la base de desarrollo ni credenciales reales de WhatsApp, y nunca se envía un mensaje real.
- **Datos.** Usuarios y tráfico del webhook firmado con un script temporal, que se borra al terminar. Topes bajos (`BOT_LIMIT_BURST`).
- **375 px.** `resize_window`, comprobando `innerWidth`. Chrome suele limitar el ancho de ventana: si no llega a 375, se mide con Chrome headless por el protocolo de DevTools con un script en el scratchpad, sin dependencias nuevas, y se deja constancia.
- **Sin JavaScript.** La extensión no puede desactivarlo por pestaña: se usa un perfil o headless con `Emulation.setScriptExecutionDisabled`, y se indica cuál se usó.
- **Extensión sin respuesta tras 2 o 3 intentos.** CA-21 se valida en headless real con evidencia de medidas y capturas. Lo que solo se pueda ver a mano queda como revisión manual; si un CA depende de ello, se devuelve `NEEDS_USER_DECISION`.

No se pulsa nada que abra diálogos. Procesos, pestañas y bases se cierran al terminar.

### Evidencia requerida

- Salida resumida y código de salida de QA2-90 a QA2-93.
- Por sonda: casos, resultado y respuesta, filas o logs en cada fallo.
- Tabla de la matriz QA2-21 y de la matriz de fallos QA2-20, QA2-41 y QA2-42.
- Búsqueda del número con 0 coincidencias y bytes revisados.
- Capturas nuevas a 375 px y escritorio, y `scrollWidth` y `clientWidth` por viewport.
- Tabla de duraciones y resultados de M-1 a M-4.
- `git status` antes y después, sin cambios fuera del ticket y de las sondas.

### Criterios de aprobación

- La parte de pantalla de CA-1 a CA-8, CA-10, CA-12 a CA-15, CA-18 a CA-20 y CA-21 completo en PASS, con evidencia independiente del doble del implementador.
- "Alcanzaron un tope hoy" comprobado contra la `api` real con tráfico firmado.
- `typecheck`, `lint` y `npm test` en verde, con el fallo esperado explicado.
- Ninguna fuga del número (CA-15) y ningún aviso que afirme que no se guardó.
- Sin defectos `BLOCKER` ni `CRITICAL`; los `MAJOR` solo con decisión del usuario.
- Ninguna sonda ni archivo del PR pasa de ~10 s en local.
- Las hipótesis R-2, R-3 y R-4 y los desvíos 5 y 6 quedan decididos con evidencia. Si el requisito no permite decidir, se devuelve `NEEDS_USER_DECISION`.

No se hace despliegue, commit ni push, y no se usan bases de desarrollo ni de producción.

## QA Report (PR 2 de 3)

### Ronda

Ronda 1, PR 2 de 3 (pantalla "Bot"), sobre el working tree sin commit (base `1c801cf`). Aprobación del plan, cita textual: "Si", en respuesta a "¿Apruebas el plan de QA del PR 2 con esos puntos?". NotebookLM no tiene herramientas disponibles en la sesión: no se consultó.

### Pruebas ejecutadas

| Comando o acción | Resultado real |
| --- | --- |
| `npm run build:css`, `typecheck`, `lint` (con sondas) | 0, 0 y 0, sin avisos |
| `npm test`, sin sondas | 0. `api` 40 archivos, 1049; `landing-pages` 139 archivos, 1489 y 1 fallo esperado (1490); `inventory-manager` 11 archivos, 182 |
| `npm test`, con sondas | 0. `api` 1049; `landing-pages` 149 archivos, 1550 y 1 fallo esperado (1551); `inventory-manager` 182 |
| Sondas en `landing-pages/tests/integration/bot-pantalla-qa-req-f-043-*` | 10 archivos, 61 pruebas, 4 repeticiones sin fallos |
| Pila con `scripts/dev-server.ts` de `api` e `inventory-manager` | `restaurante_test*`, `BOT_ENV` falso, sin `.env`. 9 envíos, todos al doble de salida; ninguno salió de la máquina |
| Claude in Chrome a 1280 px | Lista de topes real, bloqueo por teclado, sin errores en consola. No baja de 1280 px (`innerWidth` sigue en 1280 tras pedir 375) |
| Chrome headless por DevTools, sin dependencias | 375, 768 y 1440 px, con y sin JavaScript |

El "1 fallo esperado" sigue siendo el `it.fails` de `local-server.test.ts:88`. La partición de las sondas del PR 1 conserva sus 33 pruebas, en 9 archivos.

**Mutaciones**, en copia temporal, ya borrada. La copia no incluye los iconos de `landing-pages`, de modo que una prueba de favicon falla sin mutar: no se cuenta.

| Mutación | Afirmado | Medido |
| --- | --- | --- |
| M-1, ignorar `code` | 2 | 2 |
| M-2, afirmar "no se guardó" | 15 | 15 |
| M-3, conservar motivo con teléfono | 4 | 4 |
| M-4, 404 ajeno como "no encontrado" | 3 | 2 |

Las 4 se detectan. En M-4 la diferencia puede venir de cómo se escribió la mutación; no es defecto.

**Duración** (máximo de 3 repeticiones con los workers por defecto, incluida la migración de cada trabajador):

| Archivo | Pruebas | Máximo |
| --- | --- | --- |
| `bot-access`, `bot-actions`, `bot-failures` | 12, 26, 25 | 0,4 s, 1,0 s, 1,5 s |
| `-acceso` | 1 | 7,8 s |
| `-fallos` | 52 | 2,9 s |
| `-flujo` | 1 | 7,4 s |
| `-lentitud` | 1 | 9,2 s (5 s son el `API_TIMEOUT_MS` fijo) |
| `-motivo` | 1 | 8,0 s |
| `-navegacion` | 1 | 6,5 s |
| `-privacidad` | 1 | 8,0 s |
| `-sinbot` | 1 | 7,3 s |
| `-topes` | 1 | 7,0 s |
| `-topes-bloqueado` | 1 | 1,5 s |

`-acceso` y `-topes` se partieron antes de aprobar, sin perder casos. **Cambio frente al plan:** S-8 (`-base`) no se queda en el repositorio. Tardaba de 10 a 12,5 s en paralelo, es una sola prueba y no se puede partir, y al doble en el CI superaría los 20 s. Se ejecutó con éxito en cada ronda; copia en `bot-pantalla-qa-req-f-043-base.test.ts.bak`, en el scratchpad. El corte de base ya lo cubre `api-process.test.ts`.

### Criterios de aceptación

| CA | Resultado | Evidencia |
| --- | --- | --- |
| CA-1 | PASS | Editor: 403 sin datos y sin enlace, con cuerpo válido y vacío. Ver R-4 |
| CA-2 | PASS | CSRF ausente o falso en los 4 POST: 403, tablas sin cambios |
| CA-3 | PASS | Pausa desde la pantalla con refresco de 300 s: `bot_paused_dropped`, 0 envíos, `bot_audit` |
| CA-4 | PASS | 422, sin cambiar el estado y sin repintar el motivo |
| CA-5, CA-6 | PASS | Alta real, bot lo ignora; 409, 422 y 422 sin escribir, teléfono vacío, duración y motivo conservados |
| CA-7 | PASS | Baja: vuelve a atender, `block_removed`; repetida, 404 con lista |
| CA-8, CA-10 | PASS | Webhook firmado real: fila, bloqueo, salida de la lista; token usado, inexistente y manipulado 404; ya bloqueado 409 sin duplicar |
| CA-9 (pantalla) | PASS | El personal supera la ráfaga y no aparece, también en navegador |
| CA-12 | PASS | Contadores iguales a la `api`, sin controles de topes |
| CA-13 | PASS | Sin clave: sin formulario, explicado y 409 sin guardar |
| CA-14 | PASS | Con 3 bloqueos, aviso; con 0, sin aviso |
| CA-15 | PASS | 0 coincidencias del número en 183 KB de respuestas, logs de ambos procesos, tablas y API. En la pila de navegador, 0 en 45 KB de logs |
| CA-18 | PASS | 8 fallos en lectura y en los 4 POST: 503 y ningún "no se guardó" |
| CA-19 | PASS | `storeHealthy` falso: aviso. Con la base cortada del todo la sesión da 503 antes de llegar a él (QA2-47) |
| CA-20 | PASS | "Desactivado", y pausa con `bot_paused` |
| CA-21 | PASS | `scrollWidth` igual a `clientWidth` en los 3 viewports, con y sin JavaScript. Sin JavaScript y solo teclado a 375 px: pausar, reanudar, alta, quitar, bloquear desde la lista e inválido |
| CA-22 | PASS | `typecheck`, `lint`, `npm test`; `inventory-manager` sin `core` ni `db` |
| CA-16, CA-17 | Fuera | PR 3 |

### Hipótesis del plan y desvíos

- **R-2, `keptReason` frente a core: confirmada.** Es DEF-004. Bordes y separadores (`-`, `.`, `+`, paréntesis, espacios, NBSP, `/`, `_`, `,`) coinciden; solo diverge un control entre dígitos.
- **R-3, error invisible en topes: descartada.** Con la fila ya fuera de la lista, el error también se ve.
- **R-4, orden frente a CA-1: confirmada y aceptable.** Editor: 400, 413 y 415 con un campo desconocido, un cuerpo grande u otro tipo, antes del rol; `/usuarios` da exactamente lo mismo. Sin datos ni escritura. RF-1 fija ese orden "en la API", y ahí el rol va primero (PR 1).
- **Desvío 5 (404 común con `:id` no numérico): aceptable.** Solo con una URL manipulada, 404 con enlace a `/bot`, sin llamar a la API. CA-7 pide 404.
- **Desvío 6 (formulario suelto tras 422 con relectura caída): aceptable.** Pierde el error del campo, pero no afirma nada, conserva duración y motivo, y el teléfono vuelve vacío. Solo ocurre con la API cayendo entre dos peticiones.
- **D-4 y su desviación aceptada:** teléfono vacío en todas las salidas; motivo con 8 o más dígitos vaciado, también con la API caída; motivo normal conservado.
- **Pasada de `npm run dev`:** se usaron sus puntos de entrada con `NODE_ENV=development`, no el comando con `.env`, tal como se aprobó.

### Defectos encontrados

Ninguno `BLOCKER`, `CRITICAL`, `MAJOR` ni `MINOR`. DEF-001 a DEF-003 siguen abiertos por decisión del usuario.

### DEF-004

- Severidad: TRIVIAL
- Criterio de aceptación afectado: ninguno. Roza RF-9 y la desviación aceptada de D-4
- Descripción: `keptReason` no vacía un motivo con dígitos separados por un carácter de control, que core rechaza antes de mirar los dígitos.
- Pasos para reproducir: `POST /bot/bloqueos` con `telefono=abc` y `motivo=55\u000198\u000176\u00015432`.
- Resultado esperado: motivo vacío, porque podría ser un teléfono.
- Resultado actual: 422, y el motivo vuelve al formulario.
- Evidencia: `-motivo.test.ts`, filas "control entre dígitos", "teléfono partido con control" y "NEL entre dígitos".
- Impacto: exige insertar caracteres de control a mano. Solo lo ve quien lo envió; core lo rechaza, así que no se guarda ni se registra.
- Recomendación: aplicar a `keptReason` la misma normalización de core, o dejarlo. No bloquea este PR.

### Regresión

- `users.ts`: el diff solo mueve funciones a `common.ts`, con el mismo texto y orden; `users.test.ts` no cambia y pasa. Errores 400, 413 y 415 iguales entre Bot y Usuarios.
- `sanitizeNext`: `/bot` vale; `/bot/`, `/bot?x=1`, `//evil.example`, `/bot/bloqueos`, `https://…`, `/\evil`, codificado, con salto de línea y `/BOT` vuelven a `/`.
- Rutas: `/usuarios/productos` y `/bot/productos`, 404; `GET` de rutas POST, 405.
- `notice.html`: sin desplazamiento en Usuarios, productos y cuenta a 375, 768 y 1440 px.
- `landing-pages/src`, `api` y `packages` sin cambios.

### Responsive

A 375, 768 y 1440 px, sin desplazamiento horizontal ni elementos fuera de la pantalla, con y sin JavaScript. Con datos extremos (motivos de 200 caracteres sin espacios, autor de 120, 200 topes, 50 bloqueos y 2 avisos), tampoco. Capturas `bot-375.png`, `bot-375-nojs.png` y `bot-375-extremo.png` en el scratchpad.

### Accesibilidad

Un `h1`, 5 `h2`, un `main`, sin `<table>`, `aria-current="page"` en "Bot", ids sin duplicar, 8 etiquetas únicas y todos los campos etiquetados. Contraste medido en `main`: 0 elementos por debajo de 4,5:1 o 3:1. Foco visible en cada parada, en orden visual. Los campos miden 42 px, como en el resto del admin: observación, sin criterio que lo exija.

### UX/UI

Sin diseño en `_stich_source_/`. Coincide con el patrón de Usuarios en tarjetas, tipografía, botones y avisos.

### Performance

Con 200 topes y 50 bloqueos: 587 KB de HTML y de 10 a 31 ms contra la API falsa. Sin JavaScript nuevo ni errores en consola. Sin defecto.

### SEO

No aplica: pantalla privada de administración.

### Pendientes de revisión manual

**Sin ejecutar o parcial:**

- `npm run dev` literal con `.env`, excluido por el plan.
- `--watch` de los puntos de entrada: no se usó.
- 375 px en Chrome con ventana real: medido en headless.
- Duración en el CI real.
- Dos administradores: alta doble 409 y 303; pausa doble 303 y 303. Qué motivo queda depende del orden de llegada.

Quedan dos bases vacías, `restaurante_test_4d1754_9_2` y `restaurante_test_8abebf_2_x78284_1`, sin tablas y con el mismo nombre antes y después de varias rondas: no se crearon en las sondas y no se tocaron. Sin procesos ni worktrees temporales.

### Resultado final

QA_APPROVED

## QA Action Plan (PR 3 de 3)

Plan del PR 3 de 3 (`/admin/bot` en solo lectura y documentación), sobre el working tree sin commit de `feature/REQ-F-043-control-bot-admin-nuevo-3-solo-lectura` (base `epic/arquitectura`, `0391e86`). Aprobación de la implementación, textual: "si", a "¿Apruebas la implementación del PR 3 para pasarla a QA?", con las 6 desviaciones y el texto "Mientras tanto, puedes bloquear un número…" a la vista del usuario. NotebookLM no tiene herramientas disponibles en la sesión: no se consultó. `Calculadora.xlsx` queda fuera.

Las 7 pruebas de `admin-bot-moved.test.ts` son del implementador: se ejecutan, pero no cuentan como evidencia independiente. Las sondas nuevas solo cubren lo que esas pruebas no prueban, o lo que CA-16 y CA-17 exigen demostrar por separado.

### Objetivo

Comprobar de forma independiente que `/admin/bot` no escribe con `ADMIN_NEW_URL`, que sin ella nada cambia salvo el texto aprobado, que conviven los procesos reales, que la documentación dice la verdad, y cerrar el ticket con CA-1 a CA-22.

### Requisito bajo prueba

RF-10, RF-11 y RF-14; CA-16 y CA-17; la excepción de texto de CA-17; la autorización de `.claude/CLAUDE.md` §8 ("Lo autorizo"); DT-3 solo como procedimiento escrito (su comprobación es en producción); y CA-22 sobre el estado final. CA-1 a CA-15 y CA-18 a CA-21 no se revalidan: el diff no toca `api`, `inventory-manager` ni `packages`, y QA3-40 lo demuestra.

### Criterios de aceptación

| Criterio | Casos |
| --- | --- |
| CA-16 | QA3-01 a QA3-12, QA3-30 a QA3-33, QA3-50 a QA3-56 |
| CA-17 | QA3-13 a QA3-17, QA3-20 a QA3-23 |
| RF-11 | QA3-30 a QA3-33 |
| RF-14 y autorización | QA3-60 a QA3-69 |
| CA-22 | QA3-41, QA3-42 |
| Cierre del ticket | QA3-70 |

### Riesgos identificados

Hipótesis, no hechos, salvo donde se indica:

- **R-1. Lectura con efectos.** `/admin/bot` no llama a un método de escritura, pero `snapshot()` e `init()` corren en el proceso de la landing. Lo observado: el modo `panel` no audita caducidades. Falta demostrarlo con un bloqueo caducado y con un reinicio.
- **R-2. Una rama sin probar del guardián.** `access.post` empieza por `assertSameOrigin`, y corta por tamaño de cuerpo. Las pruebas del implementador no cubren otro origen, cuerpo excesivo ni un CSRF con valor incorrecto (solo ausente).
- **R-3. Valores raros en la ruta.** Un id o token mal formado llega ahora a 410 en lugar de al 404 de antes. Debe dar 410 o un error sin escribir ni filtrar nada.
- **R-4. Parciales.** El renderizador lanza error ante una clave ausente: un estado poco común (409, 422, `switchError`, base caída) podría romper la página al mover plantillas. Las pruebas existentes no comparan el HTML con la base.
- **R-5. CSS.** `underline-offset-4` y `focus-visible:outline-*` son clases nuevas en un parcial: si el CSS generado no las incluye, el foco no se ve.
- **R-6. Copia vieja en solo lectura.** Con el refresco por defecto, la página depende de la copia de `landing-pages`. Lo observado: `snapshot()` la refresca antes si tiene 10 s o más. El peor caso real está justo tras una lectura previa.
- **R-7. Convivencia con refresco de 1 s.** `startStack` fija `BOT_CONTROL_REFRESH_SECONDS=1` por encima del `env`: lo ya probado no demuestra el plazo de 10 s por defecto.
- **R-8. Documentación desfasada.** Quedan comentarios que hablan solo de productos (`deploy/compose.prod.yaml:119`) y frases por revisar (`despliegue.md:413`). En §6, el paso 3 pide volver `inventory-manager` "antes que la `api`", pero la `api` se nombra en el paso 2: el orden hay que seguirlo tal como está escrito.
- **R-9. Alcance de `CLAUDE.md`.** La autorización cubre solo §8.

### Pruebas funcionales

Con `ADMIN_NEW_URL`, MySQL real y datos propios de la sonda (no los de `movedBot`):

- **QA3-01.** `GET`: estado, los 5 contadores, aviso de topes y lista negra, con filas manual y automática, frente a los valores de la base.
- **QA3-02.** El enlace es exactamente `<ADMIN_NEW_URL>/bot`, también con barra final en la variable, sin `//bot`.
- **QA3-03.** Los 4 POST con sesión, permiso, cuerpo y CSRF válidos: 410, sin `Location`, página en solo lectura, aviso con `role="alert"`, y las 4 tablas con filas en cada una, idénticas antes y después, en volcado completo y con la copia en memoria.
- **QA3-04.** Un formulario real, capturado de la página sin `ADMIN_NEW_URL` y reenviado tal cual con la variable: cada uno de los 4 da 410, sin 400 por campos.

Sin `ADMIN_NEW_URL`:

- **QA3-13.** Pausar, reanudar, alta, baja y 303 con `?ok=`: escriben y auditan.
- **QA3-14.** El POST de topes sigue en 410 sin escribir.
- **QA3-15.** Sigue la frase "Mientras tanto…" y no aparece el aviso del modo nuevo.

Ver también los casos de base en "Pruebas de regresión".

### Pruebas negativas y casos límite

- **QA3-05.** Anónimo, editor, CSRF ausente, CSRF con valor incorrecto y token de otra sesión, en cada uno de los 4 POST: 303 o 403, sin `admin_bot_moved` y sin escritura. El editor recibe 403 antes de leer el cuerpo.
- **QA3-06.** Otro origen en cada POST: 403, sin escritura.
- **QA3-07.** Cuerpo por encima de 4 KiB: rechazo, sin escritura y sin 500. Campo desconocido: 400.
- **QA3-08.** Id mal formado, inexistente o de otro formato en `/bloqueos/:id/quitar`, y token mal formado o de longitud rara en `/topes/:token/bloquear`: sin 500, sin escritura. Se registra la respuesta real (se espera 410, tras los controles).
- **QA3-09.** Cuerpo con teléfono válido, motivo con teléfono y `duracion` inválida: 410 sin validar nada ni repetir el dato.
- **QA3-10.** `GET` y los 4 POST con un bloqueo ya caducado en la base: sigue sin `block_expired` en `bot_audit`, sin cambios en las 4 tablas.
- **QA3-11.** `?ok=` y `?n=` con cualquier valor: sin aviso de éxito.
- **QA3-12.** Sin `botControl`: 503 en `GET` y POST, sin 410 ni escritura. Con `storeHealthy` falso, la página de solo lectura sigue pintando el aviso de última copia.
- **QA3-16.** `ADMIN_NEW_URL` vacía: se comporta como sin la variable.
- **QA3-17.** `?ok=` válido sin la variable: sigue mostrando el aviso de éxito.

### Convivencia en procesos reales (RF-11, CA-16 y CA-17)

- **QA3-30.** Pila real (`landing-pages` con `ADMIN_NEW_URL`, `api` e `inventory-manager`). Pausa, reanudar, alta y baja desde `inventory-manager`: `/admin/bot` las refleja sin formularios.
- **QA3-31.** Con esa pila, un POST de `/admin/bot` da 410 sin alterar lo que escribió `inventory-manager`, y `bot_audit` solo crece por la `api`.
- **QA3-32.** Reinicio de `landing-pages` con `ADMIN_NEW_URL`: arranca, sigue en solo lectura y no escribe en las 4 tablas. `landing-pages` conserva clave, personal y topes: arranca con ellos y muestra el uso.
- **QA3-33. Medición con el refresco por defecto (10 s).** Se hace una lectura de `/admin/bot`, la escritura por `inventory-manager` a continuación (peor caso de R-6), y se mide cuándo aparece. 3 repeticiones de pausa y 3 de alta. Pasa si el máximo es ≤ 10 s, con el margen de la petición indicado aparte. Fuera de la suite, por duración.

### Propagación sin `ADMIN_NEW_URL`, comparada con la base (CA-17)

- **QA3-20.** `admin-bot.test.ts`, sin cambios, pasa en los dos árboles.
- **QA3-21. Medición.** Procesos reales con el refresco por defecto. Pausar en `/admin/bot`, y medir cuándo la `api` deja de responder a un mensaje real por el webhook, en la base y en el PR, alternando. 3 repeticiones por árbol, y una de reanudar por árbol. Pasa si el máximo es ≤ 10 s, con el margen de la petición indicado aparte, y sin diferencia atribuible al PR.
- **QA3-22.** Una baja en `/admin/bot` llega al bot en el mismo plazo. 1 repetición por árbol.

**Comparación con la base (G-1).**

- **QA3-23.** `renderBotPage` sobre una matriz fija, con un script en el scratchpad y el mismo reloj, en la base y en el PR. Estados: activo y pausado, con y sin cambio previo; con 0 bloqueos, manual, automático, permanente y pendiente de guardar; bot con y sin proveedor; sin clave; base caída; clave anterior; éxito; problema; errores de alta; `switchError`; topes alcanzados. Se compara la página completa, primero exacta y luego con los espacios normalizados. Pasa si **la única diferencia normalizada es `REACHED_MOVED_MESSAGE`** y toda diferencia exacta es de espacios.

### Pruebas responsive

Viewports 375×812, 768×1024 y 1440×900, con filas en la lista negra y un motivo largo, en `GET` y en la página 410:

- **QA3-50.** Sin desplazamiento horizontal de la página (`scrollWidth` frente a `innerWidth`). La tabla solo se desplaza dentro de su contenedor.
- **QA3-51.** El enlace al admin nuevo se ve y se pulsa con un área suficiente, sin cortes de texto.

Si Chrome no baja a 375 px, se mide con Chrome headless por el protocolo de DevTools, como en el PR 2, y se deja constancia.

### Pruebas de accesibilidad

- **QA3-52.** Un `h1`, jerarquía correcta tras quitar secciones, landmarks, `aria-labelledby` sin referencias rotas, sin `id` huérfanos ni restos de `b-*`, y `caption` y `scope` en la tabla de 6 columnas.
- **QA3-53.** Teclado: orden de tabulación del enlace, sin trampas, y foco visible medido en el estilo calculado, con la clase presente en el CSS generado (R-5).
- **QA3-54.** Aviso del 410: `role="alert"` en el DOM, texto completo sin depender del color, y contraste del enlace y del aviso sobre su fondo.
- **QA3-55.** Escenario real de pestaña antigua en el navegador: página con formularios, se reinicia la app con `ADMIN_NEW_URL` y se envía el formulario abierto. Se ve el aviso, no hay formularios y el enlace funciona por teclado.

### Pruebas UX/UI

- **QA3-56.** No hay diseño en `_stich_source_/` para el admin (P-4 de REQ-F-039): se compara con el aviso de Usuarios en solo lectura en tono, enlace y orden. Sin error en consola ni CSP en `GET` y 410.

### Privacidad

- **QA3-24.** `admin_bot_moved` lleva exactamente `action` y `userId`, más los campos comunes del logger, en los 4 POST. Ni número, ni motivo, ni token, ni ruta.
- **QA3-25.** Con un teléfono de prueba en el cuerpo de cada POST y de cada rechazo (QA3-05 a QA3-09): no aparece en los logs reales, en stdout ni stderr, en sus formas completa y local, ni en el HTML.
- **QA3-26. Token de topes en `request`.** Mismo POST en la base y en el PR: se compara la línea. Se documenta si es un riesgo con estos hechos: origen del token (aleatorio de 16 bytes), si `landing-pages` puede conocer uno válido (modo `panel`, memoria de `api`), su caducidad y su uso único. Se señala aparte, sin ampliar el alcance, la línea equivalente de `api` e `inventory-manager`.

### Pruebas de regresión

- **QA3-40.** `git diff 0391e86 --stat`: nada en `api/`, `inventory-manager/`, `packages/`, `deploy/` ni en el esquema.
- **QA3-41.** `npm run build:css`, `typecheck`, `lint` y `npm test` en los 3 workspaces, sin y con sondas. El único fallo esperado admitido es el `it.fails` de `local-server.test.ts:88`.
- **QA3-42.** `inventory-manager` sigue sin importar `core` ni `db`: regla de `lint`, comprobada con la salida.
- **QA3-43.** Pruebas de QA modificadas: `git diff --word-diff` de `bot-procesos-qa-req-f-042.test.ts` y `bot-protection-qa-req-f-025.test.ts` solo cambia los 4 textos, con el mismo número de `expect`; `admin-users-moved.test.ts`, solo el comentario.
- **QA3-44.** `admin-products-moved.test.ts` y `admin-users-moved.test.ts` pasan. El `/admin` de solo lectura de productos, usuarios y cuenta no cambia: sin archivos tocados en sus controladores y vistas.
- **QA3-45.** Otra pantalla, `/molotes`, `/birria` y `/`: sin cambios en el diff; cubiertas por la suite.

### Documentación (RF-14)

Cada afirmación nueva se contrasta con el código o una prueba, y se anota como verdadera, falsa o no verificable.

- **QA3-60.** `arquitectura.md` §1, §6, §8 y §10: misma instancia de `BotControl` en bot y rutas, sin esperar el refresco; escritor único con la variable; 10 s sin ella; baja sin liberar cupo en ese caso; contenido de los PR; "sin cambios de esquema ni variables nuevas".
- **QA3-61.** `README.md`: las 5 rutas y sus métodos frente a `api/src/admin/router.ts`, respuestas sin número, seudónimo ni id de clave, pantalla, cupo devuelto y solo lectura.
- **QA3-62.** `despliegue.md`: regla del bot, aviso al personal (texto "No se guardó nada" real, mismo usuario y contraseña), §8 y DT-3 (`WHATSAPP_BOT_STAFF_*`, `block_removed`, botón "Quitar").
- **QA3-63.** `despliegue.md` §6: `docker compose config` con `RESTAURANTE_INVENTORY_IMAGE` por digest, archivos falsos de `.env` y `state/release.env` en el scratchpad y el `CE` tal como está escrito, en lugar de `sudo env` y `up`. Comprueba que `inventory-manager` resuelve la imagen, que no tiene variable de base y que `--no-deps` existe. Si el daemon local lo permite, `up --dry-run` sobre ese mismo archivo. El digest se busca en los archivos que el texto nombra, y se comprueba que `deploy.sh` los escribe. El orden `inventory-manager` → app → `api` se lee como lo haría quien lo ejecuta (R-8).
- **QA3-64.** §8: las comprobaciones se leen y se hacen en local con URL local, sin producción.
- **QA3-65.** Nombre de imagen frente al CI y `deploy.sh`.
- **QA3-66.** Enlaces y anclas internas nuevas, incluidas `#6-volver-a-una-versión-anterior-a-mano` y `#10-riesgos`.
- **QA3-67.** Búsqueda de lo desfasado: "ticket 4", "vuelve", "`/admin/bot`" y "Bot" de `/admin` en `docs/`, `README.md`, `.env.example` y comentarios de `deploy/`, con cada resultado revisado (R-8).
- **QA3-68.** `.env.example`: se confirma que "no aplica".
- **QA3-69.** `.claude/CLAUDE.md`: `git diff` solo con las 2 líneas de §8, frente al código. Sin cambios en `.claude/rules/` ni `.claude/agents/`.

### Pruebas de performance

- **QA3-46.** Duración por archivo con los workers por defecto, en la suite completa: `admin-bot-moved.test.ts`, S-1 y S-2, por debajo de ~10 s en local, frente al límite de 20 s del CI.
- **QA3-47.** Peso del CSS generado frente a la base. `GET /admin/bot`: sin peticiones nuevas ni JavaScript añadido.

### Pruebas SEO

No aplica: página privada, sin cambios en su cabecera. QA3-23 lo cubriría si cambiara.

### Pruebas automatizadas

Reutilizan `setupAdmin`, `loginAs`, `TEST_BOT_KEYS`, `startStack`, `start`, `startInventory`, `signIn` y `waitFor`. Sin `retry`, sin subir tiempos de espera y sin esperas fijas. Las sondas son de caja negra respecto a las otras apps.

| Id | Archivo o medio | Casos |
| --- | --- | --- |
| S-1 | `landing-pages/tests/integration/admin-bot-qa-req-f-043-solo-lectura.test.ts` (un proceso, MySQL real) | QA3-01 a QA3-12, QA3-16, QA3-17, QA3-24 y QA3-25 |
| S-2 | `landing-pages/tests/integration/admin-bot-qa-req-f-043-solo-lectura-procesos.test.ts` (3 procesos reales, `BOT_CONTROL_REFRESH_SECONDS=1`) | QA3-13, QA3-14, QA3-30 a QA3-32 |
| M-1 | Prueba temporal, fuera del repositorio al acabar (refresco por defecto) | QA3-21, QA3-22 y QA3-33 |
| G-1 | Script en el scratchpad, sobre un `git worktree` de `0391e86` con su `npm ci` | QA3-23 y la línea de QA3-26 |
| H-1 | Script en el scratchpad para Chrome headless, si hace falta | QA3-50 a QA3-55 |

- **Soporte.** Para M-1, `startStack` necesita una opción, con `'1'` por defecto, para no forzar el refresco (R-7): cambio de una línea en `tests/support/bot-procesos-qa-req-f-042.ts`, sin efecto en las pruebas actuales.
- **Sin duplicar.** S-1 no repite los 410 felices salvo QA3-03, la evidencia independiente de CA-16 que pide la validación.
- **Sensibilidad.** Dos mutaciones en una copia temporal del árbol, nunca en el de trabajo: que `moved` no pase por `access.post`, y que deje escribir el alta. S-1 debe fallar en ambas.

### Pruebas en navegador

Claude in Chrome, en pestaña nueva y cerrada al terminar, con `localhost`, base de pruebas y un usuario de prueba creado por el soporte de esta ronda, sin valores de producción. Si la extensión no responde tras 2 o 3 intentos, o no baja a 375 px, Chrome headless con H-1. No se abre el enlace al admin nuevo hacia ningún dominio real: se valida el `href`. Sin `sudo`, sin VPS y sin producción.

### Evidencia requerida

- Salida de cada comando y de cada sonda, con volcado de tablas en cada fallo.
- Tabla de QA3-21 y QA3-33 con cada tiempo.
- Diff completo de G-1.
- Líneas de log de QA3-24 a QA3-26, enmascaradas.
- Medidas y capturas de navegador.
- Tabla de QA3-60 a QA3-69, afirmación por afirmación.
- `git status` antes y después, sin cambios fuera del ticket, de las sondas y del soporte. Sin procesos ni worktrees temporales.

### Cierre del ticket (QA3-70)

El QA Report tendrá la tabla final de CA-1 a CA-22 con PR, evidencia (sonda o ronda) y estado. Además, esta lista de lo que queda para producción:

- despliegue real de la épica y comprobaciones nuevas de `despliegue.md` §8;
- DT-3, comparación de la lista negra con los 4 últimos dígitos del personal;
- aviso al personal, que da el usuario;
- `revert` y `sudo env … up` de §6, sin ejecutar;
- duración real en CI;
- decisión sobre DEF-001 a DEF-004, todos `TRIVIAL` y abiertos.

### Criterios de aprobación

- CA-16 y CA-17 en PASS con evidencia independiente; RF-11 y RF-14 revisados.
- En G-1, la única diferencia normalizada es `REACHED_MOVED_MESSAGE`.
- Las mediciones dentro de 10 s, con el margen indicado aparte, y sin diferencia atribuible al PR.
- `typecheck`, `lint` y `npm test` en 0 en los 3 workspaces.
- Sin defectos `BLOCKER` ni `CRITICAL`; `MAJOR` solo con decisión del usuario.
- Ninguna afirmación nueva de la documentación es falsa.
- Sin regresión, y ninguna sonda por encima de ~10 s en local.

## QA Report (PR 3 de 3)

### Ronda

1 del PR 3, sobre el working tree sin commit de `feature/REQ-F-043-control-bot-admin-nuevo-3-solo-lectura` (base `0391e86`). Plan aprobado por el usuario (cita textual: "Si", en respuesta a "¿Apruebas el plan de QA del PR 3 con esos 4 puntos?"). NotebookLM no tiene herramientas disponibles en la sesión: no se consultó.

### Pruebas ejecutadas

| Comando o acción | Resultado |
| --- | --- |
| `npm run build:css`, `typecheck`, `lint` (sin sondas) | 0, 0 y 0 |
| `npm test`, sin sondas | 0. `api` 40 archivos, 1049; `landing-pages` 151 archivos, 1557 y 1 fallo esperado (1558); `inventory-manager` 11 archivos, 182 |
| `typecheck` y `lint` finales, con sondas | 0 y 0, sin avisos |
| `npm test`, con sondas | 0. `api` 1049; `landing-pages` 155 archivos, 1570 y 1 fallo esperado (1571), 101 s; `inventory-manager` 182 |
| S-1 (3 archivos, 11 pruebas) | PASS. 3 repeticiones antes de partirla; en la suite final, PASS |
| S-2 (2 pruebas, procesos reales) | PASS, 3 pasadas |
| G-1, `renderBotPage`, 22 estados, base frente a PR | La única diferencia, sin contar espacios, es `REACHED_MOVED_MESSAGE` en los 22 |
| M-1, refresco real de 10 s | Ver "Mediciones" |
| Mutaciones (árbol temporal) | 3 de 3 detectadas |
| H-1, Chrome headless real | PASS, ver "Responsive" |
| `admin-bot.test.ts` en base y en PR | 8 de 8 en ambos, archivo sin cambios |
| `admin-products-moved`, `admin-users-moved`, `admin-bot` | 27 de 27 |
| `docker compose config` y `--dry-run up` de §6, con archivos falsos | Ver "Documentación" |
| `git diff 0391e86 --stat` en `api`, `inventory-manager`, `packages` y `deploy` | Vacío |

### Criterios de aceptación

Cierre del ticket. "PR" es donde se validó cada parte. Los CA de PR 1 y PR 2 no se revalidan: este PR no toca su código (QA3-40), y la suite completa pasa.

| CA | PR | Resultado | Evidencia |
| --- | --- | --- | --- |
| CA-1 | 1 y 2 | PASS | Más de 70 combinaciones de editor con 403; en pantalla, sin datos ni enlace |
| CA-2 | 1 y 2 | PASS | CSRF ausente, inválido o de otra sesión, 403, tablas iguales |
| CA-3 | 1 y 2 | PASS | `server.ts` real, refresco de 300 s, `bot_paused_dropped` y 0 envíos |
| CA-4 | 1 y 2 | PASS | 8 dígitos y 201 caracteres, 422 sin cambio |
| CA-5 | 1 y 2 | PASS | Alta real, `bot_blocked_message` y 0 salidas |
| CA-6 | 1 y 2 | PASS | 422, 422 y 409 sin escribir; teléfono vacío al volver |
| CA-7 | 1 y 2 | PASS | Baja de manual, tope y enfriamiento: vuelve a atender, `block_removed` |
| CA-8 | 1 y 2 | PASS | Webhook firmado, lista enmascarada, bloqueo directo |
| CA-9 | 1 y 2 | PASS | El personal no entra en la lista; también en navegador |
| CA-10 | 1 y 2 | PASS | Token usado, inexistente, manipulado y de ayer, 404; ya bloqueado, 409 |
| CA-11 | 1 | PASS | SIGTERM y arranque real: lista vacía; lo demás sigue |
| CA-12 | 1 y 2 | PASS | 5 contadores iguales a `bot_usage`, sin controles |
| CA-13 | 1 y 2 | PASS | Sin clave: sin formulario y 409 sin guardar |
| CA-14 | 1 y 2 | PASS | Con 3 bloqueos, aviso; con 0, sin aviso |
| CA-15 | 1 y 2 | PASS | 0 coincidencias en 183 KB de respuestas, logs, tablas y API |
| CA-16 | 3 | **PASS** | S-1 y S-2: `<main>` sin controles (punto 3 del plan), enlace exacto, 4 POST en 410, 4 tablas y memoria idénticas; editor, anónimo, CSRF, otro origen, tamaño y token de topes rechazados sin escribir; navegador real |
| CA-17 | 3 | **PASS** | G-1, con solo la excepción aprobada; `admin-bot.test.ts` igual; S-2 escribe y audita; máximo medido 9,983 s frente a 9,971 s de la base |
| CA-18 | 2 | PASS | 8 fallos en lectura y en los 4 POST: 503, sin "no se guardó" |
| CA-19 | 1 y 2 | PASS | `storeHealthy` falso: aviso de última copia |
| CA-20 | 1 y 2 | PASS | "Desactivado", y pausa con `bot_paused` |
| CA-21 | 2 | PASS | Sin desplazamiento en 3 viewports, sin JavaScript y con teclado |
| CA-22 | 1, 2 y 3 | PASS | `typecheck`, `lint` y `npm test` en 0; `inventory-manager` sin `core` ni `db`, impuesto por `lint` |

RF-11: PASS (S-2 y M-1). **RF-14: FAIL parcial**, por DEF-005 y DEF-006.

### Mediciones (refresco por defecto, 10 s)

Criterio aprobado: máximo medido ≤ 10 s, petición aparte, sin diferencia atribuible al PR.

| Medida | Base | PR |
| --- | --- | --- |
| Llega a la copia del bot, peor fase, 7 cambios, sondeo de 40 ms | 9,845 a 9,971 s | 9,871 a 9,983 s |
| Petición del cambio, aparte | 27 a 47 ms | 24 a 42 ms |
| Sin tráfico: un mensaje a los 10,0 s tras el cambio, 6 casos | 6 de 6 correctos | 6 de 6 correctos |
| Con tráfico: primer mensaje con el efecto nuevo, 3 pausas y 3 reanudar, un mensaje cada 250 ms | El cambio cae antes de 10,121 s | El cambio cae antes de 10,108 s |
| Baja, primera respuesta al número, envío y sondeo cada 250 ms o más | 10,298 s | 10,278 s |

- **Por qué hay dos filas por encima de 10 s:** son cotas superiores de un sondeo de 250 ms, no el plazo. En el peor caso, el último mensaje con el estado anterior fue a los 9,856 s (PR) y 9,869 s (base). La fila de 40 ms mide el mismo paso con precisión.
- **El caso sin tráfico** importa porque un mensaje dispara además un refresco perezoso, que oculta el temporizador. Con silencio, a los 10,0 s ya estaba aplicado.
- **Convivencia, `/admin/bot` en solo lectura (QA3-33), 8 cambios escritos por `inventory-manager`:** primera lectura que lo muestra, de 8,575 a 9,996 s tras la respuesta del cambio; escritura aparte, de 26 a 41 ms; lectura aparte, de 9 a 17 ms. Una pasada anterior medía el final de la lectura y dio un máximo de 10,013 s, incluida esa lectura: se repitió para separarla, como pide el criterio.

### Veredicto de los hallazgos del análisis

1. **Refresco de 1 s en `startStack`: confirmado.** Se añadió la opción aprobada (una línea, con `'1'` por defecto) y M-1 midió con 10 s reales.
2. **Otro origen, cuerpo excesivo y CSRF incorrecto: sin cubrir, y correctos.** S-1 los cubre: 403, 413 y 403, sin escribir.
3. **Orden en §6: confirmado.** Es DEF-005.
4. **Comentario de `compose.prod.yaml:119`: confirmado, desfasado.** Es DEF-007.

R-1 a R-9 del plan: R-1, sin efectos de escritura (bloqueo caducado sin `block_expired`, reinicio sin cambios). R-3, 12 ids y tokens raros dan 410. R-4, G-1 limpio. R-5, clases presentes en el CSS y foco medido. R-6, dentro del plazo. R-9, solo 2 líneas de §8.

### Defectos encontrados

Ninguno `BLOCKER`, `CRITICAL` ni `MAJOR`. Código sin defectos. DEF-001 a DEF-004 siguen abiertos por decisión del usuario.

### DEF-005

- Severidad: MINOR
- Criterio de aceptación afectado: RF-14 (`restaurante/docs/despliegue.md` §6). Ningún CA funcional.
- Descripción: el procedimiento de vuelta atrás a mano se contradice en el orden. El paso 2 ordena volver la app y luego la `api`; el paso 3, ya después, pide volver `inventory-manager` "**antes** que la `api`".
- Pasos para reproducir: leer §6 en orden, como en un incidente. Al llegar al paso 3, la `api` ya se ha vuelto. El orden seguro de la revisión técnica es `inventory-manager` → app → `api`.
- Resultado esperado: el orden de los pasos numerados coincide con el orden seguro.
- Resultado actual: quien sigue la numeración hace app → `api` → `inventory-manager`, e incumple sin querer la instrucción.
- Evidencia: `despliegue.md`, pasos 2 y 3 de §6. Los comandos en sí son correctos: ver "Documentación".
- Impacto: no llega a `MAJOR`. Mientras tanto, solo la pantalla "Bot" da 503 con aviso (H-10, comprobado en el PR 2), sin pérdida de datos, y el estado final es correcto. No es `TRIVIAL` porque es un procedimiento de incidente y hace dudar cuando más importa.
- Recomendación: que los pasos numerados sigan el orden seguro.

### DEF-006

- Severidad: MINOR
- Criterio de aceptación afectado: RF-14 (`restaurante/docs/despliegue.md`, "Aviso al personal").
- Descripción: dice que quien tenga abierto un formulario antiguo de `/admin/bot` recibirá "No se guardó nada" y el enlace. Tras el despliegue no es así: las sesiones de `/admin` están en memoria y el reinicio las cierra (`createSessionStore`; `README.md`, línea 1548).
- Pasos para reproducir: abrir `/admin/bot` sin `ADMIN_NEW_URL`, reiniciar la app con la variable en el mismo puerto y pulsar "Pausar bot" en esa pestaña (H-1).
- Resultado esperado: lo que dice el aviso.
- Resultado actual: redirige a `/admin/login?next=%2Fadmin%2Fbot&expirada=1` con "Tu sesión caducó. Vuelve a entrar. No se guardó ningún cambio."; al entrar se llega a la página de solo lectura. Control sin cambios.
- Evidencia: H-1, `pestanaAntiguaFinal`.
- Impacto: reducido, y el resultado es seguro: nada se guarda y se avisa. Pero la frase es falsa, está en el aviso que se da al personal, y el plan aprobado no admite afirmaciones falsas. El 410 con `role="alert"` sigue siendo correcto para una sesión viva (S-1 y navegador).
- Recomendación: que el aviso describa lo que verá el personal tras el despliegue.

### DEF-007

- Severidad: TRIVIAL
- Criterio de aceptación afectado: RF-14 ("`.env.example` si aplica").
- Descripción: tres textos quedan incompletos. `landing-pages/.env.example` lista lo que pasa a solo lectura con `ADMIN_NEW_URL` y omite el bot, así que sí aplicaba. `deploy/compose.prod.yaml:119` y el comentario de `src/config/env.ts:56` solo hablan de productos (ya desde REQ-F-040). `despliegue.md` §8 pide comparar "cada `WHATSAPP_BOT_STAFF_*`", y ese patrón incluye también `_TEMPLATE` y `_TEMPLATE_LANGUAGE`, que no son números.
- Pasos para reproducir: leer esas líneas.
- Resultado esperado: textos completos y precisos.
- Resultado actual: los descritos.
- Evidencia: las líneas citadas.
- Impacto: muy bajo; ningún procedimiento falla.
- Recomendación: completar esos textos.

### Documentación (RF-14)

| Afirmación o procedimiento | Resultado |
| --- | --- |
| `arquitectura.md`: misma instancia de `BotControl` en bot y rutas (`api/src/server.ts`) | Verdadera |
| Escritor único con la variable; 10 s sin ella; baja sin liberar el cupo en ese caso | Verdaderas (S-1, M-1 y QA-64) |
| `takeReleased` y `guard.release`, contenido de #130 y #131, sin esquema ni variables | Verdaderas |
| §10, "sin pausa web" y consultas disponibles | Verdaderas |
| `README.md`: 5 rutas y métodos frente a `api/src/admin/router.ts` | Verdaderas |
| Pantalla, cupo devuelto, solo lectura, respuestas sin número, seudónimo ni clave | Verdaderas |
| `despliegue.md`: qué se despliega, regla del bot, mismo usuario y contraseña | Verdaderas |
| "Recibirá No se guardó nada" | **Falsa: DEF-006** |
| §6, orden de los pasos | **Contradictorio: DEF-005** |
| §6, comando: el digest de `sudo env` gana a `state/release.env`, sin variable se usa el del archivo | Verdadero (`config`, en bash, con el `CE` tal cual) |
| §6, `inventory-manager` sin variables de base y sin `depends_on` | Verdadero: 5 variables, ninguna de base |
| §6, `up -d --no-deps inventory-manager` | Válido: `--dry-run` llega a la descarga de la imagen y falla por el digest falso, como se esperaba |
| §6, digests: `releases.log` tiene `inventory=` y `deploy.sh` escribe `release.env.previous` | Verdadero |
| §6, sin `docker pull` previo, a diferencia de la `api` | Correcto hoy: ni `deploy/` ni `ops/` borran imágenes, y la anterior sigue en el host. Tras reconstruir el VPS fallaría, con un error visible, como el paso 2 ya existente. No se abre defecto |
| §6, volver solo la app recupera la escritura | Verdadero (base sin modo de solo lectura, y M-1) |
| §8 y DT-3: `block_removed`, botón "Quitar", URLs | Verdaderas; sin ejecutar en producción |
| Anclas nuevas | Existen |
| `.env.example` "no aplica" | **Incorrecto: DEF-007** |
| `.claude/CLAUDE.md` | Un solo bloque, 2 líneas de §8, ciertas. Sin cambios en `rules/` ni `agents/` |

`$CE` sin comillas solo se separa en bash: en zsh falla. Es el patrón ya existente; el VPS usa bash.

### Regresión

- `word-diff` de las 3 pruebas modificadas: solo los 4 textos y el comentario, con los mismos `expect` (37, 17 y 24).
- Productos y usuarios en solo lectura, 27 de 27 con `admin-bot`, sin archivos tocados.
- Único fallo esperado: el `it.fails` conocido.

### Responsive

Chrome headless real por el protocolo de DevTools, 2 bloqueos, uno con motivo largo, en `GET` y en 410.

| Viewport | `scrollWidth` frente a `innerWidth` | Tablas | Enlace |
| --- | --- | --- | --- |
| 375×812 | 375 = 375 | La de bloqueos se desplaza dentro, 341 frente a 842 | 282×18 px, sin cortes |
| 768×1024 | 768 = 768 | Igual, 718 frente a 842 | 282×18 px |
| 1440×900 | 1440 = 1440 | Sin desplazamiento | 282×18 px |

El enlace mide 18 px de alto: es un enlace dentro de un texto, exento del mínimo de 24 px, y no se abre defecto.

### Accesibilidad

- Un `h1` y 4 `h2`, en orden; `header`, `nav` y `main`; 0 referencias ARIA rotas; 0 `id` duplicados; 0 `b-*` restos; captions y 17 `th` con `scope`.
- Teclado a 375 px: el enlace se alcanza en 9 tabulaciones, sin trampas, con `:focus-visible` y contorno de 3 px sólido azul.
- 410: `role="alert"` con el texto completo; el aviso no depende del color. Contraste: enlace 14,47; alerta 9,16.

### UX/UI

Sin diseño en `_stich_source_/` para el admin. Mismos avisos y tono que Usuarios en solo lectura. Captura a 375 px revisada: enlace visible y alerta debajo. Consola sin errores ni CSP; los 2 mensajes son el 410 esperado.

### Privacidad

- `admin_bot_moved`: exactamente `action`, `level`, `msg` y `userId`, sin número, motivo, token ni ruta.
- Logs reales de `landing-pages`, stdout y stderr: 0 coincidencias del número en sus 3 formas.
- **Token de topes en `request`:** línea igual en base y PR (mismos campos, ruta y 410). **No es un riesgo.** El token son 16 bytes aleatorios, sin relación con el número. Solo existe en la memoria de `api`, y `landing-pages` (modo `panel`) no puede conocer uno válido ni tiene formulario que lo envíe. Fuera del alcance: las líneas `request` de `api` e `inventory-manager` sí llevan tokens reales. Son de un solo uso, del día y exigen sesión de administrador, y es igual desde el PR 1.

### Performance

- `GET /admin/bot`: 2 peticiones, documento y CSS, sin JavaScript.
- `build:css` no cambió el CSS del admin: las clases ya existían.
- Duración con los workers por defecto, suite completa: `solo-lectura` 7,1 s; `-procesos` 7,1 s; `-rechazos` 4,1 s; `-estados` 2,9 s; `admin-bot-moved` 6,9 s. S-1 sin partir llegó a 18,4 s en la suite (6,5 s sola), así que se partió en 3 archivos, sin cambiar sus casos.

### Mutaciones

En un árbol temporal, sobre S-1 antes de partirla. El árbol de trabajo no se tocó.

| Mutación | Pruebas que fallan |
| --- | --- |
| `moved` no pasa por `access.post` (sin cuerpo ni CSRF) | 2: QA3-05, QA3-06 |
| El 410 deja escribir el alta | 4: QA3-03, QA3-04, QA3-09, QA3-10 |
| `moved` sin permiso | 1: QA3-05 |

### Pendientes de revisión manual

- Ninguno bloquea un criterio.
- **Desviación:** la pasada de navegador se hizo solo con Chrome headless real. La extensión no se usó, porque habría que escribir una contraseña en un navegador por orden de un agente; headless además fija 375 px exactos.
- **Desviación:** M-1, G-1 y H-1 no quedan en el repositorio (punto 2 del plan). El QA3-55 de "pestaña antigua" dio DEF-006, y el 410 en navegador se forzó con un formulario antiguo en una sesión viva.

### Comprobaciones para producción

- Desplegar la épica y hacer las comprobaciones 4 y 5 de `despliegue.md` §8.
- DT-3: comparar la lista negra con los 4 últimos dígitos del personal.
- Dar el aviso al personal (tarea del usuario), ya corregido por DEF-006.
- CI del PR 3 (duraciones reales).
- Decidir DEF-001 a DEF-004.

### Sin ejecutar

`revert`, `sudo env … up` real, §8 en producción, nada contra el VPS, Meta ni WhatsApp real. `compose up` solo en `--dry-run`. Las bases `restaurante_test_4d1754_9_2` y `restaurante_test_8abebf_2_x78284_1` no se tocaron.

### Limpieza

Sin procesos de servidor, Chrome ni Vitest. Solo el árbol principal en `git worktree list`. Bases de pruebas iguales que al empezar. Fuera del PR, solo se añadieron las sondas, `tests/support/admin-bot-qa-req-f-043-solo-lectura.ts` y una línea en `tests/support/bot-procesos-qa-req-f-042.ts`.

### Resultado final

QA_REJECTED

Motivo: el plan aprobado exige que ninguna afirmación nueva de la documentación sea falsa, y DEF-005 y DEF-006 lo incumplen. Solo hay que corregir documentación (DEF-007, opcional en la misma pasada). Revalidación: solo esos textos; no hace falta repetir la suite, las sondas ni las mediciones si no cambia código.

### Ronda 2 (PR 3): DEF-005 a DEF-007

Correcciones aprobadas por el usuario (cita textual: "si apruebo las correciones"). Revalidación selectiva: solo cambiaron textos y comentarios.

| Comprobación | Resultado |
| --- | --- |
| DEF-005, §6 | Corregido. Se sigue de arriba abajo: `inventory-manager` (paso 3), app (4), `api` (5). Los 3 comandos y `CE` no cambian frente a la ronda 1 |
| `docker compose config`, archivos falsos, sin `sudo` | `config` completo idéntico byte a byte entre `HEAD` y el árbol (371 líneas). Con `sudo env` sustituido por `env`, `inventory-manager` y app toman el digest indicado; `DATABASE_ALLOW_NEWER_SCHEMA=true` llega a la app |
| DEF-006, aviso al personal | Corregido. Reproducido: 303 a `/admin/login?next=%2Fadmin%2Fbot&expirada=1`, "Tu sesión caducó. Vuelve a entrar. No se guardó ningún cambio", tras entrar 303 a `/admin/bot`, 200, 0 formularios en `<main>`, con el enlace |
| DEF-007 | Corregido. `.env.example`, `compose.prod.yaml:119` y `env.ts:56` incluyen el bot |
| Solo comentarios | 0 líneas cambiadas que no sean comentario en `env.ts`, `compose.prod.yaml` y `.env.example` |
| §8, variables | `WHATSAPP_BOT_STAFF_MOLOTES` y `_BIRRIA` son las de `STAFF_RULES`, con patrón de teléfono |
| Código 4 y `DEPLOY_FILES` | Cierto: `deploy.sh:35` incluye `compose.prod.yaml`, `:95` compara la suma y da `fail 4`. `compose.prod.yaml` y `deploy.sh` difieren entre `origin/main` y `origin/epic/arquitectura`, así que la épica ya lo exigía. `despliegue.md` documenta el paso |
| `typecheck`, `lint` | 0 y 0 |
| Pruebas afectadas (las 11 que usan `ADMIN_NEW_URL`, `adminNewUrl` o `loadConfig`) | 11 archivos, 154 pruebas pasan, 15 s |

**RF-14: PASS.** CA-1 a CA-22 no cambian. La línea de "Bases" de la ronda 1 queda sustituida por lo siguiente.

**Sin repetir, y por qué:** la suite completa, S-1 y S-2, G-1, M-1, las mutaciones y el navegador. No cambió ningún código ejecutable: `env.ts` solo en un comentario, y `config` idéntico.

**Bases de pruebas:** `restaurante_test_4d1754_9_2` y `restaurante_test_8abebf_2_x78284_1` ya no existen. Estaban al acabar la ronda 1. Ningún comando de QA hizo `DROP`, y el barrido de `tests/setup/database-global.ts` no las alcanza (solo mira bases con `_prisma_migrations`, y estas estaban vacías, y las de su ejecución). **Corrección:** las borró la sesión principal por orden del usuario (cita textual: "borra las bases de datos vacias"), tras confirmar 0 tablas en cada una. Ahora hay 0 bases `restaurante_test*`.

**Limpieza:** sin servidores ni Vitest, solo el árbol principal, sin `zz-*`, y archivos temporales propios borrados.

### Resultado final (ronda 2)

QA_APPROVED

Con DEF-001 a DEF-004 (`TRIVIAL`) abiertos por decisión del usuario.

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

Tras la partición, el CI del commit `7a9d565` queda en verde (ejecución 41999823830): `calidad`, `docker`, `auditoria`, `pruebas (1/2)`, `pruebas (2/2)` y `verificacion`. Duraciones en el CI: `-acceso` 8,2 s, `-validacion` 7,8 s, `-estado` 7,7 s, `-proceso` 8,8 s, `-proceso-reinicio` 8,0 s y `-convivencia` 9,3 s. El archivo más largo de toda la suite tarda 17,0 s. Estado: `READY_FOR_MERGE`.

### Implementación del PR 2

Pantalla "Bot" en `inventory-manager`, rama `feature/REQ-F-043-control-bot-admin-nuevo-2-pantalla`, sin commit (2026-11-05). `typecheck`, `lint` y `npm test` en verde; pasada en Chrome headless a 375 y 1280 px y sin JavaScript, también contra la `api` real. Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

### QA (Q1, PR 2)

QA Action Plan del PR 2 de 3 escrito sobre el working tree sin commit (2026-11-05): casos QA2-01 a QA2-93, sondas S-1 a S-8 en `landing-pages/tests/` y mutaciones M-1 a M-4. Sin pruebas ejecutadas. Estado: `NEEDS_QA_PLAN_APPROVAL`.

### QA (Q2, PR 2, ronda 1)

QA del PR 2 de 3 ejecutado (2026-11-05): 10 archivos de sonda con 61 pruebas, mutaciones detectadas y pasada en navegador. Un defecto TRIVIAL nuevo (DEF-004). S-8 no se queda en el repositorio por duración. Estado: `QA_APPROVED`.

### Pull Request del PR 2

PR #131 hacia `epic/arquitectura`, commit `e0364fb` (2026-11-05). Incluye 10 archivos de sondas de QA y su soporte; la sonda S-8 (`-base`) queda fuera. DEF-001 a DEF-004 siguen abiertos.

CI del commit `e0364fb` en verde (ejecución 42034148815): `calidad`, `docker`, `auditoria`, `pruebas (1/2)`, `pruebas (2/2)` y `verificacion`. Duraciones en el CI, sin la preparación de cada archivo: `-lentitud` 5,9 s, `-flujo` 5,2 s, `-privacidad` 5,0 s, `-sinbot` 4,9 s, `-motivo` 4,9 s, `-topes` 4,5 s, `-acceso` 4,4 s, `-navegacion` 4,2 s, `-topes-bloqueado` 3,5 s, `-fallos` 1,4 s; `bot-failures` 3,4 s, `bot-actions` 2,8 s y `bot-access` 1,6 s. Ninguno pasa de 20 s, y no hizo falta partir ninguno. Estado: `READY_FOR_MERGE`.

En el CI del commit de registro `ab84107` (ejecución 42036380511, en verde), el archivo existente `inventory-manager-qa-req-f-039-csrf` llegó a 20,1 s, por encima del límite; en la ejecución anterior fue 19,7 s. No es de este ticket, pero `.claude/rules/testing.md` lo exige: se parte por sus `describe`, sin cambiar los casos, y F-10 y S-10 pasan a `inventory-manager-qa-req-f-039-request-id.test.ts`. Sin cambios en código de producción.

CI final del PR 2 sobre `8db0607` en verde (ejecución 42038289361, `success`). La sonda S-8 quedó fuera del repositorio por duración.

### Implementación del PR 3

`/admin/bot` en solo lectura, documentación y `.claude/CLAUDE.md` §8, rama `feature/REQ-F-043-control-bot-admin-nuevo-3-solo-lectura`, sin commit (2026-11-05). `typecheck`, `lint` y `npm test` en verde. Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

### QA Action Plan del PR 3

Implementación del PR 3 aprobada por el usuario (cita textual: "si", en respuesta a "¿Apruebas la implementación del PR 3 para pasarla a QA?"). `senior-qa` escribe el plan del PR 3 (2026-11-05), sin ejecutarlo: sondas S-1 y S-2, mediciones M-1 con el refresco por defecto y comparación G-1 con la base. Estado: `NEEDS_QA_PLAN_APPROVAL`.

### QA del PR 3, ronda 1

Plan aprobado por el usuario (cita textual: "Si", en respuesta a "¿Apruebas el plan de QA del PR 3 con esos 4 puntos?"). QA ejecutado (2026-11-05): CA-16, CA-17, RF-11 y CA-22 en PASS; el código sin defectos. RF-14 falla en parte: DEF-005 y DEF-006 (`MINOR`) y DEF-007 (`TRIVIAL`), todos de documentación. Estado: `QA_REJECTED`.

### Correcciones del PR 3 tras QA

DEF-005, DEF-006 y DEF-007 corregidos, solo textos y comentarios (2026-11-05). Incluye un comentario en `deploy/compose.prod.yaml`, que altera la suma de `deploy/` (reinstalación ya necesaria para la épica). `typecheck`, `lint` y `npm test` en verde. Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

### QA del PR 3, ronda 2

Correcciones de DEF-005 a DEF-007 aprobadas por el usuario (cita textual: "si apruebo las correciones"). Revalidación selectiva de textos (2026-11-05): los 3 corregidos, RF-14 en PASS, `typecheck` y `lint` en 0, y 154 pruebas afectadas en verde. Estado: `QA_APPROVED`.

### Pull Request del PR 3

PR #132 hacia `epic/arquitectura`, commit `dd2b2e1` (2026-11-05). Incluye `admin-bot-moved`, las sondas S-1 (en 3 archivos) y S-2 con su soporte, y la sección "Limpieza al terminar" de `.claude/rules/testing.md`, pedida por el usuario. DEF-001 a DEF-004 siguen abiertos. Las bases vacías `restaurante_test_4d1754_9_2` y `restaurante_test_8abebf_2_x78284_1` las borró la sesión principal por orden del usuario.

CI del commit `dd2b2e1` en verde (ejecución 42064630316): `calidad`, `docker`, `auditoria`, `pruebas (1/2)`, `pruebas (2/2)` y `verificacion`. Duraciones en el CI: `-solo-lectura-procesos` 12,3 s, `admin-bot-moved` 6,6 s, `-solo-lectura` 6,2 s, `-solo-lectura-rechazos` 4,5 s y `-solo-lectura-estados` 4,2 s. El archivo más largo de toda la suite tarda 18,9 s (`dependency-rule-apps`). Ninguno pasa de 20 s, y no hizo falta partir ninguno. Estado: `READY_FOR_MERGE`.
