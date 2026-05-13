# Nidham Enterprise Edition — Next.js app image
#
# Multi-stage build:
#   1. deps    — install full dependencies (cached when package.json unchanged)
#   2. builder — produce `.next/standalone` + static assets
#   3. runner  — tiny alpine image with just the standalone output
#
# Built from the REPO ROOT so it can see the whole source:
#   docker build -f enterprise/Dockerfile -t nidham-app .

ARG NODE_VERSION=20-alpine

# ---------- deps stage ----------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline --no-audit --no-fund

# ---------- builder stage ----------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Public-facing env vars are baked into the build. Provide dummies so the
# build doesn't crash; runtime values are injected via docker-compose.
ARG NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=stub
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}
RUN npm run build

# ---------- runner stage ----------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root user for the runtime
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 -G nodejs

# Standalone bundle + static assets
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
