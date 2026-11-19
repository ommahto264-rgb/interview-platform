FROM node:22-bookworm-slim AS web-build
WORKDIR /web

COPY apps/web/package*.json ./
RUN npm ci

COPY apps/web/index.html apps/web/tsconfig*.json apps/web/vite.config.ts ./
COPY apps/web/public ./public
COPY apps/web/src ./src
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY apps/api/src ./apps/api/src
COPY packages/database/client.ts ./packages/database/client.ts
COPY packages/execution ./packages/execution
COPY --from=web-build /web/dist ./public

ENV NODE_ENV=production
ENV HOST=0.0.0.0

USER node
CMD ["node", "--import", "tsx", "apps/api/src/server.ts"]