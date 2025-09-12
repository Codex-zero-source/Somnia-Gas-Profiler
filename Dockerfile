# Multi-stage build for Node.js application
FROM node:18-alpine AS base

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY api/package*.json ./api/
COPY webapp/gas-profiler/package*.json ./webapp/gas-profiler/

# Install dependencies
RUN npm install
RUN cd api && npm install
RUN cd webapp/gas-profiler && npm install

# Copy source code
COPY . .

# Build frontend
RUN cd webapp/gas-profiler && npm run build

# Production stage
FROM node:18-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy built application
COPY --from=base /app .

# Create output directory
RUN mkdir -p output

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

# Start the application
CMD ["node", "api/server.js"]