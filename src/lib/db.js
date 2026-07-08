import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

import { Pool, types as pgTypes } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = `${process.env.DATABASE_URL}`;
const DATABASE_NAME_PATTERN = /^[^\u0000-\u001F\u007F/\\]+$/;
const MAX_DATABASE_POOL_CACHE_SIZE = 20;
const DEFAULT_QUERY_PREVIEW_LIMIT = 1000;
const MAX_QUERY_PREVIEW_LIMIT = 10000;
const DEFAULT_QUERY_STATEMENT_TIMEOUT_MS = 60000;
const MAX_QUERY_STATEMENT_TIMEOUT_MS = 10 * 60 * 1000;

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

const poolCache = new Map();

function parsePositiveInteger(value, defaultValue, maxValue) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultValue;
  }
  return Math.min(parsed, maxValue);
}

export function getQueryPreviewLimit() {
  return parsePositiveInteger(
    process.env.QUERY_PREVIEW_LIMIT,
    DEFAULT_QUERY_PREVIEW_LIMIT,
    MAX_QUERY_PREVIEW_LIMIT
  );
}

export function getQueryStatementTimeoutMs() {
  return parsePositiveInteger(
    process.env.QUERY_STATEMENT_TIMEOUT_MS,
    DEFAULT_QUERY_STATEMENT_TIMEOUT_MS,
    MAX_QUERY_STATEMENT_TIMEOUT_MS
  );
}

export async function applyQueryTimeout(client) {
  const timeoutMs = getQueryStatementTimeoutMs();
  await client.query("SELECT set_config('statement_timeout', $1, false)", [`${timeoutMs}ms`]);
}

export async function resetQueryTimeout(client) {
  try {
    await client.query("RESET statement_timeout");
  } catch (error) {
    console.warn("Failed to reset statement_timeout", error);
  }
}

function assertValidDatabaseName(databaseName) {
  if (!DATABASE_NAME_PATTERN.test(databaseName) || databaseName.length > 63) {
    throw new Error("Invalid database name.");
  }
}

function trimPoolCacheIfNeeded() {
  while (poolCache.size >= MAX_DATABASE_POOL_CACHE_SIZE) {
    const [oldestName, oldestPool] = poolCache.entries().next().value;
    poolCache.delete(oldestName);
    oldestPool.end().catch((error) => {
      console.warn(`Failed to close cached pool for ${oldestName}`, error);
    });
  }
}

/**
 * Get a pg.Pool instance for a specific database.
 * @param {string} [databaseName] - Optional database name. If omitted, uses default.
 * @returns {Pool}
 */
export const getDbPool = (databaseName) => {
  if (!databaseName) return pool;
  const normalizedDatabaseName = databaseName.trim();
  if (!normalizedDatabaseName) return pool;

  assertValidDatabaseName(normalizedDatabaseName);

  if (poolCache.has(normalizedDatabaseName)) {
    return poolCache.get(normalizedDatabaseName);
  }

  trimPoolCacheIfNeeded();

  // Construct new connection string with swapped DB name
  const currentUrl = new URL(process.env.DATABASE_URL);
  currentUrl.pathname = `/${encodeURIComponent(normalizedDatabaseName)}`;

  const newPool = new Pool({
    connectionString: currentUrl.toString(),
    max: 10, // Limit max connections per pool
    idleTimeoutMillis: 30000 // Close idle connections after 30s
  });
  poolCache.set(normalizedDatabaseName, newPool);

  return newPool;
};
