---
name: design-system
description: "Genera un sistema de diseño a partir de una base de código existente o audita uno para comprobar su consistencia visual: extrae tokens (colores, tipografía, espaciado, sombras) a design-tokens.json y a propiedades personalizadas de CSS con la justificación en DESIGN.md y una vista previa HTML interactiva, puntúa la UI en 10 dimensiones y señala patrones de «AI slop» (diseño genérico generado por IA). Úsalo al iniciar un sistema de diseño, al auditar la consistencia visual antes de un rediseño o al revisar un PR que toque los estilos."
metadata:
  origin: ECC
---

<!-- Traducción al español de `skills/design-system/SKILL.md` de affaan-m/ECC (licencia MIT), con una sección final de adaptación a este proyecto. -->

# Sistema de diseño — Generar y auditar sistemas visuales

## Cuándo usarlo

- Al iniciar un proyecto nuevo que necesita un sistema de diseño
- Al auditar la consistencia visual de una base de código existente
- Antes de un rediseño, para entender lo que ya tienes
- Cuando la UI «no se ve bien» pero no logras precisar por qué
- Al revisar PR que tocan los estilos

## Cómo funciona

### Modo 1: Generar el sistema de diseño

Analiza tu base de código y genera un sistema de diseño cohesionado:

```
1. Recorrer CSS/Tailwind/styled-components en busca de patrones existentes
2. Extraer: colores, tipografía, espaciado, radios de borde, sombras, breakpoints
3. Investigar 3 sitios de la competencia como inspiración (mediante un MCP de navegador)
4. Proponer un conjunto de tokens de diseño (JSON + propiedades personalizadas de CSS)
5. Generar DESIGN.md con la justificación de cada decisión
6. Crear una página HTML de vista previa interactiva (autocontenida, sin dependencias)
```

Salida: `DESIGN.md` + `design-tokens.json` + `design-preview.html`

### Modo 2: Auditoría visual

Puntúa tu UI en 10 dimensiones (de 0 a 10 cada una):

```
1. Consistencia del color: ¿usas tu paleta o valores hexadecimales al azar?
2. Jerarquía tipográfica: ¿h1 > h2 > h3 > cuerpo > pie de foto, con claridad?
3. Ritmo del espaciado: ¿escala consistente (4px/8px/16px) o arbitraria?
4. Consistencia de los componentes: ¿los elementos similares se ven similares?
5. Comportamiento responsivo: ¿fluido o roto en los breakpoints?
6. Modo oscuro: ¿completo o a medias?
7. Animación: ¿con propósito o gratuita?
8. Accesibilidad: relaciones de contraste, estados de foco, objetivos táctiles
9. Densidad de información: ¿abarrotada o limpia?
10. Acabado: estados hover, transiciones, estados de carga, estados vacíos
```

Cada dimensión recibe una puntuación, ejemplos concretos y una corrección con el archivo:línea exacto.

### Modo 3: Detección de «AI slop»

Identifica patrones de diseño genéricos generados por IA:

```
- Degradados gratuitos en todo
- Morado a azul por defecto
- Tarjetas «glassmorphism» sin propósito
- Esquinas redondeadas en cosas que no deberían serlo
- Animaciones excesivas al hacer scroll
- Hero genérico con texto centrado sobre un degradado de archivo
- Pila de fuentes sans-serif sin personalidad
```

## Ejemplos

**Generar para una app SaaS:**
```
/design-system generate --style minimal --palette earth-tones
```

**Auditar la UI existente:**
```
/design-system audit --url http://localhost:3000 --pages / /pricing /docs
```

**Buscar «AI slop»:**
```
/design-system slop-check
```

## Adaptación a este proyecto

Esta sección no forma parte de la traducción: la añade el proyecto y **prevalece sobre el texto anterior** donde lo contradiga.

- **Stack real:** Koa con SSR, HTML5 semántico, Tailwind CSS v4 (una hoja por landing; fuentes en `restaurante/landing-pages/src/styles/` y `restaurante/inventory-manager/src/styles/`), BEM y JavaScript Vanilla; TypeScript solo en el backend, sin React. Las landings están en `landing-pages` y el admin en `inventory-manager`. No hay styled-components.
- **`./_stich_source_/` prevalece.** El sistema de diseño de las landings ya está definido ahí: el modo 1 no propone una paleta, una tipografía ni unos tokens nuevos que lo sustituyan. Los tokens se extraen de `_stich_source_/` y de los `@theme` de Tailwind existentes, y solo se propone algo nuevo donde el diseño fuente no define nada (con Stitch y la aprobación del usuario; `.claude/rules/stitch-diseno.md`).
- **No hay comando `/design-system`.** Se invoca en lenguaje natural. `DESIGN.md`, `design-tokens.json` y `design-preview.html` no se crean en el repositorio salvo que el usuario lo pida: por defecto van al scratchpad de la sesión y se borran al terminar.
- **Investigación de la competencia:** solo con autorización del usuario, sin enviar datos del proyecto, datos personales, credenciales ni información de producción a servicios externos.
- **Auditoría (modo 2):** contra el servidor local (`npm run dev`), no contra producción. La dimensión «modo oscuro» no aplica: el proyecto no tiene modo oscuro. Contrasta la accesibilidad con `.claude/rules/accesibilidad.md`.
- **Orquestación (`.claude/CLAUDE.md` §4):** los subagentes no invocan a otros subagentes ni esperan al usuario; la sesión principal orquesta. Las correcciones las implementa `senior-fullstack`, el único que hace commits y PR, en su fase.
- **Pruebas:** la auditoría es evidencia, no una prueba permanente (`.claude/rules/testing.md`); limpia procesos, pestañas y archivos temporales.
- **CodeGraph primero** para el código indexado; Read y Grep para CSS, HTML y `_stich_source_/`.
