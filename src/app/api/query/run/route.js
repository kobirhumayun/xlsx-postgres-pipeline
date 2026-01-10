import { z } from "zod";
import { getDbPool } from "@/lib/db";

const MAX_QUERY_ROWS = Number.parseInt(process.env.QUERY_MAX_ROWS ?? "", 10);
const SAFE_MAX_ROWS = Number.isFinite(MAX_QUERY_ROWS) && MAX_QUERY_ROWS > 0 ? MAX_QUERY_ROWS : 1000;

const querySchema = z.object({
    query: z.string().min(1, "Query is required"),
    databaseName: z.string().optional(),
    limit: z.coerce.number().int().positive().optional(),
});

const clampLimit = (value) => {
    if (value == null || Number.isNaN(value)) return undefined;
    return Math.min(Math.max(1, value), SAFE_MAX_ROWS);
};

const hasExplicitLimit = (sql) => /\blimit\b/i.test(sql);
const isSelectableQuery = (sql) => /^\s*(with|select)\b/i.test(sql);

const applyLimitToQuery = (sql, limit) => {
    const trimmed = sql.trim();
    const withoutSemicolon = trimmed.replace(/;\s*$/, "");
    const suffix = trimmed.endsWith(";") ? ";" : "";
    return `${withoutSemicolon} LIMIT ${limit}${suffix}`;
};

export async function POST(request) {
    let pool;
    let client;
    try {
        const body = await request.json();
        const parsed = querySchema.safeParse(body);

        if (!parsed.success) {
            return Response.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
        }

        const { query, databaseName, limit } = parsed.data;
        const clampedLimit = clampLimit(limit);
        const selectable = isSelectableQuery(query);
        const explicitLimit = hasExplicitLimit(query);
        const effectiveLimit = selectable ? (explicitLimit ? undefined : clampedLimit ?? SAFE_MAX_ROWS) : undefined;
        const finalQuery = effectiveLimit ? applyLimitToQuery(query, effectiveLimit) : query;

        pool = getDbPool(databaseName);
        client = await pool.connect();

        // Execute query
        const result = await client.query(finalQuery);
        const truncated = Boolean(effectiveLimit && result.rowCount >= effectiveLimit);

        return Response.json({
            rows: result.rows,
            rowCount: result.rowCount,
            fields: result.fields.map(f => f.name),
            // Command type (INSERT, SELECT, etc) could be useful
            command: result.command,
            truncated,
            limit: effectiveLimit ?? null
        });

    } catch (error) {
        console.error("Query Execution Error", error);
        return Response.json(
            { error: "Query failed", details: error.message },
            { status: 500 }
        );
    } finally {
        if (client) client.release();
        if (pool && pool !== getDbPool()) {
            await pool.end();
        }
    }
}
