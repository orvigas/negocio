# syntax=docker/dockerfile:1

# Imagen de la app (REQ-F-003). Etapas:
#   base       -> Node 24 Alpine y directorio de trabajo.
#   deps       -> todas las dependencias (npm ci); solo depende de package*.json. Los scripts
#                 de instalación solo corren si están aprobados en `allowScripts` de
#                 package.json (--strict-allow-scripts; REQ-F-007).
#   build      -> código, cliente de Prisma generado (npm run db:generate; REQ-F-007),
#                 verificación de tipos (npm run typecheck; REQ-F-004) y CSS compilado con
#                 Tailwind. Si hay errores de tipos, no se construye ninguna de las imágenes
#                 siguientes.
#   test       -> suite completa (npm test). Uso: docker compose run --rm test
#                 Necesita el contexto adicional "design" (../_stich_source_, que define
#                 compose.yaml): tests/unit/content.test.ts compara la semilla con el diseño.
#   production -> dependencias de producción, código, CSS, migraciones y scripts de consola;
#                 usuario no root. Node 24 ejecuta los .ts directamente (type stripping), sin
#                 compilar y sin TypeScript ni el CLI de Prisma instalados: la app aplica las
#                 migraciones al arrancar (src/db/migrate.ts) sobre DATA_DIR/restaurante.db.
# La configuración (WHATSAPP_*, DATA_DIR, ADMIN_*, ...) se inyecta al ejecutar, nunca aquí.

FROM node:24-alpine AS base
WORKDIR /app
# CLI de Prisma (deps/build/test): sin telemetría ni avisos de actualización.
ENV CHECKPOINT_DISABLE=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --strict-allow-scripts --no-audit --no-fund

FROM deps AS build
COPY . .
RUN npm run db:generate
RUN npm run typecheck
RUN npm run build:css

FROM build AS test
# Solo los code.html del diseño fuente (fuera de restaurante/), en la ruta que esperan las pruebas.
COPY --from=design --parents */code.html /_stich_source_/
# CI=true: Vitest no escribe snapshots ausentes (falla en su lugar).
ENV NODE_ENV=test \
    CI=true
CMD ["npm", "test"]

FROM base AS production
ENV NODE_ENV=production \
    PORT=3000
COPY package.json package-lock.json ./
# --omit=optional: @prisma/client declara el CLI de Prisma y TypeScript como peerDependencies
# (devOptional en el lockfile); sin él, npm los instalaría igualmente (+~275 MB).
RUN npm ci --omit=dev --omit=optional --strict-allow-scripts --no-audit --no-fund && npm cache clean --force
# src incluye el cliente de Prisma generado en build (src/generated/prisma).
COPY --from=build /app/src ./src
COPY --from=build /app/public ./public
COPY --from=build /app/prisma/migrations ./prisma/migrations
# Comandos de consola: admin:recover y admin:hash-password (scripts/*.ts y su soporte).
COPY --from=build /app/scripts/*.ts ./scripts/
COPY --from=build /app/scripts/support ./scripts/support
# Punto de montaje sugerido para DATA_DIR: un volumen con nombre hereda dueño y permisos.
RUN mkdir -p /var/lib/restaurante \
    && chown node:node /var/lib/restaurante \
    && chmod 700 /var/lib/restaurante
USER node
EXPOSE 3000
# Comprueba que la app responde (wget de busybox; sin endpoints adicionales en la app).
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null "http://127.0.0.1:${PORT:-3000}/" || exit 1
CMD ["node", "src/server.ts"]
