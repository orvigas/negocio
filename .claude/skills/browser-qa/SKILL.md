---
name: browser-qa
description: "Ejecuta la verificación automatizada de la UI tras un despliegue con un MCP de automatización de navegador (claude-in-chrome, Playwright o Puppeteer): comprobaciones de humo de errores de consola y Core Web Vitals, pruebas de interacción de formularios y del flujo de autenticación, regresión visual con capturas en tres breakpoints y auditorías de accesibilidad con axe-core, que terminan en un veredicto SHIP / DO-NOT-SHIP. Úsalo al probar una funcionalidad desplegada en staging o en preview, antes de publicar cambios de frontend, al revisar un PR de frontend o al comprobar la maquetación responsiva y la accesibilidad."
metadata:
  origin: ECC
---

<!-- Traducción al español de `skills/browser-qa/SKILL.md` de affaan-m/ECC (licencia MIT), con una sección final de adaptación a este proyecto. -->

# Browser QA — Pruebas visuales e interacción automatizadas

## Cuándo usarlo

- Después de desplegar una funcionalidad en staging/preview
- Cuando necesitas verificar el comportamiento de la UI en varias páginas
- Antes de publicar: confirmar que la maquetación, los formularios y las interacciones funcionan de verdad
- Al revisar PR que tocan código de frontend
- Auditorías de accesibilidad y pruebas responsivas

## Cómo funciona

Usa el MCP de automatización de navegador (claude-in-chrome, Playwright o Puppeteer) para interactuar con páginas en vivo como lo haría un usuario real.

### La seguridad primero: radio de impacto (por defecto, solo lectura)

Browser QA ejerce autenticación real y recorridos de usuario reales, así que trata el radio de impacto de forma explícita.
Por defecto, **solo lectura**: nunca ejecutes un recorrido **que modifique datos** (checkout, pago, borrado,
actualización masiva) contra una URL de producción; exige una autorización explícita **y** una URL de staging/preview.
Usa **credenciales de prueba** sembradas, nunca inicios de sesión reales de producción, y **oculta**
credenciales, tokens y datos personales (PII) antes de guardar cualquier captura.

### Fase 1: Prueba de humo
```
1. Navegar a la URL objetivo
2. Buscar errores de consola (filtrar el ruido: analítica, terceros)
3. Verificar que no haya 4xx/5xx en las peticiones de red
4. Capturar la parte visible sin desplazamiento en viewport de escritorio + móvil
5. Comprobar Core Web Vitals: LCP < 2.5s, CLS < 0.1, INP < 200ms
   (INP sustituyó a FID en marzo de 2024; umbrales según web.dev)
```

### Fase 2: Prueba de interacción
```
1. Hacer clic en cada enlace de navegación: verificar que no haya enlaces rotos
2. Enviar formularios con datos válidos: verificar el estado de éxito
3. Enviar formularios con datos no válidos: verificar el estado de error
4. Probar el flujo de autenticación: inicio de sesión → página protegida → cierre de sesión (solo credenciales de prueba, nunca de producción)
5. Probar los recorridos críticos del usuario (checkout, onboarding, búsqueda)
   — por defecto solo lectura; ejercitar los recorridos que modifican datos solo contra staging
     con autorización explícita (ver «La seguridad primero» arriba)
```

### Fase 3: Regresión visual
```
1. Capturar las páginas clave en 3 breakpoints (375px, 768px, 1440px)
2. Comparar con las capturas de referencia versionadas
   — sin referencia ⇒ informar INCONCLUSIVE, nunca un PASS silencioso
3. Señalar desplazamientos de maquetación > 5px, elementos ausentes, desbordamientos
4. Comprobar el modo oscuro si aplica
```

### Fase 4: Accesibilidad
```
1. Ejecutar axe-core o equivalente en cada página
2. Señalar las infracciones de WCAG 2.2 AA (contraste, etiquetas, orden del foco)
3. Verificar que la navegación con teclado funcione de principio a fin
4. Comprobar los landmarks para lectores de pantalla
```

> Nota: axe-core cubre automáticamente alrededor del 30–40 % de WCAG. Una ejecución limpia es **necesaria,
> pero no suficiente**: la navegación con teclado, el orden del foco y una pasada con lector de pantalla siguen
> requiriendo una comprobación manual. No declares «accesible» solo con una pasada automatizada.

## Formato de salida

```markdown
## Informe de QA — [URL] — [marca de tiempo]

### Prueba de humo
- Errores de consola: 0 críticos, 2 avisos (ruido de analítica)
- Red: todo 200/304, sin fallos
- Core Web Vitals: LCP 1.2s ✓, CLS 0.02 ✓, INP 89ms ✓

### Interacciones
- [✓] Enlaces de navegación: 12/12 funcionan
- [✗] Formulario de contacto: falta el estado de error para un correo no válido
- [✓] Flujo de autenticación: inicio y cierre de sesión funcionan

### Visual
- [✗] La sección hero se desborda en el viewport de 375px
- [✓] Modo oscuro: todas las páginas consistentes

### Accesibilidad
- 2 infracciones AA: falta texto alternativo en la imagen del hero, contraste bajo en los enlaces del pie

### Veredicto: SHIP WITH FIXES (2 problemas, 0 bloqueantes)
# veredicto ∈ SHIP / SHIP WITH FIXES / DO NOT SHIP; usar INCONCLUSIVE si no hay referencia visual
```

## Integración

Funciona con cualquier MCP de navegador:
- Herramientas `mcp__claude-in-chrome__*` (preferidas: usan tu Chrome real)
- Playwright mediante `mcp__browserbase__*`
- Scripts directos de Puppeteer

Combínalo con `/canary-watch` para el monitoreo posterior al despliegue.

## Adaptación a este proyecto

Esta sección no forma parte de la traducción: la añade el proyecto y **prevalece sobre el texto anterior** donde lo contradiga.

- **Herramienta:** Claude in Chrome (`mcp__claude-in-chrome__*`; lee antes la skill `claude-in-chrome`) o, si está disponible, el MCP de Playwright. No hay `mcp__browserbase__*`, ni Puppeteer, ni axe-core como dependencia: no los instales (`.claude/rules/dependencias.md`). La auditoría de accesibilidad se hace con el árbol de accesibilidad del navegador y comprobaciones manuales; si hace falta axe-core, solo con autorización del usuario y sin añadirlo a ningún `package.json`. Abre pestañas nuevas y ciérralas al terminar.
- **Por defecto, solo lectura.** Prioriza el servidor local (`npm run dev`) o un entorno de pruebas. En **producción** (`https://birriaelmuneco.com/`, `/molotes`, `/birria` y `https://admin.birriaelmuneco.com/`) solo comprobaciones de lectura: navegar, consola, red, capturas y accesibilidad. **Nunca** envíes formularios con datos reales, no inicies sesión en el admin de producción, no modifiques productos, datos de página, usuarios ni el control del bot, y no envíes mensajes al bot de WhatsApp. El límite de tasa del admin (429) existe a propósito: pocas peticiones y espaciadas.
- **Flujo de autenticación (fase 2):** solo en local, con las cuentas que cree la propia prueba; nunca credenciales reales. Las capturas no deben mostrar contraseñas, tokens, cookies ni datos de clientes.
- **Qué comprobar en las landings:** `h1`, navegación, pie, botón de pedidos de WhatsApp (`.claude/CLAUDE.md` §6) y los avisos del día (modal), que dependen de la fecha del negocio (`BUSINESS_TIMEZONE`): un aviso distinto según el día no es una regresión. No hay modo oscuro: omite ese punto.
- **`./_stich_source_/` prevalece:** la referencia visual es el diseño fuente. No hay capturas de referencia versionadas en el repositorio; sin referencia, el resultado visual es INCONCLUSIVE, como dice el original, y no se versionan capturas nuevas salvo que el usuario lo pida.
- **Complementa a `canary-watch`** (`.claude/skills/canary-watch/SKILL.md`): esa vigila el estado, las cabeceras y la consola tras el despliegue; esta ejerce la UI. No hay comando `/canary-watch` ni `/browser-qa`: se invocan en lenguaje natural.
- **Umbrales:** los de Core Web Vitals son orientativos (línea base de este sitio); el CI no los impone.
- **Orquestación (`.claude/CLAUDE.md` §4):** los subagentes no invocan a otros subagentes ni esperan al usuario; la sesión principal orquesta. Ningún agente hace commits ni PR por su cuenta salvo `senior-fullstack` en su fase.
- **Pruebas y limpieza:** el informe es evidencia del ticket o del PR, no una prueba permanente (`.claude/rules/testing.md`). Al terminar, cierra pestañas y procesos, y borra capturas y archivos temporales que ya no hagan falta.
- **Privacidad:** ni capturas, ni datos personales, ni credenciales, ni información de producción salen hacia servicios externos.
- El informe va en español; los veredictos (`SHIP`, `SHIP WITH FIXES`, `DO NOT SHIP`, `INCONCLUSIVE`) se conservan tal cual.
