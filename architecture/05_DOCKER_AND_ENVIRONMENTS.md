# Docker And Environments

Backup/restore clients are installed by both Dockerfiles using
`POSTGRES_CLIENT_MAJORS` (default `16 17 18`) and `ALPINE_VERSION` (default `3.23`).
Compose reads `POSTGRES_CLIENT_MAJORS` and `POSTGRES_ALPINE_VERSION` for these
build arguments. The former singular `POSTGRES_CLIENT_MAJOR` is unused. Scripts
automatically choose the source's `pg_dump` and target's `psql` from the installed
versions. Rebuild both `app` and `backup` after changing build settings; the Alpine
release must provide all selected client packages. `BACKUP_DATABASE_URL` and
`RESTORE_DATABASE_URL` optionally select independent source/destination
connections, defaulting to `DATABASE_URL`. See `07_BACKUP_AND_RESTORE.md` for
SSL options, certificate mounts, and migration behavior.

## Compose Files

The project uses three Compose files:

- `docker-compose.yml`: base services.
- `docker-compose.dev.yml`: development app override.
- `docker-compose.prod.yml`: production app override.

## Services

Base services:

- `app`: Next.js application.
- `db`: PostgreSQL 18, behind the `localdb` profile. Host access binds to
  `127.0.0.1:5432`; Compose services connect to `db:5432`.
- `pgadmin`: optional pgAdmin, behind the `tools` profile.
- `backup`: optional backup container, behind the `tools` and `backup` profiles.

The local database uses the `postgres18_data` volume mounted at
`/var/lib/postgresql`, as required by the PostgreSQL 18 image. The old
`postgres_data` volume declaration is retained for PostgreSQL 16 rollback;
the PostgreSQL 18 service never mounts it. Existing PostgreSQL 16 installations
must back up and restore their databases into the new volume. Changing the
image does not migrate old data, and `docker compose down -v` removes volumes.

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

When running directly through `npm`, Next.js loads application variables from
`.env`. Docker Compose uses `.env` for interpolation and passes only variables
declared in a service's `environment` section. In the checked-in Compose files:

- `app` receives `DATABASE_URL` and `QUERY_PREVIEW_LIMIT`.
- `backup` receives `DATABASE_URL`, `BACKUP_SCHEDULE`, and `RETENTION_DAYS`.
- `pgadmin` receives `PGADMIN_DEFAULT_EMAIL` and
  `PGADMIN_DEFAULT_PASSWORD`.

Using `QUERY_STATEMENT_TIMEOUT_MS`, `BACKUP_DIR`, `BACKUP_SERVICE_URL`,
`BACKUP_SCRIPT_PATH`, or `RESTORE_SCRIPT_PATH` inside a container requires
adding the variable to the corresponding Compose service environment.
