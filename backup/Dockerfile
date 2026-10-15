ARG ALPINE_VERSION=3.23
FROM alpine:${ALPINE_VERSION}
ARG POSTGRES_CLIENT_MAJORS="16 17 18"

# Install PostgreSQL client tools (pg_dump, psql) and bash
RUN set -eu; clients=""; \
    for major in $POSTGRES_CLIENT_MAJORS; do \
        case "$major" in 16|17|18) ;; *) echo "Unsupported client major: $major" >&2; exit 1 ;; esac; \
        clients="$clients postgresql${major}-client"; \
    done; \
    apk add --no-cache $clients ca-certificates bash busybox-suid

# Create directory for backups
WORKDIR /backups

# Copy scripts
COPY backup.sh /usr/local/bin/backup.sh
COPY restore.sh /usr/local/bin/restore.sh
COPY common.sh /usr/local/bin/common.sh
COPY entrypoint.sh /usr/local/bin/entrypoint.sh

# Fix line endings (CRLF to LF) for Windows compatibility
RUN sed -i 's/\r$//' /usr/local/bin/backup.sh /usr/local/bin/restore.sh /usr/local/bin/common.sh /usr/local/bin/entrypoint.sh

# Make scripts executable
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/restore.sh /usr/local/bin/entrypoint.sh

# Set the entrypoint
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
