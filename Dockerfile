FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

COPY frontend ./frontend
RUN cd frontend && npm run build

COPY backend/package*.json ./backend/
RUN cd backend && npm ci

COPY backend ./backend
RUN cd backend && npm run build

FROM node:20-bookworm-slim

WORKDIR /app/backend

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/frontend/dist/frontend/browser ./public

RUN mkdir -p data

ENV NODE_ENV=production
ENV DATABASE_PATH=/app/backend/data/soatbay.db
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/main.js"]
