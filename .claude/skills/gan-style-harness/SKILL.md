---
name: gan-style-harness
description: "Arnés de agentes generador-evaluador inspirado en las GAN para construir aplicaciones de alta calidad de forma autónoma. Basado en el artículo de Anthropic sobre diseño de arneses de marzo de 2026. Úsalo cuando una funcionalidad deba construirse de forma autónoma mediante iteraciones de generador y evaluador hasta superar un listón de calidad."
metadata:
  origin: ECC-community
tools: Read, Write, Edit, Bash, Grep, Glob, Task, mcp__codegraph__codegraph_explore
---

<!-- Traducción al español de `skills/gan-style-harness/SKILL.md` de affaan-m/ECC (licencia MIT), con una sección final de adaptación a este proyecto. -->

# Skill del arnés al estilo GAN

> Inspirada en [Harness Design for Long-Running Application Development de Anthropic](https://www.anthropic.com/engineering/harness-design-long-running-apps) (24 de marzo de 2026)

Un arnés multiagente que separa la **generación** de la **evaluación** y crea un ciclo de retroalimentación adversarial que lleva la calidad mucho más allá de lo que puede lograr un único agente.

## Idea central

> Cuando se les pide evaluar su propio trabajo, los agentes son optimistas patológicos: elogian resultados mediocres y se convencen de descartar problemas legítimos. Pero diseñar un **evaluador independiente** para que sea implacablemente estricto es mucho más abordable que enseñar a un generador a autocriticarse.

Es la misma dinámica que la de las GAN (redes generativas adversariales): el generador produce, el evaluador critica y esa retroalimentación impulsa la siguiente iteración.

## Cuándo usarla

- Al construir aplicaciones completas a partir de un prompt de una línea
- En tareas de diseño frontend que requieren una calidad visual alta
- En proyectos full-stack que necesitan funcionalidades que funcionen, no solo código
- En cualquier tarea en la que la estética de «AI slop» sea inaceptable
- En proyectos en los que quieras invertir 50-200 $ para obtener un resultado con calidad de producción

## Cuándo NO usarla

- Correcciones rápidas de un solo archivo (usa el `claude -p` estándar)
- Tareas con restricciones de presupuesto ajustadas (<10 $)
- Refactorizaciones sencillas (usa en su lugar el patrón de-sloppify)
- Tareas que ya están bien especificadas con pruebas (usa el flujo TDD)

## Arquitectura

```
                    ┌──────────────┐
                    │ PLANIFICADOR │
                    │   (Sonnet)   │
                    └──────┬───────┘
                           │ Especificación de producto
                           │ (funcionalidades, sprints, dirección de diseño)
                           ▼
              ┌────────────────────────┐
              │                        │
              │  CICLO DE RETROALIM.   │
              │  GENERADOR-EVALUADOR   │
              │                        │
              │  ┌──────────┐          │
              │  │GENERADOR │-construye│──┐
              │  │ (Sonnet) │          │  │
              │  └────▲─────┘          │  │
              │       │                │  │ app en vivo
              │  retroalimentación     │  │
              │       │                │  │
              │  ┌────┴─────┐          │  │
              │  │EVALUADOR │<-prueba--│──┘
              │  │ (Sonnet) │          │
              │  │+Playwright│         │
              │  └──────────┘          │
              │                        │
              │   5-15 iteraciones     │
              └────────────────────────┘
```

## Los tres agentes

### 1. Agente planificador

**Función:** gerente de producto: amplía un prompt breve hasta una especificación de producto completa.

**Comportamientos clave:**
- Toma un prompt de una línea y produce una especificación de 16 funcionalidades y varios sprints
- Define historias de usuario, requisitos técnicos y la dirección del diseño visual
- Es deliberadamente **ambicioso**: una planificación conservadora conduce a resultados decepcionantes
- Produce los criterios de evaluación que el evaluador usará después

**Modelo:** Sonnet por defecto; súbelo con `GAN_PLANNER_MODEL=opus` para una ampliación más profunda de la especificación

### 2. Agente generador

**Función:** desarrollador: implementa las funcionalidades según la especificación.

**Comportamientos clave:**
- Trabaja en sprints estructurados (o en modo continuo con modelos más recientes)
- Negocia un «contrato de sprint» con el evaluador antes de escribir código
- Usa herramientas full-stack: React, FastAPI/Express, bases de datos, CSS
- Gestiona git para el control de versiones entre iteraciones
- Lee la retroalimentación del evaluador y la incorpora en la siguiente iteración

**Modelo:** Sonnet por defecto; súbelo con `GAN_GENERATOR_MODEL=opus` para la máxima capacidad de programación

### 3. Agente evaluador

**Función:** ingeniero de QA: prueba la aplicación en ejecución, no solo el código.

**Comportamientos clave:**
- Usa el **MCP de Playwright** para interactuar con la aplicación en vivo
- Recorre las funcionalidades con clics, rellena formularios, prueba los endpoints de la API
- Puntúa según cuatro criterios (configurables):
  1. **Calidad del diseño**: ¿se siente como un todo coherente?
  2. **Originalidad**: ¿decisiones propias o patrones de plantilla/IA?
  3. **Oficio**: ¿tipografía, espaciado, animaciones, microinteracciones?
  4. **Funcionalidad**: ¿funcionan de verdad todas las funcionalidades?
- Devuelve una retroalimentación estructurada con puntuaciones y problemas concretos
- Está diseñado para ser **implacablemente estricto**: nunca elogia un trabajo mediocre

**Modelo:** Sonnet por defecto; súbelo con `GAN_EVALUATOR_MODEL=opus` para un juicio y un uso de herramientas más sólidos

## Criterios de evaluación

Los cuatro criterios por defecto, cada uno puntuado de 1 a 10:

```markdown
## Rúbrica de evaluación

### Calidad del diseño (peso: 0.3)
- 1-3: Estética genérica, de plantilla, de "AI slop"
- 4-6: Competente pero anodino, sigue las convenciones
- 7-8: Identidad visual distintiva y cohesionada
- 9-10: Podría pasar por el trabajo de un diseñador profesional

### Originalidad (peso: 0.2)
- 1-3: Colores por defecto, maquetaciones de archivo, sin personalidad
- 4-6: Algunas decisiones propias, sobre todo patrones estándar
- 7-8: Visión creativa clara, enfoque único
- 9-10: Sorprendente, encantadora, verdaderamente novedosa

### Oficio (peso: 0.3)
- 1-3: Maquetaciones rotas, estados ausentes, sin animaciones
- 4-6: Funciona pero se siente tosca, espaciado inconsistente
- 7-8: Pulida, transiciones fluidas, responsiva
- 9-10: Perfecta al píxel, microinteracciones encantadoras

### Funcionalidad (peso: 0.2)
- 1-3: Funcionalidades principales rotas o ausentes
- 4-6: El camino feliz funciona, los casos límite fallan
- 7-8: Todas las funcionalidades funcionan, buen manejo de errores
- 9-10: A prueba de balas, maneja todos los casos límite
```

### Puntuación

- **Puntuación ponderada** = suma de (criterion_score * weight)
- **Umbral para aprobar** = 7.0 (configurable)
- **Máximo de iteraciones** = 15 (configurable; normalmente bastan 5-15)

## Uso

### Mediante comando

```bash
# Arnés completo de tres agentes
/project:gan-build "Construye una app de gestión de proyectos con tableros Kanban, colaboración en equipo y modo oscuro"

# Con configuración personalizada
/project:gan-build "Construye una plataforma para compartir recetas" --max-iterations 10 --pass-threshold 7.5

# Modo de diseño frontend (solo generador + evaluador, sin planificador)
/project:gan-design "Crea una landing page para un rastreador de carteras de criptomonedas"
```

### Mediante script de shell

```bash
# Uso básico
./scripts/gan-harness.sh "Construye un panel de streaming de música"

# Con opciones
GAN_MAX_ITERATIONS=10 \
GAN_PASS_THRESHOLD=7.5 \
GAN_EVAL_CRITERIA="functionality,performance,security" \
./scripts/gan-harness.sh "Construye una API REST para gestionar tareas"
```

### Mediante Claude Code (manual)

```bash
# Paso 1: Planificar
claude -p --model sonnet "Eres un planificador de producto. Lee PLANNER_PROMPT.md. Amplía este encargo hasta una especificación de producto completa: 'Construye una app de tablero Kanban'. Escribe la especificación en spec.md"

# Paso 2: Generar (iteración 1)
claude -p --model sonnet "Eres un generador. Lee spec.md. Implementa el sprint 1. Arranca el servidor de desarrollo en el puerto 3000."

# Paso 3: Evaluar (iteración 1)
claude -p --model sonnet --allowedTools "Read,Bash,mcp__playwright__*" "Eres un evaluador. Lee EVALUATOR_PROMPT.md. Prueba la app en vivo en http://localhost:3000. Puntúa según la rúbrica. Escribe la retroalimentación en feedback-001.md"

# Paso 4: Generar (iteración 2: lee la retroalimentación)
claude -p --model sonnet "Eres un generador. Lee spec.md y feedback-001.md. Atiende todos los problemas. Mejora las puntuaciones."

# Repite los pasos 3-4 hasta alcanzar el umbral para aprobar
```

## Evolución según las capacidades del modelo

El arnés debería simplificarse a medida que mejoran los modelos. Siguiendo la evolución de Anthropic:

### Etapa 1 — Modelos más débiles (clase Sonnet)
- Se requiere la descomposición completa en sprints
- Reinicios del contexto entre sprints (evitan la ansiedad de contexto)
- Mínimo de 2 agentes: inicializador + agente de programación
- Un andamiaje pesado compensa las limitaciones del modelo

### Etapa 2 — Modelos capaces (clase Opus 4.5)
- Arnés completo de 3 agentes: planificador + generador + evaluador
- Contratos de sprint antes de cada fase de implementación
- Descomposición en 10 sprints para apps complejas
- Los reinicios del contexto siguen siendo útiles, pero menos críticos

### Etapa 3 — Modelos de frontera (clase Opus 4.6)
- Arnés simplificado: una sola pasada de planificación, generación continua
- La evaluación se reduce a una sola pasada final (el modelo es más inteligente)
- No hace falta la estructura de sprints
- La compactación automática gestiona el crecimiento del contexto

> **Principio clave:** cada componente del arnés codifica una suposición sobre lo que el modelo no puede hacer solo. Cuando los modelos mejoran, vuelve a comprobar esas suposiciones. Elimina lo que ya no haga falta.

## Configuración

### Variables de entorno

| Variable | Valor por defecto | Descripción |
|----------|---------|-------------|
| `GAN_MAX_ITERATIONS` | `15` | Máximo de ciclos generador-evaluador |
| `GAN_PASS_THRESHOLD` | `7.0` | Puntuación ponderada para aprobar (1-10) |
| `GAN_PLANNER_MODEL` | `sonnet` | Modelo del agente planificador |
| `GAN_GENERATOR_MODEL` | `sonnet` | Modelo del agente generador |
| `GAN_EVALUATOR_MODEL` | `sonnet` | Modelo del agente evaluador |
| `GAN_EVAL_CRITERIA` | `design,originality,craft,functionality` | Criterios separados por comas |
| `GAN_DEV_SERVER_PORT` | `3000` | Puerto de la app en vivo |
| `GAN_DEV_SERVER_CMD` | `npm run dev` | Comando para arrancar el servidor de desarrollo |
| `GAN_PROJECT_DIR` | `.` | Directorio de trabajo del proyecto |
| `GAN_SKIP_PLANNER` | `false` | Omitir el planificador y usar directamente la especificación |
| `GAN_EVAL_MODE` | `playwright` | `playwright`, `screenshot` o `code-only` |

### Modos de evaluación

| Modo | Herramientas | Ideal para |
|------|-------|----------|
| `playwright` | MCP de navegador + interacción en vivo | Apps full-stack con UI |
| `screenshot` | Capturas + análisis visual | Sitios estáticos, solo diseño |
| `code-only` | Pruebas + lint + compilación | API, bibliotecas, herramientas CLI |

## Antipatrones

1. **Evaluador demasiado indulgente**: si el evaluador lo aprueba todo en la iteración 1, tu rúbrica es demasiado generosa. Endurece los criterios de puntuación y añade penalizaciones explícitas para los patrones habituales de la IA.

2. **Generador que ignora la retroalimentación**: asegúrate de que la retroalimentación se pase como archivo, no en línea. El generador debe leer `feedback-NNN.md` al inicio de cada iteración.

3. **Bucles infinitos**: fija siempre `GAN_MAX_ITERATIONS`. Si el generador no consigue superar una meseta de puntuación tras 3 iteraciones, detente y márcalo para revisión humana.

4. **Evaluador que prueba superficialmente**: el evaluador debe usar Playwright para **interactuar** con la app en vivo, no solo para capturarla. Hacer clic en botones, rellenar formularios, probar los estados de error.

5. **Evaluador que elogia sus propias correcciones**: no dejes nunca que el evaluador sugiera correcciones y luego evalúe esas correcciones. El evaluador solo critica; el generador corrige.

6. **Agotamiento del contexto**: en sesiones largas, usa la compactación automática del Claude Agent SDK o reinicia el contexto entre fases importantes.

## Resultados: qué esperar

Según los resultados publicados por Anthropic:

| Métrica | Agente solo | Arnés GAN | Mejora |
|--------|-----------|-------------|-------------|
| Tiempo | 20 min | 4-6 horas | 12-18 veces más |
| Coste | 9 $ | 125-200 $ | 14-22 veces más |
| Calidad | Apenas funcional | Lista para producción | Cambio de fase |
| Funcionalidades principales | Rotas | Todas funcionan | N/A |
| Diseño | «AI slop» genérico | Distintivo, pulido | N/A |

**La contrapartida está clara:** unas 20 veces más de tiempo y coste a cambio de un salto cualitativo en la calidad del resultado. Es para proyectos en los que la calidad importa.

## Referencias

- [Anthropic: Harness Design for Long-Running Apps](https://www.anthropic.com/engineering/harness-design-long-running-apps): artículo original de Prithvi Rajasekaran
- [Epsilla: The GAN-Style Agent Loop](https://www.epsilla.com/blogs/anthropic-harness-engineering-multi-agent-gan-architecture): deconstrucción de la arquitectura
- [Martin Fowler: Harness Engineering](https://martinfowler.com/articles/exploring-gen-ai/harness-engineering.html): contexto más amplio del sector
- [OpenAI: Harness Engineering](https://openai.com/index/harness-engineering/): el trabajo paralelo de OpenAI

## Adaptación a este proyecto

Esta sección no forma parte de la traducción: la añade el proyecto y **prevalece sobre el texto anterior** donde lo contradiga.

- **Cuándo:** solo cuando el usuario lo pida expresamente. El coste en tokens es alto (la propia skill habla de 12-22 veces más tiempo y coste). No se usa para construir «apps completas desde un prompt»: el alcance sale siempre de un ticket aprobado o de una petición concreta del usuario.
- **Quién orquesta:** la **sesión principal** ejecuta el ciclo (`.claude/CLAUDE.md` §4): invoca al generador, espera su resultado, invoca al evaluador, lee la puntuación y decide si sigue (umbral, máximo de iteraciones o meseta). Los subagentes no se invocan entre sí ni esperan al usuario; la herramienta `Task` solo la usa la sesión principal.
- **Agentes:** `.claude/agents/gan-planner.md` (solo para construcción, no para diseño), `gan-generator.md` y `gan-evaluator.md`. **El generador lo ejecuta `senior-fullstack`** bajo todas las reglas del proyecto. El evaluador usa el navegador **solo contra entornos locales o de pruebas**, nunca contra producción.
- **Comandos y scripts:** en este proyecto existe `/gan-design` (`.claude/commands/gan-design.md`). **No existen** `/project:gan-build`, `scripts/gan-harness.sh`, `PLANNER_PROMPT.md` ni `EVALUATOR_PROMPT.md`: el script de ECC lanza procesos `claude -p` autónomos, inicializa git y hace commits, así que no se incluye. Tampoco se lanzan procesos `claude -p` en paralelo. Las variables `GAN_*` no se configuran: los parámetros se indican en la petición.
- **Sin commits automáticos.** El generador no hace commits entre iteraciones; el commit y el PR los hace `senior-fullstack` en su fase, con autorización.
- **Stack fijo:** Koa con SSR, HTML5 semántico, Tailwind CSS, BEM, JavaScript Vanilla, TypeScript en el backend y MySQL con Prisma. No aplican React, FastAPI/Express, SQLite ni el andamiaje de proyectos nuevos. Landings en `restaurante/landing-pages/`, admin en `restaurante/inventory-manager/`.
- **`./_stich_source_/` prevalece** sobre la rúbrica: originalidad y diseño se puntúan dentro de lo que define el diseño fuente; solo donde no defina nada se diseña con Stitch y la aprobación del usuario (`.claude/rules/stitch-diseno.md`).
- **Evidencia, no pruebas:** las puntuaciones, la retroalimentación y las capturas son evidencia del ticket; no se convierten en pruebas permanentes (`.claude/rules/testing.md`). `gan-harness/` va en el scratchpad de la sesión y, al terminar, no queda ningún proceso, pestaña ni archivo temporal.
- **CodeGraph primero.** Ningún dato personal, credencial ni información de producción a servicios externos.
