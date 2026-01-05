
const { Client } = require('pg');

const client = new Client({
    connectionString: "postgresql://postgres:postgres@localhost:5432/xlsx_pipeline?schema=public",
});

async function createTable() {
    await client.connect();
    try {
        const query = `
      CREATE TABLE IF NOT EXISTS "SavedQuery" (
          "id" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "description" TEXT,
          "query" TEXT NOT NULL,
          "database" TEXT DEFAULT 'default',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "SavedQuery_pkey" PRIMARY KEY ("id")
      );
    `;
        await client.query(query);
        console.log("SavedQuery table created successfully.");
    } catch (err) {
        console.error("Error creating table:", err);
    } finally {
        await client.end();
    }
}

createTable();
