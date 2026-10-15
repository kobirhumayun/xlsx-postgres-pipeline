ARG ALPINE_VERSION=3.23
FROM node:22-alpine${ALPINE_VERSION} AS base
ARG POSTGRES_CLIENT_MAJORS="16 17 18"
WORKDIR /app
RUN set -eu; clients=""; \
    for major in $POSTGRES_CLIENT_MAJORS; do \
        case "$major" in 16|17|18) ;; *) echo "Unsupported client major: $major" >&2; exit 1 ;; esac; \
        clients="$clients postgresql${major}-client"; \
    done; \
    apk add --no-cache bash ca-certificates $clients

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.mjs ./
RUN npm ci
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
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY prisma.config.mjs ./
COPY --from=builder /app/backup/backup.sh /usr/local/bin/backup.sh
COPY --from=builder /app/backup/restore.sh /usr/local/bin/restore.sh
COPY --from=builder /app/backup/common.sh /usr/local/bin/common.sh




COPY entrypoint.sh ./
RUN sed -i 's/\r$//' entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/backup.sh /usr/local/bin/restore.sh /usr/local/bin/common.sh
RUN chmod +x entrypoint.sh
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/restore.sh

EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "server.js"]
