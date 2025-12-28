
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { z } from "zod";

// Load Env
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const [key, val] = line.split('=');
        if (key && val) process.env[key.trim()] = val.trim();
    });
}

// Rel imports
import { getDbPool } from '../src/lib/db.js';
import { toTrimmedString, excelDateToISO } from '../src/lib/ingest.js';

// --- MOCKED API HANDLERS (Logic copied from src/app/api/.../route.js) ---

// 1. Flexible Import Logic
const importSchema = z.object({
    databaseName: z.string().optional(),
    tableName: z.string().min(1, "Table name is required"),
    sheetName: z.string().optional(),
});

async function mockImportHandler(formData) {
    let pool;
    let client;
    try {
        const parsed = importSchema.safeParse({
            databaseName: formData.get("databaseName") || undefined,
            tableName: formData.get("tableName"),
            sheetName: formData.get("sheetName") || undefined,
        });

        if (!parsed.success) throw new Error("Invalid form data");

        const { databaseName, tableName, sheetName } = parsed.data;
        const file = formData.get("file");
        if (!file) throw new Error("File required");

        const workbook = new ExcelJS.Workbook();
        const buffer = Buffer.from(await file.arrayBuffer());
        await workbook.xlsx.load(buffer);

        const worksheet = (sheetName && workbook.getWorksheet(sheetName)) || workbook.worksheets[0];
        if (!worksheet) throw new Error("Worksheet not found");

        const headerRow = worksheet.getRow(1);
        const headers = headerRow.values.slice(1).map(v => String(v || "").trim()).filter(Boolean);
        if (!headers.length) throw new Error("No headers");

        pool = getDbPool(databaseName);
        client = await pool.connect();

        let totalRows = 0, okRows = 0, errorRows = 0;
        const quoteId = (id) => `"${id.replace(/"/g, '""')}"`;
        const safeTableName = quoteId(tableName);
        const safeColumns = headers.map(quoteId).join(", ");
        const placeholders = headers.map((_, i) => `$${i + 1}`).join(", ");
        const insertQuery = `INSERT INTO ${safeTableName} (${safeColumns}) VALUES (${placeholders})`;

        for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
            const row = worksheet.getRow(rowNumber);
            if (!row || row.cellCount === 0) continue;
            totalRows += 1;
            const rowValues = headers.map((_, index) => {
                const cell = row.getCell(index + 1);
                let val = cell.value;
                if (val && typeof val === 'object') {
                    if (val.text) val = val.text;
                    else if (val.result) val = val.result;
                }
                return val;
            });

            try {
                await client.query(insertQuery, rowValues);
                okRows += 1;
            } catch (err) {
                errorRows += 1;
                console.error(`Row ${rowNumber} error:`, err.message);
            }
        }
        return { summary: { totalRows, okRows, errorRows } };

    } catch (e) {
        console.error("Import Error", e);
        throw e;
    } finally {
        if (client) client.release();
        if (pool && pool !== getDbPool()) await pool.end();
    }
}

// 2. Query Run Logic
const querySchema = z.object({
    query: z.string().min(1, "Query is required"),
    databaseName: z.string().optional(),
});

async function mockQueryHandler(body) {
    let pool, client;
    try {
        const parsed = querySchema.parse(body);
        const { query, databaseName } = parsed;
        pool = getDbPool(databaseName);
        client = await pool.connect();
        const result = await client.query(query);
        return { rows: result.rows, rowCount: result.rowCount };
    } finally {
        if (client) client.release();
        if (pool && pool !== getDbPool()) await pool.end();
    }
}

// 3. Export Logic
async function mockExportHandler(body) {
    let pool, client;
    try {
        const parsed = querySchema.parse(body);
        const { query, databaseName } = parsed;
        pool = getDbPool(databaseName);
        client = await pool.connect();
        const result = await client.query(query);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Export");
        const columns = result.fields.map(f => ({ header: f.name, key: f.name }));
        worksheet.columns = columns;
        worksheet.addRows(result.rows);

        return await workbook.xlsx.writeBuffer();
    } finally {
        if (client) client.release();
        if (pool && pool !== getDbPool()) await pool.end();
    }
}

// --- TEST RUNNER ---

async function runTest() {
    console.log("Starting Standalone Verification...");
    const pool = getDbPool();
    const client = await pool.connect();

    try {
        // Setup
        await client.query("DROP TABLE IF EXISTS test_custom_import");
        await client.query("CREATE TABLE test_custom_import (id SERIAL PRIMARY KEY, name TEXT, value INT)");

        // Create Excel
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Sheet1');
        sheet.addRow(['name', 'value']);
        sheet.addRow(['Alice', 100]);
        sheet.addRow(['Bob', 200]);
        const buffer = await workbook.xlsx.writeBuffer();
        const file = new File([buffer], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        // Test Import
        console.log("Testing Import...");
        const formData = new FormData();
        formData.append('tableName', 'test_custom_import');
        formData.append('file', file);

        const importRes = await mockImportHandler(formData);
        console.log("Import Result:", importRes);
        if (importRes.summary.okRows !== 2) throw new Error("Import failed");

        // Test Query
        console.log("Testing Query...");
        const queryRes = await mockQueryHandler({ query: "SELECT * FROM test_custom_import ORDER BY value" });
        console.log("Query Results:", queryRes.rows);
        if (queryRes.rowCount !== 2) throw new Error("Query failed");

        // Test Export
        console.log("Testing Export...");
        const exportBuffer = await mockExportHandler({ query: "SELECT * FROM test_custom_import" });
        console.log("Export Buffer Size:", exportBuffer.length);
        if (exportBuffer.length < 100) throw new Error("Export failed");

        console.log("SUCCESS: All tests passed.");
    } catch (e) {
        console.error("FAILED", e);
        process.exit(1);
    } finally {
        await client.query("DROP TABLE IF EXISTS test_custom_import");
        client.release();
        await pool.end();
    }
}

runTest();
