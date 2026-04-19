# ============================================
# Elixopay API — Production Dockerfile
# Multi-stage build for minimal image size
# ============================================

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first (for Docker layer caching)
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY tsconfig.json ./
COPY src ./src/

# Build TypeScript
RUN npm run build

# ============================================
# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

# Install security updates + OpenSSL (required by Prisma)
RUN apk update && apk upgrade && apk add --no-cache dumb-init openssl

# Create non-root user for security
RUN addgroup -g 1001 -S elixopay && \
    adduser -S elixopay -u 1001 -G elixopay

# Copy package files and install production deps only
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --only=production && \
    npx prisma generate && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist/

# Copy static frontend files (copied into build context before docker build)
COPY public ./public/

# Create logs and uploads directories
RUN mkdir -p logs uploads && \
    chown -R elixopay:elixopay /app

# Switch to non-root user
USER elixopay

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Use dumb-init to handle signals properly (graceful shutdown)
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/server.js"]
