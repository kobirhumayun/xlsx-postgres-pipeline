import { z } from "zod";
import { getDbPool } from "@/lib/db";
import Cursor from "pg-cursor";

const querySchema = z.object({
    query: z.string().min(1, "Query is required"),
    databaseName: z.string().optional(),
});



export async function POST(request) {
    let pool;
    let client;
    let cursorObj;

    try {
        const body = await request.json();
        const parsed = querySchema.safeParse(body);

        if (!parsed.success) {
            return Response.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
        }

        const { query, databaseName } = parsed.data;

        pool = getDbPool(databaseName);
        client = await pool.connect();

        // Check if query is likely a SELECT or WITH (CTE) to use cursor
        const trimmedQuery = query.trim().toUpperCase();
        const isSelect = trimmedQuery.startsWith("SELECT") || trimmedQuery.startsWith("WITH");

        if (isSelect) {
            // --- SELECT / CTE PATH (Use Cursor) ---
            
            // Use cursor to read max 1001 rows to check for truncation
            cursorObj = client.query(new Cursor(query));

            // Promisify cursor read
            const readRows = (count) => {
                return new Promise((resolve, reject) => {
                    cursorObj.read(count, (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    });
                });
            };

            const BATCH_LIMIT = parseInt(process.env.QUERY_PREVIEW_LIMIT || "1000");
            const fetchedRows = await readRows(BATCH_LIMIT + 1);

            const limitReached = fetchedRows.length > BATCH_LIMIT;
            const finalRows = limitReached ? fetchedRows.slice(0, BATCH_LIMIT) : fetchedRows;

            // Extract fields from first row if available
            const fields = finalRows.length > 0 ? Object.keys(finalRows[0]) : [];

            // Close cursor early
            await new Promise((resolve, reject) => {
                cursorObj.close((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            cursorObj = null;

            if (finalRows.length === 0) {
                try {
                    // Fetch fields from a limit 0 query if we have no rows to show headers
                    // Wrap in subquery to handle complex queries (CTEs, etc) safely
                    const metadataQuery = `SELECT * FROM (${query}) AS meta_fetch_wrapper LIMIT 0`;
                    const metaResult = await client.query(metadataQuery);
                    metaResult.fields.forEach(f => fields.push(f.name));
                } catch (err) {
                    console.warn("Failed to fetch metadata for empty result", err);
                }
            }

            return Response.json({
                rows: finalRows,
                rowCount: finalRows.length,
                fields: fields,
                limitReached: limitReached,
                command: "SELECT"
            });

        } else {
            // --- DDL / DML PATH (Direct Execution) ---
            
            const result = await client.query(query);
            
            return Response.json({
                rows: result.rows || [],
                rowCount: result.rowCount,
                fields: result.fields ? result.fields.map(f => f.name) : [],
                limitReached: false,
                command: result.command
            });
        }

    } catch (error) {
        console.error("Query Execution Error", error);
        return Response.json(
            { error: "Query failed", details: error.message },
            { status: 500 }
        );
    } finally {
        // Ensure cursor is closed if error occurred before manual close
        if (cursorObj) {
            cursorObj.close(() => { });
        }
        if (client) client.release();
        if (pool && pool !== getDbPool()) {
            // Pool is now cached, do not end
        }
    }
}
