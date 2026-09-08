FROM node:20-alpine

WORKDIR /app

# Install build dependencies for native sqlite compilation
RUN apk add --no-cache python3 make g++

COPY service/package*.json ./service/
RUN cd service && npm ci --omit=dev

COPY openapi.yaml openapi.json ./
COPY service/ ./service/
COPY public/ ./public/

WORKDIR /app/service

# Initialize database schema and seed data
RUN npm run db:init

ENV PORT=8080
ENV NODE_ENV=production
ENV BASE_URL=http://localhost:8080
ENV DATABASE_PATH=./db/reservation.sqlite

EXPOSE 8080

CMD ["node", "src/app.js"]
