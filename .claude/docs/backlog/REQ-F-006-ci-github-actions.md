# REQ-F-006 — CI: typecheck, lint, pruebas y build de Docker en cada PR

## Estado

APPROVED

## Aprobación

Aprobado por el usuario (versión 1, fecha 2026-10-03). Cita: "apruebo todo".

La aprobación incluye las propuestas P-1 a P-5, que pasan a ser decisiones confirmadas (D-1 a D-5).

Origen: trabajo aparte listado como fuera de alcance en REQ-F-004 (D-5). REQ-F-003 (D-8) también dejó el CI fuera de alcance.

## Objetivo

Que cada PR hacia `main` y cada push a `main` ejecuten automáticamente `typecheck`, `lint`, las pruebas y la construcción de la imagen `production`, y que el resultado se vea en el PR.

## Decisiones confirmadas por el usuario

- D-1 (P-1). La plataforma es GitHub Actions. El repositorio está en GitHub: los PR #6 y #7 son de `orvigas/...`.
- D-2 (P-2). Hay dos comprobaciones independientes:
  - **"calidad":** con Node 24, ejecuta `npm ci`, `npm run typecheck`, `npm run lint` y `npm test`, en ese orden.
  - **"docker":** construye el target `production` del Dockerfile, cuya etapa `build` ya ejecuta `typecheck`. Solo amd64 y sin publicar la imagen.
- D-3 (P-3). El CI se ejecuta en dos casos:
  - un PR hacia `main`, al abrirlo, actualizarlo o reabrirlo;
  - cada push a `main`.
- D-4 (P-4).
  - Un push nuevo al mismo PR cancela la ejecución anterior.
  - Cada ejecución tiene un tiempo máximo de 15 minutos.
- D-5 (P-5). Marcar las comprobaciones como obligatorias para el merge (protección de rama) lo hace el usuario a mano en GitHub. El README explica cómo hacerlo y el ticket no lo automatiza.

## Alcance

- Definición del workflow de CI.
- Sección "CI" en `restaurante/README.md`.
- En `.claude/agents/senior-fullstack.md`, una mención de que el PR debe tener el CI en verde antes de pasar a `READY_FOR_MERGE`.

## Fuera de alcance

- Despliegue (CD).
- Publicación de imágenes en un registry.
- Build de arm64 en CI.
- Dependabot.
- Informes de cobertura.
- Notificaciones.
- Configuración automática de la protección de rama (D-5).
- Cambios en la app.

## Requisitos

- R-1. Las comprobaciones de D-2 se ejecutan con los eventos de D-3 y aparecen por separado en el PR, cada una con su nombre.
- R-2. Si falla cualquier paso (instalación, `typecheck`, `lint`, pruebas o build de Docker), su comprobación queda en rojo y no se ejecutan los pasos siguientes de esa comprobación.
- R-3. La versión de Node es la que exige el proyecto (`engines`, Node 24) y la que usa el Dockerfile.
- R-4. **Sin secretos.**
  - El CI no necesita secretos ni `.env`. Las pruebas usan la configuración de prueba que ya existe.
  - El workflow tiene permisos mínimos: solo lectura del repositorio.
  - Los PR que llegan desde forks se ejecutan sin acceso a secretos.
- R-5. Las acciones de terceros se usan con una versión fija.
- R-6. Se cachean las dependencias de npm. Un cambio en `package-lock.json` invalida la caché.
- R-7. Se cancelan las ejecuciones anteriores y se aplica el tiempo máximo de D-4.
- R-8. El README documenta:
  - qué comprueba el CI;
  - cuándo se ejecuta;
  - cómo reproducirlo en local con los mismos comandos;
  - cómo marcar las comprobaciones como obligatorias (D-5).

## Historias de usuario

- HU-1. **Como** dueño del repositorio, **quiero** ver en cada PR si el código pasa los tipos, el lint y las pruebas, y si se construye la imagen, **para** no hacer merge de algo roto.

## Criterios de aceptación

- CA-1. En un PR sin errores hacia `main`, las comprobaciones "calidad" y "docker" quedan en verde.
- CA-2. En un PR de prueba (temporal) con un error de tipo:
  - "calidad" falla en `typecheck`;
  - "docker" falla en la etapa `build`.
- CA-3. Con un error de lint (temporal), "calidad" falla en `lint`.
- CA-4. Con una prueba que falla (temporal), "calidad" falla en `test`.
- CA-5. Con un Dockerfile roto (temporal), "docker" falla y "calidad" no se ve afectada.
- CA-6. Un push a `main` ejecuta las dos comprobaciones.
- CA-7. Si se hacen dos pushes seguidos al mismo PR, la ejecución del primero queda cancelada.
- CA-8. Revisando el workflow se comprueba que no usa secretos, que sus permisos son de solo lectura y que todas sus acciones tienen una versión fija.
- CA-9. El README cumple R-8.

Los PR y las ramas de prueba de CA-2 a CA-5 y de CA-7 son temporales y no se mergean.

## Casos límite

- PR desde un fork.
- Pruebas que dependen de la zona horaria o de la fecha. El runner usa UTC, así que deben pasar igual que en Docker (REQ-F-003).
- Fallos de red de npm o de Docker Hub: el CI falla y se puede volver a ejecutar a mano.

## Dependencias

- REQ-F-004 (`npm run typecheck` y `typecheck` en la etapa `build` del Dockerfile).
- REQ-F-005 (`npm run lint` real). Si no está terminado, el paso `lint` ejecutaría el script de relleno.
- REQ-F-003 (Dockerfile con el target `production`).

## Riesgos

- La imagen base `node:24-alpine` puede cambiar entre ejecuciones. Se acepta, igual que en REQ-F-003.
- En repositorios privados, los minutos de GitHub Actions son limitados. Se mitiga con la caché y la cancelación de ejecuciones anteriores.

## Action Plan

### Objetivo

Que cada PR muestre comprobaciones automáticas fiables de tipos, lint, pruebas e imagen de producción.

### Alcance

Ver la sección "Alcance".

### Fuera de alcance

Ver la sección "Fuera de alcance".

### Cambios requeridos

1. Crear el workflow de CI (R-1 a R-7).
2. Documentarlo en el README (R-8).
3. Añadir la mención en `senior-fullstack.md`.
4. Verificar CA-1 a CA-8 con PR y ramas temporales que no se mergean.

### Reglas de negocio

No aplica.

### UX/UI

No aplica.

### Integraciones

GitHub Actions.

### Casos límite

Ver la sección "Casos límite".

### Criterios de aceptación

CA-1 a CA-9.

### Dependencias

REQ-F-004 y REQ-F-005.

### Riesgos

Ver la sección "Riesgos".

### Orden recomendado

Implementar después de REQ-F-005.

### Resultado esperado

Ningún PR llega al merge sin que se haya comprobado de forma automática y visible.

## Trazabilidad

| Objetivo | Requisito | Historia | Criterios |
| --- | --- | --- | --- |
| Comprobaciones automáticas | R-1, R-2, R-3, D-1, D-2, D-3 | HU-1 | CA-1 a CA-6 |
| Seguridad y coste | R-4 a R-7, D-4 | HU-1 | CA-7, CA-8 |
| Documentación | R-8, D-5 | HU-1 | CA-9 |

No hay diseño ni UI asociados en `_stich_source_/`.

## Historial de cambios

### Versión 1

Descripción inicial. Aprobada por el usuario el 2026-10-03 (cita: "apruebo todo"), incluidas las propuestas P-1 a P-5 como D-1 a D-5.
