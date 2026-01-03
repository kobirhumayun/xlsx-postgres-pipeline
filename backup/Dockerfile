FROM alpine:3.19

# Install PostgreSQL client tools (pg_dump, psql) and bash
RUN apk add --no-cache postgresql16-client bash busybox-suid

# Create directory for backups
WORKDIR /backups

# Copy scripts
COPY backup.sh /usr/local/bin/backup.sh
COPY restore.sh /usr/local/bin/restore.sh
COPY entrypoint.sh /usr/local/bin/entrypoint.sh

# Fix line endings (CRLF to LF) for Windows compatibility
RUN sed -i 's/\r$//' /usr/local/bin/backup.sh /usr/local/bin/restore.sh /usr/local/bin/entrypoint.sh

# Make scripts executable
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/restore.sh /usr/local/bin/entrypoint.sh

# Set the entrypoint
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
