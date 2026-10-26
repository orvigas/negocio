# TypeScript (backend)

---

paths:

- "/restaurante/landing-pages/src"
- "/restaurante/landing-pages/tests"
- "/restaurante/landing-pages/scripts"
- "/restaurante/packages"

---

El backend (`src/`), las pruebas (`tests/`), los scripts de Node (`scripts/`) y `vitest.config.ts`, todos en `restaurante/landing-pages/`, y los paquetes de `restaurante/packages/` (`core`, `contracts` y `db`; REQ-F-037) están en TypeScript estricto. Todos los `tsconfig.json` extienden `restaurante/tsconfig.base.json`. El frontend (`public/js`) sigue en JavaScript Vanilla (`.claude/rules/javascript.md`).

## Ejecución

- Node 24 (≥ 24.22.1) ejecuta los `.ts` directamente con type stripping: no hay paso de compilación ni carpeta `dist/`.
- `tsc` solo verifica tipos (`npm run typecheck`, con `noEmit`). No lo uses para generar archivos.
- No agregues `.js` propios en `src/`, `tests/`, `scripts/` ni `packages/`.

## Sintaxis permitida

Solo sintaxis borrable (`erasableSyntaxOnly` en `tsconfig.base.json` la impone):

- sin `enum` (usa objetos `as const` o uniones de literales);
- sin `namespace` con valor;
- sin parameter properties en constructores (declara los campos de la clase);
- sin `import x = require(...)` ni `export =`.

Los imports que solo traen tipos usan `import type` o `type` en línea (`verbatimModuleSyntax`).

## Imports

- Los imports relativos llevan la extensión `.ts` (`import { x } from './modulo.ts'`), también en `import()`.
- Las pruebas importan los módulos del frontend con su extensión `.js` y sin tiparlos.
- `npm run lint` rechaza un import relativo `./x.js` fuera de `public/js`: `tsc` y Vitest lo resuelven hacia `x.ts`, pero Node falla con `ERR_MODULE_NOT_FOUND`.

## Tipos

- `strict` y `noUncheckedIndexedAccess` están activos; no los relajes.
- Prefiere los tipos inferidos; anota parámetros, retornos públicos y contratos compartidos.
- Las entradas externas (variables de entorno, cuerpos de formulario, JSON leído de disco, errores capturados) entran como `unknown` y se validan antes de usarlas.
- `any` explícito está prohibido salvo con una justificación, expresada como desactivación de la regla en esa línea: `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- <motivo>`.
- Usa `as` y `!` solo cuando una validación previa garantice el tipo, con un comentario que lo explique (en las pruebas, `!` sobre fixtures conocidos es aceptable).
- En las pruebas, para pasar valores inválidos a propósito usa `// @ts-expect-error: <motivo>`.

## Lint

- `npm run lint` (ESLint con typescript-eslint e información de tipos) debe terminar con 0, sin errores ni avisos. `npm run lint:fix` aplica las correcciones automáticas.
- Una regla solo se desactiva en una línea concreta y con la justificación después de `--` (`// eslint-disable-next-line <regla> -- <motivo>`). Sin justificación, o con `/* eslint-disable */` sin reglas, el lint falla.
- No desactives reglas de forma global salvo con una justificación comentada en `eslint.config.ts` y la aprobación del usuario.

## Antes de terminar

Ejecuta `npm run typecheck`, `npm run lint` y `npm test`. Una tarea no está terminada si `typecheck` o `lint` fallan.
