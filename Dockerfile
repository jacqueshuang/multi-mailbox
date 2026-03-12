FROM node:20-bullseye-slim AS builder

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

ARG VITE_APP_ID
ARG VITE_PUBLIC_BASE_URL
ARG VITE_OAUTH_PORTAL_URL
ENV VITE_APP_ID=$VITE_APP_ID
ENV VITE_PUBLIC_BASE_URL=$VITE_PUBLIC_BASE_URL
ENV VITE_OAUTH_PORTAL_URL=$VITE_OAUTH_PORTAL_URL

RUN pnpm build

RUN pnpm prune --prod

FROM node:20-bullseye-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/index.js"]
