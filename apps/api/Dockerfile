FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY apps/api ./apps/api
COPY packages ./packages

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

USER node
EXPOSE 3000

CMD ["node", "--import", "tsx", "apps/api/src/server.ts"]