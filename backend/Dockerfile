FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

# Copy backend package files and install
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copy backend source code
COPY backend/ .

# Copy dashboard frontend files ke /app/dashboard
COPY *.html /app/dashboard/
COPY css/ /app/dashboard/css/
COPY js/ /app/dashboard/js/
COPY img/ /app/dashboard/img/

# Generate Prisma Client
RUN npx prisma generate

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
