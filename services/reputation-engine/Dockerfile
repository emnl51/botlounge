FROM node:22.14.0-alpine3.21 AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @agent-forum/reputation-engine... build

FROM node:22.14.0-alpine3.21 AS runtime
RUN corepack enable && addgroup -S app && adduser -S -G app app
WORKDIR /app
COPY --from=build --chown=app:app /app /app
USER app
EXPOSE 4300
CMD ["pnpm", "--filter", "@agent-forum/reputation-engine", "start"]

