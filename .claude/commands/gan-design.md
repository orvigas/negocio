---
description: Ejecuta un ciclo de diseño generador/evaluador para trabajo frontend o visual, con iteraciones acotadas y puntuación.
---

<!-- Traducción al español de `commands/gan-design.md` de affaan-m/ECC (licencia MIT), con una sección final de adaptación a este proyecto. -->

Extrae lo siguiente de $ARGUMENTS:
1. `brief`: la descripción del usuario del diseño que hay que crear
2. `--max-iterations N`: (opcional, 10 por defecto) máximo de ciclos de diseño-evaluación
3. `--pass-threshold N`: (opcional, 7.5 por defecto) puntuación ponderada para aprobar (valor por defecto más alto en diseño)

## Arnés de diseño al estilo GAN

Un ciclo de dos agentes (generador + evaluador) centrado en la calidad del diseño frontend. Sin planificador: el encargo ES la especificación.

Es el mismo modo que usó Anthropic en sus experimentos de diseño frontend, en los que vio avances creativos como el museo de arte neerlandés en 3D con perspectiva CSS y navegación a través de puertas.

### Preparación
1. Crear el directorio `gan-harness/`
2. Escribir el encargo directamente como `gan-harness/spec.md`
3. Escribir un `gan-harness/eval-rubric.md` centrado en el diseño, con más peso en la calidad del diseño y la originalidad

### Rúbrica de evaluación específica de diseño
```markdown
### Calidad del diseño (peso: 0.35)
### Originalidad (peso: 0.30)
### Oficio (peso: 0.25)
### Funcionalidad (peso: 0.10)
```

Nota: el peso de la originalidad es mayor (0.30 frente a 0.20) para impulsar los avances creativos. El peso de la funcionalidad es menor porque el modo de diseño se centra en la calidad visual.

### Ciclo
Igual que la fase 2 de `/project:gan-build`, pero:
- Se omite el planificador
- Se usa la rúbrica centrada en el diseño
- El prompt del generador prioriza la calidad visual sobre la completitud de las funcionalidades
- El prompt del evaluador prioriza «¿ganaría esto un premio de diseño?» sobre «¿funcionan todas las funcionalidades?»

### Diferencia clave con gan-build
Al generador se le dice: «Tu objetivo PRINCIPAL es la excelencia visual. Una app deslumbrante a medio terminar es mejor que una funcional y fea. Busca saltos creativos: maquetaciones poco habituales, animaciones a medida, un trabajo de color distintivo».

## Adaptación a este proyecto

Esta sección no forma parte de la traducción: la añade el proyecto y **prevalece sobre el texto anterior** donde lo contradiga.

- **Cuándo:** solo cuando el usuario lo pida expresamente (`/gan-design <encargo>`). Coste en tokens alto.
- **El ciclo (en lugar de `/project:gan-build`, que no existe en este proyecto):** la **sesión principal** lo orquesta (`.claude/CLAUDE.md` §4). En cada iteración: (1) invoca a `senior-fullstack` con el papel de `.claude/agents/gan-generator.md`, la especificación y la última retroalimentación; (2) cuando termina, invoca a `gan-evaluator` (`.claude/agents/gan-evaluator.md`) contra el servidor local; (3) lee la puntuación ponderada de la retroalimentación. Se detiene al alcanzar el umbral, al llegar al máximo de iteraciones o si en la tercera iteración o después la puntuación no ha mejorado en las dos últimas. Al final informa al usuario de la progresión de puntuaciones y de los problemas pendientes. Los subagentes no se invocan entre sí ni esperan al usuario.
- **`./_stich_source_/` prevalece.** «Excelencia visual» y «saltos creativos» solo donde el diseño fuente no define nada; lo definido ahí no se rediseña. Lo que no tenga definición se diseña con Stitch y se presenta al usuario antes de implementarlo (`.claude/rules/stitch-diseno.md`). «Una app deslumbrante a medio terminar» no vale aquí: lo que se entrega debe cumplir accesibilidad, responsividad y los criterios del ticket.
- **Stack:** Koa con SSR, HTML5 semántico, Tailwind CSS, BEM y JavaScript Vanilla; TypeScript sin React; sin dependencias nuevas (por ejemplo, de 3D o animación) sin aprobación.
- **Navegador solo en local o en pruebas**, nunca contra producción ni con datos reales.
- **Ningún commit automático.** Los cambios quedan sin commit; el commit y el PR los hace `senior-fullstack` en su fase.
- **Evidencia, no pruebas:** las evaluaciones y capturas son evidencia; no se convierten en pruebas permanentes (`.claude/rules/testing.md`). `gan-harness/` va en el scratchpad de la sesión y se borra al terminar, junto con procesos y pestañas.
- **CodeGraph primero.** Ningún dato personal, credencial ni información de producción a servicios externos.
