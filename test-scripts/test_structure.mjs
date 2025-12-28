
import fs from 'fs';
import path from 'path';

// Load Env
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const [key, val] = line.split('=');
        if (key && val) process.env[key.trim()] = val.trim();
    });
}

import { getDbPool } from '../src/lib/db.js';

async function testStructure() {
    console.log("Testing Structure Discovery...");
    const pool = getDbPool();
    const client = await pool.connect();

    try {
        // List DBs
        console.log("--- DATABASES ---");
        const resDb = await client.query("SELECT datname FROM pg_database WHERE datistemplate = false");
        resDb.rows.forEach(r => console.log(r.datname));

        // List Tables in current DB
        console.log("--- TABLES (public) ---");
        const resTables = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
              AND table_type = 'BASE TABLE'
        `);
        resTables.rows.forEach(r => console.log(r.table_name));

    } catch (e) {
        console.error("Discovery Failed", e);
    } finally {
        client.release();
        await pool.end();
    }
}

testStructure();
