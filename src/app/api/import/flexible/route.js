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

    // Prepare info variables in outer scope for error handling access
    let totalRows = 0;
    let okRows = 0;
    let errorRows = 0;
    const errors = [];
    let transactionStarted = false;

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

        const parseTableName = (rawName) => {
            const trimmed = rawName.trim();
            const parts = trimmed.split(".");
            if (parts.length > 1) {
                const schema = parts.shift();
                const name = parts.join(".");
                return { schema, name };
            }
            return { schema: "public", name: trimmed };
        };

        // Connect to DB
        pool = getDbPool(databaseName);
        client = await pool.connect();

        const { schema: tableSchema, name: tableBaseName } = parseTableName(tableName);
        const columnResult = await client.query(
            `
        SELECT column_name as name,
               data_type,
               is_nullable,
               ordinal_position
        FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = $2
        ORDER BY ordinal_position
      `,
            [tableSchema, tableBaseName]
        );

        const tableColumns = columnResult.rows ?? [];
        if (!tableColumns.length) {
            return Response.json(
                { error: "Table not found or has no columns." },
                { status: 400 }
            );
        }

        let headers = [];
        // transactionStarted is now defined in outer scope

        // Batch configuration
        const BATCH_SIZE = 1000;
        let batchData = []; // Store { rowNumber, values }

        const quoteId = (id) => `"${id.replace(/"/g, '""')}"`;
        const safeTableName = tableSchema
            ? `${quoteId(tableSchema)}.${quoteId(tableBaseName)}`
            : quoteId(tableBaseName);

        const flushBatch = async () => {
            if (batchData.length === 0) return;
            if (!headers.length) return;

            const numCols = headers.length;
            // Construct info for batch
            const batchValues = batchData.flatMap(d => d.values);

            const valuesClause = [];
            let paramIndex = 1;
            for (let r = 0; r < batchData.length; r++) {
                const rowParams = [];
                for (let c = 0; c < numCols; c++) {
                    rowParams.push(`$${paramIndex++}`);
                }
                valuesClause.push(`(${rowParams.join(',')})`);
            }

            const safeColumns = headers.map(quoteId).join(", ");
            const finalQuery = `INSERT INTO ${safeTableName} (${safeColumns}) VALUES ${valuesClause.join(',')}`;

            try {
                // Try batch insert with a savepoint
                await client.query("SAVEPOINT batch_savepoint");
                await client.query(finalQuery, batchValues);
                await client.query("RELEASE SAVEPOINT batch_savepoint");
                okRows += batchData.length;
            } catch (err) {
                await client.query("ROLLBACK TO SAVEPOINT batch_savepoint");
                console.warn("Batch failed, retrying row-by-row to identify errors:", err.message);

                // Fallback: Row-by-Row to find which one failed
                const singleInsertQuery = `INSERT INTO ${safeTableName} (${safeColumns}) VALUES (${headers.map((_, i) => `$${i + 1}`).join(',')})`;

                for (const item of batchData) {
                    try {
                        await client.query("SAVEPOINT row_savepoint");
                        await client.query(singleInsertQuery, item.values);
                        await client.query("RELEASE SAVEPOINT row_savepoint");
                        okRows++;
                    } catch (rowErr) {
                        await client.query("ROLLBACK TO SAVEPOINT row_savepoint");
                        errorRows++;
                        errors.push({
                            rowNumber: item.rowNumber,
                            error: rowErr.message
                        });
                        // We could continue to find ALL errors in this batch, or stop at the first one.
                        // For "All-or-nothing" robust import with feedback, finding ALL errors in the failing batch is helpful.
                    }
                }

                if (errors.length > 0) {
                    throw new Error(`Import failed with ${errors.length} errors in this batch.`);
                }
            }
            batchData = [];
        };

        // Iterate rows
        for await (const row of targetWorksheetReader) {
            // Row 1 is header
            if (row.number === 1) {
                // Header row
                const normalizeCell = (val) => {
                    if (!val) return "";
                    if (typeof val === 'object') {
                        if (val.text) return val.text;
                        if (val.result) return val.result;
                        // Fallback for other object types if any
                        // ExcelJS Hyperlink: { text: '...', hyperlink: '...' }
                        return JSON.stringify(val);
                    }
                    return String(val);
                };

                const rawValues = Array.isArray(row.values) ? row.values : [];
                if (rawValues.length > 1) {
                    headers = rawValues.slice(1).map(v => normalizeCell(v).trim()).filter(Boolean);
                } else {
                    if (row.cellCount > 0) {
                        const extracted = [];
                        for (let i = 1; i <= row.cellCount; i++) {
                            extracted.push(normalizeCell(row.getCell(i).value).trim());
                        }
                        headers = extracted.filter(Boolean);
                    }
                }

                if (!headers.length) {
                    throw new Error("Header row is empty or invalid.");
                }

                const expectedHeaders = tableColumns.map(column => column.name);
                const headerSet = new Set(headers);
                const expectedSet = new Set(expectedHeaders);
                const missingColumns = expectedHeaders.filter(name => !headerSet.has(name));
                const extraHeaders = headers.filter(name => !expectedSet.has(name));

                if (missingColumns.length || extraHeaders.length) {
                    const mismatchDetails = {
                        missingColumns,
                        extraHeaders,
                        expectedColumns: expectedHeaders,
                        providedHeaders: headers,
                    };
                    console.warn("Import Header Mismatch:", JSON.stringify(mismatchDetails, null, 2));

                    return Response.json(
                        {
                            error: "Header mismatch with table columns.",
                            mismatch: mismatchDetails,
                        },
                        { status: 400 }
                    );
                }

                await client.query("BEGIN");
                transactionStarted = true;
                continue;
            }

            if (!headers.length) continue;

            totalRows++;

            const rowValues = [];
            for (let i = 0; i < headers.length; i++) {
                const cell = row.getCell(i + 1);
                let val = cell.value;
                if (val && typeof val === 'object') {
                    if (val.text) val = val.text;
                    else if (val.result) val = val.result;
                }
                // Sanitize: Postgres rejects empty strings for non-text types. Convert "" to null.
                if (typeof val === 'string' && val.trim() === '') {
                    val = null;
                }
                rowValues.push(val);
            }

            batchData.push({ rowNumber: row.number, values: rowValues });

            if (batchData.length >= BATCH_SIZE) {
                await flushBatch();
            }
        }

        await flushBatch();

        if (transactionStarted) {
            await client.query("COMMIT");
        }

        return Response.json({
            summary: {
                totalRows,
                okRows,
                errorRows,
            },
            errors: [], // No errors if success
        });

    } catch (error) {
        if (client && transactionStarted) {
            try { await client.query("ROLLBACK"); } catch (e) { console.error(e); }
        }
        console.error("Flexible Import Error", error);

        // Determine status code: 
        // If we have collected row errors, it means the process worked but data was invalid -> 422
        // If no row errors are recorded but we crashed, it's likely a system/connection error -> 500
        const status = errors.length > 0 ? 422 : 500;

        return Response.json(
            {
                error: "Failed to process import",
                details: error.message,
                errors: errors,
                summary: {
                    totalRows,
                    okRows,
                    errorRows,
                },
            },
            { status }
        );
    } finally {
        if (client) client.release();
        if (pool && pool !== getDbPool()) {
            await pool.end();
        }
    }
}
