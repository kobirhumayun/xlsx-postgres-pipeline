import { Readable } from "stream";
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

export const dynamic = 'force-dynamic';

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

        // Use Streaming Reader to avoid loading entire file into memory (prevent heap crash on large files)
        // Convert Web Stream to Node Stream
        const nodeStream = Readable.fromWeb(file.stream());

        const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(nodeStream, {
            worksheets: 'emit',
            sharedStrings: 'cache',
            hyperlinks: 'ignore',
            styles: 'ignore',
        });

        // Loop over worksheets
        let targetWorksheetReader = null;

        // We need to iterate to find the right sheet.
        for await (const worksheetReader of workbookReader) {
            if (sheetName) {
                if (worksheetReader.name === sheetName) {
                    targetWorksheetReader = worksheetReader;
                    break;
                }
            } else {
                // Default to first sheet
                targetWorksheetReader = worksheetReader;
                break;
            }
        }

        if (!targetWorksheetReader) {
            return Response.json({ error: "Worksheet not found." }, { status: 400 });
        }

        // Connect to DB
        pool = getDbPool(databaseName);
        client = await pool.connect();

        await client.query("BEGIN");

        let headers = [];
        let totalRows = 0;
        let okRows = 0;
        let errorRows = 0;
        const errors = [];

        // Prepare Batch Logic
        const BATCH_SIZE = 1000;
        let batchValues = [];
        let insertQuerySkeleton = "";
        let safeColumns = "";
        let safeTableName = "";

        const quoteId = (id) => `"${id.replace(/"/g, '""')}"`;

        const flushBatch = async () => {
            if (batchValues.length === 0) return;
            if (!headers.length) return; // Should not happen if we parse correctly

            const numCols = headers.length;
            const numRows = batchValues.length / numCols;

            // Construct values clause ($1,$2), ($3,$4)...
            const valuesClause = [];
            let paramIndex = 1;
            for (let r = 0; r < numRows; r++) {
                const rowParams = [];
                for (let c = 0; c < numCols; c++) {
                    rowParams.push(`$${paramIndex++}`);
                }
                valuesClause.push(`(${rowParams.join(',')})`);
            }

            const finalQuery = `${insertQuerySkeleton} VALUES ${valuesClause.join(',')}`;

            try {
                await client.query(finalQuery, batchValues);
                okRows += numRows;
            } catch (err) {
                throw new Error(`Batch insert failed: ${err.message}`);
            }
            batchValues = [];
        };

        // Iterate rows
        // Note: ExcelJS Reader iterator yields `row` object. 
        // row.values is 1-indexed array: [ <empty>, 'col1', 'col2' ]
        for await (const row of targetWorksheetReader) {
            // Row 1 is header
            if (row.number === 1) {
                // Header row
                const rawValues = Array.isArray(row.values) ? row.values : [];
                // Filter out the potential empty first element if using .values property
                // safest is .slice(1) mapping if length > 1
                if (rawValues.length > 1) {
                    headers = rawValues.slice(1).map(v => String(v || "").trim()).filter(Boolean);
                } else {
                    // Try simpler iteration if sparse checking manual cell count
                    if (row.cellCount > 0) {
                        const extracted = [];
                        for (let i = 1; i <= row.cellCount; i++) {
                            extracted.push(String(row.getCell(i).value || "").trim());
                        }
                        headers = extracted.filter(Boolean);
                    }
                }

                if (!headers.length) {
                    throw new Error("Header row is empty or invalid.");
                }

                // Prep Query
                safeTableName = quoteId(tableName);
                safeColumns = headers.map(quoteId).join(", ");
                insertQuerySkeleton = `INSERT INTO ${safeTableName} (${safeColumns})`;
                continue;
            }

            if (!headers.length) continue; // Skip if no header found yet (should be row 1)

            // Data Row
            totalRows++;

            const rowValues = [];
            for (let i = 0; i < headers.length; i++) {
                // getCell is 1-based
                const cell = row.getCell(i + 1);
                let val = cell.value;
                if (val && typeof val === 'object') {
                    if (val.text) val = val.text;
                    else if (val.result) val = val.result;
                }
                rowValues.push(val);
            }

            batchValues.push(...rowValues);

            if (batchValues.length / headers.length >= BATCH_SIZE) {
                await flushBatch();
            }
        }

        await flushBatch();

        await client.query("COMMIT");

        return Response.json({
            summary: {
                totalRows,
                okRows,
                errorRows,
            },
            errors,
        });

    } catch (error) {
        if (client) {
            try { await client.query("ROLLBACK"); } catch (e) { console.error(e); }
        }
        console.error("Flexible Import Error", error);
        return Response.json(
            { error: "Failed to process import", details: error.message },
            { status: 500 }
        );
    } finally {
        if (client) client.release();
        if (pool && pool !== getDbPool()) {
            await pool.end();
        }
    }
}
