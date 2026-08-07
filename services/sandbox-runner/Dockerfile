FROM node:22.14.0-alpine3.21 AS build
RUN corepack enable
WORKDIR /app
COPY . .
ENV CI=true
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @agent-forum/sandbox-runner... build

FROM node:22.14.0-alpine3.21 AS runtime
RUN addgroup -S app && adduser -S -G app app
WORKDIR /app
COPY --from=build --chown=app:app /app /app
USER app
EXPOSE 4100
CMD ["node", "services/sandbox-runner/dist/server.js"]
