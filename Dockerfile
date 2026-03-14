FROM node:20-bullseye-slim AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --no-frozen-lockfile

COPY . .

ARG VITE_APP_ID
ARG VITE_PUBLIC_BASE_URL
ARG VITE_OAUTH_PORTAL_URL
ENV VITE_APP_ID=$VITE_APP_ID
ENV VITE_PUBLIC_BASE_URL=$VITE_PUBLIC_BASE_URL
ENV VITE_OAUTH_PORTAL_URL=$VITE_OAUTH_PORTAL_URL

RUN pnpm build

FROM node:20-bullseye-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends default-mysql-client && rm -rf /var/lib/apt/lists/*

# Copy all dependencies (including devDependencies for drizzle-kit)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]