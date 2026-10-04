# TypeScript (backend)

---

paths:

- "/src"
- "/tests"
- "/scripts"

---

El backend (`src/`), las pruebas (`tests/`), los scripts de Node (`scripts/`) y `vitest.config.ts` están en TypeScript estricto. El frontend (`public/js`) sigue en JavaScript Vanilla (`.claude/rules/javascript.md`).

## Ejecución

- Node 24 (≥ 24.3) ejecuta los `.ts` directamente con type stripping: no hay paso de compilación ni carpeta `dist/`.
- `tsc` solo verifica tipos (`npm run typecheck`, con `noEmit`). No lo uses para generar archivos.
- No agregues `.js` propios en `src/`, `tests/` ni `scripts/`.

## Sintaxis permitida

Solo sintaxis borrable (`erasableSyntaxOnly` en `tsconfig.json` la impone):

- sin `enum` (usa objetos `as const` o uniones de literales);
- sin `namespace` con valor;
- sin parameter properties en constructores (declara los campos de la clase);
- sin `import x = require(...)` ni `export =`.

Los imports que solo traen tipos usan `import type` o `type` en línea (`verbatimModuleSyntax`).

## Imports

- Los imports relativos llevan la extensión `.ts` (`import { x } from './modulo.ts'`), también en `import()`.
- Las pruebas importan los módulos del frontend con su extensión `.js` y sin tiparlos.

## Tipos

- `strict` y `noUncheckedIndexedAccess` están activos; no los relajes.
- Prefiere los tipos inferidos; anota parámetros, retornos públicos y contratos compartidos.
- Las entradas externas (variables de entorno, cuerpos de formulario, JSON leído de disco, errores capturados) entran como `unknown` y se validan antes de usarlas.
- `any` explícito está prohibido salvo con una justificación comentada en la misma línea o en la anterior.
- Usa `as` y `!` solo cuando una validación previa garantice el tipo, con un comentario que lo explique (en las pruebas, `!` sobre fixtures conocidos es aceptable).
- En las pruebas, para pasar valores inválidos a propósito usa `// @ts-expect-error: <motivo>`.

## Antes de terminar

Ejecuta `npm run typecheck` y `npm test`. Una tarea no está terminada si `typecheck` falla.
