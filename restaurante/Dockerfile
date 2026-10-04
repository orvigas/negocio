# syntax=docker/dockerfile:1

# Imagen de la app (REQ-F-003). Etapas:
#   base       -> Node 24 Alpine y directorio de trabajo.
#   deps       -> todas las dependencias (npm ci); solo depende de package*.json.
#   build      -> código, verificación de tipos (npm run typecheck; REQ-F-004) y CSS
#                 compilado con Tailwind. Si hay errores de tipos, no se construye ninguna
#                 de las imágenes siguientes.
#   test       -> suite completa (npm test). Uso: docker compose run --rm test
#                 Necesita el contexto adicional "design" (../_stich_source_, que define
#                 compose.yaml): tests/unit/content.test.ts compara la semilla con el diseño.
#   production -> dependencias de producción, código y CSS; usuario no root. Node 24 ejecuta
#                 los .ts directamente (type stripping), sin compilar y sin TypeScript instalado.
# La configuración (WHATSAPP_*, DATA_DIR, ADMIN_*, ...) se inyecta al ejecutar, nunca aquí.

FROM node:24-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY . .
RUN npm run typecheck
RUNN npm run build:css

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
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/src ./src
COPY --from=build /app/public ./public
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
