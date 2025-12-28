import { getDbPool } from "@/lib/db";

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const database = searchParams.get("database");

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
