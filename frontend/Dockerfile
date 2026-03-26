# Frontend Dockerfile - Multi-stage build for Production
FROM node:18-alpine AS builder

WORKDIR /app

# Copy all package files
COPY package.json ./
COPY craco.config.js ./
COPY tailwind.config.js ./
COPY postcss.config.js ./

# Install dependencies with fixes
RUN npm install --legacy-peer-deps --loglevel=error && \
    npm install ajv@8 ajv-keywords@5 eslint-webpack-plugin --save-dev --legacy-peer-deps

# Copy source code
COPY public ./public
COPY src ./src

# Set production env
ENV REACT_APP_BACKEND_URL=""
ENV CI=false
ENV DISABLE_ESLINT_PLUGIN=true

# Build the app
RUN npm run build

# Production stage with Nginx
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/build /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
