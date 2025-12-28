import { z } from "zod";
import { getDbPool } from "@/lib/db";

const querySchema = z.object({
    query: z.string().min(1, "Query is required"),
    databaseName: z.string().optional(),
});

export async function POST(request) {
    let pool;
    let client;
    try {
        const body = await request.json();
        const parsed = querySchema.safeParse(body);

        if (!parsed.success) {
            return Response.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
        }

        const { query, databaseName } = parsed.data;

        pool = getDbPool(databaseName);
        client = await pool.connect();

        // Execute query
        const result = await client.query(query);

        return Response.json({
            rows: result.rows,
            rowCount: result.rowCount,
            fields: result.fields.map(f => f.name),
            // Command type (INSERT, SELECT, etc) could be useful
            command: result.command
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
