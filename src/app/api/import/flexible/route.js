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

        // Start Transaction
        await client.query("BEGIN");

        // Prepare info
        let totalRows = 0;
        let okRows = 0;
        let errorRows = 0;
        const errors = [];

        const quoteId = (id) => `"${id.replace(/"/g, '""')}"`;
        const safeTableName = quoteId(tableName);
        const safeColumns = headers.map(quoteId).join(", ");

        // Batch configuration
        const BATCH_SIZE = 1000;
        let batchValues = [];
        let batchPlaceholders = [];

        const flushBatch = async () => {
            if (batchValues.length === 0) return;

            // Construct query: INSERT INTO t (c1, c2) VALUES ($1,$2), ($3,$4)...
            const valuesClause = [];
            let paramIndex = 1;

            // We flattened the values, need to reconstruct placeholders
            // batchValues has N * numCols items
            const numCols = headers.length;
            const numRows = batchValues.length / numCols;

            for (let r = 0; r < numRows; r++) {
                const rowParams = [];
                for (let c = 0; c < numCols; c++) {
                    rowParams.push(`$${paramIndex++}`);
                }
                valuesClause.push(`(${rowParams.join(',')})`);
            }

            const query = `INSERT INTO ${safeTableName} (${safeColumns}) VALUES ${valuesClause.join(',')}`;

            try {
                await client.query(query, batchValues);
                okRows += numRows;
            } catch (err) {
                // In batch mode, if one fails, the whole batch fails.
                // We could retry row-by-row, but for "Robustness" we want to fail fast or just note it.
                // However, since we are in a TRANSACTION, a failure here ABORTS the transaction usually.
                // So we MUST throw to trigger rollback.
                throw new Error(`Batch insert failed: ${err.message}`);
            }

            batchValues = [];
        };


        for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
            const row = worksheet.getRow(rowNumber);
            if (!row || row.cellCount === 0) continue;

            const rowValues = headers.map((_, index) => {
                const cell = row.getCell(index + 1);
                let val = cell.value;
                if (val && typeof val === 'object') {
                    if (val.text) val = val.text;
                    else if (val.result) val = val.result;
                }
                return val;
            });

            // Add to batch
            batchValues.push(...rowValues);
            totalRows += 1;

            if (batchValues.length / headers.length >= BATCH_SIZE) {
                await flushBatch();
            }
        }

        await flushBatch();

        // Commit Transaction
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
            try { await client.query("ROLLBACK"); } catch (e) { console.error("Rollback failed", e); }
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
