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
        // Cursor doesn't give fields metadata directly for empty sets easily, 
        // but for <1000 rows we only care if we have data.
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
            command: "SELECT" // Cursor implies select
        });

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
            await pool.end();
        }
    }
}
