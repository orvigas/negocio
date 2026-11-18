# REQ-F-048 — Auditoría de interfaces y navegación (landings y admin)

## Estado

DONE (2026-11-18)

- **Pull Request:** #178 (https://github.com/orvigas/negocio/pull/178), mergeado en `main` (`cebafed`, 2026-11-18 23:29:54Z).
- **Commit de la auditoría:** `03c773e`.
- **CA-8 sobre el commit real:** `git diff --name-only main...HEAD` da exactamente 18 archivos: el informe, las 16 capturas y este ticket.
- **Despliegue (DT-1 A):** la ejecución del CI de `main` sobre `cebafed` (https://github.com/orvigas/negocio/actions/runs/44421245636) terminó en `success`, con `publish`, `vigente` y `deploy` en `success`. Producción quedó sana: las landings responden 200, el admin redirige a `/acceso`, y `app`, `api` e `inventory-manager` están `healthy`.

## Seguimiento

Este ticket solo entrega el informe (`restaurante/docs/auditoria-interfaces.md`) y sus 16 capturas: no corrige ningún hallazgo. Los 21 hallazgos (AUD-001 a AUD-021) siguen abiertos y están todos asignados a algún derivado propuesto.

Decisiones pendientes del usuario (§10 del informe):

- **D2, contradicciones con el diseño fuente:**
  - **C1, navegación móvil de las landings (AUD-005):** ¿se amplía `_stich_source_` con una navegación móvil diseñada con Stitch (menú plegable, barra de anclas bajo la cabecera) o se queda como está?
  - **C2, contrastes del diseño fuente (AUD-001 a AUD-004):** ¿se corrigen, y con qué opción (texto oscuro o verde más oscuro en WhatsApp; capa o fondo más oscuro en el hero de Molotes; `DESIGN.md` o `code.html` en AUD-003)?
  - **Admin (AUD-006, AUD-015 y AUD-021):** ¿se diseña el patrón móvil con Stitch (D4) y se aparta del "zero outer fuzzy halo" del `DESIGN.md` para que el foco de los campos se vea?
  - **CTA flotante (AUD-007):** ¿basta con el espacio reservado o también se oculta mientras se ve el CTA del hero?
  - **Hallazgos Baja del diseño fuente (AUD-011 a AUD-014, AUD-018 y AUD-019):** ¿cuáles se aprueban? AUD-018 exige autorizar cambios en `_stich_source_`.
  - **Derivado C (AUD-016 y AUD-017):** ¿se crea?
- **D3, partición final en tickets derivados.**

Propuesta de tickets derivados (§11 del informe). **No se abre ninguno:** se abrirán cuando el usuario decida D2 y D3.

| Ticket | Alcance | Hallazgos | Depende de |
| --- | --- | --- | --- |
| **A: admin** | Patrón móvil de la cabecera y de la navegación por negocio, nombre largo y foco visible en los campos | AUD-006, AUD-015 y AUD-021 | Diseño con Stitch aprobado (D4) |
| **B1: landings sin tocar el diseño fuente** | Espacio para el CTA flotante, fondo fijo con el aviso abierto, texto del aviso de `/`, mapas sin trampa de tabulación, foco tras enviar el club y campo del club de Birria; además, llevar el foco a `main` al cerrar un aviso | AUD-007, AUD-008, AUD-009, AUD-010, AUD-019 y AUD-020 | Nada (puede empezar en cuanto el usuario lo pida) |
| **B2: landings con diseño fuente** | Contrastes y navegación móvil, solo lo que el usuario apruebe | AUD-001 a AUD-005 y AUD-011 a AUD-014 | D2 (C1, C2 y los Baja); Stitch para la navegación móvil |
| **C: colores a tokens (opcional)** | Pasar los hexadecimales sueltos de las plantillas a tokens del `@theme`, sin cambio visual | AUD-016 y AUD-017 | Decisión sobre el derivado C |
| **D: referencias de `_stich_source_` (opcional)** | Volver a exportar las capturas de referencia del diseño fuente | AUD-018 | Autorización sobre `_stich_source_`; conviene antes de B2 |

No hecho (fuera de este ticket):

- **Dos estados sin probar (§8 del informe):** el estado "vacío" de las landings (exige borrar productos) y el estado "parcial" de la pantalla "Bot" del admin (exige tirar MySQL con la `api` en marcha). No se fabricó evidencia.
- **Contraste del indicador de foco fuera del admin:** solo se midió el de los campos del admin (AUD-021). El del resto de indicadores (en las landings, el `outline: auto` del navegador) queda sin medir y declarado en "Límites" del informe.
- **Otros límites del método (§2 del informe):** sin lector de pantalla real; zoom, táctil y orientación emulados; sin auditar 1.4.12 ni 2.5.3.
- **Puerto del webhook de la `api`:** se abre aunque el bot esté desactivado y responde 503, como documenta `docs/desarrollo.md`. No es un hallazgo de interfaz; no requiere acción.

## Aprobación

Aprobado por el usuario (versión 1, fecha 2026-11-18). Cita textual: "Sí, valido con tus recomendaciones".

## Objetivo

Mejorar la calidad de uso de las interfaces existentes (menús, navegación, foco, contraste, objetivos táctiles y estados) de las landings y del admin. Se hace en dos tiempos:

1. **Este ticket (REQ-F-048):** una auditoría con evidencia, solo de lectura, cuyo resultado es un informe con hallazgos priorizados que incluye la navegación móvil de landings y admin.
2. **Tickets derivados (REQ-F-049 y siguientes):** el rediseño y la implementación de los hallazgos que el usuario apruebe del informe.

## Hechos observados en el repositorio (pendientes de verificar en el navegador)

| ID | Hecho | Evidencia en el repositorio | Estado |
| --- | --- | --- | --- |
| H1 | Las landings no tienen navegación entre secciones por debajo de 1024 px: no hay botón de menú, `aria-expanded` ni `<details>`. Por debajo de `lg` quedan el CTA de WhatsApp de la cabecera, el CTA flotante y, al menos en Molotes, la navegación del pie. | `restaurante/landing-pages/src/views/pages/birria.html:15` y `molotes.html:13` (`<nav class="site-nav hidden … lg:flex">`); `molotes.html:331` (navegación del pie). | Pendiente de verificar en el navegador |
| H2 | El diseño fuente móvil tampoco define navegación móvil: la implementación actual es fiel al diseño. Que no haya menú móvil es un hueco del diseño, no un defecto de implementación. | `_stich_source_/birrier_a_el_mu_eco_m_vil_optimizado/code.html:6` y `_stich_source_/moloteando_m_vil_optimizado/code.html:4` (`<nav class="hidden lg:flex">`, sin botón de menú). | Pendiente de verificar contra `screen.png` y en el navegador |
| H3 | Los colores hex sueltos de las landings (p. ej. `bg-[#490808]`, `bg-[#25D366]`) vienen de los `code.html` de Stitch. Pasarlos a tokens es mantenimiento, no corrección visual. | `restaurante/landing-pages/src/views/pages/*.html` y `_stich_source_/*/code.html`. | Pendiente de cuantificar en la auditoría |
| H4 | La cabecera del admin no tiene un patrón móvil propio: marca, navegación "Secciones" (`ul flex flex-wrap`), usuario, "Mi cuenta" y "Salir" (estos dos con `min-h-11`) y una segunda barra por negocio (Productos, Página y Cotizador; este solo para administradores y en Birria). En móvil la cabecera solo se reparte en varias líneas con flex-wrap. Su sistema visual sale de `_stich_source_/birrier_a_el_mu_eco/DESIGN.md`, con tokens. | `restaurante/inventory-manager/src/views/partials/header.html`; `header()` y `businessNav()` en `restaurante/inventory-manager/src/views/index.ts`. | Pendiente de verificar en el navegador |

## Contradicciones (pendientes de verificar en el navegador)

### C1 — Diseño fuente frente a la navegación móvil

- **Conflicto:** `.claude/CLAUDE.md` §3 da prioridad a `_stich_source_`, que no tiene menú móvil (H2). En cambio, `.claude/rules/diseno-responsivo.md` y `accesibilidad.md` piden una experiencia mobile-first navegable.
- **Impacto:** si la auditoría lo trata como defecto y se corrige sin más, se rompe la regla del diseño fuente.
- **Decisión requerida:** D2. El usuario decide si se amplía `_stich_source_` con una navegación móvil en las landings.

### C2 — Posibles contrastes del diseño fuente por debajo de WCAG AA

- **Conflicto:** el diseño fuente frente a `accesibilidad.md` ("contraste suficiente").
- **Hipótesis a medir:** el texto blanco sobre `#25D366` de los CTA de WhatsApp tiene, según una estimación, un contraste de unos 2:1, por debajo del 4.5:1 de AA.
- **Impacto:** corregirlo puede cambiar la identidad visual.
- **Decisión requerida:** D2. Cada hallazgo de este tipo indica si su origen es el diseño fuente o la implementación.

## Alcance

### Superficies

- **Landings:** `/`, `/birria` y `/molotes`, con sus avisos "Descanso", "Molotes" y "Hoy toca birria" (REQ-F-028 y REQ-F-034).
  - Los avisos se capturan con los medios que ya existen, por ejemplo `BUSINESS_TIMEZONE` o el día real.
  - Los avisos que no se puedan forzar se declaran en el informe.
- **Admin (`inventory-manager`):**
  - inicio de sesión;
  - lista de productos por negocio;
  - alta y edición de producto;
  - "Página";
  - "Usuarios" (lista y formulario);
  - "Mi cuenta";
  - "Bot";
  - "Cotizador";
  - páginas de error: 404 y API no disponible.
  - Se revisa con dos roles, administrador y no administrador, porque cambian la navegación.

### Anchos

- Todas las superficies: 375, 768 y 1440 px.
- Solo la navegación de las landings: también 1024 px, el umbral `lg` donde aparece o desaparece. El admin no se audita en 1024 px (D1b).

### Dimensiones a revisar

- navegación y menús, incluida la navegación móvil;
- teclado: orden de tabulación, trampas de foco en los avisos, salto al contenido;
- foco visible;
- contraste del texto y de los componentes no textuales;
- tamaño de los objetivos táctiles: como mínimo 24 × 24 px (WCAG 2.2 AA) y 44 px como recomendación;
- estados: hover, focus, active, `aria-current`, deshabilitado, error, vacío y cargando;
- jerarquía de encabezados y landmarks;
- desbordes horizontales y textos cortados;
- zoom al 200 %;
- sin JavaScript (solo en las landings y sus avisos);
- consistencia del sistema visual con `_stich_source_`:
  - en el admin, frente a `birrier_a_el_mu_eco/DESIGN.md`;
  - en las landings, frente a los `code.html` y `screen.png` de escritorio y móvil.

### Entregable

- **Informe:** `restaurante/docs/auditoria-interfaces.md`, con:
  - método y entorno: navegador, versión y fecha;
  - inventario de las pantallas revisadas;
  - la escala de severidad (Crítica, Alta, Media, Baja) definida en el propio informe;
  - hallazgos, cada uno con:
    - ID (`AUD-001`, `AUD-002`…);
    - superficie y ruta;
    - ancho o dispositivo;
    - descripción observable;
    - evidencia: captura y, cuando aplique, medición (ratio de contraste o tamaño en px);
    - criterio incumplido (WCAG 2.2 o regla del proyecto);
    - origen: `implementación` o `diseño fuente`;
    - severidad;
    - recomendación;
    - si requiere una decisión sobre `_stich_source_` o un diseño con Stitch;
  - la lista de decisiones que debe tomar el usuario;
  - la propuesta de tickets derivados, con los hallazgos que agrupa cada uno.
- **Capturas:** en `restaurante/docs/auditoria-interfaces/` van solo las que respalden un hallazgo, comprimidas. El resto se queda fuera del repositorio (D1).

## Fuera de alcance

- Cualquier cambio de código, estilos, plantillas, contenido o configuración.
- Cambios en `_stich_source_` y diseño con Stitch: la auditoría puede recomendarlos, pero no los genera.
- El bot de WhatsApp, la API, la base de datos, la seguridad y el rendimiento del servidor.
- Funcionalidades nuevas y dependencias nuevas, incluidas herramientas de auditoría añadidas a `package.json`.
- Una auditoría completa de SEO. Solo se anota lo que se cruce con la estructura de encabezados.
- La implementación de los hallazgos, que va en los tickets derivados (D0).

## Reglas de negocio

- **RN-1.** La auditoría solo lee: el PR de REQ-F-048 no modifica nada fuera del informe y de sus capturas.
- **RN-2.** Cada hallazgo tiene evidencia reproducible: no hay hallazgos sin captura o medición.
- **RN-3.** Un hallazgo cuyo origen sea el diseño fuente de las landings no se implementa sin una decisión expresa del usuario sobre `_stich_source_`.
- **RN-4.** Admin y Stitch:
  - lo que no tenga una definición equivalente en `_stich_source_` se diseña con Stitch y se presenta al usuario antes de implementarlo;
  - lo aprobado se guarda en `_stich_source_` solo con su autorización (`.claude/rules/stitch-diseno.md`).
- **RN-5.** Ningún cambio derivado altera el contenido, los datos ni el comportamiento funcional: pedidos por WhatsApp, avisos del día, permisos por rol, formularios y CSRF.
- **RN-6.** La auditoría deja el entorno limpio: sin procesos, puertos, pestañas ni bases `restaurante_test*` remanentes (`.claude/rules/testing.md`, "Limpieza al terminar").

## Historias de usuario

- **HU-1.** Como cliente en el móvil, quiero llegar rápido al menú, a las ubicaciones y al pedido para pedir sin buscar.
  - Sus criterios de implementación irán en los derivados; esta auditoría documenta la situación actual (H1).
- **HU-2.** Como usuario de teclado o de lector de pantalla, quiero navegar las landings y el admin con foco visible y en un orden lógico.
- **HU-3.** Como encargado que usa el admin en el teléfono, quiero una cabecera y una navegación por negocio usables a 375 px.
- **HU-4.** Como dueño del negocio, quiero un informe priorizado para decidir qué se mejora y en qué orden.

## Criterios de aceptación

- **CA-1.** El informe cubre todas las superficies del alcance en 375, 768 y 1440 px, y la navegación de las landings en 1024 px. Si falta alguna superficie, declara por qué (p. ej. un aviso que no se pudo forzar).
- **CA-2.** La navegación móvil de las landings y la del admin tienen al menos una entrada cada una. Cada entrada describe qué puede hacer el usuario a 375 px para ir a cada sección, con captura, e indica su origen (H2).
- **CA-3.** Hay un recorrido con teclado de cada superficie que documenta:
  - el orden de foco;
  - el foco visible;
  - el comportamiento de los avisos: cómo se abren, el cierre con `Esc` y con el botón, y adónde vuelve el foco.
- **CA-4.** Cada problema de contraste reportado incluye los dos colores y el ratio medido.
- **CA-5.** Cada problema de objetivo táctil reportado incluye el tamaño medido en px.
- **CA-6.** Cada hallazgo tiene ID, severidad, origen, criterio incumplido, evidencia y recomendación.
- **CA-7.** El informe termina con la lista de decisiones que debe tomar el usuario y con la propuesta de tickets derivados, con los hallazgos que agrupa cada uno.
- **CA-8.** El `git diff` del PR de auditoría contiene solo `restaurante/docs/auditoria-interfaces.md` y las capturas de `restaurante/docs/auditoria-interfaces/`. No toca ningún archivo de `src/`, `public/`, `_stich_source_/` ni de configuración.
- **CA-9.** El resultado del ticket incluye la evidencia de limpieza del entorno.

## Casos límite

- 1024 px exactos, el umbral `lg` de la navegación de las landings.
- Avisos abiertos en el móvil: si tapan el CTA y si el contenido de detrás se puede desplazar.
- Landings sin JavaScript.
- Zoom al 200 %.
- Orientación horizontal en el móvil.
- El CTA flotante solapando contenido o el pie.
- En el admin:
  - nombres de usuario largos;
  - la cabecera de administrador con todos los enlaces a 375 px;
  - la API caída (la página va sin cabecera).

## Dependencias

- El entorno local levantado (`npm run db:up` y las tres apps) con datos semilla.
- Las skills `design-system`, `accessibility` y `browser-qa` (`.claude/skills/`) y, como apoyo, el agente `a11y-architect`.
- Un navegador controlable por automatización que ya esté disponible en la máquina, sin añadir dependencias al proyecto.

## Riesgos

- **R1.** Confundir "fiel al diseño" con "correcto". Se mitiga con el campo origen (RN-3).
- **R2.** Que las capturas pesen demasiado en el repositorio. Se mitiga guardando solo las que respaldan un hallazgo, comprimidas (D1).
- **R3.** Que corregir los contrastes del diseño fuente cambie la identidad visual (C2).
- **R4.** Un menú móvil en las landings añade JavaScript y estados nuevos. Se valorará en el derivado B.
- **R5.** Pasar los colores hex a tokens puede causar regresiones visuales sutiles (derivado C).

## Partición propuesta

- **REQ-F-048 (este ticket):** un PR solo con el informe y sus capturas. QA comprueba CA-1 a CA-9; no hay código que probar.
- **Derivado A (admin):**
  - alcance: cabecera y navegación móvil, foco, objetivos y estados;
  - diseño con Stitch donde falte definición, aprobado antes de implementar;
  - uno o varios PR.
- **Derivado B (landings):**
  - las correcciones dentro de `_stich_source_` (foco, objetivos, estados de implementación);
  - solo si el usuario lo aprueba: ampliar el diseño con navegación móvil o ajustar contrastes.
- **Derivado C (opcional, mantenimiento):** pasar a tokens los colores sueltos de las landings sin cambio visual. Solo si el usuario lo prioriza.

La partición final de los derivados se decide en D3, a la vista del informe.

## Action Plan

### Objetivo

Un informe de auditoría con evidencia y hallazgos priorizados de las interfaces de las landings y del admin, que incluya su navegación móvil.

### Alcance

El de la sección "Alcance".

### Fuera de alcance

El de la sección "Fuera de alcance".

### Cambios requeridos

1. Inventariar las pantallas, rutas y roles del alcance.
2. Levantar el entorno local con datos semilla.
3. Capturar cada superficie en 375, 768 y 1440 px, y la navegación de las landings también en 1024 px.
4. Hacer el recorrido con teclado: orden, foco visible y avisos.
5. Medir los contrastes y los objetivos táctiles.
6. Revisar estados, landmarks y encabezados, el zoom al 200 % y las landings sin JavaScript.
7. Comparar con `_stich_source_` (escritorio y móvil) y con el `DESIGN.md` del admin, verificar H1 a H4, C1 y C2, y clasificar el origen de cada hallazgo.
8. Redactar `restaurante/docs/auditoria-interfaces.md` con severidades, recomendaciones, decisiones pendientes y la propuesta de derivados. Guardar en `restaurante/docs/auditoria-interfaces/` solo las capturas que respalden un hallazgo, comprimidas.
9. Abrir el PR solo con el informe y sus capturas.
10. Limpiar el entorno y dejar la evidencia en el ticket.

### Reglas de negocio

RN-1 a RN-6.

### UX/UI

No hay cambios: solo diagnóstico.

### Integraciones

Ninguna. Stitch no se usa en esta fase.

### Casos límite

Los de la sección "Casos límite".

### Criterios de aceptación

CA-1 a CA-9.

### Dependencias

Las de la sección "Dependencias".

### Riesgos

R1 a R5.

### Orden recomendado

1. La navegación móvil del admin y de las landings a 375 px, que es el riesgo mayor.
2. Teclado y foco.
3. Contraste y objetivos táctiles.
4. El resto de anchos y la comparación con el diseño fuente.

### Resultado esperado

Un informe aprobado por el usuario que sirva de entrada a los tickets derivados.

## Decisiones

### Resueltas (versión 1)

- **D0.** La implementación va en tickets derivados (REQ-F-049 y siguientes); REQ-F-048 es solo la auditoría.
- **D1.** El informe va en `restaurante/docs/auditoria-interfaces.md`. En `restaurante/docs/auditoria-interfaces/` van solo las capturas que respalden un hallazgo, comprimidas; el resto, fuera del repositorio.
- **D1b.** 1024 px se audita solo en las landings.

### Pendientes

| ID | Decisión | Cuándo |
| --- | --- | --- |
| D2 | Qué hallazgos se aprueban y con qué prioridad. Incluye ampliar o no `_stich_source_` con navegación móvil en las landings (C1), qué hacer con los contrastes del diseño fuente (C2) y si se crea el derivado C. | Al revisar el informe de la auditoría |
| D3 | La partición final en tickets derivados. | Al revisar el informe de la auditoría |
| D4 | Aprobar las propuestas de Stitch del admin antes de implementarlas y autorizar que se guarden en `_stich_source_`. | En el derivado A |
| D5 | Aprobar expresamente cualquier cambio sobre el diseño fuente de las landings. | En el derivado B |

## Trazabilidad

| Objetivo | Historia | Criterios | Diseño/UI | Action Plan |
| --- | --- | --- | --- | --- |
| Navegación móvil usable | HU-1, HU-3 | CA-1, CA-2 | H1, H2, H4, C1; diseños móviles de `_stich_source_` y `DESIGN.md` del admin | Pasos 3 y 7 |
| Accesibilidad con teclado y foco | HU-2 | CA-3 | Avisos de REQ-F-028 y REQ-F-034 | Paso 4 |
| Contraste y objetivos táctiles | HU-2, HU-3 | CA-4, CA-5 | C2 | Paso 5 |
| Decisión informada del negocio | HU-4 | CA-6, CA-7 | H3, partición A/B/C | Pasos 7 y 8 |
| Auditoría solo de lectura y entorno limpio | — | CA-8, CA-9 | — | Pasos 9 y 10 |

## Revisión técnica

Revisión de `senior-fullstack` (2026-11-18), sin cambios de código. Fuentes: el ticket, `.claude/CLAUDE.md`, `.claude/rules/`, las skills `accessibility`, `browser-qa`, `design-system` y `frontend-design-direction` (con `scripts/check-evidence.js` y `references/`), el agente `a11y-architect`, CodeGraph (rutas y vistas de `inventory-manager`, controlador de las landings, `home-notice.js`), `restaurante/docs/desarrollo.md`, `restaurante/README.md` ("Administración", "Diferencias deliberadas con el diseño fuente"), `compose.yaml`, `docker/mysql/initdb/01-usuarios.sh`, `.github/workflows/ci.yml` y `deploy/deploy.sh`. NotebookLM no estaba disponible en la sesión (sin herramientas MCP `notebooklm` expuestas): no se consultó.

El requisito es viable sin cambios de alcance. Hallazgos que el plan resuelve o que necesitan una confirmación del usuario:

| ID | Hallazgo | Evidencia | Tratamiento |
| --- | --- | --- | --- |
| RT-1 | **Las capturas de `restaurante/docs/auditoria-interfaces/` cuentan como código para el CI.** El job `cambios` solo trata como documentación `.claude/*`, `restaurante/docs/*.md` y los `*.md` de fuera de `restaurante/`; un `.jpg` o `.png` bajo `restaurante/` da `codigo=true`. Consecuencias: el PR corre el CI completo (`calidad`, `pruebas`, `docker`, `auditoria`) y, **al mergearlo a `main`, `publish` y `deploy` publican y despliegan en producción** imágenes con el mismo código (la etiqueta `revision` cambia el digest y `deploy.sh` recrea los contenedores). Reiniciar la `api` cierra las sesiones del admin y borra las conversaciones del bot en curso (están en memoria). | `.github/workflows/ci.yml:131-143` y `:578-590`; `restaurante/deploy/deploy.sh:7-18`; `restaurante/docs/desarrollo.md:173-174`. | Decisión **DT-1** (abajo). Recomendación: mantener D1 y CA-8 tal como se aprobaron y hacer el merge fuera del horario de servicio (por ejemplo, un lunes). |
| RT-2 | **CA-8 y el archivo del ticket.** El proceso (`.claude/CLAUDE.md` §4 y `.claude/agents/senior-fullstack.md`, T2 y T4) exige que el ticket viaje en la rama: `.claude/docs/in-progress/REQ-F-048-auditoria-interfaces-navegacion.md` estará en el diff del PR. | `.claude/agents/senior-fullstack.md` (T2 paso 3, T4 pasos 3 y 9). | CA-8 se comprueba como "solo el informe, sus capturas y el propio ticket en `.claude/docs/`". El ticket es trazabilidad del proceso, no un cambio del producto. Lo confirma el usuario al aprobar el plan (DT-1b). |
| RT-3 | **El ticket no está versionado.** Hoy es un archivo sin seguimiento en `main` (`?? .claude/docs/backlog/…`), así que `git mv` falla. | `git status`. | En T2 se mueve con `mv` (no `git mv`) a `in-progress/`; entra en el repositorio con el commit de T4. |
| RT-4 | **Los tres avisos se pueden forzar sin tocar el reloj.** Con `NODE_ENV=development`, `?dia=lunes…domingo` fuerza el día del aviso en `/` y en `/molotes` (`parseForcedDay` en `createLandingController`). No hay avisos que declarar como no forzables. El día real (hoy, miércoles) se captura una vez sin el parámetro. | `restaurante/landing-pages/src/controllers/landing.ts:68-69`; `restaurante/docs/desarrollo.md:168`. | Se usa `?dia=` en sesiones de navegador nuevas (el aviso sale una vez por sesión: `sessionStorage`, `home-notice.js`). |
| RT-5 | **Los `.env` locales del desarrollador tienen el bot configurado** (variables `WHATSAPP_BOT_*` definidas en `api/.env` y en `landing-pages/.env`) y la base de desarrollo puede tener usuarios y bloqueos reales. Auditar con ellos mostraría datos que no deben salir en capturas y mezclaría la auditoría con datos de desarrollo. | Nombres de las variables (sin leer sus valores) de `restaurante/{api,landing-pages,inventory-manager}/.env`. | El plan no usa esos `.env` ni la base `restaurante` del volumen de desarrollo: un MySQL desechable en un proyecto de Compose aparte y archivos de entorno propios en el scratchpad (§1 del plan). |
| RT-6 | **Diferencias deliberadas con el diseño fuente.** El README documenta las diferencias aprobadas (plataformas, mapa embebido, skip link, contrastes de Moloteando ya oscurecidos, etc.). | `restaurante/README.md` ("Diferencias deliberadas con el diseño fuente"). | No se reportan como hallazgo salvo que incumplan un criterio. En ese caso el origen es `implementación`, con una nota sobre la diferencia aprobada. |
| RT-7 | **`check-evidence.js` es CommonJS.** Funciona con `node` porque no hay ningún `package.json` en la raíz del repositorio ni en `.claude/`. Exige que los artefactos estén dentro de la carpeta del registro JSON. | `.claude/skills/frontend-design-direction/scripts/check-evidence.js`. | El registro JSON y sus capturas van juntos en el scratchpad; nunca en el repositorio. |

## Technical Action Plan

### Objetivo técnico

Producir `restaurante/docs/auditoria-interfaces.md` y, en `restaurante/docs/auditoria-interfaces/`, solo las capturas que respaldan un hallazgo. Todo con evidencia reproducible, obtenida en un entorno local aislado y desechable, sin tocar código, configuración, `_stich_source_/`, la base de desarrollo ni producción, y dejando el entorno como estaba (RN-1, RN-2, RN-6).

### Archivos o componentes afectados

- **Nuevos en el repositorio (rama `feature/REQ-F-048-auditoria-interfaces-navegacion`):**
  - `restaurante/docs/auditoria-interfaces.md`;
  - `restaurante/docs/auditoria-interfaces/AUD-NNN-<slug>.jpg`, solo las que respalden un hallazgo;
  - el ticket, movido a `.claude/docs/in-progress/` (RT-2 y RT-3).
- **Solo lectura:**
  - `restaurante/landing-pages/src/views/**` y `public/js/**`, `restaurante/inventory-manager/src/views/**` y `public/js/**`, y sus `src/styles/`;
  - `_stich_source_/`: escritorio en `birrier_a_el_mu_eco_aut_ntica_birria_de_res_color_adobo/` y `moloteando_aut_nticos_molotes_artesanales/`; móvil en `birrier_a_el_mu_eco_m_vil_optimizado/` y `moloteando_m_vil_optimizado/`; sistemas en `birrier_a_el_mu_eco/DESIGN.md`, `birria_tradicional_jalisciense/DESIGN.md` y `moloteando_tradicional/DESIGN.md`.
- **Fuera del repositorio:** todo lo demás, en el scratchpad de la sesión de T2 (`/private/tmp/claude-501/<proyecto>/<sesión>/scratchpad/req-f-048/`, en adelante `<S>`): archivos de entorno, credenciales de prueba, perfil de Chrome, script CDP, capturas en bruto, mediciones (JSON) y registros de evidencia.

### 1. Entorno local aislado (cómo se levanta sin tocar producción ni la base de desarrollo)

Desde `restaurante/`. Ninguna orden apunta a producción. No se usan los `.env` del desarrollador (RT-5) ni el volumen `restaurante_mysql-dev-data`.

1. **Estado inicial** (se anota en `<S>/estado-inicial.txt` para restaurarlo después):
   - `docker compose ps`: si `mysql-dev` corre o no;
   - `docker volume ls`;
   - `lsof -nP -iTCP -sTCP:LISTEN` filtrado a 3000-3004, 3307 y 9222;
   - `git status --short` y `git worktree list`.
2. **MySQL desechable** en un proyecto de Compose aparte: mismo `compose.yaml`, volumen propio `restaurante-auditoria_mysql-dev-data`.
   - Si `mysql-dev` de desarrollo está en marcha, `npm run db:down` primero: los dos publican `127.0.0.1:3307`. Hoy está parado.
   - `docker compose -p restaurante-auditoria up -d --wait mysql-dev`: el initdb crea la base `restaurante` y los usuarios con las contraseñas de desarrollo por defecto, documentadas en `compose.yaml` y no secretas. No se exporta ninguna `RESTAURANTE_DB_*`.
   - `MIGRATION_DATABASE_URL=mysql://restaurante_migrator:migrator-dev@127.0.0.1:3307/restaurante npm run db:migrate`. La variable del entorno prevalece sobre `packages/db/.env`.
   - Antes de migrar, se comprueba con `docker compose -p restaurante-auditoria ps` que el 3307 es el contenedor de la auditoría.
3. **Cliente y CSS:** `npm run db:generate` si falta el cliente y `npm run build:css`. El CSS generado está en `.gitignore` (`landing-pages/.gitignore` e `inventory-manager/.gitignore`): no entra en el diff.
4. **Primer administrador sin inventar credenciales** (mecanismo documentado en `docs/desarrollo.md` §3 y README "Usuarios"):
   - contraseña aleatoria con `openssl rand -base64 24`, guardada solo en `<S>/credenciales` (`chmod 600`);
   - hash con `npm run -s admin:hash-password` leyendo la contraseña por stdin (sin TTY no pide confirmación: `api/scripts/hash-password.ts:20`), escrito directamente en el archivo de entorno de la `api` como `ADMIN_PASSWORD_HASH='scrypt$…'`, con `ADMIN_USER=auditoria-admin`;
   - nunca se imprimen la contraseña ni el hash.
5. **Archivos de entorno propios** (`<S>/env/{api,landing,inventory}.env`, solo con los valores de los `.env.example`):
   - **api:** `NODE_ENV=development`, `HOST=127.0.0.1`, `PORT=3001`, `DATABASE_URL=mysql://restaurante_app:app-dev@127.0.0.1:3307/restaurante`, `ADMIN_USER`, `ADMIN_PASSWORD_HASH` y `BUSINESS_TIMEZONE=America/Mexico_City`. Sin ninguna `WHATSAPP_BOT_*`: el bot queda desactivado, sin números ni tokens.
   - **landing:** `NODE_ENV=development`, `PORT=3000`, `BUSINESS_TIMEZONE=America/Mexico_City`, `TRUST_PROXY=false`, `API_INTERNAL_URL=http://127.0.0.1:3001` y `WHATSAPP_MOLOTES`/`WHATSAPP_BIRRIA` con números ficticios válidos (solo dígitos, p. ej. `520000000001`). Sin `ADMIN_NEW_URL`, `INTERNAL_PORT` ni `INTERNAL_NOTIFY_TOKEN`: son opcionales en desarrollo y la landing ve los cambios en 60 s como mucho.
   - **inventory:** `NODE_ENV=development`, `HOST=127.0.0.1`, `PORT=3003`, `API_INTERNAL_URL=http://127.0.0.1:3001` y `TRUST_PROXY=false`.
6. **Arranque sin los `.env` del repositorio**, en segundo plano, cada uno desde su workspace y con su PID guardado en `<S>/pids`:
   - `cd api && node --env-file=<S>/env/api.env scripts/dev-server.ts`;
   - lo mismo para `landing-pages` e `inventory-manager`.
   - `scripts/dev-server.ts` fija `NODE_ENV=development`, que habilita `?dia=`. Sin `--watch`: no hay código que recargar.
   - En la primera arrancada, la `api` siembra la página y los productos (logs `page_seeded` y `products_imported`) y crea `auditoria-admin`.
   - Puertos: `api` 3001, landings 3000 y admin 3003, todos en `127.0.0.1`. Se comprueba que el webhook (3004) no escucha: sin bot no debe abrirse.
7. **Usuario no administrador:** desde el propio admin, como `auditoria-admin`, "Usuarios → Nuevo":
   - `auditoria-editor`, rol editor, solo con **Molotes**, para ver que sin Birria no aparecen ni Birria ni "Cotizador";
   - nombre visible de 60 caracteres (el máximo), para el caso "nombres de usuario largos";
   - contraseña aleatoria en `<S>/credenciales`.
   - Es una escritura, pero solo en la base desechable; es también la evidencia del estado "éxito" del formulario de usuarios.
8. **Datos para los estados:** todo en la base desechable y solo lo necesario.
   - **Error:** enviar vacío el formulario de producto y el de usuario.
   - **Éxito:** guardar la edición de un producto de la semilla y crear el editor.
   - **Vacío:** "Productos eliminados" sin elementos y las listas del bot sin elementos.
   - **Permiso:** el editor en `/usuarios` y en `/birria/productos`.
   - **Parcial:** las landings con la `api` parada sirven la semilla (`landing_products_fallback`).
   - **API caída:** con la `api` parada, el admin responde 503 sin cabecera.
   - El límite de intentos de acceso (429) existe: como mucho, unos pocos inicios de sesión.
9. **Cómo se fuerza cada caso:**

| Caso | Cómo |
| --- | --- |
| Aviso "Descanso" en `/` y en `/molotes` | `?dia=lunes`, cada uno en una sesión nueva (la marca `homeNotice:rest:seen` es compartida) |
| Aviso "Molotes" en `/` | `?dia=martes`, y una vez sin parámetro: el día real, miércoles 2026-11-18 |
| Aviso "Hoy toca birria" en `/molotes` | `?dia=sabado` |
| `/birria` sin aviso | Sin parámetro y con `?dia=lunes` (debe seguir sin aviso) |
| Umbral `lg` | 1023 y 1024 px de ancho en `/birria` y `/molotes` |
| Sin JavaScript | `Emulation.setScriptExecutionDisabled` (CDP) en `/`, `/molotes?dia=sabado` y `/birria` a 375 px: el `<dialog>` cerrado no debe tapar nada |
| Zoom al 200 % | Equivalencia CSS: viewport de 640 × 400 con `deviceScaleFactor: 2`, lo mismo que una ventana de 1280 px al 200 %, y además el reflow de WCAG 1.4.10 a 320 px de ancho. Se declara el método en el informe |
| Horizontal | 812 × 375 con `mobile: true` y táctil emulado |
| CTA flotante sobre el pie | 375 px, desplazado al final de cada landing: captura y `getBoundingClientRect` del CTA frente al pie y a sus enlaces |
| Aviso abierto en móvil | 375 px: si tapa el CTA y si el fondo se desplaza (`scrollY` antes y después de un `mouseWheel` sintético) |
| Admin con la API caída | Se mata el proceso de la `api` y se piden `/acceso`, `/molotes/productos` y `/usuarios` a 375, 768 y 1440. Después se vuelve a arrancar la `api` (las sesiones se pierden: hay que volver a entrar) |
| 404 del admin | `/no-existe` con sesión y sin sesión |

### 2. Herramienta de navegador, capturas y mediciones

- **Herramienta principal (DT-2): Chrome 157 ya instalado (`/Applications/Google Chrome.app`), en modo headless, controlado por CDP desde un script desechable de Node 24 en `<S>/cdp.mjs`.**
  - Usa el `WebSocket` nativo de Node: sin Puppeteer, Playwright ni axe-core, sin `npm install` y sin tocar ningún `package.json`.
  - Se lanza con `--headless=new --user-data-dir=<S>/chrome-profile --remote-debugging-port=9222 --no-first-run`. El perfil es nuevo y no comparte cookies ni pestañas con el Chrome del usuario; el puerto de depuración solo escucha en `127.0.0.1` (valor por defecto).
  - Por qué esta y no Claude in Chrome: da viewports exactos con `Emulation.setDeviceMetricsOverride` (la ventana real suma barras y bordes), escribe las capturas en disco con `Page.captureScreenshot`, permite desactivar JavaScript y emular el táctil, y no usa la sesión ni las pestañas reales del usuario.
  - Es el "script directo" que admite `browser-qa` en su "Integración".
  - No hay MCP de Playwright configurado (`.mcp.json` solo tiene `codegraph`).
  - Claude in Chrome (skill `claude-in-chrome`) queda como apoyo opcional para comprobar a mano un caso dudoso, por ejemplo el zoom real con Cmd + +, en una pestaña nueva que se cierra al terminar.
- **Anchos:** 375 × 812 (`mobile: true`, táctil), 768 × 1024 (`mobile: true`) y 1440 × 900, más 1024 × 768 y 1023 × 768 solo en las landings (D1b).
  - En el informe se anota el `window.innerWidth` real de cada captura.
  - `deviceScaleFactor: 1`, salvo en el zoom.
  - Captura visible (`captureBeyondViewport: false`) y, cuando hace falta el contexto, página completa (`captureBeyondViewport: true`).
- **Contraste (CA-4):** `Runtime.evaluate` en la página.
  - Para cada nodo de texto visible (y para bordes, iconos y anillos de foco, WCAG 1.4.11), toma `getComputedStyle().color` y el fondo efectivo: sube por los ancestros componiendo los `background-color` con alfa. Calcula la luminancia relativa y el ratio de WCAG 2.x, `(L1 + 0.05) / (L2 + 0.05)`.
  - Umbrales: 4.5:1 en texto normal y 3:1 en texto grande (≥ 24 px, o ≥ 18.66 px en negrita) y en componentes no textuales.
  - Si el fondo es una imagen o un degradado, se marca como "manual": se toma la captura, se dibuja en un `<canvas>` dentro del mismo Chrome headless y se muestrean los píxeles bajo el texto; se reporta el peor caso.
  - Se anotan los dos colores en hex y el ratio con dos decimales. C2 (blanco sobre `#25D366`) se comprueba además a mano con la misma fórmula.
- **Objetivos táctiles (CA-5):** `getBoundingClientRect()` de todo `a`, `button`, `input`, `select`, `textarea`, `summary`, `[role=button]` y `[tabindex]` visible.
  - Se marca lo menor de 24 × 24 px (WCAG 2.5.8 AA) y se comprueba la excepción de espaciado: un círculo de 24 px centrado que no corte otro objetivo.
  - Lo menor de 44 × 44 px va como recomendación (Baja). Se anotan ancho × alto en px.
- **Teclado (CA-3):** `Input.dispatchKeyEvent` con Tab y Shift+Tab, desde la carga hasta volver a la barra de direcciones, o hasta 150 pasos.
  - En cada paso se registra `document.activeElement`: etiqueta, nombre accesible, `href` relativo, rectángulo, y `outline` y `box-shadow` calculados, para juzgar si el foco es visible y su contraste con 1.4.11. Se captura un elemento enfocado representativo por superficie.
  - Se anotan: si el primer foco es el skip link y si funciona, el orden lógico frente al visual, los elementos ocultos que reciben el foco y las trampas.
  - **Avisos:** al cargar, si el `<dialog>` se abrió con `showModal` (`dialog.open` y `:modal`) y dónde está el foco inicial; si Tab queda dentro; si `Escape` lo cierra; si el botón lo cierra; y adónde vuelve el foco después (`activeElement`). Cada uno se repite en una sesión nueva.
- **Estructura:** `Accessibility.getFullAXTree` y consulta del DOM para landmarks (`banner`, `navigation`, `main`, `contentinfo`), jerarquía de encabezados (un `h1`, sin saltos) y nombres accesibles de botones e iconos.
- **Humo, solo para contextualizar (fases 1 y 4 de `browser-qa`):** errores de consola (`Runtime.consoleAPICalled`, `Log.entryAdded`) y respuestas 4xx/5xx (`Network.responseReceived`) de cada página. Core Web Vitals queda fuera: el rendimiento está fuera de alcance.
- **Desbordes:** `document.documentElement.scrollWidth > innerWidth` y los elementos cuyo `getBoundingClientRect().right` supera el viewport, en cada ancho.
- **Comparación con el diseño fuente:** se ven los `screen.png` y se leen los `code.html` y los `DESIGN.md` (Read). H3 se cuantifica con `grep -o '\[#[0-9a-fA-F]\{3,8\}\]'` sobre `restaurante/landing-pages/src/views/pages/*.html` frente a los `code.html`: cuántos hay, cuántos son distintos y cuántos vienen del diseño.
- **Coste:** como mucho 120 capturas en bruto (unas 35 de landings y 50 del admin, más los casos límite y las de foco). El agente solo mira las que necesite para juzgar algo (unas 60 como mucho). Las mediciones se leen como JSON, no como imagen.

### 3. Dónde viven el informe y las capturas (D1), compresión y CA-8

- **En el repositorio:**
  - `restaurante/docs/auditoria-interfaces.md`;
  - `restaurante/docs/auditoria-interfaces/AUD-NNN-<slug>.jpg`, solo las capturas que respaldan un hallazgo, recortadas a la zona relevante;
  - una captura puede respaldar varios hallazgos, y un hallazgo respaldado solo por una medición no necesita captura (RN-2).
- **Fuera del repositorio:** todo lo demás, en `<S>/capturas/` (en bruto, PNG), `<S>/mediciones/` (JSON) y `<S>/evidencia/`, y se borra en la limpieza.
- **Compresión, solo con herramientas de macOS:** `sips -s format jpeg -s formatOptions 70 --resampleWidth <≤1440> <png> --out <jpg>`, más el recorte con `sips -c <alto> <ancho> --cropOffset <y> <x>`.
  - No se instala nada. `cwebp` está en la máquina (Homebrew), pero no hace falta: JPEG basta y GitHub lo muestra.
- **Topes propuestos (DT-3):** como mucho 200 KB por captura, 25 capturas y 3 MB en total en `restaurante/docs/auditoria-interfaces/`.
  - Si una captura pasa de 200 KB, se recorta más o se baja la calidad a 60.
  - Comprobación: `du -ch restaurante/docs/auditoria-interfaces/*.jpg` y `ls | wc -l`.
- **CA-8 (con RT-2):** antes del commit y otra vez en QA:
  - `git diff --stat main...HEAD` y `git diff --name-only main...HEAD`, que solo pueden listar `restaurante/docs/auditoria-interfaces.md`, `restaurante/docs/auditoria-interfaces/*.jpg` y `.claude/docs/in-progress/REQ-F-048-auditoria-interfaces-navegacion.md`;
  - además, `git status --short` sin nada más, ni archivos sin seguimiento fuera de esos.
  - En T4 se agregan por nombre (nunca `git add -A`).

### 4. Orden de trabajo, plantilla del informe y comprobación de los CA

**Orden (T2):**

1. Estado inicial, rama `feature/REQ-F-048-auditoria-interfaces-navegacion` desde `main` actualizado y ticket a `in-progress/` con `mv` (RT-3).
2. Inventario de pantallas, rutas y roles. Sale de `inventory-manager/src/routes.ts` y de las vistas (consultadas con CodeGraph):
   - `/acceso`; `/:negocio/productos`; `/productos/nuevo`; `/productos/:id/editar`; `/productos/eliminados`; `/:negocio/pagina`; `/usuarios`; `/usuarios/nuevo`; `/usuarios/:id/editar`; `/cuenta`; `/bot`; `/birria/cotizador`; 404; 503.
   - Las landings: `/`, `/birria` y `/molotes` con sus avisos.
3. Entorno aislado (§1) y script CDP (§2).
4. Navegación móvil a 375 px de las landings y del admin (H1, H2, H4 y C1; CA-2), con los dos roles en el admin.
5. Teclado y foco, con los avisos (CA-3).
6. Contraste y objetivos táctiles (CA-4, CA-5 y C2).
7. El resto de anchos, los casos límite (§1.9), los estados, la estructura y la comparación con `_stich_source_`: H3 y la auditoría visual de `design-system`, modo 2.
8. Redacción del informe, clasificación del origen de cada hallazgo y severidades.
9. Selección y compresión de las capturas.
10. Control `check-evidence.js` (§ Skills).
11. Limpieza (§6).
12. Validaciones y `## Implementation Result`.

**Plantilla de `restaurante/docs/auditoria-interfaces.md`:**

1. **Resumen:** número de hallazgos por severidad y por superficie, y los 5 más importantes.
2. **Método y entorno:**
   - fecha;
   - Chrome 157.0.8103.79 headless por CDP y Node 24.22.1;
   - commit de `main` auditado;
   - entorno local aislado con datos semilla y usuarios de prueba (sin nombres ni credenciales);
   - anchos y equivalencias (zoom y horizontal);
   - cómo se forzaron los avisos (`?dia=`);
   - fórmulas de contraste y de tamaño de objetivo;
   - límites: sin lector de pantalla real (solo el árbol de accesibilidad), sin dispositivos físicos y emulación del zoom;
   - cómo reproducirlo.
3. **Escala de severidad:**
   - **Crítica:** impide una tarea principal (pedir por WhatsApp, entrar al admin, guardar) a un grupo de usuarios (teclado, lector de pantalla, móvil) sin alternativa.
   - **Alta:** incumple WCAG 2.2 AA en un flujo principal, o dificulta mucho la tarea y la alternativa es costosa.
   - **Media:** incumple AA en un flujo secundario, o degrada la experiencia con una alternativa razonable.
   - **Baja:** recomendación (44 px), consistencia visual o mantenimiento (H3).
4. **Inventario:** tabla de superficie × ruta × rol × anchos × capturado (sí o no, y por qué).
5. **Navegación móvil:** las entradas de CA-2, una de las landings (con Birria y Molotes) y otra del admin (por rol), con qué puede hacer el usuario a 375 px para llegar a cada sección, la captura y el origen. Además, la verificación de H1, H2, H4, C1 y C2.
6. **Recorridos con teclado** por superficie: orden de foco (lista numerada abreviada), foco visible, skip link y avisos (apertura, Tab, `Esc`, botón y retorno del foco).
7. **Hallazgos** `AUD-001…`, ordenados por severidad, cada uno con:

| Campo | Contenido |
| --- | --- |
| ID | `AUD-NNN` |
| Superficie y ruta | p. ej. "Landing Birria, `/birria`" |
| Ancho o dispositivo | 375 / 768 / 1024 / 1440, horizontal, zoom 200 % o sin JS |
| Descripción observable | Lo que ve o le pasa al usuario |
| Evidencia | `![…](auditoria-interfaces/AUD-NNN-slug.jpg)` y medición: colores en hex y ratio (CA-4) o ancho × alto en px (CA-5) |
| Criterio incumplido | WCAG 2.2 (número y nombre) o regla del proyecto (archivo) |
| Origen | `implementación` o `diseño fuente` (con la carpeta de `_stich_source_` que lo define) |
| Severidad | Crítica, Alta, Media o Baja |
| Recomendación | Concreta, sin código |
| Decisión sobre `_stich_source_` o Stitch | No, o sí con el motivo (RN-3 y RN-4) |

8. **Estados de contenido:** carga, vacío, error, parcial, éxito y permiso, por app, con su evidencia o con el motivo de "no aplica" o "sin probar".
9. **Consistencia visual:**
   - puntuación de las 9 dimensiones aplicables de `design-system` (modo 2; "modo oscuro" no aplica), por separado para las landings y para el admin;
   - cuantificación de H3.
10. **Decisiones para el usuario (CA-7):** D2 y D3 con las opciones que salen de los hallazgos.
11. **Propuesta de tickets derivados (CA-7):** A (admin), B (landings) y C (tokens, opcional), con los `AUD-NNN` que agrupa cada uno y sus dependencias (Stitch o `_stich_source_`).

**Comprobación de cada CA (la hace T2 y la repite QA):**

| CA | Cómo se comprueba |
| --- | --- |
| CA-1 | La tabla del inventario tiene cada superficie del alcance en 375, 768 y 1440, y la navegación de las landings en 1024, con "capturado: sí" o con el motivo. Se contrasta con `routes.ts` |
| CA-2 | Hay una entrada para las landings y otra para el admin, cada una con su captura a 375, su origen y lo que el usuario puede hacer para ir a cada sección |
| CA-3 | Hay un recorrido por superficie con el orden, el foco visible y los avisos (cómo se abren, `Esc`, el botón y el retorno del foco) |
| CA-4 | Todo hallazgo de contraste lleva los dos hex y el ratio. Se revisa por búsqueda en el informe |
| CA-5 | Todo hallazgo de objetivo lleva ancho × alto en px |
| CA-6 | Cada `AUD-NNN` tiene los 10 campos. Se revisa la tabla por hallazgo |
| CA-7 | Las dos últimas secciones existen y cada `AUD-NNN` aparece en algún derivado o está marcado como "no se propone" |
| CA-8 | `git diff --name-only main...HEAD` según §3 |
| CA-9 | La salida de las órdenes de §6 va en `## Implementation Result` |

### Skills y agentes: cuál se usa en cada paso y cómo

| Paso | Skill o agente | Uso concreto |
| --- | --- | --- |
| 2 (humo), 4-7 | `browser-qa` | Su adaptación al proyecto manda: solo lectura y en local; credenciales de prueba; sin axe-core (árbol de accesibilidad y comprobación manual); pestañas y procesos cerrados. Se usan la fase 1 (consola y red), la fase 3 (tres anchos, más 1024 en las landings, y como referencia `_stich_source_`, no capturas versionadas) y la fase 4. No se da veredicto SHIP/DO-NOT-SHIP: el informe usa la escala de severidad |
| 5-6 | `accessibility` | Lista de criterios WCAG 2.2 AA para el campo "Criterio incumplido": 1.3.1, 1.4.3, 1.4.10, 1.4.11, 2.1.1, 2.1.2, 2.4.1, 2.4.3, 2.4.7, 2.4.11, 2.5.8, 3.3.1 y 4.1.2. También su lista de los modales: contienen el foco, `Esc`, botón de cierre y retorno del foco. Su adaptación manda: si el diseño fuente no llega a AA, se señala como hallazgo de origen `diseño fuente`, nunca se corrige |
| 7 | `design-system` | Solo el modo 2 (auditoría visual en 9 dimensiones, con ejemplos y `archivo:línea`) contra el servidor local, para la sección "Consistencia visual" y H3. Sin el modo 1 (no se crean `DESIGN.md`, `design-tokens.json` ni la vista previa) y sin el modo 3, salvo para anotar algo evidente |
| 7-10 | `frontend-design-direction` | Solo el "contrato de evidencia y estados del contenido" como control interno de completitud. Se escriben dos registros, `<S>/evidencia/landings.json` (`targetViewports: ["375px","768px","1024px","1440px"]`) y `<S>/evidencia/admin.json` (`["375px","768px","1440px"]`), con `accessibility`, `responsive`, los 6 `contentStates` y `renderedEvidence` con las capturas en bruto de `<S>/evidencia/` (rutas relativas). Se ejecuta `node .claude/skills/frontend-design-direction/scripts/check-evidence.js <S>/evidencia/<x>.json`. Sus "Pautas de implementación" y sus `references/` no aplican: no se diseña nada. El JSON no entra en el repositorio; su salida va en `Implementation Result` |
| — | `claude-in-chrome` | Opcional, como apoyo manual (§2) |
| — | Stitch | No se usa (fuera de alcance) |

**Los 6 estados del contrato:**

| Estado | Landings | Admin |
| --- | --- | --- |
| Carga | `not-applicable`: SSR sin estados de carga ni JS que pida datos (el motivo se comprueba en `public/js`) | `not-applicable` por el mismo motivo, salvo que el recorrido encuentre un estado de envío en curso |
| Vacío | Sin probar, salvo que exista sin escribir datos. Vaciar un catálogo exige borrar productos: se declara "sin probar" y se propone para el derivado, no se finge | "Productos eliminados" vacío y las listas del bot vacías ("No hay números bloqueados.") |
| Error | La `api` parada no da error visible: es "parcial" (abajo) | Validación del formulario de producto y del de usuario (resumen de errores, `aria-invalid`), el 404 y el 503 |
| Parcial | Con la `api` parada, la semilla (`landing_products_fallback`) | Lo que se pueda forzar de "La base de datos no respondió" en Bot; si no se puede, "sin probar" |
| Éxito | `not-applicable`: las landings no tienen acciones que se confirmen; el pedido sale a WhatsApp. El formulario del club de Birria no se envía. Si existe, se anota como "sin probar" | Producto guardado y usuario creado |
| Permiso | `not-applicable`: las landings son públicas | El editor en `/usuarios` (403) y en el negocio ajeno |

Un estado sin probar se declara como tal en el informe. Si por eso `check-evidence.js` falla en ese estado, se reporta así; no se fabrica evidencia.

**Agentes:**

- **`senior-fullstack`:** T2 (la auditoría, el informe, las capturas y la limpieza), T3 (correcciones del informe) y T4 (commit, PR y CI).
- **`senior-qa`** (tras la aprobación de la implementación):
  - reproduce una muestra de hallazgos: todos los de severidad Crítica y Alta, y al menos uno de cada tipo (navegación móvil, teclado o aviso, contraste, objetivo, desborde y estado);
  - comprueba CA-1 a CA-9, con CA-8 por `git diff --name-only main...HEAD`;
  - comprueba los topes de las capturas (DT-3);
  - mira una por una las capturas versionadas para confirmar que no contienen datos personales, credenciales ni datos de producción;
  - comprueba la limpieza de T2 y deja limpio su propio entorno, siguiendo el método del informe.
- **`a11y-architect` (DT-4, recomendado):** la sesión principal lo invoca después de T2 y antes de pedir la aprobación de la implementación, solo para revisar el informe (lectura: sin `Write` ni `Edit`). Revisa la correspondencia de cada hallazgo con WCAG 2.2, la severidad de los de accesibilidad y los criterios que falten. Sus observaciones van al usuario con el `Implementation Result` y, si se aceptan, se corrigen en T3. No sustituye a `senior-qa`.

### 5. Partición en PR y CI

- **Un solo PR** hacia `main`, porque no es un paso de la épica de arquitectura (`.claude/rules/git.md`), con la rama `feature/REQ-F-048-auditoria-interfaces-navegacion`.
- **Commits (T4):**
  1. `docs: añade la auditoría de interfaces y navegación de las landings y el admin`, con el informe, las capturas y el ticket en `in-progress/` y `QA_APPROVED`;
  2. `docs: registra el Pull Request de REQ-F-048`, solo con el ticket.
  - Sin referencias a Claude ni a Anthropic, ni en los commits ni en el PR.
- **CI (RT-1):** con las capturas bajo `restaurante/`, `cambios` da `codigo=true`.
  - El PR corre las validaciones completas (`calidad`, `pruebas`, `docker` y `auditoria`), y en cada uno de los dos commits, porque `cambios` compara todo el PR con su base.
  - Hay que esperar que las cuatro queden en `pass`, no en `skipping`: `gh pr checks <n> --watch --fail-fast`.
  - Se abre como listo, no en borrador: los dos commits necesitan el CI de todos modos.
  - Tras el merge, el push a `main` publica y despliega (RT-1).
  - Si el usuario elige la alternativa B de DT-1, el PR solo tendría documentación: las validaciones quedarían omitidas (cuenta como superado según la regla crítica 7 del agente) y no habría despliegue.
- **Cierre (T5):** `mv` (ya con `git mv`, porque estará versionado) a `done/`, con commit solo si se autoriza.

### 6. Seguridad, privacidad, limpieza y coste

- **Datos personales:** solo hay usuarios ficticios (`auditoria-admin` y `auditoria-editor`).
  - El bot está desactivado: sin números, tokens ni bloqueos.
  - Los números de WhatsApp de la configuración son ficticios. El teléfono, la dirección y el correo del pie de las landings son datos públicos del negocio y salen de la semilla del repositorio.
  - Nada sale de la base de desarrollo ni de producción.
  - No se capturan formularios con contraseñas escritas: los campos `password` se capturan vacíos.
  - Ninguna captura sale hacia servicios externos. Las únicas peticiones externas son las que la propia página hace (mapa embebido y recursos públicos), sin datos del usuario.
- **Credenciales de prueba:** se generan al vuelo y solo están en `<S>/credenciales` (`600`). No aparecen en el informe, el ticket, los commits ni los logs, y se borran en la limpieza.
- **Producción:** no se navega ni se inicia sesión. Ninguna URL de las órdenes apunta fuera de `127.0.0.1`.
- **Limpieza (RN-6 y CA-9),** con la salida en `Implementation Result`:
  1. `kill` de los PIDs de `<S>/pids` (las tres apps y Chrome headless);
  2. `lsof -nP -iTCP -sTCP:LISTEN` en 3000-3004, 3307 y 9222: igual que el estado inicial;
  3. `docker compose -p restaurante-auditoria down -v`, y después `docker ps -a` y `docker volume ls` sin nada de `restaurante-auditoria`;
  4. dejar el `mysql-dev` de desarrollo como estaba, con `npm run db:up` solo si estaba en marcha;
  5. si se corrió `npm test`, comprobar en el MySQL de desarrollo que no queda ninguna base `restaurante\_test%` (y borrar solo las que tengan ese prefijo y no estén en uso);
  6. `rm -rf <S>/req-f-048` (perfil de Chrome, capturas en bruto, mediciones, registros, archivos de entorno, credenciales y script), una vez trasladados los resultados al ticket;
  7. `git worktree list` (solo el checkout principal) y `git status --short` (solo los archivos de §3);
  8. si se usó Claude in Chrome, pestañas cerradas.
- **Coste:** los topes de §2 y §3. El informe se escribe una vez, al final, a partir de las mediciones en JSON.

### Validaciones (T2)

- No hay cambios de código. Aun así, se ejecutan como pide el agente, después de la limpieza y con el `mysql-dev` de desarrollo:
  - `npm run typecheck`, `npm run lint` y `npm test`, para confirmar que el árbol sigue en verde;
  - `npm run build:css` solo como paso del entorno, porque no se versiona.
- Comprobaciones propias:
  - los topes de las capturas;
  - que cada enlace de imagen del informe exista (`grep -o 'auditoria-interfaces/[^)]*'` frente a `ls`);
  - la salida de `check-evidence.js`;
  - CA-1 a CA-9 según la tabla de §4.

### Riesgos técnicos

- **Redespliegue en producción al mergear (RT-1):** mitigado por DT-1.
- **Emulación frente a dispositivo real:** el zoom, la orientación horizontal y el táctil se emulan. Se declara en el método y, si un caso es dudoso, se comprueba a mano (Claude in Chrome).
- **Contraste sobre imágenes:** se muestrea el peor caso; puede variar con la imagen. Se declara.
- **Falsos positivos frente a las diferencias deliberadas (RT-6):** se contrastan con el README antes de reportar.
- **Dejar remanentes** (contenedor, volumen, procesos o el perfil de Chrome): mitigado por el estado inicial anotado y la lista de limpieza comprobada.
- **El límite de intentos de acceso (429):** pocos inicios de sesión; si salta, se espera a que venza, sin tocar la configuración.

### Criterios de finalización

- El informe y las capturas cumplen CA-1 a CA-7 y los topes de DT-3.
- CA-8 se comprueba según §3.
- La limpieza está comprobada y registrada (CA-9).
- `typecheck`, `lint` y `test` terminan con 0.
- `## Implementation Result` está escrito y el ticket queda en `NEEDS_IMPLEMENTATION_APPROVAL`.

### Decisiones técnicas para el usuario (con recomendación)

| ID | Decisión | Opciones | Recomendación |
| --- | --- | --- | --- |
| DT-1 | Qué hacer con el CI y el despliegue que dispararán las capturas (RT-1) | **A.** Mantener D1 y CA-8: el PR corre el CI completo y el merge redespliega producción con el mismo código (se cierran las sesiones del admin y se pierden las conversaciones del bot en curso). **B.** Guardar las capturas en `.claude/docs/auditoria-interfaces/` y dejar el informe en `restaurante/docs/`: es documentación para el CI, sin validaciones ni despliegue, pero cambia D1 y CA-8 (el BA tendría que actualizarlos). **C.** Cambiar antes el filtro de `ci.yml` para tratar las imágenes de `restaurante/docs/` como documentación: es otro ticket y su propio merge también redespliega | **A**, con el merge fuera del horario de servicio (p. ej. un lunes, día de descanso) |
| DT-1b | Leer CA-8 incluyendo el archivo del ticket en `.claude/docs/` (RT-2) | Sí / No | Sí: lo exige el proceso de tickets |
| DT-2 | Navegador | Chrome headless por CDP con un script desechable (sin dependencias) / Claude in Chrome / ambos | Chrome headless por CDP, con Claude in Chrome solo como apoyo manual |
| DT-3 | Topes de las capturas en el repositorio | 200 KB por captura, 25 capturas y 3 MB en total (JPEG de calidad 70 con `sips`), y 120 capturas en bruto fuera del repositorio | Aprobar esos topes |
| DT-4 | Revisión del informe por `a11y-architect` antes de pedir la aprobación de la implementación | Sí / No | Sí: es barata, de solo lectura y mejora la correspondencia con WCAG |

## Aprobación del Technical Action Plan

Aprobado por el usuario (2026-11-18). Cita textual: "Sí, apruebo el plan con tus recomendaciones y la opción A".

| Decisión | Resultado |
| --- | --- |
| DT-1 | A: D1 y CA-8 se mantienen; el PR corre el CI completo y el merge redespliega (el usuario mergea cuando le convenga) |
| DT-1b | Sí: CA-8 incluye el archivo del ticket |
| DT-2 | Sí: Chrome headless con un script desechable |
| DT-3 | Sí: los topes propuestos |
| DT-4 | Sí: `a11y-architect` revisa el informe, solo de lectura, antes de pedir la aprobación de la implementación |

## Implementation Result

### Rama

`feature/REQ-F-048-auditoria-interfaces-navegacion`, creada desde `origin/main` (`6d86fde`) en un worktree propio: `/Users/orvigas/Desktop/Negocio-worktrees/req-f-048`. Todavía no tiene commits: el commit y el PR se hacen en T4, tras QA.

- **Ticket:** se copió del checkout principal (`.claude/docs/backlog/`, sin versionar) a `.claude/docs/in-progress/` del worktree. La copia de `backlog/` sigue en el checkout principal sin versionar. Hay que borrarla cuando este ticket entre con el commit de T4, para que solo exista en una carpeta.
- **Apps:** se ejecutaron desde el checkout principal, que está en el mismo commit que la rama. El worktree no tiene `node_modules` y la rama solo añade documentación. `npm run build:css` regeneró allí el CSS, que está en `.gitignore`.

### Cambios realizados

- **`restaurante/docs/auditoria-interfaces.md`:** el informe.
  - Contiene el método, el entorno, el inventario, la escala de severidad, la navegación móvil (CA-2), los recorridos con teclado (CA-3), los 21 hallazgos `AUD-001`…`AUD-021`, los estados del contenido, la consistencia visual, las decisiones y la propuesta de derivados.
  - Hallazgos por severidad: 0 Crítica, 2 Alta, 6 Media y 13 Baja.
  - Por origen: 13 del diseño fuente y 8 de la implementación.
  - Por superficie: 18 en las landings y 3 en el admin.
- **`restaurante/docs/auditoria-interfaces/`:** 16 capturas JPEG de calidad 70: 13 recortadas con `sips` y 3 cabeceras capturadas directamente con el área de la cabecera (corrección de DEF-001). Ocupan 732 KB en total y la mayor, 146 KB. Todas respaldan algún hallazgo y todas están enlazadas desde el informe.
- **Verificación de H1 a H4, C1 y C2:** los seis se confirman. Los números de C2 están en AUD-001 a AUD-004.

### Criterios de aceptación

| CA | Estado | Evidencia |
| --- | --- | --- |
| CA-1 | Cumple | Inventario (§4 del informe): todas las superficies a 375, 768 y 1440, y la navegación de las landings a 1023 y 1024. Se forzaron todos los avisos; no hubo que declarar ninguna superficie ausente |
| CA-2 | Cumple | §5.1 (landings, Birria y Molotes) y §5.2 (admin, por rol), con capturas a 375 y su origen |
| CA-3 | Cumple | §6, según la interpretación que decidió el usuario tras la ronda 1 de QA: un recorrido con teclado de cada landing (con sus avisos) y uno del admin, explícito al principio de §6. Recogen orden, foco visible y skip link y, en los avisos, apertura, Tab, `Esc`, botón y retorno del foco |
| CA-4 | Cumple | AUD-001 a AUD-004 llevan los dos colores en hexadecimal y el ratio |
| CA-5 | Cumple | AUD-011 lleva ancho × alto en px y las separaciones medidas (AUD-007, los rectángulos y el porcentaje tapado) |
| CA-6 | Cumple | Cada `AUD-NNN` tiene los 10 campos |
| CA-7 | Cumple | §10 (decisiones) y §11 (derivados A, B1, B2, C y D, que cubren los 21 hallazgos) |
| CA-8 | Cumple (pendiente del commit) | `git status --short` del worktree: solo `restaurante/docs/auditoria-interfaces.md`, `restaurante/docs/auditoria-interfaces/` (16 `.jpg`) y este ticket en `in-progress/`, según DT-1b. Se vuelve a comprobar con `git diff --name-only main...HEAD` en T4 |
| CA-9 | Cumple | Ver "Limpieza" abajo |

### Validaciones ejecutadas

| Comando | Resultado |
| --- | --- |
| `npm run typecheck` (checkout principal, mismo código) | Exit 0 |
| `npm run lint` | Exit 0 |
| `npm test` (con `npm run db:up`) | Exit 0: landing-pages, 49 archivos y 1166 pruebas; api, 60 archivos y 887 pruebas; inventory-manager, 16 archivos y 278 pruebas; todas pasan |
| `node .claude/skills/frontend-design-direction/scripts/check-evidence.js` sobre `landings.json` y `admin.json` (en el scratchpad) | Con todos los estados marcados como "pass" o "no aplica", exit 0. Al marcar con honestidad como `untested` los estados sin probar ("vacío" en las landings y "parcial" en el admin), exit 1: `contentStates.empty necesita una observación aprobatoria o un motivo de no aplicable` y lo mismo con `contentStates.partial`. Se dejó así a propósito: no se fabricó evidencia (§8 del informe). En la remedición, "error" y "éxito" de las landings pasaron de "no aplica" a probados; los dos estados sin probar siguen siendo esos dos |
| Enlaces de imagen del informe frente a los archivos | 16 de 16, sin huérfanos |
| Topes de DT-3 | 16 capturas (≤ 25), la mayor de 146 KB (≤ 200 KB), 732 KB en total (≤ 3 MB) |
| Revisión visual de las 16 capturas, una a una (Read de imagen), frente a su pie | Las 16 coinciden con lo que describe su pie, incluidas las 3 rehechas (DEF-001) |

### Limpieza (CA-9)

- **Estado inicial anotado:** `mysql-dev` de desarrollo parado; los puertos 3000-3004, 3307 y 9222 libres; un solo worktree, `main`.
- **Procesos:** se mataron las tres apps (api, landing-pages e inventory-manager) y Chrome headless. Ningún proceso `dev-server.ts` ni con `chrome-profile` sigue vivo (`ps`).
- **Puertos:** tras la auditoría, ninguno escucha en 3000-3004, 3307 ni 9222 (`lsof`).
- **Docker:** `docker compose -p restaurante-auditoria down -v` borró el contenedor, el volumen `restaurante-auditoria_mysql-dev-data` y las dos redes. Después, `docker ps -a`, `docker volume ls` y `docker network ls` no muestran nada con "auditoria".
- **MySQL de desarrollo:** se levantó solo para `npm test`. Al terminar, `SHOW DATABASES LIKE 'restaurante\_test%'` devolvió 0 filas. Después se paró con `npm run db:down`, que es como estaba.
- **Scratchpad:** borrado `<scratchpad>/req-f-048`, con las 165 capturas en bruto, las mediciones, los registros de evidencia, los archivos de entorno, las credenciales de prueba, el perfil de Chrome y los scripts, y también el log de las pruebas. En el scratchpad quedan tres archivos anteriores a este ticket que no son suyos (`ecc-tree.txt`, `pr-body.md` y `test-b.log`); no se tocaron.
- **Pestañas:** no se usó Claude in Chrome, así que no hay pestañas abiertas.
- **Worktree:** el de este ticket se queda para QA y T4; no hay otros.

### Archivos afectados

- `restaurante/docs/auditoria-interfaces.md` (nuevo).
- `restaurante/docs/auditoria-interfaces/*.jpg` (16, nuevos).
- `.claude/docs/in-progress/REQ-F-048-auditoria-interfaces-navegacion.md` (este ticket).

### Riesgos o pendientes

- **Tope de capturas en bruto superado:** se tomaron 165, por encima del tope de 120 de DT-3. La razón fue que se repitieron mediciones al corregir el muestreo del contraste y el recorrido con teclado. Ninguna entró en el repositorio y ya están borradas. El agente solo miró unas 25.
- **Sin probar:**
  - el estado "vacío" de las landings, porque exige borrar productos;
  - el estado "parcial" del Bot, porque exige tirar MySQL con la `api` en marcha.
- **Límites del método** (§2 del informe): sin lector de pantalla real y con el zoom, el táctil y la orientación emulados. El contraste sobre imágenes se midió con una banda de píxeles, el peor caso es el percentil 5 y la sombra de texto no se tiene en cuenta. El contraste del indicador de foco no se midió, y no se auditaron 1.4.12 ni 2.5.3.
- **Comportamiento de la `api`:** el puerto del webhook (3004) se abre aunque el bot esté desactivado. Responde 503, como documenta `docs/desarrollo.md`. No es un hallazgo de interfaz.
- **Revisión de `a11y-architect` (DT-4):** "APTO CON CORRECCIONES". Las 9 correcciones obligatorias están aplicadas (ver el historial). De las opcionales:
  - **aplicadas:** la justificación de la severidad de AUD-003 y AUD-004 (se quedan en Media); las separaciones de AUD-011 (cumplen 2.5.8, siguen en Baja); `aria-current` revisado sin hallazgo; el campo del club de Birria (AUD-020); la sugerencia de llevar el foco a `main` al cerrar un aviso; los criterios no auditados, declarados en "Límites"; y la cuenta de paradas reconciliada (22 + 16 + 1 = 39 a 375 y 28 + 16 + 1 = 45 a 1440);
  - **no aplicada:** la medición del contraste del indicador de foco, que queda declarada en "Límites".
- **Tras el merge (DT-1 A):** se redespliega producción. Mejor fuera del horario de servicio.

### Correcciones tras QA ronda 1

Decisión del usuario, cita textual: "si las apruebo". Se corrige DEF-001; CA-3 se cumple con un recorrido de cada landing (con sus avisos) y uno del admin; y se corrigen de DEF-002 a DEF-006 en esta vuelta.

| Defecto | Corrección |
| --- | --- |
| DEF-001 (MAJOR) | Se rehicieron `aud-003-cabecera-molotes-1440.jpg`, `aud-005-birria-1023-cabecera.jpg` y `aud-005-birria-1024-cabecera.jpg` capturando exactamente la cabecera: `clip` de 0 a su alto (113 y 81 px). Con Read de imagen se comprobó que la de Molotes muestra el "Inicio" activo y el icono de persona, que a 1023 no hay navegación y que a 1024 sí la hay. Causa: `sips --cropOffset 0 0` no recortaba la parte superior como se esperaba. Se revisaron una a una las 16 capturas frente a su pie, y todas coinciden |
| CA-3 | §6 deja explícito qué cuenta como "cada superficie" |
| DEF-002 (MINOR) | Hallazgo nuevo, **AUD-021** (Media, diseño fuente, admin): medido en el navegador, el borde pasa de `#ab8985` a `#c2410c` (1.64:1 entre estados); 3.50 y 3.26:1 frente a los fondos; `outline` transparente y sin anillo. El origen está en el `DESIGN.md` del admin ("1.5px border `#c2410c` with zero outer fuzzy halo"). Tiene 2 capturas. "Lo que está bien" y §6 se acotan: el `outline` de 2 px `#eab308` es solo para enlaces y botones. También cambian el resumen, §9, la decisión 3 de §10 y el derivado A de §11 |
| DEF-003 | §2 y AUD-018: el `screen.png` de escritorio de Moloteando es válido (1280 × 4459) y se usó para confirmar el origen de AUD-002, AUD-003 y AUD-012 |
| DEF-004 | AUD-016: 100 apariciones en 57 líneas, 53 clases distintas y 42 colores. AUD-017: 41 apariciones en 34 líneas, 15 clases y 15 colores |
| DEF-005 | Las landings suelen usar el anillo de foco por defecto del navegador; la marca "Administración" mide 28 px de alto; la alternativa de AUD-003 da 6.29:1 |
| DEF-006 | En el inventario, "Inicio sin aviso" lleva el motivo: es la misma vista que `/birria`, medida a 768 y 1440 |
| Cifras de QA | AUD-006 a 320 px: 337 px remedidos con `auditoria-admin`, y la nota de que depende de lo largo que sea el nombre y de la sección (QA, 325). AUD-007 en el pie, remedido con Tab real: 0 % a 375; a 320, Birria con un 27-40 %; explicado que depende del desplazamiento, y nunca tapado del todo. AUD-002 y AUD-004: nota de que son el peor caso y la mediana de su muestreo, y de que otros muestreos dan cifras algo distintas sin cambiar la conclusión |

En la ronda 2 también se vio que a 1024 px la navegación de Birria parte en dos líneas varias etiquetas, y se anotó en §5.1.

**Conteos nuevos:** 21 hallazgos (antes 20). Por severidad, 0 Crítica, 2 Alta, 6 Media y 13 Baja. Por origen, 13 del diseño fuente y 8 de la implementación. Por superficie, 18 en las landings y 3 en el admin.

**Limpieza de la ronda 2** (entorno en `<scratchpad>/req-f-048c`):

- Se mataron la api, landing-pages, inventory-manager y Chrome headless.
- Puertos 3000-3004, 3307 y 9222 libres (`lsof`).
- `docker compose -p restaurante-auditoria down -v`: después, 0 contenedores, 0 volúmenes y 0 redes con "auditoria".
- `mysql-dev` de desarrollo sin tocar: sigue parado.
- Directorio del scratchpad borrado, con las capturas en bruto, el perfil, las credenciales, los archivos de entorno y los scripts. Solo quedan los tres archivos ajenos de antes.
- El worktree no tiene `node_modules` ni CSS generado: las apps corrieron desde el checkout principal, cuyo CSS está en `.gitignore`.
- `git status --short` del worktree: solo el informe, la carpeta de capturas y el ticket.

## QA Action Plan

Aprobado por el usuario (2026-11-18). Cita textual: "si lo apruebo", con las recomendaciones de las preguntas 1 a 5:

- **P1:** CA-8 se valida sobre el árbol de trabajo; `git diff --name-only main...HEAD` sobre el commit real lo hace `senior-fullstack` en T4.
- **P2:** opción B (`npm ci`, `db:generate` y `build:css` en el worktree, y se borran en la limpieza).
- **P3:** sin `lint`, `typecheck` ni `npm test` (solo hay documentación).
- **P4:** se aceptan las rutas locales del ticket.
- **P5:** si el `mysql-dev` de desarrollo estuviera encendido, detenerse y preguntar.
- **P6:** el usuario asume el aviso operativo de RT-1.

### Objetivo

Comprobar que el informe cumple CA-1 a CA-9, que su evidencia se reproduce de forma independiente, que es riguroso (origen, conteos, sin falsos positivos graves), que no expone datos personales ni secretos, y que la rama solo contiene documentación.

### Pruebas

| ID | Prueba | Cubre |
| --- | --- | --- |
| P-01 | Inventario (§4) frente al alcance y a las rutas del admin | CA-1 |
| P-02 y P-03 | §5 (navegación móvil) y §6 (recorridos con teclado y avisos) | CA-2 y CA-3 |
| P-04 y P-05 | Hallazgos de contraste con los dos hex y el ratio; hallazgos de objetivos con ancho × alto | CA-4 y CA-5 |
| P-06 | IDs `AUD-001`…`AUD-020` sin saltos y 10 campos por hallazgo (script en el scratchpad) | CA-6 |
| P-07 | Conteos del resumen y de §10, y cobertura de §11 | CA-7 |
| P-08 y P-18 | `git rev-parse`, `git diff` y `git status --untracked-files=all` | CA-8 y regresión |
| P-09 | Limpieza de T2 y del propio QA | CA-9 |
| P-10 y P-11 | Topes de DT-3; enlaces entre capturas e informe | DT-3 y RN-2 |
| P-12 a P-14 | Enlaces internos, ortografía y tildes, Markdown | Calidad del entregable |
| P-15 a P-17 | Revisión una a una de las 14 capturas, metadatos y búsqueda de secretos y rutas | Privacidad |
| P-19 | Simulación local del filtro `cambios` de `ci.yml` | RT-1 |
| P-21 a P-30 | Reproducción: AUD-001 a AUD-007 (todas las Alta y Media) y AUD-008, 009, 010, 011, 013, 014, 015, 016, 017, 018, 019 y 020 | Rigor |
| P-31 a P-37 | Origen "diseño fuente" frente a `_stich_source_`, recomendaciones frente a las reglas, RN-2, diferencias deliberadas, exploración propia (falsos negativos y positivos) y "Lo que está bien" | Rigor |

### Entorno

- MySQL desechable `docker compose -p restaurante-qa-048`.
- `api` (3001), `landing-pages` (3000) e `inventory-manager` (3003) en `127.0.0.1`, con archivos de entorno propios en el scratchpad y sin bot.
- Usuarios `qa-admin` y `qa-editora`, con contraseñas aleatorias que no se imprimen.
- Chrome headless por CDP con perfil temporal (9222).
- Nada contra producción ni contra la base de desarrollo.

### Criterios de aprobación

- **`QA_APPROVED`:** CA-1 a CA-9 en PASS, los hallazgos Alta y Media reproducidos, sin datos personales ni secretos, sin BLOCKER ni CRITICAL, y los MAJOR solo si el usuario los acepta.
- **`QA_REJECTED`:** falla un CA, hay un defecto CRITICAL o el usuario decide corregir un MAJOR.
- **`NEEDS_USER_DECISION`:** hay un MAJOR sin decisión o una ambigüedad del requisito.

## QA Report

### Ronda

1 (2026-11-18). Validación sobre el árbol de trabajo del worktree (`HEAD` = `main` = `6d86fde`, sin commits).

### Pruebas ejecutadas

| Prueba | Comando o acción | Resultado |
| --- | --- | --- |
| Estado inicial | `docker ps -a`, `docker volume ls`, `docker network ls`, `lsof` en 3000-3004, 3307 y 9222, `git worktree list`, `git status` del worktree y del checkout principal | `restaurante-mysql-dev-1` parado (no hubo que preguntar, P5); puertos libres; 2 worktrees; worktree con los 3 elementos sin seguimiento; checkout principal con la copia vieja del ticket en `backlog/` |
| P-08 y P-18 | `git rev-parse HEAD main`, `git diff --name-only main...HEAD`, `git diff --name-only` y `git status --porcelain --untracked-files=all` | `HEAD` = `main` = `6d86fde`; los dos `diff` vacíos; solo 16 archivos sin seguimiento: el informe, las 14 capturas y el ticket. Nada en `src/`, `public/`, `_stich_source_/` ni en la configuración |
| P-10 | `stat`, `ls \| wc -l`, `file` y `sips` | 14 JPEG válidos (≤ 25); la mayor, 149 683 bytes (≤ 200 KB); en total, 739 536 bytes (≤ 3 MB) |
| P-11 | Capturas enlazadas frente a archivos | 14 de 14: ni huérfanas ni rotas |
| P-06 | Script de validación (scratchpad) | IDs `AUD-001`…`AUD-020` sin saltos ni duplicados; los 20 tienen los 10 campos; las tablas tienen 4 columnas en todas sus filas |
| P-07 | Conteos recalculados | Severidad: 2 Alta, 5 Media y 13 Baja; origen: 12 diseño fuente y 8 implementación; cruces (2/0, 3/2, 7/6) iguales a §1; los 7 Baja de diseño fuente cuadran con §10.5; §11 cubre los 20 y no hay referencias a IDs inexistentes |
| P-13 | `grep` de formas sin tilde y lectura completa | Sin faltas de tilde. Las coincidencias son rutas o identificadores (`/birria/pagina`, `diseno-responsivo.md`, `codigo=true`, nombre de la rama) |
| P-16 | `mdls` y `sips -g` (make, model, software, copyright) | Sin metadatos de autor, GPS ni software |
| P-17 | `grep` de rutas, usuario, `scrypt$`, `password=`, `ghp_`, `EAA`, `WHATSAPP_BOT_*=`, números largos y correos | El informe solo contiene `prueba@example.invalid`. El ticket contiene la ruta del worktree y el patrón del scratchpad (aceptados, P4) y nombres de variables sin valores |
| P-19 | El bloque `case` de `ci.yml:131-143` sobre la lista de P-18 | `codigo=true` desde `restaurante/docs/auditoria-interfaces/aud-001-cta-whatsapp-birria-375.jpg`: el PR correrá el CI completo y el merge redesplegará (RT-1 y P6) |
| Entorno | `npm ci`, `npm run db:generate` y `npm run build:css` en el worktree; `docker compose -p restaurante-qa-048 up -d --wait mysql-dev`; `db:migrate`; las 3 apps con `--env-file` del scratchpad | Correcto. La `api` sembró la página y los productos y creó `qa-admin`; el 3004 escucha, como está documentado; sin bot |
| Navegador | Chrome 158.0.8127.37 headless por CDP (WebSocket nativo de Node 24.22.1) con perfil temporal | Correcto. El informe cita Chrome 157: el navegador se actualizó entre T2 y QA, sin efecto en las mediciones |
| P-21 a P-37 | Mediciones en el DOM, muestreo de píxeles, recorridos con Tab, avisos, formularios, admin con dos roles y `api` caída | Ver las tablas siguientes |
| `check-evidence.js` | Un JSON mínimo con `empty: untested` | Exit 1 y `contentStates.empty necesita una observación aprobatoria o un motivo de no aplicable`: el mensaje que cita el informe es real |
| No repetido | `npm run lint`, `typecheck` y `npm test` | No se ejecutaron (P3). P-18 demuestra que el árbol no cambia ningún archivo versionado: solo añade documentación, capturas y el ticket. T2 los dejó en verde sobre el mismo commit |

### Reproducción de hallazgos (medido frente a citado)

| Hallazgo | Citado | Medido en QA | Veredicto |
| --- | --- | --- | --- |
| AUD-001 (Alta) | `#ffffff`/`#25d366` 1.98; alternativas 7.49 y 5.40 | 1.98 a mano y en el DOM de los 3 CTA de las dos landings a 375 y 1440 (12-14 px, 700); 7.49 y 5.40. Origen: `bg-[#25D366]` y `text-white` en los 4 `code.html` | Reproducido |
| AUD-002 (Alta) | Título 2.68/2.10; "Punto de Oro" 1.64/1.26; descripción 2.26/1.67; botón 2.10/1.63 | Pares hex idénticos. Banda de píxeles propia (peor caso y mediana), a 375 / 1440: título 2.56 / 1.98 (2.82 / 2.14); "Punto de Oro" 1.57 / 1.25; descripción 2.42 / 1.81; botón 2.05 / 1.50 (mediana). `text-shadow` presente | Reproducido: todo bajo el umbral |
| AUD-003 (Media) | 2.08; "Toque gourmet" 4.02; alternativa 6.26 | 2.08 en el DOM ("Favorito" y "Sabor de casa" de 9 px; "Inicio" de 12 px a 1440); 4.02; la alternativa da 6.29 | Reproducido (6.26 frente a 6.29: dentro de la tolerancia) |
| AUD-004 (Media) | 1.32; 2.58 a 375 y 3.88 a 1440; pastilla 3.56/4.13 | 1.32 a 1440 (1.12 a 375); antetítulo 2.60 / 3.95 (medianas 2.72 / 4.18); pastilla 3.47 a 1440 y 4.02 a 375 | Reproducido |
| AUD-005 (Media) | Navegación con `display: none` por debajo de 1024; pie de Molotes en ~9 270 de 9 796 | `none` a 320, 375, 768 y 1023, y `flex` a 1024 y 1440, en `/birria`, `/molotes` y `/`; ningún control de menú; pie en 9 235 de 9 796. Origen: `<nav class="hidden lg:flex">` en los 4 `code.html` | Reproducido (capturas: ver DEF-001) |
| AUD-006 (Media) | 273 / 217 / 197 px a 375; 337 a 320 | 273 (admin en Birria), 217 (Usuarios y Bot), 197 (editora); 325 a 320 con un nombre de usuario más corto. Cabecera `static`; enlaces de 44 px de alto | Reproducido (el alto a 320 depende del nombre) |
| AUD-007 (Media) | CTA `[177, 738, 174, 50]`; botón del hero `[16, 731, 343, 48]` tapado en parte; `padding-bottom` del pie 0; peor caso del pie, 40 % | Rectángulos idénticos. Con el foco por Tab: botón del hero tapado al 60 % y "Conoce nuestra tradición" al 20 %; pie a 0 px; "Términos" tapado al 33 % (Molotes) y al 100 % (Birria, no recibe el foco). Pie con el foco: "Ver ubicación" al 0 % en Molotes y al 13 % en Birria. Nada con el foco tapado por completo | Reproducido; los porcentajes del pie dependen de la posición del desplazamiento |
| AUD-008 (Baja) | `scrollY` 0 → 600 con el aviso abierto | 0 → 600 en los 4 avisos, a 375 y 1440 | Reproducido |
| AUD-009 (Baja) | "¡Ordenar ya!" → `/molotes`, 295 × 60 | Igual | Reproducido |
| AUD-010 (Baja) | 16 paradas en el iframe; ciclos de 39 (Birria) y 38 (Molotes) | 16 y 16; ciclos de 39 y 38 (22 + 16 + 1 y 21 + 16 + 1) | Reproducido |
| AUD-011 (Baja) | 116-216 × 14; 113-208 × 20-22; 128 × 30; separaciones ≥ 12 | Iguales; excepción de espaciado: distancias de 19-24 px (≥ 12) | Reproducido |
| AUD-012 (Baja) | `<span … aria-hidden>` de 32 × 32, no interactivo | Igual | Reproducido |
| AUD-013 (Baja) | Dos enlaces a `#menu-especialidades` | Igual en la implementación y en el `code.html` de escritorio | Reproducido |
| AUD-014 (Baja) | Cabecera de 113 px (Molotes) y 81 px (Birria); CTA de 50 px | Igual en 812 × 375 y en 640 × 400 con DPR 2; cabecera `fixed`; sin desborde | Reproducido |
| AUD-015 (Baja) | Nombre en 3 líneas y "Mi cuenta" partido | Igual con `qa-editora` (60 caracteres); "Mi cuenta" mide 56 px de alto | Reproducido |
| AUD-016 y AUD-017 (Baja) | 57 y 34 "clases"; 42/41 y 15/2 colores | 42/41 y 15/2 colores, iguales. 57 y 34 son **líneas**: hay 100 y 41 ocurrencias, y 53 y 15 clases únicas | Reproducido con DEF-004 |
| AUD-018 (Baja) | Birria: `screen.png` de 28 bytes en texto; miniaturas de 58 × 1600 y 45 × 1600 | Igual | Reproducido (ver DEF-003) |
| AUD-019 (Baja) | El formulario se oculta y el foco cae en `BODY` | `form.hidden` = true y foco en `BODY`; 0 peticiones de red. En Birria el foco se queda en el campo. Origen: `handleSubscribe()` del diseño (`form.classList.add('hidden')`) | Reproducido |
| AUD-020 (Baja) | `type="text"`, `autocomplete="email"` y etiqueta `sr-only` | Igual ("Correo electrónico o teléfono") | Reproducido |
| Avisos (§6) | `<dialog>` modal, foco en la primera acción, `Esc`, botón, foco a `body`, una vez por sesión, sin JS no tapa | Igual en `/?dia=lunes`, `/?dia=martes`, `/` (día real), `/molotes?dia=lunes` y `/molotes?dia=sabado`, a 375 y 1440. Tab y Shift+Tab alternan entre las acciones y la interfaz del navegador; nunca llegan al fondo. Sin JS, el `<dialog>` está cerrado y mide 0 px. `/birria?dia=lunes` y `/molotes?dia=martes` no tienen aviso | Reproducido |
| §8 y estados | 403 de la editora, 404, error del formulario de producto, 503 con la `api` caída, semilla de respaldo | 403 en `/usuarios`, `/bot`, `/birria/productos` y `/birria/cotizador`; 404 sin cabecera; `role="alert"` con el foco y 10 `aria-invalid`; "Servicio no disponible." (503) al entrar con la `api` caída; `/birria` sirve las 6 tarjetas (`landing_products_fallback` y `landing_page_fallback`) | Reproducido |

### Criterios de aceptación

| CA | Estado | Evidencia |
| --- | --- | --- |
| CA-1 | PASS (con DEF-006) | Todas las superficies del alcance aparecen a 375, 768 y 1440, y la navegación de las landings a 1023/1024. "Inicio sin aviso" (`/?dia=sabado`) solo dice "Sí" a 375, sin motivo para 768 y 1440. QA midió que su DOM es igual al de `/birria` en los 6 anchos (mismo `scrollHeight`), así que la cobertura es equivalente |
| CA-2 | PASS (con DEF-001) | §5.1 y §5.2 con captura a 375 y origen; QA lo reprodujo. Las capturas de 1023/1024 de §5.1 no muestran la cabecera (DEF-001) |
| CA-3 | Pendiente de decisión (ambigüedad 1) | §6 tiene recorridos de `/birria`, `/molotes` y los avisos, todos reproducidos, pero del admin solo de `/birria/cotizador` y `/molotes/productos`. Depende de si "cada superficie" significa landings y admin (los dos bloques de "Superficies" del ticket) o cada pantalla del inventario |
| CA-4 | PASS | AUD-001 a AUD-004 dan los dos hex y el ratio; todos recalculados |
| CA-5 | PASS | AUD-007, AUD-009 y AUD-011 dan ancho × alto; medidos de nuevo |
| CA-6 | PASS | 20 de 20 con los 10 campos (P-06). AUD-008 y AUD-013 indican como criterio incumplido una regla del proyecto o un caso límite del ticket, que la plantilla admite |
| CA-7 | PASS | §10 y §11 existen y §11 cubre los 20 hallazgos |
| CA-8 | PASS sobre el árbol de trabajo (P1) | Solo el informe, las 14 capturas y el ticket. El `git diff --name-only main...HEAD` del commit lo comprueba `senior-fullstack` en T4 |
| CA-9 | PASS | La limpieza de T2 está en el ticket y QA la verificó al empezar: sin contenedores, volúmenes ni redes "auditoria", con los puertos libres y sin procesos |

### Defectos encontrados

#### DEF-001

- **Severidad:** MAJOR.
- **Criterio de aceptación afectado:** CA-6 (evidencia) y RN-2. También CA-2 en el umbral de 1024 px.
- **Descripción:** tres capturas versionadas no muestran lo que dice su pie:
  - `aud-003-cabecera-molotes-1440.jpg`, citada como "Cabecera de Molotes a 1440 px" en AUD-003 (enlace activo "Inicio") y en AUD-012 (icono de persona), muestra la franja del título del hero sin cabecera;
  - `aud-005-birria-1023-cabecera.jpg` ("Birria a 1023 px: sin navegación") y `aud-005-birria-1024-cabecera.jpg` ("Birria a 1024 px: con navegación") muestran texto del hero y no la cabecera.
- **Pasos para reproducir:** abrir las tres imágenes de `restaurante/docs/auditoria-interfaces/` y compararlas con su texto alternativo en §5.1, AUD-003 y AUD-012.
- **Resultado esperado:** cada captura muestra la cabecera, con el enlace "Inicio", el icono de persona y la navegación oculta (1023) o visible (1024).
- **Resultado actual:** recortes de la zona equivocada (el hero).
- **Evidencia:** revisión visual de QA de las 14 capturas (P-15). Las conclusiones sí se reproducen por medición: `nav.site-nav` está en `none` a 1023 y en `flex` a 1024; `#002f67`/`#1b5eb8` da 2.08 en "Inicio"; el `span` mide 32 × 32 y lleva `aria-hidden`.
- **Impacto:** el usuario decide D2 y D3 mirando el informe, y la única evidencia visual del umbral `lg` y del enlace activo contradice su pie. Los hallazgos no cambian, pero la evidencia publicada es engañosa.
- **Recomendación:** sustituir las tres capturas por recortes de la cabecera, o quitarlas y dejar la medición como evidencia (RN-2 lo admite).

#### DEF-002

- **Severidad:** MINOR.
- **Criterio afectado:** rigor de "Lo que está bien" (§1) y de §6. Es un falso negativo.
- **Descripción:** el informe afirma que todos los elementos con el foco tienen un `outline` o anillo de 2-3 px, y que en el admin es "outline de 2 px `#eab308`". En los campos de texto, contraseña, `select` y `textarea` del admin (`/usuarios/nuevo`, producto, `/cuenta` y `/molotes/pagina`), el foco solo cambia el color del borde de 1 px:
  - de `#ab8985` a `#c2410c`, un cambio de 1.64:1 entre los dos estados;
  - el `outline` es transparente y el anillo de `box-shadow` mide 0 px;
  - el borde con el foco da 3.50:1 frente al fondo `#1c1412`.

  Las casillas sí tienen un anillo de 2 px, y los enlaces y botones de la cabecera, `outline` `#eab308` (8.81:1).
- **Pasos para reproducir:** con `qa-admin` en `/usuarios/nuevo`, tabular hasta "Usuario de acceso" y comparar `getComputedStyle` con el foco y sin él, y las dos capturas.
- **Resultado esperado:** que el informe lo recoja como hallazgo (WCAG 1.4.11/2.4.7, o la regla de foco visible) o que no afirme lo contrario.
- **Resultado actual:** no aparece. Además, el informe declara en "Límites" que no midió el contraste del indicador de foco, lo que atenúa pero no corrige la afirmación positiva.
- **Impacto:** en los formularios del admin, un usuario de teclado ve el foco con dificultad. Sería un hallazgo Baja o Media del derivado A.
- **Recomendación:** añadir el hallazgo, o matizar §1 y §6.

#### DEF-003

- **Severidad:** MINOR.
- **Criterio afectado:** rigor de §2 ("Límites") y de AUD-018.
- **Descripción:** §2 dice "en Molotes no se pudo comparar con capturas del diseño porque no existen (AUD-018)". Sin embargo, `_stich_source_/moloteando_aut_nticos_molotes_artesanales/screen.png` es una imagen válida de 1280 × 4459 px (`sips`). Lo que falta de verdad es la referencia de Birria de escritorio (28 bytes de texto) y las dos móviles (miniaturas).
- **Impacto:** la comparación visual de Molotes de escritorio era posible. La descripción de AUD-018 es correcta, pero el límite declarado no lo es.
- **Recomendación:** corregir el límite y, si procede, contrastar con esa captura los hallazgos de Molotes de escritorio.

#### DEF-004

- **Severidad:** TRIVIAL.
- **Descripción:** en AUD-016 y AUD-017, "57 clases" y "34 clases" son el número de líneas con un hex. Hay 100 y 41 ocurrencias, y 53 y 15 clases únicas. Los colores distintos (42/41 y 15/2) son correctos.
- **Recomendación:** decir "líneas" u "ocurrencias".

#### DEF-005

- **Severidad:** TRIVIAL.
- **Descripción:** imprecisiones de "Lo que está bien":
  - en las landings, varios enlaces y los CTA usan el anillo por defecto del navegador (`outline: auto`). Es visible, pero no es un anillo de 2-3 px del proyecto;
  - en el admin, "Administración" (la marca) mide 28 px de alto, no 44.

  Además, la alternativa de AUD-003 da 6.29:1, no 6.26:1, aunque está dentro de la tolerancia.

#### DEF-006

- **Severidad:** TRIVIAL.
- **Criterio afectado:** CA-1.
- **Descripción:** en el inventario, "Inicio sin aviso" tiene "—" en 768 y 1440 sin motivo. Es la misma vista que `/birria`, pero el informe no lo dice.

#### Ambigüedad del requisito 1 (CA-3)

¿"Un recorrido con teclado de cada superficie" exige uno por cada pantalla del admin (acceso, Página, Usuarios, Mi cuenta, Bot, formularios y 404/503), o basta con uno de las landings y uno del admin, como hace §6?

#### Observaciones (no son defectos)

- AUD-007: los porcentajes tapados en el pie dependen de la posición del desplazamiento. QA midió 0 % en "Ver ubicación" de Molotes, frente al 40 % citado, y 13 % en el de Birria. La conclusión (tapado parcial; 2.4.11 se cumple) es la misma.
- AUD-006 a 320 px: 325 px frente a 337, por un nombre de usuario más corto.
- El `href` de WhatsApp sin `text=` es la configuración de prueba (sin mensaje). Queda fuera de alcance.
- La copia sin versionar del ticket en `.claude/docs/backlog/` del checkout principal hay que borrarla en T4.

### Exploración propia (falsos negativos y positivos)

| Caso | Resultado |
| --- | --- |
| Foco de los campos del admin | **Falso negativo confirmado** (DEF-002) |
| Contraste del anillo de foco del admin | Descartado: `#eab308` sobre `#261a17` da 8.81:1, y sobre `#1c1412`, 9.45:1 |
| Contraste del pie de las dos landings | Descartado: ningún texto del pie queda por debajo del umbral |
| Variantes de Birria ("Con Carne ($80)") y "Activar promoción" | Descartado: el texto oscuro va sobre un degradado dorado; se comprobó con una captura |
| "Para bajar el antojo" y "Promociones de Molotes" | Descartado: van sobre una imagen con capa oscura (8.8-12:1). La primera lectura daba 1.29, pero era un artefacto del desplazamiento suave |
| Encabezado del aviso abierto | Sin hallazgo: `h2` con `aria-labelledby`; un solo `h1` por página; `lang="es-MX"` |
| WhatsApp | Sin hallazgo: `target="_blank"`, `rel="noopener noreferrer"` y el texto accesible avisa de la pestaña nueva |
| Falsos positivos buscados en AUD-012, AUD-014 y AUD-009 | No son falsos positivos: los tres se reproducen |
| Origen "diseño fuente" (12 hallazgos) | Comprobado en los `code.html` y `DESIGN.md` en AUD-001, 002, 003, 004, 005, 011, 012, 013, 014, 016, 018 y 019 |
| Referencias de diseño | Hallazgo de rigor: DEF-003 |

### Regresión

- El árbol solo añade documentación, capturas y el ticket (P-18).
- No se ejecutaron `lint`, `typecheck` ni `npm test` (P3, justificado arriba).
- El filtro del CI dará `codigo=true` (P-19): el PR correrá el CI completo y el merge redesplegará producción (RT-1, asumido por el usuario).

### Responsive

Sin desborde horizontal en `/birria`, `/molotes` y `/` a 320, 375, 768, 1023, 1024 y 1440, ni en 812 × 375 y 640 × 400 con DPR 2. Tampoco en el admin a 320 y 375.

### Accesibilidad

Ver las tablas de reproducción y de exploración. Sin lector de pantalla real (el mismo límite que el informe).

### UX/UI

Las 14 capturas, revisadas una a una: 11 coinciden con su hallazgo y 3 no (DEF-001).

### Performance

No aplica (fuera de alcance).

### SEO

No aplica, salvo los encabezados: un solo `h1` por página, comprobado.

### Privacidad

- Las capturas solo muestran usuarios ficticios ("auditoria-admin" y "Editora de prueba con un nombre visible bastante largo de 60") y datos públicos del negocio que salen de `restaurante/landing-pages/src/content/common/index.ts` (teléfono y correo).
- Sin contraseñas, tokens ni metadatos.
- El informe no contiene secretos.

### Limpieza (comprobada)

- **Procesos:** las 3 apps y Chrome headless parados; `ps` sin `dev-server`, `chrome-profile` ni `qa-048`.
- **Puertos:** 3000-3004, 3307 y 9222 libres (`lsof`).
- **Docker:** `docker compose -p restaurante-qa-048 down -v` borró el contenedor, el volumen `restaurante-qa-048_mysql-dev-data` y las redes `restaurante-qa-048_default` y `restaurante-qa-048_db-test`. Después, ni volúmenes ni redes `qa-048`. `restaurante-mysql-dev-1` sigue parado, como estaba, y no se tocó.
- **Bases `restaurante_test*`:** no se ejecutó `npm test`, así que no se creó ninguna.
- **Worktree:** borrados `restaurante/node_modules`, `restaurante/packages/db/src/generated`, `restaurante/inventory-manager/public/css/main.css` y `restaurante/landing-pages/public/css/{birria,molotes}`. `git status --short --ignored` solo muestra los 3 elementos sin seguimiento del ticket.
- **Scratchpad:** `qa-048` borrado: perfil de Chrome, capturas en bruto, scripts, credenciales y archivos de entorno. Quedan los 3 archivos ajenos de antes, sin tocar.
- **Git:** `git worktree list` sigue con el principal y `req-f-048`. El checkout principal tiene el mismo `git status` que al empezar.
- **Pestañas:** no se usó Claude in Chrome.

### Pendientes de revisión manual

Ninguno.

### Resultado final

NEEDS_USER_DECISION

Preguntas:

1. **DEF-001 (MAJOR):** ¿se corrigen las tres capturas que no muestran lo que dicen (volviendo a T3 con `senior-fullstack`), o se acepta así y queda la medición como evidencia?
2. **CA-3:** ¿"cada superficie" son landings y admin (con lo que §6 basta), o hace falta un recorrido con teclado por cada pantalla del admin?
3. **DEF-002, DEF-003 y los TRIVIAL (DEF-004 a DEF-006):** ¿se corrigen en la misma vuelta de T3 o se aceptan como están?

### Ronda 2 (2026-11-18)

Revalidación tras las correcciones de `senior-fullstack`. Decisión del usuario sobre la ronda 1 (cita textual): "si las apruebo". Se corrigen DEF-001 a DEF-006, y CA-3 queda como un recorrido de cada landing y uno del admin.

#### Qué cambió desde la ronda 1

Según `git status` y los tamaños de los archivos:

- **Informe:** pasa de 20 a 21 hallazgos.
- **Capturas rehechas (3):** `aud-003-cabecera-molotes-1440`, `aud-005-birria-1023-cabecera` y `aud-005-birria-1024-cabecera`.
- **Capturas nuevas (2):** `aud-021-campo-reposo` y `aud-021-campo-foco`.
- **Resto de capturas (11):** mismo tamaño en bytes que en la ronda 1; ya se revisaron entonces.
- **Código:** ninguno.

#### Pruebas ejecutadas

| Prueba | Comando o acción | Resultado |
| --- | --- | --- |
| Estado inicial | `docker ps -a`, `lsof` en 3000-3004, 3307 y 9222, `ps`, `git worktree list` y `git status` | `restaurante-mysql-dev-1` parado (no hubo que preguntar); puertos libres; sin procesos; 2 worktrees |
| CA-8 (árbol de trabajo) | `git rev-parse HEAD main`, `git diff --name-only main...HEAD`, `git diff --name-only` y `git status --porcelain --untracked-files=all --ignored` | `HEAD` = `main` = `6d86fde`; los dos `diff` vacíos; solo el informe, 16 capturas y el ticket |
| Topes (DT-3) | `stat`, `ls`, `file`, `sips -g` y `mdls` | 16 capturas (≤ 25); la mayor, 149 683 bytes; en total, 727 431 bytes; todas JPEG válidos, sin autor, GPS ni software |
| DEF-001 | Read de imagen de las 3 rehechas y las 2 nuevas | `aud-003-cabecera-molotes-1440`: la cabecera completa, con "Inicio" activo en azul oscuro, la navegación y el icono de persona. `aud-005-birria-1023-cabecera`: solo la marca, sin navegación. `aud-005-birria-1024-cabecera`: la navegación visible ("Inicio" … "Ordenar ya!"). `aud-021-campo-reposo` y `aud-021-campo-foco`: los campos vacíos del acceso, con el borde en reposo y en naranja. Las cinco coinciden con su pie y no contienen datos personales |
| Validador (CA-6 y CA-7) | Script de la ronda 1, con 21 IDs | IDs `AUD-001`…`AUD-021` sin saltos y con los 10 campos; 2 Alta, 6 Media y 13 Baja; 13 diseño fuente y 8 implementación; 18 landings y 3 admin; cruces iguales a la tabla del §1; §11 cubre los 21 (A = AUD-006, AUD-015 y AUD-021); 16 enlaces = 16 archivos |
| DEF-002 / AUD-021 | Chrome 158 headless por CDP en un entorno aislado (`restaurante-qa-048`, apps sin bot, opción B): `getComputedStyle` en reposo y con el foco en `/acceso` (Tab real, `:focus-visible` = true), `/birria/productos/11/editar`, `/birria/cotizador`, `/molotes/pagina` y `/usuarios/nuevo` | Borde de 1 px, de `#ab8985` a `#c2410c`, en `input` de texto y de contraseña, `select` y `textarea`. `outline` sólido de 2 px transparente, sin anillo. Botones y enlaces: `outline` de 2 px `#eab308`. Ratios recalculados: 1.64, 3.50, 3.26, 5.74, 5.35 y 9.45, iguales a los citados. Origen: el `DESIGN.md` del admin, línea 233 ("1.5px border in `#c2410c` with zero outer fuzzy halo"), y las clases `border-[1.5px]` en las vistas. El §1 ya acota el `outline` de 2 px a enlaces y botones, y remite a AUD-021 para los campos |
| DEF-003 | Lectura de §2 y de AUD-018 | Recogen el `screen.png` válido de Moloteando (1280 × 4459) |
| DEF-004 | Lectura de AUD-016 y AUD-017 | 100 apariciones, 57 líneas, 53 clases y 42/41 colores; 41, 34, 15 y 15/2. Coinciden con la medición de QA en la ronda 1 |
| DEF-005 | Lectura de §1 y de AUD-003 | `outline: auto` del navegador en las landings; la marca "Administración" de 28 px; 6.29:1 |
| DEF-006 | Lectura del inventario | "Inicio sin aviso" explica que es la misma vista que `/birria` en 768 y 1440 |
| CA-3 | Lectura de §6 | Declara el alcance que decidió el usuario: un recorrido por landing, con sus avisos, y uno del admin |
| AUD-006 | Remedición a 320 y 375 px | 325 px a 320 y 273/217 px a 375. El informe ya explica que los 337 px dependen del largo del nombre de usuario (325 con uno corto) |
| AUD-007 | Remedición del pie con Tab real, el mapa cargado y el desplazamiento instantáneo | 375 px: Molotes 0 % en todos; Birria, "Ver ubicación" al 13 %. 320 px: Molotes 0 %; Birria, "Ver ubicación" al 20 % y teléfono y correo al 0 %. Difiere de la ronda 2 del informe (teléfono al 27 % y correo al 40 % a 320). El informe explica que la cifra depende del desplazamiento y del método, y todas las mediciones coinciden en que nada con el foco queda tapado por completo |
| Privacidad | `grep` de rutas, `scrypt$`, `password=`, `ghp_`, `EAA`, `WHATSAPP_BOT_*=` y correos en el informe y el ticket | El informe solo tiene `prueba@example.invalid`. En el ticket solo están las rutas locales aceptadas (P4) y nombres de variables sin valores |
| Ortografía | `grep` de formas sin tilde | Sin faltas: la única coincidencia es la ruta `/birria/pagina` |
| No repetido | Reproducción de AUD-001 a AUD-005 y AUD-008 a AUD-020, avisos y estados | No cambió lo que comprueban: ni el código ni sus mediciones. Solo cambió texto, que se revisó arriba |
| No repetido | `lint`, `typecheck` y `npm test` | Sin cambios de código (P3) |

#### Estado de los defectos

| Defecto | Estado |
| --- | --- |
| DEF-001 (MAJOR) | Corregido |
| DEF-002 (MINOR) | Corregido: AUD-021 reproducido |
| DEF-003 (MINOR) | Corregido |
| DEF-004 (TRIVIAL) | Corregido |
| DEF-005 (TRIVIAL) | Corregido |
| DEF-006 (TRIVIAL) | Corregido |

**Observación, no es un defecto:** "Límites" y el §1 siguen diciendo que no se midió el contraste del indicador de foco. Para los campos del admin ya se midió en AUD-021. La frase vale para el resto de indicadores y no cambia ninguna conclusión.

#### Criterios de aceptación

| CA | Estado |
| --- | --- |
| CA-1 | PASS (DEF-006 corregido) |
| CA-2 | PASS (capturas de 1023 y 1024 correctas) |
| CA-3 | PASS, con el alcance decidido por el usuario |
| CA-4 | PASS (AUD-021 incluido) |
| CA-5 | PASS |
| CA-6 | PASS (21 de 21) |
| CA-7 | PASS (§11 cubre los 21) |
| CA-8 | PASS sobre el árbol de trabajo (P1). La comprobación sobre el commit la hace `senior-fullstack` antes de abrir el PR |
| CA-9 | PASS |

#### Limpieza (comprobada)

- **Procesos:** las 3 apps y Chrome headless, parados; `ps` sin `dev-server`, `chrome-profile` ni `qa-048`.
- **Puertos:** 3000-3004, 3307 y 9222, libres.
- **Docker:** `docker compose -p restaurante-qa-048 down -v` quitó el contenedor, el volumen y las redes `default` y `db-test`; no quedan volúmenes ni redes `qa-048`. `restaurante-mysql-dev-1` sigue parado, como estaba.
- **Bases `restaurante_test*`:** no se ejecutó `npm test`, así que no se creó ninguna.
- **Worktree:** borrados `restaurante/node_modules`, `packages/db/src/generated` y el CSS generado. `git status --ignored` solo muestra los 3 elementos sin seguimiento.
- **Scratchpad:** `qa-048` borrado, con las credenciales, los archivos de entorno, el perfil de Chrome y los scripts. Quedan los 3 archivos ajenos de antes, sin tocar.
- **Checkout principal:** el mismo `git status` que al empezar (la copia vieja del ticket en `backlog/`, que se borra en T4).
- **Otros:** `git worktree list` sin cambios; no se usó Claude in Chrome.

#### Resultado final

QA_APPROVED

## Historial de cambios

### Versión 1

Descripción inicial: la auditoría de interfaces y navegación de las landings y del admin, que incluye la navegación móvil. El usuario aprobó las recomendaciones D0, D1 y D1b.

### Revisión técnica (2026-11-18)

`senior-fullstack` añade la "Revisión técnica" (RT-1 a RT-7) y el "Technical Action Plan", con las decisiones técnicas DT-1 a DT-4. Estado: `NEEDS_TECHNICAL_PLAN_APPROVAL`. El ticket sigue en `backlog/`, sin versionar.

### Implementación (2026-11-18)

El usuario aprobó el plan con DT-1 A y las recomendaciones de DT-1b a DT-4. `senior-fullstack` creó la rama `feature/REQ-F-048-auditoria-interfaces-navegacion` en el worktree `/Users/orvigas/Desktop/Negocio-worktrees/req-f-048` y copió el ticket a `in-progress/`. Después hizo la auditoría en el entorno local aislado, redactó el informe con 18 hallazgos y 14 capturas, limpió el entorno y escribió el "Implementation Result". Sin commits. Estado: `NEEDS_IMPLEMENTATION_APPROVAL`, a la espera de la revisión de `a11y-architect` (DT-4) y de la aprobación del usuario.

### Correcciones tras la revisión de `a11y-architect` (2026-11-18)

Veredicto: "APTO CON CORRECCIONES".

Para remedir se levantó solo `landing-pages` (con la semilla; sin `api` ni MySQL) y Chrome headless, con archivos en `<scratchpad>/req-f-048b`. Después se limpió todo: procesos parados, puertos 3000-3004, 3307 y 9222 libres, el directorio borrado y ningún contenedor "auditoria".

Correcciones obligatorias:

1. **AUD-004:** el peor caso del antetítulo es 2.58:1 (2.72 era la mediana) y la recomendación pasa a un objetivo de ≥ 4.5:1 con un fondo opaco o `#7c2d12` o `#0b1d3a`.
2. **AUD-003:** "Toque gourmet" (4.02:1, 9 px) pasa a ser un incumplimiento.
3. **AUD-007:** se remidió el foco en el pie, a 375 y a 320 px. Los textos legales no reciben el foco, y el peor caso es un 40 % tapado, en "Ver ubicación" de Molotes a 375. 2.4.11 se cumple y AUD-007 se queda en Media, con el texto "tapa parcialmente".
4. **AUD-010:** también hay 16 paradas en Molotes. Antes no se vieron por `loading="lazy"`. Ahora cubre las dos landings y anota que los dos iframes tienen `title`.
5. **§6:** quitada la "interfaz del navegador".
6. **§8:** "error" y "éxito" de las landings se probaron con el formulario del club, con valores ficticios y sin red. De ahí salen dos hallazgos nuevos, AUD-019 y AUD-020.
7. **AUD-002:** añadidos los fondos del peor caso y la nota sobre `text-shadow`.
8. **§1:** acotado "Lo que está bien".
9. **AUD-005 y AUD-014:** posible incumplimiento de 1.4.10 por interpretación, y 1.4.4 y 1.4.10 se cumplen solo en cuanto a desborde.

Conteos: de 18 a 20 hallazgos (Baja de 11 a 13; diseño fuente, 12; implementación, 8; landings, 18). Las capturas siguen siendo las mismas 14.

### QA, ronda 1 (2026-11-18)

El usuario aprobó la implementación ("Sí, apruebo la implementación, pasa a QA") y después el QA Action Plan ("si lo apruebo"). `senior-qa` escribió el plan y ejecutó la ronda 1 en un entorno aislado (`restaurante-qa-048`), que limpió al terminar.

- Reprodujo los 20 hallazgos y CA-1, CA-2 y CA-4 a CA-9.
- Encontró DEF-001 (MAJOR: 3 capturas no muestran lo que dicen), DEF-002 y DEF-003 (MINOR) y DEF-004 a DEF-006 (TRIVIAL), además de una ambigüedad en CA-3.

Estado: `NEEDS_USER_DECISION`.

### Correcciones tras QA ronda 1 (2026-11-18)

El usuario decidió ("si las apruebo") que se corrijan DEF-001 a DEF-006 y que CA-3 se cumpla con un recorrido por landing (con sus avisos) y uno del admin. `senior-fullstack` rehízo las 3 capturas de cabecera, revisó las 16 una a una y añadió AUD-021, el foco de los campos del admin. También aplicó DEF-003 a DEF-006 y matizó las cifras de AUD-002, AUD-004, AUD-006 y AUD-007 con su propia remedición. Volvió a levantar el entorno aislado y lo limpió después, comprobándolo. Conteos: 21 hallazgos (2 Alta, 6 Media y 13 Baja). Sin commits. Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

### QA, ronda 2 (2026-11-18)

El usuario pidió cerrar el ticket ("Finaliza REQ-F-048"). `senior-qa` revalidó las correcciones en un entorno aislado (`restaurante-qa-048`) y lo limpió al terminar:

- DEF-001 a DEF-006, corregidos;
- AUD-021, reproducido;
- 21 hallazgos con los conteos cuadrados;
- CA-1 a CA-9 en PASS (CA-8 sobre el árbol de trabajo).

Estado: `QA_APPROVED`.

### Commit y Pull Request (2026-11-18)

El usuario pidió cerrar el ticket, cita textual: "Finaliza REQ-F-048". `senior-fullstack` borró la copia vieja del ticket que seguía sin versionar en `backlog/` del checkout principal. Después hizo el commit `03c773e` (informe, 16 capturas y ticket; CA-8 comprobado: 18 archivos) y abrió el PR #178 hacia `main`, en borrador. Estado: `READY_FOR_MERGE`. El resultado del CI se informa en el PR y a la sesión principal.

### Cierre (2026-11-18)

El usuario mergeó el PR #178 (https://github.com/orvigas/negocio/pull/178) en `main` (`cebafed`) y pidió cerrar el ticket, cita textual: "Finaliza REQ-F-048". El CI de `main` (ejecución 44421245636) terminó en `success`, con `publish`, `vigente` y `deploy` en `success`, y producción quedó sana. `senior-fullstack` movió el ticket a `done/` (rama `chore/cierra-req-f-048`, PR a `main`) y añadió el "Seguimiento" con las decisiones D2 y D3 pendientes, la propuesta de derivados A, B1, B2, C y D (sin abrir) y lo no hecho. Estado: `DONE`.
