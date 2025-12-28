import ExcelJS from "exceljs";
import { z } from "zod";
import { getDbPool } from "@/lib/db";
import { toTrimmedString, excelDateToISO } from "@/lib/ingest";

// Reusing some helper logic, but keeping it simple for raw SQL approach
// Since we are inserting into ANY table, we can't strongly type against Prisma schema here easily.
// We will rely on pg driver's parameterization.

const formSchema = z.object({
    databaseName: z.string().optional(),
    tableName: z.string().min(1, "Table name is required"),
    sheetName: z.string().optional(),
});

const getHeaderRow = (worksheet) => {
    const headerRow = worksheet.getRow(1);
    const headers = headerRow.values.slice(1).map((value) =>
        String(value || "").trim()
    );
    return headers.filter(Boolean);
};

export async function POST(request) {
    let pool;
    let client;
    try {
        const formData = await request.formData();
        const parsed = formSchema.safeParse({
            databaseName: formData.get("databaseName") || undefined,
            tableName: formData.get("tableName"),
            sheetName: formData.get("sheetName") || undefined,
        });

        if (!parsed.success) {
            return Response.json({ error: "Invalid form data", details: parsed.error.flatten() }, { status: 400 });
        }

        const { databaseName, tableName, sheetName } = parsed.data;
        const file = formData.get("file");

        if (!file) {
            return Response.json({ error: "File is required." }, { status: 400 });
        }

        const workbook = new ExcelJS.Workbook();
        const buffer = Buffer.from(await file.arrayBuffer());
        await workbook.xlsx.load(buffer);

        const worksheet =
            (sheetName && workbook.getWorksheet(sheetName)) || workbook.worksheets[0];

        if (!worksheet) {
            return Response.json({ error: "Worksheet not found." }, { status: 400 });
        }

        const headers = getHeaderRow(worksheet);
        if (!headers.length) {
            return Response.json(
                { error: "Worksheet header row is empty." },
                { status: 400 }
            );
        }

        // Connect to DB
        pool = getDbPool(databaseName);
        client = await pool.connect();

        // Prepare info
        let totalRows = 0;
        let okRows = 0;
        let errorRows = 0;
        const errors = [];

        // Basic sanitize (though parameterized queries handle values, table names/columns usually can't be parameterized directly in same way without care)
        // We should quote identifiers to be safe against weird chars, but basic SQL injection check on table name is good practice.
        // For this internal tool, we assume 'tableName' and 'headers' are relatively trusted or at least valid identifiers.
        // robust quoting:
        const quoteId = (id) => `"${id.replace(/"/g, '""')}"`;
        const safeTableName = quoteId(tableName);
        const safeColumns = headers.map(quoteId).join(", ");

        // We'll prepare the statement dynamically per row or generic?
        // Doing it per row is safer for mixed types but slower. for now, standard parameterized insert.
        // INSERT INTO "table" ("col1", "col2") VALUES ($1, $2)

        // Check if table exists (optional, but good for feedback)
        // Actually, letting the INSERT fail is also a way to check.

        const placeholders = headers.map((_, i) => `$${i + 1}`).join(", ");
        const insertQuery = `INSERT INTO ${safeTableName} (${safeColumns}) VALUES (${placeholders})`;

        for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
            const row = worksheet.getRow(rowNumber);
            if (!row || row.cellCount === 0) continue;

            totalRows += 1;

            // Extract values matching headers indices
            // headers are 0-indexed in our array, cells are 1-indexed in ExcelJS
            const rowValues = headers.map((_, index) => {
                const cell = row.getCell(index + 1);
                let val = cell.value;

                // Basic helper for dates/types from existing logic could be useful context
                // But for raw SQL insert, we mostly pass values. Postgres driver attempts casting.
                // If generic text-heavy, might be okay.
                // If cell is object (e.g. hyperlink), value might be .text
                if (val && typeof val === 'object') {
                    if (val.text) val = val.text;
                    else if (val.result) val = val.result; // formula result
                }

                // Date handling overlap from ingest.js
                // If it is a number and looks like date? 
                // For now, pass raw unless obvious cleanup needed
                return val;
            });

            try {
                await client.query(insertQuery, rowValues);
                okRows += 1;
            } catch (err) {
                errorRows += 1;
                errors.push({ rowNumber, error: err.message });
            }
        }

        return Response.json({
            summary: {
                totalRows,
                okRows,
                errorRows,
            },
            errors,
        });

    } catch (error) {
        console.error("Flexible Import Error", error);
        return Response.json(
            { error: "Failed to process import", details: error.message },
            { status: 500 }
        );
    } finally {
        if (client) client.release();
        // If we created a NEW pool just for this request (not default), we might want to end it?
        // Current getDbPool reuses 'pool' if default, but creates NEW if custom DB.
        // If custom db, we should probably end it to prevent leaks.
        if (pool && pool !== getDbPool()) { // naive check if it's not the default singleton
            await pool.end();
        }
    }
}
