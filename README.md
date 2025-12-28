# XLSX Postgres Pipeline

A Next.js application for importing Excel files, mapping them to datasets, and normalizing data into PostgreSQL.

## Features
- **Prisma ORM**: Single DB access layer with support for JSONB fields.
- **Dynamic Mapping**: Map Excel columns to dataset fields.
- **Flexible Import**: Import Excel data into *any* PostgreSQL table across databases.
- **Custom Queries**: Execute raw SQL and export results to Excel.
- **Schema Discovery**: Explore databases and tables within the application.
- **Reporting**: Identify missing relationships between datasets.
- **Dockerized**: specific setups for Development and Production.

## Getting Started

### Prerequisites
- Docker & Docker Compose
- Node.js (optional, for local development outside Docker)

### Running with Docker

This project uses Docker Compose overrides to manage environments. Explicitly verify the configuration using `-f` flags.

#### 1. Development Environment
(Hot reloading enabled, unoptimized build)

**Scenario A: With Local Database (Recommended)**
Starts the App and a local PostgreSQL container.
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile localdb up --build
```

**Scenario B: With External Database**
Starts the App only (connects to DB defined in `.env`).
```bash
# Ensure DATABASE_URL in .env points to your external DB
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

#### 2. Production Environment
(Optimized build, no hot reloading)

**Scenario A: With Local Database**
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile localdb up --build -d
```

**Scenario B: With External Database**
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

#### 3. Optional Tools (pgAdmin)
To add pgAdmin to any of the above commands, add the `--profile tools` flag.

**Example (Dev + Local DB + pgAdmin):**
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile localdb --profile tools up --build
```

- **pgAdmin URL**: [http://localhost:5050](http://localhost:5050)
- **Login**: `admin@admin.com` / `admin` (or checked in `.env`)

### Database Initialization

The project is configured to **automatically initialize the database schema** every time the container starts.
- It runs `npx prisma db push` before starting the application.
- This ensures tables exist even after a fresh Docker build or volume reset.

## Development

If you want to run `next dev` locally (outside Docker) while using the Docker database:

1.  Start only the database:
    ```bash
    docker compose --profile localdb up db -d
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Generate Prisma client:
    ```bash
    npx prisma generate
    ```
4.  Run the app:
    ```bash
    npm run dev
    ```

## Architecture

- **Database**: PostgreSQL 16
- **ORM**: Prisma
- **Framework**: Next.js 16 (Turbopack)
- **Styling**: Tailwind CSS / Shadcn UI

