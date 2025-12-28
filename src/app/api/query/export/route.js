import { z } from "zod";
import { getDbPool } from "@/lib/db";
import ExcelJS from "exceljs";

const querySchema = z.object({
    query: z.string().min(1, "Query is required"),
    databaseName: z.string().optional(),
});

export async function POST(request) {
    let pool;
    let client;
    try {
        // For streaming/download, we might accept JSON body or Form data. 
        // Standard fetch can send JSON.
        const body = await request.json();
        const parsed = querySchema.safeParse(body);

        if (!parsed.success) {
            return Response.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
        }

        const { query, databaseName } = parsed.data;

        pool = getDbPool(databaseName);
        client = await pool.connect();

        // Use a cursor for large datasets if possible, but basic query is easier to start.
        // ExcelJS streaming workbook.

        // We need to return a ReadableStream or similar for Next.js App Router
        // Next.js App Router doesn't support easy piping to Response object in same way as Node http.
        // However, we can create a Buffer and return it, or use `new Response(stream)`.

        // For simplicity/robustness with ExcelJS:
        // 1. Fetch all rows (assuming reasonably sized for "web app export", if huge, cursor needed).
        // 2. Write to buffer.
        // 3. Return buffer.

        const result = await client.query(query);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Export");

        // Add headers
        const columns = result.fields.map(f => ({ header: f.name, key: f.name }));
        worksheet.columns = columns;

        // Add rows
        worksheet.addRows(result.rows);

        const buffer = await workbook.xlsx.writeBuffer();

        return new Response(buffer, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": 'attachment; filename="export.xlsx"',
            },
        });

    } catch (error) {
        console.error("Export Error", error);
        return Response.json(
            { error: "Export failed", details: error.message },
            { status: 500 }
        );
    } finally {
        if (client) client.release();
        if (pool && pool !== getDbPool()) {
            await pool.end();
        }
    }
}
