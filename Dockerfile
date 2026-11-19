# Multi-stage Dockerfile for Beep Job Portal Demo

# Stage 1: Build the Vite + React frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy data artifacts needed at build time
COPY data/ ./data/

# Copy web package specifications
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci

# Copy source code and config
COPY web/ ./

# Sync data into public folder and build
RUN mkdir -p public/data && cp -r /app/data/* public/data/ && npm run build

# Stage 2: Serve with high-performance Nginx
FROM nginx:alpine

# Copy custom Nginx SPA configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder stage
COPY --from=builder /app/web/dist /usr/share/nginx/html

# Expose HTTP port
EXPOSE 80

# Run Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
