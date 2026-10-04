# REQ-F-004 — Migración del backend a TypeScript

## Estado

READY_FOR_MERGE

## Aprobación

Aprobado por el usuario (versión 1, fecha 2026-10-03). Cita: "apruebo".

## Objetivo

Migrar el backend de `restaurante/` de JavaScript a TypeScript estricto, sin cambiar el comportamiento observable. Así el proyecto queda preparado para el control de usuarios, la integración del bot de WhatsApp y el modelo de producto con Prisma/SQLite, que llegarán en tickets posteriores.

El frontend (`public/js`) sigue en Vanilla JS. Las reglas y los agentes del proyecto se actualizan para que TypeScript sea el estándar del backend.

## Alcance

- Código del backend: `src/`, `tests/` (incluidos `helpers` y `support`), `scripts/hash-password` y la configuración de Vitest.
- `tsconfig.json` y `package.json` (scripts y devDependencies).
- `Dockerfile`: verificación de tipos y comando de arranque.
- Documentación y gobierno:
  - `restaurante/README.md`;
  - `CLAUDE.md` §2;
  - nueva `.claude/rules/typescript.md`;
  - `.claude/rules/javascript.md`;
  - `.claude/agents/senior-fullstack.md`.

## Fuera de alcance

- `public/js`, que sigue en Vanilla JS. No se tipa ni se modifica.
- Cambios funcionales y refactors que no sean necesarios para tipar.
- `scripts/generate-icons.py`.

Trabajos aparte, que quedarán como tickets futuros:

- **ESLint con typescript-eslint:** configurar el lint real del proyecto y reemplazar el placeholder de `npm run lint`.
- **CI:** ejecutar `typecheck` y las pruebas automáticamente en cada PR (por ejemplo, GitHub Actions).
- **Control de usuarios:** autenticación y roles.
- **Integración del bot de WhatsApp.**
- **Modelo de producto común con Prisma/SQLite:** persistencia y CRUD de productos en la API.

## Decisiones confirmadas por el usuario

- D-1. **Forma de ejecutar TypeScript.** Node 24 ejecuta los `.ts` directamente (type stripping nativo).
  - No hay paso de compilación ni carpeta `dist/`, y la imagen `production` contiene los `.ts`.
  - Solo se permite sintaxis borrable: sin `enum`, `namespace`, parameter properties ni `import =`. `tsconfig` lo impone.
- D-2. **Rigor de tipos.** Se usa `strict: true` desde el inicio y la migración es total en este ticket (no conviven `.js` y `.ts` en el backend). El `any` explícito está prohibido salvo con una justificación comentada en la misma línea o en la anterior.
- D-3. **Archivos auxiliares.** `scripts/hash-password` y la configuración de Vitest también se migran a `.ts`.
- D-4. **Pruebas del frontend.** Las tres pruebas de módulos de `public/js` (`promo-form`, `variant-selector`, `landing-dom`) pasan a `.ts` e importan los `.js` del frontend sin tiparlos.
- D-5. **Verificación de tipos.**
  - Hay un script aparte, `npm run typecheck`, que se ejecuta en la etapa `build` del Dockerfile.
  - `npm test` no lo incluye.
  - `npm run lint` sigue como placeholder.
  - CI queda fuera de alcance.
- D-6. **ESLint.** typescript-eslint queda fuera de alcance; irá en un ticket aparte.
- D-7. **Gobierno del proyecto.** Se actualizan CLAUDE.md §2, se crea `.claude/rules/typescript.md` y `.claude/rules/javascript.md` se acota a `public/js`. En `senior-fullstack.md` se actualiza lo relativo a TypeScript y también se corrigen las partes desactualizadas: "Persistencia y API" y el árbol de estructura.

## Requisitos

- R-1. **Migración total.** Todo el código propio de `src/`, `tests/`, `scripts/hash-password` y la configuración de Vitest queda en `.ts`. No queda ningún `.js` propio en esas ubicaciones.
  - Las plantillas `.html`, los `.css` de `src/styles`, los JSON de semilla y `public/` no cambian.
- R-2. **`tsconfig.json`** en `restaurante/`:
  - modo estricto;
  - sin emitir archivos;
  - rechaza la sintaxis no borrable (D-1);
  - acepta imports relativos con extensión `.ts`;
  - cubre `src/`, `tests/`, `scripts/` y la configuración de Vitest;
  - excluye `public/` y `node_modules/`.
- R-3. **Script `npm run typecheck`.** Termina con código 0 si no hay errores de tipo y con un código distinto de 0 si los hay.
- R-4. **Scripts de uso diario.** `npm start`, `npm run dev`, `npm test`, `npm run admin:hash-password` y los scripts de CSS funcionan igual que antes.
  - Solo cambian los puntos de entrada y `main` de `package.json` a sus versiones `.ts`.
  - La recarga de `npm run dev` funciona al editar archivos `.ts`.
- R-5. **Docker.**
  - La etapa `build` ejecuta `typecheck`. Si hay errores de tipo, no se construye la imagen `test` ni la `production`.
  - La imagen `production` arranca con el punto de entrada `.ts` y mantiene lo establecido en REQ-F-003: sin devDependencies (incluidos `typescript` y `@types/*`), usuario no root, sin secretos ni datos, y `HEALTHCHECK` y cierre por `SIGTERM` funcionando.
  - `compose.yaml` sigue funcionando sin cambios en su uso.
- R-6. **Sin cambio de comportamiento.**
  - Rutas, códigos HTTP, HTML servido, cabeceras y CSP, selección de landing por día y zona horaria, enlaces de WhatsApp, administración (login, sesión, guardado, restauración y datos dañados), uso de `DATA_DIR`, validación de configuración y formato de los logs quedan idénticos.
  - Se conservan todas las pruebas existentes (hoy 25 archivos y 468 pruebas): la misma cantidad o más, sin `skip`/`todo` nuevos, sin debilitar aserciones y sin regenerar snapshots.
- R-7. **Dependencias.** Solo se agregan dependencias de desarrollo: `typescript` y los paquetes de tipos necesarios, cada uno justificado según `.claude/rules/dependencias.md`. No hay dependencias nuevas de producción.
- R-8. **Logs.** Toda línea que la app escribe en stdout sigue siendo JSON válido. Si el runtime emite una advertencia (por ejemplo, `ExperimentalWarning` por el type stripping), se documenta y queda resuelta o aceptada de forma explícita en el Implementation Result.
- R-9. **Gobierno del proyecto.**
  - `CLAUDE.md` §2 (Backend) indica: TypeScript estricto ejecutado con el type stripping nativo de Node 24, sin paso de compilación, verificado con `npm run typecheck`. El frontend sigue en Vanilla JS.
  - Nueva `.claude/rules/typescript.md`, aplicada a `src/`, `tests/` y `scripts/`, que fija las convenciones de D-1 y D-2:
    - solo sintaxis borrable;
    - imports con extensión `.ts`;
    - `strict`;
    - `any` explícito solo con justificación comentada;
    - preferir tipos inferidos y `unknown` para entradas externas, que se validan antes de usarlas;
    - ejecutar `typecheck` antes de dar una tarea por terminada.
  - `.claude/rules/javascript.md` se acota explícitamente a `public/js` (frontend).
  - `.claude/agents/senior-fullstack.md`:
    - stack del backend en TypeScript, sin la mención "sin TypeScript";
    - `npm run typecheck` en la tabla de comandos y en la verificación previa a terminar;
    - árbol de estructura con las extensiones `.ts` y las carpetas reales (`repositories/`, `views/admin/`, `views/landings/`, `routes/admin`, `controllers/admin` e `icons`, semillas en `content/`, `scripts/`);
    - sección "Persistencia y API" corregida para describir la persistencia actual: menús en archivos JSON bajo `DATA_DIR`, administración en `/admin` con autenticación por sesión y sin base de datos. Debe conservar la instrucción de no improvisar persistencia, API ni autenticación nuevas sin una decisión técnica.
- R-10. **README.** Se actualizan Requisitos, Scripts (`typecheck`), Estructura, la sección Docker (`typecheck` en `build` y nuevo comando de arranque) y todas las rutas de archivos `.js` del backend que cambien. No se documentan funciones que no existen.

## Historias de usuario

- HU-1. **Como** responsable técnico del proyecto, **quiero** que el backend esté en TypeScript estricto, **para** que el control de usuarios, el bot de WhatsApp y Prisma se construyan sobre contratos tipados y verificables.
- HU-2. **Como** cliente de las landings o administrador de menús, **quiero** que todo funcione exactamente igual tras la migración, **para** no notar ningún cambio ni perder pedidos.
- HU-3. **Como** agente o desarrollador del proyecto, **quiero** que CLAUDE.md, las reglas y `senior-fullstack.md` reflejen el stack real, **para** no trabajar con instrucciones contradictorias u obsoletas.

## Reglas de negocio

- RN-1. Sin cambios funcionales en las landings, la selección por día, WhatsApp ni la administración.
- RN-2. Se conservan RN-1 y RN-2 de REQ-F-003: no se hornean secretos ni datos en las imágenes, y la configuración se valida al arrancar (código 1 sin mostrar valores).

## Criterios de aceptación

- CA-1. En `src/`, `tests/` y `scripts/` no queda ningún archivo `.js` propio, y la configuración de Vitest está en `.ts`. `git diff main -- public/` está vacío.
- CA-2. `npm run typecheck` termina con 0. Con un error de tipo introducido a propósito (temporal, no versionado), termina con un código distinto de 0.
- CA-3. Con sintaxis no borrable introducida a propósito (por ejemplo, un `enum`; temporal), `npm run typecheck` falla.
- CA-4. `tsconfig.json` tiene el modo estricto activo. Cada `any` explícito del código tiene su justificación comentada; se verifica con una búsqueda en el diff.
- CA-5. Las pruebas no se reducen ni se debilitan:
  - `npm test` pasa con al menos 25 archivos y 468 pruebas;
  - no hay `skip`/`only`/`todo` nuevos;
  - `git diff main` no modifica ningún snapshot;
  - las aserciones no se debilitan, lo que se comprueba revisando el diff de `tests/`.
- CA-6. Con un `.env` válido, `npm start` responde igual que `main`:
  - 200 en `/`, `/molotes`, `/birria`, en el CSS de cada negocio y en los iconos;
  - `/admin` sin sesión redirige al login;
  - el HTML de las landings es idéntico al de `main` para la misma fecha simulada.
- CA-7. Sin las variables obligatorias, `npm start` termina con código 1 y la misma lista de problemas que en `main`, sin mostrar valores.
- CA-8. Con `npm run dev`, al modificar un `.ts` de `src/` el servidor se reinicia.
- CA-9. `npm run admin:hash-password` genera un hash con el mismo formato que antes, y con ese hash se puede iniciar sesión en `/admin`.
- CA-10. Docker:
  - `docker compose run --rm test` pasa en arm64 y amd64 con código 0;
  - con un error de tipo temporal, la construcción de la imagen falla en la etapa `build`.
- CA-11. La imagen `production`:
  - arranca y responde 200 en `/`, queda `healthy` y se detiene con `SIGTERM` y código 0;
  - no contiene `typescript` ni `@types/*` en `node_modules`;
  - se ejecuta con UID 1000;
  - no contiene `.env` ni `data/`.
- CA-12. Toda línea de stdout de la app (local y en `production`) es JSON válido. Cualquier advertencia del runtime en stderr queda documentada y resuelta o aceptada (R-8).
- CA-13. `package.json` no tiene `dependencies` nuevas. Cada devDependency nueva está justificada en el Technical Action Plan.
- CA-14. El gobierno del proyecto queda actualizado:
  - CLAUDE.md §2, `.claude/rules/typescript.md` (nueva), `.claude/rules/javascript.md` (acotada a `public/js`) y `senior-fullstack.md` cumplen R-9;
  - ninguno dice que el backend es JavaScript o "sin TypeScript";
  - el árbol de estructura de `senior-fullstack.md` coincide con las carpetas reales de `restaurante/`;
  - "Persistencia y API" describe `DATA_DIR` y la administración con sesión.
- CA-15. El README cumple R-10. Los comandos documentados (`typecheck`, `start`, `dev`, `test` y los de Docker) funcionan tal como están escritos.

## Casos límite

- Imports relativos sin extensión o con `.js` que apuntan a archivos ya migrados. Incluye imports dinámicos y rutas calculadas con `import.meta.url` o `import.meta.dirname`: plantillas, semillas JSON y `paths`.
- Imports de JSON (semillas) y su tipado.
- Pruebas `.ts` que importan módulos `.js` de `public/js` sin tipos (D-4).
- Snapshots de HTML (`toMatchFileSnapshot`): no deben cambiar.
- Pruebas que comparan rutas o nombres de archivo con extensión `.js`, por ejemplo `config.test`.
- Advertencias del runtime al cargar `.ts` y su efecto en los logs estructurados (R-8).
- `node --watch` con `.ts`.
- La imagen `production` sin `typescript` instalado.
- Variables de entorno ausentes o inválidas: el comportamiento es idéntico (CA-7).
- Pruebas con zona horaria UTC dentro del contenedor (se mantiene lo de REQ-F-003).

## Dependencias

- Node 24 LTS con type stripping nativo.
- `typescript` y los paquetes de tipos de Node, Koa, `@koa/router` (si no incluye los suyos), `koa-static`, `koa-helmet` y Supertest. senior-fullstack los evalúa.
- El Dockerfile y `compose.yaml` de REQ-F-003.

## Riesgos

- Compatibilidad futura: el cliente de Prisma 7 del ticket de modelo de producto debe poder ejecutarse con type stripping (sintaxis borrable, imports `.ts`). senior-fullstack lo confirma en la revisión técnica de este ticket.
- Un tipado superficial (`any` o `as` excesivos) daría una falsa seguridad. Se mitiga con D-2 y CA-4.
- Puede haber regresiones sutiles en imports y rutas. Se mitigan con la suite completa, los snapshots y CA-6.
- El diff es grande y difícil de revisar. Conviene migrar por capas con la suite en verde en cada paso.
- Aviso de alcance: cambiar los archivos de gobierno (CLAUDE.md, reglas, agente) afecta a todos los tickets futuros.

## Action Plan

### Objetivo

Backend en TypeScript estricto ejecutado nativamente por Node 24, con verificación de tipos obligatoria en Docker, sin cambio de comportamiento y con el gobierno del proyecto actualizado.

### Alcance

Ver la sección "Alcance".

### Fuera de alcance

Ver la sección "Fuera de alcance", con los tickets futuros listados.

### Cambios requeridos

1. Crear `tsconfig.json` (R-2) y el script `typecheck` (R-3), y agregar las devDependencies de tipos (R-7).
2. Migrar `src/` por capas, con `npm test` en verde tras cada una: `utils` → `config` → `content` → `services` → `repositories` → `middleware` → `views` → `controllers` → `routes` → `app`/`server`.
3. Migrar `tests/` (`helpers`, `support`, `unit`, `integration`), incluidas las tres pruebas de `public/js` (D-4).
4. Migrar `scripts/hash-password` y la configuración de Vitest (D-3).
5. Ajustar los scripts de `package.json` y `main` (R-4).
6. Dockerfile: `typecheck` en `build` y nuevo comando de arranque en `production` (R-5).
7. Verificar los logs y las advertencias del runtime (R-8).
8. Actualizar el README (R-10).
9. Actualizar CLAUDE.md §2, crear `.claude/rules/typescript.md`, acotar `.claude/rules/javascript.md` y actualizar y corregir `.claude/agents/senior-fullstack.md` (R-9).

### Reglas de negocio

RN-1 y RN-2.

### UX/UI

No aplica: el HTML servido es idéntico (CA-6) y no hay cambios en `_stich_source_/` ni en `public/`.

### Integraciones

Ninguna externa.

### Casos límite

Ver la sección "Casos límite".

### Criterios de aceptación

CA-1 a CA-15.

### Dependencias

Ver la sección "Dependencias".

### Riesgos

Ver la sección "Riesgos".

### Orden recomendado

1. Pasos 1 a 5, con `npm test` y `typecheck` en verde.
2. Paso 6, verificando CA-10 y CA-11.
3. Paso 7 (CA-12).
4. Pasos 8 y 9 (CA-14 y CA-15).
5. Verificación final de CA-1 a CA-15 dentro y fuera de Docker, y revisión de `git diff` para descartar cambios fuera de alcance.

### Resultado esperado

- El backend es TypeScript estricto, se ejecuta sin compilación y la verificación de tipos es obligatoria al construir las imágenes.
- La suite completa sigue verde, con los mismos snapshots y el mismo comportamiento.
- Las reglas, CLAUDE.md, `senior-fullstack.md` y el README describen el stack real: TypeScript en el backend y Vanilla JS en el frontend.

## Trazabilidad

| Objetivo | Requisito | Historia | Criterios |
| --- | --- | --- | --- |
| Backend tipado y verificable | R-1, R-2, R-3, R-7, D-1, D-2, D-3, D-4 | HU-1 | CA-1, CA-2, CA-3, CA-4, CA-13 |
| Sin cambio de comportamiento | R-4, R-6, R-8, RN-1 | HU-2 | CA-5, CA-6, CA-7, CA-8, CA-9, CA-12 |
| Docker con verificación de tipos | R-5, D-5, RN-2 | HU-1, HU-2 | CA-10, CA-11 |
| Gobierno y documentación coherentes | R-9, R-10, D-7 | HU-3 | CA-14, CA-15 |

No hay diseño ni UI asociados en `_stich_source_/`.

## Technical Action Plan

### Objetivo técnico

Renombrar a `.ts` y tipar con `strict` todo el backend (`src/`, `tests/`, `scripts/hash-password`, `vitest.config`). Node 24 lo ejecuta con type stripping, sin compilar. `tsc` solo verifica tipos (`npm run typecheck`), fuera de Docker y dentro de la etapa `build`. El comportamiento, el HTML, el CSS generado, los logs y las pruebas quedan idénticos.

### Verificaciones previas (spike en el scratchpad, sin tocar el repositorio)

Las hice sobre una copia de `restaurante/` (`git archive HEAD`) y sobre el spike de Prisma 7 del ticket descartado.

1. **Prisma 7 y type stripping (riesgo del ticket):** compatibles.
   - Generé un cliente limpio con `generator client { provider = "prisma-client"; moduleFormat = "esm"; generatedFileExtension = "ts"; importFileExtension = "ts" }` (Prisma 7.10.0). Son 10 `.ts`, todos con `// @ts-nocheck` y sin `package.json` propio.
   - `tsc` con el tsconfig propuesto (abajo) termina con 0, con TS 6.0.3 y con 7.0.2. Una consulta real (`count` y `findMany` con `include`) se ejecuta con `node app/main.ts` sobre SQLite.
   - Para comprobar la sintaxis, quité `@ts-nocheck` del cliente generado. No aparece ningún error de `erasableSyntaxOnly` (TS1294) ni de `verbatimModuleSyntax` (TS1484): solo errores de tipos de lib (`WebAssembly`, dos `.mjs` sin declaración), que `@ts-nocheck` ya silencia.
   - Condiciones para el ticket futuro:
     - la salida del generador debe quedar **fuera de `node_modules`**, porque Node no aplica type stripping ahí;
     - esa carpeta no debe contener un `package.json` sin `"type": "module"`. Un `package.json` residual de `prisma-client-js` provocó `MODULE_TYPELESS_PACKAGE_JSON` en stderr.
2. **`ExperimentalWarning` (R-8):**
   - Node 24.0.0 y 24.2.0 la emiten en **stderr** ("Type Stripping is an experimental feature…").
   - Desde 24.3.0 ya no aparece. Lo probé con 24.3.0, 24.11.1, 24.12.0 y 24.21.0. La imagen `node:24-alpine` actual es 24.21.0, igual que el entorno local.
   - stdout no se ve afectado en ningún caso: los logs JSON van a stdout.
   - `node --watch` escribe en stdout dos líneas que no son JSON ("Change detected…" y "Restarting…"). Ya ocurre hoy con `.js`, solo pasa en desarrollo y no está en `npm start` ni en `production`. Se acepta y se documenta (R-8).
3. **Migración mecánica (renombrar y cambiar `.js` → `.ts` en los imports relativos, sin tipar):**
   - `npm test`: 25 archivos, 468 pruebas en verde. Los snapshots no cambian.
   - `npm start` responde 200 y la recarga de `npm run dev` funciona al editar un `.ts` (CA-8).
   - `npm run admin:hash-password` genera `scrypt$32768$8$1$…` (CA-9).
   - Sin variables obligatorias, el proceso termina con código 1 y el mismo mensaje (CA-7).
   - Vitest 5 transforma los `.ts` (incluido `vitest.config.ts`) sin depender del paquete `typescript`.
4. **Imports JSON:** el backend no importa JSON. Las semillas se leen con `readFileSync` y `JSON.parse` (`src/content/seeds`), así que no hacen falta `resolveJsonModule` ni `with { type: 'json' }`. Solo hay que tipar el resultado de `JSON.parse` (`unknown`, que ya valida `menu-schema`).
5. **`import.meta`:**
   - `import.meta.url` (en `app`, `config/env` y `content/seeds`) y `import.meta.dirname` (en `tests/unit/content.test`) funcionan igual en `.ts`.
   - `@types/node` 24 los tipa.
   - Las rutas calculadas apuntan a carpetas (`views/`, `public/`, `content/<negocio>/seed.json`), no a archivos `.js`, así que no cambian.
6. **Tamaño real del trabajo:** `tsc` sobre el árbol renombrado da **932 errores**.
   - El 80 % son parámetros sin tipo (TS7006/TS7031): la JSDoc no cuenta en `.ts`.
   - Los archivos con más errores son `views/admin/index`, `repositories/menu-repository`, `services/menu-schema`, `controllers/admin` y sus pruebas.
   - `noUncheckedIndexedAccess` añade 22. Es tipado manual, no un cambio de diseño.
7. **CSS generado: hallazgo que afecta a R-1.** `src/styles/molotes/main.css` y `src/styles/birria/main.css` declaran `@source "../../views/landings/<negocio>.js"`.
   - Si no se cambian esas dos rutas a `.ts`, Tailwind deja de ver las clases del archivo renombrado y el CSS de Molotes pierde reglas (49 598 bytes frente a 50 041).
   - Con el cambio, los tres CSS (`molotes`, `birria` y `admin`) son **idénticos byte a byte** a los de `main`.
   - Ver la decisión TQ-2.
8. **TypeScript 7 frente a 6:**
   - `typescript@7.0.2` (`latest`, compilador nativo en Go) funciona en `node:24-alpine` arm64 y amd64: el binario de plataforma viene en el lockfile como optionalDependency y detecta un `enum` con TS1294.
   - Pero `typescript-eslint` 8.71 (D-6, ticket futuro) exige `typescript >=4.8.4 <6.1.0`.
   - `typescript@6.0.3` da exactamente el mismo resultado (los mismos 932 errores, TS1294 con `enum` y Prisma en verde) y tarda unos 1,3 s.
   - Ver la decisión TQ-1.

### Decisiones técnicas incluidas en esta aprobación

Aprobar el plan supone aceptar las opciones recomendadas. Si prefieres otra, indícalo al aprobar.

- **TQ-1. Versión de TypeScript.**
  - **Recomendada: `typescript` `~6.0.3`**, con tilde para no subir a 6.1, que typescript-eslint aún no admite. Mismo resultado que TS 7 y compatible con el ticket de ESLint.
  - Alternativa: `^7.0.2`. Es más rápida, pero el ticket de ESLint tendría que esperar a que typescript-eslint admita TS 7 o instalar ambas versiones.
- **TQ-2. Dos líneas `@source` en `src/styles/{molotes,birria}/main.css`.**
  - R-1 dice que los `.css` de `src/styles` no cambian, pero el cambio de `.js` a `.ts` en esas dos rutas es necesario para que el CSS servido no cambie (punto 7).
  - **Recomendada: aceptar esta desviación mínima.** Se verifica que el CSS generado es idéntico al de `main`.
- **TQ-3. `engines.node` a `">=24.3.0"`** en `package.json`, que hoy dice `">=24"`.
  - Documenta la versión mínima sin `ExperimentalWarning`.
  - No afecta a Docker, que usa 24.21.0, ni a `.nvmrc` (`24`, que resuelve la última 24.x).
  - **Recomendada: aceptar.** Alternativa: dejar `">=24"` y solo documentarlo en el README.
- **TQ-4. `noUncheckedIndexedAccess: true`** (más estricto que `strict`).
  - Detecta accesos a `Record` e índices sin comprobar, algo útil para las entradas de formularios y de `DATA_DIR`. Cuesta unos 22 sitios más.
  - **Recomendada: incluirlo.**

### Archivos o componentes afectados

- **Renombrados** con `git mv` (`.js` → `.ts`) y tipados: los 41 archivos `.js` de `src/`, los 25 tests, `tests/helpers`, `tests/support/{admin,png}`, `scripts/hash-password` y `vitest.config`.
- **Nuevo:** `restaurante/tsconfig.json`. Si hiciera falta para Koa, `src/types/koa.d.ts` (ver Backend).
- **Modificados:**
  - `restaurante/package.json` y `package-lock.json`;
  - `restaurante/Dockerfile`;
  - `restaurante/README.md`;
  - `src/styles/molotes/main.css` y `src/styles/birria/main.css` (una línea cada uno, TQ-2);
  - `.claude/CLAUDE.md` §2;
  - `.claude/rules/javascript.md`;
  - `.claude/agents/senior-fullstack.md`.
- **Nuevo:** `.claude/rules/typescript.md`.
- **Sin cambios:** `public/` (CA-1), plantillas `.html`, `seed.json`, `compose.yaml`, `.dockerignore`, `.nvmrc`, `scripts/generate-icons.py` y los snapshots.

### tsconfig.json propuesto

```json
{
  "compilerOptions": {
    "target": "ES2024",
    "lib": ["ES2024", "DOM", "DOM.Iterable"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "types": ["node"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "erasableSyntaxOnly": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "allowJs": true,
    "checkJs": false,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*.ts", "tests/**/*.ts", "scripts/**/*.ts", "vitest.config.ts"],
  "exclude": ["node_modules", "public"]
}
```

Notas:

- Con `noEmit`, `tsc` nunca genera `dist/`.
- `erasableSyntaxOnly` rechaza `enum`, `namespace` con valor, parameter properties e `import =` (CA-3). `verbatimModuleSyntax` obliga a usar `import type` para los tipos, que es lo que Node necesita al quitar los tipos.
- `allowImportingTsExtensions` permite `import … from './x.ts'`.
- `types: ["node"]` va explícito porque TS 6 cambió el valor por defecto.
- `allowJs` con `checkJs: false` resuelve D-4: las pruebas `.ts` importan `public/js/**/*.js`. Sin estas opciones, `strict` da TS7016 ("could not find a declaration file"). Con ellas, `tsc` infiere los tipos desde la JSDoc del frontend **sin verificarlo ni modificarlo**. `include` solo contiene `.ts`, así que ningún otro `.js` entra en la verificación.
- `DOM` en `lib`: lo usan las pruebas con `@vitest-environment jsdom`. `@types/jsdom` ya lo añade de forma global; dejarlo explícito evita depender de ese efecto lateral.
- No se incluye `resolveJsonModule` porque no hay imports JSON (punto 4).

### Dependencias (solo devDependencies, CA-13)

| Paquete | Versión | Motivo |
| --- | --- | --- |
| `typescript` | `~6.0.3` (TQ-1) | `tsc --noEmit` para `npm run typecheck`. Node no verifica tipos. |
| `@types/node` | `^24.19.1` | Tipos del runtime (Node 24.x: `node:fs`, `process`, `import.meta.dirname`, `crypto.scrypt`). La versión mayor coincide con el runtime. |
| `@types/koa` | `^3.0.3` | Koa 3.2 no trae tipos. `@koa/router` 15 los importa (`import … from 'koa'`). |
| `@types/koa-static` | `^4.0.4` | `koa-static` 5 no trae tipos. Arrastra `@types/koa-send`. Es la última versión publicada y es compatible con `@types/koa` 3. |
| `@types/supertest` | `^7.2.1` | `supertest` 7 no trae tipos. |
| `@types/jsdom` | `^30.0.0` | `jsdom` 30 no trae tipos. Lo usan `tests/support/admin` y `tests/integration/icons`. |

No hacen falta paquetes de tipos para `@koa/router` 15.7, `koa-helmet` 9, `helmet` 8 ni `vitest` 5, porque ya traen los suyos (`dist/index.d.ts`, `index.d.mts`, `index.d.cts`). **No hay dependencias de producción nuevas.** `npm ci --omit=dev` las excluye todas (verificado: 0 paquetes con `--omit=dev` en el spike de Alpine).

### Backend

- **Imports relativos:** con extensión `.ts`, incluidos los `import('./x.ts')` de tipos.
  - Los imports que solo traen tipos usan `import type` (`verbatimModuleSyntax`).
  - Los imports de `public/js` desde las pruebas siguen con `.js`.
- **JSDoc a TypeScript:**
  - los `@param`/`@returns`/`@typedef` se convierten en anotaciones, `type` o `interface`;
  - se conservan los comentarios descriptivos (REQ, RF, DT);
  - se prefieren los tipos inferidos y se exportan los contratos compartidos: `Config` (con `ReturnType<typeof loadConfig>`), `MenuRepository`, `LandingView`, `SafeHtml`, `Logger`, `BusinessId`.
- **Entradas externas como `unknown`:** `env` en `loadConfig`, `JSON.parse` de semillas y datos, cuerpos de formulario y `catch (err)`.
  - Se estrechan con las validaciones que ya existen (`menu-schema`, `admin-form`, `env`), sin cambiar la lógica.
  - En `error-handler` se tipa `err` como `unknown` y se lee `status`, `statusCode`, `expose`, `headers` y `code` con guardas. Hoy se lee con `?.`, así que las respuestas no cambian.
- **Clases** (`ConfigError` y similares): los campos se declaran con tipo (`readonly issues: string[]`), nunca como parameter properties.
- **Koa:**
  - `ctx.state` y el contexto de admin se tipan con los genéricos de `Router<State, Context>` y `Koa.Middleware<State>`.
  - Solo si no basta, se usa una augmentation `declare module 'koa'` en `src/types/koa.d.ts`, que es ambiental y no se ejecuta.
- **`any`:** prohibido salvo con un comentario de justificación en la misma línea o en la anterior (CA-4).
  - Las aserciones `as` y `!` se limitan a casos que ya están garantizados por una validación previa, también con su comentario.
- **Sin cambios de lógica.** Si `strict` descubre un error real, no se corrige aquí: se documenta en "Riesgos o pendientes" y se consulta (NEEDS_TECHNICAL_CLARIFICATION).

### Frontend

Sin cambios en `public/`. Solo cambian las dos líneas `@source` (TQ-2).

### Contenido / configuración

`package.json`:

- `main`: `src/server.ts`.
- `start`: `node --env-file-if-exists=.env src/server.ts`.
- `dev`: `node --watch --env-file-if-exists=.env src/server.ts`.
- `admin:hash-password`: `node scripts/hash-password.ts`.
- `typecheck`: `tsc -p tsconfig.json` (nuevo).
- `test`, `test:watch`, `build:css*`, `watch:css*` y `lint` (placeholder) no cambian.
- `engines.node`: `">=24.3.0"` (TQ-3).

### Docker (R-5)

- **Etapa `build`:** `COPY . .`, luego `RUN npm run typecheck`, después `RUN npm run build:css`.
  - El typecheck va primero, para fallar pronto.
  - Las etapas `test` y `production` dependen de `build`, así que un error de tipos impide construir las dos (CA-10).
  - `tsconfig.json` ya entra con `COPY . .`, porque no está en `.dockerignore`.
- **Etapa `production`:**
  - `CMD ["node", "src/server.ts"]`;
  - se copian solo `src/` y `public/` (como hoy), así que la imagen lleva los `.ts` y no lleva `tsconfig`, `tests/` ni `scripts/`;
  - `npm ci --omit=dev` excluye `typescript` y `@types/*`;
  - siguen igual: `USER node` (UID 1000), `HEALTHCHECK` con `wget` y la señal `SIGTERM` directa a `node` como PID 1.
- Se actualizan los comentarios de cabecera del Dockerfile (etapas y referencias a `tests/unit/content.test.ts`).
- `compose.yaml` y `.dockerignore` no cambian.

### Validaciones

`env`, `menu-schema`, `admin-form` y `form-body` mantienen exactamente las mismas reglas y mensajes. Los tipos derivan de esas validaciones; no las sustituyen.

### Manejo de errores

Las respuestas, los códigos y el `ConfigError` (código 1, sin valores) siguen igual. `catch` usa `unknown` con guardas.

### Logs (R-8)

- Las líneas de stdout siguen siendo JSON. `createLogger` no cambia salvo en sus tipos.
- Advertencias del runtime:
  - Ninguna en Node ≥ 24.3, ni en local ni en `production`.
  - Con 24.0–24.2 aparece `ExperimentalWarning` en stderr. TQ-3 lo descarta como versión admitida.
  - Las líneas de `node --watch` son solo de desarrollo y ya existían. Se aceptan y se documentan en el Implementation Result.

### Testing

- Las pruebas solo se renombran y se tipan: no cambian aserciones, `it`/`describe` ni datos.
- Los tipos de las fixtures se ajustan con anotaciones; las pruebas que pasan datos inválidos a propósito usan `as unknown as T` con comentario.
- Las tres pruebas de `public/js` siguen con `@vitest-environment jsdom`.
- Verificación anti-debilitamiento (CA-5):
  - `npm test` con ≥ 25 archivos y ≥ 468 pruebas;
  - `git diff main --stat -- tests/snapshots` vacío;
  - `grep -nE "\.(skip|only|todo)\b"` sin resultados nuevos;
  - revisión de `git diff -M main -- tests/` (el rename con `-M` deja ver solo las líneas tocadas).
- **CA-6, HTML idéntico:**
  - Un script temporal en el scratchpad (no versionado) monta `createApp` con `now` fijo (un día laborable y un sábado) en `main` (copia con `git archive`) y en la rama, y compara byte a byte las respuestas de `/`, `/molotes`, `/birria`, `/admin`, CSS e iconos.
  - Además se comprueba `npm start` real con `curl`.
- **CA-7:** se compara stderr y el código de salida de `env -i PATH=… node src/server.ts` en `main` y en la rama.
- **CA-2 y CA-3:** se introduce de forma temporal un error de tipos y un `enum`, se ejecuta `npm run typecheck` (debe fallar) y se revierte.
- **CA-10 y CA-11:**
  - `docker compose run --rm test` en arm64 (nativo) y en amd64 (`DOCKER_DEFAULT_PLATFORM=linux/amd64`);
  - build con un error de tipos temporal (debe fallar en `build`);
  - con `production`: `docker run`, estado `healthy`, `docker stop` con código 0, `id -u` igual a 1000, `ls node_modules/typescript node_modules/@types` inexistentes y sin `.env` ni `data/`.
- **CA-12:** se filtran stdout de `npm start` y del contenedor con `node -e` y `JSON.parse` por línea; se revisa stderr.

### Seguridad

- No cambian CSP, helmet, sesiones, scrypt ni validaciones.
- No se agregan dependencias de producción.
- `tsconfig` y las devDependencies no entran en la imagen `production`.

### Performance

- Type stripping es casi gratuito al arrancar, porque solo sustituye los tipos por espacios.
- `tsc` tarda unos 1,3 s y solo se ejecuta en `typecheck` y en el build de Docker.

### Riesgos técnicos

- **Diff muy grande** (71 archivos renombrados: 41 de `src/`, 28 de `tests/`, `scripts/hash-password` y `vitest.config`). Mitigación:
  - `git mv` para conservar el historial;
  - migración por capas con `npm test` en verde tras cada una. Node y Vitest resuelven imports mixtos `.js`/`.ts` durante la transición;
  - `typecheck` en verde al terminar.
- **Tipado superficial** (`as`, `!` o `any` en exceso): CA-4 y revisión con `grep -nE ":\s*any\b|as any|<any>"` en el diff.
- **Errores reales que destape `strict`:** no se corrigen en este ticket; se informan (ver Backend).
- **typescript-eslint y TS 7:** cubierto por TQ-1.
- **Prisma (ticket futuro):** compatible si la salida queda fuera de `node_modules` y sin `package.json` sin `type` (punto 1).
- **`allowJs`:** si en el futuro alguien añade `.js` a `src/`, `include` no los verificaría. Mitigación: la nueva regla `typescript.md` prohíbe `.js` en el backend, y CA-1 se comprueba con `git ls-files 'src/**/*.js' 'tests/**/*.js' 'scripts/*.js'`.

### Orden de implementación

1. Crear la rama `feature/REQ-F-004-migracion-backend-typescript` desde `main`.
2. Instalar las devDependencies, crear `tsconfig.json` y añadir `typecheck` y `engines`.
3. Migrar `src/` por capas con `git mv` y tipado, con `npm test` tras cada capa: `utils` → `config` → `content` → `services` → `repositories` → `middleware` → `views` → `controllers` → `routes` → `app`/`server`. Al migrar `views/landings`, cambiar las dos líneas `@source` y comprobar que el CSS es idéntico.
4. Migrar `tests/` (helpers, support, unit, integration), `scripts/hash-password` y `vitest.config`. Actualizar los scripts y `main`.
5. `npm run typecheck` en verde, con revisión de `any`, `as` y `!`.
6. Dockerfile y verificación de CA-10 y CA-11.
7. Verificación de logs (CA-12) y de CA-6, CA-7, CA-8 y CA-9.
8. Actualizar el README (CA-15), corrigiendo también la referencia inexistente a `config/paths.js` del árbol de estructura.
9. Gobierno (CA-14):
   - CLAUDE.md §2;
   - `.claude/rules/typescript.md` (con frontmatter `paths` para `src/`, `tests/` y `scripts/`);
   - `.claude/rules/javascript.md` acotada a `public/js`;
   - `senior-fullstack.md`: stack, tabla de comandos con `typecheck`, validación en T2/T3, árbol real y "Persistencia y API".
10. Verificación final de CA-1 a CA-15 y revisión de `git diff main` para descartar cambios fuera de alcance.

### Criterios de finalización

- CA-1 a CA-15 comprobados con evidencia real en el Implementation Result.
- `npm run typecheck`, `npm test` y `npm run build:css` en verde, con el CSS idéntico al de `main`.
- `docker compose run --rm test` en verde en arm64 y amd64.
- `npm run lint` reportado como "no configurado".

## Implementation Result

### Rama

`feature/REQ-F-004-migracion-backend-typescript`, creada desde `main` (79d09c4). No hay commits: todos los cambios están en el árbol de trabajo. Los renombrados con `git mv` quedaron en el índice.

El ticket se movió de `backlog/` a `in-progress/` con `mv`, no con `git mv`, porque todavía no estaba versionado.

### Cambios realizados

- **Migración total** de 71 archivos renombrados con `git mv` (`.js` → `.ts`) y tipados con `strict` y `noUncheckedIndexedAccess`:
  - 41 de `src/`;
  - 28 de `tests/`;
  - `scripts/hash-password`;
  - `vitest.config`.
- Se migró por capas, con `npm test` en verde (25/468) tras cada una: utils → config → content → services → repositories → middleware → views → controllers → routes → app/server → tests/scripts.
- **Archivos nuevos:**
  - `restaurante/tsconfig.json`, igual al del plan;
  - `restaurante/src/utils/errors.ts`: `errorProp(err, key)`, que equivale a `err?.[key]` sobre un `catch (err: unknown)` y se reutiliza en `server`, `error-handler` y los repositorios;
  - `.claude/rules/typescript.md`.
- **Tipos principales:**
  - `Config` y `Env` (en `config/env`);
  - `BusinessId` e `isBusinessId` (en `config/businesses`);
  - nodos del esquema, datos editables por negocio y `MenuDocument<Id>` (en `services/menu-schema`);
  - `MenuStorage` y `MenuRepository` (en `repositories/menu-repository`). El contrato es genérico por negocio: `getPublished('molotes')` devuelve datos de Molotes;
  - `Renderer` y `SafeHtml` (en `views/render`);
  - `LandingView<Id>` (en `views/landings`);
  - `AdminState` y `AdminRouterContext` (rutas de administración, con `RouterContext` de `@koa/router`).
- **Entradas externas como `unknown`:** `env`, `JSON.parse` de las semillas y de `DATA_DIR`, cuerpos de formulario y errores capturados.
  - Se estrechan con las validaciones existentes.
  - Las comprobaciones extra que añadí solo estrechan tipos en estados que ya eran inalcanzables. Ejemplo: en `loadConfig`, cada valor `undefined` ya había dejado su problema en `issues`.
- **`package.json`:**
  - `main`, `start`, `dev` y `admin:hash-password` apuntan a `.ts`;
  - nuevo script `typecheck` (`tsc -p tsconfig.json`);
  - `engines.node` es `>=24.3.0` (TQ-3);
  - devDependencies: `typescript ~6.0.3` (TQ-1), `@types/node ^24.19.1`, `@types/koa ^3.0.3`, `@types/koa-static ^4.0.4`, `@types/supertest ^7.2.1` y `@types/jsdom ^30.0.0`.
- **`src/styles/{molotes,birria}/main.css`:** la línea `@source` de cada uno apunta a `views/landings/<negocio>.ts` (TQ-2).
- **`Dockerfile`:**
  - la etapa `build` ejecuta `npm run typecheck` antes de `build:css`;
  - `production` arranca con `CMD ["node", "src/server.ts"]`;
  - se actualizaron los comentarios.
- **`README.md`:** se actualizaron:
  - Requisitos (Node ≥ 24.3 y el aviso de 24.0 a 24.2);
  - el script `typecheck`;
  - las tablas de Docker y la nota de arranque;
  - la Estructura, donde se quitó `config/paths.js`, que no existía, y se añadieron `tsconfig.json`, `vitest.config.ts` y `errors.ts`;
  - todas las rutas `.js` del backend.
- **Gobierno:**
  - CLAUDE.md §2 (Backend) describe TypeScript estricto con type stripping y `npm run typecheck`;
  - `.claude/rules/javascript.md` queda acotada a `public/js`;
  - `senior-fullstack.md`: stack del backend, frontend sin TypeScript, testing, tabla de comandos con `typecheck`, `typecheck` en el modo directo y en la validación T2/T3, "Persistencia y API" (con `DATA_DIR`, `/admin` y sesión, y la instrucción de no improvisar) y el árbol real.
- **Pruebas:** solo cambian anotaciones de tipo, `!` sobre fixtures conocidos, `as const` en tablas de `it.each` y 8 `// @ts-expect-error: <motivo>` en llamadas con valores inválidos a propósito.
  - Hay un único `any`: `CorruptibleData` en `tests/helpers.ts`, con su justificación en la línea anterior. Lo usan las pruebas que corrompen datos a propósito.
  - No se tocó ninguna aserción, ningún `it`/`describe` ni ningún snapshot.

### Criterios de aceptación

| CA | Estado | Evidencia |
| --- | --- | --- |
| CA-1 | Cumple | `find src tests scripts -name '*.js'` → 0. Existe `vitest.config.ts`. `git diff main --stat -- public/` está vacío. |
| CA-2 | Cumple | `npm run typecheck` → 0. Con el archivo temporal `src/zz-ca2.ts` (`const roto: number = "texto"`) → TS2322 y salida 2. Revertido. |
| CA-3 | Cumple | Con el archivo temporal `export enum Prueba { A }` → TS1294 ("not allowed when 'erasableSyntaxOnly'") y salida 2. Revertido. |
| CA-4 | Cumple | `tsconfig.json` tiene `"strict": true` y `noUncheckedIndexedAccess`. En el diff hay un solo `any` (`tests/helpers.ts`, `CorruptibleData`), justificado. En `src/` no hay `!` y cada `as` lleva comentario, salvo los que solo amplían un tipo, que también lo llevan. |
| CA-5 | Cumple | `npm test`: 25 archivos y 468 pruebas en verde. `skip`/`only`/`todo` nuevos: 0. `git diff main -- tests/snapshots` vacío. Revisado con `git diff -M main -- tests/`. |
| CA-6 | Cumple | Script del scratchpad que monta `createApp` de `main` (`.js`) y de la rama (`.ts`) con la misma fecha (viernes y sábado). Compara 15 rutas × 2 fechas (`/`, `/molotes`, `/birria`, `/admin`, `/admin/login`, `/admin/molotes`, 404, los 3 CSS, JS, iconos y manifests): mismo código HTTP y mismo hash de cuerpo y cabeceras (incluida la CSP). Solo excluí `date` y `last-modified`. Resultado: **IDÉNTICO**. Con `npm start` real: 200 en `/`, `/molotes`, `/birria`, los 3 CSS, los iconos y los manifests; `/admin/molotes` sin sesión responde 303 a `/admin/login?next=…`. |
| CA-7 | Cumple | `env -i PATH=$PATH node src/server.{js,ts}` en `main` y en la rama: salida 1 en los dos y stderr idéntico (`diff`). Con valores inválidos (PORT, número, URL y admin incompleto) la lista de problemas también es idéntica y no muestra valores. |
| CA-8 | Cumple | `npm run dev` y `touch src/utils/datetime.ts` → "Change detected… Restarting 'src/server.ts'" y un segundo `server_started`. Después responde 200. |
| CA-9 | Cumple | `printf 'contrasena-larga-123\n' \| npm run -s admin:hash-password` → `scrypt$…` (6 campos). Con ese hash, el `POST /admin/login` responde 303 a `/admin/molotes` y `GET /admin/molotes` con sesión responde 200. |
| CA-10 | Cumple | `docker compose run --rm test` en arm64: salida 0, 25 archivos y 468 pruebas. Con `DOCKER_DEFAULT_PLATFORM=linux/amd64`: salida 0, 25 y 468 (imagen `amd64`). Con un error de tipos temporal, `docker build --target production` falla en `RUN npm run typecheck` (salida 1). |
| CA-11 | Cumple | La imagen `production` arranca, `/` y `/birria` responden 200, queda `healthy` y `docker stop` termina con código 0. `id -u` = 1000. No existen `node_modules/typescript` ni `node_modules/@types`. No hay `.env`, `data/` ni `tsconfig.json`. Usa Node v24.21.0. |
| CA-12 | Cumple | `npm start`: 20 de 20 líneas de stdout son JSON, sin contar las 2 líneas de cabecera que imprime el propio npm (`> restaurante@0.1.0 start`). stderr vacío. `production`: 8 de 8 líneas son JSON y stderr está vacío. |
| CA-13 | Cumple | `dependencies` sin cambios (5 paquetes). Las devDependencies nuevas están justificadas en el Technical Action Plan. |
| CA-14 | Cumple | CLAUDE.md §2, `typescript.md` (nueva), `javascript.md` (acotada) y `senior-fullstack.md` actualizados. Ninguno dice que el backend es JavaScript ni "sin TypeScript". El árbol coincide con `find src tests scripts public -maxdepth 2 -type d`. |
| CA-15 | Cumple | Se ejecutaron tal como están escritos `typecheck`, `start`, `dev`, `test`, `admin:hash-password`, `docker compose run --rm test` (en las dos arquitecturas) y `docker build --target production`. |

### Validaciones ejecutadas

- `npm run typecheck` → salida 0.
- `npm test` → 25 archivos y 468 pruebas en verde.
- `npm run build:css` → salida 0. Los CSS de `molotes`, `birria` y `admin` son **idénticos byte a byte** a los de `main` (`cmp`).
- `npm run lint` → **lint no configurado** (placeholder: "lint: pendiente de configurar").
- Docker: `docker compose run --rm test` en arm64 y amd64 → 0. Build con error de tipos → falla en `build`. Imagen `production` verificada (CA-11).

### R-8: advertencias del runtime

- **`ExperimentalWarning` de type stripping:** Node 24.21.0, que se usa en local y en `node:24-alpine`, no la emite. Las versiones 24.0 a 24.2 la escriben en **stderr**. **Resuelto** con `engines.node >=24.3.0` y la nota del README.
- **`node --watch`:** escribe en stdout "Change detected…" y "Restarting…", que no son JSON. Ya ocurría con `.js`, solo pasa con `npm run dev` y no aparece en `npm start` ni en `production`. **Aceptado** y documentado aquí.

### Archivos afectados

- **Renombrados y tipados:** `restaurante/src/**` (41), `restaurante/tests/**` (28), `restaurante/scripts/hash-password.ts` y `restaurante/vitest.config.ts`.
- **Nuevos:** `restaurante/tsconfig.json`, `restaurante/src/utils/errors.ts` y `.claude/rules/typescript.md`.
- **Modificados:**
  - `restaurante/package.json` y `restaurante/package-lock.json`;
  - `restaurante/Dockerfile` y `restaurante/README.md`;
  - `restaurante/src/styles/molotes/main.css` y `restaurante/src/styles/birria/main.css` (una línea cada uno);
  - `.claude/CLAUDE.md`, `.claude/rules/javascript.md` y `.claude/agents/senior-fullstack.md`.
- **Sin cambios:** `public/`, plantillas `.html`, `seed.json`, snapshots, `compose.yaml`, `.dockerignore` y `.nvmrc`.

### Riesgos o pendientes

- **Pequeños cambios de código hechos solo para tipar**, sin efecto observable (verificado con CA-6 y la suite):
  - `repositories/menu-repository`: ya no se asigna el estado provisional `{ published: null }` antes de `markDamaged`, porque `markDamaged` (`atStartup`) lo asigna antes de leerlo;
  - el log `menu_data_damaged_pending` calcula `servingFrom` con la misma expresión;
  - `visible-menu`: `variants.length === 0` pasa a ser `active === undefined`;
  - `views/landings/birria`: `'priceUnit' in item`;
  - `tests/support/png`: `buffer[i]` pasa a ser `readUInt8(i)`.
- **Contrato genérico del repositorio:** `MenuRepository` se expone con genéricos por negocio. La implementación interna no correlaciona tipos y usa un único `as MenuRepository`, justificado porque `validateMenuDocument` exige `business === businessId`.
- `scripts/generate-icons.py` (fuera de alcance) menciona en un comentario `src/content/<negocio>/index.js`, que ahora es `.ts`. No lo toqué.
- La sección "Testing" de `senior-fullstack.md` sigue mencionando `vi.setSystemTime`, aunque las pruebas inyectan `now`. Es previo a este ticket y no lo corregí.
- **Sin cambios de comportamiento descubiertos por `strict`:** no apareció ningún error real que exigiera cambiar la lógica.
- Tickets futuros ya creados por el BA (REQ-F-005 a REQ-F-008): no los toqué.

## QA Action Plan

### Objetivo

Comprobar con evidencia propia (independiente de la verificación de senior-fullstack) que la migración a TypeScript cumple CA-1 a CA-15 y que el comportamiento observable de la rama es idéntico al de `main`: HTTP, HTML, CSS, logs, administración, configuración y Docker.

### Requisito bajo prueba

REQ-F-004, versión 1, con las decisiones D-1 a D-7 y TQ-1 a TQ-4 aprobadas. Rama `feature/REQ-F-004-migracion-backend-typescript` sin commits; los renombrados están en el índice y el resto sin preparar.

### Línea base de comparación

Para comparar con `main` sin tocar el repositorio:

- `git archive main restaurante | tar -x` en el scratchpad de la sesión, `npm ci` y `npm run build:css` dentro de esa copia (baseline `main`).
- La rama se prueba en `restaurante/` tal como está en el árbol de trabajo.
- Las dos usan el mismo `.env` (copiado a la baseline) y **directorios `DATA_DIR` temporales separados** en el scratchpad, sembrados igual. No se toca el `data/` real.

### Criterios de aceptación (cada uno → pruebas que lo cubren)

| CA | Pruebas |
| --- | --- |
| CA-1 | F-1 |
| CA-2 | F-2 |
| CA-3 | F-3 |
| CA-4 | F-4 |
| CA-5 | A-1, A-2, A-3, A-4 |
| CA-6 | R-1, R-2, R-3, N-3, B-1 |
| CA-7 | N-1, N-2 |
| CA-8 | F-6 |
| CA-9 | F-7, R-3 |
| CA-10 | D-1, D-2, D-3 |
| CA-11 | D-4 |
| CA-12 | L-1, L-2 |
| CA-13 | F-5 |
| CA-14 | G-1 a G-5 |
| CA-15 | G-6, G-7 |

### Riesgos identificados

1. Que se pierdan pruebas o aserciones al tipar los tests (cambios de `!`, `as`, `@ts-expect-error`, helpers como `declaredSize`), o que el conteo coincida y aun así haya cambiado qué se prueba.
2. Que cambie el comportamiento por los "pequeños cambios de código hechos solo para tipar" (`menu-repository` sin estado provisional antes de `markDamaged`, `visible-menu` con `active === undefined`, `'priceUnit' in item`, `errorProp` en `error-handler`, repositorios y `server`).
3. Que `error-handler` produzca otro código, cuerpo o cabeceras en errores (404, 405, 413, 415 o 500) porque ahora lee `err` con guardas.
4. Que el CSS generado cambie por las dos líneas `@source` (TQ-2) o porque Tailwind deje de ver clases en los `.ts`.
5. Que la imagen `production` falle al arrancar con `.ts` o que arrastre `typescript`/`@types` o `tsconfig`.
6. Que `typecheck` no rechace de verdad un error o un `enum` en `tests/`, `scripts/` o `vitest.config.ts` (no solo en `src/`).
7. Que la administración (sesión, CSRF, límite de intentos, guardado con conflicto de versión, restauración y datos dañados en `DATA_DIR`) se comporte distinto.
8. Documentación de gobierno que contradiga el código real (árbol, "Persistencia y API").

### Pruebas funcionales

- **F-1 (CA-1).** `find restaurante/src restaurante/tests restaurante/scripts -name '*.js'` y `git ls-files` equivalente (índice y árbol) → 0 resultados. Existe `vitest.config.ts` y no `vitest.config.js`. `git diff main -- restaurante/public` y `git status --short -- restaurante/public` vacíos. Plantillas `.html`, `seed.json` y snapshots sin cambios (`git diff main --stat` filtrado por esas extensiones).
- **F-2 (CA-2).** `npm run typecheck` → 0 y tiempo de ejecución. Luego, uno por uno y revertidos al instante (archivos temporales no versionados): error de tipo en `src/` (archivo nuevo), en `tests/` (archivo nuevo `*.ts` que no termine en `.test.ts`, para no afectar a Vitest) y en `scripts/` → cada uno debe dar salida distinta de 0 con el error esperado. Al final, `git status` idéntico al inicial.
- **F-3 (CA-3).** Igual que F-2 con `enum`, `namespace` con valor, parameter property e `import x = require()` → TS1294 (u otro error de `erasableSyntaxOnly`) y salida distinta de 0. Además, un import relativo con `.js` y otro de solo tipos sin `import type` → `typecheck` falla (convenciones de `verbatimModuleSyntax` y de extensión).
- **F-4 (CA-4).** `tsconfig.json` con `strict` y `noUncheckedIndexedAccess`. Búsqueda en `src/`, `tests/`, `scripts/` y `vitest.config.ts` de `: any`, `as any`, `<any>`, `any[]`, `Array<any>`, `@ts-ignore`, `@ts-nocheck` y `eslint-disable`: cada `any` con justificación en la misma línea o en la anterior. Inventario de `as` y `!` en `src/` y comprobación de que cada `as` lleva comentario (regla de `typescript.md`). Los 8 `@ts-expect-error` llevan motivo.
- **F-5 (CA-13).** `git diff main -- restaurante/package.json`: `dependencies` idéntico. Comparar `npm ls --omit=dev --all --json` de la baseline y de la rama: mismo árbol de producción. `npm ci --omit=dev --dry-run` (o en copia del scratchpad) sin `typescript` ni `@types/*`. Cada devDependency nueva aparece justificada en el Technical Action Plan.
- **F-6 (CA-8).** `npm run dev` en puerto libre con `DATA_DIR` temporal; `touch` de un `.ts` de `src/` (sin modificar contenido) → reinicio con un segundo `server_started` y 200 en `/` después.
- **F-7 (CA-9).** `npm run admin:hash-password` con contraseña por stdin, en la baseline y en la rama: mismo formato (`scrypt$32768$8$1$<salt>$<hash>`, mismas longitudes). El hash generado por la rama se valida en la baseline y viceversa (mismo algoritmo). Con ese hash en el `.env` de prueba, login correcto en `/admin` (R-3).

### Pruebas negativas y casos límite

- **N-1 (CA-7).** `env -i PATH=$PATH node src/server.{js,ts}` (sin variables) en baseline y rama → salida 1 en las dos y `diff` de stderr vacío; sin valores en la salida.
- **N-2 (CA-7).** Configuraciones inválidas una a una (PORT fuera de rango, `BUSINESS_TIMEZONE` inválida, número de WhatsApp inválido, URL de WhatsApp inválida, admin incompleto, hash con formato incorrecto, `DATA_DIR` inválido si aplica) → mismo código de salida y `diff` de stderr vacío. Los valores de prueba se eligen de forma que no aparezcan en la salida (se busca el valor literal con `grep`).
- **N-3 (CA-6).** Errores HTTP en baseline y rama: ruta inexistente, método no permitido en `/` y en `/admin/*`, cuerpo de formulario demasiado grande, `Content-Type` incorrecto en POST de admin, CSRF ausente o inválido, login con credenciales erróneas hasta activar el límite de intentos → mismo código, cuerpo y cabeceras relevantes (incluida la CSP).
- **N-4 (riesgo 2).** Datos dañados en `DATA_DIR` (JSON inválido y documento que no cumple el esquema) al arrancar y al leer, en baseline y rama: mismo HTML servido (semilla o última publicación válida), mismas respuestas de `/admin` y mismo evento de log (`menu_data_damaged*`) con los mismos campos.
- **N-5 (riesgo 2).** Producto de Birria con todas las variantes no disponibles y producto `chips` con `priceUnit`: HTML idéntico en baseline y rama (cubre `visible-menu` y `'priceUnit' in item`).

### Pruebas de regresión

- **R-1 (CA-6, HTML idéntico con fecha simulada).** Script propio en el scratchpad que importa `createApp` de la baseline (`.js`) y de la rama (`.ts`), con el mismo repositorio en memoria y `now` fijo, y compara código, cabeceras (sin `date`, `last-modified` y `etag` si depende de mtime) y cuerpo byte a byte de: `/`, `/molotes`, `/birria`, `/admin`, `/admin/login`, `/admin/molotes`, `/admin/birria`, los 3 CSS, los JS de `public/js`, iconos de la raíz y por negocio, `favicon.ico`, los `.webmanifest`, una imagen y un 404. Fechas: viernes 23:59 y sábado 00:00, domingo 23:59 y lunes 00:00 en `America/Mexico_City`, un miércoles y otra zona configurada (`BUSINESS_TIMEZONE=UTC`). El script se ejecuta también con `TZ=UTC` y `TZ=Asia/Tokyo` en el proceso para cubrir un servidor en otra zona.
- **R-2 (CA-6, servidor real).** Baseline (`node src/server.js`) y rama (`npm start`) a la vez en dos puertos libres, con el mismo `.env` y `DATA_DIR` separados: `curl` de las mismas rutas → mismos códigos y cuerpos; `/admin/molotes` sin sesión → 303 al login en las dos. Se comprueba que `/` sirve la landing que corresponde al día real en `America/Mexico_City`.
- **R-3 (administración extremo a extremo).** Flujo con `fetch` sobre los dos servidores reales: login (CSRF), edición y guardado de cada negocio, conflicto de versión (dos guardados con la misma `expectedVersion`), restauración de la versión anterior, logout y sesión caducada. Se comparan códigos, `Location`, atributos de la cookie de sesión y el HTML resultante (normalizando tokens de CSRF y de sesión) y el contenido final de los JSON de `DATA_DIR` (normalizando `updatedAt`). La landing pública refleja el cambio igual en las dos.
- **R-4 (CSS).** `npm run build:css` en la baseline y en la rama → `cmp` de `public/css/{molotes,birria,admin}/main.css` sin diferencias.
- **R-5 (blast radius).** Revisión con `codegraph explore` de los símbolos con cambios que no son solo de tipos (`createMenuRepository`/`markDamaged`, `buildVisibleMenu`, `errorProp` y sus consumidores en `error-handler`, `server` y repositorios, landing de Birria) y del diff con rename (`git diff -M30% main`) de esos archivos; cada cambio de lógica tiene una prueba de R-1, R-3, N-3, N-4 o N-5 que lo ejerce.

### Pruebas automatizadas (existentes y anti-debilitamiento)

- **A-1.** `npm run build:css && npm test` en la rama → todo en verde, con ≥ 25 archivos y ≥ 468 pruebas.
- **A-2.** `npx vitest run --reporter=json` en la baseline y en la rama → la lista de pruebas (archivo sin extensión + nombre completo, con los `it.each` expandidos) es **idéntica**, y todas `passed` en las dos. Esto confirma que no se perdió ni se renombró ninguna prueba.
- **A-3.** Recuento de llamadas `expect(` (y `expect.assertions`/`toThrow`/`rejects`) por archivo de prueba en baseline y rama: igual o mayor en cada archivo. Revisión manual de `git diff -M30% main -- restaurante/tests` para confirmar que las líneas cambiadas solo añaden tipos, `!`, `as`, `@ts-expect-error` o helpers equivalentes (p. ej. `declaredSize` frente a `ICON_FILES[key].size`), sin cambiar valores esperados.
- **A-4.** `grep -nE '\.(skip|only|todo)\b|\bxit\(|\bxdescribe\('` en `tests/` de baseline y rama → sin apariciones nuevas. `git diff main -- restaurante/tests/snapshots` vacío y `git status` de `tests/snapshots` limpio después de ejecutar la suite (no se reescribieron snapshots).
- **Pruebas nuevas en `restaurante/tests/`:** no se proponen. Las comparaciones con `main` son temporales y viven en el scratchpad, porque dependen de una copia de `main` y no tienen valor como prueba permanente. No se agregan dependencias.

### Pruebas de Docker

- **D-1 (CA-10).** `docker compose run --rm test` en arm64 → salida 0 y el resumen de Vitest (archivos y pruebas).
- **D-2 (CA-10).** `DOCKER_DEFAULT_PLATFORM=linux/amd64 docker compose run --rm test` → salida 0 y el mismo resumen. Se confirma la arquitectura de la imagen con `docker image inspect`.
- **D-3 (CA-10).** Con un archivo temporal con error de tipos (no versionado, eliminado al terminar): `docker build --target production` y `--target test` fallan en el paso `RUN npm run typecheck` de la etapa `build`. Se comprueba que el archivo temporal se eliminó y `git status` vuelve al estado inicial.
- **D-4 (CA-11).** Imagen `production` construida desde el árbol actual:
  - `docker run` con el `.env` por `--env-file` y un volumen temporal para `DATA_DIR` → 200 en `/`, `/molotes` y `/birria`;
  - estado `healthy` (`docker inspect --format '{{.State.Health.Status}}'`);
  - `docker stop` → `ExitCode` 0 y log de cierre ordenado;
  - `docker run --rm --entrypoint id <img> -u` → 1000;
  - `ls node_modules/typescript node_modules/@types` inexistentes; `find / -name tsc` limitado a `/app` sin resultados;
  - sin `.env`, `data/`, `tsconfig.json`, `tests/` ni `scripts/` en `/app`; `docker history` sin `ENV` con secretos;
  - `node --version` ≥ 24.3.

### Pruebas de logs

- **L-1 (CA-12, local).** stdout de `npm start` (sin las 2 líneas de cabecera de npm) y de `node src/server.ts` directo, tras el tráfico de R-2 y R-3: cada línea pasa `JSON.parse`; stderr vacío. Comparación con la baseline: mismos tipos de evento y mismas claves por evento (normalizando hora, duración e ids).
- **L-2 (CA-12, production).** `docker logs` separando stdout y stderr: todas las líneas de stdout son JSON y stderr vacío (sin `ExperimentalWarning`). Se confirma que las únicas líneas no JSON de `npm run dev` son las de `node --watch` aceptadas en R-8.

### Pruebas de gobierno y documentación

- **G-1 (CA-14).** `CLAUDE.md` §2 cumple R-9 (TypeScript estricto, type stripping de Node 24, sin compilación, `npm run typecheck`; frontend en Vanilla JS) y el resto de `CLAUDE.md` no cambia (`git diff`).
- **G-2 (CA-14).** `.claude/rules/typescript.md` contiene cada punto de R-9 (sintaxis borrable, imports `.ts`, `strict`, `any` justificado, tipos inferidos, `unknown` para entradas externas validadas, `typecheck` antes de terminar) y su bloque `paths` sigue el formato de las demás reglas.
- **G-3 (CA-14).** `.claude/rules/javascript.md` queda acotada a `public/js` y el resto del archivo no cambia.
- **G-4 (CA-14).** `senior-fullstack.md`: sin "sin TypeScript" para el backend; `typecheck` en la tabla de comandos y en la verificación T2/T3 y el modo directo; árbol de estructura comparado con `find restaurante -maxdepth 3 -type d` (sin `node_modules`, `data`) y con los archivos que nombra; "Persistencia y API" contrastada con el código (`DATA_DIR`, `/admin`, sesión en memoria, CSRF y límite de intentos, mediante `codegraph explore`/`grep`) y conserva la instrucción de no improvisar.
- **G-5.** Búsqueda en `.claude/` (salvo tickets) y `restaurante/README.md` de rutas `.js` del backend y de "JavaScript moderno"/"sin TypeScript" aplicados al backend → ninguna. Las referencias desactualizadas que el Implementation Result declara fuera de alcance (`scripts/generate-icons.py`, `vi.setSystemTime` en "Testing") se registran como observación, no como defecto, porque ningún CA las incluye.
- **G-6 (CA-15).** README: Requisitos, Scripts (`typecheck`), Estructura, Docker y rutas `.ts` según R-10; el árbol de Estructura coincide con el sistema de archivos; no documenta nada inexistente.
- **G-7 (CA-15).** Cada comando documentado en el README (`typecheck`, `start`, `dev`, `test`, `admin:hash-password`, `build:css` y los de Docker) se ejecuta **copiado literalmente** del README y termina como describe el texto.

### Pruebas en navegador (Claude in Chrome)

Complementarias: CA-6 se demuestra con la comparación byte a byte de R-1/R-2. Ningún CA depende solo del navegador.

- **B-1.** Con los dos servidores de R-2 abiertos en pestañas nuevas: `/molotes`, `/birria`, `/` y `/admin/login` (y tras iniciar sesión, `/admin/molotes`) a 375×812, 768×1024 y 1440×900. Se comprueba que se ven igual en baseline y rama, sin overflow horizontal (`document.documentElement.scrollWidth <= innerWidth`), CTA de WhatsApp visible sin scroll en móvil con `href`, `target` y `rel` iguales en las dos, selector de variantes y formulario de promoción funcionando, y consola sin errores (incluidas violaciones de CSP).
- Si la extensión no responde tras 2 o 3 intentos, se marca como pendiente de revisión manual y no bloquea la aprobación.

### Pruebas responsive, accesibilidad, UX/UI y SEO

No hay cambios de UI (`public/`, plantillas y CSS idénticos). Se cubren por identidad: si R-1/R-2/R-4 muestran HTML y CSS idénticos, la accesibilidad, el SEO (`title`, description, canonical, Open Graph, encabezados) y el diseño frente a `_stich_source_/` no cambian. B-1 añade una comprobación visual de humo. No se repite la auditoría completa de accesibilidad, SEO ni Stitch.

### Pruebas de performance

- Tiempo de arranque de la baseline y de la rama (desde el proceso hasta `server_started`, 5 ejecuciones cada una) y uso de memoria en reposo (RSS) del contenedor `production` frente a lo esperado: solo se registra; únicamente es defecto una regresión clara y reproducible.
- Tamaño de la imagen `production` de la rama frente a una construida desde la baseline.

### Evidencia requerida

Salida de los comandos (códigos de salida, resúmenes de Vitest, `diff`/`cmp`, `docker inspect`), el resultado del script de comparación (rutas × fechas × zonas, con IDÉNTICO o la diferencia), el diff de la lista de pruebas de A-2, el recuento de A-3 y las capturas o lecturas de B-1. Los scripts y salidas viven en el scratchpad; el resumen va al QA Report.

### Limpieza

Detener todos los servidores y contenedores, borrar los archivos temporales de F-2, F-3 y D-3 y confirmar que `git status` es igual al inicial. No se hacen commits.

### Criterios de aprobación

- CA-1 a CA-15 en PASS con evidencia.
- A-2 sin diferencias en la lista de pruebas y A-3 sin aserciones perdidas.
- R-1 a R-4 sin diferencias (fuera de las cabeceras excluidas y los tokens normalizados).
- Sin defectos `BLOCKER` ni `CRITICAL`, y cualquier `MAJOR` aceptado de forma explícita por el usuario.
- `npm test` en verde, en local y en Docker (arm64 y amd64).

## QA Report

### Ronda

1 (2026-10-03). QA Action Plan aprobado por el usuario ("apruebo el plan de QA"). La ejecución se interrumpió una vez por un límite de la API y se retomó ("Continua"). Antes de seguir confirmé que `git status` y el contenido del árbol eran los iniciales y que no quedaba ningún servidor ni contenedor de QA en marcha.

La línea base es una copia de `main` (`git archive main`) en el scratchpad, con `npm ci` y `build:css`. Los scripts y las salidas están en `<scratchpad>/qa/`.

### Pruebas ejecutadas

| Id | Acción | Resultado |
| --- | --- | --- |
| A-1 | `npm run build:css && npm test` en la rama | 25 archivos, 468 pruebas en verde. La rama se ejecutó 8 veces: 8 de 8 en verde. |
| A-2 | Lista de pruebas de `vitest --reporter=json`, `main` frente a la rama (archivo sin extensión + nombre completo) | **Idénticas**: 468 frente a 468, todas `passed` en la rama. |
| A-3 | Recuento por archivo de `expect(` y de matchers (`.toX`, `rejects`, `resolves`), `main` frente a la rama | Iguales en los 28 archivos de `tests/`. |
| A-3b | Diff de comportamiento: la rama sin tipos (`module.stripTypeScriptTypes`, `.ts`→`.js` en los imports) y normalizada con el printer de TypeScript (sin comentarios ni formato), frente a `main` | Los cambios en `tests/` son equivalentes en ejecución: alias `seedOf`, objetos reformateados, `declaredSize(key)` = `ICON_FILES[key].size` y `readUInt8(i)` en lugar de `buf[i]`. Ningún valor esperado cambia. |
| A-4 | `.skip`/`.only`/`.todo`/`xit`/`xdescribe` en `main` y en la rama; `git diff main -- tests/snapshots`; `git status` de los snapshots tras la suite | 0 y 0; diff vacío; sin cambios. |
| F-1 | `find src tests scripts -name '*.js'` y `git ls-files` | 0 y 0. Existe `vitest.config.ts`. `git diff main -- restaurante/public` vacío. Plantillas `.html`, JSON y snapshots sin cambios. Además de los renombrados, en `src/` solo cambian las dos líneas `@source` (TQ-2) y se añade `errors.ts`. |
| F-2 | Error de tipo temporal en `src/`, `tests/` y `scripts/` | TS2322 y salida 2 en los tres. Revertido. |
| F-3 | Sintaxis no borrable temporal: `enum` (en `src`, `tests` y `scripts`), `namespace` con valor, parameter property e `import =` | TS1294 y salida 2 en todos. Un tipo sin `import type` da TS1484; un parámetro sin tipo, TS7006; un índice sin comprobar, TS2322 (`noUncheckedIndexedAccess`). Ver la observación O-1 sobre los imports `.js`. |
| F-4 | Búsqueda de `any`, `@ts-ignore`, `@ts-nocheck` y `eslint-disable`; inventario de `as` y `!` | Un solo `any` (`tests/helpers.ts:9`, justificado en la línea anterior). 0 `@ts-ignore`/`@ts-nocheck`. Los 8 `@ts-expect-error` llevan motivo. En `src/` no hay `!` y cada `as` tiene un comentario al inicio de su expresión o en la función. |
| F-5 | `dependencies` de `main` frente a la rama; `npm ls --omit=dev --all` de las dos | `dependencies` idénticas. Árbol de producción **idéntico** (71 paquetes, 0 de `typescript`/`@types`). devDependencies nuevas: las 6 del Technical Action Plan, con `typescript` 6.0.3 instalado. |
| F-6 | `npm run dev` y `touch` de `src/utils/datetime.ts` y de `src/views/landings/birria.ts` (sin cambiar su contenido) | 2 reinicios (3 `server_started`) y 200 después. stderr vacío. |
| F-7 | `admin:hash-password` en `main` y en la rama; validación cruzada de los hashes | Mismo formato `scrypt$32768$8$1$<16 B>$<32 B>`. Cada hash se valida en las dos versiones: contraseña correcta `true`, incorrecta `false`. |
| N-1/N-2 | `env -i` sin variables y con 14 configuraciones inválidas (PORT, zona horaria, número y URL de WhatsApp, admin incompleto, hash inválido, NODE_ENV, producción sin `DATA_DIR` o con ruta relativa, `DATA_DIR` en `src/` y en `public/`, TRUST_PROXY y SITE_URL con credenciales) en `main` y en la rama | Salida 1 en las 15 y en las dos versiones. stdout y stderr **idénticos**. 0 valores expuestos (marcador `SECRETO-QA`). |
| R-1 | `createApp` de `main` (`.js`) y de la rama (`.ts`) con la misma fecha fija y un repositorio en memoria. Script `flow.mjs`: 96 peticiones (rutas, assets, iconos, manifests, 404, path traversal, 405, HEAD y todo el flujo de admin). 23 escenarios: viernes 23:59 / sábado 00:00, domingo 23:59 / lunes 00:00 y un miércoles; `TZ` del proceso UTC, Asia/Tokyo y America/Mexico_City; `BUSINESS_TIMEZONE` UTC; `SITE_URL` con `WHATSAPP_*_URL`; sin admin; disponibilidad (N-5) | **23 de 23 IDÉNTICOS** byte a byte (código, cabeceras salvo `date`/`last-modified`/`etag`, y cuerpo). Solo se normalizan los tokens de CSRF y de sesión. `/` sirve la landing correcta en todos los cortes de día. |
| R-2/R-3 | Los dos servidores reales (`node src/server.{js,ts}`) a la vez, con el mismo env y `DATA_DIR` temporales; el mismo `flow.mjs` | 96 de 96 peticiones equivalentes. Solo difieren, como se espera, la ruta y la línea del `stack` en desarrollo y las horas reales; normalizadas, quedan 0 diferencias. Los JSON finales de `DATA_DIR` (`current`, `previous` y `changes.jsonl`) son iguales, normalizando las fechas. |
| N-3 | Incluido en R-1 y R-2 | Mismos 404/405/413/415/401/403/409/422/429, con el mismo cuerpo JSON y la misma CSP. Cookie `admin_sid` con `path=/admin; samesite=strict; httponly` en las dos. |
| N-4 | Datos dañados: JSON inválido (Molotes) y esquema inválido (Birria) al arrancar; marcador pendiente tras reiniciar; daño con el servidor en marcha | Respuestas idénticas (86 de 86 y 6 de 6). Logs `menu_data_damaged` (`servingFrom` previous/memory) y `menu_data_damaged_pending` idénticos en las dos versiones. |
| R-4 | `cmp` de `public/css/{molotes,birria,admin}/main.css` entre `main` y la rama | Idénticos. |
| R-5 | Revisión del diff de comportamiento de `src/` (A-3b) y de su alcance (CodeGraph) | Revisé cada cambio: `errorProp` equivale a `err?.[key]`; `childOf` equivale a `?.[k]`; `isBusinessId`; `typeof` antes de `Number.isInteger`; `String()` en `legend` (solo con datos ya validados); `active === undefined`; `'priceUnit' in item`; la eliminación del estado provisional antes de `markDamaged` (equivalente: `markDamaged` lo asigna antes de leerlo); `servingFrom` del log pendiente (la misma expresión); las condiciones extra de `loadConfig`, inalcanzables. Los campos de clase (`issues`, `current`) solo cambian el orden de claves propias, y el logger nunca serializa esos errores (`serializeError` elige campos). Todo queda cubierto por R-1, R-2 y N-4. Con Node se cargan los 41 módulos de `src/` y `server.ts`. |
| D-1 | `docker compose run --rm test` (arm64) | Salida 0: 25 archivos y 468 pruebas. `RUN npm run typecheck` aparece en la etapa `build`. |
| D-2 | `DOCKER_DEFAULT_PLATFORM=linux/amd64 docker compose run --rm test` | Salida 0: 25 archivos y 468 pruebas. Imagen `amd64`. |
| D-3 | Error de tipo temporal y `docker build --target production` y `--target test` | Las dos fallan en `RUN npm run typecheck` (TS2322) con salida 1. Revertido. |
| D-4 | Comandos de producción del README, copiados tal cual | `healthy` a los 6 s; 200 en `/`, `/molotes`, `/birria` y el CSS; `/admin` 503 (admin sin configurar, documentado); `docker stop` con `ExitCode=0`; UID 1000; Node v24.21.0; `CMD ["node","src/server.ts"]`. Sin `typescript`, `@types`, `tsc`, `tsconfig.json`, `.env`, `data/`, `tests/`, `scripts/` ni `.js` en `src/`. Sin secretos en el historial de la imagen. Sin variables, salida 1 con stderr idéntico al de la imagen previa de `main`. |
| L-1 | stdout de `node src/server.ts` (142 líneas) y de `npm start` | Todas las líneas son JSON (en `npm start`, salvo las 2 de cabecera de npm). Los eventos y las claves coinciden con `main` (0 diferencias sin contar `time`/`durationMs`/`port`). stderr vacío. `npm run dev`: las únicas líneas que no son JSON son las de `node --watch`, aceptadas en R-8. |
| L-2 | `docker logs` de `production` | 11 de 11 líneas de stdout son JSON; stderr vacío (sin `ExperimentalWarning`). |
| G-1 a G-6 | Revisión de CLAUDE.md, `typescript.md`, `javascript.md`, `senior-fullstack.md` y el README frente a R-9 y R-10, y de los árboles frente a `find` | Cumplen. Ver DEF-001 y las observaciones. |
| G-7 | Comandos del README copiados tal cual: `npm start` (con el `.env` real y `PORT`/`DATA_DIR` temporales, para no tocar `data/`), `npm run dev`, `npm test`, `npm run typecheck`, `admin:hash-password`, `build:css`, `docker compose run --rm test` (en las dos arquitecturas) y el bloque de producción | Todos terminan como describe el README. `npm start`: 200 en las 10 rutas y `/admin/molotes` responde 303 al login. Es sábado en America/Mexico_City y `/` sirve Birria. |
| B-1 | Claude in Chrome | **Bloqueado por el entorno**: la extensión no está conectada (3 intentos). Queda pendiente de revisión manual (ver abajo). |
| Perf. | Arranque hasta `server_started` (5 ejecuciones × 2); RSS y tamaño de la imagen | `main` 105–108 ms y rama 142–148 ms de mediana (unos 40 ms del type stripping; no significativo). RSS del contenedor: 44 MiB. Imagen: 171,74 MB frente a 171,70 MB de la imagen previa de `main`. |

### Criterios de aceptación

| CA | Resultado | Evidencia |
| --- | --- | --- |
| CA-1 | PASS | F-1 |
| CA-2 | PASS | F-2, A-1 (`typecheck` con 0 en 1,2 s) |
| CA-3 | PASS | F-3 |
| CA-4 | PASS | F-4 |
| CA-5 | PASS | A-1 a A-4 y A-3b |
| CA-6 | PASS | R-1, R-2, R-3, R-4, N-3 y G-7 |
| CA-7 | PASS | N-1/N-2 y D-4 |
| CA-8 | PASS | F-6 |
| CA-9 | PASS | F-7 y R-2/R-3 (login con el hash generado por la rama) |
| CA-10 | PASS | D-1, D-2 y D-3 |
| CA-11 | PASS | D-4 |
| CA-12 | PASS | L-1 y L-2. R-8: no hay `ExperimentalWarning` con Node 24.21.0; las líneas de `--watch` están aceptadas. |
| CA-13 | PASS | F-5 |
| CA-14 | PASS | G-1 a G-5. El árbol incluye todo lo que exige R-9. DEF-001 (TRIVIAL) omite una carpeta de marcador. |
| CA-15 | PASS | G-6 y G-7 |

### Defectos encontrados

#### DEF-001
- Severidad: TRIVIAL
- Criterio de aceptación afectado: CA-14 (completitud del árbol; no rompe ningún punto explícito de R-9).
- Descripción: el árbol de `.claude/agents/senior-fullstack.md` lista `styles/` como "shared/, molotes/, birria/, admin/" y omite `src/styles/components/`, una carpeta versionada (`.gitkeep`) que el README sí documenta ("sin uso por ahora"). En `main` también faltaba.
- Pasos para reproducir: `git ls-files restaurante/src/styles/components` y `grep -n "styles/" .claude/agents/senior-fullstack.md`.
- Resultado esperado: el árbol del agente coincide con las carpetas reales.
- Resultado actual: falta `components/`.
- Evidencia: la salida de los dos comandos anteriores (`src/styles/components/.gitkeep`; línea 90 del agente).
- Impacto: mínimo. Es una carpeta vacía sin uso, aunque un agente podría no saber que existe.
- Recomendación: añadir `components/` a esa línea del árbol cuando se haga el commit, o en otro cambio.

### Observaciones (no son defectos de este ticket)

- **O-1. Los imports relativos con `.js` hacia un `.ts` pasan `typecheck` y `npm test`, pero fallan en ejecución.**
  - Evidencia: un módulo temporal con `import … from "./config/businesses.js"` da `tsc` con 0 (NodeNext lo resuelve) y Vitest en verde (Vite lo resuelve), pero `node` da `ERR_MODULE_NOT_FOUND`.
  - Hoy no hay ningún import así en `src/`, `tests/` ni `scripts/`, y Node carga los 41 módulos de `src/`. Ningún CA lo exige.
  - Riesgo futuro: una imagen `production` que se construye, pero no arranca.
  - Recomendación: cubrirlo en REQ-F-005 (regla de ESLint para extensiones de import) o con una prueba que arranque `node src/server.ts`.
- **O-2. Prueba intermitente que ya existía en `main`.**
  - `tests/integration/admin.test` CA-33 ("Guardar mis cambios de todos modos…") falló 1 de 7 veces en `main` ("No se encontró el formulario #admin-form"). En la rama pasó 8 de 8.
  - No es una regresión. Conviene investigarla aparte.
- **O-3. Referencias desactualizadas que ya existían**, declaradas fuera de alcance en el Implementation Result:
  - "Testing" de `senior-fullstack.md` menciona `vi.setSystemTime`, y ninguna prueba lo usa;
  - un comentario de `scripts/generate-icons.py` menciona `index.js`.
- **O-4. Aviso de Docker Compose ajeno a este ticket.** `docker compose run --rm test` muestra `variable is not set` porque el `ADMIN_PASSWORD_HASH` del `.env` local no está entre comillas. Es el caso que ya documenta el README (REQ-F-003). Los avisos incluyen un fragmento del hash; se recomienda entrecomillar el valor del `.env`.
- **O-5. Formato de `paths` en las reglas.** `typescript.md` usa `paths` con el prefijo `/restaurante/…`, mientras que `assets.md` usa `/public/…`, y el bloque va después del título, como en las demás reglas. Es coherente con el estilo existente; conviene unificarlo cuando se revise el formato de las reglas.

### Regresión

Sin regresión. La suite es idéntica prueba a prueba y pasa en local y en Docker (arm64 y amd64). El HTTP, el HTML, las cabeceras, la CSP, las cookies, la administración, `DATA_DIR`, los datos dañados, la validación de configuración, los logs y el CSS son idénticos a los de `main` en todos los escenarios probados.

### Responsive, accesibilidad, UX/UI y SEO

Sin cambios, por identidad: el HTML y el CSS servidos son idénticos byte a byte a los de `main` (R-1, R-2 y R-4) y `public/` no cambia. Las pruebas de DOM (`landing-dom`, `variant-selector` y `promo-form`) pasan con el HTML real. El enlace de WhatsApp (`wa.me/<número>?text=` codificado, o `*_URL`) y el SEO (`title`, `canonical` con `SITE_URL`) son idénticos en los escenarios de R-1. La verificación visual queda pendiente (B-1).

### Performance

Sin regresión relevante: unos 40 ms más de arranque por el type stripping, la misma memoria y +40 KB en la imagen.

### Pendientes de revisión manual

- **B-1:** revisión visual en el navegador de `/molotes`, `/birria`, `/` y `/admin` a 375×812, 768×1024 y 1440×900, con la consola sin errores. Queda pendiente porque la extensión de Chrome no está conectada. Ningún CA depende solo de esta prueba: CA-6 se demostró con la comparación byte a byte del HTML y el CSS.

### Estado del repositorio tras QA

`git status` es idéntico al del inicio, y el hash del contenido del árbol (diff con `main` más los archivos sin versionar, sin contar `.claude/docs`) es el mismo. Todos los archivos temporales se borraron: `zz-qa-*` y un `DATA_DIR` que el servidor de `main` creó por error en `src/SECRETO-QA` durante N-2, eliminado al momento. Tampoco quedan servidores ni contenedores en marcha. El `data/` real no se tocó (mismos archivos y fechas). Las etiquetas `restaurante:test` y `restaurante:prod` vuelven a sus imágenes previas y se eliminaron las imágenes y el volumen `restaurante-data` creados en QA. No hice commits.

### Resultado final

QA_APPROVED

## Historial de cambios

### Versión 1

Descripción inicial. Incorpora las decisiones del usuario ("acepto las recomendadas con 6B"). Aprobada por el usuario el 2026-10-03 (cita: "apruebo").

### Versión 1 — revisión técnica (senior-fullstack)

2026-10-03: revisión técnica completada. Hay spikes en el scratchpad para Prisma 7 con type stripping, `ExperimentalWarning` por versión de Node, migración mecánica con la suite en verde, CSS generado y TS 6/7 en Alpine arm64/amd64. Se agrega el Technical Action Plan con las decisiones TQ-1 a TQ-4. Estado: NEEDS_TECHNICAL_PLAN_APPROVAL.

### Versión 1 — implementación (senior-fullstack)

2026-10-03: el usuario aprueba el plan ("apruebo el plan", con TQ-1 a TQ-4). Se crea la rama `feature/REQ-F-004-migracion-backend-typescript`, el ticket pasa a `in-progress/` (IN_PROGRESS) y se implementa la migración. CA-1 a CA-15 verificados (Docker incluido). Estado: NEEDS_IMPLEMENTATION_APPROVAL.

### Versión 1 — QA, fase Q1 (senior-qa)

2026-10-03: el usuario aprueba la implementación ("apruebo la implementación"). Se analiza el requisito (CA-1 a CA-15) y el diff con `main` (código, pruebas, Docker, README y gobierno), y se agrega el QA Action Plan: comparación diferencial con una copia de `main`, anti-debilitamiento de pruebas, administración extremo a extremo, Docker arm64/amd64, logs, gobierno y navegador. No se ejecutó la batería definitiva. Estado: NEEDS_QA_PLAN_APPROVAL.

### Versión 1 — QA, fase Q2 (senior-qa)

2026-10-03: el usuario aprueba el QA Action Plan ("apruebo el plan de QA"); se retoma tras una interrupción ("Continua"). Se ejecutan A, F, N, R, D, L y G con comparación diferencial contra `main`. CA-1 a CA-15 en PASS, DEF-001 TRIVIAL, observaciones O-1 a O-5 y B-1 pendiente de revisión manual (extensión de Chrome no disponible). Estado: QA_APPROVED.

### Versión 1 — commit y Pull Request (senior-fullstack)

2026-10-03: con QA_APPROVED (ronda 1) se corrige DEF-001 (se añade `components/` al árbol de `senior-fullstack.md`) y se homogeneiza el formato de `paths` en `.claude/rules/typescript.md` (O-5). Se hace el commit, el push de la rama y se crea el Pull Request contra `main`. Estado: READY_FOR_MERGE.
