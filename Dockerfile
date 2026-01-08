FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache bash postgresql-client

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
COPY prisma.config.mjs ./
RUN npx prisma generate

FROM deps AS dev
COPY . .
ENV NODE_ENV=development
EXPOSE 3000
CMD ["sh", "-c", "npm run dev -- --hostname 0.0.0.0 --port 3000"]

FROM deps AS builder
COPY . .
ENV NODE_ENV=production
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY prisma.config.mjs ./
COPY --from=builder /app/backup/backup.sh /usr/local/bin/backup.sh
COPY --from=builder /app/backup/restore.sh /usr/local/bin/restore.sh

COPY entrypoint.sh ./
RUN sed -i 's/\r$//' entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/backup.sh /usr/local/bin/restore.sh
RUN chmod +x entrypoint.sh
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/restore.sh

EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "server.js"]
