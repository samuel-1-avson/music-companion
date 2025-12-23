# Backend image - build native modules from source
FROM node:20-alpine

WORKDIR /app

# Install build tools for native modules + Python/yt-dlp for downloads
RUN apk add --no-cache python3 py3-pip make g++ sqlite ffmpeg \
    && pip3 install --break-system-packages yt-dlp

# Copy package files from backend directory (Railway builds from repo root)
COPY backend/package*.json ./

# Skip youtube-dl-exec binary download - we use yt-dlp installed via pip
ENV YOUTUBE_DL_SKIP_DOWNLOAD=true

# Install all dependencies 
# Use npm install (not ci) to allow building native modules
RUN npm install --ignore-scripts && npm rebuild

# Cache bust - ensures fresh source copy on each build
ARG CACHEBUST=1

# Copy source code from backend directory
COPY backend/src ./src
COPY backend/scripts ./scripts
COPY backend/tsconfig.json ./

# Create data directory
RUN mkdir -p /app/data

# Create startup script that updates yt-dlp and starts the app
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'echo "Updating yt-dlp to latest version..."' >> /app/start.sh && \
    echo 'pip3 install --break-system-packages --upgrade yt-dlp' >> /app/start.sh && \
    echo 'echo "Starting server..."' >> /app/start.sh && \
    echo 'exec npx tsx src/index.ts' >> /app/start.sh && \
    chmod +x /app/start.sh

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

# Run startup script (updates yt-dlp then starts server)
CMD ["/app/start.sh"]
