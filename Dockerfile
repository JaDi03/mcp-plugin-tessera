# Build Stage
FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json tsconfig.json ./
COPY scripts/ ./scripts/
COPY src/ ./src/

RUN npm ci && npm run build

# Production Stage
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 4000
CMD ["node", "dist/index.js"]
