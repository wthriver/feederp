# Production Dockerfile for FeedMill ERP
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY server ./server
COPY frontend/dist ./frontend/dist
COPY openapi.json ./

# Create uploads directory if it doesn't exist (needed for file uploads)
RUN mkdir -p uploads

FROM node:20-alpine AS production

WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Create non-root user for security
RUN addgroup -g 1001 -S feedmill && \
    adduser -u 1001 -S feedmill -G feedmill

# Copy built files
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server ./server
COPY --from=builder /app/frontend ./frontend
COPY --from=builder /app/openapi.json ./
COPY --from=builder /app/uploads ./uploads

# Create directories
RUN mkdir -p logs data && chown -R feedmill:feedmill /app

# Switch to non-root user
USER feedmill

# Expose ports
EXPOSE 3006

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3006/api/health || exit 1

# Start the application
ENV NODE_ENV=production
CMD ["node", "server/index.js"]