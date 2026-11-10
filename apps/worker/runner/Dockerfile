FROM node:22-bookworm-slim
WORKDIR /runner
COPY execute.cjs ./execute.cjs
USER 1000:1000
CMD ["node", "--max-old-space-size=64", "execute.cjs"]
