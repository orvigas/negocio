# REQ-F-010 — Horarios reales de Molotes y Birria El Muñeco

## Estado

APPROVED

## Aprobación

Aprobado por el usuario (versión 1, fecha 2026-10-03). Cita textual: "apruebo 010 y 009 con P-11 A".

Respuestas previas del usuario (citas textuales):

- "el horario de los molotes será de martes a viernes de 8:30 a 3:00 pm";
- "a; 1A, 2A, 4A; Birria abre sabado y domingo de 8:00 am a 3:00 pm".

Las propuestas P-1 a P-4 se aprobaron junto con la versión y pasan a ser las decisiones D-6 a D-9.

## Objetivo

Que los horarios publicados en las dos landings sean los reales y no se contradigan entre sí.

Además, cada negocio debe tener su horario definido en una sola fuente estructurada. El bot de REQ-F-009 consume esa misma fuente.

## Decisiones confirmadas por el usuario

- **D-1 (1A).** Molotes abre de martes a viernes, de 08:30 a 15:00. Cierra lunes, sábado y domingo.
- **D-2 (2A).** La regla de qué landing se muestra no cambia (CLAUDE.md §5 y §11): el lunes se muestra Molotes.
  - Ese día la landing enseña el horario correcto, con "Lunes: cerrado".
  - No hay ningún aviso que cambie según el día.
  - El bot atiende como Molotes fuera de horario (REQ-F-009).
  - No se modifican CLAUDE.md ni la lógica de selección.
- **D-3.** Birria El Muñeco abre sábado y domingo, de 08:00 a 15:00. Cierra de lunes a viernes.
- **D-4 (P-3 del análisis, 4A).** La tabla del pie de Molotes conserva sus 3 filas, en este orden:
  1. "Martes a Viernes" → "08:30 - 15:00";
  2. "Lunes" → "Cerrado por nixtamal";
  3. "Sábado y Domingo" → "Cerrado".
- **D-5 (P-4 del análisis, 4A).** La nota de "Servicio y Domicilio" de Molotes queda así: "* Lunes cerramos comales por molienda de nixtamal artesanal y curación de cazuelas. Sábados y domingos te esperamos en Birria El Muñeco."
- **D-6 (P-1). Una fuente estructurada por negocio.**
  - Cada negocio tiene sus días de servicio y su hora de apertura y de cierre, en `BUSINESS_TIMEZONE`.
  - Todos los textos de horario de la landing coinciden con esa fuente, y una prueba automática lo verifica.
  - El bot usa la misma fuente.
  - Cómo se implementa (generar los textos o validarlos) lo decide `senior-fullstack`.
- **D-7 (P-2). Textos de Molotes.** Cada texto conserva el estilo del lugar donde aparece.
  - Aviso superior: "Horario de Comal: Mar - Vie 08:30 a 15:00 hrs • Salsas Caseras y Masa Recién Frita".
  - Sección "Servicio y Domicilio": "Martes a Viernes de 8:30 AM a 3:00 PM".
- **D-8 (P-3). Textos de Birria.** Se respetan el formato y el número de filas de la plantilla, sin inventar textos.
  - **Tarjetas de "Horarios de Servicio"** (2 tarjetas):
    - tarjeta 1: días "Sábado y Domingo", horas "08:00 AM – 03:00 PM" y se conserva la nota "Consomé matutino y quesabirrias crujientes.";
    - tarjeta 2: días "Lunes a Viernes", horas "Cerrado" y nota "Reposo y Adobo.".
  - **Tabla del pie** (3 filas; la del medio está resaltada). Se mantiene el orden actual:
    1. "Miércoles - Viernes:" → "Cerrado";
    2. "Sábados y Domingos:" → "08:00 - 15:00" (la fila resaltada);
    3. "Lunes y Martes:" → "Reposo y Adobo".
- **D-9 (P-4).** Las landings solo cambian en los textos de horario. Este ticket se implementa **después del merge de REQ-F-004**, cuyo CA-5 prohíbe regenerar snapshots, y sobre los archivos `.ts` que deje esa migración.

## Hallazgos que motivan el ticket

**Molotes** (`restaurante/src/content/molotes/index.ts`) tiene 3 horarios distintos entre sí:

- el aviso superior dice "Mar - Dom 13:00 a 22:30";
- "Servicio y Domicilio" dice "Martes a Domingo de 10:00 AM a 8:00 PM";
- la tabla del pie dice "Martes a Viernes 13:00 - 22:30", "Sábado y Domingo 12:00 - 23:00" y "Lunes cerrado".

**Birria** (`restaurante/src/content/birria/index.ts`) tiene 2 horarios distintos entre sí:

- las tarjetas dicen "Viernes a Domingo 08:00 AM – 05:00 PM" y "Lunes a Jueves 11:00 AM – 07:00 PM";
- la tabla del pie dice "Miércoles - Viernes 08:30 - 17:00", "Sábados y Domingos 07:30 - 18:30" y "Lunes y Martes: Reposo y Adobo".

Birria no tiene aviso superior. No hay JSON-LD ni hay horarios en el SEO de ninguna de las dos landings.

**Contradicción resuelta (D-2):** CLAUDE.md §5 y §11 muestran Molotes los lunes, pero ese día Molotes está cerrado. Se mantiene la regla y se informa el horario.

## Alcance

- **Textos de horario de Molotes:** aviso superior, "Servicio y Domicilio" (con su nota) y la tabla del pie.
- **Textos de horario de Birria:** las tarjetas de "Horarios de Servicio" y la tabla del pie.
- La fuente estructurada de horarios de los dos negocios (D-6).
- **Pruebas:** coherencia entre los textos y la fuente, y snapshots.

## Fuera de alcance

- Cambiar la regla de qué landing se muestra cada día.
- Avisos que cambien según la hora ("hoy cerrado").
- Editar el horario desde `/admin`.
- JSON-LD `openingHours`.
- Cambios en las plantillas HTML, el diseño o `_stich_source_/`.
- Otros textos de marketing, como "Comales siempre encendidos".

## Requisitos

- **R-1.** Molotes publica el horario de D-1 en todos los lugares, con los textos de D-4, D-5 y D-7.
- **R-2.** Birria publica el horario de D-3 en todos los lugares, con los textos de D-8.
- **R-3.** Existe la fuente estructurada de D-6 para los dos negocios, y los textos visibles coinciden con ella.
- **R-4.** El marcado no cambia: los archivos de `src/views/` quedan iguales.
- **R-5.** No cambia la selección de la landing según el día (D-2).

## Historias de usuario

- **HU-1.** **Como** cliente **quiero** ver el horario real de cada negocio **para** no ir ni pedir cuando está cerrado.
- **HU-2.** **Como** dueño **quiero** que el horario esté definido en un solo lugar **para** que la web y el bot no se contradigan.

## Reglas de negocio

- **RN-1.** Molotes da servicio de martes a viernes, de 08:30 a 15:00. Birria da servicio sábado y domingo, de 08:00 a 15:00. Las horas están en `BUSINESS_TIMEZONE`.
- **RN-2.** Ningún texto publicado contradice la fuente estructurada.

## Criterios de aceptación

- **CA-1.** El HTML de `/molotes` contiene exactamente los textos de D-4, D-5 y D-7, y ningún otro horario de Molotes.
- **CA-2.** El HTML de `/birria` contiene exactamente los textos de D-8, y ningún otro horario de Birria.
- **CA-3.** Ni `src/content/` ni el HTML servido contienen ninguno de estos textos antiguos:
  - "Mar - Dom";
  - "Martes a Domingo";
  - "13:00 - 22:30";
  - "12:00 - 23:00";
  - "10:00 AM a 8:00 PM";
  - "Viernes a Domingo";
  - "Lunes a Jueves";
  - "05:00 PM";
  - "07:00 PM";
  - "08:30 - 17:00";
  - "07:30 - 18:30".
- **CA-4.** Si se cambia a propósito la hora de cierre en la fuente estructurada sin tocar los textos (cambio temporal), la prueba de coherencia falla.
- **CA-5.** Con la fecha simulada:
  - un lunes a las 10:00 en `BUSINESS_TIMEZONE`, `/` muestra Molotes con la fila "Lunes: Cerrado por nixtamal";
  - un sábado, `/` muestra Birria.

  Las pruebas de selección por día que ya existen no cambian.
- **CA-6.** Los snapshots de las landings solo cambian en los textos de horario, lo que se verifica revisando el diff. `git diff -- restaurante/src/views/` queda vacío.
- **CA-7.** `typecheck`, `lint`, `npm test` y el CI pasan.

## Casos límite

- **Lunes:** se muestra Molotes con el día marcado como cerrado (D-2).
- **Viernes y domingo después de las 15:00:** la landing no cambia hasta la medianoche.
- **Guiones:** las tarjetas de Birria usan "–" y la tabla usa "-". Se respeta el estilo de cada lugar.

## Dependencias

- Merge previo de REQ-F-004 (D-9).
- REQ-F-009 depende de este ticket.

## Riesgos

- El lunes, la landing de Molotes muestra el botón de pedido aunque el negocio esté cerrado. Riesgo aceptado (D-2).
- La frase sobre Birria en la nota de Molotes relaciona las dos marcas. Aceptado (D-5).

## Action Plan

### Objetivo

Horarios reales y coherentes en las dos landings, definidos en una sola fuente estructurada.

### Alcance

Ver la sección "Alcance".

### Fuera de alcance

Ver la sección "Fuera de alcance".

### Cambios requeridos

1. Definir la fuente estructurada de los dos negocios (D-6).
2. Actualizar los textos de Molotes (R-1) y de Birria (R-2).
3. Agregar la prueba de coherencia (R-3).
4. Actualizar los snapshots y comprobar que solo cambian los horarios (CA-6).
5. Verificar CA-1 a CA-7.

### Reglas de negocio

RN-1 y RN-2.

### UX/UI

Sin cambios de marcado ni de diseño.

### Integraciones

Ninguna.

### Casos límite

Ver la sección "Casos límite".

### Criterios de aceptación

CA-1 a CA-7.

### Dependencias

Ver la sección "Dependencias".

### Riesgos

Ver la sección "Riesgos".

### Orden recomendado

Después del merge de REQ-F-004 y antes de REQ-F-009.

### Resultado esperado

Horarios reales, coherentes entre sí y definidos en un solo lugar, listos para que los use el bot.

## Trazabilidad

| Objetivo | Requisito | Historia | Criterios |
| --- | --- | --- | --- |
| Horario real publicado | R-1, R-2, D-1, D-3, D-4, D-5, D-7, D-8 | HU-1 | CA-1 a CA-3 |
| Una sola fuente | R-3, D-6 | HU-2 | CA-4 |
| Sin cambios de comportamiento ni de diseño | R-4, R-5, D-2, D-9 | HU-1 | CA-5 a CA-7 |

**Diseño y UI:** las plantillas de `_stich_source_/` y `src/views/` no cambian. Solo cambia el contenido.

## Historial de cambios

### Versión 1

Descripción inicial (2026-10-03). Aprobada por el usuario ("apruebo 010 y 009 con P-11 A"). Las propuestas P-1 a P-4 pasan a D-6 a D-9.
