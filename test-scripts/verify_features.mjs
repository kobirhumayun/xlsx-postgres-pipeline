import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';
// import { FormData } from 'undici'; // Next.js uses web standard FormData, Node 18+ has it globally but sometimes finicky.
// Actually Node 20 has FormData global.
// We will try global FormData first.

// 1. Load Env
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const [key, val] = line.split('=');
        if (key && val) process.env[key.trim()] = val.trim();
    });
}

// 2. Import Handlers (dynamic import after env set)
const { POST: importHandler } = await import('../src/app/api/import/flexible/route.js');
const { POST: queryHandler } = await import('../src/app/api/query/run/route.js');
const { POST: exportHandler } = await import('../src/app/api/query/export/route.js');
const { getDbPool } = await import('../src/lib/db.js');

async function runTest() {
    console.log("Starting Verification...");

    const pool = getDbPool();
    const client = await pool.connect();

    try {
        // Setup DB
        console.log("Creating test table...");
        await client.query("DROP TABLE IF EXISTS test_custom_import");
        await client.query("CREATE TABLE test_custom_import (id SERIAL PRIMARY KEY, name TEXT, value INT)");

        // Create Excel
        console.log("Creating Excel file...");
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Sheet1');
        sheet.addRow(['name', 'value']); // Headers matching columns (id is serial, skip)
        sheet.addRow(['Alice', 100]);
        sheet.addRow(['Bob', 200]);

        const buffer = await workbook.xlsx.writeBuffer();
        const file = new File([buffer], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        // Test Import
        console.log("Testing Import API...");
        const formData = new FormData(); // Global in Node 20
        formData.append('tableName', 'test_custom_import');
        formData.append('file', file);

        // Mock NextRequest
        // Next.js Request extends Web Request.
        // We can just use global Request.
        const reqImport = new Request('http://localhost/api/import/flexible', {
            method: 'POST',
            body: formData
        });

        const resImport = await importHandler(reqImport);
        const jsonImport = await resImport.json();
        console.log("Import Result:", jsonImport);

        if (jsonImport.summary.okRows !== 2) throw new Error("Import failed count mismatch");

        // Test Query
        console.log("Testing Query API...");
        const reqQuery = new Request('http://localhost/api/query/run', {
            method: 'POST',
            body: JSON.stringify({ query: "SELECT * FROM test_custom_import ORDER BY value" })
        });
        const resQuery = await queryHandler(reqQuery);
        const jsonQuery = await resQuery.json();
        console.log("Query Result:", jsonQuery);

        if (jsonQuery.rowCount !== 2) throw new Error("Query row count mismatch");
        if (jsonQuery.rows[0].name !== 'Alice') throw new Error("Query content mismatch");

        // Test Export
        console.log("Testing Export API...");
        const reqExport = new Request('http://localhost/api/query/export', {
            method: 'POST',
            body: JSON.stringify({ query: "SELECT * FROM test_custom_import" })
        });
        const resExport = await exportHandler(reqExport);

        if (resExport.status !== 200) throw new Error("Export failed status");
        const blob = await resExport.blob();
        console.log("Export Blob Size:", blob.size);
        if (blob.size < 100) throw new Error("Export file too small");

        console.log("ALL TESTS PASSED");

    } catch (e) {
        console.error("TEST FAILED", e);
        process.exit(1);
    } finally {
        await client.query("DROP TABLE IF EXISTS test_custom_import");
        client.release();
        await pool.end();
    }
}

runTest();
