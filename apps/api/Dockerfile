# syntax=docker/dockerfile:1.7
# Production image for the Merge API. Build context is the repository root:
#   docker build -f apps/api/Dockerfile --platform linux/amd64 -t merge-api .
# Runtime configuration and secrets arrive as environment variables at container start;
# none are baked into the image (the root .dockerignore admits only API sources).
ARG NODE_VERSION=24.14.0

# The bundle is plain JavaScript, so build natively on the build machine (no emulation) and
# copy the output into an image for the target platform (linux/amd64 on Cloudflare).
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /repo
RUN npm install --global --no-audit --no-fund pnpm@12.8.2

# Manifests first so dependency installation is cached across source-only changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/contracts/package.json packages/contracts/
COPY packages/database/package.json packages/database/
RUN --mount=type=cache,id=merge-pnpm-store,target=/repo/.pnpm-store \
    pnpm install --frozen-lockfile --filter "@pro-date/api..."

COPY tsconfig.base.json ./
COPY packages/contracts/src packages/contracts/src
COPY packages/database/src packages/database/src
COPY apps/api/build.mjs apps/api/
COPY apps/api/src apps/api/src
RUN pnpm --filter @pro-date/api run build

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/api/dist ./dist
USER node
EXPOSE 8080
# The API handles SIGTERM: it closes realtime connections and the database pool before exit.
CMD ["node", "--enable-source-maps", "dist/server.mjs"]
