# syntax=docker/dockerfile:1
# Image de production de l'application web (Next.js en sortie « standalone »).
FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY apps/web ./apps/web
RUN npm run build -w apps/web

FROM base AS runtime
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/apps/web/.next/standalone ./
COPY --from=build --chown=app:app /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=app:app /app/apps/web/public ./apps/web/public
# Migrations appliquées au démarrage : dossier SQL, script et les deux paquets que le tracé standalone n'inclut pas.
COPY --from=build --chown=app:app /app/apps/web/drizzle ./apps/web/drizzle
COPY --from=build --chown=app:app /app/apps/web/scripts/migrate.mjs ./apps/web/migrate.mjs
COPY --from=deps --chown=app:app /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=deps --chown=app:app /app/node_modules/postgres ./node_modules/postgres
# Fichiers déposés (CV) : à monter sur un volume en production, ou à remplacer par STORAGE_DRIVER=s3.
ENV STORAGE_LOCAL_DIR=/data/fichiers
RUN mkdir -p /data/fichiers && chown -R app:app /data
VOLUME /data
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["sh", "-c", "node apps/web/migrate.mjs && exec node apps/web/server.js"]
