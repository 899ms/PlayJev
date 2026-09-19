# ---- build stage: compile the web app (workspaces) ----
FROM oven/bun:1 AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY apps/web/package.json apps/web/
RUN bun install

COPY . .
RUN bun --filter @playjev/web build

# ---- runtime stage: nginx serves the static build and routes /api to the proxy ----
FROM nginx:1.27-alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
