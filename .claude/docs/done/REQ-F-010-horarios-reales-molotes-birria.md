# REQ-F-010 — Horarios reales de Molotes y Birria El Muñeco

## Estado

DONE

- Pull Request: https://github.com/orvigas/negocio/pull/21, mergeado el 2026-10-05T12:52:17Z (06:52 hora de Ciudad de México), commit de merge `b5f60ef`.
- CI del push a `main` de `b5f60ef`: `calidad` y `docker` en verde (https://github.com/orvigas/negocio/actions/runs/37312547826).

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
  - **Orden modificado por PT-1 A (2026-10-04):** "Martes a Viernes", "Sábado y Domingo", "Lunes" (orden del diseño). Ver "Revisión técnica".
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

## Revisión técnica

Revisión T1 de `senior-fullstack` (2026-10-04) sobre `main` (a6d8bbb). Se revisaron CLAUDE.md, `.claude/rules/`, `_stich_source_/` (`moloteando_aut_nticos_molotes_artesanales` y `birrier_a_el_mu_eco_aut_ntica_birria_de_res_color_adobo`), `src/content/{molotes,birria}/index.ts`, `src/views/pages/{molotes,birria}.html`, `src/services/business-schedule.ts`, `src/config/env.ts`, `tests/unit/{content,landing-snapshot}.test.ts`, `tests/integration/app.test.ts` y RF-6 de REQ-F-009.

Conclusión: el ticket es implementable sin tocar `src/views/` ni la selección por día. Todos los textos caben en los campos existentes (`announcement`, `service.schedule.hours/note`, `footer.hours.rows[0..2]`, `locations.schedule.slots[0..1]`). Hay **una** decisión de diseño pendiente (PT-1) y dos interpretaciones que no bloquean (I-1, I-2).

### PT-1 (bloqueante). Orden de la tabla del pie de Molotes frente al estilo de la plantilla

- **Problema.** En el diseño (`_stich_source_/moloteando_.../code.html`, pie "Horarios del Comal") y en `src/views/pages/molotes.html:337-339`, el estilo va por **posición**, no por contenido:
  - filas 1 y 2: días en `text-on-surface` y horas en `text-secondary font-medium` (dorado, "abierto");
  - fila 3: días y horas en `text-outline` (gris apagado). Es la fila que el diseño reserva para el día cerrado ("Lunes / Cerrado por nixtamal").
- **Requisito afectado.** D-4 pide el orden Martes a Viernes → Lunes → Sábado y Domingo. Con ese orden, "Lunes: Cerrado por nixtamal" sale en dorado, con el estilo de "abierto", y "Sábado y Domingo: Cerrado" ocupa la fila gris. R-4 prohíbe cambiar el marcado, así que el estilo no se puede adaptar al contenido.
- **Impacto.** Visual y de UX menor, pero se aparta del diseño fuente (CLAUDE.md §3: prevalece `_stich_source_/`). Además, con D-4 cambian las etiquetas de días de las filas 2 y 3 en el snapshot. Con el orden del diseño solo cambian las horas.
- **Alternativas.** Hay dos filas cerradas y una sola fila gris, así que con cualquier orden una fila cerrada sale en dorado.
  - **A (recomendada). Orden del diseño:**
    1. "Martes a Viernes" → "08:30 - 15:00";
    2. "Sábado y Domingo" → "Cerrado";
    3. "Lunes" → "Cerrado por nixtamal" (gris, idéntica al diseño).

    Conserva la fila del diseño para el lunes, que es el día cerrado que la landing sí muestra (D-2). El diff del snapshot se limita a dos textos de horas.
  - **B. Mantener D-4 tal como se aprobó:** Martes a Viernes → Lunes → Sábado y Domingo. Se acepta que "Cerrado por nixtamal" se vea en dorado.
- **Decisión del usuario (2026-10-04): opción A.** Cita textual: "PT-1 A y apruebo el plan". **Modifica el orden de D-4:** el pie de Molotes queda "Martes a Viernes" → "08:30 - 15:00", "Sábado y Domingo" → "Cerrado", "Lunes" → "Cerrado por nixtamal" (orden del diseño). Los textos de D-4 no cambian; CA-5 sigue igual.

### I-1 (no bloqueante). Texto literal de CA-5

En la plantilla, el día y la hora van en dos `<span>` del mismo `<li>`, y las etiquetas de Molotes no llevan dos puntos. El HTML nunca contendrá la cadena "Lunes: Cerrado por nixtamal". La prueba de CA-5 comprobará que existe un `<li>` del pie con "Lunes" y "Cerrado por nixtamal".

### I-2 (no bloqueante). Textos fuera del alcance que mencionan días

Se revisaron y no contradicen el horario nuevo, así que no se tocan:

- "Jueves de Molotes 2x1" (semilla de Molotes) y el mensaje de éxito "… este próximo jueves": Molotes abre el jueves.
- "Domingos de Birria Familiar" (semilla de Birria): Birria abre el domingo.
- "El comal arde desde temprana hora los fines de semana" y "Te avisaremos el sábado…": coherentes.
- Los comentarios JSDoc "(lunes a viernes)" y "(sábado y domingo)" de `src/content/*/index.ts` describen la selección de landing, no el horario. Se aclararán en el comentario, sin cambiar el contenido.

## Technical Action Plan

### Objetivo técnico

Hacer que los textos de horario sean los reales (R-1, R-2), y crear una fuente estructurada y tipada por negocio (R-3) que REQ-F-009 pueda importar. Una prueba de coherencia debe fallar si los textos y la fuente divergen (CA-4). No se toca `src/views/` (R-4) ni `business-schedule.ts` (R-5).

### Decisiones técnicas

1. **Dónde vive la fuente.**
   - `src/content/molotes/hours.ts` y `src/content/birria/hours.ts`: un dato por negocio, separado de los textos de marketing (CLAUDE.md §7).
   - `src/content/hours.ts` los agrega como `BUSINESS_HOURS: { readonly [Id in BusinessId]: BusinessHours }`, que obliga a definir una entrada por cada negocio, y expone `getBusinessHours(id)`, que falla rápido con un id desconocido, igual que `getBusinessContent`.
2. **Forma de los datos:**

   ```ts
   /** Hora local 'HH:MM' (24 h) en la zona horaria del negocio (BUSINESS_TIMEZONE). */
   export type ClockTime = `${number}${number}:${number}${number}`;
   export interface BusinessHours {
     readonly days: readonly Weekday[]; // reutiliza Weekday de services/business-schedule.ts
     readonly opens: ClockTime;
     readonly closes: ClockTime;
   }
   // molotes: { days: ['Tue','Wed','Thu','Fri'], opens: '08:30', closes: '15:00' }
   // birria:  { days: ['Sat','Sun'],             opens: '08:00', closes: '15:00' }
   ```

   - Hay un solo intervalo por día porque basta para RN-1 (YAGNI). Si un día hace falta horario partido, se amplía el tipo.
   - `Weekday` usa las mismas abreviaturas que `getWeekday()`. Así el bot compara directamente con el día calculado en la zona del negocio.
3. **Zona horaria.** La fuente **no** guarda la zona: las horas son locales y se interpretan en `config.timezone` (`BUSINESS_TIMEZONE`, validada en `src/config/env.ts`). Hay una sola zona en todo el sistema y no se duplica. Se documenta en el JSDoc del tipo.
4. **Se validan los textos; no se generan (recomendado).** Los textos de horario siguen siendo literales en `src/content/<negocio>/index.ts` y una prueba los valida contra la fuente. Motivos:
   - Hay cinco estilos distintos ("Mar - Vie 08:30 a 15:00 hrs", "de 8:30 AM a 3:00 PM", "08:30 - 15:00", "08:00 AM – 03:00 PM") y filas de días cerrados con texto libre ("Cerrado por nixtamal", "Reposo y Adobo", y "Miércoles - Viernes" separado de "Lunes y Martes"). Generarlos exigiría formateadores y plantillas de texto por ubicación: complejidad sin valor para dos landings.
   - CA-4 describe justamente la validación: se cambia la fuente sin tocar los textos y la prueba falla. Si los textos se generaran, los textos cambiarían solos y la prueba de coherencia no fallaría.
   - El render de las landings no gana ninguna dependencia nueva en tiempo de ejecución. El riesgo para el marcado y los snapshots es nulo.

### Archivos o componentes afectados

- **Nuevos:**
  - `src/content/molotes/hours.ts`
  - `src/content/birria/hours.ts`
  - `src/content/hours.ts`
  - `tests/support/schedule-text.ts` (intérprete de textos, solo para pruebas)
  - `tests/unit/business-hours.test.ts`
- **Modificados:**
  - `src/content/molotes/index.ts` (textos de D-4/PT-1, D-5 y D-7; comentario JSDoc)
  - `src/content/birria/index.ts` (textos de D-8; comentario JSDoc)
  - `tests/integration/app.test.ts` (CA-1, CA-2, CA-3 sobre el HTML servido, y CA-5)
  - `tests/snapshots/landing-molotes.html` y `tests/snapshots/landing-birria.html` (se regeneran)
  - `restaurante/README.md` (sección de contenido: dónde vive el horario y que está en `BUSINESS_TIMEZONE`)
- **Sin cambios:** `src/views/**`, `src/services/business-schedule.ts`, `src/config/**`, `public/**` y `_stich_source_/`. Tampoco hace falta `build:css`, porque no cambian las clases.

### Contenido / configuración

- **Molotes:**
  - `announcement`: "Horario de Comal: Mar - Vie 08:30 a 15:00 hrs • Salsas Caseras y Masa Recién Frita".
  - `service.schedule.hours`: "Martes a Viernes de 8:30 AM a 3:00 PM".
  - `service.schedule.note`: el texto de D-5.
  - `footer.hours.rows`: orden de PT-1 A (Martes a Viernes → Sábado y Domingo → Lunes), con los textos de D-4.
- **Birria:**
  - `locations.schedule.slots`: según D-8; la nota de la tarjeta 2 pasa a "Reposo y Adobo.".
  - `footer.hours.rows`: según D-8, con el orden actual.
- No hay variables de entorno nuevas.

### Validaciones (prueba de coherencia, CA-4 y RN-2)

`tests/support/schedule-text.ts` tiene un intérprete pequeño y explícito de los textos en español:

- días completos y abreviados ("Lunes"…"Domingo", "Mar", "Vie", plurales "Sábados");
- rangos con "a" o "-";
- conjunción "y";
- horas "HH:MM" de 24 h y "H:MM AM/PM", que se normalizan a 'HH:MM' de 24 h;
- se ignoran los dos puntos finales.

Para cada negocio, `tests/unit/business-hours.test.ts` comprueba:

1. La fuente es válida: los días no están vacíos ni repetidos, las horas tienen el formato `HH:MM` correcto y la apertura es anterior al cierre.
2. Cada texto con horas (aviso, "Servicio y Domicilio", filas abiertas del pie y tarjetas):
   - nombra exactamente los días de `days`;
   - su par de horas, normalizado, es igual a `opens`–`closes`.
3. Las filas cerradas (horas "Cerrado", "Cerrado por nixtamal" o "Reposo y Adobo", sin hora) cubren, unidas, exactamente los días que no están en `days`. Las filas abiertas y cerradas no se solapan.
4. En el HTML renderizado de cada landing, toda hora que aparece en el texto visible es `opens` o `closes` del negocio, en 24 h o en 12 h. Así se cubre "ningún otro horario" de CA-1 y CA-2.
5. Prueba del intérprete con casos fijos ("Mar - Vie", "Sábados y Domingos:", "Miércoles - Viernes:", "8:30 AM", "03:00 PM").

**CA-4** se verifica a mano durante la implementación y la evidencia se deja en el Implementation Result:

1. Cambiar temporalmente `closes` de Molotes a `'16:00'`.
2. Ejecutar `npx vitest run tests/unit/business-hours.test.ts`. Debe fallar y se guarda la salida.
3. Revertir el cambio y comprobar que `git diff -- src/content/molotes/hours.ts` queda vacío.
4. Repetir con Birria.

### Testing

- **CA-1 y CA-2** (`tests/integration/app.test.ts`): `GET /molotes` y `GET /birria` contienen cada texto exacto de D-4/PT-1, D-5, D-7 y D-8. Además se aplica el punto 4 de la prueba de coherencia.
- **CA-3.** Una prueba recorre los archivos `.ts` y `.json` de `src/content/` y el HTML de las dos rutas, y comprueba que no aparece ninguna de las 11 cadenas antiguas. Queda como prueba de regresión.
- **CA-5.** Con el `now` inyectable que ya existe (`agent({ now })`):
  - lunes 10:00 en la Ciudad de México (`2026-10-12T16:00:00Z`): `/` contiene `data-business="molotes"` y un `<li>` del pie con "Lunes" y "Cerrado por nixtamal" (I-1);
  - un sábado: `/` sirve Birria (la prueba existente ya lo cubre).

  Las pruebas de selección existentes no se modifican.
- **CA-6.** Snapshots:
  1. Ejecutar `npx vitest run tests/unit/landing-snapshot.test.ts -u`, solo después de cambiar el contenido.
  2. Revisar `git diff --word-diff -U0 -- tests/snapshots/`: cada palabra cambiada debe ser un texto de horario. Se espera:
     - en Molotes: el aviso, "Servicio y Domicilio" (horas y nota) y las filas del pie;
     - en Birria: los días, las horas y la nota de la tarjeta 2, y las horas de las filas del pie.
  3. Comprobación mecánica: `git diff -U0 -- tests/snapshots/ | grep -E '^[-+][^-+]'` solo debe listar líneas del aviso, `schedule-box`, `schedule-card` y el `<ul>` de horarios del pie, sin cambios de clases ni de atributos.
  4. `git diff --exit-code -- src/views/` debe terminar con 0.
  5. Las salidas se pegan en el Implementation Result.
- **CA-7:** `npm run typecheck`, `npm run lint` y `npm test`, y el CI (`calidad` y `docker`) en T4.

### Seguridad

No aplica más allá de lo actual. Los textos siguen saliendo escapados con `{{ }}`. No hay entradas externas nuevas ni configuración nueva.

### Performance

Sin impacto. La fuente es una constante congelada y las landings no la usan en tiempo de ejecución.

### Riesgos técnicos

- El intérprete de pruebas solo entiende el vocabulario actual. Un texto nuevo con otra forma hará fallar la prueba, que es lo que se busca (fail fast), y obligará a ampliar el intérprete.
- REQ-F-009 depende del contrato `BusinessHours` y `getBusinessHours`. Cambiarlo después implica tocar el bot.

### Orden de implementación

1. Rama `feature/REQ-F-010-horarios-reales-molotes-birria`.
2. Fuente (`hours.ts`) y su prueba de validez.
3. Intérprete de pruebas y prueba de coherencia, que debe fallar con los textos actuales.
4. Actualizar los textos de Molotes y de Birria, hasta que la prueba de coherencia pase.
5. Pruebas de CA-1, CA-3 y CA-5 en `app.test.ts`.
6. Regenerar los snapshots y revisar el diff (CA-6).
7. Comprobación manual de CA-4.
8. README.
9. typecheck, lint y test.

### Criterios de finalización

- CA-1 a CA-7 verificados, con evidencia en el Implementation Result.
- `git diff -- src/views/` vacío.
- El diff de snapshots solo contiene textos de horario.
- typecheck y lint terminan con 0 y todas las pruebas pasan.

## Implementation Result

### Rama

`feature/REQ-F-010-horarios-reales-molotes-birria`, creada desde `main` (a6d8bbb, actualizado con `git pull --ff-only`). Sin commits: el trabajo está en el árbol de trabajo.

### Cambios realizados

1. **Fuente estructurada (D-6).**
   - `src/content/molotes/hours.ts`: `{ days: ['Tue','Wed','Thu','Fri'], opens: '08:30', closes: '15:00' }`.
   - `src/content/birria/hours.ts`: `{ days: ['Sat','Sun'], opens: '08:00', closes: '15:00' }`.
   - `src/content/hours.ts` define los tipos `ClockTime` y `BusinessHours`, la constante `BUSINESS_HOURS` (una entrada obligatoria por negocio) y `getBusinessHours(id)`, que falla rápido con un id desconocido.
   - La zona horaria no se guarda en la fuente: las horas son locales en `BUSINESS_TIMEZONE`.
   - **Añadido respecto al plan:** `defineHours()` valida y congela cada horario al cargar el módulo (días no vacíos, sin repetir y conocidos; formato `HH:MM`; apertura anterior al cierre). Es fail fast para el bot de REQ-F-009 y cuesta muy poco.
2. **Textos de Molotes (R-1).**
   - Aviso superior y "Servicio y Domicilio" según D-7.
   - Nota según D-5.
   - Pie en el orden PT-1 A:
     - "Martes a Viernes" → "08:30 - 15:00";
     - "Sábado y Domingo" → "Cerrado";
     - "Lunes" → "Cerrado por nixtamal".
3. **Textos de Birria (R-2).**
   - Tarjetas según D-8. La nota de la tarjeta 2 pasa a "Reposo y Adobo.".
   - Pie según D-8, con el orden actual.
4. **Comentarios JSDoc** de `src/content/{molotes,birria}/index.ts`: ahora aclaran que "(lunes a viernes)" y "(sábado y domingo)" se refieren a qué landing se muestra cada día (I-2).
5. **Pruebas.**
   - `tests/support/schedule-text.ts` (nuevo): intérprete, solo para pruebas, de los días y horas en español.
   - `tests/unit/business-hours.test.ts` (nuevo, 28 pruebas): validez de la fuente; coherencia de los textos de una línea, de las tablas (que deben cubrir la semana sin solaparse), de las notas de cierre y de toda hora visible en el HTML; y casos del propio intérprete.
   - `tests/integration/app.test.ts`: nuevo bloque "horarios reales (REQ-F-010)" con CA-1, CA-2, CA-3 y CA-5.
   - Snapshots regenerados. Al comentario de `landing-snapshot.test.ts` se le agregó una línea que lo registra.
6. **Documentación.** `README.md`: nueva subsección "Horario de servicio" y árbol de `content/` actualizado.

### Criterios de aceptación

| CA | Estado | Evidencia |
| --- | --- | --- |
| CA-1 | Cumple | `app.test.ts`, "CA-1": textos exactos de D-5, D-7 y D-4 (orden PT-1 A). `business-hours.test.ts`: las únicas horas visibles son 08:30 y 15:00. |
| CA-2 | Cumple | `app.test.ts`, "CA-2": tarjetas y pie exactos de D-8. Las únicas horas visibles son 08:00 y 15:00. |
| CA-3 | Cumple | `app.test.ts`, "CA-3": recorre los `.ts` y `.json` de `src/content/` y el HTML de `/molotes` y `/birria` buscando las 11 cadenas antiguas. |
| CA-4 | Cumple | Prueba manual revertida (ver abajo): con `closes: '16:00'`, 4 pruebas fallan en cada negocio. |
| CA-5 | Cumple | Lunes 10:00 en la Ciudad de México (`2026-10-12T16:00:00Z`): `/` sirve Molotes con la fila del pie ["Lunes", "Cerrado por nixtamal"] (I-1). Un sábado sirve Birria con "08:00 - 15:00". Las pruebas de selección existentes no se tocaron. |
| CA-6 | Cumple | Diff de snapshots limitado a horarios (ver abajo). `git diff --exit-code -- src/views/` termina con 0. |
| CA-7 | Cumple en local | typecheck, lint, test, build:css y `docker build` en verde. El CI del PR se verifica en T4. |

### Validaciones ejecutadas

Todos los comandos se ejecutaron desde `restaurante/`.

- **Prueba de coherencia antes de cambiar los textos.** Con los textos antiguos, `npx vitest run tests/unit/business-hours.test.ts` da `Tests 7 failed | 21 passed (28)`. Por ejemplo: `Horario de Comal: Mar - Dom 13:00 a 22:30 hrs …: expected [ 'Tue', 'Wed', 'Thu', 'Fri', …(2) ] to deeply equal [ 'Tue', 'Wed', 'Thu', 'Fri' ]`.
- **CA-4, prueba manual revertida.**
  - Molotes con `closes: '16:00'`: `Tests 4 failed | 24 passed (28)`. Fallaron: "define el horario de cada negocio según RN-1", "cada texto de una línea…", "la tabla \"pie de página\"…" y "toda hora visible en la landing…".
  - Birria con `closes: '16:00'`: `Tests 4 failed | 24 passed (28)`. Fallaron: "define el horario…", "la tabla \"tarjetas de Horarios de Servicio\"…", "la tabla \"pie de página\"…" y "toda hora visible…".
  - Se restauraron los dos archivos desde una copia y se comprobó que `closes` volvió a `'15:00'` en ambos.
- **Snapshots.**
  - `npx vitest run tests/unit/landing-snapshot.test.ts -u` → `Snapshots 2 updated`, `Tests 2 passed (2)`.
  - `git diff --stat -- tests/snapshots/` → birria 14 (7+/7-) y molotes 10 (5+/5-).
  - Revisión de `git diff --word-diff -U0 -- tests/snapshots/`: solo cambian textos dentro de las etiquetas, en estos lugares:
    - Molotes: el aviso, la línea de horas y la nota de `schedule-box`, y las filas 1 y 2 del pie.
    - Birria: los días, las horas y la nota de `schedule-card` (la tarjeta 1 solo en días y horas), y las horas de las filas 1 y 2 del pie.
  - Comprobación mecánica: se eliminó el texto entre etiquetas (`sed -E 's/>[^<]*</></g'`) en las dos versiones de cada snapshot y se compararon. Resultado: "molotes: marcado idéntico (solo cambia texto)" y "birria: marcado idéntico (solo cambia texto)".
  - `git diff --exit-code -- src/views/` → exit 0.
- `npm run build:css` → exit 0. No hacía falta, porque no cambian las clases; se ejecutó igualmente.
- `npm run typecheck` → exit 0.
- `npm run lint` → exit 0, sin errores ni avisos.
- `npm test` → exit 0: `Test Files 26 passed (26)`, `Tests 501 passed (501)`.
- `docker build -t restaurante:req-f-010 .` → exit 0. Esta construcción incluye la etapa de typecheck.
- **Prueba de humo del contenedor** (`NODE_ENV=production`, `DATA_DIR=/tmp/data`): `/molotes` contiene "Mar - Vie 08:30 a 15:00 hrs" y `/birria` contiene "08:00 AM – 03:00 PM", ambas con 200. Después se eliminaron el contenedor y la imagen.

### Archivos afectados

- **Nuevos:**
  - `restaurante/src/content/hours.ts`
  - `restaurante/src/content/molotes/hours.ts`
  - `restaurante/src/content/birria/hours.ts`
  - `restaurante/tests/support/schedule-text.ts`
  - `restaurante/tests/unit/business-hours.test.ts`
- **Modificados:**
  - `restaurante/src/content/molotes/index.ts`
  - `restaurante/src/content/birria/index.ts`
  - `restaurante/tests/integration/app.test.ts`
  - `restaurante/tests/unit/landing-snapshot.test.ts` (solo el comentario)
  - `restaurante/tests/snapshots/landing-molotes.html`
  - `restaurante/tests/snapshots/landing-birria.html`
  - `restaurante/README.md`
- **Movido:** este ticket, de `backlog/` a `in-progress/`.
- **Sin cambios:** `src/views/**`, `src/services/business-schedule.ts`, `src/config/**`, `public/**` y `_stich_source_/`.

### Riesgos o pendientes

- El intérprete de pruebas solo entiende el vocabulario actual. Un texto de horario con otra forma hará fallar la prueba y obligará a ampliarlo; es intencional.
- REQ-F-009 dependerá del contrato `BusinessHours` / `getBusinessHours` de `src/content/hours.ts`.
- Riesgos de negocio ya aceptados: el CTA visible el lunes (D-2) y la mención de Birria en la nota de Molotes (D-5).
- Falta el CI del PR (`calidad` y `docker`), que se verifica en T4.

## QA Action Plan

### Objetivo

Validar con evidencia que las dos landings publican los horarios reales aprobados (D-1, D-3 a D-8 y PT-1 A), que existe una fuente estructurada única coherente con los textos (D-6), y que nada más cambió: ni el marcado, ni la selección por día, ni el resto del contenido.

### Requisito bajo prueba

R-1 a R-5 (D-1 a D-9 y PT-1 A). Fuente funcional: este ticket. Fuente visual: `_stich_source_/moloteando_aut_nticos_molotes_artesanales/code.html` (pie "Horarios del Comal", línea 243; nota de nixtamal, línea 126) y `_stich_source_/birrier_a_el_mu_eco_aut_ntica_birria_de_res_color_adobo/code.html` (pie, líneas 520-525). En el diseño, el estilo de las filas del pie va por posición: en Molotes, filas 1-2 en dorado (`text-secondary font-medium`) y fila 3 en gris (`text-outline`); en Birria, la fila 2 resaltada (`text-amber-glow font-bold`).

### Criterios de aceptación

| CA | Pruebas que lo cubren |
| --- | --- |
| CA-1 | F-1, F-3, N-1, V-1 |
| CA-2 | F-2, F-3, N-1, V-2 |
| CA-3 | F-4 |
| CA-4 | F-5 (prueba independiente de QA, con reversión verificada) |
| CA-5 | F-6, N-2 |
| CA-6 | R-1, R-2, R-3 |
| CA-7 | A-1 (local); CI del PR queda pendiente para T4 |

### Riesgos identificados

1. **Texto exacto mal transcrito** (tildes, guion "–" frente a "-", "AM"/"PM", punto final de "Reposo y Adobo."): una diferencia de un carácter pasaría desapercibida a la vista. Se mitiga con comparación literal contra el ticket, no contra el código.
2. **Prueba de coherencia acoplada a la implementación**: la prueba de `business-hours.test.ts` la escribió quien implementó; QA repite CA-4 por su cuenta y además rompe el texto (no solo la fuente) para comprobar que detecta la divergencia en ambos sentidos.
3. **Cambio colateral en el HTML**: un cambio de contenido podría alterar otros textos o el marcado. Se mitiga comparando el HTML servido en `main` y en la rama.
4. **Textos más largos** (nota de "Servicio y Domicilio" con la frase de Birria; "Cerrado por nixtamal"; "08:00 AM – 03:00 PM" en `text-xl`): posible desbordamiento o corte en 375 px.
5. **Estilo por posición** (PT-1 A): en Molotes, "Sábado y Domingo → Cerrado" sale en dorado con el estilo de "abierto". Está **aceptado** por el usuario (PT-1); QA solo verifica que el resultado coincide con PT-1 A y lo registra, no lo trata como defecto.
6. **Extensión de Chrome no conectada** (ver "Pruebas en navegador"): la revisión visual quedaría sin evidencia de captura.

### Pruebas funcionales

- **F-1. Textos exactos de Molotes.** Con el servidor de QA, `curl /molotes` y comprobación literal (grep -F) de cada cadena del ticket:
  - aviso: "Horario de Comal: Mar - Vie 08:30 a 15:00 hrs • Salsas Caseras y Masa Recién Frita" (D-7);
  - "Martes a Viernes de 8:30 AM a 3:00 PM" (D-7);
  - nota: "* Lunes cerramos comales por molienda de nixtamal artesanal y curación de cazuelas. Sábados y domingos te esperamos en Birria El Muñeco." (D-5);
  - pie, en este orden (PT-1 A): "Martes a Viernes" / "08:30 - 15:00", "Sábado y Domingo" / "Cerrado", "Lunes" / "Cerrado por nixtamal" (D-4), extrayendo los tres `<li>` del `<ul>` del pie.
- **F-2. Textos exactos de Birria** (D-8), en `/birria`:
  - tarjeta 1: "Sábado y Domingo", "08:00 AM – 03:00 PM" (guion largo), "Consomé matutino y quesabirrias crujientes.";
  - tarjeta 2: "Lunes a Viernes", "Cerrado", "Reposo y Adobo.";
  - pie, en el orden actual: "Miércoles - Viernes:" / "Cerrado", "Sábados y Domingos:" / "08:00 - 15:00" (fila resaltada), "Lunes y Martes:" / "Reposo y Adobo".
- **F-3. "Ningún otro horario"** (CA-1 y CA-2): extraer del texto visible de cada landing (sin etiquetas) todas las horas con la expresión `\d{1,2}:\d{2}` y comprobar que en Molotes solo aparecen 08:30/8:30 y 15:00/3:00, y en Birria solo 08:00 y 15:00/03:00. Revisar además que ningún otro texto con nombres de días contradiga el horario (lista I-2 del ticket).
- **F-4. CA-3.** `grep -rnF` de las 11 cadenas antiguas sobre `restaurante/src/content/` (todos los archivos, no solo `.ts`/`.json`) y sobre el HTML servido de `/`, `/molotes` y `/birria`. Esperado: 0 coincidencias. Se reporta también si aparecen en `restaurante/data/` u otros datos editables que lleguen a la landing.
- **F-5. CA-4, prueba independiente.** Con copia de seguridad previa en el scratchpad y verificación final de `git diff` limpio:
  1. cambiar `closes` de Molotes a `'16:00'` y ejecutar `npx vitest run tests/unit/business-hours.test.ts` → debe fallar;
  2. igual con Birria → debe fallar;
  3. variante inversa: dejar la fuente intacta y cambiar un solo texto (p. ej. "08:30 - 15:00" del pie de Molotes a "08:30 - 16:00") → debe fallar;
  4. variante de días: añadir `'Mon'` a los días de Molotes → debe fallar;
  5. restaurar y comprobar `git diff --stat` igual al inicial (mismo hash de archivos con `shasum`) y la prueba de nuevo en verde.
- **F-6. CA-5.** Ejecutar el bloque de integración "horarios reales (REQ-F-010)" y, además, en el servidor de QA no hay forma de fijar la fecha; por eso se valida con un script ad hoc en el scratchpad (no se agrega al repositorio) que use `createApp`/`agent({ now })` igual que las pruebas existentes: lunes 10:00 CDMX (`2026-10-12T16:00:00Z`) → `/` con `data-business="molotes"` y el `<li>` "Lunes" + "Cerrado por nixtamal"; sábado → Birria con "08:00 - 15:00".

### Pruebas negativas y casos límite

- **N-1.** Guiones: "–" en las tarjetas de Birria y "-" en las tablas; ningún texto mezcla estilos. Dos puntos finales solo en el pie de Birria.
- **N-2. Selección por día y transiciones** (D-2, R-5), con el script ad hoc de F-6 y `BUSINESS_TIMEZONE=America/Mexico_City`:
  - lunes 00:00 y 10:00, martes a viernes → Molotes; sábado y domingo → Birria;
  - viernes 23:59:59 → Molotes y sábado 00:00:00 → Birria;
  - domingo 23:59:59 → Birria y lunes 00:00:00 → Molotes;
  - viernes y domingo a las 15:30 (después del cierre) → la landing no cambia hasta medianoche;
  - servidor con `TZ=UTC` y `TZ=Asia/Tokyo` en el proceso: mismos resultados.
  - `git diff main -- src/services/ tests/unit/business-schedule.test.ts` vacío (las pruebas de selección no se tocaron).
- **N-3.** `getBusinessHours` con un id desconocido lanza error; la fuente está congelada (`Object.isFrozen`) — se comprueba en el script ad hoc o con las pruebas existentes de `business-hours.test.ts`.

### Pruebas responsive

En 375×812, 768×1024 y 1440×900, para `/molotes` y `/birria`:

- aviso superior de Molotes: el texto nuevo no desborda ni se corta, y no empuja el header de forma distinta a `main`;
- caja "Horarios de Comal" y nota de Molotes: la nota más larga se ajusta en varias líneas sin overflow;
- tarjetas de Birria ("08:00 AM – 03:00 PM" en `text-xl`): sin corte ni desbordamiento en 375 px (una columna) ni en 768 px (dos columnas, `sm:grid-cols-2`);
- pies: cada fila mantiene día y hora en los extremos (`justify-between`); "Cerrado por nixtamal" no se monta sobre "Lunes";
- `document.documentElement.scrollWidth <= innerWidth` en cada viewport (sin overflow horizontal);
- CTA de WhatsApp visible sin scroll en móvil (regresión).

### Pruebas de accesibilidad

- Un solo `h1` y la misma jerarquía de encabezados que en `main` (comparación de la lista de `h1`-`h6` entre ramas).
- Contraste de las filas que cambiaron de contenido, calculado con los colores computados: Molotes fila 2 ("Cerrado" en `text-secondary`) y fila 3 (`text-outline`) sobre el fondo del pie; Birria "Cerrado" en `text-cream-muted` y en la tarjeta (`text-white` sobre `#590d0d`). Mínimo 4.5:1 para texto normal. Si alguno no llega pero es igual que en `main`/diseño, se registra como observación preexistente, no como defecto de este ticket.
- El estado "cerrado" se comunica con texto ("Cerrado", "Cerrado por nixtamal", "Reposo y Adobo"), no solo con color.

### Pruebas UX/UI (vs. _stich_source_/)

- **V-1. Pie de Molotes según PT-1 A:** fila 1 "Martes a Viernes" dorado; fila 2 "Sábado y Domingo / Cerrado" dorado (aceptado en PT-1); fila 3 "Lunes / Cerrado por nixtamal" en gris, igual que el diseño. Se verifican las clases y los colores computados.
- **V-2. Pie de Birria:** la fila resaltada (`text-amber-glow font-bold`) es "Sábados y Domingos: 08:00 - 15:00", es decir, la fila resaltada es la de los días abiertos.
- Tipografía, colores y espaciado de las secciones de horario iguales a `main` (solo cambia el texto).

### Pruebas de integración (WhatsApp)

Solo regresión: los CTA siguen usando el enlace configurado (pruebas existentes de `app.test.ts`) y el `href` de los CTA es idéntico entre `main` y la rama (cubierto por R-2).

### Pruebas de performance

Sin cambios esperados. Se comprueba que no hay errores en consola en ambas landings y que la lista de recursos solicitados es la misma (mismo HTML salvo texto, R-2). `src/content/hours.ts` no se importa en el render (verificación con `grep`/CodeGraph de sus consumidores).

### Pruebas SEO

`title`, meta description, canonical y Open Graph de ambas landings idénticos a `main` (cubierto por R-2). No se añadieron horarios a metadatos ni JSON-LD (fuera de alcance).

### Pruebas de regresión

- **R-1. Diff de snapshots limitado a horarios:** `git diff main --word-diff -U0 -- restaurante/tests/snapshots/`; cada palabra cambiada debe ser uno de los textos de horario del ticket. Comprobación mecánica: eliminar el texto entre etiquetas en ambas versiones y comparar (marcado idéntico).
- **R-2. HTML servido, `main` frente a la rama:** levantar `main` en un `git worktree` temporal del scratchpad (puerto 3101, mismo `.env`) y la rama en el puerto 3100; descargar `/molotes` y `/birria` de ambos y hacer `diff`. Esperado: solo las líneas de horario (las mismas de R-1); todo lo demás idéntico (cabecera, SEO, CTA, menú, formularios, pie). Si los datos editables (`DATA_DIR`) difieren entre ambos, se usa el mismo directorio de datos en solo lectura o una copia. El worktree se elimina al terminar.
- **R-3.** `git diff main --stat -- restaurante/src/views/ restaurante/src/services/ restaurante/src/config/ restaurante/public/ _stich_source_/` vacío.
- **R-4.** Consumidores de los archivos modificados con `codegraph explore` (o `grep` si falla): `src/content/molotes/index.ts`, `src/content/birria/index.ts` y el nuevo `src/content/hours.ts`.
- **R-5.** Suite completa (`npm test`).

### Pruebas automatizadas

- **Existentes a ejecutar** (desde `restaurante/`): `npm run build:css`, `npm run typecheck`, `npm run lint` (sin `lint:fix`), `npm test`, y en particular `tests/unit/business-hours.test.ts`, `tests/unit/landing-snapshot.test.ts`, `tests/unit/business-schedule.test.ts` y `tests/integration/app.test.ts`.
- **Nuevas:** ninguna en el repositorio. Las comprobaciones de N-2 (transiciones de domingo a lunes en el HTTP), F-6 y F-5 se hacen con scripts temporales en el scratchpad, que no se versionan. Si el usuario prefiere que la transición domingo 23:59 → lunes 00:00 quede como prueba permanente en `restaurante/tests/`, debe indicarlo al aprobar este plan.

### Pruebas en navegador

- Herramientas `mcp__claude-in-chrome__*` (Claude in Chrome): pestaña nueva, `/molotes` y `/birria` del servidor de QA (puerto 3100) en los tres viewports, capturas de las secciones de horario (aviso, "Servicio y Domicilio", tarjetas de Birria y ambos pies), `javascript_tool` para overflow horizontal, colores computados y contraste, y `read_console_messages` para errores. No se pulsan CTA ni se sigue el enlace de WhatsApp. La pestaña se cierra al terminar.
- **Riesgo:** la extensión puede no estar conectada (no se ha comprobado en Q1 porque no se ejecuta nada). Si no responde tras 2-3 intentos, **alternativa**:
  1. comprobaciones automáticas equivalentes con jsdom sobre el HTML servido (orden de filas, clases de cada fila del pie, textos) y cálculo de contraste con los valores de color del CSS compilado;
  2. la revisión visual (desbordamientos y aspecto en los tres viewports) queda **pendiente de revisión manual del usuario**, con una lista de pasos concreta.
  
  Como ningún CA depende exclusivamente de la revisión visual (CA-1 a CA-7 se verifican sobre el HTML), en ese caso QA podría aprobar dejando la revisión visual como pendiente; si aparece una duda visual que afecte a un CA, se devolverá `NEEDS_USER_DECISION`.

### Evidencia requerida

- Salidas de `build:css`, `typecheck`, `lint` y `npm test` (resumen de archivos y pruebas).
- Salida de los `grep` de F-1, F-2 y F-4, y lista de horas encontradas en F-3.
- Salidas de las cuatro variantes de F-5 (pruebas fallidas) y la verificación de restauración (`git diff`/`shasum`).
- Tabla de resultados de N-2 (fecha UTC, hora local, `TZ` del proceso, negocio mostrado).
- `diff` del HTML servido `main` frente a rama (R-2) y del word-diff de snapshots (R-1).
- Capturas por viewport y resultado de overflow y contraste, o la nota de bloqueo de la extensión.

### Criterios de aprobación

- CA-1 a CA-6 en PASS con evidencia; CA-7 en PASS local (CI pendiente para T4, registrado).
- El diff del HTML servido frente a `main` solo contiene textos de horario.
- Sin desbordamientos ni regresiones de accesibilidad en los tres viewports (o revisión visual registrada como pendiente si la extensión no está disponible).
- Sin defectos `BLOCKER` o `CRITICAL`, y sin `MAJOR` sin decisión del usuario.
- El árbol de trabajo queda igual que al empezar QA (salvo el ticket) y el servidor y el worktree temporales detenidos y eliminados.

## QA Report

### Ronda

1 (2026-10-05). Plan aprobado por el usuario (cita textual): "Apruebo el plan y sí a la prueba permanente".

### Ampliación aprobada por el usuario

A petición del usuario ("sí a la prueba permanente") se añadió en `restaurante/tests/unit/business-schedule.test.ts` la prueba "cambia exactamente a medianoche local (lunes 00:00 CDMX)": domingo 23:59:59 CDMX (`2026-10-12T05:59:59Z`) → `birria` y lunes 00:00:00 (`2026-10-12T06:00:00Z`) → `molotes`. Sigue el estilo de la prueba existente del sábado 00:00, no modifica aserciones existentes ni código de producción (+6 líneas). Resultado: `Tests 13 passed (13)` en ese archivo.

### Pruebas ejecutadas

Desde `restaurante/`, en la rama `feature/REQ-F-010-horarios-reales-molotes-birria`:

| Prueba | Resultado |
| --- | --- |
| `npm run build:css` | exit 0 |
| `npm run typecheck` (antes y después de la prueba nueva) | exit 0 / exit 0 |
| `npm run lint` (sin `lint:fix`) | exit 0, sin avisos / exit 0 |
| `npm test` antes de la prueba nueva | `Test Files 26 passed (26)`, `Tests 501 passed (501)` |
| `npm test` con la prueba nueva | `Test Files 26 passed (26)`, `Tests 502 passed (502)` |
| Servidor de la rama (puerto 3100) y de `main` en worktree temporal (puerto 3101), cada uno con una copia de `data/` en el scratchpad | `/`, `/molotes`, `/birria` → 200 |
| F-1/F-2: `grep -F` de cada texto del ticket sobre el HTML servido | 1 coincidencia por texto; filas de los pies en el orden esperado |
| F-3: horas visibles (`\d{1,2}:\d{2}` en el texto sin etiquetas) | Molotes: 08:30, 8:30, 15:00, 3:00. Birria: 08:00, 15:00, 03:00 |
| F-4: 11 cadenas antiguas en `src/content/` (todos los archivos), HTML de `/`, `/molotes`, `/birria` y `data/` | 0 coincidencias en todos |
| F-5: CA-4 independiente (4 variantes, con copia y restauración) | todas fallan (ver CA-4); restaurado, `shasum` de `src/`, `tests/` y README idéntico al inicio |
| F-6/N-2: script temporal con `createApp` + `now` inyectado, 12 instantes × `TZ` del proceso `America/Mexico_City`, `UTC` y `Asia/Tokyo` | 36/36 OK, 0 fallas |
| N-3: `getBusinessHours('tacos')` lanza; `BUSINESS_HOURS`, `.molotes` y `.days` congelados | true / true / true / true |
| R-1: `git diff main --word-diff -U0 -- tests/snapshots/` | solo textos de horario (18 cambios de palabra, todos horarios o la nota D-5) |
| R-2: `diff` del HTML servido `main` frente a rama + comparación quitando texto entre etiquetas | solo las líneas de horario; "molotes: marcado idéntico", "birria: marcado idéntico" |
| R-3: `git diff main --stat` de `src/views`, `src/services`, `src/config`, `public`, `_stich_source_` | vacío |
| R-4: consumidores de `src/content/hours.ts` | solo `business-hours.test.ts` y los `hours.ts` de cada negocio; no entra en el render |
| Navegador: Chrome sin interfaz aislado (perfil temporal) por CDP, 375×812, 768×1024, 1440×900 | ver Responsive, Accesibilidad y UX/UI |

### Criterios de aceptación

| CA | Resultado | Evidencia |
| --- | --- | --- |
| CA-1 | PASS | En `/molotes`: aviso D-7, "Martes a Viernes de 8:30 AM a 3:00 PM", nota D-5 completa. Pie en orden PT-1 A: Martes a Viernes / 08:30 - 15:00; Sábado y Domingo / Cerrado; Lunes / Cerrado por nixtamal. Solo horas 08:30/8:30 y 15:00/3:00. |
| CA-2 | PASS | En `/birria`: tarjeta 1 Sábado y Domingo / "08:00 AM – 03:00 PM" (guion U+2013 verificado con `od`) / nota conservada; tarjeta 2 Lunes a Viernes / Cerrado / "Reposo y Adobo.". Pie: Miércoles - Viernes: Cerrado; Sábados y Domingos: 08:00 - 15:00 (fila resaltada); Lunes y Martes: Reposo y Adobo. Solo horas 08:00 y 15:00/03:00. |
| CA-3 | PASS | 0 coincidencias de las 11 cadenas en `src/content/`, en el HTML de `/`, `/molotes`, `/birria` y en `data/`. |
| CA-4 | PASS | Prueba independiente de QA sobre `tests/unit/business-hours.test.ts`: (1) `closes` de Molotes a '16:00' → `4 failed | 24 passed`; (2) igual en Birria → `4 failed | 24 passed`; (3) fuente intacta y texto del pie de Molotes cambiado a "08:30 - 16:00" → `2 failed | 26 passed`; (4) añadir 'Mon' a Molotes → `4 failed | 24 passed`; (5) restaurado → `28 passed`. La prueba detecta la divergencia en ambos sentidos. |
| CA-5 | PASS | Lunes 10:00 CDMX y lunes 00:00 → Molotes con la fila Lunes / Cerrado por nixtamal; sábado → Birria. Además, en el servidor real el 2026-10-05 (lunes) `/` sirvió `data-business="molotes"` con "Cerrado por nixtamal". Las pruebas de selección existentes no cambiaron (solo se añadió la prueba aprobada). |
| CA-6 | PASS | Diff de snapshots y del HTML servido limitado a textos de horario; marcado idéntico; `src/views/` sin cambios. |
| CA-7 | PASS (local) | typecheck, lint y `npm test` (502/502) en verde. El CI del PR (`calidad` y `docker`) queda pendiente para T4. |

### Defectos encontrados

Ninguno.

Observaciones (no son defectos):

- **OBS-1 (aceptada, PT-1 A).** En el pie de Molotes, "Sábado y Domingo / Cerrado" se ve en dorado (`text-secondary font-medium`, rgb(255,196,114)), el estilo de las filas abiertas. Coincide con la decisión PT-1 A del usuario; "Lunes / Cerrado por nixtamal" queda en gris, igual que el diseño.
- **OBS-2 (preexistente).** En 375 px, "Martes a Viernes de 8:30 AM a 3:00 PM" ocupa 2 líneas y "PM" queda solo en la segunda. En `main` el texto anterior también ocupaba 2 líneas a ese ancho (medido con el mismo CSS); no hay desbordamiento.
- **OBS-3.** La nota de "Servicio y Domicilio" ocupa una línea más que en `main` (375 px: 3 → 4; 768 px: 1 → 2), por la frase de D-5. Se ajusta sin desbordar.

### Regresión

- HTML servido idéntico a `main` salvo los textos de horario (cabecera, SEO, CTA de WhatsApp, menú, formularios y pie sin cambios).
- Selección por día: 36/36 casos correctos (lunes a domingo, viernes 23:59:59 → sábado 00:00, domingo 23:59:59 → lunes 00:00, viernes y domingo 15:30), con el proceso en tres zonas horarias distintas.
- Suite completa en verde (502 pruebas).

### Responsive

Chrome sin interfaz por CDP, `/molotes` y `/birria` en 375×812, 768×1024 y 1440×900:

- `scrollWidth` igual al ancho del viewport en los 6 casos (sin overflow horizontal);
- ningún texto de horario desborda su contenedor ni sale del viewport;
- en los pies, días y horas no se solapan en ninguna fila;
- CTA de WhatsApp visible sin scroll en los 6 casos;
- altura del header de Molotes igual a `main` (117 px en 375, 113 px en 768): el aviso nuevo no cambia el layout;
- capturas revisadas de aviso, "Servicio y Domicilio", tarjetas de Birria y ambos pies (en el scratchpad de la sesión, `q2/shots/`).

### Accesibilidad

- Un solo `h1` en cada landing y viewport; jerarquía de encabezados sin cambios (marcado idéntico a `main`).
- Contraste calculado con los colores computados: todos los textos de horario superan 4.5:1. Mínimos: nota de Molotes 5.39:1 y fila "Lunes / Cerrado por nixtamal" 5.57:1; "Cerrado" dorado de Molotes 11.31:1; tarjetas de Birria ≥ 9.75:1; pie de Birria ≥ 7.6:1.
- El cierre se comunica con texto ("Cerrado", "Cerrado por nixtamal", "Reposo y Adobo"), no solo con color.

### UX/UI

- Pie de Molotes según PT-1 A: filas 1-2 en dorado, fila 3 (Lunes) en gris, igual que `_stich_source_/moloteando_aut_nticos_molotes_artesanales/code.html`.
- Pie de Birria: la fila resaltada (`font-bold text-amber-glow`) es "Sábados y Domingos: 08:00 - 15:00", es decir, la de los días abiertos, como en el diseño.
- Tipografía, colores y espaciado sin cambios (las clases son idénticas a `main`).

### Performance

Sin errores de consola en ninguna de las 6 cargas. El HTML solo cambia en texto, así que los recursos solicitados son los mismos. La fuente de horarios no se importa en el render.

### SEO

`title`, meta description, canonical y Open Graph idénticos a `main` (el diff del HTML servido no los toca).

### Pendientes de revisión manual

- La extensión Claude in Chrome no estaba conectada (3 intentos de `tabs_context_mcp`: "Browser extension is not connected"). Se aplicó la alternativa con Chrome sin interfaz por CDP (perfil temporal, sin dependencias nuevas), que sí dio capturas y mediciones. No queda ninguna validación visual imprescindible pendiente. Si el usuario quiere, puede mirar en su navegador las secciones de horario de `/molotes` y `/birria` en móvil.
- CI del PR (`calidad` y `docker`) en T4.

### Limpieza

Sondas de CA-4 revertidas (`shasum` idéntico al inicio). Servidores (3100, 3101) y Chrome sin interfaz (9333) detenidos; worktree temporal de `main` eliminado (`git worktree list` solo muestra el principal). `restaurante/data/` real sin modificar (0 archivos más nuevos que el inicio de QA). `git status` solo difiere del inicio por este ticket y por `tests/unit/business-schedule.test.ts` (prueba permanente aprobada).

### Resultado final

QA_APPROVED

## Historial de cambios

### Versión 1

Descripción inicial (2026-10-03). Aprobada por el usuario ("apruebo 010 y 009 con P-11 A"). Las propuestas P-1 a P-4 pasan a D-6 a D-9.

### Revisión técnica T1 (2026-10-04)

`senior-fullstack`: revisión técnica y Technical Action Plan en borrador. Estado `NEEDS_TECHNICAL_CLARIFICATION` por PT-1 (orden de la tabla del pie de Molotes frente al estilo por posición de la plantilla). Sin cambios de código.

### Aprobación del Technical Action Plan e inicio (2026-10-04)

El usuario elige PT-1 A y aprueba el plan (cita textual: "PT-1 A y apruebo el plan"). PT-1 A cambia el orden de filas de D-4. Rama `feature/REQ-F-010-horarios-reales-molotes-birria`; ticket movido a `in-progress/` con estado `IN_PROGRESS`.

### Implementación T2 (2026-10-04)

`senior-fullstack`: implementación del Technical Action Plan con PT-1 A. Fuente `src/content/<negocio>/hours.ts`, textos actualizados, prueba de coherencia, CA-1/2/3/5 en integración, snapshots regenerados (solo cambia el texto) y README. typecheck, lint, 501 pruebas y docker build en verde. Estado `NEEDS_IMPLEMENTATION_APPROVAL`. Sin commit.

### QA Q1 (2026-10-04)

`senior-qa`: el usuario aprueba la implementación (cita textual: "Apruebo la implementación"). Análisis del requisito, del diff frente a `main` y de `_stich_source_/`; QA Action Plan redactado. Estado `NEEDS_QA_PLAN_APPROVAL`. Sin cambios de código.

### QA Q2, ronda 1 (2026-10-05)

`senior-qa`: el usuario aprueba el QA Action Plan y la prueba permanente (cita textual: "Apruebo el plan y sí a la prueba permanente"). Ejecución completa; prueba de la transición domingo 23:59:59 → lunes 00:00 añadida a `tests/unit/business-schedule.test.ts`. CA-1 a CA-7 en PASS (CI pendiente para T4), sin defectos. Estado `QA_APPROVED`.

### Commit y Pull Request T4 (2026-10-05)

`senior-fullstack`: build:css, typecheck, lint y `npm test` (502/502) en verde sobre la rama, que parte de `main` (a6d8bbb). Commit `d101d22` con rutas explícitas, incluida la prueba permanente de QA. PR #21 (https://github.com/orvigas/negocio/pull/21) contra `main`. CI en verde: `calidad` y `docker` (run 37312057723) y GitGuardian. Estado `READY_FOR_MERGE`.

### Cierre T5 (2026-10-05)

El usuario confirma el merge del PR #21 (cita textual: "Hecho"), verificado con `gh` (MERGED el 2026-10-05T12:52:17Z, 06:52 hora de Ciudad de México). El commit de merge es `b5f60ef`. El CI del push a `main` de ese commit dio `calidad` y `docker` en verde (https://github.com/orvigas/negocio/actions/runs/37312547826). Se mueve el ticket a `done/` con estado `DONE`.
