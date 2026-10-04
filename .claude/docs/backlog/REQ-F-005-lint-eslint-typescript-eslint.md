# REQ-F-005 — Lint con ESLint y typescript-eslint

## Estado

APPROVED

## Aprobación

Aprobado por el usuario (versión 1, fecha 2026-10-03). Cita: "apruebo todo".

La aprobación incluye las propuestas P-1 a P-5, que pasan a ser decisiones confirmadas (D-1 a D-5).

Origen: trabajo aparte listado como fuera de alcance en REQ-F-004 (D-6). El usuario pidió (cita textual): "al finalizar crear los tickets para el trabajo aparte".

## Objetivo

Sustituir el `npm run lint` de relleno (`echo ... && exit 0`) por un lint real. Debe detectar los errores que `typecheck` no ve, como promesas sin manejar, variables o imports sin usar y `any` sin justificar. Se aplica al backend en TypeScript y al frontend en Vanilla JS.

## Decisiones confirmadas por el usuario

- D-1 (P-1). También se revisa `public/js`, con las reglas recomendadas de ESLint para JavaScript (navegador, módulos ES) y sin TypeScript.
- D-2 (P-2). El formato del código (Prettier) queda fuera de alcance.
- D-3 (P-3). Hay un script `npm run lint:fix` que aplica las correcciones automáticas.
- D-4 (P-4). El lint **no** se añade al Dockerfile. Lo hace obligatorio el CI (REQ-F-006).
- D-5 (P-5). No se admiten avisos (warnings): cada regla es error o está desactivada.

## Alcance

- Configuración de ESLint en `restaurante/`.
- Backend con información de tipos: `src/`, `tests/`, `scripts/` y la configuración de Vitest.
- `public/js` con reglas de JavaScript (D-1).
- Corrección del código existente hasta tener 0 errores.
- Scripts `lint` y `lint:fix`.
- Documentación y gobierno del proyecto:
  - `restaurante/README.md`;
  - `.claude/rules/typescript.md`;
  - `.claude/rules/javascript.md`;
  - `.claude/agents/senior-fullstack.md` (tabla de comandos y verificación final).

## Fuera de alcance

- Prettier y el formato del código (D-2).
- Lint de CSS y de HTML.
- CI (REQ-F-006).
- Lint en el Dockerfile (D-4).
- Cambios funcionales.

## Requisitos

- R-1. `npm run lint` revisa todo lo que está en alcance y no modifica archivos. Termina con 0 si no hay errores y con un código distinto de 0 si los hay.
- R-2. **Backend.** Usa las reglas recomendadas de ESLint y de typescript-eslint **con información de tipos**, apoyadas en el `tsconfig` de REQ-F-004. Como mínimo detecta promesas sin manejar y `any` explícito.
- R-3. **Excepciones.**
  - Una regla solo se desactiva en una línea concreta, con un comentario que incluya la justificación (la descripción después de `--`).
  - El `any` justificado de REQ-F-004 D-2 se expresa de esta forma.
  - No se desactivan reglas recomendadas de forma global, salvo con una justificación comentada en la configuración.
- R-4. **Frontend.** `public/js` usa las reglas recomendadas de ESLint para JavaScript con los globales del navegador (D-1).
- R-5. **Archivos ignorados.**
  - `node_modules/`;
  - los CSS generados en `public/css/`;
  - `data/`;
  - el código generado (por ejemplo, el futuro cliente de Prisma);
  - la cobertura.
- R-6. **Sin cambio de comportamiento.**
  - Las correcciones no cambian rutas, HTML, cabeceras ni logs.
  - `npm test` mantiene la misma cantidad de pruebas o más, sin `skip`, `only` ni `todo` nuevos y sin cambios en los snapshots.
  - `npm run typecheck` sigue en verde.
- R-7. **Dependencias.**
  - Solo se añaden dependencias de desarrollo (ESLint, typescript-eslint y lo mínimo necesario), cada una justificada según `.claude/rules/dependencias.md`.
  - No hay dependencias nuevas de producción y la imagen `production` no cambia.
- R-8. **Gobierno.**
  - `typescript.md` y `javascript.md` indican que hay que ejecutar `npm run lint` y cómo se justifican las excepciones.
  - `senior-fullstack.md` incluye `lint` en la tabla de comandos y en la verificación previa a terminar.
  - El README documenta `lint` y `lint:fix`.

## Historias de usuario

- HU-1. **Como** responsable técnico, **quiero** que el lint detecte errores reales, **para** no depender de la revisión manual.
- HU-2. **Como** agente o desarrollador, **quiero** que las reglas y los comandos documentados coincidan con la herramienta real, **para** no trabajar con instrucciones falsas.

## Criterios de aceptación

- CA-1. Sobre el código final, `npm run lint` termina con 0 y no muestra errores ni avisos.
- CA-2. Con una promesa sin `await` ni `catch` añadida a propósito en `src/` (cambio temporal), `npm run lint` termina con un código distinto de 0 e indica el archivo y la línea.
- CA-3. Un `any` explícito sin justificación en `src/` hace fallar el lint. Con la desactivación de la regla en esa línea y su justificación, el lint pasa.
- CA-4. Una variable sin usar en `public/js` hace fallar el lint.
- CA-5. `npm run lint` no modifica ningún archivo: `git status` queda igual que antes de ejecutarlo. `npm run lint:fix` sí aplica las correcciones automáticas.
- CA-6. El lint no analiza los CSS generados, `data/` ni `node_modules/`.
- CA-7. `npm test` y `npm run typecheck` pasan:
  - con al menos las mismas pruebas que había al cerrarse REQ-F-004;
  - sin snapshots modificados;
  - sin `skip`, `only` ni `todo` nuevos.
- CA-8. El diff no contiene desactivaciones de reglas sin justificación. Se comprueba buscando en el diff.
- CA-9. `package.json` no tiene `dependencies` nuevas, y la imagen `production` se construye y arranca igual que antes.
- CA-10. README, `typescript.md`, `javascript.md` y `senior-fullstack.md` cumplen R-8, y los comandos documentados funcionan tal como están escritos.

## Casos límite

- Pruebas `.ts` que importan módulos `.js` de `public/js` sin tipos (REQ-F-004 D-4).
- Archivos de configuración (Vitest, ESLint) que quedan dentro o fuera del `tsconfig`.
- El lint con información de tipos puede ser lento sobre todo el proyecto.

## Dependencias

- REQ-F-004 (backend en TypeScript, `tsconfig.json` y `npm run typecheck`).

## Riesgos

- Muchas correcciones mecánicas pueden introducir regresiones sutiles. Se mitiga con la suite completa y los snapshots.
- Desactivar reglas solo para que el lint pase daría una falsa seguridad. Se mitiga con R-3 y CA-8.

## Action Plan

### Objetivo

Que `npm run lint` sea una puerta de calidad real para el backend en TypeScript y el frontend en JavaScript.

### Alcance

Ver la sección "Alcance".

### Fuera de alcance

Ver la sección "Fuera de alcance".

### Cambios requeridos

1. Añadir las dependencias de desarrollo y la configuración de ESLint (R-2, R-4, R-5, R-7).
2. Crear los scripts `lint` y `lint:fix` (R-1, D-3).
3. Corregir los hallazgos por carpeta, con la suite en verde tras cada paso (R-6).
4. Actualizar el gobierno y el README (R-8).

### Reglas de negocio

No aplica: no hay cambios funcionales.

### UX/UI

No aplica.

### Integraciones

Ninguna.

### Casos límite

Ver la sección "Casos límite".

### Criterios de aceptación

CA-1 a CA-10.

### Dependencias

REQ-F-004.

### Riesgos

Ver la sección "Riesgos".

### Orden recomendado

1. Configuración.
2. `src/`.
3. `tests/` y `scripts/`.
4. `public/js`.
5. Documentación.
6. Verificación de CA-1 a CA-10.

### Resultado esperado

`npm run lint` es una puerta de calidad real y queda listo para que el CI (REQ-F-006) lo ejecute.

## Trazabilidad

| Objetivo | Requisito | Historia | Criterios |
| --- | --- | --- | --- |
| Lint real | R-1, R-2, R-4, R-5, D-1, D-3, D-5 | HU-1 | CA-1, CA-2, CA-4, CA-5, CA-6 |
| Excepciones justificadas | R-3 | HU-1 | CA-3, CA-8 |
| Sin regresiones | R-6, R-7, D-4 | HU-1 | CA-7, CA-9 |
| Gobierno coherente | R-8 | HU-2 | CA-10 |

No hay diseño ni UI asociados en `_stich_source_/`.

## Historial de cambios

### Versión 1

Descripción inicial. Aprobada por el usuario el 2026-10-03 (cita: "apruebo todo"), incluidas las propuestas P-1 a P-5 como D-1 a D-5.
