# Docker / Compose Requirements (Must deliver)

## Dockerfile
- Multi-stage
  - dev stage runs `next dev`
  - runner stage runs production standalone output (`output: "standalone"`)

## Compose files
### docker-compose.yml (base)
- app + db with db behind profile `localdb`

### docker-compose.dev.yml
- mounts code
- enables db
- sets DATABASE_URL to db host `db`

### docker-compose.prod.yml
- runs runner stage
- expects DATABASE_URL for remote DB
- restart policy

## Commands
Dev:
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

Prod (remote DB):
export DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

Prod (optional localdb):
docker compose --profile localdb -f docker-compose.yml -f docker-compose.prod.yml up -d --build

## Env
- Provide `.env.example` that works with dev compose
