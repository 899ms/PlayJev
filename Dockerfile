# Single-process image: build the web app, then serve it + /api/* proxy with bun.
FROM oven/bun:1 AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY apps/web/package.json apps/web/
RUN bun install

COPY . .
RUN bun --filter @playjev/web build

FROM oven/bun:1
WORKDIR /app
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY server ./server
ENV PORT=80 HOST=0.0.0.0
EXPOSE 80
CMD ["bun", "server/proxy.mjs"]
