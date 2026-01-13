
import fs from 'fs';
import path from 'path';
import pg from 'pg';

const { Pool } = pg;

// Load Env
const envPath = path.resolve(process.cwd(), '.env');
const env = {};
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        line = line.trim();
        if (!line || line.startsWith('#')) return;

        const firstEq = line.indexOf('=');
        if (firstEq === -1) return;

        const key = line.substring(0, firstEq).trim();
        let val = line.substring(firstEq + 1).trim();

        // Strip quotes if present
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
        }

        if (key && val) {
            env[key] = val;
            process.env[key] = val;
        }
    });
}

const SERVER_URL = 'http://localhost:3000';

async function runTest() {
    console.log("Starting DDL/DML Verification...");

    if (!env.DATABASE_URL) {
        console.error("DATABASE_URL not found in .env");
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: env.DATABASE_URL,
    });

    const client = await pool.connect();

    try {
        // Cleanup first
        await client.query("DROP TABLE IF EXISTS test_ddl_api");

        // Helper to run query via handler (fetch)
        const runQuery = async (sql) => {
            const res = await fetch(`${SERVER_URL}/api/query/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: sql })
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`API Error ${res.status}: ${text}`);
            }

            return res.json();
        };

        // 1. CREATE TABLE
        console.log("Testing CREATE TABLE...");
        const resCreate = await runQuery("CREATE TABLE test_ddl_api (id SERIAL PRIMARY KEY, note TEXT)");
        console.log("CREATE Result:", resCreate);
        if (resCreate.command !== 'CREATE') throw new Error("Expected command CREATE");

        // 2. INSERT
        console.log("Testing INSERT...");
        const resInsert = await runQuery("INSERT INTO test_ddl_api (note) VALUES ('hello'), ('world')");
        console.log("INSERT Result:", resInsert);
        if (resInsert.command !== 'INSERT') throw new Error("Expected command INSERT");
        if (resInsert.rowCount !== 2) throw new Error("Expected 2 inserted rows");

        // 3. SELECT (Check data)
        console.log("Testing SELECT...");
        const resSelect = await runQuery("SELECT * FROM test_ddl_api ORDER BY id");
        console.log("SELECT Result:", resSelect);
        if (resSelect.command !== 'SELECT') throw new Error("Expected command SELECT");
        if (resSelect.rows.length !== 2) throw new Error("Expected 2 rows");
        if (resSelect.rows[0].note !== 'hello') throw new Error("Data mismatch");

        // 4. UPDATE
        console.log("Testing UPDATE...");
        const resUpdate = await runQuery("UPDATE test_ddl_api SET note = 'updated' WHERE id = 1");
        console.log("UPDATE Result:", resUpdate);
        if (resUpdate.command !== 'UPDATE') throw new Error("Expected command UPDATE");
        if (resUpdate.rowCount !== 1) throw new Error("Expected 1 updated row");

        // 5. DROP TABLE
        console.log("Testing DROP TABLE...");
        const resDrop = await runQuery("DROP TABLE test_ddl_api");
        console.log("DROP Result:", resDrop);
        if (resDrop.command !== 'DROP') throw new Error("Expected command DROP");

        console.log("ALL TESTS PASSED");

    } catch (e) {
        console.error("TEST FAILED", e);
        process.exit(1);
    } finally {
        await client.query("DROP TABLE IF EXISTS test_ddl_api"); // Safety cleanup
        client.release();
        await pool.end();
    }
}

runTest();
