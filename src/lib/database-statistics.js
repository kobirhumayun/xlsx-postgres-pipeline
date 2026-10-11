const STATISTICS_WARNING = "Rows were imported, but table statistics could not be refreshed. Schema estimates may remain unavailable.";

// Call only after the import transaction has committed. Maintenance failure
// must not turn a successful import into an error that encourages a retry.
export async function refreshTableStatistics(client, schema, table) {
    const quoteIdentifier = (value) => `"${value.replace(/"/g, '""')}"`;
    let skipped = false;
    const onNotice = (notice) => {
        if (notice.severity === "WARNING") {
            skipped = true;
            console.warn("Table statistics warning:", notice.message);
        }
    };
    client.on("notice", onNotice);

    try {
        await client.query("BEGIN");
        await client.query("SET LOCAL statement_timeout = '30s'");
        await client.query("SET LOCAL lock_timeout = '5s'");
        await client.query(`ANALYZE ${quoteIdentifier(schema)}.${quoteIdentifier(table)}`);
        await client.query("COMMIT");
        return skipped ? STATISTICS_WARNING : null;
    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            console.warn("Statistics rollback failed:", rollbackError.message);
        }
        console.warn("Table statistics refresh failed:", error.message);
        return STATISTICS_WARNING;
    } finally {
        client.removeListener("notice", onNotice);
    }
}
