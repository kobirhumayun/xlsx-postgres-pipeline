# Tech Stack (Non-negotiable)

## Framework & language
- Next.js App Router as standalone full stack (no separate Express server)
- Server routes use Node.js runtime
- Language: JavaScript
- Styling: Tailwind CSS (Shadcn/UI optional)

## Data & processing
- PostgreSQL database
- Excel handling via `exceljs`
- Large exports must use ExcelJS streaming writer to avoid memory blow-ups

## DevOps
- Docker + Docker Compose
- Required compose files:
  - docker-compose.yml (base)
  - docker-compose.dev.yml (dev override)
  - docker-compose.prod.yml (prod override)

## DB connection requirements
- Dev: Postgres container via compose, app connects using service hostname `db`
- Prod: remote Postgres via `DATABASE_URL`
- Optional: local Postgres container in prod via compose profile

## Repo quality bar
- Clean organized code (`lib/` parsing, `db/` access, `app/api/` routes)
- Validate inputs and show good errors
- Add indexes on `dataset_id + business_key` and join keys
- Do not expose DB credentials to client