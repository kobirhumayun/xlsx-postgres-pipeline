import { getDbPool } from "@/lib/db";
import { z } from "zod";

export const dynamic = 'force-dynamic';

const columnSchema = z.object({
    name: z.string().regex(/^[a-zA-Z0-9_]+$/, "Invalid column name").max(63),
    type: z.enum([
        "TEXT", "NUMERIC", "INTEGER", "BOOLEAN", "DATE", "TIMESTAMP", "JSONB"
    ]),
    primaryKey: z.boolean().optional()
});

const createTableSchema = z.object({
    databaseName: z.string().optional(),
    tableName: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Invalid table name").max(63),
    columns: z.array(columnSchema).min(1)
});

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const database = searchParams.get("database");
    const table = searchParams.get("table");

    let pool;
    let client;

    try {
        if (!database) {
            // List Databases
            // Connect to default DB to query catalog
            pool = getDbPool();
            client = await pool.connect();

            const result = await client.query(
                "SELECT datname as name FROM pg_database WHERE datistemplate = false ORDER BY datname"
            );

            return Response.json({
                type: "databases",
                items: result.rows.map(r => r.name)
            });
        } else if (table) {
            // List Columns for specific table
            pool = getDbPool(database);
            client = await pool.connect();

            const [schema, ...nameParts] = table.split(".");
            const tableSchema = nameParts.length ? schema : "public";
            const tableName = nameParts.length ? nameParts.join(".") : schema;

            return Response.json({
                type: "columns",
                items: (
                    await client.query(
                        `
        SELECT column_name as name,
               data_type,
               is_nullable,
               column_default,
               ordinal_position
        FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = $2
        ORDER BY ordinal_position
      `,
                        [tableSchema, tableName]
                    )
                ).rows
            });
        } else {
            // List Tables in specific Database
            pool = getDbPool(database);
            client = await pool.connect();

            // Check if public schema exists or just list all? Default to public for now or typically useful ones.
            // listing all base tables.
            const result = await client.query(`
        SELECT table_schema, table_name 
        FROM information_schema.tables 
        WHERE table_schema NOT IN ('information_schema', 'pg_catalog') 
          AND table_type = 'BASE TABLE'
        ORDER BY table_schema, table_name
      `);

            return Response.json({
                type: "tables",
                items: result.rows.map(r => ({
                    schema: r.table_schema,
                    name: r.table_name,
                    fullName: r.table_schema === 'public' ? r.table_name : `${r.table_schema}.${r.table_name}`
                }))
            });
        }

    } catch (error) {
        console.error("Structure API Error", error);
        return Response.json(
            { error: "Failed to fetch structure", details: error.message },
            { status: 500 }
        );
    } finally {
        if (client) client.release();
        if (pool && pool !== getDbPool()) {
            await pool.end();
        }
    }
}

export async function POST(request) {
    let pool;
    let client;
    try {
        const body = await request.json();
        const parsed = createTableSchema.safeParse(body);

        if (!parsed.success) {
            return Response.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
        }

        const { databaseName, tableName, columns } = parsed.data;
        const seenColumns = new Set();
        const duplicateColumns = new Set();

        for (const column of columns) {
            const normalizedName = column.name.toLowerCase();
            if (seenColumns.has(normalizedName)) {
                duplicateColumns.add(normalizedName);
            } else {
                seenColumns.add(normalizedName);
            }
        }

        if (duplicateColumns.size > 0) {
            return Response.json(
                { error: "Invalid request", details: `Duplicate column names: ${Array.from(duplicateColumns).join(", ")}` },
                { status: 400 }
            );
        }

        pool = getDbPool(databaseName);
        client = await pool.connect();

        // 1. Check if table exists
        // We assume 'public' schema for simplicity in creation unless specified in name.
        // But the validator enforces simple names, so we force public schema to be safe.
        const safeTableName = `public."${tableName}"`;

        const checkExists = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = $1
            )
        `, [tableName]);

        if (checkExists.rows[0].exists) {
            return Response.json({ error: "Table already exists." }, { status: 409 });
        }

        // 2. Construct CREATE TABLE statement
        // Always add ID column
        const columnDefs = [`"id" SERIAL PRIMARY KEY`];

        for (const col of columns) {
            if (col.name === 'id') continue; // Skip if user definition tries to override ID
            columnDefs.push(`"${col.name}" ${col.type}`);
        }

        const query = `CREATE TABLE ${safeTableName} (${columnDefs.join(", ")})`;

        // 3. Execute
        await client.query(query);

        return Response.json({
            success: true,
            message: `Table ${tableName} created successfully.`,
            fullName: `public.${tableName}`
        });

    } catch (error) {
        console.error("Create Table Error", error);
        return Response.json(
            { error: "Failed to create table", details: error.message },
            { status: 500 }
        );
    } finally {
        if (client) client.release();
        if (pool && pool !== getDbPool()) {
            await pool.end();
        }
    }
}
