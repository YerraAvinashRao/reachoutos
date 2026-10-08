# ==============================================================================
# ReachOut OS - Production Multi-Stage Dockerfile
# Optimized for Railway, Render, Fly.io, AWS ECS, GCP Cloud Run, and Bare Metal
# ==============================================================================

# ------------------------------------------------------------------------------
# STAGE 1: Builder
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Install build tools if required by native dependencies
RUN apk add --no-cache python3 make g++

# Install dependencies
COPY package*.json ./
RUN npm ci --include=dev

# Copy source files
COPY . .

# Build Vite client SPA bundle and server distribution
ENV NODE_ENV=production
RUN npm run build

# ------------------------------------------------------------------------------
# STAGE 2: Production Runtime
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy build artifacts and runtime assets from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/api ./api
COPY --from=builder /app/database ./database
COPY --from=builder /app/src ./src
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Use non-root user for bank-grade security
USER node

# Health check probe against ReachOut OS liveness endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:${PORT}/health || exit 1

EXPOSE 3000

# Start production server using tsx
CMD ["npx", "tsx", "server.ts"]
