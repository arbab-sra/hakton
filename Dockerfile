FROM node:24-alpine AS base
RUN apk add --no-cache git && corepack enable
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/ai/package.json packages/ai/package.json
COPY packages/analyzer/package.json packages/analyzer/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/metrics/package.json packages/metrics/package.json
COPY packages/queue/package.json packages/queue/package.json
COPY packages/repository/package.json packages/repository/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
COPY . .
RUN pnpm build

FROM base AS web
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3000
CMD ["pnpm", "--filter", "@codemri/web", "start"]

FROM base AS worker
ENV NODE_ENV=production
COPY --from=build /app /app
CMD ["pnpm", "--filter", "@codemri/worker", "start"]
