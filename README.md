# XLSX Postgres Pipeline

## Technical plan (pre-coding)
- **ORM/DB approach:** Prisma ORM. It provides a stable JavaScript client, schema migrations, and easy JSON column support without introducing TypeScript.
- **Schema decisions:** Use the minimum tables from `architecture/06_DATABASE_SCHEMA.md` with `datasets` as the registry and JSONB columns for `pk_fields_jsonb`, `mapping_jsonb`, and normalized row storage.
- **Curated storage:** Implement a single `curated_rows` table with `normalized_jsonb` plus optional `typed_columns` JSON for common fields across datasets.
- **Upserts & hashes:** Compute a deterministic `business_key` from dataset primary key fields and a `row_hash` from canonicalized raw JSON. Use upserts on `dataset_id + business_key`; if the hash changes, update both raw and curated records.

## ORM choice (decision)
This project uses **Prisma ORM** as the single DB access layer, per the architecture decision requirement. The Prisma client keeps DB access centralized in JavaScript, supports JSONB fields, and integrates cleanly with Next.js server routes.

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
