# CodeGraph

Aplica a la sesión principal y a todos los agentes (`business-analyst`, `senior-fullstack`, `senior-qa`).

CodeGraph es obligatorio siempre que sea posible para explorar código indexado (`restaurante/landing-pages/src`, `restaurante/landing-pages/public/js`, `restaurante/landing-pages/tests`, `restaurante/landing-pages/scripts`).

## Orden obligatorio

1. **Primero** `codegraph_explore` (herramienta MCP) con los símbolos, archivos o la pregunta en lenguaje natural. Agrupa en una sola consulta los nombres relacionados.
2. Si la herramienta MCP no está disponible, el CLI por Bash: `codegraph explore "<consulta>"` (o `codegraph node <nombre>` para un símbolo concreto).
3. Solo si ambos fallan: Grep, Glob y Read. Indícalo **una vez** en el resultado y no reintentes.

## Reglas

- No uses Grep ni Read para localizar o entender código indexado antes de consultar CodeGraph.
- El código que devuelve `codegraph_explore` es el contenido actual del disco: trátalo como ya leído. No lo releas ni lo verifiques con Grep.
- Usa el "blast radius" para conocer consumidores, impacto y pruebas afectadas antes de modificar código o de planificar regresión.
- Si necesitas más contexto, haz otra consulta a CodeGraph con nombres más concretos antes de recurrir a Read.
- Para lo que CodeGraph no indexa (Markdown, HTML, CSS, JSON, Dockerfile, `.env.example`, imágenes, `_stich_source_/`, `.claude/docs/`) usa directamente Read, Grep y Glob, con lecturas dirigidas por rangos de líneas.
- No inventes resultados de CodeGraph.
- Al delegar a un agente, la sesión principal le recuerda esta regla en el prompt.
