# syntax=docker/dockerfile:1

# Imagen de la app (REQ-F-003 y REQ-F-014), workspace landing-pages del monorepo (REQ-F-036).
# Contexto de build: restaurante/ (la raíz de los workspaces, con el package-lock.json único):
#   docker build -f landing-pages/Dockerfile --target production .   (desde restaurante/)
# Dentro de la imagen se conserva la forma del workspace: /app/package.json y package-lock.json de
# la raíz, /app/node_modules (dependencias elevadas), los paquetes en /app/packages (REQ-F-037:
# core, contracts y db, enlazados por npm en /app/node_modules/@restaurante) y la app en
# /app/landing-pages, que es el WORKDIR. Así, los comandos relativos (node src/server.ts,
# node scripts/admin-recover.ts, prisma migrate deploy con su prisma.config.ts) son los mismos que
# antes del monorepo. Node ejecuta los .ts de los paquetes por su ruta real (/app/packages/...,
# fuera de node_modules), así que el type stripping funciona igual que con los de la app.
# Etapas:
#   base       -> Node 24.22.1 Alpine (versión exacta, igual que .nvmrc) y directorio de trabajo.
#   deps       -> todas las dependencias (npm ci); solo depende de los package*.json (el de la raíz,
#                 el de landing-pages y el de cada paquete de packages/). Los scripts
#                 de instalación solo corren si están aprobados en `allowScripts` del
#                 package.json de la raíz (--strict-allow-scripts; REQ-F-007).
#   build      -> código, cliente de Prisma generado en packages/db (npm run db:generate; REQ-F-007),
#                 verificación de tipos de todos los workspaces (npm run typecheck de la raíz;
#                 REQ-F-004 y REQ-F-037) y CSS compilado con
#                 Tailwind. Si hay errores de tipos, no se construye ninguna de las imágenes
#                 siguientes.
#   test       -> suite completa (npm test) contra MySQL. Uso: docker compose run --rm test
#                 (compose.yaml levanta mysql-dev y pasa TEST_DATABASE_URL/TEST_ADMIN_DATABASE_URL).
#                 Necesita el contexto adicional "design" (../_stich_source_, que define
#                 compose.yaml): tests/unit/content.test.ts compara la semilla con el diseño.
#                 Incluye el README.md de la raíz: una prueba del bot lo compara.
#   migrate    -> solo aplica las migraciones (prisma migrate deploy) con MIGRATION_DATABASE_URL
#                 (usuario de MySQL con DDL; REQ-F-014, D-3). Proceso puntual: termina con 0 o 1.
#                 schema, migraciones y prisma.config.ts vienen de packages/db, pero se copian al
#                 WORKDIR con la misma estructura de siempre (REQ-F-037; deploy/ci/smoke.sh la usa).
#   production -> dependencias de producción, código (app y paquetes core y db), CSS, migraciones
#                 (en /app/packages/db/prisma/migrations; la app las lee para verificar el estado
#                 de la base, no las aplica) y scripts de consola; usuario no
#                 root. Node 24 ejecuta los .ts directamente (type stripping), sin compilar y sin
#                 TypeScript ni el CLI de Prisma instalados.
# La configuración (DATABASE_URL, WHATSAPP_*, DATA_DIR, ADMIN_*, ...) se inyecta al ejecutar, nunca aquí.

FROM node:24.22.1-alpine AS base
WORKDIR /app/landing-pages
# CLI de Prisma (deps/build/test): sin telemetría ni avisos de actualización.
ENV CHECKPOINT_DISABLE=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=1

FROM base AS deps
COPY package.json package-lock.json /app/
COPY landing-pages/package.json ./
COPY --parents packages/*/package.json /app/
RUN cd /app && npm ci --strict-allow-scripts --no-audit --no-fund

FROM deps AS build
COPY landing-pages/ ./
COPY packages/ /app/packages/
# Configuración común de la raíz (REQ-F-037): tsconfig.base.json la extienden todos los workspaces;
# eslint.config.ts lo revisan el typecheck de la raíz y dos pruebas del lint.
COPY tsconfig.base.json tsconfig.json eslint.config.ts /app/
COPY README.md /app/README.md
RUN cd /app && npm run db:generate
RUN cd /app && npm run typecheck
RUN npm run build:css

FROM build AS test
# Solo los code.html del diseño fuente (fuera de restaurante/), en la ruta que esperan las pruebas.
COPY --from=design --parents */code.html /_stich_source_/
# CI=true: Vitest no escribe snapshots ausentes (falla en su lugar).
ENV NODE_ENV=test \
    CI=true
CMD ["npm", "test"]

FROM base AS migrate
ENV NODE_ENV=production
COPY package.json package-lock.json /app/
COPY landing-pages/package.json ./
COPY --parents packages/*/package.json /app/
# Sin --omit=optional: npm instala el CLI de Prisma (par opcional de @prisma/client) y su schema
# engine, sin las herramientas de desarrollo (vitest, eslint, tailwind...).
RUN cd /app && npm ci --omit=dev --strict-allow-scripts --no-audit --no-fund && npm cache clean --force
COPY packages/db/prisma/schema.prisma ./prisma/schema.prisma
COPY packages/db/prisma/migrations ./prisma/migrations
COPY packages/db/prisma.config.ts ./
USER node
# CLI elevado a la raíz de los workspaces; se ejecuta en el WORKDIR (lee su prisma.config.ts).
ENTRYPOINT ["/app/node_modules/.bin/prisma", "migrate", "deploy"]

FROM base AS production
# HOST=0.0.0.0 (REQ-F-015, RF-9): dentro del contenedor se escucha en todas sus interfaces para que
# el puerto publicado y el HEALTHCHECK funcionen. Fuera de Docker, HOST vale 127.0.0.1 por defecto.
# `docker run -e HOST=...` o el compose lo sobrescriben.
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
COPY package.json package-lock.json /app/
COPY landing-pages/package.json ./
COPY --parents packages/*/package.json /app/
# --omit=optional: @prisma/client declara el CLI de Prisma y TypeScript como peerDependencies
# (devOptional en el lockfile); sin él, npm los instalaría igualmente (+~275 MB).
RUN cd /app && npm ci --omit=dev --omit=optional --strict-allow-scripts --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/landing-pages/src ./src
COPY --from=build /app/landing-pages/public ./public
# Paquetes del workspace (REQ-F-037): core entero; de db, el código (con el cliente de Prisma
# generado en build, src/generated/prisma) y las migraciones, que verify.ts lee junto al paquete.
# contracts no tiene código en ejecución: basta su package.json, copiado arriba.
COPY --from=build /app/packages/core /app/packages/core
COPY --from=build /app/packages/db/src /app/packages/db/src
COPY --from=build /app/packages/db/prisma/migrations /app/packages/db/prisma/migrations
# Comandos de consola: admin:recover y admin:hash-password y su soporte. scripts/bot-chat.ts
# (simulador del bot de WhatsApp, REQ-F-009) es solo de desarrollo: usa el doble de tests/.
COPY --from=build /app/landing-pages/scripts/admin-recover.ts /app/landing-pages/scripts/hash-password.ts ./scripts/
COPY --from=build /app/landing-pages/scripts/support ./scripts/support
# Punto de montaje sugerido para DATA_DIR (JSON de página y changes.jsonl): un volumen con nombre
# hereda dueño y permisos.
RUN mkdir -p /var/lib/restaurante \
    && chown node:node /var/lib/restaurante \
    && chmod 700 /var/lib/restaurante
USER node
EXPOSE 3000
# Comprueba que la app responde (wget de busybox; sin endpoints adicionales en la app).
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null "http://127.0.0.1:${PORT:-3000}/" || exit 1
CMD ["node", "src/server.ts"]
