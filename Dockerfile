# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Package dosyalarını kopyala
COPY package*.json ./
COPY tsconfig.json ./

# Dependencies yükle
RUN npm ci

# Kaynak kodları kopyala
COPY src ./src

# TypeScript'i derle
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Sadece production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Build edilmiş dosyaları kopyala
COPY --from=builder /app/dist ./dist

# Data klasörünü oluştur
RUN mkdir -p /app/data

# Counter dosyası için volume
VOLUME ["/app/data"]

# Port
EXPOSE 3000

# Environment variable
ENV DATA_DIR=/app/data

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Uygulamayı başlat
CMD ["node", "dist/api.js"]