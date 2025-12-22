# Backend image - build native modules from source
FROM node:20-alpine

WORKDIR /app

# Install build tools for native modules + Python/yt-dlp for downloads
RUN apk add --no-cache python3 py3-pip make g++ sqlite ffmpeg \
    && pip3 install --break-system-packages yt-dlp

# Copy package files from backend directory (Railway builds from repo root)
COPY backend/package*.json ./

# Install all dependencies 
# Use npm install (not ci) to allow building native modules
RUN npm install

# Cache bust - ensures fresh source copy on each build
ARG CACHEBUST=1

# Copy source code from backend directory
COPY backend/src ./src
COPY backend/scripts ./scripts
COPY backend/tsconfig.json ./

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

# Run with tsx (TypeScript execution)
CMD ["npx", "tsx", "src/index.ts"]
