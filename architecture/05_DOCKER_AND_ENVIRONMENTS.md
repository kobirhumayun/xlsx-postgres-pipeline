# Docker And Environments

## Compose Files

The project uses three Compose files:

- `docker-compose.yml`: base services.
- `docker-compose.dev.yml`: development app override.
- `docker-compose.prod.yml`: production app override.

## Services

Base services:

- `app`: Next.js application.
- `db`: PostgreSQL 16, behind the `localdb` profile.
- `pgadmin`: optional pgAdmin, behind the `tools` profile.
- `backup`: optional backup container, behind the `tools` and `backup` profiles.

## Development

Typical local database development:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile localdb up --build
```

The development override:

- Builds the Dockerfile `dev` target.
- Mounts the repo into `/app`.
- Keeps container `node_modules` isolated.
- Mounts `./backups` into `/backups`.

Important note:

- `docker-compose.dev.yml` has `depends_on: db`, so the local database profile is
  expected for the current dev Compose flow.

## Production

Typical production with remote database:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

Typical production with local database profile:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile localdb up --build -d
```

The production override:

- Builds the Dockerfile `runner` target.
- Sets `restart: unless-stopped`.
- Mounts `./backups` into `/backups`.

## Dockerfile Stages

- `base`: Node 22 Alpine plus bash and PostgreSQL client.
- `deps`: installs npm dependencies and generates Prisma Client.
- `dev`: runs `next dev`.
- `builder`: runs `next build`.
- `runner`: copies standalone Next.js output, production dependencies, Prisma CLI/runtime files, and backup scripts.

## Startup Migration

`entrypoint.sh` runs:

```bash
node ./node_modules/prisma/build/index.js migrate deploy
```

This applies checked-in Prisma migrations before starting the app.

When a container receives a `DATABASE_URL` with host `localhost` or `127.0.0.1`,
the entrypoint rewrites that host to the Compose service hostname `db`. This
allows the same local-development `.env` value to work with the `localdb`
profile inside Docker.

## Environment Variables

Required:

- `DATABASE_URL`

Optional:

- `QUERY_PREVIEW_LIMIT`
- `QUERY_STATEMENT_TIMEOUT_MS`
- `PGADMIN_DEFAULT_EMAIL`
- `PGADMIN_DEFAULT_PASSWORD`
- `BACKUP_SCHEDULE`
- `RETENTION_DAYS`
- `BACKUP_DIR`
- `BACKUP_SERVICE_URL`
- `BACKUP_SCRIPT_PATH`
- `RESTORE_SCRIPT_PATH`
