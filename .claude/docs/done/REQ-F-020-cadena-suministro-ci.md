# REQ-F-020 — Cadena de suministro en el CI (`npm audit`, Dependabot)

## Estado

DONE

Pull Request: https://github.com/orvigas/negocio/pull/50 (commit a6b1dae, rebasado sobre `main` ea716f9). CI del PR en verde: `calidad`, `docker`, `despliegue` y `auditoria` pasan (`publish` y `deploy` se omiten en un PR; ejecución https://github.com/orvigas/negocio/actions/runs/38612343485). El log del job `auditoria` muestra "Auditoría de dependencias: sin bloqueos".

## Aprobación

Aprobado por el usuario (versión 1, fecha 2026-10-14), con la respuesta "Aprobar", incluidas las tres propuestas: fail closed, agrupar Prisma y el adaptador, y excluir las versiones mayores de la actualización rutinaria.

## Objetivo

Que el CI detecte vulnerabilidades conocidas en lo que llega a cada imagen desplegada y que las actualizaciones de dependencias lleguen como PR revisados. Resuelve el hallazgo F-11 (`.claude/docs/reports/OWASP-2026-10-09-auditoria.md`) y los 6 avisos actuales de `npm audit`.

## Alcance

- Auditoría de dependencias en el CI, separada por imagen.
- Lista versionada de excepciones con caducidad.
- Dependabot para npm (`restaurante/`) y GitHub Actions.
- Análisis de explotabilidad y corrección de los 6 avisos actuales.
- Documentación de la política.

## Fuera de alcance

- Subir Prisma de versión mayor.
- Sustituir `koa-static`.
- Fijar la imagen base por digest y la protección de rama (F-14).
- Merge automático de cualquier PR.

## Hechos de partida (2026-10-14)

- El CI (`.github/workflows/ci.yml`) y el `Dockerfile` instalan con `--no-audit`. No existe configuración de Dependabot.
- `npm audit --omit=dev` en `restaurante/` da 5 avisos altos y 1 moderado:
  - `@prisma/adapter-mariadb` <=8.1.0-dev.4: moderado, sin arreglo;
  - `@prisma/config`: alto;
  - `deepmerge-ts` <8: alto;
  - `mariadb` 3.3.0-3.5.3: alto, sin arreglo directo;
  - `mysql2` <=3.23.0: alto;
  - `prisma` 6.13-8.1.0-dev.6: alto.
- El arreglo que propone npm es bajar a `prisma@6.19.3`, una versión mayor anterior.
- La imagen production instala con `--omit=dev --omit=optional` y solo lleva `@prisma/adapter-mariadb` y `mariadb`.
- La imagen migrate instala con `--omit=dev` y lleva además `prisma`, `@prisma/config`, `deepmerge-ts` y `mysql2`, marcados como `devOptional` en el lockfile porque son dependencias par opcionales de `@prisma/client`.
- F-11 está desactualizado en dos puntos. La app ya no usa SQLite en producción (REQ-F-014) y ya no se despliega en una VM con dependencias de desarrollo (REQ-F-016).

## Requisitos

- **RF-1 (corte production):** el CI audita el conjunto que instala la imagen production (`--omit=dev --omit=optional`). Falla con cualquier aviso `high` o `critical` que no tenga una excepción vigente.
- **RF-2 (corte migrate):** igual que RF-1, sobre el conjunto de la imagen migrate (`--omit=dev`).
- **RF-3 (informativos):** los avisos de las dependencias de desarrollo, y los `moderate` o `low` de cualquier corte, aparecen en el resumen del CI pero no lo rompen.
- **RF-4 (excepciones):** cada excepción incluye el ID del aviso (GHSA), el paquete, la justificación, quién la aprobó y la fecha de revisión.
  - La fecha de revisión no puede superar los 30 días desde la aprobación.
  - Una excepción vencida, con un plazo de más de 30 días o con algún campo obligatorio vacío rompe el CI.
  - Una excepción que ya no corresponde a ningún aviso presente se informa para retirarla.
- **RF-5 (prohibiciones):** ni el CI ni el proceso usan `npm audit fix --force`, y ninguna dependencia baja de versión mayor.
- **RF-6 (`overrides`):** se permite forzar versiones de `mariadb` y de otras dependencias transitivas con `overrides`, solo si pasa la suite completa:
  - typecheck;
  - lint;
  - pruebas contra MySQL 8.4;
  - jobs `docker` y `despliegue`.

  Cada override lleva su motivo documentado.
- **RF-7 (Dependabot):** cubre npm en `restaurante/` y GitHub Actions.
  - Abre PR de seguridad.
  - Hace una actualización rutinaria semanal agrupada.
  - Las acciones siguen fijadas por SHA completo, con la versión en el comentario.
  - Los paquetes de Prisma (`prisma`, `@prisma/client`, `@prisma/adapter-mariadb`) y `mariadb` se actualizan juntos en el mismo PR.
  - La actualización rutinaria excluye las versiones mayores. Las actualizaciones de seguridad no se excluyen.
  - Ningún PR se mergea automáticamente: cada merge a `main` despliega en producción.
- **RF-8 (avisos actuales):** se documenta el análisis de explotabilidad de los 6 avisos por imagen y una decisión para cada uno: corregir, `overrides` o excepción.
- **RF-9 (fail closed):** si el registro de npm no responde o la auditoría no puede completarse, el paso falla. Se puede reintentar relanzando el job.
- **RF-10 (documentación):** la sección CI del `README.md` de `restaurante/` explica la política y cómo añadir o renovar una excepción.

## Historias de usuario

**Como** responsable del negocio, **quiero** que el CI bloquee las vulnerabilidades graves no aceptadas y me proponga actualizaciones, **para** no desplegar dependencias con riesgo conocido sin una decisión explícita.

## Reglas de negocio

- Umbral que rompe el CI: `high` y `critical`, en los cortes production y migrate.
- Plazo máximo de una excepción: 30 días.
- Sin merge automático.
- Sin `npm audit fix --force` ni bajadas de versión mayor.

## Criterios de aceptación

- **CA-1:** un aviso `high` o `critical` sin excepción en el corte production deja en rojo el job de auditoría, y no hay publicación ni despliegue.
- **CA-2:** lo mismo que CA-1 en el corte migrate.
- **CA-3:** un aviso `high` que solo afecta a dependencias de desarrollo aparece en el resumen y el CI queda en verde.
- **CA-4:** un aviso `moderate` en production aparece en el resumen y no rompe el CI.
- **CA-5:** con una excepción vigente, el CI queda en verde. Con la fecha vencida, o con un plazo de más de 30 días, queda en rojo y el mensaje indica el GHSA afectado.
- **CA-6:** si falta algún campo obligatorio en una excepción, el CI queda en rojo.
- **CA-7:** existe la configuración de Dependabot para npm (`restaurante/`) y Actions, con:
  - la actualización rutinaria semanal agrupada;
  - Prisma y `mariadb` agrupados;
  - las versiones mayores excluidas de la actualización rutinaria;
  - sin merge automático.
- **CA-8:** los 6 avisos actuales tienen su análisis y su decisión documentados. Con `main` en el estado resultante, el CI completo pasa.
- **CA-9:** ningún paquete queda en una versión mayor inferior a la actual. `prisma`, `@prisma/client` y `@prisma/adapter-mariadb` siguen en 7.x.
- **CA-10:** si la auditoría no puede consultar el registro, el paso falla.

## Casos límite

- El registro de npm no responde: fail closed (RF-9).
- Se publica un aviso nuevo sin que cambie el código: el siguiente PR o push a `main` queda en rojo hasta corregirlo o crear una excepción.
- Un `overrides` de `mariadb` rompe el adaptador: lo detectan las pruebas contra MySQL y la prueba de humo del despliegue, y se vuelve a la vía de la excepción.
- Dependabot propone una versión mayor de Prisma: queda excluida de la actualización rutinaria y se revisa a mano.

## Dependencias

- El CI y las imágenes de REQ-F-014 y REQ-F-016.
- Dependabot habilitado en la configuración del repositorio de GitHub.

## Riesgos

- Un `overrides` deja una combinación que Prisma no ha probado.
- Usar demasiadas excepciones vacía el control.
- La actualización semanal genera PR que hay que revisar a mano.

## Action Plan

1. Analizar la explotabilidad de los 6 avisos por imagen y decidir para cada uno (RF-8).
2. Aplicar las correcciones o los `overrides` y validarlos con la suite completa (RF-6).
3. Registrar las excepciones necesarias, a 30 días como máximo (RF-4).
4. Añadir al CI la auditoría por corte, con el umbral, el resumen, la validación de excepciones y fail closed (RF-1 a RF-5 y RF-9).
5. Configurar Dependabot (RF-7).
6. Documentar la política (RF-10).

**Resultado esperado:** CI en verde con los 6 avisos resueltos o aceptados con fecha de revisión, y PR de Dependabot que llegan para revisión manual.

## Technical Action Plan

### Objetivo técnico

Un job `auditoria` en el CI que audita por separado los cortes production, migrate y desarrollo con `npm audit` y una política propia en TypeScript (umbral, excepciones con caducidad, fail closed). Los 6 avisos actuales quedan corregidos con `overrides` de parche o menor, sin excepciones y sin bajar ninguna versión mayor. Dependabot se configura para npm y Actions.

### Verificaciones hechas en la revisión (2026-10-14, npm 11.19.0)

- `npm audit --omit=dev --omit=optional` solo informa `@prisma/adapter-mariadb` y `mariadb`: npm 11 respeta `--omit=optional` en la auditoría y el resultado coincide con el corte production. `npm audit --omit=dev` incluye los `devOptional` (`prisma`, `@prisma/config`, `deepmerge-ts`, `mysql2`), igual que la imagen migrate. Los dos cortes salen del mismo `package-lock.json` que usa `npm ci` en el `Dockerfile`, así que auditan el árbol exacto de cada imagen.
- El árbol completo tiene además 4 avisos `high` solo de desarrollo (`braces` y `micromatch` por `@parcel/watcher` de `@tailwindcss/cli`): según RF-3 solo informan. Sirven de caso real para CA-3.
- Simulación en una copia: con los `overrides` propuestos, el corte migrate queda con 2 avisos `moderate` y ninguno `high`, y el corte production igual. Ningún paquete nuevo tiene script de instalación, así que `allowScripts` no cambia.

### Análisis de los 6 avisos y decisión (RF-8)

| Paquete (versión) | Corte | Avisos | Arreglo | ¿Se explota en esta app? | Decisión |
| --- | --- | --- | --- | --- | --- |
| `mariadb` 3.4.5 | production y migrate | high: GHSA-cqhc-2h57-wpxf (contraseña en claro ante MitM con `ssl: true`), GHSA-r3rv-jm3r-62q2 (inyección SQL con `NO_BACKSLASH_ESCAPES`), GHSA-v6pj-gxxw-phfw (`permitSetMultiParamEntries`), GHSA-48qf-xh34-q73r (parámetros GeoJSON). moderate: GHSA-42r5-vhpq-m858, GHSA-g5xc-5w98-jfvm, GHSA-cx2f-j9fh-8g68 | 3.4.7 (todos menos GHSA-cx2f, que exige 3.5.4) | Poco: sin TLS (red interna de Docker), sin `NO_BACKSLASH_ESCAPES` (`verify.ts` comprueba el modo estricto), sin `permitSetMultiParamEntries` ni columnas geométricas. GHSA-cx2f exige autenticación ed25519, propia de MariaDB, que MySQL 8.4 no usa | Corregir con un parche: dependencia directa `mariadb` 3.4.7 y `overrides` `"mariadb": "$mariadb"`, porque el adaptador 7.10.0 (la última estable) fija `mariadb` 3.4.5 exacto. 3.4.7 tiene las mismas dependencias y el mismo `engines` que 3.4.5. GHSA-cx2f (moderate) queda informativo |
| `@prisma/adapter-mariadb` 7.10.0 | production y migrate | moderate, solo heredado de `mariadb` | Lo resuelve el override (queda el moderate de GHSA-cx2f) | Igual que `mariadb` | Sin acción propia: informativo |
| `mysql2` 3.15.3 | migrate | high: GHSA-3f6p-5ww8-9rcr (bajada a `mysql_clear_password`). moderate: GHSA-rgwj-5xj2-c3m3 (bomba zlib) | 3.24.6 (misma versión mayor) | No: el CLI de Prisma solo lo carga con `import()` para Prisma Studio. `migrate deploy` no lo usa | Corregir con `overrides` `"prisma": { "mysql2": "3.24.6" }` |
| `deepmerge-ts` 7.1.5 | migrate | high: GHSA-ggr8-5vv4-36mx (desbordamiento de pila con grafos recursivos) | 8.0.0 o posterior (la 7.x no se corrige) | No: `@prisma/config` solo lo usa para fusionar nuestro `prisma.config.ts`, un archivo versionado y sin entrada externa | Corregir con `overrides` `"@prisma/config": { "deepmerge-ts": "8.0.2" }`. Es una subida mayor de una dependencia transitiva (RF-5 solo prohíbe bajar). Comprobado: la 8.0.2 exporta `deepmerge` con la misma API. La validan `migrate deploy` en los jobs `calidad`, `docker` y `despliegue`. Si falla, la alternativa es una excepción de 30 días |
| `@prisma/config` 7.10.0 | migrate | high, solo heredado de `deepmerge-ts` | Lo resuelve el override | No | Sin acción propia |
| `prisma` 7.10.0 | migrate | high, solo heredado de `@prisma/config` y `mysql2` | Lo resuelven los overrides | No | Sin acción propia. `prisma`, `@prisma/client` y el adaptador siguen en 7.10.0 (CA-9) |

Resultado esperado: ningún aviso `high` o `critical` en production ni en migrate, y el archivo de excepciones vacío. Los `overrides` se acotan al paquete que los necesita y cada uno lleva su motivo en la documentación (RF-6), porque `package.json` no admite comentarios.

### Archivos o componentes afectados

- `restaurante/package.json` y `restaurante/package-lock.json`: `mariadb` 3.4.7, `overrides` y el script `audit:deps`.
- `restaurante/scripts/audit-deps.ts` (nuevo): punto de entrada.
- `restaurante/scripts/support/audit-policy.ts` (nuevo): lógica pura.
- `restaurante/security/audit-exceptions.json` (nuevo): lista de excepciones.
- `restaurante/tests/unit/audit-policy.test.ts` (nuevo).
- `.github/workflows/ci.yml`: job `auditoria` y `publish.needs`.
- `.github/dependabot.yml` (nuevo).
- `restaurante/README.md`: sección CI.
- `.claude/agents/senior-fullstack.md`: comprobaciones de T4, solo si se aprueba la decisión D-1.

### Backend / script de auditoría

`scripts/audit-deps.ts` solo usa módulos nativos de Node, así que corre sin `npm ci`:

1. Lee y valida `security/audit-exceptions.json`. Si es inválido, falla.
2. Ejecuta tres veces `npm audit --json`, con `execFile` (sin shell): production (`--omit=dev --omit=optional`), migrate (`--omit=dev`) y desarrollo (sin omitir nada). Usa `--fetch-retries` y `--fetch-timeout` acotados.
3. Para cada salida, el código de salida de npm no decide nada. La salida debe ser un JSON con `vulnerabilities` y `metadata.vulnerabilities`. Si no lo es, si trae `error` o si la ejecución falla o vence el tiempo, el corte se da por fallido (fail closed, RF-9 y CA-10).
4. Extrae los avisos de cada paquete: las entradas de `via` que son objetos, con el GHSA tomado de `url`, su severidad y su rango. Las entradas heredadas (`via` de tipo cadena) no cuentan dos veces.
5. Aplica la política:
   - un `high` o `critical` en production o migrate sin excepción vigente para ese GHSA y ese paquete rompe el CI;
   - `moderate` y `low` de cualquier corte, y todo lo del corte de desarrollo, solo informan;
   - una excepción vencida, con más de 30 días de plazo o con un campo vacío rompe el CI aunque su aviso ya no exista, y el mensaje nombra el GHSA;
   - una excepción sin aviso presente se informa para retirarla.
6. Escribe un resumen en Markdown con una tabla por corte, las excepciones aplicadas y las que hay que retirar. Lo escribe en `$GITHUB_STEP_SUMMARY` si existe y siempre en stdout. Termina con 0 o 1.

`scripts/support/audit-policy.ts` (sin E/S, recibe `today`) contiene:

- `parseExceptions(unknown)`;
- `parseAuditReport(unknown)`;
- `evaluate({ cuts, exceptions, today })` → `{ failures, informative, appliedExceptions, staleExceptions }`;
- `renderSummary(...)`.

Las entradas son `unknown` y se validan antes de usarlas (`.claude/rules/typescript.md`).

`npm run audit:deps` ejecuta `node scripts/audit-deps.ts`, también en local. Nunca usa `npm audit fix`.

### Contenido / configuración

Formato de `security/audit-exceptions.json`:

```json
{
  "exceptions": [
    {
      "ghsa": "GHSA-xxxx-xxxx-xxxx",
      "package": "deepmerge-ts",
      "justification": "Por qué no se explota y qué lo corregirá",
      "approvedBy": "Orlando Villegas",
      "approvedOn": "2026-10-15",
      "reviewBy": "2026-11-14"
    }
  ]
}
```

Reglas del formato:

- `ghsa` cumple `^GHSA(-[23456789cfghjmpqrvwx]{4}){3}$`.
- Las fechas son `AAAA-MM-DD` válidas y en UTC.
- `approvedOn` no puede ser posterior a hoy.
- `reviewBy` no puede ser anterior a hoy (el día `reviewBy` todavía vale) ni estar a más de 30 días de `approvedOn`.
- No se repite el par `ghsa` + `package`.
- No se admiten campos desconocidos.

El archivo empieza vacío (`"exceptions": []`).

### CI (`.github/workflows/ci.yml`)

Job nuevo `auditoria`, en paralelo con los demás:

- `ubuntu-24.04`, `timeout-minutes: 10`, permisos de solo lectura;
- `checkout` y `setup-node` (`.nvmrc`), sin `npm ci`;
- ejecuta `node scripts/audit-deps.ts` en `restaurante/`.

`publish.needs` pasa a `[calidad, docker, despliegue, auditoria]`, así que un rojo de auditoría impide publicar y desplegar (CA-1, CA-2). El `Dockerfile` mantiene `--no-audit`: la auditoría vive en el CI, no en el build.

Se mantiene la fijación por SHA de las acciones existentes y no se añade ninguna acción nueva.

### Dependabot (`.github/dependabot.yml`)

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /restaurante
    schedule: { interval: weekly, day: monday, time: "07:00", timezone: America/Mexico_City }
    open-pull-requests-limit: 5
    commit-message: { prefix: "chore(deps)" }
    ignore:
      - dependency-name: "*"
        update-types: ["version-update:semver-major"]
    groups:
      prisma:                     # primero: se lleva estos paquetes antes que el grupo general
        applies-to: version-updates
        patterns: ["prisma", "@prisma/*", "mariadb"]
      prisma-seguridad:
        applies-to: security-updates
        patterns: ["prisma", "@prisma/*", "mariadb"]
      semanal:
        applies-to: version-updates
        patterns: ["*"]
        update-types: ["minor", "patch"]
  - package-ecosystem: github-actions
    directory: /
    schedule: { interval: weekly, day: monday, time: "07:00", timezone: America/Mexico_City }
    commit-message: { prefix: "ci(deps)" }
    groups:
      acciones:
        patterns: ["*"]
```

- Dependabot conserva la fijación por SHA y actualiza el comentario `# vX.Y.Z`.
- Sin merge automático: no hay workflow de auto-merge ni `pull_request_target`.
- Los PR de Dependabot corren el CI normal, sin secretos (`deploy` solo corre en `main`).
- En T2 hay que confirmar en la documentación de GitHub que `ignore` con `update-types` no bloquea las actualizaciones de seguridad (RF-7). Si las bloqueara, se acota el `ignore` a `prisma` y `@prisma/*` y se documenta.

### Validaciones

- `node scripts/audit-deps.ts` en local con el lockfile final: production y migrate sin `high`.
- `npm ls mariadb mysql2 deepmerge-ts` confirma una sola copia de cada uno, en la versión prevista.

### Manejo de errores

Fallo explícito, con un mensaje que nombra el corte y la causa (registro inaccesible, salida inválida, excepción inválida con su GHSA). No se imprimen variables de entorno ni tokens; `npm audit` no los necesita.

### Testing

`tests/unit/audit-policy.test.ts` usa salidas de `npm audit` reducidas como fixtures y nunca toca la red. Cubre:

- CA-1 y CA-2: un `high` y un `critical` en production o en migrate rompen el CI.
- CA-3: un `high` solo de desarrollo informa.
- CA-4: un `moderate` en production informa.
- CA-5: una excepción vigente deja el CI en verde. Una vencida, otra a 31 días y otra con `approvedOn` futuro lo dejan en rojo con el GHSA en el mensaje. El límite exacto de 30 días y el día `reviewBy` son válidos.
- CA-6: cada campo vacío o ausente, un GHSA mal formado, un duplicado o un campo desconocido rompen el CI.
- CA-10: una salida con `error`, una que no es JSON, una vacía o sin `metadata` hacen fallar el paso.
- Avisos heredados (`via` de tipo cadena) no se cuentan dos veces.
- Las excepciones sin aviso presente se informan.

Las validaciones RF-6 de los overrides son typecheck, lint, `npm test` contra MySQL 8.4 y los jobs `docker` y `despliegue` en el PR (incluyen `migrate deploy` y la prueba de humo). CA-7 y CA-8 se comprueban revisando `dependabot.yml` y con el CI del PR en verde.

### Seguridad

- `execFile` sin shell y con argumentos fijos.
- El job sin `npm ci` no ejecuta código de dependencias.
- Sin permisos de escritura ni secretos.
- Ninguna excepción inicial.

### Riesgos técnicos

- `deepmerge-ts` 8 y `mysql2` 3.24 son combinaciones que Prisma 7.10 no ha probado. Lo mitigan `migrate deploy` en tres jobs y que `mysql2` solo lo usa Studio. Si fallan, la alternativa es una excepción de 30 días.
- Re-resolver el lockfile con npm 11.19 añade entradas anidadas opcionales de `@tailwindcss/oxide-wasm32-wasi` (vistas en la simulación). Se revisará el diff del lockfile para que solo cambie lo necesario.
- `allowScripts` fija `prisma@7.10.0` y `@prisma/engines@7.10.0`. Un PR de Dependabot que suba Prisma quedará en rojo en `npm ci --strict-allow-scripts` hasta que alguien actualice `allowScripts` en ese mismo PR, y es lo deseable: un script de instalación nuevo se revisa a mano. Se documenta.
- Un aviso nuevo deja en rojo todos los PR hasta corregirlo o crear una excepción. Es lo que pide el ticket.
- Hay que habilitar las alertas y las actualizaciones de seguridad de Dependabot en el repositorio (D-2).

### Orden de implementación

1. Overrides y `mariadb` 3.4.7.
2. `npm install` y revisión del diff del lockfile.
3. Suite local.
4. `audit-policy.ts` y sus pruebas.
5. `audit-deps.ts` y `npm run audit:deps`.
6. Job `auditoria` y `publish.needs`.
7. `dependabot.yml`.
8. README (política, cómo añadir o renovar una excepción, motivo de cada override, `allowScripts` en los PR de Prisma) y, si se aprueba D-1, el agente.
9. typecheck, lint, test y `npm run audit:deps`.

### Decisiones para el usuario

- **D-1 (recomendado: job separado):** la auditoría va en un job nuevo, `auditoria`. Será una comprobación obligatoria más, lo que obliga a añadirla a la lista de T4 de `.claude/agents/senior-fullstack.md` (pasos 8 y regla crítica 7) y a la sección "Comprobaciones obligatorias para el merge" del README. La alternativa es un paso al inicio de `calidad`: no toca el agente, pero el rojo queda mezclado con el de typecheck y las pruebas.
- **D-2 (recomendado: sí, en T2):** habilitar en el repositorio las alertas y las actualizaciones de seguridad de Dependabot con `gh api -X PUT repos/orvigas/negocio/vulnerability-alerts` y `.../automated-security-fixes`. La alternativa es que el usuario lo active a mano en Settings > Code security.
- **D-3 (recomendado: override 8.0.2):** para `deepmerge-ts`, override a 8.0.2, una subida mayor de una dependencia transitiva validada por la suite. La alternativa es una excepción de 30 días renovable mientras Prisma siga en 7.x.

### Criterios de finalización

- CA-1 a CA-10 cubiertos por pruebas o comprobados en el CI del PR.
- `npm run audit:deps` en verde con cero excepciones.
- typecheck, lint y test en verde.
- `prisma`, `@prisma/client` y el adaptador en 7.10.0.
- README actualizado.


## Implementation Result

### Rama

`feature/REQ-F-020-cadena-suministro-ci`, creada desde `main` actualizado (beed9ee). Sin commits.

### Cambios realizados

- **Avisos actuales (RF-8, D-3).** `mariadb` sube a 3.4.7 como dependencia directa y se añaden tres `overrides` en `package.json`:
  - `"mariadb": "$mariadb"`;
  - `"prisma": {"mysql2": "3.24.6"}`;
  - `"@prisma/config": {"deepmerge-ts": "8.0.2"}`.

  En el lockfile solo cambian esas tres versiones y sus subdependencias: `mysql2` sustituye `seq-queue` y `sqlstring` por `sql-escaper`, y `once`, `semver` y `wrappy` pasan de `devOptional` a `dev`. No aparecen entradas de Tailwind ni paquetes nuevos con script de instalación, así que `allowScripts` no cambia. `prisma`, `@prisma/client` y `@prisma/adapter-mariadb` siguen en 7.10.0.
- **Auditoría.**
  - `scripts/support/audit-policy.ts` contiene la política pura: cortes y `--omit`, umbral, validación de excepciones, fail closed y resumen.
  - `scripts/audit-deps.ts` ejecuta `npm audit --json` con `execFile`, sin shell, en los tres cortes. Escribe el resumen en la consola y en `$GITHUB_STEP_SUMMARY` y termina con 1 si algo bloquea.
  - Script nuevo `npm run audit:deps`.
  - `security/audit-exceptions.json` empieza vacío.
- **CI.**
  - Job nuevo `auditoria`: `checkout` y `setup-node` fijados por SHA, sin `npm ci`, con un límite de 10 minutos.
  - `publish.needs` pasa a `[calidad, docker, despliegue, auditoria]`.
  - Se actualizó el comentario de cabecera.
  - El job `despliegue` no se tocó.
- **Dependabot (RF-7).** `.github/dependabot.yml` configura npm (`/restaurante`) y GitHub Actions cada lunes. Tiene el grupo `prisma` (versiones) y el grupo `prisma-seguridad` (seguridad) para `prisma`, `@prisma/*` y `mariadb`, y el grupo general `semanal` con versiones menores y de parche. No hay merge automático.
  - **Cambio respecto al plan:** las versiones mayores se excluyen con `allow` + `update-types`, no con `ignore`. Según la documentación de GitHub (`dependabot-options-reference`, sección `ignore`), `ignore` también afecta a las actualizaciones de seguridad. En cambio, `update-types` en `allow` "only affects version updates, not security updates. Security updates will always be created regardless" (`controlling-dependencies-updated`). Así se cumple RF-7 sin bloquear los PR de seguridad.
- **D-2.** Activadas con `gh api -X PUT` las alertas (`vulnerability-alerts`, 204) y las actualizaciones de seguridad (`automated-security-fixes`, 204; la consulta posterior devuelve `{"enabled":true,"paused":false}`).
- **D-1.**
  - `.claude/agents/senior-fullstack.md`: el paso 8 de T4 y la regla crítica 7 incluyen `auditoria`.
  - `README.md`, sección CI: cuándo se ejecuta, la tabla de comprobaciones, cómo reproducirlo en local, la sección nueva "Auditoría de dependencias" (política, formato, cómo añadir y renovar una excepción, motivo de cada override), la sección nueva "Dependabot" (incluido `allowScripts` en los PR de Prisma) y "Comprobaciones obligatorias para el merge". También la tabla de scripts y el árbol del proyecto.

### Criterios de aceptación

- **CA-1 / CA-2:** cumplidos. Lo cubren las pruebas. Además, con el lockfile de `main`, el script falla con los avisos `high` de `mariadb` en production y en migrate y con los de `deepmerge-ts` y `mysql2` en migrate. `publish` depende de `auditoria`.
- **CA-3:** cumplido. Lo cubren las pruebas, y en el árbol real GHSA-vfj7-8cjw-p6xm (`braces`, `high`, solo de desarrollo) aparece como informativo.
- **CA-4:** cumplido. Lo cubren las pruebas, y en el árbol real GHSA-cx2f-j9fh-8g68 (`moderate`) informa en production y migrate.
- **CA-5 / CA-6:** cumplidos. Lo cubren las pruebas: vigente, vencida, más de 30 días, aprobación futura, campos vacíos o ausentes, formato y duplicados.
- **CA-7:** cumplido en la configuración. Pendiente de ver los primeros PR de Dependabot tras el merge.
- **CA-8:** análisis y decisiones en el plan y en el README. Local en verde; el CI del PR se comprobará en T4.
- **CA-9:** cumplido. Ninguna dependencia baja de versión mayor y Prisma sigue en 7.10.0.
- **CA-10:** cumplido. Lo cubren las pruebas, y con un registro inaccesible (`npm_config_registry=http://127.0.0.1:9/`) el script falla en los tres cortes.

### Validaciones ejecutadas

- `npm run typecheck`: 0.
- `npm run lint`: 0, sin avisos.
- `npm test` (MySQL 8.4 local): 80 archivos, 1631 pruebas en verde y 1 fallo esperado (`it.fails` de `local-server.test.ts`, que ya existía). `tests/unit/audit-policy.test.ts` aporta 45 de esas pruebas.
- `npm run audit:deps`: "sin bloqueos", con código 0.
  - production y migrate: solo GHSA-cx2f-j9fh-8g68 (`moderate`, `mariadb`).
  - desarrollo: GHSA-vfj7-8cjw-p6xm (`high`, `braces`) y GHSA-cx2f (`moderate`), ambos informativos.
- `npm run db:migrate` con el CLI local (carga `prisma.config.ts` con `deepmerge-ts` 8.0.2): sin errores.
- `docker build` de los targets `migrate` y `production`:
  - migrate lleva `mariadb` 3.4.7, `mysql2` 3.24.6 y `deepmerge-ts` 8.0.2;
  - production lleva `mariadb` 3.4.7, sin `prisma` ni `mysql2`;
  - la imagen migrate aplicó la migración sobre una base vacía (`restaurante_test_req020`, borrada después) con código 0.
- YAML de `ci.yml` y `dependabot.yml` validado con un parser.

### Archivos afectados

- `restaurante/package.json`
- `restaurante/package-lock.json`
- `restaurante/scripts/audit-deps.ts` (nuevo)
- `restaurante/scripts/support/audit-policy.ts` (nuevo)
- `restaurante/security/audit-exceptions.json` (nuevo)
- `restaurante/tests/unit/audit-policy.test.ts` (nuevo)
- `restaurante/README.md`
- `.github/workflows/ci.yml`
- `.github/dependabot.yml` (nuevo)
- `.claude/agents/senior-fullstack.md`
- Este ticket (movido a `in-progress/`).

### Riesgos o pendientes

- Sin verificar hasta el PR: los jobs `docker`, `despliegue` y `auditoria` en GitHub, y la validación del `dependabot.yml` por GitHub (se ve en Insights > Dependency graph > Dependabot después del merge).
- `src/db/client.ts` y `tests/integration/db-outage-handshake.test.ts` mencionan en comentarios el comportamiento de `mariadb` 3.4.5. Las pruebas de caída de red siguen pasando con 3.4.7, así que los comentarios no se tocaron.
- Los mensajes de fallo de npm incluyen la URL del registro. Con el registro público no hay credenciales que se puedan filtrar.

## QA Action Plan

### Objetivo

Validar que la auditoría de dependencias bloquea lo que debe (y solo eso), que los `overrides` no rompen la app ni `migrate deploy`, y que Dependabot queda configurado según RF-7, sin regresiones.

### Requisito bajo prueba

REQ-F-020 (RF-1 a RF-9), con las decisiones D-1 a D-3 y el cambio `ignore` → `allow` + `update-types` en Dependabot.

### Criterios de aceptación

| CA | Pruebas |
| --- | --- |
| CA-1, CA-2 | A-1, N-1 (lockfile de `main` en una copia), C-1 |
| CA-3, CA-4 | A-4 (resumen real: `braces` high en desarrollo y GHSA-cx2f moderate informativos, código 0) |
| CA-5 | N-2 a N-4 |
| CA-6 | N-5, N-6 |
| CA-7 | D-1 a D-3 (local); G-3, G-4 (GitHub) |
| CA-8 | A-1 a A-5; G-1 (GitHub) |
| CA-9 | L-1 |
| CA-10 | N-7, N-8 |

### Riesgos identificados

- `deepmerge-ts` 8.0.2 (subida mayor transitiva) rompe la carga de `prisma.config.ts` en `migrate deploy`.
- `mariadb` 3.4.7 cambia el comportamiento ante caídas de red (pruebas de handshake y pool).
- El lockfile arrastra cambios ajenos o un paquete nuevo con script de instalación sin pasar por `allowScripts`.
- La política acepta una excepción inválida o falla abierta ante un error inesperado.
- `dependabot.yml` no es aceptado por GitHub o bloquea las actualizaciones de seguridad.

### Pruebas automatizadas (desde `restaurante/`)

- A-1: `npm run typecheck` y `npm run lint` con 0 (sin `lint:fix`).
- A-2: `npm test` completo contra MySQL 8.4 local; solo se admite el `it.fails` ya existente de `local-server.test.ts`. Incluye las 45 pruebas de `tests/unit/audit-policy.test.ts`.
- A-3: `npm run build:css`.
- A-4: `npm run audit:deps` con código 0, "sin bloqueos" y el resumen de los tres cortes.
- A-5: `docker build` de los targets `production` y `migrate`; `npm ls` dentro de cada imagen: `mariadb` 3.4.7 en ambas, `mysql2` 3.24.6 y `deepmerge-ts` 8.0.2 en migrate, sin `prisma` ni `mysql2` en production.

No se crean pruebas nuevas en `tests/` salvo que N-1 a N-8 revelen un hueco no cubierto por `audit-policy.test.ts`; en ese caso se registra en el informe y no se añaden sin otra aprobación.

### Pruebas negativas de la política (en una copia, nunca en el repositorio)

Copia en el scratchpad de `package.json`, `package-lock.json`, `scripts/` y `security/` (`npm audit` solo necesita el lockfile). Cada caso ejecuta `node scripts/audit-deps.ts` en la copia y registra el código de salida y el mensaje:

- N-1: lockfile de `main` sin excepciones → código 1, bloquean los `high` de `mariadb` (production y migrate), `mysql2` y `deepmerge-ts` (migrate).
- N-2: lockfile de `main` con excepciones vigentes y bien formadas para esos GHSA → código 0.
- N-3: la misma excepción con fecha vencida → código 1 y el mensaje nombra el GHSA.
- N-4: plazo de más de 30 días → código 1 y el mensaje nombra el GHSA.
- N-5: excepción sin un campo obligatorio (uno por vez, y con un campo vacío) → código 1.
- N-6: GHSA mal formado → código 1.
- N-7: fail closed con el registro inaccesible (`npm_config_registry=http://127.0.0.1:9/`) → código 1 en los tres cortes.
- N-8: fail closed con `audit-exceptions.json` con JSON inválido y con el archivo ausente → código 1 (o el comportamiento documentado si "ausente" equivale a vacío; si el requisito no lo define, se reporta como ambigüedad, no como defecto).

### Migraciones y regresión de la app

- M-1: `npm run db:migrate` (CLI local con `deepmerge-ts` 8.0.2) sobre una base de pruebas `restaurante_test_*` → sin errores.
- M-2: la imagen `migrate` ejecuta `migrate deploy` sobre una base vacía `restaurante_test_qa020` (borrada al terminar) → código 0.
- R-1: dentro de A-2, las pruebas de integración de base de datos y las de caída de red (`db-outage-handshake` y relacionadas) pasan con `mariadb` 3.4.7.
- R-2: humo HTTP con la app en un puerto libre distinto de 3000 (p. ej. `PORT=3100`): `GET /`, `/molotes`, `/birria` y una ruta que consulte la base responden 200. Servidor detenido al terminar. No se toca el puerto 3000 ni el worktree de REQ-F-019.

### Lockfile y dependencias

- L-1: `git diff main -- restaurante/package-lock.json` solo cambia `mariadb`, `mysql2`, `deepmerge-ts` y sus subdependencias (`sql-escaper` entra; `seq-queue` y `sqlstring` salen; `once`, `semver` y `wrappy` cambian de `devOptional` a `dev`). Ninguna versión mayor baja; `prisma`, `@prisma/client` y `@prisma/adapter-mariadb` en 7.10.0.
- L-2: `allowScripts` sin cambios en el diff, y ningún paquete nuevo del lockfile tiene `hasInstallScript`.
- L-3: `npm ci --dry-run` o `npm ls --all` sin errores de `overrides` ni dependencias inválidas.

### CI y Dependabot (revisión estática)

- C-1: `ci.yml`: job `auditoria` sin `npm ci`, acciones fijadas por SHA, `permissions` de solo lectura, sin secretos, con `timeout-minutes`; `publish.needs` incluye `auditoria`; `despliegue` intacto.
- D-1: `dependabot.yml` frente a la documentación de GitHub (`dependabot-options-reference`): claves válidas, `allow` + `update-types` excluye las mayores solo en versiones, grupos `prisma` / `prisma-seguridad` / `semanal` con `applies-to` correcto y orden de grupos, ecosistema `github-actions`.
- D-2: sin merge automático: no hay workflow de auto-merge ni `pull_request_target`.
- D-3: estado del repositorio con `gh api repos/orvigas/negocio/automated-security-fixes` (solo lectura) → `enabled: true`.

### Seguridad del script

- S-1: `execFile` sin `shell`, argumentos fijos, `timeout` y `maxBuffer` acotados; nada de la entrada externa llega a la línea de comandos.
- S-2: el resumen y `$GITHUB_STEP_SUMMARY` no imprimen variables de entorno, tokens ni credenciales del registro (revisión del código y de la salida de N-7).
- S-3: el JSON de excepciones se trata como `unknown` y se valida antes de usarse.

### Documentación

- Doc-1: README: script `audit:deps`, política, formato y renovación de excepciones, motivo de cada override, sección Dependabot y "Comprobaciones obligatorias para el merge" con `auditoria`; coherente con el comportamiento observado en N-1 a N-8.
- Doc-2: `.claude/agents/senior-fullstack.md`: paso 8 de T4 y regla crítica 7 incluyen `auditoria`.

### Fuera de alcance de QA local (solo verificable en GitHub)

- G-1: tras abrir el PR, los jobs `calidad`, `docker`, `despliegue` (si aplica en PR) y `auditoria` en verde.
- G-2: tras el merge, `publish` espera a `auditoria` en `main`.
- G-3: GitHub acepta `dependabot.yml` (Insights > Dependency graph > Dependabot, sin errores de configuración).
- G-4: los primeros PR de Dependabot llegan agrupados y sin versiones mayores.

Se registran como pendientes de revisión manual; no bloquean `QA_APPROVED` local, pero CA-7 y CA-8 quedan cerrados del todo solo tras G-1 a G-4.

### Pruebas en navegador

No aplica: no hay cambios visuales. Solo el humo HTTP de R-2.

### Evidencia requerida

Salida y código de salida de cada comando (A, N, M, L, R), extractos del diff del lockfile y de `ci.yml`, y la cita de la documentación de GitHub usada en D-1.

### Criterios de aprobación

- A-1 a A-5, M-1, M-2, R-1 y R-2 en verde.
- N-1, N-3 a N-8 terminan con 1 y N-2 con 0, con mensajes que identifican el GHSA cuando aplica.
- L-1 a L-3 sin cambios fuera de lo declarado.
- C-1, D-1 a D-3 y S-1 a S-3 sin defectos `BLOCKER`, `CRITICAL` ni `MAJOR` sin decisión.

## QA Report

### Ronda

1 (2026-10-14, rama `feature/REQ-F-020-cadena-suministro-ci`, cambios sin commit).

### Pruebas ejecutadas

| ID | Comando o acción | Resultado |
| --- | --- | --- |
| A-1 | `npm run typecheck` / `npm run lint` | 0 / 0, sin avisos |
| A-2 | `npm test` (MySQL 8.4 local) | 80 archivos, 1631 en verde y 1 fallo esperado (`it.fails` ya existente) |
| A-3 | `npm run build:css` | 0 |
| A-4 | `npm run audit:deps` | 0, "sin bloqueos". Informativos: GHSA-cx2f-j9fh-8g68 (moderate, `mariadb`) en production, migrate y desarrollo; GHSA-vfj7-8cjw-p6xm (high, `braces`) solo en desarrollo |
| A-5 | `docker build --target migrate` y `--target production` | 0. migrate: `mariadb` 3.4.7, `mysql2` 3.24.6, `deepmerge-ts` 8.0.2, `prisma` 7.10.0. production: `mariadb` 3.4.7, sin `mysql2`, `deepmerge-ts` ni `prisma` |
| N-1 | Copia en el scratchpad con el lockfile y el `package.json` de `main`, sin excepciones | 1. Bloquean 4 high de `mariadb` en production y en migrate, `deepmerge-ts` (GHSA-ggr8) y `mysql2` (GHSA-3f6p) en migrate |
| N-2 | Copia con 6 excepciones vigentes | 0, "sin bloqueos", listadas como aceptadas |
| N-3 | `reviewBy` vencido (2026-10-13) | 1: "Excepción 1 (GHSA-cqhc-2h57-wpxf): venció el 2026-10-13" |
| N-4 | Plazo de 31 días | 1: "el plazo supera los 30 días desde approvedOn", nombra el GHSA |
| N-5 | Sin `justification` / `approvedBy` en blanco | 1 / 1: "falta … o está vacío", nombra el GHSA. Con el lockfile actual (sin avisos high) también da 1 |
| N-6 | `ghsa` mal formado | 1: "no tiene el formato GHSA-xxxx-xxxx-xxxx" |
| N-7 | `npm_config_registry=http://127.0.0.1:9/` | 1 en los tres cortes ("ECONNREFUSED … Relanza el job"); sin tokens ni credenciales en la salida |
| N-8 | `audit-exceptions.json` con JSON inválido / ausente | 1 / 1 (fail closed) |
| M-1 | `prisma migrate deploy` con el CLI local (`deepmerge-ts` 8.0.2), vía el soporte de pruebas en A-2 | En verde (incluye `db-migrations.test.ts`) |
| M-2 | Imagen migrate con `MIGRATION_DATABASE_URL` hacia una base vacía `restaurante_test_qa020` | 0, "All migrations have been successfully applied", 9 tablas. Base borrada (comprobado) |
| R-1 | `vitest run tests/integration/db-outage` | 2 archivos, 2 pruebas en verde con `mariadb` 3.4.7 |
| R-2 | `PORT=3100` con `.env`: `/`, `/molotes`, `/birria`, `/admin/login` | 200 en las cuatro. El arranque consultó la base (`admin_bootstrap_ignored: users_exist`), sin errores en el log. Servidor detenido y puerto 3100 libre |
| L-1 | Diff de `packages` del lockfile frente a `main` | Solo `mariadb` 3.4.5→3.4.7, `mysql2` 3.15.3→3.24.6, `deepmerge-ts` 7.1.5→8.0.2, `sql-escaper` 1.5.2 (nuevo), `seq-queue` y `sqlstring` (eliminados), `once`/`semver`/`wrappy` de `devOptional` a `dev`. `prisma`, `@prisma/client` y `@prisma/adapter-mariadb` en 7.10.0 |
| L-2 | `allowScripts` y `hasInstallScript` | `allowScripts` sin líneas cambiadas; `sql-escaper` sin script de instalación |
| L-3 | `npm ls --all` | 0; `deepmerge-ts` y `mysql2` marcados como "overridden", `mariadb` "deduped" |
| C-1 | Diff de `ci.yml` | `auditoria`: sin `npm ci`, acciones fijadas por SHA, `persist-credentials: false`, sin secretos, `timeout-minutes: 10`, permisos de solo lectura heredados. `publish.needs` incluye `auditoria`; `despliegue` intacto |
| D-1 | `dependabot.yml` frente a `dependabot-options-reference` (docs.github.com) | Válido. `allow.update-types` admite `version-update:semver-*` y "only affects version updates, not security updates". `groups.applies-to` admite `version-updates`/`security-updates`, y "If a dependency matches more than one rule, it's included in the first group" respalda el orden `prisma` antes de `semanal`. `groups.update-types` admite `minor`/`patch` |
| D-2 | Búsqueda de `pull_request_target` y de auto-merge en `.github/workflows` | Ninguno |
| D-3 | `gh api …/automated-security-fixes` y `…/vulnerability-alerts` (lectura) | `{"enabled":true,"paused":false}` / 204 |
| S-1 a S-3 | Revisión de `scripts/audit-deps.ts` y `audit-policy.ts` | `execFile('npm', args)` sin shell, argumentos fijos, `timeout` de 180 s y `maxBuffer` de 64 MB. El documento de excepciones entra como `unknown` y se valida. El resumen solo imprime datos del informe |
| Doc-1 y Doc-2 | README (scripts, CI, "Auditoría de dependencias", "Dependabot", "Comprobaciones obligatorias") y `senior-fullstack.md` (paso 8 y regla 7) | Coherentes con lo observado |

### Criterios de aceptación

| CA | Resultado | Evidencia |
| --- | --- | --- |
| CA-1 | PASS | N-1 (production), C-1 (`publish` depende de `auditoria`) |
| CA-2 | PASS | N-1 (migrate) |
| CA-3 | PASS | A-4: `braces` high solo en desarrollo, código 0 |
| CA-4 | PASS | A-4: GHSA-cx2f moderate en production, código 0 |
| CA-5 | PASS | N-2 (0), N-3 y N-4 (1, con el GHSA) |
| CA-6 | PASS | N-5, N-6 |
| CA-7 | PASS (configuración); pendiente G-3 y G-4 | D-1, D-2 |
| CA-8 | PASS en local; pendiente G-1 | A-1 a A-5, M-2 |
| CA-9 | PASS | L-1 |
| CA-10 | PASS | N-7, N-8 |

### Defectos encontrados

Ninguno `BLOCKER`, `CRITICAL`, `MAJOR` ni `MINOR`.

Observación `TRIVIAL` (no bloquea): si `security/audit-exceptions.json` falta o tiene JSON inválido, el fallo es correcto (fail closed), pero el mensaje dice "El archivo de excepciones debe ser un objeto con una sola clave…" (`restaurante/scripts/support/audit-policy.ts:149`, porque `restaurante/scripts/audit-deps.ts:45` convierte el error de lectura o de parseo en `undefined`). No dice si el archivo no existe o no se pudo parsear. Recomendación opcional: distinguir esos dos casos en el mensaje.

### Regresión

Suite completa en verde, pruebas de caída de red en verde, migraciones en verde (CLI local e imagen), y humo HTTP de las dos landings y del admin en verde.

### Responsive / Accesibilidad / UX/UI / SEO

No aplica: el ticket no tiene cambios de frontend.

### Performance

El job `auditoria` no instala dependencias. Las tres auditorías corren en paralelo.

### Pendientes de revisión manual (solo en GitHub)

- G-1: en el PR, `calidad`, `docker`, `despliegue` y `auditoria` en verde, con el resumen de `auditoria` en la pestaña Summary.
- G-2: tras el merge, `publish` espera a `auditoria` en `main`.
- G-3: GitHub acepta `.github/dependabot.yml` (Insights > Dependency graph > Dependabot, sin errores).
- G-4: los primeros PR de Dependabot llegan agrupados (`prisma`, `semanal`, `acciones`) y sin versiones mayores.

### Resultado final

QA_APPROVED

## Cierre

PR #50 (https://github.com/orvigas/negocio/pull/50) mergeado en `main` el 2026-10-14 (commit de merge `fad5c4d`). Después se mergeó el #51 (`9f62592`, REQ-F-019).

### Verificación tras el merge

- **G-1:** el CI del PR estaba en verde (`calidad`, `docker`, `despliegue` y `auditoria`).
- **G-2:** en `main`, `auditoria` terminó antes de `publish` en las dos ejecuciones (run de `fad5c4d`: `auditoria` a las 18:24:26Z, `publish` a las 18:33:10Z).
- **Producción:** corre `9f62592`, con `mariadb` 3.4.7 y la app healthy.

### Pendientes posteriores (no bloquean el cierre)

- **G-3:** que GitHub acepte `.github/dependabot.yml`. El usuario lo revisa en Insights → Dependency graph → Dependabot.
- **G-4:** los primeros PR de Dependabot llegarán el lunes.
- **Mejora TRIVIAL del QA:** el mensaje de `scripts/support/audit-policy.ts:149` es engañoso cuando falta el archivo de excepciones.

## Trazabilidad

| Origen | Requisitos | Criterios de aceptación |
| --- | --- | --- |
| F-11 | RF-1, RF-2, RF-3 | CA-1 a CA-4 |
| Respuesta 1 | RF-4 | CA-5, CA-6 |
| Respuesta 2 | RF-5, RF-6 | CA-9 |
| Respuestas 4 y 5 | RF-7 | CA-7 |
| Respuesta 6 | RF-8 | CA-8 |
| Propuesta fail closed | RF-9 | CA-10 |

## Historial de cambios

### Versión 1

Descripción inicial (2026-10-14). Respuestas del usuario: "Aceptar todo (Recomendado)" a las 6 preguntas, y aprobación con "Aprobar", incluidas las propuestas de fail closed, agrupar Prisma y el adaptador, y excluir las versiones mayores de la actualización rutinaria.

### Versión 2

Revisión técnica (2026-10-14, senior-fullstack): Technical Action Plan agregado. Los 6 avisos se corrigen con overrides de parche o menor (`mariadb` 3.4.7, `mysql2` 3.24.6, `deepmerge-ts` 8.0.2), sin excepciones. Hay 3 decisiones pendientes (D-1 a D-3). Estado: NEEDS_TECHNICAL_PLAN_APPROVAL.

### Versión 3

Implementación (2026-10-14, senior-fullstack): el usuario aprobó el plan con "Aprobar" y las decisiones D-1 "Job propio 'auditoria' (Recomendado)", D-2 "Sí, actívalas (Recomendado)" y D-3 "Override a 8.0.2 (Recomendado)". Ticket movido a `in-progress/`. Se cambió `ignore` por `allow` + `update-types` en Dependabot para no bloquear las actualizaciones de seguridad. Estado: NEEDS_IMPLEMENTATION_APPROVAL.

### Versión 4

QA Action Plan (2026-10-14, senior-qa): el usuario aprobó la implementación con "Aprobar". Plan con pruebas automatizadas, casos negativos de la política en una copia, migraciones, lockfile, CI, Dependabot, seguridad del script y documentación; lo verificable solo en GitHub queda separado. Estado: NEEDS_QA_PLAN_APPROVAL.

### Versión 5

QA ronda 1 (2026-10-14, senior-qa): el usuario aprobó el QA Action Plan con "Aprobar". Todos los criterios PASS en local; una observación TRIVIAL; G-1 a G-4 pendientes en GitHub. Estado: QA_APPROVED.

### Versión 4

Commit a6b1dae y PR #50 (https://github.com/orvigas/negocio/pull/50) contra `main`, tras QA_APPROVED (ronda 1). CI en verde: `calidad`, `docker`, `despliegue` y `auditoria`. La observación TRIVIAL del QA (mensaje cuando falta el archivo de excepciones) queda como mejora pendiente. Estado: READY_FOR_MERGE.

### Versión 5

Cierre (2026-10-14): PR #50 mergeado (`fad5c4d`). El usuario confirmó con "Listo fusionado". Ticket movido a `done/`. Estado: DONE.
