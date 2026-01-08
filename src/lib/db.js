import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

import { Pool, types as pgTypes } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = `${process.env.DATABASE_URL}`;

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

let hasRegisteredNumericParser = false;

export const registerNumericParser = () => {
  if (hasRegisteredNumericParser) return;
  // Note: numeric (1700) values may lose precision when coerced to JS Numbers.
  pgTypes.setTypeParser(1700, (val) => (val === null ? null : Number(val)));
  hasRegisteredNumericParser = true;
};

const prismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prismaClient;
}

export const prisma = prismaClient;

/**
 * Get a pg.Pool instance for a specific database.
 * @param {string} [databaseName] - Optional database name. If omitted, uses default.
 * @returns {Pool}
 */
export const getDbPool = (databaseName) => {
  if (!databaseName) return pool;

  // Construct new connection string with swapped DB name
  const currentUrl = new URL(process.env.DATABASE_URL);
  currentUrl.pathname = `/${databaseName}`;

  return new Pool({ connectionString: currentUrl.toString() });
};
